
let closeOpenPopover = null;

export function createBlipColorInput(opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = ['blip-color-input', opts.className].filter(Boolean).join(' ');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'blip-color-input__preview';
  trigger.setAttribute('aria-haspopup', 'dialog');
  if (opts.title) {
    trigger.title = opts.title;
    trigger.setAttribute('aria-label', opts.title);
  }

  const input = document.createElement('input');
  input.type = 'color';
  input.className = 'blip-color-input__native';
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');

  let hsv = { h: 160, s: 1, v: 1 };
  let disabled = false;
  let popover = null;
  let draftHex = normalizePickerHex(opts.value) || '#00ffc8';

  function applyHex(hex, emit = true) {
    const norm = normalizePickerHex(hex);
    if (!norm) return;
    draftHex = norm;
    hsv = rgbToHsv(hexToRgb(norm));
    input.value = norm;
    syncPreview();
    if (emit) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      opts.onInput?.(norm);
    }
  }

  function syncPreview() {
    const hex = normalizePickerHex(draftHex) || '#00ffc8';
    trigger.style.background = hex;
    trigger.style.boxShadow = `inset 0 0 0 1px color-mix(in srgb, ${hex} 55%, #000), 3px 3px 0 rgba(0, 0, 0, 0.45)`;
    if (popover) syncPopoverFields(hex);
  }

  function closePopover() {
    if (!popover) return;
    popover.remove();
    popover = null;
    wrap.classList.remove('blip-color-input--open');
    document.removeEventListener('pointerdown', onDocPointer, true);
    document.removeEventListener('keydown', onDocKey, true);
    if (closeOpenPopover === closePopover) closeOpenPopover = null;
  }

  function onDocPointer(e) {
    if (!popover) return;
    const t =  (e.target);
    if (popover.contains(t) || wrap.contains(t)) return;
    closePopover();
  }

  function onDocKey(e) {
    if (e.key === 'Escape') closePopover();
  }

  function syncPopoverFields(hex) {
    if (!popover) return;
    const rgb = hexToRgb(hex);
    popover.querySelector('.blip-color-popover__hex').value = hex;
    popover.querySelector('.blip-color-popover__r').value = String(rgb.r);
    popover.querySelector('.blip-color-popover__g').value = String(rgb.g);
    popover.querySelector('.blip-color-popover__b').value = String(rgb.b);
    updateSvUi();
    updateHueUi();
  }

  function updateSvUi() {
    if (!popover) return;
    const sv = popover.querySelector('.blip-color-popover__sv');
    const cursor = popover.querySelector('.blip-color-popover__sv-cursor');
    sv.style.backgroundColor = `hsl(${Math.round(hsv.h)} 100% 50%)`;
    const rect = sv.getBoundingClientRect();
    cursor.style.left = `${hsv.s * rect.width}px`;
    cursor.style.top = `${(1 - hsv.v) * rect.height}px`;
    const preview = popover.querySelector('.blip-color-popover__current');
    preview.style.background = draftHex;
  }

  function updateHueUi() {
    if (!popover) return;
    const hueEl = popover.querySelector('.blip-color-popover__hue');
    const cursor = popover.querySelector('.blip-color-popover__hue-cursor');
    const rect = hueEl.getBoundingClientRect();
    cursor.style.left = `${(hsv.h / 360) * rect.width}px`;
  }

  function openPopover() {
    if (disabled) return;
    closeOpenPopover?.();
    closeOpenPopover = closePopover;

    popover = document.createElement('div');
    popover.className = 'blip-color-popover glass';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', opts.title || 'Color');

    const sv = document.createElement('div');
    sv.className = 'blip-color-popover__sv';
    const svCursor = document.createElement('span');
    svCursor.className = 'blip-color-popover__sv-cursor';
    sv.appendChild(svCursor);

    const hue = document.createElement('div');
    hue.className = 'blip-color-popover__hue';
    const hueCursor = document.createElement('span');
    hueCursor.className = 'blip-color-popover__hue-cursor';
    hue.appendChild(hueCursor);

    const fields = document.createElement('div');
    fields.className = 'blip-color-popover__fields';

    const current = document.createElement('span');
    current.className = 'blip-color-popover__current';
    current.setAttribute('aria-hidden', 'true');

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'input blip-color-popover__hex';
    hexInput.maxLength = 7;
    hexInput.spellcheck = false;

    const rgbWrap = document.createElement('div');
    rgbWrap.className = 'blip-color-popover__rgb';
    for (const [key, cls] of [
      ['R', 'r'],
      ['G', 'g'],
      ['B', 'b'],
    ]) {
      const lab = document.createElement('span');
      lab.className = 'blip-color-popover__rgb-label';
      lab.textContent = key;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.min = '0';
      inp.max = '255';
      inp.className = `input blip-color-popover__${cls}`;
      rgbWrap.appendChild(lab);
      rgbWrap.appendChild(inp);
    }

    fields.appendChild(current);
    fields.appendChild(hexInput);
    fields.appendChild(rgbWrap);

    const actions = document.createElement('div');
    actions.className = 'blip-color-popover__actions';
    const dropBtn = document.createElement('button');
    dropBtn.type = 'button';
    dropBtn.className = 'btn btn-lang blip-color-popover__eyedropper';
    dropBtn.title = 'Eyedropper';
    dropBtn.textContent = '◎';
    dropBtn.hidden = typeof window.EyeDropper !== 'function';
    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'btn btn-accent blip-color-popover__done';
    doneBtn.textContent = 'OK';

    actions.appendChild(dropBtn);
    actions.appendChild(doneBtn);

    popover.appendChild(sv);
    popover.appendChild(hue);
    popover.appendChild(fields);
    popover.appendChild(actions);
    document.body.appendChild(popover);
    wrap.classList.add('blip-color-input--open');

    function setFromHsv(emit = true) {
      const rgb = hsvToRgb(hsv);
      applyHex(rgbToHex(rgb), emit);
    }

    function pickSv(clientX, clientY) {
      const rect = sv.getBoundingClientRect();
      const s = clamp01((clientX - rect.left) / rect.width);
      const v = clamp01(1 - (clientY - rect.top) / rect.height);
      hsv = { ...hsv, s, v };
      setFromHsv();
    }

    function pickHue(clientX) {
      const rect = hue.getBoundingClientRect();
      const h = clamp01((clientX - rect.left) / rect.width) * 360;
      hsv = { ...hsv, h };
      setFromHsv();
    }

    let dragSv = false;
    let dragHue = false;

    sv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragSv = true;
      sv.setPointerCapture(e.pointerId);
      pickSv(e.clientX, e.clientY);
    });
    sv.addEventListener('pointermove', (e) => {
      if (!dragSv) return;
      pickSv(e.clientX, e.clientY);
    });
    sv.addEventListener('pointerup', () => {
      dragSv = false;
    });
    sv.addEventListener('pointercancel', () => {
      dragSv = false;
    });

    hue.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragHue = true;
      hue.setPointerCapture(e.pointerId);
      pickHue(e.clientX);
    });
    hue.addEventListener('pointermove', (e) => {
      if (!dragHue) return;
      pickHue(e.clientX);
    });
    hue.addEventListener('pointerup', () => {
      dragHue = false;
    });
    hue.addEventListener('pointercancel', () => {
      dragHue = false;
    });

    hexInput.addEventListener('change', () => {
      const norm = normalizePickerHex(hexInput.value.trim());
      if (norm) applyHex(norm);
      else hexInput.value = draftHex;
    });

    for (const cls of ['r', 'g', 'b']) {
      const inp = popover.querySelector(`.blip-color-popover__${cls}`);
      inp.addEventListener('change', () => {
        const r = clampByte(popover.querySelector('.blip-color-popover__r').value);
        const g = clampByte(popover.querySelector('.blip-color-popover__g').value);
        const b = clampByte(popover.querySelector('.blip-color-popover__b').value);
        applyHex(rgbToHex({ r, g, b }));
      });
    }

    dropBtn.addEventListener('click', async () => {
      try {
        const ed = new window.EyeDropper();
        const res = await ed.open();
        if (res?.sRGBHex) applyHex(res.sRGBHex);
      } catch {

      }
    });

    doneBtn.addEventListener('click', () => closePopover());

    syncPopoverFields(draftHex);
    positionPopover(trigger, popover);

    requestAnimationFrame(() => {
      document.addEventListener('pointerdown', onDocPointer, true);
      document.addEventListener('keydown', onDocKey, true);
    });
  }

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (popover) closePopover();
    else openPopover();
  });

  applyHex(draftHex, false);
  wrap.appendChild(trigger);
  wrap.appendChild(input);

  return {
    el: wrap,
    input,
    preview: trigger,
    get value() {
      return draftHex;
    },
    set value(v) {
      applyHex(v, false);
    },
    syncPreview,
    get disabled() {
      return disabled;
    },
    set disabled(v) {
      disabled = Boolean(v);
      trigger.disabled = disabled;
      if (disabled) closePopover();
    },
  };
}

