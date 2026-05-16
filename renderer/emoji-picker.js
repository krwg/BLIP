const EMOJI_ROWS = [
  '😀😃😄😁😅😂🤣😊😇🙂',
  '😉😌😍🥰😘😗😙😚😋😛',
  '😜🤪😝🤑🤗🤭🤫🤔🤐🤨',
  '😐😑😶😏😒🙄😬🤥😌😔',
  '👍👎👊✊🤝🙏💪🔥✨⭐',
  '❤️🧡💛💚💙💜🖤💔❣️💕',
  '🎉🎊🎈🎁🏆🎮🎵🎧📎📷',
];

/**
 * @param {HTMLElement} anchorBtn
 * @param {HTMLInputElement} input
 */
export function attachEmojiPicker(anchorBtn, input) {
  let panel = null;

  function close() {
    panel?.remove();
    panel = null;
  }

  anchorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel) {
      close();
      return;
    }

    panel = document.createElement('div');
    panel.className = 'emoji-picker glass';

    for (const row of EMOJI_ROWS) {
      const rowEl = document.createElement('div');
      rowEl.className = 'emoji-picker-row';
      for (const ch of row) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'emoji-picker-btn';
        btn.textContent = ch;
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const start = input.selectionStart ?? input.value.length;
          const end = input.selectionEnd ?? start;
          const v = input.value;
          input.value = v.slice(0, start) + ch + v.slice(end);
          const pos = start + ch.length;
          input.setSelectionRange(pos, pos);
          input.focus();
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        rowEl.appendChild(btn);
      }
      panel.appendChild(rowEl);
    }

    const rect = anchorBtn.getBoundingClientRect();
    panel.style.position = 'fixed';
    panel.style.left = `${Math.max(8, rect.left - 200)}px`;
    panel.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    panel.style.zIndex = '600';
    document.body.appendChild(panel);

    setTimeout(() => {
      document.addEventListener('click', close, { once: true });
    }, 0);
  });
}
