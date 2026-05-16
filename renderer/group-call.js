import { t, applyI18n } from './i18n.js';
import { getGroup, saveGroup, isGroupMember, normalizeMemberIds, groupDisplayName } from './groups.js';
import { sounds } from './audio.js';
import { showAppToast } from './toasts.js';
import { createAvatarElement } from './avatar.js';

const ICE = [];
/** @type {Map<number, RTCPeerConnection>} */
const peers = new Map();
/** @type {Map<number, RTCIceCandidateInit[]>} */
const pendingCandidates = new Map();
/** @type {Map<number, HTMLAudioElement>} */
const remoteAudios = new Map();

/** @type {Map<string, { active: boolean, participants: Set<number> }>} */
const ongoingByGroup = new Map();
const dismissedRing = new Set();

let localStream = null;
let activeGroupId = null;
let apiRef = null;
let configRef = null;
let shell = null;
let muted = false;
let deafened = false;
let callStart = null;
let timerInterval = null;
let heartbeatTimer = null;
let pendingInvite = null;

function peerNum(id) {
  return Number(id);
}

function callConfig(api) {
  return api?.config ?? configRef;
}

function myBlipId(api) {
  return peerNum(callConfig(api)?.blipId);
}

function wireFrom(msg) {
  return Number(msg.from);
}

function signalOrigin(msg) {
  const o = msg.originFrom ?? msg.from;
  return peerNum(o);
}

function normalizeSdp(sdp) {
  if (!sdp) return null;
  if (typeof sdp === 'string') return { type: 'offer', sdp };
  if (typeof sdp.type === 'string' && typeof sdp.sdp === 'string') return sdp;
  return null;
}

