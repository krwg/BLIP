import { t } from './i18n.js';
import { openGifCropDialog } from './gif-crop-dialog.js';
import { showAppToast } from './toasts.js';

function bytesToBase64(bytes) {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function toastProfileGifError(error) {
  const key =
    error === 'mesh_plus_required'
      ? 'mesh_plus.feature_locked'
      : error === 'gif_too_large'
      ? 'settings.profile_gif_too_large'
      : error === 'invalid_gif'
        ? 'settings.profile_gif_invalid'
        : 'settings.profile_gif_save_failed';
  showAppToast({ title: t(key), variant: 'danger', durationMs: 4500 });
}

function appendGifPickerTile(parent, sources, alt, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'profile-gif-picker-tile';
  const img = document.createElement('img');
  img.alt = alt || '';
  img.loading = 'lazy';
  img.decoding = 'async';
  const urls = [...new Set(sources.filter(Boolean))];
  let urlIdx = 0;
  img.src = urls[0] || '';
  img.onerror = () => {
    urlIdx += 1;
    if (urls[urlIdx]) img.src = urls[urlIdx];
    else btn.classList.add('profile-gif-picker-tile--broken');
  };
  btn.appendChild(img);
  if (alt) btn.title = alt;
  btn.addEventListener('click', onClick);
  parent.appendChild(btn);
  return btn;
}

async function saveLocalGifFile(file) {
  const isGif =
    file.type === 'image/gif' || /\.gif$/i.test(file.name || '');
  if (!isGif) {
    showAppToast({ title: t('settings.profile_gif_invalid'), variant: 'danger', durationMs: 4000 });
    return false;
  }
  const confirmed = await openGifCropDialog(file);
  if (!confirmed) return false;
  let r;
  if (file.path && window.blip.saveProfileGifPath) {
    r = await window.blip.saveProfileGifPath(file.path);
  } else {
    const bytes = new Uint8Array(await file.arrayBuffer());
    r = await window.blip.saveProfileGifBytes?.(bytesToBase64(bytes));
  }
  if (!r?.ok) {
    toastProfileGifError(r?.error);
    return false;
  }
  showAppToast({ title: t('settings.profile_gif_saved'), durationMs: 3000 });
  return true;
}

export function openProfileGifPicker(opts = {}) {
  return new Promise((resolve) => {
    let changed = false;
    let activeTab = 'mine';

    const backdrop = document.createElement('div');
    backdrop.className = 'blip-modal-backdrop profile-gif-picker-backdrop';

    const modal = document.createElement('div');
    modal.className = 'blip-modal glass profile-gif-picker-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const title = document.createElement('h3');
    title.className = 'blip-modal-title';
    title.dataset.i18n = 'settings.profile_gif_picker_title';
    title.textContent = t('settings.profile_gif_picker_title');

    const tabs = document.createElement('div');
    tabs.className = 'profile-gif-picker-tabs';
    const tabMine = document.createElement('button');
    tabMine.type = 'button';
    tabMine.className = 'btn btn-lang profile-gif-picker-tab selected';
    tabMine.dataset.tab = 'mine';
    tabMine.dataset.i18n = 'settings.profile_gif_tab_mine';
    tabMine.textContent = t('settings.profile_gif_tab_mine');
    const tabOnline = document.createElement('button');
    tabOnline.type = 'button';
    tabOnline.className = 'btn btn-lang profile-gif-picker-tab';
    tabOnline.dataset.tab = 'online';
    tabOnline.dataset.i18n = 'settings.profile_gif_tab_online';
    tabOnline.textContent = t('settings.profile_gif_tab_online');
    tabs.appendChild(tabMine);
    tabs.appendChild(tabOnline);

    const body = document.createElement('div');
    body.className = 'profile-gif-picker-body';

    const minePanel = document.createElement('div');
    minePanel.className = 'profile-gif-picker-panel';
    const mineGrid = document.createElement('div');
    mineGrid.className = 'profile-gif-picker-grid';
    minePanel.appendChild(mineGrid);

    const uploadRow = document.createElement('div');
    uploadRow.className = 'profile-gif-picker-upload-row';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/gif';
    fileInput.className = 'settings-avatar-file-input';
    const uploadBtn = document.createElement('label');
    uploadBtn.className = 'btn btn-accent';
    uploadBtn.dataset.i18n = 'settings.profile_gif_upload';
    uploadBtn.textContent = t('settings.profile_gif_upload');
    uploadBtn.htmlFor = '';
    const inputId = `profile-gif-file-${Date.now()}`;
    fileInput.id = inputId;
    uploadBtn.htmlFor = inputId;
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn btn-lang';
    clearBtn.dataset.i18n = 'settings.profile_gif_clear';
    clearBtn.textContent = t('settings.profile_gif_clear');
    uploadRow.appendChild(fileInput);
    uploadRow.appendChild(uploadBtn);
    uploadRow.appendChild(clearBtn);
    minePanel.appendChild(uploadRow);

    const onlinePanel = document.createElement('div');
    onlinePanel.className = 'profile-gif-picker-panel hidden';
    const searchRow = document.createElement('div');
    searchRow.className = 'profile-gif-picker-search';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'input';
    searchInput.placeholder = t('settings.profile_gif_search');
    searchInput.dataset.i18nPlaceholder = 'settings.profile_gif_search';
    const searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.className = 'btn btn-accent';
    searchBtn.dataset.i18n = 'settings.profile_gif_search_btn';
    searchBtn.textContent = t('settings.profile_gif_search_btn');
    searchRow.appendChild(searchInput);
    searchRow.appendChild(searchBtn);
    const onlineHint = document.createElement('p');
    onlineHint.className = 'hint profile-gif-picker-online-hint';
    const onlineGrid = document.createElement('div');
    onlineGrid.className = 'profile-gif-picker-grid';
    onlinePanel.appendChild(searchRow);
    onlinePanel.appendChild(onlineHint);
    onlinePanel.appendChild(onlineGrid);

    body.appendChild(minePanel);
    body.appendChild(onlinePanel);

    const actions = document.createElement('div');
    actions.className = 'blip-modal-actions';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-lang';
    closeBtn.textContent = t('dialog.cancel');

    let done = false;
    function finish(ok) {
      if (done) return;
      done = true;
      backdrop.remove();
      resolve(ok);
    }

    async function selectLocalId(id) {
      const r = await window.blip.setProfileGifActive?.(id);
      if (r?.ok) {
        changed = true;
        opts.onSelected?.();
        await renderMine();
      }
    }

    async function renderMine() {
      mineGrid.innerHTML = '';
      const history = (await window.blip.getProfileGifHistory?.()) || [];
      const activeUrl = await window.blip.getProfileGifActiveUrl?.();
      if (history.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'hint';
        empty.dataset.i18n = 'settings.profile_gif_empty';
        empty.textContent = t('settings.profile_gif_empty');
        mineGrid.appendChild(empty);
        return;
      }
      for (const item of history) {
        const btn = appendGifPickerTile(
          mineGrid,
          [item.dataUrl],
          '',
          () => void selectLocalId(item.id)
        );
        if (activeUrl === item.dataUrl) btn.classList.add('selected');
      }
    }

    async function loadOnline(query, offset = 0) {
      onlineGrid.innerHTML = '';
      const giphyOk = await window.blip.isGiphyConfigured?.();
      if (!giphyOk) {
        onlineHint.dataset.i18n = 'settings.profile_gif_giphy_unavailable';
        onlineHint.textContent = t('settings.profile_gif_giphy_unavailable');
        return;
      }
      onlineHint.textContent = '';
      const res = query
        ? await window.blip.searchGiphy?.(query, offset)
        : await window.blip.trendingGiphy?.(offset);
      if (!res?.ok || !res.items?.length) {
        onlineHint.dataset.i18n = 'settings.profile_gif_online_empty';
        onlineHint.textContent = t('settings.profile_gif_online_empty');
        return;
      }
      for (const g of res.items) {
        const btn = appendGifPickerTile(
          onlineGrid,
          [g.previewUrl, g.gifUrl],
          g.title,
          async () => {
            btn.disabled = true;
            const imp = await window.blip.importGiphyGif?.(g.gifUrl);
            btn.disabled = false;
            if (imp?.ok) {
              changed = true;
              opts.onSelected?.();
              showAppToast({ title: t('settings.profile_gif_saved'), durationMs: 3000 });
              activeTab = 'mine';
              tabMine.classList.add('selected');
              tabOnline.classList.remove('selected');
              minePanel.classList.remove('hidden');
              onlinePanel.classList.add('hidden');
              await renderMine();
            } else {
              toastProfileGifError(imp?.error);
            }
          }
        );
      }
    }

    function setTab(tab) {
      activeTab = tab;
      tabMine.classList.toggle('selected', tab === 'mine');
      tabOnline.classList.toggle('selected', tab === 'online');
      minePanel.classList.toggle('hidden', tab !== 'mine');
      onlinePanel.classList.toggle('hidden', tab !== 'online');
      if (tab === 'online') void loadOnline(searchInput.value.trim());
    }

    tabMine.addEventListener('click', () => setTab('mine'));
    tabOnline.addEventListener('click', () => setTab('online'));

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      if (await saveLocalGifFile(file)) {
        changed = true;
        opts.onSelected?.();
        await renderMine();
      }
    });

    clearBtn.addEventListener('click', async () => {
      await window.blip.clearProfileGif?.();
      changed = true;
      opts.onSelected?.();
      await renderMine();
    });

    searchBtn.addEventListener('click', () => void loadOnline(searchInput.value.trim()));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void loadOnline(searchInput.value.trim());
    });

    closeBtn.addEventListener('click', () => finish(changed));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(changed);
    });

    actions.appendChild(closeBtn);
    modal.appendChild(title);
    modal.appendChild(tabs);
    modal.appendChild(body);
    modal.appendChild(actions);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    void renderMine();
  });
}
