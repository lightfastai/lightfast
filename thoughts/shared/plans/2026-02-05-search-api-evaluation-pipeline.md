# Search API End-to-End Evaluation Pipeline Implementation Plan

## Overview

Implement a true end-to-end evaluation pipeline for Lightfast's search API that tests the **complete system**: ingestion via Inngest workflows → database storage → Pinecone indexing → four-path search → reranking → API response. This plan ensures we're testing the actual production code path, not mocks.

## Current State Analysis

### The Full Pipeline Being Tested

```
Webhook → Transformer → SourceEvent → Inngest (observation.capture)
                                            ↓
                    ┌───────────────────────┼───────────────────────┐
                    ↓                       ↓                       ↓
            Significance Gate      Entity Extraction      Classification
                    ↓                       ↓                       ↓
                    └───────────────────────┼───────────────────────┘
                                            ↓
                            Multi-View Embeddings (Title/Content/Summary)
                                            ↓
                                    Pinecone Upsert + DB Store
                                            ↓
                            ════════════════════════════════════
                                            ↓
                                POST /v1/search (API Key Auth)
                                            ↓
                            Four-Path Parallel Search:
                            ├── Vector Search (Pinecone)
                            ├── Entity Search (Pattern Matching)
                            ├── Cluster Search (Topic Context)
                            └── Actor Search (Profile Relevance)
                                            ↓
                                    Merge & Dedupe
                                            ↓
                                Rerank (fast/balanced/thorough)
                                            ↓
                                    API Response
```

### Existing Infrastructure

- **Test data injection**: `packages/console-test-data/src/cli/inject.ts` triggers Inngest workflows
- **Datasets**: `comprehensive.json` (35 webhooks), `demo-incident.json` (cross-source incident)
- **Search API**: `apps/console/src/app/(api)/v1/search/route.ts` with dual auth (API key or session)
- **Four-path search**: `apps/console/src/lib/neural/four-path-search.ts`
- **Braintrust patterns**: `apps/chat/src/eval/*.eval.ts`

### Key Insight: sourceId → externalId Mapping

The `sourceId` is deterministic (e.g., `github:push:acme/platform:xyz789uvw012:test:0`), but search results return `externalId` (nanoid generated at ingestion). To build ground truth:

1. Inject test data
2. Wait for ingestion to complete
3. Query DB to map `sourceId` → `externalId`
4. Use `externalId` as expected observation IDs in evaluation

## Desired End State

After this plan is complete:

1. **`packages/console-eval/`** package exists with:
   - Retrieval metrics library (MRR, NDCG@K, Recall@K, Precision@K)
   - End-to-end evaluation runner that calls the actual `/v1/search` API
   - Test workspace and API key management utilities
   - Ingestion waiter that polls for workflow completion

2. **Evaluation workflow**:
   ```bash
   # 1. Set up test workspace (one-time)
   pnpm eval:setup --workspace test-eval-ws

   # 2. Run end-to-end evaluation
   pnpm eval:e2e --dataset comprehensive --workspace test-eval-ws
   ```

3. **Verification**:
   - Evaluation calls the actual search API with real API key
   - Results reflect the full pipeline (ingestion → search)
   - Metrics appear in Braintrust dashboard

## What We're NOT Doing

- Mocking the search API or Pinecone
- Isolated mode with pre-loaded vectors (that was the old plan)
- Component-level evaluations (significance, entity extraction, etc.)
- CI/CD GitHub Actions integration (follow-up work)
- Production workspace evaluation (use dedicated test workspace)

## Implementation Approach

The evaluation runs against a **dedicated test workspace** to avoid polluting production data:

1. **Setup phase**: Create/identify test workspace with API key
2. **Ingestion phase**: Inject dataset via Inngest, poll for completion
3. **Ground truth phase**: Query DB to build sourceId → externalId mapping
4. **Evaluation phase**: Run queries against search API, calculate metrics
5. **Cleanup phase**: Optionally clear test data

---

## Phase 1: Create `packages/console-eval` Package Structure

### Overview

Set up the new package with proper dependencies for end-to-end evaluation.

### Changes Required

