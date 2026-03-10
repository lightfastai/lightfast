---
date: "2026-03-10T20:00:00+08:00"
researcher: claude
git_commit: 9de5c112bbfd921858ca4e940dbbe3798de6455b
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Zod Migration Inventory: All Remaining TypeScript Interfaces Across Providers + Neural Pipeline"
tags: [research, zod, types, migration, console-providers, console-validation, inngest, neural]
status: complete
last_updated: "2026-03-10"
---

# Research: Zod Migration Inventory

**Date**: 2026-03-10T20:00:00+08:00
**Git Commit**: 9de5c112bbfd921858ca4e940dbbe3798de6455b
**Branch**: feat/backfill-depth-entitytypes-run-tracking

## Research Question

Complete inventory of all remaining plain TypeScript `interface` and `type` declarations (not `z.infer<>` aliases) across `@repo/console-providers` and `api/console/src/inngest/`, categorized by migration feasibility.

## Summary

The codebase is already predominantly Zod-first. All provider `schemas.ts` and `auth.ts` files are fully Zod. The remaining plain interfaces fall into two clear buckets:

- **27 data-shape interfaces/types** — pure data contracts that can and should become Zod schemas
- **15 structural/function interfaces** — contain function members, generics, or type-level computations that cannot be expressed as Zod schemas

## Inventory: Types That CAN Become Zod Schemas

### `@repo/console-providers`

#### `packages/console-providers/src/define.ts`

| Interface | Line | Shape | Notes |
|-----------|------|-------|-------|
| `CategoryDef` | 11 | `{ description: string; label: string; type: "observation" \| "sync+observation" }` | Simple enum + strings |
| `ActionDef` | 18 | `{ label: string; weight: number }` | Trivial |
| `RuntimeConfig` | 129 | `{ callbackBaseUrl: string }` | Trivial |
| `IconDef` | 256 | `{ readonly d: string; readonly viewBox: string }` | Trivial |

#### `packages/console-providers/src/types.ts`

| Interface | Line | Shape | Notes |
|-----------|------|-------|-------|
| `TransformContext` | 3 | `{ deliveryId: string; eventType: string; receivedAt: Date }` | Use `z.date()` for `receivedAt` |
| `BaseProviderAccountInfo` | 72 | `{ events: string[]; installedAt: string; lastValidatedAt: string; raw: unknown; sourceType: string; version: 1 }` | Used as generic constraint in `OAuthDef<TConfig, TAccountInfo>`. Can become Zod schema; keep `z.infer<>` as the constraint type |

#### `packages/console-providers/src/validation.ts`

| Interface | Line | Shape | Notes |
|-----------|------|-------|-------|
| `ValidationResult<T>` | 4 | `{ data?: T; errors?: string[]; success: boolean }` | Generic `T` — use `z.custom<T>()` or make non-generic since only used with `PostTransformEvent` |

#### `packages/console-providers/src/providers/sentry/auth.ts`

| Interface | Line | Shape | Notes |
|-----------|------|-------|-------|
| `SentryInstallationToken` | 53 | `{ installationId: string; token: string }` | Trivial |

#### `packages/console-providers/src/registry.ts`

| Interface | Line | Shape | Notes |
|-----------|------|-------|-------|
| `EventRegistryEntry` | 80 | `{ category: string; externalKeys: readonly string[]; label: string; source: SourceType; weight: number }` | Uses `SourceType` — can use `sourceTypeSchema` |

#### `packages/console-providers/src/providers/*/schemas.ts` — String Unions

These string literal unions can become `z.enum()` schemas (Vercel already uses this pattern):

| Type | File | Line | Values |
|------|------|------|--------|
| `GitHubWebhookEventType` | `github/schemas.ts` | 190 | `"push" \| "pull_request" \| "issues" \| "release" \| "discussion"` |
| `LinearWebhookEventType` | `linear/schemas.ts` | 276 | `"Issue" \| "Comment" \| "Project" \| "Cycle" \| "ProjectUpdate"` |
| `SentryWebhookEventType` | `sentry/schemas.ts` | 229 | `"issue" \| "error" \| "event_alert" \| "metric_alert"` |

