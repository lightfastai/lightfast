# GitHub User Account Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a global Lightfast user GitHub account binding backed by the existing GitHub App OAuth flow, with refreshable encrypted credentials and a user-level setup task.

**Architecture:** Add a user source-control account table in `@db/app`, extend GitHub protocol helpers in `@repo/github-app-node`, then add a focused `api/app/src/services/github/user-account` flow that owns attempts, callbacks, encryption, refresh, and gate helpers. Expose the flow through `viewer.githubAccount`, a thin Next callback route, and `/account/tasks/github`.

**Tech Stack:** pnpm workspace, Turborepo, Next.js App Router, tRPC, Drizzle ORM on PlanetScale MySQL/Vitess, Upstash Redis, GitHub App OAuth, `@repo/app-encryption`, Vitest.

---

## File Structure

Create:

- `db/app/src/schema/tables/user-source-control-accounts.ts` — Drizzle table and TypeScript row types for global user/provider bindings.
- `db/app/src/utils/user-source-control-account.ts` — repository helpers, conflict errors, status transitions, and active-row uniqueness helpers.
- `db/app/src/__tests__/user-source-control-account.test.ts` — schema and helper behavior tests using query SQL inspection and mocked DB chains.
- `packages/github-app-node/src/user.ts` — GitHub `GET /user` helper and normalized authenticated-user schema.
- `api/app/src/services/github/user-account/attempts.ts` — Redis-backed user OAuth attempt issue/lookup/consume helpers.
- `api/app/src/services/github/user-account/callbacks.ts` — parser for the user OAuth callback query.
- `api/app/src/services/github/user-account/redirects.ts` — account task, complete, expired, error, and sign-in redirect builders.
- `api/app/src/services/github/user-account/errors.ts` — mapping from provider/domain errors to user account bind error codes.
- `api/app/src/services/github/user-account/finalize-account.ts` — token encryption and DB finalization.
- `api/app/src/services/github/user-account/refresh.ts` — lazy access-token refresh helper and token decryption boundary.
- `api/app/src/services/github/user-account/flow.ts` — start/callback orchestration and status/sync/disconnect service entrypoints.
- `api/app/src/services/github/user-account/gate.ts` — `requireGitHubUserAccount` feature gate helper.
- `api/app/src/router/(pending-allowed)/github-account.ts` — `viewer.githubAccount` tRPC router.
- `apps/app/src/app/(app)/(github)/api/github/user/oauth/callback/route.ts` — thin Next route handler.
- `apps/app/src/app/(app)/(pending-allowed)/account/tasks/github/page.tsx` — GitHub account task page.
- `apps/app/src/app/(app)/(pending-allowed)/account/tasks/github/_components/github-account-task-client.tsx` — task UI client island.
- `apps/app/src/app/(app)/(pending-allowed)/account/tasks/github/complete/page.tsx` — completion page.
- `apps/app/src/app/(app)/(pending-allowed)/account/tasks/github/complete/_components/github-account-complete-client.tsx` — completion client island.
- Focused tests under `api/app/src/__tests__/`, `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/tasks/github/`, and package test folders named in each task below.

Modify:

- `db/app/src/schema/tables/index.ts` and `db/app/src/schema/index.ts` — export the new table/types.
- `db/app/src/index.ts` — export new repository helpers if current exports require it.
- `packages/github-app-contract/src/github-app.ts` and `packages/github-app-contract/src/__tests__/github-app.test.ts` — add user-account callback path and error vocabulary.
- `packages/github-app-node/src/oauth.ts`, `packages/github-app-node/src/index.ts`, and tests — parse refreshable token responses and add refresh helper.
- `api/app/package.json` — add `@repo/app-encryption`.
- `api/app/src/env.ts` — validate `ENCRYPTION_KEY`.
- `api/app/src/services/github/index.ts` — export user-account service entrypoints.
- `api/app/src/root.ts` — add `viewer.githubAccount`.
- `apps/app/src/proxy.ts` and `apps/app/src/__tests__/proxy.test.ts` — admit `/api/github/user/oauth/callback`.
- `emulators/github/src/github-compatible-routes.ts`, `emulators/github/src/fixtures.ts`, and tests — support refreshable user tokens.

Do not modify:

- `lightfast_org_source_control_bindings` behavior except where shared exports require formatting.
- Existing org GitHub setup routes except shared contract/helper imports.
- Clerk metadata mirrors; user GitHub binding is not mirrored into Clerk in v1.

## Task 1: Contract Constants And Error Vocabulary

**Files:**
- Modify: `packages/github-app-contract/src/github-app.ts`
- Modify: `packages/github-app-contract/src/index.ts`
- Test: `packages/github-app-contract/src/__tests__/github-app.test.ts`

- [ ] **Step 1: Write failing contract tests**

Add these assertions to `packages/github-app-contract/src/__tests__/github-app.test.ts`:

```ts
import {
  GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH,
  githubUserAccountBindErrorCodeSchema,
} from "../github-app";

it("exports the GitHub user account OAuth callback path", () => {
  expect(GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH).toBe(
    "/api/github/user/oauth/callback"
  );
});

it("accepts user account bind error codes and rejects org-only errors", () => {
  expect(
    githubUserAccountBindErrorCodeSchema.parse("missing_refresh_token")
  ).toBe("missing_refresh_token");
  expect(
    githubUserAccountBindErrorCodeSchema.parse("github_account_already_bound")
  ).toBe("github_account_already_bound");
  expect(() =>
    githubUserAccountBindErrorCodeSchema.parse("installation_not_verified")
  ).toThrow();
});
```

- [ ] **Step 2: Run contract tests to verify failure**

Run:

```bash
pnpm --filter @repo/github-app-contract test -- src/__tests__/github-app.test.ts
```

Expected: FAIL because `GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH` and `githubUserAccountBindErrorCodeSchema` are not exported.

- [ ] **Step 3: Add the contract exports**

In `packages/github-app-contract/src/github-app.ts`, add:

```ts
export const GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH =
  "/api/github/user/oauth/callback";

export const GITHUB_USER_ACCOUNT_BIND_ERROR_CODES = [
  "expired_state",
  "github_authorization_denied",
  "github_transient_error",
  "github_user_not_verified",
  "missing_refresh_token",
  "github_account_already_bound",
  "lightfast_user_already_bound",
  "permission_required",
] as const;

export const githubUserAccountBindErrorCodeSchema = z.enum(
  GITHUB_USER_ACCOUNT_BIND_ERROR_CODES
);
export type GitHubUserAccountBindErrorCode = z.infer<
  typeof githubUserAccountBindErrorCodeSchema
>;
```

Ensure `packages/github-app-contract/src/index.ts` still uses export-star or exports the new symbols directly:

```ts
export * from "./github-app";
```

- [ ] **Step 4: Run contract tests**

Run:

```bash
pnpm --filter @repo/github-app-contract test -- src/__tests__/github-app.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/github-app-contract/src/github-app.ts packages/github-app-contract/src/index.ts packages/github-app-contract/src/__tests__/github-app.test.ts
git commit -m "feat: add github user account contract"
```

## Task 2: GitHub App User Token Helpers

**Files:**
- Modify: `packages/github-app-node/src/oauth.ts`
- Create: `packages/github-app-node/src/user.ts`
- Modify: `packages/github-app-node/src/index.ts`
- Test: `packages/github-app-node/src/__tests__/oauth.test.ts`
- Test: `packages/github-app-node/src/__tests__/user.test.ts`

- [ ] **Step 1: Write failing OAuth token tests**

Append to `packages/github-app-node/src/__tests__/oauth.test.ts`:

```ts
import { refreshGitHubUserAccessToken } from "../oauth";

it("parses refreshable GitHub App user token fields", async () => {
  const fetchMock = vi.fn(async () =>
    Response.json({
      access_token: "ghu_access",
      expires_in: 28_800,
      refresh_token: "ghr_refresh",
      refresh_token_expires_in: 15_768_000,
      scope: "",
      token_type: "bearer",
    })
  );

  await expect(
    exchangeGitHubOAuthCode({
      clientId: "Iv1.lightfastlocal",
      clientSecret: "secret",
      code: "code_123",
      codeVerifier: "verifier",
      fetch: fetchMock,
      redirectUri: "https://app.lightfast.localhost/api/github/user/oauth/callback",
    })
  ).resolves.toEqual({
    accessToken: "ghu_access",
    accessTokenExpiresIn: 28_800,
    refreshToken: "ghr_refresh",
    refreshTokenExpiresIn: 15_768_000,
    scope: "",
    tokenType: "bearer",
  });
});

it("refreshes GitHub App user access tokens", async () => {
  const fetchMock = vi.fn(async () =>
    Response.json({
      access_token: "ghu_next",
      expires_in: 28_800,
      refresh_token: "ghr_next",
      refresh_token_expires_in: 15_768_000,
      scope: "",
      token_type: "bearer",
    })
  );

  await expect(
    refreshGitHubUserAccessToken({
      clientId: "Iv1.lightfastlocal",
      clientSecret: "secret",
      fetch: fetchMock,
      refreshToken: "ghr_old",
      tokenUrl: "https://github.lightfast.localhost/login/oauth/access_token",
    })
  ).resolves.toMatchObject({
    accessToken: "ghu_next",
    refreshToken: "ghr_next",
  });

  const [, init] = fetchMock.mock.calls[0] ?? [];
  expect(JSON.parse(String(init?.body))).toMatchObject({
    client_id: "Iv1.lightfastlocal",
    client_secret: "secret",
    grant_type: "refresh_token",
    refresh_token: "ghr_old",
  });
});
```

