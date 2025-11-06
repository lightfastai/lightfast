---
title: Knowledge Layer (Chunked Content)
description: Durable documents and chunked slices for retrieval and hydration
status: working
owner: platform-storage
audience: engineering
last_updated: 2025-10-28
tags: [knowledge]
---

# Knowledge Layer (Chunked Content)

Last Updated: 2025-10-28

The Knowledge layer stores normalized source artifacts (documents) as durable records and chunked slices for retrieval. It complements Neural Memory (observations/summaries) and Graph signals.

---

## Executive Summary

- Source of truth: PlanetScale Postgres for documents and chunk descriptors; large raw artifacts in S3 (if used).
- Indexing: 200–400 token chunking with overlap; embeddings in Pinecone; optional sparse vectors.
- Retrieval: lexical prefilter + dense search + optional rerank; hydrate from Redis/PlanetScale.
- Versioning: deterministic `content_hash` and immutable versions; chunk supersession on change.
- Observability: retrieval logs, embedding versions, feedback for continuous evaluation.

---

## Concepts

- Knowledge Document: canonical representation of a source artifact (PR, issue, doc, message).
- Knowledge Chunk: retrieval unit derived from a document; embedded and indexed.
- Raw Artifact: large body/diff/attachment stored in S3 and referenced by the document.

---

## Retrieval Interplay

- Hybrid search over chunks contributes strong evidence alongside observations.
- See ../architecture/retrieval/search-design.md for router, fusion, rerank, graph bias, and hydration.

---

## API

- Public interaction via the four routes in ../../reference/api/api-spec.md.
- Internals may expose helper endpoints or tRPC routers; keep them internal to avoid surface sprawl.

---

## References

- ../architecture/retrieval/search-design.md — retrieval and fusion
- ../architecture/ingestion/sync-design.md — ingestion pipeline
- ../architecture/storage/architecture.md — storage & indexing
