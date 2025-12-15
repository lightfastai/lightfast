# Console Rerank Package Implementation Plan

## Overview

Create `packages/console-rerank/` - a console-specific reranking package that implements a `RerankProvider` interface with three providers (Cohere, LLM, Passthrough) and a mode-based factory function for quality tier selection (fast/balanced/thorough).

This package refactors the existing `llmRelevanceFilter()` from `apps/console/src/lib/neural/llm-filter.ts` into a reusable provider pattern following the established `@vendor/embed` architecture.

## Current State Analysis

### Existing Implementation
- **LLM Filter**: `apps/console/src/lib/neural/llm-filter.ts` contains a working LLM-based relevance scorer using Claude Haiku 4.5 via Vercel AI Gateway
- **Cohere SDK**: `vendor/embed/src/provider/cohere.ts` shows the pattern for Cohere client initialization (uses `cohere-ai` SDK v7.19.0)
- **Package Pattern**: `packages/console-pinecone/` demonstrates the standard console package structure

### Key Patterns Identified
1. **Provider Interface**: `vendor/embed/src/types.ts:54-67` - `EmbeddingProvider` with readonly properties and async method
2. **Factory Function**: `vendor/embed/src/provider/cohere.ts:158-162` - Simple wrapper around constructor
3. **Error Handling**: Catch-wrap-rethrow with context prefix
4. **Configuration**: `packages/console-config/src/private-config.ts` - `as const` with `satisfies` for type safety
5. **Environment Variables**: `vendor/embed/src/env.ts` - T3 env with Zod validation

### Relevant Code References:
| Component | File | Lines |
|-----------|------|-------|
| LLM Filter | `apps/console/src/lib/neural/llm-filter.ts` | 1-193 |
| Cohere Provider | `vendor/embed/src/provider/cohere.ts` | 1-162 |
| Embed Types | `vendor/embed/src/types.ts` | 1-67 |
| Private Config | `packages/console-config/src/private-config.ts` | 1-309 |
| Package Pattern | `packages/console-pinecone/package.json` | 1-37 |

## Desired End State

After implementation:
1. A new `packages/console-rerank/` package exists with three providers
2. `@repo/console-rerank` is importable with typed `RerankProvider` interface
3. Factory function `createRerankProvider(mode)` returns appropriate provider based on mode
4. Existing `llmRelevanceFilter()` is refactored to use `LLMRerankProvider`
5. Configuration constants added to `@repo/console-config`
6. Package builds successfully and types are exported

### Verification Criteria
- `pnpm --filter @repo/console-rerank build` succeeds
- `pnpm --filter @repo/console-rerank typecheck` passes
- `pnpm lint` passes for new package
- Package is importable from other console packages

## What We're NOT Doing

- **NOT** creating a vendor package (`vendor/rerank/`) - this is console-specific
- **NOT** implementing chained providers (Cohere + LLM combined) - will be Phase 2
- **NOT** modifying existing search route integration - just creating the package
- **NOT** adding environment variable validation with T3 env - reuses existing `COHERE_API_KEY` from `@vendor/embed/env`
- **NOT** writing tests - separate task after package creation

## Implementation Approach

Follow the established `@repo/console-pinecone` and `@vendor/embed` patterns:
1. Create package scaffolding with standard configuration
2. Define types mirroring the embedding provider pattern
3. Implement three providers (Passthrough → Cohere → LLM complexity order)
4. Create factory function for mode-based selection
5. Add RERANK_CONFIG to private-config.ts
6. Wire up exports in index.ts

---

## Phase 1: Package Scaffolding

### Overview
Create the package directory structure and configuration files following monorepo standards.

### Changes Required:

#### 1. Create package.json
**File**: `packages/console-rerank/package.json`

```json
{
  "name": "@repo/console-rerank",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./src/index.ts"
    }
  },
  "license": "MIT",
  "scripts": {
    "build": "tsup",
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "dev": "tsup --watch",
    "format": "prettier --check . --ignore-path ../../.gitignore",
    "lint": "eslint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "ai": "catalog:",
    "@ai-sdk/gateway": "catalog:",
    "cohere-ai": "^7.19.0",
    "zod": "catalog:",
    "@repo/console-config": "workspace:*",
    "@vendor/embed": "workspace:*",
    "@vendor/observability": "workspace:*"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/prettier-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "eslint": "catalog:",
    "prettier": "catalog:",
    "tsup": "^8.5.0",
    "typescript": "catalog:"
  },
  "prettier": "@repo/prettier-config"
}
```

