---
date: 2026-03-14T06:50:00+0000
researcher: claude
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "apps/backfill/ end-to-end implementation investigation"
tags: [research, codebase, backfill, inngest, gateway, relay, orchestrator, entity-worker]
status: complete
last_updated: 2026-03-14
---

# Research: `apps/backfill/` End-to-End Implementation Investigation

**Date**: 2026-03-14T06:50:00+0000
**Git Commit**: 4ec3c541776200e318c670c5064af752d9e142f0
**Branch**: feat/backfill-depth-entitytypes-run-tracking

## Research Question

Deep investigate whether `@apps/backfill/` is correctly implemented end to end.

## Summary

The `@lightfast/backfill` service is a Hono + srvx edge-runtime microservice that orchestrates historical data import for connected provider installations. It exposes three HTTP route groups (`/api/trigger`, `/api/estimate`, `/api/inngest`), backed by two Inngest functions (orchestrator + entity worker). All called external endpoints in gateway and relay services exist and match expected contracts. The authentication, tenant isolation, pagination, rate-limiting, gap-aware filtering, cancellation, and hold-for-replay patterns are all implemented end-to-end with consistent contracts across service boundaries.

---

## Detailed Findings

### 1. Service Entry Point & Middleware Stack

**File**: `apps/backfill/src/app.ts`

The Hono app applies four middleware in fixed order, matching the pattern documented in `CLAUDE.md`:

```
requestId → lifecycle → errorSanitizer → sentry
```

| Middleware | File | Behaviour |
|---|---|---|
| `requestId` | `middleware/request-id.ts` | Reads/generates `X-Request-Id` (nanoid fallback), propagates `X-Correlation-Id` (defaults to requestId). Sets both as Hono context vars and response headers. |
| `lifecycle` | `middleware/lifecycle.ts` | Structured JSON per-request logging to BetterStack. Dev-only: 100–500ms artificial delay. In `finally`: computes `duration_ms`, builds log entry, ships to BetterStack, adds Sentry breadcrumb, flushes logger (edge: `waitUntil`, node: `await`). |
| `errorSanitizer` | `middleware/error-sanitizer.ts` | In production: replaces 5xx response body with `{"error":"An unexpected error occurred"}`. In dev: passes original body through unchanged. |
| `sentry` | `middleware/sentry.ts` | Wraps `next()`. On thrown exception: sets scoped tags (service, method, path, request_id, correlation_id), `captureException`, re-throws. After `next()` for explicitly returned 5xx: `captureMessage` at error level. |

Routes registered:

```
GET  /              → health check { service: "backfill", status: "ok" }
POST /api/trigger   → backfillOrchestrator trigger
POST /api/trigger/cancel → cancel running backfill
POST /api/estimate  → probe and estimate backfill scope
GET/POST/PUT /api/inngest → Inngest SDK endpoint (serves orchestrator + entity worker)
```

---

### 2. Environment / Config (`apps/backfill/src/env.ts`)

Validated via `@t3-oss/env-core` at startup. Required vars:

| Var | Validation | Notes |
|---|---|---|
| `GATEWAY_API_KEY` | `z.string().min(1)` | Shared secret for all inter-service auth |
| `INNGEST_APP_NAME` | `z.string().min(1).startsWith("lightfast-")` | Inngest client ID |
| `INNGEST_EVENT_KEY` | optional | Inngest event publishing key |
| `INNGEST_SIGNING_KEY` | optional, `startsWith("signkey-")` | Inngest webhook verification |
| `SENTRY_DSN` | optional URL | Sentry reporting |
| `LOGTAIL_SOURCE_TOKEN` | optional | BetterStack token |
| `PORT` | coerce number, default `4109` | Service port |

`skipValidation` is true when `SKIP_ENV_VALIDATION=1` or `npm_lifecycle_event === "lint"`.

---

### 3. Inngest Client & Event Schemas (`apps/backfill/src/inngest/client.ts`)

Three events are declared on the Inngest client:

