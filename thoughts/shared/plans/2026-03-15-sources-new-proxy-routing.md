---
date: 2026-03-15
status: ready
---

# Plan: Route sources/new provider API calls through gateway proxy

## Problem

`api/console/src/router/org/connections.ts` calls provider APIs directly from the tRPC server — fetching tokens from `gw_tokens` DB and issuing raw `fetch` calls to GitHub/Vercel/Linear/Sentry. The gateway proxy (`/connections/:id/proxy/execute`) exists and should own all provider API calls.

## Scope

- 3 provider `api.ts` files need new listing endpoints (Linear already has `graphql`)
- 6 tRPC procedures need to drop direct `fetch` / Octokit calls and use `gw.executeApi()` instead

---

## Step 1 — Add listing endpoints to provider catalogs

### `packages/console-providers/src/providers/github/api.ts`

Add to `endpoints`:

```ts
"list-installation-repos": {
  method: "GET",
  path: "/installation/repositories",
  description: "List repositories accessible to the GitHub App installation",
  responseSchema: z.object({
    total_count: z.number(),
    repositories: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        full_name: z.string(),
        private: z.boolean(),
        description: z.string().nullable(),
        default_branch: z.string(),
        archived: z.boolean(),
        html_url: z.string(),
        language: z.string().nullable().optional(),
        stargazers_count: z.number().optional(),
        updated_at: z.string().nullable().optional(),
        owner: z.object({ login: z.string() }).passthrough(),
      }).passthrough()
    ),
  }),
},
```

Note: GitHub has `usesStoredToken: false` — the gateway calls `getActiveToken(config, externalId, null)` which generates a fresh installation token via the App JWT. No DB token needed.

### `packages/console-providers/src/providers/vercel/api.ts`

Add to `endpoints`:

```ts
"list-projects": {
  method: "GET",
  path: "/v9/projects",
  description: "List Vercel projects for a team or personal account",
  responseSchema: z.object({
    projects: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        framework: z.string().nullable().optional(),
        updatedAt: z.number().optional(),
      }).passthrough()
    ),
    pagination: z.object({
      count: z.number(),
      next: z.number().nullable(),
      prev: z.number().nullable(),
    }),
  }),
},
```

### `packages/console-providers/src/providers/sentry/api.ts`

Add to `endpoints`:

```ts
"list-projects": {
  method: "GET",
  path: "/api/0/projects/",
  description: "List all projects in the Sentry organization",
  responseSchema: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      platform: z.string().nullable().optional(),
      status: z.string().optional(),
      organization: z.object({ slug: z.string() }).passthrough(),
    }).passthrough()
  ),
},
"list-organizations": {
  method: "GET",
  path: "/api/0/organizations/",
  description: "List Sentry organizations (used to resolve org display name)",
  responseSchema: z.array(
    z.object({
      name: z.string().optional(),
      slug: z.string().optional(),
    }).passthrough()
  ),
},
```

### Linear — no change needed

The `graphql` endpoint already handles both `linear.get` (viewer org query) and `linear.listTeams`.

---

## Step 2 — Update the 6 tRPC procedures in `connections.ts`

The pattern for each:
1. Remove `getInstallationToken(installation.id)` call
2. Replace `fetch(...)` or Octokit call with `gw.executeApi(installation.id, { endpointId, ... })`
3. Check `result.status === 401` instead of `response.status === 401` (gateway wraps provider status in the body, returns HTTP 200)
4. Use `result.data` instead of `response.json()`

Create `gw` once per procedure (or once per sub-router if refactoring):
```ts
const gw = createGatewayClient({
  apiKey: env.GATEWAY_API_KEY,
  requestSource: "console-trpc",
  correlationId: crypto.randomUUID(),
});
```

### `github.repositories` (line 367)

**Remove:** `getGitHubApp()`, `getInstallationRepositories(app, installationIdNumber)`
**Add:**
```ts
const result = await gw.executeApi(input.integrationId, {
  endpointId: "list-installation-repos",
});
if (result.status !== 200) {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch repositories from GitHub" });
}
const data = result.data as { repositories: Array<...> };
return data.repositories.map((repo) => ({
  id: repo.id.toString(),
  name: repo.name,
  fullName: repo.full_name,
  owner: repo.owner.login,
  description: repo.description,
  defaultBranch: repo.default_branch,
  isPrivate: repo.private,
  isArchived: repo.archived,
  url: repo.html_url,
  language: repo.language ?? null,
  stargazersCount: repo.stargazers_count ?? 0,
  updatedAt: repo.updated_at ?? null,
}));
```

Note: The 401 case does not apply here since GitHub uses App JWT (no stored token to expire). Non-200 is an internal error.

### `vercel.listProjects` (line 720)

