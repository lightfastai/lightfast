---
date: 2026-04-03T00:00:00+00:00
researcher: claude
git_commit: 34f5b76837648856dc476b8f947679021f7a6679
branch: chore/remove-memory-api-key-service-auth
repository: lightfast
topic: "@api/app logging gap — migrating console.* to @vendor/observability"
tags: [research, codebase, api-app, logging, observability, trpc, inngest]
status: complete
last_updated: 2026-04-03
---

# Research: `@api/app` Logging Gap

**Date**: 2026-04-03  
**Git Commit**: `34f5b76837648856dc476b8f947679021f7a6679`  
**Branch**: `chore/remove-memory-api-key-service-auth`

## Research Question

What is the logging gap in `@api/app/`? Which files still use `console.*` instead of `@vendor/observability/src/log/`, and which files have no logging at all?

## Summary

`@api/app/src` has **partial adoption** of `@vendor/observability/log/next`. Three files in `lib/` and the single Inngest workflow already use the structured `log` singleton correctly. The gap is in the tRPC layer: `trpc.ts` and four router files still use raw `console.*` (12 total calls), and five additional files have zero logging coverage despite performing meaningful operations (API key creation/rotation, job restarts, cursor-paginated queries).

The reference implementation is `@api/platform/src`, which has **full adoption** across 17 files — including its own `trpc.ts` and all Inngest functions.

---

## The Logger Infrastructure

Located in `vendor/observability/src/log/`.

### `next.ts` (server-only)
```ts
import { log as logtail } from "@logtail/next";
const shouldUseBetterStack = betterstackEnv.VERCEL_ENV === "production";
export const log = shouldUseBetterStack ? logtail : console;
export type Logger = typeof log;
```
In production → Logtail (BetterStack). Otherwise → native `console`.

### `edge.ts` (edge runtime)
```ts
export type EdgeLogger = Logger & { flush(): Promise<unknown> };
export const log: EdgeLogger =
  token && betterstackEdgeEnv.VERCEL_ENV === "production"
    ? fromLogtail(new Logtail(token, { endpoint }))
    : { ...console, flush: () => Promise.resolve() };
```
Same conditional but adds `flush()` for edge runtime flushing.

### `types.ts`
```ts
export interface Logger {
  debug: (message: string, metadata?: Record<string, unknown>) => void;
  error: (message: string, metadata?: Record<string, unknown>) => void;
  info: (message: string, metadata?: Record<string, unknown>) => void;
  warn: (message: string, metadata?: Record<string, unknown>) => void;
}
```

---

## Current State: What Already Uses `@vendor/observability`

Three files in `@api/app/src` already import and use `log` from `@vendor/observability/log/next`:

| File | Import Line |
|---|---|
| `api/app/src/lib/jobs.ts` | 20 |
| `api/app/src/lib/activity.ts` | 34 |
| `api/app/src/inngest/workflow/infrastructure/record-activity.ts` | 18 |

All three use the same import:
```ts
import { log } from "@vendor/observability/log/next";
```

And call it with structured context:
```ts
log.info("Processing activity batch", { batchSize, clerkOrgId, firstEventTimestamp });
log.error("Failed to insert activity batch", { clerkOrgId, batchSize, error: ... });
log.warn("Received empty activity batch, skipping");
```

---

## The Gap: Files Using Raw `console.*`

### 1. `api/app/src/trpc.ts`

**4 console calls** — the most impactful gap since every tRPC request passes through this file.

| Line | Call | Context |
|---|---|---|
| 66 | `console.info(\`>>> tRPC Request from ${source} by ${userId} (clerk-active)\`)` | `createTRPCContext` — active org branch |
| 79 | `console.info(\`>>> tRPC Request from ${source} by ${userId} (clerk-pending)\`)` | `createTRPCContext` — pending auth branch |
| 92 | `console.info(\`>>> tRPC Request from ${source} - unauthenticated\`)` | `createTRPCContext` — no userId |
| 176 | `console.log(\`[TRPC] ${path} took ${end - start}ms to execute\`)` | `timingMiddleware` — post-execution |

