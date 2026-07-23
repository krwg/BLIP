
import { t } from './i18n.js';
import { sounds } from './audio.js';
import { showAppToast } from './toasts.js';
import { getGroup, amHost } from './groups.js';
import {
  applyVoiceChRosterFromTcp,
  addChannelParticipant,
  removeChannelParticipant,
  channelParticipants,
  clearVoiceChannelRoster,
} from './voice-channel-roster.js';
import {
  applyScreenTrackConstraints,
  tuneVideoSender,
  trackLooksLikeScreen,
} from './call-media.js';
import { openScreenPickerDialog } from './screen-picker-dialog.js';
import { captureDisplayStream } from './display-capture.js';
import { getVoiceMediaStream } from './audio-capture.js';
import { rtcConfiguration } from '../shared/ice-servers.js';

let clientConnectInFlight = false;

const hostPeers = new Map();

const hostPendingIce = new Map();

let clientPc = null;
let clientPendingIce = [];

const meshPeers = new Map();

const meshPendingIce = new Map();

let localStream = null;
let screenStream = null;
let sharingScreen = false;
let muted = false;
let deafened = false;

let activeGroupId = null;
let activeChannelId = null;
let apiRef = null;
let configRef = null;

const peerMediaState = new Map();

let audioCtx = null;

const mixerTracks = new Map();

let silentAudioCtx = null;
let silentOscillator = null;
let silentTrack = null;

const peerAudioEls = new Map();

let heartbeatTimer = null;
let stageRefresh = null;

const pendingHostOffers = new Map();

const hostOfferInFlight = new Set();

const peerVideoStreams = new Map();

let localScreenPreview = null;

function peerNum(id) {
  return Number(id);
}

function myId() {
  return peerNum(configRef?.blipId);
}

function isHost(group) {
  return amHost(group, myId());
}

function normalizeSdp(sdp) {
  if (!sdp) return null;
  if (typeof sdp === 'string') return { type: 'offer', sdp };
  let type = sdp.type;
  let body = sdp.sdp;
  if (body && typeof body === 'object' && typeof body.sdp === 'string') {
    type = body.type ?? type;
    body = body.sdp;
  }
  if (typeof type === 'string' && typeof body === 'string' && body.length > 0) {
    return { type, sdp: body };
  }
  return null;
}

function myMediaState() {
  return { muted, deafened, screenSharing: sharingScreen };
}

function isOwnAudioTrack(track) {
  if (!track || !localStream) return false;
  const local = localStream.getAudioTracks()[0];
  return !!(local && track.id === local.id);
}

function isPcLoopbackTrack(track, pc) {
  if (!track || !pc) return false;
  if (isOwnAudioTrack(track)) return true;
  const sent = pc.getSenders?.().find((s) => s.track?.kind === 'audio')?.track;
  return !!(sent && track.id === sent.id);
}

function ensureSilentTrack() {
  if (silentTrack?.readyState === 'live') return silentTrack;
  if (silentAudioCtx?.state === 'closed') {
    silentAudioCtx = null;
    silentOscillator = null;
    silentTrack = null;
  }
  silentAudioCtx = new AudioContext();
  silentOscillator = silentAudioCtx.createOscillator();
  const gain = silentAudioCtx.createGain();
  gain.gain.value = 0;
  const dest = silentAudioCtx.createMediaStreamDestination();
  silentOscillator.connect(gain);
  gain.connect(dest);
  silentOscillator.start();
  silentTrack = dest.stream.getAudioTracks()[0] || null;
  return silentTrack;
}

function stopSilentTrack() {
  try {
    silentOscillator?.stop();
  } catch {

  }
  silentOscillator = null;
  silentTrack = null;
  if (silentAudioCtx) {
    void silentAudioCtx.close().catch(() => {});
    silentAudioCtx = null;
  }
}

function buildStates(participants) {
  const states = {};
  const id = myId();
  for (const pid of participants) {
    states[String(pid)] =
      pid === id ? myMediaState() : peerMediaState.get(pid) || { muted: false, deafened: false, screenSharing: false };
  }
  if (Number.isFinite(id)) states[String(id)] = myMediaState();
  return states;
}

async function sendTcp(payload) {
  if (!apiRef) return;
  try {
    await apiRef.sendTcpMessage(payload);
  } catch (err) {
    console.warn('[voice-ch]', err?.message || err);
  }
}

