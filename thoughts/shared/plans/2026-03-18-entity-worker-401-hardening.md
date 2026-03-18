---
date: 2026-03-18
topic: "Entity Worker 401/403 Hardening — NonRetriableError + health-check signal"
tags: [plan, backfill, inngest, entity-worker, hardening, auth]
status: draft
dependencies:
  - Phase 0 DB schema migration (gatewayInstallations health columns)
  - "@repo/inngest shared package (cross-app event bus)"
---

# Entity Worker 401/403 Hardening — Implementation Plan

## Overview

The backfill entity worker currently treats all non-200 provider API responses (including 401 and 403) as retriable `HttpError`s. Because Inngest retries any non-`NonRetriableError` throw, a single 401 burns all 3 retry slots (~20–30 minutes of budget) before the function permanently fails — with no signal sent to the platform about the revocation. This plan hardens the worker to:

1. Wrap 401 and 403 in `NonRetriableError` so Inngest stops immediately.
2. On 401, fire a `apps-backfill/connection.health.check.requested` event via `step.sendEvent` so the health-check cron can be expedited for that installation.
3. Leave all other non-200 status codes (429, 5xx) as retriable `HttpError`s — no behaviour change.

---

## Current State Analysis

### The bug (entity-worker.ts lines 117–122)

```ts
if (raw.status !== 200) {
  throw new HttpError(
    `Provider API returned ${raw.status}`,
    raw.status
  );
}
```

`HttpError` extends `Error`, not `NonRetriableError`. Inngest retries any plain `Error` throw. Result: 401 and 403 each burn 3 retries before permanent failure.

### Why a 401 from `gw.executeApi()` is always terminal

The gateway proxy route (`apps/gateway/src/routes/connections.ts` lines 945–969) already attempts `forceRefreshToken()` on the first upstream 401 before proxying the response. If 401 still reaches entity-worker, the refresh has already failed. The token is definitively revoked — retrying is pointless.

### Response shape

`gw.executeApi()` returns HTTP 200 from the gateway service itself; the upstream provider status is embedded in the JSON body:

```json
{ "status": 401, "data": null, "headers": {} }
```

`raw.status` in entity-worker refers to this body field, not a gateway-level HTTP status.

### `NonRetriableError` import

Already available in entity-worker.ts line 7:
```ts
import { NonRetriableError } from "@vendor/inngest";
```

No new import needed.

### Orchestrator resilience

`backfill-orchestrator.ts` wraps each `step.invoke` in try/catch and records `{ success: false, error: err.message }`. A `NonRetriableError` from the entity worker propagates to the orchestrator's catch block — correctly recorded as a failed work unit. No orchestrator changes needed.

### `step.sendEvent` inside `step.run`

The non-200 check lives inside a `step.run("fetch-...")` callback. Calling `step.sendEvent` inside a `step.run` callback is valid — the test harness confirms this: `step.run` is mocked as `vi.fn((_name, fn) => fn())` and `step.sendEvent` is accessible via closure. The send and throw must be sequenced: `await step.sendEvent(...)` first, then `throw new NonRetriableError(...)`.

---

## Desired End State

After this plan is implemented:

- A 401 from `gw.executeApi()` throws `NonRetriableError` immediately (no retries), AND fires `apps-backfill/connection.health.check.requested` with `{ installationId, provider, reason: "401_unauthorized" }`.
- A 403 from `gw.executeApi()` throws `NonRetriableError` immediately (no retries), with NO health-check event (scope error, not revocation).
- All other non-200 codes (429, 5xx) still throw `HttpError` (retriable) — no behaviour change.
- The backfill Inngest event schema includes the new event with a Zod schema.
- Tests cover all three cases: 401 (NonRetriableError + sendEvent), 403 (NonRetriableError, no sendEvent), 500 (HttpError, retriable).

### Verification

```bash
pnpm --filter @apps/backfill test
pnpm --filter @apps/backfill typecheck
pnpm check
```

