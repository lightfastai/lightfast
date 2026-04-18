---
description: Query or inspect the Postgres database — schema, tables, columns, data. Triggers on "database", "table", "schema", "query", "SELECT", "rows", "columns", "what tables", "show me the data", "count", "how many".
---

Use the Postgres MCP tools to help with the user's request.

## Workflow

### Step 1: Load lightfast-db skill

```
skill({ name: 'lightfast-db' })
```

### Step 2: Determine intent from $ARGUMENTS

- **Schema inspection** ("what tables", "show schema", "describe table"): Query `information_schema`
- **Data query** ("show rows", "count", "find records"): Run a SELECT query with appropriate filters
- **Relationship inspection** ("foreign keys", "references", "joins"): Query constraint metadata

### Step 3: Execute

Use the `query` tool from the `postgres` MCP server. All queries are read-only.

If the user asks about a table by its Drizzle name (camelCase), convert to the actual SQL table name (snake_case with hyphens as underscores).

### Step 4: Summarize

Present results clearly. For schema queries, format as a table. For data queries, highlight relevant patterns.

<user-request>
$ARGUMENTS
</user-request>
