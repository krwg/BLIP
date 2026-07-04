import { app } from 'electron';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

const MAX_BYTES = 256 * 1024;

function avatarPath() {
  return join(app.getPath('userData'), 'avatar.png');
}

export function hasCustomAvatar() {
  return existsSync(avatarPath());
}

export function getCustomAvatarDataUrl() {
  const p = avatarPath();
  if (!existsSync(p)) return null;
  try {
    const buf = readFileSync(p);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export function saveCustomAvatar(dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/(png|jpeg|webp);base64,(.+)$/i);
  if (!m) throw new Error('invalid_image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_BYTES) throw new Error('image_too_large');
  const dir = app.getPath('userData');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(avatarPath(), buf);
}

export function clearCustomAvatar() {
  const p = avatarPath();
  if (existsSync(p)) unlinkSync(p);
}
