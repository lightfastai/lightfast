# Remove GitHub Push Sync Pipeline — Implementation Plan

## Overview

Remove the entire GitHub push-triggered file sync pipeline. This system fetches file content from GitHub repos on push events, chunks/embeds them, and stores in Pinecone. It is no longer needed — neural observations (PRs, issues, releases, discussions) are the only ingestion path going forward.

## Current State Analysis

The push sync pipeline is a 4-function Inngest chain:

```
GitHub push webhook → githubPushHandler → syncOrchestrator → githubSyncOrchestrator → filesBatchProcessor
```

It touches **4 workflow files**, **1 webhook route**, **2 tRPC routers**, **1 validation package**, and the **Inngest client event map**. The sync orchestrator is GitHub-only (throws `NonRetriableError` for any other source type at `sync-orchestrator.ts:100`), so the entire orchestration layer is dead code once GitHub sync is removed.

### Key Discoveries:
- The webhook route also handles push **observations** (neural memory) via `handlePushObservation` — this sends to `observation.capture`, completely separate from the sync pipeline
- The new gateway ingress dispatch (`apps/console/src/app/api/webhooks/ingress/dispatch.ts`) also transforms push events for observation capture
- `@repo/console-octokit-github` is shared across OAuth, org membership, webhooks, AND sync — only sync-specific exports should be cleaned up
- The `workspaceWorkflowRuns` table is general-purpose (used by backfill, neural, etc.) — no DB changes needed

## Desired End State

After completion:
- No Inngest functions handling `sync.requested`, `github.sync.trigger`, `files.batch.process`, or `github.push` events
- Push webhooks still arrive and get captured as neural observations (both old webhook route and new gateway ingress)
- `@repo/console-octokit-github` no longer exports `GitHubContentService`, `ConfigDetectorService`, or throttled Octokit helpers
- `@repo/console-validation` has no sync-related I/O schemas
- `pnpm typecheck` and `pnpm lint` pass cleanly

### How to verify:
- `pnpm build:console` succeeds
- `pnpm typecheck` passes
- `pnpm lint` passes
- Inngest dashboard shows no sync-related functions registered

## What We're NOT Doing

- **Not removing the GitHub webhook route** — it still handles installation_repositories, installation, repository, pull_request, issues, release, discussion events
- **Not removing push observation** — `handlePushObservation` in the webhook route and `transformGitHubPush` in gateway dispatch stay (they feed neural memory, not sync)
- **Not removing `@repo/console-octokit-github` package** — it serves OAuth, org membership, webhook types, and env config
- **Not removing `workspaceWorkflowRuns` table or `lib/jobs.ts`** — used by other workflows
- **Not removing `processDocuments` or `deleteDocuments` Inngest functions** — they're generic document processors
- **Not touching backfill orchestrator** — it's a separate ingestion path
- **Not removing the `lastSyncedAt`/`lastSyncStatus` columns** — they can remain as historical data

## Implementation Approach

Bottom-up deletion: start with leaf files (workflow functions), then clean up registrations, events, schemas, and call sites. This order prevents broken imports from cascading. One phase per logical layer.

---

## Phase 1: Delete Inngest Workflow Files

### Overview
Delete the 4 core sync workflow files. These are leaf nodes — nothing imports from them.

### Changes Required:

#### 1. Delete push handler
**File**: `api/console/src/inngest/workflow/providers/github/push-handler.ts`
**Action**: DELETE entire file

#### 2. Delete sync orchestrator
**File**: `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts`
**Action**: DELETE entire file

#### 3. Delete GitHub sync orchestrator
**File**: `api/console/src/inngest/workflow/sources/github-sync-orchestrator.ts`
**Action**: DELETE entire file

#### 4. Delete files batch processor
**File**: `api/console/src/inngest/workflow/processing/files-batch-processor.ts`
**Action**: DELETE entire file

### Success Criteria:

#### Automated Verification:
- [x] All 4 files are deleted
- [x] No other files import from these deleted files (verified by `pnpm typecheck` in Phase 9)

---

## Phase 2: Clean Up Inngest Function Registry

### Overview
Remove imports, exports, and `serve()` registrations for the 4 deleted functions.

### Changes Required:

**File**: `api/console/src/inngest/index.ts`

Remove these imports:
```ts
// DELETE: import { syncOrchestrator } from "./workflow/orchestration/sync-orchestrator";
// DELETE: import { githubSyncOrchestrator } from "./workflow/sources/github-sync-orchestrator";
// DELETE: import { githubPushHandler } from "./workflow/providers/github/push-handler";
// DELETE: import { filesBatchProcessor } from "./workflow/processing/files-batch-processor";
```

Remove these exports:
```ts
// DELETE: export { syncOrchestrator };
// DELETE: export { githubSyncOrchestrator };
// DELETE: export { githubPushHandler };
// DELETE: export { filesBatchProcessor };
```

