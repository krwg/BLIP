const URL_RE =
  /(?:https?:\/\/|www\.)[\w\-._~:/?#[\]@!$&'()*+,;=%]+|blip:\/\/seed\/[a-f0-9]{8,64}/gi;

function normalizeHref(raw) {
  const trimmed = raw.replace(/[.,;:!?)]+$/, '');
  if (/^blip:\/\/seed\//i.test(trimmed)) {
    return { href: trimmed, label: trimmed, blipSeed: trimmed.replace(/^blip:\/\/seed\//i, '').slice(0, 64) };
  }
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return { href, label: trimmed, blipSeed: null };
}

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
    const { href, label, blipSeed } = normalizeHref(match[0]);
    const a = document.createElement('a');
    a.className = 'chat-link';
    a.href = href;
    a.textContent = label;
    a.rel = 'noopener noreferrer';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (blipSeed) {
        window.dispatchEvent(
          new CustomEvent('blip-open-beacon-seed', { detail: { seedId: blipSeed } })
        );
        return;
      }
      onOpen?.(href);
    });
    parent.appendChild(a);
    last = start + match[0].length;
  }
  if (last < src.length) {
    parent.appendChild(document.createTextNode(src.slice(last)));
  }
}
