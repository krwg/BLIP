
const STORAGE_KEY = 'blip_peer_private_notes_v1';
const MAX_NOTE_LEN = 500;

function loadMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

function saveMap(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getPeerPrivateNote(peerId) {
  const id = String(peerId);
  const v = loadMap()[id];
  return typeof v === 'string' ? v : '';
}

export function setPeerPrivateNote(peerId, text) {
  const id = String(peerId);
  const map = loadMap();
  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    delete map[id];
  } else {
    map[id] = trimmed.slice(0, MAX_NOTE_LEN);
  }
  saveMap(map);
  window.dispatchEvent(
    new CustomEvent('blip-peer-private-notes-changed', { detail: { peerId: Number(peerId) } })
  );
}
