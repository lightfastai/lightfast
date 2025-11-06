---
title: Phase 1 Implementation Plan — Docs Sync
description: Minimal plan to deliver docs store ingestion (push-to-main) and search integration
status: working
owner: engineering
audience: engineering
last_updated: 2025-11-06
tags: [implementation, plan]
---

# Phase 1 Implementation Plan — Docs Sync

Deliver a minimal, reliable slice for docs search powered by Lightfast using a store and push-to-main ingestion.

---

## Ingestion (Push to Main)

- Trigger: GitHub App webhook on push to main
- Reads `lightfast.yml`, resolves workspace, ensures store exists (auto-provision)
- Resolves changed files via commit diff and store globs
- Parses MDX frontmatter, derives slug and URL
- Chunks (tokens/overlap), upserts docs/chunks to Mastra RAG index (store-level collection)
- Idempotent by `(workspaceId, storeName, filePath, content_hash)`

---

## apps/docs Integration

- `/api/search` proxies to Lightfast `/v1/search` filtered by `store:<name>`
- Maps response to existing UI search shape (title, url, snippet)

---

## API Usage

- `/v1/search` for retrieval (delegates to Mastra RAG search for the store collection)
- `/v1/contents` for hydration when needed

---

## Guardrails

- Tenant isolation by workspace
- PII redaction on writes
- Observability: record latency splits and request IDs

---

## Acceptance Check (repeatable)

- Push to main indexes changed docs idempotently
- `/api/search` returns store-scoped results that the UI renders correctly
- p95 latency meets targets; logs include latency splits and request IDs
