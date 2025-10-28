# Neural Memory System Spec (Rollout)

Last Updated: 2025-10-28

Scope: Define reliable outcomes for Neural Memory (observations, summaries, profiles) and Graph signals; outline evaluation, versioning, and safe deployment. Applies to retrieval integration and ingestion.

---

## Reliable Outcomes (Definitions and Targets)

- Correctness
  - Observations: precision of extraction ≥90% on “high-signal” heuristics; provenance retained.
  - Summaries: coverage and factual consistency pass human checks; drift <5% across periods.
  - Relationships: deterministic edges precision ≥95%; LLM-assisted ≥85% after review.
- Explainability
  - Graph-influenced answers include a rationale (entities, edges, evidence) 100% of the time.
  - Evidence sufficiency score ≥0.9 on sampled answers.
- Stability
  - Result reproducibility: same query + same corpus → identical top‑k within ±1 position 99% of time.
  - Summaries age in; observations age out according to policy; profiles rebuilt on schedule.
- Latency
  - Retrieval P95 ≤150 ms (search/similar); ingestion SLAs documented.
- Safety and Privacy
  - Tenant isolation; PII redaction on writes; forget/export within 24h.
- Robustness
  - Fallbacks: degrade to knowledge-only when neural or graph signals are absent without >5% QA loss.

---

## Architecture Invariants (Non‑Negotiables)

- Non‑parametric by default: organizational truth lives in stores, not weights.
- Provenance everywhere: observations, summaries, and edges carry sources and evidence.
- Deterministic first: never overwrite deterministic edges with LLM inferences.
- Temporal semantics: since/until on edges; windows on summaries.
- Workspace isolation: RLS + namespaced indices; per‑user scopes for personal memory.
- Safe defaults: features behind flags; fallbacks always available.

---

## Versioning and Flags

- Versioning
  - Memory Spec version (M-SPEC), Graph Schema (G-SCHEMA), Router (RR); logged in responses.
- Feature Flags (workspace‑scoped)
  - relationships.deterministic, relationships.llm_assisted
  - neural.observations, neural.summaries, neural.profiles
  - retrieval.graph_bias, retrieval.graph_rationale, router.enable
  - conversation.memory, temporal.as_of
- Promotion policy: Research → Pilot → GA; acceptance criteria + rollback.

---

## Phased Rollout Plan

Phase 0 — Baseline
- Deliver: Knowledge + hybrid retrieval; logs + eval harness.
- Accept: baseline QA/latency recorded; no regressions.

Phase 1 — Relationships (Deterministic)
- Deliver: entities, aliases, document_entities, relationships, relationship_evidence.
- Accept: precision ≥95%; rationale surfacing wired; zero leakage.

Phase 2 — Neural Observations
- Deliver: observation extraction + embeddings + index; retrieval fusion.
- Accept: contribution share reasonable; no latency regressions; QA stable.

Phase 3 — Summaries & Profiles
- Deliver: clustering jobs; profiles per entity; drift monitors.
- Accept: improved recall/precision on overview/ownership; QA green.

Phase 4 — Relationships (LLM‑assisted)
- Deliver: proposals with confidence + evidence; adjudication queue.
- Accept: ≥85% precision post-review; deterministic unaffected.

Phase 5 — Router & Temporal Windows
- Deliver: router modes logged; time windows respected in traversal and scoring.
- Accept: temporal QA ≥90%; latency budgets met.

---

## Evaluation and Braintrust Protocol

- Suites
  - Smoke; Relationships; Graph QA; Observations; Summaries/Profiles; Router; Temporal.
- Triggers
  - On ingestion events; nightly regression; pre‑release canary.
- Metrics
  - QA: EM/F1; rationale faithfulness; evidence sufficiency.
  - Retrieval: recall@k, mAP, rerank gains; latency P50/P95.
  - Stability: churn, drift; profile rebuild health.
  - Safety: leakage rate; PII redaction success; access violations.
- Reporting
  - Dashboards segmented by retrieval_mode and RR version; experiment IDs persisted in retrieval logs.

---

## Data: Finding and Building Gold Sets

- OSS Organizations (LF-ORG-OSS-10)
  - 10 active repos with rich issues/PRs; build deterministic relationships (AUTHORED_BY, RESOLVES, OWNED_BY via CODEOWNERS).
  - Manually sample 500 edges for precision; derive 1k synthetic edges for recall stress.
- Belief Corpora (LF-BELIEF-AUTH)
  - Strategy docs/handbook pages (permissive licenses); curate mission/vision/principles/goals; inject conflicts and update timelines.
- Intent Corpora (LF-INTENT-SYN)
  - Derive objectives/initiatives from issue trackers; annotate owners, due dates; create lifecycle events.
- Graph QA (LF-GQA-1)
  - Templates for ownership/dependency/alignment/intention; generate per dataset; balance across types.
- Perturbations
  - Noise, contradictions, missing evidence; temporal drifts; sparsity and high-fanout graphs.

---

## Deployment and Migrations

- Migrations
  - Forward-only schema changes with PlanetScale via Drizzle migrations; pre‑create tables; dual‑read/dual‑write where needed; zero‑downtime backfills.
- Feature Flags
  - Per‑workspace toggles; gradual rollout by cohort; observability for enablement.
- Reindexing
  - Idempotent upserts; batched jobs with progress; backpressure controls; resume on failure.
- Rollback
  - Toggle flags off; preserve data; revert router version; documented runbooks.

Identity migrations
- Add `users`, `user_identities`, `workspace_users`, `workspace_person_map` as needed (see `docs/IDENTITY_DESIGN.md`).
- Extend `entity_aliases` to include provider IDs and SSO subjects.

---

## Observability and Guardrails

- Logs
  - Retrieval logs include RR version, graph_bias, seeds, edges considered, evidence IDs, contribution shares.
  - Ingestion logs for observation extraction, extractor decisions/confidence, adjudication outcomes.
- Alerts
  - Precision drops, churn spikes, leakage signals, latency regressions.
- Guardrails
  - Confidence gates; deterministic precedence; evidence required for writes; max hop limits; timeouts.

---

## API and Contracts (Sketch)

- Determinism and idempotency for upserts; evidence required on relationship writes.
- Router reports chosen path and rationale IDs; error codes distinguish fallback modes.
- Version headers: X-Memory-Spec, X-Router-Version for traceability.

---

## Definition of Done (Per Feature)

- Relationships (Deterministic)
  - Schema live; mappers implemented; precision ≥95%; dashboards green; runbook written; flags staged to Pilot.
- Relationships (LLM)
  - Gating live; adjudication queue; precision ≥85% on reviewed set; zero regression to deterministic; Pilot.
- Observations
  - Extraction quality ≥90% on sampled sets; embeddings live; contribution share tracked; Pilot.
- Summaries/Profiles
  - Clustering stable; profiles rebuilt; improved QA on overview/ownership; Pilot.
- Router and Conversation Memory
  - Correct routing; zero leakage; forget/export; GA only after two stable sprints.

---

## References

—
