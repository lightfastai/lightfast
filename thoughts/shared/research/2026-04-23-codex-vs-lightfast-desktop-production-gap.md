---
date: 2026-04-23T12:53:58Z
researcher: claude
git_commit: 3dddce5adbe3a6e6cd2f462bc348a0de65aee0e5
branch: main
topic: "Codex.app vs apps/desktop — production-grade baseline gap analysis"
tags: [research, desktop, electron, codex, packaging, sparkle, production]
status: complete
last_updated: 2026-05-06
last_updated_note: "PR #621 + PR #637 landed; G-7 closed. Remaining gates G-1..G-6 enumerated for first-class signed v0.1.0."
plans:
  - thoughts/shared/plans/2026-04-23-desktop-codex-gap-quick-wins.md
  - thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md
  - thoughts/shared/plans/2026-05-06-desktop-rc1-ad-hoc-dry-run.md
verifications:
  - thoughts/shared/research/2026-05-06-desktop-prod-readiness-status-verification.md
---

# Research: Codex.app vs `apps/desktop` — Production-Grade Baseline Gap

**Date**: 2026-04-23T12:53:58Z
**Git Commit**: 3dddce5adbe3a6e6cd2f462bc348a0de65aee0e5
**Branch**: main

## Research Question

What production-grade Electron baseline capabilities are present in OpenAI's Codex Electron app (`/Applications/Codex.app`, v26.417.41555, build 1858) that are **absent** from `apps/desktop/` today?

Four parallel subagents investigated: (A) the extracted `app.asar` source, (B) the `.app` bundle's packaging/signing/resources, (C) the full `apps/desktop` source tree, and (D) Codex's runtime userData layout.

## Summary

`apps/desktop` already ships a solid security + IPC foundation: fuses (all six enabled identically to Codex), sandbox + contextIsolation + nodeIntegration=false, a CSP pipeline, a blanket-deny permission handler, single-instance lock, `will-navigate` + `setWindowOpenHandler` hardening, safeStorage-backed token persistence, three-window kinds, tray, global shortcut, and a Sentry wiring. Forge is configured with conditional osxSign/osxNotarize/GitHub publisher guarded by env vars.

The gap to Codex's production baseline is concentrated in **nine areas**: (1) Sparkle-native auto-update with Ed25519 signature verification, (2) on-disk structured logging with date partitioning, (3) persistent structured storage (SQLite) with schema-versioning, (4) a worker/utility-process tier for heavy work, (5) Windows MSIX + Linux build surfaces, (6) multi-arch / universal-binary builds, (7) per-surface preload isolation, (8) renderer + menu i18n beyond `en`, and (9) a dev/test tooling set (Playwright CDP harness, devtools reset, source-map upload, third-party notices). Six smaller items sit alongside these — placeholder build metadata (`version: "0.0.0"`, empty `sparkleFeedUrl`/`sparklePublicKey`), an over-broad entitlement set (camera, network.server, disable-library-validation — Codex carries none of these), dead `showContextMenu` IPC, unwired `silentRefresh`, deep-link handler that only logs, and no `NSAppTransportSecurity`/`CFBundleDocumentTypes`/`NSQuitAlwaysKeepsWindows` Info.plist entries.

## Status Tracker

Plans:
- [`thoughts/shared/plans/2026-04-23-desktop-codex-gap-quick-wins.md`](../plans/2026-04-23-desktop-codex-gap-quick-wins.md) — implemented 2026-04-23 (all 4 phases landed).
- [`thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md`](../plans/2026-04-23-desktop-pre-release-batch.md) — drafted 2026-04-23; 6 phases closing the pre-v0.1.0-release gap (monorepo release host, tag convention `@lightfast/desktop@<version>`, Sentry source-map upload, signed workflow enablement, desktop CI coverage, contributor ergonomics).

Legend: **DONE** = landed on `main` · **IN PROGRESS** = scoped into the pre-release batch plan · **DEFERRED** = intentionally out of scope right now · **RELEASE** = future release-pipeline work beyond v0.1.0.

