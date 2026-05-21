import { app } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

export function resolveBuildAsset(filename) {
  const normalized = filename.replace(/\\/g, '/');
  const devPath = join(rootDir, 'build', normalized);
  if (existsSync(devPath)) return devPath;
  if (app.isPackaged) {
    const prodPath = join(process.resourcesPath, 'icons', normalized);
    if (existsSync(prodPath)) return prodPath;
    const flatProd = join(process.resourcesPath, 'icons', filename);
    if (existsSync(flatProd)) return flatProd;
  }
  return devPath;
}
