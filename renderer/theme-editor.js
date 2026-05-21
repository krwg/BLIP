import { t } from './i18n.js';
import { isMeshPlusActive, showMeshPlusLockedToast } from './mesh-plus.js';
import { applyAppearance, normalizeCustomAccentHex } from './appearance.js';
import { buildSectionSubtitleRow } from './settings-ui.js';
import { createBlipColorInput } from './blip-color-input.js';

/**
 * MESH+ custom accent (#RRGGBB).
 * @param {() => object} getConfig
 * @param {(patch: object) => Promise<object>} saveConfig
 */
export function appendThemeEditorSection(block, getConfig, saveConfig) {
  const row = document.createElement('div');
  row.className = 'settings-theme-editor';

  const hexInput = document.createElement('input');
  hexInput.type = 'text';
  hexInput.className = 'input settings-theme-editor-hex';
  hexInput.maxLength = 7;
  hexInput.placeholder = '#00ffc8';
  hexInput.dataset.i18nPlaceholder = 'appearance.custom_accent_placeholder';

  const colorPickUi = createBlipColorInput({
    value: '#00ffc8',
    title: t('appearance.custom_accent_placeholder'),
    className: 'settings-theme-editor-color',
  });
  const colorPick = colorPickUi.input;

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'btn btn-accent';
  applyBtn.dataset.i18n = 'appearance.custom_accent_apply';
  applyBtn.textContent = t('appearance.custom_accent_apply');

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn btn-lang';
  clearBtn.dataset.i18n = 'appearance.custom_accent_clear';
  clearBtn.textContent = t('appearance.custom_accent_clear');

  const controls = document.createElement('div');
  controls.className = 'settings-theme-editor-controls';
  controls.appendChild(colorPickUi.el);
  controls.appendChild(hexInput);
  controls.appendChild(applyBtn);
  controls.appendChild(clearBtn);

  function syncInputsFromConfig() {
    const cfg = getConfig();
    const hex = normalizeCustomAccentHex(cfg?.accentCustomHex) || '#00ffc8';
    hexInput.value = cfg?.accentCustomHex ? hex : '';
    colorPickUi.value = hex;
  }

  function setDisabled(locked) {
    hexInput.disabled = locked;
    colorPick.disabled = locked;
    applyBtn.disabled = locked;
    clearBtn.disabled = locked;
    row.classList.toggle('settings-theme-editor--locked', locked);
  }

  colorPick.addEventListener('input', () => {
    hexInput.value = colorPick.value;
  });

  applyBtn.addEventListener('click', async () => {
    if (!isMeshPlusActive(getConfig())) {
      showMeshPlusLockedToast();
      return;
    }
    const hex = normalizeCustomAccentHex(hexInput.value || colorPick.value);
    if (!hex) return;
    const cfg = await saveConfig({ accentCustomHex: hex });
    applyAppearance(cfg);
    syncInputsFromConfig();
  });

  clearBtn.addEventListener('click', async () => {
    if (!isMeshPlusActive(getConfig())) {
      showMeshPlusLockedToast();
      return;
    }
    const cfg = await saveConfig({ accentCustomHex: '' });
    applyAppearance(cfg);
    syncInputsFromConfig();
  });

  row.appendChild(controls);
  block.appendChild(
    buildSectionSubtitleRow('appearance.custom_accent', 'appearance.custom_accent_mesh_hint')
  );
  const customWrap = document.createElement('div');
  customWrap.className = 'settings-appearance-control';
  customWrap.appendChild(row);
  block.appendChild(customWrap);

  syncInputsFromConfig();
  setDisabled(!isMeshPlusActive(getConfig()));

  return {
    refresh() {
      syncInputsFromConfig();
      setDisabled(!isMeshPlusActive(getConfig()));
    },
  };
}
