---
date: 2026-03-17T00:00:00+00:00
researcher: claude
git_commit: 2cebd819fc9ca00e174fbdca08c116c8bbe46c35
branch: test/relay-56b1211c
repository: lightfast
topic: "Full architecture redesign: connection lifecycle, teardown race conditions, end-to-end event flow"
tags: [research, architecture, relay, gateway, backfill, ingest, teardown, race-condition, state-machine]
status: complete
last_updated: 2026-03-17
---

# Architecture Redesign: Connection Lifecycle End-to-End

## The Race Condition

**Setup**: teardown starts while new provider events are in-flight.

```
t=0ms   installation.deleted → relay → QStash → gateway → teardownWorkflow starts
t=50ms  New PR webhook arrives at relay
        └─ resolve-connection:
             1. Redis gw:resource:github:{repoId} → HIT (teardown step 3 hasn't run)
             2. routes to console ingress via QStash

t=200ms teardown step 3: Redis DEL gw:resource:github:{repoId}  ← RELAY GATE
t=300ms teardown step 3.5: workspaceIntegrations.status = "revoked"  ← INGRESS GATE
t=400ms teardown step 4: gatewayInstallations.status = "revoked", gatewayResources.status = "removed"

t=450ms console ingress receives the PR webhook (was already in QStash queue)
        └─ checks workspaceIntegrations.status → "revoked" → DROPS EVENT ✓
```

**Two natural gates, ordered correctly:**
1. **Relay gate** (teardown step 3 — Redis cleanup): prevents NEW events from being routed after this point
2. **Ingress gate** (teardown step 3.5 + status check): handles events already in-flight in QStash

**Backfill during teardown**: step 1 of teardown sends `apps-backfill/run.cancelled` via QStash. Inngest cancels orchestrator + workers. A worker mid-page may dispatch a few more events through relay before seeing the cancellation signal. Same two-gate model handles it.

**Acceptable window**: seconds. A handful of events processed in the overlap window is fine — the important invariant is that AFTER teardown completes, no further processing occurs.

**No locking needed.** The gates are sufficient. Distributed locks would add latency to every webhook delivery for a race that lasts milliseconds.

---

## Full Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  External Providers                                                                       │
│  GitHub  ·  Vercel  ·  Linear  ·  Sentry                                                │
└──────────────────────────────────┬───────────────────────────────────────────────────────┘
                                   │  HMAC-signed webhooks
                                   │  (pull_request, issues, deployment, installation, …)
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  apps/relay  (edge · Hono · srvx · port 4108)                                           │
│                                                                                           │
│  POST /api/webhooks/:provider                                                            │
│  ├─ HMAC verify (provider-specific signature)                                            │
│  ├─ Dedup   Redis SET NX EX 86400  gw:webhook:seen:{provider}:{deliveryId}              │
│  ├─ Persist gatewayWebhookDeliveries  status: "received"                                │
│  └─ Upstash Workflow: webhook-delivery                                                   │
│      step 1  dedup (Redis NX)                                                            │
│      step 2  persist delivery                                                            │
│      step 3  resolve-connection                                                          │
│              └─ Redis gw:resource:{provider}:{resourceId}                               │
│                    hit  → {connectionId, orgId}                                          │
│                    miss → DB: gatewayResources JOIN gatewayInstallations                 │
│                           WHERE providerResourceId = resourceId AND status = "active"   │
│      step 4  route  ────────────────────────────────────────────────────────────────┐   │
│              │                                                                       │   │
│              ├─ [lifecycle event]  ──────────────────────────────────────────────►  │   │
│              │   installation.*                                                      │   │
│              │   installation_repositories.*                                         │   │
│              │   repository.deleted                                                  │   │
│              │   integration-configuration.removed  (Vercel)                        │   │
│              │   project.removed  (Vercel)                                           │   │
│              │   installation.deleted  (Sentry)                                     │   │
│              │                                                                       │   │
│              ├─ [data event + connection found]  ──────────────────────────────────►│   │
│              │   pull_request, issues, deployment, Issue, Comment, …                 │   │
│              │                                                                       │   │
│              └─ [data event + no connection]  ─────────────────────────────────────►│   │
│                  → webhook-dlq QStash topic                                          │   │
│                                                                                      │   │
│  POST /api/admin/replay/catchup          (backfill replay after hold)               │   │
│  POST /api/admin/delivery-status         (QStash callback → update delivery status) │   │
│  POST /api/admin/dlq/replay              (manual DLQ retry)                         │   │
└──────────────────────────────────────────────────────────────────────────────────────┘   │
       │                          │                                                         │
       │ QStash (lifecycle)       │ QStash (data, retries:5)                               │
       │                          │                                                         │
       ▼                          ▼                                                         │
