/**
 * BLIP UI sounds — Web Audio chiptune synthesis (no sample files).
 * Two FX packs (signal / pulse) and two melody packs (mesh / grid).
 */

let audioCtx = null;
let soundsEnabled = true;
let soundsVolume = 1;
let soundPackId = 'signal';
let melodyPackId = 'mesh';
let incomingRingTimer = null;
let outgoingRingTimer = null;

export const SOUND_PACK_IDS = ['signal', 'pulse', 'wire', 'static'];
export const MELODY_PACK_IDS = ['mesh', 'grid', 'beacon', 'chime'];

export const SOUND_PREVIEW_KEYS = [
  'messageReceived',
  'messageSent',
  'notify',
  'peerOnline',
  'groupInvite',
  'groupCallInvite',
  'meshPing',
];

export const MELODY_PREVIEW_KEYS = [
  'incomingCall',
  'outgoingCall',
  'callConnected',
  'callEnd',
];

/** @deprecated use SOUND_PREVIEW_KEYS / MELODY_PREVIEW_KEYS */
export const PREVIEW_KEYS = [...SOUND_PREVIEW_KEYS, ...MELODY_PREVIEW_KEYS];

const N = {
  G3: 196.0,
  A3: 220.0,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
};

const MELODIES = {
  mesh: {
    ring: [
      { f: N.C5, d: 90, g: 0.11 },
      { f: N.E5, d: 90, g: 0.1, gap: 20 },
      { f: N.G5, d: 120, g: 0.12, gap: 30 },
      { f: N.E5, d: 80, g: 0.08, gap: 40 },
      { f: N.C5, d: 140, g: 0.1, gap: 280 },
    ],
    dial: [
      { f: N.A4, d: 120, g: 0.09, t: 'square' },
      { f: N.C5, d: 100, g: 0.08, gap: 180 },
      { f: N.A4, d: 120, g: 0.09 },
      { f: N.E5, d: 140, g: 0.07, gap: 520 },
    ],
    connected: [
      { f: N.G4, d: 60, g: 0.1 },
      { f: N.C5, d: 60, g: 0.11, gap: 15 },
      { f: N.E5, d: 60, g: 0.11, gap: 15 },
      { f: N.G5, d: 180, g: 0.13, gap: 20 },
    ],
    endSweep: { from: N.G5, to: N.C4, dur: 220 },
    endTail: { f: N.G3, d: 160, t: 'triangle' },
  },
  grid: {
    ring: [
      { f: N.A4, d: 70, g: 0.1, t: 'square' },
      { f: N.C5, d: 70, g: 0.1, gap: 12 },
      { f: N.D5, d: 70, g: 0.1, gap: 12 },
      { f: N.E5, d: 90, g: 0.11, gap: 12 },
      { f: N.G5, d: 110, g: 0.1, gap: 220 },
    ],
    dial: [
      { f: N.C4, d: 80, g: 0.09 },
      { f: N.E4, d: 80, g: 0.09, gap: 80 },
      { f: N.G4, d: 80, g: 0.09 },
      { f: N.C5, d: 100, g: 0.08, gap: 400 },
    ],
    connected: [
      { f: N.C4, d: 50, g: 0.09 },
      { f: N.E4, d: 50, g: 0.09, gap: 10 },
      { f: N.G4, d: 50, g: 0.09, gap: 10 },
      { f: N.C5, d: 50, g: 0.09, gap: 10 },
      { f: N.G5, d: 200, g: 0.12, gap: 15 },
    ],
    endSweep: { from: N.E5, to: N.A3, dur: 200 },
    endTail: { f: N.G3, d: 140, t: 'square' },
  },
  beacon: {
    ring: [
      { f: N.G4, d: 100, g: 0.1, t: 'sine' },
      { f: N.C5, d: 100, g: 0.11, gap: 30 },
      { f: N.E5, d: 140, g: 0.12, gap: 200 },
    ],
    dial: [
      { f: N.C4, d: 90, g: 0.08, t: 'sine' },
      { f: N.E4, d: 90, g: 0.08, gap: 120 },
      { f: N.G4, d: 110, g: 0.09, gap: 450 },
    ],
    connected: [
      { f: N.A4, d: 70, g: 0.1, t: 'sine' },
      { f: N.C5, d: 80, g: 0.11, gap: 20 },
      { f: N.E5, d: 160, g: 0.12, gap: 30 },
    ],
    endSweep: { from: N.E5, to: N.C4, dur: 240 },
    endTail: { f: N.A3, d: 150, t: 'sine' },
  },
  chime: {
    ring: [
      { f: N.E5, d: 80, g: 0.09 },
      { f: N.G5, d: 80, g: 0.09, gap: 15 },
      { f: N.C6, d: 120, g: 0.1, gap: 15 },
      { f: N.E5, d: 100, g: 0.08, gap: 250 },
    ],
    dial: [
      { f: N.C5, d: 70, g: 0.08 },
      { f: N.E5, d: 70, g: 0.08, gap: 70 },
      { f: N.G5, d: 70, g: 0.08, gap: 70 },
      { f: N.C6, d: 90, g: 0.07, gap: 500 },
    ],
    connected: [
      { f: N.C5, d: 55, g: 0.09 },
      { f: N.E5, d: 55, g: 0.09, gap: 12 },
      { f: N.G5, d: 55, g: 0.09, gap: 12 },
      { f: N.C6, d: 180, g: 0.11, gap: 18 },
    ],
    endSweep: { from: N.C6, to: N.G3, dur: 210 },
    endTail: { f: N.C4, d: 130, t: 'triangle' },
  },
};

