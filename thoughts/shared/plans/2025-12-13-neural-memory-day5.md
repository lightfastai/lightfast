# Neural Memory Day 5 Implementation Plan

## Overview

Day 5 enhances the neural memory system with three major capabilities:
1. **Multi-view Embeddings**: Generate 3 vectors per observation (title, content, summary) for view-specific retrieval
2. **Temporal State Tracking**: Add bi-temporal table for point-in-time queries ("what was the status of Project X last month?")
3. **Enhanced Retrieval**: Add cluster search and actor profile search paths to the retrieval governor

## Current State Analysis

### Embedding Pipeline (Day 1-4)
- **Single embedding** per observation: `${title}\n\n${body}` concatenated
- **One vector ID** stored in `embeddingVectorId` column
- **Pinecone upsert**: Single vector with `layer: "observations"` metadata
- **Location**: `api/console/src/inngest/workflow/neural/observation-capture.ts:349-368`

### Retrieval Pipeline (Current)
- **2-path parallel search**: Vector search + Entity search
- **Fusion scoring**: Entity matches boost vector scores by +0.2
- **LLM filtering**: GPT-5.1 Instant for relevance scoring (0.6 * llmScore + 0.4 * vectorScore)
- **Location**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`

### Schema Patterns (Established)
- **Primary keys**: `varchar(191)` with `$defaultFn(() => nanoid())`
- **Timestamps**: `mode: "string", withTimezone: true` with `sql\`CURRENT_TIMESTAMP\`` default
- **Foreign keys**: Reference `orgWorkspaces.id` with `onDelete: "cascade"`
- **Indexes**: Composite indexes with `workspaceId` first

## Desired End State

After Day 5 implementation:

1. **Multi-view Storage**: Each observation has 3 vector IDs stored (`embeddingTitleId`, `embeddingContentId`, `embeddingSummaryId`)
2. **Temporal Queries**: Can query "what was the status of entity X at time T" via new `workspaceTemporalStates` table
3. **4-Path Retrieval**: Vector + Entity + Cluster + Actor profile search paths run in parallel

### Verification
- [ ] Schema migration applies cleanly
- [ ] Observation capture generates and stores 3 embeddings
- [ ] New observations appear in Pinecone with 3 vectors per observation
- [ ] Retrieval can query by view (title vs content vs summary)
- [ ] Temporal state table exists and supports point-in-time queries
- [ ] Cluster search returns relevant clusters for queries
- [ ] Actor profile search returns relevant actors for queries

## What We're NOT Doing

- **Automatic temporal state extraction**: No LLM-based state detection from observations (future Day 6+)
- **Profile embeddings**: Not computing actor profile embeddings yet (`profileEmbeddingId` stays unused)
- **Multi-view query selection**: Not implementing automatic view selection based on query type (always query content view for now)
- **Summary generation during capture**: Not generating LLM summaries during observation capture (use title + body for "summary" view)
- **Centroid re-computation**: Not updating cluster centroids when new observations join

## Implementation Approach

The implementation follows three independent workstreams that can be done in parallel:
1. Schema + embedding pipeline changes (multi-view)
2. Temporal state table and utilities
3. Enhanced retrieval paths

---

## Phase 1: Multi-view Embeddings Schema

### Overview
Add three embedding ID columns to observations table to support view-specific vector storage.

### Changes Required:

#### 1. Schema Update
**File**: `db/console/src/schema/tables/workspace-neural-observations.ts`
**Changes**: Add three new embedding columns in the EMBEDDINGS section

Find the existing embedding section (around line 157-163):
```typescript
// ========== EMBEDDINGS ==========

/**
 * Pinecone vector ID for content embedding
 */
embeddingVectorId: varchar("embedding_vector_id", { length: 191 }),
```

Replace with:
```typescript
// ========== EMBEDDINGS ==========

/**
 * @deprecated Use view-specific embedding IDs instead
 * Legacy Pinecone vector ID for combined title+content embedding
 */
embeddingVectorId: varchar("embedding_vector_id", { length: 191 }),

/**
 * Pinecone vector ID for title-only embedding
 * Optimized for topic/headline searches
 */
embeddingTitleId: varchar("embedding_title_id", { length: 191 }),

/**
 * Pinecone vector ID for content-only embedding
 * Optimized for detailed content searches
 */
embeddingContentId: varchar("embedding_content_id", { length: 191 }),

/**
 * Pinecone vector ID for summary embedding
 * Combines title and truncated content for balanced retrieval
 */
embeddingSummaryId: varchar("embedding_summary_id", { length: 191 }),
```

