import { t } from './i18n.js';
import {
  getBeaconCatalog,
  publishBeaconFile,
  downloadBeaconSeed,
  refreshBeaconLocalState,
  setSeedPaused,
  setAllSeedsPaused,
  stopBeaconSeed,
  resumeBeaconSeeding,
} from './beacon-mesh.js';
import { formatFileSize } from './file-transfer.js';
import { showAppToast } from './toasts.js';
import { createPixelHintIcon } from './settings-ui.js';

/** @type {'mesh' | 'mine' | 'downloads'} */
let activeTab = 'mesh';
let tableBodyEl = null;
let statsRootEl = null;
let publishBusy = false;

function showSoonToast(key = 'beacon.soon_feature') {
  showAppToast({ title: t(key), durationMs: 4200 });
}

function computeStats() {
  const items = getBeaconCatalog();
  const mine = items.filter((i) => i.mine || i.canSave).length;
  const mesh = items.length;
  const seeders = items.reduce((n, i) => n + i.seederCount, 0);
  const active = items.filter((i) => i.canSave && !i.paused).length;
  return { mine, mesh, seeders, active };
}

function refreshStats() {
  if (!statsRootEl) return;
  const s = computeStats();
  const meshEl = statsRootEl.querySelector('[data-stat="mesh"] strong');
  if (meshEl) meshEl.textContent = String(s.mesh);
  const mineEl = statsRootEl.querySelector('[data-stat="mine"] strong');
  if (mineEl) mineEl.textContent = String(s.mine);
  const seedEl = statsRootEl.querySelector('[data-stat="seeders"] strong');
  if (seedEl) seedEl.textContent = String(s.seeders);
  const actEl = statsRootEl.querySelector('[data-stat="active"] strong');
  if (actEl) actEl.textContent = String(s.active);
}

