---
date: 2026-02-07
researcher: codebase-agent
topic: "Knock Email/Resend, Slack Bot, Integrations vs Connectors, Outbound Webhooks"
tags: [research, codebase, knock, resend, slack, webhooks, integrations, connectors]
status: complete
---

# Codebase Deep Dive: Notifications, Email, Webhooks Architecture

## Research Question

We need to research our Knock notification implementation to: (1) promote emails back into our architecture via Resend integration, (2) determine if Resend Audiences feature is needed, (3) finalize Slack bot install + UX for users, (4) clarify the distinction between "integrations" and "connectors" in code, and (5) design outbound webhooks from Lightfast so users can build on our webhook architecture.

## Summary

**Knock implementation is code-complete for Phase 1 in-app notifications** — the `@vendor/knock` package, frontend provider/trigger components, backend Inngest dispatch workflow, CSP config, and custom CSS theme are all built. The system listens to `observation.captured` events with significance >= 70 and triggers Knock workflows. What's missing is Knock dashboard configuration (workflow creation, channel setup) and end-to-end verification.

**Resend is already integrated in two separate places**: (1) `@vendor/email` — a standalone Resend SDK wrapper used by `packages/email` for auth code emails and early-access waitlist contacts, and (2) Resend Audiences — already configured with one audience (`early-access`, ID: `566b084b-5177-40ca-b765-bf9860dda513`). However, Resend is **not connected to Knock** — the current email sending is direct Resend SDK calls, completely independent of the notification system.

**The terminology split is real and inconsistent**: the DB table is `workspaceIntegrations` (previously called "workspace sources"), the tRPC router is `integrationRouter`, the www marketing pages say "connectors", the provider-selector UI says "provider", and the backfill system uses `BackfillConnector`. This creates genuine confusion about what to call things user-facing vs internal.

## Detailed Findings

### 1. Knock Implementation Status

#### What's Built (100% code-complete)

**`@vendor/knock` package** (`vendor/knock/`):

| File | Purpose | Key Details |
|------|---------|-------------|
| `src/index.ts:1-12` | Server-side Knock client singleton | `new Knock({ apiKey: key })`, returns `null` if env not set |
| `src/env.ts:1-16` | t3-env validation | `KNOCK_API_KEY` (server), `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY` (client) |
| `src/components/provider.tsx:1-34` | KnockProvider + KnockFeedProvider | Hardcoded `feedId: "lightfast-console-notifications"`, dark mode forced |
| `src/components/trigger.tsx:1-52` | Bell icon + popover | Suspense-wrapped, null when env not set, uses `NotificationIconButton` + `NotificationFeedPopover` |
| `src/styles.css` | 230 lines custom CSS | Full shadcn/ui dark theme with OKLCH colors |
| `package.json` | Dependencies | `@knocklabs/node@^1.20.0`, `@knocklabs/react@^0.8.11` |

**Console app integration**:

| File | Purpose |
|------|---------|
| `apps/console/src/components/notifications-provider.tsx:1-29` | Wraps app with `NotificationsProvider`, bridges Clerk `userId` → Knock |
| `apps/console/src/components/app-header.tsx:1-34` | `NotificationsTrigger` placed between workspace switcher and user dropdown |

**Backend notification dispatch** (`api/console/src/inngest/workflow/notifications/dispatch.ts:1-100`):

```
Event: apps-console/neural/observation.captured
  │
  ├─ Guard: Knock client configured? (null check, line 47)
  ├─ Guard: significanceScore >= 70? (NOTIFICATION_SIGNIFICANCE_THRESHOLD, line 53)
  ├─ Guard: clerkOrgId present? (line 63)
  │
  └─ Step: trigger-knock-workflow (line 69)
     └─ notifications.workflows.trigger("observation-captured", {
          recipients: [{ id: clerkOrgId }],    // ← Org ID as recipient, NOT individual users
          tenant: clerkOrgId,
          data: { observationId, observationType, significanceScore, topics, clusterId, workspaceId }
        })
```

- **Concurrency**: 20 per workspace (`event.data.workspaceId`)
- **Retries**: 3
- **Function ID**: `apps-console/notification.dispatch`
- **Registered** in `api/console/src/inngest/index.ts:47` and served via `createInngestRouteContext()` (line 147)

**Security** (`vendor/security/src/csp/knock.ts:1-33`):
- CSP allows `https://api.knock.app`, `wss://api.knock.app` (connectSrc), `https://cdn.knock.app` (scriptSrc)

