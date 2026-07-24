
import { t } from './i18n.js';
import { appendLinkifiedText } from './linkify.js';
import { chatMarkdownToHtml, bindMarkdownInteractions } from './release-markdown.js';
import { formatFileSize } from './file-transfer.js';
import { formatTransferSpeed } from './file-transfer-speed.js';
import { isImageAttachment, isVideoAttachment, isMediaPlaceholderText } from './chat-attachments.js';
import { appendYoutubeEmbed, findYoutubeInText, parseYoutubeUrl } from './link-embed.js';
import {
  openImageAttachment,
  openVideoAttachment,
  openYoutubeViewer,
} from './media-viewer.js';

function openExternalUrl(url) {
  if (window.blip?.openExternal) void window.blip.openExternal(url);
}

function looksLikeMarkdown(text) {
  const s = String(text || '');
  if (!s.trim()) return false;
  return /(^|\n)\s{0,3}(#{1,4}\s|[-*+]\s|\d+\.\s|>\s|```|~~~)|(\*\*|__|~~|`[^`]+`|\[[^\]]+\]\([^)]+\))/.test(
    s,
  );
}

function appendMarkdownOrPlain(parent, text) {
  const src = String(text || '');
  if (!src) return;
  if (!looksLikeMarkdown(src)) {
    appendLinkifiedText(parent, src, openExternalUrl);
    return;
  }
  const html = chatMarkdownToHtml(src);
  if (!html) {
    appendLinkifiedText(parent, src, openExternalUrl);
    return;
  }
  parent.classList.add('chat-md');
  parent.innerHTML = html;
  bindMarkdownInteractions(parent, { openExternal: openExternalUrl, allowImages: false });
}

function appendTextWithEmbeds(block, text) {
  const src = String(text || '').trim();
  if (!src) return;
  const yts = findYoutubeInText(src);
  if (!yts.length) {
    const span = document.createElement('span');
    span.className = 'chat-text';
    appendMarkdownOrPlain(span, src);
    block.appendChild(span);
    return;
  }

  let last = 0;
  for (const yt of yts) {
    if (yt.index > last) {
      const chunk = src.slice(last, yt.index).trim();
      if (chunk) {
        const span = document.createElement('span');
        span.className = 'chat-text';
        appendMarkdownOrPlain(span, chunk);
        block.appendChild(span);
      }
    }
    appendYoutubeEmbed(block, yt, {
      onPlay: () => openYoutubeViewer(yt.id),
    });
    last = yt.index + yt.raw.length;
  }
  if (last < src.length) {
    const tail = src.slice(last).trim();
    if (tail) {
      const span = document.createElement('span');
      span.className = 'chat-text';
      appendMarkdownOrPlain(span, tail);
      block.appendChild(span);
    }
  }
}

export function appendForwardBlock(block, forwardFrom) {
  if (!forwardFrom) return;
  const box = document.createElement('div');
  box.className = 'chat-forward';
  const label = document.createElement('span');
  label.className = 'chat-forward-label';
  label.dataset.i18n = 'chat.forwarded';
  label.textContent = t('chat.forwarded');
  const from = document.createElement('span');
  from.className = 'chat-forward-from';
  let who = forwardFrom.fromLabel || forwardFrom.sourceLabel || '';
  if (forwardFrom.sourceGroupName) {
    who = who ? `${forwardFrom.sourceGroupName} · ${who}` : forwardFrom.sourceGroupName;
  }
  from.textContent = who ? `${t('chat.forward_from')} ${who}` : t('chat.forward_from_unknown');
  const body = document.createElement('span');
  body.className = 'chat-forward-body';
  body.textContent = forwardFrom.preview || forwardFrom.text || '';
  box.appendChild(label);
  box.appendChild(from);
  box.appendChild(body);
  block.appendChild(box);
}

