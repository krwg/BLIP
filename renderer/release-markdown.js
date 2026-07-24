import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true,
  breaks: true,
});

const RELEASE_PURIFY = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target', 'rel', 'loading', 'decoding', 'referrerpolicy'],
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

const CHAT_PURIFY = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'del',
    's',
    'code',
    'pre',
    'ul',
    'ol',
    'li',
    'blockquote',
    'a',
    'hr',
    'h1',
    'h2',
    'h3',
    'h4',
  ],
  ALLOWED_ATTR: ['href', 'title', 'rel', 'target'],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|blip):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ['img', 'style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
};

function sanitize(dirty, profile) {
  const cfg = profile === 'chat' ? CHAT_PURIFY : RELEASE_PURIFY;
  if (typeof window === 'undefined') return String(dirty);
  return DOMPurify.sanitize(String(dirty), cfg);
}

export function markdownToSafeHtml(markdown, profile = 'release') {
  const raw = typeof markdown === 'string' ? markdown : '';
  if (!raw.trim()) return '';
  const dirty = marked.parse(raw, { async: false });
  return sanitize(dirty, profile);
}

export function releaseMarkdownToHtml(markdown) {
  return markdownToSafeHtml(markdown, 'release');
}

export function chatMarkdownToHtml(markdown) {
  return markdownToSafeHtml(markdown, 'chat');
}

function isSafeHttpUrl(href) {
  return typeof href === 'string' && /^https?:\/\//i.test(href);
}

function isBlipSeedUrl(href) {
  return typeof href === 'string' && /^blip:\/\/seed\//i.test(href);
}

export function bindMarkdownInteractions(root, opts = {}) {
  const openExternal = opts.openExternal;
  const allowImages = opts.allowImages !== false;
  if (!root) return;

  root.querySelectorAll('a[href]').forEach((a) => {
    a.rel = 'noopener noreferrer';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const href = a.getAttribute('href') || '';
      if (isBlipSeedUrl(href)) {
        const seedId = href.replace(/^blip:\/\/seed\//i, '').slice(0, 64);
        window.dispatchEvent(
          new CustomEvent('blip-open-beacon-seed', { detail: { seedId } }),
        );
        return;
      }
      if (isSafeHttpUrl(href) && typeof openExternal === 'function') openExternal(href);
    });
  });

  if (!allowImages) {
    root.querySelectorAll('img').forEach((img) => img.remove());
    return;
  }

  root.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (!/^https:\/\//i.test(src)) {
      img.remove();
      return;
    }
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.removeAttribute('width');
    img.removeAttribute('height');
    img.classList.add('release-md__img');
    img.addEventListener('error', () => {
      const ph = document.createElement('span');
      ph.className = 'release-md__img-error hint';
      ph.textContent = src;
      img.replaceWith(ph);
    });
    img.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof openExternal === 'function') openExternal(src);
    });
  });

  root.querySelectorAll('table').forEach((table) => {
    if (table.parentElement?.classList?.contains('release-md__table-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'release-md__table-wrap';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  });
}

export function bindReleaseMarkdownLinks(root, openExternal) {
  bindMarkdownInteractions(root, { openExternal, allowImages: true });
}
