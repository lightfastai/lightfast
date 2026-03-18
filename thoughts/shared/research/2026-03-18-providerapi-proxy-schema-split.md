---
date: 2026-03-18T04:50:41Z
researcher: claude
git_commit: dc3ec591e028b8e5d7c542ddfef56441d6deaf1a
branch: refactor/define-ts-provider-redesign
repository: lightfast
topic: "Why ProviderApi/ApiEndpoint and proxyExecuteRequest/Response are two schemas — and the type-safety gap between them"
tags: [research, codebase, console-providers, gateway, proxy, type-safety, api-endpoints, oauth]
status: complete
last_updated: 2026-03-18
---

# Research: ProviderApi/ApiEndpoint vs. proxyExecuteRequest/Response — Two Schemas, One Proxy

**Date**: 2026-03-18T04:50:41Z
**Git Commit**: dc3ec591e028b8e5d7c542ddfef56441d6deaf1a
**Branch**: refactor/define-ts-provider-redesign

## Research Question

After Phase 6, there are two distinct schema systems for API endpoints in `packages/console-providers`:

1. `ApiEndpoint` / `ProviderApi` — TypeScript interfaces describing what endpoints a provider exposes
2. `proxyExecuteRequestSchema` / `proxyExecuteResponseSchema` — Zod schemas describing the wire protocol for calling through the gateway proxy

Why do both exist? Can they be collapsed? How does the proxy wire protocol relate to the OAuth/auth system? Where is the type-safety gap between them?

---

## Summary

The two schemas serve fundamentally different purposes at different abstraction levels. **They cannot be fully collapsed** because `ProviderApi` contains functions and Zod types that are not JSON-serializable. However, a significant type-safety gap exists between them: `proxyExecuteRequest.endpointId` is typed as a plain `string` with no connection to the catalog of valid endpoint keys, and `pathParams` carries no knowledge of the `{param}` placeholders in the endpoint's `path`. The auth system (`buildAuth` vs. default `getActiveToken`) is also invisible at the call site.

Every production network call to an upstream provider API routes through exactly one gateway route: `POST /connections/:id/proxy/execute`. The only exception is `parseRateLimit`, which is a local pure-function call on headers already returned by the proxy — no network bypass exists anywhere in the codebase.

---

## Detailed Findings

### The Two Schema Layers

#### Layer 1 — Provider Catalog: `ProviderApi` / `ApiEndpoint`

**File**: `packages/console-providers/src/define.ts:404–438`

```ts
export interface ApiEndpoint {
  readonly buildAuth?: (config: unknown) => Promise<string>;
  readonly description: string;
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly responseSchema: z.ZodType;
  readonly timeout?: number;
}

export interface ProviderApi {
  readonly baseUrl: string;
  readonly buildAuthHeader?: (token: string) => string;
  readonly defaultHeaders?: Record<string, string>;
  readonly endpoints: Record<string, ApiEndpoint>;
  readonly parseRateLimit: (headers: Headers) => RateLimit | null;
}
```

This is **static, build-time-known provider configuration**. It is:
- Defined once per provider in `providers/*/api.ts`
- Assigned to `BaseProviderFields.api` (line 581 of `define.ts`), which every provider tier inherits
- **Never serialized to JSON** — the `/proxy/endpoints` route explicitly strips `responseSchema` (comment: *"Zod types aren't serializable"*) before responding
- Contains functions: `buildAuth`, `buildAuthHeader`, `parseRateLimit`
- Contains Zod types: `responseSchema`

The gateway reads `ProviderApi` fields in-process. No JSON boundary is crossed when the gateway accesses the catalog.

#### Layer 2 — Gateway Wire Protocol: `proxyExecuteRequestSchema` / `proxyExecuteResponseSchema`

**File**: `packages/console-providers/src/define.ts:344–357`

```ts
export const proxyExecuteRequestSchema = z.object({
  endpointId: z.string(),
  pathParams: z.record(z.string(), z.string()).optional(),
  queryParams: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
});

export const proxyExecuteResponseSchema = z.object({
  status: z.number(),
  data: z.unknown(),
  headers: z.record(z.string(), z.string()),
});
```

