# Hoist `createMemoryCaller()` in `proxySearchLogic` — Implementation Plan

## Overview

Eliminate the N+1 `createMemoryCaller()` allocation in `proxySearchLogic` by hoisting the call above the `Promise.all` loop. Each redundant call performs two HMAC-SHA256 operations (sign + verify), header construction, and logging — all producing an identical, installation-agnostic caller. For an org with N active installations, this removes N−1 unnecessary JWT round-trips.

## Current State Analysis

- `proxySearchLogic` (`apps/app/src/lib/proxy.ts:21`) queries all active installations for an org, then iterates over them in `Promise.all`.
- Inside the loop (line 56), `createMemoryCaller()` is called per installation.
- `createMemoryCaller` (`packages/platform-trpc/src/caller.ts:20-29`) signs a service JWT via `signServiceJWT` (HMAC-SHA256), constructs auth headers, then calls `createMemoryTRPCContext` which verifies the same JWT (another HMAC-SHA256). The resulting context is `{ auth: { type: "service", caller: "console" }, headers }` — no installation state.
- The `cache()` wrapper on `createMemoryCaller` is a no-op in this non-RSC context (React default bundle), so no memoization occurs.
- `proxyCallLogic` (line 263) also calls `createMemoryCaller()`, but only once per request — no loop, no issue.

### Key Discoveries

- The caller is fully stateless w.r.t. installations — `installationId` is passed as procedure input at call time, not at caller creation (`proxy.ts:63`).
- `signServiceJWT` (`api/platform/src/lib/jwt.ts:31-41`): async HMAC-SHA256 sign via `jose`.
- `verifyServiceJWT` (`api/platform/src/lib/jwt.ts:50-64`): async HMAC-SHA256 verify via `jose`.
- `createMemoryTRPCContext` (`api/platform/src/trpc.ts:38-77`): reads Authorization header, verifies JWT, returns service auth context. No installation-specific state.

## Desired End State

`createMemoryCaller()` is called exactly **once** in `proxySearchLogic`, before the `Promise.all` loop. All loop iterations share the same caller instance. Behavior is identical — only performance changes.

### How to verify

1. `pnpm check && pnpm typecheck` passes.
2. `proxySearchLogic` still returns the same response shape.
3. For an org with N installations, only 1 JWT sign + 1 JWT verify occurs (down from N each).

## What We're NOT Doing

- Changing `proxyCallLogic` (no N+1 issue there).
- Removing or replacing the `cache()` wrapper on `createMemoryCaller` (separate concern).
- Adding memoization or caching to `createMemoryCaller` itself.
- Changing any other call sites (e.g., `connections.ts` handlers — those are one-per-request).

## Implementation — Single Phase [DONE]

### Changes Required

**File**: `apps/app/src/lib/proxy.ts`

Move `createMemoryCaller()` from inside the `.map()` callback to before `Promise.all`:

```diff
 export async function proxySearchLogic(
   auth: AuthContext,
   requestId: string
 ): Promise<ProxySearchResponse> {
   const installations = await db
     .select()
     .from(gatewayInstallations)
     .where(
       and(
         eq(gatewayInstallations.orgId, auth.clerkOrgId),
         eq(gatewayInstallations.status, "active")
       )
     );

+  // Create caller once — it's stateless w.r.t. installations.
+  // installationId is passed as procedure input at call time.
+  const memory = await createMemoryCaller();
+
   const connections = await Promise.all(
     installations.map(async (inst) => {
       // ... existing code ...

       // Build executeApi callback for this installation
-      const memory = await createMemoryCaller();
       const executeApi = async (req: {
```

That's it. One line moves up, one comment added.

### Success Criteria

#### Automated Verification

- [x] `pnpm check` passes (lint + format)
- [x] `pnpm typecheck` passes
- [x] `pnpm build:app` succeeds

#### Manual Verification

- [ ] Proxy search endpoint returns the same response for an org with multiple installations
- [ ] No regressions in connection listing or resource resolution

## Performance Considerations

- **Before**: N installations → N JWT signs + N JWT verifies + N log calls + N caller proxy constructions
- **After**: N installations → 1 JWT sign + 1 JWT verify + 1 log call + 1 caller proxy construction
- Savings scale linearly with installation count per org

## References

- Research: `thoughts/shared/research/2026-04-05-proxy-search-createMemorycaller-n-plus-1.md`
- Call site: `apps/app/src/lib/proxy.ts:56`
- Caller impl: `packages/platform-trpc/src/caller.ts:20-29`
- JWT sign: `api/platform/src/lib/jwt.ts:31-41`
- JWT verify: `api/platform/src/lib/jwt.ts:50-64`
- Context factory: `api/platform/src/trpc.ts:38-77`
