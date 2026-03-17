---
date: 2026-03-17T00:00:00+00:00
researcher: claude
git_commit: 2cebd819fc9ca00e174fbdca08c116c8bbe46c35
branch: test/relay-56b1211c
repository: lightfast
topic: "Infrastructure redesign: 2-app model with connection-core package"
tags: [research, architecture, platform, redesign, infrastructure, maintainability]
status: complete
last_updated: 2026-03-17
---

# Infrastructure Redesign: The 2-App Model

## Why the current split is wrong

The relay/gateway/backfill split is organized around deployment units, not conceptual layers.

**relay + gateway are the same thing:**
- Identical package.json deps (both: @db/console, @repo/console-providers, @vendor/upstash,
  @vendor/upstash-workflow, @vendor/qstash, @vendor/observability)
- Same Hono + srvx stack, same middleware pattern
- Same DB access (both write to gatewayInstallations, gatewayResources)
- Combined: ~11,600 lines / 2 deployments

The split is artificial — and it CAUSES the race condition. Lifecycle events arrive at relay, get
forwarded via QStash to gateway, which then triggers a teardown workflow. Meanwhile relay continues
routing events using stale state because the state update lives in a separate service.

If lifecycle handling happened IN the same service as routing, the race window collapses to zero.

**backfill is an Inngest app:**
- 2 Inngest workflow files (orchestrator + entity-worker): 700 lines
- 2 route files (trigger.ts, inngest.ts): ~100 lines
- The HTTP surface is: POST /trigger → inngest.send(), POST /trigger/cancel → inngest.send()
- It exists as a separate deployment for no architectural reason

---

