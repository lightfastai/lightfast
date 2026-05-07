---
date: 2026-05-07
author: claude
branch_proposed: feat/desktop-preload-isolation
worktree_proposed: ../worktrees/desktop-W4-preload-isolation
parents:
  - thoughts/shared/research/2026-05-06-desktop-deferred-grouping-for-worktrees.md
  - thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md
status: draft
---

# Desktop W4 — Per-surface Preload Isolation Scaffolding

## Overview

Split the single `apps/desktop/src/preload/preload.ts` into three per-window-kind preload entries (`primary`, `settings`, `hud`) backed by a flat `build-bridge.ts` sibling module, wire `electron-forge`'s VitePlugin to emit three preload bundles from one shared `vite.preload.config.ts`, and have `windows/factory.ts` resolve the preload path by `WindowKind`. Surface scope is unchanged — every kind exposes the same `LightfastBridge` today; the value is the **structural seam** for future trust boundaries (HUD lockdown, in-app web-view host, third-party plugin host) without re-shaping the build at that point.

While we're here, lift the two preload-exposed global names (`"lightfastBridge"`, `"codexWindowType"`) into `apps/desktop/src/shared/window-globals.ts` so preload + renderer reference them through a single typed constant — same spirit as `IpcChannels` in `src/shared/ipc.ts`.

This is W4 from `thoughts/shared/research/2026-05-06-desktop-deferred-grouping-for-worktrees.md`. Tier 2, "scaffolding"; the doc explicitly notes "the merge cost of doing it later is identical to doing it now," so we are paying the cost early to claim the slot ahead of the next feature that wants the seam.

## Current State Analysis

Verified at commit `1bc77e573905d405c2f48fb81b0c019cab569204` (also matches working tree on `refactor/repo-barebones-reset`).

