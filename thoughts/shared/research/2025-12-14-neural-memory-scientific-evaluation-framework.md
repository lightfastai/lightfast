---
date: 2025-12-14T02:16:17Z
researcher: Claude
git_commit: ca81c4294e8e8ef8d2e0ced73848d0172a82ec1f
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Scientific Evaluation Framework for Neural Memory System"
tags: [research, neural-memory, rag-evaluation, metrics, dataset-generation, benchmarking]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
---

# Research: Scientific Evaluation Framework for Neural Memory System

**Date**: 2025-12-14T02:16:17Z
**Researcher**: Claude
**Git Commit**: ca81c4294e8e8ef8d2e0ced73848d0172a82ec1f
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

How can we scientifically evaluate Lightfast's neural memory system? Specifically:
1. What metrics/values should be tracked over time?
2. What would a research paper structure look like for evaluating RAG/search?
3. What should the dataset generation pipeline look like?
4. How much synthetic vs. real data should be used?

## Summary

Lightfast's neural memory evaluation requires a **three-layer measurement framework**:

1. **Pipeline Metrics** (Ingestion) - Throughput, latency, significance scoring accuracy, entity extraction F1
2. **Retrieval Metrics** (Search) - MRR, NDCG@K, Recall@K, Precision@K for the 2-key retrieval governor
3. **RAG Triad Metrics** (Output) - Faithfulness, Context Relevance, Answer Relevance

The dataset should be a **hybrid of synthetic (60-70%) and real GitHub data (30-40%)**, starting with 100 examples and scaling to 200+ for production benchmarks. Ragas framework with Braintrust integration is the recommended tooling approach given existing infrastructure.

---

## Detailed Findings

### 1. Metrics Framework for Neural Memory

Based on the E2E design (`docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md`) and industry RAG evaluation standards, here's the recommended metrics taxonomy:

#### A. Ingestion Pipeline Metrics (Write Path)

| Metric | Description | Target | Measurement Method |
|--------|-------------|--------|-------------------|
| **Throughput** | Events processed per minute | ≥100/min | Inngest workflow completion rate |
| **Capture Latency (p95)** | Time from webhook to observation stored | <500ms | Step timing in `observation-capture` |
| **Significance Scoring Accuracy** | True positive rate for score ≥60 threshold | ≥85% | Manual labeling of 50-100 events |
| **Classification Accuracy** | Observation type & topic correctness | ≥90% | Ground truth comparison |
| **Entity Extraction F1** | Precision × Recall for extracted entities | ≥0.75 | Pattern-based + LLM extraction comparison |
| **Multi-View Embedding Coverage** | % observations with all 3 embeddings | 100% | Database audit (already in verifier.ts) |
| **Cluster Assignment Rate** | % observations assigned to clusters | ≥80% | Database audit |

**Current Measurement Points** (from `packages/console-test-data/src/verifier/verifier.ts`):
- Observation count by type
- Entity count by category
- Cluster count
- Actor profile count
- Pinecone vector counts (title/content/summary)
- Multi-view completeness health check

#### B. Retrieval Governor Metrics (Read Path - Key 1 + Key 2)

**Key 1: Vector Search Metrics**

| Metric | Formula | Description | Target |
|--------|---------|-------------|--------|
| **Recall@K** | \|Relevant ∩ Top K\| / \|Relevant\| | Did we find all relevant docs? | ≥0.85 @ K=10 |
| **Precision@K** | \|Relevant ∩ Top K\| / K | Are returned docs relevant? | ≥0.70 @ K=10 |
| **NDCG@K** | DCG@K / IDCG@K | Ranking quality with graded relevance | ≥0.75 @ K=10 |
| **MRR** | 1/\|Q\| × Σ(1/rank_i) | How quickly is first relevant doc found? | ≥0.80 |
| **MAP@K** | Mean(AP_q) across queries | Overall retrieval precision | ≥0.70 |

**Key 2: LLM Gating Metrics**

| Metric | Description | Target |
|--------|-------------|--------|
| **LLM Filter Precision** | % of filtered candidates that are truly relevant | ≥0.90 |
| **LLM Filter Recall** | % of relevant candidates retained after filtering | ≥0.85 |
| **Gating Latency (p95)** | LLM relevance filtering time | <300ms |
| **False Positive Reduction** | % of vector search false positives removed | ≥50% |

**Retrieval Latency Breakdown** (from design doc targets):
- Vector search (Key 1): <50ms
- LLM gating (Key 2): <300ms
- Entity lookup: <20ms
- Total search (hybrid): <500ms

