# GitHub-Compatible Emulator Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace emulator-aware GitHub setup code with one production-shaped GitHub App flow whose endpoints can point at local `emulators/github` during development.

**Architecture:** `apps/app` keeps only product route handlers and proxy admission for GitHub callbacks. `api/app` owns Lightfast orchestration, Redis state, admin checks, DB finalization, and Clerk mirroring while using generic endpoint config. `@repo/github-app-node` owns GitHub protocol helpers, and `emulators/github` implements GitHub-compatible install, OAuth, and `/user/installations` behavior behind the same endpoints.

**Tech Stack:** pnpm workspaces, Turborepo, Next.js App Router route handlers, tRPC v11, Clerk, Upstash Redis, Drizzle MySQL helpers, `@emulators/github@0.6.0`, `@emulators/core@0.6.0`, Zod, Vitest.

---

## Scope Check

This plan covers one cross-package subsystem: GitHub App organization binding setup. The emulator, shared GitHub packages, API workflow, and app routes change together because each step is part of the same redirect and OAuth flow. Splitting this into separate implementation projects would leave the local flow broken between packages.

In scope:

- Replace `GITHUB_INSTALL_URL_OVERRIDE` with `GITHUB_APP_ENDPOINT_ORIGIN`.
- Remove `/api/dev/github/install` from `apps/app`.
- Remove emulator fields from Redis attempts.
- Remove environment-specific `verifiedBy` binding metadata.
- Replace `verifyGitHubEmulatorInstallation` with production-shaped `/user/installations` verification.
- Extend `emulators/github` with GitHub-compatible install, OAuth, and installation-list routes.
- Update tests and local emulator docs.

Out of scope:

- GitHub Enterprise Server endpoint matrices.
- GitHub-first unclaimed installation recovery.
- Webhook implementation beyond preserving `/api/github/webhook` as the product route name.
- New durable GitHub binding tables.
- Persisting GitHub OAuth user tokens.

## File Structure

Modify:

- `packages/github-app-contract/src/github-app.ts` - remove dev-install constant and environment provenance from metadata.
- `packages/github-app-contract/src/index.ts` - stop exporting the removed dev-install constant.
- `packages/github-app-contract/src/__tests__/github-app.test.ts` - assert GitHub-shaped URLs and metadata without `verifiedBy`.
- `packages/github-app-node/src/urls.ts` - build install and OAuth URLs from generic endpoint inputs.
- `packages/github-app-node/src/index.ts` - export the production-shaped installation verifier and stop exporting emulator verifier.
- `packages/github-app-node/src/__tests__/urls.test.ts` - cover default and custom endpoint URL builders.
- `api/app/src/env.ts` - add `GITHUB_APP_ENDPOINT_ORIGIN`, remove `GITHUB_INSTALL_URL_OVERRIDE`.
- `api/app/src/github/config.ts` - replace emulator config parsing with app config and endpoint guardrails.
- `api/app/src/__tests__/github-config.test.ts` - cover defaults, local endpoint origin, production guardrails, and legacy override rejection.
- `api/app/src/github/bind-attempts.ts` - remove emulator context from install and OAuth attempt records.
- `api/app/src/__tests__/github-bind-attempts.test.ts` - assert stored records contain only Lightfast state plus OAuth verifier and candidate installation id.
- `api/app/src/router/(pending-not-allowed)/github-setup.ts` - start setup with generic GitHub App config and endpoints.
- `api/app/src/__tests__/github-setup-router.test.ts` - assert start returns a GitHub-shaped install URL and stores no emulator state.
- `api/app/src/github/setup-flow.ts` - use endpoint config, generic OAuth token exchange, generic installation verification, and metadata without `verifiedBy`.
- `api/app/src/__tests__/github-setup-flow.test.ts` - cover endpoint-aware redirects, OAuth exchange, verification, metadata, and denial/error handling.
- `apps/app/src/proxy.ts` - remove `/api/dev/github/install` from public route patterns.
- `apps/app/src/__tests__/proxy.test.ts` - assert only product GitHub callbacks are public.
- `apps/app/src/__tests__/app/api/github/github-routes.test.ts` - remove dev install shim tests.
- `package.json` - start the emulator with the same direct app origin used by `NEXT_PUBLIC_APP_URL`.
- `apps/app/package.json` - keep `with-related-projects` using the emulator env printer with the direct app origin; no route-specific env names should remain.
- `emulators/github/package.json` - add `@repo/github-app-contract` for shared product callback constants.
- `emulators/github/src/fixtures.ts` - print `GITHUB_APP_ENDPOINT_ORIGIN` instead of `GITHUB_INSTALL_URL_OVERRIDE`.
- `emulators/github/src/env-sh.ts` - continue emitting shell-safe env assignments from the updated fixture env.
- `emulators/github/src/start.ts` - continue printing updated env values.
- `emulators/github/src/server.ts` - wrap the emulator fetch handler with GitHub-compatible route handling.
- `emulators/github/src/__tests__/server.test.ts` - cover install redirect, OAuth PKCE exchange, `/user`, `/user/installations`, and updated env output.
- `emulators/github/src/__tests__/env.test.ts` - keep runtime origin tests aligned with endpoint origin naming.
- `emulators/github/README.md` - document the endpoint-origin based local flow.

Create:

- `packages/github-app-node/src/installations.ts` - list and verify user-accessible GitHub App installations through `GET /user/installations`.
- `packages/github-app-node/src/__tests__/installations.test.ts` - verifier tests for pagination, organization-only binding, malformed payloads, and transport failures.
- `emulators/github/src/github-compatible-routes.ts` - local GitHub-compatible install, OAuth, `/user`, and `/user/installations` handlers.

Delete:

- `packages/github-app-node/src/emulator-verifier.ts`
- `packages/github-app-node/src/__tests__/emulator-verifier.test.ts`
- `apps/app/src/app/(app)/(github)/api/dev/github/install/route.ts`

Do not modify:

- `db/app/src/schema/tables/org-source-control-bindings.ts`
- Any manual SQL migration file.
- Production webhook route handlers.

---

### Task 1: Contract And URL Builder Boundary

**Files:**
- Modify: `packages/github-app-contract/src/github-app.ts`
- Modify: `packages/github-app-contract/src/index.ts`
- Modify: `packages/github-app-contract/src/__tests__/github-app.test.ts`
- Modify: `packages/github-app-node/src/urls.ts`
- Modify: `packages/github-app-node/src/__tests__/urls.test.ts`

- [ ] **Step 1: Update the contract tests first**

Replace the GitHub app contract test with assertions that accept production-shaped installation URLs and reject metadata provenance:

```ts
import { describe, expect, it } from "vitest";
import {
  GITHUB_BIND_ERROR_CODES,
  GITHUB_OAUTH_CALLBACK_PATH,
  GITHUB_SETUP_PATH,
  githubBindStartOutputSchema,
  githubInstallationMetadataSchema,
  githubNormalizedInstallationSchema,
} from "../github-app";

describe("@repo/github-app-contract", () => {
  it("exports stable product callback route constants", () => {
    expect(GITHUB_SETUP_PATH).toBe("/api/github/setup");
    expect(GITHUB_OAUTH_CALLBACK_PATH).toBe("/api/github/oauth/callback");
  });

  it("validates client-safe start output for a GitHub App install URL", () => {
    expect(
      githubBindStartOutputSchema.parse({
        installationUrl:
          "https://github.com/apps/lightfast-local/installations/new?state=abc",
      })
    ).toEqual({
      installationUrl:
        "https://github.com/apps/lightfast-local/installations/new?state=abc",
    });
  });

  it("keeps bind error codes compact", () => {
    expect(GITHUB_BIND_ERROR_CODES).toContain("expired_state");
    expect(GITHUB_BIND_ERROR_CODES).toContain("installation_not_verified");
    expect(GITHUB_BIND_ERROR_CODES).toContain("org_already_bound");
  });

  it("normalizes organization installations only when account metadata is present", () => {
    expect(
      githubNormalizedInstallationSchema.parse({
        appId: "424242",
        appSlug: "lightfast-local",
        events: ["issues"],
        id: "1001",
        permissions: { contents: "read" },
        repositorySelection: "all",
        targetType: "Organization",
        account: {
          id: "123",
          login: "lightfast-emulated",
          type: "Organization",
        },
      })
    ).toMatchObject({
      account: { login: "lightfast-emulated" },
      id: "1001",
      targetType: "Organization",
    });
  });

  it("stores GitHub installation metadata without environment provenance", () => {
    const metadata = githubInstallationMetadataSchema.parse({
      events: ["push"],
      githubAppId: "424242",
      githubAppSlug: "lightfast-local",
      githubSetupAction: "install",
      permissions: { contents: "read" },
      repositorySelection: "all",
    });

    expect(metadata).toEqual({
      events: ["push"],
      githubAppId: "424242",
      githubAppSlug: "lightfast-local",
      githubSetupAction: "install",
      permissions: { contents: "read" },
      repositorySelection: "all",
    });
    expect(
      githubInstallationMetadataSchema.safeParse({
        ...metadata,
        verifiedBy: "github_emulator",
      }).success
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the contract test and observe the expected failure**

Run:

```bash
pnpm --filter @repo/github-app-contract test -- src/__tests__/github-app.test.ts
```

Expected: FAIL because `githubInstallationMetadataSchema` still requires `verifiedBy`.

- [ ] **Step 3: Remove dev install and provenance from the contract**

In `packages/github-app-contract/src/github-app.ts`, remove `GITHUB_DEV_INSTALL_PATH` and change the metadata schema to:

```ts
export const GITHUB_SETUP_PATH = "/api/github/setup";
export const GITHUB_OAUTH_CALLBACK_PATH = "/api/github/oauth/callback";
export const GITHUB_WEBHOOK_PATH = "/api/github/webhook";

