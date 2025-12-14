---
date: 2025-12-13T08:29:05Z
researcher: Claude
git_commit: 014045bb15a6b1a4274cf15ac024bbc297615a18
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Console Test Data Package - Neural Memory V1 Alignment Analysis"
tags: [research, test-data, neural-memory, types, architecture, console-validation, console-types]
status: complete
last_updated: 2025-12-13
last_updated_by: Claude
last_updated_note: "Added follow-up research for tighter console-validation and console-types integration"
---

# Research: Console Test Data Package - Neural Memory V1 Alignment Analysis

**Date**: 2025-12-13T08:29:05Z
**Researcher**: Claude
**Git Commit**: 014045bb15a6b1a4274cf15ac024bbc297615a18
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Analyze the current `@repo/console-test-data` package structure and document how it compares to the neural memory V1 implementation types and interfaces, identifying gaps and alignment opportunities.

## Executive Summary

The current test data package was designed for basic observation injection and verification. It lacks support for the full neural memory V1 feature set including entities, clusters, actor profiles, multi-view embeddings, and temporal states. A significant re-architecture is needed to align with the production interfaces.

---

## Current Test Data Package Structure

**Location**: `packages/console-test-data/`

### Package Exports

```typescript
// package.json lines 6-12
{
  ".": "./src/index.ts",
  "./factories": "./src/factories/index.ts",
  "./injector": "./src/injector/index.ts",
  "./verifier": "./src/verifier/index.ts",
  "./scenarios": "./src/scenarios/index.ts"
}
```

### File Structure

| File | Purpose |
|------|---------|
| `src/types.ts` | Core type definitions (115 lines) |
| `src/factories/observation-factory.ts` | Fluent builder for observations (279 lines) |
| `src/factories/templates.ts` | 33 observation templates across 6 categories (356 lines) |
| `src/factories/actors.ts` | 9 predefined test actors (109 lines) |
| `src/injector/injector.ts` | DB + Pinecone injection (389 lines) |
| `src/injector/workspace-resolver.ts` | Workspace lookup utilities |
| `src/verifier/verifier.ts` | Verification against DB + Pinecone (217 lines) |
| `src/scenarios/day2-retrieval.ts` | 20 observations for retrieval testing (288 lines) |
| `src/scenarios/stress-test.ts` | Stress test scenarios |
| `src/cli/*.ts` | CLI commands (inject, verify, clean) |

---

## Current Type Definitions

### TestObservation (`src/types.ts:10-22`)

```typescript
interface TestObservation {
  source: SourceType;           // "github" | "vercel"
  sourceType: string;           // e.g., "pull-request.merged"
  title: string;
  body: string;
  actorName: string;
  daysAgo: number;              // Days ago from injection time
  category?: string;            // Optional grouping
  tags?: string[];              // Optional filtering tags
}
```

### TestActor (`src/types.ts:27-32`)

```typescript
interface TestActor {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}
```

### InjectionResult (`src/types.ts:61-68`)

```typescript
interface InjectionResult {
  success: boolean;
  observationsCreated: number;
  vectorsUpserted: number;
  errors: string[];
  namespace: string;
  duration: number;
}
```

### TestScenario (`src/types.ts:91-96`)

```typescript
interface TestScenario {
  name: string;
  description: string;
  observations: TestObservation[];
  expectedResults: ScenarioExpectation[];
}
```

---

## Gap Analysis: Current vs Neural Memory V1

### 1. Observation Data Model

| Field | Current Test Data | Neural Memory V1 | Gap |
|-------|-------------------|------------------|-----|
| Multi-view embeddings | Single `embeddingVectorId` | `embeddingTitleId`, `embeddingContentId`, `embeddingSummaryId` | Missing 3-view support |
| Pinecone metadata | Basic (layer, observationType, source) | Includes `view: "title" \| "content" \| "summary"` | Missing view metadata |
| Topics | Not generated | `topics: string[]` via classification | Missing classification |
| Significance score | Inline calculation | Proper scoring with factors | Simplified scoring |
| Source references | Not generated | `SourceReference[]` (commits, PRs, issues) | Missing references |
| Cluster assignment | Not supported | `clusterId` via affinity algorithm | Not implemented |
| Actor resolution | Direct name mapping | Resolved `actorId` via 3-tier system | Simplified resolution |

