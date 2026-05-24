import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, rmSync } from 'fs';
import electronUpdater from 'electron-updater';
import {
  releaseHasUpdateManifest,
  releaseTagCandidates,
  resolveUpdateFeedUrl,
} from './github-releases.js';

const updaterModule = electronUpdater.default ?? electronUpdater;
const { autoUpdater } = updaterModule;

let getMainWindow = () => null;
let getConfigRef = () => null;
let listenersAttached = false;
let retryingAfterStaleFeed = false;
/** @type {string | null} */
let activeFeedTag = null;

export function isPortableInstall() {
  return !!(
    process.env.PORTABLE_EXECUTABLE_DIR ||
    process.env.PORTABLE_EXECUTABLE_FILE
  );
}

/** @param {object} [config] */
export async function configureAutoUpdater(config) {
  if (!app.isPackaged || isPortableInstall()) return;
  await applyUpdateFeed(config);
}

function getUpdaterCacheDir() {
  const localAppData =
    process.env.LOCALAPPDATA || join(app.getPath('home'), 'AppData', 'Local');
  const name = (app.getName() || 'blip').toLowerCase();
  return join(localAppData, `${name}-updater`);
}

export function clearUpdaterCache() {
  const dir = getUpdaterCacheDir();
  try {
    const pending = join(dir, 'pending');
    if (existsSync(pending)) {
      rmSync(pending, { recursive: true, force: true });
    }
    const installer = join(dir, 'installer.exe');
    if (existsSync(installer)) rmSync(installer, { force: true });
  } catch (e) {
    console.warn('[BLIP] clearUpdaterCache', e);
  }
}

async function sanitizeUpdaterCacheOnStartup() {
  const pendingInfo = join(getUpdaterCacheDir(), 'pending', 'update-info.json');
  if (!existsSync(pendingInfo)) return;
  try {
    const info = JSON.parse(readFileSync(pendingInfo, 'utf8'));
    const fileName = info?.fileName || '';
    const match =
      fileName.match(/Setup-(.+?)\.exe/i) ||
      fileName.match(/BLIP-(.+?)-Portable/i) ||
      fileName.match(/(\d+\.\d+\.\d+[^\s/]*)/);
    const version = match?.[1]?.replace(/^v/i, '');
    if (version) {
      let ok = false;
      for (const tag of releaseTagCandidates(version)) {
        if (await releaseHasUpdateManifest(tag)) {
          ok = true;
          break;
        }
      }
      if (!ok) clearUpdaterCache();
    }
  } catch {
    clearUpdaterCache();
  }
}

function isUnsignedInstallerError(err) {
  const msg = err?.message || String(err);
  return /not signed by the application owner|not digitally signed|SignerCertificate/i.test(
    msg
  );
}

/**
 * @param {object} [config]
 */
async function applyUpdateFeed(config) {
  autoUpdater.allowPrerelease = false;
  autoUpdater.autoDownload = config?.autoDownloadUpdates !== false;
  autoUpdater.autoInstallOnAppQuit = config?.autoDownloadUpdates !== false;
  autoUpdater.disableDifferentialDownload = true;

  // electron-updater ignores `false` — setter only applies truthy values (NsisUpdater.js).
  // Unsigned GitHub installers must skip Authenticode verification explicitly.
  if (process.platform === 'win32') {
    autoUpdater.verifyUpdateCodeSignature = async () => null;
  }

  const feed = await resolveUpdateFeedUrl(config);
  activeFeedTag = feed.channelTag || null;

  if (feed.provider === 'generic' && feed.url) {
    autoUpdater.setFeedURL({ provider: 'generic', url: feed.url });
    console.info('[BLIP] updater feed', feed.url);
    return;
  }

  const { provider, owner, repo } = feed;
  autoUpdater.setFeedURL({ provider, owner, repo });
  console.info('[BLIP] updater feed github', `${owner}/${repo}`);
}

function isStaleFeedError(err) {
  const msg = err?.message || String(err);
  return /latest\.yml|CHANNEL_FILE_NOT_FOUND|release artifacts|404/i.test(msg);
}

function notify(payload) {
  const w = getMainWindow();
  if (w && !w.isDestroyed()) {
    w.webContents.send('update-status', payload);
  }
}

async function recoverFromStaleFeed() {
  if (retryingAfterStaleFeed) return false;
  retryingAfterStaleFeed = true;
  try {
    clearUpdaterCache();
    const cfg = typeof getConfigRef === 'function' ? getConfigRef() : {};
    await applyUpdateFeed({ ...cfg, receiveBetaUpdates: false });
    await autoUpdater.checkForUpdates();
    return true;
  } catch (e) {
    console.warn('[BLIP] recoverFromStaleFeed', e);
    return false;
  } finally {
    retryingAfterStaleFeed = false;
  }
}

function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  autoUpdater.on('checking-for-update', () => notify({ state: 'checking' }));
  autoUpdater.on('update-available', (info) =>
    notify({ state: 'available', version: info?.version })
  );
  autoUpdater.on('update-not-available', () => notify({ state: 'none' }));
  autoUpdater.on('error', (err) => {
    if (isStaleFeedError(err)) {
      void recoverFromStaleFeed().then((recovered) => {
        if (!recovered) {
          notify({
            state: 'error',
            code: 'stale_release',
            message: err?.message || String(err),
          });
        }
      });
      return;
    }
    if (isUnsignedInstallerError(err)) {
      clearUpdaterCache();
      notify({ state: 'error', code: 'unsigned_installer' });
      return;
    }
    notify({ state: 'error', message: err?.message || String(err) });
  });
  autoUpdater.on('download-progress', (p) =>
    notify({ state: 'progress', percent: Math.floor(p.percent) })
  );
  autoUpdater.on('update-downloaded', (info) =>
    notify({ state: 'downloaded', version: info?.version })
  );
}

/**
 * @param {() => import('electron').BrowserWindow | null} getWindow
 * @param {() => object | null} getConfig
 */
export function setupAutoUpdater(getWindow, getConfig) {
  getMainWindow = getWindow;
  getConfigRef = getConfig;
  if (!app.isPackaged || isPortableInstall()) return;

  attachListeners();
  void (async () => {
    await sanitizeUpdaterCacheOnStartup();
    await configureAutoUpdater(typeof getConfig === 'function' ? getConfig() : null);
    setTimeout(() => {
      void autoUpdater.checkForUpdates().catch((err) => {
        console.warn('[BLIP] checkForUpdates', err);
      });
    }, 6000);
  })();
}

export async function checkForUpdatesNow(getConfig) {
  if (!app.isPackaged) return { ok: false, skipped: true, reason: 'dev' };
  if (isPortableInstall()) {
    return { ok: false, skipped: true, reason: 'portable' };
  }
  attachListeners();
  if (typeof getConfig === 'function') await configureAutoUpdater(getConfig());
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true, channelTag: activeFeedTag };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function quitAndInstallUpdater() {
  if (!app.isPackaged || isPortableInstall()) return;
  autoUpdater.quitAndInstall(false, true);
}
