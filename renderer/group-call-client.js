
import {
  getOngoingGroupCall,
  applyGroupCallStateFromTcp,
  noteGroupCallStarted,
  clearGroupCallRoster,
  addVoiceParticipant,
} from './group-call-roster.js';

export { getOngoingGroupCall };

export async function joinGroupCall(groupId, api, opts = {}) {
  if (!window.blip?.openGroupCall) return;
  const config = api?.config ?? (await window.blip?.getConfig?.());
  const myId = Number(config?.blipId);
  if (Number.isFinite(myId)) addVoiceParticipant(groupId, myId);
  await window.blip.openGroupCall({
    groupId,
    skipInvite: !!opts.skipInvite,
  });
}

export async function leaveGroupCall() {
  if (window.blip?.leaveGroupCall) await window.blip.leaveGroupCall();
}

export function isInGroupCall() {
  return !!window.blip?.isGroupCallActiveSync?.();
}

export function getActiveGroupCallId() {
  return window.blip?.getActiveGroupCallIdSync?.() ?? null;
}

export async function handleGroupCallState(msg) {
  applyGroupCallStateFromTcp(msg);
  if (!msg.active) clearGroupCallRoster(msg.groupId);
}

export async function handleGroupCallStart(msg) {
  noteGroupCallStarted(msg.groupId, msg.from);
  if (window.blip?.openGroupCallIncoming) {
    await window.blip.openGroupCallIncoming({
      groupId: msg.groupId,
      from: msg.from,
      members: msg.members,
      host: msg.host,
    });
  }
}

export async function handleGroupCallEnd(msg) {
  if (msg.active === false) {
    clearGroupCallRoster(msg.groupId);
  }
}
