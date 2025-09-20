import type { TRPCRouterRecord } from "@trpc/server";
import { CloudAgent } from "@db/cloud/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  protectedProcedure,
  TRPCError,
} from "../trpc";

export const agentRouter = {
  /**
   * List all agents for the current organization
   */
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const { db, organization } = ctx;

      if (!organization?.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Organization context required",
        });
      }

      try {
        const agents = await db
          .select({
            id: CloudAgent.id,
            name: CloudAgent.name,
            bundleUrl: CloudAgent.bundleUrl,
            createdAt: CloudAgent.createdAt,
            createdByUserId: CloudAgent.createdByUserId,
            metadata: CloudAgent.metadata,
          })
          .from(CloudAgent)
          .where(eq(CloudAgent.clerkOrgId, organization.id))
          .orderBy(CloudAgent.createdAt);

        return {
          agents,
          total: agents.length,
        };
      } catch (error) {
        console.error('List agents error:', error);
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch agents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  /**
   * Get a specific agent by ID
   */
  get: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid("Invalid agent ID"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db, organization } = ctx;
      const { id } = input;

      if (!organization?.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Organization context required",
        });
      }

      try {
        const [agent] = await db
          .select()
          .from(CloudAgent)
          .where(eq(CloudAgent.id, id))
          .limit(1);

        if (!agent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Agent not found",
          });
        }

        // Verify ownership
        if (agent.clerkOrgId !== organization.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied",
          });
        }

        return agent;
      } catch (error) {
        console.error('Get agent error:', error);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

} satisfies TRPCRouterRecord;