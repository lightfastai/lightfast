import type { TRPCRouterRecord } from "@trpc/server";
import { db } from "@db/console/client";
import { workspaceIntegrations } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { webhookM2MProcedure } from "../../trpc";
import { recordSystemActivity } from "../../lib/activity";

/**
 * Input Schemas
 */
const findByGithubRepoIdSchema = z.object({
  githubRepoId: z.string(),
});

const updateGithubSyncStatusSchema = z.object({
  githubRepoId: z.string(),
  isActive: z.boolean(),
  reason: z.string().optional(),
});

const updateGithubConfigStatusSchema = z.object({
  githubRepoId: z.string(),
  configStatus: z.enum(["configured", "unconfigured"]),
  configPath: z.string().nullable(),
});

const markGithubInstallationInactiveSchema = z.object({
  githubInstallationId: z.string(),
});

const markGithubDeletedSchema = z.object({
  githubRepoId: z.string(),
});

const updateGithubMetadataSchema = z.object({
  githubRepoId: z.string(),
  metadata: z.object({
    repoFullName: z.string().optional(),
    defaultBranch: z.string().optional(),
    isPrivate: z.boolean().optional(),
    isArchived: z.boolean().optional(),
  }),
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
      if (source && source.sourceConfig.provider !== "github") {
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

        if (fullSource?.sourceConfig.provider !== "github") {
          return null;
        }
      }

      return source?.id ?? null;
    }),

  /**
   * Update GitHub sync status for a repository
   *
   * Used by GitHub webhooks to mark repositories as active/inactive when:
   * - Repository is removed from installation
   * - Repository access is revoked
   * - Installation is suspended/deleted
   *
   * Updates:
   * - isActive status
   * - lastSyncedAt timestamp
   * - lastSyncError message (if reason provided)
   */
  updateGithubSyncStatus: webhookM2MProcedure
    .input(updateGithubSyncStatusSchema)
    .mutation(async ({ input }) => {
      // Find the source first
      const sources = await db
        .select()
        .from(workspaceIntegrations)
        .where(eq(workspaceIntegrations.providerResourceId, input.githubRepoId));

      if (sources.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Repository not found: ${input.githubRepoId}`,
        });
      }

      // Update all matching sources (there might be multiple workspaces using same repo)
      const now = new Date().toISOString();
      const updates = await Promise.all(
        sources.map((source) =>
          db
            .update(workspaceIntegrations)
            .set({
              isActive: input.isActive,
              lastSyncedAt: now,
              lastSyncStatus: input.isActive ? "success" : "failed",
              lastSyncError: input.reason ?? null,
              updatedAt: now,
            })
            .where(eq(workspaceIntegrations.id, source.id))
        )
      );

      // Record activity for each updated source (Tier 3: Fire-and-forget)
      sources.forEach((source) => {
        recordSystemActivity({
          workspaceId: source.workspaceId,
          actorType: "webhook",
          category: "integration",
          action: "integration.status_updated",
          entityType: "integration",
          entityId: source.id,
          metadata: {
            provider: "github",
            isActive: input.isActive,
            reason: input.reason,
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
   * Update GitHub config status for a repository
   *
   * Used by GitHub webhooks to track lightfast.yml configuration:
   * - When push event includes config file changes
   * - When repository is added and we check for config
   *
   * Updates the sourceConfig.status field with:
   * - configStatus: "configured" | "unconfigured"
   * - configPath: path to the config file (e.g., ".lightfast.yml")
   * - lastConfigCheck: timestamp of last check
   */
  updateGithubConfigStatus: webhookM2MProcedure
    .input(updateGithubConfigStatusSchema)
    .mutation(async ({ input }) => {
      // Find the source first
      const sources = await db
        .select()
        .from(workspaceIntegrations)
        .where(eq(workspaceIntegrations.providerResourceId, input.githubRepoId));

      if (sources.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Repository not found: ${input.githubRepoId}`,
        });
      }

      // Update all matching sources
      const now = new Date().toISOString();
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
              lastConfigCheck: now,
            },
          };

          return db
            .update(workspaceIntegrations)
            .set({
              sourceConfig: updatedConfig,
              updatedAt: now,
            })
            .where(eq(workspaceIntegrations.id, source.id));
        })
      );

      // Record activity for each updated source (Tier 3: Fire-and-forget)
      sources.forEach((source) => {
        if (source.sourceConfig.provider === "github") {
          recordSystemActivity({
            workspaceId: source.workspaceId,
            actorType: "webhook",
            category: "integration",
            action: "integration.config_updated",
            entityType: "integration",
            entityId: source.id,
            metadata: {
              provider: "github",
              configStatus: input.configStatus,
              configPath: input.configPath,
              githubRepoId: input.githubRepoId,
            },
          });
        }
      });

      return {
        success: true,
        updated: updates.filter((u) => u !== null).length,
      };
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
      // Find all sources for this installation
      const sources = await db
        .select()
        .from(workspaceIntegrations)
        .where(eq(workspaceIntegrations.isActive, true));

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
      const now = new Date().toISOString();
      const updates = await Promise.all(
        installationSources.map((source) =>
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
        )
      );

      // Record activity for each disconnected source (Tier 3: Fire-and-forget)
      installationSources.forEach((source) => {
        recordSystemActivity({
          workspaceId: source.workspaceId,
          actorType: "webhook",
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
        .where(eq(workspaceIntegrations.providerResourceId, input.githubRepoId));

      if (sources.length === 0) {
        // Repository not found - already deleted or never existed
        return {
          success: true,
          updated: 0,
        };
      }

      // Update all matching sources
      const now = new Date().toISOString();
      const updates = await Promise.all(
        sources.map((source) => {
          // Type guard to ensure we're working with GitHub config
          if (source.sourceConfig.provider !== "github") {
            return Promise.resolve(null);
          }

          // Create updated config marking as archived/deleted
          const updatedConfig = {
            ...source.sourceConfig,
            isArchived: true,
          };

          return db
            .update(workspaceIntegrations)
            .set({
              isActive: false,
              sourceConfig: updatedConfig,
              lastSyncedAt: now,
              lastSyncStatus: "failed",
              lastSyncError: "Repository deleted on GitHub",
              updatedAt: now,
            })
            .where(eq(workspaceIntegrations.id, source.id));
        })
      );

      // Record activity for each deleted source (Tier 3: Fire-and-forget)
      sources.forEach((source) => {
        if (source.sourceConfig.provider === "github") {
          recordSystemActivity({
            workspaceId: source.workspaceId,
            actorType: "webhook",
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
        }
      });

      return {
        success: true,
        updated: updates.filter((u) => u !== null).length,
      };
    }),

  /**
   * Update GitHub repository metadata
   *
   * Used by GitHub webhooks when repository metadata changes:
   * - Repository renamed (full_name changed)
   * - Default branch changed
   * - Privacy settings changed
   * - Archive status changed
   */
  updateGithubMetadata: webhookM2MProcedure
    .input(updateGithubMetadataSchema)
    .mutation(async ({ input }) => {
      // Find the source first
      const sources = await db
        .select()
        .from(workspaceIntegrations)
        .where(eq(workspaceIntegrations.providerResourceId, input.githubRepoId));

      if (sources.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Repository not found: ${input.githubRepoId}`,
        });
      }

      // Update all matching sources
      const now = new Date().toISOString();
      const updates = await Promise.all(
        sources.map((source) => {
          // Type guard to ensure we're working with GitHub config
          if (source.sourceConfig.provider !== "github") {
            return Promise.resolve(null);
          }

          // Merge metadata updates with existing config
          const updatedConfig = {
            ...source.sourceConfig,
            ...(input.metadata.repoFullName && {
              repoFullName: input.metadata.repoFullName,
              repoName: input.metadata.repoFullName.split("/")[1] ?? source.sourceConfig.repoName,
            }),
            ...(input.metadata.defaultBranch && {
              defaultBranch: input.metadata.defaultBranch,
            }),
            ...(input.metadata.isPrivate !== undefined && {
              isPrivate: input.metadata.isPrivate,
            }),
            ...(input.metadata.isArchived !== undefined && {
              isArchived: input.metadata.isArchived,
            }),
          };

          return db
            .update(workspaceIntegrations)
            .set({
              sourceConfig: updatedConfig,
              updatedAt: now,
            })
            .where(eq(workspaceIntegrations.id, source.id));
        })
      );

      // Record activity for each metadata update (Tier 3: Fire-and-forget)
      sources.forEach((source) => {
        if (source.sourceConfig.provider === "github") {
          recordSystemActivity({
            workspaceId: source.workspaceId,
            actorType: "webhook",
            category: "integration",
            action: "integration.metadata_updated",
            entityType: "integration",
            entityId: source.id,
            metadata: {
              provider: "github",
              updates: input.metadata,
              githubRepoId: input.githubRepoId,
            },
          });
        }
      });

      return {
        success: true,
        updated: updates.filter((u) => u !== null).length,
      };
    }),
} satisfies TRPCRouterRecord;
