---
date: 2026-03-13T00:00:00+00:00
researcher: claude
git_commit: a077752af0bd9bdf0d98a756c665e4c0523d8ce5
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Observation pipeline architecture — current state, evaluation, and layered redesign"
tags: [research, codebase, pipeline, inngest, entities, graph, vector, observation, pinecone, drizzle]
status: complete
last_updated: 2026-03-13
---

# Research: Observation Pipeline Architecture

**Date**: 2026-03-13
**Git Commit**: `a077752af0bd9bdf0d98a756c665e4c0523d8ce5`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

Evaluate the current Inngest workflow + DB schema architecture against a proposed 4-layer redesign:

1. **Entity Layer** — standalone entities with lifecycle (a PR is ONE entity, not N events)
2. **Graph Layer** — entity↔entity edges, runs independently
3. **Vector Layer** — raw post-transform data embedded to Pinecone, independent of AI
4. **Observation Layer** — AI observers that rationalize entities into derived insights

---

## Current Architecture — Complete Map

### End-to-End Pipeline

```
Relay (webhook)
  → QStash
    → POST /api/gateway/ingress/route.ts  (Upstash Workflow, durable)
        Step 1: resolve-workspace     (orgWorkspaces lookup by clerkOrgId)
        Step 2: transform-store-and-fan-out
            a. transformEnvelope()        → PostTransformEvent | null
            b. sanitizePostTransformEvent()
            c. db.insert(workspaceIngestLog)  ← raw log, monotonic BIGINT cursor for SSE
            d. Promise.all([
                 publishInngestNotification()  → Inngest: apps-console/event.capture
                 publishEventNotification()    → Upstash Realtime: org-{orgId} channel
               ])
```

### Inngest: Fast Path (`event-store.ts`)

Triggered by `apps-console/event.capture`. Completes in <2s.

```
Steps:
  0. create-job                  → workspaceWorkflowRuns (job tracking)
  1. check-duplicate             → workspaceEvents WHERE sourceId matches
  2. check-event-allowed         → workspaceIntegrations WHERE providerResourceId matches
  3. evaluate-significance       → rule-based scorer (threshold=40, 0-100 scale)
  4. extract-entities            → regex (text) + structured (references[])
  5. store-observation           → workspaceEvents INSERT
  6. upsert-entities-and-junctions → workspaceEntities UPSERT + workspaceEntityEvents INSERT
  7. emit-event-stored           → apps-console/event.stored (triggers slow path)
  8. complete-job-success        → workspaceWorkflowRuns (status = "completed")
```

### Inngest: Slow Path (`event-interpret.ts`)

Triggered by `apps-console/event.stored`. Takes 5-30s.

```
Steps:
  1. fetch-observation-and-workspace   → DB read (workspaceEvents + orgWorkspaces)
  2. classify-observation              → Claude Haiku (step.ai.wrap)
                                         → primaryCategory + secondaryCategories + topics
  3. generate-multi-view-embeddings    → embeddingProvider.embed([title, content, summary])
  4. upsert-multi-view-vectors         → Pinecone (3 vectors per event, layer="observations")
                                         vectorIds: obs_title_{baseId}, obs_content_{baseId}, obs_summary_{baseId}
  5. store-interpretation              → workspaceInterpretations INSERT
  6. resolve-edges                     → edge-resolver.ts → workspaceEdges INSERT
  7. emit-event-interpreted            → apps-console/event.interpreted
```

### Edge Resolution (`edge-resolver.ts`)

```
Algorithm:
  1. Filter entityRefs to structural types (commit, branch, pr, issue, deployment)
  2. Lookup entity IDs from workspaceEntities WHERE (category, key) match
  3. Find co-occurring events via workspaceEntityEvents junction (shared entities)
  4. Load ALL entity refs for co-occurring events
  5. Enumerate cross-entity-type pairs (our entities × their entities)
  6. Evaluate EdgeRule[] from PROVIDERS[source].edgeRules (+ co-event source rules)
  7. Deduplicate by (source, target, relationshipType), keep highest confidence
  8. INSERT workspaceEdges (onConflictDoNothing)
```

---

## DB Tables — Full Schema Map

### Core Pipeline Tables