async function sendSignal(groupId, to, payload) {
  const group = getGroup(groupId);
  if (!group) return;
  await sendTcp({
    type: 'voice-ch-signal',
    to: peerNum(to),
    groupId,
    channelId: activeChannelId,
    host: group.hostId,
    originFrom: myId(),
    target: peerNum(to),
    ...payload,
  });
}

async function broadcastRoster(groupId, channelId, { end = false, leaver = null } = {}) {
  const group = getGroup(groupId);
  if (!group || !apiRef) return;
  const id = myId();
  let participants = [];
  if (end) {
    clearVoiceChannelRoster(groupId, channelId);
  } else {
    if (localStream && Number.isFinite(id)) addChannelParticipant(groupId, channelId, id);
    participants = channelParticipants(groupId, channelId);
  }
  const states = end ? {} : buildStates(participants);
  for (const m of group.members) {
    const mid = peerNum(m);
    if (mid === id) continue;
    await sendTcp({
      type: 'voice-ch-roster',
      to: mid,
      groupId,
      channelId,
      host: group.hostId,
      active: !end,
      participants,
      states,
      leaver: leaver != null ? peerNum(leaver) : undefined,
    });
  }
  if (!end) stageRefresh?.();
}

function micGainValue() {
  return (Number(configRef?.micInputGain) || 100) / 100;
}

async function resumeVoiceAudioContexts() {
  for (const el of peerAudioEls.values()) {
    if (el.srcObject) void el.play().catch(() => {});
  }
}

function ensureMixer() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
}

function registerTrackInMixer(peerId, track) {
  if (!track || track.readyState === 'ended') return;
  ensureMixer();
  mixerTracks.set(peerNum(peerId), track);
}

function removeFromMixer(peerId) {
  mixerTracks.delete(peerNum(peerId));
}

function registerHostMicInMixer() {
  const track = localStream?.getAudioTracks()[0];
  if (!track) return;
  registerTrackInMixer(myId(), track);
}

function buildMixMinusTrack(excludePeerId) {
  ensureMixer();
  const ex = peerNum(excludePeerId);
  const dest = audioCtx.createMediaStreamDestination();
  const bus = audioCtx.createGain();
  bus.connect(dest);
  let any = false;
  const self = myId();
  const gainMul = micGainValue();
  for (const [pid, track] of mixerTracks) {
    if (peerNum(pid) === ex || track.readyState === 'ended') continue;
    const src = audioCtx.createMediaStreamSource(new MediaStream([track]));
    if (peerNum(pid) === self && gainMul !== 1) {
      const g = audioCtx.createGain();
      g.gain.value = gainMul;
      src.connect(g);
      g.connect(bus);
    } else {
      src.connect(bus);
    }
    any = true;
  }
  return any ? dest.stream.getAudioTracks()[0] : null;
}

function mixerSourceCount(excludePeerId) {
  let n = 0;
  for (const [pid, track] of mixerTracks) {
    if (peerNum(pid) === peerNum(excludePeerId) || track.readyState === 'ended') continue;
    n++;
  }
  return n;
}

function getOutboundAudioTrack(forPeerId) {
  const mic = localStream?.getAudioTracks()?.[0];
  if (mixerSourceCount(forPeerId) <= 1) {
    if (mic?.readyState === 'live') return mic;
    return ensureSilentTrack();
  }
  return buildMixMinusTrack(forPeerId) || ensureSilentTrack();
}

async function setHostSendAudio(pc, track) {
  if (!pc) return;
  const out = track?.readyState === 'live' ? track : ensureSilentTrack();
  if (!out) return;
  let sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
  if (sender) {
    await sender.replaceTrack(out);
    return;
  }
  try {
    pc.addTrack(out, new MediaStream([out]));
  } catch {
    const tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
    await tr.sender.replaceTrack(out);
  }
}

async function pushMixedAudioToPeer(peerId) {
  const pc = hostPeers.get(peerNum(peerId));
  if (!pc || pc.signalingState === 'closed') return;
  await setHostSendAudio(pc, getOutboundAudioTrack(peerId));
}

async function pushMixedAudioToAll() {
  for (const pid of hostPeers.keys()) {
    await pushMixedAudioToPeer(pid);
  }
}

