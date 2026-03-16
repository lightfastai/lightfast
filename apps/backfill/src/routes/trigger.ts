import {
  backfillTriggerPayload,
  timingSafeStringEqual,
} from "@repo/console-providers";
import { createGatewayClient } from "@repo/gateway-service-clients";
import { Hono } from "hono";
import { z } from "zod";

import { env } from "../env.js";
import { inngest } from "../inngest/client.js";
import { log } from "../logger.js";
import type { LifecycleVariables } from "../middleware/lifecycle.js";

const cancelSchema = z.object({
  installationId: z.string().min(1),
});

function isValidApiKey(key: string | undefined, expected: string): boolean {
  if (!key) {
    return false;
  }
  return timingSafeStringEqual(key, expected);
}

const trigger = new Hono<{ Variables: LifecycleVariables }>();

/**
 * POST /trigger
 *
 * Called by Relay via QStash when a new connection is created.
 * Validates X-API-Key and sends an Inngest event to start the backfill.
 */
trigger.post("/", async (c) => {
  const { GATEWAY_API_KEY } = env;
  if (!isValidApiKey(c.req.header("X-API-Key"), GATEWAY_API_KEY)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = backfillTriggerPayload.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", details: parsed.error.issues },
      400
    );
  }
  const body = parsed.data;

  try {
    await inngest.send({
      name: "apps-backfill/run.requested",
      data: {
        installationId: body.installationId,
        provider: body.provider,
        orgId: body.orgId,
        depth: body.depth,
        entityTypes: body.entityTypes,
        holdForReplay: body.holdForReplay,
        correlationId: body.correlationId ?? c.get("correlationId"),
      },
    });
  } catch (err) {
    log.error("[backfill] failed to send backfill event to Inngest", {
      installationId: body.installationId,
      provider: body.provider,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json(
      { error: "temporary_failure", message: "Failed to enqueue backfill" },
      502
    );
  }

  return c.json({ status: "accepted", installationId: body.installationId });
});

/**
 * POST /trigger/cancel
 *
 * Called by Gateway service when a connection is deleted/revoked.
 * Cancels any running backfill for this installation.
 */
trigger.post("/cancel", async (c) => {
  const { GATEWAY_API_KEY } = env;
  if (!isValidApiKey(c.req.header("X-API-Key"), GATEWAY_API_KEY)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = cancelSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", details: parsed.error.issues },
      400
    );
  }
  const body = parsed.data;

  // Verify installation exists before emitting cancel event
  const gw = createGatewayClient({
    apiKey: GATEWAY_API_KEY,
    requestSource: "backfill",
  });
  const connection = await gw
    .getConnection(body.installationId)
    .catch(() => null);
  if (!connection) {
    return c.json({ error: "connection_not_found" }, 404);
  }

  try {
    await inngest.send({
      name: "apps-backfill/run.cancelled",
      data: {
        installationId: body.installationId,
        correlationId: c.get("correlationId"),
      },
    });
  } catch (err) {
    log.error("[backfill] failed to send cancel event to Inngest", {
      installationId: body.installationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json(
      { error: "temporary_failure", message: "Failed to enqueue cancellation" },
      502
    );
  }

  return c.json({ status: "cancelled", installationId: body.installationId });
});

export { trigger };
