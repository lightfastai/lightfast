# Proxy Endpoint Type-Safety — Implementation Plan

## Overview

Close the type-safety gap between `proxyExecuteRequestSchema` (gateway wire protocol) and the `ProviderApi`/`ApiEndpoint` catalog. Currently `endpointId` is a plain `string`, `pathParams` is an unconstrained record, `responseSchema` is never applied at the wire boundary, and the `buildAuth` override is invisible at call sites. This plan adds compile-time constraints that mirror the Phase 4 Step 8 Phantom Provider Graph pattern (`EventKey`, `ProviderShape<K>`, `AuthDefFor<K>`).

Based on research at `thoughts/shared/research/2026-03-18-providerapi-proxy-schema-split.md`.

**Depends on**: Phase 4 complete (Step 8 must exist: `ProviderShape<K>`, `eventKeySchema`)
**Scope**: `packages/console-providers` + `packages/gateway-service-clients` only. No gateway route changes.

## Current State

```
proxyExecuteRequestSchema = z.object({
  endpointId: z.string(),          ← any string — no catalog check
  pathParams: z.record(...),       ← any keys — no {param} enforcement
  queryParams: z.record(...),      ← unconstrained
  body: z.unknown().optional(),
})
```

Five call sites in `api/console/src/router/org/connections.ts` and one in `apps/backfill` all pass `endpointId` as a raw string literal. No TypeScript error if you typo `"get-app-instalation"`.

## Desired End State

```typescript
// At a call site with a known provider:
gw.executeApi(installationId, {
  endpointId: "get-app-installation",    // ← narrows to EndpointKey<"github">
  pathParams: { installation_id: "..." } // ← inferred as required from path template
});
// TypeScript error: "get-app-instalation" not assignable to EndpointKey<"github">
// TypeScript error: pathParams missing required key "installation_id"

// Result data is typed, not unknown:
result.data // → z.infer<typeof PROVIDERS["github"]["api"]["endpoints"]["get-app-installation"]["responseSchema"]>
```

## What We're NOT Doing

- **Generic gateway route** — The gateway handler stays untyped (`config: unknown`, `endpointId: string`). Generics cannot cross HTTP. The handler is the executor, not the type boundary.
- **Runtime `pathParams` validation** — Extracting required params from `{param}` placeholders is a type-level concern only. The gateway already fails at URL-build time if a required `{param}` is missing (it leaves the literal `{param}` in the URL). Runtime validation is not added.
- **`queryParams` narrowing** — Query params are endpoint-specific and variable. Leave as `z.record(z.string(), z.string())`.
- **`parseRateLimit` typing** — Already well-typed at the call site in backfill.

---

## Phase A: `EndpointKey<P>` — Mapped Type + Zod Enum

### Overview

Derive `EndpointKey<P>` as a mapped type from `PROVIDERS[P]["api"]["endpoints"]`, analogous to `EventKey` from Phase 4 Step 8B. Add a runtime Zod enum per provider. Export utility type `EndpointKeysFor<K>` alongside `EventKeysFor<K>`.

### Changes Required

#### 1. Add `EndpointKey<P>` and `endpointKeySchemas` to `registry.ts`

**File**: `packages/console-providers/src/registry.ts`

```typescript
// ── EndpointKey — compile-time mapped type ────────────────────────────────────
// Mirrors EventKey derivation from Step 8B. Auto-updates when endpoints change.

export type EndpointKey<P extends keyof typeof PROVIDERS> =
  keyof (typeof PROVIDERS)[P]["api"]["endpoints"] & string;
// → "get-app-installation" | "list-installation-repos" | ... for P = "github"
// → "graphql" for P = "linear"

// Wide union across all providers (all endpoint keys)
export type AnyEndpointKey = {
  [P in keyof typeof PROVIDERS]: EndpointKey<P>;
}[keyof typeof PROVIDERS];

// ── Utility type: endpoint keys for a provider by slug ────────────────────────
// Extends Phase 4 Step 8C set: ProviderShape, AuthDefFor, AccountInfoFor, EventKeysFor
/** Union of endpoint keys available for a provider by slug. */
export type EndpointKeysFor<K extends keyof typeof PROVIDERS> = EndpointKey<K>;
```

