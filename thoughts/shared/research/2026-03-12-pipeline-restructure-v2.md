---
date: "2026-03-12T14:00:00+08:00"
researcher: claude
git_commit: 26e8fa0b23532e2afdc7429afbc25af5f0c4b956
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Pipeline Restructure v2: Entity↔Entity Edges, Table Renames, and Naming Migration"
tags: [research, architecture, entity-edges, table-renames, graph-traversal, naming-migration, v2]
status: complete
supersedes: "2026-03-12-pipeline-restructure-architecture.md"
last_updated: "2026-03-12"
---

# Research: Pipeline Restructure v2

**Date**: 2026-03-12T14:00:00+08:00
**Git Commit**: `26e8fa0b23532e2afdc7429afbc25af5f0c4b956`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`
**Supersedes**: `2026-03-12-pipeline-restructure-architecture.md` — that document's edge model (observation↔observation) is wrong; this document designs entity↔entity edges and provides the complete rename map.

---

## Research Question

Design a complete implementation plan for: (1) replacing observation↔observation edges with entity↔entity edges, (2) renaming all five pipeline tables and associated code to the new `events/entities/edges/entity_events/interpretations` names, and (3) migrating all consumers.

---

## Summary

- **Most of the v1 plan is already implemented.** The codebase already has `observation-store.ts`, `observation-interpret.ts`, `edge-resolver.ts`, `workspace-entity-observations.ts`, and `workspace-observation-interpretations.ts`. Entity categories already include structural types. The observation row is already fact-only.
- **The single structural gap is edge direction.** `edge-resolver.ts` uses entity-mediated matching to find co-occurring observations but writes edges to `workspace_observation_relationships` (observation↔observation). These must become entity↔entity edges in a new `workspace_edges` table.
- **Naming collision exists.** A `workspace_events` table already exists as a raw webhook ingress log (read by SSE stream + `workspace.events.list` tRPC). The design wants to rename `workspace_neural_observations` to `workspace_events`. Resolution: rename the ingress log to `workspace_ingest_log` first.
- **Graph traversal change is the highest-risk consumer change.** `graph.ts` and `related.ts` traverse `workspace_observation_relationships` directly; they must be rewritten to traverse entity edges then resolve back to events for the API response.
- **All other consumer changes are mechanical renames.** `four-path-search.ts`, `entity-search.ts`, `id-resolver.ts`, `findsimilar.ts`, and `dispatch.ts` need only import updates and table reference changes.
- **Clean break is correct.** Pre-production, no user data. No aliases needed.

---

## A. Current State Audit

### A.1 What the v1 Plan Already Implemented

The previous restructure architecture document (`2026-03-12-pipeline-restructure-architecture.md`) was written as a design plan. Nearly all of it has been implemented on the current branch:

| v1 Decision | Status | Evidence |
|---|---|---|
| Split `observation-capture.ts` into 2 functions | ✅ Done | `observation-store.ts:107`, `observation-interpret.ts:102` |
| Create `workspace_observation_interpretations` | ✅ Done | `db/console/src/schema/tables/workspace-observation-interpretations.ts:22` |
| Create `workspace_entity_observations` junction | ✅ Done | `db/console/src/schema/tables/workspace-entity-observations.ts:21` |
| Entity-mediated edge resolution | ✅ Done | `edge-resolver.ts:28` — queries junction then evaluates provider rules |
| Edge rules on all 4 providers | ✅ Done | GitHub `index.ts:343`, Vercel `index.ts:173`, Sentry `index.ts:193`, Linear `index.ts:293` |
| Structural `EntityCategory` values | ✅ Done | `entities.ts:9-26` includes `commit`, `branch`, `pr`, `issue`, `deployment` |
| Observation row fact-only (no topics/embeddings) | ✅ Done | `workspace-neural-observations.ts` has no `topics`, `significance_score`, or `embedding_*_id` columns |
| Entities table: no `source_observation_id` | ✅ Done | `workspace-neural-entities.ts` — no such column |
| `EntityCategory` open-string principle | ⚠️ Partial | `entityCategorySchema` is `z.enum` (closed), column uses `.$type<EntityCategory>()` on `varchar(50)` — DB is open, Zod is closed |

The Inngest function registry already has both new functions:
```
// api/console/src/inngest/index.ts:30
observationInterpret, observationStore — from "./workflow/neural"
```

### A.2 What v2 Still Needs to Change

| Item | Status | File |
|---|---|---|
| Entity↔entity edges (`workspace_edges` table) | ❌ Not done | Must create new table |
| `edge-resolver.ts` writes entity↔entity edges | ❌ Not done | Currently writes to `workspaceObservationRelationships` |
| `graph.ts` entity-mediated traversal | ❌ Not done | Currently BFS over `workspaceObservationRelationships` |
| `related.ts` entity-mediated traversal | ❌ Not done | Same as above |
| Table renames (5 tables) | ❌ Not done | Mechanical but large surface area |
| Naming collision: `workspace_events` | ❌ Not done | Existing ingress log must be renamed first |
| Inngest event name renames (`observation.*` → `event.*`) | ❌ Not done | `client.ts` + all callers |
| Inngest function ID renames | ❌ Not done | `observation-store.ts:108`, `observation-interpret.ts:103` |
| File renames | ❌ Not done | 7 source files |

### A.3 Current Pipeline Shape (as-is today)

```
ingress/route.ts
  → INSERT workspace_events (raw PostTransformEvent JSONB) ← raw ingress log
  → inngest.send("apps-console/neural/observation.capture", { workspaceId, sourceEvent })

observation-store (Inngest, id: "apps-console/neural.observation.store")
  trigger: "apps-console/neural/observation.capture"
  ├─ generate-replay-safe-ids
  ├─ resolve-clerk-org-id          → reads orgWorkspaces
  ├─ create-job
  ├─ update-job-running
  ├─ check-duplicate               → reads workspaceNeuralObservations (workspaceId, sourceId)
  ├─ check-event-allowed           → reads workspaceIntegrations
  ├─ evaluate-significance         → rule-based scoring
  ├─ extract-entities              → regex + reference extraction (no DB)
  ├─ store-observation             → INSERT workspaceNeuralObservations (fact-only)
  ├─ upsert-entities-and-junctions → UPSERT workspaceNeuralEntities + INSERT workspaceEntityObservations
  └─ emit-observation-stored       → sends "apps-console/neural/observation.stored"
       { observationId, workspaceId, source, sourceType, significanceScore, entityRefs, internalObservationId }

observation-interpret (Inngest, id: "apps-console/neural.observation.interpret")
  trigger: "apps-console/neural/observation.stored"
  ├─ fetch-observation             → reads workspaceNeuralObservations by internalObservationId
  ├─ fetch-workspace               → reads orgWorkspaces
  ├─ classify-observation          → LLM (claude-3-5-haiku-latest), with regex fallback
  ├─ generate-multi-view-embeddings → 3 vectors (title, content, summary)
  ├─ upsert-multi-view-vectors     → Pinecone batch upsert
  ├─ store-interpretation          → INSERT workspaceObservationInterpretations
  ├─ resolve-edges                 → entity-mediated lookup + INSERT workspaceObservationRelationships ← WRONG TABLE
  └─ emit-observation-captured     → sends "apps-console/neural/observation.captured"
       { workspaceId, observationId, observationType, significanceScore, topics, entitiesExtracted }
