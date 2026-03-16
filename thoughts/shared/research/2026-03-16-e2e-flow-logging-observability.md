---
date: 2026-03-16T00:00:00+11:00
researcher: claude
git_commit: 769df1b5ff96c3d36dd7b61b02689b7fad22cb2c
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "E2E flow observability: sources/new → backfill → relay → ingress logging gaps"
tags: [research, codebase, observability, logging, betterstack, sentry, relay, backfill, console]
status: complete
last_updated: 2026-03-16
---

# E2E Flow Observability: sources/new → backfill → relay → ingress logging gaps

## Research Question

What is the complete end-to-end logging story for the sources onboarding flow, from the moment a user connects a source through the UI all the way through backfill, relay, and ingress processing? Where are the structured logging gaps, and what is the current state of correlationId propagation and Sentry integration?

## Summary

The E2E flow spans five distinct runtime boundaries: Next.js (console app), tRPC handlers, Hono edge services (backfill, relay), Inngest workflow steps, and the Next.js API route handling ingress. Two of the Hono services (relay, backfill) have mature structured logging via `@vendor/observability/service-log.ts` backed by BetterStack/Logtail, with per-request lifecycle middleware that ships one structured JSON blob per request. The other three boundaries (tRPC handlers in `api/console`, Inngest workflow steps in `apps/backfill`, and the console ingress route) rely entirely on raw `console.*` calls that only reach Vercel Function Logs.

There are 14 identified raw-console call sites across the flow that should use structured logging. The `@vendor/observability/log.ts` export already exists for Next.js contexts and is the correct drop-in replacement for the tRPC and ingress gaps. The `log` instance from each service's `logger.ts` is the correct replacement for the Hono/Inngest gaps.

The `correlationId` is propagated through the full pipeline via headers and event data, but none of the raw-console call sites include it in their log output, making cross-service tracing impossible in practice.

---

## E2E Flow (Step by Step)

### Step 1 — UI: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/`

- `page.tsx` prefetches via `orgTrpc.connections.generic.listInstallations` and `orgTrpc.workspace.sources.list` before rendering.
- `link-sources-button.tsx:45` fires `workspace.integrations.bulkLinkResources` mutation. On mutation failure, a raw `console.error` is called (browser-only, never reaches any log aggregator).

### Step 2 — tRPC: `api/console/src/router/org/workspace.ts` — `bulkLinkResources` mutation (lines 715+)

- Verifies workspace access and gwInstallation, then categorizes resources into create/reactivate/skip buckets.
- Calls `gw.registerResource()` per resource (best-effort). On failure, emits `console.error` at lines 829 and 878 — these only appear in Vercel Function Logs.
- Calls `notifyBackfill()` (void, best-effort) at lines 842 and 891 for created and reactivated resources respectively.

### Step 3 — tRPC: `notifyBackfill()` (lines 993–1069 in workspace.ts)

- Loads `backfillConfig` from DB if depth/entityTypes were not provided inline.
- Uses 6 raw `console.log/error` calls at lines 1005, 1023, 1029, 1038, 1054, 1059, and 1064 — covering the fetch of backfill config, trigger payload construction, success, and all error paths.
- Calls `createBackfillClient().trigger(payload)` which hits backfill `/api/trigger` over HTTP.
- Errors are caught and logged but never re-thrown (best-effort by design). This means a silent failure in backfill notification leaves no BetterStack trace.

### Step 4 — Backfill: `apps/backfill/src/routes/trigger.ts`

- Validates `X-API-Key` header and Zod schema on the incoming request.
- On validation or Inngest send failure, uses structured `log.error` at lines 69 and 132. These are the structured `log` instance from `apps/backfill/src/logger.ts`.
- On success, sends `apps-backfill/run.requested` Inngest event and returns 200.
- The lifecycle middleware wraps the entire request, so the full request (status, duration, correlationId) ships to BetterStack regardless of the route outcome.

### Step 5 — Backfill Inngest Workflows

- `backfill-orchestrator.ts:102` — `console.warn` for a skipped resource where `resourceName` is null or empty. This runs inside an Inngest step function, not inside the Hono request/response lifecycle, so it is not captured by the lifecycle middleware and goes only to Vercel Function Logs.
- `entity-worker.ts:191` — `console.warn` emitted when the `MAX_PAGES` cap is hit mid-backfill. Same context — Inngest step function, Vercel logs only.

### Step 6 — Relay: `apps/relay/src/routes/webhooks.ts` POST `/:provider`

