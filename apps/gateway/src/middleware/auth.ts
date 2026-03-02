import type { Context, MiddlewareHandler } from "hono";
import { createHash, timingSafeEqual } from "node:crypto";
import { getEnv } from "../env.js";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * X-API-Key authentication middleware for service-to-service calls.
 */
export const apiKeyAuth: MiddlewareHandler = async (c: Context, next) => {
  const apiKey = c.req.header("X-API-Key");

  if (!apiKey) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const { GATEWAY_API_KEY } = getEnv(c);

  if (!timingSafeEqual(sha256(GATEWAY_API_KEY), sha256(apiKey))) {
    return c.json({ error: "unauthorized" }, 401);
  }

  await next();
};
