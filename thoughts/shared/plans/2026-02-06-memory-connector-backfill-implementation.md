# Memory Connector Backfill Implementation Plan

## Overview

Implement an end-to-end backfill system that imports historical data (PRs, issues, releases, deployments) from connected sources (GitHub, Vercel, Linear, Sentry) into the existing observation pipeline. The system auto-triggers on source connection to solve the "empty workspace" first-experience problem, uses adapter functions to reuse existing battle-tested transformers, and is designed for long-term ease of adding new provider backfills via a generic `BackfillConnector` interface.

## Current State Analysis

- **Zero backfill implementation** exists despite `ingestionSourceSchema` already defining `"backfill"` as a valid source
- **Mature webhook pipeline**: 14 transformers across 4 providers, 8+ step observation capture workflow, 3-level dedup
- **GitHub/Vercel fully connected**: OAuth + webhooks + transformers operational
- **Linear/Sentry NOT connected**: Only transformers exist; no OAuth routes, no webhooks
- **No `ingestionSource` column** on observations — cannot distinguish webhook vs backfill data
- **`workspace_webhook_payloads` table** stores raw payloads but has no concept of backfill payloads

### Key Discoveries:
- `getThrottledInstallationOctokit(app, installationId)` at `packages/console-octokit-github/src/throttled.ts:72` is the correct function for GitHub backfill (NOT `createThrottledOctokit` which takes an auth string)
- `ENCRYPTION_KEY` is available in `api/console/src/env.ts:23` but NOT used in any Inngest workflow — must be imported via `env` from api/console
- GitHub PR list API does NOT return `additions`/`deletions`/`changed_files` — accept for Phase 1
- `step.sendEvent()` MUST be top-level, never nested inside `step.run()` — verified across all 13 existing workflows
- `bulkLinkGitHubRepositories` at `workspace.ts:1115` does NOT emit Inngest events — auto-trigger backfill must be added here
- Vercel sourceId format is `deployment:{deploymentId}` (no state suffix) per `vercel.ts:117`
- Release sourceId format is `release:{fullName}:{tagName}` (no action suffix) per `github.ts:369`
- `workspaceIntegrations` has `userSource: one(userSources, ...)` relation at `relations.ts:62-71`
- `storeWebhookPayload()` at `packages/console-webhooks/src/storage.ts:22-43` inserts into `workspaceWebhookPayloads`

## Desired End State

After this plan is complete:

1. **Auto-backfill on connection**: When a user links GitHub repos or Vercel projects, a 30-day backfill auto-starts in the background
2. **Historical observations appear**: PRs, issues, releases, deployments from the past 7/30/90 days populate the workspace's neural memory
3. **No duplicates**: Webhook events and backfill events produce identical `sourceId` values, handled by existing 3-level dedup
4. **Backfill vs webhook distinction**: New `ingestionSource` column on observations + renamed `workspace_ingestion_payloads` table
5. **Progress tracking**: `sourceConfig.backfill` on integration records tracks status/checkpoint, queryable via tRPC
6. **Cancellation**: Users can cancel in-progress backfills
7. **Extensible**: Adding a new provider backfill = implement `BackfillConnector` interface + register it

### Verification:
- Connect a GitHub repo → historical PRs/issues/releases auto-appear within minutes
- Re-trigger backfill → zero duplicates created
- Cancel mid-backfill → workflow stops, state shows "cancelled"
- `SELECT COUNT(*) FROM observations WHERE ingestion_source = 'backfill'` returns > 0
- Build passes: `pnpm build:console && pnpm lint && pnpm typecheck`

## What We're NOT Doing

- **Push/commit backfill** — Push events lack meaningful "action" for observations; commits captured implicitly via PR references
- **Document/knowledge pipeline backfill** — File content indexing is a separate concern (only observations)
- **Linear/Sentry OAuth** — Prerequisite for Phases 3/4 but a separate workstream
- **Backfill UI components** — Separate follow-up; this plan is backend-only
- **Discussion backfill** — GitHub Discussions require GraphQL; can be added later as a new entity type
- **Per-PR detail fetching** — Too expensive on rate limits; accept missing `additions`/`deletions`/`changed_files` metadata

---

## Implementation Approach

**Adapter pattern over rewrite**: Wrap API list responses into webhook-compatible envelopes so existing transformers produce identical `SourceEvent` output. This reuses 2,000+ lines of battle-tested transformer code and guarantees sourceId equivalence by construction.

**Inngest-native orchestration**: Each page fetch is a `step.run()` checkpoint. If the workflow fails mid-backfill, Inngest retries from the last completed step. Events dispatched via top-level `step.sendEvent()`.

