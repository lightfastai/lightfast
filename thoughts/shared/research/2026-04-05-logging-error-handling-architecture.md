---
date: 2026-04-05T00:00:00+00:00
researcher: claude
git_commit: 38ecf9eb8fa69b8e69b9f78179468c3d86a3a492
branch: main
topic: "Logging, error handling, and middleware architecture across api/app and api/platform — current state + innovative solutions"
tags: [research, codebase, observability, logging, error-handling, middleware, trpc, inngest, sentry, betterstack, opentelemetry]
status: complete
last_updated: 2026-04-05
---

# Research: Logging, Error Handling & Middleware Architecture

**Date**: 2026-04-05
**Git Commit**: `38ecf9eb8`
**Branch**: main

## Research Question

How does logging, error handling, and middleware work across `api/app/`, `api/platform/`, their Inngest pipelines, and the `@vendor/observability` layer? What are the most assertive, innovative, and creative solutions for improving these systems?

## Summary

The monorepo has a clean structured logging foundation (`@vendor/observability/log/next` routing to BetterStack/Logtail in production, `console` elsewhere) with zero `console.*` calls in `api/platform/` and nearly zero in `api/app/`. Error handling follows three distinct models: tRPC routers use `TRPCError` throws with centralized logging in `onError` handlers; Inngest functions use inline `log.*` + `NonRetriableError`/`Error` throws with an `onFailure` factory; and the provider package (`app-providers`) uses raw `throw new Error()` with almost no logging. Sentry is well-integrated at the instrumentation layer but has gaps in error classification (4xx noise) and the tRPC `trpcMiddleware` captures all errors indiscriminately.

The most impactful innovations available for this stack center on five areas: (1) **AsyncLocalStorage-based context propagation** for correlation IDs and user/org identity across all async boundaries, (2) **Inngest SDK v4 middleware rewrite** with class-based hooks for step-level observability, (3) **tRPC observability middleware** that enriches every procedure call with auth context and outcome logging, (4) **OpenTelemetry as a unifying trace layer** feeding both BetterStack and Sentry from a single pipeline, and (5) **error classification middleware** that separates expected domain errors from unexpected failures at every layer.

---

## Part 1: Current State — What Exists Today

### 1.1 The Logger (`@vendor/observability`)

The observability vendor package provides three capabilities:

**Structured logging** — `@vendor/observability/log/next` (`vendor/observability/src/log/next.ts`)
```typescript
const shouldUseBetterStack = betterstackEnv.VERCEL_ENV === "production";
export const log = shouldUseBetterStack ? logtail : console;
```
- Production: `@logtail/next` (BetterStack) — structured JSON logs with metadata
- Non-production: native `console` object
- Server-only (enforced by `"server-only"` import)
- Interface: `debug`, `info`, `warn`, `error` — each takes `(message: string, metadata?: Record<string, unknown>)`
- Exported as a module-level singleton — no per-request scoping or child logger support

**Error parsing** — `@vendor/observability/error/next` (`vendor/observability/src/error/next.ts`)
- `parseError(error: unknown)` extracts message, calls `Sentry.captureException(error)`, logs via `log.error`, returns string
- Used by: `apps/app/src/app/(early-access)/_actions/early-access.ts:300`

**Sentry re-exports** — `@vendor/observability/sentry` (`vendor/observability/src/sentry.ts`)
- Re-exports `@sentry/core` primitives (captureException, withScope, addBreadcrumb, etc.)
- `initSentryService(opts)` — custom Sentry init for Hono edge-runtime services using fetch-based transport
- Currently unused by any live app code — all apps import directly from `@sentry/nextjs`

### 1.2 Logger Coverage Map

#### `api/app/src/` — 7 files import the logger

| File | Key logging behavior |
|------|---------------------|
| `trpc.ts:15` | `timingMiddleware` logs `[trpc] procedure timing` with `{ path, durationMs }` |
| `router/user/organization.ts:5` | `log.info` on create/update success, `log.error` on all catches |
| `router/user/account.ts:4` | `log.error` on account.get failure |
| `router/org/connections.ts:15` | `log.error` on validate/detectConfig failures only; list/disconnect/updateBackfillConfig have no logging |
| `router/org/org-api-keys.ts:12` | `log.error` on create/rotate failures, `log.info` on all mutation successes; `list` query has no logging |
| `lib/activity.ts:34` | Full logging in all activity functions; fire-and-forget uses `log.warn` in `.catch()` |
| `inngest/workflow/infrastructure/record-activity.ts:18` | `log.info` on batch processing, `log.error` on insert failure before rethrow |

**Files with no logger (in `api/app`):**
- `router/org/events.ts` — explicit comment: "Sentry's trpcMiddleware captures failures with full stack + input context"
- `router/org/jobs.ts` — pure DB read, no error handling

#### `api/platform/src/` — 17 files import the logger

| File | Key logging behavior |
|------|---------------------|
| `trpc.ts:9` | Context creation logs auth type; `timingMiddleware` logs procedure timing |
| `lib/oauth/authorize.ts:10` | `log.warn` on all failure paths; returns `{ ok: false }` result types |
| `lib/oauth/callback.ts:13` | `log.warn` on early exits, `log.info` on success, `log.error` in outer catch |
| `lib/jobs.ts:20` | Full logging in all CRUD operations; `getJobByInngestRunId` logs error then returns `null` |
| `lib/edge-resolver.ts:10` | `log.warn` on co-occurrence limit; `log.error` on edge creation failure (returns 0) |
| `inngest/on-failure-handler.ts:31` | Factory `createNeuralOnFailureHandler` — logs failure, optionally completes job as failed |
| All 11 Inngest functions | Varying levels of logging (see Section 1.4 below) |

