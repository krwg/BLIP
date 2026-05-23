import { app, dialog } from 'electron';
import { join } from 'path';
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  access,
  open,
} from 'fs/promises';
import { constants } from 'fs';

export function getBeaconSeedsRoot() {
  return join(app.getPath('userData'), 'seeds');
}

export function getSeedDir(seedId) {
  const safe = String(seedId || '')
    .replace(/[^a-f0-9]/gi, '')
    .slice(0, 64);
  return join(getBeaconSeedsRoot(), safe || 'unknown');
}

function chunkPath(seedDir, chunkIndex) {
  return join(seedDir, `chunk-${String(chunkIndex).padStart(5, '0')}`);
}

export async function ensureBeaconSeedsRoot() {
  const root = getBeaconSeedsRoot();
  await mkdir(root, { recursive: true });
  return root;
}

export async function writeSeedMeta(seedId, meta) {
  const dir = getSeedDir(seedId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
}

export async function readSeedMeta(seedId) {
  try {
    const raw = await readFile(join(getSeedDir(seedId), 'meta.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeSeedChunk(seedId, chunkIndex, base64Data) {
  const dir = getSeedDir(seedId);
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(String(base64Data || ''), 'base64');
  await writeFile(chunkPath(dir, chunkIndex), buf);
}

export async function readSeedChunk(seedId, chunkIndex) {
  const buf = await readFile(chunkPath(getSeedDir(seedId), chunkIndex));
  return buf.toString('base64');
}

export async function chunkExists(seedId, chunkIndex) {
  try {
    await access(chunkPath(getSeedDir(seedId), chunkIndex), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function countLocalChunks(seedId, totalChunks) {
  let n = 0;
  for (let i = 0; i < totalChunks; i++) {
    if (await chunkExists(seedId, i)) n++;
  }
  return n;
}

export async function listLocalSeedMetas() {
  const root = await ensureBeaconSeedsRoot();
  let entries = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const metas = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const meta = await readSeedMeta(e.name);
    if (meta) metas.push(meta);
  }
  return metas;
}

export async function assembleSeedToPath(seedId, filePath) {
  const meta = await readSeedMeta(seedId);
  if (!meta) throw new Error('no_meta');
  const total = Number(meta.totalChunks) || 0;
  for (let i = 0; i < total; i++) {
    if (!(await chunkExists(seedId, i))) throw new Error('incomplete');
  }
  const fh = await open(filePath, 'w');
  try {
    for (let i = 0; i < total; i++) {
      const buf = await readFile(chunkPath(getSeedDir(seedId), i));
      await fh.write(buf);
    }
  } finally {
    await fh.close();
  }
}

export async function promptSaveAssembledSeed(seedId, defaultName) {
  const meta = await readSeedMeta(seedId);
  if (!meta) return { ok: false, error: 'no_meta' };
  const total = Number(meta.totalChunks) || 0;
  for (let i = 0; i < total; i++) {
    if (!(await chunkExists(seedId, i))) {
      return { ok: false, error: 'incomplete' };
    }
  }
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName || meta.filename || 'download',
  });
  if (canceled || !filePath) return { ok: false, cancelled: true };
  await assembleSeedToPath(seedId, filePath);
  return { ok: true, filePath };
}
