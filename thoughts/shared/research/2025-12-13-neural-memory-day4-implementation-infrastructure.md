---
date: 2025-12-13T08:00:00+08:00
researcher: Claude
git_commit: c3373ebba2cdffc203f060674e6b90b4501017a3
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Day 4 Implementation Infrastructure - Clusters, Actor Resolution, Profiles"
tags: [research, codebase, neural-memory, clusters, actor-resolution, profiles, inngest]
status: complete
last_updated: 2025-12-13
last_updated_by: Claude
---

# Research: Day 4 Implementation Infrastructure

**Date**: 2025-12-13T08:00:00+08:00
**Researcher**: Claude
**Git Commit**: c3373ebba2cdffc203f060674e6b90b4501017a3
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Document the existing infrastructure for Day 4 implementation of the neural memory system:
1. Cluster schema and assignment algorithm infrastructure
2. Actor resolution current state and three-tier implementation
3. Actor profile schema status
4. Fire-and-forget patterns for profile/cluster updates
5. LLM summary generation patterns
6. Embedding similarity patterns for cluster assignment

## Summary

Day 4 implementation has **strong infrastructure foundations**:

| Component | Status | Details |
|-----------|--------|---------|
| **Cluster Schema** | READY | Table exists, migrated, indexed |
| **Actor Resolution** | PLACEHOLDER | Function exists, returns passthrough |
| **Actor Profile Schema** | NOT CREATED | Documented only, needs migration |
| **Fire-and-Forget Patterns** | READY | 9+ patterns documented in codebase |
| **LLM Summary Patterns** | READY | `generateObject()` patterns available |
| **Embedding Similarity** | READY | Pinecone cosine + score combination |

**Key Finding**: Cluster assignment can proceed immediately. Actor profiles require schema creation first.

---

## Detailed Findings

### 1. Cluster Schema (READY)

**Status**: Complete - table exists and is migrated to database.

**Primary Schema File**: `db/console/src/schema/tables/workspace-observation-clusters.ts`

```typescript
export const workspaceObservationClusters = pgTable(
  "lightfast_workspace_observation_clusters",
  {
    id: varchar("id", { length: 191 }).notNull().primaryKey().$defaultFn(() => nanoid()),
    workspaceId: varchar("workspace_id", { length: 191 }).notNull(),

    // Topic identification
    topicLabel: varchar("topic_label", { length: 255 }).notNull(),
    topicEmbeddingId: varchar("topic_embedding_id", { length: 191 }),
    keywords: jsonb("keywords").$type<string[]>(),

    // Scope
    primaryEntities: jsonb("primary_entities").$type<string[]>(),
    primaryActors: jsonb("primary_actors").$type<string[]>(),

    // Status
    status: varchar("status", { length: 50 }).notNull().default("open"),

    // Summary
    summary: text("summary"),
    summaryGeneratedAt: timestamp("summary_generated_at", { mode: "string", withTimezone: true }),

    // Metrics
    observationCount: integer("observation_count").notNull().default(0),
    firstObservationAt: timestamp("first_observation_at", { mode: "string", withTimezone: true }),
    lastObservationAt: timestamp("last_observation_at", { mode: "string", withTimezone: true }),

    createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).defaultNow(),
  }
);
```

**Indexes** (from migration `0004_big_arachne.sql`):
- `cluster_workspace_status_idx` on (workspace_id, status)
- `cluster_last_observation_idx` on (workspace_id, last_observation_at DESC)

**Relations** (`db/console/src/schema/relations.ts:81-90`):
- `workspaceObservationClusters` has many `observations`
- `workspaceNeuralObservations` has optional `cluster` relation

**Observation Schema Integration** (`workspace-neural-observations.ts:67`):
```typescript
clusterId: varchar("cluster_id", { length: 191 }),
// Index: obs_cluster_idx on clusterId
```

**Import Path**:
```typescript
import { workspaceObservationClusters } from "@db/console/schema";
```

---

### 2. Actor Resolution (PLACEHOLDER)

**Status**: Placeholder exists - returns passthrough without resolution.

**Current Implementation** (`api/console/src/inngest/workflow/neural/actor-resolution.ts:49-61`):

```typescript
export async function resolveActor(
  _workspaceId: string,
  sourceEvent: SourceEvent
): Promise<ResolvedActor> {
  // TODO (Day 4): Implement three-tier resolution
  return {
    sourceActor: sourceEvent.actor || null,
    resolvedUserId: null,
    confidence: 0,
    method: "unresolved",
  };
}
```

**ResolvedActor Interface** (lines 33-42):
```typescript
interface ResolvedActor {
  sourceActor: SourceActor | null;
  resolvedUserId: string | null;  // Clerk user ID
  confidence: number;              // 0-1.0 scale
  method: "oauth" | "email" | "heuristic" | "unresolved";
}
```

