import { nanoid } from "@repo/lib";
import { createMiddleware } from "hono/factory";

export interface RequestIdVariables {
  requestId: string;
  /** Shared across services for cross-service request tracing. */
  correlationId: string;
}

/**
 * Request ID middleware — propagates or generates a unique request ID
 * and a cross-service correlation ID.
 *
 * - X-Request-Id: per-service request identifier (generated if absent)
 * - X-Correlation-Id: shared across relay → connections → backfill
 *   (defaults to requestId at the entry-point service)
 */
export const requestId = createMiddleware<{
  Variables: RequestIdVariables;
}>(async (c, next) => {
  const id = c.req.header("X-Request-Id") ?? nanoid();
  const correlationId = c.req.header("X-Correlation-Id") ?? id;
  c.set("requestId", id);
  c.set("correlationId", correlationId);
  c.header("X-Request-Id", id);
  c.header("X-Correlation-Id", correlationId);
  await next();
});
