# Inngest Observability Middleware Implementation Plan

## Overview

Create a unified `InngestMiddleware` that replaces `@inngest/middleware-sentry` and provides three capabilities in a single middleware: ALS context seeding, unified Sentry integration (isolation scope + spans + selective error capture), and automatic step journaling via lifecycle hooks. Then strip all manual bookkeeping from the 12 Inngest function files in a follow-up PR.

## Current State Analysis

### What exists

- **Two Inngest clients** (`api/platform/src/inngest/client.ts`, `api/app/src/inngest/client/client.ts`) — identical structure, each with `middleware: [sentryMiddleware()]` from `@inngest/middleware-sentry@0.1.3`
- **12 Inngest functions** (11 platform, 1 app) — all import `log` from `@vendor/observability/log/next` and manually pass context fields (`correlationId`, `provider`, `clerkOrgId`, `installationId`) at every `log.*` call site
- **ALS infrastructure** in `@vendor/observability` — `requestStore` (`context.ts:28`), `withRequestContext` (`request.ts:17`), `getContext`/`pushJournal` (`context.ts:35-53`), `emitJournal` (`request.ts:32`), auto-enriching `log` (`log/next.ts:13-17`)
- **tRPC observability middleware** (`trpc.ts:41-151`) — reference pattern that consolidates Sentry + ALS + journal into one middleware
- **`InngestMiddleware`** re-exported from `vendor/inngest/src/index.ts:4` — available but never instantiated
- **`createNeuralOnFailureHandler`** (`on-failure-handler.ts`) — used by 3 platform functions for failure logging + job status updates

### The problem

- `getContext()` returns `{}` for all Inngest functions — no ALS scope is active
- Every `log.*` call manually repeats 3-5 context fields (~100 manual field-passing sites across 12 functions)
- ~24 manual bookend logs (`started`/`complete`) that the middleware can emit automatically
- `@inngest/middleware-sentry` captures ALL errors via `captureException` — including `NonRetriableError` business rejections that are not bugs
- No cross-function distributed tracing — each function run is an isolated Sentry transaction
- Function tag prefixes like `[ingest-delivery]` in every log message are redundant once `inngestFunctionId` is in ALS

### Sentry APIs (verified in `@sentry/core@10.42.0`)

From `@sentry/core` index exports:
- `getActiveSpan`, `startSpanManual`, `withIsolationScope`, `withActiveSpan`, `captureException` — already used in tRPC middleware or `sentryMiddleware`
- `flush` from `@sentry/core` — for serverless flush
- `continueTrace`, `spanToTraceHeader`, `spanToBaggageHeader` — for distributed tracing (deferred to follow-up plan)

## Desired End State

After this plan is complete:

1. **One middleware** in `vendor/observability/src/inngest.ts` provides ALS context, Sentry spans, and step journal for all Inngest functions
2. **`@inngest/middleware-sentry` dependency is removed** from both client files and `package.json`
3. **Every `log.*` call inside Inngest functions auto-enriches** with `requestId`, `inngestFunctionId`, `inngestEventName`, `correlationId`, `provider`, `clerkOrgId`, `installationId`, and Sentry `traceId`
4. **Step journal** automatically records executed steps (not memoized replays) via `beforeExecution`/`afterExecution` lifecycle hooks
5. **Manual bookend logs removed** — middleware logs function start/end automatically (Phase 3, separate PR)
6. **Manual context field threading removed** — fields come from ALS (Phase 3, separate PR)
7. **Sentry error classification** — only unexpected errors are captured; `NonRetriableError` is skipped
8. **`onFailure` handlers** — automatically get ALS context; no factory changes needed

### Verification

- `pnpm check && pnpm typecheck` passes
- `pnpm build:app && pnpm build:platform` passes
- Trigger a webhook via `pnpm dev:platform` → confirm structured journal log appears with all context fields
- Confirm Sentry shows per-function spans with `inngest/` prefix
- Confirm `NonRetriableError` throws do NOT appear in Sentry

## What We're NOT Doing

