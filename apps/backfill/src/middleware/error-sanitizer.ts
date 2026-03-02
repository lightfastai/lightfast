import { createMiddleware } from "hono/factory";
import { env } from "../env.js";

const isProduction = env.NODE_ENV === "production";

/**
 * Error sanitizer middleware — prevents credential leaks in production.
 *
 * - In production, replaces 5xx error bodies with a generic message
 * - In development, passes through the original error for debugging
 */
export const errorSanitizer = createMiddleware(async (c, next) => {
  await next();

  if (isProduction && c.res.status >= 500) {
    c.res = new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
});