#### 2. Export from `index.ts`

**File**: `packages/console-providers/src/index.ts`

```typescript
// Add to registry exports block:
export type { EndpointKey, AnyEndpointKey, EndpointKeysFor } from "./registry";
```

### Success Criteria

- `type T = EndpointKey<"github">` resolves to `"get-app-installation" | "list-installation-repos" | "get-repo" | "get-file-contents" | "list-pull-requests" | "list-issues"`
- `type T = EndpointKey<"linear">` resolves to `"graphql"`
- `type T = EndpointKeysFor<"apollo">` resolves to `"search-people" | "search-organizations" | "get-account"`
- `pnpm typecheck` passes

---

## Phase B: `PathParams<P, E>` — Template Literal Path Param Inference

### Overview

Derive the required `pathParams` keys for a given provider+endpoint from the `{param}` placeholders in `endpoint.path`. Uses inductive conditional types to extract all `{X}` segments from the path string. If a path has no `{param}` segments, `pathParams` is optional (defaults to `undefined`). If it has params, `pathParams` is required with exactly those keys.

### Design

```typescript
// Extract all {param} segments from a path template string
type ExtractPathParams<Path extends string> =
  Path extends `${string}{${infer Param}}${infer Rest}`
    ? Param | ExtractPathParams<Rest>
    : never;

// If no params: undefined. If params exist: required Record<key, string>
type PathParamsFor<P extends keyof typeof PROVIDERS, E extends EndpointKey<P>> =
  ExtractPathParams<(typeof PROVIDERS)[P]["api"]["endpoints"][E]["path"]> extends never
    ? undefined
    : Record<ExtractPathParams<(typeof PROVIDERS)[P]["api"]["endpoints"][E]["path"]>, string>;
```

**Examples**:
- `PathParamsFor<"github", "get-app-installation">` → `Record<"installation_id", string>`
- `PathParamsFor<"github", "get-repo">` → `Record<"owner" | "repo", string>`
- `PathParamsFor<"github", "list-installation-repos">` → `undefined` (no `{param}` in path)
- `PathParamsFor<"linear", "graphql">` → `undefined`

### Changes Required

#### 1. Add type utilities to `registry.ts`

**File**: `packages/console-providers/src/registry.ts`

```typescript
// ── Path param extraction ─────────────────────────────────────────────────────

type ExtractPathParams<Path extends string> =
  Path extends `${string}{${infer Param}}${infer Rest}`
    ? Param | ExtractPathParams<Rest>
    : never;

/** Required pathParams keys for a given provider + endpoint. `undefined` if path has no {params}. */
export type PathParamsFor<
  P extends keyof typeof PROVIDERS,
  E extends EndpointKey<P>,
> = ExtractPathParams<(typeof PROVIDERS)[P]["api"]["endpoints"][E]["path"]> extends never
  ? undefined
  : Record<
      ExtractPathParams<(typeof PROVIDERS)[P]["api"]["endpoints"][E]["path"]>,
      string
    >;
```

#### 2. Add typed `ProxyRequest<P, E>` shape

**File**: `packages/console-providers/src/registry.ts`

```typescript
import type { ProxyExecuteRequest } from "./define";

/**
 * Typed proxy request for a known provider + endpoint at compile time.
 * Use when the caller knows the provider slug and endpoint key statically.
 *
 * For runtime-dynamic calls (slug from DB): use the base ProxyExecuteRequest.
 */
export type TypedProxyRequest<
  P extends keyof typeof PROVIDERS,
  E extends EndpointKey<P>,
> = Omit<ProxyExecuteRequest, "endpointId" | "pathParams"> & {
  readonly endpointId: E;
  readonly pathParams: PathParamsFor<P, E>;
};
```

#### 3. Export from `index.ts`

**File**: `packages/console-providers/src/index.ts`

```typescript
export type { PathParamsFor, TypedProxyRequest } from "./registry";
```

### Success Criteria

