# `api/platform` internal boundary + `@repo/platform-client` wire — Implementation Plan

## Overview

Lock in the post-v2-reset boundary between `api/app` (external surface) and `api/platform` (internal surface), restructure `api/platform` to mirror `api/app`'s router shape, narrow the service-JWT contract, and stand up a new `@repo/platform-client` workspace package so the next plan can land platform procedures with the wire already in place.

## Current State Analysis

Verified against `git_commit b61ee29af` and confirmed claims in `thoughts/shared/research/2026-05-08-api-app-platform-core-boundaries.md`:

- `apps/app` and `apps/platform` are **separate Vercel projects** (`apps/app/vercel.json:4-7`, `apps/platform/vercel.json:4`). They communicate only over HTTP. `apps/app/package.json` has no `@api/platform` dependency, so `createInternalCaller` is **only callable from within `apps/platform`'s deployment**.
- `apps/platform` is reachable on a public Vercel hostname (`https://lightfast-platform.vercel.app`). "Internal" is enforced by **CORS allowlist + service-JWT auth + no public docs**, not by network isolation.
- `api/platform/src/root.ts` exports two empty routers (`platformRouter` and `adminRouter`). `internalRouter` has one PoC procedure (`ping`).
- `api/platform/src/trpc.ts:22-28` declares a 6-variant `PlatformAuthContext` (`service | webhook | internal | inngest | cron | unauthenticated`); only `service` and `unauthenticated` are constructed from HTTP (`createPlatformTRPCContext:53-94`).
- `signServiceJWT` and `createInternalCaller` are exported but have **zero production call sites**.
- `apps/app/next.config.ts:73-83` rewrites `/api/connect/*` and `/api/ingest/*` to `${platformUrl}`. **No handlers exist** at those paths in `apps/platform/src/app/api/`.
- `apps/app/src/proxy.ts:29` has `/api/ingest(.*)` in `isPublicRoute` (unused; no handler).
- `oRPC infra exists** (`@orpc/server` in apps/app, `@orpc/contract` in vendor/mcp, `@orpc/client` in vendor/observability) but no contract files exist.
- Catalog already exposes `jose`, `@trpc/client`, `@trpc/server`, `superjson`, `vitest`.
- Turbo boundary tags (`turbo.json:101-118`): `packages`-tagged packages may depend on `api`-tagged packages (confirmed by `@repo/app-trpc` depending on `@api/app`); `internal`-tagged cannot.

## Desired End State

After this plan:

- `api/platform/src/` mirrors `api/app/src/` shape: `root.ts` composes sub-routers from `router/<feature>/<file>.ts`. First sub-router is `system` with a single procedure `system.health` (requires service auth).
- `PlatformAuthContext` is collapsed to **three variants**: `service | internal | unauthenticated`. `webhook | inngest | cron` removed (dead code).
- `adminRouter`, `adminProcedure`, `AdminRouter*` types **deleted** from `@api/platform`.
- `ServiceCaller = "app" | "inngest" | "cron"` is exported; `signServiceJWT` and `verifyServiceJWT` enforce this set.
- `packages/platform-client/` exists as a new workspace package (`@repo/platform-client`, tag `packages`) exposing `createPlatformClient({ caller, baseUrl })`. Returns a typed tRPC client targeting `PlatformRouter`. Self-contained tests verify Bearer header attach + JWT round-trip. **No consumer wired in this plan.**
- `apps/app/next.config.ts` no longer rewrites `/api/connect/*` or `/api/ingest/*`. `apps/app/src/proxy.ts` no longer lists `/api/ingest(.*)` as a public route.
- `pnpm typecheck` passes across the workspace; `@api/platform` and `@repo/platform-client` tests pass.

### Verification

- Every grep for `adminRouter`, `adminProcedure`, `AdminRouter` in source returns no hits except git history.
- Grep for `/api/connect|/api/ingest` in `apps/app/{src,next.config.ts}` returns no functional references.
- `pnpm --filter @repo/platform-client test` passes; the test suite proves the client signs a JWT with `iss=app` and attaches `Authorization: Bearer ...` to fetch requests, and that the resulting JWT verifies via `verifyServiceJWT`.
- `pnpm --filter @api/platform test` passes; `system.health` returns `{status:"ok", timestamp, caller}` under service auth and throws `UNAUTHORIZED` under unauthenticated context.

### Key Discoveries

- `apps/app` and `apps/platform` are physically separate deployments — `createInternalCaller` is **not** an option for `apps/app`-side callers (`apps/app/vercel.json:4-7`, `apps/app/package.json`).
- The cross-app rewrite paths (`/api/connect/*`, `/api/ingest/*`) have **no handlers in `apps/platform`**; they're forwarding to nothing today.
- Boundary tag `packages` is the right tag for the new client package — same as `@repo/app-trpc` (`packages/app-trpc/turbo.json:3`), allowing it to depend on `@api/platform`.
- Webhook ingestion will land directly at `apps/platform` (provider signature is the auth) per user decision, so service-JWT callers are restricted to **internal services only**: `app`, `inngest`, `cron`. No `webhook` or `admin` issuer.

## What We're NOT Doing

- **No oRPC contract package.** `core/lightfast` and `core/mcp` stay stubs. `LightfastClient` keeps its current shape. Adopting oRPC for the SDK is deferred to a later plan once `@api/app` has a procedure worth exposing.
- **No webhook handlers.** No `apps/platform/src/app/api/connect/**` directories created. First webhook integration is a separate plan.
- **No `@repo/platform-client` consumer wired in `apps/app`.** The dep is added, the package exists, and tests pass — but no production call site lands. That's the next plan's first user.
- **No changes to `@repo/app-trpc`.** Hooks, exports, providers untouched.
- **No changes to `apps/platform` CORS allowlist or `/api/health`.** Both stay as-is.
- **No route-level 401** on the platform tRPC handler. Per-procedure auth via `serviceProcedure` is sufficient for now.
- **No changes to `@api/app`.** Clerk auth context, routers, and Inngest functions stay exactly as-is.
- **No new top-level routes in `apps/platform`.** The smoke procedure `system.health` is reachable via the existing tRPC mount.

## Implementation Approach

Linear, four phases. Each phase halts at boundary for user verification before continuing. Phase 3 produces dead-but-tested code; phase 4 is purely subtractive.

The `@repo/platform-client` package is intentionally **stand-alone with no upstream consumer** at the end of this plan. This keeps the plan scoped: prove the wire works in isolation, defer wiring it into `apps/app` until the first real platform procedure exists. This avoids a "speculative dep with no use site" lint flag — the package has its own tests, so it's not dead code.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: Restructure `api/platform` — drop admin, collapse auth context, add `system.health`

### Overview

Delete `adminRouter`/`adminProcedure`. Collapse `PlatformAuthContext` to three variants. Restructure router files to mirror `api/app`. Add a single procedure (`system.health`) so the surface has something HTTP-callable that requires service auth.

### Changes Required:

#### 1. Auth context collapse and `adminProcedure` removal

**File**: `api/platform/src/trpc.ts`
**Changes**: Replace 6-variant `PlatformAuthContext` with 3-variant. Remove `adminProcedure` definition entirely.

```typescript
// Replace lines ~22-28
export type PlatformAuthContext =
  | { type: "service"; caller: ServiceCaller }
  | { type: "internal"; source: string }
  | { type: "unauthenticated" };
```

Remove the entire `adminProcedure` block (lines ~172-196). Update `observabilityMiddleware` (lines ~120-128) so the field-extraction logic only handles `service` and `internal` types.

`createPlatformTRPCContext` (lines ~53-94) must use the narrowed `verifyServiceJWT` return (delivered in Phase 2 — for Phase 1 we still call the function but cast its `caller` field; Phase 2 tightens this).

`serviceProcedure` keeps its existing check (`auth.type === "service"`) — TS narrows `caller` to `ServiceCaller` automatically once Phase 2 lands.

#### 2. Sub-router structure mirroring `api/app`

**File**: `api/platform/src/router/system/health.ts` (NEW)
**Changes**: Define `system` sub-router with a single `health` procedure.

```typescript
import { z } from "zod";
import { createTRPCRouter, serviceProcedure } from "../../trpc";

export const systemRouter = createTRPCRouter({
  health: serviceProcedure
    .output(
      z.object({
        status: z.literal("ok"),
        timestamp: z.string(),
        caller: z.string(),
      })
    )
    .query(({ ctx }) => ({
      status: "ok" as const,
      timestamp: new Date().toISOString(),
      caller: ctx.auth.caller,
    })),
});
```

#### 3. Recompose `root.ts`

**File**: `api/platform/src/root.ts`
**Changes**: Drop `adminRouter`. Mount `systemRouter` under `system`.

```typescript
import { systemRouter } from "./router/system/health";
import { createTRPCRouter } from "./trpc";

export const platformRouter = createTRPCRouter({
  system: systemRouter,
});

export type PlatformRouter = typeof platformRouter;
```

#### 4. Trim `index.ts` exports

**File**: `api/platform/src/index.ts`
**Changes**: Remove `AdminRouter` type export (line ~11), remove `AdminRouterInputs/AdminRouterOutputs` type aliases (lines ~18-21). Add re-export of `serviceProcedure` if not already, and `PlatformRouter` type. Keep `signServiceJWT`, `verifyServiceJWT`, `VerifiedServiceJWT`. Phase 2 adds `ServiceCaller` to this barrel.

#### 5. Tests

**File**: `api/platform/src/router/system/health.test.ts` (NEW)
**Changes**: Cover the procedure under all three auth contexts.

```typescript
import { describe, expect, it } from "vitest";
import { createCallerFactory } from "../../trpc";
import { systemRouter } from "./health";

const createCaller = createCallerFactory(systemRouter);

describe("system.health", () => {
  it("returns ok under service auth with caller passed through", async () => {
    const caller = createCaller({
      auth: { type: "service", caller: "app" },
      headers: new Headers(),
    });
    const result = await caller.health();
    expect(result.status).toBe("ok");
    expect(result.caller).toBe("app");
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("throws UNAUTHORIZED under unauthenticated context", async () => {
    const caller = createCaller({
      auth: { type: "unauthenticated" },
      headers: new Headers(),
    });
    await expect(caller.health()).rejects.toThrow(/UNAUTHORIZED/);
  });

  it("throws UNAUTHORIZED under internal context (HTTP-only procedure)", async () => {
    const caller = createCaller({
      auth: { type: "internal", source: "test" },
      headers: new Headers(),
    });
    await expect(caller.health()).rejects.toThrow(/UNAUTHORIZED/);
  });
});
```

#### 6. Update `internal.ts` (verify still compiles after auth collapse)

**File**: `api/platform/src/internal.ts`
**Changes**: No functional change. The `auth: { type: "internal", source }` literal in `createInternalCaller:50-55` already matches the narrowed union. Verify and leave alone.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm --filter @api/platform typecheck` passes
- [x] `pnpm --filter @api/platform test` passes (new `system.health.test.ts` + existing `jwt.test.ts`)
- [x] `pnpm typecheck` at repo root passes
- [x] `grep -rn "adminRouter\|adminProcedure\|AdminRouter" api/ apps/ packages/` returns zero matches
- [x] `grep -rn "type: \"webhook\"\|type: \"inngest\"\|type: \"cron\"" api/platform/src/` returns zero matches in non-test source

#### Human Review:

- [ ] Open `api/platform/src/trpc.ts` → confirm `PlatformAuthContext` has exactly 3 variants and no `adminProcedure` block
- [ ] Open `api/platform/src/root.ts` → confirm only `platformRouter` is exported, mounting `system` sub-router
- [ ] Open `api/platform/src/router/system/health.ts` → confirm structure matches the `api/app` convention (compare to `api/app/src/router/user/account.ts`)

---

## Phase 2: Narrow `ServiceCaller` type in JWT helpers

### Overview

Replace the free-form `caller: string` in the JWT contract with a closed union `ServiceCaller = "app" | "inngest" | "cron"`. `verifyServiceJWT` rejects unknown issuers at the verification step — defense in depth even if the issuing side was meant to be locked down.

### Changes Required:

#### 1. JWT helpers

**File**: `api/platform/src/lib/jwt.ts`
**Changes**: Add `ServiceCaller` type + runtime guard. Tighten signatures.

```typescript
import { SignJWT, jwtVerify } from "jose";
import { env } from "../env";

export const SERVICE_CALLERS = ["app", "inngest", "cron"] as const;
export type ServiceCaller = (typeof SERVICE_CALLERS)[number];

const PLATFORM_AUDIENCE = "lightfast-platform";
const SERVICE_JWT_TTL_SECONDS = 60;

export interface VerifiedServiceJWT {
  caller: ServiceCaller;
}

const getSecretKey = (): Uint8Array =>
  new TextEncoder().encode(env.SERVICE_JWT_SECRET);

const isServiceCaller = (value: unknown): value is ServiceCaller =>
  typeof value === "string" &&
  (SERVICE_CALLERS as readonly string[]).includes(value);

export async function signServiceJWT(caller: ServiceCaller): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(caller)
    .setAudience(PLATFORM_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + SERVICE_JWT_TTL_SECONDS)
    .sign(getSecretKey());
}

export async function verifyServiceJWT(
  token: string
): Promise<VerifiedServiceJWT> {
  const { payload } = await jwtVerify(token, getSecretKey(), {
    audience: PLATFORM_AUDIENCE,
    algorithms: ["HS256"],
  });
  if (!isServiceCaller(payload.iss)) {
    throw new Error(
      `Invalid service JWT issuer: ${String(payload.iss)} (expected one of ${SERVICE_CALLERS.join(", ")})`
    );
  }
  return { caller: payload.iss };
}
```

#### 2. Re-export from public barrel

**File**: `api/platform/src/index.ts`
**Changes**: Add `ServiceCaller` and `SERVICE_CALLERS` to the export list.

```typescript
export {
  signServiceJWT,
  verifyServiceJWT,
  SERVICE_CALLERS,
  type ServiceCaller,
  type VerifiedServiceJWT,
} from "./lib/jwt";
```

#### 3. Propagate to context

**File**: `api/platform/src/trpc.ts`
**Changes**: Update the import — `caller` field on the `service` variant is now typed `ServiceCaller`. No shape change beyond the type tightening (already declared in Phase 1, now backed by the narrowed function return).

#### 4. Tests

**File**: `api/platform/src/lib/jwt.test.ts`
**Changes**: Add cases — reject `"admin"`, reject `"webhook"`, reject empty string, accept `"app"`/`"inngest"`/`"cron"`.

```typescript
// Append to existing describe block
it("rejects unknown caller (admin)", async () => {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("admin")
    .setAudience("lightfast-platform")
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(new TextEncoder().encode(env.SERVICE_JWT_SECRET));
  await expect(verifyServiceJWT(token)).rejects.toThrow(/Invalid service JWT issuer/);
});

it.each(["app", "inngest", "cron"] as const)(
  "round-trips caller=%s",
  async (caller) => {
    const token = await signServiceJWT(caller);
    const verified = await verifyServiceJWT(token);
    expect(verified.caller).toBe(caller);
  }
);
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm --filter @api/platform typecheck` passes
- [x] `pnpm --filter @api/platform test` passes; new caller-rejection cases included
- [x] `signServiceJWT("admin")` is a TypeScript compile error (covered by typecheck)
- [x] `pnpm typecheck` at repo root passes

#### Human Review:

- [ ] Open `api/platform/src/lib/jwt.ts` → confirm `ServiceCaller` union has exactly three members and `verifyServiceJWT` rejects unknown `iss` values

---

## Phase 3: Stand up `packages/platform-client`

### Overview

New workspace package `@repo/platform-client` exposing a `createPlatformClient({ caller, baseUrl })` factory. Bundles a tRPC client typed against `PlatformRouter`, plus automatic Bearer token signing via `signServiceJWT`. Self-contained — no upstream consumer wired in this plan. Tests prove the wire round-trips end-to-end against `@api/platform`.

### Changes Required:

#### 1. Package scaffolding

**File**: `packages/platform-client/package.json` (NEW)

```json
{
  "name": "@repo/platform-client",
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
    "@api/platform": "workspace:*",
    "@trpc/client": "catalog:",
    "superjson": "catalog:"
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

**File**: `packages/platform-client/turbo.json` (NEW)

```json
{
  "extends": ["//"],
  "tags": ["packages"],
  "tasks": {}
}
```

**File**: `packages/platform-client/tsconfig.json` (NEW)

Copy the shape of `packages/app-trpc/tsconfig.json` (extends `@repo/typescript-config`, points at `./src`).

**File**: `packages/platform-client/vitest.config.ts` (NEW)

Copy the shape of `api/platform/vitest.config.ts` (extends `@repo/vitest-config`).

#### 2. Factory implementation

**File**: `packages/platform-client/src/index.ts` (NEW)

```typescript
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import {
  signServiceJWT,
  type PlatformRouter,
  type ServiceCaller,
} from "@api/platform";

export interface CreatePlatformClientOptions {
  caller: ServiceCaller;
  baseUrl: string;
}

export function createPlatformClient(options: CreatePlatformClientOptions) {
  const { caller, baseUrl } = options;
  return createTRPCClient<PlatformRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl.replace(/\/$/, "")}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = await signServiceJWT(caller);
          return {
            authorization: `Bearer ${token}`,
            "x-trpc-source": `service:${caller}`,
          };
        },
      }),
    ],
  });
}

export type {
  PlatformRouter,
  ServiceCaller,
} from "@api/platform";
```

The intended usage pattern (documented as a top-of-file JSDoc — single line, no multi-paragraph comments):

```typescript
// const platform = createPlatformClient({ caller: "app", baseUrl: env.PLATFORM_URL });
// const health = await platform.system.health.query();
```

#### 3. Tests

**File**: `packages/platform-client/src/index.test.ts` (NEW)

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { verifyServiceJWT } from "@api/platform";
import { createPlatformClient } from "./index";

describe("createPlatformClient", () => {
  beforeEach(() => {
    process.env.SERVICE_JWT_SECRET = "x".repeat(48);
  });

  it("attaches a verifiable service JWT to outbound requests", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchMock = vi.fn(async (input: string, init: RequestInit) => {
      calls.push({ url: input, init });
      // Return a tRPC-shaped success body for system.health
      return new Response(
        JSON.stringify([
          {
            result: {
              data: {
                json: { status: "ok", timestamp: "2026-05-08T00:00:00Z", caller: "app" },
              },
            },
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    // @ts-expect-error overwrite global for the test
    globalThis.fetch = fetchMock;

    const client = createPlatformClient({
      caller: "app",
      baseUrl: "https://platform.test",
    });

    const result = await client.system.health.query();
    expect(result.status).toBe("ok");
    expect(calls[0]?.url).toContain("https://platform.test/api/trpc");

    const headers = new Headers(calls[0]?.init.headers);
    const authHeader = headers.get("authorization");
    expect(authHeader).toMatch(/^Bearer eyJ/);

    const token = authHeader!.slice("Bearer ".length);
    const verified = await verifyServiceJWT(token);
    expect(verified.caller).toBe("app");
  });

  it("emits x-trpc-source header tagged with caller", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([{ result: { data: { json: { status: "ok", timestamp: "x", caller: "inngest" } } } }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    // @ts-expect-error overwrite global for the test
    globalThis.fetch = fetchMock;

    const client = createPlatformClient({ caller: "inngest", baseUrl: "https://platform.test" });
    await client.system.health.query();

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("x-trpc-source")).toBe("service:inngest");
  });
});
```

#### 4. Workspace recognition

`pnpm-workspace.yaml:5` already includes `packages/*`. After adding the new directory, run `pnpm install` so pnpm registers the workspace member and links `@api/platform` and `@repo/typescript-config`/`@repo/vitest-config`.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds (lockfile updates)
- [x] `pnpm --filter @repo/platform-client typecheck` passes
- [x] `pnpm --filter @repo/platform-client test` passes — both test cases (Bearer round-trip + x-trpc-source header)
- [x] `pnpm typecheck` at repo root passes
- [x] `pnpm list -r --depth -1 | grep @repo/platform-client` shows the package
- [x] `cd packages/platform-client && pnpm why @api/platform` confirms the dep resolves to the workspace package (verified via `pnpm --filter @repo/platform-client list --depth 0` → `@api/platform@link:../../api/platform`)

#### Human Review:

- [x] Open `packages/platform-client/src/index.ts` → confirm exports include `createPlatformClient`, `PlatformRouter`, `ServiceCaller` and nothing else (no leaked `signServiceJWT` re-export — callers go through the factory). Also exports `CreatePlatformClientOptions` (factory options interface).
- [x] Open `packages/platform-client/package.json` → confirm `dependencies` has only `@api/platform`, `@trpc/client`, `superjson`; no `jose` (transitive via `@api/platform`)
- [x] Confirm the package has a `turbo.json` with `tags: ["packages"]` so the boundary tag matches `@repo/app-trpc`

---

## Phase 4: `apps/app` subtractive cleanup

### Overview

Drop the cross-app rewrite paths. Drop the dead `/api/ingest(.*)` entry from the public-route matcher. No replacement work — this is purely deletion of code that points at handlers that don't exist.

### Changes Required:

#### 1. Remove cross-app rewrites

**File**: `apps/app/next.config.ts`
**Changes**: Delete lines 72-83 (rewrites block for `/api/connect/*` and `/api/ingest/*`). If `appConfig.rewrites` becomes empty, delete the field entirely.

```typescript
// Delete:
async rewrites() {
  return [
    {
      source: "/api/connect/:path*",
      destination: `${platformUrl}/api/connect/:path*`,
    },
    {
      source: "/api/ingest/:path*",
      destination: `${platformUrl}/api/ingest/:path*`,
    },
  ];
},
```

If `platformUrl` becomes unused after this deletion, leave the import — `apps/app/src/origins.ts` still exports it for future code (e.g. when `@repo/platform-client` lands as a dep).

#### 2. Remove dead public-route entry

**File**: `apps/app/src/proxy.ts`
**Changes**: Remove `"/api/ingest(.*)"` from the `isPublicRoute` matcher (line 29).

```typescript
// Before
const isPublicRoute = createRouteMatcher([
  "/early-access(.*)",
  "/api/health(.*)",
  "/api/ingest(.*)",      // ← remove this line
  "/docs(.*)",
  "/monitoring",
  "/ingest(.*)",
  "/manifest.json",
]);

// After
const isPublicRoute = createRouteMatcher([
  "/early-access(.*)",
  "/api/health(.*)",
  "/docs(.*)",
  "/monitoring",
  "/ingest(.*)",
  "/manifest.json",
]);
```

(Note: `/ingest(.*)` — without the `/api` prefix — stays. That's a separate PostHog/analytics public route.)

#### 3. Verify no other references

Grep the `apps/app/src` tree for `/api/connect` and `/api/ingest` to confirm no other code paths constructed those URLs. Expected: zero matches.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm --filter @lightfast/app typecheck` passes (plan called it `app`; package name is `@lightfast/app`)
- [x] `pnpm --filter @lightfast/app build` passes
- [x] `grep -rn "/api/connect\|/api/ingest" apps/app/src apps/app/next.config.ts` returns zero matches
- [x] `pnpm typecheck` at repo root passes

#### Human Review:

- [ ] Run `pnpm dev:app`, then `curl -i http://localhost:4107/api/connect/foo` → expect 404 (was previously rewritten to platform). `curl -i http://localhost:4107/api/ingest/foo` → expect 404 or sign-in redirect (formerly rewritten + bypassed auth).
- [ ] Confirm `apps/app/next.config.ts` no longer references `platformUrl` inside `rewrites()` (the import may remain unused but harmless).

---

## Testing Strategy

### Unit Tests

- `api/platform/src/lib/jwt.test.ts` — round-trip caller validation, reject unknown issuers, reject expired tokens (existing).
- `api/platform/src/router/system/health.test.ts` — service auth → ok payload, unauthenticated → UNAUTHORIZED, internal → UNAUTHORIZED.
- `packages/platform-client/src/index.test.ts` — Bearer header attached and verifiable; `x-trpc-source` tagged with caller.

### Integration Tests

Not introduced this plan. The end-to-end smoke test is the Human Review step in Phase 3 + Phase 4 (manual `curl`/Node script run). A dedicated integration test (live HTTP server in vitest) is deferred until there's a second platform procedure to exercise — at that point a shared test harness is worth the cost.

## Performance Considerations

- `signServiceJWT` runs per outbound request batch (not per call). `httpBatchLink` already coalesces multiple procedure calls into one HTTP request, so token cost amortizes. No caching introduced — 60s TTL means caching adds complexity for ~1 saved sign per minute.
- Removing the rewrite paths shaves middleware/rewrite work off every request to `apps/app`; impact negligible but non-negative.

## Migration Notes

No data migration. No production code currently uses `signServiceJWT`, `createInternalCaller`, `adminProcedure`, the dead auth-context variants, or the rewrite paths — verified via grep. Removing them is no-op for runtime behavior.

If a feature branch separately introduces a use site for any of these (e.g. a desktop pre-release branch is referenced in git status), this plan must coordinate with that branch — but a search of `apps/app`, `apps/platform`, `api/`, and `packages/` in the current tree shows none.

## References

- Research: `thoughts/shared/research/2026-05-08-api-app-platform-core-boundaries.md`
- Predecessor research: `thoughts/shared/research/2026-05-07-repo-barebones-reset-v2.md`
- Predecessor plan: `thoughts/shared/plans/2026-05-07-repo-barebones-reset-v2.md`
- Pattern reference for sub-router shape: `api/app/src/root.ts`, `api/app/src/router/user/account.ts`
- Pattern reference for new package: `packages/app-trpc/package.json`, `packages/app-trpc/turbo.json`
- Boundary tag rules: `turbo.json:101-118`
- Workspace catalog: `pnpm-workspace.yaml:10-66`
