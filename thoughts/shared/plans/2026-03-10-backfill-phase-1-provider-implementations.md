# Backfill Phase 1: Provider API + Backfill Implementations

## Overview

Create typed API definitions (with Zod response schemas) and backfill entity handlers for GitHub and Vercel. Add stub implementations for Linear and Sentry. Move adapter logic from `console-backfill` into `console-providers`. Move adapter tests.

## Parent Plan

This is Phase 1 of the Backfill Provider Unification plan. Depends on Phase 0 (Zod type foundations).

## Current State Analysis

- Phase 0 added `ProviderApi`, `BackfillDef`, and supporting types to `define.ts`
- All four providers have temporary stub `api` and `backfill` fields
- GitHub and Vercel backfill logic lives in `@repo/console-backfill`:
  - Connectors: `packages/console-backfill/src/connectors/github.ts`, `connectors/vercel.ts`
  - Adapters: `packages/console-backfill/src/adapters/github.ts`, `adapters/vercel.ts`
- Linear and Sentry have no backfill support
- `parseGitHubRateLimit` takes `Record<string, string>`, `parseVercelRateLimit` takes `Headers` — will unify to `Headers`

### `providerResourceId` / `resourceName` Semantics

| Provider | `providerResourceId` | `resourceName` |
|---|---|---|
| GitHub | Numeric repo ID (e.g., `"123456789"`) | `"owner/repo"` (e.g., `"lightfastai/lightfast"`) |
| Vercel | Vercel project ID (e.g., `"prj_abc123"`) | Project display name (e.g., `"My App"`) |
| Linear | Linear team ID (UUID) | Team display name (e.g., `"Engineering"`) |
| Sentry | Sentry numeric project ID (e.g., `"12345678"`) | Project display name — **changes to `"orgSlug/projectSlug"` in Phase 5** |

## Desired End State

After this phase:
1. Each provider has an `api.ts` file with response schemas, rate limit parser, and `ProviderApi` definition
2. GitHub and Vercel have `backfill.ts` files with full entity handler implementations
3. Linear and Sentry have `backfill.ts` stubs (empty `entityTypes`)
4. Provider stubs from Phase 0 are replaced with real `api` and `backfill` imports
5. Adapter tests moved from `console-backfill` to `console-providers`

## What We're NOT Doing

- Changing gateway or backfill app code (Phase 2-3)
- Implementing Linear or Sentry backfill logic (Phase 4-5)
- Deleting `console-backfill` (Phase 6)
- Defining comprehensive response schemas for all API fields — only fields we consume, with `.passthrough()`

## Changes Required

### 1. Create GitHub API definition with response schemas

**File**: `packages/console-providers/src/providers/github/api.ts` (NEW)
**Changes**: Define response schemas, `parseGitHubRateLimit`, and `githubApi: ProviderApi`.

```typescript
import { z } from "zod";
import type { ProviderApi, RateLimit } from "../../define";

// ── Response Schemas ────────────────────────────────────────────────────────────

export const githubUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string().optional(),
  html_url: z.string().optional(),
}).passthrough();

export const githubPullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  state: z.string(),
  body: z.string().nullable(),
  user: githubUserSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  merged_at: z.string().nullable(),
  merged: z.boolean().optional(),
  html_url: z.string(),
  head: z.object({ ref: z.string(), sha: z.string() }).passthrough(),
  base: z.object({ ref: z.string(), sha: z.string() }).passthrough(),
}).passthrough();

export const githubIssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  state: z.string(),
  body: z.string().nullable(),
  user: githubUserSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  html_url: z.string(),
  pull_request: z.unknown().optional(),
  labels: z.array(z.object({ name: z.string() }).passthrough()).optional(),
}).passthrough();

export const githubReleaseSchema = z.object({
  id: z.number(),
  tag_name: z.string(),
  name: z.string().nullable(),
  body: z.string().nullable(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  author: githubUserSchema.nullable(),
  created_at: z.string(),
  published_at: z.string().nullable(),
  html_url: z.string(),
}).passthrough();

// ── Rate Limit Parser ───────────────────────────────────────────────────────────

export function parseGitHubRateLimit(headers: Headers): RateLimit | null {
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  const limit = headers.get("x-ratelimit-limit");
  if (!remaining || !reset || !limit) return null;
  const r = parseInt(remaining, 10);
  const s = parseInt(reset, 10);
  const l = parseInt(limit, 10);
  if (Number.isNaN(r) || Number.isNaN(s) || Number.isNaN(l)) return null;
  return { remaining: r, resetAt: new Date(s * 1000), limit: l };
}

// ── API Definition ──────────────────────────────────────────────────────────────

export const githubApi: ProviderApi = {
  baseUrl: "https://api.github.com",
  defaultHeaders: { Accept: "application/vnd.github.v3+json" },
  parseRateLimit: parseGitHubRateLimit,
  endpoints: {
    "list-pull-requests": {
      method: "GET",
      path: "/repos/{owner}/{repo}/pulls",
      description: "List pull requests for a repository",
      responseSchema: z.array(githubPullRequestSchema),
    },
    "list-issues": {
      method: "GET",
      path: "/repos/{owner}/{repo}/issues",
      description: "List issues for a repository (includes PRs — filter client-side)",
      responseSchema: z.array(githubIssueSchema),
    },
    "list-releases": {
      method: "GET",
      path: "/repos/{owner}/{repo}/releases",
      description: "List releases for a repository",
      responseSchema: z.array(githubReleaseSchema),
    },
  },
} as const;
```

