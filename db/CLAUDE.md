# Database Management

`db/app` owns the Lightfast app schema. It uses Drizzle with PlanetScale MySQL
through `@vendor/db` and `drizzle-orm/planetscale-serverless`.

## Commands

```bash
cd db/app
pnpm db:generate  # Generate migration SQL from schema
pnpm db:migrate   # Apply migrations to the configured PlanetScale branch
pnpm db:studio    # Open Drizzle Studio
```

From the repo root:

```bash
pnpm db:up      # Create/reuse this worktree's PlanetScale branch/password
pnpm db:down    # Delete this worktree's PlanetScale branch/password/cache
pnpm db:status  # Show local branch credential cache status
pnpm db:env     # Print cached DATABASE_* values
```

## Migration Rules

- Always use `pnpm db:generate`.
- Never manually create or edit `.sql` migration files.
- Local dev uses PlanetScale branches, not Docker MySQL.
- Run `pscale auth login` before `pnpm db:up`.
