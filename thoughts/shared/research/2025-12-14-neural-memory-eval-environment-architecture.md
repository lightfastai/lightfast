---
date: 2025-12-14T02:45:00Z
researcher: Claude
git_commit: ca81c4294e8e8ef8d2e0ced73848d0172a82ec1f
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Evaluation Environment Architecture & Git Workflow"
tags: [research, neural-memory, braintrust, pinecone, planetscale, evaluation, devops]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
---

# Research: Evaluation Environment Architecture & Git Workflow

**Date**: 2025-12-14T02:45:00Z
**Researcher**: Claude
**Git Commit**: ca81c4294e8e8ef8d2e0ced73848d0172a82ec1f
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

How should we design the evaluation environment architecture with Braintrust, Pinecone, and PlanetScale?
- What does the git development pipeline look like for research vs production?
- Do we need PlanetScale for the research pipeline?
- How do we isolate environments without dedicated staging branches?

## Summary

**Key Insight**: For most evaluation work, **you don't need PlanetScale at all**. The eval pipeline tests logic (scoring, extraction, retrieval ranking), not database storage.

**Recommended Architecture**:
1. **Research Pipeline**: Fixtures + Mock DB + Isolated Pinecone namespace
2. **Integration Pipeline**: PlanetScale branch + Dev Pinecone
3. **Production Pipeline**: PlanetScale main + Prod Pinecone

**Git Workflow**: Feature branches with automated eval gates, no staging branch required.

---

## Detailed Findings

### 1. The Key Question: What Are We Testing?

Different evaluation types need different infrastructure:

| Eval Type | What It Tests | DB Needed? | Pinecone Needed? |
|-----------|---------------|------------|------------------|
| **Significance Scoring** | Score calculation logic | No | No |
| **Entity Extraction** | Pattern matching + LLM extraction | No | No |
| **Classification** | Type/topic assignment | No | No |
| **Retrieval Ranking** | Vector search + reranking | No | **Yes** (pre-loaded) |
| **RAG Quality** | End-to-end generation | No | **Yes** (pre-loaded) |
| **Full Pipeline** | Ingestion + Storage + Retrieval | **Yes** | **Yes** |

**Insight**: 80% of evaluation work is testing **logic**, not **storage**.

---

### 2. Environment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ENVIRONMENT ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                        RESEARCH PIPELINE (eval)                              ││
│  │                                                                               ││
│  │  Purpose: Measure metrics, compare algorithms, A/B testing                    ││
│  │  Trigger: Manual, PR eval gate, scheduled                                     ││
│  │                                                                               ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐   ││
│  │  │   Fixtures   │  │   Mock DB    │  │   Pinecone: eval namespace       │   ││
│  │  │              │  │              │  │                                    │   ││
│  │  │  JSON files  │  │  In-memory   │  │  eval_{runId}:ws_{workspaceId}   │   ││
│  │  │  with ground │  │  or skip     │  │                                    │   ││
│  │  │  truth       │  │  entirely    │  │  Pre-loaded with test vectors     │   ││
│  │  └──────────────┘  └──────────────┘  │  Cleaned up after run             │   ││
│  │                                       └──────────────────────────────────┘   ││
│  │  Cost: $0 (except Pinecone for retrieval eval)                               ││
│  │  Speed: Fast (seconds)                                                        ││
│  │  Isolation: Complete                                                          ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                      INTEGRATION PIPELINE (dev)                              ││
│  │                                                                               ││
│  │  Purpose: Test full pipeline with real infrastructure                         ││
│  │  Trigger: Manual for complex changes, optional PR gate                        ││
│  │                                                                               ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐   ││
│  │  │  Test Data   │  │ PlanetScale  │  │   Pinecone: dev namespace        │   ││
│  │  │              │  │   Branch     │  │                                    │   ││
│  │  │  console-    │  │              │  │  dev_{branch}:ws_{workspaceId}   │   ││
│  │  │  test-data   │  │  ps_eval     │  │                                    │   ││
│  │  │  package     │  │  (ephemeral) │  │  Shared dev project               │   ││
│  │  └──────────────┘  └──────────────┘  └──────────────────────────────────┘   ││
│  │                                                                               ││
│  │  Cost: PlanetScale branch hours + Pinecone dev project                        ││
│  │  Speed: Medium (minutes)                                                      ││
│  │  Isolation: Branch-level                                                      ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                      PRODUCTION PIPELINE (prod)                              ││
│  │                                                                               ││
│  │  Purpose: Serve real users                                                    ││
│  │  Trigger: Merge to main, deploy                                               ││
│  │                                                                               ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐   ││
│  │  │  Real User   │  │ PlanetScale  │  │   Pinecone: prod namespace       │   ││
│  │  │  Webhooks    │  │   Main       │  │                                    │   ││
│  │  │              │  │              │  │  org_{clerkOrgId}:ws_{workspaceId}│   ││
│  │  │  GitHub,     │  │  Production  │  │                                    │   ││
│  │  │  Vercel, etc │  │  database    │  │  Production project (diff API key)│   ││
│  │  └──────────────┘  └──────────────┘  └──────────────────────────────────┘   ││
│  │                                                                               ││
│  │  Cost: Production                                                             ││
│  │  Speed: Real-time                                                             ││
│  │  Isolation: Per-workspace namespace                                           ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3. Do We Need PlanetScale for Research?

**Short Answer: No, for 90% of eval work.**

| Scenario | PlanetScale Needed? | Why |
|----------|---------------------|-----|
| Testing significance scoring | No | Pure function: input → score |
| Testing entity extraction | No | Pure function: observation → entities |
| Testing classification | No | Pure function: event → type + topics |
| Testing retrieval ranking | No | Pre-load vectors, test ranking logic |
| Testing RAG quality | No | Use fixtures for retrieved docs |
| Testing full ingestion pipeline | **Yes** | Need to verify DB writes |
| Testing actor profile updates | **Yes** | Need to verify profile merging |
| Testing cluster assignment | **Maybe** | Could use fixtures or real DB |

