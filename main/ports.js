
export const DEFAULT_UDP_PORT = 42069;
export const DEFAULT_TCP_PORT = 42070;

export const DISCOVERY_BROADCAST_PORTS = [42069, 42071, 42073, 42075];

export function resolvePorts(config = {}) {
  const udpPort =
    Number(process.env.BLIP_UDP_PORT) || Number(config.udpPort) || DEFAULT_UDP_PORT;
  const tcpPort =
    Number(process.env.BLIP_TCP_PORT) || Number(config.tcpPort) || DEFAULT_TCP_PORT;
  return { udpPort, tcpPort };
}

export function getDiscoveryBroadcastPorts(config = {}) {
  const { udpPort } = resolvePorts(config);
  const extra = config.discoveryBroadcastPorts;
  const list = Array.isArray(extra) && extra.length ? extra : DISCOVERY_BROADCAST_PORTS;
  return [...new Set([udpPort, ...list])];
}
