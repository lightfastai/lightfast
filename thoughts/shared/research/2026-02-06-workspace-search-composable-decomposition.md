---
date: "2026-02-06T16:38:15+08:00"
researcher: Claude
git_commit: b747d5966fbd59a52ac2c58570885b0c0e830537
branch: feat/definitive-links-strict-relationships
repository: lightfast
topic: "workspace-search.tsx Composable Component Decomposition"
tags: [research, codebase, workspace-search, component-decomposition, search-playground]
status: complete
last_updated: "2026-02-06"
last_updated_by: Claude
---

# Research: workspace-search.tsx Composable Component Decomposition

**Date**: 2026-02-06T16:38:15+08:00
**Researcher**: Claude
**Git Commit**: b747d5966fbd59a52ac2c58570885b0c0e830537
**Branch**: feat/definitive-links-strict-relationships
**Repository**: lightfast

## Research Question

Document the current structure of `apps/console/src/components/workspace-search.tsx` and all its dependencies to support breaking it into more composable components.

## Summary

`workspace-search.tsx` is a 701-line file containing the `WorkspaceSearch` component (~575 lines) and `WorkspaceSearchSkeleton` (~25 lines). The component has a split-panel playground layout with a left panel (controls) and right panel (results with List/JSON tabs). It already imports three extracted subcomponents (`SearchPromptInput`, `SearchResultCard`, `ActorFilter`), but the main component body still contains 7 distinct UI sections that are tightly coupled through shared state from `useWorkspaceSearchParams`. The file defines 3 constants arrays, 1 helper function, and the 2 exported components.

---

## Detailed Findings

### 1. File Structure Overview

**File**: `apps/console/src/components/workspace-search.tsx` (701 lines)

```
Lines 1-42:    Imports (42 lines — 17 import statements)
Lines 44-48:   WorkspaceSearchProps interface
Lines 50-53:   SOURCE_TYPE_OPTIONS constant
Lines 55-64:   OBSERVATION_TYPE_OPTIONS constant
Lines 66-90:   MODE_OPTIONS constant
Lines 92-111:  dateRangeFromPreset() helper function
Lines 119-674: WorkspaceSearch component
Lines 677-700: WorkspaceSearchSkeleton component
```

### 2. WorkspaceSearch Internal Anatomy (Lines 119-674)

The component breaks into these logical sections:

#### 2a. Hook Calls & State Setup (Lines 124-160)
- `useTRPC()` — tRPC client
- `useWorkspaceSearchParams(initialQuery)` — 20+ return values from URL state
- `useState<V1SearchResponse | null>` — search results
- `useState(false)` — isSearching
- `useState<string | null>` — error
- `useSuspenseQuery(workspace.store.get)` — workspace store

#### 2b. Callback Definitions (Lines 173-278)
- `performSearch(searchQuery)` — POST to `/v1/search` with all params (Lines 174-251)
- `handleSearch()` — calls performSearch(query) (Lines 253-255)
- `handlePromptSubmit(message)` — extracts text from PromptInputMessage, calls performSearch (Lines 257-267)
- `handleKeyDown(e)` — Cmd+Enter shortcut (Lines 270-278)

#### 2c. Left Panel — Controls (Lines 288-511)
Contains 7 UI sections, each separated by `<Separator />`:
1. **SearchPromptInput** (Lines 292-301) — query input via `SearchPromptInput` component
2. **Search Type** (Lines 306-327) — `ToggleGroup` with MODE_OPTIONS
3. **Number of Results** (Lines 332-348) — `Input type="number"`, min 1 max 100
4. **Offset** (Lines 351-364) — `Input type="number"`, min 0
5. **Content Toggles** (Lines 369-393) — `Switch` for includeContext and includeHighlights
6. **Filters** (Lines 398-501):
   - Source Types — Badge toggles for GitHub/Vercel
   - Observation Types — Badge toggles for 8 event types
   - Actor Filter — `ActorFilter` component (combobox)
   - Max Content Age — `Select` dropdown with age presets
7. **Error Display** (Lines 504-509) — conditional error message

#### 2d. Right Panel — Results (Lines 515-670)
Contains a `Tabs` component with two tab content areas:
1. **List Tab** (Lines 533-646):
   - Results header with count/latency/mode badge
   - Context clusters and relevant actors (badges)
   - Result cards via `SearchResultCard` or empty state
   - Pre-search empty state
2. **JSON Tab** (Lines 649-668):
   - `CodeBlock`/`CodeBlockContent` with `JSON.stringify(searchResults)`
   - Pre-search empty state

### 3. State Dependencies Map

All state flows from `useWorkspaceSearchParams` hook:

| State Property | Used In | UI Section |
|---------------|---------|------------|
| query | performSearch, SearchPromptInput, handleSearch | Query Input |
| setQuery | handlePromptSubmit | Query Input |
| mode | performSearch, ToggleGroup | Search Type |
| setMode | ToggleGroup onValueChange | Search Type |
| limit | performSearch, Input | Number of Results |
| setLimit | Input onChange | Number of Results |
| offset | performSearch, Input, rank calc | Offset, List Tab |
| setOffset | Input onChange | Offset |
| includeContext | performSearch, Switch | Content Toggles |
| setIncludeContext | Switch onCheckedChange | Content Toggles |
| includeHighlights | performSearch, Switch | Content Toggles |
| setIncludeHighlights | Switch onCheckedChange | Content Toggles |
| sourceTypes | performSearch, Badge toggle | Filters - Sources |
| setSourceTypes | Badge onClick | Filters - Sources |
| observationTypes | performSearch, Badge toggle | Filters - Events |
| setObservationTypes | Badge onClick | Filters - Events |
| actorNames | performSearch, ActorFilter | Filters - Actors |
| setActorNames | ActorFilter onSelectionChange | Filters - Actors |
| agePreset | performSearch, Select | Filters - Age |
| setAgePreset | Select onValueChange | Filters - Age |
| expandedId | SearchResultCard | List Tab |
| setExpandedId | SearchResultCard onToggle | List Tab |
| activeTab | Tabs value | Results Tabs |
| setActiveTab | Tabs onValueChange | Results Tabs |
| clearFilters | SearchPromptInput onClear | Query Input |

Local state used across sections:
- `searchResults` — used in List Tab, JSON Tab, results header
- `isSearching` — used in SearchPromptInput status, handleKeyDown
- `error` — used in Error Display section
- `store` — used in performSearch (X-Workspace-ID), SearchPromptInput disabled, SearchResultCard storeId, empty state doc count

### 4. Already-Extracted Subcomponents

Three components have already been extracted to their own files:

| Component | File | Lines | Props |
|-----------|------|-------|-------|
| `SearchPromptInput` | `search-prompt-input.tsx` | 103 | placeholder, onSubmit, status, isSubmitDisabled, submitDisabledReason, onClear, className |
| `SearchResultCard` | `search-result-card.tsx` | 403 | result (V1SearchResult), rank, isExpanded, onToggleExpand, storeId |
| `ActorFilter` | `actor-filter.tsx` | 146 | orgSlug, workspaceName, selectedActors, onSelectionChange |

### 5. Constants Defined in the File

```typescript
// Line 50-53
SOURCE_TYPE_OPTIONS = [
  { value: "github", label: "GitHub" },
  { value: "vercel", label: "Vercel" },
];

// Lines 55-64
OBSERVATION_TYPE_OPTIONS = [
  { value: "push", label: "Push" },
  { value: "pull_request_opened", label: "PR Opened" },
  { value: "pull_request_merged", label: "PR Merged" },
  { value: "pull_request_closed", label: "PR Closed" },
  { value: "issue_opened", label: "Issue Opened" },
  { value: "issue_closed", label: "Issue Closed" },
  { value: "deployment_succeeded", label: "Deploy Success" },
  { value: "deployment_error", label: "Deploy Error" },
];

// Lines 66-90
MODE_OPTIONS = [
  { value: "fast", label: "Fast", icon: Zap, description: "Vector scores only (~50ms)" },
  { value: "balanced", label: "Balanced", icon: Scale, description: "Cohere rerank (~130ms)" },
  { value: "thorough", label: "Thorough", icon: Brain, description: "LLM scoring (~600ms)" },
];
```

### 6. Helper Function

```typescript
// Lines 92-111
function dateRangeFromPreset(preset: string): { dateRange?: { start: string } }
// Converts age preset ("1h", "6h", "24h", "72h", "7d", "30d", "none") to dateRange filter
```

