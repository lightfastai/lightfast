---
title: Architecture Spec — Neural Memory
description: End-to-end system spec covering data model, pipelines, retrieval, SLOs, and security
status: working
owner: platform-architecture
audience: engineering
last_updated: 2025-10-28
tags: [architecture, spec]
---

# Lightfast Architecture Spec — Neural Memory

Last Updated: 2025-10-28

This specification defines Lightfast as a neural memory system composed of Knowledge, Neural Memory, and Graph. It prioritizes semantic retrieval augmented by explicit structure, explainability, and strong multi-tenant guarantees.

---

## 1. Goals and Non-Goals

- Goals
  - High-recall, low-latency neural retrieval with explainable context.
  - Simple external interface (four routes) and MCP parity.
  - Robust tenancy, privacy, and evaluation built-in.
  - Incremental quality: calibrated weights, summaries, and profiles that improve over time.
- Non-Goals
  - Exact knowledge base truth maintenance (we prioritize evidence + provenance over canonicalization).
  - Long-hop graph reasoning; we focus on 1–2 hops with bounded time.

---

## 2. Core Concepts

- Knowledge Chunks
  - Durable, chunked slices of normalized source documents (PRs, issues, docs, messages).
  - Indexed with dense (+ optional sparse) vectors.

- Memory Observations
  - Atomic, high-signal units (decisions, incident lines, PR highlights, Q/A turns) with provenance.
  - Multi-view embeddings: body, title/headline, summary.
  - Importance and privacy metadata.

- Memory Summaries
  - Clustered rollups by entity/topic/time to compress observations and provide quick overviews.
  - Tracked with coverage and drift.

- Memory Profiles
  - Per-entity prototype vectors (centroids) + descriptors; used to bias search and personalize.

- Graph
  - Explicit entities (person, team, repo, service, project, customer, goal, etc.) and typed relationships.
  - Used for explainability and short-hop traversal; contributes a bounded boost during retrieval.

Beliefs/intent are modeled as summary content and descriptors rather than a special data type.

---

## 3. Data Model (Conceptual)

Relational (PlanetScale/MySQL via Drizzle):

- `workspaces` — tenant boundary.
- `entities` — id, kind, displayName, canonical refs, createdAt, updatedAt.
- `entity_aliases` — entityId, alias, source, verified.
- `knowledge_documents` — id, workspaceId, source, type, title, author, occurredAt, url, content_hash, version.
- `knowledge_chunks` — id, documentId, sectionLabel, text (or hash), position, meta, version, occurredAt.
- `document_entities` — documentId, entityId, kind (mention/owner/etc), evidence.
- `relationships` — id, workspaceId, type, fromId, toId, confidence, occurredAt, updatedAt.
- `relationship_evidence` — relationshipId, documentId, chunkId, observationId, weight.

Neural memory tables:

- `memory_observations` — id, workspaceId, subjectRefs (entity/document/message), text, views{title,body,summary}, embeddings{...}, importance, privacy, occurredAt, source, tags, content_hash.
- `memory_summaries` — id, workspaceId, window{entity/topic/time}, text, embeddings, coverageStats, createdAt.
- `memory_profiles` — id, workspaceId, entityId, centroids{title,body,summary}, descriptors, drift, lastRebuiltAt.
- `memory_links_inferred` — id, workspaceId, fromRef, toRef, label, confidence, method, evidenceIds.

Index metadata:

- `embedding_versions` — name, dim, model, createdAt, status.

Vector (Pinecone):

- Namespaces per workspace and embedding version.
- Index families: chunks, observations, summaries, profiles (separate indexes or collections).

Cache/queues (Redis):

- Hydration caches for chunks/documents/observations.
- Graph adjacency caches: `graph:out:{ws}:{kind}:{id}`, `graph:in:{ws}:{kind}:{id}`.
- Work queues for embedding, clustering, profile rebuilds.

---

## 4. Ingestion Pipeline

Flow: Source Event → Normalize → Persist → Upload Raw (S3) → Embed → Index → Prime Caches → Emit Eval.

- Normalize: standardize documents; extract entities via aliases; compute `content_hash`.
- Chunk: 200–400 tokens with overlap; label sections.
- Observe: extract salient “moments” (decisions, conclusions, incident lines, PR titles/summaries).
- Embed: per view (title/body/summary) with `inputType` tuned for query/doc roles.
- Index: upsert to Pinecone under `{workspaceId}-{embeddingVersion}`.
- Events: `memory.observation.created`, `knowledge.chunk.created`, `embedding.requested`.

---

## 5. Retrieval Pipeline

Router selects strategy; public API remains simple.

- Query Processing
  - Parse syntax (`#123`, `repo:path`, `from:github`, time bounds, labels).
  - Resolve entities from aliases; attach filters; select embedding model.
  - Build query embeddings for each view; handle identifier fast-path.

