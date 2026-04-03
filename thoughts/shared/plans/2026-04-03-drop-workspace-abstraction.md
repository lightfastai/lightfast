---
date: 2026-04-03T00:00:00+00:00
author: claude
branch: chore/remove-memory-api-key-service-auth
topic: "Drop workspace abstraction — collapse to 1:1 org scoping"
tags: [plan, refactor, workspace, db, trpc, inngest, ui]
status: complete
---

# Drop Workspace Abstraction — Implementation Plan

## Overview

Remove the workspace abstraction entirely. Every layer that currently scopes data by `workspaceId` (nanoid FK into `lightfast_org_workspaces`) switches to `clerkOrgId` directly. No production data to migrate. Embedding config is uniform across all orgs so no per-org settings table is required — constants suffice.

## Current State Analysis

- Root table `lightfast_org_workspaces` holds name, slug, and `WorkspaceSettings` JSONB
- 8 child tables FK with CASCADE DELETE on `workspaceId`
- Inngest resolves `workspaceId` from `clerkOrgId` at pipeline entry then carries it through 5 functions
- `memoryEntityEmbed` reads workspace settings from DB to drive Pinecone writes
- 2 tRPC routers (14 procedures) manage workspace lifecycle
- URL shape: `/{orgSlug}/{workspaceName}/...` — `[workspaceName]` is a dynamic Next.js segment
- `/search` route handler validates `X-Workspace-ID` against the `orgWorkspaces` table
- Redis cache keys on `ws:{workspaceId}:config`
- There is **no org table** — Clerk is the sole org identity source of truth
- There is **no org-level settings mechanism** today — workspace settings is the only one

## Desired End State

- `lightfast_org_workspaces` table deleted
- 8 `lightfast_workspace_*` tables renamed to `lightfast_org_*`; `workspaceId` column replaced by `clerkOrgId varchar(191) NOT NULL` (no FK constraint — same pattern as `lightfast_workspace_api_keys`)
- Inngest pipeline: `clerkOrgId` flows end-to-end; workspace resolution step removed; `memoryEntityEmbed` reads embedding config from constants
- Pinecone namespace: `sanitize(clerkOrgId)` (e.g. `org_abc123xyz`)
- tRPC `workspace` and `workspaceAccess` routers deleted; integration management procedures moved to `connections` router; ingest events moved to new `events` router
- URL: `/{orgSlug}/...` (no workspace segment)
- No workspace creation flow (`/new` page deleted)
- No workspace switcher component
- `/search` route auth validates org membership via `clerkOrgId` directly
- `@repo/app-workspace-cache` package deleted

## What We're NOT Doing

- No Pinecone data migration — existing vectors stay, new namespace format going forward
- No DB row migration — clean DB
- No per-org settings table — embedding config from constants
- No backwards-compatible workspace endpoints
- No gradual migration / feature flag

---

## Phase 1: Database Schema

### Overview
Drop `lightfast_org_workspaces`. Rename 8 child tables and swap `workspaceId` for `clerkOrgId`. Generate migration.

### Changes Required

#### 1. Delete `org-workspaces.ts`
**File**: `db/app/src/schema/tables/org-workspaces.ts`
**Action**: Delete entirely.

#### 2. Rename and update all 8 child table files

For each file, the mechanical changes are:
- Physical table name: `lightfast_workspace_*` → `lightfast_org_*`
- Drizzle export name: `workspace*` → `org*`
- Remove `workspaceId` column (the FK reference)
- Add `clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull()` (no FK — Clerk is source of truth)
- Remove any FK `references(() => orgWorkspaces.id, ...)` call
- Update indexes that referenced `workspaceId` to reference `clerkOrgId`

| Old file | New file | Old export | New export |
|---|---|---|---|
| `workspace-integrations.ts` | `org-integrations.ts` | `workspaceIntegrations` | `orgIntegrations` |
| `workspace-ingest-logs.ts` | `org-ingest-logs.ts` | `workspaceIngestLogs` | `orgIngestLogs` |
| `workspace-events.ts` | `org-events.ts` | `workspaceEvents` | `orgEvents` |
| `workspace-entities.ts` | `org-entities.ts` | `workspaceEntities` | `orgEntities` |
| `workspace-entity-edges.ts` | `org-entity-edges.ts` | `workspaceEntityEdges` | `orgEntityEdges` |
| `workspace-event-entities.ts` | `org-event-entities.ts` | `workspaceEventEntities` | `orgEventEntities` |
| `workspace-user-activities.ts` | `org-user-activities.ts` | `workspaceUserActivities` | `orgUserActivities` |
| `workspace-workflow-runs.ts` | `org-workflow-runs.ts` | `workspaceWorkflowRuns` | `orgWorkflowRuns` |

