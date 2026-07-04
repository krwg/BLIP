
const BLOCK_KEY = 'blip_blocked_peers_v1';

let blockedIds = new Set();
let saveApi = null;

function loadSet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((n) => Number(n)).filter((n) => Number.isFinite(n)));
  } catch {
    return new Set();
  }
}

function saveSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

function persistToMain() {
  if (!saveApi) return;
  void saveApi({
    blockedPeerIds: [...blockedIds].sort((a, b) => a - b),
  });
}

export function initPeerTrust(cfg, api) {
  saveApi = (updates) => api.saveConfig(updates);
  const fromConfigBlocked = Array.isArray(cfg?.blockedPeerIds) ? cfg.blockedPeerIds : null;

  if (fromConfigBlocked?.length) {
    blockedIds = new Set(fromConfigBlocked.map((n) => Number(n)).filter(Number.isFinite));
    saveSet(BLOCK_KEY, blockedIds);
  } else {
    blockedIds = loadSet(BLOCK_KEY);
    if (blockedIds.size) persistToMain();
  }
}

export function applyTrustFromConfig(cfg) {
  if (Array.isArray(cfg?.blockedPeerIds)) {
    blockedIds = new Set(cfg.blockedPeerIds.map((n) => Number(n)).filter(Number.isFinite));
    saveSet(BLOCK_KEY, blockedIds);
  }
}

export function isBlocked(peerId) {
  return blockedIds.has(Number(peerId));
}

export function blockPeer(peerId) {
  blockedIds.add(Number(peerId));
  saveSet(BLOCK_KEY, blockedIds);
  persistToMain();
  window.dispatchEvent(new CustomEvent('blip-peer-block-changed'));
}

export function unblockPeer(peerId) {
  blockedIds.delete(Number(peerId));
  saveSet(BLOCK_KEY, blockedIds);
  persistToMain();
  window.dispatchEvent(new CustomEvent('blip-peer-block-changed'));
}

export function getBlockedPeerIds() {
  return [...blockedIds].sort((a, b) => a - b);
}
