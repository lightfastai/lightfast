---
date: "2026-03-10T18:00:00+08:00"
researcher: claude
git_commit: 81c1780546900cf265d16c1dadcb13ae7be93e09
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Multi-Layer Event Graph: 3-Service Architecture for the Read Pipeline"
tags: [research, architecture, read-pipeline, multi-layer-graph, fact-capture, graph-linker, interpretation-engine, entity-model, eventual-consistency]
status: complete
supersedes: "2026-03-10-graph-linker-deep-dive.md (Follow-up Research Section 7: Entity-First Architecture)"
last_updated: "2026-03-10"
last_updated_note: "Complete architectural re-evaluation. Supersedes entity-first single-function approach with 3-service multi-layer graph."
---

# Research: Multi-Layer Event Graph Architecture

**Date**: 2026-03-10T18:00:00+08:00
**Git Commit**: 81c1780546900cf265d16c1dadcb13ae7be93e09
**Branch**: feat/backfill-depth-entitytypes-run-tracking
**Supersedes**: `2026-03-10-graph-linker-deep-dive.md` Follow-up Research Section 7 (Entity-First Architecture Decisions)

## Context

The [graph linker deep dive](./2026-03-10-graph-linker-deep-dive.md) identified critical problems in the current monolithic observation pipeline: out-of-order webhook linking, point-in-time relationship detection, hardcoded edge rules, missing domain entity layer, and no separation between facts and interpretations.

That document concluded with an "entity-first, single Inngest function" approach. This document **supersedes those conclusions** after a critical re-evaluation against SPEC.md's long-term vision:

> *"Any agent or engineer can understand what's happening, why it happened, and what should happen next — across every tool, every team, every decision — without knowing which tools exist or how they work."*

### Why the Previous Architecture Falls Short

1. **Entity model too narrow** — `commit | branch | pr | issue` covers git/deploy workflows only. SPEC requires modeling customers, conversations, incidents, releases, feature flags, support tickets, billing events — and types we can't predict yet.

2. **Flat graph** — No concept of hierarchical or temporal layers. A commit SHA match is useful but what humans care about is "the Change that shipped feature X" (spanning PRs, commits, deployments, rollbacks). The previous entity model creates Level 0 identity matching but misses higher-order semantic grouping entirely.

3. **Static edge rules don't scale** — `linkRules` on ProviderDefinition assumes enumerable provider-pair relationships. Breaks for multi-hop reasoning (PR → commit → deployment → error → incident), temporal relationships, and providers not yet integrated.

4. **Mixed fact and interpretation** — SPEC says "events are facts, interpretations layer on top." The previous architecture stores classification, topics, and cluster assignment on the observation row alongside raw event data. No way to reprocess interpretations without modifying facts.

5. **Single function coupling** — Two parallel streams in one Inngest function couples observation storage, entity resolution, AI classification, and graph building into one execution unit. As providers and entity types grow, this becomes a god function.

## Architecture Decisions

### Decision 1: Multi-Layer Graph

The graph has three levels, each building on the previous:

| Level | What | Examples | Creation Method |
|-------|------|----------|----------------|
| **Level 0** | Identifier entities — deterministic references extracted from event data | Commit `abc123`, PR `#123`, Branch `feat/foo`, Issue `ENG-456` | Deterministic parsing of `PostTransformEvent.references` |
| **Level 1** | Semantic entities — higher-order concepts that span multiple L0 entities | Change (PR + commits + deployments), Incident (error + alert + fix), Release (tag + deployments + rollbacks) | AI-inferred from observation clusters and L0 neighborhood |
| **Level 2** | Causal/temporal reasoning — why and when relationships | "This deployment caused this error", "This config change triggered this incident" | Future: AI inference over temporal patterns |

**Key insight**: The previous plan's `workspace_entities` (linking keys) and the current `cluster` concept both map into this model. Linking keys are Level 0 entities. Clusters become Level 1 entities with semantic types. No separate cluster concept exists — Changes, Incidents, and Releases replace embedding-similarity groups.

**Open entity types**: `varchar(50)` for `entity_type` accepts future types (`customer`, `subscription`, `session`, `feature_flag`) without schema migration. Level 0 entity types expand naturally as new providers are added.

### Decision 2: Strict Fact/Interpretation Separation

Aligned with SPEC principle: *"Events are facts. Interpretations layer on top. History is never rewritten."*

