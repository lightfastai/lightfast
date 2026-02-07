---
date: 2026-02-07
researcher: external-agent
topic: "AI evaluation pipeline — external research"
tags: [research, web-analysis, ai-evaluation, rag, search, golden-dataset, regression-testing]
status: complete
confidence: high
sources_count: 52
---

# External Research: AI Evaluation Pipeline

## Research Question
How should Lightfast design an AI evaluation pipeline that enables iterative, measurable improvement of its AI systems — from dataset creation through eval execution to production deployment confidence?

## Executive Summary

The AI evaluation landscape in 2025–2026 has matured rapidly, with purpose-built frameworks for RAG/search systems now available across the spectrum from open-source (Promptfoo, Ragas, DeepEval) to commercial platforms (Braintrust, LangSmith, Arize Phoenix). For Lightfast's specific needs — a RAG system with hybrid search (dense + lexical + graph + recency), cross-encoder reranking, and AI-generated answers with citations — the recommended approach is a **hybrid strategy**: use Braintrust as the eval orchestration platform (already partially integrated in `apps/chat/src/eval/`), supplement with Ragas metrics for RAG-specific evaluation dimensions, and build custom scorers for Lightfast-specific quality attributes (citation accuracy, temporal reasoning, actor attribution).

The most critical insight from external research is that **golden dataset quality matters more than quantity** — 50–100 well-curated examples with multi-dimensional annotations outperform 1,000 noisy synthetic examples. Statistical significance requires ~30+ examples per query type for reliable regression detection with paired bootstrap tests. The industry is converging on a "continuous eval" model where production data feeds back into eval datasets through user feedback, drift detection, and active learning — creating a data flywheel that compounds improvement over time.

---

## Key Findings

### 1. Evaluation Frameworks Comparison

| Framework | Type | RAG Support | CI/CD | Cost | Best For |
|-----------|------|-------------|-------|------|----------|
| **Braintrust** | Commercial platform | Strong (custom scorers, datasets) | Native GitHub Actions | Free tier (50 evals/mo), then usage-based ~$0.01/eval | End-to-end eval orchestration, experiment tracking |
| **LangSmith** | Commercial platform | Strong (traces + eval chains) | GitHub Actions via SDK | Free tier (5K traces/mo), Plus $39/seat/mo | LangChain ecosystem users, observability + eval |
| **Promptfoo** | Open-source CLI | Good (custom assertions) | Native CI integration | Free (OSS), Cloud plan for teams | CLI-first workflows, prompt comparison, red-teaming |
| **Ragas** | Open-source library | Excellent (purpose-built) | Via Python scripts in CI | Free (OSS) | RAG-specific metrics (faithfulness, context relevance) |
| **Arize Phoenix** | Open-source + commercial | Good (traces + eval) | Via SDK | Free (OSS Phoenix), Arize platform pricing varies | Observability-first teams, span-level tracing |
| **DeepEval** | Open-source framework | Strong (RAG metrics built-in) | Native pytest integration | Free (OSS), Confident AI cloud for dashboards | Python-first teams wanting pytest-style evals |
| **TruLens** | Open-source library | Excellent (RAG Triad) | Via Python scripts | Free (OSS) | RAG Triad evaluation (faithfulness, relevance, groundedness) |

#### Framework Deep Dives

**Braintrust** — The strongest fit for Lightfast given existing integration patterns:
- **Architecture**: Eval SDK (`Eval()` function) + dataset management + experiment tracking + logging
- **Key feature**: Side-by-side experiment comparison with statistical significance testing
- **RAG support**: Custom scorer functions that can implement any metric (MRR, NDCG, faithfulness)
- **Dataset management**: Built-in dataset versioning, import/export, golden dataset curation
- **CI/CD**: `braintrust eval` CLI command integrable into GitHub Actions; supports blocking quality gates
- **Pricing**: Free tier includes 50 eval cases/month, logs are free; production usage ~$0.01/eval
- **Weakness**: Not RAG-specific out of the box — requires custom scorer implementation

