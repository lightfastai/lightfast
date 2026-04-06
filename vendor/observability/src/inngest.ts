import "server-only";

import {
  flush,
  SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN,
  SEMANTIC_ATTRIBUTE_SENTRY_SOURCE,
  startSpanManual,
  withActiveSpan,
  withIsolationScope,
} from "@sentry/core";
import { InngestMiddleware, NonRetriableError } from "@vendor/inngest";

import type { JournalEntry } from "./context";
import { createStore, requestStore } from "./context";
import { log } from "./log/next";

const MAX_JOURNAL_ENTRIES = 50;

/**
 * Extracts common context fields from Inngest event data.
 * Filters out undefined values so ALS context stays clean.
 */
function extractEventContext(
  data: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!data) {
    return {};
  }

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
 * - Hooks access `store` via closure, NOT via ALS (`getJournal`/`pushJournal`).
 *   Inngest wraps hooks in `waterfall`/`cacheFn` which creates promise chains
 *   that break `AsyncLocalStorage` propagation. `getStore()` returns undefined
 *   inside hooks even after `enterWith`. Direct store access via closure is
 *   reliable regardless of async context boundaries.
 *
 * - ALS is seeded in `beforeMemoization` via `requestStore.enterWith()` for
 *   the benefit of USER function code — `log.*` calls inside Inngest functions
 *   automatically get context enrichment. The middleware hooks themselves don't
 *   depend on ALS.
 *
 * - Hooks run outside `withIsolationScope`'s async context, so we use
 *   `scope.captureException()` (via closure) instead of the global
 *   `captureException` to ensure errors are captured in the correct
 *   isolation scope. (Matches `@inngest/middleware-sentry`'s pattern.)
 */
export function createInngestObservabilityMiddleware() {
  return new InngestMiddleware({
    name: "lightfast:observability",

    init() {
      return {
        onFunctionRun({ ctx, fn }) {
          const fnId = fn.id();
          const eventData = (ctx.event?.data as Record<string, unknown>) ?? {};
          const eventContext = extractEventContext(eventData);

          // Generate correlationId from runId for cron functions with no event data
          const correlationId =
            (eventContext.correlationId as string | undefined) ?? ctx.runId;

          const alsContext = {
            requestId: ctx.runId,
            inngestFunctionId: fnId,
            inngestEventName: ctx.event?.name,
            ...eventContext,
            correlationId,
          };

          const startTime = Date.now();
          let execStartTime: number | undefined;

          // Create store eagerly; ALS is seeded in beforeMemoization for user code.
          // Hooks access store via closure (see architecture note above).
          const store = createStore(
            alsContext as { requestId: string } & Record<string, unknown>
          );

          /** Push a journal entry directly to the store (bypasses ALS). */
          function journal(
            level: JournalEntry["level"],
            msg: string,
            meta?: Record<string, unknown>
          ) {
            if (store.journal.length < MAX_JOURNAL_ENTRIES) {
              store.journal.push({ ts: Date.now(), level, msg, meta });
            }
          }

          journal("info", "function:start");

          // Wrap in Sentry isolation scope (synchronous — matches sentryMiddleware)
          return withIsolationScope((scope) => {
            scope.setTag("inngest.function.id", fnId);
            scope.setTag("inngest.run.id", ctx.runId);
            if (ctx.event?.name) {
              scope.setTag("inngest.event.name", ctx.event.name);
            }

            // startSpanManual: span lives until explicit .end() in beforeResponse
            return startSpanManual(
              {
                name: `inngest/${fnId}`,
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
                // Add Sentry trace ID to store for log correlation
                const traceId = reqSpan.spanContext().traceId;
                if (traceId) {
                  store.ctx = { ...store.ctx, traceId };
                }

                return {
                  // Seed ALS for user function code. enterWith may not propagate
                  // to hooks (due to waterfall/cacheFn promise chains) but it
                  // DOES propagate to the user function executed via runAsPromise.
                  beforeMemoization() {
                    requestStore.enterWith(store);
                  },

                  beforeExecution() {
                    execStartTime = Date.now();
                    journal("info", "execution:start");
                  },

                  afterExecution() {
                    const execMs = execStartTime
                      ? Date.now() - execStartTime
                      : undefined;
                    journal("info", "execution:done", {
                      ...(execMs !== undefined && { durationMs: execMs }),
                    });
                  },

                  transformOutput({ result, step: stepInfo }) {
                    const durationMs = Date.now() - startTime;
                    const err = result.error;

                    if (err) {
                      const isBusinessError = err instanceof NonRetriableError;
                      const errorMessage =
                        err instanceof Error ? err.message : String(err);

                      journal("error", "function:error", {
                        error: errorMessage,
                        durationMs,
                        isBusinessError,
                      });

                      reqSpan.setStatus({ code: 2 }); // error

                      if (isBusinessError) {
                        // Business rejections (filtered event, no connection, etc.)
                        // are expected outcomes — log at info level, skip Sentry.
                        log.info(`[inngest] ${fnId} rejected`, {
                          durationMs,
                          error: errorMessage,
                          ...(stepInfo && { stepName: stepInfo.name }),
                        });
                      } else {
                        // Unexpected errors: capture to Sentry with enriched context
                        withActiveSpan(reqSpan, () => {
                          scope.setTag("inngest.function.id", fnId);
                          scope.setTag("inngest.run.id", ctx.runId);
                          scope.setTransactionName(`inngest:${fnId}`);
                        });

                        scope.setExtra("durationMs", durationMs);
                        scope.setExtra("correlationId", correlationId);

                        // Unwrap cause for better Sentry grouping
                        const reportedError =
                          err instanceof Error && err.cause instanceof Error
                            ? err.cause
                            : err;

                        // Use scope.captureException (not global) — hooks run
                        // outside withIsolationScope's async context
                        scope.captureException(reportedError, {
                          mechanism: {
                            handled: false,
                            type: "auto.function.inngest.middleware",
                          },
                        });

                        log.error(`[inngest] ${fnId} failed`, {
                          durationMs,
                          error: errorMessage,
                          ...(stepInfo && { stepName: stepInfo.name }),
                        });
                      }
                    } else {
                      reqSpan.setStatus({ code: 1 }); // ok

                      journal("info", "function:done", { durationMs });
                      log.info(`[inngest] ${fnId} completed`, {
                        durationMs,
                        steps: store.journal.length,
                      });
                    }

                    // Emit full journal as single structured log
                    if (store.journal.length > 0) {
                      log.info(`[inngest] ${fnId} journal`, {
                        durationMs,
                        entryCount: store.journal.length,
                        entries: store.journal,
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
