# Console UI Architecture (Phase 1)

Last Updated: 2025-11-09

---

## Overview

This directory contains UI/UX specifications for the Lightfast Console application. All specs are documentation-only (no implementation) and follow research-driven design patterns from industry leaders.

---

## Files

### [ui-structure.md](./ui-structure.md)

**Minimal navigation architecture**

**What's inside:**
- Three-component design: Search, Settings, View Config dialog
- No horizontal tabs or sidebars (super simple)
- Workspace handling (Phase 1: transparent, Phase 2: switcher)

**Key decisions:**
- Landing page = Search (centered chat interface)
- Settings with sidebar (existing pattern)
- Config dialog shows repository's `lightfast.yml`

---

### [jobs-tracking.md](./jobs-tracking.md)

**Background job monitoring**

**What's inside:**
- Inngest API integration (no database changes)
- Jobs tab using shadcn Tabs component
- Running vs completed job tracking

**Key decisions:**
- Use Inngest API for active job status (no DB migration)
- Poll every 3s for real-time updates
- Query `ingestion_commits` table for history

**Implementation:**
- Jobs list with progress bars
- Status indicators (running, completed, failed)
- Retry actions for failed jobs

---

### [search-results.md](./search-results.md)

**Search prompt and results display**

**What's inside:**
- Research findings from Exa, Perplexity, Algolia
- Result card design with highlights and citations
- Snippeting and highlighting patterns

**Key decisions:**
- Exa-style result cards with metadata
- Perplexity-style inline citations (Phase 2)
- Algolia-style `<mark>` tag highlighting

**Features:**
- Highlighted matched terms
- Snippet context around matches
- Source badges (GitHub, Linear, Notion)
- "Find similar" action
- Match reason explanations

---

## Design Principles

### 1. Research-Driven

All specs based on industry best practices:
- **Exa AI**: Hybrid search, rich metadata
- **Perplexity AI**: Inline citations, transparent sourcing
- **Algolia**: Highlighting, snippeting patterns
- **Semantic search**: Intent understanding, relevance indicators

### 2. Progressive Complexity

**Phase 1 (Simple):**
- Single workspace (transparent)
- GitHub-only search
- Basic result cards

**Phase 2 (Enhanced):**
- Multi-workspace switcher
- Multi-source (GitHub + Linear + Notion)
- Citations and cross-references

### 3. Developer-Focused

Built for teams:
- Fast, accurate search
- Clear source attribution
- Repository context
- Ingestion job visibility

---

## Navigation Structure

```
Console App
├── Search (/)                      # Landing page - chat interface
│   ├── Prompt input
│   ├── Repository selector
│   ├── Jobs tab (shadcn Tabs)
│   └── Results list
│
├── Settings (/settings/*)          # Configuration pages
│   ├── GitHub Integration
│   ├── Repositories
│   └── Workspace (Phase 2)
│
└── Config Dialog                   # Modal overlay
    └── View lightfast.yml
```

---

## Component Architecture

### Core Components

**Search Interface:**
- `OrgChatInterface` - Main search page (already exists)
- `SearchResultCard` - Individual result display
- `SearchHighlight` - Highlighted text wrapper
- `SearchSnippet` - Snippet with context
- `JobsList` - Jobs tab content
- `JobCard` - Individual job display

**Dialogs:**
- `RepositoryConfigDialog` - Show `lightfast.yml`
- `CitationPopover` - Citation preview (Phase 2)

**Utilities:**
- `SourceBadge` - GitHub/Linear/Notion indicator
- `MatchReason` - Relevance explanation
- `SearchEmptyState` - No results
- `SearchLoadingState` - Skeleton cards

---

## Data Flow

### Search Flow

```
1. User types query
2. Debounce 300ms
3. Call trpc.search.query({ query, workspaceId })
4. Backend:
   - Query vector store (Pinecone)
   - Highlight matched terms
   - Generate snippets
   - Calculate relevance scores
5. Return results with highlights
6. Frontend renders result cards
```

### Jobs Flow

```
1. Component mounts / tab switches
2. Call trpc.jobs.list({ organizationId })
3. Backend:
   - Query Inngest API for active jobs
   - Query ingestion_commits for history
   - Merge and format results
4. Return job list
5. Poll every 3s for updates (active jobs only)
6. Frontend renders job cards with progress
```

---

## Phase 1 Scope

**What's included:**
- ✅ Search interface (already exists)
- ✅ Result cards with highlights
- ✅ Jobs tracking tab
- ✅ Config dialog
- ✅ Settings pages (already exist)

**What's excluded (Phase 2):**
- ❌ Multi-workspace switcher
- ❌ Linear/Notion integration
- ❌ Inline citations
- ❌ Advanced filters
- ❌ Saved searches

---

## Implementation Status

| Component | Status | File |
|-----------|--------|------|
| Search interface | ✅ Exists | `apps/console/src/components/org-chat-interface.tsx` |
| Settings pages | ✅ Exists | `apps/console/src/app/(app)/org/[slug]/settings/*` |
| Result cards | 📝 Spec only | `search-results.md` |
| Jobs tab | 📝 Spec only | `jobs-tracking.md` |
| Config dialog | 📝 Spec only | `ui-structure.md` |

---

## Related Documentation

### Phase 1 Architecture
- [Package Structure](../package-structure.md) - Monorepo organization
- [Data Model](../data-model.md) - Database schemas
- [User Flow](../user-flow-architecture.md) - Onboarding flow
- [Inngest Pipeline](../inngest-pipeline.md) - Background jobs

### Phase 2 Planning
- [Multi-Workspace](../../phase2/README.md) - Multiple workspaces
- [Linear Integration](../../phase2/config.md) - Issue tracking
- [Notion Integration](../../phase2/config.md) - Documentation

---

## Next Steps

### To Implement

1. **Search Results** (Priority: High)
   - Implement `SearchResultCard` component
   - Add highlighting with `<mark>` tags
   - Generate snippets around matches
   - Add source badges

2. **Jobs Tracking** (Priority: Medium)
   - Add Jobs tab to search interface
   - Implement `JobsList` and `JobCard`
   - Set up Inngest API integration
   - Add polling for active jobs

3. **Config Dialog** (Priority: Low)
   - Create `RepositoryConfigDialog` component
   - Add "View Config" button to search toolbar
   - Fetch and display `lightfast.yml` content
   - Show repository stats

### To Research

- [ ] Keyboard navigation patterns (↑↓ for results)
- [ ] Virtualization for 1000+ results
- [ ] Search analytics (track queries, clicks)
- [ ] A/B testing different result layouts

---

## Questions & Feedback

For questions about these specs:
- Check implementation details in each spec file
- Review related Phase 1 architecture docs
- Consult Phase 2 planning for future features

For feedback or updates:
- Update specs with new research findings
- Document design decisions and trade-offs
- Keep implementation status table current
