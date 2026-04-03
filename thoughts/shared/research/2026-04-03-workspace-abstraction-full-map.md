---
date: 2026-04-03T00:00:00+00:00
researcher: claude
git_commit: 34f5b76837648856dc476b8f947679021f7a6679
branch: chore/remove-memory-api-key-service-auth
repository: lightfast
topic: "Full map of workspace abstraction — all consumers across DB, API, UI, platform, types, and Inngest"
tags: [research, codebase, workspace, db, trpc, inngest, platform, validation, ui]
status: complete
last_updated: 2026-04-03
---

# Research: Full Map of Workspace Abstraction

**Date**: 2026-04-03
**Git Commit**: `34f5b76837648856dc476b8f947679021f7a6679`
**Branch**: `chore/remove-memory-api-key-service-auth`

## Research Question

Map every consumer of the workspace abstraction across the full monorepo in preparation for dropping it. The intended change: collapse workspaces to 1:1 with orgs — no more workspace abstraction, just direct org-level scoping.

## Summary

The workspace abstraction permeates every layer of the stack. The root is `lightfast_org_workspaces` in `@db/app`, with 8 child tables all FK'd with CASCADE DELETE. Two tRPC routers (14 procedures total) manage workspace lifecycle. The entire neural pipeline in `api/platform` carries `workspaceId` through 5 Inngest functions. The `[workspaceName]` URL segment drives ~30 UI files in `apps/app`. Types and validation schemas are spread across 4 packages.

---

## Detailed Findings

### 1. Database Schema

**Root table:** `db/app/src/schema/tables/org-workspaces.ts`

| Column | Type | Notes |
|---|---|---|
| `id` | `varchar(191)` | PK, nanoid |
| `clerkOrgId` | `varchar(191)` | NOT NULL, typed as `ClerkOrgId`; no FK (Clerk is source of truth) |
| `name` | `varchar(191)` | User-facing, URL-based, unique per org |
| `slug` | `varchar(191)` | Internal, Pinecone index naming (`ws-{slug}`) |
| `settings` | `jsonb` | `WorkspaceSettings` — full embedding config |
| `createdAt` / `updatedAt` | `timestamptz` | |

Unique index: `(clerkOrgId, name)`.

**8 child tables** — all `workspace_id → lightfast_org_workspaces.id CASCADE DELETE`:

| Table | File | Purpose |
|---|---|---|
| `lightfast_workspace_integrations` | `workspace-integrations.ts` | Links gateway installations to a workspace |
| `lightfast_workspace_ingest_logs` | `workspace-ingest-logs.ts` | Raw `PostTransformEvent` objects from ingress; bigint PK is SSE cursor |
| `lightfast_workspace_events` | `workspace-events.ts` | Atomic engineering events (pr_merged, deployment_succeeded, etc.) |
| `lightfast_workspace_entities` | `workspace-entities.ts` | Structured entities (engineers, projects, endpoints); dedup key: `(workspaceId, category, key)` |
| `lightfast_workspace_entity_edges` | `workspace-entity-edges.ts` | Directed graph edges between entities |
| `lightfast_workspace_event_entities` | `workspace-event-entities.ts` | Many-to-many junction: events ↔ entities |
| `lightfast_workspace_user_activities` | `workspace-user-activities.ts` | Audit trail of user-initiated actions |
| `lightfast_workspace_workflow_runs` | `workspace-workflow-runs.ts` | Inngest workflow execution records |

**Drizzle relations** (`db/app/src/schema/relations.ts`):
- `orgWorkspacesRelations`: one `orgWorkspaces` → many `workspaceEvents`
- Six child relation definitions (all scoped through `workspaceId`)

**DB utility functions** (`db/app/src/utils/`):
- `getWorkspaceKey(slug)` → `"ws-${slug}"`
- `buildWorkspaceNamespace(clerkOrgId, workspaceId)` → `"{clerkOrgId}:ws_{workspaceId}"` (Pinecone namespace format)
- `buildWorkspaceSettings(clerkOrgId, workspaceId)` → full `WorkspaceSettings` JSONB value
- `createCustomWorkspace(clerkOrgId, name)` → inserts row, generates random slug, catches `23505` unique violation
- `generateRandomSlug()`, `generateWorkspaceName()`, `generateWorkspaceSlug()`, `validateWorkspaceSlug()`

---

### 2. tRPC API Layer

