---
date: 2026-03-19
topic: "@api/memory + packages/memory-trpc foundation layer"
tags: [plan, memory, trpc, foundation, jwt, service-auth]
status: ready
depends_on: []
blocks: [apps/memory, memory inngest workflows, memory DB schema]
---

# Implementation Plan: @api/memory + packages/memory-trpc Foundation

## Overview

Create the foundational tRPC layer for the memory service. This is the first package that must exist before `apps/memory` (the Next.js app), any Inngest workflows, or any DB schema work can proceed. Two packages:

1. **`api/memory/`** (`@api/memory`) -- Server-side tRPC routers with JWT-based service auth
2. **`packages/memory-trpc/`** (`@repo/memory-trpc`) -- Client adapter (RSC proxy, React provider, types)

Both follow the exact patterns established by `@api/console` and `@repo/console-trpc`.

---

## Key Design Decisions

### 1. JWT Service Auth (NOT Clerk M2M)

Console uses Clerk M2M tokens for inter-service auth. Memory uses **self-signed JWTs** via `jose`:

| Property | Console (`@api/console`) | Memory (`@api/memory`) |
|----------|-------------------------|----------------------|
| Auth lib | `@vendor/clerk` + `@repo/console-clerk-m2m` | `jose` (already in catalog) |
| Token type | Clerk M2M machine tokens | Self-signed HS256 JWT |
| Shared secret | Clerk machine credentials | `SERVICE_JWT_SECRET` env var |
| Token lifetime | Clerk-managed | 60 seconds (short-lived) |
| Verification | `verifyM2MToken()` from Clerk SDK | `jwtVerify()` from jose |

**Why**: Memory is a platform-internal service. It doesn't need Clerk's machine identity model. A shared HMAC secret with short-lived JWTs is simpler, faster (no Clerk API call), and sufficient for service-to-service auth within the same Vercel project boundary.

### 2. Auth Context -- Discriminated Union

```ts
type MemoryAuthContext =
  | { type: "service"; caller: string }    // JWT-verified (console, admin, platform)
  | { type: "webhook"; provider: string }  // HMAC/Ed25519 verified webhook
  | { type: "inngest" }                    // Inngest signing key
  | { type: "cron" }                       // QStash signature
  | { type: "unauthenticated" }
```

### 3. Single Router (Not Split)

Console splits into `userRouter`, `orgRouter`, `m2mRouter` because it serves human users with different auth levels. Memory is service-only -- all callers are internal. One top-level router with sub-routers:

```ts
export const memoryRouter = createTRPCRouter({
  // Populated in later phases
});

export const adminRouter = createTRPCRouter({
  // Populated in later phases
});
```

### 4. No splitLink Needed

Console's `react.tsx` uses `splitLink` to route user vs org procedures to different endpoints. Memory has a single router at a single endpoint. The React provider uses a single `httpBatchStreamLink`.

---

## Phase 1: `api/memory/` Package

### 1.1 Create `api/memory/package.json`

```jsonc
{
  "name": "@api/memory",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./src/index.ts"
    },
    "./env": {
      "types": "./dist/env.d.ts",
      "default": "./src/env.ts"
    }
  },
  "license": "FSL-1.1-Apache-2.0",
  "scripts": {
    "build": "tsc",
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "dev": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit --emitDeclarationOnly false"
  },
  "dependencies": {
    "@sentry/core": "catalog:",
    "@t3-oss/env-nextjs": "^0.12.0",
    "@trpc/server": "catalog:",
    "@vendor/observability": "workspace:*",
    "jose": "catalog:",
    "superjson": "catalog:",
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

**Notes**:
- Follows `@api/console` exactly: `tsc`-only build, two-tier exports (`types` -> `dist`, `default` -> `src`)
- No `@db/*` dependency yet -- added when memory DB schema is created
- No `@vendor/clerk` -- uses jose directly
- `@vendor/observability` for Sentry middleware (same as console)

### 1.2 Create `api/memory/tsconfig.json`

```jsonc
{
  "extends": "@repo/typescript-config/internal-package.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Matches `api/console/tsconfig.json` exactly.

### 1.3 Create `api/memory/turbo.json`

```jsonc
{
  "extends": ["//"],
  "tags": ["api"],
  "tasks": {}
}
```

Matches `api/console/turbo.json` exactly. The `api` tag ensures Turbo boundary rules apply (no `app` packages can depend on this).

### 1.4 Create `api/memory/src/env.ts`

```ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SERVICE_JWT_SECRET: z.string().min(32),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  experimental__runtimeEnv: process.env,
});
```

**Notes**:
- `SERVICE_JWT_SECRET` is the shared HMAC key for signing/verifying service JWTs
- Minimum 32 characters enforced by Zod
- More env vars added as features land (DB connection, Pinecone, etc.)

### 1.5 Create `api/memory/src/lib/jwt.ts`

```ts
/**
 * Service-to-service JWT utilities using HS256 (HMAC-SHA256).
 * Used by console/platform to authenticate calls to memory service.
 *
 * Short-lived (60s) tokens with explicit audience and issuer claims.
 * Edge-compatible via jose (no Node.js crypto dependency).
 */
