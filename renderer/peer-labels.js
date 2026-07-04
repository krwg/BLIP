
const STORAGE_KEY = 'blip_mesh_labels_v1';

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

export function getMeshLabel(peerId) {
  const id = String(peerId);
  const v = loadMap()[id];
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

export function setMeshLabel(peerId, label) {
  const id = String(peerId);
  const map = loadMap();
  const trimmed = (label || '').trim();
  if (!trimmed) {
    delete map[id];
  } else {
    map[id] = trimmed.slice(0, 32);
  }
  saveMap(map);
  window.dispatchEvent(new CustomEvent('blip-mesh-labels-changed', { detail: { peerId: Number(peerId) } }));
}

export function clearMeshLabel(peerId) {
  setMeshLabel(peerId, '');
}

export function formatPeerDisplayName(peer, peerId = peer?.blipId) {
  const label = getMeshLabel(peerId);
  if (label) return label;
  if (peer?.displayName) return peer.displayName;
  return `BLIP-${peerId}`;
}
