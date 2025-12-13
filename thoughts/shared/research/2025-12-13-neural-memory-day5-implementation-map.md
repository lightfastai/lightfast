---
date: 2025-12-13T21:30:00+08:00
researcher: Claude
git_commit: a59507e7f3327cc85c541f7ee3bf3538e1af580b
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Neural Memory Day 5 Implementation Research"
tags: [research, codebase, neural-memory, day5, embeddings, temporal, retrieval]
status: complete
last_updated: 2025-12-13
last_updated_by: Claude
---

# Research: Neural Memory Day 5 Implementation Map

**Date**: 2025-12-13T21:30:00+08:00
**Researcher**: Claude
**Git Commit**: a59507e7f3327cc85c541f7ee3bf3538e1af580b
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Document everything needed for Day 5 implementation of neural memory:
1. Multi-view embeddings (3 vectors per observation)
2. Temporal state tracking (bi-temporal tables)
3. Enhanced retrieval governor (parallel search paths, fusion scoring)
4. Quality polish (evaluation, latency optimization)

## Summary

Day 5 implementation requires changes across multiple layers:

**Multi-view Embeddings**: Currently single embedding per observation. Need schema migration to add `embeddingTitleId`, `embeddingContentId`, `embeddingSummaryId` columns, plus pipeline changes to generate 3 embeddings in parallel.

**Temporal State Tracking**: No bi-temporal tables exist. Need new `workspaceTemporalStates` table. Existing patterns (dual timestamps, immutable logs) provide foundation.

**Enhanced Retrieval**: Current retrieval has vector + entity search with LLM gating. Need to add cluster search and actor profile search paths for full 4-path parallel retrieval.

---

## Detailed Findings

### 1. Multi-view Embeddings

#### Current State: Single Embedding

**Schema** (`db/console/src/schema/tables/workspace-neural-observations.ts:162`):
```typescript
embeddingVectorId: varchar("embedding_vector_id", { length: 191 }),
```

Only ONE embedding field exists. No multi-view support in schema.

**Embedding Generation** (`api/console/src/inngest/workflow/neural/observation-capture.ts:359`):
```typescript
const textToEmbed = `${sourceEvent.title}\n\n${sourceEvent.body}`;
```

Single text concatenation, single embedding call.

**Pinecone Upsert** (`observation-capture.ts:443-451`):
- Single vector upserted per observation
- Metadata includes `layer: "observations"`
- Namespace: `{clerkOrgId}:ws_{workspaceId}`

#### What's Needed for Day 5

**Schema Changes Required** (Drizzle pattern from existing schema):
```typescript
// Add to workspace-neural-observations.ts in EMBEDDINGS section

/**
 * Pinecone vector ID for title-only embedding
 */
embeddingTitleId: varchar("embedding_title_id", { length: 191 }),

/**
 * Pinecone vector ID for content-only embedding
 */
embeddingContentId: varchar("embedding_content_id", { length: 191 }),

/**
 * Pinecone vector ID for summary embedding (optional)
 */
embeddingSummaryId: varchar("embedding_summary_id", { length: 191 }),
```

Then run `pnpm db:generate` to create migration.

**Pipeline Changes Required**:
1. Generate 3 embeddings in parallel within existing parallel step
2. Upsert 3 vectors to Pinecone with view-specific metadata
3. Store 3 vector IDs in observation record

**Embedding Provider** (`packages/console-embed/src/utils.ts:150-160`):
- Uses Cohere `embed-english-v3.0` with 1024 dimensions
- `inputType: "search_document"` for indexing
- Provider is workspace-configurable but locked to Cohere

**Vector ID Pattern** (`observation-capture.ts:366`):
```typescript
const vectorId = `obs_${sourceEvent.sourceId.replace(/[^a-zA-Z0-9]/g, "_")}`;
```

For multi-view, extend pattern:
- `obs_title_{sourceId}`
- `obs_content_{sourceId}`
- `obs_summary_{sourceId}`

---

### 2. Temporal State Tracking

#### Current State: No Bi-Temporal Tables

**No `workspaceTemporalStates` table exists**. Schema search confirmed no tables with `validFrom`/`validTo` columns.

#### Existing Temporal Patterns

**1. Dual Timestamp Pattern** (`workspace-neural-observations.ts:69-87`):
```typescript
occurredAt: timestamp("occurred_at", { mode: "string", withTimezone: true }).notNull(),
capturedAt: timestamp("captured_at", { mode: "string", withTimezone: true })
  .default(sql`CURRENT_TIMESTAMP`)
  .notNull(),
```

Separates event time from system time - foundation for bi-temporality.

**2. Immutable Event Log** (`workspace-user-activities.ts`):
- Append-only activity log
- Metadata stores state-specific context
- Indexed by `(workspaceId, timestamp)`

