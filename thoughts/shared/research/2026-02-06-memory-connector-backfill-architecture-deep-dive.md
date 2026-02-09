---
date: 2026-02-06T12:25:27Z
researcher: Claude
git_commit: 6a8611ef
branch: main
repository: lightfast
topic: "Memory Connector Backfill Architecture - Auth Flows, Ingestion Pipeline, DB Schema, Transformer Reusability"
tags: [research, codebase, backfill, connectors, sources, memory, ingestion, github, vercel, linear, sentry, auth, transformers, inngest, trpc]
status: complete
last_updated: 2026-02-06
last_updated_by: Claude
---

# Research: Memory Connector Backfill Architecture Deep Dive

**Date**: 2026-02-06T12:25:27Z
**Researcher**: Claude
**Git Commit**: 6a8611ef
**Branch**: main
**Repository**: lightfast

## Research Question

How does the current Lightfast codebase handle authentication, ingestion, database storage, and event transformation for memory connectors (GitHub, Vercel, Linear, Sentry)? What components exist that a backfill system could reuse, and what gaps must be filled?

## Summary

The codebase has a mature webhook-driven observation pipeline for GitHub and Vercel, with transformers (but no auth or webhooks) for Linear and Sentry. There is **zero backfill implementation** despite the ingestion schema already defining `"backfill"` as a valid source type. All event transformers are **tightly coupled to webhook payload shapes** and cannot accept API list response shapes without adapter layers. The Inngest workflow system has mature patterns for batching, concurrency, and completion tracking that a backfill system can model after.

---

## 1. Authentication Flows (Per Provider)

### 1.1 GitHub Authentication

GitHub uses a **dual-flow** approach: User OAuth + GitHub App installation.

#### User OAuth Flow
- **Initiation**: `apps/console/src/app/(github)/api/github/authorize-user/route.ts:24` — Redirects to `https://github.com/login/oauth/authorize` with `client_id`, `redirect_uri`, and encrypted state.
- **Callback**: `apps/console/src/app/(github)/api/github/user-authorized/route.ts:35` — Exchanges code for user access token via POST to `https://github.com/login/oauth/access_token`.
- **Installation Fetch**: Uses the user access token to call `GET /user/installations` at `packages/console-octokit-github/src/index.ts:94`.
- **Token Storage**: Encrypted with AES-256-GCM via `encrypt(accessToken, env.ENCRYPTION_KEY)` before storing in `userSources` table. Called at callback route line 166.
- **Token in Cookie**: Short-lived 5-minute encrypted cookie `github_user_token` for one-time installation listing.

#### GitHub App Installation Flow
- **Initiation**: `apps/console/src/app/(github)/api/github/install-app/route.ts:23` — Redirects to `https://github.com/apps/{appSlug}/installations/new`.
- **Callback**: `apps/console/src/app/(github)/api/github/app-installed/route.ts:24` — Stores `installation_id` in cookie, then bridges to User OAuth flow.
- **Installation Token Generation**: `packages/console-octokit-github/src/index.ts:67-79` creates GitHub App instance with `appId` and `privateKey`. Installation tokens generated on-demand via JWT at `packages/console-octokit-github/src/throttled.ts:76-79`:
  ```typescript
  const { token } = await app.octokit.auth({
    type: "installation",
    installationId,
  }) as { token: string };
  ```
- **Rate Limiting**: `packages/console-octokit-github/src/throttled.ts:13-63` — Plugin-based throttling with retry up to 2 times on primary limits, never auto-retries secondary limits. Reserves 50 requests as buffer (line 113-117).

**Key for Backfill**: GitHub App installation tokens can be generated on-demand for any connected installation. The `createThrottledOctokit()` function already handles rate limiting. The `userSources.providerMetadata.installations` array provides all installation IDs needed for API calls.

### 1.2 Vercel Authentication

- **Initiation**: `apps/console/src/app/(vercel)/api/vercel/authorize/route.ts:25` — Redirects to Vercel Integration marketplace at `https://vercel.com/integrations/lightfast-dev/new` (NOT `/oauth/authorize`).
- **Callback**: `apps/console/src/app/(vercel)/api/vercel/callback/route.ts:44` — Exchanges code via POST to `https://api.vercel.com/v2/oauth/access_token` using `application/x-www-form-urlencoded`.
- **Token Storage**: Encrypted with same AES-256-GCM and stored in `userSources` table at callback line 151.
- **API Calls**: Decrypted token used as `Bearer` token in Authorization header at `api/console/src/router/user/user-sources.ts:847-849`.

**Key for Backfill**: The `accessToken` in `userSources` is a long-lived integration token that can be used for API calls. Vercel rate limit is 100 requests/minute.

### 1.3 Linear Authentication

**Status: NOT IMPLEMENTED**

