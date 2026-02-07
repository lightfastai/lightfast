---
date: 2026-02-07
researcher: architect-agent
topic: "AI eval pipeline continuation + paper topic identification — architecture synthesis"
tags: [research, architecture, ai-evaluation, paper-proposals, publication-strategy]
status: revised
revision: 2
revision_notes: >
  Revised per senior review (eval-paper-review.md) and new research inputs.
  Changes: (1) Rewrote Part B paper topics using external research novelty rankings,
  (2) Added ablation study support to eval pipeline with AblationConfig interface,
  (3) Added ingestion timing specification with three-phase wait,
  (4) Added null query metric handling with null-aware definitions,
  (5) Updated Part C paper outlines for new top 2 topics,
  (6) Updated Part D research methodology for new experiments.
based_on:
  - 2026-02-07-eval-paper-codebase-deep-dive.md    # NEW: deeper novelty analysis
  - 2026-02-07-eval-paper-external-research.md      # NEW: 87-source literature comparison
  - 2026-02-07-eval-paper-review.md                 # Senior review with 5 issues
  - 2026-02-07-ai-eval-pipeline-architecture-design.md
  - 2026-02-07-ai-eval-pipeline-codebase-deep-dive.md
  - 2026-02-07-ai-eval-pipeline-external-research.md
  - 2026-02-05-search-api-evaluation-pipeline-golden-dataset-design.md
---

# Architecture + Paper Strategy: Eval Pipeline and First Paper (Revision 2)

## Executive Summary

Lightfast has a production-grade AI pipeline — 4-path parallel search (vector + entity + cluster + actor), 3-tier reranking (passthrough/Cohere/LLM), multi-view embeddings (3 views x Cohere embed-english-v3.0), and a multi-tool answer agent (Claude Sonnet 4.5, 5 tools, 8 max steps) — but **zero evaluation infrastructure**. A comprehensive architecture design already exists (see `2026-02-07-ai-eval-pipeline-architecture-design.md`) with a 5-phase plan from dataset bootstrap through production feedback loops.

This document synthesizes all research — including new codebase deep dives with novelty assessments, external literature comparison against 87 sources, and senior review feedback — into two deliverables:

**Part A — Eval Pipeline Implementation Priorities**: Concrete next steps for implementing the evaluation pipeline, ordered by impact and dependency. Now includes: ablation study support (AblationConfig interface with 14 presets), ingestion timing specification (three-phase wait with polling/timeout/partial-failure), and null query metric handling. The critical path is: (1) create `packages/console-eval/` with metrics library, (2) bootstrap golden dataset v1, (3) run first Braintrust experiment, (4) add answer quality evaluation, (5) CI/CD integration.

**Part B — Paper Topic Proposals**: Five candidate research paper topics ranked by literature-validated novelty. The strongest candidates are:
1. **Cross-Source Developer Identity Resolution for Engineering RAG** (Very High novelty — zero academic precedent)
2. **EngRAG-Bench: First Evaluation Benchmark for Engineering-Domain RAG** (Very High novelty — no existing benchmarks)
3. **Webhook-Driven Real-Time Software Engineering Knowledge Graphs** (High novelty — existing work is batch-only)

**Recommended first paper**: "Engineering-Domain RAG with Cross-Source Knowledge Graphs" — a systems paper combining topics 1 + 3, targeting arXiv preprint first, then SIGIR SIRIP / EMNLP Industry Track.

---

## Part A: Eval Pipeline Implementation Priorities

### Immediate Next Steps (Week 1)

**Goal**: First eval run with baseline metrics in Braintrust.

#### Step 1: Create `packages/console-eval/` Package (Day 1-2)
- **What**: Scaffold the package structure following the detailed plan in `thoughts/shared/plans/2026-02-05-search-api-evaluation-pipeline.md`
- **Key files**:
  - `package.json` — `@repo/console-eval` with `workspace:*` deps on `@repo/console-types`, `@repo/console-test-data`, `@vendor/observability`; `catalog:` deps on `braintrust`, `zod`
  - `src/config/env.ts` — t3-env config for `BRAINTRUST_API_KEY`, `EVAL_WORKSPACE_ID`, `EVAL_API_KEY`, `CONSOLE_API_URL`
  - `src/config/ablation.ts` — AblationConfig interface and presets (see Section A.1 below)
  - `src/metrics/retrieval.ts` — Pure TypeScript MRR, Recall@K, Precision@K, NDCG@K with null-query-aware handling (see Section A.3)
  - `src/metrics/statistics.ts` — Paired bootstrap test, Cohen's d, confidence intervals
  - `src/e2e/search-client.ts` — HTTP client calling `/v1/search` with Bearer token auth + `X-Eval-Ablation` header support
  - `src/e2e/ingestion.ts` — Three-phase ingestion wait utility (see Section A.2)
  - `src/scorers/retrieval-scorers.ts` — Braintrust-compatible scorer wrappers
- **Dependencies**: None — this is foundational
- **Risk**: Low. All code is new, no production impact.
- **Effort**: 1-2 days for a developer familiar with the monorepo patterns

#### Step 2: Bootstrap Golden Dataset v1 (Day 2-4)
- **What**: Create 50 evaluation cases from 3 sources:
  1. **Existing query scenarios** (10-15 cases): Convert `docs/examples/query-scenarios/query_scenarios.json` (20 scenarios with intents and expected signals) into eval format
  2. **LLM-generated from corpus** (25-30 cases): Use Claude Haiku to generate diverse queries from `packages/console-test-data/datasets/comprehensive.json` (35 webhooks), filtered by a Claude Sonnet critic (keep quality >= 3/5)
  3. **Manual curation** (5-10 cases): Hand-craft edge cases — null queries, ambiguous queries, cross-source queries, time-boundary queries
- **Output**: `packages/console-eval/src/datasets/golden-v1.json` committed to git
- **Critical prerequisite**: Inject `comprehensive.json` into a dedicated eval workspace and build `sourceId -> externalId` mapping (the `waitForIngestion()` utility handles this — see Section A.2)
- **Dataset annotation requirements**: Each case must include `expectedToBeFiltered: boolean` for significance gate accounting, and null query cases must have `relevantIds: []`
- **Risk**: Medium. Quality of synthetic queries depends on LLM generation quality and corpus coverage. Mitigated by critic filtering and human review.
- **Effort**: 2-3 days including human review

#### Step 3: First Braintrust Experiment (Day 4-5)
- **What**: Run the e2e retrieval eval against the local dev server
  1. Load golden-v1.json
  2. Execute queries against `/v1/search` API (all 3 modes: fast, balanced, thorough)
  3. Calculate Tier 1 metrics: MRR, Recall@5, Recall@10, Precision@5, Precision@10, NDCG@5, NDCG@10
  4. Calculate null query metrics: NullQueryAccuracy, AvgFalsePositives (see Section A.3)
  5. Log to Braintrust experiment with tags: branch, commit SHA, dataset version, search mode
- **Output**: Baseline metrics documented. Per-query-type breakdown identifying weakest areas.
- **Dependencies**: Steps 1 + 2 complete; local dev server running (`pnpm dev:app`)
- **Risk**: Low-medium. May reveal issues with eval workspace setup or API key auth.
- **Effort**: 1 day

### Short-Term (Weeks 2-3)

#### Step 4: Answer Quality Evaluation — Tier 2 Metrics (Week 2)
- **What**: Implement LLM-as-judge scorers for answer quality
  - `src/metrics/rag-quality.ts` — Faithfulness (claim decomposition + entailment), Citation Precision, Citation Recall, Answer Relevancy, Hallucination Rate
  - `src/scorers/rag-scorers.ts` — Braintrust-compatible wrappers using Claude Haiku ($0.001/eval case) for CI, Claude Sonnet ($0.01/eval case) for nightly
