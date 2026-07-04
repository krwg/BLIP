
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'dist-electron');
if (!existsSync(outDir)) {
  console.error('[publish-release-notes] Run npm run electron:build:all first.');
  process.exit(1);
}

const required = ['latest.yml'];
const optional = (name) =>
  name.endsWith('.exe') && (name.includes('Setup') || name.includes('Portable'));

const files = readdirSync(outDir).filter(
  (f) => required.includes(f) || optional(f)
);

console.log('\nAttach to GitHub Release (same tag as package.json version):\n');
for (const f of files.sort()) {
  console.log(`  dist-electron/${f}`);
}
console.log('\nRequired for in-app auto-update: latest.yml + BLIP-Setup-<version>.exe\n');
