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
pnpm db:studio  # inspect the env-configured local branch
```

## Commands

```bash
pnpm db:generate  # Generate migration SQL from src/schema
pnpm db:migrate   # Apply migrations
pnpm db:push      # Apply schema diff
pnpm db:studio    # Open Drizzle Studio
```

Do not hand-write migration SQL. Change schema TypeScript and run
`pnpm db:generate`.
