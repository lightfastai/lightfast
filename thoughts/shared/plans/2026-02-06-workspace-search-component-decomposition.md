# Workspace Search Component Decomposition

## Overview

Break `apps/console/src/components/workspace-search.tsx` (701 lines) into distinct, maintainable components. The parent component currently contains 7 UI sections inlined in the JSX that should be extracted into focused child components following the existing flat-file, direct-props pattern used throughout the console app.

## Current State Analysis

`WorkspaceSearch` is a split-panel playground layout:
- **Left panel**: Search input, mode selector, pagination controls, content toggles, filters (sources, events, actors, age)
- **Right panel**: Tabbed results with List and JSON views

Three components are already extracted: `SearchPromptInput`, `SearchResultCard`, `ActorFilter`. But the remaining ~400 lines of JSX are inlined in the parent.

### Key Discoveries:
- All state flows through `useWorkspaceSearchParams` hook (12 URL params via nuqs) — `use-workspace-search-params.ts:28-83`
- Local state is minimal: `searchResults`, `isSearching`, `error` — `workspace-search.tsx:156-160`
- The codebase uses flat file structure (no component directories), direct props (no Context API), controlled components — consistent across `workspace-dashboard.tsx`, `answer-interface.tsx`, etc.
- Constants (`SOURCE_TYPE_OPTIONS`, `OBSERVATION_TYPE_OPTIONS`, `MODE_OPTIONS`) and helper (`dateRangeFromPreset`) are defined at file top — `workspace-search.tsx:50-111`

## Desired End State

`WorkspaceSearch` becomes a ~120-line orchestrator that owns state and callbacks, delegating all UI to child components. Each extracted component is a focused, single-responsibility file under ~150 lines.

**Verification**: `pnpm build:console` passes. `pnpm lint && pnpm typecheck` pass. The search page renders identically — no visual or behavioral changes.

## What We're NOT Doing

- NOT introducing React Context or a state management layer
- NOT changing the `useWorkspaceSearchParams` hook
- NOT modifying API calls, types, or data flow
- NOT refactoring `SearchResultCard` or `SearchPromptInput` (already extracted)
- NOT changing any styling, layout, or behavior
- NOT creating component directories or barrel files (keeping flat structure)

## Implementation Approach

Extract 4 new components from the inlined JSX. Each receives the specific props it needs from the parent. Constants and the helper function move to a shared file. The parent becomes a thin shell: hooks → callbacks → layout → child components.

---

## Phase 1: Extract Constants and Helper

### Overview
Move constants and `dateRangeFromPreset` out of `workspace-search.tsx` into a dedicated constants file to reduce clutter and enable reuse.

### Changes Required:

#### 1. Create constants file
**File**: `apps/console/src/components/search-constants.ts` (new)

```typescript
import type { LucideIcon } from "lucide-react";
import { Zap, Scale, Brain } from "lucide-react";

export const SOURCE_TYPE_OPTIONS = [
  { value: "github", label: "GitHub" },
  { value: "vercel", label: "Vercel" },
] as const;

export const OBSERVATION_TYPE_OPTIONS = [
  { value: "push", label: "Push" },
  { value: "pull_request_opened", label: "PR Opened" },
  { value: "pull_request_merged", label: "PR Merged" },
  { value: "pull_request_closed", label: "PR Closed" },
  { value: "issue_opened", label: "Issue Opened" },
  { value: "issue_closed", label: "Issue Closed" },
  { value: "deployment_succeeded", label: "Deploy Success" },
  { value: "deployment_error", label: "Deploy Error" },
] as const;

export const MODE_OPTIONS: {
  value: string;
  label: string;
  icon: LucideIcon;
  description: string;
}[] = [
  { value: "fast", label: "Fast", icon: Zap, description: "Vector scores only (~50ms)" },
  { value: "balanced", label: "Balanced", icon: Scale, description: "Cohere rerank (~130ms)" },
  { value: "thorough", label: "Thorough", icon: Brain, description: "LLM scoring (~600ms)" },
];

export const AGE_PRESET_OPTIONS = [
  { value: "1h", label: "1 hour" },
  { value: "6h", label: "6 hours" },
  { value: "24h", label: "24 hours" },
  { value: "72h", label: "3 days" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "none", label: "No limit" },
] as const;

export function dateRangeFromPreset(
  preset: string
): { dateRange?: { start: string } } {
  if (preset === "none") return {};
  const hoursMap: Record<string, number> = {
    "1h": 1, "6h": 6, "24h": 24, "72h": 72, "7d": 168, "30d": 720,
  };
  const hours = hoursMap[preset];
  if (!hours) return {};
  const start = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return { dateRange: { start } };
}
```

