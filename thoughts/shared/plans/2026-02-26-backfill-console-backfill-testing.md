# Backfill & Console-Backfill Testing Implementation Plan

## Overview

Add complete test coverage to `apps/backfill` (currently 0 tests) and `packages/console-backfill` (currently 0 tests). This covers infrastructure setup, pure unit tests for adapters, mocked unit tests for connectors and routes, and Inngest workflow handler tests using a novel `createFunction` capture pattern.

## Current State Analysis

| Module | Tests | Infrastructure |
|---|---|---|
| `apps/backfill` | 0 | No vitest config, no test script, no vitest devDep |
| `packages/console-backfill` | 0 | No vitest config, no test script, no vitest devDep |

Both `apps/gateway` and `apps/connections` have mature test suites (~130 and ~74 tests respectively) with identical vitest infrastructure we'll replicate exactly.

### Key Discoveries:
- Gateway/connections use identical `vitest.config.ts`: `{ globals: true, environment: "node" }` — `apps/gateway/vitest.config.ts:1-7`
- Both use `"test": "vitest run"` script and `"vitest": "catalog:"` devDep
- Route tests use `vi.hoisted` + `app.request()` pattern — `apps/connections/src/routes/connections.test.ts:1-90`
- Workflow tests use handler capture via `serve()` mock + `await import()` — `apps/connections/src/workflows/connection-teardown.test.ts:1-20`
- Backfill workflows use Inngest `createFunction` (not Upstash `serve`), requiring an analogous capture pattern
- `packages/console-backfill/src/adapters/` contains **pure functions** — no mocking needed for highest-value tests
- Connectors use raw `fetch` (not vendor abstractions), requiring `vi.stubGlobal("fetch", mockFetch)` — a pattern not yet used in gateway/connections tests

## Desired End State

After this plan is complete:
- `packages/console-backfill` has ~40-50 unit tests covering adapters, registry, and connectors
- `apps/backfill` has ~50-60 unit tests covering routes and both Inngest workflows
- Both packages have `vitest.config.ts`, `"test": "vitest run"` script, and `vitest` devDep
- `pnpm --filter @repo/console-backfill test` and `pnpm --filter backfill test` both pass
- All tests follow established gateway/connections patterns

### Verification:
```bash
pnpm --filter @repo/console-backfill test   # ~40-50 tests pass
pnpm --filter backfill test                  # ~50-60 tests pass
pnpm typecheck                               # No type errors
pnpm lint                                    # No lint errors
```

## What We're NOT Doing

- Integration tests requiring real services (Inngest dev server, PGlite, Redis)
- Cross-service E2E tests (ideas 30-34 from the research doc)
- Tests for `apps/backfill/src/routes/inngest.ts` (thin Inngest SDK adapter, not worth mocking)
- Tests for `apps/backfill/src/env.ts` (t3-oss env validation, tested by the framework)
- Tests for `apps/backfill/src/lib/related-projects.ts` (thin `@vercel/related-projects` wrapper)
- Performance tests or load tests
- Adding tests to gateway/connections (they already have solid coverage)

## Implementation Approach

We follow the exact infrastructure and patterns already established in `apps/gateway` and `apps/connections`. The only novel pattern is the Inngest `createFunction` handler capture (Phase 5), which mirrors the existing Upstash Workflow `serve()` capture but adapted for Inngest's API.

Test tiers proceed from simplest to most complex:
1. Infrastructure (zero risk)
2. Pure adapter functions (no mocks)
3. Registry + connectors (mocked `fetch`)
4. Routes (vi.hoisted + app.request)
5. Inngest workflows (createFunction capture + step mocking)

---

## Phase 1: Infrastructure Setup

### Overview
Add vitest test infrastructure to both `packages/console-backfill` and `apps/backfill`, matching the exact pattern from gateway/connections.

### Changes Required:

#### 1. `packages/console-backfill/vitest.config.ts` (create)
**File**: `packages/console-backfill/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

#### 2. `packages/console-backfill/package.json` (edit)
**File**: `packages/console-backfill/package.json`
**Changes**: Add `test` script and `vitest` devDependency

Add to `scripts`:
```json
"test": "vitest run"
```

Add to `devDependencies`:
```json
"vitest": "catalog:"
```

#### 3. `apps/backfill/vitest.config.ts` (create)
**File**: `apps/backfill/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

#### 4. `apps/backfill/package.json` (edit)
**File**: `apps/backfill/package.json`
**Changes**: Add `test` script and `vitest` devDependency

Add to `scripts`:
```json
"test": "vitest run"
```

Add to `devDependencies`:
```json
"vitest": "catalog:"
```

#### 5. Install dependencies
```bash
pnpm install
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @repo/console-backfill test` runs (exits 0 with "no test files" or similar)
- [x] `pnpm --filter backfill test` runs (exits 0 with "no test files" or similar)
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes

---

## Phase 2: Pure Adapter Unit Tests (`packages/console-backfill`)

### Overview
Test all pure functions in `src/adapters/github.ts` and `src/adapters/vercel.ts`. These are the highest-value, lowest-risk tests — zero mocks needed.

### Changes Required:

#### 1. GitHub Adapter Tests
**File**: `packages/console-backfill/src/adapters/github.test.ts` (create)

Test `adaptGitHubPRForTransformer` (`adapters/github.ts:24-37`):
- Open PR (`state: "open"`) → `action: "opened"`
- Closed PR (`state: "closed"`) → `action: "closed"`
- Merged PR (`state: "closed"`, `merged: true`) → `action: "closed"` (transformer handles merge detection separately)
- Output shape: `{ action, pull_request, repository, sender }` fields present
- `sender` equals `pr.user`
- `repository` passed through from `repo` parameter

Test `adaptGitHubIssueForTransformer` (`adapters/github.ts:46-59`):
- Open issue → `action: "opened"`
- Closed issue → `action: "closed"`
- Output shape: `{ action, issue, repository, sender }` fields present
- `sender` equals `issue.user`

Test `adaptGitHubReleaseForTransformer` (`adapters/github.ts:66-76`):
- Always produces `action: "published"` regardless of input state
- Output shape: `{ action, release, repository, sender }` fields present
- `sender` equals `release.author`

Test `parseGitHubRateLimit` (`adapters/github.ts:81-97`):
- Valid headers `{ "x-ratelimit-remaining": "4999", "x-ratelimit-reset": "1700000000", "x-ratelimit-limit": "5000" }` → returns `{ remaining: 4999, resetAt: Date, limit: 5000 }`
- `resetAt` value is `new Date(1700000000 * 1000)` — Unix seconds multiplied by 1000
- Missing `x-ratelimit-remaining` → returns `undefined`
- Missing `x-ratelimit-reset` → returns `undefined`
- Missing `x-ratelimit-limit` → returns `undefined`
- Empty object `{}` → returns `undefined`

#### 2. Vercel Adapter Tests
**File**: `packages/console-backfill/src/adapters/vercel.test.ts` (create)

Test `mapReadyStateToEventType` (`adapters/vercel.ts:21-32`):

Note: `mapReadyStateToEventType` is not exported — it's a private function. Test it indirectly through `adaptVercelDeploymentForTransformer` by passing deployments with different `readyState` values.

- Deployment with `readyState: "READY"` → `eventType: "deployment.succeeded"`
- Deployment with `readyState: "ERROR"` → `eventType: "deployment.error"`
- Deployment with `readyState: "CANCELED"` → `eventType: "deployment.canceled"`
- Deployment with `readyState: "BUILDING"` → `eventType: "deployment.created"`
- Deployment with `readyState: undefined` → `eventType: "deployment.created"`

