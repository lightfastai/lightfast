# Database Management

`db/app` owns the Lightfast app schema. It uses Drizzle with PlanetScale MySQL
through `@vendor/db` and `drizzle-orm/planetscale-serverless`.

## Commands

```bash
cd db/app
pnpm db:audit     # Run schema guardrails, typecheck, and Drizzle migration check
pnpm db:generate  # Generate migration SQL from schema, offline
pnpm db:push      # Apply schema diff to this worktree's PlanetScale branch
pnpm db:migrate   # Apply generated migrations to staging (requires DATABASE_*)
pnpm db:baseline  # Seed staging's __drizzle_migrations journal
pnpm db:studio    # Open Drizzle Studio through Portless
```

From the repo root:

```bash
pnpm db:push    # Apply schema diff to the env-configured branch
pnpm db:migrate # Apply generated migrations to the env-configured branch
pnpm db:studio  # Open Drizzle Studio through Portless
```

Local PlanetScale branch/password setup is skill-driven. Load
`.agents/skills/lightfast-local-infra` and use its `db up` runbook to create or
reuse a branch and write `DATABASE_HOST`, `DATABASE_USERNAME`, and
`DATABASE_PASSWORD` to `apps/app/.env.overrides.local`.

## Branch Model & Deploy Pipeline

Schema changes move through three PlanetScale branch tiers:

- `main` — production schema. Do not run `migrate()` against this branch.
- `staging` — persistent integration branch. This is the only branch where
  generated migrations run with `pnpm db:migrate`.
- `wt-<hash>` — ephemeral per-worktree development branch. Local dev applies
  schema with `pnpm db:push`, not `pnpm db:migrate`.

The `staging` branch owns the authoritative `__drizzle_migrations` journal. Its
rows are data, and PlanetScale deploy requests merge schema only, so the journal
must never be reset. CI runs migrations against `staging`, then opens and
deploys a `staging` to `main` deploy request.

One-time `staging` bootstrap:

```bash
pscale branch create lightfast staging --from main --wait
pscale password create lightfast staging bootstrap -f json
DATABASE_HOST=<host> \
DATABASE_USERNAME=<username> \
DATABASE_PASSWORD=<password> \
  pnpm --filter @db/app db:baseline -- --through=0000_blushing_titania
pscale password delete lightfast staging <password-id> --force
```

The `--through` value must be the latest migration already deployed to `main`.
After a later deploy, if `staging` is ever rebuilt, repeat the bootstrap from
`main` and seed through that last deployed migration tag:

```bash
DATABASE_HOST=<host> \
DATABASE_USERNAME=<username> \
DATABASE_PASSWORD=<password> \
  pnpm --filter @db/app db:baseline -- --through=<last-deployed-tag>
```

## Migration Rules

- App table names are scope-first: use `lightfast_<scope>_<entity_plural>`
  when the entity is self-describing, or
  `lightfast_<scope>_<domain>_<entity_plural>` when a separate domain grouping
  adds clarity.
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
- Always use `pnpm db:generate`.
- Never manually create or edit `.sql` migration files.
- Local dev uses PlanetScale branches, not Docker MySQL, and applies schema with
  `pnpm db:push`.
- Run `pnpm db:migrate` only against the persistent `staging` branch with
  explicit `DATABASE_*` credentials.
- Run `pscale auth login` before using the `lightfast-local-infra` `db up`
  runbook.
