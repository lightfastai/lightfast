---
date: 2026-03-16T00:00:00+11:00
researcher: claude
git_commit: e14f0a0c5a66d7e16a939242631fef9f886e9b9c
branch: fix/webhook-urls-direct-relay
repository: lightfast
topic: "Connection Status State Machine — Current Implementation"
tags: [research, codebase, gateway, relay, state-machine, connections, webhooks, github, vercel]
status: complete
last_updated: 2026-03-16
---

# Research: Connection Status State Machine — Current Implementation

**Date**: 2026-03-16
**Git Commit**: `e14f0a0c5a66d7e16a939242631fef9f886e9b9c`
**Branch**: `fix/webhook-urls-direct-relay`

## Research Question

Research the full implementation of connection status state machine in the lightfast gateway.

Context: `gatewayInstallations` table has a `status` varchar field (`active|pending|error|revoked`). Planning to expand to: `active | pending | suspended | disconnected | error`.

Research questions:
1. Where does the GitHub App currently handle `installation` webhook events?
2. How does the gateway handle connection teardown (Upstash Workflow)?
3. What is the current `revoked` state — where is it set and by whom?
4. Where are all the places `status` is read?
5. How should the `installation` webhook handler be wired?
6. What does the Vercel `integration-configuration.removed` event look like — is there already a handler?
7. Are there any existing state transition guards?

---

## Summary

The current state machine is binary: everything is either `"active"` or not. There is no formal transition table — guards are inline `!== "active"` checks; writes are unconditional `WHERE id = X` updates. Two provider-initiated lifecycle events (`installation.deleted/suspend/unsuspend` for GitHub; `integration-configuration.removed` for Vercel) are subscribed but silently DLQ'd today because the relay's connection-resolution step cannot match installation-level resource IDs. All teardown is currently UI-initiated via a single gateway `DELETE` endpoint.

---

## Detailed Findings

### 1. DB Schema — `gatewayInstallations.status`

**File**: `db/console/src/schema/tables/gateway-installations.ts:34`

```typescript
status: varchar("status", { length: 50 }).notNull(), // active|pending|error|revoked
```

- `varchar(50)` with no database-level CHECK constraint or enum type
- Four values documented in an inline comment: `active | pending | error | revoked`
- **`pending` is never written to the DB** — only appears as a Redis polling-response field during OAuth
- TypeScript wire type is `z.string()` (open string, not constrained) — `packages/console-providers/src/gateway.ts:80`
- `@repo/gateway-types` does not exist as a standalone package; connection types live in `@repo/console-providers`

**Indexes** (`gateway-installations.ts:69–82`):
- `UNIQUE INDEX` on `(provider, external_id)` — makes OAuth callback upsert idempotent
- `INDEX` on `(org_id)`, `(org_id, provider)`, `(connected_by)`

**Related tables**:
- `gatewayResources.status`: `varchar(50)`, values `active | removed`
- `gatewayWebhookDeliveries.status`: tracks per-delivery pipeline state (`received | dlq | ...`)

**Drizzle relations** (`db/console/src/schema/relations.ts:21–28`):
- `gatewayInstallations` → many `gatewayTokens`, many `gatewayResources`, many `workspaceIntegrations`

---

### 2. GitHub App `installation` Webhook — Current Handling

**Subscribed events** (`apps/gateway/integration-specs.json:28–33`):
```json
"events": ["installation", "meta", "pull_request", "issues"]
```
The `installation` event is registered at the GitHub App platform level.

**What happens today** (end-to-end):

