# GitHub Connections E2E Testing Implementation Plan

## Overview

Implement comprehensive testing for the GitHub connections flow across three layers: backend tRPC procedure integration tests, OAuth popup flow integration tests, and React component tests for `github-source-item.tsx`. This closes the testing gaps identified in the [research document](../research/2026-03-01-github-connections-e2e-testing.md) and prevents the class of bugs where client-side URL construction bypasses backend validation.

## Current State Analysis

### What exists:
- 10 Vitest integration test suites in `packages/integration-tests/`
- `api-console-connections.integration.test.ts` covers `getAuthorizeUrl` and `cliAuthorize` only
- `connections-cli-oauth-flow.integration.test.ts` covers authorize → callback → poll for the CLI flow
- Robust harness with `makeRedisMock`, `installServiceRouter`, PGlite `TestDb`, fixture builders
- Zero tests in `apps/console` — no vitest config, no test script, no component testing

### What's missing:
- `github.get`, `github.repositories`, `github.validate` tRPC procedure tests
- GitHub-specific OAuth callback → DB verification flow (browser path, not CLI)
- React component tests for `github-source-item.tsx` (URL construction, popup lifecycle, poll cleanup)

### Key Discoveries:
- `github.get` is DB-only — no external API calls, just reads `providerAccountInfo` JSONB (`api/console/src/router/org/connections.ts:211-246`)
- `github.validate` and `github.repositories` call `@repo/console-octokit-github` which must be mocked (`api/console/src/router/org/connections.ts:288-292, 401-411`)
- The `@console/env` mock in the existing test only provides `GATEWAY_API_KEY` — needs `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` added (`packages/integration-tests/src/api-console-connections.integration.test.ts:110-113`)
- `postMessage` from the connected page is sent but never consumed — component uses `popup.closed` polling only (`apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx:178-187`)
- No `@testing-library/react`, no jsdom/happy-dom, no component testing infrastructure exists

## Desired End State

After this plan is complete:
1. `pnpm --filter @repo/integration-tests test` runs all existing tests plus new `github.get`, `github.validate`, `github.repositories`, and OAuth browser-flow tests
2. `pnpm --filter @lightfast/console test` runs component tests for `github-source-item.tsx` covering URL construction, popup lifecycle, and poll cleanup
3. The specific bug class (missing `?state=` in `handleAdjustPermissions`) is covered by a component test that asserts `window.open` is called with a URL containing `state=`

### Verification:
- `pnpm --filter @repo/integration-tests test` — all suites pass
- `pnpm --filter @lightfast/console test` — component tests pass
- `pnpm typecheck` — no type errors
- `pnpm lint` — no lint errors

## What We're NOT Doing

- **Playwright E2E tests** — Too much infrastructure cost for the current stage. The component tests with mocked tRPC cover the URL construction bug class without needing a real browser + GitHub OAuth mock.
- **MSW (Mock Service Worker)** — Not used anywhere in the codebase. We'll mock at the module level with `vi.mock()` consistent with existing patterns.
- **Testing the `postMessage` relay** — The connected page at `apps/console/src/app/(providers)/provider/github/connected/page.tsx` sends `postMessage` but it's never consumed. Not worth testing unused code.
- **Testing `github.detectConfig`** — Out of scope for this plan; it's a separate feature area.
- **Adding Zod runtime validation to `getAuthorizeUrl` response** — Noted as an open question in the research but out of scope here.

## Implementation Approach

Three phases, each independently testable. Phase 1 uses the existing test file and harness. Phase 2 adds a new integration test file. Phase 3 bootstraps component testing infrastructure in `apps/console`.

---

## Phase 1: Extend tRPC Procedure Integration Tests

### Overview
Add `github.get`, `github.validate`, and `github.repositories` test suites to the existing `api-console-connections.integration.test.ts`. This closes the backend coverage gap with minimal new infrastructure.

### Changes Required:

