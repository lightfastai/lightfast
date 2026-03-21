# Docs Search: Quick Wins + Medium Improvements

## Overview

Three incremental improvements to `apps/www` docs search: (1) decouple the `SortedResult` type from the API route file into its own types module, (2) forward relevance scores and text snippets already returned by MXBai but currently discarded, and (3) replace the manual Map cache + custom `useEffect` fetch logic with SWR for stale-while-revalidate UX (no flash-of-empty between keystrokes).

---

## Current State Analysis

All three source files are fully read and understood:

- **`apps/www/src/app/(docs)/api/search/route.ts`** (165 lines) — Edge runtime. Defines `SortedResult` type (line 41), calls `mxbaiClient.stores.search()` (line 146), runs `transformResults()` which extracts title + heading from each `MixedbreadSearchItem` and deduplicates by URL. Discards `item.score` and `item.text` (text truncation for snippet).
- **`apps/www/src/app/(docs)/_hooks/use-docs-search.ts`** (95 lines) — Imports `SortedResult` from the route file (line 4). Manual `useDebounce`, module-level `Map` cache, `AbortController` cancellation, four `useState` slices.
- **`apps/www/src/app/(docs)/_components/search.tsx`** (295 lines) — Renders title (`result.content`) and source label for `page` type (line 279). No snippet rendering. No score usage.

**Key findings:**
- `SortedResult` is declared in `route.ts:41` and imported by `use-docs-search.ts:4` via `~/app/(docs)/api/search/route` — server route file coupled to client hook.
- `MixedbreadSearchItem.score` (line 37) and `MixedbreadSearchItem.text` (line 38) are typed but not propagated into `SortedResult`.
- `item.text` is already consumed for heading extraction (line 111) but discarded for snippet purposes.
- `swr` is not in `apps/www/package.json` but is available in the monorepo lockfile.
- No `_types/` directory exists under `(docs)/`.

---

## Desired End State

After all three phases:
1. `SortedResult` lives in `(docs)/_types/search.ts` with `snippet?: string` and `score?: number` fields.
2. Search results in the popover show a two-line entry for `page` type: title on line 1, snippet text on line 2.
3. The hook no longer has a manually managed `Map` cache — SWR handles caching, dedup, and stale-while-revalidate. Old results remain visible while a new query loads (no flash-of-empty).

### Verification:
- `pnpm typecheck` passes (zero TypeScript errors)
- `pnpm check` passes (zero Biome errors)
- Searching "authentication" shows a snippet below the page title
- Typing quickly between two queries never shows a blank result list — previous results stay visible during loading

---

## What We're NOT Doing

- Two-layer search (Orama client-side index) — larger effort, separate initiative
- Explicit two-stage MXBai reranking pipeline (`stores.search` + `mxbai.rerank`) — adds latency, separate initiative
- SSE streaming of search results — MXBai `stores.search` is a single blocking call; no partial results to stream
- fumadocs `createMixedbreadSearchAPI` adoption — adds fumadocs type system coupling (`SortedResult` mismatch on `source` field) for minimal boilerplate reduction given our custom transform logic
- Score UI display (opacity or badge) — Phase 2 stores score in the type for future use; displaying it is a UX decision for a follow-up

---

## Phase 1: Type Decoupling

### Overview

Move `SortedResult` out of the route file and into a dedicated types file. Extend it with `snippet?: string` and `score?: number` (nullable so existing results without these fields still pass type-checking). Update both consumers.

### Changes Required

#### 1. Create `_types/search.ts`

**File**: `apps/www/src/app/(docs)/_types/search.ts` (new file)

```ts
export interface SortedResult {
  content: string;
  id: string;
  score?: number;
  snippet?: string;
  source: string;
  type: "page" | "heading" | "text";
  url: string;
}
```

#### 2. Update `route.ts` — remove local type, import from `_types`

**File**: `apps/www/src/app/(docs)/api/search/route.ts`

Remove lines 41-47 (the `export interface SortedResult { ... }` block).

Add import at the top of the file (after existing imports):

```ts
import type { SortedResult } from "~/(docs)/_types/search";
```

Wait — path alias. The `~` alias maps to `src/`. The correct path from `(docs)/api/search/route.ts` to `(docs)/_types/search.ts` using the `~` alias is:

```ts
import type { SortedResult } from "~/app/(docs)/_types/search";
```

#### 3. Update `use-docs-search.ts` — update import path

**File**: `apps/www/src/app/(docs)/_hooks/use-docs-search.ts`

Change line 4 from:
```ts
import type { SortedResult } from "~/app/(docs)/api/search/route";
```
to:
```ts
import type { SortedResult } from "~/app/(docs)/_types/search";
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @lightfast/www typecheck` passes with zero errors
- [x] `pnpm --filter @lightfast/www check` passes with zero Biome errors
- [x] `apps/www/src/app/(docs)/_types/search.ts` exists with `SortedResult` exported
- [x] `route.ts` no longer exports `SortedResult` (grep should find zero matches for `export interface SortedResult` in `route.ts`)

