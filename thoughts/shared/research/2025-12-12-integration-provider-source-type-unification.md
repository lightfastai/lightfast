---
date: 2025-12-12T02:30:56Z
researcher: Claude
git_commit: eba2db85802cdd1a84c53228ac8a2f4ee63b1e59
branch: feat/memory-layer-foundation
repository: lightfastai/lightfast
topic: "Unification of integrationProviderSchema and sourceTypeSchema"
tags: [research, codebase, schema-unification, integration-provider, source-type]
status: complete
last_updated: 2025-12-12
last_updated_by: Claude
---

# Research: Unification of integrationProviderSchema and sourceTypeSchema

**Date**: 2025-12-12T02:30:56Z
**Researcher**: Claude
**Git Commit**: eba2db85802cdd1a84c53228ac8a2f4ee63b1e59
**Branch**: feat/memory-layer-foundation
**Repository**: lightfastai/lightfast

## Research Question

The codebase has two schemas that are functionally identical:
- `integrationProviderSchema` / `IntegrationProvider`
- `sourceTypeSchema` / `SourceType`

Both currently contain `["github", "vercel"]`. The goal is to document all usages to support merging them into a single `sourceType` schema.

## Summary

The codebase uses two conceptually separate but identical schemas:
- **`IntegrationProvider`**: Originally intended for OAuth provider identification (user-level connections)
- **`SourceType`**: Originally intended for document/event source identification (workspace-level)

Both are defined in `packages/console-validation/src/schemas/sources.ts` with identical values. A unification would involve:
1. Removing `integrationProviderSchema`/`IntegrationProvider` exports
2. Updating all consumers to use `sourceTypeSchema`/`SourceType`
3. Database column renames where applicable
4. Updating inline duplications to use the centralized schema

## Detailed Findings

### Source Definition

**File**: `packages/console-validation/src/schemas/sources.ts:19-40`

```typescript
// Lines 19-24: Integration Provider (to be removed)
export const integrationProviderSchema = z.enum([
  "github",      // ✅ Implemented
  "vercel",      // ✅ Implemented (Phase 01)
]);
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;

// Lines 35-40: Source Type (to be kept as canonical)
export const sourceTypeSchema = z.enum([
  "github",      // ✅ Implemented
  "vercel",      // ✅ Implemented (Phase 01)
]);
export type SourceType = z.infer<typeof sourceTypeSchema>;
```

---

### Database Schema Changes Required

#### 1. User Sources Table
**File**: `db/console/src/schema/tables/user-sources.ts:32`

Current:
```typescript
provider: varchar("provider", { length: 50 }).notNull().$type<IntegrationProvider>()
```

Change to:
```typescript
sourceType: varchar("source_type", { length: 50 }).notNull().$type<SourceType>()
```

**Affected Indexes** (lines 78, 81):
- `user_source_provider_idx` → `user_source_source_type_idx`
- `user_source_user_provider_idx` → `user_source_user_source_type_idx`

**Migration Required**: Column rename `provider` → `source_type`

#### 2. Workspace Knowledge Documents Table
**File**: `db/console/src/schema/tables/workspace-knowledge-documents.ts:38`

Already uses `SourceType` - no changes needed.

#### 3. Workspace Neural Observations Table
**File**: `db/console/src/schema/tables/workspace-neural-observations.ts:130`

Currently uses plain string `varchar("source", { length: 50 })` - could be typed with `$type<SourceType>()`.

#### 4. Workspace Webhook Payloads Table
**File**: `db/console/src/schema/tables/workspace-webhook-payloads.ts:50`

Currently uses plain string `varchar("source", { length: 50 })` - could be typed with `$type<SourceType>()`.

#### 5. Workspace Integrations Table
**File**: `db/console/src/schema/tables/workspace-integrations.ts:82-117`

Uses `sourceConfig.provider` in JSONB discriminated union. Would need to change discriminator field name from `provider` to `sourceType` within the JSONB structure.

---

### Type Package Changes Required

#### 1. Source Event Interface
**File**: `packages/console-types/src/neural/source-event.ts:1,9`

Current:
```typescript
import type { IntegrationProvider } from "@repo/console-validation";

export interface SourceEvent {
  source: IntegrationProvider;  // Line 9
  sourceType: string;           // Line 16 - different meaning (event type)
  ...
}
```

Change to:
```typescript
import type { SourceType } from "@repo/console-validation";

export interface SourceEvent {
  source: SourceType;
  sourceType: string;  // Keep as-is (stores event type, not provider)
  ...
}
```

#### 2. Event Type Configuration
**File**: `packages/console-types/src/integrations/event-types.ts:10,16`

Current:
```typescript
import type { IntegrationProvider } from "@repo/console-validation";

interface EventTypeConfig {
  source: IntegrationProvider;
  ...
}
```

Change to:
```typescript
import type { SourceType } from "@repo/console-validation";

interface EventTypeConfig {
  source: SourceType;
  ...
}
```

---

### API Layer Changes Required

#### 1. Inngest Client Event Schemas
**File**: `api/console/src/inngest/client/client.ts`