#### Router Registration (`api/app/src/root.ts`)
```
appRouter
  ├── workspaceAccess  →  workspaceAccessRouter   (user-scoped)
  └── workspace        →  workspaceRouter          (org-scoped)
```

#### Org-Scoped Router — `api/app/src/router/org/workspace.ts` (1015 lines)

All procedures use `orgScopedProcedure`. Input validated by schemas from `@repo/app-validation`.

| Procedure | Type | Description |
|---|---|---|
| `workspace.listByClerkOrgSlug` | query | Lists all workspaces for a Clerk org |
| `workspace.getByName` | query | Fetches full workspace row by org slug + workspace name |
| `workspace.create` | mutation | Creates workspace, triggers backfill for existing installations |
| `workspace.updateName` | mutation | Renames workspace, invalidates Redis cache, records activity |
| `workspace.sources.list` | query | Lists active integrations for a workspace |
| `workspace.store.get` | query | Returns embedding config from `settings.embedding` |
| `workspace.integrations.disconnect` | mutation | Sets integration status to `'inactive'` |
| `workspace.integrations.linkVercelProject` | mutation | Upserts integration, registers resource, fires backfill |
| `workspace.integrations.unlinkVercelProject` | mutation | Sets integration status to `'inactive'` |
| `workspace.integrations.updateEvents` | mutation | Merges events array into `providerConfig.sync.events` |
| `workspace.integrations.bulkLinkResources` | mutation | Batch-creates/reactivates integrations for multiple resources |
| `workspace.events.list` | query | Paginated ingest log query (cursor pagination via bigint id) |

#### User-Scoped Router — `api/app/src/router/user/workspace.ts` (294 lines)

Allows `clerk-pending` and `clerk-active` auth (pre-org-session RSC prefetch, onboarding).

| Procedure | Type | Description |
|---|---|---|
| `workspaceAccess.listByClerkOrgSlug` | query | Lists workspaces, manual Clerk membership check (no cached memberships) |
| `workspaceAccess.create` | mutation | Creates workspace + optionally links a GitHub repo in one call |

#### `resolveWorkspaceByName` — Central Resolution (`packages/app-auth-middleware/src/workspace.ts:176`)

Every workspace-scoped procedure calls this. Steps:
1. `verifyOrgAccess({ clerkOrgSlug, userId })` → Clerk org lookup + cached membership check
2. `db.query.orgWorkspaces.findFirst({ where: clerkOrgId = ? AND name = ? })`
3. Returns `{ workspaceId, workspaceName, workspaceSlug, clerkOrgId }`

`workspaceId` is never on the tRPC context — resolved fresh in each procedure.

#### Redis Cache — `@repo/app-workspace-cache`
- Key pattern: `ws:{workspaceId}:config`
- TTL: 1 hour
- Caches `orgWorkspaces.settings.embedding`
- Invalidated in `workspace.updateName` mutation

---

### 3. App UI (`apps/app/src/`)

#### URL Structure
All workspace pages live under the `[workspaceName]` dynamic segment:
```
/(org)/[slug]/                          — org landing (lists workspaces)
/(org)/[slug]/[workspaceName]/          — workspace home
/(org)/[slug]/[workspaceName]/search/   — search
/(org)/[slug]/[workspaceName]/(manage)/settings/   — rename workspace
/(org)/[slug]/[workspaceName]/(manage)/sources/    — manage sources
/(org)/[slug]/[workspaceName]/(manage)/sources/new/
/(org)/[slug]/[workspaceName]/(manage)/events/
/(org)/[slug]/[workspaceName]/(manage)/jobs/
/(user)/new/                            — workspace creation
```

#### Shared Components (`src/components/`)
- `workspace-switcher.tsx` — dropdown to switch workspaces within org; queries `workspace.listByClerkOrgSlug`; includes "Create Workspace" action
- `workspaces-list.tsx` — grid/list of all workspaces for an org; shown on org landing page
- `workspace-search.tsx` — full search UI; queries `workspace.store.get`
- `app-sidebar.tsx` — `getWorkspacePrimaryItems` + `getWorkspaceManageItems` nav; extracts `workspaceName` from pathname
- `app-header.tsx` — renders `WorkspaceSwitcher` when inside a workspace route

#### Creation Flow (`/(user)/new/_components/`)
- `new-workspace-initializer.tsx` — wraps with `WorkspaceFormProvider`
- `workspace-form-provider.tsx` — react-hook-form using `workspaceFormSchema`
- `workspace-name-input.tsx` — syncs to URL via `useWorkspaceSearchParams`
- `create-workspace-button.tsx` — calls `workspaceAccess.create`, redirects to `/sources/new`
- `organization-selector.tsx`, `use-workspace-search-params.ts`

