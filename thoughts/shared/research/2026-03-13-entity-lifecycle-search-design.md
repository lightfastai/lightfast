---
date: 2026-03-13T04:23:27+00:00
researcher: claude
git_commit: 81a096f366dafb53ec8dfee1b94315dd7b6e1d6d
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Entity lifecycle tracking and search architecture — narrative memory pattern, collapse layer, actor model"
tags: [research, design, entity-lifecycle, search, pinecone, inngest, actors, collapse-layer, narrative-memory]
status: complete
last_updated: 2026-03-13
last_updated_note: "Refined design — replaced currentState column with narrative memory pattern, richer narrative builder, debounced embedding"
---

# Research: Entity Lifecycle + Search Architecture

**Date**: 2026-03-13
**Git Commit**: `81a096f366dafb53ec8dfee1b94315dd7b6e1d6d`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

How should Lightfast track entity lifecycle (PR draft→open→merged) through the Inngest pipeline, and how does the search API connect to the entity model so that user questions like "what happened to auth" and "who implemented the sign-in page" return clean, canonical answers — not a noisy stream of repeated lifecycle events?

---

## Current State — What Actually Exists

### What the pipeline does today

The lifecycle state travels through the system but goes nowhere:

```
GitHub webhook: PR merged
    ↓
transformGitHubPullRequest()
    entity.state = "merged"         ← encoded correctly
    sourceId = "github:pr:12345#99:pull-request.merged"
    ↓
workspaceIngestLog (raw log)        ← full PostTransformEvent stored as JSONB
    ↓
event-store.ts (Inngest)
    Step check-duplicate: queries workspaceEvents WHERE sourceId = ?
        sourceId includes action suffix → no collision with PR opened event
    Step upsert-entities-and-junctions:
        INSERT INTO workspaceEntities (category="pr", key="12345#99")
        ON CONFLICT DO UPDATE SET
            lastSeenAt = now(),
            occurrenceCount = occurrenceCount + 1
            ← entity.state is NOT written anywhere
    Step store-observation:
        INSERT INTO workspaceEvents (sourceId, title, content, source, sourceType, ...)
            ← separate row for the merge event
    ↓
event-interpret.ts (slow path)
    Embeds title, content, summary → 3 Pinecone vectors
        vectorId: obs_title_github_pr_12345_99_pull_request_merged
        vectorId: obs_content_github_pr_12345_99_pull_request_merged
        vectorId: obs_summary_github_pr_12345_99_pull_request_merged
        metadata.layer = "observations"
```

**For a PR that goes draft→open→merged, the result is:**
- `workspaceEntities`: ONE row, `category=pr`, `key=12345#99`, `occurrenceCount=3`, `lastSeenAt=merge_time`. No state column.
- `workspaceEvents`: THREE rows, one per lifecycle event
- Pinecone: NINE vectors (3 views × 3 events) with independent IDs
- `workspaceEntityEvents`: THREE junction rows (entity ↔ each event)

### What the search system does today

The search system is **completely unimplemented**:

- UI calls `POST /v1/search` — route does not exist
- `POST /search` calls `searchLogic()` — throws `"searchLogic not implemented"` (`apps/console/src/lib/search.ts:14`)
- tRPC `search.query` works but requires Bearer API key — inaccessible from the console session
- Two incompatible Pinecone metadata schemas coexist in the same namespace:
  - `VectorMetadata` (document chunks) — no `source`, `occurredAt`, `layer` fields
  - `ObservationVectorMetadata` (event vectors) — no `docId`, `chunkIndex` fields
- No deduplication anywhere in the search path — same entity appearing in 3 events → up to 9 Pinecone matches

### What entity.state contains today (never used)

Every transformer encodes lifecycle state into `entity.state` correctly:

| Provider | Entity type | state values |
|---|---|---|
| GitHub PR | `pr` | `"open"`, `"closed"`, `"merged"`, `"draft"` |
| GitHub Issue | `issue` | `"open"`, `"closed"` |
| GitHub Discussion | `discussion` | `"open"`, `"answered"` |
| Linear Issue | `issue` | state name string (e.g. `"In Progress"`, `"Done"`) |
| Linear Project | `project` | project state string (e.g. `"started"`, `"completed"`) |
| Vercel Deployment | `deployment` | `deployment.readyState.toLowerCase()` (e.g. `"ready"`, `"error"`) |
| Sentry Issue | `issue` | `"resolved"`, `"unresolved"` |
| Sentry Metric Alert | `metric-alert` | the action itself (`"critical"`, `"warning"`, `"resolved"`) |

