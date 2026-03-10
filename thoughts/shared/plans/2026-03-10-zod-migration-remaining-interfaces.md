# Zod Migration: Remaining TypeScript Interfaces Implementation Plan

## Overview

Convert 20 remaining plain TypeScript `interface`/`type` declarations to Zod schemas across `@repo/console-providers`, `@repo/console-validation`, and the neural pipeline in `api/console/src/inngest/workflow/neural/`. This completes the Zod-first migration for all data-shape types in the codebase.

**Excluded from scope:** Document processing types (`ProcessDocumentEvent`, `BasePrepared`, `ReadyDocument`, `SkippedDocument`, `PreparedDocument`), function-bearing interfaces (`SimpleEventDef`, `ActionEventDef`, `WebhookDef`, `OAuthDef`, `ProviderDefinition`, `ExtractionPattern`), type-level computations (`ProviderConfigMap`, `ProviderName`, `SourceType`, `ActionsOf`, `DeriveProviderKeys`, `EventKey`), and `CallbackResult<T>` (generic constraint with existing Zod schema).

## Current State Analysis

The codebase is predominantly Zod-first. All provider `schemas.ts` and `auth.ts` files use Zod. `TransformContext` and `BaseProviderAccountInfo` in `types.ts` were already migrated to Zod schemas. The remaining 20 interfaces fall into three buckets:

1. **7 trivial in-place conversions** — zero or near-zero cross-file impact
2. **5 provider framework data shapes** — used as generic constraints and in 2-3 consumer files
3. **8 neural pipeline interfaces** — all module-private, used only in their defining files

### Key Discoveries:
- `TransformContext` and `BaseProviderAccountInfo` already have Zod schemas (`packages/console-providers/src/types.ts:3-9,37-48`)
- `OperationMetric` is already a manual union of `z.infer<>` variants — just needs simplification (`packages/console-validation/src/schemas/metrics.ts:331-344`)
- `ValidationResult<T>` is module-private and only used as return type of one function — excluded from migration (no benefit)
- All 8 neural pipeline interfaces are module-private (not exported) — zero external consumers
- `GitHubWebhookEventType`, `LinearWebhookEventType`, `SentryWebhookEventType` are barrel-exported but have zero consumer import sites in source

## Desired End State

Every data-shape `interface`/`type` that can be expressed as a Zod schema is converted to follow the established convention:

```typescript
// Schema definition with *Schema suffix
export const fooSchema = z.object({ ... });
// Type alias derived from schema (drops "Schema" suffix)
export type Foo = z.infer<typeof fooSchema>;
```

Neural pipeline schemas live in `@repo/console-validation` (new `schemas/neural.ts` file), following the existing `workflow-io.ts` pattern. Provider framework schemas remain in-place in their defining files.

### Verification:
- `pnpm check` passes (no lint errors)
- `pnpm typecheck` passes (no type errors)
- No `interface` or manual `type` declarations remain for data-shape types outside the "must stay as TypeScript" list
- All existing tests continue to pass

## What We're NOT Doing

- Converting function-bearing interfaces (`SimpleEventDef`, `ActionEventDef`, `WebhookDef`, `OAuthDef`, `ProviderDefinition`, `ExtractionPattern`)
- Converting type-level computations (`ProviderConfigMap`, `ProviderName`, `SourceType`, `ActionsOf`, `DeriveProviderKeys`, `EventKey`)
- Converting `CallbackResult<T>` (parameterized generic with existing non-generic Zod schema)
- Converting `ValidationResult<T>` (module-private, trivial, no real benefit)
- Converting document processing types (`ProcessDocumentEvent`, `BasePrepared`, `ReadyDocument`, `SkippedDocument`, `PreparedDocument`)
- Adding runtime validation calls where none exist — this is a types-only migration
- Moving existing schemas between packages (only new neural schemas go to `@repo/console-validation`)

## Implementation Approach

Each phase converts types in-place following the `*Schema` + `z.infer<>` convention. We work from lowest-risk (zero consumers) to highest-risk (multiple consumers, generic constraints). Neural pipeline types are extracted to `@repo/console-validation` to keep workflow files focused on orchestration logic.

---

## Phase 1: Trivial In-Place Conversions

### Overview
Convert 7 types with zero or near-zero cross-file impact. Each change is isolated to a single file plus its barrel export.