function disconnectHostPeer(peerId) {
  const n = peerNum(peerId);
  const pc = hostPeers.get(n);
  if (pc) {
    pc.close();
    hostPeers.delete(n);
  }
  hostPendingIce.delete(n);
  stopRemotePeerAudio(n);
  peerMediaState.delete(n);
}

function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function startHeartbeat(groupId, channelId) {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (activeGroupId === groupId && activeChannelId === channelId && localStream) {
      void broadcastRoster(groupId, channelId);
    }
  }, 4000);
}

function wireRemoteTrackPlayback(track, audioEl) {
  const play = () => void audioEl.play().catch(() => {});
  if (track && !track.muted) play();
  if (track) {
    track.onunmute = play;
    track.onended = () => {
      audioEl.srcObject = null;
    };
  }
}

function playRemoteStream(peerId, stream, pc) {
  const n = peerNum(peerId);
  const tracks = (stream?.getAudioTracks?.() || []).filter(
    (t) => t.kind === 'audio' && !isPcLoopbackTrack(t, pc),
  );
  if (!tracks.length) return;
  let el = peerAudioEls.get(n);
  if (!el) {
    el = document.createElement('audio');
    el.autoplay = true;
    el.playsInline = true;
    el.dataset.voicePeer = String(n);
    document.body.appendChild(el);
    peerAudioEls.set(n, el);
  }
  el.srcObject = new MediaStream(tracks);
  el.muted = deafened;
  wireRemoteTrackPlayback(tracks[0], el);
}

function stopRemotePeerAudio(peerId) {
  const el = peerAudioEls.get(peerNum(peerId));
  if (el) {
    el.srcObject = null;
    el.remove();
    peerAudioEls.delete(peerNum(peerId));
  }
}

function clearAllRemotePeerAudio() {
  for (const pid of [...peerAudioEls.keys()]) stopRemotePeerAudio(pid);
  const legacy = document.getElementById('voice-ch-remote-audio');
  if (legacy) {
    legacy.srcObject = null;
    legacy.remove();
  }
}

function clientPcNeedsRebuild() {
  if (!clientPc) return true;
  const st = clientPc.connectionState;
  return st === 'failed' || st === 'closed' || st === 'disconnected';
}

async function getMic() {
  return getVoiceMediaStream(configRef || {});
}

async function flushHostIce(peerId, pc) {
  const pending = hostPendingIce.get(peerId);
  if (!pending?.length || !pc?.remoteDescription) return;
  for (const c of pending) {
    try {
      await pc.addIceCandidate(c);
    } catch {

    }
  }
  hostPendingIce.delete(peerId);
}

async function flushClientIce(pc) {
  if (!clientPendingIce.length || !pc?.remoteDescription) return;
  for (const c of clientPendingIce) {
    try {
      await pc.addIceCandidate(c);
    } catch {

    }
  }
  clientPendingIce = [];
}

async function createHostPeer(remoteId, groupId) {
  const rid = peerNum(remoteId);
  const pc = new RTCPeerConnection(rtcConfiguration(configRef));
  hostPeers.set(rid, pc);
  hostPendingIce.set(rid, []);

  pc.ontrack = (ev) => {
    const track = ev.track;
    if (track.kind === 'audio') {
      if (isPcLoopbackTrack(track, pc)) return;
      const stream = ev.streams[0] || new MediaStream([track]);
      playRemoteStream(rid, stream, pc);
      sounds.stopOutgoingRing();
      sounds.callConnected();
      track.onended = () => {
        stopRemotePeerAudio(rid);
        stageRefresh?.();
      };
      stageRefresh?.();
      return;
    }
    if (track.kind === 'video') {
      const vs = ev.streams[0] || new MediaStream([track]);
      peerVideoStreams.set(rid, vs);
      peerMediaState.set(rid, {
        ...(peerMediaState.get(rid) || {}),
        screenSharing: true,
      });
      stageRefresh?.();
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') {
      sounds.stopOutgoingRing();
      sounds.callConnected();
      void broadcastRoster(groupId, activeChannelId);
    }
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      disconnectHostPeer(rid);
      stageRefresh?.();
    }
  };

  pc.onicecandidate = (ev) => {
    if (!ev.candidate) return;
    void sendSignal(groupId, rid, {
      signalKind: 'candidate',
      candidate: ev.candidate.toJSON(),
    });
  };

  return pc;
}

