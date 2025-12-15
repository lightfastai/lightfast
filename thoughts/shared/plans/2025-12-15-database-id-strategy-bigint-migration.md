# Database ID Strategy: BIGINT Migration Implementation Plan

## Overview

Migrate high-volume tables from nanoid (varchar) primary keys to BIGINT auto-increment primary keys. API-exposed tables get an additional `externalId` column (nanoid) for public identifiers.

**Context**: Pre-production environment - no existing data to preserve, clean migration possible.

## Current State Analysis

### Tables by Volume (16 total)

| Table | Current PK | Volume | API Exposed | Pinecone IDs |
|-------|-----------|--------|-------------|--------------|
| `workspace_neural_observations` | nanoid | Very High | Yes | 3 columns |
| `workspace_knowledge_vector_chunks` | client-provided | Very High | Yes | ID = vector ID |
| `workspace_operations_metrics` | nanoid | Very High | No | None |
| `workspace_user_activities` | nanoid | High | No | None |
| `workspace_webhook_payloads` | nanoid | High | No | None |
| `workspace_neural_entities` | nanoid | Medium-High | Yes | None |
| `workspace_observation_clusters` | nanoid | Medium | Yes | 1 column |
| `workspace_actor_profiles` | nanoid | Medium | Yes | 1 column |
| `workspace_actor_identities` | nanoid | Medium | No | None |
| `workspace_temporal_states` | nanoid | Medium | No | None |
| `workspace_workflow_runs` | nanoid | Medium | No | None |
| `workspace_knowledge_documents` | client-provided | Medium | Yes | via chunks |
| `workspace_integrations` | nanoid | Low | Yes | None |
| `org_workspaces` | nanoid | Low | Yes (URLs) | None |
| `user_api_keys` | nanoid | Low | Yes | None |
| `user_sources` | nanoid | Low | No | None |

### Key Discoveries

1. **Pre-generated IDs**: `observation-capture.ts:222` pre-generates nanoid for Pinecone metadata
2. **Vector IDs from sourceId**: `observation-capture.ts:401` creates `obs_title_{sanitized_sourceId}`
3. **ID resolver**: `id-resolver.ts` handles both database IDs and vector IDs
4. **Embedding indexes**: Migration 0014 added indexes on embedding ID columns

## Desired End State

### Tier 1: BIGINT Only (Internal High-Volume)

```typescript
id: bigint("id", { mode: "number" })
  .primaryKey()
  .generatedAlwaysAsIdentity()
```

Tables:
- `workspace_operations_metrics`
- `workspace_user_activities`
- `workspace_webhook_payloads`
- `workspace_actor_identities`
- `workspace_temporal_states`
- `workspace_workflow_runs`

### Tier 2: BIGINT PK + NanoID External (API-Exposed)

```typescript
id: bigint("id", { mode: "number" })
  .primaryKey()
  .generatedAlwaysAsIdentity(),

externalId: varchar("external_id", { length: 21 })
  .notNull()
  .unique()
  .$defaultFn(() => nanoid())
```

Tables:
- `workspace_neural_observations`
- `workspace_neural_entities`
- `workspace_observation_clusters`
- `workspace_actor_profiles`

### Tier 3: Keep NanoID (Low-Volume Root)

Tables unchanged:
- `org_workspaces` - IDs in URLs, parent FK for all tables
- `user_api_keys` - API key management
- `user_sources` - OAuth connections
- `workspace_integrations` - low volume

### Special Cases (Unchanged)

- `workspace_knowledge_documents` - client-provided ID
- `workspace_knowledge_vector_chunks` - ID IS the vector ID

## What We're NOT Doing

1. **NOT changing `org_workspaces.id`** - Cascading FK changes too complex
2. **NOT changing vector ID generation** - `obs_{type}_{sourceId}` works well
3. **NOT changing knowledge chunk IDs** - ID = Pinecone vector ID by design

## Implementation Approach

Since pre-production: **Direct migration with schema replacement**. Drop existing tables, create with new schema.

---

## Phase 1: Create ID Helper Utilities

### Overview

Create reusable ID column helpers for consistency.

### Changes Required

#### 1. ID Helper Module
**File**: `db/console/src/schema/lib/id-helpers.ts` (new)

