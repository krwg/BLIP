#!/usr/bin/env node

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
} from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  formatEntitlementDisplay,
  ENTITLEMENT_CANON,
} from '../main/entitlement-codec.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PRIV_PATH = join(__dirname, '.mesh-plus-private.b64');

function publicKeyB64FromPrivate(privateKey) {
  const pub = createPublicKey(privateKey);
  return pub.export({ type: 'spki', format: 'der' }).toString('base64');
}

function loadOrCreatePrivateKey(path) {
  if (existsSync(path)) {
    const b64 = readFileSync(path, 'utf8').trim();
    const privateKey = createPrivateKey({
      key: Buffer.from(b64, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
    return { privateKey, created: false };
  }
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privB64 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  writeFileSync(path, `${privB64}\n`, 'utf8');
  console.log(`[mesh-plus-keygen] Wrote new private key → ${path}`);
  const pubB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  return { privateKey, created: true, pubB64 };
}

const privArg = process.argv.indexOf('--private-key');
const privPath = privArg >= 0 ? process.argv[privArg + 1] : DEFAULT_PRIV_PATH;
const { privateKey: pk, created, pubB64: pubOnCreate } = loadOrCreatePrivateKey(privPath);
const pubB64 = pubOnCreate || publicKeyB64FromPrivate(pk);

console.log('--- Trust anchor (for .env.build → BLIP_MESH_PUBLIC_KEY) ---');
console.log(pubB64);
console.log('---');

const licenseId8 = randomBytes(8);
const licenseId = licenseId8.toString('hex').toUpperCase();
const canonical = `${ENTITLEMENT_CANON}|${licenseId}`;
const sig = sign(null, Buffer.from(canonical, 'utf8'), pk);
const sigB64 = sig.toString('base64');
const displayKey = formatEntitlementDisplay(licenseId, sigB64);

console.log('--- MESH+ license (give to one user) ---');
console.log(displayKey);
console.log('---');
console.log(`licenseId: ${licenseId}`);
