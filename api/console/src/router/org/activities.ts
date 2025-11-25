import type { TRPCRouterRecord } from "@trpc/server";
import { db } from "@db/console/client";
import { workspaceUserActivities } from "@db/console/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, resolveWorkspaceByName } from "../../trpc";

/**
 * Activities Router
 *
 * Manages workspace user activity tracking and retrieval.
 * Provides timeline queries with filtering and pagination.
 */
export const activitiesRouter = {
  /**
   * Get recent activities for workspace timeline
   * Returns paginated activities with filtering options
   */
  list: protectedProcedure
    .input(
      z.object({
        clerkOrgSlug: z.string(),
        workspaceName: z.string(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        category: z
          .enum([
            "auth",
            "workspace",
            "integration",
            "store",
            "job",
            "search",
            "document",
            "permission",
            "api_key",
            "settings",
          ])
          .optional(),
        actorUserId: z.string().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
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
      const whereConditions = [eq(workspaceUserActivities.workspaceId, workspaceId)];

      if (input.category) {
        whereConditions.push(eq(workspaceUserActivities.category, input.category));
      }

      if (input.actorUserId) {
        whereConditions.push(eq(workspaceUserActivities.actorUserId, input.actorUserId));
      }

      if (input.startDate) {
        whereConditions.push(gte(workspaceUserActivities.timestamp, input.startDate));
      }

      if (input.endDate) {
        whereConditions.push(lte(workspaceUserActivities.timestamp, input.endDate));
      }

      // Fetch activities with pagination
      const activities = await db
        .select({
          id: workspaceUserActivities.id,
          actorType: workspaceUserActivities.actorType,
          actorUserId: workspaceUserActivities.actorUserId,
          actorEmail: workspaceUserActivities.actorEmail,
          category: workspaceUserActivities.category,
          action: workspaceUserActivities.action,
          entityType: workspaceUserActivities.entityType,
          entityId: workspaceUserActivities.entityId,
          entityName: workspaceUserActivities.entityName,
          metadata: workspaceUserActivities.metadata,
          timestamp: workspaceUserActivities.timestamp,
          createdAt: workspaceUserActivities.createdAt,
        })
        .from(workspaceUserActivities)
        .where(and(...whereConditions))
        .orderBy(desc(workspaceUserActivities.timestamp))
        .limit(input.limit)
        .offset(input.offset);

      return {
        activities,
        hasMore: activities.length === input.limit,
      };
    }),

  /**
   * Get activity statistics for the workspace
   * Returns counts by category for the last 24 hours
   */
  stats: protectedProcedure
    .input(
      z.object({
        clerkOrgSlug: z.string(),
        workspaceName: z.string(),
        timeRange: z.enum(["24h", "7d", "30d"]).default("24h"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Resolve workspace from name
      const { workspaceId } = await resolveWorkspaceByName({
        clerkOrgSlug: input.clerkOrgSlug,
        workspaceName: input.workspaceName,
        userId: ctx.auth.userId,
      });

      // Calculate time range
      const rangeHours = {
        "24h": 24,
        "7d": 168,
        "30d": 720,
      }[input.timeRange];

      const startTime = new Date(Date.now() - rangeHours * 60 * 60 * 1000).toISOString();

      // Fetch all activities in time range
      const activities = await db
        .select({
          category: workspaceUserActivities.category,
          actorType: workspaceUserActivities.actorType,
        })
        .from(workspaceUserActivities)
        .where(
          and(
            eq(workspaceUserActivities.workspaceId, workspaceId),
            gte(workspaceUserActivities.timestamp, startTime)
          )
        );

      // Count by category
      const byCategory = activities.reduce(
        (acc, activity) => {
          const category = activity.category || "other";
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Count by actor type
      const byActorType = activities.reduce(
        (acc, activity) => {
          const actorType = activity.actorType || "unknown";
          acc[actorType] = (acc[actorType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        total: activities.length,
        byCategory,
        byActorType,
        timeRange: input.timeRange,
      };
    }),
} satisfies TRPCRouterRecord;