const FX = {
  signal: {
    messageSent: [
      { f: N.E5, d: 45, g: 0.08 },
      { f: N.G5, d: 55, g: 0.09, gap: 10 },
    ],
    messageReceived: [
      { f: N.C5, d: 50, g: 0.09 },
      { f: N.E5, d: 50, g: 0.1, gap: 25 },
      { f: N.A5, d: 70, g: 0.08, gap: 15 },
    ],
    notify: [
      { f: N.A4, d: 55, g: 0.08, t: 'triangle' },
      { f: N.C5, d: 75, g: 0.1, gap: 20 },
    ],
    peerOnlineSweep: { from: N.G3, to: N.G5, dur: 280, type: 'square' },
    peerOnlineTail: [{ f: N.C5, d: 100, g: 0.1, gap: 40 }],
    peerOffline: [
      { f: N.E5, d: 80, g: 0.07 },
      { f: N.C4, d: 140, g: 0.06, gap: 20 },
    ],
    groupInvite: [
      { f: N.C5, d: 70, g: 0.1 },
      { f: N.G5, d: 70, g: 0.1, gap: 30 },
      { f: N.C6, d: 120, g: 0.11, gap: 40 },
    ],
    groupCallInvite: [
      { f: N.E5, d: 80, g: 0.1 },
      { f: N.G5, d: 80, g: 0.1, gap: 40 },
      { f: N.E5, d: 80, g: 0.1, gap: 40 },
      { f: N.C6, d: 140, g: 0.12, gap: 60 },
    ],
    groupCallNoise: true,
    meshPing: [
      { f: N.A5, d: 35, g: 0.07, t: 'sine' },
      { f: N.C6, d: 55, g: 0.08, gap: 15 },
    ],
    error: [
      { f: N.A3, d: 100, g: 0.1, t: 'sawtooth' },
      { f: N.G3, d: 160, g: 0.08, gap: 30 },
    ],
    uiClick: { f: N.C5, d: 35, t: 'square', g: 0.05 },
  },
  pulse: {
    messageSent: [
      { f: N.A5, d: 40, g: 0.09, t: 'triangle' },
      { f: N.C6, d: 50, g: 0.1, gap: 8 },
    ],
    messageReceived: [
      { f: N.G4, d: 45, g: 0.08, t: 'triangle' },
      { f: N.A5, d: 45, g: 0.09, gap: 15 },
      { f: N.D5, d: 60, g: 0.08, gap: 12 },
    ],
    notify: [
      { f: N.E5, d: 45, g: 0.09, t: 'sine' },
      { f: N.G5, d: 65, g: 0.1, gap: 18 },
    ],
    peerOnlineSweep: { from: N.A3, to: N.C6, dur: 260, type: 'triangle' },
    peerOnlineTail: [{ f: N.E5, d: 90, g: 0.09, gap: 35 }],
    peerOffline: [
      { f: N.D5, d: 70, g: 0.07, t: 'triangle' },
      { f: N.A3, d: 130, g: 0.06, gap: 25 },
    ],
    groupInvite: [
      { f: N.E5, d: 60, g: 0.1, t: 'sine' },
      { f: N.A5, d: 60, g: 0.09, gap: 25 },
      { f: N.E5, d: 100, g: 0.11, gap: 35 },
    ],
    groupCallInvite: [
      { f: N.A5, d: 70, g: 0.1 },
      { f: N.C6, d: 70, g: 0.1, gap: 35 },
      { f: N.A5, d: 70, g: 0.1, gap: 35 },
      { f: N.E5, d: 130, g: 0.12, gap: 50 },
    ],
    groupCallNoise: true,
    meshPing: [
      { f: N.C6, d: 30, g: 0.08, t: 'sine' },
      { f: N.E5, d: 45, g: 0.07, gap: 12 },
    ],
    error: [
      { f: N.G3, d: 90, g: 0.11, t: 'sawtooth' },
      { f: N.C4, d: 150, g: 0.07, gap: 25 },
    ],
    uiClick: { f: N.E5, d: 30, t: 'triangle', g: 0.05 },
  },
  wire: {
    messageSent: [
      { f: N.G4, d: 35, g: 0.07, t: 'triangle' },
      { f: N.C5, d: 45, g: 0.08, gap: 12 },
    ],
    messageReceived: [
      { f: N.A3, d: 40, g: 0.08, t: 'triangle' },
      { f: N.D4, d: 50, g: 0.09, gap: 18 },
    ],
    notify: [
      { f: N.C4, d: 50, g: 0.08 },
      { f: N.G4, d: 60, g: 0.09, gap: 22 },
    ],
    peerOnlineSweep: { from: N.A3, to: N.C5, dur: 220, type: 'triangle' },
    peerOnlineTail: [{ f: N.G4, d: 90, g: 0.08, gap: 30 }],
    peerOffline: [
      { f: N.E4, d: 70, g: 0.06, t: 'triangle' },
      { f: N.A3, d: 120, g: 0.05, gap: 20 },
    ],
    groupInvite: [
      { f: N.D4, d: 55, g: 0.09 },
      { f: N.G4, d: 65, g: 0.1, gap: 28 },
    ],
    groupCallInvite: [
      { f: N.C4, d: 60, g: 0.09 },
      { f: N.E4, d: 60, g: 0.09, gap: 30 },
      { f: N.G4, d: 100, g: 0.1, gap: 40 },
    ],
    groupCallNoise: true,
    meshPing: [
      { f: N.G4, d: 28, g: 0.06, t: 'sine' },
      { f: N.C5, d: 40, g: 0.07, gap: 10 },
    ],
    error: [
      { f: N.A3, d: 80, g: 0.09, t: 'sawtooth' },
      { f: N.G3, d: 130, g: 0.07, gap: 25 },
    ],
    uiClick: { f: N.G4, d: 28, t: 'triangle', g: 0.04 },
  },
  static: {
    messageSent: [
      { f: N.C5, d: 25, g: 0.12, t: 'square' },
      { f: N.C5, d: 20, g: 0.1, gap: 40 },
    ],
    messageReceived: [
      { f: N.E5, d: 30, g: 0.11, t: 'square' },
      { f: N.C5, d: 25, g: 0.1, gap: 35 },
    ],
    notify: [
      { f: N.G5, d: 40, g: 0.1, t: 'square' },
      { f: N.E5, d: 35, g: 0.09, gap: 50 },
    ],
    peerOnlineSweep: { from: N.C4, to: N.G5, dur: 180, type: 'square' },
    peerOnlineTail: [{ f: N.C5, d: 70, g: 0.1, gap: 25 }],
    peerOffline: [
      { f: N.G5, d: 50, g: 0.08, t: 'square' },
      { f: N.C4, d: 100, g: 0.06, gap: 15 },
    ],
    groupInvite: [
      { f: N.E5, d: 45, g: 0.1, t: 'square' },
      { f: N.G5, d: 55, g: 0.1, gap: 20 },
    ],
    groupCallInvite: [
      { f: N.C5, d: 50, g: 0.1, t: 'square' },
      { f: N.E5, d: 50, g: 0.1, gap: 25 },
      { f: N.G5, d: 80, g: 0.11, gap: 35 },
    ],
    groupCallNoise: false,
    meshPing: [
      { f: N.C6, d: 20, g: 0.1, t: 'square' },
      { f: N.C6, d: 20, g: 0.08, gap: 60 },
    ],
    error: [
      { f: N.G3, d: 60, g: 0.12, t: 'square' },
      { f: N.C4, d: 100, g: 0.08, gap: 20 },
    ],
    uiClick: { f: N.C5, d: 22, t: 'square', g: 0.06 },
  },
};