| Layer | What | Mutability | Reprocessable |
|-------|------|------------|---------------|
| **Facts** | Observation row (source, title, body, actor, references, occurredAt), Level 0 entity identifiers, entity-observation junctions | **Immutable** after storage | N/A — facts don't change |
| **Interpretations** | Classification, topics, embeddings, semantic entities, Level 1 entity inference, cluster/entity assignments | **Versioned** records with model provenance | Yes — delete interpretations + replay = full recomputation |

The observation table contains only raw event data. Classification results, topics, embedding IDs, and cluster assignments live in a separate `workspace_observation_interpretations` table with version tracking and model provenance. When AI models improve, interpretations can be recomputed without touching facts.

### Decision 3: 3-Service Decomposition (Hono + 2 Inngest)

Three services with distinct runtimes, mapping to SPEC pillars:

| Service | SPEC Pillar | Runtime | Trigger | Why This Runtime |
|---------|-------------|---------|---------|-----------------|
| **Fact Capture** | Observe | Hono app (QStash retry) | QStash HTTP POST | Fast synchronous path. Simple operations (validate, dedup, store). No LLM calls. QStash provides retry. Matches relay/gateway/backfill pattern. Avoids ~200-500ms Inngest routing overhead on critical path. |
| **Graph Linker** | Remember | Inngest function | `observation.stored` + `interpretation.complete` events | Needs concurrency control per entity (two observations for same commit arriving simultaneously). Step-level retry for multiple graph operations. Dual event triggers (L0 from facts, L1 from interpretation). |
| **Interpretation Engine** | Reason | Inngest function | `observation.stored` event | Long-running (5-30s). Multiple expensive external API calls (LLM, embedding, Pinecone). Step-level durability essential — if embedding fails after classification succeeds, don't redo classification. |

**When to extract to Hono**: If Graph Linker or Interpretation Engine needs sub-100ms latency, custom scaling beyond Inngest concurrency, or direct HTTP API access for internal queries.

### Decision 4: Hybrid Rules + AI Inference for Edges

| Edge Source | Mechanism | Confidence | Written By |
|-------------|-----------|------------|------------|
| **Level 0 deterministic** | Static `edgeRules` on ProviderDefinition + identifier matching via entity table | Always 1.0 | Graph Linker (on `observation.stored`) |
| **Level 1 AI-discovered** | Interpretation Engine examines L0 neighborhood + embeddings + temporal proximity | Variable (0.0–1.0) | Graph Linker (on `interpretation.complete`) — **confidence-gated** |

All edges carry **provenance** (`rule` vs `inference`) and **confidence** scores. The Graph Linker is the single authority for all graph writes. AI-discovered edges are confidence-gated — only edges above a configurable threshold are written. Level 0 deterministic edges bypass the confidence check.

### Decision 5: Edge Rules on ProviderDefinition (Co-located)

Each provider declares its cross-source linking rules alongside its transformer. When you add a new provider, you define how it connects to others in the same file. The Graph Linker loads rules from all registered providers at startup.

Rule structure (unchanged from previous research):

```typescript
interface EdgeRule {
  refType: "commit" | "branch" | "pr" | "issue";
  selfLabel?: string;        // Only match when MY reference has this label
  matchProvider: string;     // "*" for any provider
  matchRefType: string;
  relationshipType: RelationshipType;
  confidence: number;
}
```

Bidirectional rule resolution: when observation A matches observation B via a shared entity, BOTH providers' rules are consulted. The most specific rule wins (selfLabel match > wildcard > fallback). This fixes all 6 ordering scenarios from the original research.

### Decision 6: Clusters Become Level 1 Entities

The current cluster concept (embedding-similarity groups) is **eliminated as a separate concept**. What were previously untyped clusters become typed Level 1 semantic entities:

| Old Concept | New Concept |
|------------|-------------|
| Cluster of PR + commit + deployment observations | **Change** entity (Level 1) |
| Cluster of error + alert + investigation observations | **Incident** entity (Level 1) |
| Cluster of tag + deployment + monitoring observations | **Release** entity (Level 1) |
| Loose similarity group with no clear semantic type | Level 1 entity with `entity_type = "group"` (fallback) |

