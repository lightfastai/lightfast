import type { TRPCRouterRecord } from "@trpc/server";
import { db } from "@db/console/client";
import { organizations } from "@db/console/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { clerkClient } from "@vendor/clerk/server";

import { publicProcedure, protectedProcedure } from "../trpc";

/**
 * Organization router - internal procedures for API routes
 * These are PUBLIC procedures (not protected) because they're used by webhooks/API routes
 * that don't have user authentication context
 */
export const organizationRouter = {
  /**
   * List user's organizations with enriched data
   * Returns Clerk orgs joined with database org records
   */
  listUserOrganizations: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.auth.type !== "clerk") {
      throw new Error("Clerk authentication required");
    }

    const userId = ctx.auth.userId;
    const clerk = await clerkClient();

    // Get all organizations the user belongs to from Clerk
    const { data: memberships } = await clerk.users.getOrganizationMembershipList({
      userId,
    });

    // Enrich with database data
    const enrichedOrgs = await Promise.all(
      memberships.map(async (membership) => {
        const clerkOrg = membership.organization;

        // Find corresponding database record
        const dbOrg = await db.query.organizations.findFirst({
          where: eq(organizations.clerkOrgId, clerkOrg.id),
        });

        return {
          id: clerkOrg.id,
          slug: clerkOrg.slug,
          name: clerkOrg.name,
          role: membership.role,
          imageUrl: clerkOrg.imageUrl,
          // Database org info (null if not yet claimed in our system)
          dbOrg: dbOrg ?? null,
        };
      })
    );

    return enrichedOrgs;
  }),

  /**
   * Find organization by GitHub org ID (for API routes)
   */
  findByGithubOrgId: publicProcedure
    .input(z.object({ githubOrgId: z.number() }))
    .query(async ({ input }) => {
      const result = await db.query.organizations.findFirst({
        where: eq(organizations.githubOrgId, input.githubOrgId),
      });
      return result ?? null;
    }),

  /**
   * Find organization by ID
   */
  findById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const result = await db.query.organizations.findFirst({
        where: eq(organizations.id, input.id),
      });
      return result ?? null;
    }),

  /**
   * Find organization by Clerk org ID (for Clerk-authenticated requests)
   */
  findByClerkOrgId: publicProcedure
    .input(z.object({ clerkOrgId: z.string() }))
    .query(async ({ input }) => {
      const result = await db.query.organizations.findFirst({
        where: eq(organizations.clerkOrgId, input.clerkOrgId),
      });
      return result ?? null;
    }),

  /**
   * Find organization by Clerk org slug (for URL routing)
   */
  findByClerkOrgSlug: publicProcedure
    .input(z.object({ clerkOrgSlug: z.string() }))
    .query(async ({ input }) => {
      const result = await db.query.organizations.findFirst({
        where: eq(organizations.clerkOrgSlug, input.clerkOrgSlug),
      });
      return result ?? null;
    }),

  /**
   * Find organization by GitHub org slug (for API routes)
   */
  findByGithubOrgSlug: publicProcedure
    .input(z.object({ githubOrgSlug: z.string() }))
    .query(async ({ input }) => {
      const result = await db.query.organizations.findFirst({
        where: eq(organizations.githubOrgSlug, input.githubOrgSlug),
      });
      return result ?? null;
    }),

  /**
   * Update organization with Clerk details
   */
  updateClerkDetails: publicProcedure
    .input(
      z.object({
        id: z.string(),
        clerkOrgId: z.string(),
        clerkOrgSlug: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await db
        .update(organizations)
        .set({
          clerkOrgId: input.clerkOrgId,
          clerkOrgSlug: input.clerkOrgSlug,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(organizations.id, input.id));
      return { success: true };
    }),

  /**
   * Update organization installation ID
   */
  updateInstallationId: publicProcedure
    .input(
      z.object({
        id: z.string(),
        installationId: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      await db
        .update(organizations)
        .set({
          githubInstallationId: input.installationId,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(organizations.id, input.id));
      return { success: true };
    }),

  /**
   * Create new organization
   */
  create: publicProcedure
    .input(
      z.object({
        githubInstallationId: z.number(),
        githubOrgId: z.number(),
        githubOrgSlug: z.string(),
        githubOrgName: z.string(),
        githubOrgAvatarUrl: z.string().nullable(),
        claimedBy: z.string(),
        clerkOrgId: z.string(),
        clerkOrgSlug: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const [newOrg] = await db
        .insert(organizations)
        .values(input)
        .returning({ id: organizations.id });

      if (!newOrg) {
        throw new Error("Failed to create organization");
      }

      return newOrg;
    }),
} satisfies TRPCRouterRecord;
