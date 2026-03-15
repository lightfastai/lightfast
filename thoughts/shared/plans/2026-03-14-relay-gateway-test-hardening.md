# Relay & Gateway Test Hardening Plan

## Overview

Strengthen the test suites for `apps/relay` and `apps/gateway` using the same invariant matrix + fault injection + permutation testing escalation pattern we applied to `apps/backfill`. Both services have solid happy-path and basic error coverage but are missing the systematic adversarial testing that makes the backfill suite production-grade.

## Current State Analysis

### apps/relay — What's covered

| File | Coverage |
|---|---|
| `routes/webhooks.test.ts` | HMAC path, service-auth path, hold mechanism, per-provider HMAC secrets, fault injection (Redis/QStash/workflow failures), payload contracts |
| `routes/workflows.test.ts` | All workflow paths (dedup, Redis cache hit/miss, DB fallthrough, DLQ, enqueue), fault injection at each step, step-level retry semantics with `makeRetryContext` |
| `routes/admin.test.ts` | **Only** `POST /replay/catchup` (auth, empty, filtering, batchSize clamping, remaining count) |

**Untested admin endpoints**: `GET /health`, `POST /cache/rebuild`, `GET /dlq`, `POST /dlq/replay`, `POST /delivery-status`

**No tests at all for**: `lib/replay.ts` (`replayDeliveries`), invariant matrix across provider × hold × dedup × resolution path, workflow fault injection file, concurrent dedup race conditions

### apps/gateway — What's covered

| File | Coverage |
|---|---|
| `routes/connections.test.ts` | Authorize (redirect_to validation, state storage), oauth/status, callback (all status types, redirectTo modes, error paths), GET/:id, GET/:id/token (happy path, not-found, expired error), DELETE, POST/DELETE resources, GET/POST backfill-runs |
| `routes/connections.integration.test.ts` | PGlite-backed: GET/:id, token, delete, resources CRUD with real DB |
| `workflows/connection-teardown.test.ts` | All 4 steps, GitHub skip, best-effort swallowing, batch soft-delete |
| `integration.test.ts` | Basic DB CRUD, resetTestDb isolation |

**Completely untested**: `GET /:id/proxy/endpoints`, `POST /:id/proxy/execute` (token injection, 401 retry, pathParams substitution, queryParams encoding, raw response pass-through, AbortSignal timeout)

**Partially untested**: Token expiry + refresh path in `getActiveTokenForInstallation`, `forceRefreshToken` fallback paths, GitHub callback `installation_id` fallback (no OAuth state), invariant matrix, proxy fault injection

### packages/integration-tests — Event ordering

Already implemented in `event-ordering.integration.test.ts`:
- Suite 6.1: 3-effect teardown permutations (cancel-backfill, clear-cache, soft-delete)
- Suite 6.2: 3 concurrent relay dispatches in all 6 orderings
- Suite 6.3: Backfill notify + relay dispatch in all 2 orderings

## Desired End State

After this plan:

1. **Relay admin endpoints** fully tested (5 missing endpoints)
2. **`lib/replay.ts`** has dedicated unit tests
3. **Relay invariant matrix** (`scenario-matrix.test.ts`) covers 144 scenarios across 4 dimensions with universal invariants
4. **Relay fault injection** (`fault-injection.test.ts`) tests every step boundary in the durable workflow
5. **Gateway proxy endpoints** fully tested — both `/endpoints` and `/execute` including 401 retry, token injection, pathParams, raw response
6. **Gateway token refresh** path tested — expiry detection, `forceRefreshToken` fallback chain
7. **Gateway invariant matrix** (`scenario-matrix.test.ts`) covers 72 scenarios across proxy execution with 4 dimensions
8. **Event ordering Suite 6.4** adds all 4 teardown steps (24 orderings = 4!) to integration tests

### Verification

```bash
# Per-service tests
pnpm --filter @apps/relay test
pnpm --filter @apps/gateway test

# Integration tests
pnpm --filter @repo/integration-tests test

# Type checking
pnpm typecheck

# Lint
pnpm check
```

## What We're NOT Doing

