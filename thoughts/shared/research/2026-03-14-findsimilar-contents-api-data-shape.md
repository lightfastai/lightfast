---
date: 2026-03-14T09:47:50Z
researcher: claude
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "findSimilar and contents API — data shape, implementation gaps, and gateway proxy angle"
tags: [research, codebase, findsimilar, contents, search, pinecone, entities, gateway, proxy]
status: complete
last_updated: 2026-03-14
---

# Research: findSimilar and contents API — data shape, implementation gaps, and gateway proxy angle

**Date**: 2026-03-14T09:47:50Z
**Git Commit**: `4ec3c541776200e318c670c5064af752d9e142f0`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

We have fully reworked our architecture through relay → backfill → ingress → neural pipeline. What should `findSimilar` and `contents` actually do, in relation to Lightfast's SPEC goals? What data should they surface? How does the gateway's `proxy/execute` endpoint factor in?

---

## Summary

Both `findSimilarLogic` and `contentsLogic` are currently **unimplemented stubs** — they each throw `Error("not implemented")` immediately. `searchLogic` is the only fully implemented sibling and is the canonical reference pattern. The data store is fully built: entities are deduplicated in `workspaceEntities`, linked to events via `workspaceEntityEvents`, connected by directed edges in `workspaceEdges`, and each entity has a Cohere-embedded narrative vector in Pinecone (`lightfast-v1`). The gateway's `proxy/execute` endpoint provides authenticated, zero-domain-knowledge access to any connected provider's API.

---

## Detailed Findings

### 1. Implementation Status

#### `findSimilarLogic` (`apps/console/src/lib/findsimilar.ts:7`)

```ts
export async function findSimilarLogic(
  _auth: AuthContext,
  _input: FindSimilarRequest,
  requestId: string
): Promise<FindSimilarResponse> {
  // TODO: see thoughts/shared/research/...
  throw new Error(`findSimilarLogic not implemented [requestId=${requestId}]`);
}
```

**Status**: Stub. Both `_auth` and `_input` are prefixed with `_` (unused). No DB or Pinecone calls.

#### `contentsLogic` (`apps/console/src/lib/contents.ts:7`)

```ts
export async function contentsLogic(
  _auth: AuthContext,
  _input: ContentsRequest,
  requestId: string
): Promise<ContentsResponse> {
  // TODO: DB lookup (doc_* and obs_* ID split)
  throw new Error(`contentsLogic not implemented [requestId=${requestId}]`);
}
```

**Status**: Stub. The inline comment `"doc_* and obs_* ID split"` records the intended branching strategy on ID prefix — two ID namespaces (`doc_*` and `obs_*`) pointing to different tables.

---

### 2. Input / Output Schemas

#### `FindSimilarRequestSchema` (`packages/console-validation/src/schemas/api/findsimilar.ts:4-46`)

```ts
{
  id?: string,                  // entity externalId to pivot on
  url?: string,                 // alternative pivot (URL match)
  limit: integer (1-50, default 10),
  threshold: float (0-1, default 0.5),
  sameSourceOnly?: boolean,     // default false — restrict to same provider
  excludeIds?: string[],        // entity externalIds to suppress
  filters?: {
    sourceTypes?: string[],
    observationTypes?: string[],
    dateRange?: { start?: ISO, end?: ISO },
    sources?: string[],
    entityTypes?: string[]
  }
}
```

Validation: `.refine()` enforces that at least one of `id` or `url` is present.

#### `FindSimilarResponseSchema` (`packages/console-validation/src/schemas/api/findsimilar.ts:64-75`)

```ts
{
  data: {
    source: { id: string, title: string, type: string },
    similar: Array<{
      id: string,
      title: string,
      source: string,
      type: string,
      url: string | null,
      occurredAt: string | null,
      snippet?: string,
      score: number,
      similarity: number,
      entityOverlap?: number
    }>
  },
  meta: { total: number, took: number },
  requestId: string
}
```

#### `ContentsRequestSchema` (`packages/console-validation/src/schemas/api/contents.ts:4-10`)

```ts
{
  ids: string[]  // min 1, max 50 — entity or event externalIds
}
```

#### `ContentsResponseSchema` (`packages/console-validation/src/schemas/api/contents.ts:20-30`)

