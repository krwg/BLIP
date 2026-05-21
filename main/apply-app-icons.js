import { nativeImage } from 'electron';
import { pathToFileURL } from 'url';
import {
  resolveAppIconVariant,
  resolveVariantTrayIconPath,
  resolveVariantWindowIconPath,
} from './app-icons.js';
import { setTrayIconPath } from './tray.js';

/**
 * @param {object} config
 * @param {{
 *   mainWindow?: import('electron').BrowserWindow | null;
 *   callWindow?: import('electron').BrowserWindow | null;
 *   groupCallWindow?: import('electron').BrowserWindow | null;
 * }} wins
 */
export function applyAppIcons(config, wins = {}) {
  const variantId = resolveAppIconVariant(config);
  const winPath = resolveVariantWindowIconPath(variantId);
  const trayPath = resolveVariantTrayIconPath(variantId);
  const image = nativeImage.createFromPath(winPath);

  for (const w of [wins.mainWindow, wins.callWindow, wins.groupCallWindow]) {
    if (w && !w.isDestroyed()) {
      try {
        w.setIcon(image);
      } catch {
        /* ignore */
      }
    }
  }

  setTrayIconPath(trayPath);
  return { variantId, winPath, trayPath, iconUrl: pathToFileURL(winPath).href };
}
