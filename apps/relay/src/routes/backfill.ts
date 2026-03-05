import { Hono } from "hono";
import { getQStashClient } from "@vendor/qstash";
import { backfillTriggerPayload } from "@repo/console-validation";
import { apiKeyAuth } from "../middleware/auth.js";
import { backfillUrl } from "../lib/urls.js";
import { getEnv } from "../env.js";
import type { LifecycleVariables } from "../middleware/lifecycle.js";

const backfill = new Hono<{ Variables: LifecycleVariables }>();

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

  const parsed = backfillTriggerPayload.safeParse(body);
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

export { backfill };
