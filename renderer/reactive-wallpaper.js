
let ctx = null;
let analyser = null;
let source = null;
let raf = null;
let enabled = false;
let attachedStream = null;

function setPulse(value) {
  const v = Math.max(0, Math.min(1, value));
  document.documentElement.style.setProperty('--blip-bg-pulse', String(v.toFixed(3)));
}

function stopLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
}

function teardown() {
  stopLoop();
  try {
    source?.disconnect();
  } catch {

  }
  source = null;
  analyser = null;
  if (ctx) {
    void ctx.close().catch(() => {});
    ctx = null;
  }
  attachedStream = null;
  setPulse(0);
}

function tick() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  let sum = 0;
  const n = Math.min(24, data.length);
  for (let i = 0; i < n; i++) sum += data[i];
  const avg = n ? sum / n / 255 : 0;
  const prev = Number(document.documentElement.style.getPropertyValue('--blip-bg-pulse')) || 0;
  const smooth = prev * 0.72 + avg * 0.28;
  setPulse(smooth);
  raf = requestAnimationFrame(tick);
}

async function attachStream(stream) {
  if (!stream?.getAudioTracks?.()?.length) return;
  if (attachedStream === stream && ctx) return;
  teardown();
  attachedStream = stream;
  ctx = new AudioContext();
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {

    }
  }
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.82;
  source = ctx.createMediaStreamSource(stream);
  source.connect(analyser);
  tick();
}

export function isReactiveWallpaperEnabled(config) {
  return config?.reactiveBackground === true;
}

export function applyReactiveWallpaperConfig(config) {
  const html = document.documentElement;
  const on =
    isReactiveWallpaperEnabled(config) &&
    config?.animatedBgId &&
    config.animatedBgId !== 'none';
  html.dataset.reactiveBg = on ? '1' : '0';
  enabled = on;
  if (!on) teardown();
}

export function handleReactiveAudioEvent(detail) {
  if (!enabled) return;
  if (detail?.active && detail?.stream) {
    void attachStream(detail.stream);
    return;
  }
  if (!detail?.active) teardown();
}

export function initReactiveWallpaper(getConfig) {
  window.addEventListener('blip-reactive-audio', (ev) => {
    applyReactiveWallpaperConfig(getConfig());
    handleReactiveAudioEvent(ev.detail);
  });
  applyReactiveWallpaperConfig(getConfig());
}

export function dispatchReactiveAudio(detail) {
  window.dispatchEvent(new CustomEvent('blip-reactive-audio', { detail }));
}