- **Why now**: Answer quality is Lightfast's core differentiator (citations, multi-tool reasoning). Without measuring it, we can't improve it.
- **Dependencies**: Step 3 complete (retrieval baseline established)
- **Risk**: Medium. LLM-as-judge has inherent variance. Mitigated by structured prompts and aggregate scoring.
- **Effort**: 3-4 days

#### Step 5: Custom Lightfast Metrics (Week 2-3)
- **What**: Implement domain-specific scorers
  - `TemporalAccuracy` — For time-based queries, are results from the correct time window?
  - `ActorAttribution` — For actor queries, do results relate to the specified person?
  - `PathContribution` — Which of the 4 search paths contributed to successful retrievals? (Requires logging which paths contributed, tracked via `response.meta.paths`)
  - `CrossSourceCoverage` — For multi-source queries, do results span the expected source types?
- **Why**: These metrics are unique to Lightfast's architecture and directly support paper claims about multi-path search and cross-source identity effectiveness.
- **Dependencies**: Step 3 complete; requires search API to return path metadata (already present in `V1SearchResponse.meta.paths`)
- **Effort**: 2-3 days

#### Step 6: Expand Dataset to 100+ Cases (Week 3)
- **What**: Generate 50 additional cases targeting underrepresented query types
  - Focus on multi-hop queries (complex reasoning across sources)
  - Add cross-source correlation queries (GitHub push + Sentry error)
  - Include more temporal edge cases ("this week" vs "last month")
  - Add identity resolution test cases (same developer across GitHub/Vercel/Linear)
- **Why**: 50 cases provide basic coverage; 100+ enables per-query-type statistical significance (30+ per type for paired bootstrap tests with power >= 0.8)
- **Dependencies**: Step 2 complete; feedback from Step 3 baseline about which query types are weakest
- **Effort**: 2 days (generation + critic filtering + human review)

### Medium-Term (Month 2)

#### Step 7: Ablation Sweep Infrastructure (Week 4)
- **What**: Implement the full ablation framework (see Section A.1) so that paper experiments can run
  - Add `EVAL_MODE` environment variable to search API
  - Parse `X-Eval-Ablation` header in `searchLogic()` to conditionally skip paths/views/reranking
  - Implement `ablation-sweep.ts` runner that executes all preset configurations as separate Braintrust experiments
  - Tag experiments with `ablation={preset_name}` for comparison
- **Why**: Ablation studies are essential for any systems paper. Without this, we cannot demonstrate per-component contribution.
- **Dependencies**: Steps 1-3 complete; stable baseline established
- **Effort**: 3-4 days

#### Step 8: CI/CD Quality Gates (Week 5-6)
- **What**: GitHub Actions workflow triggered on PRs touching `neural/**`, `console-rerank/**`, `console-eval/**`, `console-ai/**`
  - Run Tier 1 retrieval metrics only (zero LLM cost) on 30-case subset
  - Post results as PR comment with metric deltas
  - Start as informational-only (no blocking)
- **Dependencies**: Steps 1-3 complete; stable baseline established
- **Cost**: ~$0 per CI run (Tier 1 metrics are pure math)
- **Note**: Adding a new CI workflow for the console ecosystem is a prerequisite — the existing CI only covers `core/lightfast` and `core/mcp`. This deserves its own setup task.
- **Effort**: 2-3 days

#### Step 9: Statistical Regression Detection (Week 6-7)
- **What**: Implement comparison engine
  - Paired bootstrap test (10,000 resamples) for significance
  - Cohen's d for effect size
  - Configurable regression thresholds per metric (start at -5% for retrieval, -3% for RAG quality)
  - Experiment comparison CLI: `pnpm eval:compare --baseline=main --candidate=$(git rev-parse HEAD)`
- **Dependencies**: Step 8 complete; multiple baseline experiments in Braintrust for calibration
- **Effort**: 2-3 days

#### Step 10: User Feedback Collection (Week 7+)
- **What**: Binary thumbs up/down on answer responses
  - tRPC procedure in userRouter
  - New `workspaceAnswerFeedback` Drizzle schema
  - UI component in answer interface
- **Why**: Closes the production -> eval feedback loop. Negatively-rated answers become eval cases.
- **Dependencies**: Independent of eval pipeline, but feeds dataset evolution
- **Effort**: 3-4 days

---

### Section A.1: Ablation Study Support

The eval pipeline must support ablation studies from the start — the interfaces need to accommodate component-level toggling even if full implementation is deferred.

#### Ablation Configuration Interface

```typescript
// packages/console-eval/src/config/ablation.ts

export interface AblationConfig {
  /** Which search paths to enable (default: all enabled) */
  searchPaths: {
    vector: boolean;   // Path 1: Pinecone dense vector search
    entity: boolean;   // Path 2: Entity pattern matching in DB
    cluster: boolean;  // Path 3: Cluster centroid search in Pinecone
    actor: boolean;    // Path 4: Actor profile search in DB
  };

  /** Which embedding views to use for vector search (default: all enabled) */
  embeddingViews: {
    title: boolean;    // obs_title_* vectors
    content: boolean;  // obs_content_* vectors
    summary: boolean;  // obs_summary_* vectors
  };

  /** View aggregation strategy (default: max) */
  viewAggregation: "max" | "mean" | "weighted";
  viewWeights?: { title: number; content: number; summary: number }; // for "weighted"

  /** Reranking tier (default: from search mode) */
  rerankMode: "fast" | "balanced" | "thorough" | "none";

  /** Entity confirmation boost (default: 0.2, set to 0 to disable) */
  entityConfirmationBoost: number;

  /** Significance scoring threshold override (default: 40) */
  significanceThreshold?: number;
}

export const DEFAULT_ABLATION: AblationConfig = {
  searchPaths: { vector: true, entity: true, cluster: true, actor: true },
  embeddingViews: { title: true, content: true, summary: true },
  viewAggregation: "max",
  rerankMode: "balanced",
  entityConfirmationBoost: 0.2,
};

/** Standard ablation configurations for paper experiments */
export const ABLATION_PRESETS = {
  // --- Embedding view ablations ---
  "title-only": { ...DEFAULT_ABLATION, embeddingViews: { title: true, content: false, summary: false } },
  "content-only": { ...DEFAULT_ABLATION, embeddingViews: { title: false, content: true, summary: false } },
  "summary-only": { ...DEFAULT_ABLATION, embeddingViews: { title: false, content: false, summary: true } },
  "title+content": { ...DEFAULT_ABLATION, embeddingViews: { title: true, content: true, summary: false } },
  "title+summary": { ...DEFAULT_ABLATION, embeddingViews: { title: true, content: false, summary: true } },
  "content+summary": { ...DEFAULT_ABLATION, embeddingViews: { title: false, content: true, summary: true } },
  "all-views": DEFAULT_ABLATION,

  // --- Search path ablations ---
  "vector-only": { ...DEFAULT_ABLATION, searchPaths: { vector: true, entity: false, cluster: false, actor: false } },
  "entity-only": { ...DEFAULT_ABLATION, searchPaths: { vector: false, entity: true, cluster: false, actor: false } },
  "vector+entity": { ...DEFAULT_ABLATION, searchPaths: { vector: true, entity: true, cluster: false, actor: false } },

  // --- Entity boost ablation ---
  "no-entity-boost": { ...DEFAULT_ABLATION, entityConfirmationBoost: 0 },

  // --- Reranking ablation ---
  "no-rerank": { ...DEFAULT_ABLATION, rerankMode: "none" as const },
  "rerank-cohere": { ...DEFAULT_ABLATION, rerankMode: "balanced" as const },
  "rerank-llm": { ...DEFAULT_ABLATION, rerankMode: "thorough" as const },
} as const;
```