**Progressive phasing**: GitHub first (most complex, most used), then Vercel, then Linear/Sentry after OAuth.

---

## Phase 1: Database Schema Changes

### Overview
Add `ingestionSource` column to observations, rename `workspace_webhook_payloads` to `workspace_ingestion_payloads`, and add `ingestionSource` column to the payloads table. These migrations must land first since all subsequent code depends on them.

### Changes Required:

#### 1. Add `ingestionSource` column to observations table
**File**: `db/console/src/schema/tables/workspace-neural-observations.ts`
**Changes**: Add column after existing columns

```typescript
ingestionSource: varchar("ingestion_source", { length: 20 })
  .default("webhook")
  .notNull(),
```

#### 2. Rename `workspaceWebhookPayloads` table and add `ingestionSource` column
**File**: `db/console/src/schema/tables/workspace-webhook-payloads.ts`
**Changes**: Rename table definition from `workspace_webhook_payloads` to `workspace_ingestion_payloads` and add column

```typescript
ingestionSource: varchar("ingestion_source", { length: 20 })
  .default("webhook")
  .notNull(),
```

Note: Update the Drizzle table export name from `workspaceWebhookPayloads` to `workspaceIngestionPayloads`. Create a re-export alias `workspaceWebhookPayloads = workspaceIngestionPayloads` for backwards compatibility during migration, then remove it in a follow-up.

#### 3. Update all imports of `workspaceWebhookPayloads`
**Files**: All files importing from schema — search for `workspaceWebhookPayloads` and update to `workspaceIngestionPayloads`.

Key files to update:
- `packages/console-webhooks/src/storage.ts` — update import and table reference
- `db/console/src/schema/index.ts` — update export
- Any tRPC routes or Inngest workflows referencing the table

#### 4. Generate and apply migration
**Command**: `cd db/console && pnpm db:generate && pnpm db:migrate`

**IMPORTANT**: Never write custom migration SQL files — let Drizzle handle all migrations per `db/CLAUDE.md`.

### Success Criteria:

#### Automated Verification:
- [x] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [x] Migration applies cleanly: `cd db/console && pnpm db:migrate`
- [x] Type checking passes: `pnpm typecheck` (pre-existing ai-sdk errors only)
- [x] Build passes: `pnpm build:console` (pre-existing console page routing errors only)

#### Manual Verification:
- [x] `pnpm db:studio` shows `ingestion_source` column on both tables
- [x] Existing observations have `ingestion_source = 'webhook'` (default)
- [x] Existing webhook payloads have `ingestion_source = 'webhook'` (default)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the migration applied correctly before proceeding to the next phase.

---

## Phase 2: Event Schema & Observation Pipeline Updates

### Overview
Update the Inngest event schema to accept `ingestionSource` on observation capture events, and update the observation capture workflow to persist it. Also add new backfill-specific events.

### Changes Required:

#### 1. Add `ingestionSource` to observation capture event schema
**File**: `api/console/src/inngest/client/client.ts`
**Location**: ~line 588-620, the `apps-console/neural/observation.capture` event schema
**Changes**: Add optional `ingestionSource` field to the data schema

```typescript
"apps-console/neural/observation.capture": {
  data: z.object({
    workspaceId: z.string(),
    clerkOrgId: z.string().optional(),
    sourceEvent: z.object({ /* ... existing unchanged ... */ }),
    // NEW: Track how this event was ingested
    ingestionSource: ingestionSourceSchema.optional().default("webhook"),
  }),
},
```

Import `ingestionSourceSchema` from `@repo/console-validation` (already defined at `packages/console-validation/src/schemas/ingestion.ts:28-33`).

#### 2. Add new backfill Inngest events
**File**: `api/console/src/inngest/client/client.ts`
**Changes**: Add three new events after the existing neural memory events section

```typescript
// BACKFILL EVENTS

"apps-console/backfill.requested": {
  data: z.object({
    integrationId: z.string(),
    workspaceId: z.string(),
    clerkOrgId: z.string(),
    provider: sourceTypeSchema,
    userSourceId: z.string(),
    depth: z.number(),
    entityTypes: z.array(z.string()),
    requestedBy: z.string(),
  }),
},

"apps-console/backfill.completed": {
  data: z.object({
    integrationId: z.string(),
    workspaceId: z.string(),
    provider: sourceTypeSchema,
    success: z.boolean(),
    eventsProduced: z.number(),
    eventsDispatched: z.number(),
    errorCount: z.number(),
    durationMs: z.number(),
    error: z.string().optional(),
  }),
},

"apps-console/backfill.cancelled": {
  data: z.object({
    integrationId: z.string(),
    cancelledBy: z.string(),
  }),
},
```

