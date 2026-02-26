import { timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { getEnv } from "../env";

/**
 * X-API-Key authentication middleware for service-to-service calls.
 */
export const apiKeyAuth: MiddlewareHandler = async (c: Context, next) => {
  const apiKey = c.req.header("X-API-Key");

  if (!apiKey) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const { GATEWAY_API_KEY } = getEnv(c);
  const expected = Buffer.from(GATEWAY_API_KEY);
  const received = Buffer.from(apiKey);

  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return c.json({ error: "unauthorized" }, 401);
  }

  await next();
};