export function appendForwardSeedNotice(block, forwardFrom, opts = {}) {
  const seedId = forwardFrom?.seedId;
  if (!seedId) return;
  if (opts.isSeedAvailable?.(seedId)) return;
  const row = document.createElement('div');
  row.className = 'chat-forward-seed-unavail';
  const text = document.createElement('span');
  text.className = 'chat-forward-seed-text';
  text.dataset.i18n = 'chat.forward_seed_unavail';
  text.textContent = t('chat.forward_seed_unavail');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-lang chat-forward-seed-btn';
  btn.dataset.i18n = 'chat.forward_seed_request';
  btn.textContent = t('chat.forward_seed_request');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    opts.onRequestSeed?.(seedId);
  });
  row.appendChild(text);
  row.appendChild(btn);
  if (opts.onShareSeedLink) {
    const linkBtn = document.createElement('button');
    linkBtn.type = 'button';
    linkBtn.className = 'btn btn-accent chat-forward-seed-btn';
    linkBtn.dataset.i18n = 'chat.forward_seed_link';
    linkBtn.textContent = t('chat.forward_seed_link');
    linkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.onShareSeedLink(seedId, forwardFrom);
    });
    row.appendChild(linkBtn);
  }
  block.appendChild(row);
}

export function appendQuoteBlock(block, replyTo, onQuoteClick) {
  if (!replyTo?.id) return;
  const q = document.createElement('div');
  q.className = 'chat-quote';
  if (onQuoteClick) {
    q.classList.add('chat-quote--link');
    q.addEventListener('click', (e) => {
      e.stopPropagation();
      onQuoteClick(replyTo.id);
    });
  }
  const who = document.createElement('span');
  who.className = 'chat-quote-who';
  who.textContent = replyTo.fromLabel || `#${replyTo.from}` || '';
  const body = document.createElement('span');
  body.className = 'chat-quote-body';
  body.textContent = replyTo.preview || replyTo.text || '';
  q.appendChild(who);
  q.appendChild(body);
  block.appendChild(q);
}

function appendFileCard(block, attachment) {
  const card = document.createElement('div');
  card.className = 'chat-file-card';
  const label = document.createElement('span');
  label.className = 'chat-file-name';
  label.textContent = attachment.name || 'file';
  const meta = document.createElement('span');
  meta.className = 'chat-file-meta';
  const sizeStr = formatFileSize(attachment.size);
  const speedStr =
    attachment.speedBps && attachment.pending
      ? ` · ${formatTransferSpeed(attachment.speedBps)}`
      : '';
  meta.textContent = `${sizeStr}${speedStr}`;
  card.appendChild(label);
  card.appendChild(meta);
  if (attachment.dataUrl) {
    const dl = document.createElement('button');
    dl.type = 'button';
    dl.className = 'btn btn-lang chat-file-dl';
    dl.textContent = t('chat.file_download');
    dl.addEventListener('click', (e) => {
      e.stopPropagation();
      const a = document.createElement('a');
      a.href = attachment.dataUrl;
      a.download = attachment.name || 'download';
      a.click();
    });
    card.appendChild(dl);
  } else if (attachment.pending) {
    const pct = Math.min(100, Math.max(0, Number(attachment.progress) || 0));
    const prog = document.createElement('div');
    prog.className = 'chat-file-progress';
    const track = document.createElement('div');
    track.className = 'chat-file-progress-track';
    const fill = document.createElement('div');
    fill.className = 'chat-file-progress-fill';
    fill.style.width = `${pct}%`;
    track.appendChild(fill);
    prog.appendChild(track);
    const pendingLbl = document.createElement('span');
    pendingLbl.className = 'chat-file-pending';
    pendingLbl.textContent = t('chat.file_sending').replace('{pct}', String(pct));
    prog.appendChild(pendingLbl);
    card.appendChild(prog);
  } else if (attachment.cancelled) {
    const cancelledLbl = document.createElement('span');
    cancelledLbl.className = 'chat-file-pending';
    cancelledLbl.textContent = t('chat.file_cancelled');
    card.appendChild(cancelledLbl);
  }
  block.appendChild(card);
}

