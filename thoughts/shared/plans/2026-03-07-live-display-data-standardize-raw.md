# Live Display Data + Standardize `raw` Field

## Overview

Strip all enrichment API calls from `processCallback` (making it token-exchange-only), move display name resolution to live API calls in `connections.*.list/get` endpoints, and standardize the `raw` field across all providers to consistently mean "non-secret token exchange response fields".

## Current State Analysis

Four providers store `providerAccountInfo` differently and resolve display names inconsistently:

| Provider | `processCallback` enrichment | `raw` content | `list/get` live API? | Display name |
|---|---|---|---|---|
| GitHub | `getInstallationDetails` (extra API call) | Full installation object | No | `raw.account.login` from DB |
| Linear | `fetchLinearContext` (extra API call) | OAuth metadata | No | `organization.name` from DB |
| Sentry | None | OAuth metadata | No | **Nothing** |
| Vercel | None | OAuth IDs | Yes (live calls) | Live `GET /v2/teams` or `/v2/user` |

The `raw` field has no consistent semantic: GitHub puts API response data in it; Linear/Sentry/Vercel put OAuth token metadata.

### Key Discoveries:
- GitHub `processCallback` calls `getInstallationDetails` at `github/index.ts:245` — fetches account login, avatar, events, permissions
- Linear `processCallback` calls `fetchLinearContext` at `linear/index.ts:327` — fetches org name/urlKey
- Vercel's `connections.vercel.list` at `connections.ts:590-668` already does live API calls with try/catch fallback — this is the pattern we're standardizing to
- `getInstallationToken` at `token-vault.ts:11-21` reads encrypted token from `gwTokens` — used by Linear/Sentry/Vercel live calls
- GitHub uses `getGitHubApp()` at `connections.ts:33-41` + `getAppInstallation()` for live calls (no stored token needed)
- `connections.github.validate` at `connections.ts:257-341` already makes the exact live API call we need for display data
- `connections.sentry.listProjects` at `connections.ts:993-1047` already calls `GET /api/0/projects/` with `getInstallationToken` — same pattern for `GET /api/0/organizations/`

## Desired End State

After this plan is complete:

| Provider | `processCallback` | `raw` content | `list/get` live API? | Display name |
|---|---|---|---|---|
| GitHub | No enrichment — reads `installation_id` from query only | `{}` (empty — no token exchange) | Yes | Live `GET /app/installations/{id}` |
| Linear | No enrichment — token exchange only | `{ token_type, scope, expires_in }` (unchanged) | Yes | Live `POST /graphql` viewer query |
| Sentry | No enrichment (unchanged) | `{ expiresAt?, scopes? }` (unchanged) | Yes | Live `GET /api/0/organizations/` |
| Vercel | No enrichment (unchanged) | `{ token_type, installation_id, user_id, team_id }` (unchanged) | Yes (unchanged) | Live `GET /v2/teams` or `/v2/user` (unchanged) |

All `raw` fields follow the convention: **non-secret fields from the token exchange/OAuth response**. Display data is never cached in `providerAccountInfo` — it's always resolved live.

### How to verify:
- `pnpm typecheck` passes with no errors
- `pnpm lint` passes
- All existing tests pass: `pnpm test`
- `connections.github.list` returns `accountLogin`, `accountType`, `avatarUrl` from live API
- `connections.linear.get` returns `organizationName`, `organizationUrlKey` from live API
- `connections.sentry.get` returns `organizationName`, `organizationSlug` from live API
- Vercel behavior unchanged

## What We're NOT Doing

- Adding a `fetchDisplayInfo` method to `ProviderDefinition` — display resolution stays as inline code in each endpoint
- Adding a cache/Redis layer for display data — live calls only
- Changing `providerConfig` or `workspaceIntegrations` schema
- Modifying any webhook processing, relay, or backfill logic
- Changing the gateway OAuth callback handler flow (it still calls `processCallback` and upserts)

## Implementation Approach

Two phases: Phase 1 strips enrichment and standardizes schemas; Phase 2 adds live API display resolution to all `connections.*.list/get` endpoints. Phase 1 must go first because it changes the `providerAccountInfo` schema that Phase 2's code references.

---

## Phase 1: Strip `processCallback` Enrichment + Standardize `raw`

