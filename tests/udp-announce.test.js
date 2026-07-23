import { describe, expect, it } from 'vitest';
import {
  MESH_PROTO,
  announceCanonical,
  ensureMeshIdentity,
  signCanonical,
  verifyAnnouncePayload,
} from '../main/mesh-identity.js';

function buildSignedAnnounce(config, fields) {
  const meshPubkey = config.meshPublicKey;
  const meshAnnounceTs = fields.meshAnnounceTs ?? Date.now();
  const canonical = announceCanonical({
    blipId: fields.blipId,
    displayName: fields.displayName || '',
    presence: fields.presence || 'online',
    presenceText: fields.presenceText || '',
    ip: fields.ip || '10.0.0.2',
    udpPort: fields.udpPort ?? 42069,
    tcpPort: fields.tcpPort ?? 42070,
    meshAnnounceTs,
    meshPubkey,
  });
  const meshAnnounceSig = signCanonical(config, canonical);
  const packet = {
    type: 'announce',
    meshProto: MESH_PROTO,
    blipId: fields.blipId,
    displayName: fields.displayName || '',
    presence: fields.presence || 'online',
    presenceText: fields.presenceText || '',
    ip: fields.ip || '10.0.0.2',
    udpPort: fields.udpPort ?? 42069,
    tcpPort: fields.tcpPort ?? 42070,
    meshPubkey,
    meshAnnounceTs,
    meshAnnounceSig,
  };
  return { packet, wire: Buffer.from(JSON.stringify(packet), 'utf8') };
}

describe('UDP announce (mesh-identity)', () => {
  it('JSON round-trip keeps a valid signed announce', () => {
    const config = ensureMeshIdentity({});
    const { packet, wire } = buildSignedAnnounce(config, {
      blipId: 17,
      displayName: 'Alpha',
      presenceText: 'in game',
    });
    const parsed = JSON.parse(wire.toString('utf8'));
    expect(parsed.type).toBe('announce');
    expect(parsed.blipId).toBe(17);
    const verified = verifyAnnouncePayload(parsed);
    expect(verified).toEqual({ ok: true, meshPubkey: config.meshPublicKey });
    expect(packet.meshAnnounceSig).toBeTruthy();
  });

  it('rejects tampered displayName', () => {
    const config = ensureMeshIdentity({});
    const { packet } = buildSignedAnnounce(config, {
      blipId: 3,
      displayName: 'Honest',
    });
    packet.displayName = 'Evil';
    expect(verifyAnnouncePayload(packet).ok).toBe(false);
  });

  it('rejects missing signature fields', () => {
    expect(
      verifyAnnouncePayload({
        meshProto: MESH_PROTO,
        blipId: 1,
        meshPubkey: 'x',
      }).ok,
    ).toBe(false);
  });
});
