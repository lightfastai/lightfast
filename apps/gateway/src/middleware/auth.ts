import type { Context, MiddlewareHandler } from "hono";
import { env } from "../env";

/**
 * X-API-Key authentication middleware for Console → Gateway calls.
 *
 * Validates the X-API-Key header against the GATEWAY_API_KEY env var.
 */
export const apiKeyAuth: MiddlewareHandler = async (c: Context, next) => {
  const apiKey = c.req.header("X-API-Key");

  if (!apiKey || apiKey !== env.GATEWAY_API_KEY) {
    return c.json({ error: "unauthorized" }, 401);
  }

  await next();
};
