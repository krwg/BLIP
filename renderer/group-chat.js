import { t } from './i18n.js';
import { sounds } from './audio.js';
import { appendLinkifiedText } from './linkify.js';
import { attachEmojiPicker } from './emoji-picker.js';
import {
  encodeChatImageAttachment,
  encodeInlineFileAttachment,
  isImageFile,
  validateChatFile,
  INLINE_FILE_BYTES,
} from './chat-attachments.js';
import { formatFileSize } from './file-transfer.js';
import { createMessageId } from './message-id.js';
import { addGroupMessage, getGroupMessages, groupDisplayName, amHost } from './groups.js';
import { getOngoingGroupCall, isInGroupCall, getActiveGroupCallId } from './group-call.js';

function formatChatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function appendFileCard(block, attachment) {
  const card = document.createElement("div");
  card.className = 'chat-file-card';
  const label = document.createElement('span');
  label.className = 'chat-file-name';
  label.textContent = attachment.name || 'file';
  const meta = document.createElement('span');
  meta.className = 'chat-file-meta';
  meta.textContent = formatFileSize(attachment.size);
  card.appendChild(label);
  card.appendChild(meta);
  if (attachment.dataUrl) {
    const dl = document.createElement('a');
    dl.className = 'btn btn-lang chat-file-dl';
    dl.href = attachment.dataUrl;
    dl.download = attachment.name || 'download';
    dl.textContent = t('chat.file_download');
    card.appendChild(dl);
  }
  block.appendChild(card);
}

