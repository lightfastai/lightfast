---
date: 2026-03-19T10:21:00+11:00
researcher: claude
git_commit: c7a983034c9f118684c0c98707259a997bb3b62b
branch: feat/platform-gate-first-health-hardening
repository: lightfast
topic: "Platform tRPC architecture patterns — consolidating relay + gateway + backfill + neural pipeline into apps/platform"
tags: [research, codebase, platform, trpc, architecture, consolidation, inngest, gateway, relay, backfill]
status: complete
last_updated: 2026-03-19
---

# Research: Platform tRPC Architecture Patterns

**Date**: 2026-03-19T10:21:00+11:00
**Git Commit**: c7a983034c
**Branch**: feat/platform-gate-first-health-hardening

## Research Question

Document the existing architecture patterns across relay, gateway, backfill, console tRPC, console-trpc client package, and the neural pipeline — everything needed to design `apps/platform` (Next.js) with `@api/platform` (tRPC routers) and `packages/platform-trpc` (client adapter).

## Summary

The target `apps/platform` consolidates **four services** plus the **console neural pipeline** into a single Next.js application with tRPC:

| Source | What moves to platform |
|--------|----------------------|
| `apps/relay` | Webhook ingestion, HMAC verification, delivery persistence, admin/DLQ/replay, recovery cron |
| `apps/gateway` | OAuth flows, token vault, connection CRUD, teardown workflow, health check cron, token refresh cron, API proxy |
| `apps/backfill` | Backfill orchestrator + entity worker Inngest functions, trigger/cancel/estimate routes |
| `api/console/src/inngest/` | Neural pipeline (event-store → entity-graph → entity-embed), notification dispatch |
| `apps/console/src/app/api/gateway/ingress/` | Webhook transform + Inngest event emission (Upstash Workflow) |

**What stays in console**: UI pages, tRPC route handlers for user/org operations, search, settings, and some UI-triggered Inngest functions (like `record-activity`).

---

## Detailed Findings

### 1. Console tRPC Architecture (Pattern to Replicate)

#### Router-Per-Auth-Boundary Pattern

`api/console/src/root.ts:36-83` — Three separate routers, each with a distinct auth context:

```
userRouter   → clerk-pending or clerk-active users (no org required)
orgRouter    → clerk-active users only (org membership required)
m2mRouter    → machine-to-machine tokens (webhook/inngest callers)
```

Each served at a distinct HTTP endpoint:
- `/api/trpc/user` → userRouter
- `/api/trpc/org` → orgRouter
- m2mRouter has NO HTTP endpoint — only accessed via server-side `createM2MCaller()`

#### Context Creation

`api/console/src/trpc.ts:27-53` — Auth context is a discriminated union:
```ts
type AuthContext =
  | { type: "clerk-pending"; userId: string }
  | { type: "clerk-active"; userId: string; orgId: string }
  | { type: "m2m"; machineId: string }
  | { type: "apiKey"; orgId: string; userId: string; apiKeyId: string }
  | { type: "unauthenticated" }
```

Two context creators (`trpc.ts:78-225`):
- `createUserTRPCContext` — allows pending users (`treatPendingAsSignedOut: false`)
- `createOrgTRPCContext` — blocks pending users (`treatPendingAsSignedOut: true`)

Both attach `{ auth, db, headers }` to context.

#### Procedure Types

`api/console/src/trpc.ts:317-534` — Six exported procedure types:

| Procedure | Auth requirement | Context narrowing |
|-----------|-----------------|-------------------|
| `publicProcedure` | None | Full union |
| `userScopedProcedure` | clerk-pending or clerk-active | `userId` guaranteed |
| `orgScopedProcedure` | clerk-active only | `orgId` guaranteed |
| `webhookM2MProcedure` | M2M token | `machineId` guaranteed |
| `inngestM2MProcedure` | M2M token | `machineId` guaranteed |
| `apiKeyProcedure` | Bearer API key verified against DB | `orgId + apiKeyId` guaranteed |

Every procedure extends `sentrifiedProcedure` (Sentry middleware) + `timingMiddleware` (dev-mode artificial delay).

