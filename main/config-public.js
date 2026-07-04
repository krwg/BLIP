import { resolveProductTier, resolveEntitlementState } from './mesh-plus-license.js';

const SENSITIVE_KEYS = new Set(['meshPrivateKey', 'meshPlusLicenseSig']);

export function toPublicConfig(config) {
  if (!config || typeof config !== 'object') return config;
  const pub = { ...config };
  for (const key of SENSITIVE_KEYS) delete pub[key];
  pub.tier = resolveProductTier(config);
  pub.meshPlusActive = resolveEntitlementState(config);
  if (pub.meshPlusLicenseId) {
    pub.meshPlusLicenseMasked = `••••-${String(pub.meshPlusLicenseId).slice(-4)}`;
  } else {
    pub.meshPlusLicenseMasked = '';
  }
  delete pub.meshPlusLicenseId;
  return pub;
}
