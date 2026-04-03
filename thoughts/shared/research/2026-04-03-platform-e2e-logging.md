---
date: 2026-04-03T00:00:00+11:00
researcher: claude
git_commit: 34f5b76837648856dc476b8f947679021f7a6679
branch: chore/remove-memory-api-key-service-auth
repository: lightfast
topic: "End-to-end logging for apps/platform through all layers via @vendor/observability/src/log/"
tags: [research, codebase, platform, logging, observability, betterstack, sentry, inngest]
status: complete
last_updated: 2026-04-03
---

# Research: End-to-End Logging in apps/platform

**Date**: 2026-04-03
**Git Commit**: 34f5b76837648856dc476b8f947679021f7a6679
**Branch**: chore/remove-memory-api-key-service-auth

## Research Question

End-to-end logging for `apps/platform/` through the different layers using `@vendor/observability/src/log/`.

## Summary

The platform service uses a two-variant logging abstraction in `@vendor/observability/src/log/` that gates between BetterStack (production) and `console` (development). In production, BetterStack is the primary structured log sink. Sentry is a secondary sink that captures raw `console.error` / `console.warn` calls via `captureConsoleIntegration`, but does NOT intercept BetterStack-routed calls — so only dev-mode logs and the tRPC route's raw `console.error` reach Sentry's log capture.

Every Inngest function in `api/platform/src/` imports `log` from `@vendor/observability/log/next` (the Node.js variant). The HTTP routes in `apps/platform/src/app/api/` do the same, with one exception: the tRPC route uses `console.error` + `captureException` directly.

A `correlationId` field is threaded throughout the backfill pipeline and the neural event pipeline, appearing in nearly every `log.info` call for cross-function tracing.

---

## Layer 1: @vendor/observability/src/log/ — The Logging Primitives

### Two variants

**`vendor/observability/src/log/next.ts`** — Node.js server-only:
```ts
import "server-only";
import { log as logtail } from "@logtail/next";
import { betterstackEnv } from "../env/betterstack";

const shouldUseBetterStack = betterstackEnv.VERCEL_ENV === "production";
export const log = shouldUseBetterStack ? logtail : console;
```
- Gated on `VERCEL_ENV === "production"` via `betterstackEnv`
- Uses `@logtail/next` (Pino-based BetterStack logger) in production
- Falls back to `console` in development / preview

**`vendor/observability/src/log/edge.ts`** — Edge runtime:
```ts
import { Logtail } from "@logtail/edge";

export type EdgeLogger = Logger & { flush(): Promise<unknown> };

export const log: EdgeLogger =
  token && betterstackEdgeEnv.VERCEL_ENV === "production"
    ? fromLogtail(new Logtail(token, { endpoint: betterstackEdgeEnv.BETTERSTACK_INGESTING_HOST }))
    : { ...console, flush: () => Promise.resolve() };
```
- Gated on both `BETTERSTACK_SOURCE_TOKEN` presence AND `VERCEL_ENV === "production"`
- Adds `flush(): Promise<unknown>` to the `EdgeLogger` type — must be called before an Edge function returns to ensure buffered logs are shipped
- Falls back to `{ ...console, flush: () => Promise.resolve() }`

**`vendor/observability/src/log/types.ts`** — Shared interface:
```ts
export interface Logger {
  debug: (message: string, metadata?: Record<string, unknown>) => void;
  error: (message: string, metadata?: Record<string, unknown>) => void;
  info: (message: string, metadata?: Record<string, unknown>) => void;
  warn: (message: string, metadata?: Record<string, unknown>) => void;
}
```

### Environment config

Two separate env schemas power the environment gating:

- `vendor/observability/src/env/betterstack.ts` — uses `@t3-oss/env-nextjs` (includes `vercel()` preset). Reads `BETTERSTACK_SOURCE_TOKEN`, `BETTERSTACK_INGESTING_HOST`, and the Vercel preset's `VERCEL_ENV`.
- `vendor/observability/src/env/betterstack-edge.ts` — uses `@t3-oss/env-core` (plain, no client prefix). Same vars but Edge-compatible env access.