### Overview
Remove all non-token-exchange API calls from `processCallback`, standardize `raw` to mean "OAuth response metadata only", and update schemas accordingly. GitHub `processCallback` loses `getInstallationDetails`, Linear loses `fetchLinearContext` and the `organization` extra field.

### Changes Required:

#### 1. Simplify GitHub `raw` schema
**File**: `packages/console-providers/src/providers/github/auth.ts`
**Changes**: Replace `githubInstallationRawSchema` with an empty object. The full installation object is no longer stored — display data will be fetched live.

```typescript
// ── Raw OAuth Response Shape ──

/**
 * Raw shape stored in providerAccountInfo.raw for GitHub.
 *
 * Convention: raw = non-secret fields from the token exchange / OAuth response.
 * GitHub App flow has no token exchange response, so raw is empty.
 * Display data (account login, avatar, type) is resolved live in
 * connections.github.list via GET /app/installations/{id}.
 */
export const githubInstallationRawSchema = z.object({});
```

Remove `GitHubInstallationRaw` type export (or update it to `z.infer<typeof githubInstallationRawSchema>`).

#### 2. Strip `processCallback` enrichment for GitHub
**File**: `packages/console-providers/src/providers/github/index.ts`
**Changes**: At line 245, remove the `getInstallationDetails` call. Hardcode events (like all other providers). Use callback time for `installedAt`.

Before (`index.ts:237-258`):
```typescript
processCallback: async (config, query) => {
  const installationId = query.installation_id;
  const setupAction = query.setup_action;
  if (setupAction === "request") throw new Error("...");
  if (setupAction === "update") throw new Error("...");
  if (!installationId) throw new Error("missing installation_id");

  const details = await getInstallationDetails(config, installationId);
  return {
    status: "connected-no-token",
    externalId: installationId,
    accountInfo: {
      version: 1 as const,
      sourceType: "github" as const,
      events: details.events,
      installedAt: details.created_at,
      lastValidatedAt: new Date().toISOString(),
      raw: details,
    },
  } satisfies CallbackResult<GitHubAccountInfo>;
},
```

After:
```typescript
processCallback: async (_config, query) => {
  const installationId = query.installation_id;
  const setupAction = query.setup_action;
  if (setupAction === "request") throw new Error("setup_action=request is not yet implemented");
  if (setupAction === "update") throw new Error("setup_action=update is not yet implemented");
  if (!installationId) throw new Error("missing installation_id");

  const now = new Date().toISOString();
  return {
    status: "connected-no-token",
    externalId: installationId,
    accountInfo: {
      version: 1 as const,
      sourceType: "github" as const,
      events: ["push", "pull_request", "issues", "release", "discussion"],
      installedAt: now,
      lastValidatedAt: now,
      raw: {},
    },
  } satisfies CallbackResult<GitHubAccountInfo>;
},
```

Note: The hardcoded events list matches `defaultSyncEvents` at `index.ts:261`. The `getInstallationDetails` function can remain in the file — it's still used by `connections.github.validate`.

#### 3. Remove `organization` from Linear `accountInfoSchema`
**File**: `packages/console-providers/src/providers/linear/auth.ts`
**Changes**: Remove the `organization` field from `linearAccountInfoSchema`. Add a JSDoc comment explaining the `raw` convention.

Before (`auth.ts:17-29`):
```typescript
export const linearAccountInfoSchema = z.object({
  version: z.literal(1),
  events: z.array(z.string()),
  installedAt: z.string(),
  lastValidatedAt: z.string(),
  sourceType: z.literal("linear"),
  raw: linearOAuthRawSchema,
  organization: z.object({
    id: z.string(),
    name: z.string().optional(),
    urlKey: z.string().optional(),
  }).optional(),
});
```

After:
```typescript
/**
 * Convention: raw = non-secret fields from the token exchange response.
 * Display data (organization name, urlKey) is resolved live in
 * connections.linear.get via POST /graphql viewer query.
 */
export const linearAccountInfoSchema = z.object({
  version: z.literal(1),
  events: z.array(z.string()),
  installedAt: z.string(),
  lastValidatedAt: z.string(),
  sourceType: z.literal("linear"),
  raw: linearOAuthRawSchema,
});
```

