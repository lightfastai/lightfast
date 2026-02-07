# AI Evaluation Pipeline (Phases 1-3) Implementation Plan

## Overview

Implement a production-grade AI evaluation pipeline for Lightfast's neural search and answer systems. This plan covers dataset generation, evaluation harness, and regression detection infrastructure (Phases 1-3 from the architecture design).

**Timeline**: 4-6 weeks
**Scope**: Stop at Phase 3 (defer CI/CD gates and production feedback to future work)

## Current State Analysis

### What Exists:
- Production AI pipeline: 4-path search (`apps/console/src/lib/neural/four-path-search.ts`), 3-tier reranking, Claude Sonnet answer agent
- Test data infrastructure: `packages/console-test-data/` with CLI injection tools (`pnpm inject`)
- Braintrust tracing: `api/console/src/inngest/workflow/neural/ai-helpers.ts:16` (tracing only, not used for eval)
- Search APIs: `/v1/search` and `/v1/answer` endpoints in `apps/console/src/lib/v1/`

### What's Missing:
- `packages/console-eval/` package (does NOT exist)
- `vendor/braintrust/` vendor abstraction (does NOT exist)
- Golden dataset with query-document-relevance triples
- Evaluation metrics implementation (MRR, NDCG, Faithfulness, etc.)
- Regression detection infrastructure
- Dataset generation system (existing test data is randomly generated, not suitable for eval)

### Key Discoveries:
- `docs/examples/query-scenarios/query_scenarios.json` — **DELETE** (old code, not useful)
- `packages/console-test-data/datasets/*.json` — Randomly generated, not suitable for golden dataset
- Chat app evals (`apps/chat/src/eval/`) — Working Braintrust pattern reference, but out of scope for this plan
- Braintrust `^0.2.1` in catalog at `pnpm-workspace.yaml:36`

## Desired End State

After Phase 3 completion:

1. **Golden dataset v1**: 50 curated evaluation cases in `packages/console-eval/src/datasets/golden-v1.json`
   - Each case: query, queryType, expectedObservationIds, complexity, source
   - Generated via LLM with critic filtering and quality gates
   - Versioned and committed to git

2. **Eval workspace**: Dedicated workspace with test data pre-populated via one-time Inngest injection

3. **Working eval harness**: `packages/console-eval/` package with:
   - Metrics library: Tier 1 (retrieval) and Tier 2 (RAG quality) implementations
   - Eval runner: Synchronous HTTP-based execution (no Inngest dependency)
   - Braintrust integration: Experiment tracking and custom scorers
   - CLI: `pnpm --filter @repo/console-eval run --tier=retrieval`

4. **Vendor abstraction**: `vendor/braintrust/` following existing vendor patterns

5. **Regression detection**: Statistical comparison with paired bootstrap tests
   - CLI: `pnpm --filter @repo/console-eval compare --baseline=exp1 --candidate=exp2`
   - Reports: p-value, effect size, confidence intervals, regression flags

### Verification:
- Generate 50-case golden dataset: `pnpm --filter @repo/console-eval generate-dataset`
- Run baseline eval: `pnpm --filter @repo/console-eval run --tier=retrieval` completes in <5 minutes
- View in Braintrust: Experiment appears with all metrics logged
- Run comparison: `pnpm --filter @repo/console-eval compare` produces statistical report
- All TypeScript builds: `pnpm build` succeeds
- All tests pass: `pnpm test`

## What We're NOT Doing

- CI/CD GitHub Actions workflow (Phase 4, future work)
- Production feedback collection (Phase 5, future work)
- Multi-workspace eval (single eval workspace only)
- Component-level evals (embedding quality, entity extraction, etc.)
- A/B testing framework
- Migration of existing Braintrust usage in neural workflows or chat app (out of scope)

## Implementation Approach

**Key architectural decision**: Eval runner uses **direct HTTP calls** to `/v1/search` and `/v1/answer` APIs, not Inngest workflows. This enables fast iteration and simple debugging. Test data is populated once during setup via existing `pnpm inject` CLI.

**Dataset generation strategy**: LLM-based (Claude Haiku) with critic filtering (Claude Sonnet) to generate high-quality query-document pairs from a deterministic corpus.

**Metrics approach**: Two-tier system:
- **Tier 1 (retrieval)**: MRR, Recall@K, Precision@K, NDCG@K — pure math, deterministic, fast, free
- **Tier 2 (RAG quality)**: Faithfulness, citation accuracy — LLM-as-judge, slower, costs ~$0.001/case with Haiku