- [ ] **Step 2: Write failing authenticated user tests**

Create `packages/github-app-node/src/__tests__/user.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { getGitHubAuthenticatedUser } from "../user";

describe("getGitHubAuthenticatedUser", () => {
  it("returns the stable GitHub user id from GET /user", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        id: 12_345,
        login: "lightfast-dev",
        type: "User",
      })
    );

    await expect(
      getGitHubAuthenticatedUser({
        apiBaseUrl: "https://github.lightfast.localhost",
        apiVersion: "2022-11-28",
        fetch: fetchMock,
        userAccessToken: "ghu_access",
      })
    ).resolves.toEqual({
      id: "12345",
      login: "lightfast-dev",
      type: "User",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.lightfast.localhost/user",
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "application/vnd.github+json",
          authorization: "Bearer ghu_access",
          "x-github-api-version": "2022-11-28",
        }),
      })
    );
  });

  it("rejects non-user authenticated identities", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: 99, login: "acme", type: "Organization" })
    );

    await expect(
      getGitHubAuthenticatedUser({
        fetch: fetchMock,
        userAccessToken: "ghu_access",
      })
    ).rejects.toMatchObject({ code: "GITHUB_USER_NOT_VERIFIED" });
  });
});
```

- [ ] **Step 3: Run GitHub node tests to verify failure**

Run:

```bash
pnpm --filter @repo/github-app-node test -- src/__tests__/oauth.test.ts src/__tests__/user.test.ts
```

Expected: FAIL because refresh token fields and `getGitHubAuthenticatedUser` are not implemented.

- [ ] **Step 4: Implement refreshable token parsing and refresh**

Update `packages/github-app-node/src/oauth.ts` so the response schema and public type are:

```ts
const githubOAuthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  refresh_token_expires_in: z.number().int().positive().optional(),
  scope: z.string().optional(),
  token_type: z.string().min(1),
});

export interface GitHubUserTokenSet {
  accessToken: string;
  accessTokenExpiresIn?: number;
  refreshToken?: string;
  refreshTokenExpiresIn?: number;
  scope?: string;
  tokenType: string;
}
```

Change `exchangeGitHubOAuthCode` to return `Promise<GitHubUserTokenSet>` and map fields:

```ts
return {
  accessToken: parsed.data.access_token,
  accessTokenExpiresIn: parsed.data.expires_in,
  refreshToken: parsed.data.refresh_token,
  refreshTokenExpiresIn: parsed.data.refresh_token_expires_in,
  scope: parsed.data.scope,
  tokenType: parsed.data.token_type,
};
```

Add this function to `packages/github-app-node/src/oauth.ts`:

```ts
export interface RefreshGitHubUserAccessTokenInput {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  refreshToken: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  tokenUrl?: string;
}

export async function refreshGitHubUserAccessToken(
  input: RefreshGitHubUserAccessTokenInput
): Promise<GitHubUserTokenSet> {
  const requestFetch = input.fetch ?? fetch;
  const abortController = input.signal ? undefined : new AbortController();
  const signal = input.signal ?? abortController?.signal;
  const timeout =
    abortController === undefined
      ? undefined
      : setTimeout(
          () => abortController.abort(),
          input.timeoutMs ?? DEFAULT_GITHUB_OAUTH_EXCHANGE_TIMEOUT_MS
        );

  try {
    const res = await requestFetch(
      input.tokenUrl ?? "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        signal,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          client_id: input.clientId,
          client_secret: input.clientSecret,
          grant_type: "refresh_token",
          refresh_token: input.refreshToken,
        }),
      }
    );

    const json = await res.json().catch(() => null);
    const parsed = githubOAuthTokenResponseSchema.safeParse(json);
    if (!(res.ok && parsed.success)) {
      throw new GitHubAppNodeError(
        "GITHUB_OAUTH_EXCHANGE_FAILED",
        "GitHub OAuth token refresh failed."
      );
    }

    return {
      accessToken: parsed.data.access_token,
      accessTokenExpiresIn: parsed.data.expires_in,
      refreshToken: parsed.data.refresh_token,
      refreshTokenExpiresIn: parsed.data.refresh_token_expires_in,
      scope: parsed.data.scope,
      tokenType: parsed.data.token_type,
    };
  } catch (error) {
    if (error instanceof GitHubAppNodeError) {
      throw error;
    }
    throw new GitHubAppNodeError(
      "GITHUB_OAUTH_EXCHANGE_FAILED",
      "GitHub OAuth token refresh failed."
    );
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}
```

- [ ] **Step 5: Implement authenticated user helper**

Create `packages/github-app-node/src/user.ts`:

```ts
import { z } from "zod";
import { GitHubAppNodeError } from "./errors";

const rawAuthenticatedUserSchema = z.object({
  id: z.union([z.number(), z.string().min(1)]),
  login: z.string().min(1),
  type: z.string().min(1),
});

export interface GitHubAuthenticatedUser {
  id: string;
  login: string;
  type: "User";
}

export interface GetGitHubAuthenticatedUserInput {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  userAccessToken: string;
}

function normalizeApiBaseUrl(value: string | undefined) {
  return (value ?? "https://api.github.com").replace(/\/+$/, "");
}

export async function getGitHubAuthenticatedUser(
  input: GetGitHubAuthenticatedUserInput
): Promise<GitHubAuthenticatedUser> {
  const requestFetch = input.fetch ?? fetch;
  const url = new URL("/user", normalizeApiBaseUrl(input.apiBaseUrl));

  let res: Response;
  try {
    res = await requestFetch(url.toString(), {
      signal: input.signal,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${input.userAccessToken}`,
        ...(input.apiVersion
          ? { "x-github-api-version": input.apiVersion }
          : {}),
      },
    });
  } catch {
    throw new GitHubAppNodeError(
      "GITHUB_USER_NOT_VERIFIED",
      "GitHub authenticated user request failed."
    );
  }

  const json = await res.json().catch(() => null);
  const parsed = rawAuthenticatedUserSchema.safeParse(json);
  if (!(res.ok && parsed.success && parsed.data.type === "User")) {
    throw new GitHubAppNodeError(
      "GITHUB_USER_NOT_VERIFIED",
      "GitHub authenticated user could not be verified."
    );
  }

  return {
    id: String(parsed.data.id),
    login: parsed.data.login,
    type: "User",
  };
}
```

Update `packages/github-app-node/src/errors.ts` so the code union includes the authenticated-user failure:

```ts
export type GitHubAppNodeErrorCode =
  | "GITHUB_OAUTH_EXCHANGE_FAILED"
  | "GITHUB_USER_NOT_VERIFIED"
  | "INSTALLATION_NOT_VERIFIED"
  | "PERSONAL_ACCOUNT_NOT_SUPPORTED";
```

- [ ] **Step 6: Export helpers**

Update `packages/github-app-node/src/index.ts`:

```ts
export { createGitHubAppJwt } from "./app-jwt";
export { GitHubAppNodeError } from "./errors";
export {
  exchangeGitHubOAuthCode,
  refreshGitHubUserAccessToken,
  type GitHubUserTokenSet,
} from "./oauth";
export { createGitHubPkcePair } from "./pkce";
export {
  listGitHubUserAccessibleInstallations,
  verifyGitHubUserInstallation,
} from "./installations";
export {
  buildGitHubInstallationUrl,
  buildGitHubOAuthAuthorizeUrl,
} from "./urls";
export {
  getGitHubAuthenticatedUser,
  type GitHubAuthenticatedUser,
} from "./user";
```

- [ ] **Step 7: Run GitHub node tests**

Run:

```bash
pnpm --filter @repo/github-app-node test -- src/__tests__/oauth.test.ts src/__tests__/user.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/github-app-node/src/oauth.ts packages/github-app-node/src/user.ts packages/github-app-node/src/errors.ts packages/github-app-node/src/index.ts packages/github-app-node/src/__tests__/oauth.test.ts packages/github-app-node/src/__tests__/user.test.ts
git commit -m "feat: add github app user token helpers"
```

## Task 3: User Source-Control Account Schema

**Files:**
- Create: `db/app/src/schema/tables/user-source-control-accounts.ts`
- Modify: `db/app/src/schema/tables/index.ts`
- Modify: `db/app/src/schema/index.ts`
- Test: `db/app/src/__tests__/user-source-control-account.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `db/app/src/__tests__/user-source-control-account.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { userSourceControlAccounts } from "../schema";

describe("userSourceControlAccounts schema", () => {
  it("uses active-row uniqueness mirrors for Clerk and provider user ids", () => {
    const config = getTableConfig(userSourceControlAccounts);
    expect(config.name).toBe("lightfast_user_source_control_accounts");
    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "clerk_user_id",
        "active_clerk_user_id",
        "active_provider_user_key",
        "provider",
        "provider_user_id",
        "encrypted_access_token",
        "encrypted_refresh_token",
        "access_token_expires_at",
        "refresh_token_expires_at",
      ])
    );
    expect(config.columns.map((column) => column.name)).not.toEqual(
      expect.arrayContaining([
        "provider_login",
        "provider_avatar_url",
        "provider_profile_url",
        "provider_email",
        "metadata",
        "scope",
      ])
    );
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "user_source_control_accounts_active_user_uq",
        "user_source_control_accounts_active_provider_user_uq",
        "user_source_control_accounts_user_status_idx",
        "user_source_control_accounts_provider_user_idx",
      ])
    );
  });
});
```

