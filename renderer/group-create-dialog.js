import { t } from './i18n.js';
import { generateGroupId } from './groups.js';

/**
 * @param {{ selfId: number, peers: Array<{ blipId: number, displayName?: string, online?: boolean }>, seedPeerId?: number }} opts
 * @returns {Promise<{ name: string, memberIds: number[] } | null>}
 */
export function openGroupCreateDialog(opts) {
  const { selfId, peers, seedPeerId } = opts;
  const online = peers.filter((p) => p.online && p.blipId !== selfId);

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'blip-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'blip-modal glass group-create-modal';

    const title = document.createElement('h3');
    title.className = 'blip-modal-title';
    title.dataset.i18n = 'group.create_title';
    title.textContent = t('group.create_title');

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'input blip-modal-input';
    nameInput.maxLength = 48;
    nameInput.placeholder = t('group.name_placeholder');
    nameInput.value = t('group.name_default').replace('{id}', generateGroupId().slice(0, 4));

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.dataset.i18n = 'group.create_hint';
    hint.textContent = t('group.create_hint');

    const list = document.createElement('div');
    list.className = 'group-create-list';

    const selected = new Set();
    if (seedPeerId != null) selected.add(Number(seedPeerId));

    if (online.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = t('group.no_online');
      list.appendChild(empty);
    } else {
      online.forEach((p) => {
        const row = document.createElement('label');
        row.className = 'group-create-row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selected.has(p.blipId);
        cb.addEventListener('change', () => {
          if (cb.checked) selected.add(p.blipId);
          else selected.delete(p.blipId);
        });
        const label = document.createElement('span');
        label.textContent = `${p.displayName || `BLIP-${p.blipId}`} · #${p.blipId}`;
        row.appendChild(cb);
        row.appendChild(label);
        list.appendChild(row);
      });
    }

    const actions = document.createElement('div');
    actions.className = 'blip-modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-lang';
    cancelBtn.textContent = t('dialog.cancel');
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'btn btn-accent';
    okBtn.textContent = t('group.create_confirm');

    let done = false;
    function finish(v) {
      if (done) return;
      done = true;
      backdrop.remove();
      resolve(v);
    }

    cancelBtn.addEventListener('click', () => finish(null));
    okBtn.addEventListener('click', () => {
      const memberIds = [...selected];
      if (memberIds.length === 0) {
        alert(t('group.pick_one'));
        return;
      }
      finish({ name: nameInput.value.trim() || t('group.unnamed'), memberIds });
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(null);
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    modal.appendChild(title);
    modal.appendChild(nameInput);
    modal.appendChild(hint);
    modal.appendChild(list);
    modal.appendChild(actions);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    nameInput.focus();
  });
}
