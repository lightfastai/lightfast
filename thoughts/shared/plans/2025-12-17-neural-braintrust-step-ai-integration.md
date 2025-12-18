# Neural Workflows: Braintrust + step.ai Integration

## Overview

Integrate Braintrust middleware and Inngest's `step.ai.wrap()` into neural observation workflows for unified AI observability. This enables prompt tracing, token tracking, and AI metrics across all LLM operations in the neural memory pipeline.

## Current State Analysis

### Existing LLM Workflows

| Workflow | Model | Current Pattern | Braintrust | step.ai |
|----------|-------|-----------------|------------|---------|
| `classification.ts` | None (regex) | Pure function | ❌ | ❌ |
| `llm-entity-extraction.ts` | `openai/gpt-5.1-instant` | Direct `generateObject` | ❌ | ❌ |
| `cluster-summary.ts` | `openai/gpt-4.1-mini` | `step.run()` + `generateObject` | ❌ | ❌ |

### Key Files

- `api/console/src/inngest/workflow/neural/classification.ts:160-185` - Regex-based classification
- `api/console/src/inngest/workflow/neural/llm-entity-extraction.ts:90-95` - Entity extraction LLM call
- `api/console/src/inngest/workflow/neural/cluster-summary.ts:152-177` - Summary generation LLM call
- `packages/ai/src/env/braintrust-env.ts:8-80` - Braintrust config helpers

### Key Discoveries

1. **No Braintrust in api/console**: The `api/console` package doesn't import Braintrust - only `apps/chat` uses it
2. **No step.ai.wrap() usage**: All AI calls use direct SDK or `step.run()` wrappers
3. **Classification is regex-only**: No LLM, just pattern matching with 14 categories
4. **Existing schema**: `packages/console-validation/src/schemas/entities.ts` has LLM extraction schemas

## Desired End State

After implementation:

1. **All neural LLM calls** wrapped with `step.ai.wrap()` for Inngest AI observability
2. **Braintrust middleware** on all models for cross-workflow tracing
3. **Classification upgraded** from regex to Claude Haiku with structured output
4. **Unified telemetry** with `experimental_telemetry` metadata on all calls

### Verification

```bash
# Type checking passes
pnpm --filter @api/console typecheck

# Inngest dev server shows AI step metrics
pnpm dev:console
# Navigate to Inngest dashboard → Function runs → AI tab visible

# Braintrust dashboard shows neural workflow traces
# Project: lightfast-console (or configured project name)
```

## What We're NOT Doing

- Changing embedding generation (Cohere) - separate system
- Modifying Pinecone vector storage
- Changing the observation-capture workflow orchestration
- Adding streaming to LLM calls (not supported by step.ai.wrap yet)
- Modifying the scoring.ts significance calculation (remains rule-based)

## Implementation Approach

Incremental migration in 3 phases:
1. Add Braintrust + step.ai.wrap() to existing LLM workflows
2. Upgrade classification from regex to Claude Haiku
3. Add tests and evaluation framework

Each phase is independently deployable with rollback capability.

---

## Phase 1: Add Braintrust + step.ai.wrap() to Existing Workflows

### Overview

Wrap existing LLM calls in `llm-entity-extraction.ts` and `cluster-summary.ts` with Braintrust middleware and migrate from `step.run()` to `step.ai.wrap()`.

### Changes Required

#### 1. Add Braintrust Dependencies to api/console

**File**: `api/console/package.json`

Add dependency:
```json
{
  "dependencies": {
    "braintrust": "catalog:"
  }
}
```

Run:
```bash
pnpm install
```

#### 2. Create Neural AI Helper Module

**File**: `api/console/src/inngest/workflow/neural/ai-helpers.ts` (NEW)

```typescript
/**
 * Neural Workflow AI Helpers
 *
 * Provides wrapped AI SDK functions with Braintrust middleware
 * for use with Inngest step.ai.wrap()
 */

import { generateObject, generateText, wrapLanguageModel } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { BraintrustMiddleware } from "braintrust";
import type { LanguageModelV1 } from "ai";

/**
 * Creates a model wrapped with Braintrust middleware for tracing
 */
export function createTracedModel(modelId: string): LanguageModelV1 {
  return wrapLanguageModel({
    model: gateway(modelId),
    middleware: BraintrustMiddleware({ debug: false }),
  });
}

/**
 * Default telemetry metadata for neural workflows
 */
export function buildNeuralTelemetry(
  functionId: string,
  metadata: Record<string, string | number | boolean>
) {
  return {
    isEnabled: true,
    functionId,
    metadata: {
      context: "neural-workflow",
      ...metadata,
    },
  };
}

// Re-export AI SDK functions for step.ai.wrap()
export { generateObject, generateText };
```