**Environment variables** (confirmed in `turbo.json:133-134`):
- `KNOCK_API_KEY` — registered in globalEnv
- `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY` — registered in globalEnv

#### What's NOT Built / Not Verified

1. **Knock dashboard configuration** — no evidence the account has been set up with:
   - Workflow key `observation-captured` matching `OBSERVATION_WORKFLOW_KEY`
   - In-app feed channel matching `"lightfast-console-notifications"` feed ID
   - Email channel (Resend) configuration
   - Slack channel (SlackKit) configuration

2. **Feed channel ID is hardcoded** (`provider.tsx:12`): `"lightfast-console-notifications"` — not configurable via env var

3. **Recipients are org-level, not user-level** (`dispatch.ts:73`): Sends to `clerkOrgId` as a single recipient, not to individual org members. This means Knock needs to be configured to expand org → members.

4. **No user token signing** — the KnockProvider in `notifications-provider.tsx:25` passes `userId={user.id}` without a signed `userToken`. In production, Knock requires HMAC-signed user tokens for security.

5. **End-to-end verification** never completed.

---

### 2. Email/Resend Status

**Two separate Resend implementations exist:**

#### A. `@vendor/email` (SDK Wrapper)

| File | Purpose |
|------|---------|
| `vendor/email/src/index.ts:1-5` | `createEmailClient(apiKey)` → returns `new Resend(apiKey)` |
| `vendor/email/src/env.ts:1-12` | Validates `RESEND_API_KEY` (must start with `re_`) |
| `vendor/email/src/types.ts:1-4` | Re-exports `CreateContactOptions`, `CreateEmailOptions`, etc. |
| `vendor/email/package.json` | Dependency: `resend@^4.3.0` |

**Consumers**: Only `apps/www` uses `@vendor/email` (via its env.ts extending emailEnv at `apps/www/src/env.ts:6`).

#### B. `packages/email` (Email Functions + Templates)

| File | Purpose |
|------|---------|
| `packages/email/src/constants.ts:1-8` | **Resend Audiences mapping**: `"early-access" → "566b084b-5177-40ca-b765-bf9860dda513"` |
| `packages/email/src/functions/all.ts:1-258` | Full Resend implementation with error handling (rate limit, quota, validation, auth, security errors) |
| `packages/email/src/templates/code-email.tsx:1-62` | React Email template for sign-in codes (uses `@react-email/components`) |

**Key functions in `packages/email/src/functions/all.ts`**:
- `sendResendEmailSafe()` (line 206) — Sends email via Resend with ResultAsync error handling
- `addToWaitlistContactsSafe()` (line 236) — Adds contact to Resend Audience `early-access`
- `addToWaitlistContactsUnsafe()` (line 161) — Direct audience contact creation
- `mail` singleton (line 16) — `createEmailClient(env.RESEND_API_KEY)`

**Environment variables** (confirmed in `turbo.json:129-130`):
- `RESEND_API_KEY` — registered in globalEnv
- `RESEND_EARLY_ACCESS_AUDIENCE_ID` — registered in globalEnv, used in `apps/www/src/env.ts:40`

#### C. Early Access Flow (Where Resend is Actually Used)

The early-access signup (`apps/www/src/components/early-access-actions.ts`) does NOT use Resend directly — it uses **Clerk's Waitlist API** (`api.clerk.com/v1/waitlist_entries`). Resend Audiences is available but the current waitlist flow bypasses it in favor of Clerk.

However, the `addToWaitlistContactsSafe()` function exists in `packages/email` for adding contacts to the `early-access` Resend Audience. This appears to be either (a) planned but not yet wired up, or (b) used elsewhere not visible in this search.

#### D. What's Missing for Knock + Resend Integration

- Knock dashboard has no Resend channel configured (this is a dashboard-only setup, no code needed)
- No transactional email templates exist in Knock (templates would be Liquid, not React Email)
- The existing React Email templates in `packages/email` would need Liquid equivalents for Knock
- No email preference management UI exists in the console

---

### 3. Webhook Infrastructure (Inbound)

#### Current Inbound Webhook Handlers

