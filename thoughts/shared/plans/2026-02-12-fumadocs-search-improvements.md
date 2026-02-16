# Fumadocs-Inspired Search Improvements Implementation Plan

## Overview

Integrate search patterns from Fumadocs into Lightfast docs: server-side Mixedbread optimizations (rerank, query rewriting, score threshold), POST→GET API migration for cacheability, client-side Map cache, consolidated debounce hook, `SortedResult` type hierarchy with heading deep-links, result type UI differentiation, and IME-safe keyboard handling.

## Current State Analysis

- **Route handler** (`apps/docs/src/app/(docs)/api/search/route.ts`): POST endpoint, Mixedbread SDK v0.50.1, no `search_options` (no rerank/rewrite/threshold), flat `SearchResult` type, URL built from `metadata.file_path`
- **Hook** (`apps/docs/src/hooks/use-docs-search.ts`): AbortController cancellation, debounce managed externally in the component (300ms setTimeout)
- **UI** (`apps/docs/src/components/search.tsx`): Radix Popover, flat result list, no result type differentiation, no IME handling, debounce logic mixed into component

### Key Discoveries:
- SDK v0.50.1 already supports `search_options.rerank`, `search_options.rewrite_query`, `search_options.score_threshold`, `search_options.return_metadata` (`stores.d.ts:211-238`)
- No `github-slugger` or `remove-markdown` packages in the monorepo — need to install in `apps/docs`
- `generated_metadata.url` is NOT populated, so keep the existing file-path URL building logic

## Desired End State

After implementation:
1. Search results are reranked and filtered by score threshold on the server
2. API uses GET with query params, enabling browser/CDN caching
3. Client caches repeated queries in-memory (Map)
4. Hook owns debounce (100ms) and state management; component is purely presentational
5. Results have `page`/`heading`/`text` types with heading deep-links (`#anchor`)
6. UI shows distinct icons/styling per result type
7. Keyboard navigation is IME-safe (`e.isComposing` check)

### Verification:
- `pnpm --filter docs typecheck` passes
- `pnpm --filter docs build` passes
- Search returns relevant results with heading deep-links
- Repeated identical queries are instant (cache hit)
- Keyboard navigation works with IME input methods

## What We're NOT Doing

- NOT using `generated_metadata.url` — keeping file-path URL building
- NOT adopting Fumadocs' composable Dialog architecture (keeping Popover)
- NOT adding content highlighting with `<mark>` tags (can be a follow-up)
- NOT adding locale/tag filtering support
- NOT switching to dynamic imports for code splitting (single backend)

## Implementation Approach

Three phases, each independently testable. Phase 1 is server-only (no client changes). Phase 2 refactors the client data layer. Phase 3 is UI-only.

---

## Phase 1: Server-Side — GET + Mixedbread Search Options + SortedResult Type

### Overview
Switch the API to GET, enable rerank/rewrite/threshold, introduce the `SortedResult` type with heading extraction.

### Changes Required:

#### 1. Install dependencies
**Directory**: `apps/docs/`

```bash
pnpm --filter docs add github-slugger remove-markdown
```

- `github-slugger` — generate consistent `#anchor` slugs from heading text
- `remove-markdown` — strip markdown syntax from heading text

#### 2. Rewrite route handler
**File**: `apps/docs/src/app/(docs)/api/search/route.ts`

Replace `POST` export with `GET`. Add `search_options`. Introduce `SortedResult` type and heading extraction.

