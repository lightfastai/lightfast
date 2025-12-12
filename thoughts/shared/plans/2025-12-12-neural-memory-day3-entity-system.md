# Day 3 Entity System Implementation Plan

## Overview

Implement the Entity Store for Neural Memory - a system that extracts, stores, and retrieves structured entities (people, projects, endpoints, variables) from observations. The entity system runs asynchronously after observation capture, listening to completion events and extracting entities via regex patterns.

## Current State Analysis

### What Exists

| Component | Status | Location |
|-----------|--------|----------|
| Observation capture pipeline | EXISTS | `api/console/src/inngest/workflow/neural/observation-capture.ts` |
| Completion event emission | EXISTS | Event: `apps-console/neural/observation.captured` |
| Regex extraction patterns | EXISTS | `classification.ts`, `scoring.ts`, `github.ts` |
| JSONB query patterns | EXISTS | `workspace.ts`, `contents.ts` |

### What's Missing

| Component | Status | Priority |
|-----------|--------|----------|
| `workspace_neural_entities` table | **MISSING** | P0 |
| Entity extraction workflow | **MISSING** | P0 |
| Entity search/lookup API | **MISSING** | P1 |

### Key Discoveries

- **Workflow registration pattern**: `api/console/src/inngest/index.ts:121` - Add to `functions` array
- **Schema pattern**: `db/console/src/schema/tables/workspace-neural-observations.ts` - JSONB with interfaces
- **Event payload**: `{ workspaceId, observationId, sourceId, observationType }`
- **Upsert pattern**: Use `onConflictDoUpdate` with `sql\`column + 1\`` for atomic counter increment

## Desired End State

After implementation:
1. Every captured observation triggers entity extraction
2. Entities are extracted using regex patterns and stored with deduplication
3. Entity occurrence counts increment on re-discovery
4. Console can query entities for workspace search enhancement

### Verification Criteria

- [ ] `workspace_neural_entities` table exists in database
- [ ] Entity extraction workflow runs for each captured observation
- [ ] Entities with same `(workspaceId, category, key)` are deduplicated
- [ ] Occurrence counts increment correctly
- [ ] Console can fetch entities by key or category

## What We're NOT Doing

1. **LLM-based entity extraction** - Defer to Day 5 polish phase
2. **Actor profiles integration** - Day 4 scope
3. **Entity embeddings** - Future enhancement
4. **Cross-workspace entity linking** - Not needed now
5. **Entity editing UI** - Console-side feature, out of scope

## Implementation Approach

Use **Option B (Separate Workflow)** from research document:
- Create new Inngest workflow listening to `observation.captured` event
- Decoupled from capture pipeline - doesn't block observation storage
- Independent scaling and retry behavior
- Fire-and-forget pattern with eventual consistency

## Phase 1: Type Definitions

### Overview
Define entity types in the shared packages following codebase conventions:
- Zod schema in `@repo/console-validation` for runtime validation
- TypeScript interfaces in `@repo/console-types` for compile-time types

### Changes Required

#### 1. Entity Validation Schema

**File**: `packages/console-validation/src/schemas/entities.ts`

**Create new file:**

```typescript
import { z } from "zod";

/**
 * Entity Category Schema
 *
 * High-level classification of extracted entities from observations.
 * Used for semantic grouping and targeted search.
 */
export const entityCategorySchema = z.enum([
  "engineer",    // Team members, contributors (@mentions, emails)
  "project",     // Features, repos, tickets (#123, ENG-456)
  "endpoint",    // API routes (POST /api/users)
  "config",      // Environment variables (DATABASE_URL)
  "definition",  // File paths, technical terms
  "service",     // External services, dependencies
  "reference",   // Generic references (commits, branches)
]);

export type EntityCategory = z.infer<typeof entityCategorySchema>;

/**
 * All valid entity categories
 */
export const ENTITY_CATEGORIES = entityCategorySchema.options;
```

**File**: `packages/console-validation/src/schemas/index.ts`

**Add export:**

```typescript
export * from "./entities";
```

#### 2. Entity Type Interfaces

