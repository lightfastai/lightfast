import "server-only";

import {
  captureException,
  getActiveSpan,
  SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN,
  SEMANTIC_ATTRIBUTE_SENTRY_SOURCE,
  startSpan,
  withIsolationScope,
} from "@sentry/core";
import type { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { nanoid } from "@vendor/lib";

import { log } from "./log/next";
import { emitJournal, withRequestContext } from "./request";

type AuthFields = Record<string, unknown>;

/** Minimal shape of tRPC's MiddlewareResult — just the fields we inspect. */
interface MiddlewareResultLike {
  error?: TRPCError;
  ok: boolean;
}

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
 */
export function createObservabilityMiddleware<TCtx>(
  opts: CreateObservabilityMiddlewareOptions<TCtx>
) {
  return async <TResult extends MiddlewareResultLike>({
    next,
    path,
    ctx,
    type,
    getRawInput,
  }: {
    next: () => Promise<TResult>;
    path: string;
    ctx: TCtx;
    type: string;
    getRawInput: () => Promise<unknown>;
  }): Promise<TResult> => {
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
        {
          name: `trpc/${path}`,
          op: "rpc.server",
          attributes: {
            [SEMANTIC_ATTRIBUTE_SENTRY_SOURCE]: "route",
            [SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: "auto.rpc.trpc",
          },
        },
        async () => {
          // Get Sentry trace ID for log↔trace correlation
          const span = getActiveSpan();
          const traceId = span?.spanContext().traceId;

          const requestId = nanoid();
          const { result, journal, durationMs } = await withRequestContext(
            { requestId, ...(traceId && { traceId }), ...authFields },
            () => next()
          );

          const meta = {
            path,
            type,
            durationMs,
            ok: result.ok,
            requestId,
            ...(traceId && { traceId }),
            ...(!result.ok && result.error && { errorCode: result.error.code }),
            ...authFields,
          };

          if (result.ok) {
            log.info("[trpc] ok", meta);
          } else if (result.error) {
            const httpStatus = getHTTPStatusCodeFromError(result.error);

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
                result.error.code === "INTERNAL_SERVER_ERROR" &&
                result.error.cause instanceof Error
                  ? result.error.cause
                  : result.error;

              captureException(reportedError, {
                mechanism: {
                  handled: false,
                  type: "auto.rpc.trpc.middleware",
                },
              });
            } else {
              log.info("[trpc] client error", meta);
            }
          }

          emitJournal(journal, { path, durationMs, ok: result.ok });

          return result;
        }
      );
    });
  };
}
