import { t } from './i18n.js';

export function buildThemedSelect(className = 'blip-select settings-dropdown') {
  const sel = document.createElement('select');
  sel.className = className;
  return sel;
}

/**
 * @param {{ value: string, label: string }[]} options
 * @param {string} current
 * @param {(value: string) => void} onChange
 */
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

/** Pixel ? tooltip (title on hover). */
export function createPixelHintIcon(hintKey) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pixel-hint-btn';
  btn.setAttribute('aria-label', t(hintKey));
  btn.title = t(hintKey);
  btn.textContent = '?';
  return btn;
}

/** Label row: text + optional hint icon. */
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

/**
 * Square pixel toggle (hidden checkbox + visual switch).
 * @param {{ checked?: boolean, labelKey?: string, labelText?: string, onChange?: (v: boolean) => void }} opts
 */
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

/** @param {string} text */
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
