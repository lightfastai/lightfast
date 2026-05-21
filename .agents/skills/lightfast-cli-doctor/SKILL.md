---
name: lightfast-cli-doctor
description: |
  Bring a developer's CLI toolchain to a known-good state for Lightfast work.
  Probes nine host-level binaries (portless, inngest-cli, vercel, gh,
  ngrok, clerk, sentry, pscale, coderabbit) plus a docker daemon liveness
  check; installs what's missing, kicks off browser sign-in or token-paste
  flows, links each CLI to the right org, and only halts when human input is
  required. Triggers on "set up CLIs", "onboard me", "log in to vercel / gh /
  clerk / sentry / pscale / coderabbit / ngrok / inngest", "fix my
  dev environment", "doctor". Same flow services first-time setup, re-auth
  after token expiry, and upgrade-to-latest.
---

# Lightfast CLI Doctor

A pure-playbook skill that an agent reads + executes to bring a developer's
CLI toolchain to a known-good state for Lightfast work. Default mode is
*fix-all*: probe everything in parallel, install what's missing, kick off
the required login flows, halt only when a human is genuinely needed (paste
a token, confirm a browser sign-in tab), then re-probe and print the final
status table.

Same skill handles cold-start, re-auth after token expiry, and upgrades. There
is no separate "init" mode.

## What this skill does

Nine host-level CLIs plus a Docker daemon liveness preflight. Every `pnpm dev*`
script depends on Portless's CA cert at `~/.portless/ca.pem`; `pnpm dev:setup`
silently fails when the Docker daemon is down; the rest are authed CLIs needed
for deploys, issue triage, observability, schema migrations, and PR reviews.

| CLI | Used for | Auth shape |
|---|---|---|
| _preflight_: docker daemon | `pnpm dev:setup` provisions Postgres + Redis containers via `scripts/dev-services.mjs:51-65`; without the daemon the setup silently 404s | daemon liveness only |
| `portless` | HTTPS aggregate at `https://*.lightfast.localhost:443` for the local microfrontends mesh; CA cert at `~/.portless/ca.pem` is the load-bearing artifact | no auth (cert only) |
| `inngest-cli` | `pnpm dev:inngest` runs the local Inngest dev server (events, steps, workflows) | no auth (env-var production credentials) |
| `gh` | PR review, issue triage, release ops, gh-cli-driven workflows | browser sign-in |
| `vercel` | Deploys (`apps/{app,platform,www}` linked projects), `vercel env pull` to produce `.vercel/.env.development.local` | browser sign-in |
| `ngrok` | `pnpm dev:ngrok` (port 3024) for local tunnel work | **token paste** (the only one) |
| `clerk` | Bundled skill ops, `clerk doctor`, app linking; global install is what `lightfast-clerk` and human ops use | browser sign-in |
| `sentry` | Issue triage, source map upload context. v0.32+ agent CLI (not legacy `@sentry/cli`) | browser sign-in |
| `pscale` | Per-worktree PlanetScale branches per the 2026-05-08 migration plan (`thoughts/shared/plans/2026-05-08-db-app-rework-planetscale-mysql.md`) | browser sign-in |
| `coderabbit` | PR review automation; org `lightfastai` (configured at `.coderabbit.yaml`) | GitHub browser sign-in via coderabbit's own flow |

## Boundary table

Other doctors / skills own adjacent surfaces. This one does not duplicate them.

| Surface | Covered by | Probes |
|---|---|---|
| Docker daemon liveness | `lightfast-cli-doctor` (preflight) | `docker info` |
| Host-level CLI auth (9 binaries) | `lightfast-cli-doctor` | per-CLI playbooks |
| Postgres + Redis containers + migrations | `pnpm dev:doctor` / `pnpm dev:setup` | `scripts/dev-services.mjs:67-82` |
| Clerk test-user provisioning + JWT mint | `lightfast-clerk` skill | `references/sign-in-playbook.md` |
| Portless cert wiring into Electron renderer | `scripts/with-desktop-env.mjs:74-93` | `~/.portless/ca.pem` existence |
| Workspace bootstrap (`vercel env pull`, `clerk env pull` per app) | (v2 — not yet) | — |