**Recommendation**: Use PlanetScale branches **only** for integration tests, not for eval metrics.

#### Research Pipeline Database Strategy

```typescript
// Option 1: Skip DB entirely for logic tests
// Most eval cases test pure functions

interface SignificanceEvalCase {
  input: SourceEvent;
  expectedScore: number;
  // No DB needed - just test the function
}

const result = await evaluateSignificance(evalCase.input);
expect(result.score).toBeCloseTo(evalCase.expectedScore, 0.1);

// Option 2: Use fixtures for retrieval tests
// Pre-computed observations with embeddings

interface RetrievalEvalCase {
  query: string;
  queryEmbedding: number[];  // Pre-computed
  candidateObservations: {
    id: string;
    embedding: number[];
    content: string;
    isRelevant: boolean;  // Ground truth
  }[];
}

// Load into Pinecone eval namespace, run retrieval, measure ranking
```

---

### 4. Pinecone Isolation Strategy

Current production namespace format:
```
org_{clerkOrgId}:ws_{workspaceId}
```

**Eval namespace strategy**:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        PINECONE NAMESPACE STRATEGY                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  PRODUCTION (lightfast-prod project, PINECONE_API_KEY_PROD):                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  Index: lightfast-v1                                                         ││
│  │                                                                               ││
│  │  Namespaces:                                                                  ││
│  │    org_abc123:ws_xyz789         (Org ABC, Workspace XYZ)                     ││
│  │    org_abc123:ws_uvw456         (Org ABC, Workspace UVW)                     ││
│  │    org_def456:ws_rst123         (Org DEF, Workspace RST)                     ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  DEVELOPMENT (lightfast-dev project, PINECONE_API_KEY_DEV):                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  Index: lightfast-v1                                                         ││
│  │                                                                               ││
│  │  Namespaces:                                                                  ││
│  │    dev_local:ws_test001         (Local dev testing)                          ││
│  │    dev_jeevan:ws_manual         (Manual dev testing)                         ││
│  │    eval_abc123:ws_retrieval     (Eval run abc123)                            ││
│  │    eval_def456:ws_significance  (Eval run def456)                            ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  EVAL NAMESPACE LIFECYCLE:                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  1. Generate unique run ID: eval_{timestamp}_{random}                        ││
│  │  2. Create namespace: eval_{runId}:ws_{testWorkspaceId}                      ││
│  │  3. Load test vectors from fixtures                                           ││
│  │  4. Run evaluation queries                                                    ││
│  │  5. Clean up: Delete all vectors in namespace                                 ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Implementation

```typescript
// packages/console-eval/src/pinecone/eval-namespace.ts

export function createEvalNamespace(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `eval_${timestamp}_${random}`;
}

export function buildEvalWorkspaceNamespace(
  evalRunId: string,
  testWorkspaceId: string
): string {
  return `${evalRunId}:ws_${testWorkspaceId}`;
}

export async function setupEvalNamespace(
  evalRunId: string,
  testWorkspaceId: string,
  fixtures: EvalFixture[]
): Promise<void> {
  const namespace = buildEvalWorkspaceNamespace(evalRunId, testWorkspaceId);
  const client = createConsolePineconeClient();

  // Upsert test vectors
  await client.upsertVectors(
    PINECONE_CONFIG.index.name,
    {
      vectors: fixtures.map(f => ({
        id: f.id,
        values: f.embedding,
        metadata: f.metadata,
      })),
    },
    namespace
  );
}

export async function cleanupEvalNamespace(
  evalRunId: string,
  testWorkspaceId: string
): Promise<void> {
  const namespace = buildEvalWorkspaceNamespace(evalRunId, testWorkspaceId);
  const client = createConsolePineconeClient();

  // Delete all vectors in namespace
  await client.deleteByMetadata(
    PINECONE_CONFIG.index.name,
    {}, // Empty filter = delete all
    namespace
  );
}
```

---