#### Sub-Router Pattern

All sub-routers are plain objects typed with `satisfies TRPCRouterRecord`. Only top-level routers use `createTRPCRouter()`. Supports nested sub-objects for grouping:

```ts
// api/console/src/router/org/workspace.ts:46
export const workspaceRouter = {
  listByClerkOrgSlug: orgScopedProcedure.input(...).query(...),
  sources: { list: orgScopedProcedure.input(...).query(...) },
  integrations: { disconnect: orgScopedProcedure.input(...).mutation(...) },
} satisfies TRPCRouterRecord;
```

#### Public API Surface

`api/console/src/index.ts` exports: routers (runtime values), router types, context creators, `createCallerFactory`, and inferred I/O types (`UserRouterInputs/Outputs`, etc.).

---

### 2. `packages/console-trpc` Client Adapter (Pattern to Replicate)

#### Package Structure

Four named exports in `packages/console-trpc/package.json`:

| Export | File | Consumer |
|--------|------|----------|
| `./client` | `src/client.ts` | Server + client |
| `./server` | `src/server.tsx` | RSC only |
| `./react` | `src/react.tsx` | Client components |
| `./types` | `src/types.ts` | Type imports |

Build: `tsc` only (no tsup). Exports point to raw `./src/*.ts` (no `types` field — `declaration: false`).

#### `client.ts` — QueryClient Factory

`packages/console-trpc/src/client.ts:7` — `createQueryClient()` with SuperJSON serialization, 30s staleTime, SSR-safe dehydration.

#### `server.tsx` — RSC Proxies and Callers

`packages/console-trpc/src/server.tsx:86-101`:
```ts
export const userTrpc = createTRPCOptionsProxy({ router: userRouter, ctx: createUserContext, queryClient: getQueryClient })
export const orgTrpc = createTRPCOptionsProxy({ router: orgRouter, ctx: createOrgContext, queryClient: getQueryClient })
```

Also exports: `createCaller()` (org-scoped), `createM2MCaller()` (M2M), `createInngestCaller()` (Inngest M2M), `HydrateClient`, `prefetch()`.

All context creators wrapped in React `cache()` for request deduplication.

#### `react.tsx` — Client Provider with splitLink

`packages/console-trpc/src/react.tsx:73` — `splitLink` routes by path prefix:
- `organization.*`, `account.*`, `workspaceAccess.*` → `/api/trpc/user`
- Everything else → `/api/trpc/org`

Uses `httpBatchStreamLink` with `credentials: "include"`.

#### `types.ts` — Inferred Types

```ts
type ConsoleRouters = UserRouter & OrgRouter
export type RouterOutputs = inferRouterOutputs<ConsoleRouters>
export type RouterInputs = inferRouterInputs<ConsoleRouters>
```

---

### 3. Hono Service Patterns (What Gets Ported)

#### Shared App Structure

All three services (`apps/gateway/src/app.ts`, `apps/relay/src/app.ts`, `apps/backfill/src/app.ts`) follow identical patterns:
- Side-effect import of `sentry-init.js` as first line
- `new Hono<{ Variables: LifecycleVariables }>()` typed with context variables
- Middleware in strict order: `requestId` → `lifecycle` → `errorSanitizer` → `sentry`
- Global `app.onError()` handler: HTTPException re-thrown, everything else → 500

#### Environment Validation

`@t3-oss/env-core`'s `createEnv()` with composable `extends` array:
```ts
extends: [vercel(), dbEnv, inngestEnv, betterstackEdgeEnv, qstashEnv, upstashEnv, ...PROVIDER_ENVS()]
```

#### Middleware Stack

