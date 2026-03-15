---
date: 2026-03-14T23:16:38+00:00
researcher: claude
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "How sources/new fetches repo/project names + what's needed to route through gateway proxy"
tags: [research, codebase, sources, gateway, proxy, connections, trpc, providers]
status: complete
last_updated: 2026-03-15
---

# Research: sources/new Data Fetching + Gateway Proxy Migration Path

**Date**: 2026-03-14T23:16:38+00:00
**Git Commit**: `4ec3c541776200e318c670c5064af752d9e142f0`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

How does the sources/new page fetch repository/project names for each provider, and what needs to change to route those fetches through the gateway proxy (`/connections/:id/proxy/execute`) instead of calling provider APIs directly from the tRPC server?

## Summary

The resource picker in `sources/new` (repos, projects, teams) flows through tRPC procedures in `api/console/src/router/org/connections.ts` that call each provider API **directly** — no request ever reaches the gateway proxy. To migrate, listing endpoints must be added to each provider's `api.endpoints` catalog and the tRPC procedures replaced with `proxy/execute` calls.

---

## Detailed Findings

### 1. UI Layer — sources/new

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/`

- `page.tsx:17-27` — prefetches connection status for all providers via tRPC, and workspace sources
- `_components/sources-section.tsx` — renders an `Accordion` with one `ProviderSourceItem` per provider
- `_components/provider-source-item.tsx:138-160` — issues `useQuery` / `useQueries` for resources via `adapter.getResourceQueryOptions(trpc, installationId, externalId)`
- `_components/adapters.ts` — per-provider adapter objects wiring tRPC query options + data normalization

### 2. Adapter → tRPC Mapping

`adapters.ts` maps each provider to a tRPC procedure for resources:

| Provider | `getResourceQueryOptions` call | tRPC key params |
|---|---|---|
| GitHub | `trpc.connections.github.repositories.queryOptions({ integrationId, installationId })` | `integrationId` = `gwInstallations.id`, `installationId` = GitHub numeric ID |
| Vercel | `trpc.connections.vercel.listProjects.queryOptions({ installationId })` | `installationId` = `gwInstallations.id` |
| Linear | `trpc.connections.linear.listTeams.queryOptions({ installationId })` | `installationId` = `gwInstallations.id` |
| Sentry | `trpc.connections.sentry.listProjects.queryOptions({ installationId })` | `installationId` = `gwInstallations.id` |

### 3. tRPC Procedures — Direct Provider API Calls

All four are in `api/console/src/router/org/connections.ts`.

#### GitHub repositories (`connections.ts:367`)
- **Auth**: Octokit `App` instance built from `env.GITHUB_APP_ID` + `env.GITHUB_APP_PRIVATE_KEY` via `createGitHubApp()` (line 406)
- **Call**: `getInstallationRepositories(app, installationIdNumber)` from `@repo/console-octokit-github` (line 412)
  - Internally calls `app.getInstallationOctokit(id)` → `GET https://api.github.com/installation/repositories`
- **`getInstallationToken()` is NOT used** — GitHub uses App JWT
- **Returns**: `id, name, fullName, owner, description, defaultBranch, isPrivate, isArchived, url, language, stargazersCount, updatedAt`

#### Vercel projects (`connections.ts:720`)
- **Auth**: `getInstallationToken(installation.id)` → reads + decrypts `gw_tokens` DB row directly
- **Call**: `fetch("https://api.vercel.com/v9/projects?teamId=...&limit=100", { Authorization: Bearer <token> })`
- **Response type**: `VercelProjectsResponse` from `@repo/console-vercel/types`
- **Returns**: `id, name, framework, updatedAt, isConnected`; also `pagination` for cursor-based paging

#### Linear teams (`connections.ts:935`)
- **Auth**: `getInstallationToken(installation.id)` → reads + decrypts `gw_tokens` DB row directly
- **Call**: `fetch("https://api.linear.app/graphql", { method: POST, body: { query: "{ teams { nodes { id name key description color } } }" } })`
- **Returns**: `id, name, key, description, color`

#### Sentry projects (`connections.ts:1114`)
- **Auth**: `getInstallationToken(installation.id)` → reads + decrypts `gw_tokens` DB row directly
- **Call**: `fetch("https://sentry.io/api/0/projects/", { Authorization: Bearer <token> })`
- **Returns**: `id, slug, name, platform, organizationSlug, isConnected`

### 4. Token Retrieval: `getInstallationToken`

**File**: `api/console/src/lib/token-vault.ts:11-23`

Used by Vercel, Linear, Sentry (not GitHub). Steps:
1. Queries `gwTokens` table via Drizzle: `WHERE installationId = ?`
2. Reads encrypted `accessToken` column
3. Calls `decrypt(token.accessToken, env.ENCRYPTION_KEY)` from `@repo/lib`
4. Returns plaintext bearer token