**GitHub** (`apps/console/src/app/(github)/api/github/webhooks/route.ts`):
- Handles: `push`, `pull_request`, `issues`, `release`, `discussion`, `installation`, `installation_repositories`, `repository`
- All significant events emit `apps-console/neural/observation.capture` to Inngest
- Push events also emit `apps-console/github.push` for sync routing
- Signature verification via `verifyGitHubWebhookFromHeaders()` (HMAC SHA-256)
- Raw payloads stored via `storeWebhookPayload()` for permanent retention

**Vercel** (`apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`):
- Handles: `deployment.created`, `deployment.ready`, `deployment.error`, etc.
- Emits `apps-console/neural/observation.capture` with `transformVercelDeployment()`
- Signature verification via `verifyVercelWebhook()`
- Raw payloads stored for permanent retention

#### Webhook Transformer Package (`packages/console-webhooks/`)

Complete transformer system with source-specific modules:

| File | Transformers |
|------|-------------|
| `src/transformers/github.ts` | `transformGitHubPush`, `transformGitHubPullRequest`, `transformGitHubIssue`, `transformGitHubRelease`, `transformGitHubDiscussion` |
| `src/transformers/vercel.ts` | `transformVercelDeployment` |
| `src/transformers/linear.ts` | Linear event transformers (transformer ready, not yet connected) |
| `src/transformers/sentry.ts` | Sentry event transformers (transformer ready, not yet connected) |

Supporting infrastructure:
- `src/common.ts` — `computeHmacSignature()`, `safeCompareSignatures()` (timing-attack resistant)
- `src/validation.ts` — Webhook validation utilities
- `src/sanitize.ts` — Payload sanitization
- `src/event-mapping.ts` — Event mapping utilities
- `src/storage.ts` — `storeWebhookPayload()`, `extractWebhookHeaders()`
- `src/github.ts`, `src/vercel.ts`, `src/linear.ts`, `src/sentry.ts` — Source-specific verification

#### Webhook Payload Storage (`db/console/src/schema/tables/workspace-webhook-payloads.ts`)

Table `lightfast_workspace_webhook_payloads` (exported as `workspaceIngestionPayloads`):
- `id` (BIGINT auto-increment)
- `workspaceId` (FK → orgWorkspaces)
- `deliveryId` (unique from source)
- `source` ("github" | "vercel" | "linear" | "sentry")
- `eventType` (e.g., "push", "deployment.created")
- `payload` (JSONB — raw, unmodified)
- `headers` (JSONB — debugging context)
- `receivedAt` (timestamp)
- `ingestionSource` ("webhook" | "backfill" | "manual" | "api")

#### No Outbound Webhooks Exist

There is **zero outbound webhook infrastructure** — no webhook registration table, no webhook delivery system, no retry/signing mechanism. All webhooks in the codebase are **inbound** (receiving from GitHub/Vercel).

---

### 4. Integrations vs Connectors in Code

This is the most inconsistent area of the codebase. Here's the complete terminology map:

#### Database Layer

| Actual Name | File | Usage |
|-------------|------|-------|
| `workspaceIntegrations` | `db/console/src/schema/tables/workspace-integrations.ts:22` | DB table `lightfast_workspace_integrations` — stores connected repos/projects per workspace |
| `userSources` | `db/console/src/schema/tables/user-sources.ts:20` | DB table `lightfast_user_sources` — stores OAuth credentials per user |
| `WorkspaceIntegration` type | `workspace-integrations.ts:158` | Type export |
| `UserSource` type | `user-sources.ts:88` | Type export |

#### Validation Layer

| Name | File | Values |
|------|------|--------|
| `sourceTypeSchema` | `packages/console-validation/src/schemas/sources.ts:23-28` | `["github", "vercel", "linear", "sentry"]` |
| `SourceType` type | Same file, line 30 | String enum union |

#### tRPC Router Layer

| Router | File | Description |
|--------|------|-------------|
| `integrationRouter` | `api/console/src/router/org/integration.ts:94-96` | **Empty** — `{ github: {} }` — all logic moved to userSources router |
| `sourcesRouter` | `api/console/src/router/org/sources.ts` | Org-scoped source operations |
| `userSourcesRouter` | `api/console/src/router/user/user-sources.ts` | User OAuth + repository listing |
| `backfillRouter` | `api/console/src/router/org/backfill.ts` | Backfill operations (uses `workspaceIntegrations` table) |
| `workspaceRouter` | `api/console/src/router/org/workspace.ts` | Workspace CRUD + disconnect integrations |

The root router (`api/console/src/root.ts:25`) imports `integrationRouter` but it's essentially a no-op.

#### Backfill Layer

