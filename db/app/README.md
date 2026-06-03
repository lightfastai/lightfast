# @db/app

Database schema, Drizzle client, and repository helpers for the Lightfast app.

## Driver

`@db/app` targets PlanetScale MySQL. Runtime connections use `@vendor/db`,
`@planetscale/database`, and `drizzle-orm/planetscale-serverless` over HTTP.

Required runtime vars:

```bash
DATABASE_HOST
DATABASE_USERNAME
DATABASE_PASSWORD
```

The database name is fixed as `lightfast`.

## Local Development

Local development uses PlanetScale branches. There is no Docker MySQL service.

```bash
pscale auth login
# Load the lightfast-local-infra skill and run its db up runbook.
pnpm db:push    # apply schema diff to the env-configured local branch
pnpm db:studio  # inspect the env-configured local branch via Portless
```

## Commands

```bash
pnpm db:audit     # Run schema guardrails, typecheck, and Drizzle migration check
pnpm db:generate  # Generate migration SQL from src/schema
pnpm db:migrate   # Apply migrations to the persistent staging branch only
pnpm db:push      # Apply schema diff
pnpm db:studio    # Open Drizzle Studio through Portless
```

`pnpm db:studio` registers the local Studio API through Portless at
`https://[<wt>.]db.lightfast.localhost`. Drizzle Studio prints a
`https://local.drizzle.studio?port=...` browser URL using that process's
Portless-injected backend port.

`pnpm db:migrate` is only for the persistent `staging` PlanetScale branch with
explicit `DATABASE_*` migration credentials. Never run it against the `main`
production branch.

Do not hand-write migration SQL. Change schema TypeScript and run
`pnpm db:generate`.

## Schema Conventions

- App table names use `lightfast_<scope>_<domain>_<entity_plural>`.
- Valid table scopes are `org`, `user`, and `system`.
- Schema file names mirror scope and domain without the global `lightfast_`
  prefix, such as `org-signals.ts`, `user-source-control.ts`, and
  `system-mcp-oauth.ts`.
- Drizzle table export names mirror the scoped table name without `lightfast_`,
  in camelCase, such as `orgSignals`, `userSourceControlAccounts`, and
  `systemMcpOauthClients`.
- Index names use scoped snake case and end in `_idx` or `_uq`, such as
  `org_signals_status_created_idx`; keep them within MySQL's 64-character
  identifier limit.
- App tables use an internal `id bigint unsigned primary key autoincrement`.
- Public/external identifiers use app-generated prefixed string columns such as
  `public_id`.
- App-owned time columns store UTC instants as `datetime(3)`.
- `created_at` defaults to `CURRENT_TIMESTAMP(3)`.
- `updated_at` defaults to `CURRENT_TIMESTAMP(3)` and is maintained by Drizzle
  `$onUpdate(() => new Date())`.
- Generated SQL must not contain database-side `ON UPDATE CURRENT_TIMESTAMP`
  clauses.
- Keep core MySQL column declarations inline in table files.
- Do not use `timestamp()` or `.onUpdateNow()` in app table schema files.
- Do not add SQL foreign keys; use Drizzle `relations()` for query ergonomics
  and enforce referential integrity in application code.
- Do not add `mysql2`; Drizzle and runtime DB access stay on the PlanetScale
  serverless driver path.
- Do not import `@planetscale/*` directly from app code; use `@vendor/db`.
- Generate migrations with `pnpm db:generate`; do not hand-write migration SQL.