**Three-Tier Resolution Strategy** (documented in file):

| Tier | Confidence | Method |
|------|------------|--------|
| 1 | 1.0 | OAuth connection match - match `actor.id` to `user-sources.providerAccountId` |
| 2 | 0.85 | Email matching - match `actor.email` to workspace member emails via Clerk |
| 3 | 0.60 | Heuristic matching - username similarity, display name |

**Current Actor Usage** (`observation-capture.ts:443-444`):
```typescript
// TODO (Day 4): Replace passthrough with resolveActor() call
actor: sourceEvent.actor || null,
```

**Actor ID Format Patterns** (from transformers):
- Push events: `"github:{username}"` (string)
- PR/Issue events: `"github:{numeric_id}"` (number)
- Vercel: `"github:{commit_author_name}"` (string)

**Available Infrastructure for Resolution**:
- `user-sources` table with OAuth connections
- Clerk API for member email lookup
- `workspace-integrations` linking sources to workspaces

**Missing for Implementation**:
- `providerAccountId` field in user-sources table
- Actor profile tables (see section 3)
- Resolution metadata storage in observations

---

### 3. Actor Profile Schema (NOT CREATED)

**Status**: NOT CREATED - exists only in documentation.

**Planned Tables** (from `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md:1267-1322`):

#### workspace_actor_profiles
```sql
CREATE TABLE workspace_actor_profiles (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,

  -- Identity
  actor_id VARCHAR(191) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  avatar_url TEXT,

  -- Expertise
  expertise_domains JSONB,
  contribution_types JSONB,
  active_hours JSONB,
  frequent_collaborators JSONB,

  -- Embedding
  profile_embedding_id VARCHAR(191),

  -- Stats
  observation_count INTEGER DEFAULT 0,
  last_active_at TIMESTAMP WITH TIME ZONE,
  profile_confidence FLOAT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT uq_actor_profile UNIQUE (workspace_id, actor_id)
);
```

#### workspace_actor_identities
```sql
CREATE TABLE workspace_actor_identities (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,
  actor_id VARCHAR(191) NOT NULL,

  -- Source identity
  source VARCHAR(50) NOT NULL,
  source_id VARCHAR(255) NOT NULL,
  source_username VARCHAR(255),
  source_email VARCHAR(255),

  -- Mapping metadata
  mapping_method VARCHAR(50) NOT NULL,
  confidence_score FLOAT NOT NULL,
  mapped_by VARCHAR(191),
  mapped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT uq_identity UNIQUE (workspace_id, source, source_id)
);
```

**Files to Create**:
1. `db/console/src/schema/tables/workspace-actor-profiles.ts`
2. `db/console/src/schema/tables/workspace-actor-identities.ts`
3. Update `db/console/src/schema/tables/index.ts` with exports
4. Update `db/console/src/schema/relations.ts` with relations
5. Run `pnpm db:generate` to create migration

---

### 4. Fire-and-Forget Patterns (READY)

**Status**: 9+ patterns documented in codebase.

#### Pattern A: Simple Fire-and-Forget
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts:505-518`

```typescript
await step.sendEvent("emit-captured", {
  name: "apps-console/neural/observation.captured",
  data: {
    workspaceId,
    observationId: observation.id,
    significanceScore: significance.score,
    topics,
    entitiesExtracted: extractedEntities.length,
  },
});
```

#### Pattern B: Batch Events Array
**File**: `api/console/src/inngest/workflow/processing/process-documents.ts:340-348`

```typescript
const eventsToSend = items.map((item) => ({
  name: "apps-console/relationships.extract" as const,
  data: { documentId: item.id, workspaceId },
}));
await step.sendEvent("trigger-extraction", eventsToSend);
```

#### Pattern C: Fire + Wait for Completion
**File**: `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts:192-206`

```typescript
// Fire
await step.sendEvent("trigger-source-sync", {
  name: "apps-console/github.sync.trigger",
  data: { jobId, workspaceId },
});

// Wait
const result = await step.waitForEvent("await-completion", {
  event: "apps-console/github.sync.completed",
  match: "data.jobId",
  timeout: "25m",
});
```

#### Pattern D: Latest-Wins Singleton (Debounce Alternative)
**File**: `api/console/src/inngest/workflow/providers/github/push-handler.ts:48-51`

```typescript
singleton: {
  key: "event.data.sourceId",
  mode: "cancel",  // Cancels in-flight, latest wins
},
```

**Event Naming Conventions**:
- Command events (imperative): `observation.capture`, `sync.requested`
- Completion events (past tense): `observation.captured`, `sync.completed`

**Day 4 Fire-and-Forget Events** (to create):
- `apps-console/neural/profile.update` - Trigger profile recalculation
- `apps-console/neural/cluster.check-summary` - Trigger summary generation

---

### 5. LLM Summary Generation Patterns (READY)

**Status**: Multiple patterns available in codebase.

#### Pattern A: generateObject with Zod Schema
**File**: `apps/console/src/lib/neural/llm-filter.ts:97-103`

```typescript
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";

