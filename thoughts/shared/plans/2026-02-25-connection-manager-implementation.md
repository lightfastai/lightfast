---
date: 2026-02-25
author: Claude Opus 4.6
status: active
revision: 2
revised: 2026-02-25
research: thoughts/shared/research/2026-02-25-webhook-connection-manager-architecture.md
tags: [plan, gateway, webhooks, oauth, hono, upstash, turso, architecture]
---

# Gateway Service: Implementation Plan (Revised)

## Overview

A standalone Hono service (`apps/gateway/`) deployed as its own Vercel project at `gateway.lightfast.ai`. The Gateway owns the complete connection lifecycle (OAuth setup, token storage, token refresh, teardown) and webhook receipt with 100% deliverability via QStash. Console becomes a consumer of verified, delivered webhooks and requests tokens from the Gateway when it needs to call provider APIs.

### Architecture Deviation from Original Plan

The original plan specified Redis as the primary data store with PlanetScale (via Console write-through) as source of truth. The actual implementation uses **Turso (libSQL) as the Gateway's own database** with Redis as a routing cache only. This is a stronger design — the Gateway owns its own persistence without depending on Console for data integrity.

Key differences:
- **Turso DB** (`@db/gateway`) with four tables: `gw_installations`, `gw_tokens`, `gw_resources`, `gw_webhook_deliveries`
- **Redis** is used only for: OAuth state (10-min TTL), webhook dedup (24h TTL), and resource→connection routing cache
- **Connection lifecycle** is synchronous in route handlers (not Upstash Workflow-based) — simpler, same durability since Turso is the source of truth
- **Token refresh** is inline in the token vault endpoint (lazy refresh on access, not scheduled proactive refresh)
- **Edge runtime** — all code uses Web Crypto API, `@libsql/client/web`, no Node.js-specific APIs
- **`@repo/gateway-types`** package provides shared type definitions (provider enums, interfaces, webhook payload shapes) consumed by both `apps/gateway` and `@db/gateway`

### Current Data Flow

```
Provider (GitHub, Vercel, Linear, Sentry)
        │
        ▼
POST /webhooks/:provider  ←── thin Hono route (verify sig, extract IDs)
        │
        ▼
WorkflowClient.trigger()  ←── kicks off durable workflow
        │
        ▼
QStash → POST /workflows/webhook-receipt  ←── serve() endpoint
                    │
        ┌───────────▼──────────────┐
        │  Step 1: dedup (Redis)   │ ← skipped on retry
        │  Step 2: resolve-conn    │ ← Redis cache → Turso fallback
        │  Step 3: publish/dlq     │ ← QStash → Console ingress
        └──────────────────────────┘
                    │
                    ▼
Console /api/webhooks/ingress  ←── ❌ NOT YET BUILT
```

---

## What We're NOT Doing

- **No shadow mode / dual running** — big bang cutover after thorough testing
- **No backfill connectors for Linear/Sentry** — they'll be added later via `@repo/console-backfill`
- **No transformer migration** — transformers stay in Console's `@repo/console-webhooks`; Gateway sends raw payloads, Console ingress transforms before dispatching to Inngest
- **No microfrontends integration** — Gateway is a separate Vercel project
- **No changes to Inngest workflow internals** — existing sync/backfill/observation pipelines keep their shape; only their trigger source (ingress) and token source (vault) change
- **No custom monitoring stack** — rely on Upstash dashboards and Vercel function logs

---

## Completed Phases

### Phase 1: Foundation & Infrastructure ✅

**Package**: `@vendor/qstash` — wraps `@upstash/qstash` (Client, Receiver, env validation)
**Package**: `@repo/gateway-types` — shared provider enums, `ConnectionProvider<T>`, `WebhookRegistrant<T>`, `WebhookReceiptPayload`
**Package**: `@db/gateway` — Turso/Drizzle ORM with 4 tables, cascading FKs, proper indexes
**App**: `apps/gateway/` — Hono app with 4 route groups (`/webhooks`, `/connections`, `/admin`, `/workflows`)
**Middleware**: `apiKeyAuth` (X-API-Key), `tenantMiddleware` (X-Org-Id extraction)
**Lib**: `crypto.ts` (Web Crypto AES-GCM + HMAC), `keys.ts` (7 Redis key factories), `github-jwt.ts` (RS256 JWT for GitHub App), `base-url.ts`, `secrets.ts`, `related-projects.ts` (@vercel/related-projects for Console URL)

### Phase 2: Provider Implementations ✅

All four providers implement `ConnectionProvider<TPayload>`:

