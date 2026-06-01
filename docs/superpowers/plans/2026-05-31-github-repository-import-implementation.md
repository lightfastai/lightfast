# GitHub Repository Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Lightfast org admins add one normal repository at a time from the connected GitHub org, with live GitHub metadata and durable Lightfast watch registration only.

**Architecture:** Keep durable state in the existing source-control binding and watched repository tables, while all display metadata comes from live GitHub App installation APIs. Add focused GitHub helper functions, emulator endpoints, DB read helpers, tRPC read/write procedures, and a Source Control settings UI that reuses the existing General settings surface. No repo scan, no bulk import, no removal workflow, no reconciliation job, and no new route.

**Tech Stack:** TypeScript, pnpm, Vitest, Drizzle ORM, tRPC v11, TanStack Query, Next.js App Router, shadcn/ui components, local GitHub emulator.

---

## Source Spec

Implement: `docs/superpowers/specs/2026-05-31-github-repository-import-design.md`

Deferred follow-up: [lightfastai/lightfast#747](https://github.com/lightfastai/lightfast/issues/747)

## File Map

- Modify: `packages/source-control-contract/src/index.ts`
  - Export `SOURCE_CONTROL_ALL_PATHS_GLOB = "**"`.
  - Allow `"**"` in `watchedPathGlobsSchema`.
  - Treat `"**"` as matching any non-empty changed path.
- Modify: `packages/source-control-contract/src/__tests__/source-control-contract.test.ts`
  - Cover schema and matcher behavior for `["**"]`.
- Modify: `packages/github-app-node/src/installations.ts`
  - Add `getGitHubAppInstallation()` for `GET /app/installations/{installation_id}`.
  - Return `htmlUrl` from live GitHub `html_url`.
- Modify: `packages/github-app-node/src/repositories.ts`
  - Add `listGitHubInstallationRepositories()` for `GET /installation/repositories`.
  - Normalize `id`, `fullName`, `name`, `ownerId`, `ownerLogin`, `private`.
  - Fetch one page per call; API layer will loop pages.
- Modify: `packages/github-app-node/src/index.ts`
  - Export new helper functions and types.
- Modify: `packages/github-app-node/src/__tests__/installations.test.ts`
  - Test app installation fetch, `html_url`, headers, invalid response, non-2xx.
- Modify: `packages/github-app-node/src/__tests__/repository-api.test.ts`
  - Test installation repository listing pagination inputs, normalization, headers, invalid response, non-2xx.
- Modify: `emulators/github/src/github-compatible-routes.ts`
  - Add `GET /app/installations/{installation_id}`.
  - Add `GET /installation/repositories`.
  - Keep installation-token auth production-shaped.
- Modify: `emulators/github/src/fixtures.ts`
  - Seed at least two normal org repos while keeping `.lightfast` absent at reset.
- Modify: `emulators/github/src/__tests__/server.test.ts`
  - Test both new emulator routes and selected normal repositories.
- Modify: `db/app/src/utils/source-control-repositories.ts`
  - Add `listWatchedSourceControlRepositories()`.
  - Add `insertWatchedSourceControlRepository()` for add-only semantics that does not overwrite existing watch policy.
- Modify: `db/app/src/index.ts`
  - Export new DB helper types/functions.
- Modify: `db/app/src/__tests__/source-control-repositories.test.ts`
  - Test list helper and insert-only duplicate behavior.
- Create: `api/app/src/services/github/source-control/repositories.ts`
  - Keep live GitHub fetch/merge rules out of the tRPC router.
  - Implement `.lightfast` exclusion, id-first merge, durable count helper, account mismatch handling, and all-page GitHub listing.
- Create: `api/app/src/services/github/source-control/repositories.test.ts`
  - Unit test pure merge/exclusion/count helpers without tRPC.
- Modify: `api/app/src/router/(pending-not-allowed)/org-source-control.ts`
  - Extend `get`.
  - Add `listRepositories`.
  - Add admin-only `importRepository`.
- Modify: `api/app/src/__tests__/org-source-control-router.test.ts`
  - Cover member read, admin import, non-admin forbidden, stale-free rows, `.lightfast` exclusion, idempotent duplicate add, account mismatch, listing failure.
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/page.tsx`
  - Prefetch `sourceControl.listRepositories`.
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx`
  - Load source-control list data and pass it to the Source Control component.
- Replace: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/source-control-connection-section.tsx`
  - Move from read-only binding card to full Source Control integration surface.
  - Keep no personal GitHub account section.
  - Add connected org card, repositories card, refresh, admin-only add modal, disabled existing repos, live privacy indicators, manual refresh behavior, and scoped error states.
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-connection-section.test.tsx`
  - Cover UI states.
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-team-general-client.test.tsx`
  - Update mocks for `listRepositories` and new component props.

## Task 1: Source-Control Contract Supports All-Paths Watch

**Files:**
- Modify: `packages/source-control-contract/src/index.ts`
- Modify: `packages/source-control-contract/src/__tests__/source-control-contract.test.ts`

- [ ] **Step 1: Write failing tests for all-paths watch**

Add these expectations to `packages/source-control-contract/src/__tests__/source-control-contract.test.ts`:

```ts
import {
  matchesAnyWatchedPath,
  matchesWatchedPath,
  SOURCE_CONTROL_ALL_PATHS_GLOB,
  watchedPathGlobsSchema,
} from "../index";

it("exports and validates the all-paths watch glob", () => {
  expect(SOURCE_CONTROL_ALL_PATHS_GLOB).toBe("**");
  expect(watchedPathGlobsSchema.parse([SOURCE_CONTROL_ALL_PATHS_GLOB])).toEqual(
    ["**"]
  );
});

it("matches all non-empty changed paths with the all-paths watch glob", () => {
  expect(matchesWatchedPath("README.md", ["**"])).toBe(true);
  expect(matchesWatchedPath("src/app.ts", ["**"])).toBe(true);
  expect(matchesWatchedPath("", ["**"])).toBe(false);
  expect(matchesAnyWatchedPath(["docs/readme.md"], ["**"])).toBe(true);
  expect(matchesAnyWatchedPath([], ["**"])).toBe(false);
});
```

- [ ] **Step 2: Run contract tests and verify failure**

Run:

```bash
pnpm --filter @repo/source-control-contract test -- src/__tests__/source-control-contract.test.ts
```

Expected: FAIL because `SOURCE_CONTROL_ALL_PATHS_GLOB` is not exported and `"**"` is rejected.

- [ ] **Step 3: Implement all-paths constant and matcher**

In `packages/source-control-contract/src/index.ts`, add the constant near the delivery statuses:

```ts
export const SOURCE_CONTROL_ALL_PATHS_GLOB = "**" as const;
```

Update `isSupportedWatchedPathPattern()`:

```ts
function isSupportedWatchedPathPattern(pattern: string): boolean {
  if (pattern === SOURCE_CONTROL_ALL_PATHS_GLOB) {
    return true;
  }

  if (!pattern.includes("*")) {
    return pattern.length > 0;
  }

  if (!pattern.endsWith("/**")) {
    return false;
  }

  const prefix = pattern.slice(0, -3);
  return prefix.length > 0 && !prefix.includes("*");
}
```

Update `matchesSinglePattern()`:

```ts
function matchesSinglePattern(path: string, pattern: string): boolean {
  if (pattern === SOURCE_CONTROL_ALL_PATHS_GLOB) {
    return path.length > 0;
  }

  if (pattern.endsWith("/**")) {
    const prefix = pattern.slice(0, -3);
    return path === prefix || path.startsWith(`${prefix}/`);
  }

  return path === pattern;
}
```

- [ ] **Step 4: Run contract tests and typecheck**

Run:

```bash
pnpm --filter @repo/source-control-contract test -- src/__tests__/source-control-contract.test.ts
pnpm --filter @repo/source-control-contract typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/source-control-contract/src/index.ts packages/source-control-contract/src/__tests__/source-control-contract.test.ts
git commit -m "feat: support all-path source control watches"
```

## Task 2: GitHub App Node Helpers For Installation And Repositories

**Files:**
- Modify: `packages/github-app-node/src/installations.ts`
- Modify: `packages/github-app-node/src/repositories.ts`
- Modify: `packages/github-app-node/src/index.ts`
- Modify: `packages/github-app-node/src/__tests__/installations.test.ts`
- Modify: `packages/github-app-node/src/__tests__/repository-api.test.ts`

- [ ] **Step 1: Write failing tests for current installation metadata**

Append tests to `packages/github-app-node/src/__tests__/installations.test.ts`:

```ts
import { getGitHubAppInstallation } from "../installations";

it("fetches current app installation metadata with app authentication", async () => {
  const fetchMock = vi.fn(async () =>
    Response.json({
      id: 1001,
      account: { id: 20, login: "lightfast-emulated", type: "Organization" },
      app_id: 424_242,
      app_slug: "lightfast-local",
      events: ["push"],
      html_url: "https://github.com/settings/installations/1001",
      permissions: { contents: "read" },
      repository_selection: "all",
      target_type: "Organization",
    })
  );

  await expect(
    getGitHubAppInstallation({
      apiBaseUrl: "https://github.lightfast.localhost",
      appJwt: "app.jwt",
      fetch: fetchMock,
      installationId: "1001",
    })
  ).resolves.toEqual({
    account: {
      id: "20",
      login: "lightfast-emulated",
      type: "Organization",
    },
    htmlUrl: "https://github.com/settings/installations/1001",
    id: "1001",
    targetType: "Organization",
  });

  expect(fetchMock).toHaveBeenCalledWith(
    "https://github.lightfast.localhost/app/installations/1001",
    expect.objectContaining({
      headers: expect.objectContaining({
        accept: "application/vnd.github+json",
        authorization: "Bearer app.jwt",
      }),
    })
  );
});

it("rejects invalid current installation responses", async () => {
  const fetchMock = vi.fn(async () =>
    Response.json({ id: 1001, account: null })
  );

  await expect(
    getGitHubAppInstallation({
      apiBaseUrl: "https://github.lightfast.localhost",
      appJwt: "app.jwt",
      fetch: fetchMock,
      installationId: "1001",
    })
  ).rejects.toMatchObject({ code: "INSTALLATION_NOT_VERIFIED" });
});
```

- [ ] **Step 2: Write failing tests for installation repositories**

Append tests to `packages/github-app-node/src/__tests__/repository-api.test.ts`:

```ts
import { listGitHubInstallationRepositories } from "../repositories";

it("lists installation repositories with installation authentication", async () => {
  const fetchMock = vi.fn(async () =>
    Response.json({
      total_count: 1,
      repositories: [
        {
          full_name: "lightfast-emulated/workspace",
          id: 2002,
          name: "workspace",
          owner: { id: 20, login: "lightfast-emulated" },
          private: true,
        },
      ],
    })
  );

  await expect(
    listGitHubInstallationRepositories({
      apiBaseUrl: "https://github.lightfast.localhost",
      fetch: fetchMock,
      installationToken: "ghs_installation",
      page: 2,
      perPage: 50,
    })
  ).resolves.toEqual({
    repositories: [
      {
        fullName: "lightfast-emulated/workspace",
        id: "2002",
        name: "workspace",
        ownerId: "20",
        ownerLogin: "lightfast-emulated",
        private: true,
      },
    ],
    totalCount: 1,
  });

  expect(fetchMock).toHaveBeenCalledWith(
    "https://github.lightfast.localhost/installation/repositories?per_page=50&page=2",
    expect.objectContaining({
      headers: expect.objectContaining({
        authorization: "Bearer ghs_installation",
      }),
    })
  );
});

it("rejects invalid installation repository responses", async () => {
  const fetchMock = vi.fn(async () =>
    Response.json({ repositories: [{ id: 1, owner: null }] })
  );

  await expect(
    listGitHubInstallationRepositories({
      apiBaseUrl: "https://github.lightfast.localhost",
      fetch: fetchMock,
      installationToken: "ghs_installation",
    })
  ).rejects.toMatchObject({ code: "GITHUB_API_RESPONSE_INVALID" });
});
```

- [ ] **Step 3: Run helper tests and verify failure**

Run:

```bash
pnpm --filter @repo/github-app-node test -- src/__tests__/installations.test.ts src/__tests__/repository-api.test.ts
```

Expected: FAIL because the new helpers are not exported.

- [ ] **Step 4: Implement `getGitHubAppInstallation()`**

In `packages/github-app-node/src/installations.ts`, extend the raw schema and add the helper:

```ts
const appInstallationResponseSchema = rawInstallationSchema.extend({
  html_url: z.string().url(),
});

export interface GitHubAppInstallation {
  account: {
    id: string;
    login: string;
    type: "Organization" | "User";
  };
  htmlUrl: string;
  id: string;
  targetType: "Organization" | "User";
}

export async function getGitHubAppInstallation(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  appJwt: string;
  fetch?: typeof fetch;
  installationId: string;
}): Promise<GitHubAppInstallation> {
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const url = `${apiBaseUrl}/app/installations/${input.installationId}`;

  const { json, response } = await fetchGitHubJson({
    fetch: input.fetch,
    init: {
      headers: githubJsonHeaders({
        apiVersion: input.apiVersion,
        token: input.appJwt,
      }),
    },
    requestErrorCode: "INSTALLATION_NOT_VERIFIED",
    requestErrorMessage: "GitHub installation request failed.",
    url,
  });

  const parsed = appInstallationResponseSchema.safeParse(json);
  if (!(response.ok && parsed.success)) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub installation response was invalid."
    );
  }

  return {
    account: {
      id: String(parsed.data.account.id),
      login: parsed.data.account.login,
      type: parsed.data.account.type,
    },
    htmlUrl: parsed.data.html_url,
    id: String(parsed.data.id),
    targetType: parsed.data.target_type,
  };
}
```

- [ ] **Step 5: Implement `listGitHubInstallationRepositories()`**

In `packages/github-app-node/src/repositories.ts`, add:

```ts
const installationRepositoriesResponseSchema = z.object({
  repositories: z.array(
    z.object({
      full_name: z.string().min(1),
      id: z.union([z.number(), z.string().min(1)]),
      name: z.string().min(1),
      owner: z.object({
        id: z.union([z.number(), z.string().min(1)]),
        login: z.string().min(1),
      }),
      private: z.boolean(),
    })
  ),
  total_count: z.number().int().min(0).optional(),
});

