import { ACHIEVEMENT_DEFS } from './achievements.js';
import { getSessionStats } from './session-stats.js';
import { isAchievementUnlocked, unlockAchievement } from './achievements-store.js';
import { showAchievementUnlockToast } from './achievement-toast.js';

/**
 * @param {object} [config]
 * @returns {import('./achievements.js').AchievementDef[]}
 */
export function syncAchievements(config) {
  if (!config?.achievementsEnabled) return [];
  const stats = getSessionStats();
  const newly = [];
  for (const def of ACHIEVEMENT_DEFS) {
    const met = def.checkTrust
      ? def.checkTrust()
      : def.checkConfig
        ? def.checkConfig(config)
        : def.check?.(stats);
    if (!met) continue;
    if (isAchievementUnlocked(def.id)) continue;
    if (unlockAchievement(def.id)) newly.push(def);
  }
  if (newly.length && config.achievementsNotify !== false) {
    for (const def of newly) {
      showAchievementUnlockToast(def);
    }
  }
  return newly;
}
