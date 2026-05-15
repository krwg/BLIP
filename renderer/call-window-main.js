/**
 * Standalone call window — WebRTC only; main window no longer hosts call overlay.
 */
import { setLang } from './i18n.js';
import { createCallUI } from './call.js';

const api = {
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
};

function dbg(...args) {
  console.log('[BLIP call-window]', ...args);
}

async function boot() {
  if (!window.blip) {
    document.getElementById('call-root').innerHTML =
      '<p style="color:#ff3366;padding:24px;">No preload bridge</p>';
    return;
  }

  const config = await window.blip.getConfig();
  setLang(config.language || localStorage.getItem('blip_lang') || 'en');

  const root = document.getElementById('call-root');
  let callUI = null;

  callUI = createCallUI(config, api, {
    onClosed: () => {
      window.blip.closeCallWindow?.();
    },
  });
  root.appendChild(callUI.el);

  document.getElementById('call-win-close')?.addEventListener('click', () => {
    callUI?.hangupCall?.();
  });

  window.blip.onCallOutgoing?.((payload) => {
    dbg('call-outgoing', payload);
    const peerId = payload?.peerId;
    const video = !!payload?.video;
    if (peerId) callUI.startOutgoing(peerId, video);
  });

  window.blip.onIncomingCall((data) => {
    dbg('incoming-call', data);
    callUI.handleIncoming(data);
  });
  window.blip.onCallAnswer((data) => {
    dbg('call-answer', data);
    callUI.handleAnswer(data);
  });
  window.blip.onCallCandidate((data) => {
    dbg('call-candidate', data);
    callUI.handleCandidate(data);
  });
  window.blip.onCallRejected((data) => {
    dbg('call-rejected', data);
    callUI.handleRejected(data);
  });
  window.blip.onCallEnded((data) => {
    dbg('call-ended', data);
    callUI.handleEnded(data);
  });
}

boot().catch((e) => console.error(e));
