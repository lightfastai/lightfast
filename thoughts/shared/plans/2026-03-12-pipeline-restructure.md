# Pipeline Restructure Implementation Plan

## Overview

Split the monolithic `observation-capture.ts` (839 lines) into two Inngest functions, add interpretation and entity-observation junction tables, align entity categories with reference types, and replace point-in-time JSONB relationship detection with entity-mediated matching.

Based on research: `thoughts/shared/research/2026-03-12-pipeline-restructure-architecture.md`

## Current State Analysis

### Pipeline (single function)
- `api/console/src/inngest/workflow/neural/observation-capture.ts` (839 lines) — mixes fact storage with AI interpretation in one flow
- `api/console/src/inngest/workflow/neural/relationship-detection.ts` (495 lines) — point-in-time JSONB `@>` scans, hardcoded per-provider detection passes

### Schema
- `workspace_neural_observations` stores facts AND interpretations (`topics`, `significance_score`, `embedding_*_id`) on the same row
- `workspace_neural_entities` has single `source_observation_id` FK — only tracks first-seen observation
- `workspace_observation_relationships` — edges table, unchanged by this plan

### Key Discoveries
- `entity-search.ts:95-96` queries `sourceObservationId` directly — returns only first-seen observation per entity
- `four-path-search.ts:137-139` uses `embeddingTitleId`, `embeddingContentId`, `embeddingSummaryId` from observation row for legacy vector ID normalization
- `findsimilar.ts:99-131` ALSO uses embedding ID columns from observation row (not mentioned in research doc)
- `extractFromReferences()` at `entity-extraction-patterns.ts:181-222` maps `commit`/`branch` refs to `category: "reference"` — misaligned with structural matching needs
- `notification/dispatch.ts:34` triggers on `observation.captured` and reads `significanceScore` and `topics` from event data (not DB) — no schema dependency
- Graph APIs (`graph.ts`, `related.ts`) only query `workspace_observation_relationships` — no observation column dependencies

## Desired End State

1. **Observation row is immutable** — no `topics`, `significance_score`, or `embedding_*_id` columns
2. **Interpretations stored separately** — versioned `workspace_observation_interpretations` table
3. **Entity↔observation junction** — `workspace_entity_observations` replaces single FK
4. **Entity categories aligned** — structural types (`commit`, `branch`, `pr`, `issue`, `deployment`) for graph matching
5. **Two Inngest functions** — `observation-store` (fast, <2s) and `observation-interpret` (slow, 5-30s)
6. **Entity-mediated relationship detection** — replaces JSONB scans, handles out-of-order events
7. **Edge rules on ProviderDefinition** — co-located with provider, no hardcoded detection passes

### Verification
```bash
pnpm check && pnpm typecheck
pnpm build:console
```
- Send test webhook → verify flow through both Inngest functions
- Verify observation row has no interpretation columns
- Verify interpretation row exists with topics + embedding IDs
- Verify entity-observation junction rows exist
- Verify relationships are created (including out-of-order scenario)
- Verify search and graph APIs work

## What We're NOT Building

- L1 semantic entities (Change, Incident, Release)
- L2 causal/temporal reasoning
- Separate Fact Capture Hono service
- Actor profile/resolution layer
- AI-discovered edges (confidence-gated)
- Graph query redesign

---

## Phase 1: Schema Changes

### Overview
Create new tables, expand entity categories, add edge rules to provider definitions. No pipeline changes yet — existing code continues to work.

### Changes Required

#### 1. New table: `workspace_observation_interpretations`
**File**: `db/console/src/schema/tables/workspace-observation-interpretations.ts` (NEW)