#### Manual Verification:
- [x] Search still works end-to-end in the browser (type a query, results appear)

---

## Phase 2: Score + Snippet Forwarding

### Overview

Populate the new `snippet` and `score` fields in `transformResults`. Update the search UI to render snippets below the title for `page` type results.

### Changes Required

#### 1. Update `transformResults` in `route.ts`

**File**: `apps/www/src/app/(docs)/api/search/route.ts`

Add a `buildSnippet` helper after `buildSource`:

```ts
const SNIPPET_MAX_CHARS = 120;

function buildSnippet(text: string | undefined): string | undefined {
  if (!text) return undefined;
  // Strip leading heading line if present
  const lines = text.trim().split("\n");
  const bodyLines = lines[0]?.startsWith("#") ? lines.slice(1) : lines;
  const body = bodyLines.join(" ").trim();
  if (!body) return undefined;
  const stripped = removeMd(body, { useImgAltText: false }).trim();
  if (!stripped) return undefined;
  return stripped.length > SNIPPET_MAX_CHARS
    ? `${stripped.slice(0, SNIPPET_MAX_CHARS)}…`
    : stripped;
}
```

Update the `page` result push in `transformResults` (currently lines 101-107) to populate both new fields:

```ts
// Page result — carry score and snippet from the MXBai item
results.push({
  id: `${item.file_id}-${item.chunk_index}-page`,
  type: "page",
  content: title,
  url,
  source,
  score: item.score,
  snippet: buildSnippet(item.text),
});
```

The `heading` result push does not get `snippet` or `score` — heading entries are already a sub-item under the page result; adding a snippet would make the list unnecessarily dense.

#### 2. Update `search.tsx` — render snippet

**File**: `apps/www/src/app/(docs)/_components/search.tsx`

In the result rendering block (around lines 269-283), add snippet rendering below `result.content` for `page` results that have a snippet. The existing structure is:

```tsx
<div className="min-w-0">
  <div className={cn(
    "truncate text-foreground text-sm",
    result.type === "page" && "font-medium",
    result.type !== "page" && "font-normal"
  )}>
    {result.content}
  </div>
  {result.type === "page" && result.source && (
    <div className="mt-0.5 text-muted-foreground/60 text-xs">
      {result.source}
    </div>
  )}
</div>
```

Update to:

```tsx
<div className="min-w-0">
  <div className={cn(
    "truncate text-foreground text-sm",
    result.type === "page" && "font-medium",
    result.type !== "page" && "font-normal"
  )}>
    {result.content}
  </div>
  {result.type === "page" && result.snippet && (
    <div className="mt-0.5 line-clamp-2 text-muted-foreground/60 text-xs">
      {result.snippet}
    </div>
  )}
  {result.type === "page" && !result.snippet && result.source && (
    <div className="mt-0.5 text-muted-foreground/60 text-xs">
      {result.source}
    </div>
  )}
</div>
```

Note: when a snippet is present it replaces the source label (snippet is more useful). When no snippet, source label shows as before. This preserves existing behaviour for results where `item.text` was empty or produced no useful body.

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @lightfast/www typecheck` passes
- [x] `pnpm --filter @lightfast/www check` passes
- [x] `buildSnippet` function exists in `route.ts` (grep check)
- [x] `score` and `snippet` fields populated in page result push (grep check)

#### Manual Verification:
- [x] Search "authentication" — page result shows a short snippet line below the title
- [x] Search a query where results have no body text — source label ("Documentation" / "API Reference") still shows
- [x] Heading results (indented with `#` icon) still render correctly, no snippet below them

---

## Phase 3: SWR Migration

### Overview

Replace the manual Map cache + `useEffect` fetch logic in `use-docs-search.ts` with `useSWR`. Primary UX gain: `keepPreviousData: true` keeps old results visible while a new query is in-flight, eliminating the flash-of-empty between keystrokes. Secondary gain: SWR's built-in deduplication prevents duplicate in-flight requests for the same query (replaces the manual `Map` cache).

The hook's external API (`{ search, setSearch, clearSearch, results, isLoading, error }`) is unchanged — `search.tsx` requires no modifications.

### Changes Required

#### 1. Add `swr` to `apps/www`

**File**: `apps/www/package.json`

Add to `dependencies`:
```json
"swr": "catalog:"
```

Check `pnpm-catalog` / root `package.json` to see if `swr` is in the catalog at version `2.4.1` (it is in the lockfile). If not in catalog, add the version directly:
```json
"swr": "^2.4.1"
```

Run `pnpm install` from repo root to wire up the dependency.

#### 2. Rewrite `use-docs-search.ts`

**File**: `apps/www/src/app/(docs)/_hooks/use-docs-search.ts`

Complete replacement:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import type { SortedResult } from "~/app/(docs)/_types/search";

