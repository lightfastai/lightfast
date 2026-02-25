---
date: 2026-02-25
author: Claude Opus 4.6
status: draft
research: thoughts/shared/research/2026-02-25-webhook-connection-manager-architecture.md
tags: [plan, gateway, webhooks, oauth, hono, upstash, architecture]
---

# Gateway Service: Implementation Plan

## Overview

Build a standalone Hono service (`apps/gateway/`) deployed as its own Vercel project at `gateway.lightfast.ai`. The Gateway owns the complete connection lifecycle (OAuth setup, token storage, token refresh, teardown) and webhook receipt with 100% deliverability via QStash. Console becomes a consumer of verified, delivered webhooks and requests tokens from the Gateway when it needs to call provider APIs.

## Current State Analysis

**Webhook receipt** is split across two Next.js route handlers:
- GitHub: 609 lines at `apps/console/src/app/(github)/api/github/webhooks/route.ts`
- Vercel: 223 lines at `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`

Both follow a 6-stage pipeline (verify HMAC → validate timestamp → resolve workspace → store payload → transform → Inngest dispatch) with provider-specific differences in signature algorithm (SHA-256 vs SHA-1), workspace resolution (tRPC service vs direct Drizzle query), and timestamp extraction.

**Connection setup** spans 6 OAuth route files, the `@repo/console-oauth` package (state management, PKCE, token encryption), the `userSources` tRPC router, and the `workspaceIntegrations` tRPC router. Two encryption implementations exist: Node.js `crypto` in `@repo/lib` for DB token storage, and Web Crypto in `@repo/console-oauth` for short-lived cookies.

**Linear and Sentry** have full transformer implementations (`packages/console-webhooks/src/transformers/linear.ts` — 5 functions, `sentry.ts` — 4 functions), complete event type registries (15 Linear events, 7 Sentry events in `@repo/console-types`), and placeholder UI in the ProviderSelector. But no OAuth routes, webhook handlers, or backfill connectors exist.

**Upstash** is already vendored: `@vendor/upstash` (Redis) and `@vendor/upstash-workflow` (Workflow/QStash). No standalone QStash package exists.

**Hono** is not used anywhere in the monorepo. All 5 apps are Next.js.

### Key Discoveries:
- Both webhook handlers use `runtime = "nodejs"` — not Edge (`route.ts:36` in both files)
- Webhook receipt and connection setup are coupled only through `workspaceIntegrations.providerResourceId` — no shared contract
- The `@repo/console-oauth/pkce` module is fully implemented but unused by any OAuth route
- Vercel has deprecated Edge Functions in favor of Fluid Compute Node.js (sub-115ms cold starts) — the latency advantage of Edge is now minimal
- Per-route runtime in standalone Hono on Vercel requires separate entrypoint files, not per-route config
- Internal `workspace:*` packages must compile to JS (via tsup) for Vercel to bundle them in non-Next.js apps
- The neural observation pipeline in Inngest already handles Linear and Sentry event types (`observation-capture.ts:190`, `203`)

## Desired End State

A fully isolated Gateway service that:

1. **Receives all provider webhooks** at `gateway.lightfast.ai/webhooks/:provider` — verifies signatures, deduplicates, resolves connections, and delivers to Console via QStash with 100% deliverability
2. **Owns the connection lifecycle** — OAuth initiation, token exchange, token refresh, teardown — for all four providers (GitHub, Vercel, Linear, Sentry)
3. **Serves as the token vault** — Console requests decrypted provider tokens from Gatewayvia authenticated API when needed for backfill, sync, or API calls
4. **Uses Upstash as data plane** — Redis for routing/state cache, QStash for durable delivery, Workflow for multi-step flows
5. **PlanetScale remains SQL source of truth** — Gatewaywrites through to Console API which persists to PlanetScale; Redis is a rebuildable cache

### Verification:
- All webhook events from GitHub, Vercel, Linear, and Sentry are received, verified, and delivered to Console within 30 seconds
- QStash DLQ is empty under normal operation; failed deliveries are captured and replayable
- Token refresh runs automatically before expiration; no manual intervention needed
- Console's backfill, sync, and API listing workflows function using tokens obtained from Gateway
- Redis cache can be fully rebuilt from PlanetScale via admin endpoint
- Old webhook routes, OAuth routes, and `@repo/console-oauth` package are removed from Console

## What We're NOT Doing

- **No shadow mode / dual running** — big bang cutover after thorough testing
- **No backfill connectors for Linear/Sentry** — they'll be added later via `@repo/console-backfill`
- **No transformer migration** — transformers stay in Console's `@repo/console-webhooks` package; Gatewaysends raw payloads
- **No microfrontends integration** — Gatewayis a separate Vercel project, not part of the microfrontends routing
- **No changes to Inngest workflows** — existing sync/backfill/observation pipelines keep their current shape; only their token source changes
- **No custom monitoring stack** — rely on Upstash dashboards (Redis, QStash) and Vercel function logs initially

## Implementation Approach

Build the Gateway bottom-up: foundation → providers → webhook receipt → connection lifecycle → Console integration → client-side → cutover. Each phase produces a testable artifact. The Gateway is developed and tested against mock providers and a staging environment before the cutover.

Since Vercel has deprecated Edge Functions in favor of Fluid Compute, all Gatewayroutes will use **Node.js runtime**. This simplifies the architecture (single runtime, single Hono app entrypoint) with negligible latency difference (~115ms cold start vs ~212ms for Edge P50).

---

## Phase 1: Foundation & Infrastructure

### Overview
Scaffold the Hono app, create the `@vendor/qstash` package, define the provider interface contract, set up Redis key conventions, and establish the crypto/auth middleware.

### Changes Required:

#### 1. Create `@vendor/qstash` package
**Directory**: `vendor/qstash/`

