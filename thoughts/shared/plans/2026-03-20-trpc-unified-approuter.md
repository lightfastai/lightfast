# tRPC Unified AppRouter — Implementation Plan

## Overview

Consolidate the dual tRPC endpoint architecture (`/api/trpc/user` + `/api/trpc/org`) into a single `/api/trpc` endpoint with a unified `AppRouter`. Auth becomes a procedure-level concern instead of an endpoint-level concern. Dead CLI authorize code (`apiKeyProcedure`, `cliAuthorize`, `verifyApiKey` in trpc.ts) is removed — API key auth stays in the REST layer where it's actually used.

## Current State Analysis

**Two HTTP endpoints** with near-identical route files (CORS copy-pasted):
- `/api/trpc/user` → `userRouter` + `createUserTRPCContext` (Clerk `treatPendingAsSignedOut: false`)
- `/api/trpc/org` → `orgRouter` + `createOrgTRPCContext` (Clerk `treatPendingAsSignedOut: true`)

**Three procedure builders**, but `apiKeyProcedure` is dead code:
- `userScopedProcedure` — clerk-pending | clerk-active
- `orgScopedProcedure` — clerk-active only
- `apiKeyProcedure` — used by exactly one procedure (`cliAuthorize`) which has zero callers anywhere

**Dead code cluster** (self-contained island, no external callers):
- `cliAuthorize` procedure — `api/app/src/router/org/connections.ts:57-71`
- `apiKeyProcedure` builder — `api/app/src/trpc.ts:372-401`
- `verifyApiKey` helper — `api/app/src/trpc.ts:527-581` (only called by `apiKeyProcedure`)
- `"apiKey"` variant in `AuthContext` union — `api/app/src/trpc.ts:41-45`

Note: API key auth is alive and well in the REST layer (`withApiKeyAuth`, `withDualAuth`, CLI routes, SDK client) — just not in tRPC.

**Client routing** via `splitLink` in `packages/app-trpc/src/react.tsx` — routes by path prefix to the two endpoints. RSC uses two separate proxies (`userTrpc`, `orgTrpc`).

### Key Discoveries:
- Both context factories return the same shape (`{ auth: AuthContext, db, headers }`) — `api/app/src/trpc.ts:182`
- No namespace collisions between routers (`organization, account, workspaceAccess` vs `workspace, connections, jobs, orgApiKeys`) — `api/app/src/root.ts:31-53`

## Desired End State

Single tRPC endpoint at `/api/trpc/[trpc]` serving a merged `AppRouter`. Auth is resolved once in a unified Clerk-only context factory. Dead CLI authorize code is removed. Client uses a single `httpBatchStreamLink`. RSC uses a single `trpc` proxy.

### Verification:
- `pnpm build:app` succeeds
- `pnpm typecheck` passes
- `pnpm check` passes
- All existing web app functionality works identically (Clerk auth unchanged)
- No remaining references to `apiKeyProcedure`, `cliAuthorize`, or dead `verifyApiKey` in tRPC layer

## What We're NOT Doing

- NOT touching `@core/lightfast` or `@core/mcp` — they use REST `/v1/*` endpoints, not tRPC
- NOT touching `apps/app/src/app/api/cli/setup/route.ts` — CLI auth flow stays REST
- NOT touching the REST API routes (`/v1/search`, `/v1/contents`, etc.)
- NOT touching `apps/platform/` tRPC routes or OAuth callback logic
- NOT changing auth semantics — same users can access same procedures
- NOT touching `@vendor/` packages
- NOT touching REST-layer API key auth (`withApiKeyAuth`, `withDualAuth`, `@repo/app-api-key`) — those are live and used by v1 routes + gateway stream
- NOT adding API key auth to tRPC — CLI uses REST, not tRPC

## Implementation Approach

Five phases, each independently buildable and testable. Core strategy: unify context + remove dead code (phase 1), merge routers (phase 2), collapse route files (phase 3), update client wiring (phase 4), migrate call sites + clean up (phase 5).

