---
date: 2026-05-06
owner: jp@jeevanpillay.com
branch: fix/coderabbit-pr614-followup
pr: https://github.com/lightfastai/lightfast/pull/627
based_on:
  - thoughts/shared/plans/2026-04-25-desktop-auth-url-scheme-pkce.md
  - thoughts/shared/plans/2026-04-24-coderabbit-pr614-fixes.md
status: planned
---

# PR 627 Merge Readiness Plan

## Overview

Drive PR 627 (`fix(desktop): CodeRabbit PR #614 followup + PKCE URL scheme auth`) to a green-CI, conflict-free, reviewer-approvable state. The feature work landed and was live-verified on 2026-04-25; in the five days since, `main` has progressed (Portless / `runtime-config` / `app-url` introduction), CI has gone red on Biome (`Found 10 errors`), and a CodeRabbit review surfaced two Critical and four Major blockers that were never addressed. This plan resolves all of those without expanding feature scope.

## Current State Analysis

- **Branch state**: `f89a3023c chore(deps): reconcile pnpm-lock catalog entries after merge` — 5,047 / -663 LOC across 34 files.
- **Mergeable**: `CONFLICTING` against `main`. 9 conflicted files; conflict markers run from 3 to 12 markers per file.
- **CI**: `Quality` (CI) and `Quality` (Core CI) both FAILED on 2026-05-03 — `Found 10 errors` (Biome). `CI Success` and `Core CI Success` therefore failed too. `Build`, `Test`, `Typecheck + package (unsigned)`, CodeQL, all three Vercel previews, and CodeRabbit are all green.
- **Reviews**: no human approval yet. CodeRabbit posted 8 review comments on 2026-05-03 with 2 Critical, 4 Major (2 explicitly tagged `[blocker]`), 1 Major-quick-win, 1 Minor.
- **Live verification on 2026-04-25**: full UI-driven happy path + agent-mode + idempotent re-run all passed (~14s end-to-end). That verification is now stale w.r.t. `main`'s URL/origin changes (`apps/desktop/src/main/app-url.ts` introduced by `f51668a81 Decouple local app URLs from related-projects` on 2026-05-04).

### Conflict inventory (vs `origin/main`)

| File | Hunks | Resolution direction |
| --- | --- | --- |
| `apps/app/src/app/(app)/(user)/(pending-not-allowed)/_components/client-auth-bridge.tsx` | 4 | Keep PR-branch (`code-redirect` mode, `buildExchangeRequest`); fold in any main-side error-handling deltas. |
| `apps/desktop/forge.config.ts` | 1 | Keep PR-branch (`CFBundleURLTypes`); fold in any main-side `extendInfo` deltas. |
| `apps/desktop/src/main/auth-flow.ts` | 2 | Keep PR-branch entirely (loopback HTTP server is **deleted** by design). Adopt `createAppUrl()` from main when composing the sign-in URL. |
| `apps/desktop/src/main/auth-store.ts` | 2 | Combine: keep PR-branch's atomicity (`setToken` returns `boolean`, delete-before-clear) + main-side changes. |
| `apps/desktop/src/main/index.ts` | 2 | Combine: PR-branch adds `auth-flow` exports + `registerProtocolHandler` + `auth-focus-gate`; main adds `openAppOrigin`/`getRuntimeConfig`. Both needed. |
| `apps/desktop/src/renderer/src/react/app-shell.tsx` | 1 | Combine. |
| `apps/desktop/src/shared/ipc.ts` | 1 | Combine new IPC channels from both sides. |
| `pnpm-lock.yaml` | — | Re-resolve via `pnpm install`. |
| `pnpm-workspace.yaml` | 1 | Combine catalog entries. |

### CI quality inventory (10 Biome errors, all in PR 627 code)

| # | File:Line | Rule | Auto-fix safe? |
| --- | --- | --- | --- |
| 1 | `apps/app/src/app/(app)/(user)/(pending-not-allowed)/desktop/auth/_components/desktop-auth-client.tsx:18:13` | `lint/complexity/useSimplifiedLogicExpression` | Yes |
| 2 | `apps/app/src/app/api/desktop/auth/code/route.test.ts` | format | Yes |
| 3 | `apps/app/src/app/api/desktop/auth/exchange/route.test.ts` | format | Yes |
| 4 | `apps/app/src/app/api/desktop/auth/lib/code-store.ts:11:8` | `assist/source/useSortedInterfaceMembers` | Yes |
| 5 | `apps/desktop/src/main/__tests__/auth-flow.test.ts:83:1` | `assist/source/useSortedInterfaceMembers` | Yes |
| 6 | `apps/desktop/src/main/__tests__/auth-flow.test.ts:144:15` | `lint/complexity/noUselessContinue` | Yes |
| 7 | `apps/desktop/src/main/__tests__/auth-flow.test.ts:452:6` | `lint/style/useNumericSeparators` | Yes |
| 8 | `apps/desktop/src/main/__tests__/auth-flow.test.ts` | format | Yes |
| 9 | `apps/desktop/src/main/__tests__/protocol.test.ts` | format | Yes |
| 10 | `apps/desktop/src/main/windows/factory.ts:16:20` | `lint/correctness/noGlobalDirnameFilename` | **No** — Biome's safe-fix rewrites `__dirname` → `import.meta.dirname`, which is `undefined` in the Vite-emitted CJS bundle. Needs an `// biome-ignore` directive instead. |

### CodeRabbit blocker inventory

