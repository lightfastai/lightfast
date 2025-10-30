---
title: Consolidation Policy
description: Windows, formats, coverage metrics, and rebuild cadence for summaries and profiles
status: draft
owner: platform-memory
audience: engineering
last_updated: 2025-10-30
tags: [memory, summaries, profiles, consolidation]
---

# Consolidation Policy

Defines when and how observations are consolidated into summaries and how profiles are rebuilt. Goals: reduce retrieval tail, preserve explainability, and keep costs bounded.

---

## Summary Windows

- By entity/topic/time with rolling windows; embed and index summaries.

Recommended windows
- entity.active: 7 days (daily rollups)
- entity.stable: 30 days (weekly rollups)
- topic.cross_workspace: 90 days (monthly rollups)

Triggers
- window_end or min_count reached (e.g., ≥50 observations)
- explicit backfill for new entities or policy changes

---

## Summary Format

- text: 3–7 sentence rollup
- coverage: counts by source/type/labels, time histogram
- embeddings: per view (title optional, body required, summary optional)
- metadata: entity/topic ids, window, createdAt, embeddingVersion

Constraints
- ≤1200 chars body
- faithful to evidence; cite representative observation IDs in metadata

---

## Profiles

- profiles compute centroids per entity across observations and summaries.
- descriptors capture keywords/phrases; drift monitors track change over time.

Rebuild cadence
- nightly for active entities; weekly for stable entities
- also trigger when drift > threshold (e.g., 0.25 cosine delta over 30 days)

---

## Aging and Retention

- observations: keep hot for 90 days; compress into summaries beyond 180 days (retain evidence ids)
- summaries: retain indefinitely; rebuild when window policy changes
- personal memory (if enabled): separate retention policy; default 90 days with opt‑out

---

## Evaluation Hooks

- after each consolidation run, enqueue QA suites: summary faithfulness, coverage, and retrieval recall@k deltas
- log coverage deltas and drift metrics to dashboards

---

## Operational Controls

- backpressure: limit concurrent consolidation jobs per workspace
- priority: active entities > stable > cross‑workspace topics
- retries: exponential backoff; dead‑letter to review queue

---

## Indexing Policy

- index summaries in dedicated family `summaries` with the current `embeddingVersion`
- attach minimal metadata (entity/topic id, window, occurredAt range) to keep vector metadata <1 KB

---

## Notes

- Consolidation is additive and non‑destructive; evidence remains queryable.
- For strict compliance, mark summaries that include redacted content.
