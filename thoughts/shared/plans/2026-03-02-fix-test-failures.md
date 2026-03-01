# Fix Integration Test Failures — Implementation Plan

## Overview

11 integration tests in `@repo/integration-tests` are failing due to 4 distinct root causes. All are test-side fixes — the production code changes were intentional (API key scoping refactor, correlationId addition) but the integration tests were not updated to match.

## Current State Analysis

All 74/75 turbo tasks pass except `@repo/integration-tests#test` which has **11 failing tests** across 6 test files.

### Key Discoveries:
- Production code refactored API keys from workspace-scoped to org-scoped (commit `67f969b74`) — tests not updated
- `correlationId` field added to backfill cancel events via `requestId` middleware — tests assert exact `data` shape without accounting for it
- Sentry provider registration requires 3 env vars (`SENTRY_APP_SLUG`, `SENTRY_CLIENT_ID`, `SENTRY_CLIENT_SECRET`), only 1 is set in test `setup.ts`
- Gateway `lifecycle` middleware adds 100-499ms dev delay when `NODE_ENV !== "production"` — Vitest sets `NODE_ENV=test`

## Desired End State

All 106 integration tests pass (`pnpm test` exits 0). No production code changes — only test infrastructure and test assertions updated.

### Verification:
```bash
pnpm test  # 75/75 tasks pass, 106/106 integration tests pass
```

## What We're NOT Doing

- Changing any production code (routes, middleware, procedures)
- Adding new test suites
- Refactoring test infrastructure beyond what's needed to fix failures

## Implementation Approach

Fix each root cause independently. Changes are isolated to `packages/integration-tests/`.

---

## Phase 1: Fix Sentry Provider Registration (4 tests)

### Overview
Add missing `SENTRY_APP_SLUG` and `SENTRY_CLIENT_ID` env vars to test setup so the Sentry provider registers in the `providers` map and `getProvider("sentry")` stops throwing `HTTPException(400)`.

### Affected Tests:
- `backfill-connections-api.integration.test.ts` — "returns decrypted Sentry token from DB" (line 468)
- `backfill-connections-api.integration.test.ts` — "returns 404 for installation with no token stored" (line 504)
- `backfill-connections-api.integration.test.ts` — "fetches fresh token when connector throws 401" (line 509)
- `contract-snapshots.test.ts` — "Shape 2: GET /connections/:id/token response" (line 250)

### Changes Required:

#### 1. Add missing Sentry env vars
**File**: `packages/integration-tests/src/setup.ts`
**Changes**: Add `SENTRY_APP_SLUG` and `SENTRY_CLIENT_ID` alongside the existing `SENTRY_CLIENT_SECRET` (after line 27)

```typescript
process.env.SENTRY_APP_SLUG = "test-sentry-app";
process.env.SENTRY_CLIENT_ID = "test-sentry-client-id";
```

### Success Criteria:

#### Automated Verification:
- [ ] All Suite 3.3 tests pass
- [ ] Contract snapshot "Shape 2" passes
- [ ] Obsolete snapshot warning disappears

---

## Phase 2: Fix `correlationId` Assertions (3 tests)

### Overview
The `run.cancelled` event now includes a `correlationId` field from the `requestId` middleware. The test assertions use a plain object `{ installationId: "..." }` for the `data` field, which triggers strict deep-equality. Wrap the `data` value in `expect.objectContaining()` to allow extra fields.

### Affected Tests:
- `connections-backfill-trigger.integration.test.ts` — "captured cancel body delivered..." (line 266)
- `full-stack-connection-lifecycle.integration.test.ts` — "cancelBackfillService QStash..." (line 384)
- `full-stack-connection-lifecycle.integration.test.ts` — "DELETE connection → cancel backfill..." (line 503)

### Changes Required:

#### 1. Wrap data assertion with `expect.objectContaining`
**File**: `packages/integration-tests/src/connections-backfill-trigger.integration.test.ts`
**Line 269**: Change:
```typescript
data: { installationId: "inst-cancel-e2e" },
```
To:
```typescript
data: expect.objectContaining({ installationId: "inst-cancel-e2e" }),
```

#### 2. Same fix in full-stack lifecycle test (two locations)
**File**: `packages/integration-tests/src/full-stack-connection-lifecycle.integration.test.ts`
**Line 387**: Change:
```typescript
data: { installationId: "inst-lifecycle-cancel" },
```
To:
```typescript
data: expect.objectContaining({ installationId: "inst-lifecycle-cancel" }),
```

**Line 506**: Change:
```typescript
data: { installationId: inst.id },
```
To:
```typescript
data: expect.objectContaining({ installationId: inst.id }),
```

### Success Criteria:

#### Automated Verification:
- [ ] Suite 2.3 passes
- [ ] Suite 5.2 passes
- [ ] Suite 5.3 passes