This is the **dynamic, per-invocation HTTP payload** that crosses a network boundary:
- The console tRPC layer and backfill service serialize this to JSON and POST it to the gateway
- The gateway validates the response against `proxyExecuteResponseSchema` before returning it to callers
- Contains only JSON-serializable primitives — strings, records of strings, unknown

#### Why They Cannot Be Collapsed

| Dimension | `ProviderApi` / `ApiEndpoint` | `proxyExecuteRequest` / `proxyExecuteResponse` |
|-----------|-------------------------------|------------------------------------------------|
| Nature | Static catalog | Dynamic invocation |
| Serializable? | No — contains functions + Zod types | Yes — pure JSON |
| Network boundary? | No — in-process gateway reads | Yes — crosses HTTP |
| Defined at | Package load / `as const` | Per-request |
| Purpose | "What can be called and how" | "Call this endpoint right now with these args" |

The fundamental blocker: `ApiEndpoint.responseSchema` is a `z.ZodType` — a runtime object that holds parsing logic. It cannot be `JSON.stringify`'d. `buildAuth`, `buildAuthHeader`, and `parseRateLimit` are functions — same issue.

---

### The Wire Flow: How a Proxy Call Works

```
Console tRPC procedure
  → creates gateway client (X-API-Key, X-Correlation-Id)
  → calls gw.executeApi(installationId, { endpointId, pathParams, queryParams, body })
    ↓ JSON over HTTP
  POST /services/gateway/{installationId}/proxy/execute
    ↓ (console Next.js rewrites → gateway Hono service)
  Gateway handler (apps/gateway/src/routes/connections.ts:782–978)
    1. Parses body (endpointId, pathParams, queryParams, body)
    2. Loads gatewayInstallations row from DB
    3. Resolves providerDef = getProvider(installation.provider)
    4. Looks up endpoint = providerDef.api.endpoints[endpointId]  ← CATALOG ACCESS
    5. Gets active token (see Auth Resolution below)
    6. Builds upstream URL: baseUrl + path with {param} substitution
    7. Builds headers: Authorization (via buildAuthHeader or Bearer), defaultHeaders
    8. Fetches upstream provider API with AbortSignal.timeout(endpoint.timeout ?? 30_000)
    9. On 401: refreshes token, retries once
    10. Returns { status, data, headers } (raw, no response schema validation)
    ↓ JSON back over HTTP
  gateway-service-clients proxyExecuteResponseSchema.parse(data)
  → returns ProxyExecuteResponse to tRPC procedure
  → procedure accesses result.data as unknown, result.headers for parseRateLimit
```

**File references:**
- `packages/gateway-service-clients/src/gateway.ts:94–124` — `executeApi()` implementation
- `apps/gateway/src/routes/connections.ts:782–978` — full proxy handler
- `packages/gateway-service-clients/src/urls.ts:18` — URL construction (`/services/gateway`)

---

### Auth Resolution in the Proxy Handler

The gateway handler branches on whether `endpoint.buildAuth` is defined:

```
endpoint.buildAuth defined?
  YES → token = await endpoint.buildAuth(config)
         (bypasses token vault entirely)
  NO  → token = await getActiveTokenForInstallation(...)
         ↓
         reads gatewayTokens from DB (encrypted)
         if expired + refresh token exists:
           decryptedRefreshToken → auth.refreshToken() → write updated tokens to DB
         return auth.getActiveToken(config, externalId, decryptedAccessToken)

After token resolution:
  authHeader = providerDef.api.buildAuthHeader?.(token) ?? `Bearer ${token}`
  headers = { Authorization: authHeader, ...providerDef.api.defaultHeaders }

On 401 response:
  endpoint.buildAuth defined?
    YES → fresh = await endpoint.buildAuth(config)
    NO  → forceRefreshToken() → tries auth.refreshToken(), falls back to auth.getActiveToken(config, externalId, null)
  if fresh !== original: retry with updated Authorization header
```

**File**: `apps/gateway/src/routes/connections.ts:862–956`