const schema = z.object({
  scores: z.array(z.object({
    id: z.string(),
    relevance: z.number().min(0).max(1),
  })),
});

const { object } = await generateObject({
  model: gateway("openai/gpt-5.1-instant"),
  schema,
  prompt: buildPrompt(query, candidates),
  temperature: 0.1,
});
```

#### Pattern B: generateText for Simple Output
**File**: `api/chat/src/inngest/workflow/generate-chat-title.ts:88-101`

```typescript
import { generateText } from "ai";

const { text } = await generateText({
  model: gateway("openai/gpt-5-nano"),
  system: `Generate a concise title (2-4 words)...`,
  prompt: `Generate a title for: ${context}`,
  temperature: 0.5,
});
```

#### Pattern C: Error Handling with Fallback
**File**: `apps/console/src/lib/neural/llm-filter.ts:143-161`

```typescript
try {
  const { object } = await generateObject({ ... });
  return { results, bypassed: false };
} catch (error) {
  log.error("LLM failed, using fallback", { error });
  return { results: fallbackResults, bypassed: true };
}
```

**Model Selection Guidelines**:

| Use Case | Model | Temperature |
|----------|-------|-------------|
| Fast scoring | `gateway("openai/gpt-5.1-instant")` | 0.1 |
| Simple text | `gateway("openai/gpt-5-nano")` | 0.5 |
| Complex reasoning | `anthropic("claude-3-5-sonnet-latest")` | default |
| Cluster summaries (planned) | `anthropic("claude-3-5-haiku-latest")` | 0.3 |

**Cluster Summary Schema** (to implement):
```typescript
const clusterSummarySchema = z.object({
  summary: z.string().max(500),
  keyTopics: z.array(z.string()).max(5),
  keyContributors: z.array(z.string()).max(5),
  status: z.enum(["active", "completed", "stalled"]),
});
```

---

### 6. Embedding Similarity Patterns (READY)

**Status**: Pinecone cosine similarity + score combination patterns available.

#### Pattern A: Pinecone Query (Built-in Cosine)
**File**: `vendor/pinecone/src/client.ts:210-244`

```typescript
const results = await targetNamespace.query({
  vector: queryVector,
  topK: 50,
  filter: { layer: { $eq: "observations" } },
  includeMetadata: true,
});

// results.matches[].score is cosine similarity (0-1)
```

#### Pattern B: Score Combination (Vector + LLM)
**File**: `apps/console/src/lib/neural/llm-filter.ts:50-126`

```typescript
const DEFAULT_OPTIONS = {
  minConfidence: 0.4,
  llmWeight: 0.6,
  vectorWeight: 0.4,
};

const finalScore = opts.llmWeight * relevanceScore + opts.vectorWeight * vectorScore;
```

#### Pattern C: Entity-Based Score Boosting
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts:126-168`

```typescript
// Boost existing result with entity match
existing.score = Math.min(1.0, existing.score + 0.2);

// New entity match base score
newResult.score = 0.85 * entity.confidence;
```

**Cluster Assignment Algorithm** (to implement based on E2E design):

```typescript
async function calculateClusterAffinity(
  cluster: ObservationCluster,
  observation: Observation
): Promise<number> {
  let score = 0;

  // 1. Embedding similarity (0-40 points)
  const similarity = await querySimilarityFromPinecone(
    cluster.topicEmbeddingId,
    observation.embeddingVectorId
  );
  score += similarity * 40;

  // 2. Entity overlap (0-30 points)
  const entityOverlap = calculateOverlap(
    cluster.primaryEntities,
    observation.relatedEntityIds
  );
  score += entityOverlap * 30;

  // 3. Actor overlap (0-20 points)
  const actorOverlap = cluster.primaryActors.includes(observation.actorId) ? 20 : 0;
  score += actorOverlap;

  // 4. Temporal proximity (0-10 points)
  const hoursSince = differenceInHours(new Date(), cluster.lastObservationAt);
  score += Math.max(0, 10 - hoursSince);

  return score;
}

const CLUSTER_AFFINITY_THRESHOLD = 60;
```

---

## Code References

### Cluster Schema
- `db/console/src/schema/tables/workspace-observation-clusters.ts` - Full schema
- `db/console/src/schema/tables/workspace-neural-observations.ts:67` - clusterId field
- `db/console/src/schema/relations.ts:81-90` - Cluster relations
- `db/console/src/migrations/0004_big_arachne.sql:23-52` - Migration

