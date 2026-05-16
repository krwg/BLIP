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
  animatedBgId: 'none',
  /** When true, the main window close button hides to tray instead of exiting (Windows default on). */
  closeToTray: process.platform === 'win32',
  /** OS toast when a new chat message arrives (main window). */
  desktopNotifications: true,
  desktopCallNotifications: true,
  /** Suppress OS toasts and UI sounds (messages, calls, peer online). */
  doNotDisturb: false,
  uiSoundsEnabled: true,
  uiSoundsVolume: 1,
  /** `deviceId` from enumerateDevices; empty = system default mic. */
  audioInputDeviceId: '',
  /** `deviceId` for remote audio (`HTMLMediaElement.setSinkId`). */
  audioOutputDeviceId: '',
  /** Register Alt+1–4, Ctrl+,, Ctrl+Shift+D, Ctrl+Shift+End at OS level (works when tray-hidden). */
  globalShortcutsEnabled: true,
  /** LAN presence in UDP announce: online | away | busy */
  presenceStatus: 'online',
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