#### How Ablation Config Reaches the Search Pipeline

**Approach: API-Level Override (Recommended)**

Add an `X-Eval-Ablation` header to the `/v1/search` API that only works when `EVAL_MODE=true` environment variable is set. The search logic reads the ablation config and conditionally skips paths/views/reranking.

Rationale: Testing the real API path is the core value proposition of the eval pipeline. The overhead of one environment-gated parameter is minimal. Alternative (calling `fourPathParallelSearch()` directly) doesn't test auth, parsing, or response formatting.

```typescript
// In search route handler (gated behind EVAL_MODE):
if (process.env.EVAL_MODE === "true") {
  const ablationHeader = req.headers["x-eval-ablation"];
  if (ablationHeader) {
    const ablation = JSON.parse(ablationHeader as string) as AblationConfig;
    // Pass to searchLogic() which conditionally skips paths/views
  }
}
```

#### Ablation-Aware Eval Runner

```typescript
// packages/console-eval/src/eval/ablation-sweep.ts

interface AblationSweepConfig {
  /** Which ablation presets to run */
  presets: (keyof typeof ABLATION_PRESETS)[];
  /** Dataset to use */
  datasetVersion: string;
  /** Braintrust project */
  projectName: string;
}

// Each ablation preset runs as a separate Braintrust experiment
// Tagged with: ablation={preset_name}, branch, commit, dataset_version
// Output: Comparison table across all presets for paper tables
```

---

### Section A.2: Ingestion Timing Specification

The eval runner's setup phase must handle async Inngest workflows with eventual consistency guarantees.

#### Polling Strategy

```typescript
// packages/console-eval/src/e2e/ingestion.ts — waitForIngestion()

const INGESTION_DEFAULTS = {
  /** Time between DB polls to check sourceId -> externalId mapping */
  pollIntervalMs: 3000,          // 3 seconds

  /** Maximum wall-clock time to wait for all observations */
  maxWaitMs: 300000,             // 5 minutes (comprehensive.json: 35 webhooks)

  /** Minimum observations required before declaring success */
  minSuccessRate: 0.85,          // Allow 15% filtering by significance gate

  /** Time to wait for Pinecone eventual consistency after DB confirms */
  pineconeSettleMs: 5000,        // 5 seconds
};
```

#### Three-Phase Wait

**Phase 1 — DB Observation Wait**: Poll `workspaceNeuralObservations` for sourceId matches.
- **Success**: All expected sourceIds have corresponding externalIds
- **Partial success**: >= minSuccessRate (85%) observations present after maxWaitMs
- **Failure**: < minSuccessRate after maxWaitMs -> throw with diagnostic info (which sourceIds missing, last poll time, total observations found)

**Phase 2 — Significance Filter Accounting**: Some test events will be filtered by the significance gate (score < 40). The eval runner must:
- Know which sourceIds are EXPECTED to be filtered (low-significance events) — annotated per-case as `expectedToBeFiltered: boolean` in the golden dataset
- Subtract filtered sourceIds from the "expected" count
- Log which events were filtered and their significance scores
- Report: "35 webhooks injected, 30 ingested, 5 filtered by significance gate (expected: 4, unexpected: 1)"

**Phase 3 — Pinecone Settle Wait**: After DB confirms observations exist, wait `pineconeSettleMs` for Pinecone's eventual consistency to ensure all 3 embedding views are queryable.
- Query Pinecone for a known sourceId's 3 vectors (title, content, summary)
- Verify all 3 views exist with correct metadata
- If < 3 views found, extend settle wait (up to 15 seconds total)
- If still missing after extended wait, warn but proceed (degraded evaluation)

#### Partial Failure Handling

```typescript
interface IngestionResult {
  succeeded: Map<string, string>;      // sourceId -> externalId (ingested)
  filtered: Set<string>;               // sourceIds below significance threshold
  failed: Set<string>;                 // sourceIds that never appeared (true failures)
  warnings: string[];                  // Diagnostic messages

  /** Can eval proceed? true if all eval cases have their ground truth available */
  canProceed: boolean;
}
```

Decision logic:
- If a golden dataset eval case's `expectedSourceIds` are ALL in `succeeded` -> case is evaluable
- If ANY of a case's `expectedSourceIds` are in `failed` -> case is skipped with warning
- If ALL of a case's `expectedSourceIds` are in `filtered` -> case is skipped (correctly filtered)
- Log skipped cases and their reasons; report eval coverage: "Evaluated 45/50 cases (5 skipped: 3 filtered, 2 failed)"

---

### Section A.3: Null Query Metric Handling

#### Problem