| Middleware | File (gateway example) | Purpose |
|-----------|----------------------|---------|
| `requestId` | `middleware/request-id.ts:18-28` | Reads/generates `X-Request-Id` and `X-Correlation-Id` |
| `lifecycle` | `middleware/lifecycle.ts:9-100` | Structured logging with duration, dev-mode artificial delay |
| `errorSanitizer` | `middleware/error-sanitizer.ts:12-21` | Production: replaces 5xx bodies with generic message |
| `sentry` | Via `@vendor/observability` | Error capture |
| `apiKeyAuth` | `middleware/auth.ts:8-22` | Constant-time `X-API-Key` comparison |
| `tenantMiddleware` | `middleware/tenant.ts:17-32` | Reads org from `X-Org-Id` header or `?org_id` query |
| `qstashAuth` | relay `middleware/auth.ts:30-46` | QStash `Upstash-Signature` verification |

#### Gateway: Connection Routes

`apps/gateway/src/routes/connections.ts` — Full OAuth lifecycle:

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /:provider/authorize` | apiKeyAuth + tenant | Start OAuth flow, store state in Redis |
| `GET /oauth/status` | None (state token is secret) | CLI polling for OAuth result |
| `GET /:provider/callback` | None (browser redirect) | OAuth callback, upsert installation + token |
| `GET /:id/token` | apiKeyAuth | Token vault — decrypt and return active token |
| `GET /:id/proxy/endpoints` | apiKeyAuth | List API catalog for a provider |
| `POST /:id/proxy/execute` | apiKeyAuth | Authenticated proxy to provider API |
| `DELETE /:provider/:id` | apiKeyAuth + tenant | Disconnect — audit log + trigger teardown workflow |
| `GET /` | apiKeyAuth | List installations (with optional status filter) |

Module-level `providerConfigs` built at startup by iterating `PROVIDERS` and calling `createConfig()`.

#### Gateway: Token Vault

Two key files:
- `lib/token-store.ts:12-116` — `writeTokenRecord()`, `updateTokenRecord()` — encrypt/store tokens with AES-GCM
- `lib/token-helpers.ts:13-128` — `getActiveTokenForInstallation()` (handles on-demand refresh), `forceRefreshToken()` (401 retry helper)

#### Relay: Webhook Ingestion

`apps/relay/src/routes/webhooks.ts` — 7-step middleware chain on `POST /webhooks/:provider`:

1. `providerGuard` → validate provider, reject API-only
2. `serviceAuthDetect` → check X-API-Key (backfill path)
3. `serviceAuthBodyValidator` → validate pre-resolved body (backfill only)
4. `webhookHeaderGuard` → validate required headers (standard path only)
5. `rawBodyCapture` → read body as text (standard path only)
6. `signatureVerify` → HMAC/Ed25519 verification (standard path only)
7. `payloadParseAndExtract` → parse payload, extract deliveryId/eventType/resourceId

Two dispatch paths:
- **Service auth** (backfill): persist + QStash directly to console ingress
- **Standard** (external webhooks): persist + Upstash Workflow trigger → resolve connection → QStash to console

#### Relay: Admin/Replay

`apps/relay/src/routes/admin.ts`:
- `GET /admin/health` — DB probe
- `GET /admin/dlq` — paginated failed deliveries
- `POST /admin/dlq/replay` — replay specific DLQ entries
- `POST /admin/replay/catchup` — replay all undelivered for an installation
- `POST /admin/recovery/cron` — QStash-scheduled sweep of stuck deliveries
- `POST /admin/delivery-status` — QStash callback for delivery status updates

#### Cross-Service Communication

`packages/gateway-service-clients/src/` — HTTP client factories:
- `createGatewayClient(config)` — 10 methods (getConnection, getToken, executeApi, deleteConnection, etc.)
- `createRelayClient(config)` — dispatchWebhook, replayCatchup
- `createBackfillClient(config)` — estimate, trigger

All URLs route through console Next.js rewrites:
```
gatewayUrl = ${consoleBase}/services/gateway
relayUrl = ${consoleBase}/services/relay
backfillUrl = ${consoleBase}/services/backfill
```

---

### 4. Inngest Architecture (What Consolidates)

#### Shared Package: `@repo/inngest`

`packages/inngest/src/` — 11 events across 3 schema files:

**Platform events** (`schemas/platform.ts`):
- `platform/webhook.received` — provider, deliveryId, eventType, resourceId, payload
- `platform/connection.lifecycle` — reason, installationId, orgId, provider, triggeredBy

**Console events** (`schemas/console.ts`):
- `console/activity.record` — workspaceId, category, action, entityType, entityId
- `console/event.capture` — workspaceId, sourceEvent, ingestionSource
- `console/event.stored` — workspaceId, eventExternalId, significanceScore
- `console/entity.upserted` — workspaceId, entityExternalId, entityRefs[]
- `console/entity.graphed` — workspaceId, entityExternalId

**Backfill events** (`schemas/backfill.ts`):
- `backfill/run.requested` — backfillTriggerPayload shape
- `backfill/run.cancelled` — installationId
- `backfill/connection.health.check.requested` — installationId, provider, reason
- `backfill/entity.requested` — installationId, provider, entityType, resource

#### All 9 Inngest Functions (current locations)

| Function ID | Trigger | Current location | Moves to platform? |
|-------------|---------|-----------------|-------------------|
| `console/event.store` | `console/event.capture` | `api/console/src/inngest/workflow/neural/event-store.ts:111` | **YES** |
| `console/entity.graph` | `console/entity.upserted` | `api/console/src/inngest/workflow/neural/entity-graph.ts:17` | **YES** |
| `console/entity.embed` | `console/entity.graphed` | `api/console/src/inngest/workflow/neural/entity-embed.ts:49` | **YES** |
| `console/notification.dispatch` | `console/event.stored` | `api/console/src/inngest/workflow/notifications/dispatch.ts:10` | **YES** |
| `console/record-activity` | `console/activity.record` | `api/console/src/inngest/workflow/infrastructure/record-activity.ts:29` | **NO** (stays in console) |
| `backfill/run.orchestrator` | `backfill/run.requested` | `apps/backfill/src/workflows/backfill-orchestrator.ts:14` | **YES** |
| `backfill/entity.worker` | `backfill/entity.requested` | `apps/backfill/src/workflows/entity-worker.ts:15` | **YES** |
| `apps-gateway/health.check` | cron `*/5 * * * *` | `apps/gateway/src/functions/health-check.ts:27` | **YES** |
| `apps-gateway/token.refresh` | cron `*/5 * * * *` | `apps/gateway/src/functions/token-refresh.ts:21` | **YES** |

#### Two Upstash Workflows (to convert to Inngest)

1. **Connection teardown** — `apps/gateway/src/workflows/connection-teardown.ts:43`
   - 5 steps: close-gate → cancel-backfill → revoke-token → cleanup-cache → remove-resources
   - Triggered by: `DELETE /connections/:provider/:id` via `workflowClient.trigger()`

2. **Console webhook ingress** — `apps/console/src/app/api/gateway/ingress/route.ts:29`
   - 2 steps: resolve-workspace → transform-store-and-fan-out
   - Triggered by: QStash from relay
   - Emits: `console/event.capture` (starts the neural pipeline)

#### Current `serve()` Configurations (3 separate endpoints)

| Service | Path | Functions |
|---------|------|-----------|
| Console | `/api/inngest` | eventStore, entityGraph, entityEmbed, notificationDispatch, recordActivity |
| Gateway | `/inngest` | healthCheck, tokenRefresh |
| Backfill | `/api/inngest` | backfillOrchestrator, backfillEntityWorker |

#### Complete Event Flow

```
External provider webhook
  → POST /ingest/:provider (relay)
    → HMAC verify → persist delivery → Upstash Workflow
      → resolve connection (DB JOIN) → QStash → console ingress

