# Self-Contained Eval Environment: Phases 1-3 Implementation Plan

## Overview

Implement the self-contained evaluation architecture from the [architecture design](../research/2026-02-07-eval-self-contained-architecture-design.md), covering Phases 1-3. This transforms the eval pipeline from HTTP-based (`searchAPI()` → running server) to in-process (`searchLogic()` → direct function call) by adding environment validation, infrastructure isolation, data seeding, and an in-process runner.

**Prerequisite complete**: Phase 0 (search pipeline extraction to `@repo/console-search`) was completed in commit `4249298c`.

**Scope**: Phases 1-3 only. CI integration (Phase 4) and HTTP deprecation (Phase 5) are deferred.

## Current State Analysis

### What exists in `@repo/console-eval`:
- `src/clients/search-client.ts` — HTTP client (`searchAPI()`) calling `/v1/search`
- `src/eval/runner.ts` — `runEval()` orchestrator using HTTP search
- `src/eval/compare.ts` — Paired bootstrap comparison engine
- `src/metrics/` — Retrieval metrics (MRR, Recall@K, NDCG@K), RAG quality, statistics
- `src/generation/` — Corpus generation, query generation, critic, ground truth
- `src/datasets/schema.ts` — Zod schema for eval datasets
- `src/cli/` — CLI commands (run, compare, generate-dataset)

### What exists in `@repo/console-search` (Phase 0 output):
- `searchLogic(auth, input, options?)` — Pure async function, fully decoupled from HTTP
- `V1AuthContext` — `{ workspaceId, userId, authType, apiKeyId? }`
- `SearchLogicInput` — `{ query, limit, offset, mode, filters?, includeContext, includeHighlights, requestId }`
- `SearchLogicOptions` — `{ onActivity? }` — injectable activity recording

### Key Discoveries:
- `db` singleton at `db/console/src/client.ts:26` reads `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` from env at import time
- `pineconeClient` at `vendor/pinecone/src/client.ts:285` reads `PINECONE_API_KEY` from env at import time
- `embedEnv` at `vendor/embed/src/env.ts:9` reads `COHERE_API_KEY` from env at import time
- `getCachedWorkspaceConfig()` at `packages/console-workspace-cache/src/config.ts:27` tries Redis first, falls back to DB — no Redis needed for eval
- Workspace `settings.embedding.namespaceName` controls Pinecone namespace routing automatically
- Connection string pattern: `postgresql://{user}:{pass}@{host}:6432/postgres?sslmode=verify-full`
- Env validation pattern: `@t3-oss/env-core` with `runtimeEnv: process.env`, `skipValidation: !!process.env.SKIP_ENV_VALIDATION`

## Desired End State

After Phases 1-3 are complete:

1. `pnpm --filter @repo/console-eval seed --run-id local-test` seeds an eval workspace + observations + vectors into an isolated PlanetScale branch and Pinecone eval namespace
2. `pnpm --filter @repo/console-eval eval:local --run-id local-test` runs the full eval suite in-process using `searchLogic()` directly (no HTTP, no running server)
3. Results are saved to JSON and optionally logged to Braintrust
4. Safety guards prevent accidental production writes (namespace prefix enforcement, workspace ID prefix enforcement)

### Verification:
- `pnpm typecheck` passes with zero errors
- `pnpm build:console` passes (console app still works with thin wrapper)
- `pnpm --filter @repo/console-eval typecheck` passes
- `pnpm --filter @repo/console-eval build` passes
- Seed CLI validates safety guards before any writes
- In-process runner validates safety guards before any searches

## What We're NOT Doing

- CI integration (GitHub Actions workflow) — deferred to Phase 4
- HTTP eval path deprecation — both runners coexist
- Cluster and actor search paths in eval — `enableClusters: false`, `enableActors: false`
- Redis/cache integration for eval — let cache miss gracefully, fall back to DB
- Full LLM entity extraction in seeder — use pre-extracted entities from corpus JSON
- PlanetScale branch creation automation — manual setup for now, automated in Phase 4

---

## Phase 1: Foundation (Types, Config, Environment)

### Overview
Add type-safe environment validation, eval context types, infrastructure config, and safety guards. No runtime behavior changes — pure additive.

### Changes Required:

#### 1. Add `@t3-oss/env-core` and new dependencies to package.json
**File**: `packages/console-eval/package.json`
**Changes**: Add dependencies for env validation and console-search import

```jsonc
// Add to "dependencies":
"@t3-oss/env-core": "catalog:",
"@repo/console-search": "workspace:*",
"@repo/console-embed": "workspace:*",
"@repo/console-pinecone": "workspace:*",
"@repo/console-rerank": "workspace:*",
"@repo/console-workspace-cache": "workspace:*",
"@vendor/pinecone": "workspace:*",
"postgres": "catalog:",
```

#### 2. Create eval environment validation
**File**: `packages/console-eval/src/env.ts` (NEW)
**Changes**: Type-safe env validation using `@t3-oss/env-core` pattern from `vendor/braintrust/src/env.ts`

```typescript
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Environment configuration for AI Evaluation Pipeline.
 *
 * All eval-specific variables use the EVAL_ prefix to prevent
 * accidental use of production credentials.
 *
 * Required for in-process eval execution:
 * - EVAL_DATABASE_HOST: PlanetScale Postgres endpoint (horizon.psdb.cloud)
 * - EVAL_DATABASE_USERNAME: Branch-scoped credential ({role}.{branch_id})
 * - EVAL_DATABASE_PASSWORD: Branch-scoped password (pscale_pw_...)
 * - EVAL_PINECONE_API_KEY: Pinecone API key (namespace isolation is per-call)
 * - EVAL_COHERE_API_KEY: Cohere API key for embeddings + reranking
 *
 * Optional:
 * - EVAL_BRAINTRUST_API_KEY: Braintrust for experiment tracking
 * - EVAL_PINECONE_NAMESPACE: Override namespace (default: eval:{runId})
 * - EVAL_SEARCH_MODE: Default search mode (default: balanced)
 * - EVAL_RUN_ID: Unique run identifier (default: local-{timestamp})
 */
export const evalEnv = createEnv({
  server: {
    // Database — PlanetScale eval branch via PgBouncer
    EVAL_DATABASE_HOST: z.string().min(1),
    EVAL_DATABASE_USERNAME: z.string().min(1),
    EVAL_DATABASE_PASSWORD: z.string().min(1),

    // Pinecone — same API key, namespace isolation per-call
    EVAL_PINECONE_API_KEY: z.string().min(1),

    // Cohere — embeddings and reranking
    EVAL_COHERE_API_KEY: z.string().min(1),

    // Braintrust — optional experiment tracking
    EVAL_BRAINTRUST_API_KEY: z.string().min(1).optional(),

    // Eval configuration overrides
    EVAL_PINECONE_NAMESPACE: z.string().min(1).optional(),
    EVAL_SEARCH_MODE: z.enum(["fast", "balanced", "thorough"]).default("balanced"),
    EVAL_RUN_ID: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
```