| Table | Physical Name | Purpose | Key Fields |
|---|---|---|---|
| `workspaceIngestLog` | `lightfast_workspace_ingest_log` | Raw event log, SSE cursor | `id` BIGINT monotonic, `sourceEvent` JSONB, `deliveryId` |
| `workspaceEvents` | `lightfast_workspace_events` | Structured observation/fact | `sourceId`, `observationType`, `title`, `content`, `actor` JSONB, `sourceReferences` JSONB |
| `workspaceEntities` | `lightfast_workspace_entities` | Deduped named entities | `category` + `key` unique per workspace, `occurrenceCount`, `lastSeenAt` |
| `workspaceEntityEvents` | `lightfast_workspace_entity_events` | Entity↔Event junction | `entityId`, `eventId`, `refLabel` |
| `workspaceEdges` | `lightfast_workspace_edges` | Entity↔Entity directed edges | `sourceEntityId`, `targetEntityId`, `relationshipType`, `confidence`, `sourceEventId` (provenance, set null) |
| `workspaceInterpretations` | `lightfast_workspace_interpretations` | Versioned AI outputs | `eventId` FK, `version`, `primaryCategory`, `topics[]`, `embeddingTitleId`, `embeddingContentId`, `embeddingSummaryId` |
| `workspaceWorkflowRuns` | `lightfast_workspace_workflow_runs` | Inngest job tracking | `inngestRunId`, `status`, `input`, `output` |
| `workspaceKnowledgeDocuments` | `lightfast_workspace_knowledge_documents` | Multi-source docs (backfill) | `sourceType`, `sourceId`, `contentHash`, `chunkCount` |
| `workspaceKnowledgeVectorChunks` | `lightfast_workspace_knowledge_vector_chunks` | Doc→Pinecone chunk mapping | `docId`, `chunkIndex`, `contentHash` |

### Entity Categories (12 total)

**Structural** (from `references[]`, used for graph matching):
- `commit`, `branch`, `pr`, `issue`, `deployment`

**Semantic** (from text extraction, used for search enrichment):
- `engineer`, `project`, `endpoint`, `config`, `definition`, `service`, `reference`

### Pinecone Vector Layout (current)

Per event: **3 vectors** upserted under namespace `workspace.settings.embedding.namespaceName`:
- `obs_title_{baseId}` — title embedding, `view: "title"`
- `obs_content_{baseId}` — content embedding, `view: "content"`
- `obs_summary_{baseId}` — summary (title + first 1000 chars of content), `view: "summary"`

All carry `layer: "observations"` in metadata. `baseId` = `sourceId.replace(/[^a-zA-Z0-9]/g, "_")`.

### FK Relationship Graph

```
orgWorkspaces (tenant root)
  ├─ workspaceEvents (fact)
  │    ├─ workspaceInterpretations [many, cascaded]
  │    └─ workspaceEntityEvents [many, cascaded]
  │         └─ workspaceEntities [many→one, cascaded]
  │              └─ workspaceEdges (source + target, cascaded)
  │                   └─ workspaceEvents (sourceEventId, set-null on delete)
  ├─ workspaceIngestLog [many, cascaded]
  ├─ workspaceKnowledgeDocuments
  │    └─ workspaceKnowledgeVectorChunks
  └─ workspaceIntegrations
       └─ gwInstallations (OAuth layer)
```

---

## Architectural Evaluation

### Issue 1 — Entity Lifecycle: The `sourceId` Problem

**What exists**: The `sourceId` in `PostTransformEvent` includes the action suffix:
- `"pr:org/repo#123:opened"` — PR opened event
- `"pr:org/repo#123:merged"` — PR merged event

These produce **2 separate rows** in `workspaceEvents`. The `workspaceEntities` table correctly deduplicates to ONE entity `pr:#org/repo#123` (category=pr, key=`pr:org/repo#123`), but there's no explicit state machine — only `occurrenceCount` and `lastSeenAt`.

**The gap**: There is no `currentState` on the entity. You cannot query "show me all open PRs as entities." The entity record carries no lifecycle state; the state is only inferrable by joining back to the most recent event row.

**Impact**: The concept of "a PR is one thing that goes through states" exists at the `workspaceEntities` dedup level, but is not modeled as a first-class state machine. The entity has `occurrenceCount = 3` for a PR that was opened, marked ready-for-review, and merged — but not `currentState = "merged"`.

### Issue 2 — Graph Coupling: Edge Resolution in the Slow Path