- **Distributed Sentry tracing** — deferred to follow-up plan. `correlationId` provides cross-function correlation today. `_trace` injection via `onSendEvent` + `continueTrace` adds payload pollution risk and complexity for marginal Sentry UI benefit. Ship the middleware first; add distributed tracing once it's proven.
- **Client-side console cleanup** (Item 6) — deferred; `captureConsoleIntegration` covers `console.error`
- **Inngest v4 upgrade** (Item 7) — separate concern
- **Reworking `createNeuralOnFailureHandler`** — it still handles job status updates; ALS automatically enriches its `log.error` calls. No code changes needed.
- **Wrapping `step.sleep`/`step.sleepUntil`/`step.waitForEvent`** — passive operations, not worth journaling
- **`emitJournal` generalization** — `request.ts:39` hardcodes `[trpc]` prefix. The Inngest middleware emits journal inline. Generalizing `emitJournal` to accept a prefix is a separate cleanup.

---

## Phase 1: Create the Observability Middleware

### Overview

Create `vendor/observability/src/inngest.ts` — the unified middleware. Add export path. Add `@vendor/inngest` as a dependency of `@vendor/observability`.

**Dependency note**: Adding `@vendor/inngest` → `@vendor/observability` creates a new cross-vendor edge. `@vendor/inngest` must NEVER import from `@vendor/observability` (would create a cycle). This is acceptable because `@vendor/inngest` is a pure re-export layer with no business logic.

### Changes Required

#### 1. New file: `vendor/observability/src/inngest.ts`

**File**: `vendor/observability/src/inngest.ts`

