---
date: 2025-12-14T07:35:19Z
researcher: Claude
git_commit: 5bc0bf4322d8d478b2ad6311f812804741137ec8
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Neural Memory Relationship Graph: Dedicated Table Design"
tags: [research, neural-memory, relationships, graph, database-design, architecture]
status: deferred
last_updated: 2025-12-14
last_updated_by: Claude
last_updated_note: "Deferred to Day 4+ - Day 3 MVP ships without includeRelationships"
target_implementation: "Day 4+"
---

# Research: Neural Memory Relationship Graph Design

**Date**: 2025-12-14T07:35:19Z
**Researcher**: Claude
**Git Commit**: 5bc0bf4322d8d478b2ad6311f812804741137ec8
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

> **Status: DEFERRED to Day 4+**
>
> This research is complete but implementation is deferred. Day 3 MVP ships `/v1/contents` and `/v1/findsimilar` without `includeRelationships` parameter. The relationship graph infrastructure (database table, extraction workflow, query utilities) will be implemented in a future sprint.

## Research Question

Design a dedicated relationship table for bidirectional document/observation cross-references to support the `/v1/contents` endpoint's `includeRelationships: true` feature. Analyze architectural alignment with the existing neural memory e2e design.

## Summary

This document proposes a **dedicated relationship table** (`workspace_content_relationships`) to store bidirectional links between documents and observations. This approach:

1. **Aligns with existing architecture** - Mirrors the `Reference` interface from the e2e design
2. **Enables efficient bidirectional queries** - Indexed both directions for O(1) lookups
3. **Supports rich relationship metadata** - Types, labels, confidence, provenance
4. **Unifies documents and observations** - Single table handles both `doc_*` and `obs_*` prefixed content

### Key Architectural Decision

The relationship table **extends** the neural memory architecture rather than replacing the existing `sourceReferences` JSONB pattern. The table provides **cross-content relationships** (document↔document, document↔observation), while `sourceReferences` continues to store **external system references** (commits, branches, deployments).

---

## Detailed Findings

### 1. Current State Analysis

#### Existing Relationship Infrastructure

| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| `relationships` JSONB column | `workspace_knowledge_documents` | Cross-document links | Schema exists, always NULL |
| `sourceReferences` JSONB | `workspace_neural_observations` | External system refs | Active, populated |
| `Reference` interface | e2e design doc | Standardized ref format | Design only |
| `apps-console/relationships.extract` event | Inngest client | Extraction trigger | Defined, no consumer |

#### Existing Reference Interface (from e2e design)

```typescript
// docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md:157-163
interface Reference {
  type: 'commit' | 'branch' | 'pr' | 'issue' | 'deployment' | 'project' |
        'cycle' | 'assignee' | 'reviewer' | 'team' | 'label';
  id: string;
  url?: string;
  label?: string;  // "fixes", "closes", "blocks"
}
```

This interface is designed for **external system references** (GitHub, Linear, etc.) - not for cross-content relationships within Lightfast.

### 2. Proposed Schema: `workspace_content_relationships`

#### Design Principles

1. **Source-agnostic**: Works with both `doc_*` and `obs_*` prefixed IDs
2. **Bidirectional by design**: Query from either endpoint efficiently
3. **Rich metadata**: Supports relationship types, labels, confidence
4. **Provenance tracking**: Know where the relationship came from
5. **Temporal awareness**: When was it discovered, last validated

#### Schema Definition