#### 3. Create eval context types and safety guards
**File**: `packages/console-eval/src/context/eval-context.ts` (NEW)
**Changes**: EvalContext interface + assertEvalSafety

```typescript
import type { V1AuthContext } from "@repo/console-search";

/**
 * Infrastructure credentials for eval execution.
 * All fields are explicit — no implicit env var usage.
 */
export interface EvalInfraConfig {
  /** PlanetScale eval branch credentials (postgres-js over TCP/PgBouncer) */
  db: {
    host: string;       // e.g. "horizon.psdb.cloud"
    username: string;   // e.g. "{role}.{branch_id}" (branch-scoped)
    password: string;   // e.g. "pscale_pw_..." (branch-scoped)
  };
  /** Pinecone API key (same key, eval namespace isolation is per-call) */
  pinecone: {
    apiKey: string;
  };
  /** Cohere API key for embeddings + reranking */
  cohere: {
    apiKey: string;
  };
  /** Braintrust (optional — omit for noSendLogs mode) */
  braintrust?: {
    apiKey: string;
  };
}

/**
 * Eval-specific workspace configuration.
 * Controls which Pinecone namespace the pipeline queries.
 */
export interface EvalWorkspaceConfig {
  workspaceId: string;
  indexName: string;
  namespaceName: string;       // e.g. "eval:run_abc123"
  embeddingModel: string;      // e.g. "embed-english-v3.0"
  embeddingDim: number;        // e.g. 1024
  enableClusters: boolean;
  enableActors: boolean;
}

/**
 * Complete eval context — everything needed to run searchLogic() in isolation.
 */
export interface EvalContext {
  auth: V1AuthContext;
  workspaceConfig: EvalWorkspaceConfig;
  infra: EvalInfraConfig;
  runId: string;
}

/**
 * Safety guard: validate that eval config does NOT point to production.
 * Checks namespace prefix and workspace ID prefix.
 * Three layers of defense:
 *   1. PlanetScale branch-scoped passwords (physical isolation)
 *   2. Pinecone namespace prefix enforcement (this function)
 *   3. Workspace ID prefix enforcement (this function)
 */
export function assertEvalSafety(
  workspace: EvalWorkspaceConfig,
): void {
  if (!workspace.namespaceName.startsWith("eval:")) {
    throw new Error(
      `SAFETY: Eval namespace must start with "eval:" prefix. ` +
      `Got: "${workspace.namespaceName}". ` +
      `This prevents accidental writes to production Pinecone namespaces.`
    );
  }

  if (!workspace.workspaceId.startsWith("eval_")) {
    throw new Error(
      `SAFETY: Eval workspaceId must start with "eval_" prefix. ` +
      `Got: "${workspace.workspaceId}". ` +
      `This prevents accidental queries against production workspace data.`
    );
  }
}
```

#### 4. Create infrastructure config loader
**File**: `packages/console-eval/src/config/infra.ts` (NEW)
**Changes**: Load EvalInfraConfig from validated env

```typescript
import { evalEnv } from "../env";
import type { EvalInfraConfig } from "../context/eval-context";

/**
 * Load eval infrastructure config from validated environment variables.
 * All EVAL_* env vars have already been validated by evalEnv.
 */
export function loadEvalInfraConfig(): EvalInfraConfig {
  return {
    db: {
      host: evalEnv.EVAL_DATABASE_HOST,
      username: evalEnv.EVAL_DATABASE_USERNAME,
      password: evalEnv.EVAL_DATABASE_PASSWORD,
    },
    pinecone: {
      apiKey: evalEnv.EVAL_PINECONE_API_KEY,
    },
    cohere: {
      apiKey: evalEnv.EVAL_COHERE_API_KEY,
    },
    braintrust: evalEnv.EVAL_BRAINTRUST_API_KEY
      ? { apiKey: evalEnv.EVAL_BRAINTRUST_API_KEY }
      : undefined,
  };
}
```

#### 5. Create full eval config with defaults
**File**: `packages/console-eval/src/config/eval-config.ts` (NEW)
**Changes**: EvalConfig combining infra, workspace, braintrust, and execution settings

```typescript
import { evalEnv } from "../env";
import type { EvalInfraConfig, EvalWorkspaceConfig } from "../context/eval-context";
import { loadEvalInfraConfig } from "./infra";

/**
 * Complete eval configuration — combines all settings needed for a run.
 */
export interface EvalConfig {
  runId: string;
  infra: EvalInfraConfig;
  workspace: EvalWorkspaceConfig;
  braintrust: {
    project: string;
    experiment: string;
    sendLogs: boolean;
  };
  execution: {
    searchMode: "fast" | "balanced" | "thorough";
    maxConcurrency: number;
    timeout: number;
    kValues: number[];
  };
  dataset: {
    casesPath: string;
    corpusPath: string;
    embeddingCachePath: string;
  };
}

/**
 * Create eval config with sensible defaults.
 * All infrastructure credentials come from validated EVAL_* env vars.
 */
export function createDefaultEvalConfig(overrides?: Partial<EvalConfig>): EvalConfig {
  const runId = evalEnv.EVAL_RUN_ID ?? `local-${Date.now()}`;

  return {
    runId,
    infra: loadEvalInfraConfig(),
    workspace: {
      workspaceId: `eval_ws_${runId}`,
      indexName: "lightfast-v1",
      namespaceName: evalEnv.EVAL_PINECONE_NAMESPACE ?? `eval:run_${runId}`,
      embeddingModel: "embed-english-v3.0",
      embeddingDim: 1024,
      enableClusters: false,
      enableActors: false,
    },
    braintrust: {
      project: "neural-search-eval",
      experiment: `eval-${runId}`,
      sendLogs: !!evalEnv.EVAL_BRAINTRUST_API_KEY,
    },
    execution: {
      searchMode: evalEnv.EVAL_SEARCH_MODE,
      maxConcurrency: 4,
      timeout: 30_000,
      kValues: [3, 5, 10],
    },
    dataset: {
      casesPath: "packages/console-eval/datasets/eval-dataset.json",
      corpusPath: "packages/console-eval/datasets/eval-corpus.json",
      embeddingCachePath: "packages/console-eval/cache/",
    },
    ...overrides,
  };
}
```

