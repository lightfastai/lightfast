---
title: Future Enhancements — Docs Stores
description: Optional features to layer on after Phase 1
status: draft
owner: product
audience: internal
last_updated: 2025-11-06
tags: [future, enhancements]
---

# Future Enhancements (Docs Stores)

This page lists optional enhancements we can add after Phase 1. None are required for the initial docs-only launch.

---

## Custom Labels (Optional)

- Purpose: cross-store selection, policy segments, observability cohorts without renaming stores.
- Examples: `site:enterprise`, `domain:payments`, `product:cloud`.
- Recommendation: keep off for Phase 1; use only the automatic `store:<name>` and `collection:<name>` selectors.

---

## Cross-Store Search

- Allow queries across multiple docs stores (e.g., OSS + Enterprise) via shared labels or explicit store list.
- API: support `filters.labels` OR `filters.stores` (explicit names) for clarity.

---

## Versioned Docs Strategy

- Options
  - Store-per-version: `docs-v1`, `docs-v2`
  - Single store with `collection:<version>` labeling
- Choose based on routing and site UX; avoid mixing if URLs overlap.

---

## Synonyms and Aliases

- Add per-store synonym sets (e.g., `SSO` ↔ `Single Sign-On`) to improve recall.
- Maintain in config or Console with validation; applied during query rewrite.

---

## Precomputation and Caching

- Precompute page embeddings/snippets during build to reduce ingestion latency.
- Cache `/api/search` responses at the edge with short TTL and vary by query hash.

---

## Observability

- Segment retrieval logs and quality metrics by store/collection and (optionally) custom labels.
- Add evaluation suites per store, track recall@k and snippet accuracy.