export const githubInstallationMetadataSchema = z.object({
  events: z.array(z.string()),
  githubAppId: z.string().min(1),
  githubAppSlug: z.string().min(1).nullable(),
  githubSetupAction: z.string().min(1).optional(),
  permissions: z.record(z.string(), z.string()),
  repositorySelection: z.enum(["all", "selected"]),
});
```

In `packages/github-app-contract/src/index.ts`, remove `GITHUB_DEV_INSTALL_PATH` from the export list.

- [ ] **Step 4: Update URL builder tests**

Replace `packages/github-app-node/src/__tests__/urls.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import {
  buildGitHubInstallationUrl,
  buildGitHubOAuthAuthorizeUrl,
} from "../urls";

describe("GitHub URL builders", () => {
  it("builds a default GitHub App installation URL", () => {
    expect(
      buildGitHubInstallationUrl({
        appSlug: "lightfast-local",
        state: "state_123",
      })
    ).toBe(
      "https://github.com/apps/lightfast-local/installations/new?state=state_123"
    );
  });

  it("builds a custom-origin GitHub App installation URL", () => {
    expect(
      buildGitHubInstallationUrl({
        appSlug: "lightfast-local",
        state: "state_123",
        webBaseUrl: "https://github.lightfast.localhost",
      })
    ).toBe(
      "https://github.lightfast.localhost/apps/lightfast-local/installations/new?state=state_123"
    );
  });

  it("builds a default OAuth authorize URL", () => {
    const url = new URL(
      buildGitHubOAuthAuthorizeUrl({
        clientId: "Iv1.lightfastlocal",
        codeChallenge: "challenge",
        redirectUri: "https://app.lightfast.ai/api/github/oauth/callback",
        state: "state_456",
      })
    );

    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize"
    );
    expect(url.searchParams.get("client_id")).toBe("Iv1.lightfastlocal");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("builds a custom OAuth authorize URL", () => {
    const url = new URL(
      buildGitHubOAuthAuthorizeUrl({
        clientId: "Iv1.lightfastlocal",
        codeChallenge: "challenge",
        oauthAuthorizeUrl:
          "https://github.lightfast.localhost/login/oauth/authorize",
        redirectUri:
          "https://app.lightfast.localhost/api/github/oauth/callback",
        state: "state_456",
      })
    );

    expect(url.origin + url.pathname).toBe(
      "https://github.lightfast.localhost/login/oauth/authorize"
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.lightfast.localhost/api/github/oauth/callback"
    );
  });
});
```

- [ ] **Step 5: Run URL tests and observe the expected failure**

Run:

```bash
pnpm --filter @repo/github-app-node test -- src/__tests__/urls.test.ts
```

Expected: FAIL because `buildGitHubInstallationUrl` still accepts `installUrlOverride`, and `buildGitHubOAuthAuthorizeUrl` still accepts `authorizationBaseUrl`.

- [ ] **Step 6: Implement generic endpoint URL builders**

Replace `packages/github-app-node/src/urls.ts` with:

```ts
function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function buildGitHubInstallationUrl(input: {
  appSlug: string;
  state: string;
  webBaseUrl?: string;
}): string {
  const baseUrl = trimTrailingSlash(input.webBaseUrl ?? "https://github.com");
  const url = new URL(`/apps/${input.appSlug}/installations/new`, baseUrl);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export function buildGitHubOAuthAuthorizeUrl(input: {
  clientId: string;
  codeChallenge: string;
  oauthAuthorizeUrl?: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(
    input.oauthAuthorizeUrl ?? "https://github.com/login/oauth/authorize"
  );
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}
```

- [ ] **Step 7: Run package tests**

Run:

```bash
pnpm --filter @repo/github-app-contract test -- src/__tests__/github-app.test.ts
pnpm --filter @repo/github-app-node test -- src/__tests__/urls.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the contract and URL boundary**

Run:

```bash
git add packages/github-app-contract/src/github-app.ts packages/github-app-contract/src/index.ts packages/github-app-contract/src/__tests__/github-app.test.ts packages/github-app-node/src/urls.ts packages/github-app-node/src/__tests__/urls.test.ts
git commit -m "refactor: make github app URLs endpoint based"
```

---

### Task 2: Production-Shaped User Installation Verifier

**Files:**
- Create: `packages/github-app-node/src/installations.ts`
- Create: `packages/github-app-node/src/__tests__/installations.test.ts`
- Modify: `packages/github-app-node/src/index.ts`
- Delete: `packages/github-app-node/src/emulator-verifier.ts`
- Delete: `packages/github-app-node/src/__tests__/emulator-verifier.test.ts`

- [ ] **Step 1: Add verifier tests**

Create `packages/github-app-node/src/__tests__/installations.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  listGitHubUserAccessibleInstallations,
  verifyGitHubUserInstallation,
} from "../installations";

function pageNumberFor(url: Parameters<typeof fetch>[0]): string | null {
  return new URL(url instanceof Request ? url.url : url).searchParams.get(
    "page"
  );
}

describe("GitHub user-accessible installation verification", () => {
  it("lists and normalizes user-accessible installations", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        total_count: 1,
        installations: [
          {
            id: 1001,
            account: {
              id: 20,
              login: "lightfast-emulated",
              type: "Organization",
            },
            app_id: 424242,
            app_slug: "lightfast-local",
            events: ["issues"],
            permissions: { contents: "read" },
            repository_selection: "all",
            suspended_at: null,
            target_type: "Organization",
          },
        ],
      })
    );

    await expect(
      listGitHubUserAccessibleInstallations({
        apiBaseUrl: "https://github.lightfast.localhost",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).resolves.toEqual([
      expect.objectContaining({
        account: { login: "lightfast-emulated", type: "Organization" },
        id: "1001",
        targetType: "Organization",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.lightfast.localhost/user/installations?per_page=100&page=1",
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "application/vnd.github+json",
          authorization: "Bearer gho_test",
        }),
      })
    );
  });

  it("finds an expected installation on a later page", async () => {
    const fetchMock = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      if (pageNumberFor(url) === "1") {
        return Response.json({
          total_count: 2,
          installations: [
            {
              id: 9999,
              account: { id: 10, login: "other-org", type: "Organization" },
              app_id: 424242,
              app_slug: "lightfast-local",
              target_type: "Organization",
            },
          ],
        });
      }
      return Response.json({
        total_count: 2,
        installations: [
          {
            id: 1001,
            account: {
              id: 20,
              login: "lightfast-emulated",
              type: "Organization",
            },
            app_id: 424242,
            app_slug: "lightfast-local",
            events: ["push"],
            permissions: { contents: "read" },
            repository_selection: "all",
            target_type: "Organization",
          },
        ],
      });
    });

    await expect(
      verifyGitHubUserInstallation({
        apiBaseUrl: "https://github.lightfast.localhost",
        expectedInstallationId: "1001",
        fetch: fetchMock,
        perPage: 1,
        userAccessToken: "gho_test",
      })
    ).resolves.toMatchObject({
      account: { login: "lightfast-emulated", type: "Organization" },
      id: "1001",
    });
  });

  it("rejects missing installations with a typed verification error", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ total_count: 0, installations: [] })
    );

    await expect(
      verifyGitHubUserInstallation({
        apiBaseUrl: "https://github.lightfast.localhost",
        expectedInstallationId: "1001",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).rejects.toMatchObject({ code: "INSTALLATION_NOT_VERIFIED" });
  });

  it("rejects personal account installations with a typed unsupported-account error", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        total_count: 1,
        installations: [
          {
            id: 1001,
            account: { id: 10, login: "lightfast-dev", type: "User" },
            app_id: 424242,
            app_slug: "lightfast-local",
            target_type: "User",
          },
        ],
      })
    );

    await expect(
      verifyGitHubUserInstallation({
        apiBaseUrl: "https://github.lightfast.localhost",
        expectedInstallationId: "1001",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).rejects.toMatchObject({ code: "PERSONAL_ACCOUNT_NOT_SUPPORTED" });
  });

  it("wraps invalid responses in a typed verification error", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ installations: [{ id: 1001, account: null }] })
    );

    await expect(
      listGitHubUserAccessibleInstallations({
        apiBaseUrl: "https://github.lightfast.localhost",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).rejects.toMatchObject({ code: "INSTALLATION_NOT_VERIFIED" });
  });

  it("wraps transport failures in a typed verification error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network unavailable");
    });

    await expect(
      verifyGitHubUserInstallation({
        apiBaseUrl: "https://github.lightfast.localhost",
        expectedInstallationId: "1001",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).rejects.toMatchObject({ code: "INSTALLATION_NOT_VERIFIED" });
  });
});
```

- [ ] **Step 2: Run verifier tests and observe the expected failure**

Run:

```bash
pnpm --filter @repo/github-app-node test -- src/__tests__/installations.test.ts
```

Expected: FAIL because `src/installations.ts` does not exist.

- [ ] **Step 3: Implement the verifier**

Create `packages/github-app-node/src/installations.ts`:

```ts
import {
  type GitHubNormalizedInstallation,
  githubNormalizedInstallationSchema,
} from "@repo/github-app-contract";
import { z } from "zod";

import { GitHubAppNodeError } from "./errors";

const rawInstallationSchema = z.object({
  account: z.object({
    id: z.union([z.number(), z.string().min(1)]),
    login: z.string().min(1),
    type: z.enum(["Organization", "User"]),
  }),
  app_id: z.union([z.number(), z.string().min(1)]),
  app_slug: z.string().min(1).nullable().optional(),
  events: z.array(z.string()).optional(),
  id: z.union([z.number(), z.string().min(1)]),
  permissions: z.record(z.string(), z.string()).optional(),
  repository_selection: z.enum(["all", "selected"]).optional(),
  suspended_at: z.string().nullable().optional(),
  target_type: z.enum(["Organization", "User"]),
});

const userInstallationsResponseSchema = z.object({
  installations: z.array(rawInstallationSchema),
  total_count: z.number().int().min(0).optional(),
});

export interface ListGitHubUserAccessibleInstallationsInput {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  perPage?: number;
  userAccessToken: string;
}

export interface VerifyGitHubUserInstallationInput
  extends ListGitHubUserAccessibleInstallationsInput {
  expectedInstallationId: string;
}

function normalizeApiBaseUrl(value: string | undefined) {
  return (value ?? "https://api.github.com").replace(/\/+$/, "");
}

function normalizeInstallation(
  installation: z.infer<typeof rawInstallationSchema>
): GitHubNormalizedInstallation {
  const parsed = githubNormalizedInstallationSchema.safeParse({
    account: {
      id: String(installation.account.id),
      login: installation.account.login,
      type: installation.account.type,
    },
    appId: String(installation.app_id),
    appSlug: installation.app_slug ?? null,
    events: installation.events ?? [],
    id: String(installation.id),
    permissions: installation.permissions ?? {},
    repositorySelection: installation.repository_selection ?? "all",
    suspendedAt: installation.suspended_at ?? null,
    targetType: installation.target_type,
  });

  if (!parsed.success) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub installation response was invalid."
    );
  }

  return parsed.data;
}

async function fetchInstallationsPage(input: {
  apiBaseUrl: string;
  apiVersion?: string;
  fetch: typeof fetch;
  page: number;
  perPage: number;
  userAccessToken: string;
}) {
  const url = new URL("/user/installations", input.apiBaseUrl);
  url.searchParams.set("per_page", String(input.perPage));
  url.searchParams.set("page", String(input.page));

  let res: Response;
  try {
    res = await input.fetch(url.toString(), {
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
      "INSTALLATION_NOT_VERIFIED",
      "GitHub installation verification request failed."
    );
  }

  const json = await res.json().catch(() => null);
  const parsed = userInstallationsResponseSchema.safeParse(json);
  if (!res.ok || !parsed.success) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub installation verification response was invalid."
    );
  }

  return parsed.data;
}

export async function listGitHubUserAccessibleInstallations(
  input: ListGitHubUserAccessibleInstallationsInput
): Promise<GitHubNormalizedInstallation[]> {
  const requestFetch = input.fetch ?? fetch;
  const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl);
  const perPage = input.perPage ?? 100;
  const installations: GitHubNormalizedInstallation[] = [];
  let page = 1;

  for (;;) {
    const data = await fetchInstallationsPage({
      apiBaseUrl,
      apiVersion: input.apiVersion,
      fetch: requestFetch,
      page,
      perPage,
      userAccessToken: input.userAccessToken,
    });

    installations.push(...data.installations.map(normalizeInstallation));

    const totalCount = data.total_count ?? installations.length;
    if (
      data.installations.length === 0 ||
      data.installations.length < perPage ||
      installations.length >= totalCount
    ) {
      break;
    }

    page += 1;
  }

  return installations;
}

export async function verifyGitHubUserInstallation(
  input: VerifyGitHubUserInstallationInput
): Promise<GitHubNormalizedInstallation> {
  const installations = await listGitHubUserAccessibleInstallations(input);
  const installation = installations.find(
    (candidate) => candidate.id === input.expectedInstallationId
  );

  if (!installation) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub user cannot access the expected installation."
    );
  }

  if (
    installation.targetType !== "Organization" ||
    installation.account.type !== "Organization"
  ) {
    throw new GitHubAppNodeError(
      "PERSONAL_ACCOUNT_NOT_SUPPORTED",
      "Only GitHub organization installations are supported."
    );
  }

  return installation;
}
```

- [ ] **Step 4: Update exports and delete emulator verifier**

In `packages/github-app-node/src/index.ts`, replace the emulator verifier export with:

```ts
export {
  listGitHubUserAccessibleInstallations,
  verifyGitHubUserInstallation,
  type ListGitHubUserAccessibleInstallationsInput,
  type VerifyGitHubUserInstallationInput,
} from "./installations";
```

Delete these files:

```bash
rm packages/github-app-node/src/emulator-verifier.ts
rm packages/github-app-node/src/__tests__/emulator-verifier.test.ts
```

- [ ] **Step 5: Run verifier tests**

Run:

```bash
pnpm --filter @repo/github-app-node test -- src/__tests__/installations.test.ts src/__tests__/urls.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the verifier**

Run:

```bash
git add packages/github-app-node/src/installations.ts packages/github-app-node/src/__tests__/installations.test.ts packages/github-app-node/src/index.ts packages/github-app-node/src/emulator-verifier.ts packages/github-app-node/src/__tests__/emulator-verifier.test.ts
git commit -m "feat: verify github user installations generically"
```

---

### Task 3: API GitHub App Config And Endpoint Guardrails

**Files:**
- Modify: `api/app/src/env.ts`
- Modify: `api/app/src/github/config.ts`
- Modify: `api/app/src/__tests__/github-config.test.ts`

- [ ] **Step 1: Replace config tests**

Replace `api/app/src/__tests__/github-config.test.ts` with:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GITHUB_APP_ENDPOINTS,
  getGitHubAppConfig,
  normalizeGitHubPrivateKey,
  resolveGitHubAppEndpoints,
  resolveGitHubAppOrigin,
} from "../github/config";

describe("GitHub config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes escaped private key newlines", () => {
    expect(normalizeGitHubPrivateKey("a\\nb\\n")).toBe("a\nb\n");
  });

  it("resolves the app origin from NEXT_PUBLIC_APP_URL", () => {
    expect(
      resolveGitHubAppOrigin({
        appUrl: "https://app.lightfast.localhost",
      })
    ).toBe("https://app.lightfast.localhost");
  });

  it("defaults to real GitHub endpoints", () => {
    expect(resolveGitHubAppEndpoints({ endpointOrigin: undefined })).toEqual(
      DEFAULT_GITHUB_APP_ENDPOINTS
    );
  });

  it("resolves a local combined endpoint origin", () => {
    expect(
      resolveGitHubAppEndpoints({
        endpointOrigin: "https://github.lightfast.localhost",
        vercelEnv: "development",
      })
    ).toEqual({
      apiBaseUrl: "https://github.lightfast.localhost",
      oauthAuthorizeUrl:
        "https://github.lightfast.localhost/login/oauth/authorize",
      oauthTokenUrl:
        "https://github.lightfast.localhost/login/oauth/access_token",
      webBaseUrl: "https://github.lightfast.localhost",
    });
  });

  it.each(["preview", "production"] as const)(
    "rejects custom endpoint origins in %s",
    (vercelEnv) => {
      expect(() =>
        resolveGitHubAppEndpoints({
          endpointOrigin: "https://github.lightfast.localhost",
          vercelEnv,
        })
      ).toThrow(/custom GitHub endpoints are allowed only in local development/);
    }
  );

  it("rejects legacy install overrides even in development", () => {
    vi.stubEnv(
      "GITHUB_INSTALL_URL_OVERRIDE",
      "https://app.lightfast.localhost/api/dev/github/install?installation_id=1001"
    );

    expect(() =>
      resolveGitHubAppEndpoints({
        endpointOrigin: undefined,
        vercelEnv: "development",
      })
    ).toThrow(/GITHUB_INSTALL_URL_OVERRIDE is no longer supported/);
  });

  it("returns complete GitHub App config when required values are present", () => {
    const config = getGitHubAppConfig({
      env: {
        GITHUB_API_VERSION: "2022-11-28",
        GITHUB_APP_CLIENT_ID: "github_client_test",
        GITHUB_APP_CLIENT_SECRET: "github_secret_test",
        GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
        GITHUB_APP_ID: "12345",
        GITHUB_APP_PRIVATE_KEY: "line1\\nline2",
        GITHUB_APP_SLUG: "lightfast-test",
        VERCEL_ENV: "development",
      },
    });

    expect(config).toMatchObject({
      apiVersion: "2022-11-28",
      appId: "12345",
      appSlug: "lightfast-test",
      clientId: "github_client_test",
      clientSecret: "github_secret_test",
      endpoints: {
        apiBaseUrl: "https://github.lightfast.localhost",
      },
      privateKey: "line1\nline2",
    });
  });
});
```

- [ ] **Step 2: Run config tests and observe the expected failure**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-config.test.ts
```

Expected: FAIL because the config module still exports emulator-specific functions and env still exposes `GITHUB_INSTALL_URL_OVERRIDE`.

- [ ] **Step 3: Update API env schema**

In `api/app/src/env.ts`, replace the server and runtime entries for `GITHUB_INSTALL_URL_OVERRIDE` with `GITHUB_APP_ENDPOINT_ORIGIN`:

```ts
GITHUB_APP_ENDPOINT_ORIGIN: z.string().url().optional(),
```

and:

```ts
GITHUB_APP_ENDPOINT_ORIGIN: process.env.GITHUB_APP_ENDPOINT_ORIGIN,
```

- [ ] **Step 4: Replace GitHub config implementation**

Replace `api/app/src/github/config.ts` with:

```ts
import { env as runtimeEnv } from "../env";

export interface GitHubAppEndpoints {
  apiBaseUrl: string;
  oauthAuthorizeUrl: string;
  oauthTokenUrl: string;
  webBaseUrl: string;
}

export interface GitHubAppConfig {
  apiVersion: string;
  appId: string;
  appSlug: string;
  clientId: string;
  clientSecret: string;
  endpoints: GitHubAppEndpoints;
  privateKey: string;
}

export const DEFAULT_GITHUB_APP_ENDPOINTS: GitHubAppEndpoints = {
  apiBaseUrl: "https://api.github.com",
  oauthAuthorizeUrl: "https://github.com/login/oauth/authorize",
  oauthTokenUrl: "https://github.com/login/oauth/access_token",
  webBaseUrl: "https://github.com",
};

type GitHubConfigEnv = {
  GITHUB_API_VERSION?: string;
  GITHUB_APP_CLIENT_ID?: string;
  GITHUB_APP_CLIENT_SECRET?: string;
  GITHUB_APP_ENDPOINT_ORIGIN?: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_APP_SLUG?: string;
  VERCEL_ENV?: "development" | "preview" | "production";
};

export function normalizeGitHubPrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

export function resolveGitHubAppOrigin(
  input: { appUrl?: string } = {}
): string {
  const appUrl = input.appUrl ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required for GitHub app origin resolution."
    );
  }

  return new URL(appUrl).origin;
}

function assertNoLegacyInstallOverride() {
  if (process.env.GITHUB_INSTALL_URL_OVERRIDE) {
    throw new Error(
      "GITHUB_INSTALL_URL_OVERRIDE is no longer supported. Use GITHUB_APP_ENDPOINT_ORIGIN for local GitHub-compatible endpoints."
    );
  }
}

function resolveOriginUrls(originValue: string): GitHubAppEndpoints {
  const origin = new URL(originValue).origin;
  return {
    apiBaseUrl: origin,
    oauthAuthorizeUrl: new URL("/login/oauth/authorize", origin).toString(),
    oauthTokenUrl: new URL("/login/oauth/access_token", origin).toString(),
    webBaseUrl: origin,
  };
}

export function resolveGitHubAppEndpoints(
  input: {
    endpointOrigin?: string;
    vercelEnv?: "development" | "preview" | "production";
  } = {}
): GitHubAppEndpoints {
  assertNoLegacyInstallOverride();

  const endpointOrigin =
    input.endpointOrigin ?? runtimeEnv.GITHUB_APP_ENDPOINT_ORIGIN;
  if (!endpointOrigin) {
    return DEFAULT_GITHUB_APP_ENDPOINTS;
  }

  const vercelEnv = input.vercelEnv ?? runtimeEnv.VERCEL_ENV;
  if (vercelEnv !== "development") {
    throw new Error(
      "Custom GitHub endpoints are allowed only in local development and tests."
    );
  }

  return resolveOriginUrls(endpointOrigin);
}

export function getGitHubAppConfig(
  input: { env?: GitHubConfigEnv } = {}
): GitHubAppConfig {
  const configEnv = input.env ?? runtimeEnv;
  const required = {
    apiVersion: configEnv.GITHUB_API_VERSION ?? "2022-11-28",
    appId: configEnv.GITHUB_APP_ID,
    appSlug: configEnv.GITHUB_APP_SLUG,
    clientId: configEnv.GITHUB_APP_CLIENT_ID,
    clientSecret: configEnv.GITHUB_APP_CLIENT_SECRET,
    privateKey: configEnv.GITHUB_APP_PRIVATE_KEY,
  };

  if (
    !(
      required.appId &&
      required.appSlug &&
      required.clientId &&
      required.clientSecret &&
      required.privateKey
    )
  ) {
    throw new Error("GitHub App environment is incomplete.");
  }

  return {
    apiVersion: required.apiVersion,
    appId: required.appId,
    appSlug: required.appSlug,
    clientId: required.clientId,
    clientSecret: required.clientSecret,
    endpoints: resolveGitHubAppEndpoints({
      endpointOrigin: configEnv.GITHUB_APP_ENDPOINT_ORIGIN,
      vercelEnv: configEnv.VERCEL_ENV,
    }),
    privateKey: normalizeGitHubPrivateKey(required.privateKey),
  };
}
```

- [ ] **Step 5: Run config tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-config.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit API config**

Run:

```bash
git add api/app/src/env.ts api/app/src/github/config.ts api/app/src/__tests__/github-config.test.ts
git commit -m "refactor: add github app endpoint config"
```

---

### Task 4: Redis Attempts Without Emulator State

**Files:**
- Modify: `api/app/src/github/bind-attempts.ts`
- Modify: `api/app/src/__tests__/github-bind-attempts.test.ts`

- [ ] **Step 1: Update bind attempt tests**

Replace emulator-specific input and expectations in `api/app/src/__tests__/github-bind-attempts.test.ts` with these patterns:

```ts
const issued = await issueGitHubInstallAttempt({
  clerkOrgId: "org_1",
  lightfastUserId: "user_1",
  orgSlug: "acme",
});
const record = redisSetMock.mock.calls[0]?.[1];

expect(record).toEqual({
  clerkOrgId: "org_1",
  lightfastUserId: "user_1",
  orgSlug: "acme",
  stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
});
expect(record).not.toHaveProperty("emulator");
```

For OAuth attempt cases, use:

```ts
const issued = await issueGitHubOAuthAttempt({
  clerkOrgId: "org_1",
  codeVerifier: "verifier",
  lightfastUserId: "user_1",
  orgSlug: "acme",
  providerInstallationId: "1001",
});
const record = redisSetMock.mock.calls[0]?.[1];

expect(record).toEqual({
  clerkOrgId: "org_1",
  codeVerifier: "verifier",
  lightfastUserId: "user_1",
  orgSlug: "acme",
  providerInstallationId: "1001",
  stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
});
expect(record).not.toHaveProperty("emulator");
```

- [ ] **Step 2: Run bind attempt tests and observe the expected failure**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-bind-attempts.test.ts
```

Expected: FAIL because `issueGitHubInstallAttempt` and `issueGitHubOAuthAttempt` still require `emulator`.

- [ ] **Step 3: Remove emulator fields from attempt records**

In `api/app/src/github/bind-attempts.ts`, remove `GitHubEmulatorAttemptContext`, remove `emulator` from both record interfaces, and update issuers:

```ts
export interface GitHubBindInstallAttemptRecord {
  clerkOrgId: string;
  lightfastUserId: string;
  orgSlug: string;
  stateHash: string;
}

export interface GitHubBindOAuthAttemptRecord
  extends GitHubBindInstallAttemptRecord {
  codeVerifier: string;
  providerInstallationId: string;
}

export async function issueGitHubInstallAttempt(input: {
  clerkOrgId: string;
  lightfastUserId: string;
  orgSlug: string;
}) {
  const attemptId = nanoid(32);
  const state = encodeState({ attemptId, nonce: nanoid(32) });
  const record: GitHubBindInstallAttemptRecord = {
    clerkOrgId: input.clerkOrgId,
    lightfastUserId: input.lightfastUserId,
    orgSlug: input.orgSlug,
    stateHash: hashState(state),
  };
  await redis.set(`${INSTALL_PREFIX}${attemptId}`, record, { ex: TTL_SECONDS });
  return { attemptId, state };
}

export async function issueGitHubOAuthAttempt(input: {
  clerkOrgId: string;
  codeVerifier: string;
  lightfastUserId: string;
  orgSlug: string;
  providerInstallationId: string;
}) {
  const attemptId = nanoid(32);
  const state = encodeState({ attemptId, nonce: nanoid(32) });
  const record: GitHubBindOAuthAttemptRecord = {
    clerkOrgId: input.clerkOrgId,
    codeVerifier: input.codeVerifier,
    lightfastUserId: input.lightfastUserId,
    orgSlug: input.orgSlug,
    providerInstallationId: input.providerInstallationId,
    stateHash: hashState(state),
  };
  await redis.set(`${OAUTH_PREFIX}${attemptId}`, record, { ex: TTL_SECONDS });
  return { attemptId, state };
}
```

- [ ] **Step 4: Run bind attempt tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-bind-attempts.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit attempt cleanup**

Run:

```bash
git add api/app/src/github/bind-attempts.ts api/app/src/__tests__/github-bind-attempts.test.ts
git commit -m "refactor: remove emulator state from github attempts"
```

---

### Task 5: Start Setup With Generic GitHub App Endpoints

**Files:**
- Modify: `api/app/src/router/(pending-not-allowed)/github-setup.ts`
- Modify: `api/app/src/__tests__/github-setup-router.test.ts`

- [ ] **Step 1: Update setup router env mock and expectation**

In `api/app/src/__tests__/github-setup-router.test.ts`, replace the env mock with:

```ts
vi.mock("../env", () => ({
  env: {
    GITHUB_API_VERSION: "2022-11-28",
    GITHUB_APP_CLIENT_ID: "github_client_test",
    GITHUB_APP_CLIENT_SECRET: "github_secret_test",
    GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
    GITHUB_APP_ID: "12345",
    GITHUB_APP_PRIVATE_KEY: "test-private-key",
    GITHUB_APP_SLUG: "lightfast-test",
    VERCEL_ENV: "development",
  },
}));
```

Update the successful start expectation to:

```ts
expect(result.installationUrl).toBe(
  "https://github.lightfast.localhost/apps/lightfast-test/installations/new?state=" +
    issuedState
);
expect(redisSetMock).toHaveBeenCalledWith(
  "github-bind-install-attempt:attempt_123456789012345678901234",
  {
    clerkOrgId: "org_1",
    lightfastUserId: "user_1",
    orgSlug: "acme",
    stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
  },
  { ex: 900 }
);
```

- [ ] **Step 2: Run router test and observe the expected failure**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-setup-router.test.ts
```

Expected: FAIL because the router still imports `getGitHubEmulatorConfig` and still passes emulator state into the install attempt.

- [ ] **Step 3: Update the setup router**

In `api/app/src/router/(pending-not-allowed)/github-setup.ts`, replace `getGitHubEmulatorConfig` with `getGitHubAppConfig`, remove `emulator` from the issued attempt, and build the install URL with `webBaseUrl`:

```ts
const config = getGitHubAppConfig();
const issued = await issueGitHubInstallAttempt({
  clerkOrgId: orgAccess.org.id,
  lightfastUserId: ctx.auth.identity.userId,
  orgSlug: orgAccess.org.slug,
});

return {
  installationUrl: buildGitHubInstallationUrl({
    appSlug: config.appSlug,
    state: issued.state,
    webBaseUrl: config.endpoints.webBaseUrl,
  }),
};
```

- [ ] **Step 4: Run router test**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-setup-router.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit router setup**

Run:

```bash
git add api/app/src/router/\\(pending-not-allowed\\)/github-setup.ts api/app/src/__tests__/github-setup-router.test.ts
git commit -m "refactor: start github setup through endpoint config"
```

---

### Task 6: Setup And OAuth Flow Without Emulator Branching

**Files:**
- Modify: `api/app/src/github/setup-flow.ts`
- Modify: `api/app/src/__tests__/github-setup-flow.test.ts`

- [ ] **Step 1: Update setup-flow mocks**

In `api/app/src/__tests__/github-setup-flow.test.ts`, rename the verifier mock and update the node package mock:

```ts
const verifyGitHubUserInstallationMock = vi.fn();

vi.mock("@repo/github-app-node", () => ({
  buildGitHubOAuthAuthorizeUrl: (input: {
    clientId: string;
    codeChallenge: string;
    oauthAuthorizeUrl?: string;
    redirectUri: string;
    state: string;
  }) => {
    const url = new URL(
      input.oauthAuthorizeUrl ?? "https://github.com/login/oauth/authorize"
    );
    url.searchParams.set("client_id", input.clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("state", input.state);
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  },
  createGitHubPkcePair: createGitHubPkcePairMock,
  exchangeGitHubOAuthCode: exchangeGitHubOAuthCodeMock,
  GitHubAppNodeError: class GitHubAppNodeError extends Error {
    constructor(
      readonly code: string,
      message: string
    ) {
      super(message);
      this.name = "GitHubAppNodeError";
    }
  },
  verifyGitHubUserInstallation: verifyGitHubUserInstallationMock,
}));
```

Update the config mock:

```ts
vi.mock("../github/config", () => ({
  getGitHubAppConfig: () => ({
    apiVersion: "2022-11-28",
    clientId: "github_client_test",
    clientSecret: "github_secret_test",
    endpoints: {
      apiBaseUrl: "https://github.lightfast.localhost",
      oauthAuthorizeUrl:
        "https://github.lightfast.localhost/login/oauth/authorize",
      oauthTokenUrl:
        "https://github.lightfast.localhost/login/oauth/access_token",
      webBaseUrl: "https://github.lightfast.localhost",
    },
  }),
  resolveGitHubAppOrigin: () => "https://app.lightfast.localhost",
}));
```

- [ ] **Step 2: Update test attempt factories**

Replace the setup-flow attempt factories with records that contain no emulator field:

```ts
function installAttempt() {
  return {
    clerkOrgId: "org_1",
    lightfastUserId: "user_1",
    orgSlug: "acme",
  };
}

function oauthAttempt() {
  return {
    ...installAttempt(),
    codeVerifier: "verifier_123",
    providerInstallationId: "1001",
  };
}
```

- [ ] **Step 3: Update verifier mock reset and default response**

In the setup-flow test `beforeEach`, replace the old emulator verifier reset and default response with:

```ts
verifyGitHubUserInstallationMock.mockReset();
verifyGitHubUserInstallationMock.mockResolvedValue({
  account: {
    id: "2001",
    login: "lightfast-emulated",
    type: "Organization",
  },
  appId: "12345",
  appSlug: "lightfast-test",
  events: ["push"],
  id: "1001",
  permissions: { contents: "read" },
  repositorySelection: "all",
  suspendedAt: null,
  targetType: "Organization",
});
```

Replace personal-account rejection setup with:

```ts
verifyGitHubUserInstallationMock.mockRejectedValue(
  new GitHubAppNodeError(
    "PERSONAL_ACCOUNT_NOT_SUPPORTED",
    "Only GitHub organization installations are supported."
  )
);
```

- [ ] **Step 4: Update setup redirect and OAuth verification expectations**

The setup redirect expectation should use the configured authorize URL:

```ts
expect(result).toEqual({
  redirectUrl:
    "https://github.lightfast.localhost/login/oauth/authorize?client_id=github_client_test&redirect_uri=https%3A%2F%2Fapp.lightfast.localhost%2Fapi%2Fgithub%2Foauth%2Fcallback&state=oauth_state_123&code_challenge=challenge_123&code_challenge_method=S256",
});
expect(issueGitHubOAuthAttemptMock).toHaveBeenCalledWith({
  clerkOrgId: "org_1",
  codeVerifier: "verifier_123",
  lightfastUserId: "user_1",
  orgSlug: "acme",
  providerInstallationId: "1001",
});
```

The successful OAuth callback should assert token exchange and verifier inputs:

```ts
expect(exchangeGitHubOAuthCodeMock).toHaveBeenCalledWith({
  clientId: "github_client_test",
  clientSecret: "github_secret_test",
  code: "code_123",
  codeVerifier: "verifier_123",
  redirectUri:
    "https://app.lightfast.localhost/api/github/oauth/callback",
  tokenUrl: "https://github.lightfast.localhost/login/oauth/access_token",
});
expect(verifyGitHubUserInstallationMock).toHaveBeenCalledWith({
  apiBaseUrl: "https://github.lightfast.localhost",
  apiVersion: "2022-11-28",
  expectedInstallationId: "1001",
  userAccessToken: "github_user_token",
});
expect(finalizeActiveOrgProviderBindingMock.mock.calls[0]?.[1].metadata).toEqual(
  {
    events: ["push"],
    githubAppId: "12345",
    githubAppSlug: "lightfast-test",
    permissions: { contents: "read" },
    repositorySelection: "all",
  }
);
```

Remove the setup-phase installation id mismatch test. Add this replacement to prove the callback id is carried to OAuth verification instead of verified against emulator fixture state:

```ts
it("carries the callback installation id into the OAuth attempt", async () => {
  mockInstallAttempt();

  await completeGitHubInstallationSetup({
    appOrigin: "https://app.lightfast.localhost",
    requestUrl:
      "https://app.lightfast.localhost/api/github/setup?installation_id=7777&setup_action=install&state=install_state_123",
  });

  expect(issueGitHubOAuthAttemptMock).toHaveBeenCalledWith(
    expect.objectContaining({
      providerInstallationId: "7777",
    })
  );
});
```

- [ ] **Step 5: Run setup-flow tests and observe the expected failure**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-setup-flow.test.ts
```

Expected: FAIL because `setup-flow.ts` still reads emulator context, compares the install id against emulator state, calls `verifyGitHubEmulatorInstallation`, and writes `verifiedBy`.

- [ ] **Step 6: Update setup-flow imports**

In `api/app/src/github/setup-flow.ts`, replace imports:

```ts
import {
  buildGitHubOAuthAuthorizeUrl,
  createGitHubPkcePair,
  exchangeGitHubOAuthCode,
  GitHubAppNodeError,
  verifyGitHubUserInstallation,
} from "@repo/github-app-node";
```

and:

```ts
import { getGitHubAppConfig, resolveGitHubAppOrigin } from "./config";
```

- [ ] **Step 7: Update installation setup callback**

In `completeGitHubInstallationSetup`, remove the `installationId !== pendingAttempt.emulator.installationId` block. Replace the emulator config and OAuth attempt block with:

```ts
const config = getGitHubAppConfig();
const pkce = createGitHubPkcePair();
const oauthAttempt = await issueGitHubOAuthAttempt({
  clerkOrgId: attempt.clerkOrgId,
  codeVerifier: pkce.codeVerifier,
  lightfastUserId: attempt.lightfastUserId,
  orgSlug: attempt.orgSlug,
  providerInstallationId: installationId,
});

const authorizeUrl = buildGitHubOAuthAuthorizeUrl({
  clientId: config.clientId,
  codeChallenge: pkce.codeChallenge,
  oauthAuthorizeUrl: config.endpoints.oauthAuthorizeUrl,
  redirectUri: new URL(GITHUB_OAUTH_CALLBACK_PATH, appOrigin).toString(),
  state: oauthAttempt.state,
});
```

- [ ] **Step 8: Update OAuth callback verification and metadata**

In `completeGitHubOAuthVerification`, replace emulator token exchange and verification with:

```ts
const config = getGitHubAppConfig();
const token = await exchangeGitHubOAuthCode({
  clientId: config.clientId,
  clientSecret: config.clientSecret,
  code,
  codeVerifier: attempt.codeVerifier,
  redirectUri: new URL(GITHUB_OAUTH_CALLBACK_PATH, appOrigin).toString(),
  tokenUrl: config.endpoints.oauthTokenUrl,
});

const installation = await verifyGitHubUserInstallation({
  apiBaseUrl: config.endpoints.apiBaseUrl,
  apiVersion: config.apiVersion,
  expectedInstallationId: attempt.providerInstallationId,
  userAccessToken: token.accessToken,
});

const metadata = githubInstallationMetadataSchema.parse({
  events: installation.events,
  githubAppId: installation.appId,
  githubAppSlug: installation.appSlug,
  githubSetupAction:
    requestUrl.searchParams.get("setup_action") ?? undefined,
  permissions: installation.permissions,
  repositorySelection: installation.repositorySelection,
});
```

- [ ] **Step 9: Run setup-flow tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-setup-flow.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit setup flow cleanup**

Run:

```bash
git add api/app/src/github/setup-flow.ts api/app/src/__tests__/github-setup-flow.test.ts
git commit -m "refactor: verify github setup without emulator state"
```

---

### Task 7: GitHub-Compatible Emulator Routes And Env

**Files:**
- Create: `emulators/github/src/github-compatible-routes.ts`
- Modify: `emulators/github/package.json`
- Modify: `package.json`
- Modify: `apps/app/package.json`
- Modify: `emulators/github/src/fixtures.ts`
- Modify: `emulators/github/src/server.ts`
- Modify: `emulators/github/src/__tests__/server.test.ts`

- [ ] **Step 1: Add emulator route tests**

In `emulators/github/src/__tests__/server.test.ts`, update the crypto import:

```ts
import { createHash, createPrivateKey } from "node:crypto";
```

Add helpers near `createAppJwt`:

```ts
function createCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function appCallbackUrl(path = "/api/github/oauth/callback") {
  return new URL(path, "https://lightfast.localhost").toString();
}
```

Add tests:

```ts
it("redirects GitHub App install requests to the Lightfast setup callback", async () => {
  const res = await fetch(
    `${emulator?.url}/apps/${GITHUB_EMULATOR_FIXTURES.githubAppSlug}/installations/new?state=install_state_123`,
    { redirect: "manual" }
  );

  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe(
    "https://lightfast.localhost/api/github/setup?installation_id=1001&setup_action=install&state=install_state_123"
  );
});

it("rejects install requests for an unknown GitHub App slug", async () => {
  const res = await fetch(
    `${emulator?.url}/apps/unknown/installations/new?state=install_state_123`,
    { redirect: "manual" }
  );

  expect(res.status).toBe(404);
  await expect(res.json()).resolves.toEqual({ message: "Not Found" });
});

it("performs OAuth authorize and token exchange with PKCE", async () => {
  const codeVerifier = "verifier_123456789012345678901234567890";
  const authorizeUrl = new URL(`${emulator?.url}/login/oauth/authorize`);
  authorizeUrl.searchParams.set(
    "client_id",
    GITHUB_EMULATOR_FIXTURES.oauthClientId
  );
  authorizeUrl.searchParams.set("redirect_uri", appCallbackUrl());
  authorizeUrl.searchParams.set("state", "oauth_state_123");
  authorizeUrl.searchParams.set(
    "code_challenge",
    createCodeChallenge(codeVerifier)
  );
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const authorizeRes = await fetch(authorizeUrl, { redirect: "manual" });
  expect(authorizeRes.status).toBe(302);
  const callback = new URL(authorizeRes.headers.get("location") ?? "");
  expect(callback.origin + callback.pathname).toBe(appCallbackUrl());
  expect(callback.searchParams.get("state")).toBe("oauth_state_123");

  const tokenRes = await fetch(`${emulator?.url}/login/oauth/access_token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_EMULATOR_FIXTURES.oauthClientId,
      client_secret: GITHUB_EMULATOR_FIXTURES.oauthClientSecret,
      code: callback.searchParams.get("code"),
      code_verifier: codeVerifier,
      redirect_uri: appCallbackUrl(),
    }),
  });

  expect(tokenRes.status).toBe(200);
  await expect(tokenRes.json()).resolves.toMatchObject({
    access_token: expect.stringMatching(/^gho_/),
    token_type: "bearer",
  });
});