function positionPopover(anchor, popover) {
  const gap = 8;
  const pad = 10;
  const ar = anchor.getBoundingClientRect();
  popover.style.visibility = 'hidden';
  popover.style.top = '0';
  popover.style.left = '0';
  const pr = popover.getBoundingClientRect();
  let top = ar.bottom + gap;
  let left = ar.left;
  if (left + pr.width > window.innerWidth - pad) {
    left = Math.max(pad, window.innerWidth - pr.width - pad);
  }
  if (top + pr.height > window.innerHeight - pad) {
    top = Math.max(pad, ar.top - pr.height - gap);
  }
  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;
  popover.style.visibility = '';
}

export function normalizePickerHex(hex) {
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

function hexToRgb(hex) {
  const n = normalizePickerHex(hex) || '#000000';
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

function rgbToHex(rgb) {
  const r = clampByte(rgb.r).toString(16).padStart(2, '0');
  const g = clampByte(rgb.g).toString(16).padStart(2, '0');
  const b = clampByte(rgb.b).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function rgbToHsv(rgb) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(hsv) {
  const h = ((hsv.h % 360) + 360) % 360;
  const s = clamp01(hsv.s);
  const v = clamp01(hsv.v);
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function clamp01(n) {
  return Math.min(1, Math.max(0, Number(n) || 0));
}

function clampByte(n) {
  return Math.min(255, Math.max(0, Math.round(Number(n) || 0)));
}
