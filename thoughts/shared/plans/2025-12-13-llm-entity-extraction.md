# LLM Entity Extraction Implementation Plan

## Overview

Add LLM-based entity extraction to the neural memory system to complement the existing rule-based (regex) extraction. LLM extraction will identify complex, contextual entities that regex patterns cannot catch, such as implied relationships, technical concepts, and service names mentioned in prose.

## Current State Analysis

### Existing Implementation

**Rule-based extraction** is fully implemented in `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts`:
- 8 regex patterns covering: endpoints, issues, mentions, env vars, file paths, commits, branches
- Runs inline during observation capture at `observation-capture.ts:412-433`
- Entities used for cluster assignment (entity overlap scoring: 0-30 points)
- Stored transactionally with observations

**LLM patterns available** for reference:
- Cluster summary: `cluster-summary.ts:139-155` - `generateObject()` with Zod schema
- LLM filter: `llm-filter.ts:97-103` - scoring with fallback pattern
- Classification: `classification.ts:22` - documented migration path

### Key Discoveries

- Design spec calls for LLM extraction when `content.length > 200` (`docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md:750`)
- Entity deduplication uses composite key `(workspaceId, category, key)` - `workspace-neural-entities.ts:130-134`
- Existing fire-and-forget patterns: `profile-update.ts`, `cluster-summary.ts`
- Entity storage uses upsert with occurrence counting on conflict - `observation-capture.ts:585-596`

## Desired End State

After implementation:
1. Observations with `content.length > 200` trigger async LLM entity extraction
2. LLM extracts contextual entities that regex cannot catch (service names, technical concepts, implied references)
3. LLM entities are stored in the same `workspace_neural_entities` table with appropriate confidence scores
4. LLM entities enhance search recall without blocking the main pipeline
5. Deduplication works correctly between regex and LLM extracted entities

### Verification Criteria
- LLM extraction workflow triggers for qualifying observations
- Extracted entities appear in entity search results
- No regression in observation capture latency
- Proper error handling with graceful degradation

## What We're NOT Doing

1. **Fuzzy entity search (ILIKE queries)** - separate feature
2. **Alias search** - separate feature
3. **Entity relationship extraction** - future enhancement
4. **Replacing regex extraction** - LLM complements, doesn't replace
5. **Profile embeddings** - separate V2 feature
6. **View-specific retrieval** - out of scope

## Implementation Approach

Use **fire-and-forget workflow pattern** (Option B) to avoid blocking the main observation capture pipeline. This follows the same pattern as `profile-update.ts` and `cluster-summary.ts`.

**Model**: `gateway("openai/gpt-5.1-instant")` - fast and cost-effective
**Confidence**: LLM reports its own confidence (0.0-1.0), filtered at 0.65 minimum
**Trigger**: Content length > 200 characters

---

## Phase 1: Type Definitions and Schema

### Overview
Define the Zod schema for LLM entity extraction output and add configuration constants.

### Changes Required:

#### 1. Add LLM Entity Extraction Schema
**File**: `packages/console-validation/src/schemas/entities.ts`
**Changes**: Add schema for LLM extraction response

```typescript
// After existing entityCategorySchema (line 17)

/**
 * Schema for LLM entity extraction response
 *
 * LLM extracts contextual entities that regex cannot catch:
 * - Service names mentioned in prose (e.g., "deployed to Vercel")
 * - Technical concepts and frameworks (e.g., "using React Query")
 * - Implicit engineer references (e.g., "John fixed the bug")
 * - Project/feature references without standard format
 *
 * Future enhancements could include:
 * - Entity relationships (e.g., "X depends on Y")
 * - Sentiment/status inference (e.g., "auth is broken")
 * - Temporal context (e.g., "last week's deployment")
 */
export const llmExtractedEntitySchema = z.object({
  category: entityCategorySchema.describe("Entity category"),
  key: z.string().max(500).describe("Canonical entity identifier"),
  value: z.string().optional().describe("Human-readable description"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Extraction confidence from 0.0 (uncertain) to 1.0 (certain)"),
  reasoning: z
    .string()
    .max(200)
    .optional()
    .describe("Brief explanation of why this entity was extracted"),
});

export const llmEntityExtractionResponseSchema = z.object({
  entities: z
    .array(llmExtractedEntitySchema)
    .max(15)
    .describe("Extracted entities from the observation content"),
});

export type LLMExtractedEntity = z.infer<typeof llmExtractedEntitySchema>;
export type LLMEntityExtractionResponse = z.infer<typeof llmEntityExtractionResponseSchema>;
```

