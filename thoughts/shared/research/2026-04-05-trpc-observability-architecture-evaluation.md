---
date: 2026-04-05T23:45:00+08:00
researcher: claude
git_commit: e400ef63a4a0ad34715bed54993ecabec5f14eae
branch: main
topic: "tRPC observability + error handling architecture — evaluation for 100x developer maintainability"
tags: [research, trpc, error-handling, sentry, observability, architecture, evaluation]
status: complete
last_updated: 2026-04-05
---

# Research: tRPC Observability + Error Handling Architecture Evaluation

**Date**: 2026-04-05T23:45:00+08:00
**Git Commit**: e400ef63a4a0ad34715bed54993ecabec5f14eae
**Branch**: main

## Research Question

Evaluate the in-progress observability + error handling architecture for tRPC across both services (`@api/app`, `@api/platform`). Determine what's truly 100x for long-term developer maintainability — how we debug, fix, and iterate fast on tRPC errors in production.

Scope: tRPC-related only (not inngest/webhooks).

## Summary

The current diff consolidates three overlapping error handling layers (Sentry `trpcMiddleware`, inline `observabilityMiddleware`, adapter `onError`) into a single `createObservabilityMiddleware` factory. This is directionally correct and solves the previous duplicate-capture and triple-logging problems. However, the architecture has **three significant gaps** that will hurt debugging velocity in production:

1. **Client-side Sentry noise**: Every 4xx tRPC response creates client-side Sentry events (via `httpClientIntegration` + `captureConsoleIntegration`) with no filtering — the server-side cleanup doesn't help here
2. **Lost original error in Sentry for 500s**: When tRPC wraps a raw `Error` in `TRPCError(INTERNAL_SERVER_ERROR)`, the middleware sends the wrapper to Sentry, hiding the actual error message and stack trace in `.cause`
3. **`parseError` utility is a footgun**: `vendor/observability/src/error/next.ts` always calls `captureException` for any error, with no classification — any code path using it for a TRPCError sends noise to Sentry

---

## The Architecture As It Exists (Working Tree State)

### Error Flow: Server → Sentry → Logs → Client

```
Procedure throws (TRPCError or raw Error)
        ↓
    tRPC internals: raw Error → TRPCError(INTERNAL_SERVER_ERROR, { cause: originalError })
        ↓
┌───────────────────────────────────────────────────────────────────────┐
│ createObservabilityMiddleware (vendor/observability/src/trpc.ts)     │
│                                                                       │
│  1. Sentry isolation scope (withIsolationScope)                      │
│  2. Attach trpc context: { procedure_path, procedure_type, input }   │
│  3. Sentry span: trpc/<path>, op: rpc.server                        │
│  4. AsyncLocalStorage request context (requestId + traceId + auth)   │
│  5. Execute procedure                                                │
│  6. Classification: getHTTPStatusCodeFromError(error)                │
│     ├─ >= 500: log.error + captureException (with tags/extras)       │
│     └─ < 500:  log.info("[trpc] client error")                      │
│  7. Emit request journal                                             │
└───────────────────────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────────────────────┐
│ errorFormatter (initTRPC.create)                                     │
│  - INTERNAL_SERVER_ERROR in production → "An unexpected error occurred" │
│  - ZodError → flattened shape                                        │
│  - All other codes → message passed through                          │
└───────────────────────────────────────────────────────────────────────┘
        ↓
    fetchRequestHandler serializes response → HTTP to client
        ↓
┌───────────────────────────────────────────────────────────────────────┐
│ beforeSend in instrumentation.ts (SAFETY NET)                        │
│  - TRPCError + HTTP status < 500 → DROP from Sentry                 │
│  - Everything else → forward to Sentry                               │
└───────────────────────────────────────────────────────────────────────┘


CLIENT SIDE:
        ↓
    loggerLink → console.error for all downstream errors
        ↓
    httpClientIntegration [400-599] → Sentry event for ALL HTTP errors  ← PROBLEM
    captureConsoleIntegration → Sentry event from console.error         ← PROBLEM
        ↓
    React Query onError → showErrorToast (SAFE_MESSAGE_CODES filter)
    OR: Error boundary catches → renders fallback UI
```

