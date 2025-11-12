---
title: Multi-Source Integration Strategy
description: Expanding beyond GitHub to Linear, Sentry, Vercel, Zendesk, and Notion
status: draft
owner: engineering
audience: engineering
last_updated: 2025-11-12
tags: [phase2, multi-source, linear, sentry, vercel, zendesk, notion]
---

# Multi-Source Integration Strategy

Phase 2 expands Lightfast from GitHub-only to support multiple data sources: Linear, Notion, Sentry, Vercel, and Zendesk. This document defines what to ingest, how sources connect, and the database architecture needed to support multi-source memory.

---

## Executive Summary

**Current State (Phase 1):**
- GitHub-only ingestion (markdown files, MDX)
- Repository-centric data model
- Git-based change tracking (commits, SHAs)
- File path-based document identification

**Phase 2 Vision:**
- Multi-source ingestion (GitHub, Linear, Notion, Sentry, Vercel, Zendesk)
- Source-agnostic data model with discriminated unions
- Cross-source relationship discovery
- Unified search across all sources

**Strategy:**
- **Minimal changes NOW** (Phase 1.5): Add nullable columns for forward compatibility
- **Gradual migration** (Phase 2.0): Dual-write to old and new schema
- **Full migration** (Phase 2.5): Remove legacy columns after validation

---

## Document Types by Source

### What Becomes a "Document"

| Source | Document Type | Semantic Unit | Update Behavior |
|--------|---------------|---------------|-----------------|
| **GitHub** | File | Markdown/MDX files | Replace chunks on commit |
| **Linear** | Issue | Full issue with description | Replace entire document |
| **Linear** | Comment | Individual comment | Separate document, linked to parent |
| **Notion** | Page | Database page or doc page | Replace on page update |
| **Sentry** | Issue | Error group (aggregated events) | Aggregate events, update metadata |
| **Vercel** | Deployment | Build summary + logs | Immutable (append-only) |
| **Zendesk** | Ticket | Full conversation thread | Replace with full thread |
| **Zendesk** | Article | Knowledge base article | Replace on article update |

**Key Decisions:**

1. **Linear Comments → Separate docs**
   - Why: Improves retrieval precision ("What did Sarah say about auth?")
   - Links to parent via `parentDocId`

2. **Sentry Events → Aggregate into Issues**
   - Why: Individual events are noise; issues are semantic units
   - Events update issue metadata (count, environments, tags)

3. **Vercel Deployments → Immutable**
   - Why: Historical snapshots; don't change
   - New deployment = new document

4. **Zendesk Tickets → Conversation Threads**
   - Why: Context across messages matters
   - Re-chunk entire thread on new comment

---

## Cross-Source Relationships

### Relationship Types

**1. Explicit (Extracted from Content)**
- Linear issue → GitHub PR: "Fixes owner/repo#123"
- GitHub PR → Linear issue: "Resolves LIN-456"
- Zendesk ticket → Linear: "See LIN-789"
- Sentry issue → GitHub commit: (from release metadata)

**2. Temporal (Inferred)**
- Vercel deployment → Sentry errors (after timestamp)
- GitHub commit → Vercel deployment (commit SHA)
- Linear issue → Notion spec (mentioned in issue)

**3. Semantic (Vector Similarity)**
- Similar content across sources
- Related discussions on same topic

### Relationship Extraction

**Pattern Matching:**
```typescript
const patterns = {
  github: /(?:https:\/\/github\.com\/)?([a-zA-Z0-9-]+\/[a-zA-Z0-9-]+)#(\d+)/g,
  linear: /(?:https:\/\/linear\.app\/[a-z]+\/issue\/)?([A-Z]+-\d+)/g,
  zendesk: /(?:https:\/\/[a-z]+\.zendesk\.com\/agent\/tickets\/)?#?(\d{4,})/g,
  sentry: /(?:https:\/\/sentry\.io\/[a-z-]+\/)?([A-Z]+-[A-Z0-9]+)/g,
};
```

**Storage:**
```typescript
// Stored in docsDocuments.relationships (JSONB)
{
  mentions: {
    github: ["owner/repo#123"],
    linear: ["LIN-456", "LIN-789"],
    sentry: ["PROJ-ABC"],
    zendesk: ["#7890"]
  },
  temporal: {
    deploymentId?: "vercel_deploy_xyz",
    commitSha?: "abc123def456"
  }
}
```

---

## Integration Approaches

### MCP vs Direct API

**Recommendation: Hybrid Approach**