### `api/console/src/inngest/workflow/neural/`

| Interface | File | Line | Shape |
|-----------|------|------|-------|
| `ObservationVectorMetadata` | `observation-capture.ts` | 79 | Pinecone vector metadata — 12 fields + index signature `[key: string]: string \| number \| boolean \| string[]` |
| `MultiViewEmbeddingResult` | `observation-capture.ts` | 100 | `{ content: {vectorId, vector}, legacyVectorId, summary: {vectorId, vector}, title: {vectorId, vector} }` |
| `DetectedRelationship` | `relationship-detection.ts` | 31 | `{ confidence, linkingKey, linkingKeyType, metadata?, relationshipType, targetObservationId }` |
| `ClusterAssignmentInput` | `cluster-assignment.ts` | 26 | `{ actorId?, embeddingVector, entityIds, indexName, namespace, occurredAt, title, topics, vectorId, workspaceId }` |
| `ClusterAssignmentResult` | `cluster-assignment.ts` | 39 | `{ affinityScore?, clusterId, isNew }` |
| `ResolvedActor` | `actor-resolution.ts` | 24 | `{ actorId: string \| null; sourceActor: PostTransformActor \| null }` |
| `SignificanceResult` | `scoring.ts` | 43 | `{ factors: string[]; score: number }` |
| `NeuralFailureOutput` | `on-failure-handler.ts` | 36 | `{ error: string; inngestFunctionId: string; status: "failure"; [key: string]: unknown }` |

### `api/console/src/inngest/workflow/processing/`

| Interface | File | Line | Shape |
|-----------|------|------|-------|
| `ProcessDocumentEvent` | `process-documents.ts` | 41 | 11 fields — mirrors `apps-console/documents.process` event data |
| `BasePrepared` | `process-documents.ts` | 63 | `{ docId?: string; event: ProcessDocumentEvent }` |
| `ReadyDocument` | `process-documents.ts` | 68 | Extends `BasePrepared` — `{ chunks, configHash, contentHash, docId, embeddings?, existingDoc?, indexName, slug, status: "ready", workspace }` |
| `SkippedDocument` | `process-documents.ts` | 81 | Extends `BasePrepared` — `{ reason: string; status: "skipped" }` |
| `PreparedDocument` | `process-documents.ts` | 61 | `ReadyDocument \| SkippedDocument` — discriminated on `status` |

### `@repo/console-validation` (already in validation package but NOT Zod)

| Interface/Type | File | Line | Shape |
|----------------|------|------|-------|
| `ExtractedEntity` | `schemas/entities.ts` | 71 | Plain interface — 5 fields |
| `EntitySearchResult` | `schemas/entities.ts` | 87 | Plain interface |
| `OperationMetric` | `schemas/metrics.ts` | 331 | Manual union type (mirrors discriminated union) |

---

## Inventory: Types That MUST Stay as TypeScript

These contain function members, generics, or type-level computations that Zod cannot model.

### `packages/console-providers/src/define.ts` — Function-Bearing Interfaces

| Interface | Line | Why |
|-----------|------|-----|
| `SimpleEventDef<S>` | 24 | `transform: (payload, ctx) => PostTransformEvent` function member |
| `ActionEventDef<S, TActions>` | 36 | `transform` function member + generic `TActions` |
| `EventDefinition<S, TActions>` | 52 | Discriminated union of function-bearing interfaces |
| `WebhookDef<TConfig>` | 73 | 7 function members (verify, extract, parse) |
| `OAuthDef<TConfig, TAccountInfo>` | 93 | 6 function members (auth flow) |
| `ProviderDefinition<...>` | 133 | 6 generic params, mixed function + schema fields |

### `packages/console-providers/src/types.ts` — Generic Type

| Type | Line | Why |
|------|------|-----|
| `CallbackResult<TAccountInfo>` | 83 | Parameterized on `TAccountInfo` for per-provider narrowing. Non-generic `callbackResultSchema` already exists |

### `packages/console-providers/src/registry.ts` — Type-Level Computation

