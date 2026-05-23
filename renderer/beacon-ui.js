import { t } from './i18n.js';
import {
  getBeaconCatalog,
  publishBeaconFile,
  downloadBeaconSeed,
  refreshBeaconLocalState,
} from './beacon-mesh.js';
import { formatFileSize } from './file-transfer.js';
import { showAppToast } from './toasts.js';
import { createPixelHintIcon } from './settings-ui.js';

/** @type {'mesh' | 'mine' | 'downloads'} */
let activeTab = 'mesh';
let tableBodyEl = null;
let publishBusy = false;
let viewRoot = null;

function statusLabel(item) {
  if (item.phase === 'hashing') return t('beacon.status_hashing');
  if (item.phase === 'publishing') return t('beacon.status_publishing');
  if (item.phase === 'downloading') return t('beacon.status_downloading');
  if (item.canSave) return t('beacon.status_seeding');
  return t('beacon.status_available');
}

function filterItems(tab) {
  const all = getBeaconCatalog();
  if (tab === 'mine') return all.filter((i) => i.mine || i.canSave);
  if (tab === 'downloads') return all.filter((i) => i.phase === 'downloading');
  return all;
}

function renderTableRows() {
  if (!tableBodyEl) return;
  tableBodyEl.innerHTML = '';

  if (activeTab === 'downloads') {
    const soon = document.createElement('div');
    soon.className = 'beacon-soon-panel glass';
    soon.dataset.i18n = 'beacon.soon_downloads';
    soon.textContent = t('beacon.soon_downloads');
    tableBodyEl.appendChild(soon);
    return;
  }

  const items = filterItems(activeTab);
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'beacon-empty';
    empty.dataset.i18n = activeTab === 'mine' ? 'beacon.empty_mine' : 'beacon.empty';
    empty.textContent = t(activeTab === 'mine' ? 'beacon.empty_mine' : 'beacon.empty');
    tableBodyEl.appendChild(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'beacon-table-row glass';

    const nameCell = document.createElement('div');
    nameCell.className = 'beacon-col beacon-col-name';
    const nameStrong = document.createElement('strong');
    nameStrong.textContent = item.filename;
    const nameSub = document.createElement('span');
    nameSub.className = 'beacon-sub';
    nameSub.textContent = item.seedId.slice(0, 8);
    nameCell.appendChild(nameStrong);
    nameCell.appendChild(nameSub);

    const sizeCell = document.createElement('div');
    sizeCell.className = 'beacon-col beacon-col-size';
    sizeCell.textContent = formatFileSize(item.size);

    const progCell = document.createElement('div');
    progCell.className = 'beacon-col beacon-col-progress';
    if (item.progress > 0 && item.progress < 100 && item.phase) {
      const track = document.createElement('div');
      track.className = 'beacon-progress-track';
      const fill = document.createElement('div');
      fill.className = 'beacon-progress-fill';
      fill.style.width = `${item.progress}%`;
      track.appendChild(fill);
      progCell.appendChild(track);
      const pct = document.createElement('span');
      pct.className = 'beacon-sub';
      pct.textContent = `${item.progress}%`;
      progCell.appendChild(pct);
    } else {
      progCell.textContent = item.canSave ? '100%' : '—';
    }

    const seedsCell = document.createElement('div');
    seedsCell.className = 'beacon-col beacon-col-seeds';
    seedsCell.textContent = String(item.seederCount);

    const statusCell = document.createElement('div');
    statusCell.className = 'beacon-col beacon-col-status';
    statusCell.textContent = statusLabel(item);

    const actionsCell = document.createElement('div');
    actionsCell.className = 'beacon-col beacon-col-actions';

    if (item.phase === 'hashing' || item.phase === 'publishing' || item.phase === 'downloading') {
      const wait = document.createElement('span');
      wait.className = 'beacon-sub';
      wait.textContent = '…';
      actionsCell.appendChild(wait);
    } else if (item.canSave) {
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'btn btn-lang beacon-row-btn';
      saveBtn.dataset.i18n = 'beacon.save';
      saveBtn.textContent = t('beacon.save');
      saveBtn.addEventListener('click', () => {
        void downloadBeaconSeed(item.seedId)
          .then((res) => {
            if (res?.cancelled) return;
            showAppToast({ title: t('beacon.saved'), durationMs: 4000 });
          })
          .catch((err) => {
            showAppToast({
              title: t('beacon.failed'),
              body: err?.message || '',
              variant: 'danger',
              durationMs: 5000,
            });
            void refreshBeaconLocalState().then(renderTableRows);
          });
      });
      actionsCell.appendChild(saveBtn);
    } else {
      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'btn btn-accent beacon-row-btn';
      dlBtn.dataset.i18n = 'beacon.download';
      dlBtn.textContent = t('beacon.download');
      dlBtn.addEventListener('click', () => {
        dlBtn.disabled = true;
        void downloadBeaconSeed(item.seedId)
          .then((res) => {
            if (res?.cancelled) return;
            showAppToast({ title: t('beacon.saved'), durationMs: 4000 });
          })
          .catch((err) => {
            showAppToast({
              title: t('beacon.failed'),
              body: err?.message || '',
              variant: 'danger',
              durationMs: 5000,
            });
          })
          .finally(() => {
            dlBtn.disabled = false;
            renderTableRows();
          });
      });
      actionsCell.appendChild(dlBtn);
    }

    row.appendChild(nameCell);
    row.appendChild(sizeCell);
    row.appendChild(progCell);
    row.appendChild(seedsCell);
    row.appendChild(statusCell);
    row.appendChild(actionsCell);
    tableBodyEl.appendChild(row);
  }
}