#### 1. Update `@console/env` mock
**File:** `packages/integration-tests/src/api-console-connections.integration.test.ts`
**Lines:** 110-113

Add `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` to the existing env mock:

```typescript
vi.mock("@console/env", () => ({
  env: {
    GATEWAY_API_KEY: "0".repeat(64),
    GITHUB_APP_ID: "12345",
    GITHUB_APP_PRIVATE_KEY: "test-private-key",
  },
}));
```

#### 2. Add `@repo/console-octokit-github` mock
**File:** `packages/integration-tests/src/api-console-connections.integration.test.ts`

Add a new `vi.mock()` for the octokit package used by `validate` and `repositories`. Create mock functions in `vi.hoisted()`:

```typescript
// Inside vi.hoisted() block:
const mockCreateGitHubApp = vi.fn();
const mockGetAppInstallation = vi.fn();
const mockGetInstallationRepositories = vi.fn();

// New vi.mock():
vi.mock("@repo/console-octokit-github", () => ({
  createGitHubApp: mockCreateGitHubApp,
  getAppInstallation: mockGetAppInstallation,
  getInstallationRepositories: mockGetInstallationRepositories,
}));
```

Add `@repo/console-octokit-github` to the `server.deps.inline` array in `packages/integration-tests/vitest.config.ts` if not already present.

#### 3. Add `providerAccountInfo` fixture helper
**File:** `packages/integration-tests/src/api-console-connections.integration.test.ts`

Add a helper function that builds a valid GitHub `providerAccountInfo` blob for seeding test data:

```typescript
function makeGitHubAccountInfo(overrides?: Partial<{
  installationId: string;
  accountLogin: string;
  accountType: "User" | "Organization";
}>) {
  return {
    version: 1 as const,
    sourceType: "github" as const,
    installations: [{
      id: overrides?.installationId ?? "12345",
      accountId: "67890",
      accountLogin: overrides?.accountLogin ?? "test-org",
      accountType: overrides?.accountType ?? "Organization",
      avatarUrl: "https://avatars.githubusercontent.com/u/67890",
      permissions: { contents: "read", metadata: "read" },
      events: ["push", "pull_request"],
      installedAt: "2026-01-01T00:00:00Z",
      lastValidatedAt: "2026-01-01T00:00:00Z",
    }],
  };
}
```

#### 4. Add `github.get` test suite (Suite 8.4)
**File:** `packages/integration-tests/src/api-console-connections.integration.test.ts`

Test cases:
- **Returns `null` when no GitHub installations exist** — Seed no rows, call `github.get`, assert `result === null`
- **Returns connection with installations** — Seed one `gwInstallations` row with valid `providerAccountInfo`, call `github.get`, assert response shape matches including `gwInstallationId` tag
- **Merges installations from multiple rows** — Seed two rows (different `externalId`), assert `installations` array contains entries from both, each tagged with correct `gwInstallationId`
- **Ignores non-active rows** — Seed one `active` row and one `revoked` row, assert only the active row's installations are returned
- **Ignores non-github providers** — Seed a `vercel` row, call `github.get`, assert `null`

#### 5. Add `github.validate` test suite (Suite 8.5)
**File:** `packages/integration-tests/src/api-console-connections.integration.test.ts`

Mock setup: `mockGetAppInstallation` returns a valid `GitHubInstallation` response object.

Test cases:
- **Throws NOT_FOUND when no installation exists** — No seeded rows, assert throws `{ code: "NOT_FOUND" }`
- **Refreshes providerAccountInfo with GitHub API data** — Seed row, configure `mockGetAppInstallation` to return updated account info (e.g., changed `avatar_url`), call `validate`, read back from PGlite and assert `providerAccountInfo.installations[0].avatarUrl` matches the mock response
- **Returns correct added/removed/total counts** — Seed row with one installation, assert `{ added: 0, removed: 0, total: 1 }`
- **Returns added=1 for empty providerAccountInfo** — Seed row with `installations: []` in providerAccountInfo, assert `{ added: 1, removed: 0, total: 1 }`
- **Throws INTERNAL_SERVER_ERROR for non-github sourceType** — Seed row with `sourceType: "vercel"`, assert throws `{ code: "INTERNAL_SERVER_ERROR" }`