```ts
{
  data: {
    items: Array<{
      id: string,
      title: string,
      source: string,
      type: string,
      url: string | null,
      occurredAt: string | null,
      snippet: string,        // required (unlike search results)
      content?: string,       // full body text — the extra field vs search
      metadata?: Record<string, unknown>
    }>,
    missing: string[]         // IDs that were not found
  },
  meta: { total: number },
  requestId: string
}
```

---

### 3. Reference Implementation: `searchLogic`

`apps/console/src/lib/search.ts` is the fully implemented reference. The pattern all logic functions follow:

```
1. db.query.orgWorkspaces.findFirst({ where: eq(orgWorkspaces.id, auth.workspaceId) })
   → extract { indexName, namespaceName, embeddingModel, embeddingDim }

2. createEmbeddingProviderForWorkspace(workspace, { inputType: "search_query" })
   .embed([request.query])
   → queryVector: number[]

3. consolePineconeClient.query<EntityVectorMetadata>(
     indexName,
     { vector: queryVector, topK: request.limit, filter: pineconeFilter, includeMetadata: true },
     namespaceName
   )
   → queryResult.matches

4. matches.map(match => ({ id, title, source, type, url, occurredAt, snippet, score, ... }))
```

Pinecone filter shape used in search:
```ts
const pineconeFilter = {
  layer: "entities",                          // always scoped to entity layer
  occurredAt: { $gte: start, $lte: end },     // optional date range (Unix ms)
  provider: { $in: [...] },                   // optional source filter
  entityType: { $in: [...] },                 // optional entity type filter
}
```

---

### 4. Entity Data Store

#### `workspaceEntities` — `lightfast_workspace_entities`

The canonical entity table. One row per unique `(workspaceId, category, key)`. Fields:

| Column | Type | Notes |
|---|---|---|
| `external_id` | `VARCHAR(21)` | nanoid; used in API responses and Pinecone vector key `ent_{externalId}` |
| `category` | `VARCHAR(50)` | `EntityCategory`: `pr`, `commit`, `branch`, `issue`, `deployment`, `engineer`, etc. |
| `key` | `VARCHAR(500)` | Canonical dedup key e.g. `@sarah`, `lightfastai/lightfast#123` |
| `value` | `TEXT` | Human-readable description |
| `aliases` | `JSONB` | `string[]` — alternative names |
| `evidence_snippet` | `TEXT` | Extraction evidence from source event |
| `confidence` | `REAL` | 0.0–1.0; primary entity always `1.0` |
| `occurrence_count` | `INTEGER` | Incremented on every upsert (= total event appearances) |
| `last_seen_at` | `TIMESTAMP` | Updated on every upsert |

Unique constraint: `(workspace_id, category, key)` — prevents entity duplication.

#### `workspaceEvents` — `lightfast_workspace_events`

One row per ingested event. Full content lives here:

| Column | Type | Notes |
|---|---|---|
| `external_id` | `VARCHAR(21)` | nanoid; the `id` field in API responses |
| `observation_type` | `VARCHAR(100)` | Derived: `pr_merged`, `deployment_succeeded`, etc. |
| `title` | `TEXT` | Short headline ≤120 chars |
| `content` | `TEXT` | **Full event body** — the key field `contentsLogic` exposes |
| `source` | `VARCHAR(50)` | `github`, `vercel`, `linear`, `sentry` |
| `source_type` | `VARCHAR(100)` | Provider event type e.g. `pull_request.merged` |
| `source_id` | `VARCHAR(255)` | Provider's own ID e.g. `pr:lightfastai/lightfast#123` |
| `source_references` | `JSONB` | `EntityRelation[]` — related entity refs |
| `metadata` | `JSONB` | Provider-specific attributes |
| `significance_score` | `INTEGER` | 0–100 computed at ingestion |

Indexes: `(workspace_id, occurred_at)`, `(workspace_id, source, source_type)`, `(workspace_id, source_id)`, `(workspace_id, observation_type)`.

#### `workspaceEntityEvents` — junction

One row per `(entity_id, event_id)` pair. `ref_label` carries the structural role e.g. `resolves`, `fixes`.

#### `workspaceEdges` — `lightfast_workspace_edges`

Directed entity graph:

