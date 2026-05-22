import { nativeImage } from 'electron';
import { MAX_PROFILE_GIF_TCP_BYTES } from './profile-gif-store.js';

/** Max UTF-8 JSON line budget for profile-gif-share (under tcp-framing 4 MiB). */
const MAX_SHARE_DATA_URL_CHARS = 3_200_000;

/**
 * Build a LAN-safe data URL for profile-gif-share (may downscale static preview if GIF is huge).
 * @param {Buffer | null} buf
 * @returns {string | null}
 */
export function buildProfileGifShareDataUrl(buf) {
  if (!buf?.length) return null;

  if (buf.length <= MAX_PROFILE_GIF_TCP_BYTES) {
    const direct = `data:image/gif;base64,${buf.toString('base64')}`;
    if (direct.length <= MAX_SHARE_DATA_URL_CHARS) return direct;
  }

  try {
    const img = nativeImage.createFromBuffer(buf);
    if (img.isEmpty()) return null;
    const { width, height } = img.getSize();
    const maxDim = 280;
    const scale = Math.min(1, maxDim / Math.max(width, height, 1));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const resized = img.resize({ width: w, height: h, quality: 'good' });
    const png = resized.toPNG();
    if (!png?.length) return null;
    const url = `data:image/png;base64,${png.toString('base64')}`;
    return url.length <= MAX_SHARE_DATA_URL_CHARS ? url : null;
  } catch {
    return null;
  }
}