```typescript
// db/console/src/schema/tables/workspace-content-relationships.ts

import { pgTable, varchar, text, timestamp, real, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Relationship types between content items.
 * - link: Explicit hyperlink in content (markdown link, wikilink)
 * - mention: Reference without hyperlink (@mention, #reference)
 * - citation: Formal citation or quote
 * - parent: Hierarchical relationship (comment under issue)
 * - related: Semantic similarity above threshold
 */
export type ContentRelationshipType =
  | "link"
  | "mention"
  | "citation"
  | "parent"
  | "related";

/**
 * Cross-content relationships for documents and observations.
 * Supports bidirectional queries via dual indexes.
 */
export const workspaceContentRelationships = pgTable(
  "lightfast_workspace_content_relationships",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // Source content (the one containing the reference)
    sourceId: varchar("source_id", { length: 191 }).notNull(),
    sourceType: varchar("source_type", { length: 50 }).notNull(), // "document" | "observation"

    // Target content (the one being referenced)
    targetId: varchar("target_id", { length: 191 }).notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(), // "document" | "observation"

    // Relationship metadata
    relationshipType: varchar("relationship_type", { length: 50 }).notNull(), // ContentRelationshipType
    label: text("label"), // Optional qualifier: "fixes", "implements", "supersedes"
    anchorText: text("anchor_text"), // The link text or mention text

    // Provenance
    extractionMethod: varchar("extraction_method", { length: 50 }).notNull(), // "markdown_link" | "wikilink" | "mention" | "semantic" | "manual"
    confidence: real("confidence").notNull().default(1.0), // 0.0-1.0
    evidenceSnippet: text("evidence_snippet"), // Context where relationship found

    // Source location (for link extraction)
    sourcePosition: jsonb("source_position"), // { line: number, column: number, offset: number }

    // Temporal
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),

    // Soft delete support
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    // Primary lookup: Find all relationships FROM a source
    sourceIdx: index("idx_rel_source").on(t.workspaceId, t.sourceId),

    // Reverse lookup: Find all relationships TO a target
    targetIdx: index("idx_rel_target").on(t.workspaceId, t.targetId),

    // Prevent duplicate relationships
    uniqueRel: uniqueIndex("idx_rel_unique").on(
      t.workspaceId,
      t.sourceId,
      t.targetId,
      t.relationshipType
    ),

    // Filter by relationship type
    typeIdx: index("idx_rel_type").on(t.workspaceId, t.relationshipType),
  })
);

export type WorkspaceContentRelationship = typeof workspaceContentRelationships.$inferSelect;
export type NewWorkspaceContentRelationship = typeof workspaceContentRelationships.$inferInsert;
```

#### SQL Migration

```sql
-- Migration: Add workspace_content_relationships table
CREATE TABLE lightfast_workspace_content_relationships (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL REFERENCES lightfast_org_workspaces(id) ON DELETE CASCADE,

  -- Source content
  source_id VARCHAR(191) NOT NULL,
  source_type VARCHAR(50) NOT NULL,

  -- Target content
  target_id VARCHAR(191) NOT NULL,
  target_type VARCHAR(50) NOT NULL,

  -- Relationship metadata
  relationship_type VARCHAR(50) NOT NULL,
  label TEXT,
  anchor_text TEXT,

  -- Provenance
  extraction_method VARCHAR(50) NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  evidence_snippet TEXT,
  source_position JSONB,

  -- Temporal
  discovered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_validated_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for bidirectional queries
CREATE INDEX idx_rel_source ON lightfast_workspace_content_relationships(workspace_id, source_id);
CREATE INDEX idx_rel_target ON lightfast_workspace_content_relationships(workspace_id, target_id);
CREATE INDEX idx_rel_type ON lightfast_workspace_content_relationships(workspace_id, relationship_type);
CREATE UNIQUE INDEX idx_rel_unique ON lightfast_workspace_content_relationships(
  workspace_id, source_id, target_id, relationship_type
);
```

### 3. Query Patterns

#### Bidirectional Relationship Lookup