The middleware chain runs in this order:
1. `providerGuard` — validates the `:provider` path param
2. `serviceAuthDetect` — determines if the request is service-originated (backfill) or from a real webhook provider
3. `serviceAuthBodyValidator` — validates backfill payloads
4. `webhookHeaderGuard` — validates provider-specific headers
5. `rawBodyCapture` — buffers raw body for HMAC
6. `signatureVerify` — verifies provider signature
7. `payloadParseAndExtract` — parses and extracts the canonical webhook payload

For the **service auth path** (backfill-originated): Redis dedup → DB insert → QStash publish to `/api/gateway/ingress`.
For the **standard webhook path**: triggers Upstash Workflow at `/workflows/webhook-delivery`.

Line 131 has a `console.error` for a delivery status update failure on the DB write path. This bypasses the structured `log` and goes only to Vercel Function Logs.

### Step 7 — Relay Workflows: `apps/relay/src/routes/workflows.ts`

- Upstash Workflow `webhookDeliveryWorkflow` steps: dedup → persist-delivery → resolve-connection → publish-to-console.
- `failureFunction` at line 220 uses `console.error` (unstructured, bypasses lifecycle middleware because workflow callbacks are not standard Hono request handlers in the same sense).
- `admin.ts`: the `/delivery-status` QStash callback at lines 283 and 290 uses `console.warn` and `console.log` — also unstructured.

### Step 8 — Console Ingress: `apps/console/src/app/api/gateway/ingress/route.ts`

- Upstash Workflow handler with QStash signature verification on the inbound request.
- Step 1 "resolve-workspace": `console.warn` at line 51 for an unknown `orgId`.
- Step 2 "transform-store-and-fan-out": `console.log` at line 61 for a missing transformer (i.e., no provider-specific transform function registered for this event type).
- On success: inserts to `workspaceIngestLogs`, fans out to Inngest (`apps-console/event.capture`) and Upstash Realtime.
- This is a Next.js API route, not a Hono service, so there is no lifecycle middleware. The correct logger here is `log` from `@vendor/observability/log.ts`.

---

## Logging Infrastructure (What Exists)

### `@vendor/observability/service-log.ts`

`createServiceLogger(config)` — the primary structured logger for Hono edge services.

- In production/preview (when `LOGTAIL_SOURCE_TOKEN` is set): wraps `@logtail/edge` and ships to BetterStack.
- In dev or when the token is absent: falls back to a console passthrough (same interface).
- Interface: `{ debug, info, warn, error, flush }`.

Instantiated per service:
- `apps/relay/src/logger.ts` → `log` with `service: "relay"`
- `apps/backfill/src/logger.ts` → `log` with `service: "backfill"`

### `@vendor/observability/log.ts`

The Next.js-targeted structured logger.

- In production/preview: uses `@logtail/next` — ships to BetterStack.
- In dev or without token: falls back to raw `console`.
- Exported as `log` (also typed to match the console interface, so it is a transparent drop-in).
- This is the logger that `notifyBackfill`, `bulkLinkResources`, and `ingress/route.ts` should use, but currently do not.

### Lifecycle Middleware (relay + backfill)

Both Hono services use a shared lifecycle middleware from `@vendor/observability`:

- Emits one structured JSON log per request with fields: `service`, `requestId`, `correlationId`, `method`, `path`, `status`, `duration_ms`, `source`, `provider`, `error`.
- Route handlers can enrich this log by setting `logFields` on the context.
- Ships to BetterStack via `log[level]()` at the end of each request.
- Adds an HTTP breadcrumb to Sentry via `addBreadcrumb()` on every request.
- Calls `log.flush()` after each request — uses `waitUntil` for edge, blocking for Node.

This means every request that reaches relay or backfill via HTTP produces a BetterStack entry regardless of whether the route handler itself logs anything. The gaps inside Inngest steps and Next.js handlers are entirely outside this middleware's reach.

---

## Gap Analysis

### Gap Map Table