**What exists**: `resolveEdges()` runs as **Step 7** inside `event-interpret.ts`, AFTER:
- LLM classification (step 3, 1-5s)
- Multi-view embedding generation (step 4, 1-10s)
- Pinecone vector upsert (step 5, 0.5-2s)
- Interpretation row insert (step 6)

**The gap**: Graph linking (a pure structural operation with no AI) is blocked by the entire AI pipeline. If the embedding provider is slow or LLM is rate-limited, entity edges are delayed or lost. The graph and vector operations are logically independent but run sequentially.

**Impact**: A new entity relationship (e.g., "commit X deploys deployment Y") may not exist in the graph for 10-30 seconds after ingest, even though it could be computed in <500ms. Also, a slow path failure (embedding timeout, LLM error) prevents edges from being created at all.

### Issue 3 — Vector Coupling: Embedding Tied to Classification

**What exists**: In `event-interpret.ts`, classification and embedding run in the same function. The classification result (step 3) feeds into `topics` stored in `workspaceInterpretations`, but crucially the **embeddings themselves** (step 4) do NOT use the classification output — they embed the raw `title`, `content`, and `summary` text.

**The gap**: The coupling is artificial. Classification and embedding could run in parallel or in separate functions. More importantly, the vector layer is operating on **event-level content** (each event gets 3 vectors) rather than **entity-level content** (the PR entity has one canonical representation that updates as its state changes).

**Impact**: When a PR goes from "open" to "merged", two entirely separate sets of 3 Pinecone vectors are created (`obs_*_pr:org/repo#123:opened` and `obs_*_pr:org/repo#123:merged`). There is no canonical entity vector that a semantic query "what is the status of PR #123" would return the current answer from.

### Issue 4 — Observation Conflation: Facts vs Insights in the Same Table

**What exists**: `workspaceEvents` serves two roles simultaneously:
1. **Immutable fact log** — "this event happened at this time from this source"
2. **Scaffold for AI observations** — has `observationType`, `title`, `content` which are the semantic inputs to the interpretation

`workspaceInterpretations` is the AI output layer (linked 1:1 to `workspaceEvents` by `eventId`). The design correctly separates mutable AI outputs from immutable facts. However, "observations" in the current naming are event-scoped — there is no concept of a workspace-level observation like "Sarah has been the primary auth fixer for 3 weeks."

**The gap**: The observation layer can only create per-event interpretations. There is no table for synthesized, multi-entity, time-windowed observations — the kind of insight that an "AI observer" would generate by looking at patterns across many entities.

### Issue 5 — `workspaceIngestLog` vs `workspaceEvents` Overlap

**What exists**:
- `workspaceIngestLog`: Stores full `PostTransformEvent` as a single JSONB blob (`sourceEvent`), monotonic BIGINT ID for SSE catch-up
- `workspaceEvents`: Stores the same data in structured columns (`title`, `content`, `source`, `sourceType`, `actor` JSONB, `sourceReferences` JSONB, `metadata` JSONB)

**Purpose split** (correct): The ingest log is the raw append-only log optimized for SSE cursor queries. `workspaceEvents` is the queryable, indexed representation. This is a valid CQRS pattern — the ingest log is the write side, events is the read side.

**Minor gap**: The ingest log lacks a link to the `workspaceEvents` row that was created from it. There's no FK `workspaceEvents.ingestLogId`. This means you can't easily trace "which Inngest job processed this ingest log entry" or vice versa.

---

## Proposed Redesign: 4 Layers with Hard Separation

### Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER 0: ENTITY STORE                                                   │
│                                                                         │
│  Ingress → workspaceIngestLog (raw log, SSE cursor, unchanged)          │
│         → entity.ingest (Inngest)                                       │
│              ├── workspaceSourceEntities  (lifecycle state machine)     │
│              └── workspaceEntityTransitions (state history)             │
│         → workspaceExtractedEntities (semantic text entities, renamed)  │
│                                                                         │
│ Trigger emitted: entity.stored                                          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ entity.stored fans out to 3 independent workflows
                   ┌────────────┼───────────────────┐
                   ▼            ▼                   ▼
