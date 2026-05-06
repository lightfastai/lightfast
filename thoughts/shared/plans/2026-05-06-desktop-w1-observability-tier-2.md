---
date: 2026-05-06
author: claude (with jp@jeevanpillay.com)
git_commit: 1bc77e573905d405c2f48fb81b0c019cab569204
branch: docs/codex-gap-status-tracker-callout
tags: [plan, desktop, electron, observability, sentry, logger, codex-gap-followup, w1]
status: draft-revised-2026-05-06
parents:
  - thoughts/shared/research/2026-05-06-desktop-deferred-grouping-for-worktrees.md
  - thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md
  - thoughts/shared/2026-05-06-desktop-rc1-ad-hoc-dry-run-report.md
---

# W1 — Desktop Observability Tier 2: file logger + Sentry vendor wrap + SDK bump

## Overview

Land the W1 worktree slice from `thoughts/shared/research/2026-05-06-desktop-deferred-grouping-for-worktrees.md`: a file-backed structured logger for the desktop main process, a vendored renderer-Sentry re-export to close the vendor-abstraction policy, a `@sentry/electron` catalog bump 7.11.0 → 7.13.0, and the parent-doc §10 drift correction. The primary motive is the dry-run finding that we are over-reliant on Sentry to see anything from a packaged build — a local file log is the floor under that reliance, especially while the Sentry org is over its free-tier quota and the issues stream is closed.

## Current State Analysis

Verified against tree at commit `1bc77e573905d405c2f48fb81b0c019cab569204`.

