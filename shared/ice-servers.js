export function parseIceServerLines(text) {
  const servers = [];
  const raw = String(text || '');
  const chunks = raw.split(/[\r\n,]+/);
  for (const chunk of chunks) {
    const line = chunk.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
    const urls = parts[0];
    if (!urls) continue;
    if (!/^(stun|stuns|turn|turns):/i.test(urls)) continue;
    if (parts.length >= 3) {
      servers.push({
        urls,
        username: parts[1],
        credential: parts[2],
      });
    } else {
      servers.push({ urls });
    }
  }
  return servers;
}

export function resolveIceServers(config) {
  if (!config?.iceEnabled) return [];
  return parseIceServerLines(config.iceServerLines);
}

export function rtcConfiguration(config) {
  return { iceServers: resolveIceServers(config) };
}
