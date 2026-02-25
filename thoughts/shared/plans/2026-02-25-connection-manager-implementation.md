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

## Phase 3: Webhook Receipt Pipeline (Upstash Workflow)

### Overview
Implement the webhook receipt pipeline as two layers: a thin Hono route that verifies signatures and returns a fast ACK to the provider, then triggers a durable Upstash Workflow for the multi-step processing (dedup → resolve connection → publish to Console via QStash). Each step is independently retried — if QStash publish fails after dedup, only the publish retries.

**Architecture:**
```
Provider (GitHub, Vercel, etc.)
        │
        ▼
POST /webhooks/:provider  ←── thin Hono route (verify sig, fast 200)
        │
        ▼
WorkflowClient.trigger()  ←── kicks off durable workflow
        │
        ▼
QStash → POST /workflows/webhook-receipt  ←── serve() endpoint
                    │
        ┌───────────▼──────────────┐
        │  Step 1: dedup           │ ← skipped on retry
        │  Step 2: resolve-conn    │ ← skipped on retry
        │  Step 3: publish/dlq     │ ← retried from here
        └──────────────────────────┘
```

**Why two layers?**
- Invalid webhooks are rejected immediately with no workflow overhead (no QStash step scheduling, no Redis dedup key consumed)
- Valid webhooks get a fast 200 ACK (provider doesn't wait for dedup/resolve/publish)
- Each processing step is independently retried with step-level durability
- Workflow execution is visible in the Upstash Workflow dashboard

`@upstash/workflow/hono` already exists in the installed package — we need to add a `./hono` export to `@vendor/upstash-workflow`.

### Changes Required:

#### 3.1. Add Hono Adapter to `@vendor/upstash-workflow`
**File**: `vendor/upstash-workflow/src/hono.ts`

Create a Hono-specific `serve()` wrapper, mirroring the existing `nextjs.ts` pattern:

```typescript
import { serve as upstashServe } from "@upstash/workflow/hono"
import type { WorkflowHandler } from "./types"

export function serve<TPayload = unknown>(
  handler: WorkflowHandler,
  options?: {
    verbose?: boolean
    disableTelemetry?: boolean
    initialPayloadParser?: (raw: string) => TPayload
    failureFunction?: (params: { context: any; failStatus: number; failResponse: string }) => Promise<void>
  },
) {
  const wrappedHandler: WorkflowHandler = async (context) => {
    try {
      if (options?.verbose) {
        console.log("[Workflow] Starting workflow execution", {
          requestPayload: context.requestPayload,
        })
      }
      await handler(context)
    } catch (error) {
      console.error("[Workflow] Workflow execution failed:", error)
      throw error
    }
  }

  return upstashServe<TPayload>(wrappedHandler, {
    disableTelemetry: options?.disableTelemetry ?? false,
    initialPayloadParser: options?.initialPayloadParser,
    failureFunction: options?.failureFunction,
  })
}
```

**File**: `vendor/upstash-workflow/package.json` — add `"./hono": "./src/hono.ts"` export

**File**: `vendor/upstash-workflow/package.json` — add `hono` to dependencies (for type resolution)

#### 3.2. Webhook Receipt Payload Type
**File**: `apps/gateway/src/workflows/types.ts`

Define the internal payload contract between the route and the workflow:

```typescript
export interface WebhookReceiptPayload {
  provider: string
  deliveryId: string
  eventType: string
  resourceId: string | null
  payload: unknown
  receivedAt: number
}
```

#### 3.3. Webhook Receipt Route (Thin Verification Layer)
**File**: `apps/gateway/src/routes/webhooks.ts`

The route handler does only two things: verify the provider's webhook signature, and trigger the durable workflow. Returns 200 immediately to the provider.

```typescript
import { Hono } from "hono"
import { getProvider } from "../providers"
import { getWebhookSecret } from "../lib/secrets"
import { workflowClient } from "../lib/workflow-client"
import { env } from "../env"

const webhooks = new Hono()

/**
 * POST /webhooks/:provider
 *
 * Thin verification layer. Validates provider signature, extracts identifiers,
 * triggers durable workflow, returns fast 200 ACK.
 *
 * Target: < 20ms (1 sig verify + 1 workflow trigger)
 */
webhooks.post("/:provider", async (c) => {
  const providerName = c.req.param("provider")

  let provider
  try {
    provider = getProvider(providerName)
  } catch {
    return c.json({ error: "unknown_provider", provider: providerName }, 400)
  }

  // Read raw body for HMAC verification
  const rawBody = await c.req.text()
  const headers = c.req.raw.headers

  // Verify webhook signature — reject invalid webhooks immediately
  const secret = await getWebhookSecret(provider.name)
  const valid = await provider.verifyWebhook(rawBody, headers, secret)
  if (!valid) {
    return c.json({ error: "invalid_signature" }, 401)
  }

  // Parse payload + extract identifiers (cheap, no I/O)
  let payload: unknown
  try {
    payload = JSON.parse(rawBody) as unknown
  } catch {
    return c.json({ error: "invalid_json" }, 400)
  }

  const deliveryId = provider.extractDeliveryId(headers, payload)
  const eventType = provider.extractEventType(headers, payload)
  const resourceId = provider.extractResourceId(payload)

  // Trigger durable workflow — processing happens asynchronously
  await workflowClient.trigger({
    url: `${env.GATEWAY_BASE_URL}/workflows/webhook-receipt`,
    body: {
      provider: provider.name,
      deliveryId,
      eventType,
      resourceId,
      payload,
      receivedAt: Date.now(),
    },
  })

  return c.json({ status: "accepted", deliveryId }, 200)
})

export { webhooks }
```

#### 3.4. Webhook Receipt Workflow (Durable Pipeline)
**File**: `apps/gateway/src/workflows/webhook-receipt.ts`

Uses `serve()` from the Hono adapter. Each step is independently retried — if the QStash publish to Console fails, only step 3 retries (dedup and resolve are already complete).

```typescript
import { serve } from "@vendor/upstash-workflow/hono"
import { redis } from "../lib/redis"
import { qstash } from "../lib/qstash"
import { webhookSeenKey, resourceKey } from "../lib/keys"
import { env } from "../env"
import type { WebhookReceiptPayload } from "./types"

interface ConnectionInfo {
  connectionId: string
  orgId: string
}

export const webhookReceiptWorkflow = serve<WebhookReceiptPayload>(
  async (context) => {
    const data = context.requestPayload

    // Step 1: Deduplication — set NX (only if not exists), TTL 24h
    const isDuplicate = await context.run("dedup", async () => {
      const result = await redis.set(
        webhookSeenKey(data.provider, data.deliveryId),
        "1",
        { nx: true, ex: 86400 },
      )
      return !result // null = key already existed = duplicate
    })

    if (isDuplicate) return // workflow ends — duplicate delivery

    // Step 2: Resolve connection from resource ID via Redis cache
    const connectionInfo = await context.run<ConnectionInfo | null>(
      "resolve-connection",
      async () => {
        if (!data.resourceId) return null

        const cached = await redis.hgetall<Record<string, string>>(
          resourceKey(data.provider, data.resourceId),
        )
        if (cached?.connectionId && cached.orgId) {
          return { connectionId: cached.connectionId, orgId: cached.orgId }
        }
        return null
      },
    )

    // Step 3: Publish — either to Console ingress or to DLQ
    if (!connectionInfo) {
      await context.run("publish-to-dlq", async () => {
        await qstash.publishToTopic({
          topic: "webhook-dlq",
          body: {
            provider: data.provider,
            deliveryId: data.deliveryId,
            eventType: data.eventType,
            resourceId: data.resourceId,
            payload: data.payload,
            receivedAt: data.receivedAt,
          },
        })
      })
      return
    }

    await context.run("publish-to-console", async () => {
      await qstash.publishJSON({
        url: env.CONSOLE_INGRESS_URL,
        body: {
          deliveryId: data.deliveryId,
          connectionId: connectionInfo.connectionId,
          orgId: connectionInfo.orgId,
          provider: data.provider,
          eventType: data.eventType,
          payload: data.payload,
          receivedAt: data.receivedAt,
        },
        retries: 5,
        deduplicationId: `${data.provider}:${data.deliveryId}`,
        callback: `${env.GATEWAY_BASE_URL}/admin/delivery-status`,
      })
    })
  },
  {
    failureFunction: async ({ context, failStatus, failResponse }) => {
      console.error("[webhook-receipt] workflow failed", {
        failStatus,
        failResponse,
        workflowRunId: context.workflowRunId,
      })
    },
  },
)
```

#### 3.5. Workflow Client Setup
**File**: `apps/gateway/src/lib/workflow-client.ts`

Re-exports the `WorkflowClient` singleton for triggering workflows from route handlers:

```typescript
import { getWorkflowClient } from "@vendor/upstash-workflow/client"

export const workflowClient = getWorkflowClient()
```

#### 3.6. Mount Workflow Route
**File**: `apps/gateway/src/routes/workflows.ts`

Mounts the workflow `serve()` handler on the Hono app:

```typescript
import { Hono } from "hono"
import { webhookReceiptWorkflow } from "../workflows/webhook-receipt"

const workflows = new Hono()

// Upstash Workflow calls back to this endpoint for each step
workflows.post("/webhook-receipt", webhookReceiptWorkflow)

export { workflows }
```

**File**: `apps/gateway/src/app.ts` — mount the workflows router at `/workflows`

#### 3.7. Webhook Secret Resolution
**File**: `apps/gateway/src/lib/secrets.ts`

For GitHub and Vercel: global webhook secrets from environment variables.
For Linear and Sentry: per-connection webhook secrets stored in `connection:{id}` Redis hash.

```typescript
import { env } from "../env"

export async function getWebhookSecret(provider: string): Promise<string> {
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
- [x] `pnpm --filter @vendor/upstash-workflow build` compiles with new Hono export
- [x] `pnpm --filter @lightfast/gateway build` compiles
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [ ] Integration tests: mock webhook → verify → workflow trigger → dedup → resolve → QStash publish (mocked)
- [ ] Duplicate webhook: workflow ends after dedup step (no QStash publish)
- [ ] Invalid signature: rejected at route level (no workflow triggered)
- [ ] Unknown resource: routes to DLQ topic via workflow step

#### Manual Verification:
- [ ] Send a real GitHub webhook (via ngrok) and verify the workflow executes all steps in Upstash dashboard
- [ ] Send a duplicate delivery ID and verify it's deduplicated at step 1
- [ ] Send an invalid signature and verify 401 response (no workflow triggered)
- [ ] Verify workflow step-level retry: kill Redis mid-workflow, verify it resumes from failed step

**Implementation Note**: Pause for manual webhook receipt testing before proceeding.

---

## Phase 4: Console Webhook Ingress (Upstash Workflow)

### Overview
Create a durable webhook ingress pipeline in Console using Upstash Workflow's `serve()`. Instead of a plain route handler that could fail mid-processing, each step (resolve workspace → store payload → transform → dispatch to Inngest) gets step-level durability — if step 3 fails, the workflow retries from step 3, not from scratch.

This replaces the existing 832 lines across two webhook route handlers with a single, durable workflow endpoint.

**Architecture:**
```
Gateway → QStash → Console serve() endpoint → durable step pipeline → Inngest
                                    │
                    ┌───────────────▼────────────────┐
                    │  Step 1: resolve-workspace      │ ← skipped on retry
                    │  Step 2: store-payload          │ ← skipped on retry
                    │  Step 3: transform              │ ← retried from here
                    │  Step 4: dispatch-to-inngest    │
                    └─────────────────────────────────┘
```

`@vendor/upstash-workflow` is already vendored and ready — `serve()` exports `{ POST }` directly compatible with Next.js App Router. QStash signature verification is handled automatically by the workflow SDK (it validates `Upstash-Signature` headers on every invocation).

### Changes Required:

#### 4.1. Webhook Envelope Types
**File**: `packages/console-types/src/webhooks/envelope.ts`

Define the shared contract between Gateway and Console:

```typescript
export interface WebhookEnvelope {
  deliveryId: string
  connectionId: string
  orgId: string
  provider: "github" | "vercel" | "linear" | "sentry"
  eventType: string
  payload: unknown
  receivedAt: number
}
```

Export from `@repo/console-types` package index.

#### 4.2. Workspace Resolution Helper
**File**: `apps/console/src/app/api/webhooks/ingress/resolve-workspace.ts`

Creates a `resolveWorkspaceFromOrgId(orgId)` function that queries `orgWorkspaces` by `clerkOrgId`. This replaces the per-provider workspace resolution in the current handlers (GitHub's tRPC-based slug resolution and Vercel's direct Drizzle join).

The Gateway sends `orgId` (Clerk org ID) directly, so Console just does a simple lookup: `SELECT * FROM orgWorkspaces WHERE clerkOrgId = ?`.

For events that need a specific workspace integration (e.g., to check which events are enabled), the `connectionId` from the envelope maps back to a `workspaceIntegrations` row via the relational record that was created during connection setup.

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

#### 4.3. Ingress Workflow Endpoint
**File**: `apps/console/src/app/api/webhooks/ingress/route.ts`

Uses `serve()` from `@vendor/upstash-workflow/nextjs`. Each processing stage is a durable `context.run()` step — completed steps are skipped on retry, failures are retried from the failed step only.

```typescript
import { serve } from "@vendor/upstash-workflow/nextjs"
import type { WebhookEnvelope } from "@repo/console-types"
import { resolveWorkspaceFromOrgId } from "./resolve-workspace"
import { storeIngestionPayload } from "@repo/console-webhooks"
import { inngest } from "@vendor/inngest"

export const { POST } = serve<WebhookEnvelope>(
  async (context) => {
    const envelope = context.requestPayload

    // Step 1: Resolve workspace from orgId
    const workspace = await context.run("resolve-workspace", async () => {
      const ws = await resolveWorkspaceFromOrgId(envelope.orgId)
      if (!ws) return null
      return { workspaceId: ws.id, workspaceName: ws.name }
    })

    if (!workspace) return // graceful skip — no workspace found

    // Step 2: Store raw payload in workspaceIngestionPayloads
    await context.run("store-payload", async () => {
      await storeIngestionPayload({
        workspaceId: workspace.workspaceId,
        deliveryId: envelope.deliveryId,
        source: envelope.provider,
        payload: JSON.stringify(envelope.payload),
        headers: {},
      })
    })

    // Step 3: Dispatch to Inngest
    // Routes to existing Inngest events based on provider + eventType.
    // Transformers remain in @repo/console-webhooks — called by Inngest handlers, not here.
    await context.run("dispatch-to-inngest", async () => {
      await dispatchToInngest(envelope, workspace)
    })
  },
  {
    // Raw body comes as string from QStash — parse into typed envelope
    initialPayloadParser: (raw: string): WebhookEnvelope => {
      return JSON.parse(raw) as WebhookEnvelope
    },
    failureFunction: async ({ context, failStatus, failResponse }) => {
      console.error("[webhook-ingress] workflow failed", {
        failStatus,
        failResponse,
        workflowRunId: context.workflowRunId,
      })
    },
  },
)
```

**Note on QStash signature verification**: The `serve()` function from `@upstash/workflow` automatically verifies the `Upstash-Signature` header on every invocation using `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` environment variables. No manual `Receiver.verify()` call needed.

#### 4.4. Inngest Dispatch Router
**File**: `apps/console/src/app/api/webhooks/ingress/dispatch.ts`

Maps provider + eventType to existing Inngest events. Keeps the dispatch logic isolated from the workflow steps.

```typescript
import { inngest } from "@vendor/inngest"
import type { WebhookEnvelope } from "@repo/console-types"

interface WorkspaceInfo {
  workspaceId: string
  workspaceName: string
}

export async function dispatchToInngest(
  envelope: WebhookEnvelope,
  workspace: WorkspaceInfo,
) {
  const { provider, eventType, payload, deliveryId, connectionId } = envelope

  switch (provider) {
    case "github":
      if (eventType === "push") {
        // Existing push handler + observation capture
        await inngest.send({
          name: "apps-console/github.push",
          data: { payload, workspaceId: workspace.workspaceId, deliveryId },
        })
      }
      // All GitHub events → observation capture
      await inngest.send({
        name: "apps-console/neural/observation.capture",
        data: {
          source: "github",
          eventType,
          payload,
          workspaceId: workspace.workspaceId,
          deliveryId,
        },
      })
      break

    case "vercel":
      await inngest.send({
        name: "apps-console/neural/observation.capture",
        data: {
          source: "vercel",
          eventType,
          payload,
          workspaceId: workspace.workspaceId,
          deliveryId,
        },
      })
      break

    case "linear":
      await inngest.send({
        name: "apps-console/neural/observation.capture",
        data: {
          source: "linear",
          eventType,
          payload,
          workspaceId: workspace.workspaceId,
          deliveryId,
        },
      })
      break

    case "sentry":
      await inngest.send({
        name: "apps-console/neural/observation.capture",
        data: {
          source: "sentry",
          eventType,
          payload,
          workspaceId: workspace.workspaceId,
          deliveryId,
        },
      })
      break
  }
}
```

#### 4.5. Console Environment Setup
**File**: `apps/console/.env` (or `.vercel/.env.development.local`)

Ensure QStash signing keys are available for `serve()` signature verification:

```
QSTASH_TOKEN=...
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...
```

These may already exist if `@vendor/upstash-workflow` env validation is active. Verify they're set.

For local development, `UPSTASH_WORKFLOW_URL` should point to the ngrok tunnel (already configured via `pnpm dev:app`).

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm build:console` compiles with the new workflow route
- [ ] `pnpm typecheck` passes — `WebhookEnvelope` type shared correctly between Gateway and Console
- [ ] `pnpm lint` passes
- [ ] Integration test: mock QStash delivery → workflow executes all 3 steps → Inngest event fired
- [ ] Invalid QStash signature → rejected by `serve()` automatically (401)
- [ ] Unknown workspace → workflow returns gracefully after step 1 (no error)

#### Manual Verification:
- [ ] End-to-end: GitHub webhook → Gateway → QStash → Console `serve()` ingress → Inngest event visible in Inngest dashboard
- [ ] Verify `workspaceIngestionPayloads` table has the raw payload stored
- [ ] Verify Upstash Workflow dashboard shows completed workflow runs with step-level detail
- [ ] Verify existing observation capture pipeline processes the event correctly
- [ ] Simulate step failure (e.g., DB down): verify workflow retries from failed step, not from scratch

**Implementation Note**: This is the critical integration point. Pause for thorough end-to-end manual testing. Verify both the happy path and the retry/durability behavior.

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

The gateway's webhook pipeline has 5 discrete steps, each with distinct failure modes:
1. Signature verification (crypto correctness per provider)
2. Payload extraction (provider-specific header/body traversal)
3. Deduplication (Redis NX semantics)
4. Connection resolution (Redis hash lookup)
5. QStash publication (payload shape and routing)

### Test Infrastructure

**vitest** as test runner. Config at `apps/gateway/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { globals: true, environment: "node" },
});
```

Scripts in `apps/gateway/package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

### Layer 1: Pure Unit Tests (zero mocks)

**`apps/gateway/src/__tests__/crypto.test.ts`** — Web Crypto API functions:
- `computeHmacSha256` — known test vector (message + secret → expected hex)
- `computeHmacSha1` — known test vector (Vercel's algorithm)
- `timingSafeEqual` — equal strings return true, different strings return false, different lengths return false
- `encrypt` / `decrypt` roundtrip — encrypt plaintext, decrypt recovers original
- `encrypt` produces different ciphertext each call (random IV)

**`apps/gateway/src/__tests__/keys.test.ts`** — Redis key format functions:
- Each key function returns the exact expected string pattern
- `webhookSeenKey("github", "abc-123")` → `"gw:webhook:seen:github:abc-123"`
- `resourceKey("linear", "org-456")` → `"gw:resource:linear:org-456"`
- All 7 key functions covered

### Layer 2: Provider Verification Tests (real crypto, no network)

One test file per provider:
- `apps/gateway/src/__tests__/providers/github.test.ts`
- `apps/gateway/src/__tests__/providers/vercel.test.ts`
- `apps/gateway/src/__tests__/providers/linear.test.ts`
- `apps/gateway/src/__tests__/providers/sentry.test.ts`

Each file covers:
1. **Valid signature → true**: Compute HMAC using the same function the provider uses, put it in the expected header, call `verifyWebhook` → must return `true`
2. **Tampered body → false**: Append `"x"` to body, same signature → must return `false`
3. **Missing signature header → false**: No signature header → must return `false`
4. **Wrong secret → false**: Different secret for verification → must return `false`
5. **extractDeliveryId**: Headers with the correct header → returns that value; missing header → returns a UUID
6. **extractEventType**: Headers with event → returns that value; missing → returns `"unknown"`
7. **extractResourceId**: Payload with expected fields → returns correct ID; empty payload → returns `null`

**Vercel-specific note:** `verifyWebhook` uses `computeHmacSha1` — tests must compute with SHA-1 to get a valid signature.

### Layer 3: Integration Tests (mocked Redis + QStash, real Hono)

**`apps/gateway/src/__tests__/routes/webhooks.test.ts`**

Setup:
- `vi.mock("../../env")` — return deterministic env values (secrets, URLs)
- `vi.mock("../../lib/workflow-client")` — mock `workflowClient.trigger()`
- Import `app` from `../../app` and use `app.request()` for in-process HTTP testing

Test matrix (all scenarios):

| Scenario | Setup | Expected |
|----------|-------|----------|
| Unknown provider | POST /webhooks/notreal | 400, `{error: "unknown_provider"}` |
| Missing signature header | No sig header | 401, `{error: "invalid_signature"}` |
| Wrong signature | Computed with different secret | 401, `{error: "invalid_signature"}` |
| Invalid JSON body | `rawBody = "not json"` with valid sig | 400, `{error: "invalid_json"}` |
| Happy path | Valid sig, valid JSON | 200, `{status: "accepted", deliveryId}`, `workflowClient.trigger` called with correct payload shape |

For the happy path, assert on the workflow trigger payload shape:
```ts
expect(workflowClient.trigger).toHaveBeenCalledWith(
  expect.objectContaining({
    url: expect.stringContaining("/workflows/webhook-receipt"),
    body: expect.objectContaining({
      deliveryId: expect.any(String),
      provider: "github",
      eventType: "push",
    }),
  })
);
```

### Layer 4: Fixture-Based Contract Tests

**Directory:** `apps/gateway/src/__tests__/fixtures/`

One JSON fixture per provider per event type:
```
fixtures/
  github/
    push.json
    pull_request.opened.json
    installation.created.json
  vercel/
    deployment.created.json
  linear/
    issue.create.json
  sentry/
    event_alert.triggered.json
```

Each fixture file:
```json
{
  "headers": { "x-github-event": "push", "x-github-delivery": "abc-123" },
  "body": { /* real webhook payload */ },
  "expectedDeliveryId": "abc-123",
  "expectedEventType": "push",
  "expectedResourceId": "12345678"
}
```

Integrated into Layer 2 provider test files — iterate over fixtures and assert extraction correctness.

### File Structure

```
apps/gateway/
├── vitest.config.ts                          # NEW
├── package.json                              # MODIFIED: vitest dev dep + test scripts
└── src/
    └── __tests__/
        ├── fixtures/
        │   ├── github/
        │   │   ├── push.json
        │   │   ├── pull_request.opened.json
        │   │   └── installation.created.json
        │   ├── vercel/
        │   │   └── deployment.created.json
        │   ├── linear/
        │   │   └── issue.create.json
        │   └── sentry/
        │       └── event_alert.triggered.json
        ├── crypto.test.ts                    # Layer 1
        ├── keys.test.ts                      # Layer 1
        ├── providers/
        │   ├── github.test.ts                # Layer 2 + Layer 4
        │   ├── vercel.test.ts                # Layer 2 + Layer 4
        │   ├── linear.test.ts                # Layer 2 + Layer 4
        │   └── sentry.test.ts                # Layer 2 + Layer 4
        └── routes/
            └── webhooks.test.ts              # Layer 3
```

### Critical Implementation Details

- **Vercel SHA-1**: The Vercel provider is the only one using SHA-1. Tests must call `computeHmacSha1` (not `computeHmacSha256`) when constructing valid Vercel test signatures.
- **Hono in-process testing**: `app.request()` takes a path + `RequestInit` object. The Hono `app` from `src/app.ts` has all routes mounted. No HTTP server needed.
- **vi.mock path resolution**: Mocks must use relative paths matching the imports: `vi.mock("../../env", ...)`, etc.
- **env mock shape**: `src/env.ts` exports `env` object via `@t3-oss/env-nextjs` createEnv. Mock must return the flat `env` export with string values for all used env vars.
- **`timingSafeEqual` note**: `timingSafeEqual` pads/slices to 64 hex chars (32 bytes). Tests should use HMAC outputs (64 hex chars for SHA-256, 40 for SHA-1) which are already within or below this range.

### Verification Commands

```bash
pnpm --filter @lightfast/gateway test        # Run all tests
pnpm --filter @lightfast/gateway test:watch   # Watch mode
pnpm --filter @lightfast/gateway typecheck    # Ensure test files don't break types
```

### Manual Testing Steps (post-automated):
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
