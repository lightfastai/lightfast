---
date: 2026-04-06T12:00:00+08:00
researcher: claude
git_commit: ebd062cfab3fe35705cf5e276491688752040af8
branch: main
topic: "Sentry error handling gaps in apps/app and apps/platform"
tags: [research, codebase, sentry, error-handling, observability, apps-app, apps-platform]
status: complete
last_updated: 2026-04-06
---

# Research: Sentry Error Handling Gaps in apps/app and apps/platform

**Date**: 2026-04-06
**Git Commit**: ebd062cfab3fe35705cf5e276491688752040af8
**Branch**: main

## Research Question

Document the Sentry error handling gaps across `apps/app/` and `apps/platform/` — where errors are caught but not reported to Sentry.

## Summary

Both apps have robust Sentry initialization (client, server, edge runtimes) and a shared tRPC observability middleware that captures 500+ errors. However, a significant class of errors never reaches Sentry: any catch block that uses `log.error`/`log.warn` (BetterStack-only) instead of `captureException`, and any catch block that swallows errors silently. The `captureConsoleIntegration` only captures `console.error`/`console.warn` — the structured `log.*` logger bypasses `console.*` in production, so these errors are invisible to Sentry.

**Key gap pattern**: `log.error(...)` + return fallback = BetterStack only, no Sentry.

---

## Detailed Findings

### How Sentry Is Initialized

Both apps use the Next.js 15 instrumentation convention (no legacy `sentry.*.config.ts` files):

| App | Client Init | Server/Edge Init | Build Plugin |
|---|---|---|---|
| `apps/app` | `src/instrumentation-client.ts` | `src/instrumentation.ts` | `next.config.ts:148` via `withSentryConfig` |
| `apps/platform` | None (no client-side UI) | `src/instrumentation.ts` | `next.config.ts:25` via `withSentryConfig` |

Shared config lives in `@vendor/observability/sentry-env` (env vars) and `@vendor/next/config` (build plugin options with tunnel route `/monitoring`).

**`beforeSend` filter** (both apps): Drops any `TRPCError` with HTTP status < 500. This is intentional — 4xx errors are client errors.

### How Errors Currently Reach Sentry

There are exactly **4 paths** for errors to reach Sentry:

1. **tRPC observability middleware** (`vendor/observability/src/trpc.ts:133`) — `captureException` for HTTP 500+ tRPC errors. Applied to all procedure types in both apps. For `INTERNAL_SERVER_ERROR` with a `.cause`, reports the cause (better grouping).

2. **Next.js `onRequestError`/`captureRequestError`** — fires for **uncaught** errors in route handlers. If a handler catches its own error, this hook does not fire.

3. **Client error boundaries** (`apps/app` only) — `global-error.tsx`, `(auth)/error.tsx`, `(early-access)/error.tsx` all call `captureException` in `useEffect`.

4. **Direct `captureException` calls** — only in `apps/app`: early-access server action (4 call sites) and Clerk error handler utility (2 call sites).

5. **`captureConsoleIntegration`** — captures `console.error`/`console.warn` calls. But production backend code uses `log.*` (BetterStack), not `console.*`, so this only captures client-side `console.error` calls.

6. **Inngest `sentryMiddleware()`** (`api/platform/src/inngest/client.ts:12`) — third-party middleware from `@inngest/middleware-sentry`. Captures Inngest function errors.

### The Central Gap: `log.*` Does Not Reach Sentry

`@vendor/observability/log/next` (`vendor/observability/src/log/next.ts`) routes structured logs to BetterStack (via `@logtail/next` in production) or `console` (in development). In production, `log.error(...)` goes to BetterStack only. `captureConsoleIntegration` never sees it.

This means every catch block that calls `log.error` + returns a fallback is a Sentry blind spot.

---

### Catch Blocks NOT Reporting to Sentry

#### `api/platform/src/` (Platform API Layer)

