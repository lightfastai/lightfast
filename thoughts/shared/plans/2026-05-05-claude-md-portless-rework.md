# CLAUDE.md Portless + Dev-Scripts Rework Plan

## Overview

Update the root `CLAUDE.md` so it accurately describes the new local-dev model: a Portless HTTPS aggregate (default `https://lightfast.localhost`, **worktree-prefixed** in secondary git worktrees) sitting in front of the Vercel Microfrontends mesh for `app` + `www`, while `apps/platform` continues to run on a raw port. Document the three new wrapper scripts in `scripts/` (`dev-services.mjs`, `with-dev-services-env.mjs`, `with-desktop-env.mjs`) that inject service URLs and env vars into dev commands. Preserve the existing section structure of CLAUDE.md.

## Current State Analysis

### Portless / Microfrontends wiring (already in repo)

- `lightfast.dev.json` (repo root) declares the Portless aggregate: `name: "lightfast"`, `port: 443`, `https: true`, and points at `microfrontends.json`.
- `microfrontends.json` (repo root, moved up from `apps/app/microfrontends.json` in commit `50245edc3`) lists two MFE apps:
  - `lightfast-app` (package `@lightfast/app`) — default app, no routing block ⇒ catch-all owner.
  - `lightfast-www` (package `@lightfast/www`) — owns `marketing` group: `/`, `/pricing`, `/changelog/*`, `/blog/*`, `/use-cases/*`, `/legal/*`, `/integrations/*`, `/careers`, `/company/*`, `/docs`, `/docs/:path*`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/api/health`, `/api/search`, `/images/*`, `/fonts/*`, favicons, manifest, OG images.
  - Both apps fall back to `https://lightfast.ai` when not run locally.
- Per-app Portless hostnames are declared in `package.json`:
  - `apps/app/package.json:7` → `"portless": "app.lightfast"` ⇒ `https://app.lightfast.localhost`.
  - `apps/www/package.json:7` → `"portless": "www.lightfast"` ⇒ `https://www.lightfast.localhost`.
  - `apps/platform/package.json` has **no `portless` field** and `apps/platform` is **not listed in `microfrontends.json`** — it stays on raw `http://localhost:4112`.
- Next config wrappers:
  - `apps/app/next.config.ts:157` and `apps/www/next.config.ts:103` → `withPortlessProxy(withMicrofrontends(config, ...))` — populates `allowedDevOrigins` for HMR; `app` also passes `{ serverActions: isLocalDev }` so `experimental.serverActions.allowedOrigins` accepts the `*.lightfast.localhost` family.
  - `apps/platform/next.config.ts:26` → wrapped with `withPortlessProxy` but no MFE wrap (still gets allowedDevOrigins, but is not part of the aggregate).
- Sibling URL resolution: `apps/app/src/lib/related-projects.ts` calls `resolveProjectUrl("lightfast-www")` from `@lightfastai/dev-proxy/projects` for local dev (returns the Portless URL) and falls back to `withProject(...)` (Vercel `VERCEL_RELATED_PROJECTS`) for previews/prod. `platformUrl` is resolved via `resolveStandalone` with a hardcoded `http://localhost:4112` dev fallback.
- Raw backend ports (unchanged): `app` 4107, `www` 4101, `platform` 4112.

### New dev scripts in `scripts/`

- `scripts/dev-services.mjs` — multi-subcommand CLI consumed by root `package.json` scripts:
  - `setup` → provisions local Postgres + Redis Docker containers using `@lightfastai/dev-services` (`runDevServicesSetup`).
  - `doctor` → health-check pass over local services (e.g. `--postgres-table lightfast_gateway_installations`).
  - `inngest-sync --mfe-app <name>|--app-url <name=url> -- <cmd>` → wraps a child command, resolves MFE app URLs through `resolvePortlessApplicationUrl` and registers them with the local Inngest dev server's app-sync (`startInngestDevSync`). Used by `dev`, `dev:app`, `dev:platform`, `dev:full`.
  - `postgres url|up|create` → emits `DATABASE_URL` / starts the dev Postgres container / creates the dev DB.
  - `redis url|up|ping` → emits Upstash-compatible REST URL / starts dev Redis (Redis + HTTP container) / pings it.
- `scripts/with-dev-services-env.mjs` — env-injecting `exec`:
  - Resolves dev Postgres + Redis configs and injects `DATABASE_HOST/PORT/USERNAME/PASSWORD/NAME`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `LIGHTFAST_DEV_REDIS_KEY_PREFIX`, `LIGHTFAST_DEV_SERVICES_ACTIVE=1` before exec'ing the command.
  - Bypassed when `LIGHTFAST_DEV_SERVICES=0|false|off` (uses ambient env unchanged).
  - Wired into every app's `with-env`: `apps/app/package.json:17`, `apps/platform/package.json:13`, `apps/www/package.json:17` (all chain `dotenv -e ./.vercel/.env.development.local -- node ../../scripts/with-dev-services-env.mjs --`).
- `scripts/with-desktop-env.mjs` — used by `apps/desktop/package.json:9`:
  - Resolves the Portless aggregate URL via `resolvePortlessMfeUrl` from `@lightfastai/dev-proxy` and injects `LIGHTFAST_APP_ORIGIN=https://lightfast.localhost` so the Electron renderer points at the local aggregate.
  - Honors a pre-set `LIGHTFAST_APP_ORIGIN` if the operator wants to override.

### What CLAUDE.md currently says (and is now wrong / stale)

- "Full stack: app + www + platform (port 3024 via microfrontends)" — port 3024 is the legacy raw-MFE-aggregate port. The new aggregate is `https://lightfast.localhost` (port 443). 3024 only survives as the default arg to `scripts/ngrok` and is not the dev entrypoint.
- "ngrok and inngest automatically runs with `pnpm dev:app`" — no longer true. `pnpm dev:app` now runs `dev-services.mjs inngest-sync` (registers app URLs with whatever Inngest dev server you're running) and the Portless proxy via `lightfast-dev proxy`. Ngrok is opt-in via `pnpm dev:ngrok`. Inngest dev server is opt-in via `pnpm dev:inngest` / `pnpm dev:services`.
- The Microfrontends section says "via `apps/app/microfrontends.json`" — file moved to repo root.
- No mention of: `lightfast.dev.json`, Portless, `withPortlessProxy`, the wrapper scripts, `dev:setup` / `dev:doctor` / `db:up` / `redis:up`, the env-injection chain, or the desktop app-origin injection.

## Desired End State

`CLAUDE.md` reflects reality:

1. Architecture diagram shows the Portless aggregate sitting in front of `app` + `www` (with a clearly marked "platform is not on Portless" gap).
2. The "Vercel Microfrontends" section explains both halves: production (Vercel MFE on `lightfast.ai`) and local dev (Portless aggregate at `https://lightfast.localhost` consuming the same `microfrontends.json`).
3. The "Platform Service" section explicitly notes platform is not yet wired into Portless / MFE and is reached via raw `http://localhost:4112`.
4. The "Development Commands" section lists what each top-level script actually does today (incl. the dev-services wrapping) and removes the stale port 3024 / "ngrok auto-runs" lines.
5. A new sub-section under "Environment" (or a sibling section) documents the three `scripts/` wrappers, what env vars each one injects, and how to disable them.
6. Section ordering and heading style match the current file — only the content of relevant sections changes.

### Verification

- A reader new to the repo can run `pnpm dev:full`, open `https://lightfast.localhost`, and understand from CLAUDE.md alone why that URL works.
- A reader can find the answer to "where do my `DATABASE_URL` / `UPSTASH_REDIS_REST_URL` come from in dev?" in CLAUDE.md.
- `grep -n "3024\|apps/app/microfrontends.json\|ngrok and inngest automatically" CLAUDE.md` returns no lines.
- `grep -n "lightfast.dev.json\|withPortlessProxy\|with-dev-services-env\|with-desktop-env\|lightfast.localhost" CLAUDE.md` returns hits in the relevant sections.

### Key Discoveries

- Portless is configured at the repo root (`lightfast.dev.json`) — there is no per-app Portless config; per-app naming lives in `package.json` `"portless"` fields (`apps/app/package.json:7`, `apps/www/package.json:7`).
- `microfrontends.json` is now at the repo root, not under `apps/app/` (commit `50245edc3 Track root microfrontends config`, `4d6b68aca Remove platform from microfrontends config`).
- The aggregate URL is fully derived: `port: 443 + https: true + name: "lightfast"` → `https://lightfast.localhost` (443 elided by browsers).
- **Hosts are worktree-aware.** `resolvePortlessHost` in `@lightfastai/dev-proxy` (`node_modules/@lightfastai/dev-proxy/dist/index.js:537`) calls `defaultDetectWorktreePrefix` from `@lightfastai/dev-core` (`node_modules/@lightfastai/dev-core/dist/worktree.js:19`) and prepends the prefix to every Portless host:
  - Detection requires (a) `git worktree list --porcelain` reporting **>1** worktree **and** (b) the cwd's `--git-dir` ≠ `--git-common-dir` (i.e. cwd is inside a secondary worktree). A plain `git checkout feature/x` in the main checkout does *not* trigger prefixing.
  - `branchToPrefix` returns `undefined` for `main` / `master` / `HEAD`. Otherwise it takes the **last `/`-segment** of the branch (`feature/team/login-fix` → `login-fix`), lowercases, and replaces `[^a-z0-9-]+` with `-` (`sanitizeWorktreePrefix`).
  - The prefix prepends to *both* the aggregate name and per-app names, so a worktree on branch `desktop-portless-runtime-batch` yields `https://desktop-portless-runtime-batch.lightfast.localhost` (aggregate), `https://desktop-portless-runtime-batch.app.lightfast.localhost`, `https://desktop-portless-runtime-batch.www.lightfast.localhost`.
  - `getPortlessProxyOrigins` (used by `withPortlessProxy`) calls the same resolver, so HMR `allowedDevOrigins` and Server Actions `allowedOrigins` cover the prefixed hosts automatically. `resolvePortlessApplicationUrl` (used by `dev-services.mjs inngest-sync` and `apps/app/src/lib/related-projects.ts`) and `resolvePortlessMfeUrl` (used by `scripts/with-desktop-env.mjs`) all flow through the same `resolvePortlessHost`. Net effect: cross-app rewrites, Inngest app-sync, and the desktop renderer's `LIGHTFAST_APP_ORIGIN` are all worktree-correct **without any manual env override**.
- `withPortlessProxy` is what makes Next's HMR + Server Actions accept the `*.lightfast.localhost` (and `*.<prefix>.lightfast.localhost`) HTTPS origins; `apps/app` passes `serverActions: isLocalDev` because it owns the auth + tRPC routes that Server Actions use.
- The Inngest sync helper resolves MFE app URLs via Portless (`resolvePortlessApplicationUrl`), so even though `dev:app` doesn't start the Inngest dev server, it tells the Inngest dev server (when present) to register the (worktree-correct) `https://[<prefix>.]app.lightfast.localhost/api/inngest`.
- `LIGHTFAST_DEV_SERVICES=0` is the documented escape hatch for `with-dev-services-env.mjs` (passes through ambient env) — useful when devs want to point at staging/cloud services from a local app.
- Operators can print the live aggregate URL for the current cwd via `node scripts/with-desktop-env.mjs --print` (emits `LIGHTFAST_APP_ORIGIN=...`). Useful for "what URL should I open right now?" without parsing the dev-server boot log.

## What We're NOT Doing

- Not changing `lightfast.dev.json`, `microfrontends.json`, any `next.config.ts`, any `package.json`, or any script.
- Not migrating `apps/platform` onto Portless or into the MFE mesh (out of scope; CLAUDE.md will simply state it's not yet wired).
- Not touching `SPEC.md`, `AGENTS.md`, or any other doc.
- Not updating `apps/<app>/CLAUDE.md` or any per-package docs.
- Not removing `dev:ngrok` / `scripts/ngrok` (they still exist; CLAUDE.md will just stop claiming ngrok auto-runs).

## Implementation Approach

Single-pass rewrite of the affected sections. No need to preserve unrelated wording — but headings, ordering, code-block style, and density should stay close to the existing file so reviewers can diff section-by-section. Verify the final file by re-reading the changed sections against the source files cited in "Current State Analysis".

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

## Phase 1: Rewrite CLAUDE.md

### Overview

Edit `CLAUDE.md` in place. Update: Architecture block, Vercel Microfrontends section, Platform Service section, Development Commands section, Environment section (add Local Dev Services subsection), Troubleshooting note. Leave Repository Overview, tRPC Auth Boundaries, and Key Rules untouched (still accurate).

### Changes Required

#### 1. Architecture block

**File**: `CLAUDE.md`
**Change**: Update the ASCII diagram so it shows the Portless aggregate above app+www and marks platform as off-aggregate. Replace the existing "ports 4107/4101/4112" labels with both the local-dev URL pattern (Portless, with explicit `[<worktree>.]` placeholder) and the raw backend port. Mention that `app` and `www` share a single browser entrypoint via Portless / MFE while `platform` does not. Add a one-line legend explaining the `[<worktree>.]` placeholder.

Concrete shape (illustrative; final wording during edit):

```
Local dev: https://[<worktree>.]lightfast.localhost  (Portless HTTPS aggregate, port 443)
   ├── app  → https://[<worktree>.]app.lightfast.localhost  (raw backend :4107, default MFE)
   └── www  → https://[<worktree>.]www.lightfast.localhost  (raw backend :4101, marketing+docs)

platform → http://localhost:4112  (raw backend; not yet on Portless / MFE)

[<worktree>.] is empty on main and on the primary checkout (any branch).
In a secondary git worktree on a non-main branch it becomes the sanitized
last segment of the branch name (e.g. branch desktop-portless-runtime-batch
→ https://desktop-portless-runtime-batch.lightfast.localhost). Print the
current value with `node scripts/with-desktop-env.mjs --print`.
```

#### 2. Vercel Microfrontends section

**File**: `CLAUDE.md`
**Change**: Rewrite the section so it covers both production and local dev:

- Production: Vercel Microfrontends serves `lightfast.ai` from two apps using root `microfrontends.json`. App is the default; www owns the `marketing` group (paths enumerated in `microfrontends.json`, summarize: marketing pages, `/docs/*`, `/blog/*`, `/changelog/*`, `/legal/*`, `/integrations/*`, sitemap/robots/manifest/OG, fonts/images).
- Local dev: Portless (config at repo root `lightfast.dev.json`, `name: "lightfast"`, `port: 443`, `https: true`) reads the same `microfrontends.json` and exposes a single HTTPS aggregate at `https://[<worktree>.]lightfast.localhost`, proxying to per-app raw ports. Per-app subdomains come from each app's `package.json` `"portless"` field (`app.lightfast`, `www.lightfast`).
- **Worktree-aware hosts.** `@lightfastai/dev-proxy` detects when the cwd is inside a *secondary* git worktree (multi-worktree repo, gitdir ≠ common-dir, branch ≠ `main`/`master`/`HEAD`). When all three hold, the sanitized last segment of the branch name is prepended to every Portless host: aggregate becomes `https://<prefix>.lightfast.localhost`, app MFE becomes `https://<prefix>.app.lightfast.localhost`, www becomes `https://<prefix>.www.lightfast.localhost`. The prefix is empty on the primary checkout (any branch) and on `main`/`master` even in a secondary worktree, so day-to-day work on the main checkout still hits the bare `https://lightfast.localhost`. This is what lets multiple worktrees run dev concurrently without colliding. The same resolver feeds Next's HMR + Server Actions allowedOrigins, the `inngest-sync` MFE-URL registration, the app's `wwwUrl`/`platformUrl` resolver, and the desktop renderer's `LIGHTFAST_APP_ORIGIN` — so cross-app rewrites and the Electron renderer stay coherent inside a worktree without manual env overrides. To see the current value at any time: `node scripts/with-desktop-env.mjs --print`.
- Wiring: `apps/app/next.config.ts` and `apps/www/next.config.ts` wrap with `withPortlessProxy(withMicrofrontends(config))` so HMR + Server Actions accept `*.lightfast.localhost` (and the prefixed `*.<prefix>.lightfast.localhost` family in worktrees). App passes `{ serverActions: isLocalDev }` because it owns the auth + tRPC + Server Actions surface.
- Auth routes (`/sign-in`, `/sign-up`, `/early-access`) and catch-all routes are still served by `app` (default MFE owner) — same behavior as before, just via the Portless aggregate locally.

Remove the line "via `apps/app/microfrontends.json`" (file is at repo root now).

#### 3. Platform Service section

**File**: `CLAUDE.md`
**Change**: Append a sentence (or short paragraph) immediately after the existing description:

> **Not yet on Portless.** `apps/platform` is intentionally absent from `microfrontends.json` and has no `"portless"` field in its `package.json`. It runs as a raw service on `http://localhost:4112` in dev. The app reaches it via Next rewrites (`/api/connect/*`, `/api/ingest/*`) using `platformUrl` from `apps/app/src/lib/related-projects.ts`, which falls back to `http://localhost:4112` locally and uses Vercel `VERCEL_RELATED_PROJECTS` in previews/prod.

#### 4. Development Commands section

**File**: `CLAUDE.md`
**Change**: Replace the dev-server block with the current command surface and remove stale comments. Concretely:

```bash
# Dev servers (NEVER use global pnpm build)
# URLs below show the main-checkout form. In a secondary git worktree on a
# non-main branch, every Portless host is prefixed with the sanitized last
# segment of the branch name (e.g. branch feat/team/login-fix →
# https://login-fix.lightfast.localhost). Run `node scripts/with-desktop-env.mjs --print`
# to see the current aggregate URL.
pnpm dev:full         # app + www + platform; opens https://lightfast.localhost (Portless aggregate)
pnpm dev              # app + www only (no platform); same aggregate URL
pnpm dev:app          # app only, behind Portless at https://app.lightfast.localhost (raw :4107)
pnpm dev:www          # www only, behind Portless at https://www.lightfast.localhost (raw :4101)
pnpm dev:platform     # platform only, raw http://localhost:4112 (not on Portless)
pnpm dev:desktop      # Electron app; LIGHTFAST_APP_ORIGIN auto-points at the (worktree-correct) Portless aggregate

# Optional dev services (run in separate terminals as needed)
pnpm dev:inngest      # local Inngest dev server (dev:app/dev:full sync MFE app URLs into it)
pnpm dev:services     # Inngest + Drizzle Studio together
pnpm dev:studio       # Drizzle Studio only (127.0.0.1:4983)
pnpm dev:ngrok        # ngrok tunnel; defaults to port 3024 (legacy)
pnpm dev:email        # email template dev (turbo dev:email -F @lightfast/www)

# Local containerized services (Docker)
pnpm dev:setup        # provision dev Postgres + Redis containers, then run pnpm db:migrate
pnpm dev:doctor       # health-check dev services
pnpm db:up            # start dev Postgres
pnpm db:create        # create the dev database (idempotent)
pnpm db:url           # print resolved DATABASE_URL
pnpm redis:up         # start dev Redis (with Upstash REST proxy container)
pnpm redis:ping       # ping the dev Redis REST endpoint
pnpm redis:url        # print resolved Upstash REST URL

# Run dev server in background (for Claude Code sessions)
pnpm dev:app > /tmp/console-dev.log 2>&1 &
tail -f /tmp/console-dev.log
pkill -f "next dev"

# Environment variables (MUST run from apps/<app>/ directory)
cd apps/app && pnpm with-env <command>
# `with-env` chains: dotenv -e .vercel/.env.development.local
#   then scripts/with-dev-services-env.mjs (injects local Postgres + Redis env vars)

# Build & Quality
pnpm build:app
pnpm build:platform
pnpm check && pnpm typecheck

# Database (run from db/app/)
pnpm db:generate      # NEVER write manual .sql files
pnpm db:migrate
pnpm db:studio
```

Remove the line "Note: ngrok and inngest automatically runs with `pnpm dev:app`. You can test ngrok connection with `ps aux | grep ngrok | grep -v grep`" — replace with a one-liner: "Note: `pnpm dev:app` and `pnpm dev:full` register MFE app URLs with the local Inngest dev server (when running) via `scripts/dev-services.mjs inngest-sync`. They do not start Inngest or ngrok automatically — run `pnpm dev:inngest` / `pnpm dev:ngrok` when you need them."

#### 5. New "Local Dev Services" subsection under Environment

**File**: `CLAUDE.md`
**Change**: Add a short subsection between the existing "Environment" bullet list and "Troubleshooting". Goal: tell the reader these scripts exist and when they fire, **not** how they're implemented. One line per script, plus the only knob a human actually flips (`LIGHTFAST_DEV_SERVICES=0`).

> ### Local Dev Services
>
> Three repo-root scripts wrap dev commands so app env + Portless URLs Just Work. You usually don't invoke them directly — they're chained from `with-env` and `dev:*`. Read the source for the full env-var list.
>
> | Script | What it does | Fires from |
> |---|---|---|
> | `scripts/dev-services.mjs` | Manages local Postgres + Redis containers; registers MFE app URLs with the Inngest dev server. | `pnpm dev`, `dev:app`, `dev:platform`, `dev:full`, `dev:setup`, `dev:doctor`, `db:*`, `redis:*` |
> | `scripts/with-dev-services-env.mjs` | Injects `DATABASE_*` / Upstash Redis env vars from those local containers. | every app's `pnpm with-env` (`apps/app`, `apps/www`, `apps/platform`) |
> | `scripts/with-desktop-env.mjs` | Injects `LIGHTFAST_APP_ORIGIN` pointing at the (worktree-correct) Portless aggregate. | `apps/desktop`'s `dev` script. `--print` echoes the resolved URL. |
>
> Escape hatch: `LIGHTFAST_DEV_SERVICES=0` makes `with-dev-services-env.mjs` pass through your `.vercel/.env.development.local` unchanged — use it when you want to point a local app at staging Postgres/Upstash.

#### 6. Troubleshooting block

**File**: `CLAUDE.md`
**Change**: Add two lines to the existing `Troubleshooting` code block (don't restructure):

```bash
pkill -f "next dev"                    # Port in use
pnpm clean:workspaces && pnpm install  # Module not found
pnpm --filter @api/app build           # tRPC type errors (api layer stays @api/app)
pnpm dev:doctor                        # local Postgres / Redis container health check
docker ps | grep lightfast             # confirm dev-services containers are up
```

(Optionally also: "If `https://lightfast.localhost` won't resolve, confirm Portless is running — check the `lightfast-dev proxy` process started by `pnpm dev:*`.")

### Success Criteria

#### Automated Verification

- [ ] File still parses as valid Markdown: `npx --yes markdownlint-cli2 CLAUDE.md` (informational only — Lightfast does not gate on markdownlint, but should not produce structural errors).
- [x] Stale strings removed: `! grep -nE "3024 via microfrontends|apps/app/microfrontends.json|ngrok and inngest automatically" CLAUDE.md`.
- [x] New strings present: `grep -n "lightfast.dev.json" CLAUDE.md && grep -n "withPortlessProxy" CLAUDE.md && grep -n "with-dev-services-env" CLAUDE.md && grep -n "with-desktop-env" CLAUDE.md && grep -n "lightfast.localhost" CLAUDE.md && grep -nE "worktree|<prefix>|<worktree>" CLAUDE.md`.
- [x] Existing top-level headings still present (no accidental restructure): `grep -nE "^## (Repository Overview|Architecture|Development Commands|Key Rules|Environment|Troubleshooting)$" CLAUDE.md` returns one match per heading.

#### Human Review

- [ ] Read the rewritten "Vercel Microfrontends" section against `microfrontends.json` and `lightfast.dev.json` → both halves (prod + local) match the files.
- [ ] Worktree note is technically correct against `node_modules/@lightfastai/dev-core/dist/worktree.js` (multi-worktree gate, gitdir≠common-dir, branch ≠ main/master/HEAD, last-segment + sanitize). Sanity-check by running `node scripts/with-desktop-env.mjs --print` from this worktree (current branch `desktop-portless-runtime-batch`) and confirming the prefix matches the documented rule.
- [ ] Read the "Platform Service" section → "not on Portless" caveat is unambiguous and points to the right rewrite mechanism (`platformUrl`).
- [ ] Read "Development Commands" against `package.json` `scripts` → every documented command exists; the listed behaviors match what the script actually shells into.
- [ ] Read "Local Dev Services" against the three script files in `scripts/` → injected env-var list and toggle (`LIGHTFAST_DEV_SERVICES=0`) match `with-dev-services-env.mjs`.
- [ ] Diff feels surgical: unchanged sections (Repository Overview, tRPC Auth Boundaries, Key Rules) are byte-identical or near-identical.

---

## Testing Strategy

Doc-only change. No unit/integration tests. Verification is the human review against the source files cited above.

## Performance Considerations

N/A.

## Migration Notes

N/A. Authors of older sessions / handoffs may have cached the old "port 3024" line — once this lands, point them at the updated section.

## References

- Portless config: `lightfast.dev.json`
- MFE config: `microfrontends.json`
- Per-app Portless names: `apps/app/package.json:7`, `apps/www/package.json:7`
- Next config wrappers: `apps/app/next.config.ts:157`, `apps/www/next.config.ts:103`, `apps/platform/next.config.ts:26`
- Sibling URL resolver: `apps/app/src/lib/related-projects.ts:52` (www), `apps/app/src/lib/related-projects.ts:53` (platform)
- Dev scripts: `scripts/dev-services.mjs`, `scripts/with-dev-services-env.mjs`, `scripts/with-desktop-env.mjs`
- Wired into apps: `apps/app/package.json:17`, `apps/www/package.json:17`, `apps/platform/package.json:13`, `apps/desktop/package.json:9`
- Root scripts: `package.json:17-30,46-53`
- Recent commits: `50245edc3` (root microfrontends.json), `4d6b68aca` (remove platform from MFE), `1d14f390d` (wire dev services), `d7eacf1f9` (integrate app/www portless mfe dev)
- Worktree-aware host derivation: `node_modules/@lightfastai/dev-core/dist/worktree.js:19` (`defaultDetectWorktreePrefix`), `:26` (`branchToPrefix`), `:34` (`sanitizeWorktreePrefix`); `node_modules/@lightfastai/dev-proxy/dist/index.js:537` (`resolvePortlessHost`).
