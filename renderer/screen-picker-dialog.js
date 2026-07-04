import { t } from './i18n.js';

export async function openScreenPickerDialog() {
  if (!window.blip?.listDisplaySources) return null;

  let sources;
  try {
    sources = await window.blip.listDisplaySources();
  } catch {
    return null;
  }
  if (!sources?.length) return null;

  const screens = sources.filter((s) => s.displayType === 'screen');
  const windows = sources.filter((s) => s.displayType === 'window');
  let tab = screens.length ? 'screen' : 'window';

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'blip-modal-backdrop screen-picker-backdrop';

    const modal = document.createElement('div');
    modal.className = 'blip-modal glass screen-picker-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const title = document.createElement('h3');
    title.className = 'blip-modal-title';
    title.dataset.i18n = 'call.picker_title';
    title.textContent = t('call.picker_title');

    const audioRow = document.createElement('label');
    audioRow.className = 'screen-picker-audio-row settings-tray-toggle-row';
    const audioCb = document.createElement('input');
    audioCb.type = 'checkbox';
    audioCb.checked = true;
    const audioSpan = document.createElement('span');
    audioSpan.dataset.i18n = 'call.picker_share_audio';
    audioSpan.textContent = t('call.picker_share_audio');
    audioRow.appendChild(audioCb);
    audioRow.appendChild(audioSpan);

    const tabs = document.createElement('div');
    tabs.className = 'screen-picker-tabs';

    const screenTab = document.createElement('button');
    screenTab.type = 'button';
    screenTab.className = 'btn btn-lang';
    screenTab.dataset.i18n = 'call.picker_screens';
    screenTab.textContent = t('call.picker_screens');

    const windowTab = document.createElement('button');
    windowTab.type = 'button';
    windowTab.className = 'btn btn-lang';
    windowTab.dataset.i18n = 'call.picker_windows';
    windowTab.textContent = t('call.picker_windows');

    const grid = document.createElement('div');
    grid.className = 'screen-picker-grid';

    let done = false;
    function finish(result) {
      if (done) return;
      done = true;
      backdrop.remove();
      resolve(result);
    }

    function renderGrid() {
      grid.innerHTML = '';
      const list = tab === 'screen' ? screens : windows;
      if (!list.length) {
        const empty = document.createElement('p');
        empty.className = 'hint';
        empty.dataset.i18n = 'call.picker_empty';
        empty.textContent = t('call.picker_empty');
        grid.appendChild(empty);
        return;
      }
      list.forEach((src) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'screen-picker-card';
        if (src.thumbnail) {
          const img = document.createElement('img');
          img.src = src.thumbnail;
          img.alt = '';
          img.className = 'screen-picker-thumb';
          card.appendChild(img);
        } else {
          const ph = document.createElement('span');
          ph.className = 'screen-picker-thumb screen-picker-thumb--empty';
          ph.textContent = tab === 'screen' ? 'SCR' : 'WIN';
          card.appendChild(ph);
        }
        const label = document.createElement('span');
        label.className = 'screen-picker-label';
        label.textContent = src.name;
        card.appendChild(label);
        card.addEventListener('click', () =>
          finish({ sourceId: src.id, withAudio: audioCb.checked })
        );
        grid.appendChild(card);
      });
    }

    function syncTabs() {
      screenTab.classList.toggle('selected', tab === 'screen');
      windowTab.classList.toggle('selected', tab === 'window');
      screenTab.disabled = screens.length === 0;
      windowTab.disabled = windows.length === 0;
      renderGrid();
    }

    screenTab.addEventListener('click', () => {
      if (!screens.length) return;
      tab = 'screen';
      syncTabs();
    });
    windowTab.addEventListener('click', () => {
      if (!windows.length) return;
      tab = 'window';
      syncTabs();
    });

    const actions = document.createElement('div');
    actions.className = 'blip-modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-lang';
    cancelBtn.dataset.i18n = 'dialog.cancel';
    cancelBtn.textContent = t('dialog.cancel');
    cancelBtn.addEventListener('click', () => finish(null));
    actions.appendChild(cancelBtn);

    tabs.appendChild(screenTab);
    tabs.appendChild(windowTab);
    modal.appendChild(title);
    modal.appendChild(audioRow);
    modal.appendChild(tabs);
    modal.appendChild(grid);
    modal.appendChild(actions);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(null);
    });

    syncTabs();
    (screens.length ? screenTab : windowTab).focus();
  });
}
