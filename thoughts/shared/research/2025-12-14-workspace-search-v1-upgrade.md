---
date: 2025-12-14T15:30:00+08:00
researcher: Claude
git_commit: a5055f90e3bc1b7d2e6e458287078c59dda3b319
branch: feat/memory-layer-foundation
repository: lightfastai/lightfast
topic: "Workspace Search Component Upgrade for V1 Three-Route System"
tags: [research, codebase, workspace-search, v1-api, neural-memory, ui-components]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
---

# Research: Workspace Search Component Upgrade for V1 Three-Route System

**Date**: 2025-12-14T15:30:00+08:00
**Researcher**: Claude
**Git Commit**: a5055f90e3bc1b7d2e6e458287078c59dda3b319
**Branch**: feat/memory-layer-foundation
**Repository**: lightfastai/lightfast

## Research Question

How to upgrade `workspace-search.tsx` to include all 3 v1 routes (`/v1/search`, `/v1/contents`, `/v1/findsimilar`) with all required filters, toggles, and properly populated output for a comprehensive search experience.

## Summary

The upgrade requires enhancing the workspace-search component to:
1. **Primary search view** (current) - Uses `/v1/search` with full filter/mode support
2. **Content detail panel** - Uses `/v1/contents` to fetch full content when clicking a result
3. **Similar items discovery** - Uses `/v1/findsimilar` to show related content for any result

The v1 API types define comprehensive schemas with rich metadata including clusters, actors, entities, latency breakdowns, and similarity scores. The existing UI patterns (Collapsible, ToggleGroup, Badge filters, Tabs) provide all necessary components.

## Detailed Findings

### 1. V1 API Types Overview

#### `/v1/search` Types (`packages/console-types/src/api/v1/search.ts`)

**Request Schema** (`V1SearchRequest`):
```typescript
{
  query: string;                    // Required - search text
  limit: number;                    // 1-100, default 10
  offset: number;                   // Pagination, default 0
  mode: "fast" | "balanced" | "thorough";  // Rerank mode
  filters?: {
    sourceTypes?: string[];         // ["github", "linear", "vercel"]
    observationTypes?: string[];    // ["commit", "issue", "pr"]
    actorNames?: string[];          // ["@username"]
    dateRange?: {
      start?: string;               // ISO datetime
      end?: string;
    };
  };
  includeContext?: boolean;         // Include clusters/actors (default true)
  includeHighlights?: boolean;      // Include highlighted snippets (default true)
}
```

**Response Schema** (`V1SearchResponse`):
```typescript
{
  data: V1SearchResult[];           // Search results
  context?: {
    clusters: { topic, summary, keywords }[];
    relevantActors: { displayName, expertiseDomains }[];
  };
  meta: {
    total: number;                  // Total matches before pagination
    limit: number;
    offset: number;
    took: number;                   // Total time in ms
    mode: RerankMode;
    paths: { vector, entity, cluster, actor: boolean };
  };
  latency: {
    total, auth, parse, search, embedding, retrieval,
    entitySearch, clusterSearch, actorSearch, rerank,
    enrich, maxParallel: number;
  };
  requestId: string;
}
```

**Individual Result** (`V1SearchResult`):
```typescript
{
  id: string;                       // Observation ID (obs_*)
  title: string;
  url: string;
  snippet: string;
  score: number;                    // 0-1 relevance
  source: string;                   // "github", "vercel", etc.
  type: string;                     // "push", "issue", "deployment"
  occurredAt?: string;              // ISO datetime
  entities?: { key, category }[];   // Extracted entities (@mentions, #refs)
  highlights?: { title?, snippet? }; // Highlighted text
}
```

#### `/v1/contents` Types (`packages/console-types/src/api/v1/contents.ts`)

**Request**: `{ ids: string[] }` (1-50 IDs, prefixed doc_* or obs_*)

**Response** (`V1ContentsResponse`):
```typescript
{
  items: {
    id: string;
    title: string | null;
    url: string;
    snippet: string;                // First 200 chars
    content?: string;               // Full content (observations only)
    source: string;
    type: string;
    occurredAt?: string;
    metadata?: Record<string, unknown>;
  }[];
  missing: string[];                // IDs not found
  requestId: string;
}
```