```typescript
import { nanoid } from "@repo/lib";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { orgWorkspaces } from "./org-workspaces";
import { workspaceNeuralObservations } from "./workspace-neural-observations";

/**
 * Versioned AI interpretations of observations.
 *
 * Separates mutable AI outputs (topics, significance, embeddings) from
 * immutable observation facts. Supports reprocessing by creating new versions.
 */
export const workspaceObservationInterpretations = pgTable(
  "lightfast_workspace_observation_interpretations",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    observationId: bigint("observation_id", { mode: "number" })
      .notNull()
      .references(() => workspaceNeuralObservations.id, { onDelete: "cascade" }),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    version: integer("version").default(1).notNull(),

    // Classification
    primaryCategory: varchar("primary_category", { length: 50 }),
    topics: jsonb("topics").$type<string[]>(),

    // Scoring
    significanceScore: real("significance_score"),

    // Embedding references
    embeddingTitleId: varchar("embedding_title_id", { length: 191 }),
    embeddingContentId: varchar("embedding_content_id", { length: 191 }),
    embeddingSummaryId: varchar("embedding_summary_id", { length: 191 }),

    // Provenance
    modelVersion: varchar("model_version", { length: 100 }),
    processedAt: timestamp("processed_at", {
      mode: "string",
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Latest interpretation for an observation
    obsVersionIdx: uniqueIndex("interp_obs_version_idx").on(
      table.observationId,
      table.version
    ),

    // Lookup by observation
    obsIdx: index("interp_obs_idx").on(table.observationId),

    // Reprocessing queries
    workspaceProcessedIdx: index("interp_workspace_processed_idx").on(
      table.workspaceId,
      table.processedAt
    ),

    // Vector ID lookups (replaces observation row indexes)
    embeddingTitleIdx: index("interp_embedding_title_idx").on(
      table.workspaceId,
      table.embeddingTitleId
    ),
    embeddingContentIdx: index("interp_embedding_content_idx").on(
      table.workspaceId,
      table.embeddingContentId
    ),
    embeddingSummaryIdx: index("interp_embedding_summary_idx").on(
      table.workspaceId,
      table.embeddingSummaryId
    ),
  })
);

export type WorkspaceObservationInterpretation =
  typeof workspaceObservationInterpretations.$inferSelect;
export type InsertWorkspaceObservationInterpretation =
  typeof workspaceObservationInterpretations.$inferInsert;
```

#### 2. New table: `workspace_entity_observations`
**File**: `db/console/src/schema/tables/workspace-entity-observations.ts` (NEW)

```typescript
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { orgWorkspaces } from "./org-workspaces";
import { workspaceNeuralEntities } from "./workspace-neural-entities";
import { workspaceNeuralObservations } from "./workspace-neural-observations";

/**
 * Entity↔Observation junction table.
 *
 * Records every occurrence of an entity in an observation,
 * replacing the single source_observation_id FK on the entity table.
 * Enables "all observations for entity X" and "all entities for observation Y".
 */
export const workspaceEntityObservations = pgTable(
  "lightfast_workspace_entity_observations",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    entityId: bigint("entity_id", { mode: "number" })
      .notNull()
      .references(() => workspaceNeuralEntities.id, { onDelete: "cascade" }),

    observationId: bigint("observation_id", { mode: "number" })
      .notNull()
      .references(() => workspaceNeuralObservations.id, { onDelete: "cascade" }),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    /** Contextual label from reference (e.g., "resolved_by", "fixes", null) */
    refLabel: varchar("ref_label", { length: 50 }),

    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Unique constraint: one junction row per entity+observation pair
    uniqueEntityObs: uniqueIndex("eo_entity_obs_idx").on(
      table.entityId,
      table.observationId
    ),

    // "All observations for entity X"
    entityIdx: index("eo_entity_idx").on(table.entityId),

    // "All entities for observation Y"
    observationIdx: index("eo_observation_idx").on(table.observationId),
  })
);

export type WorkspaceEntityObservation =
  typeof workspaceEntityObservations.$inferSelect;
export type InsertWorkspaceEntityObservation =
  typeof workspaceEntityObservations.$inferInsert;
```

#### 3. Expand entity categories
**File**: `packages/console-validation/src/schemas/entities.ts:9-17`

Add structural types before semantic types:

```typescript
export const entityCategorySchema = z.enum([
  // Structural types (from references — used for graph matching)
  "commit",
  "branch",
  "pr",
  "issue",
  "deployment",
  // Semantic types (from text extraction — used for search enrichment)
  "engineer",
  "project",
  "endpoint",
  "config",
  "definition",
  "service",
  "reference",
]);
```

#### 4. Add EdgeRule type and edge rules to ProviderDefinition
**File**: `packages/console-providers/src/types.ts` — add at end:

```typescript
// ── Edge Rules ──

/**
 * Declarative edge rule for entity-mediated relationship detection.
 * Co-located on ProviderDefinition so adding a new provider = defining its edges.
 */
export interface EdgeRule {
  /** Reference type to match on THIS observation's entities (open string) */
  refType: string;
  /** Only match when this observation's reference has this label (e.g., "resolved_by", "fixes") */
  selfLabel?: string;
  /** Provider to match against ("*" for any) */
  matchProvider: string;
  /** Entity type to match against on the OTHER observation */
  matchRefType: string;
  /** Relationship type to create */
  relationshipType: string;
  /** Confidence score for the created edge */
  confidence: number;
}
```

**File**: `packages/console-providers/src/define.ts:274-324` — add `edgeRules` to ProviderDefinition:

After the `readonly webhook` field, add:
```typescript
  /** Declarative edge rules for entity-mediated relationship detection */
  readonly edgeRules?: EdgeRule[];
```

**File**: `packages/console-providers/src/index.ts` — export EdgeRule type

#### 5. Add edge rules to each provider

