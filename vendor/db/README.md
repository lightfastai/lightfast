# @vendor/db

Standalone vendor wrapper for PlanetScale and Drizzle.

This package owns third-party integration details only:

- `@planetscale/database` client construction.
- `drizzle-orm/planetscale-serverless` database construction.
- shared Drizzle config shaping for MySQL.
- low-level database env validation for host, username, and password.

Application schema, migration paths, database names, and table filters belong in
the caller package, such as `@db/app`.

## Runtime Env

```bash
DATABASE_HOST
DATABASE_USERNAME
DATABASE_PASSWORD
```

## Drizzle Config

Callers must provide app-owned values:

```ts
createDrizzleConfig({
  database: "app_database",
  host: env.DATABASE_HOST,
  out: "./src/migrations",
  password: env.DATABASE_PASSWORD,
  schema: "./src/schema/index.ts",
  tablesFilter: ["app_*"],
  username: env.DATABASE_USERNAME,
});
```
