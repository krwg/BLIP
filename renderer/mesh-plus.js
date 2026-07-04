import { t } from './i18n.js';
import { showAppToast } from './toasts.js';
import { applyPeerMeshPlusBadgeTrust } from './trust-ui.js';
import {
  MESH_PLUS_FEATURES,
  PREMIUM_ANIMATED_BG_IDS,
  PREMIUM_MELODY_PACK_IDS,
  PREMIUM_SOUND_PACK_IDS,
  uiShowsPremiumTier,
  freeTierAllowsValue,
} from '../shared/mesh-plus-gates.js';

export {
  MESH_PLUS_FEATURES,
  PREMIUM_ANIMATED_BG_IDS,
  PREMIUM_SOUND_PACK_IDS,
  PREMIUM_MELODY_PACK_IDS,
  uiShowsPremiumTier,
  freeTierAllowsValue,
};

export function premiumTierEnabled(cfg) {
  return uiShowsPremiumTier(cfg);
}

export function peerShowsPremiumBadge(peer) {
  return !!peer?.meshPlus;
}

export function showPremiumLockedToast() {
  showAppToast({
    title: t('mesh_plus.feature_locked'),
    durationMs: 4200,
  });
}

export function markPremiumGatedOptions(options, feature, cfg) {
  if (uiShowsPremiumTier(cfg)) return options;
  return options.map((opt) => ({
    ...opt,
    meshPlus: !freeTierAllowsValue(cfg, feature, opt.value),
  }));
}

export function fillPremiumGatedDropdown(select, options, current, feature, cfg, onChange) {
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
    if (picked?.meshPlus || !freeTierAllowsValue(cfg, feature, val)) {
      showPremiumLockedToast();
      const revert = ok ? current : allowed[0]?.value ?? options[0]?.value ?? '';
      select.value = revert;
      return;
    }
    void onChange(val);
  });
}

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

export function appendMeshPlusBadgeToNameRow(nameRow, peer) {
  if (!peerShowsPremiumBadge(peer)) return;
  if (nameRow.querySelector('.mesh-plus-badge')) return;
  const badge = createMeshPlusBadge({ compact: true });
  applyPeerMeshPlusBadgeTrust(badge, peer);
  nameRow.appendChild(badge);
}