#### 2. Create tsconfig.json
**File**: `packages/console-rerank/tsconfig.json`

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

#### 3. Create tsup.config.ts
**File**: `packages/console-rerank/tsup.config.ts`

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
```

#### 4. Create directory structure
```
packages/console-rerank/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts
    ├── types.ts
    ├── factory.ts
    └── providers/
        ├── cohere.ts
        ├── llm.ts
        └── passthrough.ts
```

### Success Criteria:

#### Automated Verification:
- [x] Directory structure created: `ls packages/console-rerank/src/providers/`
- [x] Package.json valid: `cd packages/console-rerank && cat package.json | jq .`

---

## Phase 2: Type Definitions

### Overview
Define the `RerankProvider` interface and related types following the `EmbeddingProvider` pattern from `vendor/embed/src/types.ts`.

### Changes Required:

#### 1. Create src/types.ts
**File**: `packages/console-rerank/src/types.ts`

```typescript
/**
 * Type definitions for rerank providers
 *
 * Follows the EmbeddingProvider pattern from @vendor/embed.
 */

/**
 * Input candidate for reranking
 *
 * Mirrors FilterCandidate from llm-filter.ts with additional fields.
 */
export interface RerankCandidate {
  /**
   * Unique identifier for the candidate
   */
  id: string;

  /**
   * Title of the document/observation
   */
  title: string;

  /**
   * Text content to use for relevance scoring
   */
  content: string;

  /**
   * Original vector similarity score (0-1)
   */
  score: number;
}

/**
 * Reranked result with scores
 */
export interface RerankResult {
  /**
   * Candidate identifier
   */
  id: string;

  /**
   * Final reranked score (0-1)
   */
  score: number;

  /**
   * Provider-specific relevance score (0-1)
   */
  relevance: number;

  /**
   * Original vector score preserved
   */
  originalScore: number;
}

/**
 * Response from rerank operation
 */
export interface RerankResponse {
  /**
   * Reranked results sorted by score descending
   */
  results: RerankResult[];

  /**
   * Time taken for reranking in milliseconds
   */
  latency: number;

  /**
   * Provider name that performed the reranking
   */
  provider: string;

  /**
   * Number of candidates filtered out
   */
  filtered: number;

  /**
   * Whether reranking was bypassed (e.g., small result set)
   */
  bypassed: boolean;
}

/**
 * Options for rerank operation
 */
export interface RerankOptions {
  /**
   * Maximum number of results to return
   */
  topK?: number;

  /**
   * Minimum relevance threshold to include result
   * @default 0.4
   */
  threshold?: number;

  /**
   * Request ID for logging/tracing
   */
  requestId?: string;
}

/**
 * Interface for rerank providers
 *
 * All rerank providers must implement this interface to ensure
 * consistent behavior across different reranking strategies.
 */
export interface RerankProvider {
  /**
   * Name of the provider (e.g., "cohere", "llm", "passthrough")
   */
  readonly name: string;

  /**
   * Rerank candidates based on query relevance
   *
   * @param query - The user's search query
   * @param candidates - Array of candidates to rerank
   * @param options - Optional configuration
   * @returns Promise resolving to rerank response
   */
  rerank(
    query: string,
    candidates: RerankCandidate[],
    options?: RerankOptions,
  ): Promise<RerankResponse>;
}

/**
 * Rerank mode for quality tier selection
 *
 * - fast: No reranking, use vector scores only (passthrough)
 * - balanced: Cohere rerank API for efficient reranking
 * - thorough: LLM-based semantic scoring for highest quality
 */
