# Search Prompt & Results Display Specification

Last Updated: 2025-11-09

Based on research of Exa AI, Perplexity AI, Algolia InstantSearch, and modern semantic search best practices.

---

## Research Findings

### Key Insights from Industry Leaders

**Exa AI:**
- Neural search (embeddings-based) + keyword search hybrid
- Rich result metadata: highlights, summaries, text snippets
- "Find similar" action for related content discovery
- Category filtering (research papers, news, PDFs, GitHub, tweets, LinkedIn)
- Temporal filtering (start/end dates)

**Perplexity AI:**
- **Inline citations** [1][2][3] within answers
- Hover-to-preview source snippets
- Average 5.28 citations per response
- Transparent sourcing builds trust
- Citations link to specific source material, not just domains

**Algolia InstantSearch:**
- **Highlighting**: Style matched query words (`<mark>` tags)
- **Snippeting**: Return context around matches (configurable word count)
- **Ellipsis handling**: "...matched text..." for long content
- **Attribute-level control**: Highlight different fields separately

**Semantic Search Best Practices:**
- Understand intent, not just keywords
- Show WHY a result matched (highlights, relevance explanation)
- Provide context around matches
- Multiple content types (documents, issues, pages, observations)
- Recency indicators ("2 hours ago", "last week")

---

## Result Card Architecture

**Exa-inspired card structure with Perplexity-style citations:**

```typescript
interface SearchResult {
  // Core metadata
  id: string;
  type: "document" | "issue" | "page" | "observation";
  title: string;
  url: string;
  source: "github" | "linear" | "notion";

  // Content
  content: string;              // Full text
  snippet?: string;             // Highlighted excerpt
  highlights?: Highlight[];     // Specific matched sections

  // Context
  repository?: string;           // "lightfastai/lightfast"
  author?: string;              // "jeevan"
  publishedDate?: string;       // ISO date
  lastModified?: string;        // ISO date

  // Relevance
  score: number;                // 0-1 relevance score
  matchReason?: string;         // "Mentions 'authentication' in title and content"

  // Citations (Phase 2)
  citations?: Citation[];       // Related documents/issues
}

interface Highlight {
  attribute: "title" | "content" | "description";
  value: string;                 // HTML with <mark> tags
  matchedTerms: string[];       // ["authentication", "auth"]
}
```

---

## Result Card Component

```tsx
// apps/console/src/components/search-result-card.tsx
"use client";

import { memo } from "react";
import { formatDistanceToNow } from "date-fns";
import { FileText, GitPullRequest, FileCode, Brain } from "lucide-react";

export const SearchResultCard = memo(({ result, query }) => {
  // Icon based on type
  const Icon = {
    document: FileText,
    issue: GitPullRequest,
    page: FileCode,
    observation: Brain,
  }[result.type];

  // Source badge color
  const sourceBadge = {
    github: "bg-gray-900 text-white",
    linear: "bg-blue-600 text-white",
    notion: "bg-black text-white",
  }[result.source];

  return (
    <div className="group rounded-lg border border-border/50 bg-card p-4 hover:border-border hover:bg-card/80 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-md bg-muted/50 flex items-center justify-center">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Title and metadata */}
        <div className="flex-1 min-w-0">
          <a
            href={result.url}
            className="font-medium text-sm text-foreground hover:text-primary transition-colors line-clamp-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* Highlight title if it has highlights */}
            {result.highlights?.find(h => h.attribute === "title") ? (
              <span dangerouslySetInnerHTML={{
                __html: result.highlights.find(h => h.attribute === "title")!.value
              }} />
            ) : (
              result.title
            )}
          </a>

          {/* Metadata row */}
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            {/* Source badge */}
            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", sourceBadge)}>
              {result.source === "github" && "GitHub"}
              {result.source === "linear" && "Linear"}
              {result.source === "notion" && "Notion"}
            </span>

            {/* Repository/source name */}
            {result.repository && (
              <>
                <span>·</span>
                <span>{result.repository}</span>
              </>
            )}

            {/* Author */}
            {result.author && (
              <>
                <span>·</span>
                <span>by {result.author}</span>
              </>
            )}

            {/* Date */}
            {result.publishedDate && (
              <>
                <span>·</span>
                <span>{formatDistanceToNow(new Date(result.publishedDate), { addSuffix: true })}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Snippet/Highlight */}
      {result.snippet && (
        <div className="text-sm text-muted-foreground line-clamp-3 mb-3">
          {result.highlights?.find(h => h.attribute === "content") ? (
            <span dangerouslySetInnerHTML={{
              __html: result.highlights.find(h => h.attribute === "content")!.value
            }} />
          ) : (
            result.snippet
          )}
        </div>
      )}

      {/* Match reason (why this result matched) */}
      {result.matchReason && (
        <div className="text-xs text-muted-foreground/80 italic mb-3">
          💡 {result.matchReason}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Find similar
        </button>
        <span className="text-muted-foreground">·</span>
        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Copy link
        </button>
      </div>
    </div>
  );
});
```

