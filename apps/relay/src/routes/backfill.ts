import { Hono } from "hono";
import { z } from "zod";
import { getQStashClient } from "@vendor/qstash";
import { apiKeyAuth } from "../middleware/auth.js";
import { backfillUrl } from "../lib/urls.js";
import { getEnv } from "../env.js";
import type { LifecycleVariables } from "../middleware/lifecycle.js";

const backfill = new Hono<{ Variables: LifecycleVariables }>();

const triggerSchema = z.object({
  installationId: z.string().min(1),
  provider: z.string().min(1),
  orgId: z.string().min(1),
  depth: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
  entityTypes: z.array(z.string()).optional(),
  holdForReplay: z.boolean().optional(),
});

/**
 * POST /backfill
 *
 * Trigger a historical backfill for a connection.
 * Forwards to the backfill service via QStash with deduplication.
 * Requires X-API-Key authentication.
 */
backfill.post("/", apiKeyAuth, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = triggerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);
  }

  const { installationId, provider, orgId, depth, entityTypes, holdForReplay } = parsed.data;
  const { GATEWAY_API_KEY } = getEnv(c);

  try {
    await getQStashClient().publishJSON({
      url: `${backfillUrl}/trigger`,
      headers: {
        "X-API-Key": GATEWAY_API_KEY,
        "X-Correlation-Id": c.get("correlationId"),
      },
      body: { installationId, provider, orgId, depth, entityTypes, holdForReplay },
      retries: 3,
      deduplicationId: `backfill:${provider}:${installationId}:${orgId}:d=${depth}:e=${entityTypes ? [...entityTypes].sort().join(",") : ""}:r=${String(holdForReplay ?? false)}`,
    });
  } catch (err) {
    console.error("[relay] Failed to forward backfill trigger", {
      installationId,
      provider,
      backfillUrl,
      err,
    });
    return c.json({ error: "forward_failed" }, 502);
  }

  return c.json({ status: "queued", installationId, provider });
});

/**
 * POST /backfill/estimate
 *
 * Synchronous probe: forwards estimate request to the backfill service
 * and returns the structured scope estimate directly (no QStash).
 */
backfill.post("/estimate", apiKeyAuth, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const { GATEWAY_API_KEY } = getEnv(c);

  const response = await fetch(`${backfillUrl}/estimate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": GATEWAY_API_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const result = (await response.json()) as Record<string, unknown>;
  return c.json(result, response.status as 200 | 400 | 404 | 502);
});

export { backfill };
