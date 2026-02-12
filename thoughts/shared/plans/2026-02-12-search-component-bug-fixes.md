# Search Component Bug Fixes Implementation Plan

## Overview

Fix 10 bugs in the docs search component (`search.tsx` + `use-mixedbread-search.ts`) spanning broken UX states, redundant effect cascades, duplicate event handling, and hook inefficiencies. UX-visible bugs are addressed first, followed by internal cleanup.

## Current State Analysis

The search component uses Radix Popover with a manual overlay portal, debounced search via `useEffect`, and a module-level cache in the custom hook. The component has 4 `useEffect` hooks (+ 1 in the hook) with overlapping concerns that cause cascading re-renders on close.

### Key Discoveries:
- User sees "No results" for 300ms then empty popover during fetch (`search.tsx:106-107, 195-199`)
- Overlay renders on focus with no dropdown content (`search.tsx:112-118`)
- `clearResults()` called 3x on close due to Effect 2/3 cascade (`search.tsx:64-98`)
- Contradictory Popover handlers: `onPointerDownOutside` closes, `onInteractOutside` prevents close (`search.tsx:168-173`)
- `clearResults` creates new `[]` reference every call, triggering unnecessary re-renders (`use-mixedbread-search.ts:213-216`)
- Cache entries never expire proactively (`use-mixedbread-search.ts:188-193`)

## Desired End State

- Typing a query shows a loading indicator in the dropdown during debounce + fetch
- "No results" only appears after a search has completed with zero results
- Overlay only appears when the dropdown has content
- Closing the popover resets state in a single imperative call with no cascading effects
- Escape is handled once, focus management is clean, event handlers are non-contradictory
- `clearResults` is stable, cache proactively evicts expired entries

### Verification:
- `pnpm --filter docs typecheck` passes
- `pnpm --filter docs build` passes
- Manual: type a query, see spinner during load, see results or "No results" after fetch completes
- Manual: focus empty input, no overlay appears until typing begins
- Manual: press Escape, popover closes cleanly with no flicker

## What We're NOT Doing

- Changing the debounce duration (300ms)
- Redesigning the search UI/layout
- Changing the Mixedbread API integration or route handler
- Adding new features (e.g., recent searches, search suggestions)
- Modifying the parent layout mount points

## Implementation Approach

Phases are ordered UX-first: fix what users see, then clean up internals.

---

## Phase 1: Fix UX Rendering States (Bugs 1, 2, 3)

### Overview
Fix the three user-visible bugs: "No results" flash during debounce, empty popover during loading, and overlay appearing on empty focus.

### Changes Required:

#### 1. Track search attempt state
**File**: `apps/docs/src/components/search.tsx`

Add a `hasSearched` ref that tracks whether a search has actually been attempted (debounce fired). This distinguishes "waiting for debounce" from "search returned nothing".

```tsx
const hasSearchedRef = useRef(false);
```

Reset it in the debounce effect when query changes, set it to `true` when the debounce fires:

```tsx
// In debounce effect, before the setTimeout:
hasSearchedRef.current = false;

// Inside the setTimeout callback:
hasSearchedRef.current = true;
void search(searchQuery);
```

#### 2. Fix "No results" condition (Bug 1)
**File**: `apps/docs/src/components/search.tsx:195`

Change from:
```tsx
{!error && !isLoading && results.length === 0 && searchQuery && (
```

To:
```tsx
{!error && !isLoading && results.length === 0 && searchQuery && hasSearchedRef.current && (
```

This prevents "No results" from showing during the 300ms debounce window.

#### 3. Add loading state in popover (Bug 2)
**File**: `apps/docs/src/components/search.tsx`

Add a loading indicator inside the popover content, between the error block and the "No results" block:

```tsx
{!error && (isLoading || (searchQuery && !hasSearchedRef.current)) && (
  <div className="px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground/70">
    <Loader2 className="h-3.5 w-3.5 animate-spin" />
    Searching...
  </div>
)}
```

This covers both the debounce wait period and the fetch in-flight period.

#### 4. Defer overlay until dropdown has content (Bug 3)
**File**: `apps/docs/src/components/search.tsx:112`

Change the overlay condition from:
```tsx
{open && createPortal(
```

To:
```tsx
{showResults && createPortal(
```

This ensures the backdrop overlay only appears when there's actually a dropdown to interact with. Since `showResults` depends on having a query, results, or error, the overlay won't appear on bare focus.

#### 5. Update `showResults` to include loading state
**File**: `apps/docs/src/components/search.tsx:106-107`

Change from:
```tsx
const showResults =
  open && (results.length > 0 || searchQuery.length > 0 || error);
```