| Type | Line | Why |
|------|------|-----|
| `ProviderConfigMap` | 20 | Maps literal provider names to concrete config types — `satisfies` constraint |
| `ProviderName` | 38 | `keyof typeof PROVIDERS` — derived from runtime const |
| `SourceType` | 43 | Alias of `ProviderName` |
| `ActionsOf<E>` | 57 | Conditional type extracting actions from `ActionEventDef` |
| `DeriveProviderKeys<P>` | 65 | Mapped + conditional type deriving `"github:push"` string literals |
| `EventKey` | 74 | Mapped union across all providers |

### `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts`

| Interface | Line | Why |
|-----------|------|-----|
| `ExtractionPattern` | 6 | `keyExtractor: (match: RegExpMatchArray) => string` function member |

---

## Where Migrated Schemas Should Live

Based on established patterns in `@repo/console-validation`:

| Category | Target File | Convention |
|----------|-------------|------------|
| Neural workflow data shapes (`ObservationVectorMetadata`, `DetectedRelationship`, etc.) | `packages/console-validation/src/schemas/neural.ts` (new) | Follow `workflow-io.ts` pattern: `*Schema` + `z.infer<>` alias |
| Document processing shapes (`ProcessDocumentEvent`, `PreparedDocument`, etc.) | `packages/console-validation/src/schemas/documents.ts` (new) or inline in `workflow-io.ts` | Follow discriminated union pattern |
| Provider framework data shapes (`CategoryDef`, `ActionDef`, etc.) | `packages/console-providers/src/define.ts` (in place) | Convert interface → Zod schema in same file, keep `z.infer<>` alias |
| `SentryInstallationToken` | `packages/console-providers/src/providers/sentry/auth.ts` (in place) | Follow existing `auth.ts` pattern |
| `EventRegistryEntry` | `packages/console-providers/src/registry.ts` (in place) | Convert in same file |
| Webhook event type unions | `packages/console-providers/src/providers/*/schemas.ts` (in place) | Follow Vercel's `z.enum()` pattern |
| `ExtractedEntity`, `EntitySearchResult` | `packages/console-validation/src/schemas/entities.ts` (in place) | Already in correct file, just convert |
| `OperationMetric` | `packages/console-validation/src/schemas/metrics.ts` (in place) | Replace manual union with `z.infer<typeof operationMetricSchema>` |

---

## Existing Patterns to Follow

### Schema + Type Alias Convention (from `@repo/console-validation`)
```typescript
// Schema definition with *Schema suffix
export const signficanceResultSchema = z.object({
  factors: z.array(z.string()),
  score: z.number(),
});

// Type alias derived from schema (drops "Schema" suffix)
export type SignificanceResult = z.infer<typeof significanceResultSchema>;
```

### Discriminated Union Convention (from `workflow-io.ts`)
```typescript
const readyDocumentSchema = z.object({ status: z.literal("ready"), ... });
const skippedDocumentSchema = z.object({ status: z.literal("skipped"), ... });
export const preparedDocumentSchema = z.discriminatedUnion("status", [
  readyDocumentSchema,
  skippedDocumentSchema,
]);
```

### Enum Convention (from Vercel `schemas.ts`)
```typescript
// Instead of: type GitHubWebhookEventType = "push" | "pull_request" | ...
export const githubWebhookEventTypeSchema = z.enum(["push", "pull_request", "issues", "release", "discussion"]);
export type GitHubWebhookEventType = z.infer<typeof githubWebhookEventTypeSchema>;
```

---

## Migration Order (Suggested)

### Phase 1: Trivial In-Place Conversions (no cross-package changes)
1. `SentryInstallationToken` → `sentryInstallationTokenSchema` in `sentry/auth.ts`
2. `GitHubWebhookEventType` → `githubWebhookEventTypeSchema` in `github/schemas.ts`
3. `LinearWebhookEventType` → `linearWebhookEventTypeSchema` in `linear/schemas.ts`
4. `SentryWebhookEventType` → `sentryWebhookEventTypeSchema` in `sentry/schemas.ts`
5. `ExtractedEntity` → `extractedEntitySchema` in `entities.ts`
6. `EntitySearchResult` → `entitySearchResultSchema` in `entities.ts`
7. `OperationMetric` → `z.infer<typeof operationMetricSchema>` in `metrics.ts`