New files:
- `vendor/qstash/package.json` — package `@vendor/qstash`, depends on `@upstash/qstash`
- `vendor/qstash/env.ts` — validates `QSTASH_TOKEN`, `QSTASH_URL`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` via `@t3-oss/env-nextjs`
- `vendor/qstash/src/index.ts` — exports `QStashClient` wrapper and `getQStashClient` singleton factory
- `vendor/qstash/src/client.ts` — wraps `@upstash/qstash` `Client`: `publishJSON()`, `publishToDeadLetterQueue()`, `getDeadLetterMessages()`
- `vendor/qstash/src/receiver.ts` — wraps `@upstash/qstash` `Receiver`: `verify()` for verifying QStash-signed deliveries

Follow the existing `@vendor/upstash-workflow` pattern (env validation, singleton factory, typed wrapper).

#### 2. Scaffold `apps/gateway/`
**Directory**: `apps/gateway/`

New files:
- `package.json` — name `@lightfast/gateway`, depends on `hono`, `@hono/node-server`, `@vendor/upstash`, `@vendor/qstash`, `@vendor/upstash-workflow`
- `tsconfig.json` — extends internal TypeScript config
- `turbo.json` — extends root, declares `build` task with env vars, `dev` persistent task
- `vercel.json` — framework `hono`, rewrites `/(.*) → /api`, `ignoreCommand: "npx turbo-ignore"`
- `api/index.ts` — Hono app entry, mounts all route groups, exports via `@hono/node-server/vercel` `handle()`
- `src/routes/webhooks.ts` — stub: `POST /webhooks/:provider`
- `src/routes/connections.ts` — stub: `POST /connections/:provider/authorize`, `GET /connections/:provider/callback`, `DELETE /connections/:provider/:id`, `GET /connections/:id/token`
- `src/routes/admin.ts` — stub: `GET /admin/health`, `POST /admin/cache/rebuild`
- `src/middleware/auth.ts` — `X-API-Key` header validation for Console→Gateway calls
- `src/middleware/tenant.ts` — `org_id` extraction and scoping from request context
- `src/lib/keys.ts` — Redis key convention functions: `connectionKey(id)`, `orgConnectionsKey(orgId)`, `resourceKey(provider, resourceId)`, `connectionResourcesKey(connId)`, `oauthStateKey(token)`, `webhookSeenKey(provider, deliveryId)`, `providerAccountKey(provider, accountId)`
- `src/lib/crypto.ts` — Web Crypto AES-256-GCM encrypt/decrypt (port from `@repo/console-oauth/tokens` pattern), HMAC-SHA256 compute/verify
- `src/lib/redis.ts` — re-exports `@vendor/upstash` redis instance
- `src/lib/qstash.ts` — re-exports `@vendor/qstash` client instance
- `src/providers/types.ts` — `ConnectionProvider` interface (see below)

```typescript
// src/providers/types.ts
export interface ConnectionProvider {
  readonly name: string
  readonly requiresWebhookRegistration: boolean

  // OAuth
  getAuthorizationUrl(state: string, options?: ProviderOptions): string
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>
  refreshToken(refreshToken: string): Promise<OAuthTokens>
  revokeToken(accessToken: string): Promise<void>

  // Webhook verification (Web Crypto only — no Node.js crypto)
  verifyWebhook(payload: string, headers: Headers, secret: string): Promise<boolean>
  extractDeliveryId(headers: Headers, payload: unknown): string
  extractEventType(headers: Headers, payload: unknown): string
  extractResourceId(payload: unknown): string | null

  // Webhook registration (Linear, Sentry only)
  registerWebhook?(connectionId: string, callbackUrl: string, secret: string): Promise<string>
  deregisterWebhook?(connectionId: string, webhookId: string): Promise<void>
}

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  scope?: string
  tokenType?: string
  raw: Record<string, unknown>
}

export interface ProviderOptions {
  targetId?: string
  scopes?: string[]
  redirectPath?: string
}
```

#### 3. Configure environment
**File**: `apps/gateway/.env.example`

```
# Upstash Redis
KV_REST_API_URL=
KV_REST_API_TOKEN=

# Upstash QStash
QSTASH_TOKEN=
QSTASH_URL=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# Service Auth
GATEWAY_API_KEY=              # Console→Gateway authentication
GATEWAY_WEBHOOK_SECRET=       # Gateway→Console HMAC signing
ENCRYPTION_KEY=          # AES-256-GCM for token encryption

# GitHub
GITHUB_APP_SLUG=
GITHUB_APP_ID=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=

# Vercel
VERCEL_CLIENT_SECRET_ID=
VERCEL_CLIENT_INTEGRATION_SECRET=
VERCEL_INTEGRATION_SLUG=

# Linear
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=
LINEAR_WEBHOOK_SIGNING_SECRET=

# Sentry
SENTRY_CLIENT_ID=
SENTRY_CLIENT_SECRET=

