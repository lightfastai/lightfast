---
date: "2026-03-12T22:00:00+08:00"
researcher: claude
git_commit: 6b6ad3bdad180b3ee11502881dcad4995ec97394
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Pipeline Restructure: Post-Simplification Architecture for Graph + Observation Pipelines"
tags: [research, architecture, observation-pipeline, graph-pipeline, fact-interpretation-separation, entity-mediated-matching, restructure]
status: complete
last_updated: "2026-03-12"
supersedes: "2026-03-10-multi-layer-event-graph-architecture.md (retains correct principles, discards over-engineering)"
---

# Research: Pipeline Restructure Architecture

**Date**: 2026-03-12T22:00:00+08:00
**Git Commit**: 6b6ad3bdad180b3ee11502881dcad4995ec97394
**Branch**: feat/backfill-depth-entitytypes-run-tracking
**Supersedes**: `2026-03-10-multi-layer-event-graph-architecture.md` — retains L0 entity model, fact/interpretation separation, and entity-mediated matching. Discards L1/L2 tiers, 3-service decomposition, and Fact Capture Hono app.

## Context

The pipeline simplification (`2026-03-12-pipeline-simplification.md`) deleted ~3,500 lines: clusters, actor reconciliation, LLM entity extraction workflow, actor profiles, temporal states, and operations metrics (6 tables dropped). What remains is a single 839-line Inngest function (`observation-capture.ts`) that mixes fact storage with AI interpretation, and a 495-line relationship detector that uses point-in-time JSONB scans instead of entity-mediated matching.

This document defines the restructure: what to build, why, and in what order. Scope is 2-3 days of work.

## Current State (Post-Simplification)

### Pipeline Shape

```
PostTransformEvent (from relay → QStash → console ingress)
  → observation-capture.ts (single Inngest function, 839 lines)
      ├── generate-replay-safe-ids
      ├── resolve-clerk-org-id
      ├── create-job + update-job-running
      ├── check-duplicate (sourceId dedup)
      ├── check-event-allowed (providerConfig.sync.events)
      ├── evaluate-significance (rule-based scoring, threshold=40)
      ├── fetch-context (workspace settings)
      ├── classify-observation (Claude Haiku LLM)
      ├── [parallel] generate-multi-view-embeddings (3 vectors) + extract-entities (regex)
      ├── upsert-multi-view-vectors (Pinecone batch)
      ├── store-observation (DB insert + entity upsert)     ← facts + interpretations mixed
      ├── detect-relationships (point-in-time JSONB scan)   ← misses out-of-order events
      ├── emit-events (observation.captured)
      └── complete-job-success
```

### Known Problems

**1. Facts and interpretations are coupled on the observation row.**

`workspace_neural_observations` stores both immutable facts (`source`, `sourceId`, `title`, `content`, `actor`, `occurredAt`, `sourceReferences`, `metadata`) and AI-derived interpretations (`topics`, `significanceScore`) in the same row. Violates SPEC principle: "Events are facts. Interpretations layer on top. History is never rewritten." Reprocessing interpretations (new model, changed prompts) requires mutating the fact row.

Columns that are interpretations on the observation row today:
- `topics` (JSONB string[]) — from LLM classification + keyword extraction
- `significance_score` (real) — from rule-based scoring (arguably a fact, but the scoring rules change)
- `observation_type` (varchar) — derived via `deriveObservationType()`, stable per provider

**2. Relationship detection is point-in-time and misses out-of-order events.**

`relationship-detection.ts` scans existing observation rows for shared reference keys via JSONB containment queries. If a GitHub push arrives before the Vercel deployment that references the same commit, the relationship is never created (no retroactive edge creation when the deployment arrives later). The detection code does not use `workspace_neural_entities` at all — it queries `sourceReferences` JSONB directly.

Five hardcoded detection passes:
1. Commit SHA → `same_commit` / `deploys` / `resolves`
2. Branch name → `same_branch`
3. Issue ID (fixes labels) → `fixes`
4. Issue ID (generic) → `references`
5. PR ID → `tracked_in`
6. Sentry→Linear → `triggers`

