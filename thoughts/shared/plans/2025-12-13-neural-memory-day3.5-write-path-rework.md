# Day 3.5: Write Path (Ingestion Pipeline) Rework

## Overview

Refactor the observation capture pipeline to match the target architecture from `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md`. The key changes are:

1. **Significance gating** - Early return for low-value events
2. **Parallelization** - Run independent steps concurrently
3. **Inline entity extraction** - Move from fire-and-forget to inline (preparation for cluster assignment)
4. **Prepare for Day 4** - Structure ready for cluster assignment and actor resolution

## Current State vs Target Architecture

### Current Flow (Sequential)

```
Step 1: Check Duplicate
    ↓
Step 2: Check Event Allowed
    ↓
Step 3: Fetch Workspace Context
    ↓
Step 4: Generate Embedding (single view)
    ↓
Step 5: Upsert to Pinecone
    ↓
Step 6: Store Observation (significance + classification computed inline)
    ↓
Step 7: Emit completion event → triggers entity extraction (async)
```

**Problems:**
- Significance computed but not used as gate
- Sequential steps that could be parallel
- Entity extraction is fire-and-forget (can't use for cluster assignment)
- No cluster assignment step

### Target Flow (from E2E Design)

```
SourceEvent
    ↓
Significance (GATE) ──→ discard if < threshold
    ↓
┌───────────────────────────────────────┐
│ PARALLEL (no interdependencies)       │
│  • Classification                     │
│  • Actor Resolution (Day 4)           │
│  • Embeddings                         │
│  • Entity Extraction                  │
└───────────────────────────────────────┘
    ↓
Cluster Assignment (Day 4) ←── needs embeddings + classification
    ↓
Store Observation + Entities (transactional)
    ↓
┌───────────────────────────────────────┐
│ ASYNC (fire-and-forget)               │
│  • Profile Update (Day 4)             │
│  • Cluster Summary (Day 4)            │
└───────────────────────────────────────┘
```

### Day 3.5 Target Flow

```
SourceEvent
    ↓
Step 1: Check Duplicate + Event Allowed (combined)
    ↓
Step 2: Fetch Context + Evaluate Significance
    ↓
Step 3: GATE - return early if significance < threshold
    ↓
Step 4: PARALLEL processing
│  • Classification
│  • Generate Embedding
│  • Extract Entities (inline, not fire-and-forget)
    ↓
Step 5: Upsert to Pinecone
    ↓
Step 6: Store Observation + Entities (transactional)
    ↓
Step 7: Emit completion event (for future cluster/profile)
```

## Desired End State

After Day 3.5 completion:
1. Low-significance events are gated (not stored)
2. Classification, embedding, and entity extraction run in parallel
3. Entities stored in same transaction as observation
4. Pipeline structure ready for Day 4 additions (cluster, actor, profile)
5. Latency reduced through parallelization

### Verification Criteria

- [x] Events with significance < 40 return early with `status: "below_threshold"` (implementation complete)
- [ ] Total pipeline duration reduced by ~30% through parallelization (manual verification needed)
- [x] Entities stored in same request as observation (not async)
- [x] Entity extraction workflow removed (no longer fire-and-forget)
- [x] Typecheck passes: `pnpm --filter @api/console typecheck`

## What We're NOT Doing

1. **Multi-view embeddings** - Defer to Day 5 (requires schema changes)
2. **Actor resolution** - Day 4 scope
3. **Cluster assignment** - Day 4 scope (requires cluster schema)
4. **Profile updates** - Day 4 scope
5. **Configurable thresholds** - Future (hardcoded for now)

---

## Phase 1: Add Significance Gating

### Overview

Add early return after significance evaluation. Events below threshold are logged but not stored.

### Changes Required

#### 1. Add Significance Threshold Constant

**File**: `api/console/src/inngest/workflow/neural/scoring.ts`

Add at top of file (after imports):

```typescript
/**
 * Minimum significance score for observation capture.
 * Events below this threshold are logged but not stored.
 *
 * Scoring scale (0-100):
 * - 60-100: High significance (releases, incidents, major features)
 * - 40-59: Medium significance (PRs, issues, deployments)
 * - 20-39: Low significance (routine commits, minor updates)
 * - 0-19: Noise (dependency bumps, typo fixes, WIP)
 *
 * TODO (Future): Make configurable per workspace
 */
export const SIGNIFICANCE_THRESHOLD = 40;
```

#### 2. Restructure Workflow to Gate Early

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

Move significance evaluation before embedding generation and add gate:

```typescript
import { scoreSignificance, SIGNIFICANCE_THRESHOLD } from "./scoring";

// ... existing code ...

// After Step 2 (check-event-allowed), add:

// Step 2.5: Evaluate significance
const significance = await step.run("evaluate-significance", async () => {
  return scoreSignificance(sourceEvent);
});

// Gate: Skip low-significance events
if (significance.score < SIGNIFICANCE_THRESHOLD) {
  log.info("Observation below significance threshold, skipping", {
    workspaceId,
    sourceId: sourceEvent.sourceId,
    significanceScore: significance.score,
    threshold: SIGNIFICANCE_THRESHOLD,
    factors: significance.factors,
  });

  return {
    status: "below_threshold",
    significanceScore: significance.score,
    threshold: SIGNIFICANCE_THRESHOLD,
    duration: Date.now() - startTime,
  };
}

// Continue with embedding generation...
```

### Success Criteria

#### Automated Verification:
- [x] Typecheck passes: `pnpm --filter @api/console typecheck`
- [x] Build passes: `pnpm --filter @api/console build`

#### Manual Verification:
- [ ] Push a trivial commit (e.g., "fix typo") → returns `status: "below_threshold"`
- [ ] Push a meaningful commit (e.g., "feat: add auth") → captured normally
- [ ] Check logs show significance score and factors

---

## Phase 2: Parallelize Processing Steps

### Overview

Run classification, embedding, and entity extraction in parallel since they have no interdependencies.

### Changes Required

#### 1. Update Observation Capture to Use Parallel Steps

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

Replace sequential steps 4-6 with parallel execution:

```typescript
import { extractEntities, extractFromReferences } from "./entity-extraction-patterns";
import type { ExtractedEntity } from "@repo/console-types";

// ... after significance gate ...

// Step 4: PARALLEL processing (no interdependencies)
const [classification, embeddingResult, extractedEntities] = await Promise.all([
  // Classification
  step.run("classify", async () => {
    const keywordTopics = extractTopics(sourceEvent);
    const classification = classifyObservation(sourceEvent);

    // Merge and deduplicate topics
    const topics = [
      ...keywordTopics,
      classification.primaryCategory,
      ...classification.secondaryCategories,
    ].filter((t, i, arr) => arr.indexOf(t) === i);

    return { topics, classification };
  }),

  // Embedding generation
  step.run("generate-embedding", async () => {
    const embeddingProvider = createEmbeddingProviderForWorkspace(
      {
        id: workspace.id,
        embeddingModel: workspace.embeddingModel,
        embeddingDim: workspace.embeddingDim,
      },
      { inputType: "search_document" }
    );

    const textToEmbed = `${sourceEvent.title}\n\n${sourceEvent.body}`;
    const result = await embeddingProvider.embed([textToEmbed]);

    if (!result.embeddings[0]) {
      throw new Error("Failed to generate embedding");
    }

    const vectorId = `obs_${sourceEvent.sourceId.replace(/[^a-zA-Z0-9]/g, "_")}`;
    return { embeddingVector: result.embeddings[0], vectorId };
  }),

  // Entity extraction (inline, not fire-and-forget)
  step.run("extract-entities", async () => {
    const textEntities = extractEntities(sourceEvent.title, sourceEvent.body || "");
    const references = sourceEvent.references as Array<{ type: string; id: string; label?: string }>;
    const refEntities = extractFromReferences(references);

    // Combine and deduplicate
    const allEntities = [...textEntities, ...refEntities];
    const entityMap = new Map<string, ExtractedEntity>();

    for (const entity of allEntities) {
      const key = `${entity.category}:${entity.key.toLowerCase()}`;
      const existing = entityMap.get(key);
      if (!existing || existing.confidence < entity.confidence) {
        entityMap.set(key, entity);
      }
    }

    // Limit to prevent runaway extraction
    const deduplicated = Array.from(entityMap.values());
    return deduplicated.slice(0, 50); // MAX_ENTITIES_PER_OBSERVATION
  }),
]);

const { topics } = classification;
const { embeddingVector, vectorId } = embeddingResult;
```

### Success Criteria

#### Automated Verification:
- [x] Typecheck passes: `pnpm --filter @api/console typecheck`
- [x] Build passes: `pnpm --filter @api/console build`

#### Manual Verification:
- [ ] Pipeline completes successfully
- [ ] Duration reduced vs sequential (check Inngest dashboard)
- [ ] All three parallel steps show in Inngest UI

---

## Phase 3: Transactional Store (Observation + Entities)

### Overview

Store observation and entities in a single database transaction instead of fire-and-forget.

### Changes Required

#### 1. Update Store Step to Include Entities

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

Replace current store step with transactional insert:

```typescript
import { workspaceNeuralEntities } from "@db/console/schema";
import { sql } from "drizzle-orm";

// Step 6: Store observation + entities (transactional)
const { observation, entitiesStored } = await step.run("store-observation", async () => {
  const observationType = deriveObservationType(sourceEvent);

  return await db.transaction(async (tx) => {
    // Insert observation
    const [obs] = await tx
      .insert(workspaceNeuralObservations)
      .values({
        workspaceId,
        occurredAt: sourceEvent.occurredAt,
        // TODO (Day 4): Replace passthrough with resolveActor() call
        actor: sourceEvent.actor || null,
        observationType,
        title: sourceEvent.title,
        content: sourceEvent.body,
        topics,
        significanceScore: significance.score,
        source: sourceEvent.source,
        sourceType: sourceEvent.sourceType,
        sourceId: sourceEvent.sourceId,
        sourceReferences: sourceEvent.references,
        metadata: sourceEvent.metadata,
        embeddingVectorId: vectorId,
        // TODO (Day 4): Add clusterId after cluster assignment
      })
      .returning();

    if (!obs) {
      throw new Error("Failed to insert observation");
    }

    // Insert entities with upsert (same transaction)
    let entitiesStored = 0;
    for (const entity of extractedEntities) {
      await tx
        .insert(workspaceNeuralEntities)
        .values({
          workspaceId,
          category: entity.category,
          key: entity.key,
          value: entity.value,
          sourceObservationId: obs.id,
          evidenceSnippet: entity.evidence,
          confidence: entity.confidence,
        })
        .onConflictDoUpdate({
          target: [
            workspaceNeuralEntities.workspaceId,
            workspaceNeuralEntities.category,
            workspaceNeuralEntities.key,
          ],
          set: {
            lastSeenAt: new Date().toISOString(),
            occurrenceCount: sql`${workspaceNeuralEntities.occurrenceCount} + 1`,
            updatedAt: new Date().toISOString(),
          },
        });
      entitiesStored++;
    }

    log.info("Observation and entities stored", {
      observationId: obs.id,
      observationType,
      entitiesExtracted: extractedEntities.length,
      entitiesStored,
    });

    return { observation: obs, entitiesStored };
  });
});
```

### Success Criteria

#### Automated Verification:
- [x] Typecheck passes: `pnpm --filter @api/console typecheck`
- [x] Build passes: `pnpm --filter @api/console build`

#### Manual Verification:
- [ ] Observation and entities stored in same request
- [ ] Entities visible in database after capture
- [ ] No separate entity extraction workflow runs

---

## Phase 4: Remove Fire-and-Forget Entity Extraction

### Overview

Remove the separate entity extraction workflow since entities are now extracted inline.

### Changes Required

#### 1. Remove Entity Extraction Workflow Registration

**File**: `api/console/src/inngest/index.ts`

Remove `entityExtraction` from imports and functions array:

```typescript
// Change from:
import { observationCapture, entityExtraction } from "./workflow/neural";
export { observationCapture, entityExtraction };

// To:
import { observationCapture } from "./workflow/neural";
export { observationCapture };

// In functions array, remove entityExtraction
```

#### 2. Update Neural Module Exports

**File**: `api/console/src/inngest/workflow/neural/index.ts`

```typescript
// Remove entityExtraction export
export { observationCapture } from "./observation-capture";
// export { entityExtraction } from "./entity-extraction"; // REMOVED
```

#### 3. Keep Entity Extraction Patterns File

Keep `entity-extraction-patterns.ts` as it's still used by the inline extraction.

#### 4. Archive Entity Extraction Workflow (Optional)

Rename or add deprecation note to `entity-extraction.ts`:

```typescript
/**
 * @deprecated Entity extraction is now inline in observation-capture.ts
 * This file is kept for reference but no longer registered.
 */
```

### Success Criteria

#### Automated Verification:
- [x] Typecheck passes: `pnpm --filter @api/console typecheck`
- [x] Build passes: `pnpm --filter @api/console build`
- [ ] Inngest dev dashboard shows only `neural.observation.capture`

#### Manual Verification:
- [ ] Entity extraction workflow no longer appears in Inngest
- [ ] Entities still extracted and stored (via inline extraction)

---

## Phase 5: Update Completion Event

### Overview

Update the completion event to include entity count for future use by cluster/profile systems.

### Changes Required

#### 1. Enhance Completion Event Payload

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

```typescript
// Step 7: Emit completion event (for future cluster/profile systems)
await step.sendEvent("emit-captured", {
  name: "apps-console/neural/observation.captured",
  data: {
    workspaceId,
    observationId: observation.id,
    sourceId: sourceEvent.sourceId,
    observationType: observation.observationType,
    // New fields for Day 4
    significanceScore: significance.score,
    topics,
    entitiesExtracted: extractedEntities.length,
    // TODO (Day 4): Add actorId, clusterId
  },
});
```

### Success Criteria

- [x] Event payload includes new fields
- [ ] Downstream consumers (future) can use enriched data

---

## Testing Strategy

### Unit Tests

Add to `api/console/src/inngest/workflow/neural/__tests__/`:

- `scoring.test.ts`: Test significance threshold gating
- `observation-capture.test.ts`: Test parallel execution order

### Integration Tests

1. **Significance gating test**:
   - Send low-significance event → verify `below_threshold` status
   - Send high-significance event → verify full capture

2. **Parallelization test**:
   - Verify all three parallel steps complete
   - Verify duration is less than sum of sequential steps

3. **Transactional store test**:
   - Verify observation and entities in same transaction
   - Verify rollback if entity insert fails

### Manual Testing Steps

1. Start console dev server: `pnpm dev:console`
2. Push trivial commit: `git commit --allow-empty -m "chore: fix typo"`
3. Verify in Inngest: `status: "below_threshold"`
4. Push meaningful commit: `git commit --allow-empty -m "feat: add user authentication #123"`
5. Verify in Inngest:
   - Parallel steps visible
   - Duration reduced
   - Entities stored
6. Check database:
   - Observation has significance score
   - Entities linked to observation
   - No separate entity extraction run

---

## Performance Considerations

### Expected Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Low-significance events | Fully processed | Gated early | ~40% events skipped |
| Pipeline duration | ~800ms | ~500ms | ~37% faster |
| Entity storage | Async (eventual) | Transactional | Immediate |

### Latency Budget

| Step | Target (p95) |
|------|--------------|
| Duplicate check + event allowed | 20ms |
| Fetch context + significance | 30ms |
| PARALLEL (classification + embedding + entities) | 200ms |
| Pinecone upsert | 100ms |
| Database store (transaction) | 50ms |
| **Total** | ~400ms |

---

## Migration Notes

- **No schema changes required** - Uses existing tables
- **Backward compatible** - Completion event has additional fields
- **Entity extraction workflow** - Can be removed after verification

---

## Preparation for Day 4

This refactor prepares the pipeline for Day 4 additions:

1. **Cluster Assignment** - Add step between parallel processing and store
2. **Actor Resolution** - Add to parallel processing array
3. **Profile Update** - Add fire-and-forget event after store
4. **Cluster Summary** - Add fire-and-forget event after store

The pipeline structure will look like:

```typescript
// Day 4 additions (placeholder)
const [classification, embeddingResult, extractedEntities, resolvedActor] = await Promise.all([
  // ... existing parallel steps ...
  step.run("resolve-actor", async () => {
    // TODO (Day 4): Three-tier actor resolution
    return { actorId: null, confidence: 0, method: "unresolved" };
  }),
]);

// After parallel, before store:
const clusterAssignment = await step.run("assign-cluster", async () => {
  // TODO (Day 4): Cluster assignment logic
  return { clusterId: null, isNew: false };
});

// After store, fire-and-forget:
await step.sendEvent("async-updates", [
  { name: "apps-console/neural/profile.update", data: { ... } },
  { name: "apps-console/neural/cluster.check-summary", data: { ... } },
]);
```

---

## References

- E2E Design: `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md:238-343`
- Current Pipeline: `api/console/src/inngest/workflow/neural/observation-capture.ts`
- Entity Patterns: `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts`
- Scoring: `api/console/src/inngest/workflow/neural/scoring.ts`
- Day 1 Plan: `thoughts/shared/plans/2025-12-11-neural-memory-day1-observations-in.md`
- Day 3 Plan: `thoughts/shared/plans/2025-12-12-neural-memory-day3-entity-system.md`
