import { existsSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { createRequire } from 'module';
import { verifyCanonical } from './mesh-identity.js';
import { TRUST_ANCHOR_B64 } from './mesh-plus-public-key.js';
import { OFFICIAL_BUILD_ISSUER } from '../shared/trust-levels.js';

const require = createRequire(import.meta.url);

function electronApp() {
  try {
    return require('electron')?.app ?? null;
  } catch {
    return null;
  }
}

function buildInfoPaths() {
  const paths = [];
  const app = electronApp();
  if (app?.isPackaged) {
    paths.push(join(process.resourcesPath, 'build-info.json'));
    try {
      paths.push(join(dirname(app.getPath('exe')), 'build-info.json'));
    } catch {

    }
  }
  paths.push(join(process.cwd(), 'build', 'build-info.json'));
  return paths;
}

function loadBuildInfo() {
  for (const p of buildInfoPaths()) {
    try {
      if (!existsSync(p)) continue;
      const raw = readFileSync(p, 'utf8');
      const o = JSON.parse(raw);
      if (o && typeof o === 'object' && o.buildSignature) return o;
    } catch {

    }
  }
  return null;
}

export function verifyBuildInfo(info) {
  if (!info?.buildSignature || !info?.issuer || !info?.version) return false;
  const pub = TRUST_ANCHOR_B64;
  if (!pub) return false;
  const ts = String(info.buildTimestamp ?? info.timestamp ?? '');
  const canonical = `BLIP|${info.version}|${info.issuer}|${ts}`;
  return verifyCanonical(pub, canonical, info.buildSignature);
}

export function verifyBuildAtStartup() {
  const info = loadBuildInfo();
  if (!info) {
    return { verified: false, issuer: '', version: '', meshPlusPublicKeyHash: '' };
  }
  const verified =
    verifyBuildInfo(info) && String(info.issuer) === OFFICIAL_BUILD_ISSUER;
  return {
    verified,
    issuer: String(info.issuer || ''),
    version: String(info.version || ''),
    meshPlusPublicKeyHash: String(info.meshPlusPublicKeyHash || ''),
  };
}

export function hashTrustAnchor(pubB64) {
  if (!pubB64) return '';
  return createHash('sha256').update(pubB64, 'utf8').digest('hex').slice(0, 16);
}
