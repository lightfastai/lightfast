import { db } from "@db/console/client";
import { gatewayInstallations, workspaceIntegrations } from "@db/console/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { recordSystemActivity } from "../../lib/activity";
import { webhookM2MProcedure } from "../../trpc";

/**
 * Input Schemas
 */
const findByGithubRepoIdSchema = z.object({
  githubRepoId: z.string(),
});

const markGithubRepoInactiveSchema = z.object({
  githubRepoId: z.string(),
  reason: z.string().optional(),
});

const markGithubInstallationInactiveSchema = z.object({
  githubInstallationId: z.string(),
});

const markGithubDeletedSchema = z.object({
  githubRepoId: z.string(),
});

const updateGithubMetadataSchema = z.object({
  githubRepoId: z.string(),
});

const getSourceIdByGithubRepoIdSchema = z.object({
  workspaceId: z.string(),
  githubRepoId: z.string(),
});

/**
 * Sources M2M Router
 *
 * Machine-to-machine procedures for source management.
 * Used exclusively by GitHub webhook handlers.
 *
 * Security:
 * - Requires webhook service M2M token (CLERK_M2M_WEBHOOK_CLIENT_ID)
 * - Validates token client ID matches webhook service
 *
 * All procedures are provider-specific and prefixed accordingly.
 */
