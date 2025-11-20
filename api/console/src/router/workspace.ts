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
import { eq, and, desc, count, sql } from "drizzle-orm";
import { z } from "zod";
import { getOrCreateDefaultWorkspace, getWorkspaceKey } from "@db/console/utils";
import { WORKSPACE_NAME, NAMING_ERRORS } from "@db/console/constants/naming";

import { publicProcedure, protectedProcedure } from "../trpc";

/**
 * Workspace router - internal procedures for API routes
 * PUBLIC procedures for webhook/API route usage
 */
export const workspaceRouter = {
  /**
   * List workspaces for a Clerk organization
   * Used by the org/workspace switcher to show available workspaces
   *
   * Automatically creates a default workspace if none exist for the organization
   *
   * IMPORTANT: This procedure verifies the user has access to the org from the URL.
   * No need for blocking access checks in layouts - let this handle it.
   */
  listByClerkOrgSlug: protectedProcedure
    .input(
      z.object({
        clerkOrgSlug: z.string(),
      }),
    )
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

      const clerkOrgId = clerkOrg.id;

      // First, ensure a default workspace exists for this organization
      await getOrCreateDefaultWorkspace(clerkOrgId);

      // Then fetch all workspaces with repository information
      const orgWorkspaces = await db.query.workspaces.findMany({
        where: eq(workspaces.clerkOrgId, clerkOrgId),
      });

      // For each workspace, get connected repositories
      const workspacesWithRepos = await Promise.all(
        orgWorkspaces.map(async (workspace) => {
          // Get repositories for this workspace
          const repos = await db
            .select()
            .from(DeusConnectedRepository)
            .where(
              and(
                eq(DeusConnectedRepository.workspaceId, workspace.id),
                eq(DeusConnectedRepository.isActive, true),
              ),
            )
            .limit(3); // Get up to 3 repos to show

          // Get document count for this workspace
          const [docCount] = await db
            .select({ count: count() })
            .from(docsDocuments)
            .innerJoin(stores, eq(stores.id, docsDocuments.storeId))
            .where(eq(stores.workspaceId, workspace.id));

          // Get recent job for activity status
          const recentJob = await db.query.jobs.findFirst({
            where: eq(jobs.workspaceId, workspace.id),
            orderBy: [desc(jobs.createdAt)],
          });

          return {
            id: workspace.id,
            name: workspace.name,                // User-facing name, used in URLs
            slug: workspace.slug,                // Internal slug for Pinecone
            isDefault: workspace.isDefault,
            createdAt: workspace.createdAt,
            repositories: repos.map((repo) => ({
              id: repo.id,
              configStatus: repo.configStatus,
              metadata: repo.metadata,
              lastSyncedAt: repo.lastSyncedAt,
              documentCount: repo.documentCount,
            })),
            totalDocuments: docCount?.count || 0,
            lastActivity: recentJob?.createdAt || workspace.createdAt,
          };
        }),
      );

      return workspacesWithRepos;
    }),

  /**
   * Resolve workspace ID and key from Clerk organization slug
   * Used by UI components that have the org slug from URL params
   *
   * Returns:
   * - workspaceId: Database UUID for internal operations
   * - workspaceKey: External naming key (ws-<slug>) for Pinecone, etc.
   *
   * IMPORTANT: This procedure verifies the user has access to the org from the URL.
   */
  resolveFromClerkOrgSlug: protectedProcedure
    .input(
      z.object({
        clerkOrgSlug: z.string(),
      }),
    )
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

      const clerkOrgId = clerkOrg.id;

      // Get or create default workspace for this Clerk organization
      const workspaceId = await getOrCreateDefaultWorkspace(clerkOrgId);

      // Fetch workspace to get slug
      const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId),
      });

      if (!workspace) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Workspace not found for ID: ${workspaceId}`,
        });
      }

      // Compute workspace key from slug
      const workspaceKey = getWorkspaceKey(workspace.slug);

      return {
        workspaceId,
        workspaceKey,
        workspaceSlug: workspace.slug,
        clerkOrgId, // Include orgId for downstream queries
      };
    }),

  /**
   * Resolve workspace ID and key from Clerk organization ID
   * Used by API routes to map organizations to their workspaces
   *
   * Returns:
   * - workspaceId: Database UUID for internal operations
   * - workspaceKey: External naming key (ws-<slug>) for Pinecone, etc.
   */
  resolveFromClerkOrgId: publicProcedure
    .input(
      z.object({
        clerkOrgId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      // Get or create default workspace for this Clerk organization
      const workspaceId = await getOrCreateDefaultWorkspace(
        input.clerkOrgId,
      );

      // Fetch workspace to get slug
      const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId),
      });

      if (!workspace) {
        throw new Error(`Workspace not found for ID: ${workspaceId}`);
      }

      // Compute workspace key from slug
      const workspaceKey = getWorkspaceKey(workspace.slug);

      return {
        workspaceId,
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
    .input(
      z.object({
        clerkOrgSlug: z.string(),
        workspaceName: z.string(),
      }),
    )
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
        isDefault: workspace.isDefault,
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
    .input(
      z.object({
        clerkOrgId: z.string(),
        workspaceName: z
          .string()
          .min(WORKSPACE_NAME.MIN_LENGTH, NAMING_ERRORS.WORKSPACE_MIN_LENGTH)
          .max(WORKSPACE_NAME.MAX_LENGTH, NAMING_ERRORS.WORKSPACE_MAX_LENGTH)
          .regex(WORKSPACE_NAME.PATTERN, NAMING_ERRORS.WORKSPACE_PATTERN),
      }),
    )
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
   * Get workspace statistics for dashboard
   * Returns overview metrics: sources, stores, documents, jobs
   */
  statistics: protectedProcedure
    .input(
      z.object({
        clerkOrgSlug: z.string(),
        workspaceName: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Resolve workspace from name (user-facing)
      const { resolveWorkspaceByName } = await import("../trpc");
      const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
        clerkOrgSlug: input.clerkOrgSlug,
        workspaceName: input.workspaceName,
        userId: ctx.auth.userId,
      });

      // Get connected sources count and list
      const sources = await db.query.connectedSources.findMany({
        where: and(
          eq(connectedSources.workspaceId, workspaceId),
          eq(connectedSources.isActive, true),
        ),
        orderBy: [desc(connectedSources.connectedAt)],
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

      // Get recent jobs (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      const recentJobs = await db.query.jobs.findMany({
        where: and(
          eq(jobs.workspaceId, workspaceId),
          sql`${jobs.createdAt} >= ${oneDayAgo}`,
        ),
        orderBy: [desc(jobs.createdAt)],
        limit: 10,
      });

      // Calculate job statistics
      const completedJobs = recentJobs.filter((j) => j.status === "completed");
      const failedJobs = recentJobs.filter((j) => j.status === "failed");
      const avgDurationMs = completedJobs.length
        ? completedJobs.reduce(
            (sum, j) => sum + (Number.parseInt(j.durationMs || "0", 10) || 0),
            0,
          ) / completedJobs.length
        : 0;

      return {
        sources: {
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
        },
        stores: {
          total: storesWithCounts.length,
          list: storesWithCounts.map((s) => ({
            id: s.id,
            slug: s.slug,
            indexName: s.indexName,
            embeddingDim: s.embeddingDim,
            documentCount: s.documentCount,
            createdAt: s.createdAt,
          })),
        },
        documents: {
          total: docCountResult?.count || 0,
          chunks: Number(chunkCountResult?.total) || 0,
        },
        jobs: {
          total: recentJobs.length,
          completed: completedJobs.length,
          failed: failedJobs.length,
          successRate:
            recentJobs.length > 0
              ? (completedJobs.length / recentJobs.length) * 100
              : 0,
          avgDurationMs: Math.round(avgDurationMs),
          recent: recentJobs.slice(0, 5).map((j) => ({
            id: j.id,
            name: j.name,
            status: j.status,
            trigger: j.trigger,
            createdAt: j.createdAt,
            completedAt: j.completedAt,
            durationMs: j.durationMs,
            errorMessage: j.errorMessage,
          })),
        },
      };
    }),

  /**
   * Get workspace statistics comparison for trends
   * Returns current period stats vs previous period for percentage change calculation
   */
  statisticsComparison: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        clerkOrgId: z.string(),
        currentStart: z.string(), // ISO datetime
        currentEnd: z.string(), // ISO datetime
        previousStart: z.string(), // ISO datetime
        previousEnd: z.string(), // ISO datetime
      }),
    )
    .query(async ({ input }) => {
      const {
        workspaceId,
        currentStart,
        currentEnd,
        previousStart,
        previousEnd,
      } = input;

      // Helper to get stats for a period
      const getStatsForPeriod = async (start: string, end: string) => {
        // Get jobs in period
        const periodJobs = await db.query.jobs.findMany({
          where: and(
            eq(jobs.workspaceId, workspaceId),
            sql`${jobs.createdAt} >= ${start}`,
            sql`${jobs.createdAt} <= ${end}`,
          ),
        });

        const completedJobs = periodJobs.filter((j) => j.status === "completed");
        const failedJobs = periodJobs.filter((j) => j.status === "failed");
        const avgDurationMs = completedJobs.length
          ? completedJobs.reduce(
              (sum, j) => sum + (Number.parseInt(j.durationMs || "0", 10) || 0),
              0,
            ) / completedJobs.length
          : 0;

        // Get document count at end of period (approximate with total)
        const [docCount] = await db
          .select({ count: count() })
          .from(docsDocuments)
          .innerJoin(stores, eq(stores.id, docsDocuments.storeId))
          .where(and(
            eq(stores.workspaceId, workspaceId),
            sql`${docsDocuments.createdAt} <= ${end}`,
          ));

        // Get chunk count at end of period
        const [chunkCount] = await db
          .select({
            total: sql<number>`COALESCE(SUM(${docsDocuments.chunkCount}), 0)`,
          })
          .from(docsDocuments)
          .innerJoin(stores, eq(stores.id, docsDocuments.storeId))
          .where(and(
            eq(stores.workspaceId, workspaceId),
            sql`${docsDocuments.createdAt} <= ${end}`,
          ));

        return {
          jobs: {
            total: periodJobs.length,
            completed: completedJobs.length,
            failed: failedJobs.length,
            successRate:
              periodJobs.length > 0
                ? (completedJobs.length / periodJobs.length) * 100
                : 0,
            avgDurationMs: Math.round(avgDurationMs),
          },
          documents: {
            total: docCount?.count || 0,
            chunks: Number(chunkCount?.total) || 0,
          },
        };
      };

      // Get stats for both periods
      const [current, previous] = await Promise.all([
        getStatsForPeriod(currentStart, currentEnd),
        getStatsForPeriod(previousStart, previousEnd),
      ]);

      // Calculate percentage changes
      const calculateChange = (current: number, previous: number): number => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      const changes = {
        documents: {
          total: calculateChange(current.documents.total, previous.documents.total),
          chunks: calculateChange(current.documents.chunks, previous.documents.chunks),
        },
        jobs: {
          total: calculateChange(current.jobs.total, previous.jobs.total),
          completed: calculateChange(current.jobs.completed, previous.jobs.completed),
          failed: calculateChange(current.jobs.failed, previous.jobs.failed),
          successRate: current.jobs.successRate - previous.jobs.successRate, // Absolute difference for percentage
          avgDurationMs: calculateChange(current.jobs.avgDurationMs, previous.jobs.avgDurationMs),
        },
      };

      return {
        current,
        previous,
        changes,
      };
    }),

  /**
   * Get job performance percentiles
   * Returns p50, p95, p99, and max duration metrics
   */
  jobPercentiles: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        clerkOrgId: z.string(),
        timeRange: z.enum(["24h", "7d", "30d"]).default("24h"),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, timeRange } = input;

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
          sql`${jobs.createdAt} >= ${startTime}`,
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
    .input(
      z.object({
        workspaceId: z.string(),
        clerkOrgId: z.string(),
        timeRange: z.enum(["24h", "7d", "30d"]).default("24h"),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, timeRange } = input;

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
          sql`${jobs.createdAt} >= ${startTime}`,
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
   * Get system health hierarchy
   * Returns workspace → stores → sources with health indicators
   */
  systemHealth: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        clerkOrgId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId } = input;

      // Get stores with document counts
      const storesData = await db
        .select({
          id: stores.id,
          slug: stores.slug,
          embeddingDim: stores.embeddingDim,
          documentCount: count(docsDocuments.id),
        })
        .from(stores)
        .leftJoin(docsDocuments, eq(stores.id, docsDocuments.storeId))
        .where(eq(stores.workspaceId, workspaceId))
        .groupBy(stores.id);

      // Get sources
      const sourcesData = await db.query.connectedSources.findMany({
        where: and(
          eq(connectedSources.workspaceId, workspaceId),
          eq(connectedSources.isActive, true),
        ),
      });

      // Get recent jobs for health calculation (last 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      const recentJobs = await db.query.jobs.findMany({
        where: and(
          eq(jobs.workspaceId, workspaceId),
          sql`${jobs.createdAt} >= ${oneDayAgo}`,
        ),
        columns: {
          status: true,
          repositoryId: true,
        },
      });

      // Calculate health status
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

      // Build store hierarchy
      const storesWithSources = storesData.map((store) => {
        // Find sources for this store (simplified - using workspace sources)
        const storeSources = sourcesData.map((source) => {
          // Calculate source-level health based on jobs
          const sourceJobs = recentJobs.filter(
            (j) => j.repositoryId === source.id,
          );
          const sourceCompleted = sourceJobs.filter(
            (j) => j.status === "completed",
          );
          const sourceSuccessRate =
            sourceJobs.length > 0
              ? (sourceCompleted.length / sourceJobs.length) * 100
              : 100;

          return {
            id: source.id,
            type: source.sourceType,
            displayName: source.displayName,
            documentCount: source.documentCount,
            lastSyncedAt: source.lastSyncedAt,
            health: getHealthStatus(sourceSuccessRate),
          };
        });

        // Calculate store-level health
        const storeJobs = recentJobs; // Simplified - using all jobs
        const storeCompleted = storeJobs.filter((j) => j.status === "completed");
        const storeSuccessRate =
          storeJobs.length > 0
            ? (storeCompleted.length / storeJobs.length) * 100
            : 100;

        return {
          id: store.id,
          name: store.slug,
          embeddingDim: store.embeddingDim,
          documentCount: store.documentCount,
          successRate: storeSuccessRate,
          health: getHealthStatus(storeSuccessRate),
          sources: storeSources,
        };
      });

      return {
        workspaceHealth: getHealthStatus(workspaceSuccessRate),
        storesCount: storesData.length,
        sourcesCount: sourcesData.length,
        totalJobs24h: recentJobs.length,
        stores: storesWithSources,
      };
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
      .input(
        z.object({
          clerkOrgSlug: z.string(),
          workspaceName: z.string(),
        }),
      )
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { resolveWorkspaceByName } = await import("../trpc");
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // Get all connected sources for this workspace
        const sources = await db.query.connectedSources.findMany({
          where: eq(connectedSources.workspaceId, workspaceId),
          orderBy: [desc(connectedSources.connectedAt)],
        });

        return sources.map((source) => ({
          id: source.id,
          provider: source.sourceType,
          isActive: source.isActive,
          connectedAt: source.connectedAt,
          lastSyncAt: source.lastSyncedAt,
          isBilledViaVercel: false, // TODO: Determine from metadata
          metadata: source.sourceMetadata,
        }));
      }),

    /**
     * Disconnect/remove an integration from a workspace
     * Note: Only requires integrationId - workspace access is verified through the integration
     */
    disconnect: protectedProcedure
      .input(
        z.object({
          integrationId: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        // Verify the integration belongs to a workspace the user has access to
        const source = await db.query.connectedSources.findFirst({
          where: eq(connectedSources.id, input.integrationId),
        });

        if (!source) {
          const { TRPCError } = await import("@trpc/server");
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Integration not found",
          });
        }

        // Get workspace to verify access
        if (!source.workspaceId) {
          const { TRPCError } = await import("@trpc/server");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Integration has no associated workspace",
          });
        }

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

        // Mark integration as inactive instead of deleting
        await db
          .update(connectedSources)
          .set({
            isActive: false,
            lastSyncedAt: new Date().toISOString(),
          })
          .where(eq(connectedSources.id, input.integrationId));

        return { success: true };
      }),
  },

  /**
   * Update workspace name
   * Used by workspace settings page to update the user-facing name
   */
  updateName: protectedProcedure
    .input(
      z.object({
        clerkOrgSlug: z.string(),
        workspaceName: z.string(), // Current workspace name
        newWorkspaceName: z
          .string()
          .min(WORKSPACE_NAME.MIN_LENGTH, NAMING_ERRORS.WORKSPACE_MIN_LENGTH)
          .max(WORKSPACE_NAME.MAX_LENGTH, NAMING_ERRORS.WORKSPACE_MAX_LENGTH)
          .regex(WORKSPACE_NAME.PATTERN, NAMING_ERRORS.WORKSPACE_PATTERN),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Resolve workspace from current name (user-facing)
      const { resolveWorkspaceByName } = await import("../trpc");
      const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
        clerkOrgSlug: input.clerkOrgSlug,
        workspaceName: input.workspaceName,
        userId: ctx.auth.userId,
      });

      const { TRPCError } = await import("@trpc/server");

      // Check if new name already exists in this organization
      const existingWorkspace = await db.query.workspaces.findFirst({
        where: and(
          eq(workspaces.clerkOrgId, clerkOrgId),
          eq(workspaces.name, input.newWorkspaceName),
        ),
      });

      if (existingWorkspace && existingWorkspace.id !== workspaceId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A workspace with the name "${input.newWorkspaceName}" already exists in this organization`,
        });
      }

      // Update workspace name
      await db
        .update(workspaces)
        .set({
          name: input.newWorkspaceName,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(workspaces.id, workspaceId));

      return {
        success: true,
        newWorkspaceName: input.newWorkspaceName,
      };
    }),
} satisfies TRPCRouterRecord;