┌─────────────┐ ┌──────────────┐ ┌────────────────────────────────────────┐
│  LAYER 1    │ │   LAYER 2    │ │            LAYER 3                     │
│  GRAPH      │ │   VECTOR     │ │          OBSERVATION                   │
│             │ │              │ │                                        │
│ entity.graph│ │ entity.embed │ │  entity.observe (time-based or event) │
│             │ │              │ │                                        │
│ workspaceEdges│ │ Pinecone   │ │  workspaceObservations                │
│ (unchanged) │ │ layer=entity │ │  (AI-synthesized insights)            │
│             │ │ 1 vec/entity │ │  Pinecone layer=observations          │
│ Pure SQL    │ │ no AI needed │ │                                        │
│ no AI       │ │              │ │                                        │
└─────────────┘ └──────────────┘ └────────────────────────────────────────┘
```

---

### Layer 0: Entity Store

#### New Table: `workspaceSourceEntities`

Replaces the current `workspaceEvents` as the primary entity table. A source entity is the canonical domain object (a PR, a deployment, an issue) that persists across lifecycle events.

```typescript
// workspaceSourceEntities — lifecycle entity model
{
  id:             BIGINT (PK, identity)
  externalId:     varchar(21) nanoid
  workspaceId:    varchar(191) FK → orgWorkspaces

  // ── ENTITY IDENTITY ─────────────────────────────────────────────
  source:         varchar(50)   // "github" | "vercel" | "linear" | "sentry"
  entityType:     varchar(50)   // "pr" | "issue" | "deployment" | "release" | "commit" | "branch" | "discussion"
  domainEntityId: varchar(500)  // stable provider ID WITHOUT action suffix
                                // e.g. "org/repo#123" (NOT "pr:org/repo#123:merged")
                                // e.g. "ENG-42"
                                // e.g. "dpl_abc123"

  // ── LIFECYCLE ───────────────────────────────────────────────────
  currentState:   varchar(50)   // "open" | "merged" | "closed" | "draft" | "in_progress" | "done" | etc.
  stateChangedAt: timestamp     // when currentState was last updated
  firstSeenAt:    timestamp     // when this entity was first observed
  lastSeenAt:     timestamp     // most recent event touching this entity

  // ── CONTENT ─────────────────────────────────────────────────────
  title:          text          // current canonical title
  url:            text          // canonical URL
  actor:          jsonb         // last actor who changed state
  metadata:       jsonb         // rich provider-specific (labels, assignees, etc.)

  // ── COUNTS ──────────────────────────────────────────────────────
  eventCount:     integer       // how many ingest events touched this entity
}

// Indexes:
// UNIQUE (workspaceId, source, entityType, domainEntityId)  ← dedup key
// INDEX (workspaceId, entityType, currentState)             ← "all open PRs"
// INDEX (workspaceId, source, lastSeenAt)                   ← recent activity
// INDEX (workspaceId, stateChangedAt)                       ← state change timeline
```

#### New Table: `workspaceEntityTransitions`

The immutable lifecycle history of each entity. One row per state change.

```typescript
// workspaceEntityTransitions — entity state history
{
  id:           BIGINT (PK, identity)
  entityId:     BIGINT FK → workspaceSourceEntities (cascade)
  workspaceId:  varchar(191)
  ingestLogId:  BIGINT FK → workspaceIngestLog (set null) ← provenance
  fromState:    varchar(50) nullable                       ← null for initial creation
  toState:      varchar(50) not null
  actor:        jsonb nullable
  occurredAt:   timestamp not null                        ← source-system time
  metadata:     jsonb                                     ← what changed (diff)
  createdAt:    timestamp
}

// Indexes:
// INDEX (entityId, occurredAt)   ← "history of entity X"
// INDEX (workspaceId, occurredAt) ← "all changes in workspace this week"
```

#### Revised Table: `workspaceExtractedEntities` (rename of `workspaceEntities`)

Semantic text entities (engineer mentions, endpoint patterns, config vars) remain as before. The name change signals these are derived by pattern extraction, not domain objects.

The key distinction:
- `workspaceSourceEntities` = domain objects with identity and lifecycle (PRs, issues, deployments)
- `workspaceExtractedEntities` = semantic fragments extracted from text content (@sarah, `POST /api/users`, `DATABASE_URL`)

No schema change needed — just rename + add junction to source entities.

#### `domainEntityId` Extraction Per Provider

This is the critical transformation: stripping the action suffix from `PostTransformEvent.sourceId`.

```
GitHub PR:
  sourceId:      "pr:org/repo#123:merged"
  entityType:    "pr"
  domainEntityId: "org/repo#123"
  currentState:  "merged"

