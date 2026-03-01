# Provider Account Info Shared Types — Implementation Plan

## Overview

Redesign `ProviderAccountInfo` types in `@packages/gateway-types/src/account-info.ts` to introduce a shared base interface with normalized `scopes`, `events`, `installedAt`, and `lastValidatedAt` fields. Flatten the GitHub nested `installation` object, remove field duplication with the `gw_installations` table, enrich Vercel with a post-callback config fetch, and update all consumers.

## Current State Analysis

### Current Types (`packages/gateway-types/src/account-info.ts`)

| Provider | Fields | Issues |
|---|---|---|
| `GitHubAccountInfo` | Nested `installation: { id, accountId, accountLogin, accountType, avatarUrl, permissions, events, installedAt, lastValidatedAt }` | `installation.id` duplicates `gw_installations.externalId`; permissions as `Record<string, string>` is GitHub-specific; unnecessary nesting |
| `VercelAccountInfo` | `userId, configurationId, teamId?, connectedBy` | `connectedBy` duplicates `gw_installations.connectedBy` column; no scopes, no events, no projectSelection |
| `SentryAccountInfo` | `installationId, organizationSlug` | No scopes (available from token exchange); no events |
| `LinearAccountInfo` | `scope` | Bare minimum; org info available from existing GraphQL call but not captured |

### `gw_installations` Table Columns (DO NOT duplicate in types)

- `provider` — maps to `sourceType` (but `sourceType` stays as the discriminant)
- `externalId` — provider-scoped ID (GitHub installation ID, Vercel team/user ID, etc.)
- `accountLogin` — exists but currently NULL for all providers
- `connectedBy` — Clerk user ID
- `orgId` — our org ID
- `status` — active/pending/error/revoked
- `createdAt` / `updatedAt` — our DB timestamps

### Key Discoveries

- `connections.ts:229-232` — GitHub `get` spreads `info.installation` into tRPC output; frontend uses `inst.id`, `inst.accountLogin`, `inst.avatarUrl`
- `connections.ts:380,471` and `workspace.ts:1165` — Compare `providerAccountInfo.installation.id` against input; should use `row.externalId` instead
- `connections.ts:299-308` — GitHub `validate` builds a `refreshedInstallation` object with the old nested shape
- `workspace.ts:988-990,1368-1370` — Vercel consumers read `providerAccountInfo.teamId` and `providerAccountInfo.configurationId` (unchanged)
- `integration-tests:170-190` — `makeGitHubAccountInfo()` helper builds old nested shape
- Frontend types derived from `RouterOutputs`, not directly from `ProviderAccountInfo`

## Desired End State

```typescript
// packages/gateway-types/src/account-info.ts

/** Shared base — all providers inherit these fields */
export interface BaseAccountInfo {
  version: 1;
  /** Normalized scopes/permissions granted by the provider.
   *  GitHub: ["issues:write", "contents:read", "metadata:read"]
   *  Vercel: ["read:project", "read-write:log-drain"]
   *  Sentry: ["org:read", "project:read"]
   *  Linear: ["read", "write"] */
  scopes: string[];
  /** Webhook events this installation is subscribed to.
   *  GitHub: ["push", "pull_request", "issues"]
   *  Vercel: ["deployment.created", "project.created"]
   *  Sentry: ["issue", "error", "comment"]
   *  Linear: ["Issue", "Comment", "Project"] */
  events: string[];
  /** When the provider says this was installed (provider timestamp or callback time) */
  installedAt: string;
  /** When we last validated this installation against the provider API */
  lastValidatedAt: string;
}

export interface GitHubAccountInfo extends BaseAccountInfo {
  sourceType: "github";
  accountId: string;
  accountLogin: string;
  accountType: "User" | "Organization";
  avatarUrl: string;
  repositorySelection: "all" | "selected";
}

export interface VercelAccountInfo extends BaseAccountInfo {
  sourceType: "vercel";
  userId: string;
  configurationId: string;
  teamId?: string;
  projectSelection: "all" | "selected";
}

export interface SentryAccountInfo extends BaseAccountInfo {
  sourceType: "sentry";
  installationId: string;
  organizationSlug: string;
}

export interface LinearAccountInfo extends BaseAccountInfo {
  sourceType: "linear";
  organizationName?: string;
  organizationUrlKey?: string;
}

export type ProviderAccountInfo =
  | GitHubAccountInfo
  | VercelAccountInfo
  | SentryAccountInfo
  | LinearAccountInfo;
```

