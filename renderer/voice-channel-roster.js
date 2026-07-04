
const byChannel = new Map();

function key(groupId, channelId) {
  return `${groupId}:${channelId}`;
}

function peerNum(id) {
  return Number(id);
}

export function dispatchVoiceChannelState(groupId, channelId) {
  const snap = getVoiceChannelRoster(groupId, channelId);
  window.dispatchEvent(
    new CustomEvent('blip-voice-channel-state', {
      detail: { groupId, channelId, ...snap },
    })
  );
}

export function getVoiceChannelRoster(groupId, channelId) {
  const o = byChannel.get(key(groupId, channelId));
  if (!o?.active) return { active: false, participants: [], count: 0 };
  const participants = [...o.participants].sort((a, b) => a - b);
  return { active: true, participants, count: participants.length };
}

function setChannel(groupId, channelId, participantIds, active) {
  const k = key(groupId, channelId);
  if (!active || !participantIds?.length) {
    byChannel.delete(k);
  } else {
    byChannel.set(k, {
      active: true,
      participants: new Set(participantIds.map(peerNum).filter(Number.isFinite)),
    });
  }
  dispatchVoiceChannelState(groupId, channelId);
}

export function applyVoiceChRosterFromTcp(msg) {
  const k = key(msg.groupId, msg.channelId);
  const incoming = (msg.participants || []).map(peerNum).filter(Number.isFinite);
  const sender = peerNum(msg.from);
  const leaver = peerNum(msg.leaver);

  if (!msg.active && !incoming.length && !Number.isFinite(leaver)) {
    setChannel(msg.groupId, msg.channelId, [], false);
    return { participants: [], active: false };
  }

  if (!msg.active && Number.isFinite(leaver)) {
    const o = byChannel.get(k);
    if (o?.participants) {
      o.participants.delete(leaver);
      if (!o.participants.size) {
        byChannel.delete(k);
        dispatchVoiceChannelState(msg.groupId, msg.channelId);
        return { participants: [], active: false };
      }
      const list = [...o.participants];
      dispatchVoiceChannelState(msg.groupId, msg.channelId);
      return { participants: list, active: true };
    }
    setChannel(msg.groupId, msg.channelId, [], false);
    return { participants: [], active: false };
  }

  let set = byChannel.get(k)?.participants;
  if (!set) {
    set = new Set();
    byChannel.set(k, { active: true, participants: set });
  }

  if (Number.isFinite(sender)) set.add(sender);
  for (const p of incoming) set.add(p);
  if (Number.isFinite(leaver)) set.delete(leaver);

  const list = [...set].sort((a, b) => a - b);
  setChannel(msg.groupId, msg.channelId, list, list.length > 0);
  return { participants: list, active: list.length > 0 };
}

export function addChannelParticipant(groupId, channelId, id) {
  const n = peerNum(id);
  if (!Number.isFinite(n)) return;
  const k = key(groupId, channelId);
  let set = byChannel.get(k)?.participants;
  if (!set) {
    set = new Set();
    byChannel.set(k, { active: true, participants: set });
  }
  set.add(n);
  dispatchVoiceChannelState(groupId, channelId);
}

export function removeChannelParticipant(groupId, channelId, id) {
  const k = key(groupId, channelId);
  const o = byChannel.get(k);
  if (!o) return [];
  o.participants.delete(peerNum(id));
  const list = [...o.participants];
  if (!list.length) byChannel.delete(k);
  dispatchVoiceChannelState(groupId, channelId);
  return list;
}

export function channelParticipants(groupId, channelId) {
  return [...(byChannel.get(key(groupId, channelId))?.participants || [])];
}

export function clearVoiceChannelRoster(groupId, channelId) {
  byChannel.delete(key(groupId, channelId));
  dispatchVoiceChannelState(groupId, channelId);
}

export function clearAllVoiceForGroup(groupId) {
  for (const k of [...byChannel.keys()]) {
    if (k.startsWith(`${groupId}:`)) byChannel.delete(k);
  }
  window.dispatchEvent(new CustomEvent('blip-voice-channel-cleared', { detail: { groupId } }));
}