| § | Finding | State | Notes |
|---|---|---|---|
| 1 | Auto-update: Sparkle + Ed25519 | **RELEASE** | Whole auto-update surface |
| 2 | On-disk logging (file logger) | **DEFERRED** | Larger effort, no consumer yet |
| 2 | Sentry tags + RewriteFrames (non-release subset) | **DONE** | Plan Phase 3 — `sentry.ts` adds `sessionId`, `bundle`, `host` tags, `dist=buildNumber`, `rewriteFramesIntegration({root: app.getAppPath(), prefix: "app:///"})`. DSN-gated end-to-end check still pending a real DSN. |
| 2 | Source-map upload / `@sentry/cli` | **IN PROGRESS** | Pre-release batch Phase C — `scripts/upload-sourcemaps.mjs` uploads `.vite/build` + `.vite/renderer/main_window` with `--url-prefix "app:///"` matching `rewriteFramesIntegration`. |
| 2 | Explicit `crashReporter.start({uploadToServer:false})` | **DEFERRED** | `@sentry/electron` already handles Crashpad; skip to avoid double-init |
| 3 | Persistent SQLite storage | **DEFERRED** | No consumer yet |
| 4 | Worker / utility-process tier | **DEFERRED** | No workload demands it yet |
| 5 | Windows MSIX + Linux makers | **RELEASE** | Deferred past v0.1.0 (macOS only for first release) |
| 6 | Multi-arch (arm64 + x64) | **IN PROGRESS** | Pre-release batch Phase D — workflow matrix builds both arches; published as separate artifacts, no universal merge. |
| 6 | Universal binary merge | **DEFERRED** | `@electron/universal` not needed; two separate artifacts with `${arch}` feed template suffice. |
| 7 | Per-surface preload isolation | **DEFERRED** | No third-party surfaces yet |
| 8 | Menu + renderer i18n | **DEFERRED** | Policy decision pending |
| 9 | Dev/test tooling (Playwright, devtools:reset, 3p-notices) | **DEFERRED** | Multi-day work |
| 10 | Deep-link URL→route dispatcher | **DEFERRED** | Plan Phase 4's trim of the dead `console.log` landed as a side-effect of the separate auth-flow rewrite (the `onDeepLink` handler was removed from `index.ts` entirely). Full URL→route dispatcher still deferred — needs a route table. |
| 11 | Entitlements diet (drop `disable-library-validation`, `device.camera`, `network.server`) | **DONE** | Plan Phase 1, commit `40b36bb56`. Source `entitlements.mac.plist` trimmed to 5 keys. |
| 12 | Info.plist hygiene (`NSQuitAlwaysKeepsWindows=false`, `LSMinimumSystemVersion=12.0`, `MallocNanoZone=0`) | **DONE** | Plan Phase 2. Verified in packaged `Info.plist` via `plutil -p` 2026-04-23. |
| 12 | `NSAppTransportSecurity` / `CFBundleDocumentTypes` / `SUPublicEDKey` / `ElectronAsarIntegrity` / `NSPrincipalClass` | **DEFERRED** / **RELEASE** | Not applicable, release-only, or already auto-set by Forge |
| 13 | Non-empty `version`, `buildNumber`, `sparkleFeedUrl` | **IN PROGRESS** | Pre-release batch Phase D — workflow stamps via `npm pkg set` at build time. `sentryDsn` added to the same stamp path. |
| 13 | `sparklePublicKey` | **DROPPED** | Pre-release batch Phase B — unused (Electron `autoUpdater` doesn't consume it). Field removed from `package.json`, `env.ts`, `build-info.ts`, `ipc.ts`. |
| 14 | Dead `showContextMenu` IPC | **DONE** | Plan Phase 4 — removed from `src/shared/ipc.ts`. |
| 14 | Unwired `silentRefresh` | **DONE** | Superseded by the `auth-flow.ts` loopback-HTTP-server rewrite which replaced the whole `BrowserWindow`/`runAuthWindow` flow; `silentRefresh` + `REFRESH_TIMEOUT_MS` no longer exist. |
| 14 | Deep-link `console.log` | **DONE** | Superseded by the same rewrite — `onDeepLink` handler was removed from `index.ts`; the log it carried is gone. |
| 15 | Notifications / dock badge / sound | **DEFERRED** | UX decision |

## Detailed Findings

### 1. Auto-update: Electron `autoUpdater` vs. Sparkle-native with Ed25519

**Codex** ships a custom C++/Obj-C bridge `Contents/Resources/native/sparkle.node` loaded via `createRequire(__filename)(path.join(process.resourcesPath, 'native', 'sparkle.node'))` and wired to the Sparkle 2.9.1 framework in `Contents/Frameworks/Sparkle.framework`. The `Info.plist` carries `SUPublicEDKey = rhcBvttuqDFriyNqwTQJR3L4UT1WjIK4QxtwtwusVic=` (32-byte Ed25519 public key, Sparkle 2 EdDSA appcast-signing style). The JS-side `SparkleManager` dispatches to three backends:
- macOS Sparkle via `sparkle.node`
- Windows MSIX direct via `windows-updater.node` (fetches JSON manifest, SHA-256-verifies the `.msix`, stages to `userData/windows-msix-updater/<packageFamily>/`, calls `stagePackage()` + `activateStagedPackage()`)
- Windows Store via `trySilentDownloadStoreUpdates()`

Background polling interval: 15 minutes (env-overridable via `SPARKLE_UPDATE_INTERVAL_MINUTES`). Update cache dir: `~/Library/Caches/com.openai.codex/org.sparkle-project.Sparkle/{Installation,Launcher,PersistentDownloads}`.

**`apps/desktop`** uses Electron's built-in `autoUpdater` (Squirrel.Mac under the hood) in `src/main/updater.ts:1-123`. This:
- Has no EdDSA / public-key verification path — relies solely on codesign of the downloaded zip
- Supports only a single `{url}` feed with `${arch}` template (`updater.ts:27-29`); no appcast, no delta metadata, no phased rollout
- `package.json:62-63` has **empty strings** for `sparkleFeedUrl` and `sparklePublicKey`, so `initUpdater` exits early on darwin packaged builds unless `SPARKLE_FEED_URL` is set at runtime (`updater.ts:84-87`)
- Single post-boot check after 10 s (`updater.ts:120-122`); no polling interval
- `scripts/generate-update-feed.mjs` only writes Squirrel.Mac-format JSON (`latest-mac-arm64.json`, `latest-mac-x64.json`) via `gh release upload`; no Windows feed generation, no feed signing

**What's missing**: Sparkle-native native addon (or a fallback to a signed appcast verified in-process), Windows MSIX updater, Windows Store updater, periodic background check, feed-signing in release pipeline, non-empty `sparkleFeedUrl`/`sparklePublicKey` baked into `package.json`.

Evidence: `src/main/updater.ts:31-42`, `src/main/build-info.ts`, `scripts/generate-update-feed.mjs`, extracted Codex `workspace-root-drop-handler-B6CbYVqW.js` (SparkleManager + MSIX backends), `/Applications/Codex.app/Contents/Info.plist` (`SUPublicEDKey`).

### 2. On-disk logging & crash reporting

**Codex** writes per-launch logs to `~/Library/Logs/com.openai.codex/YYYY/MM/DD/codex-desktop-<sessionUuid>-<pid>-t<0|1>-i1-<HHMMSS>-<seq>.log` with two streams per session (`t0` / `t1`). 16 files = 9.5 MB on this machine, ranging 100K–3.1M per file. Per-launch files, not size-rotated. Sentry runs with Electron minidump integration (`crashReporter.start({uploadToServer: false})`) and session tags: `sessionId`, `preRelease`, `buildFlavor`, `bundle: "electron"`, `host: "app"`. Release format `<name>@<version>+<buildNumber>`, dist `<buildNumber>` (1858 here). `RewriteFrames` integration with `root: app.getAppPath()`, prefix `app:///`. Chromium Crashpad dir present at `Application Support/Codex/Crashpad/`.

**`apps/desktop`** writes nothing to disk. `src/main/index.ts:197-198` uses `console.error` for renderer errors; there is no file logger anywhere. `src/main/sentry.ts:1-27` calls `Sentry.init` with DSN + release + environment only — no session tag, no dist tag, no RewriteFrames, no explicit `crashReporter.start`, no minidump integration options set.

**What's missing**:
- File-backed structured logger (main + renderer) with date-partitioned path layout
- Explicit `crashReporter.start()` + `uploadToServer` policy
- Sentry tags: `sessionId` (`crypto.randomUUID()` once per launch), `dist` (buildNumber), `bundle`/`host`
- Sentry `RewriteFrames` with `app:///` prefix so stack traces match uploaded source maps
- Source-map upload script to Sentry in CI (no script exists in `scripts/`)

Evidence: `src/main/sentry.ts:1-27`, `src/main/index.ts:196-199`, `thoughts/shared/research/...` — nothing writes logs. Codex runtime logs per subagent D; Sentry wiring per subagent A §7.

### 3. Persistent structured storage (SQLite)

**Codex** runs `better-sqlite3` (kept in `app.asar.unpacked/node_modules/better-sqlite3`) with three tables in `codex.db`: `inbox_items`, `automations` (rrule-driven), `automation_runs`. Additionally two Rust-side sqlx-managed DBs live under `~/.codex/`: `logs_2.sqlite` (195 MB on this machine), `state_5.sqlite` (`agent_jobs`, `threads`, `backfill_state`, etc.). **Schema migrations are encoded in the filename** (`logs_2`, `state_5`) — new file per breaking schema change, old file kept.

**`apps/desktop`** persists three plain JSON files:
- `<userData>/settings.json` — plain JSON, synchronous `readFileSync`/`writeFileSync`, Zod-validated (`src/main/settings-store.ts:47-53`)
- `<userData>/window-state.json` — plain JSON, debounced writes (`src/main/window-state.ts:41-48`)
- `<userData>/auth.bin` — `safeStorage.encryptString` over `{token, savedAt}` JSON (`src/main/auth-store.ts:46-50`)

There is no SQLite, no structured table, no migration framework, no cache namespacing. Anything durable beyond flat scalars currently has no place to go.

**What's missing**: SQLite dependency (or equivalent), migration strategy (schema-in-filename, or a migrations table), per-subsystem DB path convention, a cache directory layout (Codex uses `<userData>/Cache`, Crashpad, `plugins/cache/*`, `sessions/YYYY/MM/DD/`).

Evidence: `src/main/settings-store.ts`, `src/main/window-state.ts`, `src/main/auth-store.ts`; subagent A §5 (Codex SQLite tables); subagent D (filename-versioned sqlite pattern).

### 4. Worker / utility process tier

**Codex** ships `.vite/build/worker.js` (1.1 MB) as a dedicated worker thread handling the AI request pipeline and streaming (subagent A §1). It also spawns two bundled Rust binaries as long-running children: `codex` (`app-server`, 163 MB) and `codex_chronicle` (4.2 MB), communicating over stdio JSON-RPC with UUID-tagged message IDs. Plus a tiny Swift helper `launch-services-helper` for `NSWorkspace` bundle resolution, invoked via `promisify(execFile)`.

**`apps/desktop`** has no worker threads, no utility processes, no child process spawning beyond the visible auth-flow `BrowserWindow`. Heavy work (when it arrives) would land on the main process or the renderer.

**What's missing**: A pattern + at least one worker boilerplate for off-main-thread CPU or I/O work. If the product grows toward local indexing, streaming, or long-running tRPC subscriptions, needing this is a matter of when, not if.

Evidence: subagent A §1; no `Worker`/`utilityProcess`/`child_process.spawn` imports found in `apps/desktop/src/main/`.

### 5. Windows MSIX & Linux build surfaces

**Codex** (from its extracted `package.json`) declares `@electron-forge/maker-deb`, `maker-rpm`, `maker-msix`, `maker-squirrel`, `maker-dmg`, `maker-zip`, plus `electron-windows-msix` and `electron-installer-dmg`.

**`apps/desktop` `forge.config.ts:87-96`** declares only: `MakerSquirrel` (win32), `MakerZIP` (darwin), `MakerDMG` (darwin, ULFO format). No deb, rpm, Flatpak, MSIX, or Wix.

**What's missing**: `@electron-forge/maker-deb`, `maker-rpm`, `maker-msix` (or a deliberate decision that Linux + Windows-store distribution is out of scope). If MSIX is adopted, the Codex-style MSIX-direct updater path in §1 becomes a dependency.

Evidence: `apps/desktop/forge.config.ts:87-96`; subagent B §5 / subagent A §3.

### 6. Multi-arch / universal binary

**Codex** ships **arm64-only** (every `lipo -info` reports `Non-fat file` — `codex`, `codex_chronicle`, `rg`, `node`, `sparkle.node`, `launch-services-helper`, the main app). So the gap is symmetrical on darwin — both are single-arch per build.

**`apps/desktop`** has no `packagerConfig.osxUniversal` / `arch` override in `forge.config.ts:58-85`. Each build invocation produces one architecture.

**What's missing (both)**: A `universal` build configuration (`@electron/universal` via `osxUniversal: { mergeASARs: true }`), or an explicit policy "arm64 + x64 built and published as two separate artifacts" with both feed entries in `generate-update-feed.mjs`. The current `${arch}` template in `updater.ts:27-29` supports two separate feeds; what's missing is CI that actually produces both arm64 and x64 artifacts.

Evidence: `forge.config.ts:58-85`; subagent B §6.

### 7. Per-surface preload isolation

**Codex** ships **two** separate preload bundles: `preload.js` (~2 KB, tiny context bridge for primary windows) and `browser-sidebar-comment-preload.js` (24 MB — full CodeMirror, KaTeX, Mermaid, React UI for the in-app browser commenting surface). The bundles differ dramatically in surface area; preload isolation per window kind is enforced at the Electron layer.

**`apps/desktop`** uses a single `src/preload/preload.ts` (3.5 KB) for all three window kinds (primary, secondary, hud). The Vite plugin only has one preload entry (`forge.config.ts:104-109`). Window kind is passed via `additionalArguments: ["--window-kind=<kind>"]` and read back in the preload — but the preload module itself is identical regardless.

**What's missing**: If/when surfaces with differing trust characteristics are added (in-app browser, third-party plugins, untrusted iframes), the Forge config needs a second preload entry, and `src/main/windows/factory.ts` needs per-kind preload path resolution. Today this isn't blocking — three kinds all render first-party content — but the build config has no slot for it.

Evidence: subagent A §6 (Codex preload split); `apps/desktop/forge.config.ts:104-117`; `src/preload/preload.ts`; `src/main/windows/factory.ts:42-51`.

### 8. i18n: menu strings + renderer

**Codex** ships 52 `.lproj` directories (standard Electron/macOS system locale declarations) plus a `native-menu-locales/*.json` directory (e.g. `de-DE.json`, `fr-FR.json`, `pt-BR.json`) loaded at runtime via `app.getLocale()` → `<appPath>/native-menu-locales/<locale>.json` with language-subtag fallback, Zod-parsed. The renderer consumes locale chunks as per-language JS bundles (e.g. `el-GR-ABLLedEp.js`) through React-Intl's `formatMessage`.

**`apps/desktop`** has only `src/main/locales/en.json` (28 menu keys). `src/main/menu.ts:18-31` resolves locale via `app.getLocale()`, splits on `-`, falls back to `en` if no match. The renderer hardcodes all strings in English in `index.html` and TSX files — no i18n library is wired.

**What's missing**: Additional locale files for the menu (non-blocking if English is policy), and a decision on renderer i18n (react-intl / lingui / none).

Evidence: `apps/desktop/src/main/menu.ts:18-31`, `src/main/locales/en.json`; subagent A §12, subagent B §8.

### 9. Dev/test tooling shipped

| Tool | Codex | `apps/desktop` |
|---|---|---|
| CDP port via env var | Yes (`bootstrap.js`) | Yes — `LIGHTFAST_REMOTE_DEBUG_PORT` (`src/main/bootstrap.ts:14-27`) |
| Playwright Electron harness | `scripts/playwright-electron-agent-cdp.mjs` + `playwright: ^1.58.2` devDep | No |
| DevTools reset | `devtools:reset` npm script clears extensions + Service Worker + Code Cache | No |
| Third-party-notices generator | `generate:third-party-notices` via parent monorepo | No |
| Native rebuild helpers | `rebuild:sqlite.mjs`, `rebuild-forge-natives.mjs`, `ensure-electron-binary.mjs`, `build-launch-services-helper.mjs`, `owl-shell.mjs` | No (no native deps currently) |
| Sentry source-map upload | `@sentry/cli` in devDeps (CI pipeline-owned) | No |
| Metadata probe | `metadata-path`, `metadata-probe` (tsx scripts) | No |

Only `scripts/generate-update-feed.mjs` exists in `apps/desktop/scripts/`.

Evidence: `apps/desktop/scripts/` directory listing; Codex extracted `package.json` scripts (subagent A §1).

### 10. Deep-link routing

**Codex** registers `codex://` via `app.setAsDefaultProtocolClient('codex')` (subagent A §11). Queued deep links flush after `runMainAppStartup()` via `deepLinks.flushPendingDeepLinks()`. The only live path in the bundle is `codex://connector/oauth_callback`, dispatched to the connector OAuth subsystem.

**`apps/desktop`** has the full registration plumbing in `src/main/protocol.ts:1-42` (single-instance argv scan, `open-url` on mac, `second-instance` argv scan, startup argv scan with `pendingUrl` buffer). But the main-process handler in `src/main/index.ts:367-373` **only `console.log`s the URL and focuses the primary window** — no path/param dispatch into the renderer, no route table. The `auth-flow.ts` OAuth callback is captured *inside* the sign-in window's own session protocol handler (`src/main/auth-flow.ts:95-101`), independent of the main-process deep-link dispatcher.

**What's missing**: A URL-to-renderer-route dispatcher (e.g., parse `lightfast://settings` → send IPC to primary window → renderer router navigates). Today the deep-link infrastructure exists but has no consumer.

Evidence: `src/main/protocol.ts:1-42`, `src/main/index.ts:367-373`.

### 11. Entitlements audit (over-broad on our side)

| Entitlement | `apps/desktop` main | Codex main |
|---|---|---|
| `com.apple.security.cs.allow-jit` | true | true |
| `com.apple.security.cs.allow-unsigned-executable-memory` | true | true |
| `com.apple.security.cs.disable-library-validation` | **true** | **absent** |
| `com.apple.security.device.audio-input` | true | true |
| `com.apple.security.device.camera` | **true** | **absent** |
| `com.apple.security.network.client` | true | true |
| `com.apple.security.network.server` | **true** | **absent** |
| `com.apple.security.files.user-selected.read-write` | true | true |
| `com.apple.security.app-sandbox` | (not present) | false (explicit) |

**What's missing (removal)**: Three entitlements we request that Codex — shipping a much larger surface area including a Rust app-server + in-app browser + camera usage description — does not. Each expands the attack surface: `disable-library-validation` lets unsigned dylibs load into our process; `device.camera` grants camera access we don't use; `network.server` lets us bind listen sockets. Codex binds nothing and keeps library validation on.

Helper entitlements: both apps use identical entitlements across all four helpers (GPU / Renderer / Plugin). Neither differentiates.

Evidence: `apps/desktop/build/entitlements.mac.plist` (via subagent C §14); subagent B §2.

### 12. Info.plist gaps

| Key | Codex | `apps/desktop` extendInfo |
|---|---|---|
| `NSAppTransportSecurity` → `NSAllowsArbitraryLoads` | `true` | absent |
| `NSQuitAlwaysKeepsWindows` | `false` | absent |
| `NSPrefersDisplaySafeAreaCompatibilityMode` | `false` | absent |
| `CFBundleDocumentTypes` | Folder viewer (`public.folder`) | absent |
| `LSEnvironment` → `MallocNanoZone` | `0` | absent |
| `LSMinimumSystemVersion` | `12.0` | (forge default) |
| `SUPublicEDKey` | set (Ed25519) | absent |
| `ElectronAsarIntegrity` | set (one `app.asar` SHA-256) | auto-added by forge (Fuse enabled) |
| `NSPrincipalClass` | `AtomApplication` | (forge default) |
| `NSSupportsAutomaticGraphicsSwitching` | true | `true` (set at `forge.config.ts:71`) |
| `NSHighResolutionCapable` | true | `true` (set at `forge.config.ts:70`) |

**What's missing (non-security)**: No explicit `LSMinimumSystemVersion` policy, no document-type registration, no `MallocNanoZone=0` (Electron's official guidance to avoid a macOS allocator crash on some chipsets), no `NSQuitAlwaysKeepsWindows=false` (prevents macOS from reopening windows after quit).