- No OAuth routes exist in `apps/console/src/app/` for Linear.
- No auth code found via search for `*linear*auth*`, `*linear*oauth*`, `*linear*connect*`.
- Only webhook transformers exist at `packages/console-webhooks/src/transformers/linear.ts` (844 lines).
- Historical research at `thoughts/shared/research/2026-01-22-linear-integration-ingestion-retrieval-pipeline.md`.

**Backfill Blocker**: OAuth must be implemented before any backfill is possible.

### 1.4 Sentry Authentication

**Status: NOT IMPLEMENTED**

- No OAuth routes exist in `apps/console/src/app/` for Sentry.
- No auth code found via search.
- Only webhook transformers exist at `packages/console-webhooks/src/transformers/sentry.ts` (585 lines).
- Historical research at `thoughts/shared/research/2026-01-22-sentry-ingestion-retrieval-pipeline.md`.

**Backfill Blocker**: OAuth must be implemented before any backfill is possible.

### 1.5 Token Storage Schema

**Table**: `lightfast_user_sources` at `db/console/src/schema/tables/user-sources.ts`

| Field | Type | Description |
|-------|------|-------------|
| `accessToken` | text NOT NULL | **Encrypted at app layer** with AES-256-GCM |
| `refreshToken` | text | GitHub refresh token (nullable) |
| `tokenExpiresAt` | timestamp | Token expiration (nullable) |
| `scopes` | text[] | OAuth scopes (nullable) |
| `providerMetadata` | jsonb NOT NULL | Source-specific discriminated union |

GitHub metadata includes `installations[]` with `id`, `accountId`, `accountLogin`, `accountType`, `avatarUrl`, `permissions`.

Vercel metadata includes `teamId`, `teamSlug`, `userId`, `configurationId`.

### 1.6 OAuth State Security

Both GitHub and Vercel use `@repo/console-oauth/state` package:
- Cryptographically random 32-byte token + 16-byte nonce
- 10-minute expiration
- Constant-time comparison to prevent timing attacks
- One-time nonce to prevent replay attacks
- AES-256-GCM token encryption for cookie storage

---

## 2. Ingestion Pipeline (End-to-End)

### 2.1 Webhook Handler Routes

| Provider | Route | File |
|----------|-------|------|
| GitHub | `POST /api/github/webhooks` | `apps/console/src/app/(github)/api/github/webhooks/route.ts:462` |
| Vercel | `POST /api/vercel/webhooks` | `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:139` |

### 2.2 Complete Pipeline Flow

```
Webhook Arrives
       │
       ▼
1. Signature Verification (HMAC SHA-256)
       │
       ▼
2. Timestamp Validation (5-min window, replay prevention)
       │
       ▼
3. Workspace Resolution
   ├── GitHub: resolveFromGithubOrgSlug(ownerLogin)
   └── Vercel: JOIN workspaceIntegrations → userSources → orgWorkspaces WHERE providerResourceId = projectId
       │
       ▼
4. Raw Payload Storage → lightfast_workspace_webhook_payloads
       │
       ▼
5. Transform → SourceEvent (via provider-specific transformer)
       │
       ▼
6. inngest.send("apps-console/neural/observation.capture", { workspaceId, clerkOrgId, sourceEvent })
       │
       ▼
7. Observation Capture Workflow (8+ steps):
   ├── Step 0: Create job tracking record
   ├── Step 1: Dedup check (workspaceId + sourceId)
   ├── Step 2: Event filtering (check sourceConfig.sync.events)
   ├── Step 3: Significance scoring (gate at threshold 30)
   ├── Step 4: Fetch workspace context
   ├── Step 5a: LLM classification (Claude Haiku, regex fallback)
   ├── Step 5b: Parallel → embeddings (3 views) + entities + actor resolution
   ├── Step 5.5: Cluster assignment
   ├── Step 6: Vector upsert (3 Pinecone vectors with view-specific metadata)
   ├── Step 7: DB insert (observation + entities in transaction)
   ├── Step 7.5: Relationship detection (shared commits/branches)
   ├── Step 7.6: Vercel actor reconciliation (from GitHub pushes)
   └── Step 8: Fire-and-forget events (profile update, cluster summary, LLM entity extraction)
```

### 2.3 GitHub Webhook Event Routing

The GitHub webhook handler (`route.ts:525-598`) routes events to type-specific handlers:

| Event | Handler | Inngest Event |
|-------|---------|---------------|
| `push` | `handlePushEvent()` + `handlePushObservation()` | `apps-console/github.push` (docs) + `apps-console/neural/observation.capture` |
| `pull_request` | `handlePullRequestEvent()` | `apps-console/neural/observation.capture` |
| `issues` | `handleIssuesEvent()` | `apps-console/neural/observation.capture` |
| `release` | `handleReleaseEvent()` | `apps-console/neural/observation.capture` |
| `discussion` | `handleDiscussionEvent()` | `apps-console/neural/observation.capture` |
| `installation_repositories` | `handleInstallationRepositoriesEvent()` | None (DB update only) |
| `installation` | inline | None (marks inactive) |
| `repository` | inline | None (marks deleted/updates metadata) |