### 5. Git Workflow Without Staging Branch

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GIT WORKFLOW                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                              main (production)                                   │
│  ════════════════════════════════●═══════════════════════════════════════════   │
│                                  ▲                                               │
│                                  │ merge (after eval passes)                     │
│                                  │                                               │
│  feat/significance-rework ───────●───────────────────────────────────────────   │
│                                  │                                               │
│                    ┌─────────────┴─────────────┐                                │
│                    │     PR EVAL GATE          │                                │
│                    │                           │                                │
│                    │  1. Detect changed files  │                                │
│                    │  2. Run affected evals    │                                │
│                    │  3. Compare vs baseline   │                                │
│                    │  4. Pass/Fail verdict     │                                │
│                    └───────────────────────────┘                                │
│                                                                                  │
│                                                                                  │
│  WORKFLOW STEPS:                                                                 │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. DEVELOP                                                                  │ │
│  │    - Create feature branch from main                                        │ │
│  │    - Make changes to neural memory code                                     │ │
│  │    - Run local eval: pnpm eval:significance --local                         │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                         │                                                        │
│                         ▼                                                        │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │ 2. PR + AUTOMATED EVAL                                                      │ │
│  │    - Open PR to main                                                        │ │
│  │    - CI detects neural/** changes                                           │ │
│  │    - CI runs: pnpm eval:affected --baseline=main --candidate=HEAD           │ │
│  │    - CI posts comparison report as PR comment                               │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                         │                                                        │
│                         ▼                                                        │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │ 3. REVIEW EVAL RESULTS                                                      │ │
│  │    - Check for regressions (> threshold)                                    │ │
│  │    - Review improvements                                                    │ │
│  │    - Decide: merge, iterate, or investigate                                 │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                         │                                                        │
│                         ▼                                                        │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │ 4. MERGE + DEPLOY                                                           │ │
│  │    - Merge to main                                                          │ │
│  │    - Vercel auto-deploys to production                                      │ │
│  │    - New baseline is recorded for future comparisons                        │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                         │                                                        │
│                         ▼                                                        │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │ 5. MONITOR (production)                                                     │ │
│  │    - Daily drift detection runs                                             │ │
│  │    - Alert if metrics deviate > 2 std dev                                   │ │
│  │    - Investigate if alert fires                                             │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 6. When to Use PlanetScale Branches

PlanetScale branches are useful for **integration testing**, not eval:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     PLANETSCALE BRANCH USAGE                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  USE CASES WHERE PS BRANCH IS NEEDED:                                            │
│                                                                                  │
│  1. Schema Migration Testing                                                     │
│     - New column added to workspace_neural_observations                          │
│     - Need to verify migration + rollback                                        │
│     - Branch: ps_schema_{migration_name}                                         │
│                                                                                  │
│  2. Full Pipeline Integration Test                                               │
│     - Test: webhook → Inngest → DB + Pinecone                                    │
│     - Manual verification of stored data                                         │
│     - Branch: ps_integration_{feature}                                           │
│                                                                                  │
│  3. Complex Transaction Testing                                                  │
│     - Actor profile merging across observations                                  │
│     - Cluster reassignment logic                                                 │
│     - Branch: ps_transaction_{test_name}                                         │
│                                                                                  │
│  LIFECYCLE:                                                                      │
│                                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│  │  Create  │───▶│  Seed    │───▶│  Test    │───▶│  Delete  │                  │
│  │  Branch  │    │  Data    │    │  Feature │    │  Branch  │                  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘                  │
│                                                                                  │
│  CLI:                                                                            │
│  $ pscale branch create lightfast-db ps_integration_actors                       │
│  $ pscale connect lightfast-db ps_integration_actors --port 3309                 │
│  ... run tests ...                                                               │
│  $ pscale branch delete lightfast-db ps_integration_actors                       │
│                                                                                  │
│  COST:                                                                           │
│  - Free tier: 5 branches included                                                │
│  - Branch hours are metered (charged when active)                                │
│  - Recommendation: Delete branches after use                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 7. Braintrust Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        BRAINTRUST ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  PROJECT STRUCTURE:                                                              │
│                                                                                  │
│  lightfast (Braintrust project)                                                  │
│  ├── Datasets                                                                    │
│  │   ├── neural-memory-significance-v1     (significance eval cases)             │
│  │   ├── neural-memory-entity-v1           (entity extraction cases)             │
│  │   ├── neural-memory-retrieval-v1        (retrieval ranking cases)             │
│  │   └── neural-memory-e2e-v1              (end-to-end RAG cases)                │
│  │                                                                               │
│  ├── Experiments (auto-created per eval run)                                     │
│  │   ├── significance-baseline-2024-01-15                                        │
│  │   ├── significance-candidate-abc123-2024-01-16                                │
│  │   ├── retrieval-baseline-2024-01-15                                           │
│  │   └── ...                                                                     │
│  │                                                                               │
│  └── Prompts (optional - for LLM judge prompts)                                  │
│      ├── relevance-judge                                                         │
│      └── faithfulness-judge                                                      │
│                                                                                  │
│                                                                                  │
│  EVAL FLOW:                                                                      │
│                                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                     │
│  │   Dataset    │────▶│   Task Fn    │────▶│   Scorers    │                     │
│  │              │     │              │     │              │                     │
│  │  Load from   │     │  Run neural  │     │  Calculate   │                     │
│  │  Braintrust  │     │  memory fn   │     │  metrics     │                     │
│  │  or local    │     │  under test  │     │              │                     │
│  └──────────────┘     └──────────────┘     └──────────────┘                     │
│                                                   │                             │
│                                                   ▼                             │
│                              ┌──────────────────────────────┐                   │
│                              │   Braintrust Experiment      │                   │
│                              │                              │                   │
│                              │  - Stores all inputs/outputs │                   │
│                              │  - Calculates aggregates     │                   │
│                              │  - Enables comparison UI     │                   │
│                              │  - Tracks over time          │                   │
│                              └──────────────────────────────┘                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Dataset Management

```typescript
// packages/console-eval/src/datasets.ts

import { initDataset } from "braintrust";

// Option 1: Load from Braintrust (versioned, shared)
async function loadFromBraintrust(datasetName: string) {
  const dataset = await initDataset({
    project: "lightfast",
    name: datasetName,
  });
  return dataset;
}

// Option 2: Load from local JSON (faster for development)
async function loadFromLocal(datasetPath: string) {
  const data = await fs.readFile(datasetPath, "utf-8");
  return JSON.parse(data);
}

// Eval file structure
export const significanceEval = Eval("neural-memory-significance", {
  data: async () => {
    // Use Braintrust dataset for CI, local for development
    if (process.env.USE_BRAINTRUST_DATASETS) {
      return loadFromBraintrust("neural-memory-significance-v1");
    }
    return loadFromLocal("datasets/eval/significance-v1.json");
  },

  task: async (input) => {
    // Function under test - no DB needed
    return evaluateSignificance(input.sourceEvent);
  },

  scores: [
    truePositiveRate({ threshold: 60 }),
    falsePositiveRate({ threshold: 60 }),
    scoreCorrelation(),
  ],
});
```

---

### 8. Environment Configuration

```typescript
// packages/console-eval/src/config/env.ts

/**
 * Evaluation environment configuration
 *
 * Three modes:
 * 1. local: No external services (fastest, for development)
 * 2. isolated: Isolated Pinecone namespace, no DB (default for CI)
 * 3. integration: Full infrastructure (PlanetScale branch + dev Pinecone)
 */
export type EvalMode = "local" | "isolated" | "integration";

export interface EvalEnvConfig {
  mode: EvalMode;

  // Braintrust
  braintrustApiKey: string;
  braintrustProject: string;

  // Pinecone (only for isolated/integration)
  pineconeApiKey?: string;
  pineconeIndex?: string;
  pineconeNamespacePrefix?: string;  // "eval" or "dev"

  // PlanetScale (only for integration)
  planetscaleBranch?: string;
  databaseUrl?: string;