| Platform | Primary Method | Secondary Method | Rationale |
|----------|---------------|------------------|-----------|
| **Linear** | Direct API | MCP (optional) | GraphQL API excellent for queries; MCP for agents |
| **Notion** | Direct API | MCP (optional) | Robust API; MCP for exploration |
| **Sentry** | Direct API | MCP (optional) | Need webhooks for real-time; MCP for debugging |
| **Vercel** | Direct API | MCP (optional) | Webhook-driven; MCP for logs/status |
| **Zendesk** | Direct API | - | Mature API; community MCP not stable |

**Direct API Capabilities:**
- ✅ Webhooks for real-time updates
- ✅ Bulk data fetching (historical sync)
- ✅ Fine-grained control over what to ingest
- ✅ Dedicated rate limits per organization

**MCP Capabilities:**
- ✅ Agent-friendly (Claude, other LLMs)
- ✅ Real-time queries (status checks, logs)
- ✅ Exploration and debugging
- ❌ No bulk ingestion or webhooks

**Implementation:**
- Phase 2.1-2.3: Direct API for ingestion (Linear, Notion)
- Phase 2.4: Add Sentry, Vercel, Zendesk via Direct API
- Phase 3: Optional MCP layer for agent queries

---

## Chunking and Embedding Strategies

### Per-Source Chunking

| Source | Content Type | Max Tokens | Overlap | Special Handling |
|--------|-------------|------------|---------|------------------|
| GitHub | Markdown | 512 | 50 | Preserve code blocks, headings |
| Linear | Issues | 512 | 50 | Preserve paragraphs |
| Linear | Comments | 512 | 25 | Usually short; less overlap |
| Notion | Pages | 512 | 50 | Similar to GitHub markdown |
| Sentry | Stack traces | 512 | 100 | **Preserve frame groups** |
| Sentry | Breadcrumbs | 256 | 50 | Short events; smaller chunks |
| Vercel | Error logs | 512 | 50 | Extract errors only |
| Zendesk | Tickets | 512 | 50 | **Preserve comment boundaries** |
| Zendesk | Articles | 512 | 50 | Similar to GitHub markdown |

### Multi-View Embeddings

Following SPEC.md guidance, embed multiple views per document:

**Views:**
1. **Title** - High-level matching (single sentence)
2. **Summary** - First paragraph or auto-summary (100-200 tokens)
3. **Body** - Full chunked content (512 tokens per chunk)
4. **Metadata** - Source-specific fields embedded as text

**Example for Linear Issue:**
```typescript
{
  title: "Fix authentication redirect loop",
  summary: "Users experiencing infinite redirect loops when...",
  body: [chunk0, chunk1, chunk2],
  metadata: "bug high-priority in-progress authentication frontend"
}
```

**Pinecone Storage:**
```typescript
// Each view stored as separate vector
[
  { id: "doc_123#title", values: [...], metadata: { view: "title", ... } },
  { id: "doc_123#summary", values: [...], metadata: { view: "summary", ... } },
  { id: "doc_123#body#0", values: [...], metadata: { view: "body", chunkIndex: 0, ... } },
  { id: "doc_123#body#1", values: [...], metadata: { view: "body", chunkIndex: 1, ... } },
  { id: "doc_123#metadata", values: [...], metadata: { view: "metadata", ... } }
]
```

**Search Weighting:**
```typescript
const viewWeights = {
  title: 1.2,      // Boost title matches
  summary: 1.1,    // Slight boost
  body: 1.0,       // Baseline
  metadata: 0.9,   // Lower weight
};
```

---

## Search API Extensions

### Multi-Source Filtering

**Request Schema:**
```typescript
{
  query: string;
  topK: number;
  filters: {
    // NEW: Source type filtering
    sourceTypes?: ("github" | "linear" | "notion" | "sentry" | "vercel" | "zendesk")[];

    // NEW: Source-specific filters
    sourceFilters?: {
      linear?: {
        states?: string[];       // ["in-progress", "todo"]
        priorities?: number[];   // [3, 4]
        labels?: string[];       // ["bug", "feature"]
      };
      sentry?: {
        levels?: string[];       // ["error", "fatal"]
        environments?: string[]; // ["production"]
      };
      vercel?: {
        environments?: string[]; // ["production"]
        status?: string[];       // ["ERROR"]
      };
      zendesk?: {
        status?: string[];       // ["open", "pending"]
        priority?: string[];     // ["high", "urgent"]
      };
    };

    // NEW: Temporal filtering
    dateRange?: {
      after?: string;
      before?: string;
    };
  };

  // NEW: Include related documents
  includeRelated?: boolean;
}
```