┌──────────────────┐   ┌──────────────────────────────────────────────────────────────┐    │
│  apps/gateway    │   │  api/console/ingest  (Next.js · Upstash Workflow)            │    │
│  (edge · Hono ·  │   │                                                               │    │
│   srvx · 4110)   │   │  POST /api/gateway/ingress                                   │    │
│                  │   │  step 1  resolve-workspace (orgId → orgWorkspaces)           │    │
│ ─── OAuth ────── │   │  step 2  CHECK workspaceIntegrations.status = "active"  ◄───────── │
│                  │   │          └─ if not active → drop, return 200 (no retry)      │
│  GET /:p/auth    │   │  step 3  transform (provider event → internal entity)        │
│  GET /:p/cb      │   │          └─ PROVIDERS[provider].events[eventType].transform()│
│  GET /oauth/poll │   │          └─ if no transformer → drop, return 200             │
│                  │   │  step 4  INSERT workspaceIngestLogs                          │
│ ─── Connections ─│   │  step 5  fan-out:                                            │
│                  │   │          ├─ Inngest  apps-console/event.capture              │
│  POST /:id/res   │   │          └─ Upstash Realtime (SSE → browser)                │
│  DEL  /:id/res/r │   └───────────────────────────┬──────────────────────────────────┘
│  DEL  /:p/:id    │                               │
│                  │                               │ Inngest events
│ ─── Lifecycle ── │                               ▼
│                  │   ┌──────────────────────────────────────────────────────────────┐
│  NEW:            │   │  Inngest  (api/console/src/inngest/)                         │
│  POST /webhooks/ │   │                                                               │
│    :p/lifecycle  │   │  event-store       apps-console/event.capture               │
│    (from relay)  │   │    └─ emits  apps-console/entity.upserted                   │
│                  │   │  entity-graph      apps-console/entity.upserted              │
│                  │   │    └─ emits  apps-console/entity.graphed                    │
│  connectionTear  │   │  entity-embed      apps-console/entity.graphed              │
│  downWorkflow    │   │  notification-dispatch   apps-console/event.stored          │
│  (Upstash WF)    │   │  record-activity   apps-console/activity.record             │
│                  │   └──────────────────────────────────────────────────────────────┘
│  step 1          │
│  cancel-backfill │◄─── QStash ──────────────────────────────────────────────────────────┐
│                  │                                                                        │
│  step 2          │   ┌──────────────────────────────────────────────────────────────┐    │
│  revoke-token    │   │  apps/backfill  (edge · Hono · srvx · port 4109)            │    │
│  (skip GitHub)   │   │                                                               │    │
│                  │   │  POST /trigger       start historical import                 │◄───┘
│  step 3          │   │  POST /trigger/cancel  stop (Inngest cancel event)           │
│  cleanup-cache   │   │                                                               │
│  Redis DEL       │   │  Inngest: backfill-orchestrator                              │
│  gw:resource:*   │   │    trigger: apps-backfill/run.requested                      │
│  ← RELAY GATE    │   │    cancel: apps-backfill/run.cancelled                       │
│                  │   │    1. verify connection active (gateway GET /connections/:id) │
│  NEW step 3.5    │   │    2. get backfill history (gateway GET /connections/:id/runs)│
│  update          │   │    3. compute work units (resource × entityType, gap-filter) │
│  workspace       │   │    4. invoke entity-worker per unit (parallel, 4h timeout)   │
│  integrations    │   │    5. persist run records (gateway POST /connections/:id/runs)│
│  .status         │   │    6. replay held webhooks (relay POST /admin/replay/catchup) │
│  ← INGRESS GATE  │   │                                                               │
│                  │   │  Inngest: entity-worker                                       │
│  step 4          │   │    per page:                                                  │
│  soft-delete     │   │      fetch   gateway POST /connections/:id/proxy/execute     │
│  installs +      │   │      dispatch relay  POST /api/webhooks/:provider            │
│  resources       │   │              (X-API-Key, pre-resolved connectionId+orgId)    │
│                  │   │              (X-Backfill-Hold: true  when holdForReplay)     │
└────────┬─────────┘   └──────────────────────────────────────────────────────────────┘
         │
         │ direct DB writes (Drizzle)
         ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  Shared Infrastructure                                                                    │
