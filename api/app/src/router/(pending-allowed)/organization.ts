import { clerkOrgSlugSchema } from "@repo/app-validation";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { clerkClient, getUserOrgMemberships } from "@vendor/clerk/server";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";

import { isClerkConflictError } from "../../auth/clerk-errors";
import {
  getOrgAccessBySlug,
  isOrgAccessError,
  orgInitials,
} from "../../auth/organization-access";
import { pendingAllowedProcedure } from "../../trpc";

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
  listUserOrganizations: pendingAllowedProcedure.query(async ({ ctx }) => {
    // pendingAllowedProcedure guarantees pending or active identity
    const userId = ctx.auth.identity.userId;
    const memberships = await getUserOrgMemberships(userId);

    // Return Clerk organization data directly
    return memberships.map((membership) => {
      return {
        id: membership.organizationId, // Clerk org ID
        slug: membership.organizationSlug,
        name: membership.organizationName,
        initials: orgInitials(membership.organizationName),
        role: membership.role,
        imageUrl: membership.imageUrl,
      };
    });
  }),

  getBySlug: pendingAllowedProcedure
    .input(
      z.object({
        slug: clerkOrgSlugSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getOrgAccessBySlug({
          slug: input.slug,
          userId: ctx.auth.identity.userId,
        });
      } catch (error) {
        if (isOrgAccessError(error)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found",
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Create organization
   * Creates a new Clerk organization with the user as admin
   *
   * Used by team creation flow at /account/teams/new
   * Does NOT create a default project - user sets up integrations separately
   */
  create: pendingAllowedProcedure
    .input(
      z.object({
        slug: clerkOrgSlugSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // pendingAllowedProcedure guarantees pending or active identity
      log.info("[organization] create", {
        slug: input.slug,
        userId: ctx.auth.identity.userId,
        authType: ctx.auth.identity.type,
      });

      const clerk = await clerkClient();

      try {
        // Create Clerk organization (slug used for both name and slug)
        const clerkOrg = await clerk.organizations.createOrganization({
          name: input.slug,
          slug: input.slug,
          createdBy: ctx.auth.identity.userId,
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
          userId: ctx.auth.identity.userId,
          error: parseError(error),
          errorDetails: error,
        });

        if (isClerkConflictError(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `An organization with the name "${input.slug}" already exists`,
          });
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
  updateName: pendingAllowedProcedure
    .input(
      z.object({
        slug: z.string().min(1, "Organization slug is required"),
        name: clerkOrgSlugSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // pendingAllowedProcedure guarantees pending or active identity
      const clerk = await clerkClient();

      try {
        // Get organization by slug
        const org = await clerk.organizations.getOrganization({
          slug: input.slug,
        });

        // Verify user has admin access to the organization.
        // User-centric lookup (cached) — typically 1-5 orgs per user vs 100+ members per org.
        const memberships = await getUserOrgMemberships(
          ctx.auth.identity.userId
        );
        const membership = memberships.find((m) => m.organizationId === org.id);
        if (!membership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this organization",
          });
        }
        if (membership.role !== "org:admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only administrators can perform this action",
          });
        }

        // Update organization in Clerk
        await clerk.organizations.updateOrganization(org.id, {
          name: input.name,
          slug: input.name, // Clerk uses slug for URL-safe names
        });

        log.info("[organization] updateName success", {
          organizationId: org.id,
          slug: input.name,
          userId: ctx.auth.identity.userId,
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
          userId: ctx.auth.identity.userId,
          error: parseError(error),
        });

        if (isClerkConflictError(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `An organization with the name "${input.name}" already exists`,
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update organization",
          cause: error,
        });
      }
    }),
} satisfies TRPCRouterRecord;