The Interpretation Engine infers Level 1 entities incrementally per-observation by examining the observation's Level 0 neighborhood (which entities it connects to, which other observations share those entities) and using classification + embedding similarity to determine if the observation belongs to an existing Level 1 entity or warrants creating a new one.

### Decision 7: Entity-Mediated Actor Reconciliation

Actor reconciliation is a property of entity state, not a special-case pipeline step. When a Level 0 entity (e.g., Commit `abc123`) accumulates observations from multiple providers:

1. First observation with a numeric actor ID sets `canonical_actor_id` on the entity
2. Future observations from other providers (e.g., Vercel) get the canonical actor from entity state
3. Graph Linker backfills earlier observations that lack canonical actors

No special-case `reconcileVercelActorsForCommit` function. The pattern generalizes to any provider pair sharing an entity.

### Decision 8: Separate Tables Per Graph Level

Observation-level edges and entity-level edges are stored in separate tables, each optimized for its access patterns:

- `workspace_observation_relationships` — Level 0 edges between observations (deterministic + AI, with provenance)
- `workspace_entity_relationships` — Level 1+ edges between entities (hierarchy, causal, semantic)
- `workspace_entity_observations` — Junction table linking entities to observations

### Decision 9: Direct DB Reads for Cross-Service Data

The Interpretation Engine needs Level 0 graph context (which entities the observation connects to, which other observations share those entities) for Level 1 inference. It reads this directly from the database rather than through an API or enriched event. Both services share the same database.

**Trade-off**: Couples Interpretation Engine to Graph Linker's schema but avoids API latency and infrastructure complexity. Acceptable because both services are in the same deployment unit (console API) and the entity/junction schema is stable.

## Complete Data Flow

```
PostTransformEvent
  → Fact Capture (Hono app, QStash retry)
      ├── validate (sourceId format, required fields)
      ├── duplicate check (by sourceId)
      ├── event allowlist check (providerConfig.sync.events)
      ├── significance evaluation (score 0-100, gate at threshold)
      ├── store immutable observation row
      ├── extract Level 0 entity refs from sourceReferences
      └── emit observation.stored (Inngest event)
            │
            │  {observationId, workspaceId, externalId, source, sourceType,
            │   entityRefs: [{type, key, label}], actor, occurredAt}
            │
            ├─→ Graph Linker (Inngest, triggered by observation.stored)
            │     ├── [step] upsert Level 0 entities (find-or-create)
            │     ├── [step] create entity-observation junction rows
            │     ├── [step] query matching entity-observations → resolve edges
            │     │           (bidirectional edgeRules from both providers)
            │     ├── [step] insert deterministic edges (provenance: rule, confidence: 1.0)
            │     ├── [step] actor reconciliation via entity canonical_actor_id
            │     └── [step] emit graph.updated event
            │
            └─→ Interpretation Engine (Inngest, parallel with Graph Linker)
                  ├── [step] classify observation (LLM)
                  ├── [step] generate multi-view embeddings (3 vectors)
                  ├── [step] extract semantic entities (LLM)
                  ├── [step] upsert vectors to Pinecone
                  ├── [step] store versioned interpretation record
                  ├── [step] Level 1 inference:
                  │           - read L0 neighborhood from DB
                  │           - examine connected observations + their interpretations
                  │           - classify semantic entity type (Change/Incident/Release)
                  │           - compute confidence for discovered edges
                  └── [step] emit interpretation.complete
                        │
                        │  {observationId, workspaceId, classification, topics,
                        │   embeddingIds, discoveredEdges: [{target, type, confidence}],
                        │   proposedL1Entities: [{type, memberEntityIds, confidence}]}
                        │
                        └─→ Graph Linker (second trigger)
                              ├── [step] confidence-gate AI-discovered edges
                              │           (write edges above threshold, discard below)
                              ├── [step] create/merge Level 1 entities
                              │           (find existing L1 or create new, with entity_tier=1)
                              ├── [step] create entity hierarchy
                              │           (L1 CONTAINS L0 entity relationships)
                              └── [step] emit graph.updated event
```

## Data Model

### `workspace_observations` — Immutable Facts

