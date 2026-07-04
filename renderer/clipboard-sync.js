import { t } from './i18n.js';
import { isBlocked } from './peer-trust.js';

const MAX_CLIP_BYTES = 32 * 1024;
const POLL_MS = 1500;

let pollTimer = null;
let lastSent = '';
let lastApplied = '';

export const CLIPBOARD_SYNC_MODES = ['off', 'active'];

export function normalizeClipboardSyncMode(value) {
  if (value === 'trusted') return 'active';
  return CLIPBOARD_SYNC_MODES.includes(value) ? value : 'off';
}

export function formatClipboardToast(fromPeerId) {
  return t('clipboard.received').replace('{id}', String(fromPeerId));
}

function resolveTargets(mode, config, peers, activePeer) {
  const myId = Number(config.blipId);
  const online = (peers || []).filter((p) => p.online && Number(p.blipId) !== myId);

  if (mode === 'active') {
    const id = Number(activePeer);
    if (!Number.isFinite(id)) return [];
    return online.some((p) => Number(p.blipId) === id) ? [id] : [];
  }

  return [];
}

export function startClipboardSync(deps) {
  stopClipboardSync();
  pollTimer = setInterval(() => {
    void pollClipboard(deps);
  }, POLL_MS);
}

export function stopClipboardSync() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollClipboard(deps) {
  const config = deps.getConfig();
  const mode = normalizeClipboardSyncMode(config.clipboardSyncMode);
  if (mode === 'off') return;

  let text;
  try {
    text = await navigator.clipboard.readText();
  } catch {
    return;
  }

  if (!text || text === lastSent || text === lastApplied) return;
  if (text.length > MAX_CLIP_BYTES) return;

  const targets = resolveTargets(mode, config, deps.getPeers(), deps.getActivePeer());
  if (!targets.length) return;

  lastSent = text;
  const from = config.blipId;
  for (const to of targets) {
    try {
      await deps.sendTcpMessage({
        type: 'clipboard-push',
        to,
        from,
        text,
        ts: Date.now(),
      });
    } catch {

    }
  }
}

export async function handleClipboardPush(msg, ctx) {
  const from = Number(msg.from);
  if (!Number.isFinite(from) || isBlocked(from)) return;

  const mode = normalizeClipboardSyncMode(ctx.getConfig().clipboardSyncMode);
  if (mode === 'off') return;

  if (mode === 'active') {
    const active = Number(ctx.getActivePeer());
    if (!Number.isFinite(active) || active !== from) return;
  }

  const text = String(msg.text ?? '').slice(0, MAX_CLIP_BYTES);
  if (!text || text === lastSent) return;

  lastApplied = text;
  try {
    await navigator.clipboard.writeText(text);
    ctx.onApplied?.(from);
  } catch {

  }
}