| Name | File | Usage |
|------|------|-------|
| `BackfillConnector` | `packages/console-backfill/src/types.ts:37` | **Interface** with `provider: SourceType`, `fetchPage()`, `validateScopes()` |
| `GitHubBackfillConnector` | `packages/console-backfill/src/connectors/github.ts:28` | Implements `BackfillConnector` |
| `registerConnector()` | `packages/console-backfill/src/registry.ts:6` | Registry pattern using `Map<SourceType, BackfillConnector>` |
| `getConnector()` | Same file, line 10 | Lookup by SourceType |
| `hasConnector()` | Same file, line 14 | Existence check |

#### Frontend Layer

| Component | File | Terminology Used |
|-----------|------|------------------|
| `ProviderSelector` | `apps/console/.../provider-selector.tsx` | Uses "Provider" for available, "Coming Soon" for unavailable |
| `ConnectInitializer` | `apps/console/.../connect-initializer.tsx` | Uses "Connect Account" (section 2), imports `GitHubConnector`, `VercelConnector` |
| `GitHubConnector` | Imported in connect-initializer | Component name uses "Connector" |
| `VercelConnector` | Imported in connect-initializer | Component name uses "Connector" |
| `LatestIntegrations` | `apps/console/.../sources/_components/latest-integrations.tsx` | Sidebar heading says "Latest Integrations" |

#### Marketing Layer (www)

| Page | File | Terminology |
|------|------|-------------|
| Features/Connectors page | `apps/www/src/app/(app)/(marketing)/features/connectors/page.tsx` | **"Connectors"** throughout — title, URL, FAQ uses "connector" exclusively |
| Integration Showcase | `apps/www/src/components/integration-showcase.tsx` | Shows integration icons including Slack |
| FAQ Section | `apps/www/src/components/faq-section.tsx` | Mentions Slack |
| Nav config | `apps/www/src/config/nav.ts` | Has "connectors" in navigation |

#### Summary of Inconsistency

| Context | Term Used |
|---------|-----------|
| DB tables | `workspaceIntegrations`, `userSources` |
| tRPC routers | `integrationRouter`, `sourcesRouter`, `userSourcesRouter` |
| Validation | `SourceType`, `sourceTypeSchema` |
| Backfill | `BackfillConnector`, `registerConnector()` |
| UI components | `GitHubConnector`, `VercelConnector`, `ProviderSelector` |
| UI sidebar | "Latest Integrations" |
| Marketing/www | "Connectors" (page title, URL, FAQ) |
| Inngest events | `source.connected.github`, `source.disconnected` |
| Activity tracking | `category: "integration"` |

**The clear pattern**: Marketing/user-facing = "connector", Backend/DB = "integration", Backfill = "connector", Validation = "source".

---

### 5. Slack-Related Code

#### What Exists

**UI only — no functional Slack code**:

| Component | File | Status |
|-----------|------|--------|
| Slack icon SVG | `packages/ui/src/components/integration-icons.tsx` | Icon component exists |
| Provider selector | `provider-selector.tsx:34-47` | Slack listed in `comingSoon` array with `id: "coming_soon"` |
| Latest integrations sidebar | `latest-integrations.tsx:26-28` | Slack listed with description "Intelligent thread understanding and automated context sharing" |
| Features/connectors page | `apps/www/.../connectors/page.tsx:67-72` | Slack listed as "Coming soon" |
| FAQ section | `apps/www/src/components/faq-section.tsx` | Mentions Slack |
| Integration showcase | `apps/www/src/components/integration-showcase.tsx` | Shows Slack icon |
| Early access form | `apps/www/src/components/early-access-form.tsx:39` | Slack as data source option |

#### What Does NOT Exist

- No `/api/slack/` route group
- No Slack OAuth routes
- No Slack webhook receiver
- No `@slack/bolt` or `@slack/web-api` dependency in any `package.json`
- No `SLACK_*` environment variables
- No `slack` value in `sourceTypeSchema` (only `github`, `vercel`, `linear`, `sentry`)
- No SlackKit components (`SlackAuthButton`, `SlackChannelCombobox`)
- No Slack bot token storage
- No Slack channel selection UI

---

### 6. Inngest Event Catalog (Outbound Webhook Candidates)

Complete catalog of all Inngest events defined in `api/console/src/inngest/client/client.ts`:

#### Orchestration Events

