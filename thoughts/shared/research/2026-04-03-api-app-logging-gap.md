---
date: 2026-04-03T00:00:00+00:00
researcher: claude
git_commit: 34f5b76837648856dc476b8f947679021f7a6679
branch: chore/remove-memory-api-key-service-auth
repository: lightfast
topic: "@api/app logging gap — coverage audit and middleware approach"
tags: [research, codebase, logging, observability, trpc, api-app]
status: complete
last_updated: 2026-04-03
---

# Research: @api/app Logging Gap

**Date**: 2026-04-03  
**Git Commit**: `34f5b76837648856dc476b8f947679021f7a6679`  
**Branch**: `chore/remove-memory-api-key-service-auth`

## Research Question

Audit the logging coverage in `@api/app/` against `@vendor/observability/src/log/`, identify
which routes/functions lack logging, and design the most accretive approach — chosen: extend
`timingMiddleware` in `trpc.ts` into a full structured logging middleware.

---

## The Logger

**Package**: `@vendor/observability` (`vendor/observability/src/log/`)

Three exports:

| File | Runtime | Provider | Fallback |
|---|---|---|---|
| `log/next.ts` | Server (Node.js) | `@logtail/next` (BetterStack) in production | `console` in dev |
| `log/edge.ts` | Edge runtime | `@logtail/edge` (Logtail) in production | `console + flush()` in dev |
| `log/types.ts` | Shared | `Logger` interface: `debug/info/warn/error` |

All files in `@api/app/` import from `@vendor/observability/log/next`.

---

## Current Logging Coverage Audit

### Files WITH logging

| File | What's logged |
|---|---|
| `api/app/src/trpc.ts` | `createTRPCContext`: auth type + userId/orgId per request; `timingMiddleware`: procedure path + duration |
| `api/app/src/lib/activity.ts` | All 4 functions: validation errors, insert success/failure, batch results |
| `api/app/src/lib/jobs.ts` | All 5 functions: create/update/complete/get idempotency + errors |
| `api/app/src/inngest/workflow/infrastructure/record-activity.ts` | Batch processing: empty batch guard, batch insert result |
| `router/org/org-api-keys.ts` | `create`, `revoke`, `delete`, `rotate`: info on success, error on failure |
| `router/user/organization.ts` | `create`: info before + after Clerk call, error on failure |
| `router/user/account.ts` | `get`: error-only in catch block |
| `router/org/connections.ts` | `list`, `github.validate`, `github.detectConfig`: error-only in catch blocks |
| `router/org/jobs.ts` | `restart`: one `log.info` at invocation start only |

### Files WITHOUT logging (gaps)

| File | Procedures with zero logging |
|---|---|
| `router/org/events.ts` | `list` (read-only, but no logging at all) |
| `router/org/connections.ts` | `getAuthorizeUrl`, `disconnect`, `updateBackfillConfig`, `vercel.disconnect`, `resources.list`, `resources.bulkLink`, `generic.listInstallations`, `generic.listResources` |
| `router/org/jobs.ts` | `list`; `restart` only logs start, not completion |
| `router/user/organization.ts` | `listUserOrganizations`, `updateName` |
| `lib/token-vault.ts` | `getInstallationToken`, `getInstallationTokenWithRefresh` |

### Coverage breakdown

- **tRPC procedures covered**: ~9 / ~21 (~43%)
- **Critical unlogged mutations**: `connections.disconnect`, `connections.resources.bulkLink`, `connections.vercel.disconnect`, `organization.updateName`
- **Security-sensitive unlogged lib**: `lib/token-vault.ts` (decrypts stored tokens; throws bare `Error` on miss)

---

## The Gap: Pattern Analysis

### Pattern 1 — Error-only catch blocks

`connections.list`, `github.validate`, `github.detectConfig`, `account.get` all follow this pattern:
```typescript
try {
  // operation
  return result; // ← no log.info on success
} catch (error) {
  log.error("...", { ... }); // ← only error path logged
  throw new TRPCError(...);
}
```
Happy path is silent. Errors surface in BetterStack but successes don't.

### Pattern 2 — Fully silent mutations

`connections.disconnect`, `connections.updateBackfillConfig`, `connections.vercel.disconnect`,
`connections.resources.bulkLink` have no logging at all. These are state-mutating operations
(disconnecting integrations, creating/reactivating org integrations) with zero observability.

### Pattern 3 — Silent reads

`events.list`, `connections.resources.list`, `generic.listInstallations`, `generic.listResources`,
`jobs.list`, `organization.listUserOrganizations` — all query-only procedures with no logging.

### Pattern 4 — Partial procedure logging

`jobs.restart` logs `"[jobs] restart requested"` at start but never logs the outcome (the
`switch` throws for all cases, so no success path exists, but the error path is also silent).