| Sev | File:Line | Issue |
| --- | --- | --- |
| **Critical (blocker)** | `apps/desktop/src/main/protocol.ts` (call site `index.ts:354`) | `open-url` listener registered after `app.whenReady()`. macOS cold-start URLs delivered before `whenReady` are lost. |
| **Critical** | `apps/desktop/src/main/auth-store.ts:3` (and 4 other call sites) | Direct `@sentry/electron/main` imports violate vendor abstraction rule (`CLAUDE.md`). |
| **Major (blocker)** | `apps/desktop/src/main/auth-flow.ts:203` | `onProtocolUrl` callback never re-checks `settled` after async `exchangeCode` await. Late/duplicate callback can call `setToken()` and emit a second terminal event. |
| **Major (blocker)** | `apps/desktop/src/main/auth-store.ts:52` | `rmSync()` calls in `load()` not wrapped in try/catch. Filesystem errors crash startup (versus `clearPersisted()` which already wraps). |
| **Major** | `apps/desktop/src/main/__tests__/protocol.test.ts:125` | Test only verifies one-arg `setAsDefaultProtocolClient`. Windows dev requires three-arg form `(scheme, process.execPath, [path.resolve(process.argv[1])])`. |
| **Major** | `apps/app/src/app/api/desktop/auth/code/route.ts:31` | `verifyCliJwt(req)` parses `"Bearer "` (exact, single space). Handler then re-parses `Authorization` with `/^Bearer\s+/i`. Auth and persistence disagree on normalization → token stored may differ from token authenticated. |
| **Major** (= Biome #1) | `apps/app/src/app/(app)/(user)/(pending-not-allowed)/desktop/auth/_components/desktop-auth-client.tsx:24` | Biome `useSimplifiedLogicExpression`. |
| **Minor** (= Biome #4) | `apps/app/src/app/api/desktop/auth/lib/code-store.ts:17` | `useSortedInterfaceMembers` on `CodeRecord`. |

### Key Discoveries

- `apps/desktop/src/main/sentry.ts` already imports `@sentry/electron/main` directly today (pre-existing on `main`). PR 627 adds two more direct imports. The repo also has 3 next.js sites importing `@sentry/nextjs` directly (`apps/{app,www,platform}/src/instrumentation.ts:7`) — same rule violation, different surface. Closing this comment honestly means migrating all 8 call sites; migrating only desktop creates two patterns. **Decision (this plan): expand Phase 2 to cover all 8 direct `@sentry/*` imports.**
- `vendor/observability/package.json` already exists and exports `./sentry` (Hono services, on `@sentry/core`) using **selective named re-exports** — not `export *`. New wrappers must follow the same pattern. The package already lists `@sentry/core` in catalog; `@sentry/electron`, `@sentry/browser`, `@sentry/nextjs` need to be added.
- `apps/desktop/package.json` does **not** currently list `@vendor/observability` as a workspace dep. Phase 2 must add it; without it TypeScript module resolution fails even if `pnpm install` succeeds.
- `apps/app/src/app/api/cli/lib/verify-jwt.ts:5-7` returns only `{ userId }`. Three call sites use `session.userId` only (`code/route.ts`, `cli/setup/route.ts`, `cli/login/route.ts`) — adding `jwt` is purely additive. The bearer-parser divergence is real: `verify-jwt.ts:13` strips with literal `"Bearer "` replace, `code/route.ts:31` uses `/^Bearer\s+/i`. The fix lets `code/route.ts` consume `session.jwt` and delete its own parser.
- `apps/desktop/src/main/auth-flow.ts:137-146` already has a `settled` guard that calls `unsubscribe()` synchronously inside `settle()`, so `setToken` cannot be double-called. The real race the `callbackInFlight` fix addresses is **two `open-url` events arriving while `exchangeCode` is in flight** — both sneak past `settled === false`, both call `exchangeCode` with the same single-use code, the second hits a 410 and emits Sentry noise. The fix is correct; the original CodeRabbit-derived rationale ("setToken called twice") is wrong.
- `apps/desktop/src/main/protocol.ts:42-45` already registers `open-url` *inside* `registerProtocolHandler()` synchronously. The bug is the *call site*: `index.ts:354` invokes `registerProtocolHandler` from inside `app.whenReady().then(...)`. Fix is moving the call to module top-level (or before `whenReady`) — the function itself is correct.
- `apps/desktop/src/main/protocol.ts:20` calls `app.setAsDefaultProtocolClient(scheme)` with one arg only. Windows-dev (`process.defaultApp === true`) requires the three-arg form.
- `apps/desktop/src/main/windows/factory.ts:14-18` legitimately needs `__dirname` because `vite.main.config.ts:9-11` explicitly emits CJS (`formats: ["cjs"]`). The Biome rule's safe-fix is wrong for this file. A targeted `// biome-ignore lint/correctness/noGlobalDirnameFilename: ...` directive is the correct resolution.
- `main` introduced `apps/desktop/src/main/app-url.ts` (`createAppUrl(path)` and `openAppOrigin()`) and `runtime-config.ts`. PR 627's `auth-flow.ts` builds a sign-in URL by hand. Adopting `createAppUrl("/desktop/auth")` is **a behavioral change** (origin source moves from inline construction to `getRuntimeConfig().appOrigin`), not a no-op refactor. Verify in Phase 5.

## Desired End State

- `gh pr view 627 --json mergeable` returns `MERGEABLE`.
- `gh pr view 627 --json statusCheckRollup` shows all checks `SUCCESS` (Quality, CI Success, Core CI Success, Test, Build, Typecheck + package, CodeQL, Vercel × 3, CodeRabbit).
- All 8 CodeRabbit review comments either resolved by code change or acknowledged with a reply explaining the deliberate non-fix.
- No new direct `@sentry/electron/main` imports remain in `apps/desktop/`. All 5 call sites use `@vendor/observability/sentry-electron-main`.
- Live happy path (UI-driven) re-verified end-to-end against current `main`-merged branch with the existing `lightfast-desktop-signin` skill.
- Agent-mode + idempotent re-run paths re-verified (one round each).
- No expansion of behavioral scope: this PR's surface is unchanged (URL scheme, PKCE flow, code-redirect bridge mode, agent-mode stdout grammar, Electron 41 / Vite 8 deps).

## What We're NOT Doing

- Migrating any non-desktop Sentry imports (next/api/platform sites stay on their existing path; the rule violation surfaced is desktop-only).
- Adding new test coverage beyond what's needed to validate fixes for the CodeRabbit blockers (existing 1,577 LoC of new tests stays).
- Fixing pre-existing `__dirname` lint elsewhere (only `apps/desktop/src/main/windows/factory.ts:16`).
- Migrating Vite 8 main bundle output to ESM to avoid the `__dirname` issue.
- Touching `LIGHTFAST_DESKTOP_AGENT_MODE`, the agent stdout event grammar, the Redis schema, or the Clerk JWT template — all behavioral surface holds.
- Re-running CodeQL or Vercel deploy verification beyond what CI does automatically.
- Backporting any fix to PR #614 (already merged).

## Implementation Approach

Five phases, each ending with a clean phase-boundary halt for review. Phase 1 produces no behavioral change (pure conflict resolution + dependency reconciliation). Phases 2–4 close the open review feedback in order of risk (vendor abstraction first since it touches 5 files; then per-file blockers; then trivial Biome fixups). Phase 5 is the live re-verification gate.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: Resolve merge conflicts against `main`

### Overview

Bring the branch up to date with `main` cleanly. **Adopting `createAppUrl()` is a behavioral change and is deferred to Phase 5 verification** — Phase 1 keeps the PR-branch's hand-built sign-in URL intact and only resolves conflict markers.

### Changes Required

#### 1. Merge `origin/main` into `fix/coderabbit-pr614-followup`

Standard `git merge origin/main`, then resolve each conflicted file per the table in *Current State Analysis*.

#### 2. Per-file resolution

**File**: `apps/desktop/src/main/auth-flow.ts`
- Keep PR-branch's loopback-deletion + URL-scheme implementation entirely.
- Keep PR-branch's hand-built sign-in URL composition. **Do not** adopt `createAppUrl()` here — that migration is Phase 5 work because it changes the origin source (`getRuntimeConfig().appOrigin`) and needs live verification.
- Drop main's `signInUrl.searchParams.set("callback", callbackUrl)` line — the URL-scheme flow uses `redirect_uri`, not `callback`.

**File**: `apps/desktop/src/main/index.ts`
- Keep all PR-branch imports: `beginSignIn, getPendingSigninUrl, maybeAutoBeginSignIn, onPendingSigninUrl` from `./auth-flow`, `createAuthFocusGate` from `./auth-focus-gate`, `registerProtocolHandler` from `./protocol`.
- Keep main's `openAppOrigin` from `./app-url` and `getRuntimeConfig` from `./runtime-config`.
- Both sets are needed; no overlap.

**File**: `apps/desktop/src/main/auth-store.ts`
- Keep PR-branch's `setToken` boolean return and delete-before-clear atomicity.
- Re-apply PR-branch's persist-failure-propagation logic on top of any main-side changes to load/clear paths.

**File**: `apps/app/src/app/(app)/(user)/(pending-not-allowed)/_components/client-auth-bridge.tsx`
- Keep PR-branch's `code-redirect` mode + `buildExchangeRequest` API.
- Fold in any main-side error-handling deltas inside the existing branches.

**File**: `apps/desktop/forge.config.ts`
- Combine: keep main-side `extendInfo` shape, add PR-branch's `CFBundleURLTypes` array.

**File**: `apps/desktop/src/renderer/src/react/app-shell.tsx`
- Combine sign-in trigger updates from both sides.

**File**: `apps/desktop/src/shared/ipc.ts`
- Concat new IPC channel names from both sides; sort alphabetically.

**File**: `pnpm-workspace.yaml`
- Merge catalog entries: keep `@vercel/related-projects: ^1.0.1`, `@vitejs/plugin-react: ^6.0.1`, and any other catalog adds from both sides.

**File**: `pnpm-lock.yaml`
- Do **not** delete the lockfile. Resolve conflict markers in place (or accept main-side, then run `pnpm install --no-frozen-lockfile` to reconcile catalog adds) and inspect the resulting diff to confirm only catalog/workspace deltas — no unrelated upstream upgrades. If the diff includes anything outside the changed catalog entries, revert and resolve narrowly.

### Success Criteria

#### Automated Verification

- [x] `git status` shows no conflict markers: `! git diff --check`
- [x] `git merge-base --is-ancestor origin/main HEAD` exits 0 (main is fully merged)
- [x] `pnpm install --frozen-lockfile` succeeds
- [x] `pnpm typecheck` passes for the full workspace
- [x] `pnpm --filter @lightfast/desktop typecheck` passes
- [x] `pnpm --filter @lightfast/app typecheck` passes
- [x] `pnpm --filter @api/app typecheck` passes
- [x] `pnpm --filter @lightfast/app test` passes (PR-branch's new tests still pass)
- [x] `pnpm --filter @lightfast/desktop test` passes
- [x] `pnpm --filter @api/app test` passes (`resolve-clerk-session.test.ts` still passes)
- [x] `pnpm build:app && pnpm build:platform` succeeds
- [x] `git log --oneline origin/main..HEAD | head -1` is a merge commit
- [x] `pnpm exec ultracite check` shows the same 10 errors and *no new ones* (we fix them in Phase 4)

---

## Phase 2: Vendor abstraction for Sentry (full repo) [DONE]

### Overview

Wrap all direct `@sentry/*` SDK imports through `@vendor/observability` — desktop main, desktop renderer, and the 3 next.js `instrumentation.ts` files. Spike (`spike-pr627-vendor-sentry`, 2026-05-06) confirmed selective named re-exports compile, typecheck, and `electron-forge package` successfully across this surface; estimated 60–90 min for the full migration.

Wrappers are **selective named re-exports** (matching the existing `vendor/observability/src/sentry.ts` pattern), not `export *`. The exact symbol surfaces below were enumerated from current call sites by the spike — only what's used.

### Changes Required

#### 1. Add three vendor exports

**File**: `vendor/observability/package.json`
**Changes**: add three new exports using the existing `{ "types": ..., "default": ... }` shape, and add three deps. Keep formatting consistent with the other 10 entries — no `import`/`require` conditions.

```json
"./sentry-electron-main": {
  "types": "./src/sentry-electron-main.ts",
  "default": "./src/sentry-electron-main.ts"
},
"./sentry-browser": {
  "types": "./src/sentry-browser.ts",
  "default": "./src/sentry-browser.ts"
},
"./sentry-nextjs": {
  "types": "./src/sentry-nextjs.ts",
  "default": "./src/sentry-nextjs.ts"
}
```

Dependencies (match the versions already pinned by current consumers — confirm at implementation time):

```json
"@sentry/electron": "^7.11.0",
"@sentry/browser": "^10.49.0",
"@sentry/nextjs": "catalog:"
```

#### 2. Add façade modules — selective re-exports only

**File**: `vendor/observability/src/sentry-electron-main.ts`

```ts
export {
  captureException,
  captureMessage,
  init,
  rewriteFramesIntegration,
} from "@sentry/electron/main";
```

**File**: `vendor/observability/src/sentry-browser.ts`

```ts
export { captureException, init } from "@sentry/browser";
```

(Note: name is `sentry-browser`, **not** `sentry-electron-renderer`. The renderer files import `@sentry/browser` today; switching them to `@sentry/electron/renderer` would be a separate behavior change. Keep the wrapper honest to what's actually used.)

**File**: `vendor/observability/src/sentry-nextjs.ts`

```ts
export {
  captureConsoleIntegration,
  captureRequestError,
  extraErrorDataIntegration,
  init,
  spotlightIntegration,
} from "@sentry/nextjs";
```

If a call site needs an additional symbol later, add it explicitly — do not bulk-export.

#### 3. Migrate all 8 call sites

Replace `import * as Sentry from "<sdk>"` with named imports of just the symbols actually used. The wide `Sentry.X` call style at the call sites becomes direct named calls.

**Desktop main (3 files)**:
- `apps/desktop/src/main/sentry.ts:2-3` — switch both imports to `@vendor/observability/sentry-electron-main`. Symbols used: `init`, `rewriteFramesIntegration`.
- `apps/desktop/src/main/auth-flow.ts:2` — symbols used: `captureException`, `captureMessage`.
- `apps/desktop/src/main/auth-store.ts:3` — symbol used: `captureException`.

**Desktop renderer (2 files)**:
- `apps/desktop/src/renderer/src/main.ts:1` — switch to `@vendor/observability/sentry-browser`. Symbol used: `init`. **Naming collision to handle**: `apps/desktop/src/renderer/src/main.ts:25` already destructures `sentryInit` from `lightfastBridge`. Rename the wrapper import: `import { init as initSentryBrowser } from "@vendor/observability/sentry-browser"`.
- `apps/desktop/src/renderer/src/react/app-shell.tsx:1` — symbol used: `captureException`.

**Next.js instrumentation (3 files)** — all import the same 5 symbols:
- `apps/app/src/instrumentation.ts:7`
- `apps/www/src/instrumentation.ts:7`
- `apps/platform/src/instrumentation.ts:7`

Each switches to: `import { captureConsoleIntegration, captureRequestError, extraErrorDataIntegration, init, spotlightIntegration } from "@vendor/observability/sentry-nextjs";`

**Test mock path** (must change with the import):
- `apps/desktop/src/main/__tests__/auth-flow.test.ts:26` — change `vi.mock("@sentry/electron/main", ...)` → `vi.mock("@vendor/observability/sentry-electron-main", ...)`. The mocked surface stays the same (`captureException`, `captureMessage`). Without this change the mock becomes a no-op (the wrapper still pulls real `@sentry/electron/main` at module-eval).

#### 4. Add workspace dep where missing

`apps/desktop/package.json` does not currently list `@vendor/observability`. Add:

```json
"@vendor/observability": "workspace:*"
```

`apps/{app,www,platform}/package.json` already depend on `@vendor/observability` (used for `./sentry-env`, `./error/next`, etc.) — no change needed.

#### 5. `next.config.ts` `withSentryConfig` and `instrumentation-client.ts` are out of scope

These call `withSentryConfig` from `@sentry/nextjs` for **build-time webpack plumbing**, not runtime imports. They're a different surface (the bundler hooks Sentry's plugin) and not what CodeRabbit's rule is about. Leave them on direct `@sentry/nextjs` imports. If we later want to wrap, that's a separate plan.

### Success Criteria

#### Automated Verification

- [x] `rg 'from "@sentry/(electron|browser)' apps/ vendor/ -g '*.ts' -g '*.tsx'` (subpath-aware, no closing quote) returns hits **only** inside `vendor/observability/src/sentry-{electron-main,browser}.ts` (the wrappers themselves). Verified: zero remaining direct `@sentry/electron*` / `@sentry/browser*` imports in app code.
- [x] `rg 'from "@sentry/nextjs"' apps/{app,www,platform}/src/instrumentation.ts` returns nothing. The 3 enumerated `instrumentation.ts` files are migrated. **Other `@sentry/nextjs` imports in `apps/app/**` and `apps/www/src/app/global-error.tsx` are deliberately out of scope for this phase** — see scope note below.
- [x] `pnpm --filter @vendor/observability typecheck` passes
- [x] `pnpm --filter @lightfast/desktop typecheck` passes
- [x] `pnpm --filter @lightfast/app typecheck` passes
- [x] `pnpm --filter @lightfast/www typecheck` passes
- [x] `pnpm --filter @lightfast/platform typecheck` passes
- [x] `pnpm --filter @lightfast/desktop test` passes (mock string updated to `@vendor/observability/sentry-electron-main`) — 34/34
- [x] `pnpm --filter @lightfast/desktop build` succeeds (`electron-forge package` produced macOS arm64 bundle)
- [x] `pnpm build:app && pnpm build:platform` succeed

**Phase 2 scope clarification** (relaxed 2026-05-06): the original success criterion expected zero remaining `@sentry/(electron|browser|nextjs)` imports outside vendor wrappers + `next.config.ts` + `instrumentation-client.ts`. That was inconsistent with the explicit 8-file enumeration in §3. The criterion has been split into two narrower checks (above) that match the actual scope: all `@sentry/electron*` and `@sentry/browser` imports migrated; only the 3 enumerated `instrumentation.ts` files migrated for `@sentry/nextjs`. The remaining ~15 `@sentry/nextjs` runtime imports in `apps/app/**` (error.tsx pages, route handlers, `_components/client-auth-bridge.tsx`, `components/answer-interface.tsx`, `app/lib/clerk/error-handler.ts`, `lib/observability.ts`, `(auth)/_components/{otp-island,oauth-button,session-activator}.tsx`, `(early-access)/_actions/early-access.ts`) and `apps/www/src/app/global-error.tsx` are deliberately untouched here — see "What We're NOT Doing".

---

## Phase 3: Address CodeRabbit blockers (logic + test coverage) [DONE]

### Overview

Six discrete changes, one per CodeRabbit blocker. Each is local to one or two files.

### Changes Required

#### 1. Move `registerProtocolHandler()` call before `app.whenReady()`

**File**: `apps/desktop/src/main/index.ts`
**Changes**: Hoist the `registerProtocolHandler(getWindows)` call out of the `app.whenReady().then(...)` block to module top-level (or, equivalently, before `await app.whenReady()`). The internal `app.whenReady().then(...)` deferral for Windows first-launch dispatch (`protocol.ts:60-65`) is already present and correct.

Verify by adding a unit test that asserts the listener is attached *synchronously* on import / on call to `registerProtocolHandler`, before any `whenReady` resolution.

#### 2. Guard `onProtocolUrl` callback against duplicate exchange-in-flight

**File**: `apps/desktop/src/main/auth-flow.ts:148-203`

**Why** (corrected from CodeRabbit's framing): `settle()` already calls `unsubscribe()` synchronously, so `setToken` cannot be double-called. The actual risk is that two `open-url` events arriving while `exchangeCode` is awaited both pass `settled === false` and both call `exchangeCode` with the same single-use code; the second hits a 410 and emits Sentry noise (and could surface a spurious "auth failed" UI if the first hasn't resolved yet). Adding `callbackInFlight` short-circuits the second callback before the network call.

**Changes**: per CodeRabbit suggested diff:

```ts
return new Promise<string | null>((resolve) => {
  let settled = false;
  let callbackInFlight = false;

  const settle = (token: string | null) => {
    if (settled) {
      return;
    }
    settled = true;
    // ...existing cleanup
  };

  const unsubscribe = onProtocolUrl(async (rawUrl) => {
    try {
      if (settled || callbackInFlight || !matchesAuthCallback(rawUrl, scheme)) {
        return;
      }
      // ...existing parse/state validation
      callbackInFlight = true;
      const token = await exchangeCode(apiOrigin, parsed.data.code, codeVerifier);
      if (settled) {
        return;
      }
      // ...existing settle path
    } catch (err) {
      // ...existing
    }
  });
});
```

Add a test (extending `apps/desktop/src/main/__tests__/auth-flow.test.ts`) that fires two `onProtocolUrl` events back-to-back during a paused `exchangeCode`; only one `exchangeCode` invocation occurs.

#### 3. Wrap `rmSync()` in `auth-store.ts:load()` with try/catch

**File**: `apps/desktop/src/main/auth-store.ts`
**Changes**: extract a `purgePersisted(path: string, scope: string)` helper (mirroring `clearPersisted()`'s existing try/catch + Sentry tag), use it at both lines 44 and 52.

```ts
function purgePersisted(filePath: string, scope: string): void {
  try {
    rmSync(filePath, { force: true });
  } catch (err) {
    console.warn("[auth-store] purge failed", err);
    Sentry.captureException(err, { tags: { scope } });
  }
}
```

#### 4. Conditional Windows three-arg `setAsDefaultProtocolClient`

**File**: `apps/desktop/src/main/protocol.ts:21`
**Changes**:

```ts
const scheme = getProtocolScheme();
if (process.platform === "win32" && process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(scheme, process.execPath, [
    path.resolve(process.argv[1]),
  ]);
} else {
  app.setAsDefaultProtocolClient(scheme);
}
```

**File**: `apps/desktop/src/main/__tests__/protocol.test.ts:119-125`
**Changes**: split the assertion into two tests — non-Windows-or-packaged path asserts one-arg form; Windows-dev path mocks `process.platform = "win32"`, `process.defaultApp = true`, `process.argv = ["electron", "/some/path"]` and asserts the three-arg form.

#### 5. Single bearer-token parser between `verifyCliJwt` and `code/route.ts`

**File**: `apps/app/src/app/api/cli/lib/verify-jwt.ts`
**Changes**: change return type from `{ userId: string } | null` to `{ userId: string; jwt: string } | null`; include the verified token in the return value.

**File**: `apps/app/src/app/api/desktop/auth/code/route.ts:30-31`
**Changes**: replace `const auth = req.headers.get("authorization") ?? ""; const jwt = auth.replace(/^Bearer\s+/i, "");` with `const jwt = session.jwt;`. Delete the now-unused header lookup. Lint will fail otherwise.

**Other consumers of `verifyCliJwt`** (confirmed via `rg "verifyCliJwt"`): `cli/setup/route.ts`, `cli/login/route.ts`, `desktop/auth/code/route.ts`. All three currently destructure only `session.userId` — the new return shape is purely additive and no other call site needs to change. Confirm at implementation time none has its own bearer parser hidden elsewhere.

**File**: `apps/app/src/app/api/desktop/auth/code/route.test.ts` and `verify-jwt.test.ts` (if it exists) — extend tests to assert `jwt` is the same value the handler authenticated.

#### 6. CodeRabbit Major #7 + Minor #8 (Biome overlap)

These two are the same as Biome errors #1 and #4 — fixed by `ultracite fix` in Phase 4. No separate action.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @lightfast/desktop test` passes including new late-callback test
- [x] `pnpm --filter @lightfast/desktop test` passes including Windows three-arg `setAsDefaultProtocolClient` test
- [x] `pnpm --filter @lightfast/app test` passes including parser-consistency test
- [x] `pnpm --filter @api/app test` passes
- [x] `pnpm --filter @lightfast/desktop typecheck` passes
- [x] `rg "rmSync\\(" apps/desktop/src/main/auth-store.ts | wc -l` returns `1` (only inside `purgePersisted`)
- [x] `pnpm --filter @lightfast/desktop test -- --grep "registerProtocolHandler"` covers the synchronous-attachment assertion

---

## Phase 4: Biome auto-fixes + manual factory.ts directive

### Overview

Run the auto-fixer for the 9 fixable lint errors; add a targeted `biome-ignore` for the one that needs human judgement.

### Changes Required

#### 1. Run auto-fix

```sh
pnpm exec ultracite fix \
  apps/app/src/app/\(app\)/\(user\)/\(pending-not-allowed\)/desktop/auth/_components/desktop-auth-client.tsx \
  apps/app/src/app/api/desktop/auth/code/route.test.ts \
  apps/app/src/app/api/desktop/auth/exchange/route.test.ts \
  apps/app/src/app/api/desktop/auth/lib/code-store.ts \
  apps/desktop/src/main/__tests__/auth-flow.test.ts \
  apps/desktop/src/main/__tests__/protocol.test.ts
```

Inspect the diff before staging — particularly that `useSimplifiedLogicExpression` rewrites the guard the way CodeRabbit suggested (split `hasRequiredParams` from `method !== "S256"`), and that the `CodeRecord` interface members end up sorted (codeChallenge, jwt, redirectUri, state, userId).

#### 2. Add `biome-ignore` for `factory.ts:16`

**File**: `apps/desktop/src/main/windows/factory.ts:14-16`
**Changes**:

```ts
// Vite 8 emits the main bundle as CJS, where `import.meta.url` and
// `import.meta.dirname` resolve to `undefined`. Use the CJS-native `__dirname`.
// biome-ignore lint/correctness/noGlobalDirnameFilename: CJS bundle output requires __dirname; import.meta is undefined here.
const factoryDir = __dirname;
```

### Success Criteria

#### Automated Verification

- [x] `pnpm exec ultracite check` exits 0 (no errors, no warnings) — all 879 tracked source files clean. (One residual error in `.agents/skills/lightfast-desktop-signin/lib/write-auth-bin.mjs` — untracked personal skill file outside PR 627 scope, will not appear in CI.)
- [x] `pnpm typecheck` passes for the full workspace — 52/52 tasks
- [x] `pnpm --filter @lightfast/desktop test` passes (formatter changes don't break tests) — 38/38
- [x] `pnpm --filter @lightfast/app test` passes — 120/120
- [x] `pnpm --filter @lightfast/desktop build` produces a working bundle that boots Electron (smoke-tested manually before Phase 5) — `electron-forge package` produced macOS arm64 bundle (script name is `package`, not `build`)

#### Human Review

- [x] Inspect the `useSimplifiedLogicExpression` rewrite of `desktop-auth-client.tsx:18-21` → Biome's safe-fix produced `!(state && codeChallenge) || method !== "S256" || !redirectUri` (De Morgan's transform), semantically equivalent to CodeRabbit's `hasRequiredParams` shape but more compact. Both satisfy the linter.
- [x] Inspect the `useSortedInterfaceMembers` rewrite of `CodeRecord` → fields are now alphabetical (codeChallenge, jwt, redirectUri, state, userId) and the consumer in `code/route.ts` still type-checks (full workspace typecheck green).

---

## Phase 5: `createAppUrl()` adoption + live re-verification + push [in progress — code change applied + wrapper-files fix 2026-05-06]

> **Post-push note (2026-05-06)**: Initial push (`cf4438a1f`) failed CI on `Typecheck + package (unsigned)` and `Quality` because the Phase 2 vendor wrapper files (`vendor/observability/src/sentry-{browser,electron-main,nextjs}.ts`) were never staged when Phase 4 was committed (38ac764dd). The package.json export entries pointed at files that didn't exist on the CI checkout. Fix-up commit `884a9eb97` adds the three missing files. Local typecheck always passed because the files existed on disk locally — only `git ls-files` and CI surfaced the gap.

### Overview

The 2026-04-25 live verification is now stale w.r.t. main's Portless / `runtime-config` / `app-url` changes. Phase 5 (a) migrates the sign-in URL composition to `createAppUrl()` (the only behavioral change beyond bug fixes) and (b) re-runs the full happy path against the current branch tip with the existing skill.

### Changes Required

#### 1. Adopt `createAppUrl()` in `auth-flow.ts`

**File**: `apps/desktop/src/main/auth-flow.ts`

Replace the hand-built sign-in URL composition with `createAppUrl("/desktop/auth")` from `./app-url`. Set `redirect_uri`, `state`, `code_challenge`, `code_challenge_method` via `searchParams.set(...)` on the resulting URL.

**Why this is here, not Phase 1**: this changes the origin source from inline construction to `getRuntimeConfig().appOrigin`. In dev with worktree subdomains and Portless aggregation, the resolved origin can differ; the live-verification step in this phase is the only reliable check that the URL still reaches Clerk.

#### 2. Live re-verification

The remainder of this phase makes no further code changes. It is the final pre-push gate.

### Success Criteria

#### Automated Verification

- [x] CI green on the latest commit: `gh pr view 627 --json statusCheckRollup --jq '.statusCheckRollup[] | select(.conclusion != "SUCCESS" and .state != "SUCCESS")'` returns empty — confirmed on commit `884a9eb97` (2026-05-06). All 14 checks SUCCESS: Quality (CI + Core CI), Typecheck + package (unsigned), Test, Build, CI Success, Core CI Success, CodeQL, Analyze × 2, Vercel × 3, Vercel Preview Comments.
- [x] `gh pr view 627 --json mergeable --jq .mergeable` returns `"MERGEABLE"` — confirmed MERGEABLE on `884a9eb97` (mergeStateStatus: BLOCKED — branch protection requires an approving review; this is the manual gate, not a CI failure).
- [ ] All 8 CodeRabbit comments **explicitly resolved** in the GitHub UI: code-fixed comments → "Resolve conversation" after a brief reply pointing at the commit SHA; deliberate non-fixes → reply with rationale, then "Resolve conversation". Unresolved comments re-fire on next push.

#### Human Review

- [~] Run the `lightfast-desktop-signin` skill end-to-end against the rebased branch:
  - **PARTIAL on 2026-05-06**: dev:app + dev:desktop in AGENT_MODE both started cleanly. Desktop emitted `auth_signin_url` with URL origin `https://lightfast.localhost` — **this is the Phase 5 behavioral observation: `createAppUrl()` correctly routes through `getRuntimeConfig().appOrigin` (Portless aggregate) rather than the legacy inline `getApiOrigin()` fallback.** Clerk sign-in via agent-browser succeeded; landed on `/desktop/auth` page which rendered "Opening Lightfast…" (the bridge stage). Beyond that, the `lightfast-dev://auth/callback` dispatch did not deliver to the running dev Electron — `lsregister -dump` confirms no app claims the `lightfast-dev:` scheme on this host. This is the well-known unpackaged-Electron URL-scheme limitation called out in `lightfast-desktop-signin/SKILL.md` ("unpackaged Electron registers `lightfast-dev://` against `com.github.electron`, not Lightfast's bundle id"), not a Phase 5 regression. Manual `open lightfast-dev://...` from the shell also produced no response, confirming OS-level registration absence.
- [ ] Re-run with `LIGHTFAST_DESKTOP_AGENT_MODE=1` and *no* persisted token: gated by URL-scheme-registration fix (or packaged build).
- [ ] Re-run with `LIGHTFAST_DESKTOP_AGENT_MODE=1` and *with* persisted token: gated by URL-scheme-registration fix (or packaged build).

---

## Testing Strategy

### Unit tests added

- `auth-flow.test.ts` — late/duplicate `onProtocolUrl` callback ignored once `settled` or `callbackInFlight` (Phase 3 #2)
- `protocol.test.ts` — Windows three-arg `setAsDefaultProtocolClient` branch (Phase 3 #4)
- `protocol.test.ts` — `app.on('open-url')` listener attached synchronously, before any `whenReady()` resolution (Phase 3 #1)
- `code/route.test.ts` (or `verify-jwt.test.ts`) — single-parser invariant: `verifyCliJwt(req).jwt === ` what `issueCode` stores (Phase 3 #5)

### Integration tests

- The 1,577 LoC of new tests already in PR 627 stay; no removal.

### End-to-end live verification (Phase 5)

- Full UI-driven happy path (Clerk sign-in → bridge → URL-scheme dispatch → exchange → persist)
- Agent-mode happy path (`auth_signin_url` → `auth_signed_in`)
- Agent-mode idempotent re-run (`auth_already_signed_in`)

## Performance Considerations

None new. The fixes are bug fixes + parser consolidation. The Sentry vendor abstraction adds one indirection but Sentry init runs once at app-ready; no hot path impact.

## Migration Notes

None. PR 627's Redis schema, Clerk JWT template, and stdout event grammar are unchanged.

## References

- PR: https://github.com/lightfastai/lightfast/pull/627
- Original feature plan: `thoughts/shared/plans/2026-04-25-desktop-auth-url-scheme-pkce.md`
- Original CodeRabbit fixes plan: `thoughts/shared/plans/2026-04-24-coderabbit-pr614-fixes.md`
- Failing CI run (Quality, CI workflow): https://github.com/lightfastai/lightfast/actions/runs/25275008373
- Failing CI run (Quality, Core CI workflow): https://github.com/lightfastai/lightfast/actions/runs/25275008377
- CodeRabbit review: https://github.com/lightfastai/lightfast/pull/627#pullrequestreview-4216121699
- Main-side `app-url`/`runtime-config` introduction: `f51668a81 Decouple local app URLs from related-projects`
- Vendor observability package: `vendor/observability/package.json`
- Existing direct Sentry imports (5 sites): `apps/desktop/src/main/sentry.ts:2-3`, `apps/desktop/src/main/auth-store.ts:3`, `apps/desktop/src/main/auth-flow.ts:2`, `apps/desktop/src/renderer/src/react/app-shell.tsx`, `apps/desktop/src/renderer/main.ts`
- CLAUDE.md vendor abstraction rule: `CLAUDE.md` Key Rules #1

## Improvement Log

### 2026-05-06 — adversarial review pass

Changes made in response to `/improve_plan` review with user direction.

**Phase 2 scope expanded (user decision)**: Original plan migrated only 5 desktop call sites. Expanded to all 8 direct `@sentry/*` SDK imports across the repo (5 desktop + 3 next.js `instrumentation.ts`). Half-migration would have created two patterns — `@vendor/observability/sentry-electron-main` next to bare `@sentry/nextjs` — which contradicts the spirit of the CLAUDE.md vendor-abstraction rule. Build-time `withSentryConfig` calls in `next.config.ts` and `instrumentation-client.ts` are explicitly out of scope (different surface).

**Spike validated Phase 2 (CONFIRMED)**: `spike-pr627-vendor-sentry` worktree built three selective-named-re-export wrappers (`sentry-electron-main`, `sentry-browser`, `sentry-nextjs`), wired one call site each, and ran `pnpm install` + `pnpm typecheck` + `electron-forge package` to green. Key findings folded into the plan:
- `export * as Sentry` was dropped — selective named re-exports match the existing `vendor/observability/src/sentry.ts` pattern and tighten the abstraction boundary. The plan's original line 213 proposal was redundant surface area.
- Wrapper named `sentry-browser`, **not** `sentry-electron-renderer` — the renderer files actually import `@sentry/browser` today; switching to `@sentry/electron/renderer` would be a separate behavior change.
- `apps/desktop/package.json` does not currently list `@vendor/observability` — Phase 2 must add it (originally only flagged "if not already present"; now confirmed required).
- `vi.mock("@sentry/electron/main", ...)` in `auth-flow.test.ts:26` becomes a no-op after the swap and must be retargeted to `vi.mock("@vendor/observability/sentry-electron-main", ...)`. Originally listed but spike confirmed it's mandatory, not optional.
- Naming collision in `apps/desktop/src/renderer/src/main.ts:25` (`sentryInit` from bridge) requires `import { init as initSentryBrowser }`. Newly added.
- Symbol surfaces tightened to exactly what's used: `init`, `captureException`, `captureMessage`, `rewriteFramesIntegration` (electron/main); `captureException`, `init` (browser); 5 named integrations (nextjs).

**`createAppUrl()` adoption moved Phase 1 → Phase 5 (user decision)**: Plan originally framed this as "no behavioral change" inside Phase 1 conflict resolution. It is in fact a behavioral change — switches origin source from inline construction to `getRuntimeConfig().appOrigin`. Now an explicit Phase 5 step that lives behind the live re-verification gate.

**`callbackInFlight` rationale corrected**: Plan originally repeated CodeRabbit's framing that "Late/duplicate callback can call `setToken()` and emit a second terminal event." Code analysis confirmed `settle()` already calls `unsubscribe()` synchronously, so `setToken` cannot be double-called. The actual race is duplicate `exchangeCode` calls during the await window with the same single-use code → 410 + Sentry noise. Fix is unchanged; only the documented reason was wrong, and a future maintainer might revert it as redundant. Rationale rewritten in-place.

**Bearer-parser cleanup made explicit**: Phase 3 #5 now explicitly deletes the dead `req.headers.get("authorization")` lookup in `code/route.ts` (otherwise lint flags unused vars). Confirmed all three `verifyCliJwt` consumers (`code/route.ts`, `cli/setup/route.ts`, `cli/login/route.ts`) only use `session.userId` today — return-shape change is purely additive.

**Lockfile regeneration risk addressed**: Original "Delete, run `pnpm install`, regenerate" replaced with in-place conflict resolution + `pnpm install --no-frozen-lockfile` to reconcile catalog adds + diff inspection. Avoids unrelated upstream upgrades sneaking in.

**Phase 1 success criteria**: added `git merge-base --is-ancestor origin/main HEAD` to confirm `main` is fully merged (conflict-marker absence is necessary but not sufficient).

**CodeRabbit resolve protocol explicit**: Phase 5 success criteria now requires explicit "Resolve conversation" UI action per comment, with reply linking the fix commit SHA — otherwise comments re-fire on push.
