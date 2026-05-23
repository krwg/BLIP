import dgram from 'dgram';
import mdns from 'multicast-dns';
import { getLocalIp, getLocalIpv4Set, normalizePeerIp } from './config.js';
import { resolvePorts, getDiscoveryBroadcastPorts } from './ports.js';
import {
  MESH_PROTO,
  announceCanonical,
  signCanonical,
  verifyAnnouncePayload,
} from './mesh-identity.js';
import { resolveEntitlementState } from './mesh-plus-license.js';
import {
  getBuildAnnounceTrust,
  peerBuildTrustFromAnnounce,
  peerMeshPlusTrustFromAnnounce,
} from './trust-state.js';

const ANNOUNCE_INTERVAL = 5000;
const PEER_TIMEOUT = 30000;
const MAX_PRESENCE_TEXT = 48;

function sanitizePresenceText(raw) {
  if (raw == null) return '';
  return String(raw)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, MAX_PRESENCE_TEXT);
}

export class Discovery {
  constructor(config, onPeersChange) {
    this.config = config;
    this.onPeersChange = onPeersChange;
    this.peers = new Map();
    this.occupiedIds = new Set();
    this.socket = null;
    this.mdnsInstance = null;
    this.announceTimer = null;
    this.cleanupTimer = null;
    this.udpPort = resolvePorts(config).udpPort;
    /** @type {((data: object) => void) | null} */
    this.onSeedPacket = null;
  }

  async start() {
    this.udpPort = resolvePorts(this.config).udpPort;
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.socket.on('message', (msg) => this.handleUdpMessage(msg));

    try {
      await new Promise((resolve, reject) => {
        const onBindError = (err) => {
          this.socket.off('error', onBindError);
          reject(err);
        };
        this.socket.once('error', onBindError);
        this.socket.bind(this.udpPort, () => {
          this.socket.off('error', onBindError);
          this.socket.on('error', (err) => console.error('[UDP]', err.message));
          this.socket.setBroadcast(true);
          console.log(`[UDP] listening on ${this.udpPort}`);
          resolve();
        });
      });
    } catch (err) {
      try {
        this.socket?.close();
      } catch {
        /* ignore */
      }
      this.socket = null;
      throw err;
    }

    this.startMdns();
    this.announce();
    this.announceTimer = setInterval(() => this.announce(), ANNOUNCE_INTERVAL);
    this.cleanupTimer = setInterval(() => this.cleanupStale(), 5000);
  }

  startMdns() {
    this.mdnsInstance = mdns();
    this.mdnsInstance.on('response', (resp) => {
      resp.answers.forEach((a) => {
        if (a.name === '_blip._udp.local' && a.type === 'TXT') {
          try {
            const data = JSON.parse(Buffer.from(a.data).toString());
            this.registerPeer(data);
          } catch {
            /* ignore malformed */
          }
        }
      });
    });

    this.mdnsInstance.on('query', (query) => {
      query.questions.forEach((q) => {
        if (q.name === '_blip._udp.local') {
          this.announceMdns();
        }
      });
    });

    setInterval(() => this.announceMdns(), ANNOUNCE_INTERVAL);
  }

  announceMdns() {
    if (!this.config.blipId || !this.mdnsInstance) return;
    const payload = this.buildAnnounce();
    this.mdnsInstance.respond({
      answers: [
        {
          name: '_blip._udp.local',
          type: 'PTR',
          data: `blip-${this.config.blipId}._blip._udp.local`,
          ttl: 120,
        },
        {
          name: `blip-${this.config.blipId}._blip._udp.local`,
          type: 'TXT',
          data: Buffer.from(JSON.stringify(payload)),
          ttl: 120,
        },
      ],
    });
  }

  buildAnnounce() {
    const { udpPort, tcpPort } = resolvePorts(this.config);
    let presence = this.config.presenceStatus || 'online';
    if (this.config.doNotDisturb) presence = 'busy';
    const ip = getLocalIp();
    const meshAnnounceTs = Date.now();
    const meshPubkey = this.config.meshPublicKey || '';
    const base = {
      type: 'announce',
      blipId: this.config.blipId,
      displayName: this.config.displayName,
      presence,
      presenceText: sanitizePresenceText(this.config.presenceText),
      ip,
      udpPort,
      tcpPort,
      meshProto: MESH_PROTO,
      meshPubkey,
      meshAnnounceTs,
    };
    const canonical = announceCanonical({
      blipId: base.blipId,
      displayName: base.displayName || '',
      presence: base.presence,
      presenceText: base.presenceText,
      ip: base.ip,
      udpPort: base.udpPort,
      tcpPort: base.tcpPort,
      meshAnnounceTs,
      meshPubkey,
    });
    const meshAnnounceSig = signCanonical(this.config, canonical);
    const meshPlus = resolveEntitlementState(this.config);
    const hasProfileGif = meshPlus && !!this.config?.hasProfileGif;
    const buildTrust = getBuildAnnounceTrust();
    return {
      ...base,
      meshAnnounceSig,
      meshPlus,
      hasProfileGif,
      buildVerified: buildTrust.buildVerified,
      buildIssuer: buildTrust.buildIssuer,
      buildVersion: buildTrust.buildVersion,
      meshPlusTrust: meshPlus ? buildTrust.meshPlusTrust : null,
    };
  }

  announce() {
    if (!this.config.blipId || !this.socket) return;
    const payload = JSON.stringify(this.buildAnnounce());
    const buf = Buffer.from(payload);
    for (const port of getDiscoveryBroadcastPorts(this.config)) {
      this.socket.send(buf, 0, buf.length, port, '255.255.255.255');
    }
    this.announceMdns();
  }

