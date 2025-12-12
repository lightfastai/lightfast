---
date: 2025-12-12T18:45:00+08:00
researcher: Claude
git_commit: eba2db85802cdd1a84c53228ac8a2f4ee63b1e59
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Source and Integration Schema Unification Analysis"
tags: [research, codebase, schema, refactoring, connector]
status: complete
last_updated: 2025-12-12
last_updated_by: Claude
---

# Research: Source and Integration Schema Unification Analysis

**Date**: 2025-12-12T18:45:00+08:00
**Researcher**: Claude
**Git Commit**: eba2db85802cdd1a84c53228ac8a2f4ee63b1e59
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question
Document all usages of `integrationProviderSchema`, `sourceTypeSchema`, `IntegrationProvider`, and `SourceType` across the codebase to understand the scope of merging them into a single `connectorType` concept.

## Summary

The codebase currently has two semantically identical Zod schemas that define external providers:

| Schema | Type | Values | Purpose |
|--------|------|--------|---------|
| `integrationProviderSchema` | `IntegrationProvider` | `["github", "vercel"]` | OAuth integration providers |
| `sourceTypeSchema` | `SourceType` | `["github", "vercel"]` | Document/event source types |

Both are defined in `packages/console-validation/src/schemas/sources.ts` with identical enum values. The naming duplication creates confusion and inconsistent usage across the codebase.

## Detailed Findings

### Schema Definition Location

**Primary Definition File:**
- `packages/console-validation/src/schemas/sources.ts` (lines 19-40)

```typescript
// Line 19-24
export const integrationProviderSchema = z.enum(["github", "vercel"]);
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;

// Line 35-40
export const sourceTypeSchema = z.enum(["github", "vercel"]);
export type SourceType = z.infer<typeof sourceTypeSchema>;
```

**Export Chain:**
- `packages/console-validation/src/schemas/index.ts` → re-exports via `export * from "./sources"`
- `packages/console-validation/src/index.ts` → re-exports via `export * from "./schemas"`

---

### Database Schema References

#### Tables Using `IntegrationProvider` (via `provider` column)

| Table | File | Column | Type |
|-------|------|--------|------|
| `lightfast_user_sources` | `db/console/src/schema/tables/user-sources.ts:32` | `provider` | `varchar(50).$type<IntegrationProvider>()` |

#### Tables Using `SourceType` (via `source_type` column)

| Table | File | Column | Type |
|-------|------|--------|------|
| `lightfast_workspace_knowledge_documents` | `db/console/src/schema/tables/workspace-knowledge-documents.ts:38` | `source_type` | `varchar(50).$type<SourceType>()` |

#### Tables Using Untyped `source` or `source_type` Columns

| Table | File | Column | Type |
|-------|------|--------|------|
| `lightfast_workspace_neural_observations` | `db/console/src/schema/tables/workspace-neural-observations.ts:135` | `source` | `varchar(50)` (untyped) |
| `lightfast_workspace_neural_observations` | same file | `source_type` | `varchar(100)` (event type, NOT SourceType) |
| `lightfast_workspace_webhook_payloads` | `db/console/src/schema/tables/workspace-webhook-payloads.ts` | `source` | `varchar(50)` |

**Important Distinction:** In `workspace_neural_observations`, `source_type` means "event type" (e.g., `pull_request_merged`), NOT the integration provider. The `source` column holds the provider.

---

### Direct Import Usages

#### `integrationProviderSchema` Imports

| File | Line | Usage |
|------|------|-------|
| `api/console/src/inngest/client/client.ts` | 10, 594 | Event payload validation in `neural.observation.capture` |

#### `IntegrationProvider` Type Imports

| File | Line | Usage |
|------|------|-------|
| `db/console/src/schema/tables/user-sources.ts` | 4, 32 | `provider` column type annotation |
| `packages/console-types/src/neural/source-event.ts` | 1, 9 | `SourceEvent.source` property type |
| `packages/console-types/src/integrations/event-types.ts` | 10, 16 | `EventTypeConfig.source` property type |

#### `sourceTypeSchema` Imports

| File | Line | Usage |
|------|------|-------|
| `packages/console-validation/src/schemas/workflow-io.ts` | 3, 41, 146, 161 | Sync orchestrator input/output schemas |

#### `SourceType` Type Imports

| File | Line | Usage |
|------|------|-------|
| `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts` | 26, 32-33, 296 | Event name constructors, function parameters |
| `db/console/src/schema/tables/workspace-knowledge-documents.ts` | 21, 38 | `source_type` column type annotation |

---

### Inline/Duplicate Definitions (NOT importing from sources.ts)

#### In Inngest Client (`api/console/src/inngest/client/client.ts`)

| Line | Definition |
|------|------------|
| 42 | `sourceType: z.enum(["github", "vercel"])` |
| 196 | `sourceType: z.literal("github")` |
| 237 | `sourceType: z.literal("github")` |
| 475 | `sourceType: z.enum(["github", "vercel"])` |
| 507 | `sourceType: z.enum(["github", "vercel"])` |
| 525 | `sourceType: z.enum(["github", "vercel"])` |
| 595 | `sourceType: z.string()` (loosest) |