async function getMic() {
  return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(m)}:${pad(s % 60)}`;
}

function dispatchCallState(groupId) {
  const snap = getOngoingGroupCall(groupId);
  window.dispatchEvent(
    new CustomEvent('blip-group-call-state', {
      detail: { groupId, ...snap },
    })
  );
}

export function getOngoingGroupCall(groupId) {
  const o = ongoingByGroup.get(groupId);
  if (!o?.active) return { active: false, participants: [], count: 0 };
  const participants = [...o.participants].sort((a, b) => a - b);
  return { active: true, participants, count: participants.length };
}

function setOngoing(groupId, participantIds, active) {
  if (!active || !participantIds?.length) {
    ongoingByGroup.delete(groupId);
  } else {
    ongoingByGroup.set(groupId, {
      active: true,
      participants: new Set(participantIds.map(peerNum).filter(Number.isFinite)),
    });
  }
  dispatchCallState(groupId);
}

function mergeOngoing(groupId, participantIds) {
  if (!participantIds?.length) return;
  let entry = ongoingByGroup.get(groupId);
  if (!entry) {
    entry = { active: true, participants: new Set() };
    ongoingByGroup.set(groupId, entry);
  }
  entry.active = true;
  for (const id of participantIds) entry.participants.add(peerNum(id));
  dispatchCallState(groupId);
}

function localParticipantIds() {
  const myId = peerNum(configRef?.blipId);
  const set = new Set([myId]);
  for (const id of peers.keys()) set.add(id);
  return [...set];
}

async function broadcastCallState(groupId, { end = false } = {}) {
  const group = getGroup(groupId);
  if (!group || !apiRef) return;
  const myId = myBlipId(apiRef);
  const participants = end ? [] : localParticipantIds();
  if (!end) setOngoing(groupId, participants, true);

  for (const m of group.members) {
    const mid = peerNum(m);
    if (mid === myId) continue;
    try {
      await apiRef.sendTcpMessage({
        type: 'group-call-state',
        to: mid,
        groupId,
        host: group.hostId,
        members: group.members,
        active: !end,
        participants,
      });
    } catch (err) {
      console.warn('[group-call] state:', err?.message || err);
    }
  }
}

function startHeartbeat(groupId) {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (activeGroupId === groupId && localStream) void broadcastCallState(groupId);
  }, 12000);
}

function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

async function meshNewParticipants(groupId, participantIds) {
  if (!localStream || activeGroupId !== groupId) return;
  const myId = peerNum(configRef?.blipId);
  for (const pid of participantIds) {
    const mid = peerNum(pid);
    if (mid === myId || peers.has(mid)) continue;
    if (shouldInitiate(myId, mid)) void createPc(mid, groupId, true);
  }
}

function createGroupCallShell(config) {
  const overlay = document.createElement('div');
  overlay.className = 'call-overlay hidden group-call-overlay';

  const inner = document.createElement('div');
  inner.className = 'call-inner glass group-call-inner';

  const statusEl = document.createElement('div');
  statusEl.className = 'call-status';
  statusEl.dataset.i18n = 'group.call_active';
  statusEl.textContent = t('group.call_active');

  const titleEl = document.createElement('div');
  titleEl.className = 'group-call-title-line';

  const stage = document.createElement('div');
  stage.className = 'group-call-stage';

  const avatarGrid = document.createElement('div');
  avatarGrid.className = 'group-call-avatar-grid';

  const waveform = document.createElement('div');
  waveform.className = 'call-waveform group-call-waveform';
  for (let i = 0; i < 8; i++) {
    const bar = document.createElement('div');
    bar.className = 'wave-bar';
    waveform.appendChild(bar);
  }

  stage.appendChild(avatarGrid);
  stage.appendChild(waveform);

  const timerEl = document.createElement('div');
  timerEl.className = 'call-timer';
  timerEl.textContent = '00:00';

  const controls = document.createElement('div');
  controls.className = 'call-controls';

  const muteBtn = document.createElement('button');
  muteBtn.type = 'button';
  muteBtn.className = 'btn btn-accent';
  muteBtn.dataset.i18n = 'call.mute';
  muteBtn.textContent = t('call.mute');

  const deafenBtn = document.createElement('button');
  deafenBtn.type = 'button';
  deafenBtn.className = 'btn btn-accent';
  deafenBtn.dataset.i18n = 'call.deafen';
  deafenBtn.textContent = t('call.deafen');

  const acceptBtn = document.createElement('button');
  acceptBtn.type = 'button';
  acceptBtn.className = 'btn btn-accent hidden';
  acceptBtn.dataset.i18n = 'call.accept';
  acceptBtn.textContent = t('call.accept');

  const rejectBtn = document.createElement('button');
  rejectBtn.type = 'button';
  rejectBtn.className = 'btn btn-danger hidden';
  rejectBtn.dataset.i18n = 'call.reject';
  rejectBtn.textContent = t('call.reject');

  const endBtn = document.createElement('button');
  endBtn.type = 'button';
  endBtn.className = 'btn btn-danger';
  endBtn.dataset.i18n = 'group.leave_call';
  endBtn.textContent = t('group.leave_call');

  controls.appendChild(muteBtn);
  controls.appendChild(deafenBtn);
  controls.appendChild(acceptBtn);
  controls.appendChild(rejectBtn);
  controls.appendChild(endBtn);

  inner.appendChild(statusEl);
  inner.appendChild(titleEl);
  inner.appendChild(stage);
  inner.appendChild(timerEl);
  inner.appendChild(controls);
  overlay.appendChild(inner);
  document.body.appendChild(overlay);

  function setStatus(key) {
    statusEl.dataset.i18n = key;
    statusEl.textContent = t(key);
  }

  function show() {
    overlay.classList.remove('hidden');
    inner.classList.add('group-call-inner--live');
  }

  function hide() {
    overlay.classList.add('hidden');
    inner.classList.remove('group-call-inner--live', 'group-call-inner--incoming');
    acceptBtn.classList.add('hidden');
    rejectBtn.classList.add('hidden');
    endBtn.classList.remove('hidden');
    muteBtn.classList.remove('hidden');
    deafenBtn.classList.remove('hidden');
  }

  function showIncoming() {
    show();
    inner.classList.add('group-call-inner--incoming');
    setStatus('group.call_incoming');
    acceptBtn.classList.remove('hidden');
    rejectBtn.classList.remove('hidden');
    endBtn.classList.add('hidden');
    muteBtn.classList.add('hidden');
    deafenBtn.classList.add('hidden');
  }

  function showActive() {
    show();
    inner.classList.remove('group-call-inner--incoming');
    setStatus('group.call_active');
    acceptBtn.classList.add('hidden');
    rejectBtn.classList.add('hidden');
    endBtn.classList.remove('hidden');
    muteBtn.classList.remove('hidden');
    deafenBtn.classList.remove('hidden');
  }

  function startTimer() {
    callStart = Date.now();
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (callStart) timerEl.textContent = formatDuration(Date.now() - callStart);
    }, 500);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    callStart = null;
    timerEl.textContent = '00:00';
  }

  function refreshAvatars(group) {
    avatarGrid.innerHTML = '';
    if (!group) return;
    const myId = peerNum(config.blipId);
    const ongoing = getOngoingGroupCall(group.id);
    const inVoice = new Set(ongoing.participants);

    group.members.forEach((id) => {
      const n = peerNum(id);
      const cell = document.createElement('div');
      cell.className = 'group-call-member';
      const tile = document.createElement('div');
      const connected = n === myId ? !!localStream : peers.has(n);
      const inCall = inVoice.has(n) || connected;
      tile.className = `group-call-tile glass${inCall ? ' group-call-tile--live' : ''}${connected ? ' group-call-tile--linked' : ''}`;

      const slot = document.createElement('div');
      slot.className = 'call-avatar-slot group-call-avatar-slot';
      slot.appendChild(createAvatarElement(n, 4, { selfBlipId: config.blipId }));
      tile.appendChild(slot);

      if (connected) {
        const ring = document.createElement('div');
        ring.className = 'group-call-tile-ring';
        tile.appendChild(ring);
      }

      const label = document.createElement('span');
      label.className = 'group-call-member-label';
      label.textContent = n === myId ? t('group.you') : `#${n}`;
      if (inCall) {
        const live = document.createElement('span');
        live.className = 'group-call-member-live';
        live.textContent = connected ? ' · LINK' : ' · VOICE';
        label.appendChild(live);
      }

      cell.appendChild(tile);
      cell.appendChild(label);
      avatarGrid.appendChild(cell);
    });
  }

  muteBtn.addEventListener('click', () => {
    muted = !muted;
    localStream?.getAudioTracks().forEach((tr) => {
      tr.enabled = !muted;
    });
    muteBtn.classList.toggle('active', muted);
    muteBtn.dataset.i18n = muted ? 'call.unmute' : 'call.mute';
    muteBtn.textContent = t(muted ? 'call.unmute' : 'call.mute');
  });

  deafenBtn.addEventListener('click', () => {
    deafened = !deafened;
    for (const audio of remoteAudios.values()) audio.muted = deafened;
    deafenBtn.classList.toggle('active', deafened);
    deafenBtn.dataset.i18n = deafened ? 'call.undeafen' : 'call.deafen';
    deafenBtn.textContent = t(deafened ? 'call.undeafen' : 'call.deafen');
  });

  endBtn.addEventListener('click', () => {
    void leaveGroupCall();
  });

  acceptBtn.addEventListener('click', () => {
    if (pendingInvite) {
      const { groupId, api } = pendingInvite;
      pendingInvite = null;
      dismissedRing.delete(groupId);
      void joinGroupCall(groupId, api, { skipInvite: true });
    }
  });

  rejectBtn.addEventListener('click', () => {
    if (pendingInvite?.groupId) dismissedRing.add(pendingInvite.groupId);
    pendingInvite = null;
    hide();
    stopTimer();
  });

  return {
    overlay,
    show,
    hide,
    showIncoming,
    showActive,
    setStatus,
    setTitle: (text) => {
      titleEl.textContent = text;
    },
    refreshAvatars,
    startTimer,
    stopTimer,
    refreshI18n: () => applyI18n(overlay),
  };
}

