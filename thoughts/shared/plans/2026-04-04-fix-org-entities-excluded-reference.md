# Fix orgEntities Upsert EXCLUDED Column References

## Overview

Fix the `onConflictDoUpdate` `set` clause in `memory-event-store.ts` that produces invalid PostgreSQL by using `EXCLUDED.${drizzleColumn}` instead of raw SQL column names. The Drizzle `sql` tagged template interpolates column references as fully-qualified `"table_name"."column_name"`, so `EXCLUDED.${orgEntities.lastSeenAt}` emits `EXCLUDED."lightfast_org_entities"."last_seen_at"` — PostgreSQL rejects this with error `42P01: invalid reference to FROM-clause entry for table "lightfast_org_entities"`.

## Current State Analysis

The upsert at `api/platform/src/inngest/functions/memory-event-store.ts:444-450` uses two patterns:
- **Broken**: `EXCLUDED.${orgEntities.lastSeenAt}` → `EXCLUDED."lightfast_org_entities"."last_seen_at"` (lines 445, 448)
- **Working**: `EXCLUDED.url` as raw string → `EXCLUDED.url` (line 449)

The correct pattern already exists in `api/platform/src/lib/edge-resolver.ts:249-261`:
```ts
confidence: sql`GREATEST(EXCLUDED.confidence, ${orgEntityEdges.confidence})`,
sourceEventId: sql`EXCLUDED.source_event_id`,
```

## Desired End State

Lines 444-450 of `memory-event-store.ts` use raw SQL column names after `EXCLUDED.` (matching the `edge-resolver.ts` pattern), and the upsert executes without error.

### Verification:
- `pnpm build:platform` succeeds
- Trigger a webhook event that reaches the `upsert-entities-and-junctions` step — no `42P01` error

## What We're NOT Doing

- No schema changes or migrations
- No refactoring of the upsert logic or conflict resolution strategy
- No changes to `edge-resolver.ts` (already correct)
- No Drizzle helper/utility abstraction for EXCLUDED references

## Implementation Approach

Replace Drizzle column interpolations after `EXCLUDED.` with raw SQL column name strings. The DB column names come from the schema at `db/app/src/schema/tables/org-entities.ts`:
- `orgEntities.lastSeenAt` → `last_seen_at` (line 107)
- `orgEntities.state` → `state` (line 85)
- `orgEntities.url` → `url` (line 90) — already correct

## Phase 1: Fix EXCLUDED References

### Overview
Replace 2 broken lines in the `set` clause.

### Changes Required:

**File**: `api/platform/src/inngest/functions/memory-event-store.ts`

Line 445 — `lastSeenAt`:
```ts
// Before:
lastSeenAt: sql`GREATEST(${orgEntities.lastSeenAt}, EXCLUDED.${orgEntities.lastSeenAt})`,
// After:
lastSeenAt: sql`GREATEST(${orgEntities.lastSeenAt}, EXCLUDED."last_seen_at")`,
```

Line 448 — `state`:
```ts
// Before:
state: sql`CASE WHEN EXCLUDED.${orgEntities.lastSeenAt} > ${orgEntities.lastSeenAt} THEN EXCLUDED.${orgEntities.state} ELSE ${orgEntities.state} END`,
// After:
state: sql`CASE WHEN EXCLUDED."last_seen_at" > ${orgEntities.lastSeenAt} THEN EXCLUDED."state" ELSE ${orgEntities.state} END`,
```

Line 449 — `url` (no change needed, already uses raw string):
```ts
url: sql`COALESCE(EXCLUDED.url, ${orgEntities.url})`,
```

### Success Criteria:

#### Automated Verification:
- [x] Platform builds cleanly: `pnpm build:platform`
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`

#### Manual Verification:
- [ ] Trigger a GitHub webhook that reaches the `upsert-entities-and-junctions` step
- [ ] No `42P01` error in Inngest dev server logs
- [ ] Entity row is created/updated in `lightfast_org_entities` table

## References

- Research doc: `thoughts/shared/research/2026-04-04-org-entities-upsert-excluded-reference-error.md`
- Correct pattern: `api/platform/src/lib/edge-resolver.ts:249-261`
- Table schema: `db/app/src/schema/tables/org-entities.ts:24-163`
