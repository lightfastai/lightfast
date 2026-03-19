---
date: 2026-03-18T10:33:28Z
researcher: claude
git_commit: 295fab4bf282f51f516f78434a464caad00ab8d1
branch: feat/platform-gate-first-health-hardening
repository: lightfast
topic: "Feasibility of converting apps/relay, apps/gateway, apps/backfill to hono-trpc for end-to-end type safety"
tags: [research, codebase, hono, trpc, relay, gateway, backfill, type-safety, gateway-service-clients]
status: complete
last_updated: 2026-03-18
---

# Research: hono-trpc Migration Feasibility

**Date**: 2026-03-18T10:33:28Z
**Git Commit**: 295fab4bf282f51f516f78434a464caad00ab8d1
**Branch**: feat/platform-gate-first-health-hardening

## Research Question

Consider researching into full conversion of `apps/relay`, `apps/gateway`, and `apps/backfill` into using hono-trpc where possible. This would allow our entire internal application to have strongly typed API formats everywhere.

## Summary

A partial migration is viable and worth pursuing. Approximately **15 of the 20 routes** across the three services are pure JSON-in/JSON-out RPC procedures that can be wrapped in tRPC with no architectural cost. The remaining 5 must stay as plain Hono routes due to hard constraints: HTML responses, HTTP redirects, raw-body HMAC verification, and SDK-owned HTTP protocol surfaces (Inngest `serve()`, Upstash Workflow `serve()`).

The official adapter is `@hono/trpc-server@0.4.2` (from `honojs/middleware`, author: @yusukebe). It works in Vercel edge V8 isolates via the standard tRPC Fetch Adapter. The canonical pattern is to mount tRPC at `/trpc/*` and leave all other Hono routes untouched — this is both documented and production-proven.

The primary type-safety gains are on the **caller side** (`@repo/gateway-service-clients`): three methods currently use raw TypeScript `as` casts with no runtime validation. tRPC would replace hand-written fetch wrappers with a generated `AppRouter`-typed client, giving end-to-end type safety from procedure definition → transport → consumer.

---

## Detailed Findings

### 1. Official Adapter: `@hono/trpc-server`

- **npm**: `@hono/trpc-server@0.4.2` (January 2026)
- **Source**: `honojs/middleware` monorepo — https://github.com/honojs/middleware
- **Edge runtime**: Works in Vercel V8 isolates via tRPC's Fetch Adapter (`@trpc/server/adapters/fetch`) — no Node.js dependencies
- **v11 support**: Confirmed. v11.4.x had a TS2332 type error (fixed in `@hono/trpc-server@0.3.5+`, June 2025). Latest `@hono/trpc-server@0.4.2` tracks `@trpc/server` through v11.5.0+.
- **Mixed routing**: Canonical pattern — mount on `/trpc/*`, all other routes unaffected

```ts
import { trpcServer } from '@hono/trpc-server'

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    endpoint: '/trpc',
    createContext: (_opts, c) => ({
      apiKey: c.req.header('X-API-Key'),
    }),
  })
)
// All other app.get / app.post routes continue working normally
```

**Known limitation**: If any Hono middleware pre-reads the request body before the tRPC handler, mutation bodies arrive as `undefined` (Cloudflare Workers body-parsing bug — same applies to Vercel edge). Solution: never pre-read the body in middleware for routes that will be handled by tRPC.

---

### 2. Route Classification: What CAN Be tRPC

These are pure JSON-in / JSON-out handlers with no side effects that require raw HTTP semantics.

#### Gateway (`apps/gateway/src/routes/connections.ts`)

| Route | Method | Description | Auth |
|---|---|---|---|
| `connections.ts:76` | `GET /:provider/authorize` | Returns `{ url, state }` for OAuth init | `apiKeyAuth` + `tenantMiddleware` |
| `connections.ts:177` | `GET /oauth/status` | Polls Redis for OAuth completion | None (state token is the secret) |
| `connections.ts:506` | `GET /:id` | Get connection details (tokens, resources) | `apiKeyAuth` |
| `connections.ts:681` | `GET /:id/token` | Decrypted token vault | `apiKeyAuth` |
| `connections.ts:746` | `GET /:id/proxy/endpoints` | Provider API catalog (serializable) | `apiKeyAuth` |
| `connections.ts:791` | `POST /:id/proxy/execute` | Authenticated proxy to provider API | `apiKeyAuth` |
| `connections.ts:1000` | `DELETE /:provider/:id` | Initiate teardown workflow, returns immediately | `apiKeyAuth` |
| `connections.ts:1043` | `POST /:id/resources` | Link a resource to a connection | `apiKeyAuth` |
| `connections.ts:1147` | `DELETE /:id/resources/:resourceId` | Unlink a resource | `apiKeyAuth` |
| `connections.ts:1197` | `GET /:id/backfill-runs` | List backfill run records | `apiKeyAuth` |
| `connections.ts:1224` | `POST /:id/backfill-runs` | Upsert backfill run record | `apiKeyAuth` |

