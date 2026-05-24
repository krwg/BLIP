import { open, stat } from 'fs/promises';
import { sendOnSocketQueued } from './tcp-write-queue.js';
import { MAX_TCP_LINE_BYTES } from './tcp-framing.js';

const CHUNK_RAW_BYTES = 1024 * 1024;
const CHUNKS_PER_BATCH = 2;

/**
 * Stream a file from disk to a peer over TCP (main process — no renderer FileReader).
 * @param {import('net').Socket} socket
 * @param {number} fromBlipId
 * @param {object} opts
 */
export async function sendFileFromPathOnSocket(socket, fromBlipId, opts) {
  const {
    filePath,
    to,
    transferId,
    name,
    mime,
    size: sizeHint,
    groupId,
    msgId,
    onProgress,
    isCancelled,
  } = opts;

  if (!filePath || !socket || !transferId) throw new Error('invalid_args');

  const st = await stat(filePath);
  if (!st.isFile() || st.size <= 0) throw new Error('not_file');

  const size = Number(sizeHint) > 0 ? Number(sizeHint) : st.size;
  const chunkCount = Math.ceil(size / CHUNK_RAW_BYTES);
  const base = { from: fromBlipId, to, transferId };
  if (groupId) base.groupId = groupId;
  if (msgId) base.msgId = msgId;

  await sendOnSocketQueued(socket, {
    type: 'file-offer',
    ...base,
    name: name || 'file',
    mime: mime || 'application/octet-stream',
    size,
    chunkCount,
  });

  const fh = await open(filePath, 'r');
  let bytesSent = 0;
  const startedAt = Date.now();

  try {
    for (let i = 0; i < chunkCount; ) {
      if (isCancelled?.()) throw new Error('cancelled');

      const batch = [];
      for (let b = 0; b < CHUNKS_PER_BATCH && i < chunkCount; b++, i++) {
        const start = i * CHUNK_RAW_BYTES;
        const len = Math.min(CHUNK_RAW_BYTES, size - start);
        const buf = Buffer.allocUnsafe(len);
        const { bytesRead } = await fh.read(buf, 0, len, start);
        if (bytesRead <= 0) throw new Error('read');
        batch.push({ index: i, data: buf.subarray(0, bytesRead).toString('base64') });
        bytesSent = start + bytesRead;
      }

      const packet = { type: 'file-chunks-batch', ...base, chunks: batch };
      let lineBytes = Buffer.byteLength(JSON.stringify(packet) + '\n', 'utf8');
      if (lineBytes > MAX_TCP_LINE_BYTES && batch.length > 1) {
        for (const one of batch) {
          await sendOnSocketQueued(socket, {
            type: 'file-chunks-batch',
            ...base,
            chunks: [one],
          });
        }
      } else {
        await sendOnSocketQueued(socket, packet);
      }

      const elapsed = Math.max(0.001, (Date.now() - startedAt) / 1000);
      onProgress?.({
        percent: Math.min(100, Math.round((bytesSent / size) * 100)),
        bytesSent,
        speedBps: bytesSent / elapsed,
      });
    }
  } finally {
    await fh.close();
  }

  if (isCancelled?.()) throw new Error('cancelled');

  await sendOnSocketQueued(socket, { type: 'file-done', ...base });
  return { ok: true, bytesSent: size };
}
