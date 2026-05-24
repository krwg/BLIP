import { createHash, randomBytes } from 'crypto';
import { stat, open, readFile } from 'fs/promises';
import { rename, rm } from 'fs/promises';
import { basename, extname, join } from 'path';
import { getSeedDir, writeSeedMeta, seedDirExists } from './beacon-store.js';
import { mkdir, writeFile } from 'fs/promises';

const WRITE_POOL = 8;

function chunkFilePath(seedDir, chunkIndex) {
  return join(seedDir, `chunk-${String(chunkIndex).padStart(5, '0')}`);
}

async function writeRawChunk(seedId, chunkIndex, buf) {
  const dir = getSeedDir(seedId);
  await mkdir(dir, { recursive: true });
  await writeFile(chunkFilePath(dir, chunkIndex), buf);
}

async function finalizeStagingSeed(stagingId, seedId, meta) {
  const stagingDir = getSeedDir(stagingId);
  const targetDir = getSeedDir(seedId);
  if (stagingId === seedId) {
    await writeSeedMeta(seedId, meta);
    return;
  }
  if (await seedDirExists(seedId)) {
    try {
      await rm(stagingDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  } else {
    try {
      await rename(stagingDir, targetDir);
    } catch {
      try {
        await rm(stagingDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
  await writeSeedMeta(seedId, meta);
}

function guessMime(filename) {
  const ext = extname(filename || '').toLowerCase();
  const map = {
    '.zip': 'application/zip',
    '.7z': 'application/x-7z-compressed',
    '.rar': 'application/vnd.rar',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.exe': 'application/octet-stream',
    '.iso': 'application/octet-stream',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Ingest a file from disk into seed storage (single pass: hash + write).
 * @param {string} filePath
 * @param {{ chunkSize?: number, maxBytes?: number, onProgress?: (p: { phase: string, percent?: number }) => void }} [opts]
 */
export async function ingestPublishFromPath(filePath, opts = {}) {
  const chunkSize = opts.chunkSize || 1048576;
  const onProgress = opts.onProgress;

  let st;
  try {
    st = await stat(filePath);
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? e.code : '';
    if (code === 'ENOENT') throw new Error('not_found');
    if (code === 'EACCES' || code === 'EPERM') throw new Error('not_readable');
    throw new Error('not_readable');
  }
  if (!st.isFile()) throw new Error('not_file');
  if (st.size <= 0) throw new Error('empty');
  if (opts.maxBytes && st.size > opts.maxBytes) throw new Error('too_large');

  const filename = basename(filePath);
  const totalChunks = Math.ceil(st.size / chunkSize);
  const stagingId = `ing_${randomBytes(8).toString('hex')}`;
  const hash = createHash('sha256');

  onProgress?.({ phase: 'hashing', percent: 4 });

  const fh = await open(filePath, 'r');

  try {
    for (let batchStart = 0; batchStart < totalChunks; batchStart += WRITE_POOL) {
      const writes = [];
      const batchEnd = Math.min(batchStart + WRITE_POOL, totalChunks);
      for (let i = batchStart; i < batchEnd; i++) {
        const offset = i * chunkSize;
        const len = Math.min(chunkSize, st.size - offset);
        const buf = Buffer.allocUnsafe(len);
        const { bytesRead } = await fh.read(buf, 0, len, offset);
        if (bytesRead <= 0) throw new Error('read');
        const slice = buf.subarray(0, bytesRead);
        hash.update(slice);
        writes.push(writeRawChunk(stagingId, i, slice));
      }
      await Promise.all(writes);
      const pct = Math.round(4 + (batchEnd / totalChunks) * 88);
      onProgress?.({ phase: 'publishing', percent: pct });
    }
  } finally {
    await fh.close();
  }

  const seedId = hash.digest('hex').slice(0, 16);
  const meta = {
    seedId,
    filename,
    size: st.size,
    chunkSize,
    totalChunks,
    mime: guessMime(filename),
    publishedAt: Date.now(),
  };

  await finalizeStagingSeed(stagingId, seedId, meta);
  onProgress?.({ phase: 'ready', percent: 100 });
  return meta;
}

/** Small image preview (optional). */
export async function tryReadImagePreviewB64(filePath, maxBytes = 8 * 1024 * 1024) {
  const ext = extname(filePath).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) return null;
  try {
    const st = await stat(filePath);
    if (st.size > maxBytes) return null;
    const buf = await readFile(filePath);
    return buf.toString('base64');
  } catch {
    return null;
  }
}
