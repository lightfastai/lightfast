import type { TRPCRouterRecord } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";

import { protectedProcedure } from "../trpc";

/**
 * Organization router - Clerk-based organization management
 *
 * Phase 1.6: Organizations are managed entirely in Clerk (source of truth)
 * No database table for organizations - Clerk handles all org data
 */
export const organizationRouter = {
	/**
	 * List user's organizations from Clerk
	 *
	 * Returns all organizations the authenticated user belongs to.
	 * Used by org-switcher component in the header.
	 */
	listUserOrganizations: protectedProcedure.query(async ({ ctx }) => {
		if (ctx.auth.type !== "clerk") {
			throw new Error("Clerk authentication required");
		}

		const userId = ctx.auth.userId;
		const clerk = await clerkClient();

		// Get all organizations the user belongs to from Clerk
		const { data: memberships } =
			await clerk.users.getOrganizationMembershipList({
				userId,
			});

		// Return Clerk organization data directly
		return memberships.map((membership) => {
			const clerkOrg = membership.organization;

			return {
				id: clerkOrg.id, // Clerk org ID
				slug: clerkOrg.slug ?? clerkOrg.id, // Fallback to ID if no slug
				name: clerkOrg.name,
				role: membership.role,
				imageUrl: clerkOrg.imageUrl,
			};
		});
	}),
} satisfies TRPCRouterRecord;