#### 3. Update LLM Entity Extraction

**File**: `api/console/src/inngest/workflow/neural/llm-entity-extraction.ts`

**Changes**:

```typescript
// Add imports at top (after existing imports around line 14)
import {
  createTracedModel,
  generateObject,
  buildNeuralTelemetry,
} from "./ai-helpers";
```

Replace the `extractEntitiesWithLLM` function body (lines 65-132):

```typescript
export async function extractEntitiesWithLLM(
  title: string,
  content: string,
  context: { observationId: string; requestId: string }
): Promise<ExtractedEntity[]> {
  const config = LLM_ENTITY_EXTRACTION_CONFIG;

  // Skip if content too short
  if (content.length < config.minContentLength) {
    log.debug("Skipping LLM entity extraction", {
      reason: "content_too_short",
      contentLength: content.length,
      minLength: config.minContentLength,
      ...context,
    });
    return [];
  }

  try {
    const startTime = Date.now();

    const { object } = await generateObject({
      model: createTracedModel("openai/gpt-5.1-instant"),
      schema: llmEntityExtractionResponseSchema,
      prompt: buildExtractionPrompt(title, content),
      temperature: config.temperature,
      experimental_telemetry: buildNeuralTelemetry("neural-entity-extraction", {
        observationId: context.observationId,
        contentLength: content.length,
      }),
    });

    // Filter by confidence threshold
    const entities: ExtractedEntity[] = object.entities
      .filter((e) => e.confidence >= config.minConfidence)
      .map((e) => ({
        category: e.category,
        key: e.key,
        value: e.value,
        confidence: e.confidence,
        evidence: e.reasoning ?? `LLM extracted: ${e.category}`,
      }));

    log.info("LLM entity extraction completed", {
      ...context,
      rawCount: object.entities.length,
      filteredCount: entities.length,
      latency: Date.now() - startTime,
    });

    return entities;
  } catch (error) {
    log.error("LLM entity extraction failed", {
      ...context,
      error: String(error),
    });
    return []; // Graceful degradation
  }
}
```

#### 4. Update LLM Entity Extraction Workflow

**File**: `api/console/src/inngest/workflow/neural/llm-entity-extraction-workflow.ts`

**Changes** at lines 70-76:

```typescript
// Import generateObject for step.ai.wrap
import { generateObject } from "./ai-helpers";

// Replace step.run with step.ai.wrap (around line 70)
const llmEntities = await step.ai.wrap(
  "extract-entities-llm",
  generateObject,
  {
    model: createTracedModel("openai/gpt-5.1-instant"),
    schema: llmEntityExtractionResponseSchema,
    prompt: buildExtractionPrompt(observation.title, observation.content ?? ""),
    temperature: LLM_ENTITY_EXTRACTION_CONFIG.temperature,
    experimental_telemetry: buildNeuralTelemetry("neural-entity-extraction", {
      observationId,
      workspaceId,
    }),
  } as any // Type cast required for generateObject overloads
);
```

Wait - the workflow calls `extractEntitiesWithLLM` which is a wrapper function. We need to restructure to use step.ai.wrap() at the workflow level.

**Revised approach**: Keep `extractEntitiesWithLLM` as is but update it to use Braintrust. The step.ai.wrap() pattern works best when wrapping the raw AI SDK function directly in the workflow.

Let me revise:

**File**: `api/console/src/inngest/workflow/neural/llm-entity-extraction-workflow.ts`

Replace lines 1-130:

```typescript
/**
 * LLM Entity Extraction Workflow
 *
 * Asynchronously extracts semantic entities from observation content
 * using LLM (GPT-5.1-instant) with Braintrust tracing and Inngest AI observability.
 */

import { generateObject, wrapLanguageModel } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { BraintrustMiddleware } from "braintrust";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@db/console";
import {
  workspaceNeuralEntities,
  workspaceNeuralObservations,
} from "@db/console/schema";
import { log } from "@vendor/observability/log";
import {
  llmEntityExtractionResponseSchema,
  type ExtractedEntity,
} from "@repo/console-validation";

import { inngest } from "../../client";
import { LLM_ENTITY_EXTRACTION_CONFIG } from "@repo/console-config";
import { buildExtractionPrompt } from "./llm-entity-extraction";

export const llmEntityExtractionWorkflow = inngest.createFunction(
  {
    id: "apps-console/neural.llm-entity-extraction",
    name: "Neural: LLM Entity Extraction",
    retries: 2,
    debounce: {
      key: "event.data.observationId",
      period: "1m",
    },
  },
  { event: "apps-console/neural/llm-entity-extraction.requested" },
  async ({ event, step }) => {
    const { workspaceId, observationId, clerkOrgId } = event.data;
    const config = LLM_ENTITY_EXTRACTION_CONFIG;

    // Step 1: Fetch observation
    const observation = await step.run("fetch-observation", async () => {
      const obs = await db.query.workspaceNeuralObservations.findFirst({
        where: eq(workspaceNeuralObservations.externalId, observationId),
        columns: {
          id: true,
          title: true,
          content: true,
        },
      });
      return obs ?? null;
    });

    if (!observation) {
      return { status: "skipped", reason: "observation_not_found" };
    }

    // Skip if content too short
    const contentLength = observation.content?.length ?? 0;
    if (contentLength < config.minContentLength) {
      return { status: "skipped", reason: "content_too_short", contentLength };
    }

    // Step 2: Extract entities with LLM using step.ai.wrap()
    const extractionResult = await step.ai.wrap(
      "extract-entities-llm",
      generateObject,
      {
        model: wrapLanguageModel({
          model: gateway("openai/gpt-5.1-instant"),
          middleware: BraintrustMiddleware({ debug: false }),
        }),
        schema: llmEntityExtractionResponseSchema,
        prompt: buildExtractionPrompt(
          observation.title,
          observation.content ?? ""
        ),
        temperature: config.temperature,
        experimental_telemetry: {
          isEnabled: true,
          functionId: "neural-entity-extraction",
          metadata: {
            context: "neural-workflow",
            observationId,
            workspaceId,
            contentLength,
          },
        },
      } as any // Type cast required for generateObject overloads
    );

    // Filter by confidence threshold
    const entities: ExtractedEntity[] = extractionResult.object.entities
      .filter((e) => e.confidence >= config.minConfidence)
      .map((e) => ({
        category: e.category,
        key: e.key,
        value: e.value,
        confidence: e.confidence,
        evidence: e.reasoning ?? `LLM extracted: ${e.category}`,
      }));

    if (entities.length === 0) {
      return { status: "completed", entitiesExtracted: 0 };
    }

    // Step 3: Store entities
    await step.run("store-entities", async () => {
      for (const entity of entities) {
        await db
          .insert(workspaceNeuralEntities)
          .values({
            workspaceId,
            category: entity.category,
            key: entity.key,
            value: entity.value ?? null,
            confidence: entity.confidence,
            evidence: entity.evidence,
            sourceObservationId: observation.id,
            firstSeenAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            occurrenceCount: 1,
          })
          .onConflictDoUpdate({
            target: [
              workspaceNeuralEntities.workspaceId,
              workspaceNeuralEntities.category,
              workspaceNeuralEntities.key,
            ],
            set: {
              lastSeenAt: new Date().toISOString(),
              occurrenceCount: sql`${workspaceNeuralEntities.occurrenceCount} + 1`,
              confidence: sql`GREATEST(${workspaceNeuralEntities.confidence}, ${entity.confidence})`,
            },
          });
      }
    });

    log.info("LLM entity extraction completed", {
      observationId,
      workspaceId,
      entitiesExtracted: entities.length,
    });

    return { status: "completed", entitiesExtracted: entities.length };
  }
);
```

#### 5. Update Cluster Summary Workflow

**File**: `api/console/src/inngest/workflow/neural/cluster-summary.ts`

**Add imports** after line 18:

```typescript
import { wrapLanguageModel } from "ai";
import { BraintrustMiddleware } from "braintrust";
```

**Replace lines 152-177** (the generate-summary step):

```typescript
// Step 3: Generate summary with LLM
const summary = await step.ai.wrap(
  "generate-summary",
  generateObject,
  {
    model: wrapLanguageModel({
      model: gateway("openai/gpt-4.1-mini"),
      middleware: BraintrustMiddleware({ debug: false }),
    }),
    schema: clusterSummarySchema,
    prompt: `Summarize this cluster of engineering activity observations.

