/**
 * BEACON / Mesh Library — catalog, UDP announce/pulse, TCP chunk protocol (1.1.0).
 */

export const BEACON_CHUNK_SIZE = 262144;
const PULSE_INTERVAL_MS = 30_000;

/** @type {Map<string, { seedId: string, filename: string, size: number, chunkSize: number, totalChunks: number, seeders: Map<number, number>, leechers?: number, updatedAt: number }>} */
const catalog = new Map();

let pulseTimer = null;
let meshApi = null;
let getConfig = () => ({});

function upsertCatalogEntry(data) {
  const seedId = String(data.seedId || '').trim();
  if (!seedId) return;
  const blipId = Number(data.blipId);
  let entry = catalog.get(seedId);
  if (!entry) {
    entry = {
      seedId,
      filename: String(data.filename || 'file'),
      size: Number(data.size) || 0,
      chunkSize: Number(data.chunkSize) || BEACON_CHUNK_SIZE,
      totalChunks: Number(data.totalChunks) || 0,
      seeders: new Map(),
      leechers: Number(data.leechers) || 0,
      updatedAt: Date.now(),
    };
    catalog.set(seedId, entry);
  }
  if (data.filename) entry.filename = String(data.filename);
  if (data.size) entry.size = Number(data.size);
  if (data.chunkSize) entry.chunkSize = Number(data.chunkSize);
  if (data.totalChunks) entry.totalChunks = Number(data.totalChunks);
  if (Number.isFinite(blipId) && blipId > 0) entry.seeders.set(blipId, Date.now());
  if (data.leechers != null) entry.leechers = Number(data.leechers) || 0;
  entry.updatedAt = Date.now();
}

function ingestSeedUdp(data) {
  const cfg = getConfig();
  if (!cfg?.devBeaconEnabled) return;
  switch (data.type) {
    case 'seed-announce':
      upsertCatalogEntry(data);
      window.dispatchEvent(new CustomEvent('blip-beacon-catalog'));
      break;
    case 'seed-pulse':
      if (Array.isArray(data.seeds)) {
        for (const s of data.seeds) upsertCatalogEntry({ ...s, blipId: s.blipId ?? data.blipId });
      }
      window.dispatchEvent(new CustomEvent('blip-beacon-catalog'));
      break;
    case 'seed-gone':
      if (data.seedId) {
        catalog.delete(String(data.seedId));
        window.dispatchEvent(new CustomEvent('blip-beacon-catalog'));
      }
      break;
    default:
      break;
  }
}

function stopBeaconPulse() {
  if (pulseTimer) {
    clearInterval(pulseTimer);
    pulseTimer = null;
  }
}

function startBeaconPulse() {
  stopBeaconPulse();
  const cfg = getConfig();
  if (!cfg?.devBeaconEnabled) return;
  pulseTimer = setInterval(() => {
    const seeds = [...catalog.values()]
      .filter((e) => e.seeders.has(cfg.blipId))
      .map((e) => ({
        seedId: e.seedId,
        leechers: e.leechers || 0,
        blipId: cfg.blipId,
      }));
    if (!seeds.length || !meshApi?.beaconSendUdp) return;
    void meshApi.beaconSendUdp({
      type: 'seed-pulse',
      blipId: cfg.blipId,
      seeds,
      timestamp: Date.now(),
    });
  }, PULSE_INTERVAL_MS);
}

/**
 * @param {{ api: object, getConfig: () => object }} opts
 */
export function initBeaconMesh(opts) {
  meshApi = opts.api;
  getConfig = opts.getConfig;
  opts.api?.onSeedUdp?.((data) => ingestSeedUdp(data));
  window.addEventListener('beforeunload', stopBeaconPulse);
  startBeaconPulse();
}

export function refreshBeaconMesh() {
  startBeaconPulse();
}

export function getBeaconCatalog() {
  return [...catalog.values()].map((e) => ({
    seedId: e.seedId,
    filename: e.filename,
    size: e.size,
    chunkSize: e.chunkSize,
    totalChunks: e.totalChunks,
    seederCount: e.seeders.size,
    leechers: e.leechers || 0,
    updatedAt: e.updatedAt,
  }));
}

/**
 * @returns {boolean} true if handled
 */
export function handleBeaconTcp(msg, { api, config }) {
  if (!config?.devBeaconEnabled) return false;
  switch (msg.type) {
    case 'seed-request':
    case 'seed-chunk':
    case 'seed-have':
      // Phase B: serve/read chunks via main IPC
      return true;
    default:
      return false;
  }
}

/**
 * Broadcast a new seed (metadata only; chunking in phase B).
 */
export async function announceSeed(meta) {
  const cfg = getConfig();
  if (!cfg?.devBeaconEnabled || !meshApi?.beaconSendUdp) return false;
  upsertCatalogEntry({ ...meta, blipId: cfg.blipId });
  await meshApi.beaconSendUdp({
    type: 'seed-announce',
    ...meta,
    blipId: cfg.blipId,
    chunkSize: meta.chunkSize || BEACON_CHUNK_SIZE,
    timestamp: Date.now(),
  });
  window.dispatchEvent(new CustomEvent('blip-beacon-catalog'));
  return true;
}