it("returns the OAuth user and accessible app installations", async () => {
  const userRes = await fetch(`${emulator?.url}/user`, {
    headers: {
      authorization: `Bearer ${GITHUB_EMULATOR_FIXTURES.userToken}`,
    },
  });

  expect(userRes.status).toBe(200);
  await expect(userRes.json()).resolves.toMatchObject({
    login: GITHUB_EMULATOR_FIXTURES.githubUserLogin,
  });

  const installationsRes = await fetch(`${emulator?.url}/user/installations`, {
    headers: {
      authorization: `Bearer ${GITHUB_EMULATOR_FIXTURES.userToken}`,
    },
  });

  expect(installationsRes.status).toBe(200);
  await expect(installationsRes.json()).resolves.toMatchObject({
    total_count: 1,
    installations: [
      expect.objectContaining({
        id: GITHUB_EMULATOR_FIXTURES.installationId,
        account: expect.objectContaining({
          login: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
          type: "Organization",
        }),
        target_type: "Organization",
      }),
    ],
  });
});
```

Update env tests in the same file:

```ts
expect(getGitHubEmulatorEnv("https://lightfast.localhost")).toEqual(
  expect.objectContaining({
    GITHUB_APP_ENDPOINT_ORIGIN: GITHUB_EMULATOR_FIXTURES.origin,
    GITHUB_APP_ID: String(GITHUB_EMULATOR_FIXTURES.githubAppId),
    GITHUB_APP_SLUG: GITHUB_EMULATOR_FIXTURES.githubAppSlug,
  })
);
expect(getGitHubEmulatorEnv("https://lightfast.localhost")).not.toHaveProperty(
  "GITHUB_INSTALL_URL_OVERRIDE"
);
```

- [ ] **Step 2: Run emulator tests and observe the expected failure**

Run:

```bash
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
```

Expected: FAIL because the install route, automatic OAuth authorize redirect, PKCE validation, `/user/installations`, and env name are not implemented yet.

- [ ] **Step 3: Update emitted emulator env**

In `emulators/github/src/fixtures.ts`, change `getGitHubEmulatorEnv` to return the generic endpoint origin and remove `installUrl` construction:

```ts
export function getGitHubEmulatorEnv(
  _appOrigin: string,
  emulatorOrigin: string = GITHUB_EMULATOR_FIXTURES.origin
) {
  return {
    GITHUB_APP_ID: String(GITHUB_EMULATOR_FIXTURES.githubAppId),
    GITHUB_APP_SLUG: GITHUB_EMULATOR_FIXTURES.githubAppSlug,
    GITHUB_API_VERSION: "2022-11-28",
    GITHUB_APP_CLIENT_ID: GITHUB_EMULATOR_FIXTURES.oauthClientId,
    GITHUB_APP_CLIENT_SECRET: GITHUB_EMULATOR_FIXTURES.oauthClientSecret,
    GITHUB_APP_ENDPOINT_ORIGIN: emulatorOrigin,
    GITHUB_APP_PRIVATE_KEY:
      GITHUB_EMULATOR_FIXTURES.githubAppPrivateKey.replace(/\n/g, "\\n"),
    GITHUB_APP_WEBHOOK_SECRET: GITHUB_EMULATOR_FIXTURES.githubWebhookSecret,
  };
}
```

- [ ] **Step 4: Align emulator callback origin with the app service URL**

The app process already receives `NEXT_PUBLIC_APP_URL=$(portless get app.lightfast)`. Use the same direct app origin when seeding the emulator OAuth app so `redirect_uri` validation matches the API helper.

In root `package.json`, update `_github_emulator`:

```json
"_github_emulator": "portless run --name github.lightfast sh -c 'LIGHTFAST_APP_ORIGIN=\"$(portless get app.lightfast)\" GITHUB_EMULATOR_ORIGIN=\"$(portless get github.lightfast)\" pnpm --filter @repo/github-emulator dev'"
```

In `apps/app/package.json`, update the `with-related-projects` env printer call:

```json
"with-related-projects": "env -S \"$(pnpm --silent --filter @repo/github-emulator env:sh -- --app-origin \"$(portless get app.lightfast)\" --emulator-origin \"$(portless get github.lightfast)\")\" INNGEST_SERVE_ORIGIN=$(portless get app.lightfast) NEXT_PUBLIC_APP_URL=$(portless get app.lightfast) NEXT_PUBLIC_WWW_URL=$(portless get www.lightfast) NEXT_PUBLIC_PLATFORM_URL=$(portless get platform.lightfast) INNGEST_DEV=$(portless get inngest.lightfast) QSTASH_URL=$(portless get qstash.lightfast)"
```

- [ ] **Step 5: Add GitHub-compatible route wrapper**

Create `emulators/github/src/github-compatible-routes.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";
import type { Store, TokenMap } from "@emulators/core";
import { getGitHubStore } from "@emulators/github";
import { GITHUB_SETUP_PATH } from "@repo/github-app-contract";

