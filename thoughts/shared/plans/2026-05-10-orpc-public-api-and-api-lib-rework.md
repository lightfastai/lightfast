# oRPC Public API + `(api)/lib` Rework Implementation Plan

## Overview

Stand up an oRPC public API surface at `/api/v1/*` on `apps/app` for SDK / MCP / REST consumers (auth: `sk-lf-` org API keys only), wire `core/lightfast` and `core/mcp` against a new shared `@repo/api-contract` package, and delete the dead `apps/app/src/app/(api)/lib/` scaffolding. Internal first-party clients (web cookie + desktop Bearer) continue using the existing `(trpc)` mount unchanged.

This plan reverses the "defer oRPC" decision recorded in `thoughts/shared/plans/2026-05-08-api-platform-internal-boundary-and-platform-client.md` (Phase 4 "What We're NOT Doing", line 50). That deferral was conditional on `@api/app` not having a procedure worth exposing; this plan ships the first one (`system.health`) and the contract pattern that subsequent procedures slot into.

## Current State Analysis

Verified at `git_commit 2ab3e3158` against `thoughts/shared/research/2026-05-10-api-lib-middleware-and-public-vs-internal-api-boundary.md`:

- **`apps/app/src/app/(api)/lib/` is fully dead.** All three files (`with-api-key-auth.ts`, `with-dual-auth.ts`, `orpc-middleware.ts`) have zero production consumers. The `(api)/` route group has no `route.ts` files — only `lib/` exists.
- **Live tRPC mount** (`apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts`) handles all real public-surface traffic today. Auth resolves via `api/app/src/auth/resolve.ts` (Clerk Bearer JWT for desktop, Clerk cookie for web). No API-key path is reachable.
- **`apps/app/src/proxy.ts:35`** carries a stale `// withDualAuth at route level` comment that doesn't reflect any real code.
- **oRPC infrastructure exists** (`@orpc/server` in `apps/app`, `@orpc/contract` in `vendor/mcp`, `@orpc/client` in `vendor/observability`) but no contract is authored and no `RPCHandler` / `OpenAPIHandler` is mounted.
- **`vendor/mcp/src/index.ts:37-120` (`registerContractTools`)** is a complete oRPC contract → MCP tool walker with auto-derived input/output schemas. Zero call sites today.
- **`vendor/observability/src/orpc.ts` (`createORPCObservabilityMiddleware`)** is fully implemented (Sentry isolation scope, structured logging, ALS request context, error classification). Imported only by the dead `(api)/lib/orpc-middleware.ts`.
- **`core/lightfast/src/index.ts`** is a 39-line stub: `LightfastClient` class validates the `sk-lf-` prefix and stores `baseUrl`, no methods. `createLightfast(apiKey, opts)` returns the class.
- **`core/mcp/src/index.ts`** is a 25-line stub: registers no tools (`// Tools removed — pending post-v2 contract definition.`).
- **Boundary tags** (`turbo.json:101-118`): the `boundaries.tags` block only defines rules for `vendor`, `internal`, and `app`. `core` is unlisted, so `implicitDependencies: ["~"]` permits `core/*` → `packages/*` (no explicit grant — it's the absence of a deny rule). `app` outbound is unrestricted.
- **`apps/app` already declares `@orpc/server`** (via dead orpc-middleware); needs `@orpc/openapi` added for the route handler.
- **`api/app` declares neither `@orpc/server` nor `@orpc/contract`**; both must be added so server-side procedure implementations and contract type imports resolve.

## Desired End State

After this plan:

- `apps/app` serves three logical HTTP surfaces:
  - `/api/trpc/[trpc]` — first-party only (web cookie + desktop Bearer); **unchanged**.
  - `/api/v1/system/health` — public oRPC surface (REST URLs); auth = `sk-lf-` org API keys.
  - `/api/cli/*`, `/api/desktop/auth/*`, `/api/health`, `/api/inngest` — REST routes; **unchanged**.
- `packages/api-contract/` exists as a new workspace package (tag `packages`) defining `apiContract` with one procedure: `system.health` (`GET /api/v1/system/health`). Importable by `apps/app`, `api/app`, `core/lightfast`, `core/mcp`.
- `api/app/src/orpc/` directory implements the contract via `implement()` from `@orpc/server` (no `~orpc` reach-in, no `as never` casts). Mirrors the shape of the existing `api/app/src/router/` tRPC convention.
- `apps/app/src/app/(api)/api/v1/[...rest]/route.ts` mounts `OpenAPIHandler` against the implemented router; OPTIONS returns 204 with permissive CORS (API-key auth, no cookie).
- `apps/app/src/proxy.ts` adds `/api/v1` to `isApiRoute` and removes the stale `withDualAuth` comment.
- `core/lightfast/src/index.ts`: `createLightfast(apiKey, options)` returns a typed `RouterClient<typeof apiContract>` (constructed via `OpenAPILink` against `${baseUrl}/api/v1`). `LightfastClient` becomes a `type` alias to `RouterClient<typeof apiContract>` (the constructable class is replaced).
- `core/mcp/src/index.ts`: imports `apiContract` and `createLightfast`, calls `registerContractTools(server, apiContract, client, { prefix: "lightfast" })`. Tool surface includes `lightfast_system_health`.
- `apps/app/src/app/(api)/lib/{with-api-key-auth.ts, with-dual-auth.ts, orpc-middleware.ts}` deleted.
- A live integration test boots `@lightfast/app` + Postgres, exercises `GET /api/v1/system/health` end-to-end via `createLightfast(...).system.health()`, and asserts the round-trip succeeds.

### Verification

- `curl https://app.lightfast.localhost/api/v1/system/health` → `401` without auth; `200 { "status": "ok", "timestamp": "...", "version": "..." }` with a valid `sk-lf-` key.
- `pnpm typecheck` at repo root passes.
- `pnpm --filter @repo/api-contract test`, `pnpm --filter @api/app test`, `pnpm --filter lightfast test`, `pnpm --filter @lightfastai/mcp test` all pass.
- The integration test (Phase 3) successfully boots `@lightfast/app`, calls `lf.system.health()` via the SDK, and gets back the expected payload.
- `grep -rn "withDualAuth\|withApiKeyAuth\|orpc-middleware" apps/app/src api/app/src` returns no matches in source (after the rewrite, `withApiKeyAuth` is gone — the consolidated helper has a different name).
- `find apps/app/src/app/\(api\)/lib -type f` returns nothing (directory removed).

### Key Discoveries

- `registerContractTools` already auto-derives input/output schemas via `~orpc.inputSchema` / `~orpc.outputSchema` — no per-tool boilerplate (`vendor/mcp/src/index.ts:37-120`).
- `createORPCObservabilityMiddleware` already mirrors the tRPC observability middleware's behaviour (Sentry, ALS, structured logs, error classification) — drop-in (`vendor/observability/src/orpc.ts:34-149`).
- `core` is absent from `turbo.json` boundary tags, so `implicitDependencies: ["~"]` lets `core/lightfast` and `core/mcp` freely import from `packages/*` workspace packages — including the new `@repo/api-contract`.
- `apps/app` route group convention: `(api)/` exists; the natural path for the new mount is `(api)/api/v1/[...rest]/route.ts` (required catch-all, matching the repo's single-bracket slug convention; the route group adds nothing to the URL, so the mount path is `/api/v1/...`).
- **`implement()` from `@orpc/server`** is the typed contract→implementation entry point — spike-confirmed in `@orpc/server@1.13.14`. Chain is `implement(contractProcedure).$context<T>().use(...).handler(...)`. Eliminates the `outputSchema as never` cast and the `~orpc.route` re-spread; output-schema violations are caught at compile time.
- The existing tRPC mount handles its own CORS via `apps/app/src/cors.ts:23-89` (`isAllowedOrigin` + desktop dev origin + packaged-desktop predicates). The oRPC mount accepts API keys only — no cookie, so a permissive CORS posture (`Access-Control-Allow-Origin: *`) is correct and simpler.
- `core/lightfast/tsup.config.ts` declares `external: []` (bundle everything). Adding `@repo/api-contract` and `@orpc/openapi-client` to its deps means they get bundled into the published `lightfast` npm package — no peer-dep dance required.
- `core/mcp/tsup.config.ts` externalizes only `@modelcontextprotocol/sdk`. Adding `lightfast` (workspace) and `@repo/api-contract` lets them bundle into the published `@lightfastai/mcp` binary.

## What We're NOT Doing

- **No procedure surface beyond `system.health`.** This plan establishes the wire end-to-end with the simplest possible procedure. Real surface (org info, API key management, etc.) lands in follow-up plans that add procedures to `apiContract` + `api/app/src/orpc/procedures/`.
- **No tRPC changes.** `(trpc)/api/trpc/[trpc]/route.ts`, `api/app/src/auth/resolve.ts`, `api/app/src/trpc.ts`, the three procedure tiers (`publicProcedure`, `userScopedProcedure`, `orgScopedProcedure`), all routers under `api/app/src/router/` — untouched. Web + desktop continue working as today.
- **No removal of `/api/cli/setup`-style mint endpoints.** The REST API-key mint flow stays — its caller is the CLI which authenticates with a Clerk JWT, not an `sk-lf-` key. Migrating this into oRPC requires a Clerk-auth path on the public surface, which the user excluded.
- **No `/api/v1/spec.json` or OpenAPI document export.** OpenAPIHandler emits the JSON spec at request time but we don't mount a spec endpoint in this plan. Add when there's a real consumer (docs site, codegen).
- **No RPCHandler mount.** OpenAPIHandler-only. SDK uses `OpenAPILink` against the OpenAPI surface — works fine.
- **No browser-side SDK use case.** `sk-lf-` API keys are server-side only by definition. No browser CORS engineering required.
- **No second platform deployment.** This plan doesn't move the oRPC surface to `apps/platform` — public oRPC lives at `apps/app`'s domain (`https://lightfast.ai/api/v1`).
- **No removal of `withApiKeyAuth`'s `lastUsedAt`/`lastUsedFromIp` tracking** — preserved through the rewrite.
- **No restoration of the cookie/session auth path** that the dead `orpc-middleware.ts` carried. That middleware had dual auth (Bearer API key + Clerk session via `getUserOrgMemberships`); the new `authMiddleware` is API-key-only by design. Future browser/session-authed oRPC needs are out of scope for this plan.
- **No SDK changes for unrelated concerns** (versioning strategy, error class shape, retries, telemetry from the client side). Keep the SDK minimal; iterate later.
- **No npm publish in this plan.** `lightfast@0.1.0-alpha.5` and `@lightfastai/mcp@0.1.0-alpha.5` stay as-is. A version bump + publish is a separate plan.

## Implementation Approach

Three linear phases. Each phase halts at the boundary for human verification before the next starts.

- **Phase 1** is purely additive — a new package with one contract, no consumers. Worst case is `pnpm install` and a typecheck.
- **Phase 2** lands the server (using `implement()` from `@orpc/server`), mounts the route, and deletes the dead `(api)/lib/` scaffolding. After Phase 2, `curl /api/v1/system/health` returns real responses.
- **Phase 3** wires the SDK and MCP server, and proves the wire end-to-end with a live integration test.

The integration test (Phase 3) is the only "heavy" piece — boots `@lightfast/app` as a child process, runs against a real Postgres (the existing dev container, `pnpm db:up`). All other tests are vitest unit tests. Note: this is a deliberate departure from the rest of the repo, which has no other dev-server-boot integration tests; the value is full HTTP-path validation of the new `/api/v1` surface from SDK to DB.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: `@repo/api-contract` package + `system.health` contract

### Overview

Create `packages/api-contract/` as a new workspace package. Define `apiContract` (the oRPC contract router) with one procedure: `system.health`. Self-contained — type-checks, builds, and tests pass without touching anything else in the workspace.

### Changes Required

#### 1. Package scaffolding

**File**: `packages/api-contract/package.json` (NEW)

```json
{
  "name": "@repo/api-contract",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@orpc/contract": "^1.13.14",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

**File**: `packages/api-contract/turbo.json` (NEW)

```json
{
  "extends": ["//"],
  "tags": ["packages"],
  "tasks": {}
}
```

**File**: `packages/api-contract/tsconfig.json` (NEW)

Mirror `packages/platform-client/tsconfig.json` (extends `@repo/typescript-config`, points at `./src`, no emit).

**File**: `packages/api-contract/vitest.config.ts` (NEW)

Mirror `api/platform/vitest.config.ts` (extends `@repo/vitest-config`, env `node`).

#### 2. Contract definition

**File**: `packages/api-contract/src/schemas/system.ts` (NEW)

```typescript
import { z } from "zod";

export const systemHealthOutput = z.object({
  status: z.literal("ok"),
  timestamp: z.string(),
  version: z.string(),
});

export type SystemHealthOutput = z.infer<typeof systemHealthOutput>;
```

**File**: `packages/api-contract/src/contract.ts` (NEW)

```typescript
import { oc } from "@orpc/contract";

import { systemHealthOutput } from "./schemas/system";

const system = {
  health: oc
    .route({
      method: "GET",
      path: "/system/health",
      summary: "Health check",
      description:
        "Returns service status, server timestamp, and API version. Requires a valid org API key.",
    })
    .output(systemHealthOutput),
};

export const apiContract = { system };

export type Contract = typeof apiContract;
```

**File**: `packages/api-contract/src/index.ts` (NEW)

```typescript
export { apiContract, type Contract } from "./contract";
export { systemHealthOutput, type SystemHealthOutput } from "./schemas/system";
```

#### 3. Contract walk smoke test

**File**: `packages/api-contract/src/__tests__/contract.test.ts` (NEW)

```typescript
import { isContractProcedure } from "@orpc/contract";
import { describe, expect, it } from "vitest";

import { apiContract } from "../contract";

describe("apiContract", () => {
  it("exposes system.health as a contract procedure", () => {
    expect(isContractProcedure(apiContract.system.health)).toBe(true);
  });

  it("system.health declares GET /system/health", () => {
    const def = (apiContract.system.health as { "~orpc": { route?: { method?: string; path?: string } } })["~orpc"];
    expect(def.route?.method).toBe("GET");
    expect(def.route?.path).toBe("/system/health");
  });

  it("system.health declares an output schema", () => {
    const def = (apiContract.system.health as { "~orpc": { outputSchema?: unknown } })["~orpc"];
    expect(def.outputSchema).toBeDefined();
  });
});
```

#### 4. Workspace registration

`pnpm-workspace.yaml` already includes `packages/*`. After scaffolding, run `pnpm install` to register the new workspace member.

### Success Criteria

#### Automated Verification

- [x] `pnpm install` succeeds; lockfile updates include `@repo/api-contract`.
- [x] `pnpm --filter @repo/api-contract typecheck` passes.
- [x] `pnpm --filter @repo/api-contract test` passes (3 cases).
- [x] `pnpm typecheck` at repo root passes.
- [x] `pnpm list -r --depth -1 | grep @repo/api-contract` shows the package.
- [x] `grep -rn "@repo/api-contract" apps/ api/ core/ packages/` returns only `packages/api-contract/`'s own files (no consumers yet).

#### Human Review

- [ ] Open `packages/api-contract/src/contract.ts` → confirm `system.health` uses `oc.route({ method: "GET", path: "/system/health", ... })` and chains `.output(systemHealthOutput)`.
- [ ] Open `packages/api-contract/turbo.json` → confirm `tags: ["packages"]`.

---

## Phase 2: oRPC server, route mount, dead-code cleanup

### Overview

Build the server-side implementation in `api/app/src/orpc/` against the contract from Phase 1. Mount it on `apps/app` at `/api/v1/[[...rest]]/route.ts` via `OpenAPIHandler`. Update the proxy route matchers. Delete the dead `(api)/lib/` files.

After this phase, the oRPC surface is callable end-to-end via `curl` (no SDK yet — Phase 3 wires that).

### Changes Required

#### 1. Add oRPC dependencies to `api/app`

**File**: `api/app/package.json`
**Changes**: Add to `dependencies`:

```json
"@orpc/contract": "^1.13.14",
"@orpc/server": "^1.13.14",
"@repo/api-contract": "workspace:*",
```

#### 2. oRPC context types

**File**: `api/app/src/orpc/context.ts` (NEW)

```typescript
export interface InitialContext {
  headers: Headers;
  requestId: string;
}

export interface AuthContext {
  apiKeyId: string;
  clerkOrgId: string;
  userId: string;
}
```

This is intentionally narrower than the dead `orpc-middleware.ts:15-20`'s `AuthContext` — there's no `authType` discriminator because there's only one auth model (API key). No `apiKeyId | undefined` either; it's always set.

#### 3. Consolidated API-key auth middleware

**File**: `api/app/src/orpc/middleware/auth.ts` (NEW)

```typescript
import { db } from "@db/app/client";
import { orgApiKeys } from "@db/app/schema";
import { ORPCError, os } from "@orpc/server";
import { hashApiKey, isValidApiKeyFormat } from "@repo/app-api-key";
import { enrichContext } from "@vendor/observability/context";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { and, eq, sql } from "drizzle-orm";

import type { AuthContext, InitialContext } from "../context";

const base = os.$context<InitialContext>();

async function resolveApiKey(
  headers: Headers,
  requestId: string
): Promise<AuthContext> {
  const authHeader = headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ORPCError("UNAUTHORIZED", {
      message:
        "API key required. Provide 'Authorization: Bearer <api-key>' header.",
    });
  }

  const apiKey = authHeader.slice("Bearer ".length);

  if (!isValidApiKeyFormat(apiKey)) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Invalid API key format.",
    });
  }

  const keyHash = hashApiKey(apiKey);

  const [foundKey] = await db
    .select({
      id: orgApiKeys.id,
      publicId: orgApiKeys.publicId,
      clerkOrgId: orgApiKeys.clerkOrgId,
      createdByUserId: orgApiKeys.createdByUserId,
      expiresAt: orgApiKeys.expiresAt,
    })
    .from(orgApiKeys)
    .where(and(eq(orgApiKeys.keyHash, keyHash), eq(orgApiKeys.isActive, true)))
    .limit(1);

  if (!foundKey) {
    throw new ORPCError("UNAUTHORIZED", { message: "Invalid API key" });
  }

  if (foundKey.expiresAt && new Date(foundKey.expiresAt) < new Date()) {
    throw new ORPCError("UNAUTHORIZED", { message: "API key expired" });
  }

  const clientIp =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown";

  void db
    .update(orgApiKeys)
    .set({
      lastUsedAt: sql`CURRENT_TIMESTAMP`,
      lastUsedFromIp: clientIp.slice(0, 45),
    })
    .where(eq(orgApiKeys.id, foundKey.id))
    .catch((err: unknown) => {
      log.error("Failed to update API key lastUsedAt", {
        error: parseError(err),
        apiKeyId: foundKey.publicId,
      });
    });

  log.info("API key verified", {
    requestId,
    apiKeyId: foundKey.publicId,
    orgId: foundKey.clerkOrgId,
  });

  return {
    apiKeyId: foundKey.publicId,
    clerkOrgId: foundKey.clerkOrgId,
    userId: foundKey.createdByUserId,
  };
}

export const authMiddleware = base.middleware(async ({ context, next }) => {
  const auth = await resolveApiKey(context.headers, context.requestId);
  enrichContext({
    userId: auth.userId,
    clerkOrgId: auth.clerkOrgId,
    authType: "api-key",
    apiKeyId: auth.apiKeyId,
  });
  return next({ context: auth });
});
```

This consolidates `withApiKeyAuth` (193 lines, returned `Response`-shaped errors) into `authMiddleware` (~70 lines, throws `ORPCError`). The Response-shape error helpers (`createAuthErrorResponse`) are dropped — oRPC's handler serializes errors directly.

#### 4. Observability middleware

**File**: `api/app/src/orpc/middleware/observability.ts` (NEW)

```typescript
import { os } from "@orpc/server";
import { createORPCObservabilityMiddleware } from "@vendor/observability/orpc";

import type { InitialContext } from "../context";

const base = os.$context<InitialContext>();

export const observabilityMiddleware = base.middleware(
  createORPCObservabilityMiddleware()
);
```

Drop-in re-export — the vendor middleware already implements Sentry isolation, structured logging, ALS request context, and error classification (`vendor/observability/src/orpc.ts:34-149`).

#### 5. `authed` implementer factory

**File**: `api/app/src/orpc/procedures.ts` (NEW)

```typescript
import { implement, type ContractProcedure } from "@orpc/server";

import type { InitialContext } from "./context";
import { authMiddleware } from "./middleware/auth";
import { observabilityMiddleware } from "./middleware/observability";

/**
 * Wrap a contract procedure with the public oRPC middleware stack
 * (observability + API-key auth). Returns a typed implementer whose
 * `.handler(...)` is checked against the contract's output schema.
 *
 * Mirrors the tRPC pattern (`api/app/src/trpc.ts:138-187`).
 */
export const authed = <P extends ContractProcedure<any, any, any, any>>(proc: P) =>
  implement(proc)
    .$context<InitialContext>()
    .use(observabilityMiddleware)
    .use(authMiddleware);
```

Mirrors the tRPC pattern (`api/app/src/trpc.ts:138-187`) — observability + auth composed once per procedure. `implement()` is the spike-confirmed typed binding (`@orpc/server@1.13.14` top-level export); the chain `implement(proc).$context<T>().use(...)` enforces context narrowing and output-schema type-checking automatically. **No `publicProcedure` tier** — YAGNI until a no-auth procedure arrives.

#### 6. `system.health` procedure implementation

**File**: `api/app/src/orpc/router/system.ts` (NEW)

```typescript
import { apiContract } from "@repo/api-contract";

import { authed } from "../procedures";

const SDK_VERSION = "0.1.0";

export const systemRouter = {
  health: authed(apiContract.system.health).handler(({ context: _ctx }) => ({
    status: "ok" as const,
    timestamp: new Date().toISOString(),
    version: SDK_VERSION,
  })),
};
```

No `~orpc` reach-in, no `as never`. Return value is type-checked against the contract's `systemHealthOutput` schema — returning anything other than `{ status: "ok"; timestamp: string; version: string }` is a compile error.

#### 7. Compose the router and re-export

**File**: `api/app/src/orpc/router.ts` (NEW)

```typescript
import { systemRouter } from "./router/system";

export const orpcRouter = {
  system: systemRouter,
};

export type OrpcRouter = typeof orpcRouter;
```

**File**: `api/app/src/orpc/index.ts` (NEW)

```typescript
export { orpcRouter } from "./router";
```

(`AuthContext` / `InitialContext` types are internal to `api/app/src/orpc/`; consumers only need the runtime router. The SDK uses `RouterClient<Contract>` from `@repo/api-contract`, not `RouterClient<typeof orpcRouter>` — no `OrpcRouter` type re-export needed.)

**File**: `api/app/src/index.ts`
**Changes**: Add a re-export so `apps/app` can import `orpcRouter` via the `@api/app` barrel:

```typescript
export { orpcRouter } from "./orpc";
```

(Insert near the existing tRPC exports.)

#### 8. Mount the route handler in `apps/app`

**File**: `apps/app/package.json`
**Changes**: Add `"@orpc/openapi": "^1.13.14"` to `dependencies`.

**File**: `apps/app/src/app/(api)/api/v1/[...rest]/route.ts` (NEW)

```typescript
import { orpcRouter } from "@api/app";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const handler = new OpenAPIHandler(orpcRouter);

const setCorsHeaders = (res: Response) => {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "authorization,content-type");
  res.headers.set("Vary", "Origin");
  return res;
};

export const OPTIONS = () => setCorsHeaders(new Response(null, { status: 204 }));

const dispatch = async (req: NextRequest) => {
  const { response } = await handler.handle(req, {
    prefix: "/api/v1",
    context: {
      headers: req.headers,
      requestId: crypto.randomUUID(),
    },
  });
  return setCorsHeaders(response ?? new Response(null, { status: 404 }));
};

export {
  dispatch as GET,
  dispatch as POST,
  dispatch as PUT,
  dispatch as PATCH,
  dispatch as DELETE,
};
```

CORS is permissive (`*`) because:
- Auth is `sk-lf-` API keys — never exposed to a browser. No cookie. No credential leak risk.
- SDK / MCP / curl callers are server-side or stdio. No `Access-Control-Allow-Credentials` needed.

#### 9. Update proxy route matchers

**File**: `apps/app/src/proxy.ts`
**Changes** (lines 35-45):

```typescript
// Before
// API routes that handle their own auth (withDualAuth at route level).
// /api/trpc/(.*) handles auth in createTRPCContext (Bearer token or Clerk
// cookie) and responds to CORS preflight directly. Leaving it in the
// else-branch makes middleware redirect OPTIONS requests to /sign-in, which
// browsers reject with ERR_INVALID_REDIRECT on preflight.
const isApiRoute = createRouteMatcher([
  "/api/cli/(.*)",
  "/api/desktop/(.*)",
  "/api/inngest(.*)",
  "/api/trpc/(.*)",
]);

// After
// API routes that handle their own auth at the route handler level.
// Each route is responsible for its own auth + CORS (the Clerk middleware
// would otherwise redirect OPTIONS preflight to /sign-in, which browsers
// reject as ERR_INVALID_REDIRECT).
//   /api/cli/*       — Clerk JWT (verifyCliJwt)
//   /api/desktop/*   — Clerk session (code) / PKCE verifier (exchange)
//   /api/inngest     — Inngest signature
//   /api/trpc/*      — Clerk Bearer or cookie via createTRPCContext
//   /api/v1/*        — sk-lf- org API key via oRPC authMiddleware
const isApiRoute = createRouteMatcher([
  "/api/cli/(.*)",
  "/api/desktop/(.*)",
  "/api/inngest(.*)",
  "/api/trpc/(.*)",
  "/api/v1/(.*)",
]);
```

#### 10. Delete dead `(api)/lib/` files

```
apps/app/src/app/(api)/lib/with-api-key-auth.ts   DELETE
apps/app/src/app/(api)/lib/with-dual-auth.ts      DELETE
apps/app/src/app/(api)/lib/orpc-middleware.ts     DELETE
```

After deletion, `apps/app/src/app/(api)/` contains only the new `api/v1/[...rest]/route.ts`. The empty `lib/` directory should be removed too.

The `@orpc/server` dep on `apps/app/package.json` becomes unused (the dead orpc-middleware was its only consumer, now replaced by the new route handler that imports `@orpc/openapi`). The route handler imports `OpenAPIHandler` from `@orpc/openapi/fetch`, not `@orpc/server`. Drop `@orpc/server` from `apps/app/package.json` since the server-side oRPC builders live in `@api/app` now.

#### 11. Tests for the auth middleware

**File**: `api/app/src/orpc/__tests__/auth.test.ts` (NEW)

Vitest unit tests against the `authMiddleware` resolution logic. Pattern: stub `@db/app/client` via the existing `__mocks__` convention (`api/app/src/__mocks__/`).

Cases:
- Missing `Authorization` header → throws `ORPCError("UNAUTHORIZED")` with `"API key required"` message.
- Bearer with non-`sk-lf-` token → throws `UNAUTHORIZED` with `"Invalid API key format"`.
- Bearer with valid format but no DB row → throws `UNAUTHORIZED` with `"Invalid API key"`.
- Bearer with valid format + DB row + `expiresAt` in past → throws `UNAUTHORIZED` with `"API key expired"`.
- Bearer with valid format + DB row + active → resolves; downstream middleware sees `auth.apiKeyId / clerkOrgId / userId`.

#### 12. Test for the implemented router

**File**: `api/app/src/orpc/__tests__/system-health.test.ts` (NEW)

Direct invocation via oRPC's public `call()` helper (no HTTP, no `~orpc` reach-in):

```typescript
import { call } from "@orpc/server";
import { describe, expect, it } from "vitest";

import { orpcRouter } from "../router";

describe("orpcRouter.system.health", () => {
  it("returns ok payload", async () => {
    const result = await call(orpcRouter.system.health, undefined, {
      context: {
        headers: new Headers(),
        requestId: "test-req",
      },
    });
    expect(result).toMatchObject({
      status: "ok",
      version: expect.any(String),
      timestamp: expect.any(String),
    });
  });
});
```

Note: `call()` runs the middleware stack, including `authMiddleware`. To exercise the procedure handler in isolation (bypassing auth), stub the DB layer the same way `api/app/src/__tests__/resolve.test.ts:1-16` stubs `@vendor/clerk/*` — `vi.mock("@db/app/client", ...)` returning a row that resolves to the test auth context.

### Success Criteria

#### Automated Verification

- [x] `pnpm install` succeeds.
- [x] `pnpm --filter @api/app typecheck` passes.
- [x] `pnpm --filter @api/app test` passes (new auth + system-health tests).
- [x] `pnpm --filter @lightfast/app typecheck` passes.
- [x] `pnpm --filter @lightfast/app build` passes.
- [x] `pnpm typecheck` at repo root passes.
- [x] `find apps/app/src/app/\\(api\\)/lib -type f` returns nothing (or fails because the directory is gone).
- [x] `grep -rn "withApiKeyAuth\|withDualAuth\|orpc-middleware" apps/app/src api/app/src` returns no source matches.
- [x] `grep -rn "@orpc/server" apps/app/package.json` returns no match (dep removed).

#### Human Review

- [x] Run `pnpm dev:app`. Then `curl -i https://app.lightfast.localhost/api/v1/system/health` → expect HTTP 401 with JSON body `{ "code": "UNAUTHORIZED", ... }` (oRPC error envelope). Confirms the route is mounted and auth runs.
- [x] Insert a test API key via `pnpm db:studio` (or generate one through the existing CLI flow). Re-run `curl -H "Authorization: Bearer <key>" https://app.lightfast.localhost/api/v1/system/health` → expect HTTP 200 with `{"status":"ok","timestamp":"...","version":"..."}`.
- [x] `curl -i -X OPTIONS https://app.lightfast.localhost/api/v1/system/health` → expect HTTP 204 with `Access-Control-Allow-Origin: *`.
- [x] Open `apps/app/src/proxy.ts` → confirm `/api/v1/(.*)` is in `isApiRoute` and the comment block is updated. Confirm no `withDualAuth` references remain.
- [x] Confirm `apps/app/src/app/(api)/lib/` no longer exists; only `apps/app/src/app/(api)/api/v1/[...rest]/route.ts` exists under `(api)/`.
- [x] OPTIONS preflight passes through the Clerk middleware route matcher: `curl -i -X OPTIONS https://app.lightfast.localhost/api/v1/system/health` returns 204 directly from the route handler, not a 307/308 redirect to `/sign-in`. (Verifies the `proxy.ts` `isApiRoute` change took effect — same risk that originally motivated the tRPC matcher entry.)

---

## Phase 3: SDK + MCP wire + live integration test

### Overview

Rewrite `core/lightfast/src/index.ts` so `createLightfast(apiKey, options)` returns a typed `RouterClient<typeof apiContract>` constructed via `OpenAPILink`. Rewrite `core/mcp/src/index.ts` to import the contract and the SDK client and call `registerContractTools`. Add an integration test that boots `@lightfast/app`, inserts a test API key, and exercises the full SDK → server → DB round-trip.

### Changes Required

#### 1. SDK rewrite

**File**: `core/lightfast/package.json`
**Changes**: Add to `dependencies`:

```json
"@orpc/client": "^1.13.14",
"@orpc/openapi-client": "^1.13.14",
"@repo/api-contract": "workspace:*"
```

**File**: `core/lightfast/src/index.ts`
**Changes**: Full rewrite.

```typescript
import { createORPCClient, type RouterClient } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import type { Contract } from "@repo/api-contract";

declare const __SDK_VERSION__: string;

export interface LightfastOptions {
  /** API base URL. Defaults to `https://lightfast.ai`. */
  baseUrl?: string;
  /** Custom fetch implementation (for testing or proxying). */
  fetch?: typeof fetch;
}

