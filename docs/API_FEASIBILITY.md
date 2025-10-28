# 4-Route API Feasibility (Knowledge + Memory)

Last Updated: 2025-10-27

This note validates that the proposed external API (docs/API_SPEC.md) is achievable with the current Knowledge Store and Memory Graph designs. It also calls out small implementation notes and guardrails.

---

## Summary

- All four endpoints are implementable with the existing architecture and documented pipelines.
- No schema changes are strictly required. A few metadata invariants and best practices ensure smooth filtering, traversal, and hydration.

Status by endpoint
- POST /v1/search → Ready: uses Query Processor + Hybrid Retrieval + optional Graph boost/rationale (docs/SEARCH_DESIGN.md).
- POST /v1/contents → Ready: Redis hydration + PlanetScale fallback; S3 body optional (docs/KNOWLEDGE_STORE.md).
- POST /v1/similar → Ready: dense (+ optional sparse) search; embed subject text or hydrate chunk/document text to embed.
- POST /v1/answer → Ready: retrieval above + LLM synthesis + SSE streaming; citations sourced from retrieval/hydration.

---

## Preconditions and Invariants

- Tenancy: every document/chunk/graph record is workspace-scoped; Pinecone namespaces include workspace and embedding version.
- IDs: `documentId` and `chunkId` are stable and resolvable via PlanetScale; chunk→document mapping cached in Redis.
- Metadata (chunks): include at least `{ workspaceId, documentId, source, type, author, labels[], occurredAt }` in DB and Pinecone metadata for filtering.
- Embedding versions: retrieval automatically targets the active per-workspace model; write current version into Pinecone namespace.
- Caching: Redis caches for chunk/document hydration and graph adjacency (out/in) are populated by ingestion.

---

## Endpoint Mapping Details

### POST /v1/search
- Query processing: existing rules (identifier vs semantic; mode selection; metadata filter build) per docs/SEARCH_DESIGN.md.
- Hybrid retrieval: lexical + vector; rerank optional and thresholded; fuse and cap to topK.
- Graph bias: optional 1–2 hop traversal with edge allowlist; add `GRAPH_WEIGHT * linkScore` to candidates; include rationale when requested.
- Highlights: `buildHighlight(candidate, chunk, doc)` already outlined in docs/SEARCH_DESIGN.md.

Implementation notes
- Return `routerMode` for observability and to match API spec.
- Ensure Pinecone metadata keys align with filters (see below).

### POST /v1/contents
- Hydration: fetch by `documentId` and/or `chunkId` from Redis; fallback to PlanetScale.
- Raw bodies: when `includeRaw = true`, stream from S3 using document’s artifact pointer.
- Graph expansion: for provided IDs, list linked entities/relationships via `document_entities` and `relationship_evidence` with hop=0..N.

Implementation notes
- Limit response size: chunk count per document and optional `maxChunks` if needed.

### POST /v1/similar
- Subject kinds:
  - text: embed and query Pinecone.
  - chunk: hydrate chunk text by ID, embed with `search_query` type, then query.
  - document: hydrate document (or top chunks), embed concatenated short text or compute centroid (optional), then query.
- Result granularity: fuse/aggregate to document level if `by = 'documents'`.

Implementation notes
- Using fresh embeddings for chunk/document is acceptable; prefetching stored vectors is optional and can be added later.

### POST /v1/answer
- Retrieval: call `/v1/search` internally with `include.rationale` and constraints; hydrate top results.
- Synthesis: LLM call with strict citation enforcement; include graph rationale when available.
- Streaming: transform model tokens to SSE events: `meta`, `token`, `citation`, `final`.

Implementation notes
- Idempotency via `Idempotency-Key` advisable for long-running requests.

---

## Metadata and Filtering (Knowledge Store)

To support filters in `search` and `similar`, ensure:
- Chunk DB record and Pinecone metadata carry:
  - `workspaceId`: string
  - `documentId`: string
  - `source`: enum-like string (e.g., github, notion, slack)
  - `type`: artifact type (pull_request, issue, doc, message, page, etc.)
  - `author`: normalized person identifier (email or entity ID)
  - `labels`: array of strings
  - `occurredAt`: ISO timestamp (creation or event time)
- Use the same keys in PlanetScale and Pinecone metadata so the Pinecone filter matches DB filters.

---

## Graph Traversal and Rationale (Memory)

- Entity resolution: via `entity_aliases`; seed traversal using query hints or entities found in top candidates.
- Traversal: enforce hop limit (1–2), intent-based edge allowlists, and time budgets (15–30 ms) to avoid tail latencies.
- Evidence: use `relationship_evidence` and `document_entities` to cite chunk IDs in the rationale.

---

## Observability and Quality

- Record per-request: `requestId`, `routerMode`, stage latencies, candidate counts, graph fields (`graphSeeds`, `graphEdgesUsed`, `graphBoostApplied`).
- Evaluation: maintain recall@k and snippet accuracy suites; calibrate rerank thresholds per workspace.

---

## Risks and Mitigations

- Document-level similarity quality: if no precomputed document vectors, aggregate chunk results or compute centroid on the fly → acceptable with small overhead.
- SSE stability: ensure heartbeat/keep-alive for long generations; enforce 60s idle timeout as spec’d.
- Filter drift: lock and document metadata keys to avoid schema drift between DB and Pinecone.

---

## Conclusion

The four-route API cleanly overlays the current Knowledge + Memory design. Provided the metadata invariants and graph caches are respected, each endpoint is straightforward to implement with existing components and achieves the stated performance targets.

