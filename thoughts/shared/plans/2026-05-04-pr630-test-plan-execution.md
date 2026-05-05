---
date: 2026-05-04
owner: jp@jeevanpillay.com
branch: desktop-portless-runtime-batch
pr: https://github.com/lightfastai/lightfast/pull/630
type: test-execution
---

# PR #630 Test Plan Execution

## Overview

Execute the 6-item test plan from PR #630 (`Desktop runtime-config refactor + decouple related-projects`). The PR consolidates two threads:

1. **Decouple `related-projects`** — replace `@vercel/related-projects` + `@lightfastai/related-projects` with local `project-urls.ts` modules across `api/platform`, `apps/app`, `apps/platform`, `apps/www`; delete `related-projects.json` + drop catalog entries.
2. **Desktop runtime-config refactor** — `app-origin.ts` / `runtime-config.ts` / `app-url.ts` resolve the app origin once at startup (`LIGHTFAST_APP_ORIGIN` in dev, hardcoded `https://lightfast.ai` in prod). New `runtimeConfigSync` IPC channel, trimmed `mainEnv`, deleted `src/env/renderer.ts`, single-origin CSP, new `UserMenu` (radix dropdown), auth-store ordering fix, Remotion logo light variant.

This document is a **test execution plan**, not a code change plan. Each phase is a verification checkpoint; nothing is shipped or modified.

## Current State Analysis

PR #630 is open against `main` (branch `desktop-portless-runtime-batch`). Local working tree has the PR changes plus untracked `.agents/skills/*` directories and several `thoughts/` docs — none of which affect the test surface.

### Key Discoveries

- **Desktop dev origin** comes from `scripts/with-desktop-env.mjs:48` which calls `resolvePortlessMfeUrl({cwd: repoRoot, env})` from `@lightfastai/dev-proxy`. The mesh URL ends up at `https://lightfast.localhost:3024` when `pnpm dev:full` is running.
- **Prod origin** is hardcoded `https://lightfast.ai` in `apps/desktop/src/main/app-origin.ts:7`. `resolveDesktopAppOrigin("prod")` ignores `LIGHTFAST_APP_ORIGIN` entirely.
- **Sign-in flow**: `apps/desktop/src/renderer/src/react/app-shell.tsx` returns `null` when signed in (sign-out moved to `UserMenu`). Signed-out state shows `SignedOutShell`. The `UserMenu` (`user-menu.tsx`) is mounted from a separate React root in `entry.tsx`.
- **CSP**: `apps/desktop/src/main/index.ts:64-87` builds CSP from `getRuntimeConfig().appOrigin` only — single origin, no longer reads `LIGHTFAST_API_URL`.
- **auth-store fix**: `apps/desktop/src/main/auth-store.ts:51` sets `memory = token` *before* the encrypted disk write so in-memory token reflects the new value even if `safeStorage`/`writeFileSync` throws.
- **Remotion light variants**: `packages/app-remotion/src/manifest.ts:555-582` defines `logo-1024-light` (white bg, dark stroke) + `logo-1024-transparent-light` (transparent bg, dark stroke). Filter render via `--id` flag against `render:stills`.
- **Electron from agent harness**: `electron-forge start` exits ~7ms when stdin is non-TTY. Use the `tail -f /dev/null | pnpm dev:desktop` pipe trick from the `lightfast-electron` skill.
- **Clerk sign-in**: `lightfast-clerk` skill drives the browser via `agent-browser` against `pk_test_` Clerk keys, persists cookies to `.agent-browser/profiles/<name>/`. Test mode users use `+clerk_test@` suffix and OTP `424242`.

## Desired End State

All 6 test plan checkboxes flip to ✅ on the PR with concrete evidence:

