---
date: 2025-12-14T07:15:23Z
researcher: Claude
git_commit: 5bc0bf4322d8d478b2ad6311f812804741137ec8
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Neural Memory Week 1 Day 3: /v1/contents + /v1/findsimilar Implementation"
tags: [research, neural-memory, public-api, v1-routes, contents, findsimilar, day3]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
last_updated_note: "Deferred includeRelationships to Day 4+ - MVP Day 3 without relationships"
---

# Research: Neural Memory Week 1 Day 3 Implementation

**Date**: 2025-12-14T07:15:23Z
**Researcher**: Claude
**Git Commit**: 5bc0bf4322d8d478b2ad6311f812804741137ec8
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Document all existing patterns needed to implement Day 3 of the Neural Memory Week 1 plan: `/v1/contents` and `/v1/findsimilar` routes.

## Summary

This document maps all existing code patterns required to implement the Day 3 endpoints. The `/v1/contents` endpoint extends the existing tRPC contents router to support both documents and observations. The `/v1/findsimilar` endpoint combines Pinecone vector queries with entity overlap boosting and cluster context enrichment.

> **Scope Update (2025-12-14)**: `includeRelationships` feature deferred to Day 4+. Day 3 MVP delivers `/v1/contents` and `/v1/findsimilar` without relationship enrichment. See `thoughts/shared/research/2025-12-14-neural-memory-relationship-graph-design.md` for deferred relationship implementation.

### Key Implementation Files to Create

```
apps/console/src/app/(api)/v1/
├── contents/
│   └── route.ts              # POST /v1/contents
└── findsimilar/
    └── route.ts              # POST /v1/findsimilar

packages/console-types/src/api/v1/
├── contents.ts               # Contents schemas
└── findsimilar.ts            # FindSimilar schemas
```

---

## Detailed Findings

### 1. Existing tRPC Contents Implementation

**Location**: `api/console/src/router/org/contents.ts:35-112`

The existing contents router provides the foundation pattern for the v1 endpoint:

#### Request/Response Flow

1. **Authentication**: Uses `apiKeyProcedure` requiring `Authorization: Bearer <key>` and `X-Workspace-ID` headers
2. **Input Validation**: Accepts array of 1-50 document IDs via `ContentsRequestSchema`
3. **Database Query**: Fetches from `workspaceKnowledgeDocuments` table with workspace isolation
4. **Response Mapping**: Extracts frontmatter from `sourceMetadata` JSONB field

#### Current Limitations (to extend for v1)

- Only fetches documents, not observations (`obs_*` IDs)
- Content field is stubbed (empty string) - documented as "Phase 2 - Fetch from storage"
- No relationship enrichment support
- No format conversion (markdown/text/html)

#### Key Code Pattern (lines 51-65)

```typescript
const documents = await db
  .select({
    id: workspaceKnowledgeDocuments.id,
    sourceType: workspaceKnowledgeDocuments.sourceType,
    sourceId: workspaceKnowledgeDocuments.sourceId,
    sourceMetadata: workspaceKnowledgeDocuments.sourceMetadata,
    workspaceId: workspaceKnowledgeDocuments.workspaceId,
  })
  .from(workspaceKnowledgeDocuments)
  .where(
    and(
      inArray(workspaceKnowledgeDocuments.id, input.ids),
      eq(workspaceKnowledgeDocuments.workspaceId, ctx.auth.workspaceId)
    )
  );
```

---

### 2. Database Schema for Documents and Observations

#### workspaceKnowledgeDocuments Table

**Location**: `db/console/src/schema/tables/workspace-knowledge-documents.ts:26-81`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | varchar(191) | Primary key, prefixed with `doc_` |
| `workspaceId` | varchar(191) | Foreign key with cascade delete |
| `sourceType` | varchar(50) | Discriminator: "github", "linear", etc. |
| `sourceId` | varchar(255) | Source-specific ID (file path, issue ID) |
| `sourceMetadata` | jsonb | Flexible metadata including frontmatter |
| `relationships` | jsonb | Cross-document links (nullable) |
| `slug` | varchar(256) | URL-friendly identifier |
| `contentHash` | varchar(64) | SHA-256 for change detection |

