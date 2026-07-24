import {
  THEME_MODES,
  ACCENT_IDS,
  ANIMATED_BACKGROUNDS,
  STATIC_ART_BACKGROUNDS,
  applyAppearance,
  labelThemeMode,
  labelAccent,
  labelBg,
  normalizeThemeMode,
  normalizeAccentId,
  normalizeBgId,
  normalizeUiSkin,
  applyUiPreferences,
} from '../appearance.js';
import {
  buildThemedSelect,
  fillSettingsDropdown,
  buildSectionSubtitleRow,
  createPixelToggle,
  createPixelHintIcon,
} from '../settings-ui.js';
import {
  fillPremiumGatedDropdown,
  markPremiumGatedOptions,
  MESH_PLUS_FEATURES,
} from '../mesh-plus.js';
import { appendAppIconPickerSections } from '../app-icon-picker.js';
import { appendThemeEditorSection } from '../theme-editor.js';
import { applyReactiveWallpaperConfig } from '../reactive-wallpaper.js';

function appendAppearanceControl(parent, controlEl) {
  const wrap = document.createElement('div');
  wrap.className = 'settings-appearance-control';
  wrap.appendChild(controlEl);
  parent.appendChild(wrap);
}

export function buildAppearanceSection({ getState, saveConfig }) {
  const state = getState();
  const block = document.createElement('div');
  block.className = 'settings-appearance-wrap';
  const curMode = normalizeThemeMode(state.config.themeMode, state.config.themeId);
  const curAccent = normalizeAccentId(state.config.accentId, state.config.themeId);
  const curBg = normalizeBgId(state.config.animatedBgId);
  const curSkin = normalizeUiSkin(state.config.uiSkin);

  const nestToggle = createPixelToggle({
    checked: curSkin === 'nest',
    labelKey: 'settings.nest_ui',
    onChange: async (checked) => {
      const next = await saveConfig({ uiSkin: checked ? 'nest' : 'pixel' });
      state.config = next;
      applyAppearance(state.config);
    },
  });
  const nestRow = document.createElement('div');
  nestRow.className = 'settings-toggle-with-hint';
  nestRow.appendChild(nestToggle.el);
  nestRow.appendChild(createPixelHintIcon('settings.nest_ui_hint'));
  block.appendChild(nestRow);

  block.appendChild(buildSectionSubtitleRow('settings.appearance_theme'));
  const modeOpts = THEME_MODES.map((id) => ({ value: id, label: labelThemeMode(id) }));
  const modeSelect = buildThemedSelect();
  fillSettingsDropdown(modeSelect, modeOpts, curMode, async (id) => {
    state.config = await saveConfig({ themeMode: id });
    applyAppearance(state.config);
  });
  appendAppearanceControl(block, modeSelect);

  const accentGroup = document.createElement('div');
  accentGroup.className = 'settings-appearance-accent-group settings-list-panel';
  accentGroup.appendChild(buildSectionSubtitleRow('settings.appearance_accent'));

  const accentOpts = ACCENT_IDS.map((id) => ({ value: id, label: labelAccent(id) }));
  const accentSelect = buildThemedSelect();
  fillSettingsDropdown(accentSelect, accentOpts, curAccent, async (id) => {
    state.config = await saveConfig({ accentId: id });
    applyAppearance(state.config);
  });
  appendAppearanceControl(accentGroup, accentSelect);

  appendThemeEditorSection(accentGroup, () => state.config, async (patch) => {
    state.config = await saveConfig(patch);
    return state.config;
  });
  block.appendChild(accentGroup);

  block.appendChild(
    buildSectionSubtitleRow('settings.bg_animated', 'settings.bg_animated_mesh_hint'),
  );
  const animOpts = markPremiumGatedOptions(
    ANIMATED_BACKGROUNDS.map((id) => ({ value: id, label: labelBg(id) })),
    MESH_PLUS_FEATURES.animated_bg,
    state.config,
  );
  const animSelect = buildThemedSelect();
  fillPremiumGatedDropdown(
    animSelect,
    animOpts,
    ANIMATED_BACKGROUNDS.includes(curBg) ? curBg : 'none',
    MESH_PLUS_FEATURES.animated_bg,
    state.config,
    async (id) => {
      state.config = await saveConfig({ animatedBgId: normalizeBgId(id) });
      applyAppearance(state.config);
      applyReactiveWallpaperConfig(state.config);
    },
  );
  appendAppearanceControl(block, animSelect);

  block.appendChild(buildSectionSubtitleRow('settings.bg_art'));
  const artOpts = STATIC_ART_BACKGROUNDS.map((id) => ({ value: id, label: labelBg(id) }));
  const artSelect = buildThemedSelect();
  const artCurrent = STATIC_ART_BACKGROUNDS.includes(curBg) ? curBg : 'none';
  fillSettingsDropdown(artSelect, artOpts, artCurrent, async (id) => {
    state.config = await saveConfig({ animatedBgId: normalizeBgId(id) });
    applyAppearance(state.config);
    applyReactiveWallpaperConfig(state.config);
  });
  appendAppearanceControl(block, artSelect);

  const reactiveToggle = createPixelToggle({
    checked: !!state.config.reactiveBackground,
    labelKey: 'settings.reactive_background',
    onChange: async (checked) => {
      state.config = await saveConfig({ reactiveBackground: checked });
      applyAppearance(state.config);
      applyReactiveWallpaperConfig(state.config);
    },
  });
  const reactiveRow = document.createElement('div');
  reactiveRow.className = 'settings-toggle-with-hint';
  reactiveRow.appendChild(reactiveToggle.el);
  reactiveRow.appendChild(createPixelHintIcon('settings.reactive_background_hint'));
  block.appendChild(reactiveRow);

  const motionToggle = createPixelToggle({
    checked: !!state.config.reduceMotion,
    labelKey: 'settings.reduce_motion',
    onChange: async (checked) => {
      state.config = await saveConfig({ reduceMotion: checked });
      applyAppearance(state.config);
    },
  });
  const motionRow = document.createElement('div');
  motionRow.className = 'settings-toggle-with-hint';
  motionRow.appendChild(motionToggle.el);
  motionRow.appendChild(createPixelHintIcon('settings.motion_hint'));
  block.appendChild(motionRow);

  const compactToggle = createPixelToggle({
    checked: state.config.uiDensity === 'compact',
    labelKey: 'settings.ui_compact',
    onChange: async (checked) => {
      state.config = await saveConfig({ uiDensity: checked ? 'compact' : 'comfortable' });
      applyAppearance(state.config);
    },
  });
  block.appendChild(compactToggle.el);

  block.appendChild(buildSectionSubtitleRow('settings.ui_font_scale'));
  const uiFontRow = document.createElement('div');
  uiFontRow.className = 'settings-sound-volume-row';
  const uiFontRange = document.createElement('input');
  uiFontRange.type = 'range';
  uiFontRange.min = '85';
  uiFontRange.max = '125';
  uiFontRange.step = '5';
  uiFontRange.className = 'settings-sound-range';
  const uiFontPct = Math.round((Number(state.config.uiFontScale) || 1) * 100);
  uiFontRange.value = String(uiFontPct);
  const uiFontVal = document.createElement('span');
  uiFontVal.className = 'settings-sound-volume-val';
  uiFontVal.textContent = `${uiFontPct}%`;
  uiFontRange.addEventListener('input', () => {
    uiFontVal.textContent = `${uiFontRange.value}%`;
    applyUiPreferences({ ...state.config, uiFontScale: Number(uiFontRange.value) / 100 });
  });
  uiFontRange.addEventListener('change', async () => {
    state.config = await saveConfig({ uiFontScale: Number(uiFontRange.value) / 100 });
    applyAppearance(state.config);
  });
  uiFontRow.appendChild(uiFontRange);
  uiFontRow.appendChild(uiFontVal);
  appendAppearanceControl(block, uiFontRow);

  block.appendChild(buildSectionSubtitleRow('settings.chat_font_scale'));
  const chatFontRow = document.createElement('div');
  chatFontRow.className = 'settings-sound-volume-row';
  const chatFontRange = document.createElement('input');
  chatFontRange.type = 'range';
  chatFontRange.min = '85';
  chatFontRange.max = '135';
  chatFontRange.step = '5';
  chatFontRange.className = 'settings-sound-range';
  const chatFontPct = Math.round((Number(state.config.chatFontScale) || 1) * 100);
  chatFontRange.value = String(chatFontPct);
  const chatFontVal = document.createElement('span');
  chatFontVal.className = 'settings-sound-volume-val';
  chatFontVal.textContent = `${chatFontPct}%`;
  chatFontRange.addEventListener('input', () => {
    chatFontVal.textContent = `${chatFontRange.value}%`;
    applyUiPreferences({ ...state.config, chatFontScale: Number(chatFontRange.value) / 100 });
  });
  chatFontRange.addEventListener('change', async () => {
    state.config = await saveConfig({ chatFontScale: Number(chatFontRange.value) / 100 });
    applyAppearance(state.config);
  });
  chatFontRow.appendChild(chatFontRange);
  chatFontRow.appendChild(chatFontVal);
  appendAppearanceControl(block, chatFontRow);

  appendAppIconPickerSections(block, state, saveConfig);

  return block;
}
