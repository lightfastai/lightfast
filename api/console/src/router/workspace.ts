import type { TRPCRouterRecord } from "@trpc/server";
import { db } from "@db/console/client";
import {
  workspaces,
  connectedSources,
  stores,
  docsDocuments,
  jobs,
} from "@db/console/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { z } from "zod";
import { getOrCreateDefaultWorkspace, getWorkspaceKey } from "@db/console/utils";

import { publicProcedure, protectedProcedure } from "../trpc";

/**
 * Workspace router - internal procedures for API routes
 * PUBLIC procedures for webhook/API route usage
 */
export const workspaceRouter = {
  /**
   * List workspaces for a Clerk organization
   * Used by the org/workspace switcher to show available workspaces
   */
  listByClerkOrgId: protectedProcedure
    .input(
      z.object({
        clerkOrgId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const orgWorkspaces = await db.query.workspaces.findMany({
        where: eq(workspaces.clerkOrgId, input.clerkOrgId),
      });

      return orgWorkspaces.map((workspace) => ({
        id: workspace.id,
        slug: workspace.slug,
        isDefault: workspace.isDefault,
        createdAt: workspace.createdAt,
      }));
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
   * Get workspace statistics for dashboard
   * Returns overview metrics: sources, stores, documents, jobs
   */
  statistics: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        clerkOrgId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, clerkOrgId } = input;

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
} satisfies TRPCRouterRecord;
