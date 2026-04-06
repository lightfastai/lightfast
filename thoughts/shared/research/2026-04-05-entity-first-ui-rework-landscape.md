---
date: 2026-04-05T12:00:00+08:00
researcher: claude
git_commit: d8b67027996b0fabba0fbf98863e82eb19a8af62
branch: main
topic: "Entity-first UI rework: Events/Jobs → Entities landscape research"
tags: [research, codebase, entities, events, jobs, manage-ui, neural-pipeline, entity-graph]
status: complete
last_updated: 2026-04-05
last_updated_note: "Resolved all open questions with user decisions"
---

# Research: Entity-First UI Rework — Current Landscape

**Date**: 2026-04-05
**Git Commit**: d8b67027996b0fabba0fbf98863e82eb19a8af62
**Branch**: main

## Research Question

The user wants to rework the Events page and remove the Jobs page in favor of an Entity-first UI. The idea: instead of listing raw events and workflow runs, show a list of observed Entities. Opening an entity reveals its events. Jobs become internal/admin. This research documents everything that currently exists across entities, events, jobs, navigation, and the neural pipeline to inform that rework.

## Summary

The codebase has a **mature entity backend** (schema, upsert pipeline, graph edges, Pinecone embeddings) but **no dedicated entity UI**. Entities currently surface only through the search API (Pinecone vector search → `SearchResultCard`) and as raw JSON in the event detail expansion panel. Meanwhile, the Events page reads from `orgIngestLogs` (raw webhook logs), not from `orgEvents` (the enriched neural store that links to entities). The Jobs page is purely a viewer for `orgWorkflowRuns` Inngest execution records. The entity system already has everything needed to power an entity-first UI — the gap is exclusively at the tRPC API and UI layer.

## Detailed Findings

### 1. Current Navigation Structure

The `(manage)` route group under `apps/app/src/app/(app)/(org)/[slug]/(manage)/` currently has four sections:

| Route | Sidebar Label | Purpose |
|---|---|---|
| `/{slug}/events` | Events | Raw webhook event feed from `orgIngestLogs` |
| `/{slug}/sources` | Sources | Connection management (OAuth integrations) |
| `/{slug}/jobs` | Jobs | Inngest workflow execution viewer |
| `/{slug}/settings` | Settings | Org settings + API keys |

