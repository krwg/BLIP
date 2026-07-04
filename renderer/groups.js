import { t } from './i18n.js';

const STORAGE_KEY = 'blip_groups_v1';
const DECLINED_KEY = 'blip_groups_declined_v1';

const groups = new Map();

const declinedInvites = new Set();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    for (const [id, g] of Object.entries(o)) {
      if (g && typeof g === 'object' && g.id) {
        if (g.hostId != null) g.hostId = Number(g.hostId);
        if (Array.isArray(g.members)) g.members = normalizeMemberIds(g.members);
        if (Array.isArray(g.messages)) g.messages = dedupeMessages(g.messages);
        ensureGroupChannels(g);
        groups.set(id, g);
      }
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

export function normalizeMemberIds(members) {
  return [...new Set((members || []).map((m) => Number(m)).filter(Number.isFinite))];
}

export function dedupeMessages(messages) {
  const seen = new Set();
  const out = [];
  for (const m of messages || []) {
    if (m?.id && seen.has(m.id)) continue;
    if (m?.id) seen.add(m.id);
    out.push(m);
  }
  return out;
}

export function isGroupMember(group, blipId) {
  if (!group?.members) return false;
  const id = Number(blipId);
  return group.members.some((m) => Number(m) === id);
}

function loadDeclined() {
  try {
    const raw = localStorage.getItem(DECLINED_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) arr.forEach((id) => declinedInvites.add(String(id)));
  } catch (e) {
    console.warn('[BLIP groups] declined load', e);
  }
}

function persistDeclined() {
  try {
    localStorage.setItem(DECLINED_KEY, JSON.stringify([...declinedInvites]));
  } catch (e) {
    console.warn('[BLIP groups] declined persist', e);
  }
}

load();
loadDeclined();

export function isInviteDeclined(groupId) {
  return declinedInvites.has(String(groupId));
}

export function declineGroupInvite(groupId) {
  declinedInvites.add(String(groupId));
  persistDeclined();
}

export function clearDeclinedInvite(groupId) {
  declinedInvites.delete(String(groupId));
  persistDeclined();
}

export function resetGroupsStore() {
  groups.clear();
  declinedInvites.clear();
}

export function purgeGroupsFor(blipId) {
  const id = Number(blipId);
  let changed = false;
  for (const [gid, g] of [...groups]) {
    if (!isGroupMember(g, id)) {
      groups.delete(gid);
      changed = true;
    }
  }
  if (changed) persist();
}

export function generateGroupId() {
  return Math.random().toString(36).slice(2, 10);
}

export function getAllGroups() {
  return [...groups.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getGroupsFor(blipId) {
  const id = Number(blipId);
  return getAllGroups().filter((g) => isGroupMember(g, id));
}

export function getGroup(groupId) {
  return groups.get(groupId) || null;
}

export const DEFAULT_CHANNELS = [
  { id: 'text-general', name: 'general', type: 'text' },
  { id: 'voice-lounge', name: 'voice', type: 'voice' },
];

export function formatChannelLabel(ch) {
  if (!ch) return '';
  if (ch.type === 'voice' && (ch.id === 'voice-lounge' || ch.name === 'lounge' || ch.name === 'voice')) {
    return t('voice.channel_name');
  }
  if (ch.type === 'text' && (ch.id === 'text-general' || ch.name === 'general')) {
    return t('voice.channel_general');
  }
  const slug = String(ch.name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  if (slug) {
    const key = `voice.channel_${slug}`;
    const localized = t(key);
    if (localized !== key) return localized;
  }
  return ch.name || '';
}

export function ensureGroupChannels(group) {
  if (!group) return group;
  if (!Array.isArray(group.channels) || !group.channels.length) {
    group.channels = DEFAULT_CHANNELS.map((c) => ({ ...c }));
  } else {
    for (const ch of group.channels) {
      if (ch.type === 'voice' && (ch.name === 'lounge' || ch.id === 'voice-lounge')) {
        ch.name = 'voice';
      }
    }
  }
  return group;
}

export function getTextChannels(group) {
  ensureGroupChannels(group);
  return group.channels.filter((c) => c.type === 'text');
}

export function getVoiceChannels(group) {
  ensureGroupChannels(group);
  return group.channels.filter((c) => c.type === 'voice');
}

export function importGroupRecord(group, { persist: doPersist = true } = {}) {
  if (!group?.id) return false;
  const normalized = ensureGroupChannels({
    ...group,
    hostId: group.hostId != null ? Number(group.hostId) : group.hostId,
    members: normalizeMemberIds(group.members),
    messages: Array.isArray(group.messages) ? group.messages : [],
  });
  groups.set(normalized.id, normalized);
  if (doPersist) persist();
  return true;
}

export function saveGroup(group) {
  const normalized = ensureGroupChannels({
    ...group,
    hostId: Number(group.hostId),
    members: normalizeMemberIds(group.members),
    updatedAt: Date.now(),
  });
  if (Array.isArray(normalized.messages)) {
    normalized.messages = dedupeMessages(normalized.messages);
  }
  groups.set(normalized.id, normalized);
  persist();
  window.dispatchEvent(new CustomEvent('blip-groups-changed', { detail: { groupId: normalized.id } }));
}

export function deleteGroup(groupId) {
  groups.delete(groupId);
  persist();
  window.dispatchEvent(new CustomEvent('blip-groups-changed', { detail: { groupId } }));
}

export function removeMemberFromGroup(groupId, blipId) {
  const g = getGroup(groupId);
  if (!g) return null;
  const id = Number(blipId);
  g.members = g.members.filter((m) => Number(m) !== id);
  g.updatedAt = Date.now();
  if (!g.members.length) {
    deleteGroup(groupId);
    return null;
  }
  persist();
  window.dispatchEvent(new CustomEvent('blip-groups-changed', { detail: { groupId } }));
  return g;
}

export function amHost(group, blipId) {
  return group && Number(group.hostId) === Number(blipId);
}

export function pickNextHost(currentHost, members, onlineIds) {
  const sorted = normalizeMemberIds(members).sort((a, b) => a - b);
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

export function findGroupMessage(groupId, messageId) {
  if (!messageId) return null;
  return getGroupMessages(groupId).find((m) => m.id === messageId) || null;
}

export function addGroupMessage(groupId, msg) {
  const g = getGroup(groupId);
  if (!g) return false;
  if (!g.messages) g.messages = [];
  if (msg.id && g.messages.some((m) => m.id === msg.id)) return false;
  const fp = `${Number(msg.from)}:${msg.timestamp}:${(msg.text || '').slice(0, 80)}`;
  if (g.messages.some((m) => `${Number(m.from)}:${m.timestamp}:${(m.text || '').slice(0, 80)}` === fp)) {
    return false;
  }
  g.messages.push(msg);
  if (g.messages.length > 500) g.messages = g.messages.slice(-500);
  g.updatedAt = Date.now();
  persist();
  return true;
}

export function updateGroupMessageAttachment(groupId, msgId, patch) {
  const g = getGroup(groupId);
  if (!g?.messages) return false;
  const m = g.messages.find((x) => x.id === msgId);
  if (!m) return false;
  if (!m.attachment) m.attachment = { kind: 'file' };
  Object.assign(m.attachment, patch);
  if (patch.pending === false) delete m.attachment.progress;
  g.updatedAt = Date.now();
  persist();
  window.dispatchEvent(new CustomEvent('blip-groups-changed', { detail: { groupId } }));
  return true;
}

export function groupDisplayName(group) {
  if (group.name) return group.name;
  const ids = (group.members || []).slice(0, 4).join(',');
  return `MESH [${ids}${group.members?.length > 4 ? '…' : ''}]`;
}
