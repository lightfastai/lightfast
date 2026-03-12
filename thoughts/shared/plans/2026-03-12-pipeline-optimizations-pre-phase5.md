# Pipeline Optimizations + Alias Cleanup

## Overview

Apply 8 performance and correctness optimizations to the entity-edge pipeline, fix the duplicate schema constraint on `workspace_edges`, add 3 targeted code quality fixes, clean up select-shape aliases, and fix lint errors. These changes land on `feat/backfill-depth-entitytypes-run-tracking` before the Phase 6 Inngest rename.

Based on validation: this conversation's validation report.
Extends: `thoughts/shared/plans/2026-03-12-pipeline-restructure-v2.md`

## Current State Analysis

Phase 5 import renames and column accessor fixes are **fully complete**:
- All 4 table files renamed (`workspace-entities.ts`, `workspace-entity-events.ts`, `workspace-events.ts`, `workspace-interpretations.ts`)
- Barrel exports (`tables/index.ts`, `schema/index.ts`, `db/console/src/index.ts`) use new names exclusively
- Relations file uses new names and new column accessors (`.eventId` not `.observationId`)
- **All consumer files** import new names and use `.eventId` as the Drizzle column accessor
- `npx turbo typecheck --force` passes with zero errors (43/43 packages)

**Two remaining naming issues:**

1. **Select-shape aliases** — 7 files alias `.eventId` back to `observationId` in Drizzle select shapes (e.g., `observationId: workspaceEntityEvents.eventId`), then downstream JS code uses `j.observationId`. This is confusing — the DB column is `event_id` but the JS variable says `observationId`.

   | File | Line | Pattern |
   |---|---|---|
   | `apps/console/src/lib/v1/graph.ts` | 147 | `observationId: workspaceEntityEvents.eventId` |
   | `apps/console/src/lib/v1/related.ts` | 171 | `observationId: workspaceEntityEvents.eventId` |
   | `apps/console/src/lib/neural/entity-search.ts` | 118 | `observationId: workspaceEntityEvents.eventId` |
   | `apps/console/src/lib/neural/four-path-search.ts` | 138 | `observationId: workspaceInterpretations.eventId` |
   | `apps/console/src/lib/neural/four-path-search.ts` | 602 | `observationId: workspaceEntityEvents.eventId` |
   | `apps/console/src/lib/neural/id-resolver.ts` | 239 | `observationId: workspaceInterpretations.eventId` |
   | `apps/console/src/lib/v1/findsimilar.ts` | 99 | `observationId: workspaceInterpretations.eventId` |

2. **10 lint errors** across 7 files (import sorting + formatting):
   - `entity-search.ts`, `four-path-search.ts`, `url-resolver.ts`, `findsimilar.ts` — unsorted imports
   - `four-path-search.ts`, `id-resolver.ts`, `findsimilar.ts`, `graph.ts`, `workspace-events.ts`, `reconcile-pinecone-external-ids.ts` — formatting

### Key Discoveries:
- `workspace-edges.ts:33` has both `.unique()` AND `uniqueIndex("edge_external_id_idx")` on `externalId` — two Postgres indexes for one column
- `graph.ts:108` and `related.ts:98` use `SELECT *` on `workspaceEdges`, fetching unused JSONB `metadata` column
- `graph.ts:120-122` filters `allowedTypes` in JavaScript after fetching all edges from DB
- `edge-resolver.ts:95-113` has two independent queries awaited sequentially
- `edge-resolver.ts:166` calls `getEdgeRules()` → `Object.values(PROVIDERS).find()` per co-occurring event (up to 100× linear scan)
- `related.ts:233-238` hard-codes `bySource` to 4 providers — silently drops future providers
- `related.ts:128-148` clobbers `neighborEntityInfo` when an entity participates in multiple edges
- `observation-interpret.ts:362` — interpretation insert has no conflict guard (correctness bug on Inngest retry)
- `observation-interpret.ts:126-154` — two independent DB reads run as separate Inngest steps (unnecessary overhead)
- `scoring.ts:106` — `EVENT_REGISTRY[eventKey].weight` crashes on unknown event types (unguarded `as EventKey` cast)
- `entity-search.ts:121`, `graph.ts:88`, `related.ts:77` — junction queries missing `workspaceId` filter (data isolation gap)
- `findsimilar.ts:371-377` — `sameSourceOnly` filter silently overwritten by `filters.sourceTypes`

