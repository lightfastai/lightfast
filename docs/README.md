# Lightfast — Neural Memory for Teams

Last Updated: 2025-10-28

Lightfast is a neural memory system that combines semantic retrieval with explicit structure. We unify three pillars:

- Knowledge (durable chunks from sources like GitHub, Linear, Notion, Slack)
- Neural Memory (observations, summaries, and profiles purpose-built for semantic search)
- Graph (entities and relationships for explainability and short-hop reasoning)

Together, they deliver answers and context with evidence — fast, explainable, and agent-ready.

---

## Table of Contents

- [Mission](#mission)
- [Vision](#vision)
- [Principles](#principles)
- [What We Store](#what-we-store)
- [How It Works](#how-it-works)
- [External Interface (v1)](#external-interface-v1)
- [Architecture (High Level)](#architecture-high-level)
- [Roadmap (Docs)](#roadmap-docs)
- [Docs Index](#docs-index)
- [Glossary](#glossary)
- [Reading Order](#reading-order)
- [Next Steps](#next-steps)

## Mission

- Make organizational knowledge immediately findable, navigable, and trustworthy for people and agents.
- Capture high-signal observations as they happen and retain long-lived structure for reasoning.

## Vision

- Any tool can ask “who/what/why/depends” and receive accurate, explainable answers grounded in memory — not just keywords — across the company’s ecosystem in real time.

## Principles

- Neural-first, structure-aware: semantic retrieval augmented by explicit entities/edges.
- Evidence over assertion: every claim traces to memory (chunks/observations) and relations.
- Multi-representation by default: titles, snippets, bodies, and summaries improve recall and precision.
- Developer-first, tenant-safe: simple APIs, clear contracts, strong isolation.
- Quality as a loop: measure, calibrate, and adapt with feedback.

---

## What We Store

- Knowledge Chunks: durable slices of documents for high-recall retrieval.
- Memory Observations: atomic “moments” like decisions, incident lines, PR highlights, Q/A; multi-view embeddings.
- Memory Summaries: clustered rollups by entity/topic/time for quick orientation and aging/compression.
- Memory Profiles: per-entity prototype vectors (centroids) and descriptors for personalization and biasing.
- Graph: explicit entities and typed relationships for explainability and 1–2 hop traversal.

Beliefs and intent live within summaries, not as a privileged type. They emerge from memory rather than constraining it.

---

## How It Works

- Ingest: connectors normalize artifacts → create chunks and observations; attach entities, timestamps, and importance; embed multiple views.
- Index: vector indexes per workspace and embedding version for chunks, observations, summaries, and profiles.
- Retrieve: hybrid pipeline fuses dense, lexical, graph bias, recency, importance, and profile similarity; cross-encoder reranks top-K.
- Explain: cite chunks/observations and show graph rationale (entities, edges, evidence) when applicable.
- Answer: compose extractive or abstractive responses with citations; stream when needed.

---

## External Interface (v1)

- POST `/v1/search`: ranked results with optional rationale and highlights.
- POST `/v1/contents`: hydrate documents/chunks and expand graph context.
- POST `/v1/similar`: find semantically similar content to text/chunk/document.
- POST `/v1/answer`: retrieve → synthesize an answer with citations (stream optional).

See API_SPEC.md for request/response contracts and limits.

---

## Architecture (High Level)

- Storage: PlanetScale (MySQL) for metadata, S3 for raw bodies, Redis for caches/queues.
- Indexing: Pinecone for dense (+ optional sparse) vectors; namespaces per workspace and embedding version.
- Router: `knowledge | neural | hybrid` under the hood (public API stays simple); graph bias is bounded and explainable.
- Rerank: cross-encoder rerank on fused candidates; calibrated thresholds per workspace.
- Observability: request IDs, latency stages, router mode, graph influence, and contribution shares (chunks vs observations vs summaries).
- Evaluation: recall@k, rerank lift, snippet accuracy, rationale faithfulness, latency; regression + periodic suites.

---

## Roadmap (Docs)

- SPEC.md — full architecture spec (data model, pipelines, retrieval, scoring, SLOs, security, evaluation)
- API_SPEC.md — public API contracts (search, contents, similar, answer)
- MCP_SPEC.md — MCP tool mapping for agents
- DATA_MODEL.md — ERD and index families
- OBSERVATIONS_HEURISTICS.md — guidance for high‑signal extraction
- Implementation Guides — to follow after spec sign-off

---

## Docs Index

- Core
  - SPEC.md — Architecture Spec
  - DATA_MODEL.md — ERD and index families
  - STORAGE_ARCHITECTURE.md — Storage & Indexing
  - STORAGE_ARCHITECTURE_DIAGRAM.md — Architecture diagrams (ASCII + Mermaid)
- Retrieval
  - SEARCH_DESIGN.md — Retrieval & Ranking
  - RETRIEVAL_ROUTER_DIAGRAM.md — Router internals (flow, knobs)
- Ingestion
  - SYNC_DESIGN.md — Ingestion & Consolidation
  - OBSERVATIONS_HEURISTICS.md — High‑signal extraction
- APIs & Agents
  - API_SPEC.md — Public API (v1)
  - MCP_SPEC.md — MCP mapping
- Memory & Identity
  - docs/memory/GRAPH.md — Graph rationale & signals
  - docs/memory/SPEC.md — Neural Memory rollout
  - docs/memory/RESEARCH_NEURAL_SEARCH.md — Research notes
  - IDENTITY_DESIGN.md — Users ↔ Graph Persons

---

## Glossary

- Observation: atomic, high-signal memory unit with provenance and embeddings.
- Summary: clustered rollup (entity/topic/time) that compresses observations.
- Profile: per-entity centroid and descriptors used for biasing and personalization.
- Graph Rationale: compact explanation of entities/edges that influenced retrieval.

---

## Reading Order

1) SPEC.md — architecture deep dive
2) API_SPEC.md — external contracts
3) MCP_SPEC.md — agent tooling
4) Implementation Guides — ingestion, indexing, retrieval, and ops

---

## Next Steps

- Docs
  - CONSOLIDATION_POLICY.md — windows, summary format, coverage metrics, rebuild cadence.
  - RETRIEVAL_CONFIG.md — weights/topK/rerank thresholds/graph hop+weights/decays; defaults by workspace size.
  - PRIVACY_SECURITY.md — tenancy, PII redaction, retention, personal memory opt‑in/out.
  - DIAGRAM_EXPORTS.md — PNG/SVG export workflow for Mermaid diagrams.
- Examples
  - QUERY_EXAMPLES.md — sample requests for `/v1/search`, `/v1/similar`, `/v1/answer` with expected shapes.
  - RATIONALE_EXAMPLES.md — example graph rationales and evidence traces.
- Implementation Guides (follow‑up)
  - Minimal ingestion walkthrough (from GitHub PR → chunks + observations).
  - Retrieval router tuning guide (how to calibrate weights and thresholds).
