import {
  type BackfillContext,
  getProvider,
  timingSafeStringEqual,
} from "@repo/console-providers";
import { backfillEstimatePayload } from "@repo/console-providers/contracts";
import { createGatewayClient } from "@repo/gateway-service-clients";
import { Hono } from "hono";

import { env } from "../env.js";
import type { LifecycleVariables } from "../middleware/lifecycle.js";

const estimateSchema = backfillEstimatePayload;

interface Sample {
  hasMore: boolean;
  resourceId: string;
  returnedCount: number;
}

const estimate = new Hono<{ Variables: LifecycleVariables }>();

estimate.post("/", async (c) => {
  const { GATEWAY_API_KEY } = env;
  const apiKey = c.req.header("X-API-Key");
  if (!(apiKey && timingSafeStringEqual(apiKey, GATEWAY_API_KEY))) {
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
    return c.json({ error: "invalid_body", details: parsed.error.issues }, 400);
  }

  const { installationId, provider, depth, entityTypes, orgId } = parsed.data;

  const gw = createGatewayClient({
    apiKey: GATEWAY_API_KEY,
    requestSource: "backfill",
  });

  const connection = await gw.getConnection(installationId).catch(() => null);
  if (!connection) {
    return c.json({ error: "connection_not_found" }, 404);
  }

  // Tenant isolation: verify orgId matches the connection
  if (connection.orgId !== orgId) {
    return c.json({ error: "org_mismatch" }, 403);
  }

  // Resolve provider
  const providerDef = getProvider(provider);
  if (!providerDef) {
    return c.json({ error: "unknown_provider", provider }, 400);
  }
  const backfill = providerDef.backfill;
  if (!backfill) {
    return c.json({ error: "provider_backfill_not_supported", provider }, 400);
  }

  const resolvedEntityTypes =
    entityTypes && entityTypes.length > 0
      ? entityTypes
      : [...backfill.defaultEntityTypes];

  const since = new Date(
    Date.now() - depth * 24 * 60 * 60 * 1000
  ).toISOString();

  // Probe page 1 for each resource x entityType — all independent, run in parallel
  const probeJobs = resolvedEntityTypes.flatMap((entityType) =>
    connection.resources.map(
      async (resource): Promise<{ entityType: string; sample: Sample }> => {
        const entityHandler = backfill.entityTypes[entityType];
        if (!entityHandler) {
          return {
            entityType,
            sample: {
              resourceId: resource.providerResourceId,
              returnedCount: 0,
              hasMore: false,
            },
          };
        }

        const ctx: BackfillContext = {
          installationId,
          resource: {
            providerResourceId: resource.providerResourceId,
            resourceName: resource.resourceName ?? "",
          },
          since,
        };

        try {
          const request = entityHandler.buildRequest(ctx, null);
          const raw = await gw.executeApi(installationId, {
            endpointId: entityHandler.endpointId,
            ...request,
          });

          if (raw.status !== 200) {
            return {
              entityType,
              sample: {
                resourceId: resource.providerResourceId,
                returnedCount: -1,
                hasMore: false,
              },
            };
          }

          const processed = entityHandler.processResponse(raw.data, ctx, null);
          return {
            entityType,
            sample: {
              resourceId: resource.providerResourceId,
              returnedCount: processed.rawCount,
              hasMore: processed.nextCursor !== null,
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
      }
    )
  );

  const probeResults = await Promise.allSettled(probeJobs);

  // Group results by entityType
  const probes: Record<
    string,
    {
      resources: number;
      samples: Sample[];
      estimatedItems: number;
      estimatedPages: number;
    }
  > = {};

  for (const result of probeResults) {
    if (result.status !== "fulfilled") {
      continue;
    }
    const { entityType, sample } = result.value;
    probes[entityType] ??= {
      resources: connection.resources.length,
      samples: [],
      estimatedItems: 0,
      estimatedPages: 0,
    };
    probes[entityType].samples.push(sample);
  }

  // Compute estimates per entity type
  for (const probe of Object.values(probes)) {
    probe.estimatedItems = probe.samples.reduce(
      (sum, s) => sum + Math.max(0, s.returnedCount),
      0
    );
    const pagesWithMore = probe.samples.filter((s) => s.hasMore).length;
    // Conservative: items from page 1 + assume 2 more pages per resource with hasMore
    probe.estimatedPages = probe.samples.length + pagesWithMore * 2;
  }

  const totalEstimatedItems = Object.values(probes).reduce(
    (sum, p) => sum + p.estimatedItems,
    0
  );
  const totalEstimatedPages = Object.values(probes).reduce(
    (sum, p) => sum + p.estimatedPages,
    0
  );
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
    },
  });
});

export { estimate };