- [ ] **Step 2: Run DB test to verify failure**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/user-source-control-account.test.ts
```

Expected: FAIL because the table is not defined.

- [ ] **Step 3: Add table**

Create `db/app/src/schema/tables/user-source-control-accounts.ts`:

```ts
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  text,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export type UserSourceControlAccountProvider = "github";
export type UserSourceControlAccountStatus =
  | "active"
  | "revoked"
  | "expired"
  | "error";

const CLERK_ID_LENGTH = 64;
const PROVIDER_REF_LENGTH = 128;
const ACTIVE_PROVIDER_KEY_LENGTH = 192;
const CODE_LENGTH = 32;

export const userSourceControlAccounts = mysqlTable(
  "lightfast_user_source_control_accounts",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    clerkUserId: varchar("clerk_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),
    activeClerkUserId: varchar("active_clerk_user_id", {
      length: CLERK_ID_LENGTH,
    }),
    activeProviderUserKey: varchar("active_provider_user_key", {
      length: ACTIVE_PROVIDER_KEY_LENGTH,
    }),
    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<UserSourceControlAccountProvider>()
      .notNull(),
    providerUserId: varchar("provider_user_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<UserSourceControlAccountStatus>()
      .notNull(),
    connectedAt: timestamp("connected_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date", fsp: 3 }),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
      fsp: 3,
    }).notNull(),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      mode: "date",
      fsp: 3,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    activeUserUq: uniqueIndex(
      "user_source_control_accounts_active_user_uq"
    ).on(table.activeClerkUserId),
    activeProviderUserUq: uniqueIndex(
      "user_source_control_accounts_active_provider_user_uq"
    ).on(table.activeProviderUserKey),
    userStatusIdx: index("user_source_control_accounts_user_status_idx").on(
      table.clerkUserId,
      table.status
    ),
    providerUserIdx: index(
      "user_source_control_accounts_provider_user_idx"
    ).on(table.provider, table.providerUserId),
  })
);

type UserSourceControlAccountRow =
  typeof userSourceControlAccounts.$inferSelect;
export type UserSourceControlAccount = Omit<
  UserSourceControlAccountRow,
  "activeClerkUserId" | "activeProviderUserKey"
>;
export type InsertUserSourceControlAccount =
  typeof userSourceControlAccounts.$inferInsert;
```

- [ ] **Step 4: Export table types**

Add to `db/app/src/schema/tables/index.ts`:

```ts
export {
  type InsertUserSourceControlAccount,
  type UserSourceControlAccount,
  type UserSourceControlAccountProvider,
  type UserSourceControlAccountStatus,
  userSourceControlAccounts,
} from "./user-source-control-accounts";
```

Add the same symbols to the export list in `db/app/src/schema/index.ts`.

- [ ] **Step 5: Run DB schema test**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/user-source-control-account.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/app/src/schema/tables/user-source-control-accounts.ts db/app/src/schema/tables/index.ts db/app/src/schema/index.ts db/app/src/__tests__/user-source-control-account.test.ts
git commit -m "feat: add user source control account schema"
```

## Task 4: User Source-Control Account Repository Helpers

**Files:**
- Create: `db/app/src/utils/user-source-control-account.ts`
- Modify: `db/app/src/index.ts`
- Test: `db/app/src/__tests__/user-source-control-account.test.ts`

- [ ] **Step 1: Add failing helper tests**

Append to `db/app/src/__tests__/user-source-control-account.test.ts`:

```ts
import type { Database } from "../client";
import type { UserSourceControlAccount } from "../schema";
import {
  activeProviderUserKey,
  finalizeActiveUserSourceControlAccount,
  markUserSourceControlAccountRevoked,
} from "../utils/user-source-control-account";

function account(overrides: Partial<UserSourceControlAccount> = {}): UserSourceControlAccount {
  return {
    id: 1,
    clerkUserId: "user_1",
    provider: "github",
    providerUserId: "12345",
    status: "active",
    connectedAt: new Date("2026-05-30T00:00:00.000Z"),
    revokedAt: null,
    encryptedAccessToken: "encrypted_access",
    encryptedRefreshToken: "encrypted_refresh",
    accessTokenExpiresAt: new Date("2026-05-30T08:00:00.000Z"),
    refreshTokenExpiresAt: new Date("2026-11-30T00:00:00.000Z"),
    createdAt: new Date("2026-05-30T00:00:00.000Z"),
    updatedAt: new Date("2026-05-30T00:00:00.000Z"),
    ...overrides,
  };
}

it("builds active provider user keys from stable provider ids", () => {
  expect(activeProviderUserKey("github", "12345")).toBe("github:12345");
});

it("finalizes new active user account rows with active uniqueness mirrors", async () => {
  const inserted = account();
  const returningId = vi.fn(() => Promise.resolve([{ id: 1 }]));
  const values = vi.fn(() => ({ $returningId: returningId }));
  const insert = vi.fn(() => ({ values }));
  const limit = vi.fn(() => Promise.resolve([inserted]));
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const db = { insert, select } as unknown as Database;

  await expect(
    finalizeActiveUserSourceControlAccount(db, {
      accessTokenExpiresAt: inserted.accessTokenExpiresAt,
      clerkUserId: "user_1",
      encryptedAccessToken: "encrypted_access",
      encryptedRefreshToken: "encrypted_refresh",
      provider: "github",
      providerUserId: "12345",
      refreshTokenExpiresAt: inserted.refreshTokenExpiresAt,
    })
  ).resolves.toMatchObject({ clerkUserId: "user_1", providerUserId: "12345" });

  expect(values).toHaveBeenCalledWith(
    expect.objectContaining({
      activeClerkUserId: "user_1",
      activeProviderUserKey: "github:12345",
      status: "active",
    })
  );
});

it("revokes active user account rows by clearing active mirrors", async () => {
  const active = account();
  const selectLimit = vi.fn(() => Promise.resolve([active]));
  const selectWhere = vi.fn(() => ({ limit: selectLimit }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi
    .fn()
    .mockReturnValueOnce({ from: selectFrom })
    .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ ...active, status: "revoked", revokedAt: expect.any(Date) }]) }) });
  const updateWhere = vi.fn(() => Promise.resolve({ affectedRows: 1 }));
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));
  const db = { select, update } as unknown as Database;

  await markUserSourceControlAccountRevoked(db, { clerkUserId: "user_1" });

  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({
      activeClerkUserId: null,
      activeProviderUserKey: null,
      status: "revoked",
      revokedAt: expect.any(Date),
    })
  );
});
```

- [ ] **Step 2: Run DB helper tests to verify failure**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/user-source-control-account.test.ts
```

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement helper module**

Create `db/app/src/utils/user-source-control-account.ts` with these exports and behavior:

```ts
import { and, eq, getTableColumns } from "drizzle-orm";
import type { Database } from "../client";
import type {
  UserSourceControlAccount,
  UserSourceControlAccountProvider,
} from "../schema";
import { userSourceControlAccounts } from "../schema";

const {
  activeClerkUserId: _activeClerkUserId,
  activeProviderUserKey: _activeProviderUserKey,
  ...accountSelection
} = getTableColumns(userSourceControlAccounts);

export function activeProviderUserKey(
  provider: UserSourceControlAccountProvider,
  providerUserId: string
) {
  return `${provider}:${providerUserId}`;
}

export async function getActiveUserSourceControlAccount(
  db: Database,
  clerkUserId: string
): Promise<UserSourceControlAccount | undefined> {
  const [row] = await db
    .select(accountSelection)
    .from(userSourceControlAccounts)
    .where(
      and(
        eq(userSourceControlAccounts.clerkUserId, clerkUserId),
        eq(userSourceControlAccounts.status, "active")
      )
    )
    .limit(1);
  return row;
}

export async function isUserSourceControlBound(
  db: Database,
  clerkUserId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: userSourceControlAccounts.id })
    .from(userSourceControlAccounts)
    .where(
      and(
        eq(userSourceControlAccounts.clerkUserId, clerkUserId),
        eq(userSourceControlAccounts.status, "active")
      )
    )
    .limit(1);
  return row !== undefined;
}

export async function getUserSourceControlAccountByProviderUser(
  db: Database,
  input: {
    provider: UserSourceControlAccountProvider;
    providerUserId: string;
  }
): Promise<UserSourceControlAccount | undefined> {
  const [row] = await db
    .select(accountSelection)
    .from(userSourceControlAccounts)
    .where(
      and(
        eq(userSourceControlAccounts.provider, input.provider),
        eq(userSourceControlAccounts.providerUserId, input.providerUserId)
      )
    )
    .limit(1);
  return row;
}
```

Then add `finalizeActiveUserSourceControlAccount`, `markUserSourceControlAccountRevoked`, and `markUserSourceControlAccountExpired` with these concrete rules:

- If the Clerk user already has an active row for the same `provider` and `providerUserId`, update encrypted tokens and expiration timestamps on that row and return it.
- If the Clerk user already has an active row for a different provider user, throw `LIGHTFAST_USER_ALREADY_BOUND`.
- If another Clerk user has an active row for the same provider user, throw `PROVIDER_USER_ALREADY_BOUND`.
- If the same Clerk user has an inactive historical row for the same provider user, reactivate that row by restoring both active mirrors and replacing encrypted tokens and expiration timestamps.
- If no matching row exists, insert a new active row.

The new active insert values must be:

```ts
{
  activeClerkUserId: input.clerkUserId,
  activeProviderUserKey: activeProviderUserKey(input.provider, input.providerUserId),
  clerkUserId: input.clerkUserId,
  provider: input.provider,
  providerUserId: input.providerUserId,
  encryptedAccessToken: input.encryptedAccessToken,
  encryptedRefreshToken: input.encryptedRefreshToken,
  accessTokenExpiresAt: input.accessTokenExpiresAt,
  refreshTokenExpiresAt: input.refreshTokenExpiresAt,
  revokedAt: null,
  status: "active",
}
```

`markUserSourceControlAccountRevoked` must select the active row for `clerkUserId`, update only that row by `id`, set `activeClerkUserId: null`, `activeProviderUserKey: null`, `status: "revoked"`, and `revokedAt: new Date()`, then return the revoked row or `undefined`.

`markUserSourceControlAccountExpired` must select the active row for `clerkUserId`, update only that row by `id`, set `activeClerkUserId: null`, `activeProviderUserKey: null`, `status: "expired"`, and `revokedAt: null`, then return the expired row or `undefined`.

Define conflicts:

```ts
export type UserSourceControlAccountConflictCode =
  | "LIGHTFAST_USER_ALREADY_BOUND"
  | "PROVIDER_USER_ALREADY_BOUND";

