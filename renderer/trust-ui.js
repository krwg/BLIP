import { t } from './i18n.js';
import { createAvatarElement } from './avatar.js';
import { BUILD_TRUST, MESH_TRUST } from '../shared/trust-levels.js';

/** @type {{ buildTrust: string, meshPlusTrust: string } | null} */
let localTrustState = null;

/**
 * @param {{ buildTrust?: string, meshPlusTrust?: string }} state
 */
export function setLocalTrustState(state) {
  if (!state) return;
  localTrustState = {
    buildTrust: state.buildTrust || BUILD_TRUST.UNVERIFIED_BUILD,
    meshPlusTrust: state.meshPlusTrust || MESH_TRUST.UNVERIFIED_MESH_PLUS,
  };
  if (typeof window !== 'undefined') {
    window.trustState = localTrustState;
  }
}

export function getLocalTrustState() {
  return localTrustState;
}

/**
 * @param {HTMLElement} el
 * @param {string} [buildTrust]
 */
export function applyBuildTrustClass(el, buildTrust) {
  if (!el) return;
  const level = buildTrust || BUILD_TRUST.UNVERIFIED_BUILD;
  el.classList.remove('build-trust-official', 'build-trust-unverified');
  if (level === BUILD_TRUST.VERIFIED_OFFICIAL) {
    el.classList.add('build-trust-official');
    el.removeAttribute('title');
    el.removeAttribute('data-i18n-title');
  } else {
    el.classList.add('build-trust-unverified');
    el.dataset.i18nTitle = 'trust.unofficial_build_tooltip';
    el.title = t('trust.unofficial_build_tooltip');
  }
}

/**
 * @param {HTMLElement} el
 * @param {string} [meshPlusTrust]
 * @param {boolean} [active]
 */
export function applyMeshPlusTrustClass(el, meshPlusTrust, active = true) {
  if (!el) return;
  el.classList.remove('meshplus-official', 'meshplus-unverified');
  if (!active) return;
  if (meshPlusTrust === MESH_TRUST.OFFICIAL_MESH_PLUS) {
    el.classList.add('meshplus-official');
    el.removeAttribute('title');
    el.removeAttribute('data-i18n-title');
  } else {
    el.classList.add('meshplus-unverified');
    el.dataset.i18nTitle = 'trust.unofficial_mesh_tooltip';
    el.title = t('trust.unofficial_mesh_tooltip');
  }
}

/**
 * @param {number} blipId
 * @param {number} scale
 * @param {object} opts
 * @param {object} [peer]
 */
export function createTrustedAvatarElement(blipId, scale, opts, peer) {
  const ring = document.createElement('div');
  ring.className = 'avatar-trust-ring';
  const buildTrust = peer?.buildTrust || BUILD_TRUST.UNVERIFIED_BUILD;
  applyBuildTrustClass(ring, buildTrust);
  ring.appendChild(createAvatarElement(blipId, scale, opts));
  return ring;
}

/**
 * @param {HTMLElement} badge
 * @param {object} [peer]
 */
export function applyPeerMeshPlusBadgeTrust(badge, peer) {
  if (!badge) return;
  badge.classList.remove('mesh-plus-badge--trust-unverified');
  if (!peer?.meshPlus) return;
  if (peer.meshPlusTrust !== MESH_TRUST.OFFICIAL_MESH_PLUS) {
    badge.classList.add('mesh-plus-badge--trust-unverified');
    badge.dataset.i18nTitle = 'trust.unofficial_mesh_tooltip';
    badge.title = t('trust.unofficial_mesh_tooltip');
  }
}
