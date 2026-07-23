import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true,
  breaks: true,
});

const PURIFY = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

export function releaseMarkdownToHtml(markdown) {
  const raw = typeof markdown === 'string' ? markdown : '';
  if (!raw.trim()) return '';
  const dirty = marked.parse(raw, { async: false });
  if (typeof window === 'undefined') {
    return String(dirty);
  }
  return DOMPurify.sanitize(String(dirty), PURIFY);
}

export function bindReleaseMarkdownLinks(root, openExternal) {
  if (!root || typeof openExternal !== 'function') return;
  root.querySelectorAll('a[href]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const href = a.getAttribute('href');
      if (href && /^https?:\/\//i.test(href)) openExternal(href);
    });
  });
  root.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (!/^https:\/\//i.test(src)) {
      img.remove();
      return;
    }
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
  });
}