### 2.4 Documents vs Observations

- **Observations** (neural memory): Created from ALL webhook event types (push, PR, issues, releases, discussions, deployments). Stored in `workspace_neural_observations` with embeddings in Pinecone.
- **Documents** (knowledge base): Created only from `push` events via `apps-console/github.push` → `sync-orchestrator` → `github-sync-orchestrator` → file content indexing. Stored in `workspace_knowledge_documents`.

Push events trigger BOTH pipelines (line 527-530):
```typescript
case "push":
  await handlePushEvent(body as PushEvent, deliveryId);           // Documents
  await handlePushObservation(body as PushEvent, deliveryId, ...); // Observations
```

---

## 3. Database Schema

### 3.1 workspace_integrations (`lightfast_workspace_integrations`)

**File**: `db/console/src/schema/tables/workspace-integrations.ts`

| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar(191) PK | Nanoid |
| `workspaceId` | varchar(191) FK CASCADE | Links to orgWorkspaces |
| `userSourceId` | varchar(191) FK CASCADE | Links to userSources (OAuth) |
| `connectedBy` | varchar(191) | Clerk user ID |
| `sourceConfig` | jsonb NOT NULL | Provider-specific config (see below) |
| `providerResourceId` | varchar(191) NOT NULL | Indexed: GitHub repoId or Vercel projectId |
| `isActive` | boolean DEFAULT true | Soft delete flag |
| `lastSyncedAt` | timestamp | Last successful sync |
| `lastSyncStatus` | varchar(50) | `"success"` / `"failed"` / `"pending"` |
| `lastSyncError` | text | Error message |
| `documentCount` | integer DEFAULT 0 | Denormalized count |
| `connectedAt` | timestamp DEFAULT NOW() | Connection time |

**sourceConfig JSON - GitHub** (line 82-104):
```typescript
{
  version: 1,
  sourceType: "github",
  type: "repository",
  installationId: string,
  repoId: string,
  repoName: string,
  repoFullName: string,
  defaultBranch: string,
  isPrivate: boolean,
  isArchived: boolean,
  sync: {
    branches?: string[],    // ["main", "develop"]
    paths?: string[],       // ["**/*"]
    events?: string[],      // ["push", "pull_request", "issues", "release", "discussion"]
    autoSync: boolean
  },
  status?: {
    configStatus?: "configured" | "awaiting_config",
    configPath?: string,
    lastConfigCheck?: string
  }
}
```

**sourceConfig JSON - Vercel** (line 105-118):
```typescript
{
  version: 1,
  sourceType: "vercel",
  type: "project",
  projectId: string,
  projectName: string,
  teamId?: string,
  teamSlug?: string,
  configurationId: string,
  sync: {
    events?: string[],     // ["deployment.created", "deployment.ready", ...]
    autoSync: boolean
  }
}
```

**No backfill-specific fields exist** in this schema. No `backfill.status`, `backfill.depth`, or `backfill.completedAt`.

### 3.2 workspace_neural_observations (`lightfast_workspace_neural_observations`)

**File**: `db/console/src/schema/tables/workspace-neural-observations.ts`

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint PK GENERATED | Internal performance key |
| `externalId` | varchar(21) UNIQUE | Nanoid for API responses |
| `workspaceId` | varchar(191) FK CASCADE | Workspace owner |
| `clusterId` | bigint | Cluster assignment |
| `occurredAt` | timestamp NOT NULL | When event occurred in source |
| `capturedAt` | timestamp DEFAULT NOW() | When observation was captured |
| `actor` | jsonb | `{ id, name, email?, avatarUrl? }` |
| `actorId` | bigint | Resolved actor profile reference |
| `observationType` | varchar(100) NOT NULL | e.g., "pr_merged", "deployment_succeeded" |
| `title` | text NOT NULL | <=120 chars embeddable headline |
| `content` | text NOT NULL | Full content for embedding |
| `topics` | jsonb | Extracted topics array |
| `significanceScore` | real | 0-100 score |
| `source` | varchar(50) NOT NULL | "github", "vercel", etc. |
| `sourceType` | varchar(100) NOT NULL | Source-specific event type |
| `sourceId` | varchar(255) NOT NULL | **Dedup key**: unique source identifier |
| `sourceReferences` | jsonb | Related entity references |
| `metadata` | jsonb | Source-specific metadata |
| `embeddingTitleId` | varchar(191) | Pinecone vector ID |
| `embeddingContentId` | varchar(191) | Pinecone vector ID |
| `embeddingSummaryId` | varchar(191) | Pinecone vector ID |

