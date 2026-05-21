#!/usr/bin/env node
/**
 * Generate a MESH+ license key (run locally only — never commit private keys).
 *
 *   node scripts/mesh-plus-keygen.mjs
 *   node scripts/mesh-plus-keygen.mjs --private-key path/to/mesh-plus-private.b64
 *
 * Writes optional private key to scripts/.mesh-plus-private.b64 (gitignored).
 */
import { createPrivateKey, generateKeyPairSync, randomBytes, sign } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  formatMeshPlusLicenseKey,
  MESH_PLUS_LICENSE_CANON,
} from '../main/mesh-plus-license.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PRIV_PATH = join(__dirname, '.mesh-plus-private.b64');

function loadOrCreatePrivateKey(path) {
  if (existsSync(path)) {
    const b64 = readFileSync(path, 'utf8').trim();
    return createPrivateKey({
      key: Buffer.from(b64, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
  }
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privB64 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  const pubB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  writeFileSync(path, `${privB64}\n`, 'utf8');
  console.log(`[mesh-plus-keygen] Wrote new private key → ${path}`);
  console.log(`[mesh-plus-keygen] Public key (embed in mesh-plus-public-key.js if rotated):\n${pubB64}\n`);
  return privateKey;
}

const privArg = process.argv.indexOf('--private-key');
const privPath = privArg >= 0 ? process.argv[privArg + 1] : DEFAULT_PRIV_PATH;
const pk = loadOrCreatePrivateKey(privPath);

const licenseId8 = randomBytes(8);
const licenseId = licenseId8.toString('hex').toUpperCase();
const canonical = `${MESH_PLUS_LICENSE_CANON}|${licenseId}`;
const sig = sign(null, Buffer.from(canonical, 'utf8'), pk);
const sigB64 = sig.toString('base64');
const displayKey = formatMeshPlusLicenseKey(licenseId, sigB64);

console.log('--- MESH+ license (give to one user) ---');
console.log(displayKey);
console.log('---');
console.log(`licenseId: ${licenseId}`);