## Desired End State

- Select-shape aliases renamed from `observationId: ...eventId` → `eventId: ...eventId` on all 7 files
- `workspace_edges` has exactly one unique constraint on `external_id` (not two)
- Edge queries in `graph.ts` and `related.ts` select only consumed columns
- `allowedTypes` filter pushed to DB WHERE clause
- Edge resolver parallelizes independent queries and memoizes provider lookups
- `bySource` grouping derived dynamically from data
- Multi-edge entities preserve highest-confidence relationship info
- Interpretation insert is idempotent on Inngest retry
- `observation-interpret.ts` merges independent DB reads into one Inngest step
- `scoring.ts` handles unknown event types gracefully instead of crashing
- Junction queries in `entity-search.ts`, `graph.ts`, `related.ts` include `workspaceId` filter
- `findsimilar.ts` `sameSourceOnly` takes precedence over `filters.sourceTypes`
- `pnpm check`, `npx turbo typecheck --force`, and `pnpm build:console` all pass

### Verification
```bash
pnpm check && npx turbo typecheck --force
pnpm build:console
```

## What We're NOT Doing

- Phase 6 Inngest event/function ID renames (separate scope)
- Inngest file renames (`observation-store.ts` → `event-store.ts`, etc.)
- API response shape changes
- Renaming API-level `observationId` fields (`EntitySearchResult.observationId`, `NormalizedMatch.observationId`, `input.observationId`, Pinecone `metadata.observationId`) — these are external contracts
- New indexes or query plan analysis
- `EntityCategory` Zod schema change
- Recursive CTE rewrite for graph BFS (future optimization)
- Shared `normalizeVectorMatches` extraction from findsimilar/four-path-search (future cleanup)
- Wrapping classification IIFE in `step.run` in `observation-interpret.ts` (structural change to Inngest step memoization — separate scope)
- Batching entity upserts in `observation-store.ts` (changes storage pattern — `occurrenceCount` drift is acceptable pre-production)
- `resolveClerkOrgId` fail-fast on missing workspace (separate correctness scope)
- Empty content embedding fallback in `findsimilar.ts` (needs design decision on fallback strategy)
- Score boost cap fix in `four-path-search.ts` (needs scoring semantics discussion)
- Custom error types for 404 vs 500 in `graph.ts`/`related.ts` (API error handling redesign)

## Implementation Approach

3 phases. Phase 1 is schema cleanup (generates a migration). Phase 2 applies performance, correctness, and code quality optimizations to 6 key pipeline files. Phase 3 cleans up select-shape aliases, cascading JS variables, and lint errors across 9 files.

---

## Phase 1: Schema Cleanup

### Overview
Remove the duplicate unique constraint on `workspace_edges.external_id` and generate a migration. No consumer changes.

### Changes Required

#### 1. Remove `.unique()` from `externalId` column
**File**: `db/console/src/schema/tables/workspace-edges.ts:31-34`

```typescript
// Old
externalId: varchar("external_id", { length: 21 })
  .notNull()
  .unique()
  .$defaultFn(() => nanoid()),

// New
externalId: varchar("external_id", { length: 21 })
  .notNull()
  .$defaultFn(() => nanoid()),
```

The explicit `uniqueIndex("edge_external_id_idx")` at line 67 remains — it provides the same uniqueness constraint with a named index.

#### 2. Generate migration
```bash
cd db/console && pnpm db:generate
```

Review the generated SQL — it should drop the inline unique constraint while keeping `edge_external_id_idx`.

### Success Criteria

