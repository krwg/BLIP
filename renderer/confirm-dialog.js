import { t } from './i18n.js';

/**
 * @param {{ title: string, body?: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean }} opts
 * @returns {Promise<boolean>}
 */
export function openConfirmDialog(opts) {
  const {
    title,
    body = '',
    confirmLabel = t('dialog.confirm'),
    cancelLabel = t('dialog.cancel'),
    danger = false,
  } = opts;

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'blip-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'blip-modal glass';
    modal.setAttribute('role', 'alertdialog');
    modal.setAttribute('aria-modal', 'true');

    const h = document.createElement('h3');
    h.className = 'blip-modal-title';
    h.textContent = title;

    const actions = document.createElement('div');
    actions.className = 'blip-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-lang';
    cancelBtn.textContent = cancelLabel;

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = danger ? 'btn btn-danger' : 'btn btn-accent';
    okBtn.textContent = confirmLabel;

    let done = false;
    function finish(ok) {
      if (done) return;
      done = true;
      backdrop.remove();
      resolve(ok);
    }

    cancelBtn.addEventListener('click', () => finish(false));
    okBtn.addEventListener('click', () => finish(true));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(false);
    });

    modal.appendChild(h);
    if (body) {
      const p = document.createElement('p');
      p.className = 'hint blip-modal-hint';
      p.textContent = body;
      modal.appendChild(p);
    }
    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    modal.appendChild(actions);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    okBtn.focus();
  });
}