export class UserSourceControlAccountConflictError extends Error {
  constructor(
    public readonly code: UserSourceControlAccountConflictCode,
    message: string
  ) {
    super(message);
    this.name = "UserSourceControlAccountConflictError";
  }
}
```

- [ ] **Step 4: Export helpers from `@db/app`**

Update `db/app/src/index.ts` to export:

```ts
export {
  activeProviderUserKey,
  finalizeActiveUserSourceControlAccount,
  getActiveUserSourceControlAccount,
  getUserSourceControlAccountByProviderUser,
  isUserSourceControlBound,
  markUserSourceControlAccountExpired,
  markUserSourceControlAccountRevoked,
  UserSourceControlAccountConflictError,
  type UserSourceControlAccountConflictCode,
} from "./utils/user-source-control-account";
```

- [ ] **Step 5: Run DB tests**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/user-source-control-account.test.ts
pnpm --filter @db/app typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/app/src/utils/user-source-control-account.ts db/app/src/index.ts db/app/src/__tests__/user-source-control-account.test.ts
git commit -m "feat: add user source control account helpers"
```

## Task 5: API Environment, Dependencies, And User OAuth Attempts

**Files:**
- Modify: `api/app/package.json`
- Modify: `api/app/src/env.ts`
- Create: `api/app/src/services/github/user-account/attempts.ts`
- Create: `api/app/src/services/github/user-account/callbacks.ts`
- Create: `api/app/src/services/github/user-account/redirects.ts`
- Test: `api/app/src/__tests__/github-user-account-attempts.test.ts`
- Test: `api/app/src/__tests__/github-user-account-redirects.test.ts`

- [ ] **Step 1: Add failing attempt tests**

Create `api/app/src/__tests__/github-user-account-attempts.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const redisSetMock = vi.fn();
const redisGetMock = vi.fn();
const redisGetdelMock = vi.fn();
const nanoidMock = vi.fn();

vi.mock("@vendor/upstash", () => ({
  redis: { get: redisGetMock, getdel: redisGetdelMock, set: redisSetMock },
}));

vi.mock("@vendor/lib", () => ({
  nanoid: nanoidMock,
}));

const {
  consumeGitHubUserAccountOAuthAttempt,
  issueGitHubUserAccountOAuthAttempt,
  lookupGitHubUserAccountOAuthAttempt,
} = await import("../services/github/user-account/attempts");

beforeEach(() => {
  redisSetMock.mockReset();
  redisGetMock.mockReset();
  redisGetdelMock.mockReset();
  nanoidMock.mockReset();
  nanoidMock.mockReturnValue("attempt_123456789012345678901234");
});

describe("github user account OAuth attempts", () => {
  it("issues and consumes hashed-state user account OAuth attempts", async () => {
    const issued = await issueGitHubUserAccountOAuthAttempt({
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
      returnTo: "/account/tasks/github",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    expect(record).toEqual({
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
      returnTo: "/account/tasks/github",
      stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    redisGetMock.mockResolvedValueOnce(record);
    redisGetdelMock.mockResolvedValueOnce(record);

    await expect(
      consumeGitHubUserAccountOAuthAttempt({ state: issued.state })
    ).resolves.toMatchObject({
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
    });

    expect(redisSetMock).toHaveBeenCalledWith(
      "github-user-account-oauth-attempt:attempt_123456789012345678901234",
      record,
      { ex: 900 }
    );
  });

  it("looks up attempts without deleting them", async () => {
    const issued = await issueGitHubUserAccountOAuthAttempt({
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    redisGetMock.mockResolvedValueOnce(record);

    await expect(
      lookupGitHubUserAccountOAuthAttempt({ state: issued.state })
    ).resolves.toMatchObject({
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
    });
    expect(redisGetdelMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Add failing callback and redirect tests**

Create `api/app/src/__tests__/github-user-account-redirects.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseGitHubUserAccountOAuthCallback } from "../services/github/user-account/callbacks";
import {
  accountTaskErrorRedirect,
  accountTaskUrl,
  userAccountCompleteUrl,
} from "../services/github/user-account/redirects";

describe("github user account callback and redirects", () => {
  it("parses user account OAuth callbacks", () => {
    expect(
      parseGitHubUserAccountOAuthCallback(
        "https://app.lightfast.localhost/api/github/user/oauth/callback?code=abc&state=def"
      )
    ).toEqual({ code: "abc", denied: null, state: "def" });
  });

  it("builds account task redirects", () => {
    expect(
      accountTaskUrl({ appOrigin: "https://app.lightfast.localhost" })
    ).toBe("https://app.lightfast.localhost/account/tasks/github");
    expect(
      userAccountCompleteUrl({
        appOrigin: "https://app.lightfast.localhost",
        returnTo: "/account/tasks/github",
      })
    ).toBe(
      "https://app.lightfast.localhost/account/tasks/github/complete?return_to=%2Faccount%2Ftasks%2Fgithub"
    );
    expect(
      accountTaskErrorRedirect({
        appOrigin: "https://app.lightfast.localhost",
        code: "missing_refresh_token",
      }).redirectUrl
    ).toBe(
      "https://app.lightfast.localhost/account/tasks/github?github_error=missing_refresh_token"
    );
  });
});
```

- [ ] **Step 3: Run API tests to verify failure**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-user-account-attempts.test.ts src/__tests__/github-user-account-redirects.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Add dependency and env key**

Add to `api/app/package.json` dependencies:

```json
"@repo/app-encryption": "workspace:*"
```

In `api/app/src/env.ts`, add the reusable validation:

```ts
const encryptionKeySchema = z
  .string()
  .refine(
    (key) =>
      /^[0-9a-f]{64}$/i.test(key) || /^[A-Za-z0-9+/]{43}=$/.test(key),
    "ENCRYPTION_KEY must be 32 bytes as 64 hex chars or 44 base64 chars"
  );
```

Add to `server`:

```ts
ENCRYPTION_KEY:
  process.env.VERCEL_ENV === "development"
    ? encryptionKeySchema.default(
        "0000000000000000000000000000000000000000000000000000000000000000"
      )
    : encryptionKeySchema,
```

Add to `experimental__runtimeEnv`:

```ts
ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
```

- [ ] **Step 5: Implement attempts**

Create `api/app/src/services/github/user-account/attempts.ts` by adapting the state envelope pattern from `api/app/src/services/github/setup/attempts.ts` with this prefix and record:

```ts
const USER_ACCOUNT_OAUTH_PREFIX = "github-user-account-oauth-attempt:";
const TTL_SECONDS = 15 * 60;

export interface GitHubUserAccountOAuthAttemptRecord {
  codeVerifier: string;
  lightfastUserId: string;
  returnTo?: string;
  stateHash: string;
}
```

Export:

```ts
export async function issueGitHubUserAccountOAuthAttempt(input: {
  codeVerifier: string;
  lightfastUserId: string;
  returnTo?: string;
}): Promise<{ attemptId: string; state: string }>;

export async function lookupGitHubUserAccountOAuthAttempt(input: {
  state: string;
}): Promise<GitHubUserAccountOAuthAttemptRecord | null>;

export async function consumeGitHubUserAccountOAuthAttempt(input: {
  state: string;
}): Promise<GitHubUserAccountOAuthAttemptRecord | null>;
```

The record stored in Redis must include `returnTo` only when the input includes it.

- [ ] **Step 6: Implement callbacks and redirects**

Create `api/app/src/services/github/user-account/callbacks.ts`:

```ts
export interface GitHubUserAccountOAuthCallback {
  code: string | null;
  denied: string | null;
  state: string | null;
}

export function parseGitHubUserAccountOAuthCallback(
  requestUrl: string
): GitHubUserAccountOAuthCallback {
  const url = new URL(requestUrl);
  return {
    code: url.searchParams.get("code"),
    denied: url.searchParams.get("error"),
    state: url.searchParams.get("state"),
  };
}
```

Create `api/app/src/services/github/user-account/redirects.ts`:

```ts
import type { GitHubUserAccountBindErrorCode } from "@repo/github-app-contract";

export interface GitHubUserAccountRedirectResult {
  redirectUrl: string;
}

export function accountTaskUrl(input: { appOrigin: string }): string {
  return new URL("/account/tasks/github", input.appOrigin).toString();
}

export function userAccountCompleteUrl(input: {
  appOrigin: string;
  returnTo?: string;
}): string {
  const url = new URL("/account/tasks/github/complete", input.appOrigin);
  if (input.returnTo) {
    url.searchParams.set("return_to", input.returnTo);
  }
  return url.toString();
}

