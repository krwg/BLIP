import { t } from './i18n.js';
import { generateGroupId } from './groups.js';
import { openAlertDialog } from './confirm-dialog.js';

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

    const nameField = document.createElement('div');
    nameField.className = 'group-create-field';
    const nameLabel = document.createElement('label');
    nameLabel.className = 'group-create-label';
    nameLabel.dataset.i18n = 'group.name_placeholder';
    nameLabel.textContent = t('group.name_placeholder');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'input blip-modal-input';
    nameInput.maxLength = 48;
    nameInput.placeholder = t('group.name_placeholder');
    nameInput.value = t('group.name_default').replace('{id}', generateGroupId().slice(0, 4));
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);

    const hint = document.createElement('p');
    hint.className = 'hint group-create-hint';
    hint.dataset.i18n = 'group.create_hint';
    hint.textContent = t('group.create_hint');

    const membersLabel = document.createElement('div');
    membersLabel.className = 'group-create-members-label';
    membersLabel.dataset.i18n = 'group.create_hint';
    membersLabel.textContent = t('group.members');

    const list = document.createElement('div');
    list.className = 'group-create-list glass';

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
    okBtn.addEventListener('click', async () => {
      const memberIds = [...selected];
      if (memberIds.length === 0) {
        await openAlertDialog({ title: t('group.pick_one') });
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
    modal.appendChild(nameField);
    modal.appendChild(hint);
    modal.appendChild(membersLabel);
    modal.appendChild(list);
    modal.appendChild(actions);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    nameInput.focus();
  });
}