**File**: `packages/console-types/src/neural/entity.ts`

**Create new file:**

```typescript
import type { EntityCategory } from "@repo/console-validation";

/**
 * Entity extracted from observation content
 */
export interface ExtractedEntity {
  /** Entity classification */
  category: EntityCategory;
  /** Canonical key (e.g., "@sarah", "POST /api/users", "#123") */
  key: string;
  /** Human-readable value/description */
  value?: string;
  /** Extraction confidence (0.0 - 1.0) */
  confidence: number;
  /** Text snippet providing extraction context */
  evidence: string;
}

/**
 * Entity search result for hybrid retrieval
 */
export interface EntitySearchResult {
  /** Entity database ID */
  entityId: string;
  /** Entity key */
  entityKey: string;
  /** Entity category */
  entityCategory: EntityCategory;
  /** Linked observation ID */
  observationId: string;
  /** Observation title */
  observationTitle: string;
  /** Content snippet */
  observationSnippet: string;
  /** How many times this entity has been seen */
  occurrenceCount: number;
  /** Extraction confidence */
  confidence: number;
}
```

**File**: `packages/console-types/src/neural/index.ts`

**Add export:**

```typescript
export * from "./source-event";
export * from "./entity";
```

### Success Criteria

#### Automated Verification:
- [x] Validation package builds: `pnpm --filter @repo/console-validation build`
- [x] Types package builds: `pnpm --filter @repo/console-types build`
- [x] Imports resolve: `import { entityCategorySchema } from "@repo/console-validation"`
- [x] Imports resolve: `import type { ExtractedEntity } from "@repo/console-types"`

---

## Phase 2: Database Schema

### Overview
Create the `workspace_neural_entities` table with unique constraint for deduplication and appropriate indexes.

### Changes Required

#### 1. Entity Table Schema

**File**: `db/console/src/schema/tables/workspace-neural-entities.ts`

**Create new file with schema:**

```typescript
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import type { EntityCategory } from "@repo/console-validation";
import { orgWorkspaces } from "./org-workspaces";
import { workspaceNeuralObservations } from "./workspace-neural-observations";

/**
 * Neural entities extracted from observations
 *
 * Stores structured entities discovered in observation content.
 * Entities are deduplicated by (workspaceId, category, key) and
 * occurrence counts track how many times each entity is seen.
 */
export const workspaceNeuralEntities = pgTable(
  "lightfast_workspace_neural_entities",
  {
    /**
     * Unique entity identifier (nanoid)
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    /**
     * Workspace this entity belongs to
     */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // ========== ENTITY IDENTITY ==========

    /**
     * Entity category (engineer, project, endpoint, etc.)
     */
    category: varchar("category", { length: 50 })
      .notNull()
      .$type<EntityCategory>(),

    /**
     * Canonical entity key (e.g., "@sarah", "POST /api/users", "#123")
     */
    key: varchar("key", { length: 500 }).notNull(),

    /**
     * Human-readable value/description
     */
    value: text("value"),

    /**
     * Alternative names for this entity (e.g., ["sarah@acme.com", "Sarah J"])
     */
    aliases: jsonb("aliases").$type<string[]>(),

    // ========== PROVENANCE ==========

    /**
     * First observation where this entity was discovered
     */
    sourceObservationId: varchar("source_observation_id", { length: 191 })
      .references(() => workspaceNeuralObservations.id, { onDelete: "set null" }),

    /**
     * Text snippet providing evidence for extraction
     */
    evidenceSnippet: text("evidence_snippet"),

    /**
     * Extraction confidence score (0.0 - 1.0)
     */
    confidence: real("confidence").default(0.8),

    // ========== METRICS ==========

    /**
     * When this entity was first extracted
     */
    extractedAt: timestamp("extracted_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * When this entity was last seen in an observation
     */
    lastSeenAt: timestamp("last_seen_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Number of times this entity has been extracted
     */
    occurrenceCount: integer("occurrence_count").default(1).notNull(),

    // ========== TIMESTAMPS ==========

    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Unique constraint for deduplication
    uniqueEntityKey: uniqueIndex("entity_workspace_category_key_idx").on(
      table.workspaceId,
      table.category,
      table.key,
    ),

    // Lookup by workspace and category
    workspaceCategoryIdx: index("entity_workspace_category_idx").on(
      table.workspaceId,
      table.category,
    ),

    // Key search
    workspaceKeyIdx: index("entity_workspace_key_idx").on(
      table.workspaceId,
      table.key,
    ),

    // Last seen for cleanup/ranking
    workspaceLastSeenIdx: index("entity_workspace_last_seen_idx").on(
      table.workspaceId,
      table.lastSeenAt,
    ),
  }),
);

// Type exports
export type WorkspaceNeuralEntity = typeof workspaceNeuralEntities.$inferSelect;
export type InsertWorkspaceNeuralEntity = typeof workspaceNeuralEntities.$inferInsert;
```