**Remove:** `getInstallationToken`, `new URL(...)`, `fetch(url, ...)`, manual `teamId` extraction
**Add:**
```ts
const gw = createGatewayClient({ ... });
const queryParams: Record<string, string> = { limit: "100" };
// teamId still comes from providerAccountInfo — that DB read stays
const teamId = providerAccountInfo.raw.team_id;
if (teamId) queryParams.teamId = teamId;
if (input.cursor) queryParams.until = input.cursor;

const result = await gw.executeApi(installation.id, {
  endpointId: "list-projects",
  queryParams,
});

if (result.status === 401) {
  await ctx.db.update(gwInstallations).set({ status: "error" }).where(eq(gwInstallations.id, input.installationId));
  throw new TRPCError({ code: "UNAUTHORIZED", message: "Vercel connection expired. Please reconnect." });
}
if (result.status !== 200) {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch Vercel projects" });
}
const data = result.data as VercelProjectsResponse;
// ... rest of the procedure (isConnected join) stays unchanged
```

Note: `providerAccountInfo` is still read from the DB (it's not a provider API call — it's data we stored at OAuth time). Only the `fetch` to Vercel is replaced.

### `linear.get` (line 859)

**Remove:** `getInstallationToken`, `fetch("https://api.linear.app/graphql", ...)`
**Add:**
```ts
const gw = createGatewayClient({ ... });
const result = await gw.executeApi(installation.id, {
  endpointId: "graphql",
  body: { query: "{ viewer { organization { name urlKey } } }" },
});
if (result.status === 401) {
  await ctx.db.update(gwInstallations).set({ status: "error" }).where(...);
} else if (result.status === 200) {
  const gqlData = result.data as { data?: { viewer?: { organization?: { name?: string; urlKey?: string } } } };
  organizationName = gqlData.data?.viewer?.organization?.name ?? null;
  organizationUrlKey = gqlData.data?.viewer?.organization?.urlKey ?? null;
}
```

### `linear.listTeams` (line 935)

**Remove:** `getInstallationToken`, `fetch("https://api.linear.app/graphql", ...)`
**Add:**
```ts
const gw = createGatewayClient({ ... });
const result = await gw.executeApi(installation.id, {
  endpointId: "graphql",
  body: { query: `{ teams { nodes { id name key description color } } }` },
});
if (result.status === 401) {
  await ctx.db.update(gwInstallations).set({ status: "error" }).where(...);
  throw new TRPCError({ code: "UNAUTHORIZED", message: "Linear connection expired. Please reconnect." });
}
if (result.status !== 200) {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch Linear teams" });
}
const data = result.data as { data?: { teams?: { nodes?: [...] } } };
```

### `sentry.get` (line 1042)

**Remove:** `getInstallationToken`, `fetch("https://sentry.io/api/0/organizations/", ...)`
**Add:**
```ts
const gw = createGatewayClient({ ... });
const result = await gw.executeApi(installation.id, {
  endpointId: "list-organizations",
});
if (result.status === 401) {
  await ctx.db.update(gwInstallations).set({ status: "error" }).where(...);
} else if (result.status === 200) {
  const orgs = result.data as Array<{ name?: string; slug?: string }>;
  const org = orgs[0];
  if (org) {
    organizationName = org.name ?? null;
    organizationSlug = org.slug ?? null;
  }
}
```

### `sentry.listProjects` (line 1114)

**Remove:** `getInstallationToken`, `fetch("https://sentry.io/api/0/projects/", ...)`
**Add:**
```ts
const gw = createGatewayClient({ ... });
const result = await gw.executeApi(installation.id, {
  endpointId: "list-projects",
});
if (result.status === 401) {
  await ctx.db.update(gwInstallations).set({ status: "error" }).where(...);
  throw new TRPCError({ code: "UNAUTHORIZED", message: "Sentry connection expired. Please reconnect." });
}
if (result.status !== 200) {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch Sentry projects" });
}
const data = result.data as Array<{ id, slug, name, platform, status, organization: { slug } }>;
// isConnected join stays unchanged
```

---

## Step 3 — Clean up `connections.ts` imports

After the migration, these imports can be removed (if nothing else uses them):
- `getInstallationToken` from `../../lib/token-vault`
- `getInstallationRepositories`, `createGitHubApp` from `@repo/console-octokit-github`
- `VercelProjectsResponse` from `@repo/console-vercel/types` (unless kept for the type cast)

---

## Key points

**401 handling changes:** Currently `response.status === 401` checks a raw HTTP status. After migration, the gateway returns HTTP 200 with `{ status: 401, data, headers }` in the body — so checks become `result.status === 401`.

**Vercel `providerAccountInfo` stays:** The `teamId` extraction from `installation.providerAccountInfo` is a DB read, not a provider API call. It stays as-is.

**Vercel + Sentry `isConnected`:** The `workspaceIntegrations` DB join to compute `isConnected` is domain logic that stays in the tRPC layer.

**GitHub pagination:** `getInstallationRepositories` auto-paginates internally. The gateway proxy sends a single `GET /installation/repositories` — GitHub defaults to 30 items per page. If pagination is needed, add `per_page=100` as a query param. The endpoint supports `GET /installation/repositories?per_page=100`.

**File count:** 3 `api.ts` files + 1 `connections.ts` = 4 files total.