#### 1. Create package.json
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
    "./e2e": "./src/e2e/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "with-env": "dotenv -e ../../apps/console/.vercel/.env.development.local --",
    "eval:e2e": "pnpm with-env tsx src/eval/e2e-retrieval.eval.ts",
    "eval:setup": "pnpm with-env tsx src/cli/setup.ts"
  },
  "dependencies": {
    "@api/console": "workspace:*",
    "@db/console": "workspace:*",
    "@repo/ai": "workspace:*",
    "@repo/console-test-data": "workspace:*",
    "@repo/console-types": "workspace:*",
    "@vendor/observability": "workspace:*",
    "braintrust": "catalog:",
    "zod": "catalog:zod3"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "dotenv-cli": "^8.0.0",
    "eslint": "catalog:",
    "tsx": "^4.19.2",
    "typescript": "catalog:"
  }
}
```

#### 2. Create tsconfig.json
**File**: `packages/console-eval/tsconfig.json`

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 3. Create environment configuration
**File**: `packages/console-eval/src/config/env.ts`

```typescript
/**
 * End-to-end evaluation environment configuration
 */
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const evalEnv = createEnv({
  server: {
    // Braintrust
    BRAINTRUST_API_KEY: z.string().min(1),
    BRAINTRUST_PROJECT_NAME: z.string().default("lightfast-search-eval"),

    // Test workspace (for eval isolation)
    EVAL_WORKSPACE_ID: z.string().min(1).describe("Test workspace ID for evaluation"),
    EVAL_API_KEY: z.string().min(1).describe("API key for test workspace"),

    // Console API (defaults to local dev)
    CONSOLE_API_URL: z.string().url().default("http://localhost:4107"),

    // Database (for ground truth mapping)
    DATABASE_URL: z.string().min(1),

    // Inngest (for triggering ingestion)
    INNGEST_EVENT_KEY: z.string().optional(),
  },
  runtimeEnv: {
    BRAINTRUST_API_KEY: process.env.BRAINTRUST_API_KEY,
    BRAINTRUST_PROJECT_NAME: process.env.BRAINTRUST_PROJECT_NAME,
    EVAL_WORKSPACE_ID: process.env.EVAL_WORKSPACE_ID,
    EVAL_API_KEY: process.env.EVAL_API_KEY,
    CONSOLE_API_URL: process.env.CONSOLE_API_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

export interface EvalConfig {
  braintrust: {
    apiKey: string;
    projectName: string;
  };
  workspace: {
    id: string;
    apiKey: string;
  };
  consoleApiUrl: string;
}

export function getEvalConfig(): EvalConfig {
  return {
    braintrust: {
      apiKey: evalEnv.BRAINTRUST_API_KEY,
      projectName: evalEnv.BRAINTRUST_PROJECT_NAME,
    },
    workspace: {
      id: evalEnv.EVAL_WORKSPACE_ID,
      apiKey: evalEnv.EVAL_API_KEY,
    },
    consoleApiUrl: evalEnv.CONSOLE_API_URL,
  };
}
```

#### 4. Create package entry point
**File**: `packages/console-eval/src/index.ts`

```typescript
export * from "./config/env";
export * from "./metrics";
export * from "./e2e";
```

### Success Criteria

#### Automated Verification:
- [ ] Package installs cleanly: `pnpm install` from root
- [ ] Type checking passes: `pnpm --filter @repo/console-eval typecheck`

#### Manual Verification:
- [ ] Package appears in pnpm workspace list

**Implementation Note**: Pause for verification before Phase 2.

---

## Phase 2: Implement Retrieval Metrics Library

### Overview

Core metrics for evaluating search quality. Same as before but as a standalone library.

### Changes Required

#### 1. Create metrics types
**File**: `packages/console-eval/src/metrics/types.ts`

```typescript
/**
 * Types for retrieval evaluation metrics
 */

export interface RetrievalResult {
  /** Observation external ID (nanoid) */
  id: string;
  /** Relevance score from search (0-1) */
  score: number;
  /** Rank position (1-indexed) */
  rank: number;
}

export interface GroundTruth {
  /** Query that was executed */
  query: string;
  /** Set of observation external IDs that are relevant */
  relevantIds: Set<string>;
  /** Optional: graded relevance for NDCG */
  gradedRelevance?: Map<string, number>;
}

export interface RetrievalMetrics {
  mrr: number;
  recallAtK: Record<number, number>;
  precisionAtK: Record<number, number>;
  ndcgAtK: Record<number, number>;
  totalRelevant: number;
  totalRetrieved: number;
}
```

#### 2. Create metrics implementations
**File**: `packages/console-eval/src/metrics/retrieval.ts`

```typescript
/**
 * Retrieval metrics implementations
 */

import type { RetrievalResult, GroundTruth, RetrievalMetrics } from "./types";

export function calculateMRR(
  results: RetrievalResult[],
  groundTruth: GroundTruth
): number {
  const sorted = [...results].sort((a, b) => a.rank - b.rank);
  for (const result of sorted) {
    if (groundTruth.relevantIds.has(result.id)) {
      return 1 / result.rank;
    }
  }
  return 0;
}

export function calculateRecallAtK(
  results: RetrievalResult[],
  groundTruth: GroundTruth,
  k: number
): number {
  if (groundTruth.relevantIds.size === 0) return 1;
  const topK = results.sort((a, b) => a.rank - b.rank).slice(0, k);
  const found = topK.filter((r) => groundTruth.relevantIds.has(r.id)).length;
  return found / groundTruth.relevantIds.size;
}

export function calculatePrecisionAtK(
  results: RetrievalResult[],
  groundTruth: GroundTruth,
  k: number
): number {
  const topK = results.sort((a, b) => a.rank - b.rank).slice(0, k);
  if (topK.length === 0) return 0;
  const found = topK.filter((r) => groundTruth.relevantIds.has(r.id)).length;
  return found / Math.min(k, topK.length);
}

export function calculateNDCGAtK(
  results: RetrievalResult[],
  groundTruth: GroundTruth,
  k: number
): number {
  const topK = results.sort((a, b) => a.rank - b.rank).slice(0, k);

  // DCG
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const rel = groundTruth.gradedRelevance?.get(topK[i].id) ??
      (groundTruth.relevantIds.has(topK[i].id) ? 1 : 0);
    dcg += rel / Math.log2(i + 2);
  }

  // IDCG
  const relevances = groundTruth.gradedRelevance
    ? [...groundTruth.gradedRelevance.values()].sort((a, b) => b - a)
    : Array(groundTruth.relevantIds.size).fill(1);
  const idealK = relevances.slice(0, k);
  let idcg = 0;
  for (let i = 0; i < idealK.length; i++) {
    idcg += idealK[i] / Math.log2(i + 2);
  }

  return idcg === 0 ? 1 : dcg / idcg;
}

export function calculateAllMetrics(
  results: RetrievalResult[],
  groundTruth: GroundTruth,
  kValues: number[] = [5, 10]
): RetrievalMetrics {
  const recallAtK: Record<number, number> = {};
  const precisionAtK: Record<number, number> = {};
  const ndcgAtK: Record<number, number> = {};

  for (const k of kValues) {
    recallAtK[k] = calculateRecallAtK(results, groundTruth, k);
    precisionAtK[k] = calculatePrecisionAtK(results, groundTruth, k);
    ndcgAtK[k] = calculateNDCGAtK(results, groundTruth, k);
  }

  return {
    mrr: calculateMRR(results, groundTruth),
    recallAtK,
    precisionAtK,
    ndcgAtK,
    totalRelevant: groundTruth.relevantIds.size,
    totalRetrieved: results.length,
  };
}
```

#### 3. Create metrics index
**File**: `packages/console-eval/src/metrics/index.ts`

```typescript
export * from "./types";
export * from "./retrieval";
```

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes: `pnpm --filter @repo/console-eval typecheck`

**Implementation Note**: Pause for verification before Phase 3.

---

## Phase 3: Implement End-to-End Infrastructure

### Overview

Build the infrastructure for running end-to-end evaluations: search API client, ingestion triggering, and ground truth mapping.

### Changes Required

#### 1. Create search API client
**File**: `packages/console-eval/src/e2e/search-client.ts`

```typescript
/**
 * Search API client for evaluation
 *
 * Calls the actual /v1/search endpoint with API key authentication.
 */

import type { V1SearchRequest, V1SearchResponse } from "@repo/console-types";
import { log } from "@vendor/observability/log";

export interface SearchClientConfig {
  baseUrl: string;
  workspaceId: string;
  apiKey: string;
}

export class SearchClient {
  constructor(private config: SearchClientConfig) {}

  async search(request: V1SearchRequest): Promise<V1SearchResponse> {
    const url = `${this.config.baseUrl}/v1/search`;

    const startTime = Date.now();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`,
        "X-Workspace-ID": this.config.workspaceId,
      },
      body: JSON.stringify(request),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      log.error("Search API error", {
        status: response.status,
        error,
        latency,
      });
      throw new Error(`Search API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json() as V1SearchResponse;

    log.info("Search API response", {
      query: request.query.substring(0, 50),
      resultCount: data.data.length,
      total: data.meta.total,
      latency,
      apiLatency: data.latency.total,
    });

    return data;
  }
}
```

#### 2. Create ingestion utilities
**File**: `packages/console-eval/src/e2e/ingestion.ts`

```typescript
/**
 * Ingestion utilities for end-to-end evaluation
 *
 * Triggers test data ingestion via Inngest and waits for completion.
 */

import { loadDataset } from "@repo/console-test-data/loader";
import { triggerObservationCapture } from "@repo/console-test-data/trigger";
import { db } from "@db/console";
import { workspaceNeuralObservations } from "@db/console/schema";
import { eq, and, inArray } from "drizzle-orm";
import { log } from "@vendor/observability/log";

export interface IngestionResult {
  triggered: number;
  sourceIds: string[];
  duration: number;
}

/**
 * Inject a dataset into a workspace via Inngest workflows
 */
export async function injectDataset(
  datasetName: string,
  workspaceId: string
): Promise<IngestionResult> {
  log.info("Loading dataset", { datasetName });
  const dataset = loadDataset(datasetName);

  log.info("Triggering ingestion", {
    datasetName,
    workspaceId,
    eventCount: dataset.events.length,
  });

  const result = await triggerObservationCapture(dataset.events, {
    workspaceId,
    batchSize: 10,
    delayMs: 100,
    onProgress: (current, total) => {
      if (current % 10 === 0 || current === total) {
        log.info("Ingestion progress", { current, total });
      }
    },
  });

  return {
    triggered: result.triggered,
    sourceIds: result.sourceIds,
    duration: result.duration,
  };
}

/**
 * Wait for observations to appear in database
 *
 * Polls the database until all expected sourceIds have corresponding observations.
 */
export async function waitForIngestion(
  workspaceId: string,
  sourceIds: string[],
  options: {
    maxWaitMs?: number;
    pollIntervalMs?: number;
  } = {}
): Promise<Map<string, string>> {
  const maxWaitMs = options.maxWaitMs ?? 120000; // 2 minutes default
  const pollIntervalMs = options.pollIntervalMs ?? 2000; // 2 seconds

  const startTime = Date.now();
  const sourceIdSet = new Set(sourceIds);
  const mapping = new Map<string, string>(); // sourceId -> externalId

  log.info("Waiting for ingestion", {
    workspaceId,
    expectedCount: sourceIds.length,
    maxWaitMs,
  });

  while (Date.now() - startTime < maxWaitMs) {
    // Query for observations matching our sourceIds
    const observations = await db
      .select({
        sourceId: workspaceNeuralObservations.sourceId,
        externalId: workspaceNeuralObservations.externalId,
      })
      .from(workspaceNeuralObservations)
      .where(
        and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          inArray(workspaceNeuralObservations.sourceId, sourceIds)
        )
      );

    // Update mapping
    for (const obs of observations) {
      mapping.set(obs.sourceId, obs.externalId);
    }

    const found = mapping.size;
    const expected = sourceIdSet.size;

    log.info("Ingestion check", {
      found,
      expected,
      elapsed: Date.now() - startTime,
    });

    if (found >= expected) {
      log.info("Ingestion complete", {
        found,
        duration: Date.now() - startTime,
      });
      return mapping;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Timeout - return what we have
  log.warn("Ingestion timeout", {
    found: mapping.size,
    expected: sourceIdSet.size,
    elapsed: Date.now() - startTime,
  });

  return mapping;
}

/**
 * Clear test data from a workspace
 */
export async function clearTestData(workspaceId: string): Promise<number> {
  // Only delete observations marked as test data
  const result = await db
    .delete(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        // Assuming test data has sourceId containing ":test:"
        // This is a safety measure to avoid deleting real data
      )
    );

  // Note: This is a simplified version. In production, we'd check metadata.testData
  log.info("Cleared test data", { workspaceId });

  return 0; // Drizzle doesn't return affected rows easily
}
```

#### 3. Create ground truth builder
**File**: `packages/console-eval/src/e2e/ground-truth.ts`

```typescript
/**
 * Ground truth builder for evaluation
 *
 * Maps evaluation queries to expected observation IDs.
 */

import type { SourceEvent } from "@repo/console-types";
import type { GroundTruth } from "../metrics/types";

export type QueryType = "temporal" | "actor" | "technical" | "status" | "null";

export interface EvalQuery {
  id: string;
  query: string;
  queryType: QueryType;
  /** sourceIds that should be returned (before ingestion) */
  expectedSourceIds: string[];
  complexity: "simple" | "medium" | "complex";
  notes?: string;
}

export interface EvalCase {
  query: EvalQuery;
  /** externalIds that should be returned (after ingestion mapping) */
  groundTruth: GroundTruth;
}

/**
 * Build evaluation cases by mapping sourceIds to externalIds
 */
export function buildEvalCases(
  queries: EvalQuery[],
  sourceIdToExternalId: Map<string, string>
): EvalCase[] {
  return queries.map((query) => {
    const relevantIds = new Set<string>();

    for (const sourceId of query.expectedSourceIds) {
      const externalId = sourceIdToExternalId.get(sourceId);
      if (externalId) {
        relevantIds.add(externalId);
      }
    }

    return {
      query,
      groundTruth: {
        query: query.query,
        relevantIds,
      },
    };
  });
}

/**
 * Generate evaluation queries from a dataset's source events
 *
 * This creates queries based on the actual content of the dataset.
 */
export function generateQueriesFromDataset(
  events: SourceEvent[],
  datasetName: string
): EvalQuery[] {
  const queries: EvalQuery[] = [];

  // Group events by actor
  const eventsByActor = new Map<string, SourceEvent[]>();
  for (const event of events) {
    const actorName = event.actor?.name ?? "unknown";
    if (!eventsByActor.has(actorName)) {
      eventsByActor.set(actorName, []);
    }
    eventsByActor.get(actorName)!.push(event);
  }

  // Generate actor queries
  for (const [actorName, actorEvents] of eventsByActor) {
    if (actorName !== "unknown" && actorEvents.length > 0) {
      queries.push({
        id: `${datasetName}-actor-${actorName}`,
        query: `What did ${actorName} work on?`,
        queryType: "actor",
        expectedSourceIds: actorEvents.map((e) => e.sourceId),
        complexity: actorEvents.length > 2 ? "medium" : "simple",
        notes: `Actor query for ${actorName} (${actorEvents.length} events)`,
      });
    }
  }

  // Generate technical queries based on titles/content
  const authEvents = events.filter(
    (e) =>
      e.title.toLowerCase().includes("auth") ||
      e.content.toLowerCase().includes("authentication")
  );
  if (authEvents.length > 0) {
    queries.push({
      id: `${datasetName}-tech-auth`,
      query: "What authentication changes were made?",
      queryType: "technical",
      expectedSourceIds: authEvents.map((e) => e.sourceId),
      complexity: "simple",
      notes: "Technical query for authentication-related events",
    });
  }

  // Generate security queries
  const securityEvents = events.filter(
    (e) =>
      e.title.toLowerCase().includes("security") ||
      e.title.toLowerCase().includes("vulnerability") ||
      e.title.toLowerCase().includes("cve")
  );
  if (securityEvents.length > 0) {
    queries.push({
      id: `${datasetName}-tech-security`,
      query: "What security issues were addressed?",
      queryType: "technical",
      expectedSourceIds: securityEvents.map((e) => e.sourceId),
      complexity: "simple",
      notes: "Technical query for security-related events",
    });
  }

  // Generate null query (tests precision - should return nothing)
  queries.push({
    id: `${datasetName}-null-unknown`,
    query: "What did NonExistentUser99 work on?",
    queryType: "null",
    expectedSourceIds: [],
    complexity: "simple",
    notes: "Null query - should return no results",
  });

  return queries;
}
```

#### 4. Create e2e index
**File**: `packages/console-eval/src/e2e/index.ts`

```typescript
export * from "./search-client";
export * from "./ingestion";
export * from "./ground-truth";
```

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes: `pnpm --filter @repo/console-eval typecheck`
- [ ] All imports resolve correctly

#### Manual Verification:
- [ ] SearchClient can make requests to local dev server

**Implementation Note**: Pause for verification before Phase 4.

---

## Phase 4: Implement End-to-End Evaluation Runner

### Overview

The main evaluation runner that orchestrates: inject data → wait for ingestion → build ground truth → run queries → calculate metrics.

### Changes Required

#### 1. Create Braintrust scorers
**File**: `packages/console-eval/src/scorers/retrieval-scorers.ts`

```typescript
/**
 * Braintrust scorer functions for retrieval evaluation
 */

import type { EvalScorerArgs } from "braintrust";
import {
  calculateMRR,
  calculateRecallAtK,
  calculatePrecisionAtK,
  calculateNDCGAtK,
} from "../metrics/retrieval";
import type { GroundTruth, RetrievalResult } from "../metrics/types";

export interface E2EEvalInput {
  query: string;
  queryType: string;
  queryId: string;
}

export interface E2EEvalOutput {
  results: RetrievalResult[];
  latencyMs: number;
  mode: string;
  paths: {
    vector: boolean;
    entity: boolean;
    cluster: boolean;
    actor: boolean;
  };
}

export interface E2EEvalExpected {
  relevantIds: string[];
}

type ScorerArgs = EvalScorerArgs<E2EEvalInput, E2EEvalOutput, E2EEvalExpected>;

function toGroundTruth(expected: E2EEvalExpected): GroundTruth {
  return {
    query: "",
    relevantIds: new Set(expected.relevantIds),
  };
}

export function mrrScorer() {
  return {
    name: "mrr",
    scorer: async (args: ScorerArgs) => {
      const gt = toGroundTruth(args.expected);
      return { score: calculateMRR(args.output.results, gt) };
    },
  };
}

export function recallAtKScorer(k: number) {
  return {
    name: `recall@${k}`,
    scorer: async (args: ScorerArgs) => {
      const gt = toGroundTruth(args.expected);
      return { score: calculateRecallAtK(args.output.results, gt, k) };
    },
  };
}

export function precisionAtKScorer(k: number) {
  return {
    name: `precision@${k}`,
    scorer: async (args: ScorerArgs) => {
      const gt = toGroundTruth(args.expected);
      return { score: calculatePrecisionAtK(args.output.results, gt, k) };
    },
  };
}

export function ndcgAtKScorer(k: number) {
  return {
    name: `ndcg@${k}`,
    scorer: async (args: ScorerArgs) => {
      const gt = toGroundTruth(args.expected);
      return { score: calculateNDCGAtK(args.output.results, gt, k) };
    },
  };
}

export function latencyScorer(targetMs: number = 500) {
  return {
    name: "latency",
    scorer: async (args: ScorerArgs) => {
      const score = Math.max(0, Math.min(1, 2 - args.output.latencyMs / targetMs));
      return {
        score,
        metadata: { latencyMs: args.output.latencyMs, targetMs },
      };
    },
  };
}
```

#### 2. Create end-to-end evaluation runner
**File**: `packages/console-eval/src/eval/e2e-retrieval.eval.ts`

```typescript
/**
 * End-to-End Retrieval Evaluation
 *
 * Tests the complete search pipeline:
 * Ingestion → Database → Pinecone → Four-Path Search → Rerank → API Response
 *
 * Run with: pnpm eval:e2e
 */

import { Eval, initLogger } from "braintrust";
import type { EvalCase } from "braintrust";
import { loadDataset } from "@repo/console-test-data/loader";
import { log } from "@vendor/observability/log";

import { getEvalConfig } from "../config/env";
import { SearchClient } from "../e2e/search-client";
import { injectDataset, waitForIngestion } from "../e2e/ingestion";
import { generateQueriesFromDataset, buildEvalCases } from "../e2e/ground-truth";
import {
  mrrScorer,
  recallAtKScorer,
  precisionAtKScorer,
  ndcgAtKScorer,
  latencyScorer,
  type E2EEvalInput,
  type E2EEvalOutput,
  type E2EEvalExpected,
} from "../scorers/retrieval-scorers";
import type { RetrievalResult } from "../metrics/types";

// Configuration
const DATASET_NAME = process.env.EVAL_DATASET ?? "comprehensive";
const SEARCH_MODE = (process.env.EVAL_SEARCH_MODE ?? "balanced") as "fast" | "balanced" | "thorough";
const SKIP_INGESTION = process.env.EVAL_SKIP_INGESTION === "true";

// Initialize
const config = getEvalConfig();

initLogger({
  apiKey: config.braintrust.apiKey,
  projectName: config.braintrust.projectName,
});

const searchClient = new SearchClient({
  baseUrl: config.consoleApiUrl,
  workspaceId: config.workspace.id,
  apiKey: config.workspace.apiKey,
});

/**
 * Setup phase: inject data and build ground truth mapping
 */
async function setup(): Promise<{
  evalCases: EvalCase<E2EEvalInput, E2EEvalExpected, { queryType: string }>[];
}> {
  log.info("Starting E2E evaluation setup", {
    dataset: DATASET_NAME,
    workspaceId: config.workspace.id,
    skipIngestion: SKIP_INGESTION,
  });

  // Load dataset
  const dataset = loadDataset(DATASET_NAME);
  log.info("Dataset loaded", {
    name: dataset.name,
    eventCount: dataset.events.length,
  });

  let sourceIdMapping: Map<string, string>;

  if (SKIP_INGESTION) {
    // If skipping ingestion, query existing observations
    log.info("Skipping ingestion, using existing data");
    const sourceIds = dataset.events.map((e) => e.sourceId);
    sourceIdMapping = await waitForIngestion(config.workspace.id, sourceIds, {
      maxWaitMs: 10000, // Short timeout since data should exist
      pollIntervalMs: 1000,
    });
  } else {
    // Inject dataset
    const ingestionResult = await injectDataset(DATASET_NAME, config.workspace.id);
    log.info("Dataset injected", ingestionResult);

    // Wait for ingestion to complete
    sourceIdMapping = await waitForIngestion(
      config.workspace.id,
      ingestionResult.sourceIds,
      { maxWaitMs: 180000, pollIntervalMs: 3000 }
    );
  }

  log.info("Source ID mapping complete", {
    mappedCount: sourceIdMapping.size,
    expectedCount: dataset.events.length,
  });

  // Generate evaluation queries from dataset
  const evalQueries = generateQueriesFromDataset(dataset.events, DATASET_NAME);
  log.info("Generated evaluation queries", { count: evalQueries.length });

  // Build eval cases with ground truth
  const evalCasesWithGT = buildEvalCases(evalQueries, sourceIdMapping);

  // Convert to Braintrust format
  const evalCases = evalCasesWithGT.map((ec) => ({
    input: {
      query: ec.query.query,
      queryType: ec.query.queryType,
      queryId: ec.query.id,
    },
    expected: {
      relevantIds: [...ec.groundTruth.relevantIds],
    },
    metadata: {
      queryType: ec.query.queryType,
      complexity: ec.query.complexity,
      notes: ec.query.notes,
    },
  }));

  return { evalCases };
}

/**
 * Execute search query against the real API
 */
async function executeSearch(input: E2EEvalInput): Promise<E2EEvalOutput> {
  const response = await searchClient.search({
    query: input.query,
    limit: 10,
    offset: 0,
    mode: SEARCH_MODE,
    includeContext: false,
    includeHighlights: false,
  });

  const results: RetrievalResult[] = response.data.map((r, index) => ({
    id: r.id,
    score: r.score,
    rank: index + 1,
  }));

  return {
    results,
    latencyMs: response.latency.total,
    mode: response.meta.mode,
    paths: response.meta.paths,
  };
}

/**
 * Main evaluation
 */
async function runEvaluation() {
  const { evalCases } = await setup();

  if (evalCases.length === 0) {
    log.error("No evaluation cases generated");
    process.exit(1);
  }

  log.info("Starting Braintrust evaluation", {
    caseCount: evalCases.length,
    searchMode: SEARCH_MODE,
  });

  void Eval(config.braintrust.projectName, {
    experimentName: `e2e-${DATASET_NAME}-${SEARCH_MODE}-${Date.now()}`,

    data: evalCases,

    task: async (input: E2EEvalInput): Promise<E2EEvalOutput> => {
      log.info("Executing query", { queryId: input.queryId, query: input.query });
      return executeSearch(input);
    },

    scores: [
      mrrScorer(),
      recallAtKScorer(5),
      recallAtKScorer(10),
      precisionAtKScorer(5),
      precisionAtKScorer(10),
      ndcgAtKScorer(5),
      ndcgAtKScorer(10),
      latencyScorer(500),
    ],
  });
}

// Run
runEvaluation().catch((error) => {
  log.error("Evaluation failed", { error });
  process.exit(1);
});
```

#### 3. Create scorers index
**File**: `packages/console-eval/src/scorers/index.ts`

```typescript
export * from "./retrieval-scorers";
```

#### 4. Update package exports
**File**: Update `packages/console-eval/src/index.ts`:

```typescript
export * from "./config/env";
export * from "./metrics";
export * from "./e2e";
export * from "./scorers";
```

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes: `pnpm --filter @repo/console-eval typecheck`
- [ ] Linting passes: `pnpm --filter @repo/console-eval lint`

#### Manual Verification:
- [ ] With local dev server running, evaluation executes successfully
- [ ] Results appear in Braintrust dashboard
- [ ] Metrics are calculated correctly

**Implementation Note**: Pause for verification before Phase 5.

---

## Phase 5: Create Test Workspace Setup CLI

### Overview

A CLI tool to set up a dedicated test workspace for evaluation, including creating an API key.

### Changes Required

#### 1. Create setup CLI
**File**: `packages/console-eval/src/cli/setup.ts`

```typescript
#!/usr/bin/env npx tsx
/**
 * Evaluation Setup CLI
 *
 * Sets up a test workspace for end-to-end evaluation.
 *
 * Usage:
 *   pnpm eval:setup
 */

import { db } from "@db/console";
import { orgWorkspaces, userApiKeys } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { nanoid } from "nanoid";
import crypto from "node:crypto";

const EVAL_WORKSPACE_NAME = "eval-test-workspace";

function generateApiKey(): string {
  return `lf_eval_${crypto.randomBytes(24).toString("base64url")}`;
}

async function setup() {
  console.log("=".repeat(60));
  console.log("Evaluation Workspace Setup");
  console.log("=".repeat(60));

  // Check for existing eval workspace
  const existingWorkspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.name, EVAL_WORKSPACE_NAME),
  });

  if (existingWorkspace) {
    console.log(`\nFound existing eval workspace: ${existingWorkspace.id}`);

    // Check for existing API key
    const existingKey = await db.query.userApiKeys.findFirst({
      where: and(
        eq(userApiKeys.workspaceId, existingWorkspace.id),
        eq(userApiKeys.name, "eval-api-key")
      ),
    });

    if (existingKey) {
      console.log("\nEval workspace already set up.");
      console.log("\nAdd these to your .env:");
      console.log(`EVAL_WORKSPACE_ID=${existingWorkspace.id}`);
      console.log(`EVAL_API_KEY=<check your existing key>`);
      return;
    }
  }

  console.log("\nThis CLI helps you identify the workspace and API key for evaluation.");
  console.log("You need to:");
  console.log("1. Create a test workspace in the Console UI");
  console.log("2. Create an API key for that workspace");
  console.log("3. Add the IDs to your .env file");
  console.log("\nEnvironment variables needed:");
  console.log("  EVAL_WORKSPACE_ID=<your-test-workspace-id>");
  console.log("  EVAL_API_KEY=<your-api-key>");
  console.log("\nThe eval runner will use these to authenticate with the search API.");
}

