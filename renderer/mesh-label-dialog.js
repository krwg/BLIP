import { t } from './i18n.js';
import { getMeshLabel, setMeshLabel, clearMeshLabel } from './peer-labels.js';

export function openMeshLabelDialog(peerId, fallbackName = '') {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'blip-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'blip-modal glass';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const title = document.createElement('h3');
    title.className = 'blip-modal-title';
    title.textContent = t('peers.mesh_label');

    const hint = document.createElement('p');
    hint.className = 'hint blip-modal-hint';
    hint.textContent = t('peers.mesh_label_prompt').replace('{id}', String(peerId));

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input blip-modal-input';
    input.maxLength = 32;
    input.value = getMeshLabel(peerId) || '';
    input.placeholder = fallbackName || `BLIP-${peerId}`;

    const actions = document.createElement('div');
    actions.className = 'blip-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-lang';
    cancelBtn.textContent = t('dialog.cancel');

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-accent';
    saveBtn.textContent = t('dialog.save');

    let done = false;
    function finish(value) {
      if (done) return;
      done = true;
      backdrop.remove();
      resolve(value);
    }

    function save() {
      const raw = input.value.trim();
      if (!raw) {
        clearMeshLabel(peerId);
        finish('');
        return;
      }
      setMeshLabel(peerId, raw);
      finish(raw);
    }

    cancelBtn.addEventListener('click', () => finish(null));
    saveBtn.addEventListener('click', () => save());
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(null);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(null);
      }
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    modal.appendChild(title);
    modal.appendChild(hint);
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