  // Cohere (for embeddings in isolated/integration)
  cohereApiKey?: string;
}

export function getEvalConfig(): EvalEnvConfig {
  const mode = (process.env.EVAL_MODE || "isolated") as EvalMode;

  const base = {
    mode,
    braintrustApiKey: requireEnv("BRAINTRUST_API_KEY"),
    braintrustProject: process.env.BRAINTRUST_PROJECT || "lightfast",
  };

  switch (mode) {
    case "local":
      // No external services
      return base;

    case "isolated":
      // Pinecone only, no DB
      return {
        ...base,
        pineconeApiKey: requireEnv("PINECONE_API_KEY"),
        pineconeIndex: "lightfast-v1",
        pineconeNamespacePrefix: "eval",
        cohereApiKey: requireEnv("COHERE_API_KEY"),
      };

    case "integration":
      // Full infrastructure
      return {
        ...base,
        pineconeApiKey: requireEnv("PINECONE_API_KEY"),
        pineconeIndex: "lightfast-v1",
        pineconeNamespacePrefix: "dev",
        planetscaleBranch: process.env.PLANETSCALE_BRANCH || "ps_eval",
        databaseUrl: requireEnv("DATABASE_URL"),
        cohereApiKey: requireEnv("COHERE_API_KEY"),
      };
  }
}
```

---

### 9. CLI Commands

```bash
# packages/console-eval/package.json scripts

# Local development (no external services)
pnpm eval:significance --mode=local

# Isolated eval (Pinecone only, recommended for CI)
pnpm eval:significance --mode=isolated

# Full integration (PlanetScale branch + Pinecone)
pnpm eval:significance --mode=integration --ps-branch=ps_eval_actors

# Compare two experiments
pnpm eval:compare --baseline=significance-baseline-abc --candidate=significance-candidate-def

# Run all affected evals (for PR gate)
pnpm eval:affected --baseline=main --candidate=HEAD

# Upload dataset to Braintrust
pnpm eval:upload-dataset --name=neural-memory-significance-v1 --file=datasets/eval/significance.json
```

---

### 10. CI/CD Configuration

```yaml
# .github/workflows/neural-memory-eval.yml

name: Neural Memory Evaluation

on:
  pull_request:
    paths:
      - 'api/console/src/inngest/workflow/neural/**'
      - 'packages/console-webhooks/**'
      - 'packages/console-eval/**'
      - 'packages/console-test-data/datasets/eval/**'

env:
  EVAL_MODE: isolated
  BRAINTRUST_API_KEY: ${{ secrets.BRAINTRUST_API_KEY }}
  PINECONE_API_KEY: ${{ secrets.PINECONE_API_KEY_DEV }}
  COHERE_API_KEY: ${{ secrets.COHERE_API_KEY }}

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Need full history for baseline comparison

      - name: Setup
        run: |
          pnpm install
          pnpm --filter @repo/console-eval build

      - name: Detect Changed Components
        id: detect
        run: |
          changed=$(./scripts/detect-eval-components.sh)
          echo "components=$changed" >> $GITHUB_OUTPUT

      - name: Run Baseline Eval (main)
        run: |
          git stash
          git checkout main
          pnpm --filter @repo/console-eval eval:${{ steps.detect.outputs.components }} \
            --tag=baseline-${{ github.run_id }}

      - name: Run Candidate Eval (PR)
        run: |
          git checkout ${{ github.head_ref }}
          git stash pop || true
          pnpm --filter @repo/console-eval eval:${{ steps.detect.outputs.components }} \
            --tag=candidate-${{ github.run_id }}

      - name: Compare & Report
        run: |
          pnpm --filter @repo/console-eval compare \
            --baseline=baseline-${{ github.run_id }} \
            --candidate=candidate-${{ github.run_id }} \
            --output=report.md \
            --fail-on-regression

      - name: Post PR Comment
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('report.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: report
            });

      - name: Cleanup Eval Namespaces
        if: always()
        run: |
          pnpm --filter @repo/console-eval cleanup-namespaces \
            --prefix=eval_${{ github.run_id }}
```

---

### 11. Cost Analysis

| Environment | Pinecone | PlanetScale | Cohere | Braintrust | Total |
|-------------|----------|-------------|--------|------------|-------|
| **Local** | $0 | $0 | $0 | Free tier | $0 |
| **Isolated (CI)** | ~$0.01/run | $0 | ~$0.001/run | Free tier | ~$0.01/run |
| **Integration** | ~$0.01/run | ~$0.10/hr branch | ~$0.001/run | Free tier | ~$0.12/run |
| **Production** | $70/mo (est) | $29/mo | $5/mo | Free tier | ~$104/mo |

**Recommendation**: Use **isolated mode** (Pinecone only) for CI eval to minimize cost while maintaining realistic retrieval testing.

---

### 12. Summary Decision Tree

```
Q: What are you testing?
│
├── Significance scoring logic
│   └── Use: LOCAL mode (no infra needed)
│
├── Entity extraction patterns
│   └── Use: LOCAL mode (no infra needed)
│
├── Retrieval ranking quality
│   └── Use: ISOLATED mode (Pinecone only)
│
├── RAG end-to-end quality
│   └── Use: ISOLATED mode (Pinecone only)
│
├── Full pipeline with DB writes
│   └── Use: INTEGRATION mode (PS branch + Pinecone)
│
└── Schema migration validation
    └── Use: INTEGRATION mode (PS branch only)
