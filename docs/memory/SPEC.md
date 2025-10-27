# MEMORY System Spec (Research Mode + Incremental Rollout)

Last Updated: 2025-10-27

Scope: Define reliable outcomes for Memory and a research-mode pathway to introduce Relationships, Beliefs, and Intents incrementally with evaluation, versioning, and safe deployment. Applies to the Memory Graph, retrieval integration, and adjacent ingestion.

---

## Reliable Outcomes (Definitions and Targets)

- Correctness
  - Relationships: deterministic edges precision ≥95%, LLM-assisted precision ≥85% (review queue for 60–79% confidence), recall tracked against gold sets.
  - Beliefs: extraction precision ≥90% on authoritative sources; belief supersession correctness ≥95% on curated conflicts.
  - Intents: type/owner/status accuracy ≥90% on deterministic seeds; inferred links precision ≥85%.
- Explainability
  - Every graph-influenced answer includes a “graph rationale” with entities, edges, and evidence (document/chunk) 100% of the time.
  - Evidence sufficiency score ≥0.9 (human-rated) on sampled answers.
- Stability
  - Belief churn <5% per week unless source changes; intent status drift alerts within 24h of upstream changes.
  - Result reproducibility: same query + same corpus → identical top‑k within ±1 position 99% of time.
- Latency
  - Retrieval P50 ≤300ms, P95 ≤800ms for hybrid+graph; ingestion SLAs documented per source.
- Safety and Privacy
  - Zero cross‑tenant leakage; conversation memories never surface in org answers without explicit sharing.
  - PII redaction on memory write paths; “forget/export” honored within SLA (e.g., 24h).
- Robustness
  - Fallbacks: if graph is unavailable or sparse, degrade to hybrid retrieval with minimal quality loss (<5% on QA metrics).
  - Conflict handling: AGM‑style revision preserves audit trail; no silent overwrites of deterministic facts.

---

## Architecture Invariants (Non‑Negotiables)

- Non‑parametric by default: organizational truth lives in stores, not weights.
- Provenance everywhere: edges, beliefs, intents carry sources, evidence, and confidence.
- Deterministic first: never overwrite deterministic edges with LLM inferences; only add or raise confidence.
- Temporal semantics: since/until on edges; belief revisions and intent events enable as‑of queries.
- Workspace isolation: RLS and namespaced indices; per‑user scopes for conversation memory.
- Safe defaults: features ship behind flags; fallbacks always available.

---

## Versioning and Flags

- Versioning
  - Memory Spec version: M-SPEC SemVer, documents capabilities and thresholds.
  - Graph Schema version: G-SCHEMA SemVer, tracked via migrations.
  - Retrieval Router version: RR SemVer, logged with responses.
- Feature Flags (workspace‑scoped)
  - relationships.deterministic
  - relationships.llm_assisted
  - beliefs.core
  - intents.core
  - retrieval.graph_bias
  - retrieval.graph_rationale
  - router.enable
  - conversation.memory
  - temporal.as_of
- Promotion policy
  - Research → Pilot → GA per feature, with acceptance criteria and rollback plans.

---

## Phased Rollout Plan (Incremental Introduction)

Phase 0 — Baseline (M-SPEC 0.1)
- Deliver: Knowledge Store + hybrid retrieval; retrieval logs + basic eval harness.
- Accept: baseline QA and latency recorded; no regressions in existing flows.

Phase 1 — Relationships (Deterministic) (M-SPEC 0.2, G-SCHEMA 1.0)
- Deliver: entities, entity_aliases, document_entities, relationships, relationship_evidence; connector mappers (GitHub/Linear/Notion deterministic).
- Retrieval: optional graph_bias off by default; enable rationale surfacing for inspection.
- Accept: precision ≥95% on deterministic edge gold sets; zero leakage; latency P95 ≤850ms with graph_bias off.

Phase 1.1 — Graph Rationale + Graph QA (RR 1.0)
- Deliver: graph-aware answer composition and QA suites (ownership/dependency/alignment).
- Accept: rationale present 100%; Graph QA accuracy ≥ baseline; no latency regressions >5%.

