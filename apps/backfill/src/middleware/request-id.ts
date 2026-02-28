import { createMiddleware } from "hono/factory";
import { nanoid } from "@repo/lib";

export interface RequestIdVariables {
  requestId: string;
}

/**
 * Request ID middleware — propagates or generates a unique request ID.
 *
 * Checks for an incoming X-Request-Id header (set by upstream callers)
 * and falls back to generating a new nanoid. Sets the ID on the response
 * header and in context for downstream logging.
 */
export const requestId = createMiddleware<{
  Variables: RequestIdVariables;
}>(async (c, next) => {
  const id = c.req.header("X-Request-Id") ?? nanoid();
  c.set("requestId", id);
  c.header("X-Request-Id", id);
  await next();
});
