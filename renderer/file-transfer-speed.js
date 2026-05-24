/** @type {readonly string[]} */
export const FILE_TRANSFER_SPEED_IDS = ['fast', 'normal', 'slow'];

export function normalizeFileTransferSpeed(value) {
  return FILE_TRANSFER_SPEED_IDS.includes(value) ? value : 'normal';
}

/**
 * Delay between TCP chunks (ms). Extra pacing while voice/group call is active.
 * @param {object} config
 * @param {boolean} [callActive]
 */
export function getChunkDelayMs(config, callActive = false) {
  if (callActive) return 12;
  const speed = normalizeFileTransferSpeed(config?.fileTransferSpeed);
  if (speed === 'fast') return 0;
  if (speed === 'slow') return 8;
  return 0;
}

/** @param {number} bytesPerSec */
export function formatTransferSpeed(bytesPerSec) {
  const bps = Number(bytesPerSec) || 0;
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
}