│                                                                                           │
│  @db/console (Drizzle / PlanetScale)                                                     │
│                                                                                           │
│  gatewayInstallations    id · provider · externalId · orgId · status · webhookSecret    │
│                          status:  active | suspended | error | revoked                   │
│                                                                                           │
│  gatewayResources        id · installationId(FK) · providerResourceId · resourceName    │
│                          status:  active | removed                                        │
│                                                                                           │
│  gatewayTokens           installationId(FK) · accessToken(AES-256) · expiresAt          │
│                                                                                           │
│  workspaceIntegrations   id · workspaceId(FK) · installationId(FK) · providerResourceId │
│    [isActive → status]   status:  active | disconnected | revoked | removed |            │
│                                   deleted | suspended | error                             │
│                          lastSyncStatus · lastSyncError · lastSyncedAt (sync tracking)  │
│                                                                                           │
│  gatewayWebhookDeliveries  deliveryId · provider · eventType · status · payload         │
│                             status:  received | enqueued | delivered | dlq               │
│                                                                                           │
│  gatewayBackfillRuns     installationId · providerResourceId · entityType · status      │
│                          status:  idle | pending | running | completed | failed          │
│                                                                                           │
│  workspaceIngestLogs     workspaceId · provider · eventType · entityId · payload        │
│                                                                                           │
│  @vendor/upstash (Redis)                                                                 │
│  gw:webhook:seen:{provider}:{deliveryId}   dedup TTL 86400s                             │
│  gw:resource:{provider}:{resourceId}       routing cache  {connectionId, orgId}         │
│  gw:oauth:state:{token}                    OAuth PKCE  TTL 600s                         │
│  gw:oauth:result:{state}                   OAuth poll  TTL 300s                         │
│                                                                                           │
│  @vendor/qstash                                                                           │
│  relay → gateway /webhooks/:p/lifecycle        lifecycle events                         │
│  relay → console /api/gateway/ingress          data events  retries:5                   │
│  relay → webhook-dlq topic                     unresolvable deliveries                  │
│  gateway → backfill /trigger/cancel            teardown step 1                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## User-Initiated Flows (console → gateway)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  apps/console  (Next.js · tRPC · port 4107)                                             │
│                                                                                           │
│  User: Connect provider                                                                   │
│  └─ tRPC connections.getAuthorizeUrl                                                     │
│     └─ GET gateway/:p/authorize  → OAuth URL                                            │
│        → user browser → provider → GET gateway/:p/callback                              │
│           → gatewayInstallations upsert  status: "active"                               │
│           → gatewayTokens upsert  (encrypted)                                           │
│                                                                                           │
│  User: Add repo/project as source                                                         │
│  └─ tRPC workspace.integrations.bulkLinkResources                                        │
│     ├─ POST gateway/:id/resources                                                        │
│     │   → gatewayResources upsert  status: "active"                                     │
│     │   → Redis gw:resource:{p}:{resourceId} SET  {connectionId, orgId}                 │
│     ├─ INSERT workspaceIntegrations  status: "active"                                    │
│     └─ notifyBackfill()  → POST backfill/trigger  (Inngest event)                       │
│                                                                                           │
│  User: Disconnect specific source                                                         │
│  └─ tRPC workspace.integrations.disconnect                                               │
│     ├─ UPDATE workspaceIntegrations  status: "disconnected"                              │
│     └─ DELETE gateway/:id/resources/:resourceId                                          │
│         → gatewayResources  status: "removed"                                            │
│         → Redis gw:resource:{p}:{resourceId} DEL                                        │
│                                                                                           │
│  User: Disconnect entire provider in Settings                                             │
│  └─ tRPC connections.disconnect                                                           │
│     └─ DELETE gateway/:p/:id  → connectionTeardownWorkflow                              │
│         (full 4-step teardown with reason: "user_disconnect")                            │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## connectionTeardownWorkflow — Redesigned

