import type { Context, MiddlewareHandler } from "hono";
import { getEnv } from "../env.js";
import { sha256Hex, timingSafeHexEqual } from "../lib/crypto.js";

/**
 * X-API-Key authentication middleware for service-to-service calls.
 */
export const apiKeyAuth: MiddlewareHandler = async (c: Context, next) => {
  const apiKey = c.req.header("X-API-Key");

  if (!apiKey) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const { GATEWAY_API_KEY } = getEnv(c);

  const expectedHash = await sha256Hex(GATEWAY_API_KEY);
  const actualHash = await sha256Hex(apiKey);
  if (!timingSafeHexEqual(expectedHash, actualHash)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  await next();
};