**11 routes** — all internal-only (X-API-Key), all JSON responses.

#### Relay (`apps/relay/src/routes/admin.ts`)

| Route | Method | Description | Auth |
|---|---|---|---|
| `admin.ts:23` | `GET /health` | DB connectivity check | None |
| `admin.ts:50` | `GET /dlq` | List DLQ deliveries with pagination | `apiKeyAuth` |
| `admin.ts:75` | `POST /dlq/replay` | Replay specific DLQ delivery IDs | `apiKeyAuth` |
| `admin.ts:135` | `POST /replay/catchup` | Replay batch of held/received deliveries for an installation | `apiKeyAuth` |
| `admin.ts:260` | `DELETE /dev/backfill-runs/:installationId` | Dev-only: clear backfill run records | `apiKeyAuth` |

**5 routes** (4 + 1 dev-only).

#### Backfill (`apps/backfill/src/routes/`)

| Route | Method | Description | Auth |
|---|---|---|---|
| `trigger.ts:30` | `POST /trigger` | Enqueue backfill via Inngest event | `X-API-Key` inline check |
| `trigger.ts:86` | `POST /trigger/cancel` | Cancel running backfill via Inngest event | `X-API-Key` inline check |
| `estimate.ts:*` | `POST /estimate` | Dry-run estimation of backfill scope | `X-API-Key` inline check |

**3 routes** — all internal-only, all JSON in/out.

**Total: ~18 routes that could be tRPC procedures.**

---

### 3. Route Classification: What CANNOT Be tRPC

These routes have hard constraints that make them incompatible with tRPC's JSON envelope model.

#### Gateway — OAuth Callback

```
connections.ts:205 — GET /:provider/callback
```

**Why not tRPC**: Returns `c.html(...)` (inline HTML page for CLI OAuth) and `c.redirect(...)` (multiple redirect targets based on state). tRPC procedures cannot return HTML or issue HTTP redirects — the response envelope is always `{"result":{"data":...}}`. PR #6488 (raw `Response` return from procedures) was closed without merging in November 2025.

#### Relay — Webhook Ingest

```
webhooks.ts:44 — POST /api/webhooks/:provider
```

**Why not tRPC**: The 7-stage middleware chain (`providerGuard → serviceAuthDetect → serviceAuthBodyValidator → webhookHeaderGuard → rawBodyCapture → signatureVerify → payloadParseAndExtract`) requires raw body access for HMAC verification. tRPC may consume the body before the webhook middleware can read it (known body-parsing ordering issue). More fundamentally, this route is invoked by **external providers** (GitHub, Linear, Sentry, Vercel) — it must conform to their POST format, not a tRPC client.

#### Relay — QStash Delivery Status Callback

```
admin.ts:210 — POST /admin/delivery-status
```

**Why not tRPC**: Called by QStash after each message delivery attempt. Auth is `qstashAuth` which validates the `Upstash-Signature` header via `@vendor/qstash` `Receiver`. QStash sends its own JSON body format, not a tRPC call. This is a platform callback, not an internal RPC call.

#### Relay — Upstash Workflow Callback

```
workflows.ts:235 — POST /workflows/webhook-delivery
```

**Why not tRPC**: The `serve()` wrapper from `@vendor/upstash-workflow/hono` owns the HTTP protocol surface — it handles QStash signature verification, step serialization, deterministic replay, and response marshalling. It must be mounted directly on the Hono router, not wrapped in tRPC middleware.

#### Backfill — Inngest Serve Handler

```
inngest.ts:10-16 — GET/POST/PUT /api/inngest
```

