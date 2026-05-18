import { t } from './i18n.js';
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

  const intro = document.createElement('div');
  intro.className = 'projects-intro';
  const introTitle = document.createElement('h2');
  introTitle.className = 'section-title';
  introTitle.dataset.i18n = 'projects.hub_title';
  introTitle.textContent = t('projects.hub_title');
  const p1 = document.createElement('p');
  p1.className = 'projects-intro-p';
  p1.dataset.i18n = 'projects.intro_p1';
  p1.textContent = t('projects.intro_p1');
  const p2 = document.createElement('p');
  p2.className = 'projects-intro-p';
  p2.dataset.i18n = 'projects.intro_p2';
  p2.textContent = t('projects.intro_p2');
  const p3 = document.createElement('p');
  p3.className = 'projects-intro-p projects-intro-p--accent';
  p3.dataset.i18n = 'projects.intro_p3';
  p3.textContent = t('projects.intro_p3');
  intro.appendChild(introTitle);
  intro.appendChild(p1);
  intro.appendChild(p2);
  intro.appendChild(p3);

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
  let stubEl = null;

  function destroyPad() {
    padView?.destroy?.();
    padView = null;
  }

  function showStub(toolId) {
    destroyPad();
    main.innerHTML = '';
    stubEl = document.createElement('div');
    stubEl.className = 'projects-stub glass';
    const icon = document.createElement('span');
    icon.className = 'projects-stub-icon';
    const def = TOOLS.find((x) => x.id === toolId);
    icon.textContent = def?.icon || '·';
    const title = document.createElement('h3');
    title.className = 'projects-stub-title';
    title.textContent = def ? t(def.labelKey) : toolId;
    const hint = document.createElement('p');
    hint.className = 'hint projects-stub-hint';
    hint.dataset.i18n = 'projects.tool_soon';
    hint.textContent = t('projects.tool_soon');
    stubEl.appendChild(icon);
    stubEl.appendChild(title);
    stubEl.appendChild(hint);
    main.appendChild(stubEl);
  }

  function showPad() {
    main.innerHTML = '';
    stubEl = null;
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
    btn.innerHTML = `<span class="projects-tool-icon">${tool.icon}</span><span>${t(tool.labelKey)}</span>`;
    if (!tool.ready) btn.classList.add('projects-tool-btn--soon');
    btn.addEventListener('click', () => selectTool(tool.id));
    toolList.appendChild(btn);
  });

  sidebar.appendChild(sideLabel);
  sidebar.appendChild(toolList);
  body.appendChild(sidebar);
  body.appendChild(main);

  root.appendChild(intro);
  root.appendChild(body);

  selectTool('pad');

  return {
    el: root,
    destroy() {
      destroyPad();
    },
    refreshPeers() {
      if (activeTool === 'pad' && padView) {
        /* pad reads getOnlinePeerIds on each broadcast */
      }
    },
  };
}
