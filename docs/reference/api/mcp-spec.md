---
title: MCP Mapping
description: Mapping the Public API to Model Context Protocol tools and resources
status: working
owner: platform-apis
audience: engineering
last_updated: 2025-10-27
tags: [api, mcp]
---

# Lightfast MCP (Model Context Protocol) Mapping

Last Updated: 2025-10-27

This document maps the Lightfast Public API (docs/reference/api/api-spec.md) to an MCP server surface so agents (e.g., Claude, OpenAI tool use, LangGraph) can consume search, content hydration, similarity, and Q&A through four tools.

---

## Overview

- Server offers four tools: `search`, `get_contents`, `find_similar`, `answer`.
- Tools forward to the corresponding HTTP endpoints and return structured JSON content with citations and optional graph rationale.
- Optional resources expose direct read handles to `knowledge:document` and `knowledge:chunk` for clients that support MCP resources.

---

## Tool: search

Name: `search`

Input schema

```json
{
  "type": "object",
  "required": ["q"],
  "properties": {
    "workspaceId": {"type": "string"},
    "q": {"type": "string", "minLength": 1},
    "mode": {"type": "string", "enum": ["auto","knowledge","graph","hybrid"], "default": "auto"},
    "filters": {
      "type": "object",
      "properties": {
        "sources": {"type": "array", "items": {"type": "string"}},
        "types": {"type": "array", "items": {"type": "string"}},
        "authors": {"type": "array", "items": {"type": "string"}},
        "labels": {"type": "array", "items": {"type": "string"}},
        "after": {"type": "string", "format": "date-time"},
        "before": {"type": "string", "format": "date-time"}
      }
    },
    "topK": {"type": "integer", "minimum": 1, "maximum": 50, "default": 20},
    "include": {
      "type": "object",
      "properties": {
        "document": {"type": "boolean", "default": true},
        "rationale": {"type": "boolean", "default": false},
        "highlights": {"type": "boolean", "default": true}
      }
    },
    "quality": {
      "type": "object",
      "properties": {
        "rerank": {"type": "boolean", "default": true}
      }
    }
  }
}
```

Output content

- `application/json` body is identical to `/v1/search` response.

---

## Tool: get_contents

Name: `get_contents`

Input schema

```json
{
  "type": "object",
  "required": ["ids"],
  "properties": {
    "workspaceId": {"type": "string"},
    "ids": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["kind","id"],
        "properties": {
          "kind": {"type": "string", "enum": ["document","chunk"]},
          "id": {"type": "string"}
        }
      },
      "minItems": 1,
      "maxItems": 100
    },
    "expand": {
      "type": "object",
      "properties": {
        "chunks": {"type": "boolean", "default": false},
        "graph": {
          "type": "object",
          "properties": {
            "hops": {"type": "integer", "minimum": 0, "maximum": 2, "default": 1},
            "include": {
              "type": "array",
              "items": {"type": "string", "enum": ["relationships","entities","evidence"]}
            }
          }
        }
      }
    },
    "includeRaw": {"type": "boolean", "default": false}
  }
}
```

Output content

- `application/json` body is identical to `/v1/contents` response.

---

## Tool: find_similar

Name: `find_similar`

Input schema

```json
{
  "type": "object",
  "required": ["subject"],
  "properties": {
    "workspaceId": {"type": "string"},
    "subject": {
      "type": "object",
      "oneOf": [
        {"type": "object", "required": ["kind","text"], "properties": {"kind": {"const": "text"}, "text": {"type": "string"}}},
        {"type": "object", "required": ["kind","id"], "properties": {"kind": {"const": "chunk"}, "id": {"type": "string"}}},
        {"type": "object", "required": ["kind","id"], "properties": {"kind": {"const": "document"}, "id": {"type": "string"}}}
      ]
    },
    "by": {"type": "string", "enum": ["chunks","documents"], "default": "chunks"},
    "filters": {"$ref": "#/definitions/filters"},
    "topK": {"type": "integer", "minimum": 1, "maximum": 50, "default": 10}
  },
  "definitions": {
    "filters": {
      "type": "object",
      "properties": {
        "sources": {"type": "array", "items": {"type": "string"}},
        "types": {"type": "array", "items": {"type": "string"}},
        "authors": {"type": "array", "items": {"type": "string"}},
        "labels": {"type": "array", "items": {"type": "string"}},
        "after": {"type": "string", "format": "date-time"},
        "before": {"type": "string", "format": "date-time"}
      }
    }
  }
}
```

Output content

- `application/json` body is identical to `/v1/similar` response.

---

## Tool: answer

Name: `answer`

Input schema

```json
{
  "type": "object",
  "required": ["question"],
  "properties": {
    "workspaceId": {"type": "string"},
    "question": {"type": "string", "minLength": 1},
    "mode": {"type": "string", "enum": ["auto","knowledge","graph","hybrid"], "default": "hybrid"},
    "answerType": {"type": "string", "enum": ["extractive","abstractive"], "default": "abstractive"},
    "citations": {"type": "boolean", "default": true},
    "maxTokens": {"type": "integer", "minimum": 16, "maximum": 4096, "default": 400},
    "model": {"type": "string"},
    "constraints": {
      "type": "object",
      "properties": {
        "after": {"type": "string", "format": "date-time"},
        "before": {"type": "string", "format": "date-time"}
      }
    },
    "stream": {"type": "boolean", "default": false},
    "include": {
      "type": "object",
      "properties": {
        "rationale": {"type": "boolean", "default": true}
      }
    }
  }
}
```

Output content

- Non-streaming: `application/json` body identical to `/v1/answer` response.
- Streaming: `text/event-stream` with events: `meta`, `token`, `citation`, `final`.

---

## Resources (optional)

- `resource://knowledge/document/{id}` → returns a document JSON payload
- `resource://knowledge/chunk/{id}` → returns a chunk JSON payload

`listResources` can advertise patterns and counts; `readResource` maps to `/v1/contents` under the hood.

---

## Transport Mapping

- MCP server hosts the four tools, each implemented as a thin proxy to the HTTP endpoints with API key injection, workspace scoping, and basic retries.
- Timeouts: search/similar/contents 5s; answer 30s (or stream until completion); configurable per workspace.

---

## Observability

- Attach `requestId` to tool results.
- Surface latency breakdowns from the HTTP responses under a `meta` field.
- Forward structured errors in MCP error payload.

---

## Security

- API key required; server stores or receives per-workspace credentials.
- Optional allowlist for tool usage per workspace (`search`/`answer` gating).