Remove from `serve()` `functions` array:
```ts
// DELETE: syncOrchestrator,
// DELETE: githubSyncOrchestrator,
// DELETE: githubPushHandler,
// DELETE: filesBatchProcessor,
```

Update the JSDoc comment block (lines 6-11, 76-112) to remove references to sync orchestration and GitHub push handler.

### Success Criteria:

#### Automated Verification:
- [x] `api/console/src/inngest/index.ts` has no references to deleted functions

---

## Phase 3: Remove Sync Events from Inngest Client

### Overview
Remove all sync-related event definitions from the Inngest client `eventsMap`. Keep neural memory, backfill, document processing, and infrastructure events.

### Changes Required:

**File**: `api/console/src/inngest/client/client.ts`

Remove these event definitions from `eventsMap`:

| Event Key | Lines (approx) | Reason |
|-----------|----------------|--------|
| `apps-console/sync.requested` | 34–53 | No handler exists after sync-orchestrator deletion |
| `apps-console/sync.completed` | 59–78 | Emitted by sync-orchestrator (deleted) |
| `apps-console/files.batch.process` | 88–110 | No handler after files-batch-processor deletion |
| `apps-console/files.batch.completed` | 116–131 | Emitted by files-batch-processor (deleted) |
| `apps-console/github.sync.trigger` | 141–157 | No handler after github-sync-orchestrator deletion |
| `apps-console/github.sync.completed` | 164–177 | Emitted by github-sync-orchestrator (deleted) |
| `apps-console/source.connected.github` | 188–203 | No handler (was part of old sync flow) |
| `apps-console/source.sync.github` | 229–246 | Legacy sync event, no handler |
| `apps-console/github.push` | 258–292 | No handler after push-handler deletion |
| `apps-console/github.config-changed` | 300–313 | No handler (was part of push-handler flow) |
| `apps-console/github.sync` | 321–338 | Legacy sync event, no handler |
| `apps-console/docs.file.process` | 425–440 | Legacy per-file event, no handler |
| `apps-console/docs.file.delete` | 447–456 | Legacy per-file delete event, no handler |
| `apps-console/github.sync-completed` | 541–558 | Legacy completion event, no handler |
| `apps-console/documents.batch-completed` | 568–579 | Legacy batch tracking event, no handler |

Also remove the `syncTriggerSchema` import from line 8 (if it becomes unused).

**Keep** these events (still have active handlers):
- `apps-console/source.disconnected` — used as `cancelOn` (but sync-orchestrator is deleted; check if any other function uses it)
- `apps-console/store.ensure` — infrastructure
- `apps-console/activity.record` — activity tracking
- `apps-console/documents.process` — generic document processor (stays)
- `apps-console/documents.delete` — generic document deleter (stays)
- `apps-console/relationships.extract` — relationship extraction
- All `apps-console/neural/*` events
- All `apps-console/backfill.*` events
- `apps-console/notification.dispatch`

Also remove the "UNIFIED ORCHESTRATION EVENTS", "BATCH PROCESSING EVENTS", "SOURCE-SPECIFIC ORCHESTRATION EVENTS", and "GITHUB FILE EVENTS" section headers/comments.

**Note on `apps-console/source.disconnected`**: Check if any remaining function references this event. If not, it can also be removed. The sync-orchestrator used it as `cancelOn` but that function is being deleted. Keep it if it's still semantically useful for future workflows.

### Success Criteria:

#### Automated Verification:
- [x] Removed events have no active handlers in remaining code
- [x] Remaining events all have valid handlers

---

## Phase 4: Clean Up Webhook Route

### Overview
Remove the `handlePushEvent` function from the webhook route. This function sends `apps-console/github.push` which no longer has a handler. Keep `handlePushObservation` (sends to neural observation.capture).

### Changes Required:

**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`

1. **DELETE** the `handlePushEvent` function (lines 69–166) entirely

2. **Update** the `case "push":` block (lines 526–531) to only call observation:
```ts
case "push":
  // Capture as observation for neural memory
  await handlePushObservation(body as PushEvent, deliveryId, payload, webhookHeaders);
  break;