### Actor Resolution
- `api/console/src/inngest/workflow/neural/actor-resolution.ts:49-61` - Placeholder function
- `api/console/src/inngest/workflow/neural/observation-capture.ts:443-444` - Usage point
- `packages/console-types/src/neural/source-event.ts:42-47` - SourceActor interface
- `packages/console-webhooks/src/transformers/github.ts:58-64,176-182` - Actor extraction

### Fire-and-Forget
- `api/console/src/inngest/workflow/neural/observation-capture.ts:505-518` - Completion event
- `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts:192-206` - Fire + wait
- `api/console/src/inngest/client/client.ts:588-618` - Event schemas

### LLM Patterns
- `apps/console/src/lib/neural/llm-filter.ts:97-103` - generateObject pattern
- `api/chat/src/inngest/workflow/generate-chat-title.ts:88-101` - generateText pattern
- `packages/ai/src/index.ts` - AI SDK exports

### Embedding Similarity
- `vendor/pinecone/src/client.ts:210-244` - Query implementation
- `packages/console-config/src/private-config.ts:34-66` - Cosine metric config
- `apps/console/src/lib/neural/llm-filter.ts:50-126` - Score combination

---

## Architecture Documentation

### Day 4 Target Pipeline

```
SourceEvent
    |
Step 1: check-duplicate + check-event-allowed
    |
Step 2: fetch-context + evaluate-significance
    |
GATE: if significance < 40 -> return
    |
Step 3: PARALLEL
    |-- classify
    |-- generate-embedding
    |-- extract-entities (inline)
    |-- resolve-actor (NEW - Day 4)
    |
Step 4: assign-cluster (NEW - Day 4)
    |-- Query recent open clusters
    |-- Calculate affinity scores
    |-- Join existing or create new
    |
Step 5: upsert-vector -> Pinecone
    |
Step 6: store-observation + entities (transactional)
    |-- Include clusterId (NEW)
    |-- Include resolved actorId (NEW)
    |
Step 7: FIRE-AND-FORGET (NEW - Day 4)
    |-- apps-console/neural/profile.update
    |-- apps-console/neural/cluster.check-summary
    |
Step 8: emit-captured (enriched)
```

### New Workflows to Create

#### 1. Profile Update Workflow
```typescript
// api/console/src/inngest/workflow/neural/profile-update.ts
export const profileUpdate = inngest.createFunction(
  {
    id: "apps-console/neural.profile.update",
    concurrency: { limit: 10, key: "event.data.actorId" },
  },
  { event: "apps-console/neural/profile.update" },
  async ({ event, step }) => {
    // Debounce check
    // Gather recent observations
    // Extract expertise domains
    // Compute profile embedding (centroid)
    // Upsert profile
  }
);
```

#### 2. Cluster Summary Workflow
```typescript
// api/console/src/inngest/workflow/neural/cluster-summary.ts
export const clusterSummaryCheck = inngest.createFunction(
  {
    id: "apps-console/neural.cluster.check-summary",
    concurrency: { limit: 5, key: "event.data.workspaceId" },
  },
  { event: "apps-console/neural/cluster.check-summary" },
  async ({ event, step }) => {
    // Check if summary needed (threshold + age)
    // Gather cluster observations
    // Generate summary with LLM
    // Update cluster
  }
);
```

---

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2025-12-11-neural-memory-implementation-research-prompt.md` - Overall tracker
- `thoughts/shared/plans/2025-12-13-neural-memory-day3.5-write-path-rework.md` - Day 3.5 plan
- `thoughts/shared/research/2025-12-13-neural-memory-day3.5-pipeline-rework.md` - Day 3.5 research

---

## Implementation Order Recommendation

### Phase A: Schema + Cluster Assignment (No Blockers)
1. Implement `assignToCluster()` function
2. Add cluster assignment step to observation-capture
3. Update store step to include clusterId
4. Create cluster summary workflow

### Phase B: Actor Profiles (Requires Migration)
1. Create actor profile/identity schema files
2. Run `pnpm db:generate` to create migration
3. Implement `resolveActor()` three-tier logic
4. Create profile update workflow
5. Add actor resolution to parallel processing

### Phase C: Fire-and-Forget Events
1. Add event schemas to `api/console/src/inngest/client/client.ts`
2. Register new workflows in `api/console/src/inngest/index.ts`
3. Add sendEvent calls after observation store

---

## Open Questions

1. **Actor ID Normalization**: Should push events be normalized to numeric GitHub IDs for consistent resolution?
2. **Cluster Threshold**: Is 60/100 affinity threshold appropriate, or should it be configurable?
3. **Profile Debounce**: 5-minute debounce per e2e design - confirm this is acceptable latency?
4. **Summary Model**: Claude Haiku for summaries, or use faster/cheaper model?
