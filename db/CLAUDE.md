# Database Management

`db/app` owns the Lightfast app schema. It uses Drizzle with PlanetScale MySQL
through `@vendor/db` and `drizzle-orm/planetscale-serverless`.

## Commands

```bash
cd db/app
pnpm db:generate  # Generate migration SQL from schema, offline
pnpm db:push      # Apply schema diff to this worktree's PlanetScale branch
pnpm db:migrate   # Apply generated migrations to staging (requires DATABASE_*)
pnpm db:baseline  # Seed staging's __drizzle_migrations journal
pnpm db:studio    # Open Drizzle Studio for this worktree's branch
```

From the repo root:

```bash
pnpm db:push    # Apply schema diff to the env-configured branch
pnpm db:migrate # Apply generated migrations to the env-configured branch
```

Local PlanetScale branch/password setup is skill-driven. Load
`.agents/skills/lightfast-local-infra` and use its `db up` runbook to create or
reuse a branch and write `DATABASE_HOST`, `DATABASE_USERNAME`, and
`DATABASE_PASSWORD` to `apps/app/.vercel/.env.development.local`.

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
  pnpm --filter @db/app db:baseline -- --through=0000_pretty_justin_hammer
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

- Always use `pnpm db:generate`.
- Never manually create or edit `.sql` migration files.
- Local dev uses PlanetScale branches, not Docker MySQL, and applies schema with
  `pnpm db:push`.
- Run `pnpm db:migrate` only against the persistent `staging` branch with
  explicit `DATABASE_*` credentials.
- Run `pscale auth login` before using the `lightfast-local-infra` `db up`
  runbook.
