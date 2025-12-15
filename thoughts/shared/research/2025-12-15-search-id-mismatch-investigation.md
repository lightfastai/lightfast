---
date: 2025-12-15T16:17:13+1100
researcher: jeevan
git_commit: 016fff9bb3145ac1d05270e822174798afd22909
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Search ID Mismatch: Pinecone vector IDs vs Database observation IDs"
tags: [research, codebase, v1-search, contents, findsimilar, neural-memory, id-mapping, solutions]
status: complete
last_updated: 2025-12-15
last_updated_by: claude
last_updated_note: "Added comprehensive solutions for all open questions with phased implementation plan"
---

# Research: Search ID Mismatch Investigation

**Date**: 2025-12-15T16:17:13+1100
**Researcher**: jeevan
**Git Commit**: 016fff9bb3145ac1d05270e822174798afd22909
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

User observed:
1. Search results showing "duplicate" entries with slight variance (e.g., `obs_content_*` and `obs_summary_*` for same event)
2. `/v1/contents` endpoint returning "content not found" for valid search result IDs
3. `/v1/findsimilar` endpoint always failing to fetch similar items

## Summary

### Finding 1: "Duplicates" are BY DESIGN (Multi-View Embeddings)

The search results showing multiple entries for the same event are **intentional**, not duplicates from running the dataset twice.

**Architecture**: For each webhook event, the observation-capture workflow creates:
- **1 database observation** with a nanoid primary key (e.g., `9y9mxtj20prv8dr1hc77q`)
- **3 Pinecone vectors** for multi-view retrieval:
  - `obs_title_{baseId}` - title-only embedding
  - `obs_content_{baseId}` - full content embedding
  - `obs_summary_{baseId}` - title + first 1000 chars

The database observation stores the mapping:
```
id: "9y9mxtj20prv8dr1hc77q"           # Database observation ID (nanoid)
embeddingTitleId: "obs_title_push_test_repo_def789abc012_test_2"
embeddingContentId: "obs_content_push_test_repo_def789abc012_test_2"
embeddingSummaryId: "obs_summary_push_test_repo_def789abc012_test_2"
```

### Finding 2: Contents/FindSimilar Failing Due to ID Mismatch

**Root Cause**: Search returns Pinecone vector IDs, but contents/findsimilar endpoints query by database observation IDs.

**Data Flow**:
1. User searches -> `/v1/search` queries Pinecone -> Returns vector IDs like `obs_content_push_test_repo_def789abc012_test_2`
2. User expands result -> `/v1/contents` called with that ID
3. `contents/route.ts` queries: `WHERE id = 'obs_content_push_test_repo_def789abc012_test_2'`
4. Database `id` column contains nanoids like `9y9mxtj20prv8dr1hc77q` -> **No match found**
5. Returns "content not found"

**Database Evidence** (from Drizzle Studio):
| id (nanoid) | embedding_content_id (vector ID) |
|-------------|----------------------------------|
| `9y9mxtj20prv8dr1hc77q` | `obs_content_push_test_repo_def789abc012_test_2` |

The vector ID is stored in `embedding_content_id`, but lookups query the `id` column.

## Detailed Findings

### Multi-View Embedding Generation

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts:369-410`

```typescript
const baseId = sourceEvent.sourceId.replace(/[^a-zA-Z0-9]/g, "_");

return {
  title: { vectorId: `obs_title_${baseId}`, vector: ... },
  content: { vectorId: `obs_content_${baseId}`, vector: ... },
  summary: { vectorId: `obs_summary_${baseId}`, vector: ... },
};
```

Three separate embeddings are generated per observation for different retrieval strategies.

### Search Result ID Flow

**File**: `apps/console/src/lib/neural/four-path-search.ts:121-159`

The `mergeSearchResults` function merges vector matches (Pinecone IDs) with entity matches (database IDs) without converting between formats:

```typescript
// Vector matches use Pinecone IDs
for (const match of vectorMatches) {
  resultMap.set(match.id, { id: match.id, ... });  // obs_content_*
}