This data is **present and correct** in `PostTransformEvent` on every ingest. It gets written to `workspaceIngestLog.sourceEvent` (JSONB) but is never extracted into a DB column.

---

## The Core Problems

### Problem 1 — Lifecycle state is lost

`entity.state = "merged"` flows into the pipeline and disappears. There is no column in any table that stores the current state of a PR entity. The only way to answer "is PR #99 open?" is to JOIN `workspaceEvents` to find the most recent event for that entity and infer state from `sourceType`. That join is not built anywhere.

### Problem 2 — Search returns events, not entities

If search worked today, searching "auth PR" would return up to 9 Pinecone results for a single PR that had 3 lifecycle events. The user asked about the PR but would see 9 fragmented results about the same thing from different moments.

The root cause: **the vector layer indexes events** (one embedding per event occurrence), not entities (one canonical embedding per domain object).

### Problem 3 — No actor tracking

The actor fields were recently removed from `PostTransformEvent` (commit `ea2496574`). There is no actor entity type in `workspaceEntities`. There is no way to query "who authored this PR" from the DB. The only place actor data lives is the raw `workspaceIngestLog.sourceEvent` JSONB.

Without actors as entities with edges to other entities, questions like "who implemented the sign-in page" are unanswerable from the structured layer.

### Problem 4 — Cross-entity answers require reconstructing the graph

"What happened to uptime after the sign-in page went live?" requires:
1. Find the PR/deployment entity for "sign-in page"
2. Find the deployment that happened close in time
3. Find Sentry or monitoring events linked to that deployment

This graph traversal is possible with the current edge schema, but the entities aren't indexed semantically (in Pinecone with `layer="entities"`), so semantic search can't start the traversal.

---

## The Proposed Design — Narrative Memory

### Core Principle

> **An entity is not a snapshot. It's a living narrative that grows richer with every event.**

The key architectural decision: **no mutable `currentState` column**. The DB layer stays purely event-sourced. Entity state is always **derived** from the event stack (via the junction table) — never stored as a mutable column.

The entity's searchable representation is a **materialized narrative embedding** — a structured text document built from the entity's full event history, attributes, actors, and graph context, then embedded as a single Pinecone vector. This is the "collapse layer."

### Why not `currentState`?

A mutable `currentState` column has three problems:
1. **Lossy** — collapsing a PR's journey (draft → opened with 120 lines → merged by sarah → deployed → caused no alerts) into `"merged"` throws away the story
2. **CRUD in an event-sourced system** — an overwritten column is antithetical to append-only event sourcing
3. **Doesn't scale** — a Linear issue bouncing between 5 states, with reviewers and blockers at each stage, cannot be captured by a single string

The narrative memory pattern solves all three: the narrative IS the entity's full state — accretive, never overwritten at the DB level, and naturally scales with complexity.

### Two representations, two query patterns

| Layer | What it stores | Query pattern | Example |
|---|---|---|---|
| **Event log** (`workspaceEvents` + Pinecone `layer="observations"`) | Immutable facts, one row per lifecycle event | "What happened last week?" / timeline queries | 3 rows for a PR: opened, reviewed, merged |
| **Entity narrative** (Pinecone `layer="entities"`) | Materialized narrative per entity, upserted on change | "What happened to auth?" / identity queries | 1 vector for the PR, containing the full story |

The DB is never mutated. The Pinecone entity layer is a materialized view — like a database materialized view, but semantic.

---

## The Narrative Builder

### Architecture

When a new event touches an entity, the narrative is rebuilt and re-embedded:

```
entity.upserted (Inngest event)
  → entity-embed.ts (Inngest function, debounced per entity)
    1. Fetch entity row from workspaceEntities
    2. Fetch last 10 events via workspaceEntityEvents junction (ordered by occurredAt)
    3. Fetch graph edges from workspaceEdges (limit 10)
    4. Build narrative text from all three sources
    5. Embed → UPSERT to Pinecone (layer="entities")
       Vector ID: ent_{externalId}  ← same ID always, overwritten
```

### The narrative format