import { GITHUB_EMULATOR_FIXTURES } from "./fixtures";

interface PendingOAuthCode {
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  expiresAt: number;
  login: string;
  redirectUri: string;
}

interface GitHubCompatibleFetchInput {
  appOrigin: string;
  fallbackFetch: (request: Request) => Response | Promise<Response>;
  publicOrigin: string;
  store: Store;
  tokenMap: TokenMap;
}

const PENDING_CODES_KEY = "lightfast.github.oauth.pendingCodes";
const CODE_TTL_MS = 5 * 60 * 1000;

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function notFound() {
  return json({ message: "Not Found" }, 404);
}

function getPendingCodes(store: Store) {
  let codes = store.getData<Map<string, PendingOAuthCode>>(PENDING_CODES_KEY);
  if (!codes) {
    codes = new Map();
    store.setData(PENDING_CODES_KEY, codes);
  }
  return codes;
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}

function authenticateUser(input: {
  request: Request;
  store: Store;
  tokenMap: TokenMap;
}) {
  const token = getBearerToken(input.request);
  if (!token) {
    return null;
  }
  const authUser = input.tokenMap.get(token);
  if (!authUser) {
    return null;
  }
  const gh = getGitHubStore(input.store);
  return gh.users.findOneBy("login", authUser.login) ?? null;
}

