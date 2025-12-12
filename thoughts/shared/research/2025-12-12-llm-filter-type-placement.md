---
date: 2025-12-12T03:19:35Z
researcher: Claude
git_commit: 474e7bd3eb28682238c2f046dda1c1a28ba18b2e
branch: feat/memory-layer-foundation
repository: lightfast
topic: "LLM Filter Types and Configuration Placement"
tags: [research, console-types, console-config, console-validation, neural-memory]
status: complete
last_updated: 2025-12-12
last_updated_by: Claude
---

# Research: LLM Filter Types and Configuration Placement

**Date**: 2025-12-12T03:19:35Z
**Researcher**: Claude
**Git Commit**: 474e7bd3eb28682238c2f046dda1c1a28ba18b2e
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

For the Neural Memory Day 2 implementation (retrieval infrastructure), where should the LLM-based filtering interfaces and default options be stored? Consider `packages/console-types/`, `packages/console-validation/`, and `packages/console-config/`.

## Summary

Based on existing patterns in the codebase, the LLM filtering code should be split across two packages:

1. **Types/Interfaces** → `packages/console-types/src/neural/` (new file: `llm-filter.ts`)
2. **Default Options/Config** → `packages/console-config/src/private-config.ts` (add `LLM_FILTER_CONFIG`)
3. **Zod Validation Schemas** → Keep inline in route file OR move to `packages/console-validation/src/schemas/search.ts` if reuse is needed

## Detailed Findings

### Package Purpose Analysis

#### @repo/console-types

**Purpose**: TypeScript interfaces and Zod schemas for API boundaries and shared domain types.

**What belongs here**:
- API request/response schemas (`src/api/`)
- Domain model interfaces (DocumentMetadata, ChunkMetadata)
- Event type configs with weight constants (`src/integrations/event-types.ts`)
- Neural pipeline types (`src/neural/source-event.ts`)

**Pattern**: Uses both plain TypeScript interfaces for internal models and Zod schemas for API validation.

**Evidence**:
- `SearchResultSchema` with score field lives here (`src/api/search.ts:34-47`)
- `LatencySchema` with optional rerank field lives here (`src/api/common.ts:14-21`)
- `EventTypeConfig` with weight scoring lives here (`src/integrations/event-types.ts:15-19`)

#### @repo/console-validation

**Purpose**: Zod validation schemas for tRPC procedures, forms, and domain-specific validation.

**What belongs here**:
- Input schemas for tRPC procedures (`src/schemas/workspace.ts`, `src/schemas/job.ts`)
- Form validation schemas (`src/forms/`)
- Domain enums and constants (`src/schemas/sources.ts`)
- Workflow I/O schemas (`src/schemas/workflow-io.ts`)

**Pattern**: Validation-focused, imported by tRPC routers and React form components.

**Evidence**:
- `jobStatusSchema` enum lives here (`src/schemas/job.ts:18-24`)
- `sourceTypeSchema` enum lives here (`src/schemas/sources.ts:23-26`)

#### @repo/console-config

**Purpose**: Private infrastructure defaults and user configuration parsing.

**What belongs here**:
- Infrastructure constants (batch sizes, thresholds, limits)
- Scoring/processing parameters
- Provider-specific defaults

**Pattern**: `const` objects with numeric values, organized by domain (pinecone, embedding, chunking, github).

**Evidence**:
- `CHUNKING_CONFIG` with `maxTokens: 512`, `overlap: 50` (`src/private-config.ts:201-225`)
- `EMBEDDING_CONFIG` with `batchSize: 96` (`src/private-config.ts:137-191`)
- `GITHUB_CONFIG` with `contentsApiThreshold: 20` (`src/private-config.ts:235-268`)

### Recommendation for LLM Filter Types

#### 1. Interfaces (FilterCandidate, ScoredResult, LLMFilterResult)

**Location**: `packages/console-types/src/neural/llm-filter.ts`

**Rationale**:
- Neural types already have a dedicated directory (`src/neural/`)
- Pattern matches `SourceEvent` interface in same directory
- Types describe API response shapes, aligning with console-types purpose

**Implementation**:

```typescript
// packages/console-types/src/neural/llm-filter.ts

/**
 * Input candidate for LLM relevance filtering
 */
export interface FilterCandidate {
  id: string;
  title: string;
  snippet: string;
  score: number; // Vector similarity score (0-1)
}

/**
 * Result with combined relevance scores
 */
export interface ScoredResult extends FilterCandidate {
  relevanceScore: number;  // LLM relevance (0-1)
  finalScore: number;      // Combined score
}

/**
 * LLM filter operation result
 */
export interface LLMFilterResult {
  results: ScoredResult[];
  latency: number;
  filtered: number;
  bypassed: boolean;
}
```

**Export path**: Add to `src/neural/index.ts` and access via `@repo/console-types` or `@repo/console-types/neural`.

#### 2. Default Options (minConfidence, llmWeight, etc.)