**Files with no logger (in `api/platform`) — the critical gaps:**
- `router/memory/proxy.ts` — **entire data plane is unlogged**
- `router/memory/connections.ts` — token vault, disconnect, authorize URL
- `router/memory/backfill.ts` — estimate probes, trigger, cancel
- `lib/token-helpers.ts` — silent catch blocks hide token refresh failures
- `lib/token-store.ts` — encrypt + DB writes for token vault
- `lib/oauth/state.ts` — all Redis operations for OAuth flow

### 1.3 tRPC Middleware Stack

Both `api/app` and `api/platform` share a nearly identical middleware architecture:

```
Request → sentryMiddleware → timingMiddleware → authMiddleware → procedure handler
```

#### Sentry Middleware (both apps)
```typescript
const sentryMiddleware = t.middleware(trpcMiddleware({ attachRpcInput: true }));
```
- From `@sentry/core` — wraps every call in a Sentry transaction
- `attachRpcInput: true` — full procedure input attached to Sentry spans
- Issue: captures ALL `TRPCError` throws including intentional 4xx (UNAUTHORIZED, BAD_REQUEST)

#### Timing Middleware (both apps)
```typescript
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();
  // dev-only artificial delay
  const result = await next();
  log.info("[trpc] procedure timing", { path, durationMs: end - start });
  return result;
});
```
- Logs duration for every procedure
- Does NOT log: result outcome (`result.ok`), error code on failure, user/org identity from `ctx.auth`

#### Auth Procedures

**`api/app`** — Three tiers:
- `publicProcedure` — no auth check
- `userScopedProcedure` — requires Clerk auth (pending or active), narrows to `clerk-pending | clerk-active`
- `orgScopedProcedure` — requires Clerk auth with active org, narrows to `clerk-active` with guaranteed `orgId`

**`api/platform`** — Three tiers:
- `publicProcedure` — no auth check
- `serviceProcedure` — requires valid service JWT (`ctx.auth.type === "service"`)
- `adminProcedure` — requires service JWT with `caller === "admin"`

#### Error Formatter (both apps)
```typescript
errorFormatter: ({ shape, error }) => ({
  ...shape,
  message: isProduction && error.code === "INTERNAL_SERVER_ERROR"
    ? "An unexpected error occurred"
    : shape.message,
  data: { ...shape.data, zodError: error.cause instanceof ZodError ? error.cause.flatten() : null },
});
```
- Sanitizes `INTERNAL_SERVER_ERROR` messages in production
- Preserves all other error code messages (UNAUTHORIZED, FORBIDDEN, etc.)

#### tRPC Route Handlers (`onError`)

**`apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts:48-53`:**
```typescript
onError({ error, path }) {
  console.error(`>>> tRPC Error on '${path}'`, error);
  if (error.code === "INTERNAL_SERVER_ERROR") {
    captureException(error);
  }
}
```
- Logs ALL errors to `console.error` (not the structured logger)
- Only sends `INTERNAL_SERVER_ERROR` to Sentry
- This is the ONLY `console.error` in the api/app codebase

**`apps/platform/src/app/api/trpc/[trpc]/route.ts:43-52`:**
```typescript
onError({ error, path }) {
  log.error("[trpc] procedure error", { path, error: error.message, code: error.code });
  if (error.code === "INTERNAL_SERVER_ERROR") {
    captureException(error);
  }
}
```
- Uses the structured logger (not console)
- Same Sentry gate: only `INTERNAL_SERVER_ERROR`

### 1.4 Inngest Architecture

#### Client Setup

**`api/app`** — `api/app/src/inngest/client/client.ts`
- `new Inngest({ id: env.INNGEST_APP_NAME, eventKey: env.INNGEST_EVENT_KEY, schemas: ..., middleware: [sentryMiddleware()] })`
- 1 registered function: `recordActivity`

**`api/platform`** — `api/platform/src/inngest/client.ts`
- `new Inngest({ id: "lightfast-memory", schemas: ..., middleware: [sentryMiddleware()] })`
- 11 registered functions
- Hardcoded ID (vs env var in app)

Both use `sentryMiddleware()` from `@inngest/middleware-sentry` as their only middleware. No custom logger is passed to `new Inngest()`.

#### Inngest Function Logging Tiers

**Full logging (inline `log.*` at every major step):**
- `memory-event-store.ts` — 8+ log calls across all steps, plus `onFailure` handler
- `connection-lifecycle.ts` — log at every step including best-effort catches
- `memory-entity-embed.ts` — log at start, entity-not-found, narrative cap, vector upsert
- `memory-entity-worker.ts` — log at start, per-page, per-dispatch, rate-limit sleep, completion
- `memory-backfill-orchestrator.ts` — log at major milestones, replay cap
- `ingest-delivery.ts` — log at connection resolve, event store, realtime publish

