import { app } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

export function resolveBuildAsset(filename) {
  const normalized = filename.replace(/\\/g, '/');

  if (app.isPackaged) {

    const prodPath = normalized.startsWith('icons/')
      ? join(process.resourcesPath, normalized)
      : join(process.resourcesPath, 'icons', normalized);
    if (existsSync(prodPath)) return prodPath;
    return prodPath;
  }

  const devPath = join(rootDir, 'build', normalized);
  return devPath;
}