```
GitHub → POST /api/webhooks/github (relay)
  → 7-step middleware (providerGuard → signatureVerify → payloadParseAndExtract)
  → extractEventType: headers.get("x-github-event") = "installation"
  → extractResourceId: payload.installation.id (e.g., "12345678")
  → Upstash workflow triggered → returns 200 immediately

webhook-delivery workflow (relay/src/routes/workflows.ts):
  Step 1: dedup — Redis SET NX passes
  Step 2: persist — gatewayWebhookDeliveries, status="received", eventType="installation"
  Step 3: resolve-connection
    → Redis cache lookup: resource:github:12345678 → MISS
    → DB lookup: gatewayResources.providerResourceId = "12345678" → MISS
      (providerResourceId stores repo IDs, not installation IDs)
    → connectionInfo = null
  Step 3b: DLQ — QStash "webhook-dlq" topic; status → "dlq"
```

**Root cause of DLQ**: The relay's connection-resolution step (`workflows.ts:100–116`) queries `gatewayResources.providerResourceId` to find the org/connection. GitHub installation IDs are stored in `gatewayInstallations.externalId`, not in `gatewayResources`. The resource cache and DB fallback both miss.

**No handler exists** for any `installation` action (`deleted`, `suspend`, `unsuspend`). The `console-providers` GitHub event map (`providers/github/index.ts:93–118`) only contains two keys: `pull_request` and `issues`. Even if connection resolution were fixed, `transformWebhookPayload` would return `null` for `installation` events.

**No gateway lifecycle handler**: `apps/gateway/src/routes/connections.ts` has no route that receives or processes `installation` webhook events. The teardown workflow is triggered only by explicit `DELETE /:provider/:id`.

---

### 3. Gateway Teardown — Upstash Workflow

**Trigger**: `DELETE /:provider/:id` (`apps/gateway/src/routes/connections.ts:925–958`)
- Protected by `apiKeyAuth` (internal only)
- Documented caller: `console tRPC (org/connections.disconnect)`
- Fetches installation row to validate existence; returns 404 if not found
- Calls `workflowClient.trigger()` with `{ installationId, provider, orgId }` payload
- Returns `{ status: "teardown_initiated" }` immediately — does not wait for workflow

**Workflow** (`apps/gateway/src/workflows/connection-teardown.ts:38–147`):

| Step | Name | What it does |
|------|------|--------------|
| 1 | `cancel-backfill` | QStash POST to `${backfillUrl}/trigger/cancel` with `{ installationId }`. Best-effort, errors swallowed. |
| 2 | `revoke-token` | Skips GitHub (no stored token). Fetches encrypted token from `gatewayTokens`, decrypts, calls `providerDef.oauth.revokeToken`. Best-effort. |
| 3 | `cleanup-cache` | Queries `gatewayResources WHERE status = "active"` for the installation. Bulk-deletes Redis keys `gw:resource:{provider}:{resourceId}`. |
| 4 | `soft-delete` | `db.batch()`: sets `gatewayInstallations.status = "revoked"` + `gatewayResources.status = "removed"`. |

**No status guard before triggering**: `DELETE /:provider/:id` accepts any current status — will teardown an already-revoked installation.

**Step 4 is unconditional**: `WHERE id = installationId` only, no `WHERE status = 'active'` guard on the UPDATE.

---

### 4. `revoked` State — All Write Sites

| # | File | Line | Value | Trigger |
|---|------|------|-------|---------|
| 1a | `apps/gateway/src/routes/connections.ts` | 325 | `"active"` | OAuth callback INSERT |
| 1b | `apps/gateway/src/routes/connections.ts` | 334 | `"active"` | OAuth callback `onConflictDoUpdate` (reinstall/reactivation) |
| 2 | `apps/gateway/src/workflows/connection-teardown.ts` | 128 | `"revoked"` | Upstash Workflow step 4 — triggered by gateway `DELETE /:provider/:id` |
| 3 | `api/console/src/router/org/connections.ts` | 128 | `"revoked"` | tRPC `connections.disconnect` — direct DB write, no workflow |
| 4 | `api/console/src/router/org/connections.ts` | 449 | `"revoked"` | tRPC `connections.vercel.disconnect` — scoped by `provider = "vercel"`, no workflow |
| 5 | `api/console/src/router/org/connections.ts` | 577 | `"error"` | tRPC `connections.generic.listResources` — inline on HTTP 401 from proxy |