#### 2. Generate Migration
**Command**: Run from `db/console/` directory
```bash
cd db/console && pnpm db:generate
```

This will create a new migration file in `db/console/src/migrations/` with the ALTER TABLE statements.

### Success Criteria:

#### Automated Verification:
- [x] Migration generates successfully: `cd db/console && pnpm db:generate`
- [x] Migration applies cleanly: `cd db/console && pnpm db:migrate`
- [x] Type checking passes: `pnpm --filter @vendor/db typecheck`

#### Manual Verification:
- [ ] New columns visible in Drizzle Studio: `cd db/console && pnpm db:studio`
- [ ] Verify columns are nullable (existing data should not break)

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: Multi-view Embedding Pipeline

### Overview
Modify observation capture workflow to generate 3 embeddings in parallel and store all 3 vectors in Pinecone.

### Changes Required:

#### 1. Embedding Generation Step
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Location**: Replace Step 4 embedding generation (around lines 349-368)

Find the existing embedding step:
```typescript
// Generate embedding
step.run("generate-embedding", async () => {
```

Replace with multi-view embedding generation:
```typescript
// Generate multi-view embeddings (title, content, summary)
step.run("generate-multi-view-embeddings", async () => {
  const embeddingProvider = createEmbeddingProviderForWorkspace(
    {
      id: workspace.id,
      embeddingModel: workspace.embeddingModel,
      embeddingDim: workspace.embeddingDim,
    },
    { inputType: "search_document" }
  );

  // Prepare texts for each view
  const titleText = sourceEvent.title;
  const contentText = sourceEvent.body;
  const summaryText = `${sourceEvent.title}\n\n${sourceEvent.body.slice(0, 1000)}`;

  // Generate all 3 embeddings in parallel (single batch call)
  const result = await embeddingProvider.embed([titleText, contentText, summaryText]);

  if (!result.embeddings[0] || !result.embeddings[1] || !result.embeddings[2]) {
    throw new Error("Failed to generate all multi-view embeddings");
  }

  // Generate view-specific vector IDs
  const baseId = sourceEvent.sourceId.replace(/[^a-zA-Z0-9]/g, "_");

  return {
    title: {
      vectorId: `obs_title_${baseId}`,
      vector: result.embeddings[0]
    },
    content: {
      vectorId: `obs_content_${baseId}`,
      vector: result.embeddings[1]
    },
    summary: {
      vectorId: `obs_summary_${baseId}`,
      vector: result.embeddings[2]
    },
    // Keep legacy ID for backwards compatibility during migration
    legacyVectorId: `obs_${baseId}`,
  };
}),
```

#### 2. Pinecone Upsert Step
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Location**: Replace Step 6 Pinecone upsert (around lines 424-458)

Find the existing upsert step:
```typescript
// Step 6: Upsert to Pinecone
await step.run("upsert-vector", async () => {
```

Replace with multi-view upsert:
```typescript
// Step 6: Upsert multi-view vectors to Pinecone
await step.run("upsert-multi-view-vectors", async () => {
  const namespace = buildWorkspaceNamespace(
    workspace.clerkOrgId,
    workspaceId
  );

  // Base metadata shared across all views
  const baseMetadata = {
    layer: "observations",
    observationType: deriveObservationType(sourceEvent),
    source: sourceEvent.source,
    sourceType: sourceEvent.sourceType,
    sourceId: sourceEvent.sourceId,
    occurredAt: sourceEvent.occurredAt,
    actorName: sourceEvent.actor?.name || "unknown",
  };

  // View-specific metadata
  const titleMetadata: ObservationVectorMetadata = {
    ...baseMetadata,
    view: "title",
    title: sourceEvent.title,
    snippet: sourceEvent.title,
  };

  const contentMetadata: ObservationVectorMetadata = {
    ...baseMetadata,
    view: "content",
    title: sourceEvent.title,
    snippet: sourceEvent.body.slice(0, 500),
  };

  const summaryMetadata: ObservationVectorMetadata = {
    ...baseMetadata,
    view: "summary",
    title: sourceEvent.title,
    snippet: `${sourceEvent.title}\n${sourceEvent.body.slice(0, 300)}`,
  };

  // Batch upsert all 3 vectors
  await consolePineconeClient.upsertVectors<ObservationVectorMetadata>(
    workspace.indexName!,
    {
      ids: [
        embeddingResult.title.vectorId,
        embeddingResult.content.vectorId,
        embeddingResult.summary.vectorId,
      ],
      vectors: [
        embeddingResult.title.vector,
        embeddingResult.content.vector,
        embeddingResult.summary.vector,
      ],
      metadata: [titleMetadata, contentMetadata, summaryMetadata],
    },
    namespace
  );

  log.info("Multi-view vectors upserted to Pinecone", {
    titleVectorId: embeddingResult.title.vectorId,
    contentVectorId: embeddingResult.content.vectorId,
    summaryVectorId: embeddingResult.summary.vectorId,
    namespace,
    indexName: workspace.indexName,
  });
});
```