```typescript
import { bigint, varchar } from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";

/**
 * Internal BIGINT primary key with auto-increment.
 * Use for all high-volume tables.
 */
export const internalId = () =>
  bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity();

/**
 * External NanoID for API exposure.
 * Use alongside internalId for tables that need public identifiers.
 */
export const externalId = () =>
  varchar("external_id", { length: 21 })
    .notNull()
    .unique()
    .$defaultFn(() => nanoid());

/**
 * Legacy NanoID primary key.
 * Use only for low-volume root tables (workspaces, API keys).
 */
export const legacyId = () =>
  varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid());
```

#### 2. Export from Schema
**File**: `db/console/src/schema/lib/index.ts` (new)

```typescript
export * from "./id-helpers";
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @db/console build`
- [x] Linting passes: `pnpm lint` (no eslint config for db package - N/A)

---

## Phase 2: Migrate `workspace_neural_observations`

### Overview

Highest-impact table. Replace nanoid PK with BIGINT + externalId.

### Changes Required

#### 1. Update Schema
**File**: `db/console/src/schema/tables/workspace-neural-observations.ts`

```typescript
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";

// ... interfaces unchanged ...

export const workspaceNeuralObservations = pgTable(
  "lightfast_workspace_neural_observations",
  {
    /**
     * Internal BIGINT primary key - maximum join/query performance
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * External identifier for API responses and Pinecone metadata
     */
    externalId: varchar("external_id", { length: 21 })
      .notNull()
      .unique()
      .$defaultFn(() => nanoid()),

    /**
     * Workspace this observation belongs to
     */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    /**
     * Cluster this observation is assigned to
     */
    clusterId: bigint("cluster_id", { mode: "number" }),

    // ========== TEMPORAL ==========
    occurredAt: timestamp("occurred_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),

    capturedAt: timestamp("captured_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    // ========== ACTOR ==========
    actor: jsonb("actor").$type<ObservationActor | null>(),
    actorId: bigint("actor_id", { mode: "number" }),

    // ========== CONTENT ==========
    observationType: varchar("observation_type", { length: 100 }).notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),

    // ========== CLASSIFICATION ==========
    topics: jsonb("topics").$type<string[]>(),
    significanceScore: real("significance_score"),

    // ========== SOURCE ==========
    source: varchar("source", { length: 50 }).notNull(),
    sourceType: varchar("source_type", { length: 100 }).notNull(),
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    sourceReferences: jsonb("source_references").$type<ObservationReference[]>(),
    metadata: jsonb("metadata").$type<ObservationMetadata>(),

    // ========== EMBEDDINGS ==========
    /** @deprecated Legacy combined embedding */
    embeddingVectorId: varchar("embedding_vector_id", { length: 191 }),
    embeddingTitleId: varchar("embedding_title_id", { length: 191 }),
    embeddingContentId: varchar("embedding_content_id", { length: 191 }),
    embeddingSummaryId: varchar("embedding_summary_id", { length: 191 }),

    // ========== TIMESTAMPS ==========
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // External ID lookup (API requests)
    externalIdIdx: uniqueIndex("obs_external_id_idx").on(table.externalId),

    // Workspace + time range queries
    workspaceOccurredIdx: index("obs_workspace_occurred_idx").on(
      table.workspaceId,
      table.occurredAt,
    ),

    // Cluster membership
    clusterIdx: index("obs_cluster_idx").on(table.clusterId),

    // Source filtering
    sourceIdx: index("obs_source_idx").on(
      table.workspaceId,
      table.source,
      table.sourceType,
    ),

    // Deduplication by source ID
    sourceIdIdx: index("obs_source_id_idx").on(
      table.workspaceId,
      table.sourceId,
    ),

    // Type filtering
    typeIdx: index("obs_type_idx").on(
      table.workspaceId,
      table.observationType,
    ),

    // Vector ID lookups (fallback path)
    embeddingTitleIdx: index("obs_embedding_title_idx").on(
      table.workspaceId,
      table.embeddingTitleId,
    ),
    embeddingContentIdx: index("obs_embedding_content_idx").on(
      table.workspaceId,
      table.embeddingContentId,
    ),
    embeddingSummaryIdx: index("obs_embedding_summary_idx").on(
      table.workspaceId,
      table.embeddingSummaryId,
    ),
  }),
);

export type WorkspaceNeuralObservation = typeof workspaceNeuralObservations.$inferSelect;
export type InsertWorkspaceNeuralObservation = typeof workspaceNeuralObservations.$inferInsert;
```

