import type { TRPCRouterRecord } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { userScopedProcedure, verifyOrgMembership } from "../../trpc";

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
	listUserOrganizations: userScopedProcedure.query(async ({ ctx }) => {
		// userScopedProcedure guarantees clerk-pending or clerk-active
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
	 * Find organization by Clerk organization ID or slug
	 *
	 * Unified procedure that replaces findByClerkOrgId and findByClerkOrgSlug.
	 * Returns organization data from Clerk.
	 * Used by org layout and pages.
	 */
	find: userScopedProcedure
		.input(
			z
				.object({
					clerkOrgId: z.string().optional(),
					clerkOrgSlug: z.string().optional(),
				})
				.refine((data) => data.clerkOrgId || data.clerkOrgSlug, {
					message: "Either clerkOrgId or clerkOrgSlug is required",
				}),
		)
		.query(async ({ ctx, input }) => {
			// userScopedProcedure guarantees clerk-pending or clerk-active
			const clerk = await clerkClient();

			try {
				// Get organization by ID or slug
				const clerkOrg = await clerk.organizations.getOrganization(
					input.clerkOrgId
						? { organizationId: input.clerkOrgId }
						: { slug: input.clerkOrgSlug! },
				);

				if (!clerkOrg) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Organization not found",
					});
				}

				// Verify user has access to this organization
				const membership = await verifyOrgMembership({
					clerkOrgId: clerkOrg.id,
					userId: ctx.auth.userId,
				});

				return {
					id: clerkOrg.id,
					slug: clerkOrg.slug ?? clerkOrg.id,
					name: clerkOrg.name,
					imageUrl: clerkOrg.imageUrl,
					role: membership.role,
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
	 * Find organization by Clerk organization ID
	 *
	 * @deprecated Use `find` procedure instead with `{ clerkOrgId }` parameter
	 *
	 * Returns organization data from Clerk.
	 * Used by org layout to prefetch org data.
	 */
	findByClerkOrgId: userScopedProcedure
		.input(
			z.object({
				clerkOrgId: z.string(),
			})
		)
		.query(async ({ ctx, input }) => {
			// userScopedProcedure guarantees clerk-pending or clerk-active
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
				const membership = await verifyOrgMembership({
					clerkOrgId: input.clerkOrgId,
					userId: ctx.auth.userId,
				});

				return {
					id: clerkOrg.id,
					slug: clerkOrg.slug ?? clerkOrg.id,
					name: clerkOrg.name,
					imageUrl: clerkOrg.imageUrl,
					role: membership.role,
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
	 * @deprecated Use `find` procedure instead with `{ clerkOrgSlug }` parameter
	 *
	 * Returns organization data from Clerk.
	 * Used by org pages that reference slug.
	 */
	findByClerkOrgSlug: userScopedProcedure
		.input(
			z.object({
				clerkOrgSlug: z.string(),
			})
		)
		.query(async ({ ctx, input }) => {
			// userScopedProcedure guarantees clerk-pending or clerk-active
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
				const membership = await verifyOrgMembership({
					clerkOrgId: clerkOrg.id,
					userId: ctx.auth.userId,
				});

				return {
					id: clerkOrg.id,
					slug: clerkOrg.slug ?? clerkOrg.id,
					name: clerkOrg.name,
					imageUrl: clerkOrg.imageUrl,
					role: membership.role,
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
	 * Create organization
	 * Creates a new Clerk organization with the user as admin
	 *
	 * Used by team creation flow at /account/teams/new
	 * Does NOT create a default workspace - user creates workspace separately at /new
	 */
	create: userScopedProcedure
		.input(
			z.object({
				slug: z
					.string()
					.min(3, "Team name must be at least 3 characters")
					.max(39, "Team name must be less than 39 characters")
					.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
						message:
							"Only lowercase letters, numbers, and hyphens allowed. No leading/trailing/consecutive hyphens.",
					}),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// userScopedProcedure guarantees clerk-pending or clerk-active
			console.log("[organization.create] Creating organization", {
				slug: input.slug,
				userId: ctx.auth.userId,
				authType: ctx.auth.type,  // Log whether pending or active
			});

			const clerk = await clerkClient();

			try {
				// Create Clerk organization (slug used for both name and slug)
				const clerkOrg = await clerk.organizations.createOrganization({
					name: input.slug,
					slug: input.slug,
					createdBy: ctx.auth.userId,
				});

				console.log("[organization.create] Successfully created organization", {
					organizationId: clerkOrg.id,
					slug: clerkOrg.slug,
				});

				return {
					organizationId: clerkOrg.id,
					slug: clerkOrg.slug || input.slug,
				};
			} catch (error: unknown) {
				console.error("[organization.create] Failed to create organization", {
					slug: input.slug,
					userId: ctx.auth.userId,
					error: error instanceof Error ? error.message : String(error),
					errorDetails: error,
				});

				// Check for specific Clerk errors
				if (error && typeof error === "object" && "errors" in error) {
					const clerkError = error as {
						errors?: Array<{ code: string; message: string }>;
					};

					console.error("[organization.create] Clerk error details", {
						errors: clerkError.errors,
					});

					if (
						clerkError.errors?.[0]?.code === "duplicate_record" ||
						clerkError.errors?.[0]?.message?.includes("already exists")
					) {
						throw new TRPCError({
							code: "CONFLICT",
							message: `An organization with the name "${input.slug}" already exists`,
						});
					}
				}

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create organization",
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
	updateName: userScopedProcedure
		.input(
			z.object({
				slug: z.string().min(1, "Organization slug is required"),
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
			// userScopedProcedure guarantees clerk-pending or clerk-active
			const clerk = await clerkClient();

			try {
				// Get organization by slug
				const org = await clerk.organizations.getOrganization({
					slug: input.slug,
				});

				// Verify user has admin access to the organization
				await verifyOrgMembership({
					clerkOrgId: org.id,
					userId: ctx.auth.userId,
					requireAdmin: true,
				});

				// Update organization in Clerk
				await clerk.organizations.updateOrganization(org.id, {
					name: input.name,
					slug: input.name, // Clerk uses slug for URL-safe names
				});

				return {
					success: true,
					id: org.id, // Return org ID for setActive calls
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
