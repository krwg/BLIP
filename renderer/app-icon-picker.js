import { t } from './i18n.js';
import { premiumTierEnabled } from './mesh-plus.js';
import { showAppToast } from './toasts.js';
import { buildSectionSubtitleRow } from './settings-ui.js';

const FREE_ICON_IDS = ['main', 'dop-1', 'dop-2', 'dop-3', 'dop-4'];
const MESH_ICON_IDS = ['mesh-1', 'mesh-2', 'mesh-3', 'mesh-4', 'mesh-5', 'mesh-6'];

const ICON_PREVIEW_PX = 96;
const ICON_LIGHTBOX_PX = 256;

function openAppIconPreview(src, label = '') {
  if (!src) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'blip-modal-backdrop app-icon-preview-backdrop';

  const box = document.createElement('div');
  box.className = 'app-icon-preview-box glass';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  if (label) box.setAttribute('aria-label', label);

  const img = document.createElement('img');
  img.className = 'app-icon-preview-img';
  img.src = src;
  img.alt = label;
  img.width = ICON_LIGHTBOX_PX;
  img.height = ICON_LIGHTBOX_PX;

  function close() {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);

  box.appendChild(img);
  backdrop.appendChild(box);
  document.body.appendChild(backdrop);
}

export function appendAppIconPickerSections(block, state, saveConfig) {
  block.appendChild(
    buildSectionSubtitleRow('settings.app_icon_free_title', 'settings.app_icon_preview_hint')
  );

  const freeGrid = document.createElement('div');
  freeGrid.className = 'settings-app-icon-grid';
  block.appendChild(freeGrid);

  block.appendChild(
    buildSectionSubtitleRow('settings.app_icon_mesh_title', 'settings.app_icon_mesh_hint')
  );

  const meshGrid = document.createElement('div');
  meshGrid.className = 'settings-app-icon-grid settings-app-icon-grid--mesh';
  block.appendChild(meshGrid);

  let variants = [];

  function renderTile(grid, id, tier) {
    const meta = variants.find((v) => v.id === id);
    const btn = document.createElement('button');
    btn.type = 'button';
    const selected = (state.config?.appIconVariant || 'main') === id;
    btn.className = `settings-app-icon-tile${selected ? ' selected' : ''}${
      tier === 'mesh_plus' && !premiumTierEnabled(state.config)
        ? ' settings-app-icon-tile--locked'
        : ''
    }`;
    btn.dataset.iconId = id;
    btn.setAttribute('aria-label', id);

    const img = document.createElement('img');
    img.className = 'settings-app-icon-tile__img';
    img.alt = '';
    img.width = ICON_PREVIEW_PX;
    img.height = ICON_PREVIEW_PX;
    if (meta?.previewUrl) img.src = meta.previewUrl;

    btn.appendChild(img);

    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (meta?.previewUrl) openAppIconPreview(meta.previewUrl, id);
    });

    btn.addEventListener('click', async () => {
      if (tier === 'mesh_plus' && !premiumTierEnabled(state.config)) {
        showAppToast({
          title: t('settings.app_icon_mesh_locked'),
          durationMs: 4200,
        });
        return;
      }
      if ((state.config?.appIconVariant || 'main') === id) return;
      state.config = await saveConfig({ appIconVariant: id });
      try {
        await window.blip.getAppIconUrl?.();
      } catch {

      }
      freeGrid.querySelectorAll('.settings-app-icon-tile').forEach((el) => {
        el.classList.toggle('selected', el.dataset.iconId === state.config.appIconVariant);
      });
      meshGrid.querySelectorAll('.settings-app-icon-tile').forEach((el) => {
        el.classList.toggle('selected', el.dataset.iconId === state.config.appIconVariant);
      });
      showAppToast({
        title: t('settings.app_icon_applied'),
        durationMs: 2800,
      });
    });

    grid.appendChild(btn);
  }

  void (async () => {
    try {
      variants = (await window.blip.getAppIconVariants?.()) || [];
    } catch {
      variants = [];
    }
    freeGrid.innerHTML = '';
    meshGrid.innerHTML = '';
    for (const id of FREE_ICON_IDS) renderTile(freeGrid, id, 'free');
    for (const id of MESH_ICON_IDS) renderTile(meshGrid, id, 'mesh_plus');
  })();
}