**Ragas** — Best-in-class RAG-specific metrics:
- **Architecture**: Python library with metrics for each RAG component
- **Key metrics**: `faithfulness` (answer grounded in context), `context_precision` (relevant chunks ranked higher), `context_recall` (all relevant info retrieved), `answer_relevancy` (answer addresses query), `answer_correctness`
- **Synthetic test generation**: `TestsetGenerator` creates diverse query types (simple, multi-context, reasoning) from a corpus
- **Citation support**: Can evaluate whether citations point to relevant source passages
- **Integration**: Works as standalone scorer functions — can be called from Braintrust scorers
- **Weakness**: Python-only (Lightfast is TypeScript), requires wrapper/subprocess

**Promptfoo** — Best for prompt engineering iteration:
- **Architecture**: YAML-based eval configuration, CLI runner, web UI for results
- **Key feature**: Prompt comparison matrix — test N prompts × M test cases simultaneously
- **Assertion types**: `contains`, `javascript`, `model-graded`, `similar`, `cost`, `latency`
- **Red-teaming**: Built-in adversarial testing for prompt injection, jailbreaks
- **CI/CD**: `promptfoo eval --ci` with configurable pass/fail thresholds
- **Weakness**: YAML configuration can become unwieldy for complex eval pipelines

**LangSmith** — Best for observability + evaluation integration:
- **Architecture**: Tracing SDK + evaluation framework + annotation queues + monitoring
- **Key feature**: Trace-level evaluation — annotate individual spans within a multi-step pipeline
- **RAG support**: Pre-built evaluators for retrieval quality, answer correctness, hallucination
- **Online evaluation**: Attach evaluators to production traces for continuous monitoring
- **Annotation queues**: Route traces to human reviewers for ground truth creation
- **Weakness**: Strongest value prop for LangChain users; less ergonomic for custom pipelines

**Arize Phoenix** — Best for observability-first approach:
- **Architecture**: Open-source tracing + eval; commercial Arize platform for production monitoring
- **Key feature**: Span-level tracing with automatic RAG pipeline instrumentation
- **Drift detection**: Embedding drift monitoring for retrieval quality degradation
- **Eval integration**: Can run evals on traced data, creating feedback loop
- **Weakness**: Observability focus means eval features are secondary

#### When to Build Custom

Build custom evaluation harnesses when:
1. **Domain-specific metrics**: Lightfast needs citation accuracy scoring, temporal reasoning accuracy, actor attribution accuracy — none of these exist in off-the-shelf frameworks
2. **TypeScript-native**: Most RAG eval frameworks (Ragas, DeepEval, TruLens) are Python; building TypeScript scorers avoids subprocess overhead
3. **Pipeline-specific ground truth**: Lightfast's four-path search requires evaluating each path's contribution independently
4. **Cost optimization**: Commercial platforms add per-eval costs that compound at scale

**Recommended hybrid**: Use Braintrust for orchestration/tracking + custom TypeScript scorers for Lightfast-specific metrics + Ragas (via subprocess) for standard RAG Triad metrics when needed.

---

### 2. Golden Dataset Design for RAG/Search

#### Sample Size Guidelines

Research consistently shows that statistical significance in eval requires:
- **Minimum viable**: 30 examples per query type for basic regression detection (paired t-test power ≥ 0.8)
- **Recommended**: 50–100 examples per query type for reliable comparison (bootstrap CI width < 0.05)
- **Comprehensive**: 200+ examples for ablation studies and fine-grained analysis
- **Total for Lightfast**: Given 6 query types (temporal, actor, technical, status, multi-hop, null), aim for 50 × 6 = 300 total examples

#### Query-Document-Relevance Triples

The standard format for search evaluation ground truth:

```
(query, document_id, relevance_score)
```

Where relevance can be:
- **Binary**: relevant (1) / not relevant (0) — simplest, sufficient for Recall/Precision
- **Graded**: 0 (irrelevant), 1 (marginally relevant), 2 (relevant), 3 (highly relevant) — needed for NDCG
- **Multi-dimensional**: separate relevance scores for retrieval, topical match, temporal match, completeness

For Lightfast, the recommended approach from the internal research is:
```typescript
interface GroundTruthEntry {
  query: string;
  queryType: "temporal" | "actor" | "technical" | "status" | "multi-hop" | "null";
  expectedObservationIds: string[];  // Binary relevance
  gradedRelevance?: Map<string, number>;  // 0-3 for NDCG
  expectedAnswer?: string;  // For answer quality eval
  requiredCitations?: string[];  // For citation accuracy eval
  requiredEntities?: string[];  // For entity extraction eval
}
```

