import { Tray, Menu, nativeImage } from 'electron';
import { existsSync } from 'fs';
import { resolveBuildAsset } from './paths.js';

let tray = null;
let trayIconPath = null;
let baseTrayTooltip = 'BLIP';

function createTrayIconFromPath(trayPath) {
  if (trayPath && existsSync(trayPath)) {
    return nativeImage.createFromPath(trayPath);
  }

  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const accent = (x + y) % 3 === 0;
      canvas[i] = accent ? 0 : 10;
      canvas[i + 1] = accent ? 255 : 10;
      canvas[i + 2] = accent ? 200 : 10;
      canvas[i + 3] = 255;
    }
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function createTrayIcon() {
  return createTrayIconFromPath(trayIconPath) || createTrayIconFallback();
}

export function setTrayBaseTooltip(tooltip) {
  baseTrayTooltip = tooltip || 'BLIP';
  if (tray && !tray.isDestroyed?.()) {
    tray.setToolTip(baseTrayTooltip);
  }
}

export function setTrayTransferProgress(info) {
  if (!tray || tray.isDestroyed?.()) return;
  const pct = Math.round(Number(info?.percent) || 0);
  if (info && pct > 0 && pct < 100) {
    const label = String(info.label || 'Transfer').trim();
    tray.setToolTip(`${baseTrayTooltip} — ${label} ${pct}%`);
  } else {
    tray.setToolTip(baseTrayTooltip);
  }
}

export function destroyTray() {
  if (!tray) return;
  try {
    tray.removeAllListeners();
    tray.destroy();
  } catch {

  }
  tray = null;
}

export function setTrayIconPath(path) {
  trayIconPath = path || null;
  if (tray && !tray.isDestroyed?.()) {
    try {
      tray.setImage(createTrayIconFromPath(trayIconPath) || createTrayIconFallback());
    } catch {

    }
  }
}

function createTrayIconFallback() {
  return createTrayIconFromPath(resolveBuildAsset('tray-16.png'));
}

export function createTray(opts) {
  destroyTray();
  const { getMainWindow, tooltip, onQuit, labels, iconPath } = opts;
  trayIconPath = iconPath || trayIconPath || resolveBuildAsset('tray-16.png');
  const L = { show: labels?.show || 'Show', quit: labels?.quit || 'Quit' };
  try {
    tray = new Tray(createTrayIconFromPath(trayIconPath) || createTrayIconFallback());
    baseTrayTooltip = tooltip || 'BLIP';
    tray.setToolTip(baseTrayTooltip);

    const showMain = () => {
      const w = getMainWindow();
      if (!w || w.isDestroyed()) return;
      if (!w.isVisible()) w.show();
      w.focus();
    };

    const menu = Menu.buildFromTemplate([
      {
        label: L.show,
        click: showMain,
      },
      { type: 'separator' },
      {
        label: L.quit,
        click: () => {
          void onQuit();
        },
      },
    ]);
    tray.setContextMenu(menu);
    tray.on('click', showMain);
    tray.on('double-click', showMain);
  } catch {
    tray = null;
  }
}
