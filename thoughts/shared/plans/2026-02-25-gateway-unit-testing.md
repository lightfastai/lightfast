# Gateway Critical Path Unit Testing

## Overview

Add unit tests for `@apps/gateway/` covering the critical webhook delivery path: signature verification → payload parsing → identifier extraction → deduplication → connection resolution → publish/DLQ routing. Non-critical operational endpoints (admin, health, cache rebuild) are out of scope.

## Current State Analysis

- Zero existing tests in `apps/gateway/`
- No vitest config or test scripts
- Monorepo uses vitest `catalog: ^3.2.4` with `globals: true` pattern
- Gateway runs on Vercel Edge Runtime (Web Crypto API)
- External dependencies requiring mocks: `@vendor/upstash` (Redis), `@vendor/qstash` (QStash), `@vendor/upstash-workflow` (serve), `@db/console` (Drizzle)

## Desired End State

Critical path has unit test coverage:
- Crypto functions verified against known test vectors
- All 4 provider implementations tested (verify, parse, extract)
- Webhook ingress route tested for both service-auth and HMAC paths
- Webhook delivery workflow tested for dedup, resolve, publish, and DLQ branches

Verification: `pnpm --filter @lightfast/gateway test` passes.

## What We're NOT Doing

- Admin route tests (`/admin/health`, `/admin/cache/rebuild`, `/admin/dlq`, `/admin/dlq/replay`, `/admin/delivery-status`)
- Auth middleware standalone tests (tested implicitly via route tests)
- `lib/cache.ts` tests (trivial string concatenation)
- `lib/urls.ts` tests (environment-derived constants)
- Integration/e2e tests against real Redis/DB
- Coverage thresholds

## Implementation Approach

Bottom-up: pure functions first, then provider classes, then routes/workflows with mocked externals. Each test file lives next to the source file it tests.

---

## Phase 1: Test Infrastructure

### Overview
Add vitest config, test script, and shared mock utilities.

### Changes Required:

#### 1. Vitest config
**File**: `apps/gateway/vitest.config.ts` (new)

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "edge-runtime",
  },
});
```

Note: `@edge-runtime/vm` is needed for Web Crypto API support. If unavailable, fall back to `environment: "node"` — Node 22 has Web Crypto on `globalThis.crypto`.

#### 2. Package.json test script
**File**: `apps/gateway/package.json`
**Changes**: Add `test` script and vitest devDependency

```json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "catalog:"
  }
}
```

#### 3. Shared test helpers — mock factories
**File**: `apps/gateway/src/__tests__/mocks.ts` (new)

Centralized mock factories for external deps:
- `mockRedis()` — mock `@vendor/upstash` redis (set, hgetall, hset, ping)
- `mockQStash()` — mock `@vendor/qstash` client (publishJSON, publishToTopic)
- `mockDb()` — mock `@db/console/client` db (select/from/where chain)
- `mockEnv()` — mock `../env` with test values

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @lightfast/gateway test` runs without errors (no test files yet, but exits clean)
- [ ] `pnpm --filter @lightfast/gateway typecheck` still passes

---

## Phase 2: Crypto & Provider Tests

### Overview
Test the security boundary (HMAC verification) and all 4 provider implementations.

### Changes Required:

#### 1. Crypto tests
**File**: `apps/gateway/src/lib/crypto.test.ts` (new)

Tests:
- `computeHmacSha256` — known input/secret → expected hex output
- `computeHmacSha1` — known input/secret → expected hex output
- `timingSafeEqual` — equal strings return true, different strings return false, different lengths return false

#### 2. GitHub provider tests
**File**: `apps/gateway/src/providers/impl/github.test.ts` (new)

Tests:
- `verifyWebhook` — valid `sha256=<hmac>` signature → true
- `verifyWebhook` — invalid signature → false
- `verifyWebhook` — missing `x-hub-signature-256` header → false
- `parsePayload` — valid payload with `repository.id` and `installation.id` → parsed
- `parsePayload` — extra fields preserved (`.passthrough()`)
- `parsePayload` — invalid payload (non-object) → throws
- `extractDeliveryId` — reads `x-github-delivery` header
- `extractDeliveryId` — falls back to UUID when header missing
- `extractEventType` — reads `x-github-event` header
- `extractResourceId` — prefers `repository.id`, falls back to `installation.id`, returns null when neither

#### 3. Vercel provider tests
**File**: `apps/gateway/src/providers/impl/vercel.test.ts` (new)

Tests:
- `verifyWebhook` — valid HMAC-SHA1 signature → true
- `verifyWebhook` — invalid/missing signature → false
- `parsePayload` — valid payload with nested `payload.project.id`
- `extractDeliveryId` — prefers `x-vercel-id` header, then `payload.id`, then UUID
- `extractEventType` — reads `type` field from payload
- `extractResourceId` — prefers `payload.project.id`, falls back to `payload.team.id`

#### 4. Linear provider tests
**File**: `apps/gateway/src/providers/impl/linear.test.ts` (new)

Tests:
- `verifyWebhook` — valid HMAC-SHA256 via `linear-signature` header → true
- `verifyWebhook` — invalid/missing signature → false
- `parsePayload` — valid payload with `type`, `action`, `organizationId`
- `extractDeliveryId` — reads `linear-delivery` header
- `extractEventType` — combines `type:action`, falls back to `type`
- `extractResourceId` — returns `organizationId`

