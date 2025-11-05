import type { TRPCRouterRecord } from "@trpc/server";
import { clerkClient } from "@clerk/nextjs/server";

import { apiKeyProtectedProcedure } from "../trpc";

/**
 * User router - handles user-related queries
 * Uses API key authentication for CLI access
 */
export const userRouter = {
  /**
   * Get organizations for the authenticated user
   * Uses Clerk to fetch organization memberships
   */
  organizations: apiKeyProtectedProcedure.query(async ({ ctx }) => {
    const clerk = await clerkClient();

    // Get user's organization memberships from Clerk
    // ctx.auth is guaranteed to be type "apiKey" by the procedure
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId: ctx.auth.userId,
    });

    // Transform to expected format
    const organizations = memberships.data.map((membership) => ({
      id: membership.organization.id,
      slug: membership.organization.slug ?? "",
      name: membership.organization.name,
      role: membership.role,
    }));

    return organizations;
  }),
} satisfies TRPCRouterRecord;
