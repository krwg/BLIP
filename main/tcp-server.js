import net from 'net';
import { DEFAULT_TCP_PORT } from './ports.js';

const connections = new Map();

export function createTcpServer(handlers, tcpPort = DEFAULT_TCP_PORT) {
  const server = net.createServer((socket) => {
    let buffer = '';
    const remoteIp = socket.remoteAddress?.replace('::ffff:', '') || '';

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          handlers.onMessage(msg, socket, remoteIp);
        } catch {
          /* ignore malformed */
        }
      }
    });

    socket.on('close', () => {
      for (const [key, s] of connections) {
        if (s === socket) connections.delete(key);
      }
    });

    socket.on('error', () => socket.destroy());
  });

  const api = {
    server,
    registerConnection(blipId, socket) {
      connections.set(blipId, socket);
    },
    getConnection(blipId) {
      return connections.get(blipId);
    },
    sendTo(blipId, payload) {
      const socket = connections.get(blipId);
      if (socket && !socket.destroyed) {
        socket.write(JSON.stringify(payload) + '\n');
        return true;
      }
      return false;
    },
    broadcast(payload, excludeId) {
      for (const [id, socket] of connections) {
        if (id !== excludeId && !socket.destroyed) {
          socket.write(JSON.stringify(payload) + '\n');
        }
      }
    },
    close() {
      for (const socket of connections.values()) {
        if (!socket.destroyed) socket.destroy();
      }
      connections.clear();
      return new Promise((resolve) => {
        server.close(() => resolve());
      });
    },
  };

  return new Promise((resolve, reject) => {
    const onEarlyError = (err) => {
      server.off('error', onEarlyError);
      reject(err);
    };
    server.once('error', onEarlyError);
    server.listen(tcpPort, '0.0.0.0', () => {
      server.off('error', onEarlyError);
      server.on('error', (err) => console.error('[TCP server]', err.message));
      console.log(`[TCP] listening on ${tcpPort}`);
      resolve(api);
    });
  });
}
