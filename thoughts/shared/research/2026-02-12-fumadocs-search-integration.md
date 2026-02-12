---
date: 2026-02-12T16:37:58+1100
researcher: claude
git_commit: 7e5a1c51ccd74f72099eafdaa6c8bded05a42048
branch: feat/landing-page-grid-rework
repository: lightfast-search-perf-improvements
topic: "Fumadocs search implementation analysis for integration into Lightfast docs"
tags: [research, codebase, search, fumadocs, mixedbread, docs]
status: complete
last_updated: 2026-02-12
last_updated_by: claude
---

# Research: Fumadocs Search Implementation for Lightfast Integration

**Date**: 2026-02-12T16:37:58+1100
**Researcher**: claude
**Git Commit**: 7e5a1c51
**Branch**: feat/landing-page-grid-rework
**Repository**: lightfast-search-perf-improvements

## Research Question

Clone fumadocs and analyze their `useDocsSearch` hook, Mixedbread SDK integration (route.ts + transformer), and search UI to extract everything that can integrate into:
- `apps/docs/src/components/search.tsx`
- `apps/docs/src/hooks/use-docs-search.ts`
- `apps/docs/src/app/(docs)/api/search/route.ts`

## Summary

Fumadocs provides a mature, multi-backend search system with a unified `useDocsSearch` hook, server-side Mixedbread integration via `createMixedbreadSearchAPI()`, and a composable search UI. The key differences from Lightfast's current implementation are: (1) an interrupt-based cancellation pattern instead of AbortController, (2) a `SortedResult` type system with page/heading/text result types, (3) server-side Mixedbread SDK usage with `rerank`, `rewrite_query`, and `score_threshold` options, (4) a `fetch`-based client pattern with GET request caching, (5) heading extraction from chunk text for deep-link results, and (6) content highlighting via remark.

---

## Detailed Findings

### 1. Fumadocs `useDocsSearch` Hook

**File**: `/tmp/repos/fumadocs/packages/core/src/search/client.ts`

The hook manages search state, debouncing, and backend dispatch in a single composable unit.

#### State Management (lines 90-95)
```typescript
const [search, setSearch] = useState('');
const [results, setResults] = useState<SortedResult[] | 'empty'>('empty');
const [error, setError] = useState<Error>();
const [isLoading, setIsLoading] = useState(false);
const debouncedValue = useDebounce(search, delayMs);
const onStart = useRef<() => void>(undefined);
```

- Uses `'empty'` sentinel value to distinguish "no search performed" from "search returned 0 results"
- Debounce defaults to 100ms (Lightfast uses 300ms)
- Exposes `search`/`setSearch` directly (Lightfast manages input state separately in the component)

#### Return Interface (lines 12-20)
```typescript
interface UseDocsSearch {
  search: string;
  setSearch: (v: string) => void;
  query: {
    isLoading: boolean;
    data?: SortedResult[] | 'empty';
    error?: Error;
  };
}
```

#### Interrupt-Based Cancellation (lines 97-155)

Instead of AbortController, fumadocs uses a boolean interrupt flag:

```typescript
useOnChange([deps ?? clientOptions, debouncedValue], () => {
  // Cancel previous search
  if (onStart.current) {
    onStart.current();
    onStart.current = undefined;
  }

  setIsLoading(true);
  let interrupt = false;
  onStart.current = () => { interrupt = true; };

  void run()
    .then((res) => {
      if (interrupt) return;  // Ignore stale results
      setError(undefined);
      setResults(res);
    })
    .catch((err: Error) => { setError(err); })
    .finally(() => { setIsLoading(false); });
});
```

This pattern is simpler than AbortController but doesn't cancel the actual network request.

#### `useDebounce` Utility (`/tmp/repos/fumadocs/packages/core/src/utils/use-debounce.ts`)
```typescript
export function useDebounce<T>(value: T, delayMs = 1000): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    if (delayMs === 0) return;
    const handler = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(handler);
  }, [delayMs, value]);
  if (delayMs === 0) return value;
  return debouncedValue;
}
```

#### `useOnChange` Utility (`/tmp/repos/fumadocs/packages/core/src/utils/use-on-change.ts`)

Runs during render (not in useEffect) to detect dependency changes:

```typescript
export function useOnChange<T>(
  value: T,
  onChange: (current: T, previous: T) => void,
  isUpdated: (prev: T, current: T) => boolean = isDifferent,
): void {
  const [prev, setPrev] = useState<T>(value);
  if (isUpdated(prev, value)) {
    onChange(value, prev);
    setPrev(value);
  }
}
```