**Location**: `packages/console-config/src/private-config.ts`

**Rationale**:
- Follows existing pattern of domain-specific config objects
- Aligns with CHUNKING_CONFIG, EMBEDDING_CONFIG, GITHUB_CONFIG
- Allows central tuning of LLM filter parameters

**Implementation**:

```typescript
// In packages/console-config/src/private-config.ts

/**
 * LLM relevance filtering configuration
 * @private - Internal defaults for neural memory search
 */
export const LLM_FILTER_CONFIG = {
  /**
   * Minimum LLM relevance score to keep a result
   * Range: 0.0 - 1.0
   */
  minConfidence: 0.4,

  /**
   * Weight for LLM relevance score in final ranking
   * Combined with vectorWeight (should sum to 1.0)
   */
  llmWeight: 0.6,

  /**
   * Weight for vector similarity score in final ranking
   */
  vectorWeight: 0.4,

  /**
   * Skip LLM filtering when result count is at or below this threshold
   * Avoids unnecessary LLM calls for small result sets
   */
  bypassThreshold: 5,
} as const;
```

**Add to PRIVATE_CONFIG aggregate**:

```typescript
export const PRIVATE_CONFIG = {
  pinecone: PINECONE_CONFIG,
  embedding: EMBEDDING_CONFIG,
  chunking: CHUNKING_CONFIG,
  github: GITHUB_CONFIG,
  llmFilter: LLM_FILTER_CONFIG, // Add here
};
```

#### 3. SearchFiltersSchema (optional validation schema)

**Location**: Keep inline in route file OR `packages/console-validation/src/schemas/search.ts`

**Rationale**:
- Current plan defines schema inline in route file (lines 83-91 of plan)
- If filters need to be validated in multiple places (tRPC, REST API), extract to console-validation
- For Day 2 MVP, inline is acceptable

**If extracted later**:

```typescript
// packages/console-validation/src/schemas/search.ts

export const searchFiltersSchema = z.object({
  sourceTypes: z.array(z.string()).optional(),
  observationTypes: z.array(z.string()).optional(),
  actorNames: z.array(z.string()).optional(),
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  }).optional(),
}).optional();

export type SearchFilters = z.infer<typeof searchFiltersSchema>;
```

### LatencySchema Update

**Current state** (`packages/console-types/src/api/common.ts:14-21`):

```typescript
export const LatencySchema = z.object({
  total: z.number().nonnegative(),
  retrieval: z.number().nonnegative(),
  rerank: z.number().nonnegative().optional(),
});
```

**Required update**: Add `llmFilter` field as planned.

```typescript
export const LatencySchema = z.object({
  total: z.number().nonnegative(),
  retrieval: z.number().nonnegative(),
  llmFilter: z.number().nonnegative().optional(), // Add this
  rerank: z.number().nonnegative().optional(),
});
```

## Code References

- `packages/console-types/src/api/common.ts:14-21` - LatencySchema definition
- `packages/console-types/src/api/search.ts:34-47` - SearchResultSchema pattern
- `packages/console-types/src/integrations/event-types.ts:15-19` - EventTypeConfig pattern (weights)
- `packages/console-types/src/neural/source-event.ts` - Neural types pattern
- `packages/console-config/src/private-config.ts:201-225` - CHUNKING_CONFIG pattern
- `packages/console-config/src/private-config.ts:137-191` - EMBEDDING_CONFIG pattern
- `packages/console-validation/src/schemas/job.ts:18-24` - Domain enum pattern

## Architecture Documentation

### Package Dependency Flow

```
console-validation (primitives)
         ↓
console-types (imports SourceType)
         ↓
console-config (imports validation types)
         ↓
apps/console, api/console (imports all)
```

### Type Organization Pattern

| Type Category | Package | Example |
|---------------|---------|---------|
| API schemas | console-types/api | SearchRequestSchema |
| Domain interfaces | console-types | DocumentMetadata |
| Neural pipeline types | console-types/neural | SourceEvent |
| Validation schemas | console-validation | jobStatusSchema |
| Infrastructure defaults | console-config | EMBEDDING_CONFIG |

## Final Placement Summary

| Item | Package | File |
|------|---------|------|
| FilterCandidate interface | console-types | `src/neural/llm-filter.ts` |
| ScoredResult interface | console-types | `src/neural/llm-filter.ts` |
| LLMFilterResult interface | console-types | `src/neural/llm-filter.ts` |
| LLM_FILTER_CONFIG defaults | console-config | `src/private-config.ts` |
| LatencySchema (update) | console-types | `src/api/common.ts` |
| SearchFiltersSchema | inline OR console-validation | route.ts or `src/schemas/search.ts` |

## Open Questions

1. Should `llmRelevanceFilter` function itself live in a shared lib, or stay in `apps/console/src/lib/neural/`?
   - **Recommendation**: Keep in `apps/console/src/lib/neural/` for Day 2, extract to package if reused elsewhere