#### 6. Add new exports to package.json
**File**: `packages/console-eval/package.json`
**Changes**: Add export paths for new modules

```jsonc
// Add to "exports":
"./env": "./src/env.ts",
"./context": "./src/context/eval-context.ts",
"./config": "./src/config/eval-config.ts"
```

#### 7. Update src/index.ts with new exports
**File**: `packages/console-eval/src/index.ts`
**Changes**: Add re-exports for context and config types

```typescript
// Eval context and infrastructure
export type { EvalInfraConfig, EvalWorkspaceConfig, EvalContext } from "./context/eval-context";
export { assertEvalSafety } from "./context/eval-context";

// Eval configuration
export type { EvalConfig } from "./config/eval-config";
export { createDefaultEvalConfig } from "./config/eval-config";
export { loadEvalInfraConfig } from "./config/infra";
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` resolves new dependencies
- [x] `pnpm --filter @repo/console-eval typecheck` passes
- [x] `pnpm --filter @repo/console-eval build` passes
- [x] `pnpm typecheck` passes (full repo — only pre-existing @lightfastai/ai-sdk failure)

#### Manual Verification:
- [ ] `evalEnv` correctly validates when EVAL_* vars are set
- [ ] `evalEnv` throws meaningful error when required vars are missing (and SKIP_ENV_VALIDATION is not set)
- [ ] `assertEvalSafety()` rejects non-prefixed namespace and workspace IDs
- [ ] `createDefaultEvalConfig()` produces sensible defaults

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Data Seeding

### Overview
Build the direct seeding path that writes eval data to a PlanetScale branch and Pinecone eval namespace. Bypasses Inngest workflows by writing directly to DB + Pinecone.

### Changes Required:

#### 1. Create eval DB client
**File**: `packages/console-eval/src/seed/db.ts` (NEW)
**Changes**: Separate postgres-js client for eval seeding with smaller pool. Follows exact pattern from `db/console/src/client.ts:9-21`.

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@db/console/schema";
import type { EvalInfraConfig } from "../context/eval-context";

/**
 * Create a database client for eval seeding.
 * Uses postgres-js TCP driver through PgBouncer, same as production.
 * Lower pool size since eval has less concurrent load.
 *
 * Connection: postgresql://{user}:{pass}@{host}:6432/postgres?sslmode=verify-full
 * Matches production pattern in db/console/src/client.ts:9-21
 */
export function createEvalDbClient(infra: EvalInfraConfig) {
  const connectionString = `postgresql://${infra.db.username}:${infra.db.password}@${infra.db.host}:6432/postgres?sslmode=verify-full`;

  const client = postgres(connectionString, {
    ssl: "require",
    max: 5,               // Eval needs fewer connections than production (20)
    prepare: false,       // Required for PgBouncer transaction mode
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return {
    db: drizzle(client, { schema }),
    /** Close the connection pool. Call when seeding is complete. */
    close: () => client.end(),
  };
}
```

#### 2. Create workspace setup
**File**: `packages/console-eval/src/seed/workspace-setup.ts` (NEW)
**Changes**: Create or update eval workspace record in DB with correct settings for Pinecone routing

```typescript
import { eq } from "drizzle-orm";
import { orgWorkspaces } from "@db/console/schema";
import type { WorkspaceSettings } from "@repo/console-types";
import type { EvalWorkspaceConfig } from "../context/eval-context";

/**
 * Ensure eval workspace record exists in DB with correct settings.
 *
 * The workspace record is the control point for Pinecone routing:
 *   getCachedWorkspaceConfig(workspaceId) reads settings.embedding.namespaceName
 *   → fourPathParallelSearch uses this namespace for all Pinecone queries
 *
 * @param db - Drizzle client connected to eval branch
 * @param config - Eval workspace config (workspaceId, indexName, namespaceName, etc.)
 */
export async function ensureEvalWorkspace(
  db: ReturnType<typeof import("drizzle-orm/postgres-js").drizzle>,
  config: EvalWorkspaceConfig,
): Promise<void> {
  const settings: WorkspaceSettings = {
    version: 1,
    embedding: {
      indexName: config.indexName,
      namespaceName: config.namespaceName,
      embeddingModel: config.embeddingModel,
      embeddingDim: config.embeddingDim,
      embeddingProvider: "cohere",
      pineconeMetric: "cosine",
      pineconeCloud: "aws",
      pineconeRegion: "us-east-1",
      chunkMaxTokens: 512,
      chunkOverlap: 50,
    },
  };

  // Upsert: insert if not exists, update settings if exists
  const existing = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, config.workspaceId),
  });

  if (existing) {
    await db
      .update(orgWorkspaces)
      .set({ settings, updatedAt: new Date().toISOString() })
      .where(eq(orgWorkspaces.id, config.workspaceId));
  } else {
    await db.insert(orgWorkspaces).values({
      id: config.workspaceId,
      clerkOrgId: "org_eval" as any, // Eval-only org
      name: `eval-${config.namespaceName}`,
      slug: `eval-${Date.now()}`,
      settings,
    });
  }
}
```

#### 3. Create embedding cache
**File**: `packages/console-eval/src/seed/embedding-cache.ts` (NEW)
**Changes**: Cache pre-computed embeddings by dataset hash to avoid repeated Cohere API calls

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export interface EmbeddingCacheEntry {
  text: string;
  embedding: number[];
}

/**
 * Cache pre-computed embeddings keyed by corpus content hash.
 * Avoids redundant Cohere API calls on repeated seeding runs.
 */
export class EmbeddingCache {
  private cacheDir: string;
  private entries: Map<string, number[]> = new Map();
  private cacheFile: string;

  constructor(cacheDir: string, corpusHash: string) {
    this.cacheDir = cacheDir;
    this.cacheFile = join(cacheDir, `embeddings-${corpusHash}.json`);
    this.load();
  }

  /** Compute hash of corpus content for cache key */
  static hashCorpus(corpusJson: string): string {
    return createHash("sha256").update(corpusJson).digest("hex").slice(0, 16);
  }

  /** Check if embedding exists in cache */
  has(text: string): boolean {
    return this.entries.has(this.hashText(text));
  }

  /** Get cached embedding */
  get(text: string): number[] | undefined {
    return this.entries.get(this.hashText(text));
  }

  /** Store embedding in cache */
  set(text: string, embedding: number[]): void {
    this.entries.set(this.hashText(text), embedding);
  }

  /** Persist cache to disk */
  save(): void {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
    const data: EmbeddingCacheEntry[] = [];
    for (const [hash, embedding] of this.entries) {
      data.push({ text: hash, embedding });
    }
    writeFileSync(this.cacheFile, JSON.stringify(data));
  }

  /** Number of cached entries */
  get size(): number {
    return this.entries.size;
  }

  private load(): void {
    if (!existsSync(this.cacheFile)) return;
    try {
      const data: EmbeddingCacheEntry[] = JSON.parse(readFileSync(this.cacheFile, "utf-8"));
      for (const entry of data) {
        this.entries.set(entry.text, entry.embedding);
      }
    } catch {
      // Corrupted cache — start fresh
    }
  }

  private hashText(text: string): string {
    return createHash("sha256").update(text).digest("hex").slice(0, 32);
  }
}
```

