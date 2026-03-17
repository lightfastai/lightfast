---
date: 2026-03-17T09:00:40Z
researcher: claude
git_commit: 2cebd819fc9ca00e174fbdca08c116c8bbe46c35
branch: main
repository: lightfast
topic: "Connection lifecycle: webhook handling, state design, and infrastructure redesign"
tags: [architecture, relay, gateway, backfill, connection-lifecycle, webhooks, state-machine, platform]
status: complete
last_updated: 2026-03-17
---

# Connection Lifecycle: Webhook Handling, State Design, and Infrastructure Redesign

## Context

Two GitHub `installation` webhooks with `action: "deleted"` were observed passing through
`apps/relay` and routing to DLQ. This document captures the investigation, the full scope of
what is unhandled, and the proposed architecture to resolve it end-to-end.

---

## 1. Current Architecture (as-is)

### 1.1 Services

Three edge services (Hono + srvx) coordinate to process provider events:

```
apps/relay   (port 4108)  Inbound webhook ingestion — HMAC verify, dedup, route
apps/gateway (port 4110)  Connection lifecycle — OAuth, token vault, teardown
apps/backfill(port 4109)  Historical data — Inngest orchestrator + entity workers
apps/console (port 4107)  Next.js — user UI, tRPC, Inngest endpoint, QStash ingest
```

All three edge services share identical deps: `@db/console`, `@repo/console-providers`,
`@vendor/upstash`, `@vendor/upstash-workflow`, `@vendor/qstash`, `@vendor/observability`.

### 1.2 Standard webhook path (external provider → stored entity)

```
1. Provider → POST /api/webhooks/:provider (relay)
   verify HMAC → dedup (Redis NX) → persist gatewayWebhookDeliveries

2. relay → Upstash Workflow: webhook-delivery
   step 1  dedup (Redis NX)
   step 2  persist delivery  status: "received"
   step 3  resolve-connection
           Redis gw:resource:{provider}:{resourceId} → hit: {connectionId, orgId}
           DB fallback: gatewayResources JOIN gatewayInstallations
                        WHERE providerResourceId = resourceId AND status = "active"
   step 4  route
           connection found → QStash → console /api/gateway/ingress  (retries: 5)
           no connection    → webhook-dlq QStash topic
   step 5  QStash publish
   step 6  UPDATE delivery status = "enqueued"

3. QStash → console POST /api/gateway/ingress (Upstash Workflow)
   step 1  resolve-workspace (orgId → orgWorkspaces)
   step 2  transformEnvelope → PROVIDERS[provider].events[eventType].transform()
           returns null if no transformer → logged, skipped
   step 3  INSERT workspaceIngestLogs
   step 4  fan-out: Inngest apps-console/event.capture + Upstash Realtime

4. Inngest pipeline
   event.capture → event-store → entity.upserted
   entity.upserted → entity-graph → entity.graphed
   entity.graphed → entity-embed
   event.stored → notification-dispatch
```

### 1.3 Backfill path (historical data)

```
1. tRPC workspace.integrations.bulkLinkResources (on first resource link)
   → notifyBackfill() → POST backfill/trigger → inngest.send("apps-backfill/run.requested")

2. backfill-orchestrator (Inngest)
   verify connection active (gateway GET /connections/:id)
   compute work units: resource × entityType, gap-filtered
   step.invoke backfill-entity-worker per unit (parallel, 4h timeout)

3. backfill-entity-worker (Inngest)
   per page:
     fetch: gateway POST /connections/:id/proxy/execute → provider API
     dispatch: POST relay/api/webhooks/:provider (X-API-Key, pre-resolved connectionId+orgId)
               optionally X-Backfill-Hold: true (holdForReplay mode)

4. relay service-auth path (same endpoint, X-API-Key)
   dedup → persist → QStash → console ingress (same path as live events)

5. After all workers: orchestrator drains held deliveries via relay POST /admin/replay/catchup
```

### 1.4 Connection teardown path (current)

Triggered by `DELETE /connections/:provider/:id` (gateway HTTP) or
`connections.disconnect` tRPC (console, direct DB write — different path).

```
connectionTeardownWorkflow (Upstash Workflow in apps/gateway):
  step 1  cancel-backfill: QStash → backfill /trigger/cancel  (dedup: "backfill-cancel:{id}")
  step 2  revoke-token: decrypt + providerDef.oauth.revokeToken() (skip: GitHub)
  step 3  cleanup-cache: Redis DEL gw:resource:{provider}:{resourceId} for all active resources
  step 4  soft-delete:
            UPDATE gatewayInstallations SET status = "revoked"
            UPDATE gatewayResources SET status = "removed" WHERE installationId
```

