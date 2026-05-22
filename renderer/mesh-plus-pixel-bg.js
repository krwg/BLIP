/** BLIP-style pixel grid for Settings → MESH+ */

export const MESH_PIXEL_COLS = 28;
export const MESH_PIXEL_ROWS = 6;

/** @param {number} t 0..1 */
function blipPixelRgb(t) {
  const clamp = Math.max(0, Math.min(1, t));
  const stops = [
    [124, 58, 237],
    [34, 211, 238],
    [0, 255, 200],
  ];
  const seg = clamp * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = stops[i];
  const b = stops[i + 1];
  return {
    r: Math.round(a[0] + (b[0] - a[0]) * f),
    g: Math.round(a[1] + (b[1] - a[1]) * f),
    b: Math.round(a[2] + (b[2] - a[2]) * f),
  };
}

/**
 * @param {HTMLElement} gridEl
 * @param {boolean} active — MESH+ subscription active
 */
export function fillMeshPlusPixelGrid(gridEl, active) {
  gridEl.replaceChildren();
  for (let r = 0; r < MESH_PIXEL_ROWS; r++) {
    for (let c = 0; c < MESH_PIXEL_COLS; c++) {
      const cell = document.createElement('span');
      cell.className = 'mesh-plus-pixel-grid__cell';
      const idx = r * MESH_PIXEL_COLS + c;
      const wave = (c / Math.max(1, MESH_PIXEL_COLS - 1) + r / Math.max(1, MESH_PIXEL_ROWS - 1) * 0.35) / 1.35;
      cell.style.setProperty('--cell-delay', String(idx % 19));

      if (active) {
        const { r: cr, g, b } = blipPixelRgb(wave);
        cell.style.setProperty('--cell-r', String(cr));
        cell.style.setProperty('--cell-g', String(g));
        cell.style.setProperty('--cell-b', String(b));
      } else {
        const lit = 18 + ((r * 3 + c * 5 + idx) % 7) * 5;
        cell.style.setProperty('--cell-lit', String(lit));
      }
      gridEl.appendChild(cell);
    }
  }
}

/**
 * Hero block: animated pixel field + inner slot (status card).
 * @returns {{ hero: HTMLElement, inner: HTMLElement, setSubscriptionActive: (boolean) => void }}
 */
export function createMeshPlusPixelHero() {
  const hero = document.createElement('div');
  hero.className = 'mesh-plus-hero mesh-plus-hero--free';

  const grid = document.createElement('div');
  grid.className = 'mesh-plus-pixel-grid';
  grid.setAttribute('aria-hidden', 'true');
  fillMeshPlusPixelGrid(grid, false);

  const inner = document.createElement('div');
  inner.className = 'mesh-plus-hero__inner';

  hero.appendChild(grid);
  hero.appendChild(inner);

  return {
    hero,
    inner,
    setSubscriptionActive(active) {
      hero.classList.toggle('mesh-plus-hero--active', !!active);
      hero.classList.toggle('mesh-plus-hero--free', !active);
      fillMeshPlusPixelGrid(grid, !!active);
    },
  };
}

/**
 * Thin pixel strip for carousel / panels.
 * @param {boolean} active
 */
export function createMeshPlusPixelStrip(active = false) {
  const strip = document.createElement('div');
  strip.className = `mesh-plus-pixel-strip${active ? ' mesh-plus-pixel-strip--active' : ' mesh-plus-pixel-strip--free'}`;
  strip.setAttribute('aria-hidden', 'true');
  const mini = document.createElement('div');
  mini.className = 'mesh-plus-pixel-grid mesh-plus-pixel-grid--strip';
  const cols = 20;
  const rows = 3;
  mini.style.setProperty('--mesh-cols', String(cols));
  mini.style.setProperty('--mesh-rows', String(rows));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('span');
      cell.className = 'mesh-plus-pixel-grid__cell';
      const idx = r * cols + c;
      const wave = c / Math.max(1, cols - 1);
      cell.style.setProperty('--cell-delay', String(idx % 11));
      if (active) {
        const { r: cr, g, b } = blipPixelRgb(wave);
        cell.style.setProperty('--cell-r', String(cr));
        cell.style.setProperty('--cell-g', String(g));
        cell.style.setProperty('--cell-b', String(b));
      } else {
        cell.style.setProperty('--cell-lit', String(20 + ((r + c + idx) % 5) * 6));
      }
      mini.appendChild(cell);
    }
  }
  strip.appendChild(mini);
  return {
    strip,
    setSubscriptionActive(on) {
      strip.classList.toggle('mesh-plus-pixel-strip--active', !!on);
      strip.classList.toggle('mesh-plus-pixel-strip--free', !on);
      mini.querySelectorAll('.mesh-plus-pixel-grid__cell').forEach((cell, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const wave = c / Math.max(1, cols - 1);
        if (on) {
          const rgb = blipPixelRgb(wave);
          cell.style.setProperty('--cell-r', String(rgb.r));
          cell.style.setProperty('--cell-g', String(rgb.g));
          cell.style.setProperty('--cell-b', String(rgb.b));
          cell.style.removeProperty('--cell-lit');
        } else {
          cell.style.setProperty('--cell-lit', String(20 + ((r + c + i) % 5) * 6));
          cell.style.removeProperty('--cell-r');
          cell.style.removeProperty('--cell-g');
          cell.style.removeProperty('--cell-b');
        }
      });
    },
  };
}