Evidence: `apps/desktop/forge.config.ts:68-84`; subagent B §1.

### 13. Build metadata placeholders in `package.json`

`apps/desktop/package.json:3,60-63`:
- `version: "0.0.0"`
- `buildFlavor: "dev"` → this disables the updater entirely in packaged builds (`src/main/updater.ts:78-82`)
- `buildNumber: "1"`
- `sparkleFeedUrl: ""`
- `sparklePublicKey: ""`

All five are placeholders. The updater, release artifact naming, and Sentry dist tag all depend on these.

Codex baked-in values: `version: 26.417.41555`, `codexBuildFlavor: "prod"`, `codexBuildNumber: "1858"`, `codexSparkleFeedUrl: "https://persistent.oaistatic.com/codex-app-prod/appcast.xml"`, `codexSparklePublicKey: "rhcBvttuqDFriyNqwTQJR3L4UT1WjIK4QxtwtwusVic="`.

Evidence: `apps/desktop/package.json:3,60-63`; subagent A `package.json` dump.

### 14. Dead / unwired IPC + features

- `IpcChannels.showContextMenu` is declared in `src/shared/ipc.ts:8` but has **no `ipcMain.handle`/`on` registration in `src/main/index.ts`** and no `ipcRenderer` call in `src/preload/preload.ts` — the channel is dead code.
- `silentRefresh` is exported from `src/main/auth-flow.ts:116-118` but has no call site. No 401/expired-token handler at the main-process level triggers it; `src/renderer/src/react/app-shell.tsx` only calls `signOut` on UNAUTHORIZED.
- Deep-link handler in `src/main/index.ts:367-373` only `console.log`s — see §10.