| Location | What Happens | Severity |
|---|---|---|
| `lib/oauth/callback.ts:350-364` | `log.error` + redirect with error URL | High — OAuth failures lost |
| `lib/oauth/authorize.ts:82-88` | `log.warn` + `{ ok: false }` | Medium |
| `lib/edge-resolver.ts:267-273` | `log.error` + returns `0`, no rethrow | High — silent data loss |
| `lib/jobs.ts:236-242` | `log.error` + returns `null` | Medium |
| `lib/token-helpers.ts:112-125` | `log.warn` + fallthrough | Low — retry path |
| `lib/token-helpers.ts:137-148` | `log.warn` + returns `null` | Medium |
| `inngest/functions/delivery-recovery.ts:83-93` | `log.warn` + continues with `null` | Medium |
| `inngest/functions/delivery-recovery.ts:139-144` | `log.error` + continues loop | High — delivery failures lost |
| `inngest/functions/delivery-recovery.ts:145-152` | `log.warn` + pushes to `failed[]` | Medium |
| `inngest/functions/connection-lifecycle.ts:92-101` | `log.warn` "best-effort" | Low |
| `inngest/functions/connection-lifecycle.ts:159-168` | `log.warn` "best-effort" | Low |
| `inngest/functions/token-refresh.ts:118-127` | `log.warn` | Medium |
| `inngest/functions/health-check.ts:91-102` | `log.warn` + `recordTransientFailure` | Low — intentional |
| `inngest/functions/health-check.ts:113-125` | `log.warn` + `recordTransientFailure` | Low — intentional |
| `inngest/functions/platform-backfill-orchestrator.ts:203-215` | `log.warn` + fallback | Medium |
| `inngest/functions/platform-backfill-orchestrator.ts:309-319` | **No log, no Sentry** + returns `{ success: false }` | High — completely silent |
| `inngest/on-failure-handler.ts:71-74` | `log.error` only | High — post-retry failures lost |
| `router/platform/connections.ts:123-128` | `log.warn` + rethrows as 4xx TRPCError | Low — intentional reclassification |
| `router/platform/backfill.ts:275-293` | `log.warn` + returns `null` | Medium |
| `router/platform/backfill.ts:394-410` | `log.warn` + returns `-1` | Medium |
| `router/platform/proxy.ts:215-223` | `log.warn` (401 auth rebuild) | Low |
| `router/platform/proxy.ts:244-253` | `log.warn` + returns `null` | Medium |
| `trpc.ts:61-66` | `log.warn` (JWT verify) | Low — falls through to unauthed |

#### `api/app/src/` (App API Layer)

| Location | What Happens | Severity |
|---|---|---|
| `lib/activity.ts:158-170` (`recordCriticalActivity`) | `log.error` + `{ success: false }` | High — critical activity lost |
| `lib/activity.ts:254-266` (`recordActivity`) | `log.error` + `{ success: false }` | Medium |
| `lib/activity.ts:336-344` (`recordSystemActivity`) | `log.warn` + silent | Medium |
| `lib/activity.ts:378-389` (`batchRecordActivities`) | `log.error` + `{ success: false }` | Medium |
| `inngest/workflow/infrastructure/record-activity.ts:112-120` | `log.error` + rethrows for Inngest retry | Low — Inngest sentryMiddleware may catch |

#### `apps/app/src/` (App Frontend + Route Handlers)

| Location | What Happens | Severity |
|---|---|---|
| `app/(api)/lib/with-api-key-auth.ts:164-174` | `log.error` + `{ success: false }` | High — API auth failures lost |
| `app/(api)/lib/with-api-key-auth.ts:142-147` | `log.error` + fire-and-forget `.catch()` | Medium |
| `app/(api)/v1/answer/[...v]/route.ts:116-127` | `log.error` + returns 500 | High — caught, so `captureRequestError` skipped |
| `app/(api)/v1/answer/[...v]/route.ts:207-218` | `log.error` + returns 500 | High — same |
| `app/(api)/v1/[...rest]/route.ts:35-49` | `log.error` + returns 500 | High — same |
| `app/(app)/(org)/[slug]/layout.tsx:60-62` | `log.debug` + `notFound()` | Low |
| `lib/org-access-clerk.ts:58-61` | No logging, rethrows generic `Error` | Low — rethrown |
| `hooks/use-oauth-popup.ts:154,175` | `toast.error()` only | Medium — client errors lost |
| `components/org-search.tsx:140-147` | `setError(parseError(err))` only | Low — UI error display |
| `app/(auth)/sign-up/sso-callback/page.tsx:56` | **Empty `.catch(() => {})`** — fully silent | Medium |
| `app/(auth)/_components/session-activator.tsx:47-49` | `setError(...)` only | Medium |
| `app/(auth)/_components/otp-island.tsx:182-188` | `setError(...)` only | Medium |
| `app/(providers)/provider/*/connected/page.tsx` | Silent swallow of `SecurityError` | Low — expected cross-origin |