```typescript
// apps/console/src/lib/neural/relationship-graph.ts

import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@db/console";
import { workspaceContentRelationships } from "@db/console/schema";

interface ContentRelationship {
  id: string;
  title: string | null;
  type: string;
  relationshipType: string;
  label: string | null;
}

interface BidirectionalRelationships {
  references: ContentRelationship[];    // Content this item links TO
  referencedBy: ContentRelationship[];  // Content that links TO this item
}

/**
 * Get bidirectional relationships for a single content item.
 * Executes two parallel queries for forward and reverse lookups.
 */
export async function getRelationships(
  workspaceId: string,
  contentId: string
): Promise<BidirectionalRelationships> {
  const [outbound, inbound] = await Promise.all([
    // Forward: What does this content reference?
    db.select({
      targetId: workspaceContentRelationships.targetId,
      targetType: workspaceContentRelationships.targetType,
      relationshipType: workspaceContentRelationships.relationshipType,
      label: workspaceContentRelationships.label,
    })
    .from(workspaceContentRelationships)
    .where(and(
      eq(workspaceContentRelationships.workspaceId, workspaceId),
      eq(workspaceContentRelationships.sourceId, contentId),
      isNull(workspaceContentRelationships.deletedAt)
    )),

    // Reverse: What references this content?
    db.select({
      sourceId: workspaceContentRelationships.sourceId,
      sourceType: workspaceContentRelationships.sourceType,
      relationshipType: workspaceContentRelationships.relationshipType,
      label: workspaceContentRelationships.label,
    })
    .from(workspaceContentRelationships)
    .where(and(
      eq(workspaceContentRelationships.workspaceId, workspaceId),
      eq(workspaceContentRelationships.targetId, contentId),
      isNull(workspaceContentRelationships.deletedAt)
    )),
  ]);

  // Hydrate with titles (batch fetch)
  const allIds = [
    ...outbound.map(r => r.targetId),
    ...inbound.map(r => r.sourceId),
  ];
  const titles = await fetchContentTitles(workspaceId, allIds);

  return {
    references: outbound.map(r => ({
      id: r.targetId,
      title: titles.get(r.targetId) ?? null,
      type: r.targetType,
      relationshipType: r.relationshipType,
      label: r.label,
    })),
    referencedBy: inbound.map(r => ({
      id: r.sourceId,
      title: titles.get(r.sourceId) ?? null,
      type: r.sourceType,
      relationshipType: r.relationshipType,
      label: r.label,
    })),
  };
}

/**
 * Batch fetch relationships for multiple content items.
 * Used by /v1/contents when includeRelationships=true.
 */
export async function getBatchRelationships(
  workspaceId: string,
  contentIds: string[]
): Promise<Map<string, BidirectionalRelationships>> {
  const [allOutbound, allInbound] = await Promise.all([
    db.select()
      .from(workspaceContentRelationships)
      .where(and(
        eq(workspaceContentRelationships.workspaceId, workspaceId),
        inArray(workspaceContentRelationships.sourceId, contentIds),
        isNull(workspaceContentRelationships.deletedAt)
      )),

    db.select()
      .from(workspaceContentRelationships)
      .where(and(
        eq(workspaceContentRelationships.workspaceId, workspaceId),
        inArray(workspaceContentRelationships.targetId, contentIds),
        isNull(workspaceContentRelationships.deletedAt)
      )),
  ]);

  // Group by content ID
  const result = new Map<string, BidirectionalRelationships>();

  for (const id of contentIds) {
    result.set(id, { references: [], referencedBy: [] });
  }

  // Hydrate titles
  const allRelatedIds = new Set([
    ...allOutbound.map(r => r.targetId),
    ...allInbound.map(r => r.sourceId),
  ]);
  const titles = await fetchContentTitles(workspaceId, [...allRelatedIds]);

  for (const rel of allOutbound) {
    result.get(rel.sourceId)?.references.push({
      id: rel.targetId,
      title: titles.get(rel.targetId) ?? null,
      type: rel.targetType,
      relationshipType: rel.relationshipType,
      label: rel.label,
    });
  }

  for (const rel of allInbound) {
    result.get(rel.targetId)?.referencedBy.push({
      id: rel.sourceId,
      title: titles.get(rel.sourceId) ?? null,
      type: rel.sourceType,
      relationshipType: rel.relationshipType,
      label: rel.label,
    });
  }

  return result;
}
```