**GitHub** (`packages/console-providers/src/providers/github/index.ts`):
```typescript
edgeRules: [
  { refType: "commit", matchProvider: "vercel", matchRefType: "commit", relationshipType: "deploys", confidence: 1.0 },
  { refType: "commit", selfLabel: "resolved_by", matchProvider: "sentry", matchRefType: "commit", relationshipType: "resolves", confidence: 1.0 },
  { refType: "commit", matchProvider: "*", matchRefType: "commit", relationshipType: "same_commit", confidence: 1.0 },
  { refType: "branch", matchProvider: "*", matchRefType: "branch", relationshipType: "same_branch", confidence: 0.9 },
  { refType: "pr", matchProvider: "*", matchRefType: "pr", relationshipType: "tracked_in", confidence: 1.0 },
  { refType: "issue", selfLabel: "fixes", matchProvider: "*", matchRefType: "issue", relationshipType: "fixes", confidence: 1.0 },
  { refType: "issue", matchProvider: "*", matchRefType: "issue", relationshipType: "references", confidence: 0.8 },
],
```

**Vercel** (`packages/console-providers/src/providers/vercel/index.ts`):
```typescript
edgeRules: [
  { refType: "commit", matchProvider: "github", matchRefType: "commit", relationshipType: "deploys", confidence: 1.0 },
  { refType: "commit", matchProvider: "*", matchRefType: "commit", relationshipType: "same_commit", confidence: 1.0 },
  { refType: "deployment", matchProvider: "*", matchRefType: "deployment", relationshipType: "references", confidence: 0.8 },
],
```

**Sentry** (`packages/console-providers/src/providers/sentry/index.ts`):
```typescript
edgeRules: [
  { refType: "commit", selfLabel: "resolved_by", matchProvider: "*", matchRefType: "commit", relationshipType: "resolves", confidence: 1.0 },
  { refType: "issue", matchProvider: "linear", matchRefType: "issue", relationshipType: "triggers", confidence: 0.8 },
],
```

**Linear** (`packages/console-providers/src/providers/linear/index.ts`):
```typescript
edgeRules: [
  { refType: "issue", selfLabel: "linked", matchProvider: "sentry", matchRefType: "issue", relationshipType: "triggers", confidence: 0.8 },
  { refType: "pr", matchProvider: "github", matchRefType: "pr", relationshipType: "tracked_in", confidence: 1.0 },
  { refType: "issue", matchProvider: "*", matchRefType: "issue", relationshipType: "references", confidence: 0.8 },
  { refType: "branch", matchProvider: "*", matchRefType: "branch", relationshipType: "same_branch", confidence: 0.9 },
],
```

#### 6. Update table exports
**File**: `db/console/src/schema/tables/index.ts` — add new table exports:

```typescript
// Interpretation table
export {
  type InsertWorkspaceObservationInterpretation,
  type WorkspaceObservationInterpretation,
  workspaceObservationInterpretations,
} from "./workspace-observation-interpretations";

// Entity-observation junction
export {
  type InsertWorkspaceEntityObservation,
  type WorkspaceEntityObservation,
  workspaceEntityObservations,
} from "./workspace-entity-observations";
```

#### 7. Update relations
**File**: `db/console/src/schema/relations.ts` — add:

```typescript
import { workspaceEntityObservations } from "./tables/workspace-entity-observations";
import { workspaceNeuralEntities } from "./tables/workspace-neural-entities";
import { workspaceObservationInterpretations } from "./tables/workspace-observation-interpretations";

// Interpretation relations
export const workspaceObservationInterpretationsRelations = relations(
  workspaceObservationInterpretations,
  ({ one }) => ({
    observation: one(workspaceNeuralObservations, {
      fields: [workspaceObservationInterpretations.observationId],
      references: [workspaceNeuralObservations.id],
    }),
    workspace: one(orgWorkspaces, {
      fields: [workspaceObservationInterpretations.workspaceId],
      references: [orgWorkspaces.id],
    }),
  })
);

// Entity-observation junction relations
export const workspaceEntityObservationsRelations = relations(
  workspaceEntityObservations,
  ({ one }) => ({
    entity: one(workspaceNeuralEntities, {
      fields: [workspaceEntityObservations.entityId],
      references: [workspaceNeuralEntities.id],
    }),
    observation: one(workspaceNeuralObservations, {
      fields: [workspaceEntityObservations.observationId],
      references: [workspaceNeuralObservations.id],
    }),
    workspace: one(orgWorkspaces, {
      fields: [workspaceEntityObservations.workspaceId],
      references: [orgWorkspaces.id],
    }),
  })
);
```

Also update the existing `workspaceNeuralObservationsRelations` to add `many` relations:

