import { t } from './i18n.js';

export function openTextPromptDialog(opts) {
  const {
    title,
    body = '',
    placeholder = '',
    defaultValue = '',
    confirmLabel = t('dialog.confirm'),
  } = opts;

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'blip-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'blip-modal glass';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const h = document.createElement('h3');
    h.className = 'blip-modal-title';
    h.textContent = title;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input blip-modal-input';
    input.maxLength = 200;
    input.value = defaultValue;
    input.placeholder = placeholder;

    const actions = document.createElement('div');
    actions.className = 'blip-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-lang';
    cancelBtn.textContent = t('dialog.cancel');

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'btn btn-accent';
    okBtn.textContent = confirmLabel;

    let done = false;
    function finish(value) {
      if (done) return;
      done = true;
      backdrop.remove();
      resolve(value);
    }

    cancelBtn.addEventListener('click', () => finish(null));
    okBtn.addEventListener('click', () => finish(input.value.trim() || null));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(null);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(input.value.trim() || null);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(null);
      }
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    modal.appendChild(h);
    if (body) {
      const p = document.createElement('p');
      p.className = 'hint blip-modal-hint';
      p.textContent = body;
      modal.appendChild(p);
    }
    modal.appendChild(input);
    modal.appendChild(actions);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  });
}
