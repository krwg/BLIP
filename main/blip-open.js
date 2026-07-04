import { existsSync, readFileSync } from 'fs';

export function parseBlipSeedText(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const jsonStart = text.indexOf('{');
  if (jsonStart < 0) return null;
  let doc;
  try {
    doc = JSON.parse(text.slice(jsonStart));
  } catch {
    return null;
  }
  const seedId = String(doc?.seedId || '')
    .replace(/[^a-f0-9]/gi, '')
    .slice(0, 64);
  if (!seedId || doc?.type !== 'blip-seed') return null;
  return {
    seedId,
    filename: String(doc.filename || 'file'),
    size: Number(doc.size) || 0,
    chunkSize: Number(doc.chunkSize) || 0,
    totalChunks: Number(doc.totalChunks) || 0,
  };
}

export function isBlipFilePath(path) {
  return typeof path === 'string' && /\.blip$/i.test(path) && existsSync(path);
}

export function extractBlipFileFromArgv(argv) {
  for (const arg of argv || []) {
    if (!arg || arg.startsWith('-')) continue;
    const cleaned = arg.replace(/^"|"$/g, '');
    if (isBlipFilePath(cleaned)) return cleaned;
  }
  return null;
}

export function extractBlipSeedIdFromArgv(argv) {
  for (const arg of argv || []) {
    if (!arg || !arg.includes('blip://')) continue;
    const m = /blip:\/\/seed\/([a-f0-9]{8,64})/i.exec(arg);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

export function readBlipSeedFile(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const doc = parseBlipSeedText(text);
  if (!doc) throw new Error('invalid_blip');
  return { filePath, text, doc };
}
