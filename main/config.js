import { app } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import os from 'os';

const DEFAULT_CONFIG = {
  blipId: null,
  displayName: 'Anonymous',
  language: 'en',
  udpPort: 42069,
  tcpPort: 42070,
  themeId: 'dark-signal',

  themeMode: 'dark',

  accentId: 'mint',

  accentCustomHex: '',
  animatedBgId: 'none',

  customAvatar: false,

  profileGifActiveId: '',

  hasProfileGif: false,

  reduceMotion: false,

  reactiveBackground: false,

  defaultReactionEmoji: '❤️',

  closeToTray: process.platform === 'win32',

  launchAtLogin: false,

  desktopNotifications: true,
  desktopCallNotifications: true,

  doNotDisturb: false,
  uiSoundsEnabled: true,
  uiSoundsVolume: 1,

  videoVolume: 1,

  uiSoundPack: 'signal',

  uiMelodyPack: 'mesh',

  audioInputDeviceId: '',

  audioOutputDeviceId: '',

  globalShortcutsEnabled: true,

  presenceStatus: 'online',

  presenceText: '',

  meshPublicKey: '',

  meshPrivateKey: '',

  trustedPeerIds: [],

  blockedPeerIds: [],

  maxFileTransferGb: 10,

  fileTransferSpeed: 'normal',

  devMeshTrace: false,

  devBeaconEnabled: true,

  devProjectsEnabled: false,

  projectsClipboardEnabled: false,

  devGroupsEnabled: false,

  streamQuality: 'max',

  fullscreenQuality: 'max',

  clipboardSyncMode: 'off',

  /** Optional STUN/TURN for WebRTC across VPN segments. Default off = LAN host ICE only. */
  iceEnabled: false,
  iceServerLines: '',

  knownPeerKeys: {},

  receiveBetaUpdates: false,

  noiseSuppression: true,
  autoGainControl: true,

  micInputGain: 100,

  autoDownloadUpdates: true,

  meshPlusLicenseId: '',

  meshPlusLicenseSig: '',

  meshPlusActivatedAt: 0,

  appIconVariant: 'main',

  achievementsEnabled: false,

  achievementsNotify: true,

  toastDurationSec: 9,

  beaconParallelPeers: 6,

  beaconUploadCapPercent: 100,

  uiDensity: 'comfortable',

  uiFontScale: 1,

  chatFontScale: 1,

  typingSoundEnabled: false,

  idleAwayMinutes: 5,

  idleAwayActive: false,
};

let configPath = null;

export function initConfigPath() {
  const dir = join(app.getPath('userData'));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  configPath = join(dir, 'blip-config.json');
}

export function loadConfig() {
  if (!configPath) initConfigPath();
  try {
    if (existsSync(configPath)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(configPath, 'utf8')) };
    }
  } catch {

  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config) {
  if (!configPath) initConfigPath();
  const merged = { ...loadConfig(), ...config };
  writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

export function resetConfigToDefaults() {
  if (!configPath) initConfigPath();
  const fresh = { ...DEFAULT_CONFIG };
  writeFileSync(configPath, JSON.stringify(fresh, null, 2), 'utf8');
  return fresh;
}

export function normalizePeerIp(ip) {
  if (!ip || typeof ip !== 'string') return '';
  return ip.replace(/^::ffff:/i, '');
}

export function getLocalIpv4Set() {
  const set = new Set(['127.0.0.1']);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const v4 = net.family === 'IPv4' || net.family === 4;
      if (v4) set.add(normalizePeerIp(net.address));
    }
  }
  return set;
}

export function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}