| Provider | Webhook Sig | Registration | Token Refresh | OAuth |
|----------|-------------|--------------|---------------|-------|
| GitHub | HMAC-SHA256 (`x-hub-signature-256`) | No (App config) | N/A (installation tokens) | GitHub App install flow |
| Vercel | HMAC-SHA1 (`x-vercel-signature`) | No (integration config) | No (long-lived) | Vercel integration OAuth |
| Linear | HMAC-SHA256 (`linear-signature`) | Yes (GraphQL mutation) | No (long-lived) | Standard OAuth2 |
| Sentry | HMAC-SHA256 (`sentry-hook-signature`) | Yes (returns static ID) | Yes (full refresh flow) | Sentry App install OAuth |

Provider registry at `src/providers/index.ts` with type-narrowing `getProvider<N>(name)` overload.
Zod payload schemas at `src/providers/schemas.ts` for all providers.

### Phase 3: Webhook Receipt Pipeline ✅

**Route** (`src/routes/webhooks.ts`): Thin verification layer. Verifies provider signature, parses payload via Zod, extracts `deliveryId`/`eventType`/`resourceId`, triggers durable workflow, returns 200 ACK.

**Workflow** (`src/workflows/webhook-receipt.ts`): 3-step durable pipeline via `@vendor/upstash-workflow/hono`:
1. **Dedup**: Redis `SET NX` with 24h TTL
2. **Resolve connection**: Redis cache → Turso fallback (auto-populates cache on miss)
3. **Publish**: QStash → `consoleUrl/api/webhooks/ingress` (5 retries, dedup ID) or DLQ topic

### Phase 5: Connection Lifecycle ✅ (Synchronous)

Implemented as direct route handlers in `src/routes/connections.ts` (627 lines), not Upstash Workflows:

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /connections/:provider/authorize` | Tenant (X-Org-Id) | Generate OAuth state → Redis, return auth URL |
| `GET /connections/:provider/callback` | None (OAuth redirect) | Validate state, exchange code, store installation + encrypted tokens, register webhook if needed |
| `GET /connections/:id/token` | API Key | Token vault — GitHub: on-demand JWT, Others: decrypt (+ lazy refresh if expired) |
| `GET /connections/:id` | API Key | Connection details with resources |
| `DELETE /connections/:provider/:id` | API Key | Teardown — revoke token, deregister webhook, clean Redis, soft-delete |
| `POST /connections/:id/resources` | API Key | Link resource, populate Redis routing cache |
| `DELETE /connections/:id/resources/:resourceId` | API Key | Unlink resource, remove Redis cache |

### Phase 9: Admin & Cache Management ⚠️ Partial

| Endpoint | Status |
|----------|--------|
| `GET /admin/health` | ✅ Checks Redis + Turso |
| `POST /admin/cache/rebuild` | ✅ Rebuilds Redis from Turso |
| `GET /admin/dlq` | ✅ Queries `gw_webhook_deliveries` where status = "dlq" |
| `POST /admin/dlq/replay` | ❌ Stub — returns `not_yet_implemented` |
| `POST /admin/delivery-status` | ❌ Stub — logs and returns `received` |

---

## Remaining Phases

### Phase 4: Console Webhook Ingress

#### Overview

Build the Console endpoint that receives QStash-delivered webhooks from the Gateway and dispatches them to existing Inngest workflows. This is the critical integration bridge — without it, the Gateway can receive and verify webhooks but has nowhere to deliver them.

The Gateway's webhook-receipt workflow already publishes to `consoleUrl/api/webhooks/ingress` (see `src/workflows/webhook-receipt.ts:113`). The envelope it sends:

```typescript
{
  deliveryId: string
  connectionId: string   // gw_installations.id
  orgId: string          // Clerk org ID
  provider: "github" | "vercel" | "linear" | "sentry"
  eventType: string      // e.g. "push", "deployment.created", "Issue:create"
  payload: unknown       // raw provider webhook payload
  receivedAt: number     // Unix timestamp ms
}
```

#### Changes Required

##### 4.1. WebhookEnvelope Type

**File**: `packages/gateway-types/src/webhooks.ts`

Add `WebhookEnvelope` interface alongside the existing `WebhookReceiptPayload`. The `WebhookReceiptPayload` is Gateway-internal (route→workflow), while `WebhookEnvelope` is the Gateway→Console contract:

```typescript
export interface WebhookEnvelope {
  deliveryId: string
  connectionId: string
  orgId: string
  provider: ProviderName
  eventType: string
  payload: unknown
  receivedAt: number
}
```

Re-export from `packages/gateway-types/src/index.ts`.

##### 4.2. Console Ingress Endpoint

**File**: `apps/console/src/app/api/webhooks/ingress/route.ts`

Uses `serve()` from `@vendor/upstash-workflow/nextjs` for step-level durability. QStash signature verification is handled automatically by the `serve()` wrapper.

```
serve<WebhookEnvelope>() with steps:

Step 1: "resolve-workspace"
  → Query orgWorkspaces by clerkOrgId (envelope.orgId)
  → Return { workspaceId, workspaceName, clerkOrgId } or null (graceful skip)

Step 2: "store-payload"
  → Call storeIngestionPayload() from @repo/console-webhooks
  → Params: { workspaceId, deliveryId, source: provider, eventType, payload: JSON.stringify(envelope.payload), headers: {}, receivedAt }

Step 3: "dispatch-to-inngest"
  → Route based on provider + eventType
  → Call transformers from @repo/console-webhooks to produce sourceEvent
  → Dispatch to appropriate Inngest events
```

##### 4.3. Workspace Resolution Helper

**File**: `apps/console/src/app/api/webhooks/ingress/resolve-workspace.ts`

```typescript
import { db, eq } from "@db/console"
import { orgWorkspaces } from "@db/console/schema"

export async function resolveWorkspaceFromOrgId(orgId: string) {
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.clerkOrgId, orgId),
  })
  return workspace ?? null
}
```

##### 4.4. Inngest Dispatch Router

**File**: `apps/console/src/app/api/webhooks/ingress/dispatch.ts`

Maps `provider + eventType` to existing Inngest events. Calls the appropriate transformer from `@repo/console-webhooks` to convert raw payload into the `sourceEvent` shape expected by `observation.capture`.

```typescript
import { inngest } from "@vendor/inngest"
import type { WebhookEnvelope } from "@repo/gateway-types"
import {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  // ... other transformers
} from "@repo/console-webhooks"

