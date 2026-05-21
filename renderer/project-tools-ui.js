import { t } from './i18n.js';
import { createPixelHintIcon } from './settings-ui.js';
import { createBlipColorInput } from './blip-color-input.js';
import {
  getPadState,
  setPadState,
  getBoardState,
  setBoardState,
  getCanvasState,
  setCanvasPixel,
  notifyCanvasChanged,
  getClipState,
  pushClipEntry,
  removeClipEntry,
  subscribeGroupProject,
} from './group-projects-store.js';
import { openTextPromptDialog } from './prompt-dialog.js';
import { openConfirmDialog } from './confirm-dialog.js';
import { broadcastProject, requestClipboardPull } from './group-projects-wire.js';
import {
  broadcastMeshPad,
  broadcastMeshBoard,
  broadcastMeshCanvas,
  broadcastMeshClipboard,
  requestMeshClipboardPull,
} from './projects-mesh-wire.js';
import { clipLimitForTier } from './group-projects-store.js';
import {
  getPadHistory,
  pushPadSnapshot,
  getPadSnapshotById,
  deletePadSnapshot,
} from './pad-history-store.js';
import { createMessageId } from './message-id.js';

const CANVAS_QUICK_COLORS = [
  '#000000',
  '#1a1a1a',
  '#444444',
  '#888888',
  '#cccccc',
  '#ffffff',
  '#ff3366',
  '#ff8800',
  '#ffee00',
  '#88ff00',
  '#00ffc8',
  '#4488ff',
  '#8844ff',
  '#ff44cc',
  '#8b4513',
  '#2d5016',
];

const CANVAS_TOOLS = ['brush', 'bucket', 'eraser'];

function mkStatusBar() {
  const bar = document.createElement('div');
  bar.className = 'proj-status-bar';
  const dot = document.createElement('span');
  dot.className = 'proj-status-dot';
  const text = document.createElement('span');
  text.className = 'proj-status-text';
  bar.appendChild(dot);
  bar.appendChild(text);
  return { bar, dot, text };
}

/**
 * @param {{ id: string, members?: number[] }} group
 * @param {object} config
 * @param {object} api
 * @param {{ scopeId?: string, getBroadcastTargets?: () => number[] }} [meshOpts]
 */