#### 2. Update workspace-search.tsx imports
**File**: `apps/console/src/components/workspace-search.tsx`
**Changes**: Remove the 3 constant arrays, the `dateRangeFromPreset` function, and the lucide icons only used by MODE_OPTIONS (`Zap`, `Scale`, `Brain`). Replace with import from `./search-constants`.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build passes: `pnpm build:console`

#### Manual Verification:
- [ ] Search page renders identically

---

## Phase 2: Extract SearchModeSelector

### Overview
Extract the mode toggle group (lines 306-327) into its own component.

### Changes Required:

#### 1. Create SearchModeSelector component
**File**: `apps/console/src/components/search-mode-selector.tsx` (new, ~50 lines)

```typescript
"use client";

import { Label } from "@repo/ui/components/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/toggle-group";
import { MODE_OPTIONS } from "./search-constants";

interface SearchModeSelectorProps {
  mode: string;
  onModeChange: (mode: string) => void;
}

export function SearchModeSelector({
  mode,
  onModeChange,
}: SearchModeSelectorProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">
        Search Type
      </Label>
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => v && onModeChange(v)}
        className="flex flex-col gap-1"
      >
        {MODE_OPTIONS.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="flex items-center justify-start gap-2 w-full"
          >
            <option.icon className="h-3.5 w-3.5" />
            <span className="text-xs">{option.label}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {option.description}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
```

#### 2. Replace inline JSX in workspace-search.tsx
**File**: `apps/console/src/components/workspace-search.tsx`
**Changes**: Replace the mode toggle section (between separators) with `<SearchModeSelector mode={mode} onModeChange={setMode} />`.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Build passes: `pnpm build:console`

#### Manual Verification:
- [ ] Mode toggle still works (fast/balanced/thorough selection persists in URL)

---

## Phase 3: Extract SearchFilters

### Overview
Extract the filters section (sources, events, actors, age), pagination controls (limit, offset), and content toggles into a single `SearchFilters` component. This is the largest extraction — it groups all the left-panel controls below the mode selector.

### Changes Required:

#### 1. Create SearchFilters component
**File**: `apps/console/src/components/search-filters.tsx` (new, ~200 lines)

Props:
```typescript
interface SearchFiltersProps {
  // Pagination
  limit: number;
  onLimitChange: (limit: number) => void;
  offset: number;
  onOffsetChange: (offset: number) => void;
  // Content toggles
  includeContext: boolean;
  onIncludeContextChange: (value: boolean) => void;
  includeHighlights: boolean;
  onIncludeHighlightsChange: (value: boolean) => void;
  // Filters
  sourceTypes: string[];
  onSourceTypesChange: (types: string[]) => void;
  observationTypes: string[];
  onObservationTypesChange: (types: string[]) => void;
  actorNames: string[];
  onActorNamesChange: (names: string[]) => void;
  agePreset: string;
  onAgePresetChange: (preset: string) => void;
  // For ActorFilter
  orgSlug: string;
  workspaceName: string;
}
```

Contains the JSX from `workspace-search.tsx` lines 332-501:
- Number of Results input
- Offset input
- Content toggles (includeContext, includeHighlights switches)
- Source type badge toggles
- Observation type badge toggles
- ActorFilter delegation
- Age preset select

Imports `SOURCE_TYPE_OPTIONS`, `OBSERVATION_TYPE_OPTIONS`, `AGE_PRESET_OPTIONS` from `./search-constants`.

#### 2. Replace inline JSX in workspace-search.tsx
**File**: `apps/console/src/components/workspace-search.tsx`
**Changes**: Replace lines 332-501 with `<SearchFilters ... />` passing all relevant props.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Build passes: `pnpm build:console`

#### Manual Verification:
- [ ] All filters work: source types, observation types, actors, age preset
- [ ] Pagination controls (limit, offset) work
- [ ] Content toggles work
- [ ] All values persist in URL

---

## Phase 4: Extract SearchResultsPanel

### Overview
Extract the entire right panel (lines 515-670) — tabs, results header, context display, result cards, JSON view, and empty states — into `SearchResultsPanel`.

### Changes Required:

#### 1. Create SearchResultsPanel component
**File**: `apps/console/src/components/search-results-panel.tsx` (new, ~200 lines)

