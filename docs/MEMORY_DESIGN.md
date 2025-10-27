# Lightfast Memory Design (2025 Refresh)

> Internal specification for how memories, chunks, and relationships are represented in the durable store, cache, and vector index. This document supersedes the 2024 design that treated Redis or Pinecone metadata as the source of truth.

---

## Concepts at a Glance

```
Workspace
  ├─ Memory (canonical row in PlanetScale)
  │    ├─ Metadata + typed payload
  │    ├─ Raw artifact pointer (S3)
  │    └─ Version history + lineage
  └─ Chunks (1..N rows per memory)
       ├─ Chunk text + descriptors
       ├─ Embedding metadata
       └─ Retrieval features (keywords, sparse tokens)
```

- **Memories** capture the normalized representation of a source object (PR, issue, message, etc.). They are immutable per version; updates create a new version while retaining lineage.
- **Chunks** are retrieval units derived from a memory. Every memory owns one or more chunks (adaptive 200–400 token windows) that get embedded and indexed in Pinecone.
- **Relationships** are stored independently of memories to keep payloads slim and support graph traversal.
- **Raw artifacts** (diffs, transcripts, attachments) live in S3/GCS and are referenced via signed URLs.

---

## Canonical Memory Record

```typescript
interface MemoryRecord {
  id: string;                      // Stable UUID (workspace-unique)
  organizationId: string;
  workspaceId: string;

  source: MemorySource;            // 'github' | 'slack' | ...
  sourceId: string;                // External system identifier
  type: MemoryType;                // 'pull_request', 'issue', ...

  title: string;
  summary: string | null;          // Optional generated synopsis
  state: string | null;            // Business-state (open, merged, etc.)

  rawPointer: string | null;       // S3 key for large bodies / attachments
  contentHash: string;             // Deterministic hash of normalized payload

  metadataJson: JsonValue;         // Structured data (labels, numbers, etc.)
  author: AuthorRef;

  occurredAt: Date;                // When the underlying event happened
  createdAt: Date;                 // When first ingested
  updatedAt: Date;                 // Last sync timestamp
  version: number;                 // Monotonic per memory
  lineage: {
    sourceEventId: string;         // Idempotency key
    ingestedAt: Date;
    previousVersionId: string | null;
  };
}

type MemorySource = 'github' | 'linear' | 'notion' | 'slack' | 'discord' | 'manual';

type MemoryType =
  | 'pull_request'
  | 'issue'
  | 'message'
  | 'doc_page'
  | 'ticket'
  | 'custom';

interface AuthorRef {
  id: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
}
```

**Storage:** `memories` table in PlanetScale with row-level security keyed by `workspace_id`. The JSON payload is normalized (no inline comments arrays); large blobs move to S3 via `raw_pointer`.

---

## Chunk Model

```typescript
interface MemoryChunkRecord {
  id: string;                      // UUID
  memoryId: string;                // FK → memories.id
  workspaceId: string;
  chunkIndex: number;              // 0-based ordering

  text: string;                    // 200–400 token slice, overlap 10–15%
  tokenCount: number;
  sectionLabel?: string;           // Heading / file path / speaker

  embeddingModel: string;          // e.g., "voyage-large-2"
  embeddingVersion: string;        // Semver-like, maps to namespaces
  chunkHash: string;               // For idempotent updates

  keywords: string[];              // Optional lexical hints
  sparseVector?: SparseEncoding;   // SPLADE / BM25 features

  createdAt: Date;
  supersededAt: Date | null;       // For versioning
}

interface SparseEncoding {
  indices: number[];
  values: number[];
}
```

- Chunks live in `memory_chunks` (PlanetScale). When a memory updates, we soft-delete old chunks by setting `superseded_at` and insert replacements.
- Pinecone stores the embedding vector + light metadata (`workspaceId`, `memoryId`, `chunkIndex`, `chunkHash`, `type`, timestamps) in <1 KB.
- Redis caches hot chunk bundles (`memory:{id}:chunks`) for fast hydration, but the authoritative store is PlanetScale.

---

## Relationship Graph

```typescript
interface MemoryRelationshipRecord {
  id: string;
  workspaceId: string;
  fromMemoryId: string;
  toMemoryId: string;
  relationshipType: 'mentions' | 'links_to' | 'blocks' | 'duplicates' | 'closes';
  confidence: number;              // 0–1 score from extractor
  createdAt: Date;
  detectedBy: 'regex' | 'llm' | 'manual';
}
```

- Stored in `memory_relationships` with indexes on `from_memory_id` and `to_memory_id`.
- Relationship adjacency lists can be materialized in Redis for fast UI traversal (`refs:{memoryId}:outbound`, etc.), but Postgres remains the source of truth.