### Verification

- `pnpm typecheck` passes with zero errors
- `pnpm lint` passes
- All existing integration tests pass after fixture updates
- GitHub `get`, `validate`, `repositories`, `detectConfig` endpoints work correctly
- Vercel `list`, `listProjects`, workspace linking endpoints work correctly

## What We're NOT Doing

- **No DB migration** — `providerAccountInfo` is JSONB, shape changes are TypeScript-only
- **No version bump** — Codebase is new; keep `version: 1` and fix types in place
- **No runtime Zod validation** for `providerAccountInfo` on read (can be a follow-up)
- **No changes to the `ConnectionProvider` interface signature** — `buildAccountInfo` remains an implementation detail
- **Not populating the `accountLogin` table column** — separate concern
- **Not implementing Sentry scopes extraction from token exchange** — the `sentryOAuthResponseSchema` doesn't currently parse `scopes`; we'll add the field but populate from the raw response where available
- **Not implementing Linear `refreshToken`** — separate concern (Linear tokens post-Oct 2025)

## Implementation Approach

The plan is split into 5 phases. Each phase produces a typecheck-passing codebase. Phases 1–2 are the core type changes; phases 3–5 enrich each provider.

---

## Phase 1: Rewrite Type Definitions

### Overview
Define the shared base interface and flatten all provider-specific types. Update exports.

### Changes Required:

#### 1. `packages/gateway-types/src/account-info.ts` — Full rewrite
**File**: `packages/gateway-types/src/account-info.ts`

Replace the entire file with the types from "Desired End State" above. Remove `GitHubInstallationInfo` (the nested type).

#### 2. `packages/gateway-types/src/index.ts` — Update exports
**File**: `packages/gateway-types/src/index.ts:23-30`

Remove the `GitHubInstallationInfo` export. Add `BaseAccountInfo` export.

```typescript
export type {
  BaseAccountInfo,
  GitHubAccountInfo,
  VercelAccountInfo,
  SentryAccountInfo,
  LinearAccountInfo,
  ProviderAccountInfo,
} from "./account-info";
```

#### 3. `apps/connections/src/providers/types.ts` — Update re-exports
**File**: `apps/connections/src/providers/types.ts:31-36`

Remove `GitHubInstallationInfo` re-export. Add `BaseAccountInfo`.

### Success Criteria:

#### Automated Verification:
- [ ] Type definitions compile: `pnpm typecheck` (will have errors from consumers — expected, fixed in Phase 2)

**Implementation Note**: Phase 1 will intentionally break consumers. Proceed immediately to Phase 2.

---

## Phase 2: Update All Consumers — GitHub

### Overview
Update the GitHub provider's `buildAccountInfo`, all tRPC endpoints that read GitHub `providerAccountInfo`, and the integration test fixtures. This is the largest phase because GitHub has the most consumers.

### Changes Required:

#### 1. GitHub `buildAccountInfo`
**File**: `apps/connections/src/providers/impl/github.ts:215-234`

Change from:
```typescript
buildAccountInfo(stateData, oauthTokens?, apiData): GitHubAccountInfo {
  return {
    version: 1,
    sourceType: "github",
    installation: {
      id: installationId,
      accountId: apiData.account.id.toString(),
      accountLogin: apiData.account.login,
      accountType: apiData.account.type,
      avatarUrl: apiData.account.avatar_url,
      permissions: apiData.permissions,
      events: apiData.events,
      installedAt: apiData.created_at,
      lastValidatedAt: new Date().toISOString(),
    }
  };
}
```

To:
```typescript
buildAccountInfo(stateData, oauthTokens?, apiData): GitHubAccountInfo {
  const now = new Date().toISOString();
  // Normalize GitHub permissions Record<string, string> to string[]
  // e.g. { "issues": "write", "contents": "read" } → ["issues:write", "contents:read"]
  const scopes = Object.entries(apiData.permissions ?? {}).map(
    ([key, level]) => `${key}:${level}`,
  );
  return {
    version: 1,
    sourceType: "github",
    scopes,
    events: apiData.events ?? [],
    installedAt: apiData.created_at ?? now,
    lastValidatedAt: now,
    accountId: apiData.account.id.toString(),
    accountLogin: apiData.account.login,
    accountType: apiData.account.type as "User" | "Organization",
    avatarUrl: apiData.account.avatar_url ?? "",
    repositorySelection: (apiData.repository_selection as "all" | "selected") ?? "all",
  };
}
```

