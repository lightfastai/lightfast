# Retrieval & Ranking — Neural Design

Target: <90 ms p95 for identifier queries; <150 ms p95 for semantic queries, while maintaining high recall across chunks and neural memory. See also: `docs/RETRIEVAL_ROUTER_DIAGRAM.md` for internal flow diagrams and knobs.

Terminology: Knowledge refers to chunked documents. Neural Memory refers to observations, summaries, and profiles. Graph introduces entity/relationship signals for explainability and bounded bias.

---

## Pipeline Overview

User Query → Query Processor → Candidate Generation (Knowledge + Neural) → Fusion & Scoring (with Graph Bias) → Rerank (conditional) → Hydrate & Compose

---

## Router Modes (Internal)

- knowledge: hybrid over chunks (lexical + dense) with optional graph bias.
- neural: dense over observations (± summaries/profiles) with optional lexical prefilter.
- hybrid: run knowledge and neural in parallel; fuse with calibrated weights.

Classification hints
- Identifiers (`#123`, `LINEAR-ABC-12`, `repo:path`) → knowledge.
- Recency/“what happened/decisions/summary” → neural or hybrid.
- Ownership/dependency/alignment → hybrid with bounded graph bias.

Router choice is logged as `retrieval_logs.routerMode`.

---

## Query Processing

- Parse syntax (identifiers, sources, types, time bounds, labels).
- Resolve entities via alias tables (emails, handles, URLs) for optional graph seeding.
- Choose embedding model and build query embeddings per view: title, body, summary.
- Identifier fast-path skips embedding and hits PlanetScale directly.

Types
- RetrievalQuery: { workspaceId, text, filters, mode, limit }
- RetrievalFilters: { sources, types, authors, labels, after, before }

---

## Candidate Generation

- Knowledge (chunks)
  - Lexical: Postgres FTS/Meilisearch over chunk text.
  - Dense: Pinecone query in `{workspaceId}-{embeddingVersion}` namespace for chunks.

- Neural (observations/summaries/profiles)
  - Dense: Pinecone query over observations; optionally include summaries for overview queries.
  - Profile similarity: compute query → entity centroid similarity to bias candidates.

- Seeds for graph
  - From resolved entities or top candidates’ linked entities.

---

## Fusion & Scoring

Score per candidate: `score = wv*vector + wl*lexical + wg*graph + wr*recency + wi*importance + wp*profile`

- vector: normalized similarity from Pinecone
- lexical: normalized FTS score
- graph: hop/confidence-weighted boost for linked entities/edges (bounded 1–2 hops)
- recency: exponential decay on occurredAt
- importance: source/type/labels-derived weight (e.g., incidents, RFCs)
- profile: similarity to relevant entity profiles

Weights are calibrated per workspace using feedback and suites; defaults are latency-safe.

---

## Graph Bias and Rationale

- Traversal: Redis adjacency caches; hop limit 1–2; allowlists by intent (ownership: OWNED_BY/MEMBER_OF; dependencies: DEPENDS_ON/BLOCKED_BY/RESOLVES; alignment: ALIGNS_WITH_GOAL).
- Boost: `graphBoost = GRAPH_WEIGHT * confidence * hopFactor` (1.0 for 1 hop, 0.6 for 2 hops).
- Rationale: include entities, edges, and evidence IDs when graph influenced ranking or routerMode favors structure.

---

## Rerank

- Apply cross-encoder rerank on fused top-K when `rerank=true` and K ≥ threshold.
- Workspace-calibrated relevance threshold trims tails.

---

## Hydration & Highlighting

- Fetch chunks, documents, and observations from Redis caches; PlanetScale fallback.
- Build highlights via lexical windows or model-assisted snippets.
- Attach URLs and section labels for auditability.

---

## Response Assembly

- Return ranked results with consistent fields for chunks and observations (documentId/chunkId or observationId), plus optional rationale and latency splits.
- For `/v1/answer`, assemble top evidence and either stitch extractive spans or drive an LLM with citations; support SSE streaming.

---

## Monitoring & Evaluation

- Log: query, filters, routerMode, latency splits, contribution shares (chunks/observations/summaries), rerank usage, graph influence flags.
- Evaluate: recall@k, precision, rerank lift, snippet accuracy, rationale faithfulness, latency; segment by routerMode and source family.

---

## Latency Targets (p95)

- identifier: <90 ms
- semantic (search/similar): <150 ms
- contents hydration (10 items): <120 ms
- answer end-to-end: 1.5–2.5 s (model-dependent)

- Explore hierarchical graph retrieval (GraphRAG) for complex multi-hop queries.
- Add as‑of temporal queries (respect `since`/`until` and intent events) when `temporal.as_of` flag is enabled.

---

_Last reviewed: 2025-02-10_