export function accountTaskErrorRedirect(input: {
  appOrigin: string;
  code: GitHubUserAccountBindErrorCode;
}): GitHubUserAccountRedirectResult {
  const url = new URL("/account/tasks/github", input.appOrigin);
  url.searchParams.set("github_error", input.code);
  return { redirectUrl: url.toString() };
}

export function missingUserAccountAttemptRedirect(input: {
  appOrigin: string;
}): GitHubUserAccountRedirectResult {
  return accountTaskErrorRedirect({
    appOrigin: input.appOrigin,
    code: "expired_state",
  });
}

export function userAccountSignInRedirect(input: {
  appOrigin: string;
  requestUrl: string;
}): GitHubUserAccountRedirectResult {
  const callbackUrl = new URL(input.requestUrl);
  const signInUrl = new URL("/sign-in", input.appOrigin);
  signInUrl.searchParams.set(
    "redirect_url",
    `${callbackUrl.pathname}${callbackUrl.search}`
  );
  return { redirectUrl: signInUrl.toString() };
}
```

- [ ] **Step 7: Run focused API tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-user-account-attempts.test.ts src/__tests__/github-user-account-redirects.test.ts
pnpm install --lockfile-only
```

Expected: tests PASS and lockfile updates if needed.

- [ ] **Step 8: Commit**

```bash
git add api/app/package.json pnpm-lock.yaml api/app/src/env.ts api/app/src/services/github/user-account/attempts.ts api/app/src/services/github/user-account/callbacks.ts api/app/src/services/github/user-account/redirects.ts api/app/src/__tests__/github-user-account-attempts.test.ts api/app/src/__tests__/github-user-account-redirects.test.ts
git commit -m "feat: add github user account oauth attempts"
```

## Task 6: API User Account Flow, Encryption, Refresh, And Gate

**Files:**
- Create: `api/app/src/services/github/user-account/errors.ts`
- Create: `api/app/src/services/github/user-account/finalize-account.ts`
- Create: `api/app/src/services/github/user-account/refresh.ts`
- Create: `api/app/src/services/github/user-account/gate.ts`
- Create: `api/app/src/services/github/user-account/flow.ts`
- Modify: `api/app/src/services/github/index.ts`
- Test: `api/app/src/__tests__/github-user-account-flow.test.ts`
- Test: `api/app/src/__tests__/github-user-account-refresh.test.ts`

- [ ] **Step 1: Write failing flow tests**

Create `api/app/src/__tests__/github-user-account-flow.test.ts` with mocks following `api/app/src/__tests__/github-setup-flow.test.ts`. Include these test cases:

```ts
it("starts user account OAuth with the user callback redirect uri", async () => {
  createGitHubPkcePairMock.mockReturnValue({
    codeChallenge: "challenge_123",
    codeChallengeMethod: "S256",
    codeVerifier: "verifier_123",
  });
  issueAttemptMock.mockResolvedValue({
    attemptId: "attempt_1",
    state: "state_123",
  });

  await expect(
    startGitHubUserAccountBinding({
      lightfastUserId: "user_1",
      returnTo: "/account/tasks/github",
    })
  ).resolves.toEqual({
    authorizationUrl:
      "https://github.lightfast.localhost/login/oauth/authorize?client_id=github_client_test&redirect_uri=https%3A%2F%2Fapp.lightfast.localhost%2Fapi%2Fgithub%2Fuser%2Foauth%2Fcallback&state=state_123&code_challenge=challenge_123&code_challenge_method=S256",
  });
});

it("requires refreshable token fields before finalizing", async () => {
  mockAttempt();
  authMock.mockResolvedValue({ userId: "user_1" });
  exchangeGitHubOAuthCodeMock.mockResolvedValue({
    accessToken: "ghu_access",
    tokenType: "bearer",
  });

  const result = await completeGitHubUserAccountOAuth({
    requestUrl:
      "https://app.lightfast.localhost/api/github/user/oauth/callback?code=abc&state=state_123",
  });

  expect(result.redirectUrl).toBe(
    "https://app.lightfast.localhost/account/tasks/github?github_error=missing_refresh_token"
  );
  expect(finalizeActiveUserSourceControlAccountMock).not.toHaveBeenCalled();
});

it("finalizes encrypted credentials for the verified GitHub user id", async () => {
  mockAttempt();
  authMock.mockResolvedValue({ userId: "user_1" });
  exchangeGitHubOAuthCodeMock.mockResolvedValue({
    accessToken: "ghu_access",
    accessTokenExpiresIn: 28_800,
    refreshToken: "ghr_refresh",
    refreshTokenExpiresIn: 15_768_000,
    scope: "",
    tokenType: "bearer",
  });
  getGitHubAuthenticatedUserMock.mockResolvedValue({
    id: "12345",
    login: "lightfast-dev",
    type: "User",
  });
  encryptMock
    .mockResolvedValueOnce("encrypted_access")
    .mockResolvedValueOnce("encrypted_refresh");

  await completeGitHubUserAccountOAuth({
    requestUrl:
      "https://app.lightfast.localhost/api/github/user/oauth/callback?code=abc&state=state_123",
  });

  expect(finalizeActiveUserSourceControlAccountMock).toHaveBeenCalledWith(
    {},
    expect.objectContaining({
      clerkUserId: "user_1",
      encryptedAccessToken: "encrypted_access",
      encryptedRefreshToken: "encrypted_refresh",
      provider: "github",
      providerUserId: "12345",
    })
  );
});
```

- [ ] **Step 2: Write failing refresh tests**

Create `api/app/src/__tests__/github-user-account-refresh.test.ts`:

```ts
it("returns the existing decrypted access token outside the refresh window", async () => {
  getActiveUserSourceControlAccountMock.mockResolvedValue({
    accessTokenExpiresAt: new Date("2026-05-30T12:00:00.000Z"),
    encryptedAccessToken: "encrypted_access",
    encryptedRefreshToken: "encrypted_refresh",
    refreshTokenExpiresAt: new Date("2026-11-30T00:00:00.000Z"),
    status: "active",
  });
  decryptMock.mockResolvedValueOnce("ghu_access");

  await expect(
    getFreshGitHubUserAccessToken({
      db: {},
      clerkUserId: "user_1",
      now: () => new Date("2026-05-30T00:00:00.000Z"),
      refreshWindowMs: 60 * 60 * 1000,
    })
  ).resolves.toEqual({ accessToken: "ghu_access" });
});

it("refreshes and persists rotated tokens inside the refresh window", async () => {
  getActiveUserSourceControlAccountMock.mockResolvedValue({
    id: 1,
    accessTokenExpiresAt: new Date("2026-05-30T00:30:00.000Z"),
    encryptedAccessToken: "encrypted_access",
    encryptedRefreshToken: "encrypted_refresh",
    refreshTokenExpiresAt: new Date("2026-11-30T00:00:00.000Z"),
    status: "active",
  });
  decryptMock.mockResolvedValueOnce("ghr_refresh");
  refreshGitHubUserAccessTokenMock.mockResolvedValue({
    accessToken: "ghu_next",
    accessTokenExpiresIn: 28_800,
    refreshToken: "ghr_next",
    refreshTokenExpiresIn: 15_768_000,
  });
  encryptMock
    .mockResolvedValueOnce("encrypted_next_access")
    .mockResolvedValueOnce("encrypted_next_refresh");

  await expect(
    getFreshGitHubUserAccessToken({
      db: {},
      clerkUserId: "user_1",
      now: () => new Date("2026-05-30T00:00:00.000Z"),
      refreshWindowMs: 60 * 60 * 1000,
    })
  ).resolves.toEqual({ accessToken: "ghu_next" });
});
```

- [ ] **Step 3: Run API flow tests to verify failure**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-user-account-flow.test.ts src/__tests__/github-user-account-refresh.test.ts
```

Expected: FAIL because user account flow modules do not exist.

- [ ] **Step 4: Implement error mapping**

Create `api/app/src/services/github/user-account/errors.ts`:

```ts
import { UserSourceControlAccountConflictError } from "@db/app";
import type { GitHubUserAccountBindErrorCode } from "@repo/github-app-contract";
import { GitHubAppNodeError } from "@repo/github-app-node";

export function mapGitHubUserAccountError(
  error: unknown
): GitHubUserAccountBindErrorCode {
  if (error instanceof UserSourceControlAccountConflictError) {
    return error.code === "PROVIDER_USER_ALREADY_BOUND"
      ? "github_account_already_bound"
      : "lightfast_user_already_bound";
  }

  if (error instanceof GitHubAppNodeError) {
    return error.code === "GITHUB_USER_NOT_VERIFIED"
      ? "github_user_not_verified"
      : "github_transient_error";
  }

  return "github_transient_error";
}
```

- [ ] **Step 5: Implement finalize and status helpers**

Create `api/app/src/services/github/user-account/finalize-account.ts`:

```ts
import { finalizeActiveUserSourceControlAccount } from "@db/app";
import { db } from "@db/app/client";
import { encrypt } from "@repo/app-encryption";
import { env } from "../../../env";