Note: `parseGitHubRateLimit` signature changes from `(headers: Record<string, string>)` to `(headers: Headers)` — using `.get()` for case-insensitive access.

### 2. Create GitHub backfill definition

**File**: `packages/console-providers/src/providers/github/backfill.ts` (NEW)
**Changes**: Move logic from `console-backfill/connectors/github.ts` (URL building, pagination logic, client-side filtering) and `console-backfill/adapters/github.ts` (response adaptation) into entity handlers.

Exports:
- `githubBackfill: BackfillDef`
- `adaptGitHubPRForTransformer`, `adaptGitHubIssueForTransformer`, `adaptGitHubReleaseForTransformer` — re-exported for tests

Key differences from current connectors:
- No `fetch()` calls — `buildRequest` just returns params, gateway handles the HTTP call
- No `accessToken` — not in `BackfillContext`, gateway handles auth
- `processResponse` replaces the connector's post-fetch processing: filtering, adaptation, cursor calculation

Entity handler implementations follow the exact pagination logic from the existing connectors:
- `pull_request`: page-number cursor (`{ page: N }`), GitHub `resourceName` is `"owner/repo"` — split on `"/"` to get `pathParams`. Terminates when `items.length < 100 || filtered.length < items.length`. Query params: `state=all`, `sort=updated`, `direction=desc`, `per_page=100`.
- `issue`: page-number cursor, server-side `since` filter via query param, client-side filter removes items with `pull_request` key present. Query params: `state=all`, `sort=updated`, `direction=desc`, `per_page=100`, `since=ctx.since`.
- `release`: page-number cursor, client-side time filter on `published_at ?? created_at`. Query params: `per_page=100`.

Source files to port from:
- `packages/console-backfill/src/connectors/github.ts:85-257` (pagination logic)
- `packages/console-backfill/src/adapters/github.ts:24-76` (adapter functions)

### 3. Create Vercel API definition with response schemas

**File**: `packages/console-providers/src/providers/vercel/api.ts` (NEW)

```typescript
import { z } from "zod";
import type { ProviderApi, RateLimit } from "../../define";

// ── Response Schemas ────────────────────────────────────────────────────────────

export const vercelDeploymentSchema = z.object({
  uid: z.string(),
  name: z.string(),
  url: z.string().optional(),
  created: z.number(),
  readyState: z.string().optional(),
  state: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
  creator: z.object({ uid: z.string() }).passthrough().optional(),
  projectId: z.string().optional(),
}).passthrough();

export const vercelDeploymentsResponseSchema = z.object({
  deployments: z.array(vercelDeploymentSchema),
  pagination: z.object({
    count: z.number(),
    next: z.number().nullable(),
    prev: z.number().nullable(),
  }),
});

// ── Rate Limit Parser ───────────────────────────────────────────────────────────

export function parseVercelRateLimit(headers: Headers): RateLimit | null {
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  const limit = headers.get("x-ratelimit-limit");
  if (!remaining || !reset || !limit) return null;
  const r = parseInt(remaining, 10);
  const s = parseInt(reset, 10);
  const l = parseInt(limit, 10);
  if (Number.isNaN(r) || Number.isNaN(s) || Number.isNaN(l)) return null;
  return { remaining: r, resetAt: new Date(s * 1000), limit: l };
}

// ── API Definition ──────────────────────────────────────────────────────────────

export const vercelApi: ProviderApi = {
  baseUrl: "https://api.vercel.com",
  parseRateLimit: parseVercelRateLimit,
  endpoints: {
    "list-deployments": {
      method: "GET",
      path: "/v6/deployments",
      description: "List deployments for a project",
      responseSchema: vercelDeploymentsResponseSchema,
    },
  },
} as const;
```

