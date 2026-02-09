# Search Page Playground Rework — Implementation Plan

## Overview

Rework the search page (`/[slug]/[workspaceName]/search`) from a single-column layout into a split-panel "playground" UI inspired by Exa's search playground. Left panel contains all search controls (exposing every v1/search API parameter), right panel has "List" and "JSON" tabs for viewing results.

## Current State Analysis

- **workspace-search.tsx** (851 lines) contains both `WorkspaceSearch` (~475 lines) and `SearchResultCard` (~335 lines) in a single file with single-column layout
- **Hardcoded values**: `limit: 20`, `offset: 0`, `includeContext: true`, `includeHighlights: true`
- **Missing controls**: `dateRange` filter, `limit` input, `offset` input, `includeContext` toggle, `includeHighlights` toggle
- **URL state hook** (`use-workspace-search-params.ts`) manages 6 params via nuqs: q, mode, sources, types, actors, expanded
- **UI primitives available** in `@repo/ui`: ResizablePanel, Tabs, Switch, Checkbox, Select, ScrollArea, Separator, Label, Input, Textarea, Slider

### Key Discoveries:
- `ResizablePanelGroup` exists in `@repo/ui` (wraps `react-resizable-panels`) but is **not yet used** anywhere in the console app — this will be the first usage
- `Tabs` component exists but `TabsContent` has **never been used** — current usages only use `TabsList`/`TabsTrigger` for filtering. This will be the first real content-switching tabs usage
- Actor filter combobox (`actor-filter.tsx:71-144`) is a standalone component that can be reused directly
- JSON display pattern established in codebase: `<pre>` with `text-xs bg-muted/50 border rounded-lg p-3 overflow-x-auto` (see `workspace-search.tsx:695`, `answer-tool-call-renderer.tsx:252`)
- Settings pages use `flex gap-12` two-column pattern, but playground needs resizable panels for the interactive feel

## Desired End State

A split-panel playground layout:
- **Left panel** (~35% width, min 320px): All v1/search controls in a scrollable form — query, mode, limit, offset, includeContext, includeHighlights, source filters, event type filters, actor filter, dateRange preset
- **Right panel** (~65% width, min 400px): Tab bar with "List" (current SearchResultCard rendering) and "JSON" (raw V1SearchResponse formatted as JSON with copy button)
- **All control state persisted to URL** via nuqs for shareable/bookmarkable states
- **Cmd+Enter** keyboard shortcut to run search from anywhere in the left panel

### Verification:
1. All 7 v1/search request parameters are controllable from the UI
2. URL params capture full playground state (shareable links work)
3. List tab preserves all current SearchResultCard functionality (expand, content, find-similar)
4. JSON tab shows complete V1SearchResponse with copy button
5. Resizable panels work correctly with drag handle
6. TypeScript compiles, lint passes, no console errors

## What We're NOT Doing

- **No API changes**: v1/search route handler and searchLogic stay untouched
- **No new dependencies**: Using existing `react-resizable-panels` (already in @repo/ui) and radix Tabs
- **No syntax highlighting**: JSON tab uses `<pre>` with `JSON.stringify` (existing pattern)
- **No mobile responsive layout**: Playground is a power-user desktop tool
- **No "Find Similar" changes**: SearchResultCard internal behavior is preserved as-is
- **No test files**: No existing test patterns for UI components in this codebase

## Implementation Approach

Decompose the monolithic 851-line `workspace-search.tsx` into focused components, then assemble them into the playground layout. Each phase is independently verifiable.

---

## Phase 1: Extract SearchResultCard to Own File

### Overview
Move `SearchResultCard` (~335 lines) out of `workspace-search.tsx` into its own file. This reduces the main file by 40% and makes it importable by both List tab and any future consumers.

### Changes Required:

#### 1. Create `apps/console/src/components/search-result-card.tsx`
**File**: New file
**Changes**: Move `SearchResultCard` component (lines 478-813 of current workspace-search.tsx) into its own file with its own imports.

