# Microfrontends Proxy / Turbo 2.9 Cleanup

## Overview

`pnpm dev:app` fails immediately because Turbo 2.9.6's built-in microfrontends integration and our package-level `proxy` script both try to drive the `@vercel/microfrontends` CLI, passing conflicting flags. Fix is to delete our hand-rolled proxy scripts, let Turbo own the proxy task, and add a `lightfast-www` fallback so `dev:app` (app-only) can route www paths to the remote deployment.

## Current State Analysis

Running `pnpm dev:app` crashes with:

```
Error: Both --names and --local-apps are set. --names is deprecated and has been
replaced with --local-apps, which functions exactly the same. Please only set --local-apps.
```

The failing command turbo actually executes:

```
microfrontends proxy --port 3024 --local-apps lightfast-app lightfast-www \
  /Users/.../apps/app/microfrontends.json --names lightfast-app
```

Two independent sources are supplying flags:

1. **`apps/app/package.json:13`** — our script:
   ```
   microfrontends proxy --port 3024 --local-apps lightfast-app lightfast-www
   ```
2. **Turbo 2.9.6's built-in microfrontends integration** — auto-injects `@lightfast/app#proxy` into the `with` graph of `@lightfast/app#dev` (verified: `turbo run dev -F @lightfast/app --dry-run=json` lists `'@lightfast/app#proxy'` in the dev task's `with` array, even though our `apps/app/turbo.json:23-29` only declares three siblings). Turbo appends `<config-path> --names <default-app>` to invoke the CLI.

The `@vercel/microfrontends` 2.3.2 CLI (see `dist/bin/cli.cjs:3086-3107`) accepts either `--local-apps` OR the now-deprecated `--names`, never both. Combining them throws.

### Why `--local-apps` was added

Commit `ef8bdc9c8` — *fix(app): CORS + middleware + proxy routing for desktop bearer flow*:

> The 3024 microfrontends proxy was cold-starting into fallback mode and serving dev traffic from `lightfast-app.vercel.app` (prod Clerk keys locked to lightfast.ai). Added `--local-apps lightfast-app lightfast-www` to the proxy script…

At the time, this was the fix. Turbo 2.9 later added its own proxy integration, which now fights with that script.

### What Turbo 2.9 does (documented + empirically confirmed)

Per turborepo.com/docs/guides/microfrontends, source inspection of the 2.9.6 binary, and the spike (below):

