# Fix GitHub Installation Account Info

## Overview

GitHub installation `providerAccountInfo` is being stored with incorrect data (`accountType: "User"` instead of `"Organization"`, `accountLogin: "unknown"`, empty `avatarUrl`, empty `permissions`). The root cause is a combination of stale code that relied on `stateData` defaults instead of GitHub API data, a silently swallowed API failure, and a broken `validate` mutation that can never work for GitHub (no stored user token). This plan fixes all three issues to ensure GitHub installation metadata is always correct and refreshable.

## Current State Analysis

### Data Written by Old Code
```json
{
  "version": 1,
  "sourceType": "github",
  "installations": [{
    "id": "113037688",
    "accountId": "113037688",
    "avatarUrl": "",
    "accountType": "User",
    "installedAt": "2026-02-28T05:48:15.421Z",
    "permissions": {},
    "accountLogin": "unknown",
    "lastValidatedAt": "2026-02-28T05:48:15.421Z"
  }]
}
```

### Three Root Causes

1. **`getInstallationDetails` failure silently swallowed** (`apps/connections/src/providers/impl/github.ts:142-146`):
   - The App JWT → `GET /app/installations/{id}` call is wrapped in a try/catch
   - On failure, `installationDetails = null` and callback proceeds with broken fallback data
   - The old `buildAccountInfo` used `stateData` defaults (`"unknown"` / `"User"`) since no API data was available

2. **`validate` mutation broken for GitHub** (`api/console/src/router/org/connections.ts:277`):
   - Calls `getInstallationToken(installation.id)` from `token-vault.ts` which reads stored token from `gw_tokens`
   - GitHub's `handleCallback` **never stores** an OAuth token in `gw_tokens` — GitHub uses JWT-based installation tokens
   - `getUserInstallations(accessToken)` requires a **user** OAuth token, not an installation token
   - Result: validate always throws `"No token found for installation: ..."`