## Decision tree

```
What do you need?
├── Fix everything (default)                    -> run the Dispatcher loop below
├── Fix one CLI                                 -> read references/<cli>.md, run its Probe → Fix → Verify
├── Status only (no install / no auth flows)    -> Dispatcher loop, steps 1–3, then exit
├── Upgrade only (skip auth)                    -> Dispatcher loop, skip step 5, run step 7
└── Re-auth only (CLI is installed but expired) -> read references/<cli>.md, run its Login section
```

Per-CLI references (Phase 2 writes these — each file is self-contained, an
agent reads it standalone):

| CLI | Reference |
|---|---|
| `portless` | `references/portless.md` |
| `inngest-cli` | `references/inngest-cli.md` |
| `gh` | `references/gh.md` |
| `vercel` | `references/vercel.md` |
| `ngrok` | `references/ngrok.md` |
| `clerk` | `references/clerk.md` |
| `sentry` | `references/sentry.md` |
| `pscale` | `references/pscale.md` |
| `coderabbit` | `references/coderabbit.md` |

## Dispatcher loop

The seven steps of fix-all. Steps are sequential; **step 2 is internally
parallel**. Do not reorder.

1. **Preflight: Docker daemon liveness.** Run `docker info >/dev/null 2>&1`.
   If non-zero, **halt immediately** with the "start Docker Desktop" message
   from *Halting rules*. Do NOT proceed to step 2 — the rest of the doctor is
   meaningless if `pnpm dev:setup` can't run downstream.
2. **Parallel probe.** For each of the nine CLIs, run its *Probe* commands
   from the matching reference file in parallel. Collect per CLI:
   `{ installed: bool, version: str, authed: bool, identity: str|null, org_correct: bool }`.
   `portless` and `inngest-cli` are exceptions — `portless`
   additionally reports `{ cert_present: bool }`; both have no `authed` /
   `identity` / `org_correct` dimensions.
3. **Render status table.** One row per CLI plus the preflight row. ✓ / ✗
   per dimension. If everything is green and the caller did not request
   `upgrade`, print the table and exit.
4. **Fix in this fixed order.** Do not parallelize fixes — each login flow
   may need human input, and serializing keeps the prompts unambiguous:
   ```
   portless                 → every dev URL depends on the CA at ~/.portless/ca.pem
   inngest-cli              → no auth; install-only, local dev server for events/steps
   gh                       → simplest browser sign-in, also a coderabbit cognitive dep
   vercel                   → browser sign-in
   ngrok                    → token paste (only CLI of its shape)
   clerk                    → browser sign-in
   sentry                   → browser sign-in (v0.32+ agent CLI)
   pscale                   → may require install on most machines
   coderabbit               → last; uses its own GitHub browser sign-in flow
   ```
5. **Per-CLI fix loop.** For each CLI not green:
   - **If not installed** → run install command from its reference file. Re-probe `installed`.
   - **If not authed** → run `<cli> auth login` (or the documented equivalent).
     Browser opens automatically when the CLI runs in an interactive shell;
     in a non-TTY agent harness, instruct the user to run `! <cli> auth login`
     so output streams into the session. Re-probe `authed`.
   - **If org/project context wrong** → run the reference file's recorded switch
     command. Re-probe `org_correct`.
   - **(portless only)** If `~/.portless/ca.pem` is missing or empty → run
     `portless trust`. Re-probe.
6. **Re-probe everything** (full step 2 again) and reprint the table. If any
   CLI is still red after one full fix pass, **halt** and surface the failing
   probe output — the user investigates. Do not enter a retry loop.
7. **Offer upgrades.** If any CLI's recorded version is below the minimum
   recorded in its reference file (or the caller passed `upgrade`), prompt:
   "Upgrade {list}? (y/N)". On `y`, run each reference's *Upgrade* command in
   sequence. Re-probe `version`. Otherwise exit.

### Why this order

- `portless` first because *every* dev URL (`https://*.lightfast.localhost`)
  depends on its CA cert; if portless is broken, debugging anything else is
  noise.
- `inngest-cli` next because it has no auth dimension — handle the
  install-only CLI before the human-input ones so the easy work is out of the
  way.
