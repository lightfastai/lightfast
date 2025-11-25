import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { db } from "@db/console/client";
import { orgWorkspaces } from "@db/console/schema";
import { eq, desc } from "drizzle-orm";
import { workspaceListInputSchema } from "@repo/console-validation/schemas";
import { clerkClient } from "@vendor/clerk/server";

import { userScopedProcedure } from "../../trpc";

/**
 * User-scoped workspace access router
 * For workspace queries that can be accessed before org activation
 */
export const workspaceAccessRouter = {
  /**
   * List workspaces for a Clerk organization by slug
   * Used by the org/workspace switcher to show available workspaces
   *
   * IMPORTANT: This procedure manually verifies the user has access to the org from the URL.
   * It uses userScopedProcedure (allows pending users) because it's called during RSC prefetch
   * before middleware's organizationSyncOptions activates the org.
   *
   * Returns basic workspace info only.
   */
  listByClerkOrgSlug: userScopedProcedure
    .input(workspaceListInputSchema)
    .query(async ({ ctx, input }) => {
      // Get org by slug from URL
      const clerk = await clerkClient();

      let clerkOrg;
      try {
        clerkOrg = await clerk.organizations.getOrganization({
          slug: input.clerkOrgSlug,
        });
      } catch {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Organization not found: ${input.clerkOrgSlug}`,
        });
      }

      if (!clerkOrg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Organization not found: ${input.clerkOrgSlug}`,
        });
      }

      // Verify user has access to this organization
      const membership = await clerk.organizations.getOrganizationMembershipList({
        organizationId: clerkOrg.id,
      });

      const userMembership = membership.data.find(
        (m) => m.publicUserData?.userId === ctx.auth.userId,
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied to this organization",
        });
      }

      // Fetch all workspaces for this organization (basic info only)
      const orgWorkspacesData = await db.query.orgWorkspaces.findMany({
        where: eq(orgWorkspaces.clerkOrgId, clerkOrg.id),
        orderBy: [desc(orgWorkspaces.createdAt)],
      });

      return orgWorkspacesData.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        createdAt: workspace.createdAt,
      }));
    }),
} satisfies TRPCRouterRecord;