export async function finalizeGitHubUserAccountBinding(input: {
  accessToken: string;
  accessTokenExpiresAt: Date;
  clerkUserId: string;
  providerUserId: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}) {
  const [encryptedAccessToken, encryptedRefreshToken] = await Promise.all([
    encrypt(input.accessToken, env.ENCRYPTION_KEY),
    encrypt(input.refreshToken, env.ENCRYPTION_KEY),
  ]);

  return finalizeActiveUserSourceControlAccount(db, {
    accessTokenExpiresAt: input.accessTokenExpiresAt,
    clerkUserId: input.clerkUserId,
    encryptedAccessToken,
    encryptedRefreshToken,
    provider: "github",
    providerUserId: input.providerUserId,
    refreshTokenExpiresAt: input.refreshTokenExpiresAt,
  });
}
```

- [ ] **Step 6: Implement refresh helper**

Create `api/app/src/services/github/user-account/refresh.ts` with `getFreshGitHubUserAccessToken`. It must:

- load `getActiveUserSourceControlAccount(db, clerkUserId)`,
- throw a typed missing-account error when no active row exists,
- decrypt only the refresh token when refresh is needed,
- call `refreshGitHubUserAccessToken`,
- require `refreshToken`, `accessTokenExpiresIn`, and `refreshTokenExpiresIn`,
- encrypt the returned token set,
- update the same row by `id` and `status: "active"`,
- mark expired/revoked rows when provider errors indicate terminal credential failure.

Use this public signature:

```ts
export async function getFreshGitHubUserAccessToken(input: {
  clerkUserId: string;
  db: Database;
  now?: () => Date;
  refreshWindowMs?: number;
}): Promise<{ accessToken: string }>;
```

- [ ] **Step 7: Implement flow orchestration**

Create `api/app/src/services/github/user-account/flow.ts` with these exports:

```ts
export async function startGitHubUserAccountBinding(input: {
  lightfastUserId: string;
  returnTo?: string;
}): Promise<{ authorizationUrl: string }>;

export async function completeGitHubUserAccountOAuth(input: {
  appOrigin?: string;
  requestUrl: string;
}): Promise<GitHubUserAccountRedirectResult>;

export async function getGitHubUserAccountStatus(input: {
  clerkUserId: string;
}): Promise<{
  account: null | {
    accessTokenExpiresAt: Date;
    connectedAt: Date;
    provider: "github";
    providerUserId: string;
    refreshTokenExpiresAt: Date;
    status: "active";
  };
}>;

export async function disconnectGitHubUserAccount(input: {
  clerkUserId: string;
}): Promise<{ ok: true }>;
```

Use `GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH` for redirect URI and call `auth()` from `@vendor/clerk/server` in callback verification. If `auth()` returns no `userId`, redirect through `userAccountSignInRedirect` without consuming the attempt. If `auth().userId !== attempt.lightfastUserId`, consume nothing and redirect with `permission_required`.

- [ ] **Step 8: Implement gate helper**

Create `api/app/src/services/github/user-account/gate.ts`:

```ts
import { getActiveUserSourceControlAccount } from "@db/app";
import type { Database } from "@db/app";
import { throwDiagnostic } from "../../../diagnostics";

export async function requireGitHubUserAccount(input: {
  clerkUserId: string;
  db: Database;
}) {
  const account = await getActiveUserSourceControlAccount(
    input.db,
    input.clerkUserId
  );
  if (!account) {
    throwDiagnostic({
      trpcCode: "FORBIDDEN",
      diagnostic: {
        code: "GITHUB_USER_ACCOUNT_REQUIRED",
        message: "Connect your GitHub account before using this feature.",
        repair: { id: "connect-github-account" },
      },
    });
  }
  return account;
}
```

- [ ] **Step 9: Export service entrypoints**

Update `api/app/src/services/github/index.ts`:

```ts
export {
  completeGitHubUserAccountOAuth,
  disconnectGitHubUserAccount,
  getGitHubUserAccountStatus,
  startGitHubUserAccountBinding,
} from "./user-account/flow";
export { getFreshGitHubUserAccessToken } from "./user-account/refresh";
export { requireGitHubUserAccount } from "./user-account/gate";
```

Keep existing org setup exports.

- [ ] **Step 10: Run API tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-user-account-flow.test.ts src/__tests__/github-user-account-refresh.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add api/app/src/services/github/index.ts api/app/src/services/github/user-account api/app/src/__tests__/github-user-account-flow.test.ts api/app/src/__tests__/github-user-account-refresh.test.ts
git commit -m "feat: add github user account service"
```

## Task 7: Viewer tRPC Router

**Files:**
- Create: `api/app/src/router/(pending-allowed)/github-account.ts`
- Modify: `api/app/src/root.ts`
- Test: `api/app/src/__tests__/github-account-router.test.ts`

- [ ] **Step 1: Write failing router tests**

Create `api/app/src/__tests__/github-account-router.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const getStatusMock = vi.fn();
const startMock = vi.fn();
const disconnectMock = vi.fn();

vi.mock("../services/github", () => ({
  disconnectGitHubUserAccount: disconnectMock,
  getGitHubUserAccountStatus: getStatusMock,
  startGitHubUserAccountBinding: startMock,
}));

const { appRouter } = await import("../root");

function caller(userId = "user_1") {
  return appRouter.createCaller({
    auth: { identity: { type: "pending", userId } },
    db: {},
    headers: new Headers(),
  } as never).viewer.githubAccount;
}

beforeEach(() => {
  getStatusMock.mockReset();
  startMock.mockReset();
  disconnectMock.mockReset();
});

describe("viewer.githubAccount router", () => {
  it("returns the current user's GitHub account status", async () => {
    getStatusMock.mockResolvedValue({ account: null });
    await expect(caller().status()).resolves.toEqual({ account: null });
    expect(getStatusMock).toHaveBeenCalledWith({ clerkUserId: "user_1" });
  });

  it("starts binding for the signed-in user", async () => {
    startMock.mockResolvedValue({ authorizationUrl: "https://github.test/oauth" });
    await expect(
      caller().start({ returnTo: "/account/tasks/github" })
    ).resolves.toEqual({ authorizationUrl: "https://github.test/oauth" });
    expect(startMock).toHaveBeenCalledWith({
      lightfastUserId: "user_1",
      returnTo: "/account/tasks/github",
    });
  });

  it("disconnects the signed-in user's account", async () => {
    disconnectMock.mockResolvedValue({ ok: true });
    await expect(caller().disconnect()).resolves.toEqual({ ok: true });
    expect(disconnectMock).toHaveBeenCalledWith({ clerkUserId: "user_1" });
  });
});
```

- [ ] **Step 2: Run router tests to verify failure**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-account-router.test.ts
```

Expected: FAIL because `viewer.githubAccount` does not exist.

- [ ] **Step 3: Implement router**

Create `api/app/src/router/(pending-allowed)/github-account.ts`:

```ts
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import {
  disconnectGitHubUserAccount,
  getGitHubUserAccountStatus,
  startGitHubUserAccountBinding,
} from "../../services/github";
import { viewerProcedure } from "../../trpc";

const returnToSchema = z
  .string()
  .startsWith("/")
  .max(512)
  .optional();