function normalizeGitHubPerPage(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return 100;
  }
  return Math.min(100, Math.max(1, Math.trunc(value)));
}

export interface GitHubInstallationRepository {
  fullName: string;
  id: string;
  name: string;
  ownerId: string;
  ownerLogin: string;
  private: boolean;
}

export async function listGitHubInstallationRepositories(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  installationToken: string;
  page?: number;
  perPage?: number;
}): Promise<{
  repositories: GitHubInstallationRepository[];
  totalCount?: number;
}> {
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const perPage = normalizeGitHubPerPage(input.perPage);
  const url = new URL("/installation/repositories", apiBaseUrl);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));

  const json = await getJson({
    apiVersion: input.apiVersion,
    fetch: input.fetch,
    installationToken: input.installationToken,
    url,
  });
  const parsed = installationRepositoriesResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub installation repositories response was invalid."
    );
  }

  return {
    repositories: parsed.data.repositories.map((repository) => ({
      fullName: repository.full_name,
      id: String(repository.id),
      name: repository.name,
      ownerId: String(repository.owner.id),
      ownerLogin: repository.owner.login,
      private: repository.private,
    })),
    totalCount: parsed.data.total_count,
  };
}
```

- [ ] **Step 6: Export helpers**

In `packages/github-app-node/src/index.ts`, add:

```ts
export {
  getGitHubAppInstallation,
  listGitHubUserAccessibleInstallations,
  verifyGitHubUserInstallation,
  type GitHubAppInstallation,
} from "./installations";