---

## Phase 3: Fix API Key / tRPC Connection Tests (3 tests)

### Overview
The `apiKeyProcedure` was refactored from workspace-scoped to org-scoped (commit `67f969b74`). Three tests reference old behavior:
1. Test for `X-Workspace-ID` missing → `BAD_REQUEST` — this guard no longer exists
2. Test for "workspace not found" → `NOT_FOUND` — workspace lookup removed; test lacks `installServiceRouter`
3. Happy path uses different `clerkOrgId` for workspace vs API key

### Changes Required:

#### 1. Update "No X-Workspace-ID" test
**File**: `packages/integration-tests/src/api-console-connections.integration.test.ts`
**Lines 353-361**: The `X-Workspace-ID` guard was removed. Without a valid API key in the DB, `verifyApiKey` throws UNAUTHORIZED.

Change to:
```typescript
it("Bearer token with no matching API key → throws UNAUTHORIZED", async () => {
  const caller = makeCaller(
    { type: "unauthenticated" },
    new Headers({ Authorization: "Bearer sk-lf-testkey" }),
  );
  await expect(
    caller.cliAuthorize({ provider: "github" }),
  ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});
```

#### 2. Update "Workspace not found" test
**File**: `packages/integration-tests/src/api-console-connections.integration.test.ts`
**Lines 414-423**: The workspace lookup was removed from `cliAuthorize`. Now uses `ctx.auth.orgId` directly from the API key. Install service router so fetch succeeds.

Change to:
```typescript
it("Valid API key → cliAuthorize succeeds (org-scoped, no workspace lookup)", async () => {
  const { rawKey } = await makeApiKeyFixture(db, {
    userId: "user_no_ws",
  });
  const restore = installServiceRouter({ connectionsApp });
  try {
    const caller = apiKeyCaller(rawKey, "ignored-workspace-id");
    const result = await caller.cliAuthorize({ provider: "github" });
    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("state");
  } finally {
    restore();
  }
});
```

#### 3. Fix Happy Path orgId mismatch
**File**: `packages/integration-tests/src/api-console-connections.integration.test.ts`
**Line 491**: Pass the workspace's `clerkOrgId` to `makeApiKeyFixture` so the API key and workspace share the same org:

Change:
```typescript
const { rawKey, userId } = await makeApiKeyFixture(db, {
  userId: "user_happy",
});
```
To:
```typescript
const { rawKey, userId } = await makeApiKeyFixture(db, {
  userId: "user_happy",
  clerkOrgId,
});
```

### Success Criteria:

#### Automated Verification:
- [ ] All Suite 8 tests pass

---

## Phase 4: Fix Gateway Timeout (1 test)

### Overview
Gateway `lifecycle` middleware (`apps/gateway/src/middleware/lifecycle.ts:5`) evaluates `isDev = env.NODE_ENV !== "production"` at module load. Vitest sets `NODE_ENV=test`, so `isDev=true`, adding 100-499ms delay per request. Suite 6.2 makes 18 requests — cumulative delay averages ~5400ms, exceeding the 5000ms timeout.

### Changes Required:

**File**: `packages/integration-tests/src/setup.ts`
**Changes**: Set `NODE_ENV=production` before any gateway modules load (at top of file):

```typescript
process.env.NODE_ENV = "production";
```

This eliminates the artificial delay. The `isDev` flag also controls log format (human-readable vs JSON) — tests don't inspect log output so this is safe.

### Success Criteria:

#### Automated Verification:
- [ ] Suite 6.2 passes within 5s

---

## Final Verification

### Automated:
```bash
pnpm test  # All 75 tasks pass, 106/106 integration tests pass
```

If the contract snapshot is stale after Phase 1 fix:
```bash
pnpm --filter @repo/integration-tests test -- -u  # Update snapshots
```

## Summary of Changes

| File | Change | Tests Fixed |
|---|---|---|
| `setup.ts` | Add `SENTRY_APP_SLUG`, `SENTRY_CLIENT_ID`, set `NODE_ENV=production` | 5 |
| `connections-backfill-trigger.integration.test.ts:269` | Wrap `data` in `expect.objectContaining()` | 1 |
| `full-stack-connection-lifecycle.integration.test.ts:387,506` | Wrap `data` in `expect.objectContaining()` | 2 |
| `api-console-connections.integration.test.ts:353-361` | Update test name + expected code to UNAUTHORIZED | 1 |
| `api-console-connections.integration.test.ts:414-423` | Rewrite for org-scoped behavior + install service router | 1 |
| `api-console-connections.integration.test.ts:491` | Pass `clerkOrgId` to `makeApiKeyFixture` | 1 |

**Total: 11 tests fixed across 4 files**