#### 4. Create direct data seeder
**File**: `packages/console-eval/src/seed/seeder.ts` (NEW)
**Changes**: Orchestrates direct DB + Pinecone seeding, bypassing Inngest

```typescript
import { workspaceNeuralObservations, workspaceNeuralEntities } from "@db/console/schema";
import type { InsertWorkspaceNeuralObservation, InsertWorkspaceNeuralEntity } from "@db/console/schema";
import { PineconeClient } from "@vendor/pinecone";
import { createCohereEmbedding } from "@vendor/embed";
import { log } from "@vendor/observability/log";
import type { EvalInfraConfig, EvalWorkspaceConfig } from "../context/eval-context";
import { assertEvalSafety } from "../context/eval-context";
import { createEvalDbClient } from "./db";
import { ensureEvalWorkspace } from "./workspace-setup";
import { EmbeddingCache } from "./embedding-cache";

export interface SeedObservation {
  externalId: string;
  title: string;
  content: string;
  source: string;
  sourceType: string;
  sourceId: string;
  observationType: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
  /** Pre-extracted entities */
  entities?: Array<{
    category: string;
    key: string;
    value?: string;
  }>;
  /** Pre-computed embedding (optional — will be computed if absent) */
  embedding?: number[];
}

export interface SeedCorpus {
  observations: SeedObservation[];
}

export interface SeedResult {
  observationsInserted: number;
  entitiesExtracted: number;
  vectorsUpserted: number;
  durationMs: number;
}

/**
 * Seed eval data directly into DB + Pinecone.
 * Replicates what the Inngest observation-capture workflow does, but synchronously.
 *
 * Flow:
 * 1. Safety check (namespace prefix, workspace prefix)
 * 2. Create eval workspace record
 * 3. Insert observations into DB
 * 4. Insert entities into DB
 * 5. Generate/load embeddings
 * 6. Upsert vectors to Pinecone (eval namespace)
 */
export async function seedEvalData(
  infra: EvalInfraConfig,
  workspace: EvalWorkspaceConfig,
  corpus: SeedCorpus,
  options?: { embeddingCacheDir?: string },
): Promise<SeedResult> {
  const startTime = Date.now();

  // 1. Safety check
  assertEvalSafety(workspace);

  // 2. Create eval DB client
  const { db, close } = createEvalDbClient(infra);

  try {
    // 3. Ensure workspace record exists
    log.info("Creating eval workspace", { workspaceId: workspace.workspaceId });
    await ensureEvalWorkspace(db, workspace);

    // 4. Insert observations
    log.info("Inserting observations", { count: corpus.observations.length });
    const insertedObs: Array<{ externalId: string; id: number }> = [];

    for (const obs of corpus.observations) {
      const [inserted] = await db
        .insert(workspaceNeuralObservations)
        .values({
          externalId: obs.externalId,
          workspaceId: workspace.workspaceId,
          title: obs.title,
          content: obs.content,
          source: obs.source,
          sourceType: obs.sourceType,
          sourceId: obs.sourceId,
          observationType: obs.observationType,
          occurredAt: obs.occurredAt,
          metadata: obs.metadata,
        } satisfies Omit<InsertWorkspaceNeuralObservation, "id">)
        .onConflictDoNothing()
        .returning({ externalId: workspaceNeuralObservations.externalId, id: workspaceNeuralObservations.id });

      if (inserted) {
        insertedObs.push(inserted);
      }
    }

    // 5. Insert entities
    let entitiesInserted = 0;
    for (const obs of corpus.observations) {
      if (!obs.entities?.length) continue;

      const obsRecord = insertedObs.find((o) => o.externalId === obs.externalId);
      if (!obsRecord) continue;

      for (const entity of obs.entities) {
        await db
          .insert(workspaceNeuralEntities)
          .values({
            workspaceId: workspace.workspaceId,
            category: entity.category as any,
            key: entity.key,
            value: entity.value,
            sourceObservationId: obsRecord.id,
          } satisfies Omit<InsertWorkspaceNeuralEntity, "id">)
          .onConflictDoNothing();
        entitiesInserted++;
      }
    }

    // 6. Generate embeddings
    log.info("Generating embeddings", { count: corpus.observations.length });

    const corpusJson = JSON.stringify(corpus);
    const corpusHash = EmbeddingCache.hashCorpus(corpusJson);
    const cache = new EmbeddingCache(
      options?.embeddingCacheDir ?? "packages/console-eval/cache",
      corpusHash,
    );

    const embedder = createCohereEmbedding({
      apiKey: infra.cohere.apiKey,
      model: workspace.embeddingModel,
      inputType: "search_document",
      dimension: workspace.embeddingDim,
    });

    const vectors: Array<{
      id: string;
      values: number[];
      metadata: Record<string, unknown>;
    }> = [];

    for (const obs of corpus.observations) {
      const text = `${obs.title}\n${obs.content}`;
      let embedding: number[];

      if (obs.embedding) {
        embedding = obs.embedding;
      } else if (cache.has(text)) {
        embedding = cache.get(text)!;
      } else {
        const result = await embedder.embed([text]);
        embedding = result.embeddings[0]!;
        cache.set(text, embedding);
      }

      // Use summary view ID format (matches production multi-view pattern)
      const vectorId = `obs_summary_${obs.externalId}`;

      vectors.push({
        id: vectorId,
        values: embedding,
        metadata: {
          workspaceId: workspace.workspaceId,
          observationId: obs.externalId,
          source: obs.source,
          sourceType: obs.sourceType,
          observationType: obs.observationType,
          layer: "observations",
        },
      });
    }

    cache.save();

    // 7. Upsert vectors to Pinecone
    log.info("Upserting vectors", {
      count: vectors.length,
      index: workspace.indexName,
      namespace: workspace.namespaceName,
    });

    const pinecone = new PineconeClient(infra.pinecone.apiKey);
    await pinecone.upsertVectors(
      workspace.indexName,
      workspace.namespaceName,
      vectors,
    );

    const result: SeedResult = {
      observationsInserted: insertedObs.length,
      entitiesExtracted: entitiesInserted,
      vectorsUpserted: vectors.length,
      durationMs: Date.now() - startTime,
    };

    log.info("Seeding complete", result);
    return result;
  } finally {
    await close();
  }
}
```

