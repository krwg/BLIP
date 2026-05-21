import { t } from './i18n.js';
import { showAppToast } from './toasts.js';
import {
  MESH_PLUS_FEATURES,
  PREMIUM_ANIMATED_BG_IDS,
  PREMIUM_MELODY_PACK_IDS,
  PREMIUM_SOUND_PACK_IDS,
  isMeshPlusTierActive,
  requireMeshPlus,
} from '../shared/mesh-plus-gates.js';

export {
  MESH_PLUS_FEATURES,
  PREMIUM_ANIMATED_BG_IDS,
  PREMIUM_SOUND_PACK_IDS,
  PREMIUM_MELODY_PACK_IDS,
  isMeshPlusTierActive,
  requireMeshPlus,
};

/** @param {object} [cfg] */
export function isMeshPlusActive(cfg) {
  return isMeshPlusTierActive(cfg);
}

/** @param {object} [peer] */
export function peerHasMeshPlus(peer) {
  return !!peer?.meshPlus;
}

export function showMeshPlusLockedToast() {
  showAppToast({
    title: t('mesh_plus.feature_locked'),
    durationMs: 4200,
  });
}

/**
 * @param {{ value: string, label: string }[]} options
 * @param {string} feature
 * @param {object} [cfg]
 */
export function markMeshPlusGatedOptions(options, feature, cfg) {
  if (isMeshPlusTierActive(cfg)) return options;
  return options.map((opt) => ({
    ...opt,
    meshPlus: !requireMeshPlus(cfg, feature, opt.value),
  }));
}

/**
 * @param {HTMLSelectElement} select
 * @param {{ value: string, label: string, meshPlus?: boolean }[]} options
 * @param {string} current
 * @param {string} feature
 * @param {object} cfg
 * @param {(value: string) => void | Promise<void>} onChange
 */
export function fillMeshGatedDropdown(select, options, current, feature, cfg, onChange) {
  select.innerHTML = '';
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.meshPlus) o.disabled = true;
    select.appendChild(o);
  }
  const allowed = options.filter((o) => !o.meshPlus);
  const ok = options.some((o) => o.value === current && !o.meshPlus);
  select.value = ok ? current : allowed[0]?.value || options[0]?.value || '';

  select.addEventListener('change', () => {
    const val = select.value;
    const picked = options.find((o) => o.value === val);
    if (picked?.meshPlus || !requireMeshPlus(cfg, feature, val)) {
      showMeshPlusLockedToast();
      const revert = ok ? current : allowed[0]?.value ?? options[0]?.value ?? '';
      select.value = revert;
      return;
    }
    void onChange(val);
  });
}

/**
 * Platinum plaque + pixel gradient "MESH+" label.
 * @param {{ title?: string, compact?: boolean }} [opts]
 */
export function createMeshPlusBadge(opts = {}) {
  const el = document.createElement('span');
  el.className = `mesh-plus-badge${opts.compact ? ' mesh-plus-badge--compact' : ''}`;
  el.title = opts.title || t('mesh_plus.badge_title');
  const text = document.createElement('span');
  text.className = 'mesh-plus-badge__text';
  text.textContent = t('mesh_plus.badge_label');
  el.appendChild(text);
  return el;
}

/**
 * @param {HTMLElement} nameRow
 * @param {object} [peer]
 */
export function appendMeshPlusBadgeToNameRow(nameRow, peer) {
  if (!peerHasMeshPlus(peer)) return;
  if (nameRow.querySelector('.mesh-plus-badge')) return;
  nameRow.appendChild(createMeshPlusBadge({ compact: true }));
}
