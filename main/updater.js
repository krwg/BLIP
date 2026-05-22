import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, rmSync } from 'fs';
import electronUpdater from 'electron-updater';
import {
  fetchGithubReleases,
  getGithubPublishConfig,
  loadGithubRepo,
} from './github-releases.js';

const updaterModule = electronUpdater.default ?? electronUpdater;
const { autoUpdater } = updaterModule;

let getMainWindow = () => null;
let getConfigRef = () => null;
let listenersAttached = false;
let retryingAfterStaleFeed = false;

/** @param {object} [config] */
export function configureAutoUpdater(config) {
  if (!app.isPackaged) return Promise.resolve();
  return applyUpdateFeed(config);
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

async function releaseHasUpdateManifest(tag) {
  const version = String(tag || '').replace(/^v/i, '');
  if (!version) return false;
  const repo = loadGithubRepo();
  const url = `https://github.com/${repo}/releases/download/${version}/latest.yml`;
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return res.ok;
  } catch {
    return false;
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
    if (version && !(await releaseHasUpdateManifest(version))) {
      clearUpdaterCache();
    }
  } catch {
    clearUpdaterCache();
  }
}

/**
 * electron-updater with allowPrerelease reads releases.atom, which still lists
 * deleted releases (orphan tags). Use GitHub REST + generic feed for betas instead.
 * @param {object} [config]
 */
function isUnsignedInstallerError(err) {
  const msg = err?.message || String(err);
  return /not signed by the application owner|not digitally signed|SignerCertificate/i.test(
    msg
  );
}

async function applyUpdateFeed(config) {
  autoUpdater.allowPrerelease = false;
  autoUpdater.autoDownload = config?.autoDownloadUpdates !== false;
  // GitHub releases are not Authenticode-signed; without this, Windows blocks install.
  if (process.platform === 'win32') {
    autoUpdater.verifyUpdateCodeSignature = false;
  }

  const receiveBeta = !!config?.receiveBetaUpdates;
  if (receiveBeta) {
    const result = await fetchGithubReleases(15);
    if (result.ok) {
      for (const release of result.releases) {
        if (!release.prerelease || !release.tag) continue;
        const tag = release.tag.replace(/^v/i, '');
        if (await releaseHasUpdateManifest(tag)) {
          const repo = loadGithubRepo();
          autoUpdater.setFeedURL({
            provider: 'generic',
            url: `https://github.com/${repo}/releases/download/${tag}/`,
          });
          return;
        }
      }
    }
    console.warn('[BLIP] No valid prerelease with latest.yml; using stable feed');
  }

  autoUpdater.setFeedURL(getGithubPublishConfig());
}

function isStaleFeedError(err) {
  const msg = err?.message || String(err);
  return /latest\.yml|CHANNEL_FILE_NOT_FOUND|release artifacts/i.test(msg);
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
  if (!app.isPackaged) return;

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
  if (!app.isPackaged) return { ok: false, skipped: true };
  attachListeners();
  if (typeof getConfig === 'function') await configureAutoUpdater(getConfig());
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function quitAndInstallUpdater() {
  if (!app.isPackaged) return;
  autoUpdater.quitAndInstall(false, true);
}
