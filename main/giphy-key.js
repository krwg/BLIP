import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { app } from 'electron';

let cached = '';

function readKeyFile(p) {
  try {
    if (!existsSync(p)) return '';
    return readFileSync(p, 'utf8').trim();
  } catch {
    return '';
  }
}

/**
 * Giphy API key: env → userData → packaged resources → dev giphy-api-key.local.
 */
export function getGiphyApiKey() {
  if (cached) return cached;
  const fromEnv = (
    process.env.BLIP_GIPHY_API_KEY ||
    process.env.GIPHY_API_KEY ||
    ''
  ).trim();
  if (fromEnv) {
    cached = fromEnv;
    return cached;
  }

  const paths = [join(app.getPath('userData'), 'giphy-api-key.txt')];

  if (app.isPackaged) {
    paths.push(join(process.resourcesPath, 'giphy-api-key.txt'));
    try {
      paths.push(join(dirname(app.getPath('exe')), 'giphy-api-key.txt'));
    } catch {
      /* ignore */
    }
  } else {
    paths.push(join(process.cwd(), 'giphy-api-key.local'));
    paths.push(join(app.getAppPath(), '..', 'giphy-api-key.local'));
  }

  for (const p of paths) {
    const k = readKeyFile(p);
    if (k) {
      cached = k;
      return cached;
    }
  }
  return '';
}

export function resetGiphyApiKeyCache() {
  cached = '';
}
