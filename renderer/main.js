import { setLang } from './i18n.js';
import {
  initUI,
  updatePeers,
  handleTcpMessage,
  navigateToView,
  toggleDoNotDisturb,
} from './ui.js';
import { initMediaViewer } from './media-viewer.js';
import { syncPremiumTierWithHost } from './mesh-plus-verify.js';
import { setLocalTrustState } from './trust-ui.js';
import { syncAchievements } from './achievements-tracker.js';

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

function showBootError(message) {
  const root = document.getElementById('app');
  if (!root) return;
  const box = document.createElement('div');
  box.style.cssText =
    'padding:24px;font-family:monospace;color:#ff3366;border:2px solid #ff3366;margin:48px;';
  box.innerHTML = `<strong>BLIP BOOT ERROR</strong>
    <p style="color:#e0e0e0;margin-top:12px;">${message}</p>
    <p style="color:#333;margin-top:8px;font-size:12px;">Run: npm run build && npx electron .</p>`;
  root.replaceChildren(box);
}

async function boot() {
  if (!window.blip) {
    showBootError('Preload bridge not loaded. Rebuild and restart the app.');
    return;
  }
  const config = await window.blip.getConfig();
  const lang = config.language || localStorage.getItem('blip_lang') || 'en';
  setLang(lang);

  const bootState = { config };
  await syncPremiumTierWithHost(bootState);
  if (window.blip?.getTrustState) {
    setLocalTrustState(await window.blip.getTrustState());
    if (bootState.config?.achievementsEnabled) syncAchievements(bootState.config);
  }
  window.blip?.onTrustState?.((trust) => {
    setLocalTrustState(trust);
    if (bootState.config?.achievementsEnabled) syncAchievements(bootState.config);
  });
  initUI(bootState.config, api);
  initMediaViewer();

  const { peers, occupiedIds } = await window.blip.getPeers();
  updatePeers({ peers, occupiedIds });

  window.blip.onPeersUpdated((data) => updatePeers(data));
  window.blip.onTcpMessage((msg) => handleTcpMessage(msg));

  window.blip.onGlobalNavigate?.((payload) => {
    if (payload?.view) navigateToView(payload.view);
  });
  window.blip.onGlobalToggleDnd?.(() => {
    void toggleDoNotDisturb();
  });

  /* Calls run in separate BrowserWindow (call-window.html) — see main process */
}

boot().catch((err) => {
  console.error(err);
  showBootError(err?.message || String(err));
});