```
TeardownPayload {
  installationId: string
  orgId: string
  provider: SourceType
  reason: "user_disconnect"
        | "provider_revoked"       ← installation.deleted
        | "provider_suspended"     ← installation.suspend
        | "provider_repo_removed"  ← installation_repositories.removed
        | "provider_repo_deleted"  ← repository.deleted / project.removed
  resourceIds?: string[]           ← providerResourceIds, partial teardown only
}

step 1  cancel-backfill
        QStash → backfill /trigger/cancel  {installationId}
        deduplicationId: "backfill-cancel:{installationId}"
        skip if: reason is repo-level (provider_repo_removed / provider_repo_deleted)

step 2  revoke-token
        skip if: provider === "github"  (on-demand JWTs)
        skip if: reason === "provider_suspended"  (temporary, token may still work)
        providerDef.oauth.revokeToken(decryptedToken)

step 3  cleanup-cache   ← RELAY GATE
        if resourceIds present:
          Redis DEL gw:resource:{provider}:{resourceId}  for each
        else:
          SELECT providerResourceId FROM gatewayResources WHERE installationId AND status="active"
          Redis DEL gw:resource:{provider}:{resourceId}  for all

step 3.5  update-workspace-integrations   ← INGRESS GATE
          targetStatus = {
            user_disconnect:       "disconnected"
            provider_revoked:      "revoked"
            provider_suspended:    "suspended"
            provider_repo_removed: "removed"
            provider_repo_deleted: "deleted"
          }[reason]

          if resourceIds present:
            UPDATE workspaceIntegrations
            SET status = targetStatus
            WHERE installationId = installationId
              AND providerResourceId IN (resourceIds)
          else:
            UPDATE workspaceIntegrations
            SET status = targetStatus
            JOIN gatewayInstallations WHERE id = installationId

step 4  soft-delete
        if reason === "provider_suspended":
          UPDATE gatewayInstallations SET status = "suspended"
          -- do NOT touch gatewayResources (resources still exist, just inaccessible)
        else if resourceIds present:
          UPDATE gatewayResources SET status = "removed"
          WHERE providerResourceId IN (resourceIds)
          -- do NOT touch gatewayInstallations (installation still active)
        else:
          UPDATE gatewayInstallations SET status = "revoked"
          UPDATE gatewayResources SET status = "removed"  WHERE installationId

NEW: connectionRestoreWorkflow (for provider_suspended → unsuspend)
  step 1  UPDATE gatewayInstallations SET status = "active"
  step 2  UPDATE workspaceIntegrations SET status = "active"
          WHERE installationId = installationId AND status = "suspended"
```

---

## Relay Route Step — New Lifecycle Detection

The `route` step in `apps/relay/src/routes/workflows.ts` currently: `connectionInfo === null → DLQ`.

New logic before DLQ fallback:

```
route step:

if provider === "github":
  if eventType === "installation":
    → publish to gateway /webhooks/github/lifecycle
    → payload: { action, installationId: payload.installation.id, repositories: payload.repositories }
    → return "gateway"

  if eventType === "installation_repositories":
    → publish to gateway /webhooks/github/lifecycle
    → payload: { action, installationId, repositoriesAdded: payload.repositories_added, repositoriesRemoved: payload.repositories_removed }
    → return "gateway"

  if eventType === "repository" AND payload.action === "deleted":
    → publish to gateway /webhooks/github/lifecycle
    → payload: { action: "repository_deleted", repositoryId: resourceId, installationId: payload.installation?.id }
    → return "gateway"

if provider === "vercel":
  if eventType matches "integration-configuration" (after resolveCategory):
    → publish to gateway /webhooks/vercel/lifecycle
    → return "gateway"

  if eventType === "project" AND payload.action === "deleted":
    → publish to gateway /webhooks/vercel/lifecycle
    → return "gateway"

if provider === "sentry":
  if eventType === "installation":
    → publish to gateway /webhooks/sentry/lifecycle
    → return "gateway"

// existing logic unchanged below:
if connectionInfo === null:
  → webhook-dlq
else:
  → console ingress
```

---

## New Gateway Endpoint: `POST /webhooks/:provider/lifecycle`