export const sourcesM2MRouter = {
  /**
   * Find workspace source by GitHub repo ID
   *
   * Uses the indexed providerResourceId field for fast lookups.
   * Returns the first matching active GitHub repository source.
   *
   * Used by webhooks to find which workspace a repo belongs to.
   */
  findByGithubRepoId: webhookM2MProcedure
    .input(findByGithubRepoIdSchema)
    .query(async ({ input }) => {
      const result = await db
        .select()
        .from(workspaceIntegrations)
        .where(
          and(
            eq(workspaceIntegrations.providerResourceId, input.githubRepoId),
            eq(workspaceIntegrations.isActive, true)
          )
        )
        .limit(1);

      const source = result[0];

      // Verify it's actually a GitHub repository
      if (source && source.providerConfig.sourceType !== "github") {
        return null;
      }

      return source ?? null;
    }),

  /**
   * Get workspace source ID by GitHub repo ID
   *
   * Returns just the sourceId (workspaceSource.id) for a given GitHub repo.
   * Used by webhooks to resolve sourceId for new event architecture.
   *
   * Scoped to a specific workspace to prevent cross-workspace access.
   */
  getSourceIdByGithubRepoId: webhookM2MProcedure
    .input(getSourceIdByGithubRepoIdSchema)
    .query(async ({ input }) => {
      const result = await db
        .select({ id: workspaceIntegrations.id })
        .from(workspaceIntegrations)
        .where(
          and(
            eq(workspaceIntegrations.workspaceId, input.workspaceId),
            eq(workspaceIntegrations.providerResourceId, input.githubRepoId),
            eq(workspaceIntegrations.isActive, true)
          )
        )
        .limit(1);

      const source = result[0];

      // Verify it's actually a GitHub repository
      if (source) {
        const fullSource = await db.query.workspaceIntegrations.findFirst({
          where: eq(workspaceIntegrations.id, source.id),
        });

        if (fullSource?.providerConfig.sourceType !== "github") {
          return null;
        }
      }

      return source?.id ?? null;
    }),

  /**
   * Mark a GitHub repository as inactive
   *
   * Used by GitHub webhooks when a repository is removed from an installation.
   */
  markGithubRepoInactive: webhookM2MProcedure
    .input(markGithubRepoInactiveSchema)
    .mutation(async ({ input }) => {
      const sources = await db
        .select()
        .from(workspaceIntegrations)
        .where(
          and(
            eq(workspaceIntegrations.providerResourceId, input.githubRepoId),
            eq(workspaceIntegrations.isActive, true)
          )
        );

      if (sources.length === 0) {
        return { success: true, updated: 0 };
      }

      const now = new Date().toISOString();
      const updateQueries = sources.map((source) =>
        db
          .update(workspaceIntegrations)
          .set({
            isActive: false,
            updatedAt: now,
          })
          .where(eq(workspaceIntegrations.id, source.id))
      );
      // Batch: deactivate all sources atomically (neon-http doesn't support transactions)
      const updates = await db.batch(
        updateQueries as [(typeof updateQueries)[0], ...typeof updateQueries]
      );

      // Record activity for each disconnected source (Tier 3: Fire-and-forget)
      sources.forEach((source) => {
        recordSystemActivity({
          workspaceId: source.workspaceId,
          category: "integration",
          action: "integration.disconnected",
          entityType: "integration",
          entityId: source.id,
          metadata: {
            provider: "github",
            reason: input.reason ?? "repository_removed",
            githubRepoId: input.githubRepoId,
          },
        });
      });

      return { success: true, updated: updates.length };
    }),

  /**
   * Mark all repositories for a GitHub installation as inactive
   *
   * Used by GitHub webhooks when:
   * - Installation is deleted
   * - Installation is suspended
   * - All repository access is revoked
   *
   * This is a bulk operation that marks all sources for the installation.
   */
  markGithubInstallationInactive: webhookM2MProcedure
    .input(markGithubInstallationInactiveSchema)
    .mutation(async ({ input }) => {
      // Find all active sources for this GitHub installation via FK path.
      // Leverages the unique index on (provider, externalId) for an efficient
      // lookup instead of scanning the entire table and filtering in memory.
      const installationSources = await db
        .select({
          id: workspaceIntegrations.id,
          workspaceId: workspaceIntegrations.workspaceId,
          providerConfig: workspaceIntegrations.providerConfig,
          providerResourceId: workspaceIntegrations.providerResourceId,
        })
        .from(workspaceIntegrations)
        .innerJoin(
          gatewayInstallations,
          eq(workspaceIntegrations.installationId, gatewayInstallations.id)
        )
        .where(
          and(
            eq(gatewayInstallations.provider, "github"),
            eq(gatewayInstallations.externalId, input.githubInstallationId),
            eq(workspaceIntegrations.isActive, true)
          )
        );

      if (installationSources.length === 0) {
        return {
          success: true,
          updated: 0,
        };
      }

      // Update all matching sources
      const now = new Date().toISOString();
      const updateQueries = installationSources.map((source) =>
        db
          .update(workspaceIntegrations)
          .set({
            isActive: false,
            lastSyncedAt: now,
            lastSyncStatus: "failed",
            lastSyncError: "GitHub installation removed or suspended",
            updatedAt: now,
          })
          .where(eq(workspaceIntegrations.id, source.id))
      );
      // Batch: deactivate all sources atomically (neon-http doesn't support transactions)
      const updates = await db.batch(
        updateQueries as [(typeof updateQueries)[0], ...typeof updateQueries]
      );

      // Record activity for each disconnected source (Tier 3: Fire-and-forget)
      installationSources.forEach((source) => {
        recordSystemActivity({
          workspaceId: source.workspaceId,
          category: "integration",
          action: "integration.disconnected",
          entityType: "integration",
          entityId: source.id,
          metadata: {
            provider: "github",
            reason: "installation_removed",
            githubInstallationId: input.githubInstallationId,
          },
        });
      });

      return {
        success: true,
        updated: updates.length,
      };
    }),

  /**
   * Mark a GitHub repository as deleted
   *
   * Used by GitHub webhooks when a repository is deleted.
   * Marks the repository as inactive and updates metadata to reflect deletion.
   */
  markGithubDeleted: webhookM2MProcedure
    .input(markGithubDeletedSchema)
    .mutation(async ({ input }) => {
      // Find the source first
      const sources = await db
        .select()
        .from(workspaceIntegrations)
        .where(
          eq(workspaceIntegrations.providerResourceId, input.githubRepoId)
        );

      if (sources.length === 0) {
        // Repository not found - already deleted or never existed
        return {
          success: true,
          updated: 0,
        };
      }

      // Filter to GitHub sources and update
      const now = new Date().toISOString();
      const githubSources = sources.filter(
        (source) => source.providerConfig.sourceType === "github"
      );

      if (githubSources.length === 0) {
        return { success: true, updated: 0 };
      }

      const updateQueries = githubSources.map((source) => {
        const updatedConfig = {
          ...source.providerConfig,
          isArchived: true,
        };

        return db
          .update(workspaceIntegrations)
          .set({
            isActive: false,
            providerConfig: updatedConfig,
            lastSyncedAt: now,
            lastSyncStatus: "failed",
            lastSyncError: "Repository deleted on GitHub",
            updatedAt: now,
          })
          .where(eq(workspaceIntegrations.id, source.id));
      });
      // Batch: mark deleted atomically (neon-http doesn't support transactions)
      const updates = await db.batch(
        updateQueries as [(typeof updateQueries)[0], ...typeof updateQueries]
      );

      // Record activity for each deleted source (Tier 3: Fire-and-forget)
      githubSources.forEach((source) => {
        recordSystemActivity({
          workspaceId: source.workspaceId,
          category: "integration",
          action: "integration.deleted",
          entityType: "integration",
          entityId: source.id,
          metadata: {
            provider: "github",
            reason: "repository_deleted",
            githubRepoId: input.githubRepoId,
          },
        });
      });

      return {
        success: true,
        updated: updates.length,
      };
    }),

  /**
   * Touch GitHub repository integration timestamps.
   *
   * Called by GitHub webhooks when repository events occur.
   * Display metadata (names, branches, privacy) is no longer stored in providerConfig —
   * it will be resolved from a cache layer in a future iteration.
   */
  updateGithubMetadata: webhookM2MProcedure
    .input(updateGithubMetadataSchema)
    .mutation(async ({ input }) => {
      const sources = await db
        .select()
        .from(workspaceIntegrations)
        .where(
          eq(workspaceIntegrations.providerResourceId, input.githubRepoId)
        );

      if (sources.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Repository not found: ${input.githubRepoId}`,
        });
      }

      const now = new Date().toISOString();
      const githubSources = sources.filter(
        (source) => source.providerConfig.sourceType === "github"
      );

      if (githubSources.length === 0) {
        return { success: true, updated: 0 };
      }

      const updateQueries = githubSources.map((source) =>
        db
          .update(workspaceIntegrations)
          .set({ updatedAt: now })
          .where(eq(workspaceIntegrations.id, source.id))
      );
      const updates = await db.batch(
        updateQueries as [(typeof updateQueries)[0], ...typeof updateQueries]
      );

      // Record activity for each metadata update (Tier 3: Fire-and-forget)
      githubSources.forEach((source) => {
        recordSystemActivity({
          workspaceId: source.workspaceId,
          category: "integration",
          action: "integration.metadata_updated",
          entityType: "integration",
          entityId: source.id,
          metadata: {
            provider: "github",
            githubRepoId: input.githubRepoId,
          },
        });
      });

      return {
        success: true,
        updated: updates.length,
      };
    }),
} satisfies TRPCRouterRecord;
