# Provider Account Info Type Enforcement Implementation Plan

## Overview

Enforce strict type-safety and correctness for `providerAccountInfo` across all four providers (GitHub, Vercel, Sentry, Linear). Fix the build error in `connected-sources-overview.tsx`, fix GitHub's callback to fetch real account data from the API instead of producing garbage defaults, enrich all provider outputs with permission/scope/webhook tracking, and split the linear/sentry union variant into separate discriminated types.

## Current State Analysis

### Build Error
- `apps/console/src/components/connected-sources-overview.tsx:75` fails with: `Property 'projectName' does not exist on type` because the `else` branch after `sourceType === "github"` doesn't narrow to vercel — it includes sentry and linear which lack `projectName`.

### GitHub Provider — Broken Account Data
- `apps/connections/src/providers/impl/github.ts:211-234` — `buildAccountInfo` reads `stateData.accountLogin` and `stateData.accountType`, but the GitHub App callback only provides `installation_id` + `setup_action` as query params. The `stateData` (from OAuth state) only contains `orgId` + `connectedBy`.
- Result: `accountLogin` is always `"unknown"`, `accountType` always defaults to `"User"`, `permissions` is always `{}`, `avatarUrl` is always `""`.
- The `validate` mutation in `api/console/src/router/org/connections.ts:297-316` already fetches real data from the GitHub API and maps it correctly — the callback should do the same.

### Sentry Provider — Minimal Data
- `apps/connections/src/providers/impl/sentry.ts:255-260` — returns only `{ version: 1, sourceType: "sentry" }` despite the OAuth response potentially containing organization info.

### Vercel Provider — Missing Scope
- `apps/connections/src/providers/impl/vercel.ts:181-196` — doesn't capture the OAuth `scope` from the token exchange response.

### Type System Gaps
- `db/console/src/schema/tables/gw-installations.ts:26-53` — linear and sentry share a single variant `{ version: 1, sourceType: "linear" | "sentry" }` with no provider-specific fields.
- No provider tracks granted OAuth scopes or subscribed webhook events.
- GitHub `permissions: Record<string, string>` exists in the type but is never populated.

### Key Discoveries
- `api/console/src/router/org/connections.ts:297-316` — the `validate` mutation already correctly fetches GitHub installations via `getUserInstallations(accessToken)` and maps `account.login`, `account.type`, `avatar_url`, `permissions` from the real API response.
- GitHub App callback redirect provides only `installation_id` and `setup_action` — no account info is in the URL.
- GitHub API `GET /app/installations/{installation_id}` returns full account data including `account.login`, `account.type`, `account.avatar_url`, `permissions` (flat `Record<string, string>`), and `events` (subscribed webhook event names).
- `accountType: "User" | "Organization"` is correct per the GitHub API — no "Bot" on installation accounts.
- Sentry's OAuth raw response contains `organization_id` but no further org details.
- `apps/connections/src/providers/impl/github.ts:6-8` — `getInstallationToken` creates installation-level tokens. To call `GET /app/installations/{installation_id}` we need an app-level JWT (already available via `github-jwt.ts`).

## Desired End State

After this plan is complete:

1. `pnpm build:console` passes with zero type errors.
2. Every provider's `buildAccountInfo` produces **real, populated data** — no "unknown" defaults for known fields.
3. GitHub callback fetches installation details from the GitHub API to populate `accountLogin`, `accountType`, `avatarUrl`, `permissions`, and `events`.
4. Each provider variant in `providerAccountInfo` is a distinct union member with provider-specific fields.
5. All variants track granted scopes/permissions and subscribed webhook events where applicable.
6. Existing consumers (connections router, workspace router) continue to work with the enhanced types.
7. All tests pass and cover the enriched data.

### Verification:
```bash
pnpm build:console      # Zero type errors
pnpm typecheck           # All packages pass
pnpm lint                # No lint errors
pnpm --filter @lightfast/connections test  # All provider tests pass
```

## What We're NOT Doing

