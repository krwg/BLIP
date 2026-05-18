import { t } from './i18n.js';
import { createPixelHintIcon } from './settings-ui.js';
import { createPadToolView } from './project-tools-ui.js';
import { MESH_PROJECT_SCOPE } from './projects-mesh-wire.js';

const TOOLS = [
  { id: 'pad', icon: '✦', labelKey: 'projects.tool_pad', ready: true },
  { id: 'board', icon: '▦', labelKey: 'projects.tool_board', ready: false },
  { id: 'canvas', icon: '◻', labelKey: 'projects.tool_canvas', ready: false },
  { id: 'clipboard', icon: '⧉', labelKey: 'projects.tool_clip', ready: false },
];

/**
 * Standalone Projects workspace (not tied to groups).
 * @param {object} config
 * @param {object} api
 * @param {() => number[]} getOnlinePeerIds
 */
export function createProjectsView(config, api, getOnlinePeerIds) {
  const root = document.createElement('div');
  root.className = 'projects-workspace';

  const titleRow = document.createElement('div');
  titleRow.className = 'section-title-row';
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

  function destroyPad() {
    padView?.destroy?.();
    padView = null;
  }

  function showStub(toolId) {
    destroyPad();
    main.innerHTML = '';
    const stubEl = document.createElement('div');
    stubEl.className = 'projects-stub glass';
    const icon = document.createElement('span');
    icon.className = 'projects-stub-icon';
    const def = TOOLS.find((x) => x.id === toolId);
    icon.textContent = def?.icon || '·';
    const stubTitle = document.createElement('h3');
    stubTitle.className = 'projects-stub-title';
    stubTitle.textContent = def ? t(def.labelKey) : toolId;
    const hint = document.createElement('p');
    hint.className = 'hint projects-stub-hint';
    hint.dataset.i18n = 'projects.tool_soon';
    hint.textContent = t('projects.tool_soon');
    stubEl.appendChild(icon);
    stubEl.appendChild(stubTitle);
    stubEl.appendChild(hint);
    main.appendChild(stubEl);
  }

  function showPad() {
    main.innerHTML = '';
    destroyPad();
    padView = createPadToolView(
      { id: MESH_PROJECT_SCOPE, members: getOnlinePeerIds() },
      config,
      api,
      {
        scopeId: MESH_PROJECT_SCOPE,
        getBroadcastTargets: getOnlinePeerIds,
      }
    );
    padView.el.classList.add('glass');
    main.appendChild(padView.el);
  }

  function selectTool(id) {
    activeTool = id;
    toolList.querySelectorAll('.projects-tool-btn').forEach((btn) => {
      btn.classList.toggle('projects-tool-btn--active', btn.dataset.tool === id);
    });
    const def = TOOLS.find((x) => x.id === id);
    if (def?.ready) showPad();
    else showStub(id);
  }

  TOOLS.forEach((tool) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'projects-tool-btn';
    btn.dataset.tool = tool.id;
    btn.dataset.i18n = tool.labelKey;
    const label = document.createElement('span');
    label.textContent = t(tool.labelKey);
    const iconSpan = document.createElement('span');
    iconSpan.className = 'projects-tool-icon';
    iconSpan.textContent = tool.icon;
    btn.appendChild(iconSpan);
    btn.appendChild(label);
    if (!tool.ready) btn.classList.add('projects-tool-btn--soon');
    btn.addEventListener('click', () => selectTool(tool.id));
    toolList.appendChild(btn);
  });

  sidebar.appendChild(sideLabel);
  sidebar.appendChild(toolList);
  body.appendChild(sidebar);
  body.appendChild(main);

  root.appendChild(titleRow);
  root.appendChild(body);

  selectTool('pad');

  return {
    el: root,
    destroy() {
      destroyPad();
    },
    refreshPeers() {
      /* pad reads getOnlinePeerIds on each broadcast */
    },
  };
}
