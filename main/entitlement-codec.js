
export const ENTITLEMENT_CANON = 'blip-meshplus-v1';
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LICENSE_BODY_BYTES = 72;

function base32DecodeChar(c) {
  const i = CROCKFORD.indexOf(c);
  return i >= 0 ? i : -1;
}

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

function formatBlipKey(body) {
  const groups = body.match(/.{1,4}/g) || [];
  return `BLIP-${groups.join('-')}`;
}

export function normalizeEntitlementInput(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (s.startsWith('BLIP')) s = s.replace(/^BLIP-?/, '');
  s = s.replace(/-/g, '');
  if (!s || !/^[0-9A-HJKMNP-Z]+$/.test(s)) return null;
  return s;
}

export function parseEntitlementBlob(raw) {
  const encoded = normalizeEntitlementInput(raw);
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

export function formatEntitlementDisplay(licenseId, sigB64) {
  const idBuf = Buffer.from(licenseId, 'hex');
  if (idBuf.length !== 8) throw new Error('licenseId must be 16 hex chars');
  const sigBuf = Buffer.from(sigB64, 'base64');
  if (sigBuf.length !== 64) throw new Error('signature must be 64 bytes');
  const body = base32Encode(Buffer.concat([idBuf, sigBuf]));
  return formatBlipKey(body);
}
