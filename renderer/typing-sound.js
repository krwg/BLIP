import { playTypingClick } from './audio.js';

export function attachTypingSound(input, getConfig) {
  if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter' || e.key === 'Tab' || e.key.startsWith('Arrow')) return;
    const cfg = getConfig?.();
    if (!cfg?.typingSoundEnabled || cfg?.doNotDisturb) return;
    playTypingClick();
  });
}