```ts
import "server-only";

import { InngestMiddleware, NonRetriableError } from "@vendor/inngest";
import {
  captureException,
  flush,
  getActiveSpan,
  SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN,
  SEMANTIC_ATTRIBUTE_SENTRY_SOURCE,
  startSpanManual,
  withActiveSpan,
  withIsolationScope,
} from "@sentry/core";

import { createStore, getJournal, pushJournal, requestStore } from "./context";
import { log } from "./log/next";

/**
 * Extracts common context fields from Inngest event data.
 * Filters out undefined values so ALS context stays clean.
 */
function extractEventContext(
  data: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!data) return {};

  const fields: Record<string, unknown> = {
    correlationId: data.correlationId,
    provider: data.provider,
    clerkOrgId: data.clerkOrgId ?? data.orgId,
    installationId: data.installationId,
  };

  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined)
  );
}

/**
 * Creates the unified Inngest observability middleware.
 *
 * Consolidates three capabilities into a single middleware:
 * 1. ALS context seeding — auto-enriches all `log.*` calls
 * 2. Sentry integration — isolation scope, manual spans, selective error capture
 * 3. Step journal — records executed steps via beforeExecution/afterExecution hooks
 *
 * Replaces `@inngest/middleware-sentry`.
 *
 * Architecture notes:
 * - Uses `startSpanManual` (not `startSpan`) because the span must live across
 *   multiple lifecycle hooks. `startSpan` auto-ends when its callback returns,
 *   which would close the span immediately after hook registration (~0ms).
 *   `startSpanManual` requires explicit `.end()` in `beforeResponse`.
 *   (Matches the pattern in `@inngest/middleware-sentry`.)
 *
 * - Uses `requestStore.enterWith()` instead of `requestStore.run()` because
 *   Inngest middleware returns a hooks object that is invoked at different
 *   lifecycle points — there's no single callback to wrap with `.run()`.
 *   Cleanup is guaranteed by the serverless request boundary (each Inngest
 *   function run is a separate HTTP request). This diverges from the tRPC
 *   middleware's `withRequestContext()` pattern, which is possible because
 *   tRPC has a single `next()` callback to wrap.
 */
export function createInngestObservabilityMiddleware() {
  return new InngestMiddleware({
    name: "lightfast:observability",

    init() {
      return {
        onFunctionRun({ ctx, fn }) {
          const eventData =
            (ctx.event?.data as Record<string, unknown>) ?? {};
          const eventContext = extractEventContext(eventData);

          // Generate correlationId from runId for cron functions with no event data
          const correlationId =
            eventContext.correlationId ?? ctx.runId;

          const alsContext = {
            requestId: ctx.runId,
            inngestFunctionId: fn.id,
            inngestEventName: ctx.event?.name,
            ...eventContext,
            correlationId,
          };

          const startTime = Date.now();
          let execStartTime: number | undefined;

          // Wrap everything in a Sentry isolation scope (synchronous — matches sentryMiddleware)
          return withIsolationScope((scope) => {
            scope.setTag("inngest.function.id", fn.id);
            scope.setTag("inngest.run.id", ctx.runId);
            if (ctx.event?.name) {
              scope.setTag("inngest.event.name", ctx.event.name);
            }

            // startSpanManual: span lives until explicit .end() in beforeResponse
            return startSpanManual(
              {
                name: `inngest/${fn.id}`,
                op: "function.inngest",
                attributes: {
                  [SEMANTIC_ATTRIBUTE_SENTRY_SOURCE]: "route",
                  [SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]:
                    "auto.function.inngest.middleware",
                  "inngest.run.id": ctx.runId,
                  "inngest.event.name": ctx.event?.name ?? "unknown",
                },
                scope,
              },
              (reqSpan) => {
                // Extract Sentry trace ID for log correlation
                const traceId = reqSpan.spanContext().traceId;

                // Seed ALS context via enterWith (see architecture note above)
                const store = createStore({
                  ...alsContext,
                  ...(traceId && { traceId }),
                } as { requestId: string } & Record<string, unknown>);
                requestStore.enterWith(store);

                pushJournal("info", "function:start");

                return {
                  // Journal executed steps only (not memoized replays).
                  // Inngest calls beforeExecution/afterExecution only for
                  // steps that actually run new code — memoized steps skip these.
                  beforeExecution() {
                    execStartTime = Date.now();
                    pushJournal("info", "execution:start");
                  },

                  afterExecution() {
                    const execMs = execStartTime
                      ? Date.now() - execStartTime
                      : undefined;
                    pushJournal("info", "execution:done", {
                      ...(execMs !== undefined && { durationMs: execMs }),
                    });
                  },

                  transformOutput({ result, step: stepInfo }) {
                    const durationMs = Date.now() - startTime;
                    const journal = getJournal();

                    if (result.error) {
                      const isBusinessError =
                        result.error instanceof NonRetriableError;

                      pushJournal("error", "function:error", {
                        error: result.error.message,
                        durationMs,
                        isBusinessError,
                      });

                      // Only capture unexpected errors to Sentry.
                      // NonRetriableError = business rejection (filtered event, no connection, etc.)
                      if (!isBusinessError) {
                        withActiveSpan(reqSpan, (activeScope) => {
                          activeScope.setTags({
                            "inngest.function.id": fn.id,
                            "inngest.run.id": ctx.runId,
                          });
                          activeScope.setTransactionName(
                            `inngest:${fn.id}`
                          );
                        });

                        scope.setExtra("durationMs", durationMs);
                        scope.setExtra("correlationId", correlationId);

                        // Unwrap cause for better Sentry grouping
                        const reportedError =
                          result.error.cause instanceof Error
                            ? result.error.cause
                            : result.error;

                        captureException(reportedError, {
                          mechanism: {
                            handled: false,
                            type: "auto.function.inngest.middleware",
                          },
                        });
                      }

                      reqSpan.setStatus({ code: 2 }); // error

                      log.error(`[inngest] ${fn.id} failed`, {
                        durationMs,
                        isBusinessError,
                        error: result.error.message,
                        ...(stepInfo && { stepName: stepInfo.name }),
                      });
                    } else {
                      reqSpan.setStatus({ code: 1 }); // ok

                      pushJournal("info", "function:done", { durationMs });
                      log.info(`[inngest] ${fn.id} completed`, {
                        durationMs,
                        steps: journal.length,
                      });
                    }

                    // Emit full journal as single structured log
                    if (journal.length > 0) {
                      log.info(`[inngest] ${fn.id} journal`, {
                        durationMs,
                        entryCount: journal.length,
                        entries: journal,
                      });
                    }
                  },

                  async beforeResponse() {
                    reqSpan.end();
                    await flush(2000);
                  },
                };
              }
            );
          });
        },
      };
    },
  });
}
```

#### 2. Add export path to `vendor/observability/package.json`

**File**: `vendor/observability/package.json`

Add to `exports`:
```json
"./inngest": {
  "types": "./src/inngest.ts",
  "default": "./src/inngest.ts"
}
```

#### 3. Add `@vendor/inngest` dependency to `vendor/observability/package.json`

**File**: `vendor/observability/package.json`

Add to `dependencies`:
```json
"@vendor/inngest": "workspace:*"
```

**Note**: The new `inngest.ts` file imports directly from `@sentry/core` (matching the pattern in `trpc.ts:4-11`). No changes to `vendor/observability/src/sentry.ts` — that file is for Hono edge services, and adding unused re-exports would be dead code.

