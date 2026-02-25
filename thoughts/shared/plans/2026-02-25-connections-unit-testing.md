# Connections Service Unit Testing — Implementation Plan

## Overview

Add unit tests to `apps/connections/` covering only the critical paths: provider implementations, HTTP routes, and the teardown workflow. Follows patterns from `apps/gateway/` test suite.

## Current State Analysis

- **20 source files**, 0 test files, no vitest config
- `apps/gateway/` has mature test patterns to replicate
- vitest `^3.2.4` in pnpm catalog

## Desired End State

7 test files covering critical business logic:

| File | Tests | Category |
|------|-------|----------|
| `providers/index.test.ts` | ~5 | Provider registry |
| `providers/impl/github.test.ts` | ~6 | GitHub OAuth |
| `providers/impl/vercel.test.ts` | ~4 | Vercel OAuth |
| `providers/impl/linear.test.ts` | ~5 | Linear OAuth |
| `providers/impl/sentry.test.ts` | ~5 | Sentry OAuth |
| `routes/connections.test.ts` | ~20 | HTTP routes |
| `workflows/connection-teardown.test.ts` | ~6 | Teardown workflow |

**Total: ~51 tests**

## What We're NOT Doing

- No tests for pure utility functions (`lib/cache.ts`, `lib/crypto.ts`, `providers/schemas.ts`)
- No tests for thin wrappers (`lib/token-store.ts`, `lib/urls.ts`, `lib/github-jwt.ts`)
- No tests for middleware in isolation (tested via route tests)
- No integration tests, no coverage thresholds

---

## Phase 1: Infrastructure + Provider Tests

### Overview
Set up vitest and add provider tests. Providers are testable with minimal mocking (just `env` and `lib/urls`).

### Changes Required:

#### 1. Package.json
**File**: `apps/connections/package.json`

Add `"test": "vitest run"` to scripts, `"vitest": "catalog:"` to devDependencies.

#### 2. Vitest config
**File**: `apps/connections/vitest.config.ts` (new)

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

#### 3. Provider registry
**File**: `apps/connections/src/providers/index.test.ts` (new)

- Returns correct provider class for each of the 4 names
- Throws for unknown provider

#### 4. GitHub provider
**File**: `apps/connections/src/providers/impl/github.test.ts` (new)

Mocks: `../../env`, `../../lib/urls`

- `getAuthorizationUrl` — correct URL with state and client_id
- `getAuthorizationUrl` — includes redirect_uri when redirectPath set
- `getInstallationUrl` — correct App install URL with optional target_id
- `refreshToken` — rejects (not supported)
- `buildAccountInfo` — correct structure with installation data
- Provider metadata (name, requiresWebhookRegistration)

#### 5. Vercel provider
**File**: `apps/connections/src/providers/impl/vercel.test.ts` (new)

Mocks: `../../env`, `../../lib/urls`

- `getAuthorizationUrl` — correct Vercel integration URL
- `refreshToken` — rejects
- `buildAccountInfo` — extracts team_id/team_slug from OAuth raw
- Provider metadata

#### 6. Linear provider
**File**: `apps/connections/src/providers/impl/linear.test.ts` (new)

Mocks: `../../env`, `../../lib/urls`

- `getAuthorizationUrl` — correct URL with default scopes
- `getAuthorizationUrl` — custom scopes
- `refreshToken` — rejects
- `buildAccountInfo` — minimal `{ version: 1, sourceType: "linear" }`
- Provider metadata

#### 7. Sentry provider
**File**: `apps/connections/src/providers/impl/sentry.test.ts` (new)

Mocks: `../../env`, `../../lib/urls`

- `getAuthorizationUrl` — correct Sentry external-install URL
- `registerWebhook` — returns static ID (no-op)
- `deregisterWebhook` — no-op
- `buildAccountInfo` — minimal
- Provider metadata

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm install` completes
- [ ] `pnpm --filter @lightfast/connections test` passes
- [ ] `pnpm --filter @lightfast/connections typecheck` passes
- [ ] `pnpm --filter @lightfast/connections lint` passes

**Implementation Note**: Pause after Phase 1 for confirmation before proceeding.

---

## Phase 2: Route + Workflow Tests

### Overview
HTTP-level route tests and durable workflow tests. Heavier mocking required.

### Changes Required:

#### 1. Route tests
**File**: `apps/connections/src/routes/connections.test.ts` (new)

Mock strategy (follows `apps/gateway/src/routes/webhooks.test.ts`):
- `vi.hoisted()` for mock function refs
- `vi.mock("../env")` — fake env values
- `vi.mock("@vendor/upstash")` — mock Redis
- `vi.mock("@vendor/upstash-workflow/client")` — mock workflow trigger
- `vi.mock("@db/console/client")` — mock Drizzle chains
- `vi.mock("@db/console/schema")` — plain object stubs
- `vi.mock("../lib/urls")` — mock URLs and backfill
- Hono `app.request()` for HTTP testing

Test groups:
- **GET /:provider/authorize** — valid (200 + URL + state), unknown provider (400), missing org_id (400)
- **GET /:provider/callback** — unknown provider (400), missing/expired state (400), provider mismatch (400), missing params (400)
- **GET /:id** — no auth (401), wrong auth (401), not found (404), found (200)
- **GET /:id/token** — no auth (401), not found (404), not active (400)
- **DELETE /:provider/:id** — no auth (401), not found (404), success triggers workflow (200)
- **POST /:id/resources** — no auth (401), not found (404), missing field (400)
- **DELETE /:id/resources/:resourceId** — no auth (401), not found (404), already removed (400)

#### 2. Teardown workflow tests
**File**: `apps/connections/src/workflows/connection-teardown.test.ts` (new)

Mock strategy (follows `apps/gateway/src/workflows/webhook-delivery.test.ts`):
- `vi.mock("@vendor/upstash-workflow/hono")` — capture handler from `serve()`
- `vi.mock("@vendor/upstash")` — mock Redis del
- `vi.mock("@db/console/client")` — mock Drizzle chains
- `vi.mock("../lib/crypto")` — mock decrypt
- `vi.mock("../lib/urls")` — mock cancelBackfillService
- Context: `{ requestPayload, run: vi.fn((_name, fn) => fn()) }`

Test cases:
- Runs all 5 steps in correct order
- Skips token revocation for GitHub (JWT-based)
- Cleans up Redis cache for linked resources
- Soft-deletes installation and resources in DB
- Calls cancelBackfillService
- Calls deregisterWebhook when metadata has webhookId

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @lightfast/connections test` passes
- [ ] `pnpm --filter @lightfast/connections typecheck` passes
- [ ] `pnpm --filter @lightfast/connections lint` passes

#### Manual Verification:
- [ ] All 7 test files appear in output
- [ ] No skipped tests

---

## References

- `apps/gateway/src/routes/webhooks.test.ts` — route mock pattern
- `apps/gateway/src/workflows/webhook-delivery.test.ts` — workflow capture pattern
- `apps/gateway/src/providers/index.test.ts` — registry test pattern
- `apps/gateway/vitest.config.ts` — config
