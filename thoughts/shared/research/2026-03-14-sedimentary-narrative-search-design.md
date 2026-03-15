---
date: 2026-03-14T08:45:00+00:00
researcher: claude
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Sedimentary narrative pattern — replacing the 10-event cap with stratum-based narrative construction and multi-dimensional search"
tags: [research, design, entity-lifecycle, search, pinecone, sedimentary-narrative, temporal-search, actor-search]
status: complete
last_updated: 2026-03-14
supersedes: "Replaces the 10-event sliding window approach from 2026-03-13-entity-lifecycle-search-design.md"
---

# Research: Sedimentary Narrative Pattern

**Date**: 2026-03-14
**Git Commit**: `4ec3c541776200e318c670c5064af752d9e142f0`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

The entity lifecycle search design (2026-03-13) proposed a 10-event sliding window to build entity narratives for embedding. This creates systematic history amnesia — long-lived entities lose their founding context as new events push old ones out. What is the most accretive, efficient approach that works at any event count?

---

## The Problem With Sliding Windows

A Linear issue that bounced through 15 state transitions loses events 1-5 permanently under a `LIMIT 10` cap. The question "who originally opened this issue" could be in event #12. The cap optimizes for embedding cost but creates information loss that scales with entity maturity — the entities with the richest histories produce the worst narratives.