| Event Name | Schema | Direction |
|---|---|---|
| `apps-backfill/run.requested` | `backfillTriggerPayload` | Relay/Console → Backfill orchestrator trigger |
| `apps-backfill/run.cancelled` | `{ installationId, correlationId? }` | Gateway → cancel any running backfill |
| `apps-backfill/entity.requested` | Full entity worker payload | Orchestrator → entity worker (via `step.invoke`, not raw event send) |

**`backfillTriggerPayload`** (from `packages/console-providers/src/gateway.ts:142-152`):

| Field | Type | Notes |
|---|---|---|
| `installationId` | `string, min(1)` | Required |
| `provider` | `sourceTypeSchema` enum: `"github" \| "vercel" \| "linear" \| "sentry"` | Required |
| `orgId` | `string, min(1)` | Required |
| `depth` | `7 \| 30 \| 90`, default `30` | Days of history to backfill |
| `entityTypes` | `string[]` optional | Override provider default entity types |
| `holdForReplay` | `boolean` optional | When true, webhooks held for batch replay |
| `correlationId` | `string` optional | Cross-service trace ID |

**`backfillDepthSchema`**: `z.union([z.literal(7), z.literal(30), z.literal(90)])` — exactly three literal values.

**`backfillEstimatePayload`**: `backfillTriggerPayload.omit({ holdForReplay: true })` — identical minus `holdForReplay`.

---

### 4. HTTP Route: `POST /api/trigger` (`apps/backfill/src/routes/trigger.ts`)

**Auth**: Validates `X-API-Key` against `GATEWAY_API_KEY` using `timingSafeStringEqual` (constant-time comparison — prevents timing attacks).

**Body**: Parsed via `backfillTriggerPayload.safeParse(raw)`.

**Success path**: Sends `apps-backfill/run.requested` Inngest event with all fields from body, using `body.correlationId ?? c.get("correlationId")` as the correlation ID. Returns `{ status: "accepted", installationId }`.

**Error paths**:
- Missing/wrong API key → 401
- Invalid JSON → 400
- Validation failure → 400 with Zod issues
- Inngest send failure → 502

**Tests**: `apps/backfill/src/routes/trigger.test.ts` — covers auth (missing, wrong), all required field validations, event name/data assertions, depth defaults (30), custom depth (90), custom entityTypes, Inngest rejection → 502.

---

### 5. HTTP Route: `POST /api/trigger/cancel` (`apps/backfill/src/routes/trigger.ts:84-135`)

**Auth**: Same `X-API-Key` check.

**Body**: `cancelSchema = z.object({ installationId: z.string().min(1) })`.

**Gateway verification**: Calls `gw.getConnection(body.installationId).catch(() => null)` — if gateway returns error or connection not found → 404 `connection_not_found`.

**Success path**: Sends `apps-backfill/run.cancelled` Inngest event. Any active orchestrator/entity-worker for this `installationId` has `cancelOn` registered for this event. Returns `{ status: "cancelled", installationId }`.

**Tests**: `trigger.test.ts` — covers auth, missing installationId, inngest send success/failure, 404 when gateway fails.

---

### 6. HTTP Route: `POST /api/estimate` (`apps/backfill/src/routes/estimate.ts`)

Probes the provider API (via gateway proxy) for a scope estimate without starting a full backfill.

**Auth**: `X-API-Key` check.

**Flow**:
1. Parse `backfillEstimatePayload`
2. Fetch connection from gateway → 404 if not found
3. Verify `connection.orgId === orgId` → 403 if mismatch (tenant isolation)
4. Resolve provider def via `getProvider(provider)` → 400 if unknown
5. Resolve entity types (body override or `providerDef.backfill.defaultEntityTypes`)
6. Compute `since` = `Date.now() - depth * 86_400_000ms`
7. Probe all `resource × entityType` combinations in parallel via `Promise.allSettled`
8. For each probe: call `entityHandler.buildRequest(ctx, null)` + `gw.executeApi()` + `entityHandler.processResponse()` → collects `{ returnedCount, hasMore }`
9. If `executeApi` throws or returns non-200 → `returnedCount = -1, hasMore = false` (graceful degradation)
10. Aggregate per-entityType: `estimatedItems` (sum of positive returnedCounts), `estimatedPages` (samples + pagesWithMore × 2)
11. Total API calls estimate: `totalEstimatedPages * 2 + 2`