**Key dedup index**: `obs_source_id_idx` on `(workspaceId, sourceId)` at line 222-225.

**No `ingestionSource` column exists** — there is no field to distinguish webhook-sourced vs backfill-sourced observations.

### 3.3 workspace_webhook_payloads (`lightfast_workspace_webhook_payloads`)

**File**: `db/console/src/schema/tables/workspace-webhook-payloads.ts`

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint PK GENERATED | Internal key |
| `workspaceId` | varchar(191) FK CASCADE | Workspace owner |
| `deliveryId` | varchar(191) NOT NULL | Unique delivery ID from source |
| `source` | varchar(50) NOT NULL | "github" or "vercel" |
| `eventType` | varchar(100) NOT NULL | Raw event type |
| `payload` | jsonb NOT NULL | Complete unmodified webhook body |
| `headers` | jsonb NOT NULL | Relevant HTTP headers |
| `receivedAt` | timestamp NOT NULL | When received |

**Key index**: `webhook_payload_delivery_idx` on `deliveryId` at line 94-96.

### 3.4 Relationship: Two-Table Source Architecture

```
userSources (Personal OAuth)          workspaceIntegrations (Workspace Resources)
┌─────────────────────┐                ┌─────────────────────────┐
│ id                  │◄──────────────│ userSourceId (FK)       │
│ userId              │                │ workspaceId (FK)        │
│ sourceType          │                │ providerResourceId      │
│ accessToken (enc)   │                │ sourceConfig (jsonb)    │
│ refreshToken        │                │ lastSyncedAt            │
│ providerMetadata    │                │ lastSyncStatus          │
└─────────────────────┘                └─────────────────────────┘
```

A user connects once (userSources), then links specific resources to workspaces (workspaceIntegrations).

---

## 4. Transformer Analysis

### 4.1 Transformer Function Signatures

All transformers live in `packages/console-webhooks/src/transformers/`:

| Function | File:Line | Input Type | Output |
|----------|-----------|-----------|--------|
| `transformGitHubPush` | `github.ts:36` | `PushEvent` (octokit) + `TransformContext` | `SourceEvent` |
| `transformGitHubPullRequest` | `github.ts:114` | `PullRequestEvent` (octokit) + `TransformContext` | `SourceEvent` |
| `transformGitHubIssue` | `github.ts:256` | `IssuesEvent` (octokit) + `TransformContext` | `SourceEvent` |
| `transformGitHubRelease` | `github.ts:340` | `ReleaseEvent` (octokit) + `TransformContext` | `SourceEvent` |
| `transformGitHubDiscussion` | `github.ts:407` | `DiscussionEvent` (octokit) + `TransformContext` | `SourceEvent` |
| `transformVercelDeployment` | `vercel.ts:17` | `VercelWebhookPayload` + `VercelDeploymentEvent` + `TransformContext` | `SourceEvent` |
| `transformLinearIssue` | `linear.ts:350` | `LinearIssueWebhook` + `TransformContext` | `SourceEvent` |
| `transformLinearComment` | `linear.ts:518` | `LinearCommentWebhook` + `TransformContext` | `SourceEvent` |
| `transformLinearProject` | `linear.ts:585` | `LinearProjectWebhook` + `TransformContext` | `SourceEvent` |
| `transformLinearCycle` | `linear.ts:683` | `LinearCycleWebhook` + `TransformContext` | `SourceEvent` |
| `transformLinearProjectUpdate` | `linear.ts:760` | `LinearProjectUpdateWebhook` + `TransformContext` | `SourceEvent` |
| `transformSentryIssue` | `sentry.ts:252` | `SentryIssueWebhook` + `TransformContext` | `SourceEvent` |
| `transformSentryError` | `sentry.ts:368` | `SentryErrorWebhook` + `TransformContext` | `SourceEvent` |
| `transformSentryEventAlert` | `sentry.ts:450` | `SentryEventAlertWebhook` + `TransformContext` | `SourceEvent` |
| `transformSentryMetricAlert` | `sentry.ts:507` | `SentryMetricAlertWebhook` + `TransformContext` | `SourceEvent` |

### 4.2 TransformContext Type

**File**: `packages/console-types/src/neural/source-event.ts:73-76`

```typescript
interface TransformContext {
  deliveryId: string;  // Webhook delivery ID for idempotency
  receivedAt: Date;    // When webhook was received
}
```

### 4.3 SourceEvent Output Type

**File**: `packages/console-types/src/neural/source-event.ts:7-37`

```typescript
interface SourceEvent {
  source: SourceType;              // "github" | "vercel" | "linear" | "sentry"
  sourceType: string;               // "pull-request.opened", "deployment.succeeded"
  sourceId: string;                 // "pr:lightfastai/lightfast#123:opened"
  title: string;                    // <=120 chars
  body: string;                     // Full content for embedding
  actor?: SourceActor;              // { id, name, email?, avatarUrl? }
  occurredAt: string;               // ISO timestamp
  references: SourceReference[];    // Commits, branches, PRs, etc.
  metadata: Record<string, unknown>;
}
```