#### C. RAG Triad Metrics (Output Quality)

| Metric | Definition | Target | Evaluation Method |
|--------|------------|--------|-------------------|
| **Faithfulness** | Claims in answer supported by retrieved context | ≥0.70 | RAGAS `faithfulness` scorer |
| **Context Relevance** | Retrieved docs match query scope (temporal, actor) | ≥0.75 | RAGAS `context_precision` |
| **Answer Relevance** | Response addresses user's actual question | ≥0.80 | RAGAS `answer_relevancy` |
| **Answer Correctness** | Semantic similarity to ground truth answer | ≥0.70 | Embedding similarity / LLM judge |

**Engineering Team Memory-Specific Additions**:

| Metric | Description | Target |
|--------|-------------|--------|
| **Temporal Accuracy** | Time references in answer match query window | ≥0.85 |
| **Actor Attribution Accuracy** | Correct actor attribution in responses | ≥0.90 |
| **Entity Recall** | Relevant entities from Entity Store included | ≥0.80 |

---

### 2. Research Paper Structure

For publishing or internal documentation, here's the recommended structure:

```
TITLE: Lightfast Neural Memory: Evaluating High-Precision Retrieval
        for Engineering Team Memory Systems

1. ABSTRACT
   - Problem: Engineering teams need temporal, actor-aware memory
   - Approach: 2-key retrieval (vector search + LLM gating)
   - Results: Key metrics (e.g., "0.87 MRR, 0.73 faithfulness")

2. INTRODUCTION
   - Engineering memory challenge (vs. static document search)
   - Research questions:
     * RQ1: Can 2-key retrieval improve precision without sacrificing recall?
     * RQ2: How does significance filtering affect observation quality?
     * RQ3: What entity extraction approach yields highest F1?

3. RELATED WORK
   - RAG systems (RETRO, Atlas, REALM)
   - Engineering knowledge management (Stack Overflow, GitHub Copilot)
   - LLM-as-Judge evaluation (TruLens, Ragas benchmarks)
   - Temporal RAG (STAR-RAG, MRAG frameworks)

4. SYSTEM ARCHITECTURE
   - Write path: Source Event → Significance → Classifier → Extractor → Storage
   - Read path: Query → Router → Vector Search → LLM Gating → Fusion
   - (Include system diagram from design doc)

5. DATASET
   - 5.1 Dataset Construction
     * Synthetic generation methodology (Ragas TestsetGenerator)
     * Real GitHub data integration (PRs, issues, commits)
     * Ground truth annotation process
   - 5.2 Dataset Statistics
     * Total examples, query type distribution
     * Source distribution (GitHub events by type)
   - 5.3 Evaluation Splits
     * Train/validation/test methodology
     * Temporal vs. random splits

6. EXPERIMENTAL SETUP
   - 6.1 Evaluation Framework (Braintrust + Ragas integration)
   - 6.2 Baselines
     * Vanilla vector search (no LLM gating)
     * BM25 keyword search
     * Single embedding (vs. multi-view)
   - 6.3 Metrics (refer to Section 1 above)
   - 6.4 Models
     * Embedding: text-embedding-3-large
     * LLM Judge: claude-3-5-haiku (speed) / claude-3-5-sonnet (quality)
     * Generation: Model under test

7. RESULTS
   - 7.1 Ingestion Pipeline Quality
     * Significance scoring distribution
     * Entity extraction F1 by category
   - 7.2 Retrieval Performance
     * Key 1 vs. Key 1+2 comparison
     * NDCG@K curves
   - 7.3 End-to-End RAG Quality
     * RAG Triad metrics
     * Temporal query performance
   - 7.4 Ablation Studies
     * Impact of multi-view embeddings
     * Significance threshold sensitivity

8. ANALYSIS & DISCUSSION
   - Query type performance breakdown
   - Failure case analysis
   - Latency vs. quality tradeoffs

9. CONCLUSION & FUTURE WORK
   - Key findings
   - Limitations
   - Future: Cluster summaries, actor profiles, cross-source linking

APPENDIX
   - A: Full dataset schema
   - B: Prompt templates for LLM evaluation
   - C: Statistical significance tests
```

---

### 3. Dataset Generation Pipeline