| Location | File | Lines | Current Call | Destination |
|---|---|---|---|---|
| tRPC notifyBackfill (info paths) | `api/console/src/router/org/workspace.ts` | 1005, 1023, 1029, 1054, 1059 | `console.log` | Vercel Function Logs only |
| tRPC notifyBackfill (error paths) | `api/console/src/router/org/workspace.ts` | 1038, 1064 | `console.error` | Vercel Function Logs only |
| tRPC bulkLinkResources gw failures | `api/console/src/router/org/workspace.ts` | 829, 878 | `console.error` | Vercel Function Logs only |
| Backfill orchestrator skip | `apps/backfill/src/inngest/workflow/backfill-orchestrator.ts` | 102 | `console.warn` | Vercel Function Logs (bypasses service log) |
| Backfill entity-worker page cap | `apps/backfill/src/inngest/workflow/entity-worker.ts` | 191 | `console.warn` | Vercel Function Logs (bypasses service log) |
| Relay webhooks delivery-status update failure | `apps/relay/src/routes/webhooks.ts` | 131 | `console.error` | Vercel Function Logs (bypasses lifecycle log) |
| Relay workflow failureFunction | `apps/relay/src/routes/workflows.ts` | 220 | `console.error` | Vercel Function Logs (bypasses lifecycle log) |
| Relay admin delivery-status callback | `apps/relay/src/routes/admin.ts` | 283, 290 | `console.warn/log` | Vercel Function Logs (bypasses lifecycle log) |
| Console ingress unknown orgId | `apps/console/src/app/api/gateway/ingress/route.ts` | 51 | `console.warn` | Vercel Function Logs only |
| Console ingress no transformer | `apps/console/src/app/api/gateway/ingress/route.ts` | 61 | `console.log` | Vercel Function Logs only |

Total: 14 raw-console call sites across the E2E flow.

### Explanation by Boundary

**Next.js tRPC boundary (`api/console/`)**: The tRPC layer runs inside Next.js serverless functions. There is no Hono lifecycle middleware here. The `@vendor/observability/log.ts` export exists precisely for this context and is already wired to BetterStack in production via `@logtail/next`. All 9 `console.*` calls in `workspace.ts` (covering `notifyBackfill` and `bulkLinkResources` failures) should be replaced with `log` from that package. The replacement is a one-import change with no interface difference.

**Inngest workflow step boundary**: Steps inside `backfill-orchestrator.ts` and `entity-worker.ts` run in Inngest's managed environment. They are not inside a Hono request context, so the lifecycle middleware does not cover them. The backfill service `log` instance (`apps/backfill/src/logger.ts`) can be imported directly into these files — it is just a module-level singleton, not tied to request context. The 2 `console.warn` calls here should be replaced with `log.warn`.

**Relay async callbacks**: The `failureFunction` and admin `/delivery-status` callback are invoked asynchronously by Upstash/QStash after the original HTTP request has completed. The lifecycle middleware fires per-request, so these async callbacks are not covered. The relay `log` singleton (from `apps/relay/src/logger.ts`) is importable and usable here. The 3 call sites should be replaced with `log.warn/error`.

**Console ingress route**: This is a Next.js API route handler (not a Hono route), so lifecycle middleware does not apply. Same fix as the tRPC boundary: import `log` from `@vendor/observability/log.ts`. The 2 call sites should be replaced with `log.warn/log.info`.

---

## CorrelationId Propagation

The `correlationId` is thread through the full pipeline. The mechanism at each boundary:

1. **relay → backfill trigger**: The relay service generates a `correlationId` via `request-id.ts` middleware. When relay calls backfill's `/api/trigger`, it includes `X-Correlation-Id` in the outbound request headers.

2. **backfill HTTP handler**: The `request-id.ts` middleware on the backfill Hono app reads `X-Correlation-Id` from the incoming request and propagates it through the request context. The lifecycle middleware then includes it in the per-request BetterStack log entry.

3. **backfill → Inngest event**: The `correlationId` is included in the Inngest event `data` payload when `apps-backfill/run.requested` is sent. This allows it to be threaded into any downstream Inngest step that reads from `event.data`.

4. **backfill → QStash publish (relay path)**: When relay publishes to `/api/gateway/ingress` via QStash, the `correlationId` is carried in the `WebhookEnvelope` type, which is serialised into the QStash message body.

5. **console ingress**: The ingress route receives the `WebhookEnvelope` from QStash and has access to the `correlationId` field. However, neither of the raw-console call sites at lines 51 and 61 include it.

**The core problem**: the `correlationId` exists at every boundary, but none of the 14 raw-console call sites include it in their log output. This means that even if you can find a Vercel Function Log entry for a failure in `notifyBackfill`, there is no correlation token to link it to the BetterStack entry in relay or backfill that represents the same logical request.

The fix for each boundary is:
- **tRPC/ingress**: Pass `correlationId` as a field in the `log.*` call (it is available from the tRPC context or from the parsed QStash payload).
- **Inngest steps**: The `correlationId` is in `event.data`; pass it explicitly to each `log.warn/error` call as a structured field.
- **Relay async callbacks**: The `correlationId` is recoverable from the persisted delivery record; include it when logging failures.