### 4. Create Vercel backfill definition

**File**: `packages/console-providers/src/providers/vercel/backfill.ts` (NEW)
**Changes**: Move logic from `console-backfill/connectors/vercel.ts` and `console-backfill/adapters/vercel.ts`.

Exports:
- `vercelBackfill: BackfillDef`
- `adaptVercelDeploymentForTransformer` — re-exported for tests

Entity handler for `deployment`:
- Timestamp cursor (`number`), `providerResourceId` is the Vercel project ID — passed directly as `projectId` query param. Terminates when `pagination.next === null || filtered.length < deployments.length`.
- Client-side filter: `deployment.created >= sinceTimestamp` (where `sinceTimestamp = new Date(ctx.since).getTime()`)
- Query params: `projectId={providerResourceId}`, `limit=100`, `until={cursor}` (cursor is `pagination.next` timestamp)
- Adapter maps `readyState` to event type (e.g., `READY` → `deployment.succeeded`)

Source files to port from:
- `packages/console-backfill/src/connectors/vercel.ts:66-132` (pagination logic)
- `packages/console-backfill/src/adapters/vercel.ts:21-84` (adapter function + readyState mapping)

### 5. Add Linear API definition

**File**: `packages/console-providers/src/providers/linear/api.ts` (NEW)

```typescript
import { z } from "zod";
import type { ProviderApi, RateLimit } from "../../define";

export function parseLinearRateLimit(headers: Headers): RateLimit | null {
  const remaining = headers.get("x-ratelimit-requests-remaining");
  const reset = headers.get("x-ratelimit-requests-reset");
  const limit = headers.get("x-ratelimit-requests-limit");
  if (!remaining || !reset || !limit) return null;
  const r = parseInt(remaining, 10);
  const s = parseInt(reset, 10); // Linear returns UTC epoch MILLISECONDS
  const l = parseInt(limit, 10);
  if (Number.isNaN(r) || Number.isNaN(s) || Number.isNaN(l)) return null;
  return { remaining: r, resetAt: new Date(s), limit: l }; // s is already in ms
}

export const graphqlResponseSchema = z.object({
  data: z.unknown(),
  errors: z.array(z.object({
    message: z.string(),
    locations: z.array(z.object({ line: z.number(), column: z.number() })).optional(),
    path: z.array(z.union([z.string(), z.number()])).optional(),
  })).optional(),
});

export const linearApi: ProviderApi = {
  baseUrl: "https://api.linear.app",
  defaultHeaders: { "Content-Type": "application/json" },
  parseRateLimit: parseLinearRateLimit,
  endpoints: {
    graphql: {
      method: "POST",
      path: "/graphql",
      description: "Linear GraphQL API",
      responseSchema: graphqlResponseSchema,
    },
  },
} as const;
```

**File**: `packages/console-providers/src/providers/linear/backfill.ts` (NEW)
```typescript
import type { BackfillDef } from "../../define";

// Stub — full implementation in Phase 4
export const linearBackfill: BackfillDef = {
  supportedEntityTypes: [],
  defaultEntityTypes: [],
  entityTypes: {},
} as const;
```

### 6. Add Sentry API definition

**File**: `packages/console-providers/src/providers/sentry/api.ts` (NEW)

