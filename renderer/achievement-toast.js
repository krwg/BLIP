import { t } from './i18n.js';
import { appendAchievementIcon } from './achievements.js';

const FADE_MS = 300;

let stackEl = null;

function ensureStack() {
  if (stackEl?.isConnected) return stackEl;
  stackEl = document.createElement('div');
  stackEl.className = 'toast-stack';
  document.body.appendChild(stackEl);
  return stackEl;
}

/**
 * @param {import('./achievements.js').AchievementDef} def
 * @param {{ durationMs?: number }} [opts]
 */
export function showAchievementUnlockToast(def, opts = {}) {
  const durationMs = opts.durationMs ?? 5500;
  const stack = ensureStack();

  const el = document.createElement('div');
  el.className = 'app-toast glass app-toast--achievement app-toast--accent';
  el.setAttribute('role', 'status');

  const inner = document.createElement('div');
  inner.className = 'achievement-toast__inner';

  const iconCol = document.createElement('div');
  iconCol.className = 'achievement-toast__icon';
  appendAchievementIcon(iconCol, def);

  const textCol = document.createElement('div');
  textCol.className = 'achievement-toast__text';

  const kicker = document.createElement('div');
  kicker.className = 'achievement-toast__kicker';
  kicker.dataset.i18n = 'achievements.unlocked_title';
  kicker.textContent = t('achievements.unlocked_title');

  const title = document.createElement('strong');
  title.className = 'achievement-toast__title';
  title.textContent = t(def.titleKey);

  const desc = document.createElement('p');
  desc.className = 'achievement-toast__desc';
  desc.textContent = t(def.descKey);

  textCol.appendChild(kicker);
  textCol.appendChild(title);
  textCol.appendChild(desc);
  inner.appendChild(iconCol);
  inner.appendChild(textCol);
  el.appendChild(inner);

  function dismiss() {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), FADE_MS);
  }

  stack.appendChild(el);
  if (durationMs > 0) setTimeout(dismiss, durationMs);
  return { dismiss, el };
}
