/**
 * Theme + animated background — driven by html[data-theme] and html[data-animated-bg].
 * Persisted via main process saveConfig: themeId, animatedBgId.
 */

import { t } from './i18n.js';

export const THEME_GROUPS = {
  light: ['light-paper', 'light-fog', 'light-sand', 'light-glacier', 'light-meadow'],
  dark: ['dark-signal', 'dark-void', 'dark-violet', 'dark-forest', 'dark-ember'],
};

export const ANIMATED_BACKGROUNDS = [
  'none',
  'waves',
  'aurora',
  'grid',
  'scanlines',
  'nebula',
  'drift',
  'pulse',
  'circuit',
  'shards',
  'tide',
];

const DEFAULT_THEME = 'dark-signal';
const DEFAULT_BG = 'none';

export function normalizeThemeId(id) {
  const all = [...THEME_GROUPS.light, ...THEME_GROUPS.dark];
  return all.includes(id) ? id : DEFAULT_THEME;
}

export function normalizeBgId(id) {
  return ANIMATED_BACKGROUNDS.includes(id) ? id : DEFAULT_BG;
}

export const THEME_META = THEME_GROUPS.light
  .concat(THEME_GROUPS.dark)
  .map((id) => ({ id }));

export const BG_META = ANIMATED_BACKGROUNDS.map((id) => ({ id }));

export function labelTheme(id) {
  const key = `appearance.theme.${id}`;
  const label = t(key);
  return label === key ? id : label;
}

export function labelBg(id) {
  const key = `appearance.bg.${id}`;
  const label = t(key);
  return label === key ? id : label;
}

export function applyAppearance(config) {
  const html = document.documentElement;
  const theme = normalizeThemeId(config?.themeId);
  const bg = normalizeBgId(config?.animatedBgId);
  html.dataset.theme = theme;
  html.dataset.animatedBg = bg;
  delete html.dataset.callWindow;
  syncReducedMotion();
}

/** Call window: theme colors only — no animated wallpaper over video. */
export function applyCallWindowAppearance(config) {
  const html = document.documentElement;
  html.dataset.theme = normalizeThemeId(config?.themeId);
  html.dataset.animatedBg = 'none';
  html.dataset.callWindow = '1';
  syncReducedMotion();
}

export function syncReducedMotion() {
  const html = document.documentElement;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  html.dataset.reducedMotion = reduce ? '1' : '0';
}

export function listenReducedMotion(cb) {
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (!mq) return () => {};
  const fn = () => {
    syncReducedMotion();
    cb?.();
  };
  mq.addEventListener('change', fn);
  return () => mq.removeEventListener('change', fn);
}