**`"pending"`**: Never written to `gatewayInstallations` in any production code path. The OAuth polling endpoint (`connections.ts:170`) writes `{ status: "pending" }` to a Redis hash, not the database.

**`"error"`**: Only one write site — during resource listing when the provider returns 401. There is no automated recovery path from `"error"`.

**Two disconnect paths**: Write sites 2–4 show two parallel paths to `"revoked"`:
- **Durable path** (workflow): cancels backfill, revokes token, cleans Redis, then soft-deletes
- **Direct path** (tRPC writes 3+4): sets `"revoked"` in DB only, no backfill cancellation, no token revocation, no Redis cleanup

---

### 5. Status Read Sites

#### tRPC Routers (`api/console/src/router/org/`)

All queries filter at the SQL level using `eq(gatewayInstallations.status, "active")`:

| Procedure | File:Line | Behavior if not active |
|-----------|-----------|------------------------|
| `connections.list` | `connections.ts:91` | Row excluded from results |
| `connections.github.validate` | `connections.ts:202` | `TRPCError NOT_FOUND` |
| `connections.generic.listInstallations` | `connections.ts:490` | Returns `installations: []` |
| `connections.generic.listResources` | `connections.ts:553` | `TRPCError NOT_FOUND` |
| `workspace.create` (backfill trigger) | `workspace.ts:224` | Installation not backfilled |

#### Gateway Routes (`apps/gateway/src/routes/connections.ts`)

| Route | Line | Guard | Response |
|-------|------|-------|----------|
| `GET /:id/token` | 653 | `!== "active"` | HTTP 400 `installation_not_active` |
| `POST /:id/proxy/execute` | 776 | `!== "active"` | HTTP 400 `installation_not_active` |
| `POST /:id/resources` | 983 | `!== "active"` | HTTP 400 `installation_not_active` |
| `GET /:id` | 499 | none | Returns `status` verbatim in JSON |

Note: `GET /:id` returns any status unchanged — callers perform their own guards.

#### Backfill Orchestrator (`apps/backfill/src/workflows/backfill-orchestrator.ts:70–74`)

```typescript
if (conn.status !== "active") {
  throw new NonRetriableError(
    `Connection is not active: ${installationId} (status: ${conn.status})`
  );
}
```

`NonRetriableError` causes Inngest to fail immediately without retrying. Entity workers (`entity-worker.ts`) do not re-check status — they call `gw.executeApi` which hits `POST /:id/proxy/execute`, which guards at line 776.

#### Relay (`apps/relay/src/routes/`)

The relay has **no reads on `gatewayInstallations.status`**. It only reads `gatewayResources.status = "active"` for:
- Webhook connection routing (`workflows.ts:113`)
- Cache rebuild (`admin.ts:84`)

#### UI (`apps/console/src/`)

UI reads are indirect — the server returns only active installations via SQL filtering:

| Component | File | Display logic |
|-----------|------|---------------|
| Settings sources list | `settings/sources/_components/sources-list.tsx:42–90` | `connection` truthy → "Connected" + Disconnect button; falsy → "Not connected" + Connect button |
| New source picker | `sources/new/_components/provider-source-item.tsx:96, 235–243` | `installations.length > 0` → "Connected" badge + resource picker |

The `isActive` field returned by `connections.list` is hardcoded `true` in the tRPC router — it is always `true` because the query only returns active rows.

---

### 6. Vercel `integration-configuration.removed` — Current Handling

**Subscribed** in `apps/gateway/integration-specs.json:85`.

**What happens today**:

```
Vercel → POST /api/webhooks/vercel (relay)
  → HMAC-SHA1 verification (x-vercel-signature against VERCEL_CLIENT_INTEGRATION_SECRET)
  → extractEventType: payload.type = "integration-configuration.removed"
  → extractResourceId: payload.payload.project.id → null (not present in this event type)
  → Upstash workflow triggered

webhook-delivery workflow:
  Step 1: dedup — passes
  Step 2: persist — gatewayWebhookDeliveries, status="received"
  Step 3: resourceId is null → connectionInfo = null (skip DB/Redis lookup entirely)
  Step 3b: DLQ — published to "webhook-dlq" topic; status → "dlq"
```

**Root cause**: `extractResourceId` for Vercel reads `payload.payload.project.id` (deployment-level field). `integration-configuration.removed` does not carry a project-level resource ID in the same position.

**No teardown triggered**: The event reaches the DLQ without triggering the `connection-teardown` workflow. The current gateway has no path from provider-webhook → teardown.

**`integration-configuration.removed` in accountInfo**: The string appears in `vercel/index.ts:354` inside the `accountInfo.events` array set during OAuth callback. This is informational metadata stored in `gatewayInstallations.providerAccountInfo` — it is not read anywhere in processing.

---

### 7. State Transition Guards

**No state machine exists today.** Status transitions are not encoded with explicit allowed-from/allowed-to rules.

**Guards by type**:

| Type | Location | Condition |
|------|----------|-----------|
| Read block (operation rejected) | `connections.ts:653, 776, 983` | `installation.status !== "active"` → HTTP 400 |
| NonRetriable error | `backfill-orchestrator.ts:70` | `conn.status !== "active"` |
| SELECT filter | `connections.ts:487, 1001–1011` | `eq(gatewayResources.status, "active")` |
| SELECT filter | `connection-teardown.ts:108–112` | `eq(gatewayResources.status, "active")` |
| SELECT filter | `relay/workflows.ts:113` | `eq(gatewayResources.status, "active")` |
| Idempotency check | `connections.ts:1093` | `resource.status === "removed"` → HTTP 400 |

**No optimistic-locking on writes**: Status updates use `WHERE id = X` only — no `WHERE id = X AND status = 'current_status'` pattern anywhere.

**No middleware-level guard**: `apps/gateway/src/middleware/` contains no connection-status middleware. All guards are inline within individual route handlers.

**OAuth callback reactivation**: The upsert at `connections.ts:325–341` always writes `status: "active"` via `onConflictDoUpdate`, regardless of prior status. A `revoked` installation can be reactivated by completing the OAuth flow again — the handler detects this via a pre-check at lines 304–315 (sets a `reactivated` flag in Redis and redirect URL) but does not block the upsert.

---

## Code References

- `db/console/src/schema/tables/gateway-installations.ts:34` — status column definition
- `db/console/src/schema/tables/gateway-installations.ts:69–82` — indexes
- `db/console/src/schema/relations.ts:21–28` — Drizzle relations
- `apps/gateway/integration-specs.json:28–33` — GitHub subscribed events (including `installation`)
- `apps/gateway/integration-specs.json:85` — Vercel `integration-configuration.removed` subscription
- `apps/gateway/src/routes/connections.ts:65` — route definitions start
- `apps/gateway/src/routes/connections.ts:325,334` — `"active"` write on OAuth callback
- `apps/gateway/src/routes/connections.ts:653` — token endpoint status guard
- `apps/gateway/src/routes/connections.ts:776` — proxy execute status guard
- `apps/gateway/src/routes/connections.ts:925–958` — teardown trigger (`DELETE /:provider/:id`)
- `apps/gateway/src/routes/connections.ts:983` — resource link status guard
- `apps/gateway/src/workflows/connection-teardown.ts:38–147` — full 4-step teardown workflow
- `apps/gateway/src/workflows/connection-teardown.ts:128` — `"revoked"` write
- `apps/relay/src/routes/webhooks.ts:46` — single parameterized webhook POST route
- `apps/relay/src/routes/workflows.ts:40–250` — webhook-delivery durable workflow
- `apps/relay/src/routes/workflows.ts:84–135` — connection resolution step (resource lookup)
- `apps/relay/src/routes/workflows.ts:163–194` — DLQ fallback
- `apps/backfill/src/workflows/backfill-orchestrator.ts:68–82` — active status guard
- `api/console/src/router/org/connections.ts:91` — `connections.list` active filter
- `api/console/src/router/org/connections.ts:128` — `connections.disconnect` direct `"revoked"` write
- `api/console/src/router/org/connections.ts:449` — `connections.vercel.disconnect` direct `"revoked"` write
- `api/console/src/router/org/connections.ts:577` — `"error"` write on 401
- `packages/console-providers/src/providers/github/index.ts:93–118` — GitHub events map (pull_request + issues only)
- `packages/console-providers/src/providers/vercel/index.ts:251–277` — Vercel extractEventType + extractResourceId
- `packages/console-providers/src/gateway.ts:72–86` — `GatewayConnection` schema (`status: z.string()`)