**Response Schema:**
```typescript
{
  results: [
    {
      id: string;
      title: string;
      url: string;
      snippet: string;
      score: number;

      // NEW: Source information
      source: {
        type: "linear" | "github" | ...;
        id: string;         // External ID (LIN-123, etc.)
        url: string;        // Direct link
      };

      // NEW: Which view matched
      view: "title" | "summary" | "body" | "metadata";

      // NEW: Relationship indicators
      relationships?: {
        hasRelated: boolean;
        relatedCount: number;
        relatedTypes: string[];
      };
    }
  ]
}
```

**Example Query:**
```json
{
  "query": "authentication errors in production",
  "topK": 20,
  "filters": {
    "sourceTypes": ["sentry", "linear", "github"],
    "sourceFilters": {
      "sentry": {
        "levels": ["error", "fatal"],
        "environments": ["production"]
      }
    },
    "dateRange": {
      "after": "2025-01-01T00:00:00Z"
    }
  },
  "includeRelated": true
}
```

### Contents API Extension

**Support external IDs:**
```typescript
{
  // Existing: by internal IDs
  ids?: string[];

  // NEW: by external source IDs
  externalIds?: {
    sourceType: "linear" | "github" | ...;
    sourceId: string;
  }[];

  includeRelated?: boolean;
}
```

**Example:**
```json
{
  "externalIds": [
    { "sourceType": "linear", "sourceId": "LIN-123" },
    { "sourceType": "sentry", "sourceId": "AUTH-ERROR-1" }
  ],
  "includeRelated": true
}
```

---

## Document Lifecycle

### Creation Workflows

**Linear Issue:**
1. Webhook: `issue.created`
2. Create main issue document
3. Extract relationships (mentions)
4. Chunk description (512 tokens, 50 overlap)
5. Embed multi-view (title, summary, body, metadata)
6. Upsert to Pinecone
7. Save to database with relationships