**Tests**: `estimate.test.ts` — covers auth, JSON validation, required fields, connection 404, org mismatch 403, invalid provider 400, success with default entity types (6 executeApi calls for 2 resources × 3 types), custom entity types, `hasMore` page estimation, URL-unsafe characters in providerResourceId, executeApi errors (degraded to -1, excluded from estimatedItems).

---

### 7. HTTP Route: `/api/inngest` (`apps/backfill/src/routes/inngest.ts`)

Uses `@vendor/inngest/hono` serve handler. Registered on `GET | POST | PUT /` to support Inngest's introspection and webhook delivery. Serves exactly two functions:

```ts
functions: [backfillOrchestrator, backfillEntityWorker]
```

---

### 8. Inngest Function: Backfill Orchestrator (`apps/backfill/src/workflows/backfill-orchestrator.ts`)

**Function ID**: `apps-backfill/run.orchestrator`
**Trigger**: `apps-backfill/run.requested`

**Concurrency**:
- `{ limit: 1, key: "event.data.installationId" }` — prevents duplicate backfills per connection
- `{ limit: 10 }` — global cap on concurrent orchestrators (each is lightweight fan-out)

**Timeouts**: `start: "2m"`, `finish: "8h"` (worst case: 15 work units at 5 concurrent, each 2hr = 6hr, 8hr is safety buffer).

**CancelOn**: `apps-backfill/run.cancelled` matching `data.installationId`.

**Retries**: 3.

**Step sequence**:

| Step | Operation |
|---|---|
| `get-connection` | `gw.getConnection(installationId)` — throws `NonRetriableError` if not `active` or orgId mismatch |
| `get-backfill-history` | `gw.getBackfillRuns(installationId, "completed")` — returns `[]` on failure (non-blocking) |
| _(inline)_ | `getProvider(provider)` — throws `NonRetriableError` if unknown provider |
| `compute-since` | `Date.now() - depth * 86_400_000ms` as ISO string — inside step for determinism across retries |
| _(inline)_ | Enumerate work units: `connection.resources × resolvedEntityTypes` |
| _(inline)_ | **Gap-aware filtering**: skip work units where `priorRun.since <= since` (prior run already covers this range) |
| _(inline, early return)_ | If all work units filtered: return `{ success: true, dispatched: 0, ... }` |
| `invoke-{workUnitId}` × N | `step.invoke(backfillEntityWorker, data, timeout: "4h")` — per filtered work unit, all in `Promise.all` |
| `persist-run-records` | Groups results by entityType, sums stats, calls `gw.upsertBackfillRun()` once per entityType. Status: `"completed"` if all resources succeeded, `"failed"` otherwise. |
| `replay-held-webhooks` | If `holdForReplay && succeeded.length > 0`: drains relay catchup in batches of 200, max 500 iterations (100k webhooks cap). |

**Return shape**: `{ success, installationId, provider, workUnits, skipped, dispatched, completed, failed, eventsProduced, eventsDispatched, results[] }`.

**Gap-aware filtering logic** (`backfill-orchestrator.ts:116-125`):

```ts
const filteredWorkUnits = workUnits.filter((wu) => {
  const priorRun = backfillHistory.find((h) => h.entityType === wu.entityType);
  if (!priorRun) return true; // No prior run — must fetch
  // Prior run's since <= requested since → already covered
  return new Date(priorRun.since) > new Date(since);
});
```

A prior run "covers" an entity type if its `since` timestamp is earlier or equal to the new `since` (meaning it already fetched a wider or equal range). Boundary overlap is handled by relay's `deliveryId` deduplication.