```typescript
import type { NextRequest } from 'next/server';
import Mixedbread from '@mixedbread/sdk';
import GithubSlugger from 'github-slugger';
import removeMd from 'remove-markdown';
import { env } from '~/env';

export const runtime = 'edge';

const mxbaiClient = new Mixedbread({ apiKey: env.MXBAI_API_KEY });

// --- Types ---

interface MixedbreadMetadata {
  file_path?: string;
  synced?: boolean;
  git_branch?: string;
  git_commit?: string;
  uploaded_at?: string;
}

interface MixedbreadGeneratedMetadata {
  title?: string;
  description?: string;
  keywords?: string;
  type?: string;
  file_type?: string;
  language?: string;
  word_count?: number;
}

interface MixedbreadSearchItem {
  file_id: string;
  chunk_index: number;
  filename: string;
  score: number;
  text?: string;
  metadata?: MixedbreadMetadata;
  generated_metadata?: MixedbreadGeneratedMetadata;
}

export interface SortedResult {
  id: string;
  url: string;
  type: 'page' | 'heading' | 'text';
  content: string;
  source: string;
}

// --- Heading Extraction ---

function extractHeadingTitle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('#')) return '';
  const firstLine = trimmed.split('\n')[0]?.trim();
  if (!firstLine) return '';
  return removeMd(firstLine, { useImgAltText: false });
}

// --- URL Building (unchanged logic) ---

function buildUrl(filePath: string, filename: string): string {
  if (filePath) {
    if (filePath.includes('content/docs/')) {
      const pathPart = filePath.split('content/docs/')[1] ?? '';
      return '/docs/' + pathPart.replace(/\.mdx?$/, '').replace(/\/index$/, '');
    }
    if (filePath.includes('content/api/')) {
      const pathPart = filePath.split('content/api/')[1] ?? '';
      return '/docs/api/' + pathPart.replace(/\.mdx?$/, '').replace(/\/index$/, '');
    }
  }
  if (filename) {
    return '/docs/' + filename.replace(/\.mdx?$/, '');
  }
  return '#';
}

function buildSource(filePath: string): string {
  return filePath.includes('content/api/') ? 'API Reference' : 'Documentation';
}

// --- Transform ---

function transformResults(items: MixedbreadSearchItem[]): SortedResult[] {
  const slugger = new GithubSlugger();
  const results: SortedResult[] = [];

  for (const item of items) {
    const filePath = item.metadata?.file_path ?? '';
    const title =
      item.generated_metadata?.title ??
      item.filename.replace(/\.mdx?$/, '').replace(/-/g, ' ');
    const url = buildUrl(filePath, item.filename);
    const source = buildSource(filePath);

    // Page result
    results.push({
      id: `${item.file_id}-${item.chunk_index}-page`,
      type: 'page',
      content: title,
      url,
      source,
    });

    // Heading result (deep-link)
    if (item.text) {
      const headingTitle = extractHeadingTitle(item.text);
      if (headingTitle) {
        slugger.reset();
        results.push({
          id: `${item.file_id}-${item.chunk_index}-heading`,
          type: 'heading',
          content: headingTitle,
          url: `${url}#${slugger.slug(headingTitle)}`,
          source,
        });
      }
    }
  }

  // Deduplicate by URL, keeping first occurrence (highest score since Mixedbread returns sorted)
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

// --- GET Handler ---

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('query');

    if (!query?.trim()) {
      return Response.json([]);
    }

    const response = await mxbaiClient.stores.search({
      query,
      store_identifiers: [env.MXBAI_STORE_ID],
      top_k: 10,
      search_options: {
        rerank: true,
        rewrite_query: true,
        score_threshold: 0.5,
        return_metadata: true,
      },
    });

    const results = transformResults(response.data as MixedbreadSearchItem[]);

    return Response.json(results);
  } catch (error) {
    console.error('Search error:', error);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
```

Key changes:
- `POST` → `GET`, query from `searchParams` instead of body
- `search_options` with `rerank: true`, `rewrite_query: true`, `score_threshold: 0.5`
- Response is flat `SortedResult[]` (no `{ data: ... }` wrapper)
- `transformResults` produces `page` + `heading` pairs with `#anchor` deep-links
- Dedup uses `Set<string>` by URL

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter docs typecheck` passes
- [ ] `pnpm --filter docs build` passes
- [ ] `curl "http://localhost:4104/api/search?query=getting+started"` returns `SortedResult[]`

#### Manual Verification:
- [ ] Search results include heading deep-links that navigate to the correct section
- [ ] Results are visibly more relevant than before (rerank effect)
- [ ] Low-relevance noise is filtered out (score_threshold effect)

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Hook Refactor — Debounce, Cache, Interrupt Pattern

### Overview
Consolidate all search data logic into the hook: debounce (100ms), in-memory GET cache, interrupt-based stale result rejection. Component becomes purely presentational.

### Changes Required:

#### 1. Rewrite hook
**File**: `apps/docs/src/hooks/use-docs-search.ts`

```typescript
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SortedResult } from '~/app/(docs)/api/search/route';