### 4. Integration with E2E Architecture

#### Architectural Alignment

The relationship table **complements** the existing neural memory design:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NEURAL MEMORY SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EXTERNAL REFERENCES (existing)        INTERNAL RELATIONSHIPS (new)         │
│  ─────────────────────────────         ───────────────────────────          │
│                                                                              │
│  workspaceNeuralObservations          workspaceContentRelationships         │
│  └─ sourceReferences (JSONB)          └─ Dedicated table                    │
│     │                                    │                                   │
│     ├─ commit: abc123                    ├─ doc_A → doc_B (link)            │
│     ├─ pr: #456                          ├─ doc_A → obs_X (mention)         │
│     ├─ deployment: dep_789               ├─ obs_Y → doc_A (citation)        │
│     └─ branch: main                      └─ obs_Z → obs_W (related)         │
│                                                                              │
│  Purpose: Link to external systems    Purpose: Cross-content graph          │
│  Query: "What commit caused this?"    Query: "What references this doc?"    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Impact on E2E Design Components

| Component | Impact | Changes Required |
|-----------|--------|------------------|
| **SourceEvent.references** | None | External refs only, unchanged |
| **Entity Store** | None | Entities remain separate concept |
| **Observation Capture** | Minor | Add relationship extraction step |
| **Document Processing** | Minor | Add link extraction step |
| **Retrieval Governor** | Enhancement | Can query relationship graph |
| **Cluster Assignment** | Enhancement | Consider relationship affinity |

#### Updated Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     OBSERVATION CAPTURE PIPELINE (Updated)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Step 5: PARALLEL PROCESSING                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐   │    │
│  │  │Embedding│ │ Entity  │ │ Actor   │ │ Cluster │ │ Relationship│   │    │
│  │  │Generator│ │Extractor│ │ Profile │ │ Assign  │ │  Extractor  │   │    │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └──────┬──────┘   │    │
│  └───────┼──────────┼──────────┼──────────┼───────────────┼──────────┘    │
│          ↓          ↓          ↓          ↓               ↓                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         STORAGE LAYER                                │    │
│  │  Pinecone    PostgreSQL   PostgreSQL   Pinecone   PostgreSQL        │    │
│  │  (vectors)   (entities)   (profiles)   (clusters) (relationships)   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5. Relationship Extraction Implementation

#### Markdown Link Extraction

```typescript
// packages/console-extract/src/relationships/markdown-links.ts

interface ExtractedLink {
  targetPath: string;      // The link target (relative or absolute path)
  anchorText: string;      // The link text
  position: { line: number; column: number; offset: number };
  linkType: "markdown" | "wikilink" | "autolink";
}

/**
 * Extract links from markdown/MDX content.
 * Supports:
 * - Standard markdown: [text](path)
 * - Wikilinks: [[path]] or [[path|text]]
 * - Autolinks: <https://...>
 */
export function extractMarkdownLinks(content: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];

  // Standard markdown links: [text](path)
  const mdLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  for (const match of content.matchAll(mdLinkPattern)) {
    const target = match[2];
    // Skip external links and anchors
    if (!target.startsWith("http") && !target.startsWith("#")) {
      links.push({
        targetPath: normalizeRelativePath(target),
        anchorText: match[1],
        position: getPosition(content, match.index!),
        linkType: "markdown",
      });
    }
  }

  // Wikilinks: [[path]] or [[path|text]]
  const wikilinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  for (const match of content.matchAll(wikilinkPattern)) {
    links.push({
      targetPath: normalizeWikilinkPath(match[1]),
      anchorText: match[2] || match[1],
      position: getPosition(content, match.index!),
      linkType: "wikilink",
    });
  }

  return links;
}

/**
 * Resolve extracted links to content IDs.
 * Maps file paths to document/observation IDs in the workspace.
 */
export async function resolveLinksToContentIds(
  workspaceId: string,
  sourceDocId: string,
  links: ExtractedLink[]
): Promise<Array<{
  link: ExtractedLink;
  targetId: string | null;
  targetType: "document" | "observation" | null;
}>> {
  // Build lookup map from paths to IDs
  const pathsToResolve = links.map(l => l.targetPath);

  const documents = await db.select({
    id: workspaceKnowledgeDocuments.id,
    sourceId: workspaceKnowledgeDocuments.sourceId, // Contains file path
  })
  .from(workspaceKnowledgeDocuments)
  .where(and(
    eq(workspaceKnowledgeDocuments.workspaceId, workspaceId),
    // Match on file path suffix
    or(...pathsToResolve.map(p =>
      sql`${workspaceKnowledgeDocuments.sourceId} LIKE ${'%' + p}`
    ))
  ));

  const pathToId = new Map<string, { id: string; type: "document" | "observation" }>();
  for (const doc of documents) {
    pathToId.set(doc.sourceId, { id: doc.id, type: "document" });
  }

  return links.map(link => {
    const resolved = pathToId.get(link.targetPath);
    return {
      link,
      targetId: resolved?.id ?? null,
      targetType: resolved?.type ?? null,
    };
  });
}
```