function validatePkce(input: { codeChallenge: string; codeVerifier: string }) {
  const challenge = createHash("sha256")
    .update(input.codeVerifier)
    .digest("base64url");
  return challenge === input.codeChallenge;
}

function formatInstallation(input: {
  installationId: number;
  publicOrigin: string;
  store: Store;
}) {
  const gh = getGitHubStore(input.store);
  const installation = gh.appInstallations
    .all()
    .find((candidate) => candidate.installation_id === input.installationId);
  if (!installation) {
    return null;
  }
  const app = gh.apps
    .all()
    .find((candidate) => candidate.app_id === installation.app_id);
  const account =
    installation.account_type === "Organization"
      ? gh.orgs.get(installation.account_id)
      : gh.users.get(installation.account_id);
  if (!account) {
    return null;
  }

  return {
    id: installation.installation_id,
    account: {
      id: account.id,
      login: account.login,
      node_id: account.node_id,
      type: installation.account_type,
      avatar_url: `${input.publicOrigin}/avatars/u/${account.login}`,
      url: `${input.publicOrigin}/${
        installation.account_type === "Organization" ? "orgs" : "users"
      }/${account.login}`,
    },
    access_tokens_url: `${input.publicOrigin}/app/installations/${installation.installation_id}/access_tokens`,
    app_id: installation.app_id,
    app_slug: app?.slug ?? null,
    events: installation.events,
    html_url: `${input.publicOrigin}/settings/installations/${installation.installation_id}`,
    permissions: installation.permissions,
    repositories_url: `${input.publicOrigin}/installation/repositories`,
    repository_selection: installation.repository_selection,
    single_file_name: null,
    has_multiple_single_files: false,
    single_file_paths: [],
    suspended_at: installation.suspended_at,
    suspended_by: null,
    target_type: installation.account_type,
  };
}