---

## Phase 1: Unified tRPC Context + Dead Code Removal

### Overview
Replace the two context factories with a single Clerk-only `createTRPCContext`. Remove dead CLI authorize code (`apiKeyProcedure`, `cliAuthorize`, `verifyApiKey` in trpc.ts, `"apiKey"` AuthContext variant).

### Changes Required:

#### 1. Unified Context Factory
**File**: `api/app/src/trpc.ts`
**Changes**: Replace `createUserTRPCContext` and `createOrgTRPCContext` with a single `createTRPCContext`. Clerk-only — no API key path.

```typescript
/**
 * Unified tRPC context factory (Clerk auth only)
 *
 * API key auth is handled by the REST layer (withApiKeyAuth, withDualAuth),
 * not tRPC. The CLI uses REST endpoints, not tRPC procedures.
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const source = opts.headers.get("x-trpc-source") ?? "unknown";

  const clerkSession = await auth({ treatPendingAsSignedOut: false });

  if (clerkSession.userId) {
    if (clerkSession.orgId) {
      console.info(`>>> tRPC Request from ${source} by ${clerkSession.userId} (clerk-active)`);
      return {
        auth: { type: "clerk-active" as const, userId: clerkSession.userId, orgId: clerkSession.orgId },
        db,
        headers: opts.headers,
      };
    }
    console.info(`>>> tRPC Request from ${source} by ${clerkSession.userId} (clerk-pending)`);
    return {
      auth: { type: "clerk-pending" as const, userId: clerkSession.userId },
      db,
      headers: opts.headers,
    };
  }

  console.info(`>>> tRPC Request from ${source} - unauthenticated`);
  return {
    auth: { type: "unauthenticated" as const },
    db,
    headers: opts.headers,
  };
};
```

#### 2. Simplify `AuthContext` type
**File**: `api/app/src/trpc.ts`
**Changes**: Remove the `"apiKey"` variant from the `AuthContext` discriminated union (lines 41-45). Only three variants remain: `clerk-active`, `clerk-pending`, `unauthenticated`.

#### 3. Remove `apiKeyProcedure`
**File**: `api/app/src/trpc.ts`
**Changes**: Delete the entire `apiKeyProcedure` export (lines 372-401).

#### 4. Remove `verifyApiKey`
**File**: `api/app/src/trpc.ts`
**Changes**: Delete the `verifyApiKey` helper function (lines 527-581). This was only called by `apiKeyProcedure`. The REST-layer `withApiKeyAuth` has its own verification logic.

#### 5. Remove `cliAuthorize` procedure
**File**: `api/app/src/router/org/connections.ts`
**Changes**: Delete `cliAuthorize` (lines 57-71) and remove `apiKeyProcedure` from the import statement (line 15).

#### 6. Update `initTRPC` type reference
**File**: `api/app/src/trpc.ts`
**Changes**: Update the context type reference

```typescript
const t = initTRPC.context<typeof createTRPCContext>().create({
  // ... unchanged
});
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @api/app build` succeeds
- [x] `pnpm typecheck` passes (no type errors from context shape changes)
- [x] No remaining references to `apiKeyProcedure`, `cliAuthorize`, or the tRPC-layer `verifyApiKey` in `api/app/src/`

#### Manual Verification:
- [ ] Review that `AuthContext` has only three variants: `clerk-active`, `clerk-pending`, `unauthenticated`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Merge Routers

### Overview
Combine `userRouter` and `orgRouter` into a single `appRouter`. Update type exports.

### Changes Required:

#### 1. Merge routers
**File**: `api/app/src/root.ts`
**Changes**: Create single `appRouter`