```typescript
export const workspaceNeuralObservationsRelations = relations(
  workspaceNeuralObservations,
  ({ one, many }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceNeuralObservations.workspaceId],
      references: [orgWorkspaces.id],
    }),
    interpretations: many(workspaceObservationInterpretations),
    entityObservations: many(workspaceEntityObservations),
  })
);
```

#### 8. Add `observation.stored` event schema
**File**: `api/console/src/inngest/client/client.ts`

Add new event after `observation.capture`:
```typescript
"apps-console/neural/observation.stored": z.object({
  /** Observation external ID (nanoid) */
  observationId: z.string(),
  /** Workspace DB UUID */
  workspaceId: z.string(),
  /** Clerk organization ID */
  clerkOrgId: z.string().optional(),
  /** Source provider for routing */
  source: z.string(),
  /** Source event type for routing */
  sourceType: z.string(),
  /** Significance score (pre-computed in store step) */
  significanceScore: z.number(),
  /** Extracted L0 entity refs (small, needed by interpretation) */
  entityRefs: z.array(z.object({
    type: z.string(),
    key: z.string(),
    label: z.string().nullable(),
  })),
  /** Internal observation ID for DB queries */
  internalObservationId: z.number(),
}),
```

#### 9. Generate migration
```bash
cd db/console && pnpm db:generate
```

**Note**: Do NOT drop columns from observation/entity tables yet — they are still used by the existing pipeline. Column removal happens in Phase 4 after consumer migration.

### Success Criteria

#### Automated Verification:
- [x] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Review generated migration SQL — confirm new tables, no column drops
- [ ] Drizzle Studio shows new empty tables

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Split observation-capture.ts into Two Functions

### Overview
Create `observation-store.ts` (fast path: facts + entities + junctions) and `observation-interpret.ts` (slow path: classify + embed + relationships). Delete `observation-capture.ts`.

### Changes Required

#### 1. Create `observation-store.ts`
**File**: `api/console/src/inngest/workflow/neural/observation-store.ts` (NEW, ~400 lines)

**Trigger**: `apps-console/neural/observation.capture` (same as today)

**Steps** (extracted from current `observation-capture.ts`):
1. `generate-replay-safe-ids` — unchanged from lines 212-218
2. `resolve-clerk-org-id` — unchanged from lines 222-224
3. `create-job` + `update-job-running` — unchanged from lines 239-260
4. `check-duplicate` — unchanged from lines 263-301
5. `check-event-allowed` — unchanged from lines 304-396
6. `evaluate-significance` — unchanged from lines 399-434 (score stored on interpretation later, but passed in event)
7. `fetch-context` — **REMOVED** (not needed in fast path — workspace settings only used for embedding config which moves to interpret function)
8. `extract-entities` — moved here, uses `extractEntities()` + `extractFromReferences()` but with UPDATED category mapping:
   - `extractFromReferences` must now use structural categories: `commit` → `"commit"` (not `"reference"`), `branch` → `"branch"`, `pr` → `"pr"`, `issue` → `"issue"`, `deployment` → `"deployment"`
   - `assignee`/`reviewer` → keep `"engineer"`
   - Other types → keep `"reference"`
9. `store-observation` — insert observation row **WITHOUT** `topics`, `significanceScore`, `embeddingVectorId`, `embeddingTitleId`, `embeddingContentId`, `embeddingSummaryId` (these columns still exist on the table but we write `null`)
10. `upsert-entities-and-junctions` — upsert entities (same `onConflictDoUpdate` logic) AND create `workspace_entity_observations` junction rows. Must use `RETURNING` or post-query to get entity IDs for junction inserts.
11. `emit-observation-stored` — emit `apps-console/neural/observation.stored` with slim payload
12. `complete-job-success` — complete job

**Key difference from current code**: No LLM calls, no embedding generation, no Pinecone upsert, no relationship detection. Job completes quickly.

**On the observation insert**: Write `null` to `topics`, `significanceScore`, and `embedding_*_id` columns. These columns are NOT dropped yet (Phase 4) to maintain backwards compatibility during the transition. Once all consumers are migrated, they get dropped.

#### 2. Update `extractFromReferences` for structural categories
**File**: `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:181-222`

Update the switch statement to use structural entity categories:

```typescript
export function extractFromReferences(
  references: { type: string; id: string; label?: string }[]
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  for (const ref of references) {
    let category: EntityCategory;
    let key: string;

    switch (ref.type) {
      case "commit":
        category = "commit";
        key = ref.id.substring(0, 7);
        break;
      case "branch":
        category = "branch";
        key = ref.id;
        break;
      case "pr":
        category = "pr";
        key = ref.id;
        break;
      case "issue":
        category = "issue";
        key = ref.id;
        break;
      case "deployment":
        category = "deployment";
        key = ref.id;
        break;
      case "assignee":
      case "reviewer":
        category = "engineer";
        key = `@${ref.id}`;
        break;
      default:
        category = "reference";
        key = ref.id;
    }

    entities.push({
      category,
      key,
      value: ref.label,
      confidence: 0.98,
      evidence: `Reference: ${ref.type}`,
    });
  }

  return entities;
}
```

