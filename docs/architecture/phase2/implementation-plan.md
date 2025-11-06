---
title: Phase 2 Implementation Plan — Linear + Notion
description: Connectors, routing, memory enablement, and observability
status: draft
owner: engineering
audience: engineering
last_updated: 2025-11-06
tags: [implementation, linear, notion]
---

# Phase 2 Implementation Plan — Linear + Notion

Deliver Linear and Notion ingestion with per-store routing and enable the memory layer.

---

## Connectors

- Linear
  - Auth via Console-managed workspace key
  - Ingest issues, projects/epics, comments; webhooks when available, fallback poller
  - Normalize to documents (chunks) + observations (state transitions, priority, labels)

- Notion
  - Auth via Console-managed integration
  - Ingest configured databases/pages; respect included properties
  - Normalize pages to documents (frontmatter → metadata); incidents/specs as observations when enabled

Idempotency
- Use source delivery IDs + action + resource IDs; TTL dedupe keys in Redis

---

## Routing and Stores

- Resolve store by workspace + store name from `lightfast.yml`
- Tag artifacts with `store:<name>` and optional `collection:<name>`
- Multi-repo/multi-db supported via list config; same store

---

## Memory Enablement

- Observations: emit `memory.observation.created` events; schedule embeddings
- Summaries: periodic jobs per store/entity/topic windows (7/30 days defaults)
- Profiles: nightly centroids per entity
- Graph: deterministic edges (OWNED_BY, DEPENDS_ON, BLOCKED_BY, RESOLVES, ALIGNS_WITH_GOAL)

---

## API and Query

- Scope retrieval by `filters.labels: ["store:<name>"]`
- Allow optional expansion to workspace/org when recall is low (flagged)

---

## Observability

- Ingestion metrics: throughput, dedupe hits, lag
- Memory metrics: observation counts, summary coverage, drift
- Retrieval logs: latency splits, router scope/mode, citations

---

## Acceptance

- Linear + Notion ingestion writes documents/chunks with correct labels and collections
- Observations toggled on produce embeddings and appear in search with expected boosts
- Graph edges present and attached to rationale when requested
