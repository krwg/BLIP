import { t } from './i18n.js';
import { sounds } from './audio.js';
import { appendLinkifiedText } from './linkify.js';
import { attachEmojiPicker } from './emoji-picker.js';
import { createMessageId } from './message-id.js';
import { addGroupMessage, getGroupMessages, groupDisplayName, amHost } from './groups.js';

function formatChatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function createGroupChatView(group, config, onSend, onBack, onGroupCall) {
  const wrap = document.createElement('div');
  wrap.className = 'chat-view group-chat-view';

  const header = document.createElement('div');
  header.className = 'chat-header glass';

  if (onBack) {
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn-accent chat-back-btn';
    backBtn.textContent = '←';
    backBtn.addEventListener('click', onBack);
    header.appendChild(backBtn);
  }

  const meta = document.createElement('div');
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

  const callBtn = document.createElement('button');
  callBtn.type = 'button';
  callBtn.className = 'btn btn-accent';
  callBtn.dataset.i18n = 'group.call';
  callBtn.textContent = t('group.call');
  callBtn.addEventListener('click', () => onGroupCall?.(group.id));
  header.appendChild(callBtn);

  const messagesEl = document.createElement('div');
  messagesEl.className = 'chat-messages glass';

  const inputRow = document.createElement('div');
  inputRow.className = 'chat-input-row';

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

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    const msg = {
      id: createMessageId(),
      from: config.blipId,
      text,
      timestamp: Date.now(),
      outgoing: true,
    };
    addGroupMessage(group.id, msg);
    renderMessages();
    sounds.messageSent();
    await onSend?.(group.id, msg);
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  inputRow.appendChild(emojiBtn);
  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);

  wrap.appendChild(header);
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
      const block = document.createElement('div');
      const mine = Number(m.from) === Number(config.blipId);
      block.className = `chat-block ${mine ? 'outgoing' : 'incoming'}`;
      const who = document.createElement('span');
      who.className = 'group-msg-from';
      who.textContent = mine ? t('group.you') : `#${m.from}`;
      const text = document.createElement('span');
      text.className = 'chat-text';
      appendLinkifiedText(text, m.text, (url) => window.blip?.openExternal?.(url));
      block.appendChild(who);
      block.appendChild(text);
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
      addGroupMessage(group.id, { ...msg, outgoing: false });
      renderMessages();
      sounds.messageReceived();
    },
    updateGroup(g) {
      group.hostId = g.hostId;
      group.members = g.members;
      group.name = g.name;
      name.textContent = groupDisplayName(group);
      const hostLabel2 = amHost(group, config.blipId)
        ? t('group.you_host')
        : t('group.host_line').replace('{id}', String(group.hostId));
      sub.textContent = `${t('group.members')}: ${group.members.length} · ${hostLabel2}`;
    },
  };
}
