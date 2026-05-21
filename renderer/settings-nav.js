import { t } from './i18n.js';

/** @typedef {{ id: string, labelKey?: string }} SettingsNavItem */
/** @typedef {{ id: string, labelKey: string, items: SettingsNavItem[] }} SettingsNavGroup */

/** @type {SettingsNavGroup[]} */
export const SETTINGS_NAV_GROUPS = [
  {
    id: 'account',
    labelKey: 'settings.nav_group_account',
    items: [
      { id: 'profile' },
      { id: 'achievements' },
      { id: 'mesh_plus' },
    ],
  },
  {
    id: 'app',
    labelKey: 'settings.nav_group_app',
    items: [
      { id: 'language' },
      { id: 'appearance' },
      { id: 'sound' },
      { id: 'notifications' },
    ],
  },
  {
    id: 'connection',
    labelKey: 'settings.nav_group_connection',
    items: [
      { id: 'network' },
      { id: 'transfer' },
      { id: 'call' },
      { id: 'privacy' },
    ],
  },
  {
    id: 'system',
    labelKey: 'settings.nav_group_system',
    items: [
      { id: 'shortcuts' },
      { id: 'system' },
      { id: 'updates' },
      { id: 'about' },
      { id: 'developer' },
    ],
  },
];

const ALL_SECTION_IDS = SETTINGS_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));

/**
 * @param {string | null | undefined} section
 * @param {() => string[]} getAllowedIds
 * @returns {string | null} null = empty “choose a section” hub
 */
export function resolveSettingsSection(section, getAllowedIds) {
  if (section == null || section === '') return null;
  const allowed = new Set(getAllowedIds());
  return allowed.has(section) ? section : null;
}

/**
 * @param {object} state
 * @param {(id: string) => void} onSelect
 * @param {() => string[]} getAllowedIds
 */
export function renderSettingsNavAside(state, onSelect, getAllowedIds) {
  const allowed = new Set(getAllowedIds());
  const aside = document.createElement('aside');
  aside.className = 'settings-shell__nav glass';

  for (const group of SETTINGS_NAV_GROUPS) {
    const visible = group.items.filter((item) => allowed.has(item.id));
    if (!visible.length) continue;

    const groupEl = document.createElement('div');
    groupEl.className = 'settings-nav-group';

    const groupLabel = document.createElement('div');
    groupLabel.className = 'settings-nav-group-label';
    groupLabel.dataset.i18n = group.labelKey;
    groupLabel.textContent = t(group.labelKey);
    groupEl.appendChild(groupLabel);

    for (const item of visible) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn settings-nav-btn${state.settingsSection === item.id ? ' selected' : ''}`;
      b.dataset.i18n = `settings.section_${item.id}`;
      b.textContent = t(`settings.section_${item.id}`);
      b.addEventListener('click', () => onSelect(item.id));
      groupEl.appendChild(b);
    }

    aside.appendChild(groupEl);
  }

  return aside;
}

export { ALL_SECTION_IDS };