Cluster topic: ${cluster.topicLabel}
Observation count: ${observationCount}

Recent observations:
${JSON.stringify(
      observations.map((obs) => ({
        type: obs.observationType,
        title: obs.title,
        actor: (obs.actor as { name?: string } | null)?.name ?? "unknown",
        date: obs.occurredAt,
        snippet: obs.content?.slice(0, 200) ?? "",
      })),
      null,
      2
    )}

Generate a concise summary, key topics, key contributors, and activity status.`,
    temperature: 0.3,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "neural-cluster-summary",
      metadata: {
        context: "neural-workflow",
        clusterId,
        workspaceId,
        observationCount: observations.length,
      },
    },
  } as any // Type cast required for generateObject overloads
);
```

### Success Criteria

#### Automated Verification:
- [x] Dependencies install cleanly: `pnpm install`
- [x] Type checking passes: `pnpm --filter @api/console typecheck`
- [x] Build succeeds: `pnpm --filter @api/console build`
- [x] Linting passes: `pnpm --filter @api/console lint` (modified files only)

#### Manual Verification:
- [ ] Inngest dev server shows "AI" tab on entity extraction runs
- [ ] Inngest dev server shows "AI" tab on cluster summary runs
- [ ] Braintrust dashboard shows traces for `neural-entity-extraction`
- [ ] Braintrust dashboard shows traces for `neural-cluster-summary`
- [ ] Existing functionality unchanged (entities extracted, summaries generated)

**Implementation Note**: After completing Phase 1 and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Upgrade Classification to Claude Haiku

### Overview

Replace the regex-based `classifyObservation()` function with an LLM-based classifier using Claude Haiku. This enables semantic understanding of events beyond keyword matching.

### Changes Required

#### 1. Create Classification Schema

**File**: `packages/console-validation/src/schemas/classification.ts` (NEW)

```typescript
import { z } from "zod";

/**
 * Primary categories for observation classification
 */
export const primaryCategorySchema = z.enum([
  "bug_fix",
  "feature",
  "refactor",
  "documentation",
  "testing",
  "infrastructure",
  "security",
  "performance",
  "incident",
  "decision",
  "discussion",
  "release",
  "deployment",
  "other",
]);

export type PrimaryCategory = z.infer<typeof primaryCategorySchema>;

/**
 * LLM classification response schema
 */
export const classificationResponseSchema = z.object({
  primaryCategory: primaryCategorySchema.describe(
    "The main category that best describes this event"
  ),
  secondaryCategories: z
    .array(z.string())
    .max(3)
    .describe("Up to 3 additional relevant categories or tags"),
  topics: z
    .array(z.string())
    .max(5)
    .describe("Key topics or themes extracted from the content"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score from 0.0 to 1.0"),
  reasoning: z
    .string()
    .max(200)
    .optional()
    .describe("Brief explanation for the classification"),
});

export type ClassificationResponse = z.infer<typeof classificationResponseSchema>;
```

**File**: `packages/console-validation/src/schemas/index.ts`

Add export:
```typescript
export * from "./classification";
```

#### 2. Update Classification Module

**File**: `api/console/src/inngest/workflow/neural/classification.ts`

Replace entire file:

```typescript
/**
 * Neural Observation Classification
 *
 * Classifies source events into semantic categories using Claude Haiku.
 * Provides primary category, secondary tags, topics, and confidence scores.
 *
 * Used by observation-capture.ts step.ai.wrap() for inline classification.
 */

import type { SourceEvent } from "@repo/console-types";

/**
 * Build the classification prompt for Claude Haiku
 */
export function buildClassificationPrompt(sourceEvent: SourceEvent): string {
  return `Classify this engineering event into categories.

EVENT DETAILS:
- Source: ${sourceEvent.source}
- Type: ${sourceEvent.sourceType}
- Title: ${sourceEvent.title}
${sourceEvent.body ? `- Description: ${sourceEvent.body.slice(0, 1000)}` : ""}

CATEGORIES (choose the most appropriate primary category):
- bug_fix: Bug fixes, patches, error corrections
- feature: New features, additions, implementations
- refactor: Code restructuring, cleanup, reorganization
- documentation: Docs, README, comments, JSDoc
- testing: Tests, specs, coverage improvements
- infrastructure: CI/CD, pipelines, Docker, config
- security: Security fixes, auth changes, permissions
- performance: Optimizations, speed improvements
- incident: Outages, emergencies, hotfixes
- decision: ADRs, architecture decisions
- discussion: RFCs, proposals, design discussions
- release: Version releases, changelogs
- deployment: Deployments, shipping to production
- other: Doesn't fit other categories