Provider-specific logic (`determineCommitRelationType` checks for `sentry` and `vercel` by name) means every new provider requires editing this file.

**3. Entity table lacks a junction to observations.**

`workspace_neural_entities` has a single `source_observation_id` FK pointing to the first observation where the entity was discovered. Subsequent observations that mention the same entity only increment `occurrence_count` — no record of which observations mention which entities. This makes entity-mediated relationship detection impossible and prevents "show me all observations for commit abc123" queries.

**4. Entity categories are semantic, not structural.**

Current `EntityCategory` values: `engineer`, `project`, `endpoint`, `config`, `definition`, `service`, `reference`. These describe what the entity IS (a person, a project) rather than how it was discovered (commit SHA, branch name, PR number, issue ID). The entity table cannot support structural matching (find all observations sharing commit `abc123`) because the categories don't align with the `PostTransformReference.type` enum (`commit`, `branch`, `pr`, `issue`, `deployment`, etc.).

**5. The Inngest event payload carries the full PostTransformEvent.**

`observation.capture` event data inlines the entire `sourceEvent` object (title, body up to 50KB, metadata, all references). This is a fat event pattern — the observation ID would suffice since downstream consumers read from DB anyway.

### Current Schema

| Table | Purpose | Key columns |
|---|---|---|
| `workspace_neural_observations` | Fact + interpretation (mixed) | `id`, `external_id`, `workspace_id`, `source`, `source_type`, `source_id`, `title`, `content`, `actor`, `occurred_at`, `topics`, `significance_score`, `source_references`, `metadata`, `embedding_*_id` |
| `workspace_neural_entities` | Extracted entities (regex + references) | `id`, `external_id`, `workspace_id`, `category`, `key`, `value`, `source_observation_id` (single FK), `occurrence_count`, `confidence` |
| `workspace_observation_relationships` | Observation↔observation edges | `source_observation_id`, `target_observation_id`, `relationship_type`, `linking_key`, `linking_key_type`, `confidence`, `metadata` |

### Current APIs

| Endpoint | What it does |
|---|---|
| `POST /v1/graph` | BFS traversal from root observation, depth 1-3, over `workspace_observation_relationships` |
| `POST /v1/related` | Depth-1 relationships for a single observation |
| `POST /v1/search` | 2-path parallel search: Pinecone vector similarity + entity key matching |
| `POST /v1/findsimilar` | Vector-only similarity search |

---

## Architecture Decisions

### Decision 1: Split into 2 Inngest Functions (Not 3 Services)

The multi-layer architecture doc proposed 3 services (Fact Capture Hono + Graph Linker Inngest + Interpretation Engine Inngest). This is premature — a new Hono service has real operational cost (deploy, monitor, port, auth tokens, dev setup) with no pre-production benefit. The "200-500ms Inngest routing overhead" argument is irrelevant without traffic.

Instead, split the single `observation-capture.ts` into two Inngest functions:

| Function | Steps | Runtime Character |
|---|---|---|
| **observation-store** | dedup → filter → significance → store observation (immutable) → extract L0 refs → store entity-observation junctions → emit `observation.stored` | Fast synchronous path. No LLM calls. No external APIs except DB. Should complete in <2s. |
| **observation-interpret** (triggered by `observation.stored`) | classify (LLM) → embed (3 vectors) → upsert vectors (Pinecone) → store interpretation → detect relationships (entity-mediated) → emit `observation.captured` | Slow async path. LLM + embedding + Pinecone. 5-30s. Step-level retry — if embedding fails after classification succeeds, only embedding retries. |

**Why this is the right split:**
- Fact storage is decoupled from AI processing — facts are never mutated by interpretation changes
- The fast path can be retried independently of the slow path
- Interpretation reprocessing = delete interpretation rows + re-emit `observation.stored` = full recomputation without touching facts
- No new service infrastructure — both are Inngest functions in the existing console API
- The fast path is the natural boundary for the "Observe" pillar; the slow path spans "Remember" (relationships) and "Reason" (classification)

### Decision 2: Add Interpretation Table

New table `workspace_observation_interpretations` stores all AI-derived outputs. The observation row becomes truly immutable after initial storage.