export {
  getGitHubCommit,
  getGitHubRepository,
  getGitHubTree,
  listGitHubInstallationRepositories,
  type GitHubInstallationRepository,
} from "./repositories";
```

Preserve existing exports and avoid duplicate export names.

- [ ] **Step 7: Run helper tests and typecheck**

Run:

```bash
pnpm --filter @repo/github-app-node test -- src/__tests__/installations.test.ts src/__tests__/repository-api.test.ts
pnpm --filter @repo/github-app-node typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/github-app-node/src/installations.ts packages/github-app-node/src/repositories.ts packages/github-app-node/src/index.ts packages/github-app-node/src/__tests__/installations.test.ts packages/github-app-node/src/__tests__/repository-api.test.ts
git commit -m "feat: add github installation repository helpers"
```

## Task 3: GitHub Emulator Supports Live Installation Repository APIs

**Files:**
- Modify: `emulators/github/src/github-compatible-routes.ts`
- Modify: `emulators/github/src/fixtures.ts`
- Modify: `emulators/github/src/__tests__/server.test.ts`

- [ ] **Step 1: Write failing emulator tests**

Add tests to `emulators/github/src/__tests__/server.test.ts` near the installation token tests:

```ts
it("returns current app installation metadata with html_url", async () => {
  const jwt = await createAppJwt();
  const res = await fetch(
    `${emulator?.url}/app/installations/${GITHUB_EMULATOR_FIXTURES.installationId}`,
    {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${jwt}`,
      },
    }
  );

  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toMatchObject({
    id: GITHUB_EMULATOR_FIXTURES.installationId,
    account: expect.objectContaining({
      login: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
      type: "Organization",
    }),
    html_url: `${emulator?.url}/settings/installations/${GITHUB_EMULATOR_FIXTURES.installationId}`,
    target_type: "Organization",
  });
});

it("lists repositories accessible to an installation token", async () => {
  const jwt = await createAppJwt();
  const tokenRes = await fetch(
    `${emulator?.url}/app/installations/${GITHUB_EMULATOR_FIXTURES.installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${jwt}`,
      },
    }
  );
  const tokenBody = (await tokenRes.json()) as { token?: string };

  const res = await fetch(`${emulator?.url}/installation/repositories`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${tokenBody.token}`,
    },
  });

  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toMatchObject({
    total_count: 2,
    repositories: expect.arrayContaining([
      expect.objectContaining({
        full_name: `${GITHUB_EMULATOR_FIXTURES.githubOrgLogin}/${GITHUB_EMULATOR_FIXTURES.githubRepoName}`,
        name: GITHUB_EMULATOR_FIXTURES.githubRepoName,
        private: true,
      }),
      expect.objectContaining({
        full_name: `${GITHUB_EMULATOR_FIXTURES.githubOrgLogin}/api-service`,
        name: "api-service",
        private: false,
      }),
    ]),
  });
});