Evidence: `src/shared/ipc.ts:8`; `src/main/auth-flow.ts:116-118`; `src/main/index.ts:367-373`.

### 15. Notifications, dock badge, sound

**Codex** ships `notification.wav` in `Contents/Resources/` and has a `NOTIFICATIONS_QUESTIONS_ENABLED` feature flag in the config system.

**`apps/desktop`** has no `Notification` usage, no dock badge / bounce, no sound assets.

**What's missing**: A notifications policy — at minimum, whether to use `new Notification(...)` for completion/deep-link events and whether to set a dock badge for unread counts.

Evidence: subagent B §12 (Codex Resources list); no `Notification`/`setBadgeCount` usage found in `apps/desktop/src/`.

## Code References

- `apps/desktop/forge.config.ts:58-132` — packager + makers + plugins + fuses + publisher
- `apps/desktop/src/main/bootstrap.ts:1-36` — single-instance + userData path + CDP
- `apps/desktop/src/main/index.ts:75-148` — CSP + hardenContents
- `apps/desktop/src/main/index.ts:336-339` — permission handler denies all
- `apps/desktop/src/main/index.ts:367-373` — deep-link handler (only logs)
- `apps/desktop/src/main/updater.ts:27-42,78-123` — feed URL resolution + init conditions
- `apps/desktop/src/main/auth-store.ts:46-50` — safeStorage token write
- `apps/desktop/src/main/auth-flow.ts:39-101,116-118` — OAuth flow + unused silentRefresh
- `apps/desktop/src/main/settings-store.ts:47-53` — plain-JSON settings
- `apps/desktop/src/main/window-state.ts:41-74` — debounced state + off-display fallback
- `apps/desktop/src/main/sentry.ts:1-27` — minimal Sentry init
- `apps/desktop/src/preload/preload.ts:15-94` — single preload, `contextBridge` exports
- `apps/desktop/src/shared/ipc.ts:1-8` — all channel names; `showContextMenu` dead
- `apps/desktop/build/entitlements.mac.plist` — over-broad entitlements
- `apps/desktop/scripts/generate-update-feed.mjs` — mac-only feed generation
- `apps/desktop/package.json:60-63` — empty placeholder build metadata

## Architecture Documentation

### Shared baseline (Codex ↔ Lightfast, both present)

| Capability | Both |
|---|---|
| Electron Forge + plugin-vite | Yes |
| FusesPlugin V1 with identical six flags | Yes |
| asar + `app.asar.unpacked` for natives | Yes (Lightfast via `AutoUnpackNativesPlugin`) |
| Single-instance lock | Yes |
| `contextIsolation + sandbox + nodeIntegration=false` | Yes |
| CSP via `onHeadersReceived` | Yes |
| `setPermissionRequestHandler` blanket deny | Yes |
| `setWindowOpenHandler` + `will-navigate` harden | Yes |
| `safeStorage`-backed secret | Lightfast: auth.bin; Codex: not confirmed, but keychain patterns exist |
| Deep-link registration (initial argv + `open-url` + `second-instance`) | Yes |
| Hardened runtime + notarization + stapler | Codex: stapled ticket present; Lightfast: env-gated in forge config |
| GitHub publisher | Codex publishes to OAI infra; Lightfast env-gated |
| Tray template image | Yes |
| nativeTheme broadcast to renderer | Yes |
| React 19 + Vite renderer | Yes |

### Runtime userData layout (Codex reference, for comparison)

Codex persists to three roots:
- `~/.codex/` — CLI-legacy + Electron shared state: TOML config, sqlx-managed sqlite (`logs_2.sqlite`, `state_5.sqlite`, filename-versioned), `sessions/YYYY/MM/DD/`, `archived_sessions/`, `skills/`, `automations/`, `ambient-suggestions/<sha1>/`, `vendor_imports/skills/.git/`, `worktrees/<hash>/`, `log/codex-tui.log` (legacy)
- `~/Library/Application Support/Codex/` — standard Chromium userData: `Cache/`, `GPUCache/`, `Cookies` sqlite, `Local Storage/leveldb/`, `Session Storage/`, `Crashpad/`, `sentry/scope_v3.json`, `Preferences`, `DIPS` (bounce-tracking)
- `~/Library/Logs/com.openai.codex/YYYY/MM/DD/*.log` — per-launch date-partitioned logs, two streams (`t0`, `t1`) per session
- `~/Library/Caches/com.openai.codex/org.sparkle-project.Sparkle/` — Sparkle update cache

