---
date: 2026-03-14T08:45:00+00:00
researcher: claude
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Entity narrative embedding — zero-column approach with smarter queries"
tags: [research, design, entity-lifecycle, search, pinecone, narrative-embedding]
status: complete
last_updated: 2026-03-14
supersedes: "Replaces the 'last 10 events' narrative builder from 2026-03-13-entity-lifecycle-search-design.md"
revision_note: >
  v3: Zero new DB columns. The sliding-window amnesia problem is solved by better
  queries (genesis + recent + edges), not by accumulating state. Pinecone metadata
  is the structured query layer. DB is enrich + detail only.
---

# Research: Entity Narrative Embedding — Zero-Column Approach

**Date**: 2026-03-14
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Problem

The entity lifecycle search design builds entity narratives from the last 10 events. This creates systematic history amnesia — after event #11, the entity's genesis context is permanently lost from the embedding.

**Concrete failure**: A PR with 500 events. The sliding window captures events #491–500 — all recent review cycles. The embedding contains no genesis title, no genesis date. Search for "who did auth" returns a zero-signal match.

**Root cause**: The sliding window selects by recency, not by semantic contribution. The fix is not accumulating state in new columns — it's querying the right data at embed time.

**Goal**: 1 vector per entity in Pinecone. Dense with lifecycle signal. No amnesia. Zero schema changes.

---

## Solution: Smarter Queries, No New Columns

The events are already stored in `workspaceEvents` and linked to entities via `workspaceEntityEvents`. The entity row already has identity (`value`, `category`, `key`), temporal span (`extractedAt`, `lastSeenAt`), and activity count (`occurrenceCount`). Nothing new needs to be persisted.

The fix is changing what `entity-embed.ts` queries — from "last 10 events" to "genesis event + last 3 events + edges":

```typescript
// entity-embed.ts — replace the single "last 10 events" query with targeted queries
const [genesis, recentEvents, edges] = await step.run(
  "fetch-narrative-inputs",
  async () => {
    return Promise.all([
      // Genesis event (first ever — captures founding context)
      db
        .select({
          title: workspaceEvents.title,
          sourceType: workspaceEvents.sourceType,
          occurredAt: workspaceEvents.occurredAt,
        })
        .from(workspaceEntityEvents)
        .innerJoin(
          workspaceEvents,
          eq(workspaceEntityEvents.eventId, workspaceEvents.id)
        )
        .where(eq(workspaceEntityEvents.entityId, entity.id))
        .orderBy(asc(workspaceEvents.occurredAt))
        .limit(1),

      // Last 3 events (recency signal + current state)
      db
        .select({
          title: workspaceEvents.title,
          sourceType: workspaceEvents.sourceType,
          occurredAt: workspaceEvents.occurredAt,
        })
        .from(workspaceEntityEvents)
        .innerJoin(
          workspaceEvents,
          eq(workspaceEntityEvents.eventId, workspaceEvents.id)
        )
        .where(eq(workspaceEntityEvents.entityId, entity.id))
        .orderBy(desc(workspaceEvents.occurredAt))
        .limit(3),

      // Graph edges (related entities)
      db
        .select({
          relationshipType: workspaceEdges.relationshipType,
          targetCategory: workspaceEntities.category,
          targetKey: workspaceEntities.key,
        })
        .from(workspaceEdges)
        .innerJoin(
          workspaceEntities,
          eq(workspaceEdges.targetEntityId, workspaceEntities.id)
        )
        .where(eq(workspaceEdges.sourceEntityId, entity.id))
        .limit(10),
    ]);
  }
);
```

Total rows fetched: 1 (genesis) + 3 (recent) + 10 (edges) = **14 rows max**. All indexed on `entityId`. Sub-millisecond.

### What this solves

- **Genesis preserved** — first event is always fetched, regardless of entity age
- **No amnesia** — the genesis title, date, and action are always in the narrative
- **No redundancy** — 3 recent events instead of 10 eliminates repeated review cycles
- **No schema changes** — zero new columns, zero migrations
- **No new abstractions** — no NarrativeDigest type, no foldEvent function, no separate step

### What the entity row already provides

| Data | Existing column | Notes |
|---|---|---|
| Entity title | `value` | Set on first upsert |
| Entity type | `category` | "pr", "issue", "deployment" |
| Entity key | `key` | "org/repo#123" |
| First seen | `extractedAt` | When entity was first created |
| Last seen | `lastSeenAt` | Updated on every event |
| Event count | `occurrenceCount` | Incremented on every event |

