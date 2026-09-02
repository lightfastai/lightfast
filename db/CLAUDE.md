# Database Foundation

`db/app` is a deliberately small Drizzle/PlanetScale foundation. It keeps the
existing `@vendor/db` provider abstraction, an explicit client factory, an
empty schema export, and offline Drizzle configuration. It contains no legacy
domain tables, migration files, baseline journal, or deployment workflow.

## Commands

```bash
pnpm db:generate  # generate SQL only after schema work is separately approved
pnpm db:push      # approved local worktree branch only
pnpm db:studio    # approved local inspection through Portless
```

Load `lightfast-local-infra` before approved local PlanetScale setup. It writes
credentials only to `db/app/.env.overrides.local`. Do not read or mutate a
provider, mint credentials, push schema, or open Studio without exact approval
for that run.

## Rules

- Keep provider access behind `@vendor/db`; never import `@planetscale/*` from
  `db/app`.
- Importing `@db/app` must not connect to a provider.
- Credentials are explicit and package-local.
- Never hand-write generated SQL.
- Adding domain tables, migrations, baselines, staging workflows, or production
  database wiring requires separate scope and review.