### 1.5 Database state fields

| Table | Column | Values |
|---|---|---|
| `gatewayInstallations` | `status` varchar | `active \| pending* \| error \| revoked` |
| `gatewayResources` | `status` varchar | `active \| removed` |
| `workspaceIntegrations` | `isActive` boolean | `true \| false` |
| `workspaceIntegrations` | `lastSyncStatus` varchar | `success \| failed \| pending` |
| `gatewayWebhookDeliveries` | `status` varchar | `received \| enqueued \| delivered \| dlq` |
| `gatewayBackfillRuns` | `status` varchar | `idle \| pending \| running \| completed \| failed \| cancelled` |

`* pending` defined in schema comment, never written by any production code path.

### 1.6 Redis key space

| Key | Purpose | TTL |
|---|---|---|
| `gw:webhook:seen:{provider}:{deliveryId}` | Dedup | 86400s |
| `gw:resource:{provider}:{resourceId}` | Routing cache `{connectionId, orgId}` | none |
| `gw:oauth:state:{token}` | OAuth PKCE state | 600s |
| `gw:oauth:result:{state}` | OAuth result poll | 300s |

---

## 2. Problems

### 2.1 Installation-level webhooks route to DLQ

The relay's `resolve-connection` step queries `gatewayResources.providerResourceId` (repo IDs).
For `installation` events, `extractResourceId` returns `String(installation.id)` — an installation
ID, not a repo ID. No match is ever found. Every `installation.*` event goes to DLQ.

The same applies to `installation_repositories.*` (no top-level `repository`), and to `repository`
events (no registered transformer in the console ingress — `dispatch.ts` returns null).

### 2.2 The teardown workflow never touches workspaceIntegrations

`connectionTeardownWorkflow` step 4 updates `gatewayInstallations.status = "revoked"` and
`gatewayResources.status = "removed"`. It does not touch `workspaceIntegrations`.

The M2M tRPC procedures that DO update `workspaceIntegrations` (`markGithubInstallationInactive`,
`markGithubRepoInactive`, `markGithubDeleted`) are never called from the webhook pipeline.

When a user uninstalls the GitHub App, their workspace sources remain `isActive: true` indefinitely.

### 2.3 connections.disconnect tRPC is incomplete

`api/console/src/router/org/connections.ts:127` writes `gatewayInstallations.status = "revoked"`
directly — it does NOT call the teardown workflow. As a result:
- `gatewayResources` remains `active`
- Redis routing cache `gw:resource:*` remains (stale, routes webhooks until TTL)
- `workspaceIntegrations.isActive` remains `true`

### 2.4 isActive boolean cannot express why a source is inactive

`isActive: false` conflates five distinct states:

| Cause | Should show user |
|---|---|
| User disconnected in Lightfast | "You disconnected this — re-link to restore" |
| Provider deleted the installation | "GitHub App was uninstalled — reconnect GitHub" |
| Provider suspended the installation | "GitHub App suspended — check GitHub settings" |
| Repo removed from installation | "Removed from GitHub App — re-add repo" |
| Repo hard-deleted on GitHub | "Repository was deleted on GitHub" |

`lastSyncError` carries this context today but is never read in any tRPC query response or
rendered in any UI component. The column is write-only.

### 2.5 The race condition

When teardown starts while new events are in flight:

```
t=0    installation.deleted → relay → QStash → gateway → teardown workflow starts

t=50   New PR webhook arrives at relay
       resolve-connection: Redis hit (teardown step 3 hasn't run yet)
       → routes to console ingress via QStash

t=200  teardown step 3: Redis DEL  ← new events now DLQ from this point
t=300  teardown step 4: DB soft-delete

t=450  console ingress receives the PR event (was already in QStash queue)
       workspaceIntegrations.isActive still true (teardown never touches it)
       → event processed, stored — after the installation is gone
```

The cross-service design is the root cause: routing state (Redis, managed by relay) and
lifecycle state (DB status, managed by gateway) live in separate services coordinated
asynchronously via QStash. The window between them is exploitable.

---

## 3. Complete Scenario Matrix

### GitHub