### 2. Entity System (Not Implemented)

The current package has **no entity support**. Neural Memory V1 uses:

**Database Schema** (`db/console/src/schema/tables/workspace-neural-entities.ts:25-154`):
```typescript
workspaceNeuralEntities {
  id: string;
  workspaceId: string;
  category: EntityCategory;      // 7 categories
  key: string;                   // Canonical key
  value: string | null;
  aliases: string[];
  sourceObservationId: string | null;
  evidenceSnippet: string | null;
  confidence: number;            // 0.0-1.0
  occurrenceCount: number;
  lastSeenAt: string;
}
```

**Entity Categories** (`packages/console-validation/src/schemas/entities.ts:9-17`):
- `engineer` - @mentions, emails
- `project` - #123, ENG-456
- `endpoint` - POST /api/users
- `config` - DATABASE_URL
- `definition` - File paths
- `service` - External services
- `reference` - Commits, branches

### 3. Cluster System (Not Implemented)

The current package has **no cluster support**. Neural Memory V1 uses:

**Database Schema** (`db/console/src/schema/tables/workspace-observation-clusters.ts:17-138`):
```typescript
workspaceObservationClusters {
  id: string;
  workspaceId: string;
  topicLabel: string;
  topicEmbeddingId: string | null;   // Pinecone centroid
  keywords: string[];
  primaryEntities: string[];
  primaryActors: string[];
  status: "open" | "closed";
  summary: string | null;            // LLM-generated
  observationCount: number;
  firstObservationAt: string | null;
  lastObservationAt: string | null;
}
```

**Affinity Algorithm** (`api/console/src/inngest/workflow/neural/cluster-assignment.ts:112-164`):
- Embedding similarity: 0-40 points
- Entity overlap: 0-30 points (Jaccard)
- Actor overlap: 0-20 points
- Temporal proximity: 0-10 points
- Threshold: 60/100 to join existing cluster

### 4. Actor System (Minimal)

Current package provides basic actors. Neural Memory V1 adds:

**Actor Profiles** (`db/console/src/schema/tables/workspace-actor-profiles.ts:19-85`):
```typescript
workspaceActorProfiles {
  id: string;
  workspaceId: string;
  actorId: string;                   // Canonical identifier
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  expertiseDomains: string[];        // Future
  contributionTypes: string[];       // Future
  activeHours: Record<string, number>; // Future
  frequentCollaborators: string[];   // Future
  profileEmbeddingId: string | null; // Future
  observationCount: number;
  lastActiveAt: string | null;
  profileConfidence: number | null;
}
```

**Actor Identities** (`db/console/src/schema/tables/workspace-actor-identities.ts:16-68`):
```typescript
workspaceActorIdentities {
  id: string;
  workspaceId: string;
  actorId: string;
  source: string;                    // "github" | "vercel"
  sourceId: string;
  sourceUsername: string | null;
  sourceEmail: string | null;
  mappingMethod: string;             // "oauth" | "email" | "heuristic"
  confidenceScore: number;
  mappedAt: string;
}
```

### 5. Temporal States (Not Implemented)

The current package has **no temporal state support**. Neural Memory V1 uses:

**Database Schema** (`db/console/src/schema/tables/workspace-temporal-states.ts:30-173`):
```typescript
workspaceTemporalStates {
  id: string;
  workspaceId: string;
  entityType: TemporalEntityType;    // project|feature|service|sprint|issue|pr
  entityId: string;
  entityName: string | null;
  stateType: TemporalStateType;      // status|progress|health|risk|priority|assignee
  stateValue: string;
  previousValue: string | null;
  stateMetadata: Record<string, unknown>;
  validFrom: string;                 // Bi-temporal
  validTo: string | null;
  isCurrent: boolean;
  changedByActorId: string | null;
  changeReason: string | null;
  sourceObservationId: string | null;
}
```

### 6. Retrieval Verification (Incomplete)

Current verifier checks counts only. Neural Memory V1 search uses:

**4-Path Parallel Retrieval** (`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts:324-358`):
1. Vector search (Pinecone)
2. Entity exact match
3. Cluster context
4. Actor profile search