#### Automated Verification:
- [ ] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`

---

## Phase 2: Optimize Key Pipeline Files

### Overview
Apply 8 performance/correctness optimizations plus 3 code quality fixes to `edge-resolver.ts`, `graph.ts`, `related.ts`, `observation-interpret.ts`, `scoring.ts`, and `findsimilar.ts`. Import renames are already complete on all files — this phase is optimizations and fixes only.

### Changes Required

#### 1. Optimize `edge-resolver.ts` — parallelize + memoize

**File**: `api/console/src/inngest/workflow/neural/edge-resolver.ts`

**Change A — Parallelize independent queries (lines 95-113)**

The `coEvents` and `coEventEntityJunctions` queries both depend only on `coEventIds` and are independent.

```typescript
// Old (sequential)
const coEvents = await db
  .select({ id: workspaceEvents.id, source: workspaceEvents.source })
  .from(workspaceEvents)
  .where(inArray(workspaceEvents.id, coEventIds));

const coEventEntityJunctions = await db
  .select({
    eventId: workspaceEntityEvents.eventId,
    entityId: workspaceEntityEvents.entityId,
    refLabel: workspaceEntityEvents.refLabel,
  })
  .from(workspaceEntityEvents)
  .where(inArray(workspaceEntityEvents.eventId, coEventIds));

// New (parallel)
const [coEvents, coEventEntityJunctions] = await Promise.all([
  db
    .select({ id: workspaceEvents.id, source: workspaceEvents.source })
    .from(workspaceEvents)
    .where(inArray(workspaceEvents.id, coEventIds)),
  db
    .select({
      eventId: workspaceEntityEvents.eventId,
      entityId: workspaceEntityEvents.entityId,
      refLabel: workspaceEntityEvents.refLabel,
    })
    .from(workspaceEntityEvents)
    .where(inArray(workspaceEntityEvents.eventId, coEventIds)),
]);
```

**Change B — Memoize `getEdgeRules` (line 156, 166)**

Replace the module-level `getEdgeRules` function with a local memoized version inside `resolveEdges`:

```typescript
// Inside resolveEdges, before the loop at line 159:
const rulesCache = new Map<string, EdgeRule[]>();
function getCachedEdgeRules(src: string): EdgeRule[] {
  let rules = rulesCache.get(src);
  if (!rules) {
    const provider = Object.values(PROVIDERS).find((p) => p.name === src);
    rules = provider?.edgeRules ?? [];
    rulesCache.set(src, rules);
  }
  return rules;
}

// Then replace all calls:
// getEdgeRules(source)     → getCachedEdgeRules(source)
// getEdgeRules(otherSource) → getCachedEdgeRules(otherSource)
```

Remove the module-level `getEdgeRules` function (lines 239-242).

#### 2. Optimize `graph.ts`

**File**: `apps/console/src/lib/v1/graph.ts`

**Change A — SELECT only needed columns from edges (line 107-118)**

```typescript
// Old
const edges = await db
  .select()
  .from(workspaceEdges)
  ...

// New
const edges = await db
  .select({
    sourceEntityId: workspaceEdges.sourceEntityId,
    targetEntityId: workspaceEdges.targetEntityId,
    relationshipType: workspaceEdges.relationshipType,
    confidence: workspaceEdges.confidence,
  })
  .from(workspaceEdges)
  ...
```

Also update the `collectedEdges` type annotation (line 100):
```typescript
// Old
const collectedEdges: (typeof workspaceEdges.$inferSelect)[] = [];

// New
const collectedEdges: {
  sourceEntityId: number;
  targetEntityId: number;
  relationshipType: string;
  confidence: number;
}[] = [];
```

**Change B — Push `allowedTypes` filter to DB WHERE clause (lines 110-122)**

```typescript
// Old
const edges = await db
  .select({ ... })
  .from(workspaceEdges)
  .where(
    and(
      eq(workspaceEdges.workspaceId, auth.workspaceId),
      or(
        inArray(workspaceEdges.sourceEntityId, entityFrontier),
        inArray(workspaceEdges.targetEntityId, entityFrontier)
      )
    )
  );

const filteredEdges = allowedTypes
  ? edges.filter((e) => allowedTypes.includes(e.relationshipType))
  : edges;

// New
const edges = await db
  .select({ ... })
  .from(workspaceEdges)
  .where(
    and(
      eq(workspaceEdges.workspaceId, auth.workspaceId),
      or(
        inArray(workspaceEdges.sourceEntityId, entityFrontier),
        inArray(workspaceEdges.targetEntityId, entityFrontier)
      ),
      allowedTypes
        ? inArray(workspaceEdges.relationshipType, allowedTypes)
        : undefined
    )
  );