function statusLabel(item) {
  if (item.stopped) return t('beacon.status_stopped');
  if (item.paused) return t('beacon.status_paused');
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

function mkBtn(labelKey, className, onClick, { disabled = false, soon = false } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.dataset.i18n = labelKey;
  btn.textContent = t(labelKey);
  btn.disabled = disabled;
  if (soon) {
    btn.classList.add('beacon-soon-btn');
    btn.addEventListener('click', () => showSoonToast());
    return btn;
  }
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}

function mkActionGroup(buttons) {
  const g = document.createElement('div');
  g.className = 'beacon-action-group';
  for (const b of buttons) g.appendChild(b);
  return g;
}

function renderTableRows() {
  if (!tableBodyEl) return;
  tableBodyEl.innerHTML = '';
  refreshStats();

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
    row.className = `beacon-table-row glass${item.paused ? ' beacon-table-row--paused' : ''}`;

    const nameCell = document.createElement('div');
    nameCell.className = 'beacon-col beacon-col-name';
    const nameStrong = document.createElement('strong');
    nameStrong.textContent = item.filename;
    const nameSub = document.createElement('span');
    nameSub.className = 'beacon-sub';
    nameSub.textContent = `${item.seedId.slice(0, 8)}… · ${item.mine ? t('beacon.mine') : ''}`;
    nameCell.appendChild(nameStrong);
    nameCell.appendChild(nameSub);

    const sizeCell = document.createElement('div');
    sizeCell.className = 'beacon-col beacon-col-size';
    sizeCell.textContent = formatFileSize(item.size);

    const progCell = document.createElement('div');
    progCell.className = 'beacon-col beacon-col-progress';
    const track = document.createElement('div');
    track.className = 'beacon-progress-track';
    const fill = document.createElement('div');
    fill.className = 'beacon-progress-fill';
    const pctVal = item.progress > 0 && item.progress < 100 && item.phase ? item.progress : item.canSave ? 100 : 0;
    fill.style.width = `${pctVal}%`;
    track.appendChild(fill);
    progCell.appendChild(track);
    const pct = document.createElement('span');
    pct.className = 'beacon-sub';
    pct.textContent = pctVal ? `${pctVal}%` : '—';
    progCell.appendChild(pct);

    const seedsCell = document.createElement('div');
    seedsCell.className = 'beacon-col beacon-col-seeds';
    seedsCell.textContent = String(item.seederCount);

    const statusCell = document.createElement('div');
    statusCell.className = 'beacon-col beacon-col-status';
    const badge = document.createElement('span');
    badge.className = `beacon-status-badge beacon-status-badge--${item.paused ? 'paused' : item.canSave ? 'seed' : 'avail'}`;
    badge.textContent = statusLabel(item);
    statusCell.appendChild(badge);

    const actionsCell = document.createElement('div');
    actionsCell.className = 'beacon-col beacon-col-actions';

    if (item.phase === 'hashing' || item.phase === 'publishing' || item.phase === 'downloading') {
      actionsCell.appendChild(mkActionGroup([]));
    } else if (item.canSave) {
      const actionBtns = [];
      if (item.stopped) {
        actionBtns.push(
          mkBtn('beacon.resume_seed', 'btn btn-accent beacon-row-btn', () => {
            void resumeBeaconSeeding(item.seedId)
              .then(() => renderTableRows())
              .catch((err) => {
                showAppToast({
                  title: t('beacon.failed'),
                  body: err?.message || '',
                  variant: 'danger',
                  durationMs: 5000,
                });
              });
          })
        );
      } else {
        actionBtns.push(
          mkBtn(
            item.paused ? 'beacon.resume' : 'beacon.pause',
            'btn btn-lang beacon-row-btn',
            () => {
              setSeedPaused(item.seedId, !item.paused);
              renderTableRows();
            }
          ),
          mkBtn('beacon.stop', 'btn btn-lang beacon-row-btn', () => {
            void stopBeaconSeed(item.seedId)
              .then(() => renderTableRows())
              .catch((err) => {
                showAppToast({
                  title: t('beacon.failed'),
                  body: err?.message || '',
                  variant: 'danger',
                  durationMs: 5000,
                });
              });
          })
        );
      }
      const saveBtn = mkBtn('beacon.save', 'btn btn-accent beacon-row-btn', () => {
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
      actionBtns.push(saveBtn);
      actionsCell.appendChild(mkActionGroup(actionBtns));
    } else {
      const dlBtn = mkBtn('beacon.download', 'btn btn-accent beacon-row-btn', () => {
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
      const linkBtn = mkBtn('beacon.copy_link', 'btn btn-lang beacon-row-btn beacon-soon-btn', null, {
        soon: true,
      });
      actionsCell.appendChild(mkActionGroup([dlBtn, linkBtn]));
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
    btn.classList.toggle('beacon-tab--active', btn.dataset.tab === tab);
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
        showAppToast({ title: t('beacon.published'), body: file.name, durationMs: 4500 });
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

function buildStatCard(statKey, labelKey, value, { muted = false } = {}) {
  const card = document.createElement('div');
  card.className = `beacon-stat-card glass${muted ? ' beacon-stat-card--muted' : ''}`;
  card.dataset.stat = statKey;
  const label = document.createElement('span');
  label.className = 'beacon-stat-label';
  label.dataset.i18n = labelKey;
  label.textContent = t(labelKey);
  const val = document.createElement('strong');
  val.textContent = value;
  card.appendChild(label);
  card.appendChild(val);
  return card;
}

function buildStatsBar() {
  const bar = document.createElement('div');
  bar.className = 'beacon-stats-grid';
  statsRootEl = bar;
  bar.appendChild(buildStatCard('down', 'beacon.stat_down_label', '0 B/s', { muted: true }));
  bar.appendChild(buildStatCard('up', 'beacon.stat_up_label', '0 B/s', { muted: true }));
  bar.appendChild(buildStatCard('mesh', 'beacon.stat_mesh_label', '0'));
  bar.appendChild(buildStatCard('mine', 'beacon.stat_mine_label', '0'));
  bar.appendChild(buildStatCard('seeders', 'beacon.stat_seeders_label', '0'));
  bar.appendChild(buildStatCard('active', 'beacon.stat_active_label', '0'));
  return bar;
}

function buildControlSection(titleKey, controls) {
  const sec = document.createElement('div');
  sec.className = 'beacon-control-section glass';
  const h = document.createElement('h3');
  h.className = 'beacon-control-title';
  h.dataset.i18n = titleKey;
  h.textContent = t(titleKey);
  sec.appendChild(h);
  for (const el of controls) sec.appendChild(el);
  return sec;
}

function buildSliderRow(labelKey, value, { disabled = true, min = 1, max = 8 } = {}) {
  const row = document.createElement('label');
  row.className = `beacon-slider-row${disabled ? ' beacon-slider-row--soon' : ''}`;
  const span = document.createElement('span');
  span.dataset.i18n = labelKey;
  span.textContent = t(labelKey);
  const range = document.createElement('input');
  range.type = 'range';
  range.min = String(min);
  range.max = String(max);
  range.value = String(value);
  range.disabled = disabled;
  range.className = 'beacon-range';
  const val = document.createElement('span');
  val.className = 'beacon-slider-val';
  val.textContent = String(value);
  if (disabled) {
    range.addEventListener('click', (e) => {
      e.preventDefault();
      showSoonToast();
    });
  } else {
    range.addEventListener('input', () => {
      val.textContent = range.value;
    });
  }
  row.appendChild(span);
  row.appendChild(range);
  row.appendChild(val);
  return row;
}

function buildAside(wrap) {
  const aside = document.createElement('aside');
  aside.className = 'beacon-aside';

  const transfer = buildControlSection('beacon.panel_transfer', [
    buildSliderRow('beacon.slider_peers', 3),
    buildSliderRow('beacon.slider_up_cap', 50, { min: 10, max: 100 }),
  ]);

  const seeding = buildControlSection('beacon.panel_seeding', [
    mkBtn(
      'beacon.pause_all',
      'btn btn-lang beacon-aside-btn',
      () => {
        const items = getBeaconCatalog().filter((i) => i.canSave);
        const anyActive = items.some((i) => !i.paused);
        setAllSeedsPaused(anyActive);
        showAppToast({
          title: anyActive ? t('beacon.paused_all') : t('beacon.resumed_all'),
          durationMs: 3200,
        });
        renderTableRows();
      },
      { disabled: false }
    ),
    mkBtn('beacon.stop_all', 'btn btn-lang beacon-aside-btn beacon-soon-btn', null, { soon: true }),
  ]);

  const filters = buildControlSection('beacon.panel_filters', [
    (() => {
      const search = document.createElement('input');
      search.type = 'search';
      search.className = 'input beacon-search beacon-soon-input';
      search.disabled = true;
      search.placeholder = t('beacon.search_ph');
      search.addEventListener('click', () => showSoonToast());
      return search;
    })(),
    mkBtn('beacon.sort_name', 'btn btn-lang beacon-aside-btn beacon-soon-btn', null, { soon: true }),
  ]);

  const refreshBtn = mkBtn(
    'beacon.refresh',
    'btn btn-accent beacon-aside-btn beacon-aside-btn--wide',
    () => void refreshBeaconLocalState().then(renderTableRows)
  );

  aside.appendChild(transfer);
  aside.appendChild(seeding);
  aside.appendChild(filters);
  aside.appendChild(refreshBtn);
  return aside;
}

function buildTabs(wrap) {
  const tabs = document.createElement('nav');
  tabs.className = 'beacon-tabs';
  const defs = [
    { id: 'mesh', key: 'beacon.tab_mesh' },
    { id: 'mine', key: 'beacon.tab_mine' },
    { id: 'downloads', key: 'beacon.tab_downloads' },
  ];
  for (const def of defs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `beacon-tab${def.id === activeTab ? ' beacon-tab--active' : ''}`;
    btn.dataset.tab = def.id;
    btn.dataset.i18n = def.key;
    btn.textContent = t(def.key);
    btn.addEventListener('click', () => setActiveTab(def.id, wrap));
    tabs.appendChild(btn);
  }
  return tabs;
}

function buildToolbar(main, wrap) {
  const bar = document.createElement('div');
  bar.className = 'beacon-toolbar';

  const input = document.createElement('input');
  input.type = 'file';
  input.className = 'beacon-file-input hidden';
  input.setAttribute('aria-hidden', 'true');

  const primary = document.createElement('div');
  primary.className = 'beacon-toolbar-primary';
  primary.appendChild(input);
  const publishBtn = document.createElement('button');
  publishBtn.type = 'button';
  publishBtn.className = 'btn btn-accent beacon-publish-btn';
  publishBtn.dataset.i18n = 'beacon.publish';
  publishBtn.textContent = t('beacon.publish');
  primary.appendChild(publishBtn);
  primary.appendChild(mkBtn('beacon.add_folder', 'btn btn-lang beacon-soon-btn', null, { soon: true }));
  primary.appendChild(mkBtn('beacon.clear_done', 'btn btn-lang beacon-soon-btn', null, { soon: true }));

  const drop = document.createElement('div');
  drop.className = 'beacon-drop-compact beacon-soon-block';
  drop.dataset.i18n = 'beacon.drop_hint';
  drop.textContent = t('beacon.drop_hint');
  drop.addEventListener('click', () => showSoonToast('beacon.soon_drop'));

  bar.appendChild(primary);
  bar.appendChild(drop);
  const table = main.querySelector('.beacon-table-wrap');
  if (table) main.insertBefore(bar, table);
  wirePublishInput(wrap);
}

function buildTable() {
  const wrap = document.createElement('div');
  wrap.className = 'beacon-table-wrap';

  const head = document.createElement('div');
  head.className = 'beacon-table-head';
  for (const key of [
    'beacon.col_name',
    'beacon.col_size',
    'beacon.col_progress',
    'beacon.col_seeders',
    'beacon.col_status',
    'beacon.col_actions',
  ]) {
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

export function renderBeaconView() {
  activeTab = 'mesh';
  const wrap = document.createElement('div');
  wrap.className = 'view beacon-view';

  const titleRow = document.createElement('div');
  titleRow.className = 'section-title-row';
  const title = document.createElement('h2');
  title.className = 'section-title';
  title.dataset.i18n = 'beacon.title';
  title.textContent = t('beacon.title');
  titleRow.appendChild(title);
  titleRow.appendChild(createPixelHintIcon('beacon.hint'));

  const body = document.createElement('div');
  body.className = 'beacon-body';

  const main = document.createElement('div');
  main.className = 'beacon-main';
  main.appendChild(buildTabs(wrap));
  main.appendChild(buildTable());

  body.appendChild(buildAside(wrap));
  body.appendChild(main);

  wrap.appendChild(titleRow);
  wrap.appendChild(buildStatsBar());
  wrap.appendChild(body);

  buildToolbar(main, wrap);

  void refreshBeaconLocalState().then(renderTableRows);
  renderTableRows();
  return wrap;
}

export function mountBeaconPanel() {
  return renderBeaconView();
}

