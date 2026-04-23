# Local Desktop Deployment — Research & Enhancement Plan

Status: Research / design proposal. No code changes yet.
Scope: Package OpenCap Lite so a non-technical founder can double-click an
installer on macOS or Windows, run the full app offline, and keep all
cap-table data on their own machine.

---

## 1. Current state (what we have today)

| Concern            | Today                                                       |
| ------------------ | ----------------------------------------------------------- |
| Runtime            | Next.js 14 App Router on Node 20                            |
| Database           | PostgreSQL 16 + Prisma 5.22 (`prisma/schema.prisma:9`)      |
| Connection config  | `DATABASE_URL` env var only                                 |
| API surface        | Full REST under `src/app/api/**`                            |
| Auth               | None implemented (dead `NEXTAUTH_*` vars in `.env.example`) |
| External calls     | None (no OpenAI/SMTP/S3 — fully self-contained)             |
| Deploy targets     | Docker, docker-compose, Fly, Railway, Render (all cloud)    |
| Calc engine        | `src/lib/scenario-engine/` — pure TS, no DB or UI imports   |
| Desktop packaging  | Not present (no Electron, Tauri, or installer tooling)      |
| Data location      | Postgres volume (cloud/container) — no local-user story     |

Three facts simplify desktop packaging:

1. **No auth** means we don't have to migrate sessions/cookies into a
   desktop shell.
2. **No external services** means the app can run fully offline once
   packaged.
3. **The calculation engine has zero DB/UI coupling**, so the same tested
   code works against any Prisma provider.

---

## 2. Gaps for a Mac/PC desktop build

1. **Postgres dependency.** A founder installing an `.app` or `.exe`
   should not have to install or run Postgres. We need an embedded
   engine (SQLite via Prisma is the natural choice).
2. **No desktop shell.** Next.js alone cannot be double-clicked. We
   need a host process that launches the Next server and a window
   that loads `localhost:3000` — Electron or Tauri.
3. **No per-user data directory.** Prisma currently resolves
   `DATABASE_URL` from env. On desktop we need to compute a platform
   correct path (macOS: `~/Library/Application Support/OpenCap`;
   Windows: `%APPDATA%\OpenCap`; Linux: `~/.local/share/OpenCap`).
4. **Schema uses Postgres-only types.** `Decimal @db.Decimal(20, 8)`,
   `Json`, and `BigInt` need review — SQLite supports `Decimal` and
   `Json` through Prisma but representation differs (see §4).
5. **Migrations are runtime-applied.** Today Docker runs
   `prisma migrate deploy` on boot. On desktop, the installer/launcher
   must apply migrations against the user's local SQLite file, then
   seed only on first run.
6. **No backup/restore or import/export affordances in the UI.** OCF
   JSON import/export already exists, but there's no "copy my whole
   database" button — important when the DB file lives in the user's
   profile and they may switch machines.
7. **No code signing / notarization.** macOS Gatekeeper will block
   unsigned apps; Windows SmartScreen will warn. Needed before public
   distribution (can be deferred for internal/beta builds).
8. **No auto-update path.** Desktop users expect silent updates.
9. **Dead config must be removed** (`NEXTAUTH_*`) or the installer
   may surface confusing warnings.

---

## 3. Packaging options — tradeoffs

| Option                   | Bundle size | Build complexity | Node APIs | Signing story       | Notes                                                                         |
| ------------------------ | ----------- | ---------------- | --------- | ------------------- | ----------------------------------------------------------------------------- |
| **Electron + Next.js**   | ~150–250 MB | Low              | Full      | Mature (electron-builder, electron-forge) | Easiest path. Runs Next.js in a child process; `BrowserWindow` loads `http://localhost:<port>`. |
| **Tauri 2 + Next.js**    | ~20–60 MB   | Medium           | Via Rust sidecar | Signing supported, smaller surface | Smaller binaries, uses system webview. Requires a Node sidecar for the Next server because Tauri's backend is Rust. |
| **Next.js static export + Tauri** | ~10–30 MB | High | None on client | Same as Tauri | Would require rewriting server API routes as Tauri Rust commands or in-browser logic. High-cost rewrite — not recommended. |
| **Pake / Neutralino**    | small       | Low              | Limited   | Weak                | Not mature enough for a financial tool. Skip.                                 |

**Recommendation: Electron for v1**, Tauri as a v2 optimization.

Reasoning: Electron lets us keep the existing Next.js API routes and
Prisma client untouched. The server runs as a child process; the
window is a thin shell. Bundle size is the only real cost, and 200 MB
is acceptable for a founder tool. Tauri would require us to either run
Node as a sidecar (defeats the size benefit for this app) or port all
server handlers to Rust (a months-long rewrite).

