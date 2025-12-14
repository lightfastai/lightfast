---
date: 2025-12-13T03:16:19Z
researcher: Claude
git_commit: 014045bb15a6b1a4274cf15ac024bbc297615a18
branch: feat/memory-layer-foundation
repository: lightfast
topic: "LLM Entity Extraction Integration for Neural Memory"
tags: [research, codebase, neural-memory, entity-extraction, llm, patterns]
status: complete
last_updated: 2025-12-13
last_updated_by: Claude
---

# Research: LLM Entity Extraction Integration for Neural Memory

**Date**: 2025-12-13T03:16:19Z
**Researcher**: Claude
**Git Commit**: 014045bb15a6b1a4274cf15ac024bbc297615a18
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Research the integration of LLM entity extraction as outlined in the neural memory e2e design document (`docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md`).

## Summary

The neural memory e2e design document specifies a hybrid entity extraction approach combining rule-based (regex) patterns with LLM-based extraction for complex entities. The current codebase implementation is **pattern-based only** - using regex patterns with confidence scores. LLM-based extraction patterns exist elsewhere in the codebase (cluster summaries, relevance filtering, chat features) that can serve as templates for future LLM entity extraction integration.

## Detailed Findings

### 1. Current Entity Extraction Implementation

The entity extraction system is implemented in `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts` using pure regex pattern matching.

**Core Function**: `extractEntities(title: string, content: string): ExtractedEntity[]`

**Location**: `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:1-211`

**Extraction Patterns**:

| Pattern Type | Category | Confidence | Example |
|-------------|----------|-----------|---------|
| API Endpoints | endpoint | 0.95 | `POST /api/users` |
| GitHub Issues | project | 0.95 | `#123` |
| Linear/Jira | project | 0.90 | `ENG-456` |
| @mentions | engineer | 0.90 | `@sarah` |
| Env Variables | config | 0.85 | `DATABASE_URL` |
| File Paths | definition | 0.80 | `src/lib/auth.ts` |
| Git Commits | reference | 0.70 | `abc1234` (7+ chars) |
| Branches | reference | 0.75 | `branch:main` |

**Key Implementation Details**:
- Runs inline during observation capture (not as separate workflow)
- Deduplication by (category, key) composite
- Blacklist filtering for common false positives
- Evidence snippet extraction with surrounding context
- No LLM calls currently

### 2. Design Document vs. Implementation Gap

The e2e design document (`docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md:743-756`) specifies:

```typescript
async function extractEntities(observation: Observation): Promise<Entity[]> {
  const entities: Entity[] = [];

  // Rule-based extraction (fast, high confidence)
  entities.push(...extractRuleBasedEntities(observation));

  // LLM-based extraction (for complex entities)
  if (observation.content.length > 200) {
    const llmEntities = await extractLLMEntities(observation);
    entities.push(...llmEntities);
  }

  return deduplicateEntities(entities);
}
```

**Current Implementation**:
- Rule-based extraction (implemented)
- LLM-based extraction (not implemented - design only)

### 3. LLM Patterns Available in Codebase

Several LLM extraction patterns exist that can serve as templates:

#### Pattern A: Structured Object Extraction with `generateObject()`

**Location**: `api/console/src/inngest/workflow/neural/cluster-summary.ts:16-182`

```typescript
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";

const clusterSummarySchema = z.object({
  summary: z.string().max(500),
  keyTopics: z.array(z.string()).max(5),
  keyContributors: z.array(z.string()).max(5),
  status: z.enum(["active", "completed", "stalled"]),
});

const { object } = await generateObject({
  model: gateway("openai/gpt-4.1-mini"),
  schema: clusterSummarySchema,
  prompt: `...`,
  temperature: 0.3,
});
```

#### Pattern B: Relevance Scoring with Combined Scores

**Location**: `apps/console/src/lib/neural/llm-filter.ts:1-194`

```typescript
const relevanceScoreSchema = z.object({
  scores: z.array(
    z.object({
      id: z.string(),
      relevance: z.number().min(0).max(1),
    })
  ),
});

const { object } = await generateObject({
  model: gateway("openai/gpt-5.1-instant"),
  schema: relevanceScoreSchema,
  prompt: buildRelevancePrompt(query, candidates),
  temperature: 0.1,
});
```

#### Pattern C: Documented Migration Path

**Location**: `api/console/src/inngest/workflow/neural/classification.ts:1-186`

```typescript
/**
 * TODO (Future Enhancement): Replace with LLM-based classification using
 * Claude Haiku for semantic understanding. The LLM approach would:
 * - Understand intent beyond keyword matching
 * - Handle ambiguous cases
 * - Provide confidence scores
 *
 * Example future implementation:
 * ```typescript
 * const { object } = await generateObject({
 *   model: anthropic("claude-3-5-haiku-latest"),
 *   schema: classificationSchema,
 *   prompt: `Classify this event: ${sourceEvent.title}`,
 * });
 * ```
 */
```

### 4. Pipeline Integration Points

Entity extraction integrates into the observation capture pipeline:

**Workflow**: `api/console/src/inngest/workflow/neural/observation-capture.ts:414-416`

```typescript
// Step 5: PARALLEL PROCESSING
const [embeddings, entities, clusterAssignment] = await Promise.all([
  step.run("generate-embeddings", async () => {...}),
  step.run("extract-entities", async () => {
    return await extractEntities(title, content);
  }),
  step.run("assign-cluster", async () => {...}),
]);
```