Special case — `workspace-workflow-runs.ts` already has **both** `clerkOrgId` AND `workspaceId` columns. Drop the `workspaceId` column and its FK. Keep `clerkOrgId` as-is. Also drop the composite `(workspaceId, createdAt)` index; keep the `clerkOrgId` index.

Special case — `workspace-entities.ts` unique dedup key is currently `(workspaceId, category, key)`. Rename to `(clerkOrgId, category, key)` — same cardinality since we're now 1:1 with orgs.

Special case — `workspace-entity-edges.ts` conflict target includes `workspaceId`. Change to `clerkOrgId`.

#### 3. Update `db/app/src/schema/tables/index.ts`
Remove `orgWorkspaces` export. Update all 8 renamed exports.

#### 4. Update `db/app/src/schema/relations.ts`
Delete `orgWorkspacesRelations` and all child relations that reference `workspaceId`/`orgWorkspaces`. Relations are no longer needed — queries will use `eq(table.clerkOrgId, ...)` directly without Drizzle relations.

#### 5. Replace workspace DB utilities

**Delete**: `db/app/src/utils/workspace.ts`, `db/app/src/utils/workspace-names.ts`

**Create**: `db/app/src/utils/org.ts`
```ts
// Pinecone namespace for an org
function sanitize(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 50);
}
export function buildOrgNamespace(clerkOrgId: string): string {
  return sanitize(clerkOrgId);
}
```

#### 6. Update `db/app/src/utils/index.ts`
Remove workspace util exports. Export `buildOrgNamespace` from new `org.ts`.

#### 7. Generate migration
```bash
cd db/app && pnpm db:generate
```

### Success Criteria

#### Automated:
- [x] `pnpm db:generate --filter @db/app` produces valid SQL
- [x] `pnpm typecheck --filter @db/app` passes
- [x] No imports of `orgWorkspaces`, `workspaceIntegrations`, etc. remain in `@db/app`

---

## Phase 2: Auth Middleware & Search Route

### Overview
Remove all workspace types/functions from `packages/app-auth-middleware`. Update the `/search` route to validate org membership by `clerkOrgId` instead of looking up a workspace row.

### Changes Required

#### 1. `packages/app-auth-middleware/src/workspace.ts`
Delete `resolveWorkspaceByName`, `resolveWorkspaceBySlug`, `verifyWorkspaceAccess`. Keep `verifyOrgAccess` (already org-level, used elsewhere).

#### 2. `packages/app-auth-middleware/src/types.ts`
Delete: `WorkspaceAccessContext`, `WorkspaceAccessData`, `WorkspaceAccessResult`, `ResolveWorkspaceByNameContext`, `ResolveWorkspaceBySlugContext`, `ResolveWorkspaceData`, `ResolveWorkspaceResult`. Keep org-level types (`OrgAccessContext`, `OrgAccessData`, `OrgAccessResult`).

#### 3. `apps/app/src/app/(api)/lib/with-dual-auth.ts`
Currently validates `X-Workspace-ID` against `orgWorkspaces` table. Replace with `X-Org-ID` header carrying `clerkOrgId`:
- **API key path**: read `x-org-id` header; trust it directly (org already established by API key lookup)
- **Clerk JWT bearer path**: read `x-org-id`; verify org membership via `getCachedUserOrgMemberships`
- **Clerk session path**: read `x-org-id`; call `verifyOrgAccess({ clerkOrgSlug })` or membership check

#### 4. `apps/app/src/app/(api)/search/route.ts`
Update to pass `clerkOrgId` (from `x-org-id` header) into `searchLogic(...)` instead of `workspaceId`.

#### 5. Delete `@repo/app-workspace-cache` package
**Files to delete**:
- `packages/app-workspace-cache/src/config.ts`
- `packages/app-workspace-cache/src/keys.ts`
- `packages/app-workspace-cache/src/types.ts`
- `packages/app-workspace-cache/src/index.ts`
- `packages/app-workspace-cache/package.json`

Remove `@repo/app-workspace-cache` from any `package.json` dependencies that reference it.

#### 6. `api/app/src/trpc.ts`
Remove `resolveWorkspaceByName` helper (lines 298-345). Remove import of `resolveWorkspace` from `@repo/app-auth-middleware`.

### Success Criteria

#### Automated:
- [x] `pnpm typecheck --filter @repo/app-auth-middleware` passes
- [x] `pnpm typecheck --filter @api/app` passes
- [ ] `pnpm build --filter @api/app` passes

---

