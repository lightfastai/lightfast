/**
 * Backfill tRPC sub-router.
 *
 * Ported from apps/backfill/src/routes/trigger.ts and apps/backfill/src/routes/estimate.ts.
 * All procedures use serviceProcedure (JWT auth required).
 *
 * KEY CHANGES vs backfill service:
 * - tRPC procedures instead of Hono routes
 * - Sends platform/* events instead of backfill/* events
 * - Direct DB queries instead of gateway HTTP client for connection lookup
 * - Direct provider API calls instead of gw.executeApi() for estimate
 */

import { db } from "@db/app/client";
import { gatewayInstallations, orgIntegrations } from "@db/app/schema";
import {
  type BackfillContext,
  getProvider,
  type ProviderApi,
  type ProviderDefinition,
} from "@repo/app-providers";
import {
  backfillEstimatePayload,
  backfillTriggerPayload,
} from "@repo/app-providers/contracts";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq } from "@vendor/db";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";
import { inngest } from "../../inngest/client";
import { providerConfigs } from "../../lib/provider-configs";
import { getActiveTokenForInstallation } from "../../lib/token-helpers";
import { serviceProcedure } from "../../trpc";

// ── Backfill Router ──────────────────────────────────────────────────────

interface Sample {
  hasMore: boolean;
  resourceId: string;
  returnedCount: number;
}