### 4.4 Can Transformers Accept API Response Shapes?

**NO — all transformers are tightly coupled to webhook payload shapes.**

Critical dependencies on webhook-specific fields:

| Provider | Webhook-Only Fields Used | Consequence for Backfill |
|----------|--------------------------|--------------------------|
| **GitHub** | `payload.action`, `payload.sender`, `payload.installation`, `payload.pusher` | API list responses lack `action` field entirely |
| **Vercel** | Root-level `{ id, type, createdAt, payload: { deployment, project } }` envelope | API returns flat deployment objects |
| **Linear** | `{ action, type, data, webhookId, webhookTimestamp, organizationId, updatedFrom }` | GraphQL returns issue objects without envelope |
| **Sentry** | `{ action, data: { issue }, installation, actor }` | REST API returns issue objects directly |

**The `action` field is the critical blocker.** All transformers use `payload.action` to:
1. Determine `sourceType` (e.g., "pull-request.opened" vs "pull-request.closed")
2. Generate unique `sourceId` that includes the action
3. Select title prefix ("[PR Opened]", "[PR Merged]", etc.)

**Example from GitHub PR transformer (line 206)**:
```typescript
const effectiveAction =
  payload.action === "closed" && pr.merged ? "merged" : payload.action;
```

### 4.5 Backfill Adapter Requirements

To reuse existing transformers for backfill, adapter functions must:

1. **Determine action from context** — For API list responses, infer action from entity state:
   - PR: `state === "open" ? "opened" : (merged ? "merged" : "closed")`
   - Issue: `state === "open" ? "opened" : "closed"`
   - Release: `"published"` (all listed releases are published)
   - Deployment: Map deployment state to event type

2. **Wrap API response in webhook envelope** — Add required envelope fields:
   ```typescript
   // Adapter example for GitHub PR
   function adaptPRForTransformer(pr: GitHubPR, repo: Repository): PullRequestEvent {
     return {
       action: pr.state === "open" ? "opened" : (pr.merged ? "merged" : "closed"),
       pull_request: pr,
       repository: repo,
       sender: pr.user, // GitHub API includes user
       // installation not needed for transformer
     };
   }
   ```

3. **Provide synthetic TransformContext** — For backfill, use:
   ```typescript
   { deliveryId: `backfill-${sourceId}`, receivedAt: new Date() }
   ```

**Alternative approach**: Create new backfill-specific transformer functions that accept API response shapes directly, producing the same `SourceEvent` output.

---

## 5. tRPC Source Routes

### 5.1 Source Connection Flow

1. **User OAuth** → `userSources.github.storeOAuthResult` (userRouter, line 279) or `userSources.vercel.storeOAuthResult` (userRouter, line 713)
2. **Link resources** → `workspace.integrations.bulkLinkGitHubRepositories` (orgRouter, line 1115) or `workspace.integrations.bulkLinkVercelProjects` (orgRouter, line 1266)
3. **No auto-sync** — Bulk link operations only create `workspaceIntegration` records, no Inngest events triggered.

### 5.2 Key Routes

| Route | Router | Type | File:Line | Purpose |
|-------|--------|------|-----------|---------|
| `userSources.list` | user | query | `user-sources.ts:47` | List user's OAuth connections |
| `userSources.disconnect` | user | mutation | `user-sources.ts:75` | Soft-delete OAuth connection |
| `userSources.github.storeOAuthResult` | user | mutation | `user-sources.ts:279` | Store encrypted GitHub tokens + installations |
| `userSources.github.repositories` | user | query | `user-sources.ts:384` | List repos for installation (uses GitHub App) |
| `userSources.vercel.storeOAuthResult` | user | mutation | `user-sources.ts:713` | Store encrypted Vercel tokens |
| `userSources.vercel.listProjects` | user | query | `user-sources.ts:799` | List Vercel projects (uses access token) |
| `workspace.sources.list` | org | query | `workspace.ts:571` | List connected sources with sync status |
| `workspace.integrations.bulkLinkGitHubRepositories` | org | mutation | `workspace.ts:1115` | Connect up to 50 repos |
| `workspace.integrations.bulkLinkVercelProjects` | org | mutation | `workspace.ts:1266` | Connect up to 50 projects |
| `workspace.integrations.updateEvents` | org | mutation | `workspace.ts:1061` | Update event subscriptions |
| `workspace.integrations.disconnect` | org | mutation | `workspace.ts:890` | Soft-delete integration |
| `jobs.restart` | org | mutation | `jobs.ts:350` | Restart sync job (triggers Inngest) |

### 5.3 Existing Sync/Status Endpoints