export const githubAccountRouter = {
  status: viewerProcedure.query(async ({ ctx }) =>
    getGitHubUserAccountStatus({
      clerkUserId: ctx.auth.identity.userId,
    })
  ),
  start: viewerProcedure
    .input(z.object({ returnTo: returnToSchema }))
    .mutation(async ({ ctx, input }) =>
      startGitHubUserAccountBinding({
        lightfastUserId: ctx.auth.identity.userId,
        returnTo: input.returnTo,
      })
    ),
  sync: viewerProcedure.mutation(async ({ ctx }) =>
    getGitHubUserAccountStatus({
      clerkUserId: ctx.auth.identity.userId,
    })
  ),
  disconnect: viewerProcedure.mutation(async ({ ctx }) =>
    disconnectGitHubUserAccount({
      clerkUserId: ctx.auth.identity.userId,
    })
  ),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 4: Mount router**

Update `api/app/src/root.ts`:

```ts
import { githubAccountRouter } from "./router/(pending-allowed)/github-account";
```

Inside `viewer`:

```ts
viewer: createTRPCRouter({
  organization: organizationRouter,
  account: accountRouter,
  githubAccount: githubAccountRouter,
}),
```

- [ ] **Step 5: Run router tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-account-router.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/app/src/router/'(pending-allowed)'/github-account.ts api/app/src/root.ts api/app/src/__tests__/github-account-router.test.ts
git commit -m "feat: expose github user account router"
```

## Task 8: Next Callback Route And Proxy Admission

**Files:**
- Create: `apps/app/src/app/(app)/(github)/api/github/user/oauth/callback/route.ts`
- Modify: `apps/app/src/proxy.ts`
- Test: `apps/app/src/__tests__/app/api/github/github-routes.test.ts`
- Test: `apps/app/src/__tests__/proxy.test.ts`

- [ ] **Step 1: Write failing route handler test**

Add to `apps/app/src/__tests__/app/api/github/github-routes.test.ts`:

```ts
const completeUserAccountOAuthMock = vi.fn();

vi.mock("@api/app/services/github", () => ({
  completeGitHubInstallationSetup: completeSetupMock,
  completeGitHubOAuthVerification: completeOAuthMock,
  completeGitHubUserAccountOAuth: completeUserAccountOAuthMock,
}));

it("delegates user account OAuth callbacks without deriving app origin in the route", async () => {
  completeUserAccountOAuthMock.mockResolvedValue({
    redirectUrl:
      "https://app.lightfast.localhost/account/tasks/github/complete",
  });
  const { GET } = await import(
    "~/app/(app)/(github)/api/github/user/oauth/callback/route"
  );

  const res = await GET(
    new Request(
      "https://localhost:4293/api/github/user/oauth/callback?code=abc&state=def"
    )
  );

  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toBe(
    "https://app.lightfast.localhost/account/tasks/github/complete"
  );
  expect(completeUserAccountOAuthMock).toHaveBeenCalledWith({
    requestUrl:
      "https://localhost:4293/api/github/user/oauth/callback?code=abc&state=def",
  });
});
```

- [ ] **Step 2: Add failing proxy test**

Append near existing GitHub proxy tests in `apps/app/src/__tests__/proxy.test.ts`:

```ts
it("keeps GitHub user account OAuth callback public for expired tokens", async () => {
  authMock.mockResolvedValue({
    orgId: null,
    orgSlug: null,
    sessionClaims: null,
    sessionStatus: "active",
    userId: null,
  });

  const { response } = await invoke("/api/github/user/oauth/callback");

  expect(response.status).not.toBe(307);
  expect(clerkProxyRequestMock).toHaveBeenCalledWith(
    "/api/github/user/oauth/callback"
  );
});
```

- [ ] **Step 3: Run app tests to verify failure**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/app/api/github/github-routes.test.ts src/__tests__/proxy.test.ts
```

Expected: FAIL because the route and proxy pattern are missing.

- [ ] **Step 4: Implement route handler**

Create `apps/app/src/app/(app)/(github)/api/github/user/oauth/callback/route.ts`:

```ts
import { completeGitHubUserAccountOAuth } from "@api/app/services/github";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const result = await completeGitHubUserAccountOAuth({
    requestUrl: req.url,
  });
  return NextResponse.redirect(result.redirectUrl);
}
```

- [ ] **Step 5: Admit route in proxy**

Update `apps/app/src/proxy.ts`:

```ts
const GITHUB_BINDING_ROUTE_PATTERNS = [
  "/api/github/setup",
  "/api/github/oauth/callback",
  "/api/github/user/oauth/callback",
] as const;
```

- [ ] **Step 6: Run app tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/app/api/github/github-routes.test.ts src/__tests__/proxy.test.ts
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/app/src/app/'(app)'/'(github)'/api/github/user/oauth/callback/route.ts apps/app/src/proxy.ts apps/app/src/__tests__/app/api/github/github-routes.test.ts apps/app/src/__tests__/proxy.test.ts
git commit -m "feat: add github user oauth callback route"
```

## Task 9: Account Task UI

**Files:**
- Create: `apps/app/src/app/(app)/(pending-allowed)/account/tasks/github/page.tsx`
- Create: `apps/app/src/app/(app)/(pending-allowed)/account/tasks/github/_components/github-account-task-client.tsx`
- Create: `apps/app/src/app/(app)/(pending-allowed)/account/tasks/github/complete/page.tsx`
- Create: `apps/app/src/app/(app)/(pending-allowed)/account/tasks/github/complete/_components/github-account-complete-client.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/tasks/github/github-account-task-page.test.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/tasks/github/github-account-complete-page.test.tsx`

- [ ] **Step 1: Write failing task page tests**

Create `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/tasks/github/github-account-task-page.test.tsx` with mocks matching existing app page tests. Assert:

```ts
expect(screen.getByRole("heading", { name: "Connect your GitHub account" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: /connect github account/i })).toBeInTheDocument();
```

Mock `useTRPC().viewer.githubAccount.status.queryOptions()` to return `{ account: null }`, and mock `start.mutationOptions()` so clicking the button calls `window.location.assign("https://github.lightfast.localhost/login/oauth/authorize")`.

- [ ] **Step 2: Write failing completion page tests**

Create `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/tasks/github/github-account-complete-page.test.tsx`. Assert the page renders:

```ts
expect(screen.getByRole("heading", { name: "Finishing GitHub connection..." })).toBeInTheDocument();
```

Mock `viewer.githubAccount.sync.mutationOptions()` to return `{ account: { provider: "github", providerUserId: "12345", status: "active" } }` and assert the router redirects to `/account/tasks/github`.

- [ ] **Step 3: Run UI tests to verify failure**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/app/'(app)'/'(pending-allowed)'/account/tasks/github
```

Expected: FAIL because pages do not exist.

- [ ] **Step 4: Implement server task page**

Create `apps/app/src/app/(app)/(pending-allowed)/account/tasks/github/page.tsx`:

```tsx
import { Suspense } from "react";
import type { GitHubUserAccountBindErrorCode } from "@repo/github-app-contract";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { GithubAccountTaskClient } from "./_components/github-account-task-client";

export const dynamic = "force-dynamic";

export default async function GithubAccountTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ github_error?: string }>;
}) {
  const params = await searchParams;
  prefetch(trpc.viewer.githubAccount.status.queryOptions());

  return (
    <HydrateClient>
      <Suspense fallback={null}>
        <GithubAccountTaskClient
          githubError={params.github_error as GitHubUserAccountBindErrorCode | undefined}
        />
      </Suspense>
    </HydrateClient>
  );
}
```

- [ ] **Step 5: Implement task client**

Create `apps/app/src/app/(app)/(pending-allowed)/account/tasks/github/_components/github-account-task-client.tsx`:

```tsx
"use client";

import type { GitHubUserAccountBindErrorCode } from "@repo/github-app-contract";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTRPC } from "~/trpc/react";

const ERROR_MESSAGES: Record<GitHubUserAccountBindErrorCode, string> = {
  expired_state: "The GitHub connection expired. Start the connection again.",
  github_account_already_bound:
    "That GitHub account is already connected to another Lightfast user.",
  github_authorization_denied:
    "GitHub authorization was cancelled. Start the connection again when you are ready.",
  github_transient_error:
    "GitHub could not finish the connection. Try again in a moment.",
  github_user_not_verified:
    "Lightfast could not verify your GitHub user account.",
  lightfast_user_already_bound:
    "Your Lightfast account is already connected to another GitHub account.",
  missing_refresh_token:
    "GitHub did not return refreshable credentials. Confirm expiring user tokens are enabled for the GitHub App.",
  permission_required:
    "Sign in to the same Lightfast account that started the GitHub connection.",
};

export function GithubAccountTaskClient({
  githubError,
}: {
  githubError?: GitHubUserAccountBindErrorCode;
}) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.viewer.githubAccount.status.queryOptions()
  );
  const startMutation = useMutation(
    trpc.viewer.githubAccount.start.mutationOptions({
      meta: { errorTitle: "Failed to connect GitHub" },
    })
  );

  async function handleConnect() {
    const result = await startMutation.mutateAsync({
      returnTo: "/account/tasks/github",
    });
    window.location.assign(result.authorizationUrl);
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 pb-32">
      <div className="w-full max-w-md space-y-4">
        <div className="w-fit rounded-sm bg-card p-3">
          <Icons.logoShort className="h-5 w-5 text-foreground" />
        </div>
        <div className="space-y-4">
          <h1 className="pb-4 font-medium font-pp text-2xl text-foreground">
            Connect your GitHub account
          </h1>
          <p className="text-muted-foreground text-sm">
            Connect a GitHub user account so Lightfast can attribute GitHub
            activity to you when a feature requires it.
          </p>
          {githubError ? (
            <div
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm"
              role="alert"
            >
              {ERROR_MESSAGES[githubError]}
            </div>
          ) : null}
          {data.account ? (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-muted-foreground text-sm">
              Connected GitHub user id {data.account.providerUserId}
            </div>
          ) : null}
          <Button
            className="w-full"
            disabled={startMutation.isPending}
            onClick={() => void handleConnect()}
          >
            {startMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Icons.github aria-hidden="true" className="h-4 w-4" />
                Connect GitHub account
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Implement completion page and client**

Create `apps/app/src/app/(app)/(pending-allowed)/account/tasks/github/complete/page.tsx`:

```tsx
import { GithubAccountCompleteClient } from "./_components/github-account-complete-client";

export const dynamic = "force-dynamic";

export default async function GithubAccountCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const params = await searchParams;
  return <GithubAccountCompleteClient returnTo={params.return_to} />;
}
```

Create `apps/app/src/app/(app)/(pending-allowed)/account/tasks/github/complete/_components/github-account-complete-client.tsx`:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTRPC } from "~/trpc/react";

export function GithubAccountCompleteClient({
  returnTo,
}: {
  returnTo?: string;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const hasStartedRef = useRef(false);
  const syncMutation = useMutation(
    trpc.viewer.githubAccount.sync.mutationOptions({
      meta: { errorTitle: "Failed to finish GitHub connection" },
    })
  );

  const finish = useCallback(async () => {
    setFailed(false);
    try {
      const result = await syncMutation.mutateAsync();
      if (!result.account) {
        setFailed(true);
        return;
      }
      router.replace((returnTo ?? "/account/tasks/github") as Route);
    } catch {
      setFailed(true);
    }
  }, [returnTo, router, syncMutation]);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }
    hasStartedRef.current = true;
    void finish();
  }, [finish]);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 pb-32">
      <div className="w-full max-w-md space-y-4">
        <h1 className="font-medium font-pp text-2xl text-foreground">
          Finishing GitHub connection...
        </h1>
        <p className="text-muted-foreground text-sm">
          Lightfast is verifying your GitHub account connection.
        </p>
        {failed ? (
          <Button className="w-full" onClick={() => void finish()}>
            Retry
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Syncing GitHub account
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run UI tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/app/'(app)'/'(pending-allowed)'/account/tasks/github
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/app/src/app/'(app)'/'(pending-allowed)'/account/tasks/github apps/app/src/__tests__/app/'(app)'/'(pending-allowed)'/account/tasks/github
git commit -m "feat: add github account task UI"
```

## Task 10: GitHub Emulator Refreshable User Tokens

