/**
 * Backfill Router
 *
 * Manages backfill operations for importing historical data from connected sources.
 * Provides start, status, and cancel endpoints for backfill workflows.
 */
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { workspaceIntegrations, orgWorkspaces } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { inngest } from "@api/console/inngest";
import { hasConnector, getConnector } from "@repo/console-backfill";
import { backfillDepthSchema, sourceTypeSchema } from "@repo/console-validation/schemas";

import { orgScopedProcedure } from "../../trpc";

interface BackfillState {
  status?: string;
  startedAt?: string;
  completedAt?: string;
  depth?: number;
  entityTypes?: string[];
  requestedBy?: string;
  error?: string;
  eventsProduced?: number;
  eventsDispatched?: number;
  errorCount?: number;
  durationMs?: number;
  nextAllowedAt?: string;
  checkpoint?: {
    currentEntityType?: string;
    eventsProduced?: number;
    eventsDispatched?: number;
    updatedAt?: string;
  };
}

export const backfillRouter = {
  /**
   * Start a backfill for an integration
   *
   * Triggers the backfill orchestrator to import historical data
   * from the connected source into the observation pipeline.
   */
  start: orgScopedProcedure
    .input(
      z.object({
        integrationId: z.string(),
        depth: backfillDepthSchema,
        entityTypes: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Verify integration exists and belongs to user's org
      const integration = await ctx.db.query.workspaceIntegrations.findFirst({
        where: eq(workspaceIntegrations.id, input.integrationId),
      });

      if (!integration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration not found",
        });
      }

      if (!integration.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Integration is not active",
        });
      }

      // Verify workspace belongs to user's org
      const workspace = await ctx.db.query.orgWorkspaces.findFirst({
        where: and(
          eq(orgWorkspaces.id, integration.workspaceId),
          eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId),
        ),
      });

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      // 2. Check for active backfill
      const sourceConfig = integration.sourceConfig as Record<string, unknown>;
      const backfill = sourceConfig.backfill as BackfillState | undefined;

      if (backfill?.status === "running" || backfill?.status === "pending") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A backfill is already in progress for this integration",
        });
      }

      // 3. Check cooldown
      if (backfill?.nextAllowedAt) {
        const nextAllowed = new Date(backfill.nextAllowedAt);
        if (nextAllowed > new Date()) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Backfill cooldown active. Try again after ${nextAllowed.toISOString()}`,
          });
        }
      }

      // 4. Verify connector exists
      const rawProvider = (sourceConfig as { sourceType?: string }).sourceType;
      const providerParsed = sourceTypeSchema.safeParse(rawProvider);
      if (!providerParsed.success || !hasConnector(providerParsed.data)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No backfill connector available for provider: ${rawProvider}`,
        });
      }
      const provider = providerParsed.data;

      // 5. Resolve entity types
      const connector = getConnector(provider);
      const entityTypes = input.entityTypes ?? connector?.defaultEntityTypes ?? [];

      // 6. Set backfill status to pending
      await ctx.db
        .update(workspaceIntegrations)
        .set({
          sourceConfig: sql`jsonb_set(
            COALESCE(${workspaceIntegrations.sourceConfig}::jsonb, '{}'::jsonb),
            '{backfill}',
            ${JSON.stringify({ status: "pending", requestedBy: ctx.auth.userId, depth: input.depth, entityTypes })}::jsonb
          )`,
        })
        .where(eq(workspaceIntegrations.id, input.integrationId));

      // 7. Send backfill.requested Inngest event
      await inngest.send({
        name: "apps-console/backfill.requested",
        data: {
          integrationId: input.integrationId,
          workspaceId: integration.workspaceId,
          clerkOrgId: ctx.auth.orgId,
          provider,
          userSourceId: integration.userSourceId,
          depth: input.depth,
          entityTypes,
          requestedBy: ctx.auth.userId,
        },
      });

      return {
        success: true,
        status: "pending" as const,
      };
    }),

  /**
   * Get backfill status for an integration
   *
   * Returns the current backfill state including progress checkpoint.
   */
  status: orgScopedProcedure
    .input(
      z.object({
        integrationId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const integration = await ctx.db.query.workspaceIntegrations.findFirst({
        where: eq(workspaceIntegrations.id, input.integrationId),
      });

      if (!integration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration not found",
        });
      }

      // Verify workspace belongs to user's org
      const workspace = await ctx.db.query.orgWorkspaces.findFirst({
        where: and(
          eq(orgWorkspaces.id, integration.workspaceId),
          eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId),
        ),
      });

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      const sourceConfig = integration.sourceConfig as Record<string, unknown>;
      const backfill = (sourceConfig.backfill as BackfillState | undefined) ?? {
        status: "idle",
      };

      return {
        status: backfill.status ?? "idle",
        startedAt: backfill.startedAt,
        completedAt: backfill.completedAt,
        depth: backfill.depth,
        entityTypes: backfill.entityTypes,
        requestedBy: backfill.requestedBy,
        error: backfill.error,
        eventsProduced: backfill.eventsProduced,
        eventsDispatched: backfill.eventsDispatched,
        errorCount: backfill.errorCount,
        durationMs: backfill.durationMs,
        nextAllowedAt: backfill.nextAllowedAt,
        checkpoint: backfill.checkpoint,
      };
    }),

  /**
   * Cancel an in-progress backfill
   *
   * Sends a cancellation event to stop the Inngest workflow and
   * immediately updates the integration state.
   */
  cancel: orgScopedProcedure
    .input(
      z.object({
        integrationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const integration = await ctx.db.query.workspaceIntegrations.findFirst({
        where: eq(workspaceIntegrations.id, input.integrationId),
      });

      if (!integration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration not found",
        });
      }

      // Verify workspace belongs to user's org
      const workspace = await ctx.db.query.orgWorkspaces.findFirst({
        where: and(
          eq(orgWorkspaces.id, integration.workspaceId),
          eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId),
        ),
      });

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      // Verify there's an active backfill to cancel
      const sourceConfig = integration.sourceConfig as Record<string, unknown>;
      const backfill = sourceConfig.backfill as BackfillState | undefined;

      if (backfill?.status !== "running" && backfill?.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active backfill to cancel",
        });
      }

      // Send cancellation event (triggers Inngest cancelOn)
      await inngest.send({
        name: "apps-console/backfill.cancelled",
        data: {
          integrationId: input.integrationId,
          cancelledBy: ctx.auth.userId,
        },
      });

      // Immediately update state to cancelled
      await ctx.db
        .update(workspaceIntegrations)
        .set({
          sourceConfig: sql`jsonb_set(
            jsonb_set(
              COALESCE(${workspaceIntegrations.sourceConfig}::jsonb, '{}'::jsonb),
              '{backfill,status}', '"cancelled"'::jsonb
            ),
            '{backfill,completedAt}', ${JSON.stringify(new Date().toISOString())}::jsonb
          )`,
        })
        .where(eq(workspaceIntegrations.id, input.integrationId));

      return {
        success: true,
        status: "cancelled" as const,
      };
    }),
} satisfies TRPCRouterRecord;