- **No file logger.** Grep for `electron-log`, `pino`, `winston`, `bunyan`, `fs.appendFile` under `apps/desktop/src/main/` returns zero matches (`thoughts/shared/research/2026-05-06-desktop-deferred-grouping-for-worktrees.md:58`). All diagnostic output is `console.*` only.
- **11 `console.*` sites in `src/main/`** (verified via grep): `settings-store.ts:51` (1), `auth-store.ts:29,51,61,70,82` (5), `auth-flow.ts:210,234` (2), `index.ts:209` (1), `bootstrap.ts:19,28` (2). Six sites already pair `console.error` with `captureException` from `@vendor/observability/sentry-electron-main`; five do not.
- **Vendor wraps for Sentry are partial.** `vendor/observability/src/sentry-electron-main.ts` (re-exports `init`/`captureException`/`captureMessage`/`rewriteFramesIntegration` from `@sentry/electron/main`) and `vendor/observability/src/sentry-browser.ts` (re-exports `init`/`captureException` from `@sentry/browser`) exist. There is **no `sentry-electron-renderer.ts` wrap** despite `@sentry/electron/renderer` being the appropriate entry point for renderer-side init.
- **Renderer Sentry is bridged via IPC, not initialized.** `apps/desktop/src/renderer/src/main.ts:23-27` calls `installErrorBoundary(window.lightfastBridge.reportError)` and the comment block at `:20-26` explicitly anticipates the missing wrap: "to add those, expose a `sentry-electron-renderer` re-export from `@vendor/observability` and call `init` here." Renderer errors travel over `IpcChannels.rendererError` to `index.ts:207-211` where `forwardRendererErrorToSentry` calls `captureException` against the main-process SDK (PR #643, G-12 closure).
- **Catalog vs literal mismatch on `@sentry/electron`.** `pnpm-workspace.yaml:28` has `'@sentry/electron': ^7.11.0`. `vendor/observability/package.json:80` consumes via `"@sentry/electron": "catalog:"`. `apps/desktop/package.json:48` consumes via literal `"@sentry/electron": "^7.11.0"` — bypassing the catalog. NPM registry confirms `7.13.0` is the current latest; both `vendor/observability` and `apps/desktop` should track the catalog.
- **Parent doc §10 is stale.** `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md:502,536` claim the deep-link surface "is genuinely gone." PR #627 (`d4f0cb4b2`, merged 2026-05-06) reintroduced `apps/desktop/src/main/protocol.ts` and `forge.config.ts:133-138` `CFBundleURLTypes` for the PKCE callback (`lightfast://auth/callback`). The §10 broader gap (general URL→route dispatcher) is still open, but the literal "gone" claim is wrong.
- **Codex baseline reference (verified 2026-05-06 via local asar inventory; path is non-reproducible — evidence inlined here).** `/Applications/Codex.app/Contents/Resources/app.asar` has six top-level `node_modules` entries (`better-sqlite3, bindings, file-uri-to-path, node-addon-api, node-pty, tslib`) — **no `electron-log`, no `pino`, no `winston`**. Codex hand-rolls its file logger over Node `fs` with date-partitioned `~/Library/Logs/com.openai.codex/YYYY/MM/DD/...` paths and dual streams per session. **We are matching Codex's hand-rolled approach** — a ~50-LOC `node:fs` module rather than a library dependency. The original draft of this plan picked `electron-log` for its renderer↔main IPC bridge, then explicitly disabled that bridge in scope; the bridge was the only feature library-overhead bought us. Hand-roll keeps the dep tree thin and aligns with the Codex baseline.

## Desired End State

After W1 lands:

- `vendor/observability/src/sentry-electron-renderer.ts` exists as a re-export wrap (one-line file mirroring `sentry-electron-main.ts`), exported via `vendor/observability/package.json` `exports` map, and importable as `@vendor/observability/sentry-electron-renderer`.
- `pnpm-workspace.yaml` catalog floor for `@sentry/electron` is `^7.13.0`. `apps/desktop/package.json` consumes via `catalog:` (no literal pin).
- `apps/desktop/src/main/logger.ts` exists as a ~50-LOC `node:fs`-backed module exporting `logger` (`{ debug, info, warn, error }`) and `initLogger()`. **No new runtime dependency** — written against Node built-ins to match Codex's hand-rolled approach.
- Logger writes per-launch JSON-line files under `app.getPath('logs')/YYYY/MM/DD/desktop-<pid>-<HHMMSSsss>.log`, structurally aligned with Codex's pattern. Uses `fs.openSync` + `fs.writeSync` for crash-safe append-on-write (no JS-level buffering to lose).
- 9 of 11 `console.*` call sites in `src/main/` use the new logger. `bootstrap.ts:19,28` retain `console.*` with an explanatory comment (logger module not loaded yet).
- `apps/desktop/src/renderer/src/main.ts:20-26` comment block updated to reflect that the wrap now exists as pre-positioning; the trade-off explanation stays (renderer SDK still not initialized — wrap-only is the W1 scope; eslint enforcement of the import boundary is also deferred).
- Parent research doc §10 corrections landed: line 502 "§10 is now moot" → updated to note PKCE-only reintroduction; line 536 "**§10 deep-link surface is genuinely gone.**" → updated to "single-purpose PKCE callback; general dispatcher still absent."

### Verification

```bash
# Vendor wrap exists at the expected path (re-export resolved at import time, not require time)
test -f vendor/observability/src/sentry-electron-renderer.ts && echo OK

# Catalog version is current
pnpm why @sentry/electron | grep -A1 "@sentry/electron"

# Logger writes a file per launch
pnpm --filter @lightfast/desktop dev   # observe a log file appears under app.getPath('logs')

# Type & test green
pnpm --filter @lightfast/desktop typecheck
pnpm --filter @lightfast/desktop test
pnpm --filter @vendor/observability typecheck
pnpm check
```

### Key Discoveries

- `app.setName(productName)` runs at `bootstrap.ts:11` before `./index` is dynamically imported, so `app.getPath('logs')` is reliably resolvable from the moment `index.ts` imports the logger module. We do not need to log anything from inside `bootstrap.ts` itself.
- `vitest.config.ts` already runs Node-environment tests under `apps/desktop/src/**/*.{test,spec}.ts` — logger tests slot in at `apps/desktop/src/main/__tests__/logger.test.ts`. The mock pattern to follow is `auth-flow.test.ts:13-24` (`vi.mock("electron", () => ({ app: { get isPackaged() { return flag } } }))`); `auth-focus-gate.test.ts` does not mock `electron` and is the wrong reference.
- The forge build pipeline already stamps `version`/`buildNumber`/`sparkleFeedUrl`/`sentryDsn` via `npm pkg set` on packaged builds (parent doc); no W1 change needed there.
- `fs.openSync` + `fs.writeSync` is the simplest crash-safe write path for low-volume diagnostic logs. Each call lands in the OS-level write buffer immediately; we don't manage a JS-level stream buffer that could lose tail data on a hard crash. This is also how Codex's hand-roll works.

## What We're NOT Doing

- **Renderer Sentry SDK init.** Wrap-only scope. `init()` is not called from the renderer. The IPC bridge via `IpcChannels.rendererError` and `lightfastBridge.reportError` remains the renderer→Sentry path. Future worktree.
- **Auto-forward from logger to Sentry.** `logger.error()` does not call `captureException`. Existing explicit `captureException` call sites at `auth-store.ts:32,53,62,83`, `auth-flow.ts:211,235`, and `index.ts:93` (in `forwardRendererErrorToSentry`) are unchanged. No coupling between the file-logger and the Sentry SDK; each call site decides.
- **Migrating `bootstrap.ts:19,28`.** Bootstrap runs before `index.ts` is dynamically imported and before the logger module is loaded. We leave both `console.*` calls in place with a one-line comment explaining why. Forcing logger init inside bootstrap turns logger init failure into an app-fatal — not worth it.
- **Removing existing `captureException` calls.** Even at sites where `console.error` and `captureException` currently both fire, we keep the `captureException` call. The new logger replaces only the `console.*` half.
- **Log rotation, retention, or upload.** No size cap, no `.old` rolling, no retention sweep, no upload to Sentry/Logtail. Per-launch files are bounded by process lifetime. Future worktree if disk usage becomes a concern.
- **Renderer-process logger.** Renderer logging stays as `console.*` plus the existing IPC error bridge. No renderer→main log channel is built. Future scope decides whether renderer logs land on disk.
- **§10 broader fix (URL→route dispatcher).** The doc fix corrects the literal "gone" claim only. The general deep-link route table is still in the deferred list and is not part of W1.

## Implementation Approach

Land in 4 phases on a single feature branch (`feat/desktop-observability-tier2`). Each phase is a clean phase-boundary halt; review can stop and resume between phases. Phase ordering puts the smallest, most independent diffs first — the SDK bump and vendor wrap are reviewable on their own; the logger module is additive (no callers); the call-site swaps are the behavior change; the doc fix is zero-risk cleanup.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: SDK bump + vendor renderer wrap + catalog normalization

### Overview

Bump `@sentry/electron` 7.11.0 → 7.13.0 in the catalog. Create the missing `sentry-electron-renderer` vendor re-export. Normalize `apps/desktop/package.json` to consume `@sentry/electron` via `catalog:` (matching `vendor/observability`). Update the renderer comment block now that the wrap exists. Pure config + 1-line file additions; no runtime behavior change.

### Changes Required

#### 1. Bump catalog floor

**File**: `pnpm-workspace.yaml`
**Change**: line 28 `'@sentry/electron': ^7.11.0` → `'@sentry/electron': ^7.13.0`.

#### 2. Vendor renderer-Sentry wrap

**File**: `vendor/observability/src/sentry-electron-renderer.ts` (new)
**Change**: One-line re-export, mirroring `sentry-electron-main.ts`.

```ts
export {
  captureException,
  captureMessage,
  init,
} from "@sentry/electron/renderer";
```

#### 3. Vendor package exports map

**File**: `vendor/observability/package.json`
**Change**: add a new `./sentry-electron-renderer` entry to the `exports` block (alphabetical neighbor of `./sentry-electron-main`).

```json
"./sentry-electron-renderer": {
  "types": "./src/sentry-electron-renderer.ts",
  "default": "./src/sentry-electron-renderer.ts"
},
```

#### 4. Normalize apps/desktop sentry pin

**File**: `apps/desktop/package.json`
**Change**: line 48 `"@sentry/electron": "^7.11.0"` → `"@sentry/electron": "catalog:"`.

#### 5. Renderer comment update (now that wrap exists)

**File**: `apps/desktop/src/renderer/src/main.ts:20-26`
**Change**: Replace the comment block that anticipates the missing wrap with one that states the wrap exists and the renderer SDK init is intentionally deferred.

```ts
// Renderer errors are forwarded over IPC to main, which calls captureException
// via `@vendor/observability/sentry-electron-main`. The renderer wrap at
// `@vendor/observability/sentry-electron-renderer` exists as the canonical
// import path for renderer-side Sentry; to enable a renderer Sentry SDK
// (breadcrumbs, page-nav tracking, replay), call `init({ dsn, ... })` here.
// Currently disabled to keep the renderer bundle small and Sentry config
// single-source-of-truth in main. Note: the no-restricted-imports lint guard
// against direct `@sentry/electron/renderer` imports is intentionally deferred
// — there is currently no renderer Sentry usage to police.
installErrorBoundary(window.lightfastBridge.reportError);
```

#### 6. Lockfile regen

**File**: `pnpm-lock.yaml`
**Change**: regenerate via `pnpm install`. Expect new resolution entries for `@sentry/electron@7.13.0` plus its transitive deps; expect removal of `7.11.x` entries that no longer have any consumer.

### Success Criteria

#### Automated Verification

- [ ] `pnpm install` succeeds, no peer-dep warnings introduced
- [ ] `pnpm why @sentry/electron` shows resolved version 7.13.0 for both `@vendor/observability` and `@lightfast/desktop`
- [ ] `pnpm --filter @vendor/observability typecheck` passes
- [ ] `pnpm --filter @lightfast/desktop typecheck` passes
- [ ] `pnpm --filter @lightfast/desktop test` passes (existing 3 vitest files, no new coverage in this phase)
- [ ] `pnpm check` passes
- [ ] `test -f vendor/observability/src/sentry-electron-renderer.ts` succeeds (TS source resolution; runtime require will fail until a consumer compiles it, which is acceptable for W1)

#### Human Review

- [ ] Open the renderer comment block in `apps/desktop/src/renderer/src/main.ts:20-26` → wording reads cleanly and points at the new wrap path

---

## Phase 2: Hand-rolled file logger via node:fs

### Overview

Create `apps/desktop/src/main/logger.ts` as a ~50-LOC `node:fs`-backed module — no new runtime dependency. Date-partitioned per-launch path matching Codex's structural pattern (`<logs>/YYYY/MM/DD/desktop-<pid>-<HHMMSSsss>.log`), JSON-lines format, sync writes via `fs.writeSync`, dev-only stdout mirror. Module is purely additive in this phase — no call sites use it yet.

The original draft of this plan picked `electron-log` for its renderer↔main IPC bridge, then explicitly disabled that bridge in scope. Hand-rolling removes ~80 KB + 1 dep and aligns with Codex's actual approach (verified via asar inventory: no logger lib).

### Changes Required

#### 1. Logger module

**File**: `apps/desktop/src/main/logger.ts` (new)
**Change**: New module. Exports `logger` (`{ debug, info, warn, error }`) and `initLogger()`. `initLogger()` is called once from `index.ts` before any other logger usage.

Key design decisions baked into the file:

- **Path computation**: `app.getPath('logs')` is the canonical Electron logs dir (macOS `~/Library/Logs/<App Name>`, Linux `~/.config/<App Name>/logs`, Win `%USERPROFILE%/AppData/Roaming/<App Name>/logs`). We append `YYYY/MM/DD/desktop-<pid>-<HHMMSSsss>.log`. Date + millisecond timestamp is computed once at `initLogger()` so all messages from one launch land in one file; the millisecond suffix avoids same-second filename collision.
- **Format**: JSON lines, one record per call. Fields: `ts` (ISO8601), `level`, `pid`, `message`. grep/jq-friendly; matches the structured-logging contract referenced in the parent gap doc.
- **Levels**: `debug` in dev (`!app.isPackaged`), `info` in packaged builds. Records below `minLevel` are dropped before format.
- **Writes**: `fs.openSync` + `fs.writeSync` (sync). For low-volume diagnostic logging this is fine — no JS-level buffer to lose on hard crash, no stream backpressure to manage. `app.on("will-quit")` closes the fd; on hard crash the OS cleans it up.
- **Stdout mirror**: only in dev (`!app.isPackaged`). Packaged builds have no terminal attached, so console mirror is wasted work.
- **Renderer logging**: NOT routed through this module. Renderer continues using `console.*` and the existing IPC error bridge. (Same scope as the original electron-log draft.)

```ts
import { closeSync, mkdirSync, openSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";

type Level = "debug" | "info" | "warn" | "error";
const LEVEL_ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

// initLogger() must run before any logger.* call. Top-level *imports* of this
// module are safe (no fd is opened until init); what's unsafe is calling
// logger.* at module-init time before initLogger() runs in index.ts.
let fd: number | null = null;
let minLevel: Level = "info";

function pad(n: number, width = 2): string {
  return n.toString().padStart(width, "0");
}

function computeLogPath(): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hms = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`;
  return join(app.getPath("logs"), yyyy, mm, dd, `desktop-${process.pid}-${hms}.log`);
}