- **`jobs.restart`** at `jobs.ts:350` — Sends `apps-console/sync.requested` Inngest event with `syncMode: "full"`. This is the only existing manual sync trigger.
- **`workspace.sources.list`** at `workspace.ts:571` — Returns `lastSyncedAt`, `lastSyncStatus`, `documentCount` for UI status display.
- **No dedicated backfill endpoint exists.**

### 5.4 M2M Routes (Internal Services)

The `m2mRouter` at `api/console/src/router/m2m/sources.ts` provides internal service methods used by webhook handlers:
- `findByGithubRepoId` (line 73) — Indexed lookup by `providerResourceId`
- `getSourceIdByGithubRepoId` (line 105) — Scoped to workspace
- `updateGithubSyncStatus` (line 149) — Updates sync tracking fields
- `markGithubInstallationInactive` (line 299) — Bulk deactivation
- `markGithubDeleted` (line 368) — Archive + deactivate
- `updateGithubMetadata` (line 448) — Rename, privacy, archive updates

### 5.5 Services Layer

**SourcesService** at `packages/console-api-services/src/sources.ts` — Wraps M2M tRPC calls for Inngest workflows.

**WorkspacesService** at `packages/console-api-services/src/workspaces.ts` — `resolveFromGithubOrgSlug()` returns `{ workspaceId, workspaceKey, workspaceSlug, clerkOrgId }`.

---

## 6. Inngest Patterns

### 6.1 Registered Workflows (13 total)

| Workflow | Event | File |
|----------|-------|------|
| `syncOrchestrator` | `apps-console/sync.requested` | `workflow/orchestration/sync-orchestrator.ts` |
| `githubSyncOrchestrator` | `apps-console/github.sync.trigger` | `workflow/sources/github-sync-orchestrator.ts` |
| `githubPushHandler` | `apps-console/github.push` | `workflow/sources/github-push-handler.ts` |
| `filesBatchProcessor` | `apps-console/files.process.batch` | `workflow/processing/files-batch-processor.ts` |
| `processDocuments` | `apps-console/documents.process` | `workflow/processing/process-documents.ts` |
| `deleteDocuments` | `apps-console/documents.delete` | `workflow/processing/delete-documents.ts` |
| `recordActivity` | `apps-console/activity.record` | `workflow/infrastructure/record-activity.ts` |
| **`observationCapture`** | **`apps-console/neural/observation.capture`** | `workflow/neural/observation-capture.ts` |
| `profileUpdate` | `apps-console/neural/profile.update` | `workflow/neural/profile-update.ts` |
| `clusterSummaryCheck` | `apps-console/neural/cluster.check-summary` | `workflow/neural/cluster-summary.ts` |
| `llmEntityExtraction` | `apps-console/neural/entity.extract` | `workflow/neural/llm-entity-extraction.ts` |
| `notificationDispatch` | `apps-console/notification.dispatch` | `workflow/notifications/notification-dispatch.ts` |

### 6.2 Concurrency Patterns

| Workflow | Limit | Key | Purpose |
|----------|-------|-----|---------|
| `observationCapture` | 10 | `event.data.workspaceId` | Per-workspace observation throughput |
| `processDocuments` | 5 | `event.data.workspaceId` | Per-workspace document processing |
| `profileUpdate` | 5 | `event.data.workspaceId` | Per-workspace profile updates |
| `clusterSummaryCheck` | 3 | `event.data.workspaceId` | Per-workspace cluster summaries |
| `syncOrchestrator` | 1 | `event.data.sourceId` | One sync per source |
| `githubSyncOrchestrator` | 1 | `event.data.sourceId` | One sync per source |

### 6.3 Batch Processing Patterns

**Event Batching (automatic):**
```typescript
// process-documents.ts:123-127
batchEvents: { maxSize: 25, timeout: "5s", key: "event.data.workspaceId" }

// record-activity.ts:36-40
batchEvents: { maxSize: 100, timeout: "10s", key: "event.data.workspaceId" }
```

**Array Chunking (manual):**
```typescript
// github-sync-orchestrator.ts:26-33
function chunkArray<T>(array: T[], size: number): T[][] { ... }
```

### 6.4 Completion Tracking Pattern

**Orchestrator → Source → Completion:**
```typescript
// sync-orchestrator.ts:192-206
await step.sendEvent("trigger-source-sync", {
  name: "apps-console/github.sync.trigger",
  data: { jobId, workspaceId, ... }
});

const sourceResult = await step.waitForEvent("await-source-completion", {
  event: "apps-console/github.sync.completed",
  match: "data.jobId",
  timeout: "25m"
});
```

### 6.5 Event Naming Conventions

- Prefix: `apps-console/`
- Categories: `sync.*`, `github.*`, `files.*`, `documents.*`, `neural/*`, `activity.*`, `notification.*`
- Lifecycle: `*.requested` → `*.trigger` → `*.completed` / `*.captured`