**Storage**: Entities stored in `workspace_neural_entities` table via UPSERT with occurrence counting.

### 5. Entity Store Schema

**Table**: `db/console/src/schema/tables/workspace-neural-entities.ts`

```sql
CREATE TABLE workspace_neural_entities (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,
  store_id VARCHAR(191) NOT NULL,
  category VARCHAR(50) NOT NULL,
  key VARCHAR(500) NOT NULL,
  value TEXT NOT NULL,
  aliases JSONB,
  source_observation_id VARCHAR(191),
  evidence_snippet TEXT,
  confidence FLOAT DEFAULT 0.8,
  extracted_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,
  CONSTRAINT uq_entity_key UNIQUE (workspace_id, category, key)
);
```

### 6. Entity Search Integration

**Location**: `apps/console/src/lib/neural/entity-search.ts`

Entity search runs in parallel with vector search in the hybrid retrieval path:

```typescript
// From search API route (line 324)
const [vectorCandidates, entityMatches, clusterMatches, actorMatches] =
  await Promise.all([
    searchObservationVectors(...),
    searchByEntities(workspaceId, query),
    findRelevantClusters(...),
    matchActorProfiles(...),
  ]);
```

### 7. Type Definitions

**Location**: `packages/console-types/src/neural/entity.ts`

```typescript
interface ExtractedEntity {
  category: EntityCategory;
  key: string;
  value?: string;
  aliases?: string[];
  confidence: number;
  evidence?: string;
}

type EntityCategory =
  | 'engineer'
  | 'project'
  | 'endpoint'
  | 'config'
  | 'definition'
  | 'service'
  | 'reference';
```

**Validation Schema**: `packages/console-validation/src/schemas/entities.ts`

## Code References

- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:1-211` - Pattern-based extraction implementation
- `api/console/src/inngest/workflow/neural/observation-capture.ts:414-416` - Pipeline integration point
- `api/console/src/inngest/workflow/neural/cluster-summary.ts:16-182` - LLM structured extraction example
- `apps/console/src/lib/neural/llm-filter.ts:1-194` - LLM relevance scoring pattern
- `api/console/src/inngest/workflow/neural/classification.ts:1-186` - Documented LLM migration path
- `apps/console/src/lib/neural/entity-search.ts:1-150` - Entity search implementation
- `db/console/src/schema/tables/workspace-neural-entities.ts:1-158` - Entity storage schema
- `packages/console-types/src/neural/entity.ts:1-30` - Entity type definitions

## Architecture Documentation

### Current Entity Extraction Flow

```
SourceEvent → observation-capture.ts
                    ↓
            extractEntities(title, content)
                    ↓
            [Pattern Matching via Regex]
                    ↓
            ExtractedEntity[] with confidence scores
                    ↓
            Deduplication by (category, key)
                    ↓
            UPSERT to workspace_neural_entities
```

### Designed LLM Entity Extraction Flow (Not Yet Implemented)

```
SourceEvent → observation-capture.ts
                    ↓
            extractEntities(observation)
                    ↓
    ┌───────────────┴───────────────┐
    ↓                               ↓
extractRuleBasedEntities()   extractLLMEntities()
(current patterns)           (if content.length > 200)
    ↓                               ↓
    └───────────┬───────────────────┘
                ↓
        deduplicateEntities()
                ↓
        ExtractedEntity[]
```

### LLM Integration Patterns in Codebase

| Pattern | Use Case | Model | SDK |
|---------|----------|-------|-----|
| `generateObject()` | Structured extraction | gpt-4.1-mini | ai |
| `generateObject()` | Relevance scoring | gpt-5.1-instant | ai |
| `generateText()` | Title generation | gpt-5-nano | ai |
| `streamObject()` | Real-time code gen | gpt-4o-mini | ai |
| Gateway routing | Provider abstraction | Multiple | @ai-sdk/gateway |

## Historical Context (from thoughts/)

The neural memory system follows a day-by-day implementation progression:

- `thoughts/shared/plans/2025-12-11-neural-memory-day1-observations-in.md` - Day 1: Pipeline foundation
- `thoughts/shared/plans/2025-12-12-neural-memory-day3-entity-system.md` - Day 3: Entity system planning
- `thoughts/shared/plans/2025-12-13-neural-memory-day3.5-write-path-rework.md` - Day 3.5: Write path refactoring
- `thoughts/shared/research/2025-12-12-neural-memory-day3-entity-system-integration.md` - Entity system integration research
- `thoughts/shared/research/2025-12-12-llm-filter-type-placement.md` - LLM filter types and configuration

## Related Research

- `thoughts/shared/research/2025-12-13-neural-memory-v1-gap-analysis.md` - Overall gap analysis
- `thoughts/shared/research/2025-12-13-neural-memory-day5-implementation-map.md` - Day 5 multi-view embeddings

## Open Questions

1. **Threshold for LLM extraction**: The design specifies `content.length > 200` as trigger - is this the right threshold?
2. **Entity categories for LLM**: Which entity categories should use LLM vs. regex?
3. **Model selection**: Should LLM entity extraction use Haiku (fast) or Sonnet (accurate)?
4. **Batch processing**: Should entities be extracted in batches to reduce LLM calls?
5. **Confidence calibration**: How to calibrate LLM confidence scores against regex confidence?
