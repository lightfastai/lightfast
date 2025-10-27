# MVP Implementation Roadmap (2025 Refresh)

> Objective: ship a production-ready, durable RAG pipeline in 6 weeks that supports GitHub + Slack ingestion, chunked retrieval, hybrid search, and observability with Braintrust evaluations.

---

## Milestone Overview

```
Week 1: Foundations (Schema, storage clients, scaffolding)
Week 2: GitHub ingestion → PlanetScale + chunking + embeddings
Week 3: Slack ingestion + relationship graph
Week 4: Hybrid search service + observability
Week 5: Braintrust eval + ops hardening + canary rollout
Week 6: GA readiness (docs, runbooks, incident drills)
```

Each week culminates in a demoable slice with automated validation.

---

## Week 1 – Foundations

**Goals:** Establish data model, infrastructure plumbing, and ingestion skeletons.

- Define Drizzle schema (PlanetScale MySQL) for the Knowledge Store and Memory Graph (`knowledge_documents`, `knowledge_chunks`, `relationships`, `retrieval_logs`, `feedback_events`).
- Provision S3 bucket (`workspaces/{workspace}/knowledge/{documentId}` prefix) with lifecycle policies.
- Set up Redis namespaces for cache + dedupe keys.
- Implement typed clients/packages (`@db/cloud` Drizzle client, `lib/s3`, `lib/redis`, `lib/pinecone`).
- Scaffolding Inngest functions + types inferred from tRPC RouterOutputs (e.g., `CloudRouterOutputs['knowledge']['getDocumentById']`) and `ChunkDraft` for ingestion.
- Create Braintrust workspace + seed baseline suite for GitHub QA.

**Exit criteria:** Local integration test writes a knowledge document + chunks transactionally and confirms Pinecone + Redis stubs invoked (no real data yet).

---

## Week 2 – GitHub Pipeline

**Goals:** End-to-end GitHub PR ingestion including chunk embeddings.

- Implement GitHub webhook handler with signature validation + idempotency (`source-dedupe:*`).
- Build `normalizePullRequest` that fetches timeline, generates `KnowledgeDocumentDraft`, chunk list (300±50 tokens), and S3 uploads for large diffs.
- Implement `persistKnowledgeDraft` transaction + Redis cache priming.
- Add embedding worker that batches `knowledge.embedding.requested` jobs, writes Pinecone vectors (namespace `${workspace}-${version}`), and records embedding versions.
- Execute Braintrust smoke suite for ingested PR documents.
- Instrument Inngest tracing + metrics (ingest latency, chunk counts).

**Exit criteria:** Creating a PR in staging repo results in searchable chunks with accurate metadata; Braintrust smoke suite passes.

---

## Week 3 – Slack & Relationships

**Goals:** Add second source and populate the Memory Graph.

- Implement Slack Events API ingestion (URL verification, event callback, token rotation helper).
- Normalize Slack messages into knowledge documents + conversation-aware chunking (group by thread turns).
- Extend relationship detector (regex + heuristics) to capture mentions across GitHub ↔ Slack, store in `relationships`, and push adjacency hints to Redis.
- Build regeneration job to recompute relationships from history when rules change.
- Update Braintrust suites to include Slack retrieval scenarios.

**Exit criteria:** Slack thread appears in search with linked PR references; relationship adjacency accessible in UI.

---

## Week 4 – Hybrid Search & Observability

**Goals:** Deliver the retrieval API and full telemetry.

- Implement query processor, lexical pre-filter (Postgres FTS or Meilisearch), and Pinecone dense+sparse query fusion.
- Add conditional Cohere Rerank with latency guardrails (<30 ms budget) and caching of top chunk texts.
- Hydrate responses via Redis → PlanetScale fallback; generate highlights/snippets.
- Record `retrieval_logs` with latency splits, candidate IDs, rerank usage.
- Build Grafana dashboards (ingest throughput, embedding backlog, search p95, recall@k from Braintrust).

**Exit criteria:** `/api/search` returns fused results within latency targets; dashboards live with real data.

---

## Week 5 – Evaluation & Hardening

**Goals:** Close the loop on quality and reliability.

- Integrate Braintrust regression suites triggered on `knowledge.persisted` events.
- Implement embedding drift monitor + alert (compare new vs previous cosine similarity).
- Add retry/dead-letter flows for failed embeddings and relationship detection.
- Incident runbooks: Pinecone outage, Redis cache loss, S3 upload failure, PlanetScale failover.
- Conduct load test (simulate 10k knowledge documents, 2k queries/hour) and tune Redis/Pinecone limits.

**Exit criteria:** Braintrust regression gate ✅, alerting wired to PagerDuty, DR drills documented.

---

## Week 6 – GA Readiness

**Goals:** Polished release with support docs.

- Finalize developer documentation (Storage Architecture, Knowledge Store, Memory Graph, Search Design, Sync Flows).
- Build admin tools for replaying ingestion (per workspace re-sync) and manual knowledge document invalidation.
- Perform canary rollout to first customer workspace; monitor for 48 hours.
- Gather feedback, address remaining gaps, and prepare launch comms.

**Exit criteria:** Customer can ingest GitHub + Slack data, run semantic search with evaluations, and we have confidence in observability + recovery paths.

---

_Last reviewed: 2025-02-10_
