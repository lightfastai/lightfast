# Backfill Provider Unification v3 — Gateway API Proxy Architecture

## Overview

Redesign the backfill architecture around two independent infrastructure layers:

1. **Gateway as a generic authenticated API proxy** — zero domain knowledge, zero backfill concerns. Any internal service can proxy provider API calls through gateway. Gateway handles auth injection, token refresh, and nothing else.

2. **Provider API surface as typed contracts** — every provider API endpoint registered in Lightfast declares its request shape AND response schema. The `ProviderApi` definition becomes the single source of truth for "what can I call and what will I get back."

Backfill becomes simply the first consumer of this proxy infrastructure. `@repo/console-backfill` is dissolved — its logic migrates into provider definitions in `@repo/console-providers`.

**Key architectural shifts from v2:**
- Gateway does NOT parse rate limits, does NOT return structured rate limit objects. It returns raw `{ status, data, headers }`.
- Each `ApiEndpoint` carries a `responseSchema: z.ZodType` — typed response contracts.
- `parseRateLimit` lives on `ProviderApi` (it's a property of the API, not backfill) but is consumed client-side by callers, never by gateway.
- Route paths use `/proxy/` namespace to make the proxy intent explicit.
- Response schemas use `.passthrough()` and define only the fields we consume — expanded incrementally.

## Current State Analysis

- **Gateway** and **relay** are fully provider-agnostic via `@repo/console-providers` using `ProviderDefinition.oauth` and `ProviderDefinition.webhook` respectively.
- **Backfill** uses a completely separate package `@repo/console-backfill` with:
  - Its own `BackfillConnector<TCursor>` interface (`types.ts:44-58`)
  - Its own imperative `Map<SourceType, BackfillConnector>` registry (`registry.ts`)
  - Provider-specific connectors (`connectors/github.ts`, `connectors/vercel.ts`) with fetch logic, pagination, rate-limit parsing
  - Provider-specific adapters (`adapters/github.ts`, `adapters/vercel.ts`) that convert REST API responses into webhook-shaped payloads
- Only GitHub and Vercel have backfill connectors. Linear and Sentry have no backfill support.
- The backfill app itself (`apps/backfill/`) is provider-agnostic — all provider logic is in `@repo/console-backfill`.
- Entity worker fetches tokens outside step boundaries for memoization safety (`entity-worker.ts:62`), handles 401 inline (`entity-worker.ts:118-148`).

### Key Discoveries:
- `BackfillConnector.fetchPage()` takes a `BackfillConfig` with `accessToken`, `installationId`, `provider`, `resource`, `since` (`packages/console-backfill/src/types.ts:24-42`)
- GitHub connector builds URLs with path params (`/repos/{owner}/{repo}/pulls`) and uses page-number pagination (`packages/console-backfill/src/connectors/github.ts:85-141`)
- Vercel connector uses timestamp-cursor pagination via `until` query param (`packages/console-backfill/src/connectors/vercel.ts:66-132`)
- Rate-limit parsing is provider-specific: GitHub uses `Record<string, string>`, Vercel uses `Headers` — will unify to `Headers`
- Gateway already builds provider configs at module level (`connections.ts:34-39`)
- Gateway already has `getActiveToken()` flow with refresh logic (`connections.ts:502-602`)
- Linear uses GraphQL API with cursor-based pagination (`first`, `after`, `pageInfo`)
- Sentry uses REST API with cursor-based pagination via `Link` headers and composite tokens (`installationId:token`)

## Desired End State

After this plan is complete:

1. `ProviderDefinition` has two new **required** fields: `api: ProviderApi` and `backfill: BackfillDef`
2. Each provider's `api.endpoints` declares API endpoints with **typed response schemas** (Zod)
3. Each provider's `backfill.entityTypes` declares backfill entity handlers with `buildRequest()` and `processResponse()`
4. Gateway exposes `GET /:id/proxy/endpoints` — returns the provider's API catalog (discovery)
5. Gateway exposes `POST /:id/proxy/execute` — pure authenticated proxy, returns `{ status, data, headers }`
6. Gateway has **zero** knowledge of rate limits, backfill, or response schemas — it's a dumb proxy
7. Backfill app calls gateway proxy, manages its own cursor/pagination loop, parses rate limits client-side
8. All four providers (GitHub, Vercel, Linear, Sentry) have backfill support
9. `@repo/console-backfill` package is deleted

### Verification:
- `pnpm typecheck` passes across all packages
- `pnpm check` passes (linting)
- All existing backfill tests pass after being updated
- `pnpm build:gateway` and `pnpm build:backfill` succeed
- No references to `console-backfill` remain in the codebase

## What We're NOT Doing

- Exposing the full provider API surface (hundreds of endpoints) — only the endpoints we need now
- Changing the Inngest workflow structure (orchestrator + entity worker pattern stays)
- Changing the relay dispatch path (backfill still dispatches through relay)
- Changing the `holdForReplay` / replay-catchup mechanism
- Moving backfill run tracking (stays in gateway)
- Adding public API access to the proxy (internal-only, requires X-API-Key)
- Building a generic pagination framework in gateway — pagination stays in backfill
- Defining comprehensive response schemas for all API fields — only fields we consume, with `.passthrough()`

## Architecture Design

### Layer 1: Provider API Surface (`ProviderApi`)

Each provider declares its available API endpoints as a typed catalog. This is **declarative metadata** — what endpoints exist, what they accept, and what they return. The gateway reads only `baseUrl`, `buildAuthHeader`, `defaultHeaders`, and `endpoints[id].{method, path, timeout}`. Everything else (response schemas, rate limit parsing) is consumed client-side by callers.

```typescript
// In define.ts

export interface ApiEndpoint {
  /** HTTP method */
  readonly method: "GET" | "POST";
  /** URL path template with {param} placeholders. Example: "/repos/{owner}/{repo}/pulls" */
  readonly path: string;
  /** Human-readable description */
  readonly description: string;
  /** Request timeout in ms. Default: 30_000 */
  readonly timeout?: number;
  /** Zod schema for the response body. Defines the typed contract for what this endpoint returns.
   *  Uses .passthrough() to allow extra fields beyond what we consume. */
  readonly responseSchema: z.ZodType;
}

export interface RateLimit {
  remaining: number;
  resetAt: Date;
  limit: number;
}

export interface ProviderApi {
  /** Base URL for the provider's API. Example: "https://api.github.com" */
  readonly baseUrl: string;
  /** Default headers for all API calls. Example: { "Accept": "application/vnd.github.v3+json" } */
  readonly defaultHeaders?: Record<string, string>;
  /** Build the Authorization header value from the active token.
   *  Default behavior (when omitted): `Bearer ${token}`.
   *  Override for providers with non-standard auth (e.g., Sentry composite tokens). */
  readonly buildAuthHeader?: (token: string) => string;
  /** Parse rate-limit info from response headers. Return null if not parseable.
   *  This is an API-level concern — consumed by callers, never by gateway. */
  readonly parseRateLimit: (headers: Headers) => RateLimit | null;
  /** Available API endpoints, keyed by a stable identifier */
  readonly endpoints: Record<string, ApiEndpoint>;
}
```

**Example — GitHub:**
```typescript
// github/api.ts
import { z } from "zod";
import type { ProviderApi, RateLimit } from "../../define";

// ── Response Schemas ────────────────────────────────────────────────────────────
// Define only the fields our consumers actually read. Use .passthrough() for extras.

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
  pull_request: z.unknown().optional(), // Presence indicates this is a PR, not an issue
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

**Example — Linear (GraphQL):**
```typescript
// linear/api.ts

// Generic GraphQL response envelope — query-specific schemas live with consumers
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

### Layer 2: Backfill Entity Handlers (`BackfillDef`)

Each provider declares HOW to use its API endpoints for historical data import. Entity handlers contain the business logic — URL building, response filtering, adaptation. They reference endpoints by `endpointId` and use the endpoint's `responseSchema` for type safety.

```typescript
// In define.ts

export interface BackfillWebhookEvent {
  /** Unique per event: "backfill-{installationId}-{entityType}-{itemId}" */
  deliveryId: string;
  /** Provider-specific event type, e.g. "pull_request", "issues", "deployment.succeeded" */
  eventType: string;
  /** Webhook-shaped payload from adapter — matches PreTransform* schemas */
  payload: unknown;
}

/** Per-request context for backfill fetching — NOT the provider's static config */
export interface BackfillContext {
  /** Gateway installation ID */
  installationId: string;
  /** Single resource for this work unit */
  resource: {
    providerResourceId: string;
    resourceName: string | null;
  };
  /** ISO timestamp = now - depth days */
  since: string;
}

/** How to backfill a single entity type using a provider API endpoint */
export interface BackfillEntityHandler {
  /** Which API endpoint to use from the provider's api.endpoints catalog */
  readonly endpointId: string;
  /** Build the request parameters for the gateway proxy.
   *  Called once per page. `cursor` is null for the first page. */
  buildRequest(ctx: BackfillContext, cursor: unknown): {
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: unknown;
  };
  /** Process the raw API response into webhook events + next cursor.
   *  Handles client-side time-window filtering and response adaptation.
   *  `responseHeaders` is provided for providers that need
   *  header-based pagination (e.g., Sentry's Link header cursors). */
  processResponse(
    data: unknown,
    ctx: BackfillContext,
    cursor: unknown,
    responseHeaders?: Record<string, string>
  ): {
    events: BackfillWebhookEvent[];
    nextCursor: unknown | null;
    rawCount: number;
  };
}

/** Backfill definition — required on every ProviderDefinition */
export interface BackfillDef {
  readonly supportedEntityTypes: readonly string[];
  readonly defaultEntityTypes: readonly string[];
  readonly entityTypes: Record<string, BackfillEntityHandler>;
}
```

### Layer 3: Gateway API Proxy (Pure Proxy)

Gateway exposes two generic routes. It has **zero domain knowledge** about rate limits, backfill, response schemas, or what consumers do with the data.

**`GET /connections/:id/proxy/endpoints`** — Returns the provider's API catalog.
- Looks up installation, resolves provider definition
- Returns `{ provider, baseUrl, endpoints }` from `providerDef.api`
- Strips `responseSchema` from the response (Zod types aren't serializable)
- Used for discovery/debugging

**`POST /connections/:id/proxy/execute`** — Proxies an API call with auth injection.
- Request body: `{ endpointId, pathParams?, queryParams?, body? }`
- Validates `endpointId` exists in the provider's catalog
- Gets active token via `getActiveTokenForInstallation()` (handles refresh internally)
- Builds URL from `api.baseUrl + endpoint.path` with pathParams + queryParams
- Injects `Authorization` header using `api.buildAuthHeader(token)` (defaults to `Bearer ${token}`)
- Adds `api.defaultHeaders`
- If POST with body: adds `Content-Type: application/json` and serializes body
- On 401 from provider: force-refreshes token and retries once
- Returns `{ status, data, headers }` — **raw** provider response + **raw** headers as `Record<string, string>`

**What the gateway does NOT do:**
- Parse rate limits
- Validate response data against schemas
- Return backfill-specific structures
- Know about entity types, cursors, or pagination

### Layer 4: Entity Worker Flow

The entity worker's pagination loop becomes:

```typescript
import { getProvider } from "@repo/console-providers";

const providerDef = getProvider(provider);
const entityHandler = providerDef.backfill.entityTypes[entityType];

// No token management — gateway handles it
// No connector resolution — entity handlers are in provider definitions

while (true) {
  const fetchResult = await step.run(`fetch-${entityType}-p${pageNum}`, async () => {
    const request = entityHandler.buildRequest(ctx, cursor);
    const raw = await gw.executeApi(installationId, {
      endpointId: entityHandler.endpointId,
      ...request,
    });
    if (raw.status !== 200) {
      const err = new Error(`Provider API returned ${raw.status}`);
      (err as any).status = raw.status;
      throw err;
    }
    const processed = entityHandler.processResponse(raw.data, ctx, cursor, raw.headers);
    // Parse rate limits client-side from raw headers
    const rateLimit = providerDef.api.parseRateLimit(new Headers(raw.headers));
    return {
      events: processed.events,
      nextCursor: processed.nextCursor,
      rawCount: processed.rawCount,
      rateLimit: rateLimit
        ? { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt.toISOString(), limit: rateLimit.limit }
        : null,
    };
  });

  // dispatch events to relay (unchanged)...
  // rate limit sleep (unchanged)...
  // pagination loop exit (unchanged)...
}
```

**Key simplifications vs current:**
- No `gw.getToken()` calls — gateway proxy handles auth
- No 401 catch-and-retry — gateway handles token refresh
- No `BackfillConfig` construction — `BackfillContext` is simpler (no token, no provider name)
- No connector registry — entity handlers come from `getProvider()`
- Rate limit parsing happens client-side from raw headers returned by the proxy

## Implementation Approach

Work bottom-up: types → provider implementations → gateway routes → gateway client → backfill simplification → new providers → cleanup.

---

## Phase 1: Add API and Backfill Types + GitHub/Vercel Implementations

### Overview
Add `ProviderApi`, `BackfillDef`, and supporting types to `define.ts`. Create typed response schemas. Move GitHub and Vercel connector+adapter logic from `console-backfill` into provider-specific files in `console-providers`. Add stub implementations for Linear and Sentry.

### Changes Required:

#### 1. Add API and backfill types to `define.ts`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add `ApiEndpoint`, `ProviderApi`, `RateLimit`, `BackfillWebhookEvent`, `BackfillContext`, `BackfillEntityHandler`, `BackfillDef` interfaces. Add `api` and `backfill` as required fields on `ProviderDefinition`. Update `defineProvider()` to require them.

```typescript
import type { z } from "zod";

// ── API Surface types ───────────────────────────────────────────────────────────

export interface ApiEndpoint {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly description: string;
  readonly timeout?: number;
  readonly responseSchema: z.ZodType;
}

export interface RateLimit {
  remaining: number;
  resetAt: Date;
  limit: number;
}

export interface ProviderApi {
  readonly baseUrl: string;
  readonly defaultHeaders?: Record<string, string>;
  readonly buildAuthHeader?: (token: string) => string;
  readonly parseRateLimit: (headers: Headers) => RateLimit | null;
  readonly endpoints: Record<string, ApiEndpoint>;
}

// ── Backfill types ──────────────────────────────────────────────────────────────

export interface BackfillWebhookEvent {
  deliveryId: string;
  eventType: string;
  payload: unknown;
}

export interface BackfillContext {
  installationId: string;
  resource: {
    providerResourceId: string;
    resourceName: string | null;
  };
  since: string;
}

export interface BackfillEntityHandler {
  readonly endpointId: string;
  buildRequest(ctx: BackfillContext, cursor: unknown): {
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: unknown;
  };
  processResponse(
    data: unknown,
    ctx: BackfillContext,
    cursor: unknown,
    responseHeaders?: Record<string, string>
  ): {
    events: BackfillWebhookEvent[];
    nextCursor: unknown | null;
    rawCount: number;
  };
}

export interface BackfillDef {
  readonly supportedEntityTypes: readonly string[];
  readonly defaultEntityTypes: readonly string[];
  readonly entityTypes: Record<string, BackfillEntityHandler>;
}
```

Add to `ProviderDefinition`:
```typescript
export interface ProviderDefinition<TConfig, ...> {
  // ...existing fields...
  readonly api: ProviderApi;
  readonly backfill: BackfillDef;
}
```

Update `defineProvider()` — `api` and `backfill` are part of the `def` parameter (no change to the function signature beyond the type widening).

#### 2. Create GitHub API definition with response schemas
**File**: `packages/console-providers/src/providers/github/api.ts` (NEW)
**Changes**: Define response schemas (only fields we consume, with `.passthrough()`), `parseGitHubRateLimit`, and `githubApi: ProviderApi`.

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

#### 3. Create GitHub backfill definition
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
- `pull_request`: page-number cursor (`{ page: N }`), terminates when `items.length < 100 || filtered.length < items.length`
- `issue`: page-number cursor, server-side `since` filter via query param, client-side filter removes items with `pull_request` key
- `release`: page-number cursor, client-side time filter on `published_at ?? created_at`

#### 4. Create Vercel API definition with response schemas
**File**: `packages/console-providers/src/providers/vercel/api.ts` (NEW)
**Changes**: Define response schemas, `parseVercelRateLimit`, and `vercelApi: ProviderApi`.

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

#### 5. Create Vercel backfill definition
**File**: `packages/console-providers/src/providers/vercel/backfill.ts` (NEW)
**Changes**: Move logic from `console-backfill/connectors/vercel.ts` and `console-backfill/adapters/vercel.ts`.

Exports:
- `vercelBackfill: BackfillDef`
- `adaptVercelDeploymentForTransformer` — re-exported for tests

Entity handler for `deployment`:
- Timestamp cursor (`number`), terminates when `pagination.next === null || filtered.length < deployments.length`
- Client-side filter: `deployment.created >= sinceDate`
- Adapter maps `readyState` to event type

#### 6. Add Linear API definition
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

#### 7. Add Sentry API definition
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

#### 8. Wire `api` and `backfill` into all provider definitions
**File**: `packages/console-providers/src/providers/github/index.ts`
**Changes**: Import `githubApi` and `githubBackfill`, add to `defineProvider()` call.

**File**: `packages/console-providers/src/providers/vercel/index.ts`
**Changes**: Import `vercelApi` and `vercelBackfill`, add to `defineProvider()` call.

**File**: `packages/console-providers/src/providers/linear/index.ts`
**Changes**: Import `linearApi` and `linearBackfill`, add to `defineProvider()` call.

**File**: `packages/console-providers/src/providers/sentry/index.ts`
**Changes**: Import `sentryApi` and `sentryBackfill`, add to `defineProvider()` call.

#### 9. Export new types from barrel
**File**: `packages/console-providers/src/index.ts`
**Changes**: Add exports for `ApiEndpoint`, `ProviderApi`, `BackfillDef`, `BackfillEntityHandler`, `BackfillContext`, `BackfillWebhookEvent`, `RateLimit`.

Also export the response schemas and rate limit parsers from provider-specific files for use in tests and consumers:
- `parseGitHubRateLimit`, `githubPullRequestSchema`, `githubIssueSchema`, `githubReleaseSchema`, `githubUserSchema`
- `parseVercelRateLimit`, `vercelDeploymentSchema`, `vercelDeploymentsResponseSchema`
- `parseLinearRateLimit`, `graphqlResponseSchema`
- `parseSentryRateLimit`

#### 10. Move adapter tests
**Files**: Move test files from `console-backfill/src/adapters/*.test.ts` into `console-providers/src/providers/*/`:
- `adapters/github.test.ts` → `providers/github/backfill.test.ts`
- `adapters/vercel.test.ts` → `providers/vercel/backfill.test.ts`
- `adapters/round-trip.test.ts` → `providers/github/backfill-round-trip.test.ts`

Update imports to use the new paths. Test logic stays identical.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @repo/console-providers typecheck` passes
- [ ] `pnpm --filter @repo/console-providers test` passes (including moved adapter tests)
- [ ] Existing `console-backfill` tests still pass (they still exist at this point)
- [ ] `pnpm typecheck` passes across ALL packages (the `ProviderDefinition` change affects every consumer)

#### Manual Verification:
- [ ] Verify the `BackfillEntityHandler` implementations produce identical output as the existing connectors
- [ ] Verify adapter functions produce identical output as before (round-trip tests cover this)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Add Gateway Proxy Routes

### Overview
Gateway gains two new generic routes: **endpoints** (catalog/discovery) and **execute** (authenticated proxy). Extract the token acquisition logic into a reusable helper. The gateway remains a **pure proxy** with zero domain knowledge.

### Changes Required:

#### 1. Extract token acquisition helper
**File**: `apps/gateway/src/routes/connections.ts`
**Changes**: Extract the token acquisition logic from `GET /:id/token` (lines 502-602) into a reusable helper function `getActiveTokenForInstallation()` that both the existing token route and the new execute route can use.

```typescript
async function getActiveTokenForInstallation(
  installation: { id: string; externalId: string; provider: string },
  config: unknown,
  providerDef: ProviderDefinition
): Promise<string> {
  const tokenRows = await db
    .select()
    .from(gwTokens)
    .where(eq(gwTokens.installationId, installation.id))
    .limit(1);

  const tokenRow = tokenRows[0];

  // Handle refresh if expired
  if (tokenRow?.expiresAt && new Date(tokenRow.expiresAt) < new Date()) {
    if (!tokenRow.refreshToken) {
      throw new Error("token_expired:no_refresh_token");
    }
    const decryptedRefresh = await decrypt(tokenRow.refreshToken, env.ENCRYPTION_KEY!);
    const refreshed = await providerDef.oauth.refreshToken(config as never, decryptedRefresh);
    await updateTokenRecord(tokenRow.id, refreshed, tokenRow.refreshToken, tokenRow.expiresAt);
    return refreshed.accessToken;
  }

  const decryptedAccessToken = tokenRow
    ? await decrypt(tokenRow.accessToken, env.ENCRYPTION_KEY!)
    : null;

  return providerDef.oauth.getActiveToken(
    config as never,
    installation.externalId,
    decryptedAccessToken
  );
}
```

Also extract a `forceRefreshToken()` helper for 401 retry:

```typescript
async function forceRefreshToken(
  installation: { id: string; externalId: string; provider: string },
  config: unknown,
  providerDef: ProviderDefinition
): Promise<string | null> {
  const tokenRows = await db
    .select()
    .from(gwTokens)
    .where(eq(gwTokens.installationId, installation.id))
    .limit(1);
  const row = tokenRows[0];

  if (row?.refreshToken) {
    try {
      const decryptedRefresh = await decrypt(row.refreshToken, env.ENCRYPTION_KEY!);
      const refreshed = await providerDef.oauth.refreshToken(config as never, decryptedRefresh);
      await updateTokenRecord(row.id, refreshed, row.refreshToken, row.expiresAt);
      return refreshed.accessToken;
    } catch {
      // Refresh failed — fall through to getActiveToken
    }
  }

  // For GitHub (or if refresh failed), try getActiveToken which may generate a fresh token
  try {
    return await providerDef.oauth.getActiveToken(
      config as never,
      installation.externalId,
      null
    );
  } catch {
    return null;
  }
}
```

Then refactor `GET /:id/token` to use `getActiveTokenForInstallation` too.

#### 2. Add proxy endpoints route
**File**: `apps/gateway/src/routes/connections.ts`
**Changes**: Add the catalog/discovery route.

```typescript
/**
 * GET /connections/:id/proxy/endpoints
 *
 * Returns the provider's API catalog — available endpoints and their specs.
 * Strips responseSchema (not serializable). Internal-only, requires X-API-Key.
 */
connections.get("/:id/proxy/endpoints", apiKeyAuth, async (c) => {
  const id = c.req.param("id");

  const installation = await db.query.gwInstallations.findFirst({
    where: eq(gwInstallations.id, id),
  });

  if (!installation) {
    return c.json({ error: "not_found" }, 404);
  }

  const providerDef = getProvider(installation.provider);
  if (!providerDef) {
    return c.json({ error: "unknown_provider" }, 400);
  }

  // Strip responseSchema (Zod types aren't serializable)
  const endpoints: Record<string, { method: string; path: string; description: string; timeout?: number }> = {};
  for (const [key, ep] of Object.entries(providerDef.api.endpoints)) {
    endpoints[key] = {
      method: ep.method,
      path: ep.path,
      description: ep.description,
      ...(ep.timeout ? { timeout: ep.timeout } : {}),
    };
  }

  return c.json({
    provider: installation.provider,
    baseUrl: providerDef.api.baseUrl,
    endpoints,
  });
});
```

#### 3. Add proxy execute route
**File**: `apps/gateway/src/routes/connections.ts`
**Changes**: Add the pure proxy route.

```typescript
/**
 * POST /connections/:id/proxy/execute
 *
 * Pure authenticated API proxy. Zero domain knowledge.
 * Gateway handles: endpoint validation, auth injection, 401 retry.
 * Gateway returns: raw { status, data, headers }.
 * Internal-only, requires X-API-Key.
 */
connections.post("/:id/proxy/execute", apiKeyAuth, async (c) => {
  const id = c.req.param("id");

  let body: {
    endpointId: string;
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (!body.endpointId) {
    return c.json({ error: "missing_endpoint_id" }, 400);
  }

  // Look up installation
  const installation = await db.query.gwInstallations.findFirst({
    where: eq(gwInstallations.id, id),
  });

  if (!installation) {
    return c.json({ error: "not_found" }, 404);
  }

  if (installation.status !== "active") {
    return c.json({ error: "installation_not_active", status: installation.status }, 400);
  }

  const providerName = installation.provider;
  const providerDef = getProvider(providerName);
  if (!providerDef) {
    return c.json({ error: "unknown_provider" }, 400);
  }

  const config = providerConfigs[providerName];

  // Validate endpoint exists in catalog
  const endpoint = providerDef.api.endpoints[body.endpointId];
  if (!endpoint) {
    return c.json({
      error: "unknown_endpoint",
      endpointId: body.endpointId,
      available: Object.keys(providerDef.api.endpoints),
    }, 400);
  }

  // Get active token
  let token: string;
  try {
    token = await getActiveTokenForInstallation(installation, config, providerDef);
  } catch (err) {
    const message = err instanceof Error ? err.message : "token_error";
    return c.json({ error: "token_error", message }, 502);
  }

  // Build URL
  let path = endpoint.path;
  if (body.pathParams) {
    for (const [key, val] of Object.entries(body.pathParams)) {
      path = path.replace(`{${key}}`, encodeURIComponent(val));
    }
  }

  let url = `${providerDef.api.baseUrl}${path}`;
  if (body.queryParams && Object.keys(body.queryParams).length > 0) {
    url += "?" + new URLSearchParams(body.queryParams).toString();
  }

  // Build headers
  const authHeader = providerDef.api.buildAuthHeader
    ? providerDef.api.buildAuthHeader(token)
    : `Bearer ${token}`;

  const headers: Record<string, string> = {
    Authorization: authHeader,
    ...(providerDef.api.defaultHeaders ?? {}),
  };

  // Build fetch options
  const fetchOptions: RequestInit = {
    method: endpoint.method,
    headers,
    signal: AbortSignal.timeout(endpoint.timeout ?? 30_000),
  };

  if (body.body) {
    fetchOptions.body = JSON.stringify(body.body);
    headers["Content-Type"] = "application/json";
  }

  // Execute with 401 retry
  let response = await fetch(url, fetchOptions);

  if (response.status === 401) {
    const freshToken = await forceRefreshToken(installation, config, providerDef);
    if (freshToken && freshToken !== token) {
      headers.Authorization = providerDef.api.buildAuthHeader
        ? providerDef.api.buildAuthHeader(freshToken)
        : `Bearer ${freshToken}`;
      response = await fetch(url, { ...fetchOptions, headers });
    }
  }

  // Return raw response — no parsing, no transformation
  const data = await response.json().catch(() => null);
  const responseHeaders = Object.fromEntries(response.headers.entries());

  return c.json({
    status: response.status,
    data,
    headers: responseHeaders,
  });
});
```

**Key difference from v2:** No `parseRateLimit` call. No rate limit in the response. Just `{ status, data, headers }`.

#### 4. Route placement note
The two new routes must be registered AFTER the existing `/:id` route but BEFORE the `/:provider/:id` delete route. The path `/:id/proxy/endpoints` and `/:id/proxy/execute` are unambiguous because `proxy` is a fixed segment.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @lightfast/gateway typecheck` passes
- [ ] `pnpm --filter @lightfast/gateway test` passes
- [ ] `pnpm build:gateway` succeeds

#### Manual Verification:
- [ ] Test the endpoints route: `curl -H "X-API-Key: ..." http://localhost:4110/services/gateway/{installationId}/proxy/endpoints`
- [ ] Test the execute route with a GitHub PR list: `curl -X POST -H "X-API-Key: ..." -H "Content-Type: application/json" -d '{"endpointId":"list-pull-requests","pathParams":{"owner":"...","repo":"..."},"queryParams":{"state":"all","per_page":"5"}}' http://localhost:4110/services/gateway/{installationId}/proxy/execute`
- [ ] Verify the response includes raw GitHub data + raw headers (including rate limit headers)
- [ ] Verify 401 from provider triggers token refresh and retry

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Add Gateway Client Methods + Simplify Backfill App

### Overview
Add `executeApi()` and `getApiEndpoints()` to the gateway client. Then replace all `@repo/console-backfill` usage in the backfill app with gateway proxy calls + `console-providers` entity handlers. Rate limit parsing moves to the backfill entity worker (client-side).

### Changes Required:

#### 1. Add wire types to console-providers gateway.ts
**File**: `packages/console-providers/src/gateway.ts`
**Changes**: Add Zod schemas for the proxy request/response wire format.

```typescript
// ── Proxy wire types ────────────────────────────────────────────────────────────

export const proxyExecuteRequestSchema = z.object({
  endpointId: z.string(),
  pathParams: z.record(z.string()).optional(),
  queryParams: z.record(z.string()).optional(),
  body: z.unknown().optional(),
});

export type ProxyExecuteRequest = z.infer<typeof proxyExecuteRequestSchema>;

export const proxyExecuteResponseSchema = z.object({
  status: z.number(),
  data: z.unknown(),
  headers: z.record(z.string()),
});

export type ProxyExecuteResponse = z.infer<typeof proxyExecuteResponseSchema>;

export const proxyEndpointsResponseSchema = z.object({
  provider: z.string(),
  baseUrl: z.string(),
  endpoints: z.record(
    z.object({
      method: z.enum(["GET", "POST"]),
      path: z.string(),
      description: z.string(),
      timeout: z.number().optional(),
    })
  ),
});

export type ProxyEndpointsResponse = z.infer<typeof proxyEndpointsResponseSchema>;
```

Export these from `packages/console-providers/src/index.ts`.

#### 2. Add methods to gateway client
**File**: `packages/gateway-service-clients/src/gateway.ts`
**Changes**: Add `executeApi()` and `getApiEndpoints()` methods.

```typescript
async executeApi(
  installationId: string,
  request: {
    endpointId: string;
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: unknown;
  }
): Promise<ProxyExecuteResponse> {
  const response = await fetch(
    `${gatewayUrl}/gateway/${installationId}/proxy/execute`,
    {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(60_000), // Allow for gateway's 30s provider timeout + overhead
    }
  );
  if (!response.ok) {
    const err = new Error(
      `Gateway executeApi failed: ${response.status} for ${installationId}`
    );
    (err as any).status = response.status;
    throw err;
  }
  return response.json() as Promise<ProxyExecuteResponse>;
},

async getApiEndpoints(
  installationId: string
): Promise<ProxyEndpointsResponse> {
  const response = await fetch(
    `${gatewayUrl}/gateway/${installationId}/proxy/endpoints`,
    { headers: h, signal: AbortSignal.timeout(10_000) }
  );
  if (!response.ok) {
    throw new Error(
      `Gateway getApiEndpoints failed: ${response.status} for ${installationId}`
    );
  }
  return response.json() as Promise<ProxyEndpointsResponse>;
},
```

#### 3. Simplify entity worker
**File**: `apps/backfill/src/workflows/entity-worker.ts`
**Changes**:

Remove:
- `import { getConnector } from "@repo/console-backfill"` and `import type { BackfillConfig }`
- Token fetching outside step boundary (line 62)
- Connector resolution (lines 65-72)
- `BackfillConfig` construction (lines 75-84)
- 401 token refresh logic within step (lines 118-148)
- Token re-fetch after refresh (lines 155-158)

Add:
- `import { getProvider, type BackfillContext } from "@repo/console-providers"`

Replace the pagination loop:

```typescript
const providerDef = getProvider(provider);
if (!providerDef) {
  throw new NonRetriableError(`Unknown provider: ${provider}`);
}

const entityHandler = providerDef.backfill.entityTypes[entityType];
if (!entityHandler) {
  throw new NonRetriableError(
    `Entity type "${entityType}" is not supported for ${provider} backfill`
  );
}

const ctx: BackfillContext = {
  installationId,
  resource,
  since,
};

let cursor: unknown = null;
let pageNum = 1;
let eventsProduced = 0;
let eventsDispatched = 0;

while (true) {
  const fetchResult = await step.run(
    `fetch-${entityType}-p${pageNum}`,
    async () => {
      const request = entityHandler.buildRequest(ctx, cursor);
      const raw = await gw.executeApi(installationId, {
        endpointId: entityHandler.endpointId,
        ...request,
      });

      if (raw.status !== 200) {
        const err = new Error(`Provider API returned ${raw.status}`);
        (err as any).status = raw.status;
        throw err;
      }

      const processed = entityHandler.processResponse(raw.data, ctx, cursor, raw.headers);

      // Parse rate limits client-side from raw headers
      const rateLimit = providerDef.api.parseRateLimit(new Headers(raw.headers));

      return {
        events: processed.events,
        nextCursor: processed.nextCursor,
        rawCount: processed.rawCount,
        rateLimit: rateLimit
          ? {
              remaining: rateLimit.remaining,
              resetAt: rateLimit.resetAt.toISOString(),
              limit: rateLimit.limit,
            }
          : null,
      };
    }
  );

  eventsProduced += fetchResult.rawCount;

  // dispatch step — unchanged from current implementation
  const dispatched = await step.run(
    `dispatch-${entityType}-p${pageNum}`,
    async () => {
      let count = 0;
      for (let i = 0; i < fetchResult.events.length; i += BATCH_SIZE) {
        const batch = fetchResult.events.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((event) =>
            relay.dispatchWebhook(
              provider,
              {
                connectionId: installationId,
                orgId,
                deliveryId: event.deliveryId,
                eventType: event.eventType,
                payload: event.payload,
                receivedAt: Date.now(),
              },
              holdForReplay
            )
          )
        );
        count += batch.length;
      }
      return count;
    }
  );

  eventsDispatched += dispatched;

  // Rate limit sleep — reads from serialized rateLimit
  if (fetchResult.rateLimit) {
    const { remaining, resetAt, limit } = fetchResult.rateLimit;
    if (remaining < limit * 0.1) {
      const sleepMs = Math.max(0, new Date(resetAt).getTime() - Date.now());
      if (sleepMs > 0) {
        await step.sleep(
          `rate-limit-${entityType}-p${pageNum}`,
          `${Math.ceil(sleepMs / 1000)}s`
        );
      }
    }
  }

  if (!fetchResult.nextCursor) break;
  cursor = fetchResult.nextCursor;
  pageNum++;
}
```

#### 4. Simplify orchestrator
**File**: `apps/backfill/src/workflows/backfill-orchestrator.ts`
**Changes**:

Remove:
- `import { getConnector } from "@repo/console-backfill"`

Replace connector-based entity type resolution with direct import from `console-providers`:

```typescript
import { getProvider } from "@repo/console-providers";

const providerDef = getProvider(provider);
if (!providerDef) {
  throw new NonRetriableError(`Unknown provider: ${provider}`);
}

if (providerDef.backfill.supportedEntityTypes.length === 0) {
  throw new NonRetriableError(`Provider ${provider} does not support backfill`);
}

const resolvedEntityTypes =
  entityTypes && entityTypes.length > 0
    ? entityTypes
    : [...providerDef.backfill.defaultEntityTypes];
```

#### 5. Simplify estimate route
**File**: `apps/backfill/src/routes/estimate.ts`
**Changes**:

Remove:
- `import { getConnector } from "@repo/console-backfill"` and `import type { BackfillConfig }`
- Token fetching (lines 53-57)
- Connector resolution (lines 60-63)

Replace with gateway proxy calls:

```typescript
import { getProvider, type BackfillContext } from "@repo/console-providers";

const providerDef = getProvider(provider);
const resolvedEntityTypes =
  entityTypes?.length ? entityTypes : [...providerDef.backfill.defaultEntityTypes];

// Build probes — no token needed, gateway handles auth
const probes = resolvedEntityTypes.flatMap((entityType) =>
  connection.resources.map(async (resource) => {
    const entityHandler = providerDef.backfill.entityTypes[entityType];
    if (!entityHandler) return { entityType, resource: resource.providerResourceId, returnedCount: 0, hasMore: false };

    const ctx: BackfillContext = {
      installationId,
      resource: { providerResourceId: resource.providerResourceId, resourceName: resource.resourceName },
      since,
    };

    try {
      const request = entityHandler.buildRequest(ctx, null);
      const raw = await gw.executeApi(installationId, {
        endpointId: entityHandler.endpointId,
        ...request,
      });

      if (raw.status !== 200) {
        return { entityType, resource: resource.providerResourceId, returnedCount: -1, hasMore: false };
      }

      const processed = entityHandler.processResponse(raw.data, ctx, null);
      return {
        entityType,
        resource: resource.providerResourceId,
        returnedCount: processed.rawCount,
        hasMore: processed.nextCursor !== null,
      };
    } catch {
      return { entityType, resource: resource.providerResourceId, returnedCount: -1, hasMore: false };
    }
  })
);
```

#### 6. Remove console-backfill dependency
**File**: `apps/backfill/package.json`
**Changes**: Remove `"@repo/console-backfill": "workspace:*"` from dependencies. Add `"@repo/console-providers": "workspace:*"` if not already present.

#### 7. Update test mocks
**Files**:
- `apps/backfill/src/workflows/entity-worker.test.ts`
- `apps/backfill/src/workflows/backfill-orchestrator.test.ts`
- `apps/backfill/src/workflows/step-replay.test.ts`
- `apps/backfill/src/routes/estimate.test.ts`

**Changes**: Replace `vi.mock("@repo/console-backfill", ...)` with:
1. Mock the gateway client's `executeApi` method to return `{ status: 200, data: [...], headers: {} }`
2. Mock `@repo/console-providers` `getProvider` to return test provider definitions with test entity handlers

The mock shape changes from:
```typescript
vi.mock("@repo/console-backfill", () => ({
  getConnector: () => ({ fetchPage: vi.fn(), defaultEntityTypes: [...] }),
}));
```
To:
```typescript
vi.mock("@repo/console-providers", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getProvider: () => ({
      api: {
        parseRateLimit: () => null,
      },
      backfill: {
        supportedEntityTypes: ["pull_request", "issue"],
        defaultEntityTypes: ["pull_request", "issue"],
        entityTypes: {
          pull_request: {
            endpointId: "list-pull-requests",
            buildRequest: vi.fn(() => ({
              pathParams: { owner: "test", repo: "test" },
              queryParams: { per_page: "100" },
            })),
            processResponse: vi.fn((data) => ({
              events: [...],
              nextCursor: null,
              rawCount: Array.isArray(data) ? data.length : 0,
            })),
          },
        },
      },
    }),
  };
});
```

And the gateway client mock adds:
```typescript
executeApi: vi.fn(async () => ({
  status: 200,
  data: [...testData],
  headers: {},
})),
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @lightfast/backfill typecheck` passes
- [ ] `pnpm --filter @lightfast/backfill test` passes (all tests updated and passing)
- [ ] `pnpm --filter @repo/gateway-service-clients typecheck` passes
- [ ] `pnpm --filter @repo/console-providers typecheck` passes
- [ ] `pnpm build:backfill` succeeds
- [ ] No imports of `@repo/console-backfill` remain in `apps/backfill/`

#### Manual Verification:
- [ ] Run a full backfill flow end-to-end with `pnpm dev:app` — trigger a backfill for a GitHub connection, verify events arrive in Console
- [ ] Verify estimate endpoint returns reasonable results via curl
- [ ] Verify cancellation still works (send cancel event, verify workers stop)

**Implementation Note**: After completing this phase, pause for full end-to-end manual testing before proceeding to Phase 4.

---

## Phase 4: Implement Linear Backfill

### Overview
Add full backfill support for Linear. Linear uses a GraphQL API with cursor-based pagination (`first`/`after`/`pageInfo`). Query-specific response schemas are defined as Zod schemas in the backfill file.

### Changes Required:

#### 1. Define Linear GraphQL query response schemas
**File**: `packages/console-providers/src/providers/linear/backfill.ts`
**Changes**: Replace stub with full implementation including Zod response schemas per query.

```typescript
import { z } from "zod";
import type { BackfillContext, BackfillDef } from "../../define";

// ── Shared schemas ──────────────────────────────────────────────────────────────

const pageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable(),
});

// ── Issue query response schema ─────────────────────────────────────────────────

const linearIssueNodeSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  priority: z.number(),
  url: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  state: z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
  }).passthrough(),
  assignee: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().optional(),
  }).passthrough().nullable().optional(),
  team: z.object({
    id: z.string(),
    name: z.string(),
  }).passthrough(),
  project: z.object({
    id: z.string(),
    name: z.string(),
  }).passthrough().nullable().optional(),
  labels: z.object({
    nodes: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()),
  }).optional(),
}).passthrough();

export type LinearIssueNode = z.infer<typeof linearIssueNodeSchema>;

const issuesQueryResponseSchema = z.object({
  data: z.object({
    issues: z.object({
      nodes: z.array(linearIssueNodeSchema),
      pageInfo: pageInfoSchema,
    }),
  }),
});

// ── Comment query response schema ───────────────────────────────────────────────

const linearCommentNodeSchema = z.object({
  id: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  user: z.object({
    id: z.string(),
    name: z.string(),
  }).passthrough().nullable().optional(),
  issue: z.object({
    id: z.string(),
    identifier: z.string(),
  }).passthrough(),
}).passthrough();

export type LinearCommentNode = z.infer<typeof linearCommentNodeSchema>;

const commentsQueryResponseSchema = z.object({
  data: z.object({
    comments: z.object({
      nodes: z.array(linearCommentNodeSchema),
      pageInfo: pageInfoSchema,
    }),
  }),
});

// ── Project query response schema ───────────────────────────────────────────────

const linearProjectNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  state: z.string(),
  url: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lead: z.object({
    id: z.string(),
    name: z.string(),
  }).passthrough().nullable().optional(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
}).passthrough();

export type LinearProjectNode = z.infer<typeof linearProjectNodeSchema>;

const projectsQueryResponseSchema = z.object({
  data: z.object({
    projects: z.object({
      nodes: z.array(linearProjectNodeSchema),
      pageInfo: pageInfoSchema,
    }),
  }),
});
```

#### 2. Define GraphQL queries and entity handlers

```typescript
const LINEAR_ISSUES_QUERY = `
  query BackfillIssues($teamId: ID!, $after: String, $since: DateTime!) {
    issues(
      first: 50
      after: $after
      orderBy: updatedAt
      includeArchived: true
      filter: {
        team: { id: { eq: $teamId } }
        updatedAt: { gt: $since }
      }
    ) {
      nodes {
        id identifier title description priority url createdAt updatedAt
        state { id name type }
        assignee { id name email }
        team { id name }
        project { id name }
        labels { nodes { id name } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const LINEAR_COMMENTS_QUERY = `
  query BackfillComments($teamId: ID!, $after: String, $since: DateTime!) {
    comments(
      first: 50
      after: $after
      orderBy: updatedAt
      filter: {
        issue: { team: { id: { eq: $teamId } } }
        updatedAt: { gt: $since }
      }
    ) {
      nodes {
        id body createdAt updatedAt
        user { id name }
        issue { id identifier }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const LINEAR_PROJECTS_QUERY = `
  query BackfillProjects($teamId: ID!, $after: String, $since: DateTime!) {
    projects(
      first: 50
      after: $after
      orderBy: updatedAt
      filter: {
        teams: { some: { id: { eq: $teamId } } }
        updatedAt: { gt: $since }
      }
    ) {
      nodes {
        id name description state url createdAt updatedAt
        lead { id name }
        startDate targetDate
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const linearBackfill: BackfillDef = {
  supportedEntityTypes: ["Issue", "Comment", "Project"],
  defaultEntityTypes: ["Issue", "Comment", "Project"],
  entityTypes: {
    Issue: {
      endpointId: "graphql",
      buildRequest(ctx, cursor) {
        return {
          body: {
            query: LINEAR_ISSUES_QUERY,
            variables: {
              teamId: ctx.resource.providerResourceId,
              after: cursor ?? undefined,
              since: ctx.since,
            },
          },
        };
      },
      processResponse(data, ctx, _cursor) {
        const parsed = issuesQueryResponseSchema.parse(data);
        const issues = parsed.data.issues;

        const events = issues.nodes.map((issue) => ({
          deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-issue-${issue.id}`,
          eventType: "Issue",
          payload: adaptLinearIssueForTransformer(issue, ctx),
        }));

        return {
          events,
          nextCursor: issues.pageInfo.hasNextPage ? issues.pageInfo.endCursor : null,
          rawCount: issues.nodes.length,
        };
      },
    },
    Comment: {
      endpointId: "graphql",
      buildRequest(ctx, cursor) {
        return {
          body: {
            query: LINEAR_COMMENTS_QUERY,
            variables: {
              teamId: ctx.resource.providerResourceId,
              after: cursor ?? undefined,
              since: ctx.since,
            },
          },
        };
      },
      processResponse(data, ctx, _cursor) {
        const parsed = commentsQueryResponseSchema.parse(data);
        const comments = parsed.data.comments;

        const events = comments.nodes.map((comment) => ({
          deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-comment-${comment.id}`,
          eventType: "Comment",
          payload: adaptLinearCommentForTransformer(comment, ctx),
        }));

        return {
          events,
          nextCursor: comments.pageInfo.hasNextPage ? comments.pageInfo.endCursor : null,
          rawCount: comments.nodes.length,
        };
      },
    },
    Project: {
      endpointId: "graphql",
      buildRequest(ctx, cursor) {
        return {
          body: {
            query: LINEAR_PROJECTS_QUERY,
            variables: {
              teamId: ctx.resource.providerResourceId,
              after: cursor ?? undefined,
              since: ctx.since,
            },
          },
        };
      },
      processResponse(data, ctx, _cursor) {
        const parsed = projectsQueryResponseSchema.parse(data);
        const projects = parsed.data.projects;

        const events = projects.nodes.map((project) => ({
          deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-project-${project.id}`,
          eventType: "Project",
          payload: adaptLinearProjectForTransformer(project, ctx),
        }));

        return {
          events,
          nextCursor: projects.pageInfo.hasNextPage ? projects.pageInfo.endCursor : null,
          rawCount: projects.nodes.length,
        };
      },
    },
  },
};
```

The adapter functions (`adaptLinearIssueForTransformer`, etc.) transform Linear GraphQL response objects into the same `PreTransformLinear*Webhook` shapes that the webhook transformers already expect.

**Key implementation notes for Linear:**
- Always set `includeArchived: true` on issue queries — archived issues are hidden by default
- `orderBy: updatedAt` returns most recently changed first, optimal for incremental backfill
- Comments have no direct `team` filter — use `filter: { issue: { team: { id: { eq: $teamId } } } }`
- Projects are multi-team — use `filter: { teams: { some: { id: { eq: $teamId } } } }`
- Use `first: 50` (not 100) to stay within complexity budgets for queries with nested fields

#### 3. Add Linear backfill tests
**File**: `packages/console-providers/src/providers/linear/backfill.test.ts` (NEW)
**Changes**: Test `buildRequest` produces correct GraphQL queries, `processResponse` validates with Zod and adapts items correctly, pagination handles `pageInfo.hasNextPage` and `endCursor`.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @repo/console-providers typecheck` passes
- [ ] `pnpm --filter @repo/console-providers test` passes
- [ ] Round-trip test: Linear backfill adapter output → Linear transformer → valid `PostTransformEvent`

#### Manual Verification:
- [ ] Trigger a backfill for a Linear connection via `pnpm dev:app`
- [ ] Verify Linear issues appear as observations in the console
- [ ] Verify pagination works with more than 50 items

**Implementation Note**: After completing this phase, pause for manual testing before proceeding to Phase 5.

---

## Phase 5: Implement Sentry Backfill

### Overview
Add full backfill support for Sentry. Sentry uses REST API with cursor-based pagination via `Link` headers. Response schemas defined with Zod.

### Changes Required:

#### 1. Update Sentry API definition with endpoints and response schemas
**File**: `packages/console-providers/src/providers/sentry/api.ts`
**Changes**: Add endpoints and response schemas.

```typescript
import { z } from "zod";
import type { ProviderApi, RateLimit } from "../../define";
import { decodeSentryToken } from "./auth";

// ── Response Schemas ────────────────────────────────────────────────────────────

export const sentryIssueSchema = z.object({
  id: z.string(),
  shortId: z.string().optional(),
  title: z.string(),
  culprit: z.string().optional(),
  permalink: z.string().optional(),
  level: z.string().optional(),
  status: z.string(),
  platform: z.string().optional(),
  project: z.object({
    id: z.string(),
    name: z.string().optional(),
    slug: z.string(),
  }).passthrough(),
  type: z.string().optional(),
  firstSeen: z.string(),
  lastSeen: z.string(),
  count: z.string().optional(),
  userCount: z.number().optional(),
  assignedTo: z.object({
    type: z.string(),
    id: z.string(),
    name: z.string(),
  }).passthrough().nullable().optional(),
}).passthrough();

export type SentryIssue = z.infer<typeof sentryIssueSchema>;

export const sentryErrorEventSchema = z.object({
  eventID: z.string(),
  title: z.string().optional(),
  message: z.string().optional(),
  dateCreated: z.string(),
  platform: z.string().optional(),
  tags: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
}).passthrough();

export type SentryErrorEvent = z.infer<typeof sentryErrorEventSchema>;

// ── Rate Limit Parser ───────────────────────────────────────────────────────────

export function parseSentryRateLimit(headers: Headers): RateLimit | null {
  const remaining = headers.get("x-sentry-rate-limit-remaining");
  const limit = headers.get("x-sentry-rate-limit-limit");
  const reset = headers.get("x-sentry-rate-limit-reset");
  if (!remaining || !limit || !reset) return null;
  const r = parseInt(remaining, 10);
  const l = parseInt(limit, 10);
  const s = parseFloat(reset);
  if (Number.isNaN(r) || Number.isNaN(l) || Number.isNaN(s)) return null;
  return { remaining: r, limit: l, resetAt: new Date(s * 1000) };
}

// ── API Definition ──────────────────────────────────────────────────────────────

export const sentryApi: ProviderApi = {
  baseUrl: "https://sentry.io",
  buildAuthHeader: (token) => `Bearer ${decodeSentryToken(token).token}`,
  parseRateLimit: parseSentryRateLimit,
  endpoints: {
    "list-org-issues": {
      method: "GET",
      path: "/api/0/organizations/{organization_slug}/issues/",
      description: "List issues for an organization (filter by project via query param)",
      responseSchema: z.array(sentryIssueSchema),
    },
    "list-events": {
      method: "GET",
      path: "/api/0/projects/{organization_slug}/{project_slug}/events/",
      description: "List error events for a Sentry project",
      responseSchema: z.array(sentryErrorEventSchema),
    },
  },
} as const;
```

#### 2. Implement Sentry backfill entity handlers
**File**: `packages/console-providers/src/providers/sentry/backfill.ts`
**Changes**: Replace stub with full implementation.

Sentry's cursor pagination uses RFC 5988 `Link` headers with `rel="next"`, `results="true"/"false"`, and `cursor="..."`.

```typescript
import { z } from "zod";
import type { BackfillContext, BackfillDef } from "../../define";
import { sentryIssueSchema, sentryErrorEventSchema, type SentryIssue, type SentryErrorEvent } from "./api";

/** Parse Sentry's RFC 5988 Link header to extract the next page cursor.
 *  Returns null if no next page (results="false") or header is missing. */
function parseSentryLinkCursor(linkHeader?: string): string | null {
  if (!linkHeader) return null;
  const nextMatch = linkHeader.match(
    /rel="next";\s*results="true";\s*cursor="([^"]+)"/
  );
  return nextMatch?.[1] ?? null;
}

export const sentryBackfill: BackfillDef = {
  supportedEntityTypes: ["issue", "error"],
  defaultEntityTypes: ["issue", "error"],
  entityTypes: {
    issue: {
      endpointId: "list-org-issues",
      buildRequest(ctx, cursor) {
        const [orgSlug] = (ctx.resource.resourceName ?? "").split("/");
        return {
          pathParams: {
            organization_slug: orgSlug,
          },
          queryParams: {
            project: ctx.resource.providerResourceId,
            start: ctx.since,
            end: new Date().toISOString(),
            sort: "new",
            query: "",
            limit: "100",
            collapse: "stats",
            ...(cursor ? { cursor: cursor as string } : {}),
          },
        };
      },
      processResponse(data, ctx, _cursor, responseHeaders) {
        const issues = z.array(sentryIssueSchema).parse(data);
        const nextCursor = parseSentryLinkCursor(responseHeaders?.link);

        const events = issues.map((issue) => ({
          deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-issue-${issue.id}`,
          eventType: "issue",
          payload: adaptSentryIssueForTransformer(issue, ctx),
        }));

        return {
          events,
          nextCursor,
          rawCount: issues.length,
        };
      },
    },
    error: {
      endpointId: "list-events",
      buildRequest(ctx, cursor) {
        const [orgSlug, projectSlug] = (ctx.resource.resourceName ?? "").split("/");
        return {
          pathParams: {
            organization_slug: orgSlug,
            project_slug: projectSlug,
          },
          queryParams: {
            start: ctx.since,
            end: new Date().toISOString(),
            full: "true",
            ...(cursor ? { cursor: cursor as string } : {}),
          },
        };
      },
      processResponse(data, ctx, _cursor, responseHeaders) {
        const events = z.array(sentryErrorEventSchema).parse(data);
        const nextCursor = parseSentryLinkCursor(responseHeaders?.link);

        const adapted = events.map((event) => ({
          deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-error-${event.eventID}`,
          eventType: "error",
          payload: adaptSentryErrorForTransformer(event, ctx),
        }));

        return {
          events: adapted,
          nextCursor,
          rawCount: events.length,
        };
      },
    },
  },
};
```

Note: Sentry `processResponse` uses `responseHeaders?.link` to extract cursor from the raw headers returned by the gateway proxy. This is why `processResponse` has the optional `responseHeaders` parameter — Sentry is the primary consumer.

#### 3. Add Sentry backfill tests
**File**: `packages/console-providers/src/providers/sentry/backfill.test.ts` (NEW)

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @repo/console-providers typecheck` passes
- [ ] `pnpm --filter @repo/console-providers test` passes
- [ ] `pnpm --filter @lightfast/backfill typecheck` passes
- [ ] `pnpm --filter @lightfast/backfill test` passes

#### Manual Verification:
- [ ] Trigger a backfill for a Sentry connection
- [ ] Verify Sentry issues appear as observations in the console
- [ ] Test with a project that has many issues to verify Link header pagination

**Implementation Note**: After completing this phase, proceed to Phase 6 for cleanup.

---

## Phase 6: Dissolve `@repo/console-backfill`

### Overview
Remove the package entirely. Update all references across the monorepo.

### Changes Required:

#### 1. Remove from consumers
**File**: `apps/console/package.json` — Remove `"@repo/console-backfill": "workspace:*"`
**File**: `apps/console/next.config.ts` — Remove `"@repo/console-backfill"` from `transpilePackages` (line 30) and the comment reference (line 58)
**File**: `packages/integration-tests/package.json` — Remove `"@repo/console-backfill": "workspace:*"`
**File**: `packages/integration-tests/vitest.config.ts` — Remove `"@repo/console-backfill"` from alias/mock config (line 26)
**File**: `packages/integration-tests/src/backfill-connections-api.integration.test.ts` — Update mock to use gateway client `executeApi` instead of `@repo/console-backfill` (line 118)

#### 2. Update monorepo config
**File**: `knip.json` — Remove `"@repo/console-backfill"` entries (lines 13, 86)
**File**: `.changeset/pre.json` — Remove `"@repo/console-backfill"` entry (line 33)

#### 3. Delete the package
Remove the entire `packages/console-backfill/` directory.

#### 4. Clean up
```bash
pnpm install  # Regenerate lockfile without console-backfill
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm install` completes without errors
- [ ] `pnpm typecheck` passes across all packages
- [ ] `pnpm check` passes
- [ ] `pnpm build:console` succeeds
- [ ] `pnpm build:gateway` succeeds
- [ ] `pnpm build:backfill` succeeds
- [ ] No references to `console-backfill` remain: `grep -r "console-backfill" --include="*.ts" --include="*.json" .`

#### Manual Verification:
- [ ] Full `pnpm dev:app` starts without errors
- [ ] End-to-end backfill flow works for GitHub, Vercel, Linear, and Sentry

---

## Testing Strategy

### Unit Tests:
- Response schema validation: verify Zod schemas parse real-ish API responses correctly and reject malformed data
- `buildRequest` functions: verify correct path params, query params, GraphQL queries
- `processResponse` functions: verify filtering, adaptation, cursor extraction, Zod validation
- Rate limit parsers: verify each provider's `parseRateLimit` handles various header formats
- Gateway's `POST /:id/proxy/execute`: verify endpoint validation, URL building, auth injection, 401 retry, raw response shape
- Entity worker: verify pagination loop with mocked gateway client + provider entity handlers

### Integration Tests:
- Round-trip tests: adapter output → transformer → valid `PostTransformEvent` (for all providers)
- `packages/integration-tests/src/backfill-connections-api.integration.test.ts` — updated to test gateway proxy endpoint

### Manual Testing Steps:
1. Start full stack with `pnpm dev:app`
2. Connect a GitHub installation via the console
3. Test the catalog endpoint: `GET /services/gateway/{id}/proxy/endpoints` — verify it returns GitHub's endpoints (without responseSchema)
4. Test the execute endpoint: `POST /services/gateway/{id}/proxy/execute` with `{"endpointId":"list-pull-requests",...}` — verify raw GitHub data + raw headers return
5. Trigger a backfill via the API: `POST /api/trigger/ { installationId, provider: "github", orgId, depth: 7 }`
6. Verify backfill events appear in the console's observation feed
7. Test estimate endpoint: `POST /api/estimate/ { installationId, provider: "github", orgId, depth: 7 }`
8. Test cancellation: trigger backfill, then `POST /api/trigger/cancel { installationId }`
9. Repeat steps 2-8 with Vercel, Linear, and Sentry connections

## Performance Considerations

- The gateway proxy adds one HTTP hop (backfill → gateway → provider API). Gateway's ~30s timeout on the provider call plus response serialization adds ~50-100ms latency per page. Acceptable for a background backfill process.
- Rate limit information is now in raw headers — consumers construct `new Headers(raw.headers)` and call `parseRateLimit` locally. The overhead of constructing a `Headers` object is negligible.
- Token refresh is handled by gateway inline — no additional round trips for 401 retries.
- Response bodies (raw API data) are serialized through gateway's JSON response. For GitHub, this is ~100 items with full PR/issue objects per page (~200KB). Comparable to the current approach.
- The `processResponse` function runs inside the entity worker's `step.run`, so only the processed events + cursor are memoized by Inngest — not the raw API response.
- Zod `.parse()` in `processResponse` adds ~1-5ms per page for schema validation. Acceptable for the type safety it provides.

## Migration Notes

- No database migrations needed
- No data migration needed — the change is purely in service communication patterns
- Existing in-flight Inngest workflows will complete using the old code. New workflows triggered after deployment will use the new code. No coordination needed because the backfill orchestrator's concurrency limit of 1 per `installationId` prevents overlap.
- The `@repo/console-backfill` package can be deleted after all consumers are updated (Phase 6)
- Linear and Sentry backfill implementations are new functionality — they can be released independently

## Developer Experience

**Adding a new API endpoint for an existing provider:**
1. Add the response schema in the provider's `api.ts` (~10-20 lines)
2. Add the endpoint entry in `api.endpoints` (5 lines: method, path, description, responseSchema)
3. The endpoint is immediately available through the gateway proxy for any consumer

**Adding a new backfill entity type for an existing provider:**
1. If needed, add the API endpoint as above
2. Add the entity handler to `backfill.entityTypes` (~30 lines: `buildRequest` + `processResponse`)
3. Add the entity type string to `supportedEntityTypes` and optionally `defaultEntityTypes`

**Adding backfill support for a new provider:**
1. Define `api.ts` with `baseUrl`, `defaultHeaders`, `buildAuthHeader`, `parseRateLimit`, response schemas, and `endpoints`
2. Define `backfill.ts` with entity handlers for each entity type
3. Wire into the provider's `defineProvider()` call

**Using the proxy from a new consumer (not backfill):**
1. Import the gateway client
2. Call `gw.executeApi(installationId, { endpointId, ... })`
3. Parse the response using `providerDef.api.endpoints[endpointId].responseSchema.parse(raw.data)`
4. Handle rate limits with `providerDef.api.parseRateLimit(new Headers(raw.headers))`

No changes needed in gateway for any of these scenarios. The proxy works with any provider's API catalog automatically.

## References

- v2 plan: `thoughts/shared/plans/2026-03-10-backfill-provider-unification-v2.md`
- Current `ProviderDefinition`: `packages/console-providers/src/define.ts:133-181`
- Current `BackfillConnector`: `packages/console-backfill/src/types.ts:44-58`
- GitHub connector: `packages/console-backfill/src/connectors/github.ts`
- Vercel connector: `packages/console-backfill/src/connectors/vercel.ts`
- GitHub adapters: `packages/console-backfill/src/adapters/github.ts`
- Vercel adapters: `packages/console-backfill/src/adapters/vercel.ts`
- Entity worker: `apps/backfill/src/workflows/entity-worker.ts`
- Orchestrator: `apps/backfill/src/workflows/backfill-orchestrator.ts`
- Estimate endpoint: `apps/backfill/src/routes/estimate.ts`
- Gateway connections: `apps/gateway/src/routes/connections.ts`
- Gateway client: `packages/gateway-service-clients/src/gateway.ts`
