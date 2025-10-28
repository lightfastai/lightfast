# Neural Memory Overview

Last Updated: 2025-10-28

Purpose: Explain what Neural Memory is, how it complements Knowledge (chunks) and Graph, and how it drives retrieval and answers.

---

## Why Neural Memory

- Go beyond keyword or chunk similarity with observations and summaries that capture meaning and recency.
- Retain explainability via explicit entities/relationships and evidence citations.
- Enable fast, trustworthy answers powered by fused signals.

---

## Components

- Observations: atomic, high-signal “moments” (decisions, incident lines, PR highlights, Q/A) with multi-view embeddings and provenance.
- Summaries: clustered rollups by entity/topic/time; compress older observations and provide orientation.
- Profiles: per-entity centroids/descriptors; bias search toward relevant entities and personalize safely.
- Graph: explicit entities/edges for explainability and bounded 1–2 hop bias.

Beliefs/intent are expressed within summaries — not as a privileged type.

---

## Reliable Outcomes (at a glance)

- Quality: recall@k and snippet accuracy meet targets; rationale faithfulness ≥95%.
- Latency: p95 <150 ms for search/similar; contents hydration <120 ms.
- Safety: tenant isolation; PII redaction on writes; opt-in personal memory.

---

## Reading Order

1) `SPEC.md` — Neural memory spec and rollout
2) `GRAPH.md` — Graph rationale and bounded traversal
3) `../SEARCH_DESIGN.md` — retrieval and fusion
4) `../SYNC_DESIGN.md` — ingestion and consolidation
5) `../EVALUATION_PLAYBOOK.md` — suites/metrics and calibration