```
Receives lifecycle events from relay (authenticated via X-API-Key).

GitHub installation.deleted:
  1. SELECT gatewayInstallations WHERE provider="github" AND externalId = installationId
  2. trigger connectionTeardownWorkflow { reason: "provider_revoked", installationId, orgId, provider }

GitHub installation.suspend:
  1. SELECT installation by externalId
  2. trigger connectionTeardownWorkflow { reason: "provider_suspended" }

GitHub installation.unsuspend:
  1. SELECT installation by externalId
  2. trigger connectionRestoreWorkflow { installationId, orgId }

GitHub installation_repositories.removed:
  For each repo in repositoriesRemoved:
    1. SELECT gatewayResources WHERE installationId AND providerResourceId = repo.id
    2. trigger connectionTeardownWorkflow {
         reason: "provider_repo_removed",
         resourceIds: [repo.id],
         installationId, orgId, provider
       }

GitHub installation_repositories.added:
  For each repo in repositoriesAdded:
    1. Upsert gatewayResources { status: "active", providerResourceId: repo.id, resourceName: repo.full_name }
    2. SET Redis gw:resource:github:{repo.id} = { connectionId: installation.id, orgId }
    (does NOT auto-create workspaceIntegrations — user still explicitly adds sources)

GitHub repository.deleted:
  1. SELECT gatewayResources WHERE providerResourceId = repositoryId AND status = "active"
  2. trigger connectionTeardownWorkflow {
       reason: "provider_repo_deleted",
       resourceIds: [repositoryId],
       installationId: resource.installationId,
       orgId, provider
     }

Vercel integration-configuration.removed:
  1. SELECT installation by externalId
  2. trigger connectionTeardownWorkflow { reason: "provider_revoked" }

Vercel project.removed:
  Similar to GitHub repository.deleted

Sentry installation.deleted:
  Similar to GitHub installation.deleted
```

---

## console ingress — New Status Gate

```typescript
// api/console/ingest route.ts — step 2, before transform

const integration = await db.query.workspaceIntegrations.findFirst({
  where: and(
    eq(workspaceIntegrations.installationId, envelope.connectionId),
    eq(workspaceIntegrations.providerResourceId, envelope.resourceId),
  ),
  columns: { status: true },
})

if (!integration || integration.status !== "active") {
  // drop silently — teardown is in progress or complete
  // return 200 so QStash does not retry
  return { dropped: true, reason: integration?.status ?? "not_found" }
}
```

This is the INGRESS GATE that handles events in-flight during teardown.

---

## workspaceIntegrations.status — Migration Plan

```sql
-- Phase 1: Add status column alongside isActive
ALTER TABLE lightfast_workspace_integrations
  ADD COLUMN status varchar(50) NOT NULL DEFAULT 'active';

-- Phase 2: Backfill from isActive
UPDATE lightfast_workspace_integrations SET status = 'disconnected' WHERE is_active = false;
UPDATE lightfast_workspace_integrations SET status = 'active' WHERE is_active = true;

-- Phase 3: Update all write sites to use status
-- Phase 4: Remove isActive column
```

Write site migration:

| Old write | New write |
|---|---|
| `isActive = false` via `markGithubInstallationInactive` | `status = "revoked"` via teardown step 3.5 |
| `isActive = false` via `markGithubRepoInactive` | `status = "removed"` via teardown step 3.5 |
| `isActive = false` via `markGithubDeleted` | `status = "deleted"` via teardown step 3.5 |
| `isActive = false` via `workspace.integrations.disconnect` | `status = "disconnected"` |
| `isActive = true` (insert) | `status = "active"` |
| `isActive = true` (reactivate) | `status = "active"` |

The m2m tRPC `markGithub*` procedures become redundant — teardown workflow handles the state directly. They can be removed once the gateway lifecycle endpoint is live.

The console tRPC `connections.disconnect` path is also simplified: instead of writing `gatewayInstallations.status = "revoked"` directly, it calls `DELETE gateway/:p/:id` which triggers the full teardown workflow. Currently these are separate paths.

---

## Full Event Lifecycle (PR webhook, complete trace)

```
1. GitHub → POST /api/webhooks/github  (relay)
   headers: x-github-event: pull_request, x-hub-signature-256: sha256=..., x-github-delivery: {uuid}

2. relay middleware: HMAC verify → parse → extract (eventType=pull_request, resourceId=repo.id, deliveryId)

3. relay workflow step 1: Redis SET NX gw:webhook:seen:github:{deliveryId}  → new key, continue

4. relay workflow step 2: INSERT gatewayWebhookDeliveries  status: "received"

5. relay workflow step 3: Redis HGET gw:resource:github:{repoId}
   hit → {connectionId: "inst_xxx", orgId: "org_yyy"}

6. relay workflow step 4: route → data event + connection found → QStash publish
   target: https://lightfast.ai/api/gateway/ingress
   body: WebhookEnvelope { deliveryId, connectionId, orgId, provider: "github", eventType: "pull_request", payload, receivedAt }
   deduplicationId: "github_{deliveryId}"
   retries: 5

7. relay workflow step 5: UPDATE gatewayWebhookDeliveries  status: "enqueued"

8. QStash → console ingress
   step 1: SELECT orgWorkspaces WHERE orgId = "org_yyy"
   step 2: CHECK workspaceIntegrations.status = "active" for (connectionId, resourceId)  ← INGRESS GATE
   step 3: transformWebhookPayload("github", "pull_request", payload)
           → PROVIDERS.github.events["pull_request"].schema.parse(payload)
           → PROVIDERS.github.events["pull_request"].transform(parsed, context)
           → { entityType: "pull_request", entityId, ... }
   step 4: INSERT workspaceIngestLogs
   step 5a: inngest.send("apps-console/event.capture", { data: { workspaceId, entityId, ... } })
   step 5b: realtime.publish(workspaceId, event)

9. QStash callback → relay POST /api/admin/delivery-status
   UPDATE gatewayWebhookDeliveries  status: "delivered"

10. Inngest event-store: processes entity, emits entity.upserted
11. Inngest entity-graph: builds graph edges, emits entity.graphed
12. Inngest entity-embed: generates vector embedding
```