| Column | Type | Notes |
|---|---|---|
| `source_entity_id` | `BIGINT` | FK → `workspaceEntities.id` |
| `target_entity_id` | `BIGINT` | FK → `workspaceEntities.id` |
| `relationship_type` | `VARCHAR(50)` | e.g. `deployed_by`, `fixes`, `resolves` |
| `source_event_id` | `BIGINT` | Provenance — which event caused this edge |
| `confidence` | `REAL` | Always `1.0` (co-occurrence) |
| `metadata` | `JSONB` | `{ detectionMethod: "entity_cooccurrence" }` |

Unique constraint: `(workspace_id, source_entity_id, target_entity_id, relationship_type)`.

---

### 5. Pinecone Vector Structure

#### Configuration (per workspace, stored in `orgWorkspaces.settings.embedding`)

```
indexName:         "lightfast-v1"          (shared across all workspaces)
namespaceName:     "{clerkOrgId}:ws_{workspaceId}"   (data isolation)
embeddingModel:    "embed-english-v3.0"
embeddingDim:      1024
embeddingProvider: "cohere"
pineconeMetric:    "cosine"
```

#### Vector ID

```
ent_{entity.externalId}
```

One vector per entity — not per event. The vector encodes the entity's full narrative.

#### `EntityVectorMetadata` fields (`packages/console-validation/src/schemas/neural.ts:21-44`)

| Field | Type | Source |
|---|---|---|
| `layer` | `"entities"` | Hardcoded — all entity vectors share this discriminant |
| `entityExternalId` | `string` | `entity.externalId` |
| `entityType` | `string` | `entity.category` |
| `provider` | `string` | From `entity.graphed` Inngest event |
| `latestAction` | `string` | Last segment of latest event's `sourceType` (split on `.`) |
| `title` | `string` | First line of the narrative text |
| `snippet` | `string` | `narrative.slice(0, 500)` |
| `occurredAt` | `number` | Unix ms of latest event's `occurredAt` |
| `createdAt` | `number` | Unix ms of `entity.extractedAt` |
| `narrativeHash` | `string` | SHA-256 prefix (16 chars) of full narrative |
| `totalEvents` | `number` | `entity.occurrenceCount` |
| `significanceScore` | `number` | `MAX(workspaceEvents.significance_score)` across all linked events |

#### Narrative structure (`api/console/src/inngest/workflow/neural/narrative-builder.ts`)

Five sections assembled in order, capped at 1,800 chars before embedding:
1. `{category} {key}: {value ?? key}` — identity line
2. Genesis event (oldest): date + action + title
3. Temporal span: `First seen: {date} | Last seen: {date} | Events: {count}`
4. Last 3 events: `{date} {action}: {title}`
5. Up to 3 outgoing edges: `{relationshipType} → {targetCategory} {targetKey}`

---

### 6. Significance Scoring (`api/console/src/inngest/workflow/neural/scoring.ts:90`)

Score is 0–100 integer, computed at event ingestion:
1. **Base weight** from `EVENT_REGISTRY[provider:eventType]` (default 50)
2. **Content signals** — regex patterns on `{title} {body}`: critical (+20), incident (+15), feature (+8), chore (−10), trivial (−15)
3. **Reference density** — `min(refCount * 3, 15)` bonus
4. **Content substance** — +5 for body >500 chars, +2 for >200 chars
5. Clamped to `[0, 100]`

Stored in `workspaceEvents.significance_score`. The MAX across all entity-linked events is stored in Pinecone metadata as `significanceScore`.

---

### 7. Gateway Proxy/Execute

#### Endpoints

**`GET /connections/:id/proxy/endpoints`** (`apps/gateway/src/routes/connections.ts:696`)
- Returns provider's API catalog: `{ provider, baseUrl, endpoints: { [endpointId]: { method, path, description, timeout? } } }`
- Strips Zod `responseSchema` (not serializable)

**`POST /connections/:id/proxy/execute`** (`apps/gateway/src/routes/connections.ts:741`)
- Pure authenticated proxy. Zero domain knowledge.
- Request body: `{ endpointId, pathParams?, queryParams?, body? }`
- Handles: endpoint validation, token resolution (including refresh on 401), URL building
- Returns: raw `{ status, data, headers }`
- Internal-only via `X-API-Key` auth

#### Where `connectionId` comes from

`gwResources` table links provider resources (e.g. a GitHub org) to a `gwInstallations.id`. The `resourceKey(provider, providerResourceId)` Redis cache maps `(provider, providerResourceId) → { connectionId, orgId }`. For a workspace, the active installation IDs are retrievable from the gateway `GET /connections/:id` endpoint.

