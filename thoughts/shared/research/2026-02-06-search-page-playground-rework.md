---
date: "2026-02-06T17:45:00+08:00"
researcher: Claude
git_commit: b747d5966fbd59a52ac2c58570885b0c0e830537
branch: feat/definitive-links-strict-relationships
repository: lightfast
topic: "Search Page Playground Rework - Complete Architecture Documentation"
tags: [research, codebase, search-page, v1-search, playground, list-json-view]
status: complete
last_updated: "2026-02-06"
last_updated_by: Claude
---

# Research: Search Page Playground Rework - Complete Architecture Documentation

**Date**: 2026-02-06T17:45:00+08:00
**Researcher**: Claude
**Git Commit**: b747d5966fbd59a52ac2c58570885b0c0e830537
**Branch**: feat/definitive-links-strict-relationships
**Repository**: lightfast

## Research Question

Document the complete current architecture of the search page (`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/search/page.tsx`) and the v1/search API to support a full rework into a playground-style UI inspired by Exa's search playground. The new UI uses a left panel for controls and a right panel with "List" and "JSON" tabs (instead of "Code" and "Output").

## Summary

The search page is a server component that prefetches the workspace store and renders a `WorkspaceSearch` client component. The client component manages URL-persisted state via `nuqs`, calls the `/v1/search` API directly via `fetch`, and renders results in expandable cards. The v1/search API accepts 7 parameters (query, limit, offset, mode, filters, includeContext, includeHighlights) and returns a rich response with data, context, meta, and latency breakdowns. The rework needs to expose ALL these API parameters as controls (left panel) and display results as either a List view (current card-based rendering) or raw JSON output (right panel).

---

## Detailed Findings

