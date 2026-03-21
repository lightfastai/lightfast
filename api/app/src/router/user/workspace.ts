import { db } from "@db/app/client";
import {
  gatewayInstallations,
  orgWorkspaces,
  workspaceIntegrations,
} from "@db/app/schema";
import { createCustomWorkspace, getWorkspaceKey } from "@db/app/utils";
import {
  workspaceCreateInputSchema,
  workspaceListInputSchema,
} from "@repo/app-validation/schemas";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { recordActivity } from "../../lib/activity";
import { userScopedProcedure } from "../../trpc";

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

      // Verify user has access to this organization
      const membership =
        await clerk.organizations.getOrganizationMembershipList({
          organizationId: clerkOrg.id,
        });

      const userMembership = membership.data.find(
        (m) => m.publicUserData?.userId === ctx.auth.userId
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
      z.object({
        ...workspaceCreateInputSchema.shape,
        // Optional: Connect GitHub repository during workspace creation
        githubRepository: z
          .object({
            gwInstallationId: z.string(),
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
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user has access to this organization
      const clerk = await clerkClient();

      const membership =
        await clerk.organizations.getOrganizationMembershipList({
          organizationId: input.clerkOrgId,
        });

      const userMembership = membership.data.find(
        (m) => m.publicUserData?.userId === ctx.auth.userId
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
          input.workspaceName
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

          // Verify the installation belongs to this org
          const installationResult = await ctx.db
            .select()
            .from(gatewayInstallations)
            .where(
              and(
                eq(gatewayInstallations.id, repo.gwInstallationId),
                eq(gatewayInstallations.orgId, input.clerkOrgId)
              )
            )
            .limit(1);

          if (!installationResult[0]) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Installation not found or access denied",
            });
          }

          // Check if this repo is already connected (idempotent)
          const existingResult = await ctx.db
            .select()
            .from(workspaceIntegrations)
            .where(
              and(
                eq(workspaceIntegrations.workspaceId, workspaceId),
                eq(workspaceIntegrations.installationId, repo.gwInstallationId)
              )
            );

          const existing = existingResult.find(
            (ws) =>
              ws.provider === "github" && ws.providerResourceId === repo.repoId
          );

          let workspaceSourceId: string;

          if (existing) {
            // Update existing connection (idempotent)
            const currentConfig = existing.providerConfig;
            if (currentConfig.provider === "github") {
              await ctx.db
                .update(workspaceIntegrations)
                .set({
                  providerConfig: {
                    ...currentConfig,
                    sync: repo.syncConfig,
                  },
                  status: "active",
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
              installationId: repo.gwInstallationId,
              provider: "github",
              providerConfig: {
                provider: "github" as const,
                type: "repository" as const,
                sync: repo.syncConfig,
              },
              providerResourceId: repo.repoId,
              status: "active",
            });
          }

          // Record integration activity
          await recordActivity({
            workspaceId,
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
          workspaceSlug: workspace.slug, // Internal slug for Pinecone
          workspaceName: workspace.name, // User-facing name for URLs
        };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("already exists")
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: error.message,
          });
        }
        throw error;
      }
    }),
} satisfies TRPCRouterRecord;