---

## Narrative Builder

Reads entity row (already fetched) + genesis event + last 3 events + edges.

```typescript
function buildEntityNarrative(
  entity: WorkspaceEntity,
  genesisEvent: { title: string; sourceType: string; occurredAt: string } | null,
  recentEvents: { title: string; sourceType: string; occurredAt: string }[],
  edges: { relationshipType: string; targetCategory: string; targetKey: string }[]
): string {
  const sections: string[] = [];

  // ── Identity (from entity row — always present)
  sections.push(
    `${entity.category} ${entity.key}: ${entity.value ?? entity.key}`
  );

  // ── Genesis (from first event — founding context, never lost)
  if (genesisEvent) {
    const date = genesisEvent.occurredAt.split("T")[0];
    const action = genesisEvent.sourceType.split(".").pop();
    sections.push(`Created: ${date} ${action}: ${genesisEvent.title}`);
  }

  // ── Temporal span
  const firstSeen = entity.extractedAt?.split("T")[0];
  const lastSeen = entity.lastSeenAt?.split("T")[0];
  sections.push(
    `First seen: ${firstSeen} | Last seen: ${lastSeen} | Events: ${entity.occurrenceCount}`
  );

  // ── Recent detail (last 3 events for recency signal)
  if (recentEvents.length) {
    const timeline = recentEvents.map((e) => {
      const date = e.occurredAt.split("T")[0];
      const action = e.sourceType.split(".").pop();
      return `  ${date} ${action}: ${e.title}`;
    });
    sections.push(`Recent:\n${timeline.join("\n")}`);
  }

  // ── Graph context (related entities)
  if (edges.length) {
    const edgeLines = edges.slice(0, 10).map(
      (e) => `  ${e.relationshipType} → ${e.targetCategory} ${e.targetKey}`
    );
    sections.push(`Related:\n${edgeLines.join("\n")}`);
  }

  return sections.join("\n\n");
}
```

### Example output (entity with 500 events)

```
pr 12345#99: Add auth middleware

Created: 2024-03-01 opened: Add auth middleware

First seen: 2024-03-01 | Last seen: 2024-03-15 | Events: 500

Recent:
  2024-03-15 merged: Add auth middleware
  2024-03-14 approved: Add auth middleware
  2024-03-13 review_requested: Add auth middleware

Related:
  head_commit → commit abc1234
  fixes → issue 12345678#7
  from_branch → branch 12345678:feature/auth
```

~100 tokens. Genesis preserved. Recent state visible. Related entities for context. Zero redundancy.

---

## Why This Produces Better Embeddings

Embedding models encode text into a fixed-dimensional vector. When input is 80% redundant ("review_requested" repeated 8 times in a sliding window), those repeated phrases dominate the embedding — the vector skews toward "review" rather than "auth middleware."

The targeted-query narrative packs distinct concepts into fewer tokens:
- "auth middleware" (identity)
- "2024-03-01 opened" (genesis)
- "2024-03-15 merged" (current state)
- "commit abc1234" (related artifact)

Each concept gets proportionally more weight. Result: **higher recall for diverse query intents from a single vector**.

| Metric | Sliding Window (N=10) | Targeted Queries |
|---|---|---|
| Token count | ~400 | ~100 |
| Redundant tokens | ~40% | ~0% |
| Genesis present | Only if <N events old | Always |
| DB rows fetched | 10 events | 1 genesis + 3 recent + 10 edges |
| Schema changes | None | None |
| New code | None | Revised queries + narrative builder |

---

## Search Architecture

### The two jobs

Every query has two components that need different tools:

| Component | What resolves it | Example |
|---|---|---|
| **Semantic** — what is the user talking about? | Vector similarity on narrative embedding | "auth", "payment integration", "that login bug" |
| **Structured** — what filters narrow the results? | Pinecone metadata filters | entity type, state, time range, provider |

The embedding handles fuzzy intent ("auth middleware" matches "authentication layer"). Metadata handles exact constraints ("open PRs from this week"). Neither alone covers all queries. Together they do.

### Query dimensions