**Statistical rigor**: Paired bootstrap tests with 10,000 resamples, p < 0.05 threshold, effect size reporting (Cohen's d).

---

## Phase 1: Dataset Generation System

### Overview
Build a system to generate high-quality evaluation datasets with LLM-based query generation, critic filtering, and ground truth annotation. Outputs 50-case golden dataset v1.

### Changes Required

#### 1. Create Deterministic Corpus Generator

**File**: `packages/console-eval/src/generation/corpus-generator.ts`

**Purpose**: Generate a well-defined set of realistic engineering events (webhooks) with known characteristics, replacing random generation.

```typescript
import type {
  GitHubPushWebhook,
  GitHubPullRequestWebhook,
  SentryErrorWebhook
} from "@repo/console-webhooks";

/**
 * Corpus templates for deterministic test data generation
 */
export const CORPUS_TEMPLATES = {
  github_push: [
    {
      id: "checkout-service-fix",
      repo: "acme/checkout-service",
      author: "sarah@acme.com",
      message: "fix: resolve memory leak in payment processor",
      files: ["src/payments/processor.ts", "src/payments/queue.ts"],
      timestamp: "2025-12-01T10:30:00Z",
      branch: "main",
    },
    {
      id: "auth-module-refactor",
      repo: "acme/platform",
      author: "alex@acme.com",
      message: "refactor: migrate auth to OAuth 2.1",
      files: ["src/auth/oauth.ts", "src/auth/tokens.ts"],
      timestamp: "2025-12-03T14:00:00Z",
      branch: "feat/oauth-upgrade",
    },
    // ... 8-10 more push templates
  ],
  github_pr: [
    {
      id: "redis-outage-postmortem",
      repo: "acme/infrastructure",
      author: "jamie@acme.com",
      title: "Post-mortem: Redis outage on Dec 1st",
      body: "Root cause: connection pool exhaustion due to...",
      labels: ["incident", "infrastructure"],
      timestamp: "2025-12-02T09:00:00Z",
    },
    // ... 5-8 PR templates
  ],
  sentry_error: [
    {
      id: "database-timeout",
      project: "checkout-service",
      message: "Database query timeout in payment flow",
      level: "error",
      count: 147,
      firstSeen: "2025-12-01T10:00:00Z",
      lastSeen: "2025-12-01T11:30:00Z",
    },
    // ... 5-8 error templates
  ],
} as const;

/**
 * Generate full webhook payloads from templates
 */
export function generateCorpus(): {
  pushes: GitHubPushWebhook[];
  prs: GitHubPullRequestWebhook[];
  errors: SentryErrorWebhook[];
} {
  // Transform templates into full webhook payloads
  // Use existing transformers from console-webhooks
}
```

**Notes**:
- Templates define realistic engineering scenarios with cross-references (e.g., PR references error from Sentry)
- Each template has a stable `id` for ground truth mapping
- Output webhooks use existing types from `@repo/console-webhooks`

---

#### 2. Create LLM Query Generator

**File**: `packages/console-eval/src/generation/query-generator.ts`

**Purpose**: Use Claude Haiku to generate diverse, natural queries from corpus templates.

```typescript
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";

const QueryGenerationSchema = z.object({
  queries: z.array(
    z.object({
      query: z.string().min(10).max(200),
      queryType: z.enum(["temporal", "actor", "technical", "status", "multi-hop", "null"]),
      expectedEventIds: z.array(z.string()).min(1).max(5),
      complexity: z.enum(["simple", "medium", "complex"]),
      reasoning: z.string(),
    })
  ).min(5).max(10),
});

/**
 * Generate queries from corpus events using LLM
 */
export async function generateQueries(
  corpusEvents: Array<{ id: string; title: string; description: string }>,
  targetCount: number = 30
): Promise<Array<{
  query: string;
  queryType: string;
  expectedEventIds: string[];
  complexity: string;
  reasoning: string;
}>> {
  const GENERATION_PROMPT = `You are a software engineer using a neural memory system to search engineering events.

Given these engineering events:
${JSON.stringify(corpusEvents.slice(0, 15), null, 2)}

Generate ${Math.min(10, targetCount)} diverse, natural search queries that a developer might ask.

Requirements:
- Queries should be conversational and realistic ("What broke in checkout?" not "checkout service errors")
- Cover different query types: temporal (time-based), actor (person-based), technical (topic), status, multi-hop (requires multiple docs), null (should return nothing)
- For each query, specify which event IDs should be returned
- Vary complexity: simple (1 expected result), medium (2-3 results), complex (4+ results or requires reasoning)
- Include reasoning for why those events match

Output JSON matching the schema.`;

  const result = await generateObject({
    model: gateway("anthropic/claude-haiku-4.5"),
    schema: QueryGenerationSchema,
    prompt: GENERATION_PROMPT,
    temperature: 0.8, // Higher creativity for diverse queries
  });

  return result.object.queries;
}
```

---

#### 3. Create Critic Filter

**File**: `packages/console-eval/src/generation/critic.ts`

**Purpose**: Use Claude Sonnet to score generated queries and filter low-quality examples.

```typescript
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";

const CriticScoreSchema = z.object({
  queryNaturalness: z.number().min(1).max(5),
  relevanceCorrectness: z.number().min(1).max(5),
  answerFeasibility: z.number().min(1).max(5),
  overallScore: z.number().min(1).max(5),
  reasoning: z.string(),
  issues: z.array(z.string()).optional(),
});

export type CriticScore = z.infer<typeof CriticScoreSchema>;

/**
 * Score a generated query using LLM-as-critic
 */
export async function scoreQuery(
  query: string,
  expectedEventIds: string[],
  corpusEvents: Array<{ id: string; title: string; description: string }>
): Promise<CriticScore> {
  const relevantEvents = corpusEvents.filter(e => expectedEventIds.includes(e.id));

  const CRITIC_PROMPT = `Evaluate this search query and its expected results.

Query: "${query}"

Expected results:
${JSON.stringify(relevantEvents, null, 2)}

Score each dimension 1-5:
1. **Query Naturalness**: Is this how a real developer would ask? (1=robotic, 5=natural)
2. **Relevance Correctness**: Do the expected results actually match the query? (1=wrong, 5=perfect)
3. **Answer Feasibility**: Could a system realistically retrieve these results? (1=impossible, 5=straightforward)
4. **Overall Score**: Holistic quality (1=unusable, 5=excellent)

Provide reasoning and list any issues found.`;

  const result = await generateObject({
    model: gateway("anthropic/claude-sonnet-4-5"),
    schema: CriticScoreSchema,
    prompt: CRITIC_PROMPT,
    temperature: 0.2, // Lower temperature for consistent scoring
  });

  return result.object;
}

/**
 * Filter queries by critic scores
 */
export function filterByCriticScores(
  queries: Array<{ query: string; score: CriticScore }>,
  minScore: number = 3
): Array<{ query: string; score: CriticScore }> {
  return queries.filter(q => q.score.overallScore >= minScore);
}
```

---

#### 4. Create Ground Truth Annotator

**File**: `packages/console-eval/src/generation/ground-truth.ts`

**Purpose**: Map corpus event IDs (sourceIds) to observation externalIds after Inngest ingestion.

```typescript
import { db } from "@db/console/client";
import { workspaceObservations } from "@db/console/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface GroundTruthMapping {
  sourceId: string;         // Template ID from corpus
  externalId: string;       // Observation ID in database
  title: string;
  sourceType: string;
}

/**
 * Query database to map sourceIds -> externalIds
 * Assumes test data has been injected via Inngest
 */
export async function resolveGroundTruth(
  workspaceId: string,
  sourceIds: string[]
): Promise<GroundTruthMapping[]> {
  const observations = await db
    .select({
      sourceId: workspaceObservations.sourceId,
      externalId: workspaceObservations.externalId,
      title: workspaceObservations.title,
      sourceType: workspaceObservations.sourceType,
    })
    .from(workspaceObservations)
    .where(
      and(
        eq(workspaceObservations.workspaceId, workspaceId),
        inArray(workspaceObservations.sourceId, sourceIds)
      )
    );

  return observations;
}

/**
 * Annotate generated queries with resolved externalIds
 */
export async function annotateWithGroundTruth(
  queries: Array<{ query: string; expectedEventIds: string[] }>,
  workspaceId: string
): Promise<Array<{
  query: string;
  expectedObservationIds: string[];
  missingIds: string[];
}>> {
  const allSourceIds = Array.from(
    new Set(queries.flatMap(q => q.expectedEventIds))
  );

  const groundTruth = await resolveGroundTruth(workspaceId, allSourceIds);
  const sourceIdToExternalId = new Map(
    groundTruth.map(gt => [gt.sourceId, gt.externalId])
  );

  return queries.map(q => {
    const resolved: string[] = [];
    const missing: string[] = [];

    for (const sourceId of q.expectedEventIds) {
      const externalId = sourceIdToExternalId.get(sourceId);
      if (externalId) {
        resolved.push(externalId);
      } else {
        missing.push(sourceId);
      }
    }

    return {
      query: q.query,
      expectedObservationIds: resolved,
      missingIds: missing,
    };
  });
}
```

---

#### 5. Create Dataset Schema & Validation

**File**: `packages/console-eval/src/datasets/schema.ts`

**Purpose**: Define golden dataset structure with Zod validation.

```typescript
import { z } from "zod";

export const QueryTypeSchema = z.enum([
  "temporal",    // Time-based queries
  "actor",       // Person-based queries
  "technical",   // Technical topic queries
  "status",      // Status/state queries
  "multi-hop",   // Requires multiple retrieval steps
  "null",        // Should return nothing
]);

export const EvalCaseSchema = z.object({
  id: z.string(),                                    // Unique case ID
  query: z.string().min(5).max(500),                 // Search query
  queryType: QueryTypeSchema,
  expectedObservationIds: z.array(z.string()).min(0), // Ground truth
  gradedRelevance: z.record(z.number().min(0).max(3)).optional(), // observationId -> 0-3
  expectedAnswer: z.string().optional(),              // For answer quality eval
  requiredCitations: z.array(z.string()).optional(),  // Must-cite observations
  requiredEntities: z.array(z.string()).optional(),   // Must-mention entities
  complexity: z.enum(["simple", "medium", "complex"]),
  source: z.enum(["manual", "synthetic", "production"]),
  annotator: z.string().optional(),                   // "human" or "llm"
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const EvalDatasetSchema = z.object({
  version: z.string(),                                // Semver
  createdAt: z.string().datetime(),                   // ISO 8601
  description: z.string(),
  workspaceId: z.string(),                            // Eval workspace ID
  cases: z.array(EvalCaseSchema),
});

export type QueryType = z.infer<typeof QueryTypeSchema>;
export type EvalCase = z.infer<typeof EvalCaseSchema>;
export type EvalDataset = z.infer<typeof EvalDatasetSchema>;

/**
 * Validate and parse a dataset JSON file
 */
export function validateDataset(data: unknown): EvalDataset {
  return EvalDatasetSchema.parse(data);
}
```

---

#### 6. Create Dataset Generation CLI

**File**: `packages/console-eval/src/cli/generate-dataset.ts`

**Purpose**: Orchestrate full dataset generation pipeline.

```typescript
import { generateCorpus } from "../generation/corpus-generator";
import { generateQueries } from "../generation/query-generator";
import { scoreQuery, filterByCriticScores } from "../generation/critic";
import { annotateWithGroundTruth } from "../generation/ground-truth";
import { EvalDatasetSchema, type EvalDataset } from "../datasets/schema";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Main dataset generation pipeline
 */
async function main() {
  console.log("Phase 1: Generate deterministic corpus");
  const corpus = generateCorpus();

  // Convert to simplified format for LLM prompt
  const corpusForPrompt = [
    ...corpus.pushes.map(p => ({
      id: `push:${p.id}`,
      title: p.message,
      description: `Push to ${p.repo} by ${p.author}: ${p.files.join(", ")}`,
    })),
    ...corpus.prs.map(pr => ({
      id: `pr:${pr.id}`,
      title: pr.title,
      description: pr.body,
    })),
    ...corpus.errors.map(e => ({
      id: `error:${e.id}`,
      title: e.message,
      description: `${e.level} in ${e.project}, seen ${e.count} times`,
    })),
  ];

  console.log(`Corpus: ${corpusForPrompt.length} events`);

  console.log("\nPhase 2: Generate queries with LLM");
  const generatedQueries = await generateQueries(corpusForPrompt, 60);
  console.log(`Generated: ${generatedQueries.length} queries`);

  console.log("\nPhase 3: Score with critic LLM");
  const scoredQueries = [];
  for (const q of generatedQueries) {
    const score = await scoreQuery(q.query, q.expectedEventIds, corpusForPrompt);
    scoredQueries.push({ ...q, criticScore: score });
  }

  const filtered = filterByCriticScores(
    scoredQueries.map(q => ({ query: q.query, score: q.criticScore })),
    3 // Min score
  );
  console.log(`After filtering: ${filtered.length} queries (score ≥3)`);

  console.log("\nPhase 4: Annotate with ground truth");
  const EVAL_WORKSPACE_ID = process.env.EVAL_WORKSPACE_ID;
  if (!EVAL_WORKSPACE_ID) {
    throw new Error("EVAL_WORKSPACE_ID not set");
  }

  const annotated = await annotateWithGroundTruth(
    filtered.map(f => ({
      query: f.query,
      expectedEventIds: scoredQueries.find(sq => sq.query === f.query)!.expectedEventIds,
    })),
    EVAL_WORKSPACE_ID
  );

  // Filter out queries with missing ground truth
  const complete = annotated.filter(a => a.missingIds.length === 0);
  console.log(`With complete ground truth: ${complete.length} queries`);

  console.log("\nPhase 5: Build dataset");
  const dataset: EvalDataset = {
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    description: "Golden evaluation dataset v1 - LLM-generated with critic filtering",
    workspaceId: EVAL_WORKSPACE_ID,
    cases: complete.slice(0, 50).map((q, i) => {
      const original = scoredQueries.find(sq => sq.query === q.query)!;
      return {
        id: `golden-${String(i + 1).padStart(3, "0")}`,
        query: q.query,
        queryType: original.queryType,
        expectedObservationIds: q.expectedObservationIds,
        complexity: original.complexity,
        source: "synthetic" as const,
        annotator: "llm",
        notes: original.reasoning,
      };
    }),
  };

  // Validate
  EvalDatasetSchema.parse(dataset);

  // Write to file
  const outPath = join(__dirname, "../datasets/golden-v1.json");
  writeFileSync(outPath, JSON.stringify(dataset, null, 2));
  console.log(`\nDataset written to: ${outPath}`);
  console.log(`Total cases: ${dataset.cases.length}`);
}

main().catch(console.error);
```

**Script entry** in `packages/console-eval/package.json`:
```json
{
  "scripts": {
    "generate-dataset": "pnpm with-env tsx src/cli/generate-dataset.ts"
  }
}
```

---

#### 7. Setup Eval Workspace (One-Time)

**File**: `packages/console-eval/docs/SETUP.md`

**Purpose**: Document one-time setup process for eval workspace.

```markdown
# Eval Workspace Setup

## Prerequisites

1. Create a dedicated eval workspace in the Console UI
2. Generate an API key for the workspace
3. Note the workspace ID and API key

## Environment Variables

Add to `apps/console/.vercel/.env.development.local`:

```bash
# Eval workspace credentials
EVAL_WORKSPACE_ID=ws_abc123
EVAL_API_KEY=lf_sk_xyz789
```

## One-Time Test Data Injection

Inject deterministic corpus into eval workspace:

```bash
cd packages/console-eval
pnpm generate-corpus     # Generates webhooks from templates
pnpm inject-corpus       # Triggers Inngest ingestion (uses existing pnpm inject pattern)
```

Wait for ingestion to complete (~2-3 minutes for 30 events). Verify:

```bash
pnpm verify-corpus       # Checks all events ingested successfully
```

## Generate Golden Dataset

After corpus is fully ingested:

```bash
pnpm generate-dataset    # Runs full LLM pipeline, outputs golden-v1.json
```

The dataset is now ready for eval runs.
```

---

### Success Criteria

#### Automated Verification:
- [x] Package builds: `pnpm --filter @repo/console-eval build`
- [ ] Type checking passes: `pnpm --filter @repo/console-eval typecheck` (blocked by upstream dependencies)
- [ ] Linting passes: `pnpm --filter @repo/console-eval lint` (style issues to fix later)
- [ ] Dataset generation completes: `pnpm --filter @repo/console-eval generate-dataset`
- [ ] Dataset schema validates: All 50 cases pass Zod validation
- [ ] Dataset file exists: `packages/console-eval/src/datasets/golden-v1.json`

#### Manual Verification:
- [ ] Corpus templates are realistic and well-defined (not random)
- [ ] Generated queries are natural and diverse (spot-check 10 random queries)
- [ ] Critic scores correctly filter low-quality queries (review rejected queries)
- [ ] Ground truth mapping is complete (no missing observation IDs)
- [ ] Dataset has good query type distribution: temporal, actor, technical, status, multi-hop, null

**Implementation Note**: After completing Phase 1 and all automated verification passes, pause for manual review of the generated dataset quality before proceeding to Phase 2.

---

## Phase 2: Eval Harness

### Overview
Build the core evaluation infrastructure: metrics library, eval runner, Braintrust integration, and vendor abstraction. Enables running retrieval and answer quality evaluations against the golden dataset.

### Changes Required

#### 1. Create Vendor Braintrust Abstraction

**File**: `vendor/braintrust/package.json`

```json
{
  "name": "@vendor/braintrust",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./env": "./src/env.ts"
  },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "lint": "eslint"
  },
  "dependencies": {
    "braintrust": "catalog:",
    "@t3-oss/env-core": "catalog:",
    "zod": "catalog:zod3"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "eslint": "catalog:",
    "tsup": "catalog:",
    "typescript": "catalog:"
  }
}
```

**File**: `vendor/braintrust/src/env.ts`

```typescript
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const braintrustEnv = createEnv({
  server: {
    BRAINTRUST_API_KEY: z.string().min(1),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
```

**File**: `vendor/braintrust/src/index.ts`

```typescript
/**
 * @vendor/braintrust
 *
 * Vendor abstraction for Braintrust AI evaluation and tracing.
 * Re-exports core functionality with consistent configuration.
 */

// Re-export Braintrust SDK
export {
  Eval,
  initLogger,
  wrapOpenAI,
  wrapAISDKModel,
  BraintrustMiddleware,
  type EvalCase,
  type EvalScorerArgs,
  type Experiment,
} from "braintrust";

// Export environment config
export { braintrustEnv } from "./env";

// Re-export with type safety
export type { Logger } from "braintrust";
```

**File**: `vendor/braintrust/tsconfig.json`

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "baseUrl": "."
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

---

#### 2. Create Console Eval Package Structure

**File**: `packages/console-eval/package.json`

```json
{
  "name": "@repo/console-eval",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./metrics": "./src/metrics/index.ts",
    "./scorers": "./src/scorers/index.ts"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint",
    "with-env": "dotenv -e ../../apps/console/.vercel/.env.development.local --",
    "generate-dataset": "pnpm with-env tsx src/cli/generate-dataset.ts",
    "run": "pnpm with-env tsx src/cli/run.ts",
    "compare": "pnpm with-env tsx src/cli/compare.ts"
  },
  "dependencies": {
    "@repo/console-types": "workspace:*",
    "@repo/console-validation": "workspace:*",
    "@repo/console-config": "workspace:*",
    "@repo/console-webhooks": "workspace:*",
    "@db/console": "workspace:*",
    "@vendor/braintrust": "workspace:*",
    "@vendor/observability": "workspace:*",
    "@ai-sdk/gateway": "catalog:",
    "ai": "catalog:",
    "drizzle-orm": "catalog:",
    "zod": "catalog:zod3",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "dotenv-cli": "^8.0.0",
    "eslint": "catalog:",
    "tsup": "^8.5.0",
    "tsx": "^4.19.2",
    "typescript": "catalog:"
  }
}
```

---

#### 3. Create Metrics Library - Tier 1 (Retrieval)

**File**: `packages/console-eval/src/metrics/retrieval.ts`

```typescript
/**
 * Tier 1 Retrieval Metrics
 *
 * Pure TypeScript implementations, no LLM calls, deterministic.
 * Based on information retrieval literature (Manning et al., 2008).
 */

export interface RetrievalResult {
  id: string;           // Observation externalId
  score: number;        // Relevance score from system (0-1)
  rank: number;         // Position in results (1-indexed)
}

export interface RetrievalMetrics {
  mrr: number;                          // Mean Reciprocal Rank
  recallAtK: Record<number, number>;    // K -> score
  precisionAtK: Record<number, number>;
  ndcgAtK: Record<number, number>;
  totalRelevant: number;
  totalRetrieved: number;
}

/**
 * Mean Reciprocal Rank (MRR)
 *
 * Score: 1 / rank of first relevant result
 * Range: [0, 1], higher is better
 */
export function calculateMRR(
  results: RetrievalResult[],
  relevant: Set<string>
): number {
  const firstRelevantRank = results.findIndex(r => relevant.has(r.id));

  if (firstRelevantRank === -1) {
    return 0; // No relevant results found
  }

  return 1 / (firstRelevantRank + 1); // Convert 0-indexed to 1-indexed
}

/**
 * Recall@K
 *
 * Fraction of relevant items found in top K results
 * Range: [0, 1], higher is better
 */
export function calculateRecallAtK(
  results: RetrievalResult[],
  relevant: Set<string>,
  k: number
): number {
  if (relevant.size === 0) return 0;

  const topK = results.slice(0, k);
  const found = topK.filter(r => relevant.has(r.id)).length;

  return found / relevant.size;
}

/**
 * Precision@K
 *
 * Fraction of top K results that are relevant
 * Range: [0, 1], higher is better
 */
export function calculatePrecisionAtK(
  results: RetrievalResult[],
  relevant: Set<string>,
  k: number
): number {
  if (k === 0) return 0;

  const topK = results.slice(0, k);
  const found = topK.filter(r => relevant.has(r.id)).length;

  return found / k;
}

/**
 * Normalized Discounted Cumulative Gain (NDCG@K)
 *
 * Ranking quality metric with position weighting.
 * Range: [0, 1], higher is better
 *
 * Formula: DCG@K / IDCG@K
 * where DCG@K = sum(rel_i / log2(i + 1)) for i in top K
 */
export function calculateNDCGAtK(
  results: RetrievalResult[],
  relevant: Set<string>,
  k: number,
  gradedRelevance?: Record<string, number> // observationId -> 0-3
): number {
  if (k === 0 || relevant.size === 0) return 0;

  const topK = results.slice(0, k);

  // DCG: Discounted Cumulative Gain
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const result = topK[i];
    const relevance = gradedRelevance?.[result.id] ?? (relevant.has(result.id) ? 1 : 0);
    dcg += relevance / Math.log2(i + 2); // i+2 because i is 0-indexed
  }

  // IDCG: Ideal DCG (if all relevant docs were at top)
  const sortedRelevance = Array.from(relevant)
    .map(id => gradedRelevance?.[id] ?? 1)
    .sort((a, b) => b - a) // Descending
    .slice(0, k);

  let idcg = 0;
  for (let i = 0; i < sortedRelevance.length; i++) {
    idcg += sortedRelevance[i] / Math.log2(i + 2);
  }

  return idcg === 0 ? 0 : dcg / idcg;
}

/**
 * Compute all retrieval metrics for a single case
 */
export function computeRetrievalMetrics(
  results: RetrievalResult[],
  relevant: Set<string>,
  kValues: number[] = [3, 5, 10],
  gradedRelevance?: Record<string, number>
): RetrievalMetrics {
  const recallAtK: Record<number, number> = {};
  const precisionAtK: Record<number, number> = {};
  const ndcgAtK: Record<number, number> = {};

  for (const k of kValues) {
    recallAtK[k] = calculateRecallAtK(results, relevant, k);
    precisionAtK[k] = calculatePrecisionAtK(results, relevant, k);
    ndcgAtK[k] = calculateNDCGAtK(results, relevant, k, gradedRelevance);
  }

  return {
    mrr: calculateMRR(results, relevant),
    recallAtK,
    precisionAtK,
    ndcgAtK,
    totalRelevant: relevant.size,
    totalRetrieved: results.length,
  };
}
```

---

#### 4. Create Metrics Library - Tier 2 (RAG Quality)

**File**: `packages/console-eval/src/metrics/rag-quality.ts`

```typescript
/**
 * Tier 2 RAG Quality Metrics
 *
 * LLM-as-judge implementations for answer quality evaluation.
 * Uses Claude Haiku for cost efficiency (~$0.001/case).
 */

import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";

export interface RAGQualityMetrics {
  faithfulness: number;       // 0-1: answer grounded in context
  citationPrecision: number;  // 0-1: citations support claims
  citationRecall: number;     // 0-1: claims have citations
  answerRelevancy: number;    // 0-1: answer addresses query
  hallucinationRate: number;  // 0-1: fraction unsupported claims
}

/**
 * Faithfulness Score via Claim Decomposition
 *
 * Steps:
 * 1. Decompose answer into atomic claims
 * 2. For each claim, check if retrieved context entails it
 * 3. Score = (supported claims) / (total claims)
 */

const ClaimDecompositionSchema = z.object({
  claims: z.array(z.string()),
});

const ClaimVerificationSchema = z.object({
  verifications: z.array(
    z.object({
      claim: z.string(),
      supported: z.boolean(),
      reasoning: z.string(),
    })
  ),
});

export async function calculateFaithfulness(
  answer: string,
  retrievedContext: string[],
  judgeModel: string = "anthropic/claude-haiku-4.5"
): Promise<number> {
  // Step 1: Decompose answer into claims
  const decomposition = await generateObject({
    model: gateway(judgeModel),
    schema: ClaimDecompositionSchema,
    prompt: `Decompose this answer into atomic claims (simple statements that can be verified independently):

Answer: ${answer}

Output a JSON array of claims.`,
    temperature: 0.2,
  });

  if (decomposition.object.claims.length === 0) {
    return 0;
  }

  // Step 2: Verify each claim against context
  const verification = await generateObject({
    model: gateway(judgeModel),
    schema: ClaimVerificationSchema,
    prompt: `For each claim, determine if it is supported by the retrieved context.

Claims:
${decomposition.object.claims.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Retrieved Context:
${retrievedContext.map((ctx, i) => `[Doc ${i + 1}] ${ctx}`).join("\n\n")}

For each claim, output: claim text, whether it's supported (true/false), and reasoning.`,
    temperature: 0.2,
  });

  // Step 3: Calculate score
  const supported = verification.object.verifications.filter(v => v.supported).length;
  return supported / decomposition.object.claims.length;
}

