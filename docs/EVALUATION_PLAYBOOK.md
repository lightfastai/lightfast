# Evaluation Playbook (Braintrust)

**Last Updated:** 2025-02-10

This playbook documents how Lightfast uses Braintrust to evaluate retrieval and response quality. It complements the storage and search design docs, providing the operational details for suites, metrics, calibration, and incident handling.

Terminology: evaluate both Knowledge (chunked retrieval) and Memory (graph) modes. Retrieval logs include `retrieval_mode: 'knowledge' | 'graph' | 'hybrid'` to segment metrics.

---

## Goals

1. Guarantee recall and precision stay within targets as data and models evolve.
2. Detect regressions quickly, with clear alerting and triage paths.
3. Provide engineers with a repeatable workflow for adding new suites, updating thresholds, and interpreting results.

---

## Suite Types

| Suite | Trigger | Purpose | Sample Size | Latency Target |
|-------|---------|---------|-------------|----------------|
| **Smoke** | Manual / CI | Validate pipeline after deploys | 5–10 queries per source | <5 min total |
| **Regression** | `knowledge.persisted` event (post-ingest) | Catch retrieval drift per workspace | 25 canonical queries | <10 min per workspace |
| **Weekly Benchmark** | Cron (Sunday 02:00 UTC) | Track long-term trends | 100 mixed queries | <60 min |
| **Source-specific** | Manual / schedule | Deep dive for GitHub, Slack, Notion, Linear | 15 per source | <10 min |
| **Graph QA (Ownership/Deps/Alignment)** | Weekly / on change | Validate Memory Graph answers | 20 graph queries | <10 min |
| **Rerank Calibration** | Quarterly or on rerank model changes | Recompute Cohere relevance threshold | 30 borderline pairs | <30 min |

All suites run against the production retrieval API to ensure realistic telemetry. Regression suites can be scoped to a workspace to respect data isolation.

---

## Test Construction

### Canonical Queries
- Collect user-facing questions per workspace (support requests, search analytics, Braintrust feedback).
- Normalize to remove PII and anonymize thread IDs.
- Store in `braintrust_queries` table with metadata: source, difficulty, expected snippets.

### Borderline Examples
- For each rerank calibration run, sample queries where human reviewers marked a result as “barely relevant.”
- Capture the borderline document’s chunk text (via PlanetScale) so we can compute Cohere scores offline.
- Keep 30–50 pairs per workspace; refresh every quarter or when domain shifts (new product area).

### Answer Keys
- For regression and benchmark suites, annotate expected top results (memory IDs) and acceptable alternatives.
- Use the Braintrust comparison feature to flag missing results, wrong snippets, or hallucinated content.

---

## Metrics & Thresholds

| Metric | Definition | Target | Alert Threshold |
|--------|------------|--------|-----------------|
| `recall@5` | % of suites where canonical answer appears in top 5 | ≥95% | <92% (page) |
| `recall@10` | % top 10 coverage | ≥98% | <96% |
| Rerank relevance score | Mean Cohere score for borderline docs | Workspace-specific | −0.05 drop vs. baseline |
| Latency split | p95 for dense, rerank, hydration | ≤150 ms total | >170 ms |
| Snippet accuracy | % highlighting correct span | ≥90% | <85% |

Segment all metrics by `retrieval_mode` to spot regressions that affect only graph-biased or graph-first queries.

Threshold breaches trigger PagerDuty via Grafana alerts (metrics sourced from `feedback_events` and `retrieval_logs`). Braintrust webhooks also push a summary message to `#lightfast-alerts` with suite name, failing cases, and links.

---

## Calibration Workflow

1. **Collect pairs:** Pull 30–50 borderline query/document pairs from Braintrust feedback or manual review.
2. **Score:** Run Cohere Rerank (`rerank-v3.5`) offline and store scores in `rerank_thresholds` table.
3. **Compute threshold:** Average scores; set `threshold = mean - 1σ` to provide buffer against noise.
4. **Deploy:** Update configuration (`rerank.threshold`) per workspace. Include threshold in `retrieval_logs` for audit.
5. **Verify:** Run the rerank calibration suite; ensure low-score results are filtered and recall remains above 95%.

Repeat this workflow whenever:
- Rerank model or parameters change.
- New domain content is added (e.g., major product launches).
- Weekly benchmarks show sustained drop in recall or precision.

---

## Alert Triage & Incident Response

1. **Triage:** On alert, review Braintrust dashboard and failing cases. Classify the regression:
   - Embedding drift (new content missing, low similarity).
   - Rerank threshold too aggressive (many borderline items filtered).
   - Pipeline bug (chunks missing, metadata wrong).
   - Infrastructure (Pinecone latency, Redis miss).

2. **Mitigation Playbooks:**
   - **Embedding drift:** Trigger re-embed job (via Cohere Embed Jobs) for affected workspaces; validate metrics post-refresh.
   - **Threshold issue:** Recompute borderline scores and adjust threshold; rerun regression suite.
   - **Pipeline bug:** Roll back recent changes or hotfix; rerun smoke suite.
   - **Infra:** Follow incident runbooks (Pinecone backup namespace, Redis failover, etc.).

3. **Resolution:** Post summary in `#lightfast-alerts` with root cause, fix, and follow-up tasks. Update this playbook if new failure mode discovered.

---

## Adding a New Suite

1. Gather queries + expected outputs; review with product/solutions teams.
2. Create suite in Braintrust (`braintrust suites create …`), linking to the retrieval API endpoint.
3. Add suite metadata to `braintrust_suites.yaml` (workspace, triggers, owners).
4. Update Grafana dashboard and PagerDuty routing if thresholds differ.
5. Run smoke tests locally (`pnpm braintrust run <suite>`). Confirm results in dashboard before enabling automation.

---

## References

- `docs/STORAGE_ARCHITECTURE.md` (Observability section)
- `docs/SEARCH_DESIGN.md` (Rerank calibration notes)
- `docs/SYNC_DESIGN.md` (Braintrust hooks in pipeline)
- Braintrust documentation: https://www.braintrustdata.com/docs
- Cohere rerank best practices: `docs/rag-best-practices/COHERE_BEST_PRACTICES.md`

---

_Owners:_ Infra + ML Platform team  
_Point of Contact:_ @storage-ops  
_Review Cadence:_ Quarterly or after major retrieval changes