#### `/v1/findsimilar` Types (`packages/console-types/src/api/v1/findsimilar.ts`)

**Request** (`V1FindSimilarRequest`):
```typescript
{
  id?: string;                      // Content ID to find similar for
  url?: string;                     // Alternative: URL to resolve
  limit?: number;                   // 1-50, default 10
  threshold?: number;               // 0-1 similarity, default 0.5
  sameSourceOnly?: boolean;         // Filter to same source type
  excludeIds?: string[];            // IDs to exclude
  filters?: V1SearchFilters;        // Same filters as search
}
```

**Response** (`V1FindSimilarResponse`):
```typescript
{
  source: {
    id: string;
    title: string;
    type: string;
    cluster?: {
      topic: string | null;
      memberCount: number;
    };
  };
  similar: {
    id: string;
    title: string;
    url: string;
    snippet?: string;
    score: number;                  // Combined similarity 0-1
    vectorSimilarity: number;       // Raw vector score
    entityOverlap?: number;         // Entity overlap ratio
    sameCluster: boolean;           // In same topic cluster
    source: string;
    type: string;
    occurredAt?: string;
  }[];
  meta: {
    total: number;
    took: number;
    inputEmbedding: { found: boolean; generated: boolean };
  };
  requestId: string;
}
```

### 2. Current workspace-search.tsx Implementation

**Location**: `apps/console/src/components/workspace-search.tsx`

**Current Features**:
- Search input with Enter key handling
- Mode selector (fast/balanced/thorough) using ToggleGroup
- Source type filters (GitHub, Vercel) using Badge toggles
- Observation type filters using Badge toggles
- Search results displayed as cards with rank, score, badges
- Latency display in results header
- External link to source URL

