# Backfill Tests, Triggers & Build Verification Plan

## Overview

Address 5 gaps in the connections/backfill system: missing tests for the gateway backfill route, missing tests for `notifyBackfill`, missing backfill triggers for Linear/Sentry providers, build verification, and snapshot validation.

## Current State Analysis

### Gateway Backfill Route (`apps/gateway/src/routes/backfill.ts`)
- Handles `POST /api/backfill` with `apiKeyAuth` middleware, Zod validation, and QStash forwarding
- Zero test coverage — no `backfill.test.ts` exists
- Existing `webhooks.test.ts` provides a complete pattern template

### `notifyBackfill` (`api/console/src/lib/backfill.ts`)
- Simple fire-and-forget fetch wrapper to `${gatewayUrl}/api/backfill`
- Zero test coverage, and `api/console` has no vitest config at all
- Function swallows errors (never throws) — needs tests for both success and failure paths

### Backfill Trigger Gap
- `notifyBackfill` is called only from `bulkLinkGitHubRepositories` (workspace.ts:1239) and `bulkLinkVercelProjects` (workspace.ts:1391)
- Linear and Sentry are org-level connections with no `bulkLink` mutation — no backfill trigger path exists
- **Decision**: Trigger backfill for all active `gwInstallations` during `workspace.create` (workspace.ts:224), providing a uniform trigger path for all providers

### Key Discoveries:
- `api/console/` has zero tests and no vitest config — needs bootstrapping (workspace.ts:224-299)
- Gateway test pattern: `vi.hoisted` → `vi.mock` → static import → `app.request()` (webhooks.test.ts:4-62)
- Integration test at `connections-backfill-trigger.integration.test.ts:275-326` asserts OAuth callbacks do NOT trigger backfill
- Contract snapshots at `packages/integration-tests/src/__snapshots__/contract-snapshots.test.ts.snap` were manually rewritten

## Desired End State

After implementation:
1. `apps/gateway/src/routes/backfill.test.ts` exists with full coverage (auth, validation, QStash forwarding, error cases)
2. `api/console/src/lib/backfill.test.ts` exists with coverage for success and failure paths
3. `workspace.create` mutation triggers `notifyBackfill` for all active org installations when a new workspace is created
4. `pnpm typecheck` and `pnpm lint` pass cleanly
5. Contract snapshot tests pass with committed snapshots

## What We're NOT Doing

- Adding `bulkLink` mutations for Linear/Sentry (they remain org-level connections)
- Modifying the OAuth callback flow (backfill stays out of callbacks)
- Adding UI elements for manual backfill triggering
- Changing the existing GitHub/Vercel `bulkLink` trigger behavior

## Implementation Approach

Work bottom-up: tests first (phases 1-2), then the feature change (phase 3), then verification (phases 4-5).

---

## Phase 1: Gateway Backfill Route Tests

### Overview
Add unit tests for `apps/gateway/src/routes/backfill.ts` following the established `webhooks.test.ts` pattern.

### Changes Required:

#### 1. New test file
**File**: `apps/gateway/src/routes/backfill.test.ts`
**Changes**: Create test file covering all paths through the backfill route

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──
const { mockPublishJSON, mockEnv } = vi.hoisted(() => {
  const env = {
    GATEWAY_API_KEY: "test-api-key",
    // add other required env keys if getEnv expects them
  };
  return {
    mockPublishJSON: vi.fn().mockResolvedValue({ messageId: "msg-1" }),
    mockEnv: env,
  };
});

vi.mock("../env", () => ({
  env: mockEnv,
  getEnv: () => mockEnv,
}));

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => ({ publishJSON: mockPublishJSON }),
}));

vi.mock("../lib/urls", () => ({
  backfillUrl: "https://backfill.test/api",
}));

// ── Import after mocks ──
import { Hono } from "hono";
import { backfill } from "./backfill.js";