## Phase 3: Platform Inngest Pipeline

### Overview
Remove the workspace resolution step from `ingest-delivery`. Replace `workspaceId` with `clerkOrgId` as the propagated scoping key throughout all 5 functions. `memoryEntityEmbed` uses constants instead of a DB settings lookup.

### Changes Required

#### 1. `api/platform/src/inngest/schemas/memory.ts`
- `memory/webhook.received`: no change (no workspace/org fields here)
- `memory/event.capture`: remove `clerkOrgId: z.string().optional()`, replace `workspaceId: z.string()` with `clerkOrgId: z.string()` required
- `memory/event.stored`: `workspaceId` → remove; `clerkOrgId` already required → keep
- `memory/entity.upserted`: `workspaceId: z.string()` → `clerkOrgId: z.string()`
- `memory/entity.graphed`: `workspaceId: z.string()` → `clerkOrgId: z.string()`

#### 2. `api/platform/src/inngest/functions/ingest-delivery.ts`
Remove the `resolve-workspace` step entirely (lines 93-108). `connectionInfo.orgId` IS the `clerkOrgId` — use it directly.
- DB insert into `orgIngestLogs`: use `clerkOrgId` instead of `workspaceId`
- Emit `memory/event.capture` with `clerkOrgId: connectionInfo.orgId` (no `workspaceId` field)
- Update `workspaceIngestLogs` → `orgIngestLogs` import

#### 3. `api/platform/src/inngest/functions/memory-event-store.ts`
- Remove `resolveClerkOrgId()` helper (no longer needed — `clerkOrgId` is now always present and required)
- Concurrency key: `"event.data.clerkOrgId"` (was `"event.data.workspaceId"`)
- Idempotency key: `"event.data.clerkOrgId + '-' + event.data.sourceEvent.sourceId"`
- Replace all `workspaceId` column writes with `clerkOrgId`
- Update all table imports: `workspaceEvents` → `orgEvents`, `workspaceEntities` → `orgEntities`, etc.
- Update `jobs.ts` call: pass `clerkOrgId` (drop `workspaceId` argument)
- Emitted events: replace `workspaceId` field with `clerkOrgId` in `memory/entity.upserted` and `memory/event.stored`

#### 4. `api/platform/src/inngest/functions/memory-entity-graph.ts`
- Destructure `clerkOrgId` from `event.data` (was `workspaceId`)
- Pass `clerkOrgId` to `resolveEdges` as first argument
- Emit `memory/entity.graphed` with `clerkOrgId` field

#### 5. `api/platform/src/lib/edge-resolver.ts`
- Rename `resolveEdges(workspaceId, ...)` → `resolveEdges(clerkOrgId, ...)`
- Update all `eq(workspaceEntities.workspaceId, workspaceId)` → `eq(orgEntities.clerkOrgId, clerkOrgId)`
- Update `workspaceEntityEdges` insert: `clerkOrgId` in conflict target
- Update all table imports to renamed tables

#### 6. `api/platform/src/inngest/functions/memory-entity-embed.ts`
Remove the `fetch-workspace` step entirely (lines 91-104 — the DB lookup of `orgWorkspaces`). Replace with constants:

```ts
import { EMBEDDING_DEFAULTS } from "@repo/app-validation/constants/embedding";
import { buildOrgNamespace } from "@db/app/utils/org";

// In embed-narrative step:
const embeddingModel = EMBEDDING_DEFAULTS.embeddingModel;
const embeddingDim = EMBEDDING_DEFAULTS.embeddingDim;

// In upsert-entity-vector step:
const indexName = EMBEDDING_DEFAULTS.indexName;
const namespaceName = buildOrgNamespace(clerkOrgId);
```

#### 7. `api/platform/src/inngest/functions/memory-notification-dispatch.ts`
- `workspaceId` field removal from destructuring
- Knock `data` payload: remove `workspaceId` field

#### 8. `api/platform/src/lib/jobs.ts` and `api/app/src/lib/jobs.ts`
Both files: remove `workspaceId` parameter from `createJob()`. Table is now `orgWorkflowRuns` with `clerkOrgId` only.

#### 9. `api/app/src/inngest/workflow/infrastructure/record-activity.ts`
- Batch key: `"event.data.clerkOrgId"` (was `"event.data.workspaceId"`)
- Write `clerkOrgId` to `orgUserActivities.clerkOrgId`

### Success Criteria

#### Automated:
- [x] `pnpm typecheck --filter @api/platform` passes
- [ ] `pnpm build --filter @api/platform` passes
- [x] `pnpm typecheck --filter @api/app` passes

---

## Phase 4: tRPC Router Reorganization