### Success Criteria

#### Automated Verification

- [x] `pnpm check` passes (no lint errors in new file)
- [x] `pnpm typecheck` passes (new middleware type-checks)
- [x] `pnpm build:app` passes
- [x] `pnpm build:platform` passes

#### Manual Verification

- [x] New file exists at `vendor/observability/src/inngest.ts`
- [x] Export path `./inngest` is in `vendor/observability/package.json`
- [x] `@vendor/inngest` is in `vendor/observability` dependencies

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Wire Middleware into Inngest Clients

### Overview

Replace `sentryMiddleware()` with `createInngestObservabilityMiddleware()` in both Inngest clients. Remove `@inngest/middleware-sentry` dependency.

### Changes Required

#### 1. Update platform client

**File**: `api/platform/src/inngest/client.ts`

```ts
// Before:
import { sentryMiddleware } from "@inngest/middleware-sentry";
import { EventSchemas, Inngest } from "@vendor/inngest";
import { env } from "@vendor/inngest/env";
import type { GetEvents } from "inngest";

import { platformEvents } from "./schemas/platform";

const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromSchema(platformEvents),
  middleware: [sentryMiddleware()],
});

// After:
import { EventSchemas, Inngest } from "@vendor/inngest";
import { env } from "@vendor/inngest/env";
import { createInngestObservabilityMiddleware } from "@vendor/observability/inngest";
import type { GetEvents } from "inngest";

import { platformEvents } from "./schemas/platform";

const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromSchema(platformEvents),
  middleware: [createInngestObservabilityMiddleware()],
});
```

#### 2. Update app client

**File**: `api/app/src/inngest/client/client.ts`

Same transformation — replace `sentryMiddleware()` import and usage with `createInngestObservabilityMiddleware()`.

#### 3. Remove `@inngest/middleware-sentry` dependency

Remove from:
- `api/platform/package.json`
- `api/app/package.json` (or root `package.json` if hoisted)

Run `pnpm install` to update lockfile.

#### 4. Add `@vendor/observability` dependency to API packages (if not already present)

Verify that both `api/platform/package.json` and `api/app/package.json` include `@vendor/observability: "workspace:*"` in their dependencies (they likely already do since they import `log`).

### Success Criteria

#### Automated Verification

- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes
- [x] `pnpm build:app` passes
- [x] `pnpm build:platform` passes
- [x] No remaining imports of `@inngest/middleware-sentry` in the codebase

#### Manual Verification

- [ ] Run `pnpm dev:platform` → trigger a webhook → confirm log output includes `requestId`, `inngestFunctionId`, `correlationId`, `traceId` fields (from ALS)
- [ ] Confirm step journal log appears with `function:start`, `execution:start/done`, `function:done` entries
- [ ] Confirm Sentry shows spans named `inngest/platform/ingest.delivery` etc., with span status ok/error
- [ ] Trigger a `NonRetriableError` path (e.g., webhook with no matching connection) → confirm it does NOT appear in Sentry as an exception
- [ ] Trigger a real error → confirm it DOES appear in Sentry with correct tags
- [ ] Trigger a function failure → confirm `onFailure` log includes `requestId` and `inngestFunctionId` from ALS (the middleware seeds ALS for `inngest/function.failed` events too). Confirm job status is still updated correctly.

**Implementation Note**: Phases 1 and 2 ship as a single PR. After completing this phase and all verification passes, Phase 3 ships as a separate follow-up PR to reduce blast radius.

---

## Phase 3: Strip Manual Bookkeeping from Functions (Separate PR)

### Overview

Remove redundant manual logging from all 12 Inngest functions. Ships as a **separate follow-up PR** after Phase 1+2 are merged and verified. This reduces blast radius — if the middleware has issues, the manual logging is still in place as a safety net.

### Cleanup Rules

For each of the 12 Inngest function files, apply these rules mechanically:

1. **Remove manual bookend logs** (`started`, `complete`, `done`) — middleware handles these automatically via `function:start`/`function:done` journal entries and structured lifecycle logs.

2. **Remove ALS-provided fields from remaining `log.*` calls** — these fields come from ALS automatically and no longer need to be passed manually:
   - `correlationId`
   - `provider`
   - `clerkOrgId` / `orgId`
   - `installationId`
   - `inngestFunctionId` (was never passed manually, but now available)

