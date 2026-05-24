import { t } from './i18n.js';
import {
  getBeaconCatalog,
  publishBeaconFile,
  publishBeaconFilePath,
  downloadBeaconSeed,
  refreshBeaconLocalState,
  setSeedPaused,
  setAllSeedsPaused,
  stopBeaconSeed,
  stopAllBeaconSeeds,
  resumeBeaconSeeding,
  buildBeaconSeedLink,
  getBeaconJobProgress,
  resolveBeaconPreviewUrl,
  deleteBeaconSeed,
  hasLocalSeedData,
  openBlipSeedFileContent,
  getBeaconSeedExportMeta,
} from './beacon-mesh.js';
import { formatFileSize } from './file-transfer.js';
import { formatTransferSpeed } from './file-transfer-speed.js';
import { showAppToast } from './toasts.js';
import { createPixelHintIcon } from './settings-ui.js';
import { copyTextToClipboard } from './settings-ui.js';
import { getBandwidthRates, subscribeBandwidth } from './bandwidth-monitor.js';
import { openBeaconRowMenu, createBeaconRowMenuButton } from './beacon-row-menu.js';
import { downloadBlipSeedFile } from './beacon-seed-file.js';

/** @type {'mesh' | 'mine' | 'downloads'} */
let activeTab = 'mesh';
let tableBodyEl = null;
let statsRootEl = null;
let bwUnsub = null;
let searchQuery = '';
let publishBusy = false;
/** @type {HTMLElement | null} */
let publishOverlayEl = null;
/** @type {() => object} */
let getUiConfig = () => ({});

function ensurePublishOverlay(wrap) {
  if (publishOverlayEl?.isConnected) return publishOverlayEl;
  const host = wrap.querySelector('.beacon-view') || wrap;
  const overlay = document.createElement('div');
  overlay.className = 'beacon-publish-overlay hidden';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = `
    <div class="beacon-publish-overlay-card glass">
      <div class="beacon-publish-overlay-spinner" aria-hidden="true"></div>
      <strong class="beacon-publish-overlay-title" data-i18n="beacon.publishing"></strong>
      <span class="beacon-publish-overlay-name"></span>
      <div class="beacon-progress-track beacon-progress-track--pixel beacon-publish-overlay-track">
        <div class="beacon-progress-fill beacon-publish-overlay-fill"></div>
      </div>
      <span class="beacon-publish-overlay-pct beacon-sub">0%</span>
      <span class="beacon-publish-overlay-phase beacon-sub" data-i18n="beacon.status_hashing"></span>
    </div>
  `;
  host.appendChild(overlay);
  publishOverlayEl = overlay;
  return overlay;
}

function showPublishOverlay(wrap, filename) {
  const overlay = ensurePublishOverlay(wrap);
  overlay.classList.remove('hidden');
  const title = overlay.querySelector('.beacon-publish-overlay-title');
  if (title) title.textContent = t('beacon.publishing');
  const nameEl = overlay.querySelector('.beacon-publish-overlay-name');
  if (nameEl) nameEl.textContent = filename || '';
  const fill = overlay.querySelector('.beacon-publish-overlay-fill');
  if (fill) fill.style.width = '0%';
  const pct = overlay.querySelector('.beacon-publish-overlay-pct');
  if (pct) pct.textContent = '0%';
  const phase = overlay.querySelector('.beacon-publish-overlay-phase');
  if (phase) {
    phase.dataset.i18n = 'beacon.status_hashing';
    phase.textContent = t('beacon.status_hashing');
  }
  activeTab = 'downloads';
  setActiveTab('downloads', wrap);
  renderTableRows();
}