function userOrgIds(input: { store: Store; userId: number }) {
  const gh = getGitHubStore(input.store);
  const teamIds = gh.teamMembers
    .findBy("user_id", input.userId)
    .map((member) => member.team_id);
  return new Set(
    teamIds
      .map((teamId) => gh.teams.get(teamId)?.org_id)
      .filter((orgId): orgId is number => typeof orgId === "number")
  );
}

async function readBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const text = await request.text();
  if (contentType.includes("application/json")) {
    return JSON.parse(text || "{}") as Record<string, unknown>;
  }
  return Object.fromEntries(new URLSearchParams(text));
}

export function createGitHubCompatibleFetch(input: GitHubCompatibleFetchInput) {
  return async function gitHubCompatibleFetch(request: Request) {
    const url = new URL(request.url);
    const gh = getGitHubStore(input.store);

    const installMatch = /^\/apps\/([^/]+)\/installations\/new$/.exec(
      url.pathname
    );
    if (request.method === "GET" && installMatch) {
      const slug = installMatch[1];
      const app = gh.apps.findOneBy("slug", slug);
      if (!app) {
        return notFound();
      }
      const installation = gh.appInstallations
        .findBy("app_id", app.app_id)
        .find(
          (candidate) =>
            candidate.installation_id ===
            GITHUB_EMULATOR_FIXTURES.installationId
        );
      const state = url.searchParams.get("state");
      if (!(installation && state)) {
        return json({ message: "Bad Request" }, 400);
      }
      const redirectUrl = new URL(GITHUB_SETUP_PATH, input.appOrigin);
      redirectUrl.searchParams.set(
        "installation_id",
        String(installation.installation_id)
      );
      redirectUrl.searchParams.set("setup_action", "install");
      redirectUrl.searchParams.set("state", state);
      return Response.redirect(redirectUrl.toString(), 302);
    }

    if (request.method === "GET" && url.pathname === "/login/oauth/authorize") {
      const clientId = url.searchParams.get("client_id") ?? "";
      const redirectUri = url.searchParams.get("redirect_uri") ?? "";
      const state = url.searchParams.get("state") ?? "";
      const codeChallenge = url.searchParams.get("code_challenge") ?? "";
      const codeChallengeMethod =
        url.searchParams.get("code_challenge_method") ?? "";
      const oauthApp = gh.oauthApps.findOneBy("client_id", clientId);
      if (
        !oauthApp ||
        !oauthApp.redirect_uris.includes(redirectUri) ||
        !state ||
        !codeChallenge ||
        codeChallengeMethod !== "S256"
      ) {
        return json({ message: "Bad Request" }, 400);
      }

      const code = randomBytes(20).toString("hex");
      getPendingCodes(input.store).set(code, {
        clientId,
        codeChallenge,
        codeChallengeMethod,
        expiresAt: Date.now() + CODE_TTL_MS,
        login: GITHUB_EMULATOR_FIXTURES.githubUserLogin,
        redirectUri,
      });
      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      return Response.redirect(callbackUrl.toString(), 302);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/login/oauth/access_token"
    ) {
      const body = await readBody(request).catch(() => ({}));
      const clientId = String(body.client_id ?? "");
      const clientSecret = String(body.client_secret ?? "");
      const code = String(body.code ?? "");
      const codeVerifier = String(body.code_verifier ?? "");
      const redirectUri = String(body.redirect_uri ?? "");
      const oauthApp = gh.oauthApps.findOneBy("client_id", clientId);
      const pending = getPendingCodes(input.store).get(code);
      if (
        !oauthApp ||
        oauthApp.client_secret !== clientSecret ||
        !pending ||
        pending.expiresAt < Date.now() ||
        pending.clientId !== clientId ||
        pending.redirectUri !== redirectUri ||
        !validatePkce({ codeChallenge: pending.codeChallenge, codeVerifier })
      ) {
        return json(
          {
            error: "bad_verification_code",
            error_description: "The code passed is incorrect or expired.",
          },
          200
        );
      }

      getPendingCodes(input.store).delete(code);
      const user = gh.users.findOneBy("login", pending.login);
      if (!user) {
        return json(
          {
            error: "bad_verification_code",
            error_description: "The code passed is incorrect or expired.",
          },
          200
        );
      }
      const token = `gho_${randomBytes(20).toString("base64url")}`;
      input.tokenMap.set(token, {
        id: user.id,
        login: user.login,
        scopes: ["repo", "user", "read:org"],
      });
      return json({
        access_token: token,
        token_type: "bearer",
        scope: "repo user read:org",
      });
    }

    if (request.method === "GET" && url.pathname === "/user") {
      const user = authenticateUser({
        request,
        store: input.store,
        tokenMap: input.tokenMap,
      });
      if (!user) {
        return json({ message: "Bad credentials" }, 401);
      }
      return json({
        id: user.id,
        login: user.login,
        node_id: user.node_id,
        type: user.type,
        name: user.name,
        email: user.email,
      });
    }

    if (request.method === "GET" && url.pathname === "/user/installations") {
      const user = authenticateUser({
        request,
        store: input.store,
        tokenMap: input.tokenMap,
      });
      if (!user) {
        return json({ message: "Bad credentials" }, 401);
      }
      const orgIds = userOrgIds({ store: input.store, userId: user.id });
      const installations = gh.appInstallations
        .all()
        .filter(
          (installation) =>
            (installation.account_type === "Organization" &&
              orgIds.has(installation.account_id)) ||
            (installation.account_type === "User" &&
              installation.account_id === user.id)
        )
        .map((installation) =>
          formatInstallation({
            installationId: installation.installation_id,
            publicOrigin: input.publicOrigin,
            store: input.store,
          })
        )
        .filter((installation): installation is NonNullable<typeof installation> =>
          Boolean(installation)
        );

      return json({
        total_count: installations.length,
        installations,
      });
    }

    return input.fallbackFetch(request);
  };
}
```

- [ ] **Step 6: Wrap the emulator fetch handler**

In `emulators/github/src/server.ts`, import and use the wrapper:

```ts
import { createGitHubCompatibleFetch } from "./github-compatible-routes";
```

Replace the `serve` call with:

```ts
const httpServer: Server = serve({
  fetch: createGitHubCompatibleFetch({
    appOrigin,
    fallbackFetch: server.app.fetch,
    publicOrigin,
    store: server.store,
    tokenMap: server.tokenMap,
  }),
  hostname: host,
  port,
});
```

- [ ] **Step 7: Add shared contract dependency**

Add this dependency to `emulators/github/package.json`:

```json
"dependencies": {
  "@repo/github-app-contract": "workspace:*",
  "@t3-oss/env-core": "catalog:",
  "zod": "catalog:"
}
```

- [ ] **Step 8: Run emulator tests**

Run:

```bash
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit emulator route work**