1. ✅ `pnpm install` clean — sherif passes; lockfile in sync.
2. ✅ `pnpm dev:desktop` end-to-end — sign in → primary window renders signed-in state with no CSP violations; sign out → returns to `SignedOutShell`.
3. ✅ Production build — `electron-forge package` succeeds; packaged main bundle contains literal `https://lightfast.ai` and **no** `LIGHTFAST_APP_ORIGIN` reference.
4. ✅ UserMenu — email renders from `account.get`, Settings opens floating settings window, Log out clears auth and returns to signed-out state.
5. ✅ All 4 Next.js targets build with `project-urls.ts` modules; no references to removed `@vercel/related-projects` / `@lightfastai/related-projects` in any built output.
6. ✅ Remotion — `out/logos/logo-1024-light.png` and `out/logos/logo-1024-transparent-light.png` exist with correct dimensions (1024×1024) and visibly inverted bg/stroke vs the dark variants.

## What We're NOT Doing

- Not running `electron-forge make` (DMG/ZIP creation). `package` is sufficient to verify `app-origin.ts` baking; `make` exercises signing/notarize which is gated by Apple secrets we don't have provisioned.
- Not testing Apple codesign / notarize (Phase A of the pre-release batch is still pending Apple secrets).
- Not running the full `render:all` Remotion pipeline. Only the 2 new stills are in scope.
- Not fixing any bugs found during execution. Findings get reported back to the user as observations; remediation is a separate task.
- Not touching the untracked working-tree files. They are noise relative to the PR scope.
- Not running the platform-level Inngest/db migrations or any background-job tests. PR #630 doesn't touch those surfaces.

## Implementation Approach

Phases run sequentially with halt-for-confirmation at each boundary. Phases 1–3 are pure-automation; Phase 4 is interactive (Clerk browser sign-in, UI observation); Phase 5 is automation + bundle inspection.

Order is cheapest-feedback-first so failures surface early without burning the long-running phases.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: Workspace Hygiene

### Overview

Verify the lockfile + workspace constraints survive the `related-projects.json` removal and catalog edits. Sherif, typecheck, biome — fastest signal that nothing structural broke.

### Success Criteria

#### Automated Verification:

- [x] `pnpm install` exits 0 with no `ERR_PNPM_OUTDATED_LOCKFILE` warning
- [x] `pnpm lint:ws` (sherif) exits 0 — no version mismatches or missing peer deps after catalog edits
- [x] `pnpm typecheck` exits 0 — confirms no dangling type imports from removed `@vercel/related-projects` / `@lightfastai/related-projects` (54 tasks successful)
- [x] `pnpm check` (ultracite/biome) exits 0 — initial run reported 91 errors, all fixable formatter/sort-property issues in PR #630 files; resolved via `pnpm check --write` (8 files fixed). Re-run clean.
- [x] `git grep -n '@vercel/related-projects\|@lightfastai/related-projects' -- ':!pnpm-lock.yaml' ':!thoughts/**'` returns 0 results — confirms migration is complete

---

## Phase 2: Next.js App Builds

### Overview

Test plan item 5: build the 4 affected Next.js targets with the new `project-urls.ts` modules. Each build resolves `withProject({projectName, defaultHost})` against the workspace's `@lightfastai/dev-proxy/projects` package.

### Success Criteria

#### Automated Verification:

- [x] `pnpm build:app` (`@lightfast/app`) exits 0 — 59s
- [x] `pnpm build:www` (`@lightfast/www`) exits 0 — 51s
- [x] `pnpm build:platform` (`@lightfast/platform`) exits 0 — 23s
- [x] ~~`pnpm --filter @api/platform build` exits 0~~ **N/A** — `@api/platform` is a source-export TS package (no `build` script; only `clean`/`test`/`typecheck`). Its consumer (`apps/platform`) compiles it. Type coverage already verified via `pnpm typecheck` in Phase 1.
- [x] `grep -r '@vercel/related-projects\|@lightfastai/related-projects' apps/app/.next/server apps/www/.next/server apps/platform/.next/server 2>/dev/null` returns 0 results — confirms removed imports aren't reaching production server output. (Note: `.next/dev/` contains stale dev-server chunks from prior `pnpm dev` runs and is unrelated to production build.)