The component keeps its exact current implementation. Imports it needs from the current file:
- React hooks: `useState`, `useCallback`, `useEffect`
- UI: `Card`, `CardContent`, `Badge`, `Button`, `Skeleton`, `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger`
- Icons: `FileText`, `ExternalLink`, `Loader2`, `Sparkles`, `ChevronDown`, `ChevronRight`, `Copy`, `Check`
- Types: `V1SearchResult`, `V1ContentsResponse`, `V1FindSimilarResponse`
- Next.js: `Link`

#### 2. Update `apps/console/src/components/workspace-search.tsx`
**File**: `apps/console/src/components/workspace-search.tsx`
**Changes**:
- Remove `SearchResultCard` component definition (lines 478-813)
- Add import: `import { SearchResultCard } from "./search-result-card"`
- Remove imports only used by SearchResultCard: `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger`, `FileText` (if unused in main component — verify), `Copy`, `Check`
- Keep `WorkspaceSearchSkeleton` export in this file

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @repo/console typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Dev server loads search page without errors: `pnpm dev:console`

#### Manual Verification:
- [ ] Search page renders identically to before
- [ ] Expanding a result card works (content loads, entities show, find-similar works)
- [ ] No console errors

**Implementation Note**: After completing this phase, pause for manual verification before proceeding.

---

## Phase 2: Extend URL State Hook with New Parameters

### Overview
Add new URL params to `useWorkspaceSearchParams` for all controllable API parameters: limit, offset, includeContext, includeHighlights, dateRange preset, and active tab (List/JSON).

### Changes Required:

#### 1. Update `apps/console/src/components/use-workspace-search-params.ts`
**File**: `apps/console/src/components/use-workspace-search-params.ts`
**Changes**: Add new parsers and return values.

New URL parameters to add:

| URL Param | Parser | Default | Maps To |
|-----------|--------|---------|---------|
| `limit` | `parseAsInteger.withDefault(20)` | 20 | limit (1-100) |
| `offset` | `parseAsInteger.withDefault(0)` | 0 | offset (>=0) |
| `ctx` | `parseAsBoolean.withDefault(true)` | true | includeContext |
| `hl` | `parseAsBoolean.withDefault(true)` | true | includeHighlights |
| `age` | `parseAsStringLiteral(agePresets).withDefault("none")` | "none" | dateRange preset |
| `view` | `parseAsStringLiteral(viewTabs).withDefault("list")` | "list" | active tab |

New imports needed from nuqs: `parseAsInteger`, `parseAsBoolean`

New constants:
```typescript
const agePresets = ["1h", "6h", "24h", "72h", "7d", "30d", "none"] as const;
const viewTabs = ["list", "json"] as const;
```

New return values:
```typescript
limit: params.limit,
setLimit: (v: number) => setParams({ limit: v }),
offset: params.offset,
setOffset: (v: number) => setParams({ offset: v }),
includeContext: params.ctx,
setIncludeContext: (v: boolean) => setParams({ ctx: v }),
includeHighlights: params.hl,
setIncludeHighlights: (v: boolean) => setParams({ hl: v }),
agePreset: params.age as typeof agePresets[number],
setAgePreset: (v: string) => setParams({ age: v }),
activeTab: params.view as typeof viewTabs[number],
setActiveTab: (v: string) => setParams({ view: v }),
```

