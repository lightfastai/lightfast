---
date: 2026-02-05T07:34:51Z
researcher: Claude
git_commit: d2ee86b28fd4b2ff54719b241aa4d64b7ad25128
branch: main
repository: lightfast
topic: "Search API Evaluation Pipeline & Golden Dataset Design"
tags: [research, evaluation, golden-dataset, search-api, precision, recall, rag, braintrust, pinecone]
status: complete
last_updated: 2026-02-05
last_updated_by: Claude
---

# Research: Search API Evaluation Pipeline & Golden Dataset Design

**Date**: 2026-02-05T07:34:51Z
**Researcher**: Claude
**Git Commit**: d2ee86b28fd4b2ff54719b241aa4d64b7ad25128
**Branch**: main
**Repository**: lightfast

## Research Question

How can we design and build an end-to-end pipeline for evaluating Lightfast's search architecture and finding/creating a golden dataset? The goal is to progressively ensure higher accuracy and precision with the search API, potentially in isolation from production.

## Summary

Lightfast has substantial existing infrastructure for evaluation that can be extended into a comprehensive pipeline:

1. **Existing Foundation**: Scientific evaluation framework documented in `thoughts/shared/research/2025-12-14-neural-memory-scientific-evaluation-framework.md` with three-layer measurement (Pipeline, Retrieval, RAG Triad)

2. **Current Search Architecture**: Four-path parallel search (`four-path-search.ts`) combining vector similarity, entity search, cluster context, and actor profiles

3. **Evaluation Infrastructure**:
   - Braintrust integration patterns exist in `apps/chat/src/eval/`
   - Test data package (`packages/console-test-data/`) with datasets and verification
   - Query scenarios in `docs/examples/query-scenarios/`
   - Environment isolation architecture (local → isolated → integration modes)

4. **Gap Analysis**: No dedicated `packages/console-eval/` package exists yet. The eval infrastructure is scattered across chat evals and test-data package.

---

## Detailed Findings

### 1. Current Search Architecture (Four-Path Search)

The search API implements a sophisticated four-path parallel retrieval system:

**Location**: `apps/console/src/lib/neural/four-path-search.ts`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FOUR-PATH PARALLEL SEARCH                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Query → Embedding → ┬─────────────────────────────────────────────────────┐│
│                      │                                                      ││
│    ┌─────────────────┼─────────────────┬─────────────────┬─────────────────┐│
│    │                 │                 │                 │                 ││
│    ▼                 ▼                 ▼                 ▼                 ││
│  Path 1           Path 2           Path 3           Path 4                ││
│  Vector           Entity           Cluster          Actor                 ││
│  Search           Search           Search           Search                ││
│  (Pinecone)       (Pattern)        (Context)        (Profile)             ││
│    │                 │                 │                 │                 ││
│    └─────────────────┴─────────────────┴─────────────────┘                 ││
│                      │                                                      ││
│                      ▼                                                      ││
│               Merge & Dedupe → LLM Filter (Key 2) → Rerank → Results       ││
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Components**:
- `four-path-search.ts` - Main hybrid search implementation (650+ lines)
- `cluster-search.ts` - Cluster-based search
- `entity-search.ts` - Entity-based search
- `actor-search.ts` - Actor profile search
- `llm-filter.ts` - LLM-based result filtering (Key 2 in 2-key retrieval)

### 2. Existing Evaluation Framework Design

The scientific evaluation framework (`2025-12-14-neural-memory-scientific-evaluation-framework.md`) defines three measurement layers:

#### Layer 1: Ingestion Pipeline Metrics (Write Path)

| Metric | Description | Target |
|--------|-------------|--------|
| Throughput | Events processed per minute | ≥100/min |
| Capture Latency (p95) | Time from webhook to observation stored | <500ms |
| Significance Scoring Accuracy | True positive rate for score ≥60 | ≥85% |
| Entity Extraction F1 | Precision × Recall for extracted entities | ≥0.75 |

#### Layer 2: Retrieval Metrics (Read Path)