### Catch Blocks That DO Report to Sentry

**Via tRPC middleware (HTTP 500+ rethrows):**
- `api/app/src/router/org/connections.ts:247-258` — github.validate → INTERNAL_SERVER_ERROR
- `api/app/src/router/org/connections.ts:416-428` — github.detectConfig → INTERNAL_SERVER_ERROR
- `api/app/src/router/user/account.ts:47-58` — account.get → INTERNAL_SERVER_ERROR
- `api/app/src/router/user/organization.ts:89-126` — org.create fallback → INTERNAL_SERVER_ERROR
- `api/app/src/router/user/organization.ts:175-212` — org.updateName fallback → INTERNAL_SERVER_ERROR
- `api/platform/src/router/platform/backfill.ts:97-109,151-163,246-258` — Inngest dispatch/estimate errors
- `api/platform/src/router/platform/connections.ts:143-149` — getToken unknown error
- `api/platform/src/router/platform/proxy.ts:161-171` — proxy token failure

**Via direct `captureException`:**
- `apps/app/src/app/(early-access)/_actions/early-access.ts:190,211,279,300` — Redis/Clerk errors
- `apps/app/src/app/lib/clerk/error-handler.ts:74,116` — Clerk auth errors

**Via error boundaries:**
- `apps/app/src/app/global-error.tsx:22`
- `apps/app/src/app/(auth)/error.tsx:20`
- `apps/app/src/app/(early-access)/error.tsx:23`

**Via `console.error` + `captureConsoleIntegration` (client-side):**
- `apps/app/src/components/errors/page-error-boundary.tsx:39-40`
- `apps/app/src/components/errors/org-page-error-boundary.tsx:54-55`
- `apps/app/src/components/answer-interface.tsx:74`

---

### Inngest `onFailure` Gap

The Inngest `sentryMiddleware()` at `api/platform/src/inngest/client.ts:12` captures errors during function execution. However, the custom `createNeuralOnFailureHandler` at `api/platform/src/inngest/on-failure-handler.ts:41` only calls `log.error` and marks the DB job as failed — it does not call `captureException`. After all retries exhaust, the final failure state is in BetterStack and the DB, but not in Sentry.

### `apps/platform` Has No Error Boundaries

There are no `error.tsx` or `global-error.tsx` files in `apps/platform/src/`. Since platform is primarily an API service (no user-facing UI), this is expected — but any server-rendered pages would have no React error boundary Sentry capture.

### Route Handler Gap Pattern

Route handlers in `apps/app/src/app/(api)/` that catch their own errors and return 500 responses prevent Next.js's `captureRequestError` hook from firing. These errors reach BetterStack via `log.error` but not Sentry:
- `v1/answer/[...v]/route.ts` (2 catch blocks)
- `v1/[...rest]/route.ts` (1 catch block)
- `with-api-key-auth.ts` (1 catch block)

---

## Code References

- `vendor/observability/src/trpc.ts:133` — Central `captureException` for tRPC 500+ errors
- `vendor/observability/src/log/next.ts:1-27` — Structured logger (BetterStack, not console)
- `apps/app/src/instrumentation-client.ts:49-64` — `captureConsoleIntegration` setup
- `apps/app/src/instrumentation.ts:13-16` — Server `captureConsoleIntegration` setup
- `apps/platform/src/instrumentation.ts:34-37` — Platform `captureConsoleIntegration` setup
- `api/platform/src/inngest/client.ts:12` — Inngest `sentryMiddleware()`
- `api/platform/src/inngest/on-failure-handler.ts:71-74` — `log.error` only in onFailure
- `vendor/observability/src/env/sentry-env.ts` — All Sentry env vars (all optional)

