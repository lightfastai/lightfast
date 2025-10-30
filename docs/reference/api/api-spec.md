---
title: Lightfast Public API (v1)
description: External contracts for search, contents, similar, and answer endpoints
status: working
owner: platform-apis
audience: engineering
last_updated: 2025-10-27
tags: [api]
---

# Lightfast Public API (v1)

Last Updated: 2025-10-27

This document defines a minimal, developer-friendly external API that fronts Lightfast’s internal Knowledge Store and Memory Graph. It exposes four POST routes:

- POST /v1/search
- POST /v1/contents
- POST /v1/similar
- POST /v1/answer

Internally, the system continues to use the hybrid retrieval pipeline and the relationships‑first Memory Graph. Externally, the API provides simple, predictable JSON contracts for search, content hydration, similarity, and Q&A with citations.

---

## Principles

- Single-responsibility endpoints with explicit request/response types
- Multi-tenant by default (workspace scoping)
- Deterministic, explainable outputs (citations + optional graph rationale)
- Performance budgets surfaced in responses (latency breakdowns)
- Safe defaults; advanced knobs are optional

---

## Authentication, Tenancy, and Headers

- Authorization: `Authorization: Bearer <api_key>`
- Workspace: either `workspaceId` in the body or `X-Workspace-Id` header
- Idempotency (optional): `Idempotency-Key: <uuid>` for `answer`
- Request ID: `X-Request-Id` (generated if not provided)
- Rate limit headers returned on 429 and success: `X-RateLimit-*`

Errors follow a common shape:

```json
{
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "mode must be one of: auto, knowledge, graph, hybrid",
    "details": { "field": "mode" }
  }
}
```

---

## POST /v1/search

Purpose: ranked retrieval of knowledge chunks/documents with optional graph rationale and highlights.

Request

```json
{
  "organizationId": "org_001",          // optional; required if scope = "org"
  "workspaceId": "ws_123",              // optional when scope = "org"
  "scope": "auto",                       // auto | workspace | org (default: auto)
  "q": "who owns billing service and related incidents?",
  "mode": "auto",                        // auto | knowledge | graph | hybrid | keyword | neural | fast (default: auto)
  "autoprompt": true,                     // default: true (query rewrite / expansion)
  "context": false,                       // default: false (if true, return concatenated contents)
  "moderation": false,                    // optional content moderation
  "filters": {
    "sources": ["github", "notion", "slack"],
    "types": ["pull_request", "issue", "doc"],
    "authors": ["alice@example.com"],
    "labels": ["incident", "billing"],
    "after": "2025-01-01T00:00:00.000Z",
    "before": null
  },
  "topK": 20,                             // default: 10 (cap 50)
  "include": {
    "document": true,
    "rationale": true,
    "highlights": true
  },
  "quality": {
    "rerank": true
  }
}
```

- `scope`: `auto | workspace | org` (default `auto`)
  - auto: infer from query + context (defaults to workspace if provided; falls back to org if recall is low)
- `mode`: `auto | knowledge | graph | hybrid | keyword | neural | fast` (default `auto`)
  - auto: router chooses lexical + dense + optional graph/rerank; fast path for identifiers
- `autoprompt`: enable light query rewriting/expansion
- `context`: when `true`, returns concatenated contents optimized for RAG
- `filters`: optional metadata constraints
- `include.rationale`: includes graph seeds/edges when graph bias used
- `quality.rerank`: toggles reranking for semantic queries

Response

```json
{
  "results": [
    {
      "documentId": "doc_abc",
      "chunkId": "chnk_001",
      "score": 0.83,
      "title": "Incident 42: Billing outage",
      "type": "doc",
      "source": "notion",
      "occurredAt": "2025-09-22T10:11:00.000Z",
      "author": "alice@example.com",
      "sectionLabel": "Summary",
      "highlight": "Root cause related to Stripe webhook retries...",
      "url": "https://notion.so/..."
    }
  ],
  "rationale": {
    "routerMode": "hybrid",
    "graph": {
      "entities": [
        { "id": "team_billing", "aliases": ["billing team"] }
      ],
      "edges": [
        { "type": "OWNED_BY", "from": "service_billing", "to": "team_billing", "confidence": 0.96 }
      ],
      "evidenceChunks": ["chnk_001", "chnk_077"]
    }
  },
  "usage": {
    "latencyMs": 122,
    "routerScope": "workspace",
    "inferredFamily": "observations",           // docs | code | tickets | messages | incidents | summaries
    "inferredTimeRange": { "after": null, "before": null },
    "contributionShares": { "chunks": 0.35, "observations": 0.55, "summaries": 0.10 },
    "stages": { "lexical": 21, "vector": 44, "rerank": 36, "hydrate": 21 }
  },
  "requestId": "req_789"
}
```

