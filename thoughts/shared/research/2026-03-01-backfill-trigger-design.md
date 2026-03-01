---
date: 2026-03-01T07:35:19Z
researcher: jeevanpillay
git_commit: 9055319abf0672cd51b41b5b721b489753dc4678
branch: feat/connections-provider-account-info
repository: lightfast
topic: "Backfill trigger design: new page vs connection phase, gateway routing, and shared data stream architecture"
tags: [research, codebase, backfill, gateway, connections, new-page, workspace]
status: complete
last_updated: 2026-03-01
last_updated_by: jeevanpillay
---

# Research: Backfill Trigger Design

**Date**: 2026-03-01T07:35:19Z
**Researcher**: jeevanpillay
**Git Commit**: `9055319abf0672cd51b41b5b721b489753dc4678`
**Branch**: `feat/connections-provider-account-info`
**Repository**: lightfast

## Research Question

> I noticed that we try to start backfill during the initial connection. Actually, initial connection is just a setup phase.
>
> Backfill should start during `apps/console/src/app/(app)/(user)/new/` creation.
>
> Let's discuss how to ensure a clean design for the new page to call `apps/backfill` — ideally through `apps/gateway`.
>
> Secondly, we need to re-design how the backfill works in relation to simplicity:
> - **Option 1**: Single repoX/projectX data stream, independent of Lightfast workspace. If backfill starts for repoX, it stays forever connected to repoX/projectX and can be shared between workspaceA and workspaceB.
> - **Option 2**: Each time a new repo is connected, re-run backfill.
>
> Main concern: go to prod fast + ensure least maintainability overhead.

---

## Summary

### Where Backfill Currently Fires

Backfill is triggered **inside `apps/connections`** during the OAuth callback phase (`handleCallback`), immediately after a provider installation is upserted into `gwInstallations`. It fires via QStash to `POST /api/trigger` on the backfill service. This is the _connection setup phase_ — it has nothing to do with workspace creation or repo linking.

The `/new` page does **not** trigger backfill at all. It creates a workspace and links repos via two tRPC mutations (`bulkLinkGitHubRepositories`, `bulkLinkVercelProjects`) — both are pure DB writes with no outbound calls to backfill or gateway.

The gateway currently plays **no role** in triggering backfill. It only receives backfill-sourced events (as the internal service auth path in `POST /api/webhooks/:provider`) and relays them to console via QStash.

---

## Detailed Findings

### 1. Current Backfill Trigger Location

**File**: `apps/connections/src/lib/urls.ts:59-80`

```ts
export async function notifyBackfillService(params: {
  installationId: string;
  provider: string;
  orgId: string;
}): Promise<void> {
  await getClient().publishJSON({
    url: `${backfillUrl}/trigger`,
    headers: { "X-API-Key": env.GATEWAY_API_KEY },
    body: params,
    retries: 3,
    deduplicationId: `backfill:${params.provider}:${params.installationId}:${params.orgId}`,
  });
}
```

- Transport: QStash fire-and-forget
- Target: `https://backfill.lightfast.ai/api/trigger` (prod), `http://localhost:4109/api/trigger` (dev)
- Auth: `X-API-Key` header using `GATEWAY_API_KEY`
- Deduplication: QStash `deduplicationId` = `backfill:{provider}:{installationId}:{orgId}`

**Call sites** (all inside provider `handleCallback`):

| File | Line | Condition |
|---|---|---|
| `apps/connections/src/providers/impl/github.ts` | 187 | Only if `!reactivated && !isPendingRequest` |
| `apps/connections/src/providers/impl/linear.ts` | 361 | Only if `!reactivated` |
| `apps/connections/src/providers/impl/vercel.ts` | 139 | Always (no guard) |
| `apps/connections/src/providers/impl/sentry.ts` | 208 | Always (no guard) |

The `reactivated` flag is set to `true` when a row already exists in `gwInstallations` for the same `(provider, externalId)` pair.

---

### 2. What the `/new` Page Currently Does

**File**: `apps/console/src/app/(app)/(user)/new/page.tsx`

The new page is a server component that prefetches connection status (`connections.github.list`, `connections.vercel.list`, `connections.sentry.get`) and renders client islands.

**`create-workspace-button.tsx`** — the mutation chain on "Create workspace":

1. `workspaceAccess.create` (`api/console/src/router/user/workspace.ts:94`) — creates the workspace row in `lightfast_org_workspaces`. No backfill, no Inngest backfill event. Sends one Inngest `"apps-console/activity.record"` event only.
2. `workspace.integrations.bulkLinkGitHubRepositories` (`workspace.ts:1107`) — bulk inserts into `lightfast_workspace_integrations`. **Pure DB write, no backfill.**
3. `workspace.integrations.bulkLinkVercelProjects` (`workspace.ts:1251`) — same pattern for Vercel. **Pure DB write, no backfill.**