#### Dynamic Import for Code Splitting (lines 111-141)

Each backend is dynamically imported only when used:
```typescript
case 'mixedbread': {
  const { search } = await import('./client/mixedbread');
  return search(debouncedValue, client);
}
case 'fetch': {
  const { fetchDocs } = await import('./client/fetch');
  return fetchDocs(debouncedValue, client);
}
```

---

### 2. Fumadocs Fetch Client (GET with Caching)

**File**: `/tmp/repos/fumadocs/packages/core/src/search/client/fetch.ts`

The recommended pattern for Mixedbread: use `fetch` client on the frontend, `createMixedbreadSearchAPI` on the server.

```typescript
const cache = new Map<string, SortedResult[]>();

export async function fetchDocs(
  query: string,
  { api = '/api/search', locale, tag }: FetchOptions,
): Promise<SortedResult[]> {
  const url = new URL(api, window.location.origin);
  url.searchParams.set('query', query);
  if (locale) url.searchParams.set('locale', locale);
  if (tag) url.searchParams.set('tag', Array.isArray(tag) ? tag.join(',') : tag);

  const key = url.toString();
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  const result = (await res.json()) as SortedResult[];
  cache.set(key, result);
  return result;
}
```

Key differences from Lightfast:
- Uses **GET** requests (cacheable, CDN-friendly) vs Lightfast's POST
- Has in-memory **Map cache** for identical queries
- Returns `SortedResult[]` directly (no `{ data: ... }` wrapper)
- No AbortController on the fetch itself

---

### 3. Fumadocs Server-Side Mixedbread API (`createMixedbreadSearchAPI`)

**File**: `/tmp/repos/fumadocs/packages/core/src/search/mixedbread.ts`

This is the recommended server-side approach that keeps the API key secure.

#### Configuration Interface (lines 20-59)
```typescript
export interface MixedbreadSearchOptions {
  client: Mixedbread;              // SDK instance
  storeIdentifier: string;         // Store ID
  topK?: number;                   // Default 10
  rerank?: boolean;                // Default true
  rewriteQuery?: boolean;          // Query rewriting
  scoreThreshold?: number;         // Min relevance score
  transform?: (results: StoreSearchResult[], query: string) => SortedResult[];
}
```

Notable options Lightfast doesn't use:
- **`rerank: true`** (default) - re-ranks results for better relevance
- **`rewriteQuery`** - rewrites query for better semantic matching
- **`scoreThreshold`** - filters low-relevance results
- **`transform`** - custom result transformer

#### API Creation (lines 115-176)

```typescript
export function createMixedbreadSearchAPI(options: MixedbreadSearchOptions): SearchAPI {
  return createEndpoint({
    async search(query, searchOptions) {
      if (!query.trim()) return [];

      // Tag filtering
      const tag = searchOptions?.tag;
      let filters: StoreSearchParams['filters'] | undefined;
      if (Array.isArray(tag) && tag.length > 0) {
        filters = { key: 'generated_metadata.tag', operator: 'in', value: tag };
      } else if (typeof tag === 'string') {
        filters = { key: 'generated_metadata.tag', operator: 'eq', value: tag };
      }

      const res = await client.stores.search({
        query,
        store_identifiers: [storeIdentifier],
        top_k: topK,
        filters,
        search_options: {
          return_metadata: true,
          rerank,
          rewrite_query: rewriteQuery,
          score_threshold: scoreThreshold,
        },
      });

      return transform ? transform(res.data, query) : defaultTransform(res.data);
    },
    async export() { throw new Error('Not supported'); },
  });
}
```

#### Endpoint Wrapper (`/tmp/repos/fumadocs/packages/core/src/search/orama/create-endpoint.ts`)

Wraps a SearchServer into Next.js route handlers using **GET**:

```typescript
export function createEndpoint(server: SearchServer): SearchAPI {
  return {
    ...server,
    async staticGET() { return Response.json(await server.export()); },
    async GET(request) {
      const url = new URL(request.url);
      const query = url.searchParams.get('query');
      if (!query) return Response.json([]);
      return Response.json(
        await search(query, {
          tag: url.searchParams.get('tag')?.split(',') ?? undefined,
          locale: url.searchParams.get('locale') ?? undefined,
        }),
      );
    },
  };
}
```

The pattern: `export const { GET } = createMixedbreadSearchAPI({ ... })` in `route.ts`.

---

### 4. Fumadocs Result Transformer (`defaultTransform`)