#### 4. Strip `fetchLinearContext` from Linear `processCallback`
**File**: `packages/console-providers/src/providers/linear/index.ts`
**Changes**: At line 327, remove the `fetchLinearContext` call. The `externalId` must still be determined — use the viewer ID from a minimal approach: parse the JWT claims from the access token, or use a simpler identifier.

**Important design consideration**: Linear's `externalId` is currently set to `linearContext.externalId` (the org ID from the GraphQL query). Without `fetchLinearContext`, we need another way to determine `externalId`. The access token itself doesn't contain this info.

**Resolution**: Keep a **minimal** viewer query just for `externalId` (the org/viewer ID) — but strip the display name fields. This is the minimum data needed for the upsert's unique constraint `(provider, externalId)`.

Before (`index.ts:320-359`):
```typescript
processCallback: async (config, query) => {
  const code = query.code;
  if (!code) throw new Error("missing code");

  const redirectUri = `${config.callbackBaseUrl}/gateway/linear/callback`;
  const oauthTokens = await exchangeLinearCode(config, code, redirectUri);

  const linearContext = await fetchLinearContext(oauthTokens.accessToken);
  const externalId = linearContext.externalId;
  const now = new Date().toISOString();

  const raw = linearOAuthRawSchema.parse(oauthTokens.raw);

  return {
    status: "connected",
    externalId,
    accountInfo: {
      version: 1 as const,
      sourceType: "linear" as const,
      events: ["Issue", "Comment", "IssueLabel", "Project", "Cycle"],
      installedAt: now,
      lastValidatedAt: now,
      raw: { token_type: raw.token_type, scope: raw.scope, expires_in: raw.expires_in },
      ...(linearContext.organizationName || linearContext.organizationUrlKey
        ? { organization: { id: linearContext.externalId, name: linearContext.organizationName, urlKey: linearContext.organizationUrlKey } }
        : {}),
    },
    tokens: oauthTokens,
  } satisfies CallbackResult<LinearAccountInfo>;
},
```

After:
```typescript
processCallback: async (config, query) => {
  const code = query.code;
  if (!code) throw new Error("missing code");

  const redirectUri = `${config.callbackBaseUrl}/gateway/linear/callback`;
  const oauthTokens = await exchangeLinearCode(config, code, redirectUri);

  // Minimal viewer query for externalId only (org ID or viewer ID).
  // Display data (org name, urlKey) resolved live in connections.linear.get.
  const externalId = await fetchLinearExternalId(oauthTokens.accessToken);
  const now = new Date().toISOString();

  const raw = linearOAuthRawSchema.parse(oauthTokens.raw);

  return {
    status: "connected",
    externalId,
    accountInfo: {
      version: 1 as const,
      sourceType: "linear" as const,
      events: ["Issue", "Comment", "IssueLabel", "Project", "Cycle"],
      installedAt: now,
      lastValidatedAt: now,
      raw: { token_type: raw.token_type, scope: raw.scope, expires_in: raw.expires_in },
    },
    tokens: oauthTokens,
  } satisfies CallbackResult<LinearAccountInfo>;
},
```

#### 5. Add `fetchLinearExternalId` helper
**File**: `packages/console-providers/src/providers/linear/index.ts`
**Changes**: Replace `fetchLinearContext` with a minimal version that only returns the external ID (no display names):

```typescript
/**
 * Minimal viewer query — returns org ID (preferred) or viewer ID (fallback).
 * Used only by processCallback for the externalId field.
 * Display data resolved live in connections.linear.get.
 */
async function fetchLinearExternalId(accessToken: string): Promise<string> {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query: `{ viewer { id organization { id } } }`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Linear viewer query failed: ${response.status}`);
  }

  const result = (await response.json()) as {
    data?: { viewer?: { id: string; organization?: { id: string } } };
  };

  const orgId = result.data?.viewer?.organization?.id;
  if (orgId) return orgId;

  const viewerId = result.data?.viewer?.id;
  if (viewerId) return viewerId;

  throw new Error("Linear API did not return a viewer or organization ID");
}
```

Note: The old `fetchLinearContext` function can be deleted since it's module-private and no longer called by anyone. (The existing `connections.linear.get` in Phase 2 will make its own inline GraphQL call.)

#### 6. Add JSDoc to Sentry and Vercel `raw` schemas
**File**: `packages/console-providers/src/providers/sentry/auth.ts`
**Changes**: Add convention comment above `sentryOAuthRawSchema` (lines 7-10):

```typescript
/**
 * Convention: raw = non-secret fields from the token exchange response.
 * Display data (organization name, slug) is resolved live in
 * connections.sentry.get via GET /api/0/organizations/.
 */