Run:

```bash
git add package.json apps/app/package.json emulators/github/package.json emulators/github/src/fixtures.ts emulators/github/src/server.ts emulators/github/src/github-compatible-routes.ts emulators/github/src/__tests__/server.test.ts
git commit -m "feat: make github emulator install flow compatible"
```

---

### Task 8: Remove App Dev Install Shim

**Files:**
- Delete: `apps/app/src/app/(app)/(github)/api/dev/github/install/route.ts`
- Modify: `apps/app/src/proxy.ts`
- Modify: `apps/app/src/__tests__/proxy.test.ts`
- Modify: `apps/app/src/__tests__/app/api/github/github-routes.test.ts`

- [ ] **Step 1: Update app route tests**

In `apps/app/src/__tests__/app/api/github/github-routes.test.ts`, delete all dev install shim tests and remove all `GITHUB_INSTALL_URL_OVERRIDE` environment stubbing. Keep only setup and OAuth delegation tests. The remaining tests should assert:

```ts
expect(completeSetupMock).toHaveBeenCalledWith({
  requestUrl:
    "https://localhost:4293/api/github/setup?installation_id=1001&state=abc",
});
expect(completeOAuthMock).toHaveBeenCalledWith({
  requestUrl:
    "https://localhost:4293/api/github/oauth/callback?code=abc&state=def",
});
```