```typescript
/**
 * App router — all tRPC procedures under a single router
 *
 * Auth boundaries enforced at the procedure level:
 * - userScopedProcedure: clerk-pending | clerk-active (onboarding)
 * - orgScopedProcedure: clerk-active only (org operations)
 */
import { connectionsRouter } from "./router/org/connections";
import { jobsRouter } from "./router/org/jobs";
import { orgApiKeysRouter } from "./router/org/org-api-keys";
import { workspaceRouter } from "./router/org/workspace";
import { accountRouter } from "./router/user/account";
import { organizationRouter } from "./router/user/organization";
import { workspaceAccessRouter } from "./router/user/workspace";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  // User-scoped (clerk-pending | clerk-active)
  organization: organizationRouter,
  account: accountRouter,
  workspaceAccess: workspaceAccessRouter,
  // Org-scoped (clerk-active | apiKey)
  workspace: workspaceRouter,
  connections: connectionsRouter,
  jobs: jobsRouter,
  orgApiKeys: orgApiKeysRouter,
});

export type AppRouter = typeof appRouter;

// Backwards compat — remove after all consumers migrate
export const userRouter = appRouter;
export const orgRouter = appRouter;
export type UserRouter = AppRouter;
export type OrgRouter = AppRouter;
```

#### 2. Update index exports
**File**: `api/app/src/index.ts`
**Changes**:

```typescript
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "./root";

export type { AppRouter } from "./root";
export { appRouter } from "./root";
export { createTRPCContext } from "./trpc";

// Backwards compat — remove after packages/app-trpc migrates
export { userRouter, orgRouter } from "./root";
export type { UserRouter, OrgRouter } from "./root";
export { createTRPCContext as createUserTRPCContext, createTRPCContext as createOrgTRPCContext } from "./trpc";

// Type utilities
export type AppRouterInputs = inferRouterInputs<AppRouter>;
export type AppRouterOutputs = inferRouterOutputs<AppRouter>;

export { createCallerFactory } from "./trpc";
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @api/app build` succeeds
- [x] `pnpm typecheck` passes

---

## Phase 3: Collapse Route Files

### Overview
Replace two tRPC route files with a single `[trpc]/route.ts`. Delete old directories.

### Changes Required:

#### 1. Create unified route file
**File**: `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts` (NEW)

```typescript
import { appRouter, createTRPCContext } from "@api/app";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { env } from "~/env";
import { wwwUrl } from "~/lib/related-projects";

export const runtime = "nodejs";

const allowedOrigins = new Set<string>([
  wwwUrl,
  ...(env.NODE_ENV === "development" ? ["http://localhost:3024"] : []),
]);

function applyCors(req: NextRequest, res: Response): Response {
  const origin = req.headers.get("origin");
  if (!origin || !allowedOrigins.has(origin)) return res;
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "content-type,authorization,x-trpc-source");
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  return res;
}

export const OPTIONS = (req: NextRequest) =>
  applyCors(req, new Response(null, { status: 204 }));

const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError({ error, path }) {
      console.error(`>>> tRPC Error on '${path}'`, error);
    },
  });
  return applyCors(req, response);
};

export { handler as GET, handler as POST };
```

#### 2. Delete old route files
- Delete `apps/app/src/app/(trpc)/api/trpc/org/` directory
- Delete `apps/app/src/app/(trpc)/api/trpc/user/` directory

### Success Criteria:

#### Automated Verification:
- [x] `pnpm build:app` succeeds (Next.js route resolution works)
- [x] No remaining imports of the deleted files

---

## Phase 4: Update `packages/app-trpc`

### Overview
Merge the two RSC proxies and remove the `splitLink`.

### Changes Required:

#### 1. Update server.tsx
**File**: `packages/app-trpc/src/server.tsx`
**Changes**: Single proxy, single context