The context factory logs auth type + userId as unstructured template strings. The timing middleware logs procedure path + duration as an unstructured string. Neither attaches a structured metadata object.

**Platform equivalent in `api/platform/src/trpc.ts`:**
```ts
log.info("[trpc] memory service request", { source, auth: "service", caller: verified.caller });
log.info("[trpc] procedure timing", { path, durationMs: end - start });
log.warn("[trpc] JWT verification error", { source, error: error.message });
```

### 2. `api/app/src/router/org/connections.ts`

**3 console calls** — all `console.error` in catch blocks only, no success logging.

| Line | Call | Context |
|---|---|---|
| 79 | `console.error("[tRPC connections.list] Failed to fetch integrations:", error)` | `connections.list` query catch block |
| 259 | `console.error("[tRPC connections.github.validate] GitHub installation validation failed:", error)` | `connections.github.validate` catch block |
| 428 | `console.error("[tRPC connections.github.detectConfig] Failed to detect config:", error)` | `connections.github.detectConfig` catch block |

All pass the raw `error` object as a second argument — no structured metadata, no org context attached.

### 3. `api/app/src/router/user/organization.ts`

**4 console calls** in the `organization.create` mutation only. The other two procedures (`listUserOrganizations`, `updateName`) have no logging.

| Line | Call | Context |
|---|---|---|
| 62 | `console.log("[organization.create] Creating organization", { slug, userId, authType })` | Mutation entry point |
| 78 | `console.log("[organization.create] Successfully created organization", { organizationId, slug })` | Success after Clerk API call |
| 88 | `console.error("[organization.create] Failed to create organization", { slug, userId, error, errorDetails })` | Catch block |
| 101 | `console.error("[organization.create] Clerk error details", { errors })` | Nested Clerk-error shape check |

These calls already pass a structured object as the second arg to `console.log/console.error` — the closest pattern to `log.*` in the codebase. They just need the import and method name changed.

### 4. `api/app/src/router/user/account.ts`

**1 console call** — catch block in `account.get`.

| Line | Call | Context |
|---|---|---|
| 46 | `console.error("[tRPC] Failed to fetch user profile:", error)` | `account.get` query catch block |

---

## The Gap: Files With No Logging At All

### `api/app/src/router/org/events.ts`

Single `eventsRouter.list` query. Performs a cursor-paginated `db.select()` from `orgIngestLogs` with optional filters (`source`, `search`, `receivedAfter`, `cursor`). No error handling anywhere. No `try/catch`.

### `api/app/src/router/org/jobs.ts`

Two procedures:

- `jobsRouter.list` — cursor-paginated `db.select()` from `orgWorkflowRuns`. No error handling, no logging.
- `jobsRouter.restart` — validates job ID, fetches run from DB, inspects `status` and `inngestFunctionId`. Has three `TRPCError` throws (`BAD_REQUEST`, `NOT_FOUND`) but no `try/catch` and no logging before any throw.

### `api/app/src/router/org/org-api-keys.ts`

Five procedures operating on `orgApiKeys` table:

| Procedure | Operations | Error Handling |
|---|---|---|
| `list` | `db.select()` — excludes `keyHash` column | None |
| `create` | `generateOrgApiKey()` + `hashApiKey()` + `db.insert()` + return plaintext key | `TRPCError(INTERNAL_SERVER_ERROR)` if insert empty |
| `revoke` | `db.select()` + `db.update(isActive: false)` | `TRPCError(NOT_FOUND)`, `TRPCError(BAD_REQUEST)` |
| `delete` | `db.select()` + `db.delete()` | `TRPCError(NOT_FOUND)` |
| `rotate` | Fetch old key + `generateOrgApiKey()` + `hashApiKey()` + `db.batch([revoke old, insert new])` + return plaintext key | `TRPCError(NOT_FOUND)`, `TRPCError(INTERNAL_SERVER_ERROR)` |

