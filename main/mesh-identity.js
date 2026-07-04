import {
  generateKeyPairSync,
  sign,
  verify,
  createPrivateKey,
  createPublicKey,
} from 'crypto';

export const MESH_PROTO = 1;
const HANDSHAKE_CANON = 'blip-handshake-v1';
const ANNOUNCE_CANON = 'blip-announce-v1';

export function ensureMeshIdentity(config) {
  if (config?.meshPrivateKey && config?.meshPublicKey) return config;
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    ...config,
    meshPublicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    meshPrivateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}

function privateKeyFromConfig(config) {
  if (!config?.meshPrivateKey) return null;
  try {
    return createPrivateKey({
      key: Buffer.from(config.meshPrivateKey, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
  } catch {
    return null;
  }
}

export function publicKeyFromBase64(b64) {
  if (!b64) return null;
  try {
    return createPublicKey({
      key: Buffer.from(b64, 'base64'),
      format: 'der',
      type: 'spki',
    });
  } catch {
    return null;
  }
}

export function signCanonical(config, canonical) {
  const pk = privateKeyFromConfig(config);
  if (!pk) return null;
  const sig = sign(null, Buffer.from(canonical, 'utf8'), pk);
  return sig.toString('base64');
}

export function verifyCanonical(pubkeyB64, canonical, sigB64) {
  const pub = publicKeyFromBase64(pubkeyB64);
  if (!pub || !sigB64) return false;
  try {
    return verify(
      null,
      Buffer.from(canonical, 'utf8'),
      pub,
      Buffer.from(sigB64, 'base64')
    );
  } catch {
    return false;
  }
}

export function handshakeCanonical(from, ts, nonce, pubkey) {
  return `${HANDSHAKE_CANON}|${from}|${ts}|${nonce}|${pubkey}`;
}

export function announceCanonical(fields) {
  return `${ANNOUNCE_CANON}|${fields.blipId}|${fields.displayName}|${fields.presence}|${fields.presenceText}|${fields.ip}|${fields.udpPort}|${fields.tcpPort}|${fields.meshAnnounceTs}|${fields.meshPubkey}`;
}

export function buildHandshakePacket(config, fromId) {
  const from = Number(fromId);
  const ts = Date.now();
  const nonce = `${ts}-${Math.random().toString(36).slice(2, 10)}`;
  const meshPubkey = config.meshPublicKey;
  const canonical = handshakeCanonical(from, ts, nonce, meshPubkey);
  const sig = signCanonical(config, canonical);
  return {
    type: 'mesh-handshake',
    meshProto: MESH_PROTO,
    from,
    ts,
    nonce,
    meshPubkey,
    sig,
  };
}

export function buildHandshakeAckPacket(config, fromId, peerPubkey) {
  const from = Number(fromId);
  const ts = Date.now();
  const nonce = `${ts}-${Math.random().toString(36).slice(2, 10)}`;
  const meshPubkey = config.meshPublicKey;
  const canonical = handshakeCanonical(from, ts, nonce, meshPubkey);
  const sig = signCanonical(config, canonical);
  return {
    type: 'mesh-handshake-ack',
    meshProto: MESH_PROTO,
    from,
    ts,
    nonce,
    meshPubkey,
    sig,
    peerPubkey: peerPubkey || undefined,
  };
}

export function verifyHandshakePacket(msg, expectedFrom) {
  const from = Number(msg?.from);
  if (!Number.isFinite(from) || from < 1 || from > 64) return { ok: false };
  if (expectedFrom != null && from !== Number(expectedFrom)) return { ok: false };
  const meshPubkey = String(msg?.meshPubkey || '');
  const ts = Number(msg?.ts);
  const nonce = String(msg?.nonce || '');
  const sig = String(msg?.sig || '');
  if (!meshPubkey || !nonce || !sig) return { ok: false };
  const canonical = handshakeCanonical(from, ts, nonce, meshPubkey);
  if (!verifyCanonical(meshPubkey, canonical, sig)) return { ok: false };
  return { ok: true, from, meshPubkey };
}

export function signAnnouncePayload(payload) {
  const canonical = announceCanonical(payload);
  return { canonical, sig: null };
}

export function verifyAnnouncePayload(data) {
  if (Number(data?.meshProto) !== MESH_PROTO) return { ok: false, reason: 'proto' };
  const meshPubkey = String(data?.meshPubkey || '');
  const sig = String(data?.meshAnnounceSig || '');
  const ts = Number(data?.meshAnnounceTs);
  if (!meshPubkey || !sig || !Number.isFinite(ts)) return { ok: false, reason: 'fields' };
  const canonical = announceCanonical({
    blipId: data.blipId,
    displayName: data.displayName || '',
    presence: data.presence || 'online',
    presenceText: data.presenceText || '',
    ip: data.ip || '',
    udpPort: data.udpPort,
    tcpPort: data.tcpPort,
    meshAnnounceTs: ts,
    meshPubkey,
  });
  if (!verifyCanonical(meshPubkey, canonical, sig)) return { ok: false, reason: 'sig' };
  return { ok: true, meshPubkey };
}

export function rememberPeerPubkey(config, blipId, meshPubkey) {
  if (!meshPubkey) return config;
  const known = { ...(config.knownPeerKeys || {}) };
  known[String(blipId)] = meshPubkey;
  return { ...config, knownPeerKeys: known };
}

export function getKnownPeerPubkey(config, blipId) {
  return config?.knownPeerKeys?.[String(blipId)] || null;
}

export function pubkeyMatchesKnown(config, blipId, meshPubkey) {
  const known = getKnownPeerPubkey(config, blipId);
  if (!known) return true;
  return known === meshPubkey;
}