- `type T = PathParamsFor<"github", "get-app-installation">` resolves to `Record<"installation_id", string>`
- `type T = PathParamsFor<"github", "get-repo">` resolves to `Record<"owner" | "repo", string>`
- `type T = PathParamsFor<"linear", "graphql">` resolves to `undefined`
- `type T = TypedProxyRequest<"github", "get-app-installation">` requires `pathParams: { installation_id: string }`
- `type T = TypedProxyRequest<"github", "list-installation-repos">` has `pathParams: undefined`
- `pnpm typecheck` passes

---

## Phase C: `ResponseDataFor<P, E>` — Thread `responseSchema` to Call Sites

### Overview

Each `ApiEndpoint` already carries a `responseSchema: z.ZodType`. Thread the inferred type through to call sites so `result.data` is not `unknown` when the provider and endpoint are statically known.

**Constraint**: The gateway HTTP boundary erases all generics — the wire response is always `{ status, data: unknown, headers }`. Narrowing happens at the call site by reading `PROVIDERS[P].api.endpoints[E].responseSchema.parse(result.data)` — not inside the gateway handler.

### Changes Required

#### 1. Add `ResponseDataFor<P, E>` to `registry.ts`

**File**: `packages/console-providers/src/registry.ts`

```typescript
/** Inferred response data type for a provider + endpoint. */
export type ResponseDataFor<
  P extends keyof typeof PROVIDERS,
  E extends EndpointKey<P>,
> = z.infer<(typeof PROVIDERS)[P]["api"]["endpoints"][E]["responseSchema"]>;
```

#### 2. Add typed `executeApi` overload to `gateway-service-clients`

**File**: `packages/gateway-service-clients/src/gateway.ts`

Add a narrow overload that accepts `TypedProxyRequest<P, E>` and returns `{ status: number; data: ResponseDataFor<P, E>; headers: Record<string, string> }`. The wide overload (plain `ProxyExecuteRequest`) stays as the fallback.

```typescript
import type {
  TypedProxyRequest,
  ResponseDataFor,
  EndpointKey,
} from "@repo/console-providers";

// Narrow overload: known provider + endpoint → typed response data
async executeApi<P extends keyof typeof PROVIDERS, E extends EndpointKey<P>>(
  installationId: string,
  request: TypedProxyRequest<P, E>
): Promise<{ status: number; data: ResponseDataFor<P, E>; headers: Record<string, string> }>;

// Wide overload: runtime-dynamic → data: unknown (existing behavior)
async executeApi(
  installationId: string,
  request: ProxyExecuteRequest
): Promise<ProxyExecuteResponse>;

// Implementation: unchanged — validates with proxyExecuteResponseSchema, applies responseSchema.parse() for the narrow path
async executeApi(installationId: string, request: ProxyExecuteRequest): Promise<ProxyExecuteResponse> {
  // ... existing implementation unchanged
}
```

**Note**: The narrow overload's `data` type assertion is achieved via the return type annotation — the runtime still validates with `proxyExecuteResponseSchema` (which gives `data: unknown`), and the narrow return type tells TypeScript to trust the caller's schema assertion. The caller is responsible for ensuring `request` matches a real endpoint whose `responseSchema` matches the actual response shape. This is the same `as const` trust pattern used throughout the provider catalog.

#### 3. Update existing call sites (optional — non-breaking)

The wide overload is the fallback and all existing call sites continue working. Updating individual call sites to the narrow overload is opt-in:

```typescript
// Before (works, data: unknown):
const result = await gw.executeApi(installationId, {
  endpointId: "get-app-installation",
  pathParams: { installation_id: String(installationId) },
});

// After (narrow, data: GitHubAppInstallation):
const result = await gw.executeApi<"github", "get-app-installation">(installationId, {
  endpointId: "get-app-installation",
  pathParams: { installation_id: String(installationId) },
});
// result.data: ResponseDataFor<"github", "get-app-installation"> — typed
```

#### 4. Export from `index.ts`

**File**: `packages/console-providers/src/index.ts`

```typescript
export type { ResponseDataFor } from "./registry";
```

### Success Criteria