#### 3. Create `observation-interpret.ts`
**File**: `api/console/src/inngest/workflow/neural/observation-interpret.ts` (NEW, ~350 lines)

**Trigger**: `apps-console/neural/observation.stored`

**Steps**:
1. `fetch-observation` — read observation from DB by `internalObservationId` (title, content, body, source, sourceType, actor, metadata, sourceReferences)
2. `fetch-workspace` — read workspace for embedding config
3. `classify-observation` — LLM classification (extracted from current lines 457-515), with fallback
4. `generate-multi-view-embeddings` — embedding generation (extracted from current lines 519-573)
5. `upsert-multi-view-vectors` — Pinecone upsert (extracted from current lines 611-680)
6. `store-interpretation` — insert into `workspace_observation_interpretations` table with version 1
7. `resolve-edges` — entity-mediated relationship detection (see Phase 3)
8. `emit-observation-captured` — emit `observation.captured` event (same schema as today, includes topics + significance)

**Retry isolation**: Each step retries independently. If embedding fails after classification succeeds, only embedding retries.

#### 4. Delete `observation-capture.ts`
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts` — DELETE (839 lines)

#### 5. Update exports and registration
**File**: `api/console/src/inngest/workflow/neural/index.ts`:
```typescript
export { observationStore } from "./observation-store";
export { observationInterpret } from "./observation-interpret";
```

**File**: `api/console/src/inngest/index.ts`:
- Replace `observationCapture` import with `observationStore` and `observationInterpret`
- Register both in `createInngestRouteContext().functions[]`

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check` (3 pre-existing migration format errors unrelated to Phase 2)
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Send test webhook through relay → verify observation stored (fast path completes)
- [ ] Verify observation row has `null` for `topics`, `significanceScore`, `embedding_*_id`
- [ ] Verify `observation.stored` event emitted in Inngest dashboard
- [ ] Verify `observation-interpret` function triggers and completes
- [ ] Verify interpretation row created with topics + embedding IDs
- [ ] Verify entity-observation junction rows created

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Entity-Mediated Relationship Detection

### Overview
Replace `relationship-detection.ts` (495 lines of hardcoded JSONB scans) with `edge-resolver.ts` (~200 lines) that uses entity-observation junctions for bidirectional matching.

### Changes Required

#### 1. Create `edge-resolver.ts`
**File**: `api/console/src/inngest/workflow/neural/edge-resolver.ts` (NEW, ~200 lines)