**Unique Index**: `(workspaceId, sourceType, sourceId)` at lines 75-79

#### workspaceNeuralObservations Table

**Location**: `db/console/src/schema/tables/workspace-neural-observations.ts:46-221`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | varchar(191) | Primary key, prefixed with `obs_` |
| `workspaceId` | varchar(191) | Foreign key with cascade delete |
| `title` | text | Short title (≤120 chars) |
| `content` | text | Full content for embedding |
| `observationType` | varchar(100) | Type: "pr_merged", "deployment_succeeded" |
| `source` | varchar(50) | Source system: github, vercel, linear |
| `sourceId` | varchar(255) | Unique source identifier |
| `sourceReferences` | jsonb | References to related entities |
| `metadata` | jsonb | Source-specific metadata |
| `occurredAt` | timestamp | When event occurred |
| `embeddingTitleId` | varchar(191) | Title embedding vector ID |
| `embeddingContentId` | varchar(191) | Content embedding vector ID |
| `embeddingSummaryId` | varchar(191) | Summary embedding vector ID |
| `clusterId` | varchar(191) | Cluster assignment (nullable) |

---

### 3. Pinecone Query Patterns

**Location**: `packages/console-pinecone/src/client.ts:125-131`

#### Vector Query Implementation

```typescript
async query<T extends RecordMetadata = RecordMetadata>(
  indexName: string,
  request: QueryRequest,
  namespace?: string
): Promise<QueryResponse<T>>
```

**Parameters**:
- `vector`: Query embedding (number[])
- `topK`: Result limit
- `filter`: Metadata filter object
- `includeMetadata`: Defaults to `true`

#### Filter Syntax Examples

From `apps/console/src/lib/neural/cluster-search.ts:35`:
```typescript
filter: { layer: { $eq: "clusters" } }
```

From `packages/console-test-data/src/verifier/verifier.ts:151`:
```typescript
filter: { layer: { $eq: "observations" }, view: { $eq: "title" } }
```

#### Namespace Format

From `packages/console-config/src/private-config.ts:49`:
```
org_{clerkOrgId}:ws_{workspaceId}
```

---

### 4. Embedding Generation Patterns

**Location**: `packages/console-embed/src/utils.ts:89-98`

#### createEmbeddingProvider Function

```typescript
export function createEmbeddingProvider(inputType: CohereInputType = "search_query") {
  return new CohereEmbedding({
    apiKey: embedEnv.COHERE_API_KEY,
    model: EMBEDDING_CONFIG.cohere.model,  // "embed-english-v3.0"
    inputType,
    dimension: EMBEDDING_CONFIG.cohere.dimension,  // 1024
  });
}
```

#### Input Types

- `"search_query"`: For user search queries
- `"search_document"`: For document/observation indexing

#### Batch Processing

From `packages/console-embed/src/utils.ts:175-194`:
```typescript
async function embedTextsInBatches(
  provider: EmbeddingProvider,
  texts: string[],
  batchSize: number = 96  // Cohere API limit
): Promise<number[][]>
```

---

### 5. Entity Search for Similarity Boosting

**Location**: `apps/console/src/lib/neural/entity-search.ts:85-102`

#### Entity Lookup Pattern

```typescript
const matchedEntities = await db
  .select({
    id: workspaceNeuralEntities.id,
    key: workspaceNeuralEntities.key,
    category: workspaceNeuralEntities.category,
    sourceObservationId: workspaceNeuralEntities.sourceObservationId,
    occurrenceCount: workspaceNeuralEntities.occurrenceCount,
    confidence: workspaceNeuralEntities.confidence,
  })
  .from(workspaceNeuralEntities)
  .where(
    and(
      eq(workspaceNeuralEntities.workspaceId, workspaceId),
      inArray(workspaceNeuralEntities.key, entityKeys)
    )
  )
  .orderBy(desc(workspaceNeuralEntities.occurrenceCount));
```

