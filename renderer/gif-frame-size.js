
export const GIF_FRAME_MAX_AR = 16 / 9;
export const GIF_FRAME_MIN_AR = 4 / 3;

export function clampGifAspectRatio(imgWidth, imgHeight) {
  const w = Math.max(1, imgWidth);
  const h = Math.max(1, imgHeight);
  const ar = w / h;
  return Math.min(GIF_FRAME_MAX_AR, Math.max(GIF_FRAME_MIN_AR, ar));
}

export function computeGifFramePx(imgWidth, imgHeight, maxW, maxH) {
  const ar = clampGifAspectRatio(imgWidth, imgHeight);
  let w = maxW;
  let h = Math.round(w / ar);
  if (h > maxH) {
    h = maxH;
    w = Math.round(h * ar);
  }
  w = Math.max(1, w);
  h = Math.max(1, h);
  return { w, h, ar };
}