#### 3. Update observation capture workflow to store `ingestionSource`
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Changes**: Read `ingestionSource` from event data and include it in the DB insert

In the observation DB insert step (Step 7), add:
```typescript
ingestionSource: event.data.ingestionSource ?? "webhook",
```

#### 4. Update `storeWebhookPayload` to accept `ingestionSource`
**File**: `packages/console-webhooks/src/storage.ts`
**Changes**:
- Rename function to `storeIngestionPayload` (keep `storeWebhookPayload` as alias for backwards compat)
- Add optional `ingestionSource` param (default `"webhook"`)
- Update table reference to `workspaceIngestionPayloads`

```typescript
export interface StoreIngestionPayloadParams {
  workspaceId: string;
  deliveryId: string;
  source: SourceType;
  eventType: string;
  payload: string;
  headers: Record<string, string>;
  receivedAt: Date;
  ingestionSource?: "webhook" | "backfill" | "manual" | "api";
}
```

#### 5. Add backfill validation schemas
**File**: `packages/console-validation/src/schemas/sources.ts`
**Changes**: Add new schemas for backfill configuration

```typescript
export const backfillDepthSchema = z.number().refine(
  d => [7, 30, 90].includes(d),
  { message: "Depth must be 7, 30, or 90 days" }
);

export const backfillStatusSchema = z.enum([
  "idle", "pending", "running", "completed", "failed", "cancelled",
]);

export const githubBackfillEntityTypesSchema = z.array(
  z.enum(["pull_request", "issue", "release"])
).default(["pull_request", "issue", "release"]);

export const vercelBackfillEntityTypesSchema = z.array(
  z.enum(["deployment"])
).default(["deployment"]);
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (pre-existing ai-sdk errors only)
- [x] Build passes: `pnpm build:console` (pre-existing console page routing errors only)
- [x] Lint passes: `pnpm lint`

#### Manual Verification:
- [x] Trigger a webhook event → observation is created with `ingestion_source = 'webhook'`
- [x] Inngest dev UI shows the new event types registered

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Backfill Framework Package

### Overview
Create the `packages/console-backfill` package with types, registry, GitHub connector, and GitHub adapters. This is the core backfill logic.

### Changes Required:

#### 1. Create package structure
**New package**: `packages/console-backfill/`

```
packages/console-backfill/
  package.json
  tsconfig.json
  src/
    index.ts           # Exports + auto-registration
    types.ts           # BackfillConnector, BackfillConfig, BackfillPage, BackfillCheckpoint
    registry.ts        # Connector registration/lookup
    connectors/
      github.ts        # GitHub backfill connector
    adapters/
      github.ts        # GitHub API → webhook shape adapters
```

**`package.json`**: Follow existing `packages/console-*` patterns. Dependencies:
- `@repo/console-types`
- `@repo/console-validation`
- `@repo/console-webhooks` (for transformer imports)
- `@repo/console-octokit-github` (for GitHub API calls)

#### 2. Define core types
**File**: `packages/console-backfill/src/types.ts`

```typescript
import type { SourceEvent, TransformContext } from "@repo/console-types";
import type { SourceType } from "@repo/console-validation";

export interface BackfillConfig {
  integrationId: string;
  workspaceId: string;
  clerkOrgId: string;
  depth: 7 | 30 | 90;
  since: string; // ISO timestamp = now - depth days
  entityTypes: string[];
  sourceConfig: Record<string, unknown>;
  /** Populated inside workflow only, never serialized in event data */
  accessToken: string;
}

export interface BackfillPage<TCursor = unknown> {
  events: SourceEvent[];
  nextCursor: TCursor | null;
  rawCount: number;
  rateLimit?: {
    remaining: number;
    resetAt: Date;
    limit: number;
  };
}

export interface BackfillCheckpoint<TCursor = unknown> {
  currentEntityType: string;
  cursor: TCursor | null;
  eventsProduced: number;
  eventsDispatched: number;
  errors: Array<{ entityType: string; message: string; timestamp: string }>;
  updatedAt: string;
}