RULES:
1. Choose ONE primary category that best fits
2. Add up to 3 secondary categories if clearly relevant
3. Extract up to 5 topic keywords from the content
4. Provide confidence (0.0-1.0) based on clarity of classification
5. For ambiguous cases (e.g., "refactor that fixes a bug"), choose the dominant intent

Classify this event.`;
}

/**
 * Fallback regex-based classification for when LLM is unavailable
 * or for low-priority events that don't warrant LLM cost.
 */
export function classifyObservationFallback(sourceEvent: SourceEvent): {
  primaryCategory: string;
  secondaryCategories: string[];
} {
  const text = `${sourceEvent.sourceType} ${sourceEvent.title} ${sourceEvent.body ?? ""}`.toLowerCase();

  // Priority-ordered patterns
  const patterns: Array<{ category: string; patterns: RegExp[] }> = [
    { category: "release", patterns: [/^release_/, /\brelease\b/i, /\bv\d+\.\d+/i] },
    { category: "deployment", patterns: [/^deployment\./, /\bdeploy/i, /\bshippe?d?\b/i] },
    { category: "security", patterns: [/\bsecurity\b/i, /\bCVE-\d+/i, /\bvulnerability\b/i] },
    { category: "incident", patterns: [/\bincident\b/i, /\boutage\b/i, /\bhotfix\b/i] },
    { category: "bug_fix", patterns: [/\bfix(es|ed|ing)?\b/i, /\bbug\b/i, /\bpatch\b/i] },
    { category: "feature", patterns: [/\bfeat(ure)?[:\s]/i, /\badd(s|ed|ing)?\b/i, /\bnew\b/i] },
    { category: "performance", patterns: [/\bperf(ormance)?\b/i, /\boptimiz/i] },
    { category: "testing", patterns: [/\btest(s|ing)?\b/i, /\bspec\b/i, /\bcoverage\b/i] },
    { category: "documentation", patterns: [/\bdocs?\b/i, /\breadme\b/i] },
    { category: "infrastructure", patterns: [/\bci\b/i, /\bcd\b/i, /\bpipeline\b/i, /\bdocker/i] },
    { category: "refactor", patterns: [/\brefactor/i, /\bcleanup\b/i, /\bchore\b/i] },
    { category: "discussion", patterns: [/^discussion_/, /\brfc\b/i, /\bproposal\b/i] },
    { category: "decision", patterns: [/\bdecision\b/i, /\badr\b/i] },
  ];

  let primaryCategory = "other";
  for (const { category, patterns: pats } of patterns) {
    if (pats.some((p) => p.test(text))) {
      primaryCategory = category;
      break;
    }
  }

  // Extract secondary categories (all matches except primary)
  const secondaryCategories = patterns
    .filter(({ category, patterns: pats }) =>
      category !== primaryCategory && pats.some((p) => p.test(text))
    )
    .map(({ category }) => category)
    .slice(0, 3);

  return { primaryCategory, secondaryCategories };
}
```

#### 3. Update Observation Capture Workflow

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

**Add imports** after existing imports (around line 30):

```typescript
import { generateObject, wrapLanguageModel } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { BraintrustMiddleware } from "braintrust";
import { classificationResponseSchema } from "@repo/console-validation";
import { buildClassificationPrompt, classifyObservationFallback } from "./classification";
```

**Replace the classification step** (around lines 536-550):