#### AI Prompts (`src/ai/prompts/sections/workspace-context.ts`)
- `answerWorkspaceContextSection` injects `workspace.name` + `workspace.id` into AI system prompts

---

### 4. Platform Service (`api/platform/src/`)

No workspace references in `apps/platform/src/` shell or any `vendor/` package.

#### Inngest Functions

| Function | Inngest ID | Trigger Event | Workspace Role |
|---|---|---|---|
| `ingestDelivery` | `memory/ingest.delivery` | `memory/webhook.received` | Resolves `workspaceId` from `clerkOrgId`; inserts `workspaceIngestLogs`; emits `memory/event.capture` with `workspaceId` |
| `memoryEventStore` | `memory/event.store` | `memory/event.capture` | Concurrency + idempotency keyed on `workspaceId`; writes to all 4 entity/event tables |
| `memoryEntityGraph` | `memory/entity.graph` | `memory/entity.upserted` | Passes `workspaceId` to `resolveEdges()` |
| `memoryEntityEmbed` | `memory/entity.embed` | `memory/entity.graphed` | Fetches `orgWorkspaces` by `workspaceId` to read embedding config (model, dim, index name, namespace) |
| `memoryNotificationDispatch` | `memory/notification.dispatch` | `memory/event.stored` | Forwards `workspaceId` to Knock notification payload |

**Console layer** (`api/app/src/inngest/`):
- `record-activity.ts` — batches up to 100 events keyed on `workspaceId` → inserts `workspaceUserActivities`

#### Event Flow
```
"memory/webhook.received"  (no workspaceId — uses orgId/deliveryId)
        │
        ▼
ingestDelivery             resolves workspaceId from clerkOrgId
        │  emits "memory/event.capture" { workspaceId }
        ▼
memoryEventStore           concurrency + idempotency keyed on workspaceId
        │  emits "memory/entity.upserted" { workspaceId }
        │  emits "memory/event.stored"    { workspaceId }
        ▼                              ▼
memoryEntityGraph          memoryNotificationDispatch → Knock
   emits "memory/entity.graphed" { workspaceId }
        ▼
memoryEntityEmbed          reads workspace.settings.embedding for Pinecone write
```

#### Lib Files
- `api/platform/src/lib/edge-resolver.ts` — `resolveEdges(workspaceId, ...)` scopes all entity/edge DB queries
- `api/platform/src/lib/jobs.ts` — `createOrUpdateJob` stores `workspaceId` in `workspaceWorkflowRuns`

#### Inngest Schemas (`api/platform/src/inngest/schemas/memory.ts`)
4 events carry `workspaceId`:
- `memory/event.capture`, `memory/event.stored`, `memory/entity.upserted`, `memory/entity.graphed`

---

### 5. Types and Validation Schemas

#### `WorkspaceSettings` (`packages/app-validation/src/schemas/workspace-settings.ts`)
```typescript
workspaceSettingsSchema = z.object({
  version: z.literal(1),
  embedding: {
    indexName, namespaceName, embeddingDim, embeddingModel, embeddingProvider,
    pineconeMetric, pineconeCloud, pineconeRegion, chunkMaxTokens, chunkOverlap
  },
  repositories?: { [repoId]: { enabled: boolean } },
  defaults?: { patterns?, ignore? },
  features?: { codeIndexing?, multiLanguage? }
})
export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;
```

#### Input Schemas (`packages/app-validation/src/schemas/workspace.ts`)
12 schemas: `workspaceCreateInputSchema`, `workspaceUpdateNameInputSchema`, `workspaceResolutionInputSchema`, `workspaceListInputSchema`, `workspaceStatisticsInputSchema`, `workspaceIntegrationDisconnectInputSchema`, `workspaceResolveFromGithubOrgSlugInputSchema`, `workspaceStatisticsComparisonInputSchema`, `workspaceSystemHealthInputSchema`, plus 3 stat/metrics schemas.

#### Form Schemas (`packages/app-validation/src/forms/workspace-form.ts`)
- `workspaceFormSchema` → `WorkspaceFormValues` — used in `/new` creation flow
- `workspaceSettingsFormSchema` → `WorkspaceSettingsFormValues` — used in settings rename form