**3. Lifecycle Timestamps** (`workspace-neural-entities.ts:88-110`):
```typescript
extractedAt: timestamp("extracted_at", { mode: "string", withTimezone: true })
  .default(sql`CURRENT_TIMESTAMP`).notNull(),
lastSeenAt: timestamp("last_seen_at", { mode: "string", withTimezone: true })
  .default(sql`CURRENT_TIMESTAMP`).notNull(),
occurrenceCount: integer("occurrence_count").default(1).notNull(),
```

Tracks first/last without full history.

#### What's Needed for Day 5

**New Table Schema** (Drizzle pattern):

Create `db/console/src/schema/tables/workspace-temporal-states.ts`:

```typescript
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Entity types that can have temporal state tracking
 */
export type TemporalEntityType = 'project' | 'feature' | 'service' | 'sprint';

/**
 * State types for temporal tracking
 */
export type TemporalStateType = 'status' | 'progress' | 'health' | 'risk' | 'priority';

/**
 * Bi-temporal state tracking for engineering entities
 * Enables point-in-time queries like "what was the status of Project X last month?"
 */
export const workspaceTemporalStates = pgTable(
  "lightfast_workspace_temporal_states",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // ========== ENTITY ==========

    /**
     * Type of entity being tracked
     */
    entityType: varchar("entity_type", { length: 50 })
      .notNull()
      .$type<TemporalEntityType>(),

    /**
     * Entity identifier
     */
    entityId: varchar("entity_id", { length: 191 }).notNull(),

    /**
     * Human-readable entity name
     */
    entityName: varchar("entity_name", { length: 255 }),

    // ========== STATE ==========

    /**
     * Type of state being tracked
     */
    stateType: varchar("state_type", { length: 50 })
      .notNull()
      .$type<TemporalStateType>(),

    /**
     * Current state value
     */
    stateValue: varchar("state_value", { length: 255 }).notNull(),

    /**
     * Additional state metadata
     */
    stateMetadata: jsonb("state_metadata").$type<Record<string, unknown>>(),

    // ========== TEMPORAL ==========

    /**
     * When this state became valid (in reality)
     */
    validFrom: timestamp("valid_from", {
      mode: "string",
      withTimezone: true,
    }).notNull(),

    /**
     * When this state stopped being valid (null = still current)
     */
    validTo: timestamp("valid_to", {
      mode: "string",
      withTimezone: true,
    }),

    /**
     * Fast lookup flag for current state
     */
    isCurrent: boolean("is_current").default(true).notNull(),

    // ========== CHANGE METADATA ==========

    /**
     * Actor who made this change
     */
    changedByActorId: varchar("changed_by_actor_id", { length: 191 }),

    /**
     * Reason for the change
     */
    changeReason: text("change_reason"),

    /**
     * Observation that triggered this state change
     */
    relatedObservationId: varchar("related_observation_id", { length: 191 }),

    // ========== TIMESTAMPS ==========

    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for point-in-time entity queries
    entityTimeIdx: index("temporal_entity_time_idx").on(
      table.entityType,
      table.entityId,
      table.validFrom,
    ),

    // Index for current state lookups
    currentIdx: index("temporal_current_idx").on(
      table.workspaceId,
      table.isCurrent,
    ),

    // Index for workspace + entity type queries
    workspaceEntityIdx: index("temporal_workspace_entity_idx").on(
      table.workspaceId,
      table.entityType,
    ),
  }),
);

export type WorkspaceTemporalState = typeof workspaceTemporalStates.$inferSelect;
export type InsertWorkspaceTemporalState = typeof workspaceTemporalStates.$inferInsert;
```

**Point-in-Time Query Function**:
```typescript
async function getStateAt(
  workspaceId: string,
  entityId: string,
  stateType: string,
  pointInTime: Date
): Promise<WorkspaceTemporalState | null> {
  const [state] = await db.select()
    .from(workspaceTemporalStates)
    .where(and(
      eq(workspaceTemporalStates.workspaceId, workspaceId),
      eq(workspaceTemporalStates.entityId, entityId),
      eq(workspaceTemporalStates.stateType, stateType),
      lte(workspaceTemporalStates.validFrom, pointInTime.toISOString()),
      or(
        isNull(workspaceTemporalStates.validTo),
        gt(workspaceTemporalStates.validTo, pointInTime.toISOString())
      )
    ))
    .limit(1);

  return state ?? null;
}
```

---

### 3. Enhanced Retrieval Governor

#### Current State

**Vector Search** (`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts:311-320`):
- Pinecone query with `topK: 10-20`
- Metadata filters: `layer: "observations"`, sourceTypes, observationTypes, actorNames, dateRange
- Returns vector similarity scores

