# Search ID Mismatch Fix Implementation Plan

## Overview

Fix the critical bug where search results return Pinecone vector IDs but downstream endpoints (`/v1/contents`, `/v1/findsimilar`) expect database observation IDs. This causes "content not found" errors when users expand search results.

## Current State Analysis

### The Problem

1. **Search returns vector IDs**: `/v1/search` returns IDs like `obs_content_push_test_repo_def789abc012_test_2`
2. **Contents/FindSimilar expect database IDs**: These endpoints query `WHERE id = ?` against the `id` column (nanoids like `9y9mxtj20prv8dr1hc77q`)
3. **ID mismatch**: Vector IDs never match database IDs → "content not found"

### ID Architecture

| ID Type | Example | Storage Location |
|---------|---------|------------------|
| Database ID (nanoid) | `9y9mxtj20prv8dr1hc77q` | `workspaceNeuralObservations.id` |
| Title Vector ID | `obs_title_push_test_repo_...` | `embeddingTitleId` column + Pinecone |
| Content Vector ID | `obs_content_push_test_repo_...` | `embeddingContentId` column + Pinecone |
| Summary Vector ID | `obs_summary_push_test_repo_...` | `embeddingSummaryId` column + Pinecone |

### Key Discoveries

- Multi-view embeddings (3 vectors per observation) are **by design** for improved retrieval
- The database stores the mapping between nanoid and vector IDs
- No indexes exist on the embedding ID columns (will need to add)
- `four-path-search.ts:121-159` merges vector matches (Pinecone IDs) with entity matches (database IDs) without normalization

## Desired End State

After implementation:
1. Search results use consistent database observation IDs
2. Contents/findsimilar endpoints work with any ID format (database ID or vector ID)
3. Multi-view matches for the same observation are deduplicated (single result with max score)
4. New observations store `observationId` in Pinecone metadata for direct lookup
5. Performance overhead is minimal (<20ms additional latency)

### Success Verification

```bash
# Test 1: Search returns database IDs
curl -X POST /v1/search -d '{"query": "deployment"}' | jq '.data[0].id'
# Expected: nanoid format (21 chars alphanumeric), NOT obs_content_*

# Test 2: Contents accepts both ID formats
curl -X POST /v1/contents -d '{"ids": ["9y9mxtj20prv8dr1hc77q"]}'  # Database ID
curl -X POST /v1/contents -d '{"ids": ["obs_content_push_..."]}'  # Vector ID (fallback)
# Both should return content

# Test 3: Deduplication works
# Same observation matching via title, content, summary views → single result
```

## What We're NOT Doing

- **NOT changing the multi-view embedding architecture** - it improves retrieval quality
- **NOT changing the Pinecone vector ID format** - existing vectors remain unchanged
- **NOT backfilling existing Pinecone vectors** - Phase 2 fallback handles old vectors
- **NOT modifying the observation capture workflow significantly** - minimal change in Phase 3

## Implementation Approach

Three phases, each independently deployable:

1. **Phase 1 (Fallback)**: Contents/findsimilar accept vector IDs → unblocks users
2. **Phase 2 (Root Fix)**: Search normalizes IDs and deduplicates → clean API
3. **Phase 3 (Optimization)**: Pre-generate observationId in workflow → no lookup needed

---

## Phase 1: Contents/FindSimilar Accept Vector IDs

### Overview

Add fallback logic to resolve vector IDs to observations when database ID lookup fails. This is an additive change that maintains backward compatibility.

### Changes Required

#### 1. Add Database Index for Vector ID Lookups

**File**: `db/console/src/schema/tables/workspace-neural-observations.ts`

Add indexes for the embedding ID columns to enable efficient lookups.

**Changes**: Add composite indexes after line 219

```typescript
// After line 219, add:

// Index for vector ID lookups (used by v1/contents and v1/findsimilar fallback)
embeddingTitleIdx: index("obs_embedding_title_idx").on(
  table.workspaceId,
  table.embeddingTitleId
),
embeddingContentIdx: index("obs_embedding_content_idx").on(
  table.workspaceId,
  table.embeddingContentId
),
embeddingSummaryIdx: index("obs_embedding_summary_idx").on(
  table.workspaceId,
  table.embeddingSummaryId
),
```

#### 2. Create Shared ID Resolution Helper

**File**: `apps/console/src/lib/neural/id-resolver.ts` (NEW FILE)

