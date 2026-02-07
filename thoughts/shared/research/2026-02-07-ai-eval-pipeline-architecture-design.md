---
date: 2026-02-07
researcher: architect-agent
topic: "AI evaluation pipeline — architecture design"
tags: [research, architecture, ai-evaluation, pipeline-design]
status: complete
based_on:
  - 2026-02-07-ai-eval-pipeline-codebase-deep-dive.md
  - 2026-02-07-ai-eval-pipeline-external-research.md
---

# Architecture Design: AI Evaluation Pipeline

## Research Question
How should Lightfast design an AI evaluation pipeline that enables iterative, measurable improvement of its AI systems — from dataset creation through eval execution to production deployment confidence?

## Executive Summary

Lightfast has a sophisticated AI pipeline (4-path parallel search, 3-tier reranking, multi-tool answer agent) but **zero evaluation infrastructure** — no golden dataset, no automated metrics, no regression detection, no feedback loop. The codebase deep dive reveals a detailed plan for `packages/console-eval/` that was never implemented, existing Braintrust tracing that's only used for observability (not evaluation), and rich activity logging that could feed dataset creation. External research converges on a hybrid approach: Braintrust for eval orchestration (already partially integrated), custom TypeScript scorers for Lightfast-specific metrics (citation accuracy, temporal reasoning), and paired bootstrap tests for regression detection.

This design synthesizes both research streams into a **5-phase architecture** that addresses the cold-start problem (no existing dataset), builds on existing codebase patterns (Inngest workflows, Drizzle schemas, tRPC routers, `workspace:*` package conventions), and creates a complete lifecycle: **dataset → eval → compare → deploy → monitor → dataset**. The architecture is designed to deliver a first baseline eval within 1–2 weeks and full CI/CD quality gates within 6 weeks.