export interface BackfillConnector<TCursor = unknown> {
  readonly provider: SourceType;
  readonly supportedEntityTypes: string[];
  readonly defaultEntityTypes: string[];
  validateScopes(config: BackfillConfig): Promise<void>;
  fetchPage(
    config: BackfillConfig,
    entityType: string,
    cursor: TCursor | null,
  ): Promise<BackfillPage<TCursor>>;
  estimateTotal?(
    config: BackfillConfig,
    entityType: string,
  ): Promise<number | null>;
}
```

#### 3. Create connector registry
**File**: `packages/console-backfill/src/registry.ts`

Simple Map-based registry with `registerConnector()`, `getConnector()`, `hasConnector()` functions.

#### 4. Create GitHub adapters
**File**: `packages/console-backfill/src/adapters/github.ts`

Three adapter functions that wrap API list responses into webhook-compatible envelopes:

**`adaptGitHubPRForTransformer(pr, repo)`**:
- Maps `state === "open"` → `action: "opened"`, `state === "closed"` → `action: "closed"`
- Transformer detects merge via `pr.merged` to produce `effectiveAction: "merged"`
- Sets `additions`/`deletions`/`changed_files` to `undefined` (not available from list API — accepted inconsistency for Phase 1)
- Uses `pr.user` as `sender` (transformer reads `pr.user`, NOT `payload.sender`)
- Returns `PullRequestEvent` shape from `@octokit/webhooks-types`

**`adaptGitHubIssueForTransformer(issue, repo)`**:
- Maps `state === "open"` → `action: "opened"`, `state === "closed"` → `action: "closed"`
- Returns `IssuesEvent` shape

**`adaptGitHubReleaseForTransformer(release, repo)`**:
- Always sets `action: "published"` (all listed releases are published)
- Returns `ReleaseEvent` shape

**`parseGitHubRateLimit(headers)`**: Utility to extract rate limit info from response headers.

#### 5. Create GitHub connector
**File**: `packages/console-backfill/src/connectors/github.ts`

Implements `BackfillConnector<{ page: number }>`:
- `provider: "github"`
- `supportedEntityTypes: ["pull_request", "issue", "release"]`
- `defaultEntityTypes: ["pull_request", "issue", "release"]`
- `validateScopes()`: No-op for GitHub App installations (permissions are set at install time)
- `fetchPage()`: Switch on entityType:
  - **pull_request**: `octokit.rest.pulls.list({ state: "all", sort: "updated", direction: "desc", per_page: 100, page })` → filter by `updated_at >= since` → adapt → transform
  - **issue**: `octokit.rest.issues.listForRepo({ state: "all", sort: "updated", since, per_page: 100, page })` → filter out PRs (items with `pull_request` key) → adapt → transform
  - **release**: `octokit.rest.repos.listReleases({ per_page: 100, page })` → filter by `published_at >= since` → adapt → transform

**CRITICAL**: Use `getThrottledInstallationOctokit(app, Number(sourceConfig.installationId))` from `@repo/console-octokit-github`, NOT `createThrottledOctokit()`. This requires the GitHub App instance created via `createApp()` from `packages/console-octokit-github/src/index.ts`.

The connector needs the `app` instance. Two options:
- (a) Accept `app` as a parameter to `fetchPage` via the config
- (b) Create `app` inside the connector using env vars

**Decision**: Option (b) — create the app instance inside the connector's `fetchPage` method. The `createApp()` factory uses `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` from env, which are available in the Inngest runtime. This keeps the connector self-contained.

**Pagination stop condition**: When fetched items contain entries older than `since`, stop paginating. Specifically:
- PRs: `data.length === 100 && filtered.length === data.length` (all items in page were within window)
- Issues: `data.length === 100` (GitHub Issues API handles `since` filtering server-side)
- Releases: `data.length === 100 && filtered.length === data.length`

**Per-item error handling**: Wrap each transform in try/catch. Skip and log malformed items. Include errors in `BackfillPage` result for checkpoint tracking.

#### 6. Create package index with auto-registration
**File**: `packages/console-backfill/src/index.ts`

```typescript
export * from "./types";
export * from "./registry";

import { githubBackfillConnector } from "./connectors/github";
import { registerConnector } from "./registry";
registerConnector(githubBackfillConnector);
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Build passes: `pnpm build:console`
- [x] Lint passes: `pnpm lint`

#### Manual Verification:
- [x] Importing `@repo/console-backfill` registers the GitHub connector
- [x] `getConnector("github")` returns a valid connector
- [x] `hasConnector("github")` returns true, `hasConnector("linear")` returns false

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Backfill Orchestrator Inngest Workflow

### Overview
Create the main Inngest workflow that orchestrates a backfill run: validates integration, decrypts tokens, paginates through the connector, dispatches events to the observation pipeline, tracks progress via DB checkpoints, and handles completion/failure/cancellation.

### Changes Required:

#### 1. Create backfill orchestrator workflow
**File**: `api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts`

**Function configuration**:
```typescript
{
  id: "apps-console/backfill.orchestrator",
  name: "Backfill Orchestrator",
  retries: 3,
  concurrency: [
    { limit: 1, key: "event.data.integrationId" },  // 1 backfill per integration
    { limit: 5, key: "event.data.workspaceId" },     // Max 5 per workspace
  ],
  cancelOn: [{ event: "apps-console/backfill.cancelled", match: "data.integrationId" }],
  timeouts: { start: "2m", finish: "60m" },
}
```