import { jwtVerify, SignJWT } from "jose";

import { env } from "../env";

/** Standard JWT claims for service-to-service auth */
interface ServiceJWTPayload {
  /** Issuer -- identity of the calling service (e.g., "console", "platform", "admin") */
  iss: string;
  /** Audience -- always "lightfast-memory" */
  aud: string;
  /** Issued at -- Unix timestamp */
  iat: number;
  /** Expiration -- Unix timestamp (iss + 60s) */
  exp: number;
}

/** Verified JWT result returned to callers */
export interface VerifiedServiceJWT {
  caller: string; // From `iss` claim
}

/**
 * Encode the shared secret as a CryptoKey for HS256.
 * Cached at module level -- jose requires Uint8Array or CryptoKey.
 */
function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(env.SERVICE_JWT_SECRET);
}

/**
 * Sign a short-lived service JWT.
 *
 * @param caller - Identity of the calling service (e.g., "console", "platform")
 * @returns Signed JWT string (valid for 60 seconds)
 *
 * @example
 * ```ts
 * const token = await signServiceJWT("console");
 * // Use in Authorization header: `Bearer ${token}`
 * ```
 */
export async function signServiceJWT(caller: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({} as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(caller)
    .setAudience("lightfast-memory")
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(getSecretKey());
}

/**
 * Verify an incoming service JWT.
 *
 * @param token - JWT string from Authorization header
 * @returns Verified payload with caller identity
 * @throws {Error} If token is invalid, expired, or audience mismatch
 *
 * @example
 * ```ts
 * const { caller } = await verifyServiceJWT(token);
 * // caller === "console"
 * ```
 */
export async function verifyServiceJWT(
  token: string
): Promise<VerifiedServiceJWT> {
  const { payload } = await jwtVerify(token, getSecretKey(), {
    audience: "lightfast-memory",
    algorithms: ["HS256"],
  });

  const issuer = payload.iss;
  if (!issuer) {
    throw new Error("JWT missing issuer (iss) claim");
  }

  return { caller: issuer };
}
```

**Notes**:
- Uses `jose` (already in pnpm catalog at `^6.1.2`, used by `@repo/console-providers`)
- HS256 (HMAC-SHA256) -- symmetric key, no PKI needed
- 60-second expiry prevents replay attacks
- `aud: "lightfast-memory"` prevents tokens meant for other services from being accepted
- Edge-compatible (no Node.js `crypto` module)

### 1.6 Create `api/memory/src/trpc.ts`

```ts
/**
 * Memory service tRPC initialization.
 *
 * Auth model: service-to-service JWT (not Clerk).
 * All callers are internal services (console, platform, inngest, cron).
 */
import { trpcMiddleware } from "@sentry/core";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { verifyServiceJWT } from "./lib/jwt";

// ── Auth Context ─────────────────────────────────────────────────────────────

/**
 * Discriminated union for memory service authentication.
 * Every request resolves to exactly one variant.
 */
export type MemoryAuthContext =
  | { type: "service"; caller: string }
  | { type: "webhook"; provider: string }
  | { type: "inngest" }
  | { type: "cron" }
  | { type: "unauthenticated" };

// ── Context Creation ─────────────────────────────────────────────────────────

/**
 * Create tRPC context for memory service requests.
 *
 * Auth resolution order:
 * 1. Bearer JWT in Authorization header -> service auth
 * 2. X-Memory-Source header for internal identification
 * 3. Unauthenticated fallback
 *
 * Future: add webhook HMAC verification, Inngest signing key, QStash signature
 */
export const createMemoryTRPCContext = async (opts: { headers: Headers }) => {
  const source = opts.headers.get("x-trpc-source") ?? "unknown";

  // Check for service JWT in Authorization header
  const authHeader = opts.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");

    try {
      const verified = await verifyServiceJWT(token);
      console.info(
        `>>> Memory tRPC Request from ${source} - service JWT (caller: ${verified.caller})`
      );
      return {
        auth: {
          type: "service" as const,
          caller: verified.caller,
        },
        headers: opts.headers,
      };
    } catch (error) {
      console.warn("[Memory Auth] JWT verification error:", error);
    }
  }

  // No authentication
  console.info(`>>> Memory tRPC Request from ${source} - unauthenticated`);
  return {
    auth: { type: "unauthenticated" as const },
    headers: opts.headers,
  };
};