```typescript
import { db } from "@db/console/client";
import type { RelationshipType } from "@db/console/schema";
import {
  workspaceEntityObservations,
  workspaceNeuralEntities,
  workspaceNeuralObservations,
  workspaceObservationRelationships,
} from "@db/console/schema";
import { PROVIDERS } from "@repo/console-providers";
import type { EdgeRule } from "@repo/console-providers";
import type { DetectedRelationship } from "@repo/console-validation";
import { log } from "@vendor/observability/log";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Resolve edges for a new observation using entity-mediated bidirectional matching.
 *
 * Algorithm:
 * 1. Query junction table for all observations sharing any of this observation's entities
 * 2. For each co-occurring observation, load both providers' edge rules
 * 3. Evaluate rules bidirectionally (most specific wins)
 * 4. Insert detected edges
 *
 * Handles out-of-order events: when the second event arrives, it finds the first
 * through the shared entity in the junction table.
 */
export async function resolveEdges(
  workspaceId: string,
  observationId: number,
  source: string,
  entityRefs: Array<{ type: string; key: string; label: string | null }>,
): Promise<number> {
  if (entityRefs.length === 0) return 0;

  // 1. Find entity IDs for this observation's structural refs
  const structuralTypes = ["commit", "branch", "pr", "issue", "deployment"];
  const structuralRefs = entityRefs.filter((r) => structuralTypes.includes(r.type));
  if (structuralRefs.length === 0) return 0;

  // Query entity IDs by (workspace, category, key)
  const entityConditions = structuralRefs.map(
    (ref) =>
      sql`(${workspaceNeuralEntities.category} = ${ref.type} AND ${workspaceNeuralEntities.key} = ${ref.key})`
  );

  const entities = await db
    .select({ id: workspaceNeuralEntities.id, category: workspaceNeuralEntities.category, key: workspaceNeuralEntities.key })
    .from(workspaceNeuralEntities)
    .where(
      and(
        eq(workspaceNeuralEntities.workspaceId, workspaceId),
        sql`(${sql.join(entityConditions, sql` OR `)})`
      )
    );

  if (entities.length === 0) return 0;

  const entityIds = entities.map((e) => e.id);

  // 2. Find co-occurring observations through junction table
  const coOccurring = await db
    .select({
      observationId: workspaceEntityObservations.observationId,
      entityId: workspaceEntityObservations.entityId,
    })
    .from(workspaceEntityObservations)
    .where(
      and(
        inArray(workspaceEntityObservations.entityId, entityIds),
        ne(workspaceEntityObservations.observationId, observationId)
      )
    )
    .limit(100);

  if (coOccurring.length === 0) return 0;

  // 3. Load co-occurring observation sources
  const coObsIds = [...new Set(coOccurring.map((c) => c.observationId))];
  const coObservations = await db
    .select({ id: workspaceNeuralObservations.id, source: workspaceNeuralObservations.source })
    .from(workspaceNeuralObservations)
    .where(inArray(workspaceNeuralObservations.id, coObsIds));

  const coObsSourceMap = new Map(coObservations.map((o) => [o.id, o.source]));
  const entityMap = new Map(entities.map((e) => [e.id, e]));

  // 4. Evaluate edge rules bidirectionally
  const myRules = getEdgeRules(source);
  const detected: DetectedRelationship[] = [];

  for (const coOcc of coOccurring) {
    const otherSource = coObsSourceMap.get(coOcc.observationId);
    if (!otherSource) continue;

    const entity = entityMap.get(coOcc.entityId);
    if (!entity) continue;

    // Find matching ref from this observation
    const matchingRef = entityRefs.find(
      (r) => r.type === entity.category && r.key === entity.key
    );

    const otherRules = getEdgeRules(otherSource);

    // Try my rules first (most specific wins)
    const rule = findBestRule(myRules, entity.category, matchingRef?.label ?? null, otherSource, entity.category)
      ?? findBestRule(otherRules, entity.category, null, source, entity.category);

    if (rule) {
      detected.push({
        targetObservationId: coOcc.observationId,
        relationshipType: rule.relationshipType,
        linkingKey: entity.key,
        linkingKeyType: entity.category,
        confidence: rule.confidence,
        metadata: { detectionMethod: "entity_cooccurrence" as const },
      });
    } else {
      // Fallback: co_occurs at low confidence
      detected.push({
        targetObservationId: coOcc.observationId,
        relationshipType: "co_occurs",
        linkingKey: entity.key,
        linkingKeyType: entity.category,
        confidence: 0.5,
        metadata: { detectionMethod: "entity_cooccurrence" as const },
      });
    }
  }

  // 5. Deduplicate and insert
  const deduped = deduplicateEdges(detected);
  if (deduped.length === 0) return 0;

  const inserts = deduped.map((rel) => ({
    externalId: nanoid(),
    workspaceId,
    sourceObservationId: observationId,
    targetObservationId: rel.targetObservationId,
    relationshipType: rel.relationshipType as RelationshipType,
    linkingKey: rel.linkingKey,
    linkingKeyType: rel.linkingKeyType,
    confidence: rel.confidence,
    metadata: rel.metadata,
  }));

  try {
    await db.insert(workspaceObservationRelationships).values(inserts).onConflictDoNothing();
    log.info("Entity-mediated edges created", { observationId, count: inserts.length });
    return inserts.length;
  } catch (error) {
    log.error("Failed to create edges", { error, workspaceId });
    return 0;
  }
}

function getEdgeRules(source: string): EdgeRule[] {
  const provider = Object.values(PROVIDERS).find((p) => p.name === source);
  return provider?.edgeRules ?? [];
}

function findBestRule(
  rules: EdgeRule[],
  refType: string,
  selfLabel: string | null,
  matchProvider: string,
  matchRefType: string,
): EdgeRule | null {
  // Most specific first: selfLabel match > provider-specific > wildcard
  const candidates = rules.filter(
    (r) => r.refType === refType && r.matchRefType === matchRefType
  );

  // 1. selfLabel + specific provider
  const labelSpecific = candidates.find(
    (r) => r.selfLabel === selfLabel && selfLabel !== null && r.matchProvider === matchProvider
  );
  if (labelSpecific) return labelSpecific;

  // 2. selfLabel + wildcard provider
  const labelWild = candidates.find(
    (r) => r.selfLabel === selfLabel && selfLabel !== null && r.matchProvider === "*"
  );
  if (labelWild) return labelWild;

  // 3. No selfLabel + specific provider
  const noLabelSpecific = candidates.find(
    (r) => !r.selfLabel && r.matchProvider === matchProvider
  );
  if (noLabelSpecific) return noLabelSpecific;

  // 4. No selfLabel + wildcard
  const noLabelWild = candidates.find(
    (r) => !r.selfLabel && r.matchProvider === "*"
  );
  return noLabelWild ?? null;
}

function deduplicateEdges(relationships: DetectedRelationship[]): DetectedRelationship[] {
  const byTarget = new Map<string, DetectedRelationship>();
  for (const rel of relationships) {
    const key = `${rel.targetObservationId}-${rel.relationshipType}`;
    const existing = byTarget.get(key);
    if (!existing || rel.confidence > existing.confidence) {
      byTarget.set(key, rel);
    }
  }
  return Array.from(byTarget.values());
}
```