**Workflow steps** (triggered by `apps-console/backfill.requested`):

1. **`validate-integration`** — `step.run()`: Query `workspaceIntegrations` by ID, verify `isActive`. Throw `NonRetriableError` if not found.

2. **`decrypt-token`** — `step.run()`: Query `userSources` by `userSourceId` from event data. Decrypt with `decrypt(source.accessToken, env.ENCRYPTION_KEY)`. Import `env` from `api/console/src/env.ts`.

3. **`validate-scopes`** — `step.run()`: Call `connector.validateScopes(config)`.

4. **`set-backfill-running`** — `step.run()`: Update `sourceConfig.backfill.status = "running"` via `jsonb_set`.

5. **`create-job`** — `step.run()`: Call `createJob({ clerkOrgId, workspaceId, inngestRunId: event.id, inngestFunctionId: "backfill.orchestrator", name: "Backfill {provider} ({depth} days)", trigger: "manual", triggeredBy: requestedBy, input: { integrationId, provider, depth, entityTypes } })`. Returns `jobId`.

6. **`set-job-running`** — `step.run()`: Call `updateJobStatus(jobId, "running")`.

7. **For each `entityType`**:
   a. **`estimate-{entityType}`** — `step.run()`: Call `connector.estimateTotal()` if available.
   b. **Pagination loop**:
      - **`fetch-{entityType}-p{page}`** — `step.run()`: Call `connector.fetchPage(config, entityType, cursor)`.
      - **`dispatch-{entityType}-p{page}`** — Top-level `step.sendEvent()` (**NOT inside `step.run()`**): Send array of `observation.capture` events with `ingestionSource: "backfill"`.
      - **`checkpoint-{entityType}-p{page}`** — `step.run()`: Update `sourceConfig.backfill.checkpoint` via `jsonb_set` on `workspaceIntegrations`.
      - **Rate limit sleep**: If `result.rateLimit.remaining < limit * 0.1`, call `step.sleep()` until reset.
      - Continue until `nextCursor === null`.

8. **`set-backfill-completed`** — `step.run()`: Update `sourceConfig.backfill` with `status: "completed"`, result summary, and `nextAllowedAt` (1-hour cooldown).

9. **`complete-job`** — `step.run()`: Call `completeJob({ jobId, status: "completed", output: { ... } })`.

10. **`backfill-completed`** — Top-level `step.sendEvent()`: Emit `apps-console/backfill.completed`.

11. **`record-activity`** — Top-level `step.sendEvent()`: Emit `apps-console/activity.record` for audit log.

**`onFailure` handler** — CRITICAL: Must **merge** into existing backfill state, NOT replace it. Use nested `jsonb_set` calls:
```typescript
onFailure: async ({ event, error }) => {
  const data = (event.data.event as any).data;

  // Check if already cancelled (cancel race condition)
  const integration = await db.query.workspaceIntegrations.findFirst({
    where: eq(workspaceIntegrations.id, data.integrationId),
  });
  const currentStatus = (integration?.sourceConfig as any)?.backfill?.status;
  if (currentStatus === "cancelled") return; // Don't overwrite cancel with failure

  // Merge failure info into existing backfill state (preserve checkpoint)
  await db.update(workspaceIntegrations)
    .set({
      sourceConfig: sql`jsonb_set(
        jsonb_set(
          jsonb_set(
            ${workspaceIntegrations.sourceConfig},
            '{backfill,status}', '"failed"'::jsonb
          ),
          '{backfill,error}', ${JSON.stringify(error.message)}::jsonb
        ),
        '{backfill,completedAt}', ${JSON.stringify(new Date().toISOString())}::jsonb
      )`,
    })
    .where(eq(workspaceIntegrations.id, data.integrationId));
}
```

#### 2. Create helper functions for backfill state updates
**File**: `api/console/src/inngest/workflow/backfill/backfill-state.ts`

Two helper functions:
- `updateBackfillState(integrationId, state)` — Full replacement of `sourceConfig.backfill` via `jsonb_set`
- `updateBackfillCheckpoint(integrationId, checkpoint)` — Update only `sourceConfig.backfill.checkpoint` via nested `jsonb_set`

#### 3. Register workflow in Inngest client
**File**: `api/console/src/inngest/client/index.ts` (or wherever workflows are registered)
**Changes**: Import and register `backfillOrchestrator`.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Build passes: `pnpm build:console`
- [ ] Lint passes: `pnpm lint`