#### 2. Add Configuration Constants
**File**: `packages/console-config/src/neural.ts` (create if doesn't exist, or add to existing config)
**Changes**: Add LLM entity extraction configuration

```typescript
/**
 * LLM Entity Extraction Configuration
 */
export const LLM_ENTITY_EXTRACTION_CONFIG = {
  /** Minimum content length (chars) to trigger LLM extraction */
  minContentLength: 200,

  /** Minimum confidence threshold for accepting LLM entities */
  minConfidence: 0.65,

  /** Maximum entities to extract per observation */
  maxEntities: 15,

  /** Model temperature for consistent extraction */
  temperature: 0.2,

  /** Debounce window to prevent duplicate processing (ms) */
  debounceMs: 60_000, // 1 minute
} as const;
```

#### 3. Export Types from console-types
**File**: `packages/console-types/src/neural/entity.ts`
**Changes**: Re-export LLM entity types

```typescript
// Add after existing exports (line 39)

// Re-export LLM entity extraction types
export type {
  LLMExtractedEntity,
  LLMEntityExtractionResponse,
} from "@repo/console-validation";
```

### Success Criteria:

#### Automated Verification:
- [x] Types compile: `pnpm --filter @repo/console-validation typecheck`
- [x] Types compile: `pnpm --filter @repo/console-types typecheck`
- [x] Config compiles: `pnpm --filter @repo/console-config typecheck`
- [ ] Lint passes: `pnpm lint`

#### Manual Verification:
- [ ] Types are importable from `@repo/console-validation`
- [ ] Types are importable from `@repo/console-types`
- [ ] Config constants are accessible from `@repo/console-config`

---

## Phase 2: LLM Entity Extraction Module

### Overview
Create the core LLM extraction function following the `generateObject()` pattern from `cluster-summary.ts`.

### Changes Required:

#### 1. Create LLM Entity Extraction Module
**File**: `api/console/src/inngest/workflow/neural/llm-entity-extraction.ts`
**Changes**: New file with extraction logic

```typescript
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { log } from "@repo/observability/log";
import {
  llmEntityExtractionResponseSchema,
  type LLMExtractedEntity,
} from "@repo/console-validation";
import { LLM_ENTITY_EXTRACTION_CONFIG } from "@repo/console-config";
import type { ExtractedEntity } from "@repo/console-types";

/**
 * Build the prompt for LLM entity extraction
 */
function buildExtractionPrompt(title: string, content: string): string {
  return `Extract structured entities from this engineering observation.

OBSERVATION TITLE:
${title}

OBSERVATION CONTENT:
${content}

ENTITY CATEGORIES:
- engineer: Team members, contributors (look for names, usernames, or implied people like "Sarah fixed...")
- project: Features, initiatives, repos, tickets (look for project names, feature references)
- endpoint: API routes mentioned in prose (e.g., "the users endpoint")
- config: Configuration values, settings (e.g., "increased the timeout to 30s")
- definition: Technical terms, code concepts (e.g., "the useAuth hook")
- service: External services, dependencies (e.g., "deployed to Vercel", "using Stripe")
- reference: Generic references like deployments, releases

GUIDELINES:
- Only extract entities that are CLEARLY mentioned or strongly implied
- Use canonical forms for keys (lowercase, hyphenated for multi-word)
- Be conservative - prefer fewer high-confidence entities over many uncertain ones
- Skip entities that would be caught by standard patterns (#123, @mentions, file paths)
- Focus on contextual/semantic entities that require understanding

Return entities with confidence scores reflecting how certain you are about the extraction.`;
}

/**
 * Extract entities from observation content using LLM
 *
 * This complements rule-based extraction by identifying contextual entities
 * that regex patterns cannot catch. Examples:
 * - "Deployed the auth service to production" → service: auth-service
 * - "Sarah and John reviewed the PR" → engineer: sarah, engineer: john
 * - "Using the new caching layer" → definition: caching-layer
 *
 * Future enhancements could include:
 * - Entity relationship extraction ("X depends on Y")
 * - Sentiment analysis ("auth is broken" → status inference)
 * - Temporal context extraction ("last week's deployment")
 */
export async function extractEntitiesWithLLM(
  title: string,
  content: string,
  options?: {
    observationId?: string;
    requestId?: string;
  }
): Promise<ExtractedEntity[]> {
  const { observationId, requestId } = options ?? {};
  const config = LLM_ENTITY_EXTRACTION_CONFIG;

  // Check content length threshold
  if (content.length < config.minContentLength) {
    log.debug("LLM entity extraction skipped - content too short", {
      requestId,
      observationId,
      contentLength: content.length,
      threshold: config.minContentLength,
    });
    return [];
  }

  const startTime = Date.now();

  try {
    const { object } = await generateObject({
      model: gateway("openai/gpt-5.1-instant"),
      schema: llmEntityExtractionResponseSchema,
      prompt: buildExtractionPrompt(title, content),
      temperature: config.temperature,
    });

    const latency = Date.now() - startTime;

    // Filter by confidence threshold and convert to ExtractedEntity format
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
      requestId,
      observationId,
      rawCount: object.entities.length,
      filteredCount: entities.length,
      latency,
    });

    return entities;
  } catch (error) {
    const latency = Date.now() - startTime;

    log.error("LLM entity extraction failed", {
      requestId,
      observationId,
      error,
      latency,
    });

    // Graceful degradation - return empty array on failure
    return [];
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] Module compiles: `pnpm --filter @api/console typecheck`
- [x] Lint passes: `pnpm --filter @api/console lint`

#### Manual Verification:
- [ ] Function is importable from the module
- [ ] Prompt is well-structured for entity extraction

---

## Phase 3: Fire-and-Forget Workflow

### Overview
Create an Inngest workflow that runs LLM entity extraction asynchronously, triggered after observation capture.

### Changes Required:

#### 1. Create LLM Entity Extraction Workflow
**File**: `api/console/src/inngest/workflow/neural/llm-entity-extraction-workflow.ts`
**Changes**: New Inngest workflow file

```typescript
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@db/console";
import { workspaceNeuralEntities, workspaceNeuralObservations } from "@db/console/schema";
import { log } from "@repo/observability/log";
import { inngest } from "../../client";
import { extractEntitiesWithLLM } from "./llm-entity-extraction";
import { LLM_ENTITY_EXTRACTION_CONFIG } from "@repo/console-config";

/**
 * LLM Entity Extraction Workflow
 *
 * Fire-and-forget workflow that extracts contextual entities from observations
 * using LLM. Triggered after observation capture for qualifying observations.
 *
 * This complements rule-based extraction without blocking the main pipeline.
 */
export const llmEntityExtractionWorkflow = inngest.createFunction(
  {
    id: "neural-llm-entity-extraction",
    name: "Neural: LLM Entity Extraction",
    retries: 2,
    debounce: {
      key: "event.data.observationId",
      period: `${LLM_ENTITY_EXTRACTION_CONFIG.debounceMs}ms`,
    },
  },
  { event: "neural/llm-entity-extraction.requested" },
  async ({ event, step }) => {
    const { observationId, workspaceId } = event.data;
    const requestId = event.id;

    // Step 1: Fetch observation content
    const observation = await step.run("fetch-observation", async () => {
      const [obs] = await db
        .select({
          id: workspaceNeuralObservations.id,
          title: workspaceNeuralObservations.title,
          body: workspaceNeuralObservations.body,
        })
        .from(workspaceNeuralObservations)
        .where(eq(workspaceNeuralObservations.id, observationId))
        .limit(1);

      return obs ?? null;
    });

    if (!observation) {
      log.warn("LLM entity extraction skipped - observation not found", {
        requestId,
        observationId,
      });
      return { status: "skipped", reason: "observation_not_found" };
    }

    // Step 2: Extract entities with LLM
    const llmEntities = await step.run("extract-entities-llm", async () => {
      return await extractEntitiesWithLLM(
        observation.title,
        observation.body ?? "",
        { observationId, requestId }
      );
    });

    if (llmEntities.length === 0) {
      log.info("LLM entity extraction completed - no entities found", {
        requestId,
        observationId,
      });
      return { status: "completed", entitiesExtracted: 0 };
    }

    // Step 3: Store entities (upsert pattern)
    const storedCount = await step.run("store-entities", async () => {
      let count = 0;

      for (const entity of llmEntities) {
        try {
          await db
            .insert(workspaceNeuralEntities)
            .values({
              workspaceId,
              category: entity.category,
              key: entity.key,
              value: entity.value,
              sourceObservationId: observationId,
              evidenceSnippet: entity.evidence,
              confidence: entity.confidence,
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
                updatedAt: new Date().toISOString(),
                // Update confidence if LLM is more confident
                confidence: sql`GREATEST(${workspaceNeuralEntities.confidence}, ${entity.confidence})`,
              },
            });
          count++;
        } catch (error) {
          log.error("Failed to store LLM entity", {
            requestId,
            observationId,
            entity,
            error,
          });
        }
      }

      return count;
    });

    log.info("LLM entity extraction workflow completed", {
      requestId,
      observationId,
      entitiesExtracted: llmEntities.length,
      entitiesStored: storedCount,
    });

    return {
      status: "completed",
      entitiesExtracted: llmEntities.length,
      entitiesStored: storedCount,
    };
  }
);
```

#### 2. Register Workflow in Inngest Client
**File**: `api/console/src/inngest/functions.ts` (or wherever workflows are registered)
**Changes**: Add the new workflow to exports

```typescript
// Add import
import { llmEntityExtractionWorkflow } from "./workflow/neural/llm-entity-extraction-workflow";

// Add to exports array
export const functions = [
  // ... existing functions
  llmEntityExtractionWorkflow,
];
```

#### 3. Define Event Type
**File**: `api/console/src/inngest/events.ts` (or event definitions file)
**Changes**: Add event type for LLM entity extraction

```typescript
// Add to neural events
"neural/llm-entity-extraction.requested": {
  data: {
    observationId: string;
    workspaceId: string;
  };
};
```

### Success Criteria:

#### Automated Verification:
- [x] Workflow compiles: `pnpm --filter @api/console typecheck`
- [x] Lint passes: `pnpm --filter @api/console lint`
- [x] Build succeeds: `pnpm --filter @api/console build`

#### Manual Verification:
- [ ] Workflow appears in Inngest dashboard
- [ ] Event type is properly typed

---

## Phase 4: Trigger Integration

### Overview
Add the trigger in observation-capture.ts to fire the LLM entity extraction event for qualifying observations.

### Changes Required:

#### 1. Add LLM Entity Extraction Trigger
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Changes**: Add step.sendEvent after observation storage for qualifying observations

Find the section after transactional storage (around line 610-650 where other fire-and-forget events are sent) and add:

```typescript
// After the existing fire-and-forget events (profile-update, cluster-summary)

// Step 8: Trigger LLM entity extraction for qualifying observations
if ((sourceEvent.body?.length ?? 0) > 200) {
  await step.sendEvent("trigger-llm-entity-extraction", {
    name: "neural/llm-entity-extraction.requested",
    data: {
      observationId: observation.id,
      workspaceId,
    },
  });
}
```

### Success Criteria:

#### Automated Verification:
- [x] Pipeline compiles: `pnpm --filter @api/console typecheck`
- [x] Lint passes: `pnpm --filter @api/console lint`
- [x] Build succeeds: `pnpm --filter @api/console build`

#### Manual Verification:
- [ ] Observation capture still works for short content (no LLM trigger)
- [ ] LLM extraction event fires for content > 200 chars
- [ ] Workflow executes and stores entities

---

## Phase 5: Testing and Verification

### Overview
Add tests and verify the complete flow works end-to-end.

### Changes Required:

#### 1. Unit Test for LLM Extraction Module
**File**: `api/console/src/inngest/workflow/neural/__tests__/llm-entity-extraction.test.ts`
**Changes**: New test file

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractEntitiesWithLLM } from "../llm-entity-extraction";

// Mock the AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

describe("extractEntitiesWithLLM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip extraction for short content", async () => {
    const result = await extractEntitiesWithLLM("Test title", "Short content");
    expect(result).toEqual([]);
  });

  it("should extract entities from long content", async () => {
    const { generateObject } = await import("ai");
    (generateObject as any).mockResolvedValueOnce({
      object: {
        entities: [
          {
            category: "service",
            key: "vercel",
            value: "Deployment platform",
            confidence: 0.85,
            reasoning: "Mentioned as deployment target",
          },
        ],
      },
    });

    const longContent = "A".repeat(250) + " deployed to Vercel";
    const result = await extractEntitiesWithLLM("Deployment update", longContent);

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("service");
    expect(result[0].key).toBe("vercel");
  });

  it("should filter low-confidence entities", async () => {
    const { generateObject } = await import("ai");
    (generateObject as any).mockResolvedValueOnce({
      object: {
        entities: [
          { category: "service", key: "maybe-service", confidence: 0.4 },
          { category: "service", key: "definitely-service", confidence: 0.9 },
        ],
      },
    });

    const longContent = "A".repeat(250);
    const result = await extractEntitiesWithLLM("Test", longContent);

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("definitely-service");
  });

  it("should handle errors gracefully", async () => {
    const { generateObject } = await import("ai");
    (generateObject as any).mockRejectedValueOnce(new Error("API error"));

    const longContent = "A".repeat(250);
    const result = await extractEntitiesWithLLM("Test", longContent);

    expect(result).toEqual([]);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] All type checks pass: `pnpm --filter @api/console typecheck`
- [x] Build succeeds: `pnpm --filter @api/console build`
- [ ] Tests pass: `pnpm --filter @api/console test` (skipped - no test infrastructure in api/console)

#### Manual Verification:
- [ ] Trigger a webhook with long content (>200 chars)
- [ ] Verify LLM entity extraction workflow runs in Inngest dashboard
- [ ] Verify entities appear in database
- [ ] Verify entities appear in search results
- [ ] Verify no regression in observation capture latency

---

## Testing Strategy

### Unit Tests
- LLM extraction module: content threshold, confidence filtering, error handling
- Schema validation: entity structure, confidence bounds

### Integration Tests
- Workflow execution: event trigger → LLM call → entity storage
- Deduplication: LLM entity matching existing regex entity

### Manual Testing Steps
1. Create a GitHub issue with >200 chars of content mentioning services/people
2. Verify observation is captured (existing flow)
3. Verify LLM entity extraction workflow triggers (Inngest dashboard)
4. Query entities table to verify LLM entities stored
5. Search for the extracted entities to verify retrieval

## Performance Considerations

1. **Latency**: LLM extraction is fire-and-forget, doesn't block main pipeline
2. **Cost**: Using `gpt-5.1-instant` for cost-effectiveness (~$0.001 per extraction)
3. **Debouncing**: 1-minute debounce prevents duplicate processing for rapid updates
4. **Rate limiting**: Inngest handles retries (max 2) with backoff

## Migration Notes

No database migration required - uses existing `workspace_neural_entities` table.

## References

- Original design spec: `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md:743-756`
- LLM pattern reference: `api/console/src/inngest/workflow/neural/cluster-summary.ts:139-155`
- Entity extraction patterns: `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts`
- Gap analysis: `thoughts/shared/research/2025-12-13-neural-memory-v1-gap-analysis.md`
- LLM integration research: `thoughts/shared/research/2025-12-13-llm-entity-extraction-integration.md`