The sliding window caps the wrong thing: **number of events**, when the constraint should be **narrative text length** (bounded by the embedding model's token limit).

---

## The Sedimentary Narrative Pattern

Inspired by geological strata. Instead of "last 10 events → narrative," the narrative is built from **three layers** with different retention policies:

```
┌──────────────────────────────────────────────┐
│  SURFACE — volatile, always fresh            │
│  Last 2-3 events in full detail              │
│  Current attributes, graph edges             │
├──────────────────────────────────────────────┤
│  FOSSIL — accumulated, grows bounded         │
│  All state transitions (compressed journey)  │
│  All actors ever (deduplicated by role)       │
│  Total occurrence count                      │
├──────────────────────────────────────────────┤
│  BEDROCK — immutable, set once               │
│  First event title, actor, date              │
│  Entity identity (type, key, provider)       │
└──────────────────────────────────────────────┘
```

**Nothing is ever dropped.** Events are *compressed* into the fossil layer, not evicted. A PR that went through 50 review cycles doesn't show all 50 reviews — it shows the compressed journey (`opened → reviewed → approved → merged`) + accumulated actors (`reviewed_by: alice, bob, charlie`) + the founding context from event #1 + the last 2 detailed events.

---

## Fetching Strata — Targeted SQL Queries

Each stratum has its own query, not a generic "last N events" fetch. All queries are indexed on `entityId` via the junction table and run in parallel.

```typescript
async function fetchNarrativeStrata(entityId: number, workspaceId: string) {
  const [bedrock, fossil, surface, edges] = await Promise.all([
    // BEDROCK: first event ever (1 row)
    db.select({
      title: workspaceEvents.title,
      occurredAt: workspaceEvents.occurredAt,
      sourceType: workspaceEvents.sourceType,
      sourceReferences: workspaceEvents.sourceReferences,
    })
      .from(workspaceEntityEvents)
      .innerJoin(workspaceEvents, eq(workspaceEntityEvents.eventId, workspaceEvents.id))
      .where(eq(workspaceEntityEvents.entityId, entityId))
      .orderBy(asc(workspaceEvents.occurredAt))
      .limit(1),

    // FOSSIL: all distinct actions in chronological order (bounded by action cardinality)
    db.select({
      sourceType: workspaceEvents.sourceType,
      firstSeen: sql<string>`MIN(${workspaceEvents.occurredAt})`,
    })
      .from(workspaceEntityEvents)
      .innerJoin(workspaceEvents, eq(workspaceEntityEvents.eventId, workspaceEvents.id))
      .where(eq(workspaceEntityEvents.entityId, entityId))
      .groupBy(workspaceEvents.sourceType)
      .orderBy(sql`MIN(${workspaceEvents.occurredAt})`),

    // SURFACE: last 3 events (3 rows)
    db.select({
      title: workspaceEvents.title,
      occurredAt: workspaceEvents.occurredAt,
      sourceType: workspaceEvents.sourceType,
      sourceReferences: workspaceEvents.sourceReferences,
      metadata: workspaceEvents.metadata,
    })
      .from(workspaceEntityEvents)
      .innerJoin(workspaceEvents, eq(workspaceEntityEvents.eventId, workspaceEvents.id))
      .where(eq(workspaceEntityEvents.entityId, entityId))
      .orderBy(desc(workspaceEvents.occurredAt))
      .limit(3),

    // GRAPH: edges
    db.select()
      .from(workspaceEdgesTable)
      .where(eq(workspaceEdgesTable.sourceEntityId, entityId))
      .limit(10),
  ]);

  return { bedrock, fossil, surface, edges };
}
```

### Query Cost Profile

| Stratum | Query cost | Rows returned | Grows with event count? |
|---|---|---|---|
| Bedrock | Index seek + LIMIT 1 | 1 | No |
| Fossil | Index seek + GROUP BY | ~5-15 (bounded by action type cardinality) | No |
| Surface | Index seek + LIMIT 3 | 3 | No |
| Edges | Index seek + LIMIT 10 | ≤10 | No |

**Total: 4 parallel queries, ~20 rows max, regardless of entity lifetime.** The sliding window fetches 10 full event rows — this fetches fewer rows with more information.

The fossil query's `GROUP BY sourceType` is bounded by the cardinality of action types per entity. A PR has at most ~8 actions (opened, reviewed, labeled, approved, merged, closed, reopened, converted). A Linear issue has ~6-10. This does not grow with event count — a PR with 300 events still produces ~8 fossil rows.

---

## The Narrative Builder

```typescript
function buildSedimentaryNarrative(
  entity: WorkspaceEntity,
  strata: NarrativeStrata,
): string {
  const sections: string[] = [];

  // ── BEDROCK: identity + origin (never changes)
  const origin = strata.bedrock[0];
  sections.push(`${entity.category} ${entity.key}: ${origin?.title ?? entity.key}`);
  if (origin) {
    const date = origin.occurredAt.toISOString().split("T")[0];
    const action = origin.sourceType.split(".").pop();
    sections.push(`Origin: ${action} on ${date} — ${origin.title}`);
  }

  // ── FOSSIL: compressed journey + accumulated actors
  if (strata.fossil.length > 1) {
    const journey = strata.fossil
      .map((f) => f.sourceType.split(".").pop())
      .join(" → ");
    sections.push(`Journey: ${journey} (${entity.occurrenceCount} events)`);
  }

  // Actors: accumulated from ALL events' sourceReferences
  const actors = new Map<string, Set<string>>();
  for (const evt of [...strata.bedrock, ...strata.surface]) {
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
        .join("\n"),
    );
  }

  // ── SURFACE: latest attributes + recent timeline
  const latest = strata.surface[0];
  const attrs = latest?.metadata ?? {};
  const context: string[] = [];
  // Provider-agnostic: iterate attributes, emit non-null scalars
  for (const [key, val] of Object.entries(attrs)) {
    if (val != null && context.length < 5) {
      context.push(`${key}: ${val}`);
    }
  }
  if (context.length) sections.push(context.join(" | "));

  const timeline = [...strata.surface].reverse().map((e) => {
    const date = e.occurredAt.toISOString().split("T")[0];
    const action = e.sourceType.split(".").pop();
    return `  ${date} ${action}: ${e.title}`;
  });
  sections.push(`Recent:\n${timeline.join("\n")}`);

  // ── GRAPH: related entities
  if (strata.edges.length) {
    const edgeLines = strata.edges.map(
      (e) => `  ${e.relationshipType} → ${e.targetCategory} ${e.targetKey}`,
    );
    sections.push(`Related:\n${edgeLines.join("\n")}`);
  }

  return sections.join("\n\n");
}
```

### Example Output

For a PR with 47 events across 3 months:

```
pr 12345#99: Add auth middleware

Origin: opened on 2024-03-01 — Add JWT validation to all API routes

Journey: opened → review-requested → reviewed → approved → merged (47 events)

authored_by: jeevanpillay
reviewed_by: alice, bob
merged_by: sarah

repo: lightfastai/lightfast | +120/-30 | feature/auth → main

Recent:
  2024-03-03 approved: Code review approved by @alice
  2024-03-03 merged: Merged into main by @sarah

Related:
  fixes → issue 12345678#7
  deploys → deployment dpl_abc123
```

Compare this to the sliding window at event #47: events 1-37 are gone, the origin is lost, and the journey is truncated to the last 10 actions.

### Provider-Agnostic Attribute Rendering

The original design hardcoded GitHub-specific attribute names (`attrs.repoFullName`, `attrs.additions`, `attrs.headRef`). The sedimentary builder iterates `Object.entries(attrs)` instead — provider-agnostic, no per-provider if-branches. As new providers are added, their attributes appear in the narrative without code changes.

---

## Multi-Dimensional Search

The sedimentary narrative serves dual purpose:
1. **As embedding input** — captures semantic meaning for similarity search
2. **As metadata source** — extracted structured fields (actors, dates, states) enable precise filtering

### Pinecone Metadata Derived From Strata

```typescript
const metadata: EntityVectorMetadata = {
  layer: "entities",
  entityExternalId: entity.externalId,
  entityType: entity.category,        // "pr", "issue", "deployment", "actor"
  provider,

  // TEMPORAL — two timestamps, not one
  originAt: bedrock[0].occurredAt,     // Unix epoch (number)
  latestAt: surface[0].occurredAt,     // Unix epoch (number)

  // ACTOR — flat array, no roles (roles live in narrative text)
  actors: [...allActorNames],          // ["jeevanpillay", "sarah", "alice"]

  // STATE
  latestAction: surface[0].sourceType.split(".").pop(),  // "merged"

  // IDENTITY
  title: bedrock[0].title,
  snippet: narrative.slice(0, 500),
  narrativeHash,
};
```

Two critical departures from the original design:

1. **`originAt` + `latestAt`** instead of a single `occurredAt`. A PR created in January and merged in March has `originAt: jan_15` and `latestAt: mar_03`. Without both, "what was created in January" is unanswerable — the single `occurredAt` would show March.

2. **`actors: string[]`** as a flat array. Pinecone's `$in` operator checks array membership. Roles (authored_by vs merged_by) aren't in metadata — they're in the narrative text for the embedding to capture semantically.

### Temporal Search — "What merged last week?"

```typescript
filter: {
  layer: "entities",
  latestAt: { $gte: oneWeekAgo },
  latestAction: "merged",
}
vector: embed("merged last week")
```

The two-timestamp model enables **lifecycle window** queries. "What was created in January but is still open?":

```typescript
filter: {
  originAt: { $gte: jan1, $lte: jan31 },
  latestAction: { $nin: ["merged", "closed"] },
}
```

A single `occurredAt` cannot express this. The bedrock/surface separation maps directly to `originAt`/`latestAt`.

### Actor Search — "What did jeevanpillay work on?"

```typescript
filter: {
  layer: "entities",
  actors: { $in: ["jeevanpillay"] },
}
vector: embed("work activity contributions")
```

The embedding ranks results by *what kind* of work. The filter ensures every result involves jeevanpillay. The narrative text preserves roles — the search result snippet shows `authored_by: jeevanpillay` or `merged_by: jeevanpillay` without needing a separate structured query.

"Who merged the auth PR" doesn't need an actor filter at all — semantic search for "auth PR merge" finds the entity, and the narrative snippet contains `merged_by: sarah`.

### Semantic Search — "What happened to auth?"

```typescript
filter: {
  layer: "entities",
}
vector: embed("what happened to auth")
```

Pure cosine similarity. The sedimentary narrative captures identity, journey, actors, context, and graph in one embedding. The query "auth" has high similarity to all of these signals.

### Intersection — All Three at Once

"What did jeevanpillay deploy last week?"

```typescript
filter: {
  layer: "entities",
  actors: { $in: ["jeevanpillay"] },
  latestAt: { $gte: oneWeekAgo },
  entityType: "deployment",
}
vector: embed("deploy")
```

One Pinecone query. Three dimensions intersected. No graph traversal, no multi-hop joins, no post-filtering.

---

## The Search Function

```typescript
async function searchLogic(
  auth: AuthContext,
  request: SearchRequest,
  requestId: string,
): Promise<SearchResponse> {
  const workspace = await fetchWorkspace(auth.workspaceId);
  const { indexName, namespaceName } = workspace.settings.embedding;

  // 1. Embed the raw query text
  const provider = createEmbeddingProviderForWorkspace(workspace, {
    inputType: "search_query",
  });
  const [queryVector] = await provider.embed([request.query]);

  // 2. Build filter from request — always entity layer
  const filter: Record<string, unknown> = { layer: "entities" };

  if (request.filters?.entityTypes?.length) {
    filter.entityType = { $in: request.filters.entityTypes };
  }
  if (request.filters?.actors?.length) {
    filter.actors = { $in: request.filters.actors };
  }
  if (request.filters?.originAfter) {
    filter.originAt = { $gte: request.filters.originAfter };
  }
  if (request.filters?.activeAfter) {
    filter.latestAt = { $gte: request.filters.activeAfter };
  }
  if (request.filters?.state) {
    filter.latestAction = request.filters.state;
  }

  // 3. Single Pinecone query — semantic + structured
  const matches = await pineconeClient.query(indexName, {
    vector: queryVector,
    topK: request.limit ?? 20,
    filter,
    includeMetadata: true,
  }, namespaceName);

  // 4. Return — one result per entity, no dedup needed
  return {
    results: matches.matches.map((m) => ({
      id: m.metadata.entityExternalId,
      title: m.metadata.title,
      entityType: m.metadata.entityType,
      provider: m.metadata.provider,
      latestAction: m.metadata.latestAction,
      actors: m.metadata.actors,
      originAt: m.metadata.originAt,
      latestAt: m.metadata.latestAt,
      score: m.score,
      snippet: m.metadata.snippet,
    })),
    meta: { total: matches.matches.length, query: request.query, requestId },
  };
}
```

No DB enrichment step needed. Everything the UI needs is in Pinecone metadata — derived from the strata at embed time.

---

## Two-Tier UX

| Tier | Source | Returns | User action |
|---|---|---|---|
| **Search results** | Pinecone `layer: "entities"` | Entity cards with snippet, actors, state, dates | User types a query |
| **Entity timeline** | DB `workspaceEvents` via junction | Full event-level detail for one entity | User clicks an entity card |

Search never touches the DB. Timeline detail never touches Pinecone. Clean separation.

## Observation Layer Role

`layer: "observations"` (the existing 3-view event vectors) remains for a different query pattern: **"show me the raw feed."** The audit log, the activity stream, the chronological firehose.

| Query intent | Layer | Example |
|---|---|---|
| "What is X?" | `entities` | "what happened to auth" → one PR entity |
| "Who did X?" | `entities` + actor filter | "who deployed last week" → deployment entities with actor metadata |
| "When did X happen?" | `entities` + temporal filter | "what merged in March" → entities with latestAt in March |
| "Show me everything" | `observations` | "all events for PR #99" → individual event vectors |

---

## Comparison: Sliding Window vs Sedimentary

| Dimension | Sliding window (10-event cap) | Sedimentary narrative |
|---|---|---|
| Founding context | Lost after 10 events | Always preserved (bedrock) |
| State journey | Truncated to last 10 actions | Complete, compressed (fossil) |
| Actor accumulation | Only actors from last 10 events | All actors ever (fossil + surface) |
| Query cost | 1 query, 10 rows | 4 parallel queries, ~20 rows max |
| Grows with event count | No (capped) | No (bounded by action cardinality) |
| Temporal search | Single `occurredAt` (latest only) | `originAt` + `latestAt` (lifecycle window) |
| Actor search | Not in metadata | `actors[]` array in metadata |
| Provider-specific code | Hardcoded attribute if-branches | `Object.entries()` iteration |
| Backfill behavior | Last 10 chronological events (could be months old) | Origin + journey + latest 3 (always coherent) |

---

## Relationship to Parent Design

This research replaces **only** the narrative builder and Pinecone metadata sections of `2026-03-13-entity-lifecycle-search-design.md`. The following elements from the parent design remain unchanged:

- Debounced `entity.embed` Inngest function (30s per entity)
- Content hash dedup before embedding
- `ent_{externalId}` stable vector ID with Pinecone UPSERT
- `layer: "entities"` vs `layer: "observations"` separation
- No `currentState` DB column — state always derived
- Actor entities as `category: "actor"` with narrative vectors

The following elements from the parent design are **superseded**:

- `events.map(...)` sliding window builder → replaced by `fetchNarrativeStrata()` + `buildSedimentaryNarrative()`
- Single `occurredAt` in Pinecone metadata → replaced by `originAt` + `latestAt`
- No actor metadata → replaced by `actors: string[]` array
- Hardcoded `attrs.repoFullName` etc. → replaced by provider-agnostic `Object.entries()` iteration

---

## Hard Blockers From Parent Design (Still Apply)

These architectural issues from the critical analysis of the parent design are not resolved by this research and must be addressed separately:

1. **Race condition**: `entity-embed` and `entity-graph` both triggered by `entity.upserted` — entity-embed fetches stale edges because entity-graph hasn't written them yet. Fix: chain entity-embed after entity-graph, or accept stale edges on first embed.

2. **Missing `internalEventId` in `entity.upserted` payload**: `resolveEdges()` requires the BIGINT PK and `entityRefs` array — neither is in the proposed event payload.

3. **Actor entityType doesn't exist**: No transformer currently produces `entityType: "actor"` relations. The actor sections of narratives will be empty until transformers are updated.

---

## Related Research

- `thoughts/shared/research/2026-03-13-entity-lifecycle-search-design.md` — parent design (narrative memory pattern, debounced embedding, entity vectors)
- `thoughts/shared/research/2026-03-13-observation-pipeline-architecture.md` — 4-layer redesign proposal
- `thoughts/shared/plans/2026-03-13-entity-system-implementation.md` — Phase 1-3 implementation plan for PostTransformEvent schema