async function sendRenegotiateOffer(pc, groupId, remoteId) {
  if (!pc || pc.signalingState !== 'stable' || pc.connectionState === 'closed') return;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await sendSignal(groupId, remoteId, {
    signalKind: 'ren-offer',
    sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
  });
}

async function setVideoOnPc(pc, track, stream) {
  if (!pc) return;
  const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
  if (track) {
    if (sender) await sender.replaceTrack(track);
    else pc.addTrack(track, stream || new MediaStream([track]));
  } else if (sender) {
    await sender.replaceTrack(null);
  }
}

async function syncScreenVideoOut() {
  if (!sharingScreen || !screenStream) return;
  const track = screenStream.getVideoTracks()[0];
  if (!track) return;
  const group = getGroup(activeGroupId);
  if (!group) return;
  const cfg = configRef || {};
  if (isHost(group)) {
    for (const [rid, pc] of hostPeers) {
      await setVideoOnPc(pc, track, screenStream);
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) void tuneVideoSender(sender, { screenShare: true, config: cfg });
      if (pc.signalingState === 'stable') await sendRenegotiateOffer(pc, activeGroupId, rid);
    }
  } else if (clientPc) {
    await setVideoOnPc(clientPc, track, screenStream);
    const sender = clientPc.getSenders().find((s) => s.track?.kind === 'video');
    if (sender) void tuneVideoSender(sender, { screenShare: true, config: cfg });
    if (clientPc.signalingState === 'stable') {
      await sendRenegotiateOffer(clientPc, activeGroupId, peerNum(group.hostId));
    }
  }
}

async function handleHostOffer(remoteId, groupId, offer) {
  const rid = peerNum(remoteId);
  const remoteOffer = normalizeSdp(offer);
  if (!remoteOffer || remoteOffer.type !== 'offer') return;

  if (!localStream) {
    pendingHostOffers.set(rid, remoteOffer);
    return;
  }

  if (hostOfferInFlight.has(rid)) {
    pendingHostOffers.set(rid, remoteOffer);
    return;
  }
  hostOfferInFlight.add(rid);

  try {
    disconnectHostPeer(rid);
    const pc = await createHostPeer(rid, groupId);
    localStream.getTracks().forEach((tr) => pc.addTrack(tr, localStream));
    await pc.setRemoteDescription(remoteOffer);
    await flushHostIce(rid, pc);
    if (pc.signalingState !== 'have-remote-offer') {
      throw new Error(`host offer: expected have-remote-offer, got ${pc.signalingState}`);
    }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await sendSignal(groupId, rid, {
      signalKind: 'answer',
      sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
    });
  } catch (err) {
    console.warn('[voice-ch] host offer:', err?.message || err);
    disconnectHostPeer(rid);
  } finally {
    hostOfferInFlight.delete(rid);
    const queued = pendingHostOffers.get(rid);
    if (queued) {
      pendingHostOffers.delete(rid);
      void handleHostOffer(rid, groupId, queued);
    }
  }
}

function disconnectMeshPeer(peerId) {
  const n = peerNum(peerId);
  const pc = meshPeers.get(n);
  if (pc) {
    pc.close();
    meshPeers.delete(n);
  }
  meshPendingIce.delete(n);
  stopRemotePeerAudio(n);
}

async function flushMeshIce(peerId, pc) {
  const pending = meshPendingIce.get(peerId);
  if (!pending?.length || !pc?.remoteDescription) return;
  for (const c of pending) {
    try {
      await pc.addIceCandidate(c);
    } catch {

    }
  }
  meshPendingIce.delete(peerId);
}

function wireMeshPc(pc, remoteId, groupId) {
  const rid = peerNum(remoteId);
  pc.ontrack = (ev) => {
    if (ev.track.kind === 'audio') {
      if (isPcLoopbackTrack(ev.track, pc)) return;
      playRemoteStream(rid, ev.streams[0] || new MediaStream([ev.track]), pc);
      sounds.stopOutgoingRing();
      sounds.callConnected();
      stageRefresh?.();
    }
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      disconnectMeshPeer(rid);
      stageRefresh?.();
    }
  };
  pc.onicecandidate = (ev) => {
    if (!ev.candidate) return;
    void sendSignal(groupId, rid, {
      signalKind: 'candidate',
      candidate: ev.candidate.toJSON(),
    });
  };
}