**Partial logging (has logger but silent catches):**
- `health-check.ts` — token fetch catch (line 91) and health-check catch (line 107) call `recordTransientFailure()` but discard the error object. The helper logs "transient failure recorded" but not *why*.
- `delivery-recovery.ts` — `extractResourceId` catch (line 83) is fully silent; per-delivery outer catch (line 138) pushes to `failed[]` with no log; DB status update catch (line 132) does log.
- `memory-backfill-orchestrator.ts` — entity worker invocation catch (lines 308-317) silently records `{ success: false, error: err.message }` into results array.

**Best-effort catches (logged, then swallowed):**
- `connection-lifecycle.ts:86` — backfill cancellation `log.warn` then continues
- `connection-lifecycle.ts:153` — token revocation `log.warn` then continues
- `token-refresh.ts:117` — token refresh failure `log.warn` then continues

#### `onFailure` Factory

`createNeuralOnFailureHandler` (`api/platform/src/inngest/on-failure-handler.ts:41`) produces a consistent `onFailure` callback:
1. Extracts original event from Inngest's `FailureEventPayload`
2. Calls `log.error` with configurable message and context
3. Optionally looks up job by `inngestRunId` and marks as `failed`

Used by: `memoryEventStore` (with full config), `memoryEntityGraph` (default log only), `memoryEntityEmbed` (default log only).

### 1.5 Sentry Integration

#### Instrumentation — All three apps

`apps/app/src/instrumentation.ts` and `apps/platform/src/instrumentation.ts` are identical:
- `tracesSampleRate: 0.2` in production, `1.0` otherwise
- Both nodejs and edge runtime branches
- `includeLocalVariables: true` on nodejs only
- `spotlightIntegration()` in development only
- `export const onRequestError = captureRequestError` — hooks into Next.js lifecycle

`apps/www/src/instrumentation.ts` uses `tracesSampleRate: 0.1` (lower for marketing site).

#### Client-Side (apps/app only)

`apps/app/src/instrumentation-client.ts`:
- Token scrubbing in `beforeBreadcrumb` — redacts `token=`, `__clerk_ticket=`, `ticket=` query params
- `httpClientIntegration` — captures failed HTTP 400-599 requests
- Lazy-loaded session replay (`maskAllText: true`, `blockAllMedia: true`) and feedback widget — deferred to `window.load` to avoid ~418KB initial bundle
- `replaysOnErrorSampleRate: 1.0` — every error session is replayed

#### `captureException` Call Sites

| File | Context |
|------|---------|
| `apps/app/src/app/global-error.tsx:22` | Root error boundary, every unhandled error |
| `apps/www/src/app/global-error.tsx:23` | Same for www |
| `apps/app/src/app/(auth)/error.tsx:20` | Auth route errors, tagged `location: "auth-routes"` |
| `apps/app/src/app/(early-access)/error.tsx:23` | Early access errors, tagged `location: "early-access-route"` |
| `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts:51` | tRPC `onError` — only `INTERNAL_SERVER_ERROR` |
| `apps/platform/src/app/api/trpc/[trpc]/route.ts:50` | Same gate for platform |
| `apps/app/src/app/lib/clerk/error-handler.ts:74,116` | Structured Clerk error handling with tags |
| `apps/app/src/app/(early-access)/_actions/early-access.ts:190,211,279` | Redis and Clerk API errors with action tags |
| `vendor/observability/src/error/next.ts:20` | `parseError()` utility |

#### Sentry Breadcrumbs

All `addBreadcrumb` usage is in `apps/app` client-side components:
- `answer-interface.tsx` — `"answer-ui"` category for message sends
- `session-activator.tsx` — `"auth"` category for ticket activation
- `oauth-button.tsx` — `"auth"` category for OAuth flow (8 breadcrumb sites)
- `otp-island.tsx` — `"auth"` category for OTP send/verify (12 breadcrumb sites)

#### `startSpan` Usage

Three auth components in `apps/app` use `startSpan` from `@sentry/nextjs`:
- `oauth-button.tsx` — `auth.ticket.create`, `auth.oauth.initiate` spans
- `session-activator.tsx` — `auth.session.activate` span
- `otp-island.tsx` — `auth.otp.send`, `auth.otp.verify` spans

#### Trace Context Helper

`apps/app/src/lib/observability.ts` — `getAuthTraceContext()` extracts `sentryTraceId` and `sentrySpanId` from `getActiveSpan()` for attaching to structured log calls.

### 1.6 Silent Catch Block Inventory

These are catch blocks that either have no logging or discard the error object:

#### `api/platform` Router Layer (no logger imported at all)
| Location | Behavior |
|----------|----------|
| `proxy.ts:210` | 401 retry `buildAuth` failure — `catch { // ignore }` |
| `proxy.ts:232` | `response.json().catch(() => null)` — JSON parse failure |
| `connections.ts:122-143` | Error remapped to TRPCError variants without logging |
| `backfill.ts:254` | `resolveResourceMeta` failure — returns `null`, resource silently skipped |
| `backfill.ts:367` | Probe job failure — returns `{ returnedCount: -1 }` sentinel |

#### `api/platform` Lib Layer
| Location | Behavior |
|----------|----------|
| `token-helpers.ts:111-113` | OAuth `refreshToken()` failure — falls through to `getActiveToken` |
| `token-helpers.ts:125-127` | `getActiveToken()` fallback failure — returns `null` |
| `token-store.ts` | No catches, but no logging either — errors propagate raw |
| `oauth/state.ts` | No catches, no logging — Redis errors propagate raw |

