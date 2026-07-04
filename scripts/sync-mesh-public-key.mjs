
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'build', 'mesh-plus-public-key.txt');
const localPath = join(root, 'mesh-plus-public-key.local');
const envBuildPath = join(root, '.env.build');

function parseEnvBuild() {
  if (!existsSync(envBuildPath)) return '';
  const raw = readFileSync(envBuildPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^BLIP_MESH_PUBLIC_KEY\s*=\s*(.+)$/);
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return '';
}

function readKey() {
  const fromEnv = (process.env.BLIP_MESH_PUBLIC_KEY || '').trim();
  if (fromEnv) return fromEnv;
  const fromBuild = parseEnvBuild();
  if (fromBuild) return fromBuild;
  if (existsSync(localPath)) {
    return readFileSync(localPath, 'utf8').trim();
  }
  return '';
}

const key = readKey();
mkdirSync(join(root, 'build'), { recursive: true });

writeFileSync(outPath, key ? `${key}\n` : '', 'utf8');
if (key) {
  console.log('[sync-mesh-public-key] wrote build/mesh-plus-public-key.txt');
} else {
  console.log('[sync-mesh-public-key] wrote empty build/mesh-plus-public-key.txt');
}