```typescript
function buildEntityNarrative(
  entity: WorkspaceEntity,
  events: WorkspaceEvent[],   // ordered by occurredAt ASC, capped to last 10
  edges: WorkspaceEdge[]      // graph neighbors, limit 10
): string {
  const sections: string[] = [];
  const latest = events[events.length - 1];
  const attrs = latest?.metadata ?? {};

  // ── Identity
  sections.push(
    `${entity.category} ${entity.key}: ${events[0]?.title ?? entity.key}`
  );

  // ── Context (from latest event's attributes)
  const context: string[] = [];
  if (attrs.repoFullName) context.push(`repo: ${attrs.repoFullName}`);
  if (attrs.additions != null)
    context.push(`+${attrs.additions}/-${attrs.deletions}`);
  if (attrs.headRef) context.push(`${attrs.headRef} → ${attrs.baseRef}`);
  if (attrs.stateName) context.push(`state: ${attrs.stateName}`);
  if (attrs.priority) context.push(`priority: ${attrs.priority}`);
  if (attrs.level) context.push(`level: ${attrs.level}`);
  if (context.length) sections.push(context.join(" | "));

  // ── Actors (from relations on events, deduplicated by role)
  const actors = new Map<string, Set<string>>();
  for (const evt of events) {
    for (const rel of evt.sourceReferences ?? []) {
      if (rel.entityType === "actor") {
        const set = actors.get(rel.relationshipType) ?? new Set();
        set.add(rel.title ?? rel.entityId);
        actors.set(rel.relationshipType, set);
      }
    }
  }
  if (actors.size) {
    sections.push(
      [...actors]
        .map(([role, names]) => `${role}: ${[...names].join(", ")}`)
        .join("\n")
    );
  }

  // ── Timeline (the narrative arc)
  const timeline = events.map((e) => {
    const date = e.occurredAt.toISOString().split("T")[0];
    const action = e.sourceType.split(".").pop();
    return `  ${date} ${action}: ${e.title}`;
  });
  sections.push(`Timeline:\n${timeline.join("\n")}`);

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

### Example output

For a PR that went draft → opened → merged:

```
pr 12345#99: Add auth middleware

repo: lightfastai/lightfast | +120/-30 | feature/auth → main

authored_by: jeevanpillay
merged_by: sarah

Timeline:
  2024-03-01 draft: Add JWT validation to all API routes
  2024-03-02 opened: Add JWT validation to all API routes
  2024-03-03 merged: Add JWT validation to all API routes

Related:
  head_commit → commit abc1234
  from_branch → branch 12345678:feature/auth
  fixes → issue 12345678#7
  deploys → deployment dpl_abc123
```

When embedded, a single vector captures:
- **Identity**: "PR #99", "auth middleware", "12345#99"
- **Actors**: "jeevanpillay authored", "sarah merged"
- **Journey**: draft → opened → merged (temporal arc)
- **Context**: repo, branch, file changes
- **Graph**: linked issue, deployment, commit

Search for "auth" → finds it. Search for "what did jeevanpillay work on" → finds it. Search for "what deployed last week" → finds it via the deployment relation. All from ONE embedding per entity.

---

## Embed Cost Mitigation

### Problem: re-embedding on every state change

A PR that goes draft→open→merged fires 3 `entity.upserted` events → 3 narrative rebuilds → 3 embed calls. Only the last one "matters."

### Solution: Inngest debounce

```typescript
export const entityEmbed = inngest.createFunction(
  {
    id: "apps-console/entity.embed",
    debounce: {
      key: "event.data.entityExternalId",  // same entity → collapses
      period: "30s",                        // wait 30s for more events
    },
    retries: 3,
  },
  { event: "apps-console/entity.upserted" },
  async ({ event, step }) => { /* runs ONCE with the latest event data */ }
);
```

If 3 events arrive within 30 seconds for the same entity: **one embed call, not three**.

### Additional guards

- **Content hash**: Hash the narrative text before embedding. If the hash matches the previous embed (stored as Pinecone metadata), skip the embed call entirely.
- **Cap to last 10 events**: Only include the 10 most recent events in the narrative. Older events remain in `workspaceEvents` for the event log but don't contribute to the current embedding.
- **Single vector**: One embedding per entity (the full narrative), not three views. The title is already in the narrative — no need for separate title/content/summary vectors like the current event pipeline does.

### Cost at scale

For a typical workspace with 500 entities and ~50 events/day:
- Average 50 embed calls/day (most entities see 0-1 events/day)
- With debounce: ~30 embed calls/day (burst events collapse)
- Each embed call: ~0.001 USD (Cohere embed-v3 pricing)
- Monthly cost: ~$1 per workspace

---

## Deriving State Without a Column

### "All open PRs" without `currentState`

**Via Pinecone metadata** (recommended for semantic + filter queries):

The entity embed function writes derived metadata to the Pinecone vector at embed time:

```typescript
metadata: {
  layer: "entities",
  entityExternalId: entity.externalId,
  entityType: entity.category,
  provider: event.data.provider,
  latestAction: latestEvent.sourceType.split(".").pop(), // "merged", "opened"
  title: narrative.split("\n")[0],
  snippet: narrative.slice(0, 500),
  occurredAt: latestEvent.occurredAt,
  narrativeHash,  // for content-hash dedup
}
```

Query: "show me all open PRs" →
```typescript
pinecone.query({
  vector: queryEmbedding,
  filter: {
    layer: "entities",
    entityType: "pr",
    latestAction: { $nin: ["merged", "closed"] },
  },
});
```

**Via SQL derived query** (for structured/tabular views):

```sql
SELECT e.*, latest.source_type AS latest_action
FROM lightfast_workspace_entities e
JOIN LATERAL (
  SELECT we.source_type
  FROM lightfast_workspace_entity_events ee
  JOIN lightfast_workspace_events we ON we.id = ee.event_id
  WHERE ee.entity_id = e.id
  ORDER BY we.occurred_at DESC LIMIT 1
) latest ON true
WHERE e.workspace_id = $1
  AND e.category = 'pr'
  AND latest.source_type NOT LIKE '%merged%'
  AND latest.source_type NOT LIKE '%closed%';