export const sentryOAuthRawSchema = z.object({
  expiresAt: z.string().optional(),
  scopes: z.array(z.string()).optional(),
});
```

**File**: `packages/console-providers/src/providers/vercel/auth.ts`
**Changes**: Add convention comment above `vercelOAuthRawSchema`:

```typescript
/**
 * Convention: raw = non-secret fields from the token exchange response.
 * Display data (team slug, username) is resolved live in
 * connections.vercel.list via GET /v2/teams/{id} or GET /v2/user.
 */
export const vercelOAuthRawSchema = z.object({
  token_type: z.string(),
  installation_id: z.string(),
  user_id: z.string(),
  team_id: z.string().nullable(),
});
```

#### 7. Update `connections.github.validate` to not write display data to `providerAccountInfo`
**File**: `api/console/src/router/org/connections.ts`
**Changes**: At lines 303-320, simplify `refreshedAccountInfo` — the validate endpoint should still call the GitHub API (to confirm the installation is valid) but should NOT write display data back into `providerAccountInfo`. Update `lastValidatedAt` only.

Before (`connections.ts:303-320`):
```typescript
const refreshedAccountInfo = {
  version: 1 as const,
  sourceType: "github" as const,
  events: githubInstallation.events,
  installedAt: githubInstallation.created_at,
  lastValidatedAt: now,
  raw: {
    account: { login: "login" in account ? account.login : "", id: account.id, type: accountType, avatar_url: "avatar_url" in account ? account.avatar_url : "" },
    permissions: githubInstallation.permissions,
    events: githubInstallation.events,
    created_at: githubInstallation.created_at,
  },
};
```

After:
```typescript
// Update only lastValidatedAt — display data is resolved live, not cached
await ctx.db
  .update(gwInstallations)
  .set({
    providerAccountInfo: sql`jsonb_set(${gwInstallations.providerAccountInfo}, '{lastValidatedAt}', ${JSON.stringify(now)}::jsonb)`,
    updatedAt: now,
  })
  .where(eq(gwInstallations.id, installation.id));
