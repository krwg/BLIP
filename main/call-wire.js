import { sendOnSocket } from './tcp-client.js';

/**
 * Plain { type, sdp } for JSON over TCP / IPC (RTCSessionDescription does not always stringify).
 */
export function serializeSdp(sdp) {
  if (!sdp) return null;
  if (typeof sdp === 'string') {
    return { type: 'offer', sdp };
  }
  let type = sdp.type;
  let body = sdp.sdp;
  if (body && typeof body === 'object' && typeof body.sdp === 'string') {
    type = body.type ?? type;
    body = body.sdp;
  }
  if (typeof type === 'string' && typeof body === 'string' && body.length > 0) {
    return { type, sdp: body };
  }
  return null;
}

/**
 * Prefer inbound TCP (peer dialed us), then outbound handshake socket, then new connection.
 * @param {Map<string, import('net').Socket>} [peerSockets]
 */
export async function sendCallPayload(
  tcpServer,
  ensurePeerSocket,
  peerBlipId,
  payload,
  peerSockets = null
) {
  const id = Number(peerBlipId);
  const inbound = tcpServer?.getConnection(id);
  if (inbound && !inbound.destroyed) {
    await sendOnSocket(inbound, payload);
    return;
  }

  if (peerSockets?.size) {
    const needle = `:${id}:`;
    for (const [key, socket] of peerSockets) {
      if (!key.includes(needle) || !socket || socket.destroyed) continue;
      await sendOnSocket(socket, payload);
      return;
    }
  }

  const fallback = await ensurePeerSocket(id);
  await sendOnSocket(fallback, payload);
}