#### Primitives (`packages/app-validation/src/primitives/slugs.ts`)
- `workspaceNameSchema`: 1–100 chars, `[A-Za-z0-9_.-]+`, checked against reserved names list
- `workspaceSlugSchema`: 1–20 chars, `[a-z0-9-]+`, no consecutive/leading/trailing hyphens

#### Auth Middleware Types (`packages/app-auth-middleware/src/types.ts`)
```typescript
interface WorkspaceAccessData    { clerkOrgId, userRole, workspaceId, workspaceName, workspaceSlug }
interface ResolveWorkspaceData   { clerkOrgId, workspaceId, workspaceName, workspaceSlug }
type WorkspaceAccessResult = { success: true; data: WorkspaceAccessData } | { success: false; ... }
type ResolveWorkspaceResult = { success: true; data: ResolveWorkspaceData } | { success: false; ... }
```

#### Reserved Names (`packages/app-reserved-names/src/workspace.ts`)
- 400+ reserved names list; O(1) Set lookup via `check(name: string): boolean`

---

### 6. Pinecone Namespace / Index Naming

The workspace abstraction is tightly coupled to Pinecone:

| Pattern | Format | Built in |
|---|---|---|
| Index key | `ws-{slug}` | `db/app/src/utils/workspace.ts:15` via `getWorkspaceKey()` |
| Namespace | `{clerkOrgId}:ws_{workspaceId}` | `db/app/src/utils/workspace.ts:24` via `buildWorkspaceNamespace()` |
| Index name | `lightfast-v1` | `packages/app-validation/src/constants/embedding.ts` |

The namespace format is stored in `orgWorkspaces.settings.embedding.namespaceName` at workspace creation time and read by `memoryEntityEmbed` for Pinecone upsert.

---

## Code References

### Database
- `db/app/src/schema/tables/org-workspaces.ts` — root table
- `db/app/src/schema/tables/workspace-integrations.ts` — child table
- `db/app/src/schema/tables/workspace-ingest-logs.ts` — child table
- `db/app/src/schema/tables/workspace-events.ts` — child table
- `db/app/src/schema/tables/workspace-entities.ts` — child table
- `db/app/src/schema/tables/workspace-entity-edges.ts` — child table
- `db/app/src/schema/tables/workspace-event-entities.ts` — child table
- `db/app/src/schema/tables/workspace-user-activities.ts` — child table
- `db/app/src/schema/tables/workspace-workflow-runs.ts` — child table
- `db/app/src/schema/relations.ts` — Drizzle relations
- `db/app/src/utils/workspace.ts` — `getWorkspaceKey`, `buildWorkspaceNamespace`, `buildWorkspaceSettings`
- `db/app/src/utils/workspace-names.ts` — `createCustomWorkspace`, `generateRandomSlug`

### API Layer
- `api/app/src/root.ts` — router registration
- `api/app/src/trpc.ts` — context, `resolveWorkspaceByName` wrapper
- `api/app/src/router/org/workspace.ts` — 12 org-scoped procedures (1015 lines)
- `api/app/src/router/user/workspace.ts` — 2 user-scoped procedures (294 lines)
- `api/app/src/inngest/workflow/infrastructure/record-activity.ts` — batched activity recording

### Platform / Inngest
- `api/platform/src/inngest/functions/ingest-delivery.ts` — workspace resolution from orgId
- `api/platform/src/inngest/functions/memory-event-store.ts` — event/entity storage
- `api/platform/src/inngest/functions/memory-entity-graph.ts` — graph edge resolution
- `api/platform/src/inngest/functions/memory-entity-embed.ts` — reads workspace settings for Pinecone
- `api/platform/src/inngest/functions/memory-notification-dispatch.ts` — Knock notification
- `api/platform/src/inngest/schemas/memory.ts` — 4 events carry `workspaceId`
- `api/platform/src/lib/edge-resolver.ts` — `resolveEdges(workspaceId, ...)`
- `api/platform/src/lib/jobs.ts` — stores `workspaceId` in workflow runs

### Auth Middleware / Cache
- `packages/app-auth-middleware/src/workspace.ts` — `resolveWorkspaceByName`, `resolveWorkspaceBySlug`, `verifyWorkspaceAccess`
- `packages/app-auth-middleware/src/types.ts` — all workspace interface/result types
- `packages/app-workspace-cache/src/config.ts` — Redis cache `ws:{workspaceId}:config`