Steps 2 and 3 run in `Promise.allSettled` after step 1 completes.

---

### 3. Gateway's Role Today

**File**: `apps/gateway/src/routes/webhooks.ts`

The gateway has **two paths** on `POST /api/webhooks/:provider`:

**Path A — Internal service auth** (when `X-API-Key` is present, line 40):
- Used by the backfill entity worker to submit historical provider events
- Skips HMAC verification, skips connection resolution (caller provides `connectionId` + `orgId`)
- Deduplicates via Redis `SET NX`, then publishes `WebhookEnvelope` directly to console via QStash

**Path B — External HMAC** (line 103):
- Used by real provider webhooks (GitHub, Vercel, Linear, Sentry)
- Verifies HMAC signature, resolves `connectionId` + `orgId` from `gwResources` table, triggers Upstash durable workflow

**The gateway does not expose any endpoint for triggering backfill today.** There is no `/api/backfill` or `/api/trigger` route on the gateway.

---

### 4. Backfill Service HTTP Interface

**File**: `apps/backfill/src/routes/trigger.ts`

```
POST /api/trigger
  X-API-Key: <GATEWAY_API_KEY>
  Body: { installationId, provider, orgId, depth?: 7|30|90, entityTypes?: string[] }
  → inngest.send("apps-backfill/run.requested")

POST /api/trigger/cancel
  X-API-Key: <GATEWAY_API_KEY>
  Body: { installationId }
  → inngest.send("apps-backfill/run.cancelled")
```

---

### 5. Backfill Orchestrator Scoping

**File**: `apps/backfill/src/workflows/backfill-orchestrator.ts`

The orchestrator is scoped at three levels:

1. **Per `installationId`** — concurrency limit of 1 (prevents duplicate backfills per connection)
2. **Per resource × entityType ("work unit")** — each entity worker handles one repo × one entity type (e.g. `github-repo-123` × `pull_request`)
3. **Per `orgId`** — entity worker concurrency capped at 5 per org

The orchestrator fetches connection resources from the connections service:
```
GET ${connectionsUrl}/connections/${installationId}
→ { resources: [{ providerResourceId, resourceName }], status, orgId, ... }
```

It then fans out one `entity-worker` per `resource × entityType` pair.

The entity worker fetches a token, paginates provider data, and POSTs each page's events to:
```
POST ${gatewayUrl}/webhooks/${provider}   ← gateway internal service auth path
```

---

### 6. Key Observation: Backfill is Per-Installation, Not Per-Workspace-Link

Today the backfill fires at the `installationId` level (= the GitHub App installation or Vercel OAuth grant). This is the _provider connection_ scoped to an org. It is **not scoped to a workspace** or a specific set of linked repositories.

When a user installs the GitHub App for org `acme`, backfill fires for `installationId=abc`. The orchestrator fetches all `resources` (repos) registered under that connection, and runs entity workers for all of them — regardless of which workspace they are linked to.

`workspace.integrations.bulkLinkGitHubRepositories` only creates rows in `lightfast_workspace_integrations` — a join table linking repos to workspaces. It does not interact with backfill at all.

---

## Architecture Documentation

### Current Flow (Connection Phase)

```
User installs GitHub App
        ↓
GET /callback (apps/connections)
        ↓
gwInstallations upsert (DB)
        ↓
notifyBackfillService() — QStash → POST /api/trigger (apps/backfill)
        ↓
inngest.send("apps-backfill/run.requested")
        ↓
backfillOrchestrator — fetches resources from connections service
        ↓
fans out entity-workers (one per resource × entityType)
        ↓
entity-worker pages provider API → POSTs to gateway webhook path
        ↓
gateway → QStash → console /api/webhooks/ingress
```

### Proposed New Flow (Workspace Creation Phase)

```
User fills /new page, clicks "Create workspace"
        ↓
workspaceAccess.create (tRPC) → workspace created in DB
        ↓
bulkLinkGitHubRepositories / bulkLinkVercelProjects → workspace_integrations rows created
        ↓
[NEW] trigger backfill via gateway → POST /api/backfill (gateway)
        ↓  (gateway forwards to backfill service or directly calls it)
POST /api/trigger (apps/backfill) — with specific repo list
        ↓
inngest.send("apps-backfill/run.requested") — scoped to linked repos only
```

---

## Design Discussion

### Option 1: Shared Per-Repo Data Stream (Long-Term)

**Concept**: Backfill is scoped at the `(provider, providerResourceId)` level — i.e., per repo. If `repoX` is already backfilled, any workspace that links `repoX` shares that data. A new workspace connecting `repoX` does not re-run backfill.