#### 3. Update ObservationVectorMetadata Type
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts` (or types file)
**Changes**: Add `view` field to metadata type

```typescript
type ObservationVectorMetadata = {
  layer: "observations";
  view?: "title" | "content" | "summary"; // NEW: identifies embedding view
  observationType: string;
  source: string;
  sourceType: string;
  sourceId: string;
  title: string;
  snippet: string;
  occurredAt: string;
  actorName: string;
};
```

#### 4. Database Storage Update
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Location**: Update observation insert (around line 485)

Find the existing insert:
```typescript
embeddingVectorId: vectorId,
```

Replace with multi-view IDs:
```typescript
embeddingVectorId: embeddingResult.legacyVectorId, // Keep for backwards compat
embeddingTitleId: embeddingResult.title.vectorId,
embeddingContentId: embeddingResult.content.vectorId,
embeddingSummaryId: embeddingResult.summary.vectorId,
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @api/console typecheck`
- [x] Linting passes: `pnpm --filter @api/console lint` (pre-existing issues in file, no new errors)
- [x] Build succeeds: `pnpm --filter @api/console build`

#### Manual Verification:
- [ ] Trigger a webhook event (GitHub PR comment, etc.)
- [ ] Verify Inngest dashboard shows successful observation capture
- [ ] Check Drizzle Studio: new observation has all 3 embedding IDs populated
- [ ] Query Pinecone directly: 3 vectors exist with correct view metadata

**Implementation Note**: After completing this phase and verifying vectors appear in Pinecone, proceed to Phase 3.

---

## Phase 3: Temporal State Table

### Overview
Create new bi-temporal table for tracking entity state changes over time.

### Changes Required:

#### 1. Create Schema File
**File**: `db/console/src/schema/tables/workspace-temporal-states.ts` (NEW FILE)

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
export type TemporalEntityType = "project" | "feature" | "service" | "sprint" | "issue" | "pr";

/**
 * State types for temporal tracking
 */
export type TemporalStateType = "status" | "progress" | "health" | "risk" | "priority" | "assignee";

/**
 * Bi-temporal state tracking for engineering entities
 * Enables point-in-time queries like "what was the status of Project X last month?"
 *
 * Uses SCD Type 2 pattern with validFrom/validTo for state validity periods.
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
     * Type of entity being tracked (project, feature, issue, etc.)
     */
    entityType: varchar("entity_type", { length: 50 })
      .notNull()
      .$type<TemporalEntityType>(),

    /**
     * Entity identifier (e.g., Linear issue ID, GitHub PR number)
     */
    entityId: varchar("entity_id", { length: 191 }).notNull(),

    /**
     * Human-readable entity name for display
     */
    entityName: varchar("entity_name", { length: 255 }),

    // ========== STATE ==========

    /**
     * Type of state being tracked (status, progress, health, etc.)
     */
    stateType: varchar("state_type", { length: 50 })
      .notNull()
      .$type<TemporalStateType>(),

    /**
     * Current state value (e.g., "in_progress", "blocked", "high")
     */
    stateValue: varchar("state_value", { length: 255 }).notNull(),

    /**
     * Previous state value for audit trail
     */
    previousValue: varchar("previous_value", { length: 255 }),

    /**
     * Additional state metadata (percentage complete, blockers, etc.)
     */
    stateMetadata: jsonb("state_metadata").$type<Record<string, unknown>>(),

    // ========== TEMPORAL (Bi-temporal) ==========

    /**
     * When this state became valid (in reality / business time)
     * This is when the state change actually happened
     */
    validFrom: timestamp("valid_from", {
      mode: "string",
      withTimezone: true,
    }).notNull(),

    /**
     * When this state stopped being valid (null = still current)
     * Set when a new state supersedes this one
     */
    validTo: timestamp("valid_to", {
      mode: "string",
      withTimezone: true,
    }),

    /**
     * Fast lookup flag for current state (only one per entity+stateType)
     */
    isCurrent: boolean("is_current").default(true).notNull(),

    // ========== CHANGE METADATA ==========

    /**
     * Actor who made this change (resolved actor ID)
     */
    changedByActorId: varchar("changed_by_actor_id", { length: 191 }),

    /**
     * Reason for the change (optional description)
     */
    changeReason: text("change_reason"),

    /**
     * Observation that triggered this state change
     */
    sourceObservationId: varchar("source_observation_id", { length: 191 }),

    /**
     * External source of the state change (github, linear, etc.)
     */
    source: varchar("source", { length: 50 }),

    // ========== TIMESTAMPS ==========

    /**
     * System time when this record was created
     */
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for point-in-time entity queries: "what was status at time T?"
    entityTimeIdx: index("temporal_entity_time_idx").on(
      table.workspaceId,
      table.entityType,
      table.entityId,
      table.stateType,
      table.validFrom,
    ),

    // Index for current state lookups (fast path)
    currentIdx: index("temporal_current_idx").on(
      table.workspaceId,
      table.entityType,
      table.entityId,
      table.isCurrent,
    ),

    // Index for workspace + entity type queries (dashboard views)
    workspaceEntityIdx: index("temporal_workspace_entity_idx").on(
      table.workspaceId,
      table.entityType,
    ),

    // Index for finding states by source observation
    sourceObsIdx: index("temporal_source_obs_idx").on(
      table.sourceObservationId,
    ),
  }),
);

export type WorkspaceTemporalState = typeof workspaceTemporalStates.$inferSelect;
export type InsertWorkspaceTemporalState = typeof workspaceTemporalStates.$inferInsert;
```

