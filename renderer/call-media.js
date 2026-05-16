/** WebRTC capture constraints and sender tuning for BLIP calls. */

export const CAMERA_VIDEO_CONSTRAINTS = {
  width: { ideal: 1280, min: 640 },
  height: { ideal: 720, min: 480 },
  frameRate: { ideal: 24, max: 30 },
};

export const SCREEN_CAPTURE_CONSTRAINTS = {
  video: {
    width: { ideal: 1920, min: 1280 },
    height: { ideal: 1080, min: 720 },
    frameRate: { ideal: 30, max: 30 },
  },
  audio: false,
};

export async function applyScreenTrackConstraints(track) {
  if (!track?.applyConstraints) return;
  try {
    await track.applyConstraints({
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 },
      frameRate: { ideal: 30, max: 30 },
    });
  } catch (err) {
    console.warn('[call] screen track constraints:', err.message);
  }
}

export async function tuneVideoSender(sender, { screenShare = false } = {}) {
  if (!sender?.getParameters || !sender.setParameters) return;
  try {
    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    const enc = params.encodings[0];
    enc.maxBitrate = screenShare ? 4_000_000 : 1_200_000;
    enc.maxFramerate = screenShare ? 30 : 24;
    if (screenShare) enc.scaleResolutionDownBy = 1;
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
