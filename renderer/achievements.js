import { t } from './i18n.js';
import { getSessionStats, sessionOnlineHours } from './session-stats.js';
import { isAchievementUnlocked } from './achievements-store.js';
import { premiumTierEnabled } from './mesh-plus.js';
import { getLocalTrustState } from './trust-ui.js';
import { BUILD_TRUST } from '../shared/trust-levels.js';
import { ACHIEVEMENT_ICON_BY_ID } from './achievements-icons.js';
import { showAppToast } from './toasts.js';

/**
 * @typedef {{ id: string, codeKey: string, titleKey: string, descKey: string, glyph: string, iconAsset: string, check?: (s: object) => boolean, checkConfig?: (cfg: object) => boolean, checkTrust?: () => boolean }} AchievementDef
 */

/** Fallback glyph when iconAsset is empty. */
export const ACHIEVEMENT_GLYPHS = {
  first_peer: '◎',
  mesh_5: '⬡',
  messages_50: '▤',
  messages_100: '▦',
  first_call: '♪',
  first_file: '⬆',
  online_1h: '⏱',
  mesh_plus_active: '◈',
  beta_tester: 'β',
  unofficial_build: '⎇',
};

function appendAchievementGlyphFallback(wrap, def) {
  const glyph = document.createElement('span');
  glyph.className = 'ach-icon-slot__glyph';
  glyph.textContent = def.glyph || ACHIEVEMENT_GLYPHS[def.id] || '◆';
  glyph.title = t('achievements.icon_placeholder');
  glyph.setAttribute('aria-hidden', 'true');
  wrap.appendChild(glyph);
}

/**
 * @param {HTMLElement} parent
 * @param {AchievementDef} def
 */
export function appendAchievementIcon(parent, def) {
  const wrap = document.createElement('div');
  wrap.className = 'ach-icon-slot';
  const src = def.iconAsset || ACHIEVEMENT_ICON_BY_ID[def.id] || '';
  if (src) {
    const img = document.createElement('img');
    img.className = 'ach-icon-slot__img';
    img.src = src;
    img.alt = t(def.titleKey);
    img.decoding = 'async';
    img.draggable = false;
    img.addEventListener('error', () => {
      img.remove();
      appendAchievementGlyphFallback(wrap, def);
    });
    wrap.appendChild(img);
  } else {
    appendAchievementGlyphFallback(wrap, def);
  }
  parent.appendChild(wrap);
  return wrap;
}

/** @param {string} id */
export function achievementIconUrl(id) {
  return ACHIEVEMENT_ICON_BY_ID[id] || '';
}

/** Achievement definitions — icons in `/ach-icons/*.svg`. */
/** @type {AchievementDef[]} */
export const ACHIEVEMENT_DEFS = [
  {
    id: 'first_peer',
    glyph: '◎',
    codeKey: 'achievements.code_first_peer',
    titleKey: 'achievements.first_peer',
    descKey: 'achievements.first_peer_desc',
    iconAsset: achievementIconUrl('first_peer'),
    check: (s) => (s.peersMaxOnline || 0) >= 1,
  },
  {
    id: 'mesh_5',
    glyph: '⬡',
    codeKey: 'achievements.code_mesh_5',
    titleKey: 'achievements.mesh_5',
    descKey: 'achievements.mesh_5_desc',
    iconAsset: achievementIconUrl('mesh_5'),
    check: (s) => (s.peersMaxOnline || 0) >= 5,
  },
  {
    id: 'messages_50',
    glyph: '▤',
    codeKey: 'achievements.code_messages_50',
    titleKey: 'achievements.messages_50',
    descKey: 'achievements.messages_50_desc',
    iconAsset: achievementIconUrl('messages_50'),
    check: (s) => (s.messagesSent || 0) >= 50,
  },
  {
    id: 'messages_100',
    glyph: '▦',
    codeKey: 'achievements.code_messages_100',
    titleKey: 'achievements.messages_100',
    descKey: 'achievements.messages_100_desc',
    iconAsset: achievementIconUrl('messages_100'),
    check: (s) => (s.messagesSent || 0) >= 100,
  },
  {
    id: 'first_call',
    glyph: '♪',
    codeKey: 'achievements.code_first_call',
    titleKey: 'achievements.first_call',
    descKey: 'achievements.first_call_desc',
    iconAsset: achievementIconUrl('first_call'),
    check: (s) => (s.callsStarted || 0) >= 1,
  },
  {
    id: 'first_file',
    glyph: '⬆',
    codeKey: 'achievements.code_first_file',
    titleKey: 'achievements.first_file',
    descKey: 'achievements.first_file_desc',
    iconAsset: achievementIconUrl('first_file'),
    check: (s) => (s.filesSent || 0) >= 1,
  },
  {
    id: 'online_1h',
    glyph: '⏱',
    codeKey: 'achievements.code_online_1h',
    titleKey: 'achievements.online_1h',
    descKey: 'achievements.online_1h_desc',
    iconAsset: achievementIconUrl('online_1h'),
    check: () => sessionOnlineHours() >= 1,
  },
  {
    id: 'mesh_plus_active',
    glyph: '◈',
    codeKey: 'achievements.code_mesh_plus',
    titleKey: 'achievements.mesh_plus_active',
    descKey: 'achievements.mesh_plus_active_desc',
    iconAsset: achievementIconUrl('mesh_plus_active'),
    checkConfig: (cfg) => premiumTierEnabled(cfg),
  },
  {
    id: 'beta_tester',
    glyph: 'β',
    codeKey: 'achievements.code_beta_tester',
    titleKey: 'achievements.beta_tester',
    descKey: 'achievements.beta_tester_desc',
    iconAsset: achievementIconUrl('beta_tester'),
    checkConfig: (cfg) => !!cfg?.receiveBetaUpdates,
  },
  {
    id: 'unofficial_build',
    glyph: '⎇',
    codeKey: 'achievements.code_unofficial_build',
    titleKey: 'achievements.unofficial_build',
    descKey: 'achievements.unofficial_build_desc',
    iconAsset: achievementIconUrl('unofficial_build'),
    checkTrust: () => {
      const trust = getLocalTrustState();
      return trust?.buildTrust === BUILD_TRUST.UNVERIFIED_BUILD;
    },
  },
];

