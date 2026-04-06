# Migrate EXCLUDED References to `sql.identifier()` Implementation Plan

## Overview

Migrate all 7 raw-string EXCLUDED column references across 2 files to the schema-derived `excluded.${sql.identifier(column.name)}` pattern. This is the officially documented Drizzle approach — `column.name` reads from the schema definition, so if a column is ever renamed, the EXCLUDED reference updates automatically instead of silently breaking at runtime.

## Current State Analysis

Two files use raw SQL strings for EXCLUDED column references in `onConflictDoUpdate` `set` clauses:

- `api/platform/src/inngest/functions/memory-event-store.ts:445,448,449` — 5 EXCLUDED refs across 3 lines
- `api/platform/src/lib/edge-resolver.ts:257,259` — 2 EXCLUDED refs across 2 lines

All other `onConflictDoUpdate` sites (5 total) use plain JS values and need no changes.

### Key Discoveries:
- `sql.identifier()` is not used anywhere in the codebase yet — this is the first introduction
- Both files already import `sql` from `drizzle-orm` — no import changes needed
- `sql.identifier()` is a method on the imported `sql` object, producing a properly quoted SQL identifier
- The existing raw strings work today but are fragile: a schema column rename would silently break them at runtime (same class of invisible bug that caused the original `EXCLUDED.${column}` error)

## Desired End State

All EXCLUDED column references use `excluded.${sql.identifier(column.name)}` instead of hardcoded strings. Both upserts produce identical SQL output and execute without error.

### Verification:
- `pnpm build:platform` succeeds
- Trigger a webhook event that reaches `upsert-entities-and-junctions` — no `42P01` error
- Trigger an event that reaches `edge-resolver` upsert — no errors

## What We're NOT Doing

- No schema changes or migrations
- No changes to upsert logic or conflict resolution strategy
- No changes to the 5 `onConflictDoUpdate` sites that use plain JS values
- No creation of a shared `excluded()` helper utility (only 2 call sites — not worth the abstraction)

## Implementation Approach

Direct replacement of raw string EXCLUDED references with `sql.identifier(column.name)` at each call site. The `sql` import already exists in both files.

## Phase 1: Migrate All EXCLUDED References

### Overview
Replace all 7 raw-string EXCLUDED column references across 2 files with the schema-derived `sql.identifier()` pattern.

### Changes Required:

#### 1. memory-event-store.ts
**File**: `api/platform/src/inngest/functions/memory-event-store.ts`
**Lines**: 445, 448, 449

Line 445 — `lastSeenAt` (1 EXCLUDED ref):
```ts
// Before:
lastSeenAt: sql`GREATEST(${orgEntities.lastSeenAt}, EXCLUDED."last_seen_at")`,
// After:
lastSeenAt: sql`GREATEST(${orgEntities.lastSeenAt}, excluded.${sql.identifier(orgEntities.lastSeenAt.name)})`,
```

Line 448 — `state` (2 EXCLUDED refs):
```ts
// Before:
state: sql`CASE WHEN EXCLUDED."last_seen_at" > ${orgEntities.lastSeenAt} THEN EXCLUDED."state" ELSE ${orgEntities.state} END`,
// After:
state: sql`CASE WHEN excluded.${sql.identifier(orgEntities.lastSeenAt.name)} > ${orgEntities.lastSeenAt} THEN excluded.${sql.identifier(orgEntities.state.name)} ELSE ${orgEntities.state} END`,
```

Line 449 — `url` (1 EXCLUDED ref):
```ts
// Before:
url: sql`COALESCE(EXCLUDED.url, ${orgEntities.url})`,
// After:
url: sql`COALESCE(excluded.${sql.identifier(orgEntities.url.name)}, ${orgEntities.url})`,
```

#### 2. edge-resolver.ts
**File**: `api/platform/src/lib/edge-resolver.ts`
**Lines**: 257, 259

Line 257 ��� `confidence` (1 EXCLUDED ref):
```ts
// Before:
confidence: sql`GREATEST(EXCLUDED.confidence, ${orgEntityEdges.confidence})`,
// After:
confidence: sql`GREATEST(excluded.${sql.identifier(orgEntityEdges.confidence.name)}, ${orgEntityEdges.confidence})`,
```

Line 259 — `sourceEventId` (1 EXCLUDED ref):
```ts
// Before:
sourceEventId: sql`EXCLUDED.source_event_id`,
// After:
sourceEventId: sql`excluded.${sql.identifier(orgEntityEdges.sourceEventId.name)}`,
```

### Success Criteria:

#### Automated Verification:
- [x] Platform builds cleanly: `pnpm build:platform`
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check` (pre-existing format issue in connections.ts, unrelated)

#### Manual Verification:
- [ ] Trigger a GitHub webhook that reaches the `upsert-entities-and-junctions` step — no `42P01` error
- [ ] Entity row is created/updated in `lightfast_org_entities` table
- [ ] Trigger an event that reaches the edge-resolver upsert — no errors
- [ ] Edge rows are created/updated in `lightfast_org_entity_edges` table

## References

- Research doc: `thoughts/shared/research/2026-04-04-org-entities-upsert-excluded-reference-error.md`
- Original fix plan: `thoughts/shared/plans/2026-04-04-fix-org-entities-excluded-reference.md`
- Drizzle upsert guide: https://orm.drizzle.team/docs/guides/upsert
- Entity schema: `db/app/src/schema/tables/org-entities.ts:24-163`
- Edge schema: `db/app/src/schema/tables/org-entity-edges.ts`
