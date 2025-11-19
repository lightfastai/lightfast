import type { TRPCRouterRecord } from "@trpc/server";
import { db } from "@db/console/client";
import { workspaces } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getOrCreateDefaultWorkspace, getWorkspaceKey } from "@db/console/utils";

import { publicProcedure } from "../trpc";

/**
 * Workspace router - internal procedures for API routes
 * PUBLIC procedures for webhook/API route usage
 */
export const workspaceRouter = {
  /**
   * Resolve workspace ID and key from Clerk organization ID
   * Used by API routes to map organizations to their workspaces
   *
   * Returns:
   * - workspaceId: Database UUID for internal operations
   * - workspaceKey: External naming key (ws-<slug>) for Pinecone, etc.
   */
  resolveFromClerkOrgId: publicProcedure
    .input(
      z.object({
        clerkOrgId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      // Get or create default workspace for this Clerk organization
      const workspaceId = await getOrCreateDefaultWorkspace(
        input.clerkOrgId,
      );

      // Fetch workspace to get slug
      const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId),
      });

      if (!workspace) {
        throw new Error(`Workspace not found for ID: ${workspaceId}`);
      }

      // Compute workspace key from slug
      const workspaceKey = getWorkspaceKey(workspace.slug);

      return {
        workspaceId,
        workspaceKey,
        workspaceSlug: workspace.slug,
      };
    }),
} satisfies TRPCRouterRecord;
