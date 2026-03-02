import { createMiddleware } from "hono/factory";
import {
  captureException,
  captureMessage,
  withScope,
} from "@vendor/observability/sentry";
import type { Scope } from "@vendor/observability/sentry";
import type { RequestIdVariables } from "./request-id.js";

/**
 * Set common Sentry scope tags and context for a request.
 */
function setScopeContext(
  scope: Scope,
  c: { req: { method: string; path: string }; get: (k: string) => string | undefined },
  requestId?: string,
  correlationId?: string,
): void {
  scope.setTag("service", "relay");
  scope.setTag("http.method", c.req.method);
  scope.setTag("http.path", c.req.path);
  if (requestId) scope.setTag("request_id", requestId);
  if (correlationId) scope.setTag("correlation_id", correlationId);
  scope.setContext("request", {
    method: c.req.method,
    path: c.req.path,
    requestId,
    correlationId,
  });
}

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
      setScopeContext(scope, c, c.get("requestId"), c.get("correlationId"));
      captureException(err);
    });
    throw err;
  }

  // Capture explicitly returned 5xx responses (not thrown as exceptions)
  if (c.res.status >= 500) {
    withScope((scope) => {
      setScopeContext(scope, c, c.get("requestId"), c.get("correlationId"));
      scope.setTag("http.status", String(c.res.status));
      captureMessage(
        `HTTP ${c.res.status}: ${c.req.method} ${c.req.path}`,
        "error",
      );
    });
  }
});