---

## What We're NOT Doing

- **No consumer for the health-check event** — the `apps-backfill/connection.health.check.requested` event will be defined and fired, but no Inngest function will listen to it yet. Consuming it (expediting the health-check cron) is the responsibility of the `@repo/inngest` shared package work and the platform architecture redesign.
- **No changes to the gateway proxy** — the 401-retry-on-refresh logic in `apps/gateway/src/routes/connections.ts` is correct and stays as-is.
- **No changes to the orchestrator** — `backfill-orchestrator.ts` already handles worker failures gracefully.
- **No changes to 429 handling** — 429 (rate limit) remains a retriable `HttpError`. Inngest's `RetryAfterError` could be used here in future, but that is out of scope.
- **No `@repo/inngest` shared package dependency yet** — the event is fired from the backfill app's own Inngest client. Cross-app consumption via `@repo/inngest` is a future dependency once that package is built.
- **No DB writes** — no `gatewayInstallations` health column updates from the entity worker. That is the responsibility of the health-check cron in the platform redesign.

---

## Implementation Approach

Single phase. Two file changes + two test file updates. No migrations, no new packages.

---

## Phase 1: Harden entity-worker + add event schema

### Overview

Add `apps-backfill/connection.health.check.requested` to the backfill Inngest event schema, then replace the uniform `HttpError` throw in entity-worker's fetch step with status-specific handling.

---

### Change 1: Add health-check event to Inngest schema

**File**: `apps/backfill/src/inngest/client.ts`

Add a new entry to `eventsMap` between `apps-backfill/run.cancelled` and `apps-backfill/entity.requested`:

```ts
"apps-backfill/connection.health.check.requested": z.object({
  /** Installation ID of the connection whose token was revoked */
  installationId: z.string(),
  /** Provider name (e.g. "github", "linear") */
  provider: z.string(),
  /** Why the health check is being requested */
  reason: z.enum(["401_unauthorized"]),
  /** Cross-service correlation ID for distributed tracing */
  correlationId: z.string().max(128).optional(),
}),
```

This gives the backfill Inngest client a typed schema for the event. Downstream consumers (future: platform health-check cron listener) will subscribe to this event from the shared bus.

---

### Change 2: Replace uniform HttpError throw with status-specific handling

**File**: `apps/backfill/src/workflows/entity-worker.ts`

Replace lines 117–122 (the current `if (raw.status !== 200)` block) with:

