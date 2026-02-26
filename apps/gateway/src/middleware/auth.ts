import type { MiddlewareHandler } from "hono";
import { Receiver } from "@vendor/qstash";
import { timingSafeStringEqual } from "../lib/crypto";
import { getEnv } from "../env";

/**
 * X-API-Key authentication middleware for Console → Gateway calls.
 *
 * Validates the X-API-Key header against the GATEWAY_API_KEY env var.
 */
export const apiKeyAuth: MiddlewareHandler = async (c, next) => {
  const apiKey = c.req.header("X-API-Key");
  const { GATEWAY_API_KEY } = getEnv(c);

  if (!apiKey || !timingSafeStringEqual(apiKey, GATEWAY_API_KEY)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  await next();
};

const receiver = new Receiver();

/**
 * QStash signature verification middleware for QStash callback routes.
 *
 * Validates the Upstash-Signature header using QSTASH_CURRENT_SIGNING_KEY
 * (with QSTASH_NEXT_SIGNING_KEY for key rotation).
 */
export const qstashAuth: MiddlewareHandler = async (c, next) => {
  const signature = c.req.header("Upstash-Signature");

  if (!signature) {
    return c.json({ error: "missing_signature" }, 401);
  }

  const body = await c.req.raw.clone().text();

  try {
    await receiver.verify({ signature, body });
  } catch {
    return c.json({ error: "invalid_signature" }, 401);
  }

  await next();
};
