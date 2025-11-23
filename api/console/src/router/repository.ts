import type { TRPCRouterRecord } from "@trpc/server";
import { db } from "@db/console/client";
import { workspaceSources, type WorkspaceSource } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "../trpc";

/**
 * Repository Router
 *
 * Handles repository-related operations for GitHub webhook processing.
 * Uses the new 2-table system with workspaceSources.
 *
 * Key Operations:
 * - Find repositories by GitHub repo ID (for webhooks)
 * - Update sync status (mark active/inactive)
 * - Update config status (lightfast.yml detection)
 */

/**
 * Input Schemas
 */
const findByGithubRepoIdSchema = z.object({
  githubRepoId: z.string(),
});

const updateSyncStatusSchema = z.object({
  githubRepoId: z.string(),
  isActive: z.boolean(),
  reason: z.string().optional(),
});

const updateConfigStatusSchema = z.object({
  githubRepoId: z.string(),
  configStatus: z.enum(["configured", "unconfigured"]),
  configPath: z.string().nullable(),
});

const markInstallationInactiveSchema = z.object({
  githubInstallationId: z.string(),
});

/**
 * Repository router - PUBLIC procedures for webhook/API route usage
 */
export const repositoryRouter = {
  /**
   * Find workspace source by GitHub repo ID
   *
   * Uses the indexed providerResourceId field for fast lookups.
   * Returns the first matching active GitHub repository source.
   *
   * Used by webhooks to find which workspace a repo belongs to.
   */
  findByGithubRepoId: publicProcedure
    .input(findByGithubRepoIdSchema)
    .query(async ({ ctx, input }) => {
      const result = await db
        .select()
        .from(workspaceSources)
        .where(
          and(
            eq(workspaceSources.providerResourceId, input.githubRepoId),
            eq(workspaceSources.isActive, true)
          )
        )
        .limit(1);

      const source = result[0];

      // Verify it's actually a GitHub repository
      if (source && source.sourceConfig.provider !== "github") {
        return null;
      }

      return source ?? null;
    }),

  /**
   * Update sync status for a repository
   *
   * Used by webhooks to mark repositories as active/inactive when:
   * - Repository is removed from installation
   * - Repository access is revoked
   * - Installation is suspended/deleted
   *
   * Updates:
   * - isActive status
   * - lastSyncedAt timestamp
   * - lastSyncError message (if reason provided)
   */
  updateSyncStatus: publicProcedure
    .input(updateSyncStatusSchema)
    .mutation(async ({ ctx, input }) => {
      // Find the source first
      const sources = await db
        .select()
        .from(workspaceSources)
        .where(eq(workspaceSources.providerResourceId, input.githubRepoId));

      if (sources.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Repository not found: ${input.githubRepoId}`,
        });
      }

      // Update all matching sources (there might be multiple workspaces using same repo)
      const now = new Date();
      const updates = await Promise.all(
        sources.map((source) =>
          db
            .update(workspaceSources)
            .set({
              isActive: input.isActive,
              lastSyncedAt: now,
              lastSyncStatus: input.isActive ? "success" : "failed",
              lastSyncError: input.reason ?? null,
              updatedAt: now,
            })
            .where(eq(workspaceSources.id, source.id))
        )
      );

      return {
        success: true,
        updated: updates.length,
      };
    }),

  /**
   * Update config status for a repository
   *
   * Used by webhooks to track lightfast.yml configuration:
   * - When push event includes config file changes
   * - When repository is added and we check for config
   *
   * Updates the sourceConfig.status field with:
   * - configStatus: "configured" | "unconfigured"
   * - configPath: path to the config file (e.g., ".lightfast.yml")
   * - lastConfigCheck: timestamp of last check
   */
  updateConfigStatus: publicProcedure
    .input(updateConfigStatusSchema)
    .mutation(async ({ ctx, input }) => {
      // Find the source first
      const sources = await db
        .select()
        .from(workspaceSources)
        .where(eq(workspaceSources.providerResourceId, input.githubRepoId));

      if (sources.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Repository not found: ${input.githubRepoId}`,
        });
      }

      // Update all matching sources
      const now = new Date();
      const updates = await Promise.all(
        sources.map((source) => {
          // Type guard to ensure we're working with GitHub config
          if (source.sourceConfig.provider !== "github") {
            return Promise.resolve(null);
          }

          // Create updated config with new status
          const updatedConfig = {
            ...source.sourceConfig,
            status: {
              configStatus: input.configStatus,
              configPath: input.configPath ?? undefined,
              lastConfigCheck: now.toISOString(),
            },
          };

          return db
            .update(workspaceSources)
            .set({
              sourceConfig: updatedConfig,
              updatedAt: now,
            })
            .where(eq(workspaceSources.id, source.id));
        })
      );

      return {
        success: true,
        updated: updates.filter((u) => u !== null).length,
      };
    }),

  /**
   * Mark all repositories for an installation as inactive
   *
   * Used by webhooks when:
   * - Installation is deleted
   * - Installation is suspended
   * - All repository access is revoked
   *
   * This is a bulk operation that marks all sources for the installation.
   */
  markInstallationInactive: publicProcedure
    .input(markInstallationInactiveSchema)
    .mutation(async ({ ctx, input }) => {
      // Find all sources for this installation
      const sources = await db
        .select()
        .from(workspaceSources)
        .where(eq(workspaceSources.isActive, true));

      // Filter to GitHub sources with matching installationId
      const installationSources = sources.filter(
        (source) =>
          source.sourceConfig.provider === "github" &&
          source.sourceConfig.installationId === input.githubInstallationId
      );

      if (installationSources.length === 0) {
        return {
          success: true,
          updated: 0,
        };
      }

      // Update all matching sources
      const now = new Date();
      const updates = await Promise.all(
        installationSources.map((source) =>
          db
            .update(workspaceSources)
            .set({
              isActive: false,
              lastSyncedAt: now,
              lastSyncStatus: "failed",
              lastSyncError: "GitHub installation removed or suspended",
              updatedAt: now,
            })
            .where(eq(workspaceSources.id, source.id))
        )
      );

      return {
        success: true,
        updated: updates.length,
      };
    }),
} satisfies TRPCRouterRecord;