```ts
if (raw.status === 401) {
  // Token is definitively revoked — gateway already attempted forceRefreshToken()
  // and failed before returning 401 to us. Fire health-check signal so the
  // platform can detect and surface the revocation, then stop immediately.
  await step.sendEvent("signal-connection-health-check", {
    name: "apps-backfill/connection.health.check.requested",
    data: {
      installationId,
      provider,
      reason: "401_unauthorized" as const,
      correlationId,
    },
  });
  throw new NonRetriableError(
    `Provider API returned 401 — token revoked for installation ${installationId}. Health check signal sent.`
  );
}

if (raw.status === 403) {
  // Token valid but insufficient scope — not a revocation signal.
  // No health check needed; the connection is still valid for other resources.
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

**Placement note**: This block replaces the existing single `if (raw.status !== 200)` check at line 117. The `step.sendEvent` step ID `"signal-connection-health-check"` is deterministic and will be correctly memoized by Inngest on replay.

---

### Change 3: Update entity-worker.test.ts

**File**: `apps/backfill/src/workflows/entity-worker.test.ts`

The existing test at line 261 (`"throws when executeApi returns non-200 status"`) uses `status: 403`. Update it and add two new cases:

```ts
describe("executeApi auth error handling", () => {
  it("401 → throws NonRetriableError and fires health-check event", async () => {
    mockGatewayClient.executeApi.mockResolvedValueOnce({
      status: 401,
      data: null,
      headers: {},
    });
    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "Provider API returned 401"
    );
    expect(step.sendEvent).toHaveBeenCalledOnce();
    expect(step.sendEvent).toHaveBeenCalledWith(
      "signal-connection-health-check",
      expect.objectContaining({
        name: "apps-backfill/connection.health.check.requested",
        data: expect.objectContaining({
          installationId: "inst-1",
          provider: "github",
          reason: "401_unauthorized",
        }),
      })
    );
  });

  it("403 → throws NonRetriableError and does NOT fire health-check event", async () => {
    mockGatewayClient.executeApi.mockResolvedValueOnce({
      status: 403,
      data: null,
      headers: {},
    });
    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "Provider API returned 403"
    );
    expect(step.sendEvent).not.toHaveBeenCalled();
  });

  it("500 → throws HttpError (retriable, not NonRetriableError)", async () => {
    mockGatewayClient.executeApi.mockResolvedValueOnce({
      status: 500,
      data: null,
      headers: {},
    });
    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "Provider API returned 500"
    );
    expect(step.sendEvent).not.toHaveBeenCalled();
  });
});
```

Also update the old `"throws when executeApi returns non-200 status"` test (currently at line 261, uses `status: 403`) to use `status: 500` instead, since 403 now has distinct behaviour:

```ts
// OLD — change status from 403 to 500
it("throws when executeApi returns non-200 status", async () => {
  mockGatewayClient.executeApi.mockResolvedValueOnce({
    status: 500,  // was 403
    data: null,
    headers: {},
  });
  const step = makeStep();

  await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
    "Provider API returned 500"  // was 403
  );
});
```

---

### Change 4: Update fault-injection.test.ts

**File**: `apps/backfill/src/workflows/fault-injection.test.ts`

The existing test at line 213 (`"executeApi returns 403 Forbidden"`) currently expects a plain throw. Update it to assert `NonRetriableError` semantics and no `sendEvent`. Add a new 401 test:

```ts
it("executeApi returns 401 Unauthorized → NonRetriableError + health-check event", async () => {
  mockGatewayClient.executeApi.mockResolvedValue({
    status: 401,
    data: null,
    headers: {},
  });
  const step = makeStep();

  await expect(
    handlers["apps-backfill/entity.worker"]!({
      event: makeEntityEvent(),
      step,
    })
  ).rejects.toThrow("Provider API returned 401");

  expect(step.sendEvent).toHaveBeenCalledOnce();
  expect(step.sendEvent).toHaveBeenCalledWith(
    "signal-connection-health-check",
    expect.objectContaining({
      name: "apps-backfill/connection.health.check.requested",
      data: expect.objectContaining({
        installationId: "inst-1",
        provider: "github",
        reason: "401_unauthorized",
      }),
    })
  );
});

it("executeApi returns 403 Forbidden → NonRetriableError, no health-check event", async () => {
  mockGatewayClient.executeApi.mockResolvedValue({
    status: 403,
    data: null,
    headers: {},
  });
  const step = makeStep();

  await expect(
    handlers["apps-backfill/entity.worker"]!({
      event: makeEntityEvent(),
      step,
    })
  ).rejects.toThrow("Provider API returned 403");

  expect(step.sendEvent).not.toHaveBeenCalled();
});
```

The existing 403 test currently just checks `.toThrow("Provider API returned 403")` — update it to also assert `expect(step.sendEvent).not.toHaveBeenCalled()` to make the no-event assertion explicit.

---

### Success Criteria

#### Automated Verification:
- [ ] All tests pass: `pnpm --filter @apps/backfill test`
- [ ] Type checking passes: `pnpm --filter @apps/backfill typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] The new event `apps-backfill/connection.health.check.requested` appears in the Inngest schema (TypeScript autocomplete confirms the type)

