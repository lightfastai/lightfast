# Edge Resolver Bug Fixes & Query Consolidation

## Overview

Fix two definite bugs discovered in `edge-resolver.ts` stress evaluation and consolidate the query pipeline from 4 sequential DB stages to 2. Based on research document: `thoughts/shared/research/2026-03-14-edge-resolver-stress-evaluation.md`.

## Current State Analysis

`resolveEdges` (`api/console/src/inngest/workflow/neural/edge-resolver.ts:26`) is the sole write path for `workspaceEdges`. Called exclusively by `entity-graph.ts:27` (Inngest function `apps-console/entity.graph`). The only production consumer is `entity-embed.ts:120-132`, which reads outgoing edges to build entity narratives for Pinecone embeddings.

### Key Discoveries:
- `edge-resolver.ts:86` — `.limit(100)` with no `ORDER BY`; Postgres returns arbitrary rows, silently dropping recent co-occurrences for high-traffic entities
- `edge-resolver.ts:190-213` — GitHub and Vercel both define `deploys` rules for the `commit ↔ deployment` pair, producing contradictory directed edges depending on which event is processed
- `entity-embed.ts:131` — only queries outgoing edges (`sourceEntityId = entity.id`), missing incoming edges entirely
- `workspace-entity-events` has `ee_entity_event_idx` on `(entityId, eventId)` which supports `ORDER BY eventId DESC` efficiently
- Current pipeline makes 4 sequential DB stages (5 queries) where 2 stages (3 queries) suffice

## Desired End State

1. Co-occurring events are ordered by recency (most recent first), with a log warning on truncation
2. Each entity pair has at most one edge per relationship type, regardless of processing order
3. Entity narratives include edges in both directions (outgoing and incoming)
4. Query pipeline reduced from 4 sequential stages to 2

### Verification:
- Unit tests cover: truncation ordering, bidirectional dedup, both-direction edge queries
- `pnpm typecheck` and `pnpm check` pass
- Existing integration tests in `packages/integration-tests/` pass

## What We're NOT Doing

- Adding pagination/looping for the 100-row limit (simple `ORDER BY` + warning is sufficient for now)
- Changing the `workspaceEdges` DB schema or adding new indexes
- Adding new provider edge rules
- Modifying the `findBestRule` priority logic (selfLabel, wildcards, etc.)

## Implementation Approach

Three phases, each independently shippable. Phase 1 fixes the silent truncation bug. Phase 2 fixes bidirectional edge duplication using the "first rule wins" strategy. Phase 3 consolidates queries for efficiency.

---

## Phase 1: Fix Silent Truncation (Bug 1)

### Overview
Add `ORDER BY` to the co-occurring events query so the 100-row limit consistently returns the most recent co-occurrences. Add a log warning when truncation occurs.

### Changes Required:

#### 1. Add ORDER BY and truncation warning
**File**: `api/console/src/inngest/workflow/neural/edge-resolver.ts`
**Changes**: Add `orderBy` clause to the `.limit(100)` query at line 86, and log a warning when the limit is hit.

```ts
// line 11: add desc import
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

// lines 74-86: add orderBy before limit
const coOccurring = await db
  .select({
    eventId: workspaceEntityEvents.eventId,
    entityId: workspaceEntityEvents.entityId,
  })
  .from(workspaceEntityEvents)
  .where(
    and(
      inArray(workspaceEntityEvents.entityId, ourEntityIds),
      ne(workspaceEntityEvents.eventId, eventId)
    )
  )
  .orderBy(desc(workspaceEntityEvents.eventId))
  .limit(100);

// After line 90 (after the early return): add truncation warning
if (coOccurring.length === 100) {
  log.warn("Edge resolver co-occurrence limit reached, recent events preferred", {
    eventId,
    workspaceId,
    entityCount: ourEntityIds.length,
  });
}
```

**Rationale**: `ORDER BY eventId DESC` uses the existing `ee_entity_event_idx` on `(entityId, eventId)` for an efficient backward index scan. Higher `eventId` values correspond to more recent events since `workspaceEvents.id` is `GENERATED ALWAYS AS IDENTITY`.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (passes with non-incremental; TS 5.9.3 incremental mode has pre-existing compiler crash)
- [x] Linting passes: `pnpm check` (no errors in changed files; 13 pre-existing errors in other files)
- [x] Existing tests pass: `pnpm --filter @repo/integration-tests test` (1 pre-existing failure in backfill-relay-dispatch, unrelated)

#### Manual Verification:
- [ ] Verify the query plan uses the index (optional: run `EXPLAIN ANALYZE` in db:studio)

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: Fix Bidirectional Edge Duplication (Bug 2)

