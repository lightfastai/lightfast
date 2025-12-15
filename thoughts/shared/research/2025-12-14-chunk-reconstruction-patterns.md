---
date: 2025-12-14T07:32:03Z
researcher: Claude
git_commit: 5bc0bf4322d8d478b2ad6311f812804741137ec8
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Chunk Reconstruction from Vector Database: Patterns and Implementation"
tags: [research, neural-memory, chunk-reconstruction, pinecone, vector-database, rag]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
last_updated_note: "Added architectural decision - URLs over reconstruction for /v1/contents"
---

# Research: Chunk Reconstruction from Vector Database

**Date**: 2025-12-14T07:32:03Z
**Researcher**: Claude
**Git Commit**: 5bc0bf4322d8d478b2ad6311f812804741137ec8
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Document the solution to Open Question #4 from Day 3 research: "For documents, how to reassemble chunks from Pinecone? Query by `filter: { docId: { $eq: id } }`, sort by `chunkIndex`, concatenate `text` fields. Need to handle overlap deduplication."

## Summary

The codebase stores document chunks in Pinecone with full text content in `metadata.text`, making reconstruction technically possible. However, **chunk reconstruction is NOT recommended for the `/v1/contents` endpoint**.

### Architectural Decision: URLs Over Reconstruction

**Recommendation**: Return source URLs instead of reconstructed content.

| Content Type | URL Strategy | Content Strategy |
|--------------|--------------|------------------|
| `obs_*` (PRs, issues) | GitHub PR/issue URL | Already in DB - return directly |
| `obs_*` (deployments) | Vercel deployment URL | Already in DB - return directly |
| `doc_*` (GitHub files) | GitHub blob permalink | Return URL, not reconstructed content |

**Rationale**:
1. **Simpler implementation** - No multi-query Pinecone logic or overlap deduplication
2. **Authoritative source** - URL points to latest/canonical version
3. **No storage duplication** - Avoids caching reconstructed content
4. **Better UX** - Users can view rich formatting, comments, diffs at source

### When Reconstruction Might Be Needed

The technical patterns below remain valid for edge cases:
- Offline/cached content requirements
- LLM context injection without external fetches
- Private repos where URL auth is complex

### Key Findings (Technical Reference)

1. **Chunks have all required metadata** - `docId`, `chunkIndex`, `text` stored in Pinecone
2. **50-token overlap** - Default configuration creates overlapping chunks
3. **No reconstruction code exists** - `/v1/contents` returns empty string for document content
4. **Industry pattern**: Most RAG systems accept overlap rather than deduplicating
5. **Token-based deduplication**: Sequence matching if reconstruction is ever needed

---

## Recommended Implementation: URL-Based /v1/contents

### URL Construction Patterns

```typescript
// apps/console/src/lib/neural/url-builder.ts

export function buildSourceUrl(
  sourceType: string,
  sourceId: string,
  metadata?: Record<string, unknown>
): string {
  switch (sourceType) {
    case "github":
      return buildGitHubUrl(sourceId, metadata);
    case "vercel":
      return buildVercelUrl(sourceId, metadata);
    case "linear":
      return buildLinearUrl(sourceId, metadata);
    default:
      return metadata?.url as string || "";
  }
}

function buildGitHubUrl(sourceId: string, metadata?: Record<string, unknown>): string {
  // Document: sourceId = "owner/repo/path/to/file.md"
  // PR: sourceId = "pr:owner/repo#123:merged"
  // Issue: sourceId = "issue:owner/repo#45:opened"

  if (sourceId.startsWith("pr:")) {
    const match = sourceId.match(/pr:([^#]+)#(\d+)/);
    if (match) return `https://github.com/${match[1]}/pull/${match[2]}`;
  }

  if (sourceId.startsWith("issue:")) {
    const match = sourceId.match(/issue:([^#]+)#(\d+)/);
    if (match) return `https://github.com/${match[1]}/issues/${match[2]}`;
  }

  // File path - use metadata for commit SHA if available
  const commitSha = metadata?.commitSha as string || "main";
  return `https://github.com/${sourceId.replace(/^\//, "")}?ref=${commitSha}`;
}
```

### Simplified /v1/contents Response

```typescript
// packages/console-types/src/api/v1/contents.ts

export const V1ContentItemSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  url: z.string().url(),           // Primary: Link to source
  snippet: z.string(),              // Preview text from search
  source: z.string(),               // "github", "vercel", "linear"
  type: z.string(),                 // "pull_request", "file", "deployment"
  occurredAt: z.string().datetime().optional(),
  // For observations only - content already in DB
  content: z.string().optional(),
});