#### Relationship Extraction Workflow

```typescript
// api/console/src/inngest/workflow/neural/relationship-extraction.ts

export const relationshipExtraction = inngest.createFunction(
  {
    id: "neural.relationship.extract",
    concurrency: { limit: 10, key: "event.data.workspaceId" },
  },
  { event: "apps-console/relationships.extract" },
  async ({ event, step }) => {
    const { workspaceId, contentId, contentType, content } = event.data;

    // Step 1: Extract links from content
    const links = await step.run("extract-links", async () => {
      return extractMarkdownLinks(content);
    });

    if (links.length === 0) {
      return { success: true, relationshipsCreated: 0 };
    }

    // Step 2: Resolve links to content IDs
    const resolved = await step.run("resolve-links", async () => {
      return resolveLinksToContentIds(workspaceId, contentId, links);
    });

    // Step 3: Create relationship records
    const relationships = await step.run("create-relationships", async () => {
      const toInsert = resolved
        .filter(r => r.targetId !== null)
        .map(r => ({
          id: generateId("rel"),
          workspaceId,
          sourceId: contentId,
          sourceType: contentType,
          targetId: r.targetId!,
          targetType: r.targetType!,
          relationshipType: "link" as const,
          label: null,
          anchorText: r.link.anchorText,
          extractionMethod: r.link.linkType,
          confidence: 1.0,
          sourcePosition: r.link.position,
          discoveredAt: new Date(),
        }));

      if (toInsert.length === 0) return [];

      // Upsert to handle re-processing
      return await db.insert(workspaceContentRelationships)
        .values(toInsert)
        .onConflictDoUpdate({
          target: [
            workspaceContentRelationships.workspaceId,
            workspaceContentRelationships.sourceId,
            workspaceContentRelationships.targetId,
            workspaceContentRelationships.relationshipType,
          ],
          set: {
            anchorText: sql`EXCLUDED.anchor_text`,
            sourcePosition: sql`EXCLUDED.source_position`,
            lastValidatedAt: new Date(),
          },
        })
        .returning();
    });

    return {
      success: true,
      linksExtracted: links.length,
      linksResolved: resolved.filter(r => r.targetId).length,
      relationshipsCreated: relationships.length,
    };
  }
);
```

### 6. Cascade Delete Handling

When a document or observation is deleted, its relationships must be cleaned up:

```typescript
// Option A: Soft delete relationships
async function onContentDeleted(workspaceId: string, contentId: string) {
  await db.update(workspaceContentRelationships)
    .set({ deletedAt: new Date() })
    .where(and(
      eq(workspaceContentRelationships.workspaceId, workspaceId),
      or(
        eq(workspaceContentRelationships.sourceId, contentId),
        eq(workspaceContentRelationships.targetId, contentId)
      )
    ));
}

// Option B: Hard delete (recommended for simplicity)
async function onContentDeleted(workspaceId: string, contentId: string) {
  await db.delete(workspaceContentRelationships)
    .where(and(
      eq(workspaceContentRelationships.workspaceId, workspaceId),
      or(
        eq(workspaceContentRelationships.sourceId, contentId),
        eq(workspaceContentRelationships.targetId, contentId)
      )
    ));
}
```