```

Actually, since `providerAccountInfo` is a full JSONB column and Drizzle doesn't have partial JSONB update helpers, the simpler approach is:

```typescript
const existingInfo = installation.providerAccountInfo;
if (existingInfo?.sourceType === "github") {
  await ctx.db
    .update(gwInstallations)
    .set({
      providerAccountInfo: { ...existingInfo, lastValidatedAt: now },
      updatedAt: now,
    })
    .where(eq(gwInstallations.id, installation.id));
}
```

The validate endpoint still makes the API call to confirm the installation exists and is valid — it just no longer writes the response data back into `providerAccountInfo`.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Provider tests pass: `cd packages/console-providers && pnpm test`
- [x] Full test suite passes: `pnpm test` (integration tests have pre-existing Sentry init failure unrelated to this plan)

#### Manual Verification:
- [ ] New GitHub App installation callback succeeds (no enrichment call in logs)
- [ ] New Linear OAuth callback succeeds (no org name in `providerAccountInfo`)
- [ ] Existing connections still display (Phase 2 adds live resolution)

**Implementation Note**: After completing this phase, `connections.github.list` will temporarily show `externalId` instead of `accountLogin` for NEW installations (since `raw` is now empty). Existing installations keep their cached data until they're re-connected. Phase 2 fixes this by adding live resolution.

---

## Phase 2: Add Live API Display Resolution to `connections.*.list/get`

### Overview
Rewrite all `connections.*.list/get` endpoints to resolve display names via live API calls, following Vercel's existing pattern (try/catch with ID fallback). This makes all providers consistent: DB for identity + live API for display.

### Changes Required:

#### 1. Rewrite `connections.github.list` — add live API calls
**File**: `api/console/src/router/org/connections.ts`
**Changes**: At lines 204-247, rewrite to call `getAppInstallation` for each installation (following the `connections.github.validate` pattern at lines 287-320, and Vercel's `Promise.all` + try/catch pattern at lines 607-665).

```typescript
list: orgScopedProcedure.query(async ({ ctx }) => {
  const results = await ctx.db
    .select()
    .from(gwInstallations)
    .where(
      and(
        eq(gwInstallations.orgId, ctx.auth.orgId),
        eq(gwInstallations.provider, "github"),
        eq(gwInstallations.status, "active"),
      ),
    );

  if (results.length === 0) {
    return null;
  }

  // Resolve display data from GitHub API for each installation.
  // Uses GitHub App JWT (no stored token needed).
  // Falls back to externalId on API error.
  const app = getGitHubApp();
  const allInstallations = await Promise.all(
    results
      .filter((row) => row.providerAccountInfo?.sourceType === "github")
      .map(async (row) => {
        let accountLogin = row.externalId;
        let accountType: "User" | "Organization" = "Organization";
        let avatarUrl = "";

        try {
          const installationIdNumber = Number.parseInt(row.externalId, 10);
          const details = await getAppInstallation(app, installationIdNumber);
          const account = details.account;

          if (account && "login" in account) {
            accountLogin = account.login || row.externalId;
            accountType = "type" in account && account.type === "User" ? "User" : "Organization";
            avatarUrl = "avatar_url" in account ? (account.avatar_url as string) : "";
          }
        } catch (error) {
          console.warn("[connections.github.list] Failed to fetch installation details, using fallback:", error);
        }

        return {
          id: row.externalId,
          accountLogin,
          accountType,
          avatarUrl,
          gwInstallationId: row.id,
        };
      }),
  );

  const first = results[0];
  if (!first) return null;
  return {
    id: first.id,
    orgId: first.orgId,
    provider: first.provider,
    connectedAt: first.createdAt,
    status: first.status,
    installations: allInstallations,
  };
}),
```

Update the comment above the function to reflect the new approach:
```typescript
// Resolve account info from GitHub API (App JWT auth, no stored token).
// Wrapped in try/catch per installation — falls back to externalId on error.
```

#### 2. Rewrite `connections.linear.get` — add live API calls
**File**: `api/console/src/router/org/connections.ts`
**Changes**: At lines 811-844, add live GraphQL calls following the same pattern as `connections.linear.listTeams` (lines 877-900).

```typescript
get: orgScopedProcedure.query(async ({ ctx }) => {
  const result = await ctx.db
    .select()
    .from(gwInstallations)
    .where(
      and(
        eq(gwInstallations.orgId, ctx.auth.orgId),
        eq(gwInstallations.provider, "linear"),
        eq(gwInstallations.status, "active"),
      ),
    );

  // Resolve display data from Linear GraphQL API for each installation.
  // Uses stored OAuth token. Falls back to null on API error.
  return Promise.all(
    result.map(async (installation) => {
      let organizationName: string | null = null;
      let organizationUrlKey: string | null = null;

      try {
        const accessToken = await getInstallationToken(installation.id);
        const response = await fetch("https://api.linear.app/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            query: `{ viewer { organization { name urlKey } } }`,
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (response.status === 401) {
          await ctx.db
            .update(gwInstallations)
            .set({ status: "error" })
            .where(eq(gwInstallations.id, installation.id));
        } else if (response.ok) {
          const data = (await response.json()) as {
            data?: { viewer?: { organization?: { name?: string; urlKey?: string } } };
          };
          organizationName = data.data?.viewer?.organization?.name ?? null;
          organizationUrlKey = data.data?.viewer?.organization?.urlKey ?? null;
        }
      } catch (error) {
        console.warn("[connections.linear.get] Failed to fetch org info, using fallback:", error);
      }

      return {
        id: installation.id,
        orgId: installation.orgId,
        provider: installation.provider,
        connectedAt: installation.createdAt,
        status: installation.status,
        organizationName,
        organizationUrlKey,
      };
    }),
  );
}),
```

#### 3. Rewrite `connections.sentry.get` — add live API calls + display name
**File**: `api/console/src/router/org/connections.ts`
**Changes**: At lines 959-985, add a live `GET /api/0/organizations/` call (same pattern as `connections.sentry.listProjects` at lines 1019-1029).

```typescript
get: orgScopedProcedure.query(async ({ ctx }) => {
  const result = await ctx.db
    .select()
    .from(gwInstallations)
    .where(
      and(
        eq(gwInstallations.orgId, ctx.auth.orgId),
        eq(gwInstallations.provider, "sentry"),
        eq(gwInstallations.status, "active"),
      ),
    )
    .limit(1);

  const installation = result[0];
  if (!installation) {
    return null;
  }

  // Resolve display data from Sentry API.
  // Uses stored OAuth token. Falls back to null on error.
  let organizationName: string | null = null;
  let organizationSlug: string | null = null;

  try {
    const accessToken = await getInstallationToken(installation.id);
    const response = await fetch("https://sentry.io/api/0/organizations/", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 401) {
      await ctx.db
        .update(gwInstallations)
        .set({ status: "error" })
        .where(eq(gwInstallations.id, installation.id));
    } else if (response.ok) {
      const orgs = (await response.json()) as Array<{ name?: string; slug?: string }>;
      // Sentry App installations are scoped to one org — take the first result
      const org = orgs[0];
      if (org) {
        organizationName = org.name ?? null;
        organizationSlug = org.slug ?? null;
      }
    }
  } catch (error) {
    console.warn("[connections.sentry.get] Failed to fetch org info, using fallback:", error);
  }

  return {
    id: installation.id,
    orgId: installation.orgId,
    provider: installation.provider,
    connectedAt: installation.createdAt,
    status: installation.status,
    organizationName,
    organizationSlug,
  };
}),
```

#### 4. Update Vercel `connections.vercel.list` — remove caching TODO
**File**: `api/console/src/router/org/connections.ts`
**Changes**: At lines 602-606, remove the TODO comment about caching since the live-call pattern is now the standard:

Before:
```typescript
// Fetch live account info from Vercel API for each installation.
// Wrapped in try/catch so a single failed token/network call doesn't
// crash the entire list — falls back to cached IDs from providerAccountInfo.
// TODO: Store team_slug/username in VercelOAuthRaw during callback so
// this can become fully cached like github.list (no live API calls).
```

After:
```typescript
// Resolve display data from Vercel API for each installation.
// Uses stored OAuth token. Falls back to raw IDs on error.
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] All tests pass: `pnpm test`

