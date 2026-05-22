import { app } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Resolve assets under `build/` (dev) or `resources/icons/` (packaged extraResources).
 * @param {string} filename — e.g. `icon.png`, `tray-16.png`, `icons/mesh-3.png`
 */
export function resolveBuildAsset(filename) {
  const normalized = filename.replace(/\\/g, '/');

  if (app.isPackaged) {
    // electron-builder extraResources:
    //   build/icon.png, tray-16.png → resources/icons/
    //   build/icons/*             → resources/icons/*  (flat, not resources/icons/icons/)
    const prodPath = normalized.startsWith('icons/')
      ? join(process.resourcesPath, normalized)
      : join(process.resourcesPath, 'icons', normalized);
    if (existsSync(prodPath)) return prodPath;
    return prodPath;
  }

  const devPath = join(rootDir, 'build', normalized);
  return devPath;
}
