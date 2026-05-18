import { t } from './i18n.js';
import {
  groupDisplayName,
  amHost,
  getTextChannels,
  getVoiceChannels,
  formatChannelLabel,
  saveGroup,
} from './groups.js';
import { getVoiceChannelRoster } from './voice-channel-roster.js';
import {
  isInVoiceChannel,
  getActiveVoiceChannel,
  joinVoiceChannel,
  leaveVoiceChannel,
} from './voice-channel.js';
import { createVoiceStage } from './voice-channel-ui.js';
import { createGroupChatView } from './group-chat.js';
import { channelIcon } from './group-projects-store.js';
import {
  createGroupAvatarElement,
  setGroupAvatarDataUrl,
} from './group-avatar.js';
import { openAvatarCropDialog } from './avatar-crop-dialog.js';
import { showAppToast } from './toasts.js';

/**
 * Group layout: channel sidebar (left) + text chat + voice stage.
 */
export function createGroupCommunityView(
  group,
  config,
  onSend,
  onBack,
  onGroupMenu,
  onSendFile,
  api
) {
  const root = document.createElement('div');
  root.className = 'group-community';

  const sidebar = document.createElement('aside');
  sidebar.className = 'group-sidebar glass';

  const sideHead = document.createElement('div');
  sideHead.className = 'group-sidebar-head';

  if (onBack) {
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn-accent group-sidebar-back';
    backBtn.textContent = '←';
    backBtn.addEventListener('click', onBack);
    sideHead.appendChild(backBtn);
  }

  const avatarFile = document.createElement('input');
  avatarFile.type = 'file';
  avatarFile.accept = 'image/png,image/jpeg,image/webp';
  avatarFile.className = 'group-sidebar-avatar-file';
  avatarFile.hidden = true;

  const avatarBtn = document.createElement('button');
  avatarBtn.type = 'button';
  avatarBtn.className = 'group-sidebar-avatar-btn';
  avatarBtn.title = t('group.avatar_change');
  avatarBtn.appendChild(createGroupAvatarElement(group.id, 3));
  avatarBtn.addEventListener('click', () => avatarFile.click());

  avatarFile.addEventListener('change', async () => {
    const file = avatarFile.files?.[0];
    avatarFile.value = '';
    if (!file) return;
    const dataUrl = await openAvatarCropDialog(file);
    if (!dataUrl) return;
    setGroupAvatarDataUrl(group.id, dataUrl);
    avatarBtn.innerHTML = '';
    avatarBtn.appendChild(createGroupAvatarElement(group.id, 3));
  });

  const headText = document.createElement('div');
  headText.className = 'group-sidebar-head-text';
  const sideTitle = document.createElement('button');
  sideTitle.type = 'button';
  sideTitle.className = 'group-sidebar-title group-sidebar-title-btn';
  sideTitle.textContent = groupDisplayName(group);
  sideTitle.title = t('group.rename_hint');
  sideTitle.addEventListener('click', () => {
    const val = prompt(t('group.rename_prompt'), group.name || groupDisplayName(group));
    if (val === null) return;
    const trimmed = val.trim();
    group.name = trimmed || undefined;
    saveGroup(group);
    sideTitle.textContent = groupDisplayName(group);
    showAppToast({ title: t('group.rename_done'), durationMs: 2800 });
  });
  const sideMeta = document.createElement('span');
  sideMeta.className = 'group-sidebar-meta';
  sideMeta.textContent = amHost(group, config.blipId)
    ? t('group.you_host')
    : t('group.host_line').replace('{id}', String(group.hostId));
  headText.appendChild(sideTitle);
  headText.appendChild(sideMeta);

  sideHead.appendChild(avatarFile);
  sideHead.appendChild(avatarBtn);
  sideHead.appendChild(headText);
  sidebar.appendChild(sideHead);

  const unstable = document.createElement('div');
  unstable.className = 'group-unstable-banner';
  const unstableHelp = document.createElement('button');
  unstableHelp.type = 'button';
  unstableHelp.className = 'group-unstable-help btn btn-lang';
  unstableHelp.textContent = '?';
  unstableHelp.title = t('group.unstable_title');
  unstableHelp.addEventListener('click', () => {
    showAppToast({
      title: t('group.unstable_title'),
      body: t('group.unstable_body'),
      durationMs: 14000,
    });
  });
  const unstableText = document.createElement('span');
  unstableText.className = 'group-unstable-text';
  unstableText.textContent = t('group.unstable_short');
  unstable.appendChild(unstableHelp);
  unstable.appendChild(unstableText);
  sidebar.appendChild(unstable);

  const textLabel = document.createElement('div');
  textLabel.className = 'group-sidebar-section';
  textLabel.dataset.i18n = 'voice.text_channels';
  textLabel.textContent = t('voice.text_channels');
  sidebar.appendChild(textLabel);

  const textList = document.createElement('div');
  textList.className = 'group-channel-list';
  sidebar.appendChild(textList);

  const voiceLabel = document.createElement('div');
  voiceLabel.className = 'group-sidebar-section';
  voiceLabel.dataset.i18n = 'voice.voice_channels';
  voiceLabel.textContent = t('voice.voice_channels');
  sidebar.appendChild(voiceLabel);

  const voiceList = document.createElement('div');
  voiceList.className = 'group-channel-list';
  sidebar.appendChild(voiceList);

  const body = document.createElement('div');
  body.className = 'group-community-body';

  let activeTextId = getTextChannels(group)[0]?.id || 'text-general';
  let joinedVoiceId = null;
  const voiceStages = new Map();

  const chat = createGroupChatView(
    group,
    config,
    onSend,
    null,
    null,
    onGroupMenu,
    null,
    onSendFile
  );
  chat.el.classList.add('group-community-chat');
  chat.el.querySelector('.group-call-ongoing')?.remove();
  chat.el.querySelector('.chat-header .btn-accent')?.remove();

  body.appendChild(chat.el);
  root.appendChild(sidebar);
  root.appendChild(body);

  function ensureVoiceStage(channelId) {
    if (!voiceStages.has(channelId)) {
      const stage = createVoiceStage(config, group.id, channelId);
      voiceStages.set(channelId, stage);
      body.insertBefore(stage.el, chat.el);
    }
    return voiceStages.get(channelId);
  }

  function refreshSidebar() {
    textList.innerHTML = '';
    voiceList.innerHTML = '';

    getTextChannels(group).forEach((ch) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'group-channel-btn';
      if (ch.id === activeTextId) btn.classList.add('group-channel-btn--active');
      btn.innerHTML = `<span class="group-channel-icon">${channelIcon(ch)}</span><span class="group-channel-name">${formatChannelLabel(ch)}</span>`;
      btn.addEventListener('click', () => {
        activeTextId = ch.id;
        refreshSidebar();
      });
      textList.appendChild(btn);
    });

    getVoiceChannels(group).forEach((ch) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const active = getActiveVoiceChannel();
      const inCh =
        active?.groupId === group.id && active?.channelId === ch.id && isInVoiceChannel();
      btn.className = 'group-channel-btn group-channel-btn--voice';
      if (inCh) btn.classList.add('group-channel-btn--live');
      const snap = getVoiceChannelRoster(group.id, ch.id);
      const count = snap.count || 0;
      btn.innerHTML = `<span class="group-channel-icon">${channelIcon(ch)}</span><span class="group-channel-name">${formatChannelLabel(ch)}</span><span class="group-channel-badge">${count}</span>`;
      btn.addEventListener('click', () => {
        void toggleVoice(ch.id);
      });
      voiceList.appendChild(btn);
    });
  }

  async function toggleVoice(channelId) {
    const active = getActiveVoiceChannel();
    if (active?.groupId === group.id && active?.channelId === channelId && isInVoiceChannel()) {
      await leaveVoiceChannel();
      joinedVoiceId = null;
      voiceStages.forEach((s) => s.refresh());
      refreshSidebar();
      return;
    }
    await joinVoiceChannel(group.id, channelId, api, config);
    joinedVoiceId = channelId;
    const stage = ensureVoiceStage(channelId);
    stage.refresh();
    refreshSidebar();
  }

  const onVoiceState = () => refreshSidebar();
  const onAvatarChange = (e) => {
    if (String(e.detail?.groupId) !== String(group.id)) return;
    avatarBtn.innerHTML = '';
    avatarBtn.appendChild(createGroupAvatarElement(group.id, 3));
  };

  window.addEventListener('blip-voice-channel-state', onVoiceState);
  window.addEventListener('blip-group-avatar-changed', onAvatarChange);

  refreshSidebar();

  return {
    el: root,
    renderMessages: () => chat.renderMessages(),
    handleIncoming: (msg) => chat.handleIncoming(msg),
    updateGroup(next) {
      group.hostId = next.hostId;
      group.members = next.members;
      if (next.name != null) group.name = next.name;
      if (next.channels) group.channels = next.channels;
      sideTitle.textContent = groupDisplayName(group);
      chat.updateGroup(next);
      refreshSidebar();
    },
    refreshChannels: refreshSidebar,
    destroy() {
      window.removeEventListener('blip-voice-channel-state', onVoiceState);
      window.removeEventListener('blip-group-avatar-changed', onAvatarChange);
      chat.destroy?.();
      voiceStages.forEach((s) => s.destroy());
      voiceStages.clear();
    },
  };
}