// Entity matches use database IDs
for (const entity of entityResults) {
  resultMap.set(entity.observationId, { id: entity.observationId, ... });  // nanoid
}
```

This results in mixed ID types in search results.

### Contents Endpoint Lookup

**File**: `apps/console/src/app/(api)/v1/contents/route.ts:80-122`

```typescript
const obsIds = ids.filter((id) => id.startsWith("obs_"));

const observations = await db.select(...)
  .from(workspaceNeuralObservations)
  .where(
    and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      inArray(workspaceNeuralObservations.id, obsIds)  // Queries `id` column
    )
  );
```

Problem: Queries `id` column with vector IDs like `obs_content_*`, but `id` column contains nanoids.

### FindSimilar Endpoint Lookup

**File**: `apps/console/src/app/(api)/v1/findsimilar/route.ts:281-295`

```typescript
if (contentId.startsWith("obs_")) {
  const obs = await db.query.workspaceNeuralObservations.findFirst({
    where: and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      eq(workspaceNeuralObservations.id, contentId)  // Queries `id` column
    ),
  });
}
```

Same problem: Expects database ID but receives Pinecone vector ID.

## Code References

- `api/console/src/inngest/workflow/neural/observation-capture.ts:392-409` - Vector ID generation
- `api/console/src/inngest/workflow/neural/observation-capture.ts:559-562` - Database observation storage with embedding columns
- `apps/console/src/lib/neural/four-path-search.ts:121-159` - Merge results mixing ID types
- `apps/console/src/lib/neural/four-path-search.ts:340-427` - enrichSearchResults assumes database IDs
- `apps/console/src/app/(api)/v1/contents/route.ts:80-122` - Contents lookup by ID
- `apps/console/src/app/(api)/v1/findsimilar/route.ts:281-295` - FindSimilar lookup by ID
- `db/console/src/schema/tables/workspace-neural-observations.ts:163-181` - Embedding ID columns

## Architecture Documentation

### ID Types in the System

| ID Type | Format Example | Location | Purpose |
|---------|----------------|----------|---------|
| Database Observation ID | `9y9mxtj20prv8dr1hc77q` | `workspaceNeuralObservations.id` | Primary key for DB operations |
| Pinecone Vector ID (title) | `obs_title_push_test_repo_def789abc012_test_2` | `embeddingTitleId` column + Pinecone | Title-view vector retrieval |
| Pinecone Vector ID (content) | `obs_content_push_test_repo_def789abc012_test_2` | `embeddingContentId` column + Pinecone | Content-view vector retrieval |
| Pinecone Vector ID (summary) | `obs_summary_push_test_repo_def789abc012_test_2` | `embeddingSummaryId` column + Pinecone | Summary-view vector retrieval |

### Data Storage Pattern

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Database (PlanetScale)                          │
│  workspaceNeuralObservations                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ id: "9y9mxtj20prv8dr1hc77q"    ← Nanoid (primary key)            │   │
│  │ embeddingTitleId: "obs_title_push_..."    ← Pinecone vector ID   │   │
│  │ embeddingContentId: "obs_content_push_..."                       │   │
│  │ embeddingSummaryId: "obs_summary_push_..."                       │   │
│  │ title, content, source, ...                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 3 vectors per observation
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            Pinecone                                      │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────┐ │
│  │ id: obs_title_push_...│ │ id: obs_content_push..│ │ id: obs_sum...│ │
│  │ vector: [0.1, 0.2,...]│ │ vector: [0.3, 0.4,...] │ │ vector: [...] │ │
│  │ metadata: {...}       │ │ metadata: {...}       │ │ metadata:{...}│ │
│  └───────────────────────┘ └───────────────────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Search Flow (Current - Broken)

```
User Query
    │
    ▼
Pinecone Search ──────────────► Returns: obs_content_push_...
    │
    ▼
Search Response ──────────────► id: "obs_content_push_..." (vector ID)
    │
    ▼
/v1/contents ─────────────────► WHERE id = "obs_content_push_..."
    │
    ▼