export const V1ContentsResponseSchema = z.object({
  items: z.array(V1ContentItemSchema),
  missing: z.array(z.string()),
  requestId: z.string(),
});
```

### Implementation Strategy

```typescript
// apps/console/src/app/(api)/v1/contents/route.ts

export async function POST(request: NextRequest) {
  const { ids } = V1ContentsRequestSchema.parse(await request.json());

  const obsIds = ids.filter(id => id.startsWith("obs_"));
  const docIds = ids.filter(id => id.startsWith("doc_"));

  const [observations, documents] = await Promise.all([
    // Observations: Full content from DB
    db.select({
      id: workspaceNeuralObservations.id,
      title: workspaceNeuralObservations.title,
      content: workspaceNeuralObservations.content,  // Already stored!
      source: workspaceNeuralObservations.source,
      sourceId: workspaceNeuralObservations.sourceId,
      observationType: workspaceNeuralObservations.observationType,
      occurredAt: workspaceNeuralObservations.occurredAt,
      metadata: workspaceNeuralObservations.metadata,
    }).from(workspaceNeuralObservations)
      .where(inArray(workspaceNeuralObservations.id, obsIds)),

    // Documents: Metadata only, construct URL
    db.select({
      id: workspaceKnowledgeDocuments.id,
      sourceType: workspaceKnowledgeDocuments.sourceType,
      sourceId: workspaceKnowledgeDocuments.sourceId,
      sourceMetadata: workspaceKnowledgeDocuments.sourceMetadata,
    }).from(workspaceKnowledgeDocuments)
      .where(inArray(workspaceKnowledgeDocuments.id, docIds)),
  ]);

  const items = [
    ...observations.map(obs => ({
      id: obs.id,
      title: obs.title,
      url: buildSourceUrl(obs.source, obs.sourceId, obs.metadata),
      snippet: obs.content?.slice(0, 200) || "",
      content: obs.content,  // Full content for observations
      source: obs.source,
      type: obs.observationType,
      occurredAt: obs.occurredAt?.toISOString(),
    })),
    ...documents.map(doc => ({
      id: doc.id,
      title: doc.sourceMetadata?.title || doc.sourceId,
      url: buildSourceUrl(doc.sourceType, doc.sourceId, doc.sourceMetadata),
      snippet: doc.sourceMetadata?.description || "",
      // content: OMITTED - use URL instead
      source: doc.sourceType,
      type: "file",
    })),
  ];

  return NextResponse.json({ items, missing: [], requestId: randomUUID() });
}
```

---

## Technical Reference: Chunk Reconstruction (If Ever Needed)

The patterns below document how reconstruction *could* work for edge cases.

---

## Detailed Findings

### 1. Current Chunk Storage Architecture

#### Chunking Configuration

**Location**: `packages/console-chunking/src/chunk.ts:67-71`

| Setting | Default | Range | Purpose |
|---------|---------|-------|---------|
| `maxTokens` | 512 | 64-4096 | Maximum tokens per chunk |
| `overlap` | 50 | 0-1024 | Token overlap between consecutive chunks |
| `preserveBoundaries` | true | - | Respects paragraph/code block boundaries |

#### Vector ID Format

**Location**: `api/console/src/inngest/workflow/processing/process-documents.ts:495`

```
${docId}#${chunkIndex}
```

Examples: `doc_abc123#0`, `doc_abc123#1`, `doc_abc123#2`

#### Pinecone Metadata Structure

**Location**: `packages/console-pinecone/src/types.ts:19-38`

