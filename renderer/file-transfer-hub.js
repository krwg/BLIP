import { t } from './i18n.js';
import { formatFileSize } from './file-transfer.js';
import { formatTransferSpeed } from './file-transfer-speed.js';

const AUTO_CLEAR_MS = 5000;

/** @type {Map<string, { id: string, peerId: number, transferId: string, name: string, direction: string, progress: number, size: number, speedBps?: number, startedAt?: number, cancellable?: boolean, onCancel?: () => void }>} */
const active = new Map();
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const autoClearTimers = new Map();
let rootEl = null;
let listEl = null;
let clearBtnEl = null;

function transferKey(peerId, transferId) {
  return `${peerId}:${transferId}`;
}

function cancelAutoClear(id) {
  const timer = autoClearTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    autoClearTimers.delete(id);
  }
}

function scheduleAutoClear(id) {
  if (autoClearTimers.has(id)) return;
  const timer = setTimeout(() => {
    autoClearTimers.delete(id);
    active.delete(id);
    render();
  }, AUTO_CLEAR_MS);
  autoClearTimers.set(id, timer);
}

function dismissTransfer(id) {
  cancelAutoClear(id);
  active.delete(id);
  render();
}

function clearAllTransfers() {
  for (const timer of autoClearTimers.values()) clearTimeout(timer);
  autoClearTimers.clear();
  active.clear();
  render();
}

function ensureDom() {
  if (rootEl?.isConnected) return;
  rootEl = document.createElement('div');
  rootEl.className = 'transfer-hub glass hidden';
  rootEl.setAttribute('aria-live', 'polite');

  const head = document.createElement('div');
  head.className = 'transfer-hub-head';

  const title = document.createElement('span');
  title.className = 'transfer-hub-title';
  title.dataset.i18n = 'transfer.hub_title';
  title.textContent = t('transfer.hub_title');
  head.appendChild(title);

  clearBtnEl = document.createElement('button');
  clearBtnEl.type = 'button';
  clearBtnEl.className = 'btn btn-lang transfer-hub-clear';
  clearBtnEl.dataset.i18n = 'transfer.hub_clear';
  clearBtnEl.setAttribute('aria-label', t('transfer.hub_clear'));
  clearBtnEl.textContent = '×';
  clearBtnEl.addEventListener('click', (e) => {
    e.stopPropagation();
    clearAllTransfers();
  });
  head.appendChild(clearBtnEl);

  listEl = document.createElement('div');
  listEl.className = 'transfer-hub-list';
  rootEl.appendChild(head);
  rootEl.appendChild(listEl);
  document.body.appendChild(rootEl);
}

function render() {
  ensureDom();
  if (!listEl) return;
  listEl.innerHTML = '';
  if (active.size === 0) {
    rootEl.classList.add('hidden');
    return;
  }
  rootEl.classList.remove('hidden');

  for (const job of active.values()) {
    const row = document.createElement('div');
    row.className = 'transfer-hub-row';

    const top = document.createElement('div');
    top.className = 'transfer-hub-row-top';

    const meta = document.createElement('div');
    meta.className = 'transfer-hub-meta';
    const name = document.createElement('span');
    name.className = 'transfer-hub-name';
    name.textContent = job.name || 'file';
    const sub = document.createElement('span');
    sub.className = 'transfer-hub-sub';
    const dir =
      job.direction === 'in'
        ? t('transfer.hub_in').replace('{id}', String(job.peerId))
        : t('transfer.hub_out').replace('{id}', String(job.peerId));
    const speedPart =
      job.speedBps && job.progress > 0 && job.progress < 100
        ? ` · ${formatTransferSpeed(job.speedBps)}`
        : '';
    sub.textContent = `${dir} · ${formatFileSize(job.size)}${speedPart} · ${job.progress}%`;
    meta.appendChild(name);
    meta.appendChild(sub);
    top.appendChild(meta);

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'btn btn-lang transfer-hub-dismiss';
    dismissBtn.setAttribute('aria-label', t('transfer.hub_dismiss'));
    dismissBtn.textContent = '×';
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissTransfer(job.id);
    });
    top.appendChild(dismissBtn);

    const track = document.createElement('div');
    track.className = 'transfer-hub-track';
    const fill = document.createElement('div');
    fill.className = 'transfer-hub-fill';
    fill.style.width = `${Math.min(100, Math.max(0, job.progress))}%`;
    track.appendChild(fill);

    row.appendChild(top);
    row.appendChild(track);

    if (job.cancellable && job.progress < 100 && job.onCancel) {
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-lang transfer-hub-cancel';
      cancelBtn.dataset.i18n = 'transfer.hub_cancel';
      cancelBtn.textContent = t('transfer.hub_cancel');
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        job.onCancel?.();
      });
      row.appendChild(cancelBtn);
    }

    listEl.appendChild(row);
  }
}

export function trackTransferStart(peerId, transferId, meta = {}) {
  const id = transferKey(peerId, transferId);
  cancelAutoClear(id);
  active.set(id, {
    id,
    peerId: Number(peerId),
    transferId: String(transferId),
    name: meta.name || 'file',
    direction: meta.direction || 'out',
    progress: 0,
    size: meta.size || 0,
    startedAt: Date.now(),
    speedBps: 0,
    cancellable: meta.cancellable !== false && meta.direction === 'out',
    onCancel: meta.onCancel,
  });
  render();
}

export function trackTransferProgress(peerId, transferId, progress, meta = {}) {
  const id = transferKey(peerId, transferId);
  let job = active.get(id);
  if (!job) {
    trackTransferStart(peerId, transferId, { ...meta, direction: meta.direction || 'in' });
    job = active.get(id);
  }
  if (!job) return;
  job.progress = Math.min(100, Math.max(0, Math.round(progress)));
  if (meta.name) job.name = meta.name;
  if (meta.size) job.size = meta.size;
  if (meta.speedBps) job.speedBps = meta.speedBps;
  else if (job.size && job.startedAt) {
    const elapsed = Math.max(0.001, (Date.now() - job.startedAt) / 1000);
    job.speedBps = ((job.size * job.progress) / 100) / elapsed;
  }
  if (job.progress >= 100) scheduleAutoClear(id);
  render();
}

export function trackTransferEnd(peerId, transferId) {
  const id = transferKey(peerId, transferId);
  cancelAutoClear(id);
  active.delete(id);
  render();
}

export function refreshTransferHubI18n() {
  ensureDom();
  const title = rootEl?.querySelector('.transfer-hub-title');
  if (title) title.textContent = t('transfer.hub_title');
  if (clearBtnEl) {
    clearBtnEl.setAttribute('aria-label', t('transfer.hub_clear'));
  }
  render();
}
