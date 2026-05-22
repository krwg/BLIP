import { app } from 'electron';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  readdirSync,
} from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { buildProfileGifShareDataUrl } from './profile-gif-share.js';

const MAX_HISTORY = 5;
/** @type {number} max stored GIF size (bytes) */
export const MAX_PROFILE_GIF_BYTES = 8 * 1024 * 1024;
/** Max raw GIF bytes for one TCP JSON line (base64 + framing under 4 MiB). */
export const MAX_PROFILE_GIF_TCP_BYTES = 2_800_000;
const MAX_BYTES = MAX_PROFILE_GIF_BYTES;

function gifsDir() {
  return join(app.getPath('userData'), 'profile-gifs');
}

function metaPath() {
  return join(app.getPath('userData'), 'profile-gif-meta.json');
}

function ensureDirs() {
  const dir = gifsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadMeta() {
  ensureDirs();
  try {
    const raw = readFileSync(metaPath(), 'utf8');
    const o = JSON.parse(raw);
    const history = Array.isArray(o?.history)
      ? o.history.filter((id) => typeof id === 'string').slice(0, MAX_HISTORY)
      : [];
    const activeId = typeof o?.activeId === 'string' && history.includes(o.activeId) ? o.activeId : '';
    return { activeId, history };
  } catch {
    return { activeId: '', history: [] };
  }
}

function saveMeta(meta) {
  ensureDirs();
  const history = (meta.history || []).slice(0, MAX_HISTORY);
  let activeId = meta.activeId || '';
  if (activeId && !history.includes(activeId)) activeId = history[0] || '';
  writeFileSync(metaPath(), JSON.stringify({ activeId, history }, null, 2), 'utf8');
  return { activeId, history };
}

function filePathForId(id) {
  return join(gifsDir(), `${id}.gif`);
}

function newId() {
  return randomBytes(8).toString('hex');
}

/**
 * @param {string} dataUrl
 * @returns {string} id
 */
/**
 * @param {Buffer} buf
 * @returns {string}
 */
export function saveProfileGifFromBuffer(buf) {
  if (!buf || buf.length > MAX_BYTES) throw new Error('gif_too_large');
  ensureDirs();
  const id = newId();
  writeFileSync(filePathForId(id), buf);
  const meta = loadMeta();
  const history = [id, ...meta.history.filter((x) => x !== id)].slice(0, MAX_HISTORY);
  for (const old of meta.history) {
    if (!history.includes(old) && existsSync(filePathForId(old))) {
      try {
        unlinkSync(filePathForId(old));
      } catch {
        /* ignore */
      }
    }
  }
  saveMeta({ activeId: id, history });
  return id;
}

export function saveProfileGifFromDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:(?:image\/gif|application\/octet-stream);base64,(.+)$/i);
  if (!m) throw new Error('invalid_gif');
  const buf = Buffer.from(m[1], 'base64');
  return saveProfileGifFromBuffer(buf);
}

/** @param {string} id */
export function setActiveProfileGif(id) {
  const meta = loadMeta();
  if (!id) {
    return saveMeta({ ...meta, activeId: '' });
  }
  if (!meta.history.includes(id) || !existsSync(filePathForId(id))) {
    throw new Error('gif_not_found');
  }
  return saveMeta({ ...meta, activeId: id });
}

export function clearActiveProfileGif() {
  const meta = loadMeta();
  return saveMeta({ ...meta, activeId: '' });
}

function readGifBuffer(id) {
  const meta = loadMeta();
  const useId = id || meta.activeId;
  if (!useId) return null;
  const p = filePathForId(useId);
  if (!existsSync(p)) return null;
  try {
    return readFileSync(p);
  } catch {
    return null;
  }
}

/** @param {string} [id] */
export function getProfileGifDataUrl(id) {
  const buf = readGifBuffer(id);
  if (!buf) return null;
  return `data:image/gif;base64,${buf.toString('base64')}`;
}

/** LAN share payload — downscales if needed so TCP line stays under limit. */
export function getProfileGifShareDataUrl(id) {
  const buf = readGifBuffer(id);
  return buildProfileGifShareDataUrl(buf);
}

export function getActiveProfileGifId() {
  return loadMeta().activeId;
}

export function hasActiveProfileGif() {
  const { activeId } = loadMeta();
  return !!(activeId && existsSync(filePathForId(activeId)));
}

/** @returns {{ id: string, dataUrl: string }[]} */
export function listProfileGifHistory() {
  const { history } = loadMeta();
  const out = [];
  for (const id of history) {
    const dataUrl = getProfileGifDataUrl(id);
    if (dataUrl) out.push({ id, dataUrl });
  }
  return out;
}

/** Sync config fields for announce / public config. */
export function getProfileGifPublicState() {
  const meta = loadMeta();
  return {
    profileGifActiveId: meta.activeId || '',
    profileGifHistory: [...meta.history],
    hasProfileGif: hasActiveProfileGif(),
  };
}