// Remove the JS filter — use `edges` directly instead of `filteredEdges`
collectedEdges.push(...edges);
```

Update the downstream references: replace `filteredEdges` with `edges` on the lines that iterate over filtered results (lines 124, 128).

#### 3. Optimize `related.ts`

**File**: `apps/console/src/lib/v1/related.ts`

**Change A — SELECT only needed columns from edges (lines 97-108)**

```typescript
// Old
const edges = await db
  .select()
  .from(workspaceEdges)
  ...

// New
const edges = await db
  .select({
    sourceEntityId: workspaceEdges.sourceEntityId,
    targetEntityId: workspaceEdges.targetEntityId,
    relationshipType: workspaceEdges.relationshipType,
    confidence: workspaceEdges.confidence,
  })
  .from(workspaceEdges)
  ...
```

**Change B — Fix `neighborEntityInfo` map clobber (lines 128-148)**

When an entity participates in multiple edges with different relationship types, only the last entry wins. Keep the highest-confidence one instead.

```typescript
// Old
for (const edge of edges) {
  const isSource = sourceEntitySet.has(edge.sourceEntityId);
  const isTarget = sourceEntitySet.has(edge.targetEntityId);

  if (isSource && !isTarget) {
    neighborEntityInfo.set(edge.targetEntityId, {
      relationshipType: edge.relationshipType,
      direction: "outgoing",
    });
  } else if (isTarget && !isSource) {
    neighborEntityInfo.set(edge.sourceEntityId, {
      relationshipType: edge.relationshipType,
      direction: "incoming",
    });
  }
}

// New
for (const edge of edges) {
  const isSource = sourceEntitySet.has(edge.sourceEntityId);
  const isTarget = sourceEntitySet.has(edge.targetEntityId);

  let neighborId: number | undefined;
  let direction: "outgoing" | "incoming" | undefined;

  if (isSource && !isTarget) {
    neighborId = edge.targetEntityId;
    direction = "outgoing";
  } else if (isTarget && !isSource) {
    neighborId = edge.sourceEntityId;
    direction = "incoming";
  }

  if (neighborId !== undefined && direction) {
    const existing = neighborEntityInfo.get(neighborId);
    if (!existing || edge.confidence > (existing.confidence ?? 0)) {
      neighborEntityInfo.set(neighborId, {
        relationshipType: edge.relationshipType,
        direction,
        confidence: edge.confidence,
      });
    }
  }
}
```

Update the `neighborEntityInfo` Map type to include `confidence`:
```typescript
const neighborEntityInfo = new Map<
  number,
  { relationshipType: string; direction: "outgoing" | "incoming"; confidence: number }
>();
```

**Change C — Dynamic `bySource` grouping (lines 233-238)**

```typescript
// Old
const bySource: Record<string, RelatedItem[]> = {
  github: related.filter((r) => r.source === "github"),
  vercel: related.filter((r) => r.source === "vercel"),
  sentry: related.filter((r) => r.source === "sentry"),
  linear: related.filter((r) => r.source === "linear"),
};

// Remove empty arrays
for (const key of Object.keys(bySource)) {
  if (bySource[key]?.length === 0) {
    delete bySource[key];
  }
}

// New
const bySource: Record<string, RelatedItem[]> = {};
for (const item of related) {
  const arr = bySource[item.source];
  if (arr) {
    arr.push(item);
  } else {
    bySource[item.source] = [item];
  }
}
```

This eliminates the post-loop cleanup, handles any provider name, and iterates the array once instead of 4+N times.

#### 4. Fix `observation-interpret.ts` — conflict guard + step merge

**File**: `api/console/src/inngest/workflow/neural/observation-interpret.ts`

**Change A — Add conflict guard on interpretation insert (line 362)**

The interpretation insert has no `onConflictDoNothing()`. On Inngest retry after step 6 succeeds but step 7 fails, the retry will re-run step 6 and throw a unique constraint violation on `(workspaceId, eventId, version)`, causing cascading retries.

```typescript
// Old
await db.insert(workspaceInterpretations).values({
  eventId: internalObservationId,
  workspaceId,
  version: 1,
  ...
});