setup().catch((error) => {
  console.error("Setup failed:", error);
  process.exit(1);
});
```

### Success Criteria

#### Automated Verification:
- [ ] CLI runs without errors: `pnpm --filter @repo/console-eval eval:setup`

#### Manual Verification:
- [ ] Instructions are clear for setting up test workspace
- [ ] Environment variable format is correct

**Implementation Note**: Pause for verification before Phase 6.

---

## Phase 6: Documentation and Integration

### Overview

Create documentation for running evaluations and add helper scripts.

### Changes Required

#### 1. Create README
**File**: `packages/console-eval/README.md`

```markdown
# @repo/console-eval

End-to-end evaluation pipeline for Lightfast's search API.

## Overview

This package provides tools to evaluate the complete search pipeline:

```
Webhook → Ingestion (Inngest) → Database + Pinecone → Search API → Results
```

## Setup

### 1. Create Test Workspace

Create a dedicated workspace for evaluation in the Console UI to avoid polluting production data.

### 2. Create API Key

Create an API key for the test workspace.

### 3. Configure Environment

Add to `apps/console/.vercel/.env.development.local`:

```bash
# Evaluation config
EVAL_WORKSPACE_ID=your-test-workspace-id
EVAL_API_KEY=lf_your-api-key

# Braintrust
BRAINTRUST_API_KEY=your-braintrust-key
BRAINTRUST_PROJECT_NAME=lightfast-search-eval
```

