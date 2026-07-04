import { verifyCanonical } from './mesh-identity.js';
import { TRUST_ANCHOR_B64 } from './mesh-plus-public-key.js';
import {
  ENTITLEMENT_CANON,
  normalizeEntitlementInput,
  parseEntitlementBlob,
  formatEntitlementDisplay,
} from './entitlement-codec.js';

export {
  ENTITLEMENT_CANON,
  normalizeEntitlementInput,
  parseEntitlementBlob,
  formatEntitlementDisplay,
};

export function verifyEntitlementDigest(parsed) {
  if (!parsed?.licenseId || !parsed.sigB64) return false;
  const pub = TRUST_ANCHOR_B64;
  if (!pub) return false;
  const canonical = `${ENTITLEMENT_CANON}|${parsed.licenseId}`;
  return verifyCanonical(pub, canonical, parsed.sigB64);
}

export function resolveEntitlementState(config) {
  if (!config?.meshPlusLicenseId || !config?.meshPlusLicenseSig) return false;
  return verifyEntitlementDigest({
    licenseId: config.meshPlusLicenseId,
    sigB64: config.meshPlusLicenseSig,
  });
}

export function resolveProductTier(config) {
  return resolveEntitlementState(config) ? 'mesh_plus' : 'free';
}

export function confirmEntitlementBlob(rawKey) {
  const parsed = parseEntitlementBlob(rawKey);
  if (!parsed) {
    return { ok: false, error: 'invalid_format' };
  }
  if (!verifyEntitlementDigest(parsed)) {
    return { ok: false, error: 'invalid_signature' };
  }
  return { ok: true, licenseId: parsed.licenseId, sigB64: parsed.sigB64 };
}
