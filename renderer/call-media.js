/** WebRTC capture constraints and sender tuning for BLIP calls. */

export const STREAM_QUALITY_IDS = ['low', 'hd', 'fhd', 'max', 'qhd', 'uhd'];

const PRESETS = {
  low: {
    camera: { width: { ideal: 640, min: 480 }, height: { ideal: 480, min: 360 }, frameRate: { ideal: 24, max: 24 } },
    screen: { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 24, max: 24 } },
    camBitrate: 2_000_000,
    screenBitrate: 6_000_000,
    screenMax: { w: 1280, h: 720 },
    screenFps: 24,
  },
  hd: {
    camera: { width: { ideal: 1280, min: 960 }, height: { ideal: 720, min: 540 }, frameRate: { ideal: 30, max: 30 } },
    screen: { width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: { ideal: 30, max: 30 } },
    camBitrate: 5_000_000,
    screenBitrate: 12_000_000,
    screenMax: { w: 1920, h: 1080 },
    screenFps: 30,
  },
  fhd: {
    camera: { width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 }, frameRate: { ideal: 30, max: 30 } },
    screen: { width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: { ideal: 30, max: 30 } },
    camBitrate: 8_000_000,
    screenBitrate: 18_000_000,
    screenMax: { w: 1920, h: 1080 },
    screenFps: 30,
  },
  max: {
    camera: { width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 }, frameRate: { ideal: 30, max: 60 } },
    screen: { width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: { ideal: 30, max: 60 } },
    camBitrate: 12_000_000,
    screenBitrate: 28_000_000,
    screenMax: { w: 1920, h: 1080 },
    screenFps: 60,
  },
  qhd: {
    camera: { width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 }, frameRate: { ideal: 30, max: 60 } },
    screen: { width: { ideal: 2560, max: 2560 }, height: { ideal: 1440, max: 1440 }, frameRate: { ideal: 30, max: 60 } },
    camBitrate: 14_000_000,
    screenBitrate: 35_000_000,
    screenMax: { w: 2560, h: 1440 },
    screenFps: 60,
  },
  uhd: {
    camera: {
      width: { ideal: 3840, min: 1920 },
      height: { ideal: 2160, min: 1080 },
      frameRate: { ideal: 30, max: 60 },
    },
    screen: { width: { ideal: 3840, max: 3840 }, height: { ideal: 2160, max: 2160 }, frameRate: { ideal: 30, max: 60 } },
    camBitrate: 16_000_000,
    screenBitrate: 45_000_000,
    screenMax: { w: 3840, h: 2160 },
    screenFps: 60,
  },
};

export function normalizeStreamQuality(id) {
  return STREAM_QUALITY_IDS.includes(id) ? id : 'fhd';
}

export function normalizeFullscreenQuality(config) {
  const q = config?.fullscreenQuality || config?.streamQuality;
  return STREAM_QUALITY_IDS.includes(q) ? q : 'fhd';
}

export function getStreamPreset(config) {
  return PRESETS[normalizeStreamQuality(config?.streamQuality)];
}

export function getFullscreenPreset(config) {
  return PRESETS[normalizeFullscreenQuality(config)];
}

/** Target pixel frame for fullscreen theater (from settings). */
export function getFullscreenDimensions(config) {
  const { screenMax } = getFullscreenPreset(config);
  return { width: screenMax.w, height: screenMax.h };
}

/**
 * Size the stage video to the configured fullscreen resolution (letterboxed on display).
 * @param {HTMLElement} wrap
 * @param {HTMLVideoElement | null} video
 * @param {object} config
 * @param {boolean} on
 */
export function applyCallFullscreenLayout(wrap, video, config, on) {
  if (!wrap) return;
  if (!on) {
    wrap.classList.remove('call-video-wrap--fs-sized');
    wrap.style.removeProperty('--call-fs-w');
    wrap.style.removeProperty('--call-fs-h');
    if (video) {
      video.style.removeProperty('width');
      video.style.removeProperty('height');
    }
    return;
  }
  const { width, height } = getFullscreenDimensions(config);
  wrap.classList.add('call-video-wrap--fs-sized');
  wrap.style.setProperty('--call-fs-w', `${width}px`);
  wrap.style.setProperty('--call-fs-h', `${height}px`);
  if (video) {
    video.style.width = `${width}px`;
    video.style.height = `${height}px`;
    video.style.maxWidth = '100vw';
    video.style.maxHeight = '100vh';
    video.style.objectFit = 'contain';
  }
}

export function getCameraVideoConstraints(config) {
  return { ...getStreamPreset(config).camera };
}

export function getScreenCaptureConstraints(config) {
  const p = getStreamPreset(config);
  return { video: { ...p.screen }, audio: false };
}

export function getScreenCaptureMandatory(config) {
  const p = getStreamPreset(config);
  const { screenMax } = p;
  const fps = p.screenFps ?? p.screen?.frameRate?.max ?? 30;
  return {
    minWidth: Math.min(screenMax.w, 640),
    maxWidth: screenMax.w,
    minHeight: Math.min(screenMax.h, 480),
    maxHeight: screenMax.h,
    maxFrameRate: fps,
  };
}

/** @deprecated use getCameraVideoConstraints(config) */
export const CAMERA_VIDEO_CONSTRAINTS = PRESETS.fhd.camera;

/** @deprecated use getScreenCaptureConstraints(config) */
export const SCREEN_CAPTURE_CONSTRAINTS = { video: PRESETS.fhd.screen, audio: false };

export function applyScreenTrackHints(track) {
  if (!track) return;
  try {
    if ('contentHint' in track) track.contentHint = 'detail';
  } catch {
    /* ignore */
  }
}

export async function applyScreenTrackConstraints(track, config) {
  if (!track?.applyConstraints) return;
  const p = getStreamPreset(config);
  const fps = p.screenFps ?? p.screen?.frameRate?.max ?? 30;
  applyScreenTrackHints(track);
  try {
    await track.applyConstraints({
      width: { ideal: p.screenMax.w, max: p.screenMax.w },
      height: { ideal: p.screenMax.h, max: p.screenMax.h },
      frameRate: { ideal: fps, max: fps },
    });
  } catch (err) {
    console.warn('[call] screen track constraints:', err.message);
  }
}

export async function tuneVideoSender(sender, { screenShare = false, config } = {}) {
  if (!sender?.getParameters || !sender.setParameters) return;
  const p = getStreamPreset(config);
  const screenFps = p.screenFps ?? p.screen?.frameRate?.max ?? 30;
  try {
    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    const enc = params.encodings[0];
    enc.maxBitrate = screenShare ? p.screenBitrate : p.camBitrate;
    enc.maxFramerate = screenShare
      ? screenFps
      : p.camera.frameRate?.max || 30;
    enc.scaleResolutionDownBy = 1;
    try {
      enc.degradationPreference = 'maintain-resolution';
      enc.priority = 'high';
      enc.networkPriority = 'high';
    } catch {
      /* optional RTP fields */
    }
    await sender.setParameters(params);
  } catch (err) {
    console.warn('[call] RTP encoding:', err.message);
  }
}

/** Heuristic: screen shares are usually HD landscape. */
export function trackLooksLikeScreen(track) {
  const s = track?.getSettings?.();
  if (!s?.width || !s?.height) return false;
  return s.width >= 960 && s.height >= 540 && s.width >= s.height * 1.2;
}
