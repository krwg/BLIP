import { app } from 'electron';
import { existsSync, unlinkSync, rmSync } from 'fs';
import { join } from 'path';
import { resetConfigToDefaults } from './config.js';
import { clearCustomAvatar } from './avatar-store.js';
import { resetGiphyApiKeyCache } from './giphy-key.js';

function clearProfileGifStorage() {
  const userData = app.getPath('userData');
  const meta = join(userData, 'profile-gif-meta.json');
  const gifsDir = join(userData, 'profile-gifs');
  if (existsSync(meta)) unlinkSync(meta);
  if (existsSync(gifsDir)) {
    rmSync(gifsDir, { recursive: true, force: true });
  }
}

/** Remove optional userData artifacts (not packaged resources). */
export function clearUserDataArtifacts() {
  clearCustomAvatar();
  clearProfileGifStorage();
  const giphyKey = join(app.getPath('userData'), 'giphy-api-key.txt');
  if (existsSync(giphyKey)) unlinkSync(giphyKey);
  resetGiphyApiKeyCache();
}

/** Full factory reset: defaults config + cleared profile media. */
export function performFactoryReset() {
  clearUserDataArtifacts();
  return resetConfigToDefaults();
}
