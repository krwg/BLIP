import { getMeshPlusTier, isMeshPlusActive } from './mesh-plus-license.js';

const SENSITIVE_KEYS = new Set(['meshPrivateKey', 'meshPlusLicenseSig']);

/**
 * Config safe for renderer IPC (no private keys / raw license sig).
 * @param {object} config
 */
export function toPublicConfig(config) {
  if (!config || typeof config !== 'object') return config;
  const pub = { ...config };
  for (const key of SENSITIVE_KEYS) delete pub[key];
  pub.tier = getMeshPlusTier(config);
  pub.meshPlusActive = isMeshPlusActive(config);
  if (pub.meshPlusLicenseId) {
    pub.meshPlusLicenseMasked = `••••-${String(pub.meshPlusLicenseId).slice(-4)}`;
  } else {
    pub.meshPlusLicenseMasked = '';
  }
  delete pub.meshPlusLicenseId;
  return pub;
}
