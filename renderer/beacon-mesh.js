/**
 * BEACON / Mesh Library — catalog, seeding, parallel chunk download (1.1.0).
 */

import { getMaxFileBytes } from './file-transfer-limits.js';

export const BEACON_CHUNK_SIZE = 262144;
const PULSE_INTERVAL_MS = 30_000;
const CHUNK_REQUEST_BATCH = 8;
const MAX_PARALLEL_PEERS = 3;
const CHUNK_TIMEOUT_MS = 20_000;

/** @type {Map<string, { seedId: string, filename: string, size: number, chunkSize: number, totalChunks: number, seeders: Map<number, number>, leechers?: number, updatedAt: number }>} */
const catalog = new Map();

/** @type {Set<string>} */
const localComplete = new Set();

/** @type {Map<string, { progress: number, phase: string }>} */
const jobProgress = new Map();

/** @type {Map<string, { resolve: (data: string) => void, reject: (err: Error) => void, timer: ReturnType<typeof setTimeout> }>} */
const pendingChunks = new Map();

let pulseTimer = null;
let meshApi = null;
let getConfig = () => ({});
let getPeers = () => [];
let getPeerLatency = () => 9999;

function emitCatalog() {
  window.dispatchEvent(new CustomEvent('blip-beacon-catalog'));
}

function emitProgress(seedId) {
  window.dispatchEvent(
    new CustomEvent('blip-beacon-progress', { detail: { seedId, ...(jobProgress.get(seedId) || {}) } })
  );
}

function setJobProgress(seedId, progress, phase) {
  jobProgress.set(seedId, { progress, phase });
  emitProgress(seedId);
}

function clearJobProgress(seedId) {
  jobProgress.delete(seedId);
  emitProgress(seedId);
}

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
      emitCatalog();
      break;
    case 'seed-pulse':
      if (Array.isArray(data.seeds)) {
        for (const s of data.seeds) upsertCatalogEntry({ ...s, blipId: s.blipId ?? data.blipId });
      }
      emitCatalog();
      break;
    case 'seed-gone':
      if (data.seedId && !localComplete.has(String(data.seedId))) {
        catalog.delete(String(data.seedId));
        emitCatalog();
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
    const seeds = [...localComplete]
      .map((seedId) => {
        const entry = catalog.get(seedId);
        return {
          seedId,
          leechers: entry?.leechers || 0,
          blipId: cfg.blipId,
        };
      })
      .filter(Boolean);
    if (!seeds.length || !meshApi?.beaconSendUdp) return;
    void meshApi.beaconSendUdp({
      type: 'seed-pulse',
      blipId: cfg.blipId,
      seeds,
      timestamp: Date.now(),
    });
  }, PULSE_INTERVAL_MS);
}

async function reconcileLocalSeeds() {
  for (const seedId of [...localComplete]) {
    const meta = await meshApi?.beaconReadMeta?.({ seedId });
    if (!meta?.seedId) {
      localComplete.delete(seedId);
      continue;
    }
    const have = await meshApi.beaconCountChunks?.({
      seedId,
      totalChunks: meta.totalChunks,
    });
    if (have < meta.totalChunks) localComplete.delete(seedId);
  }
}

async function ensureLocalMeta(seedId, entry) {
  let meta = await meshApi?.beaconReadMeta?.({ seedId });
  if (meta?.seedId) return meta;
  meta = {
    seedId,
    filename: entry.filename || 'file',
    size: entry.size || 0,
    chunkSize: entry.chunkSize || BEACON_CHUNK_SIZE,
    totalChunks: entry.totalChunks || 0,
    mime: 'application/octet-stream',
    publishedAt: Date.now(),
  };
  const res = await meshApi?.beaconWriteMeta?.({ seedId, meta });
  if (res?.ok === false) throw new Error('no_meta');
  return meta;
}

