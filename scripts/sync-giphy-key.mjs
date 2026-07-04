
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'build', 'giphy-api-key.txt');
const localPath = join(root, 'giphy-api-key.local');

function readKey() {
  const fromEnv = (process.env.BLIP_GIPHY_API_KEY || process.env.GIPHY_API_KEY || '').trim();
  if (fromEnv) return fromEnv;
  if (existsSync(localPath)) {
    return readFileSync(localPath, 'utf8').trim();
  }
  return '';
}

const key = readKey();
mkdirSync(join(root, 'build'), { recursive: true });

writeFileSync(outPath, key ? `${key}\n` : '', 'utf8');
if (key) {
  console.log('[sync-giphy-key] wrote build/giphy-api-key.txt (from env or giphy-api-key.local)');
} else {
  console.log('[sync-giphy-key] wrote empty build/giphy-api-key.txt (Giphy tab off until key is set)');
}
