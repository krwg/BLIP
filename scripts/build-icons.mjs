import sharp from 'sharp';
import toIco from 'to-ico';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'build');
const iconsDir = join(buildDir, 'icons');

const VARIANTS = [
  { id: 'main', file: 'icon-main.svg' },
  { id: 'dop-1', file: 'icon-dop-1.svg' },
  { id: 'dop-2', file: 'icon-dop-2.svg' },
  { id: 'dop-3', file: 'icon-dop-3.svg' },
  { id: 'dop-4', file: 'icon-dop-4.svg' },
  { id: 'mesh-1', file: 'icon-mesh1.svg' },
  { id: 'mesh-2', file: 'icon-mesh2.svg' },
  { id: 'mesh-3', file: 'icon-mesh3.svg' },
  { id: 'mesh-4', file: 'icon-mesh4.svg' },
  { id: 'mesh-5', file: 'icon-mesh5.svg' },
  { id: 'mesh-6', file: 'icon-mesh6.svg' },
];

const DEFAULT_ID = 'main';
const defaultVariant = VARIANTS.find((v) => v.id === DEFAULT_ID);
if (!defaultVariant) {
  console.error('[build-icons] main variant missing');
  process.exit(1);
}

const defaultSvgPath = join(root, defaultVariant.file);
if (!existsSync(defaultSvgPath)) {
  console.error('[build-icons] icon-main.svg not found at project root');
  process.exit(1);
}

mkdirSync(buildDir, { recursive: true });
mkdirSync(iconsDir, { recursive: true });

async function rasterizeVariant(variant) {
  const svgPath = join(root, variant.file);
  if (!existsSync(svgPath)) {
    console.warn(`[build-icons] skip ${variant.id}: ${variant.file} missing`);
    return null;
  }
  const svg = readFileSync(svgPath);
  const png256 = join(iconsDir, `${variant.id}.png`);
  const tray16 = join(iconsDir, `${variant.id}-tray.png`);
  await sharp(svg, { density: 288 })
    .resize(256, 256, { kernel: sharp.kernel.nearest })
    .png()
    .toFile(png256);
  await sharp(svg, { density: 288 })
    .resize(16, 16, { kernel: sharp.kernel.nearest })
    .png()
    .toFile(tray16);
  return { svg, png256, tray16 };
}

console.log('[build-icons] Rasterizing variants…');
const rasterized = new Map();
for (const variant of VARIANTS) {
  const out = await rasterizeVariant(variant);
  if (out) {
    rasterized.set(variant.id, out);
    console.log('[build-icons]', variant.id, '→', out.png256, out.tray16);
  }
}

const main = rasterized.get(DEFAULT_ID);
if (!main) {
  console.error('[build-icons] failed to build main icon');
  process.exit(1);
}

copyFileSync(defaultSvgPath, join(buildDir, 'icon.svg'));
copyFileSync(defaultSvgPath, join(root, 'icon.svg'));

const sizes = [256, 128, 64, 48, 32, 16];
const pngBuffers = await Promise.all(
  sizes.map((size) =>
    sharp(main.svg, { density: 288 })
      .resize(size, size, { kernel: sharp.kernel.nearest })
      .png()
      .toBuffer()
  )
);

const icoPath = join(buildDir, 'icon.ico');
writeFileSync(icoPath, await toIco(pngBuffers));
console.log('[build-icons] Wrote', icoPath);

copyFileSync(main.png256, join(buildDir, 'icon.png'));
console.log('[build-icons] Wrote', join(buildDir, 'icon.png'));

copyFileSync(main.tray16, join(buildDir, 'tray-16.png'));
console.log('[build-icons] Wrote', join(buildDir, 'tray-16.png'));