| Event Name | Payload Shape | Consumer |
|------------|--------------|---------|
| `apps-console/sync.requested` | `{ workspaceId, workspaceKey, sourceId, sourceType, syncMode, trigger, syncParams }` | `syncOrchestrator` |
| `apps-console/sync.completed` | `{ sourceId, jobId, success, filesProcessed, filesFailed, embeddingsCreated, syncMode }` | — (completion signal) |

#### Batch Processing Events

| Event Name | Payload Shape | Consumer |
|------------|--------------|---------|
| `apps-console/files.batch.process` | `{ batchId, workspaceId, sourceId, files[], githubInstallationId, repoFullName, commitSha }` | `filesBatchProcessor` |
| `apps-console/files.batch.completed` | `{ batchId, success, processed, failed, durationMs }` | — (completion signal) |

#### Source-Specific Events

| Event Name | Payload Shape | Consumer |
|------------|--------------|---------|
| `apps-console/github.sync.trigger` | `{ jobId, workspaceId, workspaceKey, sourceId, sourceConfig, syncMode }` | `githubSyncOrchestrator` |
| `apps-console/github.sync.completed` | `{ jobId, sourceId, success, filesProcessed, filesFailed }` | — (completion signal) |
| `apps-console/source.connected.github` | `{ workspaceId, workspaceKey, sourceId, sourceType, sourceMetadata, trigger }` | Triggers full sync |
| `apps-console/source.disconnected` | `{ sourceId, deleteData }` | Cleanup |
| `apps-console/source.sync.github` | `{ workspaceId, workspaceKey, sourceId, sourceType, syncMode, trigger, syncParams }` | GitHub sync |
| `apps-console/github.push` | `{ workspaceId, workspaceKey, sourceId, repoFullName, githubRepoId, githubInstallationId, beforeSha, afterSha, commitMessage, branch, deliveryId, headCommitTimestamp, changedFiles[] }` | `githubPushHandler` |
| `apps-console/github.config-changed` | `{ workspaceId, sourceId, repoFullName, configPath, commitSha }` | Config re-sync |

#### Neural Memory Events

| Event Name | Payload Shape | Consumer | **Outbound Webhook Candidate?** |
|------------|--------------|---------|-------------------------------|
| `apps-console/neural/observation.capture` | `{ workspaceId, clerkOrgId, sourceEvent, ingestionSource }` | `observationCapture` | Yes — raw event ingested |
| `apps-console/neural/observation.captured` | `{ workspaceId, clerkOrgId, observationId, sourceId, observationType, significanceScore, topics, entitiesExtracted, clusterId, clusterIsNew }` | `notificationDispatch` | **Yes — primary candidate** |
| `apps-console/neural/profile.update` | `{ workspaceId, clerkOrgId, actorId, observationId, sourceActor }` | `profileUpdate` | Maybe |
| `apps-console/neural/cluster.check-summary` | `{ workspaceId, clerkOrgId, clusterId, observationCount }` | `clusterSummaryCheck` | Maybe |
| `apps-console/neural/llm-entity-extraction.requested` | `{ workspaceId, clerkOrgId, observationId }` | `llmEntityExtractionWorkflow` | No (internal) |

#### Infrastructure Events

| Event Name | Payload Shape | Consumer |
|------------|--------------|---------|
| `apps-console/store.ensure` | `{ workspaceId, workspaceKey?, embeddingDim?, githubRepoId?, repoFullName? }` | — (provisioning) |
| `apps-console/activity.record` | `{ workspaceId, actorType, actorUserId, actorEmail, category, action, entityType, entityId, metadata, timestamp }` | `recordActivity` |

#### Document Events

| Event Name | Consumer |
|------------|---------|
| `apps-console/docs.file.process` | `processDocuments` |
| `apps-console/docs.file.delete` | `deleteDocuments` |
| `apps-console/documents.process` | Generic processor |
| `apps-console/documents.delete` | Generic deleter |
| `apps-console/relationships.extract` | Relationship extraction |
| `apps-console/documents.batch-completed` | Batch tracking |
| `apps-console/github.sync-completed` | Sync completion |

#### Backfill Events

| Event Name | Payload Shape | Consumer |
|------------|--------------|---------|
| `apps-console/backfill.requested` | `{ integrationId, workspaceId, clerkOrgId, provider, userSourceId, depth, entityTypes, requestedBy }` | `backfillOrchestrator` |
| `apps-console/backfill.completed` | `{ integrationId, workspaceId, provider, success, eventsProduced, eventsDispatched, errorCount, durationMs }` | — (completion signal) |
| `apps-console/backfill.cancelled` | `{ integrationId, cancelledBy }` | Cancel via `cancelOn` |