// In-memory cache for GET requests (survives re-renders, cleared on page reload)
const queryCache = new Map<string, SortedResult[]>();

function useDebounce<T>(value: T, delayMs = 100): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    if (delayMs === 0) return;
    const handler = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(handler);
  }, [delayMs, value]);

  if (delayMs === 0) return value;
  return debouncedValue;
}

export function useDocsSearch(delayMs = 100) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SortedResult[] | 'empty'>('empty');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const debouncedQuery = useDebounce(search, delayMs);
  const onStartRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    // Cancel previous in-flight request
    if (onStartRef.current) {
      onStartRef.current();
      onStartRef.current = undefined;
    }

    if (!debouncedQuery.trim()) {
      setResults('empty');
      setIsLoading(false);
      setError(undefined);
      return;
    }

    setIsLoading(true);
    let interrupt = false;
    onStartRef.current = () => { interrupt = true; };

    const url = new URL('/api/search', window.location.origin);
    url.searchParams.set('query', debouncedQuery);
    const cacheKey = url.toString();

    // Check cache
    const cached = queryCache.get(cacheKey);
    if (cached) {
      setResults(cached);
      setIsLoading(false);
      setError(undefined);
      return;
    }

    void fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Search request failed');
        return res.json() as Promise<SortedResult[]>;
      })
      .then((data) => {
        if (interrupt) return;
        queryCache.set(cacheKey, data);
        setResults(data);
        setError(undefined);
      })
      .catch((err: Error) => {
        if (interrupt) return;
        setError(err);
        setResults('empty');
      })
      .finally(() => {
        if (!interrupt) setIsLoading(false);
      });
  }, [debouncedQuery]);

  const clearSearch = useCallback(() => {
    setSearch('');
    setResults('empty');
    setError(undefined);
  }, []);

  return { search, setSearch, clearSearch, results, isLoading, error };
}
```

Key changes:
- Hook owns `search`/`setSearch` state and debounce (100ms)
- `'empty'` sentinel distinguishes "no search" from "0 results"
- Interrupt-based cancellation (simpler than AbortController, still prevents stale results)
- In-memory `Map` cache by full URL string
- GET request (matches new server-side GET handler)
- No more `clearResults` — replaced by `clearSearch` which resets everything

#### 2. Update component to use new hook API
**File**: `apps/docs/src/components/search.tsx`

The component no longer manages debounce or search query state — the hook owns it. Key changes:

- Remove `searchQuery`/`setSearchQuery` state — use `search`/`setSearch` from hook
- Remove `debounceTimerRef` and debounce `useEffect` entirely
- Remove `hasSearched` state — use `results !== 'empty'` instead
- Adapt `results` checks: `results !== 'empty' && results.length > 0` instead of `results.length > 0`
- Call `clearSearch()` in `handleClose` instead of `clearResults()`

```typescript
"use client";

import { cn } from "@repo/ui/lib/utils";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@repo/ui/components/ui/input";
import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDocsSearch } from "~/hooks/use-docs-search";