To:
```tsx
const showResults =
  open && (results.length > 0 || (searchQuery.length > 0 && (hasSearchedRef.current || isLoading)) || error);
```

This ensures the popover only opens once there's meaningful content to show (loading indicator, results, or error) — not during the initial debounce wait on first keystroke. However, since we want the loading indicator to show during debounce too, we simplify to:

```tsx
const showResults =
  open && (results.length > 0 || searchQuery.trim().length > 0 || error);
```

Keep the original logic but use `trim()` to avoid showing for whitespace-only queries. The popover will open as the user types, showing the "Searching..." indicator immediately.

### Success Criteria:

#### Automated Verification:
- [x] Type check passes: `pnpm --filter docs typecheck`
- [x] Build passes: `pnpm --filter docs build`

#### Manual Verification:
- [ ] Type a query → see "Searching..." indicator (not "No results") during debounce + fetch
- [ ] After fetch completes with results → results display correctly
- [ ] After fetch completes with no results → "No results" appears
- [ ] Focus empty input → no overlay, no dropdown
- [ ] Type first character → dropdown appears with "Searching..." and overlay fades in together

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 2: Consolidate Close Logic & Remove Effect Cascade (Bugs 4, 5, 6, 7, 8)

### Overview
Replace reactive effects with an imperative `handleClose` function. Remove duplicate Escape handling, fix contradictory Popover handlers, and clean up focus management.

### Changes Required:

#### 1. Create imperative `handleClose`
**File**: `apps/docs/src/components/search.tsx`

```tsx
const handleClose = useCallback(() => {
  setOpen(false);
  setSearchQuery("");
  clearResults();
  setSelectedIndex(0);
  hasSearchedRef.current = false;
  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = undefined;
  }
}, [clearResults]);
```

#### 2. Remove Effect 3 (reset on close)
**File**: `apps/docs/src/components/search.tsx:88-98`

Delete entirely:
```tsx
// DELETE this effect
useEffect(() => {
  if (!open) {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }
    setSearchQuery("");
    clearResults();
    setSelectedIndex(0);
  }
}, [open, clearResults]);
```

#### 3. Remove Effect 4 (reset selectedIndex on results change)
**File**: `apps/docs/src/components/search.tsx:101-103`

Delete entirely:
```tsx
// DELETE this effect
useEffect(() => {
  setSelectedIndex(0);
}, [results]);
```

Instead, reset `selectedIndex` inside the `search()` callback in the debounce effect, right before calling search:

In the debounce effect's setTimeout:
```tsx
debounceTimerRef.current = setTimeout(() => {
  hasSearchedRef.current = true;
  setSelectedIndex(0);
  void search(searchQuery);
}, 300);
```

#### 4. Replace all `setOpen(false)` calls with `handleClose()`
**File**: `apps/docs/src/components/search.tsx`

Update these locations:
- Overlay onClick (`search.tsx:116`): `onClick={() => handleClose()}`
- Escape handler in Effect 1 (`search.tsx:54`): `handleClose(); inputRef.current?.blur();`
- Enter navigation (`search.tsx:48`): `handleClose()`
- Link onClick (`search.tsx:213`): `onClick={() => handleClose()}`

#### 5. Remove redundant Popover event handlers (Bugs 5, 6, 8)
**File**: `apps/docs/src/components/search.tsx:164-173`

Remove these handlers from `Popover.Content`:
- `onEscapeKeyDown` — already handled by the global keyboard effect
- `onPointerDownOutside` — already handled by overlay onClick
- `onInteractOutside` — contradictory and no longer needed

Replace with just:
```tsx
onOpenAutoFocus={(e) => e.preventDefault()}
onInteractOutside={(e) => e.preventDefault()}
```

Keep `onInteractOutside` with `preventDefault()` to prevent Radix from closing the popover on its own — we control close exclusively through `handleClose()`. Remove the other two.

#### 6. Remove RAF focus hack (Bug 8)
**File**: `apps/docs/src/components/search.tsx:132-137`

Change from:
```tsx
onFocus={() => {
  setOpen(true);
  requestAnimationFrame(() => {
    inputRef.current?.focus();
  });
}}
```

To:
```tsx
onFocus={() => setOpen(true)}
```

The `onOpenAutoFocus={(e) => e.preventDefault()}` already prevents Radix from stealing focus, so the RAF re-focus is unnecessary.

#### 7. Update debounce effect dependencies
**File**: `apps/docs/src/components/search.tsx:64-84`