function ensureShell(config) {
  if (!shell) shell = createGroupCallShell(config);
  configRef = config;
  return shell;
}

async function sendSignal(groupId, targetId, payload) {
  const group = getGroup(groupId);
  if (!group || !apiRef) return;
  const myId = myBlipId(apiRef);
  const target = peerNum(targetId);
  try {
    const res = await apiRef.sendTcpMessage({
      type: 'group-call-signal',
      to: target,
      groupId,
      host: group.hostId,
      target,
      originFrom: myId,
      ...payload,
    });
    if (res?.ok === false) console.warn('[group-call] signal:', res.error);
  } catch (err) {
    console.warn('[group-call] signal:', err?.message || err);
  }
}

async function flushCandidates(remoteId, pc) {
  const pending = pendingCandidates.get(remoteId);
  if (!pending?.length || !pc?.remoteDescription) return;
  for (const c of pending) {
    try {
      await pc.addIceCandidate(c);
    } catch {
      /* ignore */
    }
  }
  pendingCandidates.delete(remoteId);
}

async function createPc(remoteId, groupId, initiator) {
  const rid = peerNum(remoteId);
  if (peers.has(rid)) return peers.get(rid);
  const pc = new RTCPeerConnection({ iceServers: ICE });
  peers.set(rid, pc);
  pendingCandidates.set(rid, []);

  if (localStream) {
    localStream.getTracks().forEach((tr) => pc.addTrack(tr, localStream));
  }

  pc.ontrack = (ev) => {
    let audio = remoteAudios.get(rid);
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.dataset.peer = String(rid);
      remoteAudios.set(rid, audio);
      document.body.appendChild(audio);
    }
    audio.srcObject = ev.streams[0] || new MediaStream([ev.track]);
    audio.muted = deafened;
    const group = getGroup(groupId);
    shell?.refreshAvatars(group);
    void broadcastCallState(groupId);
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') void broadcastCallState(groupId);
  };

  pc.onicecandidate = (ev) => {
    if (!ev.candidate) return;
    void sendSignal(groupId, rid, {
      signalKind: 'candidate',
      candidate: ev.candidate.toJSON(),
    });
  };

  if (initiator) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal(groupId, rid, {
      signalKind: 'offer',
      sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
    });
  }

  return pc;
}