**Tests**: `backfill-orchestrator.test.ts` — covers connection state transitions (active/inactive/error/orgId mismatch/API error), empty resources early return, provider resolution, entity type override vs default, work unit enumeration (2 resources × 3 types = 6), invoke per work unit, invoke rejection → `{ success: false }`, aggregation (all succeed / any fail), `persist-run-records` (per entityType with summed stats, partial failure → status "failed", gap-filtered skips persist), gap-aware filtering (skip covered / include when depth escalates / continue with empty history / early return when all skipped), correlationId forwarding, holdForReplay propagation and replay step trigger/skip logic.

---

### 9. Inngest Function: Entity Worker (`apps/backfill/src/workflows/entity-worker.ts`)

**Function ID**: `apps-backfill/entity.worker`
**Trigger**: `apps-backfill/entity.requested` (but in practice invoked via `step.invoke`, not raw event send)

**Concurrency**:
- `{ limit: 5, key: "event.data.orgId" }` — per-org worker cap
- `{ limit: 10 }` — global cap

**Throttle**: `{ limit: 4000, period: "1h", key: "event.data.installationId" }` — `GITHUB_RATE_LIMIT_BUDGET = 4000` req/hr per installation (GitHub limit 5000 - 1000 reserved for realtime).

**CancelOn**: `apps-backfill/run.cancelled` matching `data.installationId` (must be declared independently — does not propagate from orchestrator).

**Timeouts**: `start: "5m"`, `finish: "2h"`.

**Retries**: 3.

**Pagination loop** (per page, using Inngest steps for memoization):

| Step | Operation |
|---|---|
| `fetch-{entityType}-p{N}` | `entityHandler.buildRequest(ctx, cursor)` → `gw.executeApi(installationId, { endpointId, ...request })` → `entityHandler.processResponse(data, ctx, cursor, headers)` → `providerDef.api.parseRateLimit(new Headers(raw.headers))` |
| `dispatch-{entityType}-p{N}` | Sends each `webhookEvent` to relay in batches of 5 via `relay.dispatchWebhook(provider, { connectionId, orgId, deliveryId, eventType, payload, receivedAt }, holdForReplay)` |
| `rate-limit-{entityType}-p{N}` | If `remaining < limit * 0.1`: `step.sleep` until `resetAt` |

Non-200 from `gw.executeApi` → throws `HttpError(status)`.

**Return shape**: `{ entityType, resource: providerResourceId, eventsProduced, eventsDispatched, pagesProcessed }`.

**Tests**: `entity-worker.test.ts` — covers provider/entity type resolution failures, single-page dispatch (3 events), dispatch payload shape, relay error propagation, multi-page pagination (cursor threading), executeApi errors (rejection + non-200 status), rate limit sleep trigger (remaining < 10%) and skip (remaining >= 10%), completion stats (single + multi-page), orgId forwarding, holdForReplay: true/undefined passthrough.

**Step replay tests**: `step-replay.test.ts` — uses `createRecordingStep` + `createReplayStep` to simulate Inngest's memoized replay. Verifies that replaying steps from a journal produces identical results for both the entity worker (single-page + multi-page) and orchestrator (success + mixed success/failure).

---

### 10. Provider Contract: `BackfillDef`

Defined in `packages/console-providers/src/define.ts:268-273`:

```ts
export interface BackfillDef {
  readonly defaultEntityTypes: readonly string[];
  readonly entityTypes: Record<string, BackfillEntityHandler>;
  readonly supportedEntityTypes: readonly string[];
}
```

Each `BackfillEntityHandler` implements:

```ts
buildRequest(ctx: BackfillContext, cursor: unknown): {
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: unknown;
};
endpointId: string;
processResponse(data: unknown, ctx: BackfillContext, cursor: unknown, responseHeaders?: Record<string, string>): {
  events: BackfillWebhookEvent[];
  nextCursor: unknown | null;
  rawCount: number;
};
```

**GitHub's `githubBackfill`** (`packages/console-providers/src/providers/github/backfill.ts`):

