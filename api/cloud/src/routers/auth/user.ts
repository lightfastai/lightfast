import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import { currentUser, clerkClient } from "@clerk/nextjs/server";

export const userRouter = {
  /**
   * Get current user info
   */
  getUser: protectedProcedure
    .query(async ({ ctx }) => {
      // Fetch full user data from Clerk
      const user = await currentUser();
      
      return {
        userId: ctx.session.data.userId,
        email: user?.emailAddresses?.[0]?.emailAddress || null,
        firstName: user?.firstName || null,
        lastName: user?.lastName || null,
        username: user?.username || null,
        imageUrl: user?.imageUrl || null,
      };
    }),

  /**
   * Get user's organizations
   */
  getUserOrganizations: protectedProcedure
    .query(async ({ ctx }) => {
      const { userId } = ctx.session.data;
      
      // Get organizations where the user is a member
      const client = await clerkClient();
      const { data: organizationMemberships } = await client.users.getOrganizationMembershipList({
        userId,
      });

      return organizationMemberships.map(membership => ({
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        imageUrl: membership.organization.imageUrl,
        role: membership.role,
      }));
    }),
} satisfies TRPCRouterRecord;