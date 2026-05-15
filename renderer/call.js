import { t } from './i18n.js';
import { sounds } from './audio.js';
import { createAvatarElement } from './avatar.js';

const ICE_SERVERS = [];

let activeCall = null;
let pendingCandidates = [];
let pendingOffer = null;

function normalizeSdp(sdp) {
  if (!sdp) return null;
  if (typeof sdp === 'string') return { type: 'offer', sdp };
  return { type: sdp.type, sdp: sdp.sdp };
}

function normalizeCandidate(candidate) {
  if (!candidate) return null;
  if (candidate.candidate !== undefined) return candidate;
  return null;
}

function createPeerConnection(onRemoteStream) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  pc.ontrack = (e) => {
    if (e.streams[0]) onRemoteStream(e.streams[0]);
  };

  pc.onicecandidate = (e) => {
    if (e.candidate && activeCall?.onCandidate) {
      const json = e.candidate.toJSON ? e.candidate.toJSON() : e.candidate;
      activeCall.onCandidate(json);
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') {
      console.error('[call] connection failed');
    }
  };

  return pc;
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) return `${pad(h)}:${pad(m % 60)}:${pad(s % 60)}`;
  return `${pad(m)}:${pad(s % 60)}`;
}

export function createCallUI(config, api) {
  const overlay = document.createElement('div');
  overlay.className = 'call-overlay hidden';

  const inner = document.createElement('div');
  inner.className = 'call-inner glass';

  const statusEl = document.createElement('div');
  statusEl.className = 'call-status';

  // Dual avatar container for voice calls
  const dualAvatars = document.createElement('div');
  dualAvatars.className = 'call-dual-avatars hidden';
  
  const localAvatarWrap = document.createElement('div');
  localAvatarWrap.className = 'call-avatar-slot';
  const localLabel = document.createElement('span');
  localLabel.className = 'call-avatar-label';
  localLabel.dataset.i18n = 'call.you';
  localLabel.textContent = 'You';
  const localAvatarContainer = document.createElement('div');
  localAvatarWrap.appendChild(localAvatarContainer);
  localAvatarWrap.appendChild(localLabel);
  
  const remoteAvatarWrap = document.createElement('div');
  remoteAvatarWrap.className = 'call-avatar-slot remote';
  const remoteLabel = document.createElement('span');
  remoteLabel.className = 'call-avatar-label';
  remoteLabel.dataset.i18n = 'call.peer';
  remoteLabel.textContent = 'Peer';
  const remoteAvatarContainer = document.createElement('div');
  remoteAvatarWrap.appendChild(remoteAvatarContainer);
  remoteAvatarWrap.appendChild(remoteLabel);
  
  dualAvatars.appendChild(localAvatarWrap);
  dualAvatars.appendChild(remoteAvatarWrap);

  const videoWrap = document.createElement('div');
  videoWrap.className = 'call-video-wrap hidden';
  const localVideo = document.createElement('video');
  localVideo.className = 'call-video local';
  localVideo.autoplay = true;
  localVideo.muted = true;
  localVideo.playsInline = true;
  const remoteVideo = document.createElement('video');
  remoteVideo.className = 'call-video remote';
  remoteVideo.autoplay = true;
  remoteVideo.playsInline = true;
  const gridOverlay = document.createElement('div');
  gridOverlay.className = 'video-pixel-grid';
  videoWrap.appendChild(remoteVideo);
  videoWrap.appendChild(localVideo);
  videoWrap.appendChild(gridOverlay);

  const voiceWrap = document.createElement('div');
  voiceWrap.className = 'call-voice-wrap hidden';
  const avatarSlot = document.createElement('div');
  avatarSlot.className = 'call-avatar-slot';
  const waveform = document.createElement('div');
  waveform.className = 'call-waveform';
  for (let i = 0; i < 8; i++) {
    const bar = document.createElement('div');
    bar.className = 'wave-bar';
    waveform.appendChild(bar);
  }
  voiceWrap.appendChild(avatarSlot);
  voiceWrap.appendChild(waveform);

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

  const endBtn = document.createElement('button');
  endBtn.type = 'button';
  endBtn.className = 'btn btn-danger';
  endBtn.dataset.i18n = 'call.end';
  endBtn.textContent = t('call.end');

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

  controls.appendChild(muteBtn);
  controls.appendChild(deafenBtn);
  controls.appendChild(acceptBtn);
  controls.appendChild(rejectBtn);
  controls.appendChild(endBtn);

  inner.appendChild(statusEl);
  inner.appendChild(dualAvatars);
  inner.appendChild(videoWrap);
  inner.appendChild(voiceWrap);
  inner.appendChild(timerEl);
  inner.appendChild(controls);
  overlay.appendChild(inner);

  let localStream = null;
  let pc = null;
  let peerId = null;
  let withVideo = false;
  let muted = false;
  let deafened = false;
  let timerInterval = null;
  let callStart = null;
  let pulseTimer = null;
  let incomingOffer = null;

  function show() {
    overlay.classList.remove('hidden');
  }

  function setConnectedStatus() {
    statusEl.dataset.i18n = 'call.connected';
    statusEl.textContent = t('call.connected');
  }

  function hide() {
    overlay.classList.add('hidden');
    cleanup();
  }

  function cleanup() {
    clearInterval(timerInterval);
    clearInterval(pulseTimer);
    pulseTimer = null;
    timerInterval = null;
    pendingCandidates = [];
    pendingOffer = null;
    incomingOffer = null;
    if (localStream) {
      localStream.getTracks().forEach((tr) => tr.stop());
      localStream = null;
    }
    if (pc) {
      pc.close();
      pc = null;
    }
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    activeCall = null;
    inner.style.borderColor = '';
    acceptBtn.classList.add('hidden');
    rejectBtn.classList.add('hidden');
    endBtn.classList.remove('hidden');
    muteBtn.classList.remove('hidden');
    deafenBtn.classList.remove('hidden');
  }

  function isForCurrentPeer(data) {
    if (!peerId || !data?.from) return true;
    return Number(data.from) === Number(peerId);
  }

  async function getMedia(video) {
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video ? { width: 320, height: 320 } : false,
    });
  }

  function startTimer() {
    if (timerInterval) return;
    callStart = Date.now();
    timerInterval = setInterval(() => {
      timerEl.textContent = formatDuration(Date.now() - callStart);
    }, 1000);
  }

  function startIncomingPulse() {
    clearInterval(pulseTimer);
    pulseTimer = setInterval(() => {
      inner.style.borderColor = inner.style.borderColor === '#00ffc8' ? '#ff3366' : '#00ffc8';
    }, 200);
  }

  async function flushPendingCandidates() {
    if (!pc?.remoteDescription) return;
    for (const c of pendingCandidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (err) {
        console.warn('[call] ICE candidate:', err.message);
      }
    }
    pendingCandidates = [];
  }

  async function setRemoteDescription(sdp) {
    const desc = normalizeSdp(sdp);
    if (!desc?.type || !desc?.sdp) throw new Error('Invalid SDP');
    await pc.setRemoteDescription(desc);
    await flushPendingCandidates();
  }

  async function addIceCandidate(candidate) {
    const init = normalizeCandidate(candidate);
    if (!init?.candidate) return;
    if (!pc) {
      pendingCandidates.push(init);
      return;
    }
    if (!pc.remoteDescription) {
      pendingCandidates.push(init);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(init));
    } catch (err) {
      console.warn('[call] addIceCandidate:', err.message);
    }
  }

  function bindActiveCall(id) {
    activeCall = {
      peerId: id,
      pc,
      onCandidate: (candidate) => {
        api.callCandidate({ to: id, candidate });
      },
    };
  }

  async function startOutgoing(targetId, video) {
    peerId = targetId;
    withVideo = video;
    show();
    statusEl.dataset.i18n = 'call.outgoing';
    statusEl.textContent = t('call.outgoing');
    
    // Show dual avatars for voice calls, video element for video calls
    dualAvatars.classList.toggle('hidden', video);
    videoWrap.classList.toggle('hidden', !video);
    voiceWrap.classList.add('hidden');
    
    // Setup dual avatar view
    localAvatarContainer.innerHTML = '';
    localAvatarContainer.appendChild(createAvatarElement(config.blipId, 4));
    remoteAvatarContainer.innerHTML = '';
    remoteAvatarContainer.appendChild(createAvatarElement(targetId, 4));

    try {
      localStream = await getMedia(video);
      if (video) localVideo.srcObject = localStream;

      pc = createPeerConnection((stream) => {
        remoteVideo.srcObject = stream;
        setConnectedStatus();
        startTimer();
      });

      localStream.getTracks().forEach((tr) => pc.addTrack(tr, localStream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      bindActiveCall(targetId);

      const result = await api.initiateCall({
        to: targetId,
        sdp: pc.localDescription,
        video,
      });
      if (!result?.ok) throw new Error(result?.error || 'Call failed');
    } catch (err) {
      console.error('[call] outgoing:', err);
      hide();
    }
    
    // Очищаем входящий оффер при исходящем звонке
    incomingOffer = null;
  }

  async function acceptIncoming() {
    console.log('[call] Accepting incoming call from peer:', peerId);
    clearInterval(pulseTimer);
    inner.style.borderColor = '';
    acceptBtn.classList.add('hidden');
    rejectBtn.classList.add('hidden');
    endBtn.classList.remove('hidden');
    muteBtn.classList.remove('hidden');
    deafenBtn.classList.remove('hidden');

    const offer = incomingOffer;
    if (!offer) {
      console.error('[call] No incoming offer to accept');
      return;
    }

    try {
      localStream = await getMedia(withVideo);
      if (withVideo) localVideo.srcObject = localStream;

      pc = createPeerConnection((stream) => {
        remoteVideo.srcObject = stream;
        setConnectedStatus();
        startTimer();
      });

      localStream.getTracks().forEach((tr) => pc.addTrack(tr, localStream));

      await setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Mark call as active BEFORE sending answer
      activeCall = {
        peerId,
        pc,
        pending: false,
        onCandidate: (candidate) => {
          api.callCandidate({ to: peerId, candidate });
        },
      };

      const result = await api.callAccept({ to: peerId, sdp: pc.localDescription });
      if (!result?.ok) throw new Error(result?.error || 'Accept failed');
      
      console.log('[call] Call accepted successfully, waiting for connection');
    } catch (err) {
      console.error('[call] accept:', err);
      hide();
    }
    
    // Очищаем входящий оффер после принятия звонка
    incomingOffer = null;
  }

  async function handleIncoming(data) {
    const from = Number(data.from);
    if (!from) return;

    console.log('[call] Incoming call from:', from, 'activeCall:', activeCall, 'pc:', !!pc, 'incomingOffer:', !!incomingOffer);

    // Если уже есть активный звонок, игнорируем новый входящий
    if (pc || activeCall?.pc) {
      console.log('[call] Rejecting incoming call - already in active call');
      return;
    }

    peerId = from;
    withVideo = data.video ?? false;
    incomingOffer = data.sdp;
    pendingCandidates = [];

    show();
    sounds.incomingCall();
    statusEl.dataset.i18n = 'call.incoming';
    statusEl.textContent = t('call.incoming');
    startIncomingPulse();
    acceptBtn.classList.remove('hidden');
    rejectBtn.classList.remove('hidden');
    endBtn.classList.add('hidden');
    muteBtn.classList.add('hidden');
    deafenBtn.classList.add('hidden');
    
    // Show dual avatars for voice calls
    dualAvatars.classList.toggle('hidden', withVideo);
    videoWrap.classList.toggle('hidden', !withVideo);
    voiceWrap.classList.add('hidden');
    
    // Setup dual avatar view for incoming call
    localAvatarContainer.innerHTML = '';
    localAvatarContainer.appendChild(createAvatarElement(config.blipId, 4));
    remoteAvatarContainer.innerHTML = '';
    remoteAvatarContainer.appendChild(createAvatarElement(peerId, 4));

    activeCall = { peerId, pending: true };
    console.log('[call] Showing incoming call UI');
  }

  acceptBtn.addEventListener('click', () => acceptIncoming());

  rejectBtn.addEventListener('click', async () => {
    if (peerId) await api.callReject({ to: peerId });
    sounds.callEnd();
    hide();
  });

  async function handleAnswer(data) {
    if (!isForCurrentPeer(data) || !pc) return;
    console.log('[call] Received answer from peer:', data.from);
    try {
      await setRemoteDescription(data.sdp);
      setConnectedStatus();
      startTimer();
      
      // У звонящего сбрасываем статус "набор" после принятия звонка
      statusEl.dataset.i18n = 'call.connected';
      statusEl.textContent = t('call.connected');
      console.log('[call] Call connected, timer started');
    } catch (err) {
      console.error('[call] answer:', err);
    }
  }

  async function handleCandidate(data) {
    if (!isForCurrentPeer(data)) return;
    await addIceCandidate(data.candidate);
  }

  function handleRejected(data) {
    if (!isForCurrentPeer(data)) return;
    sounds.callEnd();
    hide();
  }

  function handleEnded(data) {
    if (!isForCurrentPeer(data)) return;
    sounds.callEnd();
    hide();
  }

  muteBtn.addEventListener('click', () => {
    muted = !muted;
    localStream?.getAudioTracks().forEach((tr) => {
      tr.enabled = !muted;
    });
    muteBtn.classList.toggle('active', muted);
  });

  deafenBtn.addEventListener('click', () => {
    deafened = !deafened;
    remoteVideo.muted = deafened;
    deafenBtn.classList.toggle('active', deafened);
  });

  endBtn.addEventListener('click', async () => {
    if (peerId) await api.callHangup({ to: peerId });
    sounds.callEnd();
    hide();
  });

  return {
    el: overlay,
    startOutgoing,
    handleIncoming,
    handleAnswer,
    handleCandidate,
    handleRejected,
    handleEnded,
    hide,
    end: hide,
    isActive: () => {
      const active = !!(pc && pc.connectionState !== 'closed') || !!(incomingOffer && activeCall?.pending);
      console.log('[call] isActive check:', { hasPc: !!pc, connectionState: pc?.connectionState, hasIncomingOffer: !!incomingOffer, pending: activeCall?.pending, result: active });
      return active;
    },
  };
}

export function showSignalLost(container) {
  const el = document.createElement('div');
  el.className = 'signal-lost glass';
  el.innerHTML = `
    <div class="skull-icon" aria-hidden="true"></div>
    <h2 data-i18n="call.signal_lost">${t('call.signal_lost')}</h2>
    <p data-i18n="call.signal_lost_hint">${t('call.signal_lost_hint')}</p>
  `;
  container.innerHTML = '';
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