3. **Tests are stale** (`apps/connections/src/providers/impl/github.test.ts`):
   - Tests expect old OAuth flow (`/login/oauth/authorize`) but current code uses App Installation flow
   - Tests expect old fallback defaults (`"unknown"`, `"User"`) but current code has different fallbacks
   - `getInstallationDetails` is not mocked in tests (it's undefined in the mocked module)

### Key Discoveries:
- `buildAccountInfo` (`github.ts:224-249`) was refactored to use `apiData` from GitHub API, but the old `stateData`-based defaults are what wrote the user's data
- `connections.ts:55`: `connectedBy = c.req.header("X-User-Id") ?? "unknown"` — the `"unknown"` string propagated through the old code path
- The `getAuthorizationUrl` method was changed from OAuth URL to App installation URL, but tests still assert the old OAuth URL
- GitHub App `request_oauth_on_install` is **not enabled** — no `code` param is available during callback
- `events` field is missing from the DB data but current `buildAccountInfo` always includes it — confirming old code wrote this data

## Desired End State

After this plan is complete:

1. **GitHub installation callback always stores correct account data** from the GitHub API — `accountType`, `accountLogin`, `avatarUrl`, `permissions`, and `events` accurately reflect the GitHub account the app was installed on
2. **If the GitHub API call fails, the callback hard-fails** — no garbage data is stored, user sees an error and can retry
3. **The `validate` mutation works for GitHub** — uses App JWT to call `GET /app/installations/{id}` (not broken user token path)
4. **Tests accurately reflect the current App Installation flow** — all stale tests updated
5. **Existing bad data can be fixed** by calling the `validate` mutation

### Verification:
- Install GitHub App on an organization → `providerAccountInfo` has correct `accountType: "Organization"`, `accountLogin: "<org-name>"`, `avatarUrl`, `permissions`, `events`
- Call `connections.github.validate` → installation data is refreshed from GitHub API
- If `getInstallationDetails` fails → callback returns an error, no row is upserted

## What We're NOT Doing

- **Not enabling `request_oauth_on_install`** on the GitHub App — no OAuth code exchange, no stored user token
- **Not adding multi-installation discovery** — each `gwInstallation` row maps 1:1 with a GitHub App installation; `validate` refreshes the known installation only
- **Not migrating existing bad data** — the `validate` mutation can fix it on demand; no DB migration needed
- **Not refactoring the `buildAccountInfo` stateData fallback pattern** — we're making `apiData` required (non-null) since we hard-fail on API failure

## Implementation Approach

Since `request_oauth_on_install` is disabled, there's no user OAuth token. All GitHub API calls use the App JWT exclusively. The `validate` mutation needs to use the App JWT (via Octokit) instead of attempting to read a non-existent user token.

## Phase 1: Fix `handleCallback` — Hard Fail on API Failure

### Overview
Remove the try/catch that silently swallows `getInstallationDetails` failures. If we can't get account data from GitHub, don't store garbage — let the callback fail so the user can retry.

### Changes Required:

#### 1. Remove silent error swallowing in handleCallback
**File**: `apps/connections/src/providers/impl/github.ts`
**Changes**: Remove try/catch around `getInstallationDetails`, make `apiData` required in `buildAccountInfo`

```typescript
// BEFORE (lines 141-152):
let installationDetails: GitHubInstallationDetails | null = null;
try {
  installationDetails = await getInstallationDetails(installationId);
} catch (err) {
  console.error(`[github] Failed to fetch installation details for ${installationId}:`, err);
}

const accountInfo = this.buildAccountInfo(
  { ...stateData, installationId },
  undefined,
  installationDetails,
);

// AFTER:
const installationDetails = await getInstallationDetails(installationId);

const accountInfo = this.buildAccountInfo(installationDetails);
```

#### 2. Simplify `buildAccountInfo` — require API data, remove stale fallbacks
**File**: `apps/connections/src/providers/impl/github.ts`
**Changes**: `buildAccountInfo` takes `GitHubInstallationDetails` directly (not optional), no fallbacks needed

```typescript
// BEFORE (lines 224-249):
buildAccountInfo(
  stateData: Record<string, string>,
  _oauthTokens?: OAuthTokens,
  apiData?: GitHubInstallationDetails | null,
): GwInstallation["providerAccountInfo"] {
  const id = stateData.installationId ?? "";
  const now = new Date().toISOString();
  return {
    version: 1,
    sourceType: "github",
    installations: [{
      id,
      accountId: apiData?.account.id.toString() ?? id,
      accountLogin: apiData?.account.login ?? "",
      accountType: apiData?.account.type ?? "Organization",
      avatarUrl: apiData?.account.avatar_url ?? "",
      permissions: apiData?.permissions ?? {},
      events: apiData?.events ?? [],
      installedAt: apiData?.created_at ?? now,
      lastValidatedAt: now,
    }],
  };
}

// AFTER:
buildAccountInfo(
  installationId: string,
  apiData: GitHubInstallationDetails,
): GwInstallation["providerAccountInfo"] {
  return {
    version: 1,
    sourceType: "github",
    installations: [{
      id: installationId,
      accountId: apiData.account.id.toString(),
      accountLogin: apiData.account.login,
      accountType: apiData.account.type,
      avatarUrl: apiData.account.avatar_url,
      permissions: apiData.permissions,
      events: apiData.events,
      installedAt: apiData.created_at,
      lastValidatedAt: new Date().toISOString(),
    }],
  };
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Unit tests pass: `pnpm --filter ./apps/connections test` (after Phase 3 test updates)

#### Manual Verification:
- [ ] Install GitHub App on a test org → `providerAccountInfo` has correct `accountType: "Organization"`, `accountLogin`, `avatarUrl`, `permissions`, `events`
- [ ] Temporarily break `GITHUB_APP_PRIVATE_KEY` → callback returns an error (does NOT store garbage data)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Add `getAppInstallation` to Shared Package

### Overview
Add a function to `@repo/console-octokit-github` that fetches installation details using the Octokit App instance. This enables the `validate` mutation in `api/console` to call the GitHub API without raw fetch/JWT logic.

### Changes Required:

#### 1. Add `getAppInstallation` function
**File**: `packages/console-octokit-github/src/index.ts`
**Changes**: Add new exported function that fetches a single GitHub App installation's details

```typescript
/**
 * Get a GitHub App installation's details (account, permissions, events)
 *
 * Uses the App-level JWT to call GET /app/installations/{id}.
 * Returns the full installation object including account login, type, and avatar.
 *
 * @param app - GitHub App instance
 * @param installationId - The GitHub App installation ID (numeric)
 * @returns Installation details including account info
 */
export async function getAppInstallation(
  app: App,
  installationId: number,
): Promise<GitHubInstallation> {
  const { data } = await app.octokit.request(
    "GET /app/installations/{installation_id}",
    {
      installation_id: installationId,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  return data;
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] None required — this is a pure utility function, tested via Phase 3

---

## Phase 3: Fix `validate` Mutation — Use App JWT

### Overview
The `validate` mutation currently tries to read a stored user token from `gw_tokens` (which doesn't exist for GitHub) and call `getUserInstallations`. Fix it to use the App JWT via `getAppInstallation` to refresh the known installation's account data.

### Changes Required:

#### 1. Rewrite `github.validate` mutation
**File**: `api/console/src/router/org/connections.ts`
**Changes**: Replace `getUserInstallations` flow with `getAppInstallation` using App JWT

```typescript
// BEFORE (lines 253-353):
validate: orgScopedProcedure.mutation(async ({ ctx }) => {
  // ... finds installation ...
  const accessToken = await getInstallationToken(installation.id); // FAILS: no stored token
  const { installations: githubInstallations } = await getUserInstallations(accessToken); // needs user token
  // ... maps and replaces all installations ...
});

// AFTER:
validate: orgScopedProcedure.mutation(async ({ ctx }) => {
  const result = await ctx.db
    .select()
    .from(gwInstallations)
    .where(
      and(
        eq(gwInstallations.orgId, ctx.auth.orgId),
        eq(gwInstallations.provider, "github"),
        eq(gwInstallations.status, "active"),
      ),
    )
    .limit(1);

  const installation = result[0];
  if (!installation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "GitHub integration not found. Please connect GitHub first.",
    });
  }

  const providerAccountInfo = installation.providerAccountInfo;
  if (providerAccountInfo?.sourceType !== "github") {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Invalid provider data type",
    });
  }

  try {
    const app = getGitHubApp();
    const installationIdNumber = Number.parseInt(installation.externalId, 10);

    // Fetch fresh installation details using App JWT
    const githubInstallation = await getAppInstallation(app, installationIdNumber);

    const account = githubInstallation.account;
    if (!account || !("login" in account)) {
      throw new Error("Installation response missing account data");
    }

    const now = new Date().toISOString();
    const refreshedInstallation = {
      id: installation.externalId,
      accountId: account.id.toString(),
      accountLogin: "login" in account ? (account.login ?? "") : "",
      accountType: ("type" in account && account.type === "User" ? "User" : "Organization") as "User" | "Organization",
      avatarUrl: "avatar_url" in account ? (account.avatar_url ?? "") : "",
      permissions: (githubInstallation.permissions as Record<string, string>),
      events: (githubInstallation.events as string[]) ?? [],
      installedAt: githubInstallation.created_at,
      lastValidatedAt: now,
    };

    const currentInstallations = providerAccountInfo.installations ?? [];
    const hadInstallation = currentInstallations.some(
      (i) => i.id === installation.externalId,
    );

    // Update providerAccountInfo with refreshed data
    await ctx.db
      .update(gwInstallations)
      .set({
        providerAccountInfo: {
          version: 1 as const,
          sourceType: "github" as const,
          installations: [refreshedInstallation],
        },
        updatedAt: now,
      })
      .where(eq(gwInstallations.id, installation.id));

    return {
      added: hadInstallation ? 0 : 1,
      removed: Math.max(0, currentInstallations.length - 1),
      total: 1,
    };
  } catch (error: unknown) {
    console.error("[tRPC connections.github.validate] GitHub installation validation failed:", error);

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to validate GitHub installation",
      cause: error,
    });
  }
}),
```

#### 2. Update imports
**File**: `api/console/src/router/org/connections.ts`
**Changes**: Add `getAppInstallation` import, remove unused `getUserInstallations` import

```typescript
// BEFORE:
import {
  getUserInstallations,
  createGitHubApp,
  getInstallationRepositories,
} from "@repo/console-octokit-github";
import { getInstallationToken } from "../../lib/token-vault";

// AFTER:
import {
  createGitHubApp,
  getInstallationRepositories,
  getAppInstallation,
} from "@repo/console-octokit-github";
```

Note: `getInstallationToken` import should be kept if it's used elsewhere in the file (e.g., by Vercel operations). Only remove `getUserInstallations` if it's only used in the github.validate mutation.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] With an existing installation that has bad data (`accountLogin: "unknown"`) → call `connections.github.validate` → data is refreshed with correct `accountLogin`, `accountType`, `avatarUrl`, `permissions`, `events`
- [ ] Verify the validate mutation returns correct `added`/`removed`/`total` counts

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Update Stale Tests

### Overview
The tests in `github.test.ts` are testing the previous OAuth-based flow. Update them to reflect the current App Installation flow, including `getInstallationDetails` mocking, `buildAccountInfo` new signature, and `getAuthorizationUrl` behavior.

### Changes Required:

#### 1. Update test mocks and assertions
**File**: `apps/connections/src/providers/impl/github.test.ts`
**Changes**:

**a) Add `getInstallationDetails` mock:**
```typescript
// BEFORE:
vi.mock("../../lib/github-jwt", () => ({
  getInstallationToken: vi.fn().mockResolvedValue("test-token"),
}));

// AFTER:
vi.mock("../../lib/github-jwt", () => ({
  getInstallationToken: vi.fn().mockResolvedValue("test-token"),
  getInstallationDetails: vi.fn().mockResolvedValue({
    account: {
      login: "test-org",
      id: 12345,
      type: "Organization",
      avatar_url: "https://avatars.githubusercontent.com/u/12345",
    },
    permissions: { contents: "read", metadata: "read" },
    events: ["push", "pull_request"],
    created_at: "2026-01-01T00:00:00Z",
  }),
}));
```

**b) Fix `getAuthorizationUrl` test:**
```typescript
// BEFORE:
it("builds correct GitHub OAuth URL with state", () => {
  const url = provider.getAuthorizationUrl("test-state");
  const parsed = new URL(url);
  expect(parsed.origin).toBe("https://github.com");
  expect(parsed.pathname).toBe("/login/oauth/authorize");
  ...
});

// AFTER:
it("builds correct GitHub App installation URL with state", () => {
  const url = provider.getAuthorizationUrl("test-state");
  const parsed = new URL(url);
  expect(parsed.origin).toBe("https://github.com");
  expect(parsed.pathname).toBe("/apps/test-app/installations/new");
  expect(parsed.searchParams.get("state")).toBe("test-state");
});
```

**c) Remove `redirect_uri` test (App installation flow doesn't use redirect_uri):**
```typescript
// DELETE the test at lines 99-108:
it("includes redirect_uri when redirectPath option is set", () => { ... });
```

**d) Fix `handleCallback` test to verify account info from API:**
```typescript
it("upserts installation with account data from GitHub API", async () => {
  dbMocks.selectLimit.mockResolvedValue([]); // New installation
  dbMocks.returning.mockResolvedValue([{ id: "inst-abc" }]);

  const c = mockContext({
    installation_id: "ext-42",
    setup_action: "install",
  });
  const result = await provider.handleCallback(c, {
    orgId: "org-1",
    connectedBy: "user-1",
  });

  expect(dbMocks.values).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: "github",
      externalId: "ext-42",
      connectedBy: "user-1",
      orgId: "org-1",
      status: "active",
      providerAccountInfo: expect.objectContaining({
        version: 1,
        sourceType: "github",
        installations: [
          expect.objectContaining({
            id: "ext-42",
            accountLogin: "test-org",
            accountType: "Organization",
            avatarUrl: "https://avatars.githubusercontent.com/u/12345",
          }),
        ],
      }),
    }),
  );
  expect(result).toMatchObject({
    status: "connected",
    installationId: "inst-abc",
    provider: "github",
    setupAction: "install",
  });
});
```