**LLM Gating** (`apps/console/src/lib/neural/llm-filter.ts:66-125`):
- Bypass threshold: ≤5 candidates
- Min confidence: 0.4
- Score fusion: 60% LLM + 40% vector

---

## Required Type Alignments

### 1. Replace TestObservation with SourceEvent

**From** (`packages/console-test-data/src/types.ts`):
```typescript
interface TestObservation {
  source: SourceType;
  sourceType: string;
  title: string;
  body: string;
  actorName: string;
  daysAgo: number;
  category?: string;
  tags?: string[];
}
```

**To** (`packages/console-types/src/neural/source-event.ts:7-37`):
```typescript
interface SourceEvent {
  source: SourceType;
  sourceType: string;
  sourceId: string;
  title: string;
  body: string;
  actor?: SourceActor;
  occurredAt: string;
  references: SourceReference[];
  metadata: Record<string, unknown>;
}
```

### 2. Add Entity Factories

```typescript
interface TestEntity {
  category: EntityCategory;
  key: string;
  value?: string;
  confidence?: number;
  linkedObservations?: number[];  // Indices into observation array
}

interface EntityFactory {
  engineers(names: string[]): TestEntity[];
  endpoints(routes: string[]): TestEntity[];
  projects(refs: string[]): TestEntity[];
  configs(vars: string[]): TestEntity[];
}
```

### 3. Add Cluster Factories

```typescript
interface TestCluster {
  topicLabel: string;
  keywords: string[];
  summary?: string;
  observationIndices: number[];  // Which observations belong
}

interface ClusterFactory {
  fromTopics(topics: string[]): TestCluster[];
  autoGroup(observations: TestObservation[], maxClusters?: number): TestCluster[];
}
```

### 4. Add Actor Profile Factories

```typescript
interface TestActorProfile {
  actorId: string;
  displayName: string;
  email: string;
  identities: {
    source: SourceType;
    sourceId: string;
    sourceUsername: string;
  }[];
}
```

### 5. Add Multi-View Embedding Support

```typescript
interface TestEmbeddings {
  title: { vectorId: string; vector: number[] };
  content: { vectorId: string; vector: number[] };
  summary: { vectorId: string; vector: number[] };
}

interface EnhancedInjectionResult extends InjectionResult {
  titleVectorsUpserted: number;
  contentVectorsUpserted: number;
  summaryVectorsUpserted: number;
  entitiesCreated: number;
  clustersCreated: number;
  actorProfilesCreated: number;
}
```

### 6. Enhance Verification

```typescript
interface EnhancedVerificationResult {
  database: {
    observations: { count: number; byType: Record<string, number> };
    entities: { count: number; byCategory: Record<string, number> };
    clusters: { count: number; avgObservationsPerCluster: number };
    actorProfiles: { count: number };
    actorIdentities: { count: number };
  };
  pinecone: {
    titleVectors: number;
    contentVectors: number;
    summaryVectors: number;
    clusterCentroids: number;
  };
  search: {
    sampleQueries: SearchTestResult[];
  };
}

interface SearchTestResult {
  query: string;
  filters?: SearchFilters;
  resultCount: number;
  latency: number;
  llmTriggered: boolean;
  topResultRelevance: number;
}
```

---

## Current Implementation Limitations

### Injector (`src/injector/injector.ts`)

| Limitation | Line | Impact |
|------------|------|--------|
| Single embedding per observation | 211-213 | No multi-view search |
| No entity extraction | N/A | No entity-based retrieval |
| No cluster assignment | N/A | No cluster context |
| Inline significance scoring | 86-103 | Doesn't match production logic |
| No actor resolution | 240-244 | Actors not linked to profiles |
| Simplified Pinecone metadata | 225-235 | Missing `view` field |

### Verifier (`src/verifier/verifier.ts`)

| Limitation | Line | Impact |
|------------|------|--------|
| No entity count verification | N/A | Can't verify extraction |
| No cluster verification | N/A | Can't verify clustering |
| No actor profile verification | N/A | Can't verify resolution |
| No search quality verification | N/A | Can't verify retrieval |
| Dummy vector for Pinecone query | 131 | May not match actual queries |

### Templates (`src/factories/templates.ts`)