### 1. Current Search Page Server Component

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/search/page.tsx` (37 lines)

The server component:
- Receives `params` (slug, workspaceName) and `searchParams` (q)
- Prefetches `orgTrpc.workspace.store.get` via tRPC server-side
- Wraps in `<Suspense>` with `<WorkspaceSearchSkeleton>` fallback
- Renders `<WorkspaceSearch>` inside `<HydrateClient>` with padding `py-2 px-6`

### 2. Current WorkspaceSearch Client Component

**File**: `apps/console/src/components/workspace-search.tsx` (851 lines)

Two major sections: `WorkspaceSearch` (main component, ~474 lines) and `SearchResultCard` (expandable result, ~335 lines).

#### 2a. WorkspaceSearch Component

**Props**: `orgSlug`, `workspaceName`, `initialQuery`

**State Management**:
- URL-persisted via `useWorkspaceSearchParams(initialQuery)`: query, mode, sourceTypes, observationTypes, actorNames, expandedId
- Local state: `searchResults` (V1SearchResponse | null), `isSearching` (boolean), `error` (string | null)

**Workspace Store**: Fetched via `useSuspenseQuery` on `trpc.workspace.store.get` — provides `store.id` used as `X-Workspace-ID` header.

**Search Execution** (`handleSearch` callback):
- POST to `/v1/search` with:
  - Header: `X-Workspace-ID: store.id`
  - Body: `{ query, limit: 20, offset: 0, mode, filters: { sourceTypes, observationTypes, actorNames }, includeContext: true, includeHighlights: true }`
- **Note**: `limit` is hardcoded to 20, `offset` is hardcoded to 0, `includeContext` and `includeHighlights` are hardcoded to `true`

**UI Layout** (current, single-column):
1. Header: "Search" with "Semantic" badge
2. Search Controls Card:
   - Store info (read-only: embedding model, doc count)
   - Search Mode toggle (fast/balanced/thorough)
   - Search input with button
   - Filters: Source types (GitHub, Vercel), Observation types (8 options), Actor filter (combobox), Clear filters button
   - Error display
3. Results section:
   - Results header with count, latency, mode badge
   - Search context (clusters, relevant actors)
   - Result cards (or empty state)
4. Quick links (Insights, Sources)
5. Empty state (before search)

#### 2b. SearchResultCard Component

**Props**: `result` (V1SearchResult), `rank`, `isExpanded`, `onToggleExpand`, `storeId`

**Features**:
- Collapsible card with rank indicator, title, score badge, source badge
- Collapsed: snippet preview, type, date
- Expanded: ID (copyable), URL link, entities list, full content (via `/v1/contents` API), metadata (JSON), Find Similar button (via `/v1/findsimilar` API)
- Find Similar: shows source cluster info, similar items with scores, entity overlap, same-cluster indicator

### 3. URL State Hook

**File**: `apps/console/src/components/use-workspace-search-params.ts` (57 lines)

Uses `nuqs` `useQueryStates` with `history: "push"` and `shallow: true`:

| URL Param | Type | Default | Maps To |
|-----------|------|---------|---------|
| `q` | string | initialQuery | query |
| `mode` | "fast" \| "balanced" \| "thorough" | "balanced" | mode (RerankMode) |
| `sources` | string[] | [] | sourceTypes |
| `types` | string[] | [] | observationTypes |
| `actors` | string[] | [] | actorNames |
| `expanded` | string | "" | expandedId |

### 4. V1 Search Request Schema (Full API Parameters)

**File**: `packages/console-types/src/api/v1/search.ts:42-81`

```typescript
V1SearchRequestSchema = z.object({
  query: z.string().min(1),                           // Required
  limit: z.number().int().min(1).max(100).default(10), // 1-100, default 10
  offset: z.number().int().min(0).default(0),          // Pagination, default 0
  mode: RerankModeSchema.default("balanced"),           // "fast"|"balanced"|"thorough"
  filters: V1SearchFiltersSchema.optional(),            // Optional filters object
  includeContext: z.boolean().default(true),             // Clusters + actors
  includeHighlights: z.boolean().default(true),         // Highlighted snippets
});
```

### 5. V1 Search Filters Schema

**File**: `packages/console-types/src/api/v1/search.ts:21-35`

```typescript
V1SearchFiltersSchema = z.object({
  sourceTypes: z.array(z.string()).optional(),      // e.g. ["github", "vercel"]
  observationTypes: z.array(z.string()).optional(), // e.g. ["push", "pull_request_opened"]
  actorNames: z.array(z.string()).optional(),       // e.g. ["@sarah"]
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  }).optional(),
});
```

**Note**: The current UI does NOT expose `dateRange` filtering. The API supports it but the client doesn't use it.

### 6. V1 Search Response Schema (Complete)

**File**: `packages/console-types/src/api/v1/search.ts:233-246`

```typescript
V1SearchResponseSchema = z.object({
  data: z.array(V1SearchResultSchema),       // Search results
  context: V1SearchContextSchema.optional(), // Clusters + actors
  meta: V1SearchMetaSchema,                  // Pagination + paths
  latency: V1SearchLatencySchema,            // Detailed timing
  requestId: z.string(),                     // Debug ID
});
```

#### V1SearchResult Fields (`search.ts:104-141`)

| Field | Type | Description |
|-------|------|-------------|
| id | string | Observation ID |
| title | string | Document title |
| url | string | Source URL |
| snippet | string | Content snippet |
| score | number | Relevance score (0-1) |
| source | string | Source type (github, vercel, etc.) |
| type | string | Observation type (push, pr, etc.) |
| occurredAt | string? | ISO datetime |
| entities | {key, category}[]? | Extracted entities |
| references | V1SourceReference[]? | Cross-source refs |
| highlights | {title?, snippet?}? | Highlighted text |

#### V1SearchMeta Fields (`search.ts:208-228`)

| Field | Type | Description |
|-------|------|-------------|
| total | number | Total results before pagination |
| limit | number | Results in this page |
| offset | number | Current offset |
| took | number | Total time (ms) |
| mode | RerankMode | Mode used |
| paths | {vector, entity, cluster, actor} | Which search paths ran |

#### V1SearchLatency Fields (`search.ts:173-203`)

| Field | Type | Description |
|-------|------|-------------|
| total | number | Total request latency |
| auth | number? | Auth time |
| parse | number? | Parse/validation time |
| search | number? | 4-path search total |
| embedding | number? | Embedding generation |
| retrieval | number | Vector retrieval |
| entitySearch | number? | Entity search |
| clusterSearch | number? | Cluster search |
| actorSearch | number? | Actor search |
| rerank | number | Reranking |
| enrich | number? | DB enrichment |
| maxParallel | number? | Bottleneck parallel op |

#### V1SearchContext Fields (`search.ts:146-168`)

| Field | Type | Description |
|-------|------|-------------|
| clusters | {topic, summary, keywords}[]? | Topic clusters |
| relevantActors | {displayName, expertiseDomains}[]? | Key contributors |

### 7. Search Mode Options (Current UI)

**File**: `workspace-search.tsx:66-70`

```typescript
const MODE_OPTIONS = [
  { value: "fast",      label: "Fast",      icon: Zap,   description: "Vector scores only (~50ms)" },
  { value: "balanced",  label: "Balanced",   icon: Scale, description: "Cohere rerank (~130ms)" },
  { value: "thorough",  label: "Thorough",   icon: Brain, description: "LLM scoring (~600ms)" },
];
```

### 8. Filter Options (Current UI)

**Source Types** (`workspace-search.tsx:50-53`):
- `github` → "GitHub"
- `vercel` → "Vercel"

**Observation Types** (`workspace-search.tsx:55-64`):
- `push` → "Push"
- `pull_request_opened` → "PR Opened"
- `pull_request_merged` → "PR Merged"
- `pull_request_closed` → "PR Closed"
- `issue_opened` → "Issue Opened"
- `issue_closed` → "Issue Closed"
- `deployment_succeeded` → "Deploy Success"
- `deployment_error` → "Deploy Error"

**Actor Filter**: Dynamic combobox via `trpc.workspace.getActors` with search and multi-select.

### 9. Actor Filter Component

**File**: `apps/console/src/components/actor-filter.tsx` (146 lines)

- Uses `@repo/ui` Command + Popover for searchable multi-select
- Fetches actors via `trpc.workspace.getActors` with search and limit
- Shows selected actors as badges with remove buttons
- Popover shows actor displayName and observationCount

### 10. Authentication Flow (Console UI → v1/search)

**File**: `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts`

The console UI uses session auth (not API key). The flow:
1. Client sends `X-Workspace-ID: {store.id}` header
2. `withDualAuth` checks for Clerk session (no `Authorization` header with `sk-lf-` prefix)
3. Validates workspace access via org membership
4. Returns `{ workspaceId, userId, authType: "session" }`

### 11. Related V1 APIs Used by Expanded Results

**`/v1/contents`** (POST): Fetch full content by IDs
- Request: `{ ids: [string] }`
- Response: `{ items: V1ContentItem[], missing: string[], requestId }`
- V1ContentItem: id, title, url, snippet, content, source, type, occurredAt, metadata

**`/v1/findsimilar`** (POST): Find similar content
- Request: `{ id: string, limit: number, threshold: number }`
- Response: `{ source, similar: V1FindSimilarResult[], meta, requestId }`
- V1FindSimilarResult: id, title, url, snippet, score, vectorSimilarity, entityOverlap, sameCluster, source, type, occurredAt

### 12. Search Logic Pipeline

**File**: `apps/console/src/lib/v1/search.ts` (193 lines)

The search pipeline:
1. **4-path parallel search** (`fourPathParallelSearch`): Runs vector, entity, cluster, and actor searches in parallel
2. **Reranking**: Uses mode-specific reranker (fast=none, balanced=Cohere, thorough=LLM)
3. **Pagination**: Slices reranked results by offset/limit
4. **Enrichment**: Fetches full metadata from database
5. **Response building**: Assembles results, context, meta, latency

---

## Mapping: Exa Playground UI → v1/search API Controls

Based on the provided screenshot of Exa's search playground, here is how each Exa control maps to the v1/search API:

### Left Panel Controls

| Exa UI Element | v1/search Equivalent | Current UI Status |
|---------------|---------------------|-------------------|
| **Query** (text input) | `query` (required string) | Exists as search input |
| **Search Type** (slider: Neural/Fast/Auto/Deep) | `mode` ("fast"/"balanced"/"thorough") | Exists as ToggleGroup |
| **Result category** (dropdown) | `filters.observationTypes` | Exists as badge toggles |
| **Number of results** (input, max 100) | `limit` (1-100, default 10) | **Hardcoded to 20** — needs control |
| **Full webpage text** (toggle) | `includeContext` (boolean) | **Hardcoded to true** — needs control |
| **Max characters per result** | No direct equivalent | N/A |
| **Highlights** (toggle) | `includeHighlights` (boolean) | **Hardcoded to true** — needs control |
| **Max content age (hours)** | `filters.dateRange.start` | **Not exposed in UI** — needs control |
| **Livecrawl timeout** | No equivalent | N/A |
| **Domain filter** (Include/Exclude) | `filters.sourceTypes` | Exists as badge toggles |
| **User location** (country) | No equivalent | N/A |
| **Include text** | No equivalent | N/A |
| **Exclude text** | No equivalent | N/A |
| **Clear** button | `clearFilters()` | Exists |
| **Run** button | `handleSearch()` | Exists |

### Additional v1/search Controls NOT in Exa but Available

| v1/search Parameter | Description | Current UI |
|---------------------|-------------|------------|
| `offset` (pagination) | Result offset for pagination | **Hardcoded to 0** — needs control |
| `filters.actorNames` | Filter by actor/contributor | Exists (combobox) |
| `filters.dateRange.end` | End date filter | **Not exposed** |

### Right Panel: List vs JSON

| Tab | Content |
|-----|---------|
| **List** | Current search result cards (SearchResultCard) with expandable content, entities, find-similar |
| **JSON** | Raw `V1SearchResponse` JSON output (the full response object including data, context, meta, latency, requestId) |

---

## Code References

- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/search/page.tsx` — Search page server component
- `apps/console/src/components/workspace-search.tsx` — WorkspaceSearch client component (851 lines)
- `apps/console/src/components/use-workspace-search-params.ts` — URL state hook (nuqs)
- `apps/console/src/components/actor-filter.tsx` — Actor filter combobox
- `packages/console-types/src/api/v1/search.ts` — Full request/response schemas
- `apps/console/src/lib/v1/search.ts` — Search logic (searchLogic function)
- `apps/console/src/app/(api)/v1/search/route.ts` — Search route handler
- `apps/console/src/app/(api)/v1/contents/route.ts` — Contents route handler
- `apps/console/src/app/(api)/v1/findsimilar/route.ts` — FindSimilar route handler
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts` — Dual auth middleware
- `apps/console/src/lib/v1/index.ts` — V1AuthContext type
- `apps/console/src/lib/neural/four-path-search.ts` — 4-path parallel search engine

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-02-06-workspace-search-ask-lightfast-page-split.md` — Implementation plan that already split the page into separate `/search` route and Ask Lightfast root. The search page at `/search` is the one being reworked.
- `thoughts/shared/research/2026-02-06-workspace-search-ask-lightfast-page-split.md` — Research documenting the split architecture, route structure, and how the workspace store flows through components.
- `thoughts/shared/plans/2026-02-05-accelerator-demo-search-showcase.md` — Demo plan for search showcase with specific search scenarios.
- `thoughts/shared/research/2026-02-05-search-api-evaluation-pipeline-golden-dataset-design.md` — Research on four-path search architecture and evaluation.

