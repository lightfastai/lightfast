---
name: lightfast-local-infra
description: Use when setting up, repairing, provisioning, or verifying local Lightfast PlanetScale database or Upstash Redis infrastructure, including db up, redis up, env files, pscale, upstash, and deleted dev-services commands.
---

# Lightfast Local Infra

Local DB/Redis provisioning for this repo. Replaces the old `pnpm db:up`,
`pnpm redis:up`, `pnpm dev:setup`, and `pnpm dev:doctor` scripts.

## Boundaries

- No provisioning runtime scripts, root package scripts, or replacement CLI.
- No interactive `pscale auth login` in the agent shell — ask the human.
- No provider deletes. `drop` is intentionally deferred.
- Only write the managed keys listed in `references/env-files.md` to local
  override files. Do not write DB/Redis credentials to Vercel-pulled env files.
- Desktop multi-instance ids are chosen by the local infra/worktree flow, not
  inferred inside `apps/desktop`. When running multiple dev desktops, pass
  `LIGHTFAST_DESKTOP_DEV_INSTANCE_ID=<lowercase-dash-id>` explicitly so
  Electron stores auth, DB, settings, and browser state under
  `lightfast-local/instances/<id>`.

## First Probes

```bash
command -v pscale && pscale --version
pscale auth check
pscale org list --format json

command -v upstash && upstash --version
upstash auth whoami
upstash redis --help
```

## Choose The Reference

- DB setup or `db up`: `references/planetscale.md`.
- Redis setup or `redis up`: `references/upstash.md`.
- Env writes or validation: `references/env-files.md`.
- Schema or migration design: `planetscale-drizzle` skill instead.
- Read-only data inspection: `lightfast-db` skill instead.

Shared helpers live in `lib/` and are invoked by the references above.
