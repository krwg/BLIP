/**
 * Bottom-right in-app toast stack (messages, updates, hints).
 */

export const DEFAULT_TOAST_MS = 9000;
const FADE_MS = 300;
const SWIPE_DISMISS_PX = 72;

let stackEl = null;

function ensureStack() {
  if (stackEl?.isConnected) return stackEl;
  stackEl = document.createElement('div');
  stackEl.className = 'toast-stack';
  document.body.appendChild(stackEl);
  return stackEl;
}

function bindSwipeDismiss(el, dismiss) {
  let startX = 0;
  let dragging = false;

  const resetTransform = () => {
    el.style.transition = '';
    el.style.transform = '';
    el.style.opacity = '';
  };

  el.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button')) return;
      dragging = true;
      startX = e.clientX;
      el.setPointerCapture(e.pointerId);
      el.style.transition = 'none';
    },
    { passive: true }
  );

  el.addEventListener(
    'pointermove',
    (e) => {
      if (!dragging) return;
      const dx = Math.max(0, e.clientX - startX);
      el.style.transform = `translateX(${dx}px)`;
      el.style.opacity = String(Math.max(0.35, 1 - dx / 160));
    },
    { passive: true }
  );

  const endSwipe = (e) => {
    if (!dragging) return;
    dragging = false;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const dx = e.clientX - startX;
    if (dx >= SWIPE_DISMISS_PX) {
      dismiss();
      return;
    }
    resetTransform();
  };

  el.addEventListener('pointerup', endSwipe);
  el.addEventListener('pointercancel', endSwipe);
}

/**
 * @param {{
 *   title: string,
 *   body?: string,
 *   variant?: 'accent' | 'danger' | 'muted',
 *   durationMs?: number,
 *   dismissible?: boolean,
 *   actions?: Array<{ label: string, onClick: () => void, primary?: boolean }>,
 * }} opts
 */
export function showAppToast(opts) {
  const {
    title,
    body = '',
    variant = 'accent',
    durationMs = DEFAULT_TOAST_MS,
    dismissible = true,
    actions = [],
  } = opts;
  if (!title) return null;

  const stack = ensureStack();
  const el = document.createElement('div');
  el.className = `app-toast glass app-toast--${variant}`;

  const strong = document.createElement('strong');
  strong.textContent = title;
  el.appendChild(strong);

  if (body) {
    const p = document.createElement('p');
    p.className = 'toast-preview';
    p.textContent = body;
    el.appendChild(p);
  }

  if (actions.length) {
    const row = document.createElement('div');
    row.className = 'toast-actions';
    for (const act of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = act.primary ? 'btn btn-accent' : 'btn btn-lang';
      btn.textContent = act.label;
      btn.addEventListener('click', () => {
        act.onClick?.();
        dismiss();
      });
      row.appendChild(btn);
    }
    el.appendChild(row);
  }

  let hideTimer = null;

  function dismiss() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), FADE_MS);
  }

  if (dismissible) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast-close btn';
    closeBtn.setAttribute('aria-label', 'Dismiss');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss();
    });
    el.appendChild(closeBtn);
    bindSwipeDismiss(el, dismiss);
  }

  stack.appendChild(el);

  if (durationMs > 0) {
    hideTimer = setTimeout(dismiss, durationMs);
  }

  return { dismiss, el };
}
