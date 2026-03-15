# Pipeline Hardening: Entity State, Junction Denorm, Edge Reinforcement, Ingest Log FK

## Overview

Four targeted improvements to the neural pipeline: (1) add `state` + `url` to entities so lifecycle changes are tracked, (2) denormalize `category` onto the junction table to cut an extra DB round-trip from every edge resolution, (3) reinforce edges on re-encounter using `MAX(existing, new)` confidence, (4) link `workspaceEvents` back to `workspaceIngestLogs` via FK then prune the redundant `source`/`sourceType` columns from ingest logs.

## Current State Analysis

- **Entity lifecycle** (`workspaceEntities`): no `state` or `url` columns. `onConflictDoUpdate` (event-store.ts:440–451) updates only `lastSeenAt`, `occurrenceCount`, `updatedAt`. Provider transformers emit `entity.state` (e.g. `"open"`, `"merged"`, `"resolved"`) and `entity.url` but both are silently discarded.
- **Junction denorm** (`workspaceEventEntities`): no `category` column. `edge-resolver.ts` fetches junction rows at line 112–119 with no type info, then makes a second round-trip (`allCoEntities` query, line 130–137) to `workspaceEntities` to resolve categories. `key` is stored in `coEventEntitiesMap` but never used in rule matching — only `category`, `entityId`, and `refLabel` are consumed.
- **Edge reinforcement** (`workspaceEntityEdges`): `onConflictDoNothing()` (edge-resolver.ts:261). Repeated co-occurrences are dropped silently. No `lastSeenAt` on the edge table.
- **Ingest log FK**: `workspaceIngestLogs.source` is an equality-filter column used in one place (`workspace.ts:847`); `sourceType` is projection-only. Both duplicate values available inside the `sourceEvent` JSONB. No FK back from `workspaceEvents` to `workspaceIngestLogs`.

## Desired End State

After all phases:
- `workspaceEntities` has `state varchar(100)` and `url varchar(2048)`, both updated on every re-encounter with the latest event's values.
- `workspaceEventEntities` has a `category varchar(50)` column written on every junction insert. `edge-resolver.ts` builds its co-entity map from junction rows directly — no second DB query.
- `workspaceEntityEdges` has a `last_seen_at` timestamp and uses `GREATEST(excluded.confidence, existing.confidence)` on conflict.
- `workspaceEvents` has an `ingest_log_id bigint nullable FK → workspaceIngestLogs.id`. `workspaceIngestLogs` no longer has `source` or `sourceType` columns.

### Key Discoveries
- `ExtractedEntity` schema (`packages/console-validation/src/schemas/entities.ts:78–84`): `{ category, confidence, evidence, key, value? }` — no `state` or `url`. These must be added as optional fields.
- Primary entity construction (`event-store.ts:350–356`): builds `ExtractedEntity` from `sourceEvent.entity.entityType/entityId`. `state` and `url` are available on `sourceEvent.entity` at this point and must be threaded through.
- `theirEntity.key` in the edge-resolver co-entity map (`edge-resolver.ts:142–163`) is stored but never read in the rule-matching loop (lines 191–239). The `allCoEntities` query can be removed entirely once `category` is on junction rows.
- `apps-console/event.capture` Inngest schema (`client.ts:56–65`): no `ingestLogId` field. Must be added as optional (backfill + test-data paths have no ingest log).

## What We're NOT Doing

- Adding `title` to `workspaceEntities` (user descoped — state + url only).
- Denormalizing `key` onto the junction table (not needed — key is never read from `coEventEntitiesMap`).
- Changing edge `confidence` to an accumulation formula (MAX is sufficient).
- Adding a GIN index on `sourceEvent` JSONB for the pruned `source` filter (an expression index on `source_event->>'provider'` is sufficient).
- Backfilling historical junction rows with `category` (leave NULL for pre-migration rows; edge-resolver guards against NULL).
- Changing the `seenCount` on edges (the user requested MAX confidence only — no counter column).

---

## Phase 1: Additive Schema Migration

### Overview
Add all new columns across four tables in a single migration. All additions are nullable or have defaults so existing rows are unaffected. No logic changes in this phase.

### Changes Required