```

---

## Code References

- `packages/console-config/src/private-config.ts:34-122` - Pinecone configuration
- `packages/console-test-data/src/verifier/verifier.ts:134-136` - Namespace building
- `packages/console-pinecone/src/client.ts:67-79` - Pinecone upsert with namespace
- `apps/chat/src/eval/*.eval.ts` - Existing Braintrust patterns

---

## Follow-up: Multi-Source Scalability & Cross-Source Evaluation

**Added**: 2025-12-14T03:15:00Z
**Question**: How does this architecture scale when adding new sources (Linear, Sentry, Slack)?

### 13. Layered Eval Architecture for Multiple Sources

The core insight: **Most eval is source-agnostic**. Only transformer tests and cross-source scenarios need per-source work.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     LAYERED EVAL ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  LAYER 1: TRANSFORMER TESTS (per-source, linear growth)                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐││
│  │  │github.eval │ │linear.eval │ │sentry.eval │ │slack.eval  │ │vercel.eval │││
│  │  │            │ │            │ │            │ │            │ │            │││
│  │  │ Webhook →  │ │ Webhook →  │ │ Webhook →  │ │ Webhook →  │ │ Webhook →  │││
│  │  │ SourceEvt  │ │ SourceEvt  │ │ SourceEvt  │ │ SourceEvt  │ │ SourceEvt  │││
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘││
│  │                                                                              ││
│  │  Growth: O(n) where n = number of sources                                    ││
│  │  Work per source: ~1 eval file + ~10 webhook fixtures                        ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  LAYER 2: PIPELINE TESTS (source-agnostic, constant)                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐               ││
│  │  │scoring.eval│ │entity.eval │ │classify.evl│ │cluster.eval│               ││
│  │  │            │ │            │ │            │ │            │               ││
│  │  │SourceEvent │ │Observation │ │SourceEvent │ │Observation │               ││
│  │  │  → Score   │ │ → Entities │ │ → Type     │ │ → Cluster  │               ││
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘               ││
│  │                                                                              ││
│  │  Growth: O(1) - same tests, just add more SourceEvents to dataset            ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  LAYER 3: RETRIEVAL & RAG TESTS (source-agnostic, constant)                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐               ││
│  │  │retrieval   │ │rag.eval    │ │temporal    │ │actor.eval  │               ││
│  │  │            │ │            │ │            │ │            │               ││
│  │  │Query →     │ │Query →     │ │"last week" │ │"What did   │               ││
│  │  │Ranked Obs  │ │Answer      │ │ accuracy   │ │ Sarah do?" │               ││
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘               ││
│  │                                                                              ││
│  │  Growth: O(1) - source is just metadata, retrieval is source-agnostic        ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  LAYER 4: CROSS-SOURCE TESTS (scenario-based, curated growth)                    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  ┌──────────────────────────────────────────────────────────────────────┐   ││
│  │  │ cross-source.eval                                                     │   ││
│  │  │                                                                        │   ││
│  │  │ - Reference linking (GitHub PR → Linear issue)                         │   ││
│  │  │ - Actor resolution (same person across sources)                        │   ││
│  │  │ - Multi-source retrieval (query spans GitHub + Sentry)                 │   ││
│  │  │ - Scenario coherence (incident timeline across sources)                │   ││
│  │  └──────────────────────────────────────────────────────────────────────┘   ││
│  │                                                                              ││
│  │  Growth: O(scenarios) - curated, not O(n²) source combinations               ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 14. Cross-Source Evaluation Framework

#### A. Cross-Source Eval Types

| Eval Type | What It Tests | Example |
|-----------|---------------|---------|
| **Reference Linking** | Are cross-source references detected? | GitHub PR body says "Fixes LIN-123" |
| **Actor Resolution** | Is the same person identified across sources? | `@alice` on GitHub = `alice@co.com` on Linear |
| **Multi-Source Retrieval** | Does search find relevant docs from all sources? | "auth bug" → GitHub PR + Sentry error + Linear issue |
| **Scenario Coherence** | Does the system understand event sequences? | Incident: Sentry alert → Linear ticket → GitHub fix → Slack announcement |

#### B. Cross-Source Eval Schema

```typescript
// packages/console-eval/src/cross-source/types.ts

/**
 * A cross-source scenario represents a real-world workflow
 * that spans multiple sources
 */
interface CrossSourceScenario {
  id: string;
  name: string;
  description: string;

  // Events in chronological order
  events: CrossSourceEvent[];

  // Expected outcomes
  expectations: {
    links: ExpectedLink[];
    actors: ExpectedActorResolution[];
    retrieval: ExpectedRetrievalResult[];
  };
}

interface CrossSourceEvent {
  // Event identification
  id: string;
  source: "github" | "linear" | "sentry" | "slack" | "vercel";
  eventType: string;
  occurredAt: string;  // ISO timestamp

  // Raw webhook (for transformer testing)
  webhook: object;

  // Expected SourceEvent (for validation)
  expectedSourceEvent: {
    title: string;
    sourceType: string;
    references?: { type: string; id: string }[];
  };
}

interface ExpectedLink {
  // Source event references target
  sourceEventId: string;
  targetEventId: string;
  linkType: "fixes" | "closes" | "mentions" | "caused_by" | "blocks" | "related";
  confidence: number;  // Expected confidence score
}

interface ExpectedActorResolution {
  // Canonical actor that should be created/matched
  canonicalActorId: string;
  displayName: string;

  // Identities that should be linked
  identities: {
    source: string;
    sourceUserId: string;
    sourceUsername?: string;
    sourceEmail?: string;
    mappingMethod: "oauth" | "email" | "heuristic";
    expectedConfidence: number;
  }[];
}

interface ExpectedRetrievalResult {
  // Query to test
  query: string;
  queryType: "temporal" | "actor" | "technical" | "multi-hop";

  // Expected observations (by event ID from scenario)
  expectedEventIds: string[];

  // Sources that should be represented in results
  expectedSources: string[];

  // Minimum retrieval metrics
  minRecall: number;
  minPrecision: number;
}
```

#### C. Example Scenarios

```typescript
// packages/console-test-data/datasets/scenarios/security-incident.ts