#### 2. Register in Schema Index

**File**: `db/console/src/schema/tables/index.ts`

**Add export after other neural memory tables:**

```typescript
// Neural memory tables
export * from "./workspace-neural-observations";
export * from "./workspace-observation-clusters";
export * from "./workspace-neural-entities";  // Add this line
```

### Success Criteria

#### Automated Verification:
- [x] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [x] Migration applies successfully: `cd db/console && pnpm db:migrate`
- [x] Types generate correctly: `pnpm --filter @db/console build` compiles without errors
- [x] Schema exports resolve: `import { workspaceNeuralEntities } from "@db/console"` works

#### Manual Verification:
- [ ] Table visible in PlanetScale dashboard
- [ ] Unique index prevents duplicate `(workspaceId, category, key)` combinations
- [ ] Foreign key to observations allows null on observation delete

---

## Phase 3: Entity Extraction Patterns

### Overview
Implement regex-based entity extraction functions that identify entities in observation content.

### Changes Required

#### 1. Entity Extraction Module

**File**: `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts`

**Create new file:**

```typescript
import type { EntityCategory } from "@repo/console-validation";
import type { ExtractedEntity } from "@repo/console-types";

/**
 * Entity extraction pattern definition
 */
interface ExtractionPattern {
  category: EntityCategory;
  pattern: RegExp;
  confidence: number;
  keyExtractor: (match: RegExpMatchArray) => string;
  valueExtractor?: (match: RegExpMatchArray) => string;
}

/**
 * Entity extraction patterns ordered by specificity
 */
const EXTRACTION_PATTERNS: ExtractionPattern[] = [
  // API Endpoints - highest confidence, very specific pattern
  {
    category: "endpoint",
    pattern: /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s"'<>]{1,200})/gi,
    confidence: 0.95,
    keyExtractor: (m) => `${m[1]?.toUpperCase()} ${m[2]}`,
    valueExtractor: (m) => m[2] || "",
  },

  // Issue/PR References - GitHub style
  {
    category: "project",
    pattern: /(#\d{1,6})/g,
    confidence: 0.95,
    keyExtractor: (m) => m[1] || "",
  },

  // Issue/PR References - Linear/Jira style (e.g., ENG-123, PROJ-456)
  {
    category: "project",
    pattern: /\b([A-Z]{2,10}-\d{1,6})\b/g,
    confidence: 0.90,
    keyExtractor: (m) => m[1] || "",
  },

  // @mentions - GitHub/Slack style
  {
    category: "engineer",
    pattern: /@([a-zA-Z0-9_-]{1,39})\b/g,
    confidence: 0.90,
    keyExtractor: (m) => `@${m[1]}`,
    valueExtractor: (m) => m[1] || "",
  },

  // Environment Variables - UPPERCASE_WITH_UNDERSCORES
  {
    category: "config",
    pattern: /\b([A-Z][A-Z0-9_]{2,}(?:_[A-Z0-9]+)+)\b/g,
    confidence: 0.85,
    keyExtractor: (m) => m[1] || "",
  },

  // File Paths - common patterns
  {
    category: "definition",
    pattern: /\b(?:src|lib|packages|apps|api|components)\/[^\s"'<>]{1,150}\.[a-z]{1,10}\b/gi,
    confidence: 0.80,
    keyExtractor: (m) => m[0],
  },

  // Git commit hashes (7+ chars)
  {
    category: "reference",
    pattern: /\b([a-f0-9]{7,40})\b/g,
    confidence: 0.70,
    keyExtractor: (m) => m[1]?.substring(0, 7) || "",
    valueExtractor: (m) => m[1] || "",
  },

  // Branch references
  {
    category: "reference",
    pattern: /\bbranch[:\s]+([a-zA-Z0-9/_-]{1,100})\b/gi,
    confidence: 0.75,
    keyExtractor: (m) => `branch:${m[1]}`,
    valueExtractor: (m) => m[1] || "",
  },
];

/**
 * Blacklist patterns to filter out false positives
 */
const BLACKLIST_PATTERNS: RegExp[] = [
  // Common false positives for env vars
  /^(HTTP|HTTPS|GET|POST|PUT|DELETE|API|URL|ID|DB|SQL)$/,
  // Single character entities
  /^.$/,
  // Pure numbers
  /^\d+$/,
];

/**
 * Check if an entity key should be filtered out
 */
function isBlacklisted(key: string): boolean {
  return BLACKLIST_PATTERNS.some((p) => p.test(key));
}

/**
 * Extract evidence snippet around the match
 */
function extractEvidence(text: string, matchIndex: number, matchLength: number): string {
  const contextSize = 50;
  const start = Math.max(0, matchIndex - contextSize);
  const end = Math.min(text.length, matchIndex + matchLength + contextSize);

  let evidence = text.substring(start, end);
  if (start > 0) evidence = "..." + evidence;
  if (end < text.length) evidence = evidence + "...";

  return evidence.replace(/\s+/g, " ").trim();
}

/**
 * Extract entities from observation content
 *
 * @param title - Observation title
 * @param content - Observation body content
 * @returns Array of extracted entities (deduplicated by key)
 */
export function extractEntities(title: string, content: string): ExtractedEntity[] {
  const text = `${title}\n${content}`;
  const entityMap = new Map<string, ExtractedEntity>();

  for (const pattern of EXTRACTION_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.pattern.exec(text)) !== null) {
      const key = pattern.keyExtractor(match);

      // Skip blacklisted or empty keys
      if (!key || key.length < 2 || isBlacklisted(key)) {
        continue;
      }

      // Use composite key for deduplication within extraction
      const mapKey = `${pattern.category}:${key.toLowerCase()}`;

      // Keep highest confidence match if duplicate
      const existing = entityMap.get(mapKey);
      if (!existing || existing.confidence < pattern.confidence) {
        entityMap.set(mapKey, {
          category: pattern.category,
          key,
          value: pattern.valueExtractor?.(match),
          confidence: pattern.confidence,
          evidence: extractEvidence(text, match.index, match[0].length),
        });
      }
    }
  }

  return Array.from(entityMap.values());
}

/**
 * Extract entities specifically from source references
 * (Already-structured data from GitHub/Vercel events)
 */
export function extractFromReferences(
  references: Array<{ type: string; id: string; label?: string }>
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  for (const ref of references) {
    let category: EntityCategory;
    let key: string;

    switch (ref.type) {
      case "issue":
      case "pr":
        category = "project";
        key = ref.id;
        break;
      case "commit":
      case "branch":
        category = "reference";
        key = ref.type === "branch" ? `branch:${ref.id}` : ref.id.substring(0, 7);
        break;
      case "assignee":
      case "reviewer":
        category = "engineer";
        key = `@${ref.id}`;
        break;
      default:
        category = "reference";
        key = ref.id;
    }

    entities.push({
      category,
      key,
      value: ref.label,
      confidence: 0.98, // High confidence - from structured data
      evidence: `Reference: ${ref.type}`,
    });
  }

  return entities;
}
```