function setActiveTab(tab, wrap) {
  activeTab = tab;
  wrap.querySelectorAll('.beacon-tab').forEach((btn) => {
    const on = btn.dataset.tab === tab;
    btn.classList.toggle('beacon-tab--active', on);
    btn.classList.toggle('beacon-tab--inactive', !on && btn.classList.contains('beacon-tab--stub'));
  });
  renderTableRows();
}

function wirePublishInput(wrap) {
  const input = wrap.querySelector('.beacon-file-input');
  const btn = wrap.querySelector('.beacon-publish-btn');
  if (!input || !btn) return;

  btn.addEventListener('click', () => {
    if (publishBusy) return;
    input.click();
  });

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file || publishBusy) return;
    publishBusy = true;
    btn.disabled = true;
    void publishBeaconFile(file)
      .then(() => {
        showAppToast({
          title: t('beacon.published'),
          body: file.name,
          durationMs: 4500,
        });
        activeTab = 'mine';
        setActiveTab('mine', wrap);
      })
      .catch((err) => {
        showAppToast({
          title: t('beacon.failed'),
          body: err?.message || '',
          variant: 'danger',
          durationMs: 5000,
        });
      })
      .finally(() => {
        publishBusy = false;
        btn.disabled = false;
        renderTableRows();
      });
  });
}

function buildStatsBar() {
  const bar = document.createElement('div');
  bar.className = 'beacon-stats glass beacon-inactive-block';
  bar.innerHTML = `
    <span class="beacon-stat" data-i18n="beacon.stat_down">${t('beacon.stat_down')}</span>
    <span class="beacon-stat" data-i18n="beacon.stat_up">${t('beacon.stat_up')}</span>
    <span class="beacon-stat" data-i18n="beacon.stat_seeds">${t('beacon.stat_seeds')}</span>
    <span class="beacon-stat" data-i18n="beacon.stat_peers">${t('beacon.stat_peers')}</span>
  `;
  return bar;
}

function buildTabs(wrap) {
  const tabs = document.createElement('div');
  tabs.className = 'beacon-tabs';
  const defs = [
    { id: 'mesh', key: 'beacon.tab_mesh', stub: false },
    { id: 'mine', key: 'beacon.tab_mine', stub: false },
    { id: 'downloads', key: 'beacon.tab_downloads', stub: true },
  ];
  for (const def of defs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `beacon-tab btn btn-lang${def.stub ? ' beacon-tab--stub' : ''}${def.id === activeTab ? ' beacon-tab--active' : ''}`;
    btn.dataset.tab = def.id;
    btn.dataset.i18n = def.key;
    btn.textContent = t(def.key);
    if (def.stub) btn.classList.add('beacon-tab--inactive');
    btn.addEventListener('click', () => setActiveTab(def.id, wrap));
    tabs.appendChild(btn);
  }
  return tabs;
}