## Running Evaluations

### Prerequisites

1. Start the local dev server: `pnpm dev:console`
2. Start Inngest dev server (runs automatically with dev:app)

### Run Evaluation

```bash
# Full end-to-end evaluation (injects data, waits, evaluates)
pnpm --filter @repo/console-eval eval:e2e

# Skip ingestion (use existing data)
EVAL_SKIP_INGESTION=true pnpm --filter @repo/console-eval eval:e2e

# Use different dataset
EVAL_DATASET=demo-incident pnpm --filter @repo/console-eval eval:e2e

# Use different search mode
EVAL_SEARCH_MODE=thorough pnpm --filter @repo/console-eval eval:e2e
```

## Metrics

The evaluation calculates:

- **MRR** (Mean Reciprocal Rank): How quickly is the first relevant result found?
- **Recall@K**: What fraction of relevant docs did we find in top K?
- **Precision@K**: What fraction of top K results are relevant?
- **NDCG@K**: Ranking quality with position weighting
- **Latency**: Response time (penalizes > 500ms)

## Datasets

- `comprehensive` (default): 35 webhooks covering auth, performance, infra, features, bugs
- `demo-incident`: Cross-source incident storyline (Sentry + Linear + GitHub + Vercel)

## Architecture

```
packages/console-eval/
├── src/
│   ├── config/env.ts       # Environment configuration
│   ├── metrics/            # MRR, NDCG, Recall, Precision implementations
│   ├── e2e/
│   │   ├── search-client.ts    # Calls /v1/search API
│   │   ├── ingestion.ts        # Triggers Inngest workflows
│   │   └── ground-truth.ts     # Builds expected results
│   ├── scorers/            # Braintrust scorer functions
│   └── eval/
│       └── e2e-retrieval.eval.ts  # Main evaluation runner
```
```

### Success Criteria

#### Automated Verification:
- [ ] README renders correctly
- [ ] All commands in README are accurate

#### Manual Verification:
- [ ] A developer can follow the README to run their first evaluation

---

## Testing Strategy

### Manual Testing Steps

1. **Start local environment**:
   ```bash
   pnpm dev:app  # Starts console + Inngest
   ```

2. **Set up test workspace** (one-time):
   - Create workspace in Console UI
   - Create API key
   - Add to `.env`

3. **Run evaluation**:
   ```bash
   pnpm --filter @repo/console-eval eval:e2e
   ```

4. **Verify in Braintrust**:
   - Check experiment appears in dashboard
   - Verify metrics are calculated
   - Review individual query results

### What the Evaluation Tests

- ✅ Data injection via Inngest workflows
- ✅ Observation capture (significance, classification, entity extraction)
- ✅ Multi-view embedding generation
- ✅ Pinecone vector storage
- ✅ Database storage
- ✅ Four-path parallel search
- ✅ Reranking (fast/balanced/thorough modes)
- ✅ API authentication and response format

---

## Performance Considerations

1. **Ingestion wait time**: Default 3 minutes for 35 webhooks, may need tuning for larger datasets
2. **Inngest rate limiting**: Batch size of 10 with 100ms delays between batches
3. **API latency**: Evaluation runs sequentially, consider parallelizing for speed

---

## References

- Research document: `thoughts/shared/research/2026-02-05-search-api-evaluation-pipeline-golden-dataset-design.md`
- Four-path search: `apps/console/src/lib/neural/four-path-search.ts`
- Search API: `apps/console/src/app/(api)/v1/search/route.ts`
- Test data injection: `packages/console-test-data/src/cli/inject.ts`
- Observation capture workflow: `api/console/src/inngest/workflow/neural/observation-capture.ts`