```typescript
import type { AppRouter } from "@api/app";
import { appRouter, createTRPCContext } from "@api/app";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { TRPCOptionsProxy, TRPCQueryOptions } from "@trpc/tanstack-react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { cache } from "react";
import { createQueryClient } from "./client";

const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");
  return createTRPCContext({ headers: heads });
});

export const getQueryClient = cache(createQueryClient);

export const trpc: TRPCOptionsProxy<AppRouter> = createTRPCOptionsProxy({
  router: appRouter,
  ctx: createContext,
  queryClient: getQueryClient,
});

// Backwards compat — remove after call site migration
export const userTrpc = trpc;
export const orgTrpc = trpc;

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

export function prefetch(queryOptions: ReturnType<TRPCQueryOptions<any>>) {
  const queryClient = getQueryClient();
  if ((queryOptions.queryKey[1] as { type?: string } | undefined)?.type === "infinite") {
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}
```

#### 2. Update react.tsx
**File**: `packages/app-trpc/src/react.tsx`
**Changes**: Remove `splitLink`, single endpoint

```typescript
"use client";

import type { AppRouter } from "@api/app";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchStreamLink, loggerLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import SuperJSON from "superjson";
import { createQueryClient } from "./client";

export interface CreateTRPCReactProviderOptions {
  baseUrl?: string;
  getAuthHeaders?: () => Record<string, string>;
}

const trpcContext = createTRPCContext<AppRouter>();

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
  return `http://localhost:${process.env.PORT ?? 4104}`;
}