#### `api/platform` Inngest Functions
| Location | Behavior |
|----------|----------|
| `health-check.ts:91` | Token fetch failure — calls `recordTransientFailure()` but discards error |
| `health-check.ts:107` | Health check failure — same pattern, error discarded |
| `delivery-recovery.ts:83` | `extractResourceId` failure — silent, proceeds with `null` |
| `delivery-recovery.ts:138` | Per-delivery processing failure — pushes to `failed[]`, no log |
| `memory-backfill-orchestrator.ts:308-317` | Entity worker invocation failure — aggregated silently |

#### `packages/app-providers` (no logger anywhere)
| Location | Behavior |
|----------|----------|
| `github/index.ts:61-64` | `getInstallationToken` — response body discarded on error |
| `github/index.ts:285-306` | `enrichInstallation` — silent catch, fallback to degraded label |
| `linear/index.ts` (enrichInstallation) | Same silent fallback pattern |
| `sentry/index.ts` (enrichInstallation) | Same silent fallback pattern |
| `vercel/index.ts` (enrichInstallation) | Same silent fallback pattern |

### 1.7 Error Handling Patterns

Five distinct patterns emerge across the codebase:

**Pattern 1: Log-then-throw** — tRPC routers in `api/app` (`organization.ts`, `account.ts`, `connections.ts`, `org-api-keys.ts`) and Inngest functions. A catch block calls `log.error` then throws `TRPCError` or re-throws.

**Pattern 2: Log-and-return** — `lib/activity.ts` functions return `{ success: false, error }` instead of throwing. Callers receive a typed failure value. Also `lib/jobs.ts:getJobByInngestRunId` returns `null`.

**Pattern 3: Sentry-only (no manual log)** — `events.ts` and `jobs.ts` in `api/app` rely solely on `sentryMiddleware` for error capture.

**Pattern 4: Fire-and-forget with `.catch()`** — `lib/activity.ts:recordSystemActivity` uses `inngest.send()` with `.catch(log.warn)` — non-blocking.

**Pattern 5: TRPCError passthrough** — `organization.updateName` checks `if (error instanceof TRPCError) throw error` before wrapping in `INTERNAL_SERVER_ERROR`. `connections.ts:detectConfig` does NOT have this guard, so its `TRPCError` throws get re-wrapped.

### 1.8 Middleware Inventory (Beyond tRPC)

#### Next.js Edge Middleware

| App | File | What it does |
|-----|------|-------------|
| app | `apps/app/src/proxy.ts` | Clerk auth (redirect to /sign-in for unauthed, /account/welcome for pending), microfrontend routing, nosecone security headers |
| platform | `apps/platform/src/middleware.ts` | Nosecone security headers only (no auth — JWT at tRPC level) |
| www | `apps/www/src/middleware.ts` | `@rescale/nemo` composition: pathname propagation header + nosecone CSP |

#### REST Route Auth Wrappers (apps/app)

| Wrapper | File | Used by |
|---------|------|---------|
| `withApiKeyAuth` | `apps/app/src/app/(api)/lib/with-api-key-auth.ts` | Gateway stream, oRPC middleware, dual auth |
| `withDualAuth` | `apps/app/src/app/(api)/lib/with-dual-auth.ts` | Answer API (v1) |
| oRPC `authMiddleware` | `apps/app/src/app/(api)/lib/orpc-middleware.ts` | oRPC router (all routes) |
| CLI JWT verification | `apps/app/src/app/api/cli/lib/verify-jwt.ts` | CLI login/setup endpoints |
| Realtime channel auth | `apps/app/src/app/api/gateway/realtime/route.ts` | SSE channel validation |

#### Webhook Verification (apps/platform)

`apps/platform/src/app/api/ingest/[provider]/route.ts`:
1. Provider guard → header schema validation → raw body capture → provider config lookup
2. `webhookDef.verifySignature` or `deriveVerifySignature(webhookDef.signatureScheme)`
3. HMAC via `@noble/hashes` with timing-safe comparison, Ed25519 via `@noble/ed25519`

#### Rate Limiting

Handled by **Arcjet** via `@vendor/security` (not Upstash Ratelimit):
- `validateEmail`, `shield`, `detectBot`, `slidingWindow(1h/10)`, `slidingWindow(24h/50)`, `fixedWindow(10s/3)`
- Only configured on the early-access action (`apps/app/src/app/(early-access)/_actions/early-access.ts:41-72`)

#### CORS

Only on platform tRPC route (`apps/platform/src/app/api/trpc/[trpc]/route.ts:10-27`):
- Origin check against `appUrl` (from `VERCEL_RELATED_PROJECTS`)
- Sets `Access-Control-Allow-Credentials: true`

### 1.9 Provider Error Handling (`packages/app-providers`)

