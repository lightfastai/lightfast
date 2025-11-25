import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@clerk/nextjs/server";
import { protectedProcedure } from "../../trpc";

/**
 * Account Router
 *
 * Manages user account profile information from Clerk.
 * This router contains only non-table-based operations.
 *
 * Table-based operations have been moved to:
 * - API Keys: user-api-keys router
 * - Integrations: user-sources router
 */

export const accountRouter = {
	/**
	 * Get user profile information from Clerk
	 *
	 * Returns user data including:
	 * - Full name
	 * - Email addresses
	 * - Username
	 * - Profile image
	 */
	get: protectedProcedure.query(async ({ ctx }) => {
		try {
			const clerk = await clerkClient();
			const user = await clerk.users.getUser(ctx.auth.userId);

			return {
				id: user.id,
				firstName: user.firstName,
				lastName: user.lastName,
				fullName:
					user.firstName && user.lastName
						? `${user.firstName} ${user.lastName}`
						: user.firstName || user.lastName || null,
				username: user.username,
				primaryEmailAddress: user.primaryEmailAddress?.emailAddress || null,
				imageUrl: user.imageUrl,
				createdAt: new Date(user.createdAt).toISOString(),
			};
		} catch (error: unknown) {
			console.error("[tRPC] Failed to fetch user profile:", error);

			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to fetch user profile",
				cause: error,
			});
		}
	}),
} satisfies TRPCRouterRecord;
