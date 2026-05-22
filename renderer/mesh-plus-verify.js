import { t } from './i18n.js';
import { showAppToast } from './toasts.js';
import { readTierFlag, readActiveEntitlement } from '../shared/mesh-plus-gates.js';

/**
 * @param {object} state
 * @returns {Promise<boolean>}
 */
export async function syncPremiumTierWithHost(state) {
  if (!window.blip?.getMeshPlusStatus) return true;
  const main = await window.blip.getMeshPlusStatus();
  const mainActive = !!main?.active;
  const localActive = readActiveEntitlement(state.config) || readTierFlag(state.config);

  if (mainActive === localActive) return mainActive;

  try {
    const fresh = await window.blip.getConfig();
    if (fresh && typeof fresh === 'object') {
      state.config = fresh;
    }
  } catch {
    /* ignore */
  }

  showAppToast({
    title: t('mesh_plus.sync_mismatch'),
    variant: 'danger',
    durationMs: 5200,
  });
  return mainActive;
}
