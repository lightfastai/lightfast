# Pipeline Optimizations + Column Accessor Migration

## Overview

Apply 8 performance and correctness optimizations to the entity-edge pipeline, fix the duplicate schema constraint on `workspace_edges`, and complete the `.observationId` → `.eventId` column accessor migration on 5 remaining files. These changes land on `feat/backfill-depth-entitytypes-run-tracking` before the Phase 6 Inngest rename.

Based on validation: this conversation's validation report.
Extends: `thoughts/shared/plans/2026-03-12-pipeline-restructure-v2.md`

## Current State Analysis

Phase 5 import renames are **fully complete**:
- All 4 table files renamed (`workspace-entities.ts`, `workspace-entity-events.ts`, `workspace-events.ts`, `workspace-interpretations.ts`)
- Barrel exports (`tables/index.ts`, `schema/index.ts`, `db/console/src/index.ts`) use new names exclusively
- Relations file uses new names and new column accessors (`.eventId` not `.observationId`)
- **All 9 consumer files already import new names** (`workspaceEvents`, `workspaceEntities`, `workspaceEntityEvents`, `workspaceInterpretations`)
- `edge-resolver.ts`, `observation-store.ts`, `observation-interpret.ts` are clean — zero type errors

**5 files still reference `.observationId` on renamed columns** (`workspaceEntityEvents.eventId`, `workspaceInterpretations.eventId`):

| File | Error | Line |
|---|---|---|
| `apps/console/src/lib/neural/entity-search.ts` | `.observationId` on `workspaceEntityEvents` | 118 |
| `apps/console/src/lib/neural/four-path-search.ts` | `.observationId` on `workspaceInterpretations` | 138 |
| `apps/console/src/lib/neural/four-path-search.ts` | `.observationId` on `workspaceEntityEvents` | 613 |
| `apps/console/src/lib/neural/four-path-search.ts` | `.observationId` on `workspaceEntityEvents` | 618 |
| `apps/console/src/lib/neural/id-resolver.ts` | `observationId` column select on `workspaceInterpretations` | 126 |
| `apps/console/src/lib/neural/id-resolver.ts` | `.observationId` on interpretation result | 153 |
| `apps/console/src/lib/neural/id-resolver.ts` | `.observationId` on `workspaceInterpretations` | 242 |
| `apps/console/src/lib/v1/findsimilar.ts` | `.observationId` on `workspaceInterpretations` | 99 |
| `packages/console-test-data/src/cli/reconcile-pinecone-external-ids.ts` | `.observationId` on `workspaceInterpretations` | 115 |

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

## Desired End State

- All `.observationId` column accessors migrated to `.eventId`
- `workspace_edges` has exactly one unique constraint on `external_id` (not two)
- Edge queries in `graph.ts` and `related.ts` select only consumed columns
- `allowedTypes` filter pushed to DB WHERE clause
- Edge resolver parallelizes independent queries and memoizes provider lookups
- `bySource` grouping derived dynamically from data
- Multi-edge entities preserve highest-confidence relationship info
- Interpretation insert is idempotent on Inngest retry
- `observation-interpret.ts` merges independent DB reads into one Inngest step
- `npx turbo typecheck --force` passes with zero errors
- `pnpm check` and `pnpm build:console` pass

### Verification
```bash
pnpm check && npx turbo typecheck --force
pnpm build:console

# Zero matches for old names outside migration files
grep -r "workspaceNeuralObservations\|workspaceNeuralEntities\|workspaceEntityObservations\|workspaceObservationInterpretations" --include="*.ts" apps/ api/ packages/ db/console/src/ | grep -v "node_modules\|migrations/"
```

## What We're NOT Doing

- Phase 6 Inngest event/function ID renames (separate scope)
- Inngest file renames (`observation-store.ts` → `event-store.ts`, etc.)
- API response shape changes
- New indexes or query plan analysis
- `EntityCategory` Zod schema change
- Recursive CTE rewrite for graph BFS (future optimization)
- Shared `normalizeVectorMatches` extraction from findsimilar/four-path-search (future cleanup)

## Implementation Approach

3 phases. Phase 1 is schema cleanup (generates a migration). Phase 2 applies performance and correctness optimizations to 4 key pipeline files. Phase 3 fixes the remaining `.observationId` → `.eventId` column accessors on 5 files.

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
Apply 8 performance/correctness optimizations to `edge-resolver.ts`, `graph.ts`, `related.ts`, and `observation-interpret.ts`. These are the highest-traffic pipeline files. Import renames are already complete on all files — this phase is optimizations only.

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

Imports are already correct (`workspaceEvents`, `workspaceEntityEvents`, `workspaceEdges`). This phase applies optimizations only.

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