Database Query ───────────────► No match (id column has nanoids)
    │
    ▼
"Content not found"
```

## Historical Context (from thoughts/)

Related research documents:
- `thoughts/shared/research/2025-12-11-web-analysis-neural-memory-architecture-implications.md` - Multi-view embedding design decision

## Open Questions - RESOLVED

### Question 1: Should search results return database observation IDs instead of Pinecone vector IDs?

**Answer: YES - Search should return database observation IDs**

**Rationale (Lightfast Use Cases):**

1. **API Consistency**: All downstream operations (contents, findsimilar, entity linking, audit logs) use database IDs. Mixing ID types breaks the API contract.

2. **User Experience**: Console users care about finding relevant observations, not which embedding view matched. Seeing "3 results" for the same event is confusing. Multi-view embeddings are an internal optimization, not a user-facing feature.

3. **Deduplication**: When the same observation matches via title, content, AND summary views, users should see ONE result (with the best score), not three nearly-identical results.

4. **Downstream Compatibility**: IDs returned from search MUST work in contents/findsimilar. Currently they don't.

**Design Decision:**
- Multi-view embeddings remain an **internal implementation detail** for improved recall
- Search results expose **database observation IDs** for consistent API surface
- Optional: Include `matchedViews: ["content", "summary"]` metadata for debugging/analytics

---

### Question 2: Should contents/findsimilar endpoints be updated to handle vector ID lookups?

**Answer: YES - As a robust fallback mechanism**

**Rationale:**

1. **Immediate Fix**: Unblocks users while root cause (Question 1) is addressed
2. **Robustness**: Handle any ID format gracefully - fail-safe behavior
3. **Debugging**: Developers can test with either ID type during development
4. **Backward Compatibility**: If any integration accidentally uses vector IDs, it still works

**Implementation Strategy:**
```
Input ID received
    │
    ├─ Try database ID lookup first (id column)
    │   └─ If found → return result
    │
    └─ If not found AND starts with "obs_"
        └─ Try embedding column lookup (embeddingContentId, embeddingTitleId, embeddingSummaryId)
            └─ If found → return result
            └─ If not found → return 404
```

**Important**: This is a **fallback**, not the primary path. The root fix is Question 1.

---

### Question 3: How to handle mixed ID types from entity search vs vector search?

**Answer: Normalize at vector search time, before merge**

**Current Problem:**
- Vector search returns: `obs_content_push_...` (Pinecone vector IDs)
- Entity search returns: `9y9mxtj20prv8dr1hc77q` (database observation IDs)
- Merge function combines them without normalization → mixed bag

**Solution:**
Normalize vector IDs to observation IDs **immediately after Pinecone query**, before merging with entity results.

**Data Flow (Fixed):**
```
Pinecone Query
    │
    ▼
Vector IDs: [obs_content_push_..., obs_title_push_...]
    │
    ▼ ← NORMALIZATION STEP (NEW)
    │   Map vector IDs → observation IDs via embedding columns
    │   Deduplicate by observation ID (keep highest score)
    │
    ▼
Observation IDs: [9y9mxtj20prv8dr1hc77q] with score + matchedViews
    │
    ├───► Merge with Entity Results (already have observation IDs)
    │
    ▼