Lightfast today writes only flat files to `<userData>`: `settings.json`, `window-state.json`, `auth.bin`.

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-04-23-desktop-clerk-trpc-wiring.md` — current tRPC + Clerk wiring plan for desktop (commit `3dddce5a`, active branch work).
- `thoughts/shared/research/2026-04-20-lightfast-2-barebones-rearchitecture-baseline.md` — earlier rearchitecture baseline research.

No prior research compares against Codex or other reference Electron apps.

## Related Research

- `thoughts/shared/plans/2026-04-23-desktop-codex-gap-quick-wins.md` — phases 1–4 landed 2026-04-23
- `thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md` — 6 phases for v0.1.0 release pipeline (drafted 2026-04-23)
- `thoughts/shared/plans/2026-04-23-desktop-clerk-trpc-wiring.md`
- `thoughts/shared/research/2026-04-20-lightfast-2-barebones-rearchitecture-baseline.md`

## Open Questions

1. Is the intent to stay on Electron's built-in `autoUpdater` (ZIP + Squirrel.Mac) or to adopt Sparkle-native with Ed25519? Codex's choice implies signed-appcast is the target for "production-grade."
2. Is Linux a shipping target? If no, the missing deb/rpm makers is a deliberate scope choice; if yes, they need to be added before the first Linux ask.
3. What's the policy for renderer i18n? The menu-side path is clear (extend `locales/`); the renderer side needs a framework choice.
4. Should the over-broad entitlements (`camera`, `network.server`, `disable-library-validation`) be removed now or left in anticipation of features that will need them?
5. What's the source-map upload strategy for Sentry — Sentry CLI in CI, or a per-release script in `scripts/`?

## Follow-up Research 2026-04-23 (second pass — scripts, CI, monorepo wiring)

Three parallel subagents ran a second pass focused on **project scripts setup**, CI workflows, monorepo integration, and a reference model of Codex's build-time scripts. The first-pass findings were all confirmed. This section adds the new surface area that the first pass didn't cover and sharpens two items with transcribed evidence.

### Follow-up Findings

#### FU-1. `apps/desktop` has **zero** lint, format, or test tooling

`apps/desktop/package.json:14-36` — no `eslint`, `oxlint`, `prettier`, `oxfmt`, `biome`, `vitest`, `jest`, `playwright`, or `@sentry/cli` in dependencies or devDependencies. The five scripts declared are `dev`, `package`, `make`, `publish`, `typecheck` (`package.json:7-13`) — no `lint`, `lint:fix`, `format`, `format:fix`, `test`, `test:unit`, `test:e2e`, `clean`, `rebuild`, `generate:notices`.

Lint coverage today is partial and root-only: `.github/workflows/ci.yml:54` runs `pnpm check` (Biome/ultracite at root) and `pnpm turbo typecheck --affected` — desktop files are caught by root Biome but the app has no local lint/format CLI for developers running inside `apps/desktop/`.

**Codex baseline for comparison** (from `/tmp/codex-extracted/app/package.json:25-60`):
- `lint` / `lint:fix` — `oxlint --threads=1 --tsconfig ./tsconfig.json --max-warnings 0 --type-aware --type-check`
- `format` / `format:fix` — `oxfmt --check` / `oxfmt --write`
- `test` / `test:quiet` — `vitest run`
- `playwright:agent:repl` — interactive Electron-CDP REPL via Playwright
- `compile` / `tsc` — via `tsgo` (Microsoft's native TypeScript compiler) instead of `tsc`

#### FU-2. `rebuildConfig` is empty; no native-rebuild scripts

`apps/desktop/forge.config.ts:86` — `rebuildConfig: {}` is empty. There are no `rebuild:sqlite`, `rebuild:forge-natives`, or `ensure-electron-binary` scripts. This is non-blocking today (no native modules are declared in `dependencies`) but is a precondition for any future SQLite/node-pty/native-addon adoption.

Codex ships three build-time native-rebuild scripts:
- `rebuild-sqlite.mjs` — targeted `better-sqlite3` rebuild against the pinned Electron 41.2.0 ABI (split out because `better-sqlite3` has historically been brittle under `@electron/rebuild`)
- `rebuild-forge-natives.mjs` — omnibus rebuild for `node-pty`, `bufferutil`, `utf-8-validate`
- `ensure-electron-binary.mjs` — guarantees the pinned Electron binary exists on disk before Vitest spins up an Electron host

#### FU-3. CI coverage for desktop is split across three workflows (two inclusive, one disabled)

Root `.github/workflows/`:
- **`ci.yml`** (`ci.yml:54`) — PRs to `main`. Runs `pnpm check` (Biome), `pnpm turbo typecheck --affected`, `boundaries`, `knip`. Desktop **is** included when its files change (via `--affected`). No build, no test.
- **`ci-core.yml`** (`ci-core.yml:45,105`) — Filters to `lightfast`, `@lightfastai/mcp`, `@lightfastai/cli` only. Desktop is **explicitly excluded** from both `typecheck` and `build` jobs.
- **`release.yml`** — Publishes npm packages via `changesets/action`. Desktop (`private: true`) is absent.
- **`verify-changeset.yml`** (`verify-changeset.yml:51,57`) — Allowlist is `lightfast`, `@lightfastai/mcp`, `@lightfastai/cli`. A changeset targeting `@lightfast/desktop` would **fail this check**.
- **`desktop-release.yml.disabled`** — Present on disk with `.disabled` suffix. GitHub Actions ignores `.disabled` files, so the file is inert today.

#### FU-4. Full transcript of `desktop-release.yml.disabled` (what a working desktop release would do)

Three sequential jobs, gated by `push.tags: ['desktop-v*']`:

**`prepare`** (ubuntu-latest): strips `desktop-v` prefix → `gh release create --draft` with static body `"Automated release of @lightfast/desktop."` and secret `GITHUB_TOKEN`.

**`build`** (matrix `arch: [arm64, x64]`, macos-14):
- `pnpm install --frozen-lockfile`
- Stamps `apps/desktop/package.json` in place via `npm pkg set`: `version=<tag>`, `buildFlavor=prod`, `buildNumber=$GITHUB_RUN_NUMBER`, `sparkleFeedUrl=https://github.com/${{ github.repository }}/releases/latest/download/latest-mac-${arch}.json`
- Imports `.p12` Developer ID cert into a temporary keychain (`APPLE_CERT_BASE64`, `APPLE_CERT_PASSWORD`, `KEYCHAIN_PASSWORD`)
- Writes `.p8` notarization key to `$HOME/.private_keys/AuthKey_<id>.p8` and sets `APPLE_API_KEY`
- Runs `pnpm exec electron-forge publish --arch=${{ matrix.arch }} --platform=darwin` from `apps/desktop/`
- Env vars: `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `LIGHTFAST_DESKTOP_RELEASE_REPO`, `GITHUB_TOKEN`

**`finalize`** (ubuntu-latest, `needs: [prepare, build]`):
- `node apps/desktop/scripts/generate-update-feed.mjs` (writes `latest-mac-{arm64,x64}.json` Squirrel.Mac feeds and uploads as release assets)
- `gh release edit ... --draft=false` to promote

**What the disabled workflow is missing** (factual):
- No Sentry release / source-map upload step (even though `@sentry/cli` is in `pnpm-workspace.yaml:82` `onlyBuiltDependencies`, nothing invokes it)
- No Windows job — even though `@electron-forge/maker-squirrel` is in desktop devDeps (`apps/desktop/package.json:17`)
- No Linux job — no deb/rpm makers declared anyway (see first-pass §5)
- No universal-binary merge step (`@electron/universal`)
- No changelog generation — release notes are a static string
- No artifact attestation (`actions/attest-build-provenance`)
- No CDN/S3 appcast publishing — feeds are GitHub Release assets only
- Concurrency group has no `cancel-in-progress: true`

#### FU-5. Root `dev:desktop-stack` does NOT start Electron (naming mismatch)

Root `package.json:22-23`:
```
"dev:desktop":       "pnpm --filter @lightfast/desktop dev",
"dev:desktop-stack": "concurrently 'pnpm dev:full' 'pnpm --filter @lightfast/app proxy'",
```

`dev:desktop` is the one that actually starts Electron. `dev:desktop-stack` starts the web stack (app + www + platform) plus the `@lightfast/app proxy` script — it's the companion web-side runtime, not a stack-including-Electron. The name reads like it should boot everything together, but it doesn't start Electron. This is a factual discrepancy between the name and the behavior.

#### FU-6. Turbo task inheritance

`apps/desktop/package.json` exposes `dev`, `package`, `make`, `publish`, `typecheck`. Root `turbo.json` tasks that match: only **`dev`** (persistent, no cache) and **`typecheck`** (`dependsOn: ["^build", "transit"]`, outputs `.cache/tsbuildinfo.json`). The root `build`, `test`, `clean`, `transit` turbo tasks all no-op for desktop because desktop doesn't expose matching script names.

`typecheck` runs two sequential `tsc` passes (`apps/desktop/package.json:12`) — no per-config turbo tasks, no incremental build via project references (there's no `composite` / `references` field in the two tsconfigs, per Subagent 1 §4).

#### FU-7. No `.env.example`; `.env.development` exists and is gitignored

`apps/desktop/.env.development` (gitignored) contains a single key: `VITE_LIGHTFAST_API_URL=http://localhost:3024`. There is no `.env.example` template and no `.env.production`. New contributors have no documented list of env vars needed to boot the app.

