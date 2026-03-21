import { db } from "@db/app/client";
import { workspaceWorkflowRuns } from "@db/app/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { orgScopedProcedure, resolveWorkspaceByName } from "../../trpc";

/**
 * Jobs router - procedures for querying and managing workflow jobs
 */
export const jobsRouter = {
  /**
   * List jobs with filters and pagination
   * Returns jobs for a specific workspace with optional filters
   */
  list: orgScopedProcedure
    .input(
      z.object({
        clerkOrgSlug: z.string(),
        workspaceName: z.string(), // User-facing workspace name from URL
        status: z
          .enum(["queued", "running", "completed", "failed", "cancelled"])
          .optional(),
        repositoryId: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(), // createdAt timestamp for cursor pagination
      })
    )
    .query(async ({ ctx, input }) => {
      // Resolve workspace from user-facing name
      const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
        clerkOrgSlug: input.clerkOrgSlug,
        workspaceName: input.workspaceName,
        userId: ctx.auth.userId,
      });

      const { status, repositoryId, limit, cursor } = input;

      // Build where conditions
      const conditions = [
        eq(workspaceWorkflowRuns.workspaceId, workspaceId),
        eq(workspaceWorkflowRuns.clerkOrgId, clerkOrgId),
      ];

      if (status) {
        conditions.push(eq(workspaceWorkflowRuns.status, status));
      }

      if (repositoryId) {
        conditions.push(eq(workspaceWorkflowRuns.repositoryId, repositoryId));
      }

      // Add cursor condition if provided
      if (cursor) {
        conditions.push(sql`${workspaceWorkflowRuns.createdAt} < ${cursor}`);
      }

      // Query jobs with limit + 1 to determine if there are more
      // Note: storeSlug removed - each workspace has exactly one store (1:1 relationship)
      const jobsList = await db
        .select()
        .from(workspaceWorkflowRuns)
        .where(and(...conditions))
        .orderBy(desc(workspaceWorkflowRuns.createdAt))
        .limit(limit + 1);

      // Determine if there are more results
      const hasMore = jobsList.length > limit;
      const items = hasMore ? jobsList.slice(0, limit) : jobsList;

      // Get next cursor (createdAt of last item)
      const nextCursor = hasMore ? items.at(-1)?.createdAt : null;

      return {
        items,
        nextCursor,
        hasMore,
      };
    }),

  /**
   * Restart a job
   * Triggers a new sync workflow based on the original job's parameters
   */
  restart: orgScopedProcedure
    .input(
      z.object({
        jobId: z.string(),
        clerkOrgSlug: z.string(),
        workspaceName: z.string(), // User-facing workspace name from URL
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Resolve workspace from user-facing name
      const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
        clerkOrgSlug: input.clerkOrgSlug,
        workspaceName: input.workspaceName,
        userId: ctx.auth.userId,
      });

      // Parse jobId to number (BIGINT internal ID)
      const jobIdNum = Number.parseInt(input.jobId, 10);
      if (Number.isNaN(jobIdNum)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid job ID format",
        });
      }

      // Verify job exists and belongs to user's workspace
      const job = await db.query.workspaceWorkflowRuns.findFirst({
        where: and(
          eq(workspaceWorkflowRuns.id, jobIdNum),
          eq(workspaceWorkflowRuns.workspaceId, workspaceId),
          eq(workspaceWorkflowRuns.clerkOrgId, clerkOrgId)
        ),
      });

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job not found",
        });
      }

      // Only allow restarting jobs that are completed, failed, or cancelled
      if (job.status === "queued" || job.status === "running") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot restart job with status: ${job.status}. Wait for it to complete first.`,
        });
      }

      // Route based on job function ID
      switch (job.inngestFunctionId) {
        case "source-connected":
        case "source-sync":
        case "apps-console/github-sync":
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Sync jobs are no longer supported and cannot be restarted.",
          });

        default:
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot restart job of type: ${job.inngestFunctionId}. This job type may no longer be supported.`,
          });
      }
    }),
} satisfies TRPCRouterRecord;