```

No mutable column. State is always computed from the event stack.

---

## Lifecycle Tracking Through Inngest

### What changes in `event-store.ts`

**No DB schema changes needed.** The entity upsert logic remains the same — `ON CONFLICT DO UPDATE SET occurrenceCount + 1, lastSeenAt = now()`. No `currentState` column to write.

The only addition is emitting `entity.upserted` after the entity upsert step:

```typescript
// emit-entity-upserted step (new, after upsert-entities-and-junctions)
// Emit for the PRIMARY entity only (sourceEvent.entity), not for every relation
await step.sendEvent("emit-entity-upserted", {
  name: "apps-console/entity.upserted",
  data: {
    workspaceId,
    entityExternalId: primaryEntity.externalId,
    entityType: primaryEntity.category,
    provider: sourceEvent.provider,
    eventExternalId: sourceEventExternalId,
    occurredAt: sourceEvent.occurredAt,
  },
});
```

This triggers two independent Inngest functions:

1. **`entity.embed`** — builds narrative + embeds to Pinecone `layer="entities"` (debounced)
2. **`entity.graph`** — resolves edges (extracted from `event-interpret.ts`)

### The `entity.embed` function (new)

```typescript
export const entityEmbed = inngest.createFunction(
  {
    id: "apps-console/entity.embed",
    debounce: {
      key: "event.data.entityExternalId",
      period: "30s",
    },
    retries: 3,
    timeouts: { finish: "2m" },
  },
  { event: "apps-console/entity.upserted" },
  async ({ event, step }) => {
    const { workspaceId, entityExternalId } = event.data;

    // Step 1: Fetch all narrative inputs in one step
    const data = await step.run("fetch-narrative-inputs", async () => {
      const entity = await db.query.workspaceEntities.findFirst({
        where: eq(workspaceEntities.externalId, entityExternalId),
      });
      if (!entity) throw new NonRetriableError("Entity not found");

      const [events, edges, workspace] = await Promise.all([
        // Last 10 events for this entity, ordered by time
        db.select({ event: workspaceEvents })
          .from(workspaceEntityEvents)
          .innerJoin(workspaceEvents, eq(workspaceEntityEvents.eventId, workspaceEvents.id))
          .where(eq(workspaceEntityEvents.entityId, entity.id))
          .orderBy(asc(workspaceEvents.occurredAt))
          .limit(10),
        // Graph edges (outgoing)
        db.select()
          .from(workspaceEdgesTable)
          .where(eq(workspaceEdgesTable.sourceEntityId, entity.id))
          .limit(10),
        // Workspace for embedding config
        db.query.orgWorkspaces.findFirst({
          where: eq(orgWorkspaces.id, workspaceId),
        }),
      ]);

      return { entity, events: events.map(r => r.event), edges, workspace };
    });

    if (!data.workspace) throw new NonRetriableError("Workspace not found");

    // Step 2: Build narrative
    const narrative = buildEntityNarrative(data.entity, data.events, data.edges);
    const latestEvent = data.events[data.events.length - 1];

    // Step 3: Content hash check — skip if unchanged
    const narrativeHash = createHash("sha256")
      .update(narrative)
      .digest("hex")
      .slice(0, 16);

    // Step 4: Embed the narrative
    const embedding = await step.run("embed-narrative", async () => {
      const provider = createEmbeddingProviderForWorkspace(data.workspace, {
        inputType: "search_document",
      });
      return provider.embed([narrative]);
    });

    // Step 5: UPSERT single vector to Pinecone
    await step.run("upsert-entity-vector", async () => {
      const { indexName, namespaceName } = data.workspace.settings.embedding;
      await pineconeClient.upsert(indexName, [
        {
          id: `ent_${data.entity.externalId}`,  // ONE vector, always overwritten
          values: embedding[0],
          metadata: {
            layer: "entities",
            entityExternalId: data.entity.externalId,
            entityType: data.entity.category,
            provider: event.data.provider,
            latestAction: latestEvent?.sourceType.split(".").pop() ?? null,
            title: narrative.split("\n")[0],
            snippet: narrative.slice(0, 500),
            occurredAt: latestEvent?.occurredAt ?? event.data.occurredAt,
            narrativeHash,
          },
        },
      ], namespaceName);
    });
  }
);
```

### The `entity.graph` function (extracted from `event-interpret.ts`)

```typescript
export const entityGraph = inngest.createFunction(
  {
    id: "apps-console/entity.graph",
    retries: 3,
    timeouts: { finish: "2m" },
  },
  { event: "apps-console/entity.upserted" },
  async ({ event, step }) => {
    // Same resolveEdges() algorithm currently in event-interpret.ts
    // Runs independently — no AI, pure SQL, completes in <500ms
    return await step.run("resolve-edges", () =>
      resolveEdges(
        event.data.workspaceId,
        event.data.internalEventId,
        event.data.provider,
        event.data.entityRefs
      )
    );
  }
);
```

---

## Inngest Event Chain — Full Redesign

### Current chain (what exists)

```
apps-console/event.capture
    → event-store.ts (fast path: store event + entities + junctions)
        emits apps-console/event.stored
    → event-interpret.ts (slow path: classify + embed + resolve edges)
        emits apps-console/event.interpreted
