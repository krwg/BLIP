import { resetGroupsStore } from './groups.js';
import { resetChatStore } from './chat.js';
import { resetFavoritesStore } from './peer-favorites.js';
import { resetGroupInvitesStore } from './group-invites.js';
import { resetMeshProjectStores } from './group-projects-store.js';
import { clearAllAchievementUnlocks } from './achievements-store.js';

export function clearRendererLocalStorage() {
  const keep = new Set(['blip_lang']);
  const remove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('blip_') && !keep.has(key)) remove.push(key);
  }
  for (const key of remove) localStorage.removeItem(key);
}

export function resetRendererMemoryStores() {
  resetGroupsStore();
  resetChatStore();
  resetFavoritesStore();
  resetGroupInvitesStore();
  resetMeshProjectStores();
  clearAllAchievementUnlocks();
}