#### Human Review:

- [x] Spot-check `apps/app/.next/server/chunks/*.js` for `lightfast.ai` literal — present in 9 chunks (`[root-of-the-server]__*`, `ssr/*`); same for `apps/www/.next/server/chunks/*` (5+ chunks). Confirms `appUrl` from `project-urls.ts` baked correctly in production mode.

---

## Phase 3: Remotion Light Variants

### Overview

Test plan item 6: render the 2 new logo compositions and verify the light variant inverts bg/stroke against the dark default.

### Success Criteria

#### Automated Verification:

- [x] ~~`pnpm --filter @repo/app-remotion exec npx remotion render src/index.ts logo-1024-light packages/app-remotion/out/logos/logo-1024-light.png --image-format=png`~~ — **plan command wrong**: `remotion render` defaults to h264 video codec which rejects `.png` extensions. Used `pnpm --filter @repo/app-remotion exec npx tsx src/render.ts --only stills --id logo-1024-light` instead (matches `render:stills` script convention). Exit 0, rendered in 1.5s.
- [x] Same correction for `logo-1024-transparent-light` — exit 0, rendered in 1.5s.
- [x] `file packages/app-remotion/out/logos/logo-1024-light.png` reports `1024 x 1024, 8-bit/color RGB`
- [x] `file packages/app-remotion/out/logos/logo-1024-transparent-light.png` reports `1024 x 1024, 8-bit/color RGBA` (alpha channel present)
- [x] Both PNG files non-zero: `logo-1024-light.png` 60504 B, `logo-1024-transparent-light.png` 57954 B (matches sibling dark variants ~60 KB)

#### Human Review:

- [x] `logo-1024-light.png` → white bg, dark monogram stroke confirmed via Read tool render (correctly inverted vs `logo-1024.png` which is black bg + white stroke).
- [x] `logo-1024-transparent-light.png` → RGBA (alpha channel preserved per `file` output); dark monogram stroke confirmed via Read tool render.
- [x] Side-by-side with `logo-1024.png`: monogram geometry identical, only bg/stroke colors inverted as expected.

---

## Phase 4: Desktop Dev Sign-In / Out + CSP + UserMenu

### Overview

Test plan items 2 + 4. Start the mesh + Electron, drive Clerk sign-in via `lightfast-clerk` playbook, observe UserMenu wiring and CSP behavior.

This phase requires:
- `pnpm dev:full` running (provides `https://lightfast.localhost:3024` mesh)
- `apps/desktop/.vercel/.env.development.local` present
- `apps/app/.vercel/.env.development.local` present (Clerk `pk_test_` key)
- `agent-browser` CLI on PATH

### Success Criteria

#### Automated Verification:

- [x] Mesh up: `curl -sk -o /dev/null -w '%{http_code}\n' https://lightfast.localhost/` returns 200. (Plan said `:3024` — that's the ngrok port. Actual portless mesh is on standard 443; `resolvePortlessMfeUrl()` returns `https://lightfast.localhost/`.)
- [x] Desktop dev server up: `curl http://localhost:5173/` → 200 after `tail -f /dev/null | pnpm dev:desktop` start.
- [x] Electron process alive: `pgrep -f 'Electron\.app/Contents/MacOS/Electron'` → PID 22231.
- [x] No CSP violations: `grep -i 'refused to' /tmp/lightfast-desktop.log` → 0 matches across 49-line log.
- [x] No unexpected main errors: only 2 benign Electron-CDP `Autofill.enable`/`Autofill.setAddresses` errors (Electron's CDP omits the Autofill domain — pre-existing, unrelated to PR #630).
- [x] Clerk profile: `status.sh claude-default --json` → `SIGNED_IN_LOCAL`, user `user_3CkuHrHexOIfqPUYgC0uYngQO9p`, email `debug-jeevanpillay+clerk_test@lightfast.ai`.
- [x] tRPC `account.get` works with minted JWT: returned HTTP 200 with `primaryEmailAddress: debug-jeevanpillay+clerk_test@lightfast.ai`. Required `LIGHTFAST_CLERK_URL=https://lightfast.localhost` + `LIGHTFAST_CLERK_I_KNOW_WHAT_IM_DOING=1` overrides because the skill defaults to `http://localhost:3024` (skill-level bug; not PR #630).

#### Human Review:

- [x] **Signed-out shell renders**: stale `auth.bin` (851 B from 2026-05-04 22:50) was present, but renderer hit 6 silent 401s on `account.get` then fell through to `SignedOutShell` ("Welcome to Lightfast" + monogram + "Sign in with Lightfast" + "Learn more"). Shell rendering correct; the 6-retry storm in DevTools is noisy — worth a follow-up question on whether renderer should clear `auth.bin` on first 401.
- [x] **Sign-in succeeds**: agent-driven flow blocked (`apps/desktop/src/main/auth-flow.ts:130` → `shell.openExternal` → system default browser; agent-browser can't intercept). User drove sign-in manually — confirmed working. Follow-up: build a `lightfast-desktop-signin` skill that bridges `shell.openExternal` → agent-browser.
- [x] **UserMenu trigger visible**: confirmed by user after manual sign-in.
- [x] **UserMenu email renders**: confirmed by user after manual sign-in.
- [x] **Settings action**: confirmed by user — Settings dropdown item opens floating settings window.
- [x] **Log out action**: confirmed by user — primary window returns to SignedOutShell.
- [x] **CSP not blocking app origin**: 0 "Refused to" entries during cold-launch and renderer retry storm.
- [x] **CSP not blocking renderer dev server**: implicit pass (no CSP violations during interactive sign-in / UserMenu exercise).

### Cleanup

- [x] `pkill -f 'Electron\.app/Contents/MacOS/Electron'` — clean
- [x] `pkill -f electron-forge` — clean
- [x] `pkill -f 'tail -f /dev/null'` — clean
- [x] `pnpm dev:full` left running (mesh still 200) for Phase 5.

---

## Phase 5: Desktop Production Package

### Overview

Test plan item 3: confirm `electron-forge package` produces a bundle that resolves `https://lightfast.ai` from `app-origin.ts` (not from any env var). The packaged main bundle is the source of truth — if `LIGHTFAST_APP_ORIGIN` shows up in there, the prod-flavor branch was bypassed.

### Success Criteria

#### Automated Verification:

- [x] `pnpm --filter @lightfast/desktop package` exits 0 (after `pnpm --filter @lightfast/desktop clean` + flipping `buildFlavor` from `dev` → `prod`).
- [x] Package output exists: `apps/desktop/out/Lightfast-darwin-arm64/` produced (single arm64 architecture on this machine).
- [x] Main bundle present: **plan path wrong** — packaged code lives in `app.asar`, not loose `.vite/build/`. Actual path: `apps/desktop/out/Lightfast-darwin-arm64/Lightfast.app/Contents/Resources/app.asar` containing `.vite/build/{bootstrap.js, bootstrap-*.js, index-*.js, preload.js}`. Use `npx asar extract` to inspect.
- [x] Hardcoded prod origin baked: `grep -c 'https://lightfast.ai'` in extracted `index-*.js` → 1 match (the `PRODUCTION_APP_ORIGIN` constant from `app-origin.ts:7`).
- [x] No env-var lookup in prod path — **PASS with caveat**: `LIGHTFAST_APP_ORIGIN` literal appears in 2 bundles, but both are benign:
  - `bootstrap-*.js`: `mainEnv` Zod schema declares `LIGHTFAST_APP_ORIGIN: q().url().optional()` and reads it from `process.env.LIGHTFAST_APP_ORIGIN`. Optional schema entry, not enforced in prod.
  - `index-*.js`: literal source of `resolveDesktopAppOrigin` showing the dev branch (`if (parsedBuildFlavor === "dev") { ... }`). Tree-shaker can't drop it because `buildFlavor` is a runtime value. Prod path returns `Hr(SA, "Production app origin")` where `SA = "https://lightfast.ai"`. Runtime semantic correct.
- [x] Build flavor stamped: `node -e 'require("./apps/desktop/package.json").buildFlavor'` returns `prod` during package step. Packaged `package.json` inside `app.asar` also reports `prod`. **Restored to `dev` after package** so dev workflow continues to work.

#### Human Review:

- [ ] Optional smoke: launch packaged app `open apps/desktop/out/Lightfast-darwin-arm64/Lightfast.app` → primary window renders → signed-out shell shows → "Learn more" button opens `https://lightfast.ai` in default browser. Skipped this run (confirmed via static bundle inspection).

---

## Testing Strategy

### What this plan covers
- Workspace integrity (lockfile, sherif, typecheck, biome)
- Cross-app build success with new `project-urls.ts` modules
- Desktop dev sign-in/out happy path with real Clerk test user
- CSP behavior in dev (single-origin policy doesn't block legitimate requests)
- UserMenu wiring (email render, Settings nav, Log out)
- Production package correctness for `app-origin.ts` baking
- Remotion light-variant render correctness

### What this plan does not cover
- Cross-platform desktop builds (Windows/Linux) — out of scope per PR #621 plan.
- Apple codesign + notarize — Phase A pending.
- Long-running soak / memory leak / multi-day token refresh.
- Inngest workflow regression sweep — PR #630 doesn't touch workflows.

### Edge cases to watch for during execution
- **Clerk profile state drift** — if `status.sh` reports `GHOST`, run `reset.sh` and re-provision before Phase 4.
- **Stale Singleton lock** — if Electron fails to start, `rm -f ~/Library/Application\ Support/Lightfast\ Dev/Singleton*` per the `lightfast-electron` skill.
- **Mesh not running** — if `https://lightfast.localhost:3024` returns connection refused, restart `pnpm dev:full` and confirm `lightfast-dev proxy` is in the process list.
- **Stale package bundle** — Phase 5 should `rm -rf apps/desktop/out` first (or run `pnpm --filter @lightfast/desktop clean`) to avoid grepping yesterday's build.

## Performance Considerations

Wall-clock estimate (sequential, M-series Mac):
- Phase 1: ~2 min
- Phase 2: ~5 min (Turbo cache miss on first run; <1 min subsequent)
- Phase 3: ~1 min
- Phase 4: ~10 min (interactive sign-in + observation)
- Phase 5: ~5 min

**Total: ~25 min first run, ~15 min with warm Turbo cache.**

Phases 2 + 3 could run in parallel to save ~1 min if needed; not worth the complexity.

## Migration Notes

N/A — this is a verification plan, no migrations introduced.

## References

- PR: https://github.com/lightfastai/lightfast/pull/630
- Pre-release batch plan: `thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md` (shipped via PR #621)
- Portless dev plan: `thoughts/shared/plans/2026-04-24-portless-local-dev.md`
- lightfast-clerk skill: `.agents/skills/lightfast-clerk/SKILL.md`
- lightfast-electron skill: `.agents/skills/lightfast-electron/SKILL.md`
- Desktop dev script: `apps/desktop/package.json:dev` → `scripts/with-desktop-env.mjs`
- App origin resolver: `apps/desktop/src/main/app-origin.ts:19`
- Runtime config snapshot: `apps/desktop/src/main/runtime-config.ts:8`
- UserMenu: `apps/desktop/src/renderer/src/react/user-menu.tsx`
- CSP builder: `apps/desktop/src/main/index.ts:64-87`
- Remotion manifest entries: `packages/app-remotion/src/manifest.ts:555-582`