function updatePublishOverlay(progress, phase) {
  if (!publishOverlayEl || publishOverlayEl.classList.contains('hidden')) return;
  const pctVal = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  const fill = publishOverlayEl.querySelector('.beacon-publish-overlay-fill');
  if (fill) fill.style.width = `${pctVal}%`;
  const pct = publishOverlayEl.querySelector('.beacon-publish-overlay-pct');
  if (pct) pct.textContent = `${pctVal}%`;
  const phaseEl = publishOverlayEl.querySelector('.beacon-publish-overlay-phase');
  if (phaseEl) {
    const key =
      phase === 'publishing'
        ? 'beacon.status_publishing'
        : phase === 'hashing'
          ? 'beacon.status_hashing'
          : 'beacon.publishing';
    phaseEl.dataset.i18n = key;
    phaseEl.textContent = t(key);
  }
}

function hidePublishOverlay() {
  publishOverlayEl?.classList.add('hidden');
}

async function copySeedLink(seedId) {
  const link = buildBeaconSeedLink(seedId);
  const ok = await copyTextToClipboard(link);
  showAppToast({
    title: ok ? t('beacon.link_copied') : t('beacon.copy_failed'),
    body: link,
    variant: ok ? 'accent' : 'danger',
    durationMs: ok ? 3200 : 5000,
  });
}

async function confirmDeleteSeed(item) {
  const name = item.filename || item.seedId.slice(0, 8);
  const ok = window.confirm(t('beacon.delete_confirm').replace('{name}', name));
  if (!ok) return;
  try {
    await deleteBeaconSeed(item.seedId);
    showAppToast({ title: t('beacon.deleted'), durationMs: 3500 });
    renderTableRows();
  } catch (err) {
    showAppToast({
      title: t('beacon.failed'),
      body: err?.message || '',
      variant: 'danger',
      durationMs: 5000,
    });
  }
}

function buildSeedMenuItems(item) {
  const busy =
    item.phase === 'hashing' || item.phase === 'publishing' || item.phase === 'downloading';

  if (busy) {
    if (item.hasLocalData || hasLocalSeedData(item.seedId)) {
      return [
        {
          id: 'delete',
          label: t('beacon.delete'),
          danger: true,
          onClick: () => void confirmDeleteSeed(item),
        },
      ];
    }
    return [];
  }

  const items = [];

  if (!busy && !item.canSave && item.seederCount > 0) {
    items.push({
      id: 'download',
      label: t('beacon.download'),
      onClick: () => {
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
          .finally(renderTableRows);
      },
    });
  }

  if (!busy && item.canSave) {
    items.push({
      id: 'save',
      label: t('beacon.save'),
      onClick: () => {
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
          });
      },
    });
  }

  if (!busy && item.canSave) {
    if (item.stopped) {
      items.push({
        id: 'resume_seed',
        label: t('beacon.resume_seed'),
        onClick: () => {
          void resumeBeaconSeeding(item.seedId)
            .then(renderTableRows)
            .catch((err) => {
              showAppToast({
                title: t('beacon.failed'),
                body: err?.message || '',
                variant: 'danger',
                durationMs: 5000,
              });
            });
        },
      });
    } else {
      items.push({
        id: 'pause',
        label: item.paused ? t('beacon.resume') : t('beacon.pause'),
        onClick: () => {
          setSeedPaused(item.seedId, !item.paused);
          renderTableRows();
        },
      });
      items.push({
        id: 'stop',
        label: t('beacon.stop'),
        onClick: () => {
          void stopBeaconSeed(item.seedId)
            .then(renderTableRows)
            .catch((err) => {
              showAppToast({
                title: t('beacon.failed'),
                body: err?.message || '',
                variant: 'danger',
                durationMs: 5000,
              });
            });
        },
      });
    }
  }

  if (!busy) {
    items.push({
      id: 'copy',
      label: t('beacon.copy_link'),
      onClick: () => void copySeedLink(item.seedId),
    });
    items.push({
      id: 'blip',
      label: t('beacon.save_blip_file'),
      onClick: () => {
        void getBeaconSeedExportMeta(item.seedId).then((meta) => {
          if (!meta?.seedId) {
            showAppToast({ title: t('beacon.failed'), variant: 'danger', durationMs: 4000 });
            return;
          }
          downloadBlipSeedFile(meta, meta.filename);
          showAppToast({ title: t('beacon.blip_saved'), durationMs: 3500 });
        });
      },
    });
  }

  if (!busy && item.canSave) {
    items.push({
      id: 'share',
      label: t('beacon.share_chat'),
      onClick: () => shareSeedInChat(item),
    });
  }

  if (item.hasLocalData || hasLocalSeedData(item.seedId)) {
    items.push({
      id: 'delete',
      label: t('beacon.delete'),
      danger: true,
      onClick: () => void confirmDeleteSeed(item),
    });
  }

  return items;
}