This is a **local DB read** — no HTTP call to the gateway service.

### 5. Gateway Proxy — Current State

**File**: `apps/gateway/src/routes/connections.ts:741`

The `POST /connections/:id/proxy/execute` route:
- Looks up `providerDef.api.endpoints[body.endpointId]` to validate the requested endpoint
- Handles auth injection via `getActiveTokenForInstallation` (same logic as token-vault but inside gateway)
- Returns raw `{ status, data, headers }` — no domain knowledge

**Currently registered endpoints** per provider (`packages/console-providers/src/providers/<provider>/api.ts`):

| Provider | Registered endpoint IDs | Covers listing? |
|---|---|---|
| GitHub | `list-pull-requests`, `list-issues`, `list-releases` | **No** — no repo listing endpoint |
| Vercel | `list-deployments` | **No** — no project listing endpoint |
| Linear | `graphql` (generic POST `/graphql`) | **Partial** — generic enough to accept a teams query body |
| Sentry | `list-org-issues`, `list-events` | **No** — no project listing endpoint |

---

## What's Needed to Route Through the Proxy

### Step 1: Add listing endpoints to provider API catalogs

Each provider's `api.endpoints` in `packages/console-providers/src/providers/<provider>/api.ts` needs a new entry:

| Provider | New endpoint ID | Method | Path |
|---|---|---|---|
| GitHub | `list-installation-repos` | GET | `/installation/repositories` |
| Vercel | `list-projects` | GET | `/v9/projects` |
| Linear | already has `graphql` | POST | `/graphql` |
| Sentry | `list-projects` | GET | `/api/0/projects/` |

Note: GitHub's endpoint uses the App-JWT-authenticated route (`/installation/repositories`), which the gateway already handles via `getActiveToken` — the `usesStoredToken` flag on GitHub's oauth definition controls whether `gwTokens` is consulted.

### Step 2: Replace tRPC procedure bodies

Each procedure in `connections.ts` currently:
1. Fetches token from DB via `getInstallationToken`
2. Calls provider API directly via `fetch` or Octokit

After migration:
1. Create `createGatewayClient(...)` instance
2. Call `gw.proxyExecute(installationId, { endpointId, queryParams, body })` or equivalent
3. Parse the raw `{ status, data }` response

### Step 3: GitHub special case

GitHub doesn't use a stored OAuth token — the gateway's `getActiveToken` calls the GitHub API to generate a short-lived installation token using the App JWT. The `usesStoredToken` flag (`false` for GitHub) already signals this to `getActiveTokenForInstallation`. Adding the `list-installation-repos` endpoint to the catalog is sufficient — no special handling needed in the gateway.

---

## Code References

- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/adapters.ts:77-80` — GitHub adapter's `getResourceQueryOptions`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/adapters.ts:123-124` — Vercel adapter's `getResourceQueryOptions`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/adapters.ts:158-159` — Linear adapter's `getResourceQueryOptions`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/adapters.ts:197-198` — Sentry adapter's `getResourceQueryOptions`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/provider-source-item.tsx:138-160` — resource query issuance
- `api/console/src/router/org/connections.ts:367` — `connections.github.repositories`
- `api/console/src/router/org/connections.ts:720` — `connections.vercel.listProjects`
- `api/console/src/router/org/connections.ts:935` — `connections.linear.listTeams`
- `api/console/src/router/org/connections.ts:1114` — `connections.sentry.listProjects`
- `api/console/src/lib/token-vault.ts:11-23` — `getInstallationToken` (DB decrypt, no gateway HTTP call)
- `apps/gateway/src/routes/connections.ts:741` — `POST /connections/:id/proxy/execute`
- `apps/gateway/src/routes/connections.ts:696` — `GET /connections/:id/proxy/endpoints` (catalog introspection)
- `packages/console-providers/src/providers/github/api.ts:84-109` — GitHub endpoint catalog
- `packages/console-providers/src/providers/vercel/api.ts:49-60` — Vercel endpoint catalog
- `packages/console-providers/src/providers/linear/api.ts:41-53` — Linear endpoint catalog
- `packages/console-providers/src/providers/sentry/api.ts:118-137` — Sentry endpoint catalog

## Open Questions

- Should the tRPC `connections.*` procedures still exist after proxy migration, or should the UI call the gateway proxy directly (e.g. via a new tRPC wrapper that calls `proxy/execute`)?
- Vercel's `listProjects` currently paginates with a cursor and also computes `isConnected` via a DB join — this domain logic cannot live in the gateway proxy and would need to stay in the tRPC layer (wrapping the proxy call).
- Sentry's `buildAuthHeader` uses `decodeSentryToken` to unpack a composite stored token — this already lives inside the gateway, so Sentry proxy routing should work correctly once the endpoint is registered.