#### A. Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     EVALUATION DATASET PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE 1: CORPUS GENERATION                                                  │
│  ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐   │
│  │   Real GitHub      │   │   Synthetic        │   │   Scenario-Based   │   │
│  │   Webhooks         │   │   Event Generator  │   │   Templates        │   │
│  │   (30-40%)         │   │   (40-50%)         │   │   (20%)            │   │
│  └────────┬───────────┘   └────────┬───────────┘   └────────┬───────────┘   │
│           │                        │                        │               │
│           └────────────────────────┼────────────────────────┘               │
│                                    ▼                                        │
│                     ┌──────────────────────────┐                            │
│                     │   SourceEvent Corpus     │                            │
│                     │   (Transformed via       │                            │
│                     │   production transformers)│                            │
│                     └────────────┬─────────────┘                            │
│                                  │                                          │
│  PHASE 2: Q&A GENERATION        ▼                                          │
│                     ┌──────────────────────────┐                            │
│                     │   Ragas TestsetGenerator │                            │
│                     │   - Simple (50%)         │                            │
│                     │   - Multi-context (30%)  │                            │
│                     │   - Reasoning (20%)      │                            │
│                     └────────────┬─────────────┘                            │
│                                  │                                          │
│  PHASE 3: QUALITY FILTERING      ▼                                          │
│                     ┌──────────────────────────┐                            │
│                     │   Quality Gates          │                            │
│                     │   - Critic LLM review    │                            │
│                     │   - "I don't know" filter│                            │
│                     │   - Human spot-check 20% │                            │
│                     └────────────┬─────────────┘                            │
│                                  │                                          │
│  PHASE 4: GROUND TRUTH          ▼                                          │
│                     ┌──────────────────────────┐                            │
│                     │   Ground Truth Annotation│                            │
│                     │   - Expected docs (auto) │                            │
│                     │   - Expected answer (LLM)│                            │
│                     │   - Human review (10%)   │                            │
│                     └────────────┬─────────────┘                            │
│                                  │                                          │
│                                  ▼                                          │
│                     ┌──────────────────────────┐                            │
│                     │   eval_dataset.json      │                            │
│                     │   - query                │                            │
│                     │   - retrieval_gt         │                            │
│                     │   - generation_gt        │                            │
│                     │   - metadata             │                            │
│                     └──────────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### B. Dataset Schema

```typescript
interface NeuralMemoryEvalCase {
  // Identification
  id: string;                    // "eval-001"

  // Query
  query: string;                 // "What did Sarah work on last week?"
  queryType: QueryType;          // "temporal" | "actor" | "technical" | "status" | "multi-hop"

  // Ground Truth - Retrieval
  expectedObservations: string[];  // ["obs_abc123", "obs_def456"]
  minRelevantDocs: number;         // Minimum docs needed (for recall@K)

  // Ground Truth - Generation
  expectedAnswer: string;          // Full expected response
  requiredEntities: string[];      // ["Sarah", "auth-system", "PR #123"]
  requiredTimeframe?: string;      // "2024-01-08 to 2024-01-14"

  // Metadata
  complexity: "simple" | "medium" | "complex";
  numHops: number;                 // 1 for simple, 2-4 for multi-hop
  sourceType: "synthetic" | "real" | "template";

  // Evaluation Config
  topK: number;                    // K value for retrieval metrics
}

type QueryType =
  | "temporal"    // "What happened last week?"
  | "actor"       // "What did Sarah work on?"
  | "technical"   // "How does auth work?"
  | "status"      // "What's the status of X?"
  | "multi-hop"   // Requires multiple doc synthesis
  | "null";       // No answer exists (tests precision)
```

#### C. Query Type Distribution

Based on engineering team memory use cases:

| Query Type | % of Dataset | Example |
|------------|--------------|---------|
| Temporal | 30% | "What PRs were merged last week?" |
| Actor | 25% | "What is Sarah working on?" |
| Technical | 20% | "How does the auth system work?" |
| Status | 15% | "What's blocking deployment?" |
| Multi-hop | 7% | "Who approved the DB migration and when did it deploy?" |
| Null | 3% | "What did unknown-user do?" (tests precision) |

---

### 4. Synthetic vs. Real Data Balance

#### Recommended Mix

| Source | Percentage | Rationale |
|--------|------------|-----------|
| **Synthetic (Ragas-generated)** | 40-50% | Controlled complexity, diverse query types |
| **Real GitHub Data** | 30-40% | Production-realistic, tests actual transformers |
| **Template-Based Scenarios** | 20% | Edge cases, specific feature testing |

#### When to Use Each

**Synthetic Data** (LLM-generated Q&A from documents):
- Pros: Scalable, controllable difficulty, consistent quality
- Cons: May miss real-world edge cases
- Best for: Initial benchmarking, regression testing, coverage

**Real GitHub Data** (from `packages/console-test-data/datasets/`):
- Pros: Production-realistic, tests full transformer pipeline
- Cons: May contain noise, privacy considerations, less control
- Best for: Integration testing, transformer validation, realistic benchmarks