export type RerankMode = "fast" | "balanced" | "thorough";
```

### Success Criteria:

#### Automated Verification:
- [x] File created: `cat packages/console-rerank/src/types.ts | head -20`
- [x] TypeScript valid: `cd packages/console-rerank && pnpm typecheck`

---

## Phase 3: Passthrough Provider

### Overview
Implement the simplest provider that returns candidates unchanged, sorted by vector score. Used for "fast" mode.

### Changes Required:

#### 1. Create src/providers/passthrough.ts
**File**: `packages/console-rerank/src/providers/passthrough.ts`

```typescript
/**
 * Passthrough rerank provider
 *
 * No-op provider that returns candidates sorted by original vector score.
 * Used for "fast" mode when reranking overhead is not desired.
 */

import type {
  RerankProvider,
  RerankCandidate,
  RerankResponse,
  RerankOptions,
} from "../types";

/**
 * Passthrough rerank provider
 *
 * Simply returns candidates sorted by their original vector score.
 * Useful when:
 * - Speed is critical
 * - Vector search is already high quality
 * - Testing/debugging without rerank overhead
 */
export class PassthroughRerankProvider implements RerankProvider {
  readonly name = "passthrough";

  async rerank(
    _query: string,
    candidates: RerankCandidate[],
    options?: RerankOptions,
  ): Promise<RerankResponse> {
    const threshold = options?.threshold ?? 0;
    const topK = options?.topK ?? candidates.length;

    // Map to results format, preserving vector scores
    const results = candidates
      .map((c) => ({
        id: c.id,
        score: c.score,
        relevance: c.score, // Use vector score as relevance
        originalScore: c.score,
      }))
      .filter((r) => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return {
      results,
      latency: 0,
      provider: this.name,
      filtered: candidates.length - results.length,
      bypassed: true,
    };
  }
}

/**
 * Create a passthrough rerank provider
 */
export function createPassthroughRerankProvider(): PassthroughRerankProvider {
  return new PassthroughRerankProvider();
}
```

### Success Criteria:

#### Automated Verification:
- [x] File created: `ls packages/console-rerank/src/providers/passthrough.ts`
- [x] TypeScript valid: `cd packages/console-rerank && pnpm typecheck`

---

## Phase 4: Cohere Provider

### Overview
Implement Cohere rerank API integration for "balanced" mode, following the pattern from `vendor/embed/src/provider/cohere.ts`.

### Changes Required:

#### 1. Create src/providers/cohere.ts
**File**: `packages/console-rerank/src/providers/cohere.ts`

```typescript
/**
 * Cohere rerank provider
 *
 * Uses Cohere's rerank API for efficient semantic reranking.
 * Optimized for production use with configurable model and threshold.
 *
 * @see https://docs.cohere.com/docs/rerank-2
 */

import { CohereClient } from "cohere-ai";
import { log } from "@vendor/observability/log";
import type {
  RerankProvider,
  RerankCandidate,
  RerankResponse,
  RerankOptions,
} from "../types";

/**
 * Cohere rerank configuration
 */
export interface CohereRerankConfig {
  /**
   * Cohere API key
   * If not provided, uses COHERE_API_KEY from environment
   */
  apiKey?: string;

  /**
   * Rerank model to use
   * @default "rerank-v3.5"
   */
  model?: string;

  /**
   * Default relevance threshold
   * @default 0.4
   */
  threshold?: number;
}

/**
 * Cohere rerank provider
 *
 * Uses Cohere's production rerank API for high-quality semantic reranking.
 *
 * Features:
 * - Fast inference (~100-200ms for 100 candidates)
 * - Configurable relevance threshold
 * - Automatic score normalization
 */
export class CohereRerankProvider implements RerankProvider {
  readonly name = "cohere";
  private readonly client: CohereClient;
  private readonly model: string;
  private readonly defaultThreshold: number;

  constructor(config?: CohereRerankConfig) {
    const apiKey = config?.apiKey ?? process.env.COHERE_API_KEY;
    if (!apiKey) {
      throw new Error("Cohere API key is required");
    }

    this.client = new CohereClient({
      token: apiKey,
    });
    this.model = config?.model ?? "rerank-v3.5";
    this.defaultThreshold = config?.threshold ?? 0.4;
  }