### Success Criteria

#### Automated Verification:
- [x] File compiles: `pnpm --filter @api/console build` succeeds
- [x] TypeScript types are correct: no type errors in `entity-extraction-patterns.ts`

#### Manual Verification:
- [ ] `extractEntities("Fix #123", "POST /api/users endpoint added by @johndoe")` returns entities for: `#123` (project), `POST /api/users` (endpoint), `@johndoe` (engineer)
- [ ] Blacklisted terms like `GET`, `HTTP` are filtered out
- [ ] Duplicate entities are deduplicated by `category:key`

---

## Phase 4: Entity Extraction Workflow

### Overview
Create Inngest workflow that listens to observation captured events and extracts entities.

### Changes Required

#### 1. Entity Extraction Workflow

**File**: `api/console/src/inngest/workflow/neural/entity-extraction.ts`

**Create new file:**

```typescript
import { sql, eq, and } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { consoleDb, workspaceNeuralObservations, workspaceNeuralEntities } from "@db/console";
import type { ObservationReference } from "@db/console";
import type { ExtractedEntity } from "@repo/console-types";
import { inngest } from "../../client";
import { extractEntities, extractFromReferences } from "./entity-extraction-patterns";

/**
 * Maximum entities to extract per observation
 * Prevents runaway extraction from noisy content
 */
const MAX_ENTITIES_PER_OBSERVATION = 50;

/**
 * Entity Extraction Workflow
 *
 * Triggered by observation capture completion.
 * Extracts entities from observation content and stores them with deduplication.
 */
export const entityExtraction = inngest.createFunction(
  {
    id: "apps-console/neural.entity.extraction",
    retries: 2,
    concurrency: {
      limit: 20,
      key: "event.data.workspaceId",
    },
  },
  { event: "apps-console/neural/observation.captured" },
  async ({ event, step, logger }) => {
    const { observationId, workspaceId } = event.data;
    const startTime = Date.now();

    // Step 1: Fetch observation
    const observation = await step.run("fetch-observation", async () => {
      const result = await consoleDb.query.workspaceNeuralObservations.findFirst({
        where: eq(workspaceNeuralObservations.id, observationId),
      });

      if (!result) {
        throw new NonRetriableError(`Observation not found: ${observationId}`);
      }

      return result;
    });

    // Step 2: Extract entities
    const entities = await step.run("extract-entities", async () => {
      // Extract from text content
      const textEntities = extractEntities(
        observation.title,
        observation.content || ""
      );

      // Extract from structured references if available
      const references = observation.sourceReferences as ObservationReference[] | null;
      const refEntities = references ? extractFromReferences(references) : [];

      // Combine and deduplicate
      const allEntities = [...textEntities, ...refEntities];
      const entityMap = new Map<string, ExtractedEntity>();

      for (const entity of allEntities) {
        const key = `${entity.category}:${entity.key.toLowerCase()}`;
        const existing = entityMap.get(key);
        if (!existing || existing.confidence < entity.confidence) {
          entityMap.set(key, entity);
        }
      }

      // Limit to prevent runaway extraction
      const deduplicated = Array.from(entityMap.values());
      if (deduplicated.length > MAX_ENTITIES_PER_OBSERVATION) {
        logger.warn("Entity extraction exceeded limit", {
          observationId,
          extracted: deduplicated.length,
          limit: MAX_ENTITIES_PER_OBSERVATION,
        });
        // Sort by confidence and take top N
        return deduplicated
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, MAX_ENTITIES_PER_OBSERVATION);
      }

      return deduplicated;
    });

    // Step 3: Store entities with upsert
    const stored = await step.run("store-entities", async () => {
      if (entities.length === 0) {
        return { stored: 0 };
      }

      let stored = 0;

      for (const entity of entities) {
        try {
          await consoleDb
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
              },
            });
          stored++;
        } catch (error) {
          // Log but don't fail the entire workflow
          logger.error("Failed to store entity", {
            entity,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return { stored };
    });

    const duration = Date.now() - startTime;

    logger.info("Entity extraction completed", {
      observationId,
      workspaceId,
      entitiesExtracted: entities.length,
      entitiesStored: stored.stored,
      durationMs: duration,
    });

    return {
      status: "completed",
      observationId,
      entitiesExtracted: entities.length,
      entitiesStored: stored.stored,
      durationMs: duration,
    };
  }
);
```

