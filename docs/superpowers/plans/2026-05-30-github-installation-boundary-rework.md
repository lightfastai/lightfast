# GitHub Installation Boundary Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move GitHub installation setup orchestration behind `api/app/src/services/github`, move Clerk organization admin verification into `api/app/src/auth`, and keep the local GitHub emulator as root development infrastructure without changing the production-shaped setup flow.

**Architecture:** `apps/app` keeps only thin Next.js route handlers for GitHub callbacks. `api/app/src/services/github` owns GitHub setup orchestration, Redis attempts, callback parsing, redirect decisions, DB finalization, and error mapping while delegating generic Clerk membership checks to `api/app/src/auth`. `@repo/github-app-node` remains the GitHub protocol boundary, `@repo/github-app-contract` remains the client-safe contract boundary, and `emulators/github` remains dev-only infrastructure.

**Tech Stack:** pnpm workspaces, Turborepo, Next.js App Router route handlers, tRPC v11, Clerk, Upstash Redis, Drizzle MySQL helpers, `@repo/github-app-node`, `@repo/github-app-contract`, `@repo/github-emulator`, Zod, Vitest.

---

## Scope Check

This plan covers one connected subsystem: GitHub App organization binding setup. The auth helper, GitHub service files, route handler imports, package exports, and emulator workspace references all participate in the same setup/OAuth callback flow, so they should be executed together.

In scope:

- Add a generic, paginated Clerk organization membership helper under `api/app/src/auth`.
- Move `api/app/src/github` into `api/app/src/services/github`.
- Split the current GitHub setup orchestration into focused setup files.
- Update tRPC router, app route handlers, mocks, tests, and package exports to import the new service boundary.
- Preserve Redis attempt consumption ordering, sign-in redirects, OAuth exchange, installation verification, DB finalization, and Clerk mirror tolerance.
- Verify the emulator already lives under `emulators/github` and remove stale production references to the old API-root GitHub module.

Out of scope:

- GitHub webhooks.
- New durable GitHub-specific DB tables.
- SQL migrations.
- Persisting GitHub OAuth user access tokens.
- GitHub Enterprise Server endpoint matrices.
- Broad tRPC router redesign outside the GitHub setup routes.

## File Structure

Create:

- `api/app/src/auth/clerk-org-membership.ts` - generic Clerk organization membership listing, lookup, and admin assertion with pagination.
- `api/app/src/services/github/index.ts` - public service exports for app routes and routers.
- `api/app/src/services/github/setup/attempts.ts` - Redis-backed install and OAuth attempts, moved from `api/app/src/github/bind-attempts.ts`.
- `api/app/src/services/github/setup/callbacks.ts` - setup and OAuth callback parsing.
- `api/app/src/services/github/setup/errors.ts` - maps auth, provider, and DB errors to GitHub bind UI error codes.
- `api/app/src/services/github/setup/finalize-binding.ts` - DB finalization, Clerk binding mirror tolerance, and binding claim sync.
- `api/app/src/services/github/setup/flow.ts` - small orchestration entrypoints for setup and OAuth callbacks.
- `api/app/src/services/github/setup/redirects.ts` - setup redirect URL builders.
- `api/app/src/__tests__/auth-clerk-org-membership.test.ts` - pagination and admin assertion tests.

Move:

- `api/app/src/github/config.ts` -> `api/app/src/services/github/config.ts`

Modify:

- `api/app/package.json` - replace `./github` export with `./services/github`.
- `api/app/src/auth/identity.ts` - reuse the generic membership helper for native OAuth org membership lookup.
- `api/app/src/auth/organization-access.ts` - reuse the generic membership helper for slug lookup.
- `api/app/src/router/(pending-allowed)/native-auth.ts` - reuse the generic membership helper for list and selected-org assertions.
- `api/app/src/router/(pending-allowed)/organization.ts` - reuse the generic membership helper for list output.
- `api/app/src/router/(pending-not-allowed)/github-setup.ts` - import attempts/config/sync from the service boundary.
- `api/app/src/__tests__/github-bind-attempts.test.ts` - import the renamed attempts module.
- `api/app/src/__tests__/github-config.test.ts` - import the moved config module.
- `api/app/src/__tests__/github-setup-flow.test.ts` - mock the auth helper and new service setup modules.
- `api/app/src/__tests__/github-setup-router.test.ts` - keep install URL behavior and Redis attempt assertions after router imports move to the service boundary.
- `api/app/src/__tests__/native-auth-router.test.ts` - cover paginated selected-org membership assertion.
- `api/app/src/__tests__/organization-router.test.ts` - cover paginated user organization listing.
- `apps/app/src/app/(app)/(github)/api/github/setup/route.ts` - import from `@api/app/services/github`.
- `apps/app/src/app/(app)/(github)/api/github/oauth/callback/route.ts` - import from `@api/app/services/github`.
- `apps/app/src/__tests__/app/api/github/github-routes.test.ts` - mock `@api/app/services/github`.
- `emulators/github/README.md` - keep current dev-only boundary language and add a note that production code imports contracts, not the emulator.

Delete:

- `api/app/src/github/admin-access.ts`
- `api/app/src/github/bind-attempts.ts`
- `api/app/src/github/index.ts`
- `api/app/src/github/setup-flow.ts`
- `api/app/src/github/`

Do not modify:

- `db/app/src/schema/tables/org-source-control-bindings.ts`
- Any manual SQL migration file.
- Production GitHub webhook route names.
- Existing unrelated `.agents/skills` worktree changes.

---

### Task 1: Add Generic Clerk Organization Membership Helper

**Files:**
- Create: `api/app/src/auth/clerk-org-membership.ts`
- Create: `api/app/src/__tests__/auth-clerk-org-membership.test.ts`

- [ ] **Step 1: Write the failing auth helper test**

Create `api/app/src/__tests__/auth-clerk-org-membership.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getOrganizationMembershipListMock = vi.fn();

vi.mock("@vendor/clerk/server", () => ({
  auth: authMock,
  clerkClient: () =>
    Promise.resolve({
      users: {
        getOrganizationMembershipList: getOrganizationMembershipListMock,
      },
    }),
}));

const {
  ClerkOrgMembershipAccessError,
  assertCurrentUserIsOrgAdmin,
  findUserOrganizationMembership,
  listUserOrganizationMemberships,
} = await import("../auth/clerk-org-membership");

function membership(input: {
  id: string;
  role?: string;
  slug?: string;
}) {
  return {
    organization: {
      id: input.id,
      imageUrl: `https://img.example.com/${input.id}.png`,
      name: input.slug ?? input.id,
      slug: input.slug ?? input.id,
    },
    role: input.role ?? "org:member",
  };
}

