# Storage Architecture Visual Summary

## Target Architecture

```
                                ┌───────────────────────────────┐
                                │        Source Systems         │
                                │ GitHub ▪ Linear ▪ Slack ▪ ... │
                                └──────────────┬────────────────┘
                                               │
                                       Ingestion Orchestrator
                                         (Inngest + Workers)
                                               │
                               ┌───────────────┴────────────────┐
                               │                                │
                         Normalized Memory               Attachments & Diffs
                               │                                │
                               ▼                                ▼
                     ┌──────────────────┐              ┌──────────────────┐
                     │ PlanetScale /    │              │ Object Storage   │
                     │ Postgres         │              │ (S3 / GCS)       │
                     │ memories, chunks │◄──raw_pointer│ Versioned Blobs  │
                     └─────────┬────────┘              └────────┬─────────┘
                               │                                 │
                               │                                 │
                      ┌────────▼──────────┐          ┌──────────▼──────────┐
                      │ Memory Chunking   │          │  Embedding Pipeline │
                      │ (200–400 tokens)  │──────────►  Voyage / Cohere    │
                      │ Adaptive overlap  │          │  Embedding Versions │
                      └────────┬──────────┘          └──────────┬──────────┘
                               │                                 │
                      ┌────────▼──────────┐          ┌──────────▼──────────┐
                      │ Redis (Cache &    │  cache   │ Pinecone Collection │
                      │ Job State)        │──────────► Dense + Sparse Vecs │
                      │ Hot chunks ▪ TTL  │          │ <1 KB metadata      │
                      └────────┬──────────┘          └──────┬──────────────┘
                               │                           │
                     ┌─────────▼──────────────┐            │
                     │ Retrieval Service      │◄───────────┘
                     │ Hybrid search pipeline │
                     └─────────┬──────────────┘
                               │
                     ┌─────────▼──────────────┐
                     │ Lightfast APIs & UI    │
                     │ Responses & Analytics  │
                     └────────────────────────┘
```

---

## Ingestion Flow

```
┌─────────────┐   ┌──────────────┐   ┌────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ Source Event│──►│ Normalize +  │──►│ Chunk Builder   │──►│ PlanetScale Txn │──►│ Embedding Queue │
│ (webhook)   │   │ Hash Content  │   │ 300±50 tokens   │   │ upsert memory + │   │ batch → Voyage  │
└─────────────┘   └──────┬───────┘   └────────┬───────┘   │ chunks          │   └────────┬────────┘
                         │                    │           └──────┬────────┘            │
                         │                    │                  │                     │
                         ▼                    ▼                  ▼                     ▼
                   Dedup Cache         S3 Upload (raw)       Chunk Records       Pinecone Upsert
                   (Redis TTL)         (versioned)           (embed_version)     (namespace/tenant)
```

- Transactions ensure `memories` + `memory_chunks` stay consistent.
- Pinecone is updated only after the database commit succeeds.
- Redis caches the newest memory snapshot and chunk bundle for rapid UI fetches.

---

## Retrieval Flow (Hybrid)

```
┌────────────────────┐
│ User / Agent Query │
└──────────┬─────────┘
           │
           ▼
  ┌────────────────────┐
  │ Lexical Filter     │  (Postgres full-text / Meilisearch / sparse vectors)
  └────────┬───────────┘
           │
           ▼
  ┌────────────────────┐
  │ Dense Retrieval    │  (Pinecone vector query)
  └────────┬───────────┘
           │
           ▼
  ┌────────────────────┐
  │ Lightweight Rerank │  (Cohere Rerank / cross-encoder)
  └────────┬───────────┘
           │
           ▼
  ┌────────────────────┐
  │ Hydrate Chunks     │  (Redis cache → PlanetScale fallback)
  └────────┬───────────┘
           │
           ▼
  ┌────────────────────┐
  │ Compose Response   │  (LLM prompt assembly + guardrails)
  └────────────────────┘
```

Latency budgets: lexical ≤30 ms, dense ≤40 ms, rerank ≤30 ms, hydration ≤20 ms (hot cache) to meet <150 ms p95.

---

## Data Responsibilities Snapshot

| Layer | Stores | Notes |
|-------|--------|-------|
| PlanetScale | Canonical memories, chunk descriptors, relationships, retrieval logs, feedback | Source of truth; backups + PITR |
| S3 / GCS | Large raw payloads, diff bundles | Versioned; referenced by `raw_pointer` |
| Pinecone | Chunk embeddings, minimal metadata, sparse vectors | Namespaces per workspace + embedding version |
| Redis | Hot chunk cache, dedupe keys, work queues | TTL-based; recoverable via database replay |
| Observability | Metrics, traces, evaluation scores | Grafana/Prometheus + eval DB tables |

---

## Evaluation & Governance

```
                         ┌────────────────────────┐
                         │ Scheduled Benchmarks    │
                         │ (Braintrust suites)     │
                         └───────────┬────────────┘
                                     │ writes
                                     ▼
                              ┌──────────────┐
                              │ feedback_events │
                              │ (PlanetScale) │
                              └──────┬───────┘
                                     │ joins
                                     ▼
┌────────────────────────┐   ┌──────────────┐   ┌──────────────────────────┐
│ Retrieval Logs (query, │◄──┤ retrieval_logs│   │ Grafana Dashboards       │
│ candidates, latency)   │   └──────────────┘   │ p95, recall@k, drift     │
└──────────┬─────────────┘                      └──────────────────────────┘
           │ exports
           ▼
   Incident Runbooks + Alerting
```

- Every response traces back to the chunks that informed it.
- Drift monitors compare embedding versions and alert on similarity deltas.
- Audit queries can filter retrieval history by workspace, user, or data classification.

---

**Outcome:** The combination of a durable relational core, chunk-level indexing, hybrid retrieval, and continuous evaluation delivers resilient, observable, and high-recall RAG capabilities aligned with current industry guidance.
