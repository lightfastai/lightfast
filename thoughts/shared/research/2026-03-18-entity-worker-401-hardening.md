# Entity Worker 401/403 Hardening — Research

**Date:** 2026-03-18
**Scope:** `apps/backfill/src/workflows/entity-worker.ts` and supporting infrastructure

---

## 1. The Bug: Current Behaviour

In `entity-worker.ts` lines 117–122, when the gateway proxy returns a non-200 status:

```ts
if (raw.status !== 200) {
  throw new HttpError(
    `Provider API returned ${raw.status}`,
    raw.status
  );
}
```

`HttpError` is a plain `Error` subclass (`packages/gateway-service-clients/src/errors.ts`):

```ts
export class HttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
```

Inngest sees any thrown `Error` that is not `NonRetriableError` as retriable. So 401 and 403 each burn all 3 retries (the function is configured with `retries: 3`) before failing permanently — wasting ~20–30 minutes of retry budget and never triggering any health-check mechanism.

---

## 2. The `gw.executeApi()` Response Shape

The gateway client (`packages/gateway-service-clients/src/gateway.ts`) calls:

```
POST /connections/:id/proxy/execute
```

The gateway route (`apps/gateway/src/routes/connections.ts` line 986–990) always returns HTTP 200 from the **gateway service itself**, and embeds the upstream provider status in the JSON body:

```json
{ "status": 401, "data": null, "headers": {} }
```

This means:
- `gw.executeApi()` **never throws an `HttpError`** for provider-level status codes — it only throws `HttpError` when the gateway service itself returns a non-2xx (e.g., 404 for unknown installation, 400 for inactive connection, 502 for token error).
- The `raw.status` check in entity-worker is inspecting `response.data.status` (the upstream provider status), which is passed through faithfully.
- **The gateway does do a 401 retry internally** (lines 945–969 in connections.ts): on first 401 it tries `forceRefreshToken()` and retries the upstream call. So if the gateway proxy returns `status: 401` to the entity-worker, the token refresh has already been attempted and failed. This means a 401 reaching entity-worker is a hard revocation signal, not a transient auth blip.

---

## 3. `NonRetriableError` — Import Path and Usage

### Import path in the backfill app

In `apps/backfill/src/workflows/entity-worker.ts` line 7 (already present):
```ts
import { NonRetriableError } from "@vendor/inngest";
```

`@vendor/inngest` re-exports from `inngest` (`vendor/inngest/src/index.ts`):
```ts
export { EventSchemas, Inngest, InngestMiddleware, NonRetriableError, RetryAfterError } from "inngest";
```

`RetryAfterError` is also available for cases where we want a delayed retry with a specific wait time.

### Existing usage in the codebase

`NonRetriableError` is already used in both `entity-worker.ts` and `backfill-orchestrator.ts`:
- Unknown provider → `NonRetriableError`
- Provider doesn't support backfill → `NonRetriableError`
- Entity type unsupported → `NonRetriableError`
- Invalid depth → `NonRetriableError`
- Connection not active → `NonRetriableError`
- orgId mismatch → `NonRetriableError`

In `api/console/src/inngest/workflow/neural/` it's used in `entity-embed.ts` and `event-store.ts` for missing DB rows (also non-retriable).

The pattern is: throw `NonRetriableError` for any permanent, unrecoverable failure where retrying would be pointless.

---

## 4. The `step.sendEvent` API

`step.sendEvent` is available on the `step` object passed to the Inngest handler. It sends an Inngest event from within a running function, tied to the current step's execution. The test harnesses mock it as:

```ts
sendEvent: vi.fn().mockResolvedValue(undefined),
```

Usage pattern from `api/console/src/inngest/workflow/neural/event-store.ts`:
```ts
await step.sendEvent("emit-downstream-events", {
  name: "apps-console/entity.upserted" as const,
  data: { workspaceId, ... },
});
```

And `entity-graph.ts`:
```ts
await step.sendEvent("emit-entity-graphed", {
  name: "apps-console/entity.graphed" as const,
  data: { ... },
});
```