function appendImageBubble(block, attachment) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chat-media-bubble chat-media-bubble--image';
  const img = document.createElement('img');
  img.className = 'chat-media-thumb';
  img.src = attachment.dataUrl;
  img.alt = attachment.name || 'image';
  img.loading = 'lazy';
  btn.appendChild(img);
  if (attachment.name) {
    const cap = document.createElement('span');
    cap.className = 'chat-media-caption';
    cap.textContent = attachment.name;
    btn.appendChild(cap);
  }
  btn.addEventListener('click', () => openImageAttachment(attachment));
  block.appendChild(btn);
}

function appendVideoBubble(block, attachment) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chat-media-bubble chat-media-bubble--video';
  const vid = document.createElement('video');
  vid.className = 'chat-media-thumb';
  if (attachment.blob instanceof Blob) {
    vid.src = URL.createObjectURL(attachment.blob);
  } else if (attachment.dataUrl) {
    vid.src = attachment.dataUrl;
  }
  vid.muted = true;
  vid.playsInline = true;
  vid.preload = 'metadata';
  const play = document.createElement('span');
  play.className = 'chat-media-play';
  play.innerHTML = '<span class="pixel-glyph pixel-glyph--play"></span>';
  btn.appendChild(vid);
  btn.appendChild(play);
  if (attachment.name) {
    const cap = document.createElement('span');
    cap.className = 'chat-media-caption';
    cap.textContent = attachment.name;
    btn.appendChild(cap);
  }
  btn.addEventListener('click', () => openVideoAttachment(attachment));
  block.appendChild(btn);
}

export function appendChatMessageBody(block, m, opts = {}) {
  if (m.forwardFrom) appendForwardBlock(block, m.forwardFrom);
  if (m.forwardFrom) appendForwardSeedNotice(block, m.forwardFrom, opts);
  if (m.replyTo) appendQuoteBlock(block, m.replyTo, opts.onQuoteClick);

  const att = m.attachment;
  if (isImageAttachment(att)) {
    appendImageBubble(block, att);
  } else if (isVideoAttachment(att)) {
    appendVideoBubble(block, att);
  } else if (att?.kind === 'file') {
    appendFileCard(block, att);
  }

  const hideText = isMediaPlaceholderText(m.text, att);
  if (m.text && !(att?.pending && !m.text.trim()) && !hideText) {
    appendTextWithEmbeds(block, m.text);
  } else if (!att && m.text) {
    appendTextWithEmbeds(block, m.text);
  }
}

export function buildReplyPreview(m, fromId) {
  if (m.attachment?.kind === 'image') return t('chat.reply_preview_image');
  if (isVideoAttachment(m.attachment)) return t('chat.reply_preview_video');
  if (m.attachment?.kind === 'file') {
    return t('chat.reply_preview_file').replace('{name}', m.attachment.name || 'file');
  }
  const text = String(m.text || '').trim();
  const yt = parseYoutubeUrl(text);
  if (yt) return t('chat.reply_preview_youtube');
  return text.slice(0, 120) || '…';
}

export function formatReplyFromLabel(from, displayName) {
  return displayName || `BLIP-${from}`;
}

export function buildForwardSnapshot(sourcePeerId, m, fromLabel, opts = {}) {
  const snap = {
    sourcePeerId: Number(sourcePeerId),
    messageId: m.id || null,
    fromLabel: fromLabel || '',
    preview: buildReplyPreview(m, sourcePeerId),
    text: String(m.text || '').slice(0, 500),
  };
  if (opts.groupId) snap.sourceGroupId = String(opts.groupId);
  if (opts.groupName) snap.sourceGroupName = String(opts.groupName);
  if (m.attachment?.seedId) snap.seedId = String(m.attachment.seedId);
  if (m.attachment?.kind) snap.attachmentKind = m.attachment.kind;
  if (m.attachment?.name) snap.attachmentName = m.attachment.name;
  return snap;
}