```sql
workspace_observation_interpretations:
  id                  BIGINT PK GENERATED ALWAYS AS IDENTITY
  observation_id      BIGINT FK → workspace_neural_observations NOT NULL
  workspace_id        VARCHAR(191) FK → org_workspaces NOT NULL
  version             INTEGER DEFAULT 1

  -- Classification
  primary_category    VARCHAR(50)          -- "bug_fix", "feature", "deployment", etc.
  topics              JSONB                -- string[]

  -- Scoring
  significance_score  REAL                 -- 0-100

  -- Embedding references
  embedding_title_id    VARCHAR(191)
  embedding_content_id  VARCHAR(191)
  embedding_summary_id  VARCHAR(191)

  -- Provenance
  model_version       VARCHAR(100)         -- "claude-haiku-4-5-20251001"
  processed_at        TIMESTAMPTZ
  created_at          TIMESTAMPTZ

  UNIQUE (observation_id, version)
  INDEX  (observation_id)                  -- latest interpretation
  INDEX  (workspace_id, processed_at)      -- reprocessing queries
```

**Migration from observation row:**
- `topics` → moves to interpretation table
- `significance_score` → moves to interpretation table (scoring rules change, so this is an interpretation)
- `observation_type` → stays on observation row (derived deterministically from provider, stable)
- `embedding_*_id` columns → move to interpretation table (embeddings are model-dependent)
- Legacy `embedding_vector_id` → dropped (deprecated, only used in fallback lookup)

**Query pattern change:** Queries that currently read `topics` or `significance_score` from the observation row will join to `workspace_observation_interpretations` with `ORDER BY version DESC LIMIT 1` for the latest interpretation. This affects:
- `four-path-search.ts` enrichment (reads topics for display)
- `v1/search` and `v1/findsimilar` (vector ID lookup)
- Notification dispatch (reads significanceScore)

### Decision 3: Add Entity-Observation Junction Table

New table `workspace_entity_observations` records every entity↔observation link, not just the first-seen observation.

```sql
workspace_entity_observations:
  id                BIGINT PK GENERATED ALWAYS AS IDENTITY
  entity_id         BIGINT FK → workspace_neural_entities NOT NULL
  observation_id    BIGINT FK → workspace_neural_observations NOT NULL
  workspace_id      VARCHAR(191) FK → org_workspaces NOT NULL
  ref_label         VARCHAR(50)            -- contextual label from reference ("resolved_by", "fix", "merge", null)
  created_at        TIMESTAMPTZ

  UNIQUE (entity_id, observation_id)
  INDEX  (entity_id)                       -- "all observations for entity X"
  INDEX  (observation_id)                  -- "all entities for observation Y"
```

**What changes:**
- `workspace_neural_entities.source_observation_id` column is dropped — replaced by junction table
- Entity upsert in `observation-store` creates entity row + junction row in the same step
- Entity search can now return ALL observations for an entity, not just the first-seen one

### Decision 4: Rewrite Relationship Detection with Entity-Mediated Matching

Replace the 495-line point-in-time JSONB scanner with entity-mediated bidirectional matching. The core insight: when a new observation arrives and creates entity-observation junction rows, we query the junction table for all OTHER observations that share any of those entities. This handles out-of-order events automatically — whenever the second event arrives, it finds the first through the shared entity.

```
New observation O₂ arrives with references [commit:abc123, branch:feat/foo]
  → observation-store creates/finds entities E₁(commit:abc123), E₂(branch:feat/foo)
  → creates junction rows: (E₁,O₂), (E₂,O₂)
  → observation-interpret queries junction:
      "SELECT observation_id FROM entity_observations WHERE entity_id IN (E₁,E₂) AND observation_id != O₂"
  → finds O₁ (which arrived earlier and also has junction row for E₁)
  → creates edge O₂→O₁ with relationship type from edge rules
```

**Edge rules on ProviderDefinition:**

Each provider declares how its references connect to other providers' references. Rules are co-located with the provider definition so adding a new provider = defining its edges in the same file.

