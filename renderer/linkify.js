const URL_RE =
  /(?:https?:\/\/|www\.)[\w\-._~:/?#[\]@!$&'()*+,;=%]+/gi;

function normalizeHref(raw) {
  const trimmed = raw.replace(/[.,;:!?)]+$/, '');
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return { href, label: trimmed };
}

/**
 * Append text nodes and external links into `parent`.
 * @param {HTMLElement} parent
 * @param {string} text
 * @param {(url: string) => void} onOpen
 */
export function appendLinkifiedText(parent, text, onOpen) {
  const src = String(text || '');
  if (!src) return;

  let last = 0;
  URL_RE.lastIndex = 0;
  let match;
  while ((match = URL_RE.exec(src)) !== null) {
    const start = match.index;
    if (start > last) {
      parent.appendChild(document.createTextNode(src.slice(last, start)));
    }
    const { href, label } = normalizeHref(match[0]);
    const a = document.createElement('a');
    a.className = 'chat-link';
    a.href = href;
    a.textContent = label;
    a.rel = 'noopener noreferrer';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      onOpen?.(href);
    });
    parent.appendChild(a);
    last = start + match[0].length;
  }
  if (last < src.length) {
    parent.appendChild(document.createTextNode(src.slice(last)));
  }
}