#### 5. Create seed CLI
**File**: `packages/console-eval/src/cli/seed.ts` (NEW)
**Changes**: CLI command for `pnpm --filter @repo/console-eval seed`

```typescript
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { loadEvalInfraConfig } from "../config/infra";
import { createDefaultEvalConfig } from "../config/eval-config";
import { seedEvalData, type SeedCorpus } from "../seed/seeder";

const program = new Command();

program
  .name("seed")
  .description("Seed eval infrastructure with test data")
  .requiredOption("--run-id <id>", "Unique run identifier")
  .option("--corpus <path>", "Path to corpus JSON", "packages/console-eval/datasets/eval-corpus.json")
  .option("--cache-dir <dir>", "Embedding cache directory", "packages/console-eval/cache")
  .action(async (opts) => {
    const config = createDefaultEvalConfig({
      runId: opts.runId,
      workspace: {
        workspaceId: `eval_ws_${opts.runId}`,
        indexName: "lightfast-v1",
        namespaceName: `eval:run_${opts.runId}`,
        embeddingModel: "embed-english-v3.0",
        embeddingDim: 1024,
        enableClusters: false,
        enableActors: false,
      },
    });

    console.log(`Seeding eval data for run: ${opts.runId}`);
    console.log(`  Workspace: ${config.workspace.workspaceId}`);
    console.log(`  Namespace: ${config.workspace.namespaceName}`);

    // Load corpus
    const corpusJson = readFileSync(opts.corpus, "utf-8");
    const corpus: SeedCorpus = JSON.parse(corpusJson);
    console.log(`  Observations: ${corpus.observations.length}`);

    // Seed
    const result = await seedEvalData(config.infra, config.workspace, corpus, {
      embeddingCacheDir: opts.cacheDir,
    });

    console.log("\nSeed complete:");
    console.log(`  Observations inserted: ${result.observationsInserted}`);
    console.log(`  Entities extracted: ${result.entitiesExtracted}`);
    console.log(`  Vectors upserted: ${result.vectorsUpserted}`);
    console.log(`  Duration: ${result.durationMs}ms`);
  });

program.parse();
```

#### 6. Create cleanup utility
**File**: `packages/console-eval/src/seed/cleanup.ts` (NEW)
**Changes**: Delete eval namespace and workspace data after runs

```typescript
import { eq, and, like } from "drizzle-orm";
import { orgWorkspaces, workspaceNeuralObservations, workspaceNeuralEntities } from "@db/console/schema";
import { PineconeClient } from "@vendor/pinecone";
import { log } from "@vendor/observability/log";
import type { EvalInfraConfig, EvalWorkspaceConfig } from "../context/eval-context";
import { assertEvalSafety } from "../context/eval-context";
import { createEvalDbClient } from "./db";

/**
 * Clean up eval infrastructure after a run.
 * Deletes Pinecone eval namespace and DB records.
 */
export async function cleanupEvalData(
  infra: EvalInfraConfig,
  workspace: EvalWorkspaceConfig,
): Promise<void> {
  assertEvalSafety(workspace);

  // 1. Delete Pinecone namespace
  log.info("Deleting Pinecone namespace", {
    index: workspace.indexName,
    namespace: workspace.namespaceName,
  });
  const pinecone = new PineconeClient(infra.pinecone.apiKey);
  await pinecone.deleteNamespace(workspace.indexName, workspace.namespaceName);

  // 2. Delete DB records
  const { db, close } = createEvalDbClient(infra);
  try {
    log.info("Deleting eval DB records", { workspaceId: workspace.workspaceId });

    // Delete entities first (FK to observations)
    await db
      .delete(workspaceNeuralEntities)
      .where(eq(workspaceNeuralEntities.workspaceId, workspace.workspaceId));

    // Delete observations
    await db
      .delete(workspaceNeuralObservations)
      .where(eq(workspaceNeuralObservations.workspaceId, workspace.workspaceId));

    // Delete workspace record
    await db
      .delete(orgWorkspaces)
      .where(eq(orgWorkspaces.id, workspace.workspaceId));

    log.info("Cleanup complete", { workspaceId: workspace.workspaceId });
  } finally {
    await close();
  }
}
```

#### 7. Create cleanup CLI
**File**: `packages/console-eval/src/cli/cleanup.ts` (NEW)
**Changes**: CLI command for `pnpm --filter @repo/console-eval cleanup`

