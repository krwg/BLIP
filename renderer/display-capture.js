import { getScreenCaptureConstraints, getScreenCaptureMandatory } from './call-media.js';

/**
 * Capture a picked desktopCapturer source in Electron (reliable vs getDisplayMedia handler).
 * @param {string} sourceId
 * @returns {Promise<MediaStream>}
 */
export async function captureDisplayStream(sourceId, config, { withAudio = false } = {}) {
  if (!sourceId || typeof sourceId !== 'string') {
    throw new Error('no_source');
  }

  const chromeMediaSource = sourceId.startsWith('window:') ? 'window' : 'desktop';
  const size = getScreenCaptureMandatory(config);
  const videoMandatory = {
    chromeMediaSource,
    chromeMediaSourceId: sourceId,
    ...size,
  };
  const audioConstraint = withAudio
    ? {
        mandatory: {
          chromeMediaSource,
          chromeMediaSourceId: sourceId,
        },
      }
    : false;

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: audioConstraint,
      video: { mandatory: videoMandatory },
    });
  } catch (err) {
    console.warn('[BLIP] desktop getUserMedia capture failed:', err.message);
  }

  if (window.blip?.prepareDisplayCapture) {
    const prepared = await window.blip.prepareDisplayCapture(sourceId);
    if (prepared?.ok) {
      const base = getScreenCaptureConstraints(config);
      return navigator.mediaDevices.getDisplayMedia({
        ...base,
        audio: withAudio,
      });
    }
  }

  throw new Error('capture_failed');
}
