import { globalShortcut } from 'electron';

let active = false;

export function unregisterGlobalShortcuts() {
  if (!active) return;
  globalShortcut.unregisterAll();
  active = false;
}

/**
 * @param {object} opts
 * @param {boolean} [opts.enabled]
 * @param {() => import('electron').BrowserWindow | null} opts.getMainWindow
 * @param {() => import('electron').BrowserWindow | null} opts.getCallWindow
 */
export function registerGlobalShortcuts({ enabled = true, getMainWindow, getCallWindow }) {
  unregisterGlobalShortcuts();
  if (enabled === false) return;

  const focusMain = (send) => {
    const win = getMainWindow?.();
    if (!win || win.isDestroyed()) return;
    if (!win.isVisible()) win.show();
    win.focus();
    send(win);
  };

  const bindings = [
    ['Alt+1', () => focusMain((w) => w.webContents.send('global-navigate', { view: 'dial' }))],
    ['Alt+2', () => focusMain((w) => w.webContents.send('global-navigate', { view: 'peers' }))],
    ['Alt+3', () => focusMain((w) => w.webContents.send('global-navigate', { view: 'chat' }))],
    ['Alt+4', () => focusMain((w) => w.webContents.send('global-navigate', { view: 'settings' }))],
    [
      'CommandOrControl+,',
      () => focusMain((w) => w.webContents.send('global-navigate', { view: 'settings' })),
    ],
    ['CommandOrControl+Shift+D', () => focusMain((w) => w.webContents.send('global-toggle-dnd'))],
    [
      'CommandOrControl+Shift+End',
      () => {
        const cw = getCallWindow?.();
        if (cw && !cw.isDestroyed()) {
          cw.show();
          cw.focus();
          cw.webContents.send('global-hangup');
        }
      },
    ],
  ];

  for (const [accel, handler] of bindings) {
    try {
      const ok = globalShortcut.register(accel, handler);
      if (!ok) console.warn('[BLIP] shortcut not registered:', accel);
    } catch (err) {
      console.warn('[BLIP] shortcut', accel, err.message);
    }
  }
  active = true;
}