```typescript
interface EdgeRule {
  refType: string;              // open string, not closed enum — matches reference.type
  selfLabel?: string;           // only match when MY reference has this label
  matchProvider: string;        // "*" for any provider
  matchRefType: string;         // entity type to match against
  relationshipType: RelationshipType;
  confidence: number;
}
```

Note: `refType` is `string`, not a closed union. New providers can introduce new reference types without updating an enum.

**Bidirectional resolution:** When observation A (from provider X) shares entity E with observation B (from provider Y), BOTH providers' edge rules are consulted. The most specific rule wins (selfLabel match > provider-specific > wildcard > fallback `"references"`).

**What gets deleted:** `relationship-detection.ts` (495 lines) and its hardcoded commit/branch/issue/PR/Sentry detection passes.

### Decision 5: Slim Event Payloads

The `observation.capture` Inngest event currently carries the full `PostTransformEvent` inline. Replace with a reference-based payload for the new `observation.stored` event:

```typescript
// observation.stored — emitted by observation-store
interface ObservationStoredEvent {
  name: "apps-console/neural/observation.stored";
  data: {
    observationId: string;       // nanoid external ID
    workspaceId: string;
    source: string;              // for routing/filtering only
    sourceType: string;          // for routing/filtering only
    entityRefs: Array<{          // extracted L0 refs (small, needed by interpretation)
      type: string;
      key: string;
      label: string | null;
    }>;
  };
}
```

The interpretation function reads `title`, `body`, `metadata`, `actor`, `occurredAt` from DB using `observationId`. One indexed read, ~200 bytes event vs ~4-10KB today.

The existing `observation.capture` event (which carries the full PostTransformEvent) is retained as the trigger for `observation-store`. The fat payload is acceptable here because it originates from the console ingress route which already has the data in memory — no extra DB read needed. The change is that downstream events (`observation.stored`, `observation.captured`) become slim references.

### Decision 6: Align Entity Categories with Reference Types

Current `EntityCategory` values (`engineer`, `project`, `endpoint`, etc.) don't align with `PostTransformReference.type` values (`commit`, `branch`, `pr`, `issue`, etc.). This makes entity-mediated matching impossible — you can't find the entity for a commit SHA if the entity was stored with category `reference`.

**New approach:** Entities extracted from `PostTransformEvent.references` use the reference type directly as the category. Entities extracted from text content via regex patterns keep their semantic categories.

Expand `EntityCategory` to include structural types:

```typescript
// Structural types (from references — used for graph matching)
"commit" | "branch" | "pr" | "issue" | "deployment" |

// Semantic types (from text extraction — used for search enrichment)
"engineer" | "project" | "endpoint" | "config" | "definition" | "service" | "reference"
```

The entity table's unique constraint `(workspace_id, category, key)` means a commit SHA and a branch name with the same string won't collide — they're different categories.

---

## What We're NOT Building

Explicitly deferred to avoid over-architecture:

| Concept | Why Deferred |
|---|---|
| **L1 semantic entities** (Change, Incident, Release) | No clear merge semantics defined. L1 entity keys are AI-generated with no natural dedup key. Build L0 graph correctly first, then L1 becomes an AI layer on top of a correct foundation. |
| **L2 causal/temporal reasoning** | Completely undefined. Don't design schema for something you don't understand yet. |
| **Separate Fact Capture Hono service** | No pre-production benefit. Inngest → Hono extraction is mechanical when/if you need sub-100ms ingest latency. |
| **Actor profile/resolution layer** | Deleted in simplification. Rebuild when cross-provider actor identity is product-blocking. Raw `actor` JSONB on observation row is the fact; resolution is interpretation. |
| **Confidence-gated AI edges** | Only deterministic rule-based edges for now. AI-discovered edges require the interpretation pipeline to propose them, which requires L1 inference. |
| **Graph query redesign** | Current `/v1/graph` BFS and `/v1/related` are sufficient. Entity-mediated matching will improve edge quality, which automatically improves graph traversal. Redesign queries after the data is correct. |

---

## Implementation Plan

### Phase 1: Schema Changes (Day 1 morning)

