---
date: 2026-04-05T18:00:00+08:00
researcher: claude
git_commit: a6f3fc369adbb476a7bc83867ef6f214fd77c229
branch: main
topic: "Complete Observability Architecture — Current State After Tier 1 + ALS + tRPC Consolidation"
tags: [research, observability, sentry, logging, inngest, als, trpc, error-handling, journal]
status: complete
last_updated: 2026-04-05
---

# Research: Complete Observability Architecture — Current State

**Date**: 2026-04-05T18:00:00+08:00
**Git Commit**: a6f3fc369adbb476a7bc83867ef6f214fd77c229
**Branch**: main

## Research Question

What is the complete state of observability across the codebase after implementing Tier 1 primitives (PR #565), AsyncLocalStorage request context (PR #567), tRPC error handling consolidation (PR #573), and Sentry quality improvements (PR #574)? What gaps remain? How does `@vendor/observability/error/next.ts` (`parseError`) fit? What is the Inngest observability posture?

## Summary

The observability stack is built on three layers:

1. **`@vendor/observability`** — a vendor package providing structured logging (`log`), ALS request context (`requestStore`), a per-request journal system, a tRPC observability middleware factory (`createObservabilityMiddleware`), error parsing (`parseError`), and Sentry helpers.

2. **tRPC layer** — a single `createObservabilityMiddleware` factory replaces the former `timingMiddleware`, `trpcMiddleware` from `@sentry/core`, and per-route `onError` callbacks. It opens an ALS scope per request, logs outcomes with auth identity, classifies errors by HTTP status, captures only 5xx to Sentry (with cause unwrapping), and emits a per-request journal.

3. **Sentry boundary** — `beforeSend` filters in both server (`instrumentation.ts`) and client (`instrumentation-client.ts`) drop TRPCError/TRPCClientError with status < 500. Three layers of defense ensure 4xx noise never reaches Sentry.

Inngest functions (12 total) have structured logging but **no ALS integration** — they run outside `withRequestContext`, so `getContext()` returns `{}` and journal accumulation is skipped. This is the primary remaining observability gap.

`parseError` from `@vendor/observability/error/next` exists but has **zero import sites** across the entire codebase. Meanwhile, 30+ call sites manually use the `err instanceof Error ? err.message : String(err)` pattern.

---

## Detailed Findings

### 1. `@vendor/observability` Package

**Location**: `vendor/observability/src/` — 10 source files.

**Internal dependency chain:**
```
context.ts      (ALS store + types: RequestContext, JournalEntry, RequestStore)
    ^
log/next.ts     (calls getContext(), pushJournal() on every log call)
    ^
request.ts      (calls log, createStore, requestStore.run via withRequestContext)
    ^
trpc.ts         (calls log, withRequestContext, emitJournal, Sentry APIs)
```

#### Exports Map

| Subpath | Module | Purpose |
|---|---|---|
| `@vendor/observability` | `src/index.ts` | `Logger` type only |
| `@vendor/observability/log/next` | `src/log/next.ts` | Concrete `log` object (BetterStack in prod, console elsewhere) |
| `@vendor/observability/log/types` | `src/log/types.ts` | `Logger` interface (info/warn/error/debug) |
| `@vendor/observability/context` | `src/context.ts` | ALS store, `RequestContext`, `JournalEntry`, helpers |
| `@vendor/observability/request` | `src/request.ts` | `withRequestContext()`, `emitJournal()` |
| `@vendor/observability/trpc` | `src/trpc.ts` | `createObservabilityMiddleware()` factory |
| `@vendor/observability/error/next` | `src/error/next.ts` | `parseError()` utility |
| `@vendor/observability/sentry` | `src/sentry.ts` | Re-exports from `@sentry/core` + `initSentryService()` |
| `@vendor/observability/betterstack-env` | `src/env/betterstack.ts` | BetterStack env validation |
| `@vendor/observability/sentry-env` | `src/env/sentry-env.ts` | Sentry env validation |

All source files carry `"server-only"` to prevent client bundle inclusion.

#### Log Module (`src/log/next.ts`)

- **Backend**: `@logtail/next` in production (`VERCEL_ENV === "production"`), `console` otherwise.
- **Auto-enrichment**: Every `log.*` call spreads `getContext()` (ALS `RequestContext` fields) into the metadata, then calls `pushJournal()` to append to the in-memory journal.
- **Fields injected from ALS** (when inside tRPC scope): `requestId`, `traceId` (optional), plus auth fields (`userId`, `orgId` for app; `caller` for platform).
- **Outside ALS scope** (Inngest, standalone scripts): `getContext()` returns `{}`, no enrichment, journal push is a no-op.

#### Error Module (`src/error/next.ts`)

```typescript
export const parseError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return error.message as string;
  if (typeof error === "string") return error;
  return String(error);
};
```

Pure function. No side effects (Sentry capture was removed in commit `ee31e2f96`). **Zero import sites** across the codebase — entirely unused despite being exported.

#### Context Module (`src/context.ts`)

- `RequestContext` type: `{ requestId: string } & Record<string, unknown>` — open record, only `requestId` enforced.
- `JournalEntry`: `{ level, msg, meta?, ts }`.
- `RequestStore`: `{ ctx: RequestContext; journal: JournalEntry[] }`.
- `requestStore`: `new AsyncLocalStorage<RequestStore>()`.
- Journal cap: **50 entries** (`MAX_JOURNAL_ENTRIES`).
- Helpers: `createStore()`, `getContext()`, `getJournal()`, `pushJournal()`.

#### Request Module (`src/request.ts`)

- `withRequestContext<T>(ctx, fn)`: Opens ALS scope via `requestStore.run()`, measures duration, returns `{ result, journal, durationMs }`.
- `emitJournal(journal, meta)`: If journal non-empty, emits single `log.info("[trpc] request journal", { ...meta, entryCount, entries })`.

#### tRPC Module (`src/trpc.ts`)

`createObservabilityMiddleware<TCtx>(opts)` — the single middleware factory for all tRPC observability.

**Execution flow:**
1. Optional dev delay (100-500ms)
2. `extractAuth(ctx)` for auth fields
3. `withIsolationScope()` from `@sentry/core`
4. Attach `trpc` context to Sentry scope (`procedure_path`, `procedure_type`, `input`)
5. `startSpan("trpc/<path>", { op: "rpc.server" })` for Sentry tracing
6. Extract `traceId` from active span
7. Generate `requestId` via `nanoid()`
8. `withRequestContext({ requestId, traceId, ...authFields }, () => next())` — opens ALS
9. Classify result:
   - `result.ok` -> `log.info("[trpc] ok", meta)`
   - `httpStatus >= 500` -> `log.error("[trpc] server error", meta)` + `captureException` (cause unwrapping for INTERNAL_SERVER_ERROR)
   - `httpStatus < 500` -> `log.info("[trpc] client error", meta)`
10. `emitJournal(journal, { path, durationMs, ok })`

**Error classification**: Uses `getHTTPStatusCodeFromError()` from `@trpc/server/http` — dynamic, no maintained string constant sets. All tRPC codes mapping to < 500 are classified as client errors (expected).

**Cause unwrapping** (added in `ee31e2f96`): For `INTERNAL_SERVER_ERROR` where `result.error.cause instanceof Error`, Sentry receives the original error instead of the generic `TRPCError` wrapper.

---

### 2. Tier 1 Implementation Status — Complete

All four Tier 1 items are fully implemented.

#### Phase 1: Logging in 6 Blind Files — Done

All 6 files import `log` from `@vendor/observability/log/next`:

| File | Log sites | Levels |
|---|---|---|
| `api/platform/src/router/platform/proxy.ts:17` | 3 | error, warn |
| `api/platform/src/router/platform/connections.ts:25` | 1 | warn |
| `api/platform/src/router/platform/backfill.ts:29` | 5 | error, warn |
| `api/platform/src/lib/token-helpers.ts:6` | 2 | warn |
| `api/platform/src/lib/token-store.ts:6` | 2 | info |
| `api/platform/src/lib/oauth/state.ts:7` | 3 | info, warn |

#### Phase 2: Provider Response Body Capture — Done (2 intentional exceptions)

`readErrorBody()` exists at `packages/app-providers/src/runtime/http.ts`. Used across 6 provider files (12 call sites).

**Two sites without `readErrorBody`** (both intentional):
1. `sentry/index.ts:62` — uses `response.text()` directly + `console.error` (pre-existing pattern, reads full body).
2. `linear/index.ts:319` — returns `"revoked"` immediately on `!response.ok` (health-check probe, body intentionally discarded).

#### Phase 3: tRPC Observability Middleware — Done

`timingMiddleware` fully replaced by `observabilityMiddleware` (via `createObservabilityMiddleware`) in both `api/app/src/trpc.ts` and `api/platform/src/trpc.ts`.

Fields logged: `path`, `type`, `durationMs`, `ok`, `requestId`, `traceId` (when Sentry span active), `errorCode` (on failure), plus auth fields.

#### Phase 4: Error Classification — Done (evolved beyond original plan)

The original plan specified `EXPECTED_TRPC_ERRORS` constant sets. The actual implementation uses `getHTTPStatusCodeFromError()` for dynamic classification — a more robust approach that handles any future tRPC error codes automatically.

`beforeSend` filters exist in:
- `apps/app/src/instrumentation.ts:18-27` (server)
- `apps/platform/src/instrumentation.ts:18-27` (server, identical)
- `apps/app/src/instrumentation-client.ts:25-36` (client, for `TRPCClientError`)

---

### 3. AsyncLocalStorage Request Context — Complete

Implemented in PR #567. The ALS scope is opened **exclusively** through `createObservabilityMiddleware` on the tRPC procedure stack.

**Active in**: All tRPC procedure calls across `@api/app` and `@api/platform`.

**Not active in**: Inngest functions, Next.js middleware, standalone API route handlers, provider package code. In these contexts, `getContext()` returns `{}` and journal accumulation is skipped silently.

---

### 4. Sentry Integration — Three-Layer Defense

**Layer 1 — Middleware `captureException`** (`vendor/observability/src/trpc.ts:133-138`):
Only fires for `httpStatus >= 500`. Uses `withIsolationScope` + scope tags (`trpc.path`, `trpc.type`, `trpc.error_code`). Mechanism: `{ handled: false, type: "auto.rpc.trpc.middleware" }`.

**Layer 2 — Server `beforeSend`** (`apps/app/src/instrumentation.ts`, `apps/platform/src/instrumentation.ts`):
Drops any `TRPCError` with `httpStatus < 500` that leaks through (backstop).

**Layer 3 — Client `beforeSend`** (`apps/app/src/instrumentation-client.ts`):
Drops `TRPCClientError` with `httpStatus < 500`. Comment: "server owns tRPC error observability."

**Direct `captureException` calls** (outside tRPC middleware):
- `apps/app/src/app/global-error.tsx:22` — global error boundary
- `apps/app/src/app/(auth)/error.tsx:20` — auth error boundary
- `apps/app/src/app/(early-access)/error.tsx:23` — early access error boundary
- `apps/app/src/app/(early-access)/_actions/early-access.ts` — 4 call sites (Redis/Clerk failures)
- `apps/app/src/app/lib/clerk/error-handler.ts` — 2 call sites (`handleClerkError`, `handleUnexpectedStatus`)

**No `captureException` calls** in `api/app/src/`, `api/platform/src/`, `apps/platform/src/`, or `packages/`.

**Sentry middleware (`trpcMiddleware` from `@sentry/core`)**: Removed entirely in PR #573. Replaced by `createObservabilityMiddleware` which handles Sentry span creation + error capture directly.

**Inngest Sentry**: `sentryMiddleware()` from `@inngest/middleware-sentry@^0.1.2` registered on both Inngest clients. No `captureException` calls in any Inngest function — the middleware handles it.

---

### 5. Inngest Observability — Current State

**Version**: `inngest@^3.52.6`, `@inngest/middleware-sentry@^0.1.2`

**12 functions total**: 11 in `api/platform/src/inngest/functions/`, 1 in `api/app/src/inngest/workflow/infrastructure/`.

**Middleware on clients**: Only `sentryMiddleware()`. No observability middleware. `InngestMiddleware` is exported from `@vendor/inngest` but not used.

**Logging**: All 12 functions import `log` from `@vendor/observability/log/next`. Logging is manual with bracket-prefix convention (`[ingest-delivery]`, `[event-store]`, etc.).

**ALS integration**: None. Functions run outside `withRequestContext()`, so `getContext()` returns `{}`. No `requestId`, `traceId`, or auth fields injected into log calls. Journal accumulation is skipped.

**`correlationId` tracing**: Manual. Present as optional field in 8 of 13 platform event schemas. Passed through event data fields, manually included in `log.*` calls. Not injected automatically by middleware.

**Functions with `correlationId`**: `ingestDelivery`, `platformEventStore`, `platformEntityGraph`, `platformEntityEmbed`, `platformBackfillOrchestrator`, `platformEntityWorker`.

**Functions without `correlationId`**: `platformNotificationDispatch`, `connectionLifecycle`, `healthCheck`, `tokenRefresh`, `deliveryRecovery`, `recordActivity` (app).

**`onFailure` handlers**: 3 functions use `createNeuralOnFailureHandler()` factory (`api/platform/src/inngest/on-failure-handler.ts`). It logs the failure and optionally marks the job as failed.

**Silent catch blocks in Inngest functions**:
- `delivery-recovery.ts:83` — empty catch body (comment: extraction failure, proceed with null)
- `delivery-recovery.ts:138` — pushes to `failed` array, no log
- `health-check.ts:91, :107` — calls `recordTransientFailure()`, no log

---

### 6. `parseError` — Exists But Unused

`parseError` from `@vendor/observability/error/next` has **zero imports** anywhere in the codebase.

Meanwhile, **30+ call sites** manually replicate the pattern:
```typescript
err instanceof Error ? err.message : String(err)
```

These exist across:
- `api/platform/src/router/platform/` — proxy.ts, connections.ts, backfill.ts
- `api/platform/src/inngest/functions/` — token-refresh, backfill-orchestrator, connection-lifecycle, entity-worker
- `api/platform/src/trpc.ts`, `lib/token-store.ts`
- `api/app/src/router/` — organization.ts, account.ts, connections.ts
- `api/app/src/lib/activity.ts`, `inngest/workflow/infrastructure/record-activity.ts`
- `apps/app/src/app/(api)/` — multiple route handlers

`parseError` handles a superset of cases (duck-typed error objects with `.message`, raw strings) compared to the manual pattern. It is a pure function with no side effects since commit `ee31e2f96`.

---

### 7. Remaining Console Usage

**`api/platform/src/`**: None.
**`api/app/src/`**: None.
**`apps/platform/src/`**: None.

**`apps/app/src/`** (client-side code): 12 sites across React components:
- Error boundaries: `org-page-error-boundary.tsx`, `page-error-boundary.tsx`, `(auth)/error.tsx`, `(early-access)/error.tsx`
- Components: `answer-interface.tsx`, `jobs-table.tsx`, `team-general-settings-client.tsx`, `link-sources-button.tsx`
- API route: `app/api/gateway/stream/route.ts:108`
- Server action: `invite-teammates.ts:44`

**Provider code**: `sentry/index.ts:62` — single `console.error` in token exchange error path.

---

### 8. Coverage Summary

| Area | Status | Details |
|---|---|---|
| Platform router logging | Complete | All 6 blind files instrumented |
| Provider body capture | Complete | 12 sites + 2 intentional exceptions |
| tRPC observability middleware | Complete | Single factory, both stacks |
| Error classification | Complete | Dynamic HTTP status, 3-layer Sentry defense |
| ALS request context | Complete (tRPC only) | Opens scope in tRPC, not Inngest |
| Journal system | Complete (tRPC only) | Accumulates during tRPC, emitted post-response |
| Inngest ALS | Not implemented | No `withRequestContext` in Inngest |
| Inngest observability middleware | Not implemented | `InngestMiddleware` exported but unused |
| `correlationId` auto-propagation | Not implemented | Manual pass-through in event data |
| `parseError` adoption | Not started | 0 imports, 30+ manual pattern sites |
| Client-side console cleanup | Not started | 12 `console.*` calls in `apps/app/src/` |
| Provider console cleanup | Not started | 1 `console.error` in `sentry/index.ts:62` |

---

## Code References

- `vendor/observability/src/context.ts` — ALS store definition, journal types
- `vendor/observability/src/request.ts:17-26` — `withRequestContext` (ALS scope opener)
- `vendor/observability/src/trpc.ts:41-151` — `createObservabilityMiddleware` factory
- `vendor/observability/src/log/next.ts:13-18` — `enriched()` auto-enrichment function
- `vendor/observability/src/error/next.ts:3-14` — `parseError` (unused)
- `api/app/src/trpc.ts:147-160` — app tRPC middleware instantiation
- `api/platform/src/trpc.ts:103-110` — platform tRPC middleware instantiation
- `apps/app/src/instrumentation.ts:18-27` — server `beforeSend` filter
- `apps/app/src/instrumentation-client.ts:25-36` — client `beforeSend` filter
- `api/platform/src/inngest/client.ts:8-13` — Inngest client (sentryMiddleware only)
- `api/platform/src/inngest/on-failure-handler.ts:54-92` — shared onFailure factory
- `packages/app-providers/src/runtime/http.ts:1-15` — `readErrorBody` utility
- `vendor/inngest/src/index.ts:1-7` — InngestMiddleware export (available but unused)

## Architecture Documentation

### Data Flow: tRPC Request

```
HTTP Request
  -> fetchRequestHandler (no onError)
    -> createTRPCContext (auth resolution)
      -> observabilityMiddleware
        -> withIsolationScope (Sentry)
          -> startSpan("trpc/<path>")
            -> withRequestContext({ requestId, traceId, ...auth })  [ALS opens]
              -> procedure body executes
              -> all log.* calls auto-enrich with ALS context
              -> all log.* calls push to journal
            -> [ALS closes]
          -> classify result by httpStatus
          -> log outcome + optional captureException
          -> emitJournal
        -> [Sentry scope closes]
      -> HTTP Response
```

### Data Flow: Inngest Function

```
Inngest Event
  -> sentryMiddleware (from @inngest/middleware-sentry)
    -> function handler executes
      -> log.* calls emit with manually-passed metadata
      -> getContext() returns {} (no ALS scope)
      -> pushJournal is no-op
      -> correlationId passed manually through event data
    -> on error: sentryMiddleware captures to Sentry
    -> on failure (if onFailure declared): createNeuralOnFailureHandler logs + marks job failed
```

### Sentry Error Flow

```
                    Server Side                          Client Side
                    -----------                          -----------
tRPC procedure error
  -> httpStatus >= 500?
     YES -> captureException (cause unwrapped)
            -> beforeSend (instrumentation.ts)
               -> TRPCError < 500? drop : pass
               -> Sentry receives event
     NO  -> log.info only, no capture

                                                  TRPCClientError
                                                    -> beforeSend (instrumentation-client.ts)
                                                       -> httpStatus < 500? drop : pass
```

## Historical Context (from thoughts/)

19 documents in `thoughts/shared/` relate to observability, spanning the full research-to-implementation arc:

**Research docs** (analytical inputs):
- `research/2026-04-05-logging-error-handling-architecture.md` — original architecture research
- `research/2026-04-05-platform-logging-gaps.md` — identified the 6 blind files
- `research/2026-04-05-trpc-observability-architecture-evaluation.md` — evaluated options for tRPC observability
- `research/2026-04-05-trpc-error-handling-propagation.md` — traced error propagation through the stack
- `research/2026-04-05-betterstack-env-var-mismatch.md` — identified env var naming causing logging failures

**Implementation plans** (derived from research):
- `plans/2026-04-05-tier1-observability-primitives.md` — the original 4-phase plan (fully implemented)
- `plans/2026-04-05-asynclocalstorage-request-context.md` — ALS plan (fully implemented)
- `plans/2026-04-05-trpc-error-handling-consolidation.md` — consolidation plan (fully implemented)
- `plans/2026-04-05-trpc-observability-fixes.md` — Sentry quality fixes (fully implemented)

## Open Questions

1. **Inngest ALS scope**: The v3 `InngestMiddleware` API supports `init -> onFunctionRun -> beforeExecution/afterExecution` hooks. Should an observability middleware wrap each function run in `requestStore.run()` to enable auto-enrichment and journal accumulation for Inngest? This is the highest-leverage remaining gap.

2. **`correlationId` auto-propagation**: Currently manual through event data. An Inngest middleware could read `correlationId` from ALS and auto-inject into outgoing `step.sendEvent()` calls — but this requires intercepting event sends, which may not be possible with v3 middleware hooks.

3. **`parseError` adoption**: 30+ call sites manually replicate the pattern. Should the codebase standardize on `parseError` from `@vendor/observability/error/next`? The utility handles edge cases (duck-typed objects) that the manual pattern misses.

4. **Client-side console cleanup**: 12 `console.*` calls remain in `apps/app/src/` (mostly error boundaries and React components). These are client-side where `@vendor/observability/log/next` (server-only) cannot be used. Should a client-side logger be added to `@vendor/observability`?

5. **Provider `console.error`**: `packages/app-providers/src/providers/sentry/index.ts:62` uses `console.error` + raw `response.text()` instead of `readErrorBody`. Should this be normalized?

6. **Inngest silent catch blocks**: 4 catch blocks in `delivery-recovery.ts` and `health-check.ts` silently swallow errors. Are these intentional design decisions or gaps?

7. **`@inngest/middleware-sentry` version**: Currently on `^0.1.2`. Version `1.0.0` (for Inngest v4) adds `onlyCaptureFinalAttempt: true` and `withIsolationScope`. Is the `0.1.2` version capturing errors on every retry attempt?