Test `adaptVercelDeploymentForTransformer` (`adapters/vercel.ts:42-75`):
- Output `webhookPayload.id` equals `"backfill-{deployment.uid}"`
- Output `webhookPayload.type` matches mapped `eventType`
- Output `webhookPayload.createdAt` equals `deployment.created` when present
- Output `webhookPayload.createdAt` is roughly `Date.now()` when `deployment.created` is undefined
- Output `webhookPayload.payload.deployment` has `{ id, name, url, readyState, meta }` from input
- Output `webhookPayload.payload.project` has `{ id: deployment.projectId, name: projectName }`
- When `projectName` is passed → `project.name` equals `projectName`
- Function returns `{ webhookPayload, eventType }` tuple

Test `parseVercelRateLimit` (`adapters/vercel.ts:80-96`):
- Valid `Headers` object with all three headers → returns `{ remaining, resetAt, limit }`
- `resetAt` is `new Date(parseInt(reset, 10) * 1000)` — same Unix seconds conversion as GitHub
- `Headers` missing `x-ratelimit-remaining` → returns `undefined`
- `Headers` missing `x-ratelimit-reset` → returns `undefined`
- `Headers` missing `x-ratelimit-limit` → returns `undefined`
- Uses `Headers` object (`.get()` method), not plain object like GitHub adapter

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @repo/console-backfill test` passes (~20 tests) → 37 tests
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation before proceeding to Phase 3.

---

## Phase 3: Registry & Connector Unit Tests (`packages/console-backfill`)

### Overview
Test the connector registry and both provider connectors (GitHub, Vercel). Connectors use raw `fetch` so we need `vi.stubGlobal("fetch", mockFetch)`.

### Changes Required:

#### 1. Registry Tests
**File**: `packages/console-backfill/src/registry.test.ts` (create)

Note: Import from `./registry` directly (not from `./index`) to avoid side-effect auto-registration.

Tests:
- `registerConnector` stores connector → `getConnector` retrieves it
- `hasConnector` returns `false` before registration, `true` after
- `getConnector` with unknown provider returns `undefined`
- Re-registering a provider overwrites the existing entry
- Multiple connectors can be registered independently

#### 2. GitHub Connector Tests
**File**: `packages/console-backfill/src/connectors/github.test.ts` (create)

Setup pattern:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { githubBackfillConnector } from "./github";
import type { BackfillConfig } from "../types";

function makeConfig(overrides?: Partial<BackfillConfig>): BackfillConfig {
  return {
    installationId: "inst-1",
    provider: "github",
    since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    accessToken: "ghs_test_token",
    resource: { providerResourceId: "123", resourceName: "owner/repo" },
    ...overrides,
  };
}

function mockResponse(
  data: unknown,
  headers: Record<string, string> = {},
  ok = true,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}
```

Test provider metadata:
- `provider === "github"`
- `supportedEntityTypes` contains `"pull_request"`, `"issue"`, `"release"`
- `defaultEntityTypes` equals `supportedEntityTypes`

Test `validateScopes`:
- Resolves without throwing for any input (no-op)

Test `fetchPage("pull_request", ...)` (`connectors/github.ts:68-113`):
- Valid response with 3 PRs all within `since` range → returns 3 events
- Each event has `deliveryId` format `backfill-{installationId}-{providerResourceId}-pr-{number}`
- Each event has `eventType: "pull_request"`
- Correct URL: `https://api.github.com/repos/owner/repo/pulls?state=all&sort=updated&direction=desc&per_page=100&page=1`
- Auth header: `Authorization: Bearer ghs_test_token`
- Items with `updated_at` older than `since` → excluded (client-side filter)
- 100 items returned and all pass filter → `nextCursor: { page: 2 }`
- Fewer than 100 items → `nextCursor: null`
- 100 items but some filtered by `since` → `nextCursor: null`
- Rate limit headers present → `rateLimit` populated in response
- API returns non-OK → throws Error
- `null` cursor → page 1; `{ page: 3 }` cursor → page 3