The `vendor/observability/src/index.ts` only re-exports the `Logger` type — not the concrete `log` instances. Consumers import from the specific subpath they need (`/log/next` or `/log/edge`).

---

## Layer 2: apps/platform — Instrumentation & Middleware

### Sentry instrumentation (`apps/platform/src/instrumentation.ts`)

```ts
captureConsoleIntegration({ levels: ["error", "warn"] })
extraErrorDataIntegration({ depth: 3 })
enableLogs: true
tracesSampleRate: production ? 0.2 : 1.0
```

Initialised for both `NEXT_RUNTIME === "nodejs"` and `NEXT_RUNTIME === "edge"`. Key behaviour:

- `captureConsoleIntegration` captures **raw `console.error` and `console.warn` calls** → Sentry.
- In **development**, `log` from `log/next` is `console` itself, so `log.error/warn` → `console.error/warn` → captured by Sentry.
- In **production**, `log` from `log/next` is the BetterStack Logtail logger, which does NOT call `console.error/warn` — so `log.error/warn` → BetterStack only (not captured by `captureConsoleIntegration`).
- The only code that reliably reaches Sentry in production is raw `console.error`/`console.warn` calls — currently only in the tRPC route.
- `onRequestError = captureRequestError` (exported) catches unhandled Next.js request errors to Sentry independently.

**Effective dual-sink behaviour by environment:**

| Environment | `log.info/debug` | `log.warn/error` | raw `console.error` |
|---|---|---|---|
| production | BetterStack | BetterStack | Sentry |
| development | console (terminal) | console → Sentry | Sentry |

### Middleware (`apps/platform/src/middleware.ts`)

Handles security headers only (nosecone). **No logging** — runs on Edge runtime, does not import `log`.

### `apps/platform/src/env.ts`

Imports `betterstackEnv` and `sentryEnv` from `@vendor/observability` — the platform's env schema extends both.

---

## Layer 3: apps/platform — HTTP Route Handlers

All route handlers except tRPC declare `export const runtime = "nodejs"` and use `log/next`.

### `/api/ingest/[provider]/route.ts`

The primary webhook ingestion endpoint. Uses `log` from `@vendor/observability/log/next`:

| Call site | Level | Message |
|---|---|---|
| Provider config not found | `error` | `"[ingest] provider config not found"` + `{ provider }` |
| HMAC signature invalid | `warn` | `"[ingest] signature verification failed"` + `{ provider }` |
| Payload schema validation failed | `warn` | `"[ingest] payload schema validation failed"` + `{ provider, error }` |
| Webhook accepted | `info` | `"[ingest] webhook received"` + `{ provider, deliveryId, eventType, resourceId }` |

### `/api/trpc/[trpc]/route.ts`

**Does not use the observability `log`.** Uses:
```ts
console.error(`>>> tRPC Error on 'memory.${path}'`, error);
captureException(error);  // Sentry direct capture
```
Only `INTERNAL_SERVER_ERROR` triggers `captureException`. Other tRPC errors go to `console.error` only.

### `/api/connect/[provider]/authorize/route.ts`

No logging. Returns JSON directly.

### `/api/connect/[provider]/callback/route.ts`

No logging in the route handler itself. Delegates to `processOAuthCallback` in the lib layer.

### `/api/connect/oauth/poll/route.ts`

No logging.

---

## Layer 4: api/platform — Library Layer

### `lib/oauth/callback.ts`

Logging only in the `catch` block of `processOAuthCallback`:
```ts
log.error("[oauth/callback] oauth callback failed", { provider: providerName, error: message });
```
All other flow paths (state errors, provider config missing) return structured `CallbackProcessResult` without logging.

### `lib/jobs.ts`

Extensive logging for the `orgWorkflowRuns` job lifecycle:

| Function | Level | Message |
|---|---|---|
| `createJob` — invalid input | `error` | `"Invalid workflow input"` + `{ error, input }` |
| `createJob` — already exists | `info` | `"Job already exists, returning existing ID"` + `{ jobId, inngestRunId }` |
| `createJob` — created | `info` | `"Created job record"` + `{ jobId, inngestRunId, name }` |
| `createJob` — DB failure | `error` | `"Failed to create job record"` + `{ error, inngestRunId, name }` |
| `updateJobStatus` — updated | `info` | `"Updated job status"` + `{ jobId, status }` |
| `updateJobStatus` — DB failure | `error` | `"Failed to update job status"` + `{ error, jobId, status }` |
| `completeJob` — invalid output | `error` | `"Invalid workflow output"` + `{ error, output }` |
| `completeJob` — completed | `info` | `"Completed job"` + `{ jobId, status, durationMs }` |
| `completeJob` — DB failure | `error` | `"Failed to complete job"` + `{ error, jobId, status }` |
| `getJob` — invalid ID | `error` | `"Invalid job ID format"` + `{ jobId }` |
| `getJob` — DB failure | `error` | `"Failed to get job"` + `{ error, jobId }` |
| `getJobByInngestRunId` — DB failure | `error` | `"Failed to get job by Inngest run ID"` + `{ error, inngestRunId }` |

### `lib/edge-resolver.ts`

Logging within `resolveEdges`:
```ts
log.warn("Edge resolver co-occurrence limit reached, recent events preferred", { eventId, clerkOrgId, entityCount })
log.info("Entity edges created", { eventId, count })
log.error("Failed to create entity edges", { error, clerkOrgId })
```

---

## Layer 5: api/platform — Inngest Functions

### Neural pipeline (event-driven chain)

**Event flow**: `memory/webhook.received` → `ingest-delivery` → `memory/event.capture` → `memory-event-store` → `memory/entity.upserted` → `memory-entity-graph` → `memory/entity.graphed` → `memory-entity-embed` → `memory/event.stored` → `memory-notification-dispatch`

#### `ingest-delivery.ts` (`memory/ingest.delivery`)

Trigger: `memory/webhook.received`

| Step | Level | Message |
|---|---|---|
| After `resolve-connection` step | `info` | `"[ingest-delivery] connection resolved"` + `{ clerkOrgId, provider, deliveryId, correlationId }` |
| Inside `transform-and-store`: no transformer | `info` | `"[ingest-delivery] No transformer, skipping"` + `{ provider, eventType, deliveryId, correlationId }` |
| Inside `transform-and-store`: event stored | `info` | `"[ingest-delivery] event stored"` + `{ ingestLogId, clerkOrgId, deliveryId, correlationId }` |
| Inside `publish-realtime` step | `info` | `"[ingest-delivery] realtime notification published"` + `{ clerkOrgId, ingestLogId, correlationId }` |

#### `memory-event-store.ts` (`memory/event.store`)

Trigger: `memory/event.capture`. Uses `createNeuralOnFailureHandler` for centralized failure logging.

| Step | Level | Message |
|---|---|---|
| Function entry | `info` | `"Storing neural observation"` + `{ clerkOrgId, externalId, provider, eventType, sourceId, ingestLogId, correlationId }` |
| `check-duplicate`: duplicate found | `info` | `"Observation already exists, skipping"` + `{ observationId, sourceId }` |
| `check-event-allowed`: no resource ID | `info` | `"No resource ID in attributes, rejecting event"` + `{ provider, eventType }` |
| `check-event-allowed`: no integration | `info` | `"Integration not found for resource, rejecting event"` + `{ clerkOrgId, resourceId, provider }` |
| `check-event-allowed`: inactive integration | `info` | `"Integration is not active, rejecting event (Gate 2)"` + `{ clerkOrgId, resourceId, provider, integrationStatus, statusReason }` |
| `check-event-allowed`: filtered by config | `info` | `"Event filtered by provider config"` + `{ clerkOrgId, resourceId, eventType, baseEventType, configuredEvents }` |
| `store-observation`: stored | `info` | `"Observation stored"` + `{ observationId, externalId, observationType, ingestLogId, correlationId }` |
| `upsert-entities-and-junctions`: stored | `info` | `"Entities and junctions stored"` + `{ observationId, entitiesStored, ingestLogId, correlationId }` |

#### `memory-entity-graph.ts` (`memory/entity.graph`)

Trigger: `memory/entity.upserted`. Uses `createNeuralOnFailureHandler`.

