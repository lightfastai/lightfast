# Storage & Indexing — Neural Memory Stack

Last Updated: 2025-10-28

We combine a durable relational core, object storage, vector indexes, and caches to support Knowledge (chunks), Neural Memory (observations, summaries, profiles), and Graph signals. The design prioritizes durability, recall, latency, and multi-tenant isolation.

---

## Executive Summary

- Durable source of truth: PlanetScale (MySQL via Drizzle) stores canonical documents, chunks, observations, summaries, profiles, entities, relationships, and lineage; S3 stores raw bodies and attachments.
- Vector indexing: Pinecone namespaces per workspace and embedding version; separate collections for chunks, observations, summaries, and profiles.
- Hybrid retrieval: lexical + dense + rerank fused with graph bias, recency, importance, and profile similarity.
- Observability & eval: retrieval logs, embedding versions, feedback, drift monitors, and dashboards (see docs/EVALUATION_PLAYBOOK.md).
- Redis used as cache/queues only; durability lives in PlanetScale + S3.

---

## Goals

1. Durability & auditability across all memory types (chunks, observations, summaries, profiles, graph).
2. High recall and low latency (<150 ms p95 semantic) with tunable cost.
3. Tenant isolation by design across DB, caches, and vector indexes.
4. Continuous evaluation and drift detection.

---

## Architecture Overview

Connectors → Ingestion Orchestrator → PlanetScale (documents/chunks/observations/graph) + S3 (raw) → Embedding/Index Jobs → Pinecone (chunks/observations/summaries/profiles) → Redis caches → Retrieval Router → Rerank → Hydration

---

## Data Model (storage sketch)

Relational (PlanetScale)
- knowledge_documents, knowledge_chunks
- entities, entity_aliases, document_entities, relationships, relationship_evidence
- memory_observations (views, embeddings refs/versions, importance, privacy)
- memory_summaries (window, embeddings, coverage)
- memory_profiles (entityId, centroids, descriptors, drift)
- embedding_versions (name, dim, model, status)

Object Storage (S3)
- Raw bodies, diffs, attachments; lifecycle rules for cold data.

Vector (Pinecone)
- Namespaces: `{workspaceId}-{embeddingVersion}`
- Index families: `chunks`, `observations`, `summaries`, `profiles`

Cache/Queues (Redis)
- Hydration caches (documents/chunks/observations)
- Graph adjacency caches (`graph:out`, `graph:in`)
- Work queues: embedding, clustering, profiles

---

## Indexing & Metadata

- Chunking: 200–400 tokens with overlap; section labels; occurredAt.
- Observations: extract titles, conclusions, decision lines; multi-view embeddings.
- Summaries: cluster observations per entity/topic/time; store coverage stats.
- Profiles: entity centroids per view; drift indicators.
- Metadata budget: keep Pinecone metadata under ~1 KB; store heavy fields in PlanetScale with IDs in metadata.

---

## Embedding & Versioning

- `embedding_versions` tracks model, dim, compression, latency, status.
- Matryoshka-compatible models allow truncated vector search for speed with full-dim rerank features.
- Namespaces per workspace + version enable phased rollover; archive old namespaces after migration grace.
- Drift monitors compute similarity deltas between versions; trigger alerts on threshold breaches.

---

## Caches & Hydration

- Redis caches hot documents, chunks, and observations; keys versioned by document version.
- Hydration always falls back to PlanetScale on misses.
- TTL tuned by access frequency; cold data evicted safely.

---

## Multi-Tenant Safety

- DB row-level security by workspace; audit fields on all writes.
- Pinecone namespaces and S3 prefixes include workspace IDs; per-tenant encryption policies.
- Retention policies per workspace (defaults; legal-hold overrides supported).

---

## Cost & Scaling

- Pinecone: scale by collections and pod classes; monitor metadata <1 KB; prune stale observations into summaries.
- PlanetScale: shard by workspace; prune superseded chunks; compress raw artifacts in S3 with lifecycle to Glacier.
- Redis: multi-tier for caches and queues; rely on PlanetScale for recovery.

---

## Build Blueprint

1) Create Drizzle schema for knowledge, neural memory, and graph tables.
2) Implement ingestion to produce chunks and observations; attach entities and importance.
3) Build embedding/indexing workers per index family; add drift monitors.
4) Wire retrieval router with fusion and rerank; add hydration caches.
5) Add evaluation dashboards and alerts.

---

## References

- docs/SPEC.md (architecture overview)
- docs/SEARCH_DESIGN.md (retrieval)
- docs/SYNC_DESIGN.md (ingestion)
- docs/EVALUATION_PLAYBOOK.md (evaluation)
