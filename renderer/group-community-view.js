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
  broadcastGroupAvatarToMembers,
  requestGroupAvatarsFromMembers,
} from './group-avatar.js';
import { openAvatarCropDialog } from './avatar-crop-dialog.js';
import { showAppToast } from './toasts.js';

function iconBtn(className, glyph, ariaKey) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = glyph;
  if (ariaKey) {
    btn.setAttribute('aria-label', t(ariaKey));
    btn.title = t(ariaKey);
  }
  return btn;
}

function buildNavSection(labelKey, listEl, startOpen = true) {
  const section = document.createElement('div');
  section.className = 'group-nav-section';
  if (startOpen) section.classList.add('group-nav-section--open');

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'group-nav-section-head';
  head.setAttribute('aria-expanded', startOpen ? 'true' : 'false');

  const chevron = document.createElement('span');
  chevron.className = 'group-nav-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '▾';

  const label = document.createElement('span');
  label.className = 'group-nav-section-label';
  label.dataset.i18n = labelKey;
  label.textContent = t(labelKey);

  head.appendChild(chevron);
  head.appendChild(label);

  const body = document.createElement('div');
  body.className = 'group-nav-section-body';
  body.appendChild(listEl);

  head.addEventListener('click', () => {
    const open = section.classList.toggle('group-nav-section--open');
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  section.appendChild(head);
  section.appendChild(body);
  return section;
}

function buildChannelBtn(ch, label, opts = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = opts.className || 'group-channel-btn';
  if (opts.channelType) btn.dataset.channelType = opts.channelType;

  const icon = document.createElement('span');
  icon.className = 'group-channel-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = channelIcon(ch);

  const name = document.createElement('span');
  name.className = 'group-channel-name';
  name.textContent = label;
  if (opts.nameI18n) name.dataset.i18n = opts.nameI18n;

  btn.appendChild(icon);
  btn.appendChild(name);

  if (opts.badge != null) {
    const badge = document.createElement('span');
    badge.className = `group-channel-badge${opts.badgeLive ? ' group-channel-badge--live' : ''}`;
    badge.textContent = String(opts.badge);
    btn.appendChild(badge);
  }

  return btn;
}

function channelNameI18nKey(ch) {
  if (!ch) return null;
  if (ch.id === 'text-general' || ch.name === 'general') return 'voice.channel_general';
  if (ch.type === 'voice' && (ch.id === 'voice-lounge' || ch.name === 'voice' || ch.name === 'lounge')) {
    return 'voice.channel_name';
  }
  return null;
}

export function createGroupCommunityView(
  group,
  config,
  onSend,
  onBack,
  onGroupMenu,
  onSendFile,
  api,
  chatOpts = {}
) {
  const root = document.createElement('div');
  root.className = 'group-community';

  const rail = document.createElement('aside');
  rail.className = 'group-rail glass';

  const railToolbar = document.createElement('div');
  railToolbar.className = 'group-rail-toolbar';

  if (onBack) {
    const backBtn = iconBtn('btn btn-lang group-rail-icon-btn', '←', 'group.sidebar_back');
    backBtn.addEventListener('click', onBack);
    railToolbar.appendChild(backBtn);
  } else {
    const spacer = document.createElement('span');
    spacer.className = 'group-rail-toolbar-spacer';
    railToolbar.appendChild(spacer);
  }

  if (onGroupMenu) {
    const menuBtn = iconBtn('btn btn-lang group-rail-icon-btn group-rail-menu-btn', '⋯', 'group.sidebar_menu');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = menuBtn.getBoundingClientRect();
      onGroupMenu(
        {
          clientX: rect.right,
          clientY: rect.bottom + 4,
          preventDefault: () => {},
          stopPropagation: () => {},
        },
        group
      );
    });
    railToolbar.appendChild(menuBtn);
  }

  const railHead = document.createElement('div');
  railHead.className = 'group-rail-head';

  const avatarFile = document.createElement('input');
  avatarFile.type = 'file';
  avatarFile.accept = 'image/png,image/jpeg,image/webp';
  avatarFile.hidden = true;

  const avatarBtn = document.createElement('button');
  avatarBtn.type = 'button';
  avatarBtn.className = 'group-rail-avatar-btn';
  avatarBtn.title = t('group.avatar_change');
  avatarBtn.setAttribute('aria-label', t('group.avatar_change'));
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
    void broadcastGroupAvatarToMembers(group.id, api, config.blipId);
  });

  const identity = document.createElement('div');
  identity.className = 'group-rail-identity';

  const sideTitle = document.createElement('h2');
  sideTitle.className = 'group-rail-title';
  sideTitle.textContent = groupDisplayName(group);

  const sideSub = document.createElement('p');
  sideSub.className = 'group-rail-sub';

  const membersLine = document.createElement('span');
  membersLine.className = 'group-rail-members';
  membersLine.textContent = t('group.sidebar_members').replace('{n}', String(group.members.length));

  const hostLine = document.createElement('span');
  hostLine.className = 'group-rail-host';
  hostLine.textContent = amHost(group, config.blipId)
    ? t('group.you_host')
    : t('group.host_line').replace('{id}', String(group.hostId));

  sideSub.appendChild(membersLine);
  sideSub.appendChild(document.createTextNode(' · '));
  sideSub.appendChild(hostLine);

  identity.appendChild(sideTitle);
  identity.appendChild(sideSub);
  railHead.appendChild(avatarBtn);
  railHead.appendChild(identity);

  const betaChip = document.createElement('button');
  betaChip.type = 'button';
  betaChip.className = 'group-rail-beta';
  betaChip.dataset.i18n = 'group.unstable_short';
  betaChip.textContent = t('group.unstable_short');
  betaChip.title = t('group.unstable_title');
  betaChip.addEventListener('click', () => {
    showAppToast({
      title: t('group.unstable_title'),
      body: t('group.unstable_body'),
      durationMs: 14000,
    });
  });

  const railNav = document.createElement('div');
  railNav.className = 'group-rail-nav';

  const textList = document.createElement('div');
  textList.className = 'group-channel-list';
  textList.setAttribute('role', 'list');

  const voiceList = document.createElement('div');
  voiceList.className = 'group-channel-list';
  voiceList.setAttribute('role', 'list');

  railNav.appendChild(buildNavSection('voice.section_chats', textList, true));
  railNav.appendChild(buildNavSection('voice.section_voice', voiceList, true));

  rail.appendChild(railToolbar);
  rail.appendChild(railHead);
  rail.appendChild(betaChip);
  rail.appendChild(railNav);
  rail.appendChild(avatarFile);

  const main = document.createElement('div');
  main.className = 'group-main';

  const stack = document.createElement('div');
  stack.className = 'group-main-stack';

  const chatPane = document.createElement('div');
  chatPane.className = 'group-main-chat glass';

  let activeTextId = getTextChannels(group)[0]?.id || 'text-general';
  const voiceStages = new Map();

  const chat = createGroupChatView(
    group,
    config,
    onSend,
    null,
    null,
    onGroupMenu,
    null,
    onSendFile,
    chatOpts
  );
  chat.el.classList.add('group-community-chat');
  chat.el.querySelector('.group-call-ongoing')?.remove();
  chat.el.querySelector('.chat-header .btn-accent')?.remove();

  const header = chat.el.querySelector('.chat-header');
  const meta = chat.el.querySelector('.chat-peer-meta');
  chat.el.querySelector('.chat-peer-name')?.remove();
  chat.el.querySelector('.chat-peer-id')?.remove();
  if (header) header.classList.add('group-community-chat-header');

  const channelPill = document.createElement('span');
  channelPill.className = 'group-chat-channel-pill';
  if (meta) {
    meta.innerHTML = '';
    meta.appendChild(channelPill);
  }

  chatPane.appendChild(chat.el);
  stack.appendChild(chatPane);
  main.appendChild(stack);
  root.appendChild(rail);
  root.appendChild(main);

  function updateChannelPill() {
    const ch = getTextChannels(group).find((c) => c.id === activeTextId);
    const key = channelNameI18nKey(ch);
    if (key) {
      channelPill.dataset.i18n = key;
      channelPill.textContent = t(key);
    } else {
      channelPill.removeAttribute('data-i18n');
      channelPill.textContent = ch ? formatChannelLabel(ch) : '';
    }
    channelPill.classList.toggle('hidden', !ch);
  }

  function ensureVoiceStage(channelId) {
    if (!voiceStages.has(channelId)) {
      const stage = createVoiceStage(config, group.id, channelId);
      voiceStages.set(channelId, stage);
      stack.insertBefore(stage.el, chatPane);
    }
    return voiceStages.get(channelId);
  }

  function refreshRail() {
    textList.innerHTML = '';
    voiceList.innerHTML = '';
    sideTitle.textContent = groupDisplayName(group);
    membersLine.textContent = t('group.sidebar_members').replace('{n}', String(group.members.length));
    hostLine.textContent = amHost(group, config.blipId)
      ? t('group.you_host')
      : t('group.host_line').replace('{id}', String(group.hostId));

    getTextChannels(group).forEach((ch) => {
      const btn = buildChannelBtn(ch, formatChannelLabel(ch), {
        channelType: 'text',
        nameI18n: channelNameI18nKey(ch),
      });
      if (ch.id === activeTextId) btn.classList.add('group-channel-btn--active');
      btn.addEventListener('click', () => {
        activeTextId = ch.id;
        refreshRail();
      });
      textList.appendChild(btn);
    });

    getVoiceChannels(group).forEach((ch) => {
      const active = getActiveVoiceChannel();
      const inCh =
        active?.groupId === group.id && active?.channelId === ch.id && isInVoiceChannel();
      const snap = getVoiceChannelRoster(group.id, ch.id);
      const count = snap.count || 0;
      const btn = buildChannelBtn(ch, formatChannelLabel(ch), {
        className: 'group-channel-btn group-channel-btn--voice',
        channelType: 'voice',
        nameI18n: channelNameI18nKey(ch),
        badge: count,
        badgeLive: count > 0,
      });
      if (inCh) btn.classList.add('group-channel-btn--live', 'group-channel-btn--active');
      btn.addEventListener('click', () => {
        void toggleVoice(ch.id);
      });
      voiceList.appendChild(btn);
    });

    updateChannelPill();
    voiceStages.forEach((s) => s.refresh());
  }

  async function toggleVoice(channelId) {
    const active = getActiveVoiceChannel();
    if (active?.groupId === group.id && active?.channelId === channelId && isInVoiceChannel()) {
      await leaveVoiceChannel();
      voiceStages.forEach((s) => s.refresh());
      refreshRail();
      return;
    }
    await joinVoiceChannel(group.id, channelId, api, config);
    const stage = ensureVoiceStage(channelId);
    stage.refresh();
    refreshRail();
  }

  const onVoiceState = () => refreshRail();
  const onAvatarChange = (e) => {
    if (String(e.detail?.groupId) !== String(group.id)) return;
    avatarBtn.innerHTML = '';
    avatarBtn.appendChild(createGroupAvatarElement(group.id, 3));
  };
  const onLangChange = () => refreshRail();

  window.addEventListener('blip-voice-channel-state', onVoiceState);
  window.addEventListener('blip-group-avatar-changed', onAvatarChange);
  window.addEventListener('blip-lang-change', onLangChange);

  refreshRail();
  void requestGroupAvatarsFromMembers(group.id, api, config.blipId);

  return {
    el: root,
    renderMessages: () => chat.renderMessages(),
    handleIncoming: (msg) => chat.handleIncoming(msg),
    handlePin: (msg) => chat.handlePin?.(msg),
    updateGroup(next) {
      group.hostId = next.hostId;
      group.members = next.members;
      if (next.name != null) group.name = next.name;
      if (next.channels) group.channels = next.channels;
      sideTitle.textContent = groupDisplayName(group);
      chat.updateGroup(next);
      refreshRail();
    },
    refreshChannels: refreshRail,
    destroy() {
      window.removeEventListener('blip-voice-channel-state', onVoiceState);
      window.removeEventListener('blip-group-avatar-changed', onAvatarChange);
      window.removeEventListener('blip-lang-change', onLangChange);
      chat.destroy?.();
      voiceStages.forEach((s) => s.destroy());
      voiceStages.clear();
    },
  };
}
