import { t } from './i18n.js';

/** @param {object} [cfg] */
export function isMeshPlusActive(cfg) {
  return cfg?.meshPlusActive === true || cfg?.tier === 'mesh_plus';
}

/** @param {object} [peer] */
export function peerHasMeshPlus(peer) {
  return !!peer?.meshPlus;
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
