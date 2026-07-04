import { t } from './i18n.js';

let openMenu = null;

function closeOpenMenu() {
  if (!openMenu) return;
  openMenu.el.remove();
  openMenu.cleanup?.();
  openMenu = null;
}

export function openBeaconRowMenu(anchor, items) {
  closeOpenMenu();

  const menu = document.createElement('div');
  menu.className = 'beacon-row-menu glass';
  menu.setAttribute('role', 'menu');

  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `beacon-row-menu-item${item.danger ? ' beacon-row-menu-item--danger' : ''}`;
    btn.textContent = item.label;
    btn.disabled = !!item.disabled;
    btn.setAttribute('role', 'menuitem');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.disabled) return;
      closeOpenMenu();
      item.onClick?.();
    });
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  let left = rect.right - mw;
  let top = rect.bottom + 4;
  if (left < 8) left = 8;
  if (top + mh > window.innerHeight - 8) top = rect.top - mh - 4;
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;

  const onDoc = (e) => {
    if (menu.contains(e.target) || anchor.contains(e.target)) return;
    closeOpenMenu();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') closeOpenMenu();
  };
  const onScroll = () => closeOpenMenu();

  setTimeout(() => {
    document.addEventListener('pointerdown', onDoc, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
  }, 0);

  openMenu = {
    el: menu,
    cleanup: () => {
      document.removeEventListener('pointerdown', onDoc, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    },
  };
}

export function createBeaconRowMenuButton(onOpen) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'beacon-row-menu-btn';
  btn.setAttribute('aria-label', t('beacon.actions_menu'));
  btn.setAttribute('aria-haspopup', 'menu');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onOpen(btn);
  });
  return btn;
}