describe("clerk org membership auth helper", () => {
  beforeEach(() => {
    authMock.mockReset();
    getOrganizationMembershipListMock.mockReset();
    authMock.mockResolvedValue({ userId: "user_1" });
  });

  it("lists every organization membership across Clerk pages", async () => {
    getOrganizationMembershipListMock
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) =>
          membership({ id: `org_${index}` })
        ),
        totalCount: 101,
      })
      .mockResolvedValueOnce({
        data: [membership({ id: "org_100", role: "org:admin" })],
        totalCount: 101,
      });

    await expect(
      listUserOrganizationMemberships({ userId: "user_1" })
    ).resolves.toHaveLength(101);
    expect(getOrganizationMembershipListMock).toHaveBeenNthCalledWith(1, {
      limit: 100,
      offset: 0,
      userId: "user_1",
    });
    expect(getOrganizationMembershipListMock).toHaveBeenNthCalledWith(2, {
      limit: 100,
      offset: 100,
      userId: "user_1",
    });
  });

  it("finds a membership by organization id beyond the first page", async () => {
    getOrganizationMembershipListMock
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) =>
          membership({ id: `org_other_${index}` })
        ),
        totalCount: 101,
      })
      .mockResolvedValueOnce({
        data: [membership({ id: "org_target", role: "org:admin" })],
        totalCount: 101,
      });

    await expect(
      findUserOrganizationMembership({
        organizationId: "org_target",
        userId: "user_1",
      })
    ).resolves.toMatchObject({
      organization: { id: "org_target" },
      role: "org:admin",
    });
  });

  it("finds a membership by organization slug beyond the first page", async () => {
    getOrganizationMembershipListMock
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) =>
          membership({ id: `org_other_${index}`, slug: `other-${index}` })
        ),
        totalCount: 101,
      })
      .mockResolvedValueOnce({
        data: [membership({ id: "org_target", role: "org:admin", slug: "acme" })],
        totalCount: 101,
      });

    await expect(
      findUserOrganizationMembership({
        organizationSlug: "acme",
        userId: "user_1",
      })
    ).resolves.toMatchObject({
      organization: { id: "org_target", slug: "acme" },
      role: "org:admin",
    });
  });

  it("asserts the current user is the expected organization admin beyond the first page", async () => {
    getOrganizationMembershipListMock
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) =>
          membership({ id: `org_other_${index}` })
        ),
        totalCount: 101,
      })
      .mockResolvedValueOnce({
        data: [membership({ id: "org_target", role: "org:admin" })],
        totalCount: 101,
      });

    await expect(
      assertCurrentUserIsOrgAdmin({
        clerkOrgId: "org_target",
        expectedUserId: "user_1",
      })
    ).resolves.toEqual({ userId: "user_1" });
  });

  it("throws UNAUTHENTICATED when no current user is present", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    await expect(
      assertCurrentUserIsOrgAdmin({ clerkOrgId: "org_target" })
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("throws EXPECTED_USER_MISMATCH when the callback user changed", async () => {
    await expect(
      assertCurrentUserIsOrgAdmin({
        clerkOrgId: "org_target",
        expectedUserId: "user_2",
      })
    ).rejects.toMatchObject({
      code: "EXPECTED_USER_MISMATCH",
    });
    expect(getOrganizationMembershipListMock).not.toHaveBeenCalled();
  });

  it("throws MISSING_MEMBERSHIP for non-members", async () => {
    getOrganizationMembershipListMock.mockResolvedValueOnce({
      data: [membership({ id: "org_other" })],
      totalCount: 1,
    });

    await expect(
      assertCurrentUserIsOrgAdmin({ clerkOrgId: "org_target" })
    ).rejects.toBeInstanceOf(ClerkOrgMembershipAccessError);
    await expect(
      assertCurrentUserIsOrgAdmin({ clerkOrgId: "org_target" })
    ).rejects.toMatchObject({
      code: "MISSING_MEMBERSHIP",
    });
  });

  it("throws NON_ADMIN for non-admin members", async () => {
    getOrganizationMembershipListMock.mockResolvedValueOnce({
      data: [membership({ id: "org_target", role: "org:member" })],
      totalCount: 1,
    });

    await expect(
      assertCurrentUserIsOrgAdmin({ clerkOrgId: "org_target" })
    ).rejects.toMatchObject({
      code: "NON_ADMIN",
    });
  });
});
```

- [ ] **Step 2: Run the auth helper test and verify it fails**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/auth-clerk-org-membership.test.ts
```

Expected: FAIL because `api/app/src/auth/clerk-org-membership.ts` does not exist.

- [ ] **Step 3: Add the generic auth helper**

Create `api/app/src/auth/clerk-org-membership.ts`:

```ts
import { auth, clerkClient } from "@vendor/clerk/server";

const MEMBERSHIP_PAGE_LIMIT = 100;

export class ClerkOrgMembershipAccessError extends Error {
  constructor(
    readonly code:
      | "EXPECTED_USER_MISMATCH"
      | "MISSING_MEMBERSHIP"
      | "NON_ADMIN"
      | "UNAUTHENTICATED",
    message = "Organization membership access required."
  ) {
    super(message);
    this.name = "ClerkOrgMembershipAccessError";
  }
}

type ClerkClient = Awaited<ReturnType<typeof clerkClient>>;
type ClerkUserMembershipPage = Awaited<
  ReturnType<ClerkClient["users"]["getOrganizationMembershipList"]>
>;
export type ClerkUserOrganizationMembership =
  ClerkUserMembershipPage["data"][number];

export async function listUserOrganizationMemberships(input: {
  userId: string;
}): Promise<ClerkUserOrganizationMembership[]> {
  const clerk = await clerkClient();
  const memberships: ClerkUserOrganizationMembership[] = [];
  let offset = 0;

  while (true) {
    const page = await clerk.users.getOrganizationMembershipList({
      limit: MEMBERSHIP_PAGE_LIMIT,
      offset,
      userId: input.userId,
    });

    memberships.push(...page.data);
    offset += MEMBERSHIP_PAGE_LIMIT;

    if (
      !page.data.length ||
      page.data.length < MEMBERSHIP_PAGE_LIMIT ||
      (typeof page.totalCount === "number" && offset >= page.totalCount)
    ) {
      return memberships;
    }
  }
}

export async function findUserOrganizationMembership(input: {
  organizationId?: string;
  organizationSlug?: string;
  userId: string;
}): Promise<ClerkUserOrganizationMembership | null> {
  if (!(input.organizationId || input.organizationSlug)) {
    throw new Error("organizationId or organizationSlug is required.");
  }

  const memberships = await listUserOrganizationMemberships({
    userId: input.userId,
  });

  return (
    memberships.find((membership) => {
      if (
        input.organizationId &&
        membership.organization.id === input.organizationId
      ) {
        return true;
      }
      return (
        !!input.organizationSlug &&
        membership.organization.slug === input.organizationSlug
      );
    }) ?? null
  );
}

export async function assertCurrentUserIsOrgAdmin(input: {
  clerkOrgId: string;
  expectedUserId?: string;
}): Promise<{ userId: string }> {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    throw new ClerkOrgMembershipAccessError("UNAUTHENTICATED");
  }

  if (input.expectedUserId && input.expectedUserId !== userId) {
    throw new ClerkOrgMembershipAccessError("EXPECTED_USER_MISMATCH");
  }

  const membership = await findUserOrganizationMembership({
    organizationId: input.clerkOrgId,
    userId,
  });

  if (!membership) {
    throw new ClerkOrgMembershipAccessError("MISSING_MEMBERSHIP");
  }

  if (membership.role !== "org:admin") {
    throw new ClerkOrgMembershipAccessError("NON_ADMIN");
  }

  return { userId };
}
```

- [ ] **Step 4: Fix the duplicated reject assertion in the missing-membership test**

In `api/app/src/__tests__/auth-clerk-org-membership.test.ts`, replace the missing-membership test body with one captured promise so the mock is consumed only once:

```ts
  it("throws MISSING_MEMBERSHIP for non-members", async () => {
    getOrganizationMembershipListMock.mockResolvedValueOnce({
      data: [membership({ id: "org_other" })],
      totalCount: 1,
    });

    const result = assertCurrentUserIsOrgAdmin({ clerkOrgId: "org_target" });

    await expect(result).rejects.toBeInstanceOf(ClerkOrgMembershipAccessError);
    await expect(result).rejects.toMatchObject({
      code: "MISSING_MEMBERSHIP",
    });
  });
```