Also update the `getInstallationDetails` call in `github-jwt.ts` to pass through `repository_selection`.

#### 2. GitHub `handleCallback` upsert
**File**: `apps/connections/src/providers/impl/github.ts:162-183`

The upsert currently writes `providerAccountInfo: accountInfo`. This stays the same since `buildAccountInfo` now returns the new flat shape.

#### 3. `connections.ts` — `github.get` endpoint
**File**: `api/console/src/router/org/connections.ts:229-232`

Change from:
```typescript
return [{ ...info.installation, gwInstallationId: row.id }];
```

To:
```typescript
return [{
  id: row.externalId,
  accountLogin: info.accountLogin,
  accountType: info.accountType,
  avatarUrl: info.avatarUrl,
  repositorySelection: info.repositorySelection,
  gwInstallationId: row.id,
}];
```

This preserves the same tRPC output shape for the frontend (which uses `inst.id`, `inst.accountLogin`, `inst.avatarUrl`).

#### 4. `connections.ts` — `github.validate` endpoint
**File**: `api/console/src/router/org/connections.ts:276-320`

Change the `refreshedInstallation` construction and the DB update from the nested pattern to the flat pattern:

```typescript
const now = new Date().toISOString();
const accountType: "User" | "Organization" =
  "type" in account && account.type === "User" ? "User" : "Organization";

const scopes = Object.entries(
  (githubInstallation.permissions ?? {}) as Record<string, string>,
).map(([key, level]) => `${key}:${level}`);

const refreshedAccountInfo: GitHubAccountInfo = {
  version: 1,
  sourceType: "github",
  scopes,
  events: githubInstallation.events ?? [],
  installedAt: githubInstallation.created_at,
  lastValidatedAt: now,
  accountId: account.id.toString(),
  accountLogin: "login" in account ? account.login : "",
  accountType,
  avatarUrl: "avatar_url" in account ? account.avatar_url : "",
  repositorySelection: (githubInstallation.repository_selection as "all" | "selected") ?? "all",
};

await ctx.db
  .update(gwInstallations)
  .set({ providerAccountInfo: refreshedAccountInfo })
  .where(eq(gwInstallations.id, installation.id));
```

#### 5. `connections.ts` — `github.repositories` endpoint
**File**: `api/console/src/router/org/connections.ts:371-386`

Change from:
```typescript
const githubInstallation = providerAccountInfo.installation;
if (githubInstallation.id !== input.installationId) {
```

To:
```typescript
if (installation.externalId !== input.installationId) {
```

#### 6. `connections.ts` — `github.detectConfig` endpoint
**File**: `api/console/src/router/org/connections.ts:462-477`

Same change as repositories:
```typescript
if (installation.externalId !== input.installationId) {
```

#### 7. `workspace.ts` — GitHub workspace linking
**File**: `api/console/src/router/org/workspace.ts:1156-1170`

Change from:
```typescript
const githubInstallation = providerAccountInfo.installation;
if (githubInstallation.id !== input.installationId) {
```

To:
```typescript
if (gwInstallation.externalId !== input.installationId) {
```

#### 8. Integration test fixture
**File**: `packages/integration-tests/src/api-console-connections.integration.test.ts:170-190`

Update `makeGitHubAccountInfo` to the new flat shape:

```typescript
function makeGitHubAccountInfo(overrides?: Partial<{
  accountLogin: string;
  accountType: "User" | "Organization";
}>): GitHubAccountInfo {
  return {
    version: 1,
    sourceType: "github",
    scopes: ["contents:read", "metadata:read"],
    events: ["push", "pull_request"],
    installedAt: "2026-01-01T00:00:00Z",
    lastValidatedAt: "2026-01-01T00:00:00Z",
    accountId: "67890",
    accountLogin: overrides?.accountLogin ?? "test-org",
    accountType: overrides?.accountType ?? "Organization",
    avatarUrl: "https://avatars.githubusercontent.com/u/67890",
    repositorySelection: "all",
  };
}
```