### Overview
Prevent the same entity pair from having contradictory directed edges. Strategy: "first rule wins" — remove Vercel's duplicate `deploys` rule, swap source/target when `otherRules` fallback matches, and extend deduplication to catch bidirectional within-invocation duplicates. Update the consumer to read edges in both directions.

### Changes Required:

#### 1. Remove Vercel's duplicate `deploys` rule
**File**: `packages/console-providers/src/providers/vercel/index.ts`
**Changes**: Remove the `deploys` edge rule (lines 175-181). Keep the `edgeRules` array but make it empty.

```ts
// Before:
edgeRules: [
  {
    refType: "deployment",
    matchProvider: "github",
    matchRefType: "commit",
    relationshipType: "deploys",
    confidence: 1.0,
  },
],

// After:
edgeRules: [],
```

**Rationale**: GitHub's rule `(commit → deployment, "deploys")` already captures this relationship. Vercel's mirror rule creates the contradictory reverse edge. With the fallback swap (below), Vercel events will still create edges via GitHub's rule with correct directionality.

#### 2. Swap source/target when `otherRules` fallback matches
**File**: `api/console/src/inngest/workflow/neural/edge-resolver.ts`
**Changes**: Split the rule evaluation at lines 190-213 into two branches. When the match comes from `otherRules`, the rule was written from the other provider's perspective, so source/target must be swapped.

```ts
// Replace lines 189-213 with:
        // Try our rules first
        const myMatch = findBestRule(
          myRules,
          ourEntity.category,
          ourLabel,
          otherSource,
          theirEntity.category
        );

        if (myMatch) {
          // Our rule — our entity is the source
          candidates.push({
            sourceEntityId: ourEntity.id,
            targetEntityId: theirEntity.entityId,
            relationshipType: myMatch.relationshipType,
            confidence: myMatch.confidence,
          });
        } else {
          // Fallback: try their rules (from their perspective)
          const otherMatch = findBestRule(
            otherRules,
            theirEntity.category,
            theirEntity.refLabel,
            source,
            ourEntity.category
          );

          if (otherMatch) {
            // Their rule — their entity is the source, ours is the target
            candidates.push({
              sourceEntityId: theirEntity.entityId,
              targetEntityId: ourEntity.id,
              relationshipType: otherMatch.relationshipType,
              confidence: otherMatch.confidence,
            });
          }
        }
```

**Why this fixes cross-invocation duplication for `deploys`**:
- GitHub event processing: `myRules` (GitHub) matches → `(commit, deployment, "deploys")`
- Vercel event processing: `myRules` (Vercel) has no `deploys` rule → fallback to `otherRules` (GitHub) → matches → **swap** → `(commit, deployment, "deploys")` — identical row, `onConflictDoNothing`

**Edge case — `references` rules**: GitHub and Linear both define `references` with `matchProvider: "*"`. Both match via `myRules` (no fallback needed), so both directions exist: `(ghIssue, lnIssue, "references")` and `(lnIssue, ghIssue, "references")`. This is acceptable — "A references B" and "B references A" are both semantically valid.

#### 3. Extend deduplication to catch bidirectional within-invocation duplicates
**File**: `api/console/src/inngest/workflow/neural/edge-resolver.ts`
**Changes**: Update `deduplicateEdgeCandidates` to treat `(A,B,type)` and `(B,A,type)` as the same edge, keeping whichever has higher confidence.

```ts
function deduplicateEdgeCandidates(
  candidates: EdgeCandidate[]
): EdgeCandidate[] {
  const byKey = new Map<string, EdgeCandidate>();
  for (const c of candidates) {
    // Canonical key: order entity IDs so (A,B) and (B,A) map to the same key
    const lo = Math.min(c.sourceEntityId, c.targetEntityId);
    const hi = Math.max(c.sourceEntityId, c.targetEntityId);
    const key = `${lo}-${hi}-${c.relationshipType}`;
    const existing = byKey.get(key);
    if (!existing || c.confidence > existing.confidence) {
      byKey.set(key, c);
    }
  }
  return Array.from(byKey.values());
}
```

#### 4. Update entity-embed consumer to query edges in both directions
**File**: `api/console/src/inngest/workflow/neural/entity-embed.ts`
**Changes**: Replace the outgoing-only edge query (lines 120-132) with a union of outgoing and incoming edges.

