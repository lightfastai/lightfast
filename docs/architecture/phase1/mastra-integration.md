---
title: Mastra Pinecone Integration (v1)
description: Using @mastra/pinecone for indexing and search per docs store
status: working
owner: engineering
audience: engineering
last_updated: 2025-11-06
tags: [mastra, rag]
---

# Status

> **Update:** We now run exclusively on the official `@pinecone-database/pinecone` SDK. The notes below describe the original Mastra integration for historical reference.

# Mastra Pinecone Integration (v1)

We use Mastra’s Pinecone client to manage vector storage (one index per store). We compute embeddings (char-hash 1536) and upsert vectors + metadata.

---

## Mapping

- Store → Pinecone index
  - One index per `(workspaceId, store)`; created on first write.
- Document → page (MDX file)
  - Metadata: title, slug, path, contentHash, committedAt
- Chunk → passage segment
  - Metadata: chunkIndex, same doc metadata

---

## Indexing

- Upsert: from `docs.chunk.upsert` events, compute embedding and upsert vectors + metadata via Mastra Pinecone.
- Delete: on `docs.file.deleted`, remove prior chunk IDs for that doc.
- Idempotency: use `(workspaceId, store, path, contentHash, chunkIndex)` to generate stable ids.

---

## Search

- `/v1/search` queries the Pinecone index for the store via Mastra client; inputs: `q`, `topK`, highlights.
- Optional rerank: use Mastra’s built-in reranking if available/configured.
- Output: normalized to Lightfast’s API (title, url, snippet, score, requestId, latency splits).

---

## Configuration & Secrets

- No vector store IDs in config; Lightfast resolves index name from `(workspaceId, store)`.
- Mastra credentials live in server/Console env; never in repo.

---

## Observability

- Indexing latency (+ counts per push), search latency (backend + rerank), p95 metrics.
- Errors: exponential backoff on transient failures.

---

## Client Interface (pseudocode)

```ts
import { PineconeVector } from '@mastra/pinecone';

const store = new PineconeVector({ apiKey: process.env.PINECONE_API_KEY! });

// Resolve index name from (workspaceId, store)
const indexName = `ws_${workspaceId}__store_${storeName}`;

// Ensure index exists (dimension must match embedding dim)
await store.createIndex({ indexName, dimension: 1536 });

// Upsert chunk vectors
await store.upsert({
  indexName,
  vectors: embeddings, // number[][] matching dimension
  metadata: chunks.map((chunk) => ({
    text: chunk.text,
    path: chunk.path,
    slug: chunk.slug,
    contentHash: chunk.contentHash,
    chunkIndex: chunk.index,
  })),
});
```

Notes
- Embeddings are computed in our pipeline (char-hash 1536 or model-based). Dimension must align with the index.
- Use stable vector IDs per `(path, contentHash, chunkIndex)` for idempotency.
- For query, use Mastra client’s query method against `indexName` and scope results to this store.