**Files:**
- Modify: `emulators/github/src/github-compatible-routes.ts`
- Modify: `emulators/github/src/fixtures.ts`
- Test: `emulators/github/src/__tests__/server.test.ts`

- [ ] **Step 1: Write failing emulator tests**

Update `emulators/github/src/__tests__/server.test.ts`:

```ts
function userAccountCallbackUrl() {
  return appCallbackUrl("/api/github/user/oauth/callback");
}

it("performs user account OAuth with refreshable token fields", async () => {
  const codeVerifier = "verifier_123456789012345678901234567890";
  const authorizeUrl = new URL(`${emulator?.url}/login/oauth/authorize`);
  authorizeUrl.searchParams.set(
    "client_id",
    GITHUB_EMULATOR_FIXTURES.oauthClientId
  );
  authorizeUrl.searchParams.set("redirect_uri", userAccountCallbackUrl());
  authorizeUrl.searchParams.set("state", "user_account_state_123");
  authorizeUrl.searchParams.set(
    "code_challenge",
    createCodeChallenge(codeVerifier)
  );
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const authorizeRes = await fetch(authorizeUrl, { redirect: "manual" });
  const callback = new URL(authorizeRes.headers.get("location") ?? "");
  const code = callback.searchParams.get("code") ?? "";

  const tokenRes = await fetch(`${emulator?.url}/login/oauth/access_token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_EMULATOR_FIXTURES.oauthClientId,
      client_secret: GITHUB_EMULATOR_FIXTURES.oauthClientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: userAccountCallbackUrl(),
    }),
  });

  expect(tokenRes.status).toBe(200);
  await expect(tokenRes.json()).resolves.toMatchObject({
    access_token: expect.stringMatching(/^ghu_/),
    expires_in: 28_800,
    refresh_token: expect.stringMatching(/^ghr_/),
    refresh_token_expires_in: 15_768_000,
    token_type: "bearer",
  });
});

it("refreshes user account OAuth tokens", async () => {
  const codeVerifier = "verifier_refresh_123456789012345678901234";
  const authorizeUrl = new URL(`${emulator?.url}/login/oauth/authorize`);
  authorizeUrl.searchParams.set(
    "client_id",
    GITHUB_EMULATOR_FIXTURES.oauthClientId
  );
  authorizeUrl.searchParams.set("redirect_uri", userAccountCallbackUrl());
  authorizeUrl.searchParams.set("state", "refresh_state_123");
  authorizeUrl.searchParams.set(
    "code_challenge",
    createCodeChallenge(codeVerifier)
  );
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const authorizeRes = await fetch(authorizeUrl, { redirect: "manual" });
  const callback = new URL(authorizeRes.headers.get("location") ?? "");
  const code = callback.searchParams.get("code") ?? "";
  const tokenRes = await fetch(`${emulator?.url}/login/oauth/access_token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_EMULATOR_FIXTURES.oauthClientId,
      client_secret: GITHUB_EMULATOR_FIXTURES.oauthClientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: userAccountCallbackUrl(),
    }),
  });
  const token = (await tokenRes.json()) as { refresh_token?: string };

  const refreshRes = await fetch(`${emulator?.url}/login/oauth/access_token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_EMULATOR_FIXTURES.oauthClientId,
      client_secret: GITHUB_EMULATOR_FIXTURES.oauthClientSecret,
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    }),
  });
  expect(refreshRes.status).toBe(200);
  const refreshed = (await refreshRes.json()) as { access_token?: string };
  expect(refreshed).toMatchObject({
    access_token: expect.stringMatching(/^ghu_/),
    expires_in: 28_800,
    refresh_token: expect.stringMatching(/^ghr_/),
    refresh_token_expires_in: 15_768_000,
    token_type: "bearer",
  });

  const accessToken = refreshed.access_token ?? "";
  const userRes = await fetch(`${emulator?.url}/user`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  expect(userRes.status).toBe(200);
  await expect(userRes.json()).resolves.toMatchObject({
    login: GITHUB_EMULATOR_FIXTURES.githubUserLogin,
    type: "User",
  });
});
```

- [ ] **Step 2: Run emulator tests to verify failure**

Run:

```bash
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
```

Expected: FAIL because current token exchange lacks refresh fields.

- [ ] **Step 3: Implement refreshable token storage**

In `emulators/github/src/github-compatible-routes.ts`, extend `OAuthUserToken`:

```ts
interface OAuthUserToken {
  appId: number;
  clientId: string;
  expiresAt: number;
  login: string;
  refreshToken: string;
  refreshTokenExpiresAt: number;
  scopes: string[];
}
```

In the authorization-code exchange branch, mint tokens:

```ts
const accessToken = `ghu_${randomBytes(20).toString("hex")}`;
const refreshToken = `ghr_${randomBytes(20).toString("hex")}`;
getOAuthUserTokens(input.store).set(accessToken, {
  appId: pending.appId,
  clientId,
  expiresAt: Date.now() + 28_800 * 1000,
  login: pending.login,
  refreshToken,
  refreshTokenExpiresAt: Date.now() + 15_768_000 * 1000,
  scopes: ["read:user"],
});
return json({
  access_token: accessToken,
  expires_in: 28_800,
  refresh_token: refreshToken,
  refresh_token_expires_in: 15_768_000,
  scope: "",
  token_type: "bearer",
});
```

Before the authorization-code branch, handle refresh requests when `body.grant_type === "refresh_token"`:

```ts
const refreshToken = String(body.refresh_token ?? "");
const previous = [...getOAuthUserTokens(input.store).entries()].find(
  ([, token]) => token.refreshToken === refreshToken
);
if (!previous) {
  return json({ error: "bad_refresh_token" });
}
const [, previousToken] = previous;
const nextAccessToken = `ghu_${randomBytes(20).toString("hex")}`;
const nextRefreshToken = `ghr_${randomBytes(20).toString("hex")}`;
getOAuthUserTokens(input.store).set(nextAccessToken, {
  ...previousToken,
  expiresAt: Date.now() + 28_800 * 1000,
  refreshToken: nextRefreshToken,
  refreshTokenExpiresAt: Date.now() + 15_768_000 * 1000,
});
return json({
  access_token: nextAccessToken,
  expires_in: 28_800,
  refresh_token: nextRefreshToken,
  refresh_token_expires_in: 15_768_000,
  scope: "",
  token_type: "bearer",
});
```

Ensure `authenticateUser` rejects expired access tokens:

```ts
if (oauthToken.expiresAt <= Date.now()) {
  return null;
}
```

- [ ] **Step 4: Run emulator tests**

Run:

```bash
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add emulators/github/src/github-compatible-routes.ts emulators/github/src/fixtures.ts emulators/github/src/__tests__/server.test.ts
git commit -m "feat: emulate refreshable github user tokens"
```

## Task 11: Drizzle Migration And Full Verification

**Files:**
- Create: generated files under `db/app/src/migrations/`
- Modify: `db/app/src/migrations/meta/_journal.json`

- [ ] **Step 1: Generate migration**

Run:

```bash
pnpm --filter @db/app db:generate
```

Expected: Drizzle generates a migration that creates `lightfast_user_source_control_accounts` and its indexes. Do not edit generated SQL by hand.

- [ ] **Step 2: Inspect generated migration**

Run:

```bash
git diff -- db/app/src/migrations db/app/src/schema/tables/user-source-control-accounts.ts
```

Expected: Migration contains only the new table and indexes from this plan. It must not alter existing tables.

- [ ] **Step 3: Run package tests**

Run:

```bash
pnpm --filter @repo/github-app-contract test
pnpm --filter @repo/github-app-node test
pnpm --filter @repo/github-emulator test
pnpm --filter @db/app test
pnpm --filter @api/app test
pnpm --filter @lightfast/app test
```

Expected: PASS.

- [ ] **Step 4: Run typechecks**

Run:

```bash
pnpm --filter @repo/github-app-contract typecheck
pnpm --filter @repo/github-app-node typecheck
pnpm --filter @repo/github-emulator typecheck
pnpm --filter @db/app typecheck
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 5: Run repo checks**

Run:

```bash
pnpm check
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit generated migration**

```bash
git add db/app/src/migrations db/app/src/migrations/meta/_journal.json
git commit -m "feat: add github user account binding migration"
```

## Task 12: Manual Local Flow Verification

**Files:**
- No planned source changes.

- [ ] **Step 1: Start dev server**

Run:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

Expected: app, www, platform, local Inngest, local QStash, Portless aggregate, and GitHub emulator start. The app is available at `https://lightfast.localhost`.

- [ ] **Step 2: Exercise the account task**

Open:

```text
https://lightfast.localhost/account/tasks/github
```

Expected:

- Page renders “Connect your GitHub account”.
- Clicking the button redirects to the local GitHub emulator authorize route.
- Emulator redirects back to `/api/github/user/oauth/callback`.
- Callback finishes at `/account/tasks/github/complete`.
- Completion returns to `/account/tasks/github`.
- The task page shows connected status with stable GitHub user id only.

- [ ] **Step 3: Verify no profile cache appears in DB schema or responses**

Run:

```bash
rg -n "provider_login|provider_avatar|provider_profile|provider_email|github_login|avatar_url" db/app/src api/app/src apps/app/src
```

Expected: no matches in durable binding schema or user-account API responses. Matches in emulator GitHub-shaped payloads are acceptable because GitHub returns those fields.

- [ ] **Step 4: Stop dev server**

Terminate the foreground `pnpm dev` process with `Ctrl-C`.

- [ ] **Step 5: Confirm no manual verification source changes remain**

Run:

```bash
git status --short
```

Expected: no output. Manual verification should not create source changes.
