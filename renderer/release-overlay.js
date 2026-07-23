import { t, applyI18n } from './i18n.js';
import { releaseMarkdownToHtml, bindReleaseMarkdownLinks } from './release-markdown.js';

let activeBackdrop = null;

export function closeReleaseNotesOverlay() {
  if (!activeBackdrop) return;
  activeBackdrop.remove();
  activeBackdrop = null;
  document.removeEventListener('keydown', onEscape, true);
}

function onEscape(e) {
  if (e.key === 'Escape') closeReleaseNotesOverlay();
}

export function openReleaseNotesOverlay({ tag, name, body, url } = {}) {
  closeReleaseNotesOverlay();

  const backdrop = document.createElement('div');
  backdrop.className = 'release-notes-backdrop';
  backdrop.setAttribute('role', 'presentation');

  const sheet = document.createElement('div');
  sheet.className = 'release-notes-sheet glass';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', name || tag || t('settings.updates_release_notes'));

  const head = document.createElement('div');
  head.className = 'release-notes-sheet__head';

  const titles = document.createElement('div');
  titles.className = 'release-notes-sheet__titles';

  const tagEl = document.createElement('p');
  tagEl.className = 'release-notes-sheet__tag';
  tagEl.textContent = tag || '—';
  titles.appendChild(tagEl);

  if (name && name !== tag) {
    const nameEl = document.createElement('h2');
    nameEl.className = 'release-notes-sheet__name';
    nameEl.textContent = name;
    titles.appendChild(nameEl);
  }

  const actions = document.createElement('div');
  actions.className = 'release-notes-sheet__actions';

  if (url) {
    const gh = document.createElement('button');
    gh.type = 'button';
    gh.className = 'btn btn-lang';
    gh.dataset.i18n = 'settings.updates_open_release';
    gh.textContent = t('settings.updates_open_release');
    gh.addEventListener('click', () => window.blip.openExternal?.(url));
    actions.appendChild(gh);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn-lang release-notes-sheet__close';
  closeBtn.dataset.i18n = 'media.close';
  closeBtn.textContent = t('media.close');
  closeBtn.addEventListener('click', () => closeReleaseNotesOverlay());
  actions.appendChild(closeBtn);

  head.appendChild(titles);
  head.appendChild(actions);

  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'release-notes-sheet__body release-md';
  const html = releaseMarkdownToHtml(body || '');
  if (html) {
    bodyWrap.innerHTML = html;
    bindReleaseMarkdownLinks(bodyWrap, (href) => window.blip.openExternal?.(href));
  } else {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.dataset.i18n = 'settings.updates_release_empty';
    empty.textContent = t('settings.updates_release_empty');
    bodyWrap.appendChild(empty);
  }

  sheet.appendChild(head);
  sheet.appendChild(bodyWrap);
  backdrop.appendChild(sheet);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeReleaseNotesOverlay();
  });

  document.body.appendChild(backdrop);
  applyI18n(backdrop);
  activeBackdrop = backdrop;
  document.addEventListener('keydown', onEscape, true);
  closeBtn.focus();
}
