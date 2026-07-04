
import { getGiphyApiKey } from './giphy-key.js';
import { MAX_PROFILE_GIF_BYTES } from './profile-gif-store.js';

const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';

function apiKey() {
  return getGiphyApiKey();
}

export function isGiphyConfigured() {
  return apiKey().length > 0;
}

function pickImage(images, ...keys) {
  for (const key of keys) {
    const o = images[key];
    if (o?.url) return o;
  }
  return {};
}

function mapGif(gif) {
  const images = gif?.images || {};
  const preview = pickImage(
    images,
    'preview_gif',
    'fixed_height',
    'fixed_width',
    'downsized',
    'downsized_small'
  );
  const importSrc = pickImage(
    images,
    'downsized',
    'fixed_width',
    'fixed_height',
    'preview_gif',
    'original'
  );
  return {
    id: String(gif?.id || ''),
    title: String(gif?.title || ''),
    previewUrl: preview.url || '',
    gifUrl: importSrc.url || preview.url || '',
    width: Number(preview.width || importSrc.width || 0),
    height: Number(preview.height || importSrc.height || 0),
  };
}

export async function searchGiphy(query, opts = {}) {
  const key = apiKey();
  if (!key) return { ok: false, error: 'no_api_key', items: [] };
  const limit = opts.limit ?? 24;
  const offset = opts.offset ?? 0;
  const q = encodeURIComponent(String(query || '').trim());
  const url = `${GIPHY_BASE}/search?api_key=${key}&q=${q}&limit=${limit}&offset=${offset}&rating=g&lang=en`;
  const res = await fetch(url);
  if (!res.ok) return { ok: false, error: 'giphy_http', items: [] };
  const data = await res.json();
  const items = (data?.data || []).map(mapGif).filter((g) => g.gifUrl);
  return { ok: true, items, pagination: data?.pagination };
}

export async function trendingGiphy(opts = {}) {
  const key = apiKey();
  if (!key) return { ok: false, error: 'no_api_key', items: [] };
  const limit = opts.limit ?? 24;
  const offset = opts.offset ?? 0;
  const url = `${GIPHY_BASE}/trending?api_key=${key}&limit=${limit}&offset=${offset}&rating=g`;
  const res = await fetch(url);
  if (!res.ok) return { ok: false, error: 'giphy_http', items: [] };
  const data = await res.json();
  const items = (data?.data || []).map(mapGif).filter((g) => g.gifUrl);
  return { ok: true, items, pagination: data?.pagination };
}

export async function downloadGifUrl(gifUrl) {
  const res = await fetch(gifUrl);
  if (!res.ok) throw new Error('download_failed');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_PROFILE_GIF_BYTES) throw new Error('gif_too_large');
  return buf;
}