function normalizePack(id, allowed, fallback) {
  return allowed.includes(id) ? id : fallback;
}

function getMelody() {
  return MELODIES[melodyPackId] || MELODIES.mesh;
}

function getFx() {
  return FX[soundPackId] || FX.signal;
}

export function setSoundPrefs({ enabled, volume, soundPack, melodyPack } = {}) {
  if (typeof enabled === 'boolean') soundsEnabled = enabled;
  if (typeof volume === 'number' && Number.isFinite(volume)) {
    soundsVolume = Math.max(0, Math.min(1, volume));
  }
  if (soundPack) soundPackId = normalizePack(soundPack, SOUND_PACK_IDS, 'signal');
  if (melodyPack) melodyPackId = normalizePack(melodyPack, MELODY_PACK_IDS, 'mesh');
}

/** Resume AudioContext after user gesture (required in Chromium). */
export async function ensureAudioReady() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (e) {
      console.warn('[BLIP audio] resume:', e.message);
    }
  }
  return ctx.state === 'running';
}

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function canPlay(force = false) {
  if (soundsVolume <= 0) return false;
  if (force) return true;
  return soundsEnabled;
}

function masterGain(ctx, peak = 0.2) {
  const g = ctx.createGain();
  g.gain.value = peak * soundsVolume;
  g.connect(ctx.destination);
  return g;
}