#### 1. `workspaceEntities` — add `state` + `url`
**File**: `db/console/src/schema/tables/workspace-entities.ts`

After the `confidence` column (line 83):
```typescript
state: varchar("state", { length: 100 }),
url: varchar("url", { length: 2048 }),
```

#### 2. `workspaceEventEntities` — add `category`
**File**: `db/console/src/schema/tables/workspace-event-entities.ts`

After `refLabel` (line 43):
```typescript
category: varchar("category", { length: 50 }),
```
Nullable — pre-migration rows will be NULL until logic writes it (Phase 2).

#### 3. `workspaceEntityEdges` — add `lastSeenAt`
**File**: `db/console/src/schema/tables/workspace-entity-edges.ts`

After `confidence` (line 54):
```typescript
lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
  .notNull()
  .default(sql`CURRENT_TIMESTAMP`),
```

#### 4. `workspaceEvents` — add `ingestLogId`
**File**: `db/console/src/schema/tables/workspace-events.ts`

After `ingestionSource` (line 116–118):
```typescript
ingestLogId: bigint("ingest_log_id", { mode: "number" })
  .references(() => workspaceIngestLogs.id, { onDelete: "set null" }),
```

#### 5. Generate and apply migration
```bash
cd db/console && pnpm db:generate && pnpm db:migrate
```

### Success Criteria

#### Automated Verification
- [x] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [x] Migration applies: `cd db/console && pnpm db:migrate`
- [x] Schema types compile: `pnpm typecheck`

#### Manual Verification
- [ ] Drizzle studio shows new columns on all four tables: `cd db/console && pnpm db:studio`

---

## Phase 2: Logic Wiring — Entity State/URL, Ingest Log FK, Junction Category

### Overview
Wire up the new columns in the event pipeline: thread `ingestLogId` from ingress → Inngest → event-store; add `state`/`url` to entity upsert; write `category` on junction inserts.

### Changes Required

#### 1. `ExtractedEntity` schema — add optional `state` and `url`
**File**: `packages/console-validation/src/schemas/entities.ts:78–84`

```typescript
export const extractedEntitySchema = z.object({
  category: entityCategorySchema,
  confidence: z.number(),
  evidence: z.string(),
  key: z.string(),
  value: z.string().optional(),
  state: z.string().optional(),   // NEW — entity lifecycle state
  url: z.string().optional(),     // NEW — canonical source URL
});
```

#### 2. `apps-console/event.capture` Inngest event — add optional `ingestLogId`
**File**: `api/console/src/inngest/client/client.ts:56–65`

```typescript
"apps-console/event.capture": z.object({
  workspaceId: z.string(),
  clerkOrgId: z.string().optional(),
  sourceEvent: postTransformEventSchema,
  ingestionSource: ingestionSourceSchema.optional(),
  ingestLogId: z.number().optional(), // NEW — FK back to workspaceIngestLogs
}),
```

#### 3. Ingress route — pass `ingestLogId` to Inngest
**File**: `apps/console/src/app/api/gateway/ingress/route.ts`

The existing insert at lines 71–82 returns `{ id }`. That `id` is already available as `record.id`. Add it to the Inngest event payload in the `publishInngestNotification` call (via `apps/console/src/app/api/gateway/ingress/_lib/notify.ts:19–27`):

```typescript
// notify.ts — add ingestLogId to payload
{
  name: "apps-console/event.capture",
  data: {
    workspaceId: workspace.workspaceId,
    clerkOrgId: workspace.clerkOrgId,
    sourceEvent: sourceEvent,
    ingestionSource: "webhook",
    ingestLogId: ingestLogId,   // NEW — pass from caller
  }
}
```

Update `publishInngestNotification` signature to accept `ingestLogId: number` and pass it through from `route.ts:90` where it currently calls `publishInngestNotification(workspace, sourceEvent, record.id)` — the `record.id` already exists; it's currently used for SSE only. Pass it as an additional argument to the Inngest notification helper too.

#### 4. `event-store.ts` — thread `state`/`url` through primary entity + write `ingestLogId` + write `category` on junction
**File**: `api/console/src/inngest/workflow/neural/event-store.ts`