#### 2. Add `co_occurs` to RelationshipType
**File**: `db/console/src/schema/tables/workspace-observation-relationships.ts:27-35`

```typescript
export type RelationshipType =
  | "co_occurs"   // Fallback: two observations share an entity but no specific rule
  | "fixes"
  | "resolves"
  | "triggers"
  | "deploys"
  | "references"
  | "same_commit"
  | "same_branch"
  | "tracked_in";
```

#### 3. Wire `resolveEdges` into `observation-interpret.ts`

In the `resolve-edges` step of `observation-interpret.ts`:
```typescript
const relationshipsCreated = await step.run("resolve-edges", async () => {
  return resolveEdges(
    workspaceId,
    event.data.internalObservationId,
    event.data.source,
    event.data.entityRefs,
  );
});
```

#### 4. Delete `relationship-detection.ts`
**File**: `api/console/src/inngest/workflow/neural/relationship-detection.ts` — DELETE (495 lines)

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Send two webhooks with shared commit SHA → verify `same_commit` edge created
- [ ] Send GitHub push + Vercel deployment with same commit → verify `deploys` edge
- [ ] Verify out-of-order works: send Vercel deployment first, then GitHub push → edge still created
- [ ] Verify fallback `co_occurs` edge created when no specific rule matches

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 4: Update Consumers & Drop Legacy Columns

### Overview
Migrate search pipelines, entity search, and vector ID normalization to use interpretation table and junction table. Then drop legacy columns from observation and entity tables.

### Changes Required

#### 1. Update `entity-search.ts`
**File**: `apps/console/src/lib/neural/entity-search.ts`

Replace `sourceObservationId` FK queries with junction table queries:

```typescript
import {
  workspaceEntityObservations,
  workspaceNeuralEntities,
  workspaceNeuralObservations,
} from "@db/console/schema";

// In searchByEntities():
// Replace:   .sourceObservationId query
// With:      junction table join

// After finding matched entities, query junction table:
const entityIds = matchedEntities.map((e) => e.id);

const junctions = await db
  .select({
    entityId: workspaceEntityObservations.entityId,
    observationId: workspaceEntityObservations.observationId,
  })
  .from(workspaceEntityObservations)
  .where(inArray(workspaceEntityObservations.entityId, entityIds))
  .limit(limit * 3); // Allow multiple observations per entity

// Then fetch unique observation IDs from junctions
const observationIds = [...new Set(junctions.map((j) => j.observationId))];
```

This now returns ALL observations for each entity, not just first-seen.

#### 2. Update `four-path-search.ts` legacy vector ID normalization
**File**: `apps/console/src/lib/neural/four-path-search.ts:120-180`

Replace observation row `embedding*Id` queries with interpretation table queries:

```typescript
import { workspaceObservationInterpretations } from "@db/console/schema";

// In normalizeVectorIds() for legacy path (withoutObsId):
const interpretations = await db
  .select({
    observationId: workspaceObservationInterpretations.observationId,
    embeddingTitleId: workspaceObservationInterpretations.embeddingTitleId,
    embeddingContentId: workspaceObservationInterpretations.embeddingContentId,
    embeddingSummaryId: workspaceObservationInterpretations.embeddingSummaryId,
  })
  .from(workspaceObservationInterpretations)
  .where(/* similar condition using inArray on embedding IDs */);
```

Also need to join to observation table to get `externalId` for the result.

**Note**: The `enrichSearchResults` function at line 541-653 queries `sourceObservationId` from entities — update to use junction table (same pattern as entity-search.ts).

#### 3. Update `findsimilar.ts` legacy vector ID normalization
**File**: `apps/console/src/lib/v1/findsimilar.ts:92-131`

Same pattern as four-path-search.ts — replace observation row embedding ID queries with interpretation table queries.

#### 4. Drop legacy columns from observation table
**File**: `db/console/src/schema/tables/workspace-neural-observations.ts`

Remove these columns:
- `topics` (line 137)
- `significanceScore` (line 142)
- `embeddingVectorId` (lines 178-179)
- `embeddingTitleId` (lines 184-185)
- `embeddingContentId` (lines 190-191)
- `embeddingSummaryId` (lines 196-197)

