import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mcSrc = join(root, 'node_modules/typeface-minecraft/files');
const cyrSrc = join(
  root,
  'node_modules/@fontsource/press-start-2p/files/press-start-2p-cyrillic-400-normal.woff2'
);
const destDir = join(root, 'renderer/assets/fonts');

const copies = [
  { from: join(mcSrc, 'minecraft.woff2'), to: join(destDir, 'minecraft.woff2') },
  { from: join(mcSrc, 'minecraft.ttf'), to: join(destDir, 'minecraft.ttf') },
  { from: cyrSrc, to: join(destDir, 'minecraft-cyrillic.woff2') },
];

if (!existsSync(mcSrc)) {
  console.warn('[copy-fonts] typeface-minecraft not installed — skip latin');
}

mkdirSync(destDir, { recursive: true });
let n = 0;
for (const { from, to } of copies) {
  if (!existsSync(from)) {
    console.warn('[copy-fonts] missing', from);
    continue;
  }
  copyFileSync(from, to);
  n += 1;
}
console.log(`[copy-fonts] ${n} font file(s) → renderer/assets/fonts`);