// New
await db
  .insert(workspaceInterpretations)
  .values({
    eventId: internalObservationId,
    workspaceId,
    version: 1,
    ...
  })
  .onConflictDoNothing();
```

Using `onConflictDoNothing()` rather than `onConflictDoUpdate()` because on retry the existing row is identical — the same LLM classification and embeddings were produced in the same function invocation.

**Change B — Merge fetch-observation + fetch-workspace into one step (lines 126-170)**

Steps 1 and 2 are independent DB reads run as separate Inngest steps. Each step has serialization + network overhead. Merge into one.

```typescript
// Old (two steps)
const obs = await step.run("fetch-observation", async () => {
  const observation = await db.query.workspaceEvents.findFirst({
    where: eq(workspaceEvents.id, internalObservationId),
    ...
  });
  if (!observation) throw new NonRetriableError(...);
  return observation;
});

const workspace = await step.run("fetch-workspace", async () => {
  const ws = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
  });
  if (!ws) throw new NonRetriableError(...);
  return ws;
});

// New (one step, parallel queries)
const { obs, workspace } = await step.run("fetch-observation-and-workspace", async () => {
  const [observation, ws] = await Promise.all([
    db.query.workspaceEvents.findFirst({
      where: eq(workspaceEvents.id, internalObservationId),
      ...
    }),
    db.query.orgWorkspaces.findFirst({
      where: eq(orgWorkspaces.id, workspaceId),
    }),
  ]);
  if (!observation) throw new NonRetriableError(...);
  if (!ws) throw new NonRetriableError(...);
  return { obs: observation, workspace: ws };
});
```

#### 5. Guard `EVENT_REGISTRY` lookup in `scoring.ts`

**File**: `api/console/src/inngest/workflow/neural/scoring.ts:104-106`

The `as EventKey` cast at line 105 suppresses TypeScript's protection. If `sourceEvent.source` or `sourceEvent.sourceType` produces an unrecognized key (new provider, backfill data), `EVENT_REGISTRY[eventKey]` is `undefined` and `.weight` throws `TypeError`, crashing the scoring step and silently dropping the event after retry exhaustion.

```typescript
// Old
const eventKey =
  `${sourceEvent.source}:${sourceEvent.sourceType}` as EventKey;
let score = EVENT_REGISTRY[eventKey].weight;
factors.push(`base:${sourceEvent.source}:${sourceEvent.sourceType}`);

// New
const eventKey =
  `${sourceEvent.source}:${sourceEvent.sourceType}` as EventKey;
const registryEntry = EVENT_REGISTRY[eventKey];
let score = registryEntry?.weight ?? 0.3;
factors.push(`base:${sourceEvent.source}:${sourceEvent.sourceType}`);
```

Default weight of `0.3` (low significance) ensures unknown event types are processed rather than dropped.

#### 6. Add `workspaceId` filter to junction queries

Three junction table queries rely on upstream invariant for workspace scoping but have no defense-in-depth filter. Add explicit `workspaceId` guards.

**File**: `apps/console/src/lib/v1/graph.ts:85-88`
```typescript
// Old
const rootJunctions = await db
  .select({ entityId: workspaceEntityEvents.entityId })
  .from(workspaceEntityEvents)
  .where(eq(workspaceEntityEvents.eventId, rootObs.id));

// New
const rootJunctions = await db
  .select({ entityId: workspaceEntityEvents.entityId })
  .from(workspaceEntityEvents)
  .where(
    and(
      eq(workspaceEntityEvents.eventId, rootObs.id),
      eq(workspaceEntityEvents.workspaceId, auth.workspaceId)
    )
  );
```

Apply the same pattern to:
- `apps/console/src/lib/v1/graph.ts:144-151` — BFS junction query (add `workspaceId` to the `where`)
- `apps/console/src/lib/v1/related.ts:74-77` — source entity junction query
- `apps/console/src/lib/v1/related.ts:168-174` — neighbor entity junction query

Note: `entity-search.ts:115-122` also lacks this filter, but that file is touched in Phase 3. The fix will be applied there.

#### 7. Fix `sameSourceOnly` filter precedence in `findsimilar.ts`

**File**: `apps/console/src/lib/v1/findsimilar.ts:371-377`

If both `sameSourceOnly: true` and `filters.sourceTypes` are provided, the `$eq` constraint is silently overwritten by `$in`. `sameSourceOnly` should take precedence as the stricter filter.

```typescript
// Old
if (input.sameSourceOnly) {
  pineconeFilter.source = { $eq: sourceContent.source };
}