async function ipcWriteChunk(seedId, chunkIndex, data) {
  const res = await meshApi?.beaconWriteChunk?.({ seedId, chunkIndex, data });
  if (res?.ok === false) throw new Error('chunk_write_failed');
}

async function ipcWriteMeta(seedId, meta) {
  const res = await meshApi?.beaconWriteMeta?.({ seedId, meta });
  if (res?.ok === false) throw new Error('no_meta');
}

async function loadLocalSeeds() {
  const list = await meshApi?.beaconListLocal?.();
  if (!Array.isArray(list)) return;
  const cfg = getConfig();
  for (const meta of list) {
    if (!meta?.seedId) continue;
    upsertCatalogEntry({ ...meta, blipId: cfg.blipId });
    const have = await meshApi.beaconCountChunks?.({
      seedId: meta.seedId,
      totalChunks: meta.totalChunks,
    });
    if (have >= meta.totalChunks) localComplete.add(meta.seedId);
  }
  await reconcileLocalSeeds();
  emitCatalog();
}

export async function refreshBeaconLocalState() {
  await reconcileLocalSeeds();
  emitCatalog();
}

function readFileSliceAsBase64(file, start, end) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('read'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file.slice(start, end));
  });
}

async function computeSeedId(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

function pickDownloadPeers(seedId) {
  const entry = catalog.get(seedId);
  const cfg = getConfig();
  if (!entry) return [];
  const onlineIds = new Set(
    getPeers()
      .filter((p) => p.online && p.blipId !== cfg.blipId)
      .map((p) => p.blipId)
  );
  return [...entry.seeders.keys()]
    .filter((id) => onlineIds.has(id))
    .map((id) => ({ id, lat: getPeerLatency(id) ?? 9999 }))
    .sort((a, b) => a.lat - b.lat)
    .slice(0, MAX_PARALLEL_PEERS);
}

function waitForChunk(seedId, chunkIndex) {
  const key = `${seedId}:${chunkIndex}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingChunks.delete(key);
      reject(new Error('chunk_timeout'));
    }, CHUNK_TIMEOUT_MS);
    pendingChunks.set(key, {
      resolve: (data) => {
        clearTimeout(timer);
        pendingChunks.delete(key);
        resolve(data);
      },
      reject: (err) => {
        clearTimeout(timer);
        pendingChunks.delete(key);
        reject(err);
      },
      timer,
    });
  });
}

async function requestChunksFromPeer(peerId, seedId, indices) {
  if (!indices.length || !meshApi?.sendTcpMessage) return;
  const cfg = getConfig();
  await meshApi.sendTcpMessage({
    type: 'seed-request',
    to: peerId,
    from: cfg.blipId,
    seedId,
    chunks: indices,
  });
  for (const idx of indices) {
    try {
      const data = await waitForChunk(seedId, idx);
      await meshApi.beaconWriteChunk?.({ seedId, chunkIndex: idx, data });
    } catch {
      /* retry from another peer */
    }
  }
}

async function serveSeedRequest(msg, api, config) {
  const from = Number(msg.from);
  const seedId = String(msg.seedId || '');
  const chunks = Array.isArray(msg.chunks) ? msg.chunks.map(Number).filter(Number.isFinite) : [];
  if (!seedId || !Number.isFinite(from) || !chunks.length) return;
  if (!localComplete.has(seedId)) return;

  for (const idx of chunks) {
    const exists = await meshApi?.beaconChunkExists?.({ seedId, chunkIndex: idx });
    if (!exists) continue;
    const res = await meshApi?.beaconReadChunk?.({ seedId, chunkIndex: idx });
    if (!res?.ok || !res.data) continue;
    await api.sendTcpMessage({
      type: 'seed-chunk',
      to: from,
      from: config.blipId,
      seedId,
      chunkIndex: idx,
      data: res.data,
    });
  }
}

function resolveIncomingChunk(msg) {
  const seedId = String(msg.seedId || '');
  const idx = Number(msg.chunkIndex);
  const data = String(msg.data || '');
  if (!seedId || !Number.isFinite(idx) || !data) return;
  const key = `${seedId}:${idx}`;
  const pending = pendingChunks.get(key);
  if (pending) pending.resolve(data);
}

/**
 * @param {{ api: object, getConfig: () => object, getPeers?: () => object[], getPeerLatency?: (id: number) => number }} opts
 */
export function initBeaconMesh(opts) {
  meshApi = opts.api;
  getConfig = opts.getConfig;
  getPeers = opts.getPeers || (() => []);
  getPeerLatency = opts.getPeerLatency || (() => 9999);
  opts.api?.onSeedUdp?.((data) => ingestSeedUdp(data));
  window.addEventListener('beforeunload', stopBeaconPulse);
  void loadLocalSeeds().then(() => startBeaconPulse());
}

export function refreshBeaconMesh() {
  void loadLocalSeeds().then(() => startBeaconPulse());
}

export function getBeaconJobProgress(seedId) {
  return jobProgress.get(seedId) || null;
}

export function isSeedLocalComplete(seedId) {
  return localComplete.has(seedId);
}

export function getBeaconCatalog() {
  const cfg = getConfig();
  return [...catalog.values()].map((e) => {
    const local = localComplete.has(e.seedId);
    const job = jobProgress.get(e.seedId);
    return {
      seedId: e.seedId,
      filename: e.filename,
      size: e.size,
      chunkSize: e.chunkSize,
      totalChunks: e.totalChunks,
      seederCount: e.seeders.size,
      leechers: e.leechers || 0,
      updatedAt: e.updatedAt,
      local,
      mine: local && e.seeders.has(cfg.blipId),
      canSave: local,
      progress: job?.progress ?? (local ? 100 : 0),
      phase: job?.phase || (local ? 'ready' : ''),
      status: job?.phase || (local ? 'seeding' : 'available'),
    };
  });
}

/**
 * @returns {boolean} true if handled
 */
export function handleBeaconTcp(msg, { api, config }) {
  if (!config?.devBeaconEnabled) return false;
  switch (msg.type) {
    case 'seed-request':
      void serveSeedRequest(msg, api, config);
      return true;
    case 'seed-chunk':
      resolveIncomingChunk(msg);
      return true;
    case 'seed-have':
      return true;
    default:
      return false;
  }
}

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
  emitCatalog();
  return true;
}

/**
 * Publish a file into the mesh library.
 * @param {File} file
 */
export async function publishBeaconFile(file) {
  const cfg = getConfig();
  if (!cfg?.devBeaconEnabled) throw new Error('disabled');
  const maxBytes = getMaxFileBytes(cfg);
  if (!file || file.size <= 0) throw new Error('empty');
  if (file.size > maxBytes) throw new Error('too_large');

  const chunkSize = BEACON_CHUNK_SIZE;
  const totalChunks = Math.ceil(file.size / chunkSize);
  const hashKey = `hash-${Date.now()}`;
  setJobProgress(hashKey, 5, 'hashing');

  let seedId;
  try {
    seedId = await computeSeedId(file);
  } finally {
    jobProgress.delete(hashKey);
  }

  setJobProgress(seedId, 8, 'publishing');

  const meta = {
    seedId,
    filename: file.name || 'file',
    size: file.size,
    chunkSize,
    totalChunks,
    mime: file.type || 'application/octet-stream',
    publishedAt: Date.now(),
  };

  try {
    await ipcWriteMeta(seedId, meta);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const data = await readFileSliceAsBase64(file, start, end);
      await ipcWriteChunk(seedId, i, data);
      setJobProgress(seedId, Math.round(8 + ((i + 1) / totalChunks) * 82), 'publishing');
    }

    localComplete.add(seedId);
    upsertCatalogEntry({ ...meta, blipId: cfg.blipId });
    await announceSeed(meta);
    setJobProgress(seedId, 100, 'ready');
    clearJobProgress(seedId);
    return meta;
  } catch (err) {
    localComplete.delete(seedId);
    clearJobProgress(seedId);
    throw err;
  }
}

/**
 * Download a seed from mesh peers and save via system dialog.
 * @param {string} seedId
 */
export async function downloadBeaconSeed(seedId) {
  const cfg = getConfig();
  if (!cfg?.devBeaconEnabled) throw new Error('disabled');
  const entry = catalog.get(seedId);
  if (!entry) throw new Error('not_found');

  if (localComplete.has(seedId)) {
    await ensureLocalMeta(seedId, entry);
    const res = await meshApi.beaconSaveAssembled?.({
      seedId,
      defaultName: entry.filename,
    });
    if (res?.cancelled) return { cancelled: true };
    if (!res?.ok) {
      if (res?.error === 'no_meta') localComplete.delete(seedId);
      throw new Error(res?.error || 'save_failed');
    }
    return res;
  }

  const total = entry.totalChunks;
  const missing = new Set();
  for (let i = 0; i < total; i++) {
    const exists = await meshApi.beaconChunkExists?.({ seedId, chunkIndex: i });
    if (!exists) missing.add(i);
  }

  if (missing.size === 0) {
    await ensureLocalMeta(seedId, entry);
    localComplete.add(seedId);
    upsertCatalogEntry({ ...entry, blipId: cfg.blipId });
    await announceSeed({
      seedId,
      filename: entry.filename,
      size: entry.size,
      chunkSize: entry.chunkSize,
      totalChunks: entry.totalChunks,
    });
    const res = await meshApi.beaconSaveAssembled?.({
      seedId,
      defaultName: entry.filename,
    });
    if (res?.cancelled) return { cancelled: true };
    if (!res?.ok) {
      if (res?.error === 'no_meta') localComplete.delete(seedId);
      throw new Error(res?.error || 'save_failed');
    }
    return res;
  }

  setJobProgress(seedId, Math.round(((total - missing.size) / total) * 100), 'downloading');

  let stallRounds = 0;
  while (missing.size > 0) {
    const peers = pickDownloadPeers(seedId);
    if (!peers.length) throw new Error('no_seeders');

    const before = missing.size;
    const tasks = [];
    const queue = [...missing];
    for (const peer of peers) {
      const batch = queue.splice(0, CHUNK_REQUEST_BATCH);
      if (!batch.length) break;
      tasks.push(requestChunksFromPeer(peer.id, seedId, batch));
    }
    await Promise.allSettled(tasks);

    for (const idx of [...missing]) {
      const exists = await meshApi.beaconChunkExists?.({ seedId, chunkIndex: idx });
      if (exists) missing.delete(idx);
    }

    setJobProgress(seedId, Math.round(((total - missing.size) / total) * 100), 'downloading');

    if (missing.size === before) {
      stallRounds += 1;
      if (stallRounds >= 3) throw new Error('stalled');
    } else {
      stallRounds = 0;
    }
  }

  const meta = await meshApi.beaconReadMeta?.({ seedId });
  if (meta) await meshApi.beaconWriteMeta?.({ seedId, meta });

  localComplete.add(seedId);
  upsertCatalogEntry({ ...entry, blipId: cfg.blipId });
  await ensureLocalMeta(seedId, entry);
  await announceSeed({
    seedId,
    filename: entry.filename,
    size: entry.size,
    chunkSize: entry.chunkSize,
    totalChunks: entry.totalChunks,
  });

  setJobProgress(seedId, 100, 'saving');
  const res = await meshApi.beaconSaveAssembled?.({
    seedId,
    defaultName: entry.filename,
  });
  clearJobProgress(seedId);
  if (res?.cancelled) return { cancelled: true };
  if (!res?.ok) throw new Error(res?.error || 'save_failed');
  return res;
}
