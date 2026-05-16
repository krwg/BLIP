/**
 * Standalone call window — WebRTC only; main window no longer hosts call overlay.
 */
import { setLang, applyI18n, onLangChange } from './i18n.js';
import { createCallUI } from './call.js';
import { applyCallWindowAppearance, listenReducedMotion } from './appearance.js';
import { setSoundPrefs } from './audio.js';

let callAppearanceRm = null;
let callUI = null;
let liveConfig = null;

const api = {
  getConfig: () => window.blip.getConfig(),
  saveConfig: (data) => window.blip.saveConfig(data),
  sendTcpMessage: (payload) => window.blip.sendTcpMessage(payload),
  initiateCall: (payload) =>
    window.blip.initiateCall({
      to: payload.to,
      sdp: payload.sdp,
      video: payload.video,
    }),
  callAccept: (payload) =>
    window.blip.callAccept({
      to: payload.to,
      sdp: payload.sdp,
    }),
  callReject: (payload) => window.blip.callReject(payload),
  callCandidate: (payload) =>
    window.blip.callCandidate({
      to: payload.to,
      candidate: payload.candidate?.toJSON?.() ?? payload.candidate,
    }),
  callHangup: (payload) => window.blip.callHangup(payload),
  callState: (payload) => window.blip.callState(payload),
  callRenegotiate: (payload) => window.blip.callRenegotiate(payload),
  callRenegotiateAnswer: (payload) => window.blip.callRenegotiateAnswer(payload),
};

function applyCallWindowChrome(cfg) {
  liveConfig = cfg;
  setLang(cfg.language || localStorage.getItem('blip_lang') || 'en');
  setSoundPrefs({
    enabled: cfg.uiSoundsEnabled !== false && cfg.doNotDisturb !== true,
    volume: typeof cfg.uiSoundsVolume === 'number' ? cfg.uiSoundsVolume : 1,
    soundPack: cfg.uiSoundPack,
    melodyPack: cfg.uiMelodyPack,
  });
  applyCallWindowAppearance(cfg);
  applyI18n(document);
  callUI?.refreshI18n?.();
}

async function boot() {
  if (!window.blip) {
    document.getElementById('call-root').innerHTML =
      '<p style="color:#ff3366;padding:24px;">No preload bridge</p>';
    return;
  }

  const config = await window.blip.getConfig();
  setSoundPrefs({
    enabled: config.uiSoundsEnabled !== false && config.doNotDisturb !== true,
    volume: typeof config.uiSoundsVolume === 'number' ? config.uiSoundsVolume : 1,
    soundPack: config.uiSoundPack,
    melodyPack: config.uiMelodyPack,
  });
  applyCallWindowChrome(config);
  callAppearanceRm?.();
  callAppearanceRm = listenReducedMotion(() => {});

  const root = document.getElementById('call-root');

  callUI = createCallUI(config, api, {
    onClosed: () => {
      window.blip.closeCallWindow?.();
    },
  });
  root.appendChild(callUI.el);

  document.getElementById('call-win-min')?.addEventListener('click', () => {
    window.blip.callWindowMinimize?.();
  });
  document.getElementById('call-win-max')?.addEventListener('click', () => {
    window.blip.callWindowMaximize?.();
  });
  document.getElementById('call-win-close')?.addEventListener('click', () => {
    callUI?.hangupCall?.();
  });

  onLangChange(() => applyI18n(document));
  window.blip.onConfigUpdated?.((cfg) => applyCallWindowChrome(cfg));

  window.blip.onCallOutgoing?.((payload) => {
    const peerId = payload?.peerId;
    const video = !!payload?.video;
    if (peerId) callUI.startOutgoing(peerId, video);
  });

  window.blip.onIncomingCall((data) => {
    callUI.handleIncoming(data);
  });
  window.blip.onCallAnswer((data) => {
    callUI.handleAnswer(data);
  });
  window.blip.onCallCandidate((data) => {
    callUI.handleCandidate(data);
  });
  window.blip.onCallRejected((data) => {
    callUI.handleRejected(data);
  });
  window.blip.onCallEnded((data) => {
    callUI.handleEnded(data);
  });
  window.blip.onCallState((data) => {
    callUI.handleCallState(data);
  });
  window.blip.onCallRenegotiate((data) => {
    callUI.handleRenegotiateOffer(data);
  });
  window.blip.onCallRenegotiateAnswer((data) => {
    callUI.handleRenegotiateAnswer(data);
  });
  window.blip.onGlobalHangup?.(() => {
    callUI?.hangupCall?.();
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const key = e.key;
    if (key === 'm' || key === 'M') {
      callUI.toggleMute();
      e.preventDefault();
      return;
    }
    if (key === 'd' || key === 'D') {
      callUI.toggleDeafen();
      e.preventDefault();
      return;
    }
    if (key === 's' || key === 'S') {
      callUI.toggleScreenShare();
      e.preventDefault();
      return;
    }
    if (key === 'f' || key === 'F') {
      callUI.toggleVideoFullscreen();
      e.preventDefault();
      return;
    }
    if (key === 'Escape') {
      callUI.hangupCall();
      e.preventDefault();
      return;
    }
    if (key === 'Enter' && callUI.isIncomingRinging()) {
      callUI.acceptIncoming();
      e.preventDefault();
    }
  });
}

boot().catch((e) => console.error(e));
