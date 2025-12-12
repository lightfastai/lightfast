import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { db } from "@db/console/client";
import {
  orgWorkspaces,
  workspaceKnowledgeDocuments,
  workspaceWorkflowRuns,
  workspaceIntegrations,
  userSources,
} from "@db/console/schema";
import { eq, and, desc, count, sql, inArray, sum, avg, gte } from "drizzle-orm";
import { getWorkspaceKey, createCustomWorkspace } from "@db/console/utils";
import {
  workspaceListInputSchema,
  workspaceCreateInputSchema,
  workspaceStatisticsInputSchema,
  workspaceUpdateNameInputSchema,
  workspaceResolveFromGithubOrgSlugInputSchema,
  workspaceStatisticsComparisonInputSchema,
  workspaceJobPercentilesInputSchema,
  workspacePerformanceTimeSeriesInputSchema,
  workspaceSystemHealthInputSchema,
  workspaceIntegrationDisconnectInputSchema,
} from "@repo/console-validation/schemas";
import { z } from "zod";
import { clerkClient } from "@vendor/clerk/server";

import { publicProcedure, orgScopedProcedure, resolveWorkspaceByName } from "../../trpc";
import { recordActivity } from "../../lib/activity";

/**
 * Workspace router - internal procedures for API routes
 * PUBLIC procedures for webhook/API route usage
 */
