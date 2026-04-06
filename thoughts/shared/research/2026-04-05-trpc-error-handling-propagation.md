---
date: 2026-04-05T18:00:00+08:00
researcher: claude
git_commit: c61301f8c36f8bacf121ce06e6b8c9e7c87c4ed0
branch: main
topic: "tRPC error handling propagation — code smells, full pipeline, and rework surface"
tags: [research, trpc, error-handling, sentry, observability]
status: complete
last_updated: 2026-04-05
---

# Research: tRPC Error Handling Propagation

**Date**: 2026-04-05T18:00:00+08:00
**Git Commit**: c61301f8c36f8bacf121ce06e6b8c9e7c87c4ed0
**Branch**: main

## Research Question

Investigate the full tRPC error handling chain across both `@api/app` and `@api/platform`, identify code smells introduced in recent commits (especially around logging and `errorFormatter`), and document what `initTRPC.create()` and Sentry's `trpcMiddleware` actually provide — to inform a full rework of the error handling propagation.

## Summary

The current tRPC error handling has **three independent layers** that all fire on the same error, with overlapping concerns and duplicate Sentry captures:

1. **`trpcMiddleware` (Sentry)** — captures ALL errors (including expected domain errors like `UNAUTHORIZED`) as `handled: false` unhandled exceptions
2. **`observabilityMiddleware`** — logs `result.ok` / `result.error.code` via `log.warn` for every failed procedure
3. **`onError` (adapter callback)** — classifies errors via `EXPECTED_TRPC_ERRORS` set, logs expected as `log.info`, unexpected as `log.error` + a second `captureException`

This produces **duplicate Sentry events** for unexpected errors and **unwanted Sentry noise** for expected domain errors. The `errorFormatter` is separate from all of this and only shapes what goes over the wire.

---

## Detailed Findings

### 1. The Error Propagation Chain (Current State)

When a procedure throws:

```
Procedure throws (TRPCError or unhandled exception)
        ↓
[Layer 1] sentryMiddleware (from @sentry/core trpcMiddleware)
   — creates isolated Sentry scope + span named "trpc/<path>"
   — catch block: captureException(error, { mechanism: { handled: false } })  ← CAPTURE #1
   — also checks result.ok === false path for non-thrown errors
   — re-throws the error
        ↓
[Layer 2] observabilityMiddleware
   — wraps next() in withRequestContext (AsyncLocalStorage)
   — logs log.warn("[trpc] procedure failed", { path, type, durationMs, errorCode, ...auth })
   — emitJournal() for accumulated journal entries
   — returns result (does not re-throw)
        ↓
[Layer 3] errorFormatter (in initTRPC.create)
   — INTERNAL_SERVER_ERROR in production → message → "An unexpected error occurred"
   — ZodError causes → flattened into shape.data.zodError
   — all other codes → message passed through
        ↓
[Layer 4] onError (fetchRequestHandler adapter callback)
   — EXPECTED_TRPC_ERRORS.has(code) → log.info("[trpc] expected error")
   — !EXPECTED_TRPC_ERRORS.has(code) → log.error + captureException(error)  ← CAPTURE #2
        ↓
HTTP response to client (JSON via superjson)
        ↓
[Client] loggerLink → React Query error handler → showErrorToast
```

**For RSC callers**: Steps 3-4 (adapter onError + HTTP response) are skipped entirely — the router is called directly via `createTRPCOptionsProxy`. Sentry middleware and observability middleware still fire.

### 2. Code Smells Identified

#### Smell A: Duplicate Sentry Captures for Unexpected Errors

For any error NOT in `EXPECTED_TRPC_ERRORS` (i.e., `INTERNAL_SERVER_ERROR`, `TIMEOUT`, `METHOD_NOT_SUPPORTED`):

| Layer | Fires? | Sentry capture? | `handled` flag |
|---|---|---|---|
| `trpcMiddleware` | Yes | `captureException(e, { mechanism: { handled: false } })` | `false` (unhandled) |
| `onError` callback | Yes | `captureException(error)` | `true` (default for explicit calls) |