```typescript
import { Command } from "commander";
import { loadEvalInfraConfig } from "../config/infra";
import { cleanupEvalData } from "../seed/cleanup";

const program = new Command();

program
  .name("cleanup")
  .description("Clean up eval infrastructure (Pinecone namespace + DB records)")
  .requiredOption("--run-id <id>", "Run identifier to clean up")
  .action(async (opts) => {
    const infra = loadEvalInfraConfig();
    const workspace = {
      workspaceId: `eval_ws_${opts.runId}`,
      indexName: "lightfast-v1",
      namespaceName: `eval:run_${opts.runId}`,
      embeddingModel: "embed-english-v3.0",
      embeddingDim: 1024,
      enableClusters: false,
      enableActors: false,
    };

    console.log(`Cleaning up eval run: ${opts.runId}`);
    console.log(`  Workspace: ${workspace.workspaceId}`);
    console.log(`  Namespace: ${workspace.namespaceName}`);

    await cleanupEvalData(infra, workspace);
    console.log("Cleanup complete.");
  });

program.parse();
```

#### 8. Add scripts to package.json
**File**: `packages/console-eval/package.json`
**Changes**: Add seed and cleanup scripts

```jsonc
// Add to "scripts":
"seed": "pnpm with-env tsx src/cli/seed.ts",
"cleanup": "pnpm with-env tsx src/cli/cleanup.ts"
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @repo/console-eval typecheck` passes
- [x] `pnpm --filter @repo/console-eval build` passes
- [x] `pnpm typecheck` passes (full repo — only pre-existing @lightfastai/ai-sdk failure)
- [x] `pnpm --filter @repo/console-eval seed --help` prints usage
- [x] `pnpm --filter @repo/console-eval cleanup --help` prints usage

#### Manual Verification:
- [ ] `createEvalDbClient()` connects to eval branch (requires EVAL_* env vars)
- [ ] `ensureEvalWorkspace()` creates workspace record with correct settings
- [ ] `seedEvalData()` inserts observations, entities, and vectors into isolated namespace
- [ ] `EmbeddingCache` correctly caches and restores embeddings across runs
- [ ] Safety guards reject non-prefixed namespace/workspace IDs
- [ ] `cleanupEvalData()` removes all eval artifacts

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that seeding works end-to-end before proceeding to Phase 3.

---

## Phase 3: In-Process Runner

### Overview
Replace HTTP search with direct function invocation. The eval process configures environment variables BEFORE importing `@repo/console-search`, then calls `searchLogic()` directly. This eliminates HTTP overhead (~190ms per case) and the dependency on a running server.

### Changes Required:

#### 1. Create environment configuration + dynamic import entry point
**File**: `packages/console-eval/src/runner/entry.ts` (NEW)
**Changes**: Configure process.env before any module-level singleton initialization

```typescript
import type { EvalInfraConfig } from "../context/eval-context";

/**
 * Configure the process environment for eval execution.
 * MUST be called before importing @repo/console-search or any pipeline module.
 *
 * The db singleton in @db/console/client reads env vars at import time:
 *   postgresql://{DATABASE_USERNAME}:{DATABASE_PASSWORD}@{DATABASE_HOST}:6432/postgres?sslmode=verify-full
 *
 * This function maps EVAL_* credentials to the runtime env vars that singletons read.
 */
export function configureEvalEnvironment(infra: EvalInfraConfig): void {
  // Database — points postgres-js singleton to eval branch
  process.env.DATABASE_HOST = infra.db.host;
  process.env.DATABASE_USERNAME = infra.db.username;
  process.env.DATABASE_PASSWORD = infra.db.password;

  // Pinecone — same API key, namespace isolation is per-call
  process.env.PINECONE_API_KEY = infra.pinecone.apiKey;

  // Cohere — embeddings and reranking
  process.env.COHERE_API_KEY = infra.cohere.apiKey;

  // Braintrust — optional
  if (infra.braintrust?.apiKey) {
    process.env.BRAINTRUST_API_KEY = infra.braintrust.apiKey;
  }

  // Skip env validation (we've set everything explicitly)
  process.env.SKIP_ENV_VALIDATION = "true";
}

/**
 * Dynamically import and create eval search function.
 * Uses dynamic import to ensure env vars are set before singletons initialize.
 */
export async function createEvalSearchFn(workspaceId: string) {
  // Dynamic import — singletons created NOW with eval env vars
  const { searchLogic } = await import("@repo/console-search");
  type V1AuthContext = import("@repo/console-search").V1AuthContext;

  const evalAuth: V1AuthContext = {
    workspaceId,
    userId: "eval-runner",
    authType: "api-key",
  };

  return async function evalSearch(
    query: string,
    mode: "fast" | "balanced" | "thorough" = "balanced",
    limit: number = 10,
  ) {
    return searchLogic(evalAuth, {
      query,
      limit,
      offset: 0,
      mode,
      includeContext: false,
      includeHighlights: false,
      requestId: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
    // Note: no onActivity callback — activity recording skipped in eval
  };
}
```

#### 2. Create in-process eval runner
**File**: `packages/console-eval/src/runner/in-process.ts` (NEW)
**Changes**: Eval runner using direct function call instead of HTTP