### 6.6 Idempotency & Dedup

- **Inngest-level**: `idempotency: "event.data.sourceEvent.sourceId"` at observation-capture.ts:344
- **Database-level**: Check for existing observation by `(workspaceId, sourceId)` at observation-capture.ts:441-446
- **Entity upsert**: `onConflictDoUpdate` increments `occurrenceCount` at observation-capture.ts:974-985

### 6.7 Debouncing

```typescript
// profile-update.ts:36-39
debounce: { key: "event.data.actorId", period: "5m" }

// cluster-summary.ts:58-62
debounce: { key: "event.data.clusterId", period: "10m" }
```

### 6.8 Timeouts

| Workflow | Start | Finish |
|----------|-------|--------|
| `syncOrchestrator` | — | 30m |
| `githubSyncOrchestrator` | — | 20m |
| `observationCapture` | 1m | 5m |

---

## 7. Validation Schemas

### 7.1 Ingestion Source Enum

**File**: `packages/console-validation/src/schemas/ingestion.ts:28-33`

```typescript
export const ingestionSourceSchema = z.enum([
  "webhook",    // External webhook trigger
  "backfill",   // Historical data import/sync ← DEFINED BUT UNUSED
  "manual",     // User-initiated via UI
  "api",        // Direct API call
]);
```

The `"backfill"` source type is **defined in the schema but not referenced anywhere in production code**. No observation or document currently has `ingestionSource: "backfill"`.

### 7.2 Source Type Enum

**File**: `packages/console-validation/src/schemas/sources.ts:23-28`

```typescript
z.enum(["github", "vercel", "linear", "sentry"])
```

### 7.3 Sync Status Enum

**File**: `packages/console-validation/src/schemas/sources.ts:65-69`

```typescript
z.enum(["success", "failed", "pending"])
```

### 7.4 No Backfill-Specific Validation

No Zod schemas exist for backfill configuration (depth, status, progress). The `sourceConfig` JSON shape has no backfill-related fields.

---

## Code References

### Authentication
- `apps/console/src/app/(github)/api/github/authorize-user/route.ts:24` — GitHub OAuth initiation
- `apps/console/src/app/(github)/api/github/user-authorized/route.ts:35` — GitHub OAuth callback + token exchange
- `apps/console/src/app/(github)/api/github/install-app/route.ts:23` — GitHub App installation
- `apps/console/src/app/(github)/api/github/app-installed/route.ts:24` — Post-install bridge to OAuth
- `apps/console/src/app/(vercel)/api/vercel/authorize/route.ts:25` — Vercel marketplace flow
- `apps/console/src/app/(vercel)/api/vercel/callback/route.ts:44` — Vercel OAuth callback
- `packages/console-octokit-github/src/index.ts:67-79` — GitHub App factory (JWT + installation tokens)
- `packages/console-octokit-github/src/throttled.ts:72-82` — Rate-limited Octokit with installation token
- `packages/console-oauth/src/state.ts:145-162` — Secure OAuth state generation
- `packages/console-oauth/src/tokens.ts:151-196` — AES-256-GCM token encryption

