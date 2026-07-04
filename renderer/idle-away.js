
let lastActivity = Date.now();
let pollTimer = null;
let getConfigRef = () => ({});
let saveConfigRef = async () => ({});

function bumpActivity() {
  lastActivity = Date.now();
  const cfg = getConfigRef();
  if (cfg?.idleAwayActive) {
    void saveConfigRef({ idleAwayActive: false });
  }
}

function bindActivity() {
  const opts = { passive: true };
  for (const ev of ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'focusin']) {
    window.addEventListener(ev, bumpActivity, opts);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') bumpActivity();
  });
}

async function pollIdle() {
  const cfg = getConfigRef();
  const mins = Number(cfg?.idleAwayMinutes);
  if (!Number.isFinite(mins) || mins <= 0) {
    if (cfg?.idleAwayActive) await saveConfigRef({ idleAwayActive: false });
    return;
  }
  const manual = cfg?.presenceStatus || 'online';
  if (manual !== 'online') {
    if (cfg?.idleAwayActive) await saveConfigRef({ idleAwayActive: false });
    return;
  }
  const idleMs = mins * 60_000;
  if (Date.now() - lastActivity >= idleMs) {
    if (!cfg?.idleAwayActive) await saveConfigRef({ idleAwayActive: true });
  }
}

export function initIdleAway(opts) {
  getConfigRef = opts.getConfig;
  saveConfigRef = opts.saveConfig;
  lastActivity = Date.now();
  bindActivity();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => void pollIdle(), 30_000);
}

export function notePresenceManualChange(status) {
  lastActivity = Date.now();
  if (status !== 'online') {
    void saveConfigRef({ idleAwayActive: false });
  }
}