#### 2. Export from Index
**File**: `db/console/src/schema/tables/index.ts`
**Changes**: Add export for new table

Add after the neural memory table exports (around line 23):
```typescript
export * from "./workspace-temporal-states";
```

#### 3. Add Relations (Optional but recommended)
**File**: `db/console/src/schema/relations.ts`
**Changes**: Add temporal state relations

Add after existing relations:
```typescript
// Temporal states relation
export const workspaceTemporalStatesRelations = relations(
  workspaceTemporalStates,
  ({ one }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceTemporalStates.workspaceId],
      references: [orgWorkspaces.id],
    }),
  }),
);
```

Remember to import the table at the top of the file.

#### 4. Generate Migration
**Command**: Run from `db/console/` directory
```bash
cd db/console && pnpm db:generate
```

### Success Criteria:

#### Automated Verification:
- [x] Migration generates: `cd db/console && pnpm db:generate`
- [x] Migration applies: `cd db/console && pnpm db:migrate`
- [x] Type checking passes: `pnpm --filter @vendor/db typecheck`

#### Manual Verification:
- [ ] Table visible in Drizzle Studio
- [ ] All indexes created correctly
- [ ] Can insert test record via Studio

**Implementation Note**: After completing this phase, proceed to Phase 4.

---

## Phase 4: Temporal State Utility Functions

### Overview
Create utility functions for point-in-time queries and state updates.

### Changes Required:

#### 1. Create Temporal Utils Module
**File**: `apps/console/src/lib/neural/temporal-state.ts` (NEW FILE)