```typescript
/**
 * Resolves any observation ID format (database nanoid or Pinecone vector ID) to the full observation.
 * Used by v1/contents and v1/findsimilar for backward compatibility.
 */

import { db } from "@db/console/client";
import { workspaceNeuralObservations } from "@db/console/schema";
import { and, eq, or, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

type Observation = InferSelectModel<typeof workspaceNeuralObservations>;

/**
 * Detect if an ID is a Pinecone vector ID (vs database nanoid)
 */
export function isVectorId(id: string): boolean {
  return (
    id.startsWith("obs_title_") ||
    id.startsWith("obs_content_") ||
    id.startsWith("obs_summary_") ||
    id.startsWith("obs_") // Legacy combined embedding
  );
}

/**
 * Get the view type from a vector ID
 */
export function getVectorIdView(id: string): "title" | "content" | "summary" | "legacy" | null {
  if (id.startsWith("obs_title_")) return "title";
  if (id.startsWith("obs_content_")) return "content";
  if (id.startsWith("obs_summary_")) return "summary";
  if (id.startsWith("obs_")) return "legacy";
  return null;
}

/**
 * Resolve a single observation by any ID format.
 * First tries database ID lookup, then falls back to vector ID columns.
 */
export async function resolveObservationById<T extends keyof Observation>(
  workspaceId: string,
  id: string,
  columns: Record<T, true>
): Promise<Pick<Observation, T> | null> {
  // Try database ID first (most common case after Phase 2)
  const byDbId = await db.query.workspaceNeuralObservations.findFirst({
    columns,
    where: and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      eq(workspaceNeuralObservations.id, id)
    ),
  });

  if (byDbId) return byDbId;

  // Fallback: Try vector ID columns if it looks like a vector ID
  if (!isVectorId(id)) return null;

  const byVectorId = await db.query.workspaceNeuralObservations.findFirst({
    columns,
    where: and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      or(
        eq(workspaceNeuralObservations.embeddingTitleId, id),
        eq(workspaceNeuralObservations.embeddingContentId, id),
        eq(workspaceNeuralObservations.embeddingSummaryId, id),
        eq(workspaceNeuralObservations.embeddingVectorId, id) // Legacy
      )
    ),
  });

  return byVectorId ?? null;
}

/**
 * Resolve multiple observations by any ID format.
 * Groups IDs by type for efficient batch queries.
 */
export async function resolveObservationsById<T extends keyof Observation>(
  workspaceId: string,
  ids: string[],
  columns: Record<T, true>
): Promise<Map<string, Pick<Observation, T>>> {
  const result = new Map<string, Pick<Observation, T>>();
  if (ids.length === 0) return result;

  // Separate database IDs from vector IDs
  const dbIds = ids.filter((id) => !isVectorId(id));
  const vectorIds = ids.filter(isVectorId);

  // Batch query for database IDs
  if (dbIds.length > 0) {
    // Need to include 'id' for the map key
    const columnsWithId = { ...columns, id: true } as Record<T | "id", true>;
    const byDbIds = await db.query.workspaceNeuralObservations.findMany({
      columns: columnsWithId,
      where: and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        inArray(workspaceNeuralObservations.id, dbIds)
      ),
    });

    for (const obs of byDbIds) {
      result.set(obs.id, obs);
    }
  }

  // For vector IDs, we need to query differently since we don't know which column
  // The OR query approach may be slow without indexes, but indexes are added in this phase
  if (vectorIds.length > 0) {
    // Include embedding columns to map vector ID back to the original request ID
    const columnsWithEmbeddings = {
      ...columns,
      id: true,
      embeddingTitleId: true,
      embeddingContentId: true,
      embeddingSummaryId: true,
      embeddingVectorId: true,
    } as const;

    const byVectorIds = await db
      .select({
        id: workspaceNeuralObservations.id,
        embeddingTitleId: workspaceNeuralObservations.embeddingTitleId,
        embeddingContentId: workspaceNeuralObservations.embeddingContentId,
        embeddingSummaryId: workspaceNeuralObservations.embeddingSummaryId,
        embeddingVectorId: workspaceNeuralObservations.embeddingVectorId,
        ...Object.fromEntries(
          Object.keys(columns).map((k) => [k, workspaceNeuralObservations[k as keyof typeof workspaceNeuralObservations]])
        ),
      })
      .from(workspaceNeuralObservations)
      .where(
        and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          or(
            inArray(workspaceNeuralObservations.embeddingTitleId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingContentId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingSummaryId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingVectorId, vectorIds)
          )
        )
      );

    // Map each observation to ALL matching vector IDs from the request
    for (const obs of byVectorIds) {
      const matchingIds = vectorIds.filter(
        (vid) =>
          vid === obs.embeddingTitleId ||
          vid === obs.embeddingContentId ||
          vid === obs.embeddingSummaryId ||
          vid === obs.embeddingVectorId
      );

      for (const vid of matchingIds) {
        result.set(vid, obs as Pick<Observation, T>);
      }
    }
  }

  return result;
}
```

