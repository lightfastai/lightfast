# Workspace Search V1 Three-Route Upgrade Implementation Plan

## Overview

Upgrade the `workspace-search.tsx` component to fully utilize all three v1 API routes (`/v1/search`, `/v1/contents`, `/v1/findsimilar`) with inline expandable cards, actor autocomplete, URL persistence, and comprehensive result details. This transforms the current search-only interface into a complete neural memory exploration experience.

## Current State Analysis

### What Exists Now

**Component**: `apps/console/src/components/workspace-search.tsx:56-510`
- Search input with Enter key handling
- Mode selector (fast/balanced/thorough) using ToggleGroup
- Source type filters (GitHub, Vercel) using Badge toggles
- Observation type filters (8 types) using Badge toggles
- Results displayed as cards with rank, score, source badges
- Latency display in results header
- External link to source URL
- Only `q` query param persisted to URL

**What's Missing**:
- Content detail view (`/v1/contents` integration)
- Similar items discovery (`/v1/findsimilar` integration)
- Context display (clusters, actors from search response)
- Entity display (from search results)
- Actor name filter
- URL persistence for filters and mode
- Expandable result details

### Key Discoveries

1. **V1 API Types** (`packages/console-types/src/api/v1/`):
   - Search returns `context` with clusters and relevantActors
   - Search results include `entities` array with key/category
   - Contents returns full `content` for observations
   - FindSimilar returns `sameCluster`, `entityOverlap`, `vectorSimilarity`

2. **Actor Profiles** (`db/console/src/schema/tables/workspace-actor-profiles.ts`):
   - Table exists with displayName, platform, expertiseDomains
   - No tRPC query exists yet - needs to be created

3. **UI Patterns Available**:
   - Collapsible component for expandable cards (used in activity-timeline.tsx)
   - nuqs library for URL state management (used in use-job-filters.ts)
   - Select/Combobox for autocomplete patterns

## Desired End State

After implementation, the workspace search component will:
1. Display search results with "View Details" and "Find Similar" action buttons
2. Expand results inline to show full content, entities, and similar items
3. Allow filtering by actor names via autocomplete
4. Persist all state (query, mode, filters, expanded result) in URL params
5. Display search context (clusters, actors) when available

### Verification

- Search results show action buttons: "View Details", "Find Similar"
- Clicking "View Details" expands card and fetches `/v1/contents`
- Clicking "Find Similar" shows similar items from `/v1/findsimilar`
- Actor filter autocomplete shows workspace actor names
- Refreshing page preserves query, mode, filters, and expanded state
- Context section shows relevant clusters and actors from search response

## What We're NOT Doing