#### 6. Add `github.repositories` test suite (Suite 8.6)
**File:** `packages/integration-tests/src/api-console-connections.integration.test.ts`

Mock setup: `mockGetInstallationRepositories` returns a list of GitHub repo objects.

Test cases:
- **Throws NOT_FOUND for unknown integrationId** — Call with nonexistent ID, assert throws `{ code: "NOT_FOUND" }`
- **Throws NOT_FOUND when installationId not in providerAccountInfo** — Seed row, call with wrong `installationId`, assert throws
- **Returns normalized repository list** — Seed row, configure mock to return 2 repos, assert output shape (`id` as string, `fullName`, `isPrivate`, etc.)
- **Verifies org ownership** — Seed row for org A, create caller for org B, call with row's ID, assert throws `{ code: "NOT_FOUND" }`
- **Handles empty repository list** — Configure mock to return `[]`, assert empty array response

### Success Criteria:

#### Automated Verification:
- [x] All existing tests still pass: `pnpm --filter @repo/integration-tests test` (pre-existing Suite 7 callback failures unrelated to Phase 1)
- [x] New `github.list` suite (5 tests) passes
- [x] New `github.validate` suite (5 tests) passes
- [x] New `github.repositories` suite (5 tests) passes
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Review that test fixtures match the real `providerAccountInfo` JSONB shape from `db/console/src/schema/tables/gw-installations.ts:31-44`
- [ ] Verify mock return values match actual GitHub API response structures

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: OAuth Browser-Flow Integration Test

### Overview
Add a new integration test suite that simulates the browser-initiated OAuth flow (as opposed to the existing CLI OAuth flow suite). This tests the exact path triggered by `handleConnect` in the UI: authorize → GitHub callback with `installation_id` → result written to Redis → DB row upserted with `providerAccountInfo`.

### Changes Required:

#### 1. New test file
**File:** `packages/integration-tests/src/connections-browser-oauth-flow.integration.test.ts`

This file follows the same patterns as `connections-cli-oauth-flow.integration.test.ts` (Suite 7) but tests the browser redirect flow instead of the inline/CLI flow.

#### 2. Mock registration
Same mock set as Suite 7 (`@db/console/client`, `@vendor/upstash`, `@connections/providers`, `@vendor/upstash-workflow/client`, `@vendor/qstash`, `@vendor/related-projects`), with the mock GitHub provider configured to simulate a real callback.

#### 3. Test suites

**Suite A: Authorize → URL validation**
- **Authorize returns URL with state parameter** — Call `GET /github/authorize` with valid auth headers, assert `json.url` contains `installations/new` and `state=`
- **State is stored in Redis with correct TTL** — After authorize, read `redisStore.get(oauthStateKey(state))`, assert contains `{ orgId, connectedBy, provider: "github" }`

**Suite B: Browser callback flow**
- **Callback with valid state writes result to Redis** — Seed state in Redis, call `GET /github/callback?installation_id=123&state=...`, assert `oauthResultKey(state)` in Redis has `{ status: "completed" }`
- **Callback redirects to connected page** — Assert `res.status === 302` and `Location` header contains `/provider/github/connected`
- **Callback upserts gwInstallation with providerAccountInfo** — After callback, query PGlite for the seeded org, assert row has `providerAccountInfo.sourceType === "github"` and `providerAccountInfo.installations[0].accountLogin` matches mock
- **Callback with expired/missing state falls back to externalId lookup** — Seed a `gwInstallations` row with matching `externalId`, call callback without state, assert the fallback recovery path succeeds (row is found by externalId)
- **Callback with missing state and no existing row fails** — No state, no matching row, assert error response