#### FU-8. Missing dev-ergonomic scripts (cheap to add)

| Script | Codex has | Lightfast has | Effort |
|---|---|---|---|
| `devtools:reset` (clear extensions + Service Worker + Code Cache) | Yes (one-line sh) | No | Tiny |
| `clean` (rm -rf `out/ .vite/ .cache/`) | Implicit via `rm -rf out` in `build` | No | Tiny |
| `metadata-probe` (read `buildFlavor`/`buildNumber`) | `scripts/dev-metadata.ts` | No | Small |
| `rebuild` (on Electron version change) | `rebuild:sqlite` + `rebuild:forge-natives` | No — `rebuildConfig: {}` | Small–Medium (only needed once natives exist) |
| Third-party-notices generator | Parent-workspace script → 889-package `THIRD_PARTY_NOTICES.txt` | No | Medium |

### What the First Pass Missed (summary)

1. **Lint/format/test tooling is not just "thin" — it's absent at the app level.** First pass implied this but Subagent 1 §2 / §8 makes it concrete: `apps/desktop/package.json` devDeps have no linter, no formatter, no test runner.
2. **CI-core explicitly excludes desktop** from typecheck and build (`ci-core.yml:45,105`). Desktop typecheck coverage relies entirely on `ci.yml`'s `--affected` invocation.
3. **Changeset validation would reject desktop** (`verify-changeset.yml:51` allowlist).
4. **`desktop-release.yml.disabled` is genuinely disabled** — three substantive jobs transcribed above, but missing Sentry release, Windows, Linux, universal-binary, changelog, and attestation steps.
5. **Root `dev:desktop-stack` naming is misleading** — doesn't start Electron.
6. **No `rebuildConfig`** — `forge.config.ts:86` has `rebuildConfig: {}`. Becomes load-bearing the first time a native module enters `dependencies`.
7. **No `.env.example`** — undocumented env surface for contributors.
8. **`onlyBuiltDependencies` already lists `@sentry/cli`** (`pnpm-workspace.yaml:82`) so its postinstall binary is materialized, but no workflow invokes it. The tool is installed but unused.

### Follow-up Code References

- `apps/desktop/package.json:7-13` — scripts (only 5, no lint/test/format)
- `apps/desktop/package.json:14-36` — devDependencies (no lint/test/format/@sentry/cli)
- `apps/desktop/forge.config.ts:86` — empty `rebuildConfig`
- `apps/desktop/tsconfig.node.json` — includes `forge.config.ts` + all three `vite.*.config.ts`
- `apps/desktop/vite.renderer.config.ts:13-27` — `preserveSymlinks: false`, `optimizeDeps.include` for `@repo/app-trpc`, renderer outDir `.vite/renderer/main_window`
- `apps/desktop/.gitignore` — ignores `out/`, `dist/`, `.cache/`, `.vite/`, `node_modules/`, `.env*`; exception `!build/`
- `apps/desktop/.env.development` (gitignored) — `VITE_LIGHTFAST_API_URL=http://localhost:3024`
- `package.json:22-23` (root) — `dev:desktop`, `dev:desktop-stack` (misnamed)
- `turbo.json:44-47` — `typecheck` task
- `pnpm-workspace.yaml:82` — `@sentry/cli` in `onlyBuiltDependencies`
- `.github/workflows/ci.yml:54` — `turbo typecheck --affected` catches desktop
- `.github/workflows/ci-core.yml:45,105` — desktop **excluded** from typecheck + build
- `.github/workflows/verify-changeset.yml:51,57` — desktop not in changeset allowlist
- `.github/workflows/desktop-release.yml.disabled` — full release pipeline, currently disabled
- `.changeset/config.json:5` — `fixed: [["lightfast", "@lightfastai/mcp"]]`; desktop absent
- `/tmp/codex-extracted/app/package.json:7-45` — Codex's 24 scripts for reference

### Updated Open Questions

7. Should `verify-changeset.yml` allowlist be extended to include `@lightfast/desktop`, or should the desktop app intentionally stay outside the changeset flow and rely on `desktop-v*` tags only?
9. Is there appetite for hermetic CI (`fb-dotslash`-style), or is GitHub-hosted runner + `setup-node`/`setup-pnpm` the policy?
10. Is the current "root Biome + root Knip + root turbo typecheck" coverage sufficient for desktop, or should `apps/desktop` have its own `lint` + `test` scripts so devs can run quality checks locally without `cd`ing to root?

### Resolved Questions (2026-04-23)

- **Q6 — `desktop-release.yml.disabled` blocker**: Disabled because Apple signing/notarization keys have not been set up yet. All eight `APPLE_*` / `KEYCHAIN_*` secrets referenced in the workflow (`APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_CERT_BASE64`, `APPLE_CERT_PASSWORD`, `KEYCHAIN_PASSWORD`, `APPLE_API_KEY_CONTENT`) need to be provisioned before the workflow can be renamed from `.disabled` → `.yml`. Nothing in the workflow logic is broken.
- **Q8 — Lint/format tooling choice**: Match root. Biome/ultracite (already configured at repo root via `pnpm check`) is the canonical lint+format stack. Do **not** introduce Oxc (`oxlint`/`oxfmt`) in `apps/desktop` even though Codex uses them — consistency with the rest of the Lightfast monorepo outweighs parity with Codex on this specific tooling call.

### Resolved Questions (2026-04-23, during pre-release batch planning)

