import type { BackfillConfig } from "@repo/console-backfill";
import { getConnector } from "@repo/console-backfill";
import { Hono } from "hono";
import { z } from "zod";

import { getEnv } from "../env.js";
import { timingSafeStringEqual } from "../lib/crypto.js";
import { gatewayUrl } from "../lib/related-projects.js";
import type { LifecycleVariables } from "../middleware/lifecycle.js";

const estimateSchema = z.object({
  installationId: z.string().min(1),
  provider: z.string().min(1),
  orgId: z.string().min(1),
  depth: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
  entityTypes: z.array(z.string()).optional(),
});

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

  // Get connection from Gateway
  const connResponse = await fetch(`${gatewayUrl}/gateway/${installationId}`, {
    headers: { "X-API-Key": GATEWAY_API_KEY, "X-Request-Source": "backfill-estimate" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!connResponse.ok) {
    return c.json({ error: "connection_not_found" }, 404);
  }
  const connection = (await connResponse.json()) as {
    id: string;
    provider: string;
    status: string;
    resources: { providerResourceId: string; resourceName: string | null }[];
  };

  // Resolve connector
  const connector = getConnector(provider as Parameters<typeof getConnector>[0]);
  if (!connector) {
    return c.json({ error: "no_connector", provider }, 400);
  }

  const resolvedEntityTypes =
    entityTypes && entityTypes.length > 0 ? entityTypes : connector.defaultEntityTypes;

  // Get access token
  const tokenResponse = await fetch(`${gatewayUrl}/gateway/${installationId}/token`, {
    headers: { "X-API-Key": GATEWAY_API_KEY, "X-Request-Source": "backfill-estimate" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenResponse.ok) {
    return c.json({ error: "token_fetch_failed" }, 502);
  }
  const { accessToken } = (await tokenResponse.json()) as { accessToken: string };

  const since = new Date(Date.now() - depth * 24 * 60 * 60 * 1000).toISOString();

  // Probe page 1 for each resource × entityType
  const probes: Record<string, {
    resources: number;
    samples: { resourceId: string; returnedCount: number; hasMore: boolean }[];
    estimatedItems: number;
    estimatedPages: number;
  }> = {};

  for (const entityType of resolvedEntityTypes) {
    const samples: typeof probes[string]["samples"] = [];

    for (const resource of connection.resources) {
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
        samples.push({
          resourceId: resource.providerResourceId,
          returnedCount: page.rawCount,
          hasMore: page.nextCursor !== null,
        });
      } catch {
        samples.push({
          resourceId: resource.providerResourceId,
          returnedCount: -1,
          hasMore: false,
        });
      }
    }

    const estimatedItems = samples.reduce((sum, s) => sum + Math.max(0, s.returnedCount), 0);
    const pagesWithMore = samples.filter((s) => s.hasMore).length;

    probes[entityType] = {
      resources: connection.resources.length,
      samples,
      estimatedItems,
      // Conservative: items from page 1 + assume 2 more pages per resource with hasMore
      estimatedPages: samples.length + pagesWithMore * 2,
    };
  }

  const totalEstimatedItems = Object.values(probes).reduce((sum, p) => sum + p.estimatedItems, 0);
  const totalEstimatedPages = Object.values(probes).reduce((sum, p) => sum + p.estimatedPages, 0);

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
      estimatedApiCalls: totalEstimatedPages * 2 + 2,
      rateLimitUsage: `${((totalEstimatedPages * 2 + 2) / 4000 * 100).toFixed(1)}%`,
    },
  });
});

export { estimate };