```sql
workspace_observations:
  id              BIGINT PK GENERATED ALWAYS AS IDENTITY
  external_id     VARCHAR(21) UNIQUE          -- nanoid for API
  workspace_id    VARCHAR(191) FK → org_workspaces

  -- Raw event data (immutable)
  source          VARCHAR(50)                 -- "github", "vercel", "sentry", "linear"
  source_type     VARCHAR(100)                -- "pull_request.opened", "deployment.ready"
  source_id       VARCHAR(500)                -- dedup key: "pr:lightfastai/lightfast#123/opened"
  title           TEXT
  body            TEXT
  actor           JSONB                       -- {id, name, email, avatarUrl, source}
  occurred_at     TIMESTAMPTZ
  source_references JSONB                     -- [{type, id, label}] — raw from transformer
  metadata        JSONB                       -- provider-specific data

  -- Fact-level scoring (deterministic, computed at capture time)
  significance_score INTEGER                  -- 0-100, from evaluate-significance

  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ                 -- only for actor backfill via reconciliation

  UNIQUE (workspace_id, source_id)
  INDEX  (workspace_id, occurred_at)
  INDEX  (workspace_id, source, source_type)
```

**Note**: No `classification`, `topics`, `cluster_id`, or `embedding_id` columns. These are interpretations.

### `workspace_observation_interpretations` — Versioned Interpretations

```sql
workspace_observation_interpretations:
  id              BIGINT PK GENERATED ALWAYS AS IDENTITY
  observation_id  BIGINT FK → workspace_observations
  workspace_id    VARCHAR(191) FK → org_workspaces
  version         INTEGER DEFAULT 1           -- incremented on reprocessing

  -- AI-produced results
  classification  JSONB                       -- {category, observationType, confidence}
  topics          JSONB                       -- [{name, confidence}]
  embedding_ids   JSONB                       -- {title: "vec_...", content: "vec_...", summary: "vec_..."}
  semantic_entities JSONB                     -- [{category, key, value, confidence}] — LLM-extracted

  -- Provenance
  model_used      VARCHAR(100)                -- "claude-haiku-4-5-20251001", "text-embedding-3-small"
  processed_at    TIMESTAMPTZ

  created_at      TIMESTAMPTZ

  INDEX  (observation_id)                     -- latest interpretation for an observation
  INDEX  (workspace_id, processed_at)         -- reprocessing queries
  UNIQUE (observation_id, version)            -- one interpretation per version
```

### `workspace_entities` — Multi-Level Entities

```sql
workspace_entities:
  id              BIGINT PK GENERATED ALWAYS AS IDENTITY
  external_id     VARCHAR(21) UNIQUE          -- nanoid for API
  workspace_id    VARCHAR(191) FK → org_workspaces

  -- Identity
  entity_type     VARCHAR(50)                 -- "commit", "branch", "pr", "issue", "change", "incident", "release"
  entity_key      VARCHAR(500)                -- SHA, "#123", "ENG-456", "feat/foo", or generated ID for L1
  entity_tier     SMALLINT DEFAULT 0          -- 0 = identifier (deterministic), 1 = semantic (AI-inferred), 2 = causal (future)

  -- Accumulated state
  observation_count  INTEGER DEFAULT 0
  sources            JSONB                    -- ["github", "vercel"] — contributing providers
  first_seen_at      TIMESTAMPTZ
  last_seen_at       TIMESTAMPTZ

  -- Resolved identity (populated by actor reconciliation)
  canonical_actor_id VARCHAR(100)             -- "github:12345" — resolved canonical actor

  -- AI metadata (Level 1+ only)
  confidence      REAL                        -- AI confidence in entity existence (L1+)
  description     TEXT                        -- AI-generated summary of what this entity represents

  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ

  UNIQUE (workspace_id, entity_type, entity_key)
  INDEX  (workspace_id, entity_tier)
  INDEX  (workspace_id, entity_type)
  INDEX  (workspace_id, last_seen_at)
```

### `workspace_entity_observations` — Entity ↔ Observation Junction

```sql
workspace_entity_observations:
  id              BIGINT PK GENERATED ALWAYS AS IDENTITY
  entity_id       BIGINT FK → workspace_entities
  observation_id  BIGINT FK → workspace_observations
  source          VARCHAR(50)                 -- provider that emitted this reference
  ref_label       VARCHAR(50)                 -- contextual label ("resolved_by", "fix", "merge")
  created_at      TIMESTAMPTZ

  UNIQUE (entity_id, observation_id)
  INDEX  (entity_id)                          -- "all observations for entity X"
  INDEX  (observation_id)                     -- "all entities for observation Y"
```

### `workspace_observation_relationships` — Level 0 Edges

