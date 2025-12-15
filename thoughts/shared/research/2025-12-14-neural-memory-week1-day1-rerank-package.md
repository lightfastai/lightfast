---
date: 2025-12-14T10:30:00Z
researcher: Claude
git_commit: 5bc0bf4322d8d478b2ad6311f812804741137ec8
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Neural Memory Week 1 Day 1: Rerank Package Implementation Map"
tags: [research, implementation-map, neural-memory, rerank, week1-day1]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
---

# Research: Neural Memory Week 1 Day 1 - Rerank Package Implementation Map

**Date**: 2025-12-14T10:30:00Z
**Researcher**: Claude
**Git Commit**: 5bc0bf4322d8d478b2ad6311f812804741137ec8
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Document all existing patterns for creating `packages/console-rerank/` with Cohere and LLM providers, including:
1. LLM Filter implementation analysis
2. Cohere SDK usage patterns
3. Package creation patterns
4. Vendor provider patterns
5. Configuration patterns

## Summary

This document provides a complete implementation map for Day 1 of Week 1: creating the `packages/console-rerank/` package. The package will implement a `RerankProvider` interface with three providers (Cohere, LLM, Passthrough) and a factory function for mode-based selection (fast/balanced/thorough).

---

## Detailed Findings

### 1. LLM Filter Implementation (Refactor Source)

**File**: `apps/console/src/lib/neural/llm-filter.ts`

#### Main Function

**`llmRelevanceFilter()`** at lines 66-162:
```typescript
export async function llmRelevanceFilter(
  query: string,
  candidates: FilterCandidate[],
  requestId: string,
  options: Partial<typeof DEFAULT_OPTIONS> = {},
): Promise<LLMFilterResult>
```

#### Input Interface (lines 29-34)

```typescript
export interface FilterCandidate {
  id: string;           // Observation ID
  title: string;        // Document/observation title
  snippet: string;      // Text snippet for scoring
  score: number;        // Vector similarity score
}
```

#### Output Interface (lines 37-48)

```typescript
export interface ScoredResult extends FilterCandidate {
  relevanceScore: number; // LLM relevance score (0-1)
  finalScore: number;     // Combined weighted score
}

export interface LLMFilterResult {
  results: ScoredResult[];
  latency: number;
  filtered: number;
  bypassed: boolean;
}
```

#### Default Configuration (lines 51-56)

```typescript
const DEFAULT_OPTIONS = {
  minConfidence: 0.4,      // Minimum LLM relevance to keep
  llmWeight: 0.6,          // Weight for LLM score in final
  vectorWeight: 0.4,       // Weight for vector score in final
  bypassThreshold: 5,      // Skip LLM if <= this many results
};
```

#### Bypass Logic (lines 74-92)

- Bypass triggered when `candidates.length <= bypassThreshold`
- Returns candidates with `relevanceScore = finalScore = score` (vector score)
- Returns `{ results, latency: 0, filtered: 0, bypassed: true }`

#### LLM Generation (lines 94-114)

```typescript
const { object } = await generateObject({
  model: gateway("anthropic/claude-haiku-4.5"),
  schema: relevanceScoreSchema,
  prompt: buildRelevancePrompt(query, candidates),
  temperature: 0.1,  // Low temperature for consistent scoring
});
```

**Model**: `anthropic/claude-haiku-4.5` via Vercel AI Gateway

#### Zod Schema (lines 13-26)

```typescript
const relevanceScoreSchema = z.object({
  scores: z.array(
    z.object({
      id: z.string().describe("The observation ID"),
      relevance: z
        .number()
        .min(0)
        .max(1)
        .describe("Relevance score from 0.0 (irrelevant) to 1.0 (highly relevant)"),
    }),
  ),
});
```

#### Prompt Construction (lines 167-193)