### Files Changed in Working Tree

| File | What Changed |
|---|---|
| `vendor/observability/src/trpc.ts` | **NEW** — `createObservabilityMiddleware` factory |
| `vendor/observability/package.json` | Added `@trpc/server`, `@repo/lib` deps + `./trpc` export |
| `api/app/src/trpc.ts` | Removed `trpcMiddleware`, `sentrifiedProcedure`; replaced inline observability with factory |
| `api/platform/src/trpc.ts` | Same as above for platform |
| `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts` | Removed `onError`, `EXPECTED_TRPC_ERRORS`, Sentry/log imports |
| `apps/platform/src/app/(trpc)/api/trpc/[trpc]/route.ts` | Same as above for platform |
| `apps/app/src/instrumentation.ts` | Replaced `EXPECTED_TRPC_CODES` set with `getHTTPStatusCodeFromError` |
| `apps/platform/src/instrumentation.ts` | Same as above for platform |

### What Was Removed

- `@sentry/core` `trpcMiddleware` — was capturing ALL errors with no filtering, causing noise
- `onError` callback on `fetchRequestHandler` — was duplicating Sentry captures + logging; doesn't fire for RSC callers
- `EXPECTED_TRPC_ERRORS` / `EXPECTED_TRPC_CODES` constant sets — 4 definitions across 4 files, incomplete (missed 6 tRPC error codes)
- `sentryMiddleware` / `sentrifiedProcedure` in both API packages

---

## Evaluation: What's Working

### 1. Single middleware ownership is correct

The consolidation into `createObservabilityMiddleware` eliminates the previous triple-logging and duplicate-capture problems. Before: `trpcMiddleware` → `observabilityMiddleware` → `onError` all independently handled errors. Now: one middleware owns classification, logging, Sentry capture, and journaling.

This also solves the RSC coverage gap — `onError` only fires for HTTP requests, but the middleware fires for both HTTP and RSC callers (via `createCallerFactory` / `createTRPCOptionsProxy`).

### 2. `getHTTPStatusCodeFromError` over constants is correct

The previous `EXPECTED_TRPC_ERRORS` set covered 10 of 20 tRPC error codes, missing `PAYMENT_REQUIRED` (402), `METHOD_NOT_SUPPORTED` (405), `TIMEOUT` (408), `PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE` (415), `PRECONDITION_REQUIRED` (428). Using `getHTTPStatusCodeFromError(error) < 500` covers all codes and auto-handles future additions. Zero maintenance.

### 3. `beforeSend` as defense-in-depth is correct

The middleware already filters 500+ for Sentry, but `beforeSend` catches any TRPCError < 500 that leaks through other paths (e.g., `captureRequestError` from Next.js instrumentation, or if another code path calls `captureException` with a TRPCError). Same `getHTTPStatusCodeFromError` derivation — no constant to maintain.

### 4. traceId→log correlation is the crown jewel

```typescript
const span = getActiveSpan();
const traceId = span?.spanContext().traceId;
// ...
const { result, journal, durationMs } = await withRequestContext(
  { requestId, ...(traceId && { traceId }), ...authFields },
  () => next()
);
```

Every structured log entry from within the procedure (via `getContext()` enrichment in `log/next.ts`) automatically carries the Sentry `traceId`. When a Sentry alert fires:

1. Open Sentry → see error with `trpc.path`, `trpc.error_code`, `requestId` tags
2. Copy `traceId` from Sentry
3. Paste into BetterStack search → get the full request journal instantly

This collapses a 20-minute debugging session into 30 seconds. This is the most valuable part of the architecture.

### 5. Sentry span creation replaces trpcMiddleware properly

The middleware creates spans with the same attributes the removed Sentry `trpcMiddleware` used:

```typescript
startSpan({
  name: `trpc/${path}`,
  op: "rpc.server",
  attributes: {
    [SEMANTIC_ATTRIBUTE_SENTRY_SOURCE]: "route",
    [SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: "auto.rpc.trpc",
  },
}, ...)
```