#### In Workflow Files

| File | Line | Definition |
|------|------|------------|
| `api/console/src/inngest/workflow/processing/process-documents.ts` | 46 | `sourceType: "github" \| "vercel"` |
| `api/console/src/inngest/workflow/processing/delete-documents.ts` | 25 | `sourceType: "github" \| "vercel"` |

#### In Metrics Schemas

| File | Lines | Definition |
|------|-------|------------|
| `packages/console-validation/src/schemas/metrics.ts` | 52, 58, 68 | `sourceType: z.string().optional()` |

---

### tRPC Router References

#### User Router (user-scoped, no org required)

| File | Lines | Description |
|------|-------|-------------|
| `api/console/src/router/user/user-sources.ts` | 923 total | Main router for user OAuth integrations |

**Procedures:**
- `userSources.list` - Lists all user sources
- `userSources.disconnect` - Disconnects an integration
- `userSources.github.*` - GitHub sub-router (get, validate, storeOAuthResult, repositories, detectConfig)
- `userSources.vercel.*` - Vercel sub-router (get, storeOAuthResult, listProjects, disconnect)

#### M2M Router (internal services only)

| File | Lines | Description |
|------|-------|-------------|
| `api/console/src/router/m2m/sources.ts` | 525 total | Webhook handler procedures |

**Procedures:**
- `sources.findByGithubRepoId`
- `sources.getSourceIdByGithubRepoId`
- `sources.updateGithubSyncStatus`
- `sources.updateGithubConfigStatus`
- `sources.markGithubInstallationInactive`
- `sources.markGithubDeleted`
- `sources.updateGithubMetadata`

#### Deprecated Routers

| File | Lines | Status |
|------|-------|--------|
| `api/console/src/router/org/sources.ts` | 10 | DEPRECATED: Empty router |
| `api/console/src/router/org/integration.ts` | 96 | DEPRECATED: Placeholder |

#### Router Registration (`api/console/src/root.ts`)

```typescript
userRouter: {
  userSources: userSourcesRouter  // User OAuth connections
}
orgRouter: {
  integration: integrationRouter,  // Deprecated
  sources: sourcesRouter           // Deprecated
}
m2mRouter: {
  sources: sourcesM2MRouter        // Internal webhook handlers
}
```

---

### API Route Handlers

#### GitHub Routes (`apps/console/src/app/(github)/api/github/`)

| Route | File | Purpose |
|-------|------|---------|
| `/api/github/authorize-user` | `authorize-user/route.ts` | Initiate OAuth |
| `/api/github/user-authorized` | `user-authorized/route.ts` | OAuth callback |
| `/api/github/app-installed` | `app-installed/route.ts` | App installation callback |
| `/api/github/install-app` | `install-app/route.ts` | Initiate app install |
| `/api/github/webhooks` | `webhooks/route.ts` | Webhook receiver |

#### Vercel Routes (`apps/console/src/app/(vercel)/api/vercel/`)

| Route | File | Purpose |
|-------|------|---------|
| `/api/vercel/authorize` | `authorize/route.ts` | Initiate OAuth |
| `/api/vercel/callback` | `callback/route.ts` | OAuth callback |
| `/api/vercel/webhooks` | `webhooks/route.ts` | Webhook receiver |

---

### Inngest Workflow References

#### Files Using Provider/Source Concepts

| File | Usage |
|------|-------|
| `api/console/src/inngest/workflow/neural/observation-capture.ts` | `source`, `sourceType` in event payloads |
| `api/console/src/inngest/workflow/neural/scoring.ts` | Source metadata |
| `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts` | `SourceType` for event routing |
| `api/console/src/inngest/workflow/providers/github/push-handler.ts` | Hardcoded `"github"` |
| `api/console/src/inngest/workflow/processing/process-documents.ts` | `sourceType` parameter |
| `api/console/src/inngest/workflow/processing/delete-documents.ts` | `sourceType` parameter |
| `api/console/src/inngest/workflow/processing/files-batch-processor.ts` | `sourceType` parameter |

---

### Webhook Transformer References

| File | Lines | Usage |
|------|-------|-------|
| `packages/console-webhooks/src/transformers/github.ts` | 54, 172, 256, 313, 375 | `source: "github"` |
| `packages/console-webhooks/src/transformers/vercel.ts` | 105 | `source: "vercel"` |

---

### Frontend Component References

| File | Usage |
|------|-------|
| `apps/console/src/app/(app)/(user)/account/settings/sources/_components/sources-list.tsx` | Displays user sources |
| `apps/console/src/components/connected-sources-overview.tsx` | Shows connected integrations |
| `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/connect-form-provider.tsx` | OAuth connection form |
| `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/_components/event-settings.tsx` | Event type config per provider |

---

### Type Definition Files

| File | Description |
|------|-------------|
| `packages/console-types/src/neural/source-event.ts` | `SourceEvent` interface with `source: IntegrationProvider` |
| `packages/console-types/src/integrations/event-types.ts` | `EventTypeConfig` with `source: IntegrationProvider` |
| `packages/console-types/src/integrations/index.ts` | Integration type exports |

