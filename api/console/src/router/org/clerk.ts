import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { userScopedProcedure } from "../../trpc";
import { clerkClient } from "@clerk/nextjs/server";
import {
	getOrganizationMembership,
	type OrgMembershipRole,
} from "@repo/console-octokit-github";

/**
 * Clerk Integration Router
 *
 * Manages Clerk organization operations including:
 * - Organization creation with slug collision handling
 * - User membership management
 * - Role mapping from GitHub to Clerk
 */
export const clerkRouter = {
	/**
	 * Create or get a Clerk organization
	 *
	 * Handles slug collisions by appending timestamp.
	 */
	createOrGetOrganization: userScopedProcedure
		.input(
			z.object({
				orgName: z.string(),
				orgSlug: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { orgName, orgSlug } = input;

			try {
				const clerk = await clerkClient();
				const clerkOrg = await clerk.organizations.createOrganization({
					name: orgName,
					slug: orgSlug,
					createdBy: ctx.auth.userId,
				});

				return {
					clerkOrgId: clerkOrg.id,
					clerkOrgSlug: clerkOrg.slug,
				};
			} catch (error) {
				// Handle slug collision by appending timestamp
				if (error instanceof Error && error.message.includes("slug")) {
					const clerk = await clerkClient();
					const uniqueSlug = `${orgSlug}-${Date.now()}`;
					const clerkOrg = await clerk.organizations.createOrganization({
						name: orgName,
						slug: uniqueSlug,
						createdBy: ctx.auth.userId,
					});

					return {
						clerkOrgId: clerkOrg.id,
						clerkOrgSlug: clerkOrg.slug,
					};
				}

				throw error;
			}
		}),

	/**
	 * Add user to Clerk organization
	 *
	 * Verifies GitHub membership and maps role to Clerk.
	 */
	addUserToOrganization: userScopedProcedure
		.input(
			z.object({
				clerkOrgId: z.string(),
				userId: z.string(),
				githubToken: z.string(),
				githubOrgSlug: z.string(),
				githubUsername: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			const {
				clerkOrgId,
				userId,
				githubToken,
				githubOrgSlug,
				githubUsername,
			} = input;

			// Verify GitHub membership
			const membership = await getOrganizationMembership(
				githubToken,
				githubOrgSlug,
				githubUsername,
			);

			if (membership.state !== "active") {
				throw new Error(`Membership not active: ${membership.state}`);
			}

			// Map GitHub role to Clerk role
			const clerkRole = mapGitHubRoleToClerkRole(membership.role);

			// Add user to Clerk organization
			const clerk = await clerkClient();
			await clerk.organizations.createOrganizationMembership({
				organizationId: clerkOrgId,
				userId,
				role: clerkRole,
			});

			return { role: membership.role };
		}),
} satisfies TRPCRouterRecord;

/**
 * Map GitHub organization role to Clerk role
 */
function mapGitHubRoleToClerkRole(
	githubRole: OrgMembershipRole,
): "org:admin" | "org:member" {
	return githubRole === "admin" ? "org:admin" : "org:member";
}