| Limitation | Impact |
|------------|--------|
| No embedded entity references | Can't test entity extraction patterns |
| No structured references (commits, PRs) | Can't test reference parsing |
| Generic content | May not trigger significance thresholds |

---

## Recommended Architecture

### Package Structure

```
packages/console-test-data/
├── src/
│   ├── types/
│   │   ├── index.ts                 # Re-export from console-types
│   │   ├── test-scenario.ts         # Scenario-specific types
│   │   └── verification.ts          # Enhanced verification types
│   ├── factories/
│   │   ├── observation-factory.ts   # Use SourceEvent interface
│   │   ├── entity-factory.ts        # NEW: Entity generation
│   │   ├── cluster-factory.ts       # NEW: Cluster generation
│   │   ├── actor-factory.ts         # Enhanced with profiles
│   │   ├── temporal-factory.ts      # NEW: Temporal state generation
│   │   └── templates/
│   │       ├── security.ts
│   │       ├── performance.ts
│   │       ├── bugfix.ts
│   │       ├── feature.ts
│   │       ├── devops.ts
│   │       └── docs.ts
│   ├── injector/
│   │   ├── observation-injector.ts  # Multi-view embeddings
│   │   ├── entity-injector.ts       # NEW
│   │   ├── cluster-injector.ts      # NEW
│   │   ├── actor-injector.ts        # NEW
│   │   └── composite-injector.ts    # Orchestrates all injectors
│   ├── verifier/
│   │   ├── database-verifier.ts     # All 6 tables
│   │   ├── pinecone-verifier.ts     # All vector layers
│   │   └── search-verifier.ts       # NEW: Search quality
│   ├── scenarios/
│   │   ├── day1-capture.ts          # Significance gating tests
│   │   ├── day2-retrieval.ts        # 4-path retrieval tests
│   │   ├── day3-entities.ts         # NEW: Entity tests
│   │   ├── day4-clusters.ts         # NEW: Cluster tests
│   │   ├── day5-multiview.ts        # NEW: Multi-view tests
│   │   └── stress/
│   └── cli/
│       ├── inject.ts
│       ├── verify.ts
│       ├── search-eval.ts           # NEW: Run search evaluation
│       └── clean.ts
```

### Type Import Strategy

```typescript
// src/types/index.ts
// Re-export production types for alignment
export type {
  SourceEvent,
  SourceActor,
  SourceReference,
  SourceType,
} from "@repo/console-types";

export type {
  EntityCategory,
  ExtractedEntity,
} from "@repo/console-types";

export type {
  InsertWorkspaceNeuralObservation,
  InsertWorkspaceNeuralEntity,
  InsertWorkspaceObservationCluster,
  InsertWorkspaceActorProfile,
  InsertWorkspaceActorIdentity,
  InsertWorkspaceTemporalState,
} from "@db/console";

// Test-specific extensions
export interface TestScenario { ... }
export interface ScenarioExpectation { ... }
export interface EnhancedVerificationResult { ... }
```

---

## Code References

### Current Test Data Package
- `packages/console-test-data/src/types.ts:10-114` - Current type definitions
- `packages/console-test-data/src/factories/observation-factory.ts:45-223` - Factory implementation
- `packages/console-test-data/src/injector/injector.ts:108-381` - Injection logic
- `packages/console-test-data/src/verifier/verifier.ts:25-209` - Verification logic

### Neural Memory Implementation
- `db/console/src/schema/tables/workspace-neural-observations.ts:46-221` - Observation schema
- `db/console/src/schema/tables/workspace-neural-entities.ts:25-154` - Entity schema
- `db/console/src/schema/tables/workspace-observation-clusters.ts:17-138` - Cluster schema
- `db/console/src/schema/tables/workspace-actor-profiles.ts:19-85` - Profile schema
- `db/console/src/schema/tables/workspace-actor-identities.ts:16-68` - Identity schema
- `db/console/src/schema/tables/workspace-temporal-states.ts:30-173` - Temporal schema
- `packages/console-types/src/neural/source-event.ts:7-68` - Source event types
- `packages/console-validation/src/schemas/entities.ts:9-17` - Entity categories
- `api/console/src/inngest/workflow/neural/observation-capture.ts:369-410` - Multi-view embeddings
- `apps/console/src/lib/neural/llm-filter.ts:29-48` - LLM filter types