**Key design decisions:**
1. **Hybrid Braintrust + Custom Scorers** — Braintrust for orchestration/tracking, custom TypeScript implementations for all metrics (no Python subprocess dependency)
2. **Two-Layer Evaluation** — Retrieval metrics (deterministic, fast, cheap) as CI gate; RAG quality metrics (LLM-as-judge, slower, more expensive) for nightly batch
3. **Dataset Bootstrap via Synthetic + Production Mining** — Start with 50 LLM-generated examples from existing test data corpus, expand to 300 via production query mining
4. **Statistical Regression Detection** — Paired bootstrap tests with p < 0.05, effect size (Cohen's d), and configurable regression thresholds per metric
5. **Inngest-Driven Eval Workflows** — Eval runs as Inngest functions for observability, retry, and concurrency control consistent with existing patterns

---

## Existing Foundation

### What We're Building On

**Production AI Pipeline** (fully operational):
- 4-path parallel search: `apps/console/src/lib/neural/four-path-search.ts:362` — vector, entity, cluster, actor paths via `Promise.all()`
- 3-tier reranking: `packages/console-rerank/src/` — passthrough (0ms), Cohere rerank-v3.5 (~200ms), Claude Haiku LLM (~600ms)
- Answer agent: Claude Sonnet 4.5 with 5 tools, max 8 steps, ephemeral Redis memory
- Multi-view embeddings: 3 views per observation (title, content, summary) via Cohere embed-english-v3.0

**Braintrust Integration** (tracing only, not eval):
- `api/console/src/inngest/workflow/neural/ai-helpers.ts:16` — `createTracedModel()` wraps AI models with `BraintrustMiddleware`
- `buildNeuralTelemetry()` adds workflow context to AI calls
- Used in classification step of observation capture pipeline

**Activity Logging** (search queries — eval dataset source):
- `apps/console/src/lib/v1/search.ts:164` — `recordSystemActivity()` fires after every search
- Records: query (first 200 chars), limit, offset, mode, hasFilters, resultCount, totalMatches, latencyMs, authType
- Stored in `workspaceUserActivities` table via Inngest batch insert

**Test Data Infrastructure**:
- `packages/console-test-data/` — datasets (`comprehensive.json` with 35 webhooks, `demo-incident.json`)
- `docs/examples/query-scenarios/query_scenarios.json` — 20 query scenarios with expected signals
- CLI injection tools that trigger Inngest workflows

**Planned But Unimplemented**:
- `thoughts/shared/plans/2026-02-05-search-api-evaluation-pipeline.md` — detailed package structure, metrics library, end-to-end runner
- `thoughts/shared/research/2026-02-05-search-api-evaluation-pipeline-golden-dataset-design.md` — dataset design, query distribution, environment architecture

### Existing Gaps (14 identified in codebase deep dive)

**Critical (blocking):**
1. No golden dataset — no query-document-relevance triples
2. No eval package — `packages/console-eval/` doesn't exist
3. No answer evaluation — zero faithfulness/citation/hallucination measurement
4. No feedback collection — no thumbs up/down, no click-through data

**Important (limiting iteration):**
5. No component-level evals (embedding, entity extraction, classification, rerank lift)
6. No A/B testing framework
7. No regression testing
8. No per-workspace calibration
9. No search path effectiveness logging (which of the 4 paths contributed to final results)

---

## External Capabilities

### Key Findings That Shape The Design

**1. Framework Selection: Braintrust as orchestration layer**
- Already partially integrated (middleware exists)
- TypeScript-native SDK (`braintrust` npm package) — matches monorepo language
- Native experiment comparison with statistical significance
- `Eval()` function + custom scorers covers all Lightfast metric needs
- Free tier: 50 evals/month; production: ~$0.01/eval
- CI/CD: `braintrust eval` CLI for GitHub Actions integration

**2. Golden Dataset: Quality > Quantity**
- 50 well-curated examples with multi-dimensional annotations outperform 1,000 noisy synthetic examples
- Statistical significance requires ~30+ examples per query type for paired bootstrap tests (power ≥ 0.8)
- Target: 50 × 6 query types = 300 total examples (Phase 5 target)
- Start with 50 (Phase 1 minimum viable)

**3. Metrics: Two-Tier Approach**
- **Tier 1 — Retrieval (deterministic, fast, cheap):** MRR, Recall@K, Precision@K, NDCG@K — pure math on result IDs
- **Tier 2 — RAG Quality (LLM-as-judge, slow, expensive):** Faithfulness, citation accuracy, answer relevancy, hallucination rate

**4. Regression Detection: Paired Bootstrap**
- Never compare single outputs; aggregate metrics over many examples
- Paired bootstrap test (same inputs, different systems) reduces variance
- Report: p-value, effect size (Cohen's d), 95% confidence intervals
- Decision: regression if delta < threshold AND p < 0.05

**5. CI/CD Progression: Informational → Warning → Block**
- Weeks 1–4: Informational only (establish baselines, calibrate thresholds)
- Month 2: Soft warnings for retrieval regressions > 5%
- Month 3+: Hard blocks for faithfulness < 0.7, recall@10 < 0.75

---

## Proposed Design

### Phase 1: Dataset Bootstrap (Cold Start)

**Goal:** Create 50 manually-curated evaluation cases from existing infrastructure and LLM generation.

**The cold-start problem:** Lightfast has no golden dataset. We can't wait for production traffic to build one — we need a usable dataset in days, not months.

**Strategy: 3 sources → merge → human validation**

#### Source A: Existing Query Scenarios (10–15 cases)
The file `docs/examples/query-scenarios/query_scenarios.json` contains 20 query scenarios with intents (incident_search, ownership, dependency, etc.) and expected signals. Convert these directly:

```typescript
// Convert existing scenarios to eval format
// Input: query_scenarios.json entry
{
  "query": "What broke in the checkout service last night?",
  "intent": "incident_search",
  "expectedSignals": ["vector", "entity", "cluster"]
}

// Output: EvalCase with ground truth
{
  "id": "scenario-incident-checkout",
  "query": "What broke in the checkout service last night?",
  "queryType": "temporal",
  "expectedObservationIds": ["obs_abc123", "obs_def456"], // from test data ingestion
  "complexity": "medium"
}
```

The conversion requires ingesting test data (`comprehensive.json`) into a dedicated eval workspace and mapping `sourceId → externalId` (as detailed in the existing plan).

#### Source B: LLM-Generated from Corpus (25–30 cases)
Use the existing test data corpus to generate diverse queries via Claude Haiku:

```typescript
// Prompt pattern for synthetic query generation
const GENERATION_PROMPT = `Given these engineering events from a workspace:
${JSON.stringify(events.slice(0, 10), null, 2)}

Generate 5 diverse search queries that a developer might ask.
For each query, list which events (by sourceId) should be returned.

Query types to cover: temporal, actor, technical, status, multi-hop, null

Output JSON array: [{ query, queryType, expectedSourceIds, complexity }]`;
```

Quality gate: A critic LLM (Claude Sonnet) reviews each generated pair and scores it 1–5 for query naturalness, relevance assignment correctness, and answer feasibility. Discard anything scoring < 3.

#### Source C: Manual Curation (5–10 cases)
Hand-craft edge cases that LLMs miss:
- Null queries (queries that should return nothing)
- Ambiguous queries (tests disambiguation)
- Cross-source queries (GitHub push linked to Linear issue)
- Time-boundary queries ("this week" vs "last week")

#### Output: Golden Dataset v1

```typescript
// packages/console-eval/src/datasets/golden-v1.json
{
  "version": "1.0.0",
  "createdAt": "2026-02-07",
  "cases": [
    {
      "id": "golden-001",
      "query": "What did Sarah work on last week?",
      "queryType": "actor",
      "expectedSourceIds": ["github:push:acme/platform:xyz789:test:0"],
      "complexity": "simple",
      "source": "manual",
      "annotator": "human",
      "notes": "Tests actor search path"
    }
    // ... 49 more
  ]
}
```

The dataset is stored in git (source of truth) and uploaded to Braintrust (for experiment tracking). Schema is additive-only: new fields can be added but existing fields never removed.

---

### Phase 2: Eval Harness

**Goal:** Build the core infrastructure to run evaluations reproducibly.

The eval harness has 3 components: **metrics library**, **eval runner**, and **scorers**.

#### Metrics Library (`packages/console-eval/src/metrics/`)

Pure TypeScript implementations with no external dependencies:

**Retrieval Metrics** (Tier 1 — deterministic, fast):
- `MRR` — Mean Reciprocal Rank: How quickly is the first relevant result found?
- `Recall@K` — What fraction of relevant observations appear in top K?
- `Precision@K` — What fraction of top K results are relevant?
- `NDCG@K` — Normalized Discounted Cumulative Gain: Ranking quality with position weighting

**RAG Quality Metrics** (Tier 2 — LLM-as-judge):
- `Faithfulness` — Is the answer grounded in retrieved context? (claim decomposition + entailment check)
- `CitationPrecision` — Do citations support the claims they're attached to?
- `CitationRecall` — Do all answer claims have supporting citations?
- `AnswerRelevancy` — Does the answer address the query?
- `HallucinationRate` — What fraction of claims lack context support?

**Custom Lightfast Metrics**:
- `TemporalAccuracy` — For time-based queries, are results from the correct time window?
- `ActorAttribution` — For actor queries, do results relate to the specified person?
- `PathContribution` — Which of the 4 search paths contributed to successful retrievals?

#### Eval Runner (`packages/console-eval/src/eval/`)

The runner orchestrates: **setup → execute → score → report**.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           EVAL RUNNER FLOW                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  1. SETUP                                                                     │
│     ├── Load golden dataset (git or Braintrust)                              │
│     ├── Check eval workspace exists + has API key                            │
│     ├── If !SKIP_INGESTION: inject test data via Inngest                     │
│     ├── Wait for ingestion (poll DB for sourceId → externalId mapping)       │
│     └── Build EvalCase[] with resolved externalIds                           │
│                                                                               │
│  2. EXECUTE (per case, parallelizable)                                       │
│     ├── Call /v1/search API with query + config                              │
│     ├── Record: result IDs, scores, ranks, latency, paths used              │
│     └── If answer eval: call /v1/answer API, record response + citations    │
│                                                                               │
│  3. SCORE (per case)                                                         │
│     ├── Tier 1: MRR, Recall@K, Precision@K, NDCG@K (pure math)            │
│     ├── Tier 2: Faithfulness, CitationAccuracy (LLM-as-judge)              │
│     └── Custom: TemporalAccuracy, ActorAttribution, PathContribution        │
│                                                                               │
│  4. REPORT                                                                    │
│     ├── Log to Braintrust experiment                                         │
│     ├── Compute aggregate metrics (mean, p50, p95, CI)                      │
│     ├── If comparison: run paired bootstrap test vs baseline                 │
│     └── Output: JSON report + console summary                                │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Parallelism:** The runner executes up to 5 eval cases concurrently (configurable). Retrieval-only evals (Tier 1) are embarrassingly parallel. RAG quality evals (Tier 2) are rate-limited by LLM API quotas.

**Reproducibility:** Each eval run is tagged with:
- Dataset version (git SHA of golden dataset file)
- Code version (git SHA of the branch)
- Config snapshot (search mode, model IDs, rerank config)
- Timestamp and random seed

#### Scorers (`packages/console-eval/src/scorers/`)

Braintrust-compatible scorer functions that wrap our metric implementations:

```typescript
// Scorer interface matching Braintrust's EvalScorerArgs
interface LightfastScorer {
  name: string;
  scorer: (args: {
    input: EvalInput;
    output: EvalOutput;
    expected: EvalExpected;
  }) => Promise<{ score: number; metadata?: Record<string, unknown> }>;
}
```

**LLM-as-Judge Implementation** (for Tier 2 metrics):

The faithfulness scorer uses Claude Haiku ($0.25/MTok input, $1.25/MTok output) for cost efficiency in CI, with an option to upgrade to Sonnet for nightly comprehensive evals:

```typescript
// Faithfulness scoring via claim decomposition
// Step 1: Decompose answer into atomic claims
// Step 2: For each claim, check if retrieved context entails it
// Step 3: Score = (supported claims) / (total claims)

// Model selection:
// CI: claude-haiku-4.5 (~$0.001/eval case)
// Nightly: claude-sonnet-4-5 (~$0.01/eval case)
const judgeModel = process.env.EVAL_JUDGE_MODEL ?? "anthropic/claude-haiku-4.5";
```

---

### Phase 3: Version Comparison & Regression Detection

**Goal:** Compare v1 → v2 with statistical rigor and detect regressions before they reach production.

#### Experiment Tracking

Every eval run creates a Braintrust experiment tagged with:
- `branch`: git branch name
- `commit`: git SHA
- `dataset_version`: golden dataset version
- `search_mode`: fast/balanced/thorough
- `timestamp`: ISO 8601

Braintrust's native experiment comparison provides:
- Side-by-side metric views
- Per-case drill-down (which queries improved/regressed)
- Aggregate delta with significance indicators

#### Statistical Comparison Engine

```typescript
interface ComparisonResult {
  metric: string;
  baseline: { mean: number; ci95: [number, number]; n: number };
  candidate: { mean: number; ci95: [number, number]; n: number };
  delta: number;                  // candidate.mean - baseline.mean
  deltaPercent: number;           // delta / baseline.mean * 100
  pValue: number;                 // paired bootstrap test
  effectSize: number;             // Cohen's d
  isRegression: boolean;          // delta < threshold AND p < 0.05
  isImprovement: boolean;         // delta > 0 AND p < 0.05
  isStatisticallySignificant: boolean; // p < 0.05
}
```

**Paired Bootstrap Test** (recommended by external research for LLM eval):

```typescript
function pairedBootstrapTest(
  baselineScores: number[],
  candidateScores: number[],
  numBootstrap: number = 10000,
  alpha: number = 0.05
): { pValue: number; ci95: [number, number] } {
  // 1. Compute observed delta
  const observedDelta = mean(candidateScores) - mean(baselineScores);

  // 2. Bootstrap: resample paired differences with replacement
  const deltas: number[] = [];
  for (let b = 0; b < numBootstrap; b++) {
    const sampledDeltas = bootstrapResample(
      candidateScores.map((c, i) => c - baselineScores[i])
    );
    deltas.push(mean(sampledDeltas));
  }

  // 3. p-value: fraction of bootstrap deltas <= 0 (one-tailed)
  const pValue = deltas.filter(d => d <= 0).length / numBootstrap;

  // 4. Confidence interval
  deltas.sort((a, b) => a - b);
  const ci95: [number, number] = [
    deltas[Math.floor(numBootstrap * 0.025)],
    deltas[Math.floor(numBootstrap * 0.975)]
  ];

  return { pValue, ci95 };
}
```

#### Regression Thresholds

Based on external research recommendations and calibrated for Lightfast:

```typescript
const REGRESSION_THRESHOLDS = {
  // Tier 1: Retrieval — allow max 5% drop
  "mrr": -0.05,
  "recall@5": -0.05,
  "recall@10": -0.05,
  "precision@5": -0.05,
  "precision@10": -0.05,
  "ndcg@5": -0.05,
  "ndcg@10": -0.05,

  // Tier 2: RAG Quality — stricter, 3% max drop
  "faithfulness": -0.03,
  "citation_precision": -0.03,
  "citation_recall": -0.05,
  "answer_relevancy": -0.05,
  "hallucination_rate": 0.02, // positive = worse

  // Latency — allow max 100ms increase at p95
  "latency_p95_ms": 100,
} as const;
```

These thresholds start as informational-only and graduate to enforcement gates after a 2–4 week calibration period where we observe metric variance and false positive rates.

---

### Phase 4: CI/CD Quality Gates

**Goal:** Prevent quality regressions from reaching production.

#### GitHub Actions Workflow

```yaml
# .github/workflows/ai-eval.yml
name: AI Quality Gate

on:
  pull_request:
    paths:
      - 'apps/console/src/lib/neural/**'
      - 'apps/console/src/lib/v1/**'
      - 'apps/console/src/ai/**'
      - 'packages/console-rerank/**'
      - 'packages/console-embed/**'
      - 'packages/console-eval/**'
      - 'packages/console-ai/**'
      - 'api/console/src/inngest/workflow/neural/**'

jobs:
  ai-eval:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run retrieval evaluation
        run: pnpm --filter @repo/console-eval eval:retrieval
        env:
          EVAL_SKIP_INGESTION: true
          EVAL_MODE: ci  # Uses subset dataset, Haiku judge
          BRAINTRUST_API_KEY: ${{ secrets.BRAINTRUST_API_KEY }}
          EVAL_WORKSPACE_ID: ${{ secrets.EVAL_WORKSPACE_ID }}
          EVAL_API_KEY: ${{ secrets.EVAL_API_KEY }}
          CONSOLE_API_URL: ${{ secrets.EVAL_CONSOLE_API_URL }}

      - name: Compare with baseline
        run: pnpm --filter @repo/console-eval eval:compare \
          --baseline=main --candidate=${{ github.sha }}

      - name: Post results to PR
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(
              fs.readFileSync('packages/console-eval/eval-report.json', 'utf8')
            );
            // Format and post as PR comment
```

#### Cost Optimization for CI

Running full evals in CI is expensive. Strategy:

| Context | Dataset Size | Metrics | Judge Model | Est. Cost/Run |
|---------|-------------|---------|-------------|---------------|
| **PR (CI)** | 30 cases (subset) | Tier 1 only | N/A | ~$0 (no LLM calls) |
| **Nightly** | Full 300 cases | Tier 1 + Tier 2 | Haiku | ~$2–5 |
| **Weekly comprehensive** | Full 300 cases | All metrics | Sonnet | ~$15–30 |
| **Pre-release** | Full 300 cases × 3 runs | All metrics | Sonnet | ~$50–90 |

**Key insight:** Retrieval metrics (Tier 1) are pure math — zero LLM cost. CI gate should use Tier 1 only. This makes CI eval essentially free, needing only the search API call per case.

#### Gate Progression

```
Week 1–4:    INFORMATIONAL  — Results posted as PR comment, no blocking
Month 2:     SOFT WARNING   — Retrieval regressions > 5% show ⚠️ warning
Month 3+:    HARD BLOCK     — faithfulness < 0.7 OR recall@10 < 0.75 blocks merge
```

---

### Phase 5: Production Feedback Loop

**Goal:** Close the loop: production data feeds back into eval dataset improvement.

#### User Feedback Collection

Add binary feedback (thumbs up/down) to the answer interface. This requires:

1. **API endpoint**: New tRPC procedure in `userRouter` for submitting feedback
2. **DB schema**: New `workspaceAnswerFeedback` table
3. **UI component**: Thumbs up/down buttons on answer responses

```typescript
// New schema: db/console/src/schema/tables/workspace-answer-feedback.ts
// Fields: id, workspaceId, sessionId, query, answerHash, feedbackType (positive/negative),
//         feedbackText (optional), retrievedObservationIds, createdAt
```

#### Production Sampling (5% of queries)

Run LLM-as-judge faithfulness scoring on 5% of production answer queries:

```typescript
// New Inngest workflow: api/console/src/inngest/workflow/eval/production-sampling.ts
// Event: apps-console/eval/sample.answer
// Trigger: probabilistic sampling after answer generation
// Action: Run faithfulness + citation accuracy scorers
// Store: workspaceEvalSamples table
```

This creates a continuous quality signal without manual effort.

#### Dataset Evolution

Monthly process to update the golden dataset:

1. **Mine production queries**: Extract queries from `workspaceUserActivities` where `category = 'search'`
2. **Mine feedback**: Add negatively-rated answers as eval cases (they expose weaknesses)
3. **Synthetic augmentation**: Generate new cases for underrepresented query types
4. **Human review**: Validate 20% of new additions manually
5. **Version bump**: Create `golden-v{N+1}.json` with changelog

#### Drift Detection

Monitor for systematic quality changes over time:

- **Query distribution drift**: Compare current week's query embedding centroids vs historical
- **Retrieval score drift**: Track mean relevance scores over time (via sampled production evals)
- **Answer quality drift**: Track faithfulness scores from production sampling

Alerts fire when any metric degrades > 10% from the 30-day rolling average.

---

### Interfaces & Contracts

#### Core Types

```typescript
// packages/console-eval/src/types.ts

// --- Dataset Types ---

export interface EvalDataset {
  version: string;           // Semver
  createdAt: string;         // ISO 8601
  description: string;
  cases: EvalCase[];
}

export interface EvalCase {
  id: string;                // Unique case identifier
  query: string;
  queryType: QueryType;
  expectedObservationIds: string[];  // Ground truth (externalIds after ingestion)
  expectedSourceIds: string[];       // Ground truth (sourceIds before ingestion)
  gradedRelevance?: Record<string, number>; // observationId → 0-3 relevance
  expectedAnswer?: string;           // For answer quality eval
  requiredCitations?: string[];      // Observation IDs that must be cited
  requiredEntities?: string[];       // Entities that must appear in answer
  complexity: "simple" | "medium" | "complex";
  source: "manual" | "synthetic" | "production" | "scenario";
  notes?: string;
}

export type QueryType =
  | "temporal"    // Time-based queries
  | "actor"       // Person-based queries
  | "technical"   // Technical topic queries
  | "status"      // Status/state queries
  | "multi-hop"   // Queries requiring multiple retrieval steps
  | "null";       // Queries that should return nothing

// --- Metric Types ---

export interface RetrievalResult {
  id: string;     // Observation externalId
  score: number;  // Relevance score (0-1)
  rank: number;   // Position (1-indexed)
}

export interface RetrievalMetrics {
  mrr: number;
  recallAtK: Record<number, number>;   // K → score
  precisionAtK: Record<number, number>;
  ndcgAtK: Record<number, number>;
  totalRelevant: number;
  totalRetrieved: number;
}

export interface RAGQualityMetrics {
  faithfulness: number;       // 0-1: answer grounded in context
  citationPrecision: number;  // 0-1: citations support their claims
  citationRecall: number;     // 0-1: claims have supporting citations
  answerRelevancy: number;    // 0-1: answer addresses query
  hallucinationRate: number;  // 0-1: fraction of unsupported claims
}

// --- Comparison Types ---

export interface ComparisonResult {
  metric: string;
  baseline: MetricSummary;
  candidate: MetricSummary;
  delta: number;
  deltaPercent: number;
  pValue: number;
  effectSize: number;       // Cohen's d
  isRegression: boolean;
  isImprovement: boolean;
  isStatisticallySignificant: boolean;
}

export interface MetricSummary {
  mean: number;
  median: number;
  p95: number;
  ci95: [number, number];
  n: number;
}

// --- Eval Run Types ---

export interface EvalRunConfig {
  datasetVersion: string;
  codeVersion: string;       // git SHA
  branch: string;
  searchMode: "fast" | "balanced" | "thorough";
  tier: "retrieval" | "rag" | "full";
  judgeModel?: string;       // Model for LLM-as-judge
  maxConcurrency: number;
  braintrustProject: string;
  experimentName: string;
}

export interface EvalRunResult {
  config: EvalRunConfig;
  metrics: {
    retrieval: RetrievalMetrics;
    rag?: RAGQualityMetrics;
  };
  perCase: Array<{
    caseId: string;
    retrieval: RetrievalMetrics;
    rag?: RAGQualityMetrics;
    latencyMs: number;
    searchPaths: { vector: boolean; entity: boolean; cluster: boolean; actor: boolean };
  }>;
  comparison?: ComparisonResult[];
  braintrustExperimentUrl: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}
```

#### API Contracts

```typescript
// New tRPC procedures for eval management

// packages/console-eval/src/api/eval-router.ts
// Registered in the userRouter (no org required — eval is developer tooling)

export const evalRouter = router({
  // List eval runs for a workspace
  listRuns: protectedProcedure
    .input(z.object({ workspaceId: z.string(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => { /* ... */ }),

  // Get eval run details
  getRun: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ ctx, input }) => { /* ... */ }),

  // Compare two eval runs
  compare: protectedProcedure
    .input(z.object({ baselineRunId: z.string(), candidateRunId: z.string() }))
    .query(async ({ ctx, input }) => { /* ... */ }),

  // Submit answer feedback (for production feedback loop)
  submitFeedback: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      sessionId: z.string(),
      query: z.string(),
      feedbackType: z.enum(["positive", "negative"]),
      feedbackText: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),
});
```

---

### File/Package Structure

```
packages/console-eval/                       # NEW PACKAGE
├── package.json                             # @repo/console-eval
├── tsconfig.json
├── src/
│   ├── index.ts                             # Package entry point
│   │
│   ├── config/
│   │   └── env.ts                           # Eval environment config (t3-env)
│   │
│   ├── datasets/
│   │   ├── golden-v1.json                   # Initial golden dataset (50 cases)
│   │   └── schema.ts                        # Dataset schema + validation
│   │
│   ├── metrics/
│   │   ├── index.ts
│   │   ├── types.ts                         # Metric interfaces
│   │   ├── retrieval.ts                     # MRR, NDCG, Recall, Precision
│   │   ├── rag-quality.ts                   # Faithfulness, citation, hallucination
│   │   ├── custom.ts                        # Temporal, actor, path-contribution
│   │   └── statistics.ts                    # Bootstrap test, CI, Cohen's d
│   │
│   ├── scorers/
│   │   ├── index.ts
│   │   ├── retrieval-scorers.ts             # Braintrust-compatible retrieval scorers
│   │   ├── rag-scorers.ts                   # LLM-as-judge scorers
│   │   └── custom-scorers.ts               # Lightfast-specific scorers
│   │
│   ├── e2e/
│   │   ├── index.ts
│   │   ├── search-client.ts                 # HTTP client for /v1/search
│   │   ├── answer-client.ts                 # HTTP client for /v1/answer
│   │   ├── ingestion.ts                     # Test data injection + wait
│   │   └── ground-truth.ts                  # sourceId → externalId mapping
│   │
│   ├── eval/
│   │   ├── e2e-retrieval.eval.ts            # End-to-end retrieval eval
│   │   ├── e2e-answer.eval.ts               # End-to-end answer quality eval
│   │   └── compare.ts                       # Experiment comparison + reporting
│   │
│   ├── generation/
│   │   ├── synthetic-generator.ts           # LLM-based query generation
│   │   ├── production-miner.ts              # Mine queries from activity logs
│   │   └── critic.ts                        # Quality filtering for generated cases
│   │
│   └── cli/
│       ├── setup.ts                         # Eval workspace setup
│       ├── run.ts                           # CLI eval runner
│       └── generate.ts                      # Dataset generation CLI

db/console/src/schema/tables/
├── workspace-eval-runs.ts                   # NEW: Eval run tracking
├── workspace-eval-results.ts                # NEW: Per-case eval results
└── workspace-answer-feedback.ts             # NEW: User feedback on answers

api/console/src/inngest/workflow/eval/
├── production-sampling.ts                   # NEW: 5% production answer sampling
└── nightly-eval.ts                          # NEW: Scheduled nightly full eval

.github/workflows/
└── ai-eval.yml                              # NEW: CI quality gate
```

**Package Dependencies:**

```json
{
  "name": "@repo/console-eval",
  "dependencies": {
    "@repo/console-types": "workspace:*",
    "@repo/console-config": "workspace:*",
    "@repo/console-test-data": "workspace:*",
    "@vendor/observability": "workspace:*",
    "braintrust": "catalog:",
    "ai": "catalog:",
    "@ai-sdk/gateway": "catalog:",
    "zod": "catalog:zod3"
  }
}
```

Note: The package does **not** depend on `@db/console` or `@api/console` directly. The eval runner calls the search/answer APIs over HTTP (same as a real client). Database access is only needed for the ground truth mapping step (sourceId → externalId), which can be handled via a setup script or tRPC procedure.

---

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          EVAL PIPELINE DATA FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ DATASET CREATION (one-time + periodic updates)                           │   │
│  │                                                                           │   │
│  │  Query Scenarios ──┐                                                      │   │
│  │  (20 scenarios)    │                                                      │   │
│  │                    ├──→ Merge ──→ Critic LLM ──→ Human Review ──→ golden-v1.json
│  │  LLM Generation ──┤     │            │              │                     │   │
│  │  (from corpus)     │     │        Reject <3          │                    │   │
│  │                    │     │                            │                    │   │
│  │  Manual Curation ──┘     │                            │                    │   │
│  │                          │                            │                    │   │
│  │  Production Mining ──────┘  (Phase 5: monthly)       │                    │   │
│  │  (activity logs)                                      │                    │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ EVAL EXECUTION (per run)                                                  │   │
│  │                                                                           │   │
│  │  golden-v1.json                                                           │   │
│  │       │                                                                   │   │
│  │       ▼                                                                   │   │
│  │  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐                │   │
│  │  │ Load Cases  │───→│ Resolve IDs  │───→│ Execute      │                │   │
│  │  │ (50-300)    │    │ (source→ext) │    │ (API calls)  │                │   │
│  │  └─────────────┘    └──────────────┘    └──────┬───────┘                │   │
│  │                                                  │                       │   │
│  │                                   ┌──────────────┼──────────────┐        │   │
│  │                                   ▼              ▼              ▼        │   │
│  │                            /v1/search     /v1/answer    (latency)       │   │
│  │                                   │              │              │        │   │
│  │                                   ▼              ▼              ▼        │   │
│  │                           ┌──────────────────────────────────────┐       │   │
│  │                           │ SCORE                                │       │   │
│  │                           │ Tier 1: MRR, Recall, Precision, NDCG│       │   │
│  │                           │ Tier 2: Faithfulness, Citations      │       │   │
│  │                           │ Custom: Temporal, Actor, Paths       │       │   │
│  │                           └──────────────┬───────────────────────┘       │   │
│  │                                          │                               │   │
│  │                                          ▼                               │   │
│  │                           ┌──────────────────────────────────────┐       │   │
│  │                           │ REPORT                               │       │   │
│  │                           │ → Braintrust experiment               │       │   │
│  │                           │ → JSON report file                    │       │   │
│  │                           │ → PR comment (if CI)                  │       │   │
│  │                           │ → Comparison vs baseline (if exists)  │       │   │
│  │                           └──────────────────────────────────────┘       │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ PRODUCTION FEEDBACK (continuous)                                          │   │
│  │                                                                           │   │
│  │  User thumbs ──→ workspaceAnswerFeedback ──→ Monthly mining ──→ Dataset  │   │
│  │  up/down                                                          update │   │
│  │                                                                           │   │
│  │  5% sampling ──→ LLM-as-judge scoring ──→ workspaceEvalSamples          │   │
│  │  (Inngest)       (faithfulness, citations)    → Drift alerts             │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Metrics Framework

#### What to Measure and When

| Metric | Tier | CI Gate | Nightly | Production | Target |
|--------|------|---------|---------|------------|--------|
| MRR | 1 | Yes | Yes | No | ≥ 0.80 |
| Recall@5 | 1 | Yes | Yes | No | ≥ 0.75 |
| Recall@10 | 1 | Yes | Yes | No | ≥ 0.85 |
| Precision@5 | 1 | Yes | Yes | No | ≥ 0.70 |
| Precision@10 | 1 | Yes | Yes | No | ≥ 0.60 |
| NDCG@5 | 1 | Yes | Yes | No | ≥ 0.75 |
| NDCG@10 | 1 | Yes | Yes | No | ≥ 0.75 |
| Faithfulness | 2 | No | Yes | 5% sample | ≥ 0.70 |
| Citation Precision | 2 | No | Yes | 5% sample | ≥ 0.95 |
| Citation Recall | 2 | No | Yes | No | ≥ 0.90 |
| Answer Relevancy | 2 | No | Yes | No | ≥ 0.80 |
| Hallucination Rate | 2 | No | Yes | 5% sample | ≤ 0.05 |
| Temporal Accuracy | Custom | No | Yes | No | ≥ 0.85 |
| Actor Attribution | Custom | No | Yes | No | ≥ 0.90 |
| Search P50 Latency | Perf | Yes | Yes | Yes | < 200ms |
| Search P95 Latency | Perf | Yes | Yes | Yes | < 500ms |

**Target values** are aspirational starting points based on external research benchmarks. They will be calibrated during the informational phase (Weeks 1–4) based on actual baseline performance. If baseline MRR is 0.6, the initial regression threshold is set to 0.55 (5% drop), not 0.80.

---

## Integration with Existing Systems

### Search API Integration
The eval runner calls `/v1/search` and `/v1/answer` over HTTP using the same API key authentication (`Bearer token + X-Workspace-ID header`) as external clients. This tests the complete production code path including auth, parsing, 4-path search, reranking, and response formatting. No mocking.

### Inngest Integration
- **Ingestion**: Eval setup triggers `apps-console/neural/observation.capture` events to inject test data through the real pipeline
- **Production Sampling**: New `apps-console/eval/sample.answer` event triggers LLM-as-judge scoring on 5% of production answers
- **Nightly Eval**: New `apps-console/eval/nightly.run` scheduled event runs the full eval suite

### Database Integration
New tables follow existing conventions (BIGINT auto-gen PK, workspace scoping, timestamp columns, proper indexes):
- `workspace_eval_runs` — tracks eval run metadata and aggregate results
- `workspace_eval_results` — per-case results for drill-down
- `workspace_answer_feedback` — user feedback on answers

### Braintrust Integration
Extends the existing `BraintrustMiddleware` tracing to include evaluation experiments:
- Tracing (existing): `createTracedModel()` in `ai-helpers.ts`
- Evaluation (new): `Eval()` function in eval runner with custom scorers
- Both use the same `BRAINTRUST_API_KEY` and project configuration

### Configuration Integration
Eval config follows the `packages/console-config/` pattern:
- Constants in `packages/console-eval/src/config/`
- Environment via `@t3-oss/env-core` (same pattern as existing env configs)
- Regression thresholds are code-defined constants (not env vars) for versioning

---

## Cold Start Strategy

### Detailed Plan for Bootstrapping from Zero

**Week 1: Setup + First 20 Cases**
1. Create `packages/console-eval/` with package structure, metrics library, and search client
2. Set up dedicated eval workspace with API key
3. Inject `comprehensive.json` (35 webhooks) into eval workspace
4. Map `sourceId → externalId` for all 35 observations
5. Convert 10 query scenarios from `docs/examples/query-scenarios/query_scenarios.json`
6. Hand-craft 10 additional cases (actor, temporal, null)
7. Run first Braintrust experiment — **establish baseline**

**Week 2: Expand to 50 Cases**
1. Generate 20 synthetic query-document pairs from corpus using Claude Haiku
2. Filter with critic LLM (Sonnet) — keep quality ≥ 3/5
3. Add 10 cases for underrepresented query types
4. Human review all 50 cases (this is a one-time ~2 hour investment)
5. Create `golden-v1.json` and commit to git
6. Run full eval with all Tier 1 metrics
7. Document baseline: per-query-type breakdown, weakest areas

**Weeks 3–4: Answer Quality + 100 Cases**
1. Implement faithfulness and citation scorers (LLM-as-judge)
2. Generate 50 more cases, expanding multi-hop and cross-source coverage
3. Run Tier 1 + Tier 2 eval (nightly batch)
4. Calibrate regression thresholds based on observed variance

**Month 2+: CI Gate + 200 Cases**
1. Set up GitHub Actions workflow (Tier 1 only for CI)
2. Mine production queries from `workspaceUserActivities`
3. Add user feedback collection (thumbs up/down)
4. Graduate from informational to soft warning gates

**Month 3+: Full Pipeline + 300 Cases**
1. Production sampling (5% of answers)
2. Drift detection
3. Hard quality gates on core metrics
4. Component-level evals (embedding quality, rerank lift)

---

## Open Questions

### Design Decisions Needing User Input

1. **Eval Workspace Strategy**: Should we use a dedicated eval workspace (isolated, clean, but requires test data injection) or run evals against a production workspace copy (realistic data, but potential contamination)?

   **Recommendation**: Dedicated eval workspace. The existing plan already designs for this, and it provides full control over the test corpus. Production data can be periodically imported for realism.

2. **Braintrust Commitment Level**: Should we go all-in on Braintrust for experiment tracking, or build a lightweight local alternative (JSON files + git) to avoid vendor dependency?

   **Recommendation**: Start with Braintrust (faster time to value, already integrated). If cost or lock-in becomes a concern, the eval runner is designed with pluggable reporters — swapping Braintrust for a local reporter is a 1-day change.

3. **Answer Eval Scope**: Should Phase 2 include answer quality evaluation (faithfulness, citations), or defer all Tier 2 metrics to Phase 3+ to ship the retrieval baseline faster?

   **Recommendation**: Ship retrieval-only (Tier 1) in Phase 1, add answer quality in Phase 2. The retrieval baseline provides immediate value for catching regressions, and Tier 1 metrics are free (no LLM calls).

4. **Dataset Location**: Should the golden dataset live in `packages/console-eval/src/datasets/` (colocated with code) or `packages/console-test-data/datasets/eval/` (colocated with test data)?

   **Recommendation**: `packages/console-eval/src/datasets/`. The eval package owns its dataset — this makes versioning, CI paths, and package exports cleaner. Test data (raw webhooks) stays in `console-test-data`; eval data (query-document-relevance triples) lives in `console-eval`.

5. **Feedback Collection Priority**: Should user feedback collection (thumbs up/down) be part of this eval pipeline work, or is it a separate product feature?

   **Recommendation**: Defer to Phase 5. The eval pipeline delivers value without user feedback. Feedback collection is a product feature that happens to feed the eval dataset — it should be prioritized independently.

6. **Multi-Workspace Eval**: Should the eval pipeline support running evals across multiple workspaces with different corpus characteristics, or is a single eval workspace sufficient?

   **Recommendation**: Start with single eval workspace. Multi-workspace eval is a Phase 5+ concern for testing per-workspace calibration. The architecture supports it (workspace ID is parameterized throughout) but we shouldn't build for it now.

7. **LLM-as-Judge Consistency**: LLM judges have inherent variance. Should we run each LLM-as-judge scoring 2–3 times and average, or accept single-run scores?

   **Recommendation**: Single run for CI/nightly (cost efficiency). For pre-release comprehensive eval, run 3 times and average. The paired bootstrap test already accounts for variance in aggregate.
