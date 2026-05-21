/**
 * BLIP-styled color picker (dark frame + swatch preview; native dialog on click).
 * @param {{ value?: string, onInput?: (hex: string) => void, title?: string, className?: string }} [opts]
 */
export function createBlipColorInput(opts = {}) {
  const wrap = document.createElement('label');
  wrap.className = ['blip-color-input', opts.className].filter(Boolean).join(' ');
  if (opts.title) wrap.title = opts.title;

  const preview = document.createElement('span');
  preview.className = 'blip-color-input__preview';
  preview.setAttribute('aria-hidden', 'true');

  const input = document.createElement('input');
  input.type = 'color';
  input.className = 'blip-color-input__native';
  input.value = normalizePickerHex(opts.value) || '#00ffc8';

  function syncPreview() {
    const hex = normalizePickerHex(input.value) || '#00ffc8';
    preview.style.background = hex;
    preview.style.boxShadow = `inset 0 0 0 1px color-mix(in srgb, ${hex} 55%, #000), 3px 3px 0 rgba(0, 0, 0, 0.45)`;
  }

  input.addEventListener('input', () => {
    syncPreview();
    opts.onInput?.(input.value);
  });

  syncPreview();
  wrap.appendChild(preview);
  wrap.appendChild(input);

  return {
    el: wrap,
    input,
    preview,
    get value() {
      return input.value;
    },
    set value(v) {
      input.value = normalizePickerHex(v) || '#00ffc8';
      syncPreview();
    },
    syncPreview,
  };
}

/** @param {string} [hex] */
function normalizePickerHex(hex) {
  const s = String(hex || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return '';
}