# Console
CONSOLE_INGRESS_URL=     # https://lightfast.ai/api/webhooks/ingress
CONSOLE_API_URL=         # https://lightfast.ai/api/connections
```

#### 4. Add to monorepo workspace
**File**: `pnpm-workspace.yaml` — already covers `apps/*`, no change needed
**File**: Root `package.json` — add `dev:cm` script for local development

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` resolves all workspace dependencies
- [x] `pnpm --filter @vendor/qstash build` compiles successfully
- [x] `pnpm --filter @lightfast/gateway build` compiles successfully
- [ ] `pnpm typecheck` passes across the entire monorepo
- [x] `pnpm lint` passes
- [ ] `GET /admin/health` returns `{ status: "ok" }` when running locally

#### Manual Verification:
- [ ] Verify the Hono dev server starts and responds to requests locally
- [ ] Verify Redis connection works with Upstash credentials

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Provider Implementations

### Overview
Implement the `ConnectionProvider` interface for all four providers. Each provider handles OAuth URL generation, token exchange, webhook signature verification, and event/resource extraction.

### Changes Required:

#### 1. GitHub Provider
**File**: `apps/gateway/src/providers/github.ts`

Port webhook verification from `packages/console-webhooks/src/github.ts:77-145`:
- `verifyWebhook`: HMAC-SHA256 via Web Crypto (`crypto.subtle`), strip `sha256=` prefix, timing-safe compare
- `extractDeliveryId`: read `x-github-delivery` header
- `extractEventType`: read `x-github-event` header
- `extractResourceId`: extract from `payload.repository.id` (string)

Port OAuth from existing GitHub routes:
- `getAuthorizationUrl`: build `https://github.com/login/oauth/authorize?client_id=...&state=...`
- `exchangeCode`: POST to `https://github.com/login/oauth/access_token`
- `refreshToken`: GitHub user tokens don't expire (no-op or throw)
- `revokeToken`: DELETE `https://api.github.com/applications/${clientId}/token`

GitHub App installation handling:
- `getInstallationUrl(state, targetId?)`: build `https://github.com/apps/${slug}/installations/new`
- `getInstallationRepositories(installationId)`: via GitHub App JWT auth

#### 2. Vercel Provider
**File**: `apps/gateway/src/providers/vercel.ts`

Port from `packages/console-webhooks/src/vercel.ts:283-349`:
- `verifyWebhook`: HMAC-**SHA1** via Web Crypto, no prefix stripping
- `extractDeliveryId`: read `x-vercel-id` header, fallback to `payload.id`
- `extractEventType`: read `payload.type` field
- `extractResourceId`: extract from `payload.payload.project.id`

Port OAuth:
- `getAuthorizationUrl`: build `https://vercel.com/integrations/${slug}/new?state=...`
- `exchangeCode`: POST to `https://api.vercel.com/v2/oauth/access_token` (form-encoded)
- `refreshToken`: Vercel tokens don't expire (no-op or throw)
- `revokeToken`: POST to `https://api.vercel.com/v2/oauth/tokens/revoke`

#### 3. Linear Provider
**File**: `apps/gateway/src/providers/linear.ts`

New implementation:
- `verifyWebhook`: HMAC-SHA256, Linear sends signature in `linear-signature` header
- `extractDeliveryId`: read `linear-delivery` header
- `extractEventType`: `payload.type` + `:` + `payload.action` (e.g., `Issue:create`)
- `extractResourceId`: `payload.organizationId` (Linear org → connection mapping)
- `requiresWebhookRegistration: true`

OAuth:
- `getAuthorizationUrl`: `https://linear.app/oauth/authorize?client_id=...&scope=read,write&state=...`
- `exchangeCode`: POST to `https://api.linear.app/oauth/token`
- `refreshToken`: Linear uses long-lived tokens (no-op)
- `revokeToken`: POST to `https://api.linear.app/oauth/revoke`

Webhook registration:
- `registerWebhook`: POST to Linear GraphQL API `webhookCreate` mutation with `resourceTypes` and callback URL
- `deregisterWebhook`: POST to Linear GraphQL API `webhookDelete` mutation

#### 4. Sentry Provider
**File**: `apps/gateway/src/providers/sentry.ts`

New implementation:
- `verifyWebhook`: HMAC-SHA256, Sentry sends signature in `sentry-hook-signature` header
- `extractDeliveryId`: read `sentry-hook-resource` + timestamp composite
- `extractEventType`: read `sentry-hook-resource` header (e.g., `issue`, `error`, `event_alert`, `metric_alert`)
- `extractResourceId`: `payload.installation.uuid` (Sentry integration → connection mapping)
- `requiresWebhookRegistration: true` (webhook URL configured during Sentry integration setup)

OAuth:
- `getAuthorizationUrl`: `https://sentry.io/sentry-apps/${slug}/external-install/`
- `exchangeCode`: POST to `https://sentry.io/api/0/sentry-app-installations/${installationId}/authorizations/`
- `refreshToken`: POST to `https://sentry.io/api/0/sentry-app-installations/${installationId}/authorizations/` with `grant_type: refresh_token`
- `revokeToken`: DELETE `https://sentry.io/api/0/sentry-app-installations/${installationId}/`

#### 5. Provider Registry
**File**: `apps/gateway/src/providers/index.ts`

```typescript
const providers = new Map<string, ConnectionProvider>([
  ["github", new GitHubProvider(config)],
  ["vercel", new VercelProvider(config)],
  ["linear", new LinearProvider(config)],
  ["sentry", new SentryProvider(config)],
])

export function getProvider(name: string): ConnectionProvider {
  const provider = providers.get(name)
  if (!provider) throw new HTTPException(400, { message: `Unknown provider: ${name}` })
  return provider
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Unit tests pass for each provider's `verifyWebhook` using known test vectors
- [ ] Unit tests pass for each provider's OAuth URL generation
- [ ] Unit tests pass for event type and resource ID extraction
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes

#### Manual Verification:
- [ ] GitHub webhook verification matches output of current `packages/console-webhooks/src/github.ts` for the same input
- [ ] Vercel webhook verification matches output of current `packages/console-webhooks/src/vercel.ts` for the same input

**Implementation Note**: Pause for manual verification of provider parity before proceeding.

---

## Phase 3: Webhook Receipt Pipeline

### Overview
Implement the hot path: receive webhook → verify signature → deduplicate → resolve connection → publish to QStash → return 200. This is the Gateway's primary function.

### Changes Required:

#### 1. Webhook Receipt Route
**File**: `apps/gateway/src/routes/webhooks.ts`

```typescript
// POST /webhooks/:provider
app.post("/webhooks/:provider", async (c) => {
  const provider = getProvider(c.req.param("provider"))
  const rawBody = await c.req.text()
  const headers = c.req.raw.headers

  // 1. Verify signature
  const secret = getWebhookSecret(provider.name)
  const valid = await provider.verifyWebhook(rawBody, headers, secret)
  if (!valid) return c.json({ error: "invalid_signature" }, 401)

  const payload = JSON.parse(rawBody)

  // 2. Dedup check
  const deliveryId = provider.extractDeliveryId(headers, payload)
  const deduped = await redis.set(
    keys.webhookSeen(provider.name, deliveryId), "1",
    { nx: true, ex: 86400 }
  )
  if (!deduped) return c.json({ status: "duplicate" }, 200)

  // 3. Resolve connection
  const resourceId = provider.extractResourceId(payload)
  const eventType = provider.extractEventType(headers, payload)

  let connectionInfo: { connectionId: string; orgId: string } | null = null
  if (resourceId) {
    connectionInfo = await redis.hgetall(keys.resource(provider.name, resourceId))
  }

  if (!connectionInfo) {
    // Publish to DLQ topic for unresolvable webhooks
    await qstash.publishJSON({
      topic: "webhook-dlq",
      body: { provider: provider.name, deliveryId, eventType, resourceId, payload },
    })
    return c.json({ status: "unresolvable" }, 200)
  }

  // 4. Publish to QStash for delivery to Console
  await qstash.publishJSON({
    url: env.CONSOLE_INGRESS_URL,
    body: {
      deliveryId,
      connectionId: connectionInfo.connectionId,
      orgId: connectionInfo.orgId,
      provider: provider.name,
      eventType,
      payload,
      receivedAt: Date.now(),
    },
    retries: 5,
    deduplicationId: `${provider.name}:${deliveryId}`,
    callback: `${env.GATEWAY_BASE_URL}/admin/delivery-status`,
  })

  // 5. Return 200
  return c.json({ status: "accepted", deliveryId }, 200)
})
```

#### 2. Webhook Secret Resolution
**File**: `apps/gateway/src/lib/secrets.ts`

For GitHub and Vercel: global webhook secrets from environment variables.
For Linear and Sentry: per-connection webhook secrets stored in `connection:{id}` Redis hash.

```typescript
async function getWebhookSecret(provider: string): Promise<string> {
  switch (provider) {
    case "github": return env.GITHUB_WEBHOOK_SECRET
    case "vercel": return env.VERCEL_CLIENT_INTEGRATION_SECRET
    case "linear": return env.LINEAR_WEBHOOK_SIGNING_SECRET
    case "sentry":
      // Sentry uses per-integration client secrets
      // For global webhook receipt, use the shared secret
      return env.SENTRY_CLIENT_SECRET
    default: throw new Error(`No webhook secret for: ${provider}`)
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Integration tests: mock webhook → verify → dedup → QStash publish (mocked) completes successfully
- [ ] Duplicate webhook returns 200 without QStash publish
- [ ] Invalid signature returns 401
- [ ] Unknown resource routes to DLQ topic
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes

#### Manual Verification:
- [ ] Send a real GitHub webhook (via ngrok) and verify it arrives in QStash dashboard
- [ ] Send a duplicate delivery ID and verify it's deduplicated
- [ ] Send an invalid signature and verify 401 response

**Implementation Note**: Pause for manual webhook receipt testing before proceeding.

---

## Phase 4: Console Webhook Ingress

### Overview
Create a single endpoint in Console that receives verified webhooks from Gatewayvia QStash. This replaces the existing 832 lines across two webhook route handlers.

### Changes Required:

#### 1. New Ingress Endpoint
**File**: `apps/console/src/app/api/webhooks/ingress/route.ts` (~80 lines)

```typescript
import { Receiver } from "@vendor/qstash"
import { storeIngestionPayload, extractWebhookHeaders } from "@repo/console-webhooks"
import { inngest } from "@vendor/inngest"
// Import existing transformers
import { transformGitHubPush, transformGitHubPullRequest, ... } from "@repo/console-webhooks"
import { transformVercelDeployment } from "@repo/console-webhooks"
import { linearTransformers } from "@repo/console-webhooks"
import { sentryTransformers } from "@repo/console-webhooks"

export async function POST(request: NextRequest) {
  // 1. Verify QStash signature
  const receiver = new Receiver({ ... })
  const body = await request.text()
  const isValid = await receiver.verify({
    signature: request.headers.get("upstash-signature") ?? "",
    body,
  })
  if (!isValid) return NextResponse.json({ error: "invalid_signature" }, { status: 401 })

  // 2. Parse envelope
  const envelope = JSON.parse(body) as WebhookEnvelope
  const { deliveryId, connectionId, orgId, provider, eventType, payload, receivedAt } = envelope

  // 3. Resolve workspace from orgId
  const workspace = await resolveWorkspaceFromOrgId(orgId)
  if (!workspace) return NextResponse.json({ error: "workspace_not_found" }, { status: 200 })

  // 4. Store raw payload
  await storeIngestionPayload({
    workspaceId: workspace.workspaceId,
    deliveryId,
    source: provider,
    payload: JSON.stringify(payload),
    headers: {},
  })

  // 5. Transform and dispatch to Inngest
  await dispatchToInngest(provider, eventType, payload, workspace, deliveryId)

  return NextResponse.json({ received: true })
}
```

The `dispatchToInngest` function routes to existing Inngest events:
- GitHub push → `apps-console/github.push` (existing) + `apps-console/neural/observation.capture`
- GitHub PR/issues/release/discussion → `apps-console/neural/observation.capture`
- Vercel deployment → `apps-console/neural/observation.capture`
- Linear → `apps-console/neural/observation.capture` (using `linearTransformers` map)
- Sentry → `apps-console/neural/observation.capture` (using `sentryTransformers` map)

#### 2. Console-side Gatewaysignature verification
Add QStash signature verification to `@vendor/qstash` package (already done in Phase 1 via `receiver.ts`).

#### 3. Workspace resolution helper
**File**: `apps/console/src/app/api/webhooks/ingress/resolve-workspace.ts`

Creates a `resolveWorkspaceFromOrgId(orgId)` function that queries `orgWorkspaces` by `clerkOrgId`. This replaces the per-provider workspace resolution in the current handlers (GitHub's tRPC-based slug resolution and Vercel's direct Drizzle join).

The Gateway sends `orgId` (Clerk org ID) directly, so Console just does a simple lookup: `SELECT * FROM orgWorkspaces WHERE clerkOrgId = ?`.

For events that need a specific workspace integration (e.g., to check which events are enabled), the `connectionId` from the envelope maps back to a `workspaceIntegrations` row via the relational record that was created during connection setup.

### Success Criteria:

#### Automated Verification:
- [ ] Integration test: mock QStash delivery with valid signature → 200 response + Inngest event fired
- [ ] Invalid QStash signature → 401 response
- [ ] Unknown workspace → 200 response (graceful skip)
- [ ] `pnpm build:console` compiles
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

#### Manual Verification:
- [ ] End-to-end: GitHub webhook → Gateway→ QStash → Console ingress → Inngest event visible in Inngest dashboard
- [ ] Verify `workspaceIngestionPayloads` table has the raw payload stored
- [ ] Verify existing observation capture pipeline processes the event correctly

**Implementation Note**: This is the critical integration point. Pause for thorough end-to-end manual testing.

---

## Phase 5: Connection Lifecycle (Upstash Workflow)

### Overview
Implement OAuth flows and connection lifecycle management using Upstash Workflow for step-level durability. Includes the token vault API that Console will use to obtain decrypted provider tokens.

### Changes Required:

#### 1. OAuth Routes
**File**: `apps/gateway/src/routes/connections.ts`

**Initiation** — `GET /connections/:provider/authorize`:
- Generate OAuth state: `crypto.randomUUID()` + nonce + timestamp
- Store in Redis: `HSET oauth:{state_token} { org_id, provider, redirect_path, nonce }` with TTL 600
- Build authorization URL via `provider.getAuthorizationUrl(state, options)`
- Return redirect URL (client opens popup to this URL)

**Callback** — `GET /connections/:provider/callback`:
- Read `state` and `code` from query params
- Validate state against Redis: `HGETALL oauth:{state_token}`
- Delete state from Redis (one-time use)
- Trigger connection setup workflow (async)
- Redirect popup to `${redirectPath}?connected=true`

**GitHub-specific**: The install-app → authorize-user chain remains. Gatewayhandles both steps:
- `GET /connections/github/install` → redirect to GitHub App installation
- `GET /connections/github/installed` → capture `installation_id`, chain to authorize

**Token Vault** — `GET /connections/:id/token` (API key auth):
- Verify `X-API-Key` matches `GATEWAY_API_KEY`
- Read `connection:{id}` from Redis
- Decrypt credentials via AES-256-GCM
- Return `{ accessToken, expiresAt }` with short TTL header (no caching)

**Status** — `GET /connections/:id` (API key auth):
- Read `connection:{id}` from Redis
- Return `{ id, orgId, provider, status, providerAccountId, createdAt }`

**Teardown** — `DELETE /connections/:provider/:id` (API key auth):
- Trigger teardown workflow (async)
- Return `{ status: "teardown_initiated" }`

**Resource linking** — `POST /connections/:id/resources` (API key auth):
- Input: `{ resources: [{ resourceId, resourceName }] }`
- For each resource: `HSET resource:{provider}:{resourceId} { connection_id, org_id, resource_name, status }` and `SADD connection:{id}:resources resourceId`
- Return `{ linked: count }`

**Resource unlinking** — `DELETE /connections/:id/resources/:resourceId` (API key auth):
- `DEL resource:{provider}:{resourceId}`
- `SREM connection:{id}:resources resourceId`

#### 2. Setup Workflow
**File**: `apps/gateway/src/workflows/setup.ts`

Uses `@vendor/upstash-workflow` `serve()`:

```
Step 1: "exchange-code"
  → Call provider.exchangeCode(code, redirectUri)
  → Returns { accessToken, refreshToken, expiresIn }

Step 2: "persist-to-console"
  → POST to Console API: /api/connections/created
  → Body: { orgId, provider, providerAccountId, providerMetadata, encryptedToken }
  → Console INSERTs into PlanetScale (source of truth)
  → Returns { connectionId }

Step 3: "cache-in-redis"
  → HSET connection:{conn_id} { org_id, provider, status: "active", credentials: <encrypted>, ... }
  → SADD org:{org_id}:connections conn_id
  → SET provider:{provider}:{account_id} conn_id

Step 4: "register-webhook" (if provider.requiresWebhookRegistration)
  → Generate per-connection webhook secret
  → Call provider.registerWebhook(connectionId, callbackUrl, secret)
  → Store webhookId and secret in connection hash

Step 5: "schedule-token-refresh" (if token expires)
  → QStash scheduled publish: token-refresh workflow
  → Delay: expiresIn - 3000 seconds
```

#### 3. Teardown Workflow
**File**: `apps/gateway/src/workflows/teardown.ts`

```
Step 1: "deregister-webhook"
  → If provider.deregisterWebhook, call it (graceful failure)

Step 2: "revoke-token"
  → Decrypt credentials, call provider.revokeToken()

Step 3: "cleanup-redis"
  → SMEMBERS connection:{conn_id}:resources → all resource_ids
  → Pipeline DEL resource:{provider}:{resource_id} for each
  → DEL connection:{conn_id}:resources
  → SREM org:{org_id}:connections conn_id
  → DEL connection:{conn_id}

Step 4: "notify-console"
  → QStash publish to Console: /api/connections/removed
  → Console soft-deletes workspaceIntegrations and userSources
```

#### 4. Token Refresh Workflow
**File**: `apps/gateway/src/workflows/token-refresh.ts`

```
Step 1: "load-connection"
  → HGETALL connection:{conn_id}

Step 2: "refresh"
  → Decrypt credentials
  → Call provider.refreshToken(refreshToken)

Step 3: "store"
  → HSET connection:{conn_id} credentials=<new encrypted>, updated_at=now
  → POST to Console API: /api/connections/token-refreshed

Step 4: "schedule-next"
  → QStash scheduled publish: this workflow with delay = new_expires_in - 3000
```

#### 5. Console-side Connection Event Handlers
**File**: `apps/console/src/app/api/connections/created/route.ts`

Receives POST from Gateway(QStash-signed or API-key-authenticated):
- Upserts `userSources` row with encrypted token and provider metadata
- Creates or reactivates `workspaceIntegrations` rows
- Returns `{ connectionId }`

**File**: `apps/console/src/app/api/connections/removed/route.ts`
- Soft-deletes `workspaceIntegrations` and `userSources`
- Cancels in-flight Inngest workflows

**File**: `apps/console/src/app/api/connections/token-refreshed/route.ts`
- Updates `userSources.accessToken` and `tokenExpiresAt` in PlanetScale

### Success Criteria:

#### Automated Verification:
- [ ] Unit tests: setup workflow step sequence completes with mocked provider and Console API
- [ ] Unit tests: teardown workflow cleans up all Redis keys
- [ ] Unit tests: token refresh workflow updates credentials
- [ ] Unit tests: token vault returns decrypted token for valid connection
- [ ] Unit tests: token vault returns 404 for unknown connection
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

#### Manual Verification:
- [ ] GitHub OAuth flow: popup → install → authorize → callback → connection active in Redis + PlanetScale
- [ ] Vercel OAuth flow: popup → authorize → callback → connection active
- [ ] Token vault: Console can request and receive a valid GitHub token
- [ ] Teardown: delete connection → Redis keys cleaned up, PlanetScale soft-deleted
- [ ] Upstash Workflow dashboard shows completed workflow runs

**Implementation Note**: This is the largest phase. Pause for thorough testing of all OAuth flows and the token vault.

---

## Phase 6: Console Token Migration

### Overview
Update all Console workflows that decrypt provider tokens to instead request them from the Gateway token vault. Create a Gatewayclient package for Console to use.

### Changes Required:

#### 1. GatewayClient Package
**File**: `packages/console-gateway-client/src/index.ts`

```typescript
export class GatewayClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  async getToken(connectionId: string): Promise<{ accessToken: string; expiresAt?: number }> {
    const res = await fetch(`${this.baseUrl}/connections/${connectionId}/token`, {
      headers: { "X-API-Key": this.apiKey },
    })
    if (!res.ok) throw new Error(`Gateway token request failed: ${res.status}`)
    return res.json()
  }

  async getConnection(connectionId: string): Promise<ConnectionInfo> { ... }
  async linkResources(connectionId: string, resources: Resource[]): Promise<void> { ... }
  async unlinkResource(connectionId: string, resourceId: string): Promise<void> { ... }
}
```

#### 2. Update Backfill Orchestrator
**File**: `api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts`

Currently at line 136: `const decryptedToken = decrypt(source.accessToken, env.ENCRYPTION_KEY)`

Change to:
```typescript
const { accessToken: decryptedToken } = await gatewayClient.getToken(source.connectionId)
```

This requires the `workspaceIntegrations` row to carry a `connectionId` reference (added during connection setup in Phase 5).

#### 3. Update GitHub Sync Orchestrator
**File**: `api/console/src/inngest/workflow/sources/github-sync-orchestrator.ts`

The GitHub sync uses `createGitHubApp()` for App-level auth (not user tokens). This remains unchanged — GitHub App auth is independent of user OAuth tokens. The sync orchestrator does not need Gatewaytoken access.

#### 4. Update userSources Router
**File**: `api/console/src/router/user/user-sources.ts`

- `github.validate` (line 191): Replace `decrypt(userSource.accessToken, env.ENCRYPTION_KEY)` with Gatewaytoken vault call
- `github.repositories` (line 450): Currently uses GitHub App auth (`createGitHubApp`), not user token — no change needed
- `vercel.listProjects` (line 853): Replace `decrypt(source.accessToken, env.ENCRYPTION_KEY)` with Gatewaytoken vault call

Both procedures need the `connectionId` to call the Gateway. The `userSources` table carries this via the connection record created in Phase 5.

#### 5. Add connectionId to Schema
**File**: `db/console/src/schema/tables/user-sources.ts`

Add `connectionId` column (nullable varchar) to `userSources` table. This links the user source to its Gatewayconnection. Populated during the `connections/created` handler in Phase 5.

**File**: `db/console/src/schema/tables/workspace-integrations.ts`

Add `connectionId` column (nullable varchar) to `workspaceIntegrations` table. Populated during resource linking.

Generate migration: `pnpm --filter @db/console db:generate`

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @db/console db:generate` produces a clean migration
- [ ] `pnpm --filter @db/console db:migrate` applies successfully
- [ ] Unit tests: Gatewayclient correctly calls token vault endpoint
- [ ] `pnpm build:console` compiles
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

#### Manual Verification:
- [ ] Backfill workflow successfully fetches historical data using token from Gatewayvault
- [ ] `userSources.github.validate` successfully validates installations using token from Gatewayvault
- [ ] `userSources.vercel.listProjects` successfully lists projects using token from Gatewayvault
- [ ] All existing Inngest workflows continue to function correctly

**Implementation Note**: Pause for end-to-end testing of all token-dependent workflows.

---

## Phase 7: Client-Side Refactor

### Overview
Replace the distributed connection management UI (ConnectFormProvider, GitHubConnector, VercelConnector, etc.) with a unified `useConnection(provider)` hook that talks to the Gateway for OAuth and to Console's tRPC for resource management.

### Changes Required:

#### 1. useConnection Hook
**File**: `apps/console/src/hooks/use-connection.ts`

```typescript
function useConnection(provider: Provider) {
  // Connection status from Gatewayvia tRPC proxy
  const connectionQuery = trpc.connections.get.useQuery({ provider })

  // Resource management via existing tRPC
  const linkMutation = trpc.workspace.integrations.bulkLink.useMutation()
  const unlinkMutation = trpc.workspace.integrations.disconnect.useMutation()

  return {
    status,        // "disconnected" | "connecting" | "connected" | "error"
    connection,    // { id, provider, providerAccountId, metadata }
    connect,       // () => opens popup to GatewayOAuth URL, polls for completion
    disconnect,    // () => calls Gatewayteardown via tRPC proxy
    resources,     // linked resources from workspace.sources.list
    linkResources, // (resourceIds[]) => calls bulkLink mutation
    unlinkResource,// (resourceId) => calls disconnect mutation
  }
}
```

The popup OAuth flow targets GatewayURLs now:
- GitHub: `gateway.lightfast.ai/connections/github/install?redirect=...`
- Vercel: `gateway.lightfast.ai/connections/vercel/authorize?redirect=...`
- Linear: `gateway.lightfast.ai/connections/linear/authorize?redirect=...`
- Sentry: `gateway.lightfast.ai/connections/sentry/authorize?redirect=...`

#### 2. tRPC Proxy for Gateway
**File**: `api/console/src/router/user/connections.ts`

Add a thin `connectionsRouter` that proxies status queries to Gateway:

```typescript
export const connectionsRouter = router({
  get: userScopedProcedure.input(z.object({ provider: z.string() })).query(async ({ ctx, input }) => {
    // Query Gatewayfor connection status for this user's org
    const connection = await gatewayClient.getConnectionForOrg(ctx.auth.orgId, input.provider)
    return connection
  }),
})
```

#### 3. Simplified Connect Page
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/connect/page.tsx`

Simplify to use `useConnection`:
- Remove `ConnectFormProvider` wrapper
- Replace `GitHubConnector` / `VercelConnector` with a generic `ProviderConnector` that uses `useConnection`
- Replace `ConnectButton` with inline submit using `useConnection().linkResources`
- Add real Linear and Sentry connector UIs (replace "coming soon" placeholders)

#### 4. Remove Deprecated Components
Delete or archive:
- `connect-form-provider.tsx` (replaced by `useConnection` hook)
- `connect-button.tsx` (inline in connect page)
- `github-connector.tsx` (replaced by generic `ProviderConnector`)
- `vercel-connector.tsx` (replaced by generic `ProviderConnector`)

#### 5. Linear and Sentry Resource Selectors
New components for selecting Linear teams/projects and Sentry projects/DSNs. These call Gateway for resource listing (Gateway calls provider APIs using the stored token).

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm build:console` compiles
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] No imports of removed components remain

#### Manual Verification:
- [ ] GitHub connect flow works end-to-end via new UI
- [ ] Vercel connect flow works end-to-end via new UI
- [ ] Linear connect flow works (new provider)
- [ ] Sentry connect flow works (new provider)
- [ ] Resource selection and linking works for all providers
- [ ] Disconnect flow works for all providers
- [ ] InstalledSources page shows connections from all providers

**Implementation Note**: Pause for comprehensive UI testing across all providers.

---

## Phase 8: Console Route Cleanup

### Overview
Remove the old webhook routes, OAuth routes, and packages that are now handled by the Gateway.

### Changes Required:

#### 1. Remove Old Webhook Routes
Delete:
- `apps/console/src/app/(github)/api/github/webhooks/route.ts` (609 lines)
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` (223 lines)

#### 2. Remove Old OAuth Routes
Delete:
- `apps/console/src/app/(github)/api/github/install-app/route.ts`
- `apps/console/src/app/(github)/api/github/authorize-user/route.ts`
- `apps/console/src/app/(github)/api/github/app-installed/route.ts`
- `apps/console/src/app/(github)/api/github/user-authorized/route.ts`
- `apps/console/src/app/(vercel)/api/vercel/authorize/route.ts`
- `apps/console/src/app/(vercel)/api/vercel/callback/route.ts`

#### 3. Remove/Simplify Packages
- **`@repo/console-oauth`**: Remove entirely. State management, token encryption, and PKCE are now handled by Gateway's `lib/crypto.ts` and Redis state storage.
- **`@repo/console-webhooks`**: Remove verification modules (`common.ts:safeCompareSignatures/computeHmac*`, `github.ts:verifyGitHubWebhook*`, `vercel.ts:verifyVercelWebhook*`). Keep transformers and storage.
- **`packages/console-api-services/src/sources.ts`**: Simplify — remove M2M webhook-specific procedures that are now handled by Gateway.

#### 4. Simplify tRPC Routers
- **`userSourcesRouter`**: Remove `github.storeOAuthResult`, `vercel.storeOAuthResult` (Gateway handles via Console API). Keep `github.repositories`, `vercel.listProjects` (now using Gateway token vault). Keep `disconnect` (proxies to Gateway teardown).
- **`sourcesM2MRouter`**: Remove or simplify webhook-specific procedures (`findByGithubRepoId`, lifecycle event handlers). The Gateway now handles these directly.
- **`workspace.integrations`**: Keep `bulkLink*` mutations (still called by client). Update to also call Gateway`linkResources` to populate Redis routing cache.

#### 5. Remove Route Groups
If the `(github)` and `(vercel)` route groups are now empty, remove the directories entirely.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm build:console` compiles with no errors
- [ ] `pnpm typecheck` passes — no broken imports
- [ ] `pnpm lint` passes
- [ ] No references to removed files remain in the codebase (grep for old import paths)

#### Manual Verification:
- [ ] Console app starts and all existing pages load correctly
- [ ] No 404s on any Console routes
- [ ] Sources page shows connected integrations
- [ ] Connect page works for all providers

**Implementation Note**: Pause for thorough regression testing of Console.

---

## Phase 9: Admin & Cache Management

### Overview
Implement operational endpoints for cache rebuild, health monitoring, and DLQ management.

### Changes Required:

#### 1. Cache Rebuild
**File**: `apps/gateway/src/routes/admin.ts`

`POST /admin/cache/rebuild` (API key auth):
- Fetch all active connections from Console API (Console queries PlanetScale)
- Pipeline `HSET` into Redis for each connection + resource
- Return `{ rebuilt: count, duration_ms }`
- Idempotent — can run anytime, rebuilds from scratch

#### 2. Health Endpoint
`GET /admin/health`:
- Check Redis ping
- Check QStash connectivity
- Return `{ status: "ok", redis: "connected", qstash: "connected", uptime_ms }`

#### 3. DLQ Management
`GET /admin/dlq` (API key auth):
- List messages in the webhook DLQ topic
- Return `{ messages: [...], count }`

`POST /admin/dlq/replay` (API key auth):
- Re-publish selected DLQ messages to the main delivery pipeline
- Return `{ replayed: count }`

#### 4. Delivery Status Callback
`POST /admin/delivery-status`:
- QStash calls this after successful or failed delivery to Console
- Log delivery outcomes for monitoring
- On final failure: move to DLQ

### Success Criteria:

#### Automated Verification:
- [ ] `POST /admin/cache/rebuild` rebuilds Redis from Console API mock
- [ ] `GET /admin/health` returns 200 with all checks passing
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

#### Manual Verification:
- [ ] Cache rebuild correctly populates Redis from PlanetScale data
- [ ] DLQ shows any failed deliveries
- [ ] DLQ replay successfully re-delivers messages

---

## Phase 10: Cutover & Deployment

### Overview
Deploy the Gateway to production, update provider webhook URLs, and verify end-to-end operation.

### Changes Required:

#### 1. Deploy Gateway
- Create Vercel project for `apps/gateway`
- Set root directory to `apps/gateway`
- Configure all environment variables
- Deploy to `gateway.lightfast.ai`
- Verify health endpoint

#### 2. Run Cache Rebuild
- Call `POST /admin/cache/rebuild` to populate Redis from existing PlanetScale data
- Verify all active connections and resources are in Redis

#### 3. Update Provider Webhook URLs
- **GitHub**: Update GitHub App webhook URL from `lightfast.ai/api/github/webhooks` to `gateway.lightfast.ai/webhooks/github`
- **Vercel**: Update Vercel integration webhook URL from `lightfast.ai/api/vercel/webhooks` to `gateway.lightfast.ai/webhooks/vercel`
- **Linear**: Register webhooks via Gateway's setup workflow (new connections)
- **Sentry**: Register webhooks via Gateway's setup workflow (new connections)

#### 4. Update OAuth Redirect URLs
- **GitHub**: Update GitHub App callback URL to `gateway.lightfast.ai/connections/github/callback`
- **Vercel**: Update Vercel integration redirect URI to `gateway.lightfast.ai/connections/vercel/callback`
- **Linear**: Register `gateway.lightfast.ai/connections/linear/callback` in Linear app settings
- **Sentry**: Register `gateway.lightfast.ai/connections/sentry/callback` in Sentry integration settings

#### 5. Verify End-to-End
- Push a commit to a connected GitHub repository → verify observation appears in Console
- Deploy on Vercel → verify deployment event appears in Console
- Create a Linear issue → verify it appears (if Linear connections exist)
- Trigger a Sentry error → verify it appears (if Sentry connections exist)
- Run a backfill → verify it uses Gatewaytoken vault
- Disconnect and reconnect a source → verify full lifecycle

### Success Criteria:

#### Automated Verification:
- [ ] Gatewayhealth endpoint returns 200
- [ ] Redis has all active connections populated
- [ ] QStash dashboard shows successful deliveries

#### Manual Verification:
- [ ] GitHub push webhook → Gateway→ QStash → Console → Inngest pipeline completes
- [ ] Vercel deployment webhook → same pipeline completes
- [ ] OAuth flows work for all four providers from the Connect UI
- [ ] Token vault returns valid tokens for Console workflows
- [ ] DLQ is empty under normal operation
- [ ] Old webhook routes in Console return 404 (confirming they're removed)

---

## Testing Strategy

### Unit Tests:
- Provider `verifyWebhook` against known test vectors (replay recorded webhooks)
- Provider OAuth URL generation
- Redis key convention functions
- Crypto encrypt/decrypt round-trip
- Webhook deduplication logic

### Integration Tests:
- Full webhook receipt pipeline (mock provider → Gateway→ mock QStash → verify publish call)
- Setup workflow (mock provider → mock Console API → verify Redis state)
- Teardown workflow (verify all Redis keys cleaned up)
- Token vault (verify decryption and response format)
- Cache rebuild (mock Console API → verify Redis populated)

### End-to-End Tests:
- GitHub push → Gateway→ Console → Inngest (staging environment)
- OAuth flow → connection created → webhook receipt → event processed

### Manual Testing Steps:
1. Trigger a GitHub push webhook via ngrok and verify it flows through to Inngest
2. Complete a full GitHub OAuth flow in the connect UI
3. Disconnect a source and verify teardown completes
4. Kill the Gateway and verify QStash retries delivery to Console
5. Flush Redis and rebuild cache, then verify webhooks still route correctly

## Performance Considerations

- **Webhook receipt target**: < 50ms P99 (1 signature verify + 2 Redis calls + 1 QStash publish)
- **Redis operations**: `enableAutoPipelining: true` already configured in `@vendor/upstash`
- **QStash publish**: ~20ms P50 to Upstash (measured in existing workflow usage)
- **Token vault**: < 100ms (1 Redis read + 1 AES decrypt)
- **Cold starts**: Node.js Fluid Compute on Vercel ~115ms P50; acceptable for webhook receipt since providers allow seconds of latency

## Migration Notes

**Big bang cutover** — no parallel operation period:
1. Build and test Gatewaythoroughly in staging
2. Run cache rebuild to populate Redis
3. Deploy Gatewayto production
4. Update all provider webhook URLs simultaneously
5. Verify in production
6. Remove old routes from Console in a follow-up deploy

**Rollback plan**: If Gatewayfails in production, revert provider webhook URLs to the old Console endpoints (they still exist until Phase 8 cleanup). Phase 8 cleanup should be a separate deployment after Gatewayis confirmed stable.

**Data migration**: The `connectionId` column added in Phase 6 needs to be backfilled for existing connections. A one-time script queries all active `userSources` + `workspaceIntegrations` and creates corresponding Gatewayconnections via the setup API (or directly via Redis + PlanetScale writes).

## References

- Architecture research: `thoughts/shared/research/2026-02-25-webhook-connection-manager-architecture.md`
- Current webhook handlers: `apps/console/src/app/(github)/api/github/webhooks/route.ts:462`, `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:139`
- Current OAuth routes: `apps/console/src/app/(github)/api/github/user-authorized/route.ts:35`, `apps/console/src/app/(vercel)/api/vercel/callback/route.ts:44`
- Upstash vendor: `vendor/upstash/`, `vendor/upstash-workflow/`
- Console webhooks package: `packages/console-webhooks/src/`
- Console OAuth package: `packages/console-oauth/src/`
- User sources router: `api/console/src/router/user/user-sources.ts`
- Workspace integrations: `api/console/src/router/org/workspace.ts:880-1457`
- M2M sources router: `api/console/src/router/m2m/sources.ts`
- Linear transformers: `packages/console-webhooks/src/transformers/linear.ts`
- Sentry transformers: `packages/console-webhooks/src/transformers/sentry.ts`
- Event type registry: `packages/console-types/src/integrations/event-types.ts`
- Inngest push handler: `api/console/src/inngest/workflow/providers/github/push-handler.ts`
- Inngest backfill orchestrator: `api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts`
- Superseded plans: `thoughts/shared/plans/2026-02-11-org-owned-oauth-architecture.md`
