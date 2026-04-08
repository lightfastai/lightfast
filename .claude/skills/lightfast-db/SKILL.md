---
name: lightfast-db
description: |
  Query and inspect the Postgres database schema and data. Triggers when the user asks about
  tables, columns, rows, database schema, wants to run a SELECT query, or needs to understand
  the data model. Read-only — cannot modify data.
---

# Database Skill

Inspect the Postgres database through the `postgres` MCP server. All queries are read-only.

## Tools

The `postgres` MCP server provides:

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `query` | Execute a read-only SQL query | SELECT queries, counting rows, inspecting data |

Table schemas are also exposed as MCP resources at `postgres://<host>/<table>/schema`.

## Workflow

### Inspecting schema

```sql
-- List all tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- Describe a table's columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = '<table>' ORDER BY ordinal_position;

-- Show indexes
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = '<table>';

-- Show foreign keys
SELECT tc.constraint_name, tc.table_name, kcu.column_name,
       ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = '<table>';
```

### Querying data

```sql
-- Sample rows
SELECT * FROM <table> LIMIT 10;

-- Count
SELECT COUNT(*) FROM <table>;

-- Filter
SELECT * FROM <table> WHERE <condition> LIMIT 20;
```

## Quick Decision Tree

```
What do you need?
|- List all tables -> query information_schema.tables
|- See table columns -> query information_schema.columns
|- Sample data -> SELECT * FROM <table> LIMIT 10
|- Count rows -> SELECT COUNT(*) FROM <table>
|- Check relationships -> query information_schema foreign keys
```

## Notes

- All queries run inside a READ ONLY transaction — INSERT/UPDATE/DELETE will fail
- The database is Postgres (PlanetScale Postgres-compatible) accessed via SSL
- Drizzle schema definitions live in `db/app/src/schema/` — cross-reference with actual DB state
- For migrations, use `pnpm db:generate` and `pnpm db:migrate` (never write SQL manually)