Phase 2 — Relationships (LLM‑assisted) (M-SPEC 0.3)
- Deliver: extractors with confidence gating; adjudication queue and feedback logging.
- Accept: assisted precision ≥85% on reviewed sets; no deterministic regressions; review queue SLAs.

Phase 3 — Beliefs (Core) (G-SCHEMA 1.1)
- Deliver: beliefs, belief_links, belief_revisions; consolidation rules (corroboration ≥2 sources, stability window ≥14 days).
- Retrieval: alignment questions route to beliefs; rationale includes belief evidence.
- Accept: belief extraction precision ≥90%; weekly churn <5%; conflicting updates resolved with audit trail.

Phase 4 — Intents (Core) (G-SCHEMA 1.2)
- Deliver: intents, intent_links, intent_events; deterministic seeds from OKR/Jira/GitHub; LLM proposals gated.
- Retrieval: ownership/alignment enhanced via intent edges; status queries supported.
- Accept: type/owner/status ≥90% on deterministic; inferred links ≥85% precision; as‑of intent status works.

Phase 5 — Router + Personal Memory (RR 1.1)
- Deliver: memory router; conversation memory (optional module) with TTL, consent, export/forget.
- Accept: zero leakage to org answers; preference recall accuracy ≥95% on personal tasks; QA unaffected in org tasks.

Phase 6 — Temporal Reasoning (RR 1.2)
- Deliver: as‑of queries honoring since/until and intent events; time-sliced traversal.
- Accept: temporal QA ≥90% accuracy on curated benchmarks; latency within budget.

---

## Evaluation and Braintrust Protocol

- Suites (by layer)
  - Smoke: ingestion and retrieval health; index coverage.
  - Relationships: precision/recall per type; edge-level evidence checks.
  - Graph QA: ownership, dependency, alignment with rationale faithfulness.
  - Beliefs: extraction accuracy, supersession correctness, stability.
  - Intents: type/owner/status accuracy; lifecycle event reflection latency.
  - Router: correct routing decisions; no leakage between scopes.
  - Temporal: as‑of accuracy; regression on non‑temporal queries.
- Triggers
  - On ingestion events; nightly regression; pre‑release canary.
- Metrics
  - QA: EM/F1; rationale faithfulness; human evidence sufficiency.
  - Retrieval: recall@k, mAP, reranker gains; latency P50/P95.
  - Stability: churn, drift alerts; revision audit completeness.
  - Safety: leakage rate, PII redaction success, access violations.
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
- Add `users`, `user_identities`, `workspace_users`, and `workspace_person_map` as described in `docs/IDENTITY_DESIGN.md`.
- Extend `entity_aliases` alias_type coverage to include provider IDs and SSO subjects; enforce uniqueness (workspace_id, alias_type, value).

---

## Observability and Guardrails

- Logs
  - Retrieval logs include RR version, graph_bias on/off, seeds, edges considered, evidence IDs.
  - Ingestion logs for extractor decisions and confidence; adjudication outcomes.
- Alerts
  - Precision drops, churn spikes, leakage signals, latency regressions.
- Guardrails
  - Confidence gates; deterministic precedence; evidence required for writes; max hop limits; timeouts.

---

## API and Contracts (Sketch)

- Determinism and idempotency for upserts; evidence required on relationship/belief/intent writes.
- Router reports chosen path and rationale IDs; error codes distinguish fallback modes.
- Version headers: X-Memory-Spec, X-Router-Version for traceability.

---

## Definition of Done (Per Feature)

- Relationships (Deterministic)
  - Schema live; mappers implemented; precision ≥95%; dashboards green; runbook written; flags staged to Pilot.
- Relationships (LLM)
  - Gating live; adjudication queue; precision ≥85% on reviewed set; zero regression to deterministic; Pilot.
- Beliefs
  - Consolidation rules; revisions logged; stability <5% churn; QA green; Pilot.
- Intents
  - Lifecycle events; status queries; accuracy thresholds met; as‑of works; Pilot.
- Router and Conversation Memory
  - Correct routing; zero leakage; forget/export; GA only after two stable sprints.

---

## References

- See docs/memory/RESEARCH_BELIEF_INTENT.md for literature survey and comparative analysis.