## Architecture Documentation

### Sentry Integration Architecture

```
                              ┌─────────────────────────┐
                              │    Sentry (ingest.io)    │
                              │   via /monitoring tunnel │
                              └───────────┬─────────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              │                           │                           │
    ┌─────────▼──────────┐    ┌──────────▼──────────┐    ┌──────────▼──────────┐
    │  captureException  │    │  captureRequestError │    │ captureConsole      │
    │  (direct calls)    │    │  (Next.js hook)      │    │ Integration         │
    │                    │    │  (uncaught only)     │    │ (console.* only)    │
    └────────────────────┘    └──────────────────────┘    └─────────────────────┘
              │                           │                           │
    ┌─────────▼──────────┐    ┌──────────▼──────────┐    ┌──────────▼──────────┐
    │ tRPC middleware     │    │ Route handlers that  │    │ Client-side         │
    │ (500+ errors)      │    │ DON'T catch errors   │    │ console.error calls │
    │ Error boundaries   │    │                      │    │                     │
    │ early-access action│    │                      │    │                     │
    │ Clerk error handler│    │                      │    │                     │
    └────────────────────┘    └──────────────────────┘    └─────────────────────┘

    ┌──────────────────────────────────────────────────────────────────────────┐
    │                    DOES NOT REACH SENTRY                                 │
    │                                                                          │
    │  log.error / log.warn  ──→  BetterStack only (via @logtail/next)        │
    │  Route handlers that catch + return 500  ──→  captureRequestError skip  │
    │  Inngest onFailure handler  ──→  log.error + DB update only             │
    │  Client setError() / toast.error()  ──→  UI only                        │
    └──────────────────────────────────────────────────────────────────────────┘
```

### `beforeSend` Filter

Both apps drop events where `originalException` is a `TRPCError`/`TRPCClientError` with HTTP status < 500. This prevents 4xx client errors from polluting Sentry.

### Env Vars (All Optional)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | SDK DSN |
| `NEXT_PUBLIC_VERCEL_ENV` | Environment + sample rate control |
| `SENTRY_ORG` | Build plugin org |
| `SENTRY_PROJECT` | Build plugin project |
| `SENTRY_AUTH_TOKEN` | Source map upload auth |

## Historical Context (from thoughts/)

17 related documents exist in `thoughts/shared/` covering observability architecture:

- `thoughts/shared/research/2026-04-05-observability-architecture-complete-state.md` — Full snapshot of the observability stack
- `thoughts/shared/research/2026-04-05-observability-remaining-work-inventory.md` — Inventory of remaining work including silent catches
- `thoughts/shared/research/2026-04-05-platform-logging-gaps.md` — Platform-specific blind spots
- `thoughts/shared/research/2026-04-05-parseerror-full-propagation-inventory.md` — `parseError` adoption inventory
- `thoughts/shared/plans/2026-04-05-provider-console-inngest-silent-catches.md` — Plan for Inngest silent catch cleanup
- `thoughts/shared/plans/2026-04-05-tier1-observability-primitives.md` — Tier 1 observability primitives plan
- `thoughts/shared/plans/2026-04-05-trpc-observability-fixes.md` — tRPC observability fixes plan
- `thoughts/shared/plans/2026-04-05-platform-logging-gaps.md` — Platform logging gaps plan

## Open Questions

1. Are the `log.error` calls in `api/platform/src/inngest/on-failure-handler.ts` intentionally Sentry-excluded, or is this an oversight given `sentryMiddleware()` only covers in-execution errors?
2. Should the route handlers in `apps/app/src/app/(api)/v1/` call `captureException` before returning 500, or should they let errors propagate to `captureRequestError`?
3. The `platform-backfill-orchestrator.ts:309-319` catch block has no logging at all — is this intentional?