```typescript
// Step 5a: Classify observation with Claude Haiku
const classificationResult = await step.ai.wrap(
  "classify-observation",
  generateObject,
  {
    model: wrapLanguageModel({
      model: gateway("anthropic/claude-3-5-haiku-latest"),
      middleware: BraintrustMiddleware({ debug: false }),
    }),
    schema: classificationResponseSchema,
    prompt: buildClassificationPrompt(sourceEvent),
    temperature: 0.2,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "neural-classification",
      metadata: {
        context: "neural-workflow",
        workspaceId,
        sourceType: sourceEvent.sourceType,
        source: sourceEvent.source,
      },
    },
  } as any // Type cast required for generateObject overloads
).catch((error) => {
  // Fallback to regex-based classification on LLM failure
  log.warn("Classification LLM failed, using fallback", {
    error: String(error),
    sourceId: sourceEvent.sourceId,
  });
  const fallback = classifyObservationFallback(sourceEvent);
  return {
    object: {
      primaryCategory: fallback.primaryCategory,
      secondaryCategories: fallback.secondaryCategories,
      topics: [],
      confidence: 0.5,
      reasoning: "Fallback regex classification",
    },
  };
});

// Extract topics from keyword extraction + classification
const keywordTopics = extractTopics(sourceEvent);
const classification = classificationResult.object;

const topics = [
  ...keywordTopics,
  classification.primaryCategory,
  ...classification.secondaryCategories,
  ...classification.topics,
].filter((t, i, arr) => arr.indexOf(t) === i); // Deduplicate
```

**Note**: The parallel Promise.all block needs restructuring since step.ai.wrap() returns a Promise that integrates with Inngest's step system differently. You may need to run classification sequentially or use step.run() for the non-AI parallel operations.

#### 4. Add Configuration

**File**: `packages/console-config/src/neural.ts`

Add after existing config (around line 32):

```typescript
export const CLASSIFICATION_CONFIG = {
  /** Model for classification */
  model: "anthropic/claude-3-5-haiku-latest" as const,

  /** Temperature for classification (lower = more deterministic) */
  temperature: 0.2,

  /** Minimum confidence to trust LLM classification */
  minConfidence: 0.6,

  /** Use fallback regex for events below this significance score */
  fallbackThreshold: 30,
} as const;
```

### Success Criteria

#### Automated Verification:
- [x] Schema package builds: `pnpm --filter @repo/console-validation build`
- [x] Config package builds: `pnpm --filter @repo/console-config build`
- [x] API package builds: `pnpm --filter @api/console build`
- [x] Type checking passes: `pnpm --filter @api/console typecheck`

#### Manual Verification:
- [ ] New observations get LLM-classified categories
- [ ] Classification includes confidence scores
- [ ] Topics array includes LLM-extracted topics
- [ ] Braintrust shows `neural-classification` traces
- [ ] Fallback works when LLM is unavailable
- [ ] Classification quality is better than regex (spot check 10 events)

**Implementation Note**: After completing Phase 2 and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Tests and Evaluation Framework

### Overview

Add unit tests for classification and create a Braintrust evaluation for classification quality.

### Changes Required

#### 1. Classification Unit Tests

**File**: `api/console/src/inngest/workflow/neural/__tests__/classification.test.ts` (NEW)