| Entity Type | endpointId | Cursor Shape | Termination Condition |
|---|---|---|---|
| `pull_request` | `list-pull-requests` | `{ page: number }` | `items.length < 100 \|\| filtered.length < items.length` |
| `issue` | `list-issues` | `{ page: number }` | `items.length < 100` (also filters out PR-linked issues) |
| `release` | `list-releases` | `{ page: number }` | `items.length < 100 \|\| filtered.length < items.length` |

`deliveryId` format: `backfill-{installationId}-{providerResourceId}-{entityType}-{itemId}`.

`parseRateLimit` is on `providerDef.api` (not `backfill`). The entity worker calls `providerDef.api.parseRateLimit(new Headers(raw.headers))` to extract `{ remaining, limit, resetAt }` for dynamic backoff.

---

### 11. External Service Contracts

#### Gateway Service (`packages/gateway-service-clients/src/gateway.ts`)

URLs use `gatewayUrl` = `http://localhost:4110/services` (dev) / `https://gateway.lightfast.ai/services` (prod).

All endpoints called by backfill exist in `apps/gateway/src/routes/connections.ts`:

| Gateway Client Method | HTTP Call | Purpose |
|---|---|---|
| `getConnection(id)` | `GET /services/gateway/{id}` | Fetch connection details, resources list |
| `getBackfillRuns(id, "completed")` | `GET /services/gateway/{id}/backfill-runs?status=completed` | Gap-aware history |
| `upsertBackfillRun(id, record)` | `POST /services/gateway/{id}/backfill-runs` | Persist run record (best-effort: `.catch(() => {})`) |
| `executeApi(id, request)` | `POST /services/gateway/{id}/proxy/execute` | Authenticated provider API proxy |

`executeApi` returns `ProxyExecuteResponse` (validated via `proxyExecuteResponseSchema`): `{ status, data, headers }` where `headers` is `Record<string, string>`. Timeout: 60s.

`getBackfillRuns` silently returns `[]` on any failure (`.catch()` + non-ok check returns `[]`). This ensures gap-filtering degrades safely to "fetch everything".

`upsertBackfillRun` is fire-and-forget (`.catch(() => { /* best-effort */ })`). A failure here means the run history won't be updated but the backfill itself completed successfully.

#### Relay Service (`packages/gateway-service-clients/src/relay.ts`)

URLs use `relayUrl` = `http://localhost:4108/api` (dev) / `https://relay.lightfast.ai/api` (prod).

Both endpoints called by backfill exist in `apps/relay/src/routes/`:

| Relay Client Method | HTTP Call | Existence Confirmed |
|---|---|---|
| `dispatchWebhook(provider, payload, holdForReplay?)` | `POST /api/webhooks/{provider}` | `apps/relay/src/routes/webhooks.ts:96` |
| `replayCatchup(installationId, batchSize)` | `POST /api/admin/replay/catchup` | `apps/relay/src/routes/admin.ts:195` |

**`holdForReplay` mechanism** (relay `webhooks.ts:95-100`):
- When `X-Backfill-Hold: true` header is present, relay persists the webhook with `status: "received"` but skips QStash dispatch. Returns `{ status: "accepted", held: true }`.
- The catchup endpoint queries for `status = "received"` rows matching `installationId`, dispatches them in order (chronologically by `receivedAt`), returns `{ remaining: count }`.

**Catchup edge case**: When no un-delivered webhooks exist, relay returns `{ status: "empty" }` without a `remaining` field. In the orchestrator's while loop, `remaining = result.remaining` becomes `undefined`, and `undefined > 0` evaluates to `false`, so the loop exits correctly.

**Batch size alignment**: Orchestrator passes `BATCH_SIZE = 200`; relay's `catchupSchema` caps `batchSize` at `Math.min(n, 200)` — exact alignment.

---

### 12. Inter-Service Authentication

All inter-service calls use `X-API-Key` header set to `GATEWAY_API_KEY`. Built via `buildServiceHeaders` in `packages/gateway-service-clients/src/headers.ts`. Additional headers: `X-Request-Source` (always `"backfill"`) and `X-Correlation-Id` (propagated from event data).