#### 2. Export from Neural Module

**File**: `api/console/src/inngest/workflow/neural/index.ts`

**Add export:**

```typescript
export { observationCapture } from "./observation-capture";
export { entityExtraction } from "./entity-extraction";
```

#### 3. Register in Inngest Functions

**File**: `api/console/src/inngest/index.ts`

**Add import and registration:**

In imports section (around line 36):
```typescript
import { observationCapture, entityExtraction } from "./workflow/neural";
```

In exports section (before the functions array):
```typescript
export { observationCapture, entityExtraction };
```

In functions array (around line 121):
```typescript
functions: [
  // ... existing workflows
  observationCapture,
  entityExtraction,  // Add this
]
```

### Success Criteria

#### Automated Verification:
- [x] Build succeeds: `pnpm --filter @api/console build`
- [x] Types are correct: `pnpm --filter @lightfast/console typecheck`
- [ ] Workflow appears in Inngest dev dashboard
- [ ] Console dev server starts: `pnpm dev:console`

#### Manual Verification:
- [ ] Push a commit to trigger observation capture
- [ ] Entity extraction workflow runs after observation is captured
- [ ] Entities appear in `workspace_neural_entities` table
- [ ] Second push with same entities increments `occurrence_count`

---

## Phase 5: Search Integration