```

**The bug is in `resolve-edges`**: `edge-resolver.ts` correctly finds co-occurring observations via the entity junction table, but then writes the edges into `workspaceObservationRelationships` (observation↔observation). Under the v2 design, it must write entity↔entity edges to `workspace_edges`.

---

## B. Naming Collision: `workspace_events`

### B.1 The Existing Table

`workspace_events` (`lightfast_workspace_events`, `db/console/src/schema/tables/workspace-events.ts:25`) is the raw webhook ingress log. Written once at ingress before the Inngest pipeline runs:

**Columns:** `id`, `workspaceId`, `deliveryId`, `source`, `sourceType`, `sourceEvent` (JSONB — full `PostTransformEvent`), `ingestionSource`, `receivedAt`, `createdAt`

**Consumers:**
1. `apps/console/src/app/api/gateway/stream/route.ts:93` — SSE catch-up query: `SELECT id, workspaceId, sourceEvent WHERE workspaceId = ? AND id > ? ORDER BY id LIMIT 1000`
2. `api/console/src/router/org/workspace.ts:1233` — `workspace.events.list` tRPC: paginated event feed with filtering by source, date, search

### B.2 Resolution

The design calls `workspace_neural_observations` the future `workspace_events` (immutable pipeline-processed facts). The existing `workspace_events` is semantically a delivery/ingress log — it stores the raw payload before processing.

**Decision: Rename existing `workspace_events` to `workspace_ingest_log`.**

This is the cleaner option because:
- The ingress log stores the raw `PostTransformEvent` JSONB blob, not a normalized record — "ingest log" is a more accurate name
- The processed, normalized record (`workspace_neural_observations`) better deserves the name `workspace_events` as the canonical event store
- The tRPC procedure `workspace.events.list` becomes `workspace.ingestLog.list` (or keep `workspace.events.list` pointing to the new `workspace_events` table — the processed events are what the UI should show long-term)

**Rename sequence (critical ordering):**
1. Rename `workspaceEvents` → `workspaceIngestLog` (file, export, pgTable name)
2. Generate + apply migration: `lightfast_workspace_events` → `lightfast_workspace_ingest_log`
3. Then rename `workspaceNeuralObservations` → `workspaceEvents`
4. Generate + apply migration: `lightfast_workspace_neural_observations` → `lightfast_workspace_events`

These must be separate migrations — Postgres cannot rename a table to a name that currently exists in the same transaction.

**Files that need updating for step 1** (8 consumer references):
- `db/console/src/schema/tables/workspace-events.ts` — rename file to `workspace-ingest-log.ts`, rename export
- `db/console/src/schema/tables/index.ts` — update re-export
- `db/console/src/schema/index.ts` — update re-export
- `db/console/src/index.ts` — update re-export
- `apps/console/src/app/api/gateway/ingress/route.ts:2` — import update + column references
- `apps/console/src/app/api/gateway/stream/route.ts:2` — import update + column references
- `api/console/src/router/org/workspace.ts:5` — import update + column references
- `api/console/src/router/org/__tests__/notify-backfill.test.ts:27` — mock update

---

## C. Five-Table Design (Final State)

### C.1 `workspace_events` (renamed from `workspace_neural_observations`)

> No structural changes. Rename only.

```typescript
// db/console/src/schema/tables/workspace-events.ts
// pgTable: "lightfast_workspace_events"
// TypeScript export: workspaceEvents

export const workspaceEvents = pgTable(
  "lightfast_workspace_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    externalId: varchar("external_id", { length: 21 }).notNull().unique().$defaultFn(() => nanoid()),
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { mode: "string", withTimezone: true }).notNull(),
    capturedAt: timestamp("captured_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`).notNull(),
    actor: jsonb().$type<ObservationActor | null>(),
    actorId: bigint("actor_id", { mode: "number" }),
    observationType: varchar("observation_type", { length: 100 }).notNull(),
    title: text().notNull(),
    content: text().notNull(),
    source: varchar({ length: 50 }).notNull(),
    sourceType: varchar("source_type", { length: 100 }).notNull(),
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    sourceReferences: jsonb("source_references").$type<ObservationReference[]>(),
    metadata: jsonb().$type<ObservationMetadata>(),
    ingestionSource: varchar("ingestion_source", { length: 20 }).default("webhook").notNull(),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    externalIdIdx: uniqueIndex("event_external_id_idx").on(table.externalId),
    workspaceOccurredIdx: index("event_workspace_occurred_idx").on(table.workspaceId, table.occurredAt),
    sourceIdx: index("event_source_idx").on(table.workspaceId, table.source, table.sourceType),
    sourceIdIdx: uniqueIndex("event_source_id_idx").on(table.workspaceId, table.sourceId),
    typeIdx: index("event_type_idx").on(table.workspaceId, table.observationType),
  })
);

export type WorkspaceEvent = typeof workspaceEvents.$inferSelect;
export type InsertWorkspaceEvent = typeof workspaceEvents.$inferInsert;
```

**Column justification:**
| Column | Written by | Read by | Notes |
|---|---|---|---|
| `externalId` | `event-store` step `store-observation` | graph.ts, related.ts, id-resolver.ts, all API responses | Public nanoid identifier |
| `sourceId` | `event-store` | `check-duplicate` step (dedup) | Unique per workspace, dedup key |
| `observationType` | `event-store` via `deriveObservationType()` | id-resolver.ts, dispatch.ts event payload | Stable fact about event classification |
| `title`, `content` | `event-store` | id-resolver.ts, classification prompt | Raw event text |
| `sourceReferences` | `event-store` | `extract-entities` step | Structured references for entity extraction |
| `actor` | `event-store` | Not currently queried directly (read via id-resolver) | Raw actor fact |

**Dropped columns (already done in current codebase):** `topics`, `significance_score`, `embedding_title_id`, `embedding_content_id`, `embedding_summary_id`, `cluster_id` — all moved to `workspace_interpretations`.

**Index changes:** Rename index names from `obs_*` to `event_*` prefix. The dedup index on `source_id` becomes `uniqueIndex` (it already enforces uniqueness via `UNIQUE (workspace_id, source_id)` — the current `obs_source_id_idx` is a regular index).

---

### C.2 `workspace_entities` (renamed from `workspace_neural_entities`)

> No structural changes. Rename only.

```typescript
// db/console/src/schema/tables/workspace-entities.ts
// pgTable: "lightfast_workspace_entities"
// TypeScript export: workspaceEntities

export const workspaceEntities = pgTable(
  "lightfast_workspace_entities",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    externalId: varchar("external_id", { length: 21 }).notNull().unique().$defaultFn(() => nanoid()),
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
    category: varchar({ length: 50 }).$type<EntityCategory>().notNull(),
    key: varchar({ length: 500 }).notNull(),
    value: text(),
    aliases: jsonb().$type<string[]>(),
    evidenceSnippet: text("evidence_snippet"),
    confidence: real().default(0.8),
    extractedAt: timestamp("extracted_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`).notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`).notNull(),
    occurrenceCount: integer("occurrence_count").default(1).notNull(),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    externalIdIdx: uniqueIndex("entity_external_id_idx").on(table.externalId),
    uniqueEntityKey: uniqueIndex("entity_workspace_category_key_idx").on(table.workspaceId, table.category, table.key),
    workspaceCategoryIdx: index("entity_workspace_category_idx").on(table.workspaceId, table.category),
    workspaceKeyIdx: index("entity_workspace_key_idx").on(table.workspaceId, table.key),
    workspaceLastSeenIdx: index("entity_workspace_last_seen_idx").on(table.workspaceId, table.lastSeenAt),
  })
);

export type WorkspaceEntity = typeof workspaceEntities.$inferSelect;
export type InsertWorkspaceEntity = typeof workspaceEntities.$inferInsert;
```

**Column justification:** Unchanged from current `workspace_neural_entities`. The `(workspace_id, category, key)` unique constraint is the identity key for entity dedup — a commit SHA `abc123` is `(workspaceId, "commit", "abc123")` and will not collide with a branch named `abc123` (category `"branch"`).

**No dropped columns** — `source_observation_id` was already removed in the v1 implementation. Entity→event links are exclusively via the `workspace_entity_events` junction table.

**Index renames only** (`entity_*` prefix stays, no change needed).

---

### C.3 `workspace_edges` (NEW — replaces `workspace_observation_relationships`)

> **This is the core structural change.** Entity↔entity directed edges replacing observation↔observation edges.

```typescript
// db/console/src/schema/tables/workspace-edges.ts (new file)
// pgTable: "lightfast_workspace_edges"
// TypeScript export: workspaceEdges

export const workspaceEdges = pgTable(
  "lightfast_workspace_edges",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    externalId: varchar("external_id", { length: 21 }).notNull().unique().$defaultFn(() => nanoid()),
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
    // Entity↔entity directed edge (NOT observation↔observation)
    sourceEntityId: bigint("source_entity_id", { mode: "number" })
      .notNull()
      .references(() => workspaceEntities.id, { onDelete: "cascade" }),
    targetEntityId: bigint("target_entity_id", { mode: "number" })
      .notNull()
      .references(() => workspaceEntities.id, { onDelete: "cascade" }),
    // Open string — NOT a closed enum
    relationshipType: varchar("relationship_type", { length: 50 }).notNull(),
    // Provenance: which event caused this edge to be created
    sourceEventId: bigint("source_event_id", { mode: "number" })
      .references(() => workspaceEvents.id, { onDelete: "set null" }),
    confidence: real().default(1.0).notNull(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    externalIdIdx: uniqueIndex("edge_external_id_idx").on(table.externalId),
    sourceIdx: index("edge_source_idx").on(table.workspaceId, table.sourceEntityId),
    targetIdx: index("edge_target_idx").on(table.workspaceId, table.targetEntityId),
    // Prevent duplicate edges: same entity pair + same relationship type = idempotent
    uniqueEdgeIdx: uniqueIndex("edge_unique_idx").on(
      table.workspaceId,
      table.sourceEntityId,
      table.targetEntityId,
      table.relationshipType
    ),
    sourceEventIdx: index("edge_source_event_idx").on(table.sourceEventId),
  })
);