- **Date range filter**: Omitting per design decision (schema supports it, UI won't)
- **Pagination controls**: Current hardcoded limit=20 is sufficient for now
- **Sort options**: Rely on API ordering (by relevance score)
- **Multiple expanded cards**: Only one card expanded at a time
- **Autocomplete query suggestions**: Not implementing search-as-you-type

## Implementation Approach

The upgrade follows a phased approach:
1. **Phase 1**: Add URL param persistence for existing state (foundation)
2. **Phase 2**: Add inline expandable cards with contents integration
3. **Phase 3**: Add similar items integration within expanded view
4. **Phase 4**: Add context display (clusters, actors from response)
5. **Phase 5**: Add actor name filter with autocomplete

Each phase builds on the previous and results in a working state.

---

## Phase 1: URL Parameter Persistence

### Overview

Replace manual URLSearchParams handling with nuqs library for type-safe URL state management. Persist query, mode, source filters, observation type filters, and expanded result ID.

### Changes Required

#### 1. Create URL State Hook

**File**: `apps/console/src/components/use-workspace-search-params.ts` (new file)

```typescript
import { parseAsString, parseAsStringEnum, parseAsArrayOf, useQueryStates } from "nuqs";
import type { RerankMode } from "@repo/console-types";

const rerankModes = ["fast", "balanced", "thorough"] as const;

export function useWorkspaceSearchParams(initialQuery = "") {
  const [params, setParams] = useQueryStates(
    {
      q: parseAsString.withDefault(initialQuery),
      mode: parseAsStringEnum<RerankMode>(rerankModes).withDefault("balanced"),
      sources: parseAsArrayOf(parseAsString).withDefault([]),
      types: parseAsArrayOf(parseAsString).withDefault([]),
      expanded: parseAsString.withDefault(""),
    },
    {
      history: "push",
      shallow: true,
    }
  );

  return {
    query: params.q,
    setQuery: (q: string) => setParams({ q }),
    mode: params.mode as RerankMode,
    setMode: (mode: RerankMode) => setParams({ mode }),
    sourceTypes: params.sources,
    setSourceTypes: (sources: string[]) => setParams({ sources }),
    observationTypes: params.types,
    setObservationTypes: (types: string[]) => setParams({ types }),
    expandedId: params.expanded,
    setExpandedId: (id: string | null) => setParams({ expanded: id ?? "" }),
    // Helper for clearing all filters
    clearFilters: () => setParams({ sources: [], types: [] }),
  };
}
```

#### 2. Update WorkspaceSearch Component

**File**: `apps/console/src/components/workspace-search.tsx`

**Changes**:
1. Replace local state with hook (lines 66-74 → hook call)
2. Remove `updateSearchParams` callback (lines 88-98)
3. Update filter handlers to use hook setters
4. Remove `useRouter`, `useSearchParams`, `useTransition` imports

```typescript
// Before (lines 66-74):
const [query, setQuery] = useState(initialQuery);
const [filters, setFilters] = useState<SearchFilters>({ sourceTypes: [], observationTypes: [] });
const [mode, setMode] = useState<RerankMode>("balanced");

// After:
const {
  query, setQuery,
  mode, setMode,
  sourceTypes, setSourceTypes,
  observationTypes, setObservationTypes,
  expandedId, setExpandedId,
  clearFilters,
} = useWorkspaceSearchParams(initialQuery);

// Update handleSearch to not call updateSearchParams (query already synced via nuqs)
// Update filter Badge onClick handlers to use setSourceTypes/setObservationTypes
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Typing in search input updates URL `?q=...`
- [ ] Changing mode updates URL `?mode=...`
- [ ] Clicking source filter badges updates URL `?sources=...`
- [ ] Clicking observation type badges updates URL `?types=...`
- [ ] Refreshing page preserves all state from URL
- [ ] "Clear filters" removes sources/types from URL

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Inline Expandable Cards with Contents Integration

### Overview

Add "View Details" button to each search result card. When clicked, expand the card inline using Collapsible component and fetch full content from `/v1/contents`. Display full content, entities, and metadata in expanded view.

### Changes Required

#### 1. Update Type Imports

**File**: `apps/console/src/components/workspace-search.tsx:15`

```typescript
// Add V1ContentsResponse import
import type {
  V1SearchResponse,
  V1SearchResult,
  V1ContentsResponse,
  RerankMode
} from "@repo/console-types";
```

#### 2. Add Collapsible Import

**File**: `apps/console/src/components/workspace-search.tsx` (imports section)

```typescript
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
```

#### 3. Add Content Fetching Hook

**File**: `apps/console/src/components/workspace-search.tsx` (after SearchFilters interface)

```typescript
interface ContentCache {
  [id: string]: {
    content: string | null;
    metadata: Record<string, unknown> | null;
    isLoading: boolean;
    error: string | null;
  };
}
```

#### 4. Extend SearchResultCard Component

**File**: `apps/console/src/components/workspace-search.tsx:402-473`

Replace with expanded implementation:

```typescript
function SearchResultCard({
  result,
  rank,
  isExpanded,
  onToggleExpand,
  storeId,
}: {
  result: V1SearchResult;
  rank: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  storeId: string;
}) {
  const scorePercent = Math.round(result.score * 100);
  const [contentData, setContentData] = useState<{
    content: string | null;
    metadata: Record<string, unknown> | null;
  } | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Fetch content when expanded
  useEffect(() => {
    if (isExpanded && !contentData && !isLoadingContent) {
      setIsLoadingContent(true);
      setContentError(null);

      fetch("/v1/contents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-ID": storeId,
        },
        body: JSON.stringify({ ids: [result.id] }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to fetch content");
          const data = (await res.json()) as V1ContentsResponse;
          const item = data.items[0];
          if (item) {
            setContentData({
              content: item.content ?? null,
              metadata: item.metadata ?? null,
            });
          } else {
            setContentError("Content not found");
          }
        })
        .catch((err) => {
          setContentError(err instanceof Error ? err.message : "Failed to load");
        })
        .finally(() => {
          setIsLoadingContent(false);
        });
    }
  }, [isExpanded, contentData, isLoadingContent, result.id, storeId]);

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(result.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <Card className="border-border/60 hover:border-border transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Rank indicator */}
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
              {rank}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Title row with expand trigger */}
              <div className="flex items-start justify-between gap-2">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1 hover:text-primary transition-colors text-left">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <h3 className="font-medium text-sm leading-tight">
                      {result.title || "Untitled Document"}
                    </h3>
                  </button>
                </CollapsibleTrigger>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge
                    variant={scorePercent >= 80 ? "default" : scorePercent >= 60 ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {scorePercent}%
                  </Badge>
                  {result.source && (
                    <Badge variant="outline" className="text-xs">
                      {result.source}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Snippet (collapsed view) */}
              {!isExpanded && result.snippet && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {result.snippet}
                </p>
              )}

              {/* Type and date */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {result.type && <span>{result.type}</span>}
                {result.occurredAt && (
                  <span>{new Date(result.occurredAt).toLocaleDateString()}</span>
                )}
              </div>

              {/* Expanded content */}
              <CollapsibleContent className="space-y-4 pt-2">
                {/* ID and URL */}
                <div className="flex items-center gap-2 text-xs">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 gap-1"
                    onClick={handleCopyId}
                  >
                    {copiedId ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span className="font-mono">{result.id}</span>
                  </Button>
                  {result.url && (
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View source
                    </a>
                  )}
                </div>

                {/* Entities */}
                {result.entities && result.entities.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Entities</span>
                    <div className="flex flex-wrap gap-1">
                      {result.entities.map((entity, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {entity.key}
                          <span className="ml-1 text-muted-foreground">({entity.category})</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full Content */}
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Content</span>
                  {isLoadingContent ? (
                    <Skeleton className="h-24 w-full" />
                  ) : contentError ? (
                    <p className="text-xs text-destructive">{contentError}</p>
                  ) : contentData?.content ? (
                    <pre className="text-xs bg-muted/50 border rounded-lg p-3 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                      {contentData.content}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No content available</p>
                  )}
                </div>

                {/* Metadata */}
                {contentData?.metadata && Object.keys(contentData.metadata).length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Metadata</span>
                    <pre className="text-xs bg-muted/50 border rounded-lg p-3 overflow-x-auto max-h-32 overflow-y-auto">
                      {JSON.stringify(contentData.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </div>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
```

#### 5. Update Results List to Pass Expansion Props

**File**: `apps/console/src/components/workspace-search.tsx:342-346`

```typescript
{searchResults.data.map((result, index) => (
  <SearchResultCard
    key={result.id}
    result={result}
    rank={index + 1}
    isExpanded={expandedId === result.id}
    onToggleExpand={() => setExpandedId(expandedId === result.id ? null : result.id)}
    storeId={store.id}
  />
))}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Each result card shows chevron icon for expand/collapse
- [ ] Clicking title/chevron expands the card inline
- [ ] Expanded card shows loading skeleton while fetching
- [ ] Content appears after fetch completes
- [ ] Entities display as badges with category
- [ ] Metadata displays as formatted JSON
- [ ] Only one card can be expanded at a time
- [ ] Refreshing page with `?expanded=obs_xxx` opens that card

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Similar Items Integration

### Overview

Add "Find Similar" button to expanded cards. When clicked, fetch similar items from `/v1/findsimilar` and display them in a sub-section within the expanded card.

### Changes Required

#### 1. Add Type Import

**File**: `apps/console/src/components/workspace-search.tsx:15`

```typescript
import type {
  V1SearchResponse,
  V1SearchResult,
  V1ContentsResponse,
  V1FindSimilarResponse,
  RerankMode
} from "@repo/console-types";
```

#### 2. Add Similar Items State to SearchResultCard

**File**: `apps/console/src/components/workspace-search.tsx` (inside SearchResultCard)

```typescript
// Add after contentData state
const [similarData, setSimilarData] = useState<V1FindSimilarResponse | null>(null);
const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
const [similarError, setSimilarError] = useState<string | null>(null);
const [showSimilar, setShowSimilar] = useState(false);

const fetchSimilar = async () => {
  if (similarData) {
    setShowSimilar(true);
    return;
  }

  setIsLoadingSimilar(true);
  setSimilarError(null);
  setShowSimilar(true);

  try {
    const res = await fetch("/v1/findsimilar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Workspace-ID": storeId,
      },
      body: JSON.stringify({
        id: result.id,
        limit: 5,
        threshold: 0.5,
      }),
    });

    if (!res.ok) throw new Error("Failed to fetch similar items");
    const data = (await res.json()) as V1FindSimilarResponse;
    setSimilarData(data);
  } catch (err) {
    setSimilarError(err instanceof Error ? err.message : "Failed to load");
  } finally {
    setIsLoadingSimilar(false);
  }
};
```

#### 3. Add Similar Items UI Section

**File**: `apps/console/src/components/workspace-search.tsx` (inside CollapsibleContent, after Metadata section)

```typescript
{/* Find Similar Button and Results */}
<div className="space-y-2 pt-2 border-t">
  <Button
    variant="outline"
    size="sm"
    onClick={fetchSimilar}
    disabled={isLoadingSimilar}
    className="gap-1"
  >
    {isLoadingSimilar ? (
      <Loader2 className="h-3 w-3 animate-spin" />
    ) : (
      <Sparkles className="h-3 w-3" />
    )}
    Find Similar
    {similarData && ` (${similarData.similar.length})`}
  </Button>

  {showSimilar && (
    <div className="space-y-2">
      {similarError ? (
        <p className="text-xs text-destructive">{similarError}</p>
      ) : isLoadingSimilar ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : similarData && similarData.similar.length > 0 ? (
        <>
          {/* Source cluster info */}
          {similarData.source.cluster && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span>Cluster:</span>
              <Badge variant="secondary" className="text-xs">
                {similarData.source.cluster.topic || "Uncategorized"}
              </Badge>
              <span>({similarData.source.cluster.memberCount} items)</span>
            </div>
          )}

          {/* Similar items list */}
          <div className="space-y-1">
            {similarData.similar.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2 p-2 rounded border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">{item.title}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className="text-[10px]">
                        {Math.round(item.score * 100)}%
                      </Badge>
                      {item.sameCluster && (
                        <Badge variant="secondary" className="text-[10px]">
                          Same Cluster
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{item.source}</span>
                    <span>•</span>
                    <span>{item.type}</span>
                    {item.entityOverlap !== undefined && item.entityOverlap > 0 && (
                      <>
                        <span>•</span>
                        <span>{Math.round(item.entityOverlap * 100)}% entity overlap</span>
                      </>
                    )}
                  </div>
                </div>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground italic">No similar items found</p>
      )}
    </div>
  )}
</div>
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Expanded cards show "Find Similar" button
- [ ] Clicking button shows loading state
- [ ] Similar items appear with score, source, type
- [ ] "Same Cluster" badge shows when applicable
- [ ] Entity overlap percentage shows when available
- [ ] Cluster info shows topic and member count
- [ ] External links work for similar items

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Context Display

### Overview

Display the search context (clusters and relevant actors) returned by `/v1/search` response in a collapsible section above the results.

### Changes Required

#### 1. Add Context Section Above Results

**File**: `apps/console/src/components/workspace-search.tsx` (after Results Header, before Results List)

Add between lines 326-328:

```typescript
{/* Search Context */}
{searchResults.context && (
  <div className="flex flex-wrap gap-4 pb-4 border-b">
    {/* Relevant Clusters */}
    {searchResults.context.clusters && searchResults.context.clusters.length > 0 && (
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Related Topics</span>
        <div className="flex flex-wrap gap-1">
          {searchResults.context.clusters.map((cluster, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs gap-1">
              <span>{cluster.topic || "Uncategorized"}</span>
              {cluster.keywords && cluster.keywords.length > 0 && (
                <span className="text-muted-foreground">
                  ({cluster.keywords.slice(0, 2).join(", ")})
                </span>
              )}
            </Badge>
          ))}
        </div>
      </div>
    )}

    {/* Relevant Actors */}
    {searchResults.context.relevantActors && searchResults.context.relevantActors.length > 0 && (
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Key Contributors</span>
        <div className="flex flex-wrap gap-1">
          {searchResults.context.relevantActors.map((actor, idx) => (
            <Badge key={idx} variant="outline" className="text-xs gap-1">
              <span>{actor.displayName}</span>
              {actor.expertiseDomains && actor.expertiseDomains.length > 0 && (
                <span className="text-muted-foreground">
                  • {actor.expertiseDomains[0]}
                </span>
              )}
            </Badge>
          ))}
        </div>
      </div>
    )}
  </div>
)}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Context section appears when search returns clusters/actors
- [ ] Cluster badges show topic and keywords
- [ ] Actor badges show name and primary expertise
- [ ] Section doesn't appear when no context available

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Actor Name Filter with Autocomplete

### Overview

Add actor name filter using a Combobox component with autocomplete. Requires creating a tRPC query to fetch workspace actors.

### Changes Required

#### 1. Create tRPC Query for Actors

**File**: `api/console/src/router/org/workspace.ts` (add to existing router)

```typescript
// Add to workspaceRouter procedures
getActors: orgProcedure
  .input(
    z.object({
      clerkOrgSlug: z.string(),
      workspaceName: z.string(),
      search: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    })
  )
  .query(async ({ ctx, input }) => {
    const workspace = await ctx.db.query.orgWorkspaces.findFirst({
      where: (w, { and, eq }) =>
        and(
          eq(w.clerkOrgId, ctx.auth.clerkOrgId),
          eq(w.name, input.workspaceName)
        ),
    });

    if (!workspace) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
    }

    const actors = await ctx.db.query.workspaceActorProfiles.findMany({
      where: (a, { and, eq, like }) =>
        and(
          eq(a.workspaceId, workspace.id),
          input.search
            ? like(a.displayName, `%${input.search}%`)
            : undefined
        ),
      limit: input.limit,
      orderBy: (a, { desc }) => [desc(a.observationCount)],
    });

    return actors.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      platform: a.platform,
      observationCount: a.observationCount,
    }));
  }),
```

#### 2. Create Actor Filter Component

**File**: `apps/console/src/components/actor-filter.tsx` (new file)

```typescript
"use client";

import { useState, useCallback } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface ActorFilterProps {
  orgSlug: string;
  workspaceName: string;
  selectedActors: string[];
  onSelectionChange: (actors: string[]) => void;
}

export function ActorFilter({
  orgSlug,
  workspaceName,
  selectedActors,
  onSelectionChange,
}: ActorFilterProps) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: actors } = useSuspenseQuery({
    ...trpc.workspace.getActors.queryOptions({
      clerkOrgSlug: orgSlug,
      workspaceName: workspaceName,
      search: search || undefined,
      limit: 20,
    }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000, // 1 minute
  });

  const toggleActor = useCallback((displayName: string) => {
    if (selectedActors.includes(displayName)) {
      onSelectionChange(selectedActors.filter((a) => a !== displayName));
    } else {
      onSelectionChange([...selectedActors, displayName]);
    }
  }, [selectedActors, onSelectionChange]);

  const removeActor = useCallback((displayName: string) => {
    onSelectionChange(selectedActors.filter((a) => a !== displayName));
  }, [selectedActors, onSelectionChange]);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">Actors</span>
      <div className="flex flex-wrap gap-1">
        {/* Selected actors as badges */}
        {selectedActors.map((actor) => (
          <Badge key={actor} variant="default" className="gap-1">
            {actor}
            <button
              onClick={() => removeActor(actor)}
              className="hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {/* Add actor button/combobox */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-6 px-2 text-xs gap-1"
            >
              Add actor
              <ChevronsUpDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search actors..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>No actors found.</CommandEmpty>
                <CommandGroup>
                  {actors?.map((actor) => (
                    <CommandItem
                      key={actor.id}
                      value={actor.displayName}
                      onSelect={() => {
                        toggleActor(actor.displayName);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedActors.includes(actor.displayName)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <div className="flex-1 truncate">
                        <span>{actor.displayName}</span>
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({actor.observationCount})
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
```

#### 3. Add Actor Filter to URL State

**File**: `apps/console/src/components/use-workspace-search-params.ts`

```typescript
// Add to useQueryStates params:
actors: parseAsArrayOf(parseAsString).withDefault([]),

// Add to return object:
actorNames: params.actors,
setActorNames: (actors: string[]) => setParams({ actors }),
```

#### 4. Integrate Actor Filter into WorkspaceSearch

**File**: `apps/console/src/components/workspace-search.tsx`

1. Import the component:
```typescript
import { ActorFilter } from "./actor-filter";
```

2. Add to destructured params:
```typescript
const { ..., actorNames, setActorNames, ... } = useWorkspaceSearchParams(initialQuery);
```

3. Add to filter section (after observation types, before Clear filters):
```typescript
{/* Actor Filter */}
<ActorFilter
  orgSlug={orgSlug}
  workspaceName={workspaceName}
  selectedActors={actorNames}
  onSelectionChange={setActorNames}
/>
```

4. Update handleSearch to include actor filter:
```typescript
filters: {
  sourceTypes: sourceTypes.length > 0 ? sourceTypes : undefined,
  observationTypes: observationTypes.length > 0 ? observationTypes : undefined,
  actorNames: actorNames.length > 0 ? actorNames : undefined,
},
```

5. Update clearFilters check:
```typescript
{(sourceTypes.length > 0 || observationTypes.length > 0 || actorNames.length > 0) && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => {
      setSourceTypes([]);
      setObservationTypes([]);
      setActorNames([]);
    }}
    className="self-end"
  >
    Clear filters
  </Button>
)}
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [ ] API builds: `pnpm --filter @api/console build`
- [ ] Linting passes: `pnpm --filter @lightfast/console lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] "Actors" filter section appears below Event Types
- [ ] Clicking "Add actor" opens autocomplete popover
- [ ] Typing filters actor list
- [ ] Clicking actor adds as badge
- [ ] Clicking X on badge removes actor
- [ ] Selected actors appear in URL `?actors=...`
- [ ] Search results filtered by selected actors
- [ ] "Clear filters" removes all filters including actors

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Testing Strategy

### Unit Tests

Not required for this UI-focused implementation. Rely on manual testing.

### Integration Tests

Not required. The v1 API routes already have their own testing.

### Manual Testing Steps

1. **URL Persistence**:
   - Type query, verify `?q=...` in URL
   - Change mode, verify `?mode=...`
   - Click filters, verify `?sources=...&types=...`
   - Expand card, verify `?expanded=...`
   - Refresh page, verify state restored

2. **Content Loading**:
   - Expand a search result
   - Verify loading skeleton appears
   - Verify content loads and displays
   - Verify entities and metadata display

3. **Similar Items**:
   - Click "Find Similar" in expanded card
   - Verify loading state
   - Verify similar items display with scores
   - Verify cluster information shows

4. **Context Display**:
   - Perform search that returns clusters/actors
   - Verify context section appears
   - Verify badges are clickable

5. **Actor Filter**:
   - Click "Add actor" button
   - Search for actor name
   - Select actor, verify badge appears
   - Verify search results filtered
   - Clear filters, verify removed

---

## Performance Considerations

1. **Content Caching**: Content is cached per-card in component state, not refetched on re-expand
2. **Similar Caching**: Similar items cached per-card, "Find Similar" reuses cached data
3. **Actor Query Debounce**: nuqs handles debounce for URL updates
4. **Lazy Loading**: Content and similar items only fetched when needed

---

## Migration Notes

No database migrations required. Only frontend changes to existing component.

---

## References

- Original research: `thoughts/shared/research/2025-12-14-workspace-search-v1-upgrade.md`
- V1 API types: `packages/console-types/src/api/v1/`
- Current implementation: `apps/console/src/components/workspace-search.tsx`
- UI patterns: `apps/console/src/components/activity-timeline.tsx` (Collapsible usage)
- URL state patterns: `apps/console/src/components/use-job-filters.ts` (nuqs usage)
