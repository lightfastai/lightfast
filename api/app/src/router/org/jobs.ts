import { db } from "@db/app/client";
import { orgWorkflowRuns } from "@db/app/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { orgScopedProcedure } from "../../trpc";

/**
 * Jobs router - procedures for querying and managing workflow jobs
 */
export const jobsRouter = {
  /**
   * List jobs with filters and pagination
   * Returns jobs for the current org with optional filters
   */
  list: orgScopedProcedure
    .input(
      z.object({
        status: z
          .enum(["queued", "running", "completed", "failed", "cancelled"])
          .optional(),
        repositoryId: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(), // createdAt timestamp for cursor pagination
      })
    )
    .query(async ({ ctx, input }) => {
      const clerkOrgId = ctx.auth.orgId;
      const { status, repositoryId, limit, cursor } = input;

      // Build where conditions
      const conditions = [eq(orgWorkflowRuns.clerkOrgId, clerkOrgId)];

      if (status) {
        conditions.push(eq(orgWorkflowRuns.status, status));
      }

      if (repositoryId) {
        conditions.push(eq(orgWorkflowRuns.repositoryId, repositoryId));
      }

      if (cursor) {
        conditions.push(sql`${orgWorkflowRuns.createdAt} < ${cursor}`);
      }

      // Query jobs with limit + 1 to determine if there are more
      const jobsList = await db
        .select()
        .from(orgWorkflowRuns)
        .where(and(...conditions))
        .orderBy(desc(orgWorkflowRuns.createdAt))
        .limit(limit + 1);

      const hasMore = jobsList.length > limit;
      const items = hasMore ? jobsList.slice(0, limit) : jobsList;
      const nextCursor = hasMore ? items.at(-1)?.createdAt : null;

      return { items, nextCursor, hasMore };
    }),
} satisfies TRPCRouterRecord;