**Why not tRPC**: The Inngest `serve()` adapter from `@vendor/inngest/hono` performs its own request parsing, function manifest discovery, step acknowledgements, and HMAC verification. It owns the HTTP protocol. Mounting it inside a tRPC procedure would destroy this protocol surface.

---

### 4. Current Type-Safety Story vs. What tRPC Would Give

#### Current State: `@repo/gateway-service-clients`

The package (`packages/gateway-service-clients/src/`) has three factory functions. Types flow through Zod schemas from `@repo/console-providers/contracts`, but with several gaps:

**Fully Zod-validated responses (strong today):**

| Method | Validator | File:line |
|---|---|---|
| `GatewayClient.getConnection` | `gatewayConnectionSchema.parse()` | `gateway.ts:76` |
| `GatewayClient.getToken` | `gatewayTokenResultSchema.parse()` | `gateway.ts:90` |
| `GatewayClient.getBackfillRuns` | `z.array(backfillRunReadRecord).parse()` | `gateway.ts:110` |
| `GatewayClient.executeApi` | `proxyExecuteResponseSchema.parse()` | `gateway.ts:156` |
| `GatewayClient.getApiEndpoints` | `proxyEndpointsResponseSchema.parse()` | `gateway.ts:172` |
| `GatewayClient.getAuthorizeUrl` | inline `z.object` | `gateway.ts:216` |

**TypeScript `as` casts only — no runtime validation (gaps today):**

| Method | Cast | File:line |
|---|---|---|
| `BackfillClient.estimate` | `response.json() as Promise<Record<string, unknown>>` | `backfill.ts:35` |
| `BackfillClient.trigger` | `response.json() as Promise<{ status: string; installationId: string }>` | `backfill.ts:57` |
| `RelayClient.replayCatchup` | `response.json() as Promise<{ remaining: number }>` | `relay.ts:61` |

**Compile-time-only typed (data is `unknown` at runtime):**

`GatewayClient.executeApi` narrow overload (`gateway.ts:32-52`) provides `ResponseDataFor<P, E>` typed return via the `ExecuteApiFn` interface, but the implementation is cast with `as unknown as ExecuteApiFn` at `gateway.ts:157`. At runtime, `data` resolves to `unknown` from `proxyExecuteResponseSchema`. The narrow type on `.data` is not runtime-enforced.

**No response body (void — correct by design):**

- `GatewayClient.registerResource` (`gateway.ts:175-194`)
- `GatewayClient.upsertBackfillRun` (`gateway.ts:113-125`)
- `RelayClient.dispatchWebhook` (`relay.ts:25-46`)

#### What tRPC Would Give

With tRPC, each service exports an `AppRouter` type. Consumers use `createTRPCClient<AppRouter>()` — no hand-written fetch wrappers, no explicit Zod parsing at the client layer. The type flows bidirectionally from procedure definition:

```
Procedure input schema (Zod)  →  TypeScript input type  →  client call-site validation
Procedure output (return type) →  TypeScript output type  →  consumer sees typed result
```

The three `as` casts in `BackfillClient` and `RelayClient` would become typed procedure outputs automatically. The compile-time-only `executeApi` narrow overload would no longer need the `as unknown as ExecuteApiFn` hack — the procedure's return type is the authoritative type.

---

### 5. Compatibility Constraints

#### Edge Runtime

All three services run on Vercel edge runtime (V8 isolates, `edge-light` entry points via `srvx`). `@hono/trpc-server` delegates to tRPC's Fetch Adapter (`@trpc/server/adapters/fetch`) which has no Node.js dependencies. Compatible.

#### Auth Context in tRPC

Current auth is `apiKeyAuth` middleware (`relay/src/middleware/auth.ts:11-20`, `gateway/src/middleware/auth.ts`) checking `X-API-Key` against `env.GATEWAY_API_KEY`. With tRPC, this moves into `createContext`:

```ts
createContext: (_opts, c) => {
  const apiKey = c.req.header('X-API-Key')
  if (!timingSafeStringEqual(apiKey ?? '', env.GATEWAY_API_KEY)) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return { authenticated: true }
}
```

Or as a `protectedProcedure` middleware. Either way the pattern maps cleanly.

#### QStash/Upstash Workflow Callbacks