Sentry Performance monitoring continues to show `trpc/<path>` spans. The tRPC context (`procedure_path`, `procedure_type`, `input`) is attached to the scope.

---

## Evaluation: What Needs Attention

### Gap 1: Client-Side Sentry Noise (Critical)

**File**: `apps/app/src/instrumentation-client.ts:38-40`

```typescript
httpClientIntegration({
  failedRequestStatusCodes: [[400, 599]],
}),
```

This captures ALL HTTP responses with status 400-599 as Sentry events. Every `UNAUTHORIZED`, `NOT_FOUND`, `BAD_REQUEST` tRPC response creates a client-side Sentry error. Combined with `captureConsoleIntegration` (which captures `console.error` from `loggerLink` on error responses), every single tRPC 4xx creates **two** client-side Sentry events.

The server-side architecture is now clean — only 500+ reaches Sentry. But the client is wide open.

**Impact**: In production with real users, this will generate hundreds of UNAUTHORIZED events (e.g., expired sessions, users navigating while logged out) and NOT_FOUND events that are all expected domain conditions. The Sentry Issues dashboard becomes unusable.

**Two options**:

**Option A — Narrow `httpClientIntegration` to 500+:**
```typescript
httpClientIntegration({
  failedRequestStatusCodes: [[500, 599]],
}),
```
Simple, but loses visibility into genuine client-side HTTP failures from non-tRPC endpoints.

**Option B — Add client-side `beforeSend` filtering:**
```typescript
beforeSend(event, hint) {
  // Drop tRPC client errors (4xx) — these are expected domain conditions
  const err = hint?.originalException;
  if (err && typeof err === 'object' && 'name' in err && err.name === 'TRPCClientError') {
    // TRPCClientError has a .data.httpStatus field
    const httpStatus = (err as any).data?.httpStatus;
    if (typeof httpStatus === 'number' && httpStatus < 500) {
      return null;
    }
  }
  return event;
},
```
More surgical — keeps non-tRPC HTTP error capture intact while filtering tRPC 4xx.

**Recommendation**: Option B. The server owns tRPC error observability; the client should not duplicate it. But `httpClientIntegration` should continue capturing non-tRPC HTTP errors (e.g., failed API calls to third-party services loaded by the frontend).

### Gap 2: Lost Original Error for INTERNAL_SERVER_ERROR (High Impact)

**File**: `vendor/observability/src/trpc.ts:125-130`

When a procedure throws a raw `Error("DB connection refused at 10.0.0.1:5432")`, tRPC wraps it:

```
TRPCError {
  code: "INTERNAL_SERVER_ERROR",
  message: "An error occurred in the tRPC handler.",  // generic
  cause: Error("DB connection refused at 10.0.0.1:5432")  // the real error
}
```

The middleware sends the `TRPCError` wrapper to Sentry:

```typescript
captureException(result.error, { ... });
```

Sentry receives "An error occurred in the tRPC handler." as the primary message. The actual error (`DB connection refused at 10.0.0.1:5432`) is buried in the `.cause` chain. Sentry does walk `.cause` for grouping, but the issue title, search results, and alert messages all show the generic wrapper message.

**Impact**: When debugging a 500 in Sentry, the developer sees "An error occurred in the tRPC handler." as the issue title for EVERY `INTERNAL_SERVER_ERROR` — they all look the same. They have to click into each one and find the `.cause` to see the actual error.

**Fix**: For `INTERNAL_SERVER_ERROR`, send the `.cause` (the original error) to Sentry instead of the wrapper:

```typescript
if (httpStatus >= 500) {
  log.error("[trpc] server error", meta);
  scope.setTag("trpc.path", path);
  scope.setTag("trpc.type", type);
  scope.setTag("trpc.error_code", result.error.code);
  scope.setExtra("durationMs", durationMs);
  scope.setExtra("requestId", requestId);

  // Send the original error for better Sentry grouping and titles.
  // TRPCError wraps raw Errors with a generic message; the cause has the real info.
  const reportedError =
    result.error.code === "INTERNAL_SERVER_ERROR" && result.error.cause instanceof Error
      ? result.error.cause
      : result.error;

  captureException(reportedError, {
    mechanism: { handled: false, type: "auto.rpc.trpc.middleware" },
  });
}
```