export function TRPCReactProvider({
  children,
  options,
}: {
  children: React.ReactNode;
  options?: CreateTRPCReactProviderOptions;
}) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() => {
    const baseUrl = options?.baseUrl ?? defaultGetBaseUrl();

    return createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: `${baseUrl}/api/trpc`,
          headers: () => ({
            "x-trpc-source": "client",
            ...(options?.getAuthHeaders?.() ?? {}),
          }),
          fetch(url, init) {
            return fetch(url, { ...init, credentials: "include" } as RequestInit);
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

#### 3. Update types.ts
**File**: `packages/app-trpc/src/types.ts`

```typescript
import type { AppRouter } from "@api/app";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm build:app` succeeds

---

## Phase 5: Update RSC Call Sites

### Overview
Replace `userTrpc.` and `orgTrpc.` with `trpc.` across all 14 RSC files.

### Changes Required:

All imports change from:
```typescript
import { HydrateClient, prefetch, userTrpc } from "@repo/app-trpc/server";
// or
import { HydrateClient, orgTrpc, prefetch } from "@repo/app-trpc/server";
```
To:
```typescript
import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
```

#### Files using `userTrpc` (4 files):

| File | Change |
|---|---|
| `apps/app/src/app/(app)/layout.tsx` | `userTrpc.organization.listUserOrganizations` → `trpc.organization.listUserOrganizations` |
| `apps/app/src/app/(app)/(user)/layout.tsx` | `userTrpc.account.get` → `trpc.account.get` |
| `apps/app/src/app/(app)/(user)/(pending-allowed)/account/settings/general/page.tsx` | `userTrpc.account.get` → `trpc.account.get` |
| `apps/app/src/app/(app)/(org)/[slug]/layout.tsx` | `userTrpc.workspaceAccess.listByClerkOrgSlug` → `trpc.workspaceAccess.listByClerkOrgSlug` |

#### Files using `orgTrpc` (9 files):

| File | Change |
|---|---|
| `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/sources/page.tsx` | `orgTrpc.connections.list` → `trpc.connections.list` |
| `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/page.tsx` | `orgTrpc.orgApiKeys.list` → `trpc.orgApiKeys.list` |
| `apps/app/src/app/(app)/(org)/[slug]/[workspaceName]/page.tsx` | `orgTrpc.workspace.store.get` → `trpc.workspace.store.get` |
| `apps/app/src/app/(app)/(org)/[slug]/[workspaceName]/search/page.tsx` | `orgTrpc.workspace.store.get` → `trpc.workspace.store.get` |
| `apps/app/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/layout.tsx` | `orgTrpc.workspace.events.list` → `trpc.workspace.events.list` |
| `apps/app/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/jobs/layout.tsx` | `orgTrpc.jobs.list` → `trpc.jobs.list` |
| `apps/app/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/page.tsx` | `orgTrpc.connections.generic.listInstallations` + `orgTrpc.workspace.sources.list` → `trpc.*` |
| `apps/app/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/page.tsx` | Same as above |
| `apps/app/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/settings/page.tsx` | `orgTrpc.workspace.getByName` → `trpc.workspace.getByName` |

#### 1 file using only `HydrateClient` (no change needed):
- `apps/app/src/app/(app)/(user)/(pending-not-allowed)/new/page.tsx`

### After migration, remove backwards compat aliases:
- Remove `export const userTrpc = trpc` and `export const orgTrpc = trpc` from `server.tsx`
- Remove `export const userRouter = appRouter` / `export const orgRouter = appRouter` from `root.ts`
- Remove old type/context re-exports from `api/app/src/index.ts`

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm build:app` succeeds
- [x] `pnpm check` passes
- [x] No remaining imports of `userTrpc`, `orgTrpc`, `userRouter`, `orgRouter`, `createUserTRPCContext`, `createOrgTRPCContext` anywhere in the codebase

#### Manual Verification:
- [ ] App loads at `http://localhost:3024`
- [ ] Sign-in flow works (pending user → org creation → workspace)
- [ ] Org-scoped pages load (workspace settings, sources, events, jobs)
- [ ] tRPC DevTools shows all calls going to `/api/trpc` (single endpoint)

**Implementation Note**: After completing this phase, pause for manual verification of the full sign-in flow before proceeding.

---

## Testing Strategy

### Automated Tests:
- Existing tRPC tests should pass without modification (procedure logic unchanged)
- Type tests via `pnpm typecheck` — ensures all call sites use correct types after merge

### Manual Testing Steps:
1. Start dev server: `pnpm dev:app`
2. Sign in as new user → verify `organization.create` works (clerk-pending path)
3. Select org → verify workspace list, settings, sources pages load
4. Connect a provider via OAuth popup → verify success
5. Verify the old endpoints `/api/trpc/user` and `/api/trpc/org` return 404

## Migration Notes

- Backwards compat aliases (`userRouter`, `orgRouter`, `userTrpc`, `orgTrpc`) are added in Phase 2/4 and removed in Phase 5
- The old `/api/trpc/user/` and `/api/trpc/org/` routes are deleted in Phase 3 — any external callers hitting those URLs will get 404
- Dead code removed: `apiKeyProcedure`, `cliAuthorize`, tRPC-layer `verifyApiKey`, `"apiKey"` AuthContext variant
- No database changes required
- No env var changes required
- REST-layer API key auth is untouched — CLI, SDK, and v1 routes continue to work

## References

- Research: `thoughts/shared/research/2026-03-20-trpc-dual-endpoint-design.md`
- Research: `thoughts/shared/research/2026-03-20-base-url-cors-related-projects-rework.md`
- tRPC infrastructure: `api/app/src/trpc.ts`
- Router assembly: `api/app/src/root.ts`
- Client wiring: `packages/app-trpc/src/react.tsx`, `packages/app-trpc/src/server.tsx`

## Update Log

### 2026-03-20 — Drop CLI authorize from tRPC scope
- **Trigger**: User decision — `cliAuthorize` is dead code with zero callers. CLI uses REST routes (`/api/cli/setup`, `/api/cli/login`) and REST-layer `withApiKeyAuth`/`withDualAuth`, not tRPC.
- **Changes**:
  - Phase 1 reworked: unified context is Clerk-only (no API key path). Dead code removal added (`apiKeyProcedure`, `cliAuthorize`, `verifyApiKey` in trpc.ts, `"apiKey"` AuthContext variant).
  - Phase 6 (Connection Flow Cleanup) dropped entirely — it was about merging `cliAuthorize` into `getAuthorizeUrl` and adding `pollConnect`, both features for CLI-via-tRPC that doesn't exist.
  - Plan reduced from 6 phases to 5.
  - References to platform OAuth state removed (no longer relevant to this plan).
- **Impact on remaining work**: Simplifies Phase 1 significantly. Phases 2-5 unchanged.