---

## Full Teardown Lifecycle (installation.deleted, complete trace)

```
1. GitHub → POST /api/webhooks/github  (relay)
   x-github-event: installation, payload.action: "deleted", payload.installation.id: 116729484

2. relay: HMAC verify → extractResourceId = "116729484" (installation.id, no repository at top level)

3. relay workflow step 3 resolve-connection:
   Redis HGET gw:resource:github:116729484 → miss
   DB: SELECT FROM gatewayResources WHERE providerResourceId = "116729484" → miss
   connectionInfo = null

4. relay workflow step 4 route:
   [NEW] eventType === "installation" AND provider === "github"
   → QStash publish to gateway POST /webhooks/github/lifecycle
   → payload: { action: "deleted", installationId: 116729484, repositories: [...] }
   → return "gateway"  (NOT DLQ)

5. gateway POST /webhooks/github/lifecycle:
   SELECT FROM gatewayInstallations WHERE provider="github" AND externalId="116729484"
   → found: { id: "inst_xxx", orgId: "org_yyy", status: "active" }
   trigger connectionTeardownWorkflow {
     installationId: "inst_xxx",
     orgId: "org_yyy",
     provider: "github",
     reason: "provider_revoked"
   }

6. connectionTeardownWorkflow:
   step 1  QStash → POST backfill/trigger/cancel {installationId: "inst_xxx"}
           Inngest cancels backfill-orchestrator + entity-workers for this installation

   step 2  provider === "github" → skip token revocation

   step 3  SELECT providerResourceId FROM gatewayResources WHERE installationId="inst_xxx" AND status="active"
           → ["955790356", "981390206", ...]
           Redis DEL gw:resource:github:955790356, gw:resource:github:981390206, ...
           ← RELAY GATE: new webhooks for these repos now go to DLQ

   step 3.5  UPDATE workspaceIntegrations SET status = "revoked"
             JOIN gatewayInstallations WHERE id = "inst_xxx"
             ← INGRESS GATE: in-flight events now dropped at ingress

   step 4  UPDATE gatewayInstallations SET status = "revoked" WHERE id = "inst_xxx"
           UPDATE gatewayResources SET status = "removed" WHERE installationId = "inst_xxx"
```

---

## Summary of Changes Required

| Component | Change |
|---|---|
| `apps/relay/src/routes/workflows.ts` | route step: detect lifecycle event types → QStash to gateway instead of DLQ |
| `apps/gateway/src/routes/connections.ts` | New `POST /webhooks/:provider/lifecycle` endpoint |
| `apps/gateway/src/workflows/connection-teardown.ts` | Add `reason` + `resourceIds` to payload; new step 3.5; conditional step 4; new `connectionRestoreWorkflow` |
| `api/console/src/router/org/connections.ts` | `connections.disconnect` → call `DELETE gateway/:p/:id` instead of direct DB write |
| `apps/console/src/app/api/gateway/ingress/route.ts` | step 2: check `workspaceIntegrations.status = "active"` before processing |
| `db/console/src/schema/tables/workspace-integrations.ts` | Replace `isActive` boolean with `status` varchar enum |
| `db/console/src/schema/tables/gateway-installations.ts` | Add `suspended` to status enum comment |
| `packages/console-providers/src/providers/github/index.ts` | Add `installation_repositories` and `repository.deleted` to event-type routing |
| M2M `sources.*` procedures | Removed once gateway lifecycle endpoint handles state directly |
