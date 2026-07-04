
const URL_RE =
  /(?:https?:\/\/|www\.)[\w\-._~:/?#[\]@!$&'()*+,;=%]+/gi;

const YT_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/i;

export function parseYoutubeUrl(url) {
  if (!url) return null;
  const m = String(url).match(YT_RE);
  return m?.[1] ? { id: m[1], url: normalizeYoutubeWatch(m[1]) } : null;
}

function normalizeYoutubeWatch(id) {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function findYoutubeInText(text) {
  const src = String(text || '');
  URL_RE.lastIndex = 0;
  const hits = [];
  let match;
  while ((match = URL_RE.exec(src)) !== null) {
    const yt = parseYoutubeUrl(match[0]);
    if (yt) hits.push({ ...yt, index: match.index, raw: match[0] });
  }
  return hits;
}

export function youtubeThumb(id) {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

export function appendYoutubeEmbed(parent, yt, { onPlay }) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'chat-yt-embed';
  const thumb = document.createElement('img');
  thumb.className = 'chat-yt-thumb';
  thumb.src = youtubeThumb(yt.id);
  thumb.alt = 'YouTube';
  thumb.loading = 'lazy';
  const play = document.createElement('span');
  play.className = 'chat-yt-play';
  play.textContent = '▶';
  const label = document.createElement('span');
  label.className = 'chat-yt-label';
  label.textContent = 'YouTube';
  card.appendChild(thumb);
  card.appendChild(play);
  card.appendChild(label);
  card.addEventListener('click', () => {
    onPlay?.({ type: 'youtube', id: yt.id, url: yt.url });
  });
  parent.appendChild(card);
}