/**
 * Citation Precision
 *
 * Do citations actually support the claims they're attached to?
 * Score: (correct citations) / (total citations)
 */

const CitationVerificationSchema = z.object({
  citations: z.array(
    z.object({
      text: z.string(),           // The cited text from answer
      citationId: z.string(),     // The citation reference (e.g., "[1]")
      supported: z.boolean(),     // Does the cited doc support this text?
      reasoning: z.string(),
    })
  ),
});

export async function calculateCitationPrecision(
  answer: string,
  citations: Array<{ id: string; text: string }>, // Observation citations
  judgeModel: string = "anthropic/claude-haiku-4.5"
): Promise<number> {
  // Extract citation references from answer (e.g., "[1]", "[2]")
  const citationPattern = /\[(\d+)\]/g;
  const matches = Array.from(answer.matchAll(citationPattern));

  if (matches.length === 0) {
    return 1; // No citations to verify
  }

  const verification = await generateObject({
    model: gateway(judgeModel),
    schema: CitationVerificationSchema,
    prompt: `Verify if each citation correctly supports the text it's attached to.

Answer with citations: ${answer}

Citation sources:
${citations.map((c, i) => `[${i + 1}] ${c.text}`).join("\n\n")}

For each citation reference in the answer, determine if the cited source actually supports that specific text.`,
    temperature: 0.2,
  });

  const correct = verification.object.citations.filter(c => c.supported).length;
  return correct / verification.object.citations.length;
}