### Validation / Types
- `packages/app-validation/src/schemas/workspace-settings.ts` — `WorkspaceSettings`
- `packages/app-validation/src/schemas/workspace.ts` — 12 input schemas
- `packages/app-validation/src/forms/workspace-form.ts` — form schemas
- `packages/app-validation/src/primitives/slugs.ts` — `workspaceNameSchema`, `workspaceSlugSchema`
- `packages/app-validation/src/constants/naming.ts` — `WORKSPACE_NAME` constants
- `packages/app-validation/src/constants/embedding.ts` — `EMBEDDING_DEFAULTS`
- `packages/app-validation/src/utils/workspace-names.ts` — name/slug generators
- `packages/app-reserved-names/src/workspace.ts` — reserved name list

### UI
- `apps/app/src/app/(app)/(org)/[slug]/page.tsx` — org landing (workspace list)
- `apps/app/src/app/(app)/(org)/[slug]/layout.tsx` — prefetches workspace list
- `apps/app/src/app/(app)/(org)/[slug]/[workspaceName]/page.tsx` — workspace home
- `apps/app/src/app/(app)/(org)/[slug]/[workspaceName]/search/page.tsx`
- `apps/app/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/settings/page.tsx`
- `apps/app/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/settings/_components/workspace-general-settings-client.tsx`
- `apps/app/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/page.tsx`
- `apps/app/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/page.tsx`
- `apps/app/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/jobs/page.tsx`
- `apps/app/src/app/(app)/(user)/(pending-not-allowed)/new/` — workspace creation (7 files)
- `apps/app/src/components/workspace-switcher.tsx`
- `apps/app/src/components/workspaces-list.tsx`
- `apps/app/src/components/workspace-search.tsx`
- `apps/app/src/components/app-sidebar.tsx`
- `apps/app/src/components/app-header.tsx`
- `apps/app/src/ai/prompts/sections/workspace-context.ts`

---

## Architecture Documentation

### What a "workspace" currently is

A workspace is a named, user-created knowledge base scoped to a Clerk organization. Each org can have multiple workspaces. Each workspace has:
- A user-facing **name** (URL segment, unique per org)
- An internal **slug** (Pinecone index key, random, never shown to users)
- A **settings JSONB** blob storing the full embedding configuration (model, dim, namespace, Pinecone coordinates)

The slug drives Pinecone index naming (`ws-{slug}`) and the namespace format (`{clerkOrgId}:ws_{workspaceId}`).

### How `workspaceId` flows at runtime

1. User navigates to `/{orgSlug}/{workspaceName}/...`
2. RSC page extracts `workspaceName` from params, calls `resolveWorkspaceByName` or `api.workspace.*` tRPC prefetch
3. `resolveWorkspaceByName` hits Clerk (org lookup + membership check) then DB (workspace name → id)
4. `workspaceId` is passed as a WHERE clause to all subsequent DB queries — never stored in session/cookie
5. In the platform pipeline: `clerkOrgId` enters via webhook → `ingestDelivery` resolves `workspaceId` from `orgWorkspaces` → `workspaceId` propagates through all 5 Inngest steps as event payload data

### What the 1:1 collapse means

Dropping the workspace abstraction means replacing `workspaceId` with `clerkOrgId` as the primary data-scoping key. Concretely:
- The `lightfast_org_workspaces` table and all `workspace_*` child table structures would need to rename/restructure their scoping key
- The `[workspaceName]` URL segment disappears — all routes become `/{orgSlug}/...`
- `resolveWorkspaceByName` collapses to just `verifyOrgAccess`
- The `settings.embedding` JSONB (currently on the workspace row) would move to an org-level settings table
- Pinecone namespaces currently encode `workspaceId` — these would need migration or re-keying to org-level
- All 12 org-scoped tRPC procedures and both user-scoped procedures would be reorganized
- The `ws-{slug}` Pinecone index key pattern and `{clerkOrgId}:ws_{workspaceId}` namespace format would change

## Open Questions

- What happens to existing Pinecone data? Namespaces are currently `{clerkOrgId}:ws_{workspaceId}` — migrating to org-scoped namespaces requires either reindexing or a migration strategy.
- Should `settings.embedding` move to `lightfast_orgs` table or stay as a separate config table?
- Do existing `workspace_workflow_runs`, `workspace_user_activities` records get migrated or dropped?
- What becomes of the `slug` field used for Pinecone index naming — org slug, org id, or something new?