const app = new Hono();
app.route("/api/backfill", backfill);

function request(
  path: string,
  init: { body?: string | Record<string, unknown>; headers?: Record<string, string> } = {},
) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const body = typeof init.body === "object" ? JSON.stringify(init.body) : init.body;
  return app.request(path, { method: "POST", headers, body });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPublishJSON.mockResolvedValue({ messageId: "msg-1" });
});

describe("POST /api/backfill", () => {
  // Auth tests
  it("returns 401 without X-API-Key", async () => { ... });
  it("returns 401 with wrong X-API-Key", async () => { ... });

  // Validation tests
  it("returns 400 for invalid JSON", async () => { ... });
  it("returns 400 when required fields missing", async () => { ... });
  it("returns 400 when installationId is empty", async () => { ... });

  // Success path
  it("forwards to QStash and returns queued status", async () => {
    const res = await request("/api/backfill", {
      body: { installationId: "inst-1", provider: "github", orgId: "org-1" },
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ status: "queued", installationId: "inst-1", provider: "github" });
    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: "https://backfill.test/api/trigger",
      headers: { "X-API-Key": "test-api-key" },
      body: { installationId: "inst-1", provider: "github", orgId: "org-1" },
      retries: 3,
      deduplicationId: "backfill:github:inst-1:org-1",
    });
  });

  // Optional fields
  it("forwards optional depth and entityTypes to QStash", async () => { ... });

  // Error path
  it("returns 502 when QStash publish fails", async () => {
    mockPublishJSON.mockRejectedValue(new Error("QStash down"));
    const res = await request("/api/backfill", {
      body: { installationId: "inst-1", provider: "github", orgId: "org-1" },
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "forward_failed" });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Tests pass: `pnpm --filter @lightfast/gateway test`
- [ ] All 7+ test cases cover: auth (2), validation (3), success (2), error (1)

---

## Phase 2: `notifyBackfill` Unit Tests

### Overview
Bootstrap vitest in `api/console` and add unit tests for the `notifyBackfill` function.

### Changes Required:

#### 1. Add vitest config
**File**: `api/console/vitest.config.ts`
**Changes**: Minimal vitest configuration

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

#### 2. Add test script to package.json
**File**: `api/console/package.json`
**Changes**: Add `"test": "vitest run"` to scripts

#### 3. Add vitest dev dependency
**File**: `api/console/package.json`
**Changes**: Add `"vitest": "catalog:"` to devDependencies

#### 4. New test file
**File**: `api/console/src/lib/backfill.test.ts`
**Changes**: Unit tests for `notifyBackfill`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { GATEWAY_API_KEY: "test-gw-key" },
}));

vi.mock("../env", () => ({ env: mockEnv }));

vi.mock("@vendor/related-projects", () => ({
  withRelatedProject: ({ defaultHost }: { defaultHost: string }) => defaultHost,
}));

// ── Import after mocks ──
import { notifyBackfill } from "./backfill.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

