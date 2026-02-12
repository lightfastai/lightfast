---
date: 2026-02-12T12:00:00+08:00
researcher: claude
git_commit: 0f1a53a6
branch: feat/landing-page-grid-rework
repository: lightfast-search-perf-improvements
topic: "Deep debug of docs search component — bugs, effect cascades, and efficiency"
tags: [research, codebase, search, useEffect, radix-popover, debugging]
status: complete
last_updated: 2026-02-12
last_updated_by: claude
---

# Research: Deep Debug of Search Component

**Date**: 2026-02-12
**Git Commit**: 0f1a53a6
**Branch**: feat/landing-page-grid-rework

## Research Question

Deep debug `apps/docs/src/components/search.tsx` — find bugs, identify unnecessary useEffects, and determine how to make the implementation more efficient.

## Summary

The search component has **10 distinct bugs/issues** spanning UX, event handling, effect cascades, and rendering. The most impactful are: a "No results" flash during debounce, an empty popover during loading, the overlay appearing on empty focus, and a cascade of **redundant effect executions** when the popover closes (clearResults called 3x, setSelectedIndex called 2x, keyboard handler re-registered 3x).

---

## Bug Inventory

### Bug 1: "No results" flash before search fires (HIGH)

**Files**: `search.tsx:106-107`, `search.tsx:195-199`

When the user types a character, `searchQuery` updates immediately but the search is debounced by 300ms. During that 300ms window:

```
showResults = open && (results.length > 0 || searchQuery.length > 0 || error)
            = true && (false || true || false)
            = true  → popover renders
```

The popover opens and hits this condition at `search.tsx:195`:
```tsx
{!error && !isLoading && results.length === 0 && searchQuery && (
  <div>No results</div>
)}
```

Result: User sees **"No results" for 300ms** before the search even fires. This is misleading — the search hasn't been attempted yet.

### Bug 2: Empty popover during loading (HIGH)

**Files**: `search.tsx:189-236`

After the debounce fires and the fetch is in-flight (`isLoading=true`), none of the rendering conditions match:

| Condition | Evaluates to |
|-----------|-------------|
| `error` | `false` |
| `!error && !isLoading && results.length === 0 && searchQuery` | `false` (isLoading=true) |
| `!error && results.length > 0` | `false` |
| `!error && results.length === 0 && !searchQuery` | `false` |

The popover renders an **empty container** — no loading indicator, no "Searching..." message, nothing.

**Full UX timeline when user types "api":**
1. 0–300ms: "No results" (Bug 1)
2. 300ms–fetch complete: Empty popover (Bug 2)
3. After fetch: Actual results

### Bug 3: Overlay appears on empty input focus (MEDIUM)

**Files**: `search.tsx:112-118`, `search.tsx:132-133`

Clicking/tabbing to the search input fires `onFocus → setOpen(true)`. The overlay renders immediately:

```tsx
{open && createPortal(
  <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-md ..." />,
  document.body,
)}
```

But `showResults` is `false` (no query, no results, no error), so no popover dropdown appears. The user sees a **full-page backdrop blur with no dropdown** until they start typing. This is confusing — a modal-like overlay with nothing to interact with.

### Bug 4: Redundant effect cascade on close (MEDIUM)

**Files**: `search.tsx:64-84`, `search.tsx:88-98`, `search.tsx:101-103`

When `open` transitions to `false`, three effects cascade redundantly:

```
setOpen(false)
  → Effect 2 (debounce): clearResults()           ← 1st clearResults
    → setResults([]) → Effect 4: setSelectedIndex(0)  ← 1st setSelectedIndex
      → Effect 1: re-registers keyboard handler       ← 1st re-register
  → Effect 3 (reset):
    → setSearchQuery("")                            ← triggers Effect 2 again
    → clearResults()                                ← 2nd clearResults (redundant)
    → setSelectedIndex(0)                           ← 2nd setSelectedIndex (redundant)
      → Effect 2 re-runs: clearResults()            ← 3rd clearResults (redundant)
```

**Total**: `clearResults()` called 3x, `setSelectedIndex(0)` called 2x, Effect 1 re-registers 3x. This causes multiple unnecessary re-renders.

### Bug 5: Double Escape handling (LOW)

**Files**: `search.tsx:52-56`, `search.tsx:167`

Two independent Escape handlers fire:

1. Global keydown (`search.tsx:52`): `setOpen(false)` + `inputRef.current?.blur()`
2. Popover's `onEscapeKeyDown` (`search.tsx:167`): `setOpen(false)`

Both call `setOpen(false)`. Only the global handler blurs the input. The Radix handler is redundant since the global handler already covers this case.

### Bug 6: Contradictory Popover event handlers (LOW)

**Files**: `search.tsx:168-173`

```tsx
onPointerDownOutside={(e) => {
  setOpen(false);          // closes popover
}}
onInteractOutside={(e) => {
  e.preventDefault();       // prevents popover from closing
}}
```

`onPointerDownOutside` manually closes the popover, then `onInteractOutside` calls `preventDefault()` to prevent Radix's default close behavior. The intent is confused — if we're already closing manually, preventing the default close is meaningless. And if we wanted to prevent closing, the manual close contradicts that.

### Bug 7: Double close on overlay click (LOW)

**Files**: `search.tsx:116`, `search.tsx:168-170`

When clicking the overlay backdrop:
1. Overlay's `onClick` fires → `setOpen(false)`
2. Popover's `onPointerDownOutside` fires → `setOpen(false)` again

React batches these, so no visible bug, but the architecture is unclear about which layer owns the close behavior.

### Bug 8: Focus management race condition (LOW)

