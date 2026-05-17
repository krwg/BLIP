const SEED_KEY = 'blip_avatar_seed_v1';
const PEER_AVATAR_KEY = 'blip_peer_avatar_v1';
const SELF_AVATAR_KEY = 'blip_self_avatar_v1';

const SHADES = ['#004d3d', '#008f72', '#00ffc8'];

let selfCustomDataUrl = null;

function hashBlipId(blipId) {
  let h = blipId * 2654435761;
  return ((h >>> 0) % 65536) / 65536;
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getAvatarSeed(blipId) {
  try {
    const raw = localStorage.getItem(SEED_KEY);
    if (!raw) return blipId;
    const o = JSON.parse(raw);
    const n = Number(o?.[String(blipId)]);
    return Number.isFinite(n) ? n : blipId;
  } catch {
    return blipId;
  }
}

export function setAvatarSeed(blipId, seed) {
  try {
    const raw = localStorage.getItem(SEED_KEY);
    const o = raw ? JSON.parse(raw) : {};
    o[String(blipId)] = seed;
    localStorage.setItem(SEED_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

export function regenerateAvatar(blipId) {
  const seed = Math.floor(Math.random() * 2147483646) + 1;
  setAvatarSeed(blipId, seed);
}

export function generateAvatarData(blipId) {
  const seed = getAvatarSeed(blipId);
  const rand = seededRandom(Math.floor(hashBlipId(seed) * 1e9) + Number(seed));
  const pixels = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      const filled = rand() > 0.35;
      const shade = SHADES[Math.floor(rand() * SHADES.length)];
      pixels[y * 8 + x] = filled ? shade : 'transparent';
      pixels[y * 8 + (7 - x)] = filled ? shade : 'transparent';
    }
  }
  return pixels;
}

export function drawAvatar(canvas, blipId, scale = 4) {
  const pixels = generateAvatarData(blipId);
  const size = 8 * scale;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 64; i++) {
    const color = pixels[i];
    if (color === 'transparent') continue;
    const x = (i % 8) * scale;
    const y = Math.floor(i / 8) * scale;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, scale, scale);
  }
}

function readPeerAvatars() {
  try {
    const raw = localStorage.getItem(PEER_AVATAR_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writePeerAvatars(map) {
  try {
    localStorage.setItem(PEER_AVATAR_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export function getPeerAvatarDataUrl(blipId) {
  const map = readPeerAvatars();
  return map[String(blipId)] || null;
}

export function setPeerAvatarDataUrl(blipId, dataUrl) {
  const map = readPeerAvatars();
  if (!dataUrl) {
    delete map[String(blipId)];
  } else {
    map[String(blipId)] = dataUrl;
  }
  writePeerAvatars(map);
}

export function setSelfAvatarCache(dataUrl) {
  selfCustomDataUrl = dataUrl || null;
  try {
    if (dataUrl) localStorage.setItem(SELF_AVATAR_KEY, dataUrl);
    else localStorage.removeItem(SELF_AVATAR_KEY);
  } catch {
    /* ignore */
  }
}

export function getSelfAvatarCache() {
  if (selfCustomDataUrl) return selfCustomDataUrl;
  try {
    return localStorage.getItem(SELF_AVATAR_KEY);
  } catch {
    return null;
  }
}

export async function loadSelfAvatarFromMain() {
  try {
    const url = await window.blip?.getAvatarDataUrl?.();
    if (url) setSelfAvatarCache(url);
    else setSelfAvatarCache(null);
    return url;
  } catch {
    return null;
  }
}

function resolveCustomUrl(blipId, opts = {}) {
  const selfId = opts.selfBlipId != null ? Number(opts.selfBlipId) : null;
  if (selfId != null && Number(blipId) === selfId) {
    return getSelfAvatarCache();
  }
  return getPeerAvatarDataUrl(blipId);
}

function appendImageAvatar(wrap, dataUrl, scale) {
  const img = document.createElement('img');
  img.className = 'avatar-img';
  img.src = dataUrl;
  img.alt = '';
  img.width = 8 * scale;
  img.height = 8 * scale;
  img.decoding = 'async';
  wrap.appendChild(img);
}

/**
 * @param {number} blipId
 * @param {number} [scale]
 * @param {{ selfBlipId?: number | null }} [opts]
 */
export function createAvatarElement(blipId, scale = 4, opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'avatar-wrap';
  const custom = resolveCustomUrl(blipId, opts);
  if (custom) {
    appendImageAvatar(wrap, custom, scale);
    return wrap;
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'avatar-canvas';
  drawAvatar(canvas, blipId, scale);
  wrap.appendChild(canvas);
  return wrap;
}

/** Resize image file to JPEG data URL (max ~48KB for LAN share). */
export function fileToAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode_failed'));
      img.onload = () => {
        const max = 128;
        let w = img.width;
        let h = img.height;
        const ratio = Math.min(max / w, max / h, 1);
        w = Math.max(8, Math.round(w * ratio));
        h = Math.max(8, Math.round(h * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, w, h);
        let quality = 0.88;
        let url = canvas.toDataURL('image/jpeg', quality);
        while (url.length > 52000 && quality > 0.35) {
          quality -= 0.12;
          url = canvas.toDataURL('image/jpeg', quality);
        }
        if (url.length > 64000) {
          reject(new Error('image_too_large'));
          return;
        }
        resolve(url);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