**Template-Based Scenarios**:
- Pros: Precise control over test conditions
- Cons: Labor-intensive, may not generalize
- Best for: Edge cases, specific feature validation, failure mode testing

#### Implementation Using Existing Infrastructure

```typescript
// Extend existing console-test-data with evaluation dataset generation

interface EvalDatasetGenerator {
  // Phase 1: Load corpus
  loadCorpus(options: {
    scenarios: ("security" | "performance" | "balanced")[];
    limit?: number;
  }): Promise<SourceEvent[]>;

  // Phase 2: Generate Q&A pairs
  generateQueries(
    corpus: SourceEvent[],
    distribution: Record<QueryType, number>,
    options: {
      generator: "ragas" | "llamaindex";
      criticLlm?: string;  // For quality filtering
    }
  ): Promise<EvalCase[]>;

  // Phase 3: Create ground truth
  annotateGroundTruth(
    cases: EvalCase[],
    options: {
      autoAnnotate: boolean;
      humanReviewPercent: number;
    }
  ): Promise<EvalCase[]>;

  // Phase 4: Export
  export(
    cases: EvalCase[],
    format: "braintrust" | "ragas" | "json"
  ): Promise<void>;
}
```

---

### 5. Integration with Existing Infrastructure

#### Braintrust Integration

Build on existing `apps/chat/src/eval/` patterns:

```typescript
// packages/console-eval/src/neural-memory.eval.ts

import { Eval, initLogger } from "braintrust";
import { evaluate } from "ragas";
import { faithfulness, contextPrecision, answerRelevancy } from "ragas/metrics";

const neuralMemoryEval = Eval("neural-memory-retrieval", {
  data: async () => {
    // Load evaluation dataset
    return loadEvalDataset("neural-memory-eval-v1.json");
  },

  task: async (input) => {
    // Run through retrieval governor
    const result = await retrievalGovernor(workspaceId, input.query, queryEmbedding, {
      topK: 10,
    });

    return {
      observations: result.observations,
      entities: result.entities,
      answer: await generateAnswer(input.query, result),
    };
  },

  scores: [
    // Retrieval metrics
    recallAtK({ k: 10 }),
    precisionAtK({ k: 10 }),
    ndcgAtK({ k: 10 }),
    mrr(),

    // RAG Triad (via Ragas)
    ragasFaithfulness(),
    ragasContextRelevance(),
    ragasAnswerRelevancy(),

    // Custom: Temporal accuracy
    temporalAccuracy(),
    actorAttribution(),
  ],
});
```

#### Package Structure

```
packages/
├── console-test-data/          # Existing - webhook corpus
│   ├── datasets/
│   │   ├── security.json
│   │   ├── performance.json
│   │   └── eval/               # NEW: evaluation datasets
│   │       ├── retrieval-v1.json
│   │       └── e2e-v1.json
│   └── src/
│       └── eval/               # NEW: evaluation generation
│           ├── generator.ts
│           ├── scorer.ts
│           └── metrics.ts
│
├── console-eval/               # NEW: evaluation runner package
│   └── src/
│       ├── retrieval.eval.ts
│       ├── ingestion.eval.ts
│       ├── e2e.eval.ts
│       └── metrics/
│           ├── retrieval.ts    # MRR, NDCG, Recall@K
│           ├── rag-triad.ts    # Faithfulness, Relevance
│           └── custom.ts       # Temporal, Actor
```

---

### 6. Scale Recommendations

#### Phase 1: Bootstrap (Week 1-2)
- **50 examples** minimum
- Focus on query type coverage
- Manual ground truth annotation
- Quick iteration on metrics

#### Phase 2: Production Benchmark (Week 3-4)
- **100-200 examples**
- Statistical significance testing
- Automated quality filtering
- Baseline comparisons

#### Phase 3: Comprehensive Suite (Ongoing)
- **500+ examples**
- Full query type coverage
- Ablation studies
- Regression suite for CI/CD

#### Statistical Significance

For sample sizes < 200, use **bootstrap resampling** for confidence intervals:

```python
def bootstrap_ci(scores, n_iterations=1000, ci=0.95):
    bootstrapped = []
    for _ in range(n_iterations):
        sample = np.random.choice(scores, len(scores), replace=True)
        bootstrapped.append(np.mean(sample))
    lower = np.percentile(bootstrapped, (1 - ci) / 2 * 100)
    upper = np.percentile(bootstrapped, (1 + ci) / 2 * 100)
    return lower, upper
```

---

