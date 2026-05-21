import { t } from './i18n.js';
import { buildSectionSubtitleRow } from './settings-ui.js';
import {
  getSessionStats,
  getSessionStatsChartBars,
  sessionOnlineHours,
} from './session-stats.js';

/**
 * @param {HTMLElement} parent
 */
export function appendSessionStatsSection(parent) {
  const statsWrap = document.createElement('div');
  statsWrap.className = 'settings-network-stats-block';
  statsWrap.appendChild(
    buildSectionSubtitleRow('settings.network_stats_title', 'settings.network_stats_hint')
  );

  const card = document.createElement('div');
  card.className = 'session-stats-panel settings-list-panel session-stats-panel--styled';

  const pills = document.createElement('div');
  pills.className = 'session-stats-pills';

  const chartWrap = document.createElement('div');
  chartWrap.className = 'session-stats-chart';
  chartWrap.setAttribute('role', 'img');
  chartWrap.setAttribute('aria-label', t('settings.network_stats_chart'));

  function formatHours() {
    const hours = sessionOnlineHours();
    return hours >= 1
      ? `${hours.toFixed(1)} h`
      : `${Math.max(1, Math.round(hours * 60))} min`;
  }

  function refresh() {
    const s = getSessionStats();
    pills.innerHTML = '';
    const items = [
      { label: t('settings.network_stats_bar_minutes'), value: formatHours() },
      { label: t('settings.network_stats_bar_messages'), value: String(s.messagesSent || 0) },
      { label: t('settings.network_stats_bar_files'), value: String(s.filesSent || 0) },
      { label: t('settings.network_stats_bar_calls'), value: String(s.callsStarted || 0) },
      {
        label: t('settings.network_stats_bar_peers'),
        value: String(s.peersMaxOnline || 0),
      },
    ];
    for (const item of items) {
      const pill = document.createElement('div');
      pill.className = 'session-stats-pill';
      const val = document.createElement('span');
      val.className = 'session-stats-pill__val';
      val.textContent = item.value;
      const lab = document.createElement('span');
      lab.className = 'session-stats-pill__label';
      lab.textContent = item.label;
      pill.appendChild(val);
      pill.appendChild(lab);
      pills.appendChild(pill);
    }

    chartWrap.innerHTML = '';
    const bars = getSessionStatsChartBars();
    const maxVal = Math.max(1, ...bars.map((b) => b.value));
    for (const bar of bars) {
      const row = document.createElement('div');
      row.className = 'session-stats-chart__row';
      const label = document.createElement('span');
      label.className = 'session-stats-chart__label';
      label.textContent = t(bar.labelKey);
      const track = document.createElement('div');
      track.className = 'session-stats-chart__track';
      const fill = document.createElement('div');
      fill.className = 'session-stats-chart__fill';
      fill.style.width = `${Math.round((bar.value / maxVal) * 100)}%`;
      fill.title = String(bar.value);
      track.appendChild(fill);
      const val = document.createElement('span');
      val.className = 'session-stats-chart__val';
      val.textContent = String(bar.value);
      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(val);
      chartWrap.appendChild(row);
    }
  }

  card.appendChild(pills);
  card.appendChild(chartWrap);
  statsWrap.appendChild(card);
  parent.appendChild(statsWrap);
  refresh();

  return { refresh };
}
