---
title: Query Examples
description: Minimal examples for search, contents, similar, and answer endpoints
status: draft
owner: platform-apis
audience: engineering
last_updated: 2025-10-30
tags: [api, examples]
---

# Query Examples

Minimal examples for `/v1/search`, `/v1/contents`, `/v1/similar`, and `/v1/answer`.

---

## /v1/search

Request
```bash
curl -s -X POST "$BASE/v1/search" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "ws_123",
    "q": "who owns billing service",
    "include": {"rationale": true},
    "topK": 10
  }'
```

Response (abridged)
```json
{
  "results": [
    { "documentId": "doc_abc", "chunkId": "chnk_001", "title": "CODEOWNERS for billing", "score": 0.84 }
  ],
  "rationale": {
    "routerMode": "hybrid",
    "graph": {
      "entities": [{ "id": "service_billing" }, { "id": "team_billing" }],
      "edges": [{ "type": "OWNED_BY", "from": "service_billing", "to": "team_billing" }]
    }
  },
  "usage": { "latencyMs": 128 },
  "requestId": "req_123"
}
```

---

## /v1/contents

Request
```bash
curl -s -X POST "$BASE/v1/contents" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "ws_123",
    "ids": [ {"kind": "document", "id": "doc_abc"} ],
    "expand": {"chunks": true}
  }'
```

Response (abridged)
```json
{
  "documents": [
    { "id": "doc_abc", "title": "Incident 42: Billing" }
  ],
  "chunks": [ { "id": "chnk_001", "documentId": "doc_abc", "text": "Root cause ..." } ],
  "requestId": "req_124"
}
```

---

## /v1/similar

Request
```bash
curl -s -X POST "$BASE/v1/similar" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "ws_123",
    "subject": {"kind": "text", "text": "Stripe webhook idempotency"},
    "topK": 5
  }'
```

Response (abridged)
```json
{
  "matches": [
    { "documentId": "doc_inc_7", "chunkId": "chnk_077", "title": "Retry strategy for webhooks", "score": 0.78 }
  ],
  "requestId": "req_125"
}
```

---

## /v1/answer

Request
```bash
curl -s -X POST "$BASE/v1/answer" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "ws_123",
    "question": "Who owns the billing service and major incidents in Q3?",
    "citations": true,
    "include": {"rationale": true}
  }'
```

Response (abridged)
```json
{
  "answer": "Billing service is owned by the Billing Team ...",
  "citations": [ { "documentId": "doc_abc", "chunkId": "chnk_001" } ],
  "rationale": { "routerMode": "hybrid" },
  "requestId": "req_126"
}
```
