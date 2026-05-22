/**
 * Signs build/build-info.json for packaged official builds.
 * Uses scripts/.mesh-plus-private.b64 (same maintainer key as MESH+ keygen).
 */
import { createHash, createPrivateKey, sign } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const privPath = join(root, 'scripts', '.mesh-plus-private.b64');
const metaPath = join(root, 'app-metadata.json');
const outPath = join(root, 'build', 'build-info.json');
const pubPath = join(root, 'build', 'mesh-plus-public-key.txt');

const ISSUER = 'krwg-official';

function readPriv() {
  const fromEnv = (process.env.BLIP_BUILD_SIGN_KEY_B64 || '').trim();
  if (fromEnv) {
    return createPrivateKey({
      key: Buffer.from(fromEnv, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
  }
  if (!existsSync(privPath)) return null;
  const b64 = readFileSync(privPath, 'utf8').trim();
  return createPrivateKey({
    key: Buffer.from(b64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
}

function readVersion() {
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    return String(meta.version || '0.0.0');
  } catch {
    return '0.0.0';
  }
}

function readPubHash() {
  const fromEnv = (process.env.BLIP_MESH_PUBLIC_KEY || '').trim();
  let pub = fromEnv;
  if (!pub && existsSync(pubPath)) {
    pub = readFileSync(pubPath, 'utf8').trim();
  }
  if (!pub) return '';
  return createHash('sha256').update(pub, 'utf8').digest('hex').slice(0, 16);
}

const pk = readPriv();
mkdirSync(join(root, 'build'), { recursive: true });

if (!pk) {
  writeFileSync(outPath, '{}\n', 'utf8');
  console.log('[sync-build-info] no signing key — wrote empty build/build-info.json');
  process.exit(0);
}

const version = readVersion();
const buildTimestamp = Date.now();
const canonical = `BLIP|${version}|${ISSUER}|${buildTimestamp}`;
const buildSignature = sign(null, Buffer.from(canonical, 'utf8'), pk).toString('base64');

const payload = {
  issuer: ISSUER,
  version,
  buildTimestamp,
  buildSignature,
  meshPlusPublicKeyHash: readPubHash(),
};

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log('[sync-build-info] wrote build/build-info.json');