Also update all call sites that pass `installationId` to the helper — this parameter is no longer needed since the installation ID lives in `gw_installations.externalId`, not in the JSONB.

Update test assertions that check `providerAccountInfo.installation.*` to use the flat shape:
- Line 728: `updated.providerAccountInfo.installation.avatarUrl` → `updated.providerAccountInfo.avatarUrl`
- Line 731: `updated.providerAccountInfo.installation.accountLogin` → `updated.providerAccountInfo.accountLogin`

Update any test that seeds `providerAccountInfo` with the old nested shape (e.g., line 670 which seeds a Vercel-shaped blob for the inconsistent sourceType test — keep that as-is since it's testing an error case).

#### 9. GitHub unit test fixture
**File**: `apps/connections/src/providers/impl/github.test.ts:230`

Update the `expect.objectContaining` matcher to match the new flat shape.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] GitHub unit tests pass: `pnpm --filter @app/connections test`
- [ ] Integration tests pass: `pnpm --filter @repo/integration-tests test`

#### Manual Verification:
- [ ] Connect GitHub App on a test org → `providerAccountInfo` has flat shape with `scopes`, `events`, `installedAt`, `lastValidatedAt`, `repositorySelection`
- [ ] The workspace creation page shows the installation selector with correct `accountLogin` and `avatarUrl`
- [ ] Fetching repositories works (the `installationId` comparison uses `externalId`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Update Vercel Provider — Add Config Fetch

### Overview
Enrich Vercel's `buildAccountInfo` with `scopes`, `events`, `projectSelection` by fetching the integration configuration after the OAuth callback. Remove the duplicate `connectedBy` field.

### Changes Required:

#### 1. Add `fetchConfiguration` method to `VercelProvider`
**File**: `apps/connections/src/providers/impl/vercel.ts`

Add a new private method that fetches `GET /v1/integrations/configuration/{configurationId}` using the access token:

```typescript
private async fetchConfiguration(
  configurationId: string,
  accessToken: string,
): Promise<{ scopes: string[]; projectSelection: "all" | "selected" }> {
  const res = await fetch(
    `https://api.vercel.com/v1/integrations/configuration/${configurationId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    console.warn(`[VercelProvider] Failed to fetch config: ${res.status}`);
    return { scopes: [], projectSelection: "all" };
  }
  const data = await res.json();
  return {
    scopes: Array.isArray(data.scopes) ? data.scopes : [],
    projectSelection: data.projectSelection === "selected" ? "selected" : "all",
  };
}
```

#### 2. Update `handleCallback` to call `fetchConfiguration`
**File**: `apps/connections/src/providers/impl/vercel.ts:90-148`

After `exchangeCode`, call `fetchConfiguration` with the `installation_id` and `access_token`:

```typescript
const oauthTokens = await this.exchangeCode(code, redirectUri);
const parsed = vercelOAuthResponseSchema.parse(oauthTokens.raw);
const config = await this.fetchConfiguration(parsed.installation_id, oauthTokens.accessToken);
const accountInfo = this.buildAccountInfo(stateData, oauthTokens, config);
```

#### 3. Update `buildAccountInfo`
**File**: `apps/connections/src/providers/impl/vercel.ts:174-186`

Change from:
```typescript
buildAccountInfo(stateData, oauthTokens): VercelAccountInfo {
  return {
    version: 1,
    sourceType: "vercel",
    userId: parsed.user_id,
    configurationId: parsed.installation_id,
    teamId: parsed.team_id ?? undefined,
    connectedBy: stateData.connectedBy ?? "",
  };
}
```

To:
```typescript
buildAccountInfo(
  _stateData: Record<string, string>,
  oauthTokens: OAuthTokens | undefined,
  config: { scopes: string[]; projectSelection: "all" | "selected" },
): VercelAccountInfo {
  const parsed = vercelOAuthResponseSchema.parse(oauthTokens?.raw);
  const now = new Date().toISOString();
  return {
    version: 1,
    sourceType: "vercel",
    scopes: config.scopes,
    events: [
      "deployment.created",
      "deployment.ready",
      "deployment.succeeded",
      "deployment.error",
      "deployment.canceled",
      "project.created",
      "project.removed",
      "integration-configuration.removed",
      "integration-configuration.permission-updated",
    ],
    installedAt: now,
    lastValidatedAt: now,
    userId: parsed.user_id,
    configurationId: parsed.installation_id,
    teamId: parsed.team_id ?? undefined,
    projectSelection: config.projectSelection,
  };
}
```

Note: `connectedBy` is removed (it duplicates the table column). The `events` list is hard-coded to match what we configure in the Vercel integration dashboard.

#### 4. Update Vercel unit test if it exists
**File**: `apps/connections/src/providers/impl/vercel.test.ts`

Update test fixtures and assertions to match the new shape.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Vercel tests pass: `pnpm --filter @app/connections test`

#### Manual Verification:
- [ ] Connect Vercel integration → `providerAccountInfo` has `scopes`, `events`, `projectSelection`
- [ ] Vercel project listing still works (uses `teamId` and `configurationId` from providerAccountInfo)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 4: Update Sentry Provider

### Overview
Add `scopes` and `events` to Sentry's account info. Extract `scopes` from the token exchange raw response where available.

### Changes Required:

#### 1. Update `buildAccountInfo`
**File**: `apps/connections/src/providers/impl/sentry.ts:260-272`

Change from:
```typescript
buildAccountInfo(stateData, oauthTokens): SentryAccountInfo {
  return {
    version: 1,
    sourceType: "sentry",
    installationId: stateData.sentryInstallationId ?? "",
    organizationSlug: raw.organization?.slug ?? "",
  };
}
```

To:
```typescript
buildAccountInfo(stateData, oauthTokens): SentryAccountInfo {
  const raw = oauthTokens?.raw ?? {};
  const now = new Date().toISOString();

  // Extract scopes from token exchange response if available
  const scopes: string[] = Array.isArray(raw.scopes)
    ? raw.scopes
    : typeof raw.scope === "string"
      ? raw.scope.split(" ").filter(Boolean)
      : [];

  return {
    version: 1,
    sourceType: "sentry",
    scopes,
    events: ["installation", "issue", "error", "comment"],
    installedAt: now,
    lastValidatedAt: now,
    installationId: stateData.sentryInstallationId ?? "",
    organizationSlug: raw.organization?.slug ?? "",
  };
}
```

Note: `events` is hard-coded to match what we configure in the Sentry integration dashboard.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Sentry tests pass: `pnpm --filter @app/connections test`

#### Manual Verification:
- [ ] Connect Sentry integration → `providerAccountInfo` has `scopes`, `events`, `installedAt`, `lastValidatedAt`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 5: Update Linear Provider

### Overview
Add base fields and enrich with organization info from the existing GraphQL call.

### Changes Required:

#### 1. Update `fetchLinearExternalId` to return org info
**File**: `apps/connections/src/providers/impl/linear.ts:216-244`

The existing function calls `{ viewer { id organization { id } } }`. Extend the query to also fetch `organization { name urlKey }`:

```graphql
{
  viewer {
    id
    organization {
      id
      name
      urlKey
    }
  }
}
```

Change the return type to include org info:
```typescript
async fetchLinearExternalId(accessToken: string): Promise<{
  externalId: string;
  organizationName?: string;
  organizationUrlKey?: string;
}> {
  // ... existing GraphQL call with extended query ...
  return {
    externalId: organization?.id ?? viewer.id,
    organizationName: organization?.name,
    organizationUrlKey: organization?.urlKey,
  };
}
```

#### 2. Update `handleCallback` to pass org info to `buildAccountInfo`
**File**: `apps/connections/src/providers/impl/linear.ts:246-354`

Pass the org info from `fetchLinearExternalId` through to `buildAccountInfo`.

#### 3. Update `buildAccountInfo`
**File**: `apps/connections/src/providers/impl/linear.ts:380-389`

Change from:
```typescript
buildAccountInfo(_stateData, oauthTokens): LinearAccountInfo {
  return {
    version: 1,
    sourceType: "linear",
    scope: oauthTokens?.scope ?? "",
  };
}
```

To:
```typescript
buildAccountInfo(
  _stateData: Record<string, string>,
  oauthTokens: OAuthTokens | undefined,
  orgInfo?: { organizationName?: string; organizationUrlKey?: string },
): LinearAccountInfo {
  const now = new Date().toISOString();
  // Normalize scope string to array: "read write" → ["read", "write"]
  const scopes = (oauthTokens?.scope ?? "").split(" ").filter(Boolean);
  return {
    version: 1,
    sourceType: "linear",
    scopes,
    events: [], // Populated after webhook registration in handleCallback
    installedAt: now,
    lastValidatedAt: now,
    organizationName: orgInfo?.organizationName,
    organizationUrlKey: orgInfo?.organizationUrlKey,
  };
}
```

#### 4. Populate `events` after webhook registration
**File**: `apps/connections/src/providers/impl/linear.ts:311-325`

After successful `registerWebhook`, update the `providerAccountInfo` to include the registered resource types in the `events` array. The webhook registration should return which `resourceTypes` were registered:

```typescript
// After successful webhook registration, update events
await ctx.db
  .update(gwInstallations)
  .set({
    webhookSecret: secret,
    metadata: { webhookId },
    providerAccountInfo: {
      ...accountInfo,
      events: ["Issue", "Comment", "Project", "ProjectUpdate", "Cycle"],
    },
  })
  .where(eq(gwInstallations.id, connectionId));
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Linear tests pass: `pnpm --filter @app/connections test`