These callbacks (`/admin/delivery-status`, `/workflows/webhook-delivery`, `/services/gateway/workflows/*`) are invoked by external infrastructure (QStash), not by internal clients. They are plain Hono routes and must remain so. The tRPC router simply doesn't mount on their paths.

#### Inngest Serve Handler

`inngest.ts` registers `GET/POST/PUT /api/inngest` via the Inngest `serve()` adapter. This is outside tRPC's scope entirely — mount alongside the tRPC router in `app.ts`.

#### Body Pre-reading Hazard

The current shared middleware stack is `requestId → lifecycle → errorSanitizer → sentry`. None of these read the request body. The `lifecycle` middleware reads lifecycle variables (timing, log enrichment), not the body. This means the known `@hono/trpc-server` body pre-reading hazard does not apply to the current setup — tRPC procedures would receive bodies intact.

---

### 6. Mixed Architecture Pattern

For each service, the structure would be:

```
app.ts (Hono root)
 ├── app.use(requestId, lifecycle, errorSanitizer, sentry)   ← unchanged
 ├── app.get("/")    ← health check, unchanged
 │
 ├── app.use('/trpc/*', trpcServer({ router: appRouter, endpoint: '/trpc' }))
 │       appRouter
 │       ├── connections (gateway: all 11 CRUD routes)
 │       ├── token (gateway: GET /:id/token)
 │       ├── proxy (gateway: execute + endpoints)
 │       ├── resources (gateway: link/unlink)
 │       └── backfillRuns (gateway: get/upsert)
 │
 └── app.route('/services/gateway', connections)   ← OAuth authorize + callback ONLY
     app.route('/services/gateway/workflows', workflows)  ← Upstash Workflow ONLY
```

```
relay/app.ts
 ├── app.use('/trpc/*', trpcServer({ router: relayRouter, endpoint: '/trpc' }))
 │       relayRouter
 │       ├── health
 │       ├── dlq.list, dlq.replay
 │       ├── replay.catchup
 │       └── dev.clearBackfillRuns (dev-only, conditionally registered)
 │
 ├── app.route('/api/webhooks', webhooks)      ← HMAC ingest, unchanged
 └── app.route('/api/workflows', workflows)    ← Upstash Workflow, unchanged
     (admin/delivery-status remains plain Hono under /api/admin)
```

```
backfill/app.ts
 ├── app.use('/trpc/*', trpcServer({ router: backfillRouter, endpoint: '/trpc' }))
 │       backfillRouter
 │       ├── trigger
 │       ├── cancel
 │       └── estimate
 │
 └── app.route('/api/inngest', inngestRoute)   ← Inngest serve(), unchanged
```

`@repo/gateway-service-clients` is then replaced (or extended) with `createTRPCProxyClient` pointing at each service's base URL. The three factory functions (`createGatewayClient`, `createBackfillClient`, `createRelayClient`) are retained for the non-tRPC routes (webhook dispatch, OAuth authorize URL), but the bodies that currently do hand-written `fetch` + Zod parse are removed in favour of the tRPC client.

---

## Code References

- `apps/relay/src/app.ts:14` — Relay Hono app definition, middleware stack
- `apps/relay/src/routes/admin.ts:23-266` — All admin routes (PURE_RPC + WORKFLOW_CALLBACK)
- `apps/relay/src/routes/workflows.ts:235` — Upstash Workflow serve handler
- `apps/relay/src/routes/webhooks.ts:44` — Inbound webhook POST (WEBHOOK_INGEST)
- `apps/relay/src/middleware/auth.ts:11-20` — `apiKeyAuth` (timing-safe X-API-Key check)
- `apps/relay/src/middleware/auth.ts:30-46` — `qstashAuth` (QStash signature verification)
- `apps/relay/src/middleware/webhook.ts:26-43` — `WebhookVariables` context type (7 fields)
- `apps/gateway/src/app.ts:48-49` — Gateway route mounting (`/services/gateway`)
- `apps/gateway/src/routes/connections.ts:63-65` — Gateway `connections` Hono app
- `apps/gateway/src/routes/connections.ts:205` — OAuth callback (HTML + redirects, NOT tRPC)
- `apps/gateway/src/routes/connections.ts:506` — `GET /:id` (PURE_RPC)
- `apps/gateway/src/routes/connections.ts:791` — Proxy execute (PURE_RPC)
- `apps/backfill/src/app.ts:14` — Backfill Hono app definition
- `apps/backfill/src/routes/trigger.ts:30` — Trigger (PURE_RPC)
- `apps/backfill/src/routes/trigger.ts:86` — Cancel (PURE_RPC)
- `apps/backfill/src/routes/inngest.ts:10-16` — Inngest serve handler (NOT tRPC)
- `packages/gateway-service-clients/src/gateway.ts:32-52` — `ExecuteApiFn` call-signature interface (narrow overload)
- `packages/gateway-service-clients/src/gateway.ts:157` — `as unknown as ExecuteApiFn` cast
- `packages/gateway-service-clients/src/backfill.ts:35` — `as` cast gap (estimate)
- `packages/gateway-service-clients/src/backfill.ts:57` — `as` cast gap (trigger)
- `packages/gateway-service-clients/src/relay.ts:61` — `as` cast gap (replayCatchup)
- `packages/gateway-service-clients/src/headers.ts` — `ServiceClientConfig` + `buildServiceHeaders`
- `api/console/src/router/org/connections.ts:232-238` — Narrow `executeApi` overload usage (tRPC → gateway)
- `api/console/src/router/org/workspace.ts:1096` — `createBackfillClient().trigger()` in `notifyBackfill`