- Not adding tests for the HMAC crypto functions (covered by `@repo/console-providers` provider tests)
- Not testing Upstash Workflow's durable execution internals (the `serve()` adapter is mocked — we test the handler logic, not QStash's retry scheduling)
- Not adding end-to-end browser/network tests (that's the integration-tests domain)
- Not rewriting existing tests — we layer new files on top of them
- Not testing environment variable validation at startup (covered by `setup.ts` in integration-tests)

---

## Phase 1: Relay — Complete admin endpoint coverage

**File**: `apps/relay/src/routes/admin.test.ts`

Add test suites for the 5 currently untested endpoints. The mock pattern is already established (see existing `replay/catchup` suite in the same file).

### New test suites to add:

#### `GET /admin/health`
- Returns `200 { status: "ok" }` when both Redis ping and DB execute succeed
- Returns `503 { status: "degraded" }` when Redis ping throws
- Returns `503 { status: "degraded" }` when DB execute throws
- Returns `503 { status: "degraded" }` when both fail
- Response always includes `redis`, `database`, and `uptime_ms` fields

#### `POST /admin/cache/rebuild`
- Returns 401 without X-API-Key
- Processes all active resources in batches of 500 (verify `pipeline.hset` called once per resource with correct key format `gw:resource:<provider>:<resourceId>`)
- Returns `{ status: "rebuilt", count: N }` with correct N
- Handles empty resource set (returns `count: 0`)
- Stops batching when a batch returns fewer than 500 rows (end-of-data signal)
- Verify TTL is set via `pipeline.expire` for each resource key

#### `GET /admin/dlq`
- Returns 401 without X-API-Key
- Returns DLQ items with default limit=50, offset=0
- Respects `?limit=` and `?offset=` query params
- Clamps limit to max 100 (request limit=999 → cap at 100)
- Clamps limit to min 1 (request limit=0 → cap at 1)
- Handles NaN limit/offset gracefully (falls back to defaults)
- Returns `{ items: [...], limit, offset }` shape

#### `POST /admin/dlq/replay`
- Returns 401 without X-API-Key
- Returns 400 with `{ error: "invalid_json" }` on malformed body
- Returns 400 with `{ error: "missing_delivery_ids" }` when `deliveryIds` is empty
- Returns 404 when no matching DLQ entries found (status !== "dlq")
- Only replays entries with status="dlq" — does NOT replay status="received" entries
- Calls `replayDeliveries` with the correctly filtered entries
- Returns `{ status: "replayed", ...result }` on success
- Handles compound (provider, deliveryId) filter correctly — GitHub "del-1" vs Linear "del-1" are distinct

#### `POST /admin/delivery-status`
- Requires `qstashAuth` — returns 401 without valid QStash signature (mock `Receiver.verify()` to return false)
- Returns 400 when `messageId` is missing from body
- Returns 400 when `state` is missing from body
- Returns 400 on malformed JSON
- Updates delivery to `"delivered"` when `state === "delivered"` and `deliveryId` is present
- Updates delivery to `"dlq"` when `state === "error"` and `deliveryId` is present
- Does NOT update when state is unrecognized (e.g. `"pending"`) — no DB write
- Applies `provider` query param as additional WHERE condition when present
- Returns `{ status: "received" }` always (regardless of DB update outcome)

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @apps/relay test` passes with all new suites
- [x] `pnpm check` passes (no lint errors)
- [x] `pnpm typecheck` passes

---

## Phase 2: Relay — `lib/replay.ts` unit tests

**New file**: `apps/relay/src/lib/replay.test.ts`

`replayDeliveries` is called by both DLQ replay and catchup replay but has no unit tests. The mock pattern mirrors `workflows.test.ts`.

### Test cases:

```typescript
// Setup: mock workflowClient.trigger, redis.del, db.update, getProvider

describe("replayDeliveries", () => {
  // Skips deliveries with no payload
  it("skips entries where payload is null", ...)

  // Success path
  it("clears dedup key, triggers workflow, resets status to 'received'", ...)
  it("re-extracts resourceId from stored payload via provider", ...)
  it("uses null resourceId when provider extraction fails (provider not found)", ...)
  it("uses null resourceId when extractResourceId throws", ...)

  // Failure paths
  it("marks delivery as failed when workflowClient.trigger throws", ...)
  it("continues to next delivery when one trigger fails (partial batch)", ...)
  it("still marks as replayed when DB status update fails after trigger succeeds", ...)

  // Mixed batch
  it("returns correct replayed/skipped/failed arrays for mixed batch", ...)

  // Redis dedup key format
  it("clears key in format gw:webhook:seen:<provider>:<deliveryId>", ...)

  // Workflow trigger payload shape
  it("trigger body contains all WebhookReceiptPayload fields", ...)
  it("receivedAt is epoch ms (not ISO string) in trigger payload", ...)
})
```

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @apps/relay test` passes with all new suites
- [x] All 10+ test cases pass

---

## Phase 3: Relay — Invariant matrix (`scenario-matrix.test.ts`)

**New file**: `apps/relay/src/routes/relay-scenario-matrix.test.ts`

Mirror of `apps/backfill/src/workflows/scenario-matrix.test.ts`. Uses the `cartesian()` helper to generate all dimension combinations and runs each through the service-auth webhook path.

### Dimensions (72 scenarios = 4 × 3 × 2 × 3)

```typescript
interface RelayWebhookScenario {
  provider: "github" | "linear" | "vercel" | "sentry";
  resolutionPath: "cache-hit" | "db-fallthrough" | "no-connection";
  holdForReplay: boolean;
  deduplication: "new-delivery" | "duplicate" | "redis-unavailable";
}

const dimensions = {
  provider: ["github", "linear", "vercel", "sentry"] as const,
  resolutionPath: ["cache-hit", "db-fallthrough", "no-connection"] as const,
  holdForReplay: [false, true] as const,
  deduplication: ["new-delivery", "duplicate", "redis-unavailable"] as const,
};
// 4 × 3 × 2 × 3 = 72 scenarios
```

### Universal invariants (asserted after every scenario):

```typescript
// 1. HTTP status is always 200 (valid service-auth requests never return 5xx unless Redis is down)
// 2. Duplicate deliveries never reach QStash (publishJSON not called when dedup fires)
// 3. Hold flag prevents QStash publish (publishJSON not called when X-Backfill-Hold: true)
// 4. Redis-unavailable deduplication → 500 (never silently drops)
// 5. No-connection path → publishToTopic (DLQ) unless hold flag set
// 6. QStash publishJSON deduplicationId format: "<provider>:<deliveryId>"
// 7. QStash callback URL contains provider query param
// 8. Persistence: DB insert called for all non-duplicate new deliveries
// 9. Status field set correctly: "received" → "enqueued" (success), "received" → "dlq" (no-connection)
```

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @apps/relay test` passes with all 72 scenarios
- [x] Zero failures in invariant assertions

---

## Phase 4: Relay — Systematic fault injection (`fault-injection.test.ts`)

**New file**: `apps/relay/src/workflows/relay-fault-injection.test.ts`

Mirror of `apps/backfill/src/workflows/fault-injection.test.ts`. Tests every step boundary in the durable webhook delivery workflow.

### Fault injection points:

```typescript
describe("Step 1 (dedup) faults", () => {
  it("Redis SET NX throws → workflow throws, step retried by Upstash")
  it("Redis SET NX returns 'OK' (new) → proceeds to persist")
  it("Redis SET NX returns null (duplicate) → workflow exits gracefully, zero side effects")
})

describe("Step 2 (persist-delivery) faults", () => {
  it("DB insert throws → workflow throws, step retried")
  it("DB insert conflict (onConflictDoNothing) → continues without error")
  it("receivedAt conversion: epoch seconds vs epoch ms are both handled correctly")
})

describe("Step 3 (resolve-connection) faults", () => {
  it("Redis hgetall throws → workflow throws")
  it("Redis hgetall returns partial hash (connectionId but no orgId) → falls through to DB")
  it("DB query throws → workflow throws")
  it("DB returns empty → routes to DLQ path")
  it("Redis pipeline.exec throws after DB success → blocks publish (step fails, retried)")
  it("resourceId is null → skips Redis/DB lookup, routes directly to DLQ")
})

describe("Step 3a (update-connection) faults", () => {
  it("DB update throws when connectionInfo found → workflow throws")
  it("Step skipped entirely when connectionInfo is null")
})

describe("Step 3b/4 (DLQ vs publish) branch", () => {
  it("publishToTopic throws → workflow throws, retried")
  it("update-status-dlq throws → workflow throws, DLQ status not updated")
  it("publishJSON throws → workflow throws, retried")
  it("update-status-enqueued throws → workflow throws, status stuck at received")
})

describe("Step-level retry correctness", () => {
  it("persist-delivery retry: cached dedup result used, DB insert NOT re-executed")
  it("resolve-connection retry: cached dedup+persist results, only resolve re-runs")
  it("publish retry: cached dedup+resolve, only publish re-runs")
  it("update-status-enqueued retry: all prior steps cached, only status update re-runs")
})
```

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @apps/relay test` passes with all fault injection suites
- [x] Each fault injects at exactly the targeted step boundary (verified via mock call counts)

---

## Phase 5: Gateway — Proxy endpoint tests

**File**: `apps/gateway/src/routes/connections.integration.test.ts`

The proxy endpoints (`GET /:id/proxy/endpoints` and `POST /:id/proxy/execute`) are completely untested. Add integration-style tests using PGlite for real DB state.

### New suites to add:

#### `GET /connections/:id/proxy/endpoints`
```typescript
describe("GET /connections/:id/proxy/endpoints (integration)", () => {
  it("returns 401 without API key")
  it("returns 404 when installation does not exist")
  it("returns endpoint catalog with method, path, description for each endpoint")
  it("strips responseSchema from each endpoint (Zod types not serializable)")
  it("returns provider and baseUrl alongside endpoints")
  it("returns unknown_provider when provider not in registry")
})
```

#### `POST /connections/:id/proxy/execute`

This is the most complex route. Tests need a mock for `globalThis.fetch` to capture outbound API calls.

```typescript
describe("POST /connections/:id/proxy/execute (integration)", () => {
  // Auth
  it("returns 401 without API key")
  it("returns 404 when installation does not exist")
  it("returns 400 when installation is not active (status=revoked)")

  // Request validation
  it("returns 400 when endpointId is missing")
  it("returns 400 on malformed JSON body")
  it("returns 400 when endpointId is not in provider catalog")
  it("returns available endpoint IDs in 400 error response")

  // Token injection
  it("injects Authorization: Bearer <token> header into outbound request")
  it("uses buildAuthHeader when provider defines it (e.g. Token prefix instead of Bearer)")
  it("returns 502 when getActiveTokenForInstallation throws")

  // Path substitution
  it("substitutes {owner} and {repo} pathParams in endpoint path")
  it("URL-encodes pathParam values")
  it("leaves unmatched {param} placeholders unchanged")

  // Query params
  it("appends queryParams as URL search string")
  it("handles empty queryParams (no ? appended)")

  // Request body
  it("sends body as JSON when body field is present")
  it("sets Content-Type: application/json when body provided")
  it("sends no body when body field is absent")

  // Raw response pass-through
  it("returns { status, data, headers } for 200 response")
  it("returns { status: 404, data: ..., headers: ... } for 404 response (no error wrapping)")
  it("returns { data: null } when provider returns non-JSON response")
  it("passes all response headers through to caller")

  // 401 retry with token refresh
  it("on 401: attempts forceRefreshToken and retries with fresh token")
  it("on 401: does NOT retry if freshToken equals original token")
  it("on 401: does NOT retry if forceRefreshToken returns null")
  it("on 401 after retry: returns 401 response raw (no further retries)")

  // Timeout
  it("AbortSignal.timeout set to endpoint.timeout when defined")
  it("AbortSignal.timeout defaults to 30_000 when endpoint has no timeout")
})
```

**Mock pattern for outbound fetch**:
```typescript
// In beforeEach: stub globalThis.fetch to return controlled responses
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)
// In afterEach: vi.unstubAllGlobals()
```

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @apps/gateway test` passes with all new proxy suites
- [x] `pnpm typecheck` passes

---

## Phase 6: Gateway — Token refresh & expiry paths

**File**: `apps/gateway/src/routes/connections.integration.test.ts`

Add tests for the token expiry detection + refresh path in `getActiveTokenForInstallation`, and the GitHub callback `installation_id` fallback.

### New suites:

#### Token expiry and refresh (within `GET /connections/:id/token`)
```typescript
describe("GET /connections/:id/token — token refresh paths (integration)", () => {
  // Precondition: install + token row with expiresAt in the past

  it("calls oauth.refreshToken when token.expiresAt is in the past and refreshToken exists")
  it("calls updateTokenRecord with refreshed token data")
  it("returns 401 with error=token_expired:no_refresh_token when no refreshToken in row")
  it("returns 502 when refreshToken exists but oauth.refreshToken throws")
})
```

#### GitHub callback without OAuth state (`installation_id` fallback)
```typescript
describe("GET /connections/github/callback — installation_id fallback (integration)", () => {
  it("returns 400 for non-github providers when state is missing")
  it("recovers stateData from DB when state is missing but installation_id matches existing github install")
  it("returns 400 when installation_id is present but not found in DB")
})
```

#### OAuth state replay protection
```typescript
describe("OAuth state replay protection", () => {
  it("second concurrent callback with same state token returns invalid_or_expired_state")
  // Verify redis.multi().hgetall().del().exec() atomicity: state consumed on first read
})
```

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @apps/gateway test` passes with all new suites

---

## Phase 7: Gateway — Invariant matrix (`scenario-matrix.test.ts`)

**New file**: `apps/gateway/src/routes/gateway-scenario-matrix.test.ts`

Systematic testing of `POST /:id/proxy/execute` across a cartesian product of dimensions.

### Dimensions (72 scenarios = 3 × 4 × 3 × 2)

```typescript
interface ProxyScenario {
  provider: "github" | "linear" | "vercel";      // 3
  tokenState: "fresh" | "expired-with-refresh" | "expired-no-refresh" | "missing"; // 4
  upstreamResponse: "200-json" | "401-retryable" | "500-passthrough";  // 3
  hasPathParams: boolean;                          // 2
}
// 3 × 4 × 3 × 2 = 72 scenarios
```

### Universal invariants:

```typescript
// 1. Authorization header always present in outbound request
// 2. Missing/expired-no-refresh token → 502 (never reaches upstream)
// 3. 401 from upstream → exactly 2 fetch calls (original + retry) when token refresh succeeds
// 4. 401 from upstream → exactly 1 fetch call when refresh returns null/same token
// 5. pathParams substitution happens before any auth header injection
// 6. Response { status, data, headers } always present regardless of upstream status code
// 7. data is null (not an error) for non-JSON upstream responses
// 8. No business logic applied to response — raw passthrough
```

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @apps/gateway test` passes with all 72 scenarios
- [x] Zero invariant failures

---

## Phase 8: Integration tests — Extended event ordering

**File**: `packages/integration-tests/src/event-ordering.integration.test.ts`

Add two new suites to the existing file.

### Suite 6.4: All 4 teardown steps in all orderings

The existing Suite 6.1 covers 3 of 4 teardown steps (missing `revoke-token`). Add a new suite with all 4:

```typescript
describe("Suite 6.4 — All 4 teardown steps are order-independent", () => {
  it("cancel-backfill + revoke-token + clear-cache + soft-delete produce identical final state in all 24 orderings", async () => {
    // 4! = 24 permutations
    const result = await withEventPermutations({
      effects: [
        { label: "cancel-backfill", deliver: ... },      // QStash → backfill
        { label: "revoke-token", deliver: ... },         // Provider API call (mocked)
        { label: "clear-redis-cache", deliver: ... },    // redis.del
        { label: "soft-delete-db", deliver: ... },       // DB UPDATE
      ],
      invariant: async () => {
        expect(redisStore.has(cacheKey)).toBe(false);
        expect(instRow.status).toBe("revoked");
        expect(resRow.status).toBe("removed");
        expect(revokeTokenCalled).toBe(true);
        expect(cancelMessageSent).toBe(true);
      },
      ...
    })
    expect(result.failures).toHaveLength(0);
    expect(result.permutationsRun).toBe(24); // 4! = 24
  })
})
```

### Suite 6.5: Same-resource concurrent deliveries (dedup invariant)

```typescript
describe("Suite 6.5 — Duplicate webhook deliveries are idempotent", () => {
  it("two concurrent deliveries for the same deliveryId produce exactly 1 QStash publish in all orderings", async () => {
    // Scenario: relay receives the same webhook twice (network retry)
    // Redis SET NX ensures only one proceeds to QStash
    const result = await withEventPermutations({
      effects: [
        { label: "first-delivery", deliver: () => sendServiceAuthWebhook(deliveryId) },
        { label: "second-delivery", deliver: () => sendServiceAuthWebhook(deliveryId) },
      ],
      invariant: () => {
        // Exactly 1 QStash publish — dedup prevents double-delivery
        expect(qstashMessages.filter(m => m.body.deliveryId === deliveryId)).toHaveLength(1);
      },
      reset: resetStores,
    })
    expect(result.failures).toHaveLength(0);
    expect(result.permutationsRun).toBe(2);
  })
})
```

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @repo/integration-tests test` passes with all new suites
- [x] Suite 6.4 runs 24 permutations with 0 failures
- [x] Suite 6.5 runs 2 permutations with 0 failures

---

## Testing Strategy

### Unit test pattern (Phases 1–4, 7)
- Mock all external deps via `vi.hoisted()` + `vi.mock()`
- Keep mocks in same file as the test suite (no shared mock files)
- Use `makeContext(payload)` / `makeRetryContext(payload, cachedSteps)` for workflow tests

### Integration test pattern (Phases 5–6, 8)
- PGlite for real DB with `createTestDb()` / `resetTestDb()` / `closeTestDb()`
- In-memory Redis mock via `makeRedisMock(store)` from `harness.ts`
- `vi.stubGlobal("fetch", mockFetch)` for outbound HTTP (proxy/execute)
- `afterEach(() => vi.unstubAllGlobals())` for cleanup

### Invariant matrix pattern (Phases 3, 7)
- Use `cartesian()` helper (copy from `scenario-matrix.test.ts`)
- Label each scenario with a human-readable string for failure diagnostics
- Run via `it.each(cartesian(dimensions))("%s", async (scenario) => { ... })`
- Universal invariants are extracted to a separate `assertInvariants(result, scenario)` function

### Fault injection pattern (Phase 4)
- Each test targets exactly one step boundary
- Verify correct call counts on all mock fns (to ensure fault fired at the right step)
- Use `makeRetryContext` to simulate Upstash retry semantics

---

## Execution Order

Phases are independent and can be implemented in any order. Recommended:
1. Phase 1 (relay admin) — highest signal:effort ratio, pure additions to existing file
2. Phase 2 (lib/replay) — small, standalone, unblocks replay-dependent invariant testing
3. Phase 5 (gateway proxy) — highest coverage gap, zero tests today
4. Phase 6 (gateway token refresh) — completes the connection token lifecycle
5. Phase 3 (relay scenario matrix) — systematic coverage
6. Phase 4 (relay fault injection) — deepens workflow step coverage
7. Phase 7 (gateway scenario matrix) — systematic proxy coverage
8. Phase 8 (integration permutations) — extends event-ordering suite

---

## References

- Relay routes: `apps/relay/src/routes/webhooks.ts`, `workflows.ts`, `admin.ts`
- Relay lib: `apps/relay/src/lib/replay.ts`, `cache.ts`
- Gateway routes: `apps/gateway/src/routes/connections.ts`
- Gateway workflows: `apps/gateway/src/workflows/connection-teardown.ts`
- Gateway lib: `apps/gateway/src/lib/token-store.ts`, `encryption.ts`, `cache.ts`
- Test harness: `packages/integration-tests/src/harness.ts` (`withEventPermutations`, `makeRedisMock`, `makeQStashMock`, `makeStep`, `withTimeFaults`)
- Backfill models: `apps/backfill/src/workflows/scenario-matrix.test.ts`, `fault-injection.test.ts`
- Existing event ordering: `packages/integration-tests/src/event-ordering.integration.test.ts`