---

### 8. Relationship to SPEC Goals

From `SPEC.md`:

| SPEC Layer | Relevant API |
|---|---|
| **Observe** | Ingress → relay → `workspaceEvents` |
| **Remember** | `workspaceEntities`, `workspaceEdges`, Pinecone entity vectors |
| **Reason** | `search` (semantic query), `findSimilar` (entity neighborhood), `contents` (source retrieval) |
| **Act** | Gateway `proxy/execute` (live provider actions) |

**`search`** — already implemented. Answers "what entities match this intent?" using Pinecone vector similarity. Returns one result per entity.

**`findSimilar`** — answers "what other entities are semantically or structurally related to this one?" Pivots on a known entity ID or URL, returns its neighborhood. Serves the **Remember** layer: "how things relate."

**`contents`** — answers "give me the full source content for these IDs." Returns the `content` and `metadata` fields from `workspaceEvents` that search results deliberately omit (for payload size). Serves both **Remember** (citing sources) and **Reason** (supplying raw evidence to downstream agents).

**Gateway proxy in contents/findSimilar** — the proxy/execute endpoint enables live data augmentation: e.g., `contentsLogic` could optionally fetch a live GitHub PR diff, Sentry exception stacktrace, or Linear issue body alongside the stored event content, giving agents fresh evidence alongside the stored narrative. The connection `id` would be resolved by looking up the workspace's active installation for the relevant provider.

---

## Code References

- `apps/console/src/lib/findsimilar.ts` — stub, throws immediately
- `apps/console/src/lib/contents.ts` — stub, throws immediately, comment notes `doc_* and obs_*` branching
- `apps/console/src/lib/search.ts` — fully implemented reference pattern
- `apps/console/src/lib/types.ts` — `AuthContext` shape
- `packages/console-validation/src/schemas/api/findsimilar.ts` — request/response schemas
- `packages/console-validation/src/schemas/api/contents.ts` — request/response schemas
- `packages/console-validation/src/schemas/api/common.ts` — `EventBaseSchema`, `SearchFiltersSchema`
- `packages/console-validation/src/schemas/neural.ts:21-44` — `EntityVectorMetadata`
- `db/console/src/schema/tables/workspace-events.ts` — `workspaceEvents` table definition
- `db/console/src/schema/tables/workspace-entities.ts` — `workspaceEntities` table definition
- `db/console/src/schema/tables/workspace-entity-events.ts` — junction table
- `db/console/src/schema/tables/workspace-edges.ts` — `workspaceEdges` table definition
- `api/console/src/inngest/workflow/neural/entity-embed.ts` — Pinecone upsert logic
- `api/console/src/inngest/workflow/neural/narrative-builder.ts` — narrative assembly
- `api/console/src/inngest/workflow/neural/scoring.ts:90` — significance scoring
- `api/console/src/inngest/workflow/neural/edge-resolver.ts:249` — co-occurrence edge insertion
- `apps/gateway/src/routes/connections.ts:696` — `GET /connections/:id/proxy/endpoints`
- `apps/gateway/src/routes/connections.ts:741` — `POST /connections/:id/proxy/execute`

## Open Questions

1. **`doc_*` and `obs_*` ID prefixes** — these prefixes are referenced in the `contentsLogic` comment but no corresponding tables or ID generation patterns for them were found in the current DB schema. It's unclear whether these prefixes are planned ID conventions for `workspaceEvents` (`doc_`) and a future `workspaceObservations` (`obs_`) table, or something else.
2. **`findSimilar` by URL** — the schema accepts `url` as an alternative pivot. How `url` maps to an entity is not established: candidates are `workspaceEvents.source_id` (contains URL-like IDs) or a fuzzy match against entity `key` or `aliases`. No lookup strategy exists yet.
3. **`entityOverlap` in findSimilar response** — the response schema includes `entityOverlap?: number` per result. This is presumably a graph-distance or shared-entity count between the pivot and each similar entity. No computation for this field exists yet.
4. **Live proxy in contents** — the proxy/execute integration angle is architecturally sound but requires resolving which `installationId` to use for a given workspace + provider pair. This look-up path (workspace → resource → installation) exists in the gateway DB but no helper for it exists in the console app yet.
