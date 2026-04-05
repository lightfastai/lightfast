# tRPC Error Handling Consolidation — Implementation Plan

## Overview

Consolidate three overlapping tRPC error handling layers (Sentry `trpcMiddleware`, `observabilityMiddleware`, adapter `onError`) into a single shared middleware factory in `@vendor/observability`. Eliminate all hand-maintained error classification constants by deriving classification from tRPC's own HTTP status mapping. Add Sentry trace ID correlation to structured logs for instant cross-tool debugging.

## Current State Analysis

### The Problem

Three layers fire on the same error with overlapping concerns:

1. **`trpcMiddleware` (@sentry/core)** — captures ALL errors as `handled: false`, creates spans + scope
2. **`observabilityMiddleware`** — logs `log.warn` for failures, wraps in `AsyncLocalStorage`
3. **`onError` (adapter callback)** — classifies expected/unexpected, logs, calls `captureException` again

A `beforeSend` filter in `instrumentation.ts` already drops expected tRPC errors from Sentry, but unexpected errors still produce **duplicate Sentry events** (one from `trpcMiddleware`, one from `onError`). Failed procedures generate **triple log entries**.

The same 10-code "expected error" constant is independently defined in **4 files** under two different names (`EXPECTED_TRPC_ERRORS` / `EXPECTED_TRPC_CODES`).

### Key Discoveries