function playNote(freq, startTime, durationMs, opts = {}, force = false) {
  if (!canPlay(force) || !freq) return;
  const ctx = getCtx();
  const dur = durationMs / 1000;
  const type = opts.type || 'square';
  const peak = (opts.gain ?? 0.14) * soundsVolume;

  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const out = masterGain(ctx, 1);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  env.gain.setValueAtTime(0.0001, startTime);
  env.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), startTime + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

  osc.connect(env);
  env.connect(out);
  osc.start(startTime);
  osc.stop(startTime + dur + 0.02);
}

function playSequence(seq, baseGain = 0.12, force = false) {
  if (!canPlay(force) || !seq?.length) return;
  const ctx = getCtx();
  const t0 = ctx.currentTime + 0.03;
  let at = 0;
  for (const step of seq) {
    playNote(step.f, t0 + at, step.d, { type: step.t || 'square', gain: step.g ?? baseGain }, force);
    at += step.d / 1000 + (step.gap ?? 0) / 1000;
  }
}

function playSweep(startFreq, endFreq, durationMs, type = 'sine', gain = 0.1, force = false) {
  if (!canPlay(force)) return;
  const ctx = getCtx();
  const dur = durationMs / 1000;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const out = masterGain(ctx, 1);
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 40), ctx.currentTime + dur);
  const peak = gain * soundsVolume;
  env.gain.setValueAtTime(peak, ctx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(env);
  env.connect(out);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
}

function playNoiseBurst(durationMs, gain = 0.06, force = false) {
  if (!canPlay(force)) return;
  const ctx = getCtx();
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * (durationMs / 1000)));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 2000;
  filt.Q.value = 0.7;
  const env = ctx.createGain();
  env.gain.value = gain * soundsVolume;
  src.connect(filt);
  filt.connect(env);
  env.connect(ctx.destination);
  src.start();
}

function tickIncomingRing(force = false) {
  playSequence(getMelody().ring, 0.11, force);
}

function tickOutgoingRing(force = false) {
  playSequence(getMelody().dial, 0.09, force);
}

export function stopIncomingRing() {
  if (incomingRingTimer) {
    clearInterval(incomingRingTimer);
    incomingRingTimer = null;
  }
}

export function stopOutgoingRing() {
  if (outgoingRingTimer) {
    clearInterval(outgoingRingTimer);
    outgoingRingTimer = null;
  }
}

export function stopAllRings() {
  stopIncomingRing();
  stopOutgoingRing();
}

function playFxKey(key, force = false) {
  const fx = getFx();
  const seq = fx[key];
  if (Array.isArray(seq)) playSequence(seq, 0.09, force);
  else if (seq?.f) playNote(seq.f, getCtx().currentTime + 0.03, seq.d, { type: seq.t, gain: seq.g }, force);
}