describe("notifyBackfill", () => {
  it("sends POST to gateway /api/backfill with correct headers and body", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    await notifyBackfill({ installationId: "inst-1", provider: "github", orgId: "org-1" });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/backfill"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-API-Key": "test-gw-key",
        }),
        body: JSON.stringify({ installationId: "inst-1", provider: "github", orgId: "org-1" }),
      }),
    );
  });

  it("does not throw when fetch returns non-ok response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 });
    await expect(notifyBackfill({ installationId: "inst-1", provider: "github", orgId: "org-1" })).resolves.toBeUndefined();
  });

  it("does not throw when fetch rejects (network error)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(notifyBackfill({ installationId: "inst-1", provider: "github", orgId: "org-1" })).resolves.toBeUndefined();
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Tests pass: `pnpm --filter @api/console test`
- [ ] All 3 test cases cover: success, non-ok response, network error

---

## Phase 3: Trigger Backfill on Workspace Creation

### Overview
Modify `workspace.create` to call `notifyBackfill` for every active `gwInstallation` in the org after a new workspace is created. This provides a uniform backfill trigger path for all 4 providers (GitHub, Vercel, Linear, Sentry).

### Changes Required:

#### 1. Modify workspace.create mutation
**File**: `api/console/src/router/org/workspace.ts`
**Changes**: After the workspace is created and activity is recorded (around line 283), query all active `gwInstallations` for the org and fire `notifyBackfill` for each.

```typescript
// After recordActivity (line 282) and before return (line 284):

// Trigger backfill for all active connections in this org (best-effort)
const activeInstallations = await db
  .select({ id: gwInstallations.id, provider: gwInstallations.provider })
  .from(gwInstallations)
  .where(
    and(
      eq(gwInstallations.orgId, input.clerkOrgId),
      eq(gwInstallations.status, "active"),
    ),
  );

for (const inst of activeInstallations) {
  void notifyBackfill({
    installationId: inst.id,
    provider: inst.provider,
    orgId: input.clerkOrgId,
  });
}
```

This requires adding `gwInstallations` to the imports at the top of the file (if not already imported — it IS already imported at line 5).

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Creating a new workspace with active connections triggers backfill calls (check gateway logs)
- [ ] Creating a workspace with no active connections works normally (no errors)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 4: Build Verification

### Overview
Run typecheck and lint across the full monorepo to confirm all changes compile cleanly.

### Changes Required:
No code changes — verification only.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

---

## Phase 5: Snapshot & Test Verification

### Overview
Run the contract snapshot tests to verify the manually-rewritten snapshot file matches what the tests produce.

### Changes Required:
If snapshots are stale, update them with `--update-snapshots`.

### Success Criteria:

#### Automated Verification:
- [ ] Contract snapshot tests pass: `pnpm --filter @repo/integration-tests test`
- [ ] If snapshots needed updating, the diff is reviewed and committed

---

## Testing Strategy

### Unit Tests (Phases 1-2):
- Gateway backfill route: auth rejection (missing/wrong key), validation (bad JSON, missing fields), QStash forwarding (correct URL, headers, dedup ID, optional fields), error handling (QStash failure → 502)
- `notifyBackfill`: success path (correct fetch call), non-ok response (no throw), network error (no throw)

### Integration Tests:
- Existing `connections-backfill-trigger.integration.test.ts` already covers the contract that OAuth callbacks do NOT trigger backfill
- The existing `bulkLink` integration tests validate GitHub/Vercel trigger paths
- New workspace creation backfill trigger is best verified manually or via a future integration test

### Manual Testing Steps:
1. Create a new workspace in an org with active Linear/Sentry connections
2. Check gateway logs for backfill trigger requests
3. Verify GitHub/Vercel `bulkLink` still triggers backfill as before (regression check)

## Performance Considerations

- `notifyBackfill` is fire-and-forget (`void`) with a 10s timeout — multiple calls in workspace.create won't block the response
- Each call has its own `AbortSignal.timeout(10_000)` so they won't accumulate
- QStash deduplication prevents duplicate backfill triggers if a user creates multiple workspaces rapidly

## References

- Gateway backfill route: `apps/gateway/src/routes/backfill.ts:1-62`
- notifyBackfill: `api/console/src/lib/backfill.ts:19-49`
- workspace.create: `api/console/src/router/org/workspace.ts:224-299`
- bulkLinkGitHubRepositories: `api/console/src/router/org/workspace.ts:1108-1251`
- bulkLinkVercelProjects: `api/console/src/router/org/workspace.ts:1259-1403`
- Gateway test pattern: `apps/gateway/src/routes/webhooks.test.ts`
- Contract snapshots: `packages/integration-tests/src/contract-snapshots.test.ts`
- Backfill trigger integration test: `packages/integration-tests/src/connections-backfill-trigger.integration.test.ts`
