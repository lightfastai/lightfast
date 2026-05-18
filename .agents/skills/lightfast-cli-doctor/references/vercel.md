# `vercel` — doctor playbook

## What Lightfast uses it for

- Deployments for `apps/{app,platform,www}` (each linked to its own Vercel project via `.vercel/project.json`).
- `vercel env pull` produces `apps/<app>/.vercel/.env.development.local` — the file every `pnpm dev:*` reads.
- `vercel link` ties an app dir to a project; already done for the three apps as of plan-write time.

## Probe (read-only)

- **Installed**: `command -v vercel` → green when exit 0.
- **Version**: `vercel --version` → green when ≥ `51.7.0` (verified on the known-good host as of 2026-05-14).
- **Authed**: `vercel whoami` → green when exit 0 with non-empty stdout (the user's Vercel username).
- **Team membership**: `vercel teams ls` → green when stdout lists a team with id `lightfast` (the row marked with ✔ is the currently-active team; should be `lightfast`).

## Install (only when "installed" probe fails)

- macOS: `npm i -g vercel` (preferred — keeps `vercel` on PATH globally) or `brew install vercel-cli`.
- Linux: `npm i -g vercel`.

After install, re-run the *installed* probe.

## Login (only when "authed" probe fails)

```
vercel login
```

Picks an email, then opens the browser for OAuth. `vercel login` already auto-detects agent harnesses and forces `--non-interactive` — verified via `vercel login --help` showing `"when an agent is detected this is the default"`.

**Non-TTY alternatives (verified 2026-05-14)**:

```
vercel login --token <token>          # pre-minted token; skip browser OAuth
VERCEL_TOKEN=<token> vercel <cmd>     # env var; per-command auth, no profile write
```

For headless automation, `VERCEL_TOKEN` is the best path. For developer onboarding, the bare `! vercel login` works.

After login, re-run the *authed* probe.

## Set team (only when team probe shows lightfast is not the active team)

```
vercel teams switch lightfast
```

(`vercel teams switch [name]` — `teams` is mandatory, `vercel switch` alone does not work.) After switch, re-run the team probe.

## Upgrade (only when version below recorded minimum, or user requests upgrade)

- macOS / Linux: `npm i -g vercel@latest`.
- Workspace-scoped ephemeral usage (`pnpm dlx vercel@latest …`) does not need a global upgrade.

Verified live 2026-05-14: 51.7.0 → 54.0.0 upgrade preserves auth + team selection (no re-login needed).

## Known gotchas

- **`vercel whoami` shows the personal account, not the active team.** Auth dimension can be green while the active team is wrong. Always probe `vercel teams ls` separately and check which row is marked ✔.
- **Three Lightfast-adjacent teams exist** for this user on 2026-05-14: `lightfast` (the one we want), `jps0000`, `i0v1`. The doctor's "team probe" must match the literal slug `lightfast`, not just "any team in the list."
- **`vercel link` is per-app (workspace), not host-global.** Doctor does NOT run `vercel link` — that's the deferred v2 workspace bootstrap.
- **`vercel env pull` failures are usually a team mismatch** masquerading as a permission error. Verify the active team is `lightfast` before debugging the env file.