Null queries (queries that should return nothing) break standard IR metrics:
- **MRR**: Undefined when there are 0 relevant documents (the "first relevant result" doesn't exist)
- **Recall@K**: 0/0 = undefined (no relevant documents to recall)
- **Precision@K**: Well-defined (any returned result is a false positive)
- **NDCG@K**: 0/0 = undefined (IDCG is 0 when no relevant documents exist)

#### Solution: Null-Aware Metric Definitions

```typescript
// packages/console-eval/src/metrics/retrieval.ts — null-aware handling

/**
 * For null queries (groundTruth.relevantIds.size === 0):
 *
 * MRR:          Score = 1.0 if zero results returned, 0.0 otherwise
 * Recall@K:     Score = 1.0 (trivially: all 0 relevant docs are "retrieved")
 * Precision@K:  Score = 1.0 if zero results returned, 0.0 if any results returned
 * NDCG@K:       Score = 1.0 if zero results returned, 0.0 otherwise
 *
 * Rationale: A null query is answered correctly when the system returns NOTHING.
 * Returning any result for a null query is a false positive.
 */

function isNullQuery(groundTruth: GroundTruth): boolean {
  return groundTruth.relevantIds.size === 0;
}

// In calculateMRR():
if (isNullQuery(groundTruth)) {
  return results.length === 0 ? 1.0 : 0.0;
}

// In calculateRecallAtK():
if (isNullQuery(groundTruth)) {
  return 1.0; // Vacuously true: all 0 relevant docs were "found"
}

// In calculatePrecisionAtK():
if (isNullQuery(groundTruth)) {
  return topK.length === 0 ? 1.0 : 0.0; // Perfect if no results
}

// In calculateNDCGAtK():
if (isNullQuery(groundTruth)) {
  return results.length === 0 ? 1.0 : 0.0;
}
```

#### Dedicated Null Query Metrics

Reported separately from standard IR metrics in their own section of the eval report:

```typescript
interface NullQueryMetrics {
  /** Fraction of null queries that correctly returned 0 results */
  nullQueryAccuracy: number;
  /** Average number of false positive results returned for null queries */
  avgFalsePositives: number;
  /** List of null queries that incorrectly returned results */
  falsePositiveCases: Array<{
    queryId: string;
    query: string;
    resultCount: number;
    topResultScore: number;
  }>;
}
```

This tracks how well the system handles "don't know" / "nothing relevant" scenarios — critical for production trust.

---

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Golden dataset quality too low** | Medium | High | Critic LLM filtering + 20% human review |
| **Eval workspace data drift** | Low | Medium | Deterministic test data injection with idempotent sourceIds |
| **LLM-as-judge inconsistency** | Medium | Medium | Structured prompts, single run for CI, 3-run average for pre-release |
| **Braintrust free tier limits** | Low | Low | 50 evals/month free; production evals ~$0.01 each |
| **CI eval too slow** | Medium | Medium | Tier 1 only in CI (pure math, no LLM calls); subset dataset (30 cases) |
| **Metric thresholds too strict/loose** | High | Medium | 2-4 week informational calibration period before enforcement |
| **Test data doesn't reflect production** | High | High | Production query mining in Phase 5; activity logs provide real query distribution |
| **Ingestion timeout in eval** | Medium | Medium | Three-phase wait with 5min timeout, 85% success rate threshold, partial evaluation |
| **Embedding model drift invalidates data** | Low | High | Dataset needs `valid_with_model` field; re-embed on model change |
| **Eval pollutes production analytics** | Medium | Medium | Dedicated eval workspace; tag eval traffic to exclude from analytics |

**Critical path**: Steps 1 -> 2 -> 3 are sequential dependencies. Steps 4, 5, 6 can be parallelized after Step 3. Step 7 (ablation) is required before paper experiments. Steps 8-10 depend on stable baselines from Steps 3-6.

---

## Part B: Paper Topic Proposals

> **Note on ranking methodology**: Topics are ranked by external literature comparison (87 sources) validated against codebase novelty assessment. Rankings reflect the gap between what exists in the literature vs what Lightfast implements, not internal importance.

### Topic 1: Cross-Source Developer Identity Resolution for Engineering RAG

**Novelty Rating: VERY HIGH** — Zero academic papers on cross-platform developer identity resolution for RAG systems (confirmed by external research across 87 sources).

**Working Title**: "Who Did What Where? Cross-Source Developer Identity Resolution for Engineering-Domain RAG"

**Abstract Sketch**: Engineering teams use fragmented toolchains — GitHub for code, Sentry for errors, Vercel for deployments, Linear for project management — where the same developer appears with different identifiers across each platform. We present a cross-source identity resolution system that establishes canonical developer profiles by: (1) using GitHub numeric IDs as canonical identifiers, (2) linking Vercel deployers to GitHub identities via commit SHA matching in deployment payloads, (3) extracting Linear assignee information from issue event metadata, and (4) correlating Sentry error reporters through Git blame resolution. Applied to a production engineering intelligence system, our approach enables actor-attributed search queries ("what did developer X do?") that span all connected sources. On [N] identity resolution cases, our system achieves [X]% resolution accuracy with sub-100ms lookup latency. We show that identity-aware retrieval improves Recall@10 by [Y]% on actor-type queries compared to name-matching baselines.

**Novelty Claim**: While entity resolution and record linkage are studied fields (Fellegi-Sunter, learned matchers), their application to cross-platform developer identity in software engineering contexts is entirely unstudied. The closest work — GitHub identity merging for contributor analysis (Vasilescu et al., MSR 2015) — addresses a single platform. Our contribution is: (1) a practical multi-platform resolution algorithm using deterministic linkage signals (commit SHAs, numeric IDs) rather than probabilistic matching, (2) integration of resolved identities into a RAG retrieval path (actor search), and (3) empirical demonstration that identity resolution improves retrieval quality for person-specific queries.

**Evidence Needed**:
- Resolution accuracy: precision/recall of identity linkage across source pairs (GitHub-Vercel, GitHub-Linear, GitHub-Sentry)
- Coverage: what fraction of events get resolved identities
- Retrieval impact: actor-query performance with vs without identity resolution
- Latency: identity lookup time in the search pipeline
- Error analysis: types of resolution failures (ambiguous names, missing signals)
- Comparison with baselines: exact name match, fuzzy name match, email matching

**Dataset Requirements**:
- Ground truth identity mappings across 4+ sources (manually verified)
- 50+ actor-type queries with known-correct developer attributions
- Multi-source event corpus with overlapping developers
- Requires the `ActorAttribution` metric from Step 5

**Effort Estimate**: Medium
- Identity resolution already exists in production (`actor-resolution.ts:37-78`)
- Primarily needs evaluation and error analysis
- Human verification of identity mappings (~10 hours)
- 3-4 weeks additional work after eval pipeline

**Target Venue**:
- Primary: **MSR 2026** (Mining Software Repositories) — directly relevant community
- Secondary: **ICSE 2026 SEIP Track** (Software Engineering in Practice)
- Alternate: **SIGIR 2026 SIRIP** (Short Industry-Relevant Papers)
- Preprint: **arXiv cs.SE** for immediate visibility

**Timeline**: Draft ready ~6 weeks after eval pipeline baseline

---

### Topic 2: EngRAG-Bench — First Evaluation Benchmark for Engineering-Domain RAG

**Novelty Rating: VERY HIGH** — No engineering-domain RAG benchmarks exist in BEIR, MTEB, or any standard IR benchmark suite (confirmed by external research).

**Working Title**: "EngRAG-Bench: An Evaluation Benchmark for Retrieval-Augmented Generation in Software Engineering Intelligence"

**Abstract Sketch**: Despite the proliferation of RAG-powered developer tools (Copilot, Cursor, engineering intelligence platforms), no standardized benchmark exists for evaluating retrieval quality in software engineering contexts. We introduce EngRAG-Bench, the first evaluation benchmark for engineering-domain RAG systems, containing [N] curated query-relevance pairs across 6 query types: temporal ("deployments this week"), actor ("what did X do"), technical ("authentication errors"), status ("failed builds"), multi-hop ("errors after deployment"), and null (should-return-nothing). The benchmark is constructed from real webhook events spanning GitHub, Sentry, Vercel, and Linear, processed through a production engineering intelligence system. We establish baselines using dense retrieval, hybrid search, and our production 4-path architecture, and provide standardized metrics with null-query-aware definitions and per-query-type stratification. We release EngRAG-Bench as an open benchmark to enable reproducible evaluation of engineering-domain RAG systems.

**Novelty Claim**: BEIR provides 18 retrieval benchmarks across domains (biomedical, financial, scientific), and MTEB extends this further. But ZERO benchmarks target software engineering retrieval — where documents are structured events (not prose), queries involve temporal reasoning and person attribution, and relevance depends on organizational context. Our contribution is: (1) the first SE-domain RAG benchmark with real webhook-sourced data, (2) a novel query taxonomy for engineering intelligence (6 types with distinct retrieval challenges), (3) null-query-aware metric definitions, and (4) standardized baselines enabling reproducible comparison.

**Evidence Needed**:
- Benchmark dataset: 200-300 query-relevance pairs with human-validated ground truth
- Query type distribution analysis: difficulty and distinguishing characteristics per type
- Baseline results: at least 3 retrieval systems (dense, hybrid, full pipeline) on the benchmark
- Inter-annotator agreement: 2+ annotators on relevance judgments (Cohen's kappa)
- Benchmark quality analysis: dataset difficulty calibration, query diversity metrics
- Null query analysis: false positive rates across systems

**Dataset Requirements**:
- This IS the dataset — the golden dataset becomes the contribution
- 200+ cases minimum for a benchmark paper
- Full provenance tracking (how each case was created/validated)
- Open-release format compatible with BEIR evaluation framework
- Multiple difficulty levels (easy/medium/hard) per query type

**Effort Estimate**: Medium-High
- Golden dataset v1 (50 cases) is Step 2, but benchmark needs 200+
- Quality bar for a benchmark paper is higher (multiple annotators, provenance)
- Requires baseline implementations for comparison
- 4-5 weeks additional work after eval pipeline

**Target Venue**:
- Primary: **NeurIPS 2026 Datasets and Benchmarks Track** — prestigious, specifically for new benchmarks
- Secondary: **SIGIR 2026 Resource Track** — strong IR community presence
- Alternate: **EMNLP 2026 Resource Track**
- Preprint: **arXiv cs.IR** for community feedback before submission

**Timeline**: Draft ready ~8 weeks after eval pipeline baseline

---

### Topic 3: Webhook-Driven Real-Time Software Engineering Knowledge Graphs

**Novelty Rating: HIGH** — Existing SE knowledge graphs (Nalanda/Microsoft, ESEC/FSE 2022) are batch-processed from repo mining; real-time webhook-driven construction is unstudied.

**Working Title**: "From Webhooks to Knowledge: Real-Time Construction of Software Engineering Knowledge Graphs from Event Streams"

**Abstract Sketch**: Software engineering knowledge graphs enable complex queries across development activities, but existing approaches (Nalanda, CodeKG) rely on batch processing of repository data. We present a real-time approach that constructs and maintains a knowledge graph from webhook event streams. Our system uses 5 detection strategies to automatically discover relationships: (1) commit SHA linking between pushes and deployments, (2) branch name correlation across events, (3) explicit issue/PR ID references in messages, (4) PR-issue linkage from GitHub metadata, and (5) Sentry-to-Linear trigger detection. Applied to a production system processing GitHub, Sentry, Vercel, and Linear webhooks, our approach maintains a traversable relationship graph with median relationship detection latency of [X]ms and [Y]% precision on automatically detected links. We demonstrate that graph-augmented retrieval improves multi-hop query performance by [Z]% compared to flat document retrieval.

**Novelty Claim**: Nalanda (Microsoft, ESEC/FSE 2022) is the closest prior work — it builds SE knowledge graphs from GitHub data for code search. Key differences: (1) Nalanda processes repository snapshots in batch; our system processes real-time event streams, (2) Nalanda covers only GitHub; our system spans 4+ sources, (3) our relationship graph is designed for RAG retrieval (traversable for multi-hop queries), not code navigation, (4) we demonstrate the value of real-time graph maintenance for temporal queries.

**Evidence Needed**:
- Relationship detection precision/recall per strategy (5 strategies independently + combined)
- Graph construction latency: webhook received to relationship indexed
- Graph coverage: what fraction of events participate in at least one relationship
- Multi-hop query improvement: graph-augmented vs flat retrieval
- Temporal freshness: can the graph answer "what happened after X?" accurately
- Comparison with batch processing: coverage vs latency tradeoff

**Dataset Requirements**:
- Webhook event corpus with manually annotated ground-truth relationships
- Multi-hop query set with ground truth traversal paths
- Temporal query set requiring relationship-aware retrieval
- 50+ relationship instances across all 5 detection strategies

**Effort Estimate**: Medium
- Relationship graph already exists in production (5 detection strategies in `relationship-graph.ts`)
- Primarily needs evaluation infrastructure and ground truth annotation
- 3-4 weeks additional work

**Target Venue**:
- Primary: **ESEC/FSE 2026** (Foundations of Software Engineering) — directly relevant, Nalanda was published here
- Secondary: **ICSE 2026 SEIP Track**
- Alternate: **KDD 2026 Applied Data Science Track**
- Preprint: **arXiv cs.SE**

**Timeline**: Draft ready ~6 weeks after eval pipeline baseline

---

### Topic 4: Significance-Gated Ingestion for Knowledge Base Construction

**Novelty Rating: MEDIUM-HIGH** — Neural Passage Quality Estimation (Campos et al., 2020) is closest prior work but targets passage ranking, not ingestion filtering. The application to pre-embedding quality gating is novel.

**Working Title**: "Not All Events Are Equal: Significance-Gated Ingestion for Software Intelligence Knowledge Bases"

**Abstract Sketch**: Building knowledge bases from high-volume event streams requires distinguishing signal from noise. We present a significance-gated ingestion pipeline that uses rule-based scoring (content signals, event type weights, reference density) to filter low-value events before expensive downstream processing (LLM classification, embedding generation, entity extraction). Applied to software engineering events from GitHub, Sentry, and Vercel, our approach filters [X]% of events (below threshold 40/100) while retaining [Y]% of events later confirmed as relevant by human reviewers, reducing embedding and LLM costs by [Z]% without measurable retrieval quality degradation.

**Novelty Claim**: Data quality filtering exists in ML pipelines, but significance scoring as a pre-embedding quality gate for RAG knowledge bases — with empirical cost-quality tradeoff analysis — is novel. The formula (`baseWeight + SUM(signalWeights) + referenceBonus + contentBonus`, clamped 0-100) provides a lightweight, interpretable alternative to learned quality models. The combination of rule-based scoring + threshold gating + downstream cost analysis provides a practical contribution.

**Evidence Needed**:
- Precision/recall of significance scoring at various thresholds (20, 30, 40, 50, 60)
- Cost analysis: embedding + LLM costs saved by filtering at each threshold
- Retrieval quality comparison: with vs without significance filtering (ablation)
- Analysis of false negatives (relevant events incorrectly filtered)
- Threshold sensitivity analysis across different source types (GitHub vs Sentry vs Vercel)
- Comparison with simple heuristics (event type only, content length only) and learned models

**Dataset Requirements**:
- 500+ raw webhook events with human relevance annotations
- Cost tracking per event (embedding cost ~$0.0001, LLM classification cost ~$0.001)
- Pre/post significance filtering retrieval quality comparison
- Source-type stratified analysis

**Effort Estimate**: Medium-Low
- Significance scoring already exists in production (`scoring.ts:78-118`)
- Primarily needs evaluation and analysis work
- Human annotation of filtered events is the main effort
- 2-3 weeks additional work

**Target Venue**:
- Primary: **ICSE 2026 SEIP Track** (Software Engineering in Practice)
- Secondary: **KDD 2026 Applied Data Science Track**
- Workshop: **MSR 2026** (Mining Software Repositories)

**Timeline**: Draft ready ~5 weeks (requires significance eval dataset + analysis)

---

### Topic 5: 4-Path Hybrid Retrieval with Entity Confirmation Boosting

**Novelty Rating: MEDIUM-HIGH** — Hybrid retrieval (dense + sparse) is well-studied, but the specific 4-path architecture with entity confirmation boosting (+0.2 additive score) extends beyond standard fusion approaches.

**Working Title**: "Four-Path Parallel Retrieval with Entity Confirmation Boosting for Software Engineering Intelligence"

**Abstract Sketch**: Modern RAG systems typically rely on dense retrieval or dense+sparse hybrid approaches. We present a four-path parallel retrieval architecture that fuses vector similarity, entity pattern matching, cluster-based topic context, and actor profile search to achieve comprehensive coverage across diverse query types. Our entity confirmation boosting mechanism (+0.2 additive score when vector and entity results overlap) exploits structural information available in software engineering domains. On [N] evaluation cases, our four-path approach with entity boosting achieves [X]% higher Recall@10 than dense-only retrieval and [Y]% higher than standard hybrid (dense+sparse).

**Novelty Claim**: While reciprocal rank fusion (Cormack et al., 2009) and learned fusion (ColBERT, SPLADE) combine 2 retrieval paths, our 4-path architecture with domain-specific entity confirmation boosting is novel. The entity confirmation boost formula `MIN(1.0, MAX(view_scores) + 0.2)` and entity-only fallback score `0.85 * confidence` are specific contributions.

**Evidence Needed**:
- Full path ablation: all 15 combinations (4 single, 6 pairwise, 4 three-path, 1 all)
- Entity confirmation boost ablation: boost values from 0 to 0.4 in 0.05 increments
- Per-query-type analysis: which paths matter for which query types
- Latency breakdown: parallel execution overhead vs quality gains
- Comparison with standard hybrid (dense + BM25) and learned fusion baselines

**Dataset Requirements**:
- 200+ eval cases with per-path attribution labels
- Multiple search modes (fast/balanced/thorough)
- Reranking tier comparison data

**Effort Estimate**: High
- Full ablation infrastructure needed (Step 7)
- 200+ dataset cases for per-path statistical significance
- Reranking tier comparison requires 3x eval runs
- 5-6 weeks additional work

**Target Venue**:
- Primary: **SIGIR 2026 SIRIP** (Short Industry-Relevant Papers)
- Secondary: **ECIR 2027**
- Workshop: **SIGIR 2026 Workshop on Hybrid Search**

**Timeline**: Draft ready ~8 weeks after eval pipeline baseline

---

### Ranking and Recommendation

| Rank | Topic | Novelty | Feasibility | Impact | Literature Gap |
|------|-------|---------|-------------|--------|----------------|
| 1 | **Topic 1: Cross-Source Identity** | Very High | Medium | High | Zero papers |
| 2 | **Topic 2: EngRAG-Bench** | Very High | Medium-High | Very High | Zero benchmarks |
| 3 | **Topic 3: Webhook Knowledge Graph** | High | Medium | High | Batch-only prior work |
| 4 | **Topic 4: Significance Gating** | Medium-High | High | Medium | Novel application |
| 5 | **Topic 5: 4-Path Retrieval** | Medium-High | Medium-Low | Medium-High | Extension of hybrid |

**Primary Recommendation: Combined Systems Paper (Topics 1 + 3)**

"Engineering-Domain RAG with Cross-Source Knowledge Graphs"

The external research recommends combining cross-source identity resolution (Topic 1) with the webhook-driven knowledge graph (Topic 3) into a single systems paper. Rationale:
- Cross-source identity and relationship graphs are architecturally intertwined — identity resolution enables person-attributed graph traversal
- Together they tell a complete story: "how to build an engineering knowledge graph from fragmented webhook streams"
- Both have strong novelty (Very High + High) and are feasible with existing production code
- The combined paper is stronger than either alone — identity without the graph lacks a "so what," and the graph without identity lacks a key capability

**Secondary Recommendation: Topic 2 (EngRAG-Bench)**
- Highest potential impact — benchmarks become standard references (BEIR has 4000+ citations)
- Requires the most dataset work (200+ cases, multiple annotators)
- Can be pursued in parallel since the eval pipeline dataset IS the benchmark
- Target NeurIPS Datasets & Benchmarks Track for maximum visibility

**Dual-Track Strategy**: Pursue the combined systems paper (Topics 1+3) as the primary submission targeting arXiv -> SIGIR SIRIP / EMNLP Industry Track (faster turnaround, 4-6 page format). Simultaneously develop EngRAG-Bench (Topic 2) as a longer-term, higher-impact submission targeting NeurIPS D&B Track (May deadline). The eval pipeline work feeds both papers.

### Target Venues and Deadlines

| Venue | Track | Deadline | Format | Fit |
|-------|-------|----------|--------|-----|
| **arXiv cs.SE / cs.IR** | Preprint | Anytime | Any length | Immediate visibility |
| **SIGIR 2026 SIRIP** | Industry Short | ~Feb 2026 | 4 pages | Strong for combined paper |
| **NeurIPS 2026 D&B** | Datasets & Benchmarks | ~May 2026 | 9 pages | Perfect for EngRAG-Bench |
| **KDD 2026 ADS** | Applied Data Science | ~May 2026 | 9 pages | Good for systems paper |
| **EMNLP 2026 Industry** | Industry Track | ~Jul 2026 | 8 pages | Strong for either paper |
| **ESEC/FSE 2026** | Industry Track | Varies | 10 pages | Best for SE community |

---

## Part C: Paper Structure (Top 2 Topics)

### Paper 1: Engineering-Domain RAG with Cross-Source Knowledge Graphs

*Combined systems paper: cross-source identity (Topic 1) + webhook knowledge graph (Topic 3)*

#### Section-by-Section Outline

**1. Introduction** (1.5 pages)
- Motivation: Engineering teams use 4-8 tools (GitHub, Sentry, Vercel, Linear, Slack, PagerDuty). The same developer, the same deployment, the same incident appears in multiple systems with different identifiers. Existing developer tools treat each source in isolation.
- Problem: (1) Cross-platform developer identity is unresolved — "who did what" queries fail when the same person is jdoe on GitHub and John Doe on Vercel. (2) Relationships between events (a push triggered a deployment that caused an error) are implicit and lost.
- Contribution: (1) A cross-source identity resolution algorithm using deterministic linkage signals (commit SHAs, numeric IDs) achieving [X]% precision, (2) A real-time webhook-driven knowledge graph with 5 automatic relationship detection strategies, (3) Integration of both into a production RAG pipeline with empirical evaluation on [N] queries, (4) Release of EngRAG-Bench evaluation dataset (cross-reference with Paper 2)
- Preview: Identity resolution improves actor-query Recall@10 by [X]%, graph augmentation improves multi-hop query performance by [Y]%

**2. Related Work** (1.5 pages)
- 2.1 Entity resolution and record linkage (Fellegi-Sunter, Magellan, DeepMatcher) — positioned as classical problem but unstudied in SE multi-tool context
- 2.2 Software engineering knowledge graphs (Nalanda/Microsoft ESEC/FSE 2022, CodeKG, SoftKG) — positioned as batch-only, single-source approaches
- 2.3 RAG systems for software engineering (Copilot, Cursor, DevOps intelligence) — positioned as lacking cross-source reasoning
- 2.4 Multi-source data integration (data fusion, schema matching) — positioned as complementary but not addressing the real-time webhook domain
- Gap statement: No existing work combines cross-platform identity resolution with real-time knowledge graph construction for engineering RAG

**3. System Architecture** (2.5 pages)
- 3.1 System overview: Webhook ingestion -> significance gate -> identity resolution -> relationship detection -> embedding -> knowledge graph -> RAG retrieval
- 3.2 Cross-source identity resolution
  - GitHub numeric ID as canonical identifier
  - Vercel -> GitHub linkage via commit SHA in deployment payload (`actor-resolution.ts:37-78`)
  - Linear assignee extraction from issue event metadata
  - Sentry reporter correlation through Git blame
  - Resolution algorithm: deterministic matching (no ML, no training data) with confidence scores
- 3.3 Automatic relationship detection (5 strategies)
  - Strategy 1: Commit SHA linking (push -> deployment)
  - Strategy 2: Branch name correlation (PR -> deployment -> error)
  - Strategy 3: Explicit issue/PR ID references in commit messages
  - Strategy 4: GitHub PR-issue linkage from API metadata
  - Strategy 5: Sentry-to-Linear trigger detection (error -> task)
- 3.4 Knowledge graph structure and traversal for RAG
  - Graph schema: nodes (observations) + edges (relationships with type and confidence)
  - Traversal for multi-hop queries: "errors after deployment by X"
  - Integration with 4-path retrieval (graph path contributes candidates)

**4. Evaluation Methodology** (1.5 pages)
- 4.1 Datasets
  - Identity resolution: [N] developer identities across 4 platforms, manually verified
  - Relationship detection: [M] event pairs with ground-truth relationships
  - RAG evaluation: EngRAG-Bench subset (actor + multi-hop query types)
- 4.2 Identity resolution metrics: precision, recall, F1, resolution coverage, ambiguity rate
- 4.3 Relationship detection metrics: precision, recall, F1 per strategy; graph connectivity metrics
- 4.4 End-to-end RAG impact: MRR, Recall@K, NDCG@K for actor and multi-hop queries
- 4.5 Baselines
  - Identity: exact name match, fuzzy name match (Levenshtein), email matching
  - Relationships: no relationships (flat retrieval), timestamp proximity only
  - RAG: dense-only retrieval, dense + entity (no graph)

**5. Results** (2 pages)
- 5.1 Identity resolution accuracy (Table 1: per-source-pair precision/recall)
- 5.2 Relationship detection results (Table 2: per-strategy precision/recall/coverage)
- 5.3 Knowledge graph statistics (Table 3: nodes, edges, connectivity, average path length)
- 5.4 RAG impact — actor queries (Table 4: with/without identity resolution)
- 5.5 RAG impact — multi-hop queries (Table 5: with/without graph augmentation)
- 5.6 Combined impact (Figure 1: Recall@K curves for identity + graph vs baselines)
- 5.7 Latency analysis (Table 6: per-component latency breakdown)
- 5.8 Error analysis (Figure 2: common failure modes for identity resolution and relationship detection)

**6. Discussion** (1 page)
- Deterministic vs probabilistic identity resolution: tradeoffs and when each is appropriate
- Real-time vs batch knowledge graphs: freshness-accuracy tradeoff
- Generalizability: approach applies to any domain with structured multi-source events (healthcare, finance, operations)
- Limitations: English-only, Cohere embeddings, 4 specific platforms, small-team validation
- Ethical considerations: developer identity tracking and privacy

**7. Conclusion** (0.5 pages)
- Summary: first cross-source identity resolution + real-time knowledge graph for engineering RAG
- Future work: learned relationship weights, temporal decay in graph, privacy-preserving identity resolution

#### Key Figures/Tables
1. **Figure 1**: System architecture diagram (webhook -> identity -> relationships -> graph -> RAG)
2. **Table 1**: Identity resolution precision/recall per source pair
3. **Table 2**: Relationship detection precision/recall per strategy
4. **Table 3**: Knowledge graph statistics
5. **Table 4**: Actor query performance: with/without identity resolution
6. **Table 5**: Multi-hop query performance: with/without graph augmentation
7. **Figure 2**: Recall@K curves comparing full system vs ablation baselines
8. **Figure 3**: Error analysis taxonomy for resolution/detection failures
9. **Table 6**: Latency breakdown per component

---

### Paper 2: EngRAG-Bench — Engineering-Domain RAG Benchmark

#### Section-by-Section Outline

**1. Introduction** (1.5 pages)
- Motivation: RAG-powered developer tools are shipping without standardized evaluation — BEIR covers 18 domains but not software engineering
- Problem: (1) No benchmark exists for engineering-domain retrieval, (2) Engineering queries have unique characteristics (temporal reasoning, actor attribution, cross-source correlation) that existing benchmarks don't capture, (3) Existing metrics don't handle null queries (should-return-nothing)
- Contribution: (1) EngRAG-Bench: first SE-domain RAG benchmark with [N] queries across 6 types, (2) Novel query taxonomy for engineering intelligence, (3) Null-query-aware metric definitions, (4) Standardized baselines enabling reproducible comparison, (5) Open release in BEIR-compatible format

**2. Related Work** (1 page)
- 2.1 Information retrieval benchmarks (BEIR, MTEB, MS MARCO, TREC)
- 2.2 Code search benchmarks (CodeSearchNet, CoSQA, AdvTest) — positioned as code-specific, not engineering operations
- 2.3 RAG evaluation frameworks (Ragas, ARES, RGB) — positioned as metrics not benchmarks
- 2.4 Software engineering datasets (GHTorrent, World of Code, MSR datasets) — positioned as raw data without query-relevance annotations
- Gap statement: No retrieval benchmark targets the intersection of SE operations (deployments, errors, incidents) and natural language queries

**3. Benchmark Construction** (2.5 pages)
- 3.1 Corpus: Webhook events from GitHub, Sentry, Vercel, Linear
  - Event schema: structured fields + unstructured content + metadata
  - Processing pipeline: webhook -> significance scoring -> LLM classification -> embedding
  - Corpus statistics: N events, M source types, temporal span
- 3.2 Query taxonomy (6 types with examples):
  - Temporal: "deployments this week", "errors in last 24 hours"
  - Actor: "what did developer X do", "commits by team Y"
  - Technical: "authentication errors", "build failures"
  - Status: "failed deployments", "resolved incidents"
  - Multi-hop: "errors after deployment by X", "issues linked to PR #123"
  - Null: "quantum computing papers" (should return nothing in SE context)
- 3.3 Query generation methodology
  - Three-source strategy: existing scenarios + LLM-generated + manual curation
  - LLM-critic quality filtering (Claude Sonnet, threshold >= 3/5)
  - Human validation protocol: 2 annotators per query, inter-annotator agreement
- 3.4 Relevance annotation protocol
  - Binary relevance (relevant/not-relevant) with graded option for future extension
  - Annotation guidelines for each query type
  - Inter-annotator agreement analysis

**4. Null-Query-Aware Metrics** (1 page)
- 4.1 Problem: Standard IR metrics (MRR, NDCG, Recall) are undefined for null queries
- 4.2 Null-aware definitions (formal specification)
- 4.3 Dedicated NullQueryMetrics: accuracy, false positive rate, false positive analysis
- 4.4 Reporting protocol: separate null-query results from standard metrics

**5. Baselines and Experiments** (2 pages)
- 5.1 Retrieval systems evaluated:
  - Dense retrieval (Cohere embed-english-v3.0, single-view)
  - Multi-view dense (3 views with max aggregation)
  - 4-path hybrid (full production pipeline)
  - BM25 (if implemented) or representative sparse baseline
- 5.2 Results by query type (Table 1: 6 query types x 4 systems x 4 metrics)
- 5.3 Overall results (Table 2: aggregate metrics per system)
- 5.4 Null query results (Table 3: false positive analysis per system)
- 5.5 Difficulty analysis (Figure 1: metric distributions per query type)
- 5.6 Ablation: impact of corpus size, query set size, annotation quality

**6. Benchmark Analysis** (1 page)
- 6.1 What makes engineering queries hard: temporal reasoning, identity resolution, cross-source correlation
- 6.2 Comparison with BEIR difficulty: calibration against known benchmarks
- 6.3 Benchmark limitations and bias analysis
- 6.4 Recommended evaluation protocol for benchmark users

**7. Conclusion and Release** (0.5 pages)
- Release artifacts: queries, corpus, relevance judgments, evaluation scripts, baselines
- License and access
- Future: community contributions, annual benchmark updates

#### Key Figures/Tables
1. **Table 1**: Per-query-type results (6 types x 4 systems x MRR/NDCG/Recall/Precision)
2. **Table 2**: Aggregate results per system
3. **Table 3**: Null query false positive analysis
4. **Figure 1**: Metric distribution box plots per query type
5. **Figure 2**: Query generation and validation pipeline diagram
6. **Table 4**: Inter-annotator agreement (Cohen's kappa per query type)
7. **Table 5**: Corpus statistics (events per source, temporal distribution)
8. **Figure 3**: Difficulty calibration against BEIR benchmarks

---

## Part D: Research Methodology

### Experimental Design

#### Core Experiments (Supporting Both Papers)

**Experiment 1: Retrieval Quality Baseline**
- Run full eval suite (all Tier 1 + Tier 2 metrics) on golden dataset
- 3 search modes x all query types
- 3 repetitions for variance estimation
- Outputs: Baseline metrics table, per-query-type breakdown, null query accuracy

**Experiment 2: Identity Resolution Evaluation (Paper 1)**
- Ground truth: manually verify developer identity mappings across GitHub, Vercel, Linear, Sentry
- Measure: precision/recall of each resolution strategy independently
- Measure: end-to-end actor-query retrieval with vs without identity resolution
- Ablation: remove each linkage signal (commit SHA, numeric ID, etc.) independently
- Outputs: Per-source-pair resolution accuracy, actor-query retrieval lift

**Experiment 3: Relationship Detection Evaluation (Paper 1)**
- Ground truth: manually annotate event-pair relationships across all 5 detection strategies
- Measure: precision/recall per strategy
- Measure: graph connectivity metrics (avg degree, connected components, path length distribution)
- Ablation: remove each detection strategy independently; measure graph degradation
- Measure: multi-hop query performance with vs without graph augmentation
- Outputs: Per-strategy detection accuracy, graph statistics, multi-hop query retrieval lift

**Experiment 4: Multi-View Ablation (Paper 2 baselines, also supports future multi-view paper)**
- 7 view configurations: {title}, {content}, {summary}, {title+content}, {title+summary}, {content+summary}, {all}
- Same golden dataset, same search config except view selection
- Uses AblationConfig with embedding view presets (Section A.1)
- Outputs: 7 x metric rows, per-query-type x per-view activation heatmap

**Experiment 5: Path Ablation (Paper 2 baselines)**
- Disable individual search paths using AblationConfig: {vector}, {entity}, {cluster}, {actor}, key combinations
- Focus on the 7 most informative configurations (4 single + vector+entity + vector+entity+cluster + all)
- Outputs: Path contribution by query type, recall attribution

**Experiment 6: Reranking Tier Comparison (Paper 2 baselines)**
- Same queries, same retrieval, different reranking: none, Cohere, LLM
- 3 x all query types
- Uses AblationConfig rerankMode presets
- Outputs: Reranking lift per tier, latency vs quality tradeoff

**Experiment 7: Entity Confirmation Boost Sweep (Paper 1 supplementary)**
- Boost values: 0, 0.05, 0.1, 0.15, 0.2 (default), 0.25, 0.3, 0.35, 0.4
- Measure: MRR and Recall@10 at each boost value
- Identify optimal boost value and sensitivity range
- Outputs: Boost value sensitivity curve

**Experiment 8: Significance Threshold Sweep (Paper 1 supplementary, Topic 4 standalone)**
- Threshold values: 20, 30, 40 (default), 50, 60, 70
- Measure: events filtered, retrieval quality, cost savings at each threshold
- Outputs: Precision-recall of significance gate, cost-quality Pareto curve

**Experiment 9: Benchmark Quality Analysis (Paper 2)**
- Inter-annotator agreement (2 human reviewers): Cohen's kappa per query type
- Dataset difficulty calibration: compare against BEIR benchmark difficulty distributions
- Query diversity analysis: embedding-space coverage, query type balance
- Metric stability as function of dataset size (25, 50, 100, 200 cases)
- LLM-generated vs manual case quality comparison
- Outputs: Quality metrics for benchmark paper Section 6

### Baselines

**For Paper 1 (Systems Paper)**:
1. **No identity resolution**: Name-string matching only for actor queries
2. **Fuzzy name matching**: Levenshtein distance-based identity matching
3. **Email-based matching**: Link accounts by shared email addresses
4. **No relationships**: Flat retrieval without graph traversal for multi-hop queries
5. **Timestamp proximity**: Link events by temporal proximity (within N minutes)

**For Paper 2 (Benchmark Paper)**:
1. **Dense retrieval**: Standard single-embedding Cohere dense retrieval
2. **Multi-view dense**: 3-view embedding with max aggregation (Lightfast default)
3. **4-path hybrid**: Full production pipeline with all paths + reranking
4. **BM25**: Classic sparse retrieval (implement lightweight in-memory BM25 or cite comparable results)

### Ablation Studies

**Identity Resolution Ablations (Paper 1)**:
- Individual linkage signals: commit SHA only, numeric ID only, metadata extraction only
- Pairwise combinations of linkage signals
- With/without confidence thresholding
- Resolution latency budget: 10ms, 50ms, 100ms caps

**Relationship Detection Ablations (Paper 1)**:
- Individual strategies: each of 5 strategies alone
- Cumulative strategies: strategies added incrementally (ordered by precision)
- Graph depth limits: 1-hop, 2-hop, 3-hop traversal for multi-hop queries
- Confidence threshold: relationship edges at 0.5, 0.7, 0.9 confidence

**Benchmark Ablations (Paper 2)**:
- Dataset size: 50, 100, 150, 200, 250, 300 cases — metric stability
- Query type balance: uniform vs production-weighted distribution
- Annotation quality: LLM-only vs human-reviewed vs expert-curated
- Metric choice: MRR vs NDCG vs Recall as primary metric

### Statistical Analysis

**For all experiments**:
1. **Paired bootstrap tests** (10,000 resamples): Compare systems using same inputs; report p-values and 95% confidence intervals
2. **Cohen's d effect size**: Practical significance alongside statistical significance; thresholds: small (0.2), medium (0.5), large (0.8)
3. **Per-query-type stratification**: Report metrics broken down by query type, not just aggregate
4. **Multiple comparison correction**: Bonferroni or Holm-Bonferroni when comparing >2 systems
5. **Variance analysis**: Report standard deviation and coefficient of variation for all metrics

**For LLM-as-judge experiments**:
- Inter-run agreement: Run same judge 3 times, compute Fleiss' kappa
- Human-judge agreement: Subset of 50 cases scored by both human and LLM
- Report both Pearson correlation and Cohen's kappa for ordinal agreement

**For benchmark validation (Paper 2)**:
- Inter-annotator agreement: Cohen's kappa (target >= 0.7 for "substantial agreement")
- Benchmark difficulty calibration: Spearman rank correlation with BEIR benchmark difficulty
- Dataset diversity: embedding-space coverage analysis, nearest-neighbor distance distribution

---

## Open Questions

### Design Decisions Needing User Input

1. **Paper Submission Timeline**: The combined systems paper (Topics 1+3) and EngRAG-Bench (Topic 2) can proceed in parallel. Key deadline: NeurIPS D&B Track (May 2026) for the benchmark paper. The systems paper has more flexible timing (arXiv preprint first).

2. **Publication Venue Priority**: Recommendation is dual-track: (a) systems paper -> arXiv first, then SIGIR SIRIP or EMNLP Industry Track (shorter format, faster review), (b) EngRAG-Bench -> NeurIPS D&B Track (high prestige for benchmarks, longer format).

3. **BM25 Baseline**: For EngRAG-Bench (Paper 2), should we implement BM25 search as a baseline? This adds ~1 week of work but significantly strengthens the benchmark's baseline coverage. Alternative: cite BM25 results from comparable datasets in related work.

4. **Human Annotation Budget**: Both papers need human annotation. Estimated need:
   - Paper 1: ~15 hours (identity verification + relationship annotation)
   - Paper 2: ~30 hours (200+ relevance judgments x 2 annotators)
   - Total: ~45 hours. How much reviewer time is available?

5. **Anonymization Strategy**: If targeting double-blind venues (EMNLP, NeurIPS), system must be anonymized. Recommendation: submit to arXiv first (not blind) for visibility, then target single-blind venues (SIGIR SIRIP, KDD ADS) where system names are fine. For NeurIPS D&B, anonymize as "EngRAG-Bench" without company attribution.

6. **Open-Source Strategy**: Releasing EngRAG-Bench dramatically increases Paper 2's impact. Releasing the eval framework also enables a JMLR MLOSS submission. Would Lightfast open-source (a) the benchmark dataset, (b) the eval framework, (c) both, (d) neither?

7. **Dual-Track vs Single-Track**: Recommendation: dual-track. The systems paper (Topics 1+3) and benchmark paper (Topic 2) share the eval pipeline foundation but have different experiments and timelines. The benchmark paper has a natural higher-impact ceiling (benchmarks get cited extensively).

8. **Eval Workspace Infrastructure**: Recommendation: dedicated eval workspace with deterministic test data injection. Reproducibility is critical for paper claims. Production workspace copy introduces uncontrolled variables.

9. **Dataset Release Scope**: For EngRAG-Bench, release: queries, relevance judgments, evaluation scripts, baselines. For corpus: release anonymized/synthetic version (real webhook data may contain sensitive information). For eval framework: release with MIT license.

10. **Academic Collaboration**: Having an academic co-author increases credibility at top venues. Are there university partnerships or advisors available? Particularly valuable for NeurIPS D&B submission.