```ts
log.info("[entity-graph] edges resolved", { clerkOrgId, internalEventId, provider, entityExternalId, edgeCount, correlationId })
```
Then emits `memory/entity.graphed`.

#### `memory-entity-embed.ts` (`memory/entity.embed`)

Trigger: `memory/entity.graphed`. Uses `createNeuralOnFailureHandler`. Debounced per `entityExternalId` (30s).

```ts
log.info("Entity vector upserted", { entityExternalId, entityType, vectorId, totalEvents, edgeCount, narrativeHash, correlationId })
```

#### `memory-notification-dispatch.ts` (`memory/notification.dispatch`)

Trigger: `memory/event.stored`. No `onFailure` handler.

```ts
log.info("Knock not configured, skipping notification", { clerkOrgId, eventExternalId })
log.info("Knock notification triggered", { clerkOrgId, eventExternalId, significanceScore })
```
Silent skip (no logging) when `significanceScore < 70`.

---

### Infrastructure / cron functions

#### `delivery-recovery.ts` (`memory/delivery.recovery`)

Cron: `*/5 * * * *`. Sweeps `gatewayWebhookDeliveries` stuck in `status="received"` for >5 minutes.

```ts
log.info("[delivery-recovery] found stuck deliveries", { count })
log.error("[delivery-recovery] DB status update failed", { deliveryId, error })
log.info("[delivery-recovery] complete", { replayed, skipped, failed })
```

#### `token-refresh.ts` (`memory/token.refresh`)

Cron: `*/5 * * * *`. Refreshes tokens expiring in the next 10 minutes.

```ts
log.info("[token-refresh] tokens expiring soon", { count })
log.warn("[token-refresh] provider not configured — skipping", { provider, installationId })
log.info("[token-refresh] token refreshed", { installationId, provider })
log.warn("[token-refresh] refresh failed", { installationId, provider, error })
```

#### `health-check.ts` (`memory/health.check`)

Cron: `*/5 * * * *`. Probes all active installations via provider health check API.

```ts
log.info("[health-check] probing installations", { count })
log.warn("[health-check] provider not configured — skipping", { provider, installationId })
log.info("[health-check] healthy", { installationId, provider })
log.warn("[health-check] auth failure — firing lifecycle", { installationId, provider, status })
log.warn("[health-check] transient failure recorded", { installationId, provider, newFailureCount, healthStatus })
```

#### `connection-lifecycle.ts` (`memory/connection.lifecycle`)

**No `log` import. No observability logging.** Teardown audit trail is written entirely to the `gatewayLifecycleLogs` DB table via `db.insert(gatewayLifecycleLogs).values(...)`.

---

### Backfill pipeline

#### `memory-backfill-orchestrator.ts` (`memory/backfill.orchestrator`)

Trigger: `memory/backfill.run.requested`. Cancellable via `memory/backfill.run.cancelled`.

| Stage | Level | Message |
|---|---|---|
| Entry | `info` | `"[backfill-orchestrator] starting"` + `{ installationId, provider, depth, entityTypes, correlationId }` |
| After `get-connection` step | `info` | `"[backfill-orchestrator] connection fetched"` + `{ installationId, provider, resourceCount, correlationId }` |
| Resource with null name (warning) | `warn` | `"[backfill] skipping resource with null/empty resourceName"` + `{ installationId, providerResourceId, correlationId }` |
| After gap-aware filtering | `info` | `"[backfill-orchestrator] work units planned"` + `{ installationId, provider, total, afterFilter, skippedByGapFilter, since, correlationId }` |
| Before dispatching workers | `info` | `"[backfill-orchestrator] dispatching entity workers"` + `{ installationId, provider, count, workUnitIds, correlationId }` |
| Before replay | `info` | `"[backfill-orchestrator] replaying held webhooks"` + `{ installationId, succeededWorkers, correlationId }` |
| Replay iteration cap hit | `error` | `"[backfill] replay-held-webhooks hit iteration cap"` + `{ installationId, iterations, correlationId }` |
| Completion | `info` | `"[backfill-orchestrator] complete"` + `{ installationId, provider, completed, failed, eventsProduced, eventsDispatched, correlationId }` |

#### `memory-entity-worker.ts` (`memory/backfill.entity-worker`)