#### Entity-Observation Linkage

From `apps/console/src/lib/neural/four-path-search.ts:367-379`:
```typescript
const entities = await db
  .select({
    observationId: workspaceNeuralEntities.sourceObservationId,
    key: workspaceNeuralEntities.key,
    category: workspaceNeuralEntities.category,
  })
  .from(workspaceNeuralEntities)
  .where(
    and(
      eq(workspaceNeuralEntities.workspaceId, workspaceId),
      inArray(workspaceNeuralEntities.sourceObservationId, resultIds)
    )
  );
```

---

### 6. Cluster Context for FindSimilar

**Location**: `apps/console/src/lib/neural/cluster-search.ts:30-79`

#### Cluster Centroid Query

```typescript
const clusterResults = await consolePineconeClient.query(
  indexName,
  {
    vector: queryEmbedding,
    topK,
    filter: { layer: { $eq: "clusters" } },
    includeMetadata: true,
  },
  namespace
);
```

#### Cluster Metadata Join

```typescript
const clusterData = await db
  .select({
    id: workspaceObservationClusters.id,
    topicLabel: workspaceObservationClusters.topicLabel,
    topicEmbeddingId: workspaceObservationClusters.topicEmbeddingId,
    keywords: workspaceObservationClusters.keywords,
    observationCount: workspaceObservationClusters.observationCount,
  })
  .from(workspaceObservationClusters)
  .where(
    and(
      eq(workspaceObservationClusters.workspaceId, workspaceId),
      inArray(workspaceObservationClusters.topicEmbeddingId, clusterEmbeddingIds)
    )
  );
```

---

### 7. V1 Type Definitions (Existing)

**Location**: `packages/console-types/src/api/v1/search.ts`

#### Key Schemas to Reference

- `RerankModeSchema` (lines 15-16): `"fast" | "balanced" | "thorough"`
- `V1SearchFiltersSchema` (lines 21-35): sourceTypes, observationTypes, actorNames, dateRange
- `V1SearchResultSchema` (lines 64-97): id, title, url, snippet, score, entities, highlights
- `V1SearchContextSchema` (lines 104-124): clusters, relevantActors

#### Pattern for New V1 Schemas

```typescript
export const V1ContentsRequestSchema = z.object({
  ids: z.array(z.string()).min(1).max(50),
  includeRelationships: z.boolean().default(false),
  format: z.enum(["markdown", "text", "html"]).default("markdown"),
  maxLength: z.number().int().positive().optional(),
});
export type V1ContentsRequest = z.infer<typeof V1ContentsRequestSchema>;
```

---

## Code References

### Day 3 Implementation Sources

| Component | File Path | Lines |
|-----------|-----------|-------|
| tRPC contents router | `api/console/src/router/org/contents.ts` | 35-112 |
| API key procedure | `api/console/src/trpc.ts` | 530-576 |
| API key verification | `api/console/src/trpc.ts` | 790-850 |
| Documents table | `db/console/src/schema/tables/workspace-knowledge-documents.ts` | 26-81 |
| Observations table | `db/console/src/schema/tables/workspace-neural-observations.ts` | 46-221 |
| Entities table | `db/console/src/schema/tables/workspace-neural-entities.ts` | 25-154 |
| Clusters table | `db/console/src/schema/tables/workspace-observation-clusters.ts` | 17-138 |
| Pinecone client | `packages/console-pinecone/src/client.ts` | 125-131 |
| Pinecone config | `packages/console-config/src/private-config.ts` | 34-122 |
| Embedding provider | `packages/console-embed/src/utils.ts` | 89-98 |
| Entity search | `apps/console/src/lib/neural/entity-search.ts` | 85-102 |
| Cluster search | `apps/console/src/lib/neural/cluster-search.ts` | 30-79 |
| Four-path search | `apps/console/src/lib/neural/four-path-search.ts` | 167-421 |
| V1 search schemas | `packages/console-types/src/api/v1/search.ts` | 1-191 |
| Base contents schemas | `packages/console-types/src/api/contents.ts` | 1-52 |