### Search/Retrieval
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts:43-92` - Search types
- `apps/console/src/lib/neural/entity-search.ts:6-71` - Entity search
- `apps/console/src/lib/neural/cluster-search.ts:6-79` - Cluster search
- `apps/console/src/lib/neural/actor-search.ts:5-121` - Actor search

---

## Related Research

- `thoughts/shared/research/2025-12-13-neural-memory-v1-gap-analysis.md` - Implementation status
- `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md` - Original design spec

---

---

## Follow-up Research: Package Integration Strategy

### @repo/console-validation Integration

**Package Location**: `packages/console-validation/`

The console-validation package provides Zod schemas that should be the source of truth for test data validation.

#### Available Schemas

| Schema | Location | Usage in Test Data |
|--------|----------|-------------------|
| `sourceTypeSchema` | `schemas/sources.ts:23-26` | Validate `source` field |
| `entityCategorySchema` | `schemas/entities.ts:9-17` | Validate entity categories |
| `ENTITY_CATEGORIES` | `schemas/entities.ts:24` | Iterate all valid categories |
| `configStatusSchema` | `schemas/sources.ts:36-42` | Validate config statuses |
| `syncStatusSchema` | `schemas/sources.ts:63-67` | Validate sync statuses |

#### Integration Opportunities

1. **Replace string literals with schema validation**:
```typescript
// Current (test-data)
source: "github" | "vercel"

// Proposed (using console-validation)
import { sourceTypeSchema, type SourceType } from "@repo/console-validation";
source: SourceType  // Validated at runtime
```

2. **Use entity category enum**:
```typescript
// Current (hardcoded)
category: "security" | "performance" | ...

// Proposed
import { entityCategorySchema, ENTITY_CATEGORIES } from "@repo/console-validation";
// Factory can generate entities for all valid categories
```

3. **Add validation to factories**:
```typescript
// New: Validate observation data before injection
import { sourceTypeSchema } from "@repo/console-validation";

class ObservationFactory {
  custom(template: Partial<ObservationTemplate>): this {
    // Validate source type
    sourceTypeSchema.parse(template.source);
    // ...
  }
}
```

---

### @repo/console-types Integration

**Package Location**: `packages/console-types/`

The console-types package provides production interfaces that test data should mirror exactly.

#### Available Types (Neural Memory)

| Type | Location | Description |
|------|----------|-------------|
| `SourceEvent` | `neural/source-event.ts:7-37` | Standardized event format |
| `SourceActor` | `neural/source-event.ts:42-47` | Actor who performed action |
| `SourceReference` | `neural/source-event.ts:52-68` | Relationship references |
| `ExtractedEntity` | `neural/entity.ts:6-17` | Extracted entity with confidence |
| `EntitySearchResult` | `neural/entity.ts:22-39` | Entity search result shape |

#### Available Types (Integrations)

| Type | Location | Description |
|------|----------|-------------|
| `InternalEventType` | `integrations/event-types.ts:92` | Valid event type union |
| `INTERNAL_EVENT_TYPES` | `integrations/event-types.ts:25-87` | Event config with weights |
| `getEventWeight()` | `integrations/event-types.ts:111-116` | Get base significance weight |
| `GITHUB_EVENTS` | `integrations/events.ts:2-28` | GitHub event definitions |
| `VERCEL_EVENTS` | `integrations/events.ts:30-56` | Vercel event definitions |

#### Available Types (API)

| Type | Location | Description |
|------|----------|-------------|
| `SearchRequest` | `api/search.ts:13-27` | Search request schema |
| `SearchResult` | `api/search.ts:34-47` | Individual search result |
| `SearchResponse` | `api/search.ts:54-61` | Complete search response |

---

### Proposed Type Architecture

#### 1. Eliminate Duplicate Types

**Current duplication in `packages/console-test-data/src/types.ts`:**

| Test Data Type | Console Types Equivalent | Action |
|---------------|--------------------------|--------|
| `TestObservation` | `SourceEvent` | Replace with SourceEvent |
| `TestActor` | `SourceActor` | Replace with SourceActor |
| (missing) | `SourceReference` | Add support |
| (missing) | `ExtractedEntity` | Add support |
| (missing) | `InternalEventType` | Use for sourceType validation |

#### 2. New Type Imports

```typescript
// packages/console-test-data/src/types/index.ts