export function createPadToolView(group, config, api, meshOpts = null) {
  const scopeId = meshOpts?.scopeId ?? group.id;
  const wrap = document.createElement('div');
  wrap.className = 'proj-tool proj-tool--pad';

  const ta = document.createElement('textarea');
  ta.className = 'proj-pad-editor input';
  ta.spellcheck = false;

  const status = mkStatusBar();
  let debounce = null;
  let applying = false;

  function syncStatus(synced, from, latencyMs = 0) {
    status.dot.classList.toggle('proj-status-dot--ok', synced);
    status.text.textContent = synced
      ? t('projects.pad_synced').replace('{ms}', String(latencyMs))
      : from
        ? t('projects.pad_editing').replace('{id}', String(from))
        : t('projects.pad_idle');
  }

  function applyRemote() {
    const st = getPadState(scopeId);
    applying = true;
    ta.value = st.text || '';
    applying = false;
    syncStatus(true, st.from, 0);
  }

  function pushLocal(opts = {}) {
    if (applying) return;
    const text = ta.value;
    const updatedAt = Date.now();
    const payload = { text, updatedAt };
    setPadState(scopeId, { ...payload, from: config.blipId });
    if (meshOpts?.getBroadcastTargets) {
      void broadcastMeshPad(api, config, meshOpts.getBroadcastTargets(), payload);
    } else {
      void broadcastProject(api, config, group, 'pad', payload);
    }
    if (meshOpts?.meshPlusActive && !opts.skipHistory) {
      pushPadSnapshot(scopeId, {
        text,
        updatedAt,
        from: config.blipId,
        label: opts.historyLabel || '',
      });
      renderHistory?.();
    }
    syncStatus(true, config.blipId, 0);
  }

  let renderHistory = null;

  ta.addEventListener('input', () => {
    clearTimeout(debounce);
    syncStatus(false, config.blipId, 0);
    debounce = setTimeout(() => pushLocal(), 300);
  });

  const unsub = subscribeGroupProject(scopeId, (tool) => {
    if (tool === 'pad') applyRemote();
  });

  applyRemote();

  if (meshOpts?.meshPlusActive) {
    const histWrap = document.createElement('div');
    histWrap.className = 'proj-pad-history';
    const histHead = document.createElement('div');
    histHead.className = 'proj-pad-history-head';
    const histTitle = document.createElement('span');
    histTitle.className = 'proj-pad-history-title';
    histTitle.dataset.i18n = 'projects.pad_history_title';
    histTitle.textContent = t('projects.pad_history_title');
    histHead.appendChild(histTitle);
    histHead.appendChild(createPixelHintIcon('projects.pad_history_hint'));
    const histList = document.createElement('div');
    histList.className = 'proj-pad-history-list';
    const histActions = document.createElement('div');
    histActions.className = 'proj-pad-history-actions';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-lang';
    saveBtn.dataset.i18n = 'projects.pad_history_save';
    saveBtn.textContent = t('projects.pad_history_save');
    saveBtn.addEventListener('click', () => {
      pushPadSnapshot(scopeId, {
        text: ta.value,
        updatedAt: Date.now(),
        from: config.blipId,
        label: t('projects.pad_history_manual'),
      });
      renderHistory();
    });

    renderHistory = () => {
      histList.innerHTML = '';
      const items = getPadHistory(scopeId);
      if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'hint';
        empty.dataset.i18n = 'projects.pad_history_empty';
        empty.textContent = t('projects.pad_history_empty');
        histList.appendChild(empty);
        return;
      }
      for (const item of items) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'proj-pad-history-item';
        const meta = document.createElement('span');
        meta.className = 'proj-pad-history-meta';
        const when = new Date(item.updatedAt).toLocaleString();
        meta.textContent = item.label
          ? `${item.label} · #${item.from}`
          : `#${item.from} · ${when}`;
        const preview = document.createElement('span');
        preview.className = 'proj-pad-history-preview';
        preview.textContent = item.text.slice(0, 120) + (item.text.length > 120 ? '…' : '');
        row.appendChild(meta);
        row.appendChild(preview);
        row.addEventListener('click', () => {
          const snap = getPadSnapshotById(scopeId, item.id);
          if (!snap) return;
          applying = true;
          ta.value = snap.text;
          applying = false;
          pushLocal({ historyLabel: t('projects.pad_history_restore') });
        });
        row.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          void (async () => {
            const ok = await openConfirmDialog({
              title: t('projects.pad_history_delete'),
              body: t('projects.pad_history_delete_confirm'),
            });
            if (!ok) return;
            if (deletePadSnapshot(scopeId, item.id)) renderHistory();
          })();
        });
        histList.appendChild(row);
      }
    };

    histActions.appendChild(saveBtn);
    histWrap.appendChild(histHead);
    histWrap.appendChild(histList);
    histWrap.appendChild(histActions);
    wrap.appendChild(ta);
    wrap.appendChild(status.bar);
    wrap.appendChild(histWrap);
    renderHistory();
  } else {
    wrap.appendChild(ta);
    wrap.appendChild(status.bar);
  }

  return {
    el: wrap,
    destroy() {
      clearTimeout(debounce);
      unsub();
    },
  };
}