Notes
- Results are chunk-oriented but carry document metadata. Clients can request raw content via `/v1/contents`.
- Graph rationale only included if `include.rationale = true`.
- When no filters are provided, the router infers scope, family (docs/code/tickets/messages/incidents/summaries), and temporal hints; recency decay is applied by default.

---

### What does mode = "auto" do?

`auto` delegates to the retrieval router to maximize quality within latency budgets:

- Scope inference: prefer workspace if provided; fallback to org aggregator if workspace recall is low or the intent is org‑level (policy/ownership/roadmap).
- Family inference: classify the query (docs/code/tickets/messages/incidents/summaries) and prioritize the corresponding index family.
- Hybrid retrieval: combine lexical prefilter with dense vector search; identifier fast‑paths skip embedding.
- Graph seeding: resolve entities/aliases from the query, apply bounded 1–2 hop boost with rationale (if used).
- Temporal: parse natural time (e.g., "last week") or apply recency decay by default.
- Personalization: bias with profile centroids when available (team/workspace).
- Rerank: apply cross‑encoder rerank on fused top‑K and trim tails; thresholds are calibrated per workspace.

---

## POST /v1/contents

Purpose: hydrate documents/chunks and optionally expand related graph context.

Request

```json
{
  "workspaceId": "ws_123",
  "ids": [
    { "kind": "document", "id": "doc_abc" },
    { "kind": "chunk", "id": "chnk_001" }
  ],
  "expand": {
    "chunks": true,
    "graph": {
      "hops": 1,
      "include": ["relationships", "entities", "evidence"]
    }
  },
  "includeRaw": false
}
```

Response

```json
{
  "documents": [
    {
      "id": "doc_abc",
      "title": "Incident 42: Billing outage",
      "type": "doc",
      "source": "notion",
      "url": "https://notion.so/...",
      "metadata": { "labels": ["incident", "billing"] },
      "body": "...optional if includeRaw = true...",
      "chunks": [
        { "id": "chnk_001", "text": "Root cause related to..." }
      ],
      "graph": {
        "entities": ["team_billing", "service_billing"],
        "relationships": [
          { "type": "OWNED_BY", "from": "service_billing", "to": "team_billing" }
        ],
        "evidence": ["chnk_001"]
      }
    }
  ],
  "chunks": [
    { "id": "chnk_001", "documentId": "doc_abc", "text": "Root cause related to..." }
  ],
  "requestId": "req_790"
}
```

Notes
- Use to hydrate results from `/v1/search` and `/v1/similar`.
- `includeRaw` returns full document body when available (S3-backed).

---

## POST /v1/similar

Purpose: find semantically similar content to a given text, chunk, or document.

Request

```json
{
  "organizationId": "org_001",          // optional; required if scope = "org"
  "workspaceId": "ws_123",              // optional when scope = "org"
  "scope": "auto",                       // auto | workspace | org (default: auto)
  "mode": "auto",                        // auto | neural | keyword | hybrid | fast (default: auto)
  "autoprompt": true,                     // default: true (query rewrite / expansion for text)
  "subject": {
    "kind": "text",
    "text": "Stripe webhook retries and idempotency"
    // or { "kind": "document", "documentId": "doc_abc" }
    // or { "kind": "chunk",    "chunkId":    "chnk_001" }
  },
  "by": "chunks",                         // 'chunks' | 'documents'
  "filters": { "sources": ["github", "notion"] },
  "topK": 10,                              // default: 10 (cap 50)
  "quality": { "rerank": false }
}
```

- `subject`: `{ kind: 'text' | 'chunk' | 'document', ... }`
- `by`: `'chunks' | 'documents'` result granularity

Response

```json
{
  "matches": [
    {
      "documentId": "doc_inc_7",
      "chunkId": "chnk_077",
      "score": 0.76,
      "title": "PR: Retry strategy for Stripe webhooks",
      "source": "github",
      "url": "https://github.com/...",
      "highlight": "Implements idempotency key and backoff..."
    }
  ],
  "usage": { "latencyMs": 88, "routerScope": "workspace" },
  "requestId": "req_791"
}
```

---