These produce **two separate Sentry events** with different fingerprints and handled status. Sentry does not deduplicate them.

#### Smell B: Sentry Captures ALL Expected Domain Errors

`trpcMiddleware` has no error filtering — it captures `UNAUTHORIZED`, `NOT_FOUND`, `BAD_REQUEST`, etc. as unhandled exceptions. The `EXPECTED_TRPC_ERRORS` classification in `onError` doesn't help because the Sentry middleware fires first and captures everything.

This is a known Sentry issue (Discussion #10748, Issue #14972). The official recommendation is `beforeSend` filtering, but that's a blunt instrument.

#### Smell C: Triple Logging for Failed Procedures

A single failed procedure produces three log entries:

1. `log.warn("[trpc] procedure failed", meta)` — from `observabilityMiddleware`
2. `log.info("[trpc] expected error", { path, code })` OR `log.error("[trpc] unexpected error", ...)` — from `onError`
3. The `emitJournal()` call — from `observabilityMiddleware`

The `observabilityMiddleware` and `onError` callback both independently log failure information.

#### Smell D: Duplicated `EXPECTED_TRPC_ERRORS` Sets

Both route handler files define identical `EXPECTED_TRPC_ERRORS` sets independently — no shared import:

- `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts:14-25`
- `apps/platform/src/app/api/trpc/[trpc]/route.ts:11-22`

#### Smell E: RSC Callers Bypass onError Entirely

Server-side prefetch calls via `createTRPCOptionsProxy` skip the HTTP adapter. The `onError` callback never fires, meaning:
- No `EXPECTED_TRPC_ERRORS` classification for RSC errors
- No `captureException` from the adapter layer (though `trpcMiddleware` still captures)
- No structured `log.info`/`log.error` from the adapter layer (though `observabilityMiddleware` still logs)

### 3. `initTRPC.create()` — Full Options Reference

From tRPC v11 source (`initTRPC.ts`, `rootConfig.ts`):

| Option | Type | Default | Description |
|---|---|---|---|
| `errorFormatter` | `ErrorFormatter<TContext, TShape>` | identity | Shapes error object sent to client |
| `transformer` | `DataTransformerOptions` | no-op | Data serialization (superjson) |
| `isDev` | `boolean` | `process.env.NODE_ENV !== 'production'` | Controls stack trace inclusion |
| `isServer` | `boolean` | `typeof window === 'undefined'` | Guards browser-side use |
| `allowOutsideOfServer` | `boolean` | `false` | Suppresses server guard |
| `defaultMeta` | `TMeta` | `undefined` | Default procedure metadata |
| `sse` | SSE config object | `undefined` | Subscription streaming config |
| `jsonl` | `{ pingMs? }` | `undefined` | Batch stream ping |
| `experimental` | `{}` | `undefined` | Reserved |

**There is no `onError` at the `initTRPC` level.** `onError` is exclusively an adapter-level option.

#### `errorFormatter` Full Signature

```typescript
type ErrorFormatter = (opts: {
  error: TRPCError;                // The error instance (.code, .message, .cause)
  type: ProcedureType | 'unknown'; // 'query' | 'mutation' | 'subscription' | 'unknown'
  path: string | undefined;       // e.g. "user.changePassword"
  input: unknown;                  // Raw parsed procedure input
  ctx: TContext | undefined;       // Request context (undefined if createContext threw)
  shape: DefaultErrorShape;        // Pre-built default shape to spread
}) => TShape;
```

`DefaultErrorShape`:
```typescript
interface DefaultErrorShape {
  message: string;
  code: TRPC_ERROR_CODE_NUMBER;  // JSON-RPC numeric code
  data: {
    code: TRPC_ERROR_CODE_KEY;   // e.g. 'BAD_REQUEST'
    httpStatus: number;
    path?: string;
    stack?: string;              // only when isDev === true
  };
}
```

#### `onError` (Adapter-Level) Full Signature

```typescript
type HTTPErrorHandler = (opts: {
  error: TRPCError;
  type: ProcedureType | 'unknown';
  path: string | undefined;
  input: unknown;
  ctx: TContext | undefined;       // BASE context only — not middleware-augmented
  req: Request;                    // Web standard Request (for fetchRequestHandler)
}) => void;
```

**Key**: `ctx` in `onError` is the base `createContext` result only. Middleware-augmented context (e.g., `session`, `user`) is not available. This is confirmed by tRPC maintainer KATT as intentional (issue #6157).

#### `fetchRequestHandler` Full Options

| Option | Type | Notes |
|---|---|---|
| `router` | `TRouter` | Required |
| `req` | `Request` | Required |
| `endpoint` | `string` | Required — path prefix |
| `createContext` | `(opts) => Context` | Optional |
| `onError` | `HTTPErrorHandler` | Side-effect only, return value ignored |
| `responseMeta` | `ResponseMetaFn` | Set status code and headers on response |
| `allowBatching` | `boolean` | Default `true` |
| `maxBatchSize` | `number` | Default unlimited |

### 4. Sentry `trpcMiddleware` — Full Behavior

From `@sentry/core` source (`packages/core/src/trpc.ts`):

#### Options

```typescript
interface SentryTrpcMiddlewareOptions {
  attachRpcInput?: boolean;    // Default false — attaches normalized input to Sentry context
  forceTransaction?: boolean;  // Default false — forces span to be root transaction
}
```

#### What It Does Per Invocation

1. Creates **isolated Sentry scope** via `withIsolationScope()`
2. Sets `trpc` context on scope: `{ procedure_path, procedure_type, input? }`
3. Starts span: `name: "trpc/<path>"`, `op: "rpc.server"`
4. **Two internal `captureException` paths**:
   - **Path A (thrown errors)**: `try/catch` around `next()` → `captureException(e, { mechanism: { handled: false, type: 'auto.rpc.trpc.middleware' } })` → re-throws
   - **Path B (result errors)**: checks `result.ok === false` → `captureException(result.error, ...)` → same mechanism
5. Does NOT set breadcrumbs or tags
6. Does NOT set transaction name on scope

#### `attachRpcInput: true` Behavior

When enabled (or when `clientOptions.sendDefaultPii` is truthy):
- tRPC v11: calls `getRawInput()` async
- Normalizes to depth `1 + (normalizeDepth ?? 5)` = 6
- Sets on `scope.setContext('trpc', { ..., input: normalizedInput })`

### 5. Client-Side Error Handling

#### `TRPCReactProvider` Link Chain

`packages/app-trpc/src/react.tsx:55-80`:
1. `loggerLink` — logs in dev, logs errors in all environments
2. `httpBatchStreamLink` — sends to `/api/trpc`, no `onError` callback

No global client-level `onError`.

#### `showErrorToast` — UI Error Presentation

`apps/app/src/lib/trpc-errors.ts:86-94`:
- `SAFE_MESSAGE_CODES` set: `BAD_REQUEST`, `CONFLICT`, `FORBIDDEN`, `NOT_FOUND`, `UNAUTHORIZED`, `TOO_MANY_REQUESTS`
- If error code is safe → use server's `error.message` in toast
- Otherwise → use fallback string

### 6. Git History — How We Got Here

Three commits across 2026-03-20 to 2026-04-05:

1. **`23feb8a37`** (2026-03-20): Added `captureException` guarded by `INTERNAL_SERVER_ERROR` only, alongside existing `console.error` on all errors
2. **`fe187cf63`** (2026-04-05): Major rewrite — introduced `EXPECTED_TRPC_ERRORS` set, two-path logging, expanded `timingMiddleware` → `observabilityMiddleware`
3. **`8ff6d5afc`** (2026-04-05): Added `AsyncLocalStorage` wrapping via `withRequestContext`, moved timing inside, added journal emission

## Code References

- `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts:14-25` — EXPECTED_TRPC_ERRORS set (app)
- `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts:63-77` — onError callback (app)
- `apps/platform/src/app/api/trpc/[trpc]/route.ts:11-22` — EXPECTED_TRPC_ERRORS set (platform)
- `apps/platform/src/app/api/trpc/[trpc]/route.ts:57-71` — onError callback (platform)
- `api/app/src/trpc.ts:106-122` — errorFormatter (app)
- `api/app/src/trpc.ts:125-129` — sentryMiddleware (app)
- `api/app/src/trpc.ts:158-205` — observabilityMiddleware (app)
- `api/platform/src/trpc.ts:87-100` — errorFormatter (platform)
- `api/platform/src/trpc.ts:105-109` — sentryMiddleware (platform)
- `api/platform/src/trpc.ts:113-147` — observabilityMiddleware (platform)
- `packages/app-trpc/src/react.tsx:55-80` — client link chain
- `packages/app-trpc/src/server.tsx:22-26` — RSC caller (bypasses adapter)
- `apps/app/src/lib/trpc-errors.ts:86-94` — showErrorToast

## Architecture Documentation

### Current Error Handling Layers (in execution order)

```
┌──────────────────────────────────────────────────────────────────┐
│ Layer 1: sentryMiddleware (procedure-level)                      │
│ Scope: every procedure invocation (HTTP + RSC)                   │
│ Captures: ALL errors as handled:false (no filtering)             │
│ Also: creates span, attaches RPC input                           │
├──────────────────────────────────────────────────────────────────┤
│ Layer 2: observabilityMiddleware (procedure-level)                │
│ Scope: every procedure invocation (HTTP + RSC)                   │
│ Logs: log.warn for failures, log.info for successes              │
│ Also: AsyncLocalStorage context, journal, timing                 │
├──────────────────────────────────────────────────────────────────┤
│ Layer 3: errorFormatter (initTRPC.create)                        │
│ Scope: shapes wire-format error response                         │
│ Sanitizes: INTERNAL_SERVER_ERROR messages in production          │
│ Also: flattens ZodError causes                                   │
├──────────────────────────────────────────────────────────────────┤
│ Layer 4: onError (fetchRequestHandler adapter)                   │
│ Scope: HTTP requests only (NOT RSC)                              │
│ Classifies: expected vs unexpected via EXPECTED_TRPC_ERRORS      │
│ Logs: log.info (expected) or log.error + captureException (unexpected) │
│ Problem: captureException here duplicates Layer 1                │
└──────────────────────────────────────────────────────────────────┘
```

### Overlap Matrix

| Concern | sentryMiddleware | observabilityMiddleware | onError |
|---|---|---|---|
| Sentry capture | All errors (handled:false) | — | Unexpected only (handled:true) |
| Structured logging | — | All procedures (info/warn) | Expected (info) + unexpected (error) |
| Error classification | None | ok/fail only | EXPECTED_TRPC_ERRORS set |
| Auth context | — | userId, orgId, caller | Base ctx only (no middleware ctx) |
| RSC coverage | Yes | Yes | No |

## Open Questions

1. Should `trpcMiddleware` be configured to NOT capture expected domain errors? The official Sentry recommendation is `beforeSend` filtering, but we could also remove `trpcMiddleware` and handle Sentry capture entirely in `observabilityMiddleware` for more control.

2. Should the `onError` adapter callback be reduced to classification-only logging (no `captureException`), since `trpcMiddleware` already captures? Or should `trpcMiddleware` be removed and all Sentry capture consolidated into one place?

3. The `observabilityMiddleware` logs `log.warn` for ALL failed procedures, while `onError` also logs failures. Should one of these be the single source of truth for error logging?

4. `EXPECTED_TRPC_ERRORS` is duplicated between route handlers. Should this be a shared constant, and should the classification logic also live in a shared location?

5. The `errorFormatter` receives `ctx`, `input`, `type`, and `path` — should it be doing more than just message sanitization? Currently only `INTERNAL_SERVER_ERROR` messages are sanitized and `ZodError` causes are flattened.

6. RSC callers bypass the adapter `onError` entirely. Is the current coverage from `sentryMiddleware` + `observabilityMiddleware` sufficient for RSC error visibility?