export const securityIncidentScenario: CrossSourceScenario = {
  id: "scenario-security-001",
  name: "SQL Injection Fix",
  description: "Security vulnerability discovered, triaged, fixed, and announced",

  events: [
    // 1. Sentry detects the error
    {
      id: "evt-sentry-alert",
      source: "sentry",
      eventType: "issue.created",
      occurredAt: "2024-01-15T09:00:00Z",
      webhook: {
        action: "created",
        data: {
          issue: {
            id: "SENTRY-456",
            title: "PossibleSQLInjection: Unsanitized input in /api/users",
            culprit: "api/users/route.ts in getUserById",
            level: "error",
            firstSeen: "2024-01-15T09:00:00Z",
            // ... full Sentry webhook
          },
        },
      },
      expectedSourceEvent: {
        title: "PossibleSQLInjection: Unsanitized input in /api/users",
        sourceType: "error_created",
        references: [
          { type: "file", id: "api/users/route.ts" },
        ],
      },
    },

    // 2. Linear issue created for triage
    {
      id: "evt-linear-issue",
      source: "linear",
      eventType: "Issue.create",
      occurredAt: "2024-01-15T09:15:00Z",
      webhook: {
        action: "create",
        type: "Issue",
        data: {
          id: "LIN-123",
          identifier: "SEC-42",
          title: "URGENT: SQL injection vulnerability in user API",
          description: "Sentry detected SQL injection.\n\nRef: SENTRY-456\n\nNeed immediate fix.",
          priority: 1,
          state: { name: "In Progress" },
          assignee: { id: "user-alice", email: "alice@company.com" },
          // ... full Linear webhook
        },
      },
      expectedSourceEvent: {
        title: "URGENT: SQL injection vulnerability in user API",
        sourceType: "issue_created",
        references: [
          { type: "sentry_issue", id: "SENTRY-456" },
        ],
      },
    },

    // 3. GitHub PR fixes the issue
    {
      id: "evt-github-pr",
      source: "github",
      eventType: "pull_request",
      occurredAt: "2024-01-15T11:00:00Z",
      webhook: {
        action: "closed",
        pull_request: {
          number: 789,
          title: "fix(security): Parameterize SQL queries in user API",
          body: "## Summary\nFixes SQL injection vulnerability.\n\nFixes SEC-42\nCloses SENTRY-456",
          merged: true,
          user: { login: "alice", id: 12345 },
          // ... full GitHub webhook
        },
      },
      expectedSourceEvent: {
        title: "fix(security): Parameterize SQL queries in user API",
        sourceType: "pull_request_merged",
        references: [
          { type: "linear_issue", id: "SEC-42" },
          { type: "sentry_issue", id: "SENTRY-456" },
        ],
      },
    },

    // 4. Vercel deployment succeeds
    {
      id: "evt-vercel-deploy",
      source: "vercel",
      eventType: "deployment.succeeded",
      occurredAt: "2024-01-15T11:30:00Z",
      webhook: {
        type: "deployment.succeeded",
        payload: {
          deployment: {
            id: "dpl_xyz",
            meta: {
              githubCommitSha: "abc123",
              githubCommitMessage: "fix(security): Parameterize SQL queries",
              githubPrId: "789",
            },
          },
        },
      },
      expectedSourceEvent: {
        title: "Deployment succeeded: fix(security): Parameterize SQL queries",
        sourceType: "deployment_succeeded",
        references: [
          { type: "commit", id: "abc123" },
          { type: "pr", id: "789" },
        ],
      },
    },

    // 5. Slack announcement
    {
      id: "evt-slack-announce",
      source: "slack",
      eventType: "message",
      occurredAt: "2024-01-15T12:00:00Z",
      webhook: {
        type: "message",
        channel: "C-security",
        user: "U-alice",
        text: "Security fix deployed! SQL injection in /api/users is now patched. PR #789",
        // ... full Slack webhook
      },
      expectedSourceEvent: {
        title: "Security fix deployed! SQL injection in /api/users is now patched",
        sourceType: "message",
        references: [
          { type: "pr", id: "789" },
        ],
      },
    },
  ],

  expectations: {
    // Expected cross-source links
    links: [
      {
        sourceEventId: "evt-linear-issue",
        targetEventId: "evt-sentry-alert",
        linkType: "related",
        confidence: 0.9,
      },
      {
        sourceEventId: "evt-github-pr",
        targetEventId: "evt-linear-issue",
        linkType: "fixes",
        confidence: 0.95,
      },
      {
        sourceEventId: "evt-github-pr",
        targetEventId: "evt-sentry-alert",
        linkType: "closes",
        confidence: 0.9,
      },
      {
        sourceEventId: "evt-vercel-deploy",
        targetEventId: "evt-github-pr",
        linkType: "related",
        confidence: 1.0,
      },
    ],

    // Expected actor resolution
    actors: [
      {
        canonicalActorId: "actor-alice",
        displayName: "Alice",
        identities: [
          {
            source: "github",
            sourceUserId: "12345",
            sourceUsername: "alice",
            mappingMethod: "oauth",
            expectedConfidence: 1.0,
          },
          {
            source: "linear",
            sourceUserId: "user-alice",
            sourceEmail: "alice@company.com",
            mappingMethod: "email",
            expectedConfidence: 0.85,
          },
          {
            source: "slack",
            sourceUserId: "U-alice",
            mappingMethod: "heuristic",
            expectedConfidence: 0.6,
          },
        ],
      },
    ],

    // Expected retrieval results
    retrieval: [
      {
        query: "What was done to fix the SQL injection?",
        queryType: "technical",
        expectedEventIds: ["evt-sentry-alert", "evt-linear-issue", "evt-github-pr"],
        expectedSources: ["sentry", "linear", "github"],
        minRecall: 0.9,
        minPrecision: 0.7,
      },
      {
        query: "What did Alice work on this week?",
        queryType: "actor",
        expectedEventIds: ["evt-linear-issue", "evt-github-pr", "evt-slack-announce"],
        expectedSources: ["linear", "github", "slack"],
        minRecall: 0.8,
        minPrecision: 0.6,
      },
      {
        query: "Show me the security incident timeline",
        queryType: "temporal",
        expectedEventIds: ["evt-sentry-alert", "evt-linear-issue", "evt-github-pr", "evt-vercel-deploy", "evt-slack-announce"],
        expectedSources: ["sentry", "linear", "github", "vercel", "slack"],
        minRecall: 0.9,
        minPrecision: 0.8,
      },
    ],
  },
};
```

#### D. Cross-Source Eval Implementation

```typescript
// packages/console-eval/src/cross-source/cross-source.eval.ts

