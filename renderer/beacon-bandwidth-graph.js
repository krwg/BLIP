import { t } from './i18n.js';
import { formatTransferSpeed } from './file-transfer-speed.js';
import {
  getBandwidthHistory,
  getBandwidthHistoryPeak,
  getBandwidthRates,
  subscribeBandwidth,
} from './bandwidth-monitor.js';

export function mountBandwidthSparkline(container, opts = {}) {
  const height = opts.height ?? 56;
  const canvas = document.createElement('canvas');
  canvas.className = 'beacon-bw-canvas';
  canvas.width = 280;
  canvas.height = height;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', t('settings.bandwidth_chart'));

  const legend = document.createElement('div');
  legend.className = 'beacon-bw-legend';
  const downEl = document.createElement('span');
  downEl.className = 'beacon-bw-legend__down';
  const upEl = document.createElement('span');
  upEl.className = 'beacon-bw-legend__up';
  legend.appendChild(downEl);
  legend.appendChild(upEl);

  container.appendChild(canvas);
  if (!opts.compact) container.appendChild(legend);

  const ctx = canvas.getContext('2d');
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue('--blip-accent')
    .trim();
  const muted = getComputedStyle(document.documentElement)
    .getPropertyValue('--blip-muted')
    .trim();
  const barSlots = 56;

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    const mid = Math.floor(h / 2);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = muted || '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();

    const hist = getBandwidthHistory();
    const peak = getBandwidthHistoryPeak();
    const samples = hist.length ? hist : [{ downBps: 0, upBps: 0, t: 0 }];
    const n = samples.length;
    const barW = Math.max(2, Math.floor(w / barSlots));
    const slots = Math.min(barSlots, w);

    for (let i = 0; i < slots; i++) {
      const idx = Math.max(0, n - slots + i);
      const s = samples[idx] || { downBps: 0, upBps: 0 };
      const downH = Math.round(((s.downBps / peak) * (mid - 4)) | 0);
      const upH = Math.round(((s.upBps / peak) * (mid - 4)) | 0);
      const x = i * barW;
      ctx.fillStyle = accent || '#0f8';
      ctx.fillRect(x, mid - downH, barW - 1, downH);
      ctx.fillStyle = 'rgba(120,200,255,0.85)';
      ctx.fillRect(x, mid + 1, barW - 1, upH);
    }

    const rates = getBandwidthRates();
    downEl.textContent = `↓ ${formatTransferSpeed(rates.downBps)}`;
    upEl.textContent = `↑ ${formatTransferSpeed(rates.upBps)}`;
  }

  draw();
  const unsub = subscribeBandwidth(draw);
  return { canvas, refresh: draw, destroy: () => unsub() };
}

export function appendBandwidthGraphSection(parent) {
  const wrap = document.createElement('div');
  wrap.className = 'settings-bandwidth-block';

  const title = document.createElement('h3');
  title.className = 'settings-subsection-title';
  title.dataset.i18n = 'settings.bandwidth_title';
  title.textContent = t('settings.bandwidth_title');
  wrap.appendChild(title);

  const hint = document.createElement('p');
  hint.className = 'settings-hint';
  hint.dataset.i18n = 'settings.bandwidth_hint';
  hint.textContent = t('settings.bandwidth_hint');
  wrap.appendChild(hint);

  const card = document.createElement('div');
  card.className = 'settings-list-panel bandwidth-graph-panel glass';
  const sparkHost = document.createElement('div');
  sparkHost.className = 'bandwidth-graph-panel__spark';
  card.appendChild(sparkHost);

  const bars = document.createElement('div');
  bars.className = 'bandwidth-graph-panel__bars';
  const downRow = document.createElement('div');
  downRow.className = 'bandwidth-graph-panel__row';
  const upRow = document.createElement('div');
  upRow.className = 'bandwidth-graph-panel__row';
  bars.appendChild(downRow);
  bars.appendChild(upRow);
  card.appendChild(bars);

  wrap.appendChild(card);
  parent.appendChild(wrap);

  const spark = mountBandwidthSparkline(sparkHost, { height: 64 });

  function refreshBars() {
    const peak = getBandwidthHistoryPeak();
    const rates = getBandwidthRates();
    renderBarRow(downRow, t('settings.bandwidth_down'), rates.downBps, peak, 'down');
    renderBarRow(upRow, t('settings.bandwidth_up'), rates.upBps, peak, 'up');
  }

  refreshBars();
  const unsub = subscribeBandwidth(() => {
    spark.refresh();
    refreshBars();
  });

  return {
    refresh: () => {
      spark.refresh();
      refreshBars();
    },
    destroy: () => {
      unsub();
      spark.destroy();
    },
  };
}

function renderBarRow(row, label, bps, peak, kind) {
  row.innerHTML = '';
  const lab = document.createElement('span');
  lab.className = 'bandwidth-graph-panel__label';
  lab.textContent = label;
  const track = document.createElement('div');
  track.className = 'bandwidth-graph-panel__track';
  const fill = document.createElement('div');
  fill.className = `bandwidth-graph-panel__fill bandwidth-graph-panel__fill--${kind}`;
  fill.style.width = `${Math.round((bps / peak) * 100)}%`;
  track.appendChild(fill);
  const val = document.createElement('span');
  val.className = 'bandwidth-graph-panel__val';
  val.textContent = formatTransferSpeed(bps);
  row.appendChild(lab);
  row.appendChild(track);
  row.appendChild(val);
}
