import { buildProfileCard } from './profile-card.js';
import { getPeerProfileGifDisplayUrl } from './peer-gif-cache.js';

export function buildPeerProfilePage(peer, hooks = {}) {
  return buildProfileCard(peer, {
    ...hooks,
    showPrivateNote: true,
    showActions: true,
    showBanner: true,
    getProfileGifUrl: async (p) => {
      if (hooks.getProfileGifUrl) return hooks.getProfileGifUrl(p);
      if (
        hooks.selfBlipId != null &&
        Number(p.blipId) === Number(hooks.selfBlipId)
      ) {
        return (await window.blip?.getProfileGifActiveUrl?.()) || null;
      }
      return getPeerProfileGifDisplayUrl(p.blipId);
    },
  });
}
