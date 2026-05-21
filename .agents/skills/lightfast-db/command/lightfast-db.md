---
description: Inspect the Lightfast PlanetScale MySQL database — schema, tables, columns, data. Triggers on "database", "table", "schema", "query", "SELECT", "rows", "columns", "what tables", "show me the data", "count", "how many".
---

Inspect the Lightfast database (PlanetScale MySQL / Vitess) to help with the user's request.

## Workflow

### Step 1: Load the lightfast-db skill

```
skill({ name: 'lightfast-db' })
```

### Step 2: Determine intent from $ARGUMENTS

- **Schema inspection** ("what tables", "show schema", "describe table"): query `information_schema`
- **Data query** ("show rows", "count", "find records"): run a read-only `SELECT`
- **Data model** ("how is X stored", "relationships"): cross-check `db/app/src/schema/tables/`

### Step 3: Execute (read-only)

Inspect via Drizzle Studio (`cd db/app && pnpm db:studio`) or `pscale shell lightfast <branch>`.
In Claude Code with the PlanetScale plugin enabled, the `planetscale` MCP server can also run
the query as a tool call. Never mutate data — schema changes go through `pnpm db:generate` +
`pnpm db:migrate`.

If the user names a table by its Drizzle symbol (camelCase), translate to the
`lightfast_`-prefixed snake_case SQL name.

### Step 4: Summarize

Present results clearly. Format schema results as a table; highlight patterns in data results.

<user-request>
$ARGUMENTS
</user-request>