## Architecture Documentation

### Current Component Tree
```
search/page.tsx (server)
  └── <Suspense fallback={<WorkspaceSearchSkeleton />}>
        └── <HydrateClient>
              └── <WorkspaceSearch> (client)
                    ├── useSuspenseQuery(workspace.store.get) → store.id
                    ├── useWorkspaceSearchParams() → URL state (nuqs)
                    ├── handleSearch() → fetch("/v1/search", { X-Workspace-ID: store.id })
                    ├── [Header] "Search" + Semantic badge
                    ├── [Controls Card]
                    │     ├── Store info (read-only)
                    │     ├── Mode toggle (fast/balanced/thorough)
                    │     ├── Search input + button
                    │     ├── Source filters (badge toggles)
                    │     ├── Event type filters (badge toggles)
                    │     ├── Actor filter (combobox)
                    │     └── Error display
                    ├── [Results]
                    │     ├── Results header (count, latency, mode)
                    │     ├── Context (clusters, actors)
                    │     └── SearchResultCard[] (expandable)
                    │           ├── Collapsed: rank, title, score, source, snippet, type, date
                    │           └── Expanded: ID, URL, entities, full content, metadata, find-similar
                    ├── [Empty State] (before search)
                    └── [Quick Links] (insights, sources)
```

