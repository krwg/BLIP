
import { createMessageId } from './message-id.js';

const STORAGE_KEY = 'blip_group_invites_v1';

const pending = new Map();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    for (const inv of arr) {
      if (inv?.groupId) pending.set(String(inv.groupId), inv);
    }
  } catch (e) {
    console.warn('[BLIP invites] load', e);
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...pending.values()]));
  } catch (e) {
    console.warn('[BLIP invites] persist', e);
  }
}

function dispatchChanged() {
  window.dispatchEvent(new CustomEvent('blip-group-invites-changed'));
}

load();

export function resetGroupInvitesStore() {
  pending.clear();
}

export function getPendingGroupInvites() {
  return [...pending.values()].sort((a, b) => (b.receivedAt || 0) - (a.receivedAt || 0));
}

export function hasPendingGroupInvite(groupId) {
  return pending.has(String(groupId));
}

export function addPendingGroupInvite(msg) {
  const groupId = String(msg.groupId);
  if (!groupId) return null;
  const inv = {
    id: createMessageId(),
    groupId,
    name: msg.name || '',
    hostId: Number(msg.host ?? msg.from),
    from: Number(msg.from),
    members: Array.isArray(msg.members) ? msg.members.map(Number).filter(Number.isFinite) : [],
    receivedAt: Date.now(),
  };
  pending.set(groupId, inv);
  persist();
  dispatchChanged();
  return inv;
}

export function removePendingGroupInvite(groupId) {
  const k = String(groupId);
  if (!pending.delete(k)) return false;
  persist();
  dispatchChanged();
  return true;
}
