import { clerkOrgSlugSchema } from "@repo/app-validation";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { log } from "@vendor/observability/log/next";
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
        slug: clerkOrg.slug,
        name: clerkOrg.name,
        role: membership.role,
        imageUrl: clerkOrg.imageUrl,
      };
    });
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
        slug: clerkOrgSlugSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // userScopedProcedure guarantees clerk-pending or clerk-active
      log.info("[organization] create", {
        slug: input.slug,
        userId: ctx.auth.userId,
        authType: ctx.auth.type,
      });

      const clerk = await clerkClient();

      try {
        // Create Clerk organization (slug used for both name and slug)
        const clerkOrg = await clerk.organizations.createOrganization({
          name: input.slug,
          slug: input.slug,
          createdBy: ctx.auth.userId,
        });

        log.info("[organization] create success", {
          organizationId: clerkOrg.id,
          slug: clerkOrg.slug,
        });

        return {
          organizationId: clerkOrg.id,
          slug: clerkOrg.slug || input.slug,
        };
      } catch (error: unknown) {
        log.error("[organization] create failed", {
          slug: input.slug,
          userId: ctx.auth.userId,
          error: error instanceof Error ? error.message : String(error),
          errorDetails: error,
        });

        // Check for specific Clerk errors
        if (error && typeof error === "object" && "errors" in error) {
          const clerkError = error as {
            errors?: { code: string; message: string }[];
          };

          log.error("[organization] clerk error details", {
            errors: clerkError.errors,
          });

          if (
            clerkError.errors?.[0]?.code === "duplicate_record" ||
            clerkError.errors?.[0]?.code === "form_identifier_exists" ||
            clerkError.errors?.[0]?.message.includes("already exists") ||
            clerkError.errors?.[0]?.message.includes("slug is taken")
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
        name: clerkOrgSlugSchema,
      })
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

        log.info("[organization] updateName success", {
          organizationId: org.id,
          slug: input.name,
          userId: ctx.auth.userId,
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

        log.error("[organization] updateName failed", {
          slug: input.slug,
          userId: ctx.auth.userId,
          error: error instanceof Error ? error.message : String(error),
        });

        // Check for specific Clerk errors
        if (error && typeof error === "object" && "errors" in error) {
          const clerkError = error as {
            errors?: { code: string; message: string }[];
          };

          if (
            clerkError.errors?.[0]?.code === "duplicate_record" ||
            clerkError.errors?.[0]?.code === "form_identifier_exists" ||
            clerkError.errors?.[0]?.message.includes("already exists") ||
            clerkError.errors?.[0]?.message.includes("slug is taken")
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