### API Request/Response Flow
```
Client (WorkspaceSearch)
  │
  ├─ POST /v1/search
  │   Headers: { X-Workspace-ID: store.id }
  │   Body: { query, limit, offset, mode, filters, includeContext, includeHighlights }
  │   └─ Response: { data[], context, meta, latency, requestId }
  │
  ├─ POST /v1/contents (on expand)
  │   Headers: { X-Workspace-ID: store.id }
  │   Body: { ids: [result.id] }
  │   └─ Response: { items[], missing[], requestId }
  │
  └─ POST /v1/findsimilar (on "Find Similar" click)
      Headers: { X-Workspace-ID: store.id }
      Body: { id: result.id, limit: 5, threshold: 0.5 }
      └─ Response: { source, similar[], meta, requestId }
```

## Visual Layout Diagrams

### Current Layout (Single Column)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                         SEARCH PAGE                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Search ✨ Semantic                                            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🗄️  Searching in: ada-002 (1,234 docs)                    │ │
│  │                                                            │ │
│  │ Search Mode:                                              │ │
│  │ ⚡ Fast    ⚖️ Balanced ✓   🧠 Thorough                  │ │
│  │                                                            │ │
│  │ 🔍 Ask a question or describe what you're looking for...  │ │
│  │                                              [Search] 🔍  │ │
│  │                                                            │ │
│  │ Sources:          Events:                                 │ │
│  │ [GitHub] [Vercel] [Push] [PR Opened] [PR Merged]...      │ │
│  │                                                            │ │
│  │ Actors:           [Add actor ▼]                           │ │
│  │                                                            │ │
│  │ [Clear filters]                                           │ │
│  │                                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  20 results found (145ms total, 32ms retrieval, 28ms balanced)  │
│                                                    [balanced]    │
│                                                                 │
│  Related Topics                     Key Contributors            │
│  [Topic 1 (keyword1, keyword2)]     [john (auth) • mike (ops)] │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ① Fix bug in search (#892)                 90% [github] │ │
│  │ Fixed a critical search bug in the retrieval...           │ │
│  │ push • 2 days ago                                         │ │
│  │ ──────────────────────────────────────────────────────── │ │
│  │ [📋 abc123def456] [🔗 View source]                      │ │
│  │                                                            │ │
│  │ Entities:                                                 │ │
│  │ [search (component)] [bug (issue)] [fix (status)]         │ │
│  │                                                            │ │
│  │ Content:                                                  │ │
│  │ Fixed a critical bug in the search retrieval path...      │ │
│  │ [scrollable]                                              │ │
│  │                                                            │ │
│  │ Metadata:                                                 │ │
│  │ { "author": "john", "status": "merged", ... }             │ │
│  │                                                            │ │
│  │ [✨ Find Similar] (3)                                     │ │
│  │ ├─ Cluster: Search Improvements (12 items)               │ │
│  │ ├─ [PR: Add caching to search (92%)] [Same Cluster]      │ │
│  │ ├─ [Commit: Optimize retrieval (87%)]                    │ │
│  │ └─ [Issue: Search performance (81%)]                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ② Speed up API responses (#891)            87% [github] │ │
│  │ Implemented caching layer for frequently accessed...      │ │
│  │ pull_request • 3 days ago                                 │ │
│  │ ...                                                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ... more results ...                                           │
│                                                                 │
│  View Insights    Manage Sources                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### New Playground Layout (Split Panel - List View)

```
┌──────────────────────────────────────┬──────────────────────────────────────┐
│                                      │                                      │
│         LEFT PANEL (CONTROLS)        │      RIGHT PANEL (RESULTS)           │
│                                      │                                      │
├──────────────────────────────────────┼──────────────────────────────────────┤
│                                      │                                      │
│  Query                               │  [List]  [JSON]                      │
│  ┌──────────────────────────────────┐│                                      │
│  │ search bug fixes                 ││  ┌──────────────────────────────────┐│
│  │                                  ││  │                                  ││
│  └──────────────────────────────────┘│  │ 20 results found                 ││
│                                      │  │ (145ms total, 32ms retrieval)    ││
│  [Run] [Clear]                       │  │                [balanced] ▼       ││
│                                      │  │                                  ││
│  ─────────────────────────────────── │  │  Related Topics                  ││
│                                      │  │  [Topic 1 (keywords)]            ││
│  Search Type                         │  │                                  ││
│  ◄─ Fast  Balanced  Thorough ───►   │  │  Key Contributors                ││
│    (~50ms) (~130ms) (~600ms)        │  │  [john (auth)] [mike (ops)]      ││
│                                      │  │                                  ││
│  ─────────────────────────────────── │  │  ──────────────────────────────  ││
│                                      │  │                                  ││
│  Number of Results                   │  │  ① Fix bug in search (#892)      ││
│  ┌──────────────────────────────────┐│  │     90% [github]                 ││
│  │ 20                               ││  │                                  ││
│  │ [  min: 1    max: 100  ]         ││  │  Fixed a critical search bug...  ││
│  └──────────────────────────────────┘│  │  push • 2 days ago               ││
│                                      │  │                                  ││
│  Pagination                          │  │  ──────────────────────────────  ││
│  Offset                              │  │                                  ││
│  ┌──────────────────────────────────┐│  │  ② Speed up API responses (#891) ││
│  │ 0                                ││  │     87% [github]                 ││
│  │ [  min: 0              ]         ││  │                                  ││
│  └──────────────────────────────────┘│  │  Implemented caching layer...    ││
│                                      │  │  pull_request • 3 days ago       ││
│  ─────────────────────────────────── │  │                                  ││
│                                      │  │  ──────────────────────────────  ││
│  Contents                            │  │                                  ││
│  ☑ Include Context                   │  │  ③ Optimize retrieval latency    ││
│  ☑ Highlights                        │  │     85% [github]                 ││
│                                      │  │                                  ││
│  ─────────────────────────────────── │  │  Reduced query times by 40%...   ││
│                                      │  │  commit • 4 days ago             ││
│  Filters                             │  │                                  ││
│                                      │  │  [scroll for more...]            ││
│  Sources                             │  │  ║                               ││
│  ☑ GitHub                            │  │  ║                               ││
│  ☐ Vercel                            │  │  ║                               ││
│                                      │  │  └──────────────────────────────┘│
│  Event Types                         │  │                                  │
│  ☑ Push                              │  └──────────────────────────────────┘
│  ☑ PR Opened                         │
│  ☑ PR Merged                         │
│  ☐ PR Closed                         │
│  ☑ Issue Opened                      │
│  ☐ Issue Closed                      │
│  ☑ Deploy Success                    │
│  ☐ Deploy Error                      │
│                                      │
│  Actors                              │
│  ┌──────────────────────────────────┐│
│  │ [john] ✕  [mike] ✕               ││
│  │ [Add actor ▼]                    ││
│  │ Search actors...                 ││
│  │                                  ││
│  │ ✓ john (234 observations)        ││
│  │ ✓ mike (156 observations)        ││
│  │   sarah (89 observations)        ││
│  │                                  ││
│  └──────────────────────────────────┘│
│                                      │
│  Max Content Age                     │
│  ┌──────────────────────────────────┐│
│  │ 24 hours        [▼]              ││
│  │ 1h | 6h | 24h | 72h | ∞          ││
│  └──────────────────────────────────┘│
│                                      │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### JSON Tab View

```
┌──────────────────────────────────────┬──────────────────────────────────────┐
│                                      │                                      │
│         LEFT PANEL (CONTROLS)        │      RIGHT PANEL (JSON OUTPUT)       │
│                                      │                                      │
├──────────────────────────────────────┼──────────────────────────────────────┤
│                                      │                                      │
│  Query                               │  [List]  [JSON]                      │
│  ┌──────────────────────────────────┐│                                      │
│  │ search bug fixes                 ││  ┌──────────────────────────────────┐│
│  │                                  ││  │ {                                ││
│  └──────────────────────────────────┘│  │   "data": [                      ││
│                                      │  │     {                            ││
│  [Run] [Clear]                       │  │       "id": "obs_123abc",        ││
│                                      │  │       "title": "Fix bug...",     ││
│  ...                                 │  │       "url": "https://...",      ││
│  [all controls same as List view]    │  │       "snippet": "Fixed a...",   ││
│  ...                                 │  │       "score": 0.92,             ││
│                                      │  │       "source": "github",        ││
│                                      │  │       "type": "commit",          ││
│                                      │  │       "occurredAt": "2026-...",  ││
│                                      │  │       "entities": [              ││
│                                      │  │         {                        ││
│                                      │  │           "key": "search",       ││
│                                      │  │           "category": "component"││
│                                      │  │         }                        ││
│                                      │  │       ],                         ││
│                                      │  │       "references": [...]        ││
│                                      │  │     },                           ││
│                                      │  │     {...}  // 19 more results    ││
│                                      │  │   ],                             ││
│                                      │  │   "context": {                   ││
│                                      │  │     "clusters": [                ││
│                                      │  │       {                          ││
│                                      │  │         "topic": "Search...",    ││
│                                      │  │         "keywords": [...]        ││
│                                      │  │       }                          ││
│                                      │  │     ],                           ││
│                                      │  │     "relevantActors": [...]      ││
│                                      │  │   },                             ││
│                                      │  │   "meta": {                      ││
│                                      │  │     "total": 1250,               ││
│                                      │  │     "limit": 20,                 ││
│                                      │  │     "offset": 0,                 ││
│                                      │  │     "took": 145,                 ││
│                                      │  │     "mode": "balanced",          ││
│                                      │  │     "paths": {                   ││
│                                      │  │       "vector": true,            ││
│                                      │  │       "entity": true,            ││
│                                      │  │       "cluster": true,           ││
│                                      │  │       "actor": true              ││
│                                      │  │     }                            ││
│                                      │  │   },                             ││
│                                      │  │   "latency": {                   ││
│                                      │  │     "total": 145,                ││
│                                      │  │     "auth": 2,                   ││
│                                      │  │     "parse": 1,                  ││
│                                      │  │     "search": 85,                ││
│                                      │  │     "embedding": 35,             ││
│                                      │  │     "retrieval": 22,             ││
│                                      │  │     "rerank": 28,                ││
│                                      │  │     "enrich": 12                 ││
│                                      │  │   },                             ││
│                                      │  │   "requestId": "req_789xyz"      ││
│                                      │  │ }                                ││
│                                      │  │                                  ││
│                                      │  │ [copy] [scroll for full JSON]    ││
│                                      │  │                                  ││
│                                      │  └──────────────────────────────────┘│
│                                      │                                      │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### Expanded Result Card Detail (List View)

```
  ┌──────────────────────────────────────────────────────────────┐
  │ ① Fix bug in search (#892)                   90% [github]   │
  │ Fixed a critical search bug in the retrieval...               │
  │ push • 2 days ago                                             │
  │                                                               │
  │ ──────────────────────────────────────────────────────────  │
  │                                                               │
  │ [📋 abc123def456]  [🔗 View source]                         │
  │                                                               │
  │ Entities                                                      │
  │ ┌──────────────────────────────────────────────────────────┐ │
  │ │ [search (component)]  [bug (issue)]  [fix (status)]     │ │
  │ └──────────────────────────────────────────────────────────┘ │
  │                                                               │
  │ Content                                                       │
  │ ┌──────────────────────────────────────────────────────────┐ │
  │ │ Fixed a critical bug in the search retrieval path that  │ │
  │ │ was causing timeouts on large datasets. The issue was   │ │
  │ │ in the vector similarity calculation where we were      │ │
  │ │ loading entire embeddings into memory instead of using  │ │
  │ │ batch processing. Implemented streaming batch...        │ │
  │ │                                                          │ │
  │ │ [scroll to see more...]                                 │ │
  │ └──────────────────────────────────────────────────────────┘ │
  │                                                               │
  │ Metadata                                                      │
  │ ┌──────────────────────────────────────────────────────────┐ │
  │ │ {                                                        │ │
  │ │   "author": "john",                                      │ │
  │ │   "status": "merged",                                    │ │
  │ │   "pr_number": 892,                                      │ │
  │ │   "files_changed": 7,                                    │ │
  │ │   "additions": 156,                                      │ │
  │ │   "deletions": 42                                        │ │
  │ │ }                                                        │ │
  │ │                                                          │ │
  │ │ [scroll to see more...]                                 │ │
  │ └──────────────────────────────────────────────────────────┘ │
  │                                                               │
  │ [✨ Find Similar] (3)                                        │
  │ ─────────────────────────────────────────────────────────── │
  │                                                               │
  │ Cluster: Search Improvements (12 items)                      │
  │                                                               │
  │ ┌────────────────────────────────────────────────────────┐ │
  │ │ [PR: Add caching to search]      92% [Same Cluster]   │ │
  │ │ [Commit: Optimize retrieval]     87%                  │ │
  │ │ [Issue: Search performance]      81%                  │ │
  │ └────────────────────────────────────────────────────────┘ │
  │                                                               │
  └──────────────────────────────────────────────────────────────┘
```

### Controls Left Panel - Detailed Layout

```
┌─────────────────────────────────────────┐
│    SEARCH PLAYGROUND - CONTROLS PANEL    │
├─────────────────────────────────────────┤
│                                         │
│  QUERY                                  │
│  ┌─────────────────────────────────────┐│
│  │ search bug fixes                    ││
│  │                                     ││
│  │                                     ││
│  └─────────────────────────────────────┘│
│                                         │
│  [Run]  [Clear]                         │
│                                         │
│  ═══════════════════════════════════════ │
│                                         │
│  SEARCH TYPE                            │
│  Fast ─────●───────── Thorough          │
│  ~50ms          ~600ms                  │
│  (vector)       (llm)                   │
│  ◀─ Balanced (recommended, ~130ms)     │
│                                         │
│  ═══════════════════════════════════════ │
│                                         │
│  NUMBER OF RESULTS                      │
│  ┌─────────────────────────────────────┐│
│  │ 20                                  ││
│  │ [spinner input: min 1, max 100]     ││
│  └─────────────────────────────────────┘│
│                                         │
│  PAGINATION                             │
│  Offset                                 │
│  ┌─────────────────────────────────────┐│
│  │ 0                                   ││
│  │ [spinner input: min 0]              ││
│  └─────────────────────────────────────┘│
│                                         │
│  ═══════════════════════════════════════ │
│                                         │
│  CONTENTS                               │
│  ☑ Include Context                      │
│  ☑ Highlights                           │
│                                         │
│  ═══════════════════════════════════════ │
│                                         │
│  FILTERS                                │
│                                         │
│  Sources                                │
│  ☑ GitHub                               │
│  ☐ Vercel                               │
│                                         │
│  Event Types                            │
│  ☑ Push                                 │
│  ☑ PR Opened                            │
│  ☑ PR Merged                            │
│  ☐ PR Closed                            │
│  ☑ Issue Opened                         │
│  ☐ Issue Closed                         │
│  ☑ Deploy Success                       │
│  ☐ Deploy Error                         │
│                                         │
│  Actors                                 │
│  [john] ✕   [mike] ✕                   │
│  [Add actor ▼]                          │
│  ┌─────────────────────────────────────┐│
│  │ Search actors...                    ││
│  │ ✓ john (234 observations)           ││
│  │ ✓ mike (156 observations)           ││
│  │   sarah (89 observations)           ││
│  │   david (45 observations)           ││
│  └─────────────────────────────────────┘│
│                                         │
│  Max Content Age                        │
│  ┌─────────────────────────────────────┐│
│  │ 24 hours               [▼]          ││
│  │ Options: 1h | 6h | 24h | 72h | ∞   ││
│  └─────────────────────────────────────┘│
│                                         │
│  ═══════════════════════════════════════ │
│                                         │
│  [scroll if more controls below]        │
│                                         │
└─────────────────────────────────────────┘
```

---

## Open Questions

1. Should the `limit` and `offset` controls use spinner inputs (current design) or something else?
2. Should `dateRange` be exposed as a date picker or a simpler "max age" dropdown like the diagram?
3. Should the JSON tab show raw response or formatted/syntax-highlighted view with copy button?
4. Should the playground persist control state in URL params (current via nuqs) or local state?
5. Should the "Run" button include a keyboard shortcut (e.g., Cmd+Enter)?
6. Should the left panel be scrollable if controls exceed viewport height?
7. Should the right panel tabs (List/JSON) be sticky at top during scroll?
