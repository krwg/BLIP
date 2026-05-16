const STORAGE_KEY = 'blip_groups_v1';

/** @type {Map<string, object>} */
const groups = new Map();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    for (const [id, g] of Object.entries(o)) {
      if (g && typeof g === 'object' && g.id) groups.set(id, g);
    }
  } catch (e) {
    console.warn('[BLIP groups] load', e);
  }
}

function persist() {
  try {
    const o = {};
    for (const [id, g] of groups) o[id] = g;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
  } catch (e) {
    console.warn('[BLIP groups] persist', e);
  }
}

load();

export function generateGroupId() {
  return Math.random().toString(36).slice(2, 10);
}

export function getAllGroups() {
  return [...groups.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getGroup(groupId) {
  return groups.get(groupId) || null;
}

export function saveGroup(group) {
  groups.set(group.id, { ...group, updatedAt: Date.now() });
  persist();
  window.dispatchEvent(new CustomEvent('blip-groups-changed', { detail: { groupId: group.id } }));
}

export function deleteGroup(groupId) {
  groups.delete(groupId);
  persist();
  window.dispatchEvent(new CustomEvent('blip-groups-changed', { detail: { groupId } }));
}

export function amHost(group, blipId) {
  return group && Number(group.hostId) === Number(blipId);
}

export function pickNextHost(currentHost, members, onlineIds) {
  const sorted = [...new Set(members.map(Number))].sort((a, b) => a - b);
  const idx = sorted.indexOf(Number(currentHost));
  if (idx < 0) return sorted.find((id) => onlineIds.has(id)) ?? null;
  for (let i = 1; i <= sorted.length; i++) {
    const next = sorted[(idx + i) % sorted.length];
    if (onlineIds.has(next)) return next;
  }
  return null;
}

export function getGroupMessages(groupId) {
  const g = getGroup(groupId);
  if (!g.messages) g.messages = [];
  return g.messages;
}

export function addGroupMessage(groupId, msg) {
  const g = getGroup(groupId);
  if (!g) return;
  if (!g.messages) g.messages = [];
  g.messages.push(msg);
  if (g.messages.length > 500) g.messages = g.messages.slice(-500);
  g.updatedAt = Date.now();
  persist();
}

export function groupDisplayName(group) {
  if (group.name) return group.name;
  const ids = (group.members || []).slice(0, 4).join(',');
  return `MESH [${ids}${group.members?.length > 4 ? '…' : ''}]`;
}
