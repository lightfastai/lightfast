# Provider Type Safety Refactor — Implementation Plan

## Overview

Enforce strict type safety across all four connection providers (`github`, `vercel`, `linear`, `sentry`). Replace `Record<string, string>` state data with a typed interface, remove `buildAccountInfo()` methods in favor of inline construction, store provider API responses as typed `raw` fields with zero normalization, and handle GitHub `setup_action` flows explicitly.

## Current State Analysis

**Problems:**
1. `handleCallback` accepts `stateData: Record<string, string>` — no compile-time guarantees on `orgId`/`connectedBy`
2. `buildAccountInfo()` normalizes provider data (`avatar_url` → `avatarUrl`, `permissions` → `scopes[]`) creating drift from actual API shapes
3. `BaseAccountInfo` forces `scopes: string[]` on all providers, but scopes mean different things per provider (GitHub `permissions`, Vercel config scopes, Linear OAuth scopes, Sentry grant scopes)
4. GitHub `setup_action` flows handled implicitly — `request` and `update` actions aren't explicitly handled
5. Sentry `externalId` derived from non-existent fields (`team_id`, `organization_id`, `installation`) in the OAuth response — falls through to `nanoid()` every time

**Key discoveries:**
- `BaseAccountInfo.events` IS universal — all providers have webhook event subscriptions
- `BaseAccountInfo.scopes` is NOT universal — each provider has its own permission model stored in `raw`
- `GitHubInstallationDetails` in `github-jwt.ts:84-94` is the exact shape to store as `raw`
- `vercelOAuthResponseSchema` in `schemas.ts:22-28` already validates the complete Vercel response
- Sentry's `sentryInstallationId` (extracted from composite `code` param at `sentry.ts:164`) is the correct `externalId`, not the non-existent response fields

## Desired End State

1. `handleCallback(c, stateData: CallbackStateData)` — typed, no fallbacks needed inside providers
2. `BaseAccountInfo` = `{ version, installedAt, lastValidatedAt, events }` — no `scopes`
3. Each provider interface has `raw: <TypedApiResponse>` — 1:1 with provider API, zero normalization
4. No `buildAccountInfo()` methods — account info constructed inline in `handleCallback`
5. GitHub `handleCallback` has explicit if/else for `install`/`update`/`request` setup actions
6. Sentry `externalId` correctly uses `sentryInstallationId`
7. All tests updated to match new shapes

## What We're NOT Doing

- No DB migration — `providerAccountInfo` is JSONB with `$type<>` annotation, changing the TS type is sufficient
- No backfill of existing rows to new shape — old installations update on next reconnection
- No runtime Zod validation of `providerAccountInfo` on read
- No changes to `resolveToken`, `exchangeCode`, `refreshToken`, `revokeToken`, or webhook registration
- No changes to the callback route's Redis state management or redirect logic
- No `version: 2` bump — the shape change is a type refinement, not a breaking migration

## Implementation Approach

Bottom-up: types first → interface → route → providers → tests

---

## Phase 1: Update Shared Types

### Overview
Slim `BaseAccountInfo`, define typed `raw` shapes per provider, add `CallbackStateData`.

### Changes Required:

#### 1. `@repo/gateway-types` — Account Info Types
**File**: `packages/gateway-types/src/account-info.ts`
**Changes**: Slim `BaseAccountInfo`, replace provider-specific fields with typed `raw`