## Code References

- `packages/console-test-data/src/verifier/verifier.ts:17-37` - Existing verification result structure
- `packages/console-test-data/src/loader/transform.ts:71-94` - Webhook transformation
- `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md:349-419` - Significance scoring design
- `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md:545-622` - Retrieval governor design
- `apps/chat/src/eval/*.eval.ts` - Existing Braintrust evaluation patterns

## Architecture Documentation

The evaluation framework builds on:

1. **Existing test data infrastructure** (`console-test-data`) for corpus generation
2. **Braintrust SDK** (already used in `apps/chat/src/eval/`) for evaluation orchestration
3. **Ragas framework** for RAG-specific metrics (faithfulness, context relevance)
4. **Production transformers** (`console-webhooks`) to ensure realistic data transformation

## Historical Context (from thoughts/)

26 relevant documents found covering neural memory planning and implementation:

- `thoughts/shared/research/2025-12-12-neural-memory-e2e-test-data-plan.md` - Test data planning with 8 PRs, 6 issues
- `thoughts/shared/research/2025-12-12-neural-memory-day2-retrieval-infrastructure.md` - Retrieval infrastructure research
- `thoughts/shared/research/2025-12-13-neural-memory-v1-gap-analysis.md` - Comprehensive gap analysis
- `thoughts/shared/plans/2025-12-11-neural-memory-implementation-research-prompt.md` - Master tracking document

**Key Gap Identified**: No Braintrust evaluation files exist for retrieval/search - this is the primary infrastructure gap.

## Related Research

