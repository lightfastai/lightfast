import "server-only";

import { ORPCError } from "@orpc/client";
import {
  captureException,
  getActiveSpan,
  SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN,
  SEMANTIC_ATTRIBUTE_SENTRY_SOURCE,
  startSpan,
  withIsolationScope,
} from "@sentry/core";

import { log } from "./log/next";
import { withRequestContext } from "./request";

/**
 * Create an oRPC observability middleware that consolidates:
 * - Sentry isolation scope + span creation
 * - Error classification via ORPCError.status
 * - Selective Sentry capture (server errors only)
 * - Structured logging with trace ID correlation
 * - ALS request context seeding (requestId + traceId)
 * - Request journal emission
 *
 * Follows the same pattern as createObservabilityMiddleware in trpc.ts.
 *
 * Key differences from tRPC middleware:
 * - oRPC errors propagate as thrown exceptions (not result.ok/error)
 * - ORPCError has .status directly (no getHTTPStatusCodeFromError needed)
 * - path is readonly string[] (joined with "." for span names)
 * - Auth fields are enriched by downstream auth middleware via enrichContext(),
 *   then read back from the enriched ctx returned by withRequestContext
 */
export function createORPCObservabilityMiddleware() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC's Middleware generic is parameterized by the full procedure chain; the cast at the call site bridges the two type systems.
  return async ({ context, next, path }: any) => {
    const { requestId } = context as { requestId: string };
    const procedurePath = (path as readonly string[]).join(".");

    return withIsolationScope(async (scope) => {
      scope.setContext("orpc", { procedure_path: procedurePath });

      return startSpan(
        {
          name: `orpc/${procedurePath}`,
          op: "rpc.server",
          attributes: {
            [SEMANTIC_ATTRIBUTE_SENTRY_SOURCE]: "route",
            [SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: "auto.rpc.orpc",
          },
        },
        async () => {
          const span = getActiveSpan();
          const traceId = span?.spanContext().traceId;

          // Catch errors inside withRequestContext so we still get journal + durationMs.
          // oRPC errors propagate as thrown exceptions (unlike tRPC's result.ok pattern).
          const {
            result,
            journal,
            durationMs,
            ctx: enrichedCtx,
          } = await withRequestContext(
            { requestId, ...(traceId && { traceId }) },
            async () => {
              try {
                const value = await next();
                return { ok: true as const, value };
              } catch (error) {
                return { ok: false as const, error };
              }
            }
          );

          // Spread enriched context — includes base fields (requestId, traceId)
          // plus auth fields added by downstream enrichContext() (userId, clerkOrgId, authType)
          const meta = {
            path: procedurePath,
            durationMs,
            ...enrichedCtx,
          };

          if (result.ok) {
            log.info("[orpc] ok", { ...meta, ok: true });
            if (journal.length > 0) {
              log.info("[orpc] request journal", {
                path: procedurePath,
                durationMs,
                ok: true,
                entryCount: journal.length,
                entries: journal,
              });
            }
            return result.value;
          }

          // -- Error classification (mirrors trpc.ts:116-141) --
          const error = result.error;
          const isKnown = error instanceof ORPCError;
          const httpStatus = isKnown ? error.status : 500;
          const errorCode = isKnown ? error.code : "INTERNAL_SERVER_ERROR";

          if (httpStatus >= 500) {
            log.error("[orpc] server error", { ...meta, ok: false, errorCode });

            scope.setTag("orpc.path", procedurePath);
            scope.setTag("orpc.error_code", errorCode);
            scope.setExtra("durationMs", durationMs);
            scope.setExtra("requestId", requestId);

            // Unwrap .cause for better Sentry grouping (same as trpc.ts:127-131)
            const reportedError =
              errorCode === "INTERNAL_SERVER_ERROR" &&
              error instanceof Error &&
              error.cause instanceof Error
                ? error.cause
                : error;

            captureException(reportedError, {
              mechanism: {
                handled: false,
                type: "auto.rpc.orpc.middleware",
              },
            });
          } else {
            log.info("[orpc] client error", {
              ...meta,
              ok: false,
              errorCode,
            });
          }

          if (journal.length > 0) {
            log.info("[orpc] request journal", {
              path: procedurePath,
              durationMs,
              ok: false,
              entryCount: journal.length,
              entries: journal,
            });
          }

          // Re-throw so oRPC's handler serializes the error response
          throw error;
        }
      );
    });
  };
}