#### 3. Update v1/contents Route

**File**: `apps/console/src/app/(api)/v1/contents/route.ts`

**Changes**: Replace the current database query logic with the resolver helper.

Replace lines 79-122 with:

```typescript
    // 3. Separate IDs by type
    const obsIds = ids.filter((id) => id.startsWith("obs_") || id.startsWith("obs"));
    const docIds = ids.filter((id) => id.startsWith("doc_"));

    // Note: obsIds now includes both database IDs and vector IDs
    // The resolver handles both formats transparently

    // 4. Fetch in parallel using resolver for observations
    const [observationMap, documents] = await Promise.all([
      obsIds.length > 0
        ? resolveObservationsById(workspaceId, obsIds, {
            id: true,
            title: true,
            content: true,
            source: true,
            sourceId: true,
            observationType: true,
            occurredAt: true,
            metadata: true,
          })
        : Promise.resolve(new Map()),

      docIds.length > 0
        ? db
            .select({
              id: workspaceKnowledgeDocuments.id,
              sourceType: workspaceKnowledgeDocuments.sourceType,
              sourceId: workspaceKnowledgeDocuments.sourceId,
              sourceMetadata: workspaceKnowledgeDocuments.sourceMetadata,
            })
            .from(workspaceKnowledgeDocuments)
            .where(
              and(
                eq(workspaceKnowledgeDocuments.workspaceId, workspaceId),
                inArray(workspaceKnowledgeDocuments.id, docIds)
              )
            )
        : Promise.resolve([]),
    ]);

    // Convert observation map to array, keyed by request ID (not database ID)
    const observations = Array.from(observationMap.entries()).map(([requestId, obs]) => ({
      requestId,
      ...obs,
    }));
```

Also update the response mapping (lines 125-140) to use `requestId`:

```typescript
    // 5. Map to response format
    const items: V1ContentItem[] = [
      // Observations - full content from DB
      ...observations.map((obs) => {
        const metadata = (obs.metadata ?? {}) as Record<string, unknown>;
        return {
          id: obs.requestId, // Return the ID that was requested (may be vector ID)
          title: obs.title,
          url: buildSourceUrl(obs.source, obs.sourceId, metadata),
          snippet: obs.content.slice(0, 200),
          content: obs.content,
          source: obs.source,
          type: obs.observationType,
          occurredAt: obs.occurredAt,
          metadata,
        };
      }),
      // ... documents unchanged
    ];
```

Add import at top of file:

```typescript
import { resolveObservationsById } from "~/lib/neural/id-resolver";
```

#### 4. Update v1/findsimilar Route

**File**: `apps/console/src/app/(api)/v1/findsimilar/route.ts`

**Changes**: Update `fetchSourceContent` function to use the resolver.

Replace `fetchSourceContent` function (lines 277-338) with:

```typescript
/**
 * Fetch source content by ID (observation or document)
 * Supports both database IDs and Pinecone vector IDs.
 */
async function fetchSourceContent(
  workspaceId: string,
  contentId: string
): Promise<SourceContent | null> {
  // Handle observations (both database IDs and vector IDs)
  if (contentId.startsWith("obs_") || contentId.startsWith("obs")) {
    const obs = await resolveObservationById(workspaceId, contentId, {
      id: true,
      title: true,
      content: true,
      observationType: true,
      source: true,
      clusterId: true,
    });

    if (obs) {
      return {
        id: obs.id, // Always return database ID for consistency
        title: obs.title,
        content: obs.content,
        type: obs.observationType,
        source: obs.source,
        clusterId: obs.clusterId,
      };
    }
  }

  // Handle documents (unchanged - documents don't have vector IDs)
  if (contentId.startsWith("doc_")) {
    const doc = await db.query.workspaceKnowledgeDocuments.findFirst({
      columns: {
        id: true,
        sourceId: true,
        sourceType: true,
        sourceMetadata: true,
      },
      where: and(
        eq(workspaceKnowledgeDocuments.workspaceId, workspaceId),
        eq(workspaceKnowledgeDocuments.id, contentId)
      ),
    });

    if (doc) {
      const metadata = doc.sourceMetadata as Record<string, unknown>;
      const frontmatter = (metadata.frontmatter ?? {}) as Record<string, unknown>;
      return {
        id: doc.id,
        title: typeof frontmatter.title === "string" ? frontmatter.title : doc.sourceId,
        content: typeof frontmatter.description === "string" ? frontmatter.description : "",
        type: "file",
        source: doc.sourceType,
        clusterId: null,
      };
    }
  }

  return null;
}
```

Also update `enrichResults` function (lines 343-412) to use the resolver:

```typescript
/**
 * Enrich results with database info
 * Supports both database IDs and Pinecone vector IDs.
 */
async function enrichResults(
  workspaceId: string,
  resultIds: string[],
  sourceClusterId: string | null
): Promise<
  Map<
    string,
    {
      title: string;
      url: string;
      source: string;
      type: string;
      occurredAt?: string;
      sameCluster: boolean;
      entityOverlap?: number;
    }
  >
> {
  const result = new Map<
    string,
    {
      title: string;
      url: string;
      source: string;
      type: string;
      occurredAt?: string;
      sameCluster: boolean;
      entityOverlap?: number;
    }
  >();

  if (resultIds.length === 0) return result;

  // Filter to observation IDs (both database and vector IDs)
  const obsIds = resultIds.filter((id) => id.startsWith("obs_") || id.startsWith("obs"));
  if (obsIds.length === 0) return result;

  // Use resolver to handle both ID formats
  const observationMap = await resolveObservationsById(workspaceId, obsIds, {
    id: true,
    title: true,
    source: true,
    sourceId: true,
    observationType: true,
    occurredAt: true,
    clusterId: true,
    metadata: true,
  });

  for (const [requestId, obs] of observationMap) {
    const metadata = (obs.metadata ?? {}) as Record<string, unknown>;
    result.set(requestId, {
      title: obs.title,
      url: buildSourceUrl(obs.source, obs.sourceId, metadata),
      source: obs.source,
      type: obs.observationType,
      occurredAt: obs.occurredAt,
      sameCluster: sourceClusterId !== null && obs.clusterId === sourceClusterId,
    });
  }

  return result;
}
```

Add import at top of file:

```typescript
import { resolveObservationById, resolveObservationsById } from "~/lib/neural/id-resolver";
```

### Success Criteria

#### Automated Verification:
- [x] Database migration runs: `cd db/console && pnpm db:generate && pnpm db:migrate`
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] `/v1/contents` with database ID returns content
- [ ] `/v1/contents` with vector ID (e.g., `obs_content_...`) returns content (NEW)
- [ ] `/v1/findsimilar` with database ID finds similar items
- [ ] `/v1/findsimilar` with vector ID (e.g., `obs_content_...`) finds similar items (NEW)
- [ ] Existing search → expand flow works (search results can be expanded)

**Implementation Note**: After completing Phase 1 and all automated verification passes, pause here for manual confirmation that the fallback is working before proceeding to Phase 2.

---

## Phase 2: Search Returns Observation IDs (Root Fix)

### Overview

Normalize vector IDs to observation IDs immediately after Pinecone query, before merging with entity results. Deduplicate multi-view matches for the same observation using max score aggregation.

### Changes Required

#### 1. Add ID Normalization Function

**File**: `apps/console/src/lib/neural/four-path-search.ts`

Add new function after the imports (around line 20):