export const workspaceRouter = {
  /**
   * List workspaces for a Clerk organization
   * Used by the org/workspace switcher to show available workspaces
   *
   * Returns basic workspace info only. Use granular endpoints for detailed data:
   * - workspace.sources.list
   * - workspace.stores.list
   * - workspace.jobs.stats
   *
   * IMPORTANT: This procedure verifies the user has access to the org from the URL.
   */
  listByClerkOrgSlug: orgScopedProcedure
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
   * Resolve workspace ID and key from GitHub organization slug
   * Used by webhooks to map GitHub events to workspaces
   *
   * Returns:
   * - workspaceId: Database UUID for internal operations
   * - workspaceKey: External naming key (ws-<slug>) for Pinecone, etc.
   * - workspaceSlug: Internal slug identifier
   */
  resolveFromGithubOrgSlug: publicProcedure
    .input(workspaceResolveFromGithubOrgSlugInputSchema)
    .query(async ({ input }) => {
      // Find GitHub user source with matching installation
      // GitHub installations are stored in providerMetadata.installations
      const userSource = await db.query.userSources.findFirst({
        where: and(
          eq(userSources.sourceType, "github"),
          eq(userSources.isActive, true),
          sql`EXISTS (
            SELECT 1 FROM jsonb_array_elements(${userSources.providerMetadata}->'installations') AS inst
            WHERE inst->>'accountLogin' = ${input.githubOrgSlug}
          )`
        ),
      });

      if (!userSource) {
        throw new Error(
          `No active GitHub installation found for organization: ${input.githubOrgSlug}`,
        );
      }

      // Find workspace source connected to this user source
      const workspaceSource = await db.query.workspaceIntegrations.findFirst({
        where: and(
          eq(workspaceIntegrations.userSourceId, userSource.id),
          eq(workspaceIntegrations.isActive, true),
        ),
      });

      if (!workspaceSource) {
        throw new Error(
          `No workspace connected to GitHub organization: ${input.githubOrgSlug}`,
        );
      }

      // Fetch workspace details
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceSource.workspaceId),
      });

      if (!workspace) {
        throw new Error(
          `Workspace not found for ID: ${workspaceSource.workspaceId}`,
        );
      }

      // Compute workspace key from slug
      const workspaceKey = getWorkspaceKey(workspace.slug);

      return {
        workspaceId: workspace.id,
        workspaceKey,
        workspaceSlug: workspace.slug,
      };
    }),

  /**
   * Get workspace details by name (user-facing)
   * Used by workspace settings and detail pages
   *
   * Returns:
   * - Full workspace record with id, name, slug, settings, etc.
   */
  getByName: orgScopedProcedure
    .input(workspaceStatisticsInputSchema)
    .query(async ({ ctx, input }) => {
      // Resolve workspace from name (user-facing)
      const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
        clerkOrgSlug: input.clerkOrgSlug,
        workspaceName: input.workspaceName,
        userId: ctx.auth.userId,
      });

      // Fetch full workspace details
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
      });

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        settings: workspace.settings,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        clerkOrgId: workspace.clerkOrgId,
      };
    }),

  /**
   * Create a custom workspace with user-provided name
   * Used by workspace creation form
   *
   * Returns:
   * - workspaceId: Database UUID for internal operations
   * - workspaceKey: External naming key (ws-<slug>) for Pinecone, etc.
   * - workspaceSlug: URL-safe identifier
   */
  create: orgScopedProcedure
    .input(workspaceCreateInputSchema)
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

  /**
   * Get job performance percentiles
   * Returns p50, p95, p99, and max duration metrics
   */
  jobPercentiles: orgScopedProcedure
    .input(workspaceJobPercentilesInputSchema)
    .query(async ({ ctx, input }) => {
      // Resolve workspace from name (user-facing)
      const { workspaceId } = await resolveWorkspaceByName({
        clerkOrgSlug: input.clerkOrgSlug,
        workspaceName: input.workspaceName,
        userId: ctx.auth.userId,
      });

      const { timeRange } = input;

      // Calculate time range
      const rangeHours = {
        "24h": 24,
        "7d": 168,
        "30d": 720,
      }[timeRange];

      const startTime = new Date(Date.now() - rangeHours * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      // Get completed jobs with durations
      const completedJobs = await db.query.workspaceWorkflowRuns.findMany({
        where: and(
          eq(workspaceWorkflowRuns.workspaceId, workspaceId),
          eq(workspaceWorkflowRuns.status, "completed"),
          gte(workspaceWorkflowRuns.createdAt, startTime),
          sql`${workspaceWorkflowRuns.durationMs} IS NOT NULL`,
        ),
        columns: {
          durationMs: true,
        },
      });

      // Extract and parse durations
      const durations = completedJobs
        .map((j) => Number.parseInt(j.durationMs || "0", 10))
        .filter((d) => d > 0)
        .sort((a, b) => a - b);

      if (durations.length === 0) {
        return {
          hasData: false,
          p50: 0,
          p95: 0,
          p99: 0,
          max: 0,
          sampleSize: 0,
        };
      }

      // Calculate percentiles
      const getPercentile = (p: number) => {
        const index = Math.ceil((p / 100) * durations.length) - 1;
        return durations[index] || 0;
      };

      return {
        hasData: true,
        p50: getPercentile(50),
        p95: getPercentile(95),
        p99: getPercentile(99),
        max: durations[durations.length - 1] || 0,
        sampleSize: durations.length,
      };
    }),

  /**
   * Get performance time series data
   * Returns hourly aggregated job metrics
   */
  performanceTimeSeries: orgScopedProcedure
    .input(workspacePerformanceTimeSeriesInputSchema)
    .query(async ({ ctx, input }) => {
      // Resolve workspace from name (user-facing)
      const { workspaceId } = await resolveWorkspaceByName({
        clerkOrgSlug: input.clerkOrgSlug,
        workspaceName: input.workspaceName,
        userId: ctx.auth.userId,
      });

      const { timeRange } = input;

      // Calculate time range
      const rangeHours = {
        "24h": 24,
        "7d": 168,
        "30d": 720,
      }[timeRange];

      const startTime = new Date(Date.now() - rangeHours * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      // Get all jobs in time range
      const recentJobs = await db.query.workspaceWorkflowRuns.findMany({
        where: and(
          eq(workspaceWorkflowRuns.workspaceId, workspaceId),
          gte(workspaceWorkflowRuns.createdAt, startTime),
        ),
        columns: {
          createdAt: true,
          durationMs: true,
          status: true,
        },
        orderBy: [desc(workspaceWorkflowRuns.createdAt)],
      });

      // Group by hour
      const hourBuckets: Map<
        string,
        { jobs: typeof recentJobs; completed: number; totalDuration: number }
      > = new Map();

      // Initialize hour buckets
      for (let i = 0; i < rangeHours; i++) {
        const hourDate = new Date(Date.now() - i * 60 * 60 * 1000);
        hourDate.setMinutes(0, 0, 0);
        const key = hourDate.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        hourBuckets.set(key, { jobs: [], completed: 0, totalDuration: 0 });
      }

      // Populate buckets
      for (const job of recentJobs) {
        const jobDate = new Date(job.createdAt);
        jobDate.setMinutes(0, 0, 0);
        const key = jobDate.toISOString().slice(0, 13);
        const bucket = hourBuckets.get(key);

        if (bucket) {
          bucket.jobs.push(job);
          if (job.status === "completed") {
            bucket.completed++;
            const duration = Number.parseInt(job.durationMs || "0", 10);
            if (duration > 0) {
              bucket.totalDuration += duration;
            }
          }
        }
      }

      // Convert to time series points
      const points = Array.from(hourBuckets.entries())
        .map(([timestamp, data]) => {
          const date = new Date(timestamp);
          const hour = date.toLocaleTimeString("en-US", {
            hour: "numeric",
            hour12: true,
          });

          const avgDuration =
            data.completed > 0 ? data.totalDuration / data.completed : 0;
          const successRate =
            data.jobs.length > 0
              ? (data.completed / data.jobs.length) * 100
              : 100;

          return {
            timestamp,
            hour,
            jobCount: data.jobs.length,
            avgDuration: Math.round(avgDuration),
            successRate: Math.round(successRate),
          };
        })
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      return points;
    }),


  /**
   * Update workspace name
   * Used by workspace settings page to update the user-facing name
   */
  updateName: orgScopedProcedure
    .input(workspaceUpdateNameInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Resolve workspace from current name (user-facing)
      const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
        clerkOrgSlug: input.clerkOrgSlug,
        workspaceName: input.currentName,
        userId: ctx.auth.userId,
      });

      // Check if new name already exists in this organization
      const existingWorkspace = await db.query.orgWorkspaces.findFirst({
        where: and(
          eq(orgWorkspaces.clerkOrgId, clerkOrgId),
          eq(orgWorkspaces.name, input.newName),
        ),
      });

      if (existingWorkspace && existingWorkspace.id !== workspaceId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A workspace with the name "${input.newName}" already exists in this organization`,
        });
      }

      // Update workspace name
      await db
        .update(orgWorkspaces)
        .set({
          name: input.newName,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orgWorkspaces.id, workspaceId));

      // Record activity (Tier 2: Queue-based)
      await recordActivity({
        workspaceId,
        actorType: "user",
        actorUserId: ctx.auth.userId,
        category: "workspace",
        action: "workspace.updated",
        entityType: "workspace",
        entityId: workspaceId,
        metadata: {
          changes: {
            name: {
              from: input.currentName,
              to: input.newName,
            },
          },
        },
      });

      return {
        success: true,
        newWorkspaceName: input.newName,
      };
    }),

  // ============================================================================
  // Granular Data Queries (New API - preferred over monolithic statistics)
  // ============================================================================

  /**
   * Sources sub-router
   * Alias for workspace.integrations.list for backward compatibility
   */
  sources: {
    /**
     * List connected sources for a workspace
     * This is an alias - use workspace.integrations.list for new code
     */
    list: orgScopedProcedure
      .input(workspaceStatisticsInputSchema)
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // Get all workspace sources (new 2-table model)
        const sources = await db
          .select({
            id: workspaceIntegrations.id,
            sourceType: userSources.sourceType,
            isActive: workspaceIntegrations.isActive,
            connectedAt: workspaceIntegrations.connectedAt,
            lastSyncedAt: workspaceIntegrations.lastSyncedAt,
            lastSyncStatus: workspaceIntegrations.lastSyncStatus,
            documentCount: workspaceIntegrations.documentCount,
            sourceConfig: workspaceIntegrations.sourceConfig,
          })
          .from(workspaceIntegrations)
          .innerJoin(
            userSources,
            eq(workspaceIntegrations.userSourceId, userSources.id)
          )
          .where(and(
            eq(workspaceIntegrations.workspaceId, workspaceId),
            eq(workspaceIntegrations.isActive, true),
          ))
          .orderBy(desc(workspaceIntegrations.connectedAt));

        // Format for compatibility with old interface
        return {
          workspaceId, // Include workspaceId for UI components that need it
          total: sources.length,
          byType: sources.reduce(
            (acc, s) => {
              acc[s.sourceType] = (acc[s.sourceType] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
          list: sources.map((s) => ({
            id: s.id,
            type: s.sourceType,
            sourceType: s.sourceType, // Canonical name
            displayName: s.sourceConfig.sourceType === "github" && s.sourceConfig.type === "repository"
              ? s.sourceConfig.repoFullName
              : s.sourceType,
            documentCount: s.documentCount,
            isActive: s.isActive, // For UI compatibility
            connectedAt: s.connectedAt, // For UI compatibility
            lastSyncedAt: s.lastSyncedAt,
            lastIngestedAt: s.lastSyncedAt,
            lastSyncAt: s.lastSyncedAt, // Alias for UI compatibility
            lastSyncStatus: s.lastSyncStatus, // For UI compatibility
            metadata: s.sourceConfig,
            resource: { // For backward compatibility
              id: s.id,
              resourceData: s.sourceConfig,
            },
          })),
        };
      }),
  },

  /**
   * Store sub-router (1:1 relationship: each workspace has exactly one store)
   */
  store: {
    /**
     * Get the workspace's embedding/store configuration with document count
     * Note: Store config is now on the workspace table directly
     */
    get: orgScopedProcedure
      .input(workspaceStatisticsInputSchema)
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // Get workspace with document count
        const [workspaceWithCount] = await db
          .select({
            id: orgWorkspaces.id,
            indexName: orgWorkspaces.indexName,
            namespaceName: orgWorkspaces.namespaceName,
            embeddingModel: orgWorkspaces.embeddingModel,
            embeddingDim: orgWorkspaces.embeddingDim,
            chunkMaxTokens: orgWorkspaces.chunkMaxTokens,
            chunkOverlap: orgWorkspaces.chunkOverlap,
            createdAt: orgWorkspaces.createdAt,
            documentCount: count(workspaceKnowledgeDocuments.id),
          })
          .from(orgWorkspaces)
          .leftJoin(workspaceKnowledgeDocuments, eq(orgWorkspaces.id, workspaceKnowledgeDocuments.workspaceId))
          .where(eq(orgWorkspaces.id, workspaceId))
          .groupBy(orgWorkspaces.id)
          .limit(1);

        if (!workspaceWithCount) {
          return null;
        }

        // Return null if workspace is not configured for embedding
        if (!workspaceWithCount.indexName) {
          return null;
        }

        return {
          id: workspaceWithCount.id,
          indexName: workspaceWithCount.indexName,
          namespaceName: workspaceWithCount.namespaceName,
          embeddingModel: workspaceWithCount.embeddingModel,
          embeddingDim: workspaceWithCount.embeddingDim,
          chunkMaxTokens: workspaceWithCount.chunkMaxTokens,
          chunkOverlap: workspaceWithCount.chunkOverlap,
          documentCount: workspaceWithCount.documentCount,
          createdAt: workspaceWithCount.createdAt,
        };
      }),
  },

  /**
   * Documents sub-router
   */
  documents: {
    /**
     * Get document statistics (total count and chunks)
     * Replaces the documents portion of the old statistics procedure
     */
    stats: orgScopedProcedure
      .input(workspaceStatisticsInputSchema)
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // Get total document count - query directly on documents table by workspaceId
        const [docCountResult] = await db
          .select({ count: count() })
          .from(workspaceKnowledgeDocuments)
          .where(eq(workspaceKnowledgeDocuments.workspaceId, workspaceId));

        // Get total chunk count (sum of all chunkCounts)
        const [chunkCountResult] = await db
          .select({
            total: sql<number>`COALESCE(SUM(${workspaceKnowledgeDocuments.chunkCount}), 0)`,
          })
          .from(workspaceKnowledgeDocuments)
          .where(eq(workspaceKnowledgeDocuments.workspaceId, workspaceId));

        return {
          total: docCountResult?.count || 0,
          chunks: Number(chunkCountResult?.total) || 0,
        };
      }),
  },

  /**
   * Jobs sub-router
   */
  jobs: {
    /**
     * Get job statistics (aggregated metrics)
     * Replaces the job stats portion of the old statistics procedure
     */
    stats: orgScopedProcedure
      .input(workspaceStatisticsInputSchema)
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // Get recent jobs (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Get job statistics with SQL aggregation (single query)
        const [jobStats] = await db
          .select({
            total: count(),
            queued: sum(sql<number>`CASE WHEN ${workspaceWorkflowRuns.status} = 'queued' THEN 1 ELSE 0 END`),
            running: sum(sql<number>`CASE WHEN ${workspaceWorkflowRuns.status} = 'running' THEN 1 ELSE 0 END`),
            completed: sum(sql<number>`CASE WHEN ${workspaceWorkflowRuns.status} = 'completed' THEN 1 ELSE 0 END`),
            failed: sum(sql<number>`CASE WHEN ${workspaceWorkflowRuns.status} = 'failed' THEN 1 ELSE 0 END`),
            cancelled: sum(sql<number>`CASE WHEN ${workspaceWorkflowRuns.status} = 'cancelled' THEN 1 ELSE 0 END`),
            avgDurationMs: avg(sql<number>`CAST(${workspaceWorkflowRuns.durationMs} AS BIGINT)`),
          })
          .from(workspaceWorkflowRuns)
          .where(
            and(
              eq(workspaceWorkflowRuns.workspaceId, workspaceId),
              gte(workspaceWorkflowRuns.createdAt, oneDayAgo),
            ),
          );

        return {
          total: jobStats?.total || 0,
          completed: Number(jobStats?.completed) || 0,
          failed: Number(jobStats?.failed) || 0,
          successRate:
            (jobStats?.total || 0) > 0
              ? ((Number(jobStats?.completed) || 0) / (jobStats?.total || 0)) * 100
              : 0,
          avgDurationMs: Math.round(Number(jobStats?.avgDurationMs) || 0),
        };
      }),

    /**
     * Get recent jobs list
     * Replaces the recent jobs portion of the old statistics procedure
     */
    recent: orgScopedProcedure
      .input(workspaceStatisticsInputSchema)
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // Get recent jobs (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const recentJobs = await db.query.workspaceWorkflowRuns.findMany({
          where: and(
            eq(workspaceWorkflowRuns.workspaceId, workspaceId),
            gte(workspaceWorkflowRuns.createdAt, oneDayAgo),
          ),
          orderBy: [desc(workspaceWorkflowRuns.createdAt)],
          limit: 5,
        });

        return recentJobs.map((j) => ({
          id: j.id,
          name: j.name,
          status: j.status,
          trigger: j.trigger,
          createdAt: j.createdAt,
          completedAt: j.completedAt,
          durationMs: j.durationMs,
          errorMessage: j.errorMessage,
        }));
      }),
  },

  /**
   * Health sub-router
   */
  health: {
    /**
     * Get system health overview
     * Refactored to avoid duplicate queries - expects sources/stores data from cache
     */
    overview: orgScopedProcedure
      .input(workspaceSystemHealthInputSchema)
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // Get recent jobs for health calculation (last 24h)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const recentJobs = await db.query.workspaceWorkflowRuns.findMany({
          where: and(
            eq(workspaceWorkflowRuns.workspaceId, workspaceId),
            gte(workspaceWorkflowRuns.createdAt, oneDayAgo),
          ),
          columns: {
            status: true,
            repositoryId: true,
          },
        });

        // Calculate health status helper
        const getHealthStatus = (
          successRate: number,
        ): "healthy" | "degraded" | "down" => {
          if (successRate >= 95) return "healthy";
          if (successRate >= 80) return "degraded";
          return "down";
        };

        // Calculate overall workspace health
        const completedJobs = recentJobs.filter((j) => j.status === "completed");
        const workspaceSuccessRate =
          recentJobs.length > 0
            ? (completedJobs.length / recentJobs.length) * 100
            : 100;

        // Note: Store and source details should be fetched separately via
        // workspace.stores.list and workspace.sources.list for better caching
        return {
          workspaceHealth: getHealthStatus(workspaceSuccessRate),
          totalJobs24h: recentJobs.length,
          successRate: workspaceSuccessRate,
          completedJobs: completedJobs.length,
          failedJobs: recentJobs.filter((j) => j.status === "failed").length,
        };
      }),
  },

  /**
   * Integrations sub-router
   * Provider-specific integration management
   */
  integrations: {
    /**
     * Disconnect an integration from workspace
     */
    disconnect: orgScopedProcedure
      .input(workspaceIntegrationDisconnectInputSchema)
      .mutation(async ({ ctx, input }) => {
        const integration = await ctx.db.query.workspaceIntegrations.findFirst({
          where: eq(workspaceIntegrations.id, input.integrationId),
          with: {
            workspace: true,
          },
        });

        if (!integration || integration.workspace?.clerkOrgId !== ctx.auth.orgId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Integration not found",
          });
        }

        await ctx.db
          .update(workspaceIntegrations)
          .set({ isActive: false, updatedAt: new Date().toISOString() })
          .where(eq(workspaceIntegrations.id, input.integrationId));

        return { success: true };
      }),

    /**
     * Link Vercel project to workspace
     */
    linkVercelProject: orgScopedProcedure
      .input(
        z.object({
          workspaceId: z.string(),
          projectId: z.string(),
          projectName: z.string(),
          userSourceId: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { workspaceId, projectId, projectName, userSourceId } = input;

        // Verify user owns the workspace
        const workspace = await ctx.db.query.orgWorkspaces.findFirst({
          where: and(
            eq(orgWorkspaces.id, workspaceId),
            eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId),
          ),
        });

        if (!workspace) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });
        }

        // Verify user owns the Vercel source
        const userSource = await ctx.db.query.userSources.findFirst({
          where: and(
            eq(userSources.id, userSourceId),
            eq(userSources.userId, ctx.auth.userId),
            eq(userSources.sourceType, "vercel"),
          ),
        });

        if (!userSource) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Vercel connection not found",
          });
        }

        const providerMetadata = userSource.providerMetadata;
        if (providerMetadata.sourceType !== "vercel") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid provider metadata",
          });
        }

        // Check if already linked
        const existing = await ctx.db.query.workspaceIntegrations.findFirst({
          where: and(
            eq(workspaceIntegrations.workspaceId, workspaceId),
            eq(workspaceIntegrations.providerResourceId, projectId),
          ),
        });

        if (existing) {
          // Reactivate if inactive
          if (!existing.isActive) {
            await ctx.db
              .update(workspaceIntegrations)
              .set({ isActive: true, updatedAt: new Date().toISOString() })
              .where(eq(workspaceIntegrations.id, existing.id));
            return { id: existing.id, created: false, reactivated: true };
          }
          return { id: existing.id, created: false, reactivated: false };
        }

        // Create workspace integration
        const now = new Date().toISOString();
        const result = await ctx.db
          .insert(workspaceIntegrations)
          .values({
            workspaceId,
            userSourceId,
            connectedBy: ctx.auth.userId,
            sourceConfig: {
              sourceType: "vercel" as const,
              type: "project" as const,
              projectId,
              projectName,
              teamId: providerMetadata.teamId,
              teamSlug: providerMetadata.teamSlug,
              configurationId: providerMetadata.configurationId,
              sync: {
                events: [
                  "deployment.created",
                  "deployment.succeeded",
                  "deployment.ready",
                  "deployment.error",
                  "deployment.canceled",
                ],
                autoSync: true,
              },
            },
            providerResourceId: projectId,
            isActive: true,
            connectedAt: now,
          })
          .returning({ id: workspaceIntegrations.id });

        return { id: result[0]!.id, created: true, reactivated: false };
      }),

    /**
     * Unlink Vercel project from workspace
     */
    unlinkVercelProject: orgScopedProcedure
      .input(
        z.object({
          integrationId: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const integration = await ctx.db.query.workspaceIntegrations.findFirst({
          where: eq(workspaceIntegrations.id, input.integrationId),
          with: {
            workspace: true,
          },
        });

        if (!integration || integration.workspace?.clerkOrgId !== ctx.auth.orgId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Integration not found",
          });
        }

        await ctx.db
          .update(workspaceIntegrations)
          .set({ isActive: false, updatedAt: new Date().toISOString() })
          .where(eq(workspaceIntegrations.id, input.integrationId));

        return { success: true };
      }),

    /**
     * Update event subscriptions for a workspace integration
     */
    updateEvents: orgScopedProcedure
      .input(
        z.object({
          integrationId: z.string(),
          events: z.array(z.string()),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        // Verify integration belongs to user's org
        const integration = await ctx.db.query.workspaceIntegrations.findFirst({
          where: eq(workspaceIntegrations.id, input.integrationId),
          with: {
            workspace: true,
          },
        });

        if (!integration || integration.workspace?.clerkOrgId !== ctx.auth.orgId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Integration not found",
          });
        }

        // Update source_config.sync.events using JSON merge
        // The sourceConfig is a discriminated union type, so we need to preserve it properly
        const currentConfig = integration.sourceConfig;

        // Build the updated config preserving all existing fields
        // We cast through unknown to satisfy TypeScript while preserving the data structure
        const updatedConfig = {
          ...currentConfig,
          sync: {
            ...(currentConfig.sync as Record<string, unknown>),
            events: input.events,
          },
        } as typeof currentConfig;

        await ctx.db
          .update(workspaceIntegrations)
          .set({
            sourceConfig: updatedConfig,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(workspaceIntegrations.id, input.integrationId));

        return { success: true };
      }),

    /**
     * Bulk link multiple GitHub repositories to workspace
     *
     * Allows connecting multiple GitHub repositories in a single operation.
     * Handles idempotency by reactivating inactive integrations.
     */
    bulkLinkGitHubRepositories: orgScopedProcedure
      .input(
        z.object({
          workspaceId: z.string(),
          userSourceId: z.string(),
          installationId: z.string(),
          repositories: z
            .array(
              z.object({
                repoId: z.string(),
                repoFullName: z.string(),
              }),
            )
            .min(1)
            .max(50),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        // 1. Verify workspace access
        const workspace = await ctx.db.query.orgWorkspaces.findFirst({
          where: and(
            eq(orgWorkspaces.id, input.workspaceId),
            eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId),
          ),
        });

        if (!workspace) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });
        }

        // 2. Verify user source ownership
        const source = await ctx.db.query.userSources.findFirst({
          where: and(
            eq(userSources.id, input.userSourceId),
            eq(userSources.userId, ctx.auth.userId),
            eq(userSources.sourceType, "github"),
          ),
        });

        if (!source) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "GitHub connection not found",
          });
        }

        const providerMetadata = source.providerMetadata;
        if (providerMetadata.sourceType !== "github") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid provider metadata",
          });
        }

        // Verify installation exists
        const installation = providerMetadata.installations?.find(
          (i) => i.id === input.installationId,
        );
        if (!installation) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Installation not found",
          });
        }

        // 3. Get existing connections to avoid duplicates
        const existing = await ctx.db.query.workspaceIntegrations.findMany({
          where: and(
            eq(workspaceIntegrations.workspaceId, input.workspaceId),
            eq(workspaceIntegrations.userSourceId, input.userSourceId),
          ),
        });

        const existingMap = new Map(
          existing.map((e) => [e.providerResourceId, e]),
        );

        // 4. Categorize repositories
        const toCreate: typeof input.repositories = [];
        const toReactivate: string[] = [];
        const alreadyActive: string[] = [];

        for (const repo of input.repositories) {
          const existingIntegration = existingMap.get(repo.repoId);
          if (!existingIntegration) {
            toCreate.push(repo);
          } else if (!existingIntegration.isActive) {
            toReactivate.push(existingIntegration.id);
          } else {
            alreadyActive.push(repo.repoId);
          }
        }

        const now = new Date().toISOString();

        // 5. Reactivate inactive integrations
        if (toReactivate.length > 0) {
          await ctx.db
            .update(workspaceIntegrations)
            .set({ isActive: true, updatedAt: now })
            .where(inArray(workspaceIntegrations.id, toReactivate));
        }

        // 6. Create new integrations
        if (toCreate.length > 0) {
          const integrations = toCreate.map((repo) => ({
            workspaceId: input.workspaceId,
            userSourceId: input.userSourceId,
            connectedBy: ctx.auth.userId,
            providerResourceId: repo.repoId,
            sourceConfig: {
              sourceType: "github" as const,
              type: "repository" as const,
              installationId: input.installationId,
              repoId: repo.repoId,
              repoFullName: repo.repoFullName,
              repoName: repo.repoFullName.split("/")[1] ?? repo.repoFullName,
              defaultBranch: "main",
              isPrivate: false,
              isArchived: false,
              sync: {
                branches: ["main"],
                paths: ["**/*"],
                events: ["push", "pull_request", "issues", "release", "discussion"],
                autoSync: true,
              },
            },
            isActive: true,
            connectedAt: now,
          }));

          await ctx.db.insert(workspaceIntegrations).values(integrations);
        }

        return {
          created: toCreate.length,
          reactivated: toReactivate.length,
          skipped: alreadyActive.length,
        };
      }),

    /**
     * Bulk link multiple Vercel projects to workspace
     *
     * Allows connecting multiple Vercel projects in a single operation.
     * Handles idempotency by reactivating inactive integrations.
     */
    bulkLinkVercelProjects: orgScopedProcedure
      .input(
        z.object({
          workspaceId: z.string(),
          userSourceId: z.string(),
          projects: z
            .array(
              z.object({
                projectId: z.string(),
                projectName: z.string(),
              }),
            )
            .min(1)
            .max(50),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        // 1. Verify workspace access
        const workspace = await ctx.db.query.orgWorkspaces.findFirst({
          where: and(
            eq(orgWorkspaces.id, input.workspaceId),
            eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId),
          ),
        });

        if (!workspace) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });
        }

        // 2. Verify user source ownership
        const source = await ctx.db.query.userSources.findFirst({
          where: and(
            eq(userSources.id, input.userSourceId),
            eq(userSources.userId, ctx.auth.userId),
            eq(userSources.sourceType, "vercel"),
          ),
        });

        if (!source) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Vercel connection not found",
          });
        }

        const providerMetadata = source.providerMetadata;
        if (providerMetadata.sourceType !== "vercel") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid provider metadata",
          });
        }

        // 3. Get existing connections to avoid duplicates
        const existing = await ctx.db.query.workspaceIntegrations.findMany({
          where: and(
            eq(workspaceIntegrations.workspaceId, input.workspaceId),
            eq(workspaceIntegrations.userSourceId, input.userSourceId),
          ),
        });

        const existingMap = new Map(
          existing.map((e) => [e.providerResourceId, e]),
        );

        // 4. Categorize projects
        const toCreate: typeof input.projects = [];
        const toReactivate: string[] = [];
        const alreadyActive: string[] = [];

        for (const project of input.projects) {
          const existingIntegration = existingMap.get(project.projectId);
          if (!existingIntegration) {
            toCreate.push(project);
          } else if (!existingIntegration.isActive) {
            toReactivate.push(existingIntegration.id);
          } else {
            alreadyActive.push(project.projectId);
          }
        }

        const now = new Date().toISOString();

        // 5. Reactivate inactive integrations
        if (toReactivate.length > 0) {
          await ctx.db
            .update(workspaceIntegrations)
            .set({ isActive: true, updatedAt: now })
            .where(inArray(workspaceIntegrations.id, toReactivate));
        }

        // 6. Create new integrations
        if (toCreate.length > 0) {
          const integrations = toCreate.map((p) => ({
            workspaceId: input.workspaceId,
            userSourceId: input.userSourceId,
            connectedBy: ctx.auth.userId,
            providerResourceId: p.projectId,
            sourceConfig: {
              sourceType: "vercel" as const,
              type: "project" as const,
              projectId: p.projectId,
              projectName: p.projectName,
              teamId: providerMetadata.teamId,
              teamSlug: providerMetadata.teamSlug,
              configurationId: providerMetadata.configurationId,
              sync: {
                events: [
                  "deployment.created",
                  "deployment.succeeded",
                  "deployment.ready",
                  "deployment.error",
                  "deployment.canceled",
                ],
                autoSync: true,
              },
            },
            isActive: true,
            connectedAt: now,
          }));

          await ctx.db.insert(workspaceIntegrations).values(integrations);
        }

        return {
          created: toCreate.length,
          reactivated: toReactivate.length,
          skipped: alreadyActive.length,
        };
      }),
  },
} satisfies TRPCRouterRecord;
