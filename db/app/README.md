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
