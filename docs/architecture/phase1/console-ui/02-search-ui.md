---
title: Search UI & Results
status: approved
audience: engineering, design
last_updated: 2025-11-10
---

# Search UI & Results (Phase 1)

Objectives
- Fast, simple results list with clear reasoning: titles, snippets, and subtle highlights.
- Minimal chrome; focus on readability and quick scanning.

API contract
- Request: `trpc.search.query({ query, topK, filters: { labels: ["store:<name>"] }, includeHighlights })`
- Implementation: api/console/src/router/search.ts:1
- Types: packages/console-types/src/api/search.ts:1

Result data (Phase 1)
- id, title, url, snippet, score, metadata
- Optional: `highlights` may be added later (Phase 1.1) for `<mark>`-wrapped content

Result card (UI)
- apps/console/src/components/search-result-card.tsx (new)
- Shows icon by type (document/issue/page) when available
- Title with optional highlighted fragments
- Snippet (3–4 lines) with highlights
- Source badge (Phase 1: GitHub only)
- Secondary metadata (repo name, recency) when present

Highlighting pattern (server-side)
- Wrap matched terms in `<mark>` tags; send as sanitized HTML fragments when `includeHighlights=true`.
- Keep the algorithm simple (term split + regex replace) until we add tokenizer-aware highlighting.

Snippeting pattern (server-side)
- Extract N words around the first match; prefix/suffix with ellipsis where trimmed.
- Fallback: first N words when no match segment is found.

Performance
- Debounce input by ~300ms.
- Memoize result cards by `result.id`.
- Paginate by 10; use “Load more” or infinite scroll.

Empty and loading
- Loading skeletons for 6–10 cards.
- Empty state with helpful tips.

Acceptance criteria
- Returns and renders at least 10 results for a popular query with visible snippets and titles.
- Highlights appear when enabled without rendering raw HTML risks.
- Infinite scroll or “Load more” fetches additional pages.

Phase 2 preview (not in Phase 1)
- Inline citations with hover previews
- Source filters (GitHub, Linear, Notion)
- Advanced filters (date, author, type)

