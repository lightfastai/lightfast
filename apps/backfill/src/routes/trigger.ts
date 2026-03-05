import { backfillTriggerPayload } from "@repo/console-validation";
import { Hono } from "hono";
import { z } from "zod/v3";

import { getEnv } from "../env.js";
import { inngest } from "../inngest/client.js";
import { timingSafeStringEqual } from "../lib/crypto.js";
import type { LifecycleVariables } from "../middleware/lifecycle.js";

const cancelSchema = z.object({
  installationId: z.string().min(1),
});

async function isValidApiKey(key: string | undefined, expected: string): Promise<boolean> {
  if (!key) { return false; }
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
  const { GATEWAY_API_KEY } = getEnv(c);
  if (!(await isValidApiKey(c.req.header("X-API-Key"), GATEWAY_API_KEY))) {
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
      { error: "validation_error", details: parsed.error.flatten() },
      400,
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
        correlationId: c.get("correlationId"),
      },
    });
  } catch (err) {
    console.error("Failed to send backfill event to Inngest", err);
    return c.json(
      { error: "temporary_failure", message: "Failed to enqueue backfill" },
      502,
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
  const { GATEWAY_API_KEY } = getEnv(c);
  if (!(await isValidApiKey(c.req.header("X-API-Key"), GATEWAY_API_KEY))) {
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
      { error: "validation_error", details: parsed.error.flatten() },
      400,
    );
  }
  const body = parsed.data;

  try {
    await inngest.send({
      name: "apps-backfill/run.cancelled",
      data: {
        installationId: body.installationId,
        correlationId: c.get("correlationId"),
      },
    });
  } catch (err) {
    console.error("Failed to send cancel event to Inngest", err);
    return c.json(
      { error: "temporary_failure", message: "Failed to enqueue cancellation" },
      502,
    );
  }

  return c.json({ status: "cancelled", installationId: body.installationId });
});

export { trigger };