function shouldInitiate(myId, remoteId) {
  return peerNum(myId) < peerNum(remoteId);
}

export function isInGroupCall() {
  return !!activeGroupId;
}

export function getActiveGroupCallId() {
  return activeGroupId;
}

export async function joinGroupCall(groupId, api, opts = {}) {
  const config = callConfig(api);
  if (!config?.blipId) {
    console.error('[group-call] missing config.blipId');
    return;
  }
  ensureShell(config);

  if (activeGroupId === groupId && localStream) {
    apiRef = api;
    shell.showActive();
    shell.refreshAvatars(getGroup(groupId));
    return;
  }
  if (activeGroupId) await leaveGroupCall();

  const group = getGroup(groupId);
  if (!group) return;

  apiRef = api;
  configRef = config;
  activeGroupId = groupId;
  pendingInvite = null;
  dismissedRing.delete(groupId);

  try {
    localStream = await getMic();
  } catch (err) {
    console.error('[group-call] mic:', err);
    showAppToast({
      title: t('group.call_mic_failed'),
      variant: 'danger',
      durationMs: 5000,
    });
    activeGroupId = null;
    shell.hide();
    return;
  }

  shell.setTitle(groupDisplayName(group));
  shell.showActive();
  shell.startTimer();
  shell.refreshAvatars(group);
  sounds.outgoingCall();

  const myId = peerNum(config.blipId);
  const ongoing = getOngoingGroupCall(groupId);

  for (const pid of ongoing.participants) {
    if (peerNum(pid) === myId) continue;
    if (shouldInitiate(myId, pid)) void createPc(pid, groupId, true);
  }

  for (const m of group.members) {
    const mid = peerNum(m);
    if (mid === myId) continue;
    if (shouldInitiate(myId, mid)) void createPc(mid, groupId, true);
  }

  await broadcastCallState(groupId);
  startHeartbeat(groupId);

  if (!opts.skipInvite) {
    for (const m of group.members) {
      const mid = peerNum(m);
      if (mid === myId) continue;
      try {
        await api.sendTcpMessage({
          type: 'group-call-start',
          to: mid,
          groupId,
          host: group.hostId,
          members: group.members,
        });
      } catch (err) {
        console.warn('[group-call] invite', mid, err?.message || err);
      }
    }
  }
}

