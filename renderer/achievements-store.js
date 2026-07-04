const STORAGE_KEY = 'blip_ach_unlocked_v1';

function loadSet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveSet(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {

  }
}

export function isAchievementUnlocked(id) {
  return loadSet().has(id);
}

export function unlockAchievement(id) {
  const set = loadSet();
  if (set.has(id)) return false;
  set.add(id);
  saveSet(set);
  return true;
}

export function clearAllAchievementUnlocks() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {

  }
}