**New tables:**
1. `workspace_observation_interpretations` — versioned AI outputs
2. `workspace_entity_observations` — entity↔observation junction

**Column changes:**
- `workspace_neural_observations`: drop `topics`, `significance_score`, `embedding_vector_id`, `embedding_title_id`, `embedding_content_id`, `embedding_summary_id`. These move to interpretation table.
- `workspace_neural_entities`: drop `source_observation_id` FK. Replaced by junction table.

**Entity category expansion:**
- Add `commit`, `branch`, `pr`, `issue`, `deployment` to `EntityCategory` schema in `packages/console-validation/src/schemas/entities.ts`

**Edge rules on ProviderDefinition:**
- Add optional `edgeRules: EdgeRule[]` field to `ProviderDefinition` interface in `packages/console-providers/src/define.ts`
- Add `EdgeRule` type and `RelationshipType` to `packages/console-providers/src/types.ts`
- Define initial edge rules for GitHub, Vercel, Sentry, Linear

**Generate migration:**
```bash
cd db/console && pnpm db:generate
```

### Phase 2: Split observation-capture.ts (Day 1 afternoon → Day 2 morning)

**Create `observation-store.ts`** — new Inngest function:
- Trigger: `apps-console/neural/observation.capture` (same as today)
- Steps: generate-ids → resolve-clerk-org-id → create-job → check-duplicate → check-event-allowed → evaluate-significance → store-observation (immutable, no topics/embedding columns) → extract-refs → upsert-entities → create-junction-rows → emit `observation.stored` → complete-job
- The observation row now stores only facts: source, sourceType, sourceId, title, content, actor, occurredAt, sourceReferences, metadata, observationType, ingestionSource
- Significance evaluation moves here but score is stored on interpretation table (emitted in observation.stored event so interpretation function doesn't need to re-score)

**Create `observation-interpret.ts`** — new Inngest function:
- Trigger: `apps-console/neural/observation.stored`
- Steps: fetch-observation (DB read by observationId) → classify (LLM) → generate-embeddings → upsert-vectors (Pinecone) → store-interpretation (new table) → detect-relationships (entity-mediated) → emit `observation.captured`
- Each LLM/API call is a separate step for retry isolation

**Delete:** `observation-capture.ts` (839 lines)

**Update `neural/index.ts`:**
```typescript
export { observationStore } from "./observation-store";
export { observationInterpret } from "./observation-interpret";
```

### Phase 3: Rewrite Relationship Detection (Day 2)

**Create `edge-resolver.ts`** — entity-mediated bidirectional matching:

```typescript
export async function resolveEdges(
  db: DrizzleClient,
  workspaceId: string,
  observationId: bigint,
  entityIds: bigint[],
  source: string,
): Promise<DetectedRelationship[]> {
  // 1. Query junction table for all observations sharing any of these entities
  // 2. For each co-occurring observation, load both providers' edge rules
  // 3. Evaluate rules bidirectionally (most specific wins)
  // 4. Return detected edges with provenance
}
```

**Add edge rules to providers:**

```typescript
// packages/console-providers/src/providers/github/definition.ts
edgeRules: [
  { refType: "commit", matchProvider: "vercel", matchRefType: "commit", relationshipType: "deploys", confidence: 1.0 },
  { refType: "commit", matchProvider: "sentry", matchRefType: "commit", relationshipType: "resolves", confidence: 1.0, selfLabel: "resolved_by" },
  { refType: "commit", matchProvider: "*", matchRefType: "commit", relationshipType: "same_commit", confidence: 1.0 },
  { refType: "branch", matchProvider: "*", matchRefType: "branch", relationshipType: "same_branch", confidence: 0.9 },
  { refType: "pr", matchProvider: "*", matchRefType: "pr", relationshipType: "tracked_in", confidence: 1.0 },
  { refType: "issue", matchProvider: "*", matchRefType: "issue", relationshipType: "references", confidence: 0.8 },
  { refType: "issue", selfLabel: "fixes", matchProvider: "*", matchRefType: "issue", relationshipType: "fixes", confidence: 1.0 },
]
```

**Delete:** `relationship-detection.ts` (495 lines)

### Phase 4: Update Consumers (Day 2 → Day 3)

**Search pipeline:**
- `four-path-search.ts`: Update `enrichSearchResults` to join interpretations table for topics. Update vector ID lookup to use interpretation table instead of observation columns.
- `entity-search.ts`: Query junction table instead of `source_observation_id` FK. Now returns ALL observations for an entity, not just first-seen.

**Graph APIs:**
- `/v1/graph` and `/v1/related`: No structural changes — they query `workspace_observation_relationships` which is unchanged.

**Notification dispatch:**
- Update to read significance from interpretation table if needed, or accept it from the `observation.captured` event payload.

**Event schemas:**
- Add `observation.stored` event schema to `client.ts`
- Update `observation.captured` event to include interpretation data (topics, significance)

**Ingress route:**
- No changes — it still sends `observation.capture` event which now triggers `observation-store`

### Phase 5: Verification (Day 3)

```bash
pnpm check && pnpm typecheck
pnpm build:console
```

Manual verification:
- Send test webhook through relay → verify it flows through both Inngest functions
- Verify observation row has no interpretation columns
- Verify interpretation row exists with topics + embedding IDs
- Verify entity-observation junction rows exist
- Verify relationships are created (including out-of-order scenario)
- Verify search works (vector + entity paths)
- Verify `/v1/graph` traversal works

---

## Files Changed

### New Files
| File | Lines (est.) | Purpose |
|---|---|---|
| `api/console/src/inngest/workflow/neural/observation-store.ts` | ~400 | Fast path: facts + entities + junctions |
| `api/console/src/inngest/workflow/neural/observation-interpret.ts` | ~350 | Slow path: classify + embed + relationships |
| `api/console/src/inngest/workflow/neural/edge-resolver.ts` | ~200 | Entity-mediated bidirectional edge resolution |
| `db/console/src/schema/tables/workspace-observation-interpretations.ts` | ~80 | Interpretation table schema |
| `db/console/src/schema/tables/workspace-entity-observations.ts` | ~50 | Junction table schema |

### Deleted Files
| File | Lines | Replaced By |
|---|---|---|
| `api/console/src/inngest/workflow/neural/observation-capture.ts` | 839 | `observation-store.ts` + `observation-interpret.ts` |
| `api/console/src/inngest/workflow/neural/relationship-detection.ts` | 495 | `edge-resolver.ts` |

### Modified Files
| File | Changes |
|---|---|
| `db/console/src/schema/tables/workspace-neural-observations.ts` | Drop `topics`, `significance_score`, `embedding_*_id` columns |
| `db/console/src/schema/tables/workspace-neural-entities.ts` | Drop `source_observation_id` column |
| `db/console/src/schema/relations.ts` | Add interpretation + junction relations |
| `db/console/src/schema/tables/index.ts` | Add new table exports |
| `packages/console-validation/src/schemas/entities.ts` | Expand `EntityCategory` with structural types |
| `packages/console-providers/src/define.ts` | Add `edgeRules` to `ProviderDefinition` |
| `packages/console-providers/src/providers/github/definition.ts` | Add edge rules |
| `packages/console-providers/src/providers/vercel/definition.ts` | Add edge rules |
| `packages/console-providers/src/providers/sentry/definition.ts` | Add edge rules |
| `packages/console-providers/src/providers/linear/definition.ts` | Add edge rules |
| `api/console/src/inngest/workflow/neural/index.ts` | Export new functions |
| `api/console/src/inngest/index.ts` | Register new functions |
| `api/console/src/inngest/client/client.ts` | Add `observation.stored` event, update schemas |
| `apps/console/src/lib/neural/four-path-search.ts` | Join interpretations for topics, use junction for entity search |
| `apps/console/src/lib/neural/entity-search.ts` | Query junction table |
| `api/console/src/inngest/workflow/notifications/dispatch.ts` | Read significance from event/interpretation |

### Net Lines: ~1,334 deleted → ~1,080 created = ~250 lines net reduction

---

## Data Flow (Post-Restructure)

```
PostTransformEvent (from relay → QStash → console ingress)
  → inngest.send("observation.capture", { workspaceId, sourceEvent, ... })
      │
      └─→ observation-store (Inngest function)
            ├── [step] generate-replay-safe-ids
            ├── [step] resolve-clerk-org-id
            ├── [step] create-job
            ├── [step] check-duplicate (sourceId)
            ├── [step] check-event-allowed (providerConfig.sync.events)
            ├── [step] evaluate-significance (rule-based, score in event)
            ├── [step] store-observation (immutable row: no topics, no embedding IDs)
            ├── [step] extract-refs + upsert-entities + create-junction-rows
            └── [step] emit observation.stored
                  │
                  │  { observationId, workspaceId, source, sourceType,
                  │    entityRefs, significanceScore }
                  │
                  └─→ observation-interpret (Inngest function)
                        ├── [step] fetch-observation (DB read)
                        ├── [step] classify-observation (Claude Haiku)
                        ├── [step] generate-multi-view-embeddings (3 vectors)
                        ├── [step] upsert-multi-view-vectors (Pinecone)
                        ├── [step] store-interpretation (new table, version 1)
                        ├── [step] resolve-edges (entity-mediated, bidirectional rules)
                        └── [step] emit observation.captured
                              │
                              │  { observationId, workspaceId, topics,
                              │    significanceScore, entitiesExtracted }
                              │
                              └─→ notification.dispatch (existing)
```

## Schema (Post-Restructure)

### `workspace_neural_observations` — Immutable Facts

```
  id, external_id, workspace_id
  source, source_type, source_id, observation_type
  title, content, actor (JSONB), occurred_at
  source_references (JSONB), metadata (JSONB)
  ingestion_source, captured_at, created_at
```

No `topics`, no `significance_score`, no `embedding_*_id`. Truly immutable after insert.

### `workspace_observation_interpretations` — Versioned AI Outputs

```
  id, observation_id (FK), workspace_id, version
  primary_category, topics (JSONB)
  significance_score
  embedding_title_id, embedding_content_id, embedding_summary_id
  model_version, processed_at, created_at
```

Latest version wins. Old versions retained for audit/rollback.

### `workspace_neural_entities` — Structural + Semantic Entities

```
  id, external_id, workspace_id
  category (expanded: commit|branch|pr|issue|deployment|engineer|project|endpoint|...)
  key, value, aliases, evidence_snippet, confidence
  occurrence_count, extracted_at, last_seen_at
  created_at, updated_at
```

No `source_observation_id` — replaced by junction table.

### `workspace_entity_observations` — Entity↔Observation Junction

```
  id, entity_id (FK), observation_id (FK), workspace_id
  ref_label, created_at
```

Enables: "all observations for entity X" and "all entities for observation Y".

### `workspace_observation_relationships` — Unchanged

```
  id, external_id, workspace_id
  source_observation_id (FK), target_observation_id (FK)
  relationship_type, linking_key, linking_key_type
  confidence, metadata (JSONB), created_at
```

Edge creation moves from point-in-time JSONB scan to entity-mediated junction query, but the storage table is unchanged.

---

## Comparison: Before vs After

| Aspect | Before (Post-Simplification) | After (Restructure) |
|---|---|---|
| **Pipeline shape** | 1 Inngest function (839 lines) | 2 Inngest functions (~400 + ~350 lines) |
| **Observation row** | Facts + interpretations mixed | Immutable facts only |
| **Interpretation storage** | On observation row (topics, significance) | Separate versioned table |
| **Entity→observation link** | Single FK (first-seen only) | Junction table (all occurrences) |
| **Relationship detection** | Point-in-time JSONB scan (misses out-of-order) | Entity-mediated junction query (handles any order) |
| **Edge rules** | Hardcoded in relationship-detection.ts | Co-located on ProviderDefinition |
| **Entity categories** | Semantic only (engineer, project, ...) | Structural + semantic (commit, branch, pr + engineer, project, ...) |
| **Event payload** | Fat (full PostTransformEvent in downstream events) | Slim references (observationId + metadata) |
| **Reprocessability** | None (must re-run full pipeline) | Delete interpretations + re-emit observation.stored |
| **Retry isolation** | All-or-nothing | Fast path (facts) independent of slow path (AI) |

## Code References

| Concern | Current File | Line |
|---|---|---|
| Observation pipeline (monolith) | `api/console/src/inngest/workflow/neural/observation-capture.ts` | 1–839 |
| Relationship detection | `api/console/src/inngest/workflow/neural/relationship-detection.ts` | 1–495 |
| Entity extraction (regex) | `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts` | 1–222 |
| Classification | `api/console/src/inngest/workflow/neural/classification.ts` | 1–225 |
| Significance scoring | `api/console/src/inngest/workflow/neural/scoring.ts` | 1–142 |
| On-failure handler | `api/console/src/inngest/workflow/neural/on-failure-handler.ts` | 1–96 |
| Observation table schema | `db/console/src/schema/tables/workspace-neural-observations.ts` | 1–232 |
| Entity table schema | `db/console/src/schema/tables/workspace-neural-entities.ts` | 1–157 |
| Relationship table schema | `db/console/src/schema/tables/workspace-observation-relationships.ts` | 1–166 |
| Inngest event schemas | `api/console/src/inngest/client/client.ts` | 20–217 |
| ProviderDefinition interface | `packages/console-providers/src/define.ts` | 274–324 |
| PostTransformEvent type | `packages/console-providers/src/post-transform-event.ts` | 44–56 |
| Graph traversal (BFS) | `apps/console/src/lib/v1/graph.ts` | 51–210 |
| Related events | `apps/console/src/lib/v1/related.ts` | 43–161 |
| Search pipeline (2-path) | `apps/console/src/lib/neural/four-path-search.ts` | 1–653 |
| Entity search | `apps/console/src/lib/neural/entity-search.ts` | 1–160 |
| Console ingress route | `apps/console/src/app/api/gateway/ingress/route.ts` | 28–99 |
| Inngest notification send | `apps/console/src/app/api/gateway/ingress/_lib/notify.ts` | 15–28 |
| EntityCategory schema | `packages/console-validation/src/schemas/entities.ts` | 9–17 |
| Notification dispatch | `api/console/src/inngest/workflow/notifications/dispatch.ts` | 43 |

## Open Questions

1. **Significance on observation vs interpretation?** Significance scoring is currently rule-based (deterministic given the same rules). If scoring rules are treated as stable, `significance_score` could stay on the observation row as a fact. If rules are expected to change (and you'd want to re-score), it belongs on interpretation. Current recommendation: move to interpretation (rules WILL change).

2. **`observation_type` derivation stability.** `deriveObservationType(source, sourceType)` is deterministic per provider. If a provider changes its type mapping, existing observations retain the old type. This is correct — it's a fact about what the observation was classified as at capture time. Keep on observation row.

3. **Pinecone vector cleanup on reprocessing.** When interpretations are reprocessed (new model → new embeddings), old Pinecone vectors with old IDs remain in the index. Need a cleanup step that deletes old vectors before upserting new ones. The old vector IDs are on the previous interpretation version.

4. **Entity upsert race conditions.** Two concurrent `observation-store` invocations for the same workspace creating the same entity (e.g., both reference commit `abc123`). The `UNIQUE (workspace_id, category, key)` constraint + `onConflictDoUpdate` handles this at the DB level. Junction rows use `UNIQUE (entity_id, observation_id)` with `onConflictDoNothing`. No application-level locking needed.

5. **Edge rule fallback.** When no provider-specific rule matches for two co-occurring observations, should we create a generic `"references"` edge (low confidence) or skip? Recommendation: create with `confidence: 0.5` and `relationshipType: "co_occurs"` as a catch-all. This ensures the graph captures all entity-mediated connections even for provider pairs without explicit rules.

## References

- Previous architecture doc (superseded): `thoughts/shared/research/2026-03-10-multi-layer-event-graph-architecture.md`
- Pipeline simplification plan (completed): `thoughts/shared/plans/2026-03-12-pipeline-simplification.md`
- Graph linker deep dive: `thoughts/shared/research/2026-03-10-graph-linker-deep-dive.md`
- SPEC.md: `/SPEC.md`