### Pattern 5 — Unlogged lib (`token-vault.ts`)

`getInstallationToken` and `getInstallationTokenWithRefresh` are called from other services and
throw `Error` on missing tokens. No logging on success, no logging on the throw (error surfaces
only in the caller).

---

## Chosen Approach: Extend `timingMiddleware` in `trpc.ts`

**Why middleware**: The `timingMiddleware` (`trpc.ts:169`) is already composed into every
procedure via `publicProcedure`, `userScopedProcedure`, and `orgScopedProcedure`. Extending it
gives uniform coverage across all ~21 tRPC procedures without touching individual router files.

### Current `timingMiddleware` (`trpc.ts:169-184`)

```typescript
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  log.info("[trpc] procedure timing", { path, durationMs: end - start });

  return result;
});
```

**Gaps in current middleware**: logs timing but not auth context, and doesn't distinguish
success vs. error outcomes. Auth context is logged in `createTRPCContext` (once per request)
but not per-procedure — tRPC batching means one request can run multiple procedures.

### Proposed extension

Extend to a `loggingMiddleware` that accepts `ctx` and logs:

```typescript
const timingMiddleware = t.middleware(async ({ next, path, ctx }) => {
  const start = Date.now();

  // Enrich: bind auth context at procedure invocation
  const authMeta =
    ctx.auth.type === "clerk-active"
      ? { authType: ctx.auth.type, userId: ctx.auth.userId, orgId: ctx.auth.orgId }
      : ctx.auth.type === "clerk-pending"
        ? { authType: ctx.auth.type, userId: ctx.auth.userId }
        : { authType: ctx.auth.type };

  if (t._config.isDev) {
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();
  const durationMs = Date.now() - start;

  if (result.ok) {
    log.info("[trpc] ok", { path, durationMs, ...authMeta });
  } else {
    log.error("[trpc] error", {
      path,
      durationMs,
      ...authMeta,
      error: result.error.message,
      code: result.error.code,
    });
  }

  return result;
});
```

This single change gives:
- Every procedure gets `[trpc] ok` or `[trpc] error` with path + duration + auth context
- Auth errors (UNAUTHORIZED, FORBIDDEN thrown by `userScopedProcedure`/`orgScopedProcedure`)
  are automatically logged
- Internal errors (from TRPCError wrapping DB failures) appear with their code
- The existing `[trpc] request` log in `createTRPCContext` remains as the request-level log
- Zero changes needed in router files

### Separate treatment: `lib/token-vault.ts`

`token-vault.ts` is not a tRPC procedure — it's a direct DB/decryption utility called by other
services. It needs explicit logging:

```typescript
// getInstallationToken — add log on miss and on success
if (!token) {
  log.error("[token-vault] token not found", { installationId });
  throw new Error(`No token found for installation: ${installationId}`);
}
// (log success is optional — high-frequency, low-signal)
```

---

## Code References

- `vendor/observability/src/log/next.ts:1-10` — BetterStack/console log factory
- `vendor/observability/src/log/edge.ts:1-29` — Edge Logtail logger with `flush()`
- `vendor/observability/src/log/types.ts:1-6` — `Logger` interface
- `api/app/src/trpc.ts:60-103` — `createTRPCContext` with per-request auth logging
- `api/app/src/trpc.ts:169-184` — `timingMiddleware` (target for extension)
- `api/app/src/trpc.ts:193` — `publicProcedure` chains `timingMiddleware`
- `api/app/src/trpc.ts:211` — `userScopedProcedure` chains `timingMiddleware`
- `api/app/src/trpc.ts:260` — `orgScopedProcedure` chains `timingMiddleware`
- `api/app/src/lib/token-vault.ts:11-23` — `getInstallationToken` (unlogged)
- `api/app/src/router/org/events.ts:9-77` — `eventsRouter.list` (fully silent)
- `api/app/src/router/org/connections.ts:99-150` — `disconnect` mutation (fully silent)
- `api/app/src/router/org/connections.ts:551-649` — `resources.bulkLink` mutation (fully silent)

## Architecture Notes

- `timingMiddleware` is composed via `.use()` on the three base procedures, not on `t.procedure`
  directly — so adding auth context requires destructuring `ctx` (currently not in scope in
  the timing middleware's `{ next, path }` parameter)
- `result.ok` is a boolean on the tRPC `MiddlewareResult` type — safe to branch on for
  success/error discrimination inside middleware
- The `createTRPCContext` logs are NOT per-procedure — one context is created per HTTP request,
  which may batch multiple procedures. The middleware logs once per procedure invocation.
- `timingMiddleware` currently uses `path` (string like `"connections.disconnect"`) —
  this is the tRPC procedure path, not an HTTP path, which is ideal for structured logging
