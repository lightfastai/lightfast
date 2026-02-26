import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";

import { getEnv } from "../env.js";
import { inngest } from "../inngest/client.js";

function isValidApiKey(key: string | undefined, expected: string): boolean {
  if (!key) {
    return false;
  }
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

const trigger = new Hono();

/**
 * POST /trigger
 *
 * Called by Gateway via QStash when a new connection is created.
 * Validates X-API-Key and sends an Inngest event to start the backfill.
 */
trigger.post("/", async (c) => {
  const { GATEWAY_API_KEY } = getEnv(c);
  if (!isValidApiKey(c.req.header("X-API-Key"), GATEWAY_API_KEY)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  let body: {
    installationId: string;
    provider: string;
    orgId: string;
    depth?: 7 | 30 | 90;
    entityTypes?: string[];
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (!body.installationId || !body.provider || !body.orgId) {
    return c.json({ error: "missing_required_fields" }, 400);
  }

  const validDepths = [7, 30, 90] as const;
  if (body.depth != null && !validDepths.includes(body.depth)) {
    return c.json({ error: "invalid_depth" }, 400);
  }

  try {
    await inngest.send({
      name: "apps-backfill/run.requested",
      data: {
        installationId: body.installationId,
        provider: body.provider,
        orgId: body.orgId,
        depth: body.depth ?? 30,
        entityTypes: body.entityTypes,
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
 * Called by Gateway when a connection is deleted/revoked.
 * Cancels any running backfill for this installation.
 */
trigger.post("/cancel", async (c) => {
  const { GATEWAY_API_KEY } = getEnv(c);
  if (!isValidApiKey(c.req.header("X-API-Key"), GATEWAY_API_KEY)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  let body: { installationId: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (!body.installationId) {
    return c.json({ error: "missing_installationId" }, 400);
  }

  try {
    await inngest.send({
      name: "apps-backfill/run.cancelled",
      data: { installationId: body.installationId },
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