// ======== From @repo/console-validation ========
export {
  // Schemas for runtime validation
  sourceTypeSchema,
  entityCategorySchema,
  ENTITY_CATEGORIES,
} from "@repo/console-validation";

export type {
  SourceType,
  EntityCategory,
} from "@repo/console-validation";

// ======== From @repo/console-types ========
export type {
  // Neural memory types
  SourceEvent,
  SourceActor,
  SourceReference,
  ExtractedEntity,
  EntitySearchResult,

  // Event system types
  InternalEventType,

  // API types
  SearchRequest,
  SearchResult,
  SearchResponse,
} from "@repo/console-types";

export {
  // Event config for scoring
  INTERNAL_EVENT_TYPES,
  getEventWeight,
  isInternalEventType,

  // Event constants
  GITHUB_EVENTS,
  VERCEL_EVENTS,
  ALL_GITHUB_EVENTS,
  ALL_VERCEL_EVENTS,
} from "@repo/console-types";

// ======== Test-specific extensions ========
// Only define types that are UNIQUE to testing

export interface TestScenario {
  name: string;
  description: string;
  events: SourceEvent[];  // Use production type
  entities?: ExtractedEntity[];  // Optional pre-defined entities
  expectedClusters?: number;  // Expected cluster count
  searchTests: SearchTestCase[];
}

export interface SearchTestCase {
  query: string;
  filters?: Partial<SearchFilters>;
  expectations: {
    minResults?: number;
    maxResults?: number;
    llmShouldTrigger?: boolean;
    mustIncludeObservationTitles?: string[];
    mustIncludeEntityKeys?: string[];
  };
}

export interface InjectionResult {
  success: boolean;
  observations: { created: number; skipped: number };
  entities: { created: number; merged: number };
  clusters: { created: number; assigned: number };
  vectors: {
    title: number;
    content: number;
    summary: number;
  };
  actorProfiles: number;
  errors: string[];
  duration: number;
}
```

#### 3. Factory Using Production Types

```typescript
// packages/console-test-data/src/factories/event-factory.ts

import type { SourceEvent, SourceActor, SourceReference } from "@repo/console-types";
import { INTERNAL_EVENT_TYPES, getEventWeight } from "@repo/console-types";
import { sourceTypeSchema, type SourceType } from "@repo/console-validation";

export class EventFactory {
  private events: SourceEvent[] = [];

  /**
   * Create a GitHub PR merged event
   */
  prMerged(options: {
    title: string;
    body: string;
    actor: SourceActor;
    prNumber: number;
    baseBranch?: string;
    headBranch?: string;
  }): this {
    const event: SourceEvent = {
      source: "github",
      sourceType: "pull-request.merged",  // Uses InternalEventType
      sourceId: `pr:test/repo#${options.prNumber}`,
      title: options.title,
      body: options.body,
      actor: options.actor,
      occurredAt: new Date().toISOString(),
      references: [
        { type: "pr", id: String(options.prNumber) },
        { type: "branch", id: options.baseBranch ?? "main" },
        { type: "branch", id: options.headBranch ?? "feature" },
      ],
      metadata: {
        testData: true,
        weight: getEventWeight("pull-request.merged"),  // Uses production scoring
      },
    };
    this.events.push(event);
    return this;
  }

  /**
   * Create events for all internal event types
   */
  allEventTypes(): this {
    for (const [eventType, config] of Object.entries(INTERNAL_EVENT_TYPES)) {
      // Generate one event per type using production config
    }
    return this;
  }

  build(): SourceEvent[] {
    return [...this.events];
  }
}
```

#### 4. Entity Factory Using Validation Schemas

```typescript
// packages/console-test-data/src/factories/entity-factory.ts

import type { ExtractedEntity } from "@repo/console-types";
import { ENTITY_CATEGORIES, type EntityCategory } from "@repo/console-validation";

export class EntityFactory {
  private entities: ExtractedEntity[] = [];

  /**
   * Create entities for all categories
   */
  allCategories(): this {
    for (const category of ENTITY_CATEGORIES) {
      this.add(category, this.sampleKeyForCategory(category));
    }
    return this;
  }

