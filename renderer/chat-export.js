import { getMessages } from './chat.js';
import { normalizeCustomAccentHex } from './appearance.js';
import { uiShowsPremiumTier } from '../shared/mesh-plus-gates.js';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeMessageForExport(m) {
  const row = {
    id: m.id || null,
    timestamp: m.timestamp || null,
    outgoing: !!m.outgoing,
    text: m.text || '',
  };
  if (m.editedAt) row.editedAt = m.editedAt;
  if (m.replyTo) {
    row.replyTo = {
      id: m.replyTo.id || null,
      from: m.replyTo.from ?? null,
      text: m.replyTo.text || '',
      preview: m.replyTo.preview || '',
    };
  }
  if (m.attachment) {
    row.attachment = {
      kind: m.attachment.kind || 'file',
      name: m.attachment.name || null,
      size: m.attachment.size ?? null,
    };
  }
  if (m.reactions && Object.keys(m.reactions).length) {
    row.reactions = m.reactions;
  }
  return row;
}

function resolveThemedAccent(config) {
  const custom = normalizeCustomAccentHex(config?.accentCustomHex);
  if (uiShowsPremiumTier(config) && custom) return custom;
  return '#00ffc8';
}

export function buildChatExportPayload(peerId, displayName) {
  const msgs = getMessages(peerId);
  return {
    schema: 'blip_chat_export_v1',
    exportedAt: new Date().toISOString(),
    peerId,
    displayName: displayName || `BLIP-${peerId}`,
    messageCount: msgs.length,
    messages: msgs.map(sanitizeMessageForExport),
  };
}

export function exportPeerChatJson(peerId, displayName) {
  const json = `${JSON.stringify(buildChatExportPayload(peerId, displayName), null, 2)}\n`;
  downloadBlob(new Blob([json], { type: 'application/json;charset=utf-8' }), `blip-${peerId}-chat.json`);
}

function formatLineForExport(m, label) {
  const who = m.outgoing ? 'You' : label;
  const time = new Date(m.timestamp || Date.now()).toLocaleString();
  let body = m.text || '';
  if (m.attachment?.kind === 'image') body = `[IMG] ${body}`.trim();
  else if (m.attachment?.kind === 'file') body = `[FILE] ${m.attachment.name || ''} ${body}`.trim();
  if (m.editedAt) body += ' (edited)';
  return `[${time}] ${who}: ${body}`;
}

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return { r: 0, g: 255, b: 200 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * @param {number} peerId
 * @param {string} displayName
 * @param {{ themed?: boolean, config?: object }} [opts]
 */
export async function exportPeerChatPdf(peerId, displayName, opts = {}) {
  const { jsPDF } = await import('jspdf');
  const msgs = getMessages(peerId);
  const label = displayName || `BLIP-${peerId}`;
  const themed = !!opts.themed;
  const accent = themed ? resolveThemedAccent(opts.config) : null;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = margin;
  const lineH = 14;

  if (themed && accent) {
    const { r, g, b } = hexToRgb(accent);
    doc.setFillColor(12, 14, 18);
    doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), 'F');
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, pageW, 56, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('courier', 'bold');
    doc.setFontSize(14);
    doc.text('BLIP', margin, 34);
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    doc.text(`SIGNAL LOG · #${peerId}`, margin + 52, 34);
    y = 72;
    doc.setTextColor(200, 220, 210);
  } else {
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`BLIP chat export — ${label} (#${peerId})`, margin, y);
    y += lineH * 2;
    doc.setFontSize(9);
    doc.text(`Exported: ${new Date().toLocaleString()}`, margin, y);
    y += lineH * 2;
  }

  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  if (themed) {
    doc.text(`Peer: ${label} · Exported: ${new Date().toLocaleString()}`, margin, y);
    y += lineH * 2;
    if (accent) {
      const { r, g, b } = hexToRgb(accent);
      doc.setTextColor(r, g, b);
    }
  }

  const lines = msgs.length ? msgs.map((m) => formatLineForExport(m, label)) : ['(no messages)'];

  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, maxW);
    for (const wl of wrapped) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        if (themed) {
          doc.setFillColor(12, 14, 18);
          doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), 'F');
          doc.setTextColor(200, 220, 210);
        }
        y = margin;
      }
      doc.text(wl, margin, y);
      y += lineH;
    }
  }

  const suffix = themed ? '-themed' : '';
  doc.save(`blip-${peerId}-chat${suffix}.pdf`);
}

/**
 * @param {number} peerId
 * @param {string} displayName
 * @param {{ config?: object }} [opts]
 */
export function exportPeerChatHtml(peerId, displayName, opts = {}) {
  const payload = buildChatExportPayload(peerId, displayName);
  const accent = resolveThemedAccent(opts.config);
  const label = displayName || `BLIP-${peerId}`;
  const rows = payload.messages
    .map((m) => {
      const who = m.outgoing ? 'You' : label;
      const time = new Date(m.timestamp || Date.now()).toLocaleString();
      let body = m.text || '';
      if (m.attachment?.kind === 'image') body = `[IMG] ${body}`;
      else if (m.attachment?.kind === 'file') body = `[FILE] ${m.attachment.name || ''} ${body}`;
      const esc = (s) =>
        String(s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      return `<div class="msg"><span class="meta">${esc(time)} · ${esc(who)}</span><p>${esc(body)}</p></div>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>BLIP #${peerId} — ${label}</title>
<style>
  :root { --accent: ${accent}; --bg: #0c0e12; --text: #d8e8e0; }
  body { font-family: "Courier New", monospace; background: var(--bg); color: var(--text); margin: 0; padding: 0; }
  header { background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 40%, #0c0e12)); padding: 20px 28px; }
  header h1 { margin: 0; font-size: 18px; letter-spacing: 0.2em; }
  header p { margin: 6px 0 0; font-size: 12px; opacity: 0.9; }
  main { padding: 24px 28px 48px; max-width: 720px; }
  .msg { border-left: 3px solid color-mix(in srgb, var(--accent) 55%, transparent); padding: 8px 12px; margin-bottom: 12px; }
  .meta { font-size: 11px; color: var(--accent); display: block; margin-bottom: 4px; }
  p { margin: 0; font-size: 13px; line-height: 1.45; white-space: pre-wrap; }
</style>
</head>
<body>
<header><h1>BLIP</h1><p>Signal log · #${peerId} · ${label}</p></header>
<main>${rows || '<p>(no messages)</p>'}</main>
</body>
</html>`;
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `blip-${peerId}-chat-themed.html`);
}
