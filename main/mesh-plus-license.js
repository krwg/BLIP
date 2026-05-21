import { verifyCanonical } from './mesh-identity.js';
import { MESH_PLUS_LICENSE_PUBLIC_KEY_B64 } from './mesh-plus-public-key.js';

export const MESH_PLUS_LICENSE_CANON = 'blip-meshplus-v1';
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LICENSE_BODY_BYTES = 72; // 8-byte id + 64-byte Ed25519 signature

function base32DecodeChar(c) {
  const i = CROCKFORD.indexOf(c);
  return i >= 0 ? i : -1;
}

/** @param {string} encoded */
function base32Decode(encoded) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of encoded) {
    const v = base32DecodeChar(ch);
    if (v < 0) return null;
    value = (value << 5) | v;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

/** @param {Buffer} buf */
function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += CROCKFORD[(value >> bits) & 31];
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

/** @param {string} body */
function formatBlipKey(body) {
  const groups = body.match(/.{1,4}/g) || [];
  return `BLIP-${groups.join('-')}`;
}

/**
 * @param {string} raw
 * @returns {string | null}
 */
export function normalizeMeshPlusKeyInput(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (s.startsWith('BLIP')) s = s.replace(/^BLIP-?/, '');
  s = s.replace(/-/g, '');
  if (!s || !/^[0-9A-HJKMNP-Z]+$/.test(s)) return null;
  return s;
}

/**
 * @param {string} raw
 * @returns {{ licenseId: string, sigB64: string } | null}
 */
export function parseMeshPlusLicenseKey(raw) {
  const encoded = normalizeMeshPlusKeyInput(raw);
  if (!encoded) return null;
  const buf = base32Decode(encoded);
  if (!buf || buf.length !== LICENSE_BODY_BYTES) return null;
  const licenseId = buf.subarray(0, 8).toString('hex').toUpperCase();
  const sig = buf.subarray(8, 72);
  return {
    licenseId,
    sigB64: sig.toString('base64'),
  };
}

/**
 * @param {{ licenseId: string, sigB64: string }} parsed
 */
export function verifyMeshPlusLicenseParsed(parsed) {
  if (!parsed?.licenseId || !parsed.sigB64) return false;
  const canonical = `${MESH_PLUS_LICENSE_CANON}|${parsed.licenseId}`;
  return verifyCanonical(
    MESH_PLUS_LICENSE_PUBLIC_KEY_B64,
    canonical,
    parsed.sigB64
  );
}

/** @param {object} config */
export function isMeshPlusActive(config) {
  if (!config?.meshPlusLicenseId || !config?.meshPlusLicenseSig) return false;
  return verifyMeshPlusLicenseParsed({
    licenseId: config.meshPlusLicenseId,
    sigB64: config.meshPlusLicenseSig,
  });
}

/** @returns {'free' | 'mesh_plus'} */
export function getMeshPlusTier(config) {
  return isMeshPlusActive(config) ? 'mesh_plus' : 'free';
}

/**
 * Build display key for a parsed license (for keygen).
 * @param {string} licenseId hex 16 chars
 * @param {string} sigB64
 */
export function formatMeshPlusLicenseKey(licenseId, sigB64) {
  const idBuf = Buffer.from(licenseId, 'hex');
  if (idBuf.length !== 8) throw new Error('licenseId must be 16 hex chars');
  const sigBuf = Buffer.from(sigB64, 'base64');
  if (sigBuf.length !== 64) throw new Error('signature must be 64 bytes');
  const body = base32Encode(Buffer.concat([idBuf, sigBuf]));
  return formatBlipKey(body);
}

/**
 * @param {string} rawKey
 * @returns {{ ok: boolean, error?: string, licenseId?: string, sigB64?: string }}
 */
export function validateMeshPlusActivationKey(rawKey) {
  const parsed = parseMeshPlusLicenseKey(rawKey);
  if (!parsed) {
    return { ok: false, error: 'invalid_format' };
  }
  if (!verifyMeshPlusLicenseParsed(parsed)) {
    return { ok: false, error: 'invalid_signature' };
  }
  return { ok: true, licenseId: parsed.licenseId, sigB64: parsed.sigB64 };
}