### Changes Required:

#### 1. `SentryInstallationToken` → `sentryInstallationTokenSchema`
**File**: `packages/console-providers/src/providers/sentry/auth.ts`
**Changes**: Replace interface with Zod schema, keep `z.infer<>` alias

```typescript
// BEFORE (line 53):
export interface SentryInstallationToken {
  installationId: string;
  token: string;
}

// AFTER:
export const sentryInstallationTokenSchema = z.object({
  installationId: z.string(),
  token: z.string(),
});
export type SentryInstallationToken = z.infer<typeof sentryInstallationTokenSchema>;
```

**Consumers**: `encodeSentryToken` and `decodeSentryToken` in same file — no changes needed (structural typing). Barrel export in `index.ts:199` already exports the type; add schema export.

**Barrel update** (`packages/console-providers/src/index.ts`):
- Add `sentryInstallationTokenSchema` to the Sentry auth value exports (line 204-212 block)

#### 2. `GitHubWebhookEventType` → `githubWebhookEventTypeSchema`
**File**: `packages/console-providers/src/providers/github/schemas.ts`
**Changes**: Replace string union with `z.enum()`, keep `z.infer<>` alias

```typescript
// BEFORE (line 190):
export type GitHubWebhookEventType =
  | "push"
  | "pull_request"
  | "issues"
  | "release"
  | "discussion";

// AFTER:
export const githubWebhookEventTypeSchema = z.enum([
  "push",
  "pull_request",
  "issues",
  "release",
  "discussion",
]);
export type GitHubWebhookEventType = z.infer<typeof githubWebhookEventTypeSchema>;
```

**Consumers**: Zero external consumer import sites. Barrel re-export only.

**Barrel update** (`packages/console-providers/src/index.ts`):
- Add `githubWebhookEventTypeSchema` to the GitHub schemas value exports (line 40-47 block)

#### 3. `LinearWebhookEventType` → `linearWebhookEventTypeSchema`
**File**: `packages/console-providers/src/providers/linear/schemas.ts`
**Changes**: Replace string union with `z.enum()`, keep `z.infer<>` alias

```typescript
// BEFORE (line 276):
export type LinearWebhookEventType =
  | "Issue"
  | "Comment"
  | "Project"
  | "Cycle"
  | "ProjectUpdate";

// AFTER:
export const linearWebhookEventTypeSchema = z.enum([
  "Issue",
  "Comment",
  "Project",
  "Cycle",
  "ProjectUpdate",
]);
export type LinearWebhookEventType = z.infer<typeof linearWebhookEventTypeSchema>;
```

**Consumers**: Zero external consumer import sites.

**Barrel update** (`packages/console-providers/src/index.ts`):
- Add `linearWebhookEventTypeSchema` to the Linear schemas value exports (line 76-83 block)

#### 4. `SentryWebhookEventType` → `sentryWebhookEventTypeSchema`
**File**: `packages/console-providers/src/providers/sentry/schemas.ts`
**Changes**: Replace string union with `z.enum()`, keep `z.infer<>` alias

```typescript
// BEFORE (line 229):
export type SentryWebhookEventType =
  | "issue"
  | "error"
  | "event_alert"
  | "metric_alert";

// AFTER:
export const sentryWebhookEventTypeSchema = z.enum([
  "issue",
  "error",
  "event_alert",
  "metric_alert",
]);
export type SentryWebhookEventType = z.infer<typeof sentryWebhookEventTypeSchema>;
```

**Consumers**: Zero external consumer import sites.

**Barrel update** (`packages/console-providers/src/index.ts`):
- Add `sentryWebhookEventTypeSchema` to the Sentry schemas value exports (line 102-108 block)

#### 5. `ExtractedEntity` → `extractedEntitySchema`
**File**: `packages/console-validation/src/schemas/entities.ts`
**Changes**: Replace interface with Zod schema using existing `entityCategorySchema`

```typescript
// BEFORE (line 71):
export interface ExtractedEntity {
  category: EntityCategory;
  confidence: number;
  evidence: string;
  key: string;
  value?: string;
}

// AFTER:
export const extractedEntitySchema = z.object({
  category: entityCategorySchema,
  confidence: z.number(),
  evidence: z.string(),
  key: z.string(),
  value: z.string().optional(),
});
export type ExtractedEntity = z.infer<typeof extractedEntitySchema>;
```