Also update `clearFilters` to include resetting new filter params:
```typescript
clearFilters: () => setParams({
  sources: [],
  types: [],
  actors: [],
  age: "none",
}),
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @repo/console typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Search page still works (new params have safe defaults matching current hardcoded values)
- [ ] URL updates when params are changed (test via React DevTools or future UI)

**Implementation Note**: After completing this phase, pause for manual verification before proceeding.

---

## Phase 3: Create Playground Layout with Controls Panel and Results Panel

### Overview
Replace the single-column `WorkspaceSearch` layout with a `ResizablePanelGroup` split-panel. Left panel gets all controls, right panel gets Tabs (List/JSON). This is the main rework phase.

### Changes Required:

#### 1. Rewrite `apps/console/src/components/workspace-search.tsx`
**File**: `apps/console/src/components/workspace-search.tsx`
**Changes**: Complete rewrite of the component's render method and search handler. Keep `WorkspaceSearchSkeleton`.

**New imports to add:**
```typescript
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@repo/ui/components/ui/resizable"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/components/ui/tabs"
import { Switch } from "@repo/ui/components/ui/switch"
import { Label } from "@repo/ui/components/ui/label"
import { Separator } from "@repo/ui/components/ui/separator"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select"
```

**Imports to remove (no longer needed):**
```typescript
// Card and CardContent (controls no longer in a card wrapper)
// Skeleton (keep if used in skeleton component)
```

**Updated `handleSearch` callback:**
Replace hardcoded values with URL-persisted state:
```typescript
const handleSearch = useCallback(async () => {
  // ... validation same as before ...
  const body: Record<string, unknown> = {
    query: query.trim(),
    limit,
    offset,
    mode,
    filters: {
      ...(sourceTypes.length > 0 && { sourceTypes }),
      ...(observationTypes.length > 0 && { observationTypes }),
      ...(actorNames.length > 0 && { actorNames }),
      ...(dateRangeFromPreset(agePreset)),
    },
    includeContext,
    includeHighlights,
  };
  // ... fetch same as before ...
}, [query, store, mode, limit, offset, includeContext, includeHighlights, sourceTypes, observationTypes, actorNames, agePreset]);
```

**New helper function** (above the component):
```typescript
function dateRangeFromPreset(preset: string): { dateRange?: { start: string } } {
  if (preset === "none") return {};
  const hours: Record<string, number> = {
    "1h": 1, "6h": 6, "24h": 24, "72h": 72, "7d": 168, "30d": 720,
  };
  const h = hours[preset];
  if (!h) return {};
  const start = new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
  return { dateRange: { start } };
}
```

**New keyboard handler** — Cmd+Enter from anywhere in left panel:
```typescript
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isSearching) {
    e.preventDefault();
    handleSearch();
  }
}, [handleSearch, isSearching]);
```

**New render structure:**

```tsx
<div className="flex flex-col h-[calc(100vh-4rem)]" onKeyDown={handleKeyDown}>
  {/* Header */}
  <div className="flex items-center justify-between pb-4">
    <div className="flex items-center gap-2">
      <h1 className="text-xl font-semibold tracking-tight">Search</h1>
      <Badge variant="secondary" className="gap-1">
        <Sparkles className="h-3 w-3" /> Playground
      </Badge>
    </div>
    {store && (
      <span className="text-xs text-muted-foreground">
        {store.embeddingModel} &middot; {store.documentCount?.toLocaleString()} docs
      </span>
    )}
  </div>

  {/* Split Panel */}
  <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg border">
    {/* LEFT PANEL — Controls */}
    <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
      <ScrollArea className="h-full">
        <div className="p-4 space-y-5">

          {/* Query */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Query</Label>
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question or describe what you're looking for..."
              className="min-h-[80px] resize-none text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={handleSearch} disabled={isSearching || !query.trim() || !store} size="sm" className="flex-1">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                Run
              </Button>
              <Button variant="outline" size="sm" onClick={clearFilters}>Clear</Button>
            </div>
            <p className="text-[10px] text-muted-foreground">⌘+Enter to run</p>
          </div>

          <Separator />

          {/* Search Mode */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Search Type</Label>
            <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as RerankMode)} className="justify-start">
              {MODE_OPTIONS.map((opt) => (
                <ToggleGroupItem key={opt.value} value={opt.value} size="sm">
                  <opt.icon className="h-3.5 w-3.5 mr-1" />
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <Separator />

          {/* Number of Results */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Number of Results</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(e) => setLimit(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
              className="h-8 text-sm"
            />
          </div>

          {/* Offset */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Offset</Label>
            <Input
              type="number"
              min={0}
              value={offset}
              onChange={(e) => setOffset(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-8 text-sm"
            />
          </div>

          <Separator />

          {/* Content Toggles */}
          <div className="space-y-3">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contents</Label>
            <div className="flex items-center justify-between">
              <Label htmlFor="include-context" className="text-sm">Include Context</Label>
              <Switch id="include-context" checked={includeContext} onCheckedChange={setIncludeContext} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="include-highlights" className="text-sm">Highlights</Label>
              <Switch id="include-highlights" checked={includeHighlights} onCheckedChange={setIncludeHighlights} />
            </div>
          </div>

          <Separator />

          {/* Filters */}
          <div className="space-y-4">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Filters</Label>

            {/* Source Types */}
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Sources</span>
              <div className="flex flex-wrap gap-1">
                {SOURCE_TYPE_OPTIONS.map((opt) => (
                  <Badge
                    key={opt.value}
                    variant={sourceTypes.includes(opt.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      setSourceTypes(
                        sourceTypes.includes(opt.value)
                          ? sourceTypes.filter((s) => s !== opt.value)
                          : [...sourceTypes, opt.value]
                      );
                    }}
                  >
                    {opt.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Observation Types */}
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Event Types</span>
              <div className="flex flex-wrap gap-1">
                {OBSERVATION_TYPE_OPTIONS.map((opt) => (
                  <Badge
                    key={opt.value}
                    variant={observationTypes.includes(opt.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      setObservationTypes(
                        observationTypes.includes(opt.value)
                          ? observationTypes.filter((t) => t !== opt.value)
                          : [...observationTypes, opt.value]
                      );
                    }}
                  >
                    {opt.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Actor Filter */}
            <ActorFilter
              orgSlug={orgSlug}
              workspaceName={workspaceName}
              selectedActors={actorNames}
              onSelectionChange={setActorNames}
            />

            {/* Max Content Age */}
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Max Content Age</span>
              <Select value={agePreset} onValueChange={setAgePreset}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="6h">6 hours</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="72h">3 days</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="none">No limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <>
              <Separator />
              <p className="text-sm text-destructive">{error}</p>
            </>
          )}

        </div>
      </ScrollArea>
    </ResizablePanel>

    {/* Resize Handle */}
    <ResizableHandle withHandle />

    {/* RIGHT PANEL — Results */}
    <ResizablePanel defaultSize={65} minSize={40}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="border-b px-4">
          <TabsList className="h-10">
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>
        </div>

        {/* List Tab */}
        <TabsContent value="list" className="flex-1 overflow-auto m-0 p-4">
          {searchResults ? (
            <div className="space-y-4">
              {/* Results header */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {searchResults.data.length} results
                  <span className="ml-1">({searchResults.latency.total}ms total, {searchResults.latency.retrieval}ms retrieval{searchResults.latency.rerank ? `, ${searchResults.latency.rerank}ms ${searchResults.meta.mode}` : ""})</span>
                </p>
                <Badge variant="outline">{searchResults.meta.mode}</Badge>
              </div>

              {/* Context clusters & actors */}
              {searchResults.context && (
                <div className="flex flex-wrap gap-4 text-xs">
                  {searchResults.context.clusters?.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Topics: </span>
                      {searchResults.context.clusters.map((c, i) => (
                        <Badge key={i} variant="secondary" className="mr-1 text-xs">
                          {c.topic ?? "Uncategorized"}
                          {c.keywords?.length > 0 && ` (${c.keywords.slice(0, 2).join(", ")})`}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {searchResults.context.relevantActors?.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Contributors: </span>
                      {searchResults.context.relevantActors.map((a, i) => (
                        <Badge key={i} variant="secondary" className="mr-1 text-xs">
                          {a.displayName}
                          {a.expertiseDomains?.[0] && ` (${a.expertiseDomains[0]})`}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Result cards */}
              {searchResults.data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium">No results found</p>
                  <p className="text-xs text-muted-foreground mt-1">Try a different query or adjust your filters</p>
                </div>
              ) : (
                searchResults.data.map((result, index) => (
                  <SearchResultCard
                    key={result.id}
                    result={result}
                    rank={index + 1}
                    isExpanded={expandedId === result.id}
                    onToggleExpand={() => setExpandedId(expandedId === result.id ? "" : result.id)}
                    storeId={store!.id}
                  />
                ))
              )}
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <Search className="h-8 w-8 text-primary/60" />
              </div>
              <p className="text-sm font-medium">Search your knowledge base</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Enter a query and press Run (or ⌘+Enter) to search across your connected sources.
              </p>
              {store && (
                <p className="text-xs text-muted-foreground mt-2">
                  {store.documentCount?.toLocaleString()} documents indexed
                </p>
              )}
            </div>
          )}
        </TabsContent>

        {/* JSON Tab */}
        <TabsContent value="json" className="flex-1 overflow-auto m-0 p-4">
          {searchResults ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">V1SearchResponse &middot; {searchResults.requestId}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(searchResults, null, 2))}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
              <pre className="text-xs bg-muted/50 border rounded-lg p-3 overflow-auto whitespace-pre-wrap break-words">
                {JSON.stringify(searchResults, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <p className="text-sm">Run a search to see the raw JSON response</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </ResizablePanel>
  </ResizablePanelGroup>
</div>
```

#### 2. Update `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/search/page.tsx`
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/search/page.tsx`
**Changes**: Remove the `py-2 px-6` wrapper div and `gap-6` — the playground needs to fill the available viewport height. Move padding into the component itself.

```tsx
// Change from:
<div className="flex flex-col gap-6 py-2 px-6">
  <WorkspaceSearch ... />
</div>

// Change to:
<div className="px-6 py-2 h-full">
  <WorkspaceSearch ... />
</div>
```

#### 3. Update `WorkspaceSearchSkeleton`
**File**: `apps/console/src/components/workspace-search.tsx`
**Changes**: Update skeleton to match new two-panel layout.

```tsx
export function WorkspaceSearchSkeleton() {
  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-4rem)]">
      {/* Header skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>
      {/* Panel skeleton */}
      <div className="flex-1 rounded-lg border flex">
        <div className="w-[35%] border-r p-4 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @repo/console typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Dev server starts without errors

#### Manual Verification:
- [ ] Split-panel layout renders with draggable resize handle
- [ ] Left panel scrolls independently when controls exceed viewport
- [ ] All controls work: query, mode, limit, offset, includeContext, includeHighlights, source filters, event types, actor filter, age preset
- [ ] "Run" button triggers search, results appear in List tab
- [ ] Switching to JSON tab shows raw response
- [ ] Copy button in JSON tab works
- [ ] Cmd+Enter triggers search from any input in left panel
- [ ] URL updates with all parameter changes
- [ ] Pasting a URL with params restores playground state
- [ ] Empty state shows correctly before first search
- [ ] Error state displays correctly
- [ ] Expanding a result in List tab works (content, entities, find-similar)
- [ ] Clear button resets filters (not query, mode, limit, offset)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for thorough manual testing before finalizing.

---

## Performance Considerations

- **ResizablePanel** uses CSS flexbox under the hood — no layout thrashing on resize
- **ScrollArea** in left panel prevents the controls from pushing the viewport — critical for many filter options
- **JSON.stringify** on large responses could be slow — but search responses are bounded by `limit: 100` max results, so this is fine
- **URL state with 12 params** via nuqs uses shallow routing (`shallow: true`) — no server round-trips on param changes
- **Textarea for query** (replacing Input) allows multi-line queries without horizontal overflow

## Migration Notes

- No data migration needed — this is purely a UI rework
- Existing URL params (`q`, `mode`, `sources`, `types`, `actors`, `expanded`) are preserved with same names and defaults
- New params (`limit`, `offset`, `ctx`, `hl`, `age`, `view`) have defaults matching current hardcoded behavior, so old URLs work without changes

## References

- Research: `thoughts/shared/research/2026-02-06-search-page-playground-rework.md`
- Page split plan: `thoughts/shared/plans/2026-02-06-workspace-search-ask-lightfast-page-split.md`
- Current component: `apps/console/src/components/workspace-search.tsx` (851 lines)
- URL state hook: `apps/console/src/components/use-workspace-search-params.ts` (57 lines)
- Search schemas: `packages/console-types/src/api/v1/search.ts`
- ResizablePanel primitive: `packages/ui/src/components/ui/resizable.tsx`
- Tabs primitive: `packages/ui/src/components/ui/tabs.tsx`