Remove these indexes:
- `embeddingTitleIdx` (lines 243-246)
- `embeddingContentIdx` (lines 247-250)
- `embeddingSummaryIdx` (lines 251-254)

#### 5. Drop `sourceObservationId` from entity table
**File**: `db/console/src/schema/tables/workspace-neural-entities.ts`

Remove `sourceObservationId` column (lines 79-84) and its import of `workspaceNeuralObservations`.

#### 6. Generate migration for column drops
```bash
cd db/console && pnpm db:generate
```

### Success Criteria

#### Automated Verification:
- [x] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [x] No remaining references to dropped columns: `grep -r "embeddingTitleId\|embeddingContentId\|embeddingSummaryId\|embeddingVectorId\|sourceObservationId" --include="*.ts" apps/ api/ packages/ db/` returns only the interpretation table and migration files
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check` (4 pre-existing migration JSON format errors)
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Search works via API (vector + entity paths)
- [ ] `/v1/findsimilar` returns correct results
- [ ] `/v1/graph` traversal works
- [ ] `/v1/related` returns correct results
- [ ] Notifications still dispatch for high-significance observations

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 5: Slim Event Payloads & Cleanup

### Overview
Update the `observation.captured` event to use slim references. Clean up any remaining dead code.

### Changes Required

#### 1. Verify `observation.captured` event payload
The `observation.captured` event already carries `observationId`, `significanceScore`, `topics` — this is set by `observation-interpret.ts`. The notification dispatch reads these from event data (not DB), so no schema change needed.

The key change is that `observation.capture` (trigger event) still carries the full `PostTransformEvent` — this is intentional as stated in the research doc (ingress route already has data in memory).

#### 2. Remove dead imports/references
Grep for any remaining references to deleted files:
- `observation-capture` imports
- `relationship-detection` imports
- `detectAndCreateRelationships` references

#### 3. Update `on-failure-handler.ts` if needed
If the on-failure handler references specific step names or function IDs from the old function, update for the new function IDs (`neural.observation.store` and `neural.observation.interpret`).

#### 4. Final verification
```bash
pnpm check && pnpm typecheck
pnpm build:console
```

### Success Criteria

#### Automated Verification:
- [x] No dead imports: `pnpm typecheck` passes cleanly
- [x] Lint passes: `pnpm check` (4 pre-existing migration JSON format errors)
- [x] Build succeeds: `pnpm build:console`
- [x] No references to deleted files: `grep -r "observation-capture\|relationship-detection" --include="*.ts" api/ apps/` returns nothing

#### Manual Verification:
- [x] Full end-to-end webhook flow works
- [x] Inngest dashboard shows both functions completing successfully
- [x] Search, graph, related, findsimilar APIs all return correct data

---

## Testing Strategy

### Unit Tests
- Entity extraction with new structural categories (`commit`, `branch`, `pr`, `issue`, `deployment`)
- Edge rule resolution logic (most specific wins, bidirectional)
- Significance scoring (unchanged, regression test)

### Integration Tests
- Webhook → observation-store → observation-interpret → notification dispatch
- Two observations with shared entity → edge created
- Out-of-order events → edge still created on second arrival
- Reprocessing: delete interpretation + re-emit → new interpretation created

### Manual Testing Steps
1. Send GitHub push webhook → verify observation stored + interpretation created
2. Send Vercel deployment with same commit SHA → verify `deploys` edge
3. Send GitHub PR with "fixes #123" → then Linear issue → verify `fixes` edge
4. Verify search returns results with correct topics enrichment
5. Verify graph traversal works with entity-mediated edges

## Performance Considerations

- **Fast path target**: observation-store should complete in <2s (no LLM/embedding calls)
- **Entity upsert race conditions**: `UNIQUE (workspace_id, category, key)` + `onConflictDoUpdate` handles concurrent writes. Junction rows use `onConflictDoNothing`.
- **Junction table growth**: Each observation creates ~5-15 junction rows. At 10K observations/month = 50-150K junction rows/month. Index on `entity_id` and `observation_id` keeps queries fast.
- **Edge resolution query**: Junction table query with `IN` clause on entity IDs. Limited to 100 results. Should be <50ms.

## Migration Notes

- Phase 1 creates new tables without modifying existing ones — zero risk
- Phase 2 writes `null` to legacy columns — existing consumers still work on historical data
- Phase 4 drops columns — requires all consumers to be migrated first
- No data migration needed for existing rows — interpretation table starts empty, junction table starts empty. Historical data retains topics/significance on observation rows (consumers will fall back to observation row if no interpretation exists)

## References

- Research document: `thoughts/shared/research/2026-03-12-pipeline-restructure-architecture.md`
- Pipeline simplification (completed): `thoughts/shared/plans/2026-03-12-pipeline-simplification.md`
- SPEC.md: `/SPEC.md`