```typescript
import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { db } from "@db/console";
import {
  workspaceTemporalStates,
  type WorkspaceTemporalState,
  type InsertWorkspaceTemporalState,
  type TemporalEntityType,
  type TemporalStateType,
} from "@db/console/schema";

/**
 * Get the state of an entity at a specific point in time
 * Uses bi-temporal query: validFrom <= pointInTime < validTo (or validTo is null)
 */
export async function getStateAt(
  workspaceId: string,
  entityType: TemporalEntityType,
  entityId: string,
  stateType: TemporalStateType,
  pointInTime: Date
): Promise<WorkspaceTemporalState | null> {
  const [state] = await db
    .select()
    .from(workspaceTemporalStates)
    .where(
      and(
        eq(workspaceTemporalStates.workspaceId, workspaceId),
        eq(workspaceTemporalStates.entityType, entityType),
        eq(workspaceTemporalStates.entityId, entityId),
        eq(workspaceTemporalStates.stateType, stateType),
        lte(workspaceTemporalStates.validFrom, pointInTime.toISOString()),
        or(
          isNull(workspaceTemporalStates.validTo),
          gt(workspaceTemporalStates.validTo, pointInTime.toISOString())
        )
      )
    )
    .limit(1);

  return state ?? null;
}

/**
 * Get the current state of an entity (uses isCurrent flag for fast lookup)
 */
export async function getCurrentState(
  workspaceId: string,
  entityType: TemporalEntityType,
  entityId: string,
  stateType: TemporalStateType
): Promise<WorkspaceTemporalState | null> {
  const [state] = await db
    .select()
    .from(workspaceTemporalStates)
    .where(
      and(
        eq(workspaceTemporalStates.workspaceId, workspaceId),
        eq(workspaceTemporalStates.entityType, entityType),
        eq(workspaceTemporalStates.entityId, entityId),
        eq(workspaceTemporalStates.stateType, stateType),
        eq(workspaceTemporalStates.isCurrent, true)
      )
    )
    .limit(1);

  return state ?? null;
}

/**
 * Get state history for an entity (all state changes over time)
 */
export async function getStateHistory(
  workspaceId: string,
  entityType: TemporalEntityType,
  entityId: string,
  stateType: TemporalStateType,
  limit = 50
): Promise<WorkspaceTemporalState[]> {
  return db
    .select()
    .from(workspaceTemporalStates)
    .where(
      and(
        eq(workspaceTemporalStates.workspaceId, workspaceId),
        eq(workspaceTemporalStates.entityType, entityType),
        eq(workspaceTemporalStates.entityId, entityId),
        eq(workspaceTemporalStates.stateType, stateType)
      )
    )
    .orderBy(desc(workspaceTemporalStates.validFrom))
    .limit(limit);
}

/**
 * Record a new state change (closes previous state, opens new one)
 * Uses transaction for atomicity
 */
export async function recordStateChange(
  input: Omit<InsertWorkspaceTemporalState, "id" | "isCurrent" | "createdAt" | "validTo">
): Promise<WorkspaceTemporalState> {
  return db.transaction(async (tx) => {
    // 1. Close the previous current state (if exists)
    await tx
      .update(workspaceTemporalStates)
      .set({
        isCurrent: false,
        validTo: input.validFrom, // Previous state ends when new one begins
      })
      .where(
        and(
          eq(workspaceTemporalStates.workspaceId, input.workspaceId),
          eq(workspaceTemporalStates.entityType, input.entityType),
          eq(workspaceTemporalStates.entityId, input.entityId),
          eq(workspaceTemporalStates.stateType, input.stateType),
          eq(workspaceTemporalStates.isCurrent, true)
        )
      );

    // 2. Insert the new current state
    const [newState] = await tx
      .insert(workspaceTemporalStates)
      .values({
        ...input,
        isCurrent: true,
        validTo: null, // Current state has no end time
      })
      .returning();

    return newState;
  });
}

/**
 * Get all current states for entities of a type in a workspace
 * Useful for dashboard views
 */
export async function getAllCurrentStates(
  workspaceId: string,
  entityType: TemporalEntityType,
  stateType?: TemporalStateType
): Promise<WorkspaceTemporalState[]> {
  const conditions = [
    eq(workspaceTemporalStates.workspaceId, workspaceId),
    eq(workspaceTemporalStates.entityType, entityType),
    eq(workspaceTemporalStates.isCurrent, true),
  ];

  if (stateType) {
    conditions.push(eq(workspaceTemporalStates.stateType, stateType));
  }

  return db
    .select()
    .from(workspaceTemporalStates)
    .where(and(...conditions))
    .orderBy(desc(workspaceTemporalStates.validFrom));
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint` (pre-existing issues, no new errors)

#### Manual Verification:
- [ ] Import and call functions from a test script or tRPC endpoint
- [ ] Verify point-in-time query returns correct state
- [ ] Verify state history returns ordered results

**Implementation Note**: After completing this phase, proceed to Phase 5.

---

## Phase 5: Cluster Search Path

### Overview
Add cluster search to the retrieval governor for context-aware results.

### Changes Required:

#### 1. Create Cluster Search Module
**File**: `apps/console/src/lib/neural/cluster-search.ts` (NEW FILE)