#### Manual Verification:
- [ ] In a local dev session, trigger a backfill against an installation with a revoked token — confirm the Inngest dashboard shows the entity worker function failed immediately (no retries) with a `NonRetriableError`
- [ ] Confirm the `apps-backfill/connection.health.check.requested` event appears in the Inngest event stream for the 401 case
- [ ] Confirm no such event appears for a 403 case

---

## Testing Strategy

### Unit Tests (entity-worker.test.ts)

| Scenario | Expected error type | sendEvent called? |
|----------|--------------------|--------------------|
| `status: 401` | `NonRetriableError` ("401") | Yes — with `reason: "401_unauthorized"` |
| `status: 403` | `NonRetriableError` ("403") | No |
| `status: 500` | `HttpError` ("500") | No |
| `status: 200` | No throw | No |

### Fault Injection Tests (fault-injection.test.ts)

Same matrix, exercised via `handlers["apps-backfill/entity.worker"]` directly.

### What we're NOT testing here

- The downstream consumer of `apps-backfill/connection.health.check.requested` — that function does not exist yet.
- The orchestrator's behaviour when entity-worker throws `NonRetriableError` — the orchestrator's catch block handles it correctly already (documented in research §6), and existing orchestrator tests cover it.

---

## Key Constraints and Gotchas

### `step.sendEvent` inside `step.run` — why it works

The `sendEvent` call lives inside the `step.run("fetch-...")` callback. Inngest step callbacks can call other step tools. The test harness mocks `step.run` as `vi.fn((_name, fn) => fn())`, so `step.sendEvent` is accessible inside the callback via closure. This approach (option b from research §9) is simpler than returning a sentinel value from the callback.

### Sequencing: send then throw

`await step.sendEvent(...)` MUST resolve before `throw new NonRetriableError(...)`. If the throw came first, `sendEvent` would never execute.

### Step ID must be deterministic

`"signal-connection-health-check"` is a fixed string (not parameterised by page number or entity type). This is correct — Inngest uses step IDs for memoization on replay, and this event should only ever be fired once per worker invocation (on the first 401 encountered).

### Gateway 401 vs provider 401

Do not confuse these two paths:
- **Gateway service 401**: `gw.executeApi()` throws `HttpError` if the gateway's own HTTP response is 4xx (internal auth failure — wrong `X-API-Key`). This is a different code path and is NOT affected by this change.
- **Provider 401 (this change)**: `gw.executeApi()` returns `ProxyExecuteResponse` with `status: 401` in the body. `raw.status` in entity-worker inspects this body field.

---

## Dependencies

| Dependency | Status | Needed for |
|------------|--------|------------|
| Phase 0 DB schema migration (`gatewayInstallations` health columns) | Not started | Future: health-check cron reads/writes these columns when consuming the event |
| `@repo/inngest` shared package | Not started | Future: the console/platform Inngest app subscribes to `apps-backfill/connection.health.check.requested` cross-app |

Both dependencies are for **future consumers** of the event this plan fires. This plan is self-contained and does not block on either dependency.

---

## References

- Research: `thoughts/shared/research/2026-03-18-entity-worker-401-hardening.md`
- Platform architecture redesign (health-check-driven lifecycle): `thoughts/shared/plans/2026-03-18-platform-architecture-redesign.md`
- Entity worker source: `apps/backfill/src/workflows/entity-worker.ts` (lines 107–149 — fetch step)
- Inngest client schema: `apps/backfill/src/inngest/client.ts`
- HttpError definition: `packages/gateway-service-clients/src/errors.ts`
- Gateway proxy route (confirms 401 in body = provider 401 after refresh exhausted): `apps/gateway/src/routes/connections.ts` (lines 945–990)
- Orchestrator invocation pattern: `apps/backfill/src/workflows/backfill-orchestrator.ts` (lines 215–225)
- Test infrastructure: `apps/backfill/src/workflows/entity-worker.test.ts`, `apps/backfill/src/workflows/fault-injection.test.ts`