#### Manual Verification:
- [ ] Inngest dev UI shows `backfill.orchestrator` function registered
- [ ] Manually sending `apps-console/backfill.requested` event triggers the workflow
- [ ] Workflow successfully paginates through a small GitHub repo (7-day backfill)
- [ ] Observations appear in DB with `ingestion_source = 'backfill'`
- [ ] Checkpoint updates visible in `sourceConfig.backfill.checkpoint`
- [ ] Job tracking record created and completed

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that a GitHub backfill runs end-to-end before proceeding to the next phase.

---

## Phase 5: tRPC Routes & Auto-Trigger

### Overview
Create tRPC routes for starting/monitoring/cancelling backfills, and add auto-trigger logic to `bulkLinkGitHubRepositories` and `bulkLinkVercelProjects` mutations.

### Changes Required:

#### 1. Create backfill tRPC router
**File**: `api/console/src/router/org/backfill.ts`

Three routes on `orgProcedure` (any workspace member can trigger):

**`backfill.start`** — mutation:
- Input: `{ integrationId: string, depth: number (7|30|90), entityTypes?: string[] }`
- Validation: integration exists + isActive, no active backfill (`status !== "running"/"pending"`), cooldown check (`nextAllowedAt`), connector exists for provider
- Resolve entity types (use connector defaults if not specified)
- Set `sourceConfig.backfill.status = "pending"`
- Send `apps-console/backfill.requested` Inngest event
- Return `{ success: true, status: "pending" }`

**`backfill.status`** — query:
- Input: `{ integrationId: string }`
- Return backfill state from `sourceConfig.backfill` including checkpoint progress

**`backfill.cancel`** — mutation:
- Input: `{ integrationId: string }`
- Validate active backfill exists
- Send `apps-console/backfill.cancelled` Inngest event
- Immediately set `sourceConfig.backfill.status = "cancelled"`

#### 2. Register backfill router
**File**: `api/console/src/router/org/index.ts`
**Changes**: Import and add `backfill: backfillRouter` to the org router.

#### 3. Add auto-trigger to `bulkLinkGitHubRepositories`
**File**: `api/console/src/router/org/workspace.ts`
**Location**: ~line 1115-1258, after the DB insert loop creates integration records
**Changes**: After the bulk link completes, for each newly created integration, send a `backfill.requested` event with `depth: 30` (default), all entity types, and `requestedBy: "auto"`.

```typescript
// After DB operations complete, auto-trigger backfill for newly created integrations
if (createdIntegrations.length > 0) {
  const backfillEvents = createdIntegrations.map(integration => ({
    name: "apps-console/backfill.requested" as const,
    data: {
      integrationId: integration.id,
      workspaceId,
      clerkOrgId,
      provider: "github" as const,
      userSourceId: integration.userSourceId,
      depth: 30,
      entityTypes: ["pull_request", "issue", "release"],
      requestedBy: "auto",
    },
  }));
  await inngest.send(backfillEvents);
}
```

Note: `createdIntegrations` needs to be collected during the existing insert loop. Currently the loop creates records but doesn't collect the created integration IDs in a way suitable for this. Add an array to collect them.

#### 4. Add auto-trigger to `bulkLinkVercelProjects`
**File**: `api/console/src/router/org/workspace.ts`
**Location**: ~line 1266-1399
**Changes**: Same pattern as GitHub — after creating integration records, send `backfill.requested` events with `provider: "vercel"`, `entityTypes: ["deployment"]`, `depth: 30`.

Note: This requires the Vercel connector to be registered (Phase 6). For Phase 5, add the code but it will be a no-op until the Vercel connector is registered.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Build passes: `pnpm build:console`
- [ ] Lint passes: `pnpm lint`

#### Manual Verification:
- [ ] `backfill.start` mutation triggers a backfill via Inngest
- [ ] `backfill.status` returns progress with checkpoint data during a run
- [ ] `backfill.cancel` stops an in-progress backfill
- [ ] Cooldown enforced: triggering again within 1 hour returns TOO_MANY_REQUESTS error
- [ ] Linking GitHub repos auto-triggers 30-day backfill for each newly created integration
- [ ] Linking repos that already have integrations does NOT trigger duplicate backfills

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation of the full end-to-end flow (link repo → auto-backfill → observations appear) before proceeding to the next phase.

---

## Phase 6: Vercel Backfill Connector

### Overview
Add Vercel connector and adapters to the backfill package. Register it so auto-trigger works for Vercel projects.

### Changes Required:

#### 1. Create Vercel adapter
**File**: `packages/console-backfill/src/adapters/vercel.ts`