Test `fetchPage("issue", ...)` (`connectors/github.ts:115-159`):
- `since` included as query parameter (server-side filter)
- Items with `pull_request` key → excluded from results
- Pure issues (no `pull_request` key) → included
- `deliveryId` format: `backfill-{installationId}-{providerResourceId}-issue-{number}`
- `eventType: "issues"` (not `"issue"`)
- 100 items → `nextCursor: { page: 2 }`; fewer → `null`

Test `fetchPage("release", ...)` (`connectors/github.ts:162-207`):
- Client-side filter on `published_at ?? created_at >= since`
- Release with only `created_at` (no `published_at`) → uses `created_at` for filter
- `deliveryId` format: `backfill-{installationId}-{providerResourceId}-release-{id}`
- `eventType: "release"`
- Same pagination termination logic as PRs

Test `fetchPage("unknown", ...)`:
- Throws Error for unsupported entity type

Test `resourceName` parsing:
- `resourceName: "owner/repo"` → correctly splits to `owner` and `repo`
- `resourceName: null` or malformed → throws

#### 3. Vercel Connector Tests
**File**: `packages/console-backfill/src/connectors/vercel.test.ts` (create)

Same `vi.stubGlobal("fetch", mockFetch)` pattern.

Test `validateScopes` (`connectors/vercel.ts:31-46`):
- Fetch to `https://api.vercel.com/v6/deployments?projectId={id}&limit=1` returns 200 → resolves
- Fetch returns non-OK → throws

Test `fetchPage("deployment", ...)` (`connectors/vercel.ts:60-119`):
- First page (cursor `null`): URL has no `until` param
- Subsequent page (cursor `12345`): URL has `until=12345`
- `deliveryId` format: `backfill-{installationId}-{providerResourceId}-deploy-{uid}`
- Client-side filter: `deployment.created >= config.since`
- `pagination.next` non-null and all items pass filter → `nextCursor: pagination.next`
- Some items filtered → `nextCursor: null`
- `resourceName` falls back to `providerResourceId` when null
- Rate limit headers parsed from response
- Auth header: `Authorization: Bearer {accessToken}`

Test `fetchPage("unknown", ...)`:
- Throws for unsupported entity types

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @repo/console-backfill test` passes (~45 tests) → 84 tests
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation before proceeding to Phase 4.

---

## Phase 4: Route Unit Tests (`apps/backfill`)

### Overview
Test `src/routes/trigger.ts` using the `vi.hoisted + app.request()` pattern from connections.

### Changes Required:

#### 1. Trigger Route Tests
**File**: `apps/backfill/src/routes/trigger.test.ts` (create)

Setup pattern (mirrors `apps/connections/src/routes/connections.test.ts`):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInngestSend } = vi.hoisted(() => ({
  mockInngestSend: vi.fn().mockResolvedValue({ ids: ["evt-1"] }),
}));

vi.mock("../env", () => ({
  env: { GATEWAY_API_KEY: "test-key" },
}));

vi.mock("../inngest/client", () => ({
  inngest: { send: mockInngestSend },
}));

import { Hono } from "hono";
import { trigger } from "./trigger";

const app = new Hono();
app.route("/trigger", trigger);

function request(
  path: string,
  init: {
    method?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  return app.request(path, {
    method: init.method ?? "POST",
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
}
```

**`POST /trigger/` tests** (`routes/trigger.ts:13-43`):
- Valid request with `X-API-Key: test-key` and full body → 200, `{ status: "accepted", installationId }`
- Missing `X-API-Key` header → 401
- Wrong `X-API-Key` value → 401
- Missing `installationId` in body → 400
- Missing `provider` in body → 400
- Missing `orgId` in body → 400
- Valid request → `inngest.send` called with `name: "apps-backfill/run.requested"` and correct `data`
- `depth` defaults to `30` when not provided in body
- Custom `depth: 90` passes through
- Custom `entityTypes: ["pull_request"]` passes through
- `inngest.send` rejects → 500 response