function formatArg(a: unknown): string {
  if (typeof a === "string") return a;
  if (a instanceof Error) return `${a.name}: ${a.message}${a.stack ? `\n${a.stack}` : ""}`;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

function emit(level: Level, args: unknown[]): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
  const record = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    pid: process.pid,
    message: args.map(formatArg).join(" "),
  }) + "\n";
  if (fd !== null) {
    try {
      writeSync(fd, record);
    } catch {
      // Disk full / fd closed during quit. Logging must never crash the app.
    }
  }
  if (!app.isPackaged) {
    const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    sink(...args);
  }
}

export function initLogger(): void {
  if (fd !== null) return;
  const filePath = computeLogPath();
  mkdirSync(dirname(filePath), { recursive: true });
  fd = openSync(filePath, "a");
  minLevel = app.isPackaged ? "info" : "debug";
  app.on("will-quit", () => {
    if (fd !== null) {
      try { closeSync(fd); } catch { /* fd already gone */ }
      fd = null;
    }
  });
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
```

#### 2. Logger unit tests

**File**: `apps/desktop/src/main/__tests__/logger.test.ts` (new)
**Change**: vitest coverage for path computation, double-init idempotency, level filtering, and JSON format. Mocks `electron.app.getPath`, `electron.app.isPackaged`, and `electron.app.on` per the existing mocking pattern in `auth-flow.test.ts:13-24` (NOT `auth-focus-gate.test.ts` — that file does not mock electron). Real fs is used against an `os.tmpdir()` directory cleaned up between tests.

Coverage:

- `initLogger()` is idempotent (second call is a no-op; no second `openSync`)
- `computeLogPath()` produces a path under the mocked `getPath('logs')` with shape `YYYY/MM/DD/desktop-<pid>-<HHMMSSsss>.log`
- `minLevel === "debug"` when `app.isPackaged === false`; `"info"` otherwise
- `logger.debug(...)` is dropped at info-level minLevel; `logger.error(...)` is always written
- One log line is valid JSON with keys `ts`, `level`, `pid`, `message`
- `Error` arguments serialize as `name: message\nstack`, not `[object Object]`

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter @lightfast/desktop test` passes (4 vitest files now: existing 3 + logger.test.ts)
- [ ] `pnpm --filter @lightfast/desktop typecheck` passes
- [ ] `pnpm check` passes

#### Human Review

- [ ] Open `apps/desktop/src/main/logger.ts` → JSON output is valid for representative inputs (string, object, Error with stack); pad/date logic is timezone-stable; sync writes don't visibly block startup at the call sites we care about

---

## Phase 3: Migrate 9 console.* call sites

### Overview

Replace `console.error` / `console.warn` / `console.log` calls under `src/main/` with `logger.error` / `logger.warn` / `logger.info` calls, except for the two pre-init bootstrap sites which stay as `console.*` with an explanatory comment. Existing `captureException` calls are unchanged.

`initLogger()` is called once from `index.ts` at the very top of module load (before `initSentry()`).

### Changes Required

#### 1. Logger init in main entry

**File**: `apps/desktop/src/main/index.ts`
**Change**:

- Add `import { initLogger, logger } from "./logger";` (alphabetical, after `runtime-config`).
- Insert `initLogger();` as the first statement in the side-effect block, immediately above the existing `initSentry();` at line 345.
- Replace `console.error("[renderer]", payload);` at line 209 with `logger.error("renderer error", payload);`. Drop the `eslint-disable-next-line no-console` directive since it's no longer needed.

#### 2. settings-store call-site swap

**File**: `apps/desktop/src/main/settings-store.ts`
**Change**:

- Add `import { logger } from "./logger";` at the top.
- Line 51: `console.error("[settings] failed to write", error);` → `logger.error("[settings] failed to write", error);`.

#### 3. auth-store call-site swaps (5 sites)

**File**: `apps/desktop/src/main/auth-store.ts`
**Change**:

- Add `import { logger } from "./logger";` at the top.
- Line 29: `console.warn("[auth-store] purge failed", err);` → `logger.warn("[auth-store] purge failed", err);`
- Line 51: `console.error("[auth-store] invalid persisted payload", parsed.error);` → `logger.error("[auth-store] invalid persisted payload", parsed.error);`
- Line 61: `console.error("[auth-store] failed to load; purging", err);` → `logger.error("[auth-store] failed to load; purging", err);`
- Lines 70-72: `console.error("[auth-store] safeStorage unavailable; refusing to write plaintext")` → `logger.error("[auth-store] safeStorage unavailable; refusing to write plaintext")`.
- Line 82: `console.error("[auth-store] failed to persist", err);` → `logger.error("[auth-store] failed to persist", err);`

Existing `captureException` calls at lines 32, 53, 62, 83 are unchanged.

#### 4. auth-flow call-site swaps (2 sites)

**File**: `apps/desktop/src/main/auth-flow.ts`
**Change**:

- Add `import { logger } from "./logger";` at the top.
- Line 210: `console.error("[auth-flow] callback handler error", error);` → `logger.error("[auth-flow] callback handler error", error);`
- Line 234: `console.error("[auth-flow] shell.openExternal failed", error);` → `logger.error("[auth-flow] shell.openExternal failed", error);`

Existing `captureException` calls at lines 211, 235 are unchanged.

#### 5. bootstrap.ts deliberate-stay sites

**File**: `apps/desktop/src/main/bootstrap.ts`
**Change**: NO `logger` import. Keep `console.log` at line 19 and `console.error` at line 28. Add a single comment above the file's first `console.*` (at line 18) explaining why:

```ts
// Bootstrap runs before `./index` is dynamically imported, so the logger
// module isn't loaded yet. These two console.* calls intentionally stay
// pre-logger; everything inside ./index goes through src/main/logger.ts.
```

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter @lightfast/desktop test` passes (no test changes needed; existing tests don't depend on console.* output)
- [ ] `pnpm --filter @lightfast/desktop typecheck` passes
- [ ] `pnpm check` passes
- [ ] `grep -rn "console\.\(error\|warn\|log\|info\)" apps/desktop/src/main/` returns exactly 2 matches, both in `bootstrap.ts` (recursive `-r` is required — without it the search misses subdirs and would silently pass)

#### Human Review

- [ ] Run `pnpm dev:desktop`, trigger settings write to disk → watch terminal: settings logger line appears with structured prefix (no raw `[settings]` console line); inspect `app.getPath('logs')/YYYY/MM/DD/desktop-<pid>-<HHMMSS>.log` → file exists, contains JSON lines for the launch — TODO: automate via Playwright Electron CDP harness once W5 lands
- [ ] Trigger an auth-store error path (delete `auth.bin` mid-session, sign out, sign in) → confirm both the file logger line AND a Sentry event are emitted (Sentry side requires DSN-equipped build; in dev the `enabled` branch in `sentry.ts:30` returns false and only the file log fires) — TODO: automate via mocked Sentry transport in vitest
- [ ] Inspect a single packaged `.dmg` build → confirm `app.getPath('logs')` resolves to `~/Library/Logs/Lightfast/...` and a launch-file lands there

---

## Phase 4: Doc fix — parent §10 drift correction

### Overview

Update the parent gap doc's two stale assertions about §10 deep-link surface being "genuinely gone", which became inaccurate after PR #627 reintroduced `protocol.ts` for the PKCE custom URL scheme. Doc-only; zero code touched.

### Changes Required

#### 1. Phase 4 dead-code paragraph correction

**File**: `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md`
**Change**: Around line 502, the sentence "Deep-link `console.log` gone — in fact the entire deep-link dispatcher is gone: `src/main/protocol.ts` deleted, `onDeepLink` removed from `index.ts`, `CFBundleURLTypes` dropped from extendInfo. Research §10 is now moot — there is no deep-link surface to dispatch." — replace with a corrected version noting the PKCE-only reintroduction.

Suggested replacement:

> Deep-link `console.log` gone; the original deep-link dispatcher was deleted (`src/main/protocol.ts`, `onDeepLink`, `CFBundleURLTypes`) — then PR #627 (2026-05-06) reintroduced `protocol.ts` and `CFBundleURLTypes` for the PKCE auth callback (`lightfast://auth/callback`) only. The general URL→renderer-route dispatcher §10 originally described is still absent.

#### 2. Mid-flight section correction

**File**: `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md`
**Change**: Around line 536, the sentence ending "**§10 deep-link surface is genuinely gone.**" — replace.

Suggested replacement:

> The 2026-04-25 deletion of `protocol.ts` was reversed by PR #627 (2026-05-06) for PKCE only: `setAsDefaultProtocolClient`, `open-url`, `second-instance`, `CFBundleURLTypes` all back in tree. **§10 surface is single-purpose (PKCE auth callback only); the general URL→route dispatcher remains absent.**

### Success Criteria

#### Automated Verification

- [x] `grep -n "genuinely gone\|now moot" thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md` returns no matches
- [x] `grep -n "PR #627\|PKCE auth callback" thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md` returns matches in both updated paragraphs

#### Human Review

- [ ] Read the two updated paragraphs end-to-end → both read coherently with the surrounding context; cross-references to §10 elsewhere in the doc still resolve

---

## Testing Strategy

### Unit Tests

- New: `apps/desktop/src/main/__tests__/logger.test.ts` — initLogger idempotency, path shape, level selection, JSON format function output (Phase 2).
- Unchanged: `auth-flow.test.ts`, `auth-focus-gate.test.ts`, `protocol.test.ts` — no behavior depends on `console.*` output, so call-site swaps don't require test updates.

### Integration Tests

W1 doesn't add Playwright/E2E coverage — that's W5's scope (`thoughts/shared/research/2026-05-06-desktop-deferred-grouping-for-worktrees.md:188-216`). Behavior verification in W1 happens through the Phase 3 Human Review steps and the Phase 1/2 automated checks. Once W5 lands, the "boot → log file appears → contents valid JSON" assertion graduates to an automated E2E check.

## Performance Considerations

- Zero new runtime dependency. Logger is ~50 LOC of `node:fs` + `electron`. Renderer bundle is unaffected (renderer doesn't import the module).
- Per-launch file descriptor is opened once at `initLogger()` and held for the process lifetime; closed on `app.on("will-quit")`. No per-message open/close churn.
- `fs.writeSync` blocks the event loop for the duration of a single OS write. For low-volume diagnostic logs (a handful of lines per launch in normal operation), the cost is negligible. If volume grows materially in future scopes, swap to `fs.write` (async) or a `WriteStream` — keep this in mind before any code path starts logging in tight loops.
- `JSON.stringify` on the small per-record object (4 string-ish fields) is sub-microsecond and not on a hot path.
- Crash-safety: `fs.writeSync` lands the bytes in the OS write buffer immediately, so a hard JS-level crash doesn't lose the tail of the log. Library-managed JS streams (the path electron-log would have taken) trade that for higher throughput.

## Migration Notes

No user data migration. The new logger writes to a new directory tree (`<logs>/YYYY/MM/DD/...`) that didn't exist before. Existing `settings.json`, `window-state.json`, `auth.bin` are unaffected. No rollback complications: revert the four phases and the tree returns to its pre-W1 state.

## References

- Parent worktree research: `thoughts/shared/research/2026-05-06-desktop-deferred-grouping-for-worktrees.md` (W1 spec at lines 126-152)
- Original gap doc: `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md` (§10 + §"§2 file-backed logger")
- rc.4 dry-run report: `thoughts/shared/2026-05-06-desktop-rc1-ad-hoc-dry-run-report.md`
- Existing Sentry main wrap: `vendor/observability/src/sentry-electron-main.ts:1-7`
- Existing renderer comment anticipating wrap: `apps/desktop/src/renderer/src/main.ts:20-26`
- Renderer error IPC bridge: `apps/desktop/src/main/index.ts:81-97,207-211`
- Codex logger reference (asar inventory 2026-05-06; path is local-machine only, evidence inlined): `/Applications/Codex.app/Contents/Resources/app.asar` top-level `node_modules` = `better-sqlite3, bindings, file-uri-to-path, node-addon-api, node-pty, tslib` (no logger lib — hand-rolled over `node:fs`)
- Sentry ecosystem version note: `@sentry/electron` stays on v7 floor (this plan bumps 7.11→7.13). Catalog peers `@sentry/browser`/`core`/`nextjs` are at v10.49. The cross-major sync is deliberately deferred — `@sentry/electron` v8 was a breaking rewrite. Track in a follow-up worktree if/when it becomes load-bearing.

---

## Improvement Log

Adversarial review applied 2026-05-06 against `1bc77e573905d405c2f48fb81b0c019cab569204`. Decisions captured below; original-draft assumptions noted in case future readers want to reconstruct the trade-off.

### Logger implementation: hand-roll over electron-log

**Original draft** added `electron-log@^5.4.3` as a runtime dep, citing its renderer↔main IPC bridge. The same draft then explicitly disabled that bridge ("Renderer bridge: NOT enabled"). The remaining features in scope (path resolution, level filter, JSON format, size-aware behavior) collapse to ~50 LOC of `node:fs`. Codex's own logger is hand-rolled over `node:fs` (verified via asar inventory), so hand-rolling also aligns the structural baseline.

**Revised**: Phase 2 now ships a `node:fs` module — `openSync` + `writeSync` for crash-safe sync writes, `app.on("will-quit")` for fd cleanup, dev-only stdout mirror. No new runtime dep. ~80 KB and one library boundary saved. The original draft's `archiveLogFn` no-op claim (which was in the prose but missing from the code) is moot since we no longer carry electron-log's rotation surface.

### Sentry @sentry/electron version: kept 7.11→7.13

The bump in scope is a patch within v7. Workspace-catalog peers (`@sentry/browser`/`core`/`nextjs`) are at v10.49, so desktop is 3 majors behind. v8 was a breaking rewrite; cross-major sync is out of scope for W1. **Added** an explicit deferral note to References so the drift is documented, not hidden.

### Renderer wrap: kept with documented deferral

`vendor/observability/src/sentry-electron-renderer.ts` is added as canonical pre-positioning. Until renderer SDK init lands or someone tries to import `@sentry/electron/renderer` directly, the wrap is dead code. **Added** a note to the renderer comment block explaining the eslint `no-restricted-imports` enforcement is intentionally deferred — there is currently no renderer Sentry usage to police. The wrap is ready when init lands; the lint guard lands with init.

### Verification fixes

- Phase 1 `node -e require(...)` check replaced with `test -f` source-presence check (the TS source isn't `require`-able at the path until a consumer compiles it; the original check would have failed on a green branch).
- Phase 3 `grep` invocation gained `-r` (without it the search misses subdirs and would silently pass).
- Phase 3 `pnpm package` automated check dropped — building a packaged DMG to verify a console→logger swap is overkill at the phase boundary; the existing Phase 3 Human Review step "inspect a single packaged `.dmg` build" already covers the integration gate.
- Test mock reference corrected from `auth-focus-gate.test.ts` (which doesn't mock `electron`) to `auth-flow.test.ts:13-24` (the actual mock pattern for `app.isPackaged`).

### Filename uniqueness

`HHMMSS` widened to `HHMMSSsss` (millisecond suffix) so two launches in the same wall-clock second don't collide on filename. Guards against a vanishingly-rare-but-real failure mode of two log-writer launches (e.g., a debugging session) racing into the same file.

### Module-init contract

Added an inline comment in the logger module documenting that top-level *imports* are safe but logger calls before `initLogger()` runs would silently drop. Prevents future foot-guns when a new module starts logging at module-init time.

### Spike status

No spike was run. The hand-roll vs library decision was clean enough to call from review evidence (verified electron-log's only differentiated feature, the IPC bridge, was already out of scope). User decision captured directly.
