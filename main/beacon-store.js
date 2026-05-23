import { app } from 'electron';
import { join } from 'path';
import { mkdir } from 'fs/promises';

export function getBeaconSeedsRoot() {
  return join(app.getPath('userData'), 'seeds');
}

export function getSeedDir(seedId) {
  const safe = String(seedId || '')
    .replace(/[^a-f0-9]/gi, '')
    .slice(0, 64);
  return join(getBeaconSeedsRoot(), safe || 'unknown');
}

export async function ensureBeaconSeedsRoot() {
  const root = getBeaconSeedsRoot();
  await mkdir(root, { recursive: true });
  return root;
}