#### Notification Events

| Event Name | Payload Shape | Consumer |
|------------|--------------|---------|
| `apps-console/notification.dispatch` | `{ workspaceId, clerkOrgId, workflowKey, recipients, tenant, payload }` | — (generic dispatch, not yet consumed) |

**Note**: The `notification.dispatch` event exists in the schema but the actual `notificationDispatch` function listens to `observation.captured` directly, not this event. This suggests a planned but unused generic notification dispatch pathway.

#### Best Outbound Webhook Candidates

1. **`observation.captured`** — Primary candidate. Every significant engineering event that passes the neural pipeline. Includes significance score, topics, cluster, entity count.
2. **`sync.completed`** — Source sync finished with metrics.
3. **`backfill.completed`** — Backfill operation finished with stats.
4. **`source.connected.github`** / **`source.disconnected`** — Source lifecycle events.

---

### 7. Outbound Webhook Patterns (Existing)

**None exist.** The codebase has zero outbound webhook infrastructure. All webhook code is inbound (receiving from GitHub/Vercel).

To build outbound webhooks, you would need:
1. **DB table**: `workspace_webhook_endpoints` (URL, secret, event subscriptions, active/paused)
2. **Delivery system**: Queue + retry (Inngest function or Upstash workflow)
3. **Signing**: HMAC SHA-256 signing (reuse `computeHmacSignature()` from `@repo/console-webhooks/common`)
4. **Event fan-out**: Subscribe to Inngest events and fan out to registered endpoints
5. **Delivery log**: Track attempts, status codes, retry count
6. **UI**: Webhook endpoint management in workspace settings

The existing `@repo/console-webhooks` package provides useful primitives:
- `computeHmacSignature()` — Can be reused for signing outbound payloads
- `safeCompareSignatures()` — For webhook verification
- Timestamp validation patterns

---

## Code References

### Knock Vendor Package
- `vendor/knock/src/index.ts:1-12` — Server-side Knock client singleton
- `vendor/knock/src/env.ts:1-16` — Environment variable validation (KNOCK_API_KEY, NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY)
- `vendor/knock/src/components/provider.tsx:1-34` — KnockProvider + KnockFeedProvider wrapper (hardcoded feedId: "lightfast-console-notifications")
- `vendor/knock/src/components/trigger.tsx:1-52` — Bell icon + popover (Suspense-wrapped, null when env not set)
- `vendor/knock/package.json` — @knocklabs/node@^1.20.0, @knocklabs/react@^0.8.11

### Console App Knock Integration
- `apps/console/src/components/notifications-provider.tsx:1-29` — Clerk userId → Knock provider bridge
- `apps/console/src/components/app-header.tsx:1-34` — NotificationsTrigger in header (line 29)

### Backend Notification Dispatch
- `api/console/src/inngest/workflow/notifications/dispatch.ts:1-100` — Inngest → Knock bridge
- `api/console/src/inngest/workflow/notifications/index.ts:1` — Re-export
- `api/console/src/inngest/index.ts:47,147` — Registration in serve()

### Inngest Event Catalog
- `api/console/src/inngest/client/client.ts:24-841` — Complete event schema definitions (all events)

### Email / Resend
- `vendor/email/src/index.ts:1-5` — Resend client factory
- `vendor/email/src/env.ts:1-12` — RESEND_API_KEY validation
- `packages/email/src/constants.ts:1-8` — Resend Audiences mapping (early-access)
- `packages/email/src/functions/all.ts:1-258` — Full Resend send/contact functions with error handling
- `packages/email/src/templates/code-email.tsx:1-62` — React Email sign-in code template