function openRowActions(anchor, item) {
  const menuItems = buildSeedMenuItems(item);
  if (!menuItems.length) return;
  openBeaconRowMenu(anchor, menuItems);
}

function shareSeedInChat(item) {
  window.dispatchEvent(
    new CustomEvent('blip-beacon-share-chat', {
      detail: {
        seedId: item.seedId,
        filename: item.filename,
        size: item.size,
      },
    })
  );
}

function showSoonToast(key = 'beacon.soon_feature') {
  showAppToast({ title: t(key), durationMs: 4200 });
}

function computeStats() {
  const items = getBeaconCatalog();
  const mine = items.filter((i) => i.mine || i.canSave).length;
  const mesh = items.length;
  const seeders = items.reduce((n, i) => n + i.seederCount, 0);
  const active = items.filter((i) => i.canSave && !i.paused && !i.stopped).length;
  return { mine, mesh, seeders, active };
}

function refreshStats() {
  if (!statsRootEl) return;
  const s = computeStats();
  const rates = getBandwidthRates();
  const downEl = statsRootEl.querySelector('[data-stat="down"] strong');
  if (downEl) downEl.textContent = formatTransferSpeed(rates.downBps);
  const upEl = statsRootEl.querySelector('[data-stat="up"] strong');
  if (upEl) upEl.textContent = formatTransferSpeed(rates.upBps);
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
  const job = getBeaconJobProgress(item.seedId);
  if (item.phase === 'downloading' && job?.speedBps) {
    return formatTransferSpeed(job.speedBps);
  }
  if (item.stopped) return t('beacon.status_stopped');
  if (item.paused) return t('beacon.status_paused');
  if (item.phase === 'hashing') return t('beacon.status_hashing');
  if (item.phase === 'publishing') return t('beacon.status_publishing');
  if (item.phase === 'downloading') return t('beacon.status_downloading');
  if (item.canSave) return t('beacon.status_seeding');
  return t('beacon.status_available');
}