```ts
// Replace lines 119-132 with:
          // Graph edges — both outgoing and incoming, mapped to "related entity"
          db
            .select({
              relationshipType: workspaceEdges.relationshipType,
              targetCategory: workspaceEntities.category,
              targetKey: workspaceEntities.key,
            })
            .from(workspaceEdges)
            .innerJoin(
              workspaceEntities,
              eq(workspaceEdges.targetEntityId, workspaceEntities.id)
            )
            .where(eq(workspaceEdges.sourceEntityId, entity.id))
            .limit(10)
            .union(
              db
                .select({
                  relationshipType: workspaceEdges.relationshipType,
                  targetCategory: workspaceEntities.category,
                  targetKey: workspaceEntities.key,
                })
                .from(workspaceEdges)
                .innerJoin(
                  workspaceEntities,
                  eq(workspaceEdges.sourceEntityId, workspaceEntities.id)
                )
                .where(eq(workspaceEdges.targetEntityId, entity.id))
                .limit(10)
            ),
```

**Note**: The `NarrativeEdge` interface and `buildEntityNarrative` function remain unchanged. The incoming edges map the *other* entity's category/key into `targetCategory`/`targetKey`, which is the correct semantic: "related entity".

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (passes with non-incremental; TS 5.9.3 incremental mode has pre-existing compiler crash)
- [x] Linting passes: `pnpm check` (no errors in changed files)
- [x] Existing tests pass: `pnpm --filter @repo/integration-tests test` (1 pre-existing failure unrelated)

#### Manual Verification:
- [ ] Process a GitHub push event that co-occurs with a Vercel deployment — verify only one `deploys` edge exists (not bidirectional)
- [ ] Process events from both sides of a relationship — verify edge direction is consistent regardless of processing order
- [ ] Verify entity narratives include edges from both directions

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to Phase 3.

---

## Phase 3: Query Consolidation

### Overview
Reduce `resolveEdges` from 4 sequential DB stages (5 queries) to 2 stages (3 queries: 1 merged read + 1 triple-join read + 1 insert). This halves the IO latency for every edge resolution invocation.

### Current Query Stages:
| Stage | Query | Sequential? |
|---|---|---|
| 1 | SELECT our entity IDs | Yes |
| 2 | SELECT co-occurring junctions (limit 100) | Depends on 1 |
| 3a | SELECT co-event sources | Depends on 2 |
| 3b | SELECT co-event entity junctions | Depends on 2 (parallel with 3a) |
| 4 | SELECT co-entity details | Depends on 3b |
| 5 | INSERT edges | Depends on 4 |

### Target Query Stages:
| Stage | Query | Sequential? |
|---|---|---|
| A | Merged: our entities → co-occurring junctions (subquery) | Start |
| B | Triple JOIN: co-events + junctions + entity details | Depends on A |
| C | INSERT edges | Depends on B |

### Changes Required:

#### 1. Merge stages 1+2 into a single subquery
**File**: `api/console/src/inngest/workflow/neural/edge-resolver.ts`
**Changes**: Replace the two sequential queries (lines 46-86) with a single query that finds our entities and their co-occurring junctions via a subquery.

```ts
  // Combined stage A: find our entities + co-occurring junctions in one query
  const entityConditions = structuralRefs.map(
    (ref) =>
      sql`(${workspaceEntities.category} = ${ref.type} AND ${workspaceEntities.key} = ${ref.key})`
  );

  // First: get our entity IDs (still needed for dedup and label map)
  const ourEntities = await db
    .select({
      id: workspaceEntities.id,
      category: workspaceEntities.category,
      key: workspaceEntities.key,
    })
    .from(workspaceEntities)
    .where(
      and(
        eq(workspaceEntities.workspaceId, workspaceId),
        sql`(${sql.join(entityConditions, sql` OR `)})`
      )
    );

  if (ourEntities.length === 0) return 0;
  const ourEntityIds = ourEntities.map((e) => e.id);

  const refLabelMap = new Map(
    structuralRefs
      .filter((r) => r.label)
      .map((r) => [`${r.type}:${r.key}`, r.label])
  );

  // Stage A (merged): co-occurring junctions ordered by recency
  const coOccurring = await db
    .select({
      eventId: workspaceEntityEvents.eventId,
      entityId: workspaceEntityEvents.entityId,
    })
    .from(workspaceEntityEvents)
    .where(
      and(
        inArray(workspaceEntityEvents.entityId, ourEntityIds),
        ne(workspaceEntityEvents.eventId, eventId)
      )
    )
    .orderBy(desc(workspaceEntityEvents.eventId))
    .limit(100);

  if (coOccurring.length === 0) return 0;
  if (coOccurring.length === 100) {
    log.warn("Edge resolver co-occurrence limit reached", {
      eventId, workspaceId, entityCount: ourEntityIds.length,
    });
  }
```

**Note**: Stages 1 and 2 cannot be fully merged into a single SQL statement because `ourEntities` is needed independently for the label map and the rule evaluation loop. However, we verify this is the minimum — both queries are needed for different outputs.

