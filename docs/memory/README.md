# Memory Overview

Last Updated: 2025-10-27

Purpose: Explain why Memory exists, what “reliable outcomes” look like, and how the Memory components (Graph Memory and Retrieval Router) integrate and evolve in research mode.

---

## Why Memory

- Make organizational intent computable and explainable: connect beliefs (mission/vision/goals) and intents (objectives/initiatives/commitments) to people, work, and artifacts.
- Answer multi‑hop “who/why/depends” questions with evidence — not just similar text.
- Provide durable, auditable state with provenance, temporal semantics, and per‑tenant privacy.

---

## Reliable Outcomes (at a glance)

- Correctness: deterministic edges ≥95% precision; LLM‑assisted ≥85% (review 60–79% conf); belief extraction ≥90%; intent type/owner/status ≥90% on deterministic.
- Explainability: every graph‑influenced answer includes a short “graph rationale” citing entities, edges, and evidence.
- Stability: belief churn <5%/week; as‑of queries respect since/until and intent events; reproducible results.
- Latency: hybrid+graph retrieval P50 ≤300ms, P95 ≤800ms; graceful fallback to hybrid if graph is unavailable.
- Safety: zero cross‑tenant leakage; conversation memory never leaks into org answers without explicit sharing; forget/export.

Details and thresholds live in `spec.md`.

---

## Components

- Graph Memory (graph.md)
  - Entities: people, teams, repos, services, projects, customers, goals, etc.
  - Relationships: typed edges (OWNED_BY, DEPENDS_ON, RESOLVES, ALIGNS_WITH_GOAL, etc.) with confidence, since/until, and evidence.
  - Beliefs: mission/vision/principles/goals with consolidation, revisions, and stability windows.
  - Intents: objectives/initiatives/commitments with lifecycle events and ownership.

- Retrieval Router (RR)
  - Classifies queries into organizational (graph‑first), knowledge (RAG), or personal (conversation memory) scopes.
  - Routes to graph traversal + hybrid retrieval or knowledge‑only as needed; enforces rationale output.
  - Versioned (RR SemVer) and logged per request for eval segmentation.

---

## Research Mode and Rollout

- Feature flags per workspace: relationships.deterministic, relationships.llm_assisted, beliefs.core, intents.core, retrieval.graph_bias, retrieval.graph_rationale, router.enable, temporal.as_of, conversation.memory.
- Phased plan: Relationships (det) → Graph rationale/QA → Relationships (LLM) → Beliefs → Intents → Router/Personal → Temporal.
- Eval: Braintrust suites per phase (relations, Graph QA, beliefs, intents, router, temporal) with promotion gates.

See `spec.md` for versioning (M‑SPEC, G‑SCHEMA, RR), acceptance criteria, and rollback.

---

## Contents

- Graph Design: `docs/memory/GRAPH.md`
- Spec (Research Mode): `docs/memory/SPEC.md`
- Research — Belief & Intent: `docs/memory/RESEARCH_BELIEF_INTENT.md`
- RAG Best Practices (retrieval/embeddings/rerank): `docs/rag-best-practices/`

---

## Reading Order

1) `SPEC.md` — reliable outcomes, phased rollout, eval protocol, versioning/flags
2) `GRAPH.md` — entities, relationships, beliefs, traversal, temporal semantics
3) `RESEARCH_BELIEF_INTENT.md` — survey and design implications for beliefs/intents
4) `../SEARCH_DESIGN.md` — retrieval/routing and graph rationale
5) `../SYNC_DESIGN.md` — ingestion and relationship detection
6) `../EVALUATION_PLAYBOOK.md` — suites/metrics and Braintrust flows