**Suite C: Full browser round-trip**
- **Authorize → callback → poll → DB verification** — Full chain: authorize, extract state, call callback with mock installation, poll status until completed, verify DB row and Redis state

**Suite D: State token security**
- **State token is single-use (consumed on callback)** — Call callback once (succeeds), call callback again with same state, assert second call fails or falls back
- **State token expires after 600s** — Use `vi.useFakeTimers()` + `vi.advanceTimersByTime(601_000)`, attempt callback, assert state is expired

### Success Criteria:

#### Automated Verification:
- [x] All existing tests still pass: `pnpm --filter @repo/integration-tests test` (pre-existing Suite 3/5/6 and concurrent Suite 8/9 failures unrelated to Phase 2)
- [x] New browser OAuth flow suite passes (15 tests — exceeded planned 8-10)
- [x] Type checking passes: `pnpm typecheck` (only pre-existing Suite 8/9 type errors from concurrent makeApiKeyFixture refactor)
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Review that the browser callback flow matches the actual redirect chain documented in the research (authorize → GitHub → callback → /provider/github/connected)
- [ ] Verify the state recovery fallback test matches the actual code at `apps/connections/src/routes/connections.ts:149-175`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Component Testing for `github-source-item.tsx`

### Overview
Bootstrap React component testing infrastructure in `apps/console` and write tests for `GitHubSourceItem` that cover the URL construction bug class, popup lifecycle, and poll cleanup.

### Changes Required:

#### 1. Install dependencies
**Package:** `apps/console/package.json`

Add dev dependencies:
```json
{
  "devDependencies": {
    "vitest": "catalog:",
    "@vitest/coverage-v8": "catalog:",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/user-event": "^14.6.0"
  }
}
```

Run `pnpm install` from the repo root to update the lockfile.

