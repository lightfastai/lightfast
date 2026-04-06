# Standardize @repo/platform-trpc to Match @repo/app-trpc Patterns

## Overview

Align `@repo/platform-trpc` with `@repo/app-trpc` conventions: fix the incorrect URL endpoint, adopt the `(trpc)` route group pattern, and normalize minor code style differences. `PlatformTRPCReactProvider` is unused today but kept for future use.

## Current State Analysis

Both packages follow the same 4-file structure (`client.ts`, `react.tsx`, `server.tsx`, `types.ts`) with platform-trpc adding `caller.ts`. Three inconsistencies exist:

1. **URL mismatch**: platform react client points to `/api/trpc/platform` but the route handler endpoint is `/api/trpc` — the `/platform` suffix is a leftover from the memory→platform rename
2. **Route group**: app uses `(trpc)` route group (`apps/app/src/app/(trpc)/api/trpc/[trpc]/`), platform does not (`apps/platform/src/app/api/trpc/[trpc]/`)
3. **Minor style**: platform `client.ts` is missing comments; platform `react.tsx` has an outdated inline comment

### Key Discoveries:

- `PlatformTRPCReactProvider` is not mounted in any layout — all platform calls go through `createPlatformCaller` (server-side)
- The `/api/trpc/platform` URL would actually fail at runtime with the current `[trpc]` (single-segment) route if the provider were ever mounted
- `api/platform/src/root.ts:15` has a stale comment referencing `/api/trpc/platform/*`
- No other code references `/api/trpc/platform` — only thoughts docs

## Desired End State

- `packages/platform-trpc/src/react.tsx` URL matches the route handler endpoint (`/api/trpc`)
- `apps/platform/src/app/(trpc)/api/trpc/[trpc]/route.ts` uses the `(trpc)` route group
- `packages/platform-trpc/src/client.ts` has the same comment style as app-trpc
- Stale comments removed/updated

### Verification:

- `pnpm build:platform` succeeds
- `pnpm --filter @repo/platform-trpc typecheck` passes
- Route handler still serves at `/api/trpc/*` (the `(trpc)` group doesn't affect URL)

## What We're NOT Doing

- Not changing `caller.ts` — platform-specific, correctly different
- Not changing `server.tsx` — JWT auth is intentionally different from app-trpc
- Not changing `types.ts` — already identical pattern
- Not mounting `PlatformTRPCReactProvider` anywhere — that's a separate future task

## Phase 1: Standardize platform-trpc Package Files

### Changes Required:

#### 1. Fix URL in `react.tsx`

**File**: `packages/platform-trpc/src/react.tsx`
**Changes**: Fix URL from `/api/trpc/platform` to `/api/trpc`, remove stale comment

```diff
-        // Single link -- platform has one router at one endpoint
         httpBatchStreamLink({
           transformer: SuperJSON,
-          url: `${baseUrl}/api/trpc/platform`,
+          url: `${baseUrl}/api/trpc`,
           headers: () => ({
```

#### 2. Align `client.ts` comments

**File**: `packages/platform-trpc/src/client.ts`
**Changes**: Add the same inline comments that `app-trpc/src/client.ts` has

```typescript
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
        shouldRedactErrors: () => {
          // We should not catch Next.js server errors
          // as that's how Next.js detects dynamic pages
          // so we cannot redact them.
          // Next.js also automatically redacts errors for us
          // with better digests.
          return false;
        },
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
```

#### 3. Update stale comment in `root.ts`

**File**: `api/platform/src/root.ts`
**Changes**: Fix comment referencing `/api/trpc/platform/*`

```diff
- * Accessible via /api/trpc/platform/*
+ * Accessible via /api/trpc/*
```

## Phase 2: Move Route Handler to `(trpc)` Route Group

### Changes Required:

#### 1. Move route handler directory

**From**: `apps/platform/src/app/api/trpc/[trpc]/route.ts`
**To**: `apps/platform/src/app/(trpc)/api/trpc/[trpc]/route.ts`

No code changes needed inside the file — the `(trpc)` route group is a Next.js organizational convention that doesn't affect the URL path. The handler will continue to serve at `/api/trpc/*`.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm build:platform` succeeds
- [x] `pnpm --filter @repo/platform-trpc typecheck` passes
- [x] `pnpm check` passes

#### Manual Verification:

- [ ] `pnpm dev:platform` starts and `/api/trpc` endpoint responds
- [ ] No regressions in platform tRPC calls from app (via `createPlatformCaller`)

**Implementation Note**: After completing both phases and all automated verification passes, pause for manual confirmation that platform dev server works correctly.

## References

- Research: `thoughts/shared/research/2026-04-05-trpc-package-comparison.md`
- App reference (react.tsx): `packages/app-trpc/src/react.tsx`
- App reference (client.ts): `packages/app-trpc/src/client.ts`
- App reference (route group): `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts`