#### Manual Verification:
- [ ] Connect Linear integration → `providerAccountInfo` has `scopes`, `events`, `installedAt`, `lastValidatedAt`, `organizationName`, `organizationUrlKey`

---

## Testing Strategy

### Unit Tests
- Update GitHub unit test fixtures to match flat shape
- Update Vercel test fixtures to include new fields
- Verify `buildAccountInfo` returns correct shapes for all providers

### Integration Tests
- Update `makeGitHubAccountInfo` helper to new shape
- Update all assertions that access `providerAccountInfo.installation.*` to use flat access
- Verify `github.validate` refreshes data in the new flat format
- Verify `github.repositories` and `github.detectConfig` use `externalId` for comparison

### Manual Testing Steps
1. Connect GitHub App → verify flat `providerAccountInfo` in DB with `scopes`, `events`, `repositorySelection`
2. Connect Vercel → verify `providerAccountInfo` has `scopes` from config fetch, `events`, `projectSelection`
3. Connect Sentry → verify `providerAccountInfo` has `scopes`, `events`
4. Connect Linear → verify `providerAccountInfo` has `scopes`, `events`, `organizationName`, `organizationUrlKey`
5. Workspace creation page: GitHub installation selector shows correct org avatars and names
6. Workspace creation page: Vercel project selector works correctly
7. GitHub validate endpoint: refreshes data correctly in new shape