- `gh` before `coderabbit` because coderabbit's UX is GitHub-based — devs
  cognitively associate "the GitHub login" with `gh`, even though
  coderabbit's flow doesn't actually depend on `gh`'s token.
- `pscale` second-to-last because it's the only CLI likely to require a
  fresh `brew install` rather than just re-auth.
- `coderabbit` last to keep its noisy ANSI output (see *Probe primitives*) at
  the end where it's easy to scan.

## Probe primitives

Five lines per entry. The agent reads these to know which references to load
without opening every file. Exact commands and "green" thresholds live in
the matching reference file.

**Docker daemon (preflight)**
```
docker info >/dev/null 2>&1                    # exit 0 = green
# If non-zero, do NOT continue — halt per Halting rules.
```

**`portless`** — standalone CLI, global install. Loadbearing artifact is the CA cert at `~/.portless/ca.pem`.
```
command -v portless
portless --version                             # ≥ 0.12.0
test -f ~/.portless/ca.pem && test -s ~/.portless/ca.pem   # cert present + non-empty
# Fix when cert is red: `portless trust` (creates ~/.portless/ca.pem and adds it to OS trust store).
# No auth dimension.
```

**`inngest-cli`** — local Inngest dev server. Two binaries; probe both.
```
command -v inngest
command -v inngest-cli                         # both must exit 0 (single npm pkg, dual bin)
inngest --version                              # `inngest version 1.19.2-<commit>` — parse first two dotted; ≥ 1.19.2
# No auth dimension.
```

**`gh`**
```
command -v gh
gh --version
gh auth status                                 # contains "Logged in to github.com"
                                               # required scopes: admin:org, gist, repo, workflow
```

**`vercel`**
```
command -v vercel
vercel --version                               # ≥ 51.7.0
vercel whoami                                  # exit 0 with non-empty stdout
vercel teams ls                                # row with id `lightfast` marked ✔ (active team)
```

**`ngrok`**
```
command -v ngrok
ngrok --version
ngrok config check                             # exit 0
# Token-paste flow only — no browser.
```

**`clerk`**
```
command -v clerk                               # the GLOBAL install, not npx-resolved
clerk --version                                # ≥ 1.2.0
clerk whoami                                   # prints an email
```

**`sentry`** (v0.32+ agent CLI, not legacy `@sentry/cli`)
```
command -v sentry
sentry --version                               # ≥ 0.32.0
sentry --json whoami                           # parse JSON: { email: ... }
sentry org list                                # row with slug `lightfast` present
```

**`pscale`**
```
command -v pscale                              # red on most dev hosts as of 2026-05-14
pscale --version
pscale auth check                              # exit 0
pscale org list                                # row with `lightfast` org slug (slug exact case TBD until first auth)
```

**`coderabbit`**
```
command -v coderabbit
coderabbit --version
coderabbit auth status 2>&1 | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'   # strip ANSI before parsing
                                               # green: exit 0 AND contains org name (lightfastai)
```

## Halting rules

When the agent stops and asks. These are mechanical — if a rule fires, halt;
do not judge.

1. **Docker daemon down (preflight).** `docker info` non-zero. Halt **before**
   the parallel probe. Message: "Docker Desktop is not running. Start Docker
   Desktop (from Applications or `open -a Docker`), wait for the daemon to
   come up, then re-run `/lightfast-cli-doctor`."
2. **Browser sign-in callback in flight.** A `<cli> auth login` is running.
   Print: "Complete the browser sign-in flow. I'll resume once the
   callback lands." Do not poll — wait for the CLI process to exit, then re-probe.
   **Per-CLI non-TTY mode differs — consult `references/<cli>.md` before assuming `! <cli> auth login` works.** Verified 2026-05-14: `pscale auth login` errors `requires an interactive shell` under Claude Code's `!` prefix and must be run in a separate terminal. `coderabbit auth login --agent`, `sentry auth login --token`, `gh auth login --with-token` / `GH_TOKEN`, and `vercel login --token` / `VERCEL_TOKEN` are the agent-friendly alternatives; `clerk auth login` has no token flag at v1.2.0.
