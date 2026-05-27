---
name: lightfast-local-infra
description: Use when setting up, repairing, provisioning, or verifying local Lightfast PlanetScale database or Upstash Redis infrastructure, including db up, redis up, env files, pscale, upstash, and deleted dev-services commands.
---

# Lightfast Local Infra

Use this skill for local DB/Redis provisioning in this repo. It replaces the
old `pnpm db:up`, `pnpm redis:up`, `pnpm dev:setup`, and `pnpm dev:doctor`
script layer.

## Boundaries

- Do not add repo runtime scripts, root package scripts, or a replacement CLI.
- Do not write `.lightfast/pscale` credential cache files.
- Do not write `DATABASE_NAME`, `DATABASE_PORT`, `PSCALE_BRANCH_NAME`,
  `PLANETSCALE_DATABASE_NAME`, `PLANETSCALE_ORG_NAME`,
  `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, or provider metadata to
  app env files.
- Do not attempt interactive `pscale auth login` inside the agent shell; ask the
  human to run it in a real terminal.
- Do not delete provider resources. `drop` is intentionally deferred.

## First Probes

Run these before choosing a runbook:

```bash
command -v pscale && pscale --version
pscale auth check
pscale org list --format json

command -v upstash && upstash --version
upstash auth whoami
upstash redis --help
```

## Choose The Reference

- DB setup or `db up`: read `references/planetscale.md`.
- Redis setup or `redis up`: read `references/upstash.md`.
- Env writes or validation: read `references/env-files.md`.
- Schema or migration design: use the `planetscale-drizzle` skill instead.
- Read-only data inspection: use the `lightfast-db` skill instead.

## Required Runtime Env

The only setup-managed runtime keys are:

```text
apps/app/.vercel/.env.development.local
  DATABASE_HOST
  DATABASE_USERNAME
  DATABASE_PASSWORD
  KV_REST_API_URL
  KV_REST_API_TOKEN

apps/platform/.vercel/.env.development.local
  KV_REST_API_URL
  KV_REST_API_TOKEN
```