export async function leaveGroupCall() {
  const gid = activeGroupId;
  const api = apiRef;
  const hadStream = !!localStream;
  const myId = myBlipId(api);

  stopHeartbeat();

  try {
    if (gid && api && hadStream && Number.isFinite(myId)) {
      const group = getGroup(gid);
      const remaining = [...peers.keys()];
      if (group) {
        for (const m of group.members) {
          const mid = peerNum(m);
          if (mid === myId) continue;
          void api.sendTcpMessage({
            type: 'group-call-state',
            to: mid,
            groupId: gid,
            host: group.hostId,
            members: group.members,
            active: remaining.length > 0,
            participants: remaining,
          });
        }
        if (remaining.length === 0) {
          setOngoing(gid, [], false);
          for (const m of group.members) {
            const mid = peerNum(m);
            if (mid === myId) continue;
            void api.sendTcpMessage({
              type: 'group-call-end',
              to: mid,
              groupId: gid,
              host: group.hostId,
              active: false,
            });
          }
        } else {
          mergeOngoing(gid, remaining);
        }
      }
    }
  } catch (err) {
    console.warn('[group-call] leave:', err?.message || err);
  } finally {
  for (const pc of peers.values()) pc.close();
  peers.clear();
  pendingCandidates.clear();
  remoteAudios.forEach((a) => a.remove());
  remoteAudios.clear();
  localStream?.getTracks().forEach((tr) => tr.stop());
  localStream = null;
  activeGroupId = null;
  pendingInvite = null;
  muted = false;
  deafened = false;
  shell?.stopTimer();
  shell?.hide();
  if (hadStream) sounds.callEnd();
  }
}

