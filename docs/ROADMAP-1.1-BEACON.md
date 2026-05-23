# BLIP 1.1.0 — Beacon

**Codename:** Beacon  
**UI naming:** EN **BEACON** · RU **МАЯК** (not mixed)  
**Version line:** `1.1.0` (no “MVP” in user-facing naming)  
**Status:** In development (`app-metadata.json` → `1.1.0-alpha`)

---

## Release goals

| Track | Scope |
|-------|--------|
| **Beacon** | LAN mesh file library: announce, multi-seed, parallel chunk download, `seed-pulse` health |
| **Chat** | Reply, Forward (lite), Pinned messages |
| **UX** | #21 Compact mode, #22 Font size, #29 Idle → Away, #30 Typing sound |
| **Polish** | Toasts: auto-dismiss, swipe / close; transfer hub dismiss + completed section |

**Out of 1.1.0:** BLIP Relay, Voice Notes, global search, threads, Dead Drop, full Telegram-style forward chains, remote typing sound (BBS-style CTCP).

**Prerequisite:** 1.0.3 Echo — voice channels and handshake IP route (done).

---

## Product decisions (review feedback)

### Navigation — not hidden in Developer

- **BEACON** is in **main nav** with **[BETA]** badge (EN) / **[БЕТА]** (RU).
- Developer panel keeps only **protocol on/off** toggle (bandwidth / debugging).
- Future: optional discovery-driven highlight when seeds appear in mesh.

### Multi-seed scheduler — rarity over raw latency

Leecher picks peers using **two factors**, not latency alone:

1. **Chunk rarity** — prefer peers that hold chunks you still need (`seed-have` bitmap).
2. **Latency** — tie-break among peers with similar coverage.

Default **N = 3** parallel peers; rare chunks from fast partial seeders, bulk from full seeders.

### Forward (lite) — file availability

When forwarding a message with a Beacon attachment:

- Prefer **forward `seedId` + caption**, not re-upload.
- If target chat has no access to seed → **“File unavailable — request in mesh?”** with optional **Re-seed in target chat**.
- Text-only forward unchanged.

### Pinned messages

- **Default: 1 pin** per chat (DM + group), familiar from messengers.
- Optional later: temporary pins (auto-unpin after 24h). No arbitrary “3 pins” limit.

### Idle → Away (#29)

- Default **5 minutes** of no input/focus → UDP presence `away`.
- **Configurable** in Settings → Profile / Presence.
- **Manual status wins:** if user set Busy or Away, idle timer does not override.

### Typing sound (#30)

- **Local only** in 1.1.0: subtle key click on composer keydown.
- **Remote typing sound** (IRC/BBS vibe) → post-1.1 idea, not #30 scope.

### Transfer hub

- Completed rows stay **5 s** (was 2 s), then auto-clear.
- Per-row **×**, header clear-all.
- **Phase B:** “Open folder” / “Show in Explorer” action before collapse; optional **Completed** accordion instead of delete.

### Backward compatibility 1.0.3 ↔ 1.1.0

| Change | 1.0.3 behavior | Requirement |
|--------|----------------|---------------|
| `seed-*` UDP/TCP | Ignored (unknown type) | OK |
| `replyTo`, `forwardFrom` on `message` | Extra JSON fields | **Must not break parser** — ignore unknown fields |
| `message-pin` | Ignored if unknown | OK |
| Presence `away` from idle | Shown as online if unknown | Graceful |

**Check before ship:** send `replyTo` from 1.1.0 → 1.0.3 still renders text; pin/forward UI simply absent on old client.

Optional: `capabilities: ['beacon','reply','pin']` in announce or first TCP handshake (future).

---

## Beacon — technical scope

### UDP (discovery path)

| Type | Direction | Purpose |
|------|-----------|---------|
| `seed-announce` | Broadcast | New seed: `seedId`, `filename`, `size`, `chunkSize`, `totalChunks`, `blipId` |
| `seed-pulse` | Broadcast (~30s) | Health: `seeds`, `leechers` per `seedId` |
| `seed-gone` | Broadcast | Seeder stopped / revoked |