| Metric | Formula | Target |
|--------|---------|--------|
| Recall@K | \|Relevant ∩ Top K\| / \|Relevant\| | ≥0.85 @ K=10 |
| Precision@K | \|Relevant ∩ Top K\| / K | ≥0.70 @ K=10 |
| NDCG@K | DCG@K / IDCG@K | ≥0.75 @ K=10 |
| MRR | 1/\|Q\| × Σ(1/rank_i) | ≥0.80 |
| LLM Filter Precision | % of filtered candidates truly relevant | ≥0.90 |

#### Layer 3: RAG Triad Metrics (Output Quality)

| Metric | Target | Method |
|--------|--------|--------|
| Faithfulness | ≥0.70 | RAGAS `faithfulness` scorer |
| Context Relevance | ≥0.75 | RAGAS `context_precision` |
| Answer Relevance | ≥0.80 | RAGAS `answer_relevancy` |

### 3. Existing Test Infrastructure

#### Test Data Package (`packages/console-test-data/`)

**Datasets**:
- `datasets/comprehensive.json` (137KB) - Comprehensive test webhooks
- `datasets/performance.json` (12KB) - Performance-focused events
- `datasets/security.json` (15KB) - Security test scenarios
- `datasets/webhook-schema.json` - Schema validation

**Architecture**:
```
Raw Webhook → transformWebhook() → SourceEvent → inngest.send() → observation.capture
     ↑                                                                    ↓
 (GitHub/Vercel format)                                          Significance Gate
                                                                         ↓
                                                   ┌─────────────────────┼─────────────────────┐
                                                   ↓                     ↓                     ↓
                                              Classify              Embed (3x)         Extract Entities
                                                   ↓                     ↓                     ↓
                                                   └─────────────────────┼─────────────────────┘
                                                                         ↓
                                                                 Cluster Assignment
                                                                         ↓
                                                                 Actor Resolution
                                                                         ↓
                                                                      Store
```

#### Query Scenarios (`docs/examples/query-scenarios/query_scenarios.json`)

20 query scenarios with intents:
- `incident_search` - "What broke in the checkout service last night?"
- `ownership` - "Who owns the notifications service?"
- `dependency` - "What depends on the user-profile API?"
- `decision` - "Why did we decide to use PlanetScale?"
- `temporal_diff` - "What changed in the auth module since last Tuesday?"
- `expertise` - "Who has context on the webhook delivery system?"
- `agent_context` - "I'm working on batch webhooks—what's relevant context?"

Each scenario includes:
- `expectedSignals` - Which retrieval paths should activate
- `filters` - Source types, observation types, date ranges
- `rationaleNeeded` - Whether explanation is required

### 4. Environment Isolation Architecture

The evaluation environment architecture (`2025-12-14-neural-memory-eval-environment-architecture.md`) defines three modes:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENVIRONMENT ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  RESEARCH PIPELINE (eval) - Cost: $0, Speed: Fast                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐   │
│  │   Fixtures   │  │   Mock DB    │  │   Pinecone: eval namespace       │   │
│  │   JSON files │  │   In-memory  │  │   eval_{runId}:ws_{workspaceId}  │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────────────┘   │
│                                                                              │
│  INTEGRATION PIPELINE (dev) - Cost: Medium, Speed: Minutes                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐   │
│  │  Test Data   │  │ PlanetScale  │  │   Pinecone: dev namespace        │   │
│  │  Package     │  │   Branch     │  │   dev_{branch}:ws_{workspaceId}  │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────────────┘   │
│                                                                              │
│  PRODUCTION PIPELINE (prod) - Real users, full infrastructure               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐   │
│  │  Real        │  │ PlanetScale  │  │   Pinecone: prod namespace       │   │
│  │  Webhooks    │  │   Main       │  │   org_{clerkOrgId}:ws_{id}       │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Insight**: 80% of evaluation work tests **logic**, not **storage**. For most eval:
- Significance scoring → No DB needed
- Entity extraction → No DB needed
- Classification → No DB needed
- Retrieval ranking → Pinecone only (pre-loaded)
- RAG quality → Pinecone only

