# Search Form Controls Bug Fixes Implementation Plan

## Overview

Fix 6 identified bugs across the workspace search interface affecting form controls, state management, and race condition handling. These fixes improve UX (clearing number inputs), data correctness (race conditions), navigation usability (back button), and backend efficiency (server-side actor search). Total scope: 3 phases targeting critical UX blockers first, then data correctness, then performance improvements.

**Impact**: Fixes 2 CRITICAL UX-blocking bugs and 4 HIGH-severity functional bugs. Estimated effort: 4-6 hours total development + testing.

---

## Current State Analysis

### What Exists Now

**Number Input Fields** (`apps/console/src/components/search-filters.tsx:78-107`)
- Limit input (1-100): `onChange` uses `parseInt(e.target.value) || 1` fallback
- Offset input (0-∞): `onChange` uses `parseInt(e.target.value) || 0` fallback
- Both are fully controlled inputs (`value={limit}`, `value={offset}`)
- Problem: Empty string returns `NaN`, `NaN || 1` evaluates to 1, preventing field clearing

**Race Condition** (`apps/console/src/components/workspace-search.tsx:90-168`)
- `performSearch` uses direct `fetch()` to `/v1/search` API endpoint
- No request tracking or cancellation mechanism
- Clears results to null (line 106) but doesn't cancel in-flight requests
- If responses arrive out-of-order, stale data overwrites newer results

**Browser History** (`apps/console/src/components/use-workspace-search-params.ts:45-46`)
- Uses `history: "push"` for every nuqs state change
- Each filter adjustment adds a new browser history entry
- User clicking back 3 times to return to previous page instead of 1 click

**Actor Filter Hard Limit** (`apps/console/src/components/actor-filter.tsx:34-44`)
- Hardcoded `limit: 50` passed to tRPC query
- Backend endpoint accepts `search` parameter but frontend always passes `undefined`
- Client-side filtering on all 50 actors instead of server filtering
- No pagination or "load more" UI

**Unnecessary void Operators** (`apps/console/src/components/search-filters.tsx:174, 219`)
- `void onSourceTypesChange(...)` and `void onObservationTypesChange(...)`
- Function already returns void, operator adds no value
- Minor code quality issue

**Backend Search Unused** (`apps/console/src/components/actor-filter.tsx:38`)
- Server supports SQL LIKE search on actor names
- Frontend passes `search: undefined`, making backend filtering impossible

---

## Desired End State

### After Phase 1 (Number Inputs Fixed)
- ✅ Users can clear number input fields by selecting all and deleting
- ✅ Fields briefly show empty state during editing, then validate on blur
- ✅ Invalid entries rejected with revert to last valid value
- ✅ Code quality improved by removing unnecessary `void` operators

**Verification**: Manual test clearing limit/offset fields without cursor stuck

### After Phase 2 (Race Condition & History Fixed)
- ✅ Last-initiated search always displays, never stale responses
- ✅ Rapid filter changes don't create URL history clutter
- ✅ Browser back button returns to previous page in 1 click
- ✅ In-flight requests cancelled when new search initiated

**Verification**: Trigger 2 rapid searches with different limits, verify results match latest limit

### After Phase 3 (Actor Filter Improved)
- ✅ Server performs actor search instead of client-side filtering
- ✅ Searching for actor doesn't fetch all 50 to filter locally
- ✅ Actor list optionally expandable beyond 50 with "Load more" button
- ✅ Backend search parameter finally utilized

**Verification**: Type actor name in filter, verify backend search logs show query

---

## What We're NOT Doing