**4a. Primary entity construction (line 350–356)** — add `state` and `url`:
```typescript
const primaryEntityExtracted: ExtractedEntity = {
  category: sourceEvent.entity.entityType as EntityCategory,
  key: sourceEvent.entity.entityId,
  value: undefined,
  confidence: 1.0,
  evidence: `Primary entity: ${sourceEvent.entity.entityType}`,
  state: sourceEvent.entity.state ?? undefined,   // NEW
  url: sourceEvent.entity.url ?? undefined,       // NEW
};
```

**4b. Entity upsert values (lines 432–438)** — add `state` and `url`:
```typescript
.values({
  workspaceId,
  category: entity.category,
  key: entity.key,
  value: entity.value,
  evidenceSnippet: entity.evidence,
  confidence: entity.confidence,
  state: entity.state ?? null,   // NEW
  url: entity.url ?? null,       // NEW
})
```

**4c. `onConflictDoUpdate` set (lines 446–450)** — update `state` and `url`:
```typescript
set: {
  lastSeenAt: new Date().toISOString(),
  occurrenceCount: sql`${workspaceEntities.occurrenceCount} + 1`,
  updatedAt: new Date().toISOString(),
  state: sql`EXCLUDED.state`,                                              // NEW — always take latest state
  url: sql`COALESCE(EXCLUDED.url, ${workspaceEntities.url})`,             // NEW — keep existing URL if new is null
},
```

**4d. Junction row construction (lines 472–481)** — add `category`:
```typescript
return {
  entityId,
  eventId: observation.id,
  workspaceId,
  category: entity.category,   // NEW
  refLabel: STRUCTURAL_TYPES.has(entity.category)
    ? (entity.value ?? null)
    : null,
};
```

**4e. `store-observation` step insert (lines 388–401)** — add `ingestLogId`:
```typescript
.values({
  // ... existing fields ...
  ingestLogId: event.data.ingestLogId ?? null,   // NEW — nullable for backfill path
})
```

### Success Criteria

#### Automated Verification
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [ ] Unit tests pass: `pnpm --filter @api/console test`
- [ ] Integration tests pass: `pnpm --filter @packages/integration-tests test`

#### Manual Verification
- [ ] Trigger a GitHub PR event via debug inject — verify `workspaceEntities` row has `state = "open"` or `"merged"` and `url` populated
- [ ] Re-trigger the same PR with a different state — verify `state` column updates to the new value
- [ ] Check `workspaceEventEntities` rows — verify `category` column is populated (not NULL)
- [ ] Check `workspaceEvents` row — verify `ingest_log_id` FK points to the correct `workspaceIngestLogs` row

**Implementation Note**: After automated verification passes, manually confirm entity state/url are correct in DB before proceeding to Phase 3.

---

## Phase 3: Edge Reinforcement

### Overview
Switch the edge insert from `onConflictDoNothing` to `onConflictDoUpdate` that updates `confidence` to `MAX(existing, incoming)` and refreshes `lastSeenAt` and `sourceEventId` on each re-encounter.

### Changes Required

#### 1. Edge insert in `edge-resolver.ts` (lines 248–261)
**File**: `api/console/src/inngest/workflow/neural/edge-resolver.ts`

Replace:
```typescript
await db.insert(workspaceEntityEdges).values(inserts).onConflictDoNothing();
```

With:
```typescript
await db
  .insert(workspaceEntityEdges)
  .values(inserts)
  .onConflictDoUpdate({
    target: [
      workspaceEntityEdges.workspaceId,
      workspaceEntityEdges.sourceEntityId,
      workspaceEntityEdges.targetEntityId,
      workspaceEntityEdges.relationshipType,
    ],
    set: {
      confidence: sql`GREATEST(EXCLUDED.confidence, ${workspaceEntityEdges.confidence})`,
      lastSeenAt: sql`CURRENT_TIMESTAMP`,
      sourceEventId: sql`EXCLUDED.source_event_id`,
    },
  });
```

The `target` matches `edge_unique_idx` at `workspace-entity-edges.ts:75–80`. `externalId` is intentionally NOT updated (we keep the original stable identifier). `metadata` is static `{ detectionMethod: "entity_cooccurrence" }` so no update needed.