**`POST /trigger/cancel` tests** (`routes/trigger.ts:51-69`):
- Valid request → 200, `{ status: "cancelled", installationId }`
- Missing `X-API-Key` → 401
- Wrong `X-API-Key` → 401
- Missing `installationId` in body → 400
- `inngest.send` called with `name: "apps-backfill/run.cancelled"` and `{ installationId }`
- `inngest.send` rejects → 500 response

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter backfill test` passes (~15 tests) → 17 tests
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation before proceeding to Phase 5.

---

## Phase 5: Inngest Workflow Unit Tests (`apps/backfill`)

### Overview
Test both Inngest workflow functions using a `createFunction` handler capture pattern — analogous to the Upstash Workflow `serve()` capture used in gateway/connections. This is the most complex and novel phase.

### Key Pattern: Inngest `createFunction` Handler Capture

The Inngest SDK's `createFunction(config, trigger, handler)` is called at module scope when a workflow file loads. We mock `inngest.createFunction` to intercept the handler, then invoke it directly with fake `event` and `step` objects.

```typescript
let capturedHandler: (args: { event: any; step: any }) => Promise<unknown>;

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (_config: unknown, _trigger: unknown, handler: typeof capturedHandler) => {
      capturedHandler = handler;
      return { id: "mock-fn" };
    },
  },
}));
```

**Fake step context factory:**

```typescript
function makeStep(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
    sendEvent: vi.fn().mockResolvedValue(undefined),
    waitForEvent: vi.fn().mockResolvedValue(null),
    sleep: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
```

### Changes Required:

#### 1. Backfill Orchestrator Tests
**File**: `apps/backfill/src/workflows/backfill-orchestrator.test.ts` (create)

Setup:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

let capturedHandler: (args: { event: any; step: any }) => Promise<unknown>;

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (_config: unknown, _trigger: unknown, handler: typeof capturedHandler) => {
      capturedHandler = handler;
      return { id: "mock-orchestrator" };
    },
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockGetConnector = vi.fn();
vi.mock("@repo/console-backfill", () => ({
  getConnector: (...args: unknown[]) => mockGetConnector(...args),
}));

vi.mock("../lib/related-projects", () => ({
  connectionsUrl: "https://connections.test",
  gatewayUrl: "https://gateway.test",
}));

// Force module load to capture handler
await import("./backfill-orchestrator");
```

Test helpers:
```typescript
function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
      depth: 30,
      entityTypes: undefined,
      ...overrides,
    },
  };
}

function makeStep(overrides: Record<string, unknown> = {}) {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
    sendEvent: vi.fn().mockResolvedValue(undefined),
    waitForEvent: vi.fn().mockResolvedValue(null),
    sleep: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
```

**Test group: `get-connection` step** (`backfill-orchestrator.ts:34-62`):
- Mock fetch returns active connection with resources → step passes, handler continues
- Connection `status: "inactive"` → throws (handler rejects)
- Connection `status: "error"` → throws (handler rejects)
- Connections API returns 404 → throws (handler rejects)
- Connection has zero resources → returns early with `{ success: true, completed: 0, failed: 0 }`
- Fetch URL: `https://connections.test/connections/inst-1` with `X-API-Key` header

**Test group: connector resolution** (`backfill-orchestrator.ts:65-82`):
- `getConnector("github")` returns null → throws (handler rejects)
- `entityTypes` from event data overrides connector `defaultEntityTypes`
- `entityTypes` absent → uses `connector.defaultEntityTypes`
- `since` computed: 30 days back from `Date.now()`

**Test group: work unit enumeration** (`backfill-orchestrator.ts:85-106`):
- 2 resources × 3 entity types = 6 work units
- 1 resource × 1 entity type (override) = 1 work unit
- Each work unit `workUnitId` format: `"{providerResourceId}-{entityType}"`

**Test group: fan-out** (`backfill-orchestrator.ts:109-123`):
- `step.sendEvent` called once with batch of `apps-backfill/entity.requested` events
- Each event contains `installationId`, `provider`, `orgId`, `entityType`, `resource`, `since`, `depth`

**Test group: wait-for-completions** (`backfill-orchestrator.ts:128-154`):
- `step.waitForEvent` called once per work unit
- `null` return (timeout) → included in `failed` results with timeout error message
- Successful completion event with `success: true` → included in succeeded
- Completion event with `success: false` → included in failed

**Test group: aggregation** (`backfill-orchestrator.ts:157-176`):
- All work units succeed → `success: true`
- Any work unit fails → `success: false`
- `eventsProduced` and `eventsDispatched` summed from all completion events

#### 2. Entity Worker Tests
**File**: `apps/backfill/src/workflows/entity-worker.test.ts` (create)

Setup — same `createFunction` capture pattern but with different mocks:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Two handlers captured: main handler + onFailure handler
let capturedHandler: (args: { event: any; step: any }) => Promise<unknown>;
let capturedOnFailure: ((args: { event: any; step: any }) => Promise<unknown>) | undefined;

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (config: any, _trigger: unknown, handler: typeof capturedHandler) => {
      capturedHandler = handler;
      if (config.onFailure) {
        capturedOnFailure = config.onFailure;
      }
      return { id: "mock-entity-worker" };
    },
  },
}));
```

Note: The entity worker's `createFunction` config includes an `onFailure` handler (`entity-worker.ts:38-54`). We need to capture this separately. Check the actual Inngest API to confirm how `onFailure` is passed — it may be in the config object or as a separate argument. Adjust the capture logic accordingly.

Test helpers:
```typescript
function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
      entityType: "pull_request",
      resource: { providerResourceId: "123", resourceName: "owner/repo" },
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      depth: 30,
      ...overrides,
    },
  };
}