function filterItems(tab) {
  const q = searchQuery.trim().toLowerCase();
  const match = (i) =>
    !q ||
    i.filename.toLowerCase().includes(q) ||
    i.seedId.toLowerCase().includes(q);

  const all = getBeaconCatalog().filter(match);
  if (tab === 'mine') return all.filter((i) => i.mine || i.canSave);
  if (tab === 'downloads') {
    return all.filter(
      (i) =>
        i.phase === 'downloading' ||
        i.phase === 'publishing' ||
        i.phase === 'hashing' ||
        (i.progress > 0 && i.progress < 100)
    );
  }
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


function createPreviewThumb(item) {
  const thumb = document.createElement('div');
  thumb.className = 'beacon-preview-thumb';
  const img = document.createElement('img');
  img.className = 'beacon-preview-img hidden';
  img.alt = '';
  img.loading = 'lazy';
  const glyph = document.createElement('span');
  glyph.className = 'beacon-preview-glyph pixel-glyph--file';
  glyph.setAttribute('aria-hidden', 'true');
  thumb.appendChild(img);
  thumb.appendChild(glyph);

  const url = item.previewUrl;
  if (url) {
    img.src = url;
    img.classList.remove('hidden');
    glyph.classList.add('hidden');
  } else {
    void resolveBeaconPreviewUrl(item.seedId, item.previewB64).then((resolved) => {
      if (!resolved || !thumb.isConnected) return;
      img.src = resolved;
      img.classList.remove('hidden');
      glyph.classList.add('hidden');
    });
  }
  return thumb;
}

function renderTableRows() {
  if (!tableBodyEl) return;
  tableBodyEl.innerHTML = '';
  refreshStats();

  const items = filterItems(activeTab);
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'beacon-empty';
    const key =
      activeTab === 'mine'
        ? 'beacon.empty_mine'
        : activeTab === 'downloads'
          ? 'beacon.empty_downloads'
          : 'beacon.empty';
    empty.dataset.i18n = key;
    empty.textContent = t(key);
    tableBodyEl.appendChild(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement('div');
    row.className = `beacon-table-row glass${item.paused ? ' beacon-table-row--paused' : ''}${item.phase === 'downloading' || item.phase === 'publishing' || item.phase === 'hashing' ? ' beacon-table-row--active' : ''}${item.pendingIngest ? ' beacon-table-row--ingest' : ''}`;

    const nameCell = document.createElement('div');
    nameCell.className = 'beacon-col beacon-col-name';
    nameCell.appendChild(createPreviewThumb(item));
    const nameText = document.createElement('div');
    nameText.className = 'beacon-col-name-text';
    const nameStrong = document.createElement('strong');
    nameStrong.textContent = item.filename;
    const nameSub = document.createElement('span');
    nameSub.className = 'beacon-sub';
    nameSub.textContent = `${item.seedId.slice(0, 8)}…${item.mine ? ` · ${t('beacon.mine')}` : ''}`;
    nameText.appendChild(nameStrong);
    nameText.appendChild(nameSub);
    nameCell.appendChild(nameText);

    const sizeCell = document.createElement('div');
    sizeCell.className = 'beacon-col beacon-col-size';
    sizeCell.textContent = formatFileSize(item.size);

    const progCell = document.createElement('div');
    progCell.className = 'beacon-col beacon-col-progress';
    const track = document.createElement('div');
    track.className = 'beacon-progress-track beacon-progress-track--pixel';
    const fill = document.createElement('div');
    fill.className = 'beacon-progress-fill';
    const pctVal =
      item.progress > 0 && item.progress < 100 && item.phase
        ? item.progress
        : item.canSave
          ? 100
          : 0;
    fill.style.width = `${pctVal}%`;
    track.appendChild(fill);
    progCell.appendChild(track);
    const pct = document.createElement('span');
    pct.className = 'beacon-sub';
    pct.textContent = pctVal ? `${pctVal}%` : '—';
    progCell.appendChild(pct);

    const seedsCell = document.createElement('div');
    seedsCell.className = 'beacon-col beacon-col-seeds';
    seedsCell.innerHTML = `<span class="beacon-seed-pip">${item.seederCount}</span>`;

    const statusCell = document.createElement('div');
    statusCell.className = 'beacon-col beacon-col-status';
    const badge = document.createElement('span');
    badge.className = `beacon-status-badge beacon-status-badge--${item.paused ? 'paused' : item.canSave ? 'seed' : item.phase ? 'active' : 'avail'}`;
    badge.textContent = statusLabel(item);
    statusCell.appendChild(badge);

    const menuCell = document.createElement('div');
    menuCell.className = 'beacon-col beacon-col-menu';
    const menuBtn = createBeaconRowMenuButton((anchor) => openRowActions(anchor, item));
    menuCell.appendChild(menuBtn);

    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openRowActions(menuBtn, item);
    });

    row.appendChild(nameCell);
    row.appendChild(sizeCell);
    row.appendChild(progCell);
    row.appendChild(seedsCell);
    row.appendChild(statusCell);
    row.appendChild(menuCell);
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

function handleBlipFile(file) {
  if (!file) return false;
  const name = String(file.name || '').toLowerCase();
  if (!name.endsWith('.blip')) return false;
  const reader = new FileReader();
  reader.onload = () => {
    void (async () => {
      try {
        const doc = await openBlipSeedFileContent(String(reader.result || ''));
        window.dispatchEvent(
          new CustomEvent('blip-open-beacon-seed', { detail: { seedId: doc.seedId } })
        );
        showAppToast({
          title: t('beacon.blip_opened'),
          body: doc.filename,
          durationMs: 4500,
        });
      } catch {
        showAppToast({ title: t('beacon.blip_invalid'), variant: 'danger', durationMs: 5000 });
      }
    })();
  };
  reader.readAsText(file);
  return true;
}

async function runPublishPath(filePath, wrap) {
  const btn = wrap.querySelector('.beacon-publish-btn');
  if (!filePath || publishBusy) return;
  const displayName = filePath.replace(/^.*[/\\]/, '');
  publishBusy = true;
  if (btn) btn.disabled = true;
  showPublishOverlay(wrap, displayName);
  void publishBeaconFilePath(filePath)
    .then(() => {
      const name = filePath.replace(/^.*[/\\]/, '');
      showAppToast({ title: t('beacon.published'), body: name, durationMs: 4500 });
      activeTab = 'mine';
      setActiveTab('mine', wrap);
    })
    .catch((err) => {
      const code = err?.message || '';
      let body = code;
      if (code === 'not_readable' || /could not be read/i.test(code)) {
        body = t('beacon.err_not_readable');
      } else if (code === 'no_path') {
        body = t('beacon.err_no_path');
      } else if (code === 'too_large') {
        body = t('beacon.err_too_large');
      }
      showAppToast({
        title: t('beacon.failed'),
        body,
        variant: 'danger',
        durationMs: 7000,
      });
    })
    .finally(() => {
      publishBusy = false;
      if (btn) btn.disabled = false;
      hidePublishOverlay();
      renderTableRows();
    });
}

function runPublish(file, wrap) {
  if (handleBlipFile(file)) return;
  const btn = wrap.querySelector('.beacon-publish-btn');
  if (!file || publishBusy) return;
  const diskPath =
    typeof window.blip?.getPathForFile === 'function'
      ? window.blip.getPathForFile(file)
      : file.path;
  if (diskPath && window.blip?.beaconPublishFromPath) {
    void runPublishPath(diskPath, wrap);
    return;
  }
  publishBusy = true;
  if (btn) btn.disabled = true;
  showPublishOverlay(wrap, file.name);
  void publishBeaconFile(file)
    .then(() => {
      showAppToast({ title: t('beacon.published'), body: file.name, durationMs: 4500 });
      activeTab = 'mine';
      setActiveTab('mine', wrap);
    })
    .catch((err) => {
      const code = err?.message || '';
      let body = code;
      if (code === 'not_readable' || /could not be read/i.test(code)) {
        body = t('beacon.err_not_readable');
      } else if (code === 'no_path') {
        body = t('beacon.err_no_path');
      } else if (code === 'too_large') {
        body = t('beacon.err_too_large');
      }
      showAppToast({
        title: t('beacon.failed'),
        body,
        variant: 'danger',
        durationMs: 7000,
      });
    })
    .finally(() => {
      publishBusy = false;
      if (btn) btn.disabled = false;
      hidePublishOverlay();
      renderTableRows();
    });
}

function wirePublishInput(wrap) {
  const input = wrap.querySelector('.beacon-file-input');
  const btn = wrap.querySelector('.beacon-publish-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (publishBusy) return;
    if (!window.blip?.beaconPickPublishFile) {
      showAppToast({
        title: t('beacon.failed'),
        body: t('beacon.err_no_path'),
        variant: 'danger',
        durationMs: 6000,
      });
      return;
    }
    const pick = await window.blip.beaconPickPublishFile();
    if (pick?.cancelled) return;
    if (pick?.ok && pick.filePath) {
      void runPublishPath(pick.filePath, wrap);
      return;
    }
    showAppToast({
      title: t('beacon.failed'),
      body: t('beacon.err_no_path'),
      variant: 'danger',
      durationMs: 6000,
    });
  });

  input?.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    runPublish(file, wrap);
  });
}

