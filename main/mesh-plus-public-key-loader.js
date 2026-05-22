import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let cached;

function readKeyFile(p) {
  try {
    if (!existsSync(p)) return '';
    return readFileSync(p, 'utf8').trim();
  } catch {
    return '';
  }
}

function electronApp() {
  try {
    return require('electron')?.app ?? null;
  } catch {
    return null;
  }
}

/**
 * @returns {string | null}
 */
export function loadTrustAnchorB64() {
  if (cached !== undefined) return cached || null;

  const fromEnv = (process.env.BLIP_MESH_PUBLIC_KEY || '').trim();
  if (fromEnv) {
    cached = fromEnv;
    return cached;
  }

  const paths = [];
  const app = electronApp();

  if (app?.getPath) {
    paths.push(join(app.getPath('userData'), 'mesh-plus-public-key.txt'));
    if (app.isPackaged) {
      paths.push(join(process.resourcesPath, 'mesh-plus-public-key.txt'));
      try {
        paths.push(join(dirname(app.getPath('exe')), 'mesh-plus-public-key.txt'));
      } catch {
        /* ignore */
      }
    } else {
      paths.push(join(process.cwd(), 'mesh-plus-public-key.local'));
      try {
        paths.push(join(app.getAppPath(), '..', 'mesh-plus-public-key.local'));
      } catch {
        /* ignore */
      }
      paths.push(join(process.cwd(), 'build', 'mesh-plus-public-key.txt'));
    }
  } else {
    paths.push(join(process.cwd(), 'mesh-plus-public-key.local'));
    paths.push(join(process.cwd(), 'build', 'mesh-plus-public-key.txt'));
  }

  for (const p of paths) {
    const k = readKeyFile(p);
    if (k) {
      cached = k;
      return cached;
    }
  }

  cached = '';
  return null;
}

export function resetTrustAnchorCache() {
  cached = undefined;
}
