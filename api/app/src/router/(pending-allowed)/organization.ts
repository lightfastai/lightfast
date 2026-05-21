import { clerkOrgSlugSchema } from "@repo/app-validation";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";

import { isClerkConflictError } from "../../auth/clerk-errors";
import {
  getOrgAccessBySlug,
  isOrgAccessError,
  orgInitials,
} from "../../auth/organization-access";
import { orgAdminProcedure, viewerProcedure } from "../../trpc";

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
  listUserOrganizations: viewerProcedure.query(async ({ ctx }) => {
    // viewerProcedure guarantees pending or active identity
    const userId = ctx.auth.identity.userId;
    const clerk = await clerkClient();
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId,
    });

    // Return Clerk organization data directly
    return memberships.data.map((membership) => {
      return {
        id: membership.organization.id, // Clerk org ID
        slug: membership.organization.slug,
        name: membership.organization.name,
        initials: orgInitials(membership.organization.name),
        role: membership.role,
        imageUrl: membership.organization.imageUrl,
      };
    });
  }),

  getBySlug: viewerProcedure
    .input(
      z.object({
        slug: clerkOrgSlugSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getOrgAccessBySlug({
          db: ctx.db,
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
  create: viewerProcedure
    .input(
      z.object({
        slug: clerkOrgSlugSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // viewerProcedure guarantees pending or active identity
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
} satisfies TRPCRouterRecord;

export const orgSettingsOrganizationRouter = {
  /**
   * Update organization name
   * Used by team settings page to update the organization name/slug in Clerk
   *
   * Only organization admins can update the organization name
   */
  updateName: orgAdminProcedure
    .input(
      z.object({
        slug: z.string().min(1, "Organization slug is required"),
        name: clerkOrgSlugSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();

      try {
        // Get organization by slug
        const org = await clerk.organizations.getOrganization({
          slug: input.slug,
        });

        if (org.id !== ctx.auth.identity.orgId) {
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