```

### Proposed chain

```
apps-console/event.capture
    → event-store.ts (fast path: store event + entities + junctions)
        emits apps-console/event.stored     (existing — triggers interpret)
        emits apps-console/entity.upserted  (new — fans out to embed + graph)

apps-console/entity.upserted (fans out to 2 independent functions)
    → entity-embed.ts   (build narrative + embed to Pinecone, DEBOUNCED 30s)
    → entity-graph.ts   (resolve edges, pure SQL, MOVED from event-interpret.ts)

apps-console/event.stored
    → event-interpret.ts (slow path: classify + embed to layer="observations" only)
        Note: resolveEdges() REMOVED from this function
        emits apps-console/event.interpreted
```

### Why this separation matters

| Function | AI needed? | Blocked by? | Speed |
|---|---|---|---|
| `entity-embed.ts` | No (embedding only) | Embedding API | ~2s (debounced to 30s) |
| `entity-graph.ts` | No (pure SQL) | DB only | <500ms |
| `event-interpret.ts` | Yes (LLM classify) | LLM + embedding | 5-30s |

If the LLM is rate-limited, entity narratives and graph edges still update in seconds. Only the classification (which feeds `topics` in `workspaceInterpretations`) is delayed.

---

## The Collapse Layer — How Search Works

### Two search intents, two vector layers

| User intent | Example query | Search layer | Result |
|---|---|---|---|
| "What is X?" | "what happened to auth PR" | `layer: "entities"` | Entity narrative with full journey |
| "What happened when?" | "what merged last week" | `layer: "entities"` + filter `occurredAt > 1 week ago` | Entities whose latest event is in the window |
| "Find X context" | "tell me about the sign-in page" | `layer: "entities"` | Entity + related entities via graph |
| "Event-level detail" | "show me all events for PR #99" | `layer: "observations"` or DB query | Individual event rows from `workspaceEvents` |

The default search path queries entity vectors. Event-level vectors (`layer="observations"`) remain for audit trails and detailed timelines.

### `searchLogic` implementation

```typescript
export async function searchLogic(
  auth: AuthContext,
  request: SearchRequest,
  requestId: string
): Promise<SearchResponse> {
  const workspace = await fetchWorkspace(auth.workspaceId);
  const { indexName, namespaceName } = workspace.settings.embedding;

  // Step 1: Embed query
  const embeddingProvider = createEmbeddingProviderForWorkspace(workspace, {
    inputType: "search_query",
  });
  const [queryVector] = await embeddingProvider.embed([request.query]);

  // Step 2: Search entity vectors (one result per entity, no duplicates)
  const matches = await pineconeClient.query(indexName, {
    vector: queryVector,
    topK: request.limit ?? 20,
    filter: {
      layer: "entities",
      ...(request.filters?.entityTypes?.length
        ? { entityType: { $in: request.filters.entityTypes } }
        : {}),
      ...(request.filters?.dateRange
        ? { occurredAt: { $gte: request.filters.dateRange.start } }
        : {}),
    },
    includeMetadata: true,
  }, namespaceName);

  // Step 3: Enrich with DB context
  const entityExternalIds = matches.matches
    .map(m => m.metadata?.entityExternalId as string)
    .filter(Boolean);

  const entities = await db.query.workspaceEntities.findMany({
    where: inArray(workspaceEntities.externalId, entityExternalIds),
  });

  // Step 4: Build response — one result per entity
  const results = entities.map(entity => {
    const match = matches.matches.find(
      m => m.metadata?.entityExternalId === entity.externalId
    );
    return {
      id: entity.externalId,
      title: entity.value ?? entity.key,
      entityType: entity.category,
      latestAction: match?.metadata?.latestAction ?? null,
      provider: match?.metadata?.provider ?? null,
      score: match?.score ?? 0,
      snippet: match?.metadata?.snippet ?? null,
      occurredAt: match?.metadata?.occurredAt ?? null,
    };
  });

  return {
    results,
    meta: { total: results.length, query: request.query, requestId },
  };
}
```

### Why this solves the collapse problem

A PR that went through draft→open→merged has:
- ONE entity row in `workspaceEntities` with `occurrenceCount: 3`
- ONE narrative vector `ent_{externalId}` in Pinecone (`layer: "entities"`)

When the user searches "auth PR", they get ONE result: the auth PR entity. The narrative in the vector contains the full story — "drafted March 1, opened March 2, merged March 3 by @sarah." Not 9 results about the same PR from different moments.

---

## Actor Model — Provider-Scoped

### Actor as an entity

Actors are provider-scoped entities with:
- `category: "actor"` (new entity category, added to the structural types set)
- `key: "{provider}:{username_or_id}"` — e.g. `"github:jeevanpillay"`, `"linear:user-uuid-abc"`
- No lifecycle state — actors accumulate activity via `occurrenceCount` and graph edges

### Adding actor data back to the pipeline

Actors were removed from `PostTransformEvent`. They should return as **relations**, not as a top-level field:

```typescript
// In transformGitHubPullRequest:
relations: [
  // ... existing structural relations (commits, branches, issues) ...

  // Actor relations (new)
  {
    provider: "github",
    entityType: "actor",
    entityId: `github:${pr.user.login}`,
    title: pr.user.login,
    url: pr.user.html_url,
    relationshipType: "authored_by",
  },
  // For merges:
  ...(pr.merged_by ? [{
    provider: "github",
    entityType: "actor",
    entityId: `github:${pr.merged_by.login}`,
    title: pr.merged_by.login,
    url: pr.merged_by.html_url,
    relationshipType: "merged_by",
  }] : []),
],
```

Actor entities get upserted via the existing entity upsert step in `event-store.ts`. `extractFromRelations` maps `entityType: "actor"` to `category: "actor"`. Actor entities build up `occurrenceCount` over time: after 50 merged PRs, the engineer entity has `occurrenceCount: 50`.

### How actors appear in the narrative

When the entity embed function runs for a PR:
1. Fetches events via junction table
2. Each event's `sourceReferences` (stored as JSONB) contains actor relations
3. The narrative builder extracts actors from all events and includes them:

```
pr 12345#99: Add auth middleware
...
authored_by: jeevanpillay
merged_by: sarah
...
```

The embedding captures the actor association semantically. "Who worked on auth" → finds this vector because "jeevanpillay" and "auth" are in the same narrative. No graph traversal needed for simple queries.

### Actor entities also get their own narrative vectors

Actor entities also trigger `entity.upserted` → `entity.embed`. The actor's narrative includes all events the actor participated in:

```
actor github:jeevanpillay: jeevanpillay

