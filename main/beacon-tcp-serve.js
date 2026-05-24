import { readSeedChunksBatch } from './beacon-store.js';
import { sendOnSocketQueued } from './tcp-write-queue.js';
import { MAX_TCP_LINE_BYTES } from './tcp-framing.js';

/** 1 MiB raw chunks → ~2× base64 per TCP line (under 4 MiB cap). */
const CHUNKS_PER_LINE = 2;

/**
 * Read seed chunks from disk and send to peer in main (no renderer round-trip).
 * @param {import('net').Socket} socket
 * @param {number} fromBlipId
 * @param {{ to: number, seedId: string, chunkIndices: number[] }} opts
 */
export async function serveSeedChunksOnSocket(socket, fromBlipId, { to, seedId, chunkIndices }) {
  const indices = (chunkIndices || []).map(Number).filter(Number.isFinite);
  if (!seedId || !indices.length || !socket) return { ok: false, sent: 0 };

  const payloads = (await readSeedChunksBatch(seedId, indices)).filter((c) => c?.ok && c.data);
  let sent = 0;

  for (let i = 0; i < payloads.length; i += CHUNKS_PER_LINE) {
    const batch = payloads.slice(i, i + CHUNKS_PER_LINE);
    const packet =
      batch.length === 1
        ? {
            type: 'seed-chunk',
            from: fromBlipId,
            to,
            seedId,
            chunkIndex: batch[0].chunkIndex,
            data: batch[0].data,
          }
        : {
            type: 'seed-chunks-batch',
            from: fromBlipId,
            to,
            seedId,
            chunks: batch.map((c) => ({ chunkIndex: c.chunkIndex, data: c.data })),
          };
    const lineBytes = Buffer.byteLength(JSON.stringify(packet) + '\n', 'utf8');
    if (lineBytes > MAX_TCP_LINE_BYTES) {
      for (const one of batch) {
        await sendOnSocketQueued(socket, {
          type: 'seed-chunk',
          from: fromBlipId,
          to,
          seedId,
          chunkIndex: one.chunkIndex,
          data: one.data,
        });
        sent += 1;
      }
      continue;
    }
    await sendOnSocketQueued(socket, packet);
    sent += batch.length;
  }

  return { ok: true, sent };
}