| # | Trigger | Who | Webhook | Current | Should |
|---|---|---|---|---|---|
| G-1 | First GitHub App install | User | `installation.created` (OAuth flow) | ✅ `gatewayInstallations` upserted `active` | — |
| G-2 | Add repo as workspace source | User | none (tRPC) | ✅ `gatewayResources` `active`, `workspaceIntegrations` created | — |
| G-3 | Disconnect specific source in Lightfast | User | none (tRPC) | ✅ `gatewayResources` `removed`, Redis DEL, `isActive: false` | — |
| G-4 | Disconnect entire GitHub in Lightfast Settings | User | none (tRPC) | ⚠️ `gatewayInstallations` `revoked` only (no teardown workflow, Redis stale, WI untouched) | Full teardown workflow |
| G-5 | GitHub App uninstalled on GitHub | User/Provider | `installation.deleted` | ❌ DLQ | Lifecycle workflow: `revoked` |
| G-6 | GitHub App suspended by GitHub | Provider | `installation.suspend` | ❌ DLQ | Lifecycle workflow: `suspended` (keep token) |
| G-7 | GitHub App unsuspended | Provider | `installation.unsuspend` | ❌ DLQ | Restore workflow: back to `active` |
| G-8 | Repos added to installation on GitHub | User | `installation_repositories.added` | ❌ DLQ | Upsert `gatewayResources` (make discoverable, don't auto-add to WI) |
| G-9 | Repos removed from installation on GitHub | User | `installation_repositories.removed` | ❌ DLQ | Partial lifecycle: `removed` per repo |
| G-10 | Repository deleted on GitHub | User | `repository.deleted` | ❌ transformer returns null | Partial lifecycle: `deleted` per repo |
| G-11 | Repository renamed on GitHub | User | `repository.renamed` | ❌ transformer returns null | Update `gatewayResources.resourceName` |
| G-12 | GitHub App reinstalled (same ID) | User | `installation.created` | ✅ OAuth callback upserts `active` | — |
| G-13 | OAuth token refresh | System | none | ✅ `gatewayTokens` updated | — |
| G-14 | OAuth 401, refresh fails | System | none | ⚠️ `error` only on `listResources` path | `error` on all proxy 401s |

### Vercel

| # | Trigger | Who | Webhook | Current | Should |
|---|---|---|---|---|---|
| V-1 | First Vercel connection | User | OAuth | ✅ | — |
| V-2 | Link Vercel project to workspace | User | none | ✅ | — |
| V-3 | Unlink Vercel project in Lightfast | User | none | ✅ `isActive: false` | → `disconnected` status |
| V-4 | Disconnect Vercel entirely in Lightfast | User | none | ⚠️ Same gap as G-4 | Full teardown workflow |
| V-5 | Vercel integration removed on Vercel | Provider | `integration-configuration.removed` | ❌ DLQ | Lifecycle workflow: `revoked` |
| V-6 | Vercel project deleted | Provider | `project.removed` | ❌ transformer returns null | Partial lifecycle: `deleted` |

### Linear

| # | Trigger | Who | Webhook | Current | Should |
|---|---|---|---|---|---|
| L-1 | Connect Linear | User | OAuth | ✅ | — |
| L-2 | Link Linear team/project | User | none | ✅ | — |
| L-3 | Disconnect Linear in Lightfast | User | none | ✅ `isActive: false` | → `disconnected` status |
| L-4 | Linear project deleted | Provider | `Project.deleted` | ✅ transformer exists | Ensure WI status updated |
| L-5 | OAuth token revoked on Linear | Provider | none (no webhook) | ⚠️ 401 → `error` only on `listResources` | Passive detection on any 401 |

### Sentry

| # | Trigger | Who | Webhook | Current | Should |
|---|---|---|---|---|---|
| S-1 | Connect Sentry | User | OAuth | ✅ | — |
| S-2 | Link Sentry org | User | none | ✅ | — |
| S-3 | Disconnect Sentry in Lightfast | User | none | ✅ `isActive: false` | → `disconnected` status |
| S-4 | Sentry app uninstalled | Provider | `installation.deleted` (sentry-hook-resource: installation) | ❌ no transformer | Lifecycle workflow: `revoked` |

**Summary**: 8 of 24 scenarios are unhandled (❌), 4 are partially handled (⚠️).

---

## 4. workspaceIntegrations: isActive → status

### Proposed status enum

```ts
type WorkspaceIntegrationStatus =
  | "active"        // syncing normally
  | "disconnected"  // user removed this source in Lightfast (can re-link)
  | "revoked"       // provider deleted/uninstalled the app (need re-OAuth)
  | "suspended"     // provider temporarily suspended the app
  | "removed"       // this repo was removed from the app (re-add to app)
  | "deleted"       // repo/project hard-deleted on provider (terminal)
  | "error"         // auth failure or persistent sync error
```

### Write site migration

| Old | New | By |
|---|---|---|
| `isActive = false` via `markGithubInstallationInactive` | `status = "revoked"` | lifecycle workflow step 3.5 |
| `isActive = false` via `markGithubRepoInactive` | `status = "removed"` | lifecycle workflow step 3.5 |
| `isActive = false` via `markGithubDeleted` | `status = "deleted"` | lifecycle workflow step 3.5 |
| `isActive = false` via `workspace.integrations.disconnect` | `status = "disconnected"` | tRPC mutation |
| `isActive = false` via `workspace.integrations.unlinkVercelProject` | `status = "disconnected"` | tRPC mutation |
| `isActive = true` (insert or reactivate) | `status = "active"` | tRPC mutation |

The M2M tRPC procedures (`markGithubInstallationInactive`, `markGithubRepoInactive`,
`markGithubDeleted`) become redundant once the lifecycle workflow handles all status writes.

### Cross-provider status triggers

| Status | GitHub | Vercel | Linear | Sentry |
|---|---|---|---|---|
| `active` | repo linked | project linked | team linked | org linked |
| `disconnected` | user removes in Lightfast | user unlinks | user disconnects | user disconnects |
| `revoked` | `installation.deleted` | `integration-configuration.removed` | OAuth revoked (passive) | `installation.deleted` |
| `suspended` | `installation.suspend` | — | — | — |
| `removed` | `installation_repositories.removed` | — | — | — |
| `deleted` | `repository.deleted` | `project.removed` | `Project.deleted` | — |
| `error` | 401 on proxy | 401 on proxy | 401 on proxy | 401 on proxy |

### UI implications

Each status has a distinct user-visible meaning, actionable message, and reactivation path:

| Status | Indicator | Message | Action available |
|---|---|---|---|
| `active` | green | — | Disconnect |
| `disconnected` | grey | "Disconnected by you" | Re-link |
| `revoked` | red | "GitHub App was uninstalled" | Reconnect GitHub |
| `suspended` | amber | "GitHub App suspended" | View on GitHub |
| `removed` | orange | "Removed from GitHub App" | Re-add repo to app |
| `deleted` | red | "Repository was deleted on GitHub" | — (terminal) |
| `error` | red | "Sync error — check connection" | Reconnect |

`lastSyncStatus` and `lastSyncError` columns are retained for sync-specific diagnostics
but no longer carry lifecycle state.

---

## 5. Race Condition Analysis

The race is between an in-flight event and a running teardown.

```
t=0    installation.deleted → relay → QStash → gateway → teardownWorkflow starts

t=50   New PR webhook arrives at relay
       resolve-connection step:
         Redis gw:resource:github:{repoId} → HIT (step 3 hasn't run yet)
         routes to console ingress via QStash

t=200  teardown step 3: Redis DEL gw:resource:github:*
       ← from this point, new webhooks for these repos → DLQ

t=300  teardown step 4: gatewayInstallations.status = "revoked"
                        gatewayResources.status = "removed"

t=450  console ingress receives the PR event
       workspaceIntegrations.isActive = true (teardown never touches it)
       → event is stored in workspaceIngestLogs despite installation being revoked
```

### Two-gate model (the fix)

The teardown workflow gains a new step between 3 and 4:

```
step 3   Redis DEL routing cache  ← RELAY GATE
         After this: new events for these repos cannot be routed

step 3.5 UPDATE workspaceIntegrations.status = targetStatus(reason)  ← INGRESS GATE
         After this: in-flight events in QStash queue are dropped at ingress

step 4   soft-delete (gatewayInstallations + gatewayResources)
```

The console ingress gains a status check:
```
step 2  CHECK workspaceIntegrations.status = "active"
        if not active → return 200 (prevent QStash retry), do not process
```

The residual window is between teardown step 3 and step 3.5 — milliseconds, during which
a handful of events may still be processed. This is acceptable. No locks needed.

---

## 6. connectionLifecycleWorkflow Redesign

Replaces `connectionTeardownWorkflow`. Handles all lifecycle reasons.

### Extended payload

```ts
type LifecyclePayload = {
  installationId: string          // gatewayInstallations.id (internal nanoid)
  orgId: string
  provider: SourceType
  reason:
    | "user_disconnect"           // user disconnects in Lightfast UI
    | "provider_revoked"          // installation.deleted
    | "provider_suspended"        // installation.suspend
    | "provider_repo_removed"     // installation_repositories.removed
    | "provider_repo_deleted"     // repository.deleted, project.removed
  resourceIds?: string[]          // providerResourceIds — partial teardown only
}
```

### Step behaviour by reason

| Step | user_disconnect | provider_revoked | provider_suspended | provider_repo_removed | provider_repo_deleted |
|---|---|---|---|---|---|
| 1 cancel-backfill | ✅ | ✅ | ✅ | ❌ skip | ❌ skip |
| 2 revoke-token | ✅ (non-GitHub) | ✅ (non-GitHub) | ❌ skip | ❌ skip | ❌ skip |
| 3 Redis DEL | all resources | all resources | all resources | scoped to resourceIds | scoped to resourceIds |
| 3.5 update WI.status | `disconnected` | `revoked` | `suspended` | `removed` | `deleted` |
| 4 soft-delete installs | `revoked` | `revoked` | `suspended` | ❌ skip | ❌ skip |
| 4 soft-delete resources | all `removed` | all `removed` | ❌ skip | scoped `removed` | scoped `removed` |

### connectionRestoreWorkflow (new — for provider_unsuspended)

```
step 1  UPDATE gatewayInstallations SET status = "active"
step 2  UPDATE workspaceIntegrations SET status = "active"
        WHERE installationId = installationId AND status = "suspended"
```

---

## 7. Infrastructure Redesign

### The relay/gateway split is the root cause

Both services share identical deps, the same Hono + srvx stack, the same DB and Redis.
The split is a deployment artifact that forces coordination via QStash and creates
the race condition window.

- relay: ~5,300 lines
- gateway: ~6,300 lines
- backfill: ~5,400 lines (2 Inngest workflow files + thin HTTP trigger wrapper)

### Proposed: 2-app model

```
apps/platform  (replaces apps/relay + apps/gateway)
apps/console   (absorbs apps/backfill Inngest functions)
@repo/connection-core  (new shared package — provider registry + state machine)
```

### apps/platform

Single edge service. All external I/O lives here.

```
POST /ingest/:provider            ← all webhooks (external HMAC + internal X-API-Key)
GET  /connect/:provider/authorize ← OAuth start
GET  /connect/:provider/callback  ← OAuth complete
POST /connect/:id/resources       ← link resource
DELETE /connect/:id               ← full disconnect
GET  /token/:id                   ← internal: get active token
POST /proxy/:id                   ← internal: proxy to provider API
GET  /connect/:id                 ← internal: get connection + resources
GET/POST /connect/:id/runs        ← internal: backfill run records
```

**ingest-delivery workflow (Upstash WF — replaces relay's webhook-delivery):**

```
step 1  dedup (Redis NX)
step 2  persist delivery
step 3  classify: connection-core.classifyEvent(provider, eventType, action)
          → "lifecycle" | "data" | "unknown"
step 4  route:
          lifecycle → resolve installation by externalId
                      trigger connectionLifecycleWorkflow (Upstash WF)
                      return "lifecycle"
          data + connection found → QStash → console /api/ingest  (retries: 5)
          data + no connection → webhook-dlq
          unknown → webhook-dlq
```

Key difference from current relay: lifecycle events are handled IN-PROCESS. No QStash hop
to a separate service. The routing decision and the lifecycle state management share the same
Redis client, the same DB connection, and the same Upstash Workflow runner.

**connectionLifecycleWorkflow (Upstash WF — replaces gateway's teardown):**
As specified in Section 6.

**New: connectionRestoreWorkflow (Upstash WF):**
For `installation.unsuspend` — reverses suspension.

**OAuth path:** Unchanged from current gateway. Same state/callback/poll pattern.

**Internal paths:** Unchanged from current gateway. Token vault, proxy, resource management.

### apps/console — absorbs backfill

The backfill service is 90% Inngest. Its HTTP surface is:
- `POST /trigger` → `inngest.send("apps-backfill/run.requested")`
- `POST /trigger/cancel` → `inngest.send("apps-backfill/run.cancelled")`

Move Inngest functions into `api/console/src/inngest/workflow/backfill/`:
- `backfill-orchestrator.ts`
- `entity-worker.ts`

The trigger surface becomes a Next.js API route or tRPC mutation.
`packages/gateway-service-clients/src/backfill.ts` continues to work — the URL changes to
the console base URL.

**Console ingest endpoint (updated):**

```
POST /api/ingest  (replaces /api/gateway/ingress)
Upstash Workflow, QStash-verified.

step 1  resolve-workspace (orgId → orgWorkspaces)
step 2  CHECK workspaceIntegrations.status = "active"  ← INGRESS GATE
        if not active: return 200, do not process
step 3  transform (connection-core provider registry)
step 4  INSERT workspaceIngestLogs
step 5  fan-out: Inngest + Upstash Realtime
```

### @repo/connection-core

New package. Both platform and console import from it.

```
packages/connection-core/src/
├── providers/
│   ├── github.ts      event classifier, OAuth config, backfill entity types
│   ├── vercel.ts
│   ├── linear.ts
│   └── sentry.ts
├── classifier.ts      classifyEvent(provider, eventType, action) → lifecycle|data|unknown
├── state-machine.ts   targetStatus(reason), validTransitions, ConnectionStatus type
├── registry.ts        PROVIDERS map — replaces current @repo/console-providers
└── index.ts
```

**classifier.ts (examples):**

```ts
// GitHub
"installation" + any            → "lifecycle"
"installation_repositories" + * → "lifecycle"
"repository" + "deleted"        → "lifecycle"
"repository" + "renamed"        → "lifecycle"
"pull_request"                  → "data"
"issues"                        → "data"
everything else                 → "unknown"

// Vercel
resolveCategory("integration-configuration.removed") = "integration-configuration" → "lifecycle"
resolveCategory("project.removed") = "project" + action "removed"                  → "lifecycle"
resolveCategory("deployment.*")                                                     → "data"

// Sentry
"installation"                  → "lifecycle"
"issue" | "error" | etc.        → "data"
```

**state-machine.ts:**

```ts
type ConnectionStatus = "active" | "disconnected" | "revoked" | "suspended"
                      | "removed" | "deleted" | "error"

type TeardownReason = "user_disconnect" | "provider_revoked" | "provider_suspended"
                   | "provider_repo_removed" | "provider_repo_deleted"

const targetStatus: Record<TeardownReason, ConnectionStatus> = {
  user_disconnect:       "disconnected",
  provider_revoked:      "revoked",
  provider_suspended:    "suspended",
  provider_repo_removed: "removed",
  provider_repo_deleted: "deleted",
}

// Terminal states cannot transition further
const validTransitions: Record<ConnectionStatus, ConnectionStatus[]> = {
  active:       ["disconnected", "revoked", "suspended", "removed", "deleted", "error"],
  suspended:    ["active", "revoked"],
  error:        ["active", "revoked"],
  disconnected: ["active"],
  revoked:      ["active"],           // reinstall flow
  removed:      ["active"],           // re-add to app
  deleted:      [],                   // terminal
}
```

Adding a new provider = add one file to `providers/`. Platform and console pick it up
automatically. No service changes.

---

## 8. Full Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  External World                                                                       │
│  GitHub · Vercel · Linear · Sentry  (webhooks)  |  Browsers · CLI  (OAuth)          │
└──────────────────────────────────────┬───────────────────────────────────────────────┘
                                       │ HMAC-signed webhooks + OAuth redirects
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  apps/platform  (edge · Hono · srvx)                                                │
│                                                                                      │
│  POST /ingest/:provider                                                              │
│  ├─ HMAC verify  OR  X-API-Key (service auth — backfill)                            │
│  ├─ Dedup: Redis SET NX EX 86400  gw:webhook:seen:{p}:{id}                         │
│  ├─ Persist: gatewayWebhookDeliveries  status: "received"                           │
│  └─ Upstash Workflow: ingest-delivery                                                │
│       step 1  dedup                                                                  │
│       step 2  persist delivery                                                       │
│       step 3  classify event (connection-core)                                       │
│       step 4  route:                                                                 │
│               lifecycle → connectionLifecycleWorkflow ────────────┐                 │
│               data + conn → QStash → console /api/ingest ─────────┼──────────┐     │
│               data/unknown, no conn → webhook-dlq                 │          │     │
│                                                                    │          │     │
│  GET /connect/:p/authorize  GET /connect/:p/callback  ← OAuth     │          │     │
│  POST /connect/:id/resources  DELETE /connect/:id                 │          │     │
│  GET /token/:id  POST /proxy/:id  GET /connect/:id                │          │     │
│  GET/POST /connect/:id/runs                                        │          │     │
│                                                                    │          │     │
│  connectionLifecycleWorkflow (Upstash WF) ◄────────────────────────┘          │     │
│    step 1   cancel-backfill (Inngest event: apps/run.cancelled)               │     │
│    step 2   revoke-token (skip: GitHub, suspended)                            │     │
│    step 3   Redis DEL routing cache         ◄── RELAY GATE                   │     │
│    step 3.5 workspaceIntegrations.status    ◄── INGRESS GATE                 │     │
│    step 4   soft-delete (conditional on reason)                               │     │
│                                                                               │     │
│  connectionRestoreWorkflow (Upstash WF) — for unsuspend                      │     │
│    step 1   gatewayInstallations.status = "active"                           │     │
│    step 2   workspaceIntegrations.status = "active" WHERE "suspended"        │     │
└───────────────────────────────────────────────────────────────────────────────┼─────┘
                                                                                │
                               @repo/connection-core                            │
                          provider registry · classifier                        │
                          state machine · status transitions                    │
                                                                                │
                                   QStash  (data events, retries:5)            │
                                                                                │
┌───────────────────────────────────────────────────────────────────────────────▼─────┐
│  apps/console  (Next.js)                                                            │
│                                                                                      │
│  POST /api/ingest  (Upstash Workflow · QStash receiver)                             │
│    step 1  resolve-workspace (orgId → orgWorkspaces)                                │
│    step 2  CHECK workspaceIntegrations.status = "active"  ← INGRESS GATE           │
│            → not active: return 200, drop (no QStash retry)                        │
│    step 3  transform: connection-core PROVIDERS[provider].events[eventType]         │
│            → no transformer: return 200, drop                                       │
│    step 4  INSERT workspaceIngestLogs                                               │
│    step 5  fan-out:                                                                 │
│            ├─ inngest.send("apps-console/event.capture", ...)                       │
│            └─ realtime.publish(workspaceId, event)  → browser SSE                  │
│                                                                                      │
│  POST /api/jobs  (Inngest endpoint — ALL async work)                                │
│                                                                                      │
│    webhook processing pipeline:                                                      │
│      apps-console/event.capture  → event-store → entity.upserted                   │
│      apps-console/entity.upserted → entity-graph → entity.graphed                  │
│      apps-console/entity.graphed → entity-embed                                     │
│      apps-console/event.stored   → notification-dispatch                            │
│                                                                                      │
│    backfill pipeline (absorbed from apps/backfill):                                 │
│      apps/run.requested → backfill-orchestrator                                     │
│        1. verify: GET platform/connect/:id  (status = "active")                    │
│        2. history: GET platform/connect/:id/runs                                    │
│        3. work units: resource × entityType, gap-filtered                           │
│        4. step.invoke entity-worker per unit (parallel, 4h timeout)                 │
│           → fetch: POST platform/proxy/:id  (provider API)                         │
│           → dispatch: POST platform/ingest/:p (X-API-Key, pre-resolved conn)       │
│                       optionally X-Backfill-Hold: true (holdForReplay mode)        │
│        5. persist run records: POST platform/connect/:id/runs                       │
│        6. drain held: POST platform/ingest/admin/replay/catchup                     │
│      apps/run.cancelled → cancels orchestrator + workers                            │
│                                                                                      │
│  tRPC (all user-facing mutations and queries)                                        │
│    connections.*  workspace.*  sources.*  user.*                                    │
│                                                                                      │
│  POST /api/realtime  (Upstash Realtime SSE)                                         │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────────┐
│  Shared Infrastructure                                                               │
│                                                                                      │
│  @db/console (Drizzle)                                                               │
│    gatewayInstallations       status: active | suspended | error | revoked          │
│    gatewayResources           status: active | removed                               │
│    gatewayTokens              AES-256-GCM encrypted                                 │
│    workspaceIntegrations      status: active | disconnected | revoked | suspended   │
│                                       | removed | deleted | error                   │
│    gatewayWebhookDeliveries   status: received | enqueued | delivered | dlq         │
│    gatewayBackfillRuns        status: idle | pending | running | completed | failed  │
│    workspaceIngestLogs                                                               │
│                                                                                      │
│  @vendor/upstash (Redis)                                                             │
│    gw:webhook:seen:{p}:{id}   dedup  TTL 86400s                                    │
│    gw:resource:{p}:{id}       routing cache  {connectionId, orgId}                 │
│    gw:oauth:state:{token}     TTL 600s                                               │
│    gw:oauth:result:{state}    TTL 300s                                               │
│                                                                                      │
│  @vendor/qstash                                                                      │
│    platform → console /api/ingest     data events  retries:5                        │
│    platform → webhook-dlq topic       unresolvable                                  │
│                                                                                      │
│  @vendor/inngest                                                                     │
│    apps-console/event.capture         webhook event processing                      │
│    apps/run.requested                 backfill start                                │
│    apps/run.cancelled                 backfill stop (cancel orchestrator + workers) │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. What Disappears

| Current | Replaced by |
|---|---|
| `apps/relay` | `apps/platform /ingest/*` |
| `apps/gateway` | `apps/platform /connect/*` |
| `apps/backfill` (HTTP service) | Inngest functions in `apps/console` |
| `connectionTeardownWorkflow` | `connectionLifecycleWorkflow` (extended) |
| M2M tRPC `markGithub*` procedures | lifecycle workflow step 3.5 |
| `connections.disconnect` direct DB write | full lifecycle workflow via platform |
| `workspaceIntegrations.isActive` boolean | `workspaceIntegrations.status` enum |
| QStash hop: relay → gateway for lifecycle | in-process handling within platform |
| Race condition window | structurally eliminated (same-service routing + lifecycle) |

## 10. What Stays the Same

- Upstash Workflow for all multi-step durable operations
- QStash for platform → console delivery (one hop, retried, deduped)
- Redis for dedup + routing cache + OAuth state
- HMAC verification + service-auth model
- The Inngest processing pipeline (event-store → entity-graph → entity-embed)
- The holdForReplay backfill model
- The `@vendor/*` abstraction layer
- The tRPC boundary model (user/org/m2m)
- Provider-specific HMAC verification (`@repo/console-providers` crypto)

---

## 11. Migration Plan

Ordered by risk (lowest first). Each phase is independently deployable.

### Phase 1: workspaceIntegrations.status (DB + writes)

Risk: LOW — additive schema change, dual-write during transition.

```
1. DB migration: ADD COLUMN status varchar(50) NOT NULL DEFAULT 'active'
2. Backfill: UPDATE SET status = 'disconnected' WHERE is_active = false
3. All write sites: write both isActive AND status during transition
4. Read sites: switch to reading status
5. DB migration: DROP COLUMN is_active
```

Changes: `db/console/src/schema/tables/workspace-integrations.ts`,
all tRPC write sites in `api/console/src/router/`

### Phase 2: Absorb backfill into console

Risk: LOW — Inngest functions are pure computation, no HTTP surface exposed externally.

```
1. Move backfill-orchestrator.ts + entity-worker.ts
   FROM apps/backfill/src/workflows/
   TO   api/console/src/inngest/workflow/backfill/
2. Add POST /api/internal/backfill/trigger (Next.js API, X-API-Key)
   → replaces apps/backfill POST /trigger and POST /trigger/cancel
3. Update packages/gateway-service-clients/src/backfill.ts → console URL
4. Delete apps/backfill
```

### Phase 3: @repo/connection-core

Risk: LOW — pure refactor, no behavior change, no HTTP surface change.

```
1. Create packages/connection-core/
2. Extract: classifier.ts, state-machine.ts
3. Migrate provider definitions from @repo/console-providers
4. Both apps/platform (future) and apps/console import from connection-core
```

### Phase 4: Merge relay + gateway → apps/platform

Risk: MEDIUM — route renames, single combined deployment.

```
1. Create apps/platform with unified Hono app
2. /ingest/* routes (from relay routes/webhooks.ts + routes/workflows.ts)
3. /connect/* routes (from gateway routes/connections.ts)
4. /token/:id  /proxy/:id (from gateway)
5. connectionLifecycleWorkflow (extended teardown + lifecycle ingest handling)
6. connectionRestoreWorkflow (new)
7. Update all internal callers:
   gateway-service-clients/gateway.ts → /connect/*
   gateway-service-clients/relay.ts → /ingest/*
8. Update CLAUDE.md port references
9. Delete apps/relay + apps/gateway
```

### Phase 5: Console ingest gate + status check

Risk: LOW — additive check, no behavior change for active integrations.

```
1. Add step 2 to /api/ingest:
   CHECK workspaceIntegrations.status = "active"
   if not active: return 200, do not process
2. Test with all status values
```

---

## 12. Developer Maintenance Model (after)

```
Question                                  Answer
─────────────────────────────────────────────────────────────────────
Where does inbound traffic go?            apps/platform
Where is user-facing logic?               apps/console tRPC
Where is async processing?                apps/console Inngest (/api/jobs)
Where are provider definitions?           @repo/connection-core
How do I add a new provider?              Add providers/{name}.ts to connection-core
How do I debug a failed webhook?          platform logs + console logs + Inngest dashboard
What triggers backfill?                   tRPC mutation → inngest.send()
What handles installation.deleted?        platform classifies as lifecycle →
                                          connectionLifecycleWorkflow → step 3.5 + 4
```

Two deployments. Two log sources. One package for all provider intelligence.
