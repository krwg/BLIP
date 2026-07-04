
export const MESH_PLUS_FEATURES = {
  animated_bg: 'animated_bg',
  sound_pack: 'sound_pack',
  melody_pack: 'melody_pack',
  projects_board: 'projects_board',
  projects_canvas: 'projects_canvas',
  projects_pad_history: 'projects_pad_history',
  projects_clipboard_unlimited: 'projects_clipboard_unlimited',
  theme_editor: 'theme_editor',
  profile_gif: 'profile_gif',
  chat_export_themed: 'chat_export_themed',
};

export const PREMIUM_ANIMATED_BG_IDS = ['ember', 'rift'];

export const FREE_SOUND_PACK_IDS = ['signal', 'pulse'];
export const PREMIUM_SOUND_PACK_IDS = ['wire', 'static'];

export const FREE_MELODY_PACK_IDS = ['mesh', 'grid'];
export const PREMIUM_MELODY_PACK_IDS = ['beacon', 'chime'];

const DEFAULTS = {
  animatedBgId: 'none',
  uiSoundPack: 'signal',
  uiMelodyPack: 'mesh',
};

export function uiShowsPremiumTier(cfg) {
  return cfg?.meshPlusActive === true || cfg?.tier === 'mesh_plus';
}

export function readTierFlag(cfg) {
  return cfg?.tier === 'mesh_plus';
}

export function readEntitlementMarker(cfg) {
  return !!(cfg?.meshPlusLicenseId || cfg?.meshPlusLicenseMasked);
}

export function readActiveEntitlement(cfg) {
  return cfg?.meshPlusActive === true;
}

export function gateAllowsCapability(cfg, feature) {
  if (!readActiveEntitlement(cfg) || !readTierFlag(cfg)) return false;
  if (!uiShowsPremiumTier(cfg)) return false;
  return freeTierAllowsValue(cfg, feature, feature);
}

export function freeTierAllowsValue(cfg, feature, value) {
  if (uiShowsPremiumTier(cfg)) return true;
  if (!value) return true;
  switch (feature) {
    case MESH_PLUS_FEATURES.animated_bg:
      return !PREMIUM_ANIMATED_BG_IDS.includes(value);
    case MESH_PLUS_FEATURES.sound_pack:
      return !PREMIUM_SOUND_PACK_IDS.includes(value);
    case MESH_PLUS_FEATURES.melody_pack:
      return !PREMIUM_MELODY_PACK_IDS.includes(value);
    default:
      return true;
  }
}

export function premiumResetPatch(config) {
  if (!config || typeof config !== 'object') return null;
  const patch = {};

  const bg = String(config.animatedBgId || 'none');
  if (PREMIUM_ANIMATED_BG_IDS.includes(bg)) {
    patch.animatedBgId = DEFAULTS.animatedBgId;
  }

  const fx = String(config.uiSoundPack || DEFAULTS.uiSoundPack);
  if (PREMIUM_SOUND_PACK_IDS.includes(fx)) {
    patch.uiSoundPack = DEFAULTS.uiSoundPack;
  }

  const mel = String(config.uiMelodyPack || DEFAULTS.uiMelodyPack);
  if (PREMIUM_MELODY_PACK_IDS.includes(mel)) {
    patch.uiMelodyPack = DEFAULTS.uiMelodyPack;
  }

  if (String(config.accentCustomHex || '').trim()) {
    patch.accentCustomHex = '';
  }

  if (config.hasProfileGif || String(config.profileGifActiveId || '').trim()) {
    patch.profileGifActiveId = '';
    patch.hasProfileGif = false;
  }

  return Object.keys(patch).length ? patch : null;
}

export function sanitizePremiumPrefs(config, updates, meshPlusActive) {
  if (!updates || typeof updates !== 'object') return updates;
  if (meshPlusActive) return updates;

  const out = { ...updates };

  if (out.animatedBgId !== undefined) {
    const id = String(out.animatedBgId);
    if (!freeTierAllowsValue(config, MESH_PLUS_FEATURES.animated_bg, id)) {
      out.animatedBgId = DEFAULTS.animatedBgId;
    }
  }

  if (out.uiSoundPack !== undefined) {
    const id = String(out.uiSoundPack);
    if (!freeTierAllowsValue(config, MESH_PLUS_FEATURES.sound_pack, id)) {
      out.uiSoundPack = DEFAULTS.uiSoundPack;
    }
  }

  if (out.uiMelodyPack !== undefined) {
    const id = String(out.uiMelodyPack);
    if (!freeTierAllowsValue(config, MESH_PLUS_FEATURES.melody_pack, id)) {
      out.uiMelodyPack = DEFAULTS.uiMelodyPack;
    }
  }

  if (out.accentCustomHex !== undefined && !meshPlusActive) {
    out.accentCustomHex = '';
  }
  if (!meshPlusActive && (out.profileGifActiveId !== undefined || out.hasProfileGif !== undefined)) {
    out.profileGifActiveId = '';
    out.hasProfileGif = false;
  }

  return out;
}

export function applyPremiumReset(config, meshPlusActive) {
  if (meshPlusActive) return config;
  const patch = premiumResetPatch(config);
  return patch ? { ...config, ...patch } : config;
}