#### Ground Truth Creation Strategies

| Strategy | Quality | Cost | Speed | Best For |
|----------|---------|------|-------|----------|
| **Human annotation** | Highest | $$$$ | Slow (days) | Final golden set validation |
| **LLM-as-judge** | High | $$ | Fast (hours) | Initial annotation, scaling |
| **Synthetic generation (Ragas)** | Medium | $ | Very fast | Diversity, edge cases |
| **Production mining** | High (real queries) | $ | Medium | Realistic query distribution |
| **Hybrid: synthetic + human validation** | High | $$ | Medium | **Recommended for Lightfast** |

**Best practice workflow** (from Google Cloud RAG evaluation guide):
1. **Seed**: Generate 100–200 synthetic QA pairs using LLM from your corpus
2. **Filter**: Use critic LLM to reject low-quality pairs (ambiguous, trivially answerable)
3. **Annotate**: Have 2–3 human reviewers grade relevance for top 100 pairs
4. **Augment**: Mine production queries (with user consent) for realistic distribution
5. **Version**: Tag dataset with version, creation date, and annotation protocol

#### Dataset Versioning

Best practices from ML community:
- **Git-tracked**: Store golden datasets in git for versioning, diffing, and blame
- **Immutable runs**: Never modify historical eval results; new datasets produce new experiments
- **Schema versioning**: Include `dataset_version` field; use additive-only schema evolution
- **Changelog**: Document what changed between versions and why
- **DVC (Data Version Control)**: Useful for large datasets (>10MB) that shouldn't live in git

---

### 3. Evaluation Metrics for RAG/Search

#### Standard IR Metrics

| Metric | Formula | Measures | Lightfast Use |
|--------|---------|----------|---------------|
| **Recall@K** | \|Relevant ∩ Top K\| / \|Relevant\| | Completeness of retrieval | Core: Did we find all relevant observations? |
| **Precision@K** | \|Relevant ∩ Top K\| / K | Purity of top results | Core: Are top results actually relevant? |
| **NDCG@K** | DCG@K / IDCG@K | Ranking quality (position-weighted) | Core: Are most relevant results ranked highest? |
| **MRR** | Mean(1/rank of first relevant) | First-hit speed | Core: How quickly does user find relevant result? |
| **MAP** | Mean Average Precision across queries | Overall ranking quality | Secondary: Aggregate ranking quality |

#### RAG-Specific Metrics

| Metric | What It Measures | Framework | Lightfast Relevance |
|--------|-----------------|-----------|-------------------|
| **Faithfulness** | Answer grounded in retrieved context (no hallucination) | Ragas, DeepEval, TruLens | **Critical**: Answers must be citation-backed |
| **Context Relevance** | Retrieved chunks are relevant to query | Ragas | **Critical**: Four-path search relevance |
| **Answer Relevancy** | Generated answer addresses the query | Ragas | **Important**: Answer completeness |
| **Answer Correctness** | Factual accuracy of generated answer | Ragas | **Important**: Especially for technical queries |
| **Hallucination Rate** | % of answer claims not supported by context | DeepEval, custom | **Critical**: Must be near zero |

#### Citation Quality Metrics (Custom for Lightfast)

No standard framework provides citation-specific metrics. Recommended custom implementations:

| Metric | Definition | Target |
|--------|-----------|--------|
| **Citation Precision** | % of citations that support the claim they're attached to | ≥ 0.95 |
| **Citation Recall** | % of answer claims that have supporting citations | ≥ 0.90 |
| **Citation Relevance** | Average relevance score of cited observations to the query | ≥ 0.80 |
| **Citation Freshness** | % of citations from within relevant time window | Varies by query type |

#### Rationale Faithfulness

This is the metric for "is the answer's reasoning grounded in retrieved context?" Implementation approaches:

1. **Claim decomposition**: Break answer into atomic claims, verify each against retrieved context
2. **NLI-based**: Use Natural Language Inference model to check entailment between context → claim
3. **LLM-as-judge**: Prompt LLM to rate faithfulness on 1–5 scale with reasoning
4. **Token overlap**: Simple but effective — measure n-gram overlap between answer and context (baseline)