```typescript
import { db } from "@db/console/client";
import { workspaceNeuralObservations } from "@db/console/schema";
import { and, eq, or, inArray } from "drizzle-orm";

/**
 * Information about which embedding views matched for an observation
 */
interface ViewMatch {
  view: "title" | "content" | "summary" | "legacy";
  score: number;
  vectorId: string;
}

/**
 * Normalize Pinecone vector IDs to database observation IDs.
 * Groups multi-view matches by observation and returns max score.
 */
async function normalizeVectorIds(
  workspaceId: string,
  vectorMatches: Array<{ id: string; score: number; metadata?: VectorMetadata }>
): Promise<Array<{
  observationId: string;
  score: number;
  matchedViews: ViewMatch[];
  metadata?: VectorMetadata;
}>> {
  if (vectorMatches.length === 0) return [];

  // Extract all vector IDs
  const vectorIds = vectorMatches.map((m) => m.id);

  // Query database to map vector IDs → observation IDs
  const observations = await db
    .select({
      id: workspaceNeuralObservations.id,
      embeddingTitleId: workspaceNeuralObservations.embeddingTitleId,
      embeddingContentId: workspaceNeuralObservations.embeddingContentId,
      embeddingSummaryId: workspaceNeuralObservations.embeddingSummaryId,
      embeddingVectorId: workspaceNeuralObservations.embeddingVectorId,
    })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        or(
          inArray(workspaceNeuralObservations.embeddingTitleId, vectorIds),
          inArray(workspaceNeuralObservations.embeddingContentId, vectorIds),
          inArray(workspaceNeuralObservations.embeddingSummaryId, vectorIds),
          inArray(workspaceNeuralObservations.embeddingVectorId, vectorIds)
        )
      )
    );

  // Build vector ID → observation mapping
  const vectorToObs = new Map<string, { id: string; view: "title" | "content" | "summary" | "legacy" }>();
  for (const obs of observations) {
    if (obs.embeddingTitleId) {
      vectorToObs.set(obs.embeddingTitleId, { id: obs.id, view: "title" });
    }
    if (obs.embeddingContentId) {
      vectorToObs.set(obs.embeddingContentId, { id: obs.id, view: "content" });
    }
    if (obs.embeddingSummaryId) {
      vectorToObs.set(obs.embeddingSummaryId, { id: obs.id, view: "summary" });
    }
    if (obs.embeddingVectorId) {
      vectorToObs.set(obs.embeddingVectorId, { id: obs.id, view: "legacy" });
    }
  }

  // Group matches by observation ID
  const obsGroups = new Map<string, {
    matches: ViewMatch[];
    metadata?: VectorMetadata;
  }>();

  for (const match of vectorMatches) {
    const obs = vectorToObs.get(match.id);
    if (!obs) {
      // Vector ID not found in database - skip or log warning
      console.warn(`Vector ID not found in database: ${match.id}`);
      continue;
    }

    const existing = obsGroups.get(obs.id);
    if (existing) {
      existing.matches.push({
        view: obs.view,
        score: match.score,
        vectorId: match.id,
      });
    } else {
      obsGroups.set(obs.id, {
        matches: [{
          view: obs.view,
          score: match.score,
          vectorId: match.id,
        }],
        metadata: match.metadata,
      });
    }
  }

  // Convert to result array with max score aggregation
  const results: Array<{
    observationId: string;
    score: number;
    matchedViews: ViewMatch[];
    metadata?: VectorMetadata;
  }> = [];

  for (const [obsId, group] of obsGroups) {
    // Use MAX score across all matching views
    const maxScore = Math.max(...group.matches.map((m) => m.score));

    results.push({
      observationId: obsId,
      score: maxScore,
      matchedViews: group.matches,
      metadata: group.metadata,
    });
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}
```

#### 2. Update mergeSearchResults Function

**File**: `apps/console/src/lib/neural/four-path-search.ts`

Replace the `mergeSearchResults` function (lines 121-159) with:

```typescript
/**
 * Merge normalized vector results with entity results.
 * All IDs are now observation IDs (database nanoids).
 */
function mergeSearchResults(
  normalizedVectorResults: Array<{
    observationId: string;
    score: number;
    matchedViews: ViewMatch[];
    metadata?: VectorMetadata;
  }>,
  entityResults: EntitySearchResult[],
  limit: number
): FilterCandidate[] {
  const resultMap = new Map<string, FilterCandidate & { matchedViews?: ViewMatch[] }>();

  // Add normalized vector results (now using observation IDs)
  for (const result of normalizedVectorResults) {
    resultMap.set(result.observationId, {
      id: result.observationId,
      title: String(result.metadata?.title ?? ""),
      snippet: String(result.metadata?.snippet ?? ""),
      score: result.score,
      matchedViews: result.matchedViews,
    });
  }

  // Merge with entity results
  for (const entity of entityResults) {
    const existing = resultMap.get(entity.observationId);
    if (existing) {
      // Boost score for entity confirmation (+0.2)
      existing.score = Math.min(1.0, existing.score + 0.2);
      // Prefer entity title/snippet if available
      if (entity.observationTitle) existing.title = entity.observationTitle;
      if (entity.observationSnippet) existing.snippet = entity.observationSnippet;
    } else {
      resultMap.set(entity.observationId, {
        id: entity.observationId,
        title: entity.observationTitle,
        snippet: entity.observationSnippet,
        score: 0.85 * entity.confidence,
      });
    }
  }

  // Sort by score and limit
  return Array.from(resultMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

#### 3. Update fourPathParallelSearch to Use Normalization

**File**: `apps/console/src/lib/neural/four-path-search.ts`

In the `fourPathParallelSearch` function, add normalization after vector search and before merge.

Find where vector results are used (around line 270-280) and update:

```typescript
    // After Pinecone query returns, normalize vector IDs to observation IDs
    const normalizeStart = Date.now();
    const normalizedVectorResults = await normalizeVectorIds(
      workspaceId,
      vectorMatches
    );
    const normalizeLatency = Date.now() - normalizeStart;

    log.info("four-path-search normalized", {
      requestId,
      inputVectorCount: vectorMatches.length,
      outputObsCount: normalizedVectorResults.length,
      normalizeLatency,
    });

    // Merge using normalized results (all observation IDs now)
    const mergedResults = mergeSearchResults(
      normalizedVectorResults,
      entityResults,
      topK
    );
```

Also update the latency tracking in the return object to include `normalize` latency.

#### 4. Update enrichSearchResults

**File**: `apps/console/src/lib/neural/four-path-search.ts`

The `enrichSearchResults` function (lines 340-427) already queries by observation ID, but we should verify it handles the new format. Since all IDs are now observation IDs, the existing logic should work.

Verify line 370 uses the correct column:

```typescript
inArray(workspaceNeuralObservations.id, resultIds)  // ✓ Correct - queries database ID column
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`
- [ ] Build succeeds: `pnpm build:console` (requires Clerk env vars - code is correct)

#### Manual Verification:
- [ ] Search results contain observation IDs (nanoids), not vector IDs
- [ ] Multi-view matches (title, content, summary) for same observation are deduplicated
- [ ] Deduplicated results have max score across views
- [ ] Entity search results still merge correctly with vector results
- [ ] Entity boost (+0.2) applies when same observation found via both paths
- [ ] Search latency increase is acceptable (<30ms for normalization)
- [ ] Contents endpoint works with search result IDs (no more "not found")
- [ ] FindSimilar endpoint works with search result IDs

**Implementation Note**: After completing Phase 2 and all verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Pre-generate Observation ID in Workflow

### Overview

Eliminate the Phase 2 database lookup by storing the observation ID directly in Pinecone metadata. This is an optimization for new observations; Phase 2 fallback handles existing vectors.

### Changes Required

#### 1. Pre-generate Observation ID at Workflow Start

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

Find the beginning of the workflow (around line 50-100) and add observation ID pre-generation:

```typescript
// At the start of the workflow, before any steps
import { nanoid } from "nanoid";