### Phase 2: Provider Framework Data Shapes (define.ts + types.ts)
8. `CategoryDef` → `categoryDefSchema` in `define.ts`
9. `ActionDef` → `actionDefSchema` in `define.ts`
10. `RuntimeConfig` → `runtimeConfigSchema` in `define.ts`
11. `IconDef` → `iconDefSchema` in `define.ts`
12. `TransformContext` → `transformContextSchema` in `types.ts`
13. `BaseProviderAccountInfo` → `baseProviderAccountInfoSchema` in `types.ts`
14. `EventRegistryEntry` → `eventRegistryEntrySchema` in `registry.ts`
15. `ValidationResult` → evaluate if generic is needed; if only `PostTransformEvent`, specialize

### Phase 3: Neural Pipeline Schemas (move to `@repo/console-validation`)
16. `SignificanceResult` → `significanceResultSchema`
17. `ResolvedActor` → `resolvedActorSchema`
18. `ObservationVectorMetadata` → `observationVectorMetadataSchema`
19. `MultiViewEmbeddingResult` → `multiViewEmbeddingResultSchema`
20. `DetectedRelationship` → `detectedRelationshipSchema`
21. `ClusterAssignmentInput` → `clusterAssignmentInputSchema`
22. `ClusterAssignmentResult` → `clusterAssignmentResultSchema`
23. `NeuralFailureOutput` → `neuralFailureOutputSchema`

### Phase 4: Document Processing Schemas
24. `ProcessDocumentEvent` → `processDocumentEventSchema`
25. `BasePrepared` + `ReadyDocument` + `SkippedDocument` → discriminated union
26. `PreparedDocument` → `preparedDocumentSchema`

---

## Code References

### `@repo/console-providers`
- `packages/console-providers/src/define.ts` — framework interfaces (lines 11–259)
- `packages/console-providers/src/types.ts` — OAuth + transform types (lines 3–104)
- `packages/console-providers/src/validation.ts` — `ValidationResult<T>` (line 4)
- `packages/console-providers/src/registry.ts` — `EventRegistryEntry` (line 80), type-level types (lines 38–76)
- `packages/console-providers/src/providers/sentry/auth.ts` — `SentryInstallationToken` (line 53)
- `packages/console-providers/src/providers/github/schemas.ts` — `GitHubWebhookEventType` (line 190)
- `packages/console-providers/src/providers/linear/schemas.ts` — `LinearWebhookEventType` (line 276)
- `packages/console-providers/src/providers/sentry/schemas.ts` — `SentryWebhookEventType` (line 229)

### `api/console/src/inngest/workflow/neural/`
- `observation-capture.ts` — `ObservationVectorMetadata` (line 79), `MultiViewEmbeddingResult` (line 100)
- `relationship-detection.ts` — `DetectedRelationship` (line 31)
- `cluster-assignment.ts` — `ClusterAssignmentInput` (line 26), `ClusterAssignmentResult` (line 39)
- `actor-resolution.ts` — `ResolvedActor` (line 24)
- `scoring.ts` — `SignificanceResult` (line 43)
- `on-failure-handler.ts` — `NeuralFailureOutput` (line 36)
- `entity-extraction-patterns.ts` — `ExtractionPattern` (line 6) — CANNOT migrate (function members)

### `api/console/src/inngest/workflow/processing/`
- `process-documents.ts` — `ProcessDocumentEvent` (line 41), `BasePrepared`/`ReadyDocument`/`SkippedDocument`/`PreparedDocument` (lines 61–84)

### `@repo/console-validation`
- `schemas/entities.ts` — `ExtractedEntity` (line 71), `EntitySearchResult` (line 87)
- `schemas/metrics.ts` — `OperationMetric` (line 331)

### Inngest Event Schemas (already Zod)
- `api/console/src/inngest/client/client.ts` — `eventsMap` (lines 20–261), all 11 event schemas
