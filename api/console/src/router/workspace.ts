import type { TRPCRouterRecord } from "@trpc/server";
import { db } from "@db/console/client";
import {
  workspaces,
  connectedSources,
  stores,
  docsDocuments,
  jobs,
  DeusConnectedRepository,
} from "@db/console/schema";
import { eq, and, desc, count, sql, inArray, sum, avg, gte, lte } from "drizzle-orm";
import { getWorkspaceKey } from "@db/console/utils";
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

import { publicProcedure, protectedProcedure, inngestM2MProcedure } from "../trpc";

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
  listByClerkOrgSlug: protectedProcedure
    .input(workspaceListInputSchema)
    .query(async ({ ctx, input }) => {
      if (ctx.auth.type !== "clerk") {
        throw new Error("Clerk authentication required");
      }

      // Get org by slug from URL
      const { clerkClient } = await import("@vendor/clerk/server");
      const { TRPCError } = await import("@trpc/server");
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
      const orgWorkspaces = await db.query.workspaces.findMany({
        where: eq(workspaces.clerkOrgId, clerkOrg.id),
        orderBy: [desc(workspaces.createdAt)],
      });

      return orgWorkspaces.map((workspace) => ({
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
      // Find connected GitHub source by organization slug
      // GitHub installations store accountLogin in sourceMetadata
      // Use type-safe JSON extraction instead of raw SQL interpolation
      const githubSource = await db.query.connectedSources.findFirst({
        where: and(
          eq(connectedSources.sourceType, "github"),
          eq(connectedSources.isActive, true),
          eq(
            sql`${connectedSources.sourceMetadata}->>'accountLogin'`,
            input.githubOrgSlug
          ),
        ),
      });

      if (!githubSource || !githubSource.workspaceId) {
        throw new Error(
          `No active GitHub installation found for organization: ${input.githubOrgSlug}`,
        );
      }

      // Fetch workspace details
      const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, githubSource.workspaceId),
      });

      if (!workspace) {
        throw new Error(
          `Workspace not found for ID: ${githubSource.workspaceId}`,
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
  getByName: protectedProcedure
    .input(workspaceStatisticsInputSchema)
    .query(async ({ ctx, input }) => {
      // Resolve workspace from name (user-facing)
      const { resolveWorkspaceByName } = await import("../trpc");
      const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
        clerkOrgSlug: input.clerkOrgSlug,
        workspaceName: input.workspaceName,
        userId: ctx.auth.userId,
      });

      // Fetch full workspace details
      const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId),
      });

      if (!workspace) {
        const { TRPCError } = await import("@trpc/server");
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
  create: protectedProcedure
    .input(workspaceCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.auth.type !== "clerk") {
        throw new Error("Clerk authentication required");
      }

      // Verify user has access to this organization
      const { clerkClient } = await import("@vendor/clerk/server");
      const { TRPCError } = await import("@trpc/server");
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
      const { createCustomWorkspace } = await import("@db/console/utils");

      try {
        const workspaceId = await createCustomWorkspace(
          input.clerkOrgId,
          input.workspaceName,
        );

        // Fetch workspace to get slug
        const workspace = await db.query.workspaces.findFirst({
          where: eq(workspaces.id, workspaceId),
        });

        if (!workspace) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch created workspace",
          });
        }

        // Compute workspace key from slug
        const workspaceKey = getWorkspaceKey(workspace.slug);

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
  jobPercentiles: protectedProcedure
    .input(workspaceJobPercentilesInputSchema)
    .query(async ({ ctx, input }) => {
      // Resolve workspace from name (user-facing)
      const { resolveWorkspaceByName } = await import("../trpc");
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
      const completedJobs = await db.query.jobs.findMany({
        where: and(
          eq(jobs.workspaceId, workspaceId),
          eq(jobs.status, "completed"),
          gte(jobs.createdAt, startTime),
          sql`${jobs.durationMs} IS NOT NULL`,
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
  performanceTimeSeries: protectedProcedure
    .input(workspacePerformanceTimeSeriesInputSchema)
    .query(async ({ ctx, input }) => {
      // Resolve workspace from name (user-facing)
      const { resolveWorkspaceByName } = await import("../trpc");
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
      const recentJobs = await db.query.jobs.findMany({
        where: and(
          eq(jobs.workspaceId, workspaceId),
          gte(jobs.createdAt, startTime),
        ),
        columns: {
          createdAt: true,
          durationMs: true,
          status: true,
        },
        orderBy: [desc(jobs.createdAt)],
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
   * Workspace integrations sub-router
   */
  integrations: {
    /**
     * List integrations for a workspace
     * Returns all connected sources/integrations for the workspace
     */
    list: protectedProcedure
      .input(workspaceStatisticsInputSchema)
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { resolveWorkspaceByName } = await import("../trpc");
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // Get all workspace sources (simplified 2-table model)
        const { workspaceSources, userSources } = await import("@db/console/schema");

        const sources = await db
          .select({
            // From workspaceSources
            id: workspaceSources.id,
            isActive: workspaceSources.isActive,
            connectedAt: workspaceSources.connectedAt,
            lastSyncedAt: workspaceSources.lastSyncedAt,
            lastSyncStatus: workspaceSources.lastSyncStatus,
            sourceConfig: workspaceSources.sourceConfig,
            documentCount: workspaceSources.documentCount,
            // From userSources
            provider: userSources.provider,
          })
          .from(workspaceSources)
          .innerJoin(
            userSources,
            eq(workspaceSources.userSourceId, userSources.id)
          )
          .where(eq(workspaceSources.workspaceId, workspaceId))
          .orderBy(desc(workspaceSources.connectedAt));

        return sources.map((source) => {
          // Extract metadata based on provider
          let metadata: Record<string, any> = {};

          if (
            source.provider === "github" &&
            source.sourceConfig.provider === "github" &&
            source.sourceConfig.type === "repository"
          ) {
            metadata = {
              repoFullName: source.sourceConfig.repoFullName,
              repoName: source.sourceConfig.repoName,
              defaultBranch: source.sourceConfig.defaultBranch,
              isPrivate: source.sourceConfig.isPrivate,
              isArchived: source.sourceConfig.isArchived,
              documentCount: source.documentCount,
            };
          }

          return {
            id: source.id,
            provider: source.provider,
            isActive: source.isActive,
            connectedAt: source.connectedAt,
            lastSyncAt: source.lastSyncedAt,
            lastSyncStatus: source.lastSyncStatus,
            isBilledViaVercel: false, // TODO: Determine from metadata
            metadata,
            // For backward compatibility with frontend components that expect resource.resourceData
            resource: {
              id: source.id,
              resourceData: source.sourceConfig,
            },
          };
        });
      }),

    /**
     * Disconnect/remove a source from a workspace
     * Note: Only requires integrationId - workspace access is verified through the source
     */
    disconnect: protectedProcedure
      .input(workspaceIntegrationDisconnectInputSchema)
      .mutation(async ({ ctx, input }) => {
        // Get workspace source (simplified 2-table model)
        const { workspaceSources } = await import("@db/console/schema");

        const source = await db.query.workspaceSources.findFirst({
          where: eq(workspaceSources.id, input.integrationId),
        });

        if (!source) {
          const { TRPCError } = await import("@trpc/server");
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Source not found",
          });
        }

        // Get workspace to verify access
        const workspace = await db.query.workspaces.findFirst({
          where: eq(workspaces.id, source.workspaceId),
        });

        if (!workspace) {
          const { TRPCError } = await import("@trpc/server");
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });
        }

        // Verify user has access to the org
        const { clerkClient } = await import("@vendor/clerk/server");
        const { TRPCError } = await import("@trpc/server");
        const clerk = await clerkClient();

        const membership = await clerk.organizations.getOrganizationMembershipList({
          organizationId: workspace.clerkOrgId,
        });

        const userMembership = membership.data.find(
          (m) => m.publicUserData?.userId === ctx.auth.userId,
        );

        if (!userMembership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this workspace",
          });
        }

        // Mark source as inactive instead of deleting
        await db
          .update(workspaceSources)
          .set({
            isActive: false,
            lastSyncedAt: new Date(),
          })
          .where(eq(workspaceSources.id, input.integrationId));

        return { success: true };
      }),
  },

  /**
   * Update workspace name
   * Used by workspace settings page to update the user-facing name
   */
  updateName: protectedProcedure
    .input(workspaceUpdateNameInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Resolve workspace from current name (user-facing)
      const { resolveWorkspaceByName } = await import("../trpc");
      const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
        clerkOrgSlug: input.clerkOrgSlug,
        workspaceName: input.currentName,
        userId: ctx.auth.userId,
      });

      const { TRPCError } = await import("@trpc/server");

      // Check if new name already exists in this organization
      const existingWorkspace = await db.query.workspaces.findFirst({
        where: and(
          eq(workspaces.clerkOrgId, clerkOrgId),
          eq(workspaces.name, input.newName),
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
        .update(workspaces)
        .set({
          name: input.newName,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(workspaces.id, workspaceId));

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
   */
  sources: {
    /**
     * List connected sources for a workspace
     * Replaces the sources portion of the old statistics procedure
     */
    list: protectedProcedure
      .input(workspaceStatisticsInputSchema)
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { resolveWorkspaceByName } = await import("../trpc");
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // Get connected sources
        const sources = await db.query.connectedSources.findMany({
          where: and(
            eq(connectedSources.workspaceId, workspaceId),
            eq(connectedSources.isActive, true),
          ),
          orderBy: [desc(connectedSources.connectedAt)],
        });

        return {
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
            displayName: s.displayName,
            documentCount: s.documentCount,
            lastSyncedAt: s.lastSyncedAt,
            lastIngestedAt: s.lastIngestedAt,
            metadata: s.sourceMetadata,
          })),
        };
      }),
  },

  /**
   * Stores sub-router
   */
  stores: {
    /**
     * List stores with document counts
     * Replaces the stores portion of the old statistics procedure
     */
    list: protectedProcedure
      .input(workspaceStatisticsInputSchema)
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { resolveWorkspaceByName } = await import("../trpc");
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // Get stores with document counts
        const storesWithCounts = await db
          .select({
            id: stores.id,
            slug: stores.slug,
            indexName: stores.indexName,
            embeddingDim: stores.embeddingDim,
            createdAt: stores.createdAt,
            documentCount: count(docsDocuments.id),
          })
          .from(stores)
          .leftJoin(docsDocuments, eq(stores.id, docsDocuments.storeId))
          .where(eq(stores.workspaceId, workspaceId))
          .groupBy(stores.id);

        return {
          total: storesWithCounts.length,
          list: storesWithCounts.map((s) => ({
            id: s.id,
            slug: s.slug,
            indexName: s.indexName,
            embeddingDim: s.embeddingDim,
            documentCount: s.documentCount,
            createdAt: s.createdAt,
          })),
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
    stats: protectedProcedure
      .input(workspaceStatisticsInputSchema)
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { resolveWorkspaceByName } = await import("../trpc");
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // Get total document count
        const [docCountResult] = await db
          .select({ count: count() })
          .from(docsDocuments)
          .innerJoin(stores, eq(stores.id, docsDocuments.storeId))
          .where(eq(stores.workspaceId, workspaceId));

        // Get total chunk count (sum of all chunkCounts)
        const [chunkCountResult] = await db
          .select({
            total: sql<number>`COALESCE(SUM(${docsDocuments.chunkCount}), 0)`,
          })
          .from(docsDocuments)
          .innerJoin(stores, eq(stores.id, docsDocuments.storeId))
          .where(eq(stores.workspaceId, workspaceId));

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
    stats: protectedProcedure
      .input(workspaceStatisticsInputSchema)
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { resolveWorkspaceByName } = await import("../trpc");
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
            queued: sum(sql<number>`CASE WHEN ${jobs.status} = 'queued' THEN 1 ELSE 0 END`),
            running: sum(sql<number>`CASE WHEN ${jobs.status} = 'running' THEN 1 ELSE 0 END`),
            completed: sum(sql<number>`CASE WHEN ${jobs.status} = 'completed' THEN 1 ELSE 0 END`),
            failed: sum(sql<number>`CASE WHEN ${jobs.status} = 'failed' THEN 1 ELSE 0 END`),
            cancelled: sum(sql<number>`CASE WHEN ${jobs.status} = 'cancelled' THEN 1 ELSE 0 END`),
            avgDurationMs: avg(sql<number>`CAST(${jobs.durationMs} AS BIGINT)`),
          })
          .from(jobs)
          .where(
            and(
              eq(jobs.workspaceId, workspaceId),
              gte(jobs.createdAt, oneDayAgo),
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
    recent: protectedProcedure
      .input(workspaceStatisticsInputSchema)
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { resolveWorkspaceByName } = await import("../trpc");
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // Get recent jobs (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const recentJobs = await db.query.jobs.findMany({
          where: and(
            eq(jobs.workspaceId, workspaceId),
            gte(jobs.createdAt, oneDayAgo),
          ),
          orderBy: [desc(jobs.createdAt)],
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
    overview: protectedProcedure
      .input(workspaceSystemHealthInputSchema)
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { resolveWorkspaceByName } = await import("../trpc");
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // Get recent jobs for health calculation (last 24h)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const recentJobs = await db.query.jobs.findMany({
          where: and(
            eq(jobs.workspaceId, workspaceId),
            gte(jobs.createdAt, oneDayAgo),
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

  // ============================================================================
  // Inngest M2M Procedures
  // ============================================================================

  /**
   * Get workspace by ID (Inngest workflows)
   *
   * Used by workflows to fetch workspace details (especially clerkOrgId).
   */
  getForInngest: inngestM2MProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input }) => {
      const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, input.workspaceId),
      });

      if (!workspace) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Workspace not found: ${input.workspaceId}`,
        });
      }

      return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        clerkOrgId: workspace.clerkOrgId,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      };
    }),
} satisfies TRPCRouterRecord;
