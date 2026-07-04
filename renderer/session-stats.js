import { syncAchievements } from './achievements-tracker.js';

const STORAGE_KEY = 'blip_session_stats_v1';

let achievementConfigProvider = null;

export function setAchievementConfigProvider(fn) {
  achievementConfigProvider = fn;
}

function tickAchievements() {
  const cfg = achievementConfigProvider?.();
  if (cfg) syncAchievements(cfg);
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {

  }
}

function ensure() {
  const data = load();
  if (!data.sessionStartedAt) {
    data.sessionStartedAt = Date.now();
    data.messagesSent = 0;
    data.filesSent = 0;
    data.callsStarted = 0;
    data.peersMaxOnline = 0;
    save(data);
  }
  return data;
}

export function getSessionStats() {
  return ensure();
}

export function recordMessageSent() {
  const d = ensure();
  d.messagesSent = (d.messagesSent || 0) + 1;
  save(d);
  tickAchievements();
}

export function recordFileSent() {
  const d = ensure();
  d.filesSent = (d.filesSent || 0) + 1;
  save(d);
  tickAchievements();
}

export function recordCallStarted() {
  const d = ensure();
  d.callsStarted = (d.callsStarted || 0) + 1;
  save(d);
  tickAchievements();
}

export function recordPeersOnline(onlineCount) {
  const d = ensure();
  const n = Number(onlineCount) || 0;
  if (n > (d.peersMaxOnline || 0)) {
    d.peersMaxOnline = n;
    save(d);
    tickAchievements();
  }
}

export function sessionOnlineHours() {
  const d = ensure();
  const ms = Date.now() - (d.sessionStartedAt || Date.now());
  return Math.max(0, ms / (1000 * 60 * 60));
}

export function getSessionStatsChartBars() {
  const s = getSessionStats();
  const minutes = Math.max(1, Math.round(sessionOnlineHours() * 60));
  return [
    { labelKey: 'settings.network_stats_bar_messages', value: s.messagesSent || 0 },
    { labelKey: 'settings.network_stats_bar_files', value: s.filesSent || 0 },
    { labelKey: 'settings.network_stats_bar_calls', value: s.callsStarted || 0 },
    { labelKey: 'settings.network_stats_bar_peers', value: s.peersMaxOnline || 0 },
    { labelKey: 'settings.network_stats_bar_minutes', value: minutes },
  ];
}
