# Claude Code web sandbox — full dev stack setup

**Date:** 2026-06-03
**Status:** Draft for review
**Surface:** Claude Code on the web (claude.ai/code) cloud sandboxes only. *Not* `@claude` GitHub Actions, *not* local CLI changes.

## Problem

We want Claude Code web sandbox sessions to be able to run the **full Lightfast dev stack** (`pnpm dev`) — app, mcp, www, platform, the MFE aggregate, local Inngest, local QStash, and the github/linear/x emulators — against the real managed services (PlanetScale, Upstash, Clerk, etc.).

A web sandbox is a headless Anthropic-managed Linux VM that clones the repo, runs an optional **setup script**, then hands Claude a working tree. It does **not** use `.devcontainer`; network mode and secrets are configured in the web UI per environment. Today the repo is built entirely for local human dev, so a fresh sandbox cannot stand the stack up:

- `pnpm dev` is **100% Portless-orchestrated** (`portless proxy start && turbo run dev:next …`); every service resolves URLs via `portless get …` and runs under `portless run …`. Inngest/QStash/emulator scripts call `portless get`/`portless run` directly.
- Each app boots with `with-env = dotenv -e ./.vercel/.env.development.local`. Those env files (~40 keys for `app` alone, including the **rotating** `VERCEL_OIDC_TOKEN`) are gitignored and produced by `vercel env pull`. A fresh sandbox has none of them.
- Vercel linkage (`.vercel/repo.json`, `apps/*/.vercel/project.json`) is gitignored, so the sandbox starts with no link to the Vercel projects.
- `.mcp.json` stdio servers shell out to local scripts: `start-exa.sh`/`start-lightfast.sh` `exit 1` without `.env.mcp`; `start-postgres.sh` needs the pulled app env; `inngest` points at `127.0.0.1:8288`.

A cloud environment already exists for this repo (local pointer `env_017JcTSzELtWsWzRmXzAKqCH` in `.claude/settings.local.json`). This work makes that environment **reproducible and robust**, with the repo carrying the versioned setup and the web UI carrying only secrets + network mode.

## Goals

- A fresh web sandbox can run the full `pnpm dev` stack after the setup script completes.
- Env is hydrated automatically from Vercel using a **single** `VERCEL_TOKEN` secret — no pasting ~40 vars, resilient to `VERCEL_OIDC_TOKEN` rotation.
- MCP servers either work or degrade quietly in the sandbox (no `exit 1` noise).
- The exact web-UI configuration (setup-script path, network mode, the small set of secrets) is documented in-repo.

## Non-goals

- `@claude` GitHub Actions / `.github/workflows/claude.yml` (explicitly out of scope this round).
- Changes to local-CLI dev behavior. The local `pnpm dev` flow must keep working unchanged.
- Making the human-browser `https://lightfast.localhost` aggregate the primary interface in a headless VM (see Portless risk).
- Committing any secret to git.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Cloud surface | Web sandboxes only |
| Capability | Full dev stack (`pnpm dev`) against real managed services |
| Env hydration | `vercel env pull` driven by one `VERCEL_TOKEN` secret |
| Network mode | **Trusted** (default) — broad egress incl. package registries |
| Vercel linkage | Re-link at setup via `vercel link --repo --yes --token=$VERCEL_TOKEN`; **nothing new committed** |

## Architecture — split of responsibilities

| Lives in the repo (versioned) | Lives in the web UI (set once per environment) |
|---|---|
| `scripts/cloud/setup.sh` — the setup script | **Setup script** field → `bash scripts/cloud/setup.sh` |
| `scripts/cloud/dev.sh` — sandbox-tuned stack start | **Network**: Trusted |
| Cloud-safety tweaks to `.mcp/*.sh` | **Secrets**: `VERCEL_TOKEN`, `EXA_API_KEY`, `LIGHTFAST_API_KEY` |
| CLAUDE.md "Cloud sandbox" section + this spec | (all other env flows from `vercel env pull`) |

## Components

### 1. `scripts/cloud/setup.sh` (runs once at environment creation)

Idempotent, `set -x` for debuggability, non-critical steps guarded with `|| true`, target < ~5 min.

1. `corepack enable && corepack prepare pnpm@11.1.3 --activate` (match the pinned packageManager).
2. `pnpm install --frozen-lockfile`.
3. `vercel link --repo --yes --token="$VERCEL_TOKEN"` — regenerates `.vercel/repo.json` + per-app `.vercel/project.json` from the git remote (org `team_oOLHPMLVuBjXyFafgsGKEZxl`, projects `lightfast-{app,www,platform}`).
4. For each of `apps/app`, `apps/www`, `apps/platform`:
   `vercel env pull .vercel/.env.development.local --environment=development --token="$VERCEL_TOKEN"` → hydrates `~/.../.vercel/.env.development.local`.
5. If `EXA_API_KEY` / `LIGHTFAST_API_KEY` are present in the environment, write `.env.mcp` so those stdio MCP servers can start. Skip silently otherwise.
6. Optional warmups guarded by `|| true` (e.g. prime turbo / next typegen) — only if they stay within the time budget.

**Failure policy:** steps 1–4 are critical (fail the setup loudly if they error, so a broken environment is obvious); steps 5–6 are best-effort.