**File**: `/tmp/repos/fumadocs/packages/core/src/search/mixedbread.ts:82-113`

Transforms Mixedbread results into `SortedResult[]` with page and heading results:

```typescript
function defaultTransform(results: StoreSearchResult[]): SortedResult[] {
  return results.flatMap((item) => {
    const metadata = item.generated_metadata;
    const url = metadata.url || '#';
    const title = metadata.title || 'Untitled';

    const chunkResults: SortedResult[] = [{
      id: `${item.file_id}-${item.chunk_index}-page`,
      type: 'page',
      content: title,
      url,
    }];

    // Extract heading from markdown chunk text
    const headingTitle = item.type === 'text' ? extractHeadingTitle(item.text) : '';
    if (headingTitle) {
      slugger.reset();
      chunkResults.push({
        id: `${item.file_id}-${item.chunk_index}-heading`,
        type: 'heading',
        content: headingTitle,
        url: `${url}#${slugger.slug(headingTitle)}`,
      });
    }

    return chunkResults;
  });
}
```

#### Heading Extraction (lines 63-80)

```typescript
function extractHeadingTitle(text: string): string {
  const trimmedText = text.trim();
  if (!trimmedText.startsWith('#')) return '';

  const lines = trimmedText.split('\n');
  const firstLine = lines[0]?.trim();
  if (firstLine) {
    return removeMd(firstLine, { useImgAltText: false });
  }
  return '';
}
```

Uses `remove-markdown` to strip syntax and `github-slugger` for anchor generation.

#### SearchMetadata Interface (lines 9-14)
```typescript
export interface SearchMetadata {
  title?: string;
  description?: string;
  url?: string;
  tag?: string;
}
```

Fumadocs relies on `generated_metadata` from Mixedbread (title, description, url, tag) rather than building URLs from file paths like Lightfast does.

---

### 5. Fumadocs `SortedResult` Type System

**File**: `/tmp/repos/fumadocs/packages/core/src/search/index.ts:7-21`

```typescript
export interface SortedResult<Content = string> {
  id: string;
  url: string;
  type: 'page' | 'heading' | 'text';
  content: Content;
  breadcrumbs?: Content[];
}
```

Three result types:
- **`page`**: Top-level page result (title, URL)
- **`heading`**: Section within a page (heading text, URL with `#anchor`)
- **`text`**: Content snippet within a page

This is more granular than Lightfast's flat `SearchResult` which only has `title`, `url`, `source`.

---

### 6. Content Highlighting System

**File**: `/tmp/repos/fumadocs/packages/core/src/search/index.ts:53-129`

```typescript
export function createContentHighlighter(query: string | RegExp) {
  const regex = typeof query === 'string' ? buildRegexFromQuery(query) : query;
  // ... returns { highlight(), highlightMarkdown() }
}

function buildRegexFromQuery(q: string): RegExp | null {
  const terms = Array.from(new Set(q.trim().split(/\s+/).filter(Boolean)));
  if (terms.length === 0) return null;
  return new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
}
```

Two methods:
- `highlight(content)` - returns `HighlightedText[]` array with `styles.highlight` flags
- `highlightMarkdown(content)` - wraps matches in `<mark>` tags using remark

---

### 7. Fumadocs Search UI Patterns

**File**: `/tmp/repos/fumadocs/packages/base-ui/src/components/dialog/search.tsx`

Key patterns from the UI layer:

#### Composable Architecture
- `SearchDialog` (root) > `SearchDialogContent` > `SearchDialogHeader` + `SearchDialogList`
- State shared via React context (RootContext, ListContext, TagsListContext)
- Each piece independently customizable

#### Keyboard Navigation (lines 322-354)
- Arrow keys navigate through results with modulo wrap-around
- Enter selects the active item
- Checks `e.isComposing` to avoid interfering with IME input
- Uses `scroll-into-view-if-needed` for auto-scrolling active items

#### Result Item Types (lines 415-494)
- Different visual treatment per result type (page, heading, text)
- Page results show breadcrumbs
- Heading results show hash icon + vertical line
- Text results are lighter/indented
- Markdown content rendered with `<mark>` tag highlighting

#### Search Provider Context (`/tmp/repos/fumadocs/packages/base-ui/src/contexts/search.tsx`)
- Global hotkey management (Cmd/Ctrl+K)
- Lazy loads dialog component with Suspense
- Only renders dialog after first open

---

## Comparison: Lightfast vs Fumadocs