- **Release host repo**: Monorepo (`lightfastai/lightfast`) — public repo so Sparkle feed URL works without auth; `GITHUB_TOKEN` already has `contents:write`; tag + source + artifact live together. `LIGHTFAST_DESKTOP_RELEASE_REPO` indirection in `forge.config.ts:43-54` is being removed (Phase B).
- **Tag convention**: `@lightfast/desktop@<version>` (matches existing `lightfast@x.y.z` / `@lightfastai/mcp@x.y.z` changesets-style tags produced by `release.yml`). Chosen over `desktop-v*` (old), `desktop/v*` (ad-hoc slash), `v*` (single-product-only). Workflow trigger will be `'@lightfast/desktop@*'`.
- **First release arch**: arm64 + x64 (matrix already in disabled workflow). Not universal.
- **Sentry DSN delivery**: Baked at CI build time via `npm pkg set sentryDsn="$SENTRY_DSN"` using repo secret. Runtime env `SENTRY_DSN` preserved as override for local dev. DSN is a public identifier; storing as a secret is belt-and-suspenders.
- **Q7 (changeset policy)**: Tag-only releases for desktop. `@lightfast/desktop` added to `.changeset/config.json` `ignore` (Phase F). `verify-changeset.yml:51` allowlist deliberately **not** extended — its current rejection of desktop-mentioning changesets is the correct boundary.
- **Q10 (local lint/test)**: Desktop gets its own `lint` + `clean` scripts in Phase F that resolve Biome via workspace hoisting. No separate test runner yet (no tests to run).

## Status Update 2026-04-24

### Quick-wins plan: 4/4 phases landed

Verified against current tree:
- **Phase 1 (entitlements)**: `build/entitlements.mac.plist` has 5 keys — `disable-library-validation`, `device.camera`, `network.server` all gone. `NSCameraUsageDescription` removed from `forge.config.ts` extendInfo.
- **Phase 2 (Info.plist)**: `forge.config.ts:67-78` carries `NSQuitAlwaysKeepsWindows=false`, `LSMinimumSystemVersion: "12.0"`, `LSEnvironment: { MallocNanoZone: "0" }`.
- **Phase 3 (Sentry)**: `src/main/sentry.ts:14-55` has module-scoped `SESSION_ID`, `rewriteFramesIntegration({ root: app.getAppPath(), prefix: "app:///" })`, `dist: build.buildNumber`, tags `sessionId/bundle/host`.
- **Phase 4 (dead code)**: `showContextMenu` removed from `ipc.ts`. `silentRefresh` + `REFRESH_TIMEOUT_MS` removed — superseded by a full `auth-flow.ts` rewrite (loopback HTTP server over `127.0.0.1:<port>/callback` with a per-signin CSRF state and cryptographic token). Deep-link `console.log` gone — in fact the entire deep-link dispatcher is gone: `src/main/protocol.ts` deleted, `onDeepLink` removed from `index.ts`, `CFBundleURLTypes` dropped from extendInfo. Research §10 is now moot — there is no deep-link surface to dispatch.

### Pre-release batch plan: scope + external setup

Drafted in [`thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md`](../plans/2026-04-23-desktop-pre-release-batch.md). 6 phases:

| Phase | Scope | Type |
|---|---|---|
| A | Apple Developer + Sentry provisioning (10 GH secrets, 2 variables) | Human setup |
| B | Forge config + build-info cleanup: remove `LIGHTFAST_DESKTOP_RELEASE_REPO`, drop `sparklePublicKey`, add `sentryDsn` to schema | Code |
| C | `scripts/upload-sourcemaps.mjs` + `@sentry/cli` devDep | Code |
| D | Rename `desktop-release.yml.disabled` → `.yml`, tag trigger, `cancel-in-progress`, stamp `sentryDsn`, call Phase C script, artifact attestation, auto-generated release notes | CI |
| E | New `desktop` job in `ci.yml` (macos-14, paths-filtered, unsigned package + typecheck) | CI |
| F | `.env.example`, `lint`/`clean` scripts, rename `dev:desktop-stack` → `dev:desktop-api`, add `@lightfast/desktop` to changesets `ignore` | DX |

### Out of scope for v0.1.0 (unchanged from original deferred list)

Sparkle-native Ed25519 auto-update, Windows MSIX + Linux makers, universal binary merge, file-backed logger, SQLite, worker tier, per-surface preload isolation, renderer/menu i18n, Playwright CDP harness, notifications.

### Next touch points

1. Provision Apple Developer Program + App Store Connect API key → 8 GH secrets.
2. Create `lightfast-desktop` Sentry project → DSN + auth token + `SENTRY_ORG`/`SENTRY_PROJECT` variables.
3. Land phases B–F in any order (no cross-phase blockers except B must precede D).
4. Cut `@lightfast/desktop@0.1.0-rc.1` as the end-to-end dry run before the first public release.

## Status Update 2026-05-06

Verification pass logged at [`thoughts/shared/research/2026-05-06-desktop-prod-readiness-status-verification.md`](2026-05-06-desktop-prod-readiness-status-verification.md). Every prior **DONE** / **DROPPED** Status Tracker row remains true. The three rows previously **IN PROGRESS** all landed.

### What landed since 2026-04-24

- **PR #621** (`aef1d3240`, 2026-04-24) — pre-release-batch phases B–F. Closes IN PROGRESS rows in §2 (Sentry source-map upload), §6 (multi-arch matrix), §13 (build-metadata stamping). Source artifacts: `apps/desktop/src/env/{main,renderer}.ts`, `apps/desktop/scripts/upload-sourcemaps.mjs`, `.github/workflows/desktop-{release,ci}.yml`, `apps/desktop/.env.example`, `apps/desktop/package.json` `clean` script, `.changeset/config.json` ignore.
- **PR #637** (`ab634170e`, 2026-05-06) — unsigned-beta-distribution. Adds a `signingMode: "ad-hoc" | "developer-id"` enum threaded through `apps/desktop/package.json:72`, `apps/desktop/src/shared/build-info-schema.ts:6-7,15`, build-info, Sentry tags, updater. `forge.config.ts:14-49` carries a two-branch osxSign (developer-id when `APPLE_SIGNING_IDENTITY` + `APPLE_TEAM_ID` set, else ad-hoc fallback `identity: "-"`). `desktop-release.yml:32-40` auto-derives `prerelease=true` from any hyphen-suffix in the tag; `desktop-release.yml:120-124` flips `signingMode` based on whether `APPLE_SIGNING_IDENTITY` exists. `apps/desktop/src/main/updater.ts:87-89` disables the auto-updater entirely when `signingMode === "ad-hoc"` (Squirrel.Mac requires the new build to satisfy the running app's Designated Requirement; ad-hoc DRs are content-bound).
- **Mid-flight** — `2565270fa` (floating settings panel), `b30d99975` (custom URL scheme + PKCE). The custom-URL-scheme work does **not** reintroduce a deep-link handler in main: `grep` for `setAsDefaultProtocolClient`, `onDeepLink`, `open-url` across `apps/desktop/src/` returns zero matches. The deletion of `protocol.ts` and the lack of `CFBundleURLTypes` in `forge.config.ts:81-92` extendInfo both still hold. **§10 deep-link surface is genuinely gone.**

### Tracker rows state at 2026-05-06

