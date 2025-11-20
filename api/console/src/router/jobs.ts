import type { TRPCRouterRecord } from "@trpc/server";
import { db } from "@db/console/client";
import { jobs } from "@db/console/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { protectedProcedure, resolveWorkspaceByName } from "../trpc";

/**
 * Jobs router - procedures for querying and managing workflow jobs
 */
export const jobsRouter = {
	/**
	 * List jobs with filters and pagination
	 * Returns jobs for a specific workspace with optional filters
	 */
	list: protectedProcedure
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
			}),
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
				eq(jobs.workspaceId, workspaceId),
				eq(jobs.clerkOrgId, clerkOrgId),
			];

			if (status) {
				conditions.push(eq(jobs.status, status));
			}

			if (repositoryId) {
				conditions.push(eq(jobs.repositoryId, repositoryId));
			}

			// Add cursor condition if provided
			if (cursor) {
				conditions.push(sql`${jobs.createdAt} < ${cursor}`);
			}

			// Query jobs with limit + 1 to determine if there are more
			const jobsList = await db
				.select()
				.from(jobs)
				.where(and(...conditions))
				.orderBy(desc(jobs.createdAt))
				.limit(limit + 1);

			// Determine if there are more results
			const hasMore = jobsList.length > limit;
			const items = hasMore ? jobsList.slice(0, limit) : jobsList;

			// Get next cursor (createdAt of last item)
			const nextCursor = hasMore ? items[items.length - 1]?.createdAt : null;

			return {
				items,
				nextCursor,
				hasMore,
			};
		}),

	/**
	 * Get single job by ID
	 * Returns full job details including input/output
	 */
	get: protectedProcedure
		.input(
			z.object({
				jobId: z.string(),
				clerkOrgSlug: z.string(),
				workspaceName: z.string(), // User-facing workspace name from URL
			}),
		)
		.query(async ({ ctx, input }) => {
			// Resolve workspace from user-facing name
			const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
				clerkOrgSlug: input.clerkOrgSlug,
				workspaceName: input.workspaceName,
				userId: ctx.auth.userId,
			});

			const job = await db.query.jobs.findFirst({
				where: and(
					eq(jobs.id, input.jobId),
					eq(jobs.workspaceId, workspaceId),
					eq(jobs.clerkOrgId, clerkOrgId),
				),
			});

			if (!job) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Job not found",
				});
			}

			return job;
		}),

	/**
	 * Get recent jobs for dashboard
	 * Returns last N jobs (default 10) for quick overview
	 */
	recent: protectedProcedure
		.input(
			z.object({
				clerkOrgSlug: z.string(),
				workspaceName: z.string(), // User-facing workspace name from URL
				limit: z.number().min(1).max(50).default(10),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Resolve workspace from user-facing name
			const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
				clerkOrgSlug: input.clerkOrgSlug,
				workspaceName: input.workspaceName,
				userId: ctx.auth.userId,
			});

			const recentJobs = await db
				.select()
				.from(jobs)
				.where(
					and(
						eq(jobs.workspaceId, workspaceId),
						eq(jobs.clerkOrgId, clerkOrgId),
					),
				)
				.orderBy(desc(jobs.createdAt))
				.limit(input.limit);

			return recentJobs;
		}),

	/**
	 * Get job statistics for a workspace
	 * Returns aggregated metrics for dashboard
	 */
	statistics: protectedProcedure
		.input(
			z.object({
				clerkOrgSlug: z.string(),
				workspaceName: z.string(), // User-facing workspace name from URL
				hours: z.number().default(24), // Time window for stats
			}),
		)
		.query(async ({ ctx, input }) => {
			// Resolve workspace from user-facing name
			const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
				clerkOrgSlug: input.clerkOrgSlug,
				workspaceName: input.workspaceName,
				userId: ctx.auth.userId,
			});

			const { hours } = input;

			// Calculate timestamp for time window
			const since = new Date(Date.now() - hours * 60 * 60 * 1000)
				.toISOString()
				.slice(0, 19)
				.replace("T", " ");

			// Get jobs within time window
			const recentJobs = await db.query.jobs.findMany({
				where: and(
					eq(jobs.workspaceId, workspaceId),
					eq(jobs.clerkOrgId, clerkOrgId),
					sql`${jobs.createdAt} >= ${since}`,
				),
			});

			// Calculate statistics
			const total = recentJobs.length;
			const queued = recentJobs.filter((j) => j.status === "queued").length;
			const running = recentJobs.filter((j) => j.status === "running").length;
			const completed = recentJobs.filter(
				(j) => j.status === "completed",
			).length;
			const failed = recentJobs.filter((j) => j.status === "failed").length;
			const cancelled = recentJobs.filter(
				(j) => j.status === "cancelled",
			).length;

			// Calculate average duration for completed jobs
			const completedJobs = recentJobs.filter((j) => j.status === "completed");
			const avgDurationMs =
				completedJobs.length > 0
					? completedJobs.reduce(
							(sum, j) => sum + (Number.parseInt(j.durationMs || "0", 10) || 0),
							0,
						) / completedJobs.length
					: 0;

			// Calculate success rate
			const finishedJobs = completed + failed + cancelled;
			const successRate =
				finishedJobs > 0 ? (completed / finishedJobs) * 100 : 0;

			return {
				total,
				byStatus: {
					queued,
					running,
					completed,
					failed,
					cancelled,
				},
				avgDurationMs: Math.round(avgDurationMs),
				successRate: Math.round(successRate * 10) / 10, // Round to 1 decimal
			};
		}),

	/**
	 * Cancel a running job
	 * Sends cancellation event to Inngest
	 */
	cancel: protectedProcedure
		.input(
			z.object({
				jobId: z.string(),
				clerkOrgSlug: z.string(),
				workspaceName: z.string(), // User-facing workspace name from URL
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Resolve workspace from user-facing name
			const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
				clerkOrgSlug: input.clerkOrgSlug,
				workspaceName: input.workspaceName,
				userId: ctx.auth.userId,
			});

			// Verify job exists and belongs to user's workspace
			const job = await db.query.jobs.findFirst({
				where: and(
					eq(jobs.id, input.jobId),
					eq(jobs.workspaceId, workspaceId),
					eq(jobs.clerkOrgId, clerkOrgId),
				),
			});

			if (!job) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Job not found",
				});
			}

			// Only allow cancelling jobs that are queued or running
			if (job.status !== "queued" && job.status !== "running") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Cannot cancel job with status: ${job.status}`,
				});
			}

			// Update job status to cancelled
			await db
				.update(jobs)
				.set({
					status: "cancelled",
					completedAt: new Date().toISOString(),
				})
				.where(eq(jobs.id, input.jobId));

			// TODO: Send Inngest cancellation event
			// await inngest.send({
			//   name: "apps-console/job.cancel",
			//   data: { jobId: input.jobId, inngestRunId: job.inngestRunId }
			// });

			return { success: true };
		}),
} satisfies TRPCRouterRecord;