| Feature | Lightfast Current | Fumadocs |
|---------|------------------|----------|
| **Hook** | Custom with AbortController | `useDocsSearch` with interrupt flag |
| **Debounce** | 300ms manual setTimeout | 100ms `useDebounce` hook |
| **API Method** | POST `/api/search` | GET `/api/search?query=...` (cacheable) |
| **Caching** | None | In-memory Map by URL |
| **Result Type** | Flat `{ id, title, url, source }` | Typed `{ id, url, type, content, breadcrumbs }` |
| **Result Types** | Single flat list | `page` / `heading` / `text` hierarchy |
| **Heading Deep Links** | None | Extracts headings, generates `#anchor` URLs |
| **Rerank** | Not used | `rerank: true` (default) |
| **Query Rewrite** | Not used | Optional `rewrite_query` |
| **Score Threshold** | Not used | Optional `score_threshold` |
| **URL Building** | File path parsing | Uses `generated_metadata.url` |
| **Highlighting** | None | `createContentHighlighter` with `<mark>` tags |
| **Deduplication** | By URL (Map) | By page (flatMap with page+heading pairs) |
| **UI Pattern** | Popover with custom overlay | Dialog with composable components |
| **IME Handling** | None | `e.isComposing` check |

---

## Code References

- **Fumadocs useDocsSearch**: `/tmp/repos/fumadocs/packages/core/src/search/client.ts:70-161`
- **Fumadocs useDebounce**: `/tmp/repos/fumadocs/packages/core/src/utils/use-debounce.ts:3-17`
- **Fumadocs useOnChange**: `/tmp/repos/fumadocs/packages/core/src/utils/use-on-change.ts:16-27`
- **Fumadocs fetch client**: `/tmp/repos/fumadocs/packages/core/src/search/client/fetch.ts:24-42`
- **Fumadocs mixedbread server**: `/tmp/repos/fumadocs/packages/core/src/search/mixedbread.ts:115-176`
- **Fumadocs defaultTransform**: `/tmp/repos/fumadocs/packages/core/src/search/mixedbread.ts:82-113`
- **Fumadocs extractHeadingTitle**: `/tmp/repos/fumadocs/packages/core/src/search/mixedbread.ts:63-80`
- **Fumadocs SortedResult type**: `/tmp/repos/fumadocs/packages/core/src/search/index.ts:7-21`
- **Fumadocs content highlighter**: `/tmp/repos/fumadocs/packages/core/src/search/index.ts:53-103`
- **Fumadocs createEndpoint**: `/tmp/repos/fumadocs/packages/core/src/search/orama/create-endpoint.ts:3-25`
- **Fumadocs search dialog**: `/tmp/repos/fumadocs/packages/base-ui/src/components/dialog/search.tsx`
- **Lightfast search component**: `apps/docs/src/components/search.tsx:13-237`
- **Lightfast search hook**: `apps/docs/src/hooks/use-docs-search.ts:15-81`
- **Lightfast search route**: `apps/docs/src/app/(docs)/api/search/route.ts:105-129`

## Architecture Documentation

### Fumadocs Search Architecture
```
Client Side:
  useDocsSearch(type:'fetch') → useDebounce → fetchDocs(GET /api/search?query=...)
                                                     ↓ (in-memory cache)
                                               SortedResult[]

Server Side:
  route.ts: export const { GET } = createMixedbreadSearchAPI({ client, storeId, rerank, ... })
                                         ↓
  createEndpoint() wraps search() into GET handler
                                         ↓
  search(query) → mxbai.stores.search({ rerank, rewrite_query, score_threshold })
                                         ↓
  defaultTransform() → SortedResult[] (page + heading pairs)
```

### Lightfast Current Architecture
```
Client Side:
  Search component → useDocsSearch.search(query) → POST /api/search
                   ↓ (AbortController)              ↓
             SearchResult[]                   transformResults()

Server Side:
  route.ts POST handler → mxbai.stores.search({ top_k: 10 })
                                    ↓
  transformResults() → deduplicate by URL → SearchResult[]
```

## Open Questions

1. Does Lightfast's Mixedbread store have `generated_metadata.url` populated? If so, the file-path URL building in `route.ts` could be simplified.
2. Should Lightfast enable `rerank: true` on the Mixedbread search call? Fumadocs defaults this on for better relevance.
3. Is `rewrite_query` worth enabling? It may improve results for short/vague queries.
4. Should the API be switched from POST to GET to enable browser/CDN caching and the Map-cache pattern?
5. Should heading extraction be added to provide deep-link search results (URL with `#anchor`)?
6. Should the `SortedResult` type hierarchy (page/heading/text) be adopted for richer UI differentiation?
