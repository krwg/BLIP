import { setPadState } from './group-projects-store.js';

export const MESH_PROJECT_SCOPE = '__mesh__';

async function safeSend(api, payload) {
  try {
    await api.sendTcpMessage(payload);
  } catch {
    /* peer offline */
  }
}

/**
 * @param {object} api
 * @param {object} config
 * @param {number[]} peerIds
 * @param {object} payload
 */
export async function broadcastMeshPad(api, config, peerIds, payload) {
  const myId = Number(config.blipId);
  for (const to of peerIds || []) {
    if (Number(to) === myId) continue;
    await safeSend(api, {
      type: 'mesh-proj-pad',
      to,
      from: myId,
      payload,
    });
  }
}

export function handleMeshProjectTcp(msg, config) {
  const type = msg.type;
  if (type !== 'mesh-proj-pad') return false;
  const from = Number(msg.from);
  const myId = Number(config.blipId);
  if (!Number.isFinite(from) || from === myId) return true;
  const payload = msg.payload || {};
  setPadState(MESH_PROJECT_SCOPE, {
    text: String(payload.text || ''),
    updatedAt: Number(payload.updatedAt) || Date.now(),
    from,
  });
  return true;
}