Now Sentry shows "DB connection refused at 10.0.0.1:5432" as the issue title, with proper stack traces pointing to the actual failure location. The tRPC context is still on the scope via `setTag`/`setExtra`.

### Gap 3: `parseError` Utility Is a Footgun

**File**: `vendor/observability/src/error/next.ts:6-30`

```typescript
export const parseError = (error: unknown): string => {
  // ...extract message...
  try {
    Sentry.captureException(error);   // ← Always captures, no classification
    log.error(`Parsing error: ${message}`);
  } catch (newError) {
    console.error("Error parsing error:", newError);
  }
  return message;
};
```

This utility calls `captureException` for ANY error with no classification. If any code path passes a TRPCError through `parseError`, it bypasses all the careful filtering in the middleware and `beforeSend`. The `beforeSend` filter will catch TRPCError < 500, but the fact that this utility exists as a "parse error + always report" function is an anti-pattern.

**Impact**: Low currently (not used in tRPC paths), but this is a trap for future developers who might reach for it.

**Fix**: Either (a) remove the `captureException` call from `parseError` (it should just parse, not report), or (b) rename it to `parseAndReportError` to make the side-effect obvious and document that it should not be used for expected errors.

---

## Evaluation: Design Decisions Worth Validating

### Decision: `mechanism: { handled: false }` for 500 Errors

```typescript
captureException(result.error, {
  mechanism: { handled: false, type: "auto.rpc.trpc.middleware" },
});
```

`handled: false` tells Sentry this is an unhandled exception, which affects how it appears in the dashboard (marked red, higher priority). For genuine 500 errors, this is semantically correct — they represent bugs that need fixing. The middleware "catches" the error to report it, but the error was not handled in the business logic sense.

**Verdict**: Correct. Keep `handled: false` for 500s.

### Decision: Dev Latency Simulation in the Observability Middleware

```typescript
if (opts.isDev) {
  const waitMs = Math.floor(Math.random() * 400) + 100;
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}
```

This lives in the observability middleware but is not an observability concern — it's a development UX concern (simulating network latency to catch waterfalls). Coupling it here means every procedure pays the latency even if you're iterating on a hot path and want fast feedback.

**Consideration**: This doesn't hurt production and it's a minor dev convenience issue. Not worth refactoring now, but worth noting that it's a separate concern from observability.

### Decision: Single Log Entry Per Procedure

The middleware emits exactly one log per procedure:
- `[trpc] ok` for success
- `[trpc] client error` for 4xx
- `[trpc] server error` for 5xx

Plus one `[trpc] request journal` entry if the journal is non-empty.

This is correct. The previous architecture produced 3 log entries per failure. One entry with all context is far more debuggable.

### Decision: Request Journal as a Separate Emission

The journal accumulates intermediate log entries and emits them as a single structured log at the end. This is powerful for BetterStack — one query returns the full request context. But it means intermediate log entries are also emitted individually (via `pushJournal` + `baseLog[level]` in `log/next.ts`), so they appear twice: once immediately, once in the journal.

**Consideration**: This is an intentional tradeoff — individual log entries are useful for real-time `tail -f` debugging, while the journal is useful for after-the-fact investigation. The duplication is acceptable.

### Decision: `SAFE_MESSAGE_CODES` (Client) vs `getHTTPStatusCodeFromError` (Server)

These serve different purposes:
- `SAFE_MESSAGE_CODES` on the client determines which server messages are safe to show to USERS in toast notifications
- `getHTTPStatusCodeFromError` on the server determines which errors are BUGS vs expected conditions

They should remain separate. A `FORBIDDEN` is safe to show to the user ("Access denied to this organization") but it's not a bug. A `TOO_MANY_REQUESTS` is safe to show but not a bug. These are both < 500 and correctly filtered on the server, AND safe to display on the client.

---