3. **Keep only business-specific fields** — fields that are step-local or decision-specific:
   - `deliveryId`, `eventType`, `ingestLogId`, `observationId`, `externalId`, etc.
   - Skip/filter/gate reasons
   - Error details

4. **Remove `[function-tag]` prefixes** from log messages — `inngestFunctionId` in ALS makes them redundant. Change `"[ingest-delivery] connection resolved"` → `"connection resolved"`.

5. **Keep decision-point logs** — logs that document business logic decisions (skip, filter, gate) should stay, just without redundant fields.

### Cron Function Caveat

For cron-triggered functions (`health-check`, `token-refresh`, `delivery-recovery`), the ALS context only contains `requestId` (= `runId`) and `inngestFunctionId`. There is no event data, so no `correlationId`, `provider`, `clerkOrgId`, or `installationId` from ALS. However, the middleware generates `correlationId` from `runId` so that field IS available.

Per-iteration fields like `installationId` and `provider` must remain as manual log fields in these functions because they change on each loop iteration within a single function run.

### Scope

- **11 platform functions**: `ingest-delivery.ts`, `platform-event-store.ts`, `platform-entity-graph.ts`, `platform-entity-embed.ts`, `platform-notification-dispatch.ts`, `platform-backfill-orchestrator.ts`, `platform-entity-worker.ts`, `connection-lifecycle.ts`, `health-check.ts`, `token-refresh.ts`, `delivery-recovery.ts`
- **1 app function**: `record-activity.ts`

### Success Criteria

#### Automated Verification