```typescript
export interface VectorMetadata extends RecordMetadata {
  text: string;           // Full chunk text content (RECONSTRUCTION KEY)
  path: string;           // Document repo-relative path
  slug: string;           // URL-friendly slug
  contentHash: string;    // Document version hash
  chunkIndex: number;     // 0-based chunk index (ORDERING KEY)
  docId: string;          // Owning document ID (FILTER KEY)
  title: string;          // Document title
  snippet: string;        // First 200 chars of chunk
  url: string;            // Source URL
}
```

#### Database Tracking Table

**Location**: `db/console/src/schema/tables/workspace-knowledge-vector-chunks.ts:21-52`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | varchar(191) | Vector ID: `${docId}#${chunkIndex}` |
| `workspaceId` | varchar(191) | Workspace FK |
| `docId` | varchar(191) | Document FK |
| `chunkIndex` | integer | 0-based position |
| `contentHash` | varchar(64) | Version tracking |
| `upsertedAt` | timestamp | When upserted |

**Index**: `idx_vec_workspace_doc` on `(workspaceId, docId)` - optimized for fetching all chunks.

---

### 2. Overlap Implementation Details

#### How Overlap is Created

**Location**: `packages/console-chunking/src/chunk.ts:155-162`

```typescript
// Start new chunk with overlap
if (opts.overlap > 0) {
  const overlapText = findOverlapText(currentChunk, opts.overlap);
  currentChunk = overlapText + segment;
  currentOffset = segmentOffset - Buffer.byteLength(overlapText, "utf-8");
}
```

#### findOverlapText Function

**Location**: `packages/console-chunking/src/chunk.ts:263-272`

```typescript
function findOverlapText(chunk: string, overlapTokens: number): string {
  const encoder = getEncoder();
  const tokens = encoder.encode(chunk);
  const overlapTokenSlice = tokens.slice(-overlapTokens);  // Last N tokens
  return encoder.decode(overlapTokenSlice);
}
```

**Key Insight**: Overlap is **token-based**, not character-based. The last 50 tokens of chunk N become the first 50 tokens of chunk N+1.

---

### 3. Current Contents Endpoint (Empty)

**Location**: `api/console/src/router/org/contents.ts:91`

```typescript
content: "", // TODO: Phase 2 - Fetch from storage if needed
```

The existing endpoint fetches document metadata but returns empty content. Full content requires reconstruction from chunks.

---

### 4. Industry Best Practices for Reconstruction

#### Standard RAG Approach: Accept Overlap

Most RAG frameworks (LangChain, LlamaIndex) simply concatenate retrieved chunks without deduplication:

```python
def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)
```

**Rationale**: LLMs are robust to redundant context. Overlap is intentionally preserved for semantic continuity.

#### When Deduplication Matters

For `/v1/contents` endpoint returning full document text:
- Overlap creates visible text duplication
- Professional API should return clean content
- Deduplication is necessary for accurate reconstruction

---

## Implementation Guide

### Step 1: Fetch Chunks from Pinecone

```typescript
// packages/console-pinecone/src/client.ts - Add new method

async fetchByMetadata<T extends RecordMetadata = RecordMetadata>(
  indexName: string,
  filter: Record<string, unknown>,
  limit: number = 1000,
  namespace?: string
): Promise<FetchResponse<T>> {
  const index = await this.getIndex(indexName);
  const ns = namespace ? index.namespace(namespace) : index;

  // Use zero vector for metadata-only query
  // Pinecone requires a vector for query, but we only care about filter results
  const results = await ns.query({
    vector: new Array(EMBEDDING_DIMENSION).fill(0),
    topK: limit,
    includeMetadata: true,
    filter,
  });

  return results;
}
```

### Step 2: Query Pattern for Document Chunks

```typescript
// apps/console/src/lib/neural/chunk-reconstruction.ts

import { consolePineconeClient } from "@repo/console-pinecone";
import type { VectorMetadata } from "@repo/console-pinecone";

export async function fetchDocumentChunks(
  indexName: string,
  namespace: string,
  docId: string
): Promise<VectorMetadata[]> {
  const results = await consolePineconeClient.fetchByMetadata<VectorMetadata>(
    indexName,
    { docId: { $eq: docId } },
    1000,  // Max chunks per document
    namespace
  );

  // Extract metadata and sort by chunk index
  return results.matches
    .map(m => m.metadata!)
    .sort((a, b) => a.chunkIndex - b.chunkIndex);
}
```