| Dimension | Resolution mechanism | Example queries |
|---|---|---|
| **Identity** (what) | Embedding similarity on narrative text | "auth migration", "payment service", "that deploy" |
| **State** (status) | Metadata filter: `currentState`, `latestAction` | "open PRs", "what merged", "blocked issues" |
| **Temporal** (when) | Metadata filter: `occurredAt`, `createdAt` | "this week", "last 24 hours", "since March" |
| **Type** (kind) | Metadata filter: `entityType` | "PRs", "issues", "deployments", "errors" |
| **Provider** (source) | Metadata filter: `provider` | "from GitHub", "in Linear", "Sentry errors" |
| **Actor** (who) | Embedding similarity (actor names in narrative) | "jeevan's work", "who did auth" |

Cross-cutting queries combine both: "what did jeevan merge this week" = embedding similarity for "jeevan" + metadata filters `{ latestAction: "merged", occurredAt: { $gte: thisWeekTs } }`.

### Pinecone vector metadata contract

Metadata is derived at embed time from the entity row + latest event. This is the structured query layer — no separate DB search path needed.

```typescript
// Metadata upserted alongside the entity vector
interface EntityVectorMetadata {
  layer: "entities";
  workspaceId: string;

  // ── Filterable dimensions (derived at embed time) ──
  entityType: string;          // entity.category
  provider: string;            // from event data
  latestAction: string;        // recentEvents[0].sourceType.split(".").pop()
  occurredAt: number;          // entity.lastSeenAt as Unix ms timestamp
  createdAt: number;           // entity.extractedAt as Unix ms timestamp

  // ── Display fields (returned with results, no DB round-trip needed) ──
  title: string;               // entity.value
  snippet: string;             // first 500 chars of narrative text
  entityExternalId: string;    // stable ID for expand / detail
  narrativeHash: string;       // content-hash dedup for re-embedding
  totalEvents: number;         // entity.occurrenceCount
}
```

Note: `currentState` is omitted because `entity.state` from PostTransformEvent is not currently persisted to any DB table. `latestAction` (derived from `sourceType`) serves as the state proxy for filtering. If `entity.state` is persisted in the future, add `currentState` to metadata.

### Query decomposition

The search API decomposes a natural language query into vector + filters before hitting Pinecone. This can start rule-based (cheap, no LLM) and evolve.

```
User/Agent: "what PRs merged this week"
  ↓
Decompose:
  semantic_text: "PRs merged"                    → embed as vector
  filters: {
    layer: "entities",
    entityType: "pr",                            → extracted from "PRs"
    latestAction: "merged",                      → extracted from "merged"
    occurredAt: { $gte: thisWeekTimestamp }       → extracted from "this week"
  }
  ↓
Pinecone query:
  vector: embedding(semantic_text)
  filter: filters
  topK: 10
  includeMetadata: true
  ↓
Results: ranked entity matches with metadata
  (title, latestAction, provider, score, totalEvents — enough to render cards without DB)
  ↓
Optional DB enrich:
  SELECT occurrenceCount, extractedAt FROM workspaceEntities
  WHERE externalId IN (matched IDs)
  (only if UI needs fields not already in Pinecone metadata)
  ↓
User/Agent expands card → POST /v1/contents → full event history from DB
```

### Why everything goes through Pinecone

There is no query that needs a separate DB search path:

- **"Show me PR #99"** — the entity vector contains "pr" and "#99" in its narrative. Matches semantically.
- **"All open issues"** — Pinecone filter `{ entityType: "issue", latestAction: "opened" }`.
- **"What happened yesterday"** — Pinecone filter `{ occurredAt: { $gte: yesterdayTs } }`.

The DB serves exactly two purposes:
1. **Enrich** — fields not in Pinecone metadata (only needed if UI renders fields beyond what metadata provides)
2. **Detail** — full event history when user expands a card (`/v1/contents`)

```
Pinecone = search + filter (discovery)
DB       = enrich + detail  (depth)
```

### Agent search patterns

An agent investigating a feature or incident composes multiple search calls:

```
Agent task: "Understand the status of the auth migration"

Call 1: search("auth migration")
  → Entities: PR "Add auth middleware", Issue "SSO support", PR "Fix login redirect"

Call 2: search("auth migration", filters: { latestAction: "opened" })
  → Open work: Issue "SSO support"

Call 3: expand(entity: "SSO support") → /v1/contents
  → Full event history: created 3 days ago, 12 events, last update 2h ago

Call 4: search("auth migration blockers")
  → Related: Error "JWT validation timeout" (from Sentry)

Agent synthesis:
  "Auth migration: 2 of 3 PRs merged. SSO support issue is open
   (12 events, last activity 2h ago). One related Sentry error: JWT
   validation timeout — may be blocking."
```