**`adaptVercelDeploymentForTransformer(deployment, projectName)`**:
- Maps deployment state to event type string: `READY → "deployment.succeeded"`, `ERROR → "deployment.error"`, `CANCELED → "deployment.canceled"`, `BUILDING → "deployment.created"`
- Wraps in `VercelWebhookPayload` envelope with `{ id, type, createdAt, payload: { deployment, project } }`
- Returns `{ webhookPayload, eventType }` where `eventType` is the STRING union type (e.g., `"deployment.succeeded"`) — NOT the deployment event object

**CRITICAL**: The Vercel transformer signature at `vercel.ts:17-21` is:
```typescript
transformVercelDeployment(payload: VercelWebhookPayload, eventType: VercelDeploymentEvent, context: TransformContext)
```
Where `VercelDeploymentEvent` is a **string union type**, not an object. The adapter must return the event type string separately.

#### 2. Create Vercel connector
**File**: `packages/console-backfill/src/connectors/vercel.ts`

Implements `BackfillConnector<number | null>` (cursor is timestamp in ms):
- `provider: "vercel"`
- `supportedEntityTypes: ["deployment"]`
- `defaultEntityTypes: ["deployment"]`
- `validateScopes()`: Test API call to `/v6/deployments?projectId=X&limit=1` to verify access
- `fetchPage()`: Call `GET /v6/deployments` with `projectId`, `teamId`, `limit: 100`, `until: cursor`. Filter by `since` timestamp. Use Bearer token auth.

**Pagination**: Use Vercel's timestamp cursor (`pagination.next` as `until` param). Stop when `pagination.next === null` or deployments are older than `since`.

#### 3. Register Vercel connector
**File**: `packages/console-backfill/src/index.ts`
**Changes**: Import and register `vercelBackfillConnector`.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Build passes: `pnpm build:console`
- [ ] Lint passes: `pnpm lint`

#### Manual Verification:
- [ ] Link a Vercel project → 30-day backfill auto-starts
- [ ] Historical deployments appear as observations with `ingestion_source = 'backfill'`
- [ ] Vercel sourceIds match webhook-produced ones (e.g., `deployment:dpl_xyz`, no state suffix)
- [ ] Re-triggering backfill produces no duplicates

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 7: Backfill Payload Storage

### Overview
Store backfill API responses in `workspace_ingestion_payloads` alongside webhook payloads for audit trail and debugging.

### Changes Required:

#### 1. Add payload storage to backfill orchestrator
**File**: `api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts`
**Changes**: After each page fetch, store the raw API response in `workspace_ingestion_payloads` using the updated `storeIngestionPayload` function.

Inside the `fetch-{entityType}-p{page}` step, after fetching from the provider but before transforming:

```typescript
await storeIngestionPayload({
  workspaceId: config.workspaceId,
  deliveryId: `backfill-${config.integrationId}-${entityType}-p${page}`,
  source: connector.provider,
  eventType: `backfill.${entityType}`,
  payload: JSON.stringify(rawApiResponse),
  headers: {},
  receivedAt: new Date(),
  ingestionSource: "backfill",
});
```

Note: This adds a DB write per page, which is minimal overhead (one insert per 100 items). The raw API response is stored for debugging and auditing.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Build passes: `pnpm build:console`

#### Manual Verification:
- [ ] After a backfill run, `workspace_ingestion_payloads` contains entries with `ingestion_source = 'backfill'`
- [ ] Payloads are queryable by workspace and delivery ID pattern

**Implementation Note**: This phase is lower priority and can be deferred if the core backfill is working. After completing this phase, pause for confirmation.

---

## Testing Strategy

### Unit Tests:
- Adapter functions: verify `adaptGitHubPRForTransformer()` produces correct `action` for open/closed/merged PRs
- Adapter functions: verify sourceIds match webhook-produced patterns
- Registry: verify `registerConnector()` + `getConnector()` round-trips
- Backfill state helpers: verify `jsonb_set` produces correct JSON structures

### Integration Tests:
- End-to-end: link GitHub repo → auto-backfill triggers → observations appear with `ingestion_source = 'backfill'`
- Dedup: send webhook for PR #123, then backfill PR #123 → only one observation exists (verified by `occurrenceCount`)
- Cancellation: start backfill → cancel mid-run → status is "cancelled", no more events dispatched
- Cooldown: complete backfill → attempt restart within 1 hour → TOO_MANY_REQUESTS error
- Rate limiting: mock low rate limit → verify `step.sleep()` called with correct duration

