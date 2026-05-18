import {
  setPadState,
  setBoardState,
  setCanvasPixel,
  pushClipEntry,
  mergeClipEntries,
  getClipState,
} from './group-projects-store.js';
import { getGroup, isGroupMember } from './groups.js';

async function safeSend(api, payload) {
  try {
    await api.sendTcpMessage(payload);
  } catch {
    /* offline */
  }
}

export async function broadcastProject(api, config, group, type, payload) {
  if (!group?.id || !isGroupMember(group, config.blipId)) return;
  const myId = Number(config.blipId);
  for (const m of group.members) {
    if (Number(m) === myId) continue;
    await safeSend(api, {
      type: `group-proj-${type}`,
      to: m,
      from: myId,
      groupId: group.id,
      payload,
    });
  }
}

export function handleGroupProjectTcp(msg, config) {
  const type = msg.type;
  if (!type?.startsWith?.('group-proj-')) return false;
  const groupId = msg.groupId;
  const group = getGroup(groupId);
  const myId = Number(config.blipId);
  if (!group || !isGroupMember(group, myId)) return true;
  const from = Number(msg.from);
  if (!Number.isFinite(from) || from === myId) return true;

  const payload = msg.payload || {};

  if (type === 'group-proj-pad') {
    setPadState(groupId, {
      text: String(payload.text || ''),
      updatedAt: Number(payload.updatedAt) || Date.now(),
      from,
    });
    return true;
  }

  if (type === 'group-proj-board') {
    setBoardState(groupId, { cards: payload.cards || [] });
    return true;
  }

  if (type === 'group-proj-canvas') {
    const x = Number(payload.x);
    const y = Number(payload.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      setCanvasPixel(groupId, x, y, String(payload.color || ''));
    }
    return true;
  }

  if (type === 'group-proj-clipboard') {
    if (Array.isArray(payload.entries)) mergeClipEntries(groupId, payload.entries);
    else if (payload.entry) pushClipEntry(groupId, payload.entry);
    return true;
  }

  return false;
}

export async function requestClipboardPull(api, config, group) {
  if (!group?.id) return;
  const myId = Number(config.blipId);
  for (const m of group.members) {
    if (Number(m) === myId) continue;
    await safeSend(api, {
      type: 'group-proj-clipboard-pull',
      to: m,
      from: myId,
      groupId: group.id,
    });
  }
}

export async function respondClipboardPull(api, config, group, requesterId) {
  const st = getClipState(group.id);
  await safeSend(api, {
    type: 'group-proj-clipboard',
    to: requesterId,
    from: config.blipId,
    groupId: group.id,
    payload: { entries: st.entries },
  });
}