export function createGroupChatView(group, config, onSend, onBack, onGroupCall, onGroupMenu, onJoinOngoingCall) {
  const wrap = document.createElement('div');
  wrap.className = 'chat-view group-chat-view';

  const header = document.createElement("div");
  header.className = 'chat-header glass';

  if (onBack) {
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn-accent chat-back-btn';
    backBtn.textContent = '←';
    backBtn.addEventListener('click', onBack);
    header.appendChild(backBtn);
  }

  const meta = document.createElement("div");
  meta.className = 'chat-peer-meta';
  const name = document.createElement('span');
  name.className = 'chat-peer-name';
  name.textContent = groupDisplayName(group);
  const sub = document.createElement('span');
  sub.className = 'chat-peer-id';
  const hostLabel = amHost(group, config.blipId) ? t('group.you_host') : t('group.host_line').replace('{id}', String(group.hostId));
  sub.textContent = `${t('group.members')}: ${group.members.length} · ${hostLabel}`;
  meta.appendChild(name);
  meta.appendChild(sub);
  header.appendChild(meta);

  if (onGroupMenu) {
    const openMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      onGroupMenu(e, group);
    };
    header.addEventListener('contextmenu', openMenu);
    meta.addEventListener('contextmenu', openMenu);
    name.addEventListener('contextmenu', openMenu);
  }

  const callBtn = document.createElement('button');
  callBtn.type = 'button';
  callBtn.className = 'btn btn-accent';
  callBtn.dataset.i18n = 'group.call';
  callBtn.textContent = t('group.call');
  callBtn.addEventListener('click', () => onGroupCall?.(group.id));
  header.appendChild(callBtn);

  const ongoingBar = document.createElement('div');
  ongoingBar.className = 'group-call-ongoing glass hidden';
  const ongoingPulse = document.createElement('span');
  ongoingPulse.className = 'group-call-ongoing-pulse';
  const ongoingText = document.createElement('span');
  ongoingText.className = 'group-call-ongoing-text';
  const ongoingJoin = document.createElement('button');
  ongoingJoin.type = 'button';
  ongoingJoin.className = 'btn btn-accent group-call-ongoing-join';
  ongoingJoin.dataset.i18n = 'group.join_call';
  ongoingJoin.textContent = t('group.join_call');
  ongoingJoin.addEventListener('click', () => onJoinOngoingCall?.(group.id));
  ongoingBar.appendChild(ongoingPulse);
  ongoingBar.appendChild(ongoingText);
  ongoingBar.appendChild(ongoingJoin);

  const messagesEl = document.createElement('div');
  messagesEl.className = 'chat-messages glass';

  const inputRow = document.createElement("div");
  inputRow.className = 'chat-input-row';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.className = 'chat-attach-input';
  fileInput.hidden = true;

  const fileBtn = document.createElement('button');
  fileBtn.type = 'button';
  fileBtn.className = 'btn btn-accent chat-tool-btn chat-file-btn';
  fileBtn.title = t('chat.attach_file');
  fileBtn.dataset.i18n = 'chat.file_btn';
  fileBtn.textContent = t('chat.file_btn');
  fileBtn.addEventListener('click', () => fileInput.click());

  const emojiBtn = document.createElement('button');
  emojiBtn.type = 'button';
  emojiBtn.className = 'btn btn-lang chat-tool-btn';
  emojiBtn.textContent = t('chat.emoji_btn');

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input chat-text-input';
  input.maxLength = 2000;
  input.placeholder = t('chat.input_placeholder');
  attachEmojiPicker(emojiBtn, input);

  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = 'btn btn-accent';
  sendBtn.textContent = t('chat.send');

  async function publish(msg) {
    addGroupMessage(group.id, msg);
    renderMessages();
    sounds.messageSent();
    await onSend?.(group.id, msg);
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await publish({
      id: createMessageId(),
      from: config.blipId,
      text,
      timestamp: Date.now(),
      outgoing: true,
    });
  }

  async function sendAttachment(file) {
    if (!file) return;
    try {
      let attachment;
      let text;
      if (isImageFile(file)) {
        attachment = await encodeChatImageAttachment(file);
        text = t('chat.image_sent');
      } else {
        if (file.size > INLINE_FILE_BYTES) {
          alert(t('chat.group_file_limit'));
          return;
        }
        validateChatFile(file);
        attachment = await encodeInlineFileAttachment(file);
        text = t('chat.file_sent');
      }
      await publish({
        id: createMessageId(),
        from: config.blipId,
        text,
        timestamp: Date.now(),
        outgoing: true,
        attachment,
      });
    } catch (err) {
      const key =
        err?.message === 'file_too_big' || err?.message === 'use_chunked'
          ? 'chat.group_file_limit'
          : 'chat.attach_failed';
      alert(t(key));
    }
  }

  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    await sendAttachment(f);
  });

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  inputRow.appendChild(fileBtn);
  inputRow.appendChild(emojiBtn);
  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  inputRow.appendChild(fileInput);

  function refreshOngoingBar() {
    const snap = getOngoingGroupCall(group.id);
    const inThisCall = isInGroupCall() && activeGroupMatches();
    if (!snap.active || snap.count === 0 || inThisCall) {
      ongoingBar.classList.add('hidden');
      return;
    }
    ongoingBar.classList.remove('hidden');
    ongoingText.textContent = t('group.call_ongoing_bar').replace('{n}', String(snap.count));
  }

  function activeGroupMatches() {
    return getActiveGroupCallId() === group.id;
  }

  const onCallState = (ev) => {
    if (ev.detail?.groupId === group.id) refreshOngoingBar();
  };
  window.addEventListener('blip-group-call-state', onCallState);
  refreshOngoingBar();

  wrap.appendChild(header);
  wrap.appendChild(ongoingBar);
  wrap.appendChild(messagesEl);
  wrap.appendChild(inputRow);

  function renderMessages() {
    const msgs = getGroupMessages(group.id);
    messagesEl.innerHTML = '';
    if (!msgs.length) {
      const p = document.createElement('p');
      p.className = 'chat-empty';
      p.textContent = t('chat.empty');
      messagesEl.appendChild(p);
      return;
    }
    msgs.forEach((m) => {
      const block = document.createElement("div");
      const mine = Number(m.from) === Number(config.blipId);
      block.className = `chat-block ${mine ? 'outgoing' : 'incoming'}`;
      const who = document.createElement('span');
      who.className = 'group-msg-from';
      who.textContent = mine ? t('group.you') : `#${m.from}`;
      block.appendChild(who);
      if (m.attachment?.kind === 'image' && m.attachment.dataUrl) {
        const img = document.createElement('img');
        img.className = 'chat-image';
        img.src = m.attachment.dataUrl;
        img.alt = m.attachment.name || 'image';
        img.loading = 'lazy';
        block.appendChild(img);
      } else if (m.attachment?.kind === 'file') {
        appendFileCard(block, m.attachment);
      }
      if (m.text) {
        const text = document.createElement('span');
        text.className = 'chat-text';
        appendLinkifiedText(text, m.text, (url) => window.blip?.openExternal?.(url));
        block.appendChild(text);
      }
      if (m.timestamp) {
        const time = document.createElement('span');
        time.className = 'chat-time';
        time.textContent = formatChatTime(m.timestamp);
        block.appendChild(time);
      }
      messagesEl.appendChild(block);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  renderMessages();

  return {
    el: wrap,
    renderMessages,
    handleIncoming(msg) {
      const stored = addGroupMessage(group.id, { ...msg, outgoing: false });
      if (!stored) return;
      renderMessages();
      sounds.messageReceived();
    },
    updateGroup(next) {
      group.hostId = next.hostId;
      group.members = next.members;
      sub.textContent = `${t('group.members')}: ${group.members.length} · ${
        amHost(group, config.blipId) ? t('group.you_host') : t('group.host_line').replace('{id}', String(group.hostId))
      }`;
      refreshOngoingBar();
    },
    refreshOngoingCall: refreshOngoingBar,
    destroy() {
      window.removeEventListener('blip-group-call-state', onCallState);
    },
  };
}
