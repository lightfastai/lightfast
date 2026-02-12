---
date: 2026-02-09T11:36:06+0000
researcher: Claude Sonnet 4.5
git_commit: c64dd2538ef8ecfbc22f3c7bfa15454a0257ae1f
branch: main
repository: lightfast
topic: "Why search results always show 'Topics linear' only in the result list"
tags: [research, codebase, workspace-search, clusters, neural-observation]
status: complete
last_updated: 2026-02-09
last_updated_by: Claude Sonnet 4.5
---

# Research: Why Search Results Always Show "Topics linear" Only

**Date**: 2026-02-09T11:36:06+0000
**Researcher**: Claude Sonnet 4.5
**Git Commit**: c64dd2538ef8ecfbc22f3c7bfa15454a0257ae1f
**Branch**: main
**Repository**: lightfast

## Research Question

Why does the workspace search page (`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/search/page.tsx`) always show "Topics linear" only in the search result list?

## Summary

The search results display "Topics linear" because workspace observation clusters use the source name (e.g., "linear") as their `topicLabel` field. This happens due to the topic extraction logic that adds the source name as the first topic in the array, and the cluster creation logic that uses the first topic as the `topicLabel`. The UI renders these cluster topics directly from the `context.clusters` array returned by the `/v1/search` API.

## Detailed Findings

### 1. UI Rendering Flow