#### `buildAuth` vs `buildAuthHeader` — Two Different Auth Fields

These fields operate at different granularities:

| Field | Where | Input | Output | Invoked |
|-------|-------|-------|--------|---------|
| `ApiEndpoint.buildAuth` | Endpoint-level | `config: unknown` (raw provider config) | token `string` | Instead of `getActiveToken` |
| `ProviderApi.buildAuthHeader` | Provider-level | `token: string` (already resolved) | `Authorization` header value | After token is resolved, for all endpoints |

When `buildAuth` is present, it replaces the token-acquisition step. `buildAuthHeader` always runs afterward to format the final header. For GitHub's `get-app-installation`:
- `buildAuth` = `buildGitHubAppAuth` — generates RS256 JWT signed with the app's private key
- `buildAuthHeader` = absent → `Bearer ${jwt}` (default)

So the Authorization header becomes `Bearer <RS256-JWT>` for that endpoint, while all other GitHub endpoints get `Bearer <installation-access-token>`.

---

### Providers Implementing `ProviderApi`

#### GitHub — `packages/console-providers/src/providers/github/api.ts`

| Endpoint key | Method | Path | `buildAuth` |
|---|---|---|---|
| `get-app-installation` | GET | `/app/installations/{installation_id}` | `buildGitHubAppAuth` (RS256 JWT) |
| `list-installation-repos` | GET | `/installation/repositories` | — |
| `get-repo` | GET | `/repos/{owner}/{repo}` | — |
| `get-file-contents` | GET | `/repos/{owner}/{repo}/contents/{path}` | — |
| `list-pull-requests` | GET | `/repos/{owner}/{repo}/pulls` | — |
| `list-issues` | GET | `/repos/{owner}/{repo}/issues` | — |

- `buildAuthHeader`: absent (default `Bearer`)
- `defaultHeaders`: `{ Accept: "application/vnd.github.v3+json" }`

#### Linear — `packages/console-providers/src/providers/linear/api.ts`

| Endpoint key | Method | Path | `buildAuth` |
|---|---|---|---|
| `graphql` | POST | `/graphql` | — |

- `buildAuthHeader`: absent
- `defaultHeaders`: `{ "Content-Type": "application/json" }`

#### Sentry — `packages/console-providers/src/providers/sentry/api.ts`

| Endpoint key | Method | Path | `buildAuth` |
|---|---|---|---|
| `list-projects` | GET | `/api/0/projects/` | — |
| `list-organizations` | GET | `/api/0/organizations/` | — |
| `list-org-issues` | GET | `/api/0/organizations/{organization_slug}/issues/` | — |
| `list-events` | GET | `/api/0/projects/{organization_slug}/{project_slug}/events/` | — |

- `buildAuthHeader`: explicit `(token) => \`Bearer ${token}\`` (same as default)

#### Vercel — `packages/console-providers/src/providers/vercel/api.ts`

| Endpoint key | Method | Path | `buildAuth` |
|---|---|---|---|
| `get-team` | GET | `/v2/teams/{team_id}` | — |
| `get-user` | GET | `/v2/user` | — |
| `list-projects` | GET | `/v9/projects` | — |
| `list-deployments` | GET | `/v6/deployments` | — |

- `buildAuthHeader`: absent

#### Apollo — `packages/console-providers/src/providers/apollo/api.ts`

| Endpoint key | Method | Path | timeout | `buildAuth` |
|---|---|---|---|---|
| `search-people` | POST | `/mixed_people/search` | 30_000 | — |
| `search-organizations` | POST | `/mixed_companies/search` | 30_000 | — |
| `get-account` | GET | `/accounts/{account_id}` | 15_000 | — |

- `buildAuthHeader`: `(apiKey) => \`Api-Key ${apiKey}\`` — non-Bearer required by Apollo's API
- `defaultHeaders`: `{ "Content-Type": "application/json", "Cache-Control": "no-cache" }`

---

### All `executeApi()` Call Sites

Every network call to an upstream provider API routes through `POST /connections/:id/proxy/execute`.