---

### 13. Tenant Isolation

Implemented at two points:
1. **Orchestrator** (`backfill-orchestrator.ts:67-70`): Verifies `conn.orgId === orgId` after fetching connection. Throws `NonRetriableError` on mismatch.
2. **Estimate route** (`estimate.ts:55-57`): Verifies `connection.orgId === orgId` before probing. Returns 403 on mismatch.

The trigger route does NOT verify org — it only validates format. The orchestrator performs the authoritative check.

---

### 14. Cancellation Flow

**Trigger**: `POST /api/trigger/cancel` → `inngest.send("apps-backfill/run.cancelled", { installationId })`.

**Reception**: Both orchestrator and entity worker have `cancelOn` blocks matching this event on `data.installationId`:

```ts
cancelOn: [{ event: "apps-backfill/run.cancelled", match: "data.installationId" }]
```

The comment in entity-worker.ts explicitly notes: _"Workers must declare their own cancelOn — it does NOT propagate from parent"_ (`entity-worker.ts:31-32`).

---

## Code References

- `apps/backfill/src/app.ts:1-53` — Hono app, middleware order, route mounting
- `apps/backfill/src/env.ts:1-40` — Validated env vars
- `apps/backfill/src/inngest/client.ts:1-47` — Event schemas
- `apps/backfill/src/lib/constants.ts:1-6` — `GITHUB_RATE_LIMIT_BUDGET = 4000`
- `apps/backfill/src/routes/trigger.ts:32-76` — POST /trigger
- `apps/backfill/src/routes/trigger.ts:84-135` — POST /trigger/cancel
- `apps/backfill/src/routes/estimate.ts:23-201` — POST /estimate
- `apps/backfill/src/routes/inngest.ts:1-19` — Inngest serve handler
- `apps/backfill/src/workflows/backfill-orchestrator.ts:1-277` — Orchestrator
- `apps/backfill/src/workflows/entity-worker.ts:1-202` — Entity worker
- `packages/console-providers/src/gateway.ts:101-159` — `backfillDepthSchema`, `backfillTriggerPayload`, `backfillEstimatePayload`
- `packages/console-providers/src/define.ts:208-273` — `BackfillEntityHandler`, `BackfillDef`, `BackfillContext`
- `packages/console-providers/src/providers/github/backfill.ts:75-228` — GitHub `BackfillDef`
- `packages/gateway-service-clients/src/gateway.ts:28-164` — Gateway client
- `packages/gateway-service-clients/src/relay.ts:21-66` — Relay client
- `packages/gateway-service-clients/src/backfill.ts:18-65` — Backfill client
- `packages/gateway-service-clients/src/urls.ts` — Service base URLs
- `apps/relay/src/routes/webhooks.ts:95-100` — `X-Backfill-Hold` handling
- `apps/relay/src/routes/admin.ts:174-258` — `/admin/replay/catchup` endpoint
- `apps/gateway/src/routes/connections.ts:1078-1130` — `/backfill-runs` GET + POST endpoints

---

## Architecture Documentation

### Data Flow: Trigger → Completion

```
Console tRPC (or Relay)
  → POST /api/trigger (backfill service)
    → X-API-Key auth
    → backfillTriggerPayload validation
    → inngest.send("apps-backfill/run.requested")
      → backfillOrchestrator
        → step: get-connection (gateway)
        → step: get-backfill-history (gateway)
        → inline: provider resolution + entity type resolution
        → step: compute-since
        → inline: work unit enumeration (resources × entityTypes)
        → inline: gap-aware filtering
        → step.invoke × N: backfillEntityWorker (parallel)
          → step: fetch-{type}-p{N} (gateway proxy → provider API)
          → step: dispatch-{type}-p{N} (relay webhooks, optional hold)
          → step: rate-limit-{type}-p{N} (conditional sleep)
        → step: persist-run-records (gateway backfill-runs)
        → step: replay-held-webhooks (relay admin/replay/catchup, if holdForReplay)
```

### Key Design Patterns