- Not changing the `sourceConfig` type on `workspaceIntegrations` (that's a separate concern)
- Not adding runtime Zod validation for `providerAccountInfo` on read (could be a follow-up)
- Not migrating existing database rows (existing rows will be enriched on next `validate` or re-connect)
- Not adding GitHub Enterprise "Enterprise" account type (edge case for GHEC only)
- Not changing the `ConnectionProvider` interface signature (return type stays `GwInstallation["providerAccountInfo"]`)

## Implementation Approach

The changes flow from the database schema outward:
1. Fix the trivial build error first (unblocks iteration)
2. Update the canonical type definition on `gw-installations.ts`
3. Update each provider's `buildAccountInfo` to match the new types
4. Add GitHub API fetch during callback
5. Update tests

---

## Phase 1: Fix Build Error

### Overview
Fix the TypeScript narrowing error in `connected-sources-overview.tsx` by properly discriminating on `sourceType`.

### Changes Required

#### 1. Fix sourceType narrowing
**File**: `apps/console/src/components/connected-sources-overview.tsx`
**Changes**: Replace the `if/else` with explicit `sourceType` checks

```typescript
// Before (line 70-79):
if (resourceData.sourceType === "github") {
  displayName = resourceData.repoFullName;
  detailsUrl = `https://github.com/${resourceData.repoFullName}`;
} else {
  // Vercel sourceType
  displayName = resourceData.projectName;  // ← ERROR: sentry doesn't have projectName
  ...
}

// After:
if (resourceData.sourceType === "github") {
  displayName = resourceData.repoFullName;
  detailsUrl = `https://github.com/${resourceData.repoFullName}`;
} else if (resourceData.sourceType === "vercel") {
  displayName = resourceData.projectName;
  detailsUrl = resourceData.teamSlug
    ? `https://vercel.com/${resourceData.teamSlug}/${resourceData.projectName}`
    : `https://vercel.com/dashboard`;
} else if (resourceData.sourceType === "sentry") {
  displayName = `${resourceData.organizationSlug}/${resourceData.projectSlug}`;
  detailsUrl = `https://${resourceData.organizationSlug}.sentry.io/projects/${resourceData.projectSlug}/`;
} else {
  // Linear
  displayName = resourceData.teamName;
  detailsUrl = `https://linear.app`;
}
```

Also update the icon logic at line 85 to handle sentry/linear.

### Success Criteria

#### Automated Verification:
- [x] Build passes: `pnpm build:console`
- [x] Type checking passes: `pnpm typecheck`

#### Manual Verification:
- [ ] Connected sources page renders correctly for all provider types

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 2: Enhance `providerAccountInfo` Type System

### Overview
Split the linear/sentry union variant into separate discriminated types, add scope/events tracking to each variant, and ensure the type captures all data available from each provider's OAuth flow.

### Changes Required

#### 1. Update canonical type definition
**File**: `db/console/src/schema/tables/gw-installations.ts`
**Changes**: Replace the 3-variant union with a 4-variant union, each with provider-specific fields

```typescript
providerAccountInfo: jsonb("provider_account_info").$type<
  | {
      version: 1;
      sourceType: "github";
      installations?: {
        id: string;
        accountId: string;
        accountLogin: string;
        accountType: "User" | "Organization";
        avatarUrl: string;
        permissions: Record<string, string>;   // e.g. { contents: "read", issues: "write" }
        events: string[];                       // NEW: subscribed webhook events
        installedAt: string;
        lastValidatedAt: string;
      }[];
    }
  | {
      version: 1;
      sourceType: "vercel";
      userId: string;
      teamId?: string;
      teamSlug?: string;
      configurationId: string;
      scope?: string;                           // NEW: OAuth scope from token exchange
    }
  | {
      version: 1;
      sourceType: "sentry";
      installationId?: string;                  // NEW: Sentry app installation ID
      organizationSlug?: string;                // NEW: Sentry org slug (if available)
    }
  | {
      version: 1;
      sourceType: "linear";
      scope?: string;                           // NEW: OAuth scope from token exchange
    }