function useDebounce<T>(value: T, delayMs = 100): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    if (delayMs === 0) {
      return;
    }
    const handler = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(handler);
  }, [delayMs, value]);

  if (delayMs === 0) {
    return value;
  }
  return debouncedValue;
}

async function searchFetcher(url: string): Promise<SortedResult[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Search request failed");
  }
  return res.json() as Promise<SortedResult[]>;
}

export function useDocsSearch(delayMs = 100) {
  const [search, setSearch] = useState("");
  const debouncedQuery = useDebounce(search, delayMs);

  const swrKey = debouncedQuery.trim()
    ? `/api/search?query=${encodeURIComponent(debouncedQuery)}`
    : null; // null = SWR does not fetch

  const { data, isLoading, error } = useSWR<SortedResult[], Error>(
    swrKey,
    searchFetcher,
    {
      keepPreviousData: true,     // old results visible while new query loads
      revalidateOnFocus: false,   // search results don't need focus revalidation
      dedupingInterval: 60_000,   // cache same query for 1 min (replaces Map cache)
    }
  );

  // Preserve the "empty" sentinel — null key means nothing was queried yet
  const results: SortedResult[] | "empty" = swrKey === null
    ? "empty"
    : data ?? "empty";

  const clearSearch = useCallback(() => {
    setSearch("");
  }, []);

  return { search, setSearch, clearSearch, results, isLoading, error };
}
```

**Key differences from current implementation:**

| Aspect | Before | After |
|---|---|---|
| Cache | Module-level `Map<string, SortedResult[]>` | SWR in-memory cache, `dedupingInterval: 60s` |
| Stale display | Flash of empty on new query | `keepPreviousData: true` — old results visible |
| AbortController | Manual, per-effect | SWR dedup prevents duplicate in-flight requests |
| `clearSearch` | Resets `results` + `error` state | Only resets `search`; SWR state clears via null key |
| `isLoading` | Manual `useState` | SWR-managed |
| `error` | `Error \| undefined` | `Error \| undefined` (same API surface) |

**Note on AbortController**: SWR 2.x does not pass an `AbortSignal` to fetchers by default. We drop explicit cancellation in favour of SWR's deduplication, which prevents race conditions by only applying the response for the current key. Explicit cancellation (network-level) is omitted as a deliberate trade-off — the main concern for search is UI correctness, not bandwidth optimization.

**Note on `clearSearch`**: The previous implementation explicitly reset `results` to `"empty"` and cleared `error` in `clearSearch`. In the SWR version, resetting `search` to `""` causes `debouncedQuery` to become `""`, which sets `swrKey` to `null`, which causes `results` to become `"empty"` (via the `swrKey === null` guard). `error` clears automatically as SWR does not carry error state across different keys.

### Success Criteria

#### Automated Verification:
- [x] `pnpm install` succeeds with `swr` in `apps/www/node_modules`
- [x] `pnpm --filter @lightfast/www typecheck` passes
- [x] `pnpm --filter @lightfast/www check` passes
- [x] `use-docs-search.ts` no longer contains `queryCache` or `AbortController` (grep check)
- [x] `use-docs-search.ts` imports `useSWR` (grep check)

#### Manual Verification:
- [x] Type quickly (e.g., "a" → "au" → "aut" → "auth") — previous results remain visible between keystrokes, no blank flash
- [x] Repeat a previous query — result appears instantly from SWR cache (no spinner)
- [x] Clear search input — results disappear immediately
- [x] Error state: with network devtools offline, search shows "Unable to search at this time"
- [x] `search.tsx` keyboard navigation (↑↓ Enter Esc) unaffected

---

## Testing Strategy

### Automated:
- Type check: `pnpm --filter @lightfast/www typecheck`
- Lint/format: `pnpm --filter @lightfast/www check`

### Manual Testing Steps (in order):
1. Start dev server: `pnpm dev:www`
2. Open `http://localhost:4101/docs` (or microfrontends port)
3. Press `⌘K` — search popover opens
4. Type "authentication" — results appear with snippet text below page titles
5. Type a single character, pause, then type more — no blank flash between results
6. Press `⌘K` again on mobile viewport — synthetic event still triggers search
7. Navigate results with arrow keys, Enter navigates to selected page
8. Press Esc — popover closes, search cleared
9. Repeat a previous query — instant result from cache (no spinner)

---

## References

- Research: `thoughts/shared/research/2026-03-21-use-docs-search-design-analysis.md`
- Hook: `apps/www/src/app/(docs)/_hooks/use-docs-search.ts:1-95`
- Route: `apps/www/src/app/(docs)/api/search/route.ts:1-165`
- Search UI: `apps/www/src/app/(docs)/_components/search.tsx:56-295`
- MXBai item type (with `score`, `text`): `route.ts:31-39`
- SWR `keepPreviousData` docs: https://swr.vercel.app/docs/advanced/understanding#return-previous-data-for-better-ux
