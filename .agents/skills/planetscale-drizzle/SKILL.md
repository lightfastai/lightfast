---
name: planetscale-drizzle
description: Use when working with Drizzle ORM against this repo's PlanetScale MySQL (Vitess) foundation in @db/app, including approved schema design, local generation or push work, and Vitess/MySQL constraints.
---

# PlanetScale + Drizzle (@db/app)

`@db/app` is a deliberately small Drizzle foundation for **PlanetScale MySQL
(Vitess)**. It has an empty schema and no production backend, migration
baseline, staging branch, or deployment workflow. This skill maps the retained
provider conventions to relevant official documentation.

Engine-level depth: load the `mysql` and `vitess` skills. Canonical repository
commands and approval boundaries live in `db/CLAUDE.md`.

## Repo conventions at a glance

| Rule | Detail |
|------|--------|
| One driver | `drizzle-orm/planetscale-serverless` + `@planetscale/database`. **Never import `@planetscale/*` directly** — the client comes from `@vendor/db` (`createDatabase`). |
| Schema files | The schema is intentionally empty. Adding domain tables requires separate scope and review; use `lightfast_<snake_case>` names and import builders from `drizzle-orm/mysql-core`. |
| No `mysql2` | Must not appear anywhere in the workspace. drizzle-kit prefers `mysql2` over `@planetscale/database` and would route migrations over TCP, which PlanetScale branches don't expose. Load-bearing omission. |
| drizzle-kit | `dialect: "mysql"` (via `createDrizzleConfig` in `@vendor/db`) — **not** `"planetscale"`, which isn't a valid value. `tablesFilter: ["lightfast_*"]`. |
| No `RETURNING` | MySQL has none. Use `.$returningId()` (returns `{ id }` only). Need other columns? Pre-compute client-side or follow with a `SELECT`. |
| Schema operations | `pnpm db:generate` generates migrations after separately approved schema work. `pnpm db:push` applies the current schema only to an approved local worktree branch. There is no production migration workflow. **Never hand-write or edit `.sql`.** |
| Local setup | Per-worktree PlanetScale branches are provisioned with `lightfast-local-infra`. Runtime credentials live only in `db/app/.env.overrides.local`. |
| Foreign keys | Vitess FK support is limited; the repo avoids `references()`. Prefer application-level referential integrity. |

## Official PlanetScale docs — fetch when relevant

`llms.txt` is the full searchable index; the rest are pages worth fetching directly.

| Topic | URL |
|-------|-----|
| Full docs index | https://planetscale.com/docs/llms.txt |
| Drizzle ↔ PlanetScale connect (MySQL) | https://orm.drizzle.team/docs/connect-planetscale |
| PlanetScale workflow / best practices | https://planetscale.com/docs/vitess/best-practices.md |
| Non-blocking schema changes | https://planetscale.com/docs/vitess/schema-changes.md |
| Deploy requests | https://planetscale.com/docs/vitess/schema-changes/deploy-requests.md |
| Safe migrations (zero-downtime, reverts) | https://planetscale.com/docs/vitess/schema-changes/safe-migrations.md |
| Schema-change recipes by type | https://planetscale.com/docs/vitess/schema-changes/how-to-make-different-types-of-schema-changes.md |
| Table / column renames | https://planetscale.com/docs/vitess/schema-changes/handling-table-and-column-renames.md |
| Schema lint errors (rejected deploys) | https://planetscale.com/docs/vitess/schema-changes/schema-lint-errors.md |
| Schema branching | https://planetscale.com/docs/vitess/schema-changes/branching.md |
| Foreign key constraints | https://planetscale.com/docs/vitess/foreign-key-constraints.md |
| Sequences / AUTO_INCREMENT on sharded keyspaces | https://planetscale.com/docs/vitess/sharding/sequence-tables.md |
| Connection strings | https://planetscale.com/docs/vitess/connecting/connection-strings.md |
| Network latency (HTTP driver) | https://planetscale.com/docs/vitess/connecting/network-latency.md |
| CLI — branch / deploy-request / shell | https://planetscale.com/docs/cli/branch.md · /docs/cli/deploy-request.md · /docs/cli/shell.md |
| AI tooling (skills, MCP server) | https://planetscale.com/docs/connect/ai-tooling.md |

## Common mistakes

- Reaching for `.returning()` (a Postgres-ism). MySQL → `.$returningId()`.
- Adding `mysql2` to clear a drizzle-kit error — it silently breaks PlanetScale migrations.
- Importing `@planetscale/database` directly instead of going through `@vendor/db`.
- Hand-editing a migration `.sql` file instead of re-running `pnpm db:generate`.
- Inferring a staging or production database workflow that this repository does
  not contain.
- Adding `references()` / FKs without first checking the FK constraints + schema-lint docs.
- Assuming a Drizzle column rename is safe — drizzle-kit emits drop+add; see the renames doc.