export async function dispatchToInngest(
  envelope: WebhookEnvelope,
  workspace: { workspaceId: string; clerkOrgId: string },
) {
  const { provider, eventType, payload, deliveryId } = envelope
  const receivedAt = new Date(envelope.receivedAt)

  switch (provider) {
    case "github": {
      // GitHub push → dedicated push handler + observation
      if (eventType === "push") {
        await inngest.send({
          name: "apps-console/github.push",
          data: { payload, workspaceId: workspace.workspaceId, deliveryId },
        })
      }
      // All GitHub events → observation capture (with transformer)
      const sourceEvent = transformByGitHubEventType(eventType, payload, { deliveryId, receivedAt })
      if (sourceEvent) {
        await inngest.send({
          name: "apps-console/neural/observation.capture",
          data: {
            workspaceId: workspace.workspaceId,
            clerkOrgId: workspace.clerkOrgId,
            sourceEvent,
          },
        })
      }
      break
    }
    case "vercel":
    case "linear":
    case "sentry":
      // These all route to observation.capture with provider-specific transformers
      const transformed = transformByProvider(provider, eventType, payload, { deliveryId, receivedAt })
      if (transformed) {
        await inngest.send({
          name: "apps-console/neural/observation.capture",
          data: {
            workspaceId: workspace.workspaceId,
            clerkOrgId: workspace.clerkOrgId,
            sourceEvent: transformed,
          },
        })
      }
      break
  }
}
```

**Note**: The `transformByGitHubEventType` and `transformByProvider` helpers need to be implemented or composed from existing transformers in `@repo/console-webhooks`. The transformers already exist for GitHub (push, PR, issues, reviews, comments), Vercel (deployments), Linear (5 functions), and Sentry (4 functions).

##### 4.5. Console Environment

Ensure QStash signing keys are available for `serve()` verification in Console:

```
QSTASH_TOKEN=...
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...
```

These may already exist if `@vendor/upstash-workflow` is used elsewhere in Console. Verify in `apps/console/.vercel/.env.development.local`.

##### 4.6. Add `@repo/gateway-types` as Console Dependency

**File**: `apps/console/package.json`

Add `"@repo/gateway-types": "workspace:*"` to dependencies.

#### Success Criteria

**Automated:**
- [x] `pnpm build:console` compiles with the new ingress route
- [x] `pnpm typecheck` passes — `WebhookEnvelope` type shared correctly
- [x] `pnpm lint` passes

**Manual:**
- [ ] End-to-end: GitHub webhook → Gateway verify → QStash → Console `serve()` ingress → `storeIngestionPayload` → Inngest event visible in dashboard
- [ ] Verify `workspaceIngestionPayloads` table has the raw payload stored
- [ ] Verify Upstash Workflow dashboard shows completed Console workflow runs
- [ ] Verify existing observation capture pipeline processes the event correctly
- [ ] Send invalid QStash signature → rejected by `serve()` automatically (401)
- [ ] Unknown workspace (bad orgId) → workflow returns gracefully after step 1

**Implementation Note**: This is the critical integration point. Pause for thorough end-to-end manual testing before proceeding.

---

### Phase 6: Console Token Migration & Connection Sync

#### Overview

Two goals: (1) Console needs to know about Gateway connections so it can map `userSources` / `workspaceIntegrations` to Gateway installations. (2) Console workflows that decrypt tokens need to switch to requesting them from the Gateway token vault.

#### Changes Required

##### 6.1. Add `gatewayInstallationId` to Schema

**File**: `db/console/src/schema/tables/user-sources.ts`

Add column:
```typescript
gatewayInstallationId: varchar("gateway_installation_id", { length: 21 }),
```

Nullable — existing records won't have it until migration or re-connection via Gateway.

**File**: `db/console/src/schema/tables/workspace-integrations.ts`

Add column:
```typescript
gatewayInstallationId: varchar("gateway_installation_id", { length: 21 }),
```

Generate migration: `pnpm --filter @db/console db:generate`

##### 6.2. Gateway Client Utility

**File**: `packages/console-gateway-client/package.json`

New package `@repo/console-gateway-client`. Minimal fetch wrapper:

```typescript
// packages/console-gateway-client/src/index.ts
export class GatewayClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  async getToken(installationId: string): Promise<{
    accessToken: string
    provider: string
    expiresIn: number | null
  }> {
    const res = await fetch(`${this.baseUrl}/connections/${installationId}/token`, {
      headers: { "X-API-Key": this.apiKey },
    })
    if (!res.ok) throw new Error(`Gateway token request failed: ${res.status}`)
    return res.json()
  }

  async getConnection(installationId: string): Promise<ConnectionInfo> {
    const res = await fetch(`${this.baseUrl}/connections/${installationId}`, {
      headers: { "X-API-Key": this.apiKey },
    })
    if (!res.ok) throw new Error(`Gateway connection request failed: ${res.status}`)
    return res.json()
  }

  async linkResource(
    installationId: string,
    providerResourceId: string,
    resourceName?: string,
  ): Promise<{ status: string; resource: { id: string } }> {
    const res = await fetch(`${this.baseUrl}/connections/${installationId}/resources`, {
      method: "POST",
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ providerResourceId, resourceName }),
    })
    if (!res.ok) throw new Error(`Gateway link resource failed: ${res.status}`)
    return res.json()
  }

  async unlinkResource(installationId: string, resourceId: string): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/connections/${installationId}/resources/${resourceId}`,
      {
        method: "DELETE",
        headers: { "X-API-Key": this.apiKey },
      },
    )
    if (!res.ok) throw new Error(`Gateway unlink resource failed: ${res.status}`)
  }

  async deleteConnection(provider: string, installationId: string): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/connections/${provider}/${installationId}`,
      {
        method: "DELETE",
        headers: { "X-API-Key": this.apiKey },
      },
    )
    if (!res.ok) throw new Error(`Gateway delete connection failed: ${res.status}`)
  }
}
```

Add environment variables to Console:
```
GATEWAY_API_URL=https://gateway.lightfast.ai   # or http://localhost:4108 in dev
GATEWAY_API_KEY=...                              # matches Gateway's GATEWAY_API_KEY
```

##### 6.3. Connection Sync: Gateway→Console Notification

After Gateway OAuth callback creates the installation, Console needs to be informed. Two approaches exist — choose based on implementation preference:

**Option A: Server-to-server notification (recommended)**

Update Gateway callback routes (`apps/gateway/src/routes/connections.ts`) to call a Console API endpoint after successful OAuth:

**New Console endpoint**: `apps/console/src/app/api/connections/sync/route.ts`

```typescript
// Called by Gateway after successful OAuth
export const { POST } = serve<ConnectionSyncPayload>(async (context) => {
  const data = context.requestPayload
  // Upsert userSources with gatewayInstallationId
  // Create or reactivate workspaceIntegrations if applicable
})
```

OR verify QStash signature and process inline (no workflow needed for a single DB write).

**Gateway callback addition** (after creating installation + tokens):
```typescript
// After successful OAuth, notify Console
await qstash.publishJSON({
  url: `${consoleUrl}/api/connections/sync`,
  body: {
    installationId: installation.id,
    provider: provider.name,
    orgId: stateData.orgId,
    connectedBy: stateData.connectedBy,
    externalId: installation.externalId,
    accountLogin: installation.accountLogin,
  },
})
```

**Option B: Client-mediated redirect**

Gateway callback redirects to Console's connected page with `installationId` as a query param. The Console connected page (server component) creates the `userSources` record.

This is simpler but relies on the browser completing the redirect. If the user closes the popup early, the sync is lost.

##### 6.4. Console Connection Removed Handler

**File**: `apps/console/src/app/api/connections/removed/route.ts`

When Gateway teardown completes, notify Console to soft-delete the `userSources` and `workspaceIntegrations`. Gateway's `DELETE /connections/:provider/:id` handler should call this via QStash after completing the teardown.

##### 6.5. Update Token-Consuming Workflows

**File**: `api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts`

Currently at line ~136: `const decryptedToken = decrypt(source.accessToken, env.ENCRYPTION_KEY)`

Change to:
```typescript
const { accessToken: decryptedToken } = await gatewayClient.getToken(source.gatewayInstallationId)
```

Requires that `userSources` row has `gatewayInstallationId` populated (from Phase 6.3).

**File**: `api/console/src/router/user/user-sources.ts`

- `github.validate` (line ~191): Replace `decrypt(userSource.accessToken, env.ENCRYPTION_KEY)` with Gateway token vault call
- `vercel.listProjects` (line ~853): Replace `decrypt(source.accessToken, env.ENCRYPTION_KEY)` with Gateway token vault call
- `github.repositories` (line ~450): Currently uses GitHub App auth (`createGitHubApp`), not user token — **no change needed**

##### 6.6. Update `workspaceIntegrations` Bulk Link

**File**: `api/console/src/router/org/workspace.ts`

When `bulkLink*` mutations link resources (repos, projects), they should also call `gatewayClient.linkResource()` to populate the Gateway's Redis routing cache. This ensures webhook→connection resolution works for newly linked resources.

#### Success Criteria

**Automated:**
- [ ] `pnpm --filter @db/console db:generate` produces a clean migration (requires DB credentials — run manually)
- [x] `pnpm build:console` compiles
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes

**Manual:**
- [ ] OAuth flow via Gateway → Console `userSources` record created with `gatewayInstallationId`
- [ ] Backfill workflow fetches token from Gateway vault
- [ ] `userSources.github.validate` works with Gateway token
- [ ] `userSources.vercel.listProjects` works with Gateway token
- [ ] Teardown → Console `userSources` soft-deleted
- [ ] `bulkLink` → Gateway resource routing cache populated

**Implementation Note**: This is the largest remaining phase. Implement connection sync (6.3) first, then token migration (6.5), then resource linking (6.6). Pause for end-to-end testing after each sub-phase.

**Implementation Deviations:**
- Gateway URL resolved via `@vercel/related-projects` instead of `GATEWAY_API_URL` env var (matches project pattern)
- Token-consuming code uses dual path: `gatewayInstallationId` → Gateway vault, else → local `decrypt()` (backward-compatible with pre-Gateway connections)
- Connection sync endpoint uses `serve()` from `@vendor/upstash-workflow/nextjs` for QStash sig verification (same pattern as ingress)
- Gateway-managed userSources store `"gw:<installationId>"` sentinel in `accessToken` column (column is `notNull`)

---

### Phase 7: Client-Side Refactor

#### Overview

Update the Console UI to use Gateway OAuth URLs instead of Console's own OAuth routes. Replace the provider-specific connectors with a unified flow.

#### Changes Required

##### 7.1. Gateway OAuth Popup Flow

The current Console OAuth flow:
1. Client opens popup to Console route (e.g., `/api/github/install-app`)
2. Console redirects to provider
3. Provider redirects to Console callback
4. Console callback creates DB records, redirects to connected page
5. Connected page closes popup (GitHub: `window.close()`, Vercel: `postMessage` + `window.close()`)

New Gateway flow:
1. Client calls Console tRPC (or direct fetch) to get Gateway authorization URL
2. Client opens popup to Gateway URL
3. Gateway redirects to provider
4. Provider redirects to Gateway callback
5. Gateway callback creates records, notifies Console (Phase 6.3), redirects to Console connected page
6. Connected page closes popup (same pattern as today)

**Key decision**: The Gateway callback needs to redirect to a Console page for popup closing. Add a `redirect_uri` parameter to the Gateway authorize endpoint, or use a fixed Console connected page URL per provider.

##### 7.2. `useConnection` Hook

**File**: `apps/console/src/hooks/use-connection.ts`

```typescript
function useConnection(provider: ProviderName) {
  return {
    status,        // "disconnected" | "connecting" | "connected" | "error"
    connection,    // { id, provider, externalId, gatewayInstallationId }
    connect,       // () => opens popup to Gateway OAuth URL, polls/listens for completion
    disconnect,    // () => calls Gateway teardown via tRPC proxy
    resources,     // linked resources from workspace.sources.list
    linkResources, // (resourceIds[]) => calls bulkLink mutation
    unlinkResource,// (resourceId) => calls disconnect mutation
  }
}
```

The `connect()` function:
1. Calls a tRPC endpoint to get the Gateway authorize URL (passing orgId)
2. Opens a popup to that URL
3. Listens for popup close or `postMessage` event
4. Refetches connection status on completion

##### 7.3. tRPC Proxy for Gateway

**File**: `api/console/src/router/user/connections.ts`

New tRPC router that proxies status queries to Gateway:

```typescript
export const connectionsRouter = router({
  getAuthorizeUrl: userScopedProcedure
    .input(z.object({ provider: z.enum(["github", "vercel", "linear", "sentry"]) }))
    .query(async ({ ctx, input }) => {
      const res = await fetch(`${env.GATEWAY_API_URL}/connections/${input.provider}/authorize`, {
        headers: {
          "X-Org-Id": ctx.auth.orgId,
          "X-User-Id": ctx.auth.userId,
        },
      })
      return res.json() // { url, state }
    }),

  get: userScopedProcedure
    .input(z.object({ provider: z.string() }))
    .query(async ({ ctx, input }) => {
      // Query userSources joined with gatewayInstallationId
      // Return connection status
    }),
})
```

##### 7.4. Simplified Connect Page

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/connect/page.tsx`