- [ ] `pnpm check` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build:app` passes
- [ ] `pnpm build:platform` passes
- [ ] `grep -r "\[ingest-delivery\]\|\[event-store\]\|\[entity-graph\]\|\[entity-embed\]" api/platform/src/inngest/functions/` returns no matches (tag prefixes removed)

#### Manual Verification

- [ ] Trigger webhook pipeline → confirm logs are cleaner (no redundant fields, no manual bookends)
- [ ] Confirm business-decision logs still appear with their specific fields
- [ ] Confirm cron function logs still include per-iteration fields

---

## Testing Strategy

### Integration Testing

1. **Webhook pipeline**: Send a test webhook via ngrok → verify full pipeline executes with:
   - Structured journal log for each function
   - ALS context fields on all log calls
   - Per-function Sentry spans with `inngest/` prefix and correct status (ok/error)

2. **Error paths**:
   - `NonRetriableError` (e.g., `no_connection`) → should NOT appear in Sentry
   - Real error (e.g., database timeout) → should appear in Sentry with correct tags and `.cause` unwrapping
   - Function retry → confirm ALS reseeded on each attempt (new `runId` per retry)

3. **Cron functions**: Wait for next 5-minute cycle → confirm health-check, token-refresh, delivery-recovery log with `requestId` and `inngestFunctionId` from ALS, and per-iteration fields still present

4. **`onFailure` handler**: Trigger a function failure → confirm `onFailure` log includes ALS context. Confirm job status updated correctly.

### Manual Testing Steps

1. Start dev servers: `pnpm dev:full`
2. Trigger a GitHub webhook (or use ngrok replay)
3. Check platform logs for structured journal entries with `function:start`, `execution:start/done`, `function:done`
4. Check Sentry for `inngest/` spans with correct status
5. Trigger a NonRetriableError path → verify Sentry does NOT capture it
6. Force a real error (e.g., disconnect DB) → verify Sentry captures it with unwrapped cause

## Performance Considerations

- **`enterWith` vs `run`**: `enterWith` is slightly less safe than `requestStore.run()` because it doesn't auto-cleanup. However, each Inngest function run is a separate execution context (HTTP request), so the store is naturally garbage-collected when the request ends. See architecture note in the middleware JSDoc for full rationale.
- **`Sentry.flush(2000)`**: 2-second timeout in `beforeResponse`. This matches the Inngest middleware-sentry default. In practice, flush completes in <100ms unless the network is degraded.
- **Journal cap**: `MAX_JOURNAL_ENTRIES = 50` (defined in `context.ts:5`). Functions with many steps (backfill orchestrator with fan-out) may hit this cap. The cap is fine — the journal captures the first 50 entries which covers the critical path.

## Migration Notes

- **No schema changes** — purely application-layer middleware change.
- **No database changes** — purely application-layer change.
- **Rollback**: If the middleware causes issues, revert to `sentryMiddleware()` by changing two client files. Phase 3 (cleanup) ships separately, so the manual logging safety net remains until it's proven.
- **Middleware ordering**: The observability middleware should be the ONLY middleware. If other middleware is added later, `createInngestObservabilityMiddleware()` should be first in the array (runs outermost).
- **PR strategy**: Phases 1+2 ship as one PR. Phase 3 ships as a separate follow-up PR.

## References

- Research: `thoughts/shared/research/2026-04-05-observability-remaining-work-inventory.md` — Items 1-6 inventory
- tRPC reference pattern: `vendor/observability/src/trpc.ts:41-151` — consolidated Sentry + ALS + journal
- ALS infrastructure: `vendor/observability/src/context.ts`, `vendor/observability/src/request.ts`
- Inngest middleware types: `node_modules/inngest/components/InngestMiddleware.d.ts` — `onFunctionRun`, `beforeExecution`/`afterExecution`, `startSpanManual`
- Existing `sentryMiddleware` source: `@inngest/middleware-sentry@0.1.3` — `startSpanManual` + `reqSpan.end()` pattern, `beforeMemoization`/`afterMemoization`/`beforeExecution`/`afterExecution` hooks

---

## Improvement Log

Changes made during adversarial review (2026-04-06):

### Critical fixes

1. **`startSpan` → `startSpanManual`** — The original plan used `startSpan(opts, callback)` which auto-ends the span when the callback returns. Since the callback returns the hooks object (not the function result), the span would cover ~0ms. Fixed to use `startSpanManual` with explicit `reqSpan.end()` in `beforeResponse`, matching the pattern in `@inngest/middleware-sentry`.

2. **Step Proxy replaced with `beforeExecution`/`afterExecution` hooks** — The Proxy-based step instrumentation would fire for both memoized (cached) and executed steps, producing misleading journal entries for replayed functions. Inngest provides `beforeExecution`/`afterExecution` lifecycle hooks that fire only for actually-executed steps. The Proxy is deleted; lifecycle hooks are used instead. This also eliminates the only `Proxy` usage pattern in the middleware and the risk of type mismatches with step method signatures.

3. **`enterWith` documented** — The codebase exclusively uses `requestStore.run()` via `withRequestContext()`. The Inngest middleware must use `enterWith` because the hooks-based lifecycle doesn't offer a single callback to wrap. Added detailed architecture notes in the JSDoc explaining the divergence and the cleanup guarantee (serverless request boundary).

### Scope reductions

4. **Distributed tracing deferred** — `onSendEvent` + `continueTrace` + `_trace` payload injection removed from this plan. `correlationId` already provides cross-function correlation. Distributed Sentry tracing adds complexity (payload pollution, hidden contracts on event data shape) for marginal Sentry UI benefit. Ship the middleware first; add distributed tracing in a follow-up once it's proven.

5. **Phase 3 moved to separate PR** — The 12-file logging cleanup is lower risk when the middleware is already proven in production. Shipping it separately means the manual logging safety net stays in place until confidence is established.

6. **Phase 4 absorbed into Phase 2** — The `onFailure` analysis concluded no code changes are needed. The verification is now a checklist item in Phase 2's manual verification section.

7. **Phase 1 step 4 deleted** — Adding `sentry.ts` re-exports that the middleware doesn't import is dead code. The middleware imports directly from `@sentry/core`, matching the tRPC middleware pattern.

### Structural improvements

8. **Span status set** — Added `reqSpan.setStatus({ code: 1 })` (ok) and `reqSpan.setStatus({ code: 2 })` (error) in `transformOutput`, matching `sentryMiddleware`'s behavior.

9. **`withActiveSpan` for error capture** — Error capture now uses `withActiveSpan(reqSpan, ...)` to ensure Sentry tags are set in the correct span context, matching `sentryMiddleware`'s pattern.

10. **Synchronous `withIsolationScope`** — Changed from `async` callback to synchronous, matching `sentryMiddleware`'s pattern. The `onFunctionRun` return type is `MaybePromise<...>` so both work, but synchronous matches the reference implementation.

11. **Circular dependency risk noted** — Added note about `@vendor/observability` → `@vendor/inngest` dependency constraint.

12. **Per-file line-number instructions removed from Phase 3** — Replaced with rules-based cleanup instructions. Line numbers drift with every rebase; the 5 cleanup rules are sufficient for the implementer.