---

## 4. Database: Postgres → SQLite

### Schema changes required

Change `prisma/schema.prisma:9`:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

Review each column:

- `BigInt` — supported by SQLite via Prisma (stored as INTEGER).
  `shareCount`, `authorizedCommonShares`, etc. all work.
- `Decimal @db.Decimal(20, 8)` — **SQLite has no native Decimal**.
  Prisma stores Decimal as `DECIMAL` text in SQLite, but `@db.Decimal`
  native-type attributes are Postgres-only and must be removed. The
  Decimal client type is preserved and `decimal.js` in the calc
  engine is unaffected.
- `Json` (`settings`, `snapshotJson`, `notesJson`, `beforeJson`,
  `afterJson`) — Prisma stores as TEXT on SQLite. Works, but
  filtering/indexing by JSON path is not available. We don't currently
  query by JSON path, so no behavior change.
- Enums — SQLite has no ENUM type; Prisma emulates them as TEXT with
  application-level validation. No code change needed.

### Migration path for existing Postgres users

Since no one is running this in production yet (v0.1.0, no prod
migrations folder committed), we can:

1. Keep a `prisma/schema.postgres.prisma` for the cloud/self-host
   Docker path (optional — the docker-compose story still works).
2. Make `prisma/schema.prisma` the SQLite desktop schema.
3. Generate fresh SQLite migrations under
   `prisma/migrations-sqlite/`.
4. Document both in README.

Alternative (simpler): **drop PostgreSQL entirely** and go
SQLite-only. For a modeling tool that a single founder uses on a
laptop, SQLite handles every realistic workload (hundreds of
stakeholders, thousands of rounds). This is the recommended path.

### Data directory resolution

Add a small helper invoked at Prisma-client construction:

```ts
// src/lib/data-dir.ts  (new)
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const dir =
    process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Application Support", "OpenCap")
      : process.platform === "win32"
      ? path.join(process.env.APPDATA ?? os.homedir(), "OpenCap")
      : path.join(os.homedir(), ".local", "share", "OpenCap");
  fs.mkdirSync(dir, { recursive: true });
  return `file:${path.join(dir, "opencap.db")}`;
}
```

Then in `src/lib/prisma.ts`, set `process.env.DATABASE_URL` from this
helper before constructing the client.

---

## 5. Desktop shell (Electron) — concrete design

New files:

- `electron/main.ts` — app lifecycle, spawns Next.js server, creates
  `BrowserWindow`, handles menu, quit.
- `electron/preload.ts` — exposes a minimal IPC surface (backup/restore,
  open-data-folder, app-version). Context isolation ON.
- `electron/migrate.ts` — runs `prisma migrate deploy` against the
  user's local DB on first launch and on version bumps.
- `electron-builder.yml` — packaging config (mac dmg + zip, windows
  nsis + portable, linux AppImage).

New scripts in `package.json`:

```json
"desktop:dev": "concurrently \"pnpm dev\" \"electron electron/main.ts\"",
"desktop:build": "pnpm build && electron-builder",
"desktop:build:mac": "pnpm build && electron-builder --mac",
"desktop:build:win": "pnpm build && electron-builder --win"
```

Runtime flow:

1. Electron `main.ts` boots.
2. Resolve data directory, set `DATABASE_URL=file:<userdata>/opencap.db`.
3. Run Prisma migrations against that file.
4. On first run, run the existing `prisma/seed.ts` demo company
   (gated by a flag file).
5. Fork the Next.js server on a random free port.
6. Create `BrowserWindow` pointing at `http://127.0.0.1:<port>`.
7. On quit, kill the Next child.

Security-relevant defaults:

- `nodeIntegration: false`, `contextIsolation: true`,
  `sandbox: true` on the BrowserWindow.
- Bind the Next.js server to `127.0.0.1` only (not `0.0.0.0`) so the
  API is unreachable from the network.
- Block external navigation in `will-navigate`/`setWindowOpenHandler`.

### Next.js "standalone" output

Turn on standalone output in `next.config.mjs`:

```js
output: "standalone",
```

This produces a `.next/standalone` directory with a trimmed
`node_modules` that Electron can bundle directly — cuts bundle size
~40% vs shipping the full `node_modules`.

---

## 6. Backup, restore, and data portability

Desktop users move machines and lose laptops, so we should add:

1. **Export DB** — menu item that copies `opencap.db` to a user-chosen
   location (uses Electron `dialog.showSaveDialog`).
2. **Import DB** — replaces the current file after a confirmation
   dialog; renames the previous file to `opencap.db.bak-<timestamp>`.
3. **Open data folder** — reveals the user's data directory in Finder /
   Explorer. Useful for support.
