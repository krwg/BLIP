import net from 'net';
import { DEFAULT_TCP_PORT } from './ports.js';

const pendingConnections = new Map();

export function connectToPeer(ip, blipId, tcpPort = DEFAULT_TCP_PORT) {
  return new Promise((resolve, reject) => {
    const key = `${ip}:${blipId}:${tcpPort}`;
    if (pendingConnections.has(key)) {
      resolve(pendingConnections.get(key));
      return;
    }

    const socket = net.createConnection({ host: ip, port: tcpPort }, () => {
      pendingConnections.set(key, socket);
      resolve(socket);
    });

    socket.setTimeout(5000);
    socket.on('timeout', () => {
      socket.destroy();
      pendingConnections.delete(key);
      reject(new Error('Connection timeout'));
    });

    socket.on('error', (err) => {
      pendingConnections.delete(key);
      reject(err);
    });
  });
}

export function sendOnSocket(socket, payload) {
  return new Promise((resolve, reject) => {
    if (!socket || socket.destroyed) {
      reject(new Error('Socket not available'));
      return;
    }
    socket.write(JSON.stringify(payload) + '\n', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function pingPeer(ip, tcpPort = DEFAULT_TCP_PORT) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: ip, port: tcpPort }, () => {
      const payload = JSON.stringify({ type: 'ping' }) + '\n';
      socket.write(payload, () => {
        socket.destroy();
        resolve(true);
      });
    });
    socket.setTimeout(2000);
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));
  });
}