function wireBeaconDrop(wrap, dropEl) {
  if (!dropEl) return;
  dropEl.addEventListener('click', () => {
    if (publishBusy) return;
    wrap.querySelector('.beacon-file-input')?.click();
  });
  let depth = 0;
  dropEl.addEventListener('dragenter', (e) => {
    e.preventDefault();
    depth += 1;
    dropEl.classList.add('beacon-drop--active');
  });
  dropEl.addEventListener('dragleave', (e) => {
    e.preventDefault();
    depth = Math.max(0, depth - 1);
    if (depth === 0) dropEl.classList.remove('beacon-drop--active');
  });
  dropEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  dropEl.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    dropEl.classList.remove('beacon-drop--active');
    const file = e.dataTransfer?.files?.[0];
    runPublish(file, wrap);
  });
}

function buildStatCard(statKey, labelKey, value, { accent = false } = {}) {
  const card = document.createElement('div');
  card.className = `beacon-stat-card glass${accent ? ' beacon-stat-card--accent' : ''}`;
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
  bar.appendChild(buildStatCard('down', 'beacon.stat_down_label', '0 B/s', { accent: true }));
  bar.appendChild(buildStatCard('up', 'beacon.stat_up_label', '0 B/s', { accent: true }));
  bar.appendChild(buildStatCard('mesh', 'beacon.stat_mesh_label', '0'));
  bar.appendChild(buildStatCard('mine', 'beacon.stat_mine_label', '0'));
  bar.appendChild(buildStatCard('seeders', 'beacon.stat_seeders_label', '0'));
  bar.appendChild(buildStatCard('active', 'beacon.stat_active_label', '0'));
  return bar;
}