const mockConnector = {
  provider: "github" as const,
  supportedEntityTypes: ["pull_request"],
  defaultEntityTypes: ["pull_request"],
  validateScopes: vi.fn(),
  fetchPage: vi.fn(),
};
```

**Test group: `get-token` step** (`entity-worker.ts:68-86`):
- Mock fetch returns `{ accessToken: "tok-1", provider: "github", expiresIn: 3600 }` → step passes
- Connections API returns 401 → step throws (retryable)
- Fetch URL: `https://connections.test/connections/inst-1/token` with `X-API-Key` header

**Test group: connector resolution** (`entity-worker.ts:89-96`):
- `getConnector(provider)` returns null → throws

**Test group: pagination loop — single page** (`entity-worker.ts:111-223`):
- `fetchPage` returns 3 events with `nextCursor: null` → 3 dispatch calls, loop exits
- Each dispatch POSTs to `https://gateway.test/webhooks/github`
- Dispatch body shape: `{ connectionId, orgId, deliveryId, eventType, payload, receivedAt }`
- `X-API-Key` header included on dispatch calls
- `receivedAt` is a number (milliseconds timestamp)

**Test group: pagination loop — multiple pages**:
- `fetchPage` returns `nextCursor: { page: 2 }` first, `null` second → 2 fetch steps, 2 dispatch steps
- Cursor passed correctly to second `fetchPage` call

**Test group: 401 mid-pagination token refresh** (`entity-worker.ts:142-169`):
- `fetchPage` throws with `status: 401` → token re-fetched from Connections API → `fetchPage` retried with new token
- If token refresh also fails → original error re-thrown

**Test group: rate limit injection** (`entity-worker.ts:206-218`):
- `fetchPage` returns `rateLimit.remaining < rateLimit.limit * 0.1` → `step.sleep` called
- `rateLimit.remaining >= 10%` of limit → `step.sleep` not called
- Sleep duration computed from `resetAt`

