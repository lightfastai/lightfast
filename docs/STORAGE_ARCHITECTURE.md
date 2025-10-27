# Storage Architecture Analysis & Redesign

**Last Updated:** 2025-02-10

---

## Executive Summary

We are adopting a production-grade Retrieval-Augmented Generation (RAG) storage model that balances durability, recall quality, and latency by combining a durable relational store, object storage, Pinecone for vector search, and Redis for operational caching. This redesign aligns the Lightfast platform with 2024–2025 best practices published by Pinecone, Cohere, and Chroma, as well as recent academic work on hybrid retrieval and continual evaluation. Terminology: the chunked retrieval layer is the Knowledge Store; the relationships-first layer is the Memory Graph. The key shifts are:

- **Durable source of truth:** PlanetScale (MySQL) via Drizzle (plus S3 for large artifacts) now stores canonical knowledge documents, chunk metadata, and lineage so we can replay ingestion, audit changes, and meet compliance.
- **Chunk-level indexing:** Ingestion splits every knowledge document into 200–400-token chunks with semantic overlap, stores chunk descriptors relationally, and indexes them in Pinecone with lean metadata (<1 KB) for fast, filterable retrieval.
- **Hybrid retrieval path:** Queries run through a lexical pre-filter, Pinecone dense search, and lightweight reranking, giving high recall with configurable latency budgets.
- **Observability + evaluation:** Retrieval logs, embedding versions, feedback scores, and drift monitors persist in the durable store and feed dashboards and automated eval jobs (see `docs/EVALUATION_PLAYBOOK.md`).
- **Redis as cache, not database:** Redis holds hot documents, deduplication keys, and transient job state. Recovery flows rely on the durable store rather than Redis snapshots.

---

## Guiding Goals

1. **Durability & auditability:** Every knowledge document and chunk must be reproducible without external APIs; ingestion updates are idempotent and versioned.
2. **Recall and precision:** Support multi-stage retrieval (lexical + dense + rerank) while keeping p95 <150 ms for semantic queries and <90 ms for identifier lookups.
3. **Operability:** Provide metrics, alerting, and evaluation hooks that surface drift, stale embeddings, and retrieval blind spots.
4. **Cost-awareness:** Store vectors only once, compress large blobs, and scale components (Pinecone pods, Redis tiers) independently.
5. **Multi-tenant isolation:** Enforce namespace- and row-level isolation, residency controls, and configurable retention policies per workspace.

---

## Target Architecture Overview

```
             ┌────────────────────────────────────────────────┐
             │              Source Connectors                  │
             │ GitHub ▪ Linear ▪ Notion ▪ Slack ▪ Atlassian ...│
             └──────────────────────────┬──────────────────────┘
                                        │
                               Ingestion Orchestrator
                                 (Inngest + Workers)
                                        │
        ┌──────────────┬────────────────┴────────────────────┬──────────────┐
        │              │                                    │              │
        ▼              ▼                                    ▼              ▼
┌─────────────┐  ┌──────────────┐                   ┌────────────────┐ ┌────────────┐
│ Durable DB  │  │ Object Store │                   │ Redis (Cache)  │ │ Observability│
│ PlanetScale │  │   (S3/GCS)   │                   │  (Upstash)     │ │  (Grafana)  │
│ knowledge_  │  │ raw payloads │                   │ hot chunks,    │ │ logs, evals │
│ documents & │  │ diff bundles │                   │ dedupe, tasks  │ │             │
│ chunks      │  │              │                   │                │ │             │
└────┬────────┘  └────┬─────────┘                   └────────┬───────┘ └────┬───────┘
     │                │                                        │             │
     │                │                                        │             │
     │                └─────────────────────┐                  │             │
     │                                      │                  │             │
     │                         Chunk Embeddings + Metadata     │             │
     │                                      │                  │             │
     │                                      ▼                  │             │
     │                              ┌────────────────┐         │             │
     └──────────────────────────────►  Pinecone RAG   ◄─────────┘             │
                                    │  (vector + sparse) │                   │
                                    └────────────────┘                     │
                                          │                                │
                                   Retrieval Services                      │
                                          │                                │
                              ┌────────────┴─────────────┐                │
                              │   Lightfast Experiences  │                │
                              │  CLI ▪ UI ▪ API Clients  │◄───────────────┘
                              └──────────────────────────┘
```

---

## Component Responsibilities

### PlanetScale (MySQL) via Drizzle (Primary Store)

- Tables: `knowledge_documents`, `knowledge_chunks`, `relationships`, `retrieval_logs`, `feedback_events`, `embedding_versions`.
- Stores canonical JSON payloads (normalized by source), chunk descriptors, relationship graphs, and lineage (ingestion job IDs).
- Provides transactional guarantees for multi-table updates (memory + chunks + relationships) and supports point-in-time recovery.
- Enables analytical queries, governance checks, and structured filters (labels, repositories, channel IDs, tenant IDs).

### Object Storage (S3 or GCS)

