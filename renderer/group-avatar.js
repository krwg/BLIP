import { drawAvatar } from './avatar.js';

const STORAGE_KEY = 'blip_group_avatar_v1';

function hashGroupId(groupId) {
  let h = 0;
  const s = String(groupId || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 63) + 1;
}

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export function getGroupAvatarDataUrl(groupId) {
  const map = readMap();
  return map[String(groupId)] || null;
}

export function setGroupAvatarDataUrl(groupId, dataUrl) {
  const map = readMap();
  if (!dataUrl) delete map[String(groupId)];
  else map[String(groupId)] = dataUrl;
  writeMap(map);
  window.dispatchEvent(new CustomEvent('blip-group-avatar-changed', { detail: { groupId } }));
}

/**
 * @param {string} groupId
 * @param {number} [scale]
 */
export function createGroupAvatarElement(groupId, scale = 3) {
  const wrap = document.createElement('div');
  wrap.className = 'avatar-wrap group-avatar-wrap';
  const custom = getGroupAvatarDataUrl(groupId);
  if (custom) {
    const img = document.createElement('img');
    img.className = 'avatar-img';
    img.src = custom;
    img.alt = '';
    img.width = 8 * scale;
    img.height = 8 * scale;
    wrap.appendChild(img);
    return wrap;
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'avatar-canvas';
  drawAvatar(canvas, hashGroupId(groupId), scale);
  wrap.appendChild(canvas);
  return wrap;
}