async function createMeshOffer(remoteId, groupId) {
  const rid = peerNum(remoteId);
  if (meshPeers.has(rid) || !localStream) return;
  const pc = new RTCPeerConnection(rtcConfiguration(configRef));
  meshPeers.set(rid, pc);
  meshPendingIce.set(rid, []);
  wireMeshPc(pc, rid, groupId);
  localStream.getTracks().forEach((tr) => pc.addTrack(tr, localStream));
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await sendSignal(groupId, rid, {
    signalKind: 'offer',
    sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
  });
}

async function handleMeshOffer(remoteId, groupId, offer) {
  const rid = peerNum(remoteId);
  const remoteOffer = normalizeSdp(offer);
  if (!remoteOffer || remoteOffer.type !== 'offer' || !localStream) return;

  try {
    disconnectMeshPeer(rid);
    const pc = new RTCPeerConnection(rtcConfiguration(configRef));
    meshPeers.set(rid, pc);
    meshPendingIce.set(rid, []);
    wireMeshPc(pc, rid, groupId);
    localStream.getTracks().forEach((tr) => pc.addTrack(tr, localStream));
    await pc.setRemoteDescription(remoteOffer);
    await flushMeshIce(rid, pc);
    if (pc.signalingState !== 'have-remote-offer') {
      throw new Error(`mesh offer: expected have-remote-offer, got ${pc.signalingState}`);
    }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await sendSignal(groupId, rid, {
      signalKind: 'answer',
      sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
    });
  } catch (err) {
    console.warn('[voice-ch] mesh offer:', err?.message || err);
    disconnectMeshPeer(rid);
  }
}

async function ensureMeshVoice(group, activeSet) {
  const id = myId();
  const hostId = peerNum(group.hostId);
  if (activeSet.has(hostId)) return;
  for (const pid of activeSet) {
    if (pid === id || pid === hostId) continue;
    if (meshPeers.has(pid)) continue;
    if (id > pid) continue;
    sounds.outgoingCall();
    await createMeshOffer(pid, group.id);
  }
}

async function ensureClientToHost(group, { force = false } = {}) {
  const hostId = peerNum(group.hostId);
  if (!Number.isFinite(hostId) || hostId === myId()) return;
  if (!force && clientPc) {
    const st = clientPc.connectionState;
    if (st === 'connected' || st === 'connecting' || st === 'new') return;
  }
  if (clientConnectInFlight) return;
  clientConnectInFlight = true;

  try {
    if (clientPc) {
      clientPc.close();
      clientPc = null;
      clientPendingIce = [];
    }
    stopRemotePeerAudio(hostId);

    clientPc = new RTCPeerConnection(rtcConfiguration(configRef));
    clientPendingIce = [];

    localStream.getTracks().forEach((tr) => clientPc.addTrack(tr, localStream));

    clientPc.ontrack = (ev) => {
      if (ev.track.kind === 'audio') {
        if (isPcLoopbackTrack(ev.track, clientPc)) return;
        playRemoteStream(hostId, ev.streams[0] || new MediaStream([ev.track]), clientPc);
        sounds.stopOutgoingRing();
        sounds.callConnected();
        stageRefresh?.();
      }
      if (ev.track.kind === 'video') {
        peerVideoStreams.set(hostId, ev.streams[0] || new MediaStream([ev.track]));
        stageRefresh?.();
      }
    };

    clientPc.oniceconnectionstatechange = () => {
      const ice = clientPc?.iceConnectionState;
      if (ice === 'connected' || ice === 'completed') {
        void resumeVoiceAudioContexts();
      }
    };

    clientPc.onconnectionstatechange = () => {
      if (clientPc?.connectionState === 'connected') {
        sounds.stopOutgoingRing();
        sounds.callConnected();
        void resumeVoiceAudioContexts();
      }
    };

    clientPc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      void sendSignal(activeGroupId, hostId, {
        signalKind: 'candidate',
        candidate: ev.candidate.toJSON(),
      });
    };

    const offer = await clientPc.createOffer();
    await clientPc.setLocalDescription(offer);
    await sendSignal(activeGroupId, hostId, {
      signalKind: 'offer',
      sdp: { type: clientPc.localDescription.type, sdp: clientPc.localDescription.sdp },
    });
  } finally {
    clientConnectInFlight = false;
  }
}

