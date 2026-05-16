# BLIP — architecture overview

High-level map of how pieces fit together. For build and contribution workflow see [CONTRIBUTING.md](../CONTRIBUTING.md).

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron main process                     │
│  main/index.js  — IPC, tray, BrowserWindows, orchestration       │
│  main/discovery.js  — UDP (+ mDNS) peer presence                  │
│  main/tcp-server.js | tcp-client.js  — line-delimited JSON       │
└─────────────────────────────────────────────────────────────────┘
          ▲ preload.cjs (contextBridge → window.blip)
          │
┌─────────┴─────────────────────────────────────────────────────────┐
│ Renderer (Vite bundles)                                             │
│  renderer/main.js · ui.js · chat.js · call.js · call-media.js …  │
│  renderer/call-window.html + call-window-main.js (call window)   │
│  main/global-shortcuts.js — OS hotkeys when tray-hidden           │
└─────────────────────────────────────────────────────────────────┘

WebRTC signalling (SDP, ICE candidates) travels over the same TCP
connection as chat messages; media is peer-to-peer in the renderer.
```

## Processes & windows

| Piece | Role |
|--------|------|
| **Main** | TCP server/client coordination, discovery, IPC to all renderers. |
| **Main window** | Chat, dial, peers, settings (`dist/index.html` or Vite dev URL). |
| **Call window** | Separate `BrowserWindow` loads `call-window.html` — WebRTC UI isolation. Uses theme colors only (`applyCallWindowAppearance`); animated wallpapers disabled so video/screen share stay clean. |

## Networking

| Mechanism | Default port | Purpose |
|-----------|---------------|---------|
| UDP broadcast (+ optional multi-port fan-out) | 42069 (config/env) | `announce` payloads: `blipId`, display name, IPs, advertised TCP/UDP. |
| TCP | 42070 (config/env) | Framed `\n`-delimited JSON (see below). |
| mDNS | — | Auxiliary discovery (`_blip._udp.local` TXT records). |

Environment overrides: `BLIP_UDP_PORT`, `BLIP_TCP_PORT`. Separate user data dirs support side-by-side dev instances (`BLIP_USER_DATA_DIR`).

### TCP message types (line-delimited JSON)

| `type` | Direction | Purpose |
|--------|-----------|---------|
| `message` | Peer ↔ peer | Chat text + timestamp |
| `typing` | Peer ↔ peer | `{ active: true \| false }` while composing |
| `ping` / `pong` | Peer ↔ peer | Reachability probe (Mesh Pulse + manual ping) |
| `call-offer` / `call-answer` / `call-candidate` / `call-reject` / `call-hangup` | Peer ↔ peer | WebRTC signalling |
| `call-state` | Peer ↔ peer | Mute / deafen / screen-share flags |
| `call-renegotiate` / `call-renegotiate-answer` | Peer ↔ peer | Mid-call SDP (e.g. screen share on voice calls) |

## Persistence

| Data | Location |
|------|-----------|
| User config (`blipId`, name, language, audio devices, `globalShortcutsEnabled`, …) | Electron `userData` → `blip-config.json`. |
| Chat history | Renderer `localStorage` key `blip_chat_v1`. |
| Release metadata | `app-metadata.json` (version, codename, repo URL). |

## Security posture (today)

- `contextIsolation: true`, preload exposes a narrow API (`preload.cjs`).
- `openExternal` is restricted to http(s) URLs in main.
- LAN trust model: peers are whoever answers on your network segment.

See [SECURITY.md](../SECURITY.md) for reporting expectations.

## Calls & media

| Piece | Role |
|--------|------|
| `renderer/call.js` | Call UI, mute/deafen state sync, screen share, fullscreen theater mode. |
| `renderer/call-media.js` | 720p camera/screen constraints, RTP bitrate tuning. |
| `main/index.js` | `setDisplayMediaRequestHandler` with OS screen picker; forwards `call-state`, renegotiation SDP. |

Screen share targets **1280×720 minimum** capture, up to 1080p ideal, with `object-fit: contain` in theater layout. Camera calls use 720p ideal; pixel grid applies to camera preview only.

## Mesh Pulse

While the app is running with a BLIP ID, the renderer pings every **online, non-blocked** peer once per minute (`runMeshPulseRound` in `ui.js`). Latency is shown on the **Peers** screen under each nickname (`peer-pulse` line). Manual ping remains in the peer context menu.

## Typing & unread (Discord-style)

- TCP `typing` packets (`active: true/false`) while the user types in an open chat (`chat.js` debounce).
- Typing line in chat UI and under peer name on **Peers**.
- Unread message counts per peer; red badge on **Chat** nav and hub rows until the conversation is opened.

## Future seams

- CI packaging smoke jobs, mobile client, optional STUN for routed VPN edge cases.
