/**
 * Local trust & block lists (never sent over the network).
 */
const TRUST_KEY = 'blip_trusted_peers_v1';
const BLOCK_KEY = 'blip_blocked_peers_v1';

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

export function isTrusted(peerId) {
  return loadSet(TRUST_KEY).has(Number(peerId));
}

export function trustPeer(peerId) {
  const set = loadSet(TRUST_KEY);
  set.add(Number(peerId));
  saveSet(TRUST_KEY, set);
}

export function isBlocked(peerId) {
  return loadSet(BLOCK_KEY).has(Number(peerId));
}

export function blockPeer(peerId) {
  const set = loadSet(BLOCK_KEY);
  set.add(Number(peerId));
  saveSet(BLOCK_KEY, set);
  window.dispatchEvent(new CustomEvent('blip-peer-trust-changed'));
}

export function unblockPeer(peerId) {
  const set = loadSet(BLOCK_KEY);
  set.delete(Number(peerId));
  saveSet(BLOCK_KEY, set);
  window.dispatchEvent(new CustomEvent('blip-peer-trust-changed'));
}

/** Sorted BLIP IDs blocked on this device. */
export function getBlockedPeerIds() {
  return [...loadSet(BLOCK_KEY)].sort((a, b) => a - b);
}
