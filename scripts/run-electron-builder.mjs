/**
 * Runs electron-builder; ignores CSC_LINK / WIN_CSC_LINK when the path is missing
 * (e.g. leftover placeholder C:\path\to\krwg.pfx from docs).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('[run-electron-builder] usage: node scripts/run-electron-builder.mjs --win [--dir] …');
  process.exit(1);
}

for (const key of ['CSC_LINK', 'WIN_CSC_LINK']) {
  const val = (process.env[key] || '').trim();
  if (!val) continue;
  if (val.startsWith('base64:')) continue;
  if (!existsSync(val)) {
    console.warn(`[run-electron-builder] unset ${key} — not found: ${val}`);
    delete process.env[key];
    if (key === 'CSC_LINK') delete process.env.CSC_KEY_PASSWORD;
  }
}

const r = spawnSync('npx', ['electron-builder', ...args], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
process.exit(r.status ?? 1);
