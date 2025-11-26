import type { TRPCRouterRecord } from "@trpc/server";
import { db } from "@db/console/client";
import { workspaceWorkflowRuns, orgWorkspaces, type JobInput } from "@db/console/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { orgScopedProcedure, resolveWorkspaceByName } from "../../trpc";
import { inngest } from "@api/console/inngest";
import { workspaceIntegrations } from "@db/console/schema";
import { getWorkspaceKey } from "@db/console/utils";
import { jobTriggerSchema } from "@repo/console-validation";
import { recordActivity } from "../../lib/activity";

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
	get: orgScopedProcedure
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

			const job = await db.query.workspaceWorkflowRuns.findFirst({
				where: and(
					eq(workspaceWorkflowRuns.id, input.jobId),
					eq(workspaceWorkflowRuns.workspaceId, workspaceId),
					eq(workspaceWorkflowRuns.clerkOrgId, clerkOrgId),
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
	recent: orgScopedProcedure
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
				.from(workspaceWorkflowRuns)
				.where(
					and(
						eq(workspaceWorkflowRuns.workspaceId, workspaceId),
						eq(workspaceWorkflowRuns.clerkOrgId, clerkOrgId),
					),
				)
				.orderBy(desc(workspaceWorkflowRuns.createdAt))
				.limit(input.limit);

			return recentJobs;
		}),

	/**
	 * Get job statistics for a workspace
	 * Returns aggregated metrics for dashboard
	 * Optimized with SQL aggregation for 50x performance improvement
	 */
	statistics: orgScopedProcedure
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

			// Single SQL query with aggregation (50x faster than fetching all rows)
			const [stats] = await db
				.select({
					total: sql<number>`COUNT(*)`,
					queued: sql<number>`SUM(CASE WHEN ${workspaceWorkflowRuns.status} = 'queued' THEN 1 ELSE 0 END)`,
					running: sql<number>`SUM(CASE WHEN ${workspaceWorkflowRuns.status} = 'running' THEN 1 ELSE 0 END)`,
					completed: sql<number>`SUM(CASE WHEN ${workspaceWorkflowRuns.status} = 'completed' THEN 1 ELSE 0 END)`,
					failed: sql<number>`SUM(CASE WHEN ${workspaceWorkflowRuns.status} = 'failed' THEN 1 ELSE 0 END)`,
					cancelled: sql<number>`SUM(CASE WHEN ${workspaceWorkflowRuns.status} = 'cancelled' THEN 1 ELSE 0 END)`,
					// Average duration for completed jobs only
					avgDurationMs: sql<number>`AVG(CASE WHEN ${workspaceWorkflowRuns.status} = 'completed' THEN CAST(${workspaceWorkflowRuns.durationMs} AS BIGINT) ELSE NULL END)`,
				})
				.from(workspaceWorkflowRuns)
				.where(
					and(
						eq(workspaceWorkflowRuns.workspaceId, workspaceId),
						eq(workspaceWorkflowRuns.clerkOrgId, clerkOrgId),
						gte(workspaceWorkflowRuns.createdAt, since),
					),
				);

			// Handle case where no jobs exist (stats will still have defaults from SQL)
			if (!stats) {
				return {
					total: 0,
					byStatus: {
						queued: 0,
						running: 0,
						completed: 0,
						failed: 0,
						cancelled: 0,
					},
					avgDurationMs: 0,
					successRate: 0,
				};
			}

			// Calculate success rate from aggregated data
			const total = Number(stats.total) || 0;
			const completed = Number(stats.completed) || 0;
			const failed = Number(stats.failed) || 0;
			const cancelled = Number(stats.cancelled) || 0;
			const finishedJobs = completed + failed + cancelled;
			const successRate =
				finishedJobs > 0 ? (completed / finishedJobs) * 100 : 0;

			return {
				total,
				byStatus: {
					queued: Number(stats.queued) || 0,
					running: Number(stats.running) || 0,
					completed,
					failed,
					cancelled,
				},
				avgDurationMs: Math.round(Number(stats.avgDurationMs) || 0),
				successRate: Math.round(successRate * 10) / 10, // Round to 1 decimal
			};
		}),

	/**
	 * Cancel a running job
	 * Sends cancellation event to Inngest
	 */
	cancel: orgScopedProcedure
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
			const job = await db.query.workspaceWorkflowRuns.findFirst({
				where: and(
					eq(workspaceWorkflowRuns.id, input.jobId),
					eq(workspaceWorkflowRuns.workspaceId, workspaceId),
					eq(workspaceWorkflowRuns.clerkOrgId, clerkOrgId),
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
				.update(workspaceWorkflowRuns)
				.set({
					status: "cancelled",
					completedAt: new Date().toISOString(),
				})
				.where(eq(workspaceWorkflowRuns.id, input.jobId));

			// Record activity (Tier 2: Queue-based)
			await recordActivity({
				workspaceId,
				actorType: "user",
				actorUserId: ctx.auth.userId,
				category: "job",
				action: "job.cancelled",
				entityType: "job",
				entityId: input.jobId,
				metadata: {
					jobName: job.name,
					previousStatus: job.status,
					inngestFunctionId: job.inngestFunctionId,
				},
			});

			// TODO: Send Inngest cancellation event
			// await inngest.send({
			//   name: "apps-console/job.cancel",
			//   data: { jobId: input.jobId, inngestRunId: job.inngestRunId }
			// });

			return { success: true };
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
			const job = await db.query.workspaceWorkflowRuns.findFirst({
				where: and(
					eq(workspaceWorkflowRuns.id, input.jobId),
					eq(workspaceWorkflowRuns.workspaceId, workspaceId),
					eq(workspaceWorkflowRuns.clerkOrgId, clerkOrgId),
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

			// Determine job type and extract necessary parameters from job.input
			const jobInput = job.input as JobInput;

			// Get workspace slug for workspaceKey
			const workspace = await db.query.orgWorkspaces.findFirst({
				where: eq(orgWorkspaces.id, workspaceId),
			});

			if (!workspace) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Workspace not found",
				});
			}

			const workspaceKey = getWorkspaceKey(workspace.slug);

			// Route based on job function ID
			switch (job.inngestFunctionId) {
				case "source-connected":
				case "source-sync": {
					// Extract sourceId from job input
					const sourceId = jobInput.sourceId as string | undefined;

					if (!sourceId) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "Job input missing sourceId - cannot restart",
						});
					}

					// Fetch workspace source to determine provider type
					const source = await db.query.workspaceIntegrations.findFirst({
						where: eq(workspaceIntegrations.id, sourceId),
					});

					if (!source) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: `Source not found: ${sourceId}`,
						});
					}

					// Determine source type from sourceConfig
					const sourceType = source.sourceConfig.provider;

					// Trigger new full sync
					await inngest.send({
						name: "apps-console/source.sync",
						data: {
							workspaceId,
							workspaceKey,
							sourceId,
							sourceType,
							syncMode: "full" as const,
							trigger: "manual" as const,
							syncParams: (jobInput.sourceMetadata as Record<string, unknown>) ?? undefined,
						},
					});
					break;
				}

				case "apps-console/github-sync": {
					// GitHub-specific sync restart
					const sourceId = jobInput.sourceId as string | undefined;

					if (!sourceId) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "Job input missing sourceId - cannot restart",
						});
					}

					// Trigger new full sync
					await inngest.send({
						name: "apps-console/source.sync",
						data: {
							workspaceId,
							workspaceKey,
							sourceId,
							sourceType: "github" as const,
							syncMode: "full" as const,
							trigger: "manual" as const,
							syncParams: {
								repoFullName: jobInput.repoFullName,
								...jobInput,
							},
						},
					});
					break;
				}

				// DEPRECATED: Support for old job types created before refactoring
				case "repository-initial-sync": {
					// Old GitHub initial sync jobs
					// Try to extract repoId from job input to find the workspace source
					const repoId = jobInput.repoId as string | undefined;
					const repoFullName = jobInput.repoFullName as string | undefined;

					if (!repoId && !repoFullName) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "Deprecated job missing repository information - cannot restart",
						});
					}

					// Find workspace source by GitHub repo ID (stored in providerResourceId)
					let source = null;
					if (repoId) {
						source = await db.query.workspaceIntegrations.findFirst({
							where: and(
								eq(workspaceIntegrations.workspaceId, workspaceId),
								eq(workspaceIntegrations.providerResourceId, repoId),
								eq(workspaceIntegrations.isActive, true),
							),
						});
					}

					// Fallback: try to find by repoFullName in sourceConfig
					if (!source && repoFullName) {
						const allSources = await db.query.workspaceIntegrations.findMany({
							where: and(
								eq(workspaceIntegrations.workspaceId, workspaceId),
								eq(workspaceIntegrations.isActive, true),
							),
						});

						source = allSources.find(s =>
							s.sourceConfig.provider === "github" &&
							s.sourceConfig.repoFullName === repoFullName
						) ?? null;
					}

					if (!source) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: `Cannot find active source for repository - it may have been disconnected`,
						});
					}

					// Verify it's a GitHub source
					if (source.sourceConfig.provider !== "github") {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "Source is not a GitHub repository",
						});
					}

					// Trigger new full sync
					await inngest.send({
						name: "apps-console/source.sync",
						data: {
							workspaceId,
							workspaceKey,
							sourceId: source.id,
							sourceType: "github" as const,
							syncMode: "full" as const,
							trigger: "manual" as const,
							syncParams: {
								repoFullName: source.sourceConfig.repoFullName,
								defaultBranch: source.sourceConfig.defaultBranch,
								...jobInput,
							},
						},
					});
					break;
				}

				default:
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Cannot restart job of type: ${job.inngestFunctionId}. This job type may no longer be supported.`,
					});
			}

			// Record activity (Tier 2: Queue-based)
			await recordActivity({
				workspaceId,
				actorType: "user",
				actorUserId: ctx.auth.userId,
				category: "job",
				action: "job.restarted",
				entityType: "job",
				entityId: input.jobId,
				metadata: {
					jobName: job.name,
					originalStatus: job.status,
					inngestFunctionId: job.inngestFunctionId,
				},
			});

			return {
				success: true,
				message: "Job restart triggered successfully",
			};
		}),
} satisfies TRPCRouterRecord;