### Webhook Handlers
- `apps/console/src/app/(github)/api/github/webhooks/route.ts:462-608` — GitHub webhook POST handler
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:139-214` — Vercel webhook POST handler

### Transformers
- `packages/console-webhooks/src/transformers/github.ts:36-471` — GitHub transformers (5 functions)
- `packages/console-webhooks/src/transformers/vercel.ts:17-161` — Vercel deployment transformer
- `packages/console-webhooks/src/transformers/linear.ts:350-827` — Linear transformers (5 functions)
- `packages/console-webhooks/src/transformers/sentry.ts:252-564` — Sentry transformers (4 functions)
- `packages/console-types/src/neural/source-event.ts:7-37` — SourceEvent type definition
- `packages/console-types/src/neural/source-event.ts:73-76` — TransformContext type

### Storage
- `packages/console-webhooks/src/storage.ts:22-43` — `storeWebhookPayload()` implementation
- `packages/console-webhooks/src/storage.ts:52-78` — `extractWebhookHeaders()` implementation

### Database Schema
- `db/console/src/schema/tables/workspace-integrations.ts:22-155` — Integration config with sourceConfig JSON
- `db/console/src/schema/tables/workspace-neural-observations.ts:48-247` — Observation storage
- `db/console/src/schema/tables/workspace-webhook-payloads.ts:23-106` — Raw webhook payload storage
- `db/console/src/schema/tables/user-sources.ts:22-94` — OAuth token storage with encryption

### Inngest Workflows
- `api/console/src/inngest/workflow/neural/observation-capture.ts:336-1126` — Main observation capture (the write path)
- `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts:1-322` — Sync orchestration patterns
- `api/console/src/inngest/workflow/sources/github-sync-orchestrator.ts:1-251` — GitHub-specific sync
- `api/console/src/inngest/client/client.ts:23-770` — Event schema definitions

### tRPC Routes
- `api/console/src/router/user/user-sources.ts:279-376` — GitHub OAuth storage
- `api/console/src/router/user/user-sources.ts:713-791` — Vercel OAuth storage
- `api/console/src/router/org/workspace.ts:1115-1258` — Bulk link GitHub repos
- `api/console/src/router/org/workspace.ts:1266-1399` — Bulk link Vercel projects
- `api/console/src/router/org/workspace.ts:1061-1107` — Update event subscriptions
- `api/console/src/router/org/jobs.ts:350-531` — Manual sync restart
- `api/console/src/router/m2m/sources.ts:73-524` — Internal M2M source operations

### Validation
- `packages/console-validation/src/schemas/ingestion.ts:28-33` — Ingestion source enum (includes "backfill")
- `packages/console-validation/src/schemas/sources.ts:23-28` — Source type enum
- `packages/console-validation/src/schemas/source-event.ts:52-62` — SourceEvent Zod validation

---

## Architecture Documentation

### Key Patterns

1. **Two-table source architecture**: `userSources` (personal OAuth) + `workspaceIntegrations` (workspace resources). User connects once, links to many workspaces.

2. **Encrypted tokens at application layer**: All access tokens encrypted with AES-256-GCM before database storage. Never stored in plaintext.

3. **Webhook → Inngest → Processing pipeline**: All observations flow through `apps-console/neural/observation.capture` Inngest event, regardless of source.

4. **Deduplication at three levels**: Inngest idempotency (sourceId), database check (workspaceId + sourceId), entity upsert (onConflictDoUpdate).

5. **Dual primary keys**: Internal `bigint` for joins + external `varchar(21)` nanoid for APIs.

6. **Fire-and-forget downstream events**: Observation capture emits profile updates, cluster summaries, and LLM extraction as separate Inngest events.

7. **Completion tracking**: Orchestrator workflows use `step.waitForEvent()` with `match: "data.jobId"` and timeouts.

8. **Batch processing**: Both automatic (Inngest `batchEvents`) and manual (array chunking) patterns exist.

---

## Historical Context (from thoughts/)

### Directly Relevant
- `thoughts/shared/research/2026-02-06-memory-connector-backfill-architecture.md` — Previous backfill architecture research (design-focused, includes proposed event flow and implementation plan)
- `thoughts/shared/research/2025-12-14-neural-memory-production-priority-analysis.md` — Identified backfill as P0 production blocker
- `thoughts/shared/research/2025-12-13-neural-memory-cross-source-architectural-gaps.md` — Gap analysis for cross-source linking

### Integration Research
- `thoughts/shared/research/2026-01-22-linear-integration-ingestion-retrieval-pipeline.md` — Linear integration patterns
- `thoughts/shared/research/2026-01-22-sentry-ingestion-retrieval-pipeline.md` — Sentry integration patterns
- `thoughts/shared/research/2025-12-10-github-pr-integration-research.md` — GitHub PR integration
- `thoughts/shared/research/2025-12-10-github-issues-integration-research.md` — GitHub Issues integration
- `thoughts/shared/research/2025-12-10-vercel-integration-research.md` — Vercel integration

### Pipeline Architecture
- `thoughts/shared/research/2025-12-16-neural-observation-workflow-tracking-analysis.md` — Observation pipeline workflow tracking
- `thoughts/shared/research/2025-12-15-neural-memory-database-design-analysis.md` — Neural memory DB design
- `thoughts/shared/research/2025-12-15-webhook-actor-shape-verification.md` — Webhook actor shape verification
- `thoughts/shared/research/2025-12-16-github-id-source-of-truth-audit.md` — GitHub ID audit

---

## Open Questions

1. **Transformer reuse strategy**: Should backfill create adapter layers to wrap API responses into webhook shapes (preserving existing transformers), or create new backfill-specific transformer functions that accept API response shapes directly?

2. **ingestionSource tracking**: The `workspace_neural_observations` table has no `ingestionSource` column. Should one be added, or should the distinction be tracked only in Inngest job metadata?

3. **Backfill state in sourceConfig**: Where should backfill progress be tracked? Options: (a) new fields in `sourceConfig.backfill`, (b) new `workspaceWorkflowRuns` job, (c) separate backfill status table.

4. **Linear/Sentry OAuth priority**: These require full OAuth implementation before any backfill. Should backfill architecture account for them now or focus on GitHub/Vercel?

5. **Dedup across webhook + backfill**: The current dedup uses `sourceId` which includes the action (e.g., `pr:owner/repo#123:merged`). If a webhook already captured a PR merge, will backfill produce the same `sourceId` to avoid duplicates?