Navigation is defined in two pure functions in [`apps/app/src/components/app-sidebar.tsx:39-74`](https://github.com/lightfastai/lightfast/blob/d8b67027996b0fabba0fbf98863e82eb19a8af62/apps/app/src/components/app-sidebar.tsx#L39-L74):
- `getOrgPrimaryItems(orgSlug)` → Ask, Search
- `getOrgManageItems(orgSlug)` → Events, Sources, Jobs, Settings

The `(manage)/layout.tsx` is a thin wrapper (max-w-5xl container, no nav).

### 2. Events System — Current State

**What the UI shows:** Raw webhook ingest logs from `orgIngestLogs`, not the enriched `orgEvents` table.

**API:** Single procedure `events.list` at [`api/app/src/router/org/events.ts:10-79`](https://github.com/lightfastai/lightfast/blob/d8b67027996b0fabba0fbf98863e82eb19a8af62/api/app/src/router/org/events.ts#L10-L79). Queries `orgIngestLogs` with filters on provider (JSONB `sourceEvent->>'provider'`), cursor-based pagination (keyset on `id DESC`), optional search (ilike on title/eventType), and receivedAfter.

**UI Components** (4 files in `events/_components/`):
- `events-table.tsx` — Client component with `useSuspenseQuery`, Upstash Realtime live prepend, "Load More" pagination, debounced search
- `event-row.tsx` — Row with provider icon, title, event type badge, relative time, expandable detail
- `event-detail.tsx` — Inline panel showing `sourceEvent.body`, `entity` (entityType/entityId/state), `relations` array, `attributes`, timestamps
- `use-event-filters.ts` — URL-synced filters via `nuqs` (source, search, age)

**Layout prefetch:** `events/layout.tsx` prefetches `trpc.events.list` for 5 source variants (undefined, github, vercel, linear, sentry) and wraps children in `<HydrateClient>` + `<RealtimeProviderWrapper>`.

**Key insight:** The events UI displays pre-storage `sourceEvent` data (from `orgIngestLogs`), not post-pipeline enriched data. The `event-detail.tsx` shows `sourceEvent.entity` and `sourceEvent.relations` — these are the raw provider-transformed shapes, not the upserted `orgEntities` records.

### 3. Jobs System — Current State

**What the UI shows:** Inngest workflow execution records from `orgWorkflowRuns`.

**Schema:** [`db/app/src/schema/tables/org-workflow-runs.ts`](https://github.com/lightfastai/lightfast/blob/d8b67027996b0fabba0fbf98863e82eb19a8af62/db/app/src/schema/tables/org-workflow-runs.ts) — standalone denormalized table with status (queued/running/completed/failed/cancelled), trigger type, JSONB input/output, duration tracking.

**API:** Single procedure `jobs.list` at [`api/app/src/router/org/jobs.ts:16-59`](https://github.com/lightfastai/lightfast/blob/d8b67027996b0fabba0fbf98863e82eb19a8af62/api/app/src/router/org/jobs.ts#L16-L59). Cursor-based pagination on `createdAt DESC`.

**UI:** `JobsTable` at [`apps/app/src/components/jobs-table.tsx`](https://github.com/lightfastai/lightfast/blob/d8b67027996b0fabba0fbf98863e82eb19a8af62/apps/app/src/components/jobs-table.tsx) — tabs for all/running/completed/failed, 5s polling when jobs are running, client-side search filter, expandable error/output detail.

**Creation:** Jobs are created exclusively by `platformEventStore` Inngest function (`api/platform/src/inngest/functions/platform-event-store.ts:140`) — one job per `platform/event.capture` event. The on-failure handler marks jobs as failed.

**Job-Event relationship:** No FK between `orgWorkflowRuns` and `orgEvents`. Correlation is implicit via `sourceId` in the job's input JSONB.

### 4. Entity System — Current State

#### 4a. Schema (fully built)

**`orgEntities`** ([`db/app/src/schema/tables/org-entities.ts`](https://github.com/lightfastai/lightfast/blob/d8b67027996b0fabba0fbf98863e82eb19a8af62/db/app/src/schema/tables/org-entities.ts)) — Deduplicated by `(clerkOrgId, category, key)`. Tracks category, key, value, aliases, confidence, state, url, occurrenceCount, lastSeenAt.

**`orgEntityEdges`** ([`db/app/src/schema/tables/org-entity-edges.ts`](https://github.com/lightfastai/lightfast/blob/d8b67027996b0fabba0fbf98863e82eb19a8af62/db/app/src/schema/tables/org-entity-edges.ts)) — Directed entity-to-entity edges with relationshipType, confidence, sourceEventId provenance.

**`orgEventEntities`** ([`db/app/src/schema/tables/org-event-entities.ts`](https://github.com/lightfastai/lightfast/blob/d8b67027996b0fabba0fbf98863e82eb19a8af62/db/app/src/schema/tables/org-event-entities.ts)) — Many-to-many junction linking entities to events. Has `refLabel` for contextual relationship and `category` denormalized for join-free edge resolution.

#### 4b. Entity Categories

12 categories defined in [`packages/app-validation/src/schemas/entities.ts:9`](https://github.com/lightfastai/lightfast/blob/d8b67027996b0fabba0fbf98863e82eb19a8af62/packages/app-validation/src/schemas/entities.ts#L9):

**Structural** (participate in graph edge resolution): `commit`, `branch`, `pr`, `issue`, `deployment`

**Semantic** (text-extracted): `engineer`, `project`, `endpoint`, `config`, `definition`, `service`, `reference`

#### 4c. tRPC API (missing)

**There is no entity tRPC router.** The `api/app/src/router/org/` directory contains `connections.ts`, `events.ts`, `jobs.ts`, `org-api-keys.ts` — no `entities.ts`.

Entity data surfaces only through:
1. **Search API** (`apps/app/src/lib/search.ts`) — Pinecone vector search returning `SearchResult` shapes (entityExternalId, title, snippet, score, source, type)
2. **Event detail panel** — displays raw `sourceEvent.entity`/`sourceEvent.relations` from `orgIngestLogs`, not from `orgEntities`

#### 4d. Entity UI (none)

No entity list page, entity detail page, or entity card components exist. The only entity-related UI is:
- `search-result-card.tsx` — renders Pinecone search results (indirect entity representation)
- `event-detail.tsx` — shows raw pre-upsert entity/relations from the ingest log

### 5. Neural Pipeline — Entity Lifecycle

The pipeline is fully operational, running entirely on rule-based logic (no LLM):

```
POST /api/ingest/:provider
  → gatewayWebhookDeliveries (status: received)
  → Inngest: platform/webhook.received
    → ingestDelivery
        → orgIngestLogs (← what Events UI reads)
        → Upstash Realtime push (← live SSE to Events UI)
        → platform/event.capture
          → platformEventStore
              → orgEvents (enriched event record)
              → orgEntities (upsert, deduplicated by org+category+key)
              → orgEventEntities (junction rows)
              → platform/entity.upserted
              → platform/event.stored → notification dispatch
          → platformEntityGraph (from entity.upserted)
              → orgEntityEdges (co-occurrence based)
              → platform/entity.graphed
                → platformEntityEmbed
                    → Cohere embed → Pinecone upsert (ent_{externalId})
```

Key data already available per entity:
- `category`, `key`, `value`, `state`, `url`
- `occurrenceCount`, `lastSeenAt`, `confidence`
- Graph edges (directed, with relationshipType and confidence)
- All linked events (via `orgEventEntities` junction)
- Pinecone vector with narrative embedding (identity + genesis + temporal span + recent events + graph edges)

### 6. Database Relationships

```
orgIngestLogs ← (what Events UI currently reads)
  ↓ (ingestLogId FK)
orgEvents ← (enriched store, has significanceScore, observationType)
  ↕ orgEventEntities (junction, many-to-many)
orgEntities ← (deduplicated, with occurrenceCount, lastSeenAt, state)
  ↕ orgEntityEdges (directed graph, entity-to-entity)

orgWorkflowRuns ← (what Jobs UI reads, standalone, no FK to events/entities)
```

### 7. What Exists vs What's Missing for Entity-First UI

| Component | Status | Notes |
|---|---|---|
| Entity DB schema | Complete | `orgEntities`, `orgEntityEdges`, `orgEventEntities` all production-ready |
| Entity upsert pipeline | Complete | Rule-based extraction, dedup, graph, embed |
| Entity categories/types | Complete | 12 categories, structural vs semantic split |
| Entity-event junction | Complete | Many-to-many with refLabel and denormalized category |
| Entity graph edges | Complete | Directed edges with co-occurrence detection and provider rules |
| Entity vectors in Pinecone | Complete | Narrative-based embeddings with rich metadata |
| **Entity tRPC router** | **Missing** | No `entities.list`, `entities.get`, `entities.getEvents` |
| **Entity list page** | **Missing** | No `/{slug}/entities` route |
| **Entity detail page** | **Missing** | No `/{slug}/entities/[entityId]` route |
| **Entity list components** | **Missing** | No EntityCard, EntityList, EntityTable |
| **Entity detail components** | **Missing** | No EntityTimeline, EntityGraph, EntityEvents |

## Code References

### Schema
- `db/app/src/schema/tables/org-entities.ts` — Entity table (category, key, value, state, occurrenceCount)
- `db/app/src/schema/tables/org-entity-edges.ts` — Entity-to-entity directed edges
- `db/app/src/schema/tables/org-event-entities.ts` — Event↔Entity junction table
- `db/app/src/schema/tables/org-events.ts` — Enriched event store (observationType, significanceScore)
- `db/app/src/schema/tables/org-ingest-logs.ts` — Raw webhook ingest logs (what Events UI reads)
- `db/app/src/schema/tables/org-workflow-runs.ts` — Job execution records
- `db/app/src/schema/relations.ts:55-88` — Drizzle relations for events↔entities↔edges

### API
- `api/app/src/router/org/events.ts:10-79` — `events.list` (reads orgIngestLogs)
- `api/app/src/router/org/jobs.ts:16-59` — `jobs.list` (reads orgWorkflowRuns)
- `api/app/src/root.ts:23-24` — Router registration (events, jobs)
- `apps/app/src/lib/search.ts:15-129` — Search API (Pinecone entity vectors)

### Events UI
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/events/page.tsx`
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/events/layout.tsx`
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/events/_components/events-table.tsx`
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/events/_components/event-row.tsx`
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/events/_components/event-detail.tsx`
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/events/_components/use-event-filters.ts`

### Jobs UI
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/jobs/page.tsx`
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/jobs/layout.tsx`
- `apps/app/src/components/jobs-table.tsx` — JobsTable, JobRow, EmptyState
- `apps/app/src/components/use-job-filters.ts`

### Navigation
- `apps/app/src/components/app-sidebar.tsx:39-74` — `getOrgManageItems()` defines Events/Sources/Jobs/Settings nav
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/layout.tsx` — Thin wrapper (no nav)

### Pipeline
- `apps/platform/src/app/api/ingest/[provider]/route.ts` — Webhook entry point
- `api/platform/src/inngest/functions/ingest-delivery.ts` — Transform + orgIngestLogs insert
- `api/platform/src/inngest/functions/platform-event-store.ts` — Event + entity upsert
- `api/platform/src/inngest/functions/platform-entity-graph.ts` — Edge resolution
- `api/platform/src/inngest/functions/platform-entity-embed.ts` — Pinecone vector upsert
- `api/platform/src/lib/entity-extraction-patterns.ts` — Regex entity extractors
- `api/platform/src/lib/edge-resolver.ts` — Co-occurrence edge algorithm
- `api/platform/src/lib/narrative-builder.ts` — Entity narrative for embedding
- `api/platform/src/lib/scoring.ts` — Significance scoring

### Validation
- `packages/app-validation/src/schemas/entities.ts:9-26` — EntityCategory enum (12 types)
- `packages/app-validation/src/schemas/neural.ts:21-46` — EntityVectorMetadata
- `packages/app-validation/src/schemas/job.ts` — JobStatus, JobTrigger, job schemas

## Architecture Documentation

### Current Data Flow (Events UI reads raw logs, not entities)
```
Webhook → orgIngestLogs → tRPC events.list → EventsTable (UI)
                ↓
           orgEvents → orgEntities → orgEntityEdges → Pinecone
                         (enriched pipeline, not exposed to UI as a list)
```

### Entity Data Available for UI (via orgEntities + joins)
```
Entity {
  externalId, category, key, value, state, url,
  confidence, occurrenceCount, lastSeenAt,
  aliases[], evidenceSnippet
}

Entity.events[] → via orgEventEntities junction → orgEvents {
  externalId, observationType, title, content,
  source, sourceType, sourceId, significanceScore,
  occurredAt, sourceReferences[]
}

Entity.edges[] → via orgEntityEdges → {
  targetEntity { category, key }, relationshipType, confidence
}
```

## Historical Context (from thoughts/)

### Entity-related documents:
- `thoughts/shared/research/2026-04-04-org-entities-upsert-excluded-reference-error.md` — Bug fix for EXCLUDED column reference in entity upsert
- `thoughts/shared/plans/2026-04-04-fix-org-entities-excluded-reference.md` — Plan for the above fix
- `thoughts/shared/plans/2026-04-04-migrate-excluded-to-sql-identifier.md` — Broader migration of EXCLUDED references

### Cross-source entity linking:
- `thoughts/shared/research/2026-04-04-cross-source-linking-fixes.md` — Broken cross-source entity linking
- `thoughts/shared/research/2026-04-04-cross-source-monorepo-linking.md` — Vercel/GitHub/Sentry monorepo linking

### Pipeline architecture:
- `thoughts/shared/research/2026-04-04-provider-plugin-system.md` — Provider plugin system (event ingest + entity upsert)
- `thoughts/shared/research/2026-04-04-provider-integration-surface-incidentio.md` — Provider integration surface model
- `thoughts/shared/research/2026-04-05-platform-logging-gaps.md` — Pipeline observability gaps

### World view adjacent:
- `thoughts/shared/research/2026-04-04-dotlightfast-feature-design.md` — `.lightfast` repo as org-level context primitive (world view / agent context design)

## Decisions (resolved 2026-04-05)

1. **All 12 entity categories shown equally** — no prioritization of structural vs semantic types for now.
2. **Entity-events view reads from `orgEvents`** (enriched store), not `orgIngestLogs` (raw logs). This gives access to `significanceScore`, `observationType`, and proper entity links via the junction table.
3. **Flat related-entities list** for entity detail page — no graph visualization for now.
4. **Jobs removed completely from UI** — no admin route either. The `orgWorkflowRuns` table and tRPC router remain in the codebase but are no longer surfaced.
5. **Entity-first UI gets live updates** — will need a new Upstash Realtime channel for entity upserts (pipeline already emits `platform/entity.upserted`).