```typescript
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@db/console";
import { workspaceObservationClusters } from "@db/console/schema";
import { consolePineconeClient } from "@/lib/pinecone/client";

export interface ClusterSearchResult {
  clusterId: string;
  topicLabel: string | null;
  summary: string | null;
  keywords: string[];
  score: number;
  observationCount: number;
}

/**
 * Search for relevant clusters based on query embedding
 * Queries Pinecone for cluster centroids and enriches with database metadata
 */
export async function searchClusters(
  workspaceId: string,
  indexName: string,
  namespace: string,
  queryEmbedding: number[],
  topK = 3
): Promise<{ results: ClusterSearchResult[]; latency: number }> {
  const startTime = Date.now();

  try {
    // 1. Query Pinecone for similar cluster centroids
    const pineconeResults = await consolePineconeClient.query(
      indexName,
      {
        vector: queryEmbedding,
        topK,
        filter: { layer: { $eq: "clusters" } },
        includeMetadata: true,
      },
      namespace
    );

    if (!pineconeResults.matches || pineconeResults.matches.length === 0) {
      return { results: [], latency: Date.now() - startTime };
    }

    // 2. Extract cluster IDs from vector IDs (format: cluster_{nanoid})
    const clusterEmbeddingIds = pineconeResults.matches.map((m) => m.id);

    // 3. Fetch cluster metadata from database
    const clusters = await db
      .select({
        id: workspaceObservationClusters.id,
        topicLabel: workspaceObservationClusters.topicLabel,
        summary: workspaceObservationClusters.summary,
        keywords: workspaceObservationClusters.keywords,
        observationCount: workspaceObservationClusters.observationCount,
        topicEmbeddingId: workspaceObservationClusters.topicEmbeddingId,
      })
      .from(workspaceObservationClusters)
      .where(
        and(
          eq(workspaceObservationClusters.workspaceId, workspaceId),
          inArray(workspaceObservationClusters.topicEmbeddingId, clusterEmbeddingIds)
        )
      );

    // 4. Merge Pinecone scores with database metadata
    const results: ClusterSearchResult[] = clusters.map((cluster) => {
      const pineconeMatch = pineconeResults.matches.find(
        (m) => m.id === cluster.topicEmbeddingId
      );

      return {
        clusterId: cluster.id,
        topicLabel: cluster.topicLabel,
        summary: cluster.summary,
        keywords: (cluster.keywords as string[]) ?? [],
        score: pineconeMatch?.score ?? 0,
        observationCount: cluster.observationCount,
      };
    });

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return {
      results,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Cluster search failed:", error);
    // Graceful degradation: return empty results on error
    return { results: [], latency: Date.now() - startTime };
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint` (pre-existing issues, no new errors)

#### Manual Verification:
- [ ] Call function with test embedding
- [ ] Verify clusters with matching topics are returned
- [ ] Check latency is reasonable (<500ms)

**Implementation Note**: After completing this phase, proceed to Phase 6.

---

## Phase 6: Actor Profile Search Path

### Overview
Add actor profile search to retrieve relevant team members based on query.

### Changes Required:

#### 1. Create Actor Search Module
**File**: `apps/console/src/lib/neural/actor-search.ts` (NEW FILE)