**Files**: `search.tsx:132-137`, `search.tsx:164-166`

```tsx
// Input
onFocus={() => {
  setOpen(true);
  requestAnimationFrame(() => {
    inputRef.current?.focus();  // re-focus after RAF
  });
}}

// Popover.Content
onOpenAutoFocus={(e) => {
  e.preventDefault();  // prevent Radix from stealing focus
}}
```

Two mechanisms fight over focus: `onOpenAutoFocus` prevents Radix from stealing focus, while `requestAnimationFrame` re-focuses the input as a safety net. Between the state update and the RAF callback, there's a frame where focus could be in an undefined state, potentially causing lost keystrokes.

### Bug 9: clearResults creates new array references (LOW)

**File**: `use-mixedbread-search.ts:213-216`

```tsx
const clearResults = useCallback(() => {
  setResults([]);     // new [] reference every call
  setError(null);
}, []);
```

`setResults([])` creates a new array reference on every call, even if results are already empty. React's `Object.is` comparison sees `[] !== []`, causing a re-render that triggers Effect 4 (`setSelectedIndex(0)`). During the close cascade (Bug 4), this means Effect 4 fires multiple times for no reason.

### Bug 10: Module-level cache never expires entries (LOW)

**File**: `use-mixedbread-search.ts:50-51`, `188-193`

```tsx
const searchCache = new Map<string, { results: SearchResult[]; timestamp: number }>();
const CACHE_TTL = 60000;
```

Expired entries (older than `CACHE_TTL`) are never proactively cleaned up. The cache only evicts when it exceeds 50 entries, and even then only removes one entry. Stale entries persist indefinitely until pushed out by volume. On a long-lived SPA session this slowly leaks memory.

---

## useEffect Analysis

### Current Effects

| # | Location | Purpose | Dependencies | Can Remove? |
|---|----------|---------|-------------|-------------|
| 1 | `search.tsx:26-61` | Keyboard shortcuts | `[open, results, selectedIndex, router]` | No — needed |
| 2 | `search.tsx:64-84` | Debounced search | `[searchQuery, open, search, clearResults]` | No — needed, but overlaps with #3 |
| 3 | `search.tsx:88-98` | Reset on close | `[open, clearResults]` | **Yes — merge into close handler** |
| 4 | `search.tsx:101-103` | Reset selectedIndex | `[results]` | **Yes — derive or inline** |
| 5 | `hook:219-225` | Abort on unmount | `[]` | No — needed |

### Effect 3 (Reset on close) — REMOVABLE

This effect reactively resets state when `open` becomes `false`. Instead, this logic should run **imperatively** at the point where `open` is set to `false` — either in a `handleClose` wrapper function or directly in event handlers.

Reactive pattern (current):
```tsx
useEffect(() => {
  if (!open) { /* reset everything */ }
}, [open, clearResults]);
```

Imperative pattern (better):
```tsx
const handleClose = useCallback(() => {
  setOpen(false);
  setSearchQuery("");
  clearResults();
  setSelectedIndex(0);
  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = undefined;
  }
}, [clearResults]);
```

This eliminates: the cascade from `setSearchQuery("")` triggering Effect 2, the redundant `clearResults()` calls, and one full re-render cycle.

### Effect 4 (Reset selectedIndex) — REMOVABLE

This effect resets `selectedIndex` to 0 whenever `results` changes. This is a derived state reset that can be handled inline where results are set — either inside the `search()` callback or by resetting at the start of each search.

---

## Architecture Documentation

### Component Hierarchy

The Search component is rendered in a fixed wrapper in two layout files:

```
apps/docs/src/app/(docs)/docs/(general)/layout.tsx:21-22
apps/docs/src/app/(docs)/docs/(api)/layout.tsx:21-22

<div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
  <Search />
</div>
```

### Stacking Context

The parent wrapper creates a CSS stacking context via `transform -translate-x-1/2`. This means:

- **Wrapper**: `fixed z-50 transform` → stacking context at z-50 relative to viewport
- **Overlay** (portaled to body): `fixed z-40` → at document level
- **Popover.Content** (portaled to body): `z-50` → at document level

The wrapper's z-50 beats the overlay's z-40, so the input remains visible above the overlay. However, the `z-50` on the input container (`search.tsx:123`) is scoped within the wrapper's stacking context and doesn't compete with portaled elements directly.

### Data Flow

```
User types → searchQuery state → debounce effect (300ms) → search() callback
  → abort previous → fetch /api/search → transform results → deduplicate → setResults

/api/search (route.ts) → Mixedbread SDK → stores.search({query, store_identifiers, top_k: 10})
```

### Caching

Module-level `Map` in `use-mixedbread-search.ts:50` with 60s TTL and 50-entry soft cap. Cache key is `query.toLowerCase().trim()`. Cache is checked before fetch, updated after successful fetch.

---

## Code References

- `apps/docs/src/components/search.tsx` — Main search UI component (243 lines)
- `apps/docs/src/hooks/use-mixedbread-search.ts` — Search hook with caching and abort (235 lines)
- `apps/docs/src/app/api/search/route.ts` — Server route proxying to Mixedbread API (39 lines)
- `apps/docs/src/app/(docs)/docs/(general)/layout.tsx:21-22` — Search mount point (general docs)
- `apps/docs/src/app/(docs)/docs/(api)/layout.tsx:21-22` — Search mount point (API docs)

## Open Questions

- Should the search popover show a loading skeleton/spinner in the dropdown during fetch?
- Should the overlay only appear when the dropdown has content to show?
- Is the 300ms debounce optimal or should it be adjusted?