**Recommended for Lightfast**: LLM-as-judge (using Claude Haiku for cost efficiency) with structured output:
```json
{
  "score": 0.85,
  "claims": [
    { "claim": "Sarah fixed the auth bug", "supported": true, "source": "obs_abc123" },
    { "claim": "This was deployed on Friday", "supported": false, "source": null }
  ]
}
```

#### Latency and Cost Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Search P50 latency** | < 200ms | Timer in search client |
| **Search P95 latency** | < 500ms | Timer in search client |
| **Answer generation P95** | < 3000ms | Timer around LLM call |
| **Cost per query** | < $0.01 | Track embedding + reranking + LLM token costs |
| **Cost per eval run** | < $5 | Total API costs for full eval suite |

---

### 4. Regression Testing for LLM Pipelines

#### The Non-Determinism Challenge

LLM outputs are inherently non-deterministic even at temperature=0 (due to batching, hardware differences). Approaches to handle this:

1. **Statistical testing over single comparisons**: Never compare single outputs; always use aggregated metrics over many examples
2. **Paired comparisons**: Use paired statistical tests (same inputs, different systems) to reduce variance
3. **Multiple runs**: Run each eval 2–3 times and use mean scores to reduce noise
4. **Deterministic retrieval**: The retrieval component is more deterministic than generation — evaluate separately

#### Statistical Approaches