it("rejects installation repository listing without an installation token", async () => {
  const res = await fetch(`${emulator?.url}/installation/repositories`, {
    headers: { authorization: `Bearer ${GITHUB_EMULATOR_FIXTURES.userToken}` },
  });

  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: Run emulator tests and verify failure**

Run:

```bash
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
```

Expected: FAIL because the new routes are missing and only one normal repo is seeded.

- [ ] **Step 3: Seed a second normal org repository**

In `emulators/github/src/fixtures.ts`, add this repo to the existing `repos` array after `workspace`:

```ts
{
  owner: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
  name: "api-service",
  private: false,
  language: "TypeScript",
  auto_init: true,
},
```

Do not seed `.lightfast`; existing setup tests require it to be missing until created.

- [ ] **Step 4: Add current installation route**

In `emulators/github/src/github-compatible-routes.ts`, add this before the access-token route:

```ts
const appInstallationMatch = /^\/app\/installations\/([^/]+)$/.exec(
  url.pathname
);
if (request.method === "GET" && appInstallationMatch) {
  const app = await authenticateApp({
    request,
    store: input.store,
  });
  if (!app) {
    return json(
      {
        message: "A JSON web token could not be decoded",
        documentation_url: "https://docs.github.com/rest",
      },
      401
    );
  }

  const installationId = Number.parseInt(appInstallationMatch[1] ?? "", 10);
  const installation = gh.appInstallations
    .all()
    .find(
      (candidate) =>
        candidate.installation_id === installationId &&
        candidate.app_id === app.app_id
    );
  if (!installation) {
    return notFound();
  }

  const formatted = formatInstallation({
    installationId: installation.installation_id,
    publicOrigin: input.publicOrigin,
    store: input.store,
  });
  return formatted ? json(formatted) : notFound();
}
```

- [ ] **Step 5: Preserve installation id on minted installation tokens**

In the existing access-token route in `emulators/github/src/github-compatible-routes.ts`, change the `scopes` array passed to `input.tokenMap.set()`:

```ts
scopes: [
  `installation:${installation.installation_id}`,
  ...Object.entries(requestedPermissions).map(
    ([key, value]) => `${key}:${value}`
  ),
],
```

- [ ] **Step 6: Add `/installation/repositories` route**

Add this route after the access-token route and before OAuth fallback handling:

```ts
if (request.method === "GET" && url.pathname === "/installation/repositories") {
  const token = getBearerToken(request);
  const tokenEntry = token ? input.tokenMap.get(token) : undefined;
  const installationScope = tokenEntry?.scopes.find((scope) =>
    scope.startsWith("installation:")
  );
  const installationId = Number.parseInt(
    installationScope?.slice("installation:".length) ?? "",
    10
  );
  if (!Number.isFinite(installationId)) {
    return json({ message: "Bad credentials" }, 401);
  }

  const installation = gh.appInstallations
    .all()
    .find((candidate) => candidate.installation_id === installationId);
  if (!installation) {
    return notFound();
  }

  const account =
    installation.account_type === "Organization"
      ? gh.orgs.get(installation.account_id)
      : gh.users.get(installation.account_id);
  if (!account) {
    return notFound();
  }

  const allRepos = gh.repos
    .all()
    .filter((repo) => repo.owner_id === account.id);
  const accessibleRepos =
    installation.repository_selection === "selected"
      ? allRepos.filter((repo) => installation.repository_ids.includes(repo.id))
      : allRepos;

  const perPage = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get("per_page") ?? "100", 10))
  );
  const page = Math.max(
    1,
    Number.parseInt(url.searchParams.get("page") ?? "1", 10)
  );
  const start = (page - 1) * perPage;
  const pageRepos = accessibleRepos.slice(start, start + perPage);

  return json({
    total_count: accessibleRepos.length,
    repositories: pageRepos.map((repo) => ({
      full_name: `${account.login}/${repo.name}`,
      id: repo.id,
      name: repo.name,
      owner: {
        id: account.id,
        login: account.login,
      },
      private: repo.private,
    })),
  });
}
```

- [ ] **Step 7: Run emulator tests and typecheck**

Run:

```bash
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
pnpm --filter @repo/github-emulator typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add emulators/github/src/github-compatible-routes.ts emulators/github/src/fixtures.ts emulators/github/src/__tests__/server.test.ts
git commit -m "feat: emulate github installation repositories"
```

## Task 4: DB Helpers For Watched Repository Reads And Add-Only Inserts

**Files:**
- Modify: `db/app/src/utils/source-control-repositories.ts`
- Modify: `db/app/src/index.ts`
- Modify: `db/app/src/__tests__/source-control-repositories.test.ts`

- [ ] **Step 1: Write failing DB helper tests**

Add imports in `db/app/src/__tests__/source-control-repositories.test.ts`:

```ts
import {
  insertWatchedSourceControlRepository,
  listWatchedSourceControlRepositories,
} from "../utils/source-control-repositories";
```

Add tests:

```ts
it("lists watched repositories for a binding", async () => {
  const repositories = [
    createWatchedRepository({
      id: 30,
      orgSourceControlBindingId: 7,
      providerRepositoryId: "repo-1",
    }),
  ];
  const whereMock = vi.fn(() => repositories);
  const orderByMock = vi.fn(() => ({ where: whereMock }));
  const fromMock = vi.fn(() => ({ orderBy: orderByMock }));
  const db = {
    select: vi.fn(() => ({ from: fromMock })),
  } as unknown as Database;

  await expect(
    listWatchedSourceControlRepositories(db, {
      orgSourceControlBindingId: 7,
    })
  ).resolves.toEqual(repositories);
});

it("inserts watched repository without duplicate-key scope overwrite", async () => {
  const repository = createWatchedRepository({
    fullName: "acme/workspace",
    id: 31,
    providerRepositoryId: "repo-2",
    watchedPathGlobs: ["**"],
  });
  const limitMock = vi.fn(() => [repository]);
  const selectWhereMock = vi.fn(() => ({ limit: limitMock }));
  const fromMock = vi.fn(() => ({ where: selectWhereMock }));
  const catchMock = vi.fn(async () => undefined);
  const valuesMock = vi.fn(() => ({ catch: catchMock }));
  const db = {
    insert: vi.fn(() => ({ values: valuesMock })),
    select: vi.fn(() => ({ from: fromMock })),
  } as unknown as Database;

  await expect(
    insertWatchedSourceControlRepository(db, {
      fullName: "acme/workspace",
      orgSourceControlBindingId: 7,
      providerRepositoryId: "repo-2",
      watchedPathGlobs: ["**"],
    })
  ).resolves.toBe(repository);

  expect(valuesMock).toHaveBeenCalledWith({
    fullName: "acme/workspace",
    orgSourceControlBindingId: 7,
    providerRepositoryId: "repo-2",
    watchedPathGlobs: ["**"],
  });
});
```

- [ ] **Step 2: Run DB tests and verify failure**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/source-control-repositories.test.ts
```

Expected: FAIL because helpers are missing.

- [ ] **Step 3: Implement list helper**

In `db/app/src/utils/source-control-repositories.ts`, import `asc`:

```ts
import { and, asc, eq, getTableColumns } from "drizzle-orm";
```

Add:

```ts
export async function listWatchedSourceControlRepositories(
  db: Database,
  input: { orgSourceControlBindingId: number }
): Promise<SourceControlRepository[]> {
  return await db
    .select(repositorySelection)
    .from(sourceControlRepositories)
    .orderBy(asc(sourceControlRepositories.id))
    .where(
      eq(
        sourceControlRepositories.orgSourceControlBindingId,
        input.orgSourceControlBindingId
      )
    );
}
```

- [ ] **Step 4: Implement add-only helper**

Add:

```ts
export async function insertWatchedSourceControlRepository(
  db: Database,
  input: UpsertWatchedSourceControlRepositoryInput
): Promise<SourceControlRepository> {
  let duplicateError: unknown;
  await db
    .insert(sourceControlRepositories)
    .values({
      fullName: input.fullName,
      orgSourceControlBindingId: input.orgSourceControlBindingId,
      providerRepositoryId: input.providerRepositoryId,
      watchedPathGlobs: input.watchedPathGlobs,
    })
    .catch((error: unknown) => {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      duplicateError = error;
    });

  const repository = await getWatchedSourceControlRepository(db, {
    orgSourceControlBindingId: input.orgSourceControlBindingId,
    providerRepositoryId: input.providerRepositoryId,
  });
  if (!repository) {
    if (duplicateError) {
      throw duplicateError;
    }
    throw new Error(
      `Failed to insert watched repository ${input.providerRepositoryId}`
    );
  }
  return repository;
}
```

The API will call `getWatchedSourceControlRepository()` first for idempotency, so duplicate add requests preserve existing `watchedPathGlobs`.

- [ ] **Step 5: Export helpers**

In `db/app/src/index.ts`, add exports:

```ts
insertWatchedSourceControlRepository,
listWatchedSourceControlRepositories,
```

and export any new input types if introduced.

- [ ] **Step 6: Run DB tests and typecheck**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/source-control-repositories.test.ts
pnpm --filter @db/app typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add db/app/src/utils/source-control-repositories.ts db/app/src/index.ts db/app/src/__tests__/source-control-repositories.test.ts
git commit -m "feat: add watched repository read helpers"
```

## Task 5: API Source-Control Repository Service

**Files:**
- Create: `api/app/src/services/github/source-control/repositories.ts`
- Create: `api/app/src/services/github/source-control/repositories.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `api/app/src/services/github/source-control/repositories.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildSourceControlRepositoryResponse,
  lightfastRepositoryIdFromBinding,
} from "./repositories";

const binding = {
  id: 7,
  metadata: {
    lightfastRepository: {
      fullName: "acme/.lightfast",
      id: "100",
      installationId: "1001",
      name: ".lightfast",
      verifiedAt: "2026-05-31T00:00:00.000Z",
    },
  },
  providerAccountId: "20",
};

describe("GitHub source-control repository service", () => {
  it("extracts .lightfast setup repository id from binding metadata", () => {
    expect(lightfastRepositoryIdFromBinding(binding)).toBe("100");
  });

  it("merges live GitHub repositories with watched rows and excludes .lightfast", () => {
    expect(
      buildSourceControlRepositoryResponse({
        binding,
        liveRepositories: [
          {
            fullName: "acme/.lightfast",
            id: "100",
            name: ".lightfast",
            ownerId: "20",
            ownerLogin: "acme",
            private: true,
          },
          {
            fullName: "acme/workspace",
            id: "200",
            name: "workspace",
            ownerId: "20",
            ownerLogin: "acme",
            private: true,
          },
          {
            fullName: "other/repo",
            id: "300",
            name: "repo",
            ownerId: "30",
            ownerLogin: "other",
            private: false,
          },
        ],
        watchedRepositories: [
          {
            id: 10,
            orgSourceControlBindingId: 7,
            providerRepositoryId: "200",
            fullName: "old/workspace",
            watchedPathGlobs: ["**"],
            createdAt: new Date("2026-05-31T00:00:00.000Z"),
            updatedAt: new Date("2026-05-31T00:00:00.000Z"),
          },
          {
            id: 11,
            orgSourceControlBindingId: 7,
            providerRepositoryId: "999",
            fullName: "old/missing",
            watchedPathGlobs: ["**"],
            createdAt: new Date("2026-05-31T00:00:00.000Z"),
            updatedAt: new Date("2026-05-31T00:00:00.000Z"),
          },
        ],
      })
    ).toEqual([
      {
        fullName: "acme/workspace",
        id: "200",
        imported: true,
        name: "workspace",
        owner: { id: "20", login: "acme" },
        private: true,
        watchedPathGlobs: ["**"],
      },
    ]);
  });

  it("falls back to live .lightfast name exclusion when setup proof is absent", () => {
    const rows = buildSourceControlRepositoryResponse({
      binding: { id: 7, metadata: {}, providerAccountId: "20" },
      liveRepositories: [
        {
          fullName: "acme/.lightfast",
          id: "100",
          name: ".lightfast",
          ownerId: "20",
          ownerLogin: "acme",
          private: true,
        },
      ],
      watchedRepositories: [],
    });

    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run service tests and verify failure**

Run:

```bash
pnpm --filter @api/app test -- src/services/github/source-control/repositories.test.ts
```

Expected: FAIL because the service file does not exist.

- [ ] **Step 3: Implement pure merge helpers**

Create `api/app/src/services/github/source-control/repositories.ts`:

```ts
import type { SourceControlRepository } from "@db/app";
import { githubLightfastRepositoryProofSchema } from "@repo/app-setup-contract";
import type { GitHubInstallationRepository } from "@repo/github-app-node";

export interface SourceControlRepositoryRow {
  fullName: string;
  id: string;
  imported: boolean;
  name: string;
  owner: {
    id: string;
    login: string;
  };
  private: boolean;
  watchedPathGlobs: string[] | null;
}

export function lightfastRepositoryIdFromBinding(input: {
  metadata: Record<string, unknown>;
}): string | null {
  const parsed = githubLightfastRepositoryProofSchema.safeParse(
    input.metadata.lightfastRepository
  );
  return parsed.success ? parsed.data.id : null;
}

export function buildSourceControlRepositoryResponse(input: {
  binding: {
    id: number;
    metadata: Record<string, unknown>;
    providerAccountId: string | null;
  };
  liveRepositories: GitHubInstallationRepository[];
  watchedRepositories: SourceControlRepository[];
}): SourceControlRepositoryRow[] {
  const lightfastRepositoryId = lightfastRepositoryIdFromBinding(input.binding);
  const watchedByProviderId = new Map(
    input.watchedRepositories.map((repository) => [
      repository.providerRepositoryId,
      repository,
    ])
  );

  return input.liveRepositories
    .filter((repository) => repository.ownerId === input.binding.providerAccountId)
    .filter((repository) => repository.id !== lightfastRepositoryId)
    .filter((repository) => repository.name !== ".lightfast")
    .map((repository) => {
      const watched = watchedByProviderId.get(repository.id);
      return {
        fullName: repository.fullName,
        id: repository.id,
        imported: Boolean(watched),
        name: repository.name,
        owner: {
          id: repository.ownerId,
          login: repository.ownerLogin,
        },
        private: repository.private,
        watchedPathGlobs: watched?.watchedPathGlobs ?? null,
      };
    });
}

export function countNormalImportedRepositories(input: {
  binding: {
    metadata: Record<string, unknown>;
  };
  watchedRepositories: SourceControlRepository[];
}): number {
  const lightfastRepositoryId = lightfastRepositoryIdFromBinding(input.binding);
  return input.watchedRepositories.filter(
    (repository) => repository.providerRepositoryId !== lightfastRepositoryId
  ).length;
}
```

- [ ] **Step 4: Add all-page GitHub list helper**

In the same file, add:

```ts
import {
  listGitHubInstallationRepositories,
  type GitHubInstallationRepository,
} from "@repo/github-app-node";

export async function listAllGitHubInstallationRepositories(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  installationToken: string;
}): Promise<GitHubInstallationRepository[]> {
  const repositories: GitHubInstallationRepository[] = [];
  let page = 1;
  const perPage = 100;

  for (;;) {
    const result = await listGitHubInstallationRepositories({
      apiBaseUrl: input.apiBaseUrl,
      apiVersion: input.apiVersion,
      installationToken: input.installationToken,
      page,
      perPage,
    });
    repositories.push(...result.repositories);

    if (
      result.repositories.length < perPage ||
      (result.totalCount !== undefined && repositories.length >= result.totalCount)
    ) {
      break;
    }

    page += 1;
  }

  return repositories;
}
```

Keep imports deduplicated after adding this snippet.

- [ ] **Step 5: Run service tests and typecheck**

Run:

```bash
pnpm --filter @api/app test -- src/services/github/source-control/repositories.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/app/src/services/github/source-control/repositories.ts api/app/src/services/github/source-control/repositories.test.ts
git commit -m "feat: add github source control repository merge service"
```

## Task 6: tRPC Source-Control Router Read And Import APIs

**Files:**
- Modify: `api/app/src/router/(pending-not-allowed)/org-source-control.ts`
- Modify: `api/app/src/__tests__/org-source-control-router.test.ts`

- [ ] **Step 1: Write failing router tests**

Update mocks in `api/app/src/__tests__/org-source-control-router.test.ts`:

```ts
const getWatchedSourceControlRepositoryMock = vi.fn();
const insertWatchedSourceControlRepositoryMock = vi.fn();
const listWatchedSourceControlRepositoriesMock = vi.fn();
const createGitHubAppJwtMock = vi.fn();
const createGitHubInstallationTokenMock = vi.fn();
const getGitHubAppInstallationMock = vi.fn();
const listGitHubInstallationRepositoriesMock = vi.fn();
```

Extend `vi.mock("@db/app", ...)`:

```ts
vi.mock("@db/app", () => ({
  getActiveOrgBinding: getActiveOrgBindingMock,
  getWatchedSourceControlRepository: getWatchedSourceControlRepositoryMock,
  insertWatchedSourceControlRepository: insertWatchedSourceControlRepositoryMock,
  listWatchedSourceControlRepositories: listWatchedSourceControlRepositoriesMock,
}));
```

Add:

```ts
vi.mock("@repo/github-app-node", () => ({
  createGitHubAppJwt: createGitHubAppJwtMock,
  createGitHubInstallationToken: createGitHubInstallationTokenMock,
  getGitHubAppInstallation: getGitHubAppInstallationMock,
  listGitHubInstallationRepositories: listGitHubInstallationRepositoriesMock,
}));

vi.mock("../services/github/config", () => ({
  getGitHubAppConfig: () => ({
    apiVersion: "2022-11-28",
    appId: "424242",
    appSlug: "lightfast-local",
    clientId: "client",
    clientSecret: "secret",
    endpoints: {
      apiBaseUrl: "https://github.lightfast.localhost",
      oauthAuthorizeUrl: "https://github.lightfast.localhost/login/oauth/authorize",
      oauthTokenUrl: "https://github.lightfast.localhost/login/oauth/access_token",
      webBaseUrl: "https://github.lightfast.localhost",
    },
    privateKey: "private-key",
  }),
}));
```

Add helper objects:

```ts
function activeBinding(overrides = {}) {
  const connectedAt = new Date("2026-05-29T01:02:03.000Z");
  return {
    clerkOrgId: "org_acme",
    connectedAt,
    connectedByUserId: "user_admin",
    createdAt: connectedAt,
    id: 3,
    metadata: {
      lightfastRepository: {
        fullName: "lightfast-emulated/.lightfast",
        id: "100",
        installationId: "1001",
        name: ".lightfast",
        verifiedAt: "2026-05-30T00:00:00.000Z",
      },
    },
    provider: "github",
    providerAccountId: "20",
    providerAccountLogin: "lightfast-emulated",
    providerInstallationId: "1001",
    revokedAt: null,
    status: "active",
    updatedAt: connectedAt,
    ...overrides,
  };
}

function liveRepository(overrides = {}) {
  return {
    fullName: "lightfast-emulated/workspace",
    id: "200",
    name: "workspace",
    ownerId: "20",
    ownerLogin: "lightfast-emulated",
    private: true,
    ...overrides,
  };
}
```

Add tests:

```ts
describe("org.settings.sourceControl.listRepositories", () => {
  it("returns live repositories merged with durable watches", async () => {
    getActiveOrgBindingMock.mockResolvedValue(activeBinding());
    listWatchedSourceControlRepositoriesMock.mockResolvedValue([
      {
        id: 30,
        orgSourceControlBindingId: 3,
        providerRepositoryId: "200",
        fullName: "old/workspace",
        watchedPathGlobs: ["**"],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    createGitHubAppJwtMock.mockResolvedValue("app.jwt");
    getGitHubAppInstallationMock.mockResolvedValue({
      account: { id: "20", login: "lightfast-emulated", type: "Organization" },
      htmlUrl: "https://github.lightfast.localhost/settings/installations/1001",
      id: "1001",
      targetType: "Organization",
    });
    createGitHubInstallationTokenMock.mockResolvedValue({
      token: "ghs_installation",
      expiresAt: "2026-05-31T00:00:00Z",
    });
    listGitHubInstallationRepositoriesMock.mockResolvedValue({
      repositories: [
        liveRepository({ id: "100", name: ".lightfast", fullName: "lightfast-emulated/.lightfast" }),
        liveRepository(),
      ],
      totalCount: 2,
    });

    await expect(
      caller().org.settings.sourceControl.listRepositories()
    ).resolves.toMatchObject({
      organization: {
        id: "20",
        installationManageUrl:
          "https://github.lightfast.localhost/settings/installations/1001",
        login: "lightfast-emulated",
      },
      repositories: [
        {
          fullName: "lightfast-emulated/workspace",
          id: "200",
          imported: true,
          name: "workspace",
          private: true,
          watchedPathGlobs: ["**"],
        },
      ],
      repositoriesError: null,
      status: "bound",
    });
  });

  it("returns a repository error without stale rows when GitHub listing fails after installation metadata", async () => {
    getActiveOrgBindingMock.mockResolvedValue(activeBinding());
    listWatchedSourceControlRepositoriesMock.mockResolvedValue([]);
    createGitHubAppJwtMock.mockResolvedValue("app.jwt");
    getGitHubAppInstallationMock.mockResolvedValue({
      account: { id: "20", login: "lightfast-emulated", type: "Organization" },
      htmlUrl: "https://github.lightfast.localhost/settings/installations/1001",
      id: "1001",
      targetType: "Organization",
    });
    createGitHubInstallationTokenMock.mockResolvedValue({
      token: "ghs_installation",
      expiresAt: "2026-05-31T00:00:00Z",
    });
    listGitHubInstallationRepositoriesMock.mockRejectedValue(new Error("boom"));

    await expect(
      caller().org.settings.sourceControl.listRepositories()
    ).resolves.toMatchObject({
      organization: {
        id: "20",
        login: "lightfast-emulated",
      },
      repositories: [],
      repositoriesError: {
        code: "github_repository_listing_failed",
      },
      status: "bound",
    });
  });

  it("treats installation account mismatch as broken without binding mutation", async () => {
    getActiveOrgBindingMock.mockResolvedValue(activeBinding());
    listWatchedSourceControlRepositoriesMock.mockResolvedValue([]);
    createGitHubAppJwtMock.mockResolvedValue("app.jwt");
    getGitHubAppInstallationMock.mockResolvedValue({
      account: { id: "999", login: "other", type: "Organization" },
      htmlUrl: "https://github.lightfast.localhost/settings/installations/1001",
      id: "1001",
      targetType: "Organization",
    });

    await expect(
      caller().org.settings.sourceControl.listRepositories()
    ).resolves.toMatchObject({
      organization: null,
      repositories: [],
      repositoriesError: {
        code: "github_installation_account_mismatch",
      },
      status: "bound",
    });

    expect(insertWatchedSourceControlRepositoryMock).not.toHaveBeenCalled();
  });
});
```

Add admin caller support:

```ts
function adminCaller(identity = activeIdentity()) {
  return createCaller({
    auth: {
      identity,
      access: {
        kind: "clerk-session",
        userId: "user_test",
        orgId: "org_acme",
        has: ({ role }: { role?: string }) => role === "org:admin",
      },
    },
    db: {} as Database,
    headers: new Headers(),
  });
}
```

Add import tests:

```ts
describe("org.settings.sourceControl.importRepository", () => {
  it("rejects non-admin imports", async () => {
    await expect(
      caller().org.settings.sourceControl.importRepository({
        repositoryId: "200",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("registers one repository with all-path watch", async () => {
    getActiveOrgBindingMock.mockResolvedValue(activeBinding());
    getWatchedSourceControlRepositoryMock.mockResolvedValue(undefined);
    listWatchedSourceControlRepositoriesMock.mockResolvedValue([]);
    createGitHubAppJwtMock.mockResolvedValue("app.jwt");
    getGitHubAppInstallationMock.mockResolvedValue({
      account: { id: "20", login: "lightfast-emulated", type: "Organization" },
      htmlUrl: "https://github.lightfast.localhost/settings/installations/1001",
      id: "1001",
      targetType: "Organization",
    });
    createGitHubInstallationTokenMock.mockResolvedValue({
      token: "ghs_installation",
      expiresAt: "2026-05-31T00:00:00Z",
    });
    listGitHubInstallationRepositoriesMock.mockResolvedValue({
      repositories: [liveRepository()],
      totalCount: 1,
    });
    insertWatchedSourceControlRepositoryMock.mockResolvedValue({
      id: 30,
      orgSourceControlBindingId: 3,
      providerRepositoryId: "200",
      fullName: "lightfast-emulated/workspace",
      watchedPathGlobs: ["**"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await adminCaller().org.settings.sourceControl.importRepository({
      repositoryId: "200",
    });

    expect(insertWatchedSourceControlRepositoryMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        fullName: "lightfast-emulated/workspace",
        orgSourceControlBindingId: 3,
        providerRepositoryId: "200",
        watchedPathGlobs: ["**"],
      })
    );
  });

  it("is idempotent for already watched repositories", async () => {
    getActiveOrgBindingMock.mockResolvedValue(activeBinding());
    getWatchedSourceControlRepositoryMock.mockResolvedValue({
      id: 30,
      orgSourceControlBindingId: 3,
      providerRepositoryId: "200",
      fullName: "lightfast-emulated/workspace",
      watchedPathGlobs: ["src/**"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    listWatchedSourceControlRepositoriesMock.mockResolvedValue([]);
    createGitHubAppJwtMock.mockResolvedValue("app.jwt");
    getGitHubAppInstallationMock.mockResolvedValue({
      account: { id: "20", login: "lightfast-emulated", type: "Organization" },
      htmlUrl: "https://github.lightfast.localhost/settings/installations/1001",
      id: "1001",
      targetType: "Organization",
    });
    createGitHubInstallationTokenMock.mockResolvedValue({
      token: "ghs_installation",
      expiresAt: "2026-05-31T00:00:00Z",
    });
    listGitHubInstallationRepositoriesMock.mockResolvedValue({
      repositories: [liveRepository()],
      totalCount: 1,
    });

    await adminCaller().org.settings.sourceControl.importRepository({
      repositoryId: "200",
    });

    expect(insertWatchedSourceControlRepositoryMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run router tests and verify failure**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/org-source-control-router.test.ts
```

Expected: FAIL because `listRepositories` and `importRepository` do not exist.

- [ ] **Step 3: Implement router**

In `api/app/src/router/(pending-not-allowed)/org-source-control.ts`:

```ts
import {
  getActiveOrgBinding,
  getWatchedSourceControlRepository,
  insertWatchedSourceControlRepository,
  listWatchedSourceControlRepositories,
} from "@db/app";
import { SOURCE_CONTROL_ALL_PATHS_GLOB } from "@repo/source-control-contract";
import { TRPCError } from "@trpc/server";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import {
  createGitHubAppJwt,
  createGitHubInstallationToken,
  getGitHubAppInstallation,
} from "@repo/github-app-node";
import { orgAdminProcedure, orgProcedure } from "../../trpc";
import { getGitHubAppConfig } from "../../services/github/config";
import {
  buildSourceControlRepositoryResponse,
  countNormalImportedRepositories,
  lightfastRepositoryIdFromBinding,
  listAllGitHubInstallationRepositories,
} from "../../services/github/source-control/repositories";
```

Add helper:

```ts
function assertActiveGitHubBinding(binding: Awaited<ReturnType<typeof getActiveOrgBinding>>) {
  if (
    !binding ||
    binding.provider !== "github" ||
    !binding.providerAccountId ||
    !binding.providerInstallationId
  ) {
    return null;
  }
  return binding;
}
```

Extend `get` to load watched rows and count normal rows:

```ts
const watched = await listWatchedSourceControlRepositories(ctx.db, {
  orgSourceControlBindingId: binding.id,
});
```

Return:

```ts
binding: {
  connectedAt: binding.connectedAt,
  provider: binding.provider,
  providerLabel: providerLabel(binding.provider),
  importedRepositoryCount: countNormalImportedRepositories({
    binding,
    watchedRepositories: watched,
  }),
}
```

Do not return `accountLogin` from `get`.

- [ ] **Step 4: Implement `listRepositories`**

Add a query:

```ts
listRepositories: orgProcedure.query(async ({ ctx }) => {
  const binding = assertActiveGitHubBinding(
    await getActiveOrgBinding(ctx.db, ctx.auth.identity.orgId)
  );
  if (!binding) {
    return {
      organization: null,
      repositories: [],
      repositoriesError: null,
      status: "unbound" as const,
    };
  }

  const config = getGitHubAppConfig();
  const watched = await listWatchedSourceControlRepositories(ctx.db, {
    orgSourceControlBindingId: binding.id,
  });
  const appJwt = await createGitHubAppJwt({
    appId: config.appId,
    privateKey: config.privateKey,
  });

  const installation = await getGitHubAppInstallation({
    apiBaseUrl: config.endpoints.apiBaseUrl,
    apiVersion: config.apiVersion,
    appJwt,
    installationId: binding.providerInstallationId,
  }).catch(() => null);
  if (!installation) {
    return {
      organization: null,
      repositories: [],
      repositoriesError: {
        code: "github_repository_listing_failed" as const,
        message: "GitHub installation metadata could not be refreshed.",
      },
      status: "bound" as const,
    };
  }
  if (installation.account.id !== binding.providerAccountId) {
    return {
      organization: null,
      repositories: [],
      repositoriesError: {
        code: "github_installation_account_mismatch" as const,
        message: "The connected GitHub installation no longer matches this Lightfast organization.",
      },
      status: "bound" as const,
    };
  }

  const organization = {
    id: installation.account.id,
    installationManageUrl: installation.htmlUrl,
    login: installation.account.login,
  };

  const installationToken = await createGitHubInstallationToken({
    apiBaseUrl: config.endpoints.apiBaseUrl,
    apiVersion: config.apiVersion,
    appJwt,
    installationId: binding.providerInstallationId,
  });
  const liveRepositories = await listAllGitHubInstallationRepositories({
    apiBaseUrl: config.endpoints.apiBaseUrl,
    apiVersion: config.apiVersion,
    installationToken: installationToken.token,
  }).catch(() => null);
  if (!liveRepositories) {
    return {
      organization,
      repositories: [],
      repositoriesError: {
        code: "github_repository_listing_failed" as const,
        message: "GitHub repositories could not be refreshed.",
      },
      status: "bound" as const,
    };
  }

  return {
    organization,
    repositories: buildSourceControlRepositoryResponse({
      binding,
      liveRepositories,
      watchedRepositories: watched,
    }),
    repositoriesError: null,
    status: "bound" as const,
  };
})
```

- [ ] **Step 5: Implement `importRepository`**

Add mutation:

```ts
importRepository: orgAdminProcedure
  .input(z.object({ repositoryId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const binding = assertActiveGitHubBinding(
      await getActiveOrgBinding(ctx.db, ctx.auth.identity.orgId)
    );
    if (!binding) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Connect a GitHub organization before adding repositories.",
      });
    }

    const config = getGitHubAppConfig();
    const appJwt = await createGitHubAppJwt({
      appId: config.appId,
      privateKey: config.privateKey,
    });
    const installation = await getGitHubAppInstallation({
      apiBaseUrl: config.endpoints.apiBaseUrl,
      apiVersion: config.apiVersion,
      appJwt,
      installationId: binding.providerInstallationId,
    });
    if (installation.account.id !== binding.providerAccountId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "The connected GitHub installation no longer matches this Lightfast organization.",
      });
    }

    const installationToken = await createGitHubInstallationToken({
      apiBaseUrl: config.endpoints.apiBaseUrl,
      apiVersion: config.apiVersion,
      appJwt,
      installationId: binding.providerInstallationId,
    });
    const liveRepositories = await listAllGitHubInstallationRepositories({
      apiBaseUrl: config.endpoints.apiBaseUrl,
      apiVersion: config.apiVersion,
      installationToken: installationToken.token,
    });
    const lightfastRepositoryId = lightfastRepositoryIdFromBinding(binding);
    if (input.repositoryId === lightfastRepositoryId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: ".lightfast is setup infrastructure and cannot be added here.",
      });
    }

    const selected = liveRepositories.find(
      (repository) =>
        repository.id === input.repositoryId &&
        repository.ownerId === binding.providerAccountId &&
        repository.name !== ".lightfast"
    );
    if (!selected) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Selected repository is no longer accessible to this GitHub installation.",
      });
    }

    const existing = await getWatchedSourceControlRepository(ctx.db, {
      orgSourceControlBindingId: binding.id,
      providerRepositoryId: selected.id,
    });
    if (!existing) {
      await insertWatchedSourceControlRepository(ctx.db, {
        fullName: selected.fullName,
        orgSourceControlBindingId: binding.id,
        providerRepositoryId: selected.id,
        watchedPathGlobs: [SOURCE_CONTROL_ALL_PATHS_GLOB],
      });
    }

    const watched = await listWatchedSourceControlRepositories(ctx.db, {
      orgSourceControlBindingId: binding.id,
    });
    return {
      organization: {
        id: installation.account.id,
        installationManageUrl: installation.htmlUrl,
        login: installation.account.login,
      },
      repositories: buildSourceControlRepositoryResponse({
        binding,
        liveRepositories,
        watchedRepositories: watched,
      }),
      repositoriesError: null,
      status: "bound" as const,
    };
  })
```

- [ ] **Step 6: Run API tests and typecheck**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/org-source-control-router.test.ts src/services/github/source-control/repositories.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/app/src/router/\(pending-not-allowed\)/org-source-control.ts api/app/src/__tests__/org-source-control-router.test.ts
git commit -m "feat: add source control repository import api"
```

## Task 7: Source Control Settings UI And Modal

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/page.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx`
- Replace: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/source-control-connection-section.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-team-general-client.test.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-connection-section.test.tsx`

- [ ] **Step 1: Write failing component tests**

Replace `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-connection-section.test.tsx` with tests that cover the new UI. Start with:

```ts
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const importRepositoryMutateMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("@vendor/clerk", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query"
  );
  return {
    ...actual,
    useMutation: (options: { mutationFn?: unknown; onSuccess?: unknown }) => ({
      isPending: false,
      mutate: importRepositoryMutateMock,
    }),
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesMock,
    }),
  };
});

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        sourceControl: {
          importRepository: {
            mutationOptions: (options: unknown) => options,
          },
          listRepositories: {
            queryOptions: () => ({
              queryKey: ["org", "settings", "sourceControl", "listRepositories"],
            }),
          },
        },
      },
    },
  }),
}));