**Implications for the current system**:
- The orchestrator would need a "already backfilled?" check before dispatching entity workers for a given `providerResourceId`
- A new table (or Redis key) would track `(provider, providerResourceId, entityType) → backfill_status`
- The connections service currently returns `resources` as all repos under an installation — the orchestrator would skip ones already done
- `cancelBackfillService` (called on connection teardown) would need to be careful not to cancel if another workspace still uses the repo

**What this requires beyond the current system**:
- A backfill-state tracking table or Redis keys (e.g. `bf:done:{provider}:{resourceId}:{entityType}`)
- New check in orchestrator before fan-out
- New endpoint or tRPC procedure to query backfill status per resource

**Maintenance profile**: Low long-term — each repo is only ever processed once. But requires more infrastructure upfront.

---

### Option 2: Per-Connection Backfill (Current Approach, Shifted to /new Page)

**Concept**: Every time a user links a new set of repos in `/new`, trigger a fresh backfill. The current orchestrator already handles deduplication at the `installationId` level (concurrency=1). Entity workers are idempotent because the gateway deduplicates by `deliveryId` via Redis `SET NX`.

**What changes**:
- Remove `notifyBackfillService` calls from `apps/connections` provider callbacks
- Add a backfill trigger call in `create-workspace-button.tsx` after `bulkLinkGitHubRepositories` resolves
- Route that call through the gateway (new endpoint on gateway that proxies to backfill) or directly from the tRPC router

**What stays the same**:
- No schema changes needed
- Orchestrator unchanged
- Entity worker unchanged
- Gateway internal webhook path unchanged

**Maintenance profile**: Higher — every workspace creation re-backfills all repos under the installation. But if `entityTypes` is scoped to the specific linked repos, it's bounded. The gateway dedup (`SET NX` + `deduplicationId`) prevents duplicates landing in console.

---

### Routing Through Gateway

Today backfill is triggered by connections → QStash → backfill directly. The user wants to route through gateway instead.

**Gateway currently has no `/api/backfill` route**. Adding one would look like:

```
POST /api/backfill (gateway)
  Auth: user's session JWT or internal tRPC auth
  Body: { installationId, provider, orgId, repos?: string[], depth?: number }
        ↓
  Gateway validates, then calls POST /api/trigger on backfill
```

This gives gateway a single outbound integration point for backfill, keeping `GATEWAY_API_KEY` + the backfill trigger contract in one place.

Alternatively, the tRPC `bulkLinkGitHubRepositories` router could call the gateway's new route directly, since it already uses `connectionsUrl` for the connections service proxy pattern.

---

## Code References

- `apps/connections/src/lib/urls.ts:59-80` — `notifyBackfillService`, current trigger
- `apps/connections/src/providers/impl/github.ts:185-192` — GitHub trigger call site
- `apps/connections/src/providers/impl/vercel.ts:138-148` — Vercel trigger call site
- `apps/connections/src/providers/impl/linear.ts:360-365` — Linear trigger call site
- `apps/connections/src/providers/impl/sentry.ts:208-213` — Sentry trigger call site
- `apps/backfill/src/routes/trigger.ts:40-82` — backfill HTTP trigger endpoint
- `apps/backfill/src/workflows/backfill-orchestrator.ts:8-209` — orchestrator (concurrency, fan-out, wait)
- `apps/backfill/src/workflows/entity-worker.ts:9-279` — entity worker (pagination, dispatch to gateway)
- `apps/gateway/src/routes/webhooks.ts:40-101` — internal service auth path (receives backfill events)
- `apps/gateway/src/app.ts:41-43` — route mounts (no backfill trigger route today)
- `apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx:172-235` — workspace creation mutation chain
- `api/console/src/router/org/workspace.ts:1107-1243` — `bulkLinkGitHubRepositories` (pure DB write)
- `api/console/src/router/org/workspace.ts:1251-1388` — `bulkLinkVercelProjects` (pure DB write)

---

## Open Questions

1. **Granularity**: When backfill is triggered from `/new`, should it pass the specific list of linked repo IDs (scoping the orchestrator to only those repos) or the full `installationId` (letting the orchestrator discover all repos)? The trigger schema supports `entityTypes` but not a repo filter today.

2. **Gateway route design**: Should the gateway expose `POST /api/backfill/trigger` as an authenticated route (API key or session-scoped), or should the tRPC router call the backfill service directly (as connections does today via QStash)?

3. **What happens to existing connections?** Users who already completed OAuth before this change have `gwInstallations` rows but no backfill triggered from `/new`. Is a migration/re-trigger needed?

4. **Option 1 feasibility for prod**: The shared-stream model requires tracking backfill completion state per repo. Is there an acceptable MVP version — e.g., check via Redis key before triggering — that could be layered on top of Option 2 without a full redesign?

5. **Vercel and Sentry**: These providers have no `reactivated` guard today (they re-trigger backfill on every re-auth). Removing the connection-phase trigger eliminates this inconsistency.