export function registerVoiceStageRefresh(fn) {
  stageRefresh = typeof fn === 'function' ? fn : null;
}

export function isInVoiceChannel() {
  return !!(activeGroupId && activeChannelId && localStream);
}

export function getActiveVoiceChannel() {
  if (!activeGroupId || !activeChannelId) return null;
  return { groupId: activeGroupId, channelId: activeChannelId };
}

export function getParticipantMediaState(peerId) {
  const n = peerNum(peerId);
  if (n === myId()) return myMediaState();
  return peerMediaState.get(n) || { muted: false, deafened: false, screenSharing: false };
}

export async function joinVoiceChannel(groupId, channelId, api, config) {
  const group = getGroup(groupId);
  if (!group) return;
  apiRef = api;
  configRef = config;

  if (activeGroupId === groupId && activeChannelId === channelId && localStream) return;

  if (localStream) await leaveVoiceChannel();

  try {
    localStream = await getMic();
  } catch (err) {
    console.error('[voice-ch] mic:', err);
    showAppToast({ title: t('group.call_mic_failed'), variant: 'danger', durationMs: 5000 });
    return;
  }

  activeGroupId = groupId;
  activeChannelId = channelId;
  muted = false;
  deafened = false;

  await resumeVoiceAudioContexts();
  clearAllRemotePeerAudio();

  addChannelParticipant(groupId, channelId, myId());
  await broadcastRoster(groupId, channelId);

  if (isHost(group)) {
    sounds.callConnected();
    for (const [rid, off] of pendingHostOffers) {
      await handleHostOffer(rid, groupId, off);
    }
    pendingHostOffers.clear();
  } else {
    sounds.outgoingCall();
    await ensureClientToHost(group, { force: true });
  }

  startHeartbeat(groupId, channelId);
  stageRefresh?.();
}

export async function leaveVoiceChannel() {
  const gid = activeGroupId;
  const cid = activeChannelId;
  const id = myId();
  stopHeartbeat();

  if (gid && cid && Number.isFinite(id)) {
    removeChannelParticipant(gid, cid, id);
    await broadcastRoster(gid, cid, { leaver: id });
    const left = channelParticipants(gid, cid);
    if (!left.length) await broadcastRoster(gid, cid, { end: true });
  }

  screenStream?.getTracks().forEach((tr) => tr.stop());
  screenStream = null;
  sharingScreen = false;
  localStream?.getTracks().forEach((tr) => tr.stop());
  localStream = null;

  for (const pid of [...hostPeers.keys()]) disconnectHostPeer(pid);
  hostPeers.clear();
  hostPendingIce.clear();

  if (clientPc) {
    clientPc.close();
    clientPc = null;
  }
  clientPendingIce = [];

  for (const pid of [...meshPeers.keys()]) disconnectMeshPeer(pid);
  meshPeers.clear();
  meshPendingIce.clear();

  clearAllRemotePeerAudio();
  stopSilentTrack();

  if (audioCtx) {
    try {
      await audioCtx.close();
    } catch {

    }
    audioCtx = null;
    mixerTracks.clear();
  }

  peerMediaState.clear();
  peerVideoStreams.clear();
  pendingHostOffers.clear();
  hostOfferInFlight.clear();
  localScreenPreview = null;
  activeGroupId = null;
  activeChannelId = null;
  sounds.stopOutgoingRing();
  stageRefresh?.();
}

export function getPeerVideoStream(peerId) {
  return peerVideoStreams.get(peerNum(peerId)) || null;
}

export function getLocalScreenPreview() {
  return localScreenPreview;
}

export async function toggleVoiceMute() {
  muted = !muted;
  localStream?.getAudioTracks().forEach((tr) => {
    tr.enabled = !muted;
  });
  if (activeGroupId && activeChannelId) void broadcastRoster(activeGroupId, activeChannelId);
  stageRefresh?.();
}

export async function toggleVoiceDeafen() {
  deafened = !deafened;
  for (const el of peerAudioEls.values()) el.muted = deafened;
  if (activeGroupId && activeChannelId) void broadcastRoster(activeGroupId, activeChannelId);
  stageRefresh?.();
}

