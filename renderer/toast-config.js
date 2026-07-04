
let defaultToastMs = 9000;

export function setDefaultToastDurationMs(ms) {
  const n = Number(ms);
  defaultToastMs = Number.isFinite(n) ? Math.max(2000, Math.min(60000, Math.round(n))) : 9000;
}

export function resolveToastDurationMs(overrideMs) {
  if (overrideMs != null && Number.isFinite(Number(overrideMs))) {
    const n = Number(overrideMs);
    return n <= 0 ? 0 : Math.max(2000, Math.min(60000, Math.round(n)));
  }
  return defaultToastMs;
}