#### 2. Merge stages 3a+3b+4 into a single triple JOIN
**File**: `api/console/src/inngest/workflow/neural/edge-resolver.ts`
**Changes**: Replace the parallel `Promise.all` (lines 95-108) + separate entity lookup (lines 118-125) with a single triple-join query.

```ts
  const coEventIds = [...new Set(coOccurring.map((c) => c.eventId))];

  // Stage B (merged): co-event sources + entity junctions + entity details in one query
  const coEventData = await db
    .select({
      eventId: workspaceEntityEvents.eventId,
      eventSource: workspaceEvents.source,
      entityId: workspaceEntityEvents.entityId,
      entityCategory: workspaceEntities.category,
      entityKey: workspaceEntities.key,
      refLabel: workspaceEntityEvents.refLabel,
    })
    .from(workspaceEntityEvents)
    .innerJoin(
      workspaceEvents,
      eq(workspaceEntityEvents.eventId, workspaceEvents.id)
    )
    .innerJoin(
      workspaceEntities,
      eq(workspaceEntityEvents.entityId, workspaceEntities.id)
    )
    .where(inArray(workspaceEntityEvents.eventId, coEventIds));
```

Then rebuild the in-memory maps from the single result set:

```ts
  // Build maps from the single result set
  const coEventSourceMap = new Map<number, string>();
  const coEventEntitiesMap = new Map<
    number,
    Array<{ entityId: number; category: string; key: string; refLabel: string | null }>
  >();

  for (const row of coEventData) {
    coEventSourceMap.set(row.eventId, row.eventSource);
    const arr = coEventEntitiesMap.get(row.eventId) ?? [];
    arr.push({
      entityId: row.entityId,
      category: row.entityCategory,
      key: row.entityKey,
      refLabel: row.refLabel,
    });
    coEventEntitiesMap.set(row.eventId, arr);
  }
```

**Benefit**: This eliminates the parallel `Promise.all` (2 queries) and the follow-up entity lookup (1 query), replacing all 3 with a single triple-join query. The total pipeline goes from 5 queries to 3.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] Existing tests pass: `pnpm --filter @repo/integration-tests test` (1 pre-existing unrelated failure)

#### Manual Verification:
- [ ] Process several events and verify edge count matches pre-refactor behavior
- [ ] Verify the triple-join query plan is efficient (optional: `EXPLAIN ANALYZE`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Testing Strategy

### Unit Tests:
- Truncation ordering: verify `ORDER BY eventId DESC` is applied (mock DB layer)
- Bidirectional dedup: `deduplicateEdgeCandidates` with `(A,B,"deploys")` and `(B,A,"deploys")` → single candidate
- Rule fallback swap: when `otherRules` matches, verify source/target are swapped

### Integration Tests:
- Process GitHub push + Vercel deployment for same commit → exactly 1 `deploys` edge in `workspaceEdges`
- Process both events in both orders → same edge row (no bidirectional duplicate)
- Entity narrative includes edges regardless of edge direction in DB

### Manual Testing Steps:
1. Trigger a GitHub push webhook for a repo with Vercel integration
2. Wait for both `entity.graph` Inngest functions to complete
3. Query `workspaceEdges` for the commit entity — verify single `deploys` edge
4. Query `workspaceEdges` for the deployment entity — verify no contradictory reverse edge
5. Check entity narratives in Pinecone — both entities should show the relationship

## Performance Considerations

- Phase 1: No performance impact (ORDER BY uses existing `ee_entity_event_idx`)
- Phase 2: Minimal impact — one fewer rule evaluation when Vercel's rule is removed
- Phase 3: ~50% reduction in DB round trips (5→3 queries per invocation). The triple-join query may return more columns per row than the individual queries, but network latency savings outweigh the marginal bandwidth increase.

## References

- Research document: `thoughts/shared/research/2026-03-14-edge-resolver-stress-evaluation.md`
- `api/console/src/inngest/workflow/neural/edge-resolver.ts:26` — `resolveEdges` function
- `api/console/src/inngest/workflow/neural/entity-graph.ts:27` — sole caller
- `api/console/src/inngest/workflow/neural/entity-embed.ts:120-132` — sole consumer (edge query)
- `api/console/src/inngest/workflow/neural/narrative-builder.ts:31` — `buildEntityNarrative`
- `packages/console-providers/src/providers/vercel/index.ts:173-182` — Vercel `deploys` rule (to remove)
- `packages/console-providers/src/providers/github/index.ts:343-369` — GitHub edge rules (canonical)
- `db/console/src/schema/tables/workspace-edges.ts:75-80` — `edge_unique_idx`
- `db/console/src/schema/tables/workspace-entity-events.ts:54-56` — `ee_entity_event_idx`
