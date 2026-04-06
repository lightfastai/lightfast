---
date: 2026-04-05T00:00:00+00:00
researcher: claude
git_commit: dd2ad39687a31e63e29147db148b58e24d87fbd4
branch: main
topic: "Comparison of @repo/app-trpc and @repo/platform-trpc packages"
tags: [research, codebase, trpc, app-trpc, platform-trpc, architecture]
status: complete
last_updated: 2026-04-05
---

# Research: Comparison of @repo/app-trpc and @repo/platform-trpc packages

**Date**: 2026-04-05
**Git Commit**: dd2ad3968
**Branch**: main

## Research Question

How do the two tRPC client packages (`@repo/app-trpc` and `@repo/platform-trpc`) compare? Are they following the same standards? Specific focus on the URL routing and whether the `url: \`\${baseUrl}/api/trpc/platform\`` endpoint in platform-trpc's react client is correct.

## Summary

The two packages follow the **same structural pattern** (client.ts, react.tsx, server.tsx, types.ts) with one key difference: **platform-trpc has an extra `caller.ts` export** for non-React backend contexts. The code is largely identical in shape but differs in naming, URL endpoints, and auth approach.

The platform react client currently points to `${baseUrl}/api/trpc/platform` — this URL path is designed for requests originating from `apps/app` (where the platform frontend is proxied via microfrontends). However, `PlatformTRPCReactProvider` is **not currently used in any app layout** — only app-trpc's `TRPCReactProvider` is mounted. All platform tRPC consumption happens server-side via `createPlatformCaller`.

## Detailed Findings

### Package Structure Comparison

| File | `@repo/app-trpc` | `@repo/platform-trpc` |
|---|---|---|
| `client.ts` | QueryClient factory | QueryClient factory (identical minus comments) |
| `react.tsx` | `TRPCReactProvider` → `/api/trpc` | `PlatformTRPCReactProvider` → `/api/trpc/platform` |
| `server.tsx` | Direct caller via `appRouter` | Direct caller via `platformRouter` + JWT auth |
| `types.ts` | `RouterInputs`/`RouterOutputs` from `AppRouter` | `RouterInputs`/`RouterOutputs` from `PlatformRouter` |
| `caller.ts` | *(does not exist)* | `createPlatformCaller` for non-React backend use |
| `package.json` exports | `./client`, `./server`, `./react`, `./types` | `./caller`, `./client`, `./server`, `./react`, `./types` |

### File: `client.ts` — Identical Pattern

Both create a `QueryClient` with:
- `staleTime: 30 * 1000`
- SuperJSON serialize/deserialize for hydration
- `shouldDehydrateQuery` includes pending queries
- `shouldRedactErrors` returns false

Only difference: app-trpc has inline comments, platform-trpc does not.

### File: `react.tsx` — Same Shape, Different URLs

**Structural parallels:**
- Both use `createTRPCContext<Router>()` to produce `useTRPC` and `TRPCProvider`
- Both use module-level `clientQueryClientSingleton` for client-side caching
- Both have identical `getQueryClient()` SSR/client logic
- Both use `httpBatchStreamLink` with SuperJSON transformer and `credentials: "include"`
- Both pass `x-trpc-source: "client"` header

**Differences:**

| Aspect | app-trpc | platform-trpc |
|---|---|---|
| Router type | `AppRouter` | `PlatformRouter` |
| Component name | `TRPCReactProvider` | `PlatformTRPCReactProvider` |
| Options type | `CreateTRPCReactProviderOptions` | `CreatePlatformTRPCProviderOptions` |
| URL endpoint | `${baseUrl}/api/trpc` | `${baseUrl}/api/trpc/platform` |
| Default port | 4104 | 4112 |
| Comment | *(none)* | `// Single link -- platform has one router at one endpoint` |

**Actual usage:**
- `TRPCReactProvider` is mounted in `apps/app/src/app/(app)/layout.tsx:14`
- `PlatformTRPCReactProvider` is **not mounted anywhere** — no app code imports it

### File: `server.tsx` — Auth Model Differs

**app-trpc `server.tsx`:**
- Creates context by forwarding `next/headers` with `x-trpc-source: "rsc"`
- No auth — relies on cookies/Clerk session already present in headers
- Exports: `trpc` (options proxy), `getQueryClient`, `HydrateClient`, `prefetch`

**platform-trpc `server.tsx`:**
- Creates context by signing a **service JWT** (`signServiceJWT("app")`) and setting `Authorization: Bearer <token>`
- This is because platform is a separate service requiring explicit authentication
- Exports: `platformTrpc` (options proxy), `getQueryClient`, `HydrateClient`, `prefetch`, `createPlatformCaller`
- Has a `createPlatformCaller` that allows specifying caller identity (default "app")