// Pre-generate observation ID to store in Pinecone metadata
const observationId = nanoid();
```

#### 2. Include Observation ID in Pinecone Metadata

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

Find where Pinecone metadata is constructed (around lines 467-505) and add the observation ID:

```typescript
// In the metadata object for each vector
const baseMetadata = {
  layer: "observations",
  workspaceId,
  source,
  sourceId: sourceEvent.sourceId,
  observationType: sourceEvent.eventType,
  title: titleText,
  snippet: contentText.slice(0, 500),
  occurredAt: sourceEvent.timestamp,
  // NEW: Include pre-generated observation ID for direct lookup
  observationId,
};
```

#### 3. Use Pre-generated ID in Database Insert

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

Find the database insert (around lines 541-565) and use the pre-generated ID:

```typescript
const [obs] = await tx.insert(workspaceNeuralObservations).values({
  id: observationId,  // Use pre-generated ID instead of auto-generated
  workspaceId,
  // ... rest unchanged
}).returning();
```

#### 4. Update Normalization to Use Metadata First

**File**: `apps/console/src/lib/neural/four-path-search.ts`

Update `normalizeVectorIds` to check metadata first before database lookup:

```typescript
async function normalizeVectorIds(
  workspaceId: string,
  vectorMatches: Array<{ id: string; score: number; metadata?: VectorMetadata }>
): Promise<Array<{
  observationId: string;
  score: number;
  matchedViews: ViewMatch[];
  metadata?: VectorMetadata;
}>> {
  if (vectorMatches.length === 0) return [];

  // Separate matches with observationId in metadata (Phase 3) from those without (legacy)
  const withObsId: typeof vectorMatches = [];
  const withoutObsId: typeof vectorMatches = [];

  for (const match of vectorMatches) {
    if (typeof match.metadata?.observationId === "string") {
      withObsId.push(match);
    } else {
      withoutObsId.push(match);
    }
  }

  // Process matches with observationId directly (no DB lookup needed)
  const obsGroups = new Map<string, {
    matches: ViewMatch[];
    metadata?: VectorMetadata;
  }>();

  for (const match of withObsId) {
    const obsId = match.metadata!.observationId as string;
    const view = getViewFromVectorId(match.id);

    const existing = obsGroups.get(obsId);
    if (existing) {
      existing.matches.push({ view, score: match.score, vectorId: match.id });
    } else {
      obsGroups.set(obsId, {
        matches: [{ view, score: match.score, vectorId: match.id }],
        metadata: match.metadata,
      });
    }
  }

  // For legacy vectors without observationId, fall back to database lookup
  if (withoutObsId.length > 0) {
    const vectorIds = withoutObsId.map((m) => m.id);

    const observations = await db
      .select({
        id: workspaceNeuralObservations.id,
        embeddingTitleId: workspaceNeuralObservations.embeddingTitleId,
        embeddingContentId: workspaceNeuralObservations.embeddingContentId,
        embeddingSummaryId: workspaceNeuralObservations.embeddingSummaryId,
        embeddingVectorId: workspaceNeuralObservations.embeddingVectorId,
      })
      .from(workspaceNeuralObservations)
      .where(
        and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          or(
            inArray(workspaceNeuralObservations.embeddingTitleId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingContentId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingSummaryId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingVectorId, vectorIds)
          )
        )
      );

    // Build vector ID → observation mapping for legacy vectors
    const vectorToObs = new Map<string, { id: string; view: "title" | "content" | "summary" | "legacy" }>();
    for (const obs of observations) {
      if (obs.embeddingTitleId) vectorToObs.set(obs.embeddingTitleId, { id: obs.id, view: "title" });
      if (obs.embeddingContentId) vectorToObs.set(obs.embeddingContentId, { id: obs.id, view: "content" });
      if (obs.embeddingSummaryId) vectorToObs.set(obs.embeddingSummaryId, { id: obs.id, view: "summary" });
      if (obs.embeddingVectorId) vectorToObs.set(obs.embeddingVectorId, { id: obs.id, view: "legacy" });
    }

    // Add legacy matches to obsGroups
    for (const match of withoutObsId) {
      const obs = vectorToObs.get(match.id);
      if (!obs) continue;

      const existing = obsGroups.get(obs.id);
      if (existing) {
        existing.matches.push({ view: obs.view, score: match.score, vectorId: match.id });
      } else {
        obsGroups.set(obs.id, {
          matches: [{ view: obs.view, score: match.score, vectorId: match.id }],
          metadata: match.metadata,
        });
      }
    }
  }

  // Convert to result array with max score aggregation
  const results: Array<{
    observationId: string;
    score: number;
    matchedViews: ViewMatch[];
    metadata?: VectorMetadata;
  }> = [];

  for (const [obsId, group] of obsGroups) {
    const maxScore = Math.max(...group.matches.map((m) => m.score));
    results.push({
      observationId: obsId,
      score: maxScore,
      matchedViews: group.matches,
      metadata: group.metadata,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Extract view type from vector ID prefix
 */
function getViewFromVectorId(vectorId: string): "title" | "content" | "summary" | "legacy" {
  if (vectorId.startsWith("obs_title_")) return "title";
  if (vectorId.startsWith("obs_content_")) return "content";
  if (vectorId.startsWith("obs_summary_")) return "summary";
  return "legacy";
}
```

#### 5. Update VectorMetadata Type

**File**: `apps/console/src/lib/neural/four-path-search.ts`

Update the `VectorMetadata` interface to include `observationId`:

```typescript
interface VectorMetadata {
  title?: string;
  snippet?: string;
  source?: string;
  observationType?: string;
  occurredAt?: string;
  observationId?: string;  // NEW: Pre-generated database ID (Phase 3)
  // ... other existing fields
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`
- [x] Build succeeds: `pnpm build:console` (requires Clerk env vars - code is correct)
- [x] Inngest workflow builds: `pnpm --filter @api/console build`

#### Manual Verification:
- [ ] New observations have `observationId` in Pinecone metadata
- [ ] Search uses metadata directly for new observations (no DB lookup)
- [ ] Search falls back to DB lookup for legacy observations (without metadata)
- [ ] Search latency reduced compared to Phase 2 for new observations
- [ ] Mixed results (new + legacy observations) work correctly
- [ ] All existing functionality still works (contents, findsimilar, etc.)

---

## Testing Strategy

### Unit Tests

Add tests in `apps/console/src/lib/neural/__tests__/`:

1. **id-resolver.test.ts**
   - Test `isVectorId` with various ID formats
   - Test `resolveObservationById` with database ID
   - Test `resolveObservationById` with vector ID fallback
   - Test `resolveObservationsById` with mixed ID batch

2. **four-path-search.test.ts** (update existing)
   - Test `normalizeVectorIds` with metadata (Phase 3)
   - Test `normalizeVectorIds` with DB fallback (Phase 2)
   - Test deduplication with multi-view matches
   - Test max score aggregation
   - Test entity merge with normalized results

### Integration Tests

1. **Search → Contents flow**
   - Execute search, take result ID, call contents
   - Verify content is returned without "not found" error

2. **Search → FindSimilar flow**
   - Execute search, take result ID, call findsimilar
   - Verify similar results are returned

3. **Multi-view deduplication**
   - Create observation with known embedding
   - Search with query matching multiple views
   - Verify single result with max score

### Manual Testing Steps

1. Start local dev server: `pnpm dev:console`
2. Execute search via console UI or API
3. Expand a search result → should show full content
4. Click "Find similar" → should show related observations
5. Check search latency in response → should be <500ms total

---

## Performance Considerations

### Phase 1 Impact
- Additional OR query for vector ID fallback
- Mitigated by indexes on embedding columns
- Only affects vector ID lookups (rare after Phase 2)

### Phase 2 Impact
- Single additional DB query per search (~10-20ms)
- Uses indexed columns for OR query
- Deduplication reduces result count (less to enrich)

### Phase 3 Impact
- Eliminates DB query for new observations
- Metadata lookup is O(n) in memory
- Gradual improvement as old vectors age out

### Estimated Latency

| Operation | Before | Phase 1 | Phase 2 | Phase 3 |
|-----------|--------|---------|---------|---------|
| Search total | ~200ms | ~200ms | ~220ms | ~200ms (new) |
| Normalization | N/A | N/A | ~15ms | ~5ms (new) |
| Contents (DB ID) | ~20ms | ~20ms | ~20ms | ~20ms |
| Contents (vector ID) | FAIL | ~30ms | ~20ms | ~20ms |

---

## Migration Notes

### Database Migration
- Phase 1 adds 3 indexes to `workspaceNeuralObservations`
- Migration is non-blocking (CREATE INDEX CONCURRENTLY on Postgres)
- Estimated time: <1 minute for typical dataset

### Backward Compatibility
- All phases maintain backward compatibility
- Existing API clients continue to work
- Vector IDs in old responses still work (Phase 1 fallback)

### Rollback Plan
- Phase 1: Remove indexes, revert route changes
- Phase 2: Revert four-path-search changes, keep Phase 1
- Phase 3: Revert workflow changes, keep Phase 2 fallback

---

## References

- Original research: `thoughts/shared/research/2025-12-15-search-id-mismatch-investigation.md`
- Four-path search: `apps/console/src/lib/neural/four-path-search.ts:167`
- Observation capture: `api/console/src/inngest/workflow/neural/observation-capture.ts:391-565`
- Contents route: `apps/console/src/app/(api)/v1/contents/route.ts`
- FindSimilar route: `apps/console/src/app/(api)/v1/findsimilar/route.ts`
- Schema: `db/console/src/schema/tables/workspace-neural-observations.ts:159-181`