```typescript
function buildRelevancePrompt(query: string, candidates: FilterCandidate[]): string {
  const candidateList = candidates
    .map((c, i) => `${i + 1}. [${c.id}] "${c.title}": ${c.snippet.slice(0, 200)}...`)
    .join("\n");

  return `You are evaluating search results for relevance to a user query.

User Query: "${query}"

Observations to score:
${candidateList}

For each observation, rate its relevance to the query on a scale from 0.0 to 1.0:
- 1.0: Directly answers or highly relevant to the query
- 0.7-0.9: Related and useful context
- 0.4-0.6: Tangentially related
- 0.1-0.3: Barely relevant
- 0.0: Completely irrelevant

Return a score for each observation by its ID.`;
}
```

#### Score Combination Logic (lines 118-126)

```typescript
const results = candidates
  .map(c => {
    const relevanceScore = scoreMap.get(c.id) ?? 0.5;  // Default 0.5 if missing
    const finalScore = opts.llmWeight * relevanceScore + opts.vectorWeight * c.score;
    return { ...c, relevanceScore, finalScore };
  })
  .filter(c => c.relevanceScore >= opts.minConfidence)
  .sort((a, b) => b.finalScore - a.finalScore);
```

**Formula**: `finalScore = (0.6 * relevanceScore) + (0.4 * vectorScore)`

#### Error Handling (lines 143-161)

- All errors caught in try-catch
- Falls back to vector scores only
- Returns `{ results, latency, filtered: 0, bypassed: true }`
- Logs error with `log.error()` including requestId

#### Dependencies (lines 7-10)

```typescript
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { log } from "@vendor/observability/log";
```

---

### 2. Cohere SDK Usage Patterns

**File**: `vendor/embed/src/provider/cohere.ts`

#### Client Initialization (lines 83-94)

```typescript
export class CohereEmbedding implements EmbeddingProvider {
  private readonly client: CohereClient;

  constructor(config: CohereEmbeddingConfig) {
    if (!config.apiKey) {
      throw new Error("Cohere API key is required");
    }
    this.client = new CohereClient({
      token: config.apiKey,  // Note: "token" not "apiKey"
    });
    this.model = config.model ?? "embed-english-v3.0";
  }
}
```

**API Key Source**: Environment variable via `embedEnv.COHERE_API_KEY` at `vendor/embed/src/env.ts:11`

#### Configuration Interface (lines 31-54)

```typescript
export interface CohereEmbeddingConfig {
  apiKey: string;
  model?: string;              // Default: "embed-english-v3.0"
  inputType?: CohereInputType; // Default: "search_document"
  dimension?: number;          // Default: 1024
}
```

#### Error Handling Pattern (lines 133-138)

```typescript
} catch (error) {
  if (error instanceof Error) {
    throw new Error(`Failed to generate Cohere embeddings: ${error.message}`);
  }
  throw error;
}
```

#### Current Rerank Usage

**No active rerank implementation exists.** Only latency tracking in:
- `packages/console-types/src/api/common.ts:19` - `rerank: z.number().nonnegative().optional()`

#### Cohere Rerank API Pattern (from Cohere SDK)

```typescript
const response = await client.rerank({
  model: "rerank-v3.5",
  query: "search query",
  documents: [{ text: "document content" }],
  topN: 10,
  returnDocuments: false,
});
// response.results[].index, response.results[].relevanceScore
```

---

### 3. Package Creation Pattern

**Reference**: `packages/console-pinecone/`

#### File Structure

```
packages/console-rerank/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md
└── src/
    ├── index.ts
    ├── types.ts
    ├── factory.ts
    └── providers/
        ├── cohere.ts
        ├── llm.ts
        └── passthrough.ts
```