```sql
workspace_observation_relationships:
  id                    BIGINT PK GENERATED ALWAYS AS IDENTITY
  workspace_id          VARCHAR(191) FK → org_workspaces
  source_observation_id BIGINT FK → workspace_observations
  target_observation_id BIGINT FK → workspace_observations
  relationship_type     VARCHAR(50)           -- "fixes", "resolves", "deploys", "same_commit", etc.

  -- Provenance
  provenance            VARCHAR(20)           -- "rule" (deterministic) or "inference" (AI)
  confidence            REAL DEFAULT 1.0      -- 1.0 for rules, variable for inference
  linking_key_type      VARCHAR(50)           -- entity_type that caused this edge
  linking_key           VARCHAR(500)          -- entity_key that caused this edge

  created_at            TIMESTAMPTZ

  UNIQUE (workspace_id, source_observation_id, target_observation_id, relationship_type)
  INDEX  (source_observation_id)
  INDEX  (target_observation_id)
  INDEX  (workspace_id, provenance)           -- filter by trust level
```

### `workspace_entity_relationships` — Level 1+ Edges & Hierarchy

```sql
workspace_entity_relationships:
  id                BIGINT PK GENERATED ALWAYS AS IDENTITY
  workspace_id      VARCHAR(191) FK → org_workspaces
  source_entity_id  BIGINT FK → workspace_entities
  target_entity_id  BIGINT FK → workspace_entities
  relationship_type VARCHAR(50)               -- "contains", "triggers", "causes", "related_to"

  -- Provenance
  provenance        VARCHAR(20)               -- "rule" or "inference"
  confidence        REAL DEFAULT 1.0

  created_at        TIMESTAMPTZ

  UNIQUE (workspace_id, source_entity_id, target_entity_id, relationship_type)
  INDEX  (source_entity_id)
  INDEX  (target_entity_id)
```

## Event Contracts

### `observation.stored` (Fact Capture → Graph Linker + Interpretation Engine)

```typescript
interface ObservationStoredEvent {
  name: "neural/observation.stored";
  data: {
    observationId: bigint;       // DB primary key
    externalId: string;          // nanoid
    workspaceId: string;
    clerkOrgId: string;

    // Raw event data (passed through for Interpretation Engine)
    source: string;              // "github", "vercel", etc.
    sourceType: string;          // "pull_request.opened", etc.
    title: string;
    body: string;
    actor: ActorData;
    occurredAt: string;          // ISO 8601
    metadata: Record<string, unknown>;

    // Level 0 entity refs (extracted by Fact Capture)
    entityRefs: Array<{
      type: string;              // "commit", "branch", "pr", "issue"
      key: string;               // SHA, "#123", "feat/foo"
      label: string | null;      // "resolved_by", "fix", "merge"
    }>;

    // Pipeline context
    significanceScore: number;
    connectionId: string;
  };
}
```

### `interpretation.complete` (Interpretation Engine → Graph Linker)

```typescript
interface InterpretationCompleteEvent {
  name: "neural/interpretation.complete";
  data: {
    observationId: bigint;
    externalId: string;
    workspaceId: string;
    interpretationVersion: number;

    // AI results summary
    classification: {
      category: string;
      observationType: string;
      confidence: number;
    };
    topics: Array<{ name: string; confidence: number }>;

    // Discovered edges (for Graph Linker to confidence-gate and write)
    discoveredEdges: Array<{
      targetObservationId: bigint;
      relationshipType: string;
      confidence: number;
      reasoning: string;         // AI explanation for auditability
    }>;

    // Proposed Level 1 entities
    proposedL1Entities: Array<{
      entityType: string;        // "change", "incident", "release"
      memberEntityIds: bigint[]; // Level 0 entity IDs to group
      confidence: number;
      description: string;       // AI-generated summary
      mergeWithExistingId?: bigint; // If this should merge into existing L1 entity
    }>;
  };
}
```

### `graph.updated` (Graph Linker → downstream consumers)