>(),
```

Key changes:
- `"linear" | "sentry"` split into two separate variants
- GitHub: added `events: string[]` to each installation entry
- Vercel: added `scope?: string`
- Sentry: new dedicated variant with `installationId?` and `organizationSlug?`
- Linear: new dedicated variant with `scope?`

### Success Criteria

#### Automated Verification:
- [x] Type checking passes across all packages: `pnpm typecheck`
- [x] No cascading type errors in consumers (connections router, workspace router)

**Implementation Note**: After updating the type, all four `buildAccountInfo` implementations must compile. The existing return values are subtypes of the new variants, so no provider code changes needed yet (they'll be enriched in Phases 3-4).

---

## Phase 3: Fix GitHub Callback — Fetch Real Data from API

### Overview
During `handleCallback`, use the GitHub App JWT to call `GET /app/installations/{installation_id}` and populate `accountLogin`, `accountType`, `avatarUrl`, `permissions`, and `events` from the real API response.

### Changes Required

#### 1. Add GitHub App-level API helper
**File**: `apps/connections/src/lib/github-jwt.ts`
**Changes**: Add a function to fetch installation details using the App JWT

```typescript
/**
 * Fetch a GitHub App installation by ID using the app-level JWT.
 * Returns the installation details including account info, permissions, and events.
 */
export async function getInstallationDetails(installationId: string): Promise<{
  account: {
    login: string;
    id: number;
    type: "User" | "Organization";
    avatar_url: string;
  } | null;
  permissions: Record<string, string>;
  events: string[];
  created_at: string;
}> {
  const jwt = generateAppJwt(); // Already exists in github-jwt.ts

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
      },
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub installation fetch failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    account: data.account ? {
      login: data.account.login ?? "",
      id: data.account.id ?? 0,
      type: data.account.type === "User" ? "User" : "Organization",
      avatar_url: data.account.avatar_url ?? "",
    } : null,
    permissions: (data.permissions ?? {}) as Record<string, string>,
    events: (data.events ?? []) as string[],
    created_at: data.created_at ?? new Date().toISOString(),
  };
}
```

Note: check what already exists in `github-jwt.ts` — `generateAppJwt()` may need to be exported or a wrapper created.

#### 2. Update GitHub `buildAccountInfo` and `handleCallback`
**File**: `apps/connections/src/providers/impl/github.ts`
**Changes**:

- Make `buildAccountInfo` accept structured data instead of `stateData: Record<string, string>`
- Update `handleCallback` to fetch from GitHub API before building account info
- Keep `buildAccountInfo` signature matching the interface (it returns `GwInstallation["providerAccountInfo"]`)

```typescript
async handleCallback(
  c: Context,
  stateData: Record<string, string>,
): Promise<CallbackResult> {
  const installationId = c.req.query("installation_id");
  // ... existing validation ...

  // NEW: Fetch real installation data from GitHub API
  let installationDetails;
  try {
    installationDetails = await getInstallationDetails(installationId);
  } catch (err) {
    // Fallback to minimal data if API call fails (non-blocking)
    console.error(`[github] Failed to fetch installation details for ${installationId}:`, err);
    installationDetails = null;
  }

  const accountInfo = this.buildAccountInfo(
    { ...stateData, installationId },
    undefined,
    installationDetails,  // Pass API data
  );

  // ... rest unchanged ...
}