Each search call is a simple retrieval primitive — vector + filters → ranked entities. The agent does the reasoning across calls. The search API doesn't need intent classification, routing, or multi-step orchestration — the agent handles composition.

This works because:
- **Metadata filters** let the agent narrow by state/time/type without rephrasing the query
- **Metadata display fields** let the agent reason without expanding every card
- **Detail on demand** (`/v1/contents`) lets the agent go deep on specific entities
- **One vector per entity** means no duplicate results across calls

---

## V1SearchResult Mapping

All fields sourced from Pinecone metadata — no DB round-trip for search results:

| V1SearchResult field | Source |
|---|---|
| `id` | metadata `entityExternalId` |
| `title` | metadata `title` |
| `source` | metadata `provider` |
| `type` | metadata `entityType` |
| `snippet` | metadata `snippet` |
| `score` | Pinecone match score |
| `occurredAt` | metadata `occurredAt` (formatted) |
| `totalEvents` | metadata `totalEvents` |
| `latestAction` | metadata `latestAction` |

DB enrich is optional — only if UI needs fields beyond what Pinecone metadata provides (e.g., `stateJourney` if accumulated in the future, or full `aliases` list).

---

## Integration Summary

| Component | Status |
|---|---|
| `workspaceEntities` schema | **Unchanged** — zero new columns |
| Entity upsert in `event-store.ts` | **Unchanged** — no new fields |
| `entity-embed.ts` queries | **Modified** — genesis + last 3 instead of last 10 |
| `buildEntityNarrative()` | **Rewritten** — reads genesis + recent + edges |
| `EntityVectorMetadata` | **Extended** — add `createdAt`, `totalEvents` |
| `entity-graph.ts` | **Unchanged** |
| `entity.upserted` / `entity.graphed` | **Unchanged** |
| Debounced embedding | **Unchanged** |
| Content hash dedup | **Unchanged** |
| Pinecone `layer: "entities"` | **Unchanged** — one vector per entity |
| Search API | **Extended** — query decomposition + metadata-only response |

### What does NOT change

- Event log (`workspaceEvents`) remains append-only
- Junction table (`workspaceEntityEvents`) still links entities to events
- Graph layer (`workspaceEdges`) still resolves entity relationships
- LLM classification in `event-interpret.ts` is unaffected
- Old observation vectors (`layer: "observations"`) can be cleaned up — entity vectors replace their search function

---

## Open Questions

1. **Actors**: No transformer currently produces actor relations. When they do, actor names will appear in event data and can be included in the narrative text at embed time. No DB column needed — the narrative builder reads actors from events.

2. **State persistence**: `PostTransformEvent.entity.state` is not currently stored in any DB table — it's transient. If state filtering becomes important (beyond `latestAction` from `sourceType`), the simplest fix is persisting `entity.state` in `workspaceEvents.metadata` during ingestion. This requires zero schema changes (metadata is already JSONB) and makes state queryable at embed time.

3. **Narrative hash storage**: Content-hash dedup needs to compare the current hash with the previous one. Options: (a) store `narrativeHash` in Pinecone metadata (already proposed) and fetch the existing vector's metadata before deciding to re-embed, or (b) add a `narrativeHash varchar(64)` column to `workspaceEntities`. Option (a) avoids a DB column but adds a Pinecone read; option (b) keeps the check in the DB read that already happens.

4. **Edge race condition**: Already solved — `entity-embed` subscribes to `entity.graphed` (not `entity.upserted`), so edges are committed before the narrative is built.

---

## Related Research

- `thoughts/shared/research/2026-03-13-entity-lifecycle-search-design.md` — original design (this doc supersedes the narrative builder section)
- `thoughts/shared/research/2026-03-13-observation-pipeline-architecture.md` — full 4-layer redesign

## Code References

- `api/console/src/inngest/workflow/neural/entity-embed.ts:80–94` — current "last 10 events" query (replace with genesis + last 3)
- `api/console/src/inngest/workflow/neural/entity-embed.ts:142–155` — current Pinecone metadata (extend with `createdAt`, `totalEvents`)
- `api/console/src/inngest/workflow/neural/narrative-builder.ts` — narrative builder (rewrite)
- `packages/console-validation/src/schemas/neural.ts:62–81` — `EntityVectorMetadata` schema (extend)
- `api/console/src/inngest/workflow/neural/event-store.ts:456–485` — entity upsert (unchanged)
