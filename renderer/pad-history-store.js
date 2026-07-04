const STORAGE_KEY = 'blip_pad_history_v1';
const MAX_SNAPSHOTS = 32;

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {

  }
}

export function getPadHistory(scopeId) {
  const key = String(scopeId);
  const all = readAll();
  const list = Array.isArray(all[key]) ? all[key] : [];
  return list.slice(0, MAX_SNAPSHOTS);
}

export function pushPadSnapshot(scopeId, snap) {
  const key = String(scopeId);
  const text = String(snap.text ?? '');
  if (!text.trim()) return;
  const entry = {
    id: `${snap.updatedAt || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    updatedAt: Number(snap.updatedAt) || Date.now(),
    from: Number(snap.from) || 0,
    label: snap.label ? String(snap.label) : '',
  };
  const all = readAll();
  const prev = Array.isArray(all[key]) ? all[key] : [];
  const next = [entry, ...prev.filter((e) => e.text !== text || e.updatedAt !== entry.updatedAt)].slice(
    0,
    MAX_SNAPSHOTS
  );
  all[key] = next;
  writeAll(all);
  return entry;
}

export function getPadSnapshotById(scopeId, snapshotId) {
  const hit = getPadHistory(scopeId).find((e) => e.id === snapshotId);
  if (!hit) return null;
  return { text: hit.text, updatedAt: hit.updatedAt, from: hit.from };
}

export function deletePadSnapshot(scopeId, snapshotId) {
  const key = String(scopeId);
  const all = readAll();
  const prev = Array.isArray(all[key]) ? all[key] : [];
  const next = prev.filter((e) => e.id !== snapshotId);
  if (next.length === prev.length) return false;
  all[key] = next;
  writeAll(all);
  return true;
}