Timeline:
  2024-03-01 opened: Add JWT validation to API routes (pr)
  2024-03-05 opened: Fix login redirect bug (pr)
  2024-03-08 merged: Refactor auth middleware (pr)
  2024-03-10 opened: Add SSO support (issue)
```

Search for "jeevanpillay" → returns the actor entity with their activity history. The narrative accumulates over time — this is the accretive property.

### Answering "who implemented the sign-in page"

```
User query: "who implemented this sign in page and what happened to uptime after"

Step 1: Semantic search on entity vectors (layer="entities")
  → finds PR entity "Add sign-in page" (score: 0.94)
  → the narrative contains "authored_by: jeevanpillay" + "deploys → deployment dpl_xyz"

Step 2: Graph traversal from PR entity (optional, for richer context)
  → edge: PR --authored_by--> actor:github:jeevanpillay
  → edge: PR --head_commit--> commit:abc1234
  → edge: commit:abc1234 --deploys--> deployment:dpl_xyz

Step 3: Find post-deployment context
  → Search entity vectors for deployment dpl_xyz
  → Its narrative includes any linked Sentry alerts

Step 4: Synthesize answer
  "The sign-in page was implemented by @jeevanpillay (PR #45, merged 2024-03-05).
   The deployment went live at 14:22. No Sentry alerts in the following 24 hours."