**Consumers** (all use `ExtractedEntity` as a type — no code changes needed):
- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:1` — type import, structural compatibility preserved
- `api/console/src/inngest/workflow/neural/observation-capture.ts:38` — type import
- `api/console/src/inngest/workflow/neural/llm-entity-extraction-workflow.ts:16` — type import

The `extractedEntitySchema` will be auto-exported via `export * from "./schemas/entities"` in `packages/console-validation/src/index.ts:109`.

#### 6. `EntitySearchResult` → `entitySearchResultSchema`
**File**: `packages/console-validation/src/schemas/entities.ts`
**Changes**: Replace interface with Zod schema

```typescript
// BEFORE (line 87):
export interface EntitySearchResult {
  confidence: number;
  entityCategory: EntityCategory;
  entityId: string;
  entityKey: string;
  observationId: string;
  observationSnippet: string;
  observationTitle: string;
  occurrenceCount: number;
}

// AFTER:
export const entitySearchResultSchema = z.object({
  confidence: z.number(),
  entityCategory: entityCategorySchema,
  entityId: z.string(),
  entityKey: z.string(),
  observationId: z.string(),
  observationSnippet: z.string(),
  observationTitle: z.string(),
  occurrenceCount: z.number(),
});
export type EntitySearchResult = z.infer<typeof entitySearchResultSchema>;
```

**Consumers** (both use as type — no code changes needed):
- `apps/console/src/lib/neural/entity-search.ts:8` — type import
- `apps/console/src/lib/neural/four-path-search.ts:21` — type import

Auto-exported via barrel.

#### 7. `OperationMetric` → `z.infer<typeof operationMetricSchema>`
**File**: `packages/console-validation/src/schemas/metrics.ts`
**Changes**: Simplify manual union to `z.infer<typeof operationMetricSchema>`

```typescript
// BEFORE (line 331):
export type OperationMetric =
  | z.infer<typeof jobDurationMetricSchema>
  | z.infer<typeof documentsIndexedMetricSchema>
  | z.infer<typeof errorMetricSchema>
  | z.infer<typeof observationCapturedMetricSchema>
  | z.infer<typeof observationFilteredMetricSchema>
  | z.infer<typeof observationDuplicateMetricSchema>
  | z.infer<typeof observationBelowThresholdMetricSchema>
  | z.infer<typeof entitiesExtractedMetricSchema>
  | z.infer<typeof clusterAssignedMetricSchema>
  | z.infer<typeof clusterSummaryGeneratedMetricSchema>
  | z.infer<typeof profileUpdatedMetricSchema>
  | z.infer<typeof actorResolutionMetricSchema>
  | z.infer<typeof clusterAffinityMetricSchema>;

// AFTER:
export type OperationMetric = z.infer<typeof operationMetricSchema>;
```

**Consumers**: Zero external import sites. Auto-exported via barrel.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] All existing tests pass: `pnpm --filter @repo/console-providers test`

#### Manual Verification:
- [x] Verify barrel exports are correct by checking `pnpm --filter @repo/console-providers build` succeeds
- [x] Verify `pnpm --filter @repo/console-validation build` succeeds

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Provider Framework Data Shapes

### Overview
Convert 5 types in `define.ts` and `registry.ts`. These are used as generic constraints and in 2-3 consumer files. The key risk is that `CategoryDef` and `ActionDef` are used as generic constraint types in function-bearing interfaces (`SimpleEventDef`, `ActionEventDef`, `ProviderDefinition`, `defineProvider`).

**Strategy**: Convert to Zod schemas and keep `z.infer<>` type aliases. The generic constraints (`TCategories extends Record<string, CategoryDef>`) continue to work because the type alias is structurally identical.

### Changes Required:

#### 1. `CategoryDef` → `categoryDefSchema`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Replace interface with Zod schema. The type alias preserves the generic constraint usage.

```typescript
// BEFORE (line 11):
export interface CategoryDef {
  description: string;
  label: string;
  type: "observation" | "sync+observation";
}

// AFTER:
import { z } from "zod";