### 2. `scripts/cloud/dev.sh` (sandbox-tuned stack start)

A thin wrapper that runs the same orchestration as root `pnpm dev` but with sandbox-appropriate Portless settings (see §Portless validation). Default behavior delegates to `pnpm dev`; environment knobs let milestone 1 swap the Portless bind strategy without rewriting the root script. The root `package.json` `dev` script is **not** modified.

### 3. MCP cloud-safety (`.mcp/*.sh`)

Make the three local-script servers degrade quietly in a sandbox while preserving the loud local behavior for humans:

- `start-exa.sh` / `start-lightfast.sh`: when the required key is absent, **skip gracefully** (exit 0 / no-op) instead of `exit 1`, so Claude simply doesn't get that tool rather than seeing a failed server. Keep the local "missing key" guidance when running interactively. Gating signal: a `LIGHTFAST_CLOUD=1` marker exported by `setup.sh`/`dev.sh` (we do not assume an Anthropic-provided env var). When `LIGHTFAST_CLOUD=1` and the key is missing → exit 0; otherwise preserve the loud local `exit 1`.
- `start-postgres.sh`: unchanged — it works once `apps/app/.vercel/.env.development.local` is hydrated (step 4).
- `inngest` (`http://127.0.0.1:8288/mcp`): works once the stack is up.
- `next-devtools`: works via npx, unchanged.

### 4. Docs

- New **"Cloud sandbox (Claude Code on the web)"** section in `CLAUDE.md`: the web-UI checklist (setup-script path, Trusted network, the three secrets) + how to start/validate the stack in a session.
- This spec, committed.

## Data flow

```
Environment creation:
  web UI secrets (VERCEL_TOKEN, EXA_API_KEY, LIGHTFAST_API_KEY)
    → setup.sh → vercel link + env pull
      → apps/{app,www,platform}/.vercel/.env.development.local  (hydrated)
      → .env.mcp                                                (if keys present)

Session start:
  dev.sh → portless proxy start → turbo dev:next + inngest + qstash + emulators
    → each next dev reads its .vercel/.env.development.local via dotenv
    → services reach managed backends over Trusted egress
```

## The Portless risk and validation (milestone 1)

Portless `0.12.0` is pure Node, supports `linux`, and is tagged *"for humans and agents"* — promising, but binding `:443` and resolving `*.lightfast.localhost` inside a headless sandbox is **unverified**. This is the single highest-risk assumption and is validated **first**, in a real web sandbox session:

1. Run `setup.sh`, then `portless proxy start`; confirm it binds.
2. Run the full stack; confirm services come up and are reachable (curl / agent-browser) at the resolved URLs.

**Fallbacks if `:443`/`.localhost` won't bind headless**, in order of preference:
1. Configure Portless to a non-privileged port if it supports one.
2. Grant the bind capability in `setup.sh` (`setcap 'cap_net_bind_service=+ep'` on the node binary, or run the proxy via a privileged step).
3. Fall back to per-service direct ports without the aggregate proxy, accepting that the human-browser `lightfast.localhost` aggregate is unavailable while individual services remain reachable.

Honest expectation: the stack **runs and is programmatically reachable**; the browser aggregate is secondary in a headless VM.

## Error handling

- Setup `vercel` steps fail loudly (a half-provisioned env should be obvious, not silently degraded).
- MCP servers fail **soft** in cloud (skip, don't `exit 1`).
- `|| true` only on genuinely optional warmups.
- No secret ever written to a tracked file; `.env.mcp` and `.vercel/*` stay gitignored.

## Testing / validation

- **Local regression:** `pnpm dev` still starts unchanged; `start-*.sh` keep their loud local behavior when keys are missing. `pnpm check && pnpm typecheck` clean.
- **Cloud milestone 1:** a real web sandbox session runs `setup.sh` then the stack; record whether Portless binds and which fallback (if any) was needed.
- **Cloud milestone 2:** confirm a representative end-to-end path works (e.g. an app route that touches DB + Clerk) using the pulled env.

## Web-UI configuration checklist (for the operator)

For environment `env_017JcTSzELtWsWzRmXzAKqCH` (or a new one):

1. **Setup script** → `bash scripts/cloud/setup.sh`
2. **Network** → Trusted
3. **Secrets**:
   - `VERCEL_TOKEN` — a Vercel token scoped to org `team_oOLHPMLVuBjXyFafgsGKEZxl` (linchpin; hydrates all app env)
   - `EXA_API_KEY` — enables the `exa` MCP server
   - `LIGHTFAST_API_KEY` — enables the `lightfast` MCP server

## Open items (resolve during planning/implementation)

- Exact cloud-detection signal for MCP soft-fail (proposed: `LIGHTFAST_CLOUD=1` exported by `setup.sh`/`dev.sh`).
- Whether `apps/mcp` needs its own pulled env (it's in the dev filter but is not one of the three Vercel projects) — confirm in milestone 1.
- Whether any managed service (PlanetScale/Upstash/Clerk) needs the sandbox's egress IP allowlisted on the provider side under Trusted mode.
- Final Portless bind strategy, decided by milestone-1 evidence.