```

---

## What Needs to Change — Summary

### DB changes

**None.** No schema migration needed. The narrative memory pattern works with the existing `workspaceEntities` table — no `currentState` column, no new tables.

The only change is adding `"actor"` to the structural entity types set in `event-store.ts:50-56` and `edge-resolver.ts:14`.

### New Pinecone metadata type: `EntityVectorMetadata`

```typescript
// packages/console-validation/src/schemas/neural.ts (add alongside existing ObservationVectorMetadata)
export const entityVectorMetadataSchema = z.object({
  layer: z.literal("entities"),
  entityExternalId: z.string(),
  entityType: z.string(),        // category: pr, issue, deployment, actor, commit, etc.
  provider: z.string(),          // github, linear, vercel, sentry
  latestAction: z.string().nullable(),  // derived from latest event's sourceType
  title: z.string(),
  snippet: z.string(),
  occurredAt: z.string(),        // ISO timestamp of latest event
  narrativeHash: z.string(),     // content hash for dedup
});
export type EntityVectorMetadata = z.infer<typeof entityVectorMetadataSchema>;
```

### New Inngest functions

1. **`entity-embed.ts`** — triggered by `apps-console/entity.upserted`, debounced per entity, builds narrative + embeds to Pinecone `layer="entities"`
2. **`entity-graph.ts`** — triggered by `apps-console/entity.upserted`, resolves edges (extracted from `event-interpret.ts`)

### Updated Inngest functions

- **`event-store.ts`** — add: emit `entity.upserted` after entity upsert step
- **`event-interpret.ts`** — remove: `resolveEdges()` step; keep: LLM classification + event-level embedding (`layer="observations"`)

### New search implementation

`apps/console/src/lib/search.ts` — implement `searchLogic`:
- Default: query `layer="entities"` in Pinecone, one result per entity
- Time filter: add `occurredAt` range to Pinecone filter
- Event-level detail: query `layer="observations"` or DB `workspaceEvents` directly

### Actor relations (new transformer fields)

Add actor relations to provider transformers:
- `github/transformers.ts`: `authored_by` (PR/issue author), `merged_by` (PR merger), `committed_by` (push committer)
- `linear/transformers.ts`: `created_by` (issue creator), `assigned_to` (issue assignee)
- `sentry/transformers.ts`: no actors available in webhook payloads
- `vercel/transformers.ts`: no actors available in webhook payloads

---

## What to Delete / Reset

### Search system — full reset

The current search system has:
- An unimplemented `searchLogic` stub
- Two incompatible Pinecone metadata schemas in the same namespace
- A tRPC search router that queries `VectorMetadata` fields that don't exist on event vectors
- A frontend that calls `/v1/search` which doesn't exist

**Recommendation: delete and reimplement from scratch:**
- Rewrite `apps/console/src/lib/search.ts` with the `searchLogic` above
- Rewrite `api/console/src/router/org/search.ts` with entity-aware logic
- Create `POST /v1/search` route in `apps/console/src/app/(api)/v1/search/route.ts`
- Consolidate Pinecone metadata: `EntityVectorMetadata` (new, `layer="entities"`) + `ObservationVectorMetadata` (existing, `layer="observations"`)

### Vector cleanup

Existing Pinecone vectors are `layer="observations"` (event-level). After deploying entity-embed, both layers coexist. The search system filters by `layer="entities"` by default. Old `obs_*` vectors remain for event-level queries.

---

## Design Principles

1. **The entity is a narrative, not a snapshot.** State is the full journey — accretive, never overwritten, scaling with complexity.

2. **The DB is event-sourced.** No mutable `currentState` column. State is always derived from the event stack via junction table.

3. **The embedding is the materialized view.** Pinecone `layer="entities"` is a semantic materialized view of entity state, rebuilt on change, debounced to avoid redundant work.

4. **One vector per entity, always.** Vector ID `ent_{externalId}` is deterministic and stable. UPSERT means no duplicates. Search results are naturally collapsed.

5. **Layers are fully decoupled.** Graph resolution and narrative embedding cannot be blocked by the LLM. They run independently. The LLM only gates `layer="observations"` classification.

6. **Actors are entities with narratives.** Actor entities accumulate activity via graph edges and narrative history. No special-case handling — same pipeline as PR/issue entities.

7. **The event log is permanent.** `workspaceEvents` + `layer="observations"` Pinecone vectors are preserved for audit, feed, and timeline views. The entity narrative supplements — they serve different query patterns.

---

## Open Questions

1. **Narrative hash storage**: Where to store the previous narrative hash for content-dedup? Options: (a) as Pinecone metadata on the existing vector (requires a Pinecone fetch before deciding to embed), (b) as a new column `narrative_hash` on `workspaceEntities` (small migration but only one column), (c) in Redis/cache (ephemeral but fast). Recommendation: option (b) if we want persistence, option (c) if we want zero migration.

2. **Entity ID stability for entity upsert**: Current `workspaceEntities.key` for GitHub entities uses `repoId#number` (numeric stable IDs). The `PostTransformEvent.entity.entityId` uses the same format. Need to verify the key used in `event-store.ts` entity upsert matches the entityId from the transformer — this should already be the case via `extractFromRelations`.

