---
name: lightfast-local-infra
description: Use when setting up, repairing, provisioning, or verifying local Lightfast PlanetScale database infrastructure, including db up, env files, pscale, and deleted dev-services commands.
---

# Lightfast Local Infra

Local database provisioning for this repo. Replaces the old `pnpm db:up`,
`pnpm dev:setup`, and `pnpm dev:doctor` scripts.

## Boundaries

- No provisioning runtime scripts, root package scripts, or replacement CLI.
- No interactive `pscale auth login` in the agent shell — ask the human.
- No provider deletes. `drop` is intentionally deferred.
- Provider reads, creates, credential minting, live verification, and schema
  writes require explicit user approval for that exact run. Repository repair
  does not authorize provider effects.
- Only write the managed keys listed in `references/env-files.md` to the local
  database override file. Do not write database credentials anywhere else.

## First Probes

```bash
command -v pscale && pscale --version
pscale auth check
pscale org list --format json
```

## Choose The Reference

- DB setup or `db up`: `references/planetscale.md`.
- Env writes or validation: `references/env-files.md`.
- Schema or migration design: `planetscale-drizzle` skill instead.
- Read-only data inspection: `lightfast-db` skill instead.

Shared helpers live in `lib/` and are invoked by the references above.