```typescript
interface GraphUpdatedEvent {
  name: "neural/graph.updated";
  data: {
    workspaceId: string;
    trigger: "observation_stored" | "interpretation_complete";

    // What changed
    entitiesUpserted: Array<{ id: bigint; type: string; key: string; tier: number }>;
    edgesCreated: Array<{
      sourceId: bigint;
      targetId: bigint;
      type: string;
      provenance: "rule" | "inference";
    }>;
    actorsReconciled: Array<{
      observationId: bigint;
      canonicalActorId: string;
    }>;

    // Level 1 changes (only on interpretation_complete trigger)
    l1EntitiesCreated?: Array<{ id: bigint; type: string; memberCount: number }>;
    l1EntitiesMerged?: Array<{ id: bigint; mergedIntoId: bigint }>;
  };
}
```

## Service Implementation Details

### Fact Capture (Hono App)

```
apps/fact-capture/
  src/
    index.ts                   -- Hono app, srvx server
    routes/
      ingest.ts                -- POST /api/ingest (receives PostTransformEvent)
    lib/
      validate.ts              -- Input validation
      dedup.ts                 -- Duplicate check by sourceId
      significance.ts          -- Score evaluation + gate
      entity-ref-extractor.ts  -- Extract L0 refs from sourceReferences
      store.ts                 -- Insert observation row
```

**Port**: 4111
**Middleware**: `requestId` → `lifecycle` → `errorSanitizer` → `sentry` (same as relay/gateway/backfill)
**Auth**: `X-API-Key` header (internal service-to-service)
**Retry**: QStash provides automatic retry on failure

### Graph Linker (Inngest Function)

```
api/console/src/inngest/workflow/graph/
  graph-linker.ts              -- Main Inngest function (observation.stored trigger)
  graph-linker-l1.ts           -- Second Inngest function (interpretation.complete trigger)
  lib/
    entity-upsert.ts           -- Find-or-create Level 0 entities
    junction-insert.ts         -- Create entity-observation rows
    edge-resolver.ts           -- Bidirectional edgeRules evaluation
    actor-reconciliation.ts    -- Entity-mediated canonical actor resolution
    l1-entity-manager.ts       -- Create/merge Level 1 entities + hierarchy
    confidence-gate.ts         -- Threshold filter for AI edges
```

**Concurrency**: Keyed by `workspaceId` + entity key to prevent duplicate edge creation for concurrent observations about the same entity.

### Interpretation Engine (Inngest Function)

```
api/console/src/inngest/workflow/interpretation/
  interpretation-engine.ts     -- Main Inngest function (observation.stored trigger)
  lib/
    classify.ts                -- LLM classification
    embed.ts                   -- Multi-view embedding generation
    extract-entities.ts        -- LLM semantic entity extraction
    l1-inference.ts            -- Level 1 entity inference (reads L0 neighborhood)
    store-interpretation.ts    -- Insert versioned interpretation record
```

**Step-level durability**: Each LLM/API call is a separate Inngest step. If embedding fails after classification succeeds, only embedding is retried.

## Comparison: Previous vs Revised Architecture

| Aspect | Entity-First Single Function | Multi-Layer 3-Service |
|--------|------------------------------|----------------------|
| **Pipeline shape** | 1 Inngest function, 2 parallel streams | 3 services (Hono + 2 Inngest), event-driven DAG |
| **Observation storage** | Mutable (classification, topics, cluster on row) | Immutable fact + separate versioned interpretations |
| **Entity model** | Flat: L0 identifiers only | Multi-layer: L0 identifiers + L1 semantic + L2 causal (future) |
| **Clusters** | Separate concept (embedding similarity groups) | Become Level 1 entities (Change, Incident, Release) |
| **Edge resolution** | Bidirectional via entity table + static rules | L0: static rules via entities. L1+: AI inference, confidence-gated |
| **Graph authority** | Distributed across pipeline steps | Single authority: Graph Linker owns all graph writes |
| **Reprocessability** | None (re-run full pipeline) | Delete interpretations, replay — facts untouched |
| **Trust model** | All edges equal | Provenance (rule/inference) + confidence scores |
| **Scalability path** | Extract to 2-3 apps "when needed" | Already decomposed. Inngest → Hono extraction is mechanical |
| **SPEC alignment** | Observe + Remember coupled | Observe (Fact) / Remember (Graph) / Reason (Interpret) cleanly separated |

## What Gets Deleted/Replaced

### From `observation-capture.ts` (1241-line monolith)