Trigger: invoked via `step.invoke()` from the orchestrator.

| Stage | Level | Message |
|---|---|---|
| Entry | `info` | `"[entity-worker] starting"` + `{ installationId, provider, entityType, resource, since, correlationId }` |
| Per page fetched | `info` | `"[entity-worker] page fetched"` + `{ installationId, entityType, resource, page, events, rateLimitRemaining?, correlationId }` |
| Per page dispatched | `info` | `"[entity-worker] page dispatched"` + `{ installationId, entityType, resource, page, dispatched, correlationId }` |
| Rate limit sleep | `info` | `"[entity-worker] rate limit sleep"` + `{ installationId, entityType, resource, sleepMs, resetAt, correlationId }` |
| MAX_PAGES cap hit | `warn` | `"[backfill] entity-worker hit MAX_PAGES cap (N)"` + `{ installationId, entityType, resource, correlationId }` |
| Completion | `info` | `"[entity-worker] complete"` + `{ installationId, provider, entityType, resource, eventsProduced, eventsDispatched, pagesProcessed, correlationId }` |

---

## Layer 6: on-failure-handler.ts — Centralized Failure Logging

`api/platform/src/inngest/on-failure-handler.ts` exports `createNeuralOnFailureHandler`, a factory used by all neural pipeline functions:

```ts
log.error(config?.logMessage ?? `${String(_eventName)} failed`, {
  ...(config?.logContext(data) ?? {}),
  error: error.message,
});
```

Used by:
- `memory-event-store.ts` → `"Neural observation store failed"` + `{ clerkOrgId, sourceId }`
- `memory-entity-graph.ts` → uses default message for `memory/entity.upserted`
- `memory-entity-embed.ts` → uses default message for `memory/entity.graphed`

Also calls `completeJob` (from `lib/jobs.ts`) to mark the workflow run as failed in the DB.

---

## Cross-Cutting: correlationId Threading

`correlationId` is an optional string threaded through the entire pipeline for distributed tracing. It originates from:

1. **Backfill requests** — set in `memory/backfill.run.requested` event data, threaded through orchestrator → entity-worker → `memory/webhook.received`
2. **Ingest delivery** — passed in `memory/webhook.received`, threaded through `memory/event.capture` → `memory-event-store` → `memory/entity.upserted` → `memory-entity-graph` → `memory/entity.graphed` → `memory-entity-embed`

Appears in `log.info` metadata for: `ingest-delivery`, `memory-event-store`, `memory-entity-graph`, `memory-entity-embed`, `memory-backfill-orchestrator`, `memory-entity-worker`.

---

## Cross-Cutting: Log Message Prefix Convention

Bracketed `[prefix]` convention used by most functions. Some older/lib-layer messages use plain strings.

| Prefix | Source |
|---|---|
| `[ingest]` | `apps/platform/src/app/api/ingest/[provider]/route.ts` |
| `[ingest-delivery]` | `api/platform/src/inngest/functions/ingest-delivery.ts` |
| `[entity-graph]` | `api/platform/src/inngest/functions/memory-entity-graph.ts` |
| `[backfill-orchestrator]` | `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts` |
| `[backfill]` | `memory-backfill-orchestrator.ts` + `memory-entity-worker.ts` (shared prefix) |
| `[entity-worker]` | `api/platform/src/inngest/functions/memory-entity-worker.ts` |
| `[delivery-recovery]` | `api/platform/src/inngest/functions/delivery-recovery.ts` |
| `[token-refresh]` | `api/platform/src/inngest/functions/token-refresh.ts` |
| `[health-check]` | `api/platform/src/inngest/functions/health-check.ts` |
| `[oauth/callback]` | `api/platform/src/lib/oauth/callback.ts` |
| *(no prefix)* | `lib/jobs.ts`, `lib/edge-resolver.ts`, `memory-event-store.ts`, `memory-entity-embed.ts`, `memory-notification-dispatch.ts` |

---

## Code References