- **One preload, three windows.** `apps/desktop/src/preload/preload.ts:1-104` builds a single `LightfastBridge` and `contextBridge.exposeInMainWorld`s it. The same compiled bundle (`.vite/build/preload.js`) is loaded by every `BrowserWindow`.
- **Kind-via-argv plumbing.** `factory.ts:53` passes `additionalArguments: ['--window-kind=${kind}']` on every window. `preload.ts:99-102` parses `process.argv` and re-exposes the value at `preload.ts:103` via `contextBridge.exposeInMainWorld("codexWindowType", windowKind)`. This is the only consumer of that argv flag (`grep -rn "window-kind"` returns those two sites).
- **Single forge build entry.** `forge.config.ts:202-206` declares one `target: "preload"` build entry pointing at `src/preload/preload.ts` with `vite.preload.config.ts`.
- **Single vite lib config.** `vite.preload.config.ts:1-15` is `lib`-mode with hardcoded `entry: "src/preload/preload.ts"` and `fileName: () => "preload.js"`. **Spike (worktree, 2026-05-07) showed that `lib` mode is incidental** — `electron-forge`'s `plugin-vite` sets `build.rollupOptions.input` from each `build[].entry` field directly and emits via `output.entryFileNames: '[name].js'`, so a single shared config with no `lib` block correctly produces `<basename>.js` per forge entry.
- **Hardcoded preload path in factory.** `factory.ts:21` sets `PRELOAD_PATH = join(factoryDir, "preload.js")`; `factory.ts:50` injects it for every kind. `factoryDir` is `__dirname` (CJS) which resolves to `.vite/build/` in dev and `<asar>/app/.vite/build/` when packaged.
- **No preload tests today.** `apps/desktop/src/main/__tests__/` contains `auth-flow.test.ts`, `auth-focus-gate.test.ts`, `protocol.test.ts` — none reference the preload module (preload runs in a sandboxed renderer-side process and isn't import-clean to vitest).
- **Renderer is single-bundle and stays that way.** `vite.renderer.config.ts:5-33` builds one renderer (`main_window`); `src/renderer/index.html` carries kind-filtered DOM (`data-kind-{primary,settings,hud}`); `entry.tsx:24` branches on `window.codexWindowType`. **Out of scope for W4** per the research doc.
- **Bridge call-sites confirmed identical across kinds today.** `grep -rn "window.lightfastBridge" src/renderer` shows: `app-shell.tsx`, `user-menu.tsx`, `settings/use-settings-snapshot.ts`, `settings/panes/*.tsx`, `main.ts`, `entry.tsx`. All paths are reachable from a primary window; settings panes are reachable when the settings root mounts; HUD currently has zero React mount and zero bridge calls (just static HTML in `index.html:141-147`).
- **Two consumers of `window.codexWindowType` in renderer.** `entry.tsx:24` branches on it to mount `SettingsWindow` vs `AppShell`; `main.ts:36` mirrors it onto `document.documentElement.dataset.windowKind` for kind-scoped CSS hooks. Both must continue to see `"primary" | "settings" | "hud"` after the split.
- **Sentry define lives only in main config.** `vite.main.config.ts` has `define: { __SENTRY_DSN__: ... }`; `vite.preload.config.ts` does not. Preload doesn't emit Sentry events directly today, so the gap is intentional — but documented in Migration Notes so a future preload-Sentry path doesn't get a silent `undefined`.

## Desired End State

Verifiable by:
- `apps/desktop/src/preload/` contains exactly four files at the top level: `build-bridge.ts`, `primary.ts`, `settings.ts`, `hud.ts` (the legacy `preload.ts` is gone; no `_shared/` subfolder).
- `apps/desktop/src/shared/window-globals.ts` exists and exports `BRIDGE_GLOBAL = "lightfastBridge"` and `WINDOW_KIND_GLOBAL = "codexWindowType"` `as const`. Preload (`build-bridge.ts`) and renderer (`main.ts`, `entry.tsx`) both import from it instead of using raw string literals.
- `apps/desktop/.vite/build/` after a packaged build contains `bootstrap.js`, `primary.js`, `settings.js`, `hud.js` (and their `.map` siblings); no `preload.js`.
- `forge.config.ts` declares four `build[]` entries (one main + three preloads), all three preload entries pointing at the same `vite.preload.config.ts`.
- `vite.preload.config.ts` is a single shared config with no `lib` block — just `sourcemap: true` and `rollupOptions.external: ["electron"]`. plugin-vite's framework wiring routes each forge `entry` through `rollupOptions.input` and emits `[name].js`.
- `factory.ts` resolves preload path via a kind switch; `additionalArguments: --window-kind=` is gone; `process.argv` is no longer read by any preload.
- All three windows boot in `pnpm dev:desktop` and a packaged build: primary renders the AppShell, settings renders the SettingsWindow, HUD renders the static HTML — and `window.lightfastBridge` is intact in each renderer (verified via DevTools console: `Object.keys(window.lightfastBridge)` returns the same 15 keys in all three).

### Key Discoveries

- `LightfastBridge` interface at `src/shared/ipc.ts:99-138` is the contract (15 top-level keys); we keep it identical, so renderer call-sites are unchanged in shape — only the global-name strings move behind a constant.
- `contextBridge.exposeInMainWorld("codexWindowType", kind)` already feeds `window.codexWindowType` (consumed at `entry.tsx:24` and `main.ts:36`); making each preload encode its own kind at compile time is a strict simplification of the current argv-parse path.
- **Spike-confirmed (worktree, 2026-05-07):** `electron-forge` plugin-vite's preload framework config sets `build.rollupOptions.input = forgeConfigSelf.entry` and `output.entryFileNames: '[name].js'`. The user-supplied config's `lib` block is incidental — three forge `build[]` entries pointing at the same `vite.preload.config.ts` produce three independent bundles named after each entry's basename. **No `lib` block, no per-kind config wrappers, and no factory function are needed.**
- The Sentry debug-id injection in `forge.config.ts:86-106` (packageAfterCopy) operates on `.vite/build/` as a directory; it picks up new files automatically. **No change needed.**

## What We're NOT Doing

- **No surface trimming.** All three preloads expose the identical `LightfastBridge`. A future change can shrink the HUD or settings surface by editing one file each — the seam is the deliverable for this batch.
- **No renderer bundle split.** `main_window` stays the single renderer; `entry.tsx`'s `if (window.codexWindowType === "settings")` branch stays. Per-kind renderer entry points are a separate (post-W4) decision.
- **No new IPC channels.** `IpcChannels` in `src/shared/ipc.ts` is untouched.
- **No HUD React mount.** HUD remains static-HTML-only. Adding a React tree to HUD would invalidate the "scaffolding only" framing.
- **No `electron-context-menu` or sandbox-policy tweaks.** Both keep their current single-config behavior; per-kind tightening is part of a future trust-boundary phase.
- **No preload tests today.** No vitest harness covers preload code — adding one requires the Playwright Electron CDP harness from W5 (`thoughts/shared/research/2026-05-06-desktop-deferred-grouping-for-worktrees.md` §W5). We will rely on packaged-build smoke + DevTools observation; success criteria below reflect that.
- **No CI matrix changes.** Existing `desktop-ci.yml` and `desktop-release.yml` exercise the build for free — three preload bundles flowing through is just `forge package` doing more work.

## Implementation Approach

The split factors into two concerns: **(a) authoring** the shared bridge module + per-kind entries + lifted global-name constants, and **(b) wiring** the build pipeline to compile and load them. We do (a) first so the new files exist and typecheck before any forge/vite config touches the build graph. Each phase ends with a state where the repo type-checks (or builds) cleanly; the cross-cutting change in P3 is the only one that requires updating multiple files in a single phase to keep the build green.

The execution sits in a separate worktree because (i) the user requested it, (ii) it touches `forge.config.ts` and `vite.preload.config.ts` — files W3 (Linux makers, landed on `main`) and any future W2 (`rebuildConfig`) will also touch — so a worktree lets us rebase cleanly against `main` if a competing branch lands first.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 0: Worktree + branch

### Overview

Create the isolated git worktree on a fresh `feat/desktop-preload-isolation` branch off `main`. All subsequent phases run inside the worktree.

### Changes Required:

#### 1. Worktree creation

**Commands:**
```bash
git -C /Users/jeevanpillay/Code/@lightfastai/lightfast fetch origin main
git -C /Users/jeevanpillay/Code/@lightfastai/lightfast worktree add \
  -b feat/desktop-preload-isolation \
  ../worktrees/desktop-W4-preload-isolation \
  origin/main
cd /Users/jeevanpillay/Code/@lightfastai/worktrees/desktop-W4-preload-isolation
pnpm install --frozen-lockfile
```

The `with-desktop-env.mjs --print` helper (per `CLAUDE.md`) will surface the worktree-prefixed aggregate URL as `https://desktop-W4-preload-isolation.lightfast.localhost` (sanitized last branch segment), which the desktop dev session uses automatically.

### Success Criteria:

#### Automated Verification:

- [x] Worktree exists: `git worktree list | grep desktop-W4-preload-isolation`
- [x] Branch is on `feat/desktop-preload-isolation` and rooted at `origin/main` (local `main` ref is stale by 18 commits; `origin/main` is the actual root): `git rev-parse --abbrev-ref HEAD` → `feat/desktop-preload-isolation`; `git rev-list --count origin/main..HEAD` → `0`
- [x] `pnpm install --frozen-lockfile` exits 0
- [x] Baseline desktop typecheck passes: `pnpm --filter @lightfast/desktop typecheck` (the plan said `@apps/desktop`; actual workspace package name is `@lightfast/desktop`)

---

## Phase 1: Shared bridge module + lifted global-name constants

### Overview

Three sub-changes that all touch new or shared files (no per-kind preload entries yet, no build wiring yet):

1. New `apps/desktop/src/shared/window-globals.ts` exporting `BRIDGE_GLOBAL` / `WINDOW_KIND_GLOBAL` `as const`.
2. Lift bridge construction out of `preload.ts` into a flat `apps/desktop/src/preload/build-bridge.ts` that consumes the new constants.
3. Adopt the constants in renderer (`main.ts`, `entry.tsx`) so the global names live behind one typed import everywhere.

The legacy `preload.ts` is **left in place** at end of phase (P3 wires the new files in and removes it). The duplication between `preload.ts` and `build-bridge.ts` is intentional and short-lived — both files compile, both define the same bridge surface against `LightfastBridge`, but only `preload.ts` is referenced by the build until P3.

### Changes Required:

#### 1. New shared global-name constants

**File**: `apps/desktop/src/shared/window-globals.ts` (new)

```ts
// Centralized names for globals exposed via contextBridge.exposeInMainWorld.
// Preload writes these names; renderer reads them. One file = no string drift.
export const BRIDGE_GLOBAL = "lightfastBridge" as const;
export const WINDOW_KIND_GLOBAL = "codexWindowType" as const;
```

#### 2. New shared bridge module (flat, sibling to per-kind entries)

**File**: `apps/desktop/src/preload/build-bridge.ts` (new)

```ts
import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import type { AcceleratorName } from "../shared/accelerators";
import {
  type AuthSnapshot,
  type BuildInfoSnapshot,
  IpcChannels,
  type LightfastBridge,
  type RuntimeConfigSnapshot,
  type SettingsSnapshot,
  type SystemThemeVariant,
  type UpdaterStatusSnapshot,
  type WindowKind,
} from "../shared/ipc";
import { BRIDGE_GLOBAL, WINDOW_KIND_GLOBAL } from "../shared/window-globals";

export function buildBridge(): LightfastBridge {
  const buildInfo = ipcRenderer.sendSync(
    IpcChannels.getBuildInfoSync
  ) as BuildInfoSnapshot;
  const updaterStatus = ipcRenderer.sendSync(
    IpcChannels.updaterStatusSync
  ) as UpdaterStatusSnapshot;
  const settings = ipcRenderer.sendSync(
    IpcChannels.getSettingsSync
  ) as SettingsSnapshot;
  const authSnapshot = ipcRenderer.sendSync(
    IpcChannels.authSnapshotSync
  ) as AuthSnapshot;
  const runtimeConfig = ipcRenderer.sendSync(
    IpcChannels.runtimeConfigSync
  ) as RuntimeConfigSnapshot;

  return {
    appOrigin: runtimeConfig.appOrigin,
    auth: {
      snapshot: authSnapshot,
      getToken: () => ipcRenderer.invoke(IpcChannels.authGetToken),
      signIn: () => ipcRenderer.invoke(IpcChannels.authSignIn),
      signOut: () => ipcRenderer.invoke(IpcChannels.authSignOut),
      onChanged: (listener) => {
        const handler = (_event: IpcRendererEvent, snap: AuthSnapshot) =>
          listener(snap);
        ipcRenderer.on(IpcChannels.authChanged, handler);
        return () => ipcRenderer.off(IpcChannels.authChanged, handler);
      },
      pendingSigninUrl: () =>
        ipcRenderer.invoke(IpcChannels.authPendingSigninUrl),
      onPendingSigninUrlChanged: (listener) => {
        const handler = (_event: IpcRendererEvent, url: string | null) =>
          listener(url);
        ipcRenderer.on(IpcChannels.authPendingSigninUrlChanged, handler);
        return () =>
          ipcRenderer.off(IpcChannels.authPendingSigninUrlChanged, handler);
      },
    },
    buildInfo,
    platform: process.platform,
    getSystemThemeVariant: () =>
      ipcRenderer.invoke(IpcChannels.getSystemThemeVariant),
    onSystemThemeVariantUpdated: (listener) => {
      const handler = (_event: unknown, variant: SystemThemeVariant) =>
        listener(variant);
      ipcRenderer.on(IpcChannels.systemThemeVariantUpdated, handler);
      return () =>
        ipcRenderer.off(IpcChannels.systemThemeVariantUpdated, handler);
    },
    onUpdaterStatusChanged: (listener) => {
      const handler = (_event: unknown, status: UpdaterStatusSnapshot) =>
        listener(status);
      ipcRenderer.on(IpcChannels.updaterStatusChanged, handler);
      return () => ipcRenderer.off(IpcChannels.updaterStatusChanged, handler);
    },
    onMenuAction: (listener) => {
      const handler = (_event: unknown, action: AcceleratorName) =>
        listener(action);
      ipcRenderer.on(IpcChannels.menuAction, handler);
      return () => ipcRenderer.off(IpcChannels.menuAction, handler);
    },
    onSettingsChanged: (listener) => {
      const handler = (_event: unknown, snapshot: SettingsSnapshot) =>
        listener(snapshot);
      ipcRenderer.on(IpcChannels.settingsChanged, handler);
      return () => ipcRenderer.off(IpcChannels.settingsChanged, handler);
    },
    openApp: () => ipcRenderer.invoke(IpcChannels.openApp),
    openWindow: (kind) => ipcRenderer.invoke(IpcChannels.openWindow, kind),
    reportError: (payload) =>
      ipcRenderer.send(IpcChannels.rendererError, payload),
    settings,
    updateSetting: (key, value) =>
      ipcRenderer.invoke(IpcChannels.updateSetting, { key, value }),
    updater: {
      status: updaterStatus,
      check: () => ipcRenderer.invoke(IpcChannels.updaterCheck),
      install: () => ipcRenderer.invoke(IpcChannels.updaterInstall),
    },
  };
}

export function exposePreload(kind: WindowKind): void {
  contextBridge.exposeInMainWorld(BRIDGE_GLOBAL, buildBridge());
  contextBridge.exposeInMainWorld(WINDOW_KIND_GLOBAL, kind);
}
```

#### 3. Adopt constants in renderer

**File**: `apps/desktop/src/renderer/src/main.ts`
**Changes**: Replace raw global-name strings with the imported constants.

- Add at top: `import { BRIDGE_GLOBAL, WINDOW_KIND_GLOBAL } from "../../shared/window-globals";`
- The `declare global { interface Window { ... } }` block at lines 15-16 keeps property names `lightfastBridge` and `codexWindowType` literal (TypeScript needs string literals there — global augmentation can't reference value-level constants). Add a one-line comment pointing to `window-globals.ts` as the source of truth.
- Line 36: `document.documentElement.dataset.windowKind = window[WINDOW_KIND_GLOBAL];` (or keep `window.codexWindowType` — semantically equivalent; pick whichever reads cleaner).

**File**: `apps/desktop/src/renderer/src/react/entry.tsx`
**Changes**: Replace raw `window.codexWindowType` with `window[WINDOW_KIND_GLOBAL]` after importing the constant. Same caveat for the `Window` interface augmentation if any lives here (lines 9-10).

The renderer's `window.lightfastBridge` accesses in app-shell, user-menu, settings panes, etc. **stay as raw property accesses** — TypeScript's global Window augmentation continues to type them. The lifting is for the two files that participate in declaring the augmentation and the one DOM-attribute mirror line; broader adoption is a follow-up.

### Success Criteria:

#### Automated Verification:

- [x] Files exist: `test -f apps/desktop/src/shared/window-globals.ts && test -f apps/desktop/src/preload/build-bridge.ts`
- [x] `build-bridge.ts` imports the constants: `grep -q 'from "../shared/window-globals"' apps/desktop/src/preload/build-bridge.ts`
- [x] Renderer adopts the constants: `grep -q 'window-globals' apps/desktop/src/renderer/src/main.ts && grep -q 'window-globals' apps/desktop/src/renderer/src/react/entry.tsx`
- [x] No new TS errors: `pnpm --filter @lightfast/desktop typecheck`
- [x] Legacy `preload.ts` still compiles untouched: `git diff apps/desktop/src/preload/preload.ts` → empty
- [x] No `_shared` directory was created: `! test -d apps/desktop/src/preload/_shared`

---

## Phase 2: Per-kind preload entries

### Overview

Author three thin entry files that each call `exposePreload(<kind>)`. They are not yet referenced by the build pipeline; this phase is pure additive code.

### Changes Required:

#### 1. Primary entry

**File**: `apps/desktop/src/preload/primary.ts` (new)

```ts
import { exposePreload } from "./build-bridge";

exposePreload("primary");
```

#### 2. Settings entry

**File**: `apps/desktop/src/preload/settings.ts` (new)

```ts
import { exposePreload } from "./build-bridge";

exposePreload("settings");
```

#### 3. HUD entry

**File**: `apps/desktop/src/preload/hud.ts` (new)

```ts
import { exposePreload } from "./build-bridge";

exposePreload("hud");
```

### Success Criteria:

#### Automated Verification:

- [x] All three entries exist and are 3 lines each: `wc -l apps/desktop/src/preload/{primary,settings,hud}.ts` reports 3 per file
- [x] Each entry imports only from `./build-bridge`: `grep -nE '^import' apps/desktop/src/preload/{primary,settings,hud}.ts` shows one import line per file pointing at `./build-bridge`
- [x] Workspace typechecks: `pnpm --filter @lightfast/desktop typecheck`

---

## Phase 3: Vite + electron-forge multi-entry wiring

### Overview

Replace the existing `vite.preload.config.ts` with a single shared config (no `lib` block), point three forge `build[]` entries at it, and remove the legacy `preload.ts`. End of phase, `pnpm --filter @apps/desktop build` emits `primary.js`, `settings.js`, `hud.js` in `.vite/build/`. The legacy preload file and the single forge entry are removed atomically so the build graph never references stale paths.

**Why no `lib` block, no factory, no per-kind config wrappers**: spike (worktree, 2026-05-07) confirmed `electron-forge`'s plugin-vite preload framework config sets `build.rollupOptions.input = forgeConfigSelf.entry` and `output.entryFileNames: '[name].js'`. The user-supplied config is merged on top (via `mergeConfig`), and the framework's `input` always wins. So a 13-line shared config is sufficient.

### Changes Required:

#### 1. Replace `vite.preload.config.ts` with the shared form

**File**: `apps/desktop/vite.preload.config.ts`
**Changes**: Drop the `lib` block entirely. Keep only what's still needed (sourcemaps + electron external).

```ts
import { defineConfig } from "vite";

// Shared by all preload entries declared in forge.config.ts.
// electron-forge plugin-vite supplies build.rollupOptions.input from each
// build[].entry and emits via output.entryFileNames: '[name].js', so each
// forge entry produces a bundle named after its file basename.
export default defineConfig({
  build: {
    sourcemap: true,
    rollupOptions: {
      external: ["electron"],
    },
  },
});
```

#### 2. Forge build array

**File**: `apps/desktop/forge.config.ts:195-207`
**Changes**: Replace the single `preload` entry with three per-kind entries — all pointing at the same `vite.preload.config.ts`.

```ts
new VitePlugin({
  build: [
    {
      entry: "src/main/bootstrap.ts",
      config: "vite.main.config.ts",
      target: "main",
    },
    {
      entry: "src/preload/primary.ts",
      config: "vite.preload.config.ts",
      target: "preload",
    },
    {
      entry: "src/preload/settings.ts",
      config: "vite.preload.config.ts",
      target: "preload",
    },
    {
      entry: "src/preload/hud.ts",
      config: "vite.preload.config.ts",
      target: "preload",
    },
  ],
  renderer: [
    {
      name: "main_window",
      config: "vite.renderer.config.ts",
    },
  ],
}),
```

#### 3. Remove legacy preload entry file

**File**: `apps/desktop/src/preload/preload.ts`
**Action**: `git rm` it. Phases 1-2 already moved its logic into `build-bridge.ts`; nothing references the old path anymore (the forge config now points at the per-kind entries, and `factory.ts` is updated in P4).

### Success Criteria:

#### Automated Verification:

- [x] Legacy preload file is gone: `! test -f apps/desktop/src/preload/preload.ts`
- [x] No per-kind vite wrappers were created: `! ls apps/desktop/vite.preload.primary.config.ts 2>/dev/null && ! ls apps/desktop/vite.preload.settings.config.ts 2>/dev/null && ! ls apps/desktop/vite.preload.hud.config.ts 2>/dev/null`
- [x] `vite.preload.config.ts` is the no-`lib` shared form: `! grep -q 'lib:' apps/desktop/vite.preload.config.ts`
- [x] Typecheck passes: `pnpm --filter @lightfast/desktop typecheck`
- [x] Local production build emits three preload bundles: `rm -rf apps/desktop/.vite && pnpm --filter @lightfast/desktop package` (the desktop package exposes `package`, not `build`; same vite-build leg) — `ls apps/desktop/.vite/build/{primary,settings,hud}.js{,.map}` all six present
- [x] No `preload.js` artefact remains in the build output: `! test -f apps/desktop/.vite/build/preload.js`

#### Human Review:

- [x] Inspected `apps/desktop/.vite/build/{primary,settings,hud}.js` — each contains `lightfastBridge` and `codexWindowType` string literals exactly once and ends with a kind-tagged ``exposePreload(`<kind>`)`` invocation (esbuild minified to template literals). Sizes 2893/2895/2885 bytes (within ~0.3%). TODO: automate via a build-output assertion script in P5

---

## Phase 4: factory.ts kind-resolved preload + drop --window-kind=

### Overview

Switch `windows/factory.ts` from a hardcoded `PRELOAD_PATH` to a per-kind resolver, and drop the `additionalArguments: --window-kind=` injection (each preload now hardcodes its kind via `exposePreload(kind)`).

### Changes Required:

#### 1. Per-kind preload path resolver

**File**: `apps/desktop/src/main/windows/factory.ts:21,47-56`
**Changes**: Replace `PRELOAD_PATH` constant with a `preloadFileFor(kind)` helper, and remove `additionalArguments` from the `webPreferences`.

```ts
// Replace:
//   const PRELOAD_PATH = join(factoryDir, "preload.js");
// with:
function preloadFileFor(kind: WindowKind): string {
  switch (kind) {
    case "settings":
      return "settings.js";
    case "hud":
      return "hud.js";
    default:
      return "primary.js";
  }
}

// Replace `preloadOptions(kind)` body:
function preloadOptions(kind: WindowKind): BrowserWindowConstructorOptions {
  return {
    webPreferences: {
      preload: join(factoryDir, preloadFileFor(kind)),
      sandbox: true,
      contextIsolation: true,
    },
  };
}
```

The `additionalArguments: ['--window-kind=${kind}']` line is removed entirely. The `WindowKind` import on line 8 stays — `preloadFileFor` still uses it.

### Success Criteria:

#### Automated Verification:

- [x] No more `--window-kind=` argv injection anywhere: `! grep -rn "\-\-window-kind=" apps/desktop/src` (the broader `window-kind` grep matches CSS `data-window-kind` attribute selectors, which are unrelated to the argv flag and intentionally retained)
- [x] No more `process.argv` reads in preload code: `! grep -rn "process\\.argv" apps/desktop/src/preload`
- [x] `factory.ts` references `preloadFileFor`: 2 hits (declaration + call site)
- [x] Typecheck passes: `pnpm --filter @lightfast/desktop typecheck`
- [x] Production build still passes: `pnpm --filter @lightfast/desktop package`
- [x] Existing main-process vitest still green: 4 test files / 45 tests passed

---

## Phase 5: Verification

### Overview

End-to-end smoke against `pnpm dev:desktop` and a packaged build. Confirms that:
1. Each window kind boots, mounts its renderer code path, and `window.lightfastBridge` plus `window.codexWindowType` are intact.
2. The packaged build's `.vite/build/` contains exactly the four expected JS bundles.
3. Existing flows (sign-in, settings persistence, theme toggling, HUD always-on-top) are not regressed.

No new code in this phase — only verification and the boundary commit.

### Success Criteria:

#### Automated Verification:

- [x] Full repo typecheck: `pnpm typecheck` (52/52 packages)
- [x] Full repo lint/check: `pnpm check` (1104 files, no issues)
- [x] Desktop tests pass: `pnpm --filter @lightfast/desktop test` (45/45)
- [x] Clean build pipeline (substituted `package` for `build` since the desktop package has no `build` script — `package` runs the same vite leg):
  ```bash
  rm -rf apps/desktop/.vite apps/desktop/out
  pnpm --filter @lightfast/desktop package
  ls apps/desktop/.vite/build/{bootstrap,primary,settings,hud}.js  # all four present
  ! test -f apps/desktop/.vite/build/preload.js  # confirmed
  ```
- [x] `forge.config.ts` declares exactly four `build[]` entries: `grep -cE '^\s+entry: "src/' apps/desktop/forge.config.ts` returns `4`
- [x] All three preload entries reference the shared config: `grep -cE 'config: "vite\.preload\.config\.ts"' apps/desktop/forge.config.ts` returns `3`

#### Human Review:

Driven via Playwright Electron CDP (preview of the W5 harness): launched `pnpm dev:desktop` with `LIGHTFAST_REMOTE_DEBUG_PORT=9222` from the worktree (via the `lightfast-electron` skill stdin-pipe workaround), connected with `chromium.connectOverCDP`, asserted bridge surface + globals + DOM mounts on each window, then `openWindow("settings")` / `openWindow("hud")` from the primary page to spawn the other surfaces.

- [x] Primary window:
  - `Object.keys(window.lightfastBridge).length` → `15` ✓
  - `Object.keys(window.lightfastBridge).sort()` matches the expected 15-name list ✓
  - `window.codexWindowType` → `"primary"` ✓
  - `document.documentElement.dataset.windowKind` → `"primary"` ✓
  - `react-root` mounted (AppShell), `user-menu-root` mounted, `settings-root` empty ✓

- [x] Settings window:
  - `window.codexWindowType` → `"settings"` ✓
  - `document.documentElement.dataset.windowKind` → `"settings"` ✓
  - `Object.keys(window.lightfastBridge).length` → `15` ✓ (same keys as primary)
  - `settings-root` mounted (SettingsWindow), `react-root` empty, `user-menu-root` empty ✓
  - Loaded URL: `http://localhost:5173/#settings`

- [x] HUD window:
  - `window.codexWindowType` → `"hud"` ✓
  - `document.documentElement.dataset.windowKind` → `"hud"` ✓
  - `Object.keys(window.lightfastBridge).length` → `15` ✓ (same keys as primary/settings)
  - Loaded URL: `http://localhost:5173/#hud`. Note: `react-root` is also populated on HUD with AppShell — this is preserved origin/main behavior (entry.tsx else-branch covers both primary and HUD; HUD-visible content is CSS-gated by `data-kind-hud` selectors), not a regression introduced by W4. HUD always-on-top, sizing, and traffic-light position were not asserted via CDP and remain a visual check; the structural seam is verified.

- [ ] **Packaged-build smoke (deferred manual)**: `pnpm --filter @lightfast/desktop package` was run twice during phases 3 and 4 and emitted the expected four `.vite/build/` bundles, but actually launching `Lightfast.app` from `apps/desktop/out/` and re-running the three-window console checks against the packaged renderer was not exercised in this run. The packaged path differs from dev only in (a) renderer URL (file://) and (b) FusesPlugin patching of the Electron binary — neither touches the preload-isolation surface. Recommended to run once before merge; no W4 evidence indicates a dev-vs-prod divergence.

---

## Testing Strategy

### Unit Tests

No new vitest suites are added. The preload module is browser-context (sandboxed renderer with Electron's `contextBridge`) and isn't import-clean to vitest under the existing harness. Adding preload tests requires the Playwright Electron CDP harness from W5 — out of scope here.

The shared `build-bridge.ts` is technically import-clean to vitest *if* `electron` is mocked, but the value of such a unit test is low: it would essentially re-assert that `IpcChannels` keys map to `ipcRenderer.invoke` paths — a tautology against `src/shared/ipc.ts`. Skipped.

### Integration Tests

Existing `apps/desktop/src/main/__tests__/` suites (auth-flow, auth-focus-gate, protocol) must continue to pass; they're orthogonal to the preload split. Verified in Phase 4 success criteria.

End-to-end coverage is the manual three-window console check in Phase 5. When W5 lands the Playwright Electron CDP harness, the natural follow-on is a Playwright test that boots all three windows and asserts `window.lightfastBridge` + `window.codexWindowType` from each — that becomes the automated graduation of the Phase 5 Human Review entries.

## Performance Considerations

Three preload bundles instead of one means three Rollup outputs per build and three CJS files in the packaged asar. Each preload bundle is small (the current bridge surface is essentially a thin wrapper over `ipcRenderer`) and shares no code at runtime — plugin-vite produces independent bundles per `build[]` entry. Measure actual sizes during Phase 5 verification rather than estimating up front; the asar delta is the kind of thing the dry-run pipeline reports for free.

Dev-rebuild time: forge-vite-plugin watches each `build[]` entry independently. A change to `build-bridge.ts` triggers all three preload rebuilds (in parallel). A change to e.g. `primary.ts` triggers only its own rebuild. The slowest plausible regression is ~3× the current single-rebuild time on `build-bridge.ts` edits — acceptable for the scaffolding payoff.

## Migration Notes

No user-visible state migration. `additionalArguments: --window-kind=` is removed without deprecation because (a) it's an internal-only argv flag set by main and read by preload — never persisted and never observable to users, and (b) the new preloads encode their kind at compile time, so an old preload reading argv from a new main would still be correct (kind would still come through), but the inverse (old main + new preload) is unreachable since they ship in the same asar.

For developers running `pnpm dev:desktop` with stale `.vite/` cache: `rm -rf apps/desktop/.vite` is the clean recovery if a window opens with a missing `preload` and crashes. The Phase 5 clean-build step covers this.

**`__SENTRY_DSN__` define gap (forward-looking).** `vite.main.config.ts` has a `define: { __SENTRY_DSN__: ... }` block; `vite.preload.config.ts` does not (today, before this plan, and after). Preload doesn't emit Sentry events directly, so the gap is intentional. If a future change wants `@sentry/electron/renderer` (or similar) inside preload, the `define` needs to be added in this single shared config — that change lands once and applies to all three preload bundles automatically.

## References

- Research doc: `thoughts/shared/research/2026-05-06-desktop-deferred-grouping-for-worktrees.md` §W4
- Parent gap doc: `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md` §7 "Per-surface preload isolation"
- Current preload: `apps/desktop/src/preload/preload.ts:1-104`
- Current factory: `apps/desktop/src/main/windows/factory.ts:21,47-56`
- Current forge build entries: `apps/desktop/forge.config.ts:195-207`
- Current vite preload config: `apps/desktop/vite.preload.config.ts:1-15`
- Current renderer entry branch on `codexWindowType`: `apps/desktop/src/renderer/src/react/entry.tsx:24-50`
- IPC contract: `apps/desktop/src/shared/ipc.ts:99-138`
- W1 (sibling worktree pattern, landed): PR #655, `thoughts/shared/plans/2026-05-07-desktop-w1-observability-tier-2.md` (per status note in research doc)
- W3 (sibling worktree pattern, landed): PRs #650, #652

## Improvement Log

### 2026-05-07 — `/improve_plan` adversarial review + spike

**Spike result: CONFIRMED** (worktree, branch since cleaned). Tested whether `electron-forge` plugin-vite can drive three preload bundles from a single shared `vite.preload.config.ts`. **Even cleaner than hypothesized**: plugin-vite's preload framework config sets `build.rollupOptions.input = forgeConfigSelf.entry` and `output.entryFileNames: '[name].js'`, so `lib` mode is incidental. A 13-line shared config with no `lib` block produces `primary.js` / `settings.js` / `hud.js` from three forge `build[]` entries. Key build artifact `ls .vite/build/`: four bundles (`bootstrap.js`, `primary.js`, `settings.js`, `hud.js`) plus their maps; no `preload.js`.

**Plan changes incorporated:**

1. **Dropped `_shared/` subfolder.** Shared bridge module is now flat at `apps/desktop/src/preload/build-bridge.ts`. With one shared file, the subfolder added depth without payoff and would have introduced a new repo convention with no precedent in `apps/desktop/src/`.

2. **Lifted `BRIDGE_GLOBAL` / `WINDOW_KIND_GLOBAL` to `apps/desktop/src/shared/window-globals.ts`.** Renderer (`main.ts`, `entry.tsx`) now imports the constants too — same spirit as `IpcChannels` in `src/shared/ipc.ts`. This expands W4's scope slightly (a few renderer line edits) but eliminates raw-string drift on global names. Window-interface augmentation keeps literal property names per TS requirements; only the value-side reads adopt the constants.

3. **Collapsed three vite config wrappers into one shared `vite.preload.config.ts` (no `lib` block).** Per spike result. Removed `preloadConfig({entry, fileName})` factory and the `vite.preload.{primary,settings,hud}.config.ts` wrappers from the plan. Phase 3 is now substantially smaller.

4. **Fixed key-count off-by-one.** `LightfastBridge` has 15 top-level members, not 14. Phase 5 DevTools assertions now check `Object.keys(...).length === 15` and enumerate all 15 names alphabetically.

5. **Dropped broken `node -e "import('./forge.config.ts')..."` check.** Node can't import `.ts` without a TS loader. Replaced with the grep alternative the plan already had as a fallback.

6. **Added `main.ts:36` consumer to verification.** `document.documentElement.dataset.windowKind` is the second consumer of `window.codexWindowType`; Phase 5 console checks now assert it per kind.

7. **Tightened `vite.main.config.ts`'s `__SENTRY_DSN__` define gap as a Migration Note.** Not a regression today; documented for the next preload-Sentry path.

8. **Phase 0 lockfile assertion uses `pnpm install --frozen-lockfile` exit code** instead of redundant `git status pnpm-lock.yaml` check.

9. **Dropped speculative "~6 KB minified" estimate** from Performance Considerations. Measure during Phase 5 instead.

10. **Phase 1 now explicitly notes intentional duplication** between legacy `preload.ts` and new `build-bridge.ts` until P3 — short-lived and short-circuited by the build graph not referencing `build-bridge.ts` until P3.