function buildSliderRow(labelKey, value, { min, max, onChange }) {
  const row = document.createElement('label');
  row.className = 'beacon-slider-row';
  const span = document.createElement('span');
  span.dataset.i18n = labelKey;
  span.textContent = t(labelKey);
  const range = document.createElement('input');
  range.type = 'range';
  range.min = String(min);
  range.max = String(max);
  range.value = String(value);
  range.className = 'beacon-range';
  const val = document.createElement('span');
  val.className = 'beacon-slider-val';
  val.textContent = String(value);
  range.addEventListener('input', () => {
    val.textContent = range.value;
  });
  range.addEventListener('change', () => {
    onChange?.(Number(range.value));
  });
  row.appendChild(span);
  row.appendChild(range);
  row.appendChild(val);
  return row;
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

function buildAside(wrap) {
  const aside = document.createElement('aside');
  aside.className = 'beacon-aside';
  const cfg = getUiConfig();

  const transfer = buildControlSection('beacon.panel_transfer', [
    buildSliderRow('beacon.slider_peers', cfg.beaconParallelPeers ?? 6, {
      min: 1,
      max: 8,
      onChange: (v) => {
        void window.blip?.saveConfig?.({ beaconParallelPeers: v });
      },
    }),
    buildSliderRow('beacon.slider_up_cap', cfg.beaconUploadCapPercent ?? 100, {
      min: 10,
      max: 100,
      onChange: (v) => {
        void window.blip?.saveConfig?.({ beaconUploadCapPercent: v });
      },
    }),
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
    mkBtn('beacon.stop_all', 'btn btn-lang beacon-aside-btn', () => {
      void stopAllBeaconSeeds()
        .then(() => renderTableRows())
        .catch(() => showSoonToast('beacon.soon_stop'));
    }),
  ]);

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'input beacon-search';
  search.placeholder = t('beacon.search_ph');
  search.value = searchQuery;
  search.addEventListener('input', () => {
    searchQuery = search.value;
    renderTableRows();
  });

  const filters = buildControlSection('beacon.panel_filters', [search]);

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
  bar.className = 'beacon-toolbar glass';

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
  const openBlipBtn = document.createElement('button');
  openBlipBtn.type = 'button';
  openBlipBtn.className = 'btn btn-lang';
  openBlipBtn.dataset.i18n = 'beacon.open_blip_file';
  openBlipBtn.textContent = t('beacon.open_blip_file');
  const blipInput = document.createElement('input');
  blipInput.type = 'file';
  blipInput.accept = '.blip,application/vnd.blip.seed+json';
  blipInput.className = 'beacon-file-input hidden';
  blipInput.setAttribute('aria-hidden', 'true');
  openBlipBtn.addEventListener('click', () => blipInput.click());
  blipInput.addEventListener('change', () => {
    const file = blipInput.files?.[0];
    blipInput.value = '';
    handleBlipFile(file);
  });
  primary.appendChild(openBlipBtn);
  primary.appendChild(blipInput);

  const drop = document.createElement('div');
  drop.className = 'beacon-drop-zone';
  const dropIcon = document.createElement('span');
  dropIcon.className = 'beacon-drop-icon pixel-glyph--upload';
  dropIcon.setAttribute('aria-hidden', 'true');
  const dropText = document.createElement('span');
  dropText.dataset.i18n = 'beacon.drop_hint';
  dropText.textContent = t('beacon.drop_hint');
  drop.appendChild(dropIcon);
  drop.appendChild(dropText);

  bar.appendChild(primary);
  bar.appendChild(drop);
  const table = main.querySelector('.beacon-table-wrap');
  if (table) main.insertBefore(bar, table);
  wirePublishInput(wrap);
  wireBeaconDrop(wrap, drop);
}

function buildTable() {
  const wrap = document.createElement('div');
  wrap.className = 'beacon-table-wrap glass';

  const head = document.createElement('div');
  head.className = 'beacon-table-head';
  for (const key of [
    'beacon.col_name',
    'beacon.col_size',
    'beacon.col_progress',
    'beacon.col_seeders',
    'beacon.col_status',
    'beacon.col_menu',
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

function onBeaconProgress(ev) {
  const seedId = ev?.detail?.seedId;
  if (seedId !== 'path-ingest') return;
  updatePublishOverlay(ev.detail?.progress, ev.detail?.phase);
  renderTableRows();
}

function teardownBeaconView() {
  bwUnsub?.();
  bwUnsub = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('blip-beacon-catalog', onCatalogUpdate);
  window.addEventListener('blip-beacon-progress', onCatalogUpdate);
  window.addEventListener('blip-beacon-progress', onBeaconProgress);
}

export function renderBeaconView(config) {
  teardownBeaconView();
  getUiConfig = () => config || {};
  activeTab = 'mesh';
  searchQuery = '';

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

  wrap.appendChild(titleRow);
  wrap.appendChild(buildStatsBar());

  const body = document.createElement('div');
  body.className = 'beacon-body';

  const main = document.createElement('div');
  main.className = 'beacon-main';
  main.appendChild(buildTabs(wrap));
  main.appendChild(buildTable());

  body.appendChild(buildAside(wrap));
  body.appendChild(main);

  wrap.appendChild(body);
  buildToolbar(main, wrap);

  bwUnsub = subscribeBandwidth(refreshStats);

  void refreshBeaconLocalState().then(renderTableRows);
  renderTableRows();
  return wrap;
}

export function mountBeaconPanel(config) {
  return renderBeaconView(config);
}
