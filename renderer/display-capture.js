import { SCREEN_CAPTURE_CONSTRAINTS } from './call-media.js';

/**
 * Capture a picked desktopCapturer source in Electron (reliable vs getDisplayMedia handler).
 * @param {string} sourceId
 * @returns {Promise<MediaStream>}
 */
export async function captureDisplayStream(sourceId) {
  if (!sourceId || typeof sourceId !== 'string') {
    throw new Error('no_source');
  }

  const chromeMediaSource = sourceId.startsWith('window:') ? 'window' : 'desktop';

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource,
          chromeMediaSourceId: sourceId,
          minWidth: 1280,
          maxWidth: 1920,
          minHeight: 720,
          maxHeight: 1080,
          maxFrameRate: 30,
        },
      },
    });
  } catch (err) {
    console.warn('[BLIP] desktop getUserMedia capture failed:', err.message);
  }

  if (window.blip?.prepareDisplayCapture) {
    const prepared = await window.blip.prepareDisplayCapture(sourceId);
    if (prepared?.ok) {
      return navigator.mediaDevices.getDisplayMedia(SCREEN_CAPTURE_CONSTRAINTS);
    }
  }

  throw new Error('capture_failed');
}
