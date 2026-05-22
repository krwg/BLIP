import { t } from './i18n.js';
import { createAvatarElement } from './avatar.js';
import { BUILD_TRUST, MESH_TRUST, OFFICIAL_BUILD_ISSUER } from '../shared/trust-levels.js';

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
  /* window.trustState is read-only (contextBridge). Updates come from preload IPC only. */
}

export function getLocalTrustState() {
  if (localTrustState) return localTrustState;
  const live = typeof window !== 'undefined' ? window.trustState : null;
  if (!live) return null;
  return {
    buildTrust: live.buildTrust || BUILD_TRUST.UNVERIFIED_BUILD,
    meshPlusTrust: live.meshPlusTrust || MESH_TRUST.UNVERIFIED_MESH_PLUS,
  };
}

export function isOfficialBuildTrust(buildTrust) {
  return buildTrust === BUILD_TRUST.VERIFIED_OFFICIAL;
}

/**
 * MESH+ badge / card styling: license + peer build trust (LAN announce or local).
 * @param {object} [peer]
 * @returns {string | null}
 */
export function resolvePeerMeshPlusTrust(peer) {
  if (!peer?.meshPlus) return null;
  if (peer.meshPlusTrust === MESH_TRUST.OFFICIAL_MESH_PLUS) {
    return MESH_TRUST.OFFICIAL_MESH_PLUS;
  }
  if (peer.meshPlusTrust === MESH_TRUST.UNVERIFIED_MESH_PLUS) {
    return MESH_TRUST.UNVERIFIED_MESH_PLUS;
  }
  if (peer.buildTrust === BUILD_TRUST.VERIFIED_OFFICIAL) {
    return MESH_TRUST.OFFICIAL_MESH_PLUS;
  }
  if (
    peer.buildVerified &&
    String(peer.buildIssuer || '') === OFFICIAL_BUILD_ISSUER
  ) {
    return MESH_TRUST.OFFICIAL_MESH_PLUS;
  }
  return MESH_TRUST.UNVERIFIED_MESH_PLUS;
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
 * Square notice in Settings → About (build trust, not MESH+ key).
 * @param {HTMLElement} parent
 */
export function appendAboutBuildTrustNotice(parent) {
  const trust = getLocalTrustState();
  const official = isOfficialBuildTrust(trust?.buildTrust);
  const box = document.createElement('div');
  box.className = `settings-about-trust-notice${
    official
      ? ' settings-about-trust-notice--official'
      : ' settings-about-trust-notice--unofficial'
  }`;
  const key = official ? 'trust.about_official_client' : 'trust.about_unofficial_client';
  box.dataset.i18n = key;
  box.textContent = t(key);
  parent.appendChild(box);
  return box;
}

/**
 * Avatars no longer use colored build-trust rings (see About notice).
 * @param {number} blipId
 * @param {number} scale
 * @param {object} opts
 */
export function createTrustedAvatarElement(blipId, scale, opts) {
  return createAvatarElement(blipId, scale, opts);
}

/**
 * @param {HTMLElement} badge
 * @param {object} [peer]
 */
export function applyPeerMeshPlusBadgeTrust(badge, peer) {
  if (!badge) return;
  badge.classList.remove(
    'mesh-plus-badge--trust-official',
    'mesh-plus-badge--trust-unverified'
  );
  if (!peer?.meshPlus) return;
  const meshTrust = resolvePeerMeshPlusTrust(peer);
  if (meshTrust === MESH_TRUST.OFFICIAL_MESH_PLUS) {
    badge.classList.add('mesh-plus-badge--trust-official');
    badge.removeAttribute('title');
    badge.removeAttribute('data-i18n-title');
    return;
  }
  badge.classList.add('mesh-plus-badge--trust-unverified');
  badge.dataset.i18nTitle = 'trust.unofficial_mesh_tooltip';
  badge.title = t('trust.unofficial_mesh_tooltip');
}