export function isVoiceMuted() {
  return muted;
}

export function isVoiceDeafened() {
  return deafened;
}

export async function handleVoiceChRoster(msg, api, config) {
  const group = getGroup(msg.groupId);
  const id = peerNum(config?.blipId);
  if (!group || !group.members.some((m) => peerNum(m) === id)) return;

  applyVoiceChRosterFromTcp(msg);

  if (msg.states && typeof msg.states === 'object') {
    for (const [pid, st] of Object.entries(msg.states)) {
      const n = peerNum(pid);
      if (!Number.isFinite(n)) continue;
      peerMediaState.set(n, {
        muted: !!st.muted,
        deafened: !!st.deafened,
        screenSharing: !!st.screenSharing,
      });
    }
  }

  stageRefresh?.();

  if (!localStream || activeGroupId !== msg.groupId || activeChannelId !== msg.channelId) return;

  const participants = (msg.participants || []).map(peerNum).filter(Number.isFinite);
  const activeSet = new Set(participants);

  const hostId = peerNum(group.hostId);
  const hostIn = activeSet.has(hostId);

  if (isHost(group)) {
    for (const rid of [...hostPeers.keys()]) {
      if (!activeSet.has(rid)) disconnectHostPeer(rid);
    }
  } else if (hostIn) {
    for (const pid of [...meshPeers.keys()]) disconnectMeshPeer(pid);
    await ensureClientToHost(group, { force: clientPcNeedsRebuild() });
  } else {
    if (clientPc) {
      clientPc.close();
      clientPc = null;
      clientPendingIce = [];
    }
    await ensureMeshVoice(group, activeSet);
  }
}

