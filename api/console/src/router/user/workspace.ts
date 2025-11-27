import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { db } from "@db/console/client";
import { orgWorkspaces, workspaceIntegrations, userSources } from "@db/console/schema";
import { eq, desc, and } from "drizzle-orm";
import { workspaceListInputSchema, workspaceCreateInputSchema } from "@repo/console-validation/schemas";
import { clerkClient } from "@vendor/clerk/server";
import { getWorkspaceKey, createCustomWorkspace } from "@db/console/utils";
import { z } from "zod";
import { inngest } from "@api/console/inngest";

import { userScopedProcedure } from "../../trpc";
import { recordActivity } from "../../lib/activity";

/**
 * User-scoped workspace access router
 * For workspace queries that can be accessed before org activation
 */
export const workspaceAccessRouter = {
  /**
   * List workspaces for a Clerk organization by slug
   * Used by the org/workspace switcher to show available workspaces
   *
   * IMPORTANT: This procedure manually verifies the user has access to the org from the URL.
   * It uses userScopedProcedure (allows pending users) because it's called during RSC prefetch
   * before middleware's organizationSyncOptions activates the org.
   *
   * Returns basic workspace info only.
   */
  listByClerkOrgSlug: userScopedProcedure
    .input(workspaceListInputSchema)
    .query(async ({ ctx, input }) => {
      // Get org by slug from URL
      const clerk = await clerkClient();

      let clerkOrg;
      try {
        clerkOrg = await clerk.organizations.getOrganization({
          slug: input.clerkOrgSlug,
        });
      } catch {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Organization not found: ${input.clerkOrgSlug}`,
        });
      }

      if (!clerkOrg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Organization not found: ${input.clerkOrgSlug}`,
        });
      }

      // Verify user has access to this organization
      const membership = await clerk.organizations.getOrganizationMembershipList({
        organizationId: clerkOrg.id,
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

      // Fetch all workspaces for this organization (basic info only)
      const orgWorkspacesData = await db.query.orgWorkspaces.findMany({
        where: eq(orgWorkspaces.clerkOrgId, clerkOrg.id),
        orderBy: [desc(orgWorkspaces.createdAt)],
      });

      return orgWorkspacesData.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        createdAt: workspace.createdAt,
      }));
    }),

  /**
   * Create a custom workspace with user-provided name
   * Used by workspace creation form for pending users
   *
   * This is the user-scoped version that allows pending users to create workspaces.
   * It performs the same org membership verification as the org-scoped version,
   * but is accessible via /api/trpc/user/* which doesn't require an active org session.
   *
   * Optionally connects a GitHub repository during workspace creation (atomic operation).
   * This prevents race conditions from separate create + connect calls.
   *
   * Returns:
   * - workspaceId: Database UUID for internal operations
   * - workspaceKey: External naming key (ws-<slug>) for Pinecone, etc.
   * - workspaceSlug: URL-safe identifier
   * - workspaceName: User-facing name for URLs
   */
  create: userScopedProcedure
    .input(
      workspaceCreateInputSchema.extend({
        // Optional: Connect GitHub repository during workspace creation
        githubRepository: z.object({
          userSourceId: z.string(),
          installationId: z.string(),
          repoId: z.string(),
          repoName: z.string(),
          repoFullName: z.string(),
          defaultBranch: z.string(),
          isPrivate: z.boolean(),
          isArchived: z.boolean(),
          syncConfig: z.object({
            branches: z.array(z.string()).optional(),
            paths: z.array(z.string()).optional(),
            events: z.array(z.string()).optional(),
            autoSync: z.boolean(),
          }),
        }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {

      // Verify user has access to this organization
      const clerk = await clerkClient();

      const membership = await clerk.organizations.getOrganizationMembershipList({
        organizationId: input.clerkOrgId,
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

      // Create custom workspace with user-provided name
      try {
        const workspaceId = await createCustomWorkspace(
          input.clerkOrgId,
          input.workspaceName,
        );

        // Fetch workspace to get slug
        const workspace = await db.query.orgWorkspaces.findFirst({
          where: eq(orgWorkspaces.id, workspaceId),
        });

        if (!workspace) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch created workspace",
          });
        }

        // Compute workspace key from slug
        const workspaceKey = getWorkspaceKey(workspace.slug);

        // Record activity (Tier 2: Queue-based)
        await recordActivity({
          workspaceId,
          actorType: "user",
          actorUserId: ctx.auth.userId,
          category: "workspace",
          action: "workspace.created",
          entityType: "workspace",
          entityId: workspaceId,
          metadata: {
            workspaceName: input.workspaceName,
            workspaceSlug: workspace.slug,
            clerkOrgId: input.clerkOrgId,
          },
        });

        // Optional: Connect GitHub repository during workspace creation (atomic)
        if (input.githubRepository) {
          const repo = input.githubRepository;

          // Verify user owns the userSource
          const userSourceResult = await ctx.db
            .select()
            .from(userSources)
            .where(
              and(
                eq(userSources.id, repo.userSourceId),
                eq(userSources.userId, ctx.auth.userId),
              ),
            )
            .limit(1);

          if (!userSourceResult[0]) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "User source not found or access denied",
            });
          }

          // Check if this repo is already connected (idempotent)
          const existingResult = await ctx.db
            .select()
            .from(workspaceIntegrations)
            .where(
              and(
                eq(workspaceIntegrations.workspaceId, workspaceId),
                eq(workspaceIntegrations.userSourceId, repo.userSourceId)
              )
            );

          const existing = existingResult.find((ws) => {
            const data = ws.sourceConfig;
            return (
              data.provider === "github" &&
              data.type === "repository" &&
              data.repoId === repo.repoId
            );
          });

          let workspaceSourceId: string;

          if (existing) {
            // Update existing connection (idempotent)
            const currentConfig = existing.sourceConfig;
            if (currentConfig.provider === "github" && currentConfig.type === "repository") {
              await ctx.db
                .update(workspaceIntegrations)
                .set({
                  sourceConfig: {
                    ...currentConfig,
                    sync: repo.syncConfig,
                  },
                  isActive: true,
                })
                .where(eq(workspaceIntegrations.id, existing.id));
            }
            workspaceSourceId = existing.id;
          } else {
            // Create new workspace integration
            workspaceSourceId = crypto.randomUUID();

            await ctx.db.insert(workspaceIntegrations).values({
              id: workspaceSourceId,
              workspaceId,
              userSourceId: repo.userSourceId,
              connectedBy: ctx.auth.userId,
              sourceConfig: {
                provider: "github" as const,
                type: "repository" as const,
                installationId: repo.installationId,
                repoId: repo.repoId,
                repoName: repo.repoName,
                repoFullName: repo.repoFullName,
                defaultBranch: repo.defaultBranch,
                isPrivate: repo.isPrivate,
                isArchived: repo.isArchived,
                sync: repo.syncConfig,
              },
              providerResourceId: repo.repoId,
              isActive: true,
            });
          }

          // Trigger initial sync via Inngest
          try {
            await inngest.send({
              name: "apps-console/sync.requested",
              data: {
                workspaceId,
                workspaceKey,
                sourceId: workspaceSourceId,
                sourceType: "github",
                syncMode: "full",
                trigger: "config-change", // Initial connection
                syncParams: {},
              },
            });
          } catch (inngestError) {
            console.error("[workspaceAccess.create] Failed to trigger initial sync:", inngestError);
          }

          // Record integration activity
          await recordActivity({
            workspaceId,
            actorType: "user",
            actorUserId: ctx.auth.userId,
            category: "integration",
            action: "integration.connected",
            entityType: "integration",
            entityId: workspaceSourceId,
            metadata: {
              provider: "github",
              repoFullName: repo.repoFullName,
              repoId: repo.repoId,
              isPrivate: repo.isPrivate,
              syncConfig: repo.syncConfig,
            },
          });
        }

        return {
          workspaceId,
          workspaceKey,
          workspaceSlug: workspace.slug,  // Internal slug for Pinecone
          workspaceName: workspace.name,  // User-facing name for URLs
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes("already exists")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: error.message,
          });
        }
        throw error;
      }
    }),
} satisfies TRPCRouterRecord;