### Manual Testing Steps:
1. Connect a GitHub repo with existing PRs/issues/releases
2. Verify backfill auto-starts (check Inngest dev UI)
3. Verify observations appear in workspace neural memory
4. Verify `ingestion_source` column is `"backfill"` for imported observations
5. Trigger another backfill for the same integration → verify no duplicates
6. Cancel a running backfill → verify it stops and state shows "cancelled"
7. Connect a Vercel project → verify deployment backfill
8. Check `workspace_ingestion_payloads` for stored backfill payloads

## Performance Considerations

- **Memory**: Each page (100 items) fetched, transformed, dispatched, then GC'd. No bulk loading.
- **Rate limits**: GitHub App installation tokens provide 5K-12.5K req/hr. At 100 items/page with 1s delay, a 90-day backfill of 3,000 events takes ~3 minutes.
- **Inngest steps**: ~3 steps per page (fetch + dispatch + checkpoint). For 300 pages, that's ~900 steps — approaching Inngest's ~1,000 step limit. For very large repos, consider splitting into child functions per entity type in a future optimization.
- **Pipeline saturation**: Per-workspace concurrency limit of 5 backfills prevents overwhelming the observation pipeline (which has its own limit of 10 per workspace).
- **Cooldown**: 1-hour cooldown prevents accidental rapid re-triggers.

## Migration Notes

- The `workspace_webhook_payloads` → `workspace_ingestion_payloads` rename is a Drizzle migration. Existing data is preserved with `ingestion_source = 'webhook'` default.
- The `ingestion_source` column on observations defaults to `'webhook'` — all existing observations are retroactively tagged.
- No data migration needed — defaults handle backwards compatibility.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Inngest step limit (~1000) | Very large repos may fail | Document limit; split into child functions later |
| GitHub secondary rate limits | 403 errors | `@repo/console-octokit-github/throttled.ts` handles this with retry |
| Token expiry mid-backfill (GitHub) | 401 errors | Installation tokens auto-refresh (1hr lifetime, `getThrottledInstallationOctokit` handles this) |
| Table rename breaks existing queries | Build failure | Use alias + staged migration |
| `onFailure` race with cancel | Wrong status | Guard in `onFailure` checks current status before overwriting |

## References

- Codebase deep-dive: `thoughts/shared/research/2026-02-06-memory-connector-backfill-architecture-deep-dive.md`
- Provider API research: `thoughts/shared/research/2026-02-06-provider-api-backfill-research.md`
- Architecture design: `thoughts/shared/research/2026-02-06-backfill-framework-architecture-design.md`
- Architecture critique: `thoughts/shared/research/2026-02-06-backfill-architecture-critique.md`
- Original architecture sketch: `thoughts/shared/research/2026-02-06-memory-connector-backfill-architecture.md`

## Appendix: Corrected SourceId Format Reference

| Provider | Entity | SourceId Format | Example |
|----------|--------|-----------------|---------|
| GitHub | PR (merged) | `pr:{fullName}#{number}:merged` | `pr:lightfastai/lightfast#123:merged` |
| GitHub | PR (open) | `pr:{fullName}#{number}:opened` | `pr:lightfastai/lightfast#123:opened` |
| GitHub | PR (closed) | `pr:{fullName}#{number}:closed` | `pr:lightfastai/lightfast#123:closed` |
| GitHub | Issue | `issue:{fullName}#{number}:{action}` | `issue:lightfastai/lightfast#456:closed` |
| GitHub | Release | `release:{fullName}:{tagName}` | `release:lightfastai/lightfast:v1.0.0` |
| Vercel | Deployment | `deployment:{deploymentId}` | `deployment:dpl_xyz` |

Note: Release sourceId does **NOT** include action. Vercel sourceId does **NOT** include state. These are verified from actual transformer code.

## Appendix: Future Phases (Linear/Sentry)

### Phase 8 (Future): Linear Backfill
**Prerequisite**: Linear OAuth routes implemented
- Create `packages/console-backfill/src/connectors/linear.ts` — GraphQL-based, `first: 250`, cursor pagination
- Create `packages/console-backfill/src/adapters/linear.ts` — Wrap GraphQL responses into `LinearIssueWebhook` shape
- Entity types: `issue`, `comment`, `project`, `cycle`, `project_update`
- Token: Long-lived (~10 years), no refresh needed

### Phase 9 (Future): Sentry Backfill
**Prerequisite**: Sentry OAuth routes implemented
- Create `packages/console-backfill/src/connectors/sentry.ts` — REST-based, Link header pagination
- Create `packages/console-backfill/src/adapters/sentry.ts` — Wrap REST responses into `SentryIssueWebhook` shape
- Entity types: `issue`, `error`
- Token: Short-lived, JWT-based refresh required — add `step.run("refresh-sentry-token")` before each page if within 5 min of expiry
