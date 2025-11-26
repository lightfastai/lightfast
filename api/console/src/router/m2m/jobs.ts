import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { inngestM2MProcedure } from "../../trpc";
import {
	createJob,
	updateJobStatus,
	completeJob,
	recordJobMetric,
	getJob,
} from "../../lib/jobs";
import { jobTriggerSchema } from "@repo/console-validation";

/**
 * Jobs M2M Router
 *
 * Machine-to-machine procedures for job management.
 * Used exclusively by Inngest workflows.
 *
 * User-facing job operations are in org/jobs router.
 */
export const jobsM2MRouter = {
	/**
	 * Create job (Inngest workflows)
	 *
	 * Used by workflows to create job records at workflow start.
	 * Handles idempotency via inngestRunId.
	 */
	create: inngestM2MProcedure
		.input(
			z.object({
				clerkOrgId: z.string(),
				workspaceId: z.string(),
				repositoryId: z.string().nullable().optional(),
				inngestRunId: z.string(),
				inngestFunctionId: z.string(),
				name: z.string(),
				trigger: jobTriggerSchema,
				triggeredBy: z.string().nullable().optional(),
				input: z.record(z.unknown()).nullable().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const jobId = await createJob({
				...input,
				repositoryId: input.repositoryId ?? null,
				triggeredBy: input.triggeredBy ?? null,
				input: input.input ?? undefined,
			});
			return { jobId };
		}),

	/**
	 * Update job status (Inngest workflows)
	 *
	 * Used by workflows to update status during execution.
	 */
	updateStatus: inngestM2MProcedure
		.input(
			z.object({
				jobId: z.string(),
				status: z.enum(["running", "queued", "completed", "failed", "cancelled"]),
			}),
		)
		.mutation(async ({ input }) => {
			await updateJobStatus(input.jobId, input.status);
			return { success: true };
		}),

	/**
	 * Complete job (Inngest workflows)
	 *
	 * Used by workflows to mark job as completed/failed with output.
	 */
	complete: inngestM2MProcedure
		.input(
			z.object({
				jobId: z.string(),
				status: z.enum(["completed", "failed", "cancelled"]),
				output: z.record(z.unknown()).nullable().optional(),
				errorMessage: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			await completeJob({
				jobId: input.jobId,
				status: input.status,
				output: input.output ?? undefined,
				errorMessage: input.errorMessage ?? undefined,
			});
			return { success: true };
		}),

	/**
	 * Record metric (Inngest workflows)
	 *
	 * Used by workflows to record performance metrics.
	 * Uses discriminated union for type-safe metric recording.
	 */
	recordMetric: inngestM2MProcedure
		.input(
			z.discriminatedUnion("type", [
				// job_duration metric
				z.object({
					clerkOrgId: z.string(),
					workspaceId: z.string(),
					repositoryId: z.string().optional(),
					type: z.literal("job_duration"),
					value: z.number().int().positive(),
					unit: z.literal("ms"),
					tags: z.object({
						jobType: z.string(),
						trigger: jobTriggerSchema,
						syncMode: z.enum(["full", "incremental"]).optional(),
						sourceType: z.string().optional(),
					}),
				}),
				// documents_indexed metric
				z.object({
					clerkOrgId: z.string(),
					workspaceId: z.string(),
					repositoryId: z.string().optional(),
					type: z.literal("documents_indexed"),
					value: z.number().int().nonnegative(),
					unit: z.literal("count"),
					tags: z.object({
						jobType: z.string(),
						sourceType: z.string(),
						syncMode: z.enum(["full", "incremental"]).optional(),
						filesProcessed: z.number().int().optional(),
					}),
				}),
				// errors metric
				z.object({
					clerkOrgId: z.string(),
					workspaceId: z.string(),
					repositoryId: z.string().optional(),
					type: z.literal("errors"),
					value: z.literal(1),
					unit: z.literal("count"),
					tags: z.object({
						jobType: z.string(),
						errorType: z.string(),
						trigger: jobTriggerSchema.optional(),
						sourceType: z.string().optional(),
					}),
				}),
			]),
		)
		.mutation(async ({ input }) => {
			await recordJobMetric(input);
			return { success: true };
		}),

	/**
	 * Get job by ID (Inngest workflows)
	 *
	 * Used by workflows to fetch job details.
	 */
	get: inngestM2MProcedure
		.input(z.object({ jobId: z.string() }))
		.query(async ({ input }) => {
			const job = await getJob(input.jobId);
			return job;
		}),
} satisfies TRPCRouterRecord;