buildAccountInfo(
  stateData: Record<string, string>,
  _oauthTokens?: OAuthTokens,
  apiData?: {
    account: { login: string; id: number; type: "User" | "Organization"; avatar_url: string } | null;
    permissions: Record<string, string>;
    events: string[];
    created_at: string;
  } | null,
): GwInstallation["providerAccountInfo"] {
  const id = stateData.installationId ?? "";
  const account = apiData?.account;

  return {
    version: 1,
    sourceType: "github",
    installations: [
      {
        id,
        accountId: account?.id.toString() ?? id,
        accountLogin: account?.login ?? stateData.accountLogin ?? "",
        accountType: account?.type ?? (
          stateData.accountType === "User" || stateData.accountType === "Organization"
            ? stateData.accountType
            : "Organization"
        ),
        avatarUrl: account?.avatar_url ?? "",
        permissions: apiData?.permissions ?? {},
        events: apiData?.events ?? [],
        installedAt: apiData?.created_at ?? new Date().toISOString(),
        lastValidatedAt: new Date().toISOString(),
      },
    ],
  };
}
```

Note: The `buildAccountInfo` interface method signature takes `(stateData, oauthTokens?)` — the third `apiData` parameter is an internal addition to the concrete class, not the interface. The interface return type `GwInstallation["providerAccountInfo"]` ensures type safety.

#### 3. Update `validate` mutation to include `events`
**File**: `api/console/src/router/org/connections.ts`
**Changes**: The `validate` mutation already maps most fields correctly (lines 297-316). Add `events` to the mapping:

```typescript
return {
  id: install.id.toString(),
  accountId: account?.id.toString() ?? "",
  accountLogin,
  accountType,
  avatarUrl: account && "avatar_url" in account ? account.avatar_url : "",
  permissions: (install.permissions as Record<string, string>),
  events: (install.events as string[]) ?? [],  // NEW
  installedAt: install.created_at,
  lastValidatedAt: now,
};
```

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [x] GitHub provider tests pass: `pnpm --filter @lightfast/connections test -- --run github`
- [ ] Build passes: `pnpm build:console`

#### Manual Verification:
- [ ] Connect a GitHub App installation and verify `providerAccountInfo` contains real account data (not "unknown")
- [ ] Run `connections.github.validate` and verify installations have permissions and events populated

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 4: Enrich Sentry & Vercel Providers

### Overview
Update Sentry and Vercel `buildAccountInfo` to capture available data from their OAuth responses. Update Linear to capture scope.

### Changes Required

#### 1. Update Vercel `buildAccountInfo`
**File**: `apps/connections/src/providers/impl/vercel.ts`
**Changes**: Add `scope` from OAuth tokens

```typescript
buildAccountInfo(
  stateData: Record<string, string>,
  oauthTokens?: OAuthTokens,
): GwInstallation["providerAccountInfo"] {
  const raw = oauthTokens?.raw ?? {};
  const externalId = this.deriveExternalId(raw) ?? "";

  return {
    version: 1,
    sourceType: "vercel",
    userId: stateData.connectedBy ?? "unknown",
    teamId: (raw.team_id as string | undefined) ?? undefined,
    teamSlug: (raw.team_slug as string | undefined) ?? undefined,
    configurationId: externalId,
    scope: oauthTokens?.scope,  // NEW
  };
}
```

#### 2. Update Sentry `buildAccountInfo`
**File**: `apps/connections/src/providers/impl/sentry.ts`
**Changes**: Extract installation ID and organization slug from the OAuth flow

```typescript
buildAccountInfo(
  _stateData: Record<string, string>,
  oauthTokens?: OAuthTokens,
): GwInstallation["providerAccountInfo"] {
  const raw = oauthTokens?.raw ?? {};

  return {
    version: 1,
    sourceType: "sentry",
    installationId: (raw.id as string | undefined)?.toString(),
    organizationSlug: (raw.organization as { slug?: string } | undefined)?.slug,
  };
}
```

Note: Sentry's token exchange response includes an `id` (installation ID) and may include `organization` data. The exact shape depends on the Sentry OAuth response — verify during implementation by checking `sentryOAuthResponseSchema` and any additional raw fields.

#### 3. Update Linear `buildAccountInfo`
**File**: `apps/connections/src/providers/impl/linear.ts`
**Changes**: Add `scope` from OAuth tokens

```typescript
buildAccountInfo(
  _stateData: Record<string, string>,
  oauthTokens?: OAuthTokens,
): GwInstallation["providerAccountInfo"] {
  return {
    version: 1,
    sourceType: "linear",
    scope: oauthTokens?.scope,
  };
}
```

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [x] All provider tests pass: `pnpm --filter @lightfast/connections test`
- [ ] Build passes: `pnpm build:console`

#### Manual Verification:
- [ ] Connect Vercel and verify `scope` is captured in `providerAccountInfo`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 5: Update Tests

### Overview
Update all provider test files to match the enriched `buildAccountInfo` outputs and add tests for the new GitHub API fetch.

### Changes Required

#### 1. Update GitHub tests
**File**: `apps/connections/src/providers/impl/github.test.ts`
**Changes**:
- Update `buildAccountInfo` tests to verify `events: []` is present in the output
- Add test for `buildAccountInfo` with `apiData` parameter (real API data)
- Add test for `handleCallback` that mocks `getInstallationDetails` and verifies real account data is stored
- Update the "defaults to 'unknown' accountLogin" test — the default should now be `""` (empty string) instead of `"unknown"` when no API data is available

#### 2. Update Vercel tests
**File**: `apps/connections/src/providers/impl/vercel.test.ts`
**Changes**:
- Update `buildAccountInfo` test to verify `scope` is captured from OAuth tokens

#### 3. Update Sentry tests
**File**: `apps/connections/src/providers/impl/sentry.test.ts`
**Changes**:
- Update `buildAccountInfo` test to verify new fields (installationId, organizationSlug)

#### 4. Update Linear tests
**File**: `apps/connections/src/providers/impl/linear.test.ts`
**Changes**:
- Update `buildAccountInfo` test to verify `scope` is captured

### Success Criteria

#### Automated Verification:
- [x] All tests pass: `pnpm --filter @lightfast/connections test`
- [x] Build passes: `pnpm build:console`
- [x] Type checking passes: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`