---

## Implementation Guide

### /v1/contents Route

#### 1. Create Type Schemas

```typescript
// packages/console-types/src/api/v1/contents.ts

import { z } from "zod";

export const V1ContentsRequestSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one ID required").max(50, "Maximum 50 IDs"),
  includeRelationships: z.boolean().default(false),
  format: z.enum(["markdown", "text", "html"]).default("markdown"),
  maxLength: z.number().int().positive().optional(),
});

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

export const V1ContentsResponseSchema = z.object({
  documents: z.array(V1DocumentSchema),
  missing: z.array(z.string()),
  requestId: z.string(),
});
```

#### 2. Route Implementation Pattern

```typescript
// apps/console/src/app/(api)/v1/contents/route.ts

export async function POST(request: NextRequest) {
  // 1. Authenticate via withApiKeyAuth
  const authResult = await withApiKeyAuth(request);
  if (authResult.error) return authResult.errorResponse;

  const { workspaceId } = authResult.auth;

  // 2. Parse request
  const body = await request.json();
  const { ids, includeRelationships, format, maxLength } = V1ContentsRequestSchema.parse(body);

  // 3. Separate IDs by prefix
  const docIds = ids.filter(id => id.startsWith("doc_"));
  const obsIds = ids.filter(id => id.startsWith("obs_"));

  // 4. Fetch in parallel
  const [documents, observations] = await Promise.all([
    fetchDocuments(workspaceId, docIds),
    fetchObservations(workspaceId, obsIds),
  ]);

  // 5. Optional: Enrich with relationships
  const enriched = includeRelationships
    ? await enrichWithRelationships([...documents, ...observations])
    : [...documents, ...observations];

  // 6. Format content
  const formatted = formatContent(enriched, format, maxLength);

  // 7. Track missing
  const foundIds = new Set(formatted.map(d => d.id));
  const missing = ids.filter(id => !foundIds.has(id));

  return NextResponse.json({
    documents: formatted,
    missing,
    requestId: randomUUID(),
  });
}
```

### /v1/findsimilar Route

#### 1. Create Type Schemas

```typescript
// packages/console-types/src/api/v1/findsimilar.ts

import { z } from "zod";
import { V1SearchFiltersSchema } from "./search";

export const V1FindSimilarRequestSchema = z.object({
  id: z.string().optional(),
  url: z.string().url().optional(),
  limit: z.number().int().min(1).max(50).default(10),
  threshold: z.number().min(0).max(1).default(0.5),
  sameSourceOnly: z.boolean().default(false),
  excludeIds: z.array(z.string()).optional(),
  filters: V1SearchFiltersSchema.optional(),
  includeSnippets: z.boolean().default(true),
}).refine(data => data.id || data.url, {
  message: "Either id or url must be provided",
});

export const V1FindSimilarResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  snippet: z.string().optional(),
  score: z.number(),
  vectorSimilarity: z.number(),
  entityOverlap: z.number().optional(),
  sameCluster: z.boolean(),
  source: z.string(),
  type: z.string(),
  occurredAt: z.string().datetime(),
});

export const V1FindSimilarResponseSchema = z.object({
  source: z.object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
    cluster: z.object({
      topic: z.string().nullable(),
      memberCount: z.number(),
    }).optional(),
  }),
  similar: z.array(V1FindSimilarResultSchema),
  meta: z.object({
    total: z.number(),
    took: z.number(),
    inputEmbedding: z.object({
      found: z.boolean(),
      generated: z.boolean(),
    }),
  }),
  requestId: z.string(),
});
```