## The 100x Debugging Workflow

With the current architecture (after fixing the three gaps), here's the ideal debugging workflow:

### Scenario: User reports "something went wrong"

1. **Sentry alert fires** → Issue title: "DB connection refused at 10.0.0.1:5432" (not the generic wrapper)
   - Tags: `trpc.path: user.getProfile`, `trpc.error_code: INTERNAL_SERVER_ERROR`
   - Extra: `requestId: abc123`, `durationMs: 245`
   - Span: `trpc/user.getProfile` shows in the trace waterfall

2. **Copy traceId** from Sentry → paste into BetterStack search
   - Returns the full request journal: every log entry from that request
   - See auth context (userId, orgId), intermediate operations, timing

3. **Fix the bug** → the structured logs tell you exactly what happened, in order, with full context

### Scenario: "Why is this procedure slow?"

1. **Sentry Performance** → `trpc/user.getProfile` spans show p50/p95/p99 durations
2. **Click a slow span** → see `durationMs` in extras
3. **Copy traceId** → BetterStack journal shows all intermediate operations with timing

### Scenario: "Are we getting a lot of 401s from a specific endpoint?"

1. **BetterStack** → search for `"[trpc] client error" AND path:user.getProfile AND errorCode:UNAUTHORIZED`
2. See the pattern: specific userId, specific time range
3. NOT in Sentry (correctly filtered) — doesn't pollute the bug tracker

---

## Architecture Summary

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          SERVER SIDE                                         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ createObservabilityMiddleware (vendor/observability/src/trpc.ts)       │  │
│  │                                                                        │  │
│  │  Owns: Sentry spans, error classification, Sentry capture (500+),     │  │
│  │        structured logging, traceId correlation, request journal        │  │
│  │                                                                        │  │
│  │  < 500: log.info only (no Sentry)                                     │  │
│  │  >= 500: log.error + captureException(cause, { tags, extras })        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ errorFormatter (initTRPC.create)                                       │  │
│  │                                                                        │  │
│  │  Owns: wire-format sanitization only                                  │  │
│  │  INTERNAL_SERVER_ERROR → "An unexpected error occurred"               │  │
│  │  ZodError → flattened shape                                           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ beforeSend in instrumentation.ts (SAFETY NET)                         │  │
│  │                                                                        │  │
│  │  Drops: TRPCError with HTTP status < 500                              │  │
│  │  Purpose: catch leaks from other Sentry integration points            │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Route handlers: CORS only, no error handling                                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT SIDE                                         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Sentry Client (instrumentation-client.ts)                              │  │
│  │                                                                        │  │
│  │  httpClientIntegration: [400-599] → Sentry events                     │  │
│  │  captureConsoleIntegration: console.error → Sentry events             │  │
│  │  beforeSend: NEEDS filter for TRPCClientError < 500                   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ showErrorToast (apps/app/src/lib/trpc-errors.ts)                      │  │
│  │                                                                        │  │
│  │  SAFE_MESSAGE_CODES: show server message for expected codes           │  │
│  │  INTERNAL_SERVER_ERROR: show generic fallback                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Error boundaries: catch render-phase errors, console.error only             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Code References

### Server-Side

- `vendor/observability/src/trpc.ts` — The consolidated middleware factory (NEW)
- `vendor/observability/src/context.ts` — AsyncLocalStorage request context + journal
- `vendor/observability/src/request.ts` — `withRequestContext` + `emitJournal`
- `vendor/observability/src/log/next.ts` — Structured logger with automatic context enrichment
- `vendor/observability/src/error/next.ts` — `parseError` utility (footgun, always calls `captureException`)
- `api/app/src/trpc.ts:145-163` — App observability middleware (factory consumer)
- `api/app/src/trpc.ts:104-122` — App `errorFormatter` (message sanitization)
- `api/platform/src/trpc.ts:102-112` — Platform observability middleware (factory consumer)
- `api/platform/src/trpc.ts:88-100` — Platform `errorFormatter`
- `apps/app/src/instrumentation.ts:18-27` — Server-side `beforeSend` filter
- `apps/platform/src/instrumentation.ts:18-27` — Platform `beforeSend` filter
- `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts` — App route handler (now clean)
- `apps/platform/src/app/(trpc)/api/trpc/[trpc]/route.ts` — Platform route handler (now clean)