```typescript
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@db/console";
import { workspaceActorProfiles, workspaceActorIdentities } from "@db/console/schema";

export interface ActorSearchResult {
  actorId: string;
  displayName: string | null;
  expertiseDomains: string[];
  observationCount: number;
  lastActiveAt: string | null;
  matchType: "mention" | "expertise" | "name";
  score: number;
}

/**
 * Extract actor mentions from query text
 * Patterns: @username, "John Doe", engineer names
 */
function extractActorMentions(query: string): string[] {
  const mentions: string[] = [];

  // @username pattern
  const atMentions = query.match(/@([a-zA-Z0-9_-]{1,39})\b/g);
  if (atMentions) {
    mentions.push(...atMentions.map((m) => m.slice(1).toLowerCase()));
  }

  // "Name" in quotes pattern (often used for person names)
  const quotedNames = query.match(/"([^"]+)"/g);
  if (quotedNames) {
    mentions.push(...quotedNames.map((m) => m.slice(1, -1).toLowerCase()));
  }

  return [...new Set(mentions)]; // Deduplicate
}

/**
 * Search for relevant actor profiles based on query
 * Matches by @mentions, display names, and expertise domains
 */
export async function searchActorProfiles(
  workspaceId: string,
  query: string,
  topK = 5
): Promise<{ results: ActorSearchResult[]; latency: number }> {
  const startTime = Date.now();

  try {
    const mentions = extractActorMentions(query);
    const queryLower = query.toLowerCase();

    // 1. Search by explicit @mentions
    let mentionMatches: ActorSearchResult[] = [];
    if (mentions.length > 0) {
      const identities = await db
        .select({
          actorId: workspaceActorIdentities.actorId,
          sourceUsername: workspaceActorIdentities.sourceUsername,
        })
        .from(workspaceActorIdentities)
        .where(
          and(
            eq(workspaceActorIdentities.workspaceId, workspaceId),
            or(
              ...mentions.map((m) =>
                ilike(workspaceActorIdentities.sourceUsername, `%${m}%`)
              )
            )
          )
        )
        .limit(topK);

      const actorIds = identities.map((i) => i.actorId);

      if (actorIds.length > 0) {
        const profiles = await db
          .select()
          .from(workspaceActorProfiles)
          .where(
            and(
              eq(workspaceActorProfiles.workspaceId, workspaceId),
              or(...actorIds.map((id) => eq(workspaceActorProfiles.actorId, id)))
            )
          );

        mentionMatches = profiles.map((p) => ({
          actorId: p.actorId,
          displayName: p.displayName,
          expertiseDomains: (p.expertiseDomains as string[]) ?? [],
          observationCount: p.observationCount,
          lastActiveAt: p.lastActiveAt,
          matchType: "mention" as const,
          score: 0.95, // High score for explicit mentions
        }));
      }
    }

    // 2. Search by display name (fuzzy match)
    const nameMatches = await db
      .select()
      .from(workspaceActorProfiles)
      .where(
        and(
          eq(workspaceActorProfiles.workspaceId, workspaceId),
          ilike(workspaceActorProfiles.displayName, `%${queryLower}%`)
        )
      )
      .orderBy(desc(workspaceActorProfiles.observationCount))
      .limit(topK);

    const nameResults: ActorSearchResult[] = nameMatches
      .filter((p) => !mentionMatches.some((m) => m.actorId === p.actorId))
      .map((p) => ({
        actorId: p.actorId,
        displayName: p.displayName,
        expertiseDomains: (p.expertiseDomains as string[]) ?? [],
        observationCount: p.observationCount,
        lastActiveAt: p.lastActiveAt,
        matchType: "name" as const,
        score: 0.75, // Medium score for name matches
      }));

    // 3. Combine and deduplicate results
    const allResults = [...mentionMatches, ...nameResults];

    // Sort by score then by observation count
    allResults.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.observationCount - a.observationCount;
    });

    return {
      results: allResults.slice(0, topK),
      latency: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Actor search failed:", error);
    return { results: [], latency: Date.now() - startTime };
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint` (pre-existing issues, no new errors)

#### Manual Verification:
- [ ] Query with @mention returns correct actor
- [ ] Query with name returns matching profiles
- [ ] Check latency is reasonable (<200ms)

**Implementation Note**: After completing this phase, proceed to Phase 7.

---

## Phase 7: Enhanced Retrieval Integration

### Overview
Integrate cluster and actor search paths into the main search route.

### Changes Required:

#### 1. Update Search Route
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`
**Location**: After vector and entity search, add cluster and actor paths

Add imports at top:
```typescript
import { searchClusters } from "@/lib/neural/cluster-search";
import { searchActorProfiles } from "@/lib/neural/actor-search";
```

Find the parallel search section (around lines 308-347):
```typescript
const [vectorResults, entityResults] = await Promise.all([
```

Replace with 4-path parallel search:
```typescript
// 4-path parallel retrieval
const [vectorResults, entityResults, clusterResults, actorResults] = await Promise.all([
  // Path 1: Vector similarity search
  (async () => {
    const results = await consolePineconeClient.query<VectorMetadata>(
      workspace.indexName,
      {
        vector: queryVector,
        topK,
        includeMetadata: true,
        filter: buildPineconeFilter(filters),
      },
      workspace.namespaceName
    );
    return { results, latency: Date.now() - startTime };
  })(),

  // Path 2: Entity search
  searchByEntities(query, workspaceId, topK),

  // Path 3: Cluster context search (NEW)
  searchClusters(
    workspaceId,
    workspace.indexName!,
    workspace.namespaceName!,
    queryVector,
    3 // Top 3 clusters
  ),

  // Path 4: Actor profile search (NEW)
  searchActorProfiles(workspaceId, query, 5),
]);
```

#### 2. Update Fusion Scoring
**File**: Same file, update `mergeSearchResults` function

Add cluster and actor results to fusion:
```typescript
function mergeSearchResults(
  vectorMatches: QueryMatch[],
  entityResults: EntitySearchResult[],
  clusterResults: ClusterSearchResult[],
  actorResults: ActorSearchResult[],
  limit: number
): FilterCandidate[] {
  const resultMap = new Map<string, FilterCandidate>();

  // Add vector matches (same as before)
  for (const match of vectorMatches) {
    resultMap.set(match.id, {
      id: match.id,
      title: String(match.metadata?.title ?? ""),
      snippet: String(match.metadata?.snippet ?? ""),
      score: match.score,
    });
  }

  // Boost from entity matches (same as before)
  for (const entity of entityResults) {
    const existing = resultMap.get(entity.observationId);
    if (existing) {
      existing.score = Math.min(1.0, existing.score + 0.2);
    } else {
      resultMap.set(entity.observationId, {
        id: entity.observationId,
        title: entity.title,
        snippet: entity.snippet,
        score: 0.85 * entity.confidence,
      });
    }
  }

  // Add cluster context (NEW) - boost observations in matching clusters
  // Note: This is a simplified implementation. Full implementation would
  // fetch observations from matching clusters and boost their scores.

  return Array.from(resultMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

#### 3. Update Latency Tracking
**File**: Same file, update response latency object

```typescript
latency: {
  total: Date.now() - startTime,
  retrieval: vectorResults.latency,
  entitySearch: entityResults.latency,
  clusterSearch: clusterResults.latency, // NEW
  actorSearch: actorResults.latency,     // NEW
  llmFilter: filterResult.latency,
}
```

#### 4. Include Cluster/Actor Context in Response
**File**: Same file, add to response

```typescript
return NextResponse.json({
  results: searchResults,
  requestId,
  context: {
    clusters: clusterResults.results.slice(0, 2).map((c) => ({
      topic: c.topicLabel,
      summary: c.summary,
      keywords: c.keywords,
    })),
    relevantActors: actorResults.results.slice(0, 3).map((a) => ({
      displayName: a.displayName,
      expertise: a.expertiseDomains,
    })),
  },
  latency: { ... },
});
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Search API returns cluster context in response
- [ ] Search API returns relevant actors in response
- [ ] All 4 latency metrics tracked in response
- [ ] Query with @mention boosts relevant results
- [ ] Query about topic returns cluster context

**Implementation Note**: This completes the Day 5 implementation.

---

## Testing Strategy

### Unit Tests:
- Temporal state utility functions (getStateAt, recordStateChange)
- Cluster search module
- Actor search module
- Multi-view embedding ID generation

### Integration Tests:
- End-to-end observation capture with 3 vectors
- Search with cluster and actor results
- Point-in-time temporal queries

### Manual Testing Steps:
1. Trigger webhook (GitHub PR comment)
2. Verify 3 vectors in Pinecone (check with `view` metadata)
3. Search for the observation content
4. Verify cluster context in response
5. Search with @mention and verify actor results
6. Create temporal state and query at different times

## Performance Considerations

### Multi-view Embeddings
- **3x embedding calls**: Use batch API to minimize latency
- **3x Pinecone vectors**: Increases storage but enables view-specific retrieval
- **Migration**: Existing observations keep legacy vectorId, new ones get all 3

### Retrieval
- **4 parallel paths**: Total latency = max(path latencies), not sum
- **Cluster search**: Limited to top 3 to minimize DB queries
- **Actor search**: Limited to top 5 with early termination

### Temporal States
- **isCurrent flag**: Enables O(1) current state lookup
- **Composite indexes**: Support point-in-time queries efficiently

## Migration Notes

### Backwards Compatibility
- Keep `embeddingVectorId` populated for existing queries
- New observations populate all 4 vector ID fields
- Old observations with only `embeddingVectorId` continue to work

### Data Migration (Optional Future)
- Could backfill multi-view embeddings for existing observations
- Run as background job, not blocking

## References

- Original research: `thoughts/shared/research/2025-12-13-neural-memory-day5-implementation-map.md`
- Day 4 implementation: `api/console/src/inngest/workflow/neural/cluster-assignment.ts`
- Observation capture: `api/console/src/inngest/workflow/neural/observation-capture.ts`
- Search route: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`
- Entity search: `apps/console/src/lib/neural/entity-search.ts`