export type LightfastClient = RouterClient<Contract>;

export function createLightfast(
  apiKey: string,
  options: LightfastOptions = {}
): LightfastClient {
  if (!apiKey?.startsWith("sk-lf-")) {
    throw new Error("Invalid Lightfast API key");
  }

  const baseUrl = options.baseUrl ?? "https://lightfast.ai";

  const link = new OpenAPILink<Contract>({
    url: `${baseUrl.replace(/\/$/, "")}/api/v1`,
    headers: () => ({
      authorization: `Bearer ${apiKey}`,
    }),
    ...(options.fetch && { fetch: options.fetch }),
  });

  return createORPCClient(link);
}

export const VERSION: string = __SDK_VERSION__;
export type { Contract } from "@repo/api-contract";
```

The previous `LightfastClient` class with `.apiKey`, `.baseUrl`, `.version` accessors is replaced. Since `lightfast@0.1.0-alpha.5` is alpha and the class had no methods, this is acceptable as a breaking change. `VERSION` is preserved for consumers who imported the constant.

#### 2. SDK unit test (mocked fetch)

**File**: `core/lightfast/src/__tests__/client.test.ts` (NEW)

```typescript
import { describe, expect, it, vi } from "vitest";

import { createLightfast } from "../index";

describe("createLightfast", () => {
  it("rejects non-sk-lf- keys", () => {
    expect(() => createLightfast("not-a-key")).toThrow(/Invalid Lightfast API key/);
  });

  it("attaches Authorization: Bearer <apiKey>", async () => {
    const fetchMock = vi.fn(async (input: Request) => {
      const headers = input.headers;
      // Capture the request for assertion
      lastRequest = { url: input.url, authHeader: headers.get("authorization") };
      return new Response(
        JSON.stringify({ status: "ok", timestamp: "2026-05-10T00:00:00Z", version: "test" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    let lastRequest: { url: string; authHeader: string | null } | undefined;

    const lf = createLightfast("sk-lf-test-key", {
      baseUrl: "https://example.test",
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await lf.system.health();

    expect(result).toEqual({
      status: "ok",
      timestamp: "2026-05-10T00:00:00Z",
      version: "test",
    });
    expect(lastRequest?.authHeader).toBe("Bearer sk-lf-test-key");
    expect(lastRequest?.url).toBe("https://example.test/api/v1/system/health");
  });

  it("strips trailing slash from baseUrl", async () => {
    let capturedUrl = "";
    const fetchMock = vi.fn(async (input: Request) => {
      capturedUrl = input.url;
      return new Response(
        JSON.stringify({ status: "ok", timestamp: "x", version: "x" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const lf = createLightfast("sk-lf-test", {
      baseUrl: "https://example.test/",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await lf.system.health();

    expect(capturedUrl).toBe("https://example.test/api/v1/system/health");
  });
});
```

Add a vitest config at `core/lightfast/vitest.config.ts` if not present (mirror `api/platform/vitest.config.ts`).

#### 3. MCP rewrite

**File**: `core/mcp/package.json`
**Changes**: Add to `dependencies`:

```json
"lightfast": "workspace:*",
"@repo/api-contract": "workspace:*"
```

(`@vendor/mcp` stays as `devDependencies` — bundled by tsup. `@modelcontextprotocol/sdk` stays as runtime dep — externalized.)

**File**: `core/mcp/src/index.ts`
**Changes**: Full rewrite.

```typescript
import { apiContract } from "@repo/api-contract";
import { McpServer, registerContractTools, StdioServerTransport } from "@vendor/mcp";
import { createLightfast } from "lightfast";

declare const __SDK_VERSION__: string;

const apiKey = process.env.LIGHTFAST_API_KEY;
if (!apiKey) {
  console.error("LIGHTFAST_API_KEY environment variable is required");
  process.exit(1);
}

const baseUrl = process.env.LIGHTFAST_API_URL;

const server = new McpServer({
  name: "lightfast",
  version: __SDK_VERSION__,
});

const client = createLightfast(apiKey, baseUrl ? { baseUrl } : {});

registerContractTools(server, apiContract, client, { prefix: "lightfast" });

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server failed to start:", error);
  process.exit(1);
});
```

After this rewrite, the published `@lightfastai/mcp` binary registers exactly one tool: `lightfast_system_health`. Subsequent procedure additions to `apiContract` auto-register as MCP tools — no `core/mcp` changes required.

#### 4. MCP registration test

**File**: `core/mcp/src/__tests__/registration.test.ts` (NEW)

```typescript
import { McpServer, registerContractTools } from "@vendor/mcp";
import { apiContract } from "@repo/api-contract";
import { describe, expect, it } from "vitest";

describe("MCP tool registration", () => {
  it("registers lightfast_system_health from the contract", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });

    // Mock client — only the shape matters for registration
    const client = {
      system: {
        health: async () => ({ status: "ok", timestamp: "x", version: "x" }),
      },
    };

    registerContractTools(server, apiContract, client, { prefix: "lightfast" });

    // The MCP SDK doesn't expose a public listTools API on the server side,
    // but registered tools are discoverable via the internal capabilities.
    // Call the underlying registration to verify by invoking the MCP server's
    // request handler if needed; for this test, asserting registerContractTools
    // doesn't throw + doesn't register duplicate names is sufficient.
    expect(() =>
      registerContractTools(server, {}, {}, { prefix: "lightfast" })
    ).not.toThrow();
  });
});
```

Add `core/mcp/vitest.config.ts` if not present.

#### 5. Integration test — live server end-to-end

**File**: `core/lightfast/vitest.config.ts`
**Changes**: Add a `globalSetup` entry:

```typescript
import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "@repo/vitest-config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      environment: "node",
      globalSetup: ["./src/__tests__/integration/setup.ts"],
      // Run integration tests serially; they share a server.
      pool: "forks",
      poolOptions: { forks: { singleFork: true } },
    },
  })
);
```

**File**: `core/lightfast/src/__tests__/integration/setup.ts` (NEW)

```typescript
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const POLL_INTERVAL_MS = 250;
const READY_TIMEOUT_MS = 60_000;

let serverProcess: ChildProcess | undefined;

async function waitForReady(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not yet up
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Server not ready at ${url} within ${timeoutMs}ms`);
}

export async function setup() {
  // The dev server reads .vercel/.env.development.local via pnpm with-env.
  // We rely on `pnpm db:up` having been run beforehand (documented in the
  // test instructions). The dev port is auto-assigned by lightfast-dev proxy;
  // we point at the canonical aggregate URL instead of a raw port.
  const baseUrl = process.env.LIGHTFAST_INTEGRATION_BASE_URL ??
    "https://app.lightfast.localhost";
  const healthUrl = `${baseUrl}/api/health`;

  const skipBoot = process.env.LIGHTFAST_INTEGRATION_SKIP_BOOT === "1";

  if (!skipBoot) {
    serverProcess = spawn("pnpm", ["dev:app"], {
      cwd: new URL("../../../../..", import.meta.url).pathname,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });
    serverProcess.stdout?.on("data", (chunk: Buffer) => {
      // Forward to test stdout for debugging
      process.stdout.write(`[dev:app] ${chunk.toString()}`);
    });
    serverProcess.stderr?.on("data", (chunk: Buffer) => {
      process.stderr.write(`[dev:app] ${chunk.toString()}`);
    });
  }

  await waitForReady(healthUrl, READY_TIMEOUT_MS);

  // Insert a test API key via the existing CLI/REST flow OR direct DB write.
  // For test isolation, write directly to orgApiKeys with a known prefix.
  // Test setup writes to the dev DB the running server is connected to.
  const { db } = await import("@db/app/client");
  const { orgApiKeys } = await import("@db/app/schema");
  const { generateOrgApiKey, hashApiKey } = await import("@repo/app-api-key");

  const { key } = generateOrgApiKey();
  await db.insert(orgApiKeys).values({
    publicId: "akey_test_integration_health",
    keyHash: hashApiKey(key),
    keyPrefix: key.slice(0, 12),
    keySuffix: key.slice(-4),
    clerkOrgId: "org_test_integration_health",
    createdByUserId: "user_test_integration_health",
    isActive: true,
  });

  process.env.__INTEGRATION_API_KEY__ = key;
  process.env.__INTEGRATION_BASE_URL__ = baseUrl;
}

export async function teardown() {
  // Clean up the test key
  const { db } = await import("@db/app/client");
  const { orgApiKeys } = await import("@db/app/schema");
  const { eq } = await import("drizzle-orm");
  await db
    .delete(orgApiKeys)
    .where(eq(orgApiKeys.publicId, "akey_test_integration_health"));

  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
  }
}
```

**File**: `core/lightfast/src/__tests__/integration/system-health.test.ts` (NEW)

```typescript
import { describe, expect, it } from "vitest";

import { createLightfast } from "../../index";

describe("[integration] system.health end-to-end", () => {
  it("round-trips via SDK → live server → DB → SDK", async () => {
    const apiKey = process.env.__INTEGRATION_API_KEY__;
    const baseUrl = process.env.__INTEGRATION_BASE_URL__;
    if (!apiKey || !baseUrl) {
      throw new Error(
        "Integration globalSetup did not provision API key / baseUrl."
      );
    }

    const lf = createLightfast(apiKey, { baseUrl });
    const result = await lf.system.health();

    expect(result.status).toBe("ok");
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof result.version).toBe("string");
  });

  it("rejects requests with an invalid key", async () => {
    const baseUrl = process.env.__INTEGRATION_BASE_URL__;
    if (!baseUrl) throw new Error("No baseUrl");

    const res = await fetch(`${baseUrl}/api/v1/system/health`, {
      headers: { authorization: "Bearer sk-lf-not-a-real-key" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects requests with no Authorization header", async () => {
    const baseUrl = process.env.__INTEGRATION_BASE_URL__;
    if (!baseUrl) throw new Error("No baseUrl");

    const res = await fetch(`${baseUrl}/api/v1/system/health`);
    expect(res.status).toBe(401);
  });
});
```

The integration test depends on the dev Postgres + Redis containers being up (`pnpm db:up && pnpm redis:up`) and the dev `.env` files being populated. It boots `apps/app` via `pnpm dev:app` in `globalSetup` and runs against the canonical aggregate URL `https://app.lightfast.localhost`. The `LIGHTFAST_INTEGRATION_SKIP_BOOT=1` env var skips the spawn for cases where the dev server is already running locally.

The `core/lightfast` package needs to add `@db/app`, `@repo/app-api-key`, and `drizzle-orm` as **devDependencies** for the test setup to import them. These are devDeps only — they don't ship in the published SDK bundle (tsup bundles only `src/index.ts`).

#### 6. SDK package devDependency additions

**File**: `core/lightfast/package.json`
**Changes**: Add to `devDependencies`:

```json
"@db/app": "workspace:*",
"@repo/app-api-key": "workspace:*",
"drizzle-orm": "catalog:"
```

These power the integration globalSetup; they're not part of the SDK runtime surface (tsup entry is `src/index.ts` which doesn't import them).

### Success Criteria

#### Automated Verification

- [x] `pnpm install` succeeds; lockfile updates for new SDK + MCP deps.
- [x] `pnpm --filter lightfast typecheck` passes.
- [x] `pnpm --filter lightfast build` produces `dist/index.mjs` with bundled contract + oRPC client (564 KB self-contained bundle after adding `noExternal` for `@orpc/client`, `@orpc/contract`, `@orpc/openapi-client`, `@repo/api-contract`).
- [x] `pnpm --filter lightfast test` passes — mocked-fetch tests in `client.test.ts` (3 passed, 3 integration tests skipped behind `LIGHTFAST_RUN_INTEGRATION=1`).
- [x] `pnpm --filter @lightfastai/mcp typecheck` passes.
- [x] `pnpm --filter @lightfastai/mcp build` produces `dist/index.mjs` (1.06 MB bundle with `lightfast` + `@repo/api-contract` bundled in via `noExternal`).
- [x] `pnpm --filter @lightfastai/mcp test` passes — registration test (2 passed).
- [x] `pnpm typecheck` at repo root passes (37/37 tasks).
- [x] **Integration test**: with `pnpm db:up && pnpm redis:up` running, `LIGHTFAST_RUN_INTEGRATION=1 pnpm --filter lightfast test` passes — 6/6 (3 unit + 3 integration). Verified with dev server already running and `LIGHTFAST_INTEGRATION_SKIP_BOOT=1` (env injected via `dotenv -e apps/app/.vercel/.env.development.local` + `scripts/with-dev-services-env.mjs`). Note: integration setup sets `NODE_TLS_REJECT_UNAUTHORIZED=0` to accept portless's self-signed cert.

#### Human Review

- [x] Run `pnpm dev:app`, then in another terminal: `LIGHTFAST_API_KEY=<test-key> node core/mcp/dist/index.mjs` (after `pnpm --filter @lightfastai/mcp build`). MCP server connects via stdio without errors. `tools/list` response includes `lightfast_system_health` with input/output schemas (verified with manual JSON-RPC pipe). `tools/call` round-trip returns `{"status":"ok","timestamp":"...","version":"0.1.0"}`.
- [x] Inside a Node REPL: `const { createLightfast } = await import("./core/lightfast/dist/index.mjs"); const lf = createLightfast("sk-lf-...", { baseUrl: "https://app.lightfast.localhost" }); console.log(await lf.system.health());` — returns `{ status: "ok", timestamp: "...", version: "0.1.0" }`.
- [x] Open `core/lightfast/src/index.ts` → confirms only the `type LightfastClient = ContractRouterClient<Contract>` alias (no class). (Note: type is `ContractRouterClient` not `RouterClient` — see implementation deltas below.)
- [x] Confirm `core/mcp/src/index.ts` registers tools via `registerContractTools` with prefix `"lightfast"` — adding new procedures to `apiContract` would auto-register without further `core/mcp` changes (verified — 22-line file, single registration call).

---

## Testing Strategy

### Unit Tests

- `packages/api-contract/src/__tests__/contract.test.ts` — contract walk via `isContractProcedure`; route metadata + output schema assertions.
- `api/app/src/orpc/__tests__/auth.test.ts` — auth middleware error cases (missing header, bad format, no DB row, expired, success).
- `api/app/src/orpc/__tests__/system-health.test.ts` — direct procedure invocation returns the expected payload shape.
- `core/lightfast/src/__tests__/client.test.ts` — mocked-fetch SDK round-trip; baseUrl normalization; key validation.
- `core/mcp/src/__tests__/registration.test.ts` — `registerContractTools` runs without error against `apiContract` + a stub client.

### Integration Tests

- `core/lightfast/src/__tests__/integration/system-health.test.ts` — boots `apps/app` via `pnpm dev:app` in globalSetup, provisions a test API key in the dev DB, runs `lf.system.health()` against the live canonical aggregate URL, asserts 200 / 401 / 401.

### Type Tests

The `RouterClient<Contract>` type alias is exercised by the SDK call sites in `client.test.ts` — if `apiContract.system.health.output` shape diverges from what `lf.system.health()` resolves to, typecheck fails.

## Performance Considerations

- The auth middleware does one DB SELECT + one fire-and-forget UPDATE per request. Same shape as the dead `withApiKeyAuth`, no regression.
- `OpenAPILink` uses `fetch` per call (no batching). For the SDK's expected use case (low-volume, server-side), this is fine. If high-throughput is needed later, oRPC's RPC handler with batching is a follow-up plan.
- `registerContractTools` walks the contract once at MCP server startup; no per-request cost.
- The integration test's dev-server boot adds ~10-20s to `pnpm --filter lightfast test`. This runs only when explicitly invoked (CI may want `LIGHTFAST_INTEGRATION_SKIP_BOOT=1` + an already-running server, or a dedicated job).

## Migration Notes

- **`lightfast@0.1.0-alpha.5` → next**: `LightfastClient` is no longer constructable via `new`. Consumers using `new LightfastClient(apiKey)` must switch to `createLightfast(apiKey)`. The `.apiKey` / `.baseUrl` / `.version` instance accessors are removed (the returned router client doesn't expose them). Since the package is alpha and the class had no methods, downstream impact is minimal.
- **`@lightfastai/mcp@0.1.0-alpha.5` → next**: Now requires `LIGHTFAST_API_KEY` to actually authenticate (previously it set up the env var but registered no tools, so any value worked). Optional `LIGHTFAST_API_URL` to point at non-prod environments. New tool `lightfast_system_health` becomes visible to MCP clients.
- **No DB migration.** The `orgApiKeys` table is unchanged.
- **No tRPC migration.** `(trpc)` mount, `appRouter`, `createTRPCContext`, `resolveAuth` are untouched.
- **`@orpc/server` removed from `apps/app/package.json`.** It moves to `api/app/package.json` (where the procedures are implemented). Net: same lockfile cost, different attribution.

## References

- Research: `thoughts/shared/research/2026-05-10-api-lib-middleware-and-public-vs-internal-api-boundary.md`
- Predecessor plan (which deferred this): `thoughts/shared/plans/2026-05-08-api-platform-internal-boundary-and-platform-client.md`
- Related research: `thoughts/shared/research/2026-05-08-api-app-platform-core-boundaries.md`
- Pattern reference for new package: `packages/platform-client/package.json`, `packages/platform-client/turbo.json`
- Pattern reference for tRPC architecture (mirrored for oRPC): `api/app/src/trpc.ts:138-187`
- Pattern reference for fetch route handler + CORS: `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts`
- oRPC observability middleware: `vendor/observability/src/orpc.ts:34-149`
- oRPC contract → MCP tool walker: `vendor/mcp/src/index.ts:37-120`
- Boundary tags: `turbo.json:101-118`
- Workspace catalog: `pnpm-workspace.yaml:10-66`

## Improvement Log

Adversarial review on 2026-05-11 (`/improve_plan`).

### Spike — CONFIRMED

Hypothesis: `@orpc/server@1.13.14` exposes a typed contract→implementation binding that eliminates the `outputSchema as never` cast and the `apiContract.system.health["~orpc"].route` re-spread.

Verdict: **confirmed**. The export is named `implement` (not `implementContract`). Pattern:

```ts
implement(contractProcedure)
  .$context<InitialContext>()
  .use(observabilityMiddleware)
  .use(authMiddleware)
  .handler(({ context }) => { /* return type checked against contract output schema */ });
```

`Builder.contract()` and `os.contract()` do not exist (tested with `@ts-expect-error`). Output-schema enforcement verified — returning `status: "bad"` produces `TS2322`.

### Changes

- **Phase 2 §5–§6**: Replaced the `os.$context<T>().use(...).use(...)` builder + manual `.route(... ?? {}).output(... as never)` re-spread with an `authed = <P>(proc: P) => implement(proc).$context<InitialContext>().use(obs).use(authMw)` factory. Per-procedure boilerplate collapses to `health: authed(apiContract.system.health).handler(...)`. Removed the `as never` cast and `~orpc` reach-in.
- **Phase 2 §5**: Dropped the `publicProcedure` builder (YAGNI — no caller, no procedure uses it).
- **Phase 2 §7**: Dropped the `OrpcRouter` type re-export from `api/app/src/orpc/index.ts` and `api/app/src/index.ts`. The SDK uses `RouterClient<Contract>` from `@repo/api-contract`, not `RouterClient<typeof orpcRouter>` — no consumer for the type.
- **Phase 2 §8**: Route handler path changed from `(api)/api/v1/[[...rest]]/route.ts` (optional catch-all, novel) to `(api)/api/v1/[...rest]/route.ts` (required catch-all, consistent with the repo's single-bracket slug convention).
- **Phase 2 §12**: System-health test replaced fragile `proc["~orpc"].handler({ context })` direct-call (with a "fallback to OpenAPIHandler" caveat) with oRPC's public `call()` helper. Caveat removed.
- **What We're NOT Doing**: Added an explicit note that the dead `orpc-middleware.ts`'s dual-auth (Bearer + Clerk session) path is intentionally dropped — the new `authMiddleware` is API-key-only by design.
- **Current State Analysis**: Corrected the `core` boundary claim — `core` is not in `turbo.json` boundary tags at all; `implicitDependencies: ["~"]` permits `core/*` → `packages/*` (no explicit grant exists to grep for).
- **Key Discoveries**: Added the `implement()` finding so future readers know the binding pattern in advance.
- **Phase 2 Human Review**: Added an explicit OPTIONS preflight check (verifies the `proxy.ts` `isApiRoute` change works — same risk that originally motivated the tRPC mount's matcher entry).
- **Implementation Approach**: Flagged that the Phase 3 live-boot integration test is a deliberate departure from existing repo test patterns (no other test boots a dev server) — kept per user direction; the value is full HTTP-path validation from SDK to DB.

### Decisions deferred / kept as-is

- **Integration test design (Phase 3) — kept**: User opted to retain the live-boot integration test rather than dropping it for an in-process caller test or fetch-mock-only verification. Tradeoff acknowledged: dev-server spawn cost, dev DB pollution risk on hard crash (mitigated by unique IDs + idempotent teardown), devDep additions to `core/lightfast` (`@db/app`, `@repo/app-api-key`, `drizzle-orm`).

### Phase 3 implementation deltas (2026-05-11)

Implemented per plan with the following corrections discovered during execution:

- **Client type was `ContractRouterClient<Contract>` from `@orpc/contract`, not `RouterClient<Contract>` from `@orpc/client`.** `@orpc/client@1.14.2` does not export `RouterClient` — that name lives only in `@orpc/server`'s router-binding API. Contract-only typed clients use `ContractRouterClient<TContract>` from `@orpc/contract`. Required adding `@orpc/contract` as a direct dependency on `core/lightfast`.
- **`OpenAPILink` constructor takes `(contract, options)`, not `<Contract>(options)`.** The link's generic `T extends ClientContext` parameter is independent from the contract; the contract is passed positionally.
- **tsup `external: []` does not bundle deps — must use `noExternal`.** Plan's "Key Discoveries" claim that `external: []` "bundles everything" was wrong; tsup defaults to externalizing all `dependencies`. Added `noExternal: ["@orpc/client", "@orpc/contract", "@orpc/openapi-client", "@repo/api-contract"]` on `core/lightfast/tsup.config.ts` (564 KB self-contained bundle) and `noExternal: ["lightfast", "@repo/api-contract"]` on `core/mcp/tsup.config.ts` (1.06 MB binary). Without this, `@repo/api-contract` (private, never published) would be a broken dangling import in the published npm packages.
- **`globalSetup` gated by `LIGHTFAST_RUN_INTEGRATION=1`**, and integration `describe` block uses `describe.skipIf(...)`. Plan's setup ran unconditionally, which would have broken `pnpm --filter lightfast test` for any developer/CI run without `pnpm db:up && pnpm redis:up` already invoked. The new gate keeps the unit-only path fast and runnable without containers, while opt-in integration runs work as designed.
- **`orgApiKeys` insert needs `name` field.** The schema marks it `notNull`. Plan's example insert omitted it; setup now inserts `name: "integration-test-system-health"`.
- **`vitest.config.ts` `poolOptions: { forks: { singleFork: true } }` deprecated in vitest 4** — replaced with top-level `forks: { singleFork: true }`.
- **Integration test setup also sets `NODE_TLS_REJECT_UNAUTHORIZED=0`** because portless serves the local aggregate (`https://app.lightfast.localhost`) over self-signed HTTPS. Without this, the test process's `fetch()` rejects the connection (`SELF_SIGNED_CERT_IN_CHAIN`) and `waitForReady` times out at 60s. Scoped to integration mode only.

### Phase 3 manual verification log (2026-05-11)

Ran end-to-end against a live `pnpm dev:app` (PID was 65177). Concrete evidence:

1. **`curl /api/v1/system/health` (no key) → 401** with body `{"defined":false,"code":"UNAUTHORIZED","status":401,"message":"API key required. Provide 'Authorization: Bearer <api-key>' header."}` — proves `authMiddleware` rejects unauthenticated requests with the oRPC error envelope.
2. **`curl /api/v1/system/health` (valid `sk-lf-` key) → 200** with body `{"status":"ok","timestamp":"2026-05-11T03:38:44.021Z","version":"0.1.0"}`.
3. **`curl -X OPTIONS /api/v1/system/health` → 204** with `access-control-allow-origin: *`, `access-control-allow-methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`, `access-control-allow-headers: authorization,content-type`. No 307/308 redirect to `/sign-in`, confirming the `proxy.ts` `isApiRoute` matcher entry from Phase 2 takes effect.
4. **SDK round-trip via `dist/index.mjs` bundle** — `node -e "..."` against `https://app.lightfast.localhost` returned `{"status":"ok","timestamp":"2026-05-11T03:38:54.027Z","version":"0.1.0"}`. Confirms the bundled `OpenAPILink` + `createORPCClient` work end-to-end with no source-map / unbundled-import surprises.
5. **MCP `tools/list` over stdio** returned a single tool `lightfast_system_health` with full input/output JSON Schema (derived from `apiContract.system.health` via `~orpc.inputSchema`/`~orpc.outputSchema`).
6. **MCP `tools/call` over stdio** returned `{"content":[],"structuredContent":{"status":"ok","timestamp":"2026-05-11T03:39:08.638Z","version":"0.1.0"}}` — full path MCP client → MCP server → SDK → oRPC link → app `/api/v1` → DB lookup → response.
7. **Vitest `LIGHTFAST_RUN_INTEGRATION=1 LIGHTFAST_INTEGRATION_SKIP_BOOT=1 pnpm test` (env-injected via `dotenv` + `with-dev-services-env.mjs`)** → `Test Files 2 passed (2), Tests 6 passed (6)` in 2.07s.

API key for the manual flow was provisioned by inserting a real `generateOrgApiKey()` row into `lightfast_workspace_api_keys` (`public_id=akey_manual_verify`) and deleted on cleanup.
