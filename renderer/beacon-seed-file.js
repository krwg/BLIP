
const BLIP_SEED_V = 1;

export function serializeBlipSeedFile(meta) {
  const seedId = String(meta?.seedId || '').trim();
  const doc = {
    v: BLIP_SEED_V,
    type: 'blip-seed',
    seedId,
    filename: String(meta?.filename || 'file'),
    size: Number(meta?.size) || 0,
    chunkSize: Number(meta?.chunkSize) || 0,
    totalChunks: Number(meta?.totalChunks) || 0,
    link: `blip://seed/${seedId}`,
  };
  return `# BLIP Seed\n${JSON.stringify(doc, null, 2)}\n`;
}

export function parseBlipSeedFile(raw) {
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
    link: String(doc.link || `blip://seed/${seedId}`),
  };
}

export function downloadBlipSeedFile(meta, suggestedName) {
  const seedId = String(meta?.seedId || '').trim();
  const base = String(suggestedName || meta?.filename || 'seed')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.\-()+\s]/g, '_')
    .slice(0, 80);
  const name = `${base || seedId.slice(0, 8)}.blip`;
  const blob = new Blob([serializeBlipSeedFile(meta)], {
    type: 'application/vnd.blip.seed+json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