function playCallEnd(force = false) {
  const m = getMelody();
  playSweep(m.endSweep.from, m.endSweep.to, m.endSweep.dur, 'square', 0.1, force);
  setTimeout(() => {
    playNote(m.endTail.f, getCtx().currentTime, m.endTail.d, { type: m.endTail.t || 'triangle', gain: 0.08 }, force);
  }, 120);
}

function playPeerOnline(force = false) {
  const fx = getFx();
  playSweep(fx.peerOnlineSweep.from, fx.peerOnlineSweep.to, fx.peerOnlineSweep.dur, fx.peerOnlineSweep.type || 'square', 0.09, force);
  playSequence(fx.peerOnlineTail, 0.1, force);
}

function playGroupCallInvite(force = false) {
  playSequence(getFx().groupCallInvite, 0.1, force);
  if (getFx().groupCallNoise) setTimeout(() => playNoiseBurst(40, 0.04, force), 200);
}

function buildHandlers() {
  return {
    incomingCall: () => {
      stopIncomingRing();
      tickIncomingRing();
      incomingRingTimer = setInterval(() => tickIncomingRing(), melodyPackId === 'grid' ? 1400 : 1600);
    },
    outgoingCall: () => {
      stopOutgoingRing();
      tickOutgoingRing();
      outgoingRingTimer = setInterval(() => tickOutgoingRing(), melodyPackId === 'grid' ? 1200 : 1400);
    },
    callConnected: () => {
      stopAllRings();
      playSequence(getMelody().connected, 0.11);
    },
    callEnd: () => {
      stopAllRings();
      playCallEnd();
    },
    messageSent: () => playFxKey('messageSent'),
    messageReceived: () => playFxKey('messageReceived'),
    peerOnline: () => playPeerOnline(),
    peerOffline: () => playFxKey('peerOffline'),
    notify: () => playFxKey('notify'),
    groupInvite: () => playFxKey('groupInvite'),
    groupCallInvite: () => playGroupCallInvite(),
    meshPing: () => playFxKey('meshPing'),
    error: () => playFxKey('error'),
    uiClick: () => playFxKey('uiClick'),
  };
}

let handlers = buildHandlers();

function refreshHandlers() {
  handlers = buildHandlers();
}

export const SOUND_CATALOG = new Proxy(
  {},
  {
    get(_t, prop) {
      return handlers[prop];
    },
  }
);

/** Preview one cue (ignores “UI sounds off”; uses current volume). */
export async function preview(name) {
  const ready = await ensureAudioReady();
  if (!ready) return false;

  const prevEnabled = soundsEnabled;
  const prevVol = soundsVolume;
  soundsEnabled = true;
  if (soundsVolume < 0.05) soundsVolume = 0.75;

  refreshHandlers();
  const force = true;

  try {
    if (name === 'incomingCall') {
      tickIncomingRing(force);
      return true;
    }
    if (name === 'outgoingCall') {
      tickOutgoingRing(force);
      return true;
    }

    const fn = handlers[name];
    if (typeof fn === 'function') {
      fn();
      return true;
    }
    return false;
  } finally {
    soundsEnabled = prevEnabled;
    soundsVolume = prevVol;
  }
}

export const sounds = {
  incomingCall() {
    refreshHandlers();
    handlers.incomingCall();
  },
  stopIncomingRing,
  outgoingCall() {
    refreshHandlers();
    handlers.outgoingCall();
  },
  stopOutgoingRing,
  callConnected() {
    refreshHandlers();
    handlers.callConnected();
  },
  callEnd() {
    refreshHandlers();
    handlers.callEnd();
  },
  messageSent() {
    refreshHandlers();
    handlers.messageSent();
  },
  messageReceived() {
    refreshHandlers();
    handlers.messageReceived();
  },
  peerOnline() {
    refreshHandlers();
    handlers.peerOnline();
  },
  peerOffline() {
    refreshHandlers();
    handlers.peerOffline();
  },
  notify() {
    refreshHandlers();
    handlers.notify();
  },
  groupInvite() {
    refreshHandlers();
    handlers.groupInvite();
  },
  groupCallInvite() {
    refreshHandlers();
    handlers.groupCallInvite();
  },
  meshPing() {
    refreshHandlers();
    handlers.meshPing();
  },
  error() {
    refreshHandlers();
    handlers.error();
  },
  uiClick() {
    refreshHandlers();
    handlers.uiClick();
  },
  preview,
  ensureAudioReady,
};
