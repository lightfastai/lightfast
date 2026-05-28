# `inngest-cli` — doctor playbook

Third-party CLI from https://github.com/inngest/inngest (npm: `inngest-cli`).
Runs the Inngest dev server locally; production Inngest credentials are
environment-variable based and do not flow through this binary.

The npm package ships **two** binaries: `inngest` and `inngest-cli`. They
resolve to the same entry point. Lightfast scripts use `inngest-cli` (the
disambiguated name).

## What Lightfast uses it for

- `pnpm dev:inngest` runs `npx inngest-cli@latest dev` — the local Inngest event/step dev server.
- `pnpm dev:services` boots `dev:inngest` + `dev:studio` (drizzle) in parallel.
- `pnpm dev{,:app,:platform,:full}` register app URLs with the local Inngest dev server via `scripts/inngest-portless-sync.mjs` (does NOT start the dev server — it only registers endpoints with an already-running one).

## Probe (read-only)

- **Installed**: `command -v inngest` AND `command -v inngest-cli` both exit 0 → green. The npm package installs both names; probing only one risks missing a half-broken install.
- **Version**: `inngest --version` → green when ≥ `1.19.2` (verified on the known-good host as of 2026-05-14). Output is `inngest version 1.19.2-<commit>`; parse the first two dotted components.

(No authed / identity / org / version-channel dimensions — `inngest-cli` has no remote auth.)

## Install (only when "installed" probe fails)

```
npm i -g inngest-cli@latest
```

Installs both `inngest` and `inngest-cli` bins. After install, re-run the *installed* probe.

## Login (n/a)

`inngest auth` and `inngest login` both error with "No help topic". Production
Inngest is wired up via `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` environment
variables consumed at runtime by the apps (`vendor/inngest/src/env.ts`), not by
this CLI.

## Set org / project

N/A — no remote state on the CLI side. Production app registration happens
when the deployed app's Inngest endpoint is called by Inngest cloud; the dev
server only handles local events.

## Upgrade (only when version below recorded minimum, or user requests upgrade)

```
npm i -g inngest-cli@latest
```

Same command upgrades in place. After upgrade, re-run the *version* probe.

Note: `pnpm dev:inngest` uses `npx inngest-cli@latest`, which resolves the
latest at invocation time. Bumping the global install is independent of what
`npx` resolves.

## Known gotchas

- **Two binaries, same code.** `inngest` and `inngest-cli` both exist after `npm i -g inngest-cli`. The doctor probes both because a broken global install (e.g. a half-applied upgrade) can leave one symlink stale.
- **Version string includes commit hash.** Output is `inngest version 1.19.2-cdda5dd36`, not a clean semver. Parse `1.19.2` and ignore the suffix when comparing against the minimum.
- **`pnpm dev:inngest` uses `npx`, not the global install.** The global install is for the doctor's verification path and for ad-hoc human use (e.g. `inngest dev --port 8288`). The script intentionally pulls latest via npx; the doctor's "installed globally" probe is independent of what the script runs at invocation time.
- **No auth, no org binding.** Don't expect `inngest auth status`, `inngest org list`, or similar — they don't exist. Production auth is env-var-based.
- **Dev server port collision.** `inngest dev` defaults to `:8288`; a stale dev server (from a previous `pnpm dev:inngest`) holds the port. Symptom: `pnpm dev:services` fails to start the inngest leg. The doctor does NOT probe port availability — that's a runtime concern, not a setup concern. Use `lsof -i :8288` to diagnose.
- **`pnpm dev` app URL sync ≠ dev server.** `scripts/inngest-portless-sync.mjs` registers app URLs with an already-running dev server. It does NOT start one. If `dev:inngest` isn't running, sync is a no-op.

## References

- Upstream: https://github.com/inngest/inngest
- npm: https://www.npmjs.com/package/inngest-cli
- Lightfast usage: `package.json` script `dev:inngest`, `scripts/inngest-portless-sync.mjs`
- Vendor env layer: `vendor/inngest/src/env.ts` (production credentials live here)
- Related skill: `lightfast-inngest` (workflow run inspection — separate concern from this doctor entry).
