import { t } from './i18n.js';
import { getBeaconCatalog } from './beacon-mesh.js';
import { formatFileSize } from './file-transfer.js';

let listRoot = null;

function renderList() {
  const list = listRoot;
  if (!list) return;
  const items = getBeaconCatalog();
  list.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'beacon-empty';
    empty.dataset.i18n = 'beacon.empty';
    empty.textContent = t('beacon.empty');
    list.appendChild(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'beacon-row glass';
    const strong = document.createElement('strong');
    strong.textContent = item.filename;
    const sub = document.createElement('span');
    sub.className = 'beacon-sub';
    sub.textContent = `${formatFileSize(item.size)} · ${item.seederCount} ${t('beacon.seeders')} · ${item.seedId.slice(0, 8)}…`;
    row.appendChild(strong);
    row.appendChild(sub);
    list.appendChild(row);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('blip-beacon-catalog', renderList);
}

/** Main nav view — BEACON / МАЯК */
export function renderBeaconView() {
  const wrap = document.createElement('div');
  wrap.className = 'view beacon-view';

  const head = document.createElement('div');
  head.className = 'beacon-view-head';
  const title = document.createElement('h2');
  title.className = 'section-title beacon-view-title';
  title.dataset.i18n = 'beacon.title';
  title.textContent = t('beacon.title');
  const beta = document.createElement('span');
  beta.className = 'nav-beta-badge';
  beta.dataset.i18n = 'nav.beacon_beta';
  beta.textContent = t('nav.beacon_beta');
  head.appendChild(title);
  head.appendChild(beta);

  const hint = document.createElement('p');
  hint.className = 'beacon-hint';
  hint.dataset.i18n = 'beacon.hint';
  hint.textContent = t('beacon.hint');

  listRoot = document.createElement('div');
  listRoot.className = 'beacon-list';

  wrap.appendChild(head);
  wrap.appendChild(hint);
  wrap.appendChild(listRoot);
  renderList();
  return wrap;
}

/** Legacy floating panel (settings developer button). */
export function mountBeaconPanel() {
  let panelEl = document.querySelector('.beacon-panel');
  if (panelEl?.isConnected) {
    panelEl.classList.remove('hidden');
    renderList();
    return panelEl;
  }
  panelEl = document.createElement('div');
  panelEl.className = 'beacon-panel glass';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn-lang beacon-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => panelEl.classList.add('hidden'));
  const head = document.createElement('div');
  head.className = 'beacon-head';
  const title = document.createElement('span');
  title.className = 'beacon-title';
  title.dataset.i18n = 'beacon.title';
  title.textContent = t('beacon.title');
  head.appendChild(title);
  head.appendChild(closeBtn);
  const hint = document.createElement('p');
  hint.className = 'beacon-hint';
  hint.dataset.i18n = 'beacon.hint';
  hint.textContent = t('beacon.hint');
  listRoot = document.createElement('div');
  listRoot.className = 'beacon-list';
  panelEl.appendChild(head);
  panelEl.appendChild(hint);
  panelEl.appendChild(listRoot);
  document.body.appendChild(panelEl);
  renderList();
  return panelEl;
}