// ── tRPC Initialization ──────────────────────────────────────────────────────

const isProduction = process.env.NODE_ENV === "production";

const t = initTRPC.context<typeof createMemoryTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => {
    const shouldSanitize =
      isProduction && error.code === "INTERNAL_SERVER_ERROR";

    return {
      ...shape,
      message: shouldSanitize ? "An unexpected error occurred" : shape.message,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// ── Middleware ────────────────────────────────────────────────────────────────

const sentryMiddleware = t.middleware(
  trpcMiddleware({
    attachRpcInput: true,
  })
);

const sentrifiedProcedure = t.procedure.use(sentryMiddleware);

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();
  const end = Date.now();
  console.log(`[TRPC:memory] ${path} took ${end - start}ms to execute`);

  return result;
});

// ── Router & Procedure Exports ───────────────────────────────────────────────

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Public procedure -- no auth required.
 * Use for health checks or publicly accessible endpoints.
 */
export const publicProcedure = sentrifiedProcedure.use(timingMiddleware);

/**
 * Service procedure -- requires valid service JWT.
 * Used by console, platform, or other internal services calling memory.
 *
 * Guarantees `ctx.auth.type === "service"` and `ctx.auth.caller` is available.
 */
export const serviceProcedure = sentrifiedProcedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (ctx.auth.type !== "service") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message:
          "Service authentication required. Provide a valid service JWT in the Authorization header.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        auth: ctx.auth as Extract<MemoryAuthContext, { type: "service" }>,
      },
    });
  });

/**
 * Admin procedure -- requires service JWT from an admin caller.
 * Used for administrative operations (reindex, purge, etc.).
 *
 * Restricts `ctx.auth.caller` to "admin" only.
 */
export const adminProcedure = sentrifiedProcedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (ctx.auth.type !== "service") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Service authentication required.",
      });
    }

    if (ctx.auth.caller !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required. This endpoint is restricted to admin callers.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        auth: ctx.auth as Extract<MemoryAuthContext, { type: "service" }>,
      },
    });
  });
```

**Pattern alignment with `@api/console`**:
- Same `initTRPC.context<typeof createContext>().create()` pattern
- Same `errorFormatter` with production sanitization and Zod flattening
- Same `sentryMiddleware` + `timingMiddleware` chain
- Same context narrowing pattern via middleware (e.g., `ctx.auth as Extract<...>`)
- Same `createTRPCRouter` / `createCallerFactory` exports

### 1.7 Create `api/memory/src/root.ts`

```ts
/**
 * Memory service root router.
 *
 * Two top-level routers:
 * - memoryRouter: Service-accessible procedures (store, retrieve, search)
 * - adminRouter: Admin-only procedures (reindex, purge, diagnostics)
 */
import { createTRPCRouter } from "./trpc";

/**
 * Memory router -- service-accessible procedures.
 * Accessible via /api/trpc/memory/*
 *
 * Sub-routers will be added as features are implemented:
 * - events.*: Event store operations
 * - entities.*: Entity graph operations
 * - search.*: Semantic search operations
 */