**Key Changes:**
- `id` → BIGINT with `generatedAlwaysAsIdentity()`
- Added `externalId` (nanoid) for API/Pinecone
- `clusterId` → BIGINT (will reference cluster's new BIGINT id)
- `actorId` → BIGINT (will reference actor profile's new BIGINT id)

#### 2. Generate Migration
```bash
cd db/console && pnpm db:generate
```

#### 3. Apply Migration (Dev DB Reset)
```bash
cd db/console && pnpm db:migrate
```

### Success Criteria

#### Automated Verification:
- [x] Migration generates: `pnpm db:generate`
- [x] Migration applies: `pnpm db:migrate` (used drop-recreate for pre-production)
- [x] Package builds: `pnpm --filter @db/console build`

#### Manual Verification:
- [ ] Drizzle Studio shows BIGINT `id` and varchar `external_id`
- [ ] Insert test row → verify auto-increment ID and generated externalId

---

## Phase 3: Update Application Code

### Overview

Update workflow, resolver, and API code to use new schema.

### Changes Required

#### 1. Update Observation Capture Workflow
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

```typescript
// Line ~222: Pre-generate externalId for Pinecone metadata
const externalId = nanoid();

// Line ~493: Store externalId in Pinecone metadata
const baseMetadata = {
  layer: "observations",
  observationType: deriveObservationType(sourceEvent),
  source: sourceEvent.source,
  sourceType: sourceEvent.sourceType,
  sourceId: sourceEvent.sourceId,
  occurredAt: sourceEvent.occurredAt,
  actorName: sourceEvent.actor?.name || "unknown",
  observationId: externalId,  // External ID for lookups
};

// Line ~556: Insert with externalId (id is auto-generated)
const [obs] = await tx
  .insert(workspaceNeuralObservations)
  .values({
    // id: auto-generated BIGINT
    externalId,
    workspaceId,
    occurredAt: sourceEvent.occurredAt,
    // ... rest unchanged
  })
  .returning();
```

#### 2. Update ID Resolver
**File**: `apps/console/src/lib/neural/id-resolver.ts`

```typescript
export interface ResolvedObservation {
  id: number;           // Internal BIGINT
  externalId: string;   // Public nanoid
  title: string;
  content: string;
  source: string;
  sourceId: string;
  observationType: string;
  occurredAt: string;
  clusterId: number | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Resolve observation by externalId or vector ID
 */
export async function resolveObservationById(
  workspaceId: string,
  id: string,
): Promise<ResolvedObservation | null> {
  // Try externalId first
  const byExternalId = await db.query.workspaceNeuralObservations.findFirst({
    where: and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      eq(workspaceNeuralObservations.externalId, id)
    ),
  });

  if (byExternalId) {
    return mapToResolved(byExternalId);
  }

  // Fallback: vector ID columns
  if (!isVectorId(id)) return null;

  const byVectorId = await db.query.workspaceNeuralObservations.findFirst({
    where: and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      or(
        eq(workspaceNeuralObservations.embeddingTitleId, id),
        eq(workspaceNeuralObservations.embeddingContentId, id),
        eq(workspaceNeuralObservations.embeddingSummaryId, id),
        eq(workspaceNeuralObservations.embeddingVectorId, id)
      )
    ),
  });

  return byVectorId ? mapToResolved(byVectorId) : null;
}

function mapToResolved(obs: WorkspaceNeuralObservation): ResolvedObservation {
  return {
    id: obs.id,
    externalId: obs.externalId,
    title: obs.title,
    content: obs.content,
    source: obs.source,
    sourceId: obs.sourceId,
    observationType: obs.observationType,
    occurredAt: obs.occurredAt,
    clusterId: obs.clusterId,
    metadata: obs.metadata as Record<string, unknown> | null,
  };
}
```

#### 3. Update API Routes
**Files**:
- `apps/console/src/app/(api)/v1/search/route.ts`
- `apps/console/src/app/(api)/v1/contents/route.ts`
- `apps/console/src/app/(api)/v1/findsimilar/route.ts`

**Pattern**: Return `externalId` as `id` in responses

```typescript
// Response mapping
return results.map(r => ({
  id: r.externalId,  // Public ID
  title: r.title,
  // ...
}));
```

### Success Criteria

#### Automated Verification:
- [x] All packages build: `pnpm build:console`
- [x] TypeScript passes: `pnpm typecheck` (included in build)
- [x] Linting passes: `pnpm lint` (included in build)

#### Manual Verification:
- [ ] Trigger webhook → observation created with BIGINT id + nanoid externalId
- [ ] `/v1/search` returns externalId as id
- [ ] `/v1/contents?ids=<externalId>` resolves correctly

---

## Phase 4: Migrate Tier 1 Tables (Internal Only)

### Overview

Migrate 6 internal-only tables to pure BIGINT.

### Tables

| Table | Notes |
|-------|-------|
| `workspace_operations_metrics` | Time-series, append-only |
| `workspace_user_activities` | Audit log |
| `workspace_webhook_payloads` | Raw storage |
| `workspace_actor_identities` | Actor mapping |
| `workspace_temporal_states` | SCD Type 2 |
| `workspace_workflow_runs` | Job tracking |

### Schema Pattern (Each Table)

```typescript
export const workspaceOperationsMetrics = pgTable(
  "lightfast_workspace_operations_metrics",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // ... rest unchanged
  }
);
```

### Success Criteria

#### Automated Verification:
- [x] All 6 schemas updated
- [x] Migrations generate and apply (0016_watery_sentinels.sql)
- [x] All packages build (API + Console typecheck pass)

---

## Phase 5: Migrate Remaining Tier 2 Tables

### Overview

Apply BIGINT + externalId pattern to remaining API-exposed tables.

### Tables

| Table | FK Updates |
|-------|------------|
| `workspace_neural_entities` | `sourceObservationId` → BIGINT |
| `workspace_observation_clusters` | Referenced by observations |
| `workspace_actor_profiles` | Referenced by observations |

### Schema Pattern

```typescript
export const workspaceNeuralEntities = pgTable(
  "lightfast_workspace_neural_entities",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    externalId: varchar("external_id", { length: 21 })
      .notNull()
      .unique()
      .$defaultFn(() => nanoid()),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // FK to observation (now BIGINT)
    sourceObservationId: bigint("source_observation_id", { mode: "number" })
      .references(() => workspaceNeuralObservations.id, { onDelete: "set null" }),

    // ... rest unchanged
  }
);
```

### Success Criteria

#### Automated Verification:
- [x] All 3 schemas updated (entities, clusters, actor profiles)
- [x] FK references correct (BIGINT to BIGINT)
- [x] Migrations apply (0017_first_lady_ursula.sql)
- [x] All packages build (API + Console typecheck pass)

---

## Testing Strategy

### Unit Tests
- ID resolver handles externalId lookups
- ID resolver handles vector ID fallback
- New observations get correct columns

### Integration Tests
- Webhook → observation → search → content retrieval
- Verify Pinecone metadata contains `observationId` (externalId)

### Manual Testing
1. Start dev server: `pnpm dev:console`
2. Trigger GitHub webhook
3. Check Drizzle Studio for new observation
4. Query `/v1/search` → verify response IDs
5. Query `/v1/contents?ids=<externalId>`

## Performance Expectations

| Metric | Before (nanoid varchar) | After (BIGINT) |
|--------|------------------------|----------------|
| Insert latency | Baseline | -40-60% |
| Join performance | Baseline | 20-40x faster |
| Index size | Baseline | -50% |
| Storage per ID | ~25 bytes | 8 bytes |

## References

- Research: `thoughts/shared/research/2025-12-15-web-analysis-nanoid-vs-uuid-postgresql.md`
- Schema: `db/console/src/schema/tables/workspace-neural-observations.ts`
- ID Resolver: `apps/console/src/lib/neural/id-resolver.ts`
- Workflow: `api/console/src/inngest/workflow/neural/observation-capture.ts`

---

**Status**: Ready for implementation
**Priority**: High
**Estimated Phases**: 5