- `type T = ResponseDataFor<"github", "get-app-installation">` resolves to the inferred type of the endpoint's `responseSchema`
- Narrow overload: `result.data` is typed (not `unknown`) when provider + endpoint are statically known
- Wide overload: `result.data` remains `unknown` (existing behavior unchanged)
- `pnpm typecheck` passes across all apps

---

## Phase D: `HasBuildAuth<P, E>` — Auth Mode as Type-Level Discriminant

### Overview

Surface whether a given endpoint uses `buildAuth` (bypasses token vault, generates credentials from provider config) or the default `getActiveToken` flow. This is currently a runtime branch invisible to callers.

### Changes Required

#### 1. Add `HasBuildAuth<P, E>` to `registry.ts`

**File**: `packages/console-providers/src/registry.ts`

```typescript
/**
 * True when endpoint[E] for provider[P] defines buildAuth (bypasses token vault).
 * False when it uses the default getActiveToken → token vault flow.
 *
 * Examples:
 *   HasBuildAuth<"github", "get-app-installation"> → true  (RS256 JWT)
 *   HasBuildAuth<"github", "get-repo">             → false (installation token)
 *   HasBuildAuth<"linear", "graphql">              → false (OAuth token)
 */
export type HasBuildAuth<
  P extends keyof typeof PROVIDERS,
  E extends EndpointKey<P>,
> = (typeof PROVIDERS)[P]["api"]["endpoints"][E] extends { buildAuth: (...args: any[]) => any }
  ? true
  : false;
```

#### 2. Export from `index.ts`

```typescript
export type { HasBuildAuth } from "./registry";
```

### Success Criteria

- `type T = HasBuildAuth<"github", "get-app-installation">` resolves to `true`
- `type T = HasBuildAuth<"github", "get-repo">` resolves to `false`
- `type T = HasBuildAuth<"linear", "graphql">` resolves to `false`
- `pnpm typecheck` passes

---

## Implementation Order

Phases are independent. Recommended order:

1. **Phase A** — Foundation: `EndpointKey<P>`, `EndpointKeysFor<K>` (pure type, no runtime changes)
2. **Phase B** — Builds on A: `PathParamsFor`, `TypedProxyRequest` (pure type, no runtime changes)
3. **Phase C** — Builds on A+B: `ResponseDataFor`, narrow `executeApi` overload (touches `gateway-service-clients`)
4. **Phase D** — Independent of B+C: `HasBuildAuth` (pure type, no runtime changes)

All phases are purely additive — no breaking changes. All existing call sites continue to compile and work.

### Verification at Each Phase

```bash
pnpm typecheck         # zero errors across all apps
pnpm check             # zero lint errors
pnpm --filter @repo/console-providers test   # all tests pass
```

---

## The Closed Type Loop (after all 4 phases)

```
PROVIDERS[P]["api"]["endpoints"]
  ↓
EndpointKey<P>                          ← compile-time catalog keys
PathParamsFor<P, E>                     ← required path params from {param} template
ResponseDataFor<P, E>                   ← typed response via responseSchema inference
HasBuildAuth<P, E>                      ← auth mode discriminant
  ↓
TypedProxyRequest<P, E>                 ← typed wire request (endpointId + pathParams)
  ↓
executeApi<P, E>(id, request)           ← narrow overload → typed result.data
  ↓
Adding an endpoint to a provider:       ← EndpointKey<P> and PathParamsFor update automatically
Typo in endpointId at call site:        ← TypeScript error
Missing pathParam at call site:         ← TypeScript error
```

## References

- Research: `thoughts/shared/research/2026-03-18-providerapi-proxy-schema-split.md`
- Parent plan: `thoughts/shared/plans/2026-03-18-provider-architecture-redesign.md` (Phase 4 Step 8)
- `packages/console-providers/src/define.ts:404–438` — `ApiEndpoint`, `ProviderApi`
- `packages/console-providers/src/define.ts:344–357` — `proxyExecuteRequestSchema`, `proxyExecuteResponseSchema`
- `apps/gateway/src/routes/connections.ts:862–892` — auth resolution branch
- `packages/gateway-service-clients/src/gateway.ts:94–124` — `executeApi()`