---

## Highlighting Pattern (Algolia-style)

**Backend: Wrap matched terms in `<mark>` tags**

```typescript
// api/console/src/router/search.ts
function highlightMatches(text: string, query: string): string {
  const terms = query.toLowerCase().split(/\s+/);
  let highlighted = text;

  terms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  });

  return highlighted;
}

// Example usage in search endpoint
const results = await searchDocuments(query);
const highlightedResults = results.map(result => ({
  ...result,
  highlights: [
    {
      attribute: "title",
      value: highlightMatches(result.title, query),
      matchedTerms: extractMatchedTerms(result.title, query),
    },
    {
      attribute: "content",
      value: highlightMatches(result.snippet, query),
      matchedTerms: extractMatchedTerms(result.snippet, query),
    },
  ],
}));
```

**Frontend: Render with `dangerouslySetInnerHTML` (sanitized)**

```tsx
// Highlight component
<span
  className="[&_mark]:bg-yellow-200/80 [&_mark]:text-foreground [&_mark]:font-medium [&_mark]:px-0.5 [&_mark]:rounded"
  dangerouslySetInnerHTML={{ __html: highlight.value }}
/>
```

**CSS for `<mark>` tags:**

```css
mark {
  background-color: rgb(254 240 138 / 0.8); /* yellow-200/80 */
  color: inherit;
  font-weight: 500;
  padding: 0 2px;
  border-radius: 2px;
}
```

---

## Snippeting Pattern (Algolia-style)

**Backend: Extract context around matches**

```typescript
function createSnippet(
  text: string,
  query: string,
  options = { maxLength: 200, contextWords: 10 }
): string {
  const terms = query.toLowerCase().split(/\s+/);
  const words = text.split(/\s+/);

  // Find first match position
  let matchIndex = -1;
  for (let i = 0; i < words.length; i++) {
    if (terms.some(term => words[i].toLowerCase().includes(term))) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex === -1) {
    // No match, return first N words
    return words.slice(0, options.maxLength / 10).join(" ") + "...";
  }

  // Extract context around match
  const start = Math.max(0, matchIndex - options.contextWords);
  const end = Math.min(words.length, matchIndex + options.contextWords);

  let snippet = "";
  if (start > 0) snippet += "...";
  snippet += words.slice(start, end).join(" ");
  if (end < words.length) snippet += "...";

  return snippet;
}
```

---

## Results Layout

### List View (Default)

```
┌────────────────────────────────────────────────────┐
│ Found 42 results for "authentication flow"        │
├────────────────────────────────────────────────────┤
│                                                    │
│ [Result Card 1]                                    │
│                                                    │
│ [Result Card 2]                                    │
│                                                    │
│ [Result Card 3]                                    │
│                                                    │
│ [Load More]                                        │
└────────────────────────────────────────────────────┘
```

**Infinite scroll or "Load More" button:**
- Start with 10 results
- Load 10 more on scroll/click
- Show loading skeleton while fetching

### Empty State

```
┌────────────────────────────────────────────────────┐
│                                                    │
│              🔍                                    │
│                                                    │
│     No results found for "xyz123abc"               │
│                                                    │
│     Try:                                           │
│     • Using different keywords                     │
│     • Checking for typos                           │
│     • Using broader search terms                   │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## Performance Optimizations

### 1. Debounced Search

```tsx
const [searchQuery, setSearchQuery] = useState("");
const [debouncedQuery] = useDebounce(searchQuery, 300);

useEffect(() => {
  if (debouncedQuery.length >= 3) {
    performSearch(debouncedQuery);
  }
}, [debouncedQuery]);
```

### 2. Memoized Result Cards

```tsx
const SearchResultCard = memo(({ result }) => {
  // Card implementation
}, (prevProps, nextProps) => {
  return prevProps.result.id === nextProps.result.id;
});
```

---

## Summary

### Key Patterns from Research

1. **Exa**: Hybrid search (neural + keyword), rich metadata, "find similar" action
2. **Perplexity**: Inline citations with hover previews, transparent sourcing
3. **Algolia**: Highlighting matched terms, snippeting with context, ellipsis handling
4. **Semantic Search**: Intent understanding, relevance explanations, multiple content types

### Implementation Priorities

**Phase 1 (MVP):**
- ✅ Basic search prompt (already exists)
- 🔨 Result cards with highlights
- 🔨 Snippeting around matches
- 🔨 Source badges (GitHub icon)
- 🔨 Recency indicators
- 🔨 "Find similar" action

**Phase 2 (Enhanced):**
- Inline citations with hover previews
- Multi-source filtering (GitHub, Linear, Notion)
- Match reason explanations
- Search mode toggle (neural/keyword/auto)
- Advanced filters (date, author, type)