**Moves to Fact Capture (Hono)**:
- `generate-replay-safe-ids` → `entity-ref-extractor.ts`
- `resolve-clerk-org-id` → inline in route handler
- `create-job` → job tracking middleware
- `check-duplicate` → `dedup.ts`
- `check-event-allowed` → `validate.ts`
- `evaluate-significance` → `significance.ts`
- `store-observation` → `store.ts` (immutable, no classification/topics/cluster columns)

**Moves to Graph Linker (Inngest)**:
- `detect-relationships` → `edge-resolver.ts` (rewritten: entity-based, bidirectional rules)
- `reconcile-vercel-actors` → `actor-reconciliation.ts` (generalized: entity-mediated)
- `assign-cluster` → eliminated (clusters become L1 entities in Graph Linker L1)
- `resolve-actor` → `actor-reconciliation.ts`

**Moves to Interpretation Engine (Inngest)**:
- `classify-observation` → `classify.ts`
- `generate-multi-view-embeddings` → `embed.ts`
- `extract-entities` → `extract-entities.ts`
- `upsert-multi-view-vectors` → `embed.ts` (Pinecone upsert after embedding)
- `fetch-context` → inline (workspace settings for embedding config)

**Deleted entirely**:
- `observation-capture.ts` — replaced by 3 services
- `relationship-detection.ts` — replaced by `edge-resolver.ts` with entity-based bidirectional matching
- `cluster-assignment.ts` — replaced by L1 entity inference in Interpretation Engine

### Fire-and-forget events (retained, re-sourced)
- `profile.update` → emitted by Graph Linker after actor reconciliation
- `llm-entity-extraction.requested` → potentially absorbed into Interpretation Engine
- `cluster.check-summary` → replaced by L1 entity summary generation

## Migration Path

Since we're pre-production with no user data to migrate:

1. **Create Fact Capture Hono app** — new `apps/fact-capture/`, same pattern as relay/gateway/backfill
2. **Create new DB tables** — `workspace_observations` (renamed, columns removed), `workspace_observation_interpretations`, updated `workspace_entities` (add `entity_tier`), `workspace_entity_relationships`
3. **Implement Graph Linker** — new Inngest functions in `api/console/src/inngest/workflow/graph/`
4. **Implement Interpretation Engine** — new Inngest functions in `api/console/src/inngest/workflow/interpretation/`
5. **Update relay/gateway** — route PostTransformEvent to Fact Capture instead of Inngest observation.capture
6. **Delete old pipeline** — `observation-capture.ts`, `relationship-detection.ts`, `cluster-assignment.ts`
7. **Add `edgeRules`** to existing ProviderDefinitions (GitHub, Vercel, Sentry, Linear)

## Remaining Open Questions

1. **Level 1 entity type taxonomy** — What are the initial Level 1 entity types beyond Change, Incident, and Release? How do we handle providers like Intercom (Conversations), Stripe (Billing Events), Clerk (Auth Events)?

2. **Interpretation versioning strategy** — When reprocessing, do we keep old versions or overwrite? If kept, how do downstream consumers know which version to use? (Likely: latest version wins, old versions retained for audit.)

3. **Level 1 inference prompt design** — The Interpretation Engine needs a prompt that examines an observation + its L0 neighborhood and determines: (a) which L1 entity it belongs to, (b) whether to create a new L1 entity, (c) confidence scores. This prompt is critical to correctness.

4. **Entity lifecycle** — Do entities ever get archived/deleted? Branch entities after deletion? L1 entities that lose all member observations? Need a lifecycle model.

5. **Confidence threshold tuning** — What's the initial confidence threshold for AI-discovered edges? Too high = miss valid relationships. Too low = noise. Likely needs per-relationship-type thresholds and workspace-level configuration.

6. **Observation `updated_at` semantics** — The observation row is "immutable" but actor reconciliation updates the `actor` JSONB. Should actor backfill update the observation directly, or store the canonical actor only on the entity row and resolve at query time?

7. **Cross-workspace entities** — Some entities (commit SHAs, npm package versions) may appear across workspaces. Current model is workspace-scoped. Is this correct long-term?

8. **Graph Linker idempotency** — If `observation.stored` is delivered twice (Inngest retry), the Graph Linker must not create duplicate edges or junction rows. The UNIQUE constraints handle this at the DB level, but `onConflictDoNothing` needs to be used consistently.

## Code References

All code references from the [original research](./2026-03-10-graph-linker-deep-dive.md#code-references) remain valid. This document adds no new code — it is a pure architectural re-evaluation.