#### 2. Route Implementation Pattern

```typescript
// apps/console/src/app/(api)/v1/findsimilar/route.ts

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 1. Authenticate
  const authResult = await withApiKeyAuth(request);
  if (authResult.error) return authResult.errorResponse;

  const { workspaceId } = authResult.auth;

  // 2. Parse request
  const body = await request.json();
  const { id, url, limit, threshold, sameSourceOnly, excludeIds, filters, includeSnippets } =
    V1FindSimilarRequestSchema.parse(body);

  // 3. Resolve source document
  const sourceDoc = id
    ? await fetchDocumentOrObservation(workspaceId, id)
    : await resolveByUrl(workspaceId, url!);

  if (!sourceDoc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // 4. Get or generate embedding
  let embeddingFound = true;
  let embedding = sourceDoc.embedding;
  if (!embedding) {
    const provider = createEmbeddingProvider("search_document");
    const result = await provider.embed([sourceDoc.content]);
    embedding = result.embeddings[0];
    embeddingFound = false;
  }

  // 5. Query Pinecone (over-fetch for filtering)
  const pineconeResults = await consolePineconeClient.query(
    getIndexName(),
    {
      vector: embedding,
      topK: limit * 2,
      filter: buildFilters(filters, sameSourceOnly ? sourceDoc.source : undefined),
      includeMetadata: true,
    },
    buildNamespace(workspaceId)
  );

  // 6. Exclude source and specified IDs
  const exclusions = new Set([sourceDoc.id, ...(excludeIds || [])]);
  const filtered = pineconeResults.matches.filter(m => !exclusions.has(m.id));

  // 7. Apply threshold
  const thresholded = filtered.filter(m => m.score >= threshold);

  // 8. Calculate entity overlap (if source has entities)
  const sourceEntities = await fetchEntitiesForDocument(workspaceId, sourceDoc.id);
  const withOverlap = await calculateEntityOverlap(thresholded, sourceEntities);

  // 9. Enrich with cluster context
  const enriched = await enrichWithClusterContext(withOverlap, sourceDoc.clusterId);

  // 10. Limit results
  const limited = enriched.slice(0, limit);

  return NextResponse.json({
    source: {
      id: sourceDoc.id,
      title: sourceDoc.title,
      type: sourceDoc.type,
      cluster: sourceDoc.clusterId ? await getClusterInfo(sourceDoc.clusterId) : undefined,
    },
    similar: limited.map(r => ({
      ...r,
      snippet: includeSnippets ? r.snippet : undefined,
    })),
    meta: {
      total: thresholded.length,
      took: Date.now() - startTime,
      inputEmbedding: {
        found: embeddingFound,
        generated: !embeddingFound,
      },
    },
    requestId: randomUUID(),
  });
}
```

---

## Architecture Documentation

### ID Prefix Convention

- `doc_*` - Documents from `workspaceKnowledgeDocuments` table
- `obs_*` - Observations from `workspaceNeuralObservations` table
- `ent_*` - Entities from `workspaceNeuralEntities` table
- `cluster_*` - Clusters from `workspaceObservationClusters` table

### Multi-View Embedding Architecture

Observations store 3 separate embeddings for different retrieval scenarios:
- `embeddingTitleId` - Title-only for headline matching
- `embeddingContentId` - Full content for detailed search
- `embeddingSummaryId` - Title + truncated content for balanced matching

### Namespace Isolation

All Pinecone queries use workspace-scoped namespaces:
```
org_{clerkOrgId}:ws_{workspaceId}
```

### Similarity Score Composition (FindSimilar)

For thorough similarity matching:
1. **Vector Similarity** (primary): Cosine similarity from Pinecone
2. **Entity Overlap** (secondary boost): Ratio of shared entities
3. **Cluster Membership** (context): Boolean flag for same topic cluster

---

## Content Storage Architecture