export type WorkspaceEdge = typeof workspaceEdges.$inferSelect;
export type InsertWorkspaceEdge = typeof workspaceEdges.$inferInsert;
```

**Column justification:**

| Column | vs `workspace_observation_relationships` | Justification |
|---|---|---|
| `source_entity_id` FK → `workspace_entities` | Replaces `source_observation_id` FK → observations | Relationships exist between entities, not events. A commit deploys to a deployment — those are entities. |
| `target_entity_id` FK → `workspace_entities` | Replaces `target_observation_id` FK → observations | Same |
| `relationship_type` VARCHAR(50), open string | Was `VARCHAR(50)` typed with `RelationshipType` TS union | Kept as open string — new providers can add new types without changing code |
| `source_event_id` FK → `workspace_events` | NEW — was `linking_key`/`linking_key_type` | Provenance: which event triggered this edge. FK to events instead of a JSONB key. `ON DELETE SET NULL` — edge survives if event is deleted. |
| DROPPED: `linking_key`, `linking_key_type` | Was the entity key stored as string | Replaced by entity FKs — the entity IS the key. No need to denormalize. |
| `confidence` REAL | Unchanged | 1.0 for rule-based, <1.0 for co-occurs fallback |
| `metadata` JSONB | Unchanged | Stores `{ detectionMethod: "entity_cooccurrence" }` |

**Index strategy:**
- `edge_source_idx (workspace_id, source_entity_id)` — entity graph traversal: "all edges where entity X is source"
- `edge_target_idx (workspace_id, target_entity_id)` — entity graph traversal: "all edges where entity X is target"
- `edge_unique_idx` — dedup: one edge per (workspace, source_entity, target_entity, relationship_type) — `onConflictDoNothing` uses this
- `edge_source_event_idx` — provenance queries: "all edges created by event E"

**Why `ON DELETE SET NULL` for `source_event_id`:** The edge captures a structural relationship (entity A deploys to entity B). If the source event is deleted, the relationship is still real — losing provenance is acceptable. `ON DELETE CASCADE` would silently remove valid graph edges when events are purged.

---

### C.4 `workspace_entity_events` (renamed from `workspace_entity_observations`)

> No structural changes. Rename only.

```typescript
// db/console/src/schema/tables/workspace-entity-events.ts
// pgTable: "lightfast_workspace_entity_events"
// TypeScript export: workspaceEntityEvents

export const workspaceEntityEvents = pgTable(
  "lightfast_workspace_entity_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    entityId: bigint("entity_id", { mode: "number" })
      .notNull()
      .references(() => workspaceEntities.id, { onDelete: "cascade" }),
    eventId: bigint("event_id", { mode: "number" })   // was: observationId / observation_id
      .notNull()
      .references(() => workspaceEvents.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
    refLabel: varchar("ref_label", { length: 50 }),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    uniqueEntityEvent: uniqueIndex("ee_entity_event_idx").on(table.entityId, table.eventId),
    entityIdx: index("ee_entity_idx").on(table.entityId),
    eventIdx: index("ee_event_idx").on(table.eventId),
  })
);

export type WorkspaceEntityEvent = typeof workspaceEntityEvents.$inferSelect;
export type InsertWorkspaceEntityEvent = typeof workspaceEntityEvents.$inferInsert;
```

**One column rename:** `observation_id` → `event_id`. This is the only change besides the table/export rename.

**Index rename:** `eo_*` → `ee_*` prefix (entity_event).

---

### C.5 `workspace_interpretations` (renamed from `workspace_observation_interpretations`)

> No structural changes. Rename only. FK column renamed from `observation_id` to `event_id`.

```typescript
// db/console/src/schema/tables/workspace-interpretations.ts
// pgTable: "lightfast_workspace_interpretations"
// TypeScript export: workspaceInterpretations