**Test group: `onFailure` handler** (`entity-worker.ts:38-54`):
- `onFailure` sends `apps-backfill/entity.completed` with `success: false`
- `error` field contains the failure message

**Test group: completion** (`entity-worker.ts:226-238`):
- Normal exit → sends `apps-backfill/entity.completed` with `success: true`
- Counts: `eventsProduced`, `eventsDispatched`, `pagesProcessed` match actual loop iterations

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter backfill test` passes (~55 tests total, including Phase 4 route tests) → 46 tests
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes

#### Manual Verification:
- [ ] Review Inngest `createFunction` capture pattern — confirm the handler signature and `onFailure` capture approach match the actual Inngest SDK API
- [ ] Verify the step mock (`step.run` executing callbacks synchronously) correctly simulates Inngest step semantics

**Implementation Note**: After completing this phase, all automated verification must pass. The `onFailure` capture approach should be verified against the actual Inngest `createFunction` API at implementation time — the handler may be passed differently depending on the Inngest SDK version.

---

## Testing Strategy

### Test Taxonomy

| File | Type | Mocks | Test Count |
|---|---|---|---|
| `adapters/github.test.ts` | Pure unit | None | ~12 |
| `adapters/vercel.test.ts` | Pure unit | None | ~10 |
| `registry.test.ts` | Unit | None (import from `./registry` directly) | ~5 |
| `connectors/github.test.ts` | Unit | `vi.stubGlobal("fetch")` | ~15 |
| `connectors/vercel.test.ts` | Unit | `vi.stubGlobal("fetch")` | ~8 |
| `routes/trigger.test.ts` | Unit | `vi.hoisted` + `vi.mock` (env, inngest) | ~15 |
| `backfill-orchestrator.test.ts` | Unit | `createFunction` capture + `vi.mock` + `vi.stubGlobal` | ~18 |
| `entity-worker.test.ts` | Unit | `createFunction` capture + `vi.mock` + `vi.stubGlobal` | ~20 |

### Key Edge Cases

1. **GitHub `since` boundary**: PR with `updated_at` exactly equal to `since` → included (uses `>=`)
2. **GitHub issues vs PRs**: `/issues` endpoint returns both; items with `pull_request` key must be filtered
3. **Vercel `created` field**: If undefined, `adaptVercelDeploymentForTransformer` uses `Date.now()` as fallback
4. **Rate limit threshold**: 10% boundary — `remaining/limit = 0.1` exactly should NOT trigger sleep
5. **Token refresh during pagination**: 401 error mid-loop triggers token re-fetch before retrying `fetchPage`
6. **Empty resources**: Connection with zero resources → orchestrator returns early, no fan-out
7. **Timeout handling**: `waitForEvent` returning `null` maps to failure with timeout error message

---

## Performance Considerations

All tests are unit tests with mocked I/O — no real network calls, no database. Expected test suite runtime:
- `packages/console-backfill`: < 2 seconds
- `apps/backfill`: < 3 seconds

No performance optimization needed.

---

## References

- Research: `thoughts/shared/research/2026-02-25-backfill-connections-gateway-testing-strategy.md`
- Gateway test patterns: `apps/gateway/src/routes/webhooks.test.ts`, `apps/gateway/src/workflows/webhook-delivery.test.ts`
- Connections test patterns: `apps/connections/src/routes/connections.test.ts`, `apps/connections/src/workflows/connection-teardown.test.ts`
- Backfill orchestrator: `apps/backfill/src/workflows/backfill-orchestrator.ts`
- Entity worker: `apps/backfill/src/workflows/entity-worker.ts`
- Adapters: `packages/console-backfill/src/adapters/github.ts`, `packages/console-backfill/src/adapters/vercel.ts`
- Connectors: `packages/console-backfill/src/connectors/github.ts`, `packages/console-backfill/src/connectors/vercel.ts`
