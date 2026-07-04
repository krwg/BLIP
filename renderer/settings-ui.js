import { t } from './i18n.js';
import { showAppToast } from './toasts.js';

export function buildThemedSelect(className = 'blip-select settings-dropdown') {
  const sel = document.createElement('select');
  sel.className = className;
  return sel;
}

export function createSettingsListPanel(extraClass = '') {
  const panel = document.createElement('div');
  panel.className = ['settings-list-panel', extraClass].filter(Boolean).join(' ');
  return panel;
}

export function wrapInSettingsListPanel(content, extraClass = '') {
  const panel = createSettingsListPanel(extraClass);
  panel.appendChild(content);
  return panel;
}

export function fillSettingsDropdown(select, options, current, onChange) {
  select.innerHTML = '';
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    select.appendChild(o);
  }
  const ok = options.some((o) => o.value === current);
  select.value = ok ? current : options[0]?.value || '';
  select.addEventListener('change', () => onChange(select.value));
}

export function buildSettingsField(labelKey, controlEl) {
  const wrap = document.createElement('div');
  wrap.className = 'settings-field';
  const label = document.createElement('label');
  label.className = 'settings-field-label';
  label.dataset.i18n = labelKey;
  label.textContent = t(labelKey);
  wrap.appendChild(label);
  wrap.appendChild(controlEl);
  return wrap;
}

export function createPixelHintIcon(hintKey) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pixel-hint-btn';
  const hintText = t(hintKey);
  btn.setAttribute('aria-label', hintText);
  btn.title = hintText;
  btn.textContent = '?';
  btn.addEventListener('click', () => {
    showAppToast({ title: hintText, durationMs: 6500 });
  });
  return btn;
}

export function buildSectionSubtitleRow(labelKey, hintKey) {
  const row = document.createElement('div');
  row.className = 'section-title-row';
  const sub = document.createElement('h3');
  sub.className = 'section-subtitle';
  sub.dataset.i18n = labelKey;
  sub.textContent = t(labelKey);
  row.appendChild(sub);
  if (hintKey) row.appendChild(createPixelHintIcon(hintKey));
  return row;
}

export function buildPanelTitleRow(labelKey, hintKey) {
  const row = document.createElement('div');
  row.className = 'settings-panel-title-row';
  const h = document.createElement('h2');
  h.className = 'settings-panel-title';
  h.dataset.i18n = labelKey;
  h.textContent = t(labelKey);
  row.appendChild(h);
  if (hintKey) row.appendChild(createPixelHintIcon(hintKey));
  return row;
}

export function buildSettingsLabelRow(labelKey, hintKey) {
  const row = document.createElement('div');
  row.className = 'settings-label-row';
  const label = document.createElement('span');
  label.className = 'settings-field-label';
  label.dataset.i18n = labelKey;
  label.textContent = t(labelKey);
  row.appendChild(label);
  if (hintKey) row.appendChild(createPixelHintIcon(hintKey));
  return row;
}

export function buildSettingsFieldWithHint(labelKey, hintKey, controlEl) {
  const wrap = document.createElement('div');
  wrap.className = 'settings-field';
  wrap.appendChild(buildSettingsLabelRow(labelKey, hintKey));
  wrap.appendChild(controlEl);
  return wrap;
}

export function createPixelToggle(opts = {}) {
  const row = document.createElement('label');
  row.className = 'pixel-toggle-row';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'pixel-toggle-input';
  input.checked = !!opts.checked;

  const track = document.createElement('span');
  track.className = 'pixel-toggle';
  track.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.className = 'pixel-toggle-label';
  if (opts.labelKey) {
    label.dataset.i18n = opts.labelKey;
    label.textContent = t(opts.labelKey);
  } else {
    label.textContent = opts.labelText || '';
  }

  row.appendChild(input);
  row.appendChild(track);
  row.appendChild(label);

  input.addEventListener('change', () => {
    opts.onChange?.(input.checked);
  });

  return {
    el: row,
    input,
    setChecked(v) {
      input.checked = !!v;
    },
  };
}

export async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