The first argument is a step name (for Inngest's step memoization/replay). The second is `{ name: EventName, data: EventData }`.

**Important:** `step.sendEvent` is used _before_ throwing. You can call `step.sendEvent` in a `step.run` callback, or you can call it directly in the function body between other steps. However, since we want to throw `NonRetriableError` immediately after sending the event, the sequence must be:
1. `step.sendEvent(...)` — fire the health check signal
2. `throw new NonRetriableError(...)` — prevent any further retries

The `throw` must happen _after_ `sendEvent` resolves.

---

## 5. Inngest Event Schema — What Needs Adding

The backfill Inngest client (`apps/backfill/src/inngest/client.ts`) defines the `eventsMap` for the backfill app. It currently has:
- `apps-backfill/run.requested`
- `apps-backfill/run.cancelled`
- `apps-backfill/entity.requested`

**There is no existing health-check event.** No event named `platform/health.check.requested` or similar exists anywhere in the codebase. The console inngest client (`api/console/src/inngest/client/client.ts`) also has no such event.

### The health check concern

The `HealthCheckDef` is defined in `packages/console-providers/src/provider/api.ts`:
```ts
export interface HealthCheckDef<TConfig> {
  readonly check: (
    config: TConfig,
    externalId: string,
    accessToken: string | null
  ) => Promise<ConnectionStatus>;
}
```

The shape doc in `provider/shape.ts` says: "Optional connection health probe — enables 401-poll cron for revocation detection". This suggests a cron job (not yet implemented) will call `healthCheck.check()`. The health check event would be a signal to _expedite_ that cron check for a specific installation.

The consumer of such an event would likely live in `api/console/src/inngest/` (the console Inngest app). The backfill app fires the event; the console app listens for it. **Cross-app Inngest events are possible** — the two apps share the same `INNGEST_EVENT_KEY` environment in the monorepo.

---

## 6. Orchestrator: How Worker Failures Surface

In `backfill-orchestrator.ts` lines 215–225, each entity worker invocation is wrapped in try/catch:

```ts
try {
  const result = await step.invoke(`invoke-${wu.workUnitId}`, {
    function: backfillEntityWorker,
    data: { ... },
    timeout: "4h",
  });
  return { ..., success: true, ... };
} catch (err) {
  return {
    ...,
    success: false,
    error: err instanceof Error ? err.message : "entity worker failed",
  };
}
```

So when entity-worker throws `NonRetriableError`, Inngest sees it as a permanent function failure. The `step.invoke` call in the orchestrator will receive this as a thrown error and fall into the catch block — returning `{ success: false, error: "..." }`. The orchestrator continues with other work units and records the failure in the backfill run record via `gw.upsertBackfillRun(..., { status: "failed", error: ... })`.

**Key insight:** The orchestrator is resilient to individual worker failures by design. Switching the entity-worker from retrying 3x to immediately throwing `NonRetriableError` will propagate correctly — the worker failure is captured as `success: false` rather than exhausting retries.

---

## 7. The Two Error Cases

### 401 Unauthorized — Token Revoked

- The gateway has already attempted a token refresh internally before returning 401 to the entity-worker.
- A 401 reaching entity-worker means the token is definitively revoked or expired with no refresh path.
- Action required: fire a health-check event so the platform can mark the connection as revoked and notify the user.
- Throw `NonRetriableError` to stop retrying immediately.

### 403 Forbidden — Insufficient Scope

- The token is valid but lacks permission for this specific resource/action.
- Not a revocation signal — the connection is still valid for other resources.
- No health check needed.
- Throw `NonRetriableError` with a clear "insufficient scope" message.
- The orchestrator will record this as a failed work unit.

---

## 8. Implementation Plan

### Step 1: Add health-check event to the backfill Inngest eventsMap

In `apps/backfill/src/inngest/client.ts`, add a new event to `eventsMap`:

```ts
"apps-backfill/connection.health.check.requested": z.object({
  installationId: z.string(),
  provider: z.string(),
  reason: z.enum(["401_unauthorized"]),
  correlationId: z.string().max(128).optional(),
}),
```

Event name options:
- `apps-backfill/connection.health.check.requested` — scoped to the backfill app namespace
- `platform/connection.health.check.requested` — platform-level namespace

The backfill namespace is appropriate since that's where the event originates. The console app can listen to it cross-app.

### Step 2: Modify the fetch step in entity-worker

Replace the current uniform `HttpError` throw with status-specific handling:

```ts
if (raw.status === 401) {
  // Token is revoked — gateway already attempted refresh and failed.
  // Fire health check signal so the platform can detect and surface the revocation.
  await step.sendEvent("signal-connection-health-check", {
    name: "apps-backfill/connection.health.check.requested" as const,
    data: {
      installationId,
      provider,
      reason: "401_unauthorized" as const,
      correlationId,
    },
  });
  throw new NonRetriableError(
    `Provider API returned 401 — token revoked for installation ${installationId}`
  );
}

if (raw.status === 403) {
  // Token valid but insufficient scope — not a revocation, no health check needed.
  throw new NonRetriableError(
    `Provider API returned 403 — insufficient scope for installation ${installationId}`
  );
}

if (raw.status !== 200) {
  // All other non-200 codes (404, 429, 5xx) remain retriable.
  throw new HttpError(
    `Provider API returned ${raw.status}`,
    raw.status
  );
}
```

### Step 3: Update tests

**`entity-worker.test.ts`** — Update "executeApi returns non-200 status" test and add new cases:
- `status: 401` → throws `NonRetriableError`, calls `step.sendEvent` with health check event
- `status: 403` → throws `NonRetriableError`, does NOT call `step.sendEvent`
- `status: 500` → still throws `HttpError` (retriable)

**`fault-injection.test.ts`** — Update existing 403 test (line 213–227) which currently expects a plain `HttpError`. Add a 401 test.

The `makeStep()` helper in both test files already mocks `sendEvent: vi.fn().mockResolvedValue(undefined)`, so no test infrastructure changes are needed.

---

## 9. Key Constraints and Gotchas

### `step.sendEvent` inside `step.run`

The `sendEvent` call needs to happen _outside_ the `step.run` boundary if we want it to execute on every attempt. Since the non-200 status check is _inside_ the `step.run("fetch-...")` callback, placing `sendEvent` there means it runs within the memoized step. After `NonRetriableError` is thrown from the `step.run` callback, Inngest will not retry that step — but it also won't execute any subsequent steps.

Alternative: Throw a sentinel value or a typed error from the `step.run` callback, then check it outside and call `step.sendEvent` in the outer scope. This is cleaner but more complex.

Simpler approach: Call `step.sendEvent` as a named step _before_ throwing. But since the 401 detection happens inside `step.run`, we need to either:
- (a) Return a structured result from the `step.run` that indicates 401, then handle it outside, or
- (b) Call `step.sendEvent` inside the `step.run` callback (which works — `step.sendEvent` can be called inside step callbacks).

Option (b) is simpler. Inngest step callbacks can call other step tools. The `sendEvent` inside a `step.run` callback will be correctly memoized as part of that step's execution.

**Verified:** The test harness mocks `step.sendEvent` at the same level as `step.run` and `step.sleep`, and `step.run` is mocked as `vi.fn((_name, fn) => fn())` — so `step.sendEvent` is accessible inside the callback via closure.

### `NonRetriableError` must NOT be caught

In Inngest, `NonRetriableError` thrown anywhere in a function body or step callback causes the function to fail immediately. It cannot be caught or swallowed by Inngest's retry machinery. This is the correct behavior.

### Gateway 401 vs Provider 401

The gateway client (`createGatewayClient`) throws `HttpError` (with the gateway's own 401/403 status) if the gateway service itself returns non-2xx. This happens for internal auth failures (`X-API-Key` missing). This is a different path from `gw.executeApi()`, which returns `ProxyExecuteResponse` with `status: 401` in the body. The entity-worker's current check on `raw.status` is the proxy response body status — it is not an `HttpError` thrown by the client.

So the two error paths are:
1. **Gateway itself 401/403** — `gw.executeApi()` throws `HttpError` before returning (line 150–153 in gateway.ts client). This is an internal auth issue, not a provider 401.
2. **Provider 401/403** — `gw.executeApi()` returns `ProxyExecuteResponse` with `status: 401` in the body. This is what entity-worker's `raw.status` check sees.

The hardening only touches case 2.

---

## 10. File Inventory

| File | Role |
|------|------|
| `apps/backfill/src/workflows/entity-worker.ts` | Main change target — lines 107–149 (fetch step) |
| `apps/backfill/src/inngest/client.ts` | Add `apps-backfill/connection.health.check.requested` to eventsMap |
| `packages/gateway-service-clients/src/errors.ts` | `HttpError` definition — no changes needed |
| `packages/gateway-service-clients/src/gateway.ts` | `executeApi` implementation — no changes needed |
| `apps/gateway/src/routes/connections.ts` | Gateway proxy route — confirms 401 in body = provider 401 after token retry exhausted |
| `vendor/inngest/src/index.ts` | Re-exports `NonRetriableError` and `RetryAfterError` |
| `apps/backfill/src/workflows/entity-worker.test.ts` | Tests to update |
| `apps/backfill/src/workflows/fault-injection.test.ts` | Tests to update (existing 403 test at line 213) |
| `api/console/src/inngest/client/client.ts` | Console Inngest client — potential listener for health check event (future work) |