### Step 3: Overlap Deduplication Algorithm

```typescript
// apps/console/src/lib/neural/chunk-reconstruction.ts

import { getEncoder } from "js-tiktoken";

const DEFAULT_OVERLAP_TOKENS = 50;

/**
 * Reconstructs original document text from overlapping chunks.
 * Uses token-based overlap detection to remove duplicate segments.
 */
export function reconstructFromChunks(
  chunks: VectorMetadata[],
  overlapTokens: number = DEFAULT_OVERLAP_TOKENS
): string {
  if (chunks.length === 0) return "";
  if (chunks.length === 1) return chunks[0].text;

  const encoder = getEncoder();
  let result = chunks[0].text;

  for (let i = 1; i < chunks.length; i++) {
    const currentChunk = chunks[i].text;

    // Get last N tokens from accumulated result
    const resultTokens = encoder.encode(result);
    const overlapFromResult = resultTokens.slice(-overlapTokens);
    const overlapTextFromResult = encoder.decode(overlapFromResult);

    // Get first N tokens from current chunk
    const currentTokens = encoder.encode(currentChunk);
    const overlapFromCurrent = currentTokens.slice(0, overlapTokens);
    const overlapTextFromCurrent = encoder.decode(overlapFromCurrent);

    // Check if overlap matches (allowing for boundary differences)
    if (overlapTextFromResult === overlapTextFromCurrent) {
      // Perfect match - skip overlap
      const nonOverlapTokens = currentTokens.slice(overlapTokens);
      result += encoder.decode(nonOverlapTokens);
    } else {
      // Fuzzy match - use sequence matching
      const trimmed = findAndRemoveOverlap(result, currentChunk, overlapTokens);
      result += trimmed;
    }
  }

  return result;
}

/**
 * Fallback: Use character-based sequence matching for imperfect overlaps.
 * Handles cases where tokenization boundaries differ between chunks.
 */
function findAndRemoveOverlap(
  previous: string,
  current: string,
  expectedOverlapTokens: number
): string {
  // Estimate character count from token count (avg ~4 chars/token)
  const searchWindow = expectedOverlapTokens * 6;

  const previousSuffix = previous.slice(-searchWindow);
  const currentPrefix = current.slice(0, searchWindow);

  // Find longest common substring at the boundary
  let longestMatch = 0;
  let matchEnd = 0;

  for (let i = 1; i <= Math.min(previousSuffix.length, currentPrefix.length); i++) {
    const suffix = previousSuffix.slice(-i);
    const prefix = currentPrefix.slice(0, i);

    if (suffix === prefix && i > longestMatch) {
      longestMatch = i;
      matchEnd = i;
    }
  }

  // Remove matched overlap from current chunk
  if (longestMatch > 0) {
    return current.slice(matchEnd);
  }

  // No overlap found - might indicate data issue or gap
  return current;
}
```

### Step 4: Integration with /v1/contents

```typescript
// apps/console/src/app/(api)/v1/contents/route.ts

import { fetchDocumentChunks, reconstructFromChunks } from "@/lib/neural/chunk-reconstruction";

async function getDocumentContent(
  workspaceId: string,
  docId: string,
  workspace: OrgWorkspace
): Promise<{ content: string; reconstructed: boolean }> {
  // Fetch all chunks for document
  const chunks = await fetchDocumentChunks(
    workspace.indexName!,
    workspace.namespaceName!,
    docId
  );

  if (chunks.length === 0) {
    return { content: "", reconstructed: false };
  }

  // Reconstruct with workspace-specific overlap setting
  const overlapTokens = workspace.chunkOverlap ?? 50;
  const content = reconstructFromChunks(chunks, overlapTokens);

  return { content, reconstructed: true };
}
```

### Step 5: Response Schema Update