```typescript
import { Eval, initLogger } from "@vendor/braintrust";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { log } from "@vendor/observability/log";
import type { EvalConfig } from "../config/eval-config";
import type { EvalRunResult } from "../eval/runner";
import { assertEvalSafety } from "../context/eval-context";
import { configureEvalEnvironment, createEvalSearchFn } from "./entry";
import { validateDataset } from "../datasets/schema";
import { computeRetrievalMetrics, type RetrievalMetrics } from "../metrics/retrieval";

/**
 * Run evaluation in-process using direct searchLogic() invocation.
 *
 * Call chain:
 *   configureEvalEnvironment(infra)     → Set env vars before singleton init
 *   createEvalSearchFn(workspaceId)     → Dynamic import of @repo/console-search
 *   Eval(project, {                     → Braintrust in-process
 *     task: evalSearch(query, mode)     → Direct function call (no HTTP)
 *       → searchLogic(auth, input)      → Same production code
 *         → fourPathParallelSearch()    → Uses db/pinecone singletons with eval data
 *   })
 */
export async function runEvalInProcess(config: EvalConfig): Promise<EvalRunResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  // 1. Safety check
  assertEvalSafety(config.workspace);

  // 2. Configure environment BEFORE any pipeline imports
  log.info("Configuring eval environment", {
    runId: config.runId,
    workspaceId: config.workspace.workspaceId,
    namespace: config.workspace.namespaceName,
  });
  configureEvalEnvironment(config.infra);

  // 3. Create eval search function (dynamic import)
  const evalSearch = await createEvalSearchFn(config.workspace.workspaceId);

  // 4. Load dataset
  console.log(`Loading dataset: ${config.dataset.casesPath}`);
  const raw = readFileSync(config.dataset.casesPath, "utf-8");
  const dataset = validateDataset(JSON.parse(raw));
  console.log(`Loaded ${dataset.cases.length} eval cases`);

  // 5. Initialize Braintrust
  if (config.braintrust.sendLogs && config.infra.braintrust?.apiKey) {
    initLogger({
      apiKey: config.infra.braintrust.apiKey,
      projectName: config.braintrust.project,
    });
  }

  // 6. Run eval
  console.log(`Running in-process eval with ${config.execution.searchMode} mode`);

  const perCaseResults: Array<{
    caseId: string;
    metrics: RetrievalMetrics;
    latencyMs: number;
  }> = [];

  await Eval(config.braintrust.project, {
    experimentName: config.braintrust.experiment,
    data: dataset.cases.map((c) => ({
      input: {
        query: c.query,
        mode: config.execution.searchMode,
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
    task: async (input: { query: string; mode: string }) => {
      const caseStartTime = Date.now();

      // Direct function call — no HTTP, no auth middleware, no JSON serialization
      const response = await evalSearch(
        input.query,
        input.mode as "fast" | "balanced" | "thorough",
        10,
      );

      const latencyMs = Date.now() - caseStartTime;

      return {
        results: response.data.map((r, i) => ({
          id: r.id,
          score: r.score ?? 0,
          rank: i + 1,
        })),
        latencyMs,
        searchLatency: response.latency,
      };
    },
    scores: [
      async (args: any) => {
        const relevant = new Set(args.expected.observationIds as string[]);
        const metrics = computeRetrievalMetrics(
          args.output.results,
          relevant,
          config.execution.kValues,
          args.expected.gradedRelevance,
        );

        perCaseResults.push({
          caseId: args.metadata.caseId,
          metrics,
          latencyMs: args.output.latencyMs,
        });

        return {
          name: "mrr",
          score: metrics.mrr,
        };
      },
    ],
    maxConcurrency: config.execution.maxConcurrency,
    timeout: config.execution.timeout,
  });

  // 7. Compute aggregate metrics
  const n = perCaseResults.length;
  const avg = (fn: (r: (typeof perCaseResults)[0]) => number) =>
    n > 0 ? perCaseResults.reduce((sum, r) => sum + fn(r), 0) / n : 0;

  const aggregateMetrics: RetrievalMetrics = {
    mrr: avg((r) => r.metrics.mrr),
    recallAtK: Object.fromEntries(
      config.execution.kValues.map((k) => [k, avg((r) => r.metrics.recallAtK[k] ?? 0)]),
    ),
    precisionAtK: Object.fromEntries(
      config.execution.kValues.map((k) => [k, avg((r) => r.metrics.precisionAtK[k] ?? 0)]),
    ),
    ndcgAtK: Object.fromEntries(
      config.execution.kValues.map((k) => [k, avg((r) => r.metrics.ndcgAtK[k] ?? 0)]),
    ),
    totalRelevant: avg((r) => r.metrics.totalRelevant),
    totalRetrieved: avg((r) => r.metrics.totalRetrieved),
  };

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  const result: EvalRunResult = {
    config: {
      datasetPath: config.dataset.casesPath,
      tier: "retrieval",
      searchMode: config.execution.searchMode,
      maxConcurrency: config.execution.maxConcurrency,
      braintrustProject: config.braintrust.project,
      experimentName: config.braintrust.experiment,
    },
    aggregateMetrics,
    perCase: perCaseResults,
    braintrustExperimentUrl: config.braintrust.sendLogs
      ? `https://www.braintrust.dev/app/${config.braintrust.project}/${config.braintrust.experiment}`
      : "local-only",
    startedAt,
    completedAt,
    durationMs,
  };

  // 8. Save result
  const resultPath = join(process.cwd(), `eval-result-${config.runId}.json`);
  writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`\nResult saved to: ${resultPath}`);

  // 9. Print summary
  console.log("\nAggregate Metrics:");
  console.log(`  MRR: ${aggregateMetrics.mrr.toFixed(4)}`);
  for (const k of config.execution.kValues) {
    console.log(`  Recall@${k}: ${(aggregateMetrics.recallAtK[k] ?? 0).toFixed(4)}`);
    console.log(`  Precision@${k}: ${(aggregateMetrics.precisionAtK[k] ?? 0).toFixed(4)}`);
    console.log(`  NDCG@${k}: ${(aggregateMetrics.ndcgAtK[k] ?? 0).toFixed(4)}`);
  }
  console.log(`  Duration: ${durationMs}ms (${(durationMs / dataset.cases.length).toFixed(0)}ms/case)`);

  return result;
}
```

#### 3. Create local eval CLI
**File**: `packages/console-eval/src/cli/run-local.ts` (NEW)
**Changes**: CLI entry point for in-process eval

```typescript
import { Command } from "commander";
import { createDefaultEvalConfig } from "../config/eval-config";
import { runEvalInProcess } from "../runner/in-process";

const program = new Command();

program
  .name("eval-local")
  .description("Run evaluation in-process using direct searchLogic() invocation")
  .requiredOption("--run-id <id>", "Unique run identifier (must match seeded data)")
  .option("--dataset <path>", "Path to dataset JSON", "packages/console-eval/datasets/eval-dataset.json")
  .option("-m, --mode <mode>", "Search mode", "balanced")
  .option("-c, --concurrency <n>", "Max concurrency", "4")
  .option("--k-values <values>", "K values for @K metrics (comma-separated)", "3,5,10")
  .action(async (opts) => {
    const kValues = opts.kValues.split(",").map(Number);

    const config = createDefaultEvalConfig({
      runId: opts.runId,
      workspace: {
        workspaceId: `eval_ws_${opts.runId}`,
        indexName: "lightfast-v1",
        namespaceName: `eval:run_${opts.runId}`,
        embeddingModel: "embed-english-v3.0",
        embeddingDim: 1024,
        enableClusters: false,
        enableActors: false,
      },
      execution: {
        searchMode: opts.mode,
        maxConcurrency: parseInt(opts.concurrency, 10),
        timeout: 30_000,
        kValues,
      },
      dataset: {
        casesPath: opts.dataset,
        corpusPath: "packages/console-eval/datasets/eval-corpus.json",
        embeddingCachePath: "packages/console-eval/cache/",
      },
    });

    console.log(`Running in-process eval for run: ${opts.runId}`);
    console.log(`  Workspace: ${config.workspace.workspaceId}`);
    console.log(`  Namespace: ${config.workspace.namespaceName}`);
    console.log(`  Mode: ${config.execution.searchMode}`);
    console.log(`  Dataset: ${config.dataset.casesPath}`);

    await runEvalInProcess(config);
  });