const { SourceControlConnectionSection } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/source-control-connection-section"
);

const connectedAt = new Date("2026-05-29T01:02:03.000Z");

function sourceControlData() {
  return {
    connection: {
      connectedAt,
      importedRepositoryCount: 1,
      provider: "github",
      providerLabel: "GitHub",
    },
    repositories: {
      organization: {
        id: "20",
        installationManageUrl:
          "https://github.lightfast.localhost/settings/installations/1001",
        login: "lightfast-emulated",
      },
      repositories: [
        {
          fullName: "lightfast-emulated/workspace",
          id: "200",
          imported: true,
          name: "workspace",
          owner: { id: "20", login: "lightfast-emulated" },
          private: true,
          watchedPathGlobs: ["**"],
        },
        {
          fullName: "lightfast-emulated/api-service",
          id: "201",
          imported: false,
          name: "api-service",
          owner: { id: "20", login: "lightfast-emulated" },
          private: false,
          watchedPathGlobs: null,
        },
      ],
      repositoriesError: null,
      status: "bound",
    },
  };
}
```

Add tests:

```ts
beforeEach(() => {
  importRepositoryMutateMock.mockReset();
  invalidateQueriesMock.mockReset();
  useAuthMock.mockReturnValue({
    isLoaded: true,
    has: ({ role }: { role?: string }) => role === "org:admin",
  });
});

