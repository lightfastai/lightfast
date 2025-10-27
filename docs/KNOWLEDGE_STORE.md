# Knowledge Store (Chunked Retrieval Layer)

Last Updated: 2025-10-27

The Knowledge Store is Lightfast’s retrieval layer: normalized source artifacts (documents) split into chunks, embedded, and retrieved via a hybrid pipeline. “Memory” refers to the relationships‑first graph layer (entities/relationships/beliefs) documented in `docs/MEMORY_GRAPH_DESIGN.md`.

---

## Executive Summary

- Source of truth: PlanetScale rows for documents and chunk descriptors; large raw artifacts live in S3.
- Indexing: 200–400 token chunking with overlap; embeddings in Pinecone with lean metadata; optional sparse vectors.
- Retrieval: lexical prefilter + dense search + optional rerank; hydrate from Redis/PlanetScale.
- Versioning: deterministic `content_hash` and immutable versions; chunk supersession on change.
- Observability: retrieval logs, embedding versions, and feedback for continuous evaluation.

This document defines the Knowledge Store schema and retrieval interplay.

---

## Concepts

- Knowledge Document: canonical normalized representation of a source artifact (PR, issue, page, message, etc.).
- Knowledge Chunk: retrieval unit derived from a document; embedded and indexed.
- Raw Artifact: large body/diff/attachment stored in S3 and referenced by the document.

---

## Canonical Document Record

```typescript
interface KnowledgeDocument {
  id: string;
  organizationId: string;
  workspaceId: string;
  source: 'github' | 'linear' | 'notion' | 'slack' | 'discord' | 'manual';
  sourceId: string;
  type: 'pull_request' | 'issue' | 'message' | 'doc_page' | 'ticket' | 'custom';
  title: string;
  summary: string | null;
  state: string | null;
  rawPointer: string | null;     // S3 key
  contentHash: string;           // deterministic hash of normalized payload
  metadataJson: JsonValue;       // labels, numbers, fields
  author: { id: string; displayName: string; avatarUrl?: string; handle?: string };
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  lineage: { sourceEventId: string; ingestedAt: Date; previousVersionId: string | null };
}
```

Stored in `knowledge_documents` (PlanetScale table).

---

## Chunk Model

```typescript
interface KnowledgeChunk {
  id: string;
  documentId: string;            // FK → knowledge_documents.id
  workspaceId: string;
  chunkIndex: number;            // 0-based
  text: string;                  // 200–400 tokens, 10–15% overlap
  tokenCount: number;
  sectionLabel?: string;
  embeddingModel: string;
  embeddingVersion: string;
  chunkHash: string;             // idempotent updates
  keywords: string[];
  sparseVector?: { indices: number[]; values: number[] };
  createdAt: Date;
  supersededAt: Date | null;
}
```

Stored in `knowledge_chunks` (PlanetScale table).

---

## Retrieval Interplay

- Query parsing selects identifier vs semantic mode and builds metadata filters.
- Hybrid retrieval (see `docs/SEARCH_DESIGN.md`):
  - Lexical: Postgres FTS or Meilisearch over chunk text.
  - Vector: Pinecone dense (+ optional sparse) search per embedding version namespace.
  - Rerank: optional Cohere rerank for top fused candidates.
- Hydration: chunks and their parent documents from Redis, fallback to PlanetScale.
- Graph bias: when Memory Graph is enabled, apply boost for chunks connected to relevant entities/edges (see `docs/MEMORY_GRAPH_DESIGN.md`).

---

## API Surface

- `GET /api/knowledge/documents/:id`
- `GET /api/knowledge/chunks?documentId=...`
- `POST /api/knowledge/search` (request may include `mode: 'knowledge' | 'graph' | 'hybrid'`)

---

## UI Notes

- Use “Knowledge” for chunked content and retrieval.
- Present “Memory” as the graph: entities, relationships, beliefs.
- Search modes: Knowledge, Memory (Graph), Hybrid.
- Result explainability: show “Graph rationale” when graph bias is applied.

---

## References

- docs/MEMORY_GRAPH_DESIGN.md — relationships‑first Memory layer
- docs/STORAGE_ARCHITECTURE.md — durable core and indexing
- docs/STORAGE_IMPLEMENTATION_GUIDE.md — schema and helpers
- docs/SYNC_DESIGN.md — ingestion pipeline hooks
- docs/SEARCH_DESIGN.md — retrieval pipeline and rerank