### Overview
Delete both workspace routers. Move integration procedures to `connections.ts`. Add `events` router for ingest log listing. Update `jobs.ts` router. Clean up `root.ts`.

### Changes Required

#### 1. Delete `api/app/src/router/org/workspace.ts`
Delete entirely (1015 lines).

#### 2. Delete `api/app/src/router/user/workspace.ts`
Delete entirely (294 lines).

#### 3. Expand `api/app/src/router/org/connections.ts`
Add the following sub-router procedures (previously on `workspace.integrations.*` and `workspace.sources.*`), updating all DB queries to scope by `ctx.auth.orgId` directly:

- `connections.resources.list` (was `workspace.sources.list`) — query `orgIntegrations` JOIN `gatewayInstallations` where `clerkOrgId = ctx.auth.orgId`
- `connections.resources.disconnect` (was `workspace.integrations.disconnect`) — verify `orgIntegrations.clerkOrgId = ctx.auth.orgId`
- `connections.resources.bulkLink` (was `workspace.integrations.bulkLinkResources`) — scope by `ctx.auth.orgId`
- `connections.resources.updateEvents` (was `workspace.integrations.updateEvents`) — scope by `ctx.auth.orgId`
- `connections.resources.linkVercelProject` (was `workspace.integrations.linkVercelProject`) — scope by `ctx.auth.orgId`
- `connections.resources.unlinkVercelProject` (was `workspace.integrations.unlinkVercelProject`) — scope by `ctx.auth.orgId`

#### 4. Create `api/app/src/router/org/events.ts`
New router with one procedure (was `workspace.events.list`):

- `events.list` — paginated query on `orgIngestLogs` scoped by `ctx.auth.orgId` directly (no workspace resolution needed)

Input: `z.object({ source?, limit, cursor?, search?, receivedAfter? })` — drop `clerkOrgSlug` and `workspaceName` (already in org context from `orgScopedProcedure`).

#### 5. Update `api/app/src/router/org/jobs.ts`
Remove `resolveWorkspaceByName` call. Query `orgWorkflowRuns` by `ctx.auth.orgId` directly.
Input: drop `clerkOrgSlug` and `workspaceName` parameters (org context is sufficient).

#### 6. Update `api/app/src/root.ts`
- Remove `workspaceAccess` and `workspace` registrations
- Add `events: eventsRouter`
- Update `connections` import (new procedures added)

### Success Criteria

#### Automated:
- [ ] `pnpm build --filter @api/app` passes
- [ ] `pnpm typecheck --filter @api/app` passes

---

## Phase 5: UI

### Overview
Flatten routes by removing the `[workspaceName]` segment. Delete workspace creation, switcher, and list. Update sidebar, header, search, and the `/search` auth header.

### Changes Required

#### 1. Flatten route structure

Move all pages from `[slug]/[workspaceName]/X` up to `[slug]/X`:

| Old route | New route |
|---|---|
| `[slug]/[workspaceName]/page.tsx` | `[slug]/page.tsx` (replaces the org landing that showed workspace list) |
| `[slug]/[workspaceName]/search/page.tsx` | `[slug]/search/page.tsx` |
| `[slug]/[workspaceName]/(manage)/events/` | `[slug]/(manage)/events/` |
| `[slug]/[workspaceName]/(manage)/jobs/` | `[slug]/(manage)/jobs/` |
| `[slug]/[workspaceName]/(manage)/settings/` | `[slug]/(manage)/settings/` |
| `[slug]/[workspaceName]/(manage)/sources/` | `[slug]/(manage)/sources/` |
| `[slug]/[workspaceName]/(manage)/sources/new/` | `[slug]/(manage)/sources/new/` |

All `params.workspaceName` references in page/layout files are removed. Pages use only `params.slug`.

Update all tRPC prefetches in server components:
- `trpc.workspace.store.get` → remove prefetch (constants, no DB call)
- `trpc.workspace.sources.list` → `trpc.connections.resources.list`
- `trpc.workspace.events.list` → `trpc.events.list`
- `trpc.jobs.list` input: drop `workspaceName` param

#### 2. Delete workspace creation flow
Delete directory: `apps/app/src/app/(app)/(user)/(pending-not-allowed)/new/`
All 7 files (layout, page, and 5 `_components`).

#### 3. Delete `apps/app/src/components/workspace-switcher.tsx`

#### 4. Delete `apps/app/src/components/workspaces-list.tsx`