4. **Automatic versioned backups** — before every migration, copy
   `opencap.db` → `opencap.db.pre-<version>.bak`. Keep last 5.
5. **Existing OCF JSON export** already covers logical-level
   portability; the above adds file-level portability.

These go on the Electron native menu (File → Export / Import / Open
Data Folder) rather than in the Next.js UI, so they work even if the
DB is corrupted and the web UI can't boot.

---

## 7. Updates, signing, telemetry

| Concern        | V1 plan                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------- |
| Auto-update    | `electron-updater` (GitHub Releases feed). Wire up in v1; default off until signed.      |
| macOS signing  | Developer ID Application cert + `notarytool` notarization in the release workflow.       |
| Windows signing| EV or standard code-signing cert; defer to v1.1 if procurement lags.                     |
| Telemetry      | Keep off. `ENABLE_TELEMETRY` is already `false`; remove the env var entirely until we build real telemetry. |
| Crash reports  | Optional, opt-in, off by default. Consider Sentry later — not v1.                        |

---

## 8. Testing and CI

- **Unit tests** (`pnpm test`) — unchanged; provider swap doesn't touch
  the calc engine. Add one test that exercises Prisma against an
  in-memory SQLite URL to catch schema regressions.
- **E2E** — run Playwright against a dev server backed by a temp
  SQLite file.
- **CI matrix** — add GitHub Actions jobs:
  - `build-mac` on `macos-14` (arm64 + x64 universal).
  - `build-win` on `windows-latest`.
  - `build-linux` on `ubuntu-latest` (AppImage).
  Each runs `pnpm desktop:build:<os>` and uploads the artifact.

---

## 9. Risks

1. **Prisma binary targets.** Prisma engine binaries are per-platform;
   must list `native`, `darwin-arm64`, `darwin`, `windows`,
   `linux-musl` in `generator client.binaryTargets` and package them.
   Common Electron packaging pitfall — the app runs locally but breaks
   on another user's machine.
2. **ASAR and native modules.** Prisma's query engine is a native
   binary and must be unpacked from ASAR (`asarUnpack` rule in
   electron-builder config).
3. **Decimal precision on SQLite.** Prisma represents Decimal as
   strings over SQLite. If any code path does `Number(x)` it will
   silently lose precision. The calc engine already uses
   `decimal.js`, so this is low risk, but we should audit coercions in
   `src/app/api/**` route handlers.
4. **Port collisions.** Always pick a free port at runtime; never
   hardcode `3000`.
5. **First-run seed logic.** Today seeding is a manual step; on
   desktop it must be idempotent and gated (`first-run.flag` in the
   data dir).
6. **Deployment docs drift.** The README currently pushes cloud
   deploy buttons. We need a "Desktop (recommended)" section above
   them.

---

## 10. Proposed work breakdown

Milestone 1 — **SQLite migration** (1–2 days)
- `prisma/schema.prisma` → `provider = "sqlite"`; strip `@db.Decimal`
  attributes.
- Add `src/lib/data-dir.ts`; wire into `src/lib/prisma.ts`.
- Regenerate migrations folder as `prisma/migrations/`.
- Update `.env.example` (drop `NEXTAUTH_*`, default
  `DATABASE_URL="file:./opencap.db"`).
- Verify `pnpm test` and golden-file fixtures still pass.

Milestone 2 — **Electron shell** (2–3 days)
- `electron/main.ts`, `preload.ts`, `migrate.ts`.
- Turn on `output: "standalone"`.
- `electron-builder.yml` with mac/win/linux targets.
- `desktop:dev` / `desktop:build*` scripts.
- Backup/restore menu items.

Milestone 3 — **CI + release** (1–2 days)
- GitHub Actions matrix build.
- Draft release workflow uploading DMG, EXE, AppImage.
- README: add "Install the desktop app" section with download links.

Milestone 4 — **Signing & auto-update** (separate, gated on certs)
- Apple notarization in CI.
- Windows signing.
- `electron-updater` with GitHub Releases feed.

Milestone 5 (optional) — **Tauri exploration**
- Spike a Tauri 2 build sharing the same Next.js server (as a Node
  sidecar). Compare bundle size and startup time before committing.

---

## 11. Out of scope

- Multi-user / multi-device sync. Local-first means local-only for v1.
  A later "Sync" feature could layer on top (e.g., via the user's own
  Dropbox/iCloud folder) but is explicitly deferred.
- Mobile apps.
- Replacing the web/cloud deployment path. Docker/Fly/Render configs
  stay; the desktop build is additive.
- End-to-end encryption of the DB file at rest. Reasonable future
  work; not required for a tool operating inside the user's OS
  account.
