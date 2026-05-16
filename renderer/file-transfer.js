import { createMessageId } from './message-id.js';
import {
  encodeInlineFileAttachment,
  INLINE_FILE_BYTES,
  MAX_CHAT_FILE_BYTES,
  validateChatFile,
} from './chat-attachments.js';

const CHUNK_RAW_BYTES = 48 * 1024;

/** @type {Map<string, { meta: object, chunks: string[], received: number, peerId: number }>} */
const incoming = new Map();

function transferKey(peerId, transferId) {
  return `${peerId}:${transferId}`;
}

function readFileSliceAsBase64(file, start, end) {
  return new Promise((resolve, reject) => {
    const slice = file.slice(start, end);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('read'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(slice);
  });
}

function base64ToBlob(base64, mime) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}

function assembleIncoming(entry) {
  const joined = entry.chunks.join('');
  const blob = base64ToBlob(joined, entry.meta.mime);
  const dataUrl = `data:${entry.meta.mime || 'application/octet-stream'};base64,${joined}`;
  return {
    kind: 'file',
    name: entry.meta.name,
    mime: entry.meta.mime,
    size: entry.meta.size,
    dataUrl,
    blob,
  };
}

/**
 * Send a file to a peer (inline message or chunked TCP).
 * @returns {{ attachment, messageText } | { chunked: true, transferId }}
 */
export async function sendChatFile(api, config, peerId, file, onProgress) {
  validateChatFile(file);

  if (file.size <= INLINE_FILE_BYTES) {
    const attachment = await encodeInlineFileAttachment(file);
    return { inline: true, attachment };
  }

  const transferId = createMessageId();
  const chunkCount = Math.ceil(file.size / CHUNK_RAW_BYTES);

  await api.sendTcpMessage({
    type: 'file-offer',
    to: peerId,
    from: config.blipId,
    transferId,
    name: file.name || 'file',
    mime: file.type || 'application/octet-stream',
    size: file.size,
    chunkCount,
  });

  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_RAW_BYTES;
    const end = Math.min(file.size, start + CHUNK_RAW_BYTES);
    const data = await readFileSliceAsBase64(file, start, end);
    await api.sendTcpMessage({
      type: 'file-chunk',
      to: peerId,
      from: config.blipId,
      transferId,
      index: i,
      data,
    });
    onProgress?.(Math.round(((i + 1) / chunkCount) * 100));
  }

  await api.sendTcpMessage({
    type: 'file-done',
    to: peerId,
    from: config.blipId,
    transferId,
  });

  return {
    chunked: true,
    transferId,
    attachment: {
      kind: 'file',
      name: file.name || 'file',
      mime: file.type || 'application/octet-stream',
      size: file.size,
      transferId,
    },
  };
}

/** Build a local data URL for UI after send/receive. */
export async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

export function handleFileTransferTcp(msg, { config, onComplete, onProgress }) {
  const type = msg.type;
  const peerId = Number(msg.from === config.blipId ? msg.to : msg.from);
  if (!Number.isFinite(peerId)) return false;

  if (type === 'file-offer') {
    const key = transferKey(peerId, msg.transferId);
    incoming.set(key, {
      meta: {
        transferId: msg.transferId,
        name: String(msg.name || 'file').slice(0, 200),
        mime: String(msg.mime || 'application/octet-stream').slice(0, 120),
        size: Number(msg.size) || 0,
        chunkCount: Number(msg.chunkCount) || 0,
      },
      chunks: [],
      received: 0,
      peerId,
    });
    onProgress?.(peerId, msg.transferId, 0);
    return true;
  }

  if (type === 'file-chunk') {
    const key = transferKey(peerId, msg.transferId);
    const entry = incoming.get(key);
    if (!entry) return true;
    const idx = Number(msg.index);
    if (!Number.isFinite(idx) || idx < 0) return true;
    entry.chunks[idx] = String(msg.data || '');
    entry.received += 1;
    const pct = entry.meta.chunkCount
      ? Math.round((entry.received / entry.meta.chunkCount) * 100)
      : 0;
    onProgress?.(peerId, msg.transferId, pct);
    return true;
  }

  if (type === 'file-abort') {
    incoming.delete(transferKey(peerId, msg.transferId));
    return true;
  }

  if (type === 'file-done') {
    const key = transferKey(peerId, msg.transferId);
    const entry = incoming.get(key);
    if (!entry) return true;
    incoming.delete(key);
    const attachment = assembleIncoming(entry);
    onComplete?.(peerId, {
      transferId: msg.transferId,
      attachment,
      name: attachment.name,
    });
    onProgress?.(peerId, msg.transferId, 100);
    return true;
  }

  return false;
}

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