```typescript
// packages/console-types/src/api/v1/contents.ts

export const V1DocumentSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  content: z.string(),
  source: z.string(),
  type: z.string(),
  committedAt: z.string().datetime(),
  metadata: z.record(z.unknown()),
  // NEW: Indicate content source
  contentSource: z.enum(["stored", "reconstructed", "unavailable"]),
  chunkCount: z.number().optional(),
  relationships: z.object({
    references: z.array(z.object({
      id: z.string(),
      title: z.string(),
      type: z.string(),
    })),
    referencedBy: z.array(z.object({
      id: z.string(),
      title: z.string(),
      type: z.string(),
    })),
  }).optional(),
});
```

---

## Architecture Decisions

### Why Token-Based Deduplication?

1. **Consistency**: Chunks are created with token-based overlap (`findOverlapText`)
2. **Accuracy**: Character counts vary based on tokenization boundaries
3. **Performance**: tiktoken encoding is fast and deterministic

### Why Fallback to Character Matching?

1. **Edge cases**: Tokenization can differ at chunk boundaries
2. **Data integrity**: Some chunks may have been modified or regenerated
3. **Robustness**: Character matching handles imperfect scenarios

### Why Not Store Full Content?

The current architecture intentionally doesn't store full document content:

1. **Storage efficiency**: Documents can be large; chunks are already stored in Pinecone
2. **Single source of truth**: Pinecone contains authoritative chunk data
3. **Eventual consistency**: Adding a `content` column would require sync logic

**Trade-off**: Reconstruction adds latency but avoids storage duplication.

---

## Code References

| Component | File Path | Lines |
|-----------|-----------|-------|
| Chunk creation | `packages/console-chunking/src/chunk.ts` | 62-189 |
| Overlap extraction | `packages/console-chunking/src/chunk.ts` | 263-272 |
| Vector metadata type | `packages/console-pinecone/src/types.ts` | 19-38 |
| Chunk upsert | `api/console/src/inngest/workflow/processing/process-documents.ts` | 489-509 |
| Vector ID format | `api/console/src/inngest/workflow/processing/process-documents.ts` | 495 |
| Vector chunks table | `db/console/src/schema/tables/workspace-knowledge-vector-chunks.ts` | 21-52 |
| Chunk index | `db/console/src/schema/tables/workspace-knowledge-vector-chunks.ts` | 44 |
| Workspace chunk config | `db/console/src/schema/tables/org-workspaces.ts` | 142-151 |
| Contents endpoint | `api/console/src/router/org/contents.ts` | 35-112 |
| Pinecone query | `packages/console-pinecone/src/client.ts` | 125-131 |
| Filter patterns | `apps/console/src/lib/neural/four-path-search.ts` | 85-113 |

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2025-12-14-neural-memory-week1-day3-search-route.md` - Original open question documented
- `thoughts/shared/plans/2025-12-14-neural-memory-week1-public-api-rerank.md` - Week 1 plan context

---

## Related Research

- `thoughts/shared/research/2025-12-14-neural-memory-week1-day1-rerank-package.md` - Day 1 research
- `thoughts/shared/research/2025-12-14-neural-memory-week1-day2-search-route.md` - Day 2 research
- `thoughts/shared/research/2025-12-14-neural-memory-week1-day3-search-route.md` - Day 3 research

---

## External Resources

- [Pinecone Managing RAG Documents](https://docs.pinecone.io/guides/data/manage-rag-documents) - Chunk metadata patterns
- [LangChain TextSplitter](https://github.com/langchain-ai/langchain) - Reference implementation for overlap handling
- [Dataquest Chunking Strategies](https://www.dataquest.io/blog/document-chunking-strategies-for-vector-databases/) - Best practices

---

## Open Questions (Resolved)

1. **Pinecone fetch-by-metadata**: Use zero vector query with filter - Pinecone requires vector input but filter restricts results
2. **Overlap detection accuracy**: Use token-based matching first, fallback to character sequence matching
3. **Performance**: Consider caching reconstructed content if frequently accessed
4. **Alternative**: Future migration could add `content TEXT` column to documents table for direct storage