if (input.filters?.sourceTypes?.length) {
  pineconeFilter.source = { $in: input.filters.sourceTypes };
}

// New
if (input.sameSourceOnly) {
  pineconeFilter.source = { $eq: sourceContent.source };
} else if (input.filters?.sourceTypes?.length) {
  pineconeFilter.source = { $in: input.filters.sourceTypes };
}
```

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes: `npx turbo typecheck --force --filter=@lightfast/console --filter=@api/console`
- [ ] Linting passes: `pnpm check`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] `/v1/graph` returns correct entity-mediated graph
- [ ] `/v1/related` returns correct related events with proper relationship types
- [ ] Edge resolver creates entity↔entity edges on webhook ingress
- [ ] Interpretation retry (cancel + re-trigger in Inngest dashboard) does not throw unique constraint error
- [ ] Unknown event type (e.g., backfill data with new `sourceType`) does not crash scoring step

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 3: Alias Cleanup + Lint Fixes

### Overview
Rename select-shape aliases from `observationId: table.eventId` → `eventId: table.eventId` in 7 files, cascade to downstream JS variables, add `workspaceId` filter to `entity-search.ts` junction query, and fix all lint errors. No logic changes beyond the `entity-search.ts` filter addition.

### What's In Scope vs Out of Scope for `observationId`

**In scope** (internal DB-to-JS aliases representing internal bigint event IDs):
- Select-shape aliases: `observationId: workspaceEntityEvents.eventId` → `eventId: workspaceEntityEvents.eventId`
- Downstream JS variables: `j.observationId` → `j.eventId`, `interp.observationId` → `interp.eventId`
- Local variable names: `observationIds` → `eventIds`, `obsInternalIds` → `eventInternalIds`
- Map key names: `relatedObsInfo` → `relatedEventInfo`, `internalToExternal` stays (generic name)

**Out of scope** (external-facing API contracts):
- `EntitySearchResult.observationId` (Zod schema in `console-validation/src/schemas/entities.ts:95`)
- `NormalizedMatch.observationId` (interface in `findsimilar.ts:36`)
- `input.observationId` (API input parameter in `graph.ts:14`, `related.ts:13`)
- `match.metadata?.observationId` (Pinecone metadata field)
- `entity.observationId`, `entity.observationTitle`, `entity.observationSnippet` (fields on `EntitySearchResult`)
- Comments and JSDoc referencing "observation" as a concept

### Changes Required

#### 1. `apps/console/src/lib/v1/graph.ts`

Select alias rename (line 147):
```typescript
// Old
observationId: workspaceEntityEvents.eventId,
// New
eventId: workspaceEntityEvents.eventId,
```

Cascade to downstream variables (lines 153-157):
- `j.observationId` → `j.eventId`
- `allEventIds.add(j.observationId)` → `allEventIds.add(j.eventId)`
- `existing.push(j.observationId)` → `existing.push(j.eventId)`

#### 2. `apps/console/src/lib/v1/related.ts`

Select alias rename (line 171):
```typescript
// Old
observationId: workspaceEntityEvents.eventId,
// New
eventId: workspaceEntityEvents.eventId,
```

Cascade to downstream variables (lines 176-187):
- Map name: `relatedObsInfo` → `relatedEventInfo` (lines 177, 182, 186-187, 192)
- `j.observationId` → `j.eventId` (lines 182, 186, 187)
- `relatedObsIds` → `relatedEventIds` (line 192)
- `relatedObs` → `relatedEvents` is tempting but touches the response builder too broadly — keep as-is

#### 3. `apps/console/src/lib/neural/entity-search.ts`

Select alias rename (line 118):
```typescript
// Old
observationId: workspaceEntityEvents.eventId,
// New
eventId: workspaceEntityEvents.eventId,
```

Cascade to downstream variables (lines 129, 138, 147):
- `j.observationId` → `j.eventId`
- `observationIds` → `eventIds`
- `obsMap.get(junction.observationId)` → `obsMap.get(junction.eventId)`

**Add `workspaceId` filter to junction query (line 121):**
```typescript
// Old
.where(inArray(workspaceEntityEvents.entityId, entityIds))

