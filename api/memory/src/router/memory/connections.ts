/**
 * Connections tRPC sub-router.
 *
 * All procedures use serviceProcedure (JWT auth required).
 * orgId comes as an input parameter (no tenant middleware in tRPC).
 *
 * `disconnect` fires the "memory/connection.lifecycle" Inngest event
 * to trigger the connection teardown workflow.
 */
import { db } from "@db/console/client";
import {
  gatewayBackfillRuns,
  gatewayInstallations,
  gatewayLifecycleLogs,
  gatewayResources,
} from "@db/console/schema";
import type { ProviderDefinition } from "@repo/console-providers";
import { getProvider, sourceTypeSchema } from "@repo/console-providers";
import {
  BACKFILL_TERMINAL_STATUSES,
  backfillRunRecord,
} from "@repo/console-providers/contracts";
import { TRPCError } from "@trpc/server";
import type { TRPCRouterRecord } from "@trpc/server";
import { and, eq, sql } from "@vendor/db";
import { redis } from "@vendor/upstash";
import { z } from "zod";

import { inngest } from "../../inngest/client.js";
import { resourceKey } from "../../lib/cache.js";
import { buildAuthorizeUrl } from "../../lib/oauth/authorize.js";
import { providerConfigs } from "../../lib/provider-configs.js";
import {
  getActiveTokenForInstallation,
} from "../../lib/token-helpers.js";
import { serviceProcedure } from "../../trpc.js";

// ── Connections Router ──────────────────────────────────────────────────────