### Client-Side

- `apps/app/src/instrumentation-client.ts:38-40` — `httpClientIntegration` with [400-599] range
- `apps/app/src/instrumentation-client.ts:41-43` — `captureConsoleIntegration`
- `apps/app/src/lib/trpc-errors.ts` — `showErrorToast` + `SAFE_MESSAGE_CODES`
- `packages/app-trpc/src/react.tsx:59-63` — `loggerLink` (logs errors to console)
- `packages/app-trpc/src/react.tsx:65-78` — `httpBatchStreamLink` (no error interceptor)
- `apps/app/src/components/errors/page-error-boundary.tsx` — Generic error boundary (console.error only)
- `apps/app/src/components/errors/org-page-error-boundary.tsx` — Org-scoped error boundary (string-matching)

### Vendor Observability Package

```
vendor/observability/src/
├── context.ts        — AsyncLocalStorage store, RequestContext, JournalEntry
├── request.ts        — withRequestContext(), emitJournal()
├── trpc.ts           — createObservabilityMiddleware() (NEW)
├── sentry.ts         — Re-exports from @sentry/core for Hono services
├── error/next.ts     — parseError() utility (always captures, footgun)
├── log/next.ts       — Enriched structured logger
├── log/types.ts      — Logger type definitions
├── env/sentry-env.ts — Sentry environment variables
└── env/betterstack.ts — BetterStack environment variables
```

## Historical Context (from thoughts/)

The following prior research documents informed this evaluation:

- `thoughts/shared/research/2026-04-05-trpc-error-handling-propagation.md` — Documented the triple-logging problem, duplicate Sentry captures, and RSC coverage gap that led to the consolidation
- `thoughts/shared/plans/2026-04-05-trpc-error-handling-consolidation.md` — Implementation plan for the consolidation (Phases 1-6, all marked DONE)
- `thoughts/shared/plans/2026-04-05-tier1-observability-primitives.md` — Broader observability plan identifying logging gaps and provider error capture

## Web Research Findings

Key findings from official sources:

1. **Sentry `trpcMiddleware` captures ALL errors with no filtering** — confirmed by source code and maintainer statements (Issues #14004, #14972). The only filtering mechanism is `beforeSend`. Source: https://github.com/getsentry/sentry-javascript/issues/14972

2. **`onError` receives only base context (not middleware-augmented)** — confirmed as intentional (wontfix) by KATT. Source: https://github.com/trpc/trpc/issues/6157

3. **tRPC does NOT sanitize `INTERNAL_SERVER_ERROR` messages automatically** — `isDev` only controls stack trace inclusion, not message content. `errorFormatter` is the intended sanitization point. Source: tRPC v11 docs

4. **`getHTTPStatusCodeFromError`** from `@trpc/server/http` is the canonical way to map tRPC error codes to HTTP status. Source: https://trpc.io/docs/server/error-handling

5. **No first-party OpenTelemetry integration in tRPC** — maintainer Nick-Lucas stated this is intentionally left to community middleware. Source: https://github.com/trpc/trpc/issues/7022

## Open Questions

1. **BetterStack structured log queries**: Can BetterStack filter by arbitrary JSON fields (e.g., `traceId`, `requestId`)? If not, the traceId→log correlation workflow needs an alternative search mechanism. (Needs verification against BetterStack docs/dashboard)

2. **Client-side `beforeSend` pattern**: The `TRPCClientError` class may not always be available as an `instanceof` check in bundled client code. Need to verify the exact shape of `hint.originalException` for tRPC client errors to ensure the filter is reliable. (Needs runtime verification)

3. **Sentry auto-instrumentation overlap**: Does `@sentry/nextjs` auto-instrument the Next.js route handler at `/api/trpc/[trpc]` independently of the middleware? If so, there could be duplicate span creation. (Needs Sentry dashboard verification)