- Three internal modes exist: `built-in proxy`, `@vercel/microfrontends proxy`, `custom proxy script` (last one removed in upstream PR #10982, Oct 2025).
- Mode is chosen by presence of `@vercel/microfrontends` in the package that owns `microfrontends.json`. When installed (our case), Turbo calls the `@vercel/microfrontends` CLI itself — passing its own `--names <default-app>`.
- Turbo's proxy task is automatically added to `with` when the owning package's `dev` task runs. No `turbo.json` entry required.
- **The exact injected command (confirmed via `ps aux` in the spike, identical in dev:app and dev:full)**: `microfrontends proxy <abs-path>/apps/app/microfrontends.json --names lightfast-app`. No `--local-apps`.
- **Local classification is flag-driven; readiness is port-probed.** `--names lightfast-app` marks lightfast-app as Local at boot, regardless of whether 4107 is listening yet. A cold request to `/sign-in` while 4107 is not up returns **HTTP 500 with an explicit local-port error** ("Error proxying request to lightfast-app (local). Is the server running locally on port 4107?") — it does *not* silently fall through to `lightfast-app.vercel.app`. This is the key property that prevents the `ef8bdc9c8` cold-start regression from recurring.
- **Apps not named in `--names` are classified by port-probe at boot**, then adopted as Local if their configured `development.local` port is listening. That is why `lightfast-www` auto-registers as local during `dev:full` (4101 is up) but shows as Fallback during `dev:app` (4101 is not up).
- **The proxy re-probes dynamically.** Once 4107 binds, subsequent requests route to local — no proxy restart needed. Full boot-race evidence: 75 probes at ~100ms over 9s saw connect-refused → HTTP 500 → HTTP 200 (local), never a `dpl_` marker or a redirect to prod.
- No documented opt-out flag exists (`TURBO_TASK_HAS_MFE_PROXY` is a middleware signal, not a disable switch).

### Key Discoveries

- `apps/app/package.json:13-14` — `proxy` and `proxy:wait` scripts, the source of the `--local-apps` side of the collision.
- `package.json:23` — `dev:desktop-stack` references `proxy:wait`; user confirms it's unused and can be deleted with it.
- `apps/app/microfrontends.json:13-18` — `lightfast-www` has `"local": 4101` but **no `fallback`**. When `pnpm dev:app` runs without a live www dev task, routed paths (`/docs`, `/blog`, `/pricing`, etc.) have nowhere to go.
- `apps/app/microfrontends.json:7-11` — `lightfast-app` already has `"fallback": "lightfast-app.vercel.app"`; we'll mirror that pattern for www.
- `apps/app/turbo.json:23-29` — dev task's `with` stays untouched; Turbo adds the proxy sibling itself.
- `apps/app/next.config.ts:5` and `apps/app/src/proxy.ts:86` still import `@vercel/microfrontends` (`withMicrofrontends`, `runMicrofrontendsMiddleware`). The dependency stays; only the CLI script goes.
- `apps/www/package.json` uses `microfrontends port` in its `dev` script — another reason the dependency stays.

## Desired End State

- `pnpm dev:app` boots cleanly. Port 3024 serves lightfast-app from localhost:4107, routes www paths to `lightfast-www.vercel.app`.
- `pnpm dev:full` boots cleanly. Port 3024 serves lightfast-app from 4107 and lightfast-www from 4101 (both local).
- `pnpm dev:desktop` continues to work alongside either of the above.
- `apps/app/package.json` no longer has `proxy` or `proxy:wait` scripts.
- Root `package.json` no longer has the orphaned `dev:desktop-stack` script.

### Verification

- `turbo run dev -F @lightfast/app --dry-run=json` shows `@lightfast/app#proxy` resolves to Turbo's injected command (not our deleted script), with a single `--names` flag and no collision.
- `curl -I http://localhost:3024/api/health` returns 200 when `dev:app` is running.
- `curl -I http://localhost:3024/docs` resolves via the www fallback during `dev:app` (not 502/500).
- Desktop Clerk sign-in flow still works (the scenario that motivated `ef8bdc9c8`).

## What We're NOT Doing

- **Not removing `@vercel/microfrontends`** from `apps/app` or `apps/www`. Runtime code (`withMicrofrontends`, middleware, `microfrontends port`) still needs it.
- **Not switching to Turbo's fully-built-in proxy mode.** That only activates when `@vercel/microfrontends` isn't installed in the owning package; we can't satisfy that without larger refactors.
- **Not changing Turbo versions.** Staying on 2.9.6.
- **Not touching `apps/app/turbo.json`.** Turbo adds the proxy sibling automatically.
- **Not renaming or moving `microfrontends.json`.**

## Implementation Approach

Three coordinated edits + a dev-server verification. Small enough for a single phase.

---

## Phase 1: Remove conflicting scripts, add www fallback

### Changes Required

#### 1. `apps/app/microfrontends.json`

Add a `fallback` to `lightfast-www` so `dev:app`-only runs have somewhere to send www-owned paths.

```json
"lightfast-www": {
  "packageName": "@lightfast/www",
  "development": {
    "local": 4101,
    "fallback": "lightfast-www.vercel.app"
  },
  "routing": [ ... ]
}
```

#### 2. `apps/app/package.json`

Delete lines 13-14:

```json
"proxy": "microfrontends proxy --port 3024 --local-apps lightfast-app lightfast-www",
"proxy:wait": "until curl -sf -o /dev/null http://127.0.0.1:4107/api/health; do sleep 1; done && microfrontends proxy --port 3024 --local-apps lightfast-app lightfast-www",
```

#### 3. `package.json` (root)

Delete line 23:

```json
"dev:desktop-stack": "concurrently --names app,proxy --prefix-colors cyan,magenta 'pnpm dev:full' 'pnpm --filter @lightfast/app proxy:wait'",
```

### Success Criteria

#### Automated Verification

- [x] `turbo run dev -F @lightfast/app --dry-run=json` lists `@lightfast/app#proxy` with command `microfrontends proxy … --names lightfast-app` (Turbo-injected, no `--local-apps`), and no secondary `pnpm run proxy` shell-through. *(Dry-run shows `command: <NONEXISTENT>` — auto-injection is runtime, not graph-print; spike captured the actual command via `ps aux`.)*
- [x] `pnpm check` passes for all files this plan touched (ultracite on the 5 changed files: clean). *The 67 errors from repo-wide `pnpm check` are in pre-existing untracked `outputs/visa-financials/build-financial-forecasts.mjs` — unrelated to this plan.*
- [x] `pnpm typecheck` passes for app and www (3/3 turbo tasks successful).
- [x] No references to `proxy:wait` or `dev:desktop-stack` remain — cleaned up stale mentions in `apps/desktop/README.md` (switched to `pnpm dev:full`) and `.agents/skills/lightfast-clerk/SKILL.md`.

#### Manual Verification

- [x] `pnpm dev:app` boots — all five sibling tasks (`dev`, `dev:inngest`, `//#dev:ngrok`, `@db/app#dev:studio`, `@lightfast/app#proxy`) reach steady state without the `--names`/`--local-apps` error.
- [x] `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3024/api/health` returns `200`.
- [x] Browsing `http://localhost:3024/` renders lightfast-app from local 4107.
- [x] Browsing `http://localhost:3024/docs` resolves via `lightfast-www.vercel.app` (no 5xx).
- [x] `pnpm dev:full` boots with both `lightfast-app` (4107) and `lightfast-www` (4101) served locally via 3024.
- [x] Desktop Clerk sign-in flow (`pnpm dev:full` + `pnpm dev:desktop`): sign-in completes, JWT bridge returns to Electron, no fallback-to-prod regression.

---

## Testing Strategy

### Manual Testing Steps

1. `pkill -f "next dev"; pkill -f "microfrontends"; pkill -f "inngest-cli"` — clear any leftover processes.
2. `pnpm dev:app > /tmp/console-dev.log 2>&1 &` — start and tail the log; confirm no proxy crash, all five tasks running.
3. `curl -sS -o /dev/null -w '%{http_code} %{url_effective}\n' -L http://localhost:3024/` — expect 200 from app.
4. `curl -sS -o /dev/null -w '%{http_code} %{url_effective}\n' -L http://localhost:3024/docs` — expect 200 via `lightfast-www.vercel.app` (redirect chain visible).
5. `pkill -f "next dev"` — tear down.
6. `pnpm dev:full > /tmp/full-dev.log 2>&1 &` — confirm both apps local.
7. `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:4101/` — expect 200 (www local).
8. `pnpm dev:desktop` in a second terminal — complete the Clerk sign-in flow end-to-end.

### Edge Cases

- **App dev boots before proxy**: Turbo manages ordering via `with`; proxy start lag is tolerable since the CLI is long-lived and retries upstream requests.
- **www fallback when offline**: remote fallback fails gracefully with upstream 5xx if lightfast-www.vercel.app is down — acceptable for a dev-only path.
- **Stale `.turbo/preferences/tui.json`** referencing `@lightfast/app#proxy` — harmless; Turbo rewrites it on next run.
- **Definitive local-vs-fallback check for `/docs`**: compare response bytes from `curl -s http://localhost:3024/docs` against `curl -s http://localhost:4101/docs`. Identical = local (PASS). Different AND the 3024 body contains a `dpl_<hash>` Vercel deployment marker = fallback. This was the evidence used in the spike.

## Migration Notes

- No data migration. No user-facing change.
- Anyone relying on `pnpm --filter @lightfast/app proxy` directly will break — user confirms no one does.

## References

- Failing run log: `/tmp/console-dev.log` (from investigation)
- Commit that introduced `--local-apps`: `ef8bdc9c8` — `fix(app): CORS + middleware + proxy routing for desktop bearer flow`
- Turbo 2.9 microfrontends docs: https://turborepo.com/docs/guides/microfrontends
- Turbo PR #10982 (built-in proxy, removed "custom proxy script" mode): https://github.com/vercel/turborepo/pull/10982
- @vercel/microfrontends CLI arg-check: `node_modules/.pnpm/@vercel+microfrontends@2.3.2*/node_modules/@vercel/microfrontends/dist/bin/cli.cjs:3086-3107`
- Turbo 2.9.6 binary strings confirming three proxy modes: `MicroFrontendProxyProvider::command - using Turborepo built-in proxy | using @vercel/microfrontends proxy | using custom proxy script`

## Improvement Log

### 2026-04-24 — Adversarial review + spike

**Findings raised before editing:**
1. *Critical*: the claim that `--names lightfast-app` alone preserves `dev:full` www routing was unverified. The original commit `ef8bdc9c8` added `--local-apps lightfast-app lightfast-www` specifically because the proxy was cold-starting into fallback mode — risk that removing our script silently regresses `dev:full` so `/docs` serves from prod fallback even though www is running locally on 4101.
2. *Critical*: Turbo's auto-injected command was inferred from docs + binary strings, not observed.
3. *Critical*: `lightfast-www.vercel.app/docs` serving docs via direct hostname (vs. through lightfast.ai) was assumed, not tested.

**Spike (isolation: worktree) — VERDICT: CONFIRMED.**

Applied all three plan edits in an isolated worktree, ran `turbo run dev --dry-run=json` for both `dev:app` and `dev:full`, then booted each flow live and compared `/docs` response bodies.

- Turbo-injected command (captured via `ps aux`, **identical for dev:app and dev:full**): `microfrontends proxy <abs-path>/apps/app/microfrontends.json --names lightfast-app`. No collision.
- `dev:app`: `/docs` → 198,717 B body with `dpl_FfQgTcmfDAndGmdZ9aMMvboDew9H` marker → fallback to `lightfast-www.vercel.app` works.
- `dev:full`: proxy banner logged **both** local apps (`lightfast-app:4107`, `lightfast-www:4101`). `/docs` → 215,223 B, byte-identical to `curl http://localhost:4101/docs`, no `dpl_` marker → **local www serving confirmed.**

**Key finding — why the plan works despite only `--names lightfast-app`:** the `@vercel/microfrontends` proxy's local-app discovery is **port-probe-based**, not flag-based. It reads `microfrontends.json`, probes each configured `development.local` port at boot, and adopts responding ports as local. The old `--local-apps lightfast-app lightfast-www` was redundant defensive padding; the new `fallback` entry on `lightfast-www.development` is what actually completes the flow.

**Plan changes applied post-spike:**
- Amended "What Turbo 2.9 does" with the empirically captured command string and the port-probing mechanism (explains *why* `--names lightfast-app` alone is sufficient).
- Added a definitive local-vs-fallback check for `/docs` to the Edge Cases section (body byte-compare + `dpl_` marker).

**Not amended:** no scope change or phase restructuring required. The three-file edit is safe to apply as-is.

**Unexpected (noted, not blocking):**
- During long `dev:app` runs the microfrontends 2.3.2 CLI threw `ERR_HTTP_HEADERS_SENT` after an upstream `ETIMEDOUT` — TLS read on a `*.vercel.app` fallback host (almost certainly a www-routed path timing out). Pre-existing CLI bug, unrelated to this plan, does not affect boot or routing outcome for lightfast-app.
- `@db/app#dev:studio` failed cleanly in dev:app (`ELIFECYCLE`) — pre-existing, unrelated.
- Dry-run JSON reports `"command": "<NONEXISTENT>"` for `@lightfast/app#proxy` — auto-injection happens at runtime, not at graph-print time. `microfrontends.json` appears in `globalCacheInputs.files` instead, proving the binding. Treat dry-run as necessary-but-not-sufficient; `ps aux` is the ground truth.

### 2026-04-24 — Follow-up spike: cold-start sign-in routing

User raised a valid gap: the initial spike tested `/docs` routing but not the exact scenario commit `ef8bdc9c8` was fixing — a cold-start window where the proxy decides `lightfast-app` is unreachable and routes `/sign-in` to `lightfast-app.vercel.app` (prod Clerk, locked to lightfast.ai).

**VERDICT: CONFIRMED — regression does not recur.** Three tests in the same worktree:

1. **Proxy alone, no Next.js**: banner showed `Local Applications: lightfast-app (port 4107)` even with 4107 cold. Cold `curl /sign-in` → HTTP 500 with `Error proxying request to lightfast-app (local). Is the server running locally on port 4107?`. **No `dpl_` marker, no `lightfast-app.vercel.app` content, no silent prod fallthrough.**
2. **Proxy first, app second**: after 4107 bound, `/sign-in` returned HTTP 200 with local turbopack content (185,052 B, no `dpl_` marker). Proxy re-probed dynamically — no restart required.
3. **Normal `dev:app` boot race (75 probes at ~100ms)**: connect-refused → HTTP 500 → HTTP 200 (local). Zero requests across the 9s boot window ever returned prod content.

**Corrected mechanism understanding** (spike 1 described this as "port-probe-based" — incomplete): classification is **flag-driven** (`--names lightfast-app` locks it to Local regardless of port state); **readiness is port-probed** (cold port → 500 with explicit local error, never silent fallback); apps *not* in `--names` are classified by initial port probe (that's how `lightfast-www` auto-adopts in dev:full, falls back in dev:app).

**Why the `--local-apps lightfast-app lightfast-www` flag in `ef8bdc9c8` is now unnecessary**: its load-bearing job was classifying `lightfast-app` as Local so cold requests hit 500 instead of prod. Turbo's injected `--names lightfast-app` does exactly that. The `lightfast-www` half of the flag was covered by the new `fallback` entry in `microfrontends.json`.

**Residual risk**: an automated health probe hitting `/sign-in` during the ~800ms boot window will see HTTP 500 (not a redirect to prod). Desktop Clerk flow tolerates this — the user re-tries after boot and hits local 4107. Nothing in this repo treats a 500 from `/sign-in` as "fall back to prod."

**Ship verdict**: plan is safe as-is. No further mitigation needed.