Props:
```typescript
import type { V1SearchResponse } from "@repo/console-types";

interface SearchResultsPanelProps {
  searchResults: V1SearchResponse | null;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  expandedId: string;
  onExpandedIdChange: (id: string) => void;
  offset: number;
  storeId: string;
  documentCount?: number;
}
```

Contains:
- `Tabs` with List and JSON tab triggers
- **List tab**: Results header (count, latency, mode badge), context clusters, relevant actors, `SearchResultCard` list, empty states
- **JSON tab**: `CodeBlock` with JSON, empty state
- Pre-search empty state with document count

Imports `MODE_OPTIONS` from `./search-constants` for the mode badge label lookup.

#### 2. Replace inline JSX in workspace-search.tsx
**File**: `apps/console/src/components/workspace-search.tsx`
**Changes**: Replace lines 515-670 with `<SearchResultsPanel ... />`.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Build passes: `pnpm build:console`

#### Manual Verification:
- [ ] Results display correctly in List view
- [ ] Results display correctly in JSON view
- [ ] Tab switching works and persists in URL
- [ ] Result card expansion works
- [ ] Context clusters and relevant actors display
- [ ] Empty states show correctly (pre-search and no-results)

---

## Phase 5: Clean Up Parent Component

### Overview
After all extractions, clean up `workspace-search.tsx` — remove unused imports, verify the parent is a thin orchestrator.

### Changes Required:

#### 1. Final workspace-search.tsx structure
**File**: `apps/console/src/components/workspace-search.tsx`
**Target**: ~120 lines

```
Lines 1-15:   Imports (reduced — UI primitives removed, child components added)
Lines 17-21:  WorkspaceSearchProps interface
Lines 23-XX:  WorkspaceSearch component
  - Hook calls (useWorkspaceSearchParams, useState x3, useSuspenseQuery)
  - performSearch callback
  - handleSearch, handlePromptSubmit, handleKeyDown callbacks
  - Return JSX: root div > split layout >
      Left: ScrollArea > SearchPromptInput + SearchModeSelector + SearchFilters + error display
      Right: SearchResultsPanel
Lines XX+:    WorkspaceSearchSkeleton (unchanged)
```

#### 2. Remove unused imports
Remove any UI component imports that are no longer directly used in the parent (e.g., `Badge`, `Switch`, `Label`, `ToggleGroup`, `Select`, `Input`, `CodeBlock`, `FileText`).

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build passes: `pnpm build:console`
- [ ] `workspace-search.tsx` is under 150 lines

#### Manual Verification:
- [ ] Full search flow works end-to-end: enter query → select mode → set filters → search → view results
- [ ] Cmd+Enter shortcut works
- [ ] URL state is fully preserved (all params reflect in URL, page reload restores state)
- [ ] Error states display correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the search playground behaves identically to before.

---

## Final File Inventory

| File | Status | Est. Lines |
|------|--------|------------|
| `workspace-search.tsx` | Modified (701 → ~120) | ~120 |
| `search-constants.ts` | New | ~55 |
| `search-mode-selector.tsx` | New | ~50 |
| `search-filters.tsx` | New | ~200 |
| `search-results-panel.tsx` | New | ~200 |
| `use-workspace-search-params.ts` | Unchanged | 84 |
| `search-prompt-input.tsx` | Unchanged | 103 |
| `search-result-card.tsx` | Unchanged | 403 |
| `actor-filter.tsx` | Unchanged | 146 |

## Testing Strategy

### Automated:
- `pnpm typecheck` — all new files type-check correctly
- `pnpm lint` — no linting errors
- `pnpm build:console` — production build succeeds

### Manual Testing Steps:
1. Navigate to `/[org]/[workspace]/search`
2. Enter a query and press Cmd+Enter — results appear
3. Toggle mode (fast/balanced/thorough) — re-search shows correct mode badge
4. Adjust limit and offset — results count changes
5. Toggle source types and observation types — filters apply
6. Select an actor filter — filter applies
7. Change age preset — filter applies
8. Toggle includeContext/includeHighlights — results change
9. Expand a result card — content loads
10. Switch to JSON tab — raw JSON displays
11. Refresh page — all URL params restore correctly
12. Click clear — all filters reset

## References

- Research: `thoughts/shared/research/2026-02-06-workspace-search-composable-decomposition.md`
- Current component: `apps/console/src/components/workspace-search.tsx`
- State hook: `apps/console/src/components/use-workspace-search-params.ts`