Replace `ConnectFormProvider` + provider-specific connectors with a generic `ProviderConnector` that uses `useConnection`:
- Remove `ConnectFormProvider` wrapper
- Replace `GitHubConnector` / `VercelConnector` with generic `ProviderConnector`
- Add real Linear and Sentry connector UIs (replace "coming soon" placeholders)
- Each connector uses `useConnection(provider)` for status + actions

##### 7.5. Gateway Callback Redirect

Update Gateway callback routes to redirect to Console connected pages after creating records:

For GitHub: `→ redirect to ${consoleUrl}/github/connected?installationId=${id}`
For Vercel: `→ redirect to ${consoleUrl}/vercel/connected?installationId=${id}`
For Linear/Sentry: Create new connected pages, or use a generic `${consoleUrl}/connected?provider=${name}&installationId=${id}`

The connected pages call `window.opener?.postMessage({ type: "connection_complete", provider, installationId })` before auto-closing.

#### Success Criteria

**Automated:**
- [ ] `pnpm build:console` compiles
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] No imports of removed components remain

**Manual:**
- [ ] GitHub connect flow works end-to-end via new UI
- [ ] Vercel connect flow works end-to-end via new UI
- [ ] Linear connect flow works (new provider)
- [ ] Sentry connect flow works (new provider)
- [ ] Resource selection and linking works for all providers
- [ ] Disconnect flow works for all providers
- [ ] InstalledSources page shows connections from all providers