#### 5. Update `apps/app/src/components/workspace-search.tsx` → rename to `org-search.tsx`
- Remove `workspaceName` prop
- Remove `trpc.workspace.store.get` call
- Replace `X-Workspace-ID: storeId` header with `X-Org-ID: clerkOrgId` in the `fetch("/search", ...)` call
- Derive `clerkOrgId` from the Clerk auth context (or pass `orgSlug` and resolve from the org query)

#### 6. Update `apps/app/src/components/app-sidebar.tsx`
- Remove `workspaceName` extraction from pathname (currently `pathParts[1]`)
- Remove `isInWorkspace` check
- Sidebar always renders the workspace-level nav items (since every org page IS the workspace equivalent now)
- Update `getWorkspacePrimaryItems()` and `getWorkspaceManageItems()` to produce paths without `workspaceName`: `/${orgSlug}/...` instead of `/${orgSlug}/${workspaceName}/...`

#### 7. Update `apps/app/src/components/app-header.tsx`
- Remove `workspaceName` from `useParams()` read
- Remove conditional `WorkspaceSwitcher` render — replace with simple org name display or remove

#### 8. Update `apps/app/src/app/(app)/(org)/[slug]/layout.tsx`
- Remove `trpc.workspaceAccess.listByClerkOrgSlug` prefetch (no more workspace list)
- Keep `requireOrgAccess(slug)` call

#### 9. Update `apps/app/src/ai/prompts/sections/workspace-context.ts`
Remove `workspace.id` and `workspace.name` from prompt injection. Replace with org name sourced from Clerk org data, or simplify to just inject connected sources.

#### 10. Remove "Create Workspace" links
Any remaining links to `/new` scattered across components — remove or replace with org settings / connection flows.

### Success Criteria

#### Automated:
- [x] `pnpm typecheck --filter @repo/app` passes (app is the Next.js app package)
- [x] `pnpm build --filter @repo/app` passes
- [x] No `workspaceName` param references remain in route files under `[slug]/`

#### Manual (confirmed by user 2026-04-03):
- [x] `/{orgSlug}` loads the Ask page directly (no workspace selection step)
- [x] `/{orgSlug}/search` loads search and performs a search correctly
- [x] `/{orgSlug}/(manage)/sources` loads connected sources
- [x] `/{orgSlug}/(manage)/events` loads ingest logs
- [x] `/{orgSlug}/(manage)/jobs` loads workflow runs
- [x] Sidebar renders correct nav items without workspace switcher
- [x] No dead `/new` links remain

---

## Phase 6: Validation & Cleanup

### Overview
Remove all workspace-specific validation schemas, form schemas, primitives, reserved names, and DB utils that no longer have consumers.

### Changes Required

#### 1. `packages/app-validation/src/schemas/workspace.ts`
Delete entirely (12 input schemas — all workspace-scoped).

#### 2. `packages/app-validation/src/schemas/workspace-settings.ts`
Delete (or keep `workspaceEmbeddingConfigSchema` only if still consumed by search logic — otherwise delete).

#### 3. `packages/app-validation/src/forms/workspace-form.ts`
Delete (`workspaceFormSchema`, `workspaceSettingsFormSchema`).

#### 4. `packages/app-validation/src/primitives/slugs.ts`
Remove `workspaceNameSchema` and `workspaceSlugSchema` exports. Keep `clerkOrgSlugSchema`, `storeNameSchema`, `repositoryFullNameSchema`.

#### 5. `packages/app-validation/src/constants/naming.ts`
Remove `WORKSPACE_NAME` constants.

#### 6. `packages/app-validation/src/utils/workspace-names.ts`
Delete (name/slug generators no longer needed).

#### 7. `packages/app-reserved-names/src/workspace.ts`
Delete. Remove `workspace` export from `packages/app-reserved-names/src/index.ts`.

#### 8. `packages/app-validation/src/index.ts`
Remove all workspace-related exports.

#### 9. Remove `@repo/app-workspace-cache` from `pnpm-workspace.yaml` (if listed separately)
And from any consuming `package.json` that still references it (should already be gone after Phase 2).

### Success Criteria

#### Automated:
- [x] `pnpm typecheck` (full monorepo) passes
- [x] `pnpm check` (biome lint) passes
- [x] `pnpm build:app` passes
- [x] `pnpm build:platform` passes
- [x] `grep -r "workspaceId\|workspaceName\|orgWorkspaces\|workspaceIntegrations\|workspace\.create\|workspace\.store\|app-workspace-cache" --include="*.ts" --include="*.tsx" apps/ api/ packages/ db/` returns zero results (excluding this plan file)

---

## References

- Research: `thoughts/shared/research/2026-04-03-workspace-abstraction-full-map.md`
- Current branch: `chore/remove-memory-api-key-service-auth`