### Overview
Integrate entity lookup into the workspace search route as a parallel retrieval path. Queries containing entity references (like `@sarah`, `#123`, `POST /api/users`) will match both semantically AND via exact entity lookup.

### Changes Required

#### 1. Entity Search Helper Module

**File**: `apps/console/src/lib/neural/entity-search.ts`

**Create new file:**

```typescript
import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "@db/console/client";
import { workspaceNeuralEntities, workspaceNeuralObservations } from "@db/console";
import type { EntityCategory } from "@repo/console-validation";
import type { EntitySearchResult } from "@repo/console-types";

/**
 * Patterns to extract entity references from search queries
 */
const QUERY_ENTITY_PATTERNS: Array<{
  category: EntityCategory;
  pattern: RegExp;
  keyExtractor: (match: RegExpMatchArray) => string;
}> = [
  // @mentions
  {
    category: "engineer",
    pattern: /@([a-zA-Z0-9_-]{1,39})\b/g,
    keyExtractor: (m) => `@${m[1]}`,
  },
  // Issue/PR references
  {
    category: "project",
    pattern: /(#\d{1,6})/g,
    keyExtractor: (m) => m[1] || "",
  },
  // Linear/Jira style
  {
    category: "project",
    pattern: /\b([A-Z]{2,10}-\d{1,6})\b/g,
    keyExtractor: (m) => m[1] || "",
  },
  // API endpoints
  {
    category: "endpoint",
    pattern: /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s"'<>]{1,100})/gi,
    keyExtractor: (m) => `${m[1]?.toUpperCase()} ${m[2]}`,
  },
];

/**
 * Extract entity references from a search query
 */
export function extractQueryEntities(
  query: string
): Array<{ category: EntityCategory; key: string }> {
  const entities: Array<{ category: EntityCategory; key: string }> = [];

  for (const { category, pattern, keyExtractor } of QUERY_ENTITY_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(query)) !== null) {
      const key = keyExtractor(match);
      if (key && key.length >= 2) {
        entities.push({ category, key });
      }
    }
  }

  return entities;
}

/**
 * Search for observations linked to entities mentioned in the query
 *
 * @param query - User's search query
 * @param workspaceId - Workspace to search in
 * @param limit - Max results to return
 * @returns Observations linked to matched entities
 */
export async function searchByEntities(
  query: string,
  workspaceId: string,
  limit: number = 10
): Promise<EntitySearchResult[]> {
  // 1. Extract entity references from query
  const queryEntities = extractQueryEntities(query);

  if (queryEntities.length === 0) {
    return [];
  }

  // 2. Find matching entities (exact key match)
  const entityKeys = queryEntities.map((e) => e.key);
  const matchedEntities = await db
    .select({
      id: workspaceNeuralEntities.id,
      key: workspaceNeuralEntities.key,
      category: workspaceNeuralEntities.category,
      sourceObservationId: workspaceNeuralEntities.sourceObservationId,
      occurrenceCount: workspaceNeuralEntities.occurrenceCount,
      confidence: workspaceNeuralEntities.confidence,
    })
    .from(workspaceNeuralEntities)
    .where(
      and(
        eq(workspaceNeuralEntities.workspaceId, workspaceId),
        inArray(workspaceNeuralEntities.key, entityKeys)
      )
    )
    .orderBy(desc(workspaceNeuralEntities.occurrenceCount))
    .limit(limit);

  if (matchedEntities.length === 0) {
    return [];
  }

  // 3. Fetch linked observations
  const observationIds = matchedEntities
    .map((e) => e.sourceObservationId)
    .filter((id): id is string => id !== null);

  if (observationIds.length === 0) {
    return [];
  }

  const observations = await db
    .select({
      id: workspaceNeuralObservations.id,
      title: workspaceNeuralObservations.title,
      content: workspaceNeuralObservations.content,
    })
    .from(workspaceNeuralObservations)
    .where(inArray(workspaceNeuralObservations.id, observationIds));

  // 4. Build result map
  const obsMap = new Map(observations.map((o) => [o.id, o]));

  return matchedEntities
    .filter((e) => e.sourceObservationId && obsMap.has(e.sourceObservationId))
    .map((entity) => {
      const obs = obsMap.get(entity.sourceObservationId!)!;
      return {
        entityId: entity.id,
        entityKey: entity.key,
        entityCategory: entity.category as EntityCategory,
        observationId: obs.id,
        observationTitle: obs.title,
        observationSnippet: obs.content?.substring(0, 200) || "",
        occurrenceCount: entity.occurrenceCount,
        confidence: entity.confidence ?? 0.8,
      };
    });
}
```

