import { Hono } from "hono";
import { env } from "../env";
import { inngest } from "../inngest/client";

const trigger = new Hono();

/**
 * POST /trigger
 *
 * Called by Gateway via QStash when a new connection is created.
 * Validates X-API-Key and sends an Inngest event to start the backfill.
 */
trigger.post("/", async (c) => {
  const apiKey = c.req.header("X-API-Key");
  if (!apiKey || apiKey !== env.GATEWAY_API_KEY) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const body = await c.req.json<{
    installationId: string;
    provider: string;
    orgId: string;
    depth?: 7 | 30 | 90;
    entityTypes?: string[];
  }>();

  if (!body.installationId || !body.provider || !body.orgId) {
    return c.json({ error: "missing_required_fields" }, 400);
  }

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

  return c.json({ status: "accepted", installationId: body.installationId });
});

export { trigger };