**Component: SearchResultsList** ([search-results-list.tsx:44-56](https://github.com/lightfastai/lightfast/blob/c64dd2538ef8ecfbc22f3c7bfa15454a0257ae1f/apps/console/src/components/search-results-list.tsx#L44-L56))

The component renders cluster topics from `searchResults.context.clusters`:

```typescript
{searchResults.context.clusters &&
  searchResults.context.clusters.length > 0 && (
    <div>
      <span className="text-muted-foreground">Topics: </span>
      {searchResults.context.clusters.map((c, i) => (
        <Badge key={i} variant="secondary" className="mr-1 text-xs">
          {c.topic ?? "Uncategorized"}
          {c.keywords.length > 0 &&
            ` (${c.keywords.slice(0, 2).join(", ")})`}
        </Badge>
      ))}
    </div>
  )}
```

The badge displays `c.topic` which comes from the cluster's `topicLabel` field.

### 2. API Response Construction

**File: apps/console/src/lib/v1/search.ts** ([search.ts:111-124](https://github.com/lightfastai/lightfast/blob/c64dd2538ef8ecfbc22f3c7bfa15454a0257ae1f/apps/console/src/lib/v1/search.ts#L111-L124))

The `/v1/search` API constructs the response context from cluster search results:

```typescript
const context: V1SearchContext | undefined = input.includeContext
  ? {
      clusters: searchResult.clusters.slice(0, 2).map((c) => ({
        topic: c.topicLabel,
        summary: c.summary,
        keywords: c.keywords,
      })),
      relevantActors: searchResult.actors.slice(0, 3).map((a) => ({
        displayName: a.displayName,
        expertiseDomains: a.expertiseDomains,
      })),
    }
  : undefined;
```

The `topic` field is mapped from `c.topicLabel` coming from the database.

### 3. Cluster Search Implementation

**File: apps/console/src/lib/neural/cluster-search.ts** ([cluster-search.ts:45-83](https://github.com/lightfastai/lightfast/blob/c64dd2538ef8ecfbc22f3c7bfa15454a0257ae1f/apps/console/src/lib/neural/cluster-search.ts#L45-L83))

The cluster search queries the `workspaceObservationClusters` table and retrieves the `topicLabel` field:

```typescript
const dbClusters = await db.query.workspaceObservationClusters.findMany({
  columns: {
    id: true,
    topicLabel: true,
    summary: true,
    keywords: true,
    observationCount: true,
    topicEmbeddingId: true,
  },
  where: and(
    eq(schema.workspaceObservationClusters.workspaceId, workspaceId),
    inArray(schema.workspaceObservationClusters.topicEmbeddingId, embeddingIds)
  ),
});
```

### 4. Root Cause: Cluster Creation Logic

**File: api/console/src/inngest/workflow/neural/cluster-assignment.ts** ([cluster-assignment.ts:212-270](https://github.com/lightfastai/lightfast/blob/c64dd2538ef8ecfbc22f3c7bfa15454a0257ae1f/api/console/src/inngest/workflow/neural/cluster-assignment.ts#L212-L270))

When a new cluster is created, the `topicLabel` is set to the **first topic in the topics array**:

```typescript
const topicLabel = topics[0] ?? title.slice(0, 100);

await db.insert(schema.workspaceObservationClusters).values({
  externalId: nanoid(),
  workspaceId,
  topicLabel,  // <-- Uses first topic from array
  keywords: topics,
  primaryEntities: entityIds.slice(0, 3),
  primaryActors: [actorId],
  status: "open",
  observationCount: 1,
  // ... other fields
});
```

**File: api/console/src/inngest/workflow/neural/observation-capture.ts** ([observation-capture.ts:123-149](https://github.com/lightfastai/lightfast/blob/c64dd2538ef8ecfbc22f3c7bfa15454a0257ae1f/api/console/src/inngest/workflow/neural/observation-capture.ts#L123-L149))

The topics array is built with the **source name as the first topic**:

```typescript
const topics: string[] = [];

// Add source as first topic
topics.push(sourceEvent.source);  // <-- "linear" is added first

// Add observation type
if (sourceEvent.observationType) {
  topics.push(sourceEvent.observationType);
}

// Extract labels from references (if any)
for (const ref of sourceEvent.references ?? []) {
  if (ref.type === "label" && ref.id) {
    topics.push(ref.id);
  }
}

// Extract common keywords from title
const title = sourceEvent.title.toLowerCase();
const keywords = ["fix", "feat", "refactor", "test", "docs", "chore", "ci", "perf"];
for (const keyword of keywords) {
  if (title.includes(keyword)) topics.push(keyword);
}

return [...new Set(topics)]; // Deduplicate
```

The topic extraction order is:
1. **Source name** (e.g., "linear") - line 127
2. Observation type (e.g., "issue") - line 130
3. Labels from references - lines 133-137
4. Keywords from title - lines 142-146
5. LLM-generated topics (added later) - lines 720-725

Since the source name is always first and `topicLabel` uses `topics[0]`, all clusters from Linear events get `topicLabel="linear"`.

### 5. Database Schema

**File: db/console/src/schema/tables/workspace-observation-clusters.ts** ([workspace-observation-clusters.ts:19-150](https://github.com/lightfastai/lightfast/blob/c64dd2538ef8ecfbc22f3c7bfa15454a0257ae1f/db/console/src/schema/tables/workspace-observation-clusters.ts#L19-L150))

The `workspaceObservationClusters` table stores:
- `topicLabel` (VARCHAR(255)): Human-readable topic label - line 49
- `keywords` (JSONB): Array of all topics - line 59
- `summary` (TEXT): LLM-generated summary (nullable) - line 85

The `topicLabel` field is what gets displayed in the UI as "Topics: linear".

## Architecture Documentation

### Data Flow

```
Linear Webhook
    ↓
SourceEvent (source="linear")
    ↓
Topic Extraction (source added first)
    ↓
topics = ["linear", "issue", ...]
    ↓
Cluster Assignment
    ↓
New Cluster: topicLabel = topics[0] = "linear"
    ↓
Database: workspaceObservationClusters.topicLabel = "linear"
    ↓
/v1/search API: context.clusters[].topic = "linear"
    ↓
UI: Badge displays "Topics: linear"
```

### Key Components

1. **Webhook Transformer** - Transforms Linear events into SourceEvents
2. **Observation Capture Workflow** - Extracts topics and classifies observations
3. **Cluster Assignment** - Creates or assigns to clusters using affinity scoring
4. **Cluster Search** - Queries Pinecone and enriches with database metadata
5. **Search API** - Returns cluster context with top 2 clusters
6. **Search UI** - Renders cluster topics as badges

## Code References

- `apps/console/src/components/search-results-list.tsx:44-56` - UI rendering of cluster topics
- `apps/console/src/lib/v1/search.ts:111-124` - API context construction
- `apps/console/src/lib/neural/cluster-search.ts:45-83` - Database query for clusters
- `api/console/src/inngest/workflow/neural/cluster-assignment.ts:219` - topicLabel assignment
- `api/console/src/inngest/workflow/neural/observation-capture.ts:127` - Source name as first topic
- `db/console/src/schema/tables/workspace-observation-clusters.ts:49` - topicLabel field definition

## Historical Context (from thoughts/)

No directly related historical research documents found in the thoughts/ directory for this specific issue.

## Related Research

This is the first research document on workspace search cluster topic display behavior.

## Open Questions

1. Should the UI display more semantic topics (from LLM classification) instead of the source name?
2. Should `topicLabel` prioritize LLM-generated topics over source names?
3. Are there cases where showing "linear" as a topic provides value to users?
4. Should the UI show multiple topics instead of just displaying the single `topicLabel`?
5. Should cluster summaries (when available) be displayed instead of or alongside topics?
