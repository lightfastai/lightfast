---
name: lightfast-local-infra
description: Use when setting up, repairing, provisioning, or verifying local Lightfast PlanetScale database infrastructure, including worktree branches, package-local env files, and pscale access.
---

# Lightfast Local Infra

Operator runbook for explicitly approved local PlanetScale setup. This skill
does not add a provisioning runtime or root package scripts.

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

Run these only after the user approves provider reads for the current run:

```bash
command -v pscale && pscale --version
pscale auth check
pscale org list --format json
```

## Choose The Reference

- Local PlanetScale branch setup: `references/planetscale.md`.
- Env writes or validation: `references/env-files.md`.
- Schema or migration design: `planetscale-drizzle` skill instead.
- Live data inspection is outside this setup skill and requires separate
  approval.

Shared helpers live in `lib/` and are invoked by the references above.
