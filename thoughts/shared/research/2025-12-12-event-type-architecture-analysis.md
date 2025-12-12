---
date: 2025-12-12T16:30:00+08:00
researcher: Claude
git_commit: eba2db85802cdd1a84c53228ac8a2f4ee63b1e59
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Event Type Architecture and Package Relationship Analysis"
tags: [research, codebase, event-types, console-types, console-validation, scoring, neural-memory]
status: complete
last_updated: 2025-12-12
last_updated_by: Claude
---

# Research: Event Type Architecture and Package Relationship Analysis

**Date**: 2025-12-12T16:30:00+08:00
**Researcher**: Claude
**Git Commit**: eba2db85802cdd1a84c53228ac8a2f4ee63b1e59
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

1. Why are event type weights in `scoring.ts` typed as `string` instead of constrained types?
2. Why do naming conventions differ: `release_created` vs `deployment.error`?
3. Should `"github" | "vercel"` string literals reference central schema definitions?
4. What is the relationship between `@repo/console-types` and `@repo/console-validation`?

## Summary

The codebase has **two distinct event naming conventions** (snake_case for GitHub, dot.notation for Vercel) that originate from the external webhook APIs themselves. There are **two central definitions** for provider types (`integrationProviderSchema`, `SourceEvent.source`) but **100+ scattered inline usages** of `"github" | "vercel"` literals. The `@repo/console-types` and `@repo/console-validation` packages have **clear, non-overlapping purposes** - types for domain models/API contracts, validation for input schemas and runtime validation.

## Detailed Findings

### 1. Event Type Naming Conventions

The two naming conventions exist because they mirror the external APIs:

#### GitHub Events (snake_case with action suffix)
- Base events from `x-github-event` header: `push`, `pull_request`, `issues`, `release`, `discussion`
- Transformed to detailed sourceType: `pull_request_opened`, `pull_request_merged`, `issue_closed`, `release_published`
- Generated at `packages/console-webhooks/src/transformers/github.ts:166` using `${event}_${payload.action}`

#### Vercel Events (dot.notation)
- Direct from Vercel webhook `type` field: `deployment.created`, `deployment.succeeded`, `deployment.error`
- No transformation needed - passed through directly at `packages/console-webhooks/src/transformers/vercel.ts:102`

#### Typed Definitions Location

**GitHub Events** (`packages/console-types/src/integrations/events.ts:2-28`):
```typescript
export const GITHUB_EVENTS = {
  push: { label: "Push", ... },
  pull_request: { label: "Pull Requests", ... },
  // ...
} as const;
export type GitHubEvent = keyof typeof GITHUB_EVENTS; // Base events only
```

**Vercel Events** (`packages/console-types/src/integrations/events.ts:30-56`):
```typescript
export const VERCEL_EVENTS = {
  "deployment.created": { label: "Deployment Started", ... },
  "deployment.succeeded": { label: "Deployment Succeeded", ... },
  // ...
} as const;
export type VercelEvent = keyof typeof VERCEL_EVENTS;
```

**Vercel Type Union** (`packages/console-webhooks/src/vercel.ts:36-42`):
```typescript
export type VercelDeploymentEvent =
  | "deployment.created"
  | "deployment.succeeded"
  | "deployment.ready"
  | "deployment.error"
  | "deployment.canceled"
  | "deployment.check-rerequested";
```

### 2. Scoring System Event Weights

**Location**: `api/console/src/inngest/workflow/neural/scoring.ts:37-61`

The `EVENT_TYPE_WEIGHTS` object uses `Record<string, number>` with no type constraints:

```typescript
const EVENT_TYPE_WEIGHTS: Record<string, number> = {
  release_published: 75,
  release_created: 70,
  "deployment.error": 70,
  "deployment.canceled": 65,
  pull_request_merged: 60,
  // ... 10 more entries
  default: 35,
};
```

**SourceEvent.sourceType is typed as `string`** at `packages/console-types/src/neural/source-event.ts:8`:
```typescript
sourceType: string; // e.g., "pull_request_merged", "deployment.succeeded"
```

**Scoring lookup** at `scoring.ts:97-99`:
```typescript
const eventType = sourceEvent.sourceType.toLowerCase();
let score = EVENT_TYPE_WEIGHTS[eventType] ?? defaultWeight;
```

Unrecognized event types fall back to default score (35 points).

### 3. Provider String Literals (`"github" | "vercel"`)

#### Central Definitions (2 locations)

1. **Validation Schema** (`packages/console-validation/src/schemas/sources.ts:19-22, 35-38`):
```typescript
export const integrationProviderSchema = z.enum(["github", "vercel"]);
export const sourceTypeSchema = z.enum(["github", "vercel"]);
```

2. **SourceEvent Interface** (`packages/console-types/src/neural/source-event.ts:7`):
```typescript
source: "github" | "vercel" | "linear" | "sentry";
```

#### Scattered Inline Usages (~100+ locations)

