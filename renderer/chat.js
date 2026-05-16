import { t } from './i18n.js';
import { sounds } from './audio.js';
import { createAvatarElement } from './avatar.js';

const STORAGE_KEY = 'blip_chat_v1';
const MAX_PER_PEER = 500;

const messagesByPeer = new Map();

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    for (const [k, arr] of Object.entries(o)) {
      const id = Number(k);
      if (Number.isFinite(id) && Array.isArray(arr)) {
        messagesByPeer.set(id, arr.slice(-MAX_PER_PEER));
      }
    }
  } catch (e) {
    console.warn('[BLIP chat] load history', e);
  }
}

function persist() {
  try {
    const o = {};
    for (const [k, msgs] of messagesByPeer) {
      o[k] = msgs.slice(-MAX_PER_PEER);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
  } catch (e) {
    console.warn('[BLIP chat] persist', e);
  }
}

loadFromStorage();

function formatChatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function getMessages(peerId) {
  if (!messagesByPeer.has(peerId)) messagesByPeer.set(peerId, []);
  return messagesByPeer.get(peerId);
}

export function addMessage(peerId, msg) {
  const list = getMessages(peerId);
  list.push(msg);
  persist();
  return list;
}

export function clearPeerMessages(peerId) {
  messagesByPeer.delete(peerId);
  persist();
}

export function exportPeerChat(peerId, displayName) {
  const msgs = getMessages(peerId);
  const label = displayName || `BLIP-${peerId}`;
  const lines = msgs.map((m) => {
    const who = m.outgoing ? 'You' : label;
    const time = new Date(m.timestamp || Date.now()).toLocaleString();
    return `[${time}] ${who}: ${m.text}`;
  });
  const body = lines.length ? `${lines.join('\n')}\n` : '';
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `blip-${peerId}-chat.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function createChatView(peerId, config, onSend, onBack, onTyping) {
  const wrap = document.createElement('div');
  wrap.className = 'chat-view';

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

  const avatarMount = document.createElement('div');
  avatarMount.className = 'chat-avatar-mount';
  function mountHeaderAvatar() {
    avatarMount.innerHTML = '';
    avatarMount.appendChild(
      createAvatarElement(peerId, 3, { selfBlipId: config?.blipId ?? null })
    );
  }
  mountHeaderAvatar();
  const meta = document.createElement('div');
  meta.className = 'chat-peer-meta';
  const name = document.createElement('span');
  name.className = 'chat-peer-name';
  name.textContent = `BLIP-${peerId}`;
  const idLabel = document.createElement('span');
  idLabel.className = 'chat-peer-id';
  idLabel.textContent = `#${peerId}`;
  meta.appendChild(name);
  meta.appendChild(idLabel);
  header.appendChild(avatarMount);
  header.appendChild(meta);

  const headActions = document.createElement('div');
  headActions.className = 'chat-header-actions';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'input chat-search-input';
  searchInput.maxLength = 120;
  searchInput.placeholder = t('chat.search_placeholder');
  searchInput.dataset.i18nPlaceholder = 'chat.search_placeholder';
  let searchQuery = '';
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    renderMessages();
  });

  const menuWrap = document.createElement('div');
  menuWrap.className = 'chat-menu-wrap';

  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'btn btn-lang chat-menu-btn';
  menuBtn.setAttribute('aria-label', t('chat.menu'));
  menuBtn.title = t('chat.menu');
  menuBtn.textContent = '⋮';

  const menu = document.createElement('div');
  menu.className = 'chat-menu-dropdown hidden';

  const exportItem = document.createElement('button');
  exportItem.type = 'button';
  exportItem.className = 'chat-menu-item';
  exportItem.dataset.i18n = 'chat.export';
  exportItem.textContent = t('chat.export');
  exportItem.addEventListener('click', () => {
    menu.classList.add('hidden');
    exportPeerChat(peerId, name.textContent);
  });

  const clearItem = document.createElement('button');
  clearItem.type = 'button';
  clearItem.className = 'chat-menu-item chat-menu-item--danger';
  clearItem.dataset.i18n = 'chat.clear';
  clearItem.textContent = t('chat.clear');
  clearItem.addEventListener('click', () => {
    menu.classList.add('hidden');
    if (!confirm(t('chat.clear_confirm'))) return;
    clearPeerMessages(peerId);
    renderMessages();
  });

  menu.appendChild(exportItem);
  menu.appendChild(clearItem);
  menuWrap.appendChild(menuBtn);
  menuWrap.appendChild(menu);

  function closeMenu() {
    menu.classList.add('hidden');
    if (menu.parentElement === document.body) {
      menuWrap.appendChild(menu);
      menu.style.position = '';
      menu.style.top = '';
      menu.style.right = '';
      menu.style.left = '';
      menu.style.zIndex = '';
    }
  }

  function openMenu() {
    menu.classList.remove('hidden');
    document.body.appendChild(menu);
    const rect = menuBtn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    menu.style.left = 'auto';
    menu.style.zIndex = '500';
    requestAnimationFrame(() => {
      document.addEventListener('click', closeMenu, { once: true });
    });
  }

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.classList.contains('hidden')) openMenu();
    else closeMenu();
  });

  headActions.appendChild(searchInput);
  headActions.appendChild(menuWrap);
  header.appendChild(headActions);

  const messagesEl = document.createElement('div');
  messagesEl.className = 'chat-messages glass';

  const empty = document.createElement('p');
  empty.className = 'chat-empty';
  empty.dataset.i18n = 'chat.empty';
  empty.textContent = t('chat.empty');
  messagesEl.appendChild(empty);

  const typingBar = document.createElement('div');
  typingBar.className = 'chat-typing hidden';
  const typingDots = document.createElement('span');
  typingDots.className = 'chat-typing-dots';
  typingDots.setAttribute('aria-hidden', 'true');
  typingDots.textContent = '···';
  const typingText = document.createElement('span');
  typingText.className = 'chat-typing-text';
  typingBar.appendChild(typingDots);
  typingBar.appendChild(typingText);

  const inputRow = document.createElement('div');
  inputRow.className = 'chat-input-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input';
  input.maxLength = 2000;
  input.placeholder = t('chat.input_placeholder');
  input.dataset.i18nPlaceholder = 'chat.input_placeholder';

  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = 'btn btn-accent';
  sendBtn.dataset.i18n = 'chat.send';
  sendBtn.textContent = t('chat.send');

  let typingEmitTimer = null;
  let typingStopTimer = null;
  let lastTypingEmit = 0;

  function emitTyping(active) {
    onTyping?.(peerId, active);
  }

  function stopTypingSignal() {
    clearTimeout(typingEmitTimer);
    clearTimeout(typingStopTimer);
    typingEmitTimer = null;
    typingStopTimer = null;
    if (lastTypingEmit) {
      lastTypingEmit = 0;
      emitTyping(false);
    }
  }

  function onInputTyping() {
    const text = input.value.trim();
    if (!text) {
      stopTypingSignal();
      return;
    }
    const now = Date.now();
    if (!lastTypingEmit || now - lastTypingEmit > 1800) {
      lastTypingEmit = now;
      emitTyping(true);
    }
    clearTimeout(typingStopTimer);
    typingStopTimer = setTimeout(() => {
      lastTypingEmit = 0;
      emitTyping(false);
    }, 2800);
  }

  let hideTypingUiTimer = null;

  function setTyping(active, displayName) {
    clearTimeout(hideTypingUiTimer);
    if (!active) {
      typingBar.classList.add('hidden');
      return;
    }
    const label = displayName || `BLIP-${peerId}`;
    typingText.textContent = t('chat.typing').replace('{name}', label);
    typingBar.classList.remove('hidden');
    hideTypingUiTimer = setTimeout(() => {
      typingBar.classList.add('hidden');
    }, 4500);
  }

  async function send() {
    stopTypingSignal();
    const text = input.value.trim();
    if (!text) return;
    const msg = {
      from: config.blipId,
      to: peerId,
      text,
      timestamp: Date.now(),
      outgoing: true,
    };
    addMessage(peerId, msg);
    renderMessages();
    input.value = '';
    sounds.messageSent();
    const result = await onSend?.(peerId, text);
    if (!result?.ok) {
      const list = getMessages(peerId);
      const last = list.pop();
      if (last === msg) persist();
      renderMessages();
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('input', onInputTyping);
  input.addEventListener('blur', stopTypingSignal);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);

  wrap.appendChild(header);
  wrap.appendChild(messagesEl);
  wrap.appendChild(typingBar);
  wrap.appendChild(inputRow);

  function renderMessages() {
    const msgs = getMessages(peerId).filter((m) => {
      if (!searchQuery) return true;
      return String(m.text || '').toLowerCase().includes(searchQuery);
    });

    const hasFocus = document.activeElement === input;
    const cursorPos = hasFocus ? input.selectionStart : null;

    const scrollPos = messagesEl.scrollTop;
    const nearBottom =
      messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;

    messagesEl.innerHTML = '';
    if (msgs.length === 0) {
      const p = document.createElement('p');
      p.className = 'chat-empty';
      p.textContent = searchQuery ? t('chat.search_empty') : t('chat.empty');
      messagesEl.appendChild(p);
      if (hasFocus) {
        requestAnimationFrame(() => {
          input.focus();
          if (cursorPos !== null) input.setSelectionRange(cursorPos, cursorPos);
        });
      }
      return;
    }
    msgs.forEach((m) => {
      const block = document.createElement('div');
      block.className = `chat-block ${m.outgoing ? 'outgoing' : 'incoming'}`;
      const text = document.createElement('span');
      text.className = 'chat-text';
      text.textContent = m.text;
      block.appendChild(text);
      if (m.timestamp) {
        const time = document.createElement('span');
        time.className = 'chat-time';
        time.textContent = formatChatTime(m.timestamp);
        time.title = new Date(m.timestamp).toLocaleString();
        block.appendChild(time);
      }
      messagesEl.appendChild(block);
    });

    if (hasFocus) {
      requestAnimationFrame(() => {
        input.focus();
        if (cursorPos !== null) input.setSelectionRange(cursorPos, cursorPos);
      });
    }

    if (nearBottom || !hasFocus) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else {
      messagesEl.scrollTop = scrollPos;
    }
  }

  function flashNew() {
    messagesEl.classList.remove('flash');
    void messagesEl.offsetWidth;
    messagesEl.classList.add('flash');
  }

  renderMessages();

  return {
    el: wrap,
    renderMessages,
    flashNew,
    setPeerName(displayName) {
      name.textContent = displayName || `BLIP-${peerId}`;
    },
    refreshHeaderAvatar() {
      mountHeaderAvatar();
    },
    handleIncoming(msg) {
      setTyping(false);
      addMessage(peerId, { ...msg, outgoing: false });
      renderMessages();
      flashNew();
      sounds.messageReceived();
    },
    setTyping,
  };
}
