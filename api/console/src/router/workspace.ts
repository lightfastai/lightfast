import type { TRPCRouterRecord } from "@trpc/server";
import { db } from "@db/console/client";
import { organizations, workspaces } from "@db/console/schema";
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
   * Resolve workspace ID and key from GitHub organization slug
   * Used by webhooks to map GitHub events to workspaces
   *
   * Returns:
   * - workspaceId: Database UUID for internal operations
   * - workspaceKey: External naming key (ws-<slug>) for Pinecone, etc.
   */
  resolveFromGithubOrgSlug: publicProcedure
    .input(
      z.object({
        githubOrgSlug: z.string(),
      }),
    )
    .query(async ({ input }) => {
      // Find organization by GitHub slug
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.githubOrgSlug, input.githubOrgSlug),
      });

      if (!org) {
        throw new Error(
          `Organization not found for GitHub slug: ${input.githubOrgSlug}`,
        );
      }

      // Get or create default workspace for this organization
      const workspaceId = await getOrCreateDefaultWorkspace(org.id);

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