## Architecture Documentation

### Current Type Flow (caller → service)

```
tRPC procedure (console)
  → createGatewayClient / createBackfillClient / createRelayClient
      → raw fetch() with X-API-Key header
      → response.json()
      → Zod.parse() [gateway] OR `as` cast [backfill/relay]
      → TypeScript type visible to caller
```

The contracts layer (`@repo/console-providers/contracts`) provides Zod schemas that both the server (validates input/output in route handlers) and client (validates response in gateway-service-clients) use. This creates a bidirectional contract but requires duplication — schemas are defined once but validation runs twice (server produces, client re-validates).

### With tRPC

```
tRPC procedure (console)
  → createTRPCProxyClient<GatewayAppRouter>(...)
      → @hono/trpc-server adapter
      → procedure handler (Zod input schema validated once, server-side)
      → return value typed as procedure output
      → tRPC transport envelope
      → AppRouter type flows back to client automatically
```

No client-side Zod re-validation needed. Type flows from procedure definition, not from a separate schema sync.

### Shared Auth Pattern

All three services use X-API-Key (`GATEWAY_API_KEY`) for internal auth (`apps/relay/src/middleware/auth.ts:11-20`, inline checks in backfill routes). This maps cleanly to a tRPC `createContext` + `protectedProcedure` pattern. The `tenantMiddleware` in gateway (which extracts `orgId` from `X-Org-Id`) can similarly be surfaced through context.

### Non-tRPC Routes Stay Unchanged

The OAuth callback (`GET /:provider/callback`) must remain plain Hono because it returns HTML and issues `c.redirect()`. The Upstash Workflow `serve()` and Inngest `serve()` adapters are self-contained HTTP protocol owners that cannot be wrapped in tRPC. The webhook ingest POST requires raw body access for HMAC verification.

## Open Questions

1. **URL path decision**: Should tRPC mount at `/trpc/*` (alongside existing routes) or should existing JSON routes be moved under `/trpc/` during migration? The former is less disruptive; the latter is cleaner long-term.

2. **gateway-service-clients migration**: The package can be migrated incrementally — replace each hand-written method with a tRPC client call while keeping the factory function signature stable for consumers.

3. **`executeApi` proxy procedure typing**: The `POST /:id/proxy/execute` route currently uses the `ResponseDataFor<P, E>` generic trick for narrow typing. With tRPC, this would need a different approach since tRPC procedures have fixed return types — either the proxy execute remains as a plain Hono route, or the narrow types are pushed into provider-specific sub-procedures.

4. **Input validation duplication**: Currently, input Zod schemas live in `@repo/console-providers/contracts` (e.g., `backfillTriggerPayload`) and are used both in the route handler (server-side validation) and typed at the call site. With tRPC, the procedure's `input()` schema becomes the single source of truth — contracts schemas may be reused as tRPC `input()` schemas directly.

5. **Test migration**: Relay and gateway have integration tests that use Hono's `testClient()` or direct `app.request()`. These would need to be adapted for tRPC procedures (either using `createCallerFactory` for unit tests or `createTRPCProxyClient` for integration tests).