export const categoryDefSchema = z.object({
  description: z.string(),
  label: z.string(),
  type: z.enum(["observation", "sync+observation"]),
});
export type CategoryDef = z.infer<typeof categoryDefSchema>;
```

**Impact on generics**: `TCategories extends Record<string, CategoryDef>` at lines 136, 194 continues to work — the inferred type alias is structurally identical to the interface.

**Consumers**:
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/source-settings-form.tsx:117` — casts `Object.entries(eventConfig) as [string, CategoryDef][]`. No change needed (type alias preserved).

**Note**: `define.ts` currently has `import type { z } from "zod"` at line 2. We need to change this to a value import `import { z } from "zod"` since we're now using `z.object()` at runtime.

#### 2. `ActionDef` → `actionDefSchema`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Replace interface with Zod schema

```typescript
// BEFORE (line 18):
export interface ActionDef {
  label: string;
  weight: number;
}

// AFTER:
export const actionDefSchema = z.object({
  label: z.string(),
  weight: z.number(),
});
export type ActionDef = z.infer<typeof actionDefSchema>;
```

**Impact on generics**: `TActions extends Record<string, ActionDef>` at lines 38, 54, 67 continues to work.

**Consumers**: Zero non-barrel consumers.

#### 3. `RuntimeConfig` → `runtimeConfigSchema`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Replace interface with Zod schema

```typescript
// BEFORE (line 129):
export interface RuntimeConfig {
  callbackBaseUrl: string;
}

// AFTER:
export const runtimeConfigSchema = z.object({
  callbackBaseUrl: z.string(),
});
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
```

**Consumers** (both use as type annotation — no code changes needed):
- `apps/gateway/src/routes/connections.ts:31` — `const runtime: RuntimeConfig = { callbackBaseUrl: gatewayBaseUrl }`
- `apps/gateway/src/workflows/connection-teardown.ts:63` — `const teardownRuntime: RuntimeConfig = { ... }`

#### 4. `IconDef` → `iconDefSchema`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Replace interface with Zod schema

```typescript
// BEFORE (line 256):
export interface IconDef {
  readonly d: string;
  readonly viewBox: string;
}

// AFTER:
export const iconDefSchema = z.object({
  d: z.string(),
  viewBox: z.string(),
});
export type IconDef = z.infer<typeof iconDefSchema>;
```

**Note**: We drop the `readonly` modifiers since the Zod-inferred type is structurally compatible with readonly usage. The objects are frozen in practice (provider definitions are `Object.freeze`d).

**Consumers**:
- `packages/console-providers/src/display.ts:1` — imports the type
- `apps/console/src/lib/provider-icon.tsx:7` — `{ icon: IconDef }` prop type

Neither consumer needs changes.

#### 5. `EventRegistryEntry` → `eventRegistryEntrySchema`
**File**: `packages/console-providers/src/registry.ts`
**Changes**: Replace interface with Zod schema, using `sourceTypeSchema` for the `source` field

```typescript
// BEFORE (line 80):
export interface EventRegistryEntry {
  category: string;
  externalKeys: readonly string[];
  label: string;
  source: SourceType;
  weight: number;
}

// AFTER:
export const eventRegistryEntrySchema = z.object({
  category: z.string(),
  externalKeys: z.array(z.string()).readonly(),
  label: z.string(),
  source: sourceTypeSchema,
  weight: z.number(),
});
export type EventRegistryEntry = z.infer<typeof eventRegistryEntrySchema>;
```

**Consumers**: `registry.test.ts:9` imports for `expectTypeOf` assertions — type alias preserves compatibility. The runtime `EVENT_REGISTRY` value (typed `Record<EventKey, EventRegistryEntry>`) has 5 consumer sites that index by key — all work via structural typing.

### Barrel Updates

**File**: `packages/console-providers/src/index.ts`