```typescript
/**
 * Shared base for all provider account info.
 * Only fields that are meaningful across ALL providers belong here.
 */
export interface BaseAccountInfo {
  version: 1;
  /** When the provider says this was installed (provider timestamp or callback time). */
  installedAt: string;
  /** When we last validated this installation against the provider API. */
  lastValidatedAt: string;
  /** Webhook events this installation is subscribed to. */
  events: string[];
}

// ── Provider Raw API Response Types ──

/** Raw shape from GitHub GET /app/installations/{id} */
export interface GitHubInstallationRaw {
  account: {
    login: string;
    id: number;
    type: "User" | "Organization";
    avatar_url: string;
  };
  permissions: Record<string, string>;
  events: string[];
  created_at: string;
}

/** Raw shape from Vercel POST /v2/oauth/access_token (minus access_token secret) */
export interface VercelOAuthRaw {
  token_type: string;
  installation_id: string;
  user_id: string;
  team_id: string | null;
}

/** Raw shape from Linear POST /oauth/token (minus access_token secret) */
export interface LinearOAuthRaw {
  token_type?: string;
  scope?: string;
  expires_in?: number;
}

/** Raw shape from Sentry POST /api/0/sentry-app-installations/:id/authorizations/ (minus token/refreshToken secrets) */
export interface SentryOAuthRaw {
  expiresAt?: string;
  scopes?: string[];
  organization?: { slug: string };
}

// ── Provider Account Info Types ──

export interface GitHubAccountInfo extends BaseAccountInfo {
  sourceType: "github";
  raw: GitHubInstallationRaw;
}

export interface VercelAccountInfo extends BaseAccountInfo {
  sourceType: "vercel";
  raw: VercelOAuthRaw;
}

export interface LinearAccountInfo extends BaseAccountInfo {
  sourceType: "linear";
  raw: LinearOAuthRaw;
  /** From GraphQL viewer query — not part of OAuth response */
  organization?: {
    id: string;
    name?: string;
    urlKey?: string;
  };
}

export interface SentryAccountInfo extends BaseAccountInfo {
  sourceType: "sentry";
  raw: SentryOAuthRaw;
  /** Sentry installation ID extracted from composite code param */
  installationId: string;
  /** Organization slug from Sentry API response */
  organizationSlug: string;
}

export type ProviderAccountInfo =
  | GitHubAccountInfo
  | VercelAccountInfo
  | SentryAccountInfo
  | LinearAccountInfo;
```

#### 2. `@repo/gateway-types` — Exports
**File**: `packages/gateway-types/src/index.ts`
**Changes**: Add new raw type exports

```typescript
export type {
  BaseAccountInfo,
  GitHubAccountInfo,
  GitHubInstallationRaw,
  VercelAccountInfo,
  VercelOAuthRaw,
  LinearAccountInfo,
  LinearOAuthRaw,
  SentryAccountInfo,
  SentryOAuthRaw,
  ProviderAccountInfo,
} from "./account-info";
```

#### 3. Connection Provider Interface — `CallbackStateData`
**File**: `apps/connections/src/providers/types.ts`
**Changes**: Add `CallbackStateData`, update `handleCallback` signature, update re-exports

```typescript
// Add to types.ts:
export interface CallbackStateData {
  orgId: string;
  connectedBy: string;
}

// Update ConnectionProvider interface:
handleCallback(
  c: Context,
  stateData: CallbackStateData,
): Promise<CallbackResult>;
```