## POST /v1/answer

Purpose: retrieve and synthesize an answer with citations; optionally stream tokens.

Request (non-streaming)

```json
{
  "organizationId": "org_001",          // optional; required if scope = "org"
  "workspaceId": "ws_123",              // optional when scope = "org"
  "scope": "auto",                       // auto | workspace | org (default: auto)
  "question": "Who owns the billing service and what incidents affected it in Q3?",
  "mode": "auto",                        // auto | knowledge | graph | hybrid | keyword | neural | fast
  "autoprompt": true,
  "context": false,                      // if true, embed concatenated retrieval contents into prompt
  "answerType": "abstractive",
  "citations": true,
  "maxTokens": 400,
  "model": "gpt-4o-mini",
  "constraints": {
    "after": "2025-07-01T00:00:00.000Z",
    "before": "2025-09-30T23:59:59.999Z"
  },
  "include": { "rationale": true },
  "quality": { "rerank": true }
}
```

Response (non-streaming)

```json
{
  "answer": "The billing service is owned by the Billing Team...",
  "citations": [
    { "documentId": "doc_abc", "chunkId": "chnk_001", "url": "https://notion.so/..." },
    { "documentId": "doc_inc_7", "chunkId": "chnk_077", "url": "https://github.com/..." }
  ],
  "rationale": {
    "routerMode": "hybrid",
    "graph": { "edges": [ { "type": "OWNED_BY", "from": "service_billing", "to": "team_billing" } ] }
  },
  "retrieval": {
    "results": [ /* same shape as /v1/search */ ],
    "latencyMs": 130
  },
  "generation": { "model": "gpt-4o-mini", "latencyMs": 420 },
  "usage": { "latencyMs": 580, "routerScope": "workspace" },
  "requestId": "req_792"
}
```

Streaming
- Request: add `"stream": true`
- Response: Server-Sent Events (`text/event-stream`) with events: `meta`, `token`, `citation`, `final`.

Notes
- `answerType: extractive` can return stitched snippets + minimal prose.
- `citations: true` ensures every factual span can be traced to a chunk.

---

## Request and Filter Types (reference)

```ts
// Mode selection
export type RetrievalMode = 'auto' | 'knowledge' | 'graph' | 'hybrid' | 'keyword' | 'neural' | 'fast';

// Shared filters
export interface RetrievalFilters {
  sources?: string[];  // e.g. ['github', 'notion']
  types?: string[];    // e.g. ['pull_request', 'issue', 'doc']
  authors?: string[];
  states?: string[];
  labels?: string[];
  after?: string;      // ISO date
  before?: string;     // ISO date
}

// Scope selection
export type RetrievalScope = 'auto' | 'workspace' | 'org';
```

---

## Mapping to Internals

- /v1/search → Query Processor → Hybrid Retrieval → Optional Rerank → Hydrate → Optional Graph Rationale
  - Uses the pipeline in ../../architecture/retrieval/search-design.md
- /v1/contents → Redis hydration → PlanetScale fallback; optional S3 for raw bodies
- /v1/similar → Dense (+ optional sparse) search; may reuse embedding of `subject` if chunk/document
- /v1/answer → Retrieval (above) → Synthesis (LLM) → Citations enforced → Optional streaming

Performance targets (p95)
- search: identifier < 90 ms; semantic < 150 ms
- contents: hydrated < 120 ms for 10 items
- similar: < 150 ms
- answer: end-to-end target < 1.5–2.5 s depending on model

---

## Security and Limits

- Per-workspace isolation at DB, index, and cache layers
- Request body limit: 256 KiB; `ids` length up to 100 per call
- `topK` capped at 50 for search/similar
- SSE idle timeout: 60 s

---

## Examples

curl search

```bash
curl -X POST "$BASE/v1/search" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId":"ws_123",
    "q":"billing incidents",
    "mode":"auto",
    "topK":10,
    "include":{"rationale":true}
  }'
```

curl contents

```bash
curl -X POST "$BASE/v1/contents" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId":"ws_123",
    "ids":[{"kind":"document","id":"doc_abc"}],
    "expand":{"chunks":true}
  }'
```

---

## Versioning

- Endpoint path carries major version (`/v1/...`).
- Embedding model/versioning is internal; surfaced via `usage.embeddingVersion` when helpful.

---

## Deprecations

- Legacy knowledge routes (`/api/knowledge/*`) can remain for internal use; recommend consolidating public traffic on these four endpoints.
