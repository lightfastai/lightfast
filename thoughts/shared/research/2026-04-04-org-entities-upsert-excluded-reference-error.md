---
date: 2026-04-04T12:00:00+11:00
researcher: claude
git_commit: fbcd6483dfde3dbaa58a70a014874ea7c8121cf8
branch: refactor/drop-workspace-abstraction
repository: lightfast
topic: "lightfast_org_entities upsert EXCLUDED column reference error"
tags: [research, codebase, platform, inngest, drizzle, org-entities]
status: complete
last_updated: 2026-04-04
---

# Research: lightfast_org_entities upsert EXCLUDED column reference error

**Date**: 2026-04-04
**Git Commit**: fbcd6483dfde3dbaa58a70a014874ea7c8121cf8
**Branch**: refactor/drop-workspace-abstraction

## Research Question
PostgreSQL error `42P01: invalid reference to FROM-clause entry for table "lightfast_org_entities"` during upsert into `lightfast_org_entities` from the `memory-event-store` Inngest function.

## Summary

The error originates from the `upsert-entities-and-junctions` step in `memory-event-store.ts`. The Drizzle `onConflictDoUpdate` `set` clause uses `EXCLUDED.${orgEntities.columnName}` inside `sql` template literals. Drizzle interpolates column references as fully-qualified `"table_name"."column_name"`, producing invalid SQL like `EXCLUDED."lightfast_org_entities"."last_seen_at"` instead of the correct `EXCLUDED."last_seen_at"`.

## Detailed Findings

### Table Schema

The `orgEntities` table is defined at `db/app/src/schema/tables/org-entities.ts:24` as `pgTable("lightfast_org_entities", { ... })`.

Columns relevant to the upsert conflict resolution:
- `lastSeenAt` — `timestamp("last_seen_at")` (line 107)
- `occurrenceCount` — `integer("occurrence_count")` (line 117)
- `updatedAt` — `timestamp("updated_at")` (line 128)
- `state` — `varchar("state", { length: 100 })` (line 82)
- `url` — `varchar("url", { length: 2048 })` (line 89)

The conflict target is the unique index `uniqueEntityKey` at line 142 on `(clerkOrgId, category, key)`.

### Upsert Code

The upsert is at `api/platform/src/inngest/functions/memory-event-store.ts:424-456`, inside the `upsert-entities-and-junctions` step (line 415).

The `set` clause at lines 444-450:

```ts
set: {
  lastSeenAt: sql`GREATEST(${orgEntities.lastSeenAt}, EXCLUDED.${orgEntities.lastSeenAt})`,
  occurrenceCount: sql`${orgEntities.occurrenceCount} + 1`,
  updatedAt: new Date().toISOString(),
  state: sql`CASE WHEN EXCLUDED.${orgEntities.lastSeenAt} > ${orgEntities.lastSeenAt} THEN EXCLUDED.${orgEntities.state} ELSE ${orgEntities.state} END`,
  url: sql`COALESCE(EXCLUDED.url, ${orgEntities.url})`,
},
```

### How Drizzle Interpolates Column References in `sql` Templates

When `${orgEntities.lastSeenAt}` appears inside a Drizzle `sql` tagged template, Drizzle emits the fully-qualified column reference: `"lightfast_org_entities"."last_seen_at"`.

This works correctly for referencing the **existing row** in the table (the left side of an assignment). But when prefixed with `EXCLUDED.`, the concatenation produces:

| Code | Generated SQL | Valid? |
|------|--------------|--------|
| `${orgEntities.lastSeenAt}` | `"lightfast_org_entities"."last_seen_at"` | Yes (existing row) |
| `EXCLUDED.${orgEntities.lastSeenAt}` | `EXCLUDED."lightfast_org_entities"."last_seen_at"` | **No** |

PostgreSQL expects `EXCLUDED."last_seen_at"` — just the column name, not the table-qualified form.

### Affected Lines

Three lines in the `set` clause use the invalid `EXCLUDED.${column}` pattern:

1. **Line 445** (`lastSeenAt`): `EXCLUDED.${orgEntities.lastSeenAt}` — produces `EXCLUDED."lightfast_org_entities"."last_seen_at"`
2. **Line 448** (`state`): `EXCLUDED.${orgEntities.lastSeenAt}` and `EXCLUDED.${orgEntities.state}` — produces two invalid references
3. **Line 449** (`url`): `EXCLUDED.url` — this one is a **raw string literal** inside the template (not a Drizzle interpolation), so it produces valid `EXCLUDED.url`

### Data Flow to This Point

1. `memory/event.capture` Inngest event arrives at `memory-event-store.ts:115`
2. Entities are extracted and deduplicated into `extractedEntities` array (lines 333-370)
3. Step `upsert-entities-and-junctions` fires at line 415
4. `Promise.all` at line 424 executes one `db.insert(orgEntities).values(...).onConflictDoUpdate(...)` per entity
5. The `set` clause at lines 444-450 triggers the invalid SQL generation

## Code References

- `db/app/src/schema/tables/org-entities.ts:24` — Table definition
- `db/app/src/schema/tables/org-entities.ts:142` — Unique index (conflict target)
- `api/platform/src/inngest/functions/memory-event-store.ts:415` — Inngest step containing the upsert
- `api/platform/src/inngest/functions/memory-event-store.ts:438-451` — `onConflictDoUpdate` block
- `api/platform/src/inngest/functions/memory-event-store.ts:445` — Invalid `EXCLUDED` reference for `lastSeenAt`
- `api/platform/src/inngest/functions/memory-event-store.ts:448` — Invalid `EXCLUDED` references for `state` comparison
- `api/platform/src/inngest/functions/memory-event-store.ts:449` — Working raw string `EXCLUDED.url` reference

### Related Files

- `api/platform/src/inngest/functions/memory-entity-embed.ts` — Another consumer of `orgEntities`
- `api/platform/src/lib/edge-resolver.ts` — Edge resolver referencing `orgEntities`
- `db/app/src/schema/tables/org-event-entities.ts` — Junction table (event-to-entity)
- `db/app/src/schema/tables/org-entity-edges.ts` — Entity graph edges table

## Architecture Documentation

The `memory-event-store` function is part of the neural pipeline in the platform service. It processes captured events, extracts entities via AI, and upserts them into `lightfast_org_entities` with conflict resolution logic that:
- Keeps the most recent `state` (based on `last_seen_at` comparison)
- Coalesces URLs (prefers new URL, falls back to existing)
- Tracks `occurrence_count` by incrementing on each conflict
- Updates `last_seen_at` to the greater of existing and new timestamps
