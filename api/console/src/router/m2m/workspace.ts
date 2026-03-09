import { db } from "@db/console/client";
import { orgWorkspaces } from "@db/console/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { inngestM2MProcedure } from "../../trpc";

/**
 * Workspace M2M Router
 *
 * Machine-to-machine procedures for workspace management.
 * Used exclusively by Inngest workflows.
 *
 * User-facing workspace operations are in org/workspace router.
 */
export const workspaceM2MRouter = {
  /**
   * Get workspace by ID (Inngest workflows)
   *
   * Used by workflows to fetch workspace details (especially clerkOrgId).
   */
  get: inngestM2MProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input }) => {
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, input.workspaceId),
      });

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Workspace not found: ${input.workspaceId}`,
        });
      }

      return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        clerkOrgId: workspace.clerkOrgId,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      };
    }),
} satisfies TRPCRouterRecord;