---

## Sentry Integration Current State

### What Is Wired

- All three Hono services (relay, backfill, gateway) have `sentry-init.ts` and use the `sentry` middleware from `@vendor/observability` in their Hono app setup.
- The lifecycle middleware calls `addBreadcrumb()` per request, so every inbound HTTP request to relay or backfill creates a Sentry breadcrumb. This breadcrumb includes the `requestId`, `correlationId`, `method`, `path`, `status`, and `duration_ms`.
- 5xx responses are automatically captured by the Sentry middleware as exceptions. This covers cases like unhandled throws in route handlers.

### What Is Not Wired

- **Explicit `captureException` calls**: No service in the codebase currently calls `Sentry.captureException()` directly. All Sentry error capture is via the middleware's automatic 5xx detection. This means errors that are caught and handled (e.g., the best-effort patterns in `notifyBackfill` and `bulkLinkResources`) never reach Sentry at all.
- **tRPC boundary**: The Next.js tRPC layer has no Sentry middleware equivalent to the Hono lifecycle middleware. tRPC errors in `workspace.ts` that are caught internally (rather than thrown as `TRPCError`) are invisible to Sentry.
- **Inngest steps**: Inngest captures unhandled exceptions from step functions and surfaces them in the Inngest dashboard, but there is no Sentry integration wired into the Inngest workflow context. The 2 `console.warn` calls in backfill Inngest steps represent conditions (skip, page cap) that are notable but not fatal — they would benefit from Sentry breadcrumbs rather than full error capture.
- **Console ingress**: The ingress route is a Next.js API route. Sentry Next.js SDK may catch unhandled errors here, but the handled `console.warn/log` cases at lines 51 and 61 are not surfaced.

### Recommended Pattern

For caught errors that should reach Sentry (e.g., gateway registration failure in `bulkLinkResources`, Inngest send failure in `notifyBackfill`):

```ts
import * as Sentry from "@sentry/nextjs"

try {
  await gw.registerResource(...)
} catch (err) {
  log.error("gw.registerResource failed", { correlationId, error: err })
  Sentry.captureException(err, { extra: { correlationId, workspaceId } })
  // do not rethrow — best-effort
}
```

For notable non-error conditions (skip, page cap) in Inngest steps, `Sentry.addBreadcrumb()` is more appropriate than `captureException`.

---

## Open Questions

1. **Inngest step log destination**: When an Inngest step calls `console.warn`, does that appear in Vercel Function Logs, in the Inngest dashboard step output, or both? If it appears in the Inngest dashboard, the urgency of migrating those 2 call sites to `log.warn` is lower — but they still will not reach BetterStack.

2. **tRPC Sentry integration**: Is there a tRPC error formatter in `api/console` that could capture all tRPC procedure errors to Sentry automatically? This would be a higher-leverage fix than adding `captureException` per call site.

3. **`log.flush()` in tRPC handlers**: The `@logtail/next` logger buffers entries. Is there a mechanism in the tRPC layer (or the Next.js middleware chain) to call `log.flush()` at the end of a serverless function invocation? Without this, high-throughput mutations could lose log entries if the function container is recycled before flush.

4. **`correlationId` availability in `notifyBackfill`**: The `notifyBackfill` function is called from `bulkLinkResources` in the tRPC context. Does the tRPC context carry a `correlationId` (e.g., from an `X-Correlation-Id` header on the tRPC request from the browser)? If not, a `correlationId` should be generated at the tRPC call site and threaded into `notifyBackfill`'s payload so it can be included in the backfill trigger HTTP call and logged at every subsequent step.

5. **Admin `/delivery-status` coverage**: The relay `admin.ts` callback runs as a QStash-delivered HTTP request to the relay service. Does the lifecycle middleware cover it? If the admin routes are mounted on the same Hono app as the webhook routes, the answer is yes for the per-request lifecycle entry — but the specific `console.warn/log` lines at 283 and 290 still bypass it within the handler body.

6. **Backfill Inngest → BetterStack path**: The backfill service `log` object wraps `@logtail/edge`. Inngest step functions run in the same Node.js process as the Hono app (or in a separate Vercel Function invocation?). If they run in a separate invocation, importing `log` from `apps/backfill/src/logger.ts` in Inngest steps would correctly produce BetterStack entries only if the `LOGTAIL_SOURCE_TOKEN` env var is available in that invocation context — which it should be, given it is a Vercel environment variable shared across all functions in the app.
