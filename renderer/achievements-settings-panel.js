import { t } from './i18n.js';
import { buildPanelTitleRow, createPixelToggle } from './settings-ui.js';
import { renderAchievementsGrid } from './achievements.js';
import { clearAllAchievementUnlocks } from './achievements-store.js';
import { showAppToast } from './toasts.js';
import { openConfirmDialog } from './confirm-dialog.js';

/**
 * @param {object} state
 * @param {object} api
 */
export function buildSettingsAchievementsPanel(state, api) {
  const frag = document.createElement('div');
  frag.className = 'settings-panel settings-panel--achievements';

  frag.appendChild(buildPanelTitleRow('settings.section_achievements', 'achievements.hint'));

  const togglesRow = document.createElement('div');
  togglesRow.className = 'ach-settings-toggles';

  const enabledToggle = createPixelToggle({
    checked: !!state.config.achievementsEnabled,
    labelKey: 'achievements.enabled',
    onChange: async (checked) => {
      state.config = await api.saveConfig({ achievementsEnabled: checked });
      refreshGrid();
    },
  });

  const notifyToggle = createPixelToggle({
    checked: state.config.achievementsNotify !== false,
    labelKey: 'achievements.notify',
    onChange: async (checked) => {
      state.config = await api.saveConfig({ achievementsNotify: checked });
    },
  });

  togglesRow.appendChild(enabledToggle.el);
  togglesRow.appendChild(notifyToggle.el);
  frag.appendChild(togglesRow);

  const gridHost = document.createElement('div');
  gridHost.className = 'ach-sections';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'btn btn-lang';
  resetBtn.dataset.i18n = 'achievements.reset';
  resetBtn.textContent = t('achievements.reset');

  function refreshGrid() {
    const on = !!state.config.achievementsEnabled;
    gridHost.classList.toggle('ach-sections--disabled', !on);
    notifyToggle.el.classList.toggle('hidden', !on);
    renderAchievementsGrid(gridHost, state.config);
  }

  resetBtn.addEventListener('click', async () => {
    const ok = await openConfirmDialog({
      title: t('achievements.reset'),
      body: t('achievements.reset_confirm'),
      danger: true,
      confirmLabel: t('achievements.reset'),
    });
    if (!ok) return;
    clearAllAchievementUnlocks();
    refreshGrid();
    showAppToast({ title: t('achievements.reset_ok'), durationMs: 3000 });
  });

  frag.appendChild(gridHost);
  frag.appendChild(resetBtn);
  refreshGrid();

  return frag;
}