// New
.where(
  and(
    inArray(workspaceEntityEvents.entityId, entityIds),
    eq(workspaceEntityEvents.workspaceId, workspaceId)
  )
)
```

Requires adding `and, eq` to the `drizzle-orm` import if not already present.

#### 4. `apps/console/src/lib/neural/four-path-search.ts`

Interpretation select alias rename (line 138):
```typescript
// Old
observationId: workspaceInterpretations.eventId,
// New
eventId: workspaceInterpretations.eventId,
```

Cascade (lines 157, 168, 190):
- `i.observationId` → `i.eventId`
- `obsInternalIds` → `eventInternalIds`
- `internalToExternal.get(interp.observationId)` → `internalToExternal.get(interp.eventId)`

Junction select alias rename (line 602):
```typescript
// Old
observationId: workspaceEntityEvents.eventId,
// New
eventId: workspaceEntityEvents.eventId,
```

Cascade (line 628):
- `internalToExternalMap.get(junction.observationId)` → `internalToExternalMap.get(junction.eventId)`

#### 5. `apps/console/src/lib/neural/id-resolver.ts`

Select alias rename (line 239):
```typescript
// Old
observationId: workspaceInterpretations.eventId,
// New
eventId: workspaceInterpretations.eventId,
```

Cascade (lines 271, 281, 295):
- `interpretations.map((i) => i.observationId)` → `interpretations.map((i) => i.eventId)`
- `obsById.get(interp.observationId)` → `obsById.get(interp.eventId)`

#### 6. `apps/console/src/lib/v1/findsimilar.ts`

Select alias rename (line 99):
```typescript
// Old
observationId: workspaceInterpretations.eventId,
// New
eventId: workspaceInterpretations.eventId,
```

Cascade (lines 118, 136):
- `interpretations.map((i) => i.observationId)` → `interpretations.map((i) => i.eventId)`
- `internalToExternal.get(interp.observationId)` → `internalToExternal.get(interp.eventId)`

#### 7. Fix all lint errors

After all renames are complete, run auto-fix:
```bash
pnpm check --write
```

This fixes:
- 4 unsorted imports (`entity-search.ts`, `four-path-search.ts`, `url-resolver.ts`, `findsimilar.ts`)
- 6 formatting issues (`four-path-search.ts`, `id-resolver.ts`, `findsimilar.ts`, `graph.ts`, `workspace-events.ts`, `reconcile-pinecone-external-ids.ts`)

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes (full, no cache): `npx turbo typecheck --force`
- [ ] Linting passes: `pnpm check`
- [ ] Build succeeds: `pnpm build:console`
- [ ] Zero select-shape aliases remain: `grep -rn "observationId.*workspaceEntityEvents\.\|observationId.*workspaceInterpretations\." --include="*.ts" apps/ packages/ | grep -v "node_modules\|migrations/"` returns zero matches

#### Manual Verification:
- [ ] `/v1/search` and `/v1/findsimilar` return correct results
- [ ] Full pipeline end-to-end: webhook → event-store → event-interpret → edge-resolve → graph query

---

## Testing Strategy

### Automated:
```bash
pnpm check && npx turbo typecheck --force
pnpm build:console

