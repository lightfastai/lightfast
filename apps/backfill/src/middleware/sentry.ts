import * as Sentry from "@sentry/core";
import { createMiddleware } from "hono/factory";

/**
 * Sentry middleware — captures unhandled errors with request context.
 *
 * Mirrors the Sentry trpcMiddleware in @api/console:
 * - Wraps each request in a Sentry span for tracing
 * - Captures exceptions with method, path, and request ID context
 */
export const sentry = createMiddleware(async (c, next) => {
  try {
    await next();
  } catch (err) {
    Sentry.withScope((scope: Sentry.Scope) => {
      scope.setTag("service", "backfill");
      scope.setTag("http.method", c.req.method);
      scope.setTag("http.path", c.req.path);

      const requestId = c.get("requestId" as never) as string | undefined;
      if (requestId) { scope.setTag("request_id", requestId); }

      Sentry.captureException(err);
    });

    throw err;
  }
});