- Persists large raw artifacts (attachments, code diffs >1 MB, rendered HTML) referenced from `knowledge_documents.raw_pointer`.
- Versioned buckets retain diffs for compliance and offline analysis.
- Lifecycle policies move cold data to infrequent access tiers while keeping metadata active in PlanetScale.

### Pinecone (Vector + Sparse Index)

- Stores chunk embeddings (dense) and optional sparse vectors (BM25/SPLADE tokens) per chunk.
- Serverless is default for cost/ops efficiency; move specific workspaces to pod-based indexes when hybrid dense+sparse scoring or selective metadata indexing is required.
- Metadata budget <1 KB per vector: workspace ID, memory ID, chunk index, chunk hash, source, type, created/updated timestamps, access labels, retrieval score hints.
- Namespaces per workspace enforce tenant isolation; collections segmented by embedding model version enable phased migrations; selective indexing keeps only filterable keys (`workspace_id`, `entity_type`, `source`, `created_at`, `author_id`) indexed when pods are used.

### Redis (Operational Cache)

- Holds hot documents and chunk bundles for low-latency detail fetches (TTL-based).
- Maintains ingestion deduplication keys (`document:source:{source_id}`) and work queues.
- Stores short-lived relationship adjacency lists for quick navigation; authoritative graph persists in PlanetScale.

### Observability Stack

- `retrieval_logs` capture query parameters, candidate chunk IDs, scores, reranker decisions, and latency splits.
- Metrics exported to Prometheus/Grafana (p50/p95 latency, recall@k from eval harness, embedding refresh lag).
- Evaluation jobs (Braintrust test runs) write scores into `feedback_events` for regression detection—suite catalog and thresholds live in `docs/EVALUATION_PLAYBOOK.md`.

---

## Data Model Summary

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| `knowledge_documents` | Canonical document per source object | `id`, `workspace_id`, `source`, `source_id`, `title`, `summary`, `raw_pointer`, `content_hash`, `state`, `metadata_json`, `version`, `created_at`, `updated_at` |
| `knowledge_chunks` | Chunk-level text & descriptors | `id`, `document_id`, `chunk_index`, `token_count`, `text`, `keywords`, `embedding_model`, `embedding_version`, `chunk_hash`, `created_at` |
| `relationships` | Directed graph edges | `id`, `workspace_id`, `from_kind`, `from_id`, `to_kind`, `to_id`, `relationship_type`, `confidence`, `created_at` |
| `retrieval_logs` | Query telemetry | `id`, `workspace_id`, `query_text`, `lexical_ids`, `vector_ids`, `rerank_ids`, `latencies_json`, `top_k`, `user_id`, `created_at` |
| `feedback_events` | Human/automatic feedback | `id`, `retrieval_log_id`, `signal_type`, `score`, `comment`, `created_at` |

Large blobs (diffs, message history) live in object storage, referenced via `raw_pointer`.

---

## Ingestion Pipeline

1. **Event Capture:** Source webhooks or pollers enqueue events to Inngest.
2. **Normalization:** Workers fetch the latest resource, map it to a Knowledge Document shape, and compute a `content_hash` for idempotency.
3. **Chunking:** Apply adaptive token-based chunking (default 300 tokens ±50, 10–15% overlap). Specialized chunkers handle code (preserve syntax blocks) and threaded conversations (roll up by speaker turns).
4. **Persistence:**
   - Upsert `knowledge_documents` row with optimistic locking (`content_hash`).
   - Replace associated `knowledge_chunks` within a transaction; mark old chunks as superseded but keep historical copies for replay.
   - Store attachments/raw transcripts in S3 and update `raw_pointer` references.
5. **Embedding:**
   - Batch embed chunks via Voyage/Cohere with `inputType='search_document'`; record `embedding_version`, provider, dimension, and compression flags (float32 vs int8).
   - For large backfills, submit Cohere Embed Jobs and stream results into the namespace.
   - Upsert vectors into Pinecone collection matching workspace and embedding version (768-dimension default, Matryoshka-compatible for downsampling).
6. **Cache & Graph:**
   - Populate Redis with hot document/chunk bundles (configurable TTL, default 3 days).
   - Detect references (regex + link resolvers) and update `relationships`; push adjacency hints into Redis for quick lookups.
7. **Post-Processing:** Emit evaluation tasks when chunk count crosses thresholds or embedding versions change.

Retries use the `content_hash` to avoid duplicate rows. Pinecone updates occur only after the Drizzle transaction commits on PlanetScale to guarantee durability before indexing.

---

## Retrieval Pipeline

