import type { TRPCRouterRecord } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

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

	/**
	 * Find organization by Clerk organization ID
	 *
	 * Returns organization data from Clerk.
	 * Used by org layout to prefetch org data.
	 */
	findByClerkOrgId: protectedProcedure
		.input(
			z.object({
				clerkOrgId: z.string(),
			})
		)
		.query(async ({ ctx, input }) => {
			if (ctx.auth.type !== "clerk") {
				throw new Error("Clerk authentication required");
			}

			const clerk = await clerkClient();

			try {
				const clerkOrg = await clerk.organizations.getOrganization({
					organizationId: input.clerkOrgId,
				});

				if (!clerkOrg) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Organization not found",
					});
				}

				// Verify user has access to this organization
				const userId = ctx.auth.userId;
				const membership = await clerk.organizations.getOrganizationMembershipList({
					organizationId: input.clerkOrgId,
				});

				const userMembership = membership.data.find(
					(m) => m.publicUserData?.userId === userId
				);

				if (!userMembership) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "Access denied to this organization",
					});
				}

				return {
					id: clerkOrg.id,
					slug: clerkOrg.slug ?? clerkOrg.id,
					name: clerkOrg.name,
					imageUrl: clerkOrg.imageUrl,
					role: userMembership.role,
				};
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch organization",
					cause: error,
				});
			}
		}),

	/**
	 * Find organization by Clerk organization slug
	 *
	 * Returns organization data from Clerk.
	 * Used by org pages that reference slug.
	 */
	findByClerkOrgSlug: protectedProcedure
		.input(
			z.object({
				clerkOrgSlug: z.string(),
			})
		)
		.query(async ({ ctx, input }) => {
			if (ctx.auth.type !== "clerk") {
				throw new Error("Clerk authentication required");
			}

			const clerk = await clerkClient();

			try {
				// Get organization by slug
				const clerkOrg = await clerk.organizations.getOrganization({
					slug: input.clerkOrgSlug,
				});

				if (!clerkOrg) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Organization not found",
					});
				}

				// Verify user has access to this organization
				const userId = ctx.auth.userId;
				const membership = await clerk.organizations.getOrganizationMembershipList({
					organizationId: clerkOrg.id,
				});

				const userMembership = membership.data.find(
					(m) => m.publicUserData?.userId === userId
				);

				if (!userMembership) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "Access denied to this organization",
					});
				}

				return {
					id: clerkOrg.id,
					slug: clerkOrg.slug ?? clerkOrg.id,
					name: clerkOrg.name,
					imageUrl: clerkOrg.imageUrl,
					role: userMembership.role,
				};
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch organization",
					cause: error,
				});
			}
		}),

	/**
	 * Update organization name
	 * Used by team settings page to update the organization name/slug in Clerk
	 *
	 * Only organization admins can update the organization name
	 */
	updateName: protectedProcedure
		.input(
			z.object({
				organizationId: z.string().min(1, "Organization ID is required"),
				name: z
					.string()
					.min(3, "Team name must be at least 3 characters")
					.max(39, "Team name must be less than 39 characters")
					.regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens are allowed")
					.regex(/^[a-z0-9]/, "Must start with a letter or number")
					.regex(/[a-z0-9]$/, "Must end with a letter or number")
					.refine((val) => !/-{2,}/.test(val), {
						message: "Cannot contain consecutive hyphens",
					}),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (ctx.auth.type !== "clerk") {
				throw new Error("Clerk authentication required");
			}

			const clerk = await clerkClient();

			try {
				// Verify user has admin access to the organization
				const membership = await clerk.organizations.getOrganizationMembershipList({
					organizationId: input.organizationId,
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

				// Only admins can update org name
				if (userMembership.role !== "org:admin") {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "Only administrators can update organization settings",
					});
				}

				// Update organization in Clerk
				await clerk.organizations.updateOrganization(input.organizationId, {
					name: input.name,
					slug: input.name, // Clerk uses slug for URL-safe names
				});

				return {
					success: true,
					name: input.name,
				};
			} catch (error: unknown) {
				// Re-throw TRPCError as-is
				if (error instanceof TRPCError) {
					throw error;
				}

				// Check for specific Clerk errors
				if (error && typeof error === "object" && "errors" in error) {
					const clerkError = error as {
						errors?: Array<{ code: string; message: string }>;
					};

					if (
						clerkError.errors?.[0]?.code === "duplicate_record" ||
						clerkError.errors?.[0]?.message?.includes("already exists")
					) {
						throw new TRPCError({
							code: "CONFLICT",
							message: `An organization with the name "${input.name}" already exists`,
						});
					}
				}

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update organization",
					cause: error,
				});
			}
		}),
} satisfies TRPCRouterRecord;