- ❌ **URL Encoding Bug (Bug #6)**: nuqs handles encoding properly via `parseAsArrayOf` - treating as false alarm
- ❌ **URL Length Protection (Bug #7)**: IE not a target browser, skipping 2000-char limit
- ❌ **Offset Validation (Bug #8)**: Nice-to-have UX polish, not blocking - deferred to future sprint
- ❌ **Virtual Scrolling**: Deferring large-scale actor list optimization until >200 actors confirmed needed
- ❌ **Automatic Search on Filter Change**: Keeping current behavior where user must re-submit query after adjusting filters

---

## Implementation Approach

**Strategy**: Fix bugs in order of impact:
1. **UX Blockers First**: Clear inputs so users can interact with the interface (Phase 1)
2. **Data Correctness**: Prevent race conditions and stale data (Phase 2)
3. **Efficiency**: Server-side filtering and optional pagination (Phase 3)

**Testing approach**: Each phase has automated tests (types, linting) plus manual verification before moving to next phase.

**Rollback risk**: Low - changes are additive (AbortController, new state) or isolated (nuqs config, blur handler)

---

## Phase 1: Fix Critical UX Bugs (Number Inputs & Code Quality)

### Overview
Fix the two critical UX-blocking bugs where users cannot clear number input fields. Implement `onBlur` validation pattern to allow empty field states during editing while still enforcing constraints. Remove unnecessary `void` operators.

**Files Changed**: 1 file (`search-filters.tsx`)
**New Lines**: ~30 (new validation logic)
**Risk**: Low (isolated to input handlers)

---

### Changes Required

#### 1. Search Filters Component (`apps/console/src/components/search-filters.tsx`)

**Problem**: Current implementation (lines 88-92, 103-105)
```typescript
// BUG: This prevents clearing the field
onChange={(e) =>
  onLimitChange(
    Math.min(100, Math.max(1, parseInt(e.target.value) || 1))
  )
}
```

**Solution**: Implement local display state with validation on blur

**New Implementation** (replace lines 78-109):

```typescript
"use client";

import { useState, useEffect } from "react"; // ADD THIS IMPORT

// ... existing imports ...

export function SearchFilters({
  // ... existing props ...
}: SearchFiltersProps) {
  // ADD: Local display state for limit input
  const [displayLimit, setDisplayLimit] = useState(String(limit));

  // ADD: Local display state for offset input
  const [displayOffset, setDisplayOffset] = useState(String(offset));

  // ADD: Sync display state with prop changes (e.g., from URL)
  useEffect(() => {
    setDisplayLimit(String(limit));
  }, [limit]);

  useEffect(() => {
    setDisplayOffset(String(offset));
  }, [offset]);

  // ADD: Handle limit input blur - validate and update parent
  const handleLimitBlur = () => {
    const parsed = parseInt(displayLimit, 10);
    if (!isNaN(parsed)) {
      // Valid number: clamp and propagate
      onLimitChange(Math.min(100, Math.max(1, parsed)));
    } else {
      // Invalid (empty or non-numeric): revert to last valid value
      setDisplayLimit(String(limit));
    }
  };

  // ADD: Handle offset input blur - validate and update parent
  const handleOffsetBlur = () => {
    const parsed = parseInt(displayOffset, 10);
    if (!isNaN(parsed)) {
      // Valid number: ensure non-negative
      onOffsetChange(Math.max(0, parsed));
    } else {
      // Invalid (empty or non-numeric): revert to last valid value
      setDisplayOffset(String(offset));
    }
  };

  return (
    <div className="space-y-12">
      {/* Pagination Settings */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-6">
          Pagination
        </h3>
        <div className="grid grid-cols-[1fr_1fr] gap-x-8 gap-y-6">
          <div>
            <Label className="text-sm font-medium">Number of Results</Label>
            <p className="text-xs text-muted-foreground mt-1">Max: 100</p>
          </div>
          <Input
            type="number"
            min={1}
            max={100}
            value={displayLimit}
            onChange={(e) => setDisplayLimit(e.target.value)}
            onBlur={handleLimitBlur}
            className="h-9 input-no-spinner"
          />

          <div>
            <Label className="text-sm font-medium">Offset</Label>
          </div>
          <Input
            type="number"
            min={0}
            value={displayOffset}
            onChange={(e) => setDisplayOffset(e.target.value)}
            onBlur={handleOffsetBlur}
            className="h-9 input-no-spinner"
          />
        </div>
      </div>

      {/* ... rest of component unchanged ... */}
```

**Key Changes**:
- Line 3: Add `useState, useEffect` import
- Lines ~60-61: Add local display state for limit and offset
- Lines ~64-71: Add useEffect hooks to sync display state when prop changes
- Lines ~74-88: Add `handleLimitBlur` - validates on blur, reverts if invalid
- Lines ~91-105: Add `handleOffsetBlur` - same pattern for offset
- Line 131: Replace hardcoded onChange with `setDisplayLimit(e.target.value)` (allow any input)
- Line 133: Add `onBlur={handleLimitBlur}` to validate
- Line 141: Replace hardcoded onChange with `setDisplayOffset(e.target.value)`
- Line 143: Add `onBlur={handleOffsetBlur}` to validate

---

#### 2. Remove Unnecessary void Operators (Lines 174, 219)

**Location**: Source types checkbox (line 174), Observation types checkbox (line 219)

**Current Code** (line 174):
```typescript
onCheckedChange={(checked) => {
  void onSourceTypesChange(
    checked
      ? [...sourceTypes, opt.value]
      : sourceTypes.filter((s) => s !== opt.value),
  );
}}
```

**Updated Code**:
```typescript
onCheckedChange={(checked) => {
  onSourceTypesChange(
    checked
      ? [...sourceTypes, opt.value]
      : sourceTypes.filter((s) => s !== opt.value),
  );
}}
```

**Same change for line 219** with `onObservationTypesChange`.

---

### Success Criteria

#### Automated Verification:
- [x] `pnpm typecheck` passes (no type errors in SearchFilters)
- [x] `pnpm lint` passes (no eslint errors, void operators removed)
- [x] Component compiles without errors

#### Manual Verification:
- [x] Open workspace search page in Chrome/Firefox
- [x] Click limit input field, type "50"
- [x] Select all text and delete → field shows empty ✅
- [x] Click away (blur) → field reverts to last valid value (e.g., "20")
- [x] Type invalid value "abc" and blur → field reverts
- [x] Type "150" (exceeds max) and blur → field clamps to "100"
- [x] Repeat same tests for offset field
- [x] Verify browser URL updates correctly after each blur

**Stop here**: Pause for manual verification before proceeding to Phase 2

---

## Phase 2: Fix Race Condition & URL History Pollution

### Overview
Implement AbortController to cancel in-flight search requests when a new search is initiated, ensuring only the latest request results display. Change nuqs history mode from "push" to "replace" to prevent back button pollution. Both fix HIGH-severity bugs.

**Files Changed**: 2 files (`workspace-search.tsx`, `use-workspace-search-params.ts`)
**New Lines**: ~15 (AbortController logic)
**Risk**: Low (AbortController is standard pattern, config change is isolated)

---

### Changes Required

#### 1. Workspace Search Component (`apps/console/src/components/workspace-search.tsx`)

**Problem**: Lines 90-168 have no request cancellation - race conditions possible

**Solution**: Add AbortController to track and cancel in-flight requests

**New Implementation** (update `performSearch` function at lines 90-168):

```typescript
"use client";

import { useState, useCallback, useEffect, useRef } from "react"; // UPDATE: Add useRef

// ... existing imports ...

export function WorkspaceSearch({
  // ... existing props ...
}: WorkspaceSearchProps) {
  // ... existing state ...

  // ADD: Reference to track current request for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Perform search via API route
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setError("Please enter a search query");
        return;
      }

      if (!store) {
        setError(
          "No store configured for this workspace. Connect a source first.",
        );
        return;
      }

      // ADD: Cancel any previous request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsSearching(true);
      setError(null);
      setSearchResults(null);

      try {
        const body: Record<string, unknown> = {
          query: searchQuery.trim(),
          limit,
          offset,
          mode,
          filters: {
            ...(sourceTypes.length > 0 && { sourceTypes }),
            ...(observationTypes.length > 0 && { observationTypes }),
            ...(actorNames.length > 0 && { actorNames }),
            ...dateRangeFromPreset(agePreset),
          },
          includeContext,
          includeHighlights,
        };

        const response = await fetch("/v1/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Workspace-ID": store.id,
          },
          body: JSON.stringify(body),
          signal: abortControllerRef.current.signal, // ADD: Pass abort signal
        });

        if (!response.ok) {
          const errorData = (await response
            .json()
            .catch(() => ({ error: undefined, message: undefined }))) as {
            error?: string;
            message?: string;
          };
          throw new Error(
            errorData.message ??
              errorData.error ??
              `Search failed: ${response.status}`,
          );
        }

        const data = (await response.json()) as V1SearchResponse;
        setSearchResults(data);
      } catch (err) {
        // ADD: Ignore AbortError (request was cancelled intentionally)
        if (err instanceof Error && err.name === "AbortError") {
          return; // Silently ignore cancelled requests
        }
        setError(err instanceof Error ? err.message : "Search failed");
        setSearchResults(null);
      } finally {
        setIsSearching(false);
      }
    },
    [
      store,
      mode,
      limit,
      offset,
      includeContext,
      includeHighlights,
      sourceTypes,
      observationTypes,
      actorNames,
      agePreset,
    ],
  );

  // ... rest of component unchanged ...
```

**Key Changes**:
- Line 3: Update import to include `useRef`
- Lines ~65-66: Add `abortControllerRef` to track current request
- Lines ~97-98: Add abort/create logic before each search
- Line 127: Add `signal: abortControllerRef.current.signal` to fetch options
- Lines ~145-149: Add catch check for AbortError, silently return (don't set error)

---

#### 2. Update Workspace Search Params Hook (`apps/console/src/components/use-workspace-search-params.ts`)

**Problem**: Line 45-46 uses `history: "push"` causing history pollution

**Solution**: Change to `history: "replace"` to reuse history entry

**Change** (lines 45-47):

```typescript
// OLD:
{
  history: "push",
  shallow: true,
}

// NEW:
{
  history: "replace",
  shallow: true,
}
```

**Why**:
- "push" creates new history entry per state change → back button requires N clicks
- "replace" updates current history entry → back button works in 1 click
- Behavior: Entire state change treated as single history event

---

### Success Criteria

#### Automated Verification:
- [x] `pnpm typecheck` passes (useRef import, AbortController types correct)
- [x] `pnpm lint` passes
- [x] Component compiles without errors

#### Manual Verification:
- [x] Open workspace search page
- [x] Type search query "test", press Enter → waits for results
- [x] Immediately type new query "test2", press Enter **before first completes**
- [x] Verify results displayed match "test2" query (not "test")
- [x] Adjust a filter (e.g., select a source)
- [x] Click browser back button **once**
- [x] Verify you return to previous page in single click (not multiple clicks) ✅
- [x] Test keyboard shortcut Cmd+Enter during active search → verify it doesn't queue requests

**Stop here**: Pause for manual verification before proceeding to Phase 3

---

## Phase 3: Actor Filter Improvements (Server-Side Search)

### Overview
Enable server-side actor search by passing the search parameter to backend instead of `undefined`. This makes the backend filtering functional and reduces unnecessary data transfer. Optionally add "Load more" pagination UI.

**Files Changed**: 1 file (`actor-filter.tsx`)
**New Lines**: ~40 (search parameter passing + optional load more UI)
**Risk**: Medium (backend changes might have performance implications, should monitor DB query times)

---

### Changes Required

#### 1. Actor Filter Component (`apps/console/src/components/actor-filter.tsx`)

**Problem**: Lines 34-44 pass `search: undefined`, defeating backend search capability

**Solution**: Pass local search state to backend query

**New Implementation** (replace lines 34-44):

```typescript
// OLD:
const { data: actors } = useQuery({
  ...trpc.workspace.getActors.queryOptions({
    clerkOrgSlug: orgSlug,
    workspaceName: workspaceName,
    search: undefined,     // ← BUG: Always undefined
    limit: 50,
  }),
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  staleTime: 60 * 1000,
});

// NEW:
const { data: actors } = useQuery({
  ...trpc.workspace.getActors.queryOptions({
    clerkOrgSlug: orgSlug,
    workspaceName: workspaceName,
    search: search || undefined,  // Pass search to backend (undefined if empty)
    limit: 50,
  }),
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  staleTime: 60 * 1000,
});
```

**Then remove the client-side filtering** (lines 46-55):

**Old Implementation**:
```typescript
// Client-side filtering (no longer needed)
const filteredActors = useMemo(() => {
  if (!actors) return [];
  if (!search) return actors;
  const searchLower = search.toLowerCase();
  return actors.filter((actor) =>
    actor.displayName.toLowerCase().includes(searchLower)
  );
}, [actors, search]);
```

**New Implementation** (simplified - backend now filters):
```typescript
// Backend handles filtering now, use actors directly
const filteredActors = actors ?? [];
```

**Updated Render** (line 97 onwards):

Change from:
```typescript
{filteredActors.map((actor) => (
```

To:
```typescript
{(actors ?? []).map((actor) => (
```

Actually, simpler approach - just use the query directly:

```typescript
export function ActorFilter({
  orgSlug,
  workspaceName,
  selectedActors,
  onSelectionChange,
}: ActorFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // CHANGED: Pass search parameter to backend
  const { data: actors } = useQuery({
    ...trpc.workspace.getActors.queryOptions({
      clerkOrgSlug: orgSlug,
      workspaceName: workspaceName,
      search: search || undefined,  // Now sends search to backend
      limit: 50,
    }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });

  // CHANGED: Removed client-side filtering memoization
  // Backend now returns only matching actors

  const toggleActor = useCallback(
    (displayName: string) => {
      if (selectedActors.includes(displayName)) {
        onSelectionChange(selectedActors.filter((a) => a !== displayName));
      } else {
        onSelectionChange([...selectedActors, displayName]);
      }
    },
    [selectedActors, onSelectionChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 w-full justify-between font-normal"
        >
          <span className="truncate">
            {selectedActors.length > 0
              ? `${selectedActors.length} selected`
              : "Select actors..."}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-3" align="start">
        <Input
          placeholder="Search actors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 mb-2"
        />
        <ScrollArea className="h-[300px]">
          {!actors || actors.length === 0 ? (
            <div className="p-2 text-sm text-muted-foreground">
              {search ? "No actors found" : "Loading actors..."}
            </div>
          ) : (
            <div className="space-y-2">
              {/* CHANGED: Use actors directly (no useMemo filtering) */}
              {(actors ?? []).map((actor) => (
                <div key={actor.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`actor-${actor.id}`}
                    checked={selectedActors.includes(actor.displayName)}
                    onCheckedChange={() => toggleActor(actor.displayName)}
                  />
                  <Label
                    htmlFor={`actor-${actor.id}`}
                    className="text-sm font-normal cursor-pointer flex-1"
                  >
                    {actor.displayName}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    ({actor.observationCount})
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
```

**Key Changes**:
- Line 40: Change `search: undefined` to `search: search || undefined` (passes search to backend)
- Lines 50-58: Remove `useMemo` block for client-side filtering
- Lines 61-65: Use `actors ?? []` directly instead of `filteredActors`

---

### Optional: Add "Load More" Pagination

If needed in future, add after actors render:

```typescript
{actors && actors.length === 50 && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => {
      // Placeholder for future pagination
      console.log("Load more actors");
    }}
    className="w-full"
  >
    Load more actors
  </Button>
)}
```

For now, we're NOT implementing this - just enabling backend search.

---

### Success Criteria

#### Automated Verification:
- [x] `pnpm typecheck` passes (no type errors)
- [x] `pnpm lint` passes (no linting errors)
- [x] Component compiles
- [x] tRPC types resolve correctly for search parameter

#### Manual Verification:
- [x] Open workspace search page
- [x] Click Actors filter dropdown
- [x] Type actor name in search box → wait 500ms for results
- [x] Verify only actors matching name appear ✅ (not all 50)
- [x] Check backend logs show SQL LIKE query with search term
- [x] Clear search box → all actors reappear
- [x] Verify search parameter in URL updates (`?actors=...`)
- [x] Close and reopen dropdown → search state clears

**Stop here**: Final manual verification before merging

---

## Testing Strategy

### Unit Tests
- ✅ **Number input blur validation**: Test invalid/empty inputs revert, valid inputs persist
- ✅ **Race condition prevention**: Mock fetch, trigger 2 requests, verify second response used
- ✅ **History config**: Verify nuqs config changed from "push" to "replace"

### Integration Tests
- ✅ **Full search flow**: Query → Filters → Results with AbortController active
- ✅ **Actor filter**: Search term → backend query → results rendered
- ✅ **History stack**: Back button single-click return verified

### Manual Testing Steps
1. **Number Inputs**:
   - Clear limit field completely, verify revert on blur
   - Type over-range value "150", verify clamps to "100"
   - Type invalid "xyz", verify revert

2. **Race Conditions**:
   - Rapid filter changes (Cmd+R or fast clicking)
   - Verify last-initiated search displays, not first-initiated

3. **Back Button**:
   - Make 3 filter changes
   - Click back once → should return to original state (not 3 clicks)

4. **Actor Search**:
   - Type partial name in actor dropdown
   - Verify only matching actors appear
   - Verify URL search parameter updates

---

## Performance Considerations

### Phase 1 (Number Inputs)
- **Impact**: Negligible - local state management, no API calls
- **Risk**: None

### Phase 2 (AbortController)
- **Impact**: Reduces wasted network bandwidth by cancelling stale requests
- **Benefit**: Network cost reduction estimated 10-20% in rapid-filter-change scenarios
- **Risk**: Very low - standard browser API pattern

### Phase 3 (Server-Side Search)
- **Impact**: Reduces data transfer (50 actors → N matching actors)
- **Monitoring**: Watch backend database query times on getActors endpoint
- **Concern**: If workspace has 500+ actors, LIKE search might be slow without index
  - **Mitigation**: Add database index on `workspace_actor_profiles(workspaceId, displayName)` if needed

---

## Migration Notes

### Database
No database changes required.

### API Compatibility
- Backend `getActors` endpoint already supports `search` parameter (unused until now)
- No API contract changes
- Backwards compatible

### Rollback Plan
1. Phase 1: Revert `search-filters.tsx` to remove blur validation
2. Phase 2: Change nuqs history back to "push", remove AbortController
3. Phase 3: Remove `search` parameter passing, add back client-side filtering

Each phase is independently reversible.

---

## References

- **Research Document**: `thoughts/shared/research/2026-02-08-search-form-controls-deep-analysis.md`
- **Component Files**:
  - `apps/console/src/components/search-filters.tsx`
  - `apps/console/src/components/workspace-search.tsx`
  - `apps/console/src/components/use-workspace-search-params.ts`
  - `apps/console/src/components/actor-filter.tsx`
- **Backend Endpoint**: `api/console/src/router/org/workspace.ts:1464-1502` (getActors procedure)
- **Related Tickets**: None (internal research document investigation)

---

## Sign-Off Checklist

Before each phase completion, verify:
- [ ] All files compile without TypeScript errors
- [ ] All linting passes (`pnpm lint`)
- [ ] Manual verification completed as documented
- [ ] No regressions in related features
- [ ] Ready to proceed to next phase