```typescript
async function retrieve(query: RetrievalQuery): Promise<RankedChunks> {
  const tracing = startSpan("rag.retrieve");

  // Stage 1: Lexical / metadata filter (30ms budget)
  const lexicalCandidates = await lexicalStore.search({
    workspaceId: query.workspaceId,
    terms: query.text,
    filters: query.filters,
    topK: LEXICAL_TOP_K,
  });

  // Stage 2: Vector search (40ms budget)
  const embedding = await embedQuery(query.text, query.embeddingModel);
  const pineconeHits = await pinecone.query({
    namespace: namespaceFor(query.workspaceId, query.embeddingModel),
    vector: embedding.values,
    sparseValues: embedding.sparse,
    filter: buildMetadataFilter(query.filters),
    topK: VECTOR_TOP_K ?? 50,
    includeMetadata: true,
  });

  // Merge candidates (lexical IDs weight boosted)
  const merged = mergeCandidates(lexicalCandidates, pineconeHits);

  // Stage 3: Lightweight rerank (optional, 30ms budget)
  const reranked = shouldRerank(query)
    ? await cohereRerank(rerankInput(merged, query.text), { topN: 5, model: 'rerank-v3.5' })
    : merged;

  tracing.recordLatencySplit();

  // Stage 4: Hydrate chunks from Redis or PlanetScale (via Drizzle)
  return await hydrateChunks(reranked, query.includeMetadata);
}
```

**Short-code / identifier queries** bypass reranking and fall back to direct key lookups (`knowledge_documents.source_id`, `knowledge_documents.number` when applicable). Results cache in Redis for 60 s.

---

## Embedding Refresh & Versioning

- Maintain `embedding_versions` table capturing model name, provider, dimensionality (default 768), compression (`float32`, `int8`, `binary`), cost, latency, and rollout status.
- Support Matryoshka-compatible embeddings so we can truncate to 256/512 dimensions for candidate generation while retaining 768-dimension vectors for reranking.
- A nightly job compares `knowledge_documents.updated_at` with `knowledge_chunks.embedding_version`; stale chunks enqueue for re-embedding.
- Cohere Embed Jobs handle bulk refreshes; streaming workers update Pinecone namespaces and append version metadata.
- Canary workspaces migrate first; Pinecone namespaces per version allow phased rollover. Completed migrations archive obsolete namespaces after 30 days.
- Drift monitors compute similarity deltas between old/new embeddings and alert when thresholds exceed configured bounds.

---

## Observability & Continuous Evaluation

- **Retrieval logging:** Each query writes latency breakdowns, candidate lists, and reranker scores to `retrieval_logs`.
- **Feedback loops:** UI captures user votes/comments per answer; automated eval jobs (Braintrust suites) replay benchmark question sets weekly and log scores (detailed in `docs/EVALUATION_PLAYBOOK.md`).
- **Dashboards & Alerts:** Grafana dashboards expose embed throughput, queue backlogs, Pinecone error rates, stale chunk counts, and recall@k. SLO alerts trigger when p95 > targets or stale chunk percentage >5%.
- **Incident response:** Runbooks document redeploying Pinecone namespaces, replaying ingestion via changelog tables, and restoring from PlanetScale backups.

---

## Governance & Multi-Tenant Controls

- Workspace-scoped API tokens map to database row-level security policies; Pinecone namespaces and S3 prefixes also embed workspace IDs.
- Encryption at rest: PlanetScale (automatic), S3 SSE-KMS, Redis TLS enforced.
- Data retention policies configurable per workspace (default 365 days, with legal hold override).
- Access audits query `retrieval_logs` to trace which chunks powered a response, supporting compliance reviews.

---

## Cost & Scaling Considerations

| Component | Scaling Knobs | Notes |
|-----------|---------------|-------|
| Pinecone | Namespace per workspace, collection per embedding version | Serverless pool scales automatically; monitor metadata size (<1 KB) |
| PlanetScale | Sharding by workspace, Drizzle + serverless driver | Storage ~10 GB per 200k chunks (compressed); use row pruning for inactive workspaces |
| Redis | Multi-tier (cache + job queues) | Evict cold caches; rely on PlanetScale for rehydration |
| S3 | Lifecycle rules to Glacier for >180-day artifacts | Set budgets per workspace |

Expected monthly cost for 100k knowledge documents (≈400k chunks): Pinecone $70, PlanetScale $60, Redis $25, S3 $15, totaling ~$170 with robust durability and observability.

---

## Build Blueprint

1. **Create Drizzle schema (PlanetScale MySQL):** `knowledge_documents`, `knowledge_chunks`, and graph tables (`entities`, `relationships`, `relationship_evidence`, `beliefs`).
2. **Implement ingestion:** Normalize → persist documents + chunks → embed + upsert vectors.
3. **Enable retrieval:** Hybrid pipeline with optional rerank and caching.
4. **Wire evaluation:** Retrieval logs, feedback events, and dashboards.

---

## References

- Pinecone (2024a). *Designing a Production-Ready RAG Stack.*
- Pinecone (2024b). *The RAG Maturity Model.*
- Cohere (2024a). *Production RAG Best Practices.*
- Cohere (2024b). *Evaluating RAG Systems.*
- Chroma (2024). *Chroma in Production.*
- Asai, A. et al. (2023). *Self-RAG.*
- Jain, A. et al. (2024). *GraphRAG.*
- Sota, N. et al. (2024). *Dynamic RAG.*
- Li, J. et al. (2024). *LongRAG.*
- Sun, Z. et al. (2024). *Adaptive RAG Evaluation.*
