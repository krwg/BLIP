# BLIP · MESH+

MESH+ is a **license tier** (`BLIP-XXXX-…` full key, Ed25519 verify in main). FREE users keep the full baseline chat, calls, and LAN mesh.

## Shipped (high level)

| Area | MESH+ |
|------|--------|
| Premium animated backgrounds & sound packs | ✦ |
| Theme editor (custom `#RRGGBB` accent) | ✦ |
| App icons `mesh-1` … `mesh-6` | ✦ |
| Profile status GIF (LAN cloud) | ✦ |
| Signal Corps: Board, Canvas, Pad history, Clipboard 500 + search | ✦ |
| Chat export PDF/HTML with BLIP theme | ✦ |
| Badge on peers (`meshPlus` in UDP announce) | ✦ |
| Full achievement icon art after unlock (`ach-icons/*.svg`) | shown when **Achievements** enabled |

## Not in app yet (marketing only)

- LAN relay, MESH+ Bridge, bandwidth priority — carousel slide only; implementation deferred.

## Settings layout

- **MESH+** — activation + benefits carousel (premium scenes, sounds, theme editor, icons, Signal Corps, export, GIF, relay planned).
- **Network** — session stats + activity bars; **Signal Corps clipboard** toggle (off by default).
- **Achievements** — optional, **off by default**; **Unlocked** / **Not yet unlocked** lists; icons from `ach-icons/*.svg` via `renderer/achievements-icons.js` (hidden until unlocked).

## Code

- Gates: `shared/mesh-plus-gates.js`
- License: `main/mesh-plus-license.js`
- UI: `renderer/mesh-plus-settings.js`, `renderer/mesh-plus.js`
- Projects: `renderer/projects-view.js`, `renderer/project-tools-ui.js`, `renderer/projects-mesh-wire.js`
- Achievements: `renderer/achievements.js`, `renderer/achievements-icons.js`, `renderer/achievements-settings-panel.js`

**App version:** `1.0.0` · codename **Mesh Plus** (`app-metadata.json`).

*No ROOT build switcher in public repo.*