it("renders GitHub integration without personal account state", () => {
  const data = sourceControlData();
  render(
    <SourceControlConnectionSection
      connection={data.connection}
      orgSlug="acme"
      repositories={data.repositories}
    />
  );

  expect(screen.getByRole("heading", { name: "GitHub" })).toBeVisible();
  expect(screen.getByText("lightfast-emulated")).toBeVisible();
  expect(screen.getByText("workspace")).toBeVisible();
  expect(screen.getByText("Private")).toBeVisible();
  expect(screen.getByText("api-service")).toBeVisible();
  expect(screen.getByText("Public")).toBeVisible();
  expect(
    screen.queryByText("Personal GitHub account connected")
  ).not.toBeInTheDocument();
  expect(screen.queryByText(".lightfast")).not.toBeInTheDocument();
});

it("opens the add repository modal and disables already imported rows", () => {
  const data = sourceControlData();
  render(
    <SourceControlConnectionSection
      connection={data.connection}
      orgSlug="acme"
      repositories={data.repositories}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Add repository" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("workspace")).toBeVisible();
  expect(within(dialog).getByRole("button", { name: /workspace/i })).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: /api-service/i })).not.toBeDisabled();

  fireEvent.click(within(dialog).getByRole("button", { name: /api-service/i }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Add selected repository" }));
  expect(importRepositoryMutateMock).toHaveBeenCalledWith({ repositoryId: "201" });
});