export const memoryRouter = createTRPCRouter({
  // Empty initially -- sub-routers added in later phases
});

/**
 * Admin router -- restricted to admin callers.
 * Accessible via /api/trpc/admin/*
 *
 * Sub-routers will be added as features are implemented:
 * - reindex.*: Re-embed and reindex operations
 * - diagnostics.*: Health and status checks
 */
export const adminRouter = createTRPCRouter({
  // Empty initially -- sub-routers added in later phases
});

// Export types for client usage
export type MemoryRouter = typeof memoryRouter;
export type AdminRouter = typeof adminRouter;
```

### 1.8 Create `api/memory/src/index.ts`

```ts
// Export router types for client usage
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AdminRouter, MemoryRouter } from "./root";

/**
 * Memory API exports
 */

export type { AdminRouter, MemoryRouter } from "./root";
export { adminRouter, memoryRouter } from "./root";

// Export context creation
export { createMemoryTRPCContext } from "./trpc";
export type { MemoryAuthContext } from "./trpc";

// Type utilities
export type MemoryRouterInputs = inferRouterInputs<MemoryRouter>;
export type MemoryRouterOutputs = inferRouterOutputs<MemoryRouter>;
export type AdminRouterInputs = inferRouterInputs<AdminRouter>;
export type AdminRouterOutputs = inferRouterOutputs<AdminRouter>;

// tRPC utilities
export { createCallerFactory } from "./trpc";