- Candidate Generation
  - Knowledge: lexical + dense search over chunks.
  - Neural: dense search over observations (+ optional summaries); include profile similarity where relevant.
  - Graph seeds: from query entities or top candidates.

- Fusion and Scoring
  - `score = wv*vector + wl*lexical + wg*graphBoost + wr*recency + wi*importance + wp*profileSim`.
  - Weights are calibrated per workspace; defaults are safe and latency-aware.

- Graph Boost (bounded)
  - 1–2 hops via Redis adjacency; allowlist edges per intent (OWNED_BY, MEMBER_OF, DEPENDS_ON, BLOCKED_BY, ALIGNS_WITH_GOAL).
  - `boost = GRAPH_WEIGHT * confidence * hopFactor` (e.g., hop1=1.0, hop2=0.6).

- Rerank
  - Cross-encoder on fused top-K; workspace-calibrated threshold to trim tails.

- Hydration & Rationale
  - Fetch chunks/documents/observations; build highlights.
  - Attach rationale when graph influenced results or router selected structure-aware path.

Latency Targets (p95): identifier <90 ms; semantic <150 ms; similar <150 ms; contents <120 ms (10 items).

---

## 6. Answering

- Retrieval-first: always assemble top evidence (chunks + observations) before generation.
- Modes: extractive (stitched snippets) or abstractive (LLM with citations).
- Streaming: SSE with `meta`, `token`, `citation`, `final` events.
- Citations: enforce support for all factual spans when `citations=true`.

---

## 7. Security, Tenancy, and Privacy

- Per-workspace isolation in DB, caches, and embeddings (namespaces).
- Access control hooks on documents/observations; private scopes for sensitive sources (e.g., DMs).
- PII redaction pipelines for observations; configurable retention and TTL -> summaries.
- Idempotency for generation; rate limiting with headers.

---

## 8. Observability and Evaluation

- Observability
  - `requestId`, router mode, latency stages, contribution shares, graph influence flags.
  - Error taxonomy with structured payloads and sampling.

- Evaluation
  - Metrics: recall@k, precision (human-labeled), rerank lift, snippet accuracy, rationale faithfulness, latency split.
  - Suites: smoke, regression post-ingest, weekly benchmarks, source-specific, neural-memory QA.
  - Feedback: thumbs up/down loops feed weight calibration and clustering.

---

## 9. APIs and MCP

- Public endpoints (v1): `/v1/search`, `/v1/contents`, `/v1/similar`, `/v1/answer`.
- MCP tools mirror these four capabilities (`search`, `get_contents`, `find_similar`, `answer`).
- Contracts and schemas: see API_SPEC.md and MCP_SPEC.md.

---

## 10. Operations and SLOs

- SLOs: 99% availability for read paths; p95 latency budgets per endpoint.
- Backpressure: queue depth and concurrency caps for embedding/index jobs.
- Aging: nightly consolidation to summaries; rebuild profiles; prune low-importance tails.

---

## 11. Open Questions

- Embedding model policy per view (single multi-purpose vs specialized).
- Persistence of low-confidence inferred links vs transient boost-only.
- Personalization defaults and opt-out mechanisms per workspace.

---

## 12. Website IA (www.lightfast.ai)

Positioning: Lead with Engineering and Products. Research signals are integrated into deep technical write‑ups and product narratives rather than a separate top‑level.

Scope (now): www.lightfast.ai only. Other properties (cloud, docs, status) will be specified later.

Top‑level navigation

- Engineering
- Products
- Company (About, Careers, Press, Contact)
- Legal (Terms, Privacy)

Information architecture (first pass)

- Engineering
  - `/engineering` — Engineering home (systems, infra, product engineering)
  - `/engineering/blog` — Engineering blog (deep dives, postmortems)
  - `/engineering/open-source` — OSS projects and libraries
  - `/engineering/security` — Security and reliability practices

- Products
  - `/products` — Overview of the Lightfast platform
  - `/products/cloud` — Cloud offering overview
  - `/products/api` — Public API and SDK overview
  - `/pricing` — Pricing and tiers
  - `/security` — Security, compliance, and data handling (marketing)
  - `/changelog` — Product changes and release highlights

- Company
  - `/about` — Mission, vision, leadership
  - `/careers` — Open roles
  - `/press` — Press kit and coverage
  - `/contact` — Contact and sales

- Legal
  - `/legal/terms` — Terms of Service
  - `/legal/privacy` — Privacy Policy

SEO and sitemap (design intent)

- Only www is in scope for now; generate a sitemap that lists the above public pages when implemented.
- Avoid indexing work‑in‑progress sections until content is ready; prefer staged rollout (e.g., publish Engineering and core Product pages incrementally).

Future web properties (out of scope for now)

- cloud.lightfast.ai — product app; index only public landing/legal, noindex authenticated.
- docs.lightfast.ai — developer docs; indexable.
- status.lightfast.ai — status page (external provider); indexable.