#### 2. Update Search Route

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`

**Add imports (at top):**

```typescript
import { searchByEntities } from "~/lib/neural/entity-search";
```

**Add entity search step after Pinecone query (after line 274):**

```typescript
    // 6. Query Pinecone
    const queryStart = Date.now();
    const pineconeFilter = buildPineconeFilter(filters);
    const results = await pineconeClient.query<VectorMetadata>(...);
    const queryLatency = Date.now() - queryStart;

    // 6.5. Entity-enhanced retrieval (parallel path)
    const entityStart = Date.now();
    const entityResults = await searchByEntities(query, workspaceId, topK);
    const entityLatency = Date.now() - entityStart;

    log.info("Entity search complete", {
      requestId,
      entityLatency,
      entityMatches: entityResults.length,
      queryEntities: entityResults.map((e) => e.entityKey),
    });

    // 7. Merge vector and entity results
    const mergedCandidates = mergeSearchResults(
      results.matches,
      entityResults,
      topK
    );
```

**Add merge function (before POST handler):**

```typescript
/**
 * Merge vector search results with entity-matched results
 * Entity matches get a score boost since they're exact matches
 */
function mergeSearchResults(
  vectorMatches: Array<{ id: string; score: number; metadata?: VectorMetadata }>,
  entityResults: EntitySearchResult[],
  limit: number
): FilterCandidate[] {
  const resultMap = new Map<string, FilterCandidate>();

  // Add vector results
  for (const match of vectorMatches) {
    resultMap.set(match.id, {
      id: match.id,
      title: String(match.metadata?.title ?? ""),
      snippet: String(match.metadata?.snippet ?? ""),
      score: match.score,
    });
  }

  // Add/boost entity results
  for (const entity of entityResults) {
    const existing = resultMap.get(entity.observationId);
    if (existing) {
      // Boost existing result - entity match confirms relevance
      existing.score = Math.min(1.0, existing.score + 0.2);
    } else {
      // Add new result from entity match
      resultMap.set(entity.observationId, {
        id: entity.observationId,
        title: entity.observationTitle,
        snippet: entity.observationSnippet,
        score: 0.85 * entity.confidence, // High base score for exact entity match
      });
    }
  }

  // Sort by score and limit
  return Array.from(resultMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

**Update LLM filter input (replace line 284-289):**

```typescript
    // 8. Apply LLM relevance filtering (on merged results)
    const filterResult = await llmRelevanceFilter(query, mergedCandidates, requestId);
```

**Update latency tracking in response:**

```typescript
    const response: SearchResponse = {
      results: searchResults,
      requestId,
      latency: {
        total: Date.now() - startTime,
        retrieval: queryLatency,
        entitySearch: entityLatency,  // Add this
        llmFilter: filterResult.latency,
      },
    };
```

### Success Criteria

#### Automated Verification:
- [x] Build succeeds: `pnpm --filter @api/console build`
- [x] Types are correct: `pnpm --filter @lightfast/console typecheck`
- [x] Search route compiles without errors

#### Manual Verification:
- [ ] Search for `"@username"` returns observations where that user was mentioned
- [ ] Search for `"#123"` returns observations linked to that issue
- [ ] Search for `"POST /api/users"` returns observations mentioning that endpoint
- [ ] Mixed query `"what did @sarah do on #123"` returns relevant results boosted by entity matches
- [ ] Queries without entities still work (vector-only path)

---

## Testing Strategy

### Unit Tests

**Location**: `api/console/src/inngest/workflow/neural/__tests__/entity-extraction-patterns.test.ts`

Test cases:
- API endpoint extraction: `"POST /api/users"` → endpoint entity
- Issue reference extraction: `"#123"`, `"ENG-456"` → project entities
- @mention extraction: `"@johndoe"` → engineer entity
- Environment variable extraction: `"DATABASE_URL"` → config entity
- File path extraction: `"src/lib/auth.ts"` → definition entity
- Blacklist filtering: `"GET"`, `"HTTP"` filtered out
- Deduplication: Same entity appears once with highest confidence

### Integration Tests

- Observation capture → entity extraction workflow chain
- Entity upsert deduplication
- Occurrence count increment
- tRPC endpoint responses

### Manual Testing Steps

1. Start console dev server: `pnpm dev:console`
2. Push a commit with entities (e.g., `"Fix #123 - POST /api/users by @dev"`)
3. Check Inngest dashboard for:
   - `observation.capture` workflow completes
   - `entity.extraction` workflow triggers
   - Workflow completes without errors
4. Verify entities appear in `workspace_neural_entities` table
5. Push another commit with same entities
6. Verify occurrence counts increment
7. **Test search integration:**
   - Search for `"@dev"` → should return observations mentioning @dev
   - Search for `"#123"` → should return observations linked to issue #123
   - Search for `"POST /api/users"` → should return observations with that endpoint
   - Search for `"authentication"` (no entities) → should still return vector results

## Performance Considerations

1. **Extraction limits**: `MAX_ENTITIES_PER_OBSERVATION = 50` prevents runaway extraction
2. **Concurrency**: Limited to 20 per workspace to prevent database contention
3. **Indexes**: Composite indexes on `(workspaceId, category, key)` for efficient lookups
4. **Deduplication**: `onConflictDoUpdate` pattern - atomic upsert avoids read-before-write race conditions
5. **Search latency**: Entity lookup adds ~10-50ms to search (parallel to vector search would be better in future)

## Migration Notes

- **No existing data**: Fresh table, no migration of existing observations
- **Backfill strategy**: Could add separate workflow to process historical observations (future enhancement)
- **Schema changes**: If entity schema needs updates, use Drizzle migrations

## References

- Research document: `thoughts/shared/research/2025-12-12-neural-memory-day3-entity-system-integration.md`
- E2E design: `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md:706-849`
- Phase 6 spec: `docs/architecture/plans/neural-memory/phase-06-embedding-storage.md:173-365`
- Observation capture: `api/console/src/inngest/workflow/neural/observation-capture.ts:167-429`
- Classification patterns: `api/console/src/inngest/workflow/neural/classification.ts:57-185`
- Search route: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`
