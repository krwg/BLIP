import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell, Notification, session } from 'electron';
import { join, dirname } from 'path';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { Discovery } from './discovery.js';
import { ensureBeaconSeedsRoot, getBeaconSeedsRoot } from './beacon-store.js';
import { createTcpServer } from './tcp-server.js';
import { connectToPeer, sendOnSocket, pingPeer } from './tcp-client.js';
import { createTcpLineReader } from './tcp-framing.js';
import { loadConfig, saveConfig, initConfigPath, getLocalIp, getLocalIpv4Set } from './config.js';
import { toPublicConfig } from './config-public.js';
import { confirmEntitlementBlob, resolveEntitlementState } from './mesh-plus-license.js';
import {
  initAppTrustState,
  getAppTrustState,
  refreshMeshPlusTrust,
} from './trust-state.js';
import {
  premiumResetPatch,
  sanitizePremiumPrefs,
} from '../shared/mesh-plus-gates.js';
import {
  canUseAppIconVariant,
  normalizeAppIconVariant,
  APP_ICON_VARIANTS,
} from './app-icons.js';
import { resolveAppIconVariant, resolveVariantWindowIconPath } from './app-icons.js';
import { applyAppIcons } from './apply-app-icons.js';
import { ensureMeshIdentity } from './mesh-identity.js';
import {
  handleMeshHandshakeMessage,
  assertAuthenticated,
  isSocketAuthenticated,
  performOutboundHandshake,
  clearSocketSession,
  initInboundSession,
} from './mesh-handshake.js';
import { isPeerBlocked } from './trust-policy.js';
import { createTray, destroyTray } from './tray.js';
import {
  setupAutoUpdater,
  checkForUpdatesNow,
  quitAndInstallUpdater,
  configureAutoUpdater,
} from './updater.js';
import { resolveBuildAsset } from './paths.js';
import { resolvePorts } from './ports.js';
import { serializeSdp, sendCallPayload } from './call-wire.js';
import { fetchGithubReleases } from './github-releases.js';
import {
  getCustomAvatarDataUrl,
  saveCustomAvatar,
  clearCustomAvatar,
  hasCustomAvatar,
} from './avatar-store.js';
import {
  clearActiveProfileGif,
  getActiveProfileGifId,
  getProfileGifDataUrl,
  getProfileGifShareDataUrl,
  getProfileGifPublicState,
  hasActiveProfileGif,
  listProfileGifHistory,
  saveProfileGifFromBuffer,
  saveProfileGifFromDataUrl,
  setActiveProfileGif,
} from './profile-gif-store.js';
import {
  downloadGifUrl,
  isGiphyConfigured,
  searchGiphy,
  trendingGiphy,
} from './giphy-client.js';
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from './global-shortcuts.js';
import {
  listDisplaySources,
  resolveDisplaySourceForCallback,
  setPendingDisplaySource,
} from './display-capture.js';
import { performFactoryReset } from './factory-reset.js';
import os from 'os';