`create` and `rotate` are security-sensitive: they generate new key material and return it as plaintext (only time it's visible). None of these procedures log at any point.

Note: `rotate` uses `db.batch()` instead of a transaction because `neon-http` doesn't support transactions (comment at line 211).

### `api/app/src/lib/token-vault.ts`

Two functions:

- `getInstallationToken(installationId)` — fetches token from cache
- `getInstallationTokenWithRefresh(installationId)` — fetches token + triggers refresh flow

Both throw `Error` on missing token. Neither catches nor logs errors.

---

## tRPC Context — No Logger Field

The tRPC context object (`ctx`) in `@api/app` does not carry a `logger` field at any procedure level. Context carries:
```ts
{
  auth: AuthContext,  // discriminated union: clerk-active | clerk-pending | unauthenticated
  db,                 // @db/app/client Drizzle instance
  headers: Headers,   // raw request headers
}
```

This matches the `@api/platform` pattern: `log` is always a module-level singleton imported directly, not threaded through `ctx`.

---

## Reference Pattern: `@api/platform/` (Full Adoption)

`@api/platform/src` imports `@vendor/observability/log/next` across **17 files** including its own `trpc.ts`, all OAuth handlers, and all Inngest functions.

**Dependency declaration** (`api/platform/package.json:46`):
```json
"@vendor/observability": "workspace:*"
```
Same declaration exists in `api/app/package.json:57` — the dependency is already present.

**Universal import pattern:**
```ts
import { log } from "@vendor/observability/log/next";
```

**Call-site convention:**
```ts
log.info("[module/sub-path] action description", { ...structuredContext });
log.warn("[module/sub-path] recoverable condition", { key: value });
log.error("[module/sub-path] failure description", { key: value, error: error.message });
```

**`timingMiddleware` in `api/platform/src/trpc.ts:121`:**
```ts
log.info("[trpc] procedure timing", { path, durationMs: end - start });
```

---

## Code References

- `api/app/src/trpc.ts:66,79,92` — `console.info` auth branch logging in `createTRPCContext`
- `api/app/src/trpc.ts:176` — `console.log` timing in `timingMiddleware`
- `api/app/src/router/org/connections.ts:79,259,428` — `console.error` catch blocks
- `api/app/src/router/user/organization.ts:62,78,88,101` — `console.log/error` in org.create
- `api/app/src/router/user/account.ts:46` — `console.error` catch block
- `api/app/src/router/org/events.ts` — no logging, no error handling
- `api/app/src/router/org/jobs.ts` — no logging, TRPCError throws without log
- `api/app/src/router/org/org-api-keys.ts` — no logging, security-sensitive key ops
- `api/app/src/lib/token-vault.ts` — no logging
- `api/app/src/lib/jobs.ts:20` — correct `@vendor/observability` usage
- `api/app/src/lib/activity.ts:34` — correct `@vendor/observability` usage
- `api/app/src/inngest/workflow/infrastructure/record-activity.ts:18` — correct `@vendor/observability` usage
- `api/platform/src/trpc.ts:9` — reference pattern for tRPC logging
- `api/platform/src/lib/oauth/callback.ts:13` — reference pattern for lib logging
- `vendor/observability/src/log/next.ts` — logger implementation
- `vendor/observability/src/log/edge.ts` — edge runtime variant
- `vendor/observability/src/log/types.ts` — Logger interface

---

## Open Questions

- Should `router/org/events.ts` and `router/org/jobs.ts` add `try/catch` around DB calls at the same time as adding log coverage, or just add logging to the existing structure?
- Should `org-api-keys.ts` emit structured `log.info` on `create` and `rotate` success (security audit trail), or is that out of scope?
- Should `token-vault.ts` log token fetch failures, or is that already covered upstream by callers in `@api/platform`?