function buildToolbar(wrap) {
  const bar = document.createElement('div');
  bar.className = 'beacon-toolbar';

  const input = document.createElement('input');
  input.type = 'file';
  input.className = 'beacon-file-input hidden';
  input.setAttribute('aria-hidden', 'true');

  const publishBtn = document.createElement('button');
  publishBtn.type = 'button';
  publishBtn.className = 'btn btn-accent beacon-publish-btn';
  publishBtn.dataset.i18n = 'beacon.publish';
  publishBtn.textContent = t('beacon.publish');

  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.className = 'btn btn-lang beacon-inactive-btn';
  pauseBtn.disabled = true;
  pauseBtn.dataset.i18n = 'beacon.pause_all';
  pauseBtn.textContent = t('beacon.pause_all');

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn btn-lang beacon-inactive-btn';
  clearBtn.disabled = true;
  clearBtn.dataset.i18n = 'beacon.clear_done';
  clearBtn.textContent = t('beacon.clear_done');

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'input beacon-search beacon-inactive-input';
  search.disabled = true;
  search.placeholder = t('beacon.search_ph');
  search.dataset.i18nPlaceholder = 'beacon.search_ph';

  bar.appendChild(input);
  bar.appendChild(publishBtn);
  bar.appendChild(pauseBtn);
  bar.appendChild(clearBtn);
  bar.appendChild(search);
  wrap.appendChild(bar);
  wirePublishInput(wrap);
}

function buildDropZone() {
  const zone = document.createElement('div');
  zone.className = 'beacon-dropzone glass beacon-inactive-block';
  const label = document.createElement('span');
  label.dataset.i18n = 'beacon.drop_hint';
  label.textContent = t('beacon.drop_hint');
  zone.appendChild(label);
  return zone;
}

function buildTable() {
  const wrap = document.createElement('div');
  wrap.className = 'beacon-table-wrap';

  const head = document.createElement('div');
  head.className = 'beacon-table-head';
  const cols = [
    'beacon.col_name',
    'beacon.col_size',
    'beacon.col_progress',
    'beacon.col_seeders',
    'beacon.col_status',
    'beacon.col_actions',
  ];
  for (const key of cols) {
    const cell = document.createElement('span');
    cell.className = 'beacon-table-head-cell';
    cell.dataset.i18n = key;
    cell.textContent = t(key);
    head.appendChild(cell);
  }

  tableBodyEl = document.createElement('div');
  tableBodyEl.className = 'beacon-table-body';

  wrap.appendChild(head);
  wrap.appendChild(tableBodyEl);
  return wrap;
}

function onCatalogUpdate() {
  renderTableRows();
}

if (typeof window !== 'undefined') {
  window.addEventListener('blip-beacon-catalog', onCatalogUpdate);
  window.addEventListener('blip-beacon-progress', onCatalogUpdate);
}

/** Main nav view — BEACON / МАЯК */
export function renderBeaconView() {
  activeTab = 'mesh';
  const wrap = document.createElement('div');
  wrap.className = 'view beacon-view';
  viewRoot = wrap;

  const titleRow = document.createElement('div');
  titleRow.className = 'section-title-row';
  const title = document.createElement('h2');
  title.className = 'section-title';
  title.dataset.i18n = 'beacon.title';
  title.textContent = t('beacon.title');
  titleRow.appendChild(title);
  titleRow.appendChild(createPixelHintIcon('beacon.hint'));

  wrap.appendChild(titleRow);
  wrap.appendChild(buildStatsBar());
  wrap.appendChild(buildTabs(wrap));
  buildToolbar(wrap);
  wrap.appendChild(buildDropZone());
  wrap.appendChild(buildTable());

  void refreshBeaconLocalState().then(renderTableRows);
  renderTableRows();
  return wrap;
}

/** Legacy floating panel. */
export function mountBeaconPanel() {
  return renderBeaconView();
}