- [RAGAS Documentation](https://docs.ragas.io/) - RAG evaluation framework
- [TruLens RAG Triad](https://www.trulens.org/) - Faithfulness, Context Relevance, Answer Relevance
- [MultiHop-RAG Dataset](https://arxiv.org/abs/2401.15391) - Multi-hop query evaluation
- [STAR-RAG](https://arxiv.org/html/2510.16715v1) - Temporal RAG framework

---

## Follow-up Research: Feature Change Evaluation

**Added**: 2025-12-14T02:25:00Z
**Question**: How do we evaluate when features change (e.g., reworked significance scoring, actor pipeline changes)?

### 7. Feature Change Evaluation Strategy

When modifying neural memory components, we need **regression testing**, **A/B comparison**, and **drift detection**.

#### A. Component-Specific Evaluation Suites

Each major component should have its own focused evaluation:

| Component | Eval Suite | Key Metrics | Dataset Subset |
|-----------|------------|-------------|----------------|
| **Significance Scoring** | `scoring.eval.ts` | True Positive Rate, False Positive Rate, Score Distribution | 100 events with manual labels |
| **Actor Resolution** | `actor.eval.ts` | Identity Matching Accuracy, Cross-Source Linking F1 | 50 actors with known identities |
| **Entity Extraction** | `entity.eval.ts` | Precision, Recall, F1 by entity category | 100 observations with labeled entities |
| **Classification** | `classification.eval.ts` | Type Accuracy, Topic F1 | 100 observations with ground truth |
| **Cluster Assignment** | `cluster.eval.ts` | Cluster Coherence, Assignment Accuracy | 50 related event chains |
| **LLM Gating (Key 2)** | `gating.eval.ts` | Precision, Recall, Latency | 100 query-candidate pairs |

#### B. Regression Testing Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REGRESSION TESTING PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   TRIGGER: PR merged to feat/memory-layer-foundation                         │
│                                                                              │
│   ┌──────────────────┐                                                       │
│   │ 1. Detect Change │  What component was modified?                         │
│   │    (git diff)    │  - significance scoring?                              │
│   └────────┬─────────┘  - actor resolution?                                  │
│            │            - entity extraction?                                 │
│            ▼                                                                 │
│   ┌──────────────────┐                                                       │
│   │ 2. Select Suites │  Map changed files → eval suites                      │
│   │                  │  api/console/.../scoring.ts → scoring.eval.ts         │
│   └────────┬─────────┘  api/console/.../actor-resolution.ts → actor.eval.ts  │
│            │                                                                 │
│            ▼                                                                 │
│   ┌──────────────────┐                                                       │
│   │ 3. Run Baseline  │  Checkout main branch                                 │
│   │    (main branch) │  Run selected eval suites                             │
│   └────────┬─────────┘  Store results as baseline_v{N}                       │
│            │                                                                 │
│            ▼                                                                 │
│   ┌──────────────────┐                                                       │
│   │ 4. Run Candidate │  Checkout PR branch                                   │
│   │    (PR branch)   │  Run same eval suites                                 │
│   └────────┬─────────┘  Store results as candidate_v{N+1}                    │
│            │                                                                 │
│            ▼                                                                 │
│   ┌──────────────────┐                                                       │
│   │ 5. Compare       │  Statistical comparison:                              │
│   │                  │  - Δ metric with 95% CI                               │
│   │                  │  - Regression threshold check                         │
│   │                  │  - Improvement detection                              │
│   └────────┬─────────┘                                                       │
│            │                                                                 │
│            ▼                                                                 │
│   ┌──────────────────┐                                                       │
│   │ 6. Report        │  Generate comparison report:                          │
│   │                  │  - Pass/Fail status                                   │
│   │                  │  - Metric deltas                                      │
│   │                  │  - Recommendation                                     │
│   └──────────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### C. A/B Comparison Framework

```typescript
// packages/console-eval/src/comparison.ts

interface ABComparisonResult {
  baseline: {
    version: string;
    commit: string;
    metrics: Record<string, number>;
  };
  candidate: {
    version: string;
    commit: string;
    metrics: Record<string, number>;
  };
  comparison: {
    metric: string;
    baselineValue: number;
    candidateValue: number;
    delta: number;
    deltaPercent: number;
    confidenceInterval: [number, number];
    significant: boolean;  // p < 0.05
    verdict: "improved" | "regressed" | "unchanged";
  }[];
  overallVerdict: "pass" | "fail" | "review";
  regressionThresholds: Record<string, number>;
}

// Regression thresholds - fail if metric drops below
const REGRESSION_THRESHOLDS = {
  // Retrieval
  "recall@10": -0.05,      // Allow max 5% drop
  "precision@10": -0.05,
  "mrr": -0.05,
  "ndcg@10": -0.05,

  // RAG Triad
  "faithfulness": -0.03,   // Stricter - 3% max drop
  "context_relevance": -0.05,
  "answer_relevancy": -0.05,

  // Latency (inverse - increase is bad)
  "p95_latency_ms": 50,    // Allow max 50ms increase

  // Component-specific
  "significance_tpr": -0.05,
  "entity_f1": -0.05,
  "actor_accuracy": -0.03,
};

async function compareVersions(
  baselineVersion: string,
  candidateVersion: string,
  evalSuites: string[]
): Promise<ABComparisonResult> {
  // 1. Load baseline results from Braintrust
  const baseline = await loadExperimentResults(baselineVersion);

  // 2. Run candidate evaluation
  const candidate = await runEvaluation(candidateVersion, evalSuites);

  // 3. Statistical comparison with bootstrap CI
  const comparison = compareMetrics(baseline, candidate);

  // 4. Check against regression thresholds
  const overallVerdict = checkRegressionThresholds(comparison);

  return { baseline, candidate, comparison, overallVerdict };
}
```

#### D. Feature-Specific Evaluation Examples

**Example 1: Reworking Significance Scoring**

```typescript
// packages/console-eval/src/scoring.eval.ts

import { Eval } from "braintrust";

export const significanceScoringEval = Eval("neural-memory-significance", {
  data: async () => {
    // Load manually labeled events with expected significance
    return loadDataset("eval/significance-labeled.json");
  },

  task: async (input) => {
    const result = await evaluateSignificance(input.sourceEvent);
    return {
      score: result.score,
      factors: result.factors,
      reasoning: result.reasoning,
    };
  },

  scores: [
    // Binary classification metrics
    truePositiveRate({ threshold: 60 }),   // TPR at score ≥ 60
    falsePositiveRate({ threshold: 60 }),  // FPR at score ≥ 60

    // Score quality
    scoreCorrelation(),                     // Correlation with human labels
    factorCoverage(),                       // Are all factors contributing?

    // Distribution analysis
    scoreDistribution(),                    // KL divergence from expected
  ],
});

// Ground truth dataset structure
interface SignificanceEvalCase {
  id: string;
  sourceEvent: SourceEvent;

  // Human labels
  humanSignificanceLabel: "high" | "medium" | "low" | "noise";
  humanScore: number;  // 0-100

  // Expected factor contributions
  expectedFactors: {
    eventType: number;
    contentSubstance: number;
    actorActivity: number;
    referenceDensity: number;
    temporalUniqueness: number;
  };
}
```

**Example 2: Actor Pipeline Changes**

```typescript
// packages/console-eval/src/actor.eval.ts

export const actorResolutionEval = Eval("neural-memory-actor-resolution", {
  data: async () => {
    // Load events with known actor identities
    return loadDataset("eval/actor-resolution.json");
  },

  task: async (input) => {
    const resolved = await resolveActor(workspaceId, input.sourceEvent);
    return {
      resolvedActorId: resolved.actorId,
      confidence: resolved.confidence,
      mappingMethod: resolved.mappingMethod,
    };
  },

  scores: [
    // Identity accuracy
    exactMatchAccuracy(),          // Exact match to ground truth
    confidenceCalibration(),       // Is confidence score accurate?

    // Cross-source linking
    crossSourceLinkingF1(),        // GitHub user linked to Vercel user

    // Tier breakdown
    tierDistribution(),            // OAuth vs Email vs Heuristic

    // Edge cases
    unknownActorHandling(),        // Correctly handles unknown actors
  ],
});

// Ground truth dataset structure
interface ActorEvalCase {
  id: string;
  sourceEvent: SourceEvent;

  // Ground truth
  expectedActorId: string;
  expectedConfidence: number;

  // For cross-source cases
  linkedIdentities: {
    source: string;
    sourceId: string;
  }[];
}
```

**Example 3: Entity Extraction Changes**

```typescript
// packages/console-eval/src/entity.eval.ts

export const entityExtractionEval = Eval("neural-memory-entity-extraction", {
  data: async () => {
    return loadDataset("eval/entity-extraction.json");
  },

  task: async (input) => {
    const entities = await extractEntities(input.observation);
    return { entities };
  },

  scores: [
    // Per-category F1
    entityF1({ category: "engineer" }),
    entityF1({ category: "endpoint" }),
    entityF1({ category: "config" }),
    entityF1({ category: "project" }),

    // Overall metrics
    entityPrecision(),
    entityRecall(),

    // Quality
    confidenceCalibration(),
    evidenceQuality(),
  ],
});
```

#### E. Continuous Evaluation & Drift Detection

```typescript
// packages/console-eval/src/drift.ts

interface DriftDetectionConfig {
  // Metrics to monitor
  metrics: string[];

  // Alert thresholds (std deviations from rolling mean)
  alertThreshold: number;  // Default: 2.0

  // Rolling window for baseline
  windowDays: number;  // Default: 7

  // Minimum samples for detection
  minSamples: number;  // Default: 100
}

interface DriftAlert {
  metric: string;
  currentValue: number;
  rollingMean: number;
  rollingStd: number;
  zScore: number;
  severity: "warning" | "critical";
  timestamp: Date;
}

async function detectDrift(
  config: DriftDetectionConfig
): Promise<DriftAlert[]> {
  const alerts: DriftAlert[] = [];

  for (const metric of config.metrics) {
    // Get rolling baseline from Braintrust
    const baseline = await getRollingBaseline(metric, config.windowDays);

    // Get latest evaluation results
    const current = await getLatestMetricValue(metric);

    // Calculate z-score
    const zScore = (current - baseline.mean) / baseline.std;

    if (Math.abs(zScore) > config.alertThreshold) {
      alerts.push({
        metric,
        currentValue: current,
        rollingMean: baseline.mean,
        rollingStd: baseline.std,
        zScore,
        severity: Math.abs(zScore) > 3 ? "critical" : "warning",
        timestamp: new Date(),
      });
    }
  }

  return alerts;
}

// Scheduled job: Run daily
export const driftDetectionJob = inngest.createFunction(
  { id: "neural-memory-drift-detection" },
  { cron: "0 6 * * *" },  // 6 AM daily
  async ({ step }) => {
    const alerts = await step.run("detect-drift", async () => {
      return detectDrift({
        metrics: [
          "recall@10", "precision@10", "mrr", "ndcg@10",
          "faithfulness", "context_relevance", "answer_relevancy",
          "significance_tpr", "entity_f1", "actor_accuracy",
        ],
        alertThreshold: 2.0,
        windowDays: 7,
        minSamples: 100,
      });
    });

    if (alerts.length > 0) {
      await step.run("send-alerts", async () => {
        // Send to Slack, PagerDuty, etc.
        await sendDriftAlerts(alerts);
      });
    }

    return { alerts };
  }
);
```

#### F. Evaluation Version Control

Track evaluation datasets and results alongside code:

```
packages/console-test-data/
├── datasets/
│   └── eval/
│       ├── v1/                          # Versioned datasets
│       │   ├── significance-v1.json
│       │   ├── actor-resolution-v1.json
│       │   ├── entity-extraction-v1.json
│       │   └── retrieval-v1.json
│       ├── v2/                          # New version when schema changes
│       │   └── ...
│       └── manifest.json                # Dataset version mapping
│
└── results/                             # Local result cache
    └── experiments/
        ├── baseline-2024-01-15.json
        └── candidate-2024-01-16.json
```

```typescript
// Dataset manifest for version control
interface EvalDatasetManifest {
  currentVersion: "v1";
  datasets: {
    name: string;
    version: string;
    path: string;
    recordCount: number;
    lastUpdated: string;
    schema: string;  // Reference to TypeScript interface
  }[];

  // Migration history
  migrations: {
    fromVersion: string;
    toVersion: string;
    date: string;
    reason: string;
    breaking: boolean;
  }[];
}
```

#### G. CI/CD Integration

```yaml
# .github/workflows/neural-memory-eval.yml

name: Neural Memory Evaluation

on:
  pull_request:
    paths:
      - 'api/console/src/inngest/workflow/neural/**'
      - 'packages/console-webhooks/**'
      - 'packages/console-test-data/**'

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      components: ${{ steps.detect.outputs.components }}
    steps:
      - uses: actions/checkout@v4
      - id: detect
        run: |
          # Map changed files to eval components
          components=$(./scripts/detect-eval-components.sh)
          echo "components=$components" >> $GITHUB_OUTPUT

  run-evaluation:
    needs: detect-changes
    runs-on: ubuntu-latest
    strategy:
      matrix:
        component: ${{ fromJson(needs.detect-changes.outputs.components) }}
    steps:
      - uses: actions/checkout@v4
      - name: Setup
        run: pnpm install

      - name: Run Baseline (main)
        run: |
          git checkout main
          pnpm --filter @repo/console-eval eval:${{ matrix.component }} --tag baseline

      - name: Run Candidate (PR)
        run: |
          git checkout ${{ github.head_ref }}
          pnpm --filter @repo/console-eval eval:${{ matrix.component }} --tag candidate

      - name: Compare Results
        run: |
          pnpm --filter @repo/console-eval compare \
            --baseline baseline \
            --candidate candidate \
            --output pr-comment.md

      - name: Post Comment
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const comment = fs.readFileSync('pr-comment.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

#### H. Evaluation Report Template

```markdown
## Neural Memory Evaluation Report

**PR**: #123 - Rework significance scoring algorithm
**Date**: 2024-01-16
**Components Changed**: significance scoring, classification

### Summary

| Verdict | ✅ PASS |
|---------|---------|
| Regressions | 0 |
| Improvements | 2 |
| Unchanged | 5 |

### Metric Comparison

| Metric | Baseline | Candidate | Δ | Δ% | 95% CI | Verdict |
|--------|----------|-----------|---|----|---------| --------|
| significance_tpr | 0.82 | 0.87 | +0.05 | +6.1% | [+0.03, +0.07] | ✅ Improved |
| significance_fpr | 0.15 | 0.12 | -0.03 | -20% | [-0.05, -0.01] | ✅ Improved |
| recall@10 | 0.85 | 0.85 | 0.00 | 0% | [-0.02, +0.02] | ➖ Unchanged |
| precision@10 | 0.72 | 0.71 | -0.01 | -1.4% | [-0.03, +0.01] | ➖ Unchanged |
| faithfulness | 0.71 | 0.70 | -0.01 | -1.4% | [-0.03, +0.01] | ➖ Unchanged |

### Recommendations

- ✅ **Safe to merge**: No regressions detected
- 📈 **Improvements**: Significance scoring now has 6% higher TPR with lower FPR

### Details

<details>
<summary>Baseline experiment: neural-memory-significance-baseline-abc123</summary>
[Braintrust Link](https://braintrust.dev/...)
</details>

<details>
<summary>Candidate experiment: neural-memory-significance-candidate-def456</summary>
[Braintrust Link](https://braintrust.dev/...)
</details>
```

---

## Open Questions

1. **LLM Judge Model Selection**: Should we use claude-3-5-haiku (fast/cheap) or claude-3-5-sonnet (quality) for evaluation?
2. **Temporal Metric Implementation**: How to formalize temporal accuracy scoring for queries like "last week"?
3. **Entity Extraction Ground Truth**: How to create ground truth for entity extraction F1 at scale?
4. **Cross-Source Evaluation**: How to evaluate cross-source linkage quality (GitHub + Vercel events)?
5. **Production Drift Monitoring**: How to detect evaluation metric drift in production?
6. **Evaluation Dataset Versioning**: How to handle breaking changes in eval dataset schema?
7. **CI Runtime**: How to keep eval CI under 10 minutes while maintaining coverage?

---

_Last updated: 2025-12-14_
_Follow-up added: Feature change evaluation (regression testing, A/B comparison, drift detection)_