1. **Gateway as authenticated API proxy**: Backfill never calls provider APIs directly. All external calls go through `gw.executeApi()` which proxies through the gateway, which handles OAuth token refresh.

2. **Step memoization**: All side-effectful operations are wrapped in `step.run()` or `step.invoke()`. The `compute-since` step ensures the timestamp is deterministic across retries. Step names encode page numbers for deterministic replay.

3. **`step.invoke` vs event send**: The orchestrator invokes entity workers via `step.invoke()` (direct function call), not by emitting `entity.requested` events. This means entity workers run as child function calls with direct data passing, not through the event bus.

4. **Rate limiting — two-layer**: Inngest-level `throttle` (4000 req/hr per installationId) is a coarse gate. Dynamic backoff (step.sleep when remaining < 10% of limit per response headers) is fine-grained. Both use `installationId` as the scope key.

5. **Hold-for-replay**: When `holdForReplay: true`, entity workers pass `X-Backfill-Hold: true` to relay, which stores webhooks in `gwWebhookDeliveries` with `status = "received"` without QStash dispatch. After all workers complete, the orchestrator drains the queue via `relay.replayCatchup()` in batches of 200. This delivers historical events in chronological order as a single batch.

6. **Gap-aware filtering**: Before dispatching work units, the orchestrator checks `gwInstallationBackfillRuns` history (via gateway). If a prior run's `since` timestamp covers the same or wider range as the current request, that entity type is skipped. Boundary overlap is handled by relay's `deliveryId` deduplication (`onConflictDoNothing`).

7. **Tenant isolation**: orgId is verified at the HTTP level (estimate route) AND inside Inngest steps (orchestrator). Both use the gateway's authoritative `conn.orgId` value, not just the caller-supplied value.

---

## Test Coverage Summary

| Component | Test File | Scenarios |
|---|---|---|
| `POST /api/trigger` | `routes/trigger.test.ts` | Auth (2), validation (3), event fields (4), Inngest failure |
| `POST /api/trigger/cancel` | `routes/trigger.test.ts` | Auth (2), validation (1), gateway 404, event name, Inngest failure |
| `POST /api/estimate` | `routes/estimate.test.ts` | Auth (2), JSON/field validation (2), connection 404, org mismatch 403, invalid provider 400, success (default + custom entityTypes), hasMore pages, URL-unsafe chars, executeApi errors |
| Orchestrator | `workflows/backfill-orchestrator.test.ts` | Connection lifecycle (5), provider resolution (2), work unit enumeration (2), invoke per unit (3), aggregation (2), persist-run-records (4), gap-aware filtering (4), correlationId, holdForReplay (4) |
| Entity Worker | `workflows/entity-worker.test.ts` | Provider resolution (2), single-page dispatch (2), dispatch error, multi-page pagination, executeApi errors (2), rate limit sleep/skip (2), completion stats (2), orgId forwarding, holdForReplay (2) |
| Step replay | `workflows/step-replay.test.ts` | Entity worker replay (single-page + multi-page), orchestrator replay (success + mixed) |

---

## Open Questions

1. **`entity.requested` event schema usage**: The event schema for `apps-backfill/entity.requested` is declared in the Inngest client, but the orchestrator uses `step.invoke()` (direct function invocation) rather than `inngest.send("entity.requested")`. The event schema serves as documentation of the data shape and for any external callers, but the orchestrator doesn't emit this event. This is correct Inngest pattern but worth noting.

2. **Sentry/Linear/Vercel provider backfill definitions**: The git status shows changes to `console-providers/src/providers/sentry/transformers.ts` and `console-providers/src/providers/linear/`. The backfill app supports all providers returned by `getProvider()`, but this investigation did not examine whether Sentry/Linear/Vercel `BackfillDef` objects are fully populated with entity handlers.

3. **`upsertBackfillRun` fire-and-forget**: The gateway client swallows errors on `upsertBackfillRun`. If this call fails consistently, gap-aware filtering will never work (always fetches all entity types). This is an operational concern, not a code bug.