**Implementation Note**: Pause for comprehensive UI testing across all providers.

---

### Phase 8: Console Route Cleanup

#### Overview

Remove the old webhook routes, OAuth routes, and packages that are now handled by the Gateway.

#### Changes Required

##### 8.1. Remove Old Webhook Routes

Delete:
- `apps/console/src/app/(github)/api/github/webhooks/route.ts` (609 lines)
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` (223 lines)

##### 8.2. Remove Old OAuth Routes

Delete:
- `apps/console/src/app/(github)/api/github/install-app/route.ts`
- `apps/console/src/app/(github)/api/github/authorize-user/route.ts`
- `apps/console/src/app/(github)/api/github/app-installed/route.ts`
- `apps/console/src/app/(github)/api/github/user-authorized/route.ts`
- `apps/console/src/app/(vercel)/api/vercel/authorize/route.ts`
- `apps/console/src/app/(vercel)/api/vercel/callback/route.ts`

##### 8.3. Remove/Simplify Packages

- **`@repo/console-oauth`**: Remove entirely. State management, token encryption, and PKCE are now handled by Gateway.
- **`@repo/console-webhooks`**: Remove verification modules (`common.ts:safeCompareSignatures/computeHmac*`, `github.ts:verifyGitHubWebhook*`, `vercel.ts:verifyVercelWebhook*`). Keep transformers and storage.

##### 8.4. Simplify tRPC Routers

- **`userSourcesRouter`**: Remove `github.storeOAuthResult`, `vercel.storeOAuthResult` (Gateway handles). Keep `github.repositories`, `vercel.listProjects` (now using Gateway token vault). Keep `disconnect` (proxies to Gateway teardown).
- **`sourcesM2MRouter`**: Remove or simplify webhook-specific procedures that Gateway now handles.
- **`workspace.integrations`**: Keep `bulkLink*` mutations (still called by client). They now also call `gatewayClient.linkResource()`.

##### 8.5. Remove Route Groups

If `(github)` and `(vercel)` route groups are empty after cleanup, remove the directories. Keep the connected pages if they're reused for Gateway callback redirects.

##### 8.6. Remove Old Connected Pages (if replaced)

If Phase 7.5 introduces a generic connected page, remove:
- `apps/console/src/app/(github)/github/connected/page.tsx`
- `apps/console/src/app/(vercel)/vercel/connected/page.tsx`

#### Success Criteria

**Automated:**
- [ ] `pnpm build:console` compiles with no errors
- [ ] `pnpm typecheck` passes — no broken imports
- [ ] `pnpm lint` passes
- [ ] Grep for old import paths returns no results

**Manual:**
- [ ] Console app starts and all existing pages load correctly
- [ ] No 404s on any Console routes
- [ ] Sources page shows connected integrations
- [ ] Connect page works for all providers

**Implementation Note**: This should be a separate deployment after Gateway is confirmed stable in production. Keep old routes as rollback safety net until confidence is established.

---

### Phase 9: Admin Completion (Remaining)

#### Changes Required

##### 9.1. DLQ Replay

**File**: `apps/gateway/src/routes/admin.ts` — `POST /admin/dlq/replay`

Implementation:
1. Query `gw_webhook_deliveries` by provided `deliveryIds`
2. For each DLQ entry, re-publish to `consoleUrl/api/webhooks/ingress` via QStash
3. Update delivery status to `"delivered"` on success
4. Return `{ replayed: count, failed: count }`

**Prerequisite**: The `gw_webhook_deliveries` table needs the raw payload stored. Currently it only stores metadata (provider, deliveryId, eventType). Either:
- Add a `payload` TEXT column to `gw_webhook_deliveries` for DLQ entries
- Or store DLQ payloads in Redis with longer TTL (7 days)

##### 9.2. Delivery Status Callback

**File**: `apps/gateway/src/routes/admin.ts` — `POST /admin/delivery-status`

Implementation:
1. Parse QStash callback body (`messageId`, `state`, delivery outcome)
2. Upsert into `gw_webhook_deliveries` with status `"delivered"` or `"dlq"`
3. On final failure (`state === "error"` after all retries): move to DLQ topic with full payload

#### Success Criteria

- [ ] DLQ replay re-delivers messages to Console ingress
- [ ] Delivery status callback updates `gw_webhook_deliveries`
- [ ] Failed deliveries appear in DLQ after all QStash retries exhausted

---

### Phase 10: Cutover & Deployment

#### Changes Required

##### 10.1. Deploy Gateway

- Create Vercel project for `apps/gateway`, root directory `apps/gateway`
- Configure all environment variables (see `apps/gateway/.env.example`)
- Add `@vercel/related-projects` link to Console project
- Deploy to `gateway.lightfast.ai`
- Verify health endpoint: `GET /admin/health`

##### 10.2. Run Cache Rebuild

- Call `POST /admin/cache/rebuild` to populate Redis from Turso
- Verify all active resources have Redis routing cache entries

##### 10.3. Run Data Migration

For existing connections created before Gateway:
1. Script queries all active `userSources` + `workspaceIntegrations` from Console's PlanetScale
2. For each, creates corresponding `gw_installations` + `gw_tokens` in Gateway Turso
3. Backfills `gatewayInstallationId` on Console `userSources` and `workspaceIntegrations` rows
4. Runs cache rebuild to populate Redis

This is a one-time migration script.

##### 10.4. Update Provider Webhook URLs

- **GitHub**: Update GitHub App webhook URL from `lightfast.ai/api/github/webhooks` to `gateway.lightfast.ai/webhooks/github`
- **Vercel**: Update Vercel integration webhook URL to `gateway.lightfast.ai/webhooks/vercel`
- **Linear**: Registered automatically during Gateway OAuth (new connections)
- **Sentry**: Registered automatically during Gateway OAuth (new connections)

##### 10.5. Update OAuth Redirect URLs

- **GitHub**: Update GitHub App callback URL to `gateway.lightfast.ai/connections/github/callback`
- **Vercel**: Update Vercel integration redirect URI to `gateway.lightfast.ai/connections/vercel/callback`
- **Linear**: Register `gateway.lightfast.ai/connections/linear/callback` in Linear app settings
- **Sentry**: Register `gateway.lightfast.ai/connections/sentry/callback` in Sentry integration settings

##### 10.6. Verify End-to-End

- Push a commit to a connected GitHub repository → verify observation appears in Console
- Deploy on Vercel → verify deployment event appears in Console
- Run a backfill → verify it uses Gateway token vault
- Disconnect and reconnect a source → verify full lifecycle
- Connect Linear (new) → verify observation capture works
- Connect Sentry (new) → verify observation capture works

#### Rollback Plan

If Gateway fails in production:
1. Revert provider webhook URLs to old Console endpoints (they still exist until Phase 8)
2. Old OAuth routes still function
3. Phase 8 cleanup should be a **separate deployment** after Gateway is confirmed stable

---

## Testing Strategy

### Test Infrastructure

**vitest** as test runner. Config at `apps/gateway/vitest.config.ts`. Scripts: `test`, `test:watch`.

### Layer 1: Pure Unit Tests (zero mocks)

- `crypto.test.ts`: HMAC-SHA256, HMAC-SHA1 test vectors, `timingSafeEqual` edge cases, AES-GCM roundtrip
- `keys.test.ts`: All 7 Redis key factory functions return expected patterns

### Layer 2: Provider Verification Tests (real crypto, no network)

One file per provider. Each covers:
1. Valid signature → `true`
2. Tampered body → `false`
3. Missing signature header → `false`
4. Wrong secret → `false`
5. `extractDeliveryId` / `extractEventType` / `extractResourceId` correctness

**Vercel note**: Uses SHA-1 (not SHA-256) for signature computation.

### Layer 3: Integration Tests (mocked Redis + Turso, real Hono)

- `webhooks.test.ts`: Mock env + `workflowClient.trigger()`. Test via `app.request()`:
  - Unknown provider → 400
  - Missing/wrong signature → 401
  - Invalid JSON → 400
  - Happy path → 200, workflow triggered with correct payload shape

### Layer 4: Fixture-Based Contract Tests

JSON fixtures per provider per event type in `src/__tests__/fixtures/`. Each fixture has `headers`, `body`, `expectedDeliveryId`, `expectedEventType`, `expectedResourceId`.

### Console Integration Tests

- Mock QStash delivery → Console `serve()` ingress → all 3 steps complete → Inngest event fired
- Invalid QStash signature → rejected by `serve()` (401)
- Unknown workspace → graceful skip after step 1
- Gateway client → token vault returns valid token

---

## Performance Considerations

- **Webhook receipt**: < 50ms P99 (1 signature verify + 1 workflow trigger)
- **Webhook workflow**: < 500ms total (Redis dedup + Redis/Turso resolve + QStash publish)
- **Token vault**: < 100ms (1 Turso read + 1 AES decrypt, or + 1 provider refresh call if expired)
- **Cold starts**: Edge runtime ~50ms, Node.js Fluid Compute ~115ms — both acceptable for webhook providers
- **Redis**: `enableAutoPipelining: true` already configured in `@vendor/upstash`

---

## References

- Architecture research: `thoughts/shared/research/2026-02-25-webhook-connection-manager-architecture.md`
- Gateway types: `packages/gateway-types/src/`
- Gateway database: `db/gateway/src/schema/`
- Gateway routes: `apps/gateway/src/routes/`
- Gateway providers: `apps/gateway/src/providers/`
- Gateway workflow: `apps/gateway/src/workflows/webhook-receipt.ts`
- Current webhook handlers: `apps/console/src/app/(github)/api/github/webhooks/route.ts`, `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`
- Current OAuth routes: `apps/console/src/app/(github)/api/github/user-authorized/route.ts`, `apps/console/src/app/(vercel)/api/vercel/callback/route.ts`
- Console webhooks transformers: `packages/console-webhooks/src/transformers/`
- Console webhooks storage: `packages/console-webhooks/src/storage.ts`
- Upstash vendor: `vendor/upstash/`, `vendor/upstash-workflow/`, `vendor/qstash/`
- User sources router: `api/console/src/router/user/user-sources.ts`
- Workspace integrations: `api/console/src/router/org/workspace.ts`
- Inngest push handler: `api/console/src/inngest/workflow/providers/github/push-handler.ts`
- Inngest backfill orchestrator: `api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts`
- Linear transformers: `packages/console-webhooks/src/transformers/linear.ts`
- Sentry transformers: `packages/console-webhooks/src/transformers/sentry.ts`
- Event type registry: `packages/console-types/src/integrations/event-types.ts`