## The 2-App Model

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  External World                                                                           │
│  GitHub · Vercel · Linear · Sentry   (webhooks)                                         │
│  Browsers / CLI                      (OAuth)                                             │
└──────────────────────────────────────────┬───────────────────────────────────────────────┘
                                           │
                    ┌──────────────────────▼──────────────────────────┐
                    │              apps/platform                       │
                    │   (replaces: apps/relay + apps/gateway)         │
                    │                                                   │
                    │   The single surface between Lightfast           │
                    │   and the external world.                        │
                    │                                                   │
                    │   POST /ingest/:provider  ← all webhooks        │
                    │   GET  /connect/:provider/authorize  ← OAuth    │
                    │   GET  /connect/:provider/callback   ← OAuth    │
                    │   POST /connect/:id/resources                    │
                    │   DELETE /connect/:id                            │
                    │   GET  /token/:id          ← internal           │
                    │   POST /proxy/:id          ← internal           │
                    └──────────────────────┬──────────────────────────┘
                                           │
                    ┌──────────────────────▼──────────────────────────┐
                    │              @repo/connection-core               │
                    │   (new shared package — the brain)              │
                    │                                                   │
                    │   Provider registry                              │
                    │   Event classifier (lifecycle | data | unknown) │
                    │   Connection state machine (pure functions)      │
                    │   Status transitions (what's valid from where)  │
                    └──────────────────────┬──────────────────────────┘
                                           │
                    QStash  (data events, retries:5)
                                           │
                    ┌──────────────────────▼──────────────────────────┐
                    │              apps/console                        │
                    │   (Next.js — UI + all async processing)         │
                    │                                                   │
                    │   tRPC         user-facing APIs                  │
                    │   /api/ingest  QStash receiver                  │
                    │   /api/jobs    Inngest endpoint (ALL jobs)       │
                    │               ├─ webhook transform + store       │
                    │               ├─ entity graph + embed            │
                    │               ├─ backfill orchestrator  ◄────── │── absorbed
                    │               ├─ backfill entity-worker  ◄───── │── from backfill
                    │               └─ notifications                   │
                    │   /api/realtime  SSE                             │
                    └─────────────────────────────────────────────────┘
```

---

## apps/platform — Design

### The key insight: lifecycle handling is in-process

When `installation.deleted` arrives at `/ingest/github`:

```
request → verify HMAC → dedup (Redis NX) → persist delivery
       → classify event (connection-core: is this lifecycle or data?)
       → lifecycle? → handle inline (same process, zero hop):
                       look up gatewayInstallations by externalId
                       begin connectionLifecycleWorkflow (Upstash WF)
                       return 200 immediately
       → data?      → resolve connection (Redis → DB)
                       publish to QStash → console ingest
                       return 200
```

**The race condition disappears.** Step 3 of the teardown (Redis DEL) happens inside the same
service that does routing. No window between "lifecycle event received" and "routing disabled".

### Webhook delivery workflow (Upstash Workflow, replaces relay's webhook-delivery)

```
step 1  dedup (Redis NX)
step 2  persist delivery
step 3  classify:
        lifecycle → connectionLifecycleWorkflow.trigger(reason, installationId, resourceIds?)
        data      → resolve-connection (Redis → DB)
step 4  route:
        data + connection found  → QStash → console /api/ingest
        data + no connection     → webhook-dlq
```

### connectionLifecycleWorkflow (Upstash Workflow, replaces gateway's teardown)

Payload:
```ts
{
  reason:
    | "user_disconnect"
    | "provider_revoked"       // installation.deleted
    | "provider_suspended"     // installation.suspend
    | "provider_repo_removed"  // installation_repositories.removed
    | "provider_repo_deleted"  // repository.deleted
  installationId: string
  orgId: string
  provider: SourceType
  resourceIds?: string[]       // partial teardown
}
```

Steps:
```
step 1  cancel-backfill (Inngest event: apps/run.cancelled)  ← skip for repo-level
step 2  revoke-token (skip GitHub, skip for suspended)
step 3  cleanup-cache: Redis DEL gw:resource:*  ← RELAY GATE (in same process now)
step 3.5 update workspaceIntegrations.status = targetStatus(reason)  ← INGRESS GATE
step 4  soft-delete: gatewayInstallations / gatewayResources
        conditional on reason (suspended ≠ revoked, repo-level ≠ full)
```

connectionRestoreWorkflow (new — for unsuspend):
```
step 1  UPDATE gatewayInstallations SET status = "active"
step 2  UPDATE workspaceIntegrations SET status = "active" WHERE status = "suspended"
```

### OAuth surface (from gateway, unchanged)

GET  /connect/:provider/authorize  → Redis state key → OAuth URL
GET  /connect/:provider/callback   → upsert installation, upsert tokens → Redis result key
GET  /connect/oauth/poll           → Redis result key poll (CLI flow)

### Internal surface (from gateway, unchanged)

GET  /token/:id         → decrypt + refresh token → return plaintext (short TTL)
POST /proxy/:id         → proxy to provider API → forward response
POST /connect/:id/res   → upsert gatewayResources, SET Redis routing cache
DEL  /connect/:id/res/r → UPDATE gatewayResources removed, DEL Redis routing cache
GET  /connect/:id       → installation + resources (backfill access)
GET/POST /connect/:id/runs → backfill run records

### Service-auth path (from relay, for backfill)

POST /ingest/:provider with X-API-Key:
- Same endpoint as external webhooks
- serviceAuthDetect middleware: X-API-Key → sets isServiceAuth flag
- serviceAuthBodyValidator: pre-resolved connectionId + orgId
- Skips HMAC verify, skips connection resolution
- Dedup → persist → QStash directly

---

## apps/console — Changes

### Absorb backfill Inngest functions

Move into api/console/src/inngest/workflow/backfill/:
- backfill-orchestrator.ts (from apps/backfill/src/workflows/)
- entity-worker.ts (from apps/backfill/src/workflows/)

The backfill trigger surface:
- Remove: apps/backfill/src/routes/trigger.ts (POST /trigger, POST /trigger/cancel)
- Add: tRPC mutation `backfill.trigger` (calls inngest.send() directly)
- Or: POST /api/internal/backfill/trigger (Next.js API route, X-API-Key auth)
  → this keeps the same interface for the platform to call cancel

The backfill HTTP client (packages/gateway-service-clients/src/backfill.ts) still works —
it just points at the console URL instead of a separate backfill service.

### Console ingest endpoint (from relay → QStash → current ingress)

POST /api/ingest  (replaces /api/gateway/ingress)
- Upstash Workflow (durable, QStash-verified)
- step 1: resolve-workspace
- step 2: CHECK workspaceIntegrations.status = "active"  ← INGRESS GATE
- step 3: transform (via @repo/connection-core provider registry)
- step 4: INSERT workspaceIngestLogs
- step 5: fan-out (Inngest event.capture + Realtime)

---

## @repo/connection-core — The Brain

New package. The single source of truth for connection intelligence.

```
packages/connection-core/src/
├── providers/
│   ├── github.ts      (event classifier, state transitions, OAuth config)
│   ├── vercel.ts
│   ├── linear.ts
│   └── sentry.ts
├── classifier.ts      (is this event lifecycle? data? unknown?)
├── state-machine.ts   (valid transitions, targetStatus(reason))
├── registry.ts        (PROVIDERS map — the single import for everything)
└── index.ts
```

### classifier.ts

```ts
type EventClass = "lifecycle" | "data" | "unknown"

classifyEvent(provider: SourceType, eventType: string, action?: string): EventClass

// GitHub:
// "installation" + any action          → lifecycle
// "installation_repositories" + any    → lifecycle
// "repository" + "deleted"             → lifecycle
// "pull_request", "issues"             → data
// everything else                      → unknown

// Vercel:
// "integration-configuration"          → lifecycle (resolveCategory strips .removed)
// "project" + "deleted"                → lifecycle
// "deployment"                         → data

// Sentry:
// "installation"                       → lifecycle
// "issue", "error", etc.              → data
```

### state-machine.ts

```ts
type ConnectionStatus =
  | "active"
  | "disconnected"   // user removed in Lightfast
  | "revoked"        // provider deleted installation
  | "suspended"      // provider suspended installation
  | "removed"        // resource removed from installation
  | "deleted"        // resource hard-deleted on provider
  | "error"          // auth failure

type TeardownReason =
  | "user_disconnect"
  | "provider_revoked"
  | "provider_suspended"
  | "provider_repo_removed"
  | "provider_repo_deleted"

targetStatus(reason: TeardownReason): ConnectionStatus
// user_disconnect        → "disconnected"
// provider_revoked       → "revoked"
// provider_suspended     → "suspended"
// provider_repo_removed  → "removed"
// provider_repo_deleted  → "deleted"

validTransitions: Record<ConnectionStatus, ConnectionStatus[]>
// "active"       → ["disconnected", "revoked", "suspended", "removed", "deleted", "error"]
// "suspended"    → ["active", "revoked"]
// "error"        → ["active", "revoked"]
// "disconnected" → ["active"]
// "revoked"      → ["active"]  (reinstall)
// "removed"      → ["active"]  (re-add to app)
// "deleted"      → []          (terminal)
```

**Both `apps/platform` and `apps/console` import from this package.**
Adding a new provider = update connection-core. Nothing else changes.

---

## Full Architecture Diagram (updated)

```
                    ┌────────────────────────────────────────────────────────┐
                    │  External Providers + Browsers                         │
                    │  GitHub  Vercel  Linear  Sentry  |  User browsers/CLI │
                    └──────────────────┬─────────────────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────────────────┐
                    │  apps/platform  (edge · Hono · srvx)                   │
                    │                                                          │
                    │  POST /ingest/:provider                                  │
                    │  ├─ HMAC verify  OR  X-API-Key (service auth)           │
                    │  ├─ Dedup (Redis NX)                                    │
                    │  ├─ Persist (gatewayWebhookDeliveries)                  │
                    │  └─ Upstash Workflow: ingest-delivery                   │
                    │      classify → @repo/connection-core                   │
                    │      if lifecycle:                                       │
                    │        resolve installation (DB by externalId)          │
                    │        trigger connectionLifecycleWorkflow  ────────┐  │
                    │      if data:                                         │  │
                    │        resolve-connection (Redis → DB)               │  │
                    │        QStash → console /api/ingest  ─────────────┐ │  │
                    │      if unknown:                                    │ │  │
                    │        webhook-dlq                                  │ │  │
                    │                                                     │ │  │
                    │  GET  /connect/:p/authorize                         │ │  │
                    │  GET  /connect/:p/callback                          │ │  │
                    │  POST /connect/:id/resources                        │ │  │
                    │  DELETE /connect/:id  → lifecycle wf  ─────────────┼─┘  │
                    │  GET  /token/:id   GET /connect/:id                │    │
                    │  POST /proxy/:id                                    │    │
                    │                                                     │    │
                    │  connectionLifecycleWorkflow (Upstash WF)  ◄───────┘    │
                    │    step 1  cancel-backfill (Inngest event)              │
                    │    step 2  revoke-token                                 │
                    │    step 3  Redis DEL routing cache  ◄── RELAY GATE     │
                    │    step 3.5 workspaceIntegrations.status  ◄─ INGRESS   │
                    │    step 4  soft-delete installs + resources             │
                    └──────────────────────────────┬──────────────────────────┘
                                                   │
                                  @repo/connection-core
                                  (provider registry, classifier, state machine)
                                                   │
                               QStash (data events, retries:5)
                                                   │
                    ┌──────────────────────▼──────────────────────────────────┐
                    │  apps/console  (Next.js)                                │
                    │                                                          │
                    │  /api/ingest  (Upstash Workflow, QStash receiver)       │
                    │    step 1  resolve-workspace                             │
                    │    step 2  CHECK wi.status = "active"  ◄── INGRESS GATE│
                    │    step 3  transform (connection-core provider registry) │
                    │    step 4  INSERT workspaceIngestLogs                   │
                    │    step 5  fan-out:                                      │
                    │            ├─ Inngest: apps/event.capture               │
                    │            └─ Upstash Realtime → browser SSE            │
                    │                                                          │
                    │  /api/jobs  (Inngest — ALL async work)                  │
                    │    webhook processing pipeline:                          │
                    │      event.capture → event-store → entity.upserted     │
                    │      entity.upserted → entity-graph → entity.graphed   │
                    │      entity.graphed → entity-embed                      │
                    │      event.stored → notification-dispatch               │
                    │                                                          │
                    │    backfill pipeline (absorbed from apps/backfill):     │
                    │      apps/run.requested → backfill-orchestrator         │
                    │        → step.invoke backfill-entity-worker (parallel) │
                    │           → GET platform/token/:id  (token fetch)      │
                    │           → POST platform/proxy/:id (provider fetch)   │
                    │           → POST platform/ingest/:p (dispatch back)    │
                    │      apps/run.cancelled → cancels above                │
                    │                                                          │
                    │  /api/realtime  (Upstash Realtime SSE)                  │
                    │                                                          │
                    │  tRPC (all user-facing mutations + queries)             │
                    │    connections.*  workspace.*  sources.*               │
                    └─────────────────────────────────────────────────────────┘
                                           │
                    ┌──────────────────────▼──────────────────────────────────┐
                    │  Shared Infrastructure                                  │
                    │                                                          │
                    │  @db/console  (Drizzle)                                 │
                    │    gatewayInstallations    status: active|suspended|    │
                    │                                    error|revoked        │
                    │    gatewayResources        status: active|removed       │
                    │    gatewayTokens           AES-256-GCM encrypted        │
                    │    workspaceIntegrations   status: active|disconnected| │
                    │                                    revoked|removed|     │
                    │                                    deleted|suspended|   │
                    │                                    error                │
                    │    gatewayWebhookDeliveries  received|enqueued|        │
                    │                              delivered|dlq              │
                    │    gatewayBackfillRuns                                  │
                    │    workspaceIngestLogs                                  │
                    │                                                          │
                    │  @vendor/upstash  (Redis)                               │
                    │    gw:webhook:seen:{p}:{id}  dedup  TTL 86400s         │
                    │    gw:resource:{p}:{id}       routing cache             │
                    │    gw:oauth:state:{token}     TTL 600s                  │
                    │    gw:oauth:result:{state}    TTL 300s                  │
                    │                                                          │
                    │  @vendor/qstash                                         │
                    │    platform → console /api/ingest   data events        │
                    │    platform → webhook-dlq topic     unresolvable        │
                    │                                                          │
                    │  @vendor/inngest                                         │
                    │    apps/event.capture     data processing               │
                    │    apps/run.requested     backfill start                │
                    │    apps/run.cancelled     backfill stop                 │
                    └─────────────────────────────────────────────────────────┘
```

---

## What this model solves

### The race condition — eliminated structurally

```
t=0   installation.deleted arrives at POST /platform/ingest/github
      classify → lifecycle
      resolve installation (DB lookup by externalId = installationId)
      trigger connectionLifecycleWorkflow { reason: "provider_revoked" }
      return 200 immediately

      (all of the above: same process, same Redis, same DB client)

t=50  New PR webhook arrives at POST /platform/ingest/github
      classify → data
      resolve-connection: Redis gw:resource:github:{repoId}

      ← IF lifecycle workflow step 3 has run: Redis miss → DB query
        DB query: gatewayResources WHERE status = "active" → miss (after step 4)
        → DLQ
      ← IF lifecycle workflow not yet complete: Redis hit
        → routes to console ingest
        console ingest step 2: CHECK wi.status = "active"
        → if step 3.5 complete: "revoked" → DROP
        → if step 3.5 not yet: "active" → process (acceptable: tiny window)
```

The window now is only between `step 3.5 complete` and the QStash delivery arriving at console.
With QStash delivery in-order and the Upstash Workflow steps running in sequence, this window
is essentially zero for any event that was not already in the QStash queue before teardown started.

### Developer experience

**Before (3 services):**
- New engineer needs to understand: relay → QStash → gateway | console → Inngest
- Debug a failed webhook: relay logs + gateway logs + console logs + Inngest dashboard + QStash logs
- Add a new provider: touch relay (event extraction) + gateway (OAuth, lifecycle) + console-providers (transformers) + backfill (entity types)

**After (2 apps + connection-core):**
- New engineer mental model: platform (everything in/out) → console (everything computed)
- Debug a failed webhook: platform logs + console logs + Inngest dashboard
- Add a new provider: add to @repo/connection-core (classifier + state machine + OAuth config + transformers). Platform and console both pick it up automatically.

### Operational

| Metric | Before | After |
|---|---|---|
| Edge deployments | 3 (relay, gateway, backfill) | 1 (platform) |
| Next.js deployments | 1 (console) | 1 (console) |
| Env var sets | 4 | 2 |
| Log sources for one webhook | 4-5 | 2-3 |
| QStash inter-service hops | 2-3 | 1 |

---

## Migration path

**Phase 1: Absorb backfill into console Inngest**
- Move backfill-orchestrator.ts and entity-worker.ts into api/console/src/inngest/workflow/backfill/
- Add /api/internal/backfill/trigger to console (or tRPC mutation)
- Update gateway-service-clients/backfill.ts to point at console
- Delete apps/backfill
- Risk: LOW (pure Inngest functions, no HTTP surface change for consumers)

**Phase 2: Merge relay + gateway into platform**
- Create apps/platform with unified Hono app
- Routes: /ingest/* (from relay) + /connect/* (from gateway) + /token/* /proxy/* (from gateway)
- Move connectionLifecycleWorkflow (replaces teardown WF, adds lifecycle ingest handling)
- Update all internal callers (gateway-service-clients/gateway.ts → /connect/*)
- Update all internal callers (gateway-service-clients/relay.ts → /ingest/*)
- Delete apps/relay + apps/gateway
- Risk: MEDIUM (route renames, single deployment)

**Phase 3: @repo/connection-core**
- Extract provider classifier, state machine, event registry
- Remove @repo/console-providers lifecycle-specific code (move to connection-core)
- Both platform + console import from connection-core
- Risk: LOW (refactor, no behavior change)

**Phase 4: workspaceIntegrations.status migration**
- DB migration: add status column, backfill from isActive
- Update all read/write sites
- Remove isActive column
- Risk: MEDIUM (DB migration + UI update)

---

## What stays the same

- Upstash Workflow for durable multi-step operations
- QStash for platform → console delivery (one hop, reliable, retried)
- Redis for dedup + routing cache
- The provider HMAC verification model
- The Inngest pipeline (event-store → entity-graph → entity-embed)
- The backfill holdForReplay model
- The @vendor/* abstraction layer

## What disappears

- 3-service coordination overhead (relay → QStash → gateway)
- The race condition window between relay routing and gateway teardown
- Separate backfill deployment with HTTP trigger wrapper
- M2M tRPC procedures for GitHub lifecycle (markGithubInstallationInactive etc.)
- The artificial relay/gateway split in developer mental model
