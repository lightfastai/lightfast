---
title: Evaluation Playbook (Neural Memory)
description: How we evaluate retrieval and answer quality, and calibrate thresholds
status: working
owner: platform-ops
audience: engineering
last_updated: 2025-10-28
tags: [evaluation, ops]
---

# Evaluation Playbook (Neural Memory)

Last Updated: 2025-10-28

This playbook describes how we evaluate retrieval and response quality across Knowledge (chunks) and Neural Memory (observations/summaries), with graph influence tracked explicitly. We use Braintrust for suites and dashboards.

Retrieval logs segment by `routerMode: 'knowledge' | 'neural' | 'hybrid'` and include graph influence flags.

---

## Goals

1. Maintain recall/precision targets while data/models evolve.
2. Detect regressions quickly with clear triage and playbooks.
3. Calibrate weights per workspace (fusion, rerank thresholds) using feedback.

---

## Suite Types

| Suite | Trigger | Purpose | Sample Size | Latency Target |
|-------|---------|---------|-------------|----------------|
| Smoke | Manual / CI | Validate pipeline after deploys | 5–10 queries per source | <5 min total |
| Regression | post-ingest (knowledge.persisted) | Catch retrieval drift per workspace | 25 canonical queries | <10 min/workspace |
| Weekly Benchmark | Cron | Track long-term trends | 100 mixed queries | <60 min |
| Source-specific | Manual / schedule | Deep dive per source | 15 per source | <10 min |
| Graph QA (Ownership/Deps/Alignment) | Weekly / on change | Validate graph bias & rationale | 20 graph queries | <10 min |
| Rerank Calibration | Quarterly or on changes | Recompute relevance thresholds | 30 borderline pairs | <30 min |

All suites run against the production retrieval API to ensure realistic telemetry. Regression suites can be scoped to a workspace to respect data isolation.

---

## Test Construction

### Canonical Queries
- Collect representative questions per workspace; strip PII.
- Store in `braintrust_queries` with source, difficulty, expected evidence.

### Borderline Examples
- Sample borderline query/evidence pairs for rerank calibration.
- Keep 30–50 pairs per workspace; refresh quarterly or on domain shifts.

### Answer Keys
- Annotate expected evidence (chunkIds/observationIds) and acceptable alternatives.
- Flag missing evidence, wrong snippets, or hallucinations.

---

## Metrics & Thresholds

| Metric | Definition | Target | Alert |
|--------|------------|--------|-------|
| recall@5 | % of suites where canonical evidence in top 5 | ≥95% | <92% |
| recall@10 | % in top 10 | ≥98% | <96% |
| rerank score | Mean score for borderline pairs | workspace-calibrated | −0.05 vs. baseline |
| latency split | p95 for dense/rerank/hydration | ≤150 ms total | >170 ms |
| snippet accuracy | % highlighting correct span | ≥90% | <85% |
| rationale faithfulness | % where rationale matches evidence | ≥95% | <92% |
| contribution shares | % results by chunks vs observations | tracked | drift alert on spikes |

Segment all metrics by `retrieval_mode` to spot regressions that affect only graph-biased or graph-first queries.

Threshold breaches trigger PagerDuty via Grafana alerts (metrics sourced from `feedback_events` and `retrieval_logs`). Braintrust webhooks also push a summary message to `#lightfast-alerts` with suite name, failing cases, and links.

---

## Calibration Workflow

1. **Collect pairs:** Pull 30–50 borderline query/document pairs from Braintrust feedback or manual review.
2. **Score:** Run cross-encoder rerank offline and store scores in `rerank_thresholds`.
3. **Compute threshold:** Average scores; set `threshold = mean - 1σ` to provide buffer against noise.
4. **Deploy:** Update configuration (`rerank.threshold`) per workspace. Include threshold in `retrieval_logs` for audit.
5. **Verify:** Run the suite; ensure low-score results are filtered and recall ≥95%.

Repeat this workflow whenever:
- Rerank model or parameters change.
- New domain content is added (e.g., major product launches).
- Weekly benchmarks show sustained drop in recall or precision.

---

## Alert Triage & Incident Response

1. **Triage:** On alert, review Braintrust dashboard and failing cases. Classify the regression:
   - Embedding drift (missing content, low similarity)
   - Rerank threshold too aggressive
   - Pipeline bug (missing observations/chunks, bad metadata)
   - Infrastructure (Pinecone latency, Redis miss)

2. **Mitigation Playbooks:**
   - **Embedding drift:** Trigger re-embed job (via Cohere Embed Jobs) for affected workspaces; validate metrics post-refresh.
   - **Threshold issue:** Recompute borderline scores and adjust threshold; rerun regression suite.
   - **Pipeline bug:** Roll back recent changes or hotfix; rerun smoke suite.
   - **Infra:** Follow incident runbooks (Pinecone backup namespace, Redis failover, etc.).

3. **Resolution:** Post summary with root cause, fix, and follow-ups. Update this playbook if a new failure mode appears.

---

## Adding a New Suite

1. Gather queries + expected outputs; review with product/solutions teams.
2. Create suite in Braintrust (`braintrust suites create …`), linking to the retrieval API endpoint.
3. Add suite metadata to `braintrust_suites.yaml` (workspace, triggers, owners).
4. Update Grafana dashboard and PagerDuty routing if thresholds differ.
5. Run smoke tests locally; confirm results before enabling automation.

---

## References

- ../../architecture/storage/architecture.md
- ../../architecture/retrieval/search-design.md
- ../../architecture/ingestion/sync-design.md
- Braintrust docs
- Cohere rerank best practices: ../../research/rag-best-practices/COHERE_BEST_PRACTICES.md

---

Owners: Infra + ML Platform  
Point of Contact: @storage-ops  
Review Cadence: Quarterly or after major retrieval changes