### Success Criteria

#### Automated Verification
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [ ] Integration test `event-ordering.integration.test.ts` passes (contains full scan of `workspaceEntityEdges`)

#### Manual Verification
- [ ] Send two GitHub PR events sharing the same entity — verify the edge row's `confidence` is `MAX` of both events' rule confidence, and `last_seen_at` reflects the second event's time.

---

## Phase 4: Edge-Resolver Optimization — Eliminate `allCoEntities` Round-Trip

### Overview
Use the `category` column now present on `workspaceEventEntities` junction rows to build `coEventEntitiesMap` directly, removing the `allCoEntities` DB query entirely.

### Changes Required

#### 1. Co-event junction fetch — add `category` to SELECT (lines 112–119)
**File**: `api/console/src/inngest/workflow/neural/edge-resolver.ts`

```typescript
const coEventEntityJunctions = await db
  .select({
    eventId: workspaceEventEntities.eventId,
    entityId: workspaceEventEntities.entityId,
    refLabel: workspaceEventEntities.refLabel,
    category: workspaceEventEntities.category,   // NEW
  })
  .from(workspaceEventEntities)
  .where(inArray(workspaceEventEntities.eventId, coEventIds));
```

#### 2. Remove `allCoEntities` query and build map directly (lines 126–163)
**File**: `api/console/src/inngest/workflow/neural/edge-resolver.ts`

Delete lines 126–138 (the `allCoEntities` query and `coEntityMap`). Replace the loop at lines 141–163 with:

```typescript
// Group co-event junctions by event ID (category now on junction row)
const coEventEntitiesMap = new Map<
  number,
  Array<{
    entityId: number;
    category: string;
    refLabel: string | null;
  }>
>();
for (const j of coEventEntityJunctions) {
  if (!j.category) {
    // Pre-migration rows without category — skip (cannot evaluate rules)
    continue;
  }
  const arr = coEventEntitiesMap.get(j.eventId) ?? [];
  arr.push({
    entityId: j.entityId,
    category: j.category,
    refLabel: j.refLabel,
  });
  coEventEntitiesMap.set(j.eventId, arr);
}
```

Note: `key` is removed from the map entry type because it was stored but never read in the rule-matching loop (lines 191–239 only access `theirEntity.category`, `theirEntity.refLabel`, and `theirEntity.entityId`).

#### 3. Update rule-matching loop references
**File**: `api/console/src/inngest/workflow/neural/edge-resolver.ts:191–239`

`theirEntity.entityId` (not `.id`) is already the correct field for edge candidate construction — no changes needed there. Remove the `key` field from the destructuring/access patterns if TypeScript now complains about the narrowed type.

### Success Criteria

#### Automated Verification
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [ ] Integration test `event-ordering.integration.test.ts` passes
- [ ] Neural pipeline integration test `neural-pipeline.integration.test.ts` passes

#### Manual Verification
- [ ] Trigger two events sharing a structural entity (e.g. a GitHub commit + Vercel deployment) — verify edges are still created correctly with no regressions.
- [ ] Confirm in logs/traces that the edge-resolver step no longer issues a second `workspaceEntities` query for co-entity lookups.

---

## Phase 5: Ingest Log Column Pruning

### Overview
Remove the now-redundant `source` and `sourceType` columns from `workspaceIngestLogs`. Update the one query that filtered on `source` to use JSONB extraction. Add an expression index to maintain query performance.

### Changes Required

#### 1. `workspaceIngestLogs` schema — remove `source` + `sourceType`
**File**: `db/console/src/schema/tables/workspace-ingest-logs.ts`

- Delete the `source` column definition (line 51) and the `sourceType` column definition (line 58).
- Delete the `workspace_event_source_idx` index definition (lines 107–111) — this index spans `(workspace_id, source, source_type)` and becomes invalid.
- Add an expression index on the JSONB provider field:
```typescript
eventProviderIdx: index("workspace_ingest_log_provider_idx").on(
  sql`(${table.sourceEvent}->>'provider')`
),
```

#### 2. `events.list` tRPC procedure — update `source` filter
**File**: `api/console/src/router/org/workspace.ts:847`

