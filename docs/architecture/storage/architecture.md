---
title: Storage & Indexing — Neural Memory Stack
description: Durable storage, vector indexing (Mastra Pinecone), caches/queues, and multi-tenant safety
status: working
owner: platform-storage
audience: engineering
last_updated: 2025-10-28
tags: [storage]
---

# Storage & Indexing — Neural Memory Stack

Last Updated: 2025-11-06

We combine a durable relational core, object storage, vector indexes, and caches to support Knowledge (docs chunks), Neural Memory (observations, summaries, profiles), and Graph signals. The design prioritizes durability, recall, latency, and multi-tenant isolation.

---

## Executive Summary

- Phase 1 (Docs-only):
  - Source of truth: PlanetScale stores docs metadata (path, slug, contentHash) and vector entry mapping; no S3 required for docs.
  - Vector indexing: Mastra Pinecone with one index per `(workspace, store)`; embeddings computed in-pipeline (char-hash 1536 in v1).
  - Retrieval: query Mastra Pinecone index; optional rerank (if enabled); serve snippets and URLs.
- Phase 2 (Neural Memory expansion):
  - Add observations, summaries, profiles, and relationships tables.
  - Add index families or labels for observations/summaries/profiles as needed.
- Observability & eval: ingestion/retrieval latency splits, dedupe hits, quality metrics (see ../../operations/evaluation-playbook.md).
- Redis optional for caches/queues; durability lives in PlanetScale (+ S3 for large raw artifacts if used).

---

## Goals

1. Durability & auditability across all memory types (chunks, observations, summaries, profiles, graph).
2. High recall and low latency (<150 ms p95 semantic) with tunable cost.
3. Tenant isolation by design across DB, caches, and vector indexes.
4. Continuous evaluation and drift detection.

---

## Architecture Overview

Phase 1 (Docs)
GitHub Push → Inngest → PlanetScale (docs + vector map) → Chunk/Embed (char-hash) → Mastra Pinecone (store index) → Retrieval API → apps/docs

Phase 2 (Memory)
Connectors (GitHub/Linear/Notion) → Inngest → PlanetScale (documents/observations/graph) + S3 (raw) → Embedding/Index Jobs → Mastra Pinecone (families) → Retrieval Router → Rerank → Hydration

---

## Data Model (storage sketch)

Phase 1 (Docs)
- Relational (PlanetScale)
  - stores (workspaceId, name, indexName, embeddingDim)
  - docs_documents (storeId, path, slug, title, description, contentHash, commitSha, committedAt, chunkCount, frontmatter)
  - vector_entries (storeId, docId, chunkIndex, contentHash, indexName, upsertedAt)
  - ingestion_commits (storeId, beforeSha, afterSha, deliveryId, status, processedAt)
- Vector (Pinecone via @pinecone-database/pinecone)
  - Index per `(workspaceId, store)`; dimension 1536 (v1); vector metadata kept minimal
- Object Storage (S3)
  - Not required for docs v1 (optional for large raw bodies)

Phase 2 (Memory)
- Relational adds: entities, relationships, memory_observations, memory_summaries, memory_profiles, embedding_versions
- Vector expands: separate families or labels for observations/summaries/profiles (still Mastra Pinecone)
- S3: raw artifacts, large payloads; lifecycle for cold data

---

## Indexing & Metadata

- Phase 1 (Docs):
  - Chunking: char-length (default ~1600 chars, overlap ~200) with light heading awareness
  - Embeddings: char-hash 1536 (v1); dimension recorded in `stores.embeddingDim`
  - Metadata: keep index metadata lean (path, slug, chunkIndex, contentHash); store heavier fields in PlanetScale
- Phase 2 (Memory):
  - Observations: extract titles, conclusions, decision lines; multi-view embeddings
  - Summaries: cluster observations per entity/topic/time; coverage stats in DB
  - Profiles: entity centroids per view; drift indicators

---

## Embedding & Versioning

- Phase 1: single default embedding (char-hash 1536) per store; capture dim on `stores.embeddingDim`.
- Phase 2: introduce `embedding_versions` for model rollouts; consider store-level or family-level versioning.
- Optional: Matryoshka-compatible models and drift monitors as we adopt learned embeddings.

---

## Caches & Hydration

- Optional Redis caches for hot docs/snippets; keys keyed by `(storeId, path, contentHash)`.
- Hydration falls back to PlanetScale on misses.

---

## Multi-Tenant Safety

- DB row-level security by workspace; audit fields on all writes.
- Mastra Pinecone index names include workspace/store identifiers; per-tenant isolation.
- Retention policies per workspace (defaults; legal-hold overrides supported).

---

## Cost & Scaling

- Mastra Pinecone: one index per store; monitor metadata <1 KB; adjust pod classes; prune stale entries after deletes.
- PlanetScale: shard by workspace; prune superseded chunk maps; optional S3 lifecycle for raw bodies.
- Redis: optional caches only; rely on PlanetScale for recovery.

---

## Build Blueprint

- Phase 1 (Docs)
  1) Create Drizzle schema for stores, docs_documents, vector_entries, ingestion_commits
  2) Implement Inngest pipeline: push→diff→chunk→embed→Mastra Pinecone upsert; handle deletes
  3) Implement `/v1/search` wrapper over Mastra Pinecone (store-scoped)
  4) Add basic observability and dashboards

- Phase 2 (Memory)
  1) Add observations/summaries/profiles/relationships tables
  2) Extend ingestion for GitHub/Linear/Notion connectors; add embedding/indexing workers per family
  3) Introduce embedding_versions and drift monitors
  4) Wire fusion retrieval + optional rerank and hydration caches

---

## References

- ../spec.md (architecture overview)
- ../retrieval/search-design.md (retrieval)
- ../ingestion/sync-design.md (ingestion)
- ../../operations/evaluation-playbook.md (evaluation)