---

## Code References

| Component | File Path | Lines |
|-----------|-----------|-------|
| Reference interface (design) | `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md` | 157-163 |
| sourceReferences JSONB | `db/console/src/schema/tables/workspace-neural-observations.ts` | 150 |
| relationships JSONB (unused) | `db/console/src/schema/tables/workspace-knowledge-documents.ts` | 59 |
| Existing contents router | `api/console/src/router/org/contents.ts` | 35-112 |
| Day 3 research (open question) | `thoughts/shared/research/2025-12-14-neural-memory-week1-day3-search-route.md` | 721-722 |

---

## Architecture Documentation

### Relationship Table vs JSONB Comparison

| Aspect | JSONB (Option B) | Dedicated Table (Option C) |
|--------|------------------|---------------------------|
| **Bidirectional queries** | Requires GIN index + JSONB containment | Native indexed both directions |
| **Performance at scale** | Degrades with large JSONB arrays | Consistent O(1) with proper indexes |
| **Relationship metadata** | Limited, untyped | Rich, typed columns |
| **Cascade delete** | Manual cleanup of both docs | Single DELETE with OR condition |
| **Graph traversal** | Expensive recursive queries | Efficient JOINs possible |
| **Migration complexity** | None (column exists) | New table required |
| **Storage overhead** | Higher (JSONB bloat) | Lower (normalized) |

### Decision: Use Dedicated Table

The dedicated table is preferred because:

1. **Bidirectional queries are first-class** - Primary use case for `/v1/contents`
2. **Rich metadata support** - Relationship types, labels, confidence
3. **Future extensibility** - Graph algorithms, relationship analytics
4. **Cleaner data model** - Separates content from relationships
5. **Aligns with e2e design** - Complements rather than duplicates

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2025-12-14-neural-memory-week1-day3-search-route.md` - Original open question
- `thoughts/shared/research/2025-12-13-cross-source-linkage-architecture.md` - Cross-source relationship research
- `thoughts/shared/plans/2025-12-14-neural-memory-week1-public-api-rerank.md` - Week 1 implementation plan

---

## Related Research

- `thoughts/shared/research/2025-12-14-neural-memory-week1-day1-rerank-package.md` - Day 1 rerank package
- `thoughts/shared/research/2025-12-14-neural-memory-week1-day2-search-route.md` - Day 2 search route

---

## Open Questions

1. **Semantic relationships**: Should we auto-create "related" relationships based on embedding similarity? Could be noisy, but valuable for discovery.

2. **Cross-workspace relationships**: Current design is workspace-scoped. Should relationships ever cross workspace boundaries?

3. **Relationship weights**: Should relationships have explicit weights for ranking in retrieval? Current design uses `confidence` for extraction quality, not relationship strength.

4. **Backfill strategy**: When to backfill relationships for existing documents? Options:
   - On-demand during first query
   - Background job after table migration
   - Never (only new content)

---

## Implementation Checklist

- [ ] Create migration for `workspace_content_relationships` table
- [ ] Add Drizzle schema and types
- [ ] Implement `extractMarkdownLinks()` utility
- [ ] Implement `resolveLinksToContentIds()` utility
- [ ] Create `relationship-extraction` Inngest workflow
- [ ] Register workflow in Inngest index
- [ ] Add `getRelationships()` query function
- [ ] Add `getBatchRelationships()` for `/v1/contents`
- [ ] Update document processing to emit extraction events
- [ ] Update observation capture to emit extraction events
- [ ] Add cascade delete handling
- [ ] Update V1 contents route to use relationships

---

_Last updated: 2025-12-14_