#### package.json Pattern

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
  "scripts": {
    "build": "tsup",
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "cohere-ai": "^7.15.0",
    "ai": "catalog:",
    "@ai-sdk/gateway": "catalog:",
    "zod": "catalog:",
    "@repo/console-config": "workspace:*",
    "@vendor/observability": "workspace:*"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/prettier-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "tsup": "^8.5.0",
    "typescript": "catalog:"
  }
}
```

#### tsconfig.json Pattern

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

#### tsup.config.ts Pattern

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

#### src/index.ts Export Pattern

```typescript
/**
 * @repo/console-rerank
 *
 * Console-specific reranking utilities with mode-based provider selection.
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
export { CohereRerankProvider } from "./providers/cohere";
export { LLMRerankProvider } from "./providers/llm";
export { PassthroughRerankProvider } from "./providers/passthrough";
```

---

### 4. Vendor Provider Pattern

**Reference**: `vendor/embed/`

#### Interface Pattern (`vendor/embed/src/types.ts:54-67`)

```typescript
export interface EmbeddingProvider {
  readonly dimension: number;
  embed(texts: string[]): Promise<EmbedResponse>;
}
```

**Rerank equivalent**:

```typescript
export interface RerankProvider {
  readonly name: string;
  rerank(
    query: string,
    candidates: RerankCandidate[],
    options?: RerankOptions
  ): Promise<RerankResponse>;
}
```

#### Provider Class Pattern

1. **Private SDK client** as class property
2. **Constructor** validates config and initializes client
3. **Interface method** handles API call, response transformation, error handling
4. **Factory function** wraps constructor

```typescript
export class CohereRerankProvider implements RerankProvider {
  readonly name = "cohere";
  private readonly client: CohereClient;
  private readonly model: string;

  constructor(config?: CohereRerankConfig) {
    const apiKey = config?.apiKey ?? process.env.COHERE_API_KEY;
    if (!apiKey) throw new Error("Cohere API key is required");
    this.client = new CohereClient({ token: apiKey });
    this.model = config?.model ?? "rerank-v3.5";
  }

  async rerank(query: string, candidates: RerankCandidate[], options?: RerankOptions): Promise<RerankResponse> {
    // Implementation
  }
}

export function createCohereRerankProvider(config?: CohereRerankConfig): CohereRerankProvider {
  return new CohereRerankProvider(config);
}
```

#### Factory Pattern for Mode Selection

```typescript
export function createRerankProvider(mode: RerankMode): RerankProvider {
  switch (mode) {
    case "fast":
      return new PassthroughRerankProvider();
    case "balanced":
      return new CohereRerankProvider();
    case "thorough":
      return new ChainedRerankProvider([
        new CohereRerankProvider(),
        new LLMRerankProvider(),
      ]);
    default:
      throw new Error(`Unknown rerank mode: ${mode}`);
  }
}
```

---

### 5. Configuration Pattern

**Reference**: `packages/console-config/src/private-config.ts`

#### EMBEDDING_CONFIG Structure (lines 134-188)

```typescript
export const EMBEDDING_CONFIG = {
  cohere: {
    provider: "cohere" as const,
    model: "embed-english-v3.0",
    dimension: 1024,
  },
  batchSize: 96,
} satisfies { cohere: { provider: EmbeddingProvider; ... } };
```

#### RERANK_CONFIG (to add)

```typescript
export const RERANK_CONFIG = {
  cohere: {
    provider: "cohere" as const,
    model: "rerank-v3.5",
    threshold: 0.4,
  },
  llm: {
    model: "anthropic/claude-haiku-4.5",
    weight: 0.6,
    vectorWeight: 0.4,
    bypassThreshold: 5,
    minConfidence: 0.4,
  },
  defaults: {
    mode: "balanced" as const,
  },
} as const;
```

#### Environment Variables

Add to `vendor/embed/src/env.ts` or create `packages/console-rerank/src/env.ts`:

```typescript
export const rerankEnv = createEnv({
  server: {
    COHERE_API_KEY: z.string().min(1),  // Shared with embed
  },
  runtimeEnv: {
    COHERE_API_KEY: process.env.COHERE_API_KEY,
  },
});
```

---

## Implementation Plan

### Files to Create

| File | Purpose |
|------|---------|
| `packages/console-rerank/package.json` | Package configuration |
| `packages/console-rerank/tsconfig.json` | TypeScript config |
| `packages/console-rerank/tsup.config.ts` | Build config |
| `packages/console-rerank/README.md` | Documentation |
| `packages/console-rerank/src/index.ts` | Main exports |
| `packages/console-rerank/src/types.ts` | Type definitions |
| `packages/console-rerank/src/factory.ts` | Provider factory |
| `packages/console-rerank/src/providers/cohere.ts` | Cohere provider |
| `packages/console-rerank/src/providers/llm.ts` | LLM provider (refactored) |
| `packages/console-rerank/src/providers/passthrough.ts` | No-op provider |

### Type Definitions (`src/types.ts`)

```typescript
export interface RerankCandidate {
  id: string;
  title: string;
  content: string;
  score: number;  // Original vector score
}

export interface RerankResult {
  id: string;
  score: number;       // Reranked score (0-1)
  relevance: number;   // Provider-specific relevance
}

export interface RerankResponse {
  results: RerankResult[];
  latency: number;
  provider: string;
}

export interface RerankProvider {
  readonly name: string;
  rerank(
    query: string,
    candidates: RerankCandidate[],
    options?: RerankOptions
  ): Promise<RerankResponse>;
}

export interface RerankOptions {
  topK?: number;
  threshold?: number;
  returnOriginalRanking?: boolean;
}

export type RerankMode = "fast" | "balanced" | "thorough";
```

### Implementation Order

1. Create package structure (`package.json`, `tsconfig.json`, `tsup.config.ts`)
2. Define types (`src/types.ts`)
3. Implement `PassthroughRerankProvider` (simplest, no dependencies)
4. Implement `CohereRerankProvider` (uses cohere-ai SDK)
5. Implement `LLMRerankProvider` (refactor from llm-filter.ts)
6. Implement factory (`src/factory.ts`)
7. Create barrel exports (`src/index.ts`)
8. Add config to `packages/console-config/src/private-config.ts`
9. Test all three modes

---

## Code References

### Source Files to Reference

| Component | File | Lines |
|-----------|------|-------|
| LLM Filter | `apps/console/src/lib/neural/llm-filter.ts` | 66-162 |
| Cohere Provider | `vendor/embed/src/provider/cohere.ts` | 77-140 |
| Package Pattern | `packages/console-pinecone/package.json` | Full file |
| Private Config | `packages/console-config/src/private-config.ts` | 134-188 |
| Embed Types | `vendor/embed/src/types.ts` | 54-67 |
| Embed Index | `vendor/embed/src/index.ts` | 1-33 |

### Files to Modify

| File | Change |
|------|--------|
| `packages/console-config/src/private-config.ts` | Add RERANK_CONFIG |
| `packages/console-config/src/index.ts` | Export RERANK_CONFIG |

---

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2025-12-14-neural-memory-week1-public-api-rerank.md` - Week 1 plan
- `thoughts/shared/plans/2025-12-14-neural-memory-week1-daily-prompts.md` - Daily prompts
- `thoughts/shared/research/2025-12-14-public-api-v1-route-design.md` - API design spec
- `thoughts/shared/research/2025-12-12-llm-filter-type-placement.md` - LLM filter types

---

## Open Questions

1. **Chained Provider**: For "thorough" mode, should Cohere and LLM be chained (sequential) or blended (parallel with score combination)?

2. **Environment Variable**: Should COHERE_API_KEY be shared with embedding, or should rerank have its own?

3. **Fallback Strategy**: If Cohere fails, should we:
   - Fall back to LLM-only?
   - Fall back to passthrough (vector scores)?
   - Return error?

4. **Threshold Application**: Should threshold be applied:
   - After Cohere rerank only?
   - After LLM refinement?
   - At each stage?
