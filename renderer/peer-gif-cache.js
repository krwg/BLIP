
const peerGifReady = new Set();

const peerGifDisplayById = new Map();

const peerGifIngestPending = new Map();

const MAX_INGEST_CHARS = 4_000_000;
const DATA_URL_RE = /^data:image\/(gif|png|jpe?g|webp);base64,/i;

function normalizeId(blipId) {
  const id = Number(blipId);
  return Number.isFinite(id) ? id : null;
}

function revokeDisplayUrl(id) {
  const prev = peerGifDisplayById.get(id);
  if (prev?.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(prev);
    } catch {

    }
  }
  peerGifDisplayById.delete(id);
  peerGifReady.delete(id);
}

function isValidProfileGifDataUrl(raw) {
  return typeof raw === 'string' && raw.length > 0 && raw.length <= MAX_INGEST_CHARS && DATA_URL_RE.test(raw);
}

export async function ingestPeerProfileGifDataUrl(blipId, dataUrl) {
  const id = normalizeId(blipId);
  if (id == null) return false;

  if (!dataUrl) {
    revokeDisplayUrl(id);
    return false;
  }

  const raw = String(dataUrl);
  if (!isValidProfileGifDataUrl(raw)) {
    console.warn('[BLIP] peer profile GIF invalid payload', id, raw.length);
    return false;
  }

  if (peerGifDisplayById.get(id) === raw && peerGifReady.has(id)) {
    return true;
  }

  const pending = peerGifIngestPending.get(id);
  if (pending) return pending;

  const work = Promise.resolve().then(() => {
    revokeDisplayUrl(id);
    peerGifDisplayById.set(id, raw);
    peerGifReady.add(id);
    return true;
  });

  peerGifIngestPending.set(id, work);
  try {
    return await work;
  } finally {
    peerGifIngestPending.delete(id);
  }
}

export function setPeerProfileGifDataUrl(blipId, dataUrl) {
  void ingestPeerProfileGifDataUrl(blipId, dataUrl);
}

export function getPeerProfileGifDataUrl(blipId) {
  return getPeerProfileGifDisplayUrl(blipId);
}

export function isPeerProfileGifIngesting(blipId) {
  const id = normalizeId(blipId);
  return id != null && peerGifIngestPending.has(id);
}

export function getPeerProfileGifDisplayUrl(blipId) {
  const id = normalizeId(blipId);
  if (id == null) return null;
  return peerGifDisplayById.get(id) || null;
}

export function revokePeerProfileGifDisplayUrl(blipId) {
  const id = normalizeId(blipId);
  if (id == null) return;
  revokeDisplayUrl(id);
  peerGifIngestPending.delete(id);
}

export function peerHasCachedProfileGif(blipId) {
  const id = normalizeId(blipId);
  if (id == null) return false;
  return peerGifReady.has(id) || peerGifIngestPending.has(id);
}