export const connectionsRouter = {
  /**
   * List installations, optionally filtered by status.
   * Source: GET /connections
   */
  list: serviceProcedure
    .input(
      z.object({
        orgId: z.string(),
        status: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const conditions = [eq(gatewayInstallations.orgId, input.orgId)];
      if (input.status) {
        conditions.push(eq(gatewayInstallations.status, input.status));
      }

      const rows = await db
        .select({
          id: gatewayInstallations.id,
          provider: gatewayInstallations.provider,
          externalId: gatewayInstallations.externalId,
          orgId: gatewayInstallations.orgId,
          status: gatewayInstallations.status,
        })
        .from(gatewayInstallations)
        .where(and(...conditions));

      return rows;
    }),

  /**
   * Get connection details by ID.
   * Source: GET /connections/:id
   */
  get: serviceProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input }) => {
      const installation = await db.query.gatewayInstallations.findFirst({
        where: eq(gatewayInstallations.id, input.id),
        with: {
          tokens: {
            columns: {
              id: true,
              expiresAt: true,
              tokenType: true,
              scope: true,
              updatedAt: true,
            },
          },
          resources: { where: eq(gatewayResources.status, "active") },
        },
      });

      if (!installation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      return {
        id: installation.id,
        provider: installation.provider,
        externalId: installation.externalId,
        orgId: installation.orgId,
        status: installation.status,
        hasToken:
          !getProvider(installation.provider).auth.usesStoredToken ||
          installation.tokens.length > 0,
        tokenExpiresAt: installation.tokens[0]?.expiresAt ?? null,
        resources: installation.resources.map(
          (r: (typeof installation.resources)[number]) => ({
            id: r.id,
            providerResourceId: r.providerResourceId,
            resourceName: r.resourceName,
          })
        ),
        createdAt: installation.createdAt,
        updatedAt: installation.updatedAt,
      };
    }),

  /**
   * Token vault -- returns decrypted provider token for a connection.
   * Source: GET /connections/:id/token
   */
  getToken: serviceProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input }) => {
      const installationRows = await db
        .select()
        .from(gatewayInstallations)
        .where(eq(gatewayInstallations.id, input.id))
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
          message: `Installation not active (status: ${installation.status})`,
        });
      }

      const providerName = installation.provider;
      const config = providerConfigs[providerName];

      try {
        const providerDef = getProvider(providerName);

        // SAFETY: getProvider() returns the full generic ProviderDefinition<TConfig, ...>
        // but the helper takes the base ProviderDefinition. The generic parameters are
        // erased at runtime -- the cast is safe because the concrete type is a supertype.
        const { token, expiresAt } = await getActiveTokenForInstallation(
          installation,
          config,
          providerDef as ProviderDefinition
        );

        return {
          accessToken: token,
          provider: providerName,
          expiresIn: expiresAt
            ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
            : 3600, // GitHub installation tokens expire in 1 hour
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown";
        if (message === "no_token_found") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "no_token_found",
          });
        }
        if (
          message === "token_expired" ||
          message === "token_expired:no_refresh_token"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `token_generation_failed: ${message}`,
        });
      }
    }),

  /**
   * Disconnect (teardown) a connection.
   *
   * Fires "memory/connection.lifecycle" Inngest event to initiate teardown.
   */
  disconnect: serviceProcedure
    .input(
      z.object({
        id: z.string(),
        provider: sourceTypeSchema,
      })
    )
    .mutation(async ({ input }) => {
      const installationRows = await db
        .select()
        .from(gatewayInstallations)
        .where(
          and(
            eq(gatewayInstallations.id, input.id),
            eq(gatewayInstallations.provider, input.provider)
          )
        )
        .limit(1);

      const installation = installationRows[0];

      if (!installation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      // Audit log: capture user-initiated disconnect intent before event fires
      await db.insert(gatewayLifecycleLogs).values({
        installationId: input.id,
        event: "user_disconnect",
        fromStatus: installation.status,
        toStatus: "revoked",
        reason: "User-initiated disconnect via memory service",
        metadata: { source: "memory_disconnect_handler", triggeredBy: "user" },
      });

      // Fire Inngest event to trigger connection teardown workflow
      await inngest.send({
        name: "memory/connection.lifecycle",
        data: {
          reason: "user_disconnect",
          installationId: input.id,
          orgId: installation.orgId,
          provider: input.provider,
          triggeredBy: "user" as const,
        },
      });

      return { status: "teardown_initiated", installationId: input.id };
    }),

  /**
   * Build OAuth authorize URL for a provider.
   * Source: GET /connections/:provider/authorize
   */
  getAuthorizeUrl: serviceProcedure
    .input(
      z.object({
        provider: sourceTypeSchema,
        orgId: z.string(),
        connectedBy: z.string(),
        redirectTo: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const result = await buildAuthorizeUrl({
        provider: input.provider,
        orgId: input.orgId,
        connectedBy: input.connectedBy,
        redirectTo: input.redirectTo,
      });

      if (!result.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error,
        });
      }

      return { url: result.url, state: result.state };
    }),

  /**
   * Link a resource to a connection.
   * Source: POST /connections/:id/resources
   */
  registerResource: serviceProcedure
    .input(
      z.object({
        installationId: z.string(),
        providerResourceId: z.string().min(1),
        resourceName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
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
          message: `Installation not active (status: ${installation.status})`,
        });
      }

      // Check for existing active resource link
      const existingRows = await db
        .select({ id: gatewayResources.id })
        .from(gatewayResources)
        .where(
          and(
            eq(gatewayResources.installationId, input.installationId),
            eq(gatewayResources.providerResourceId, input.providerResourceId),
            eq(gatewayResources.status, "active")
          )
        )
        .limit(1);

      const existing = existingRows[0];

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Resource already linked (resourceId: ${existing.id})`,
        });
      }

      const resourceRows = await db
        .insert(gatewayResources)
        .values({
          installationId: input.installationId,
          providerResourceId: input.providerResourceId,
          resourceName: input.resourceName,
          status: "active",
        })
        .onConflictDoUpdate({
          target: [
            gatewayResources.installationId,
            gatewayResources.providerResourceId,
          ],
          set: {
            status: "active",
            ...(input.resourceName !== undefined
              ? { resourceName: input.resourceName }
              : {}),
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        })
        .returning();

      const resource = resourceRows[0];
      if (!resource) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Resource insert failed",
        });
      }

      // Populate Redis routing cache
      await redis.hset(
        resourceKey(installation.provider, input.providerResourceId),
        { connectionId: input.installationId, orgId: installation.orgId }
      );

      return {
        status: "linked" as const,
        resource: {
          id: resource.id,
          providerResourceId: resource.providerResourceId,
          resourceName: resource.resourceName,
        },
      };
    }),

  /**
   * Unlink a resource from a connection.
   * Source: DELETE /connections/:id/resources/:resourceId
   */
  removeResource: serviceProcedure
    .input(
      z.object({
        installationId: z.string(),
        resourceId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const resourceRows = await db
        .select()
        .from(gatewayResources)
        .where(
          and(
            eq(gatewayResources.id, input.resourceId),
            eq(gatewayResources.installationId, input.installationId)
          )
        )
        .limit(1);

      const resource = resourceRows[0];

      if (!resource) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      if (resource.status === "removed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Resource already removed",
        });
      }

      await db
        .update(gatewayResources)
        .set({ status: "removed" })
        .where(eq(gatewayResources.id, input.resourceId));

      const installationRows = await db
        .select({ provider: gatewayInstallations.provider })
        .from(gatewayInstallations)
        .where(eq(gatewayInstallations.id, input.installationId))
        .limit(1);

      const installation = installationRows[0];

      if (installation) {
        await redis.del(
          resourceKey(installation.provider, resource.providerResourceId)
        );
      }

      return { status: "removed" as const, resourceId: input.resourceId };
    }),

  /**
   * List backfill runs for a connection.
   * Source: GET /connections/:id/backfill-runs
   */
  listBackfillRuns: serviceProcedure
    .input(
      z.object({
        installationId: z.string(),
        status: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const conditions = [
        eq(gatewayBackfillRuns.installationId, input.installationId),
      ];
      if (input.status) {
        conditions.push(eq(gatewayBackfillRuns.status, input.status));
      }

      const runs = await db
        .select({
          entityType: gatewayBackfillRuns.entityType,
          providerResourceId: gatewayBackfillRuns.providerResourceId,
          since: gatewayBackfillRuns.since,
          depth: gatewayBackfillRuns.depth,
          status: gatewayBackfillRuns.status,
          pagesProcessed: gatewayBackfillRuns.pagesProcessed,
          eventsProduced: gatewayBackfillRuns.eventsProduced,
          eventsDispatched: gatewayBackfillRuns.eventsDispatched,
          completedAt: gatewayBackfillRuns.completedAt,
        })
        .from(gatewayBackfillRuns)
        .where(and(...conditions));

      return runs;
    }),

  /**
   * Upsert a backfill run record.
   * Source: POST /connections/:id/backfill-runs
   */
  upsertBackfillRun: serviceProcedure
    .input(
      z.object({
        installationId: z.string(),
        run: backfillRunRecord,
      })
    )
    .mutation(async ({ input }) => {
      const now = new Date().toISOString();
      const data = input.run;
      const isTerminal = (
        BACKFILL_TERMINAL_STATUSES as readonly string[]
      ).includes(data.status);

      const sharedFields = {
        since: data.since,
        depth: data.depth,
        status: data.status,
        pagesProcessed: data.pagesProcessed,
        eventsProduced: data.eventsProduced,
        eventsDispatched: data.eventsDispatched,
        error: data.error ?? null,
        completedAt: isTerminal ? now : null,
        updatedAt: now,
      };

      await db
        .insert(gatewayBackfillRuns)
        .values({
          installationId: input.installationId,
          entityType: data.entityType,
          providerResourceId: data.providerResourceId,
          ...sharedFields,
          startedAt: data.status === "running" ? now : null,
        })
        .onConflictDoUpdate({
          target: [
            gatewayBackfillRuns.installationId,
            gatewayBackfillRuns.providerResourceId,
            gatewayBackfillRuns.entityType,
          ],
          set: sharedFields,
        });

      return { status: "ok" as const };
    }),
} satisfies TRPCRouterRecord;