- `trpcMiddleware` has no filtering — captures everything as `handled: false` (`api/app/src/trpc.ts:125-129`)
- `onError` ctx only gets base `createContext` result, not middleware-augmented context (tRPC #6157)
- `getRawInput` is available in tRPC v11.12.0 middleware opts but not destructured (`api/app/src/trpc.ts:158`)
- `withIsolationScope`, `startSpan`, `captureException`, `getActiveSpan` are all available from `@sentry/core`
- RSC callers bypass `onError` entirely — only middleware layers cover them (`packages/app-trpc/src/server.tsx:22-26`)
- `SAFE_MESSAGE_CODES` (client-side, 6 members) is a strict subset of `EXPECTED_TRPC_ERRORS` (10 members) — they serve different purposes and should remain separate
- `beforeSend` in both `instrumentation.ts` files already filters expected tRPC errors (`apps/app/src/instrumentation.ts:30-38`)
- **`getHTTPStatusCodeFromError`** is exported from `@trpc/server/http` (v11.12.0) — maps any tRPC error code to its HTTP status code, eliminating the need for any hand-maintained constant
- **The 10-member `EXPECTED_TRPC_ERRORS` set is incomplete** — tRPC v11.12.0 defines 6 additional client-error codes not in the set: `PAYMENT_REQUIRED` (402), `METHOD_NOT_SUPPORTED` (405), `TIMEOUT` (408), `PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE` (415), `PRECONDITION_REQUIRED` (428)
- **`getActiveSpan()` from `@sentry/core`** provides the active Sentry span with `spanContext().traceId` for log↔trace correlation
- The `observabilityMiddleware` in `api/app/src/trpc.ts:158-205` and `api/platform/src/trpc.ts:113-147` are 90% identical — only auth context spreading differs
- `nanoid` is in the pnpm catalog (`^5.1.5`) and used via `@repo/lib` for custom alphanumeric IDs (`packages/lib/src/nanoid.ts:5-7`)
- `@trpc/server` is in the pnpm catalog at `^11.12.0`
- `captureException(error)` calls in `onError` are bare — no tags, no extra context, making Sentry events hard to filter or correlate

## Desired End State

```
Before (4 layers, 4 constant definitions, no correlation):
  trpcMiddleware → observabilityMiddleware → errorFormatter → onError

After (1 shared factory, 0 constants, full log↔trace correlation):
  observabilityMiddleware (via factory) → errorFormatter
```

- **Zero constants** — error classification derived from `getHTTPStatusCodeFromError` (tRPC's own mapping)
- **One factory** in `@vendor/observability/trpc` — both API packages are 3-line consumers
- **Single `captureException` call** for server errors only (HTTP >= 500) — enriched with tags and extra context
- **Sentry `traceId` in every structured log** — paste a Sentry trace ID into BetterStack search to find the full request journal instantly
- Single structured log entry per procedure — no triple logging
- Uniform coverage for HTTP and RSC callers
- `beforeSend` kept as defense-in-depth safety net (also using `getHTTPStatusCodeFromError`)
- All current AND future tRPC error codes handled correctly with zero maintenance

### Verification

- `pnpm check && pnpm typecheck` passes
- `pnpm build:app && pnpm build:platform` succeeds
- Sentry spans still appear in performance monitoring (manual verification)
- Client errors (< 500: UNAUTHORIZED, NOT_FOUND, etc.) do NOT appear in Sentry Issues
- Server errors (>= 500: INTERNAL_SERVER_ERROR) appear exactly once in Sentry Issues
- Sentry events include `trpc.path`, `trpc.type`, `trpc.error_code` tags
- Structured logs include `traceId` and `requestId` for cross-tool correlation
- Single log entry per procedure call

## What We're NOT Doing

- NOT changing `errorFormatter` — it stays minimal (sanitize INTERNAL_SERVER_ERROR, flatten ZodError)
- NOT changing client-side error handling (`showErrorToast`, `SAFE_MESSAGE_CODES`)
- NOT changing `loggerLink` configuration on the client
- NOT removing `beforeSend` filtering — it stays as defense-in-depth
- NOT changing auth middleware (`userScopedProcedure`, `orgScopedProcedure`, `serviceProcedure`, etc.)
- NOT adding a shared constant to `@repo/lib` — the constant is eliminated entirely

## Implementation Approach

Build bottom-up: shared middleware factory in `@vendor/observability` first, then swap both API packages to use it, then strip route handlers, then update `instrumentation.ts` to use the same derived classification.

---

## Phase 1: Create Middleware Factory in `@vendor/observability` [DONE]

### Overview

Create a `createObservabilityMiddleware` factory that consolidates Sentry scope/span/capture, error classification (via HTTP status derivation), trace-correlated structured logging, and request journaling into a single reusable middleware. Both API packages will consume this factory with their own auth extractors.

### Changes Required

#### 1. Add dependencies to `@vendor/observability`

**File**: `vendor/observability/package.json`
**Changes**: Add `@trpc/server` and `nanoid` to `dependencies`, add `./trpc` to `exports`

```jsonc
// In "exports", add:
"./trpc": {
  "types": "./src/trpc.ts",
  "default": "./src/trpc.ts"
}

// In "dependencies", add:
"@trpc/server": "catalog:",
"nanoid": "catalog:"
```

#### 2. Create the middleware factory

**File**: `vendor/observability/src/trpc.ts` (NEW)
**Changes**: Create the factory module

```typescript
import "server-only";

import {
  captureException,
  getActiveSpan,
  startSpan,
  withIsolationScope,
} from "@sentry/core";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import type { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { log } from "./log/next";
import { emitJournal, withRequestContext } from "./request";

type AuthFields = Record<string, unknown>;

interface CreateObservabilityMiddlewareOptions<TCtx> {
  /** Extract auth-related fields from the tRPC context for log enrichment and request context. */
  extractAuth: (ctx: TCtx) => AuthFields;
  /** Whether the server is in development mode (enables artificial latency). */
  isDev: boolean;
}

/**
 * Create a tRPC observability middleware that consolidates:
 * - Sentry isolation scope + span creation (replaces trpcMiddleware)
 * - Error classification via HTTP status derivation (no constants needed)
 * - Selective Sentry capture (server errors only, with tags)
 * - Structured logging with trace ID correlation
 * - Request journal emission
 *
 * Usage:
 * ```typescript
 * const observabilityMiddleware = t.middleware(
 *   createObservabilityMiddleware({
 *     isDev: t._config.isDev,
 *     extractAuth: (ctx) => ({
 *       ...(ctx.auth.type === "clerk-active" && { userId: ctx.auth.userId, orgId: ctx.auth.orgId }),
 *     }),
 *   }),
 * );
 * ```
 */
export function createObservabilityMiddleware<TCtx>(
  opts: CreateObservabilityMiddlewareOptions<TCtx>,
) {
  return async ({
    next,
    path,
    ctx,
    type,
    getRawInput,
  }: {
    next: () => Promise<{ ok: true } | { ok: false; error: TRPCError }>;
    path: string;
    ctx: TCtx;
    type: string;
    getRawInput: () => Promise<unknown>;
  }) => {
    if (opts.isDev) {
      const waitMs = Math.floor(Math.random() * 400) + 100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    const authFields = opts.extractAuth(ctx);

    return withIsolationScope(async (scope) => {
      // Attach tRPC context to Sentry scope (replaces trpcMiddleware)
      const trpcContext: Record<string, unknown> = {
        procedure_path: path,
        procedure_type: type,
      };

      try {
        const rawInput = await getRawInput();
        if (rawInput !== undefined) {
          trpcContext.input = rawInput;
        }
      } catch {
        // getRawInput can throw if input parsing failed — safe to ignore
      }

      scope.setContext("trpc", trpcContext);

      return startSpan(
        { name: `trpc/${path}`, op: "rpc.server" },
        async () => {
          // Get Sentry trace ID for log↔trace correlation
          const span = getActiveSpan();
          const traceId = span?.spanContext().traceId;

          const requestId = nanoid();
          const { result, journal, durationMs } = await withRequestContext(
            { requestId, ...(traceId && { traceId }), ...authFields },
            () => next(),
          );

          const meta = {
            path,
            type,
            durationMs,
            ok: result.ok,
            requestId,
            ...(traceId && { traceId }),
            ...(!result.ok && { errorCode: result.error.code }),
            ...authFields,
          };

          if (result.ok) {
            log.info("[trpc] ok", meta);
          } else {
            const httpStatus = getHTTPStatusCodeFromError(result.error);

            if (httpStatus >= 500) {
              log.error("[trpc] server error", meta);
              captureException(result.error, {
                tags: {
                  "trpc.path": path,
                  "trpc.type": type,
                  "trpc.error_code": result.error.code,
                },
                extra: { durationMs, requestId },
              });
            } else {
              log.info("[trpc] client error", meta);
            }
          }

          emitJournal(journal, { path, durationMs, ok: result.ok });

          return result;
        },
      );
    });
  };
}
```

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes
- [x] `createObservabilityMiddleware` is importable as `import { createObservabilityMiddleware } from "@vendor/observability/trpc"`

---

## Phase 2: Rework `observabilityMiddleware` in `@api/app` [DONE]

### Overview

Remove `trpcMiddleware`, `sentryMiddleware`, and `sentrifiedProcedure`. Replace the inline `observabilityMiddleware` with a 3-line consumer of the shared factory.

### Changes Required

#### 1. Update imports

**File**: `api/app/src/trpc.ts`
**Changes**: Remove `trpcMiddleware`, remove `nanoid`, add factory import

```typescript
// Remove:
import { nanoid } from "@repo/lib";
import { trpcMiddleware } from "@sentry/core";
import { emitJournal, withRequestContext } from "@vendor/observability/request";

// Add:
import { createObservabilityMiddleware } from "@vendor/observability/trpc";
```

Note: `log` import from `@vendor/observability/log/next` can also be removed — no longer used directly in this file.

#### 2. Remove `sentryMiddleware` and `sentrifiedProcedure`

**File**: `api/app/src/trpc.ts`
**Changes**: Delete lines 125-131:

```typescript
// DELETE entirely:
const sentryMiddleware = t.middleware(
  trpcMiddleware({
    attachRpcInput: true,
  })
);

const sentrifiedProcedure = t.procedure.use(sentryMiddleware);
```

#### 3. Replace `observabilityMiddleware`

**File**: `api/app/src/trpc.ts`
**Changes**: Replace lines 158-205 (the existing `observabilityMiddleware`) with:

```typescript
const observabilityMiddleware = t.middleware(
  createObservabilityMiddleware({
    isDev: t._config.isDev,
    extractAuth: (ctx) => ({
      ...(ctx.auth.type === "clerk-active" && {
        userId: ctx.auth.userId,
        orgId: ctx.auth.orgId,
      }),
      ...(ctx.auth.type === "clerk-pending" && {
        userId: ctx.auth.userId,
      }),
    }),
  }),
);
```

#### 4. Update procedure exports

**File**: `api/app/src/trpc.ts`
**Changes**: Change base from `sentrifiedProcedure` to `t.procedure` for all three procedure exports:

```typescript
// publicProcedure (line 214):
export const publicProcedure = t.procedure.use(observabilityMiddleware);

// userScopedProcedure (line 232):
export const userScopedProcedure = t.procedure
  .use(observabilityMiddleware)
  .use(({ ctx, next }) => {
    // ... auth guard unchanged ...
  });

// orgScopedProcedure (line 280):
export const orgScopedProcedure = t.procedure
  .use(observabilityMiddleware)
  .use(({ ctx, next }) => {
    // ... auth guard unchanged ...
  });
```

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes
- [x] `pnpm --filter @api/app build` succeeds

---

## Phase 3: Rework `observabilityMiddleware` in `@api/platform` [DONE]

### Overview

Same rework as Phase 2 but for the platform API package, with platform-specific auth extraction.

### Changes Required

#### 1. Update imports

**File**: `api/platform/src/trpc.ts`
**Changes**: Same import swap:

```typescript
// Remove:
import { nanoid } from "@repo/lib";
import { trpcMiddleware } from "@sentry/core";
import { emitJournal, withRequestContext } from "@vendor/observability/request";

// Add:
import { createObservabilityMiddleware } from "@vendor/observability/trpc";
```

Note: `log` import from `@vendor/observability/log/next` stays — it's still used in `createPlatformTRPCContext` (lines 50, 63, 71).

#### 2. Remove `sentryMiddleware` and `sentrifiedProcedure`

**File**: `api/platform/src/trpc.ts`
**Changes**: Delete lines 105-111:

```typescript
// DELETE entirely:
const sentryMiddleware = t.middleware(
  trpcMiddleware({
    attachRpcInput: true,
  })
);

const sentrifiedProcedure = t.procedure.use(sentryMiddleware);
```

#### 3. Replace `observabilityMiddleware`

**File**: `api/platform/src/trpc.ts`
**Changes**: Replace lines 113-147 with:

```typescript
const observabilityMiddleware = t.middleware(
  createObservabilityMiddleware({
    isDev: t._config.isDev,
    extractAuth: (ctx) => ({
      ...(ctx.auth.type === "service" && { caller: ctx.auth.caller }),
    }),
  }),
);
```

#### 4. Update procedure exports

**File**: `api/platform/src/trpc.ts`
**Changes**: Change base from `sentrifiedProcedure` to `t.procedure`:

```typescript
// publicProcedure (line 158):
export const publicProcedure = t.procedure.use(observabilityMiddleware);

// serviceProcedure (line 166):
export const serviceProcedure = t.procedure
  .use(observabilityMiddleware)
  .use(({ ctx, next }) => {
    // ... auth guard unchanged ...
  });

// adminProcedure (line 191):
export const adminProcedure = t.procedure
  .use(observabilityMiddleware)
  .use(({ ctx, next }) => {
    // ... auth guard unchanged ...
  });
```

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes
- [x] `pnpm --filter @api/platform build` succeeds (alias `pnpm build:platform`)

---

## Phase 4: Strip `onError` from Route Handlers [DONE]

### Overview

Remove the `onError` callback, `EXPECTED_TRPC_ERRORS` set, and `captureException`/`log` imports from both route handler files. Error handling is now fully in the middleware.

### Changes Required

#### 1. Clean up app route handler

**File**: `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts`
**Changes**:
- Remove `import { captureException } from "@sentry/nextjs"` (line 2)
- Remove `import { log } from "@vendor/observability/log/next"` (line 4)
- Remove `EXPECTED_TRPC_ERRORS` set (lines 14-26)
- Remove `onError` callback from `fetchRequestHandler` options (lines 63-77)

The handler becomes:

```typescript
import { appRouter, createTRPCContext } from "@api/app";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { env } from "~/env";
import { wwwUrl } from "~/lib/related-projects";

export const runtime = "nodejs";

// CORS setup unchanged (allowedOrigins, setCorsHeaders, OPTIONS)...

const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext: () => createTRPCContext({ headers: req.headers }),
  });

  return setCorsHeaders(req, response);
};

export { handler as GET, handler as POST };
```

#### 2. Clean up platform route handler

**File**: `apps/platform/src/app/api/trpc/[trpc]/route.ts`
**Changes**: Same cleanup — remove `captureException` (line 2), `log` (line 4), `EXPECTED_TRPC_ERRORS` (lines 11-22), `onError` (lines 57-71).

```typescript
import { createPlatformTRPCContext, platformRouter } from "@api/platform";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { appUrl } from "~/lib/related-projects";

export const runtime = "nodejs";

// CORS setup unchanged (setCorsHeaders, OPTIONS)...

const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: platformRouter,
    req,
    createContext: () =>
      createPlatformTRPCContext({
        headers: req.headers,
      }),
  });

  return setCorsHeaders(req, response);
};

export { handler as GET, handler as POST };
```

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:platform` succeeds

---

## Phase 5: Update `instrumentation.ts` to Use HTTP Status Derivation [DONE]

### Overview

Replace locally defined `EXPECTED_TRPC_CODES` in both instrumentation files with `getHTTPStatusCodeFromError` from `@trpc/server/http`. This uses the same derived classification as the middleware — no constant, no maintenance, automatically covers all tRPC error codes.

### Changes Required

#### 1. App instrumentation

**File**: `apps/app/src/instrumentation.ts`
**Changes**:
- Add `import { getHTTPStatusCodeFromError } from "@trpc/server/http"`
- Remove local `EXPECTED_TRPC_CODES` set (lines 12-23)
- Update `beforeSend` to use HTTP status derivation:

```typescript
const beforeSend: NonNullable<Parameters<typeof init>[0]["beforeSend"]> = (
  event,
  hint
) => {
  const err = hint?.originalException;
  if (
    err instanceof TRPCError &&
    getHTTPStatusCodeFromError(err) < 500
  ) {
    return null;
  }
  return event;
};
```

#### 2. Platform instrumentation

**File**: `apps/platform/src/instrumentation.ts`
**Changes**: Same as above — add `getHTTPStatusCodeFromError` import, remove `EXPECTED_TRPC_CODES`, update `beforeSend`.

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes
- [x] `pnpm build:app && pnpm build:platform` succeeds

---

## Phase 6: Full Build Verification [DONE]

### Overview

Run the complete verification suite to ensure nothing is broken.

### Success Criteria

#### Automated Verification

- [x] `pnpm check` passes (biome lint + format) — 1 pre-existing error in `packages/app-pinecone` unrelated to this change
- [x] `pnpm typecheck` passes (54/54 tasks)
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:platform` succeeds

#### Manual Verification

- [ ] In development (`pnpm dev:app`): trigger an UNAUTHORIZED error (sign out) — verify single `log.info("[trpc] client error", ...)` entry in console, no Sentry event
- [ ] In development: trigger an INTERNAL_SERVER_ERROR (e.g., throw in a procedure) — verify single Sentry event with `trpc.path` tag, single `log.error("[trpc] server error", ...)` entry
- [ ] Verify structured logs include `traceId` and `requestId` fields
- [ ] Sentry performance dashboard shows `trpc/<path>` spans still appearing
- [ ] No duplicate Sentry issues for the same error
- [ ] In Sentry, filter issues by `trpc.path` tag — verify tags appear on captured events

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests

No new unit tests needed — this is a middleware consolidation. Existing procedure tests validate behavior unchanged.

### Manual Testing Steps

1. Start dev server: `pnpm dev:app`
2. Trigger client errors: sign out and hit an authenticated route → should see single `log.info("[trpc] client error", ...)` with `requestId` and `traceId` in console, no Sentry event
3. Trigger server error: temporarily throw `new Error("test")` in a procedure → should see single `log.error("[trpc] server error", ...)` + exactly one Sentry event with `trpc.path`, `trpc.type`, `trpc.error_code` tags
4. Check Sentry Performance: verify `trpc/<path>` spans still appear correctly
5. Check BetterStack (staging): verify `traceId` appears in structured log entries, and that searching by `traceId` returns the full request journal

## Performance Considerations

- `withIsolationScope` + `startSpan` are the same calls `trpcMiddleware` made — no additional overhead
- `getRawInput()` is async but only called once (previously called by `trpcMiddleware` and available to middleware)
- `getHTTPStatusCodeFromError` is a single object lookup — O(1), negligible
- `getActiveSpan()` is a synchronous read from Sentry's internal state — negligible
- Removing one middleware layer (`sentryMiddleware`) from the chain slightly reduces overhead
- One factory function shared by both API packages — no code duplication, single place to optimize

## Design Decisions

### Why derive from HTTP status instead of maintaining a constant?

tRPC v11.12.0's `JSONRPC2_TO_HTTP_CODE` map defines 20 error codes. The hand-maintained `EXPECTED_TRPC_ERRORS` set only covered 10 of them, missing 6 valid client-error codes (`PAYMENT_REQUIRED`, `METHOD_NOT_SUPPORTED`, `TIMEOUT`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `PRECONDITION_REQUIRED`). Using `getHTTPStatusCodeFromError(error) >= 500` covers all codes correctly and automatically handles future additions. Zero maintenance.

### Why a factory in `@vendor/observability` instead of inline middleware?

The observability middleware in `api/app/src/trpc.ts` (lines 158-205) and `api/platform/src/trpc.ts` (lines 113-147) are 90% identical. The only difference is auth context extraction. A factory with an `extractAuth` option eliminates this duplication — both consumers become 3-line wrappers. Future changes to logging, Sentry integration, or journal emission happen in one place.

### Why `nanoid` instead of `crypto.randomUUID()`?

The existing codebase uses `nanoid` with a custom alphanumeric alphabet for request IDs. Using the same library in the factory maintains format consistency across all request IDs in logs. `nanoid` is already in the pnpm catalog (`^5.1.5`).

### Why `traceId` in structured logs?

When a Sentry alert fires, the developer currently sees a stack trace but must grep BetterStack logs by timestamp and procedure path to find context. With `traceId` in every structured log entry (automatically propagated via `withRequestContext` → `getContext()`), the developer pastes the Sentry trace ID into BetterStack search and gets the full request journal — every log line from that procedure call — instantly.

## References

- Research: `thoughts/shared/research/2026-04-05-trpc-error-handling-propagation.md`
- tRPC error handling docs: `trpc.io/docs/server/error-handling`
- tRPC `getHTTPStatusCodeFromError`: `@trpc/server/http` (v11.12.0)
- tRPC HTTP status mapping: `@trpc/server/dist/getErrorShape-vC8mUXJD.mjs:83-105`
- Sentry `getActiveSpan`: `@sentry/core` (v10.42.0)
- Sentry trpcMiddleware source: `getsentry/sentry-javascript/packages/core/src/trpc.ts`
- Sentry discussion on noise: `getsentry/sentry-javascript#10748`
- tRPC onError ctx limitation: `trpc/trpc#6157`
