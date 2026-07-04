
const HISTORY_LEN = 60;
const TICK_MS = 1000;

const history = [];
let currentDownBps = 0;
let currentUpBps = 0;
let tickTimer = null;

const listeners = new Set();

function emit() {
  for (const fn of listeners) fn();
}

function pushSample() {
  history.push({ downBps: currentDownBps, upBps: currentUpBps, t: Date.now() });
  if (history.length > HISTORY_LEN) history.shift();
  currentDownBps = 0;
  currentUpBps = 0;
  emit();
}

function ensureTick() {
  if (tickTimer) return;
  tickTimer = setInterval(pushSample, TICK_MS);
}

export function subscribeBandwidth(cb) {
  listeners.add(cb);
  ensureTick();
  return () => listeners.delete(cb);
}

export function recordBandwidthSample({ downBps = 0, upBps = 0 } = {}) {
  if (downBps > 0) currentDownBps = Math.max(currentDownBps, downBps);
  if (upBps > 0) currentUpBps = Math.max(currentUpBps, upBps);
  ensureTick();
  emit();
}

export function getBandwidthRates() {
  const last = history[history.length - 1];
  return {
    downBps: currentDownBps || last?.downBps || 0,
    upBps: currentUpBps || last?.upBps || 0,
  };
}

export function getBandwidthHistory() {
  return [...history];
}

export function getBandwidthHistoryPeak() {
  let peak = 1;
  for (const s of history) {
    peak = Math.max(peak, s.downBps + s.upBps);
  }
  return Math.max(peak, currentDownBps + currentUpBps, 1);
}