### File: `caller.ts` — Platform-Only

`packages/platform-trpc/src/caller.ts` provides `createPlatformCaller` for non-React contexts. This is a subset of what `server.tsx` exports, but without JSX/React dependencies.

Used by:
- `api/app/src/router/org/connections.ts:12` — org connections router
- `apps/app/src/lib/proxy.ts:9` — proxy call/search logic

app-trpc has no equivalent because app tRPC is always consumed within the same Next.js app (no cross-service calls needed).

### File: `types.ts` — Identical Pattern

Both export `RouterOutputs` and `RouterInputs` using `inferRouterOutputs`/`inferRouterInputs` from their respective routers.

### Route Handlers

**App: `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts`**
- `endpoint: "/api/trpc"`, `router: appRouter`
- CORS: allows `wwwUrl` + localhost:3024 in dev
- Error handling: Sentry + structured logging

**Platform: `apps/platform/src/app/api/trpc/[trpc]/route.ts`**
- `endpoint: "/api/trpc"`, `router: platformRouter`
- CORS: allows only `appUrl`
- Error handling: same Sentry + structured logging pattern
- Both use `[trpc]` (single segment catch, not catch-all `[...trpc]`)

### URL Routing Analysis

The platform react client sets `url: \`\${baseUrl}/api/trpc/platform\``. This URL would produce requests like:
- `${baseUrl}/api/trpc/platform?batch=1&input=...` (batch requests)

If `baseUrl` resolves to the platform app itself (`localhost:4112` or `platform.lightfast.ai`), the Next.js route at `apps/platform/src/app/api/trpc/[trpc]/route.ts` would receive `[trpc]` = the procedure name with the `fetchRequestHandler` stripping the `/api/trpc` prefix.

However, with `url` set to `/api/trpc/platform`, httpBatchStreamLink sends requests to `/api/trpc/platform/procedureName`, which would need a catch-all `[...trpc]` route to match. The current `[trpc]` (single segment) would not match `/api/trpc/platform/procedureName`.

This is moot in practice because `PlatformTRPCReactProvider` is **never mounted** — all platform tRPC calls go through `createPlatformCaller` (server-side direct caller, no HTTP).

### Consumers

**app-trpc consumers (client-side via react.tsx):**
- `apps/app/src/app/(app)/layout.tsx` — mounts `TRPCReactProvider`
- 14 files use `useTRPC` from `@repo/app-trpc/react`

**platform-trpc consumers (server-side only):**
- `api/app/src/router/org/connections.ts` — via `createPlatformCaller`
- `apps/app/src/lib/proxy.ts` — via `createPlatformCaller`
- No client-side consumers of `PlatformTRPCReactProvider`

## Code References

- `packages/app-trpc/src/react.tsx:67` — app URL: `${baseUrl}/api/trpc`
- `packages/platform-trpc/src/react.tsx:69` — platform URL: `${baseUrl}/api/trpc/platform`
- `packages/platform-trpc/src/caller.ts:20` — `createPlatformCaller` (non-React)
- `packages/platform-trpc/src/server.tsx:27` — JWT signing for platform context
- `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts:59` — app route handler endpoint
- `apps/platform/src/app/api/trpc/[trpc]/route.ts:49` — platform route handler endpoint
- `apps/app/src/app/(app)/layout.tsx:14` — only layout mounting a tRPC provider
- `apps/app/src/lib/proxy.ts:9` — platform caller usage in proxy logic

## Architecture Documentation

The two tRPC layers serve different purposes:

1. **app-trpc**: Client-server tRPC within `apps/app`. Browser → Next.js API route → `appRouter`. Used for all user-facing UI operations (orgs, sources, settings, jobs, events, etc.).

2. **platform-trpc**: Server-to-server tRPC from `apps/app` backend → `apps/platform` backend. Currently used exclusively via direct callers (`createPlatformCaller`), not HTTP. The react client (`PlatformTRPCReactProvider`) exists but is unused.

The packages follow the same conventions (file names, exports, QueryClient config) with platform-trpc having the additional `caller.ts` for backend use and JWT-based auth in `server.tsx`.

## Open Questions

1. Is `PlatformTRPCReactProvider` intended for future use, or is it dead code that should be removed?
2. If the platform react client is intended for use, should the URL be `${baseUrl}/api/trpc` (matching the platform route handler's endpoint) rather than `${baseUrl}/api/trpc/platform`?