  /**
   * Add an entity with validation
   */
  add(category: EntityCategory, key: string, confidence = 0.85): this {
    this.entities.push({
      category,  // Type-checked against EntityCategory
      key,
      confidence,
      evidence: `Test entity for ${category}`,
    });
    return this;
  }

  private sampleKeyForCategory(category: EntityCategory): string {
    const samples: Record<EntityCategory, string> = {
      engineer: "@test-user",
      project: "#123",
      endpoint: "GET /api/users",
      config: "DATABASE_URL",
      definition: "src/lib/auth.ts",
      service: "stripe",
      reference: "abc1234",
    };
    return samples[category];
  }

  build(): ExtractedEntity[] {
    return [...this.entities];
  }
}
```

#### 5. Search Verification Using API Types

```typescript
// packages/console-test-data/src/verifier/search-verifier.ts

import type { SearchRequest, SearchResponse, SearchResult } from "@repo/console-types";

export interface SearchVerificationResult {
  query: string;
  passed: boolean;
  response: SearchResponse;
  expectations: SearchExpectations;
  failures: string[];
}

export class SearchVerifier {
  async verifyScenario(scenario: TestScenario): Promise<SearchVerificationResult[]> {
    const results: SearchVerificationResult[] = [];

    for (const test of scenario.searchTests) {
      const request: SearchRequest = {
        query: test.query,
        topK: 10,
        filters: test.filters,
        includeHighlights: true,
      };

      const response = await this.executeSearch(request);
      const verification = this.verify(response, test.expectations);
      results.push(verification);
    }

    return results;
  }
}
```

---

### Dependency Graph (After Integration)

```
@repo/console-test-data
    ├── @repo/console-validation (types + runtime validation)
    │   ├── sourceTypeSchema
    │   ├── entityCategorySchema
    │   └── ENTITY_CATEGORIES
    │
    ├── @repo/console-types (interfaces + constants)
    │   ├── SourceEvent, SourceActor, SourceReference
    │   ├── ExtractedEntity, EntitySearchResult
    │   ├── INTERNAL_EVENT_TYPES, getEventWeight
    │   ├── GITHUB_EVENTS, VERCEL_EVENTS
    │   └── SearchRequest, SearchResult, SearchResponse
    │
    └── @db/console (for direct DB access)
        ├── workspaceNeuralObservations
        ├── workspaceNeuralEntities
        ├── workspaceObservationClusters
        ├── workspaceActorProfiles
        └── workspaceActorIdentities
```

---

### Benefits of Tighter Integration

| Benefit | Before | After |
|---------|--------|-------|
| **Type Safety** | Custom types, may drift | Production types, always aligned |
| **Validation** | None at factory level | Zod runtime validation |
| **Event Types** | String literals | `InternalEventType` union |
| **Entity Categories** | String literals | `EntityCategory` enum |
| **Scoring** | Inline calculation | `getEventWeight()` function |
| **Search Testing** | Count verification | Full `SearchResponse` validation |
| **Maintenance** | Update in 2 places | Single source of truth |

---

## Conclusion

The current `@repo/console-test-data` package requires significant re-architecture to support neural memory V1 testing:

1. **Type Alignment**: Replace custom types with imports from `@repo/console-types` and `@db/console`
2. **Validation Integration**: Use `@repo/console-validation` schemas for runtime validation
3. **Entity Support**: Add factories, injectors, and verifiers for the entity system
4. **Cluster Support**: Add cluster generation with configurable affinity
5. **Actor Support**: Enhance with profile and identity injection
6. **Multi-View Embeddings**: Update injector to create 3 embeddings per observation
7. **Search Verification**: Add search quality testing with sample queries
8. **Scenario Coverage**: Add scenarios for each implementation day

**Key Integration Points:**
- Import `SourceEvent`, `SourceActor`, `SourceReference` from `@repo/console-types`
- Import `entityCategorySchema`, `sourceTypeSchema` from `@repo/console-validation`
- Use `INTERNAL_EVENT_TYPES` and `getEventWeight()` for accurate significance scoring
- Use `SearchRequest`/`SearchResponse` for search verification

The architecture should prioritize reusing production interfaces to ensure test data accurately represents what the system will process in production.