| Category | Files | Example |
|----------|-------|---------|
| Database schema types | 5 | `db/console/src/schema/tables/user-sources.ts:44` |
| Inngest event schemas | 8 | `api/console/src/inngest/client/client.ts:38` - `z.enum(["github", "vercel"])` |
| Transformer outputs | 6 | `packages/console-webhooks/src/transformers/github.ts:52` - `source: "github"` |
| UI component props | 15+ | `apps/console/src/app/.../connect-form-provider.tsx:14` - `provider: "github" \| "vercel"` |
| tRPC routers | 20+ | `api/console/src/router/user/user-sources.ts:247` - `provider: "github" as const` |

### 4. Package Relationship: console-types vs console-validation

#### @repo/console-types Purpose
- **API contracts**: Zod schemas for `/v1/search`, `/v1/contents` endpoints
- **Domain models**: TypeScript interfaces (DocumentMetadata, ChunkMetadata, SourceEvent)
- **Event types**: GitHub/Vercel event definitions and constants
- **Importers**: Neural workflows, webhook transformers, API routes (12 files)

#### @repo/console-validation Purpose
- **Input validation**: Zod schemas for tRPC procedures and forms
- **Primitives**: ID, slug, name validation schemas
- **Domain schemas**: Workspace, job, activity, metrics validation
- **Importers**: tRPC routers, database schemas, UI forms (30 files)

#### Key Distinction
- `console-types` = **What data looks like** (interfaces, contracts, shapes)
- `console-validation` = **How data is validated** (Zod schemas for runtime validation)

**No overlap or duplication found**. Packages have no interdependencies.

## Code References

### Event Type Definitions
- `packages/console-types/src/integrations/events.ts:2-62` - Event config objects
- `packages/console-webhooks/src/vercel.ts:36-73` - Vercel event type unions
- `packages/console-types/src/neural/source-event.ts:8` - SourceEvent.sourceType field

### Event Type Transformations
- `packages/console-webhooks/src/transformers/github.ts:53,166,248,303,363` - GitHub sourceType generation
- `packages/console-webhooks/src/transformers/vercel.ts:102` - Vercel sourceType passthrough
- `api/console/src/inngest/workflow/neural/observation-capture.ts:55-69` - observationType derivation

### Scoring System
- `api/console/src/inngest/workflow/neural/scoring.ts:37-61` - EVENT_TYPE_WEIGHTS
- `api/console/src/inngest/workflow/neural/scoring.ts:93-134` - scoreSignificance function

### Provider Type Definitions
- `packages/console-validation/src/schemas/sources.ts:19-22` - integrationProviderSchema
- `packages/console-validation/src/schemas/sources.ts:35-38` - sourceTypeSchema
- `packages/console-types/src/neural/source-event.ts:7` - SourceEvent.source

### Package Exports
- `packages/console-types/src/index.ts:1-16` - Types package exports
- `packages/console-validation/src/index.ts:1-45` - Validation package exports

## Architecture Documentation

### Event Flow Diagram
```
GitHub/Vercel Webhook
        ↓
Webhook Handler (verify signature)
        ↓
Transformer (github.ts / vercel.ts)
    → Creates SourceEvent with sourceType
        ↓
Inngest Event: neural/observation.capture
        ↓
observation-capture.ts
    → Filters by getBaseEventType()
    → Generates embedding
        ↓
scoring.ts
    → Looks up EVENT_TYPE_WEIGHTS[sourceType]
    → Returns score 0-100
        ↓
Database Storage
```

### Package Architecture
```
@repo/console-types                    @repo/console-validation
├── api/ (Zod schemas)                 ├── primitives/ (Zod schemas)
│   ├── search.ts                      │   ├── ids.ts
│   ├── contents.ts                    │   ├── slugs.ts
│   └── common.ts                      │   └── names.ts
├── document.ts (interfaces)           ├── schemas/ (Zod schemas)
├── vector.ts (interfaces)             │   ├── workspace.ts
├── error.ts (enum + interface)        │   ├── job.ts
├── neural/ (interfaces)               │   ├── sources.ts
│   └── source-event.ts                │   └── ...
└── integrations/ (consts)             ├── forms/ (Zod schemas)
    └── events.ts                      └── constants/
```

### Type Flow for Provider/Source
```
External Webhook → SourceEvent.source ("github" | "vercel" | "linear" | "sentry")
                           ↓
                 Observation Storage (source field)
                           ↓
                 Config Filtering (integrationProviderSchema)
```

## Historical Context

No existing research documents found on this topic.

## Related Research

N/A - First research on event type architecture.

## Open Questions

1. **Should detailed event types be typed?** Currently `pull_request_opened`, `release_published` etc. are generated dynamically as strings with no compile-time constraints. This means new GitHub actions could produce unscored event types.

2. **Should provider literals be centralized?** 100+ inline usages of `"github" | "vercel"` could benefit from importing from `@repo/console-validation/schemas/sources.ts`, but this would require significant refactoring and SourceEvent.source includes additional providers (`"linear" | "sentry"`).

3. **Why two naming conventions?** The snake_case vs dot.notation comes from external APIs (GitHub vs Vercel webhook formats). This is intentional mirroring rather than an architectural inconsistency.
