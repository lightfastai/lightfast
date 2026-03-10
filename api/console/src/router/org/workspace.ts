import { db } from "@db/console/client";
import {
  gwInstallations,
  orgWorkspaces,
  workspaceActorProfiles,
  workspaceEvents,
  workspaceIntegrations,
  workspaceKnowledgeDocuments,
  workspaceWorkflowRuns,
} from "@db/console/schema";
import { createCustomWorkspace, getWorkspaceKey } from "@db/console/utils";
import type { ProviderName, SourceType } from "@repo/console-providers";
import {
  getDefaultSyncEvents,
  PROVIDERS,
  sourceTypeSchema,
} from "@repo/console-providers";
import type { BackfillTriggerPayload } from "@repo/console-providers";
import {
  workspaceCreateInputSchema,
  workspaceIntegrationDisconnectInputSchema,
  workspaceJobPercentilesInputSchema,
  workspaceListInputSchema,
  workspacePerformanceTimeSeriesInputSchema,
  workspaceStatisticsInputSchema,
  workspaceSystemHealthInputSchema,
  workspaceUpdateNameInputSchema,
} from "@repo/console-validation/schemas";
import { invalidateWorkspaceConfig } from "@repo/console-workspace-cache";
import { createBackfillClient } from "@repo/gateway-service-clients";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import {
  and,
  avg,
  count,
  desc,
  eq,
  gte,
  inArray,
  like,
  sql,
  sum,
} from "drizzle-orm";
import { z } from "zod";
import { env } from "../../env";
import { recordActivity } from "../../lib/activity";
import { ensureActorLinked } from "../../lib/actor-linking";
import { orgScopedProcedure, resolveWorkspaceByName } from "../../trpc";

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

      // Lazy actor linking: connect Clerk user to their GitHub-based actor identity
      // Fire-and-forget to avoid blocking workspace access
      // Changed to org-level linking: links once per org, not per workspace
      void (async () => {
        try {
          const clerk = await clerkClient();
          const user = await clerk.users.getUser(ctx.auth.userId);
          await ensureActorLinked(clerkOrgId, user);
        } catch {
          // Silently ignore linking errors - this is best-effort
        }
      })();

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

        // Trigger backfill for all active connections in this org (best-effort)
        const activeInstallations = await db
          .select({
            id: gwInstallations.id,
            provider: gwInstallations.provider,
          })
          .from(gwInstallations)
          .where(
            and(
              eq(gwInstallations.orgId, input.clerkOrgId),
              eq(gwInstallations.status, "active")
            )
          );

        for (const inst of activeInstallations) {
          void notifyBackfill({
            installationId: inst.id,
            provider: inst.provider,
            orgId: input.clerkOrgId,
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
          sql`${workspaceWorkflowRuns.durationMs} IS NOT NULL`
        ),
        columns: {
          durationMs: true,
        },
      });

      // Extract and parse durations
      const durations = completedJobs
        .map((j) => Number.parseInt(j.durationMs ?? "0", 10))
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
        return durations[index] ?? 0;
      };

      return {
        hasData: true,
        p50: getPercentile(50),
        p95: getPercentile(95),
        p99: getPercentile(99),
        max: durations.at(-1) ?? 0,
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
          gte(workspaceWorkflowRuns.createdAt, startTime)
        ),
        columns: {
          createdAt: true,
          durationMs: true,
          status: true,
        },
        orderBy: [desc(workspaceWorkflowRuns.createdAt)],
      });

      // Group by hour
      const hourBuckets = new Map<
        string,
        { jobs: typeof recentJobs; completed: number; totalDuration: number }
      >();

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
            const duration = Number.parseInt(job.durationMs ?? "0", 10);
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
          eq(orgWorkspaces.name, input.newName)
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

      // Invalidate workspace config cache (defensive, in case future updates touch config fields)
      await invalidateWorkspaceConfig(workspaceId);

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

        // Get all workspace sources (read provider from denormalized column)
        // LEFT JOIN gwInstallations to include backfill config from the installation
        const sources = await db
          .select({
            id: workspaceIntegrations.id,
            installationId: workspaceIntegrations.installationId,
            sourceType: workspaceIntegrations.provider,
            isActive: workspaceIntegrations.isActive,
            connectedAt: workspaceIntegrations.connectedAt,
            lastSyncedAt: workspaceIntegrations.lastSyncedAt,
            lastSyncStatus: workspaceIntegrations.lastSyncStatus,
            documentCount: workspaceIntegrations.documentCount,
            providerResourceId: workspaceIntegrations.providerResourceId,
            providerConfig: workspaceIntegrations.providerConfig,
            backfillConfig: gwInstallations.backfillConfig,
          })
          .from(workspaceIntegrations)
          .innerJoin(
            gwInstallations,
            eq(workspaceIntegrations.installationId, gwInstallations.id)
          )
          .where(
            and(
              eq(workspaceIntegrations.workspaceId, workspaceId),
              eq(workspaceIntegrations.isActive, true)
            )
          )
          .orderBy(desc(workspaceIntegrations.connectedAt));

        // Format for compatibility with old interface
        return {
          workspaceId, // Include workspaceId for UI components that need it
          total: sources.length,
          byType: sources.reduce(
            (acc, s) => {
              acc[s.sourceType] = (acc[s.sourceType] ?? 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          ),
          list: sources.map((s) => ({
            id: s.id,
            installationId: s.installationId,
            type: s.sourceType,
            sourceType: s.sourceType, // Canonical name
            displayName: s.providerResourceId,
            documentCount: s.documentCount,
            isActive: s.isActive, // For UI compatibility
            connectedAt: s.connectedAt, // For UI compatibility
            lastSyncedAt: s.lastSyncedAt,
            lastIngestedAt: s.lastSyncedAt,
            lastSyncAt: s.lastSyncedAt, // Alias for UI compatibility
            lastSyncStatus: s.lastSyncStatus, // For UI compatibility
            metadata: s.providerConfig,
            backfillConfig: s.backfillConfig,
            resource: {
              // For backward compatibility
              id: s.id,
              resourceData: s.providerConfig,
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
            settings: orgWorkspaces.settings,
            createdAt: orgWorkspaces.createdAt,
            documentCount: count(workspaceKnowledgeDocuments.id),
          })
          .from(orgWorkspaces)
          .leftJoin(
            workspaceKnowledgeDocuments,
            eq(orgWorkspaces.id, workspaceKnowledgeDocuments.workspaceId)
          )
          .where(eq(orgWorkspaces.id, workspaceId))
          .groupBy(orgWorkspaces.id)
          .limit(1);

        if (!workspaceWithCount) {
          return null;
        }

        // Settings is always populated (NOT NULL)
        const { embedding } = workspaceWithCount.settings;

        return {
          id: workspaceWithCount.id,
          indexName: embedding.indexName,
          namespaceName: embedding.namespaceName,
          embeddingModel: embedding.embeddingModel,
          embeddingDim: embedding.embeddingDim,
          chunkMaxTokens: embedding.chunkMaxTokens,
          chunkOverlap: embedding.chunkOverlap,
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
          total: docCountResult?.count ?? 0,
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
        const oneDayAgo = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString();

        // Get job statistics with SQL aggregation (single query)
        const [jobStats] = await db
          .select({
            total: count(),
            queued: sum(
              sql<number>`CASE WHEN ${workspaceWorkflowRuns.status} = 'queued' THEN 1 ELSE 0 END`
            ),
            running: sum(
              sql<number>`CASE WHEN ${workspaceWorkflowRuns.status} = 'running' THEN 1 ELSE 0 END`
            ),
            completed: sum(
              sql<number>`CASE WHEN ${workspaceWorkflowRuns.status} = 'completed' THEN 1 ELSE 0 END`
            ),
            failed: sum(
              sql<number>`CASE WHEN ${workspaceWorkflowRuns.status} = 'failed' THEN 1 ELSE 0 END`
            ),
            cancelled: sum(
              sql<number>`CASE WHEN ${workspaceWorkflowRuns.status} = 'cancelled' THEN 1 ELSE 0 END`
            ),
            avgDurationMs: avg(
              sql<number>`CAST(${workspaceWorkflowRuns.durationMs} AS BIGINT)`
            ),
          })
          .from(workspaceWorkflowRuns)
          .where(
            and(
              eq(workspaceWorkflowRuns.workspaceId, workspaceId),
              gte(workspaceWorkflowRuns.createdAt, oneDayAgo)
            )
          );

        return {
          total: jobStats?.total ?? 0,
          completed: Number(jobStats?.completed) || 0,
          failed: Number(jobStats?.failed) || 0,
          successRate:
            (jobStats?.total ?? 0) > 0
              ? ((Number(jobStats?.completed) || 0) / (jobStats?.total ?? 0)) *
                100
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
        const oneDayAgo = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString();

        const recentJobs = await db.query.workspaceWorkflowRuns.findMany({
          where: and(
            eq(workspaceWorkflowRuns.workspaceId, workspaceId),
            gte(workspaceWorkflowRuns.createdAt, oneDayAgo)
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
        const oneDayAgo = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString();

        const recentJobs = await db.query.workspaceWorkflowRuns.findMany({
          where: and(
            eq(workspaceWorkflowRuns.workspaceId, workspaceId),
            gte(workspaceWorkflowRuns.createdAt, oneDayAgo)
          ),
          columns: {
            status: true,
            repositoryId: true,
          },
        });

        // Calculate health status helper
        const getHealthStatus = (
          successRate: number
        ): "healthy" | "degraded" | "down" => {
          if (successRate >= 95) {
            return "healthy";
          }
          if (successRate >= 80) {
            return "degraded";
          }
          return "down";
        };

        // Calculate overall workspace health
        const completedJobs = recentJobs.filter(
          (j) => j.status === "completed"
        );
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

        if (integration?.workspace.clerkOrgId !== ctx.auth.orgId) {
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
          installationId: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { workspaceId, projectId, installationId } = input;

        // Verify org owns the workspace
        const workspace = await ctx.db.query.orgWorkspaces.findFirst({
          where: and(
            eq(orgWorkspaces.id, workspaceId),
            eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId)
          ),
        });

        if (!workspace) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });
        }

        // Verify org owns the Vercel installation
        const installation = await ctx.db.query.gwInstallations.findFirst({
          where: and(
            eq(gwInstallations.id, installationId),
            eq(gwInstallations.orgId, ctx.auth.orgId),
            eq(gwInstallations.provider, "vercel")
          ),
        });

        if (!installation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Vercel connection not found",
          });
        }

        const providerAccountInfo = installation.providerAccountInfo;
        if (providerAccountInfo?.sourceType !== "vercel") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid provider account info",
          });
        }

        // Check if already linked
        const existing = await ctx.db.query.workspaceIntegrations.findFirst({
          where: and(
            eq(workspaceIntegrations.workspaceId, workspaceId),
            eq(workspaceIntegrations.providerResourceId, projectId)
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
            installationId,
            provider: "vercel",
            connectedBy: ctx.auth.userId,
            providerConfig: {
              version: 1 as const,
              sourceType: "vercel" as const,
              type: "project" as const,
              projectId,
              teamId: providerAccountInfo.raw.team_id ?? undefined,
              configurationId: providerAccountInfo.raw.installation_id,
              sync: {
                events: [...getDefaultSyncEvents("vercel")],
                autoSync: true,
              },
            },
            providerResourceId: projectId,
            isActive: true,
            connectedAt: now,
          })
          .returning({ id: workspaceIntegrations.id });

        const insertedId = result[0]?.id;
        if (!insertedId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create Vercel integration",
          });
        }
        return { id: insertedId, created: true, reactivated: false };
      }),

    /**
     * Unlink Vercel project from workspace
     */
    unlinkVercelProject: orgScopedProcedure
      .input(
        z.object({
          integrationId: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const integration = await ctx.db.query.workspaceIntegrations.findFirst({
          where: eq(workspaceIntegrations.id, input.integrationId),
          with: {
            workspace: true,
          },
        });

        if (integration?.workspace.clerkOrgId !== ctx.auth.orgId) {
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
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verify integration belongs to user's org
        const integration = await ctx.db.query.workspaceIntegrations.findFirst({
          where: eq(workspaceIntegrations.id, input.integrationId),
          with: {
            workspace: true,
          },
        });

        if (integration?.workspace.clerkOrgId !== ctx.auth.orgId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Integration not found",
          });
        }

        // Update provider_config.sync.events using JSON merge
        // The providerConfig is a discriminated union type, so we need to preserve it properly
        const currentConfig = integration.providerConfig;

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
            providerConfig: updatedConfig,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(workspaceIntegrations.id, input.integrationId));

        return { success: true };
      }),

    /**
     * Bulk link resources (repositories, projects, teams) to a workspace.
     *
     * Generic mutation replacing provider-specific bulkLink* mutations.
     * Per-provider providerConfig construction is handled by PROVIDERS[provider].buildProviderConfig.
     */
    bulkLinkResources: orgScopedProcedure
      .input(
        z.object({
          provider: sourceTypeSchema,
          workspaceId: z.string(),
          gwInstallationId: z.string(),
          resources: z
            .array(
              z.object({
                resourceId: z.string(),
                resourceName: z.string(),
              })
            )
            .min(1)
            .max(50),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { provider, workspaceId, gwInstallationId, resources } = input;

        // 1. Verify workspace access
        const workspace = await ctx.db.query.orgWorkspaces.findFirst({
          where: and(
            eq(orgWorkspaces.id, workspaceId),
            eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId)
          ),
        });

        if (!workspace) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });
        }

        // 2. Verify org owns the installation for this provider
        const gwInstallation = await ctx.db.query.gwInstallations.findFirst({
          where: and(
            eq(gwInstallations.id, gwInstallationId),
            eq(gwInstallations.orgId, ctx.auth.orgId),
            eq(gwInstallations.provider, provider)
          ),
        });

        if (!gwInstallation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `${provider} connection not found`,
          });
        }

        // 3. Get existing integrations to avoid duplicates
        const existing = await ctx.db.query.workspaceIntegrations.findMany({
          where: and(
            eq(workspaceIntegrations.workspaceId, workspaceId),
            eq(workspaceIntegrations.installationId, gwInstallationId)
          ),
        });

        const existingMap = new Map(
          existing.map((e) => [e.providerResourceId, e])
        );

        // 4. Categorize resources
        const toCreate: typeof resources = [];
        const toReactivate: string[] = [];
        const alreadyActive: string[] = [];

        for (const resource of resources) {
          const existingIntegration = existingMap.get(resource.resourceId);
          if (!existingIntegration) {
            toCreate.push(resource);
          } else if (existingIntegration.isActive) {
            alreadyActive.push(resource.resourceId);
          } else {
            toReactivate.push(existingIntegration.id);
          }
        }

        const now = new Date().toISOString();
        const typedProvider = provider as ProviderName;
        const defaultSyncEvents = getDefaultSyncEvents(typedProvider);

        // 5. Reactivate inactive integrations
        if (toReactivate.length > 0) {
          await ctx.db
            .update(workspaceIntegrations)
            .set({ isActive: true, updatedAt: now })
            .where(inArray(workspaceIntegrations.id, toReactivate));
        }

        // 6. Create new integrations
        if (toCreate.length > 0) {
          const integrations = toCreate.map((resource) => ({
            workspaceId,
            installationId: gwInstallationId,
            provider,
            connectedBy: ctx.auth.userId,
            providerResourceId: resource.resourceId,
            providerConfig: PROVIDERS[typedProvider].buildProviderConfig({
              resourceId: resource.resourceId,
              resourceName: resource.resourceName,
              installationExternalId: gwInstallation.externalId,
              providerAccountInfo: gwInstallation.providerAccountInfo,
              defaultSyncEvents,
            }),
            isActive: true,
            connectedAt: now,
          }));

          await ctx.db
            .insert(workspaceIntegrations)
            .values(integrations)
            .returning({ id: workspaceIntegrations.id });

          // Trigger backfill (best-effort)
          void notifyBackfill({
            installationId: gwInstallationId,
            provider,
            orgId: ctx.auth.orgId,
          });
        }

        return {
          created: toCreate.length,
          reactivated: toReactivate.length,
          skipped: alreadyActive.length,
        };
      }),
  },

  /**
   * Get workspace actors for filtering
   * Returns actor profiles with display names for autocomplete
   */
  getActors: orgScopedProcedure
    .input(
      z.object({
        clerkOrgSlug: z.string(),
        workspaceName: z.string(),
        search: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      // Resolve workspace from name
      const { workspaceId } = await resolveWorkspaceByName({
        clerkOrgSlug: input.clerkOrgSlug,
        workspaceName: input.workspaceName,
        userId: ctx.auth.userId,
      });

      // Build where conditions
      const conditions = [eq(workspaceActorProfiles.workspaceId, workspaceId)];

      if (input.search) {
        conditions.push(
          like(workspaceActorProfiles.displayName, `%${input.search}%`)
        );
      }

      // Query actors
      const actors = await db.query.workspaceActorProfiles.findMany({
        where: and(...conditions),
        limit: input.limit,
        orderBy: [desc(workspaceActorProfiles.observationCount)],
      });

      return actors.map((a) => ({
        id: a.id,
        displayName: a.displayName,
        observationCount: a.observationCount,
      }));
    }),

  /**
   * Events sub-router
   * Queries the workspace_events table for transformed SourceEvent records
   */
  events: {
    /**
     * List events for a workspace with cursor pagination, search, and date filtering.
     */
    list: orgScopedProcedure
      .input(
        z.object({
          clerkOrgSlug: z.string(),
          workspaceName: z.string(),
          source: sourceTypeSchema.optional(),
          limit: z.number().min(1).max(100).default(30),
          cursor: z.number().optional(),
          search: z.string().max(200).optional(),
          receivedAfter: z.string().datetime().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        const { limit, cursor, search, receivedAfter } = input;

        const conditions = [eq(workspaceEvents.workspaceId, workspaceId)];

        if (input.source) {
          conditions.push(eq(workspaceEvents.source, input.source));
        }

        if (cursor) {
          conditions.push(sql`${workspaceEvents.id} < ${cursor}`);
        }

        if (search) {
          conditions.push(
            sql`${workspaceEvents.sourceEvent}->>'title' ILIKE ${`%${search}%`}`
          );
        }

        if (receivedAfter) {
          conditions.push(gte(workspaceEvents.receivedAt, receivedAfter));
        }

        const rows = await db
          .select({
            id: workspaceEvents.id,
            source: workspaceEvents.source,
            sourceType: workspaceEvents.sourceType,
            sourceEvent: workspaceEvents.sourceEvent,
            ingestionSource: workspaceEvents.ingestionSource,
            receivedAt: workspaceEvents.receivedAt,
            createdAt: workspaceEvents.createdAt,
          })
          .from(workspaceEvents)
          .where(and(...conditions))
          .orderBy(desc(workspaceEvents.id))
          .limit(limit + 1);

        const hasMore = rows.length > limit;
        const events = hasMore ? rows.slice(0, limit) : rows;
        const nextCursor = hasMore ? (events.at(-1)?.id ?? null) : null;

        return {
          workspaceId,
          clerkOrgId,
          events,
          nextCursor,
          hasMore,
        };
      }),
  },
} satisfies TRPCRouterRecord;

/**
 * Notify the backfill service to trigger a historical backfill for a connection.
 * Best-effort — errors are logged but never thrown.
 *
 * If depth or entityTypes are omitted, they are loaded from gwInstallations.backfillConfig.
 */
export async function notifyBackfill(params: {
  installationId: string;
  provider: SourceType;
  orgId: string;
  depth?: 7 | 30 | 90;
  entityTypes?: string[];
  holdForReplay?: boolean;
  correlationId?: string;
}): Promise<void> {
  let resolvedDepth = params.depth;
  let resolvedEntityTypes = params.entityTypes;

  // Load stored defaults when caller omits depth or entityTypes
  if (resolvedDepth === undefined || resolvedEntityTypes === undefined) {
    try {
      const installation = await db.query.gwInstallations.findFirst({
        where: eq(gwInstallations.id, params.installationId),
        columns: { backfillConfig: true },
      });
      if (installation?.backfillConfig) {
        resolvedDepth ??= installation.backfillConfig.depth;
        resolvedEntityTypes ??= installation.backfillConfig.entityTypes;
      }
    } catch (err) {
      console.error("[console] Failed to load backfill config defaults", {
        installationId: params.installationId,
        err,
      });
    }
  }

  const payload: BackfillTriggerPayload = {
    installationId: params.installationId,
    provider: params.provider,
    orgId: params.orgId,
    depth: resolvedDepth ?? 30,
    entityTypes: resolvedEntityTypes,
    holdForReplay: params.holdForReplay,
  };

  try {
    const client = createBackfillClient({ apiKey: env.GATEWAY_API_KEY });
    await client.trigger(payload);
  } catch (err) {
    console.error("[console] Failed to trigger backfill", {
      installationId: params.installationId,
      provider: params.provider,
      err,
    });
  }
}
