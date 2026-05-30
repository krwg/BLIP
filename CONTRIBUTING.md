# Contributing to BLIP

Thanks for helping improve BLIP. This project is **GPL-3.0** — your contributions will be under the same license.

## Prerequisites

- **Node.js** ≥ 20 (see `.nvmrc`). Use `nvm use` if you use nvm.
- **npm** (ships with Node).
- **Windows** is the primary target today; other platforms may work but are not fully validated in CI.

## GitHub Pages

The static landing page lives in **`docs/index.html`**. To publish:

1. Repo **Settings** → **Pages** → **Build and deployment** → source: **Deploy from a branch**.
2. Branch: **`main`**, folder: **`/docs`**, Save.
3. Site URL: `https://github.com/FlokeStudio/BLIP` (Pages landing updates separately).

Update the hardcoded clone URL in `docs/index.html` only if the repo moves.

## Quick setup

```bash
git clone https://github.com/FlokeStudio/BLIP.git
cd BLIP
npm ci
```

## Development

```bash
npm run electron:dev
```

This runs Vite and Electron with `BLIP_VITE_DEV=1`. The UI loads from `http://localhost:5173`.

**Second instance** (separate config directory — see `scripts/electron-dev-peer2.mjs`):

```bash
npm run electron:dev:peer2
```

## Production-like run

```bash
npm start
```

Builds the renderer first (`prestart` → `vite build`), then launches Electron against `dist/`.

## Building installers

Requires Windows for the current electron-builder targets:

```bash
npm run electron:build        # NSIS installer
npm run electron:build:portable
npm run electron:build:all    # Setup + portable + latest.yml (auto-update manifest)
```

Outputs go to `dist-electron/` (see `electron-builder.yml`).

### Publishing a GitHub Release

In-app updates need **`latest.yml`** and **`BLIP-Setup-<version>.exe`** on the **same** release tag as `app-metadata.json` (e.g. tag `1.1.1`, not `v1.1.1`, unless you use that tag consistently).

| Method | Command |
|--------|---------|
| **CI (recommended)** | Push git tag `1.1.1` → [`.github/workflows/release.yml`](.github/workflows/release.yml) runs `electron:publish:win` |
| **Local publish** | `$env:GH_TOKEN = "ghp_…"; npm run electron:publish:win` |
| **Manual upload** | `npm run electron:build:all` then `npm run release:assets` — attach listed files to the GitHub Release |

Copy release notes from [`docs/release-notes-v1.1.1-github.md`](docs/release-notes-v1.1.1-github.md) (update per version).

**Portable** builds do not receive in-app updates — users must download a new portable or install Setup once.

**Dev vs packaged UI:** `npm run electron:dev` loads live sources from Vite; `electron:build:all` snapshots `dist/` into the exe. Always run `npm run build` before shipping (the build scripts do this automatically).

## Release metadata

Version and codename live in [`app-metadata.json`](app-metadata.json) (synced into `package.json` on `npm run build`). Update [`CHANGELOG.md`](CHANGELOG.md) when shipping.

**MESH+** tier notes: [`docs/MESH-PLUS.md`](docs/MESH-PLUS.md) — test subscription, free keys via blipteam@icloud.com; plan to graduate features to FREE. Do not break FREE behavior when gating MESH+ features.

Release builds: run `npm run setup:build-secrets` once, then configure maintainer build secrets before `electron:build:*` (see `ENTITLEMENT-MAP.local.md`, gitignored).

## TCP payloads (renderer ↔ main)

Chat and signalling use newline-delimited JSON on TCP port **42070**. Common `type` values: `message`, `typing`, `ping`/`pong`, `call-*`, `group-*`, `group-call-*`, `file-*`, `clipboard-push`, `seed-*` (BEACON). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

The renderer Vite build produces three HTML entry points: `index.html`, `call-window.html`, `group-call-window.html`.

## Version / metadata

- Release version and display metadata live in **`app-metadata.json`** (see current version/codename there).
- `npm run build` runs `scripts/sync-app-metadata.mjs` so `package.json`’s `version` stays in sync.
- User-facing release notes go in **`CHANGELOG.md`** before tagging.

## Code style

- Match existing patterns in `main/` and `renderer/`.
- Prefer small, focused PRs with a clear **what** and **why**.
- If you change user-visible strings, update **EN + RU** in `renderer/i18n.js` when applicable.

## Pull requests

1. Fork → branch → push → open PR against `main`.
2. Ensure **CI is green** (see `.github/workflows/ci.yml`).
3. Describe behavior change, testing done, and screenshots for UI changes.

## Security

Do **not** open public issues for sensitive vulnerabilities. See [SECURITY.md](SECURITY.md).

## Questions

Open a GitHub issue. If **Discussions** are enabled for this repo, you may ask broader questions there instead.