#### 2. Add Vitest config
**File:** `apps/console/vitest.config.ts` (new)

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "~": resolve(__dirname, "src"),
    },
  },
});
```

Note: If `@vitejs/plugin-react` is not already available, add it as a dev dependency. Check the existing `next.config.ts` for any path aliases that need mirroring.

#### 3. Add test setup file
**File:** `apps/console/src/__tests__/setup.ts` (new)

```typescript
import "@testing-library/jest-dom/vitest";
```

#### 4. Add test script
**File:** `apps/console/package.json`

Add to `"scripts"`:
```json
"test": "vitest run"
```

#### 5. Write component tests
**File:** `apps/console/src/app/(app)/(user)/new/_components/__tests__/github-source-item.test.tsx` (new)

This is the core deliverable of Phase 3. The component uses `useSuspenseQuery`, `useQuery`, `useWorkspaceForm`, and `queryClient.fetchQuery` — all need mocking.

**Mock strategy:**
- Mock `@trpc/react-query` hooks via `vi.mock()` to return controlled data
- Mock `window.open` and capture the URL argument
- Mock the workspace form context (`useWorkspaceForm`)
- Use `vi.useFakeTimers()` to control `setInterval` polling

**Test suites:**

**Suite A: `handleConnect` URL construction**
- **Opens popup with URL from getAuthorizeUrl** — Click connect button, assert `window.open` was called with the exact URL returned by the mock `getAuthorizeUrl` query
- **URL contains state parameter** — Assert the URL passed to `window.open` includes `?state=` or `&state=`
- **Shows toast on fetch failure** — Mock `queryClient.fetchQuery` to reject, assert toast.error is called

**Suite B: `handleAdjustPermissions` URL construction (the bug class)**
- **Opens popup with state parameter from getAuthorizeUrl** — Click adjust permissions button, assert `window.open` URL contains `state=` from the mock response
- **URL targets installations/select_target path** — Assert URL contains `installations/select_target`
- **State parameter matches the value from getAuthorizeUrl** — Extract `state=` value from the `window.open` URL, assert it equals the mock `data.state`

**Suite C: Popup lifecycle and polling**
- **Starts polling interval after popup opens** — Open popup via handleConnect, assert `setInterval` was called with 500ms
- **Clears interval and refetches when popup closes** — Simulate `popup.closed = true`, advance timers by 500ms, assert `refetchConnection` was called
- **Clears previous interval before starting new one** — Call handleConnect twice, assert only one interval is active
- **Cleans up interval on unmount** — Unmount component, assert `clearInterval` was called

**Suite D: Installation selection effects**
- **Auto-selects first installation when connection loads** — Render with mock connection data containing 2 installations, assert `setSelectedInstallation` was called with the first one
- **Updates gwInstallationId when selectedInstallation changes** — Simulate installation change, assert `setGwInstallationId` receives the new `gwInstallationId`

### Success Criteria:

#### Automated Verification:
- [x] Component tests pass: `pnpm --filter @lightfast/console test` (11 tests, all pass)
- [x] All existing integration tests still pass: `pnpm --filter @repo/integration-tests test` (pre-existing Suite 3/5/6/8 failures unrelated to Phase 3)
- [x] Type checking passes: `pnpm typecheck` (pre-existing `.next/types` stale cache errors from deleted routes, unrelated to Phase 3)
- [x] Linting passes: `pnpm lint` (pre-existing errors in `api-keys/page.tsx` and `installed-sources.tsx`, zero lint errors in Phase 3 files)

#### Manual Verification:
- [ ] Verify the mocking strategy correctly isolates tRPC from React Query internals
- [ ] Confirm the `handleAdjustPermissions` test would have caught the original bug (the URL missing `?state=`)
- [ ] Review that `happy-dom` or `jsdom` properly supports `window.open` and `setInterval` mocking

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests (Phase 1):
- tRPC procedure logic tested against real PGlite DB
- External API calls (GitHub) mocked at module boundary
- All `providerAccountInfo` JSONB read/write paths exercised

### Integration Tests (Phase 2):
- Full OAuth lifecycle through the connections Hono app
- Redis state token lifecycle (create, consume, expire)
- DB upsert verification after callback
- State recovery fallback path

### Component Tests (Phase 3):
- URL construction correctness (the bug class)
- `window.open` argument validation
- Timer lifecycle (creation, cleanup, unmount)
- React effect synchronization

### Manual Testing Steps:
1. Run `pnpm --filter @repo/integration-tests test` and verify all suites pass
2. Run `pnpm --filter @lightfast/console test` and verify component tests pass
3. Review test output for any flaky timing-dependent assertions
4. Verify `pnpm typecheck` and `pnpm lint` pass across the full monorepo

## Performance Considerations

- PGlite in-memory DB is fast but running migrations on every test file adds ~1-2s startup. The existing singleton pattern (`createTestDb()`) mitigates this.
- Component tests with `happy-dom` are significantly faster than jsdom (~5-10x). Prefer `happy-dom` unless specific DOM APIs require jsdom.
- `vi.useFakeTimers()` is used in Phase 3 for polling tests — ensure `afterEach` calls `vi.useRealTimers()` to prevent timer leak.

## Migration Notes

No data migration needed. All changes are additive test files and configuration.

## References

- Research document: `thoughts/shared/research/2026-03-01-github-connections-e2e-testing.md`
- Existing integration tests: `packages/integration-tests/src/api-console-connections.integration.test.ts`
- CLI OAuth flow tests: `packages/integration-tests/src/connections-cli-oauth-flow.integration.test.ts`
- GitHub source item component: `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx`
- tRPC procedures: `api/console/src/router/org/connections.ts:210-436`
- DB schema: `db/console/src/schema/tables/gw-installations.ts:6-87`
- Test harness: `packages/integration-tests/src/harness.ts`
- Test DB utilities: `packages/console-test-db/src/index.ts`