**Sentry Issue:**
1. Webhook: `issue.created`
2. Format stack trace + breadcrumbs
3. Create document with aggregated metadata
4. Chunk stack trace (preserve frame groups)
5. Embed and upsert
6. On `event.created`: Update metadata only (don't re-embed unless description changes)

### Update Workflows

**Linear Issue Update:**
- **Content changed** (description, title): Full re-processing
  - New content hash
  - Delete old vectors
  - Re-chunk, re-embed, re-upsert
- **Metadata changed** (state, priority, labels): Update database only
  - No re-embedding needed

**Zendesk Ticket Update (New Comment):**
1. Fetch full conversation thread via API
2. Format as continuous narrative
3. Compute new content hash
4. If changed: Delete old vectors, re-chunk entire thread, re-embed

### Deletion Workflows

**Linear Issue Deleted:**
1. Find document by `sourceId`
2. Delete all vectors from Pinecone (filter by `docId`)
3. Delete from database (cascade deletes vector entries)
4. Delete related comments (filter by `parentDocId`)

---

## Implementation Phases

### Phase 1.5: Minimal Schema Changes (NOW)

**Goal:** Add nullable columns for forward compatibility

**Changes:**
- Add `source_type` enum column (defaults to 'github')
- Add `source_metadata` JSONB column (nullable)
- Add `source_id` VARCHAR column (external identifier)
- Add `relationships` JSONB column (nullable)
- Add `parent_doc_id` VARCHAR column (for hierarchical docs)

**Migration:**
```sql
-- Add new columns (nullable for backward compatibility)
ALTER TABLE lightfast_docs_documents
ADD COLUMN source_type VARCHAR(50) DEFAULT 'github',
ADD COLUMN source_id VARCHAR(255),
ADD COLUMN source_metadata JSONB,
ADD COLUMN relationships JSONB,
ADD COLUMN parent_doc_id VARCHAR(191);

-- Create indexes
CREATE INDEX idx_docs_source_type ON lightfast_docs_documents(source_type);
CREATE INDEX idx_docs_source_id ON lightfast_docs_documents(source_type, source_id);
CREATE INDEX idx_docs_parent ON lightfast_docs_documents(parent_doc_id);
```

**Backward Compatibility:**
- Existing GitHub ingestion continues to work
- New columns are nullable (no breaking changes)
- GitHub-specific columns (path, commitSha) remain for now

### Phase 2.0: Linear Integration (Weeks 1-4)

**Tasks:**
1. Implement Linear OAuth flow
2. Create Linear webhook handlers
3. Build Linear document processor
4. Start writing to new schema columns
5. Test cross-source search (GitHub + Linear)

**Deliverables:**
- Linear issues and comments ingested
- Relationships extracted and stored
- Search returns results from both sources

### Phase 2.1: Notion Integration (Weeks 5-8)

**Tasks:**
1. Implement Notion OAuth flow
2. Create Notion webhook handlers
3. Build Notion page processor
4. Support database pages and doc pages
5. Test multi-source search (GitHub + Linear + Notion)

### Phase 2.2: Error Tracking (Weeks 9-12)

**Tasks:**
1. Implement Sentry integration
2. Add Vercel integration
3. Build event aggregation logic
4. Implement temporal relationship linking
5. Test deployment → error correlation

### Phase 2.3: Support Context (Weeks 13-16)

**Tasks:**
1. Implement Zendesk integration
2. Build conversation thread formatting
3. Test customer issue → engineering context linking

### Phase 2.5: Schema Consolidation (Future)

**Goal:** Remove legacy GitHub-specific columns

**Changes:**
- Migrate remaining data to `source_metadata`
- Drop `path`, `commitSha`, `committedAt` columns
- Make `source_type`, `source_id` non-nullable

**Note:** Only after all sources migrated and validated

---

## Configuration Examples

### lightfast.yml (Phase 2)

**Multi-Source Store:**
```yaml
version: 1
workspace: engineering

stores:
  - name: product-memory
    kind: mixed

    # GitHub sources
    github:
      include:
        - "docs/**/*.md"
        - "src/**/*.tsx"

    # Linear sources
    linear:
      teams: [ENG, PROD]
      states: [in-progress, todo, done]
      includeLabels: [bug, feature, incident]

    # Notion sources
    notion:
      databases:
        - name: "Product Specs"
          includeProperties: [title, tags, owner, status]

    # Sentry sources
    sentry:
      projects: [api-production, web-production]
      levels: [error, fatal]

    # Vercel sources
    vercel:
      projects: [api, web]
      environments: [production]
      status: [ERROR]

    # Zendesk sources
    zendesk:
      types: [problem, incident]
      includeStatuses: [open, pending]
```

---

## Quality Metrics

### Per-Source Metrics

**Ingestion:**
- Documents ingested per source
- Ingestion latency (webhook → searchable)
- Error rate per source

**Retrieval:**
- Recall@10, Recall@20 per source
- Precision@5 per source
- MRR (Mean Reciprocal Rank)

**Cross-Source:**
- Relationship extraction accuracy (% mentions found)
- Relationship relevance (are related docs useful?)
- View distribution (which views match most?)

### Expected Load

**Document Counts:**
- GitHub: ~1,000 files
- Linear: ~500 issues, ~1,000 comments
- Notion: ~200 pages
- Sentry: ~500 issues (aggregated)
- Vercel: ~100 deployments
- Zendesk: ~200 tickets, ~50 articles

**Total: ~3,500 documents**

**Vector Counts (with multi-view):**
- Each doc generates ~4-10 vectors (title, summary, body chunks, metadata)
- Total: ~15,000-35,000 vectors
- Well within Pinecone serverless limits

---

## Open Questions

### Configuration
- [ ] How to handle Linear private teams? (Phase 2.0)
- [ ] Notion subpage handling outside configured databases? (Phase 2.1)
- [ ] Sentry event aggregation threshold? (when to re-embed issue) (Phase 2.2)

### Permissions
- [ ] Redaction for sensitive Notion properties? (Phase 2.1)
- [ ] Zendesk customer PII handling? (Phase 2.3)

### Behavior
- [ ] Backfill strategy for each source? (limits, time windows) (Phase 2.0+)
- [ ] Update cadence vs webhook priority? (Phase 2.0+)
- [ ] Relationship boosting algorithm? (Phase 2.0+)

---

## Success Criteria

**Phase 1.5 (Schema Changes):**
- [ ] New columns added without breaking GitHub ingestion
- [ ] Migration tested on staging environment
- [ ] Backward compatibility verified

**Phase 2.0 (Linear):**
- [ ] Linear issues and comments searchable
- [ ] Cross-source mentions extracted
- [ ] Search returns GitHub + Linear results

**Phase 2.1 (Notion):**
- [ ] Notion pages ingested
- [ ] Multi-source search (3 sources)

**Phase 2.2 (Sentry + Vercel):**
- [ ] Errors linked to deployments
- [ ] Temporal relationships working

**Phase 2.3 (Zendesk):**
- [ ] Tickets searchable
- [ ] Customer context linked to engineering

---

## References

- [Phase 2 README](./README.md)
- [Phase 2 Config](./config.md)
- [Phase 2 Implementation Plan](./implementation-plan.md)
- [Phase 2 Scenarios](./scenarios.md)
- [Database Schema Changes](./database-schema.md)