import { Eval } from "braintrust";
import { loadScenarios } from "./scenarios";

export const crossSourceEval = Eval("neural-memory-cross-source", {
  data: async () => {
    const scenarios = await loadScenarios([
      "security-incident",
      "feature-development",
      "incident-response",
      "release-cycle",
    ]);

    // Flatten scenarios into eval cases
    return scenarios.flatMap(scenario => [
      // Link detection cases
      ...scenario.expectations.links.map(link => ({
        type: "link" as const,
        scenario: scenario.id,
        ...link,
        events: scenario.events,
      })),

      // Actor resolution cases
      ...scenario.expectations.actors.map(actor => ({
        type: "actor" as const,
        scenario: scenario.id,
        ...actor,
        events: scenario.events,
      })),

      // Retrieval cases
      ...scenario.expectations.retrieval.map(retrieval => ({
        type: "retrieval" as const,
        scenario: scenario.id,
        ...retrieval,
        events: scenario.events,
      })),
    ]);
  },

  task: async (input) => {
    switch (input.type) {
      case "link":
        return evaluateLinkDetection(input);
      case "actor":
        return evaluateActorResolution(input);
      case "retrieval":
        return evaluateMultiSourceRetrieval(input);
    }
  },

  scores: [
    // Link detection metrics
    linkDetectionPrecision(),
    linkDetectionRecall(),
    linkConfidenceAccuracy(),

    // Actor resolution metrics
    actorResolutionAccuracy(),
    identityLinkingF1(),
    crossSourceActorCoverage(),

    // Multi-source retrieval metrics
    multiSourceRecall(),
    multiSourcePrecision(),
    sourceCoverage(),        // Did we retrieve from expected sources?
    temporalOrdering(),      // Are events in correct order?
  ],
});

// Scorer implementations

function sourceCoverage() {
  return {
    name: "source_coverage",
    scorer: async (args: EvalScorerArgs) => {
      const { output, expected } = args;

      const expectedSources = new Set(expected.expectedSources);
      const retrievedSources = new Set(
        output.observations.map((o: any) => o.source)
      );

      const covered = [...expectedSources].filter(s => retrievedSources.has(s));
      const coverage = covered.length / expectedSources.size;

      return {
        score: coverage,
        metadata: {
          expectedSources: [...expectedSources],
          retrievedSources: [...retrievedSources],
          missingSources: [...expectedSources].filter(s => !retrievedSources.has(s)),
        },
      };
    },
  };
}