**Missing Features** (for upgrade):
- Date range filter (schema supports it, UI doesn't)
- Actor name filter (schema supports it, UI doesn't)
- Full content view (needs /v1/contents integration)
- Similar items discovery (needs /v1/findsimilar integration)
- Context display (clusters, actors from search response)
- Entity display (from search results)
- Expanded detail view for results

### 3. Four-Path Search Implementation

**Location**: `apps/console/src/lib/neural/four-path-search.ts`

**Key Functions**:
- `fourPathParallelSearch()` - Main entry point (line 167)
- `enrichSearchResults()` - Database enrichment (line 340)
- `buildPineconeFilter()` - Filter construction (line 81)
- `mergeSearchResults()` - Vector + entity merge (line 121)

**Parallel Paths Executed**:
1. **Vector Search** - Pinecone semantic similarity
2. **Entity Search** - Pattern matching (@mentions, #refs, API endpoints)
3. **Cluster Search** - Topic centroid similarity (returns top 3)
4. **Actor Search** - Contributor profile matching (returns top 5)

**Score Boosting**:
- Entity match adds +0.2 to existing vector results (capped at 1.0)
- Entity-only results get `0.85 * confidence`

**Filter Support**:
```typescript
{
  sourceTypes: string[];        // Pinecone source field
  observationTypes: string[];   // Pinecone observationType field
  actorNames: string[];         // Pinecone actorName field
  dateRange: {
    start?: string;             // occurredAt >= start
    end?: string;               // occurredAt <= end
  }
}
```

### 4. Available UI Patterns

#### Tabs (`packages/ui/src/components/ui/tabs.tsx`)
For switching between views (Search / Contents / Similar)
```tsx
<Tabs value={view} onValueChange={setView}>
  <TabsList>
    <TabsTrigger value="search">Search</TabsTrigger>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="similar">Similar</TabsTrigger>
  </TabsList>
</Tabs>
```

#### ToggleGroup (already used)
For mode selection, already implemented in workspace-search.tsx

#### Badge Filters (already used)
For source/type filters, already implemented

#### Collapsible (`packages/ui/src/components/ui/collapsible.tsx`)
For expandable result details:
```tsx
<Collapsible open={expanded} onOpenChange={setExpanded}>
  <CollapsibleTrigger>View Details</CollapsibleTrigger>
  <CollapsibleContent>
    {/* Full content, entities, similar items */}
  </CollapsibleContent>
</Collapsible>
```

#### Card Patterns
Existing SearchResultCard can be extended with:
- Click-to-expand behavior
- Inline detail section
- Similar items preview

### 5. URL Utilities

**URL Builder** (`apps/console/src/lib/neural/url-builder.ts`):
- `buildSourceUrl(source, sourceId, metadata)` - Constructs external URLs
- Handles GitHub (PR, issue, commit, release, discussion, file)
- Handles Vercel (deployments)
- Handles Linear (issues)

**URL Resolver** (`apps/console/src/lib/neural/url-resolver.ts`):
- `resolveByUrl(workspaceId, url)` - Resolves external URLs to content IDs
- Used by `/v1/findsimilar` when user provides URL instead of ID

### 6. Authentication

Both session (Clerk) and API key auth are supported via `withDualAuth()`:
- Session auth: Reads `X-Workspace-ID` header, validates org membership
- API key auth: Validates Bearer token, trusts `X-Workspace-ID`

Current workspace-search.tsx uses session auth (no Authorization header).

## Recommended UI Structure

### Search View (Primary)
```
┌─────────────────────────────────────────────────────────┐
│ Search Mode: [Fast] [Balanced] [Thorough]               │
├─────────────────────────────────────────────────────────┤
│ [Search input................................] [Search] │
├─────────────────────────────────────────────────────────┤
│ Filters:                                                │
│ Sources: [GitHub] [Vercel] [Linear]                     │
│ Types: [Push] [PR Opened] [PR Merged] [Issue] [Deploy]  │
│ Actors: [@username filter input]                        │
│ Date: [Start picker] to [End picker]  [Clear filters]   │
├─────────────────────────────────────────────────────────┤
│ Context (if includeContext):                            │
│ Topics: [Topic 1 badge] [Topic 2 badge]                 │
│ Experts: [@actor1] [@actor2] [@actor3]                  │
├─────────────────────────────────────────────────────────┤
│ 15 results (145ms total, 89ms retrieval, 45ms rerank)   │
│                                                         │
│ [1] Result Title                           [95%] github │
│     Snippet preview text...                             │
│     push • 2024-01-15 • @username                       │
│     [View Details] [Find Similar]                       │
│                                                         │
│ [2] Result Title                           [87%] vercel │
│     ...                                                 │
└─────────────────────────────────────────────────────────┘
```

### Detail View (Expanded Result)
```
┌─────────────────────────────────────────────────────────┐
│ ← Back to Results                                       │
├─────────────────────────────────────────────────────────┤
│ Title: PR #123 - Add new feature                        │
│ Source: github | Type: pull_request_merged              │
│ Date: 2024-01-15T10:30:00Z                              │
│ URL: https://github.com/org/repo/pull/123               │
├─────────────────────────────────────────────────────────┤
│ Full Content:                                           │
│ [Entire observation content from /v1/contents]          │
├─────────────────────────────────────────────────────────┤
│ Entities:                                               │
│ @username | #123 | ENG-456 | /api/endpoint              │
├─────────────────────────────────────────────────────────┤
│ Metadata:                                               │
│ { branch: "main", commitSha: "abc123", ... }            │
└─────────────────────────────────────────────────────────┘
```

### Similar Items Panel
```
┌─────────────────────────────────────────────────────────┐
│ Similar to: "PR #123 - Add new feature"                 │
│ Cluster: Authentication (15 items)                      │
├─────────────────────────────────────────────────────────┤
│ Options:                                                │
│ Threshold: [0.5 slider] Same source only: [ ]           │
├─────────────────────────────────────────────────────────┤
│ 8 similar items (234ms)                                 │
│                                                         │
│ [92%] Similar Result 1        [Same Cluster] [github]   │
│       Entity overlap: 45%                               │
│                                                         │
│ [78%] Similar Result 2                       [github]   │
│       ...                                               │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Initial Search
```
User Input → /v1/search POST
           → fourPathParallelSearch()
           → createRerankProvider(mode).rerank()
           → enrichSearchResults()
           → V1SearchResponse
           → Display in SearchResultCard list
```

### 2. View Full Content
```
Click "View Details" → /v1/contents POST { ids: [resultId] }
                     → Fetch from DB (observations + documents)
                     → V1ContentsResponse
                     → Display expanded content panel
```

### 3. Find Similar
```
Click "Find Similar" → /v1/findsimilar POST { id: resultId }
                     → Generate embedding for source
                     → Query Pinecone with filter
                     → Enrich with DB metadata
                     → V1FindSimilarResponse
                     → Display similar items panel
```

## Code References

### Types
- `packages/console-types/src/api/v1/search.ts:42-59` - V1SearchRequestSchema
- `packages/console-types/src/api/v1/search.ts:64-97` - V1SearchResultSchema
- `packages/console-types/src/api/v1/search.ts:191-204` - V1SearchResponseSchema
- `packages/console-types/src/api/v1/contents.ts:12-18` - V1ContentsRequestSchema
- `packages/console-types/src/api/v1/contents.ts:51-59` - V1ContentsResponseSchema
- `packages/console-types/src/api/v1/findsimilar.ts:13-32` - V1FindSimilarRequestSchema
- `packages/console-types/src/api/v1/findsimilar.ts:92-113` - V1FindSimilarResponseSchema

### Route Implementations
- `apps/console/src/app/(api)/v1/search/route.ts:34-246` - Search route
- `apps/console/src/app/(api)/v1/contents/route.ts:28-207` - Contents route
- `apps/console/src/app/(api)/v1/findsimilar/route.ts:48-422` - FindSimilar route
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:50-128` - Authentication

### Search Implementation
- `apps/console/src/lib/neural/four-path-search.ts:167-312` - fourPathParallelSearch
- `apps/console/src/lib/neural/four-path-search.ts:81-116` - buildPineconeFilter
- `apps/console/src/lib/neural/four-path-search.ts:340-428` - enrichSearchResults

### UI Components
- `apps/console/src/components/workspace-search.tsx:56-398` - Current component
- `apps/console/src/components/workspace-search.tsx:402-473` - SearchResultCard
- `packages/ui/src/components/ui/tabs.tsx` - Tabs component
- `packages/ui/src/components/ui/collapsible.tsx` - Collapsible component
- `packages/ui/src/components/ui/toggle-group.tsx` - ToggleGroup component
- `packages/ui/src/components/ui/badge.tsx` - Badge component

### URL Utilities
- `apps/console/src/lib/neural/url-builder.ts:17-36` - buildSourceUrl
- `apps/console/src/lib/neural/url-resolver.ts:104-150` - resolveByUrl

## New Type Imports Needed

```typescript
import type {
  // Search
  V1SearchRequest,
  V1SearchResponse,
  V1SearchResult,
  V1SearchFilters,
  V1SearchContext,
  V1SearchLatency,
  RerankMode,
  // Contents
  V1ContentsRequest,
  V1ContentsResponse,
  V1ContentItem,
  // FindSimilar
  V1FindSimilarRequest,
  V1FindSimilarResponse,
  V1FindSimilarResult,
  V1FindSimilarSource,
} from "@repo/console-types";
```

## Design Decisions

Clarified with user on 2025-12-14:

| Question | Decision |
|----------|----------|
| **Detail/Similar panel layout** | Inline expandable card (Collapsible within card) |
| **Actor name input** | Autocomplete from workspace actors |
| **Date picker** | Omit for now - no temporal filters in UI |
| **State persistence** | Yes - persist filters and selection in URL params |

### Implementation Implications

1. **Inline Expandable Cards**
   - Use `Collapsible` component within `SearchResultCard`
   - Expanded state shows: full content (from `/v1/contents`), entities, similar items (from `/v1/findsimilar`)
   - Only one card expanded at a time (track `expandedId` in state)

2. **Actor Autocomplete**
   - Need tRPC query to fetch workspace actors for autocomplete suggestions
   - Use existing actor profiles from `workspaceActorProfiles` table
   - Display as combobox/autocomplete input in filters section

3. **No Date Filters**
   - Remove `dateRange` from UI filters (keep in API for future)
   - Simplifies initial implementation

4. **URL Param Persistence**
   - Sync to URL: `q` (query), `mode`, `sources`, `types`, `actors`, `expanded` (selected result ID)
   - Use `useSearchParams` + `router.push` pattern (already partially implemented)
   - Enables sharing search results and deep-linking to specific results

## Open Questions

1. **Pagination** - Current search returns up to 100 results. Should we add infinite scroll or explicit pagination controls? (Defer to implementation)
