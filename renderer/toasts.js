/**
 * Bottom-right in-app toast stack (messages, updates, hints).
 */

const DEFAULT_MS = 9000;
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
 * @param {{
 *   title: string,
 *   body?: string,
 *   variant?: 'accent' | 'danger' | 'muted',
 *   durationMs?: number,
 *   actions?: Array<{ label: string, onClick: () => void, primary?: boolean }>,
 * }} opts
 */
export function showAppToast(opts) {
  const {
    title,
    body = '',
    variant = 'accent',
    durationMs = DEFAULT_MS,
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

  function dismiss() {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), FADE_MS);
  }

  stack.appendChild(el);

  if (durationMs > 0) {
    setTimeout(dismiss, durationMs);
  }

  return { dismiss, el };
}
