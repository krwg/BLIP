import { drawAvatar } from './avatar.js';
import { getGroup } from './groups.js';

const STORAGE_KEY = 'blip_group_avatar_v1';
const MAX_SHARE_CHARS = 64000;

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

/**
 * Resize to square JPEG for LAN (same budget as peer avatars).
 * @param {string} dataUrl
 * @returns {Promise<string | null>}
 */
export function compressGroupAvatarForShare(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onerror = () => resolve(null);
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
      if (url.length > MAX_SHARE_CHARS) {
        resolve(null);
        return;
      }
      resolve(url);
    };
    img.src = dataUrl;
  });
}

export function setGroupAvatarDataUrl(groupId, dataUrl) {
  const map = readMap();
  if (!dataUrl) delete map[String(groupId)];
  else map[String(groupId)] = dataUrl;
  writeMap(map);
  window.dispatchEvent(new CustomEvent('blip-group-avatar-changed', { detail: { groupId } }));
}

/**
 * Push group avatar to online members (LAN TCP).
 * @param {string} groupId
 * @param {{ sendTcpMessage: Function }} api
 * @param {number} selfId
 */
export async function broadcastGroupAvatarToMembers(groupId, api, selfId) {
  const group = getGroup(groupId);
  if (!group || !api?.sendTcpMessage) return;
  const raw = getGroupAvatarDataUrl(groupId);
  if (!raw) return;
  const dataUrl = await compressGroupAvatarForShare(raw);
  if (!dataUrl) return;
  const from = Number(selfId);
  for (const m of group.members) {
    const to = Number(m);
    if (!Number.isFinite(to) || to === from) continue;
    try {
      await api.sendTcpMessage({
        type: 'group-avatar-share',
        groupId,
        to,
        from,
        dataUrl,
      });
    } catch {
      /* offline */
    }
  }
}

/**
 * Ask members for their group avatar (they reply with group-avatar-share if set).
 */
export async function requestGroupAvatarsFromMembers(groupId, api, selfId) {
  const group = getGroup(groupId);
  if (!group || !api?.sendTcpMessage) return;
  const from = Number(selfId);
  for (const m of group.members) {
    const to = Number(m);
    if (!Number.isFinite(to) || to === from) continue;
    try {
      await api.sendTcpMessage({
        type: 'group-avatar-request',
        groupId,
        to,
        from,
      });
    } catch {
      /* offline */
    }
  }
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