### Critical Finding: Documents vs Observations Have Different Storage

The codebase has **two separate data flows** with different content storage strategies:

### Observations (Webhook Events: PRs, Issues, Deployments)

**Full content IS stored in the database.**

| Storage Location | What's Stored | Access Pattern |
|-----------------|---------------|----------------|
| `workspaceWebhookPayloads.payload` | Raw JSON - complete webhook payload | Lookup by `deliveryId` |
| `workspaceNeuralObservations.title` | Sanitized title (text column) | Direct column access |
| `workspaceNeuralObservations.content` | Sanitized body (text, max 10KB) | Direct column access |
| `workspaceNeuralObservations.metadata.deliveryId` | Links back to raw payload | Join to webhook payloads |
| Pinecone | Embeddings only (title/content/summary views) | Vector search |

**Key Files**:
- `db/console/src/schema/tables/workspace-webhook-payloads.ts:23-108` - Raw payload storage
- `db/console/src/schema/tables/workspace-neural-observations.ts:111-116` - title/content columns
- `packages/console-webhooks/src/storage.ts:22-43` - `storeWebhookPayload()` function
- `packages/console-webhooks/src/sanitize.ts:10-13` - MAX_BODY_LENGTH = 10,000 chars

**Transformer Pattern** (extracts content from webhook):
```typescript
// packages/console-webhooks/src/transformers/github.ts:189-201
const rawBody = [pr.title, pr.body || ""].join("\n");
const event: SourceEvent = {
  title: sanitizeTitle(`[${actionTitle}] ${pr.title.slice(0, 100)}`),
  body: sanitizeBody(rawBody),  // Stored in observations.content
  // ...
};
```

### Documents (GitHub File Sync)

**Full content is NOT stored** - only metadata and Pinecone chunks.

| Storage Location | What's Stored | Access Pattern |
|-----------------|---------------|----------------|
| `workspaceKnowledgeDocuments` | Metadata only (no content column) | By document ID |
| `workspaceKnowledgeDocuments.sourceMetadata` | Frontmatter, commit info | JSONB field |
| `workspaceKnowledgeDocuments.contentHash` | SHA-256 for change detection | Comparison only |
| Pinecone `VectorMetadata.text` | Chunk text (~512 tokens each) | Vector search |

**Content Flow** (passes through but not persisted):
```
GitHub API → Inngest Event (content field) → chunkText() → Pinecone upsert → content discarded
```

**Key Files**:
- `api/console/src/inngest/client/client.ts:468-483` - Event schema with `content: z.string()`
- `api/console/src/inngest/workflow/processing/process-documents.ts:171` - `chunkText(event.data.content, ...)`
- `api/console/src/router/org/contents.ts:91` - `content: "", // TODO: Phase 2 - Fetch from storage`

### Implementation Strategy for `/v1/contents`

Given this architecture:

1. **For `obs_*` IDs**:
   - Return `title` + `content` directly from `workspaceNeuralObservations` table
   - Full content available immediately
   - Optional: Link to raw webhook via `metadata.deliveryId` → `workspaceWebhookPayloads`

2. **For `doc_*` IDs** (options):
   - **Option A**: Reconstruct from Pinecone chunks (lossy - chunks have overlap/truncation)
   - **Option B**: Add `content TEXT` column to documents table (requires migration)
   - **Option C**: Return metadata only, require separate fetch from source (GitHub API)

**Recommended MVP**: Support `obs_*` IDs with full content. For `doc_*` IDs, return metadata + reconstructed content from chunks (with `contentReconstructed: true` flag).

---

## URL Resolution Architecture

### Problem Statement

The `/v1/findsimilar` endpoint accepts either `id` or `url` as input. When a URL is provided (e.g., `https://github.com/owner/repo/pull/123`), we need to resolve it to an internal document/observation ID.

### Solution: sourceId-Based Resolution

**Key Insight**: URLs are not stored directly, but `sourceId` follows deterministic patterns that can be reverse-engineered from URLs.

