import { existsSync } from 'fs';
import { join } from 'path';
import { resolveBuildAsset } from './paths.js';
import { resolveEntitlementState } from './mesh-plus-license.js';

/** @type {{ id: string, file: string, tier: 'free' | 'mesh_plus' }[]} */
export const APP_ICON_VARIANTS = [
  { id: 'main', file: 'icon-main.svg', tier: 'free' },
  { id: 'dop-1', file: 'icon-dop-1.svg', tier: 'free' },
  { id: 'dop-2', file: 'icon-dop-2.svg', tier: 'free' },
  { id: 'dop-3', file: 'icon-dop-3.svg', tier: 'free' },
  { id: 'dop-4', file: 'icon-dop-4.svg', tier: 'free' },
  { id: 'mesh-1', file: 'icon-mesh1.svg', tier: 'mesh_plus' },
  { id: 'mesh-2', file: 'icon-mesh2.svg', tier: 'mesh_plus' },
  { id: 'mesh-3', file: 'icon-mesh3.svg', tier: 'mesh_plus' },
  { id: 'mesh-4', file: 'icon-mesh4.svg', tier: 'mesh_plus' },
  { id: 'mesh-5', file: 'icon-mesh5.svg', tier: 'mesh_plus' },
  { id: 'mesh-6', file: 'icon-mesh6.svg', tier: 'mesh_plus' },
];

const FREE_IDS = new Set(APP_ICON_VARIANTS.filter((v) => v.tier === 'free').map((v) => v.id));
const MESH_IDS = new Set(APP_ICON_VARIANTS.filter((v) => v.tier === 'mesh_plus').map((v) => v.id));

export function normalizeAppIconVariant(id) {
  const s = String(id || 'main').trim().toLowerCase();
  return APP_ICON_VARIANTS.some((v) => v.id === s) ? s : 'main';
}

/** @param {object} config */
export function resolveAppIconVariant(config) {
  let id = normalizeAppIconVariant(config?.appIconVariant);
  if (MESH_IDS.has(id) && !resolveEntitlementState(config)) id = 'main';
  return id;
}

export function canUseAppIconVariant(config, variantId) {
  const id = normalizeAppIconVariant(variantId);
  if (FREE_IDS.has(id)) return true;
  if (MESH_IDS.has(id)) return resolveEntitlementState(config);
  return false;
}

/** @param {string} variantId */
export function resolveVariantWindowIconPath(variantId) {
  const id = normalizeAppIconVariant(variantId);
  const named = resolveBuildAsset(join('icons', `${id}.png`));
  if (existsSync(named)) return named;
  return resolveBuildAsset('icon.png');
}

/** @param {string} variantId */
export function resolveVariantTrayIconPath(variantId) {
  const id = normalizeAppIconVariant(variantId);
  const named = resolveBuildAsset(join('icons', `${id}-tray.png`));
  if (existsSync(named)) return named;
  return resolveBuildAsset('tray-16.png');
}

export function listAppIconVariantIds() {
  return APP_ICON_VARIANTS.map((v) => v.id);
}
