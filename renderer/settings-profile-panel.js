import { t } from './i18n.js';
import { buildProfileCard } from './profile-card.js';
import { createAvatarElement, setSelfAvatarCache, regenerateAvatar } from './avatar.js';
import { openAvatarCropDialog } from './avatar-crop-dialog.js';
import { openProfileGifPicker } from './profile-gif-picker.js';
import { premiumTierEnabled, showPremiumLockedToast } from './mesh-plus.js';
import {
  getLocalTrustState,
  resolvePeerMeshPlusTrust,
  isOfficialBuildTrust,
} from './trust-ui.js';
import { OFFICIAL_BUILD_ISSUER } from '../shared/trust-levels.js';
import {
  readEntitlementMarker,
  gateAllowsCapability,
  MESH_PLUS_FEATURES,
} from '../shared/mesh-plus-gates.js';
import { showAppToast } from './toasts.js';
import {
  buildSettingsField,
  buildThemedSelect,
  fillSettingsDropdown,
  buildPanelTitleRow,
} from './settings-ui.js';

/**
 * @param {object} state
 * @param {object} api
 * @param {{ broadcastCustomAvatar?: () => void, broadcastProfileGif?: () => void }} deps
 */
export function buildSettingsProfilePanel(state, api, deps = {}) {
  const frag = document.createElement('div');
  frag.className = 'settings-panel settings-panel--profile';

  frag.appendChild(buildPanelTitleRow('settings.section_profile'));

  const layout = document.createElement('div');
  layout.className = 'settings-profile-layout';

  const editor = document.createElement('div');
  editor.className = 'settings-profile-editor glass';

  const editorTitle = document.createElement('h3');
  editorTitle.className = 'section-subtitle';
  editorTitle.dataset.i18n = 'settings.profile_editor_title';
  editorTitle.textContent = t('settings.profile_editor_title');
  editor.appendChild(editorTitle);

  const editorCard = document.createElement('div');
  editorCard.className = 'settings-profile-editor-card';

  const avatarRow = document.createElement('div');
  avatarRow.className = 'settings-profile-avatar-row';
  const avatarPreview = document.createElement('div');
  avatarPreview.className = 'settings-profile-avatar-preview';
  const avatarActions = document.createElement('div');
  avatarActions.className = 'settings-profile-avatar-actions';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/jpeg,image/webp';
  fileInput.className = 'settings-avatar-file-input';
  const uploadLabel = document.createElement('label');
  uploadLabel.className = 'btn btn-accent';
  uploadLabel.dataset.i18n = 'settings.avatar_upload';
  uploadLabel.textContent = t('settings.avatar_upload');
  const fid = `settings-prof-av-${Date.now()}`;
  fileInput.id = fid;
  uploadLabel.htmlFor = fid;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn-lang';
  removeBtn.textContent = t('settings.avatar_remove');
  const regenBtn = document.createElement('button');
  regenBtn.type = 'button';
  regenBtn.className = 'btn btn-lang';
  regenBtn.textContent = t('settings.avatar_regenerate');

  const gifBtn = document.createElement('button');
  gifBtn.type = 'button';
  gifBtn.className = 'btn btn-lang';
  gifBtn.dataset.i18n = 'settings.profile_gif_pick';
  gifBtn.textContent = t('settings.profile_gif_pick');
  if (!premiumTierEnabled(state.config)) {
    gifBtn.title = t('mesh_plus.feature_locked');
  }

  avatarActions.appendChild(fileInput);
  avatarActions.appendChild(uploadLabel);
  avatarActions.appendChild(removeBtn);
  avatarActions.appendChild(regenBtn);
  avatarActions.appendChild(gifBtn);
  avatarRow.appendChild(avatarPreview);
  avatarRow.appendChild(avatarActions);
  editorCard.appendChild(avatarRow);

  const namePresenceRow = document.createElement('div');
  namePresenceRow.className = 'settings-profile-name-presence-row';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'input';
  nameInput.value = state.config.displayName || '';
  nameInput.placeholder = t('settings.name_placeholder');

  const presenceSelect = buildThemedSelect();
  fillSettingsDropdown(
    presenceSelect,
    [
      { value: 'online', label: t('settings.presence_online') },
      { value: 'away', label: t('settings.presence_away') },
      { value: 'busy', label: t('settings.presence_busy') },
    ],
    state.config.presenceStatus || 'online',
    async (id) => {
      state.config.presenceStatus = id;
      await api.saveConfig({ presenceStatus: id });
      refreshPreview();
    }
  );

  namePresenceRow.appendChild(buildSettingsField('settings.name', nameInput));
  namePresenceRow.appendChild(buildSettingsField('settings.presence', presenceSelect));
  editorCard.appendChild(namePresenceRow);

  const statusInput = document.createElement('input');
  statusInput.type = 'text';
  statusInput.className = 'input settings-status-input';
  statusInput.maxLength = 48;
  statusInput.placeholder = t('settings.status_placeholder');
  statusInput.value = state.config.presenceText || '';
  const statusField = buildSettingsField('settings.status_custom', statusInput);
  statusField.classList.add('settings-profile-field--full');
  editorCard.appendChild(statusField);

  const presetsWrap = document.createElement('div');
  presetsWrap.className = 'status-preset-buttons';
  const presetDefs = [
    'settings.status_empty',
    'settings.status_game',
    'settings.status_afk',
    'settings.status_work',
    'settings.status_stream',
    'settings.status_listen',
    'settings.status_code',
    'settings.status_away_short',
  ];
  for (const key of presetDefs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-lang status-preset-btn';
    btn.textContent = t(key);
    btn.addEventListener('click', async () => {
      const text = key === 'settings.status_empty' ? '' : t(key);
      statusInput.value = text;
      state.config = await api.saveConfig({ presenceText: text });
      refreshPreview();
    });
    presetsWrap.appendChild(btn);
  }
  editorCard.appendChild(presetsWrap);

  const idRow = document.createElement('div');
  idRow.className = 'settings-id-row';
  const idLabel = document.createElement('span');
  idLabel.textContent = `${t('settings.id')}: ${state.config.blipId ?? '—'}`;
  const copyIdBtn = document.createElement('button');
  copyIdBtn.type = 'button';
  copyIdBtn.className = 'btn btn-lang';
  copyIdBtn.textContent = t('settings.copy_id');
  copyIdBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(String(state.config.blipId ?? ''));
  });
  const changeIdBtn = document.createElement('button');
  changeIdBtn.type = 'button';
  changeIdBtn.className = 'btn btn-accent';
  changeIdBtn.textContent = t('settings.change_id');
  idRow.appendChild(idLabel);
  idRow.appendChild(copyIdBtn);
  idRow.appendChild(changeIdBtn);
  editorCard.appendChild(idRow);

  editor.appendChild(editorCard);

  const previewCol = document.createElement('div');
  previewCol.className = 'settings-profile-preview-col';
  const previewTitle = document.createElement('h3');
  previewTitle.className = 'section-subtitle';
  previewTitle.dataset.i18n = 'settings.profile_preview_title';
  previewTitle.textContent = t('settings.profile_preview_title');
  const previewMount = document.createElement('div');
  previewMount.className = 'settings-profile-preview-mount';
  previewCol.appendChild(previewTitle);
  previewCol.appendChild(previewMount);

  layout.appendChild(previewCol);
  layout.appendChild(editor);
  frag.appendChild(layout);

  let previewBuilt = null;

  function selfPeer() {
    const trust = getLocalTrustState();
    const meshPlus = premiumTierEnabled(state.config);
    const base = {
      blipId: state.config.blipId,
      displayName: state.config.displayName || 'Anonymous',
      online: true,
      presence: state.config.presenceStatus || 'online',
      presenceText: state.config.presenceText || '',
      meshPlus,
      buildTrust: trust?.buildTrust,
      buildVerified: isOfficialBuildTrust(trust?.buildTrust),
      buildIssuer: isOfficialBuildTrust(trust?.buildTrust) ? OFFICIAL_BUILD_ISSUER : '',
    };
    if (meshPlus) {
      base.meshPlusTrust =
        trust?.meshPlusTrust ?? resolvePeerMeshPlusTrust(base);
    }
    return base;
  }

  function refreshAvatarPreview() {
    avatarPreview.innerHTML = '';
    avatarPreview.appendChild(
      createAvatarElement(state.config.blipId, 4, { selfBlipId: state.config.blipId })
    );
  }

  function refreshPreview() {
    previewBuilt?.destroy?.();
    previewMount.innerHTML = '';
    previewBuilt = buildProfileCard(selfPeer(), {
      selfBlipId: state.config.blipId,
      isSelfPreview: true,
      meshPlusOnSelf: premiumTierEnabled(state.config),
      showBanner: true,
      showPrivateNote: false,
      showActions: false,
      presenceClass: (p) => {
        if (p.presence === 'away') return 'away';
        if (p.presence === 'busy') return 'busy';
        return 'online';
      },
      statusTooltip: (p) => {
        const base =
          p.presence === 'away'
            ? t('peers.away')
            : p.presence === 'busy'
              ? t('peers.busy')
              : t('peers.online');
        const custom = (p.presenceText || '').trim();
        return custom ? `${base} · ${custom}` : base;
      },
    });
    previewMount.appendChild(previewBuilt.el);
  }

  nameInput.addEventListener('change', async () => {
    const name = nameInput.value.trim() || 'Anonymous';
    state.config.displayName = name;
    await api.saveConfig({ displayName: name });
    refreshPreview();
  });

  statusInput.addEventListener('change', async () => {
    const presenceText = statusInput.value.trim().slice(0, 48);
    statusInput.value = presenceText;
    state.config = await api.saveConfig({ presenceText });
    refreshPreview();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const dataUrl = await openAvatarCropDialog(file);
      if (!dataUrl) return;
      const r = await window.blip.saveAvatar?.(dataUrl);
      if (!r?.ok) throw new Error(r?.error || 'save_failed');
      setSelfAvatarCache(dataUrl);
      state.config.customAvatar = true;
      refreshAvatarPreview();
      refreshPreview();
      window.dispatchEvent(new CustomEvent('blip-avatar-changed'));
      deps.broadcastCustomAvatar?.();
      showAppToast({ title: t('settings.avatar_saved'), durationMs: 3000 });
    } catch (e) {
      showAppToast({
        title: t('settings.avatar_failed'),
        body: e?.message || '',
        variant: 'danger',
        durationMs: 4500,
      });
    }
  });

  removeBtn.addEventListener('click', async () => {
    await window.blip.clearAvatar?.();
    setSelfAvatarCache(null);
    state.config.customAvatar = false;
    refreshAvatarPreview();
    refreshPreview();
    window.dispatchEvent(new CustomEvent('blip-avatar-changed'));
    deps.broadcastCustomAvatar?.();
  });

  regenBtn.addEventListener('click', async () => {
    if (state.config.customAvatar) await window.blip.clearAvatar?.();
    setSelfAvatarCache(null);
    regenerateAvatar(state.config.blipId);
    refreshAvatarPreview();
    refreshPreview();
    window.dispatchEvent(new CustomEvent('blip-avatar-changed'));
  });

  gifBtn.addEventListener('click', () => {
    if (
      !premiumTierEnabled(state.config) ||
      !readEntitlementMarker(state.config) ||
      !gateAllowsCapability(state.config, MESH_PLUS_FEATURES.profile_gif)
    ) {
      showPremiumLockedToast();
      return;
    }
    void openProfileGifPicker({
      onSelected: () => {
        refreshPreview();
        deps.broadcastProfileGif?.();
      },
    });
  });

  changeIdBtn.addEventListener('click', () => {
    if (typeof deps.onChangeId === 'function') deps.onChangeId();
  });

  refreshAvatarPreview();
  refreshPreview();

  const onTrust = () => refreshPreview();
  window.blip?.onTrustState?.(onTrust);
  frag._profileCleanup = () => {
    previewBuilt?.destroy?.();
  };

  return frag;
}
