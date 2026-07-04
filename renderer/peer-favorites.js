const STORAGE_KEY = 'blip_favorites_v1';

let favorites = new Set();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      favorites = new Set(arr.filter((n) => Number.isFinite(n) && n >= 1 && n <= 64));
    }
  } catch {
    favorites = new Set();
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
  } catch {

  }
}

load();

export function resetFavoritesStore() {
  favorites = new Set();
}

export function isFavorite(peerId) {
  return favorites.has(Number(peerId));
}

export function toggleFavorite(peerId) {
  const id = Number(peerId);
  if (!Number.isFinite(id)) return false;
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  persist();
  window.dispatchEvent(new CustomEvent('blip-favorites-changed'));
  return favorites.has(id);
}

export function comparePeersFavoriteFirst(a, b) {
  const af = isFavorite(a.blipId) ? 0 : 1;
  const bf = isFavorite(b.blipId) ? 0 : 1;
  if (af !== bf) return af - bf;
  if (a.online !== b.online) return a.online ? -1 : 1;
  return a.blipId - b.blipId;
}
