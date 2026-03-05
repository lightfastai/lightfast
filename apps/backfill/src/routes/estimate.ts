import type { BackfillConfig } from "@repo/console-backfill";
import { getConnector } from "@repo/console-backfill";
import { backfillEstimatePayload } from "@repo/console-validation";
import { Hono } from "hono";

import { getEnv } from "../env.js";
import { GITHUB_RATE_LIMIT_BUDGET } from "../lib/constants.js";
import { timingSafeStringEqual } from "../lib/crypto.js";
import { createGatewayClient } from "@repo/gateway-service-clients";
import type { LifecycleVariables } from "../middleware/lifecycle.js";

const estimateSchema = backfillEstimatePayload;

interface Sample {
  resourceId: string;
  returnedCount: number;
  hasMore: boolean;
}

const estimate = new Hono<{ Variables: LifecycleVariables }>();

estimate.post("/", async (c) => {
  const { GATEWAY_API_KEY } = getEnv(c);
  const apiKey = c.req.header("X-API-Key");
  if (!apiKey || !(await timingSafeStringEqual(apiKey, GATEWAY_API_KEY))) {
    return c.json({ error: "unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = estimateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
  }

  const { installationId, provider, depth, entityTypes } = parsed.data;

  const gw = createGatewayClient({ apiKey: GATEWAY_API_KEY, requestSource: "backfill" });

  const connection = await gw.getConnection(installationId).catch(() => null);
  if (!connection) {
    return c.json({ error: "connection_not_found" }, 404);
  }

  const tokenResult = await gw.getToken(installationId).catch(() => null);
  if (!tokenResult) {
    return c.json({ error: "token_fetch_failed" }, 502);
  }
  const { accessToken } = tokenResult;

  // Resolve connector
  const connector = getConnector(provider as Parameters<typeof getConnector>[0]);
  if (!connector) {
    return c.json({ error: "no_connector", provider }, 400);
  }

  const resolvedEntityTypes =
    entityTypes && entityTypes.length > 0 ? entityTypes : connector.defaultEntityTypes;

  const since = new Date(Date.now() - depth * 24 * 60 * 60 * 1000).toISOString();

  // Probe page 1 for each resource x entityType — all independent, run in parallel
  const probeJobs = resolvedEntityTypes.flatMap((entityType) =>
    connection.resources.map(async (resource): Promise<{ entityType: string; sample: Sample }> => {
      try {
        const config: BackfillConfig = {
          installationId,
          provider: provider as BackfillConfig["provider"],
          since,
          accessToken,
          resource: {
            providerResourceId: resource.providerResourceId,
            resourceName: resource.resourceName,
          },
        };

        const page = await connector.fetchPage(config, entityType, null);
        return {
          entityType,
          sample: {
            resourceId: resource.providerResourceId,
            returnedCount: page.rawCount,
            hasMore: page.nextCursor !== null,
          },
        };
      } catch {
        return {
          entityType,
          sample: {
            resourceId: resource.providerResourceId,
            returnedCount: -1,
            hasMore: false,
          },
        };
      }
    }),
  );

  const probeResults = await Promise.allSettled(probeJobs);

  // Group results by entityType
  const probes: Record<string, {
    resources: number;
    samples: Sample[];
    estimatedItems: number;
    estimatedPages: number;
  }> = {};

  for (const result of probeResults) {
    if (result.status !== "fulfilled") {
      continue;
    }
    const { entityType, sample } = result.value;
    probes[entityType] ??= { resources: connection.resources.length, samples: [], estimatedItems: 0, estimatedPages: 0 };
    probes[entityType].samples.push(sample);
  }

  // Compute estimates per entity type
  for (const probe of Object.values(probes)) {
    probe.estimatedItems = probe.samples.reduce((sum, s) => sum + Math.max(0, s.returnedCount), 0);
    const pagesWithMore = probe.samples.filter((s) => s.hasMore).length;
    // Conservative: items from page 1 + assume 2 more pages per resource with hasMore
    probe.estimatedPages = probe.samples.length + pagesWithMore * 2;
  }

  const totalEstimatedItems = Object.values(probes).reduce((sum, p) => sum + p.estimatedItems, 0);
  const totalEstimatedPages = Object.values(probes).reduce((sum, p) => sum + p.estimatedPages, 0);
  const estimatedApiCalls = totalEstimatedPages * 2 + 2;

  return c.json({
    installationId,
    provider,
    depth,
    entityTypes: resolvedEntityTypes,
    since,
    estimate: probes,
    totals: {
      estimatedItems: totalEstimatedItems,
      estimatedPages: totalEstimatedPages,
      estimatedApiCalls,
      rateLimitUsage: `${((estimatedApiCalls / GITHUB_RATE_LIMIT_BUDGET) * 100).toFixed(1)}%`,
    },
  });
});

export { estimate };