it("disables admin actions for non-admin members", () => {
  useAuthMock.mockReturnValue({
    isLoaded: true,
    has: () => false,
  });
  const data = sourceControlData();
  render(
    <SourceControlConnectionSection
      connection={data.connection}
      orgSlug="acme"
      repositories={data.repositories}
    />
  );

  expect(screen.getByRole("button", { name: "Add repository" })).toBeDisabled();
  expect(screen.queryByRole("link", { name: "Manage GitHub access" })).not.toBeInTheDocument();
});

it("scopes repository listing errors to the repository card", () => {
  const data = sourceControlData();
  render(
    <SourceControlConnectionSection
      connection={data.connection}
      orgSlug="acme"
      repositories={{
        ...data.repositories,
        repositories: [],
        repositoriesError: {
          code: "github_repository_listing_failed",
          message: "GitHub repositories could not be refreshed.",
        },
      }}
    />
  );

  expect(screen.getByRole("heading", { name: "GitHub" })).toBeVisible();
  expect(screen.getByText("lightfast-emulated")).toBeVisible();
  expect(screen.getByText("GitHub repositories could not be refreshed.")).toBeVisible();
});
```

- [ ] **Step 2: Run UI tests and verify failure**

Run:

```bash
pnpm --filter @lightfast/app test -- "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-connection-section.test.tsx"
```

Expected: FAIL because props and UI are still read-only.

- [ ] **Step 3: Update server prefetch**

In `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/page.tsx`, add:

```ts
prefetch(trpc.org.settings.sourceControl.listRepositories.queryOptions());
```

Keep the existing `get` prefetch.

- [ ] **Step 4: Update TeamGeneralSettingsClient data flow**

In `team-general-settings-client.tsx`, add:

```ts
const { data: sourceControlRepositories } = useSuspenseQuery(
  trpc.org.settings.sourceControl.listRepositories.queryOptions()
);
```

Pass:

```tsx
<SourceControlConnectionSection
  connection={sourceControlConnection.binding}
  orgSlug={slug}
  repositories={sourceControlRepositories}