## Performance Considerations

- **Vercel config fetch**: Adds one additional HTTP request during the OAuth callback. This is acceptable since callbacks are one-time operations.
- **Linear GraphQL query**: Extended with 2 additional fields (`name`, `urlKey`). Negligible impact.

## Migration Notes

- **No DB migration needed** — `providerAccountInfo` is JSONB, schema changes are TypeScript-only
- **Existing data**: Old `providerAccountInfo` blobs in the DB will have the old shape. Code that reads them should handle both shapes gracefully during the transition. The `github.validate` endpoint naturally migrates old data when called.
- **For a clean cutover**: After deploying, trigger `github.validate` for existing installations to migrate them to the new shape. Vercel/Sentry/Linear installations can be migrated by reconnecting.

## References

- Current types: `packages/gateway-types/src/account-info.ts`
- DB schema: `db/console/src/schema/tables/gw-installations.ts`
- GitHub provider: `apps/connections/src/providers/impl/github.ts`
- Vercel provider: `apps/connections/src/providers/impl/vercel.ts`
- Sentry provider: `apps/connections/src/providers/impl/sentry.ts`
- Linear provider: `apps/connections/src/providers/impl/linear.ts`
- tRPC consumers: `api/console/src/router/org/connections.ts`, `api/console/src/router/org/workspace.ts`
- Integration tests: `packages/integration-tests/src/api-console-connections.integration.test.ts`
- GitHub App Installation API: https://docs.github.com/en/rest/apps/apps
- Vercel Configuration API: https://vercel.com/docs/rest-api/integrations/retrieve-an-integration-configuration
- Sentry Integration Platform: https://docs.sentry.io/organization/integrations/integration-platform/
- Linear OAuth: https://linear.app/developers/oauth-2-0-authentication