| Call site | File:line | `endpointId` |
|---|---|---|
| `github.validate` | `api/console/src/router/org/connections.ts:232` | `"get-app-installation"` |
| `github.detectConfig` (repo) | `...connections.ts:334` | `"get-repo"` |
| `github.detectConfig` (file) | `...connections.ts:368` | `"get-file-contents"` |
| `generic.listInstallations` → `enrichInstallation` | `...connections.ts:511` | provider-defined |
| `generic.listResources` → `listResources` | `...connections.ts:573` | provider-defined |
| Backfill entity-worker | `apps/backfill/src/workflows/entity-worker.ts:112` | `entityHandler.endpointId` |

The **only `providerDef.api.*` access that is not a proxy call** is `parseRateLimit` in `apps/backfill/src/workflows/entity-worker.ts:132` — a local pure-function call that takes headers already returned from a completed proxy response. No network is involved.

No relay, backfill routing layer, or console tRPC procedure calls any upstream provider API endpoint directly.

---

### The `/proxy/endpoints` Route — What Gets Serialized

`GET /connections/:id/proxy/endpoints` (`apps/gateway/src/routes/connections.ts:737–772`) iterates `providerDef.api.endpoints` and serializes only the JSON-safe subset per endpoint:

```ts
{ method, path, description, timeout? }  // responseSchema stripped
```

Response shape is `proxyEndpointsResponseSchema` (`packages/console-providers/src/gateway.ts:45–60`):

```ts
z.object({
  provider: z.string(),
  baseUrl: z.string(),
  endpoints: z.record(z.string(), z.object({
    method: z.enum(["GET", "POST"]),
    path: z.string(),
    description: z.string(),
    timeout: z.number().optional(),
  })),
})
```

`responseSchema` is stripped here — this route is a runtime catalog browser, not an execution endpoint.

---

### The Type-Safety Gap

The current `proxyExecuteRequestSchema` is fully untyped relative to the catalog:

1. **`endpointId: z.string()`** — accepts any string. No check that the value is a valid key in `PROVIDERS[provider].api.endpoints` at the call site, compile time, or schema-parse time.

2. **`pathParams: z.record(z.string(), z.string())`** — accepts any key-value map. No check that the provided keys match the `{param}` placeholders in `endpoint.path` (e.g., `{installation_id}` requires `pathParams.installation_id`).

3. **Auth mode is invisible at the call site** — callers cannot tell from the type whether `endpointId: "get-app-installation"` will use a JWT or an installation token. The `buildAuth` override is resolved inside the gateway handler at runtime.

4. **`responseSchema` is unused on the wire** — each endpoint defines its own `z.ZodType` for validating the upstream response body, but the gateway never applies it. The response `data` is always typed as `unknown` by `proxyExecuteResponseSchema`. The caller must cast or re-validate manually.

The type-level machinery built in Phase 4 (Step 8B/8C — `EventKey` mapped type, `ProviderShape<K>`, `AuthDefFor<K>`) establishes the pattern for closing this gap: deriving `EndpointKey<P>` from `PROVIDERS[P]["api"]["endpoints"]`, narrowing `pathParams` keys from `{param}` placeholders via template literal types, and surfacing `buildAuth` presence as a type-level discriminant. That work is not yet done.

---

## Architecture Documentation

```
packages/console-providers/
  src/define.ts
    ApiEndpoint              ← endpoint catalog entry (functions + Zod + metadata)
    ProviderApi              ← provider API catalog (functions + endpoints record)
    proxyExecuteRequestSchema  ← wire protocol request (JSON-safe)
    proxyExecuteResponseSchema ← wire protocol response (JSON-safe)
  src/gateway.ts
    proxyEndpointsResponseSchema ← /proxy/endpoints response (JSON-safe, responseSchema stripped)
  src/providers/*/api.ts
    <provider>Api: ProviderApi  ← static catalog per provider

packages/gateway-service-clients/
  src/gateway.ts
    executeApi()        ← POSTs proxyExecuteRequest, validates proxyExecuteResponse
    getApiEndpoints()   ← GETs proxy/endpoints, validates proxyEndpointsResponse

apps/gateway/
  src/routes/connections.ts
    GET /:id/proxy/endpoints  ← serializes ProviderApi catalog (strips non-JSON fields)
    POST /:id/proxy/execute   ← resolves token, builds URL/headers, calls upstream, returns raw

api/console/
  src/router/org/connections.ts
    5 call sites → gw.executeApi(installationId, { endpointId, ... })

apps/backfill/
  src/workflows/entity-worker.ts
    gw.executeApi()                           ← proxy call
    providerDef.api.parseRateLimit(headers)   ← local pure call on returned headers
```

