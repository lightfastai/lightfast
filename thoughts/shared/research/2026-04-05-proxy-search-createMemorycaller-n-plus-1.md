---
date: 2026-04-05T00:00:00+00:00
researcher: claude
git_commit: e744e34bb706e2beb7c11145b8de85f659a8f925
branch: refactor/drop-workspace-abstraction
topic: "Verify: N+1 createMemoryCaller() allocation in proxySearchLogic"
tags: [research, codebase, proxy, platform-trpc, performance]
status: complete
last_updated: 2026-04-05
---

# Research: N+1 `createMemoryCaller()` allocation in `proxySearchLogic`

**Date**: 2026-04-05
**Git Commit**: e744e34bb706e2beb7c11145b8de85f659a8f925
**Branch**: refactor/drop-workspace-abstraction

## Research Question

In `proxySearchLogic` (`apps/app/src/lib/proxy.ts:56`), `createMemoryCaller()` is invoked inside a `Promise.all` loop that iterates over installations. Is this a real N+1 resource allocation issue?

## Verdict

**Yes, this is a valid issue.** The caller is not bound to any installation-specific state. It could be created once before the loop and reused across all iterations. Each redundant call performs two HMAC-SHA256 operations (sign + verify), constructs headers, and logs — all unnecessarily repeated per installation.

## Detailed Findings

### What `createMemoryCaller()` does (per call)

| Step | Operation | Cost |
|------|-----------|------|
| 1 | `TextEncoder().encode(secret)` — derive key bytes | Sync CPU (no caching) |
| 2 | `SignJWT({}).sign(key)` — HMAC-SHA256 sign | Async crypto |
| 3 | `new Headers()` + 2 `set()` calls | Trivial |
| 4 | `verifyServiceJWT(token)` — HMAC-SHA256 verify | Async crypto |
| 5 | `log.info(...)` — context creation log | Async I/O |
| 6 | `memoryRouter.createCaller(ctx)` — Proxy construction | Sync, trivial |

Source: `packages/platform-trpc/src/caller.ts:20-29`

### Why the caller is reusable

The context object captured by the caller contains only service-level identity:

```ts
{ auth: { type: "service", caller: "console" }, headers: Headers { ... } }
```

There is **no** installation ID, org ID, or user context. The `installationId` is passed as procedure input at call time (`memory.proxy.execute({ installationId, ... })`), not at caller creation time. The caller is fully stateless with respect to installations.

### Why `cache()` doesn't help here

`createMemoryCaller` is wrapped in React's `cache()` (`packages/platform-trpc/src/caller.ts:20`). However, the `@repo/platform-trpc/caller` export resolves to the default React bundle (not the `react-server` variant). In the default bundle, `cache()` is a **no-op wrapper** — it calls through to `fn` every time with no memoization. RSC-aware memoization only activates under the `"react-server"` export condition, which the `caller` export does not use.

### The issue in context

At `proxy.ts:56`, inside `installations.map(async (inst) => { ... })`:

```ts
const memory = await createMemoryCaller();  // line 56 — repeated per installation
```

For an org with N active installations, this signs N JWTs, verifies N JWTs, and creates N identical caller proxies. A single caller created before the loop would suffice.

### Contrast with `proxyCallLogic`

At `proxy.ts:263`, the same function also calls `createMemoryCaller()`, but this is inside `proxyCallLogic` which handles a single installation per request — no loop, no N+1 issue there.

### Broader pattern

The same per-procedure creation pattern exists across `api/app/src/router/org/connections.ts` (lines 47, 117, 217, 315, 461, 682, 748), but those are individual tRPC procedure handlers (one call per request), so they don't have the N+1 problem.

## Proposed Fix

Hoist `createMemoryCaller()` above the `Promise.all` in `proxySearchLogic`:

```ts
// Before the loop — create once
const memory = await createMemoryCaller();

const connections = await Promise.all(
  installations.map(async (inst) => {
    // ... existing code ...

    // line 56-69: use the shared `memory` instead of creating a new one
    const executeApi = async (req: { ... }) =>
      memory.proxy.execute({
        installationId: inst.id,
        endpointId: req.endpointId,
        pathParams: req.pathParams,
        queryParams: req.queryParams,
        body: req.body,
      });

    // ... rest unchanged ...
  })
);
```

## Code References

- `apps/app/src/lib/proxy.ts:56` — N+1 call site inside loop
- `apps/app/src/lib/proxy.ts:263` — single call site (no issue)
- `packages/platform-trpc/src/caller.ts:20-29` — `createMemoryCaller` implementation
- `api/platform/src/lib/jwt.ts:31-41` — `signServiceJWT` (HMAC sign)
- `api/platform/src/lib/jwt.ts:50-64` — `verifyServiceJWT` (HMAC verify)
- `api/platform/src/trpc.ts:38-77` — `createMemoryTRPCContext` (context factory)
