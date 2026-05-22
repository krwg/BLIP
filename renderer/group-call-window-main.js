import { setLang, applyI18n, onLangChange } from './i18n.js';
import {
  initGroupCallWindow,
  joinGroupCall,
  leaveGroupCall,
  handleGroupCallSignal,
  handleGroupCallStart,
  handleGroupCallEnd,
  handleGroupCallState,
} from './group-call.js';
import { applyCallWindowAppearance, listenReducedMotion } from './appearance.js';
import { setSoundPrefs } from './audio.js';
import { setLocalTrustState } from './trust-ui.js';

let appearanceRm = null;
/** @type {Map<number, object>} */
let lanPeersById = new Map();

const api = {
  getConfig: () => window.blip.getConfig(),
  saveConfig: (data) => window.blip.saveConfig(data),
  sendTcpMessage: (payload) => window.blip.sendTcpMessage(payload),
  fetchGroup: (groupId) => window.blip.getGroupForCall(groupId),
  getPeers: () => window.blip.getPeers(),
  getLanPeer: (id) => lanPeersById.get(Number(id)) || null,
};

async function syncLanPeers() {
  try {
    const { peers } = await window.blip.getPeers();
    lanPeersById = new Map(peers.map((p) => [Number(p.blipId), p]));
  } catch {
    lanPeersById = new Map();
  }
}

async function callApi() {
  const config = await api.getConfig();
  return { ...api, config };
}

function applyChrome(cfg) {
  setLang(cfg.language || localStorage.getItem('blip_lang') || 'en');
  setSoundPrefs({
    enabled: cfg.uiSoundsEnabled !== false && cfg.doNotDisturb !== true,
    volume: typeof cfg.uiSoundsVolume === 'number' ? cfg.uiSoundsVolume : 1,
    soundPack: cfg.uiSoundPack,
    melodyPack: cfg.uiMelodyPack,
  });
  applyCallWindowAppearance(cfg);
  applyI18n(document);
}

async function routeGroupTcp(msg) {
  const callApiRef = await callApi();
  switch (msg.type) {
    case 'group-call-signal':
      await handleGroupCallSignal(msg, callApiRef);
      break;
    case 'group-call-state':
      await handleGroupCallState(msg, callApiRef);
      break;
    case 'group-call-start':
      await handleGroupCallStart(msg, callApiRef);
      break;
    case 'group-call-end':
      await handleGroupCallEnd(msg);
      break;
    default:
      break;
  }
}

async function boot() {
  if (!window.blip) {
    document.getElementById('group-call-root').innerHTML =
      '<p style="color:#ff3366;padding:24px;">No preload bridge</p>';
    return;
  }

  const config = await api.getConfig();
  applyChrome(config);
  appearanceRm?.();
  appearanceRm = listenReducedMotion(() => {});
  await syncLanPeers();
  window.blip.onPeersUpdated?.(() => {
    void syncLanPeers();
  });
  window.blip.onTrustState?.((trust) => setLocalTrustState(trust));
  void window.blip.getTrustState?.().then((trust) => {
    if (trust) setLocalTrustState(trust);
  });
  initGroupCallWindow(api, config);

  document.getElementById('group-call-win-min')?.addEventListener('click', () => {
    window.blip.groupCallWindowMinimize?.();
  });
  document.getElementById('group-call-win-max')?.addEventListener('click', () => {
    window.blip.groupCallWindowMaximize?.();
  });
  document.getElementById('group-call-win-close')?.addEventListener('click', () => {
    void leaveGroupCall();
  });

  onLangChange(() => applyI18n(document));
  window.blip.onConfigUpdated?.((cfg) => applyChrome(cfg));

  window.blip.onGroupCallJoin?.((payload) => {
    if (!payload?.groupId) return;
    void (async () => {
      const callApiRef = await callApi();
      await joinGroupCall(payload.groupId, callApiRef, { skipInvite: !!payload.skipInvite });
    })();
  });

  window.blip.onGroupCallIncoming?.((payload) => {
    if (!payload?.groupId) return;
    void (async () => {
      const callApiRef = await callApi();
      await handleGroupCallStart(
        {
          type: 'group-call-start',
          groupId: payload.groupId,
          from: payload.from,
          members: payload.members,
          host: payload.host,
        },
        callApiRef
      );
    })();
  });

  window.blip.onGroupCallTcp?.((msg) => {
    void routeGroupTcp(msg);
  });

  window.blip.onGroupCallLeave?.(() => {
    void leaveGroupCall();
  });

  window.blip.onGlobalHangup?.(() => {
    void leaveGroupCall();
  });

  window.__blipGroupCallReady = true;
  window.blip.reportGroupCallWindowReady?.();
}

boot().catch((e) => {
  console.error(e);
  window.__blipGroupCallReady = true;
  window.blip?.reportGroupCallWindowReady?.();
});
