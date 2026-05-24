/** Per-socket serialized writes so parallel IPC handlers cannot interleave JSON lines. */

/** @type {WeakMap<import('net').Socket, { tail: Promise<void> }>} */
const queues = new WeakMap();

/**
 * @param {import('net').Socket} socket
 * @param {object} payload
 */
export function sendOnSocketQueued(socket, payload) {
  if (!socket || socket.destroyed) {
    return Promise.reject(new Error('Socket not available'));
  }
  let q = queues.get(socket);
  if (!q) {
    q = { tail: Promise.resolve() };
    queues.set(socket, q);
  }
  const line = JSON.stringify(payload) + '\n';
  const job = q.tail.then(
    () =>
      new Promise((resolve, reject) => {
        socket.write(line, (err) => {
          if (err) reject(err);
          else resolve();
        });
      })
  );
  q.tail = job.catch(() => {});
  return job;
}