export function createBoardToolView(group, config, api, meshOpts = null) {
  const scopeId = meshOpts?.scopeId ?? group.id;
  const wrap = document.createElement('div');
  wrap.className = 'proj-tool proj-tool--board';

  const cols = ['todo', 'progress', 'done'];
  const colEls = new Map();
  const status = mkStatusBar();

  function broadcastBoard(cards) {
    if (meshOpts?.getBroadcastTargets) {
      void broadcastMeshBoard(api, config, meshOpts.getBroadcastTargets(), { cards });
    } else {
      void broadcastProject(api, config, group, 'board', { cards });
    }
  }

  async function addCard(col) {
    const st = getBoardState(scopeId);
    const text = await openTextPromptDialog({
      title: t('projects.board_card_prompt'),
      placeholder: t('projects.board_card_placeholder'),
    });
    if (!text) return;
    const next = {
      ...st,
      cards: [
        ...st.cards,
        {
          id: createMessageId(),
          text,
          status: col,
          assignee: config.blipId,
        },
      ],
    };
    setBoardState(scopeId, next);
    broadcastBoard(next.cards);
    render();
  }

  function setCardStatus(cardId, newStatus) {
    const st = getBoardState(scopeId);
    const next = {
      ...st,
      cards: st.cards.map((c) => (c.id === cardId ? { ...c, status: newStatus } : c)),
    };
    setBoardState(scopeId, next);
    broadcastBoard(next.cards);
    render();
  }

  async function deleteCard(cardId) {
    const ok = await openConfirmDialog({
      title: t('projects.board_card_delete'),
      body: t('projects.board_card_delete_confirm'),
    });
    if (!ok) return;
    const st = getBoardState(scopeId);
    const next = { ...st, cards: st.cards.filter((c) => c.id !== cardId) };
    setBoardState(scopeId, next);
    broadcastBoard(next.cards);
    render();
  }

  function showBoardCardMenu(e, card) {
    e.preventDefault();
    const menu = document.createElement('div');
    menu.className = 'context-menu glass';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    function bindItem(btn, handler) {
      btn.addEventListener('mousedown', (ev) => ev.stopPropagation());
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        menu.remove();
        handler();
      });
    }

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = t('projects.board_card_delete');
    bindItem(delBtn, () => void deleteCard(card.id));
    menu.appendChild(delBtn);

    if (card.status !== 'progress') {
      const progBtn = document.createElement('button');
      progBtn.type = 'button';
      progBtn.textContent = t('projects.board_move_progress');
      bindItem(progBtn, () => setCardStatus(card.id, 'progress'));
      menu.appendChild(progBtn);
    }

    if (card.status !== 'done') {
      const doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.textContent = t('projects.board_move_done');
      bindItem(doneBtn, () => setCardStatus(card.id, 'done'));
      menu.appendChild(doneBtn);
    }

    if (card.status !== 'todo') {
      const todoBtn = document.createElement('button');
      todoBtn.type = 'button';
      todoBtn.textContent = t('projects.board_move_todo');
      bindItem(todoBtn, () => setCardStatus(card.id, 'todo'));
      menu.appendChild(todoBtn);
    }
    document.body.appendChild(menu);
    const close = () => menu.remove();
    setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
  }

  function render() {
    const st = getBoardState(scopeId);
    for (const col of cols) {
      const list = colEls.get(col);
      if (!list) continue;
      list.innerHTML = '';
      const cards = st.cards.filter((c) => c.status === col);
      cards.forEach((card) => {
        const el = document.createElement('div');
        el.className = `proj-board-card proj-board-card--${col}`;
        el.textContent = card.text;
        if (card.assignee) {
          const meta = document.createElement('span');
          meta.className = 'proj-board-card-meta';
          meta.textContent = ` #${card.assignee}`;
          el.appendChild(meta);
        }
        el.addEventListener('contextmenu', (ev) => showBoardCardMenu(ev, card));
        list.appendChild(el);
      });
    }
    status.text.textContent = t('projects.board_cards').replace('{n}', String(st.cards.length));
  }

  const grid = document.createElement('div');
  grid.className = 'proj-board-grid';
  for (const col of cols) {
    const colWrap = document.createElement('div');
    colWrap.className = 'proj-board-col';
    const head = document.createElement('div');
    head.className = 'proj-board-col-head';
    const headLabel = document.createElement('span');
    headLabel.className = 'proj-board-col-title';
    headLabel.textContent = t(`projects.board_${col}`);
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn btn-lang proj-board-add';
    add.setAttribute('aria-label', t('projects.board_add_card'));
    add.textContent = '+';
    add.addEventListener('click', () => void addCard(col));
    head.appendChild(headLabel);
    head.appendChild(add);
    const list = document.createElement('div');
    list.className = 'proj-board-col-list';
    colWrap.appendChild(head);
    colWrap.appendChild(list);
    grid.appendChild(colWrap);
    colEls.set(col, list);
  }

  const unsub = subscribeGroupProject(scopeId, (tool) => {
    if (tool === 'board') render();
  });

  render();
  wrap.appendChild(grid);
  wrap.appendChild(status.bar);

  return {
    el: wrap,
    destroy() {
      unsub();
    },
    refresh: render,
  };
}