program.parse();
```

#### 4. Add eval:local script to package.json
**File**: `packages/console-eval/package.json`
**Changes**: Add eval:local script

```jsonc
// Add to "scripts":
"eval:local": "pnpm with-env tsx src/cli/run-local.ts"
```

#### 5. Update src/index.ts with runner exports
**File**: `packages/console-eval/src/index.ts`
**Changes**: Export in-process runner and seeder

```typescript
// In-process runner
export { runEvalInProcess } from "./runner/in-process";

// Data seeding
export type { SeedObservation, SeedCorpus, SeedResult } from "./seed/seeder";
export { seedEvalData } from "./seed/seeder";
export { cleanupEvalData } from "./seed/cleanup";
```

#### 6. Add export paths to package.json
**File**: `packages/console-eval/package.json`
**Changes**: Add export paths for runner and seed modules

```jsonc
// Add to "exports":
"./runner": "./src/runner/in-process.ts",
"./seed": "./src/seed/seeder.ts"
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @repo/console-eval typecheck` passes
- [x] `pnpm --filter @repo/console-eval build` passes
- [x] `pnpm typecheck` passes (full repo — only pre-existing @lightfastai/ai-sdk failure)
- [x] `pnpm build:console` passes (console app unchanged)
- [x] `pnpm --filter @repo/console-eval eval:local --help` prints usage

#### Manual Verification:
- [ ] `configureEvalEnvironment()` sets correct env vars before singleton init
- [ ] `createEvalSearchFn()` successfully imports and wraps searchLogic
- [ ] `runEvalInProcess()` executes full eval pipeline against seeded data
- [ ] Results match expected format (EvalRunResult with per-case metrics)
- [ ] No HTTP calls made during in-process execution (all calls are in-process)
- [ ] Existing `runEval()` (HTTP runner) continues to work unchanged
- [ ] Result JSON file written to expected path

**Implementation Note**: After completing this phase, run a full end-to-end test: seed → eval:local → compare.

---

## Testing Strategy

### Unit Tests:
- `assertEvalSafety()` — rejects invalid prefixes, accepts valid ones
- `EmbeddingCache` — cache/restore round-trip, handles corrupted cache
- `createDefaultEvalConfig()` — produces expected defaults
- `loadEvalInfraConfig()` — maps env vars correctly

### Integration Tests (require eval infrastructure):
- Seed → read back observations from DB
- Seed → query Pinecone eval namespace → get vectors
- Full cycle: seed → eval:local → compare

### Manual Testing Steps:
1. Set up PlanetScale eval branch manually
2. Set EVAL_* env vars in `.env.development.local`
3. Run `pnpm --filter @repo/console-eval seed --run-id test-001`
4. Verify workspace record in DB studio
5. Run `pnpm --filter @repo/console-eval eval:local --run-id test-001 --dataset <path>`
6. Verify result JSON file
7. Run `pnpm --filter @repo/console-eval cleanup --run-id test-001`
8. Verify namespace and DB records are gone

## Performance Considerations

### In-Process vs HTTP Savings (per case):
| Component | HTTP Path | In-Process | Savings |
|-----------|-----------|------------|---------|
| HTTP overhead | ~50ms | 0ms | 50ms |
| TLS handshake | ~100ms | 0ms | 100ms |
| Auth middleware | ~20ms | 0ms | 20ms |
| JSON serialization | ~15ms | 0ms | 15ms |
| searchLogic() | ~800ms | ~800ms | 0ms |
| **Total per case** | **~985ms** | **~800ms** | **~185ms** |

For 26-case eval: ~5s saved + no running server required.

## Migration Notes

- Both `runEval()` (HTTP) and `runEvalInProcess()` (in-process) coexist
- `eval:local` script uses in-process runner; `run` script uses HTTP runner
- No existing code is modified (all changes are additive)
- Phase 5 (not in scope) will deprecate HTTP runner

## File Summary

### New Files (13):
| File | Purpose |
|------|---------|
| `src/env.ts` | Type-safe EVAL_* env validation |
| `src/context/eval-context.ts` | EvalContext, EvalInfraConfig, safety guards |
| `src/config/infra.ts` | Infrastructure config loader |
| `src/config/eval-config.ts` | Full eval config with defaults |
| `src/seed/db.ts` | Eval DB client (postgres-js, max:5) |
| `src/seed/workspace-setup.ts` | Create eval workspace record |
| `src/seed/seeder.ts` | Direct DB + Pinecone seeder |
| `src/seed/embedding-cache.ts` | Pre-computed embedding cache |
| `src/seed/cleanup.ts` | Teardown eval artifacts |
| `src/runner/entry.ts` | Env config + dynamic import |
| `src/runner/in-process.ts` | In-process eval runner |
| `src/cli/seed.ts` | Seed CLI |
| `src/cli/run-local.ts` | Local eval CLI |
| `src/cli/cleanup.ts` | Cleanup CLI |

### Modified Files (2):
| File | Changes |
|------|---------|
| `package.json` | Dependencies, scripts, exports |
| `src/index.ts` | New re-exports |

### Unchanged:
All existing eval, metrics, generation, comparison, and HTTP client code.

## References

- Architecture design: `thoughts/shared/research/2026-02-07-eval-self-contained-architecture-design.md`
- Phase 0 plan: `thoughts/shared/plans/2026-02-07-console-search-extraction-phase0.md`
- Phase 0 commit: `4249298c` (refactor: extract neural search pipeline into @repo/console-search)
- DB client pattern: `db/console/src/client.ts:9-26`
- Env pattern: `vendor/braintrust/src/env.ts:1-11`
- Search function: `packages/console-search/src/search.ts:41-208`
- Workspace config: `packages/console-workspace-cache/src/config.ts:27-67`