### TCP (peer ↔ peer)

| Type | Purpose |
|------|---------|
| `seed-request` | Batch chunk indices request |
| `seed-chunk` | Chunk payload (`seedId`, `chunkIndex`, bytes or base64) |
| `seed-have` | Peer chunk bitmap for rarity scheduling |

### Storage

- `%APPDATA%/blip/seeds/<seedId>/` — chunk files + `meta.json`
- `seedId` = first 16 hex chars of SHA-256(file) (content-addressed)

### Renderer modules

| File | Role |
|------|------|
| `renderer/beacon-mesh.js` | Catalog, download scheduler (multi-peer), seeding, pulse |
| `renderer/beacon-ui.js` | Library view: list, publish, progress, peers |
| `main/beacon-store.js` | On-disk paths |

### UI polish (1.1.x backlog)

| Item | Notes |
|------|--------|
| Pixel nav icon | Lighthouse / tower, not generic folder |
| Drag-to-seed | Drop file on BEACON view → Publish? |
| Seed preview | Thumbnail from first chunk (images/video) |
| Tray progress | Windows tray tooltip % on large downloads |
| `blip://seed/<id>` | Copy link → paste in chat → open in Library |
| Bandwidth graph | Settings → Network, Mesh Pulse style |

---

## Chat (1.1.0)

| Feature | Wire / storage | Notes |
|---------|----------------|-------|
| **Reply** | `replyTo` on `message` (exists) | Quote strip, jump, composer preview |
| **Forward** | `forwardFrom` + `seedId?` | Lite; see file availability above |
| **Pinned** | `message-pin` (exists) | **1 pin** per chat; strip in group + DM |

---

## UX polish

| ID | Feature | Implementation hint |
|----|---------|---------------------|
| 21 | Compact mode | `data-ui-density="compact"` on `<html>` |
| 22 | Font size | `config.uiFontScale`, `config.chatFontScale` |
| 29 | Idle → Away | 5 min default, manual status respected |
| 30 | Typing sound | Local composer click, `config.typingSound` |

---

## Notifications & transfer hub

- [x] Toasts: ~9s default, × and swipe dismiss.
- [x] Transfer hub: 5s after 100%, per-row ×, clear all.
- [ ] Completed section + “Open folder” (phase B).
- [ ] Settings → toast duration slider (1.1.1).

---

## Implementation phases

### Phase A — Foundation ✓

- [x] Roadmap, metadata `1.1.0-alpha`, toasts + transfer hub
- [x] UDP `seed-*` in `discovery.js`, TCP forward, `beacon-mesh.js` skeleton
- [x] Main nav **BEACON / МАЯК** with [BETA]

### Phase B — Beacon core

- [ ] Publish file → announce + local seed
- [ ] Single-peer download E2E
- [ ] Multi-seed parallel download (rarity + latency)
- [ ] `seed-pulse` while seeding

### Phase C — Chat

- [ ] Reply UI polish
- [ ] Pin UI (1 pin)
- [ ] Forward lite + seedId path

### Phase D — UX + ship

- [ ] 21, 22, 29, 30
- [ ] i18n EN/RU, CHANGELOG 1.1.0, tag `v1.1.0`
- [ ] 1.0.3 ↔ 1.1.0 compat smoke test

---

## Done criteria for tag `v1.1.0`

1. Two peers: A publishes 50 MB; B and C download in parallel; both seed.
2. `seed-pulse` updates seeder/leecher counts within 30s.
3. Reply + 1 pin in group; forward text + seedId to another DM.
4. Toasts always dismiss; transfer hub never stuck.
5. 1.0.3 peer in same LAN: chat/calls OK; ignores Beacon packets.
6. No regression: 1:1 call, text chat, group relay, voice channels.

---

*See also [`IDEAS.local.md`](../IDEAS.local.md) for long-term ideas.*
