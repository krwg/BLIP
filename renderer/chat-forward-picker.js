import { t } from './i18n.js';

export function openForwardPeerPicker(targets) {
  return new Promise((resolve) => {
    if (!targets?.length) {
      resolve(null);
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'blip-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'blip-modal glass chat-forward-modal';

    const title = document.createElement('h3');
    title.className = 'blip-modal-title';
    title.dataset.i18n = 'chat.forward_title';
    title.textContent = t('chat.forward_title');

    const list = document.createElement('div');
    list.className = 'chat-forward-list';

    let done = false;
    const finish = (id) => {
      if (done) return;
      done = true;
      backdrop.remove();
      resolve(id ?? null);
    };

    for (const peer of targets) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-lang chat-forward-peer-btn';
      btn.textContent = peer.label || `BLIP-${peer.id}`;
      btn.addEventListener('click', () => finish(peer.id));
      list.appendChild(btn);
    }

    const actions = document.createElement('div');
    actions.className = 'blip-modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-lang';
    cancelBtn.textContent = t('dialog.cancel');
    cancelBtn.addEventListener('click', () => finish(null));
    actions.appendChild(cancelBtn);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(null);
    });

    modal.appendChild(title);
    modal.appendChild(list);
    modal.appendChild(actions);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  });
}