/**
 * Answer Relevancy
 *
 * Does the answer address the query?
 * Score: 0-1 (direct LLM judgment)
 */

const RelevancyScoreSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
});

export async function calculateAnswerRelevancy(
  query: string,
  answer: string,
  judgeModel: string = "anthropic/claude-haiku-4.5"
): Promise<number> {
  const result = await generateObject({
    model: gateway(judgeModel),
    schema: RelevancyScoreSchema,
    prompt: `Score how well this answer addresses the query.

Query: ${query}

Answer: ${answer}

Score 0-1:
- 1.0: Directly and completely answers the query
- 0.5: Partially addresses the query
- 0.0: Irrelevant or doesn't answer

Provide reasoning.`,
    temperature: 0.2,
  });

  return result.object.score;
}

/**
 * Compute all RAG quality metrics
 */
export async function computeRAGQualityMetrics(
  query: string,
  answer: string,
  retrievedContext: string[],
  citations: Array<{ id: string; text: string }>,
  judgeModel: string = "anthropic/claude-haiku-4.5"
): Promise<RAGQualityMetrics> {
  const [faithfulness, citationPrecision, answerRelevancy] = await Promise.all([
    calculateFaithfulness(answer, retrievedContext, judgeModel),
    calculateCitationPrecision(answer, citations, judgeModel),
    calculateAnswerRelevancy(query, answer, judgeModel),
  ]);

  return {
    faithfulness,
    citationPrecision,
    citationRecall: 0.9, // TODO: Implement
    answerRelevancy,
    hallucinationRate: 1 - faithfulness, // Inverse of faithfulness
  };
}
```

---

#### 5. Create Search API Client

**File**: `packages/console-eval/src/clients/search-client.ts`

```typescript
/**
 * HTTP client for /v1/search API
 *
 * Calls production search endpoint with eval workspace credentials.
 */