function isProgressMet(def, stats, config) {
  if (def.checkTrust) return !!def.checkTrust();
  if (def.checkConfig) return !!def.checkConfig(config);
  return !!def.check?.(stats);
}

/**
 * @param {object} [config]
 * @returns {{ def: AchievementDef, unlocked: boolean, progressMet: boolean }[]}
 */
export function getAchievementStates(config) {
  const stats = getSessionStats();
  return ACHIEVEMENT_DEFS.map((def) => {
    const progressMet = isProgressMet(def, stats, config);
    return {
      def,
      progressMet,
      unlocked: isAchievementUnlocked(def.id),
    };
  });
}

/**
 * @param {{ def: AchievementDef, unlocked: boolean, progressMet: boolean }} item
 */
function createAchievementCard({ def, unlocked, progressMet }) {
  const card = document.createElement('div');
  card.className = `ach-card${unlocked ? ' ach-card--unlocked' : ''}${
    progressMet && !unlocked ? ' ach-card--ready' : ''
  }`;
  card.dataset.achId = def.id;

  const iconWrap = document.createElement('div');
  iconWrap.className = 'ach-card__icon';
  if (unlocked) {
    appendAchievementIcon(iconWrap, def);
  } else {
    const hiddenBtn = document.createElement('button');
    hiddenBtn.type = 'button';
    hiddenBtn.className = 'ach-icon-slot ach-icon-slot--hidden';
    hiddenBtn.setAttribute('aria-label', t('achievements.icon_unlock_to_see'));
    const hiddenMark = document.createElement('span');
    hiddenMark.className = 'ach-icon-slot__hidden-mark';
    hiddenMark.textContent = '?';
    hiddenMark.setAttribute('aria-hidden', 'true');
    hiddenBtn.appendChild(hiddenMark);
    hiddenBtn.addEventListener('click', () => {
      showAppToast({
        title: t('achievements.icon_unlock_to_see'),
        durationMs: 5000,
      });
    });
    iconWrap.appendChild(hiddenBtn);
  }

  const body = document.createElement('div');
  body.className = 'ach-card__body';
  const title = document.createElement('div');
  title.className = 'ach-card__title';
  title.textContent = t(def.titleKey);
  const desc = document.createElement('div');
  desc.className = 'ach-card__desc';
  desc.textContent = t(def.descKey);
  body.appendChild(title);
  body.appendChild(desc);

  const mark = document.createElement('div');
  mark.className = 'ach-card__mark';
  mark.textContent = unlocked ? 'OK' : progressMet ? '…' : '—';

  card.appendChild(iconWrap);
  card.appendChild(body);
  card.appendChild(mark);
  return card;
}

/**
 * @param {string} titleKey
 * @param {{ def: AchievementDef, unlocked: boolean, progressMet: boolean }[]} items
 * @param {string} sectionClass
 */
function buildAchievementsSection(titleKey, items, sectionClass) {
  const section = document.createElement('section');
  section.className = `ach-section ${sectionClass}`;

  const head = document.createElement('h3');
  head.className = 'ach-section__title section-subtitle';
  head.dataset.i18n = titleKey;
  head.textContent = t(titleKey);

  const grid = document.createElement('div');
  grid.className = 'ach-grid';

  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'hint ach-section__empty';
    empty.dataset.i18n =
      sectionClass === 'ach-section--unlocked'
        ? 'achievements.section_unlocked_empty'
        : 'achievements.section_locked_empty';
    empty.textContent = t(empty.dataset.i18n);
    grid.appendChild(empty);
  } else {
    for (const item of items) grid.appendChild(createAchievementCard(item));
  }

  section.appendChild(head);
  section.appendChild(grid);
  return section;
}

/**
 * @param {HTMLElement} root
 * @param {object} [config]
 */
export function renderAchievementsGrid(root, config) {
  root.innerHTML = '';
  const states = getAchievementStates(config);
  const unlocked = states.filter((s) => s.unlocked);
  const locked = states.filter((s) => !s.unlocked);

  root.appendChild(
    buildAchievementsSection('achievements.section_unlocked', unlocked, 'ach-section--unlocked')
  );
  root.appendChild(
    buildAchievementsSection('achievements.section_locked', locked, 'ach-section--locked')
  );
}
