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
  /** light | dark | auto (system) */
  themeMode: 'dark',
  /** Color accent id — see themes.css [data-accent] */
  accentId: 'mint',
  /** MESH+: custom #RRGGBB accent (overrides preset when set). */
  accentCustomHex: '',
  animatedBgId: 'none',
  /** User uploaded profile image on disk */
  customAvatar: false,
  /** Active profile GIF id (local file in profile-gifs/). */
  profileGifActiveId: '',
  /** Whether a profile GIF is set (for LAN announce). */
  hasProfileGif: false,
  /** User override: pause animated wallpapers (lighter GPU). */
  reduceMotion: false,
  /** Pulse animated wallpaper from mic level (voice / 1:1 call). */
  reactiveBackground: false,
  /** Default emoji for the chat reaction (+) button. */
  defaultReactionEmoji: '❤️',
  /** When true, the main window close button hides to tray instead of exiting (Windows default on). */
  closeToTray: process.platform === 'win32',
  /** Launch BLIP when the user signs in to the OS. */
  launchAtLogin: false,
  /** OS toast when a new chat message arrives (main window). */
  desktopNotifications: true,
  desktopCallNotifications: true,
  /** Suppress OS toasts and UI sounds (messages, calls, peer online). */
  doNotDisturb: false,
  uiSoundsEnabled: true,
  uiSoundsVolume: 1,
  /** In-app video lightbox volume 0–1 */
  videoVolume: 1,
  /** FX pack: signal | pulse */
  uiSoundPack: 'signal',
  /** Call melodies: mesh | grid */
  uiMelodyPack: 'mesh',
  /** `deviceId` from enumerateDevices; empty = system default mic. */
  audioInputDeviceId: '',
  /** `deviceId` for remote audio (`HTMLMediaElement.setSinkId`). */
  audioOutputDeviceId: '',
  /** Register Alt+1–4, Ctrl+,, Ctrl+Shift+D, Ctrl+Shift+End at OS level (works when tray-hidden). */
  globalShortcutsEnabled: true,
  /** LAN presence in UDP announce: online | away | busy */
  presenceStatus: 'online',
  /** Optional custom status line (shown to peers when online) */
  presenceText: '',
  /** Ed25519 SPKI DER base64 (Mesh Handshake) */
  meshPublicKey: '',
  /** Ed25519 PKCS8 DER base64 — keep local */
  meshPrivateKey: '',
  /** BLIP IDs trusted for chat (synced with renderer) */
  trustedPeerIds: [],
  /** BLIP IDs blocked at TCP layer */
  blockedPeerIds: [],
  /** Max LAN file transfer size: 1 | 10 | 50 | 100 (GB) */
  maxFileTransferGb: 10,
  /** Chunk pacing: fast | normal | slow (extra throttle while a call is active). */
  fileTransferSpeed: 'normal',
  /** Log every TCP frame type to the network panel (developer). */
  devMeshTrace: false,
  /** BEACON mesh library protocol (1.1.0) */
  devBeaconEnabled: true,
  /** Projects hub + group project channels (pad, board, canvas, clipboard). */
  devProjectsEnabled: false,
  /** Signal Corps shared clipboard (LAN mesh). Off by default. */
  projectsClipboardEnabled: false,
  /** Groups / conferences beta — off by default. */
  devGroupsEnabled: false,
  /** Stream quality: low | hd | fhd | max | qhd | uhd */
  streamQuality: 'max',
  /** Fullscreen video target: low | hd | fhd | max | qhd | uhd */
  fullscreenQuality: 'max',
  /** LAN clipboard: off | active (open 1:1 chat) | trusted */
  clipboardSyncMode: 'off',
  /** TOFU: blipId string → meshPublicKey */
  knownPeerKeys: {},
  /** When true, electron-updater may install GitHub prerelease builds (e.g. 0.7.1-beta.x). */
  receiveBetaUpdates: false,
  /** Browser noise suppression + AGC on mic (voice + 1:1 calls). */
  noiseSuppression: true,
  autoGainControl: true,
  /** Mic input gain 0–200 (%), applied before encode. */
  micInputGain: 100,
  /** Download and install updates automatically when available. */
  autoDownloadUpdates: true,
  /** MESH+ license id (16 hex chars) — set after successful activation. */
  meshPlusLicenseId: '',
  /** Ed25519 signature (base64) over blip-meshplus-v1|licenseId */
  meshPlusLicenseSig: '',
  /** Unix ms when MESH+ was activated. */
  meshPlusActivatedAt: 0,
  /** App / tray / about icon: main | dop-1..4 | mesh-1..6 */
  appIconVariant: 'main',
  /** Track session achievements (off by default). */
  achievementsEnabled: false,
  /** Toast when an achievement unlocks. */
  achievementsNotify: true,
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
    /* use defaults */
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config) {
  if (!configPath) initConfigPath();
  const merged = { ...loadConfig(), ...config };
  writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

/** Wipe config to defaults (blipId null — first-run / ID grid). */
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

/** All IPv4 addresses on this machine (filter self-announcements on any NIC alias). */
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