import type { V1SearchResponse } from "@repo/console-types";
import { V1SearchResponseSchema } from "@repo/console-types";

export interface SearchConfig {
  apiUrl: string;         // e.g., "http://localhost:3024" or "https://api.lightfast.ai"
  apiKey: string;         // Eval workspace API key
  workspaceId: string;    // Eval workspace ID
}

export interface SearchOptions {
  query: string;
  mode?: "fast" | "balanced" | "thorough";
  limit?: number;
  offset?: number;
}

/**
 * Call /v1/search API
 */
export async function searchAPI(
  options: SearchOptions,
  config: SearchConfig
): Promise<V1SearchResponse> {
  const url = new URL("/v1/search", config.apiUrl);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
      "X-Workspace-ID": config.workspaceId,
    },
    body: JSON.stringify({
      query: options.query,
      mode: options.mode ?? "balanced",
      limit: options.limit ?? 10,
      offset: options.offset ?? 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`Search API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return V1SearchResponseSchema.parse(data);
}
```

---

#### 6. Create Eval Runner

**File**: `packages/console-eval/src/eval/runner.ts`

```typescript
/**
 * Eval Runner
 *
 * Orchestrates: load dataset → execute searches → score → report
 */

import { Eval, initLogger } from "@vendor/braintrust";
import { braintrustEnv } from "@vendor/braintrust/env";
import type { EvalDataset, EvalCase } from "../datasets/schema";
import { validateDataset } from "../datasets/schema";
import { searchAPI, type SearchConfig } from "../clients/search-client";
import { computeRetrievalMetrics, type RetrievalMetrics } from "../metrics/retrieval";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface EvalRunConfig {
  datasetPath: string;
  tier: "retrieval" | "rag" | "full";
  searchMode: "fast" | "balanced" | "thorough";
  maxConcurrency: number;
  braintrustProject: string;
  experimentName: string;
}

export interface EvalRunResult {
  config: EvalRunConfig;
  aggregateMetrics: RetrievalMetrics;
  perCase: Array<{
    caseId: string;
    metrics: RetrievalMetrics;
    latencyMs: number;
  }>;
  braintrustExperimentUrl: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

/**
 * Load and validate dataset
 */
function loadDataset(path: string): EvalDataset {
  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw);
  return validateDataset(data);
}

/**
 * Run evaluation
 */
export async function runEval(
  config: EvalRunConfig,
  searchConfig: SearchConfig
): Promise<EvalRunResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  // Load dataset
  console.log(`Loading dataset: ${config.datasetPath}`);
  const dataset = loadDataset(config.datasetPath);
  console.log(`Loaded ${dataset.cases.length} eval cases`);

  // Initialize Braintrust
  initLogger({
    apiKey: braintrustEnv.BRAINTRUST_API_KEY,
    projectName: config.braintrustProject,
  });

  // Run eval
  console.log(`Running ${config.tier} eval with ${config.searchMode} mode`);

  const perCaseResults: Array<{
    caseId: string;
    metrics: RetrievalMetrics;
    latencyMs: number;
  }> = [];

  await Eval(config.braintrustProject, {
    data: dataset.cases.map(c => ({
      input: {
        query: c.query,
        mode: config.searchMode,
      },
      expected: {
        observationIds: c.expectedObservationIds,
        gradedRelevance: c.gradedRelevance,
      },
      metadata: {
        caseId: c.id,
        queryType: c.queryType,
        complexity: c.complexity,
      },
    })),
    task: async (input) => {
      const caseStartTime = Date.now();
      const response = await searchAPI(
        { query: input.query, mode: input.mode, limit: 10 },
        searchConfig
      );
      const latencyMs = Date.now() - caseStartTime;

      return {
        results: response.results.map((r, i) => ({
          id: r.externalId,
          score: r.score ?? 0,
          rank: i + 1,
        })),
        latencyMs,
      };
    },
    scores: [
      async (args) => {
        const relevant = new Set(args.expected.observationIds);
        const metrics = computeRetrievalMetrics(
          args.output.results,
          relevant,
          [3, 5, 10],
          args.expected.gradedRelevance
        );

        // Store per-case result
        perCaseResults.push({
          caseId: args.metadata.caseId,
          metrics,
          latencyMs: args.output.latencyMs,
        });

        // Return aggregate score for Braintrust
        return {
          name: "mrr",
          score: metrics.mrr,
        };
      },
    ],
  });

  // Compute aggregate metrics
  const aggregateMetrics: RetrievalMetrics = {
    mrr: perCaseResults.reduce((sum, r) => sum + r.metrics.mrr, 0) / perCaseResults.length,
    recallAtK: {
      3: perCaseResults.reduce((sum, r) => sum + r.metrics.recallAtK[3], 0) / perCaseResults.length,
      5: perCaseResults.reduce((sum, r) => sum + r.metrics.recallAtK[5], 0) / perCaseResults.length,
      10: perCaseResults.reduce((sum, r) => sum + r.metrics.recallAtK[10], 0) / perCaseResults.length,
    },
    precisionAtK: {
      3: perCaseResults.reduce((sum, r) => sum + r.metrics.precisionAtK[3], 0) / perCaseResults.length,
      5: perCaseResults.reduce((sum, r) => sum + r.metrics.precisionAtK[5], 0) / perCaseResults.length,
      10: perCaseResults.reduce((sum, r) => sum + r.metrics.precisionAtK[10], 0) / perCaseResults.length,
    },
    ndcgAtK: {
      3: perCaseResults.reduce((sum, r) => sum + r.metrics.ndcgAtK[3], 0) / perCaseResults.length,
      5: perCaseResults.reduce((sum, r) => sum + r.metrics.ndcgAtK[5], 0) / perCaseResults.length,
      10: perCaseResults.reduce((sum, r) => sum + r.metrics.ndcgAtK[10], 0) / perCaseResults.length,
    },
    totalRelevant: perCaseResults.reduce((sum, r) => sum + r.metrics.totalRelevant, 0) / perCaseResults.length,
    totalRetrieved: perCaseResults.reduce((sum, r) => sum + r.metrics.totalRetrieved, 0) / perCaseResults.length,
  };

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  return {
    config,
    aggregateMetrics,
    perCase: perCaseResults,
    braintrustExperimentUrl: "https://www.braintrust.dev/app/...", // TODO: Get from Braintrust SDK
    startedAt,
    completedAt,
    durationMs,
  };
}
```

---

#### 7. Create Eval CLI

**File**: `packages/console-eval/src/cli/run.ts`

```typescript
#!/usr/bin/env node

import { Command } from "commander";
import { runEval } from "../eval/runner";
import { join } from "node:path";

const program = new Command();

program
  .name("eval")
  .description("Run AI evaluation pipeline")
  .option("-d, --dataset <path>", "Path to dataset JSON", "src/datasets/golden-v1.json")
  .option("-t, --tier <tier>", "Eval tier: retrieval, rag, full", "retrieval")
  .option("-m, --mode <mode>", "Search mode: fast, balanced, thorough", "balanced")
  .option("-c, --concurrency <num>", "Max concurrency", "5")
  .option("-p, --project <name>", "Braintrust project name", "lightfast-console-eval")
  .option("-e, --experiment <name>", "Experiment name", `eval-${new Date().toISOString()}`)
  .action(async (options) => {
    const EVAL_WORKSPACE_ID = process.env.EVAL_WORKSPACE_ID;
    const EVAL_API_KEY = process.env.EVAL_API_KEY;
    const CONSOLE_API_URL = process.env.CONSOLE_API_URL ?? "http://localhost:3024";

    if (!EVAL_WORKSPACE_ID || !EVAL_API_KEY) {
      console.error("Error: EVAL_WORKSPACE_ID and EVAL_API_KEY must be set");
      process.exit(1);
    }

    const datasetPath = join(process.cwd(), options.dataset);

    const result = await runEval(
      {
        datasetPath,
        tier: options.tier,
        searchMode: options.mode,
        maxConcurrency: Number.parseInt(options.concurrency),
        braintrustProject: options.project,
        experimentName: options.experiment,
      },
      {
        apiUrl: CONSOLE_API_URL,
        apiKey: EVAL_API_KEY,
        workspaceId: EVAL_WORKSPACE_ID,
      }
    );

    console.log("\n=== Eval Results ===");
    console.log(`Duration: ${result.durationMs}ms`);
    console.log(`Cases: ${result.perCase.length}`);
    console.log("\nAggregate Metrics:");
    console.log(`  MRR: ${result.aggregateMetrics.mrr.toFixed(3)}`);
    console.log(`  Recall@5: ${result.aggregateMetrics.recallAtK[5].toFixed(3)}`);
    console.log(`  Recall@10: ${result.aggregateMetrics.recallAtK[10].toFixed(3)}`);
    console.log(`  Precision@5: ${result.aggregateMetrics.precisionAtK[5].toFixed(3)}`);
    console.log(`  NDCG@5: ${result.aggregateMetrics.ndcgAtK[5].toFixed(3)}`);
    console.log(`\nBraintrust: ${result.braintrustExperimentUrl}`);
  });

program.parse();
```

---

### Success Criteria

#### Automated Verification:
- [x] Vendor package builds: `pnpm --filter @vendor/braintrust build`
- [x] Eval package builds: `pnpm --filter @repo/console-eval build`
- [ ] Type checking passes: `pnpm --filter @repo/console-eval typecheck` (blocked by upstream dependencies)
- [ ] Linting passes: `pnpm --filter @repo/console-eval lint` (style issues to fix later)
- [ ] Eval run completes: `pnpm --filter @repo/console-eval run --tier=retrieval` (requires workspace setup)
- [ ] Braintrust experiment logged: Check https://www.braintrust.dev/app/ (requires workspace setup)

#### Manual Verification:
- [ ] Eval run completes in <5 minutes for 50 cases
- [ ] All metrics are computed correctly (spot-check 5 random cases)
- [ ] Braintrust dashboard shows experiment with all cases and scores
- [ ] Search API is called correctly (check logs for proper authentication)
- [ ] Metrics are reasonable (MRR > 0, Recall@10 > 0, etc.)

**Implementation Note**: After completing Phase 2 and all automated verification passes, manually verify the eval results quality before proceeding to Phase 3.

---

## Phase 3: Regression Detection

### Overview
Add statistical comparison between eval runs to detect quality regressions before they reach production. Uses paired bootstrap tests for statistical rigor.

### Changes Required

#### 1. Create Statistics Library

**File**: `packages/console-eval/src/metrics/statistics.ts`

```typescript
/**
 * Statistical utilities for eval comparison
 *
 * Implements paired bootstrap test for comparing two eval runs.
 */

/**
 * Calculate mean
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Cohen's d effect size
 *
 * Measures magnitude of difference between two groups.
 * |d| < 0.2: small, 0.2-0.5: medium, > 0.5: large
 */
export function cohensD(group1: number[], group2: number[]): number {
  const mean1 = mean(group1);
  const mean2 = mean(group2);
  const sd1 = stdDev(group1);
  const sd2 = stdDev(group2);
  const pooledSD = Math.sqrt((sd1 ** 2 + sd2 ** 2) / 2);

  if (pooledSD === 0) return 0;
  return (mean2 - mean1) / pooledSD;
}

/**
 * Bootstrap resample with replacement
 */
export function bootstrapResample<T>(data: T[], seed?: number): T[] {
  const n = data.length;
  const resampled: T[] = [];

  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * n);
    resampled.push(data[idx]);
  }

  return resampled;
}

/**
 * Paired Bootstrap Test
 *
 * Tests if candidate is significantly better than baseline.
 * Uses paired differences to reduce variance.
 *
 * Returns:
 * - pValue: probability that improvement is due to chance
 * - ci95: 95% confidence interval for the difference
 */
export function pairedBootstrapTest(
  baselineScores: number[],
  candidateScores: number[],
  numBootstrap: number = 10000,
  alpha: number = 0.05
): { pValue: number; ci95: [number, number] } {
  if (baselineScores.length !== candidateScores.length) {
    throw new Error("Baseline and candidate must have same length");
  }

  // 1. Compute observed delta
  const observedDelta = mean(candidateScores) - mean(baselineScores);

  // 2. Bootstrap: resample paired differences with replacement
  const deltas: number[] = [];
  const pairedDiffs = candidateScores.map((c, i) => c - baselineScores[i]);

  for (let b = 0; b < numBootstrap; b++) {
    const resampled = bootstrapResample(pairedDiffs);
    deltas.push(mean(resampled));
  }

  // 3. p-value: fraction of bootstrap deltas <= 0 (one-tailed test)
  // We're testing H0: candidate <= baseline, H1: candidate > baseline
  const pValue = deltas.filter(d => d <= 0).length / numBootstrap;

  // 4. Confidence interval
  deltas.sort((a, b) => a - b);
  const lowerIdx = Math.floor(numBootstrap * (alpha / 2));
  const upperIdx = Math.floor(numBootstrap * (1 - alpha / 2));
  const ci95: [number, number] = [deltas[lowerIdx], deltas[upperIdx]];

  return { pValue, ci95 };
}

/**
 * Compute confidence interval for a metric
 */
export function confidenceInterval(
  values: number[],
  confidence: number = 0.95
): [number, number] {
  if (values.length === 0) return [0, 0];

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const alpha = 1 - confidence;

  const lowerIdx = Math.floor(n * (alpha / 2));
  const upperIdx = Math.floor(n * (1 - alpha / 2));

  return [sorted[lowerIdx], sorted[upperIdx]];
}
```

---

#### 2. Create Comparison Engine

**File**: `packages/console-eval/src/eval/compare.ts`

```typescript
/**
 * Experiment Comparison
 *
 * Compares two eval runs with statistical rigor.
 */

import type { EvalRunResult } from "./runner";
import {
  mean,
  cohensD,
  pairedBootstrapTest,
  confidenceInterval
} from "../metrics/statistics";

export interface MetricSummary {
  mean: number;
  median: number;
  p95: number;
  ci95: [number, number];
  n: number;
}

export interface ComparisonResult {
  metric: string;
  baseline: MetricSummary;
  candidate: MetricSummary;
  delta: number;                      // candidate.mean - baseline.mean
  deltaPercent: number;               // delta / baseline.mean * 100
  pValue: number;                     // Paired bootstrap p-value
  effectSize: number;                 // Cohen's d
  isRegression: boolean;              // delta < threshold AND p < 0.05
  isImprovement: boolean;             // delta > 0 AND p < 0.05
  isStatisticallySignificant: boolean; // p < 0.05
}

/**
 * Regression thresholds per metric
 *
 * These define the maximum acceptable degradation.
 * Values are deltas (negative = worse for most metrics).
 */
export const REGRESSION_THRESHOLDS = {
  // Tier 1: Retrieval — allow max 5% drop
  "mrr": -0.05,
  "recall@3": -0.05,
  "recall@5": -0.05,
  "recall@10": -0.05,
  "precision@3": -0.05,
  "precision@5": -0.05,
  "precision@10": -0.05,
  "ndcg@3": -0.05,
  "ndcg@5": -0.05,
  "ndcg@10": -0.05,

  // Tier 2: RAG Quality — stricter, 3% max drop
  "faithfulness": -0.03,
  "citation_precision": -0.03,
  "citation_recall": -0.05,
  "answer_relevancy": -0.05,
  "hallucination_rate": 0.02, // Positive = worse (higher hallucination)

  // Latency — allow max 100ms increase at p95
  "latency_p95_ms": 100,
} as const;

/**
 * Compute summary statistics for a metric
 */
function computeSummary(values: number[]): MetricSummary {
  if (values.length === 0) {
    return { mean: 0, median: 0, p95: 0, ci95: [0, 0], n: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];

  return {
    mean: mean(values),
    median,
    p95,
    ci95: confidenceInterval(values, 0.95),
    n: values.length,
  };
}

/**
 * Compare two eval runs
 */
export function compareEvalRuns(
  baseline: EvalRunResult,
  candidate: EvalRunResult
): ComparisonResult[] {
  const comparisons: ComparisonResult[] = [];

  // Extract per-case scores for each metric
  const baselineScores = {
    mrr: baseline.perCase.map(c => c.metrics.mrr),
    "recall@3": baseline.perCase.map(c => c.metrics.recallAtK[3]),
    "recall@5": baseline.perCase.map(c => c.metrics.recallAtK[5]),
    "recall@10": baseline.perCase.map(c => c.metrics.recallAtK[10]),
    "precision@5": baseline.perCase.map(c => c.metrics.precisionAtK[5]),
    "ndcg@5": baseline.perCase.map(c => c.metrics.ndcgAtK[5]),
    "latency_p95_ms": [baseline.perCase.map(c => c.latencyMs).sort((a, b) => a - b)[Math.floor(baseline.perCase.length * 0.95)]],
  };

  const candidateScores = {
    mrr: candidate.perCase.map(c => c.metrics.mrr),
    "recall@3": candidate.perCase.map(c => c.metrics.recallAtK[3]),
    "recall@5": candidate.perCase.map(c => c.metrics.recallAtK[5]),
    "recall@10": candidate.perCase.map(c => c.metrics.recallAtK[10]),
    "precision@5": candidate.perCase.map(c => c.metrics.precisionAtK[5]),
    "ndcg@5": candidate.perCase.map(c => c.metrics.ndcgAtK[5]),
    "latency_p95_ms": [candidate.perCase.map(c => c.latencyMs).sort((a, b) => a - b)[Math.floor(candidate.perCase.length * 0.95)]],
  };

  // Compare each metric
  for (const [metricName, baselineValues] of Object.entries(baselineScores)) {
    const candidateValues = candidateScores[metricName as keyof typeof candidateScores];

    const baselineSummary = computeSummary(baselineValues);
    const candidateSummary = computeSummary(candidateValues);

    const delta = candidateSummary.mean - baselineSummary.mean;
    const deltaPercent = baselineSummary.mean === 0 ? 0 : (delta / baselineSummary.mean) * 100;

    // Statistical test
    const { pValue, ci95 } = pairedBootstrapTest(baselineValues, candidateValues);
    const effectSize = cohensD(baselineValues, candidateValues);

    // Regression check
    const threshold = REGRESSION_THRESHOLDS[metricName as keyof typeof REGRESSION_THRESHOLDS] ?? -0.05;
    const isRegression = delta < threshold && pValue < 0.05;
    const isImprovement = delta > 0 && pValue < 0.05;

    comparisons.push({
      metric: metricName,
      baseline: baselineSummary,
      candidate: candidateSummary,
      delta,
      deltaPercent,
      pValue,
      effectSize,
      isRegression,
      isImprovement,
      isStatisticallySignificant: pValue < 0.05,
    });
  }

  return comparisons;
}

/**
 * Format comparison results as markdown table
 */
export function formatComparisonReport(comparisons: ComparisonResult[]): string {
  let report = "# Eval Comparison Report\n\n";
  report += "| Metric | Baseline | Candidate | Delta | Delta % | p-value | Effect Size | Status |\n";
  report += "|--------|----------|-----------|-------|---------|---------|-------------|--------|\n";

  for (const c of comparisons) {
    const statusEmoji = c.isRegression ? "🔴" : c.isImprovement ? "🟢" : "⚪";
    report += `| ${c.metric} | ${c.baseline.mean.toFixed(3)} | ${c.candidate.mean.toFixed(3)} | `;
    report += `${c.delta > 0 ? "+" : ""}${c.delta.toFixed(3)} | `;
    report += `${c.deltaPercent > 0 ? "+" : ""}${c.deltaPercent.toFixed(1)}% | `;
    report += `${c.pValue.toFixed(3)} | ${c.effectSize.toFixed(2)} | ${statusEmoji} |\n`;
  }

  // Summary
  const regressions = comparisons.filter(c => c.isRegression);
  const improvements = comparisons.filter(c => c.isImprovement);

  report += "\n## Summary\n\n";
  report += `- **Regressions**: ${regressions.length}\n`;
  report += `- **Improvements**: ${improvements.length}\n`;
  report += `- **No significant change**: ${comparisons.length - regressions.length - improvements.length}\n`;

  if (regressions.length > 0) {
    report += "\n### ⚠️ Regressions Detected\n\n";
    for (const r of regressions) {
      report += `- **${r.metric}**: ${r.deltaPercent.toFixed(1)}% drop (p=${r.pValue.toFixed(3)})\n`;
    }
  }

  return report;
}
```

---

#### 3. Create Comparison CLI

**File**: `packages/console-eval/src/cli/compare.ts`

```typescript
#!/usr/bin/env node

import { Command } from "commander";
import { compareEvalRuns, formatComparisonReport } from "../eval/compare";
import { readFileSync, writeFileSync } from "node:fs";
import type { EvalRunResult } from "../eval/runner";

const program = new Command();

program
  .name("compare")
  .description("Compare two eval runs for regression detection")
  .requiredOption("-b, --baseline <path>", "Path to baseline eval result JSON")
  .requiredOption("-c, --candidate <path>", "Path to candidate eval result JSON")
  .option("-o, --output <path>", "Output report path", "eval-comparison-report.md")
  .action((options) => {
    console.log("Loading eval results...");

    const baseline: EvalRunResult = JSON.parse(readFileSync(options.baseline, "utf-8"));
    const candidate: EvalRunResult = JSON.parse(readFileSync(options.candidate, "utf-8"));

    console.log(`Baseline: ${baseline.perCase.length} cases`);
    console.log(`Candidate: ${candidate.perCase.length} cases`);

    console.log("\nRunning statistical comparison...");
    const comparisons = compareEvalRuns(baseline, candidate);

    const report = formatComparisonReport(comparisons);

    // Write report
    writeFileSync(options.output, report);
    console.log(`\nReport written to: ${options.output}`);

    // Print to console
    console.log("\n" + report);

    // Exit with error code if regressions detected
    const hasRegressions = comparisons.some(c => c.isRegression);
    if (hasRegressions) {
      console.error("\n❌ Regressions detected!");
      process.exit(1);
    } else {
      console.log("\n✅ No regressions detected");
      process.exit(0);
    }
  });

program.parse();
```

---

#### 4. Update Eval Runner to Save Results

**File**: `packages/console-eval/src/eval/runner.ts` (update)

Add result persistence at the end of `runEval()`:

```typescript
// ... existing code ...

  // Save result to file for comparison
  const resultPath = join(process.cwd(), `eval-result-${Date.now()}.json`);
  writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`\nResult saved to: ${resultPath}`);

  return result;
}
```

---

### Success Criteria

#### Automated Verification:
- [x] Package builds: `pnpm --filter @repo/console-eval build`
- [ ] Type checking passes: `pnpm --filter @repo/console-eval typecheck` (blocked by upstream console-validation dependency)
- [ ] Run baseline eval: `pnpm --filter @repo/console-eval run` produces `eval-result-*.json` (requires manual workspace setup)
- [ ] Run candidate eval: `pnpm --filter @repo/console-eval run` produces second result file (requires manual workspace setup)
- [ ] Compare runs: `pnpm --filter @repo/console-eval compare -b baseline.json -c candidate.json` (requires eval results)
- [ ] Comparison report generated: `eval-comparison-report.md` exists (requires eval results)

#### Manual Verification:
- [ ] Paired bootstrap test produces reasonable p-values (check against synthetic regression)
- [ ] Effect size (Cohen's d) is computed correctly
- [ ] Regression threshold logic works (artificially degrade a metric, verify detection)
- [ ] Comparison report is readable and actionable
- [ ] CLI exits with code 1 when regressions detected, 0 otherwise

**Implementation Note**: After completing Phase 3, create a synthetic regression (e.g., return empty results for 20% of queries) to verify the regression detection catches it.

---

## Testing Strategy

### Unit Tests

**File**: `packages/console-eval/src/metrics/__tests__/retrieval.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { calculateMRR, calculateRecallAtK, calculateNDCGAtK } from "../retrieval";
import type { RetrievalResult } from "../retrieval";

describe("calculateMRR", () => {
  it("returns 1 when first result is relevant", () => {
    const results: RetrievalResult[] = [
      { id: "obs1", score: 0.9, rank: 1 },
      { id: "obs2", score: 0.8, rank: 2 },
    ];
    const relevant = new Set(["obs1"]);
    expect(calculateMRR(results, relevant)).toBe(1);
  });

  it("returns 0.5 when second result is relevant", () => {
    const results: RetrievalResult[] = [
      { id: "obs1", score: 0.9, rank: 1 },
      { id: "obs2", score: 0.8, rank: 2 },
    ];
    const relevant = new Set(["obs2"]);
    expect(calculateMRR(results, relevant)).toBe(0.5);
  });

  it("returns 0 when no relevant results", () => {
    const results: RetrievalResult[] = [
      { id: "obs1", score: 0.9, rank: 1 },
    ];
    const relevant = new Set(["obs999"]);
    expect(calculateMRR(results, relevant)).toBe(0);
  });
});

describe("calculateRecallAtK", () => {
  it("calculates recall correctly", () => {
    const results: RetrievalResult[] = [
      { id: "obs1", score: 0.9, rank: 1 },
      { id: "obs2", score: 0.8, rank: 2 },
      { id: "obs3", score: 0.7, rank: 3 },
    ];
    const relevant = new Set(["obs1", "obs2", "obs4"]); // 2/3 in results
    expect(calculateRecallAtK(results, relevant, 3)).toBeCloseTo(2 / 3);
  });
});
```

Add similar tests for other metrics, statistics, and comparison logic.

### Integration Tests

**File**: `packages/console-eval/src/__tests__/e2e.test.ts`

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { runEval } from "../eval/runner";
import { join } from "node:path";

describe("End-to-end eval", () => {
  it("runs retrieval eval successfully", async () => {
    const result = await runEval(
      {
        datasetPath: join(__dirname, "../datasets/golden-v1.json"),
        tier: "retrieval",
        searchMode: "balanced",
        maxConcurrency: 5,
        braintrustProject: "test-project",
        experimentName: "test-run",
      },
      {
        apiUrl: process.env.CONSOLE_API_URL!,
        apiKey: process.env.EVAL_API_KEY!,
        workspaceId: process.env.EVAL_WORKSPACE_ID!,
      }
    );

    expect(result.perCase.length).toBeGreaterThan(0);
    expect(result.aggregateMetrics.mrr).toBeGreaterThanOrEqual(0);
    expect(result.aggregateMetrics.mrr).toBeLessThanOrEqual(1);
  }, 300000); // 5 min timeout
});
```

### Manual Testing Steps

1. **Dataset Generation**:
   ```bash
   cd packages/console-eval
   pnpm generate-dataset
   # Verify: golden-v1.json has 50 cases
   # Spot-check: queries are natural, diverse
   ```

2. **Eval Run**:
   ```bash
   pnpm run --tier=retrieval
   # Verify: completes in <5 minutes
   # Check: Braintrust dashboard shows experiment
   # Review: metrics are reasonable (MRR > 0.5, Recall@10 > 0.7)
   ```

3. **Regression Detection**:
   ```bash
   # Run baseline
   pnpm run --tier=retrieval
   mv eval-result-*.json baseline.json

   # Run candidate (same code, should be no regression)
   pnpm run --tier=retrieval
   mv eval-result-*.json candidate.json

   # Compare
   pnpm compare -b baseline.json -c candidate.json
   # Verify: no regressions detected, p-values > 0.05
   ```

4. **Synthetic Regression Test**:
   - Modify search client to return empty results for 30% of queries
   - Run eval, compare with baseline
   - Verify: regression detected, exit code 1

---

## Performance Considerations

### Cost Estimates

**Phase 1 (Dataset Generation)**:
- 60 queries generated: 60 × $0.0002 (Haiku) = $0.012
- 60 queries scored: 60 × $0.002 (Sonnet) = $0.12
- **Total**: ~$0.13 (one-time)

**Phase 2 (Eval Runs)**:
- Retrieval-only (Tier 1): 50 cases × $0 (no LLM) = **$0**
- RAG quality (Tier 2): 50 cases × $0.001 (Haiku judge) = **$0.05**
- **Per eval run**: $0 - $0.05

**Phase 3 (Regression Detection)**:
- Pure math, no LLM calls = **$0**

**Monthly estimate** (assuming 100 eval runs/month):
- Retrieval-only runs: 100 × $0 = $0
- Dataset regeneration: 1 × $0.13 = $0.13
- **Total**: ~$0.13/month

### Latency

- **Dataset generation**: ~10-15 minutes (includes LLM calls)
- **Eval run (50 cases, retrieval-only)**: 3-5 minutes
- **Eval run (50 cases, RAG quality)**: 8-12 minutes
- **Comparison**: <10 seconds (pure math)

### Optimization Opportunities

1. **Parallelize eval execution**: Currently sequential, can run 5-10 cases concurrently
2. **Cache search results**: For repeated eval runs on same dataset/code version
3. **Incremental dataset generation**: Only regenerate when corpus changes
4. **Haiku → Sonnet upgrade**: For higher-stakes pre-release evals

---

## Migration Notes

### Deleting Old Files

Before starting implementation:

```bash
# Delete old query scenarios (confirmed obsolete)
rm docs/examples/query-scenarios/query_scenarios.json
```

### Environment Variables

Add to `apps/console/.vercel/.env.development.local`:

```bash
# Eval workspace credentials (setup in Phase 1)
EVAL_WORKSPACE_ID=ws_eval_abc123
EVAL_API_KEY=lf_sk_eval_xyz789

# Braintrust (existing, verify it's set)
BRAINTRUST_API_KEY=your_braintrust_api_key

# Console API URL (defaults to localhost)
CONSOLE_API_URL=http://localhost:3024
```

### Workspace Dependencies

Add to root `pnpm-workspace.yaml` catalog (if not already present):

```yaml
catalog:
  commander: ^12.0.0  # CLI framework
```

---

## References

- Original design: `thoughts/shared/research/2026-02-07-ai-eval-pipeline-architecture-design.md`
- Codebase analysis: `thoughts/shared/research/2026-02-07-ai-eval-pipeline-codebase-deep-dive.md`
- External research: `thoughts/shared/research/2026-02-07-ai-eval-pipeline-external-research.md`
- Braintrust docs: https://www.braintrust.dev/docs
- IR metrics reference: Manning, Raghavan, Schütze (2008) - Introduction to Information Retrieval
- Bootstrap testing: Efron & Tibshirani (1993) - An Introduction to the Bootstrap
- LLM evaluation: RAGAS framework (https://github.com/explodinggradients/ragas)