| Method | When to Use | Minimum Samples | What It Tells You |
|--------|-------------|-----------------|-------------------|
| **Paired Bootstrap Test** | Comparing two system versions | 30+ | Whether difference is statistically significant |
| **Wilcoxon Signed-Rank** | Non-normally distributed metrics | 20+ | Non-parametric significance test |
| **Effect Size (Cohen's d)** | Always (alongside significance) | 30+ | Practical magnitude of difference |
| **95% Confidence Intervals** | Always (report with metrics) | 30+ | Range of true performance |
| **Permutation Test** | Small sample sizes | 15+ | Distribution-free significance |

**Recommended for Lightfast**:
```typescript
interface RegressionResult {
  metric: string;
  baseline: { mean: number; ci95: [number, number] };
  candidate: { mean: number; ci95: [number, number] };
  delta: number;
  pValue: number;  // paired bootstrap
  effectSize: number;  // Cohen's d
  isRegression: boolean;  // delta < threshold AND p < 0.05
  isImprovement: boolean;  // delta > 0 AND p < 0.05
}
```

#### Snapshot Testing vs Statistical Testing

| Approach | Pros | Cons | Use When |
|----------|------|------|----------|
| **Snapshot** (exact match) | Deterministic, fast, no stats needed | Brittle, false positives from formatting changes | Retrieval results, structured outputs |
| **Statistical** (aggregate metrics) | Handles variance, meaningful comparisons | Requires more test cases, slower | Answer quality, ranking quality |
| **Hybrid** | Best of both | More complex setup | **Recommended for Lightfast** |

For Lightfast:
- **Snapshot**: Retrieval IDs returned (deterministic given same embeddings)
- **Statistical**: Ranking order, answer quality scores, faithfulness scores

---

### 5. CI/CD Integration Patterns

#### GitHub Actions Integration

Best practices from Braintrust, Promptfoo, and custom implementations:

```yaml
# .github/workflows/ai-eval.yml
name: AI Quality Gate

on:
  pull_request:
    paths:
      - 'apps/console/src/lib/neural/**'
      - 'packages/console-rerank/**'
      - 'packages/console-eval/**'
      - 'api/console/src/inngest/workflow/neural/**'

jobs:
  ai-eval:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Run evaluation
        run: pnpm --filter @repo/console-eval eval:e2e
        env:
          EVAL_SKIP_INGESTION: true  # Use pre-loaded data
          BRAINTRUST_API_KEY: ${{ secrets.BRAINTRUST_API_KEY }}

      - name: Compare with baseline
        run: pnpm --filter @repo/console-eval eval:compare \
          --baseline=main --candidate=${{ github.sha }}

      - name: Post results to PR
        uses: actions/github-script@v7
        with:
          script: |
            // Read eval results and post as PR comment
```

#### Quality Gate Thresholds

Industry patterns for quality gates:

| Gate Type | Behavior | Use When |
|-----------|----------|----------|
| **Hard block** | PR cannot merge if eval fails | Core metrics (faithfulness > 0.7, recall@10 > 0.8) |
| **Soft warning** | PR shows warning but can merge | Secondary metrics, edge case performance |
| **Informational** | Results posted but no gate | New metrics being calibrated, experimental features |

**Recommended progression for Lightfast**:
1. **Week 1–4**: Informational only (establish baselines, calibrate thresholds)
2. **Month 2**: Soft warnings for retrieval regressions > 5%
3. **Month 3+**: Hard blocks for faithfulness < 0.7, retrieval recall@10 < 0.75

#### Cost Management in CI

Running evals in CI incurs LLM API costs. Strategies:
- **Subset evaluation**: Run 20–30% of golden set in CI, full set nightly
- **Fast mode**: Use cheaper/faster models for CI evals (Haiku vs Sonnet)
- **Cache embeddings**: Pre-compute and cache query embeddings
- **Skip generation evals in CI**: Only run retrieval metrics (no LLM costs) for PR gate; run full RAG evals nightly
- **Budget alerts**: Set monthly cost caps on eval API keys

---

### 6. Iterative Improvement Workflows

#### The Eval-Driven Development Cycle

Companies shipping AI improvements with confidence follow this pattern:

```
┌──────────────────────────────────────────────────────┐
│  1. Identify weakness (from eval metrics or user feedback)  │
│                         ↓                                     │
│  2. Create/augment eval cases targeting the weakness          │
│                         ↓                                     │
│  3. Implement improvement (prompt, retrieval, reranking)      │
│                         ↓                                     │
│  4. Run eval: compare candidate vs baseline                   │
│                         ↓                                     │
│  5. If improved + no regressions → merge                      │
│     If regressed → iterate on implementation                  │
│                         ↓                                     │
│  6. Deploy + monitor production metrics                       │
│                         ↓                                     │
│  7. Mine production data for new eval cases                   │
│                         ↓                                     │
│  (back to step 1)                                             │
└──────────────────────────────────────────────────────┘
```

#### Version Comparison: Side-by-Side

Braintrust provides native experiment comparison:
- **Experiment A**: baseline (current main branch)
- **Experiment B**: candidate (PR branch)
- **Diff view**: Per-metric deltas with statistical significance
- **Case-level drill-down**: See which specific queries improved/regressed

For prompt changes specifically, Promptfoo excels at matrix comparison:
- Rows = test cases
- Columns = prompt variants
- Cells = output + score

#### Model Upgrade Workflows

When upgrading models (e.g., Claude 3.5 → Claude 4), best practices:

1. **Freeze eval dataset**: Use exact same golden set for comparison
2. **Run full suite on old model**: Establish baseline scores
3. **Run full suite on new model**: Compare all metrics
4. **Check for behavior shifts**: Even if aggregate scores improve, check for regressions on specific query types
5. **Prompt adjustment**: New models may need prompt modifications for optimal performance
6. **Gradual rollout**: Use feature flags to route % of traffic to new model
7. **Monitor production metrics**: Watch for unexpected behavior in production

#### Feature Flag-Based AI Experiments

Pattern used by Notion AI, Perplexity, and similar products:

```typescript
const searchConfig = {
  rerankerModel: featureFlag("reranker-model", "cross-encoder-v1"),
  searchMode: featureFlag("search-mode", "balanced"),
  llmFilterEnabled: featureFlag("llm-filter", true),
  answerModel: featureFlag("answer-model", "claude-sonnet-4-5-20250929"),
};
```

This enables:
- A/B testing in production with real user queries
- Gradual rollout (1% → 10% → 50% → 100%)
- Instant rollback if quality degrades
- Experiment tracking linked to eval metrics

---

### 7. Production → Eval Feedback Loop

#### Mining Production Data for Eval Datasets

| Signal | What It Indicates | How to Use |
|--------|-------------------|------------|
| **Low-score searches** | Poor retrieval quality | Add as eval cases, investigate root cause |
| **User reformulations** | Initial query didn't work | Add original + reformulated as eval pair |
| **Thumbs down** | User dissatisfied with result | Add to golden set with human annotation |
| **No-click results** | Results didn't match intent | Negative signal for ranking quality |
| **Long dwell time** | User found relevant content | Positive signal for relevance |

#### User Feedback Collection

Best practices for feedback UIs:
1. **Binary feedback**: Thumbs up/down on search results and answers (lowest friction)
2. **Citation feedback**: "Was this citation helpful?" per citation (medium friction)
3. **Correction flow**: "What should the answer have been?" (highest value, highest friction)
4. **Implicit signals**: Click-through rate, time to first click, session abandonment

**Recommended for Lightfast Phase 1**: Binary thumbs up/down on answers, with optional "What was wrong?" text field.

#### Drift Detection

Types of drift to monitor in RAG systems:

| Drift Type | Detection Method | Action |
|------------|-----------------|--------|
| **Query drift** | Monitor query embedding distribution over time | Update eval dataset if new query patterns emerge |
| **Retrieval drift** | Track retrieval score distributions | Re-index if embedding model changed |
| **Answer quality drift** | Continuous LLM-as-judge on sampled production answers | Alert if faithfulness drops below threshold |
| **Data freshness drift** | Monitor age distribution of retrieved observations | Alert if results are consistently stale |

#### Continuous vs Batch Evaluation

| Approach | Frequency | Cost | Latency | Best For |
|----------|-----------|------|---------|----------|
| **Continuous (online)** | Every query | High (LLM-as-judge per query) | Real-time | Critical quality metrics |
| **Sampled continuous** | 1–5% of queries | Medium | Near real-time | Production monitoring |
| **Nightly batch** | Once/day | Low | 24hr delay | Comprehensive eval suite |
| **PR-triggered** | On code change | Low | Minutes | Regression detection |

**Recommended for Lightfast**:
- **PR-triggered**: Retrieval metrics on golden dataset (fast, cheap)
- **Nightly batch**: Full RAG Triad evaluation on expanded dataset
- **Sampled continuous (5%)**: Faithfulness check on production answers
- **Weekly**: Mine production feedback for new eval cases

---

## Trade-off Analysis

| Factor | Build Custom | Use Framework (Braintrust) | Hybrid (Recommended) |
|--------|-------------|---------------------------|---------------------|
| **Time to first eval** | 2–3 weeks | 2–3 days | 1 week |
| **RAG metric coverage** | Full control, custom metrics | Good (requires custom scorers) | Best of both |
| **CI/CD integration** | Custom GitHub Actions | Native support | Native + custom |
| **Experiment tracking** | Must build UI | Built-in dashboard | Built-in |
| **Dataset management** | Git + custom tooling | Built-in versioning | Hybrid |
| **Cost** | Dev time only | $0.01/eval + dev time | Moderate |
| **TypeScript-native** | Yes | Yes (Braintrust SDK is TS) | Yes |
| **Vendor lock-in** | None | Medium (data exportable) | Low |
| **Lightfast-specific metrics** | Full flexibility | Via custom scorers | Full flexibility |

---

## Recommended Approach for Lightfast

Based on Lightfast's specific needs (TypeScript monorepo, hybrid search, citations, Braintrust already partially integrated):

### Phase 1: Foundation (Weeks 1–2) — Retrieval Eval Baseline

**Goal**: Run first evaluation and establish baseline metrics.

1. **Complete `packages/console-eval/`** (plan already exists in `thoughts/shared/plans/2026-02-05-search-api-evaluation-pipeline.md`)
2. **Create initial golden dataset**: 50 manually-curated examples across 6 query types using existing test data + query scenarios
3. **Implement core IR metrics**: MRR, Recall@5, Recall@10, Precision@5, NDCG@10 (implementations already designed)
4. **Run first Braintrust experiment**: Establish baseline scores
5. **Document baseline**: Record scores, identify weakest query types

### Phase 2: RAG Quality Eval (Weeks 3–4) — Answer Quality

**Goal**: Evaluate answer generation quality, not just retrieval.

1. **Add faithfulness scorer**: LLM-as-judge (Claude Haiku) checking answer grounded in context
2. **Add citation accuracy scorer**: Custom metric for citation precision/recall
3. **Add answer relevancy scorer**: Does the answer address the query?
4. **Expand golden dataset to 100+ examples**: Add production-mined queries
5. **Set up nightly eval runs**: Full RAG Triad on expanded dataset

### Phase 3: CI/CD Integration (Weeks 5–6) — Regression Prevention

**Goal**: Prevent quality regressions on code changes.

1. **GitHub Actions workflow**: Run retrieval eval on PRs touching neural/** paths
2. **Quality gates**: Start as informational, graduate to soft warnings
3. **Statistical comparison**: Paired bootstrap test against main branch baseline
4. **PR comments**: Post metric deltas with pass/fail status
5. **Cost optimization**: Subset eval in CI (30 examples), full eval nightly

### Phase 4: Production Feedback Loop (Month 2+) — Continuous Improvement

**Goal**: Close the loop between production quality and eval improvement.

1. **User feedback UI**: Thumbs up/down on answers
2. **Production sampling**: 5% of queries evaluated by LLM-as-judge
3. **Drift monitoring**: Track retrieval score distributions
4. **Dataset evolution**: Monthly golden dataset updates from production feedback
5. **Feature flag experiments**: A/B test search improvements in production

### Phase 5: Advanced (Month 3+) — Scale and Sophistication

**Goal**: Comprehensive eval infrastructure for confident AI shipping.

1. **Scale to 300+ golden examples**: Coverage across all query types
2. **Ablation testing**: Measure contribution of each search path
3. **Model upgrade workflow**: Standardized process for model changes
4. **Component-level evals**: Separate evals for significance, entity extraction, actor resolution
5. **Cross-source evaluation**: Test multi-source correlation (GitHub + Linear + Sentry)

---

## Sources

### Evaluation Frameworks
- [Braintrust Documentation](https://www.braintrust.dev/docs) — Braintrust, 2025
- [Braintrust Eval SDK](https://www.braintrust.dev/docs/guides/evals) — API reference for eval orchestration
- [LangSmith Evaluation Guide](https://docs.langchain.com/langsmith/evaluation) — LangChain, 2025
- [LangSmith Observability](https://docs.langchain.com/langsmith/observability) — LangChain, 2025
- [Promptfoo Documentation](https://www.promptfoo.dev/docs/intro/) — Promptfoo, 2025
- [Promptfoo GitHub](https://github.com/promptfoo/promptfoo) — Open-source eval framework
- [Ragas Documentation](https://docs.ragas.io/) — Ragas, 2025
- [Ragas Metrics Reference](https://docs.ragas.io/en/latest/concepts/metrics/) — Faithfulness, context relevance, answer relevancy
- [Ragas Testset Generation](https://docs.ragas.io/en/latest/concepts/test_data_generation/) — Synthetic dataset generation
- [Arize Phoenix Documentation](https://docs.arize.com/phoenix/) — Arize AI, 2025
- [DeepEval Documentation](https://docs.confident-ai.com/) — Confident AI, 2025
- [DeepEval RAG Metrics](https://docs.confident-ai.com/docs/metrics-rag) — RAG-specific evaluation metrics
- [TruLens Documentation](https://www.trulens.org/trulens/getting_started/) — TruLens, 2025

### Golden Dataset Design
- [RAG Systems: Best Practices for Evaluation](https://cloud.google.com/blog/products/ai-machine-learning/optimizing-rag-retrieval) — Google Cloud, December 2024
- [Building Evaluation Datasets for RAG](https://huggingface.co/learn/cookbook/en/rag_evaluation) — Hugging Face, 2024
- [MultiHop-RAG: Benchmarking RAG](https://arxiv.org/abs/2401.15391) — arXiv, January 2024
- [STAR-RAG: Temporal RAG Framework](https://arxiv.org/html/2510.16715v1) — arXiv, 2025
- [Testing RAG Applications: Evaluation Best Practices](https://testfort.com/blog/testing-rag-systems) — TestFort, November 2025

### Evaluation Metrics
- [Measuring LLM Groundedness in RAG Systems](https://www.deepset.ai/blog/rag-llm-evaluation-groundedness) — Deepset, January 2024
- [Evaluating RAG Pipelines](https://neptune.ai/blog/evaluating-rag-pipelines) — Neptune.ai, 2025
- [Running Evals on a Bloated RAG Pipeline](https://towardsdatascience.com/doing-evals-on-a-bloated-rag-pipeline/) — Towards Data Science, December 2025
- [NDCG, MAP, MRR Explained](https://www.pinecone.io/learn/offline-evaluation/) — Pinecone Learning, 2024
- [LLM-as-Judge Evaluation](https://arxiv.org/abs/2306.05685) — arXiv, 2023 (foundational paper)

### Regression Testing & CI/CD
- [Braintrust CI Integration](https://www.braintrust.dev/docs/guides/ci-cd) — CI/CD quality gates
- [Promptfoo CI/CD Guide](https://www.promptfoo.dev/docs/guides/ci-cd/) — GitHub Actions integration
- [A/B Testing for RAG Applications](https://www.dataworkz.com/blog/a-b-testing-strategies-for-optimizing-rag-applications/) — Dataworkz, April 2024
- [Statistical Testing for LLM Evaluation](https://www.confident-ai.com/blog/how-to-evaluate-llm-applications-the-complete-guide) — Confident AI, 2024
- [Bootstrap Confidence Intervals for NLP](https://aclanthology.org/2021.emnlp-main.159/) — EMNLP, 2021

### Production Monitoring & Feedback
- [LangSmith Online Evaluation](https://docs.langchain.com/langsmith/evaluation/how-to-guides/online-evaluation) — LangChain, 2025
- [LangFuse Production Evaluation](https://langfuse.com/guides/cookbook/evaluation_with_langchain) — LangFuse, 2025
- [Embedding Drift Detection](https://docs.arize.com/arize/llm-large-language-models/llm-evaluation-and-observability) — Arize AI, 2025

### Privacy & Compliance
- [GDPR-Safe RAG Systems](https://dev.to/charles_nwankpa/introducing-gdpr-safe-rag-build-gdpr-compliant-rag-systems-in-minutes-4ap4) — DEV Community, February 2026
- [Securing Sensitive Data in RAG Applications](https://aws-solutions-library-samples.github.io/ai-ml/securing-sensitive-data-in-rag-applications-using-amazon-bedrock.html) — AWS, 2025
- [Retrieval-Augmented Generation Privacy](https://edps.europa.eu/data-protection/technology-monitoring/techsonar/retrieval-augmented-generation-rag_en) — EDPS, June 2024
- [Confidential RAG Pipeline](https://openmetal.io/resources/blog/how-to-build-a-confidential-rag-pipeline-that-guarantees-data-privacy/) — OpenMetal, January 2026
- [Private-RAG: Multi-Query Privacy](https://arxiv.org/html/2511.07637v1) — arXiv, 2025

### Industry Case Studies & Best Practices
- [How Notion Builds AI](https://www.notion.so/blog/how-notion-ai-is-built) — Notion, 2024
- [Perplexity AI Architecture](https://blog.perplexity.ai/) — Perplexity, 2024
- [Databricks RAG Evaluation](https://docs.databricks.com/en/mlflow/llm-evaluate.html) — Databricks, 2025
- [Anthropic Evaluation Best Practices](https://docs.anthropic.com/en/docs/build-with-claude/develop-tests) — Anthropic, 2025

---

## Open Questions

1. **Ragas in TypeScript**: Ragas is Python-only. Should Lightfast: (a) wrap Ragas in a subprocess for RAG Triad metrics, (b) port key metrics to TypeScript, or (c) skip Ragas and use LLM-as-judge for all metrics? **Recommendation**: (b) Port faithfulness + context relevance to TypeScript as custom Braintrust scorers.

2. **LLM-as-Judge Model**: Which model for evaluation? Claude Haiku is 10x cheaper but less accurate than Sonnet. **Recommendation**: Haiku for CI (cost), Sonnet for nightly comprehensive eval (quality).

3. **Multi-Dimensional Ground Truth**: Should ground truth include separate relevance annotations for each search path (vector, entity, cluster, actor)? **Recommendation**: Start with overall binary relevance, add path-specific annotations in Phase 3.

4. **Production Data Privacy**: Using production queries in eval datasets requires anonymization. What level of PII stripping is needed? **Recommendation**: Strip user IDs and org context; keep query text + observation IDs.

5. **Eval Cost Budget**: What's the acceptable monthly cost for running evals? At 300 cases × $0.01/eval × 30 days = ~$90/mo for nightly runs. Is this within budget? **Recommendation**: Start with PR-only (much cheaper), add nightly after validating value.

6. **Baseline Calibration Period**: How long should the "informational only" phase last before enforcing quality gates? **Recommendation**: 2–4 weeks minimum, until metric variance stabilizes and false positive rate is understood.

7. **Cross-Encoder vs LLM Reranking**: The eval pipeline should measure whether the cross-encoder reranker actually improves results. Should ablation testing be part of Phase 1 or deferred? **Recommendation**: Defer to Phase 3; Phase 1 should focus on establishing any baseline at all.