**e) Add test for hard-fail when API call fails:**
```typescript
it("throws when getInstallationDetails fails", async () => {
  const { getInstallationDetails } = await import("../../lib/github-jwt.js");
  vi.mocked(getInstallationDetails).mockRejectedValueOnce(
    new Error("GitHub installation details fetch failed: 401"),
  );

  const c = mockContext({ installation_id: "ext-42" });
  await expect(
    provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
  ).rejects.toThrow("GitHub installation details fetch failed: 401");

  // Verify no DB upsert was attempted
  expect(dbMocks.insert).not.toHaveBeenCalled();
});
```

**f) Fix `buildAccountInfo` tests to match new signature:**
```typescript
describe("buildAccountInfo", () => {
  const mockApiData = {
    account: {
      login: "my-org",
      id: 99999,
      type: "Organization" as const,
      avatar_url: "https://avatars.githubusercontent.com/u/99999",
    },
    permissions: { contents: "read" },
    events: ["push"],
    created_at: "2026-01-01T00:00:00Z",
  };

  it("builds GitHub account info from API data", () => {
    const info = provider.buildAccountInfo("inst-42", mockApiData);
    expect(info).toMatchObject({
      version: 1,
      sourceType: "github",
      installations: [
        expect.objectContaining({
          id: "inst-42",
          accountId: "99999",
          accountLogin: "my-org",
          accountType: "Organization",
          avatarUrl: "https://avatars.githubusercontent.com/u/99999",
          permissions: { contents: "read" },
          events: ["push"],
          installedAt: "2026-01-01T00:00:00Z",
        }),
      ],
    });
  });

  it("correctly identifies User account type", () => {
    const userData = {
      ...mockApiData,
      account: { ...mockApiData.account, type: "User" as const },
    };
    const info = provider.buildAccountInfo("inst-42", userData);
    expect(info).toMatchObject({
      installations: [expect.objectContaining({ accountType: "User" })],
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] All unit tests pass: `pnpm --filter ./apps/connections test`
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] None required — this is test-only changes

---

## Testing Strategy

### Unit Tests:
- `handleCallback` with mocked `getInstallationDetails` returning Organization data
- `handleCallback` with mocked `getInstallationDetails` returning User data
- `handleCallback` hard-fail when `getInstallationDetails` throws
- `buildAccountInfo` correctly maps all API fields
- `getAppInstallation` function (new, in `console-octokit-github`)

### Integration Tests:
- Full connection lifecycle: authorize → callback → validate → verify data

### Manual Testing Steps:
1. Start dev server: `pnpm dev:app`
2. Navigate to connections settings
3. Install GitHub App on a test organization
4. Verify `provider_account_info` in DB has:
   - `accountType: "Organization"`
   - `accountLogin: "<actual-org-name>"`
   - `avatarUrl: "<actual-avatar-url>"`
   - `permissions` populated
   - `events` populated
5. Call the validate mutation (via UI or tRPC client)
6. Verify data is refreshed (timestamps updated)
7. Test with a personal GitHub account — verify `accountType: "User"`

## References

- GitHub App installation redirect docs: `https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app`
- Current callback handler: `apps/connections/src/providers/impl/github.ts:119-213`
- Current validate mutation: `api/console/src/router/org/connections.ts:253-353`
- GitHub JWT helper: `apps/connections/src/lib/github-jwt.ts:100-155`
- Schema: `db/console/src/schema/tables/gw-installations.ts:30-66`
- Stale tests: `apps/connections/src/providers/impl/github.test.ts`