Console ingress (Upstash Workflow)
  → resolve workspace → transform payload → inngest.send("console/event.capture")

console/event.capture
  → eventStore: check-duplicate → check-event-allowed (Gate 2) → evaluate-significance
    → extract-entities → store-observation → upsert-entities
    → emit: console/entity.upserted + console/event.stored

console/entity.upserted → entityGraph: resolve-edges → emit: console/entity.graphed
console/entity.graphed → entityEmbed: (debounced 30s) fetch → embed → Pinecone upsert
console/event.stored → notificationDispatch: (if score ≥ 70) → Knock workflow

Backfill path:
  console tRPC → QStash → backfill trigger → inngest.send("backfill/run.requested")
  → orchestrator: get-connection → compute-since → step.invoke(entityWorker) × N
  → entityWorker: paginated fetch → dispatch webhooks back through relay
```

---

### 5. Monorepo Package Conventions

#### Namespace Roles

| Namespace | Role | Build | Export default points to |
|-----------|------|-------|------------------------|
| `@api/*` | Server business logic | `tsc` only | `./src/*.ts` (raw TS) |
| `@repo/*` | Shared internal libraries | `tsup + tsc` or `tsc` | `./dist/*.js` or `./src/*.ts` |
| `@vendor/*` | Third-party wrappers | `tsup + tsc` or `tsc` | `./dist/*.js` |
| `@db/*` | Drizzle schema + client | `tsup + tsc` | `./dist/*.js` |

#### `@api/app` Package Pattern (template for `@api/platform`)

`api/console/package.json`:
- `private: true`, `type: "module"`, `sideEffects: false`
- Build: `tsc` (no tsup)
- Two-tier exports: `types` → `./dist/*.d.ts`, `default` → `./src/*.ts`
- Dependencies: `workspace:*` for internal, `catalog:` for external

`api/console/turbo.json`:
- `tags: ["api"]`, `extends: ["//"]`, `tasks: {}`

`api/console/tsconfig.json`:
- Extends `@repo/typescript-config/internal-package.json`
- `outDir: "dist"`, `rootDir: "src"`

#### `packages/console-trpc` Package Pattern (template for `packages/platform-trpc`)

`packages/console-trpc/package.json`:
- Four exports: `./client`, `./server`, `./react`, `./types`
- All point to `./src/*.ts` (no `types` field)
- `declaration: false` in tsconfig

#### Turbo Boundary Rules

Root `turbo.json:102-104`:
- `app` dependents cannot depend on `api` packages
- `vendor` packages cannot depend on `packages`, `data`, `api`, or `app`
- `api` packages CAN depend on `@repo/*`, `@vendor/*`, `@db/*`

---

### 6. Things That Cannot Be tRPC

Some routes must remain plain Next.js Route Handlers:

| Route | Why not tRPC |
|-------|-------------|
| `POST /api/ingest/:provider` | External providers send raw HTTP with HMAC signatures |
| `GET /api/connect/:provider/authorize` | Returns redirect URL for browser OAuth |
| `GET /api/connect/:provider/callback` | OAuth provider redirects here directly |
| `GET /api/connect/oauth/poll` | CLI polling with state token as auth |
| `POST /api/inngest` | Inngest serve() endpoint |

---

## Code References

### tRPC Base
- `api/console/src/trpc.ts:27-53` — AuthContext discriminated union
- `api/console/src/trpc.ts:78-225` — Context creators
- `api/console/src/trpc.ts:317-534` — Procedure types
- `api/console/src/root.ts:36-83` — Router composition
- `api/console/src/index.ts` — Public API surface

### Client Package
- `packages/console-trpc/src/client.ts:7` — QueryClient factory
- `packages/console-trpc/src/server.tsx:86-101` — RSC proxies
- `packages/console-trpc/src/react.tsx:53-125` — TRPCReactProvider with splitLink
- `packages/console-trpc/src/types.ts` — RouterInputs/Outputs

### Gateway (to port)
- `apps/gateway/src/routes/connections.ts` — Full connection lifecycle
- `apps/gateway/src/lib/token-helpers.ts:13-128` — Token vault operations
- `apps/gateway/src/lib/token-store.ts:12-116` — Token persistence
- `apps/gateway/src/workflows/connection-teardown.ts:43` — Upstash Workflow

### Relay (to port)
- `apps/relay/src/routes/webhooks.ts:44-166` — Webhook ingestion with 7-middleware chain
- `apps/relay/src/routes/admin.ts` — Admin/DLQ/replay endpoints
- `apps/relay/src/lib/replay.ts:27-97` — Replay logic

### Neural Pipeline (to port)
- `api/console/src/inngest/workflow/neural/event-store.ts:109-616` — Main event pipeline
- `api/console/src/inngest/workflow/neural/entity-graph.ts:16-61` — Edge resolution
- `api/console/src/inngest/workflow/neural/entity-embed.ts:47-272` — Embedding pipeline
- `apps/console/src/app/api/gateway/ingress/route.ts:29` — Webhook transform entry point

### Backfill (to port)
- `apps/backfill/src/workflows/backfill-orchestrator.ts:12-333` — Orchestration
- `apps/backfill/src/workflows/entity-worker.ts:13-292` — Entity processing with 401 hardening

### Cross-Service
- `packages/gateway-service-clients/src/gateway.ts:63-271` — Gateway HTTP client
- `packages/gateway-service-clients/src/urls.ts:1-27` — URL resolution via rewrites
- `apps/console/next.config.ts:165-195` — Rewrite rules

---

## Architecture Documentation

### Current Data Flow Pattern
```
Provider → Relay (HMAC verify) → QStash → Console Ingress (Upstash Workflow)
  → Inngest event → Neural Pipeline (4 functions) → DB + Pinecone

Backfill → Relay (service auth) → QStash → Console Ingress → same pipeline

User disconnect → Console tRPC → Gateway HTTP client → Gateway DELETE
  → Upstash Workflow teardown (5 steps)
```

### Target Data Flow Pattern (post-consolidation)
```
Provider → Platform /api/ingest/:provider (Route Handler)
  → persist delivery → inngest.send("platform/webhook.received")
  → ingestDelivery (Inngest fn): resolve connection → forward to neural pipeline

Backfill (entity worker) → Platform tRPC proxy.executeApi → provider API
  → Platform tRPC ingest.dispatch → same pipeline

User disconnect → Console tRPC → Platform tRPC connections.disconnect
  → connectionLifecycle (Inngest fn): gate-first teardown

All crons (health check, token refresh, delivery recovery) → Platform Inngest functions
```

### Key Architectural Decisions Found

1. **Router-per-auth-boundary**: Console uses separate routers per auth level, not a single router with per-procedure auth
2. **Context narrowing via middleware**: Each procedure type narrows `ctx.auth` via a middleware that throws on auth failure
3. **`satisfies TRPCRouterRecord`**: Sub-routers are plain objects, only top-level routers use `createTRPCRouter()`
4. **Raw TS source for @api packages**: Build is `tsc` only, consumers resolve `.ts` directly
5. **M2M routers have no HTTP endpoint**: Only accessible via server-side callers
6. **Cross-service calls route through console rewrites**: All service URLs go through `apps/console/next.config.ts` rewrites
7. **Token vault is the critical shared resource**: Multiple services need encrypted token access — currently via HTTP, would become tRPC procedures

---

## Related Research

- `thoughts/shared/plans/2026-03-18-platform-architecture-redesign.md` — Target architecture design
- `thoughts/shared/plans/2026-03-18-console-providers-type-safety.md` — Provider type system redesign
- `thoughts/shared/research/2026-03-18-gate-first-lifecycle-audit-log.md` — Gate-first lifecycle research
- `thoughts/shared/research/2026-03-18-repo-inngest-shared-package.md` — Shared Inngest package research

## Open Questions

1. **Platform auth model**: What auth context types does platform need? Service-to-service (X-API-Key), M2M tokens, and potentially direct Clerk auth for future admin UI?
2. **Event name migration**: Console neural pipeline functions currently use `console/*` event names. Do they keep these names in platform, or rename to `platform/*`?
3. **DB client sharing**: Platform and console both need `@db/app` — the singleton pattern works when they're in the same process, but if platform is a separate Vercel project, they're separate processes with separate connection pools.
4. **Inngest app identity**: Currently 3 separate Inngest apps (console, backfill, gateway). Platform would unify into 1. How does Inngest handle function migration between app IDs?
5. **Console dependency on platform**: Console tRPC procedures (connections, workspace) currently call gateway via HTTP client. Post-migration, they'd call platform tRPC procedures. If platform is a separate Vercel project, this is HTTP tRPC; if same project (microfrontend), it could be in-process callers.