### 5. Golden Dataset Design

#### Recommended Dataset Structure

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
```

#### Recommended Query Distribution

| Query Type | % | Example |
|------------|---|---------|
| Temporal | 30% | "What PRs were merged last week?" |
| Actor | 25% | "What is Sarah working on?" |
| Technical | 20% | "How does the auth system work?" |
| Status | 15% | "What's blocking deployment?" |
| Multi-hop | 7% | "Who approved the DB migration and when did it deploy?" |
| Null | 3% | "What did unknown-user do?" (tests precision) |

#### Recommended Data Mix

| Source | % | Rationale |
|--------|---|-----------|
| Synthetic (Ragas) | 40-50% | Controlled complexity, diverse query types |
| Real GitHub Data | 30-40% | Production-realistic, tests transformers |
| Template Scenarios | 20% | Edge cases, specific feature testing |

### 6. Proposed Evaluation Pipeline Architecture

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
│           └────────────────────────┼────────────────────────┘               │
│                                    ▼                                        │
│                     ┌──────────────────────────┐                            │
│                     │   SourceEvent Corpus     │                            │
│                     │   (via prod transformers)│                            │
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
│                                  ▼                                          │
│                     ┌──────────────────────────┐                            │
│                     │   eval_dataset.json      │                            │
│                     └──────────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7. Proposed Package Structure

```
packages/
├── console-test-data/          # Existing - webhook corpus
│   ├── datasets/
│   │   ├── security.json
│   │   ├── performance.json
│   │   └── eval/               # NEW: evaluation datasets
│   │       ├── retrieval-v1.json
│   │       ├── significance-v1.json
│   │       └── e2e-v1.json
│   └── src/
│       └── eval/               # NEW: evaluation generation
│           ├── generator.ts
│           ├── scorer.ts
│           └── metrics.ts
│
├── console-eval/               # NEW: evaluation runner package
│   └── src/
│       ├── retrieval.eval.ts   # Four-path search evaluation
│       ├── ingestion.eval.ts   # Pipeline quality evaluation
│       ├── significance.eval.ts # Significance scoring evaluation
│       ├── entity.eval.ts      # Entity extraction evaluation
│       ├── actor.eval.ts       # Actor resolution evaluation
│       ├── e2e.eval.ts         # End-to-end RAG evaluation
│       ├── cross-source.eval.ts # Multi-source scenarios
│       ├── config/
│       │   └── env.ts          # Eval environment config (local/isolated/integration)
│       ├── pinecone/
│       │   └── eval-namespace.ts # Isolated namespace management
│       └── metrics/
│           ├── retrieval.ts    # MRR, NDCG, Recall@K
│           ├── rag-triad.ts    # Faithfulness, Relevance
│           └── custom.ts       # Temporal, Actor
```

### 8. Proposed CLI Commands

```bash
# Local development (no external services)
pnpm eval:retrieval --mode=local

# Isolated eval (Pinecone only, recommended for CI)
pnpm eval:retrieval --mode=isolated

# Full integration (PlanetScale branch + Pinecone)
pnpm eval:retrieval --mode=integration --ps-branch=ps_eval

# Compare two experiments
pnpm eval:compare --baseline=retrieval-baseline-abc --candidate=retrieval-candidate-def

# Run all affected evals (for PR gate)
pnpm eval:affected --baseline=main --candidate=HEAD

# Generate evaluation dataset
pnpm eval:generate --source=github --count=100 --output=datasets/eval/retrieval-v1.json
```

### 9. CI/CD Integration

```yaml
# .github/workflows/search-eval.yml

name: Search API Evaluation