/>
```

- [ ] **Step 5: Replace SourceControlConnectionSection**

Use these imports:

```ts
import type { AppRouterOutputs } from "@api/app";
import { Icons } from "@repo/ui/components/icons";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { ExternalLink, GitBranch, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTRPC } from "~/trpc/react";
```

Use these types:

```ts
type SourceControlConnection =
  AppRouterOutputs["org"]["settings"]["sourceControl"]["get"]["binding"];
type SourceControlRepositories =
  AppRouterOutputs["org"]["settings"]["sourceControl"]["listRepositories"];

interface SourceControlConnectionSectionProps {
  connection: SourceControlConnection;
  orgSlug: string;
  repositories: SourceControlRepositories;
}
```

Implement these component rules:

```ts
const { has, isLoaded } = useAuth();
const isAdmin = isLoaded && !!has?.({ role: "org:admin" });
const trpc = useTRPC();
const queryClient = useQueryClient();
const listQueryOptions = trpc.org.settings.sourceControl.listRepositories.queryOptions();
const [search, setSearch] = useState("");
const [selectedRepositoryId, setSelectedRepositoryId] = useState<string | null>(null);

const importRepository = useMutation(
  trpc.org.settings.sourceControl.importRepository.mutationOptions({
    meta: { errorTitle: "Failed to add repository" },
    onSuccess: (data) => {
      queryClient.setQueryData(listQueryOptions.queryKey, data);
      setSelectedRepositoryId(null);
      setSearch("");
    },
  })
);

const filteredRepositories = useMemo(() => {
  const term = search.trim().toLowerCase();
  return repositories.repositories.filter((repository) => {
    if (!term) {
      return true;
    }
    return (
      repository.name.toLowerCase().includes(term) ||
      repository.fullName.toLowerCase().includes(term)
    );
  });
}, [repositories.repositories, search]);
```

Render requirements:

```tsx
<h2 className="font-semibold text-foreground text-xl">GitHub</h2>
```

- No text `Personal GitHub account connected`.
- If `connection === null`, render the existing setup link to `/${orgSlug}/tasks/bind`.
- If `repositories.organization` exists, show org login and `Connected`.
- If `isAdmin && repositories.organization?.installationManageUrl`, show `Manage GitHub access` as an external link.
- Render `importedRepositoryCount` from `connection`.
- Render `repositories.repositories` rows only; do not render any stale placeholder.
- Use `<Badge variant="outline">Private</Badge>` or `<Badge variant="outline">Public</Badge>`.
- Disable `Add repository` when `!isAdmin`, `repositories.repositoriesError !== null`, or `repositories.status !== "bound"`.
- Modal rows are buttons. Imported rows are disabled.
- Submit calls `importRepository.mutate({ repositoryId: selectedRepositoryId })`.
- Refresh button calls `queryClient.invalidateQueries({ queryKey: listQueryOptions.queryKey })`.

- [ ] **Step 6: Update team client test mock**

In `settings-team-general-client.test.tsx`, add:

```ts
const sourceControlListRepositoriesQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "listRepositories"],
}));
```

Add it to mocked `useTRPC()` under `sourceControl.listRepositories.queryOptions`.

Update the `SourceControlConnectionSection` mock props:

```tsx
SourceControlConnectionSection: ({
  connection,
  orgSlug,
}: {
  connection: { importedRepositoryCount: number } | null;
  orgSlug: string;
  repositories: unknown;
}) => (
  <div data-testid="source-control-section">
    {orgSlug}:{connection?.importedRepositoryCount ?? "unbound"}
  </div>
),
```

Update `useSuspenseQueryMock` to return repository data for the list query:

```ts
if (options.queryKey.includes("listRepositories")) {
  return {
    data: {
      organization: null,
      repositories: [],
      repositoriesError: null,
      status: "unbound",
    },
  };
}
```

- [ ] **Step 7: Run UI tests and typecheck**

Run:

```bash
pnpm --filter @lightfast/app test -- "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-connection-section.test.tsx" "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-team-general-client.test.tsx"
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/app/src/app/\(app\)/\(pending-not-allowed\)/\[slug\]/\(workspace\)/\(manage\)/settings/page.tsx apps/app/src/app/\(app\)/\(pending-not-allowed\)/\[slug\]/\(workspace\)/\(manage\)/settings/_components/team-general-settings-client.tsx apps/app/src/app/\(app\)/\(pending-not-allowed\)/\[slug\]/\(workspace\)/\(manage\)/settings/_components/source-control-connection-section.tsx apps/app/src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-source-control-connection-section.test.tsx apps/app/src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-team-general-client.test.tsx
git commit -m "feat: add github repository import settings ui"
```

## Task 8: End-To-End Verification Sweep

**Files:**
- No planned source edits unless verification exposes failures.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
pnpm --filter @repo/source-control-contract test -- src/__tests__/source-control-contract.test.ts
pnpm --filter @repo/github-app-node test -- src/__tests__/installations.test.ts src/__tests__/repository-api.test.ts
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
pnpm --filter @db/app test -- src/__tests__/source-control-repositories.test.ts
pnpm --filter @api/app test -- src/__tests__/org-source-control-router.test.ts src/services/github/source-control/repositories.test.ts
pnpm --filter @lightfast/app test -- "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-connection-section.test.tsx" "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-team-general-client.test.tsx"
```

Expected: all PASS.

- [ ] **Step 2: Run focused typechecks**

Run:

```bash
pnpm --filter @repo/source-control-contract typecheck
pnpm --filter @repo/github-app-node typecheck
pnpm --filter @repo/github-emulator typecheck
pnpm --filter @db/app typecheck
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
```

Expected: all PASS.

- [ ] **Step 3: Run repo-level checks only if focused checks pass**

Run:

```bash
pnpm check
pnpm typecheck
```

Expected: PASS. Do not run global `pnpm build`.

- [ ] **Step 4: Optional browser verification**

If a dev server is already running, use it. If not, start:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

Open the current app URL and verify:

- Source Control settings shows GitHub integration page.
- Personal GitHub account section is absent.
- Connected org card has no active `+`.
- Admin can open Add repository modal.
- Already imported repos are disabled.
- `.lightfast` is absent.
- `Private`/`Public` badges render.
- `Manage GitHub access` opens a GitHub installation URL.
- `Refresh GitHub` is manual and there is no polling behavior.

- [ ] **Step 5: Final commit if verification fixes were needed**

If verification required fixes:

```bash
git add <changed-files>
git commit -m "fix: stabilize github repository import"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage:
  - Singular add: Task 6 and Task 7.
  - Live-only metadata: Task 2, Task 5, Task 6, Task 7.
  - `.lightfast` special case: Task 5, Task 6, Task 7.
  - Register-only, no scan: Task 6 inserts one watch row and queues no jobs.
  - Disabled already-added rows and idempotent API: Task 6 and Task 7.
  - Manage GitHub access via live `html_url`: Task 2, Task 3, Task 6, Task 7.
  - Member-readable/admin-only mutations: Task 6 and Task 7.
  - Nonblocking repository list errors: Task 6 and Task 7.
  - Fetch all pages and client-side search: Task 2, Task 5, Task 7.
  - Existing settings component, no new route: Task 7.
  - No connected-org `+`: Task 7.
  - Manual refresh only: Task 7.
  - Durable imported count: Task 5 and Task 6.
  - No removal/reconciliation v1: No implementation task; tracked in spec and issue #747.
  - Installation account mismatch as broken: Task 6.
- Placeholder scan: no placeholder sections are intentionally left for implementers.
- Type consistency:
  - API response uses `organization.installationManageUrl`, `repositories`, `repositoriesError`, and `status`.
  - Mutation input is `importRepository({ repositoryId })`.
  - Repository rows use `owner: { id, login }`, `private`, `imported`, and `watchedPathGlobs`.