export function createCanvasToolView(group, config, api, meshOpts = null) {
  const scopeId = meshOpts?.scopeId ?? group.id;
  const wrap = document.createElement('div');
  wrap.className = 'proj-tool proj-tool--canvas';

  let color = CANVAS_QUICK_COLORS[10];
  let tool = 'brush';
  let activePainter = null;
  let painting = false;

  function broadcastCanvasPixel(x, y, c) {
    if (meshOpts?.getBroadcastTargets) {
      void broadcastMeshCanvas(api, config, meshOpts.getBroadcastTargets(), { x, y, color: c });
    } else {
      void broadcastProject(api, config, group, 'canvas', { x, y, color: c });
    }
  }

  function paintColorAt(x, y) {
    const c = tool === 'eraser' ? '' : color;
    setCanvasPixel(scopeId, x, y, c);
    broadcastCanvasPixel(x, y, c);
    activePainter = config.blipId;
  }

  function floodFill(x, y, fillColor) {
    const st = getCanvasState(scopeId);
    const target = st.cells[y * st.w + x] || '';
    const fill = fillColor || '';
    if (target === fill) return;
    const stack = [[x, y]];
    const seen = new Set();
    const updates = [];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      const key = `${cx},${cy}`;
      if (seen.has(key)) continue;
      if (cx < 0 || cy < 0 || cx >= st.w || cy >= st.h) continue;
      const idx = cy * st.w + cx;
      if ((st.cells[idx] || '') !== target) continue;
      seen.add(key);
      st.cells[idx] = fill;
      updates.push([cx, cy]);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    if (!updates.length) return;
    notifyCanvasChanged(scopeId);
    for (const [px, py] of updates) broadcastCanvasPixel(px, py, fill);
    activePainter = config.blipId;
    paint();
  }

  function applyToolAt(x, y) {
    if (tool === 'bucket') {
      floodFill(x, y, color);
      return;
    }
    paintColorAt(x, y);
    paint();
  }

  const workspace = document.createElement('div');
  workspace.className = 'proj-canvas-workspace';

  const dock = document.createElement('div');
  dock.className = 'proj-canvas-dock';

  const toolsRow = document.createElement('div');
  toolsRow.className = 'proj-canvas-tools';
  const toolBtns = new Map();
  for (const id of CANVAS_TOOLS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-lang proj-canvas-tool-btn';
    btn.dataset.tool = id;
    btn.dataset.i18n = `projects.canvas_tool_${id}`;
    btn.textContent = t(`projects.canvas_tool_${id}`);
    btn.addEventListener('click', () => {
      tool = id;
      toolBtns.forEach((b, k) => b.classList.toggle('proj-canvas-tool-btn--active', k === id));
    });
    if (id === tool) btn.classList.add('proj-canvas-tool-btn--active');
    toolBtns.set(id, btn);
    toolsRow.appendChild(btn);
  }

  const customColorUi = createBlipColorInput({
    value: color,
    title: t('projects.canvas_custom_color'),
    className: 'proj-canvas-color-picker',
  });
  customColorUi.input.addEventListener('input', () => {
    color = customColorUi.value;
    syncSwatches();
  });

  const head = document.createElement('div');
  head.className = 'proj-canvas-head';
  const hint = document.createElement('span');
  hint.className = 'proj-canvas-hint';
  head.appendChild(hint);

  const stage = document.createElement('div');
  stage.className = 'proj-canvas-stage';

  const grid = document.createElement('div');
  grid.className = 'proj-canvas-grid';
  const cells = [];

  const st0 = getCanvasState(scopeId);
  grid.style.setProperty('--canvas-cols', String(st0.w));
  grid.style.setProperty('--canvas-rows', String(st0.h));
  for (let y = 0; y < st0.h; y++) {
    for (let x = 0; x < st0.w; x++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'proj-canvas-cell';
      const onPaint = () => applyToolAt(x, y);
      cell.addEventListener('mousedown', (e) => {
        e.preventDefault();
        painting = true;
        onPaint();
      });
      cell.addEventListener('mouseenter', () => {
        if (painting && tool !== 'bucket') onPaint();
      });
      cells.push(cell);
      grid.appendChild(cell);
    }
  }
  const onWindowUp = () => {
    painting = false;
  };
  window.addEventListener('mouseup', onWindowUp);

  const palette = document.createElement('div');
  palette.className = 'proj-canvas-palette';
  const swatchEls = [];

  function syncSwatches() {
    swatchEls.forEach((sw) => {
      sw.classList.toggle('proj-canvas-swatch--active', sw.dataset.color === color);
    });
    customColor.value = color.startsWith('#') && color.length >= 7 ? color : '#00ffc8';
  }

  CANVAS_QUICK_COLORS.forEach((c) => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'proj-canvas-swatch';
    sw.dataset.color = c;
    sw.style.background = c;
    sw.addEventListener('click', () => {
      color = c;
      syncSwatches();
    });
    swatchEls.push(sw);
    palette.appendChild(sw);
  });
  palette.appendChild(customColorUi.el);

  dock.appendChild(toolsRow);
  dock.appendChild(palette);

  const status = mkStatusBar();

  function paint() {
    const st = getCanvasState(scopeId);
    st.cells.forEach((c, i) => {
      cells[i].style.background = c || '#1a1a1a';
    });
    hint.textContent = t('projects.canvas_active').replace(
      '{id}',
      activePainter ? String(activePainter) : '—'
    );
    status.text.textContent = t('projects.canvas_size');
    syncSwatches();
  }

  const unsub = subscribeGroupProject(scopeId, (tool) => {
    if (tool === 'canvas') paint();
  });

  paint();
  stage.appendChild(grid);
  workspace.appendChild(stage);
  workspace.appendChild(dock);
  wrap.appendChild(head);
  wrap.appendChild(workspace);
  wrap.appendChild(status.bar);

  return {
    el: wrap,
    destroy() {
      unsub();
      painting = false;
      window.removeEventListener('mouseup', onWindowUp);
    },
  };
}