- [ ] **Step 2: Update proxy tests**

In `apps/app/src/__tests__/proxy.test.ts`, replace the public GitHub route table:

```ts
it.each([
  "/api/github/setup",
  "/api/github/oauth/callback",
])("runs Clerk middleware but does not enforce signed-in routing for %s", async (pathname) => {
  authMock.mockResolvedValue({
    orgId: null,
    orgSlug: null,
    sessionClaims: null,
    sessionStatus: "pending",
    userId: null,
  });

  const { response } = await invoke(pathname);

  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
  expect(clerkProxyRequestMock).toHaveBeenCalledWith(pathname);
  expect(authMock).not.toHaveBeenCalled();
});
```

Add a test proving the old shim path is no longer public:

```ts
it("does not admit the old dev GitHub install shim as a public route", async () => {
  authMock.mockResolvedValue({
    orgId: null,
    orgSlug: null,
    sessionClaims: null,
    sessionStatus: "pending",
    userId: null,
  });

  const { response } = await invoke("/api/dev/github/install");

  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(
    "https://app.lightfast.localhost/sign-in?redirect_url=%2Fapi%2Fdev%2Fgithub%2Finstall"
  );
});
```

- [ ] **Step 3: Run app tests and observe the expected failure**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/app/api/github/github-routes.test.ts src/__tests__/proxy.test.ts
```

Expected: FAIL because `/api/dev/github/install` is still public and the route file still exists.

- [ ] **Step 4: Remove the route and proxy entry**

Delete the route file:

```bash
rm apps/app/src/app/\\(app\\)/\\(github\\)/api/dev/github/install/route.ts
```

In `apps/app/src/proxy.ts`, update the GitHub route patterns:

```ts
const GITHUB_BINDING_ROUTE_PATTERNS = [
  "/api/github/setup",
  "/api/github/oauth/callback",
] as const;
```

- [ ] **Step 5: Run app tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/app/api/github/github-routes.test.ts src/__tests__/proxy.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit app shim removal**

Run:

```bash
git add apps/app/src/proxy.ts apps/app/src/__tests__/proxy.test.ts apps/app/src/__tests__/app/api/github/github-routes.test.ts apps/app/src/app/\\(app\\)/\\(github\\)/api/dev/github/install/route.ts
git commit -m "refactor: remove app github dev install shim"
```

---

### Task 9: Boundary Cleanup, Docs, And Verification

**Files:**
- Modify: `emulators/github/README.md`
- Modify: `api/app/src/__tests__/org-binding-helpers.test.ts`
- Check: `apps/app/package.json`
- Check: `api/app/src/github/index.ts`

- [ ] **Step 1: Remove metadata provenance from DB helper tests**

In `api/app/src/__tests__/org-binding-helpers.test.ts`, replace metadata examples:

```ts
metadata: { verifiedBy: "github_emulator" },
```

with:

```ts
metadata: {
  githubAppId: "424242",
  repositorySelection: "all",
},
```

This keeps DB helper tests generic because the DB helper stores opaque provider metadata.

- [ ] **Step 2: Update emulator README**

In `emulators/github/README.md`, replace references to `GITHUB_INSTALL_URL_OVERRIDE` and `/api/dev/github/install` with this local flow description:

````md
The emulator is routed at:

```text
https://github.lightfast.localhost
```

The app and API receive `GITHUB_APP_ENDPOINT_ORIGIN` from `pnpm --filter @repo/github-emulator env:sh`. Local setup starts at:

```text
https://github.lightfast.localhost/apps/lightfast-local/installations/new
```

The emulator redirects to `/api/github/setup`, completes OAuth through `/login/oauth/authorize` and `/login/oauth/access_token`, and returns user-accessible installations from `/user/installations`.
````

- [ ] **Step 3: Run focused package tests**

Run:

```bash
pnpm --filter @repo/github-app-contract test -- src/__tests__/github-app.test.ts
pnpm --filter @repo/github-app-node test -- src/__tests__/urls.test.ts src/__tests__/oauth.test.ts src/__tests__/installations.test.ts
pnpm --filter @api/app test -- src/__tests__/github-config.test.ts src/__tests__/github-bind-attempts.test.ts src/__tests__/github-setup-router.test.ts src/__tests__/github-setup-flow.test.ts src/__tests__/org-binding-helpers.test.ts
pnpm --filter @lightfast/app test -- src/__tests__/app/api/github/github-routes.test.ts src/__tests__/proxy.test.ts
pnpm --filter @repo/github-emulator test -- src/__tests__/env.test.ts src/__tests__/server.test.ts
```

Expected: all commands PASS.

- [ ] **Step 4: Run typechecks for touched packages**

Run:

```bash
pnpm --filter @repo/github-app-contract typecheck
pnpm --filter @repo/github-app-node typecheck
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
pnpm --filter @repo/github-emulator typecheck
```

Expected: all commands PASS.

- [ ] **Step 5: Run boundary scans**

Run:

```bash
rg -n "GITHUB_INSTALL_URL_OVERRIDE" api/app/src apps/app/src packages/github-app-contract/src packages/github-app-node/src emulators/github/src --glob '!**/__tests__/**'
```

Expected: the only matches are in `api/app/src/github/config.ts`, where the legacy variable is rejected.

Run:

```bash
rg -n "GITHUB_DEV_INSTALL_PATH|verifyGitHubEmulatorInstallation|verifiedBy" api/app/src apps/app/src packages/github-app-contract/src packages/github-app-node/src emulators/github/src --glob '!**/__tests__/**'
```

Expected: no matches.

Run:

```bash
rg -n "/api/dev/github|dev/github" apps/app/src/app apps/app/src/proxy.ts api/app/src/github api/app/src/router packages/github-app-contract/src packages/github-app-node/src --glob '!**/__tests__/**'
```

Expected: no matches.

Run:

```bash
rg -n "emulatorOrigin|providerAccountLogin" api/app/src/github api/app/src/router --glob '!**/__tests__/**'
```

Expected: no matches.

- [ ] **Step 6: Run local env printer smoke test**

Run:

```bash
pnpm --silent --filter @repo/github-emulator env:sh -- --app-origin "https://lightfast.localhost" --emulator-origin "https://github.lightfast.localhost"
```

Expected output includes:

```text
GITHUB_APP_ENDPOINT_ORIGIN='https://github.lightfast.localhost'
```

Expected output does not include:

```text
GITHUB_INSTALL_URL_OVERRIDE
```

- [ ] **Step 7: Commit cleanup and docs**

Run:

```bash
git add emulators/github/README.md api/app/src/__tests__/org-binding-helpers.test.ts
git commit -m "docs: update github emulator boundary"
```

- [ ] **Step 8: Final status check**

Run:

```bash
git status --short
```

Expected: clean worktree.

## Implementation Order

Use one commit per task in the order above. If a task uncovers a compile issue in a previous task, fix it in the current task and include the affected file in that task commit. Do not start application-level route deletion before the emulator route and API flow tests pass, because local setup needs a working replacement before the shim is removed.

## Manual Verification

After all automated checks pass, run the local flow:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

Open:

```text
https://lightfast.localhost
```

Expected browser flow:

1. Start GitHub connection from the org bind task page.
2. Browser navigates to `https://github.lightfast.localhost/apps/lightfast-local/installations/new`.
3. Emulator redirects to `https://app.lightfast.localhost/api/github/setup`.
4. Browser redirects through `https://github.lightfast.localhost/login/oauth/authorize`.
5. Browser returns to `https://lightfast.localhost/api/github/oauth/callback`.
6. Browser lands on `/<orgSlug>/tasks/bind/github/complete`.
7. Completion page reloads Clerk session and the org becomes bound.

No visible page, redirect URL, Redis attempt, API metadata, or app route should mention `/api/dev/github/install`, `GITHUB_INSTALL_URL_OVERRIDE`, or emulator verification.