```

3. The `PushEvent` type import stays (used by `handlePushObservation`)
4. The `transformGitHubPush` import stays (used by `handlePushObservation`)
5. `SourcesService` import — check if it's still needed after removing `handlePushEvent`. The push handler used `sourcesService.getSourceIdByGithubRepoId`. If no other case uses `SourcesService`, remove the import.

### Success Criteria:

#### Automated Verification:
- [x] `handlePushEvent` function no longer exists
- [x] Push case still dispatches to `handlePushObservation`
- [x] No reference to `apps-console/github.push` event remains in the file

---

## Phase 5: Clean Up Validation Schemas

### Overview
Remove sync-related I/O schemas from `@repo/console-validation`.

### Changes Required:

**File**: `packages/console-validation/src/schemas/workflow-io.ts`

1. **DELETE** these input schemas:
   - `sourceConnectedGitHubInputSchema` (lines 9–14)
   - `sourceSyncGitHubInputSchema` (lines 22–30)
   - `syncOrchestratorInputSchema` (lines 38–44)

2. **UPDATE** `workflowInputSchema` discriminated union (line 104) — remove the 3 deleted schemas:
```ts
export const workflowInputSchema = z.discriminatedUnion("inngestFunctionId", [
  // Neural workflows
  neuralObservationCaptureInputSchema,
  neuralProfileUpdateInputSchema,
  neuralClusterSummaryInputSchema,
  neuralLLMEntityExtractionInputSchema,
  // Backfill workflows
  backfillOrchestratorInputSchema,
]);
```

3. **DELETE** these output schemas:
   - `sourceConnectedGitHubOutputSuccessSchema` (lines 130–140)
   - `sourceConnectedGitHubOutputFailureSchema` (lines 148–159)
   - `sourceSyncGitHubOutputSuccessSchema` (lines 167–177)
   - `sourceSyncGitHubOutputFailureSchema` (lines 185–196)
   - `syncOrchestratorOutputSuccessSchema` (lines 204–213)
   - `syncOrchestratorOutputFailureSchema` (lines 219–229)

4. **UPDATE** `workflowOutputSchema` union (line 395) — remove the 6 deleted schemas:
```ts
export const workflowOutputSchema = z.union([
  // Neural workflows
  neuralObservationCaptureOutputSuccessSchema,
  neuralObservationCaptureOutputFilteredSchema,
  neuralObservationCaptureOutputFailureSchema,
  neuralProfileUpdateOutputSuccessSchema,
  neuralProfileUpdateOutputFailureSchema,
  neuralClusterSummaryOutputSuccessSchema,
  neuralClusterSummaryOutputSkippedSchema,
  neuralClusterSummaryOutputFailureSchema,
  neuralLLMEntityExtractionOutputSuccessSchema,
  neuralLLMEntityExtractionOutputSkippedSchema,
  neuralLLMEntityExtractionOutputFailureSchema,
  // Backfill workflows
  backfillOrchestratorOutputSuccessSchema,
  backfillOrchestratorOutputFailureSchema,
]);
```

5. **DELETE** type exports:
   - `SourceConnectedGitHubInput` (line 118)
   - `SourceSyncGitHubInput` (line 119)
   - `SyncOrchestratorInput` (line 120)
   - `SourceConnectedGitHubOutputSuccess` (line 420)
   - `SourceConnectedGitHubOutputFailure` (line 421)
   - `SourceSyncGitHubOutputSuccess` (line 422)
   - `SourceSyncGitHubOutputFailure` (line 423)
   - `SyncOrchestratorOutputSuccess` (line 424)
   - `SyncOrchestratorOutputFailure` (line 425)

6. Remove unused import `githubSourceMetadataSchema` from line 2 if it's no longer referenced (check if it's still used by remaining schemas — if not used, also check `source-metadata.ts`).

### Success Criteria:

#### Automated Verification:
- [x] Discriminated union compiles with remaining schemas only
- [x] No exported types reference deleted schemas

---

## Phase 6: Clean Up tRPC Routes

### Overview
Remove sync-triggering code from org/jobs restart and user/workspace creation.

### Changes Required:

#### 1. Job restart handler
**File**: `api/console/src/router/org/jobs.ts`

Remove the two sync-triggering cases from the restart switch:

- **DELETE** `case "source-connected":` and `case "source-sync":` block (lines 425–472) — these send `sync.requested` which no longer has a handler
- **DELETE** `case "apps-console/github-sync":` block (lines 475–502) — legacy case

Replace with an error case that informs the user these job types can no longer be restarted:
```ts
case "source-connected":
case "source-sync":
case "apps-console/github-sync":
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Sync jobs are no longer supported and cannot be restarted.",
  });
