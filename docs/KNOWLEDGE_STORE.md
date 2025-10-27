# Knowledge Store (Chunked Retrieval Layer)

Last Updated: 2025-10-27

The Knowledge Store is Lightfast’s retrieval layer: normalized source artifacts (documents) split into chunks, embedded, and retrieved via a hybrid pipeline. “Memory” refers to the relationships‑first graph layer (entities/relationships/beliefs) documented in `docs/memory/GRAPH.md`.

---

## Executive Summary

- Source of truth: PlanetScale (MySQL) via Drizzle for documents and chunk descriptors; large raw artifacts live in S3.
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

In tRPC-based apps, infer types from your router outputs rather than defining ad-hoc interfaces:

```typescript
import type { CloudRouterOutputs } from '@api/cloud';

// Example: adjust the path to your actual route name
type KnowledgeDocument = CloudRouterOutputs['knowledge']['getDocumentById'];
```

Stored in `knowledge_documents` (PlanetScale MySQL via Drizzle).

---

## Chunk Model

In tRPC-based apps, infer chunk types from router outputs:

```typescript
import type { CloudRouterOutputs } from '@api/cloud';

// Example: listChunks returns an array; pick an element type
type KnowledgeChunk = CloudRouterOutputs['knowledge']['listChunks'][number];
```

Stored in `knowledge_chunks` (PlanetScale MySQL via Drizzle).

---

## Retrieval Interplay

- Query parsing selects identifier vs semantic mode and builds metadata filters.
- Hybrid retrieval (see `docs/SEARCH_DESIGN.md`):
  - Lexical: Postgres FTS or Meilisearch over chunk text.
  - Vector: Pinecone dense (+ optional sparse) search per embedding version namespace.
  - Rerank: optional Cohere rerank for top fused candidates.
- Hydration: chunks and their parent documents from Redis, fallback to PlanetScale.
- Graph bias: when Memory Graph is enabled, apply boost for chunks connected to relevant entities/edges (see `docs/memory/GRAPH.md`).

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

- docs/memory/GRAPH.md — relationships‑first Memory layer
- docs/STORAGE_ARCHITECTURE.md — durable core and indexing
- docs/STORAGE_IMPLEMENTATION_GUIDE.md — schema and helpers
- docs/SYNC_DESIGN.md — ingestion pipeline hooks
- docs/SEARCH_DESIGN.md — retrieval pipeline and rerank