export const backfillRouter = {
  /**
   * Trigger a backfill run.
   * Sends memory/backfill.run.requested event to Inngest.
   * Source: POST /trigger
   */
  trigger: serviceProcedure
    .input(backfillTriggerPayload)
    .mutation(async ({ input, ctx: _ctx }) => {
      // Verify connection exists and is active via direct DB query
      const installationRows = await db
        .select()
        .from(gatewayInstallations)
        .where(eq(gatewayInstallations.id, input.installationId))
        .limit(1);

      const installation = installationRows[0];
      if (!installation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      if (installation.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Connection not active (status: ${installation.status})`,
        });
      }

      // Tenant isolation
      if (installation.orgId !== input.orgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "org_mismatch",
        });
      }

      try {
        await inngest.send({
          name: "platform/backfill.run.requested",
          data: {
            installationId: input.installationId,
            provider: input.provider,
            orgId: input.orgId,
            depth: input.depth,
            entityTypes: input.entityTypes,
            holdForReplay: input.holdForReplay,
            correlationId: input.correlationId,
          },
        });
      } catch (err) {
        const message = parseError(err);
        log.error("[backfill] trigger dispatch failed", {
          installationId: input.installationId,
          provider: input.provider,
          orgId: input.orgId,
          error: message,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to enqueue backfill: ${message}`,
        });
      }

      return { status: "accepted", installationId: input.installationId };
    }),

  /**
   * Cancel a running backfill.
   * Sends memory/backfill.run.cancelled event to Inngest.
   * Source: POST /trigger/cancel
   */
  cancel: serviceProcedure
    .input(
      z.object({
        installationId: z.string().min(1),
        correlationId: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Verify installation exists
      const installationRows = await db
        .select({ id: gatewayInstallations.id })
        .from(gatewayInstallations)
        .where(eq(gatewayInstallations.id, input.installationId))
        .limit(1);

      if (!installationRows[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      try {
        await inngest.send({
          name: "platform/backfill.run.cancelled",
          data: {
            installationId: input.installationId,
            correlationId: input.correlationId,
          },
        });
      } catch (err) {
        const message = parseError(err);
        log.error("[backfill] cancel dispatch failed", {
          installationId: input.installationId,
          correlationId: input.correlationId,
          error: message,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to enqueue cancellation: ${message}`,
        });
      }

      return { status: "cancelled", installationId: input.installationId };
    }),

  /**
   * Estimate backfill scope by probing provider API page 1 for each resource x entityType.
   * Source: POST /estimate
   *
   * Uses direct provider API calls instead of gw.executeApi().
   */
  estimate: serviceProcedure
    .input(backfillEstimatePayload)
    .query(async ({ input }) => {
      const { installationId, provider, depth, entityTypes, orgId } = input;

      // Fetch connection from DB
      const installationRows = await db
        .select()
        .from(gatewayInstallations)
        .where(eq(gatewayInstallations.id, installationId))
        .limit(1);

      const installation = installationRows[0];
      if (!installation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      // Tenant isolation
      if (installation.orgId !== orgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "org_mismatch",
        });
      }

      // Fetch resources from orgIntegrations
      const resources = await db
        .select({
          providerResourceId: orgIntegrations.providerResourceId,
        })
        .from(orgIntegrations)
        .where(
          and(
            eq(orgIntegrations.installationId, installationId),
            eq(orgIntegrations.status, "active")
          )
        );

      // Resolve provider
      const providerDef = getProvider(provider);
      if (!providerDef) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown provider: ${provider}`,
        });
      }
      const backfill = providerDef.backfill;
      if (!backfill) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Provider "${provider}" does not support backfill`,
        });
      }

      const resolvedEntityTypes =
        entityTypes && entityTypes.length > 0
          ? entityTypes
          : [...backfill.defaultEntityTypes];

      const since = new Date(
        Date.now() - depth * 24 * 60 * 60 * 1000
      ).toISOString();

      // Get token for API calls
      const config = providerConfigs[provider];
      let token: string;
      try {
        ({ token } = await getActiveTokenForInstallation(
          installation,
          config,
          providerDef as ProviderDefinition
        ));
      } catch (err) {
        const message = parseError(err);
        log.error("[backfill] token acquisition failed for estimate", {
          installationId,
          provider,
          orgId,
          error: message,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get token: ${message}`,
        });
      }

      const api: ProviderApi = providerDef.api;

      // Resolve resource names live from provider API
      const resourceNameRequiredForRouting = ["github", "sentry"].includes(
        provider
      );
      const resolvedResources = (
        await Promise.all(
          resources.map(async (r) => {
            try {
              const resourceName = await backfill.resolveResourceMeta({
                providerResourceId: r.providerResourceId,
                token,
              });
              return { providerResourceId: r.providerResourceId, resourceName };
            } catch (resolveErr) {
              log.warn("[backfill] resolveResourceMeta failed", {
                installationId,
                provider,
                resourceId: r.providerResourceId,
                error: parseError(resolveErr),
              });
              if (resourceNameRequiredForRouting) {
                // GitHub/Sentry: can't estimate without valid path segments — skip
                return null;
              }
              // Linear/Vercel: resourceName not used in buildRequest — fallback is safe
              return {
                providerResourceId: r.providerResourceId,
                resourceName: r.providerResourceId,
              };
            }
          })
        )
      ).filter((r): r is NonNullable<typeof r> => r !== null);

      // Probe page 1 for each resource x entityType
      const probeJobs = resolvedEntityTypes.flatMap((entityType) =>
        resolvedResources.map(
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
                resourceName: resource.resourceName,
              },
              since,
            };

            try {
              const request = entityHandler.buildRequest(ctx, null);
              const endpoint = api.endpoints[entityHandler.endpointId];
              if (!endpoint) {
                return {
                  entityType,
                  sample: {
                    resourceId: resource.providerResourceId,
                    returnedCount: -1,
                    hasMore: false,
                  },
                };
              }

              // Build URL
              let path = endpoint.path;
              if (request.pathParams) {
                for (const [key, val] of Object.entries(request.pathParams)) {
                  path = path.replace(`{${key}}`, encodeURIComponent(val));
                }
              }

              let url = `${api.baseUrl}${path}`;
              if (
                request.queryParams &&
                Object.keys(request.queryParams).length > 0
              ) {
                url += `?${new URLSearchParams(request.queryParams).toString()}`;
              }

              const authHeader = api.buildAuthHeader
                ? api.buildAuthHeader(token)
                : `Bearer ${token}`;

              const headers: Record<string, string> = {
                Authorization: authHeader,
                ...(api.defaultHeaders ?? {}),
              };

              const fetchOptions: RequestInit = {
                method: endpoint.method,
                headers,
                signal: AbortSignal.timeout(endpoint.timeout ?? 30_000),
              };

              if (request.body) {
                fetchOptions.body = JSON.stringify(request.body);
                headers["Content-Type"] = "application/json";
              }

              const response = await fetch(url, fetchOptions);

              if (response.status !== 200) {
                return {
                  entityType,
                  sample: {
                    resourceId: resource.providerResourceId,
                    returnedCount: -1,
                    hasMore: false,
                  },
                };
              }

              const data = await response.json();
              const processed = entityHandler.processResponse(data, ctx, null);
              return {
                entityType,
                sample: {
                  resourceId: resource.providerResourceId,
                  returnedCount: processed.rawCount,
                  hasMore: processed.nextCursor !== null,
                },
              };
            } catch (probeErr) {
              log.warn("[backfill] estimate probe failed", {
                installationId,
                provider,
                resourceId: resource.providerResourceId,
                entityType,
                error: parseError(probeErr),
              });
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
          resources: resolvedResources.length,
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

      return {
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
      };
    }),
} satisfies TRPCRouterRecord;
