import { nativeImage } from 'electron';
import { pathToFileURL } from 'url';
import {
  resolveAppIconVariant,
  resolveVariantTrayIconPath,
  resolveVariantWindowIconPath,
} from './app-icons.js';
import { setTrayIconPath } from './tray.js';

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

      }
    }
  }

  setTrayIconPath(trayPath);
  return { variantId, winPath, trayPath, iconUrl: pathToFileURL(winPath).href };
}