All provider HTTP calls are raw `fetch()` with `AbortSignal.timeout()`. No shared HTTP client, no shared logger (one `console.error` in Sentry's `exchangeSentryCode`).

**Common pattern:**
```typescript
if (!response.ok) {
  throw new Error(`${Provider} ${operation} failed: ${response.status}`);
}
```
- Response body is NEVER read on error (except Sentry's `exchangeSentryCode` which reads `response.text()`)
- Only the HTTP status code is included in error messages
- GitHub's `getInstallationToken:61-64` is the most impactful case — `401` doesn't distinguish between revoked installation, rotated key, or malformed JWT

**Rate limit parsing** — all five providers implement `parseRateLimit(headers)` returning `{ remaining, resetAt, limit }`. These values are available but NOT consumed within the package itself — callers (proxy, entity-worker) use them for throttling decisions.

---

## Part 2: Innovative Solutions

### 2.1 AsyncLocalStorage Context Propagation

**What it is:** `AsyncLocalStorage` (Node.js built-in, `node:async_hooks`) propagates request-scoped context through all async boundaries without parameter drilling.

**The pattern:**
```typescript
// vendor/observability/src/context.ts
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  userId?: string;
  orgId?: string;
  provider?: string;
  installationId?: string;
  inngestRunId?: string;
  correlationId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
export const getContext = () => requestContext.getStore() ?? {};
```

**Insertion points:**
1. **tRPC middleware** — `requestContext.run({ requestId: crypto.randomUUID(), userId: ctx.auth.userId, orgId: ctx.auth.orgId }, () => next())`
2. **Inngest middleware** — `requestContext.run({ inngestRunId: event.id, correlationId: event.data.correlationId }, () => handler())`
3. **Webhook ingest route** — `requestContext.run({ requestId, provider }, async () => { ... })`

**How the logger consumes it:**
```typescript
// Enhanced log wrapper
export const contextLog = {
  info: (msg: string, meta?: Record<string, unknown>) =>
    log.info(msg, { ...getContext(), ...meta }),
  // ... same for warn, error, debug
};
```

Every log call automatically includes `requestId`, `userId`, `orgId`, `correlationId` without the caller passing them. This eliminates the "which installation? which provider?" question from every production incident.

**Important caveat:** AsyncLocalStorage does NOT propagate through Next.js edge middleware (`middleware.ts`) into App Router route handlers — they run in separate contexts. It works correctly within a single route handler / tRPC procedure chain.

**Sources:** Dash0 guide (Aug 2025), PkgPulse comparison (March 2026), Leapcell guide (Oct 2025), Next.js ALS blog by nico.fyi (June 2025).

### 2.2 Inngest SDK v4 Middleware System

**What changed:** Inngest SDK v4 (March 3, 2026) ships a completely rewritten class-based middleware system. v3 middleware is NOT forward-compatible. Three hook categories:

- **Observable hooks** — `onRunStart`, `onRunComplete`, `onRunError`, `onStepComplete`, `onStepError` — don't affect execution, perfect for logging/metrics
- **Wrapping hooks** — `wrapFunctionHandler`, `wrapStepHandler` — onion model around execution
- **Transform hooks** — `transformFunctionInput`, `transformOutput` — modify data

**Key feature:** Middleware instances are created fresh per request — safe to use instance state without leaks between invocations.

**`@inngest/middleware-sentry` v1.0.0** (March 16, 2026, requires `inngest@>=4.0.0`):
- `onlyCaptureFinalAttempt: true` (default) — only fires Sentry after ALL retries exhausted
- `captureStepErrors: false` (default) — step errors don't create Sentry events
- `disableAutomaticFlush: false` (default) — force-flushes Sentry before serverless termination
- Fixed isolation scope bug (Sentry tags leaking between concurrent runs) via `withIsolationScope`

**Custom observability middleware pattern:**
```typescript
class LoggingMiddleware extends InngestMiddleware {
  onRunStart({ event, function: fn }) {
    log.info(`[${fn.id}] started`, { eventId: event.id, correlationId: event.data.correlationId });
  }
  onRunComplete({ event, function: fn, result }) {
    log.info(`[${fn.id}] completed`, { eventId: event.id, durationMs: result.durationMs });
  }
  onRunError({ event, function: fn, error }) {
    log.error(`[${fn.id}] failed`, { eventId: event.id, error: error.message, attempt: event.attempt });
  }
  onStepComplete({ step }) {
    log.info(`[step] ${step.id} completed`, { durationMs: step.durationMs });
  }
}
```

**Inngest structured logging:** Passing a logger to `new Inngest({ logger: log })` enables automatic enrichment with `runID`, `functionName`, `eventName` if the logger supports `.child()`. The `@logtail/next` logger likely supports child semantics.

**Extended Traces (beta):** `extendedTracesMiddleware` (in `inngest/experimental`) captures OTel spans from within function steps — including Prisma/Drizzle queries, outbound HTTP, and LLM API calls.

**Sources:** Inngest v4 blog (March 3, 2026), Inngest middleware examples docs, Inngest logging guide, npm `@inngest/middleware-sentry` v1.0.0.

### 2.3 tRPC Observability Middleware

The current `timingMiddleware` only logs `path` and `durationMs`. An enhanced version:

```typescript
const observabilityMiddleware = t.middleware(async ({ next, path, ctx, type }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;

  const meta = {
    path,
    type, // "query" | "mutation" | "subscription"
    durationMs,
    ok: result.ok,
    userId: ctx.auth?.type !== "unauthenticated" ? ctx.auth.userId : undefined,
    orgId: ctx.auth?.type === "clerk-active" ? ctx.auth.orgId : undefined,
    caller: ctx.auth?.type === "service" ? ctx.auth.caller : undefined,
  };

  if (result.ok) {
    log.info("[trpc] procedure completed", meta);
  } else {
    log.warn("[trpc] procedure failed", { ...meta, errorCode: result.error?.code });
  }

  return result;
});
```

**BetterStack per-request child logger pattern:** The `@logtail/next` vendor example (found in `node_modules/.pnpm/@logtail+next@0.3.1_.../examples/trpc-app-router/`) shows: `withBetterStack(routeHandler)` wraps the Next.js route to inject `req.log`, then a tRPC middleware extracts `req.log` and calls `.with({...meta})` for a procedure-scoped child logger as `ctx.log`. This differs from the current module-level singleton pattern.

**Sources:** Official tRPC v11 middleware docs, BetterStack tRPC example in node_modules.

### 2.4 OpenTelemetry as Unifying Trace Layer

**Architecture:**
```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│ tRPC         │────▶│ OTel SDK         │────▶│ BetterStack  │
│ middleware   │     │ (spans + logs)   │     │ (OTLP HTTP)  │
├─────────────┤     │                  │     └──────────────┘
│ Inngest      │────▶│ OTLPTraceExporter│
│ middleware   │     │ OTLPLogExporter  │────▶┌──────────────┐
├─────────────┤     │                  │     │ Sentry       │
│ Provider     │────▶│                  │     │ (via SDK)    │
│ fetch calls  │     └──────────────────┘     └──────────────┘
└─────────────┘
```

- BetterStack natively accepts OTLP (HTTP) at `https://<INGESTING_HOST>/v1/{traces,metrics,logs}` with `Authorization: Bearer <SOURCE_TOKEN>`
- No sidecar collector needed — direct export from application
- OTel's Node.js SDK uses AsyncLocalStorage internally for context propagation
- When `@opentelemetry/auto-instrumentations-node` is enabled, it injects `trace_id` and `span_id` into every Pino log line, creating cross-service correlation
- Inngest's `extendedTracesMiddleware` bridges Inngest's native trace system with OTel SDK

**tRPC note:** tRPC has no first-party OTel support. The core team's stance (GitHub Issue #7022, Nov 2025) is to delegate to community middleware. `@baselime/trpc-opentelemetry-middleware` exists but is low-maintenance (3 stars, last commit Dec 2023) — better as reference than dependency.

**Sources:** BetterStack OTel docs, Inngest Extended Traces blog (Nov 2025), Inngest OTel blog (Dec 2025), tRPC Issue #7022.

### 2.5 Error Classification Middleware

**The problem:** Currently all errors are treated equally. A `FORBIDDEN` (expected — user doesn't have access) and an `INTERNAL_SERVER_ERROR` (unexpected — something broke) go through the same logging path.

**tRPC error classification:**
```typescript
const EXPECTED_ERRORS = new Set([
  "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND",
  "BAD_REQUEST", "CONFLICT", "PRECONDITION_FAILED",
]);

// In onError handler:
if (EXPECTED_ERRORS.has(error.code)) {
  log.info("[trpc] expected error", { path, code: error.code });
  // No Sentry
} else {
  log.error("[trpc] unexpected error", { path, code: error.code, error: error.message });
  captureException(error);
}
```

**Inngest error classification:**
- `NonRetriableError` = expected domain condition (missing connection, entity not found, revoked token)
- `Error` (retriable) = transient failure (network timeout, rate limit, DB lock)
- Use `onRunError` with `isFinalAttempt` flag to only Sentry after all retries exhausted

**Sentry noise reduction:** In `Sentry.init()`, add a `beforeSend` callback:
```typescript
beforeSend(event, hint) {
  const err = hint.originalException;
  if (err instanceof TRPCError && EXPECTED_ERRORS.has(err.code)) return null;
  return event;
}
```

**Sources:** Sentry JS SDK Issue #14972 (closed as "by design"), Sentry filtering docs.

### 2.6 Missing Middleware Opportunities

Based on the current architecture, these middleware could be introduced:

#### Request ID / Correlation ID Middleware (tRPC)
Every tRPC request gets a `requestId` (UUID). If the caller passes `x-correlation-id`, it's preserved; otherwise the `requestId` becomes the correlation ID. This flows through AsyncLocalStorage to all downstream log calls.

#### Provider Response Enrichment Middleware
A wrapper around provider `fetch()` calls that:
1. Logs outbound URL (redacted), method, timeout
2. On error response, reads the body (up to 1KB) before throwing
3. Parses and attaches rate limit headers
4. Logs response status and duration

This addresses the #1 gap from the platform logging research — GitHub's error response body being discarded.

#### Circuit Breaker for Provider APIs
No tRPC-native pattern exists, but a `fetch`-level wrapper using `cockatiel` or a custom circuit breaker:
- Track per-provider failure rates
- After N consecutive failures, short-circuit for M seconds
- Log circuit state transitions
- The health-check cron already tracks `healthCheckFailures` — this would be the real-time counterpart

#### tRPC Input Sanitization Middleware
Before Sentry's `attachRpcInput: true` sends inputs, strip known sensitive fields (tokens, passwords, API keys). Currently the full input is attached to Sentry spans.

#### Inngest Correlation ID Propagation Middleware
The `correlationId` field exists on most platform events but propagation is manual. An Inngest middleware could:
1. On `onRunStart`, extract `correlationId` from event data
2. Set it in AsyncLocalStorage
3. On `step.sendEvent`, automatically inject `correlationId` into outgoing events
4. Every log call in the function automatically includes it

---

## Part 3: Architecture Documentation

### Current Observability Stack

```
┌─────────────────────────────────────────────────────────────────┐
│  Production Observability                                        │
│                                                                  │
│  Structured Logs ──▶ BetterStack (Logtail)                      │
│    via @logtail/next                                             │
│    17 files in api/platform, 7 files in api/app                  │
│                                                                  │
│  Error Tracking ──▶ Sentry (@sentry/nextjs)                     │
│    instrumentation.ts (server/edge)                              │
│    instrumentation-client.ts (browser, with replay)              │
│    trpcMiddleware (procedure-level)                               │
│    @inngest/middleware-sentry (function-level)                    │
│    captureException (10 manual call sites)                       │
│    addBreadcrumb (22 call sites, client-only)                   │
│    startSpan (5 call sites, auth components)                    │
│                                                                  │
│  Non-production ──▶ console.* (native)                          │
│    Logger falls back to console when not on Vercel production    │
└─────────────────────────────────────────────────────────────────┘
```

### Error Flow Through the System

```
Provider API error (e.g., GitHub 401)
  │
  ▼
packages/app-providers throws Error("...failed: 401")
  │                        └──▶ response body DISCARDED
  ▼
api/platform/src/router/memory/proxy.ts catches → wraps in TRPCError
  │                                      └──▶ NO logging at this point
  ▼
api/platform/src/trpc.ts errorFormatter sanitizes message in production
  │
  ▼
apps/platform route handler onError
  ├──▶ log.error("[trpc] procedure error", { path, error, code })
  └──▶ captureException(error) if INTERNAL_SERVER_ERROR
  │
  ▼
Client receives: { message: "An unexpected error occurred" }
```

### Middleware Chain Visualization

```
apps/app request flow:
  Edge: clerkMiddleware → microfrontend routing → security headers
  tRPC: sentryMiddleware → timingMiddleware → auth(user/org) → procedure
  REST: withApiKeyAuth / withDualAuth / oRPC authMiddleware → handler
  Inngest: sentryMiddleware() → function handler

apps/platform request flow:
  Edge: security headers only (no auth)
  tRPC: sentryMiddleware → timingMiddleware → auth(service/admin) → procedure
  Webhooks: provider guard → header validation → signature verify → dispatch
  Inngest: sentryMiddleware() → function handler (with optional onFailure)
```

---

## Code References

### Logger Infrastructure
- `vendor/observability/src/log/next.ts` — Logger conditional (BetterStack vs console)
- `vendor/observability/src/log/types.ts` — Logger interface (debug/info/warn/error)
- `vendor/observability/src/error/next.ts` — `parseError()` with Sentry capture
- `vendor/observability/src/sentry.ts` — `@sentry/core` re-exports + `initSentryService()`
- `vendor/observability/src/env/betterstack.ts` — BetterStack env schema
- `vendor/observability/src/env/sentry-env.ts` — Sentry env schema

### tRPC Layer
- `api/app/src/trpc.ts:123-171` — Sentry + timing middleware (app)
- `api/platform/src/trpc.ts:103-124` — Sentry + timing middleware (platform)
- `api/app/src/trpc.ts:104-120` — Error formatter (app)
- `api/platform/src/trpc.ts:85-98` — Error formatter (platform)
- `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts:48-53` — onError handler (app)
- `apps/platform/src/app/api/trpc/[trpc]/route.ts:43-52` — onError handler (platform)

### Router Gaps
- `api/platform/src/router/memory/proxy.ts` — Entire data plane, no logger
- `api/platform/src/router/memory/connections.ts` — Token vault, no logger
- `api/platform/src/router/memory/backfill.ts` — Estimates, no logger
- `api/platform/src/lib/token-helpers.ts:111-113,125-127` — Silent catches
- `api/platform/src/lib/token-store.ts` — Encrypt + DB, no logger
- `api/platform/src/lib/oauth/state.ts` — Redis ops, no logger

### Inngest Infrastructure
- `api/app/src/inngest/client/client.ts` — App Inngest client (sentryMiddleware only)
- `api/platform/src/inngest/client.ts` — Platform Inngest client (sentryMiddleware only)
- `api/platform/src/inngest/on-failure-handler.ts:41-93` — onFailure factory
- `api/platform/src/inngest/functions/health-check.ts:91,107` — Silent catches
- `api/platform/src/inngest/functions/delivery-recovery.ts:83,138` — Silent catches

### Sentry Integration
- `apps/app/src/instrumentation.ts` — Server/edge Sentry init
- `apps/app/src/instrumentation-client.ts` — Browser Sentry init (replay, feedback, token scrub)
- `apps/platform/src/instrumentation.ts` — Platform Sentry init
- `vendor/next/src/config.ts:96-107` — Shared `sentryOptions` for `withSentryConfig`
- `apps/app/src/lib/observability.ts` — `getAuthTraceContext()` span extraction

### Middleware
- `apps/app/src/proxy.ts` — Clerk + MFE + CSP middleware
- `apps/platform/src/middleware.ts` — Nosecone security headers
- `apps/app/src/app/(api)/lib/with-api-key-auth.ts` — API key auth
- `apps/app/src/app/(api)/lib/with-dual-auth.ts` — Dual auth (API key + Clerk)
- `apps/app/src/app/(api)/lib/orpc-middleware.ts` — oRPC auth middleware
- `apps/platform/src/app/api/ingest/[provider]/route.ts` — Webhook verification
- `vendor/security/src/index.ts` — Arcjet rate limiting re-exports

### Provider Error Handling
- `packages/app-providers/src/providers/github/index.ts:61-64` — Response body discarded
- `packages/app-providers/src/providers/sentry/index.ts:61-67` — Only provider that reads error body
- `packages/app-providers/src/runtime/validation.ts:15-22` — Only `console.error` in providers

---

## Related Research

- [`thoughts/shared/research/2026-04-05-platform-logging-gaps.md`](./2026-04-05-platform-logging-gaps.md) — Detailed gap analysis with severity tiers for `api/platform` logging blind spots
- [`thoughts/shared/research/2026-04-05-app-platform-auth-flow.md`](./2026-04-05-app-platform-auth-flow.md) — Full authentication flow documentation

## Web Research Sources

- [tRPC v11 Middleware Docs](https://trpc.io/docs/server/middlewares) — Official middleware pattern
- [tRPC v11 Error Handling](https://trpc.io/docs/server/error-handling) — `onError` hook and error codes
- [tRPC Issue #7022](https://github.com/trpc/trpc/issues/7022) — Core team stance on OTel (community middleware)
- [Inngest SDK v4 Blog](https://www.inngest.com/blog/typescript-sdk-v4.0) — Class-based middleware rewrite (March 3, 2026)
- [Inngest Middleware Examples](https://www.inngest.com/docs/reference/typescript/middleware/examples) — Observable/wrapping/transform hooks
- [Inngest Logging Guide](https://www.inngest.com/docs/guides/logging) — Custom logger with `.child()` enrichment
- [Inngest Extended Traces Blog](https://www.inngest.com/blog/introducing-extended-traces) — OTel span capture (Nov 2025)
- [Inngest OTel Blog](https://www.inngest.com/blog/opentelemetry-nodejs-tracing-express-inngest) — Express + Inngest OTel integration (Dec 2025)
- [`@inngest/middleware-sentry` v1.0.0 on npm](https://www.npmjs.com/package/@inngest/middleware-sentry) — Official Sentry middleware (March 16, 2026)
- [Inngest JS PR #810](https://github.com/inngest/inngest-js/pull/810) — Sentry isolation scope bug fix
- [BetterStack OTel Docs](https://betterstack.com/docs/logs/open-telemetry/) — Native OTLP acceptance
- [Sentry JS SDK Issue #14972](https://github.com/getsentry/sentry-javascript/issues/14972) — tRPC 4xx error filtering
- [Sentry Filtering Docs](https://docs.sentry.io/platforms/javascript/configuration/filtering/) — `beforeSend` pattern
- [Dash0 ALS Guide](https://www.dash0.com/guides/contextual-logging-in-nodejs) — AsyncLocalStorage + OTel (Aug 2025)
- [PkgPulse ALS Comparison](https://www.pkgpulse.com/blog/unctx-vs-asynclocalstorage-vs-cls-hooked-async-context-nodejs-2026) — ALS vs alternatives (March 2026)
- [Next.js ALS Blog](https://www.nico.fyi/blog/async-local-storage-to-prevent-props-drilling) — ALS in Next.js App Router (June 2025)

## Resolved Questions

1. **Inngest SDK version: `^3.52.6` (v3)**. The codebase is on Inngest v3, NOT v4. `@inngest/middleware-sentry` is `^0.1.2` (pre-1.0). The v4 class-based middleware rewrite (March 3, 2026) is a **breaking migration** that would unlock `onRunError`, `onStepComplete`, structured logging with `.child()`, and the new `@inngest/middleware-sentry` v1.0.0 with `onlyCaptureFinalAttempt`. This migration should be planned as a dedicated effort.

2. **`@logtail/next` child logger support**: The vendor example in `node_modules/.pnpm/@logtail+next@0.3.1_.../examples/trpc-app-router/` uses `.with({...meta})` to create per-request scoped loggers. This is the Logtail equivalent of `.child()`. Whether Inngest's v3 logger integration works with `.with()` semantics needs testing.

## Open Questions

1. **Should OpenTelemetry be introduced now or deferred?** OTel unifies traces across tRPC and Inngest, and BetterStack accepts OTLP natively. But it adds a dependency and instrumentation complexity. The simpler AsyncLocalStorage + enhanced middleware approach may deliver 80% of the value at 20% of the cost. (deferred -- needs dedicated research session)

2. **Should the `@vendor/observability/sentry` module be deprecated?** It re-exports `@sentry/core` for Hono edge services that no longer exist (consolidated into `apps/platform`). All live code imports from `@sentry/nextjs` directly. (deferred -- needs dedicated research session)

3. **Is tRPC Issue #7279 (Declared Errors)** worth tracking? A draft PR (March 21, 2026) proposes per-procedure error type inference — would change how expected vs unexpected errors are modeled. (deferred -- needs dedicated research session)