| § | Finding | Prior state | Current state |
|---|---|---|---|
| 2 | Source-map upload / `@sentry/cli` | IN PROGRESS | **DONE** (PR #621) |
| 6 | Multi-arch arm64+x64 | IN PROGRESS | **DONE** (PR #621) |
| 13 | Non-empty version / buildNumber / sparkleFeedUrl | IN PROGRESS | **DONE** (PR #621 — workflow stamps via `npm pkg set`; placeholders in `package.json` are intentional) |
| 13 | `signingMode` (new) | n/a | **DONE** (PR #637) |
| 10 | Deep-link `console.log` / dispatcher | DEFERRED | **N/A** — surface removed; was never reintroduced |

All other DEFERRED / RELEASE rows from the 2026-04-24 tracker remain unchanged.

### Remaining gates for first-class signed v0.1.0

- **G-1** — Apple Developer enrollment + Sentry secrets. External, partially blocked (Apple). Sentry can land independently.
- **G-2** — `forge.config.ts:14-49` osxSign developer-id branch uses kebab-case keys silently dropped by `@electron/osx-sign@1.3.3`. Will fail signed-build path on first try. Pre-fix is cheap but unverifiable until Apple secrets exist.
- **G-3** — `apps/desktop/build/entitlements.mac.inherit.plist:9-10` still carries `com.apple.security.cs.disable-library-validation`. Codex carries it in neither main nor inherit plist.
- **G-4** — Branch protection for `Desktop CI / Typecheck + package (unsigned)` (UI-only, not automatable from code).
- **G-5** — First end-to-end dry run: cut `@lightfast/desktop@0.1.0-rc.1`. Can be run in ad-hoc mode now without Apple — exercises ~90% of the pipeline (matrix, Forge ad-hoc fallback, Sentry release + sourcemaps, attestation, Sparkle JSON feed). Codesign + notarize remain unverified until Apple lands.
- **G-6** — Auto-updater is intentionally disabled when `signingMode === "ad-hoc"`. Beta users reinstall manually until the first signed cut.

G-7 from the verification doc (custom URL scheme audit) is **closed** — verified above.

### Recommended order to clear the gates

1. Pre-fix G-2 + G-3 in code (cheap, lands without Apple).
2. Provision Sentry only (G-1 partial). Defers Apple to its own dependency chain.
3. Cut `@lightfast/desktop@0.1.0-rc.1` ad-hoc dry-run (G-5 partial). Validates everything except codesign + notarize.
4. When Apple unblocks: provision the remaining 8 secrets, cut `@lightfast/desktop@0.1.0-rc.2` (signed), verify codesign + notarize + stapled ticket. Promote to `@lightfast/desktop@0.1.0`.
5. Branch protection (G-4) — repo Settings UI. Do this after rc.1 to confirm `Desktop CI` is the right check name to require.

## Status Update 2026-05-06 (post-dry-run)

The ad-hoc dry-run plan ([`thoughts/shared/plans/2026-05-06-desktop-rc1-ad-hoc-dry-run.md`](../plans/2026-05-06-desktop-rc1-ad-hoc-dry-run.md)) executed end-to-end. Final report: [`thoughts/shared/2026-05-06-desktop-rc1-ad-hoc-dry-run-report.md`](../2026-05-06-desktop-rc1-ad-hoc-dry-run-report.md). Four release candidates (`rc.1` → `rc.4`) cut against `main`; final tag `@lightfast/desktop@0.1.0-rc.4` at `ac986f9a9` produced a green workflow, six assets, and a Sentry release with paired-debug-id sourcemaps.

### Gate closures

| Gate | Prior state | Outcome |
|---|---|---|
| **G-1** Apple secrets + Sentry secrets | external blocker | **Sentry side closed** (`SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` provisioned via `sentry-cli` + `gh secret set`). Apple side still pending — workflow continues to flip to ad-hoc when `APPLE_SIGNING_IDENTITY` absent. |
| **G-2** osxSign kebab-case | open | **Closed** by PR #638 — camelCase rename + per-file ones moved into `optionsForFile`. |
| **G-3** inherit plist `disable-library-validation` | open | **Closed** by PR #638 — dropped from `entitlements.mac.inherit.plist`. Ad-hoc cut launches; signed-cut helper-validation behavior TBD on first developer-id tag. |
| **G-4** Desktop CI branch protection | open (UI-only) | **Unchanged**. Worth doing after the first developer-id cut to confirm the check name remains `Desktop CI / Typecheck + package (unsigned)`. |
| **G-5** First end-to-end dry run | open | **Closed** — rc.1 → rc.4 cut and verified. See report for the seven distinct pipeline bugs surfaced and fixed. |
| **G-6** Auto-updater disabled for ad-hoc | by design | **Unchanged**. |
| **G-7** Deep-link removal post-N-3 | unverified | **Closed** in dry-run plan Phase 1 — `grep` confirmed zero `setAsDefaultProtocolClient` / `onDeepLink` / `open-url` references in `apps/desktop/src/`. |

### New gates surfaced and closed during the dry-run

These were invisible to local `pnpm package`; only real tag pushes surfaced them. All seven are now closed.

| Gate | Issue | Fix |
|---|---|---|
| **G-8** | `PublisherGithub` defaulted `tagPrefix: "v"`, creating a parallel `v0.1.0-rc.1` release alongside the workflow's `@lightfast/desktop@0.1.0-rc.1` draft (which stayed empty) | PR #639 — `tagPrefix: "@lightfast/desktop@"` |
| **G-9** | sentry-cli rejects `/` in release id; `@lightfast/desktop@…` parsed as path | PR #639 — strip `@`, replace `/` with `-` in both `apps/desktop/scripts/upload-sourcemaps.mjs` and `apps/desktop/src/main/sentry.ts` |
| **G-10** | Vite library mode emits no `.map` files by default | PR #640 — `build.sourcemap: true` in all three `vite.{main,preload,renderer}.config.ts` |
| **G-11** | `sentry-cli sourcemaps inject` ran post-asar-pack; user-defined Forge `prePackage` hook fires *before* plugin-vite (opposite of expected) | PR #641 — switched to `packageAfterCopy` hook (runs after vite + after copy to staging, before asar pack); inject into staging dir, mirror back to source `.vite/` |
| **G-12** | ~~`@sentry/electron/renderer` `Sentry.init` is a silent no-op in v10 carrier~~ — **misdiagnosed**; follow-up experiment on 7.13.0 showed the renderer SDK works fine. The v10 carrier exposes the active client at `defaultCurrentScope._client`, not the v8/v9 `.client` / `.defaultClient` paths I was inspecting. The "zero events" outcome was Sentry quota exhaustion, not a broken SDK. Architectural choice to bridge through main still stands on its own merits (smaller bundle, single SDK init); see dry-run report §"Correction". | PR #643 — bridge renderer errors through main's `@sentry/electron/main` SDK via `IpcChannels.rendererError` → `Sentry.captureException` |
| **G-13** | `sentry-cli sourcemaps upload --release X` does not auto-create release `X`; subsequent `releases finalize X` fails | PR #642 — restore explicit `sentry-cli releases new <release>` as first step before upload |
| **G-14** | Vite CJS Rollup strips `import.meta` to literal `{}` (no polyfill); `import.meta.url` and `import.meta.dirname` both crash on access | PR #641 — use `__dirname` in `apps/desktop/src/main/windows/factory.ts` (CJS-native), with biome-ignore comment |

### Remaining gates for first-class signed v0.1.0

- **G-1 (Apple half)** — 8 Apple secrets still pending: `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_CERT_BASE64`, `APPLE_CERT_PASSWORD`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_API_KEY_CONTENT`, `KEYCHAIN_PASSWORD`. Workflow auto-flips `signingMode` to `developer-id` when `APPLE_SIGNING_IDENTITY` lands.
- **G-4** — Branch protection still UI-only; do after first signed cut.
- **G-6** — Auto-updater stays disabled until first signed cut (intentional).
- **First signed cut** — once Apple secrets land, drop the `-rc.N` suffix and tag `@lightfast/desktop@0.1.0`. Smoke test: launch from Applications without quarantine clear; confirm Sparkle update feed serves the new build to existing rc.* installs (updater flips on automatically).
