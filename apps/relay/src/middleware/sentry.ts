import { createMiddleware } from "hono/factory";
import { captureException, captureMessage, withScope } from "@vendor/observability/sentry";
import type { RequestIdVariables } from "./request-id.js";

/**
 * Sentry middleware — captures errors with request context.
 *
 * Mirrors the Sentry trpcMiddleware in @api/console:
 * - Captures thrown exceptions with method, path, and request ID context
 * - Captures explicitly returned 5xx responses (not thrown as exceptions)
 *
 * Placed after errorSanitizer so it sees original 5xx bodies before sanitization.
 */
export const sentry = createMiddleware<{
  Variables: RequestIdVariables;
}>(async (c, next) => {
  try {
    await next();
  } catch (err) {
    withScope((scope) => {
      scope.setTag("service", "relay");
      scope.setTag("http.method", c.req.method);
      scope.setTag("http.path", c.req.path);
      const requestId = c.get("requestId");
      if (requestId) scope.setTag("request_id", requestId);
      const correlationId = c.get("correlationId");
      if (correlationId) scope.setTag("correlation_id", correlationId);
      scope.setContext("request", {
        method: c.req.method,
        path: c.req.path,
        requestId,
        correlationId,
      });
      captureException(err);
    });
    throw err;
  }

  // Capture explicitly returned 5xx responses (not thrown as exceptions)
  if (c.res.status >= 500) {
    withScope((scope) => {
      scope.setTag("service", "relay");
      scope.setTag("http.method", c.req.method);
      scope.setTag("http.path", c.req.path);
      scope.setTag("http.status", String(c.res.status));
      const requestId = c.get("requestId");
      if (requestId) scope.setTag("request_id", requestId);
      const correlationId = c.get("correlationId");
      if (correlationId) scope.setTag("correlation_id", correlationId);
      scope.setContext("request", {
        method: c.req.method,
        path: c.req.path,
        requestId,
        correlationId,
      });
      captureMessage(
        `HTTP ${c.res.status}: ${c.req.method} ${c.req.path}`,
        "error",
      );
    });
  }
});