```typescript
import { describe, it, expect } from "vitest";
import {
  buildClassificationPrompt,
  classifyObservationFallback,
} from "../classification";
import type { SourceEvent } from "@repo/console-types";

describe("classification", () => {
  describe("buildClassificationPrompt", () => {
    it("includes all event details", () => {
      const event: SourceEvent = {
        source: "github",
        sourceType: "pull-request.merged",
        sourceId: "pr:test/repo#123:merged",
        title: "feat: Add dark mode toggle",
        body: "This PR adds a dark mode toggle to the settings page.",
        occurredAt: "2025-12-17T10:00:00Z",
        actor: { id: "1", name: "test", email: "test@test.com" },
        references: [],
        metadata: {},
      };

      const prompt = buildClassificationPrompt(event);

      expect(prompt).toContain("github");
      expect(prompt).toContain("pull-request.merged");
      expect(prompt).toContain("feat: Add dark mode toggle");
      expect(prompt).toContain("dark mode toggle");
    });

    it("truncates long body content", () => {
      const longBody = "a".repeat(2000);
      const event: SourceEvent = {
        source: "github",
        sourceType: "push",
        sourceId: "push:test",
        title: "Test",
        body: longBody,
        occurredAt: "2025-12-17T10:00:00Z",
        actor: { id: "1", name: "test", email: "test@test.com" },
        references: [],
        metadata: {},
      };

      const prompt = buildClassificationPrompt(event);

      // Should truncate to 1000 chars
      expect(prompt.length).toBeLessThan(longBody.length + 500);
    });
  });

  describe("classifyObservationFallback", () => {
    it("classifies bug fixes", () => {
      const event: SourceEvent = {
        source: "github",
        sourceType: "pull-request.merged",
        sourceId: "pr:test",
        title: "fix: Resolve memory leak in worker",
        body: "",
        occurredAt: "2025-12-17T10:00:00Z",
        actor: { id: "1", name: "test", email: "test@test.com" },
        references: [],
        metadata: {},
      };

      const result = classifyObservationFallback(event);

      expect(result.primaryCategory).toBe("bug_fix");
    });

    it("classifies features", () => {
      const event: SourceEvent = {
        source: "github",
        sourceType: "pull-request.merged",
        sourceId: "pr:test",
        title: "feat: Add user authentication",
        body: "",
        occurredAt: "2025-12-17T10:00:00Z",
        actor: { id: "1", name: "test", email: "test@test.com" },
        references: [],
        metadata: {},
      };

      const result = classifyObservationFallback(event);

      expect(result.primaryCategory).toBe("feature");
    });

    it("classifies security with high priority", () => {
      const event: SourceEvent = {
        source: "github",
        sourceType: "pull-request.merged",
        sourceId: "pr:test",
        title: "fix: Security vulnerability CVE-2025-1234",
        body: "",
        occurredAt: "2025-12-17T10:00:00Z",
        actor: { id: "1", name: "test", email: "test@test.com" },
        references: [],
        metadata: {},
      };

      const result = classifyObservationFallback(event);

      // Security should take priority over bug_fix
      expect(result.primaryCategory).toBe("security");
    });

    it("returns other for unclassifiable events", () => {
      const event: SourceEvent = {
        source: "github",
        sourceType: "unknown",
        sourceId: "unknown:test",
        title: "misc changes",
        body: "",
        occurredAt: "2025-12-17T10:00:00Z",
        actor: { id: "1", name: "test", email: "test@test.com" },
        references: [],
        metadata: {},
      };

      const result = classifyObservationFallback(event);

      expect(result.primaryCategory).toBe("other");
    });
  });
});
```

#### 2. Braintrust Evaluation for Classification

**File**: `api/console/src/eval/classification.eval.ts` (NEW)

```typescript
/**
 * Classification Quality Evaluation
 *
 * Tests Claude Haiku classification against labeled examples
 * to measure accuracy and identify edge cases.
 */

import { Eval, initLogger } from "braintrust";
import { generateObject, wrapLanguageModel } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { BraintrustMiddleware } from "braintrust";
import { z } from "zod";

import { getBraintrustConfig } from "@repo/ai/braintrust-env";
import { classificationResponseSchema } from "@repo/console-validation";
import { buildClassificationPrompt } from "../inngest/workflow/neural/classification";
import type { SourceEvent } from "@repo/console-types";

const braintrustConfig = getBraintrustConfig();

initLogger({
  apiKey: braintrustConfig.apiKey,
  projectName: braintrustConfig.projectName || "lightfast-console",
});

// Test cases with expected classifications
const TEST_CASES: Array<{
  event: SourceEvent;
  expected: { primaryCategory: string; keywords: string[] };
}> = [
  {
    event: {
      source: "github",
      sourceType: "pull-request.merged",
      sourceId: "pr:test/repo#1:merged",
      title: "fix: Memory leak in connection pool",
      body: "Fixes a memory leak that occurred when connections were not properly released.",
      occurredAt: "2025-12-17T10:00:00Z",
      actor: { id: "1", name: "dev", email: "dev@test.com" },
      references: [],
      metadata: {},
    },
    expected: { primaryCategory: "bug_fix", keywords: ["memory", "connection"] },
  },
  {
    event: {
      source: "github",
      sourceType: "pull-request.merged",
      sourceId: "pr:test/repo#2:merged",
      title: "feat: Add dark mode support",
      body: "Implements dark mode theme toggle in settings with system preference detection.",
      occurredAt: "2025-12-17T10:00:00Z",
      actor: { id: "1", name: "dev", email: "dev@test.com" },
      references: [],
      metadata: {},
    },
    expected: { primaryCategory: "feature", keywords: ["dark mode", "theme"] },
  },
  {
    event: {
      source: "github",
      sourceType: "pull-request.merged",
      sourceId: "pr:test/repo#3:merged",
      title: "security: Patch XSS vulnerability in user input",
      body: "Sanitizes user input to prevent cross-site scripting attacks. CVE-2025-0001.",
      occurredAt: "2025-12-17T10:00:00Z",
      actor: { id: "1", name: "dev", email: "dev@test.com" },
      references: [],
      metadata: {},
    },
    expected: { primaryCategory: "security", keywords: ["XSS", "CVE"] },
  },
  // Ambiguous case: refactor that fixes a bug
  {
    event: {
      source: "github",
      sourceType: "pull-request.merged",
      sourceId: "pr:test/repo#4:merged",
      title: "refactor: Restructure auth module to fix race condition",
      body: "Refactors the authentication module. This also fixes a race condition bug.",
      occurredAt: "2025-12-17T10:00:00Z",
      actor: { id: "1", name: "dev", email: "dev@test.com" },
      references: [],
      metadata: {},
    },
    expected: { primaryCategory: "refactor", keywords: ["auth", "race condition"] },
  },
];

async function classifyEvent(event: SourceEvent) {
  const result = await generateObject({
    model: wrapLanguageModel({
      model: gateway("anthropic/claude-3-5-haiku-latest"),
      middleware: BraintrustMiddleware({ debug: true }),
    }),
    schema: classificationResponseSchema,
    prompt: buildClassificationPrompt(event),
    temperature: 0.2,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "classification-eval",
      metadata: { context: "experiment" },
    },
  });

  return result.object;
}

void Eval(braintrustConfig.projectName || "lightfast-console", {
  experimentName: "neural-classification-quality",
  data: TEST_CASES.map((tc) => ({
    input: tc.event,
    expected: tc.expected,
  })),
  task: async (input: SourceEvent) => {
    return classifyEvent(input);
  },
  scores: [
    // Primary category accuracy
    {
      name: "primary_category_match",
      scorer: ({ output, expected }) => {
        return output.primaryCategory === expected.primaryCategory ? 1 : 0;
      },
    },
    // Keyword coverage
    {
      name: "keyword_coverage",
      scorer: ({ output, expected }) => {
        const allTopics = [
          ...output.topics,
          ...output.secondaryCategories,
        ].map((t) => t.toLowerCase());
        const matches = expected.keywords.filter((k) =>
          allTopics.some((t) => t.includes(k.toLowerCase()))
        );
        return matches.length / expected.keywords.length;
      },
    },
    // Confidence reasonableness
    {
      name: "confidence_reasonable",
      scorer: ({ output }) => {
        // Penalize extreme confidence (too high or too low)
        if (output.confidence > 0.95) return 0.8;
        if (output.confidence < 0.3) return 0.5;
        return 1;
      },
    },
  ],
});
```