| Line | Current | Change To |
|------|---------|-----------|
| 10 | Import `integrationProviderSchema` | Import `sourceTypeSchema` |
| 594 | `source: integrationProviderSchema` | `source: sourceTypeSchema` |
| 42 | `sourceType: z.enum(["github", "vercel"])` | `sourceType: sourceTypeSchema` |
| 475 | `sourceType: z.enum(["github", "vercel"])` | `sourceType: sourceTypeSchema` |
| 507 | `sourceType: z.enum(["github", "vercel"])` | `sourceType: sourceTypeSchema` |
| 525 | `sourceType: z.enum(["github", "vercel"])` | `sourceType: sourceTypeSchema` |

#### 2. Sync Orchestrator
**File**: `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts:26`

Already imports `SourceType` - no change needed.

#### 3. Neural Observation Capture
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

Type guards checking `sourceEvent.source === "github"` (lines 58-66, 126-145) will continue to work since the values remain the same.

---

### tRPC Router Changes Required

#### 1. User Sources Router
**File**: `api/console/src/router/user/user-sources.ts`

All references to `provider: "github"` or `provider: "vercel"` need to change to `sourceType`:
- Line 128: `eq(userSources.provider, "github")` → `eq(userSources.sourceType, "github")`
- Line 141-146: Type guard `providerMetadata.provider` → `providerMetadata.sourceType`
- Line 174: Filter by provider → filter by sourceType
- Lines 319, 355, 674, 736, 808, 908: Similar changes

#### 2. M2M Sources Router
**File**: `api/console/src/router/m2m/sources.ts`

All references to `sourceConfig.provider` need to change to `sourceConfig.sourceType`:
- Lines 90-92, 128-130, 239-241, 265-280, 310-313, 389-392, 469-471

---

### Webhook Handler Changes Required

#### 1. Vercel Webhooks
**File**: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:112`

Change:
```typescript
eq(userSources.provider, "vercel")
```
to:
```typescript
eq(userSources.sourceType, "vercel")
```

---

### Other Inline Duplications

These files define `"github" | "vercel"` inline instead of importing the schema:

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `packages/console-webhooks/src/storage.ts` | 7 | `source: "github" \| "vercel"` | `source: SourceType` |
| `api/console/src/inngest/workflow/processing/delete-documents.ts` | 25 | `sourceType: "github" \| "vercel"` | `sourceType: SourceType` |
| `api/console/src/inngest/workflow/processing/process-documents.ts` | 46 | `sourceType: "github" \| "vercel"` | `sourceType: SourceType` |
| `api/console/src/router/org/jobs.ts` | 432 | `sourceType as "github" \| "vercel"` | `sourceType as SourceType` |
| `apps/console/.../use-connect-params.ts` | 5 | `const providers = ["github", "vercel"]` | Import from validation |

---

## Code References

### Files to Modify (Primary)

- `packages/console-validation/src/schemas/sources.ts:19-24` - Remove integrationProviderSchema
- `db/console/src/schema/tables/user-sources.ts:32` - Rename column
- `packages/console-types/src/neural/source-event.ts:1,9` - Change import/type
- `packages/console-types/src/integrations/event-types.ts:10,16` - Change import/type
- `api/console/src/inngest/client/client.ts:10,42,475,507,525,594` - Change schema references

### Files to Modify (Secondary - Inline Duplications)

- `packages/console-webhooks/src/storage.ts:7`
- `api/console/src/inngest/workflow/processing/delete-documents.ts:25`
- `api/console/src/inngest/workflow/processing/process-documents.ts:46`
- `api/console/src/router/org/jobs.ts:432`

### Files to Modify (Router Provider Filters)

- `api/console/src/router/user/user-sources.ts` - Multiple lines
- `api/console/src/router/m2m/sources.ts` - Multiple lines
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:112`

### Database Migration

A migration will be required to rename:
- `lightfast_user_sources.provider` → `lightfast_user_sources.source_type`
- Update related indexes

---

## Architecture Documentation

### Current Pattern (Two Schemas)

```
integrationProviderSchema           sourceTypeSchema
        │                                  │
        ├── IntegrationProvider            ├── SourceType
        │   └── OAuth providers            │   └── Document sources
        │       - user_sources.provider    │       - workspace_knowledge_documents.source_type
        │       - SourceEvent.source       │       - sync orchestrator
        │       - EventTypeConfig.source   │       - workflow-io schemas
```

### Target Pattern (Single Schema)

```
sourceTypeSchema
        │
        └── SourceType
            ├── OAuth providers (user_sources.source_type)
            ├── Document sources (workspace_knowledge_documents.source_type)
            ├── Event sources (SourceEvent.source)
            ├── Configuration (EventTypeConfig.source)
            └── Workflows (sync orchestrator, document processing)
```

---

## Historical Context

The separation likely originated from a conceptual distinction:
- **IntegrationProvider**: External OAuth services a user can connect
- **SourceType**: Where documents/events originate from

In practice, these have converged to the same set of values since every integration provider is also a source type. The duplication creates maintenance overhead and potential inconsistency.

---

## Open Questions

1. **Column naming**: Should `user_sources.provider` become `source_type` (matches other tables) or remain `provider` (semantically accurate for OAuth)?

2. **JSONB discriminator**: The `workspace_integrations.source_config.provider` field is embedded in JSONB. Changing it requires updating all existing data or maintaining backwards compatibility.

3. **Breaking changes**: Any external consumers of the types would need updates. Are there any external API contracts?

4. **Migration strategy**: Should this be done incrementally (add new columns, deprecate old) or all at once?