export async function handleVoiceChSignal(msg, api, config) {
  const group = getGroup(msg.groupId);
  const id = peerNum(config?.blipId);
  if (!group) return;

  apiRef = api;
  configRef = config;

  const hostId = peerNum(group.hostId);
  const origin = peerNum(msg.originFrom ?? msg.from);
  const target = peerNum(msg.target ?? msg.to);
  const remoteId = origin === id ? target : origin;

  if (target !== id && origin !== id) return;

  const offer = normalizeSdp(msg.sdp);

  const hostIn = channelParticipants(msg.groupId, msg.channelId).includes(hostId);
  const inChannel =
    activeGroupId === msg.groupId && activeChannelId === msg.channelId && localStream;

  if (msg.signalKind === 'reconnect' && !isHost(group) && inChannel && hostIn) {
    if (!clientPcNeedsRebuild() && clientPc?.connectionState === 'connected') return;
    sounds.outgoingCall();
    await ensureClientToHost(group, { force: true });
    return;
  }

  if (msg.signalKind === 'offer' && isHost(group) && offer) {
    await handleHostOffer(remoteId, msg.groupId, offer);
    return;
  }

  if (msg.signalKind === 'offer' && !isHost(group) && offer && inChannel && !hostIn) {
    await handleMeshOffer(remoteId, msg.groupId, offer);
    return;
  }

  if (msg.signalKind === 'answer' && !isHost(group) && clientPc && offer) {
    const answer = normalizeSdp(msg.sdp);
    if (!answer || answer.type !== 'answer') return;
    if (clientPc.signalingState !== 'have-local-offer') return;
    try {
      await clientPc.setRemoteDescription(answer);
      await flushClientIce(clientPc);
      const stream = new MediaStream();
      for (const r of clientPc.getReceivers?.() || []) {
        if (r.track?.kind === 'audio' && !isPcLoopbackTrack(r.track, clientPc)) {
          stream.addTrack(r.track);
        }
      }
      if (stream.getAudioTracks().length) playRemoteStream(hostId, stream, clientPc);
    } catch (err) {
      console.warn('[voice-ch] client answer:', err?.message || err);
    }
    return;
  }

  if (msg.signalKind === 'answer' && isHost(group) && hostPeers.get(remoteId) && offer) {
    const pc = hostPeers.get(remoteId);
    if (pc.signalingState !== 'have-local-offer') return;
    await pc.setRemoteDescription(offer);
    await flushHostIce(remoteId, pc);
    return;
  }

  if (msg.signalKind === 'answer' && meshPeers.get(remoteId) && offer) {
    const pc = meshPeers.get(remoteId);
    await pc.setRemoteDescription(offer);
    await flushMeshIce(remoteId, pc);
    sounds.stopOutgoingRing();
    sounds.callConnected();
    return;
  }

  if (msg.signalKind === 'ren-offer' && offer) {
    const remoteOffer = normalizeSdp(msg.sdp);
    if (!remoteOffer || remoteOffer.type !== 'offer') return;
    let pc = isHost(group)
      ? hostPeers.get(remoteId)
      : meshPeers.get(remoteId) || (origin === hostId ? clientPc : null);
    if (!pc || pc.signalingState !== 'stable') return;
    try {
      await pc.setRemoteDescription(remoteOffer);
      if (pc.signalingState !== 'have-remote-offer') return;
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal(msg.groupId, remoteId, {
        signalKind: 'ren-answer',
        sdp: { type: answer.type, sdp: answer.sdp },
      });
    } catch (err) {
      console.warn('[voice-ch] ren-offer:', err?.message || err);
    }
    return;
  }

  if (msg.signalKind === 'ren-answer' && offer) {
    const answer = normalizeSdp(msg.sdp);
    if (!answer || answer.type !== 'answer') return;
    const pc = hostPeers.get(remoteId) || meshPeers.get(remoteId) || clientPc;
    if (!pc || pc.signalingState !== 'have-local-offer') return;
    try {
      await pc.setRemoteDescription(answer);
    } catch (err) {
      console.warn('[voice-ch] ren-answer:', err?.message || err);
    }
    return;
  }

  if (msg.signalKind === 'candidate') {
    const cand = msg.candidate;
    if (isHost(group)) {
      const pc = hostPeers.get(remoteId);
      if (!pc) return;
      if (!pc.remoteDescription) {
        const q = hostPendingIce.get(remoteId) || [];
        q.push(cand);
        hostPendingIce.set(remoteId, q);
        return;
      }
      try {
        await pc.addIceCandidate(cand);
      } catch {

      }
    } else if (clientPc) {
      if (!clientPc.remoteDescription) {
        clientPendingIce.push(cand);
        return;
      }
      try {
        await clientPc.addIceCandidate(cand);
      } catch {

      }
    } else if (meshPeers.get(remoteId)) {
      const pc = meshPeers.get(remoteId);
      if (!pc.remoteDescription) {
        const q = meshPendingIce.get(remoteId) || [];
        q.push(cand);
        meshPendingIce.set(remoteId, q);
        return;
      }
      try {
        await pc.addIceCandidate(cand);
      } catch {

      }
    }
  }
}

export async function toggleVoiceScreenShare() {
  if (!localStream || !activeGroupId || !activeChannelId) return;
  if (sharingScreen) {
    screenStream?.getTracks().forEach((tr) => tr.stop());
    screenStream = null;
    sharingScreen = false;
    localScreenPreview = null;
    peerVideoStreams.delete(myId());
    await syncScreenVideoOut();
    stageRefresh?.();
    void broadcastRoster(activeGroupId, activeChannelId);
    return;
  }
  try {
    const pick = await openScreenPickerDialog();
    if (!pick?.sourceId) return;
    const stream = await captureDisplayStream(pick.sourceId, configRef, {
      withAudio: !!pick.withAudio,
    });
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error('No screen track');
    await applyScreenTrackConstraints(track, configRef);
    screenStream = stream;
    sharingScreen = true;
    localScreenPreview = stream;
    peerVideoStreams.set(myId(), stream);
    track.onended = () => {
      void toggleVoiceScreenShare();
    };
    await syncScreenVideoOut();
    void broadcastRoster(activeGroupId, activeChannelId);
    stageRefresh?.();
  } catch (err) {
    console.warn('[voice-ch] screen:', err?.message || err);
    showAppToast({ title: t('call.share_failed'), variant: 'danger', durationMs: 5000 });
  }
}

export function isVoiceScreenSharing() {
  return sharingScreen;
}

export async function onGroupHostChanged(groupId) {
  if (activeGroupId === groupId && localStream) {
    await leaveVoiceChannel();
    showAppToast({
      title: t('voice.host_changed'),
      body: t('voice.rejoin_channel'),
      durationMs: 6000,
    });
  }
}