GitHub Issue:
  sourceId:      "issue:org/repo#7:opened"
  entityType:    "issue"
  domainEntityId: "org/repo#7"
  currentState:  "open"

GitHub Push:
  sourceId:      "push:org/repo:abc123def"
  entityType:    "commit"
  domainEntityId: "org/repo:abc123def"
  currentState:  "pushed"  (final state — commits don't change)

Vercel Deployment:
  sourceId:      "deployment:dpl_abc123"
  entityType:    "deployment"
  domainEntityId: "dpl_abc123"
  currentState:  "succeeded"  (from the event)

Linear Issue:
  sourceId:      "linear-issue:ENG:ENG-42:create"
  entityType:    "Issue"
  domainEntityId: "ENG-42"
  currentState:  "created"  → then updated via subsequent events

Sentry Issue:
  sourceId:      "sentry-issue:my-project:PROJ-123:created"
  entityType:    "issue"
  domainEntityId: "PROJ-123"
  currentState:  "unresolved"  → "resolved" → "unresolved" (regression)
```

A `extractDomainEntityId(source, entityType, sourceId)` function per provider handles this extraction. For entities with no lifecycle (commits, pushes), the `domainEntityId` = full `sourceId` and `currentState` is terminal.

#### State Machine per Entity Type

| Entity Type | Valid States |
|---|---|
| `pr` (GitHub) | `draft` → `open` → `merged` \| `closed` \| `draft` |
| `issue` (GitHub) | `open` → `closed` → `open` (reopen) |
| `issue` (Linear) | `created` → `in_progress` → `in_review` → `done` \| `cancelled` |
| `issue` (Sentry) | `unresolved` → `resolved` → `unresolved` (regression) |
| `deployment` (Vercel) | `created` → `building` → `succeeded` \| `failed` \| `cancelled` \| `ready` |
| `release` (GitHub) | `created` → `published` |
| `commit` | `pushed` (terminal) |
| `branch` | `created` → `deleted` (terminal) |
| `discussion` | `opened` → `answered` (terminal for significant events) |

---

### Layer 1: Graph Layer

#### `workspaceEdges` — Keep As-Is, Run Independently

The current schema is already well-designed for an adjacency list:

```sql
-- Already exists and is correct:
INDEX (workspaceId, sourceEntityId)  ← forward traversal
INDEX (workspaceId, targetEntityId)  ← reverse traversal
UNIQUE (workspaceId, sourceEntityId, targetEntityId, relationshipType)
```

**PlanetScale Postgres supports recursive CTEs natively** (PostgreSQL 17/18, `CYCLE` clause from Postgres 14+). No extensions needed.

#### BFS Traversal Query (N-hop, workspace-partitioned)

```sql
WITH RECURSIVE graph_bfs AS (
  -- Anchor: direct edges from starting entity
  SELECT
    target_entity_id   AS node_id,
    1                  AS depth,
    ARRAY[source_entity_id, target_entity_id] AS visited,
    relationship_type
  FROM lightfast_workspace_edges
  WHERE workspace_id = $1
    AND source_entity_id = $2

  UNION ALL

  -- Recursive: expand one hop
  SELECT
    e.target_entity_id,
    g.depth + 1,
    g.visited || e.target_entity_id,
    e.relationship_type
  FROM graph_bfs g
  JOIN lightfast_workspace_edges e
    ON  e.workspace_id      = $1
    AND e.source_entity_id  = g.node_id
  WHERE g.depth < $3                              -- depth cap (recommend ≤ 6)
    AND NOT (e.target_entity_id = ANY(g.visited)) -- cycle guard
)
CYCLE node_id SET is_cycle USING cycle_path       -- Postgres 14+ syntax
SELECT DISTINCT node_id FROM graph_bfs WHERE NOT is_cycle;
```

**Key insight**: The `edge_source_idx` and `edge_target_idx` indexes on `(workspaceId, sourceEntityId)` and `(workspaceId, targetEntityId)` already exist in `workspace-edges.ts:67-74`. No schema change needed.

#### Independent Inngest Function: `entity.graph`

```typescript
// Triggered by apps-console/entity.stored (not event.stored)
// Replaces: resolveEdges() called from inside event-interpret.ts
export const entityGraph = inngest.createFunction(
  { id: "apps-console/entity.graph", retries: 3, timeouts: { finish: "2m" } },
  { event: "apps-console/entity.stored" },
  async ({ event }) => {
    // Same edge resolution algorithm as current edge-resolver.ts
    // but runs independently of classification and embedding
    return resolveEdges(event.data.workspaceId, event.data.entityId, event.data.source, event.data.entityRefs);
  }
);
```

---

### Layer 2: Vector Layer

#### Embed the Entity, Not the Event

**Current**: 3 vectors per event occurrence (`obs_title_*`, `obs_content_*`, `obs_summary_*`).

**Proposed**: 1-3 vectors per **source entity** (updated on state change). Vector ID = `entity_{externalId}_{view}`.

When a PR transitions from `open` to `merged`, the vector is UPSERTED (overwritten) with the merged-state content. This gives a canonical "current state" embedding per entity.

**Optional**: Also keep event-level temporal vectors for "what happened last week" queries. These would be under a separate namespace or with `layer: "event_log"` metadata.

```typescript
// Layer 2: Independent Inngest function
export const entityEmbed = inngest.createFunction(
  { id: "apps-console/entity.embed", retries: 3, timeouts: { finish: "5m" } },
  { event: "apps-console/entity.stored" },
  async ({ event, step }) => {
    const { entityId, workspaceId } = event.data;

    // Embed the raw entity content — NO LLM classification needed
    const entity = await step.run("fetch-entity", () => db.query.workspaceSourceEntities.findFirst({...}));

    const embeddings = await step.run("embed-entity", async () => {
      const provider = createEmbeddingProviderForWorkspace(workspace, { inputType: "search_document" });
      return provider.embed([entity.title, `${entity.title}\n${buildEntityDescription(entity)}`]);
    });

    await step.run("upsert-to-pinecone", async () => {
      await consolePineconeClient.upsertVectors(indexName, {
        ids: [`entity_${entity.externalId}_title`, `entity_${entity.externalId}_content`],
        vectors: [embeddings[0], embeddings[1]],
        metadata: [
          {
            layer: "entities",           // ← distinguishes from observations
            entityType: entity.entityType,
            source: entity.source,
            domainEntityId: entity.domainEntityId,
            currentState: entity.currentState,
            occurredAt: entity.stateChangedAt,
            title: entity.title,
            snippet: entity.title,
            view: "title",
          },
          {
            layer: "entities",
            entityType: entity.entityType,
            source: entity.source,
            domainEntityId: entity.domainEntityId,
            currentState: entity.currentState,
            occurredAt: entity.stateChangedAt,
            title: entity.title,
            snippet: buildEntityDescription(entity).slice(0, 500),
            view: "content",
          }
        ],
      }, namespace);
    });
  }
);
```

**Semantic search query** ("what happened to auth"):
```typescript
await pinecone.query({
  namespace,
  vector: await embed("what happened to auth"),
  topK: 20,
  filter: { layer: "entities" },  // only entity vectors
});
```

---

### Layer 3: Observation Layer

#### New Table: `workspaceObservations`

AI-synthesized insights that span multiple entities and time windows. NOT coupled to a single event.

```typescript
// workspaceObservations — AI-derived insights
{
  id:            BIGINT (PK, identity)
  externalId:    varchar(21) nanoid
  workspaceId:   varchar(191) FK → orgWorkspaces

  // ── OBSERVATION IDENTITY ─────────────────────────────────────────
  observationType: varchar(100)   // "pattern" | "anomaly" | "milestone" | "risk" | "handoff"
  title:           text           // human-readable headline
  summary:         text           // AI-generated narrative
  timeWindowStart: timestamp      // observation covers this time range
  timeWindowEnd:   timestamp

  // ── ENTITY REFERENCES ────────────────────────────────────────────
  entityIds:       jsonb          // array of workspaceSourceEntities.externalId values
  topics:          jsonb          // string[] of themes

  // ── AI PROVENANCE ─────────────────────────────────────────────────
  confidence:      real
  modelVersion:    varchar(100)
  embeddingId:     varchar(191)   // Pinecone vector ID (layer="observations")
  processedAt:     timestamp

  createdAt:       timestamp
}

// Indexes:
// INDEX (workspaceId, timeWindowEnd DESC)  ← recent observations
// INDEX (workspaceId, observationType)     ← filter by type
// GIN index on entityIds for containment queries
```

#### Observation Triggers

The observation layer runs on a schedule or in response to entity graph changes — NOT on every ingest:

```
Trigger options:
  a. Time-based: every 15 minutes, look at the last 24h of entity transitions
  b. Graph-event-based: when entity degree > N (cluster forms)
  c. Significance-based: when total significanceScore in window exceeds threshold
  d. Manual: user asks "what happened this week" → triggers observer

Observer types (examples):
  - PatternObserver: "Sarah has opened 3 PRs touching auth in 2 days"
  - AnomalyObserver: "Deployment failure rate doubled in the last 6 hours"
  - MilestoneObserver: "ENG-42 went from created→done in 48h (fastest this sprint)"
  - HandoffObserver: "PR #456 was reviewed by 4 people before merge (unusual)"
```

These are the "observational entities" the user describes — derived insights that emerge from looking at the entity graph holistically.

---

## Inngest Event Chain (Redesigned)

```
Ingest:    apps-console/entity.ingest
             ↓ emits
Store:     apps-console/entity.stored
             ↓ fans out to 3 independent functions
Graph:     apps-console/entity.graph     (no AI, pure SQL)
Embed:     apps-console/entity.embed     (no classification, raw embedding)
Interpret: apps-console/entity.observe   (AI observer, time-windowed, scheduled)
```

Replace current event names:
| Old | New |
|---|---|
| `apps-console/event.capture` | `apps-console/entity.ingest` |
| `apps-console/event.stored` | `apps-console/entity.stored` |
| `apps-console/event.interpreted` | `apps-console/entity.observed` |
| (new) | `apps-console/entity.graph` trigger |
| (new) | `apps-console/entity.embed` trigger |

---

## Table Migration Map

| Current Table | New Table | Action |
|---|---|---|
| `workspaceIngestLog` | `workspaceIngestLog` | KEEP unchanged |
| `workspaceEvents` | `workspaceSourceEntities` | REDESIGN (entity lifecycle model) |
| `workspaceEntities` | `workspaceExtractedEntities` | RENAME only |
| `workspaceEntityEvents` | `workspaceExtractedEntityLinks` | RENAME + update FKs to new tables |
| `workspaceEdges` | `workspaceEntityEdges` | RENAME only |
| `workspaceInterpretations` | dissolved | REMOVE — replaced by Layer 2 (Pinecone) + Layer 3 (workspaceObservations) |
| (new) | `workspaceEntityTransitions` | CREATE |
| (new) | `workspaceObservations` | CREATE |
| `workspaceWorkflowRuns` | `workspaceWorkflowRuns` | KEEP unchanged |
| `workspaceKnowledgeDocuments` | `workspaceKnowledgeDocuments` | KEEP unchanged |
| `workspaceKnowledgeVectorChunks` | `workspaceKnowledgeVectorChunks` | KEEP unchanged |

---

## Architecture Principles Restored

The redesign enforces hard layer boundaries:

| Concern | Layer | Tables | AI? | Blocking? |
|---|---|---|---|---|
| Raw log / SSE cursor | 0 (ingest) | `workspaceIngestLog` | No | Yes (synchronous) |
| Entity lifecycle | 0 (entity store) | `workspaceSourceEntities`, `workspaceEntityTransitions` | No | Fast (<2s) |
| Graph relationships | 1 | `workspaceEntityEdges` | No | Independent |
| Semantic search index | 2 | Pinecone (`layer=entities`) | No (embedding only) | Independent |
| AI synthesis/insight | 3 | `workspaceObservations`, Pinecone (`layer=observations`) | Yes | Async, scheduled |

**Each layer can fail, retry, or be disabled without affecting the others.** An embedding API outage does not prevent entity storage or graph resolution. An LLM API outage does not prevent vectors from being indexed.

---

## Evaluation of Current vs Proposed

| Dimension | Current | Proposed |
|---|---|---|
| Entity lifecycle | `occurrenceCount` only, no `currentState` | Explicit state machine per entity type |
| "All open PRs" query | Requires joining to most recent `workspaceEvents` row | Simple: `WHERE entityType='pr' AND currentState='open'` |
| PR #123 vector | 3 vectors per lifecycle event (6 total for opened+merged) | 2 vectors per entity, upserted on state change |
| Graph resolution speed | Blocked by LLM + embedding (~15s) | Independent, runs in <1s after entity.stored |
| Observation granularity | Per-event (1:1 with workspaceEvents) | Per-pattern (synthesized across entities) |
| Semantic search target | Event text (transient) | Entity state (canonical) |
| Layer coupling | eventStore → eventInterpret (sequential, tight) | entity.stored → 3 parallel independent workflows |
| Observation insights | Not possible — per-event only | workspaceObservations with time windows |
| PlanetScale graph | Co-occurrence detection only | Full BFS traversal via recursive CTE (no extensions needed) |

---

## Code References

### Current Architecture
- `apps/console/src/app/api/gateway/ingress/route.ts` — ingress endpoint (Upstash Workflow)
- `apps/console/src/app/api/gateway/ingress/_lib/notify.ts` — Inngest + Upstash Realtime fan-out
- `api/console/src/inngest/workflow/neural/event-store.ts` — fast path (8 steps)
- `api/console/src/inngest/workflow/neural/event-interpret.ts` — slow path (8 steps)
- `api/console/src/inngest/workflow/neural/edge-resolver.ts` — graph resolution (co-occurrence)
- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts` — regex + reference extraction
- `api/console/src/inngest/workflow/neural/scoring.ts` — significance scorer (rule-based, threshold=40)
- `db/console/src/schema/tables/workspace-events.ts` — fact table
- `db/console/src/schema/tables/workspace-entities.ts` — entity dedup table
- `db/console/src/schema/tables/workspace-entity-events.ts` — junction table
- `db/console/src/schema/tables/workspace-edges.ts` — graph adjacency list (already well-designed)
- `db/console/src/schema/tables/workspace-interpretations.ts` — AI output table
- `db/console/src/schema/tables/workspace-ingest-log.ts` — raw event log (SSE cursor)
- `db/console/src/schema/relations.ts` — Drizzle relation definitions
- `packages/console-providers/src/post-transform-event.ts` — PostTransformEvent type
- `packages/console-providers/src/registry.ts` — PROVIDERS, EVENT_REGISTRY, EdgeRule dispatch
- `packages/console-validation/src/schemas/entities.ts` — EntityCategory, ExtractedEntity
- `packages/console-validation/src/schemas/neural.ts` — ObservationVectorMetadata, MultiViewEmbeddingResult

---

## Open Questions for Implementation

1. **`domainEntityId` extraction**: Each provider needs a function `extractDomainEntityId(sourceId, entityType) → string`. This lives in `@repo/console-providers` per-provider. Should this be added to `ProviderDefinition` as a required field?

2. **State machine authority**: Where is the valid state transition table defined? Option A: in `@repo/console-providers` per provider (alongside `edgeRules`). Option B: in the new entity store Inngest function. Recommendation: Option A, co-locate with provider definition.

3. **`workspaceKnowledgeDocuments` position**: Documents (from backfill — GitHub issues, Linear tickets) also represent "source entities." Should they merge into `workspaceSourceEntities` or remain separate? Current separation is cleaner (documents are long-form content optimized for chunking; source entities are events optimized for state).

4. **Temporal event vectors**: Should we keep event-level Pinecone vectors (`layer: "event_log"`) for time-range queries ("what happened last week"), separate from entity-level canonical vectors (`layer: "entities"`)? The current `obs_*` vectors serve this temporal search purpose. Keeping both adds Pinecone write cost but enables richer search.

5. **`workspaceInterpretations` migration**: Existing interpretation rows (embedding vector IDs) are referenced by the search system (`id-resolver.ts` pattern, though that file was deleted). The new entity embed function would create new entity-level vector IDs. Old `obs_*` IDs in Pinecone need a deprecation path.

6. **Observer scheduling**: What triggers the Layer 3 observer? Every 15 minutes is simple but may generate redundant observations. Event-count-based (after N entity changes) is more responsive but harder to implement. Recommendation: start with 15-minute schedule, scoped per workspace.

7. **Significance threshold**: Currently blocks events below score 40 from entering the pipeline entirely. In the new design, should all events create source entities (even low-significance ones like `chore: bump deps`), with significance only affecting the observation layer? Recommendation: yes — create the entity always, gate observation on significance.

---

## Related Research

- `thoughts/shared/research/2026-03-13-search-system-reset.md` — search system current state audit
- `thoughts/shared/plans/2026-03-13-search-system-reset.md` — search system implementation plan
- `thoughts/shared/plans/2026-03-10-backfill-provider-unification-v3r1.md` — gateway proxy + provider definition redesign