#### 5. Sentry provider tests
**File**: `apps/gateway/src/providers/impl/sentry.test.ts` (new)

Tests:
- `verifyWebhook` — valid HMAC-SHA256 via `sentry-hook-signature` header → true
- `verifyWebhook` — invalid/missing signature → false
- `parsePayload` — valid payload with `installation.uuid`
- `extractDeliveryId` — combines `sentry-hook-resource:sentry-hook-timestamp`
- `extractEventType` — reads `sentry-hook-resource` header
- `extractResourceId` — returns `installation.uuid`

#### 6. Provider registry test
**File**: `apps/gateway/src/providers/index.test.ts` (new)

Tests:
- `getProvider("github")` returns GitHubProvider
- `getProvider("vercel")` returns VercelProvider
- `getProvider("linear")` returns LinearProvider
- `getProvider("sentry")` returns SentryProvider
- `getProvider("unknown")` throws HTTPException

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @lightfast/gateway test` — all tests pass
- [ ] `pnpm --filter @lightfast/gateway typecheck` — no type errors

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Webhook Route & Workflow Tests

### Overview
Test the webhook ingress route handler (both auth paths) and the durable webhook delivery workflow (dedup → resolve → publish/DLQ).

### Changes Required:

#### 1. Webhook route tests
**File**: `apps/gateway/src/routes/webhooks.test.ts` (new)

Uses Hono's `app.request()` test helper to send HTTP requests without a running server.

**Standard HMAC path tests:**
- Valid GitHub webhook → 200 `{ status: "accepted", deliveryId }` + workflow triggered
- Invalid signature → 401 `{ error: "invalid_signature" }`
- Unknown provider → 400 `{ error: "unknown_provider" }`
- Invalid payload (fails Zod parse) → 400 `{ error: "invalid_payload" }`

**Service auth path tests:**
- Valid API key + complete body → 200 `{ status: "accepted" }` + QStash published directly
- Valid API key + missing required fields → 400 `{ error: "missing_required_fields" }`
- Valid API key + invalid payload (fails provider parse) → 400 `{ error: "invalid_payload" }`
- Valid API key + duplicate deliveryId (Redis SET NX returns null) → 200 `{ status: "duplicate" }`

**Mocking strategy:**
- `vi.mock("../env")` — provide test env values
- `vi.mock("@vendor/upstash")` — mock redis.set for dedup
- `vi.mock("@vendor/qstash")` — mock getQStashClient().publishJSON
- `vi.mock("@vendor/upstash-workflow/client")` — mock getWorkflowClient().trigger

#### 2. Webhook delivery workflow tests
**File**: `apps/gateway/src/workflows/webhook-delivery.test.ts` (new)

Tests the workflow handler logic by mocking the `WorkflowContext` that Upstash Workflow provides. Instead of testing through `serve()`, extract and test the handler function passed to `serve()`.

**Approach**: Since `webhookDeliveryWorkflow` is the result of `serve(handler)`, we can't easily extract the handler. Instead, test by mocking `serve` to capture the handler, then invoke it with a mock context.

**Tests:**
- Duplicate delivery (dedup step returns `true`) → workflow ends, no publish
- New delivery + connection found in Redis cache → publishes to Console via QStash
- New delivery + connection NOT in cache, found in DB → publishes to Console + populates Redis cache
- New delivery + no connection found (null resourceId or no DB row) → publishes to DLQ topic
- QStash publish includes correct `deduplicationId` and `callback` URL

**Mock context shape:**
```typescript
const mockContext = {
  requestPayload: { provider, deliveryId, eventType, resourceId, payload, receivedAt },
  run: vi.fn((stepName, fn) => fn()),  // Execute step functions immediately
};
```

**Mocking strategy:**
- `vi.mock("@vendor/upstash")` — mock redis (set for dedup, hgetall/hset for cache)
- `vi.mock("@vendor/qstash")` — mock qstash.publishJSON, qstash.publishToTopic
- `vi.mock("@db/console/client")` — mock db.select chain
- `vi.mock("@vendor/upstash-workflow/hono")` — mock `serve` to capture handler

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @lightfast/gateway test` — all tests pass
- [ ] `pnpm --filter @lightfast/gateway typecheck` — no type errors
- [ ] `pnpm lint` — no lint errors

#### Manual Verification:
- [ ] Review test output to confirm all critical paths are covered
- [ ] Confirm no tests are testing implementation details (only behavior)

---

## Testing Strategy

### What's covered (critical path):
- Webhook signature verification for all 4 providers
- Payload parsing and extraction for all 4 providers
- Webhook ingress routing (both auth paths)
- Deduplication, connection resolution, and delivery/DLQ branching

### What's intentionally not covered:
- Admin/operational endpoints
- Health checks
- Cache key formatting
- URL resolution
- Auth middleware in isolation

## References

- Existing vitest patterns: `core/lightfast/vitest.config.ts`, `apps/www/vitest.config.ts`
- Provider interface: `apps/gateway/src/providers/types.ts:59`
- Webhook route: `apps/gateway/src/routes/webhooks.ts:30`
- Delivery workflow: `apps/gateway/src/workflows/webhook-delivery.ts:29`