### sourceId Patterns (from GitHub transformers)

| GitHub URL Pattern | sourceId Format | Source |
|-------------------|-----------------|--------|
| `github.com/owner/repo/pull/123` | `pr:owner/repo#123:{action}` | `github.ts:199` |
| `github.com/owner/repo/issues/45` | `issue:owner/repo#45:{action}` | `github.ts:291` |
| `github.com/owner/repo/commit/abc123` | `push:owner/repo:abc123` | `github.ts:73` |
| `github.com/owner/repo/releases/tag/v1.0` | `release:owner/repo:v1.0` | `github.ts:356` |
| `github.com/owner/repo/discussions/10` | `discussion:owner/repo#10` | `github.ts:426` |

### Implementation Strategy

#### 1. URL Parser Function

```typescript
// packages/console-url-resolver/src/parse-github-url.ts

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  type: "pr" | "issue" | "commit" | "release" | "discussion" | "file";
  identifier: string;
}

const URL_PATTERNS = [
  { regex: /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/, type: "pr" },
  { regex: /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/, type: "issue" },
  { regex: /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/commit\/([a-f0-9]+)/, type: "commit" },
  { regex: /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/releases\/tag\/(.+)/, type: "release" },
  { regex: /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/discussions\/(\d+)/, type: "discussion" },
] as const;

export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  for (const { regex, type } of URL_PATTERNS) {
    const match = url.match(regex);
    if (match) {
      return { owner: match[1], repo: match[2], type, identifier: match[3] };
    }
  }
  return null;
}
```

#### 2. sourceId Builder (handles action variants)

```typescript
export function buildSourceIdCandidates(parsed: ParsedGitHubUrl): string[] {
  const repoPath = `${parsed.owner}/${parsed.repo}`;

  switch (parsed.type) {
    case "pr":
      // URL doesn't indicate action state - query all variants
      return [
        `pr:${repoPath}#${parsed.identifier}:merged`,
        `pr:${repoPath}#${parsed.identifier}:closed`,
        `pr:${repoPath}#${parsed.identifier}:opened`,
        `pr:${repoPath}#${parsed.identifier}:reopened`,
      ];
    case "issue":
      return [
        `issue:${repoPath}#${parsed.identifier}:closed`,
        `issue:${repoPath}#${parsed.identifier}:opened`,
        `issue:${repoPath}#${parsed.identifier}:reopened`,
      ];
    case "commit":
      return [`push:${repoPath}:${parsed.identifier}`];
    case "release":
      return [
        `release:${repoPath}:${parsed.identifier}:published`,
        `release:${repoPath}:${parsed.identifier}:created`,
      ];
    case "discussion":
      return [`discussion:${repoPath}#${parsed.identifier}`];
    default:
      return [];
  }
}
```

#### 3. Resolution Query

```typescript
// apps/console/src/lib/neural/url-resolver.ts

import { and, desc, eq, inArray } from "drizzle-orm";