export const workspaceInterpretations = pgTable(
  "lightfast_workspace_interpretations",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    eventId: bigint("event_id", { mode: "number" })   // was: observationId / observation_id
      .notNull()
      .references(() => workspaceEvents.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
    version: integer().default(1).notNull(),
    primaryCategory: varchar("primary_category", { length: 50 }),
    topics: jsonb().$type<string[]>(),
    significanceScore: real("significance_score"),
    embeddingTitleId: varchar("embedding_title_id", { length: 191 }),
    embeddingContentId: varchar("embedding_content_id", { length: 191 }),
    embeddingSummaryId: varchar("embedding_summary_id", { length: 191 }),
    modelVersion: varchar("model_version", { length: 100 }),
    processedAt: timestamp("processed_at", { mode: "string", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    eventVersionIdx: uniqueIndex("interp_event_version_idx").on(table.eventId, table.version),
    eventIdx: index("interp_event_idx").on(table.eventId),
    workspaceProcessedIdx: index("interp_workspace_processed_idx").on(table.workspaceId, table.processedAt),
    embeddingTitleIdx: index("interp_embedding_title_idx").on(table.workspaceId, table.embeddingTitleId),
    embeddingContentIdx: index("interp_embedding_content_idx").on(table.workspaceId, table.embeddingContentId),
    embeddingSummaryIdx: index("interp_embedding_summary_idx").on(table.workspaceId, table.embeddingSummaryId),
  })
);

export type WorkspaceInterpretation = typeof workspaceInterpretations.$inferSelect;
export type InsertWorkspaceInterpretation = typeof workspaceInterpretations.$inferInsert;
```

---

## D. Pipeline Step-by-Step

The pipeline is already implemented. The steps below reflect the current implementation with the new names and the key change to edge resolution.

### D.1 `event-store` (rename from `observation-store`)

**File:** `api/console/src/inngest/workflow/neural/event-store.ts`
**Function id:** `"apps-console/event.store"` (was `"apps-console/neural.observation.store"`)
**Trigger:** `"apps-console/event.capture"` (was `"apps-console/neural/observation.capture"`)
**Exported identifier:** `eventStore` (was `observationStore`)
**Config:** `retries: 3`, `concurrency: { limit: 10, key: "event.data.workspaceId" }`, `timeouts: { start: "1m", finish: "2m" }`
**Idempotency:** `"event.data.workspaceId + '-' + event.data.sourceEvent.sourceId"`

| Step name | What it does | DB reads | DB writes |
|---|---|---|---|
| `generate-replay-safe-ids` | nanoid + Date.now() memoized | — | — |
| `resolve-clerk-org-id` | Get clerkOrgId for workspaceId | `orgWorkspaces` | — |
| `create-job` | Create pipeline job record | — | job table |
| `update-job-running` | Mark job running | — | job table |
| `check-duplicate` | Dedup by (workspaceId, sourceId) | `workspaceEvents` (new name) | — |
| `complete-job-duplicate` | Early exit if duplicate | — | job table |
| `check-event-allowed` | Check integration sync config | `workspaceIntegrations` | — |
| `complete-job-filtered` | Early exit if not allowed | — | job table |
| `evaluate-significance` | Rule-based score 0-100 | — | — |
| `complete-job-below-threshold` | Early exit if score < 40 | — | job table |
| `extract-entities` | Regex + reference extraction | — | — |
| `store-observation` → `store-event` | INSERT immutable event fact | — | `workspaceEvents` |
| `upsert-entities-and-junctions` | Upsert entities + junction rows | — | `workspaceEntities`, `workspaceEntityEvents` |
| `emit-event-stored` | Send downstream Inngest event | — | — (Inngest) |
| `complete-job-success` | Mark job success | — | job table |

**`step.sendEvent` payload (new name):**
```typescript
// Event: "apps-console/event.stored"
{
  eventId: string,           // externalId (nanoid) — was observationId
  workspaceId: string,
  clerkOrgId: string | undefined,
  source: string,
  sourceType: string,
  significanceScore: number,
  entityRefs: Array<{ type: string; key: string; label: string | null }>,
  internalEventId: number,   // DB bigint PK — was internalObservationId
}
```

**Error handling:**
- `check-duplicate`: returns `{ status: "duplicate" }` early — non-retryable (dedup by sourceId is final)
- `check-event-allowed`: returns `{ status: "filtered" }` early — non-retryable
- `evaluate-significance`: returns `{ status: "filtered" }` early — non-retryable
- `store-event`: throws `NonRetriableError` if no row returned from `.returning()` — DB write failure
- All other steps: retryable via Inngest default retry

**On-failure handler:** `createNeuralOnFailureHandler("apps-console/event.capture", { ... })` — same pattern as today, listens to `"apps-console/event.capture"` (`on-failure-handler.ts:44`).

---

### D.2 `event-interpret` (rename from `observation-interpret`)

**File:** `api/console/src/inngest/workflow/neural/event-interpret.ts`
**Function id:** `"apps-console/event.interpret"` (was `"apps-console/neural.observation.interpret"`)
**Trigger:** `"apps-console/event.stored"` (was `"apps-console/neural/observation.stored"`)
**Exported identifier:** `eventInterpret` (was `observationInterpret`)
**Config:** `retries: 3`, `timeouts: { start: "2m", finish: "10m" }`

| Step name | What it does | DB reads | DB writes | External |
|---|---|---|---|---|
| `fetch-event` | Load event by internalEventId | `workspaceEvents` | — | — |
| `fetch-workspace` | Load workspace settings | `orgWorkspaces` | — | — |
| `classify-event` | LLM classification + regex fallback | — | — | Claude Haiku |
| `generate-multi-view-embeddings` | 3 vectors (title, content, summary) | — | — | Embedding API |
| `upsert-multi-view-vectors` | Batch upsert to Pinecone | — | — | Pinecone |
| `store-interpretation` | INSERT versioned interpretation | — | `workspaceInterpretations` | — |
| `resolve-edges` | Entity-mediated edge creation | `workspaceEntities`, `workspaceEntityEvents`, `workspaceEvents` | `workspaceEdges` ← **KEY CHANGE** | — |
| `emit-event-interpreted` | Send downstream Inngest event | — | — | — |

**`step.sendEvent` payload:**
```typescript
// Event: "apps-console/event.interpreted"
{
  workspaceId: string,
  clerkOrgId: string | undefined,
  eventId: string,           // externalId — was observationId
  sourceId: string,
  observationType: string,   // stable, keep name for now
  significanceScore: number | undefined,
  topics: string[] | undefined,
  entitiesExtracted: number | undefined,
}
```

**Error handling:**
- `fetch-event`: throws `NonRetriableError` if event not found in DB (should not happen — `event-store` wrote it)
- `fetch-workspace`: throws `NonRetriableError` if workspace not found or settings invalid
- `classify-event`: retryable; fallback to regex classification if LLM fails
- `generate-multi-view-embeddings`: retryable; if this step retries, previous steps (classify) are not re-run
- `upsert-multi-view-vectors`: retryable
- `store-interpretation`: retryable with upsert semantics
- `resolve-edges`: retryable with `onConflictDoNothing` idempotency

---

## E. Edge Resolution Design

### E.1 Provider Reference Types Matrix

All reference types come from the closed `z.enum` in `post-transform-event.ts:18-35` (11 values: commit, branch, pr, issue, deployment, project, cycle, assignee, reviewer, team, label).

| `refType` | GitHub | Vercel | Sentry | Linear |
|---|---|---|---|---|
| `commit` | push: always; PR head SHA, merge SHA | conditional (gitMeta.githubCommitSha) | issue only, when `statusDetails.inCommit` present (`label: "resolved_by"`) | never |
| `branch` | push: always; PR head ref; release target | conditional (gitMeta.githubCommitRef) | never | issue branchName (conditional) |
| `pr` | PR: always | conditional (gitMeta.githubPrId) | never | issue attachments with `sourceType="githubPr"` (`label: "tracked_in"`) |
| `issue` | PR body `fixes #N`, GitHub Issues | never | issue.shortId (always in issue events) | issue identifier (always); Sentry attachments (`label: "linked"`) |
| `deployment` | never | always | never | never |
| `project` | never | project.id (always) | issue.project.slug, error.project | issue (conditional), project (always) |
| `cycle` | never | never | never | issue (conditional), cycle (always) |

### E.2 Current Edge Rules (already implemented)

**GitHub** (`packages/console-providers/src/providers/github/index.ts:343`):
```typescript
edgeRules: [
  { refType: "commit", matchProvider: "vercel",  matchRefType: "commit", relationshipType: "deploys",     confidence: 1.0 },
  { refType: "commit", selfLabel: "resolved_by", matchProvider: "sentry", matchRefType: "commit", relationshipType: "resolves", confidence: 1.0 },
  { refType: "commit", matchProvider: "*",       matchRefType: "commit", relationshipType: "same_commit", confidence: 1.0 },
  { refType: "branch", matchProvider: "*",       matchRefType: "branch", relationshipType: "same_branch", confidence: 0.9 },
  { refType: "pr",     matchProvider: "*",       matchRefType: "pr",     relationshipType: "tracked_in",  confidence: 1.0 },
  { refType: "issue",  selfLabel: "fixes",       matchProvider: "*",     matchRefType: "issue",           relationshipType: "fixes",      confidence: 1.0 },
  { refType: "issue",  matchProvider: "*",       matchRefType: "issue",  relationshipType: "references",  confidence: 0.8 },
]
```

**Vercel** (`packages/console-providers/src/providers/vercel/index.ts:173`):
```typescript
edgeRules: [
  { refType: "commit",     matchProvider: "github", matchRefType: "commit",     relationshipType: "deploys",     confidence: 1.0 },
  { refType: "commit",     matchProvider: "*",      matchRefType: "commit",     relationshipType: "same_commit", confidence: 1.0 },
  { refType: "deployment", matchProvider: "*",      matchRefType: "deployment", relationshipType: "references",  confidence: 0.8 },
]
```

**Sentry** (`packages/console-providers/src/providers/sentry/index.ts:193`):
```typescript
edgeRules: [
  { refType: "commit", selfLabel: "resolved_by", matchProvider: "*",     matchRefType: "commit", relationshipType: "resolves",  confidence: 1.0 },
  { refType: "issue",  matchProvider: "linear",  matchRefType: "issue",  relationshipType: "triggers", confidence: 0.8 },
]
```

**Linear** (`packages/console-providers/src/providers/linear/index.ts:293`):
```typescript
edgeRules: [
  { refType: "issue",  selfLabel: "linked",  matchProvider: "sentry",  matchRefType: "issue",  relationshipType: "triggers",   confidence: 0.8 },
  { refType: "pr",     matchProvider: "github", matchRefType: "pr",    relationshipType: "tracked_in", confidence: 1.0 },
  { refType: "issue",  matchProvider: "*",   matchRefType: "issue",  relationshipType: "references", confidence: 0.8 },
  { refType: "branch", matchProvider: "*",   matchRefType: "branch", relationshipType: "same_branch", confidence: 0.9 },
]
```

### E.3 Updated Edge Resolution Algorithm

The key change: `edge-resolver.ts` currently writes to `workspaceObservationRelationships`. It must write to `workspaceEdges` with entity FKs.

**Current flow (to be replaced):**
```typescript
// edge-resolver.ts:166-191 (current)
// Writes to workspaceObservationRelationships
db.insert(workspaceObservationRelationships).values({
  sourceObservationId: observationId,   // obs-to-obs
  targetObservationId: coObs.observationId,
  ...
})
```

**New flow (`edge-resolver.ts` after v2):**
```typescript
// resolveEdges signature changes:
export async function resolveEdges(
  workspaceId: string,
  eventId: number,           // was: observationId
  source: string,
  entityRefs: Array<{ type: string; key: string; label: string | null }>
): Promise<number>

// Step 1: Find entity IDs for our structural refs
// (unchanged — queries workspaceEntities)

// Step 2: Find co-occurring events via junction
// was: SELECT observationId FROM workspaceEntityObservations WHERE entityId IN [...] AND observationId != observationId
// new: SELECT eventId FROM workspaceEntityEvents WHERE entityId IN [...] AND eventId != eventId

// Step 3: Load co-event sources
// was: SELECT id, source FROM workspaceNeuralObservations WHERE id IN [coObsIds]
// new: SELECT id, source FROM workspaceEvents WHERE id IN [coEventIds]

// Step 4: Evaluate rules (UNCHANGED — same bidirectional rule evaluation)

// Step 5: Insert entity↔entity edges (KEY CHANGE)
db.insert(workspaceEdges).values({
  workspaceId,
  sourceEntityId: entityIdForOurRef,       // entity from OUR event
  targetEntityId: entityIdForTheirRef,     // entity from co-occurring event
  relationshipType: bestRule.relationshipType,
  sourceEventId: eventId,                  // provenance — our event caused this edge
  confidence: bestRule.confidence,
  metadata: { detectionMethod: "entity_cooccurrence" },
}).onConflictDoNothing();
// Conflicts on: (workspaceId, sourceEntityId, targetEntityId, relationshipType)
```

**Priority of rule selection** (unchanged, `edge-resolver.ts:105-158`):
1. `selfLabel` match + specific `matchProvider` — highest specificity
2. `selfLabel` match + wildcard `matchProvider: "*"`
3. No `selfLabel` + specific `matchProvider`
4. No `selfLabel` + wildcard `matchProvider: "*"`
5. Fallback: `{ relationshipType: "co_occurs", confidence: 0.5 }` — no rule matched

### E.4 Out-of-Order Event Scenario

Scenario: Vercel deployment arrives before the GitHub push it references.

```
T=0: Vercel deployment.ready arrives
  → event-store:
    - Entity created: (commit, "abc123") — from gitMeta.githubCommitSha
    - Entity junction: (entity:commit:abc123, event:vercel-dep-1)
  → event-interpret / resolve-edges:
    - Queries workspaceEntityEvents WHERE entityId = entity:commit:abc123 AND eventId != vercel-dep-1
    - Result: empty (no other events reference this commit yet)
    - 0 edges created

T=30s: GitHub push arrives with same commit SHA
  → event-store:
    - Entity found (upsert): (commit, "abc123") — already exists, occurrenceCount++
    - Entity junction: (entity:commit:abc123, event:github-push-1) — NEW row
  → event-interpret / resolve-edges:
    - Queries workspaceEntityEvents WHERE entityId = entity:commit:abc123 AND eventId != github-push-1
    - Result: [(entityId: X, eventId: vercel-dep-1)]  ← finds the earlier Vercel event
    - Loads Vercel event source = "vercel"
    - GitHub rule: { refType: "commit", matchProvider: "vercel", matchRefType: "commit", relationshipType: "deploys" }
    - Vercel rule: { refType: "commit", matchProvider: "github", matchRefType: "commit", relationshipType: "deploys" }
    - Both rules match. GitHub rule wins (more specific: matchProvider = "vercel" vs wildcard).
    - Edge created: entity(commit:abc123) does NOT have a single edge direction here —
      the edge is between the COMMIT entity and the DEPLOYMENT entity, not commit-to-commit.
```

Wait — the edge rules as currently defined match on `refType` from one event and `matchRefType` from the other event. But in the new entity model, both observations share the same entity (commit:abc123). The edge should be between the commit entity and the deployment entity.

**Corrected algorithm for entity↔entity edges:**

When GitHub push (commit:abc123, branch:feat/x) co-occurs with Vercel deployment.ready (commit:abc123, deployment:dep_xyz):
1. Shared entity: `entity(commit:abc123)` — both events reference it
2. For each pair of refs from the two events:
   - GitHub's `commit:abc123` + Vercel's `commit:abc123` → `same_commit` (not `deploys` — they're the same entity!)
   - GitHub's `commit:abc123` + Vercel's `deployment:dep_xyz` → `deploys` via GitHub's rule `{ refType: "commit", matchProvider: "vercel", matchRefType: "deployment" }`
3. Create edge: `entity(commit:abc123) →[deploys]→ entity(deployment:dep_xyz)`, sourceEventId = github-push-1

**Edge rule update required:** The current rules match `commit → commit` across providers. For entity↔entity edges, we need rules that match across DIFFERENT entity types. The GitHub rule `{ refType: "commit", matchProvider: "vercel", matchRefType: "commit" }` creates a `same_commit` edge between two identical entities — which is a self-edge or a no-op.

The correct cross-type rules should be:
```typescript
// GitHub — needs update for entity↔entity model
edgeRules: [
  // GitHub commit → Vercel deployment (cross-entity type)
  { refType: "commit", matchProvider: "vercel", matchRefType: "deployment", relationshipType: "deploys", confidence: 1.0 },
  // GitHub commit → Sentry commit (same entity, different event context)
  { refType: "commit", selfLabel: "resolved_by", matchProvider: "sentry", matchRefType: "commit", relationshipType: "resolves", confidence: 1.0 },
  // GitHub PR → Linear PR attachment
  { refType: "pr", matchProvider: "linear", matchRefType: "pr", relationshipType: "tracked_in", confidence: 1.0 },
  // Generic cross-event edges on shared entity type
  { refType: "branch", matchProvider: "*", matchRefType: "branch", relationshipType: "same_branch", confidence: 0.9 },
  { refType: "issue", selfLabel: "fixes", matchProvider: "*", matchRefType: "issue", relationshipType: "fixes", confidence: 1.0 },
  { refType: "issue", matchProvider: "*", matchRefType: "issue", relationshipType: "references", confidence: 0.8 },
]
```

**This is a required edge rule update** — the current rules were designed for observation↔observation edges (where both observations share a ref type). For entity↔entity edges, when two observations share a `commit` entity, the interesting relationship is between the commit entity and OTHER entities from the same co-occurring observation (e.g. `deployment`, `issue`).

The `resolve-edges` algorithm must be updated to:
1. For each shared entity (by category + key), find the OTHER entity refs from both co-occurring events
2. Apply edge rules to cross-entity-type pairs (e.g., commit entity from event A vs deployment entity from event B)
3. Create entity↔entity edges for matching cross-type pairs

---

## F. Consumer Migration Map

### F.1 `graph.ts` — Structural Change (highest complexity)

**File:** `apps/console/src/lib/v1/graph.ts`
**Current imports:** `workspaceNeuralObservations`, `workspaceObservationRelationships`
**New imports:** `workspaceEvents`, `workspaceEdges`, `workspaceEntityEvents`, `workspaceEntities`

**Current BFS (lines 63-183):**
```typescript
// 1. Find root observation by externalId
const rootObs = await db.query.workspaceNeuralObservations.findFirst({
  where: and(eq(...workspaceId), eq(...externalId))
});

// 2. BFS loop — frontier = [rootObs.id] (bigint obs IDs)
const relationships = await db.select().from(workspaceObservationRelationships)
  .where(and(eq(...workspaceId), or(
    inArray(...sourceObservationId, frontier),
    inArray(...targetObservationId, frontier)
  )));
// Collect neighbor obs IDs, fetch observations, repeat up to depth 3
```

**New BFS (entity-mediated):**
```typescript
// 1. Find root event by externalId
const rootEvent = await db.query.workspaceEvents.findFirst({
  where: and(eq(...workspaceId), eq(...externalId))
});

// 2. Get entities for root event
const rootJunctions = await db.select({ entityId: workspaceEntityEvents.entityId })
  .from(workspaceEntityEvents)
  .where(eq(workspaceEntityEvents.eventId, rootEvent.id));
const rootEntityIds = rootJunctions.map(j => j.entityId);

// 3. BFS loop — frontier = rootEntityIds (bigint entity IDs)
const edges = await db.select().from(workspaceEdges)
  .where(and(eq(...workspaceId), or(
    inArray(workspaceEdges.sourceEntityId, entityFrontier),
    inArray(workspaceEdges.targetEntityId, entityFrontier)
  )));

// 4. For each edge: find events for the neighbor entity
//    Use edge.sourceEventId as provenance event if available,
//    otherwise query workspaceEntityEvents for the neighbor entity
const neighborJunctions = await db.select({ eventId: workspaceEntityEvents.eventId })
  .from(workspaceEntityEvents)
  .where(inArray(workspaceEntityEvents.entityId, newEntityIds));

// 5. Fetch event details for all collected event IDs
const newEventNodes = await db.select({ id, externalId, title, source, observationType, occurredAt, metadata })
  .from(workspaceEvents)
  .where(inArray(workspaceEvents.id, newEventIds));
```

**Response edge mapping (entity edge → observation edge for API):**
```typescript
// For each workspace_edge, resolve to (source event, target event) pair:
// source event = the event that shares source_entity with the BFS frontier
// target event = the event that shares target_entity (found via junction)
edges.map(edge => ({
  source: sourceEvent.externalId,   // event that has source_entity
  target: targetEvent.externalId,   // event that has target_entity
  type: edge.relationshipType,
  linkingKey: null,                  // entity key is implicit in edge FKs
  confidence: edge.confidence,
}))
```

**Complexity change:** More complex internally (extra junction queries per BFS level), but the API response shape is unchanged (`GraphNode`, `GraphEdge`, `GraphResponse`). External API backwards compatible.

**Lines that change:** Entire BFS logic block (`graph.ts:63-183`). Imports at lines 1-6. No changes to request/response schema.

---

### F.2 `related.ts` — Structural Change

**File:** `apps/console/src/lib/v1/related.ts`
**Same structural change as graph.ts but single-depth only.**

**Current:** queries `workspaceObservationRelationships` WHERE `sourceObservationId = obs.id OR targetObservationId = obs.id`

**New:**
1. Get entities for root event via `workspaceEntityEvents`
2. Fetch all edges where `sourceEntityId IN rootEntityIds OR targetEntityId IN rootEntityIds`
3. Find events for neighbor entities via `workspaceEntityEvents`
4. Fetch event details

**Lines that change:** Lines 55-153. Imports at lines 1-6. API response shape unchanged.

---

### F.3 `four-path-search.ts` — Mechanical Rename

**File:** `apps/console/src/lib/neural/four-path-search.ts`
**Changes:** Import renames only. All queries already use the new table structure.

| Current import | New import |
|---|---|
| `workspaceNeuralObservations` | `workspaceEvents` |
| `workspaceObservationInterpretations` | `workspaceInterpretations` |
| `workspaceEntityObservations` | `workspaceEntityEvents` |
| `workspaceNeuralEntities` | `workspaceEntities` |

Column `observationId` on junction → `eventId`. All queries otherwise unchanged.

**Queries that change:**
- `workspaceEntityObservations.observationId` → `workspaceEntityEvents.eventId` (lines 609-620, 624-634)
- `workspaceObservationInterpretations.observationId` → `workspaceInterpretations.eventId` (lines 136-164)

**Complexity change:** Simpler (existing code already uses correct structure — just rename the identifiers).

---

### F.4 `entity-search.ts` — Mechanical Rename

**File:** `apps/console/src/lib/neural/entity-search.ts`

| Current | New |
|---|---|
| `workspaceEntityObservations.observationId` | `workspaceEntityEvents.eventId` |
| `workspaceNeuralObservations` | `workspaceEvents` |
| `workspaceNeuralEntities` | `workspaceEntities` |

No `source_observation_id` FK was used (already removed in v1). Queries unchanged except column name `observationId` → `eventId` in lines 115-122.

---

### F.5 `id-resolver.ts` — Mechanical Rename

**File:** `apps/console/src/lib/neural/id-resolver.ts`

| Current | New |
|---|---|
| `workspaceNeuralObservations` | `workspaceEvents` |
| `workspaceObservationInterpretations` | `workspaceInterpretations` |
| `workspaceObservationInterpretations.observationId` | `workspaceInterpretations.eventId` |

The `ResolvedObservation` interface (lines 23-33) can remain as-is or be renamed to `ResolvedEvent`. It contains only standard event fields (`id`, `externalId`, `title`, `content`, `source`, `sourceId`, `observationType`, `occurredAt`, `metadata`).

---

### F.6 `findsimilar.ts` — Mechanical Rename

**File:** `apps/console/src/lib/v1/findsimilar.ts`

| Current | New |
|---|---|
| `workspaceNeuralObservations` | `workspaceEvents` |
| `workspaceObservationInterpretations` | `workspaceInterpretations` |
| `workspaceObservationInterpretations.observationId` | `workspaceInterpretations.eventId` |

`clusterId` is already absent (`sameCluster: false` hardcoded at lines 492-493). No structural change.

---

### F.7 `dispatch.ts` — Event Name Change Only

**File:** `api/console/src/inngest/workflow/notifications/dispatch.ts`

**Current:** listens to `"apps-console/neural/observation.captured"`
**New:** listens to `"apps-console/event.interpreted"`

Fields destructured from `event.data` (lines 37-43) are unchanged: `workspaceId`, `clerkOrgId`, `observationId` (will become `eventId`), `observationType`, `significanceScore`, `topics`. All come from the event payload — zero DB reads.

---

## G. Event Schema Changes

### Current Events in `client.ts`

```typescript
// Current (client.ts:20-242)
"apps-console/neural/observation.capture"  → triggers event-store
"apps-console/neural/observation.stored"   → triggers event-interpret
"apps-console/neural/observation.captured" → triggers notification-dispatch
"apps-console/notification.dispatch"       → triggers notification workflow
```

### New Events

```typescript
// New Zod schemas for client.ts:

// 1. event.capture — inbound trigger from ingress (unchanged payload shape)
"apps-console/event.capture": z.object({
  workspaceId: z.string(),
  clerkOrgId: z.string().optional(),
  sourceEvent: postTransformEventSchema,  // full PostTransformEvent
  ingestionSource: z.string().optional().default("webhook"),
})

// 2. event.stored — slim reference payload (~200 bytes)
"apps-console/event.stored": z.object({
  eventId: z.string(),           // externalId nanoid
  workspaceId: z.string(),
  clerkOrgId: z.string().optional(),
  source: z.string(),
  sourceType: z.string(),
  significanceScore: z.number(),
  entityRefs: z.array(z.object({
    type: z.string(),            // open string
    key: z.string(),
    label: z.string().nullable(),
  })),
  internalEventId: z.number(),   // bigint DB PK for fast DB lookup
})

// 3. event.interpreted — downstream notification trigger
"apps-console/event.interpreted": z.object({
  workspaceId: z.string(),
  clerkOrgId: z.string().optional(),
  eventId: z.string(),           // externalId nanoid
  sourceId: z.string(),
  observationType: z.string(),
  significanceScore: z.number().optional(),
  topics: z.array(z.string()).optional(),
  entitiesExtracted: z.number().optional(),
})
```

**Events to delete from `client.ts`:**
- `"apps-console/neural/observation.capture"` → replaced by `"apps-console/event.capture"`
- `"apps-console/neural/observation.stored"` → replaced by `"apps-console/event.stored"`
- `"apps-console/neural/observation.captured"` → replaced by `"apps-console/event.interpreted"`

**`notify.ts` update** (`apps/console/src/app/api/gateway/ingress/_lib/notify.ts:15-28`): Change event name from `"apps-console/neural/observation.capture"` to `"apps-console/event.capture"`.

---

## H. Naming Migration

### H.1 Complete Rename Map

**Tables (pgTable name string + TypeScript export):**

| Old pgTable name | New pgTable name | Old TS export | New TS export |
|---|---|---|---|
| `lightfast_workspace_events` | `lightfast_workspace_ingest_log` | `workspaceEvents` | `workspaceIngestLog` |
| `lightfast_workspace_neural_observations` | `lightfast_workspace_events` | `workspaceNeuralObservations` | `workspaceEvents` |
| `lightfast_workspace_neural_entities` | `lightfast_workspace_entities` | `workspaceNeuralEntities` | `workspaceEntities` |
| `lightfast_workspace_observation_relationships` | DROP (replaced by `lightfast_workspace_edges`) | `workspaceObservationRelationships` | DROP |
| NEW: `lightfast_workspace_edges` | — | — | `workspaceEdges` |
| `lightfast_workspace_entity_observations` | `lightfast_workspace_entity_events` | `workspaceEntityObservations` | `workspaceEntityEvents` |
| `lightfast_workspace_observation_interpretations` | `lightfast_workspace_interpretations` | `workspaceObservationInterpretations` | `workspaceInterpretations` |

**Column renames (within tables):**

| Table (new name) | Old column | New column |
|---|---|---|
| `workspace_entity_events` | `observation_id` | `event_id` |
| `workspace_interpretations` | `observation_id` | `event_id` |

**Inngest function IDs:**

| Old ID | New ID |
|---|---|
| `"apps-console/neural.observation.store"` | `"apps-console/event.store"` |
| `"apps-console/neural.observation.interpret"` | `"apps-console/event.interpret"` |

**Inngest event names:**

| Old event name | New event name |
|---|---|
| `"apps-console/neural/observation.capture"` | `"apps-console/event.capture"` |
| `"apps-console/neural/observation.stored"` | `"apps-console/event.stored"` |
| `"apps-console/neural/observation.captured"` | `"apps-console/event.interpreted"` |

**File renames:**

| Old file | New file |
|---|---|
| `db/console/src/schema/tables/workspace-events.ts` | `workspace-ingest-log.ts` |
| `db/console/src/schema/tables/workspace-neural-observations.ts` | `workspace-events.ts` |
| `db/console/src/schema/tables/workspace-neural-entities.ts` | `workspace-entities.ts` |
| `db/console/src/schema/tables/workspace-observation-relationships.ts` | DELETE (replaced by `workspace-edges.ts`) |
| NEW: (does not exist yet) | `workspace-edges.ts` |
| `db/console/src/schema/tables/workspace-entity-observations.ts` | `workspace-entity-events.ts` |
| `db/console/src/schema/tables/workspace-observation-interpretations.ts` | `workspace-interpretations.ts` |
| `api/console/src/inngest/workflow/neural/observation-store.ts` | `event-store.ts` |
| `api/console/src/inngest/workflow/neural/observation-interpret.ts` | `event-interpret.ts` |

**TypeScript type/interface renames:**

| Old name | New name | Location |
|---|---|---|
| `WorkspaceNeuralObservation` | `WorkspaceEvent` | `workspace-events.ts` |
| `InsertWorkspaceNeuralObservation` | `InsertWorkspaceEvent` | `workspace-events.ts` |
| `WorkspaceNeuralEntity` | `WorkspaceEntity` | `workspace-entities.ts` |
| `InsertWorkspaceNeuralEntity` | `InsertWorkspaceEntity` | `workspace-entities.ts` |
| `WorkspaceObservationRelationship` | DROP | replaced by `WorkspaceEdge` |
| `InsertWorkspaceObservationRelationship` | DROP | replaced by `InsertWorkspaceEdge` |
| `WorkspaceEntityObservation` | `WorkspaceEntityEvent` | `workspace-entity-events.ts` |
| `InsertWorkspaceEntityObservation` | `InsertWorkspaceEntityEvent` | `workspace-entity-events.ts` |
| `WorkspaceObservationInterpretation` | `WorkspaceInterpretation` | `workspace-interpretations.ts` |
| `InsertWorkspaceObservationInterpretation` | `InsertWorkspaceInterpretation` | `workspace-interpretations.ts` |

**Barrel export files** (`tables/index.ts`, `schema/index.ts`, `db/console/src/index.ts`): All updated to export new names.

**Validation schema changes (`packages/console-validation/`):**
- `detectedRelationshipSchema.targetObservationId` → `targetEventId` (but this is an internal type only, not in API response)
- `ResolvedObservation` interface in `id-resolver.ts` → optionally rename to `ResolvedEvent`
- `ObservationVectorMetadata` in `neural.ts:24` — can be renamed to `EventVectorMetadata` but this is cosmetic

**API surface (do NOT change):** `V1GraphRequestSchema.id` is documented as "observation ID" but the value is just a nanoid string — no rename needed at the API contract level. The `/v1/graph`, `/v1/related`, `/v1/search`, `/v1/findsimilar` endpoint paths are unchanged.

### H.2 Clean Break Recommendation

Pre-production, no user data. **Recommend clean break over aliases.**

External API surface that would break (requires client update):
- `workspace.events.list` tRPC procedure path — will change to `workspace.ingestLog.list` (or keep pointing to new `workspace_events` = processed events, which is actually better UX)
- Any frontend code calling `workspace.events.list` needs updating (search for usages before breaking)
- MCP tools or integrations referencing `workspaceNeuralObservations` by name in prompts — update system prompts

---

## I. Phased Implementation Plan

Ordered by dependency (not by day). Each phase is independently deployable and verifiable.

### Phase 0: Resolve Naming Collision (prerequisite for everything)

**What:** Rename `workspace_events` (raw ingress log) → `workspace_ingest_log`.

**Files changed (8):**
1. `db/console/src/schema/tables/workspace-events.ts` → rename to `workspace-ingest-log.ts`, pgTable `"lightfast_workspace_ingest_log"`, export `workspaceIngestLog`
2. `db/console/src/schema/tables/index.ts` — update export
3. `db/console/src/schema/index.ts` — update export
4. `db/console/src/index.ts` — update export
5. `apps/console/src/app/api/gateway/ingress/route.ts` — import `workspaceIngestLog`
6. `apps/console/src/app/api/gateway/stream/route.ts` — import `workspaceIngestLog`
7. `api/console/src/router/org/workspace.ts` — import `workspaceIngestLog`; rename procedure to `workspace.ingestLog.list` or keep as `workspace.events.list` (choose)
8. `api/console/src/router/org/__tests__/notify-backfill.test.ts` — update mock

**Migration:** `pnpm db:generate` → renames `lightfast_workspace_events` → `lightfast_workspace_ingest_log`

**Verify:** `pnpm typecheck && pnpm check`

---

### Phase 1: Create `workspace_edges` Table

**What:** Create new entity↔entity edges table without dropping the old one yet.

**Files changed (4):**
1. Create `db/console/src/schema/tables/workspace-edges.ts` (full schema from Section C.3)
2. `db/console/src/schema/tables/index.ts` — add export
3. `db/console/src/schema/index.ts` — add export
4. `db/console/src/schema/relations.ts` — add `workspaceEdgesRelations` block

**Migration:** `pnpm db:generate` → creates `lightfast_workspace_edges`

**Verify:** `pnpm typecheck && pnpm check`. No consumers yet — this is purely additive.

---

### Phase 2: Update Edge Rules for Entity↔Entity Model

**What:** Update `edgeRules` on all 4 providers to use cross-entity-type matching (see Section E.3 corrected rules). The current rules match `commit → commit` across providers, which creates self-edges on the same entity. The new rules should match `commit → deployment`, `commit → issue`, etc.

**Files changed (4):**
1. `packages/console-providers/src/providers/github/index.ts` — update `edgeRules`
2. `packages/console-providers/src/providers/vercel/index.ts` — update `edgeRules`
3. `packages/console-providers/src/providers/sentry/index.ts` — update `edgeRules`
4. `packages/console-providers/src/providers/linear/index.ts` — update `edgeRules`

**Design rules for cross-entity-type edges:**
```typescript
// GitHub
{ refType: "commit", matchProvider: "vercel", matchRefType: "deployment", relationshipType: "deploys", confidence: 1.0 },
{ refType: "commit", selfLabel: "resolved_by", matchProvider: "sentry", matchRefType: "issue", relationshipType: "resolves", confidence: 1.0 },
{ refType: "pr", matchProvider: "linear", matchRefType: "pr", relationshipType: "tracked_in", confidence: 1.0 },
{ refType: "issue", selfLabel: "fixes", matchProvider: "*", matchRefType: "issue", relationshipType: "fixes", confidence: 1.0 },
{ refType: "branch", matchProvider: "*", matchRefType: "branch", relationshipType: "same_branch", confidence: 0.9 },

// Vercel
{ refType: "deployment", matchProvider: "github", matchRefType: "commit", relationshipType: "deploys", confidence: 1.0 },

// Sentry
{ refType: "issue", selfLabel: "linked", matchProvider: "linear", matchRefType: "issue", relationshipType: "triggers", confidence: 0.8 },
{ refType: "commit", selfLabel: "resolved_by", matchProvider: "github", matchRefType: "commit", relationshipType: "resolves", confidence: 1.0 },

// Linear
{ refType: "pr", matchProvider: "github", matchRefType: "pr", relationshipType: "tracked_in", confidence: 1.0 },
{ refType: "issue", selfLabel: "linked", matchProvider: "sentry", matchRefType: "issue", relationshipType: "triggers", confidence: 0.8 },
{ refType: "branch", matchProvider: "*", matchRefType: "branch", relationshipType: "same_branch", confidence: 0.9 },
```

**Verify:** `pnpm typecheck`. Edge rule changes don't affect DB — no migration needed.

---

### Phase 3: Update `edge-resolver.ts` to Write Entity↔Entity Edges

**What:** Change `resolveEdges` to find entity IDs for both events' refs, evaluate cross-entity-type rules, and write to `workspaceEdges`.

**Files changed (2):**
1. `api/console/src/inngest/workflow/neural/edge-resolver.ts` — rewrite core algorithm
2. `api/console/src/inngest/workflow/neural/observation-interpret.ts` — update import for `workspaceEntityObservations` → `workspaceEntityEvents` (column rename)

**Key algorithm changes:**
- Query `workspaceEntityEvents` (was `workspaceEntityObservations`) for co-occurring events
- Query `workspaceEvents` (was `workspaceNeuralObservations`) for co-event sources
- For each shared entity, enumerate cross-type ref pairs from both events
- Apply edge rules across entity type pairs (not within same entity type)
- Write to `workspaceEdges` with `sourceEntityId`, `targetEntityId`, `sourceEventId`

**At this phase:** Both `workspaceObservationRelationships` (old) and `workspaceEdges` (new) coexist. Graph traversal still uses the old table. New edges are being written to the new table but not yet consumed.

**Verify:** `pnpm typecheck && pnpm build:console`

---

### Phase 4: Update Graph Traversal (`graph.ts` + `related.ts`)

**What:** Switch BFS traversal to use `workspaceEdges` (entity↔entity) instead of `workspaceObservationRelationships`.

**Files changed (2):**
1. `apps/console/src/lib/v1/graph.ts` — rewrite BFS (lines 63-183)
2. `apps/console/src/lib/v1/related.ts` — rewrite edge fetch (lines 55-153)

Both files use new imports: `workspaceEvents`, `workspaceEdges`, `workspaceEntityEvents`, `workspaceEntities`.

**Verify:** Manual test — send test webhooks, verify `/v1/graph` returns correct entity-mediated graph. `pnpm typecheck`.

---

### Phase 5: Drop `workspace_observation_relationships`

**What:** Remove the old obs-to-obs edge table after confirming graph traversal works.

**Files changed:**
1. `db/console/src/schema/tables/workspace-observation-relationships.ts` — DELETE file
2. `db/console/src/schema/tables/index.ts` — remove export
3. `db/console/src/schema/index.ts` — remove export and `workspaceObservationRelationshipsRelations`
4. `db/console/src/schema/relations.ts` — remove `workspaceObservationRelationshipsRelations` block
5. `packages/console-validation/src/schemas/neural.ts` — remove `detectedRelationshipSchema.targetObservationId` if it referenced old table shape

**Migration:** `pnpm db:generate` → drops `lightfast_workspace_observation_relationships`

**Verify:** `pnpm typecheck && pnpm check`. Grep for `workspaceObservationRelationships` — should be zero matches.

---

### Phase 6: Table Renames (Mechanical)

**What:** Rename the 4 remaining tables. These can all be done in a single migration.

**Order within this phase:**
1. `workspace_neural_observations` → `workspace_events`
2. `workspace_neural_entities` → `workspace_entities`
3. `workspace_entity_observations` → `workspace_entity_events` (column: `observation_id` → `event_id`)
4. `workspace_observation_interpretations` → `workspace_interpretations` (column: `observation_id` → `event_id`)

**Schema files to rename:**
- `workspace-neural-observations.ts` → `workspace-events.ts` (export: `workspaceEvents`, pgTable: `lightfast_workspace_events`)
- `workspace-neural-entities.ts` → `workspace-entities.ts`
- `workspace-entity-observations.ts` → `workspace-entity-events.ts`
- `workspace-observation-interpretations.ts` → `workspace-interpretations.ts`

**Migration:** One migration covering all 4 renames + 2 column renames.

**Consumer updates (mechanical import swaps across all files):** All files from Section F that use these tables need their imports updated. This is a find-and-replace of TypeScript symbol names.

**Verify:** `pnpm typecheck && pnpm check && pnpm build:console`

---

### Phase 7: Inngest Event + Function ID Renames

**What:** Rename Inngest events and function IDs.

**Files changed:**
1. `api/console/src/inngest/client/client.ts` — replace 3 event schema keys
2. `api/console/src/inngest/workflow/neural/observation-store.ts` → rename to `event-store.ts`
   - Function id: `"apps-console/event.store"`
   - Trigger: `"apps-console/event.capture"`
   - Export: `eventStore`
   - `onFailure` listens to `"apps-console/event.capture"`
3. `api/console/src/inngest/workflow/neural/observation-interpret.ts` → rename to `event-interpret.ts`
   - Function id: `"apps-console/event.interpret"`
   - Trigger: `"apps-console/event.stored"`
   - Export: `eventInterpret`
4. `api/console/src/inngest/workflow/neural/index.ts` — update exports
5. `api/console/src/inngest/index.ts` — update imports + registrations
6. `apps/console/src/app/api/gateway/ingress/_lib/notify.ts` — update event name
7. `api/console/src/inngest/workflow/notifications/dispatch.ts` — update trigger event name

**No DB migration needed** — Inngest function IDs are just strings.

**Verify:** `pnpm typecheck && pnpm build:console`. Test webhook through relay → verify both Inngest functions fire under new event names.

---

## J. File Change List

### New Files
| File | Purpose |
|---|---|
| `db/console/src/schema/tables/workspace-edges.ts` | Entity↔entity edges schema |

### Deleted Files
| File | Replaced By |
|---|---|
| `db/console/src/schema/tables/workspace-observation-relationships.ts` | `workspace-edges.ts` |

### Renamed Files (with changes)
| Old File | New File | Changes |
|---|---|---|
| `workspace-events.ts` | `workspace-ingest-log.ts` | Export: `workspaceIngestLog`, pgTable: `lightfast_workspace_ingest_log` |
| `workspace-neural-observations.ts` | `workspace-events.ts` | Export: `workspaceEvents`, pgTable: `lightfast_workspace_events`, index prefix `obs_*` → `event_*` |
| `workspace-neural-entities.ts` | `workspace-entities.ts` | Export: `workspaceEntities`, pgTable: `lightfast_workspace_entities` |
| `workspace-entity-observations.ts` | `workspace-entity-events.ts` | Export: `workspaceEntityEvents`, pgTable: `lightfast_workspace_entity_events`, column `observation_id` → `event_id`, index prefix `eo_*` → `ee_*` |
| `workspace-observation-interpretations.ts` | `workspace-interpretations.ts` | Export: `workspaceInterpretations`, pgTable: `lightfast_workspace_interpretations`, column `observation_id` → `event_id` |
| `observation-store.ts` | `event-store.ts` | Function id, trigger event, export rename |
| `observation-interpret.ts` | `event-interpret.ts` | Function id, trigger event, export rename; `resolve-edges` step writes to `workspaceEdges` |
| `edge-resolver.ts` | `edge-resolver.ts` | Core algorithm: entity↔entity edges, writes to `workspaceEdges` |

### Modified Files (significant changes)
| File | Changes |
|---|---|
| `apps/console/src/lib/v1/graph.ts` | BFS rewrite: entity-mediated traversal |
| `apps/console/src/lib/v1/related.ts` | Edge fetch rewrite: entity-mediated |
| `api/console/src/inngest/client/client.ts` | Replace 3 event schemas |
| `apps/console/src/app/api/gateway/ingress/_lib/notify.ts` | Event name update |
| `api/console/src/inngest/workflow/notifications/dispatch.ts` | Trigger event rename |
| GitHub/Vercel/Sentry/Linear provider `index.ts` | Edge rules update for cross-entity-type |

### Modified Files (mechanical renames only)
`four-path-search.ts`, `entity-search.ts`, `id-resolver.ts`, `findsimilar.ts`, `db/console/src/schema/relations.ts`, `db/console/src/schema/tables/index.ts`, `db/console/src/schema/index.ts`, `db/console/src/index.ts`, `api/console/src/inngest/workflow/neural/index.ts`, `api/console/src/inngest/index.ts`

---

## Open Questions

1. **`workspace.events.list` tRPC rename.** The tRPC procedure currently queries `workspaceIngestLog` (raw webhook payloads). After Phase 6, `workspaceEvents` = processed pipeline events. Should `workspace.events.list` be updated to query the processed events instead? This would be a UX improvement (show filtered, significant events rather than all raw webhooks) but is a semantic change for any frontend using this procedure. Recommend: update `workspace.events.list` to query `workspaceEvents` (processed) in Phase 6.

2. **`EntityCategory` Zod schema.** Currently `z.enum` (closed). If `entity_type` should be an open string, `entityCategorySchema` should become `z.string()`. The column is already `varchar(50)` — only the Zod validation is the constraint. Consider converting to `z.string()` with a `z.enum` for the known values as a named constant (runtime check, not schema enforcement).

3. **Edge rules cross-entity-type algorithm in `edge-resolver.ts`.** The current algorithm finds co-occurring observations that share the same entity. For entity↔entity edges, the algorithm needs to match refs of DIFFERENT types from the two co-occurring events (e.g., GitHub's `commit` ref vs Vercel's `deployment` ref). This requires enumerating cross-product ref pairs across the two events, not just matching on shared entity type. The current `resolve-edges` code must be rewritten accordingly.

4. **Bidirectional edges.** When GitHub commit A deploys to Vercel deployment B, should the edge be `(entity:commit:A →[deploys]→ entity:deployment:B)` or also create a reverse edge? Currently the `uniqueEdgeIdx` only prevents exact duplicates. If consumers need "find all entities related to entity X regardless of direction", the BFS query already handles this with `OR (source_entity_id IN frontier OR target_entity_id IN frontier)`. No reverse edge needed.

5. **`source_event_id` population.** The `source_event_id` on `workspace_edges` is the event that caused the edge to be created. In the new entity-mediated model, the "current event" (the one being processed by `event-interpret`) is the provenance event. If the edge is later reinforced by a second event (same entity pair, same relationship type), the `onConflictDoNothing` means only the first event's ID is stored as provenance. This is correct — first-seen provenance is sufficient.

---

## Code References

| Item | File | Lines |
|---|---|---|
| `observation-store` function | `api/console/src/inngest/workflow/neural/observation-store.ts` | 107–533 |
| `observation-interpret` function | `api/console/src/inngest/workflow/neural/observation-interpret.ts` | 102–410 |
| `edge-resolver.ts` | `api/console/src/inngest/workflow/neural/edge-resolver.ts` | 28–191 |
| Current obs table schema | `db/console/src/schema/tables/workspace-neural-observations.ts` | 57–209 |
| Current entity table schema | `db/console/src/schema/tables/workspace-neural-entities.ts` | 25–163 |
| Current relationships table | `db/console/src/schema/tables/workspace-observation-relationships.ts` | 56–175 |
| Junction table (entity-observation) | `db/console/src/schema/tables/workspace-entity-observations.ts` | 21–70 |
| Interpretations table | `db/console/src/schema/tables/workspace-observation-interpretations.ts` | 22–102 |
| Existing ingress log (`workspaceEvents`) | `db/console/src/schema/tables/workspace-events.ts` | 25–125 |
| Graph BFS traversal | `apps/console/src/lib/v1/graph.ts` | 63–183 |
| Related events | `apps/console/src/lib/v1/related.ts` | 55–153 |
| Inngest event schemas | `api/console/src/inngest/client/client.ts` | 20–242 |
| GitHub edge rules | `packages/console-providers/src/providers/github/index.ts` | 343–395 |
| Vercel edge rules | `packages/console-providers/src/providers/vercel/index.ts` | 173–195 |
| Sentry edge rules | `packages/console-providers/src/providers/sentry/index.ts` | 193–209 |
| Linear edge rules | `packages/console-providers/src/providers/linear/index.ts` | 293–323 |
| `EntityCategory` schema | `packages/console-validation/src/schemas/entities.ts` | 9–26 |
| `PostTransformReference.type` enum | `packages/console-providers/src/post-transform-event.ts` | 18–35 |
| Ingress log SSE consumer | `apps/console/src/app/api/gateway/stream/route.ts` | 93–107 |
| Ingress log tRPC consumer | `api/console/src/router/org/workspace.ts` | 1225–1300 |

## Related Research

- Previous architecture doc (superseded): `thoughts/shared/research/2026-03-12-pipeline-restructure-architecture.md`
- Multi-layer event graph (over-engineered, L0 entity model is correct): `thoughts/shared/research/2026-03-10-multi-layer-event-graph-architecture.md`
- Pipeline simplification plan (completed): `thoughts/shared/plans/2026-03-12-pipeline-simplification.md`
