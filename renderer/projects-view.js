import { t } from './i18n.js';
import { createPixelHintIcon } from './settings-ui.js';
import {
  createPadToolView,
  createBoardToolView,
  createCanvasToolView,
  createClipboardToolView,
} from './project-tools-ui.js';
import { clipLimitForTier } from './group-projects-store.js';
import { MESH_PROJECT_SCOPE } from './projects-mesh-wire.js';
import { isMeshPlusActive, showMeshPlusLockedToast } from './mesh-plus.js';

const TOOLS = [
  { id: 'pad', icon: '✦', labelKey: 'projects.tool_pad', tier: 'free' },
  { id: 'board', icon: '▦', labelKey: 'projects.tool_board', tier: 'mesh_plus' },
  { id: 'canvas', icon: '◻', labelKey: 'projects.tool_canvas', tier: 'mesh_plus' },
  { id: 'clipboard', icon: '⧉', labelKey: 'projects.tool_clip', tier: 'free' },
];

/**
 * Standalone Projects workspace (not tied to groups).
 * @param {object | (() => object)} configOrGetter
 * @param {object} api
 * @param {() => number[]} getOnlinePeerIds
 * @param {{ onOpenMeshPlus?: () => void }} [hooks]
 */
export function createProjectsView(configOrGetter, api, getOnlinePeerIds, hooks = {}) {
  const getConfig =
    typeof configOrGetter === 'function' ? configOrGetter : () => configOrGetter;
  const root = document.createElement('div');
  root.className = 'projects-workspace';

  const titleRow = document.createElement('div');
  titleRow.className = 'section-title-row projects-workspace-head';
  const title = document.createElement('h2');
  title.className = 'section-title';
  title.dataset.i18n = 'projects.hub_title';
  title.textContent = t('projects.hub_title');
  titleRow.appendChild(title);
  titleRow.appendChild(createPixelHintIcon('projects.hub_hint'));

  const body = document.createElement('div');
  body.className = 'projects-workspace-body';

  const sidebar = document.createElement('aside');
  sidebar.className = 'projects-sidebar glass';

  const sideLabel = document.createElement('div');
  sideLabel.className = 'projects-sidebar-label';
  sideLabel.dataset.i18n = 'projects.sidebar_title';
  sideLabel.textContent = t('projects.sidebar_title');

  const toolList = document.createElement('div');
  toolList.className = 'projects-tool-list';

  const main = document.createElement('div');
  main.className = 'projects-main';

  let activeTool = 'pad';
  let padView = null;
  let boardView = null;
  let canvasView = null;
  let clipboardView = null;

  function meshGroup() {
    return { id: MESH_PROJECT_SCOPE, members: getOnlinePeerIds() };
  }

  function meshOpts() {
    const mp = isMeshPlusActive(getConfig());
    return {
      scopeId: MESH_PROJECT_SCOPE,
      getBroadcastTargets: getOnlinePeerIds,
      meshPlusActive: mp,
      clipMax: clipLimitForTier(mp),
    };
  }

  function destroyPad() {
    padView?.destroy?.();
    padView = null;
  }

  function destroyBoard() {
    boardView?.destroy?.();
    boardView = null;
  }

  function destroyCanvas() {
    canvasView?.destroy?.();
    canvasView = null;
  }

  function destroyClipboard() {
    clipboardView?.destroy?.();
    clipboardView = null;
  }

  function clearMain() {
    destroyPad();
    destroyBoard();
    destroyCanvas();
    destroyClipboard();
    main.innerHTML = '';
  }

  function showStub(toolId, opts = {}) {
    clearMain();
    const stubEl = document.createElement('div');
    stubEl.className = `projects-stub glass${opts.locked ? ' projects-stub--locked' : ''}`;
    const icon = document.createElement('span');
    icon.className = 'projects-stub-icon';
    const def = TOOLS.find((x) => x.id === toolId);
    icon.textContent = def?.icon || '·';
    const stubTitle = document.createElement('h3');
    stubTitle.className = 'projects-stub-title';
    stubTitle.textContent = def ? t(def.labelKey) : toolId;
    const hint = document.createElement('p');
    hint.className = 'hint projects-stub-hint';
    if (opts.locked) {
      hint.dataset.i18n = 'projects.mesh_plus_required';
      hint.textContent = t('projects.mesh_plus_required');
    } else {
      hint.dataset.i18n = 'projects.tool_soon';
      hint.textContent = t('projects.tool_soon');
    }
    stubEl.appendChild(icon);
    stubEl.appendChild(stubTitle);
    stubEl.appendChild(hint);
    if (opts.locked) {
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'btn btn-accent projects-stub-cta';
      cta.dataset.i18n = 'projects.open_mesh_plus';
      cta.textContent = t('projects.open_mesh_plus');
      cta.addEventListener('click', () => hooks.onOpenMeshPlus?.());
      stubEl.appendChild(cta);
    }
    main.appendChild(stubEl);
  }

  function showPad() {
    clearMain();
    padView = createPadToolView(meshGroup(), getConfig(), api, meshOpts());
    padView.el.classList.add('glass');
    main.appendChild(padView.el);
  }

  function showBoard() {
    clearMain();
    boardView = createBoardToolView(meshGroup(), getConfig(), api, meshOpts());
    boardView.el.classList.add('glass');
    main.appendChild(boardView.el);
  }

  function showCanvas() {
    clearMain();
    canvasView = createCanvasToolView(meshGroup(), getConfig(), api, meshOpts());
    canvasView.el.classList.add('glass');
    main.appendChild(canvasView.el);
  }

  function showClipboardDisabled() {
    clearMain();
    const stub = document.createElement('div');
    stub.className = 'projects-stub glass';
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.dataset.i18n = 'projects.clipboard_disabled';
    hint.textContent = t('projects.clipboard_disabled');
    stub.appendChild(hint);
    main.appendChild(stub);
  }

  function showClipboard() {
    if (!getConfig().projectsClipboardEnabled) {
      showClipboardDisabled();
      return;
    }
    clearMain();
    clipboardView = createClipboardToolView(meshGroup(), getConfig(), api, meshOpts());
    clipboardView.el.classList.add('glass');
    main.appendChild(clipboardView.el);
  }

  function canUseTool(tool) {
    if (tool.tier === 'free') return true;
    if (tool.tier === 'mesh_plus') return isMeshPlusActive(getConfig());
    return false;
  }

  function selectTool(id) {
    activeTool = id;
    toolList.querySelectorAll('.projects-tool-btn').forEach((btn) => {
      btn.classList.toggle('projects-tool-btn--active', btn.dataset.tool === id);
    });
    const def = TOOLS.find((x) => x.id === id);
    if (!def) return;

    if (!canUseTool(def)) {
      if (def.tier === 'mesh_plus') {
        showMeshPlusLockedToast();
        showStub(id, { locked: true });
      } else {
        showStub(id);
      }
      return;
    }

    if (id === 'pad') showPad();
    else if (id === 'board') showBoard();
    else if (id === 'canvas') showCanvas();
    else if (id === 'clipboard') showClipboard();
    else showStub(id);
  }

  function syncToolLockClasses() {
    toolList.querySelectorAll('.projects-tool-btn').forEach((btn) => {
      const def = TOOLS.find((x) => x.id === btn.dataset.tool);
      if (!def) return;
      const locked = def.tier === 'mesh_plus' && !isMeshPlusActive(getConfig());
      btn.classList.toggle('projects-tool-btn--mesh-locked', locked);
    });
  }

  TOOLS.forEach((tool) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'projects-tool-btn';
    btn.dataset.tool = tool.id;
    btn.dataset.i18n = tool.labelKey;
    const iconSpan = document.createElement('span');
    iconSpan.className = 'projects-tool-icon';
    iconSpan.textContent = tool.icon;
    const label = document.createElement('span');
    label.className = 'projects-tool-label';
    label.textContent = t(tool.labelKey);
    btn.appendChild(iconSpan);
    btn.appendChild(label);
    btn.addEventListener('click', () => selectTool(tool.id));
    toolList.appendChild(btn);
  });

  sidebar.appendChild(sideLabel);
  sidebar.appendChild(toolList);
  body.appendChild(sidebar);
  body.appendChild(main);

  root.appendChild(titleRow);
  root.appendChild(body);

  syncToolLockClasses();
  selectTool('pad');

  return {
    el: root,
    destroy() {
      clearMain();
    },
    refreshPeers() {
      boardView?.refresh?.();
    },
    refreshMeshPlus() {
      syncToolLockClasses();
      if (activeTool !== 'pad') {
        const def = TOOLS.find((x) => x.id === activeTool);
        if (def && !canUseTool(def)) selectTool(activeTool);
      }
    },
  };
}