```typescript
import { z } from "zod";
import type { ProviderApi, RateLimit } from "../../define";
import { decodeSentryToken } from "./auth";

export function parseSentryRateLimit(headers: Headers): RateLimit | null {
  const remaining = headers.get("x-sentry-rate-limit-remaining");
  const limit = headers.get("x-sentry-rate-limit-limit");
  const reset = headers.get("x-sentry-rate-limit-reset");
  if (!remaining || !limit || !reset) return null;
  const r = parseInt(remaining, 10);
  const l = parseInt(limit, 10);
  const s = parseFloat(reset); // UTC epoch SECONDS
  if (Number.isNaN(r) || Number.isNaN(l) || Number.isNaN(s)) return null;
  return { remaining: r, limit: l, resetAt: new Date(s * 1000) };
}

export const sentryApi: ProviderApi = {
  baseUrl: "https://sentry.io",
  buildAuthHeader: (token) => `Bearer ${decodeSentryToken(token).token}`,
  parseRateLimit: parseSentryRateLimit,
  endpoints: {},
} as const;
```

**File**: `packages/console-providers/src/providers/sentry/backfill.ts` (NEW)
```typescript
import type { BackfillDef } from "../../define";

// Stub — full implementation in Phase 5
export const sentryBackfill: BackfillDef = {
  supportedEntityTypes: [],
  defaultEntityTypes: [],
  entityTypes: {},
} as const;
```

### 7. Replace stubs with real imports in provider definitions

**File**: `packages/console-providers/src/providers/github/index.ts`
**Changes**: Import `githubApi` from `./api` and `githubBackfill` from `./backfill`. Replace the Phase 0 stub with `api: githubApi` and `backfill: githubBackfill`.

**File**: `packages/console-providers/src/providers/vercel/index.ts`
**Changes**: Import `vercelApi` from `./api` and `vercelBackfill` from `./backfill`. Replace stub with `api: vercelApi` and `backfill: vercelBackfill`.

**File**: `packages/console-providers/src/providers/linear/index.ts`
**Changes**: Import `linearApi` from `./api` and `linearBackfill` from `./backfill`. Replace stub with `api: linearApi` and `backfill: linearBackfill`.

**File**: `packages/console-providers/src/providers/sentry/index.ts`
**Changes**: Import `sentryApi` from `./api` and `sentryBackfill` from `./backfill`. Replace stub with `api: sentryApi` and `backfill: sentryBackfill`.

### 8. Export response schemas and parsers from barrel

**File**: `packages/console-providers/src/index.ts`
**Changes**: Add exports for provider-specific API artifacts:

```typescript
// GitHub API
export { parseGitHubRateLimit, githubPullRequestSchema, githubIssueSchema, githubReleaseSchema, githubUserSchema } from "./providers/github/api";

// Vercel API
export { parseVercelRateLimit, vercelDeploymentSchema, vercelDeploymentsResponseSchema } from "./providers/vercel/api";

// Linear API
export { parseLinearRateLimit, graphqlResponseSchema } from "./providers/linear/api";

// Sentry API
export { parseSentryRateLimit } from "./providers/sentry/api";
```

### 9. Move adapter tests

**Files**: Move test files from `console-backfill` into `console-providers`:
- `packages/console-backfill/src/adapters/github.test.ts` → `packages/console-providers/src/providers/github/backfill.test.ts`
- `packages/console-backfill/src/adapters/vercel.test.ts` → `packages/console-providers/src/providers/vercel/backfill.test.ts`
- `packages/console-backfill/src/adapters/round-trip.test.ts` → `packages/console-providers/src/providers/github/backfill-round-trip.test.ts`

Update imports to use the new paths. Test logic stays identical.

## Success Criteria

### Automated Verification:
- [x] `pnpm --filter @repo/console-providers typecheck` passes
- [x] `pnpm --filter @repo/console-providers test` passes (including moved adapter tests)
- [x] Existing `console-backfill` tests still pass (they still exist at this point)
- [x] `pnpm typecheck` passes across ALL packages (integration-tests failures are pre-existing, unrelated to these changes)

### Manual Verification:
- [ ] Verify the `BackfillEntityHandler` implementations produce identical output as the existing connectors (round-trip tests cover this)
- [ ] Verify adapter functions produce identical output as before

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 2.

## References

- GitHub connector: `packages/console-backfill/src/connectors/github.ts`
- Vercel connector: `packages/console-backfill/src/connectors/vercel.ts`
- GitHub adapters: `packages/console-backfill/src/adapters/github.ts`
- Vercel adapters: `packages/console-backfill/src/adapters/vercel.ts`
- Round-trip tests: `packages/console-backfill/src/adapters/round-trip.test.ts`