Replace:
```typescript
eq(workspaceIngestLogs.source, input.source)
```
With:
```typescript
sql`${workspaceIngestLogs.sourceEvent}->>'provider' = ${input.source}`
```

#### 3. `workspaceIngestLogs` insert in ingress route — remove `source` + `sourceType`
**File**: `apps/console/src/app/api/gateway/ingress/route.ts:71–82`

Remove the `source: envelope.provider` and `sourceType: sourceEvent.eventType` fields from the `.values(...)` call. Both values remain accessible via `sourceEvent.provider` and `sourceEvent.eventType` inside the stored JSONB.

#### 4. Generate and apply removal migration
```bash
cd db/console && pnpm db:generate && pnpm db:migrate
```

### Success Criteria

#### Automated Verification
- [x] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [x] Migration applies: `cd db/console && pnpm db:migrate`
- [x] Type checking passes: `pnpm typecheck` (no references to removed columns)
- [x] Linting passes: `pnpm check`
- [ ] Integration tests pass: `pnpm --filter @packages/integration-tests test`

#### Manual Verification
- [ ] `workspace.events.list` tRPC call with `source: "github"` filter returns correct results.
- [ ] Drizzle studio confirms `source` and `source_type` columns are absent from `lightfast_workspace_ingest_logs`.
- [ ] New `workspace_ingest_log_provider_idx` expression index is present.

---

## Testing Strategy

### Unit Tests
- `packages/console-validation`: verify `extractedEntitySchema` accepts `state` and `url`
- `api/console/src/inngest/workflow/neural/event-store`: verify primary entity construction includes `state`/`url` from `sourceEvent.entity`
- `api/console/src/inngest/workflow/neural/edge-resolver`: verify `resolveEdges` no longer issues `allCoEntities` query (can mock DB layer)

### Integration Tests
- `neural-pipeline.integration.test.ts`: end-to-end — entity row should have `state` + `url` after event capture
- `event-ordering.integration.test.ts`: edge rows should reflect `GREATEST` confidence after duplicate co-occurrence
- `backfill-connections-api.integration.test.ts`: backfill path (no `ingestLogId`) must not break — `ingestLogId` is nullable

### Manual Testing Steps
1. Trigger a GitHub PR opened event → verify `workspaceEntities` row has `state = "open"` and `url` set
2. Trigger the same PR merged → verify `state` updates to `"merged"`, `url` preserved
3. Trigger a Linear issue + GitHub PR on same repo → verify `workspaceEntityEdges` row created with correct `confidence`
4. Trigger the same pair again → verify `last_seen_at` updated, confidence is `MAX`
5. Call `events.list` tRPC with `source: "github"` filter → verify results still correct post-pruning

## Migration Notes

- `workspaceEventEntities.category` is nullable — pre-migration rows remain NULL. Edge-resolver Phase 4 skips NULL-category rows with a `continue`, so historical events don't create incorrect edges.
- `workspaceEvents.ingestLogId` is nullable — backfill-ingested events and test-data paths will have `null` here, which is correct.
- `workspaceEntityEdges.lastSeenAt` defaults to `CURRENT_TIMESTAMP` — existing edges get "now" as their `lastSeenAt`, which is acceptable.
- After Phase 5's migration, the `workspace_event_source_idx` composite index on `(workspace_id, source, source_type)` is dropped. The new expression index `workspace_ingest_log_provider_idx` on `(source_event->>'provider')` replaces the provider-filter portion.

## References

- Research doc: `thoughts/shared/research/2026-03-15-implementation-areas-ingest-entity-junction-edge.md`
- `event-store.ts` entity upsert: `api/console/src/inngest/workflow/neural/event-store.ts:419–499`
- `edge-resolver.ts` allCoEntities: `api/console/src/inngest/workflow/neural/edge-resolver.ts:126–163`
- Junction schema: `db/console/src/schema/tables/workspace-event-entities.ts`
- Entity schema: `db/console/src/schema/tables/workspace-entities.ts`
- Edge schema: `db/console/src/schema/tables/workspace-entity-edges.ts`
- Ingest log schema: `db/console/src/schema/tables/workspace-ingest-logs.ts`