---

## Code References

- `packages/console-providers/src/define.ts:344–357` — `proxyExecuteRequestSchema`, `proxyExecuteResponseSchema`
- `packages/console-providers/src/define.ts:404–438` — `ApiEndpoint`, `ProviderApi` interfaces
- `packages/console-providers/src/define.ts:581` — `api: ProviderApi` on `BaseProviderFields`
- `packages/console-providers/src/gateway.ts:45–60` — `proxyEndpointsResponseSchema`
- `packages/console-providers/src/providers/github/api.ts:75–82` — `buildGitHubAppAuth` (only `buildAuth` implementation)
- `packages/console-providers/src/providers/github/api.ts:128–184` — GitHub `ProviderApi` definition
- `packages/console-providers/src/providers/apollo/api.ts:20–51` — Apollo `ProviderApi` (non-Bearer `buildAuthHeader`)
- `packages/gateway-service-clients/src/gateway.ts:94–124` — `executeApi()`
- `packages/gateway-service-clients/src/gateway.ts:126–140` — `getApiEndpoints()`
- `packages/gateway-service-clients/src/urls.ts:18` — gateway URL via `/services/gateway` rewrite
- `apps/gateway/src/routes/connections.ts:737–772` — `GET /:id/proxy/endpoints` handler
- `apps/gateway/src/routes/connections.ts:782–978` — `POST /:id/proxy/execute` handler
- `apps/gateway/src/routes/connections.ts:862–892` — auth resolution branch (`buildAuth` vs `getActiveToken`)
- `apps/gateway/src/routes/connections.ts:907–927` — header construction
- `apps/gateway/src/routes/connections.ts:929–956` — 401 retry loop
- `api/console/src/router/org/connections.ts:232` — `get-app-installation` call (exercises `buildAuth`)
- `apps/backfill/src/workflows/entity-worker.ts:112` — backfill proxy call
- `apps/backfill/src/workflows/entity-worker.ts:132` — `parseRateLimit` local call

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-03-18-provider-architecture-redesign.md` — Phase 6 moved `proxyExecuteRequestSchema`, `proxyExecuteResponseSchema`, `backfillDepthSchema`, and `BACKFILL_DEPTH_OPTIONS` from `gateway.ts` into `define.ts`. Phase 4 Step 8B established the `EventKey` mapped-type pattern that could extend to `EndpointKey<P>`.

## Open Questions

1. **`EndpointKey<P>` narrowing** — Phase 4 Step 8 derived `EventKey` from `PROVIDERS[K]["events"]` using a mapped type. An equivalent `EndpointKey<P>` could be derived from `PROVIDERS[P]["api"]["endpoints"]`, narrowing `endpointId` at call sites where the provider is known at compile time.

2. **`pathParams` key inference** — Template literal type extraction of `{param}` placeholders from `endpoint.path` strings would close the param-mismatch gap. Feasible in TypeScript using inductive conditional types.

3. **`responseSchema` application** — The gateway currently returns `data: unknown`. Applying `endpoint.responseSchema.parse(data)` inside the handler would produce validated data, though the response type would still be erased at the `proxyExecuteResponseSchema` boundary unless the generic is threaded through.

4. **Auth mode as a discriminant** — `buildAuth` presence is currently a runtime branch invisible to callers. A type-level `HasBuildAuth<P, E>` conditional could surface this, matching the `AuthDefFor<K>` pattern from Phase 4 Step 8C.