  async rerank(
    query: string,
    candidates: RerankCandidate[],
    options?: RerankOptions,
  ): Promise<RerankResponse> {
    const threshold = options?.threshold ?? this.defaultThreshold;
    const topK = options?.topK ?? candidates.length;
    const requestId = options?.requestId ?? "unknown";

    if (candidates.length === 0) {
      return {
        results: [],
        latency: 0,
        provider: this.name,
        filtered: 0,
        bypassed: true,
      };
    }

    const startTime = Date.now();

    try {
      // Prepare documents for Cohere API
      const documents = candidates.map((c) => ({
        text: `${c.title}: ${c.content}`,
      }));

      const response = await this.client.rerank({
        model: this.model,
        query,
        documents,
        topN: candidates.length, // Get all scores, filter ourselves
        returnDocuments: false,
      });

      const latency = Date.now() - startTime;

      log.info("Cohere rerank complete", {
        requestId,
        latency,
        candidateCount: candidates.length,
        resultsReturned: response.results.length,
      });

      // Build score map from Cohere results
      const scoreMap = new Map(
        response.results.map((r) => [r.index, r.relevanceScore]),
      );

      // Map to results format with scores
      const results = candidates
        .map((c, index) => {
          const relevance = scoreMap.get(index) ?? 0;
          return {
            id: c.id,
            score: relevance, // Use Cohere relevance as final score
            relevance,
            originalScore: c.score,
          };
        })
        .filter((r) => r.relevance >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return {
        results,
        latency,
        provider: this.name,
        filtered: candidates.length - results.length,
        bypassed: false,
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      log.error("Cohere rerank failed, falling back to vector scores", {
        requestId,
        error,
        latency,
      });

      // Fallback: return candidates sorted by original score
      const results = candidates
        .map((c) => ({
          id: c.id,
          score: c.score,
          relevance: c.score,
          originalScore: c.score,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return {
        results,
        latency,
        provider: this.name,
        filtered: 0,
        bypassed: true,
      };
    }
  }
}

/**
 * Create a Cohere rerank provider
 */
export function createCohereRerankProvider(
  config?: CohereRerankConfig,
): CohereRerankProvider {
  return new CohereRerankProvider(config);
}
```

### Success Criteria:

#### Automated Verification:
- [x] File created: `ls packages/console-rerank/src/providers/cohere.ts`
- [x] TypeScript valid: `cd packages/console-rerank && pnpm typecheck`

---

## Phase 5: LLM Provider

### Overview
Implement LLM-based reranking for "thorough" mode, refactoring logic from `apps/console/src/lib/neural/llm-filter.ts`.

### Changes Required:

#### 1. Create src/providers/llm.ts
**File**: `packages/console-rerank/src/providers/llm.ts`

```typescript
/**
 * LLM rerank provider
 *
 * Uses Claude Haiku 4.5 via Vercel AI Gateway for semantic relevance scoring.
 * Highest quality reranking with customizable score weighting.
 *
 * Refactored from apps/console/src/lib/neural/llm-filter.ts
 */

import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { log } from "@vendor/observability/log";
import type {
  RerankProvider,
  RerankCandidate,
  RerankResponse,
  RerankOptions,
} from "../types";

/**
 * LLM relevance score schema
 */
const relevanceScoreSchema = z.object({
  scores: z.array(
    z.object({
      id: z.string().describe("The candidate ID"),
      relevance: z
        .number()
        .min(0)
        .max(1)
        .describe(
          "Relevance score from 0.0 (irrelevant) to 1.0 (highly relevant)",
        ),
    }),
  ),
});

/**
 * LLM rerank configuration
 */
export interface LLMRerankConfig {
  /**
   * Model to use via AI Gateway
   * @default "anthropic/claude-haiku-4.5"
   */
  model?: string;

  /**
   * Weight for LLM score in final calculation
   * @default 0.6
   */
  llmWeight?: number;

  /**
   * Weight for vector score in final calculation
   * @default 0.4
   */
  vectorWeight?: number;

  /**
   * Minimum relevance threshold to include result
   * @default 0.4
   */
  threshold?: number;

  /**
   * Skip LLM if candidate count is <= this value
   * @default 5
   */
  bypassThreshold?: number;
}

/**
 * Default LLM rerank options
 */
const DEFAULT_CONFIG: Required<LLMRerankConfig> = {
  model: "anthropic/claude-haiku-4.5",
  llmWeight: 0.6,
  vectorWeight: 0.4,
  threshold: 0.4,
  bypassThreshold: 5,
};

/**
 * LLM rerank provider
 *
 * Uses structured output from Claude Haiku for semantic relevance scoring.
 * Combines LLM relevance with vector similarity for final ranking.
 *
 * Features:
 * - Semantic understanding of query intent
 * - Configurable score weighting (LLM vs vector)
 * - Automatic bypass for small result sets
 * - Graceful fallback on errors
 */
export class LLMRerankProvider implements RerankProvider {
  readonly name = "llm";
  private readonly config: Required<LLMRerankConfig>;

  constructor(config?: LLMRerankConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async rerank(
    query: string,
    candidates: RerankCandidate[],
    options?: RerankOptions,
  ): Promise<RerankResponse> {
    const threshold = options?.threshold ?? this.config.threshold;
    const topK = options?.topK ?? candidates.length;
    const requestId = options?.requestId ?? "unknown";

    if (candidates.length === 0) {
      return {
        results: [],
        latency: 0,
        provider: this.name,
        filtered: 0,
        bypassed: true,
      };
    }

    // Bypass LLM for small result sets
    if (candidates.length <= this.config.bypassThreshold) {
      log.info("LLM rerank bypassed - small result set", {
        requestId,
        candidateCount: candidates.length,
        threshold: this.config.bypassThreshold,
      });

      const results = candidates
        .map((c) => ({
          id: c.id,
          score: c.score,
          relevance: c.score,
          originalScore: c.score,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return {
        results,
        latency: 0,
        provider: this.name,
        filtered: 0,
        bypassed: true,
      };
    }

    const startTime = Date.now();

    try {
      const { object } = await generateObject({
        model: gateway(this.config.model),
        schema: relevanceScoreSchema,
        prompt: this.buildPrompt(query, candidates),
        temperature: 0.1, // Low temperature for consistent scoring
      });

      const latency = Date.now() - startTime;

      log.info("LLM rerank complete", {
        requestId,
        latency,
        candidateCount: candidates.length,
        scoresReturned: object.scores.length,
      });

      // Build score map from LLM results
      const scoreMap = new Map(
        object.scores.map((s) => [s.id, s.relevance]),
      );

      // Combine LLM and vector scores
      const results = candidates
        .map((c) => {
          const llmRelevance = scoreMap.get(c.id) ?? 0.5; // Default if missing
          const finalScore =
            this.config.llmWeight * llmRelevance +
            this.config.vectorWeight * c.score;
          return {
            id: c.id,
            score: finalScore,
            relevance: llmRelevance,
            originalScore: c.score,
          };
        })
        .filter((r) => r.relevance >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return {
        results,
        latency,
        provider: this.name,
        filtered: candidates.length - results.length,
        bypassed: false,
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      log.error("LLM rerank failed, falling back to vector scores", {
        requestId,
        error,
        latency,
      });

      // Fallback: return candidates sorted by original score
      const results = candidates
        .map((c) => ({
          id: c.id,
          score: c.score,
          relevance: c.score,
          originalScore: c.score,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return {
        results,
        latency,
        provider: this.name,
        filtered: 0,
        bypassed: true,
      };
    }
  }

  /**
   * Build the relevance scoring prompt for the LLM
   */
  private buildPrompt(query: string, candidates: RerankCandidate[]): string {
    const candidateList = candidates
      .map(
        (c, i) =>
          `${i + 1}. [${c.id}] "${c.title}": ${c.content.slice(0, 200)}...`,
      )
      .join("\n");

    return `You are evaluating search results for relevance to a user query.

User Query: "${query}"

Candidates to score:
${candidateList}

For each candidate, rate its relevance to the query on a scale from 0.0 to 1.0:
- 1.0: Directly answers or highly relevant to the query
- 0.7-0.9: Related and useful context
- 0.4-0.6: Tangentially related
- 0.1-0.3: Barely relevant
- 0.0: Completely irrelevant

Return a score for each candidate by its ID.`;
  }
}

/**
 * Create an LLM rerank provider
 */
export function createLLMRerankProvider(
  config?: LLMRerankConfig,
): LLMRerankProvider {
  return new LLMRerankProvider(config);
}
```

### Success Criteria:

#### Automated Verification:
- [x] File created: `ls packages/console-rerank/src/providers/llm.ts`
- [x] TypeScript valid: `cd packages/console-rerank && pnpm typecheck`

---

## Phase 6: Factory and Exports

### Overview
Create the mode-based factory function and wire up all exports in index.ts.

### Changes Required:

#### 1. Create src/factory.ts
**File**: `packages/console-rerank/src/factory.ts`

```typescript
/**
 * Rerank provider factory
 *
 * Creates rerank providers based on quality mode selection.
 */

import type { RerankProvider, RerankMode } from "./types";
import { PassthroughRerankProvider } from "./providers/passthrough";
import { CohereRerankProvider } from "./providers/cohere";
import { LLMRerankProvider } from "./providers/llm";

/**
 * Create a rerank provider based on mode
 *
 * Mode selection:
 * - fast: Passthrough (no reranking, vector scores only)
 * - balanced: Cohere rerank API (efficient, production-ready)
 * - thorough: LLM-based scoring (highest quality, semantic understanding)
 *
 * @param mode - Quality tier for reranking
 * @returns Appropriate rerank provider instance
 *
 * @example
 * ```typescript
 * // Fast mode - no reranking overhead
 * const fast = createRerankProvider("fast");
 *
 * // Balanced mode - Cohere rerank API
 * const balanced = createRerankProvider("balanced");
 *
 * // Thorough mode - LLM semantic scoring
 * const thorough = createRerankProvider("thorough");
 * ```
 */
export function createRerankProvider(mode: RerankMode): RerankProvider {
  switch (mode) {
    case "fast":
      return new PassthroughRerankProvider();
    case "balanced":
      return new CohereRerankProvider();
    case "thorough":
      return new LLMRerankProvider();
    default:
      throw new Error(`Unknown rerank mode: ${mode}`);
  }
}
```

#### 2. Create src/index.ts
**File**: `packages/console-rerank/src/index.ts`

```typescript
/**
 * @repo/console-rerank
 *
 * Console-specific reranking utilities with mode-based provider selection.
 * Supports fast (passthrough), balanced (Cohere), and thorough (LLM) modes.
 *
 * @packageDocumentation
 */

// Export types
export type {
  RerankProvider,
  RerankCandidate,
  RerankResult,
  RerankResponse,
  RerankOptions,
  RerankMode,
} from "./types";

// Export factory
export { createRerankProvider } from "./factory";

// Export providers
export {
  PassthroughRerankProvider,
  createPassthroughRerankProvider,
} from "./providers/passthrough";

export {
  CohereRerankProvider,
  createCohereRerankProvider,
  type CohereRerankConfig,
} from "./providers/cohere";

export {
  LLMRerankProvider,
  createLLMRerankProvider,
  type LLMRerankConfig,
} from "./providers/llm";
```

### Success Criteria:

#### Automated Verification:
- [x] Files created: `ls packages/console-rerank/src/{factory,index}.ts`
- [x] TypeScript valid: `cd packages/console-rerank && pnpm typecheck`
- [x] Build succeeds: `cd packages/console-rerank && pnpm build`

---

## Phase 7: Configuration

### Overview
Add RERANK_CONFIG to the private-config.ts following the EMBEDDING_CONFIG pattern.

### Changes Required:

#### 1. Update packages/console-config/src/private-config.ts
**File**: `packages/console-config/src/private-config.ts`
**Changes**: Add RERANK_CONFIG after EMBEDDING_CONFIG

Add the following after line 188 (after EMBEDDING_CONFIG):

```typescript
/**
 * Rerank provider configuration
 *
 * Controls reranking behavior for neural memory search.
 * Currently private - optimized for quality vs latency trade-offs.
 *
 * Future: Could allow users to specify mode per workspace.
 */
export const RERANK_CONFIG = {
  /**
   * Cohere rerank configuration
   */
  cohere: {
    /**
     * Cohere rerank model
     * @default "rerank-v3.5"
     */
    model: "rerank-v3.5" as const,

    /**
     * Default relevance threshold
     * @default 0.4
     */
    threshold: 0.4 as const,
  },

  /**
   * LLM rerank configuration
   */
  llm: {
    /**
     * Model to use via AI Gateway
     * @default "anthropic/claude-haiku-4.5"
     */
    model: "anthropic/claude-haiku-4.5" as const,

    /**
     * Weight for LLM score in final calculation
     * @default 0.6
     */
    llmWeight: 0.6 as const,

    /**
     * Weight for vector score in final calculation
     * @default 0.4
     */
    vectorWeight: 0.4 as const,

    /**
     * Skip LLM if candidate count is <= this value
     * @default 5
     */
    bypassThreshold: 5 as const,

    /**
     * Default relevance threshold
     * @default 0.4
     */
    threshold: 0.4 as const,
  },

  /**
   * Default rerank mode
   * @default "balanced"
   */
  defaultMode: "balanced" as const,
} as const;
```

#### 2. Update PRIVATE_CONFIG object
Add `rerank: RERANK_CONFIG,` to the PRIVATE_CONFIG object (around line 285).

#### 3. Update packages/console-config/src/index.ts
**File**: `packages/console-config/src/index.ts`
**Changes**: Add RERANK_CONFIG export

Add to the existing exports from "./private-config":
```typescript
export {
  PRIVATE_CONFIG,
  PINECONE_CONFIG,
  EMBEDDING_CONFIG,
  CHUNKING_CONFIG,
  GITHUB_CONFIG,
  RERANK_CONFIG,  // Add this
  type PrivateConfig,
} from "./private-config";
```

### Success Criteria:

#### Automated Verification:
- [x] Config exports: `pnpm --filter @repo/console-config typecheck`
- [x] Build succeeds: `pnpm --filter @repo/console-config build`

---

## Phase 8: Install Dependencies and Verify

### Overview
Install dependencies and verify the package builds correctly.

### Changes Required:

#### 1. Install dependencies
```bash
pnpm install
```

#### 2. Build the package
```bash
pnpm --filter @repo/console-rerank build
```

#### 3. Verify typecheck
```bash
pnpm --filter @repo/console-rerank typecheck
```

#### 4. Verify lint
```bash
pnpm --filter @repo/console-rerank lint
```

### Success Criteria:

#### Automated Verification:
- [x] Dependencies installed: `pnpm install`
- [x] Build passes: `pnpm --filter @repo/console-rerank build`
- [x] Typecheck passes: `pnpm --filter @repo/console-rerank typecheck`
- [x] Lint passes: `pnpm --filter @repo/console-rerank lint`
- [x] Dist folder created: `ls packages/console-rerank/dist/`

#### Manual Verification:
- [ ] Package is importable from another console package
- [ ] Types are exported correctly

---

## Testing Strategy

### Unit Tests (Future)
- PassthroughRerankProvider: Verify sorting and threshold filtering
- CohereRerankProvider: Mock Cohere API, verify score mapping
- LLMRerankProvider: Mock AI SDK, verify score combination logic
- Factory: Verify correct provider returned for each mode

### Integration Tests (Future)
- CohereRerankProvider: Live API call with test query
- LLMRerankProvider: Live AI Gateway call with test query

### Manual Testing Steps
1. Import package in apps/console
2. Create provider with factory function
3. Call rerank with sample candidates
4. Verify response structure matches RerankResponse

---

## Performance Considerations

- **Passthrough**: O(n log n) for sorting, ~0ms latency
- **Cohere**: Single API call, ~100-200ms latency for 100 candidates
- **LLM**: Single AI Gateway call, ~300-500ms latency for 20 candidates

---

## Migration Notes

After this package is created, the next step is to:
1. Update `apps/console/src/lib/neural/llm-filter.ts` to use `LLMRerankProvider`
2. Integrate rerank provider into the search route at `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`

---

## References

- Original research: `thoughts/shared/research/2025-12-14-neural-memory-week1-day1-rerank-package.md`
- Week 1 plan: `thoughts/shared/plans/2025-12-14-neural-memory-week1-public-api-rerank.md`
- Similar package: `packages/console-pinecone/`
- Vendor pattern: `vendor/embed/`
- Existing LLM filter: `apps/console/src/lib/neural/llm-filter.ts`