### 7. Host Page

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/search/page.tsx` (37 lines)

Server component that:
- Prefetches `workspace.store.get` via tRPC
- Renders `<WorkspaceSearch>` inside `<Suspense>` + `<HydrateClient>`
- Passes `orgSlug`, `workspaceName`, `initialQuery` (from `?q=` search param)

### 8. Import Analysis

The file has 17 import statements pulling from:
- **React**: useState, useCallback (2 hooks)
- **TanStack Query**: useSuspenseQuery
- **tRPC**: useTRPC
- **@repo/ui**: Input, Button, Badge, Skeleton, ToggleGroup/ToggleGroupItem, Switch, Label, Separator, ScrollArea, Select/SelectContent/SelectItem/SelectTrigger/SelectValue, CodeBlock/CodeBlockContent, Tabs/TabsList/TabsTrigger/TabsContent, cn
- **lucide-react**: Search, FileText, Zap, Scale, Brain
- **@repo/console-types**: V1SearchResponse, RerankMode
- **Local**: useWorkspaceSearchParams, ActorFilter, SearchResultCard, SearchPromptInput, PromptInputMessage

### 9. Render Structure (JSX Tree)

```
<div> (root, flex-col, onKeyDown)
  └── <div> (split layout, flex)
        ├── <div> (left panel, flex-1)
        │     └── <ScrollArea>
        │           └── <div> (p-4, space-y-5)
        │                 ├── <SearchPromptInput>
        │                 ├── <Separator />
        │                 ├── [Search Type ToggleGroup]
        │                 ├── <Separator />
        │                 ├── [Number of Results Input]
        │                 ├── [Offset Input]
        │                 ├── <Separator />
        │                 ├── [Content Toggles (2x Switch)]
        │                 ├── <Separator />
        │                 ├── [Filters section]
        │                 │     ├── Source Type Badges
        │                 │     ├── Event Type Badges
        │                 │     ├── <ActorFilter>
        │                 │     └── Age Preset Select
        │                 └── [Error display]
        │
        └── <div> (right panel, flex-1)
              └── <Tabs>
                    ├── <TabsList>
                    │     ├── <TabsTrigger value="list">
                    │     └── <TabsTrigger value="json">
                    ├── <TabsContent value="list">
                    │     ├── [Results header]
                    │     ├── [Context clusters/actors]
                    │     ├── [SearchResultCard[] or empty states]
                    │     └── [Pre-search empty state]
                    └── <TabsContent value="json">
                          ├── [CodeBlock with JSON]
                          └── [Pre-search empty state]
```

---

## Code References

- `apps/console/src/components/workspace-search.tsx` — Main component (701 lines)
- `apps/console/src/components/use-workspace-search-params.ts` — URL state hook (83 lines)
- `apps/console/src/components/search-prompt-input.tsx` — Prompt input component (103 lines)
- `apps/console/src/components/search-result-card.tsx` — Result card component (403 lines)
- `apps/console/src/components/actor-filter.tsx` — Actor filter combobox (146 lines)
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/search/page.tsx` — Host page (37 lines)
- `packages/console-types/src/api/v1/search.ts` — V1SearchResponse, V1SearchResult, RerankMode types
- `packages/console-types/src/api/v1/contents.ts` — V1ContentsResponse type
- `packages/console-types/src/api/v1/findsimilar.ts` — V1FindSimilarResponse type

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-02-06-search-page-playground-rework.md` — Earlier plan that decomposed the original 851-line file into the current structure (extracted SearchResultCard, extended URL state, created split-panel layout). This plan has been largely implemented.
- `thoughts/shared/research/2026-02-06-search-page-playground-rework.md` — Research documenting the full v1/search API, type schemas, and Exa playground inspiration.
- `thoughts/shared/plans/2026-02-06-workspace-search-ask-lightfast-page-split.md` — Plan that split the original combined page into separate `/search` and root routes.

## Identifiable Composable Sections

Based on the current structure, these are the distinct UI sections within `WorkspaceSearch` that have clear boundaries:

1. **Search Controls Panel** (lines 288-511) — The entire left panel content
2. **Search Type Selector** (lines 306-327) — ToggleGroup for mode selection
3. **Pagination Controls** (lines 332-364) — Limit + Offset inputs
4. **Content Toggles** (lines 369-393) — includeContext + includeHighlights switches
5. **Filter Section** (lines 398-501) — Sources, Events, Actors, Age
6. **Source Type Filter** (lines 404-428) — Badge toggles for source types
7. **Event Type Filter** (lines 431-457) — Badge toggles for observation types
8. **Age Preset Filter** (lines 468-500) — Select dropdown for max content age
9. **Results Panel** (lines 515-670) — The entire right panel with tabs
10. **Results List View** (lines 534-645) — List tab content
11. **Results Header** (lines 537-550) — Count, latency, mode badge
12. **Context Display** (lines 553-596) — Clusters and relevant actors
13. **Results JSON View** (lines 649-668) — JSON tab content
14. **Search Empty State** (lines 628-644) — Pre-search placeholder

## Shared State Coupling Points

The key coupling point is that the `performSearch` callback needs access to all filter/control state. Any decomposition must either:
- Pass all state values as props to child components
- Use React context to share state
- Keep the hook call and callbacks in the parent and pass handlers down

The `useWorkspaceSearchParams` hook returns 20+ values that are consumed across the left panel controls and the right panel results. The `performSearch` function depends on: `store`, `mode`, `limit`, `offset`, `includeContext`, `includeHighlights`, `sourceTypes`, `observationTypes`, `actorNames`, `agePreset` (10 dependencies).

## Open Questions

1. How granular should the decomposition be? (e.g., should each filter type be its own component, or group all filters together?)
2. Should a React context be introduced for the search state, or should props be threaded through?
3. Should the search execution logic (`performSearch`) be extracted into a custom hook?
4. Should constants (MODE_OPTIONS, SOURCE_TYPE_OPTIONS, etc.) move to a shared constants file?