Add schema exports:
- Add `categoryDefSchema`, `actionDefSchema`, `runtimeConfigSchema`, `iconDefSchema` to the `define.ts` value exports block (lines 15-18)
- Add `eventRegistryEntrySchema` to the `registry.ts` value exports block (lines 239-248)

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] Provider tests pass: `pnpm --filter @repo/console-providers test`
- [ ] Console build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Source settings form renders correctly (uses `CategoryDef` cast)
- [ ] Provider icon renders correctly (uses `IconDef` prop type)
- [ ] Gateway connection flow works (uses `RuntimeConfig`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Neural Pipeline Schemas

### Overview
Convert 8 module-private neural pipeline interfaces to Zod schemas and move them to a new `packages/console-validation/src/schemas/neural.ts` file. This centralizes neural data contracts in `@repo/console-validation` (following the existing `workflow-io.ts` pattern) and makes them available for runtime validation in the future.

All 8 types are currently module-private (not exported) and used only in their defining files. Migration risk is minimal.

### Changes Required:

#### 1. Create `packages/console-validation/src/schemas/neural.ts`

**New file** containing all neural pipeline data shape schemas:

```typescript
import { z } from "zod";
import type { PostTransformActor } from "@repo/console-providers";

// ── Significance Scoring ──────────────────────────────────────────────────────

export const significanceResultSchema = z.object({
  factors: z.array(z.string()),
  score: z.number(),
});

export type SignificanceResult = z.infer<typeof significanceResultSchema>;

// ── Actor Resolution ──────────────────────────────────────────────────────────

export const resolvedActorSchema = z.object({
  actorId: z.string().nullable(),
  sourceActor: z.custom<PostTransformActor>().nullable(),
});

export type ResolvedActor = z.infer<typeof resolvedActorSchema>;

// ── Observation Vector Metadata ───────────────────────────────────────────────

export const observationVectorMetadataSchema = z.object({
  actorName: z.string(),
  layer: z.string(),
  observationId: z.string(),
  observationType: z.string(),
  occurredAt: z.string(),
  snippet: z.string(),
  source: z.string(),
  sourceId: z.string(),
  sourceType: z.string(),
  title: z.string(),
  view: z.enum(["title", "content", "summary"]),
}).catchall(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]));

export type ObservationVectorMetadata = z.infer<typeof observationVectorMetadataSchema>;

// ── Multi-View Embedding Result ───────────────────────────────────────────────

const embeddingViewSchema = z.object({
  vectorId: z.string(),
  vector: z.array(z.number()),
});

export const multiViewEmbeddingResultSchema = z.object({
  content: embeddingViewSchema,
  legacyVectorId: z.string(),
  summary: embeddingViewSchema,
  title: embeddingViewSchema,
});

export type MultiViewEmbeddingResult = z.infer<typeof multiViewEmbeddingResultSchema>;

// ── Relationship Detection ────────────────────────────────────────────────────

export const detectedRelationshipSchema = z.object({
  confidence: z.number(),
  linkingKey: z.string(),
  linkingKeyType: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  relationshipType: z.string(),
  targetObservationId: z.number(),
});

export type DetectedRelationship = z.infer<typeof detectedRelationshipSchema>;

// ── Cluster Assignment ────────────────────────────────────────────────────────

export const clusterAssignmentInputSchema = z.object({
  actorId: z.string().nullable(),
  embeddingVector: z.array(z.number()),
  entityIds: z.array(z.string()),
  indexName: z.string(),
  namespace: z.string(),
  occurredAt: z.string(),
  title: z.string(),
  topics: z.array(z.string()),
  vectorId: z.string(),
  workspaceId: z.string(),
});

export type ClusterAssignmentInput = z.infer<typeof clusterAssignmentInputSchema>;

export const clusterAssignmentResultSchema = z.object({
  affinityScore: z.number().nullable(),
  clusterId: z.number(),
  isNew: z.boolean(),
});

export type ClusterAssignmentResult = z.infer<typeof clusterAssignmentResultSchema>;

// ── Neural Failure Output ─────────────────────────────────────────────────────

export const neuralFailureOutputSchema = z.object({
  error: z.string(),
  inngestFunctionId: z.string(),
  status: z.literal("failure"),
}).catchall(z.unknown());

export type NeuralFailureOutput = z.infer<typeof neuralFailureOutputSchema>;
```

#### 2. Register barrel export
**File**: `packages/console-validation/src/index.ts`
**Changes**: Add `export * from "./schemas/neural";` after the `workflow-io` export (line 119)

#### 3. Update `scoring.ts`
**File**: `api/console/src/inngest/workflow/neural/scoring.ts`
**Changes**: Remove local `SignificanceResult` interface, import from `@repo/console-validation`

```typescript
// REMOVE (line 43-46):
// interface SignificanceResult {
//   factors: string[];
//   score: number;
// }

// ADD import:
import type { SignificanceResult } from "@repo/console-validation";
```

#### 4. Update `actor-resolution.ts`
**File**: `api/console/src/inngest/workflow/neural/actor-resolution.ts`
**Changes**: Remove local `ResolvedActor` interface, import from `@repo/console-validation`

```typescript
// REMOVE (line 24-29):
// interface ResolvedActor { ... }

// ADD import:
import type { ResolvedActor } from "@repo/console-validation";
```

#### 5. Update `observation-capture.ts`
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Changes**: Remove local `ObservationVectorMetadata` and `MultiViewEmbeddingResult` interfaces, import from `@repo/console-validation`

```typescript
// REMOVE (lines 79-114):
// interface ObservationVectorMetadata { ... }
// interface MultiViewEmbeddingResult { ... }

// ADD to existing @repo/console-validation import (line 43-44):
import type {
  ClassificationResponse,
  ExtractedEntity,
  MultiViewEmbeddingResult,
  NeuralObservationCaptureInput,
  NeuralObservationCaptureOutputFailure,
  NeuralObservationCaptureOutputFiltered,
  NeuralObservationCaptureOutputSuccess,
  ObservationVectorMetadata,
} from "@repo/console-validation";
```

#### 6. Update `relationship-detection.ts`
**File**: `api/console/src/inngest/workflow/neural/relationship-detection.ts`
**Changes**: Remove local `DetectedRelationship` interface, import from `@repo/console-validation`

```typescript
// REMOVE (lines 31-38):
// interface DetectedRelationship { ... }

// ADD import:
import type { DetectedRelationship } from "@repo/console-validation";
```

**Note**: The `relationshipType` field in the schema uses `z.string()` rather than a specific enum because the `RelationshipType` type comes from `@db/console/schema` (a different package). Using `z.string()` avoids a circular dependency. The type annotation on the consuming code still gets full type safety from the `satisfies` pattern used at insert sites.

#### 7. Update `cluster-assignment.ts`
**File**: `api/console/src/inngest/workflow/neural/cluster-assignment.ts`
**Changes**: Remove local `ClusterAssignmentInput` and `ClusterAssignmentResult` interfaces, import from `@repo/console-validation`

```typescript
// REMOVE (lines 26-43):
// interface ClusterAssignmentInput { ... }
// interface ClusterAssignmentResult { ... }

// ADD import:
import type {
  ClusterAssignmentInput,
  ClusterAssignmentResult,
} from "@repo/console-validation";
```

#### 8. Update `on-failure-handler.ts`
**File**: `api/console/src/inngest/workflow/neural/on-failure-handler.ts`
**Changes**: Remove local `NeuralFailureOutput` interface, import from `@repo/console-validation`

```typescript
// REMOVE (lines 36-41):
// interface NeuralFailureOutput { ... }

// ADD to existing @repo/console-validation import (line 30):
import type { NeuralFailureOutput, WorkflowOutput } from "@repo/console-validation";
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] Console validation build succeeds: `pnpm --filter @repo/console-validation build`
- [x] Console API build succeeds: `pnpm --filter @api/console typecheck`

#### Manual Verification:
- [ ] Neural observation capture workflow processes events correctly (test via webhook injection)
- [ ] No regressions in cluster assignment or relationship detection

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Testing Strategy

### Unit Tests:
- Existing provider tests (`pnpm --filter @repo/console-providers test`) validate that all provider definitions, transformers, and encode/decode functions work correctly
- Existing validation tests validate schema parsing
- No new unit tests needed — this is a types-only migration that preserves structural compatibility

### Integration Tests:
- `pnpm typecheck` across the entire monorepo is the primary integration test — it validates all import sites and structural compatibility
- `pnpm check` validates that exports are correct (knip + biome)

### Manual Testing Steps:
1. Trigger a webhook event and verify neural observation capture completes successfully
2. Verify source settings form renders provider event categories correctly
3. Verify gateway OAuth connection flow works end-to-end

## Performance Considerations

None. This is a types-only migration at the schema definition level. No runtime behavior changes. Zod schema objects are constructed once at module load time and have negligible memory/performance impact.

## References

- Research document: `thoughts/shared/research/2026-03-10-zod-migration-inventory.md`
- Existing Zod-first pattern: `packages/console-validation/src/schemas/workflow-io.ts`
- Vercel `z.enum()` pattern: `packages/console-providers/src/providers/vercel/schemas.ts:77`
- Provider framework: `packages/console-providers/src/define.ts`
- Neural pipeline: `api/console/src/inngest/workflow/neural/`