on:
  pull_request:
    paths:
      - 'apps/console/src/lib/neural/**'
      - 'api/console/src/router/org/search.ts'
      - 'packages/console-rerank/**'
      - 'packages/console-eval/**'

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - name: Run Baseline (main)
        run: |
          git checkout main
          pnpm --filter @repo/console-eval eval:retrieval --tag=baseline-${{ github.run_id }}

      - name: Run Candidate (PR)
        run: |
          git checkout ${{ github.head_ref }}
          pnpm --filter @repo/console-eval eval:retrieval --tag=candidate-${{ github.run_id }}

      - name: Compare & Report
        run: |
          pnpm --filter @repo/console-eval compare \
            --baseline=baseline-${{ github.run_id }} \
            --candidate=candidate-${{ github.run_id }} \
            --fail-on-regression
```

### 10. Progressive Accuracy Improvement Strategy

#### Phase 1: Establish Baseline (Week 1-2)
- Create 50 manually-curated eval cases covering all query types
- Run baseline metrics on current four-path search
- Document current performance: MRR, NDCG@10, Recall@10, Precision@10
- Set up Braintrust project for tracking

#### Phase 2: Expand Coverage (Week 3-4)
- Scale to 100-200 eval cases using Ragas TestsetGenerator
- Add cross-source scenarios (GitHub + Vercel + future sources)
- Implement automated quality filtering
- Set up CI evaluation gate

#### Phase 3: Targeted Improvements (Ongoing)
- Use eval results to identify weak spots:
  - Low temporal accuracy → improve date parsing
  - Low actor attribution → improve actor resolution
  - Low multi-hop recall → improve cluster context
- A/B test changes against baseline
- Only merge if no regressions + improvements meet threshold

#### Phase 4: Comprehensive Suite (Month 3+)
- Scale to 500+ eval cases
- Full ablation studies (multi-view vs single, reranking strategies)
- Drift detection for production monitoring
- Regression suite for all PRs touching search

### 11. Regression Testing Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REGRESSION TESTING PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   TRIGGER: PR touching neural/** or search-related code                     │
│                                                                              │
│   ┌──────────────────┐                                                       │
│   │ 1. Detect Change │  What component was modified?                         │
│   │    (git diff)    │  - four-path-search?                                  │
│   └────────┬─────────┘  - reranking?                                         │
│            │            - entity extraction?                                 │
│            ▼                                                                 │
│   ┌──────────────────┐                                                       │
│   │ 2. Select Suites │  Map changed files → eval suites                      │
│   │                  │  four-path-search.ts → retrieval.eval.ts              │
│   └────────┬─────────┘  entity-extraction.ts → entity.eval.ts                │
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
│   └────────┬─────────┘  - Improvement detection                              │
│            │                                                                 │
│            ▼                                                                 │
│   ┌──────────────────┐                                                       │
│   │ 6. Report        │  Pass/Fail + metric deltas                            │
│   └──────────────────┘  Post as PR comment                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12. Regression Thresholds

```typescript
const REGRESSION_THRESHOLDS = {
  // Retrieval - allow max 5% drop
  "recall@10": -0.05,
  "precision@10": -0.05,
  "mrr": -0.05,
  "ndcg@10": -0.05,

  // RAG Triad - stricter, 3% max drop
  "faithfulness": -0.03,
  "context_relevance": -0.05,
  "answer_relevancy": -0.05,

  // Latency - allow max 50ms increase
  "p95_latency_ms": 50,

  // Component-specific
  "significance_tpr": -0.05,
  "entity_f1": -0.05,
  "actor_accuracy": -0.03,
};
```

---

## Code References

### Search Implementation
- `apps/console/src/lib/neural/four-path-search.ts:1-300` - Four-path parallel search
- `apps/console/src/lib/neural/llm-filter.ts` - LLM gating (Key 2)
- `apps/console/src/lib/neural/cluster-search.ts` - Cluster-based search
- `apps/console/src/lib/neural/entity-search.ts` - Entity-based search
- `apps/console/src/lib/neural/actor-search.ts` - Actor profile search

### Configuration
- `packages/console-config/src/private-config.ts:1-200` - Pinecone and embedding config
- `packages/console-validation/src/constants/embedding.ts` - Embedding defaults

### Test Data
- `packages/console-test-data/datasets/comprehensive.json` - Webhook test data
- `packages/console-test-data/src/verifier/verifier.ts` - Verification logic
- `docs/examples/query-scenarios/query_scenarios.json` - 20 query scenarios

### Existing Evaluation
- `apps/chat/src/eval/*.eval.ts` - Braintrust evaluation patterns
- `packages/ai/src/eval/test.eval.ts` - AI evaluation template

---

## Historical Context (from thoughts/)

### Highly Relevant Documents

1. **`thoughts/shared/research/2025-12-14-neural-memory-scientific-evaluation-framework.md`**
   - Comprehensive scientific evaluation framework
   - Three-layer metrics: Pipeline, Retrieval, RAG Triad
   - Dataset generation pipeline design
   - Research paper structure for evaluation

2. **`thoughts/shared/research/2025-12-14-neural-memory-eval-environment-architecture.md`**
   - Environment isolation strategy (local/isolated/integration)
   - Pinecone namespace management for eval
   - Git workflow for evaluation CI/CD
   - Cost analysis for different modes

3. **`thoughts/changelog/search-api-hybrid-retrieval-cross-encoder-20251217-143022.md`**
   - Hybrid retrieval implementation details
   - Cross-encoder reranking documentation

### Supporting Documents

- `thoughts/shared/research/2025-12-15-neural-memory-database-design-analysis.md` - Database schema for neural memory
- `thoughts/shared/research/2025-12-13-neural-memory-cross-source-architectural-gaps.md` - Cross-source linking gaps
- `thoughts/shared/plans/2025-12-17-neural-braintrust-step-ai-integration.md` - Braintrust integration plan

---

## Architecture Documentation

The evaluation pipeline builds on:

1. **Existing test data infrastructure** (`console-test-data`) for corpus generation
2. **Braintrust SDK** (used in `apps/chat/src/eval/`) for evaluation orchestration
3. **Ragas framework** for RAG-specific metrics
4. **Production transformers** (`console-webhooks`) for realistic data
5. **Four-path search** for the system under test

---

## Related Research

- [RAGAS Documentation](https://docs.ragas.io/) - RAG evaluation framework
- [Braintrust Documentation](https://braintrustdata.com/docs) - Evaluation platform
- [MultiHop-RAG Dataset](https://arxiv.org/abs/2401.15391) - Multi-hop query evaluation
- [STAR-RAG](https://arxiv.org/html/2510.16715v1) - Temporal RAG framework

---

## Open Questions

1. **Braintrust vs Local**: Should eval datasets live in Braintrust or git? (Proposed: Both - git for source of truth, Braintrust for CI)

2. **Cross-Source Priority**: Which source combinations to prioritize for cross-source evaluation? (Proposed: GitHub↔Linear, GitHub↔Sentry first)

3. **LLM Judge Model**: Which model for evaluation judges - haiku (fast/cheap) or sonnet (quality)?

4. **Temporal Formalization**: How to score temporal accuracy for queries like "last week"?

5. **Dataset Versioning**: How to handle breaking changes in eval dataset schema?

6. **CI Runtime Budget**: How to keep eval CI under 10 minutes while maintaining coverage?

7. **Human Annotation**: What's the minimum human review percentage for golden dataset quality?

---

## Implementation Roadmap

### Immediate Actions (This Sprint)
1. Create `packages/console-eval/` package structure
2. Port Braintrust patterns from `apps/chat/src/eval/`
3. Create initial 50-case retrieval eval dataset
4. Set up isolated Pinecone namespace for eval

### Short-Term (Next 2 Sprints)
1. Implement retrieval.eval.ts with MRR, NDCG, Recall metrics
2. Add significance.eval.ts and entity.eval.ts
3. Set up CI workflow for PR evaluation gate
4. Scale to 100+ eval cases

### Medium-Term (Next Quarter)
1. Cross-source evaluation scenarios
2. Drift detection for production monitoring
3. Full ablation study infrastructure
4. Scale to 500+ eval cases

---

_Last updated: 2026-02-05_
