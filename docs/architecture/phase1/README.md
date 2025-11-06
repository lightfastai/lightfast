---
title: Phase 1 — Docs Sync Scope
description: Scope for docs stores, sync CLI, and search integration
status: working
owner: product
audience: internal
last_updated: 2025-11-06
tags: [product, roadmap, dx]
---

# Phase 1 — Docs Sync Scope

Defines the initial product surfaces, DX expectations, and scenarios to ship using existing architecture and APIs.

---

## Goals

- Deliver docs search powered by Lightfast with great DX.
- One-file config (lightfast.yml) with globs and chunking.
- Auto-provisioned stores; ingestion runs on push to main.

Out-of-scope (Phase 0/1): deep Linear/Jira/Notion, long-lived agent workflows, model fine-tuning.

---

## Products

See API contracts: ../../reference/api/api-spec.md

---

## Acceptance Criteria

- Single-file config (`lightfast.yml`) defines a docs store with globs and chunking.
- Push to main indexes changed pages idempotently (no-ops when unchanged).
- apps/docs `/api/search` proxies to Lightfast scoped by store label and returns results compatible with UI.
- p95 latency within API budgets; basic observability in place.

---

## Navigation

- DX Configuration: ./dx-configuration.md
- Data Model: ./data-model.md
- Inngest Pipeline: ./inngest-pipeline.md
- Mastra Integration: ./mastra-integration.md
- Implementation Plan: ./implementation-plan.md
- Open Questions: ./open-questions.md