3. **Token paste needed (ngrok only).** Print:
   "Open https://dashboard.ngrok.com/get-started/your-authtoken, copy the
   token, and paste it here." Wait for input, then run
   `ngrok config add-authtoken <token>` and re-probe.
4. **Portless cert not initialized.** `~/.portless/ca.pem` is missing or empty.
   Run `portless trust` per `references/portless.md`. If `portless trust` errors
   with "already trusted" but the file still doesn't exist, run `portless clean`
   first. If init still fails, halt and surface the error.
5. **Version older than recorded minimum.** Surface as part of step 7. Not a
   step-5 blocker — only the user-prompted upgrade flow needs to know.
6. **Ambiguous org / project membership.** A `<cli> org list` (or `teams ls`)
   returns more than one entry and none match the recorded lightfast slug.
   Halt: "I can see {N} orgs in <cli> but none are 'lightfast' (expected
   slug from references/<cli>.md). Pick one or update the playbook."
7. **Probe still red after one full fix pass** (dispatcher step 6). Halt and
   print the failing probe output verbatim. Do not retry.

## What this skill does NOT do

- **No workspace bootstrap.** `vercel env pull` per app, `clerk env pull` per app,
  per-app linking via `vercel link` — these are deferred to v2. Doctor only
  verifies the *host* CLI is authed against the right org.
- **No legacy `@sentry/cli` (npm).** `apps/desktop/scripts/upload-sourcemaps.mjs:32-37`
  calls `pnpm exec sentry-cli` and the binary is missing from the workspace —
  that's a real gap, but it's a build/CI concern, not a developer-auth concern.
  Tracked separately.
- **No prelim tools** (`agent-browser`, `upstash` env). They have no auth or
  are managed by other skills / vendor env. Docker is the one exception
  because `pnpm dev:setup` is silent when it's down.
- **No npx-managed tools** (`knip`, `sherif`, `ultracite`, `changeset` via
  `pnpm dlx`). They resolve per-invocation; no host-level surface to repair.
  (`inngest-cli` was previously in this list but is now a first-class doctor
  entry with a global install — see `references/inngest-cli.md`.)
- **No CI-only release tooling** (`codesign`, `security` keychain, `electron-forge publish`,
  `changeset publish`). Run only in GitHub Actions with vault-supplied secrets.
- **No Node / pnpm runtime version probing.** Root `package.json` pins
  `engines.node >= 22` and `packageManager: pnpm@10.32.1`; pnpm's own errors
  cover the wrong-runtime case.
- **No "what changed since last run" diff.** Doctor is stateless: probe, fix,
  re-probe. No cache.
- **Not gated to localhost / dev-only.** Unlike `lightfast-clerk`, these CLIs
  operate against real production accounts (vercel, sentry, planetscale prod).
  Read-only by default; the only write actions are explicit installs and
  `auth login` flows the user has to complete in a browser.
- **No auto-upgrade on every invocation.** Upgrade is opt-in via the step-7
  prompt, or surfaced when the probed version is below the recorded minimum.
- **macOS-first only.** Each reference file records the Linux equivalent
  install command but the dispatcher assumes `brew` is available.

## See also

- `lightfast-clerk` — once `clerk whoami` works at the host level, this skill
  takes over for test-user provisioning, JWT mint, and browser sign-in.
- `lightfast-inngest` — workflow run inspection. Complements this doctor:
  the doctor verifies `inngest-cli` is installed; `lightfast-inngest` uses
  it (and the deployed app's Inngest endpoint) for run debugging.
- `lightfast-electron` — desktop app startup (works around the
  electron-forge-on-non-TTY hang). Requires Portless to be cert-initialized.
- `lightfast-debug` — broad debugging entrypoint; load when the failing
  surface is unclear.
- `pnpm dev:doctor` — Postgres + Redis container health check
  (`scripts/dev-services.mjs:67-82`). Complementary, not duplicated here.
- `thoughts/shared/plans/2026-05-08-db-app-rework-planetscale-mysql.md` —
  why `pscale` is mandatory.
- `thoughts/shared/research/2026-05-10-db-app-planetscale-local-dev-decision.md`
  — per-worktree branch shape + ~15–40 ms/query latency tax.