### Webhook Infrastructure (Inbound)
- `apps/console/src/app/(github)/api/github/webhooks/route.ts` — GitHub webhook handler (push, PR, issues, release, discussion)
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` — Vercel webhook handler (deployments)
- `packages/console-webhooks/src/` — Transformer package (github, vercel, linear, sentry)
- `packages/console-webhooks/src/storage.ts` — storeWebhookPayload()
- `db/console/src/schema/tables/workspace-webhook-payloads.ts:27-120` — Raw payload storage table

### Integrations/Connectors DB + Router
- `db/console/src/schema/tables/workspace-integrations.ts:22-159` — workspaceIntegrations table (connected sources)
- `db/console/src/schema/tables/user-sources.ts:20-94` — userSources table (OAuth credentials)
- `api/console/src/router/org/integration.ts:94-96` — Empty integrationRouter
- `api/console/src/router/org/backfill.ts:40-80` — Backfill router (uses workspaceIntegrations)
- `api/console/src/router/org/workspace.ts:1-80` — Workspace router (imports workspaceIntegrations)

### Backfill Connector System
- `packages/console-backfill/src/types.ts:37-51` — BackfillConnector interface
- `packages/console-backfill/src/registry.ts:1-17` — Connector registry (Map-based)
- `packages/console-backfill/src/connectors/github.ts:1-217` — GitHub backfill connector
- `packages/console-backfill/src/index.ts:1-7` — Auto-registration on import

### UI Components
- `apps/console/.../sources/connect/_components/provider-selector.tsx:1-115` — Provider selection (GitHub, Vercel available; Linear, Slack, Notion coming soon)
- `apps/console/.../sources/connect/_components/connect-initializer.tsx:1-99` — Connect flow (GitHubConnector, VercelConnector)
- `apps/console/.../sources/_components/latest-integrations.tsx:1-81` — Sidebar showing "Latest Integrations" (Vercel, PostHog, Slack, PlanetScale)

### Marketing Pages
- `apps/www/src/app/(app)/(marketing)/features/connectors/page.tsx:1-302` — Connectors feature page (GitHub, Linear, Notion, Slack)

### Security
- `vendor/security/src/csp/knock.ts:1-33` — CSP directives for Knock API + WebSocket

## Integration Points

### Knock → Resend (Not Connected)
Knock supports Resend as an email channel provider, but this connection only exists in the Knock dashboard (no code needed). Currently:
- Knock handles in-app notifications
- Resend handles transactional emails (sign-in codes) independently
- There is no shared notification routing

### Knock → Slack (Not Connected)
Knock supports SlackKit for managed Slack OAuth. This requires:
- Slack App creation
- Knock dashboard configuration
- UI components (`SlackAuthButton`, `SlackChannelCombobox`)
- None of this exists in code

### Inngest → Outbound Webhooks (Not Connected)
The Inngest event system is the natural hook point for outbound webhooks. The `observation.captured` event already triggers notifications — it could also trigger outbound webhook delivery.

### Resend Audiences → Notification Preferences (Not Connected)
Resend Audiences could serve as the user mailing list for notification digest emails, but currently only `early-access` audience exists and it's not used for notifications.

## Gaps Identified

### Critical Gaps

1. **Knock dashboard not configured** — Everything code-side is built, but the Knock account/workflow/channels haven't been set up. This blocks all notification delivery.

2. **No user token signing for Knock** — Production security requires HMAC-signed user tokens. The current implementation passes raw `userId` to KnockProvider.

3. **Recipients are org-level** — `dispatch.ts:73` sends to `clerkOrgId` not individual users. Knock needs to be configured for org → member expansion.

4. **No Slack code at all** — Despite extensive research, zero Slack implementation exists.

5. **No outbound webhook infrastructure** — No tables, no delivery system, no UI.

### Moderate Gaps

6. **Email not connected to notification system** — Resend and Knock operate independently. To send notification emails, need Resend channel in Knock dashboard.

7. **Terminology inconsistency** — "integration" vs "connector" vs "source" vs "provider" used interchangeably across layers.

8. **Feed channel ID hardcoded** — `"lightfast-console-notifications"` in `provider.tsx:12` should be env-configurable.

9. **Empty integration router** — `integrationRouter` at `api/console/src/router/org/integration.ts:94-96` is an empty stub that could be cleaned up or repurposed.

10. **Generic notification.dispatch event unused** — Event `apps-console/notification.dispatch` is defined in the Inngest schema but no function consumes it. The actual dispatch listens directly to `observation.captured`.

### Nice-to-Have Gaps

11. **No notification preference UI** — Users can't configure which notifications they receive or through which channels.

12. **No webhook delivery log** — When outbound webhooks are built, need delivery tracking.

13. **Resend Audiences underutilized** — Only one audience exists (`early-access`). Could add `notification-digest`, `product-updates`, etc.

14. **Linear and Sentry transformers ready but not connected** — Webhook handlers exist in `console-webhooks` package but no route handlers in the console app.
