import {
  getPadState,
  setPadState,
  setBoardState,
  setCanvasPixel,
  getClipState,
  pushClipEntry,
  mergeClipEntries,
  clipLimitForTier,
} from './group-projects-store.js';
import { uiShowsPremiumTier } from '../shared/mesh-plus-gates.js';

export const MESH_PROJECT_SCOPE = '__mesh__';

async function safeSend(api, payload) {
  try {
    await api.sendTcpMessage(payload);
  } catch {

  }
}

async function broadcastMesh(api, config, peerIds, type, payload) {
  const myId = Number(config.blipId);
  for (const to of peerIds || []) {
    if (Number(to) === myId) continue;
    await safeSend(api, {
      type,
      to,
      from: myId,
      payload,
    });
  }
}

export async function broadcastMeshPad(api, config, peerIds, payload) {
  return broadcastMesh(api, config, peerIds, 'mesh-proj-pad', payload);
}

export async function broadcastMeshBoard(api, config, peerIds, payload) {
  return broadcastMesh(api, config, peerIds, 'mesh-proj-board', payload);
}

export async function broadcastMeshCanvas(api, config, peerIds, payload) {
  return broadcastMesh(api, config, peerIds, 'mesh-proj-canvas', payload);
}

export async function broadcastMeshClipboard(api, config, peerIds, payload) {
  return broadcastMesh(api, config, peerIds, 'mesh-proj-clipboard', payload);
}

export async function requestMeshClipboardPull(api, config, peerIds) {
  const myId = Number(config.blipId);
  for (const to of peerIds || []) {
    if (Number(to) === myId) continue;
    await safeSend(api, {
      type: 'mesh-proj-clipboard-pull',
      to,
      from: myId,
      payload: {},
    });
  }
}

export async function respondMeshClipboardPull(api, config, requesterId) {
  const cap = clipLimitForTier(uiShowsPremiumTier(config));
  const st = getClipState(MESH_PROJECT_SCOPE);
  await broadcastMeshClipboard(api, config, [requesterId], {
    entries: st.entries.slice(0, cap),
  });
}

export function handleMeshProjectTcp(msg, config, api) {
  const type = msg.type;
  const from = Number(msg.from);
  const myId = Number(config.blipId);
  const clipCap = clipLimitForTier(uiShowsPremiumTier(config));

  if (type === 'mesh-proj-clipboard-pull') {
    if (!Number.isFinite(from) || from === myId) return true;
    if (api) void respondMeshClipboardPull(api, config, from);
    return true;
  }

  if (!Number.isFinite(from) || from === myId) {
    return (
      type === 'mesh-proj-pad' ||
      type === 'mesh-proj-board' ||
      type === 'mesh-proj-canvas' ||
      type === 'mesh-proj-clipboard'
    );
  }

  const payload = msg.payload || {};

  if (type === 'mesh-proj-pad') {
    const incomingAt = Number(payload.updatedAt) || 0;
    const current = getPadState(MESH_PROJECT_SCOPE);
    if (incomingAt >= (current.updatedAt || 0)) {
      setPadState(MESH_PROJECT_SCOPE, {
        text: String(payload.text || ''),
        updatedAt: incomingAt,
        from,
      });
    }
    return true;
  }

  if (type === 'mesh-proj-board') {
    const cards = Array.isArray(payload.cards) ? payload.cards : [];
    setBoardState(MESH_PROJECT_SCOPE, { cards });
    return true;
  }

  if (type === 'mesh-proj-canvas') {
    const x = Number(payload.x);
    const y = Number(payload.y);
    const color = String(payload.color || '');
    if (Number.isFinite(x) && Number.isFinite(y)) {
      setCanvasPixel(MESH_PROJECT_SCOPE, x, y, color);
    }
    return true;
  }

  if (type === 'mesh-proj-clipboard') {
    if (Array.isArray(payload.entries)) {
      mergeClipEntries(MESH_PROJECT_SCOPE, payload.entries, clipCap);
    } else if (payload.entry) {
      pushClipEntry(MESH_PROJECT_SCOPE, payload.entry, clipCap);
    }
    return true;
  }

  return false;
}