---

## Architecture Documentation

### Current Data Model

```
┌─────────────────────────┐     ┌──────────────────────────────┐
│   lightfast_user_sources │     │ lightfast_workspace_integrations │
├─────────────────────────┤     ├──────────────────────────────┤
│ id                      │◄────┤ user_source_id (FK)          │
│ user_id                 │     │ workspace_id                 │
│ provider (IntegrationProvider) │ │ source_config (JSONB)        │
│ access_token            │     │ provider_resource_id         │
│ provider_metadata       │     │ last_sync_status             │
└─────────────────────────┘     └──────────────────────────────┘

┌─────────────────────────────────┐     ┌─────────────────────────────────┐
│ lightfast_workspace_knowledge_docs │   │ lightfast_workspace_neural_observations │
├─────────────────────────────────┤     ├─────────────────────────────────┤
│ workspace_id                    │     │ workspace_id                    │
│ source_type (SourceType)        │     │ source (untyped varchar)        │
│ source_id                       │     │ source_type (event type, NOT SourceType) │
│ source_metadata                 │     │ source_id                       │
└─────────────────────────────────┘     └─────────────────────────────────┘
```

### Naming Confusion

The term `source_type` is overloaded:
1. In `workspace_knowledge_documents`: means provider type (github, vercel)
2. In `workspace_neural_observations`: means event type (pull_request_merged, deployment_completed)

---

## Code References

### Schema Definitions
- `packages/console-validation/src/schemas/sources.ts:19-24` - integrationProviderSchema
- `packages/console-validation/src/schemas/sources.ts:35-40` - sourceTypeSchema

### Database Tables
- `db/console/src/schema/tables/user-sources.ts:32` - provider column
- `db/console/src/schema/tables/workspace-knowledge-documents.ts:38` - source_type column
- `db/console/src/schema/tables/workspace-neural-observations.ts:135` - source column (untyped)

### tRPC Routers
- `api/console/src/router/user/user-sources.ts` - Main user sources router (923 lines)
- `api/console/src/router/m2m/sources.ts` - M2M webhook handlers (525 lines)
- `api/console/src/root.ts:15-107` - Router registration

### Inngest Events
- `api/console/src/inngest/client/client.ts:594` - integrationProviderSchema validation
- `api/console/src/inngest/client/client.ts:42,475,507,525` - Inline sourceType definitions

### Type Files
- `packages/console-types/src/neural/source-event.ts:9` - IntegrationProvider usage
- `packages/console-types/src/integrations/event-types.ts:16` - IntegrationProvider usage

---

## Impact Assessment for Refactoring to `connectorType`

### Files Requiring Changes

**High Impact (Schema/Type Definitions):**
1. `packages/console-validation/src/schemas/sources.ts` - Merge schemas into `connectorTypeSchema`
2. `packages/console-types/src/neural/source-event.ts` - Update type import
3. `packages/console-types/src/integrations/event-types.ts` - Update type import

**Medium Impact (Database Schema):**
4. `db/console/src/schema/tables/user-sources.ts` - Rename `provider` → `connector_type`
5. `db/console/src/schema/tables/workspace-knowledge-documents.ts` - Rename `source_type` → `connector_type`
6. `db/console/src/schema/tables/workspace-neural-observations.ts` - Rename `source` → `connector_type`
7. `db/console/src/schema/tables/workspace-webhook-payloads.ts` - Rename `source` → `connector_type`
8. All migration files - New migration for column renames

**High Impact (API/Router Renames):**
9. `api/console/src/router/user/user-sources.ts` → `user-connectors.ts`
10. `api/console/src/router/m2m/sources.ts` → `connectors.ts`
11. `api/console/src/root.ts` - Update router names

**Medium Impact (Inngest):**
12. `api/console/src/inngest/client/client.ts` - All inline definitions
13. `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts` - Type imports
14. All workflow files with hardcoded `"github"` or `sourceType`

**Low Impact (Webhook Transformers):**
15. `packages/console-webhooks/src/transformers/github.ts` - Field names
16. `packages/console-webhooks/src/transformers/vercel.ts` - Field names

**Frontend (Low-Medium Impact):**
17. All sources list/form/settings components
18. Route segments: `sources/` → `connectors/`

### Database Migration Required

Column renames needed:
- `lightfast_user_sources.provider` → `connector_type`
- `lightfast_workspace_knowledge_documents.source_type` → `connector_type`
- `lightfast_workspace_neural_observations.source` → `connector_type`
- `lightfast_workspace_webhook_payloads.source` → `connector_type`

Table renames to consider:
- `lightfast_user_sources` → `lightfast_user_connectors`
- `lightfast_workspace_integrations` → `lightfast_workspace_connectors` (or keep as-is if clearer)

---

## Open Questions

1. **Table Renaming**: Should `user_sources` become `user_connectors` or just update column names?
2. **Observation `source_type`**: The `source_type` in observations means "event type" - should this be renamed to `event_type` to avoid confusion?
3. **Route Segments**: Should `/sources/` routes become `/connectors/`?
4. **Migration Strategy**: Zero-downtime migration needed for production?
