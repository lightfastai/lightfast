---
name: lightfast-db
description: |
  Inspect the Lightfast application database — PlanetScale MySQL (Vitess). Triggers when the
  user asks about tables, columns, rows, schema, wants to run a SELECT, or needs to understand
  the data model. Read-only inspection of THIS repo's database; for generic MySQL/Vitess
  engine guidance use the `mysql` and `vitess` skills.
---

# Lightfast Database

`@db/app` runs on **PlanetScale MySQL (Vitess)** through the single
`drizzle-orm/planetscale-serverless` driver — the same code path in local dev and production
(`db/app/src/client.ts`). Local dev uses a **per-worktree PlanetScale dev branch**; production
is the `main` branch of the `lightfast` database.

This skill covers inspecting *this repo's* database. For engine-level depth — index design,
query tuning, locking, Vitess sharding / VTGate behavior — load the `mysql` and `vitess` skills.

## Where things live

| What | Where |
|------|-------|
| Drizzle schema (source of truth) | `db/app/src/schema/tables/` — `mysqlTable(...)` definitions |
| Migrations | `db/app/src/migrations/` — generated SQL, never hand-written |
| Client | `db/app/src/client.ts` — `createDatabase()` from `@vendor/db` |
| Table naming | `lightfast_`-prefixed snake_case (`tablesFilter: ["lightfast_*"]`); Drizzle uses camelCase symbols |

## Inspecting the database

**Drizzle Studio — browser UI for the current worktree's branch:**

```bash
cd db/app && pnpm db:studio
```

**`pscale` CLI — cross-harness, ad-hoc SQL:**

```bash
# Load lightfast-local-infra to compute this checkout's branch name when needed.
pscale shell lightfast <branch>   # interactive MySQL shell against a branch
```

**PlanetScale MCP — Claude Code only.** When the PlanetScale plugin is enabled, its MCP server
exposes branches, schema, and Insights as tool calls. Not available in Codex — for anything
that must work cross-harness, prefer the Studio / CLI paths above.

## Schema inspection (MySQL)

```sql
-- List tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = DATABASE() ORDER BY table_name;

-- Describe columns
SELECT column_name, column_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = '<table>'
ORDER BY ordinal_position;

-- Indexes
SHOW INDEX FROM `<table>`;

-- Full DDL
SHOW CREATE TABLE `<table>`;
```

## Querying data

```sql
SELECT * FROM `<table>` LIMIT 10;
SELECT COUNT(*) FROM `<table>`;
SELECT * FROM `<table>` WHERE <condition> LIMIT 20;
```

## Notes

- **Read-only by discipline** — this skill inspects, it never mutates. Schema changes go
  through `pnpm db:generate` + `pnpm db:migrate` from `db/app/` (never hand-write `.sql`).
- If the user names a table by its Drizzle symbol (camelCase), translate to the
  `lightfast_`-prefixed snake_case SQL name.
- **Vitess caveats apply** — no stored procedures / triggers through VTGate, limited foreign
  key support, cross-shard joins are expensive. See the `vitess` skill.
- Cross-check the Drizzle schema in `db/app/src/schema/` against live DB state when the two
  might disagree.