- `vendor/observability/src/log/next.ts:1-10` — Node.js BetterStack/console gate
- `vendor/observability/src/log/edge.ts:1-29` — Edge BetterStack/console gate with `flush()`
- `vendor/observability/src/log/types.ts:1-7` — `Logger` interface
- `vendor/observability/src/env/betterstack.ts:1-25` — Node.js env schema
- `vendor/observability/src/env/betterstack-edge.ts:1-20` — Edge env schema
- `apps/platform/src/instrumentation.ts:1-50` — Sentry init for both runtimes with `captureConsoleIntegration`
- `apps/platform/src/app/api/ingest/[provider]/route.ts:21` — `log` import, uses `log.error/warn/info`
- `apps/platform/src/app/api/trpc/[trpc]/route.ts:43-47` — `console.error` + `captureException` (not using observability `log`)
- `api/platform/src/inngest/on-failure-handler.ts:31` — `log.error` in centralized failure factory
- `api/platform/src/lib/jobs.ts:20` — extensive `log.info/error` throughout job lifecycle
- `api/platform/src/lib/edge-resolver.ts:10` — `log.warn/info/error` in edge resolution
- `api/platform/src/lib/oauth/callback.ts:13` — `log.error` only in catch block
- `api/platform/src/inngest/functions/ingest-delivery.ts:25` — `[ingest-delivery]` logging
- `api/platform/src/inngest/functions/memory-event-store.ts:36` — neural pipeline event logging
- `api/platform/src/inngest/functions/memory-entity-graph.ts:12` — `[entity-graph]` logging
- `api/platform/src/inngest/functions/memory-entity-embed.ts:23` — entity vector logging
- `api/platform/src/inngest/functions/memory-notification-dispatch.ts:1` — Knock notification logging
- `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts:25` — `[backfill-orchestrator]` heavy logging
- `api/platform/src/inngest/functions/memory-entity-worker.ts:22` — `[entity-worker]` per-page logging
- `api/platform/src/inngest/functions/delivery-recovery.ts:17` — `[delivery-recovery]` logging
- `api/platform/src/inngest/functions/token-refresh.ts:17` — `[token-refresh]` logging
- `api/platform/src/inngest/functions/health-check.ts:18` — `[health-check]` logging
- `api/platform/src/inngest/functions/connection-lifecycle.ts` — **no observability logging** (DB audit trail only)

---

## Architecture Documentation

### Which `log` variant is used in platform

All consumers (`api/platform/src/` and `apps/platform/src/app/api/`) import from `@vendor/observability/log/next` — the Node.js server-only variant. All route handlers explicitly declare `export const runtime = "nodejs"`.

The `edge.ts` variant is not used anywhere in `apps/platform`. It exists for other apps (e.g., `apps/app`) that have Edge middleware or Edge route handlers.

### How the `log` call reaches BetterStack

In production:
1. Code calls `log.info(message, metadata)` where `log` is the `@logtail/next` logger.
2. Logtail serializes the structured log entry (message + metadata as JSON fields).
3. The entry is shipped to `BETTERSTACK_INGESTING_HOST` using the `BETTERSTACK_SOURCE_TOKEN`.
4. BetterStack indexes and makes it searchable.

In development:
1. Code calls `log.info(message, metadata)` where `log` is `console`.
2. Node.js prints to stdout.
3. Sentry's `captureConsoleIntegration` intercepts `console.error/warn` → Sentry (Spotlight in development).

### Where audit trails live vs. observability logs

`connection-lifecycle.ts` is the clear example of deliberate separation: it writes every state transition to `gatewayLifecycleLogs` (DB) rather than using `log`. This means connection teardown events are queryable via SQL, not just searchable in BetterStack.

The `jobs.ts` library bridges both: it logs job lifecycle to BetterStack via `log`, AND persists the job record with status/output to `orgWorkflowRuns` (DB).

---

## Open Questions

- The edge `log` variant's `flush()` method is defined but no callers are observed in `apps/platform`. If an Edge route were ever added that used `log/edge`, `flush()` would need to be called before returning the `Response` to avoid dropped logs.
- The tRPC route's use of `console.error` + `captureException` is the only place that deviates from the `log` pattern. This means tRPC errors go to Sentry directly (always) but only to BetterStack if/when they also happen to call `console.error` (which in production bypasses Logtail entirely).