export function createClipboardToolView(group, config, api, meshOpts = null) {
  const scopeId = meshOpts?.scopeId ?? group.id;
  const clipMax = meshOpts?.clipMax ?? clipLimitForTier(!!meshOpts?.meshPlusActive);
  const meshPlus = !!meshOpts?.meshPlusActive;
  const wrap = document.createElement('div');
  wrap.className = 'proj-tool proj-tool--clipboard';

  const list = document.createElement('div');
  list.className = 'proj-clip-list';
  const status = mkStatusBar();
  let searchQuery = '';

  function broadcastClip(payload) {
    if (meshOpts?.getBroadcastTargets) {
      void broadcastMeshClipboard(api, config, meshOpts.getBroadcastTargets(), payload);
    } else {
      void broadcastProject(api, config, group, 'clipboard', payload);
    }
  }

  function render() {
    const st = getClipState(scopeId);
    list.innerHTML = '';
    const q = searchQuery.trim().toLowerCase();
    const entries = q
      ? st.entries.filter((e) => String(e.text || '').toLowerCase().includes(q))
      : st.entries;
    entries.forEach((e) => {
      const row = document.createElement('div');
      row.className = 'proj-clip-row';
      if (Number(e.from) === Number(config.blipId)) row.classList.add('proj-clip-row--mine');
      const txt = document.createElement('span');
      txt.className = 'proj-clip-text';
      txt.textContent = e.text;
      const meta = document.createElement('span');
      meta.className = 'proj-clip-meta';
      const age = Date.now() - e.ts;
      meta.textContent = `#${e.from} · ${age}ms`;
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn btn-lang proj-clip-copy';
      copyBtn.textContent = '⧉';
      copyBtn.title = t('projects.clip_copy');
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(e.text);
        } catch {
          /* ignore */
        }
      });
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-danger proj-clip-del';
      delBtn.textContent = '×';
      delBtn.title = t('projects.clip_delete');
      delBtn.addEventListener('click', () => {
        if (removeClipEntry(scopeId, e.id)) render();
      });
      row.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        delBtn.click();
      });
      row.appendChild(txt);
      row.appendChild(meta);
      row.appendChild(copyBtn);
      row.appendChild(delBtn);
      list.appendChild(row);
    });
    if (meshPlus) {
      status.text.textContent = t('projects.clip_count_search')
        .replace('{n}', String(entries.length))
        .replace('{total}', String(st.entries.length));
    } else {
      status.text.textContent = t('projects.clip_count_limit')
        .replace('{n}', String(st.entries.length))
        .replace('{max}', String(clipMax));
    }
  }

  async function pull() {
    if (meshOpts?.getBroadcastTargets) {
      await requestMeshClipboardPull(api, config, meshOpts.getBroadcastTargets());
    } else {
      await requestClipboardPull(api, config, group);
    }
  }

  const pullBtn = document.createElement('button');
  pullBtn.type = 'button';
  pullBtn.className = 'btn btn-accent';
  pullBtn.dataset.i18n = 'projects.clip_pull';
  pullBtn.textContent = t('projects.clip_pull');
  pullBtn.addEventListener('click', () => void pull());

  const pushBtn = document.createElement('button');
  pushBtn.type = 'button';
  pushBtn.className = 'btn btn-lang';
  pushBtn.dataset.i18n = 'projects.clip_push';
  pushBtn.textContent = t('projects.clip_push');
  pushBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text?.trim()) return;
      const entry = {
        id: createMessageId(),
        text: text.trim().slice(0, 32000),
        from: config.blipId,
        ts: Date.now(),
      };
      pushClipEntry(scopeId, entry, clipMax);
      broadcastClip({ entry });
      render();
    } catch {
      /* permission */
    }
  });

  const actions = document.createElement('div');
  actions.className = 'proj-clip-actions';
  actions.appendChild(pullBtn);
  actions.appendChild(pushBtn);

  const topRow = document.createElement('div');
  topRow.className = 'proj-clip-top';
  topRow.appendChild(actions);

  if (meshPlus) {
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'input proj-clip-search';
    search.placeholder = t('projects.clip_search');
    search.dataset.i18nPlaceholder = 'projects.clip_search';
    search.addEventListener('input', () => {
      searchQuery = search.value;
      render();
    });
    topRow.appendChild(search);
  } else {
    const limitHint = document.createElement('p');
    limitHint.className = 'hint proj-clip-limit-hint';
    limitHint.dataset.i18n = 'projects.clip_free_limit_hint';
    limitHint.textContent = t('projects.clip_free_limit_hint').replace('{max}', String(clipMax));
    topRow.appendChild(limitHint);
  }

  const unsub = subscribeGroupProject(scopeId, (tool) => {
    if (tool === 'clipboard') render();
  });

  void pull();
  render();
  wrap.appendChild(topRow);
  wrap.appendChild(list);
  wrap.appendChild(status.bar);

  return {
    el: wrap,
    destroy() {
      unsub();
    },
    refresh: render,
  };
}
