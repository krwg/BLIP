import { ensureGroupChannels } from './groups.js';

/** @typedef {{ text: string, updatedAt: number, from: number }} PadState */
/** @typedef {{ id: string, text: string, status: 'todo'|'progress'|'done', assignee: number|null }} BoardCard */
/** @typedef {{ cards: BoardCard[] }} BoardState */
/** @typedef {{ w: number, h: number, cells: string[] }} CanvasState */
/** @typedef {{ id: string, text: string, from: number, ts: number }} ClipEntry */

const pads = new Map();
const boards = new Map();
const canvases = new Map();
const clips = new Map();

const CANVAS_W = 32;
const CANVAS_H = 16;
const CLIP_MAX = 20;

function padKey(groupId) {
  return String(groupId);
}

export function getPadState(groupId) {
  const k = padKey(groupId);
  if (!pads.has(k)) pads.set(k, { text: '', updatedAt: 0, from: 0 });
  return pads.get(k);
}

export function setPadState(groupId, state) {
  pads.set(padKey(groupId), { ...state });
  emit(groupId, 'pad');
}

export function getBoardState(groupId) {
  const k = padKey(groupId);
  if (!boards.has(k)) boards.set(k, { cards: [] });
  return boards.get(k);
}

export function setBoardState(groupId, state) {
  boards.set(padKey(groupId), { cards: [...(state.cards || [])] });
  emit(groupId, 'board');
}

export function getCanvasState(groupId) {
  const k = padKey(groupId);
  if (!canvases.has(k)) {
    const cells = Array(CANVAS_W * CANVAS_H).fill('');
    canvases.set(k, { w: CANVAS_W, h: CANVAS_H, cells });
  }
  return canvases.get(k);
}

export function setCanvasPixel(groupId, x, y, color) {
  const st = getCanvasState(groupId);
  if (x < 0 || y < 0 || x >= st.w || y >= st.h) return;
  st.cells[y * st.w + x] = color || '';
  emit(groupId, 'canvas');
}

export function getClipState(groupId) {
  const k = padKey(groupId);
  if (!clips.has(k)) clips.set(k, { entries: [] });
  return clips.get(k);
}

export function pushClipEntry(groupId, entry) {
  const st = getClipState(groupId);
  st.entries = [entry, ...st.entries].slice(0, CLIP_MAX);
  emit(groupId, 'clipboard');
}

export function mergeClipEntries(groupId, entries) {
  const st = getClipState(groupId);
  const seen = new Set(st.entries.map((e) => e.id));
  for (const e of entries || []) {
    if (!e?.id || seen.has(e.id)) continue;
    seen.add(e.id);
    st.entries.push(e);
  }
  st.entries.sort((a, b) => b.ts - a.ts);
  st.entries = st.entries.slice(0, CLIP_MAX);
  emit(groupId, 'clipboard');
}

function emit(groupId, tool) {
  window.dispatchEvent(
    new CustomEvent('blip-group-project', { detail: { groupId: String(groupId), tool } })
  );
}

export function subscribeGroupProject(groupId, cb) {
  const handler = (e) => {
    if (String(e.detail?.groupId) !== String(groupId)) return;
    cb(e.detail?.tool);
  };
  window.addEventListener('blip-group-project', handler);
  return () => window.removeEventListener('blip-group-project', handler);
}

export const PROJECT_CHANNEL_TYPES = ['pad', 'board', 'canvas', 'clipboard'];

export const PROJECT_CHANNEL_TEMPLATES = [
  { id: 'proj-pad', name: 'pad', type: 'pad', icon: '✦' },
  { id: 'proj-board', name: 'board', type: 'board', icon: '▦' },
  { id: 'proj-canvas', name: 'canvas', type: 'canvas', icon: '◻' },
  { id: 'proj-clip', name: 'clipboard', type: 'clipboard', icon: '⧉' },
];

export function ensureProjectChannels(group, enabled) {
  if (!group) return group;
  ensureGroupChannels(group);
  const base = group.channels.filter((c) => !PROJECT_CHANNEL_TYPES.includes(c.type));
  if (!enabled) {
    group.channels = base;
    return group;
  }
  const have = new Set(base.map((c) => c.type));
  const extra = PROJECT_CHANNEL_TEMPLATES.filter((t) => !have.has(t.type)).map((t) => ({ ...t }));
  group.channels = [...base, ...extra];
  return group;
}

export function getProjectChannels(group) {
  ensureGroupChannels(group);
  return group.channels.filter((c) => PROJECT_CHANNEL_TYPES.includes(c.type));
}

export function channelIcon(ch) {
  if (ch?.icon) return ch.icon;
  if (ch?.type === 'text') return '⬡';
  if (ch?.type === 'voice') return '◇';
  const t = PROJECT_CHANNEL_TEMPLATES.find((x) => x.type === ch?.type);
  return t?.icon || '·';
}