---

## Architecture Documentation

### Current State Machine (implicit)

```
[any] ──OAuth callback──→ active
active ──DELETE/:id + workflow──→ revoked
active ──tRPC disconnect──→ revoked   (direct DB write, no workflow)
active ──401 on listResources──→ error
```

`pending`, `suspended`, `disconnected` do not exist as DB values today.

### Where the Binary `active` / not-active Split Exists

Every read-site tests `=== "active"` or `!== "active"`. This means adding `suspended` and `disconnected` as additional non-active states would naturally flow through all existing guards without code changes — those endpoints would return the same `installation_not_active` errors or exclude the row from query results. The UI derives connection presence from the tRPC query returning a row at all (no row = no connection).

### Webhook Lifecycle Gap

Both GitHub `installation` events and Vercel `integration-configuration.removed` arrive at the relay, pass HMAC verification, and are DLQ'd. Neither triggers a connection status change. The teardown workflow has no inbound webhook path — only the explicit UI-initiated `DELETE /:provider/:id` call triggers it.

### Two Disconnect Paths

| Path | Files | Runs teardown workflow? |
|------|-------|------------------------|
| UI disconnect → tRPC `connections.disconnect` → direct DB | `api/console/src/router/org/connections.ts:126–135` | No |
| UI disconnect → tRPC → `DELETE /gateway/:provider/:id` → workflow | `connections.ts:947` + `connection-teardown.ts` | Yes |

Based on write sites 3+4, the tRPC `connections.disconnect` and `connections.vercel.disconnect` procedures write `"revoked"` directly without calling the gateway endpoint or triggering the workflow. Only the gateway `DELETE /:provider/:id` triggers the 4-step durable workflow.

---

## Open Questions

1. **Installation webhook routing**: Should `installation.deleted/suspend/unsuspend` be handled in relay (routing layer) or gateway (connection lifecycle owner)? Relay would need to look up by `gatewayInstallations.externalId` instead of `gatewayResources.providerResourceId`. Gateway would need a new inbound webhook route.

2. **tRPC disconnect duality**: Why do `connections.disconnect` and `connections.vercel.disconnect` write `"revoked"` directly without going through the gateway workflow? Should the tRPC procedures call `DELETE /gateway/:provider/:id` to ensure the full teardown chain runs?

3. **`"error"` recovery**: There is no automated or manual path to go from `"error"` back to `"active"` without a full reconnect via OAuth. Is this intentional?

4. **`"pending"` in DB**: The schema documents `pending` as a valid status but nothing writes it to the DB. Should the OAuth callback write `pending` initially and `active` only after token exchange completes, or should `pending` remain Redis-only?

5. **`gatewayInstallations.externalId` for webhook routing**: The relay's resource-resolution step uses `gatewayResources.providerResourceId`. For installation-level events (GitHub `installation`, Vercel `integration-configuration`), a new resolution path against `gatewayInstallations.externalId` would be needed.