export function Search() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const { search, setSearch, clearSearch, results, isLoading, error } =
    useDocsSearch();

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const resultsList = results === "empty" ? [] : results;

  const handleClose = useCallback(() => {
    setOpen(false);
    clearSearch();
    setSelectedIndex(0);
  }, [clearSearch]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // IME-safe: don't interfere with composition
      if (e.isComposing) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }

      const isInputFocused = document.activeElement === inputRef.current;

      if (open && resultsList.length > 0 && isInputFocused) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % resultsList.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex(
            (prev) => (prev - 1 + resultsList.length) % resultsList.length,
          );
        } else if (e.key === "Enter" && resultsList[selectedIndex]) {
          e.preventDefault();
          router.push(resultsList[selectedIndex].url);
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
  }, [open, resultsList, selectedIndex, router, handleClose]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Clear results when popover closes or search is empty while closed
  useEffect(() => {
    if (!open && search) {
      clearSearch();
    }
  }, [open, search, clearSearch]);

  const showResults =
    open && (resultsList.length > 0 || search.trim().length > 0 || error);

  return (
    <>
      {showResults &&
        createPortal(
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-md animate-in fade-in-0"
            onClick={() => handleClose()}
          />,
          document.body,
        )}

      <Popover.Root
        open={open}
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            handleClose();
            inputRef.current?.blur();
          } else {
            setOpen(true);
          }
        }}
      >
        <Popover.Anchor asChild>
          <div className={cn("relative", open && "z-50")}>
            <div className="relative flex items-center">
              <SearchIcon className="absolute left-3 h-4 w-4 text-foreground/60 pointer-events-none z-10" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search documentation"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setOpen(true)}
                className={cn(
                  "w-[420px] pl-10 pr-20 h-9",
                  "transition-all rounded-md border border-border/50",
                  "dark:bg-card/40 backdrop-blur-md",
                  "text-foreground/60",
                  "focus-visible:ring-0 focus-visible:ring-offset-0",
                  "focus-visible:outline-none focus:outline-none",
                  "focus-visible:border-border/50",
                )}
              />
              <div className="absolute right-2 flex items-center gap-1.5 pointer-events-none">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-foreground/60" />
                ) : (
                  <kbd className="hidden sm:inline-flex gap-1.5 px-1.5 py-0.5 items-center rounded-md border border-border text-sm font-medium text-foreground/60">
                    {open ? "ESC" : "⌘K"}
                  </kbd>
                )}
              </div>
            </div>
          </div>
        </Popover.Anchor>

        {showResults && (
          <Popover.Portal>
            <Popover.Content
              onOpenAutoFocus={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
              side="bottom"
              align="start"
              sideOffset={6}
              alignOffset={0}
              className={cn(
                "z-50",
                "bg-card/40 backdrop-blur-md",
                "border border-border/50 rounded-sm shadow",
                "max-h-[420px] overflow-y-auto",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              )}
              style={{ width: "var(--radix-popover-trigger-width)" }}
            >
              {error && (
                <div className="px-4 py-3 text-sm text-muted-foreground/70">
                  Unable to search at this time
                </div>
              )}

              {!error && isLoading && (
                <div className="px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground/70">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Searching...
                </div>
              )}

              {!error && !isLoading && resultsList.length === 0 && search.trim() && results !== "empty" && (
                <div className="px-4 py-3 text-sm text-muted-foreground/70">
                  No results
                </div>
              )}

              {/* Result items rendered here — Phase 3 updates styling */}
              {!error && resultsList.length > 0 && (
                <div className="">
                  {resultsList.map((result, index) => (
                    <Link
                      key={result.id}
                      href={result.url}
                      className={cn(
                        "block w-full px-4 py-2.5 text-left transition-colors",
                        "hover:bg-muted/40",
                        index === selectedIndex && "bg-muted/60",
                      )}
                      onClick={() => handleClose()}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="text-sm font-normal text-foreground">
                        {result.content}
                      </div>
                      {result.source && (
                        <div className="mt-0.5 text-xs text-muted-foreground/60">
                          {result.source}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}

              {!error && resultsList.length === 0 && !search && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground/50">
                    Start typing to search...
                  </p>
                </div>
              )}
            </Popover.Content>
          </Popover.Portal>
        )}
      </Popover.Root>
    </>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter docs typecheck` passes
- [ ] `pnpm --filter docs build` passes

#### Manual Verification:
- [ ] Search triggers after ~100ms of typing (noticeably faster than before)
- [ ] Typing rapidly doesn't cause result flicker (interrupt pattern works)
- [ ] Searching the same query twice is instant (cache hit)
- [ ] Closing and reopening search clears state properly
- [ ] Keyboard navigation (arrows, Enter, Escape) still works

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: UI — Result Type Differentiation

### Overview
Add visual differentiation for `page`, `heading`, and `text` result types with distinct icons and indentation.

### Changes Required:

#### 1. Update result rendering in search component
**File**: `apps/docs/src/components/search.tsx`

Add `FileText`, `Hash`, `Text` icons from lucide-react. Replace the flat result rendering block with type-aware rendering:

```typescript
import { Search as SearchIcon, Loader2, FileText, Hash, AlignLeft } from "lucide-react";

// Inside the results map, replace the Link content:
{resultsList.map((result, index) => (
  <Link
    key={result.id}
    href={result.url}
    className={cn(
      "flex items-start gap-3 w-full px-4 py-2.5 text-left transition-colors",
      "hover:bg-muted/40",
      index === selectedIndex && "bg-muted/60",
      result.type === "heading" && "pl-7",
    )}
    onClick={() => handleClose()}
    onMouseEnter={() => setSelectedIndex(index)}
  >
    <span className="mt-0.5 shrink-0 text-muted-foreground/50">
      {result.type === "page" && <FileText className="h-4 w-4" />}
      {result.type === "heading" && <Hash className="h-3.5 w-3.5" />}
      {result.type === "text" && <AlignLeft className="h-3.5 w-3.5" />}
    </span>
    <div className="min-w-0">
      <div className={cn(
        "text-sm text-foreground truncate",
        result.type === "page" && "font-medium",
        result.type !== "page" && "font-normal",
      )}>
        {result.content}
      </div>
      {result.type === "page" && result.source && (
        <div className="mt-0.5 text-xs text-muted-foreground/60">
          {result.source}
        </div>
      )}
    </div>
  </Link>
))}
```

Visual treatment:
- **Page results**: `FileText` icon, `font-medium`, source label below
- **Heading results**: `Hash` icon, indented (`pl-7`), normal weight, no source
- **Text results**: `AlignLeft` icon, indented, normal weight, no source

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter docs typecheck` passes
- [ ] `pnpm --filter docs build` passes

#### Manual Verification:
- [ ] Page results show document icon and bold title
- [ ] Heading results show hash icon, are indented, and link to `#anchor`
- [ ] Visual hierarchy is clear — pages are primary, headings are secondary
- [ ] Keyboard navigation works across all result types
- [ ] IME input (e.g., Japanese/Chinese) doesn't trigger keyboard shortcuts

---

## Testing Strategy

### Manual Testing Steps:
1. Search "getting started" — verify page + heading results appear with correct types
2. Click a heading result — verify it navigates to the correct `#anchor` on the page
3. Search the same query twice — verify second search is instant (cache)
4. Type rapidly "getting st" then immediately change to "api" — verify no stale results
5. Use Cmd+K to open, type, arrow down, Enter — verify full keyboard flow
6. Test with IME input method if available
7. Open Network tab — verify GET requests with `?query=` params
8. Test Escape key to close, verify state resets

## Performance Considerations

- **Rerank adds latency**: Mixedbread rerank adds ~50-100ms server-side, but results are significantly more relevant. The 100ms debounce reduction roughly offsets this.
- **Score threshold**: `0.5` is a starting point — may need tuning based on result quality. Too high = missing results, too low = noise.
- **GET caching**: Browsers may cache identical GET requests. The in-memory Map cache ensures instant repeat queries within the same session.
- **`rewrite_query`**: Adds slight latency but improves results for short/vague queries. Worth the tradeoff for a docs search.

## Dependencies

New packages for `apps/docs`:
- `github-slugger` — heading text → URL slug
- `remove-markdown` — strip markdown syntax from heading text

Both are small, well-maintained, and already used by Fumadocs.

## References

- Fumadocs research: `thoughts/shared/research/2026-02-12-fumadocs-search-integration.md`
- Mixedbread SDK types: `apps/docs/node_modules/@mixedbread/sdk/resources/stores/stores.d.ts:211-238`
- Current route handler: `apps/docs/src/app/(docs)/api/search/route.ts`
- Current hook: `apps/docs/src/hooks/use-docs-search.ts`
- Current UI: `apps/docs/src/components/search.tsx`