Also update re-exports to include new raw types:
```typescript
export type {
  // ...existing exports...
  GitHubInstallationRaw,
  VercelOAuthRaw,
  LinearOAuthRaw,
  SentryOAuthRaw,
} from "@repo/gateway-types";
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (expect failures in provider impls — fixed in Phase 3)

---

## Phase 2: Update Callback Route

### Overview
Validate and narrow `stateData` to `CallbackStateData` before passing to `handleCallback`. Move the orgId/connectedBy validation from individual providers to the route.

### Changes Required:

#### 1. Route Handler
**File**: `apps/connections/src/routes/connections.ts`
**Changes**: Import `CallbackStateData`, validate before calling `handleCallback`

At line ~185, replace:
```typescript
const result = await provider.handleCallback(c, stateData);
```

With:
```typescript
// Narrow to typed state — orgId guaranteed by resolveAndConsumeState (line 94)
// connectedBy guaranteed by authorize handler (line 55, defaults to "unknown")
const typedState: CallbackStateData = {
  orgId: stateData.orgId,
  connectedBy: stateData.connectedBy ?? "unknown",
};
const result = await provider.handleCallback(c, typedState);
```

Import `CallbackStateData` from `../providers/types.js`.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes for the route file

---

## Phase 3: Refactor Provider Implementations

### Overview
Remove `buildAccountInfo()`, inline account info construction using `raw`, use typed `CallbackStateData`, and add explicit `setup_action` handling for GitHub.

### Changes Required:

#### 1. GitHub Provider
**File**: `apps/connections/src/providers/impl/github.ts`

**Remove**: `buildAccountInfo()` method (lines 212-234)
**Remove**: `orgId`/`connectedBy` guards (lines 130-135) — now guaranteed by route
**Update**: `handleCallback` signature and body

```typescript
async handleCallback(
  c: Context,
  stateData: CallbackStateData,
): Promise<CallbackResult> {
  const installationId = c.req.query("installation_id");
  const setupAction = c.req.query("setup_action");

  // ── Explicit setup_action routing ──

  if (setupAction === "request") {
    // GitHub sends setup_action=request when org admin approval is required.
    // installation_id is absent — the installation only gets an ID when approved (via webhook).
    throw new Error("setup_action=request is not yet implemented");
  }

  if (setupAction === "update") {
    // GitHub sends setup_action=update when installation permissions/repos change.
    // installation_id IS present. For now, treat as unimplemented.
    throw new Error("setup_action=update is not yet implemented");
  }

  // ── setup_action=install (or undefined for GitHub-initiated redirects) ──

  if (!installationId) {
    throw new Error("missing installation_id");
  }

  const installationDetails = await getInstallationDetails(installationId);
  const now = new Date().toISOString();

  const accountInfo: GitHubAccountInfo = {
    version: 1,
    sourceType: "github",
    events: installationDetails.events,
    installedAt: installationDetails.created_at,
    lastValidatedAt: now,
    raw: installationDetails,
  };

  // Check if this installation already exists (reactivation vs new)
  const existing = await db
    .select({ id: gwInstallations.id })
    .from(gwInstallations)
    .where(
      and(
        eq(gwInstallations.provider, "github"),
        eq(gwInstallations.externalId, installationId),
      ),
    )
    .limit(1);

  const reactivated = existing.length > 0;

  const rows = await db
    .insert(gwInstallations)
    .values({
      provider: "github",
      externalId: installationId,
      connectedBy: stateData.connectedBy,
      orgId: stateData.orgId,
      status: "active",
      providerAccountInfo: accountInfo,
    })
    .onConflictDoUpdate({
      target: [gwInstallations.provider, gwInstallations.externalId],
      set: {
        status: "active",
        connectedBy: stateData.connectedBy,
        orgId: stateData.orgId,
        providerAccountInfo: accountInfo,
      },
    })
    .returning({ id: gwInstallations.id });

  const row = rows[0];
  if (!row) { throw new Error("upsert_failed"); }

  if (!reactivated) {
    notifyBackfillService({
      installationId: row.id,
      provider: "github",
      orgId: stateData.orgId,
    }).catch(() => {});
  }

  return {
    status: "connected",
    installationId: row.id,
    provider: "github",
    setupAction,
    ...(reactivated && { reactivated: true }),
  };
}
```

**Update imports**: Add `GitHubAccountInfo` and `CallbackStateData`, remove old account info types.

#### 2. Vercel Provider
**File**: `apps/connections/src/providers/impl/vercel.ts`

**Remove**: `buildAccountInfo()` method (lines 212-238)
**Update**: `handleCallback` to use `CallbackStateData`, inline account info, fix externalId

```typescript
async handleCallback(
  c: Context,
  stateData: CallbackStateData,
): Promise<CallbackResult> {
  const code = c.req.query("code");
  if (!code) { throw new Error("missing code"); }

  const redirectUri = `${connectionsBaseUrl}/connections/${this.name}/callback`;
  const oauthTokens = await this.exchangeCode(code, redirectUri);

  const parsed = vercelOAuthResponseSchema.parse(oauthTokens.raw);
  const externalId = parsed.team_id ?? parsed.user_id;

  const config = await this.fetchConfiguration(
    parsed.installation_id,
    oauthTokens.accessToken,
  );

  const now = new Date().toISOString();

  const accountInfo: VercelAccountInfo = {
    version: 1,
    sourceType: "vercel",
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
    raw: {
      token_type: parsed.token_type,
      installation_id: parsed.installation_id,
      user_id: parsed.user_id,
      team_id: parsed.team_id,
    },
  };

  const rows = await db
    .insert(gwInstallations)
    .values({
      provider: this.name,
      externalId,
      connectedBy: stateData.connectedBy,
      orgId: stateData.orgId,
      status: "active",
      providerAccountInfo: accountInfo,
    })
    .onConflictDoUpdate({
      target: [gwInstallations.provider, gwInstallations.externalId],
      set: {
        status: "active",
        connectedBy: stateData.connectedBy,
        orgId: stateData.orgId,
        providerAccountInfo: accountInfo,
      },
    })
    .returning({ id: gwInstallations.id });

  const installation = rows[0];
  if (!installation) { throw new Error("upsert_failed"); }

  await writeTokenRecord(installation.id, oauthTokens);

  notifyBackfillService({
    installationId: installation.id,
    provider: this.name,
    orgId: stateData.orgId,
  }).catch((err: unknown) => {
    console.error(
      `[${this.name}] backfill notification failed for installation=${installation.id} org=${stateData.orgId}`,
      err,
    );
  });

  return {
    status: "connected",
    installationId: installation.id,
    provider: this.name,
  };
}
```

**Remove**: `fetchConfiguration()` private method (lines 185-210) and its call in `handleCallback` (lines 105-108). Scopes are dropped from `BaseAccountInfo` and can be fetched on demand later via `GET /v1/integrations/configuration/{raw.installation_id}` using the stored access token. Also remove the `console.log(data)` debug line at line 202.

**Update imports**: Add `VercelAccountInfo`, `CallbackStateData`. Remove old type imports that are no longer needed.

#### 3. Linear Provider
**File**: `apps/connections/src/providers/impl/linear.ts`

**Remove**: `buildAccountInfo()` method (lines 400-418)
**Update**: `handleCallback` to use `CallbackStateData`, inline account info

```typescript
async handleCallback(
  c: Context,
  stateData: CallbackStateData,
): Promise<CallbackResult> {
  const code = c.req.query("code");
  if (!code) { throw new Error("missing code"); }

  const redirectUri = `${connectionsBaseUrl}/connections/${this.name}/callback`;
  const oauthTokens = await this.exchangeCode(code, redirectUri);

  const linearContext = await this.fetchLinearContext(oauthTokens.accessToken);
  const externalId = linearContext.externalId;
  const now = new Date().toISOString();

  const accountInfo: LinearAccountInfo = {
    version: 1,
    sourceType: "linear",
    events: [], // Populated after webhook registration below
    installedAt: now,
    lastValidatedAt: now,
    raw: {
      token_type: oauthTokens.tokenType,
      scope: oauthTokens.scope,
      expires_in: oauthTokens.expiresIn,
    },
    ...(linearContext.organizationName || linearContext.organizationUrlKey
      ? {
          organization: {
            id: linearContext.externalId,
            name: linearContext.organizationName,
            urlKey: linearContext.organizationUrlKey,
          },
        }
      : {}),
  };

  // ... rest of handleCallback (existing/reactivation check, upsert, webhook registration, backfill)
  // Same logic as current code, just using stateData.orgId and stateData.connectedBy directly
  // instead of stateData.orgId ?? ""
```

Update the webhook registration section to spread into `accountInfo` instead of calling `buildAccountInfo`:
```typescript
// In the webhook success path, update providerAccountInfo with events:
providerAccountInfo: {
  ...accountInfo,
  events: ["Issue", "Comment", "IssueLabel", "Project", "Cycle"],
},
```

**Update imports**: Add `LinearAccountInfo`, `CallbackStateData`. Remove old type imports.

#### 4. Sentry Provider
**File**: `apps/connections/src/providers/impl/sentry.ts`

**Remove**: `buildAccountInfo()` method (lines 260-285)
**Fix**: `externalId` derivation — use `sentryInstallationId` instead of non-existent raw fields
**Update**: `handleCallback` to use `CallbackStateData`, inline account info

```typescript
async handleCallback(
  c: Context,
  stateData: CallbackStateData,
): Promise<CallbackResult> {
  const code = c.req.query("code");
  if (!code) { throw new Error("missing code"); }

  // Extract Sentry installation ID from composite code param (installationId:authCode)
  const sentryInstallationId = code.includes(":") ? code.slice(0, code.indexOf(":")) : "";
  if (!sentryInstallationId) {
    throw new Error("missing sentry installation ID in code");
  }

  const redirectUri = `${connectionsBaseUrl}/connections/${this.name}/callback`;
  const oauthTokens = await this.exchangeCode(code, redirectUri);

  // Use sentryInstallationId as externalId — it's the stable identifier
  const externalId = sentryInstallationId;

  const raw = oauthTokens.raw ?? {};
  const now = new Date().toISOString();

  const accountInfo: SentryAccountInfo = {
    version: 1,
    sourceType: "sentry",
    events: ["installation", "issue", "error", "comment"],
    installedAt: now,
    lastValidatedAt: now,
    raw: {
      expiresAt: raw.expiresAt as string | undefined,
      scopes: Array.isArray(raw.scopes) ? (raw.scopes as string[]) : undefined,
      organization: raw.organization as { slug: string } | undefined,
    },
    installationId: sentryInstallationId,
    organizationSlug: (raw.organization as { slug?: string } | undefined)?.slug ?? "",
  };

  const rows = await db
    .insert(gwInstallations)
    .values({
      provider: this.name,
      externalId,
      connectedBy: stateData.connectedBy,
      orgId: stateData.orgId,
      status: "active",
      providerAccountInfo: accountInfo,
    })
    .onConflictDoUpdate({
      target: [gwInstallations.provider, gwInstallations.externalId],
      set: {
        status: "active",
        connectedBy: stateData.connectedBy,
        orgId: stateData.orgId,
        providerAccountInfo: accountInfo,
      },
    })
    .returning({ id: gwInstallations.id });

  const installation = rows[0];
  if (!installation) { throw new Error("upsert_failed"); }

  await writeTokenRecord(installation.id, oauthTokens);

  void notifyBackfillService({
    installationId: installation.id,
    provider: this.name,
    orgId: stateData.orgId,
  });

  return {
    status: "connected",
    installationId: installation.id,
    provider: this.name,
  };
}
```

**Update imports**: Add `SentryAccountInfo`, `CallbackStateData`. Remove old type imports. Remove `nanoid` import (no longer used for fallback externalId).

#### 5. GitHub JWT — Align Return Type
**File**: `apps/connections/src/lib/github-jwt.ts`
**Changes**: Update `GitHubInstallationDetails` to reference `GitHubInstallationRaw` from `@repo/gateway-types`, or keep it as a separate interface that structurally matches. Since the provider now stores `raw: GitHubInstallationRaw`, the return type of `getInstallationDetails` must be compatible.

Option: Replace `GitHubInstallationDetails` with a re-export of `GitHubInstallationRaw`:
```typescript
import type { GitHubInstallationRaw } from "@repo/gateway-types";
export type { GitHubInstallationRaw as GitHubInstallationDetails };
```

Or rename usages to `GitHubInstallationRaw` directly. Prefer the re-export for minimal diff.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console` (if applicable to connections service)

---

## Phase 4: Update Tests

### Overview
Update all test assertions to match new type shapes (`raw` field, no `scopes`, no `buildAccountInfo` tests).

### Changes Required:

#### 1. GitHub Tests
**File**: `apps/connections/src/providers/impl/github.test.ts`

- **Remove**: `describe("buildAccountInfo")` block (lines 379-423)
- **Update**: `handleCallback` test at line 231 — change `providerAccountInfo` assertion from:
  ```typescript
  providerAccountInfo: expect.objectContaining({
    version: 1,
    sourceType: "github",
    scopes: ["contents:read", "metadata:read"],
    events: ["push", "pull_request"],
    accountLogin: "test-org",
    accountType: "Organization",
  }),
  ```
  To:
  ```typescript
  providerAccountInfo: expect.objectContaining({
    version: 1,
    sourceType: "github",
    events: ["push", "pull_request"],
    raw: {
      account: {
        login: "test-org",
        id: 12345,
        type: "Organization",
        avatar_url: "https://avatars.githubusercontent.com/u/12345",
      },
      permissions: { contents: "read", metadata: "read" },
      events: ["push", "pull_request"],
      created_at: "2026-01-01T00:00:00Z",
    },
  }),
  ```

- **Update**: `handleCallback` missing state tests (lines 326-338) — remove `orgId`/`connectedBy` missing tests (validation moved to route). The `handleCallback` now receives typed `CallbackStateData`, so these tests become irrelevant.

- **Add**: Tests for `setup_action=request` and `setup_action=update` throwing unimplemented errors:
  ```typescript
  it("throws unimplemented for setup_action=request", async () => {
    const c = mockContext({ setup_action: "request" });
    await expect(
      provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
    ).rejects.toThrow("setup_action=request is not yet implemented");
  });

  it("throws unimplemented for setup_action=update", async () => {
    const c = mockContext({ installation_id: "ext-42", setup_action: "update" });
    await expect(
      provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
    ).rejects.toThrow("setup_action=update is not yet implemented");
  });
  ```

- **Update**: `setup_action=request` test (line 280) — currently tests pending status, should now test that it throws unimplemented.

#### 2. Vercel Tests
**File**: `apps/connections/src/providers/impl/vercel.test.ts`

- **Remove**: `describe("buildAccountInfo")` block (lines 84-128)
- **Update**: `handleCallback` test — verify `providerAccountInfo` now has `raw` shape:
  ```typescript
  providerAccountInfo: expect.objectContaining({
    version: 1,
    sourceType: "vercel",
    raw: {
      token_type: "Bearer",
      installation_id: "icfg_abc",
      user_id: "vercel-user-123",
      team_id: "team_abc",
    },
  }),
  ```

#### 3. Linear Tests
**File**: `apps/connections/src/providers/impl/linear.test.ts`

- **Remove**: `describe("buildAccountInfo")` block (lines 130-146)
- **Update**: `handleCallback` tests to verify new `providerAccountInfo` shape with `raw` and `organization`

#### 4. Sentry Tests
**File**: `apps/connections/src/providers/impl/sentry.test.ts`

- **Remove**: `describe("buildAccountInfo")` block (lines 414-443)
- **Update**: `handleCallback` tests to verify:
  - `externalId` is now `sentryInstallationId` (e.g. `"inst-123"`) instead of `nanoid()`
  - `providerAccountInfo` has `raw` shape with `installationId` and `organizationSlug`

#### 5. Integration Tests
**File**: `packages/integration-tests/src/api-console-connections.integration.test.ts`

- **Update**: `makeGitHubAccountInfo` helper (line ~169) to use new shape with `raw`

### Success Criteria:

#### Automated Verification:
- [x] All unit tests pass: `pnpm --filter ./apps/connections test`
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [ ] Integration tests pass: `pnpm --filter ./packages/integration-tests test` (if DB available)

#### Manual Verification:
- [ ] GitHub App installation flow works end-to-end (install → callback → DB row with new shape)
- [ ] Vercel integration flow works end-to-end
- [ ] `providerAccountInfo` in DB contains `raw` field with expected provider API shape
- [ ] Existing installations continue to work (resolveToken, GET /connections/:id)

---

## Summary of Changes Per File

| File | Change |
|---|---|
| `packages/gateway-types/src/account-info.ts` | Slim BaseAccountInfo, add raw types, update provider interfaces |
| `packages/gateway-types/src/index.ts` | Export new raw types |
| `apps/connections/src/providers/types.ts` | Add `CallbackStateData`, update interface signature, re-export raw types |
| `apps/connections/src/routes/connections.ts` | Narrow stateData to `CallbackStateData` before handleCallback |
| `apps/connections/src/providers/impl/github.ts` | Remove buildAccountInfo, inline with raw, setup_action if/else |
| `apps/connections/src/providers/impl/vercel.ts` | Remove buildAccountInfo, inline with raw, remove fetchConfiguration if only for scopes |
| `apps/connections/src/providers/impl/linear.ts` | Remove buildAccountInfo, inline with raw + organization |
| `apps/connections/src/providers/impl/sentry.ts` | Remove buildAccountInfo, inline with raw, fix externalId |
| `apps/connections/src/lib/github-jwt.ts` | Align `GitHubInstallationDetails` with `GitHubInstallationRaw` |
| `apps/connections/src/providers/impl/github.test.ts` | Update assertions, add setup_action tests |
| `apps/connections/src/providers/impl/vercel.test.ts` | Update assertions, remove buildAccountInfo tests |
| `apps/connections/src/providers/impl/linear.test.ts` | Update assertions, remove buildAccountInfo tests |
| `apps/connections/src/providers/impl/sentry.test.ts` | Update assertions, remove buildAccountInfo tests, fix externalId |
| `packages/integration-tests/src/api-console-connections.integration.test.ts` | Update `makeGitHubAccountInfo` helper |

## References

- Research: `thoughts/shared/research/2026-03-01-github-vercel-provider-correctness.md`
- GitHub provider: `apps/connections/src/providers/impl/github.ts`
- Types: `packages/gateway-types/src/account-info.ts`
- DB schema: `db/console/src/schema/tables/gw-installations.ts`
- Callback route: `apps/connections/src/routes/connections.ts`