```

Also remove the `inngest` import if it's no longer used by this file, and the `getWorkspaceKey` import/usage if only used by the deleted cases.

#### 2. Initial workspace sync
**File**: `api/console/src/router/user/workspace.ts`

**DELETE** the Inngest send block (lines 262–278):
```ts
// DELETE: Trigger initial sync via Inngest
// try {
//   await inngest.send({
//     name: "apps-console/sync.requested",
//     ...
//   });
// } catch (inngestError) { ... }
```

Remove the `inngest` import if no longer used by this file.

### Success Criteria:

#### Automated Verification:
- [x] No remaining code sends `apps-console/sync.requested`
- [x] Job restart for sync types returns a clear error message

---

## Phase 7: Clean Up m2m Sources Router

### Overview
Remove sync-specific mutations that are only called during push handling.

### Changes Required:

**File**: `api/console/src/router/m2m/sources.ts`

**DELETE** these mutations (they were only called by push-handler / webhook push handling):
- `updateGithubSyncStatus` (lines 149–204) — called when push events toggle active status
- `updateGithubConfigStatus` (lines 218–287) — called when lightfast.yml changes detected

Also delete the corresponding input schemas:
- `updateGithubSyncStatusSchema` (lines 17–21)
- `updateGithubConfigStatusSchema` (lines 23–27)

**KEEP** these mutations (still used by other webhook events):
- `findByGithubRepoId` — used for general webhook resolution
- `getSourceIdByGithubRepoId` — used for general webhook resolution
- `markGithubInstallationInactive` — used by `case "installation":` in webhook route
- `markGithubDeleted` — used by `case "repository":` in webhook route
- `updateGithubMetadata` — used by `case "repository":` in webhook route

### Success Criteria:

#### Automated Verification:
- [x] `updateGithubSyncStatus` and `updateGithubConfigStatus` no longer exist
- [x] Remaining mutations still compile

---

## Phase 8: Clean Up @repo/console-octokit-github Package

### Overview
Remove sync-specific modules and exports that are no longer imported anywhere.

### Changes Required:

**File**: `packages/console-octokit-github/src/index.ts`

After Phases 1–7, these exports will have zero importers:
- `GitHubContentService` — was only used by github-sync-orchestrator and files-batch-processor (both deleted)
- `ConfigDetectorService` — was only used by push-handler (deleted)
- `ChangedFile`, `FetchedFile` types — only used by sync files
- `createThrottledOctokit`, `getThrottledInstallationOctokit`, `checkRateLimit` — verify importers first

**Check before removing `getThrottledInstallationOctokit`**: The backfill connector at `packages/console-backfill/src/connectors/github.ts` imports `createGitHubApp` and `getThrottledInstallationOctokit`. If backfill still uses them, keep the throttled exports.

Based on the research:
- `packages/console-backfill/src/connectors/github.ts` imports `createGitHubApp` and `getThrottledInstallationOctokit` → **KEEP** these two exports
- `checkRateLimit` — check if backfill uses it; if not, remove

Remove from the barrel export:
```ts
// DELETE if no remaining importers:
// export { GitHubContentService } from "./github-content";
// export type { ChangedFile, FetchedFile } from "./github-content";
// export { ConfigDetectorService } from "./config-detector";
// export type { ConfigDetectionResult } from "./config-detector";
```

**Optionally delete the source files if they become dead code**:
- `packages/console-octokit-github/src/github-content.ts` — if `GitHubContentService` has no importers
- `packages/console-octokit-github/src/config-detector.ts` — if `ConfigDetectorService` has no importers

### Success Criteria:

#### Automated Verification:
- [x] No remaining files import deleted exports
- [x] Package still builds: `pnpm --filter @repo/console-octokit-github build`

---

## Phase 9: Verify Everything Compiles

### Overview
Run full typecheck and lint across the monorepo.

### Changes Required:

No code changes — this is verification only.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes (pre-existing @repo/og errors excluded)
- [x] `pnpm lint` passes (pre-existing org/workspace.ts errors excluded)
- [ ] `pnpm build:console` passes

#### Manual Verification:
- [ ] `pnpm dev:app` starts without errors
- [ ] Inngest dashboard shows no sync-related functions
- [ ] Pushing to a connected GitHub repo does NOT trigger sync (only neural observation)
- [ ] Webhook endpoint still handles pull_request, issues, release, discussion events correctly

**Implementation Note**: After Phase 9 automated verification passes, pause for manual confirmation.

---

## Testing Strategy

### Automated:
- `pnpm typecheck` — catches any broken imports or type references
- `pnpm lint` — catches unused imports/variables
- `pnpm build:console` — full build verification

### Manual:
1. Start dev server with `pnpm dev:app`
2. Verify Inngest dashboard at `http://localhost:8288` shows no sync-related functions
3. Trigger a GitHub push webhook (or simulate) — confirm no sync job is created
4. Confirm neural observation still captures push events
5. Verify PR/issue/release webhooks still work for observations

## Performance Considerations

None — this is purely removing code. The Inngest function registry will be smaller, which is a minor improvement.

## Migration Notes

- Existing sync jobs in `workspaceWorkflowRuns` table remain as historical data
- The `lastSyncedAt` and `lastSyncStatus` columns on `workspaceIntegrations` will stop being updated by sync but may still be updated by other flows — no schema change needed
- No data migration required

## References

- Research: `thoughts/shared/research/2026-02-25-github-push-sync-removal-map.md`