**Entity Search** (`apps/console/src/lib/neural/entity-search.ts`):
- Regex extraction of entities from query (@mentions, #123, API endpoints)
- Database lookup in `workspaceNeuralEntities`
- Returns entities with linked observations

**Fusion Scoring** (`search/route.ts:130-168`):
- Entity matches boost vector scores by +0.2
- New entities get base score of `0.85 * entity.confidence`
- Sorted by combined score

**LLM Relevance Filtering** (`apps/console/src/lib/neural/llm-filter.ts:66`):
- Model: GPT-5.1 Instant via Vercel AI Gateway
- Skips if ≤5 candidates
- Final score: `0.6 * llmScore + 0.4 * vectorScore`
- Minimum threshold: 0.4

**Latency Tracking** (`search/route.ts:381-386`):
```typescript
latency: {
  total: Date.now() - startTime,
  retrieval: queryLatency,
  entitySearch: entityLatency,
  llmFilter: filterResult.latency,
}
```

#### What's Needed for Day 5

**Add Cluster Search Path**:
```typescript
// Path 3: Cluster context retrieval (NEW)
const clusterMatches = await findRelevantClusters(workspaceId, query, queryEmbedding);
```

Implementation pattern from Day 4 cluster assignment:
- Query cluster centroids via Pinecone with `layer: "clusters"` filter
- Return cluster context (summary, keywords, primary entities/actors)

**Add Actor Profile Search Path**:
```typescript
// Path 4: Actor profile matching (NEW)
const actorMatches = await matchActorProfiles(workspaceId, query);
```

Implementation:
- Parse actor mentions from query
- Query `workspaceActorProfiles` by displayName, email
- Include expertise domains and contribution patterns

**4-Path Parallel Execution** (Target):
```typescript
const [vectorCandidates, entityMatches, clusterMatches, actorMatches] = await Promise.all([
  searchObservationVectors(workspaceId, queryEmbedding, filters),
  searchEntityStore(workspaceId, query),
  findRelevantClusters(workspaceId, query, queryEmbedding),  // NEW
  matchActorProfiles(workspaceId, query),                     // NEW
]);
```

**Multi-View Retrieval**:
- Query appropriate embedding view based on query type
- Title-only for topic searches
- Content-only for detail searches
- Default to content view

---

### 4. Day 4 Implementation Reference

#### Cluster Assignment (`api/console/src/inngest/workflow/neural/cluster-assignment.ts`)

**Affinity Scoring** (lines 116-165):
- Embedding similarity: 0-40 points
- Entity overlap (Jaccard): 0-30 points
- Actor overlap: 0-20 points
- Temporal proximity: 0-10 points
- Threshold: 60 to join existing cluster

**Cluster Centroid** (lines 220-232):
- Uses observation embedding as initial centroid
- Stored in Pinecone with `layer: "clusters"`
- Vector ID: `cluster_${nanoid()}`

#### Actor Resolution (`api/console/src/inngest/workflow/neural/actor-resolution.ts`)

**Three-Tier Design** (only Tier 2 implemented):
- Tier 1: OAuth connection (confidence 1.0) - NOT IMPLEMENTED
- Tier 2: Email matching (confidence 0.85) - IMPLEMENTED
- Tier 3: Heuristic (confidence 0.60) - NOT IMPLEMENTED

**Email Resolution** (lines 129-192):
- Queries Clerk organization members
- Matches email addresses
- Caches identity in `workspaceActorIdentities`

#### Fire-and-Forget Events (`observation-capture.ts:534-573`)

**Profile Update** (debounced 5 min):
```typescript
{ name: "apps-console/neural/profile.update", data: { workspaceId, actorId, observationId } }
```

**Cluster Summary** (debounced 10 min):
```typescript
{ name: "apps-console/neural/cluster.check-summary", data: { workspaceId, clusterId, observationCount } }
```

---

## Code References

### Embedding Implementation
- `api/console/src/inngest/workflow/neural/observation-capture.ts:349-368` - Embedding generation step
- `packages/console-embed/src/utils.ts:150-160` - Provider factory
- `vendor/embed/src/provider/cohere.ts:102-139` - Cohere API integration

### Schema Definitions
- `db/console/src/schema/tables/workspace-neural-observations.ts` - Observations table
- `db/console/src/schema/tables/workspace-neural-entities.ts` - Entities table
- `db/console/src/schema/tables/workspace-observation-clusters.ts` - Clusters table
- `db/console/src/schema/tables/workspace-actor-profiles.ts` - Actor profiles table

### Retrieval Implementation
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts` - Search endpoint
- `apps/console/src/lib/neural/llm-filter.ts` - LLM relevance filtering
- `apps/console/src/lib/neural/entity-search.ts` - Entity search

### Cluster & Actor (Day 4)
- `api/console/src/inngest/workflow/neural/cluster-assignment.ts` - Cluster assignment
- `api/console/src/inngest/workflow/neural/actor-resolution.ts` - Actor resolution
- `api/console/src/inngest/workflow/neural/profile-update.ts` - Profile update workflow
- `api/console/src/inngest/workflow/neural/cluster-summary.ts` - Summary generation

---

## Architecture Documentation

### Current Pipeline (After Day 4)

```
SourceEvent
    ↓
Check Duplicate + Event Allowed
    ↓
Significance Gate (< 40 = skip)
    ↓
┌───────────────────────────────────────┐
│ PARALLEL (no interdependencies)       │
│  • Classification                     │
│  • Single Embedding                   │
│  • Entity Extraction                  │
│  • Actor Resolution (Tier 2)          │
└───────────────────────────────────────┘
    ↓
Cluster Assignment (affinity scoring)
    ↓
Pinecone Upsert (1 vector)
    ↓
Store Observation + Entities (transactional)
    ↓
┌───────────────────────────────────────┐
│ FIRE-AND-FORGET                       │
│  • Profile Update (5 min debounce)    │
│  • Cluster Summary (10 min debounce)  │
└───────────────────────────────────────┘
```

### Target Pipeline (After Day 5)

```
SourceEvent
    ↓
Check Duplicate + Event Allowed
    ↓
Significance Gate (< 40 = skip)
    ↓
┌───────────────────────────────────────┐
│ PARALLEL (no interdependencies)       │
│  • Classification                     │
│  • Multi-view Embeddings (3 vectors)  │  ← NEW
│  • Entity Extraction                  │
│  • Actor Resolution (Tier 2)          │
└───────────────────────────────────────┘
    ↓
Cluster Assignment (affinity scoring)
    ↓
Pinecone Upsert (3 vectors)              ← CHANGED
    ↓
Store Observation + Entities (transactional)
    ↓
Optional: Update Temporal State           ← NEW
    ↓
┌───────────────────────────────────────┐
│ FIRE-AND-FORGET                       │
│  • Profile Update (5 min debounce)    │
│  • Cluster Summary (10 min debounce)  │
└───────────────────────────────────────┘
```

### Target Retrieval (After Day 5)

```
User Query
    ↓
Query Embedding (search_query inputType)
    ↓
┌───────────────────────────────────────┐
│ PARALLEL SEARCH PATHS                 │
│  • Vector Search (multi-view)         │  ← ENHANCED
│  • Entity Search                      │
│  • Cluster Search                     │  ← NEW
│  • Actor Profile Search               │  ← NEW
└───────────────────────────────────────┘
    ↓
Fusion Scoring (weighted combination)
    ↓
LLM Relevance Filtering
    ↓
Return Results with Latency Metrics
```

---

## Implementation Checklist for Day 5

### Multi-view Embeddings
- [ ] Add schema columns: `embeddingTitleId`, `embeddingContentId`, `embeddingSummaryId`
- [ ] Generate migration: `cd db/console && pnpm db:generate`
- [ ] Update parallel embedding step to generate 3 embeddings
- [ ] Update Pinecone upsert for 3 vectors
- [ ] Update retrieval to query appropriate view

### Temporal State Tracking
- [ ] Create `workspace-temporal-states.ts` schema file
- [ ] Export from `db/console/src/schema/tables/index.ts`
- [ ] Generate migration: `cd db/console && pnpm db:generate`
- [ ] Implement `getStateAt()` point-in-time query
- [ ] Add temporal state extraction to observation pipeline
- [ ] Create tRPC endpoint for temporal queries

### Enhanced Retrieval
- [ ] Implement `findRelevantClusters()` function
- [ ] Implement `matchActorProfiles()` function
- [ ] Add cluster and actor paths to parallel search
- [ ] Update fusion scoring for 4-path results
- [ ] Add latency tracking for new paths

---

## Related Research

- `thoughts/shared/plans/2025-12-11-neural-memory-implementation-research-prompt.md` - Implementation roadmap
- `thoughts/shared/plans/2025-12-13-neural-memory-day3.5-write-path-rework.md` - Day 3.5 plan
- `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md` - Full architecture spec

---

## Open Questions

1. **Multi-view Query Selection**: How to determine which embedding view to query? Options:
   - Query classifier based on query length/type
   - Always query content, use title for re-ranking
   - Query all views and merge (expensive)

2. **Temporal State Sources**: What triggers temporal state creation?
   - Linear status changes (requires Linear webhook integration)
   - GitHub PR state changes (from existing webhooks)
   - Manual state declarations

3. **Cluster Search Fusion**: How to weight cluster results vs vector results?
   - Cluster context is higher-level (summary)
   - May need different scoring approach

4. **Profile Embedding**: When to compute profile embeddings?
   - Currently `profileEmbeddingId` exists but unused
   - Should it be centroid of actor's observation embeddings?
   - Latency impact of profile embedding queries?
