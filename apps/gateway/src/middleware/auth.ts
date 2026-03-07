import { timingSafeStringEqual } from "@repo/console-providers";
import type { Context, MiddlewareHandler } from "hono";
import { env } from "../env.js";

/**
 * X-API-Key authentication middleware for service-to-service calls.
 */
export const apiKeyAuth: MiddlewareHandler = async (c: Context, next) => {
  const apiKey = c.req.header("X-API-Key");

  if (!apiKey) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const { GATEWAY_API_KEY } = env;

  if (!timingSafeStringEqual(apiKey, GATEWAY_API_KEY)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  await next();
};
