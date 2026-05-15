/**
 * Theme + animated background — driven by html[data-theme] and html[data-animated-bg].
 * Persisted via main process saveConfig: themeId, animatedBgId.
 */

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

export const THEME_META = [
  { id: 'light-paper', en: 'Paper', ru: 'Бумага' },
  { id: 'light-fog', en: 'Fog', ru: 'Туман' },
  { id: 'light-sand', en: 'Sand', ru: 'Песок' },
  { id: 'light-glacier', en: 'Glacier', ru: 'Лёд' },
  { id: 'light-meadow', en: 'Meadow', ru: 'Луг' },
  { id: 'dark-signal', en: 'Signal', ru: 'Сигнал' },
  { id: 'dark-void', en: 'Void', ru: 'Пустота' },
  { id: 'dark-violet', en: 'Violet', ru: 'Фиолет' },
  { id: 'dark-forest', en: 'Forest', ru: 'Лес' },
  { id: 'dark-ember', en: 'Ember', ru: 'Угли' },
];

export const BG_META = [
  { id: 'none', en: 'None', ru: 'Нет' },
  { id: 'waves', en: 'Waves', ru: 'Волны' },
  { id: 'aurora', en: 'Aurora', ru: 'Аврора' },
  { id: 'grid', en: 'Grid', ru: 'Сетка' },
  { id: 'scanlines', en: 'Scanlines', ru: 'Строки' },
  { id: 'nebula', en: 'Nebula', ru: 'Туманность' },
  { id: 'drift', en: 'Drift', ru: 'Дрейф' },
  { id: 'pulse', en: 'Pulse', ru: 'Пульс' },
  { id: 'circuit', en: 'Circuit', ru: 'Схема' },
  { id: 'shards', en: 'Shards', ru: 'Осколки' },
  { id: 'tide', en: 'Tide', ru: 'Прилив' },
];

export function labelTheme(id, lang) {
  const m = THEME_META.find((x) => x.id === id);
  if (!m) return id;
  return lang === 'ru' ? m.ru : m.en;
}

export function labelBg(id, lang) {
  const m = BG_META.find((x) => x.id === id);
  if (!m) return id;
  return lang === 'ru' ? m.ru : m.en;
}

export function applyAppearance(config) {
  const html = document.documentElement;
  const theme = normalizeThemeId(config?.themeId);
  const bg = normalizeBgId(config?.animatedBgId);
  html.dataset.theme = theme;
  html.dataset.animatedBg = bg;
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