Imports are already correct. This phase applies optimizations only.

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

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 3: Fix Column Accessor Renames

### Overview
Fix the remaining `.observationId` → `.eventId` column accessor references on 5 files. Import names are already correct — only column property access needs updating. No logic changes.

### Changes Required

#### Accessor rename (applied to all files below):
- `.observationId` → `.eventId` (on `workspaceEntityEvents` and `workspaceInterpretations` table accessors)
- `{ observationId: true }` → `{ eventId: true }` (in Drizzle column selection objects)
- Local variables named `observationId` that receive junction/interpretation column values → `eventId`

#### 1. `apps/console/src/lib/neural/entity-search.ts`
- Line 118: `workspaceEntityEvents.observationId` → `workspaceEntityEvents.eventId`
- Any local variables receiving this value (e.g., `j.observationId` → `j.eventId`)

#### 2. `apps/console/src/lib/neural/four-path-search.ts`
- Line 138: `workspaceInterpretations.observationId` → `workspaceInterpretations.eventId`
- Line 613: `workspaceEntityEvents.observationId` → `workspaceEntityEvents.eventId`
- Line 618: `workspaceEntityEvents.observationId` → `workspaceEntityEvents.eventId`
- Any local variables receiving these values

#### 3. `apps/console/src/lib/neural/id-resolver.ts`
- Line 126: `{ observationId: true }` → `{ eventId: true }` in column selection
- Line 153: `interp.observationId` → `interp.eventId`
- Line 242: `workspaceInterpretations.observationId` → `workspaceInterpretations.eventId`
- Any local variables receiving these values (e.g., `i.observationId` → `i.eventId`)

#### 4. `apps/console/src/lib/v1/findsimilar.ts`
- Line 99: `workspaceInterpretations.observationId` → `workspaceInterpretations.eventId`
- Any local variables receiving this value (e.g., `interp.observationId` → `interp.eventId`)

#### 5. `packages/console-test-data/src/cli/reconcile-pinecone-external-ids.ts`
- Line 115: `workspaceInterpretations.observationId` → `workspaceInterpretations.eventId`

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes (full, no cache): `npx turbo typecheck --force`
- [ ] Linting passes: `pnpm check`
- [ ] Build succeeds: `pnpm build:console`
- [ ] Zero old column accessors remain: `grep -rn "\.observationId" --include="*.ts" apps/console/src/lib/ packages/console-test-data/ | grep -v "node_modules\|migrations/"` returns only log/metadata fields, no Drizzle column accesses

#### Manual Verification:
- [ ] `/v1/search` and `/v1/findsimilar` return correct results
- [ ] Full pipeline end-to-end: webhook → event-store → event-interpret → edge-resolve → graph query

---

## Testing Strategy

### Automated:
```bash
pnpm check && npx turbo typecheck --force
pnpm build:console

# Verify zero old table name identifiers
grep -r "workspaceNeuralObservations\|workspaceNeuralEntities\|workspaceEntityObservations\|workspaceObservationInterpretations" --include="*.ts" apps/ api/ packages/ db/console/src/ | grep -v "node_modules\|migrations/"
```

### Manual:
1. Send GitHub push webhook → verify event stored + entities created
2. Send Vercel deployment with same commit → verify `deploys` edge in `workspace_edges`
3. `/v1/graph` with `allowedTypes` filter → verify only matching edges returned
4. `/v1/related` → verify `bySource` includes correct providers and relationship types
5. Verify search/findsimilar/graph/related all return data
6. Re-trigger an interpretation in Inngest dashboard → verify no unique constraint error

## Performance Considerations

- **SELECT column projection**: Eliminates JSONB `metadata` deserialization on every graph/related query. Reduces wire bytes by ~60% for edge fetches.
- **DB-side `allowedTypes` filter**: Reduces BFS frontier size when filtering by type, cascading to fewer junction queries in subsequent levels.
- **Promise.all in edge-resolver**: Eliminates one DB round-trip per `resolveEdges` call (~5-20ms saved per event).
- **Memoized `getEdgeRules`**: Reduces O(P×N) to O(P+N) where P = provider count, N = co-occurring events.
- **Dynamic `bySource`**: Single-pass O(N) instead of 4-pass O(4N) + cleanup.
- **Inngest step merge**: Eliminates one step serialization round trip on the interpretation slow path (~50-200ms saved per event).
- **Conflict guard**: Prevents cascading retry failures on interpretation step — changes retry from "always fail again" to "succeed silently".

## Migration Notes

- Phase 1 generates a migration for the duplicate index removal. Review the generated SQL to confirm it drops only the inline constraint, not the named index.
- No data migration needed — pre-production, tables are empty.
- Phase 3 is pure column accessor renames — no DB changes, no import changes.

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
