import type { TRPCRouterRecord } from "@trpc/server";
import { db } from "@db/console/client";
import { jobs } from "@db/console/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { protectedProcedure } from "../trpc";

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
				workspaceId: z.string(),
				clerkOrgId: z.string(),
				status: z
					.enum(["queued", "running", "completed", "failed", "cancelled"])
					.optional(),
				repositoryId: z.string().optional(),
				limit: z.number().min(1).max(100).default(20),
				cursor: z.string().optional(), // createdAt timestamp for cursor pagination
			}),
		)
		.query(async ({ input }) => {
			const { workspaceId, clerkOrgId, status, repositoryId, limit, cursor } =
				input;

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
				clerkOrgId: z.string(),
			}),
		)
		.query(async ({ input }) => {
			const job = await db.query.jobs.findFirst({
				where: and(
					eq(jobs.id, input.jobId),
					eq(jobs.clerkOrgId, input.clerkOrgId),
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
				workspaceId: z.string(),
				clerkOrgId: z.string(),
				limit: z.number().min(1).max(50).default(10),
			}),
		)
		.query(async ({ input }) => {
			const recentJobs = await db
				.select()
				.from(jobs)
				.where(
					and(
						eq(jobs.workspaceId, input.workspaceId),
						eq(jobs.clerkOrgId, input.clerkOrgId),
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
				workspaceId: z.string(),
				clerkOrgId: z.string(),
				hours: z.number().default(24), // Time window for stats
			}),
		)
		.query(async ({ input }) => {
			const { workspaceId, clerkOrgId, hours } = input;

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
				clerkOrgId: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			// Verify job exists and belongs to user's organization
			const job = await db.query.jobs.findFirst({
				where: and(
					eq(jobs.id, input.jobId),
					eq(jobs.clerkOrgId, input.clerkOrgId),
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
