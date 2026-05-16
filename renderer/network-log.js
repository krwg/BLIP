const STORAGE_KEY = 'blip_netlog_v1';
const MAX = 80;

/** @type {Array<{ ts: number, peerId: number, event: string }>} */
let entries = [];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) entries = arr.slice(-MAX);
  } catch {
    entries = [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX)));
  } catch {
    /* ignore */
  }
}

load();

export function logPeerEvent(peerId, event) {
  entries.push({ ts: Date.now(), peerId: Number(peerId), event });
  if (entries.length > MAX) entries = entries.slice(-MAX);
  persist();
}

export function getNetworkLogEntries() {
  return [...entries].reverse();
}

export function clearNetworkLog() {
  entries = [];
  persist();
}