export async function handleGroupCallSignal(msg, api) {
  const groupId = msg.groupId;
  const group = getGroup(groupId);
  if (!group) return;
  apiRef = api;
  const config = callConfig(api);
  ensureShell(config);

  const target = peerNum(msg.target);
  const origin = signalOrigin(msg);
  const myId = myBlipId(api);

  if (target !== myId && origin !== myId) return;

  const remoteId = origin === myId ? target : origin;
  if (!isGroupMember(group, remoteId) || !isGroupMember(group, myId)) return;

  if (msg.signalKind === 'offer') {
    if (!localStream) {
      activeGroupId = groupId;
      dismissedRing.delete(groupId);
      try {
        localStream = await getMic();
      } catch (err) {
        console.error('[group-call] mic on offer:', err);
        showAppToast({
          title: t('group.call_mic_failed'),
          variant: 'danger',
          durationMs: 5000,
        });
        return;
      }
      shell.setTitle(groupDisplayName(group));
      shell.showActive();
      shell.startTimer();
      startHeartbeat(groupId);
    }
    const pc = await createPc(remoteId, groupId, false);
    const offer = normalizeSdp(msg.sdp);
    if (!offer) return;
    await pc.setRemoteDescription(offer);
    await flushCandidates(remoteId, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await sendSignal(groupId, remoteId, {
      signalKind: 'answer',
      sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
    });
    shell.refreshAvatars(group);
    await meshNewParticipants(groupId, getOngoingGroupCall(groupId).participants);
    await broadcastCallState(groupId);
    return;
  }

  if (msg.signalKind === 'answer') {
    const pc = peers.get(remoteId);
    const answer = normalizeSdp(msg.sdp);
    if (pc && answer) {
      await pc.setRemoteDescription(answer);
      await flushCandidates(remoteId, pc);
    }
    shell?.refreshAvatars(group);
    return;
  }

  if (msg.signalKind === 'candidate') {
    const pc = peers.get(remoteId);
    if (!pc || !msg.candidate) return;
    if (!pc.remoteDescription) {
      const q = pendingCandidates.get(remoteId) || [];
      q.push(msg.candidate);
      pendingCandidates.set(remoteId, q);
      return;
    }
    try {
      await pc.addIceCandidate(msg.candidate);
    } catch {
      /* ignore */
    }
  }
}

export async function handleGroupCallState(msg, api) {
  let group = getGroup(msg.groupId);
  if (!group && msg.members?.length) {
    group = {
      id: msg.groupId,
      name: t('group.unnamed'),
      hostId: Number(msg.host),
      members: normalizeMemberIds(msg.members),
      messages: [],
    };
    saveGroup(group);
  }
  const myId = myBlipId(api);
  if (!group || !isGroupMember(group, myId)) return;

  const participants = (msg.participants || []).map(peerNum).filter(Number.isFinite);

  if (!msg.active) {
    setOngoing(msg.groupId, [], false);
    if (activeGroupId === msg.groupId && !localStream) {
      shell?.hide();
      pendingInvite = null;
    }
    return;
  }

  mergeOngoing(msg.groupId, participants);

  if (activeGroupId === msg.groupId && localStream) {
    await meshNewParticipants(msg.groupId, participants);
    shell?.refreshAvatars(group);
    return;
  }

}

export async function handleGroupCallStart(msg, api) {
  let group = getGroup(msg.groupId);
  if (!group && Array.isArray(msg.members) && msg.members.length) {
    group = {
      id: msg.groupId,
      name: t('group.unnamed'),
      hostId: Number(msg.host),
      members: normalizeMemberIds(msg.members),
      messages: [],
    };
    saveGroup(group);
  }
  const myId = myBlipId(api);
  if (!group || !isGroupMember(group, myId)) return;

  const starter = wireFrom(msg);
  mergeOngoing(msg.groupId, [starter]);

  if (activeGroupId === msg.groupId && localStream) {
    shell?.refreshAvatars(group);
    return;
  }

  if (dismissedRing.has(msg.groupId)) return;

  ensureShell(callConfig(api));
  shell.setTitle(groupDisplayName(group));
  shell.refreshAvatars(group);
  pendingInvite = { groupId: msg.groupId, api: { ...api, config: callConfig(api) } };
  shell.showIncoming();
  sounds.groupCallInvite();

  showAppToast({
    title: t('group.call_invite'),
    body: t('group.call_invite_body').replace('{id}', String(starter)),
    actions: [
      {
        label: t('group.join_call'),
        primary: true,
        onClick: () => void joinGroupCall(msg.groupId, api, { skipInvite: true }),
      },
    ],
    durationMs: 15000,
  });
}

export async function handleGroupCallEnd(msg) {
  const groupId = msg.groupId;

  if (msg.active === false) {
    setOngoing(groupId, [], false);
    if (activeGroupId === groupId && !localStream) {
      shell?.hide();
      pendingInvite = null;
    }
    return;
  }

  if (activeGroupId !== groupId || !localStream) return;

  const remoteId = wireFrom(msg);
  const pc = peers.get(remoteId);
  if (pc) {
    pc.close();
    peers.delete(remoteId);
  }
  remoteAudios.get(remoteId)?.remove();
  remoteAudios.delete(remoteId);
  shell?.refreshAvatars(getGroup(groupId));
  void broadcastCallState(groupId);
}