### Success Criteria

#### Automated Verification:
- [ ] Unit tests pass: `pnpm --filter @api/console test`
- [ ] Evaluation runs: `pnpm --filter @api/console eval:classification`
- [ ] Primary category accuracy > 80%
- [ ] Keyword coverage > 60%

#### Manual Verification:
- [ ] Review Braintrust evaluation dashboard for edge cases
- [ ] Verify ambiguous cases are handled reasonably
- [ ] Check that confidence scores correlate with actual accuracy

---

## Testing Strategy

### Unit Tests
- `classification.test.ts` - Prompt building and fallback logic
- Mock LLM responses for deterministic testing

### Integration Tests
- Braintrust evaluations for classification quality
- End-to-end observation capture with real LLM calls (staging)

### Manual Testing Steps
1. Trigger a GitHub webhook event (push or PR merge)
2. Verify observation appears in database with LLM classification
3. Check Inngest dashboard for AI step metrics
4. Check Braintrust dashboard for trace details
5. Compare classification quality to regex baseline

## Performance Considerations

- **Latency**: Claude Haiku adds ~200-500ms per classification
- **Cost**: ~$0.0001 per classification (Haiku pricing)
- **Fallback**: Regex classification available if LLM fails or is too slow
- **Caching**: Consider caching classifications for identical event types

## Migration Notes

- Phase 1 is backward-compatible (same models, just observability)
- Phase 2 changes classification output (adds confidence, reasoning)
- Database schema unchanged (topics column already stores array)
- Rollback: Revert to regex classification by reverting code changes

## References

- Research: `thoughts/shared/research/2025-12-17-neural-observations-end-to-end-solution.md`
- Inngest step.ai docs: https://www.inngest.com/docs/features/inngest-functions/steps-workflows/step-ai-orchestration
- Braintrust middleware: `apps/chat/src/app/(chat)/(ai)/api/v/[...v]/route.ts:561-564`
- Classification types: `api/console/src/inngest/workflow/neural/classification.ts:32-51`