---

## Memory Payload Shapes

Rather than embedding all comments/reviews directly in the memory row, we store structured payloads under `metadata_json`. Example discriminated union used by the application layer:

```typescript
type MemoryPayload =
  | GitHubPullRequestPayload
  | GitHubIssuePayload
  | SlackMessagePayload
  | LinearIssuePayload
  | NotionPagePayload
  | GenericPayload;

interface GitHubPullRequestPayload {
  type: 'pull_request';
  number: number;
  repository: string;
  branch: { base: string; head: string };
  stats: { additions: number; deletions: number; changedFiles: number; commits: number };
  reviewers: AuthorRef[];
  labels: string[];
  timeline: Array<PRTimelineItem>;
}

type PRTimelineItem =
  | { kind: 'review'; id: string; state: 'approved' | 'changes_requested' | 'commented'; body: string; author: AuthorRef; submittedAt: Date }
  | { kind: 'comment'; id: string; body: string; author: AuthorRef; path?: string; line?: number; createdAt: Date }
  | { kind: 'event'; name: string; actor: AuthorRef; occurredAt: Date };
```

The application layer uses Prisma/TypeScript types that mirror these payloads. Chunks draw from a renderer that flattens the payload into semantically meaningful text windows (body, reviews, latest comments, code context).

---

## Versioning & Idempotency

- `content_hash` is a SHA-256 of the normalized payload (excluding timestamps). It prevents unnecessary rewrites and lets ingestion skip Pinecone updates when nothing changed.
- `version` increments whenever the memory or any chunk changes. `lineage.previous_version_id` links to the prior row for audit trails.
- Soft-deleting chunks (setting `superseded_at`) maintains historical embeddings for replay; a nightly job can purge superseded chunks older than 30 days once evaluations pass.

---

## Caching Contract (Redis)

```
memory:{memoryId}            → MemoryRecord JSON (TTL 72h)
chunks:{memoryId}:v{version} → Array<MemoryChunkRecord> (TTL 24h)
refs:{memoryId}:outbound     → Set<string> (TTL 6h, refresh on access)
refs:{memoryId}:inbound      → Set<string>
source-dedupe:{sourceKey}    → contentHash (TTL 24h)
```

- Redis is purely opportunistic. Cache misses fall back to PlanetScale.
- Versioned chunk keys allow gradual cache invalidation: when a new version lands, we prime `chunks:{id}:v{version}` before expiring the previous entry.

---

## Access Control & Tenancy

- All memory/chunk/relationship rows include `workspace_id`. Row-level security policies restrict reads and writes by workspace token.
- Pinecone namespaces mirror `workspace_id` + `embedding_version`.
- S3 prefixes follow `workspaces/{workspaceId}/memories/{memoryId}/...` to make bulk deletion and export straightforward.

---

## When to Create a New Memory

1. The source object does not exist in `memories` (no row with the same `source_id` + `workspace_id`).
2. The normalized payload hash differs from the stored `content_hash`.
3. We perform a manual override (e.g., admin ingestion) that requires a forced new version.

For soft-deleted or archived source items, we set `state` accordingly and mark chunks as superseded; we keep the memory row for audit purposes until retention policies purge it.

---

## Derived Types for Clients

The API layer projects `MemoryRecord` + payload into response DTOs:

```typescript
interface MemorySummary {
  id: string;
  title: string;
  type: MemoryType;
  source: MemorySource;
  author: AuthorRef;
  occurredAt: Date;
  updatedAt: Date;
  state?: string | null;
  snippet?: string;            // Computed from top chunk
  labels?: string[];
}

type MemoryDetail = MemorySummary & {
  summary?: string | null;
  payload: MemoryPayload;
  relationships: {
    outbound: Array<{ memoryId: string; relationshipType: string }>;
    inbound: Array<{ memoryId: string; relationshipType: string }>;
  };
  chunks: Array<{
    chunkIndex: number;
    text: string;
    sectionLabel?: string;
  }>;
};
```

Clients must never assume Redis or Pinecone hold complete payloads; they always hydrate from the durable store (with cache assist) using `memoryId` + `version`.

---

## Open Questions

- Should we persist fully rendered HTML alongside raw text for UI speed? (Likely in S3 next to the raw pointer.)
- How aggressively do we compress large chunk bundles? (Experiment with zstd once workloads grow.)
- Do we expose previous versions to end users or keep them for observability only?

These will be resolved during implementation sprints and reflected here when decisions land.

---

_Last reviewed: 2025-02-10_