#### Manual Verification:
- [ ] Review test coverage — each provider's `buildAccountInfo` tested with realistic data

---

## Testing Strategy

### Unit Tests
- Each provider's `buildAccountInfo` with full realistic data
- GitHub `buildAccountInfo` with and without API data (graceful fallback)
- GitHub `handleCallback` with mocked `getInstallationDetails`
- Type narrowing in consumers (ensure `sourceType` discriminant works)

### Integration Tests
- GitHub callback → API fetch → DB insert flow
- Vercel callback → scope capture flow

### Manual Testing Steps
1. Connect GitHub App and verify `providerAccountInfo` in DB has real account data
2. Run `connections.github.validate` and check installations have permissions + events
3. Connect Vercel and verify scope is stored
4. Verify `connected-sources-overview.tsx` renders all four provider types correctly

## Performance Considerations

- GitHub API call during callback adds ~100-200ms latency. This is acceptable since callbacks are infrequent (only during installation). The call is wrapped in try/catch to gracefully degrade if the API is slow or unavailable.
- No additional database migrations needed — `providerAccountInfo` is a JSONB column, so the schema change is TypeScript-only.

## Migration Notes

- **No database migration required** — the column is untyped JSONB. The `.$type<>()` overlay is TypeScript-only.
- **Existing rows are not affected** — old data (e.g., `{ version: 1, sourceType: "sentry" }`) is a valid subtype of the new variants.
- **Enrichment happens lazily** — existing GitHub installations will get real data on next `validate` call or re-connect.

## References

- Database schema: `db/console/src/schema/tables/gw-installations.ts:26-53`
- Provider types: `apps/connections/src/providers/types.ts:76-109`
- GitHub provider: `apps/connections/src/providers/impl/github.ts:211-234`
- Vercel provider: `apps/connections/src/providers/impl/vercel.ts:181-196`
- Sentry provider: `apps/connections/src/providers/impl/sentry.ts:255-260`
- Connections router: `api/console/src/router/org/connections.ts`
- Build error: `apps/console/src/components/connected-sources-overview.tsx:75`
- GitHub API: `GET /app/installations/{installation_id}` — returns account, permissions, events
