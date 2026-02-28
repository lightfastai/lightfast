import { createMiddleware } from "hono/factory";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Dev-only timing middleware — surfaces unwanted waterfalls during development.
 *
 * Mirrors the tRPC timingMiddleware in @api/console:
 * - Adds artificial 100-500ms delay to simulate production network latency
 * - Logs execution time per request
 *
 * No-ops in production.
 */
export const timing = createMiddleware(async (c, next) => {
  if (!isDev) return next();

  const start = Date.now();
  const waitMs = Math.floor(Math.random() * 400) + 100;
  await new Promise((resolve) => setTimeout(resolve, waitMs));

  await next();

  const duration = Date.now() - start;
  console.log(
    `[TIMING] ${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`,
  );
});