- [ ] **Step 5: Run the auth helper test and verify it passes**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/auth-clerk-org-membership.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/app/src/auth/clerk-org-membership.ts api/app/src/__tests__/auth-clerk-org-membership.test.ts
git commit -m "feat: add paginated clerk org membership helper"
```

---

### Task 2: Move GitHub Config And Attempts Into The Service Boundary

**Files:**
- Move: `api/app/src/github/config.ts` -> `api/app/src/services/github/config.ts`
- Move: `api/app/src/github/bind-attempts.ts` -> `api/app/src/services/github/setup/attempts.ts`
- Modify: `api/app/src/github/index.ts`
- Modify: `api/app/src/github/setup-flow.ts`
- Modify: `api/app/src/__tests__/github-config.test.ts`
- Modify: `api/app/src/__tests__/github-bind-attempts.test.ts`
- Modify: `api/app/src/__tests__/github-setup-flow.test.ts`

- [ ] **Step 1: Move the files with history**

Run:

```bash
mkdir -p api/app/src/services/github/setup
git mv api/app/src/github/config.ts api/app/src/services/github/config.ts
git mv api/app/src/github/bind-attempts.ts api/app/src/services/github/setup/attempts.ts
```

Expected: the files move and `api/app/src/github` still contains `admin-access.ts`, `index.ts`, and `setup-flow.ts`.

- [ ] **Step 2: Keep the old GitHub facade compiling during the move**

In `api/app/src/github/setup-flow.ts`, replace the attempts import:

```ts
} from "./bind-attempts";
```

with:

```ts
} from "../services/github/setup/attempts";
```

Replace the config import:

```ts
import { getGitHubAppConfig, resolveGitHubAppOrigin } from "./config";
```

with:

```ts
import {
  getGitHubAppConfig,
  resolveGitHubAppOrigin,
} from "../services/github/config";
```

In `api/app/src/github/index.ts`, replace the config export source:

```ts
} from "./config";
```

with:

```ts
} from "../services/github/config";
```

- [ ] **Step 3: Update config test imports**

In `api/app/src/__tests__/github-config.test.ts`, replace:

```ts
} from "../github/config";
```

with:

```ts
} from "../services/github/config";
```

Also replace dynamic imports:

```ts
await import("../github/config")
```

with:

```ts
await import("../services/github/config")
```

- [ ] **Step 4: Update attempts test imports**

In `api/app/src/__tests__/github-bind-attempts.test.ts`, replace:

```ts
} = await import("../github/bind-attempts");
```

with:

```ts
} = await import("../services/github/setup/attempts");
```

- [ ] **Step 5: Update setup-flow test mocks for the moved helpers**

In `api/app/src/__tests__/github-setup-flow.test.ts`, replace:

```ts
vi.mock("../github/bind-attempts", () => ({
```

with:

```ts
vi.mock("../services/github/setup/attempts", () => ({
```

Replace:

```ts
vi.mock("../github/config", () => ({
```

with:

```ts
vi.mock("../services/github/config", () => ({
```

- [ ] **Step 6: Run moved-module tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-config.test.ts src/__tests__/github-bind-attempts.test.ts
pnpm --filter @api/app test -- src/__tests__/github-setup-flow.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/app/src/services/github/config.ts api/app/src/services/github/setup/attempts.ts api/app/src/github/index.ts api/app/src/github/setup-flow.ts api/app/src/__tests__/github-config.test.ts api/app/src/__tests__/github-bind-attempts.test.ts api/app/src/__tests__/github-setup-flow.test.ts
git commit -m "refactor: move github config and attempts into service boundary"
```

---

### Task 3: Split Callback Parsing And Redirect Decisions Out Of Setup Flow

**Files:**
- Create: `api/app/src/services/github/setup/callbacks.ts`
- Create: `api/app/src/services/github/setup/redirects.ts`
- Modify: `api/app/src/__tests__/github-setup-flow.test.ts`

- [ ] **Step 1: Add focused callback parser tests to the setup flow test file**

At the top of `api/app/src/__tests__/github-setup-flow.test.ts`, after the mocks and before importing the flow module, add:

```ts
const { parseGitHubInstallationSetupCallback, parseGitHubOAuthCallback } =
  await import("../services/github/setup/callbacks");
```

Inside `describe("github setup flow", () => { ... })`, add:

```ts
  it("parses installation setup callback query data", () => {
    expect(
      parseGitHubInstallationSetupCallback(
        "https://app.lightfast.localhost/api/github/setup?installation_id=1001&setup_action=install&state=install_state"
      )
    ).toEqual({
      installationId: "1001",
      setupAction: "install",
      state: "install_state",
    });
  });

  it("returns null for incomplete installation setup callback query data", () => {
    expect(
      parseGitHubInstallationSetupCallback(
        "https://app.lightfast.localhost/api/github/setup?installation_id=1001"
      )
    ).toBeNull();
  });

  it("parses successful OAuth callback query data", () => {
    expect(
      parseGitHubOAuthCallback(
        "https://app.lightfast.localhost/api/github/oauth/callback?code=code_123&state=oauth_state"
      )
    ).toEqual({
      code: "code_123",
      denied: null,
      state: "oauth_state",
    });
  });

  it("parses denied OAuth callback query data", () => {
    expect(
      parseGitHubOAuthCallback(
        "https://app.lightfast.localhost/api/github/oauth/callback?error=access_denied&state=oauth_state"
      )
    ).toEqual({
      code: null,
      denied: "access_denied",
      state: "oauth_state",
    });
  });
```

- [ ] **Step 2: Run the setup flow test and verify it fails**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-setup-flow.test.ts
```

Expected: FAIL because `../services/github/setup/callbacks` does not exist.

- [ ] **Step 3: Add callback parsing helpers**

Create `api/app/src/services/github/setup/callbacks.ts`:

```ts
export interface GitHubInstallationSetupCallback {
  installationId: string;
  setupAction?: string;
  state: string;
}

export interface GitHubOAuthCallback {
  code: string | null;
  denied: string | null;
  state: string | null;
}

export function parseGitHubInstallationSetupCallback(
  requestUrl: string
): GitHubInstallationSetupCallback | null {
  const url = new URL(requestUrl);
  const state = url.searchParams.get("state");
  const installationId = url.searchParams.get("installation_id");
  if (!(state && installationId)) {
    return null;
  }
  return {
    installationId,
    setupAction: url.searchParams.get("setup_action") ?? undefined,
    state,
  };
}

export function parseGitHubOAuthCallback(
  requestUrl: string
): GitHubOAuthCallback {
  const url = new URL(requestUrl);
  return {
    code: url.searchParams.get("code"),
    denied: url.searchParams.get("error"),
    state: url.searchParams.get("state"),
  };
}
```

- [ ] **Step 4: Add redirect helpers**

Create `api/app/src/services/github/setup/redirects.ts`:

```ts
import type { GitHubBindErrorCode } from "@repo/github-app-contract";

export interface GitHubRedirectResult {
  redirectUrl: string;
}

export function bindPageUrl(input: {
  appOrigin: string;
  code?: GitHubBindErrorCode;
  orgSlug: string;
}): string {
  const url = new URL(`/${input.orgSlug}/tasks/bind`, input.appOrigin);
  if (input.code) {
    url.searchParams.set("github_error", input.code);
  }
  return url.toString();
}

export function completionPageUrl(input: {
  appOrigin: string;
  orgSlug: string;
}): string {
  return new URL(
    `/${input.orgSlug}/tasks/bind/github/complete`,
    input.appOrigin
  ).toString();
}

export function missingAttemptRedirect(input: {
  appOrigin: string;
}): GitHubRedirectResult {
  const url = new URL("/account/teams", input.appOrigin);
  url.searchParams.set("github_error", "expired_state");
  return { redirectUrl: url.toString() };
}

export function errorRedirect(input: {
  appOrigin: string;
  code: GitHubBindErrorCode;
  orgSlug: string;
}): GitHubRedirectResult {
  return { redirectUrl: bindPageUrl(input) };
}

export function signInRedirect(input: {
  appOrigin: string;
  requestUrl: string;
}): GitHubRedirectResult {
  const callbackUrl = new URL(input.requestUrl);
  const signInUrl = new URL("/sign-in", input.appOrigin);
  signInUrl.searchParams.set(
    "redirect_url",
    `${callbackUrl.pathname}${callbackUrl.search}`
  );
  return { redirectUrl: signInUrl.toString() };
}
```

- [ ] **Step 5: Run parser-focused tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-setup-flow.test.ts
```

Expected: PASS. The new parser helpers are covered while the current setup flow still imports the old path.

- [ ] **Step 6: Commit**

```bash
git add api/app/src/services/github/setup/callbacks.ts api/app/src/services/github/setup/redirects.ts api/app/src/__tests__/github-setup-flow.test.ts
git commit -m "refactor: extract github setup callbacks and redirects"
```

---

### Task 4: Add Service Error Mapping

**Files:**
- Create: `api/app/src/services/github/setup/errors.ts`

- [ ] **Step 1: Add service error mapping**

Create `api/app/src/services/github/setup/errors.ts`:

```ts
import {
  OrgSourceControlBindingConflictError,
} from "@db/app";
import type { GitHubBindErrorCode } from "@repo/github-app-contract";
import { GitHubAppNodeError } from "@repo/github-app-node";

import { ClerkOrgMembershipAccessError } from "../../../auth/clerk-org-membership";

export function isUnauthenticatedSetupError(error: unknown): boolean {
  return (
    error instanceof ClerkOrgMembershipAccessError &&
    error.code === "UNAUTHENTICATED"
  );
}

export function mapGitHubSetupError(error: unknown): GitHubBindErrorCode {
  if (error instanceof ClerkOrgMembershipAccessError) {
    return "permission_required";
  }

  if (error instanceof OrgSourceControlBindingConflictError) {
    return error.code === "INSTALLATION_ALREADY_BOUND"
      ? "installation_already_bound"
      : "org_already_bound";
  }

  if (error instanceof GitHubAppNodeError) {
    switch (error.code) {
      case "INSTALLATION_NOT_VERIFIED":
        return "installation_not_verified";
      case "PERSONAL_ACCOUNT_NOT_SUPPORTED":
        return "personal_account_not_supported";
      case "GITHUB_OAUTH_EXCHANGE_FAILED":
        return "github_transient_error";
      default:
        return "github_transient_error";
    }
  }

  return "github_transient_error";
}
```

- [ ] **Step 2: Run auth helper and typecheck for the new error module**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/auth-clerk-org-membership.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add api/app/src/services/github/setup/errors.ts
git commit -m "refactor: add github setup error mapper"
```

---

### Task 5: Split DB Finalization And Rebuild The Service Flow

**Files:**
- Create: `api/app/src/services/github/setup/finalize-binding.ts`
- Create: `api/app/src/services/github/setup/flow.ts`
- Create: `api/app/src/services/github/index.ts`
- Delete: `api/app/src/github/admin-access.ts`
- Delete: `api/app/src/github/setup-flow.ts`
- Delete: `api/app/src/github/index.ts`
- Modify: `api/app/src/__tests__/github-setup-flow.test.ts`

- [ ] **Step 1: Update setup flow test service-path mocks and imports**

In `api/app/src/__tests__/github-setup-flow.test.ts`, replace the test admin error class:

```ts
class TestGitHubSetupAdminAccessError extends Error {
  constructor(
    readonly code:
      | "PERMISSION_REQUIRED"
      | "UNAUTHENTICATED" = "PERMISSION_REQUIRED",
    message = "Organization administrator access required."
  ) {
    super(message);
    this.name = "GitHubSetupAdminAccessError";
  }
}
```

with:

```ts
class TestClerkOrgMembershipAccessError extends Error {
  constructor(
    readonly code:
      | "EXPECTED_USER_MISMATCH"
      | "MISSING_MEMBERSHIP"
      | "NON_ADMIN"
      | "UNAUTHENTICATED",
    message = "Organization membership access required."
  ) {
    super(message);
    this.name = "ClerkOrgMembershipAccessError";
  }
}
```

Replace the admin mock:

```ts
vi.mock("../github/admin-access", () => ({
  assertCurrentUserIsOrgAdmin: assertOrgAdminMock,
  GitHubSetupAdminAccessError: TestGitHubSetupAdminAccessError,
}));
```

with:

```ts
vi.mock("../auth/clerk-org-membership", () => ({
  assertCurrentUserIsOrgAdmin: assertOrgAdminMock,
  ClerkOrgMembershipAccessError: TestClerkOrgMembershipAccessError,
}));
```

Replace each `new TestGitHubSetupAdminAccessError()` with:

```ts
new TestClerkOrgMembershipAccessError("NON_ADMIN")
```

Replace each `new TestGitHubSetupAdminAccessError("UNAUTHENTICATED")` with:

```ts
new TestClerkOrgMembershipAccessError("UNAUTHENTICATED")
```

Add an `isOrgBound` mock because `finalize-binding.ts` exports binding-claim sync from the same module:

```ts
const isOrgBoundMock = vi.fn();
```

Update the `@db/app` mock:

```ts
vi.mock("@db/app", () => ({
  finalizeActiveOrgProviderBinding: finalizeActiveOrgProviderBindingMock,
  isOrgBound: isOrgBoundMock,
  OrgSourceControlBindingConflictError: class OrgSourceControlBindingConflictError extends Error {
    constructor(
      readonly code: string,
      message: string
    ) {
      super(message);
      this.name = "OrgSourceControlBindingConflictError";
    }
  },
}));
```

Reset it in `beforeEach`:

```ts
    isOrgBoundMock.mockReset();
    isOrgBoundMock.mockResolvedValue(false);
```

Replace:

```ts
const { completeGitHubInstallationSetup, completeGitHubOAuthVerification } =
  await import("../github/setup-flow");
```

with:

```ts
const { completeGitHubInstallationSetup, completeGitHubOAuthVerification } =
  await import("../services/github/setup/flow");
```

- [ ] **Step 2: Add DB finalization helper**

Create `api/app/src/services/github/setup/finalize-binding.ts`:

```ts
import {
  finalizeActiveOrgProviderBinding,
  isOrgBound,
} from "@db/app";
import { db } from "@db/app/client";
import { githubInstallationMetadataSchema } from "@repo/github-app-contract";
import { log } from "@vendor/observability/log/next";

import { mirrorOrgBinding } from "../../../auth/org-binding-mirror";

interface GitHubFinalizedInstallation {
  account: {
    id: string;
    login: string;
  };
  appId: string;
  appSlug: string | null;
  events: string[];
  id: string;
  permissions: Record<string, string>;
  repositorySelection: "all" | "selected";
}

export async function finalizeGitHubOrgBinding(input: {
  clerkOrgId: string;
  connectedByUserId: string;
  installation: GitHubFinalizedInstallation;
  setupAction?: string;
}): Promise<void> {
  const metadata = githubInstallationMetadataSchema.parse({
    events: input.installation.events,
    githubAppId: input.installation.appId,
    githubAppSlug: input.installation.appSlug,
    githubSetupAction: input.setupAction,
    permissions: input.installation.permissions,
    repositorySelection: input.installation.repositorySelection,
  });

  await finalizeActiveOrgProviderBinding(db, {
    clerkOrgId: input.clerkOrgId,
    connectedByUserId: input.connectedByUserId,
    metadata,
    provider: "github",
    providerAccountId: input.installation.account.id,
    providerAccountLogin: input.installation.account.login,
    providerInstallationId: input.installation.id,
  });

  try {
    await mirrorOrgBinding({
      clerkOrgId: input.clerkOrgId,
      provider: "github",
      status: "bound",
    });
  } catch (error) {
    log.warn("[github-setup] org binding mirror failed", {
      clerkOrgId: input.clerkOrgId,
      error,
    });
  }
}

export async function syncGitHubBindingClaim(input: {
  clerkOrgId: string;
}): Promise<{ bindingStatus: "bound" | "unbound" }> {
  const bound = await isOrgBound(db, input.clerkOrgId);
  if (bound) {
    await mirrorOrgBinding({
      clerkOrgId: input.clerkOrgId,
      provider: "github",
      status: "bound",
    });
  }
  return { bindingStatus: bound ? "bound" : "unbound" };
}
```

- [ ] **Step 3: Add the small orchestration flow**

Create `api/app/src/services/github/setup/flow.ts`:

```ts
import { GITHUB_OAUTH_CALLBACK_PATH } from "@repo/github-app-contract";
import {
  buildGitHubOAuthAuthorizeUrl,
  createGitHubPkcePair,
  exchangeGitHubOAuthCode,
  verifyGitHubUserInstallation,
} from "@repo/github-app-node";
import { log } from "@vendor/observability/log/next";

import { assertCurrentUserIsOrgAdmin } from "../../../auth/clerk-org-membership";
import { getGitHubAppConfig, resolveGitHubAppOrigin } from "../config";
import {
  consumeGitHubInstallAttempt,
  consumeGitHubOAuthAttempt,
  issueGitHubOAuthAttempt,
  lookupGitHubInstallAttempt,
  lookupGitHubOAuthAttempt,
} from "./attempts";
import {
  parseGitHubInstallationSetupCallback,
  parseGitHubOAuthCallback,
} from "./callbacks";
import {
  isUnauthenticatedSetupError,
  mapGitHubSetupError,
} from "./errors";
import { finalizeGitHubOrgBinding } from "./finalize-binding";
import {
  errorRedirect,
  missingAttemptRedirect,
  signInRedirect,
  type GitHubRedirectResult,
  completionPageUrl,
} from "./redirects";

export type { GitHubRedirectResult } from "./redirects";
export { syncGitHubBindingClaim } from "./finalize-binding";

export async function completeGitHubInstallationSetup(input: {
  appOrigin?: string;
  requestUrl: string;
}): Promise<GitHubRedirectResult> {
  const appOrigin = input.appOrigin ?? resolveGitHubAppOrigin();
  const parsed = parseGitHubInstallationSetupCallback(input.requestUrl);
  if (!parsed) {
    return missingAttemptRedirect({ appOrigin });
  }

  const pendingAttempt = await lookupGitHubInstallAttempt({
    state: parsed.state,
  });
  if (!pendingAttempt) {
    return missingAttemptRedirect({ appOrigin });
  }

  try {
    await assertCurrentUserIsOrgAdmin({
      clerkOrgId: pendingAttempt.clerkOrgId,
      expectedUserId: pendingAttempt.lightfastUserId,
    });
  } catch (error) {
    if (isUnauthenticatedSetupError(error)) {
      return signInRedirect({ appOrigin, requestUrl: input.requestUrl });
    }
    return errorRedirect({
      appOrigin,
      code: mapGitHubSetupError(error),
      orgSlug: pendingAttempt.orgSlug,
    });
  }

  const attempt = await consumeGitHubInstallAttempt({ state: parsed.state });
  if (!attempt) {
    return missingAttemptRedirect({ appOrigin });
  }

  try {
    const config = getGitHubAppConfig();
    const pkce = createGitHubPkcePair();
    const oauthAttempt = await issueGitHubOAuthAttempt({
      clerkOrgId: attempt.clerkOrgId,
      codeVerifier: pkce.codeVerifier,
      lightfastUserId: attempt.lightfastUserId,
      orgSlug: attempt.orgSlug,
      providerInstallationId: parsed.installationId,
    });

    const authorizeUrl = buildGitHubOAuthAuthorizeUrl({
      clientId: config.clientId,
      codeChallenge: pkce.codeChallenge,
      oauthAuthorizeUrl: config.endpoints.oauthAuthorizeUrl,
      redirectUri: new URL(GITHUB_OAUTH_CALLBACK_PATH, appOrigin).toString(),
      state: oauthAttempt.state,
    });

    log.info("[github-setup] installation setup verified", {
      clerkOrgId: attempt.clerkOrgId,
      orgSlug: attempt.orgSlug,
      setupAction: parsed.setupAction,
    });

    return { redirectUrl: authorizeUrl };
  } catch (error) {
    return errorRedirect({
      appOrigin,
      code: mapGitHubSetupError(error),
      orgSlug: attempt.orgSlug,
    });
  }
}

async function consumeDeniedOAuthCallback(input: {
  appOrigin: string;
  requestUrl: string;
  state: string | null;
}): Promise<GitHubRedirectResult> {
  if (!input.state) {
    return missingAttemptRedirect({ appOrigin: input.appOrigin });
  }

  const pendingAttempt = await lookupGitHubOAuthAttempt({ state: input.state });
  if (!pendingAttempt) {
    return missingAttemptRedirect({ appOrigin: input.appOrigin });
  }

  try {
    await assertCurrentUserIsOrgAdmin({
      clerkOrgId: pendingAttempt.clerkOrgId,
      expectedUserId: pendingAttempt.lightfastUserId,
    });
  } catch (error) {
    if (isUnauthenticatedSetupError(error)) {
      return signInRedirect({
        appOrigin: input.appOrigin,
        requestUrl: input.requestUrl,
      });
    }
    return errorRedirect({
      appOrigin: input.appOrigin,
      code: mapGitHubSetupError(error),
      orgSlug: pendingAttempt.orgSlug,
    });
  }

  const attempt = await consumeGitHubOAuthAttempt({ state: input.state });
  return attempt
    ? errorRedirect({
        appOrigin: input.appOrigin,
        code: "github_authorization_denied",
        orgSlug: attempt.orgSlug,
      })
    : missingAttemptRedirect({ appOrigin: input.appOrigin });
}

export async function completeGitHubOAuthVerification(input: {
  appOrigin?: string;
  requestUrl: string;
}): Promise<GitHubRedirectResult> {
  const appOrigin = input.appOrigin ?? resolveGitHubAppOrigin();
  const parsed = parseGitHubOAuthCallback(input.requestUrl);

  if (parsed.denied) {
    return consumeDeniedOAuthCallback({
      appOrigin,
      requestUrl: input.requestUrl,
      state: parsed.state,
    });
  }

  if (!(parsed.code && parsed.state)) {
    return missingAttemptRedirect({ appOrigin });
  }

  const pendingAttempt = await lookupGitHubOAuthAttempt({
    state: parsed.state,
  });
  if (!pendingAttempt) {
    return missingAttemptRedirect({ appOrigin });
  }

  try {
    await assertCurrentUserIsOrgAdmin({
      clerkOrgId: pendingAttempt.clerkOrgId,
      expectedUserId: pendingAttempt.lightfastUserId,
    });
  } catch (error) {
    if (isUnauthenticatedSetupError(error)) {
      return signInRedirect({ appOrigin, requestUrl: input.requestUrl });
    }
    return errorRedirect({
      appOrigin,
      code: mapGitHubSetupError(error),
      orgSlug: pendingAttempt.orgSlug,
    });
  }

  const attempt = await consumeGitHubOAuthAttempt({ state: parsed.state });
  if (!attempt) {
    return missingAttemptRedirect({ appOrigin });
  }

  try {
    const config = getGitHubAppConfig();
    const token = await exchangeGitHubOAuthCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code: parsed.code,
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

    await finalizeGitHubOrgBinding({
      clerkOrgId: attempt.clerkOrgId,
      connectedByUserId: attempt.lightfastUserId,
      installation,
      setupAction: parsed.denied ?? undefined,
    });

    return {
      redirectUrl: completionPageUrl({
        appOrigin,
        orgSlug: attempt.orgSlug,
      }),
    };
  } catch (error) {
    return errorRedirect({
      appOrigin,
      code: mapGitHubSetupError(error),
      orgSlug: attempt.orgSlug,
    });
  }
}
```

- [ ] **Step 4: Fix setup action preservation in OAuth attempts**

In `api/app/src/services/github/setup/attempts.ts`, extend OAuth attempt records:

```ts
export interface GitHubBindOAuthAttemptRecord
  extends GitHubBindInstallAttemptRecord {
  codeVerifier: string;
  providerInstallationId: string;
  setupAction?: string;
}
```

Update `issueGitHubOAuthAttempt` input and record:

```ts
export async function issueGitHubOAuthAttempt(input: {
  clerkOrgId: string;
  codeVerifier: string;
  lightfastUserId: string;
  orgSlug: string;
  providerInstallationId: string;
  setupAction?: string;
}) {
  const attemptId = nanoid(32);
  const state = encodeState({ attemptId, nonce: nanoid(32) });
  const record: GitHubBindOAuthAttemptRecord = {
    clerkOrgId: input.clerkOrgId,
    codeVerifier: input.codeVerifier,
    lightfastUserId: input.lightfastUserId,
    orgSlug: input.orgSlug,
    providerInstallationId: input.providerInstallationId,
    setupAction: input.setupAction,
    stateHash: hashState(state),
  };
  await redis.set(`${OAUTH_PREFIX}${attemptId}`, record, { ex: TTL_SECONDS });
  return { attemptId, state };
}
```

In `api/app/src/services/github/setup/flow.ts`, update the OAuth attempt creation:

```ts
    const oauthAttempt = await issueGitHubOAuthAttempt({
      clerkOrgId: attempt.clerkOrgId,
      codeVerifier: pkce.codeVerifier,
      lightfastUserId: attempt.lightfastUserId,
      orgSlug: attempt.orgSlug,
      providerInstallationId: parsed.installationId,
      setupAction: parsed.setupAction,
    });
```

Update finalization:

```ts
    await finalizeGitHubOrgBinding({
      clerkOrgId: attempt.clerkOrgId,
      connectedByUserId: attempt.lightfastUserId,
      installation,
      setupAction: attempt.setupAction,
    });
```

- [ ] **Step 5: Update attempt tests for setup action**

In `api/app/src/__tests__/github-bind-attempts.test.ts`, add `setupAction: "install"` to the OAuth issue inputs and expected records:

```ts
      setupAction: "install",
```

Expected OAuth record shape:

```ts
    expect(record).toEqual({
      clerkOrgId: "org_1",
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
      orgSlug: "acme",
      providerInstallationId: "1001",
      setupAction: "install",
      stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
```

- [ ] **Step 6: Update setup flow test expected OAuth attempt**

In `api/app/src/__tests__/github-setup-flow.test.ts`, update the first test expectation:

```ts
    expect(issueGitHubOAuthAttemptMock).toHaveBeenCalledWith({
      clerkOrgId: "org_1",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_1",
      orgSlug: "acme",
      providerInstallationId: "1001",
      setupAction: "install",
    });
```

Update `oauthAttempt()`:

```ts
function oauthAttempt() {
  return {
    ...installAttempt(),
    codeVerifier: "verifier_123",
    providerInstallationId: "1001",
    setupAction: "install",
  };
}
```

Expected metadata should include setup action:

```ts
    expect(
      finalizeActiveOrgProviderBindingMock.mock.calls[0]?.[1].metadata
    ).toEqual({
      events: ["push"],
      githubAppId: "12345",
      githubAppSlug: "lightfast-test",
      githubSetupAction: "install",
      permissions: { contents: "read" },
      repositorySelection: "all",
    });
```

- [ ] **Step 7: Add service public exports**

Create `api/app/src/services/github/index.ts`:

```ts
export {
  DEFAULT_GITHUB_APP_ENDPOINTS,
  type GitHubAppConfig,
  type GitHubAppEndpoints,
  getGitHubAppConfig,
  normalizeGitHubPrivateKey,
  resolveGitHubAppEndpoints,
  resolveGitHubAppOrigin,
} from "./config";
export {
  completeGitHubInstallationSetup,
  completeGitHubOAuthVerification,
  type GitHubRedirectResult,
  syncGitHubBindingClaim,
} from "./setup/flow";
```

- [ ] **Step 8: Delete the old setup flow and index**

Run:

```bash
git rm api/app/src/github/admin-access.ts api/app/src/github/setup-flow.ts api/app/src/github/index.ts
```

Expected: no source files remain in `api/app/src/github` after Task 8 removes the directory.

- [ ] **Step 9: Run setup service tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-bind-attempts.test.ts src/__tests__/github-setup-flow.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add api/app/src/services/github api/app/src/__tests__/github-bind-attempts.test.ts api/app/src/__tests__/github-setup-flow.test.ts
git add -u api/app/src/github/admin-access.ts api/app/src/github/setup-flow.ts api/app/src/github/index.ts
git commit -m "refactor: split github setup service flow"
```

---

### Task 6: Update Routers, Package Exports, And App Route Handlers

**Files:**
- Modify: `api/app/package.json`
- Modify: `api/app/src/router/(pending-not-allowed)/github-setup.ts`
- Modify: `api/app/src/__tests__/github-setup-router.test.ts`
- Modify: `apps/app/src/app/(app)/(github)/api/github/setup/route.ts`
- Modify: `apps/app/src/app/(app)/(github)/api/github/oauth/callback/route.ts`
- Modify: `apps/app/src/__tests__/app/api/github/github-routes.test.ts`

- [ ] **Step 1: Replace the package export**

In `api/app/package.json`, replace:

```json
    "./github": {
      "types": "./src/github/index.ts",
      "default": "./src/github/index.ts"
    },
```

with:

```json
    "./services/github": {
      "types": "./src/services/github/index.ts",
      "default": "./src/services/github/index.ts"
    },
```

- [ ] **Step 2: Update the GitHub setup router imports**

In `api/app/src/router/(pending-not-allowed)/github-setup.ts`, replace:

```ts
import { issueGitHubInstallAttempt } from "../../github/bind-attempts";
import { getGitHubAppConfig } from "../../github/config";
import { syncGitHubBindingClaim } from "../../github/setup-flow";
```

with:

```ts
import { getGitHubAppConfig } from "../../services/github/config";
import { issueGitHubInstallAttempt } from "../../services/github/setup/attempts";
import { syncGitHubBindingClaim } from "../../services/github/setup/flow";
```

- [ ] **Step 3: Update app route imports**

In `apps/app/src/app/(app)/(github)/api/github/setup/route.ts`, replace:

```ts
import { completeGitHubInstallationSetup } from "@api/app/github";
```

with:

```ts
import { completeGitHubInstallationSetup } from "@api/app/services/github";
```

In `apps/app/src/app/(app)/(github)/api/github/oauth/callback/route.ts`, replace:

```ts
import { completeGitHubOAuthVerification } from "@api/app/github";
```

with:

```ts
import { completeGitHubOAuthVerification } from "@api/app/services/github";
```

- [ ] **Step 4: Update route handler test mock**

In `apps/app/src/__tests__/app/api/github/github-routes.test.ts`, replace:

```ts
vi.mock("@api/app/github", () => ({
```

with:

```ts
vi.mock("@api/app/services/github", () => ({
```

- [ ] **Step 5: Run router and route tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-setup-router.test.ts
pnpm --filter @lightfast/app test -- src/__tests__/app/api/github/github-routes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Prove the old import path is gone from runtime code**

Run:

```bash
rg -n "@api/app/github|\\.\\./github|\\.\\./\\.\\./github|src/github" api/app/src apps/app/src --glob '!**/__tests__/**'
```

Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add api/app/package.json api/app/src/router/'(pending-not-allowed)'/github-setup.ts apps/app/src/app/'(app)'/'(github)'/api/github/setup/route.ts apps/app/src/app/'(app)'/'(github)'/api/github/oauth/callback/route.ts apps/app/src/__tests__/app/api/github/github-routes.test.ts api/app/src/__tests__/github-setup-router.test.ts
git commit -m "refactor: publish github setup service boundary"
```

---

### Task 7: Reuse The Auth Membership Helper In Existing Membership Consumers

**Files:**
- Modify: `api/app/src/auth/identity.ts`
- Modify: `api/app/src/auth/organization-access.ts`
- Modify: `api/app/src/router/(pending-allowed)/native-auth.ts`
- Modify: `api/app/src/router/(pending-allowed)/organization.ts`
- Modify: `api/app/src/__tests__/native-oauth-identity.test.ts`
- Modify: `api/app/src/__tests__/native-auth-router.test.ts`
- Modify: `api/app/src/__tests__/organization-router.test.ts`

- [ ] **Step 1: Update `organization-access.ts` to use slug lookup**

Replace the `clerkClient` import:

```ts
import { clerkClient } from "@vendor/clerk/server";
```

with:

```ts
import { findUserOrganizationMembership } from "./clerk-org-membership";
```

Replace the Clerk lookup in `getOrgAccessBySlug`:

```ts
  const clerk = await clerkClient();
  const memberships = await clerk.users.getOrganizationMembershipList({
    userId: input.userId,
  });
  const membership = memberships.data.find(
    (entry) => entry.organization.slug === input.slug
  );
```

with:

```ts
  const membership = await findUserOrganizationMembership({
    organizationSlug: input.slug,
    userId: input.userId,
  });
```

- [ ] **Step 2: Update native OAuth identity to use id lookup**

In `api/app/src/auth/identity.ts`, add:

```ts
import { findUserOrganizationMembership } from "./clerk-org-membership";
```

Replace `isNativeOrgMember` with:

```ts
async function isNativeOrgMember(input: {
  organizationId: string;
  userId: string;
}): Promise<boolean> {
  const membership = await findUserOrganizationMembership({
    organizationId: input.organizationId,
    userId: input.userId,
  });
  return !!membership;
}
```

- [ ] **Step 3: Update native-auth router membership access**

In `api/app/src/router/(pending-allowed)/native-auth.ts`, keep the existing `clerkClient` import for `getUser` and add:

```ts
import {
  findUserOrganizationMembership,
  listUserOrganizationMemberships,
} from "../../auth/clerk-org-membership";
```

Replace:

```ts
async function listMembershipsForUser(userId: string) {
  const clerk = await clerkClient();
  return clerk.users.getOrganizationMembershipList({ userId });
}
```

with:

```ts
async function listMembershipsForUser(userId: string) {
  return listUserOrganizationMemberships({ userId });
}
```

Update `listNativeOrganizationsForUser`:

```ts
  const memberships = await listMembershipsForUser(input.userId);
  return Promise.all(
    memberships.map(async (membership) => ({
      bindingStatus: (await isOrgBound(input.db, membership.organization.id))
        ? "bound"
        : "unbound",
      id: membership.organization.id,
      name: membership.organization.name,
      role: membership.role,
      slug: membership.organization.slug,
    }))
  );
```

Update `assertNativeOrgMembership`:

```ts
async function assertNativeOrgMembership(input: {
  organizationId: string;
  userId: string;
}): Promise<void> {
  const membership = await findUserOrganizationMembership({
    organizationId: input.organizationId,
    userId: input.userId,
  });
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User is not a member of the selected organization",
    });
  }
}
```

- [ ] **Step 4: Update organization router user organization listing**

In `api/app/src/router/(pending-allowed)/organization.ts`, keep the existing `clerkClient` import for create and settings mutations, and add:

```ts
import { listUserOrganizationMemberships } from "../../auth/clerk-org-membership";
```

In `listUserOrganizations`, replace:

```ts
    const clerk = await clerkClient();
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId,
    });
```

with:

```ts
    const memberships = await listUserOrganizationMemberships({ userId });
```

Replace:

```ts
    return memberships.data.map((membership) => {
```

with:

```ts
    return memberships.map((membership) => {
```

- [ ] **Step 5: Add native-auth router pagination coverage**

In `api/app/src/__tests__/native-auth-router.test.ts`, add a test to the existing `describe("nativeAuthRouter", ...)` block:

```ts
  it("creates attempts for memberships beyond Clerk's first page", async () => {
    issueNativeAuthAttemptMock.mockResolvedValue({
      attemptId: "attempt_123456789",
      state: "state_1234567890123",
    });
    clerkGetOrganizationMembershipListMock
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) => ({
          organization: {
            id: `org_other_${index}`,
            name: `Other ${index}`,
            slug: `other-${index}`,
          },
          role: "org:member",
        })),
        totalCount: 101,
      })
      .mockResolvedValueOnce({
        data: [
          {
            organization: {
              id: "org_2",
              name: "Second Org",
              slug: "second-org",
            },
            role: "org:admin",
          },
        ],
        totalCount: 101,
      });

    await expect(
      makeCaller({
        kind: "clerk-session",
        orgId: null,
        userId: "user_1",
      }).native.auth.createAttempt({
        client: "cli",
        codeChallenge: "a".repeat(43),
        codeChallengeMethod: "S256",
        organizationId: "org_2",
        redirectUri: "http://127.0.0.1:51010/callback",
        stateNonce: "nonce_1234567890",
      })
    ).resolves.toMatchObject({
      attemptId: "attempt_123456789",
      authorizationUrl: expect.stringContaining("code_challenge="),
    });
    expect(issueNativeAuthAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_2",
        userId: "user_1",
      })
    );
  });
```

- [ ] **Step 6: Add organization router pagination coverage**

In `api/app/src/__tests__/organization-router.test.ts`, add:

```ts
  it("lists organizations beyond Clerk's first page", async () => {
    getOrganizationMembershipListMock
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) => ({
          organization: {
            id: `org_other_${index}`,
            imageUrl: `https://img.example.com/other-${index}.png`,
            name: `Other ${index}`,
            slug: `other-${index}`,
          },
          role: "org:member",
        })),
        totalCount: 101,
      })
      .mockResolvedValueOnce({
        data: [
          {
            organization: {
              id: "org_2",
              imageUrl: "https://img.example.com/second.png",
              name: "Second Org",
              slug: "second-org",
            },
            role: "org:admin",
          },
        ],
        totalCount: 101,
      });

    const result = await caller().viewer.organization.listUserOrganizations();

    expect(result).toHaveLength(101);
    expect(result.at(-1)).toMatchObject({
      id: "org_2",
      role: "org:admin",
      slug: "second-org",
    });
  });
```

- [ ] **Step 7: Run auth consumer tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/auth-clerk-org-membership.test.ts src/__tests__/native-oauth-identity.test.ts src/__tests__/native-auth-router.test.ts src/__tests__/organization-router.test.ts src/__tests__/github-setup-router.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add api/app/src/auth/identity.ts api/app/src/auth/organization-access.ts api/app/src/router/'(pending-allowed)'/native-auth.ts api/app/src/router/'(pending-allowed)'/organization.ts api/app/src/__tests__/native-oauth-identity.test.ts api/app/src/__tests__/native-auth-router.test.ts api/app/src/__tests__/organization-router.test.ts
git commit -m "refactor: reuse paginated clerk membership helper"
```

---

### Task 8: Remove The Old API-Root GitHub Directory And Verify Emulator Boundary

**Files:**
- Delete: `api/app/src/github/`
- Modify: `emulators/github/README.md`

- [ ] **Step 1: Remove any empty old GitHub directory**

Run:

```bash
find api/app/src/github -maxdepth 2 -type f -print
rmdir api/app/src/github
```

Expected: `find` prints no files and `rmdir` succeeds.

- [ ] **Step 2: Confirm the emulator workspace is already root development infrastructure**

Run:

```bash
test -f emulators/github/package.json
test ! -d internal/github
node -e 'const pkg=require("./emulators/github/package.json"); if (pkg.name !== "@repo/github-emulator") process.exit(1)'
rg -n "emulators/\\*" pnpm-workspace.yaml
rg -n "//#_github_emulator|@repo/github-emulator" package.json turbo.json apps/app/package.json
```

Expected:

```text
pnpm-workspace.yaml:8:  - emulators/*
package.json:19:    "_github_emulator": ...
turbo.json:18:    "//#_github_emulator": {
apps/app/package.json:18:    "with-related-projects": ...
```

- [ ] **Step 3: Document the production import boundary**

In `emulators/github/README.md`, add this paragraph after the opening paragraph:

```md
Production packages may import `@repo/github-app-contract` and
`@repo/github-app-node`; they must not import `@repo/github-emulator` or files
under `emulators/github`. The emulator is local infrastructure for the same
GitHub-compatible endpoints used by the production-shaped setup flow.
```

- [ ] **Step 4: Verify no production code imports the emulator**

Run:

```bash
rg -n "@repo/github-emulator|emulators/github" api apps packages db vendor --glob '!**/__tests__/**'
```

Expected: no matches.

- [ ] **Step 5: Verify old service paths are gone from source**

Run:

```bash
rg -n "@api/app/github|api/app/src/github|\\.\\./github|\\.\\./\\.\\./github|github/admin-access|github/bind-attempts|github/setup-flow" api/app apps/app packages emulators --glob '!**/__tests__/**' --glob '!**/node_modules/**'
```

Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add emulators/github/README.md
git commit -m "chore: document github emulator boundary"
```

---

### Task 9: Final Focused Verification

**Files:**
- Check: `api/app/src/services/github/**`
- Check: `api/app/src/auth/clerk-org-membership.ts`
- Check: `api/app/package.json`
- Check: `apps/app/src/app/(app)/(github)/api/github/**`
- Check: `emulators/github/**`

- [ ] **Step 1: Run focused API tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-setup-flow.test.ts src/__tests__/github-setup-router.test.ts src/__tests__/github-bind-attempts.test.ts src/__tests__/github-config.test.ts src/__tests__/auth-clerk-org-membership.test.ts src/__tests__/native-oauth-identity.test.ts src/__tests__/native-auth-router.test.ts src/__tests__/organization-router.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused app route tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/app/api/github/github-routes.test.ts src/__tests__/proxy.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run emulator tests**

Run:

```bash
pnpm --filter @repo/github-emulator test
```

Expected: PASS.

- [ ] **Step 4: Run shared GitHub package tests**

Run:

```bash
pnpm --filter @repo/github-app-node test
pnpm --filter @repo/github-app-contract test
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Run boundary scans**

Run:

```bash
test ! -d api/app/src/github
test ! -d internal/github
rg -n "@api/app/github|api/app/src/github|github/admin-access|github/bind-attempts|github/setup-flow" api/app apps/app packages emulators --glob '!**/node_modules/**'
rg -n "@repo/github-emulator|emulators/github" api apps packages db vendor --glob '!**/__tests__/**' --glob '!**/node_modules/**'
```

Expected:

- `test ! -d api/app/src/github` exits 0.
- `test ! -d internal/github` exits 0.
- First `rg` prints only historical docs/plans if run without the path restriction above; with the listed paths it prints no matches.
- Second `rg` prints no matches.

- [ ] **Step 7: Review the final diff**

Run:

```bash
git diff --stat
git diff -- api/app/src/auth api/app/src/services/github api/app/src/router apps/app/src/app/'(app)'/'(github)' apps/app/src/__tests__/app/api/github emulators/github/README.md api/app/package.json
```

Expected:

- No schema or migration file changed.
- No webhook behavior changed.
- `api/app/src/services/github/setup/flow.ts` reads as orchestration and delegates callback parsing, redirect building, error mapping, attempts, and finalization.
- `api/app/src/auth/clerk-org-membership.ts` contains no GitHub-specific naming.

- [ ] **Step 8: Commit final verification adjustments**

Run this commit only when Step 7 required a verification adjustment:

```bash
git add api/app apps/app emulators/github/README.md
git commit -m "test: verify github installation boundary rework"
```

When Step 7 produced no file changes, `git diff --quiet` exits 0 and no verification-adjustment commit is created.

---

## Success Criteria

- No `api/app/src/github` directory remains.
- GitHub setup service entrypoints live under `api/app/src/services/github`.
- `@api/app/github` is removed; external consumers import `@api/app/services/github`.
- GitHub setup admin verification imports `api/app/src/auth/clerk-org-membership.ts`.
- Admin membership lookup is paginated and directly tested.
- Existing low-risk membership consumers use the same paginated helper.
- GitHub emulator package lives at `emulators/github` and is named `@repo/github-emulator`.
- Root dev scripts still start the GitHub emulator through Portless.
- `apps/app` route handlers remain thin delegates.
- Focused tests and `pnpm typecheck` pass.
