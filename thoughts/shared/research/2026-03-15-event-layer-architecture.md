---
date: 2026-03-15T00:00:00+11:00
researcher: claude
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Why does Lightfast have multiple event representations? (ingest log, events, entities, edges)"
tags: [research, codebase, events, entities, pipeline, schema, inngest, relay, architecture]
status: complete
last_updated: 2026-03-15
last_updated_note: "Added efficiency evaluation and optimal architecture design (Sections 5–7)"
---

# Research: Event Layer Architecture

**Date**: 2026-03-15
**Git Commit**: `4ec3c541776200e318c670c5064af752d9e142f0`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

Why does Lightfast have multiple representations of events in the database — specifically, what is the role of each of: `workspace_ingest_log`, `workspace_events`, `workspace_entities`, `workspace_entity_events`, and `workspace_edges`?

---

## Summary

Each table layer exists to serve a **different access pattern**. They are not accidental duplication — they are a deliberate separation of concerns across four distinct purposes:

| Layer | Table | Purpose |
|---|---|---|
| 0 | `gw_webhook_deliveries` | Raw delivery tracking + DLQ replay |
| 1 | `workspace_ingest_log` | Monotonic SSE cursor (CQRS write-side) |
| 2 | `workspace_events` | Structured queryable fact store (CQRS read-side) |
| 3 | `workspace_entities` | Deduplicated real-world entity registry |
| 3 | `workspace_entity_events` | Many-to-many: entity↔event membership |
| 4 | `workspace_edges` | Directed knowledge graph (entity→entity relationships) |

An additional concern — real-time event streaming — is served by Pinecone vectors (layer `"entities"`), not by any of these tables directly.

---

## Detailed Findings

### Layer 0 — `gw_webhook_deliveries` (Raw Delivery Tracking)

**File**: `db/console/src/schema/tables/gw-webhook-deliveries.ts:11`
**Written by**: relay service (`apps/relay/src/routes/webhooks.ts:80` and `workflows.ts:60`)

This table lives closest to the HTTP wire. It tracks raw inbound webhooks **before any transformation** and exists for two reasons:

1. **Delivery lifecycle tracking**: `status` column cycles through `received → enqueued → delivered → dlq`. The relay writes `received` on arrival, `enqueued` after QStash publish, and then the QStash callback to `/admin/delivery-status` writes `delivered` or `dlq` on final disposition (`apps/relay/src/routes/admin.ts:266`).

2. **DLQ replay**: The `payload` column (raw text) is only populated on failed deliveries so they can be replayed. Successful deliveries do not store the payload.

Key columns: `provider`, `deliveryId`, `eventType`, `installationId` (nullable, filled after connection resolution), `status`, `payload`, `receivedAt`.
Unique index: `(provider, deliveryId)` at line 35.

This table is gateway-scoped and has **no FK to any workspace** — it predates workspace resolution. The `installationId` is filled in a subsequent workflow step after the relay looks up which installation owns the webhook resource.

---

### Layer 1 — `workspace_ingest_log` (SSE Cursor / Monotonic Log)

**File**: `db/console/src/schema/tables/workspace-ingest-log.ts:25`
**Written by**: console ingress route (`apps/console/src/app/api/gateway/ingress/route.ts:71`)
**Primary consumer**: SSE endpoint (`/api/gateway/stream`) for real-time catch-up via `Last-Event-ID`

This table receives the fully-transformed `PostTransformEvent` as a JSONB blob (`sourceEvent` column), **before any deduplication, significance scoring, or entity extraction**. Every successfully-transformed webhook lands here unconditionally.

**Why it exists separately from `workspace_events`**: The SSE endpoint needs to replay "give me all events after cursor N, in insertion order". The `workspace_events` table is indexed for structured queries (by `sourceId`, `source`, `observationType`) but cannot cheaply serve monotonic cursor scans. The ingest log's BIGINT identity PK provides the monotonic ordering guarantee via the composite index `(workspaceId, id)` at `workspace-ingest-log.ts:94`.

The `deliveryId` column traces back to `gw_webhook_deliveries` for debugging — you can trace `workspace_ingest_log.deliveryId → gw_webhook_deliveries.deliveryId` to see the raw HTTP delivery.

Key columns: `id` (BIGINT PK / SSE cursor), `workspaceId`, `deliveryId`, `source`, `sourceType`, `sourceEvent` (full `PostTransformEvent` JSONB), `ingestionSource`, `receivedAt`.

**Important**: The ingest log stores the canonical `PostTransformEvent` shape (`provider`, `eventType`, `entity`, `relations`, `attributes`). Old rows from before the entity-oriented redesign carry the old shape (`source`, `sourceType`, `references`, `metadata`). There is no FK linking a `workspace_ingest_log` row to the `workspace_events` row produced from it — correlation requires matching on `sourceId`.

---

### Layer 2 — `workspace_events` (Structured Fact Store)

**File**: `db/console/src/schema/tables/workspace-events.ts:20`
**Written by**: `event-store.ts` Inngest function (`store-observation` step at line 386)

This is the main **queryable** event table. Where the ingest log is append-only and JSONB-heavy, `workspace_events` has typed columns indexed for structured access patterns:

- Time-range queries: `(workspaceId, occurredAt)` at line 141
- Source filtering: `(workspaceId, source, sourceType)` at line 147
- Deduplication: `(workspaceId, sourceId)` at line 154
- Type filtering: `(workspaceId, observationType)` at line 160

**Deduplication happens here** — `event-store.ts:203-219` checks for an existing `sourceId` before inserting. If a duplicate is found, the Inngest function short-circuits and returns `{ status: "duplicate" }`. The ingest log does NOT deduplicate.

**Significance score** lives here as `significanceScore: integer` at line 125. It is computed by `scoreSignificance()` in `scoring.ts` (0-100, rule-based: event weight + signal keywords + relation count + body length). It is stored as metadata but is **not** a gate — all events are stored regardless of score. Notifications are gated at threshold 70 (`notificationDispatch`).

Key columns: `id` (BIGINT), `externalId` (nanoid, for API responses), `workspaceId`, `occurredAt`, `capturedAt`, `observationType`, `title`, `content`, `source`, `sourceType`, `sourceId`, `sourceReferences` (JSONB, typed as `EntityRelation[]`), `metadata` (JSONB), `ingestionSource`, `significanceScore`.

---

### Layer 3a — `workspace_entities` (Entity Registry)

**File**: `db/console/src/schema/tables/workspace-entities.ts:25`
**Written by**: `event-store.ts` `upsert-entities-and-junctions` step (line 430)

This table stores **deduplicated real-world entities** extracted from event content. An "entity" here means a named thing that recurs across events — a PR, an engineer, an API endpoint, a config variable.