#### Manual Verification:
- [ ] `connections.github.list` returns `accountLogin` (not just externalId) for all active GitHub installations
- [ ] `connections.linear.get` returns `organizationName` and `organizationUrlKey` for all active Linear installations
- [ ] `connections.sentry.get` returns `organizationName` and `organizationSlug` for active Sentry installation
- [ ] `connections.vercel.list` behavior unchanged (still returns `accountLogin` from live calls)
- [ ] API errors gracefully fall back (disconnect WiFi → verify fallback values appear)
- [ ] 401 responses mark installations as "error" status for Linear and Sentry

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to Phase 3.

---

## Phase 3: Supersede Old Plan + Cleanup

### Overview
Mark Phases 4+5 of the `gw-installations-workspace-integrations-final-architecture.md` plan as superseded, and clean up any remaining references to the old caching approach.

### Changes Required:

#### 1. Update old plan
**File**: `thoughts/shared/plans/2026-03-07-gw-installations-workspace-integrations-final-architecture.md`
**Changes**: Add a superseded notice at the top of Phase 4 and Phase 5:

At Phase 4 heading:
```markdown
## Phase 4: ~~Vercel OAuth Display Caching~~ — SUPERSEDED

> **Superseded by**: `thoughts/shared/plans/2026-03-07-live-display-data-standardize-raw.md`
> Display data is now resolved via live API calls in `connections.*.list/get` endpoints,
> not cached in `providerAccountInfo`. The Vercel pattern (live calls) became the standard
> for all providers.
```

At Phase 5 heading:
```markdown
## Phase 5: ~~Linear Organization Backfill + Make Required~~ — SUPERSEDED

> **Superseded by**: `thoughts/shared/plans/2026-03-07-live-display-data-standardize-raw.md`
> Linear `organization` field removed from `providerAccountInfo`. Display data resolved
> live via GraphQL in `connections.linear.get`. No backfill needed.
```

#### 2. Update `providerAccountInfo` JSDoc on DB schema
**File**: `db/console/src/schema/tables/gw-installations.ts`
**Changes**: Add a design invariant comment on the `providerAccountInfo` column:

```typescript
/**
 * Provider-specific installation metadata (JSONB).
 *
 * Schema: providerAccountInfoSchema from @repo/console-providers
 *
 * DESIGN INVARIANT:
 * - `raw` = non-secret fields from the token exchange / OAuth response only
 * - NEVER store display names (account login, org name, avatar, slug) here
 * - Display data is resolved live via provider APIs in connections.*.list/get
 * - This column stores identity + operational data, not presentation data
 */
providerAccountInfo: jsonb("provider_account_info").$type<ProviderAccountInfo>(),
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes (no changes to runtime code)
- [x] `pnpm lint` passes

#### Manual Verification:
- [x] Old plan document correctly shows Phase 4+5 as superseded

---

## Testing Strategy

### Unit Tests:
- Update any tests that assert on `providerAccountInfo.raw.account.login` for GitHub — these now get empty `raw`
- Update any tests that assert on `providerAccountInfo.organization` for Linear — field no longer exists
- Update snapshot tests in `packages/integration-tests/src/__snapshots__/contract-snapshots.test.ts.snap` if they reference the old shapes

### Integration Tests:
- GitHub: Verify `connections.github.list` makes a live `GET /app/installations/{id}` call
- Linear: Verify `connections.linear.get` makes a live `POST /graphql` call
- Sentry: Verify `connections.sentry.get` makes a live `GET /api/0/organizations/` call

### Manual Testing Steps:
1. Connect a new GitHub installation → verify callback succeeds with empty `raw`
2. Navigate to sources page → verify GitHub installation shows account login and avatar (from live call)
3. Connect a new Linear workspace → verify callback succeeds without `organization` field
4. Navigate to sources page → verify Linear installation shows org name (from live call)
5. Navigate to sources page → verify Sentry installation shows org name (new!)
6. Disconnect WiFi briefly → verify all providers fall back gracefully to IDs
7. Verify Vercel behavior unchanged

## Performance Considerations

- **GitHub `connections.github.list`**: Goes from 0 to N external API calls (one per installation). GitHub App JWT generation is cheap (~1ms RS256 sign). The `GET /app/installations/{id}` call is fast (~200ms). Most orgs have 1 installation. Wrapped in `Promise.all` for concurrency.
- **Linear `connections.linear.get`**: Goes from 0 to N external API calls (one per installation). Most orgs have 1 Linear installation. The GraphQL viewer query is lightweight.
- **Sentry `connections.sentry.get`**: Goes from 0 to 1 external API call. Already uses `.limit(1)`.
- **Vercel**: Unchanged — already makes live calls.
- All calls have `AbortSignal.timeout(10_000)` to prevent hanging.
- All calls have try/catch with fallback to prevent errors from breaking the page.

## Migration Notes

- **Existing GitHub installations**: Have rich `raw` data from the old `getInstallationDetails` call. Phase 2's live resolution works regardless — it doesn't read from `raw` at all. The old cached data becomes unused but harmless.
- **Existing Linear installations**: Have `organization` field from the old `fetchLinearContext` call. Phase 2's live resolution doesn't read this field. The old data becomes unused but harmless (`.passthrough()` on the base schema ensures it validates).
- **No DB migration needed**: Schema changes are in Zod only (TypeScript/validation). The JSONB column is untyped at the DB level.
- **Backward compatibility**: Existing installations with old `providerAccountInfo` shapes will continue to validate because:
  - GitHub: Old `raw` with full installation object still satisfies `z.object({})` (objects are subtypes of empty objects in Zod's `.passthrough()` mode... but actually `z.object({})` is strict by default). **Important**: Need to use `z.object({}).passthrough()` for GitHub's `raw` OR accept that old data won't validate. Since `providerAccountInfo` is read-only in list/get (no re-validation), this is safe.
  - Linear: Old `organization` field survives because `callbackAccountInfoSchema` uses `.passthrough()` (`types.ts:29`)

## References

- Research: `thoughts/shared/research/2026-03-07-provider-connections-display-data-architecture.md`
- Superseded phases: `thoughts/shared/plans/2026-03-07-gw-installations-workspace-integrations-final-architecture.md` (Phase 4, Phase 5)
- Provider definitions: `packages/console-providers/src/providers/*/auth.ts` and `*/index.ts`
- Connections router: `api/console/src/router/org/connections.ts`
- Token vault: `api/console/src/lib/token-vault.ts`
- Gateway callback: `apps/gateway/src/routes/connections.ts:146-395`
- GitHub Octokit helpers: `packages/console-octokit-github/src/index.ts`