if (process.env.BLIP_USER_DATA_DIR) {
  app.setPath('userData', process.env.BLIP_USER_DATA_DIR);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const useViteDev = process.env.BLIP_VITE_DEV === '1';
const distIndex = join(rootDir, 'dist/index.html');
const preloadPath = join(rootDir, 'preload.cjs');
const appMetaPath = join(rootDir, 'app-metadata.json');

function loadAppMetadata() {
  try {
    if (existsSync(appMetaPath)) {
      return JSON.parse(readFileSync(appMetaPath, 'utf8'));
    }
  } catch (e) {
    console.warn('[BLIP] app-metadata', e);
  }
  return {
    displayName: 'BLIP',
    codename: '',
    version: app.getVersion(),
    githubUrl: '',
  };
}

let mainWindow = null;
let callWindow = null;
/** Active 1:1 call peer — hang up on app quit. */
let activeCallPeerId = null;
let groupCallWindow = null;
let callWindowReady = false;
let groupCallWindowReady = false;
/** @type {Array<{ channel: string, data: unknown, focus: boolean }>} */
const pendingCallIpc = [];
/** @type {Array<{ channel: string, data: unknown, focus: boolean }>} */
const pendingGroupCallIpc = [];
let discovery = null;
let tcpServer = null;
let config = null;
const peerSockets = new Map();
/** @type {Map<string, Promise<import('net').Socket>>} */
const peerSocketConnectInflight = new Map();
/** Set in `before-quit` so the main window can distinguish Quit from close-to-tray hide. */
let appIsQuitting = false;

function getRendererUrl() {
  if (useViteDev) return 'http://localhost:5173';
  if (existsSync(distIndex)) return distIndex;
  return 'http://localhost:5173';
}

function getWindowIcon() {
  const iconPath = resolveVariantWindowIconPath(resolveAppIconVariant(config));
  if (existsSync(iconPath)) return nativeImage.createFromPath(iconPath);
  return undefined;
}

function refreshAppIcons() {
  return applyAppIcons(config, { mainWindow, callWindow, groupCallWindow });
}

function createWindow() {
  const icon = getWindowIcon();
  mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 640,
    minHeight: 480,
    frame: false,
    icon,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const url = getRendererUrl();
  console.log('[BLIP] Loading UI:', url);
  if (url.startsWith('http')) {
    mainWindow.loadURL(url);
  } else {
    mainWindow.loadFile(url);
  }

  mainWindow.webContents.on('did-fail-load', (_event, code, desc, validatedURL) => {
    console.error('[BLIP] did-fail-load:', code, desc, validatedURL);
    if (!app.isPackaged) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.webContents.on('preload-error', (_event, path, error) => {
    console.error('[BLIP] preload-error:', path, error);
  });

  if (!app.isPackaged && process.env.BLIP_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('close', (e) => {
    if (appIsQuitting) return;
    if (config?.closeToTray) {
      e.preventDefault();
      if (!mainWindow.isDestroyed()) mainWindow.hide();
      return;
    }
    try {
      if (callWindow && !callWindow.isDestroyed()) {
        callWindow.destroy();
        callWindow = null;
      }
    } catch {
      /* ignore */
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    unregisterGlobalShortcuts();
  });

  mainWindow.webContents.once('did-finish-load', () => {
    refreshGlobalShortcuts();
  });
}

function refreshGlobalShortcuts() {
  if (!config?.blipId) {
    unregisterGlobalShortcuts();
    return;
  }
  registerGlobalShortcuts({
    enabled: config.globalShortcutsEnabled !== false,
    getMainWindow: () => mainWindow,
    getCallWindow: () => callWindow,
  });
}

function getCallWindowUrl() {
  if (useViteDev) return 'http://localhost:5173/call-window.html';
  const p = join(rootDir, 'dist/call-window.html');
  if (existsSync(p)) return p;
  return `http://localhost:5173/call-window.html`;
}

async function ensureCallWindow() {
  if (callWindow && !callWindow.isDestroyed()) return callWindow;

  const icon = getWindowIcon();
  callWindow = new BrowserWindow({
    width: 440,
    height: 560,
    minWidth: 400,
    minHeight: 500,
    frame: false,
    show: false,
    icon,
    title: 'BLIP — Call',
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  callWindow.setMenuBarVisibility(false);

  const url = getCallWindowUrl();
  console.log('[BLIP] Call window load:', url);
  if (url.startsWith('http')) {
    await callWindow.loadURL(url);
  } else {
    await callWindow.loadFile(url);
  }

  callWindow.on('closed', () => {
    callWindow = null;
    callWindowReady = false;
    pendingCallIpc.length = 0;
  });

  callWindow.webContents.on('did-start-load', () => {
    callWindowReady = false;
  });

  return callWindow;
}

function flushCallWindowQueue() {
  if (!callWindow || callWindow.isDestroyed() || !callWindowReady) return;
  let shouldFocus = false;
  for (const item of pendingCallIpc) {
    callWindow.webContents.send(item.channel, item.data);
    if (item.focus) shouldFocus = true;
  }
  pendingCallIpc.length = 0;
  if (shouldFocus) {
    callWindow.show();
    callWindow.focus();
  }
}

function flushGroupCallWindowQueue() {
  if (!groupCallWindow || groupCallWindow.isDestroyed() || !groupCallWindowReady) return;
  let shouldFocus = false;
  for (const item of pendingGroupCallIpc) {
    groupCallWindow.webContents.send(item.channel, item.data);
    if (item.focus) shouldFocus = true;
  }
  pendingGroupCallIpc.length = 0;
  if (shouldFocus) {
    groupCallWindow.show();
    groupCallWindow.focus();
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeRendererReady(win, globalFlag) {
  if (!win || win.isDestroyed()) return false;
  try {
    return await win.webContents.executeJavaScript(`Boolean(window.${globalFlag})`);
  } catch {
    return false;
  }
}

async function waitForCallWindowReady(win, timeoutMs = 20000) {
  if (callWindowReady) return;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (callWindowReady) return;
    if (await probeRendererReady(win, '__blipCallReady')) {
      callWindowReady = true;
      flushCallWindowQueue();
      return;
    }
    await delay(50);
  }
  throw new Error('Call window did not become ready');
}

async function waitForGroupCallWindowReady(win, timeoutMs = 20000) {
  if (groupCallWindowReady) return;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (groupCallWindowReady) return;
    if (await probeRendererReady(win, '__blipGroupCallReady')) {
      groupCallWindowReady = true;
      flushGroupCallWindowQueue();
      return;
    }
    await delay(50);
  }
  throw new Error('Group call window did not become ready');
}

async function readGroupFromMainWindow(groupId) {
  if (!mainWindow || mainWindow.isDestroyed() || !groupId) return null;
  const key = JSON.stringify(String(groupId));
  try {
    return await mainWindow.webContents.executeJavaScript(`(() => {
      try {
        const raw = localStorage.getItem('blip_groups_v1');
        if (!raw) return null;
        const o = JSON.parse(raw);
        return o[${key}] ?? null;
      } catch { return null; }
    })()`);
  } catch (e) {
    console.warn('[BLIP] readGroupFromMainWindow', e?.message || e);
    return null;
  }
}

function getGroupCallWindowUrl() {
  if (useViteDev) return 'http://localhost:5173/group-call-window.html';
  const p = join(rootDir, 'dist/group-call-window.html');
  if (existsSync(p)) return p;
  return 'http://localhost:5173/group-call-window.html';
}

async function ensureGroupCallWindow() {
  if (groupCallWindow && !groupCallWindow.isDestroyed()) return groupCallWindow;

  const icon = getWindowIcon();
  groupCallWindow = new BrowserWindow({
    width: 720,
    height: 520,
    minWidth: 560,
    minHeight: 420,
    frame: false,
    show: false,
    icon,
    title: 'BLIP — Group call',
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  groupCallWindow.setMenuBarVisibility(false);

  const url = getGroupCallWindowUrl();
  console.log('[BLIP] Group call window load:', url);
  if (url.startsWith('http')) {
    await groupCallWindow.loadURL(url);
  } else {
    await groupCallWindow.loadFile(url);
  }

  groupCallWindow.on('closed', () => {
    groupCallWindow = null;
    groupCallWindowReady = false;
    pendingGroupCallIpc.length = 0;
  });

  groupCallWindow.webContents.on('did-start-load', () => {
    groupCallWindowReady = false;
  });

  return groupCallWindow;
}

async function sendToGroupCallWindow(channel, data, { focus = true } = {}) {
  try {
    const win = await ensureGroupCallWindow();
    if (!win || win.isDestroyed()) return;
    pendingGroupCallIpc.push({ channel, data, focus });
    if (!groupCallWindowReady) {
      await waitForGroupCallWindowReady(win);
    }
    flushGroupCallWindowQueue();
  } catch (e) {
    console.error('[BLIP] sendToGroupCallWindow', channel, e);
  }
}

function applyLaunchAtLogin(enabled) {
  if (process.platform !== 'win32' && process.platform !== 'darwin' && process.platform !== 'linux') {
    return;
  }
  try {
    app.setLoginItemSettings({
      openAtLogin: !!enabled,
      openAsHidden: false,
    });
  } catch (e) {
    console.warn('[BLIP] launchAtLogin', e?.message || e);
  }
}

async function sendToCallWindow(channel, data, { focus = true } = {}) {
  try {
    const win = await ensureCallWindow();
    if (!win || win.isDestroyed()) return;
    pendingCallIpc.push({ channel, data, focus });
    if (!callWindowReady) {
      console.log('[BLIP] → call-window (queued)', channel);
      await waitForCallWindowReady(win);
    }
    flushCallWindowQueue();
    console.log('[BLIP] → call-window', channel, focus ? '+focus' : '');
  } catch (e) {
    console.error('[BLIP] sendToCallWindow', channel, e);
  }
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function broadcastTrustState() {
  const trust = getAppTrustState();
  sendToRenderer('trust-state', trust);
  if (callWindow && !callWindow.isDestroyed()) {
    callWindow.webContents.send('trust-state', trust);
  }
  if (groupCallWindow && !groupCallWindow.isDestroyed()) {
    groupCallWindow.webContents.send('trust-state', trust);
  }
}

function patchConfig(updates) {
  config = saveConfig(updates);
  discovery?.updateConfig(config);
  const pub = toPublicConfig(config);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('config-updated', pub);
  }
  if (callWindow && !callWindow.isDestroyed()) {
    callWindow.webContents.send('config-updated', pub);
  }
  if (groupCallWindow && !groupCallWindow.isDestroyed()) {
    groupCallWindow.webContents.send('config-updated', pub);
  }
  if (updates?.launchAtLogin !== undefined) {
    applyLaunchAtLogin(config.launchAtLogin);
  }
  return config;
}

function meshHandshakeContext() {
  return {
    config,
    discovery,
    tcpServer,
    onConfigPatch: (updates) => patchConfig(updates),
  };
}

function showDesktopNotification(payload) {
  if (!Notification.isSupported()) return { ok: false, reason: 'unsupported' };
  const peerId = Number(payload?.peerId);
  const kind = payload?.kind === 'call' ? 'call' : 'chat';
  const title =
    typeof payload?.title === 'string' ? payload.title.trim().slice(0, 128) : 'BLIP';
  let body = typeof payload?.body === 'string' ? payload.body.replace(/\s+/g, ' ').trim() : '';
  body = body.slice(0, 256);
  if (!body) body = ' ';
  try {
    const n = new Notification({ title: title || 'BLIP', body, silent: false });
    n.on('click', () => {
      if (kind === 'call') {
        void ensureCallWindow().then((win) => {
          if (win && !win.isDestroyed()) {
            win.show();
            win.focus();
          }
        });
        return;
      }
      if (Number.isFinite(peerId) && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('notification-open-chat', peerId);
      }
    });
    n.show();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function findPeer(blipId) {
  const peers = discovery?.getPeers() || [];
  return peers.find((p) => p.blipId === blipId && p.online) || null;
}

function wirePeerSocket(socket, socketKey, peerIp) {
  if (socket._blipPeerWired) return;
  socket._blipPeerWired = true;

  initInboundSession(socket, peerIp || socket.remoteAddress || '');

  const reader = createTcpLineReader(() => {
    try {
      socket.destroy();
    } catch {
      /* ignore */
    }
  });

  const onSocketLine = (msg) => {
    if (msg.type === 'ping') return;
    if (handleMeshHandshakeMessage(msg, socket, meshHandshakeContext())) return;
    if (!isSocketAuthenticated(socket)) return;
    const auth = assertAuthenticated(socket, msg);
    if (!auth.ok) return;
    if (isPeerBlocked(config, auth.from)) return;
    handleTcpPayload(msg, auth.from);
  };

  socket.on('data', (chunk) => {
    try {
      for (const line of reader.push(chunk)) {
        try {
          onSocketLine(JSON.parse(line));
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      if (e?.code === 'LINE_TOO_LARGE') socket.destroy();
    }
  });

  socket.on('close', () => {
    clearSocketSession(socket);
    peerSockets.delete(socketKey);
    socket._blipPeerWired = false;
  });
}

async function ensurePeerSocket(blipId) {
  const peer = findPeer(blipId);
  if (!peer) throw new Error('Peer not found');

  const tcpPort = peer.tcpPort || resolvePorts(config).tcpPort;
  const socketKey = `${peer.ip}:${blipId}:${tcpPort}`;

  const cached = peerSockets.get(socketKey);
  if (cached && !cached.destroyed) return cached;

  const inflight = peerSocketConnectInflight.get(socketKey);
  if (inflight) return inflight;

  const connectPromise = (async () => {
    peerSockets.delete(socketKey);
    const socket = await connectToPeer(peer.ip, blipId, tcpPort);
    wirePeerSocket(socket, socketKey, peer.ip);
    await performOutboundHandshake(socket, config, blipId, discovery);
    peerSockets.set(socketKey, socket);
    return socket;
  })().finally(() => {
    peerSocketConnectInflight.delete(socketKey);
  });

  peerSocketConnectInflight.set(socketKey, connectPromise);
  return connectPromise;
}

function sendCallToPeer(peerBlipId, payload) {
  return sendCallPayload(tcpServer, ensurePeerSocket, peerBlipId, payload, peerSockets);
}

function handleTcpPayload(msg, fromBlipId) {
  if (isPeerBlocked(config, fromBlipId)) return;

  switch (msg.type) {
    case 'ping':
      return;
    case 'mesh-handshake':
    case 'mesh-handshake-ack':
      return;
    case 'message':
    case 'typing':
    case 'receipt':
    case 'reaction':
    case 'group-invite':
    case 'group-invite-ack':
    case 'group-msg':
    case 'group-host':
    case 'group-sync':
    case 'group-leave':
    case 'group-disband':
      sendToRenderer('tcp-message', msg);
      break;
    case 'group-call-signal':
      void sendToGroupCallWindow('group-call-tcp', msg, { focus: false });
      break;
    case 'group-call-start':
      sendToRenderer('tcp-message', msg);
      break;
    case 'group-call-state':
    case 'group-call-end':
      sendToRenderer('tcp-message', msg);
      void sendToGroupCallWindow('group-call-tcp', msg, { focus: false });
      break;
    case 'voice-ch-roster':
    case 'voice-ch-signal':
      sendToRenderer('tcp-message', msg);
      break;
    case 'seed-request':
    case 'seed-chunk':
    case 'seed-have':
    case 'file-offer':
    case 'file-chunk':
    case 'file-done':
    case 'file-abort':
    case 'clipboard-push':
    case 'avatar-share':
    case 'group-avatar-share':
    case 'group-avatar-request':
    case 'profile-gif-share':
    case 'profile-gif-request':
      sendToRenderer('tcp-message', msg);
      break;
    case 'call-offer': {
      const callerId = msg.from ?? fromBlipId;
      activeCallPeerId = Number(callerId) || null;
      if (config?.desktopCallNotifications !== false && !config?.doNotDisturb) {
        showDesktopNotification({
          kind: 'call',
          peerId: callerId,
          title: 'BLIP',
          body: `Incoming call · #${callerId}`,
        });
      }
      void sendToCallWindow(
        'incoming-call',
        {
          ...msg,
          from: callerId,
          sdp: msg.sdp,
          video: msg.video,
        },
        { focus: true }
      );
      break;
    }
    case 'call-answer':
      activeCallPeerId = Number(msg.from ?? fromBlipId) || activeCallPeerId;
      void sendToCallWindow('call-answer', { ...msg, from: msg.from ?? fromBlipId }, { focus: false });
      break;
    case 'call-candidate':
      void sendToCallWindow('call-candidate', { ...msg, from: msg.from ?? fromBlipId }, { focus: false });
      break;
    case 'call-reject':
      void sendToCallWindow('call-rejected', { ...msg, from: msg.from ?? fromBlipId }, { focus: false });
      break;
    case 'call-hangup':
      if (Number(msg.from ?? fromBlipId) === activeCallPeerId) activeCallPeerId = null;
      void sendToCallWindow('call-ended', { ...msg, from: msg.from ?? fromBlipId }, { focus: false });
      break;
    case 'call-state':
      void sendToCallWindow('call-state', { ...msg, from: msg.from ?? fromBlipId }, { focus: false });
      break;
    case 'call-renegotiate':
      void sendToCallWindow('call-renegotiate', { ...msg, from: msg.from ?? fromBlipId }, { focus: false });
      break;
    case 'call-renegotiate-answer':
      void sendToCallWindow(
        'call-renegotiate-answer',
        { ...msg, from: msg.from ?? fromBlipId },
        { focus: false }
      );
      break;
    default:
      break;
  }
}

function createTcpHandlers() {
  return {
    onMessage: (msg, socket, remoteIp) => {
      if (msg.type === 'ping') {
        socket.write(JSON.stringify({ type: 'pong' }) + '\n');
        return;
      }

      if (handleMeshHandshakeMessage(msg, socket, meshHandshakeContext())) return;

      if (!isSocketAuthenticated(socket)) {
        return;
      }

      const auth = assertAuthenticated(socket, msg);
      if (!auth.ok) {
        try {
          socket.destroy();
        } catch {
          /* ignore */
        }
        return;
      }

      if (isPeerBlocked(config, auth.from)) return;

      handleTcpPayload(msg, auth.from);
    },
  };
}

async function rollbackNetworking(reasonErr) {
  if (reasonErr) console.error('[BLIP] network bootstrap failed:', reasonErr.message || reasonErr);
  try {
    discovery?.stop();
  } catch {
    /* ignore */
  }
  discovery = null;
  if (tcpServer) {
    try {
      await tcpServer.close();
    } catch {
      /* ignore */
    }
    tcpServer = null;
  }
}

async function bootstrapNetworking() {
  const { tcpPort } = resolvePorts(config);
  tcpServer = await createTcpServer(createTcpHandlers(), tcpPort);
  discovery = new Discovery(config, (peers, occupiedIds) => {
    sendToRenderer('peers-updated', { peers, occupiedIds });
  });
  discovery.onSeedPacket = (data) => sendToRenderer('seed-udp', data);
  await discovery.start();
}

function closeAuxiliaryWindows() {
  if (callWindow && !callWindow.isDestroyed()) {
    callWindow.destroy();
    callWindow = null;
  }
  if (groupCallWindow && !groupCallWindow.isDestroyed()) {
    groupCallWindow.destroy();
    groupCallWindow = null;
    groupCallWindowReady = false;
  }
}

async function stopNetwork() {
  discovery?.stop();
  discovery = null;
  for (const s of peerSockets.values()) {
    if (!s.destroyed) s.destroy();
  }
  peerSockets.clear();
  if (tcpServer) {
    await tcpServer.close();
    tcpServer = null;
  }
}

async function restartNetwork() {
  await stopNetwork();
  await bootstrapNetworking();
}

function installTray() {
  const meta = loadAppMetadata();
  const trayLabels =
    config.language === 'ru'
      ? { show: 'Показать', quit: 'Выход' }
      : { show: 'Show', quit: 'Quit' };
  const { trayPath } = refreshAppIcons();
  createTray({
    getMainWindow: () => mainWindow,
    tooltip: `${meta.displayName || 'BLIP'} — local network`,
    labels: trayLabels,
    iconPath: trayPath,
    onQuit: async () => {
      await stopNetwork();
      app.quit();
    },
  });
}

function setupIpc() {
  ipcMain.handle('get-config', () => toPublicConfig(config));
  ipcMain.handle('save-config', (_, updates) => {
    const prevLang = config?.language;
    const safe = { ...updates };
    delete safe.meshPlusLicenseId;
    delete safe.meshPlusLicenseSig;
    delete safe.meshPlusActivatedAt;
    delete safe.tier;
    delete safe.meshPlusActive;
    delete safe.meshPlusLicenseMasked;
    if (safe.appIconVariant !== undefined) {
      const id = normalizeAppIconVariant(safe.appIconVariant);
      safe.appIconVariant = canUseAppIconVariant(
        { ...config, ...safe },
        id
      )
        ? id
        : 'main';
    }
    const meshActive = resolveEntitlementState({ ...config, ...safe });
    Object.assign(
      safe,
      sanitizePremiumPrefs(config, safe, meshActive)
    );
    config = saveConfig(safe);
    if (safe.appIconVariant !== undefined) refreshAppIcons();
    if (updates?.receiveBetaUpdates !== undefined || updates?.autoDownloadUpdates !== undefined) {
      void configureAutoUpdater(config);
    }
    discovery?.updateConfig(config);
    discovery?.announce();
    if (typeof updates?.language === 'string' && updates.language !== prevLang) {
      installTray();
    }
    const pub = toPublicConfig(config);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('config-updated', pub);
    }
    if (callWindow && !callWindow.isDestroyed()) {
      callWindow.webContents.send('config-updated', pub);
    }
    if (groupCallWindow && !groupCallWindow.isDestroyed()) {
      groupCallWindow.webContents.send('config-updated', pub);
    }
    if (updates?.launchAtLogin !== undefined) {
      applyLaunchAtLogin(config.launchAtLogin);
    }
    if (
      updates?.globalShortcutsEnabled !== undefined ||
      updates?.blipId !== undefined
    ) {
      refreshGlobalShortcuts();
    }
    return pub;
  });

  ipcMain.handle('activate-mesh-plus', (_, rawKey) => {
    const result = confirmEntitlementBlob(rawKey);
    if (!result.ok) return result;
    config = saveConfig({
      meshPlusLicenseId: result.licenseId,
      meshPlusLicenseSig: result.sigB64,
      meshPlusActivatedAt: Date.now(),
    });
    discovery?.updateConfig(config);
    discovery?.announce();
    refreshAppIcons();
    refreshMeshPlusTrust(config);
    broadcastTrustState();
    const pub = toPublicConfig(config);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('config-updated', pub);
    }
    return { ok: true, tier: pub.tier };
  });

  ipcMain.handle('deactivate-mesh-plus', () => {
    const patch = {
      meshPlusLicenseId: '',
      meshPlusLicenseSig: '',
      meshPlusActivatedAt: 0,
    };
    if (String(config.appIconVariant || '').startsWith('mesh-')) {
      patch.appIconVariant = 'main';
    }
    const prefsPatch = premiumResetPatch(config);
    if (prefsPatch) Object.assign(patch, prefsPatch);
    if (prefsPatch?.hasProfileGif === false) clearActiveProfileGif();
    config = saveConfig(patch);
    discovery?.updateConfig(config);
    discovery?.announce();
    refreshAppIcons();
    refreshMeshPlusTrust(config);
    broadcastTrustState();
    const pub = toPublicConfig(config);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('config-updated', pub);
    }
    return { ok: true, tier: 'free' };
  });

  ipcMain.handle('factory-reset', () => {
    closeAuxiliaryWindows();
    for (const s of peerSockets.values()) {
      if (!s.destroyed) s.destroy();
    }
    peerSockets.clear();
    config = performFactoryReset();
    unregisterGlobalShortcuts();
    refreshAppIcons();
    discovery?.updateConfig(config);
    discovery?.announce();
    sendToRenderer('peers-updated', { peers: [], occupiedIds: [] });
    const pub = toPublicConfig(config);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('config-updated', pub);
      mainWindow.webContents.send('factory-reset-done', pub);
    }
    return { ok: true, config: pub };
  });

  ipcMain.handle('get-mesh-plus-status', () => {
    const pub = toPublicConfig(config);
    return {
      tier: pub.tier,
      active: pub.meshPlusActive,
      licenseMasked: pub.meshPlusLicenseMasked || '',
      activatedAt: config.meshPlusActivatedAt || 0,
    };
  });

  ipcMain.handle('get-trust-state', () => getAppTrustState());

  ipcMain.handle('get-github-releases', async (_, limit) => fetchGithubReleases(limit ?? 8));
  ipcMain.handle('get-peers', () => ({
    peers: discovery?.getPeers() || [],
    occupiedIds: discovery?.getOccupiedIds() || [],
  }));

  ipcMain.handle('get-network-diagnostics', () => {
    const { tcpPort, udpPort } = resolvePorts(config);
    const peers = discovery?.getPeers() || [];
    return {
      blipId: config.blipId,
      hostname: os.hostname(),
      localIp: getLocalIp(),
      localIpv4s: [...getLocalIpv4Set()],
      tcpPort,
      udpPort,
      discoveryActive: !!discovery?.socket,
      onlinePeers: peers.filter((p) => p.online).length,
      totalPeers: peers.length,
    };
  });

  ipcMain.handle('beacon-paths', async () => {
    await ensureBeaconSeedsRoot();
    return { seedsDir: getBeaconSeedsRoot() };
  });

  ipcMain.handle('beacon-udp-send', (_, payload) => {
    if (!payload || typeof payload !== 'object') return false;
    discovery?.broadcastPacket?.(payload);
    return true;
  });

  ipcMain.handle('send-tcp-message', async (_, payload) => {
    try {
      const socket = await ensurePeerSocket(payload.to);
      const type = payload.type || 'message';
      const packet = {
        type,
        from: config.blipId,
        to: payload.to,
      };
      const skip = new Set(['to', 'type']);
      for (const [key, val] of Object.entries(payload)) {
        if (skip.has(key) || val === undefined) continue;
        packet[key] = val;
      }
      packet.from = config.blipId;
      packet.to = payload.to;
      packet.type = type;

      if (type === 'message' && packet.text === undefined) {
        packet.text = '';
        packet.timestamp = payload.timestamp ?? Date.now();
      }
      if (type === 'typing' && packet.active === undefined) {
        packet.active = !!payload.active;
      }
      if (type === 'profile-gif-share' && packet.dataUrl) {
        const line = JSON.stringify(packet) + '\n';
        if (Buffer.byteLength(line, 'utf8') > 3_900_000) {
          return { ok: false, error: 'profile_gif_too_large' };
        }
      }
      await sendOnSocket(socket, packet);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('initiate-call', async (_, payload) => {
    try {
      const sdp = serializeSdp(payload.sdp);
      if (!sdp) return { ok: false, error: 'Invalid local SDP' };
      const packet = {
        type: 'call-offer',
        from: config.blipId,
        to: payload.to,
        sdp,
        video: payload.video ?? false,
      };
      try {
        await sendCallToPeer(payload.to, packet);
      } catch (err) {
        if (/peer not found/i.test(err?.message || '')) {
          await new Promise((r) => setTimeout(r, 450));
          await sendCallToPeer(payload.to, packet);
        } else {
          throw err;
        }
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('call-accept', async (_, payload) => {
    try {
      const sdp = serializeSdp(payload.sdp);
      if (!sdp) return { ok: false, error: 'Invalid local SDP' };
      await sendCallToPeer(payload.to, {
        type: 'call-answer',
        from: config.blipId,
        to: payload.to,
        sdp,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('call-reject', async (_, payload) => {
    try {
      await sendCallToPeer(payload.to, {
        type: 'call-reject',
        from: config.blipId,
        to: payload.to,
      });
      return { ok: true };
    } catch {
      return { ok: true };
    }
  });

  ipcMain.handle('call-candidate', async (_, payload) => {
    try {
      await sendCallToPeer(payload.to, {
        type: 'call-candidate',
        from: config.blipId,
        to: payload.to,
        candidate: payload.candidate,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('call-hangup', async (_, payload) => {
    try {
      if (Number(payload.to) === activeCallPeerId) activeCallPeerId = null;
      await sendCallToPeer(payload.to, {
        type: 'call-hangup',
        from: config.blipId,
        to: payload.to,
      });
      return { ok: true };
    } catch {
      activeCallPeerId = null;
      return { ok: true };
    }
  });

  ipcMain.handle('call-state', async (_, payload) => {
    try {
      await sendCallToPeer(payload.to, {
        type: 'call-state',
        from: config.blipId,
        to: payload.to,
        muted: !!payload.muted,
        deafened: !!payload.deafened,
        screenSharing: !!payload.screenSharing,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('call-renegotiate', async (_, payload) => {
    try {
      const sdp = serializeSdp(payload.sdp);
      if (!sdp) return { ok: false, error: 'Invalid local SDP' };
      await sendCallToPeer(payload.to, {
        type: 'call-renegotiate',
        from: config.blipId,
        to: payload.to,
        sdp,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('call-renegotiate-answer', async (_, payload) => {
    try {
      const sdp = serializeSdp(payload.sdp);
      if (!sdp) return { ok: false, error: 'Invalid local SDP' };
      await sendCallToPeer(payload.to, {
        type: 'call-renegotiate-answer',
        from: config.blipId,
        to: payload.to,
        sdp,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('ping-peer', async (_, blipId) => {
    const peer = findPeer(blipId);
    if (!peer) return false;
    return pingPeer(peer.ip, peer.tcpPort || resolvePorts(config).tcpPort);
  });

  ipcMain.handle('check-id-conflict', async (_, blipId) => {
    const peers = discovery?.getPeers() || [];
    const conflict = peers.find((p) => p.blipId === blipId && p.online);
    if (!conflict) return { taken: false };
    const responds = await pingPeer(
      conflict.ip,
      conflict.tcpPort || resolvePorts(config).tcpPort
    );
    return { taken: responds.ok };
  });

  ipcMain.handle('get-app-metadata', () => ({
    ...loadAppMetadata(),
    isPackaged: app.isPackaged,
  }));

  ipcMain.handle('get-app-icon-url', () => {
    const { iconUrl } = refreshAppIcons();
    return iconUrl || '';
  });

  ipcMain.handle('get-app-icon-variants', () => {
    return APP_ICON_VARIANTS.map((v) => {
      const p = resolveVariantWindowIconPath(v.id);
      return {
        id: v.id,
        tier: v.tier,
        previewUrl: existsSync(p) ? pathToFileURL(p).href : '',
      };
    });
  });

  ipcMain.handle('is-voice-call-active', () => {
    return !!(callWindow && !callWindow.isDestroyed());
  });

  ipcMain.handle('get-avatar-data-url', () => getCustomAvatarDataUrl());

  ipcMain.handle('save-avatar', async (_, dataUrl) => {
    try {
      saveCustomAvatar(dataUrl);
      config = saveConfig({ customAvatar: true });
      discovery?.announce();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.message || 'save_failed' };
    }
  });

  ipcMain.handle('clear-avatar', () => {
    clearCustomAvatar();
    config = saveConfig({ customAvatar: false });
    discovery?.announce();
    return { ok: true };
  });

  ipcMain.handle('get-profile-gif-active-url', () => getProfileGifDataUrl());
  ipcMain.handle('get-profile-gif-share-url', () => getProfileGifShareDataUrl());
  ipcMain.handle('get-profile-gif-history', () => listProfileGifHistory());
  ipcMain.handle('is-giphy-configured', () => isGiphyConfigured());
  ipcMain.handle('search-giphy', (_, query, offset) => searchGiphy(query, { offset }));
  ipcMain.handle('trending-giphy', (_, offset) => trendingGiphy({ offset }));

  ipcMain.handle('save-profile-gif', async (_, dataUrl) => {
    if (!resolveEntitlementState(config) || !config?.meshPlusLicenseId) {
      return { ok: false, error: 'mesh_plus_required' };
    }
    try {
      const id = saveProfileGifFromDataUrl(dataUrl);
      const pub = getProfileGifPublicState();
      config = saveConfig({
        profileGifActiveId: pub.profileGifActiveId,
        hasProfileGif: pub.hasProfileGif,
      });
      discovery?.announce();
      return { ok: true, id, dataUrl: getProfileGifDataUrl(id) };
    } catch (e) {
      return { ok: false, error: e?.message || 'save_failed' };
    }
  });

  ipcMain.handle('save-profile-gif-bytes', async (_, base64) => {
    if (!resolveEntitlementState(config) || !config?.meshPlusLicenseId) {
      return { ok: false, error: 'mesh_plus_required' };
    }
    try {
      const buf = Buffer.from(String(base64 || ''), 'base64');
      if (!buf.length) return { ok: false, error: 'invalid_gif' };
      const id = saveProfileGifFromBuffer(buf);
      const pub = getProfileGifPublicState();
      config = saveConfig({
        profileGifActiveId: pub.profileGifActiveId,
        hasProfileGif: pub.hasProfileGif,
      });
      discovery?.announce();
      return { ok: true, id, dataUrl: getProfileGifDataUrl(id) };
    } catch (e) {
      return { ok: false, error: e?.message || 'save_failed' };
    }
  });

  ipcMain.handle('save-profile-gif-path', async (_, filePath) => {
    if (!resolveEntitlementState(config) || !config?.meshPlusLicenseId) {
      return { ok: false, error: 'mesh_plus_required' };
    }
    try {
      const p = String(filePath || '').trim();
      if (!p) return { ok: false, error: 'invalid_gif' };
      const buf = readFileSync(p);
      const id = saveProfileGifFromBuffer(buf);
      const pub = getProfileGifPublicState();
      config = saveConfig({
        profileGifActiveId: pub.profileGifActiveId,
        hasProfileGif: pub.hasProfileGif,
      });
      discovery?.announce();
      return { ok: true, id, dataUrl: getProfileGifDataUrl(id) };
    } catch (e) {
      return { ok: false, error: e?.message || 'save_failed' };
    }
  });

  ipcMain.handle('import-giphy-gif', async (_, gifUrl) => {
    try {
      const buf = await downloadGifUrl(gifUrl);
      const id = saveProfileGifFromBuffer(buf);
      const pub = getProfileGifPublicState();
      config = saveConfig({
        profileGifActiveId: pub.profileGifActiveId,
        hasProfileGif: pub.hasProfileGif,
      });
      discovery?.announce();
      return { ok: true, id, dataUrl: getProfileGifDataUrl(id) };
    } catch (e) {
      return { ok: false, error: e?.message || 'import_failed' };
    }
  });

  ipcMain.handle('set-profile-gif-active', (_, id) => {
    try {
      if (!id) {
        clearActiveProfileGif();
      } else {
        setActiveProfileGif(id);
      }
      const pub = getProfileGifPublicState();
      config = saveConfig({
        profileGifActiveId: pub.profileGifActiveId,
        hasProfileGif: pub.hasProfileGif,
      });
      discovery?.announce();
      return { ok: true, dataUrl: getProfileGifDataUrl() };
    } catch (e) {
      return { ok: false, error: e?.message || 'set_failed' };
    }
  });

  ipcMain.handle('clear-profile-gif', () => {
    clearActiveProfileGif();
    const pub = getProfileGifPublicState();
    config = saveConfig({
      profileGifActiveId: '',
      hasProfileGif: false,
    });
    discovery?.announce();
    return { ok: true };
  });

  ipcMain.handle('check-for-updates', () => checkForUpdatesNow(() => config));
  ipcMain.handle('quit-and-install', () => {
    quitAndInstallUpdater();
    return { ok: true };
  });

  ipcMain.handle('show-message-notification', (_, payload) => {
    if (config?.doNotDisturb) return { ok: false, reason: 'dnd' };
    return showDesktopNotification(payload);
  });

  ipcMain.handle('list-display-sources', () => listDisplaySources());

  ipcMain.handle('prepare-display-capture', (_, sourceId) => {
    if (typeof sourceId !== 'string' || !sourceId) return { ok: false };
    setPendingDisplaySource(sourceId);
    return { ok: true };
  });

  ipcMain.handle('open-external', async (_, url) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return { ok: false };
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle('get-group-for-call', async (_, groupId) => readGroupFromMainWindow(groupId));

  ipcMain.handle('open-call-outgoing', async (_, payload) => {
    try {
      const peerId = Number(payload?.peerId);
      if (!Number.isFinite(peerId)) return { ok: false, error: 'invalid_peer' };
      const peer = findPeer(peerId);
      if (!peer) return { ok: false, error: 'Peer not found' };
      await ensurePeerSocket(peerId);
      activeCallPeerId = peerId;
      await sendToCallWindow(
        'call-outgoing',
        { peerId, video: payload.video ?? false },
        { focus: true }
      );
      return { ok: true };
    } catch (err) {
      activeCallPeerId = null;
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('close-call-window', () => {
    if (callWindow && !callWindow.isDestroyed()) {
      callWindow.hide();
    }
    return true;
  });

  ipcMain.handle('open-group-call', async (_, payload) => {
    try {
      await sendToGroupCallWindow(
        'group-call-join',
        { groupId: payload?.groupId, skipInvite: !!payload?.skipInvite },
        { focus: true }
      );
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('open-group-call-incoming', async (_, payload) => {
    await sendToGroupCallWindow('group-call-incoming', payload || {}, { focus: true });
    return { ok: true };
  });

  ipcMain.handle('leave-group-call', async () => {
    await sendToGroupCallWindow('group-call-leave', {}, { focus: false });
    return { ok: true };
  });

  ipcMain.handle('close-group-call-window', () => {
    if (groupCallWindow && !groupCallWindow.isDestroyed()) {
      groupCallWindow.hide();
    }
    return true;
  });

  ipcMain.on('group-call-active', (_, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('group-call-active', data);
    }
  });

  ipcMain.on('sync-group-call-roster', (_, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('group-call-roster-sync', data);
    }
  });

  ipcMain.on('call-window-ready', () => {
    callWindowReady = true;
    flushCallWindowQueue();
  });

  ipcMain.on('group-call-window-ready', () => {
    groupCallWindowReady = true;
    flushGroupCallWindowQueue();
  });

  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window-close', () => mainWindow?.close());
  ipcMain.on('call-window-minimize', () => callWindow?.minimize());
  ipcMain.on('call-window-maximize', () => {
    if (!callWindow || callWindow.isDestroyed()) return;
    if (callWindow.isMaximized()) callWindow.unmaximize();
    else callWindow.maximize();
  });
  ipcMain.on('call-window-close', () => {
    if (callWindow && !callWindow.isDestroyed()) callWindow.hide();
  });
  ipcMain.handle('call-window-toggle-fullscreen', () => {
    if (!callWindow || callWindow.isDestroyed()) return false;
    const next = !callWindow.isFullScreen();
    callWindow.setFullScreen(next);
    return next;
  });
  ipcMain.handle('call-window-is-fullscreen', () => {
    if (!callWindow || callWindow.isDestroyed()) return false;
    return callWindow.isFullScreen();
  });

  ipcMain.on('group-call-window-minimize', () => groupCallWindow?.minimize());
  ipcMain.on('group-call-window-maximize', () => {
    if (!groupCallWindow || groupCallWindow.isDestroyed()) return;
    if (groupCallWindow.isMaximized()) groupCallWindow.unmaximize();
    else groupCallWindow.maximize();
  });
  ipcMain.on('group-call-window-close', () => {
    void sendToGroupCallWindow('group-call-leave', {}, { focus: false });
    if (groupCallWindow && !groupCallWindow.isDestroyed()) groupCallWindow.hide();
  });
}

function showFatalPortDialog(err) {
  const { tcpPort, udpPort } = resolvePorts(config);
  const extra =
    err?.code === 'EADDRINUSE'
      ? 'Another BLIP window or another program is probably already listening on those ports.'
      : 'Check firewall settings and ensure no orphaned BLIP process is running.';
  dialog.showErrorBox(
    'BLIP — network error',
    [
      `Could not open networking (TCP ${tcpPort}, UDP ${udpPort}).`,
      '',
      extra,
      '',
      'Close the duplicate instance, or run one instance with BLIP_TCP_PORT and BLIP_UDP_PORT set to free ports.',
      '',
      `${err?.code ?? ''} ${err?.message ?? String(err)}`.trim(),
    ].join('\n')
  );
}

function setupMediaPermissions() {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allow = permission === 'media' || permission === 'display-capture';
    callback(allow);
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'media' || permission === 'display-capture';
  });

  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const pick = await resolveDisplaySourceForCallback();
      if (!pick) {
        callback({});
        return;
      }
      callback({ video: pick, audio: false });
    } catch (err) {
      console.warn('[BLIP] display media:', err.message);
      callback({});
    }
  });
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.blip.messenger');
  }

  setupMediaPermissions();

  initConfigPath();
  config = loadConfig();
  initAppTrustState(config);
  const gifPub = getProfileGifPublicState();
  if (
    config.hasProfileGif !== gifPub.hasProfileGif ||
    config.profileGifActiveId !== gifPub.profileGifActiveId
  ) {
    config = saveConfig({
      profileGifActiveId: gifPub.profileGifActiveId,
      hasProfileGif: gifPub.hasProfileGif,
    });
  }
  const meshClamp = premiumResetPatch(config);
  if (meshClamp && !resolveEntitlementState(config)) {
    config = saveConfig(meshClamp);
  }
  const hadMeshKeys = !!(config.meshPrivateKey && config.meshPublicKey);
  config = ensureMeshIdentity(config);
  if (!hadMeshKeys && config.meshPrivateKey) {
    config = saveConfig({
      meshPublicKey: config.meshPublicKey,
      meshPrivateKey: config.meshPrivateKey,
    });
  }

  try {
    await bootstrapNetworking();
  } catch (err) {
    await rollbackNetworking(err);
    showFatalPortDialog(err);
    app.quit();
    return;
  }

  applyLaunchAtLogin(!!config.launchAtLogin);

  setupIpc();
  createWindow();
  broadcastTrustState();
  refreshAppIcons();
  installTray();
  void ensureCallWindow().catch((e) => console.warn('[BLIP] prewarm call window', e));
  void ensureGroupCallWindow().catch((e) => console.warn('[BLIP] prewarm group call window', e));
  setupAutoUpdater(() => mainWindow, () => config);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

async function hangupActiveCallIfAny() {
  const peer = activeCallPeerId;
  if (!peer || !config?.blipId) return;
  activeCallPeerId = null;
  try {
    await sendCallToPeer(peer, {
      type: 'call-hangup',
      from: config.blipId,
      to: peer,
    });
  } catch {
    /* peer may be offline */
  }
}

app.on('before-quit', () => {
  appIsQuitting = true;
  void hangupActiveCallIfAny();
  unregisterGlobalShortcuts();
  destroyTray();
});

app.on('window-all-closed', () => {
  void stopNetwork();
  if (process.platform !== 'darwin') app.quit();
});