After removing Effect 3, the debounce effect no longer needs to handle the `!open` case for cleanup (that's now in `handleClose`). Simplify:

```tsx
useEffect(() => {
  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current);
  }

  if (!searchQuery.trim() || !open) {
    return;
  }

  debounceTimerRef.current = setTimeout(() => {
    hasSearchedRef.current = true;
    setSelectedIndex(0);
    void search(searchQuery);
  }, 300);

  return () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }
  };
}, [searchQuery, open, search]);
```

Note: removed `clearResults` from the dependency array since we no longer call it here. When query is empty or popover is closed, `handleClose` takes care of cleanup.

#### 8. Update keyboard effect to use `handleClose`
**File**: `apps/docs/src/components/search.tsx:26-61`

Add `handleClose` to the dependency array and use it for Escape and Enter:

```tsx
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    }

    const isInputFocused = document.activeElement === inputRef.current;

    if (open && results.length > 0 && isInputFocused) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        router.push(results[selectedIndex].url);
        handleClose();
      }
    }

    if (e.key === "Escape" && isInputFocused && open) {
      e.preventDefault();
      handleClose();
      inputRef.current?.blur();
    }
  }

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [open, results, selectedIndex, router, handleClose]);
```

### Success Criteria:

#### Automated Verification:
- [x] Type check passes: `pnpm --filter docs typecheck`
- [x] Build passes: `pnpm --filter docs build`

#### Manual Verification:
- [ ] Type query, see results, press Escape → popover closes, input blurs, state resets cleanly
- [ ] Type query, click overlay → same clean close behavior
- [ ] Type query, click a result → navigates and closes cleanly
- [ ] Cmd+K → opens, Escape → closes, no double-fire or flicker
- [ ] Arrow keys navigate results, Enter navigates to selected result
- [ ] No console warnings about state updates

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 3: Hook Efficiency (Bugs 9, 10)

### Overview
Stabilize `clearResults` to avoid unnecessary re-renders and add proper cache cleanup.

### Changes Required:

#### 1. Stabilize `clearResults` with constant reference (Bug 9)
**File**: `apps/docs/src/hooks/use-mixedbread-search.ts:213-216`

Change from:
```tsx
const clearResults = useCallback(() => {
  setResults([]);
  setError(null);
}, []);
```

To:
```tsx
const EMPTY_RESULTS: SearchResult[] = [];

// Inside the hook:
const clearResults = useCallback(() => {
  setResults(EMPTY_RESULTS);
  setError(null);
}, []);
```

Define `EMPTY_RESULTS` as a module-level constant so `setResults` receives the same reference every time, and React's `Object.is` check skips the re-render when results are already empty.

#### 2. Proactive cache cleanup (Bug 10)
**File**: `apps/docs/src/hooks/use-mixedbread-search.ts:187-193`

Replace the current single-entry eviction with proper expired entry cleanup:

```tsx
// Clean up expired cache entries
if (searchCache.size > 20) {
  const now = Date.now();
  for (const [key, value] of searchCache) {
    if (now - value.timestamp > CACHE_TTL) {
      searchCache.delete(key);
    }
  }
  // If still over limit after TTL cleanup, remove oldest
  if (searchCache.size > 50) {
    const entries = Array.from(searchCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    searchCache.delete(entries[0][0]);
  }
}
```

This runs cleanup when the cache grows past 20 entries, evicting all expired entries first, then falling back to LRU-style eviction only if still over 50.

### Success Criteria:

#### Automated Verification:
- [x] Type check passes: `pnpm --filter docs typecheck`
- [x] Build passes: `pnpm --filter docs build`

#### Manual Verification:
- [ ] Search works as before — no behavioral regressions
- [ ] Repeated close/open cycles don't accumulate unnecessary renders (verify via React DevTools profiler if desired)

---

## Testing Strategy

### Automated:
- `pnpm --filter docs typecheck`
- `pnpm --filter docs build`

### Manual Testing Steps:
1. Focus search input with empty query → no overlay, no dropdown
2. Type "api" → "Searching..." appears in dropdown with overlay
3. Wait for results → results display, "Searching..." disappears
4. Type nonsense query → "Searching..." then "No results"
5. Press Escape → clean close, no flicker
6. Click overlay → clean close
7. Click a result → navigates, closes
8. Cmd+K → opens search, type query, Arrow keys to navigate, Enter to select
9. Rapid typing → no flash of "No results", smooth debounce
10. Open/close repeatedly → no console warnings, no accumulated state

## Performance Considerations

- Removing 2 effects eliminates ~3 unnecessary re-renders per close cycle
- Stable `EMPTY_RESULTS` reference prevents re-renders when clearing already-empty results
- Cache cleanup prevents unbounded memory growth in long sessions

## References

- Research: `thoughts/shared/research/2026-02-12-search-component-deep-debug.md`
- Source: `apps/docs/src/components/search.tsx` (243 lines)
- Hook: `apps/docs/src/hooks/use-mixedbread-search.ts` (235 lines)
