/**
 * Theme mode (light / dark / auto) + color accent + backgrounds.
 */

import { t } from './i18n.js';
import { uiShowsPremiumTier } from '../shared/mesh-plus-gates.js';

export const THEME_MODES = ['light', 'dark', 'auto'];

export const ACCENT_IDS = [
  'mint',
  'cyan',
  'teal',
  'blue',
  'indigo',
  'violet',
  'purple',
  'pink',
  'rose',
  'red',
  'orange',
  'amber',
  'lime',
  'green',
  'slate',
  'gold',
];

/** CSS-animated (themes.css). */
export const ANIMATED_BACKGROUNDS = ['none', 'beacon', 'depths', 'signal', 'ember', 'rift'];

/** Art layers (wallpaper-art.css). */
export const STATIC_ART_BACKGROUNDS = ['none', 'skyline', 'bloom', 'horizon', 'void', 'dusk'];

export const ALL_BACKGROUNDS = [...ANIMATED_BACKGROUNDS, ...STATIC_ART_BACKGROUNDS.filter((id) => id !== 'none')];

const LEGACY_THEME_MAP = {
  'light-paper': { mode: 'light', accent: 'teal' },
  'light-fog': { mode: 'light', accent: 'blue' },
  'light-sand': { mode: 'light', accent: 'amber' },
  'light-glacier': { mode: 'light', accent: 'cyan' },
  'light-meadow': { mode: 'light', accent: 'green' },
  'light-circuit': { mode: 'light', accent: 'lime' },
  'light-rose': { mode: 'light', accent: 'rose' },
  'dark-signal': { mode: 'dark', accent: 'mint' },
  'dark-void': { mode: 'dark', accent: 'slate' },
  'dark-violet': { mode: 'dark', accent: 'violet' },
  'dark-forest': { mode: 'dark', accent: 'green' },
  'dark-ember': { mode: 'dark', accent: 'orange' },
  'dark-midnight': { mode: 'dark', accent: 'indigo' },
  'dark-cyan': { mode: 'dark', accent: 'cyan' },
  'dark-crimson': { mode: 'dark', accent: 'red' },
};

const LEGACY_BG_MAP = {
  none: 'none',
  waves: 'beacon',
  aurora: 'bloom',
  nebula: 'void',
  drift: 'dusk',
  pulse: 'signal',
  tide: 'depths',
  rain: 'rift',
  hyperwave: 'beacon',
  plasma: 'ember',
  vortex: 'rift',
  synth: 'signal',
  cosmos: 'void',
  grid: 'skyline',
  circuit: 'signal',
  static: 'ember',
  glitch: 'rift',
  pixelstorm: 'skyline',
  shards: 'depths',
  scanlines: 'horizon',
  city: 'skyline',
};

const DEFAULT_MODE = 'dark';
const DEFAULT_ACCENT = 'mint';
const DEFAULT_BG = 'none';

export function normalizeThemeMode(mode, legacyThemeId) {
  if (THEME_MODES.includes(mode)) return mode;
  const leg = LEGACY_THEME_MAP[legacyThemeId];
  if (leg) return leg.mode;
  if (legacyThemeId?.startsWith('light')) return 'light';
  if (legacyThemeId?.startsWith('dark')) return 'dark';
  return DEFAULT_MODE;
}

export function normalizeAccentId(accentId, legacyThemeId) {
  if (ACCENT_IDS.includes(accentId)) return accentId;
  const leg = LEGACY_THEME_MAP[legacyThemeId];
  if (leg?.accent) return leg.accent;
  return DEFAULT_ACCENT;
}

export function normalizeBgId(id) {
  const mapped = LEGACY_BG_MAP[id] || id;
  if (ANIMATED_BACKGROUNDS.includes(mapped)) return mapped;
  if (STATIC_ART_BACKGROUNDS.includes(mapped)) return mapped;
  return DEFAULT_BG;
}

export function resolveEffectiveTheme(mode) {
  if (mode === 'light' || mode === 'dark') return mode;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
  return prefersDark ? 'dark' : 'light';
}

export function labelThemeMode(id) {
  const key = `appearance.mode.${id}`;
  const label = t(key);
  return label === key ? id : label;
}

export function labelAccent(id) {
  const key = `appearance.accent.${id}`;
  const label = t(key);
  return label === key ? id : label;
}

export function labelBg(id) {
  const key = `appearance.bg.${id}`;
  const label = t(key);
  return label === key ? id : label;
}

/**
 * @param {string} raw
 * @returns {string} #rrggbb or ''
 */
export function normalizeCustomAccentHex(raw) {
  const s = String(raw || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  return '';
}

function applyCustomAccentVars(html, config) {
  const hex = normalizeCustomAccentHex(config?.accentCustomHex);
  if (uiShowsPremiumTier(config) && hex) {
    html.style.setProperty('--blip-accent', hex);
    html.style.setProperty('--blip-glass-border', hex);
    html.style.setProperty('--blip-caret', hex);
    html.dataset.accentCustom = '1';
  } else {
    html.style.removeProperty('--blip-accent');
    html.style.removeProperty('--blip-glass-border');
    html.style.removeProperty('--blip-caret');
    delete html.dataset.accentCustom;
  }
}

export function applyAppearance(config) {
  const html = document.documentElement;
  const mode = normalizeThemeMode(config?.themeMode, config?.themeId);
  const accent = normalizeAccentId(config?.accentId, config?.themeId);
  const bg = normalizeBgId(config?.animatedBgId);
  const effective = resolveEffectiveTheme(mode);

  html.dataset.themeMode = mode;
  html.dataset.theme = effective;
  html.dataset.accent = accent;
  html.dataset.animatedBg = bg;
  delete html.dataset.callWindow;
  html.dataset.reactiveBg =
    config?.reactiveBackground === true && bg !== 'none' ? '1' : '0';
  applyCustomAccentVars(html, config);
  syncReducedMotion(config);
}

export function applyCallWindowAppearance(config) {
  const html = document.documentElement;
  const mode = normalizeThemeMode(config?.themeMode, config?.themeId);
  const accent = normalizeAccentId(config?.accentId, config?.themeId);
  html.dataset.themeMode = mode;
  html.dataset.theme = resolveEffectiveTheme(mode);
  html.dataset.accent = accent;
  html.dataset.animatedBg = 'none';
  html.dataset.callWindow = '1';
  html.dataset.reactiveBg = '0';
  applyCustomAccentVars(html, config);
  syncReducedMotion(config);
}

export function syncReducedMotion(config) {
  const html = document.documentElement;
  const reduce =
    config?.reduceMotion === true ||
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  html.dataset.reducedMotion = reduce ? '1' : '0';
}

export function listenReducedMotion(cb, getConfig) {
  const mqMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const mqScheme = window.matchMedia?.('(prefers-color-scheme: dark)');
  const fn = () => {
    const cfg = getConfig?.();
    if (cfg) applyAppearance(cfg);
    syncReducedMotion(cfg);
    cb?.();
  };
  mqMotion?.addEventListener('change', fn);
  mqScheme?.addEventListener('change', fn);
  return () => {
    mqMotion?.removeEventListener('change', fn);
    mqScheme?.removeEventListener('change', fn);
  };
}