# Verify zero select-shape aliases
grep -rn "observationId.*workspaceEntityEvents\.\|observationId.*workspaceInterpretations\." --include="*.ts" apps/ packages/ | grep -v "node_modules\|migrations/"
```

### Manual:
1. Send GitHub push webhook → verify event stored + entities created
2. Send Vercel deployment with same commit → verify `deploys` edge in `workspace_edges`
3. `/v1/graph` with `allowedTypes` filter → verify only matching edges returned
4. `/v1/related` → verify `bySource` includes correct providers and relationship types
5. Verify search/findsimilar/graph/related all return data
6. Re-trigger an interpretation in Inngest dashboard → verify no unique constraint error
7. Send a webhook with an unregistered `sourceType` → verify it processes with default significance (not crash)

## Performance Considerations

- **SELECT column projection**: Eliminates JSONB `metadata` deserialization on every graph/related query. Reduces wire bytes by ~60% for edge fetches.
- **DB-side `allowedTypes` filter**: Reduces BFS frontier size when filtering by type, cascading to fewer junction queries in subsequent levels.
- **Promise.all in edge-resolver**: Eliminates one DB round-trip per `resolveEdges` call (~5-20ms saved per event).
- **Memoized `getEdgeRules`**: Reduces O(P×N) to O(P+N) where P = provider count, N = co-occurring events.
- **Dynamic `bySource`**: Single-pass O(N) instead of 4-pass O(4N) + cleanup.
- **Inngest step merge**: Eliminates one step serialization round trip on the interpretation slow path (~50-200ms saved per event).
- **Conflict guard**: Prevents cascading retry failures on interpretation step — changes retry from "always fail again" to "succeed silently".
- **`EVENT_REGISTRY` guard**: Prevents event loss on unknown event types — processes with default significance instead of crashing.
- **`workspaceId` filter on junctions**: Defense-in-depth for multi-tenant data isolation. Marginal query cost (column is already indexed).

## Migration Notes

- Phase 1 generates a migration for the duplicate index removal. Review the generated SQL to confirm it drops only the inline constraint, not the named index.
- No data migration needed — pre-production, tables are empty.
- Phase 3 is pure rename + lint fixes — no DB changes, no import changes.

## References

- Pipeline restructure v2 plan: `thoughts/shared/plans/2026-03-12-pipeline-restructure-v2.md`
- Research document: `thoughts/shared/research/2026-03-12-pipeline-restructure-v2.md`

## Update Log

### 2026-03-12 — Reflect completed import renames, add observation-interpret optimizations
- **Trigger**: Validation discovered all 9 consumer files already have new import names; only `.observationId` → `.eventId` column accessor fixes remain. Also found missing conflict guard and sequential step issue in `observation-interpret.ts`.
- **Changes**:
  - Removed all import rename work from Phases 2 and 3 (already done)
  - Phase 2 now focused purely on optimizations across 4 files (added `observation-interpret.ts`)
  - Phase 3 reduced from "7 file mechanical rename" to "5 file column accessor fix"
  - Added `observation-interpret.ts` conflict guard (correctness) and step merge (performance)
  - Updated Current State Analysis with exact typecheck error table
- **Impact on remaining work**: Significantly reduced scope — ~60% less mechanical work, more focus on quality optimizations.

### 2026-03-12 — Reclassify Phase 3 for alias cleanup, add code quality fixes
- **Trigger**: Re-validation discovered all `.observationId` column accessors are already fixed (`npx turbo typecheck --force` passes 43/43). The remaining issue is select-shape aliases (e.g., `observationId: workspaceEntityEvents.eventId`) and downstream JS variables. Code quality audit also identified 3 critical issues in files Phase 2 already touches.
- **Changes**:
  - Updated Current State Analysis: removed stale error table, added alias + lint error tables
  - Phase 2: added 3 new items:
    - §5: `EVENT_REGISTRY` guard in `scoring.ts` (prevents event loss on unknown types)
    - §6: `workspaceId` filter on junction queries in `graph.ts`/`related.ts` (data isolation)
    - §7: `sameSourceOnly` precedence fix in `findsimilar.ts` (correctness)
  - Phase 3: fully rewritten from "column accessor fixes" to "alias cleanup + lint":
    - 7 select-shape aliases renamed `observationId → eventId`
    - Cascading JS variable renames with explicit in-scope/out-of-scope boundary
    - `entity-search.ts` junction `workspaceId` filter added (same pattern as Phase 2 §6)
    - Lint auto-fix (`pnpm check --write`) for 10 errors across 7 files
  - Updated "What We're NOT Doing" with 8 items from code quality audit (deferred to separate scope)
  - Renamed plan title from "Column Accessor Migration" to "Alias Cleanup" to reflect actual scope
- **Impact on remaining work**: Phase 2 grows by 3 small targeted fixes (same files). Phase 3 is now alias renames + lint — simpler than the original column accessor migration since there are no type errors to fix.