// JWT utilities (for consumers that need to sign tokens)
export { signServiceJWT, verifyServiceJWT } from "./lib/jwt";
export type { VerifiedServiceJWT } from "./lib/jwt";
```

**Notes**:
- Exports `signServiceJWT` so consumers (console, platform) can sign tokens when calling memory
- Follows the same pattern as `@api/console/src/index.ts`: routers, types, context creators, caller factory

---

## Phase 2: `packages/memory-trpc/` Package

### 2.1 Create `packages/memory-trpc/package.json`

```jsonc
{
  "name": "@repo/memory-trpc",
  "license": "FSL-1.1-Apache-2.0",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    "./client": {
      "default": "./src/client.ts"
    },
    "./server": {
      "default": "./src/server.tsx"
    },
    "./react": {
      "default": "./src/react.tsx"
    },
    "./types": {
      "default": "./src/types.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@api/memory": "workspace:*",
    "@tanstack/react-query": "catalog:",
    "@trpc/client": "catalog:",
    "@trpc/server": "catalog:",
    "@trpc/tanstack-react-query": "catalog:",
    "next": "catalog:next16",
    "react": "19.2.4",
    "superjson": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "@types/react": "19.2.14",
    "typescript": "catalog:"
  }
}
```

**Notes**:
- Exact same structure as `@repo/console-trpc`
- Four exports: `./client`, `./server`, `./react`, `./types`
- No `types` field in exports (raw `.ts` source, `declaration: false`)
- Depends on `@api/memory` (not `@api/console`)
- No `@repo/console-clerk-m2m` dependency -- uses `signServiceJWT` from `@api/memory` instead

### 2.2 Create `packages/memory-trpc/tsconfig.json`

```jsonc
{
  "extends": "@repo/typescript-config/internal-package.json",
  "compilerOptions": {
    "types": ["node", "react"],
    "lib": ["DOM", "ES2020"],
    "jsx": "preserve",
    "moduleResolution": "bundler",
    "rootDir": "src",
    "outDir": "dist",
    "target": "ES2020",
    "module": "ESNext",
    "skipLibCheck": true,
    "declaration": false,
    "declarationMap": false,
    "emitDeclarationOnly": false,
    "noEmit": false
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

Matches `packages/console-trpc/tsconfig.json` exactly.

### 2.3 Create `packages/memory-trpc/src/client.ts`

```ts
import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
        shouldRedactErrors: () => false,
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
```

Identical to `console-trpc/src/client.ts`. Could potentially be extracted to a shared package later, but keeping it inline avoids premature abstraction.

### 2.4 Create `packages/memory-trpc/src/server.tsx`

```tsx
import type { MemoryRouter } from "@api/memory";
import {
  createMemoryTRPCContext,
  memoryRouter,
  signServiceJWT,
} from "@api/memory";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type {
  TRPCOptionsProxy,
  TRPCQueryOptions,
} from "@trpc/tanstack-react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { cache } from "react";

import { createQueryClient } from "./client";

/**
 * Create context for memory RSC calls.
 * Signs a service JWT automatically with caller="console".
 */
const createMemoryContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  // Sign a service JWT for the memory service
  const token = await signServiceJWT("console");
  heads.set("authorization", `Bearer ${token}`);

  return createMemoryTRPCContext({
    headers: heads,
  });
});

export const getQueryClient = cache(createQueryClient);

/**
 * Memory tRPC proxy for RSC.
 * Automatically authenticated as "console" caller.
 */
export const memoryTrpc: TRPCOptionsProxy<MemoryRouter> =
  createTRPCOptionsProxy({
    router: memoryRouter,
    ctx: createMemoryContext,
    queryClient: getQueryClient,
  });

/**
 * Create a server-side memory caller for service use.
 * Authenticated as the specified caller identity.
 *
 * @param caller - Service identity (e.g., "console", "platform", "inngest")
 */
export const createMemoryCaller = cache(async (caller = "console") => {
  const token = await signServiceJWT(caller);

  const heads = new Headers();
  heads.set("x-trpc-source", `${caller}-service`);
  heads.set("authorization", `Bearer ${token}`);

  const ctx = await createMemoryTRPCContext({ headers: heads });
  return memoryRouter.createCaller(ctx);
});

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

export function prefetch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryOptions: ReturnType<TRPCQueryOptions<any>>
) {
  const queryClient = getQueryClient();
  if (
    (queryOptions.queryKey[1] as { type?: string } | undefined)?.type ===
    "infinite"
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}
```

**Key differences from console-trpc**:
- Single context creator (not split user/org) because memory has one auth model
- `createMemoryContext` signs a JWT automatically (instead of using Clerk M2M token)
- `createMemoryCaller(caller)` accepts a caller identity parameter (default: "console")
- No separate webhook/inngest context creators -- those will be added when needed

### 2.5 Create `packages/memory-trpc/src/react.tsx`

```tsx
"use client";

import type { MemoryRouter } from "@api/memory";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchStreamLink,
  loggerLink,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import SuperJSON from "superjson";

import { createQueryClient } from "./client";

export interface CreateMemoryTRPCProviderOptions {
  baseUrl?: string;
  getAuthHeaders?: () => Record<string, string>;
}

const trpcContext = createTRPCContext<MemoryRouter>();

export const useTRPC = trpcContext.useTRPC;
export const TRPCProvider = trpcContext.TRPCProvider;

let clientQueryClientSingleton: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return createQueryClient();
  }

  return (clientQueryClientSingleton ??= createQueryClient());
}

function defaultGetBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${process.env.PORT ?? 4111}`;
}

export function MemoryTRPCReactProvider({
  children,
  options,
}: {
  children: React.ReactNode;
  options?: CreateMemoryTRPCProviderOptions;
}) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() => {
    const baseUrl = options?.baseUrl ?? defaultGetBaseUrl();

    return createTRPCClient<MemoryRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        // Single link -- memory has one router at one endpoint
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: `${baseUrl}/api/trpc/memory`,
          headers: () => ({
            "x-trpc-source": "client",
            ...(options?.getAuthHeaders?.() ?? {}),
          }),
          fetch(url, init) {
            return fetch(url, {
              ...init,
              credentials: "include",
            } as RequestInit);
          },
        }),
      ],
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

**Key differences from console-trpc**:
- Single `httpBatchStreamLink` (no `splitLink` needed)
- `MemoryRouter` type directly (no `UserRouter & OrgRouter` merge)
- Default port `4111` (memory service)
- Endpoint: `/api/trpc/memory`

### 2.6 Create `packages/memory-trpc/src/types.ts`

```ts
/**
 * Type utilities for memory tRPC client.
 */
import type { MemoryRouter } from "@api/memory";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

export type RouterOutputs = inferRouterOutputs<MemoryRouter>;
export type RouterInputs = inferRouterInputs<MemoryRouter>;
```

---

## Phase 3: Wire Up

### 3.1 Install Dependencies

```bash
# From monorepo root
pnpm install
```