function temporalOrdering() {
  return {
    name: "temporal_ordering",
    scorer: async (args: EvalScorerArgs) => {
      const { output } = args;

      // Check if retrieved observations are in temporal order
      const timestamps = output.observations.map((o: any) =>
        new Date(o.occurredAt).getTime()
      );

      let inversions = 0;
      for (let i = 1; i < timestamps.length; i++) {
        if (timestamps[i] < timestamps[i - 1]) {
          inversions++;
        }
      }

      const ordering = 1 - (inversions / Math.max(timestamps.length - 1, 1));

      return {
        score: ordering,
        metadata: { inversions, totalPairs: timestamps.length - 1 },
      };
    },
  };
}
```

---

### 15. Test Data Structure for Multiple Sources

```
packages/console-test-data/
├── datasets/
│   │
│   ├── webhooks/                        # Raw webhook fixtures (per source)
│   │   ├── github/
│   │   │   ├── pull-request-merged.json
│   │   │   ├── pull-request-opened.json
│   │   │   ├── issues-opened.json
│   │   │   ├── issues-closed.json
│   │   │   └── push.json
│   │   ├── vercel/
│   │   │   ├── deployment-succeeded.json
│   │   │   ├── deployment-failed.json
│   │   │   └── deployment-created.json
│   │   ├── linear/                      # NEW
│   │   │   ├── issue-created.json
│   │   │   ├── issue-updated.json
│   │   │   ├── issue-completed.json
│   │   │   └── comment-created.json
│   │   ├── sentry/                      # NEW
│   │   │   ├── issue-created.json
│   │   │   ├── issue-resolved.json
│   │   │   └── error-created.json
│   │   └── slack/                       # NEW
│   │       ├── message-posted.json
│   │       ├── thread-reply.json
│   │       └── reaction-added.json
│   │
│   ├── scenarios/                       # Cross-source scenarios
│   │   ├── security-incident.json       # Sentry → Linear → GitHub → Vercel → Slack
│   │   ├── feature-development.json     # Linear → GitHub → Vercel
│   │   ├── incident-response.json       # Sentry → Slack → GitHub
│   │   ├── release-cycle.json           # Linear → GitHub → Vercel → Slack
│   │   └── code-review.json             # GitHub PR + comments
│   │
│   └── eval/
│       ├── transformer/                 # Per-source transformer eval
│       │   ├── github-v1.json
│       │   ├── vercel-v1.json
│       │   ├── linear-v1.json           # NEW
│       │   ├── sentry-v1.json           # NEW
│       │   └── slack-v1.json            # NEW
│       │
│       ├── pipeline/                    # Source-agnostic pipeline eval
│       │   ├── scoring-v1.json          # Mixed SourceEvents
│       │   ├── entity-v1.json           # Mixed Observations
│       │   └── classification-v1.json   # Mixed SourceEvents
│       │
│       ├── retrieval/                   # Source-agnostic retrieval eval
│       │   ├── ranking-v1.json
│       │   ├── temporal-v1.json
│       │   └── actor-v1.json
│       │
│       └── cross-source/                # Multi-source scenarios
│           ├── linking-v1.json          # Reference detection
│           ├── actors-v1.json           # Actor resolution
│           └── scenarios-v1.json        # Full scenario eval
```

---

### 16. Adding a New Source: Complete Checklist

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     NEW SOURCE CHECKLIST                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  SOURCE: Linear (example)                                                        │
│                                                                                  │
│  ═══════════════════════════════════════════════════════════════════════════════│
│  REQUIRED (do these first)                                                       │
│  ═══════════════════════════════════════════════════════════════════════════════│
│                                                                                  │
│  □ 1. TRANSFORMER                                                                │
│       Location: packages/console-webhooks/src/transformers/linear.ts             │
│       Purpose: Convert Linear webhook → SourceEvent                              │
│       Tests: Extract references (issues, users), map actor, normalize fields     │
│                                                                                  │
│  □ 2. WEBHOOK FIXTURES (5-10 realistic examples)                                 │
│       Location: packages/console-test-data/datasets/webhooks/linear/             │
│       Files:                                                                     │
│         - issue-created.json                                                     │
│         - issue-updated.json                                                     │
│         - issue-completed.json                                                   │
│         - comment-created.json                                                   │
│                                                                                  │
│  □ 3. TRANSFORMER EVAL                                                           │
│       Location: packages/console-eval/src/transformer/linear.eval.ts             │
│       Dataset: packages/console-test-data/datasets/eval/transformer/linear-v1.json│
│       Metrics: Reference extraction accuracy, actor mapping correctness          │
│                                                                                  │
│  □ 4. UPDATE MIXED PIPELINE DATASETS                                             │
│       Files to update:                                                           │
│         - datasets/eval/pipeline/scoring-v1.json (add Linear SourceEvents)       │
│         - datasets/eval/pipeline/entity-v1.json (add Linear Observations)        │
│         - datasets/eval/pipeline/classification-v1.json                          │
│                                                                                  │
│  ═══════════════════════════════════════════════════════════════════════════════│
│  CROSS-SOURCE (do after transformer works)                                       │
│  ═══════════════════════════════════════════════════════════════════════════════│
│                                                                                  │
│  □ 5. REFERENCE PATTERNS                                                         │
│       Document in: docs/architecture/sources/linear-references.md                │
│       Patterns to detect:                                                        │
│         - Linear issue in GitHub PR: "Fixes LIN-123", "Closes ENG-456"           │
│         - GitHub PR in Linear: "PR #789", "github.com/org/repo/pull/789"         │
│                                                                                  │
│  □ 6. ACTOR MAPPING                                                              │
│       Update: api/console/src/inngest/workflow/neural/actor-resolution.ts        │
│       Add Linear identity fields:                                                │
│         - Linear user ID                                                         │
│         - Linear email                                                           │
│         - Linear display name                                                    │
│                                                                                  │
│  □ 7. CROSS-SOURCE SCENARIOS                                                     │
│       Add to: packages/console-test-data/datasets/scenarios/                     │
│       Scenarios involving Linear:                                                │
│         - feature-development.json (Linear issue → GitHub PR → Deploy)           │
│         - sprint-planning.json (Linear cycle → issues → PRs)                     │
│                                                                                  │
│  □ 8. CROSS-SOURCE EVAL CASES                                                    │
│       Update: packages/console-test-data/datasets/eval/cross-source/             │
│       Add test cases for:                                                        │
│         - Linear → GitHub linking                                                │
│         - Actor resolution with Linear identity                                  │
│         - Multi-source retrieval including Linear                                │
│                                                                                  │
│  ═══════════════════════════════════════════════════════════════════════════════│
│  WHAT YOU DON'T NEED TO CHANGE                                                   │
│  ═══════════════════════════════════════════════════════════════════════════════│
│                                                                                  │
│  ✓ scoring.eval.ts        (tests SourceEvent, source-agnostic)                  │
│  ✓ entity.eval.ts         (tests Observation, source-agnostic)                  │
│  ✓ retrieval.eval.ts      (tests embeddings, source-agnostic)                   │
│  ✓ rag.eval.ts            (tests answers, source-agnostic)                      │
│  ✓ Pinecone namespace     (already workspace-scoped, not source-scoped)         │
│  ✓ Database schema        (observations table is source-agnostic)               │
│  ✓ CI pipeline            (auto-detects new eval files)                         │
│  ✓ Braintrust project     (same project, just new experiments)                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 17. Scalability Summary

| Aspect | Growth Pattern | Effort per Source |
|--------|----------------|-------------------|
| Transformer code | O(n) | ~200-400 lines |
| Webhook fixtures | O(n) | ~5-10 JSON files |
| Transformer eval | O(n) | ~1 eval file |
| Pipeline eval | O(1) | Add events to existing datasets |
| Retrieval eval | O(1) | Add observations to existing datasets |
| Cross-source scenarios | O(scenarios) | ~2-3 scenarios per source pair |
| Actor mapping | O(n) | ~50-100 lines per source |
| Pinecone namespace | O(1) | No change |
| Database schema | O(1) | No change |

**Total effort per new source**: ~2-3 days for full integration with eval coverage.

---

## Open Questions

1. **Namespace Cleanup**: How long to retain eval namespaces for debugging? (Proposal: 24 hours)
2. **Dataset Versioning**: Store in git (`datasets/eval/`) or Braintrust datasets? (Proposal: Both - git for source of truth, Braintrust for CI)
3. **Baseline Management**: How often to update the baseline? (Proposal: On merge to main)
4. **Cost Monitoring**: Add alerts for unexpected Pinecone/Cohere usage in eval?
5. **Cross-Source Priority**: Which source pairs to prioritize for linking? (Proposal: GitHub↔Linear, GitHub↔Sentry first)
6. **Scenario Coverage**: Minimum number of scenarios per source pair? (Proposal: 2-3)

---

_Last updated: 2025-12-14_
_Follow-up added: Multi-source scalability & cross-source evaluation framework_