3. **`entity.upserted` fan-out granularity**: Should we emit one `entity.upserted` per entity per event (if a PR event touches 4 entities, emit 4 events)? Or only for the primary entity? Recommendation: primary entity only (`sourceEvent.entity`). Related entities (branches, commits) are structural references — their narratives are less valuable to embed than the PR narrative.

4. **Actor cross-provider identity**: Deferred to a later phase. When needed, a `workspaceActorMappings` table can map `(provider, actorId)` to a canonical `actorEntityId`, enabling "show all work by this person across GitHub + Linear".

5. **Temporal search UX**: "What happened to auth last week" should filter entity vectors by `occurredAt >= 1 week ago` in Pinecone metadata. This works because `occurredAt` is updated on every narrative re-embed. For event-level detail within a time window, fall back to `layer="observations"`.

6. **Narrative builder extensibility**: As we add new providers or entity types, the narrative builder needs to handle new attribute shapes. Should we formalize a per-entity-type narrative strategy, or keep one generic builder? Recommendation: one generic builder that handles common attribute patterns, with an escape hatch for provider-specific sections.

---

## Code References

### Current Architecture (what exists in codebase)
- `api/console/src/inngest/workflow/neural/event-store.ts` — fast path, entity upsert at lines 430-500
- `api/console/src/inngest/workflow/neural/event-interpret.ts` — slow path, edge resolution at line 384
- `api/console/src/inngest/workflow/neural/edge-resolver.ts` — graph resolution algorithm
- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts` — `extractFromReferences` at line 181
- `api/console/src/inngest/workflow/neural/scoring.ts` — significance scoring
- `db/console/src/schema/tables/workspace-entities.ts` — entity table, no `currentState` column
- `db/console/src/schema/tables/workspace-events.ts` — event table, `sourceReferences` JSONB
- `db/console/src/schema/tables/workspace-entity-events.ts` — junction table
- `db/console/src/schema/tables/workspace-edges.ts` — graph adjacency list
- `packages/console-providers/src/post-transform-event.ts` — new schema with `entity.state`
- `packages/console-providers/src/providers/github/transformers.ts` — 5 transformers with lifecycle state
- `apps/console/src/lib/search.ts` — `searchLogic` stub (unimplemented)
- `api/console/src/router/org/search.ts` — tRPC search (API-key-only, queries wrong metadata type)

### New Files (to create)
- `api/console/src/inngest/workflow/neural/entity-embed.ts` — narrative builder + Pinecone upsert
- `api/console/src/inngest/workflow/neural/entity-graph.ts` — edge resolution (extracted from event-interpret.ts)
- `api/console/src/inngest/workflow/neural/narrative-builder.ts` — `buildEntityNarrative()` function

## Related Research

- `thoughts/shared/research/2026-03-13-observation-pipeline-architecture.md` — full 4-layer redesign proposal (Entity Store → Graph → Vector → Observation)
- `thoughts/shared/plans/2026-03-13-entity-system-implementation.md` — Phase 1-3 implementation plan for new `PostTransformEvent` schema
- `thoughts/shared/plans/2026-03-13-entity-system-redesign.md` — design spec for entity-oriented PostTransformEvent
