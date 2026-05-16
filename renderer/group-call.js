import { t } from './i18n.js';
import { getGroup, amHost } from './groups.js';
import { sounds } from './audio.js';

const ICE = [];
/** @type {Map<number, RTCPeerConnection>} */
const peers = new Map();
let localStream = null;
let activeGroupId = null;
let panelEl = null;
let apiRef = null;

function normalizeSdp(sdp) {
  if (!sdp) return null;
  if (typeof sdp === 'string') return { type: 'offer', sdp };
  if (typeof sdp.type === 'string' && typeof sdp.sdp === 'string') return sdp;
  return null;
}

async function getMic() {
  return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
}

function ensurePanel() {
  if (panelEl?.isConnected) return panelEl;
  panelEl = document.createElement('div');
  panelEl.className = 'group-call-panel glass hidden';
  panelEl.innerHTML = `
    <div class="group-call-head">
      <span class="group-call-title" data-i18n="group.call_active">${t('group.call_active')}</span>
      <button type="button" class="btn btn-danger group-call-leave">${t('group.leave_call')}</button>
    </div>
    <div class="group-call-roster"></div>
  `;
  panelEl.querySelector('.group-call-leave')?.addEventListener('click', () => {
    void leaveGroupCall();
  });
  document.body.appendChild(panelEl);
  return panelEl;
}

function refreshRoster(group) {
  const roster = panelEl?.querySelector('.group-call-roster');
  if (!roster || !group) return;
  roster.innerHTML = '';
  group.members.forEach((id) => {
    const row = document.createElement('div');
    row.className = 'group-call-peer';
    const connected = id === apiRef?.config?.blipId || peers.has(id);
    row.textContent = `#${id}${connected ? ' · ON' : ''}`;
    roster.appendChild(row);
  });
}

async function sendSignal(groupId, targetId, payload) {
  const group = getGroup(groupId);
  if (!group || !apiRef) return;
  const myId = apiRef.config?.blipId;
  const hostId = group.hostId;
  const to = amHost(group, myId) ? targetId : hostId;
  await apiRef.sendTcpMessage({
    type: 'group-call-signal',
    to,
    groupId,
    host: hostId,
    target: targetId,
    from: myId,
    ...payload,
  });
}

async function createPc(remoteId, groupId, initiator) {
  if (peers.has(remoteId)) return peers.get(remoteId);
  const pc = new RTCPeerConnection({ iceServers: ICE });
  peers.set(remoteId, pc);

  localStream?.getTracks().forEach((tr) => pc.addTrack(tr, localStream));

  pc.ontrack = (ev) => {
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.srcObject = ev.streams[0] || new MediaStream([ev.track]);
    audio.dataset.peer = String(remoteId);
    panelEl?.appendChild(audio);
  };

  pc.onicecandidate = (ev) => {
    if (!ev.candidate) return;
    void sendSignal(groupId, remoteId, {
      signalKind: 'candidate',
      candidate: ev.candidate.toJSON(),
    });
  };

  if (initiator) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal(groupId, remoteId, {
      signalKind: 'offer',
      sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
    });
  }

  return pc;
}

export function isInGroupCall() {
  return !!activeGroupId;
}

export async function joinGroupCall(groupId, api) {
  if (activeGroupId) await leaveGroupCall();
  const group = getGroup(groupId);
  if (!group) return;
  apiRef = api;
  activeGroupId = groupId;
  localStream = await getMic();
  ensurePanel();
  panelEl.classList.remove('hidden');
  refreshRoster(group);

  const myId = api.config.blipId;
  const hostId = group.hostId;

  for (const m of group.members) {
    if (m === myId) continue;
    if (myId < m) void createPc(m, groupId, true);
  }

  const notify = amHost(group, myId)
    ? group.members.filter((m) => m !== myId)
    : [hostId];
  for (const m of notify) {
    await api.sendTcpMessage({
      type: 'group-call-start',
      to: m,
      groupId,
      host: hostId,
      from: myId,
      members: group.members,
    });
  }
}

export async function leaveGroupCall() {
  const gid = activeGroupId;
  const api = apiRef;
  if (gid && api) {
    const group = getGroup(gid);
    if (group) {
      for (const m of group.members) {
        if (m === api.config.blipId) continue;
        void api.sendTcpMessage({
          type: 'group-call-end',
          to: m,
          groupId: gid,
          host: group.hostId,
        });
      }
    }
  }
  for (const pc of peers.values()) pc.close();
  peers.clear();
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  activeGroupId = null;
  panelEl?.querySelectorAll('audio').forEach((a) => a.remove());
  panelEl?.classList.add('hidden');
}

export async function handleGroupCallSignal(msg, api) {
  const groupId = msg.groupId;
  const group = getGroup(groupId);
  if (!group) return;
  apiRef = api;

  const target = Number(msg.target);
  const from = Number(msg.from);
  const myId = api.config.blipId;

  if (target !== myId && from !== myId) return;

  const remoteId = from === myId ? target : from;
  if (!group.members.includes(remoteId) || !group.members.includes(myId)) return;

  if (msg.signalKind === 'offer') {
    if (!localStream) {
      activeGroupId = groupId;
      localStream = await getMic();
      ensurePanel();
      panelEl.classList.remove('hidden');
    }
    const pc = await createPc(remoteId, groupId, false);
    const offer = normalizeSdp(msg.sdp);
    if (!offer) return;
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    const hostId = group.hostId;
    await sendSignal(groupId, remoteId, {
      signalKind: 'answer',
      sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
    });
    refreshRoster(group);
    return;
  }

  if (msg.signalKind === 'answer') {
    const pc = peers.get(remoteId);
    const answer = normalizeSdp(msg.sdp);
    if (pc && answer) await pc.setRemoteDescription(answer);
    return;
  }

  if (msg.signalKind === 'candidate') {
    const pc = peers.get(remoteId);
    if (pc && msg.candidate) {
      try {
        await pc.addIceCandidate(msg.candidate);
      } catch {
        /* ignore */
      }
    }
  }
}

export async function handleGroupCallStart(msg, api) {
  const group = getGroup(msg.groupId);
  if (!group) return;
  showAppToastInvite(msg, api);
}

function showAppToastInvite(msg, api) {
  sounds.groupCallInvite();
  if (typeof window.__blipShowToast !== 'function') return;
  window.__blipShowToast({
    title: t('group.call_invite'),
    body: t('group.call_invite_body').replace('{id}', String(msg.from)),
    actions: [
      {
        label: t('group.join_call'),
        primary: true,
        onClick: () => void joinGroupCall(msg.groupId, api),
      },
    ],
    durationMs: 12000,
  });
}

export async function handleGroupCallEnd(msg) {
  if (msg.groupId !== activeGroupId) return;
  const remoteId = Number(msg.from);
  const pc = peers.get(remoteId);
  if (pc) {
    pc.close();
    peers.delete(remoteId);
  }
  panelEl?.querySelector(`audio[data-peer="${remoteId}"]`)?.remove();
}

/** Host relays WebRTC signals between members. */
export async function relayGroupCallSignal(msg, api) {
  const myId = api.config.blipId;
  const group = getGroup(msg.groupId);
  if (!group || !amHost(group, myId)) return;
  const target = Number(msg.target);
  if (!target || target === myId) return;
  await api.sendTcpMessage({
    type: 'group-call-signal',
    to: target,
    groupId: msg.groupId,
    host: group.hostId,
    target,
    from: Number(msg.from),
    signalKind: msg.signalKind,
    sdp: msg.sdp,
    candidate: msg.candidate,
  });
}
