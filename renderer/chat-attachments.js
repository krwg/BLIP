const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 960;
const MAX_DATA_URL_CHARS = 520_000;

function inferImageMime(file) {
  if (file.type && file.type.startsWith('image/')) return file.type;
  const n = (file.name || '').toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

/**
 * Resize image for LAN send (JPEG, capped size).
 * @param {File} file
 * @returns {Promise<{ kind: 'image', name: string, mime: string, dataUrl: string }>}
 */
export async function encodeChatImageAttachment(file) {
  if (!file || !file.size) throw new Error('empty');
  if (file.size > MAX_FILE_BYTES) throw new Error('file_too_big');
  const mime = inferImageMime(file);
  if (!mime.startsWith('image/')) throw new Error('bad_mime');

  const blobUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('decode'));
      img.src = blobUrl;
    });

    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) throw new Error('decode');

    const scale = Math.min(1, MAX_EDGE / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(img, 0, 0, w, h);

    let q = 0.86;
    let dataUrl = canvas.toDataURL('image/jpeg', q);
    while (dataUrl.length > MAX_DATA_URL_CHARS && q > 0.45) {
      q -= 0.06;
      dataUrl = canvas.toDataURL('image/jpeg', q);
    }
    if (dataUrl.length > MAX_DATA_URL_CHARS) throw new Error('too_large');

    return {
      kind: 'image',
      name: file.name || 'image.jpg',
      mime: 'image/jpeg',
      dataUrl,
    };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