**Why it exists separately from `workspace_events`**: One real-world entity (e.g., PR #123) generates many events over its lifetime (`opened`, `review_requested`, `merged`). The events table has one row per event action. The entities table has **one row per unique entity**, deduplicated by `(workspaceId, category, key)` at line 133. This deduplication is enforced at the DB level via `onConflictDoUpdate` which increments `occurrenceCount` and updates `lastSeenAt` on each new event for the same entity.

**Two entity sources**:
1. **Structural entities** (from `PostTransformEvent.entity` and `PostTransformEvent.relations`): `commit`, `branch`, `pr`, `issue`, `deployment`. These come directly from the provider transformer's structured output with `confidence: 1.0` (primary entity) or `0.98` (relations).
2. **Semantic entities** (from regex text extraction on `title` + `body`): `engineer` (`@handle`), `project` (`#123`, `ENG-456`), `endpoint` (`GET /api/users`), `config` (`DATABASE_URL`), `definition` (file paths), `reference` (git hashes, branch names). Extracted by `entity-extraction-patterns.ts`, confidence 0.70–0.95.

Key columns: `id` (BIGINT), `externalId`, `workspaceId`, `category` (typed `EntityCategory`), `key` (canonical entity key, e.g. `"789#123"` for PR), `value`, `aliases`, `evidenceSnippet`, `confidence`, `extractedAt`, `lastSeenAt`, `occurrenceCount`.

**Important limitation**: This table stores entity identity but **not lifecycle state**. You cannot query "all open PRs" because there is no `currentState` column. The state is only derivable by joining back to the most recent event.

---

### Layer 3b — `workspace_entity_events` (Entity↔Event Junction)

**File**: `db/console/src/schema/tables/workspace-entity-events.ts:21`
**Written by**: `event-store.ts` `upsert-entities-and-junctions` step (line 487)

A standard many-to-many junction table between entities and events. It answers two queries:
- "All events that mention entity X" → `WHERE entityId = ?`
- "All entities mentioned in event Y" → `WHERE eventId = ?`

Key columns: `entityId`, `eventId`, `workspaceId`, `refLabel` (contextual relationship label, e.g. `"fixes"`, `"closes"`, `null`).
`refLabel` is set to `entity.value` (which holds the `relationshipType` from the provider relation) for structural types (`commit`, `branch`, `pr`, `issue`, `deployment`) and `null` for all semantic entities.

Unique index: `(entityId, eventId)` — one junction row per entity-event pair. Insert uses `onConflictDoNothing`.

This table is also the input for **graph edge resolution** — `edge-resolver.ts:87` queries it to find "what other events share entities with the current event" (co-occurrence).

---

### Layer 4 — `workspace_edges` (Knowledge Graph)

**File**: `db/console/src/schema/tables/workspace-edges.ts:24`
**Written by**: `edge-resolver.ts:261`, called from the `entityGraph` Inngest function

This table stores directed entity→entity relationships: the knowledge graph. Each row says "entity A has relationship `relationshipType` with entity B, proven by event C".

**How edges are detected** (`edge-resolver.ts:26`): The edge resolver runs on `apps-console/entity.upserted` (after `eventStore` completes). It:
1. Finds structural entities from the current event
2. Queries `workspace_entity_events` for the last 100 events that share any of those entities
3. Loads the entities from those co-occurring events
4. For each `(our entity, their entity)` pair, applies `EdgeRule` definitions from the provider config to find the best matching relationship type
5. Inserts the resulting edges with `onConflictDoNothing`

Edges survive event deletion (`sourceEventId` is `SET NULL` on cascade, line 50) — the graph retains the connection even if the triggering event is deleted.

Key columns: `sourceEntityId`, `targetEntityId`, `relationshipType`, `sourceEventId` (provenance, nullable), `confidence`, `metadata`.
Unique index: `(workspaceId, sourceEntityId, targetEntityId, relationshipType)` — one edge per directed relationship type pair.

Currently, only GitHub defines `EdgeRule` entries (in `github/index.ts:343-369`):
- `commit → deployment` (`"deploys"`, via Vercel co-occurrence)
- `issue → issue` with `selfLabel: "fixes"` (`"fixes"`, confidence 1.0)
- `issue → issue` without label (`"references"`, confidence 0.8)

---

## Full Pipeline Data Flow

```
Webhook arrives
    ↓
[relay] POST /webhooks/:provider
  HMAC verify → parse payload → extract deliveryId/eventType/resourceId
  ├── [service-auth] Redis NX dedup → INSERT gw_webhook_deliveries
  │                  → QStash publish → UPDATE status "enqueued"
  └── [standard]    Upstash Workflow:
                     dedup → INSERT gw_webhook_deliveries → resolve connection
                     → QStash publish → UPDATE status "enqueued"
    ↓
[console] POST /api/gateway/ingress  (QStash delivery, retries=5)
  resolve workspace (clerkOrgId → workspaceId)
  transform: providerDef.events[eventType].transform(payload) → PostTransformEvent
  sanitize URLs
  INSERT workspace_ingest_log               ← Layer 1 (SSE cursor)
  │
  ├── inngest.send "apps-console/event.capture"
  │       ↓
  │   [Inngest] eventStore (event-store.ts:109)
  │     check duplicate (workspaceEvents.sourceId) → exit if dup
  │     check integration allowed
  │     scoreSignificance() → 0-100
  │     extractEntities() + extractFromRelations() → max 50 entities
  │     INSERT workspace_events              ← Layer 2 (structured events)
  │     UPSERT workspace_entities (×N)       ← Layer 3a (entity registry)
  │     INSERT workspace_entity_events (×N)  ← Layer 3b (junction)
  │     send "apps-console/entity.upserted"
  │         ↓
  │     [Inngest] entityGraph (entity-graph.ts:15)
  │       resolveEdges(cooccurrence + EdgeRules)
  │       INSERT workspace_edges             ← Layer 4 (graph)
  │       send "apps-console/entity.graphed"
  │           ↓
  │       [Inngest] entityEmbed (entity-embed.ts:47) — debounced 30s
  │         buildEntityNarrative(entity + events + edges)
  │         embed via Cohere → Pinecone upsert  ← Vector layer (layer="entities")
  │
  └── realtime.emit "workspace.event"        ← SSE push (uses ingest log as cursor)

[QStash callback] POST /admin/delivery-status
  UPDATE gw_webhook_deliveries status "delivered" or "dlq"
```

---

## Architecture Documentation

### Why Not One Table?

Each layer has a distinct reason to be separate:

1. **`gw_webhook_deliveries` vs `workspace_ingest_log`**: The delivery table exists before workspace resolution. A webhook arrives before the system knows which workspace owns it (and might go to DLQ if no workspace is found). The ingest log requires `workspaceId`.

2. **`workspace_ingest_log` vs `workspace_events`**: The ingest log is append-only and stores JSONB blobs for monotonic cursor access. Deduplication, significance scoring, and entity extraction happen **after** the ingest log write, inside Inngest. The structured `workspace_events` table is the output of that processing, optimised for indexed queries. These are the write-side and read-side of a CQRS pattern.

3. **`workspace_events` vs `workspace_entities`**: Events are immutable facts ("PR #123 was merged on Monday"). Entities are deduplicated and accumulated across facts ("PR #123 has been seen 3 times, most recently on Monday"). The entity registry enables the graph layer and vector narratives. Without it, you'd need to group-by across events to derive entity identity.

4. **`workspace_entity_events` (junction) vs direct FK**: A PR event touches a head commit, a merge commit, a source branch, a target branch, and possibly 3 linked issues — all entities. A commit entity can appear in hundreds of events (direct pushes, PR references, deployments). A direct FK in either direction would only allow one-to-one. The junction enables N:M.

5. **`workspace_edges` vs inline `sourceReferences`**: `sourceReferences` in `workspace_events` stores the raw `EntityRelation[]` from the `PostTransformEvent` — provider-reported references. `workspace_edges` stores **inferred** relationships discovered by co-occurrence analysis across multiple events. A GitHub transformer can report "this PR fixes issue #42" (stored in `sourceReferences`). The edge resolver discovers "this commit also deploys to this Vercel deployment" (stored in `workspace_edges`) by finding a Vercel `deployment.succeeded` event that shares the same commit entity.

### CQRS Pattern

The ingest log (`workspace_ingest_log`) and the events table (`workspace_events`) implement a write-side/read-side split:

- **Write side** (ingest log): append-only, JSONB blob, no dedup, monotonic cursor, written synchronously before any Inngest work
- **Read side** (events): structured columns, deduplicated, indexed for query patterns, written asynchronously by Inngest

This is intentional — SSE consumers need the ingest log's monotonic order, while search/UI consumers need the events table's indexed structure.

### Significance as Annotation, Not Gate

The `significanceScore` column is computed at ingestion time and stored on `workspace_events`. It is **not** a storage gate — all events are persisted regardless of score. The score is used:
- In `notificationDispatch` to gate Knock notifications (threshold: 70)
- As a future search ranking signal
- As a metadata field in Pinecone entity vectors (`EntityVectorMetadata.significanceScore`)

Pre-migration rows have `null` for `significanceScore`.

---

## Code References

- `db/console/src/schema/tables/gw-webhook-deliveries.ts:11` — Layer 0 table definition
- `db/console/src/schema/tables/workspace-ingest-log.ts:25` — Layer 1 table definition
- `db/console/src/schema/tables/workspace-events.ts:20` — Layer 2 table definition
- `db/console/src/schema/tables/workspace-entities.ts:25` — Layer 3a table definition
- `db/console/src/schema/tables/workspace-entity-events.ts:21` — Layer 3b junction table
- `db/console/src/schema/tables/workspace-edges.ts:24` — Layer 4 table definition
- `db/console/src/schema/relations.ts:76` — Drizzle ORM relation definitions
- `packages/console-providers/src/post-transform-event.ts:29` — `PostTransformEvent` canonical type
- `packages/console-validation/src/schemas/entities.ts:9` — `EntityCategory` enum (13 values)
- `apps/relay/src/routes/webhooks.ts:45` — Relay webhook entry point
- `apps/relay/src/routes/workflows.ts:39` — Upstash Workflow for standard path
- `apps/console/src/app/api/gateway/ingress/route.ts:28` — Console ingress (QStash destination)
- `api/console/src/inngest/workflow/neural/event-store.ts:109` — eventStore Inngest function
- `api/console/src/inngest/workflow/neural/event-store.ts:203` — duplicate check step
- `api/console/src/inngest/workflow/neural/event-store.ts:342` — extractEntities step
- `api/console/src/inngest/workflow/neural/event-store.ts:380` — store-observation step (writes workspace_events)
- `api/console/src/inngest/workflow/neural/event-store.ts:419` — upsert-entities-and-junctions step
- `api/console/src/inngest/workflow/neural/event-store.ts:516` — emit-downstream-events step
- `api/console/src/inngest/workflow/neural/entity-graph.ts:15` — entityGraph Inngest function
- `api/console/src/inngest/workflow/neural/edge-resolver.ts:26` — resolveEdges function
- `api/console/src/inngest/workflow/neural/entity-embed.ts:47` — entityEmbed Inngest function (30s debounce)
- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:17` — 8 regex extraction patterns
- `api/console/src/inngest/workflow/neural/scoring.ts:90` — scoreSignificance function
- `api/console/src/inngest/workflow/neural/narrative-builder.ts:31` — buildEntityNarrative function
- `packages/console-providers/src/providers/github/index.ts:343` — GitHub EdgeRule definitions (3 rules)

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-03-13-observation-pipeline-architecture.md` — Full 4-layer redesign proposal: Entity Store → Graph Layer → Vector Layer → Observation Layer. Introduced the `domainEntityId` concept (stripping action suffix from sourceId). Proposed `workspaceSourceEntities` with `currentState` state machine (not yet implemented at DB level).

- `thoughts/shared/plans/2026-03-13-entity-system-implementation.md` — Implementation plan for the entity-oriented `PostTransformEvent` redesign. Introduced `entity`/`relations`/`attributes` fields replacing `source`/`references`/`metadata`. Removed the old `observation.interpret` LLM classification step.

- `thoughts/shared/plans/2026-03-14-pipeline-simplification.md` — Documents the removal of `workspaceInterpretations` table and `eventInterpret` Inngest function. Significance score changed from a storage gate (threshold=40) to a stored annotation. `workspaceKnowledgeDocuments` and `workspaceKnowledgeVectorChunks` also dropped.

- `thoughts/shared/plans/2026-03-14-drop-event-interpret-layer.md` — Specific plan for removing the `eventInterpret` Inngest function. This function previously ran Claude Haiku LLM classification + produced 3 Pinecone vectors per event. Removed as write-only (search never queried the `layer="observations"` vectors).

---

## Related Research

- `thoughts/shared/research/2026-03-14-inngest-pipeline-search-architecture-audit.md` — Audit of the full pipeline and search system

---

## Open Questions

1. **Entity state machine**: `workspaceEntities` has no `currentState` column. "All open PRs" cannot be answered with a simple query. The proposed `workspaceSourceEntities` + `workspaceEntityTransitions` migration (from the architecture doc) has not been applied.

2. **Ingest log → events traceability**: There is no FK from `workspace_ingest_log` to `workspace_events`. Correlating "which ingest log entry produced which event" requires matching on `sourceId`.

3. **Cross-provider edge rules**: Sentry issue ↔ GitHub commit (`resolved_by`) and Linear issue ↔ GitHub PR (`tracked_in`) edge rules were removed in the entity system redesign. Only 3 GitHub-specific edge rules currently exist.

4. **Actor identity**: `engineer` entities are regex-extracted `@handle` strings with no mapping to Clerk user IDs, Linear user IDs, or Sentry user IDs. Cross-source "what did user X do" queries are not possible today.

5. **Schema compatibility for old ingest log rows**: Old `workspace_ingest_log.sourceEvent` rows carry the pre-redesign shape. UI consumers or API handlers that parse this JSONB need to handle both shapes.

---

## Efficiency Evaluation

### Overall verdict

The layer structure is **sound in concept** — the CQRS split is justified, the BIGINT PK cursor is correct, and the entity deduplication model is solid. But there are concrete inefficiencies across write amplification, traceability, entity quality, edge reinforcement, and query scaling that will compound as volume grows.

### Problem 1 — Ingest log writes before dedup: phantom SSE events

**Severity**: Medium

The ingest log is written synchronously in the ingress route (`route.ts:71`) before Inngest fires. Deduplication only runs inside `eventStore` (`event-store.ts:203-219`). Result: when a backfill and a live webhook deliver the same logical event (same `sourceId`, different `deliveryId`), both write to `workspace_ingest_log` but only one produces a `workspace_events` row. SSE consumers replaying via `Last-Event-ID` receive ingest log rows that have no corresponding `workspace_events` row — they can't resolve them without a fallback query.

Additionally, there is no FK linking the ingest log row to the `workspace_events` row it produces. The only correlation path is a string join on `sourceId`, which is a varchar(255) equality scan across two large tables.

### Problem 2 — Denormalized noise on ingest log

**Severity**: Low-Medium

`workspace_ingest_log` carries two denormalized columns — `source VARCHAR(50)` and `sourceType VARCHAR(100)` — with an index `workspace_event_source_idx` on `(workspaceId, source, sourceType)`. The SSE catch-up query only uses `(workspaceId, id)`. No consumer filters the ingest log by source type — that filtering happens on `workspace_events`. These two columns and their index exist on every ingest log row without serving any query.

### Problem 3 — Full JSONB duplication across both tables

**Severity**: Low-Medium

`workspace_ingest_log.sourceEvent` stores the complete `PostTransformEvent` (~1–10 KB JSONB). `workspace_events` then extracts and stores the same information as typed columns (`title`, `content`, `source`, `sourceType`, `sourceId`, `sourceReferences`, `metadata`). For a workspace at 100K events, both tables hold materially equivalent data in different shapes. The ingest log JSONB is not queried structurally — it is only used as the SSE replay payload.

### Problem 4 — No lifecycle state on workspace_entities

**Severity**: High (feature gap)

`workspace_entities` stores entity identity (`category`, `key`, `occurrenceCount`) but not entity state. A PR entity has `category: "pr"`, `key: "789#123"` with `occurrenceCount: 4` — but no `currentState: "merged"`. To answer "show all open PRs for this workspace", you must join `workspace_entities → workspace_entity_events → workspace_events`, take the latest event per entity via a window function, and filter by `observationType`. That is a 3-table join with a subquery on every call.

The `PostTransformEvent.entity.state` field already carries this value from the provider transformer — it is discarded at the Inngest layer and never persisted.

### Problem 5 — Semantic entity noise and junction inflation

**Severity**: Medium

Every event runs 8 regexes on `title + body` and writes up to 50 entities. The lowest-confidence category — `reference` (git hashes) — has confidence 0.70. These hashes are already represented as structural `commit` entities (from `PostTransformEvent.entity`) at confidence 1.0, making the regex-extracted duplicates redundant. At 50 entities per event and 1M events, `workspace_entity_events` grows to ~15M junction rows, the majority of which are semantic entities never used by the edge resolver.

The edge resolver (`edge-resolver.ts:33-38`) filters to structural types immediately and discards all semantic entities from its computation. Semantic entities only appear in entity narratives and future search enrichment — but even there, regex-extracted git hashes add noise rather than signal.

### Problem 6 — Edge confidence is frozen at first detection

**Severity**: Low-Medium

`workspace_edges` uses `onConflictDoNothing` (`edge-resolver.ts:261`). When the same edge is confirmed by a second, third, or tenth event (e.g., the same commit entity co-occurring with the same deployment entity again), the conflict is silently ignored. Confidence stays at the initial value. `sourceEventId` stays anchored to the first event that created the edge, aging out as newer confirmations arrive. The knowledge graph never gets stronger even as evidence accumulates.

### Problem 7 — Edge resolver co-occurrence query scales poorly for hot structural entities

**Severity**: Low now, High at volume

The edge resolver queries `workspace_entity_events WHERE entityId IN (structural entities) AND eventId != ? ORDER BY eventId DESC LIMIT 100` (`edge-resolver.ts:87`). For structural entities like `branch:main` in a busy monorepo, this index scan touches thousands of rows before the `LIMIT 100` applies. The result is then input to a second query loading all entities for those 100 co-events — an `O(co-events × entities)` cross-product. There is no short-circuit for entity pairs whose edges already exist.

### Summary Table

| Problem | Layer | Severity | Core Impact |
|---|---|---|---|
| Ingest log writes before dedup → phantom SSE rows | L1 | Medium | SSE consumers see unresolvable events |
| Denormalized `source`/`sourceType` on ingest log | L1 | Low-Medium | Storage waste, misleading index |
| Full JSONB duplication (ingest log + events) | L1 + L2 | Low-Medium | Storage overhead at scale |
| No `currentState` on entities | L3a | High | State queries require 3-table window joins |
| Semantic entity noise + junction inflation | L3a + L3b | Medium | Noisy registry, junction grows 10–50× events |
| Edge confidence never reinforced | L4 | Low-Medium | Graph accuracy doesn't improve over time |
| Edge resolver co-occurrence scales poorly | L4 | Low → High | Hot entities cause wide index scans |

---

## Optimal Architecture Design

### Design principles

1. **Dedup as early as possible** — don't write what you'll later discard
2. **Bidirectional traceability** — every layer links to its neighbours via FK
3. **SSE cursor correctness** — only resolved events appear in the catch-up stream
4. **Entity lifecycle completeness** — state is queryable without joins to events
5. **Write exactly once per semantic entity** — confidence threshold gates storage
6. **Graph confidence is monotonically increasing** — repeated evidence reinforces edges
7. **Edge resolver skips known edges** — idempotency check before co-occurrence scan

---

### Layer 1 — workspace_ingest_log (proposed changes)

**Schema changes:**

```typescript
// REMOVE
source: varchar("source", { length: 50 }),       // unused for SSE cursor scans
sourceType: varchar("source_type", { length: 100 }), // unused for SSE cursor scans

// ADD
eventId: bigint("event_id", { mode: "number" })
  .references(() => workspaceEvents.id, { onDelete: "set null" }),
// nullable — null means "received but not yet processed by Inngest"
// backfilled by eventStore after workspace_events INSERT

// ADD INDEX
workspaceEventIdIdx: index("ingest_log_workspace_event_id_idx").on(
  table.workspaceId,
  table.eventId
),
// enables: WHERE workspace_id = ? AND event_id IS NULL (unprocessed monitoring)
```

**Code change — upstream logical dedup** (`apps/console/src/app/api/gateway/ingress/route.ts`):

Before writing to `workspace_ingest_log`, add a Redis NX check on `{workspaceId}:{sourceId}`. This prevents the backfill+webhook phantom row scenario where two different `deliveryId`s carry the same `sourceId`:

```typescript
// Before INSERT workspace_ingest_log:
const sourceId = transformedEvent.sourceId;
const deduped = await redis.set(
  `ingest:logical:${workspaceId}:${sourceId}`,
  "1",
  { nx: true, ex: 86_400 }
);
if (!deduped) {
  // Logical duplicate — ack to QStash (no retry), skip ingest log write
  return c.json({ status: "duplicate" });
}
// Proceed with INSERT workspace_ingest_log
```

**Code change — backfill event_id** (`api/console/src/inngest/workflow/neural/event-store.ts`):

In the `store-observation` step, after inserting into `workspace_events`, update the corresponding ingest log row:

```typescript
// After workspace_events INSERT returning { id }:
await db
  .update(workspaceIngestLog)
  .set({ eventId: observation.id })
  .where(
    and(
      eq(workspaceIngestLog.workspaceId, workspaceId),
      eq(workspaceIngestLog.deliveryId, sourceEvent.deliveryId)
    )
  );
```

**Result**: The ingest log is now a clean, minimal monotonic log. SSE consumers filter by `event_id IS NOT NULL` for fully-processed events, or include `IS NULL` rows to show a "processing" indicator. Phantom rows from logical duplicates are eliminated.

**New minimal ingest log shape:**

| Column | Type | Purpose |
|---|---|---|
| `id` | BIGINT identity | SSE monotonic cursor |
| `workspace_id` | varchar(191) | FK |
| `delivery_id` | varchar(191) | Trace to relay |
| `source_event` | JSONB | Full `PostTransformEvent` for SSE payload |
| `ingestion_source` | varchar(20) | webhook / backfill / api |
| `received_at` | TIMESTAMPTZ | When relay received the webhook |
| `event_id` | BIGINT NULL FK | → `workspace_events.id`, backfilled by Inngest |

---

### Layer 2 — workspace_events (proposed changes)

**Schema change — add ingest log FK:**

```typescript
// ADD
ingestLogId: bigint("ingest_log_id", { mode: "number" })
  .references(() => workspaceIngestLog.id, { onDelete: "set null" }),
// Enables: workspace_events → workspace_ingest_log direct FK join
// Written at eventStore insert time (pass ingest log ID through Inngest event payload)
```

To populate this, the `PostTransformEvent` carries `deliveryId`, which maps 1:1 to `workspace_ingest_log.deliveryId`. The ingress route can pass the ingest log `id` through the Inngest event payload (`event.data.ingestLogId`), so `eventStore` has it without a round-trip query.

**No other schema changes.** `sourceReferences JSONB` is a justified denormalization — it enables single-query API responses for event detail views without joining the junction table.

---

### Layer 3a — workspace_entities (proposed changes)

**Schema changes:**

```typescript
// ADD
currentState: varchar("current_state", { length: 50 }),
// e.g., "open", "merged", "closed", "succeeded", "failed"
// Populated from PostTransformEvent.entity.state for structural types
// Null for semantic entities (engineer, endpoint, config, etc.)

stateChangedAt: timestamp("state_changed_at", {
  mode: "string",
  withTimezone: true,
}),
// When currentState was last updated — enables "changed in last 24h" queries

domainEntityId: varchar("domain_entity_id", { length: 255 }),
// Format: "{provider}:{entityType}:{entityId}"
// e.g., "github:pr:789#123" — stable key stripped of action suffix
// Distinct from sourceId which carries the action (e.g., "github:pr:789#123:merged")

// ADD INDEX
domainEntityIdx: uniqueIndex("entity_domain_entity_idx").on(
  table.workspaceId,
  table.domainEntityId
),
// Enables fast cross-event entity lookups without category+key composite
```

**Code change — upsert-entities-and-junctions** (`event-store.ts:430`):

On the `onConflictDoUpdate` for structural entities, also update `currentState` and `stateChangedAt`:

```typescript
set: {
  lastSeenAt: sql`CURRENT_TIMESTAMP`,
  occurrenceCount: sql`${workspaceEntities.occurrenceCount} + 1`,
  updatedAt: sql`CURRENT_TIMESTAMP`,
  // NEW — only update state if entity is structural:
  ...(STRUCTURAL_TYPES.has(entity.category) && entity.state
    ? {
        currentState: entity.state,          // from sourceEvent.entity.state
        stateChangedAt: sql`CURRENT_TIMESTAMP`,
      }
    : {}),
},
```

**Code change — confidence threshold** (`event-store.ts:342`):

Gate entity writes at confidence ≥ 0.80. This eliminates `reference` category (git hashes at 0.70) which are already represented as structural `commit` entities:

```typescript
const filteredEntities = deduplicatedEntities.filter(
  e => e.confidence >= 0.80
);
// Structural entities are always ≥ 0.95 — unaffected.
// Eliminates: reference category (0.70), some definition entries (borderline 0.80)
```

**Query enabled by these changes:**

```sql
-- "All open PRs in workspace X" — now a single-table scan
SELECT * FROM workspace_entities
WHERE workspace_id = ?
  AND category = 'pr'
  AND current_state = 'open'
ORDER BY last_seen_at DESC;
```

---

### Layer 3b — workspace_entity_events (proposed changes)

**Schema change — add denormalized category:**

```typescript
// ADD
entityCategory: varchar("entity_category", { length: 50 })
  .notNull()
  .$type<EntityCategory>(),
// Denormalized from workspace_entities.category at junction insert time
// Eliminates the entity lookup step in edge resolver

// ADD INDEX
categoryEntityIdx: index("ee_category_entity_idx").on(
  table.workspaceId,
  table.entityCategory,
  table.entityId
),
```

**Code change — skip `reference` category junction writes** (`event-store.ts:465`):

```typescript
// Only write junction rows for non-reference entities
// reference entities (git hashes) are redundant with structural commit entities
const junctionEntities = entityResults.filter(
  ([entity]) => entity.category !== "reference"
);
```

**Result**: The edge resolver can now query by `entityCategory` on the junction table directly, eliminating the prior two-query pattern (entity lookup → junction lookup). The structural entity filter becomes:

```typescript
// OLD: 2 queries
// 1. SELECT id FROM workspace_entities WHERE category IN (structural) AND key IN (refs)
// 2. SELECT * FROM workspace_entity_events WHERE entityId IN (those IDs)

// NEW: 1 query
const coOccurrences = await db
  .select()
  .from(workspaceEntityEvents)
  .where(
    and(
      eq(workspaceEntityEvents.workspaceId, workspaceId),
      inArray(workspaceEntityEvents.entityCategory, STRUCTURAL_TYPES),
      eq(workspaceEntityEvents.eventId, eventId),
    )
  );
```

---

### Layer 4 — workspace_edges (proposed changes)

**Schema changes:**

```typescript
// ADD
reinforcementCount: integer("reinforcement_count").default(1).notNull(),
// Incremented each time this edge is re-detected from a new event

lastSeenAt: timestamp("last_seen_at", {
  mode: "string",
  withTimezone: true,
})
  .default(sql`CURRENT_TIMESTAMP`)
  .notNull(),
// When was this edge most recently confirmed
```

**Code change — reinforcing conflict strategy** (`edge-resolver.ts:248`):

Replace `onConflictDoNothing` with `onConflictDoUpdate`:

```typescript
.onConflictDoUpdate({
  target: [
    workspaceEdges.workspaceId,
    workspaceEdges.sourceEntityId,
    workspaceEdges.targetEntityId,
    workspaceEdges.relationshipType,
  ],
  set: {
    // Exponential approach to 1.0: each reinforcement closes 10% of remaining gap
    confidence: sql`LEAST(1.0, ${workspaceEdges.confidence} + (1.0 - ${workspaceEdges.confidence}) * 0.1)`,
    reinforcementCount: sql`${workspaceEdges.reinforcementCount} + 1`,
    lastSeenAt: sql`CURRENT_TIMESTAMP`,
    sourceEventId: sql`EXCLUDED.source_event_id`, // update provenance to latest event
  },
})
```

**Code change — idempotency short-circuit** (`edge-resolver.ts:26`):

Before running the co-occurrence scan, check which structural entity pairs already have edges at high confidence. Skip co-occurrence entirely for pairs where all edges are already established:

```typescript
// Step 0 (new): check existing edges for this event's structural entities
const existingEdges = await db
  .select({
    sourceEntityId: workspaceEdges.sourceEntityId,
    targetEntityId: workspaceEdges.targetEntityId,
    relationshipType: workspaceEdges.relationshipType,
    confidence: workspaceEdges.confidence,
  })
  .from(workspaceEdges)
  .where(
    and(
      eq(workspaceEdges.workspaceId, workspaceId),
      or(
        inArray(workspaceEdges.sourceEntityId, structuralEntityIds),
        inArray(workspaceEdges.targetEntityId, structuralEntityIds)
      )
    )
  );

const existingEdgeKeys = new Set(
  existingEdges
    .filter(e => e.confidence >= 0.95)
    .map(e => `${e.sourceEntityId}-${e.targetEntityId}-${e.relationshipType}`)
);

// Still run co-occurrence, but skip candidate insertion for known high-confidence edges
// This means the expensive query still runs but INSERT becomes a cheap NOP for known pairs
// Future: if ALL possible pairs for these entities are known, skip co-occurrence entirely
```

The full skip optimization (skipping the co-occurrence query entirely when all pairs are known) requires knowing the complete set of possible entity pair combinations upfront — complex to implement correctly. The above partial optimization is the right first step: it eliminates the INSERT work for mature edges and lets the `reinforcementCount` update handle the rest.

---

### Proposed architecture: before vs. after

**Before (current write path per event):**

```
ingress → workspace_ingest_log (full JSONB + denorm cols)        [sync]
        → Inngest event.capture
            → check duplicate (workspace_events.sourceId)
            → workspace_events INSERT                             [async]
            → workspace_entities UPSERT ×N (up to 50)            [async]
            → workspace_entity_events INSERT ×N (up to 50)       [async]
        → entity.upserted
            → workspace_entity_events JOIN workspace_entities     [2 queries]
            → workspace_edges INSERT onConflictDoNothing          [no reinforcement]
        → entity.graphed (debounced 30s)
            → Pinecone upsert
```

**After (optimal write path per event):**

```
ingress → Redis NX {workspaceId}:{sourceId}                      [dedup gate, sync]
        → workspace_ingest_log (minimal: id, deliveryId, JSONB)  [sync, no phantom rows]
        → Inngest event.capture (carries ingestLogId)
            → workspace_events INSERT (sets ingest_log_id)        [async]
            → workspace_ingest_log UPDATE (sets event_id)         [async, closes bidirectional FK]
            → workspace_entities UPSERT ×N (confidence ≥ 0.80)   [async, ~30% fewer rows]
              → sets currentState + stateChangedAt for structural
            → workspace_entity_events INSERT ×N (no `reference`)  [async, ~20% fewer rows]
              → includes entityCategory column
        → entity.upserted
            → workspace_entity_events WHERE entityCategory IN (…) [1 query, was 2]
            → workspace_edges INSERT onConflictDoUpdate            [reinforces confidence]
        → entity.graphed (debounced 30s)
            → Pinecone upsert
```

---

### Migration plan

All changes are non-destructive and can be applied incrementally. Ordered by risk and dependency:

**Phase 1 — Ingest log cleanup** (schema + code, low risk)
1. Add `event_id BIGINT NULL` to `workspace_ingest_log` (nullable, no data migration)
2. Add `ingest_log_id BIGINT NULL` to `workspace_events` (nullable, no data migration)
3. Pass `ingestLogId` through Inngest event payload in ingress route
4. Add backfill update in `eventStore` after `workspace_events` INSERT
5. Drop `source`, `sourceType` columns from `workspace_ingest_log` after verifying no consumers
6. Add Redis NX dedup on `{workspaceId}:{sourceId}` in ingress route

**Phase 2 — Entity lifecycle state** (schema + code, medium risk)
1. Add `current_state`, `state_changed_at`, `domain_entity_id` columns to `workspace_entities`
2. Add `domain_entity_id` unique index
3. Update `upsert-entities-and-junctions` to set `currentState` from `entity.state`
4. Add confidence threshold (≥ 0.80) to entity extraction filter

**Phase 3 — Junction table denormalization** (schema + code, low risk)
1. Add `entity_category VARCHAR(50)` to `workspace_entity_events`
2. Backfill via `UPDATE junction SET entity_category = entities.category FROM workspace_entities WHERE junction.entity_id = entities.id`
3. Add `(workspaceId, entityCategory, entityId)` index
4. Update edge resolver to use single-query path
5. Add `reference` category filter to junction write in `eventStore`

**Phase 4 — Edge reinforcement** (schema + code, low risk)
1. Add `reinforcement_count`, `last_seen_at` to `workspace_edges`
2. Change `onConflictDoNothing` → `onConflictDoUpdate` with confidence formula
3. Add idempotency short-circuit in edge resolver

All phases generate DB migrations via `pnpm db:generate`. No data is deleted in any phase — only columns added and conflict strategies updated.
