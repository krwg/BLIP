import {
  BUILD_TRUST,
  MESH_TRUST,
  OFFICIAL_BUILD_ISSUER,
} from '../shared/trust-levels.js';
import { verifyBuildAtStartup } from './verify-build.js';
import { resolveEntitlementState } from './mesh-plus-license.js';

let appTrustState = {
  buildTrust: BUILD_TRUST.UNVERIFIED_BUILD,
  meshPlusTrust: MESH_TRUST.UNVERIFIED_MESH_PLUS,
  buildIssuer: '',
  buildVersion: '',
};

export function initAppTrustState(config) {
  const build = verifyBuildAtStartup();
  const buildTrust = build.verified
    ? BUILD_TRUST.VERIFIED_OFFICIAL
    : BUILD_TRUST.UNVERIFIED_BUILD;

  const licenseOk = resolveEntitlementState(config);
  let meshPlusTrust = MESH_TRUST.UNVERIFIED_MESH_PLUS;
  if (licenseOk) {
    meshPlusTrust =
      buildTrust === BUILD_TRUST.VERIFIED_OFFICIAL
        ? MESH_TRUST.OFFICIAL_MESH_PLUS
        : MESH_TRUST.UNVERIFIED_MESH_PLUS;
  }

  appTrustState = {
    buildTrust,
    meshPlusTrust,
    buildIssuer: build.issuer || '',
    buildVersion: build.version || '',
  };
  return getAppTrustState();
}

export function getAppTrustState() {
  return {
    buildTrust: appTrustState.buildTrust,
    meshPlusTrust: appTrustState.meshPlusTrust,
  };
}

export function getBuildAnnounceTrust() {
  const official = appTrustState.buildTrust === BUILD_TRUST.VERIFIED_OFFICIAL;
  return {
    buildVerified: official,
    buildIssuer: official ? OFFICIAL_BUILD_ISSUER : appTrustState.buildIssuer || 'unknown',
    buildVersion: appTrustState.buildVersion || '',
    meshPlusTrust: appTrustState.meshPlusTrust,
  };
}

export function peerBuildTrustFromAnnounce(data) {
  if (data?.buildVerified && String(data.buildIssuer) === OFFICIAL_BUILD_ISSUER) {
    return BUILD_TRUST.VERIFIED_OFFICIAL;
  }
  return BUILD_TRUST.UNVERIFIED_BUILD;
}

export function peerMeshPlusTrustFromAnnounce(data) {
  if (!data?.meshPlus) return null;
  if (
    data.buildVerified &&
    String(data.buildIssuer) === OFFICIAL_BUILD_ISSUER
  ) {
    return MESH_TRUST.OFFICIAL_MESH_PLUS;
  }
  return MESH_TRUST.UNVERIFIED_MESH_PLUS;
}

export function refreshMeshPlusTrust(config) {
  const licenseOk = resolveEntitlementState(config);
  if (!licenseOk) {
    appTrustState.meshPlusTrust = MESH_TRUST.UNVERIFIED_MESH_PLUS;
  } else {
    appTrustState.meshPlusTrust =
      appTrustState.buildTrust === BUILD_TRUST.VERIFIED_OFFICIAL
        ? MESH_TRUST.OFFICIAL_MESH_PLUS
        : MESH_TRUST.UNVERIFIED_MESH_PLUS;
  }
  return getAppTrustState();
}
