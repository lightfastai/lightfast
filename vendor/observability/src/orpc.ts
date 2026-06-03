import "server-only";

import { ORPCError } from "@orpc/client";
import type { Meta, Middleware, ORPCErrorConstructorMap } from "@orpc/server";
import {
  getActiveSpan,
  SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN,
  SEMANTIC_ATTRIBUTE_SENTRY_SOURCE,
  startSpan,
  withIsolationScope,
} from "@sentry/core";
import * as Sentry from "@sentry/nextjs";

import { log } from "./log/next";
import { withRequestContext } from "./request";

interface ObservabilityContext {
  requestId: string;
}

/**
 * Create an oRPC observability middleware that consolidates:
 * - Sentry isolation scope + span creation
 * - Error classification via ORPCError.status
 * - Selective Sentry capture (server errors only)
 * - Structured logging with trace ID correlation
 * - ALS request context seeding (requestId + traceId)
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
export function createORPCObservabilityMiddleware<
  TErrorConstructorMap extends
    ORPCErrorConstructorMap<any> = ORPCErrorConstructorMap<
    Record<never, never>
  >,
  TMeta extends Meta = Meta,
>(): Middleware<
  ObservabilityContext,
  Record<never, never>,
  unknown,
  unknown,
  TErrorConstructorMap,
  TMeta
> {
  return async ({ context, next, path }) => {
    const { requestId } = context;
    const procedurePath = path.join(".");

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

          // Catch errors inside withRequestContext so we still get durationMs.
          // oRPC errors propagate as thrown exceptions (unlike tRPC's result.ok pattern).
          const {
            result,
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
            return result.value;
          }

          // -- Error classification (mirrors trpc.ts:116-141) --
          const error = result.error;
          const isKnown = error instanceof ORPCError;
          const httpStatus = isKnown ? error.status : 500;
          const errorCode = isKnown ? error.code : "INTERNAL_SERVER_ERROR";

          if (httpStatus >= 500) {
            log.error("[orpc] server error", { ...meta, ok: false, errorCode });

            // Unwrap .cause for better Sentry grouping (same as trpc.ts:127-131)
            const reportedError =
              errorCode === "INTERNAL_SERVER_ERROR" &&
              error instanceof Error &&
              error.cause instanceof Error
                ? error.cause
                : error;

            Sentry.captureException(reportedError, {
              extra: {
                durationMs,
                requestId,
              },
              tags: {
                "orpc.error_code": errorCode,
                "orpc.path": procedurePath,
              },
            });
          } else {
            log.info("[orpc] client error", {
              ...meta,
              ok: false,
              errorCode,
            });
          }

          // Re-throw so oRPC's handler serializes the error response
          throw error;
        }
      );
    });
  };
}