export async function resolveByUrl(
  db: Database,
  workspaceId: string,
  url: string
): Promise<{ id: string; type: "observation" | "document" } | null> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) return null;

  const sourceIdCandidates = buildSourceIdCandidates(parsed);

  // Query observations using indexed sourceId lookup
  const observation = await db.query.workspaceNeuralObservations.findFirst({
    columns: { id: true },
    where: and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      inArray(workspaceNeuralObservations.sourceId, sourceIdCandidates)
    ),
    orderBy: [desc(workspaceNeuralObservations.occurredAt)],
  });

  if (observation) {
    return { id: observation.id, type: "observation" };
  }

  // For file URLs, check documents table
  if (parsed.type === "file") {
    const document = await db.query.workspaceKnowledgeDocuments.findFirst({
      columns: { id: true },
      where: and(
        eq(workspaceKnowledgeDocuments.workspaceId, workspaceId),
        eq(workspaceKnowledgeDocuments.sourceType, "github"),
        eq(workspaceKnowledgeDocuments.sourceId, parsed.identifier)
      ),
    });

    if (document) {
      return { id: document.id, type: "document" };
    }
  }

  return null;
}
```

### Why This Approach

| Benefit | Explanation |
|---------|-------------|
| **Uses existing index** | `obs_source_id_idx` on `(workspaceId, sourceId)` |
| **No schema migration** | Works with current database structure |
| **Deterministic** | Same URL always produces same sourceId candidates |
| **Handles action variants** | PR URL doesn't say "merged" - query all possibilities |
| **Extensible** | Add new URL patterns without schema changes |

### Fallback: metadata.url Query

If sourceId parsing fails or for non-standard URLs, query the JSONB metadata field:

```typescript
// Fallback (slower, not indexed)
const observation = await db
  .select({ id: workspaceNeuralObservations.id })
  .from(workspaceNeuralObservations)
  .where(
    and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      sql`${workspaceNeuralObservations.metadata}->>'url' = ${url}`
    )
  )
  .limit(1);
```

### Integration with /v1/findsimilar Route

```typescript
// apps/console/src/app/(api)/v1/findsimilar/route.ts

export async function POST(request: NextRequest) {
  // ... auth ...

  const { id, url, ...options } = V1FindSimilarRequestSchema.parse(body);

  // Resolve source document/observation
  let sourceId: string;
  if (id) {
    sourceId = id;
  } else {
    const resolved = await resolveByUrl(db, workspaceId, url!);
    if (!resolved) {
      return NextResponse.json(
        { error: "URL not found in workspace" },
        { status: 404 }
      );
    }
    sourceId = resolved.id;
  }

  // Continue with vector similarity search using sourceId...
}
```

### Future Considerations

1. **URL Normalization**: Strip trailing slashes, normalize fragments
2. **Vercel/Linear Support**: Add parsers for other source systems
3. **Canonical URL Index**: If URL lookups become frequent, consider adding indexed `canonicalUrl` column

---

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2025-12-14-neural-memory-week1-public-api-rerank.md` - Week 1 plan with daily breakdown
- `thoughts/shared/research/2025-12-14-public-api-v1-route-design.md` - Complete API design spec

---

## Related Research

- `thoughts/shared/research/2025-12-14-neural-memory-week1-day1-rerank-package.md` - Day 1 rerank package research
- `thoughts/shared/research/2025-12-14-neural-memory-week1-day2-search-route.md` - Day 2 search route research
- `thoughts/shared/research/2025-12-14-neural-memory-relationship-graph-design.md` - Relationship graph table design (resolves Open Question #3)

---

## Open Questions

1. ~~**Content Storage**: How to fetch full document content for v1/contents?~~ **RESOLVED**: Observations have full content in DB. Documents require chunk reconstruction or future storage migration. See "Content Storage Architecture" section above.

2. ~~**URL Resolution**: For `/v1/findsimilar` with URL input, how to resolve URL to document/observation ID?~~ **RESOLVED**: Parse URL to extract components, construct sourceId patterns, query using existing `obs_source_id_idx` index. See "URL Resolution Architecture" section below.

3. **Relationship Graph**: For `includeRelationships: true`, what query pattern retrieves bidirectional references (references + referencedBy)? **DEFERRED to Day 4+**: Requires dedicated `workspace_content_relationships` table with dual indexes. Design complete in `thoughts/shared/research/2025-12-14-neural-memory-relationship-graph-design.md`. Day 3 MVP ships without `includeRelationships` parameter.

4. ~~**Chunk Reconstruction**: For documents, how to reassemble chunks from Pinecone?~~ **RESOLVED**: Query by `filter: { docId: { $eq: id } }`, sort by `chunkIndex`, use token-based overlap detection for deduplication. See `thoughts/shared/research/2025-12-14-chunk-reconstruction-patterns.md` for complete implementation guide.