The workspace protocol (`workspace:*`) handles resolution automatically.

### 3.2 Verify Build

```bash
# Build @api/memory
pnpm --filter @api/memory build
pnpm --filter @api/memory typecheck

# Build @repo/memory-trpc
pnpm --filter @repo/memory-trpc build
pnpm --filter @repo/memory-trpc typecheck
```

### 3.3 Verify JWT Round-Trip (unit test)

Create `api/memory/src/lib/jwt.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { signServiceJWT, verifyServiceJWT } from "./jwt";

describe("service JWT", () => {
  it("signs and verifies a valid token", async () => {
    const token = await signServiceJWT("console");
    const { caller } = await verifyServiceJWT(token);
    expect(caller).toBe("console");
  });

  it("rejects tokens with wrong audience", async () => {
    // Manually create a token with wrong audience using jose directly
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(process.env.SERVICE_JWT_SECRET);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("console")
      .setAudience("wrong-audience")
      .setIssuedAt()
      .setExpirationTime("60s")
      .sign(key);

    await expect(verifyServiceJWT(token)).rejects.toThrow();
  });

  it("rejects expired tokens", async () => {
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(process.env.SERVICE_JWT_SECRET);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("console")
      .setAudience("lightfast-memory")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120) // 2 min ago
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60) // expired 1 min ago
      .sign(key);

    await expect(verifyServiceJWT(token)).rejects.toThrow();
  });
});
```

---

## File Manifest

### New Files

| File | Package | Purpose |
|------|---------|---------|
| `api/memory/package.json` | `@api/memory` | Package manifest |
| `api/memory/tsconfig.json` | `@api/memory` | TypeScript config |
| `api/memory/turbo.json` | `@api/memory` | Turbo tags |
| `api/memory/src/env.ts` | `@api/memory` | Environment validation |
| `api/memory/src/lib/jwt.ts` | `@api/memory` | JWT sign/verify utilities |
| `api/memory/src/lib/jwt.test.ts` | `@api/memory` | JWT unit tests |
| `api/memory/src/trpc.ts` | `@api/memory` | tRPC init, context, procedures |
| `api/memory/src/root.ts` | `@api/memory` | Root router composition |
| `api/memory/src/index.ts` | `@api/memory` | Public API surface |
| `packages/memory-trpc/package.json` | `@repo/memory-trpc` | Package manifest |
| `packages/memory-trpc/tsconfig.json` | `@repo/memory-trpc` | TypeScript config |
| `packages/memory-trpc/src/client.ts` | `@repo/memory-trpc` | QueryClient factory |
| `packages/memory-trpc/src/server.tsx` | `@repo/memory-trpc` | RSC proxy + callers |
| `packages/memory-trpc/src/react.tsx` | `@repo/memory-trpc` | React provider |
| `packages/memory-trpc/src/types.ts` | `@repo/memory-trpc` | Inferred I/O types |

### Modified Files

None. This is a pure addition -- no existing files are modified.

---

## Validation Checklist

- [ ] `pnpm --filter @api/memory build` succeeds
- [ ] `pnpm --filter @api/memory typecheck` succeeds
- [ ] `pnpm --filter @api/memory test` passes (JWT round-trip)
- [ ] `pnpm --filter @repo/memory-trpc build` succeeds
- [ ] `pnpm --filter @repo/memory-trpc typecheck` succeeds
- [ ] `pnpm install` resolves all workspace:* dependencies
- [ ] `signServiceJWT("console")` produces a valid JWT
- [ ] `verifyServiceJWT(token)` returns `{ caller: "console" }`
- [ ] Expired tokens are rejected
- [ ] Wrong-audience tokens are rejected

---

## What This Unblocks

Once this foundation is in place, the following can proceed in parallel:

1. **`apps/memory/`** -- Next.js app with tRPC route handlers that mount `memoryRouter` and `adminRouter`
2. **Memory DB schema** -- `@db/memory` package with Drizzle schema, added as dependency to `@api/memory`
3. **Inngest workflows** -- Memory-specific Inngest functions (e.g., embed, index) served from `apps/memory`
4. **Console integration** -- Console can call memory via `createMemoryCaller()` from `@repo/memory-trpc/server`