Unified results with consistent observation IDs
```

**Deduplication Logic:**
When same observation matches via multiple views:
- `obs_title_push_...` score: 0.82
- `obs_content_push_...` score: 0.75
- `obs_summary_push_...` score: 0.78

Result:
```typescript
{
  id: "9y9mxtj20prv8dr1hc77q",  // Database observation ID
  score: 0.82,                   // Max score across views
  matchedViews: ["title", "summary", "content"],  // Optional metadata
}
```

**Score Aggregation Strategy**: Use **max score** (not sum/average) because:
- A strong match in any view is a strong signal
- Multiple weak matches shouldn't artificially inflate relevance
- Aligns with how entity boost works (+0.2 for entity confirmation)

---

## Solution Architecture

### Phased Implementation Plan

#### Phase 1: Immediate Bug Fix (contents/findsimilar accept vector IDs)

**Goal**: Unblock users - make search results work with contents/findsimilar

**Files to modify:**
- `apps/console/src/app/(api)/v1/contents/route.ts`
- `apps/console/src/app/(api)/v1/findsimilar/route.ts`

**Changes:**
1. Add helper function to resolve any ID format to observation
2. Query OR condition across `id`, `embeddingContentId`, `embeddingTitleId`, `embeddingSummaryId`

**Risk**: Low - additive change, doesn't break existing behavior

---

#### Phase 2: Root Cause Fix (search returns observation IDs)

**Goal**: Search results use consistent database observation IDs

**Files to modify:**
- `apps/console/src/lib/neural/four-path-search.ts`

**Changes:**
1. After Pinecone query, map vector IDs → observation IDs
2. Deduplicate multi-view matches (same observation, keep best score)
3. Include `matchedViews` in result metadata (optional)
4. Entity results already have correct IDs - no change needed

**Performance Impact:**
- Adds 1 database query per search to map IDs
- Query is indexed (embedding columns have indexes)
- Estimated overhead: ~10-20ms

**Risk**: Medium - changes search response format, test thoroughly

---

#### Phase 3: Optimization (pre-generate observation ID in workflow)

**Goal**: Eliminate Phase 2 database lookup by storing observation ID in Pinecone metadata

**Current Workflow Order:**
```
Step 6: upsert-embeddings (Pinecone) ← No observation ID yet
Step 7: store-observation (DB insert) ← ID generated here
```

**Problem**: Observation ID doesn't exist when Pinecone vectors are created

**Solution**: Pre-generate nanoid at workflow start

**Files to modify:**
- `api/console/src/inngest/workflow/neural/observation-capture.ts`

**Changes:**
```typescript
// At workflow start
const observationId = nanoid();

// In Step 6 (Pinecone metadata)
const baseMetadata = {
  ...existingMetadata,
  observationId,  // NEW: Include database ID
};

// In Step 7 (DB insert)
.insert({
  id: observationId,  // Use pre-generated ID
  ...
})
```

**Benefits:**
- Search can read `metadata.observationId` directly from Pinecone
- No extra database query needed for ID mapping
- Cleaner data model

**Risk**: Low - pre-generating IDs is common pattern

**Migration**: Existing vectors won't have `observationId` in metadata
- Option A: Backfill via Pinecone update API
- Option B: Phase 2 fallback handles old vectors

---

### Target Architecture (After All Phases)

```
User Query
    │
    ▼
Pinecone Search
    │
    ▼
Vector Results with metadata.observationId
    │
    ├──► Deduplicate by observationId (max score)
    │
    ▼
Merge with Entity Results (already have observationId)
    │
    ▼
Search Response: id = observationId (database ID)
    │
    ├──► /v1/contents works ✓
    └──► /v1/findsimilar works ✓
```

---

## Implementation Priority

| Phase | Urgency | Effort | Value | Recommendation |
|-------|---------|--------|-------|----------------|
| Phase 1 | HIGH | Low (~2h) | Unblocks users | Do immediately |
| Phase 2 | MEDIUM | Medium (~4h) | Fixes root cause | Do this week |
| Phase 3 | LOW | Medium (~3h) | Performance + cleanliness | Next sprint |

**Recommended Order**: Phase 1 → Phase 2 → Phase 3

Phase 1 is a quick win that unblocks users. Phase 2 is the "real" fix. Phase 3 is optimization for the long term.

## Summary of Evidence

| Observation | Evidence |
|-------------|----------|
| Dataset NOT run twice | IDs follow consistent pattern, no actual duplicates with same nanoid |
| Multi-view embeddings by design | `observation-capture.ts:369-410` creates 3 vectors per event |
| Contents fails due to ID mismatch | `contents/route.ts` queries `id` column with vector IDs |
| FindSimilar fails due to ID mismatch | `findsimilar/route.ts:281-295` queries `id` column with vector IDs |
| DB stores vector IDs separately | Drizzle Studio shows `embeddingContentId` vs `id` columns differ |
