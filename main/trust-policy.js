
export function normalizePeerIdList(arr) {
  if (!Array.isArray(arr)) return [];
  return [
    ...new Set(
      arr
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 64)
    ),
  ];
}

export function isPeerBlocked(config, blipId) {
  const id = Number(blipId);
  return normalizePeerIdList(config?.blockedPeerIds).includes(id);
}

export function isPeerTrusted(config, blipId) {
  const id = Number(blipId);
  return normalizePeerIdList(config?.trustedPeerIds).includes(id);
}
