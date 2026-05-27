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
pnpm db:up      # create/reuse branch and cache credentials under .lightfast/
pnpm db:migrate # apply migrations to the cached branch
pnpm db:down    # tear down this worktree's branch/password/cache
```

## Commands

```bash
pnpm db:generate  # Generate migration SQL from src/schema
pnpm db:migrate   # Apply migrations
pnpm db:studio    # Open Drizzle Studio
```

Do not hand-write migration SQL. Change schema TypeScript and run
`pnpm db:generate`.