  /** @param {object} obj Beacon / seed UDP packet (`seed-announce`, `seed-pulse`, …). */
  broadcastPacket(obj) {
    if (!this.config.blipId || !this.socket || !obj) return;
    const payload = JSON.stringify(obj);
    const buf = Buffer.from(payload);
    for (const port of getDiscoveryBroadcastPorts(this.config)) {
      this.socket.send(buf, 0, buf.length, port, '255.255.255.255');
    }
  }

  handleUdpMessage(msg) {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'seed-announce' || data.type === 'seed-pulse' || data.type === 'seed-gone') {
        this.onSeedPacket?.(data);
        return;
      }
      if (data.type === 'announce' && data.blipId) {
        this.registerPeer(data);
      }
    } catch {
      /* ignore */
    }
  }

  registerPeer(data) {
    const selfId = this.config.blipId;
    const announceIp = normalizePeerIp(data.ip);
    if (selfId != null && data.blipId === selfId && getLocalIpv4Set().has(announceIp)) {
      return;
    }

    const { tcpPort, udpPort } = resolvePorts(this.config);
    const peerTcp = Number(data.tcpPort) || tcpPort;
    const peerUdp = Number(data.udpPort) || udpPort;

    const existing = this.peers.get(data.blipId);
    const presence =
      data.presence === 'away' || data.presence === 'busy' ? data.presence : 'online';
    const presenceText = sanitizePresenceText(data.presenceText);
    let meshVerified = false;
    let meshLegacy = Number(data.meshProto) !== MESH_PROTO;
    const meshPubkey = String(data.meshPubkey || '');
    if (Number(data.meshProto) === MESH_PROTO) {
      const check = verifyAnnouncePayload(data);
      meshVerified = check.ok;
      meshLegacy = !check.ok;
    }

    const peer = {
      blipId: data.blipId,
      displayName: data.displayName || `BLIP-${data.blipId}`,
      presence,
      presenceText,
      ip: announceIp || data.ip,
      tcpPort: peerTcp,
      udpPort: peerUdp,
      lastSeen: Date.now(),
      online: true,
      meshVerified,
      meshLegacy,
      meshPubkey,
      meshPlus: !!data.meshPlus,
      hasProfileGif: !!data.meshPlus && !!data.hasProfileGif,
      buildTrust: peerBuildTrustFromAnnounce(data),
      buildIssuer: String(data.buildIssuer || ''),
      buildVerified: !!data.buildVerified,
      meshPlusTrust: peerMeshPlusTrustFromAnnounce(data),
    };

    if (
      !existing ||
      existing.ip !== peer.ip ||
      existing.displayName !== peer.displayName ||
      existing.presence !== peer.presence ||
      existing.presenceText !== peer.presenceText ||
      existing.tcpPort !== peer.tcpPort ||
      existing.meshVerified !== peer.meshVerified ||
      existing.meshLegacy !== peer.meshLegacy ||
      existing.meshPlus !== peer.meshPlus ||
      existing.hasProfileGif !== peer.hasProfileGif ||
      existing.buildTrust !== peer.buildTrust ||
      existing.buildVerified !== peer.buildVerified ||
      existing.meshPlusTrust !== peer.meshPlusTrust
    ) {
      this.peers.set(data.blipId, peer);
    } else {
      existing.lastSeen = Date.now();
      existing.online = true;
      existing.presence = presence;
      existing.presenceText = presenceText;
      existing.tcpPort = peerTcp;
      existing.udpPort = peerUdp;
      existing.meshVerified = meshVerified;
      existing.meshLegacy = meshLegacy;
      existing.meshPubkey = meshPubkey;
      existing.meshPlus = peer.meshPlus;
      existing.hasProfileGif = peer.hasProfileGif;
      existing.buildTrust = peer.buildTrust;
      existing.buildIssuer = peer.buildIssuer;
      existing.buildVerified = peer.buildVerified;
      existing.meshPlusTrust = peer.meshPlusTrust;
    }

    this.occupiedIds.add(data.blipId);
    this.emitPeers();
  }

  cleanupStale() {
    const now = Date.now();
    let changed = false;
    for (const [id, peer] of this.peers) {
      if (now - peer.lastSeen > PEER_TIMEOUT) {
        if (peer.online) {
          peer.online = false;
          changed = true;
        }
      }
    }
    if (changed) this.emitPeers();
  }

  getPeers() {
    return Array.from(this.peers.values()).sort((a, b) => a.blipId - b.blipId);
  }

  /** Update peer IP after a TCP session from a different route (NAT/VPN/Tailscale). */
  noteObservedPeerIp(blipId, ip) {
    const id = Number(blipId);
    if (!Number.isFinite(id)) return;
    const peer = this.peers.get(id);
    if (!peer) return;
    const nip = normalizePeerIp(ip);
    if (!nip || peer.ip === nip) return;
    peer.ip = nip;
    this.emitPeers();
  }

  getOccupiedIds() {
    return Array.from(this.occupiedIds);
  }

  updateConfig(config) {
    this.config = config;
    this.announce();
  }

  emitPeers() {
    this.onPeersChange(this.getPeers(), this.getOccupiedIds());
  }

  stop() {
    clearInterval(this.announceTimer);
    clearInterval(this.cleanupTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.mdnsInstance) {
      this.mdnsInstance.destroy();
      this.mdnsInstance = null;
    }
  }
}
