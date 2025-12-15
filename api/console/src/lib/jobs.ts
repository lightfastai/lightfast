/**
 * Job tracking utilities for Inngest workflow executions
 *
 * Provides functions to create, update, and complete job records
 * with integrated metrics tracking for performance monitoring.
 */

import { db } from "@db/console/client";
import { workspaceWorkflowRuns, workspaceOperationsMetrics } from "@db/console/schema";
import type { WorkspaceWorkflowRun, WorkflowInput, WorkflowOutput, InsertWorkspaceWorkflowRun } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import type {
	JobTrigger,
	OperationMetricType,
	OperationMetricUnit,
	JobDurationTags,
	DocumentsIndexedTags,
	ErrorTags,
} from "@repo/console-validation";
import { workflowInputSchema, workflowOutputSchema } from "@repo/console-validation";

/**
 * Create a new job record at workflow start
 *
 * Idempotent - checks for existing job with same inngestRunId
 * to handle retries gracefully.
 *
 * @param params Job creation parameters
 * @returns Created job internal BIGINT ID
 */
export async function createJob(params: {
	clerkOrgId: string;
	workspaceId: string;
	repositoryId?: string | null;
	inngestRunId: string;
	inngestFunctionId: string;
	name: string;
	trigger: JobTrigger;
	triggeredBy?: string | null;
	input?: WorkflowInput;
}): Promise<number> {
	try {
		// Validate input
		if (params.input) {
			const validated = workflowInputSchema.safeParse(params.input);
			if (!validated.success) {
				log.error("Invalid workflow input", {
					error: validated.error.format(),
					input: params.input,
				});
				throw new Error(`Invalid workflow input: ${validated.error.message}`);
			}
		}

		// Check for existing job with same inngestRunId (idempotency)
		const existing = await db.query.workspaceWorkflowRuns.findFirst({
			where: eq(workspaceWorkflowRuns.inngestRunId, params.inngestRunId),
		});

		if (existing) {
			log.info("Job already exists, returning existing ID", {
				jobId: existing.id,
				inngestRunId: params.inngestRunId,
			});
			return existing.id;
		}

		// Create new job record
		const [job] = await db
			.insert(workspaceWorkflowRuns)
			.values({
				clerkOrgId: params.clerkOrgId,
				workspaceId: params.workspaceId,
				repositoryId: params.repositoryId ?? null,
				inngestRunId: params.inngestRunId,
				inngestFunctionId: params.inngestFunctionId,
				name: params.name,
				status: "queued",
				trigger: params.trigger,
				triggeredBy: params.triggeredBy ?? null,
				input: params.input ?? null,
			})
			.returning();

		if (!job) {
			throw new Error("Failed to create job record");
		}

		log.info("Created job record", {
			jobId: job.id,
			inngestRunId: params.inngestRunId,
			name: params.name,
		});

		return job.id;
	} catch (error) {
		log.error("Failed to create job record", {
			error,
			inngestRunId: params.inngestRunId,
			name: params.name,
		});
		throw error;
	}
}

/**
 * Update job status during execution
 *
 * @param jobId Job ID (BIGINT internal ID)
 * @param status New status
 */
export async function updateJobStatus(
	jobId: number,
	status: "running" | "queued" | "completed" | "failed" | "cancelled",
): Promise<void> {
	try {
		const updates: Partial<InsertWorkspaceWorkflowRun> = {
			status,
		};

		// Set startedAt when transitioning to running
		if (status === "running") {
			updates.startedAt = new Date().toISOString();
		}

		await db.update(workspaceWorkflowRuns).set(updates).where(eq(workspaceWorkflowRuns.id, jobId));

		log.info("Updated job status", { jobId, status });
	} catch (error) {
		log.error("Failed to update job status", { error, jobId, status });
		throw error;
	}
}

/**
 * Complete job with final output or error
 *
 * Calculates duration and updates all completion fields.
 * Uses discriminated union to ensure output is required for completed/failed jobs.
 *
 * @param params Completion parameters (discriminated by status)
 */
export async function completeJob(
	params:
		| {
				jobId: number;
				status: "completed" | "failed";
				output: WorkflowOutput;
		  }
		| {
				jobId: number;
				status: "cancelled";
				errorMessage?: string;
		  },
): Promise<void> {
	try {
		const jobIdNum = params.jobId;

		// Validate output for completed/failed jobs
		if (params.status === "completed" || params.status === "failed") {
			const validated = workflowOutputSchema.safeParse(params.output);
			if (!validated.success) {
				log.error("Invalid workflow output", {
					error: validated.error.format(),
					output: params.output,
				});
				throw new Error(`Invalid workflow output: ${validated.error.message}`);
			}
		}

		// Fetch job to calculate duration
		const job = await db.query.workspaceWorkflowRuns.findFirst({
			where: eq(workspaceWorkflowRuns.id, jobIdNum),
		});

		if (!job) {
			throw new Error(`Job not found: ${params.jobId}`);
		}

		const now = new Date();
		const completedAt = now.toISOString();

		// Calculate duration if job was started
		let durationMs: string | null = null;
		if (job.startedAt) {
			const startTime = new Date(job.startedAt).getTime();
			const endTime = now.getTime();
			durationMs = String(endTime - startTime);
		}

		// Update job record
		await db
			.update(workspaceWorkflowRuns)
			.set({
				status: params.status,
				output: params.status === "cancelled" ? null : params.output,
				errorMessage: params.status === "cancelled" ? params.errorMessage ?? null : null,
				completedAt,
				durationMs,
			})
			.where(eq(workspaceWorkflowRuns.id, jobIdNum));

		log.info("Completed job", {
			jobId: params.jobId,
			status: params.status,
			durationMs,
		});

		// Record job duration metric if completed successfully
		if (params.status === "completed" && durationMs) {
			await recordJobMetric({
				clerkOrgId: job.clerkOrgId,
				workspaceId: job.workspaceId,
				repositoryId: job.repositoryId ?? undefined,
				type: "job_duration",
				value: Number.parseInt(durationMs, 10),
				unit: "ms",
				tags: {
					jobType: job.inngestFunctionId,
					trigger: job.trigger,
				},
			});
		}

		// Record error metric if failed
		if (params.status === "failed") {
			await recordJobMetric({
				clerkOrgId: job.clerkOrgId,
				workspaceId: job.workspaceId,
				repositoryId: job.repositoryId ?? undefined,
				type: "errors",
				value: 1,
				unit: "count",
				tags: {
					jobType: job.inngestFunctionId,
					errorType: "job_failure",
				},
			});
		}
	} catch (error) {
		log.error("Failed to complete job", {
			error,
			jobId: params.jobId,
			status: params.status,
		});
		throw error;
	}
}

/**
 * Record a job performance metric
 *
 * Uses discriminated union for type-safe metric recording.
 * Each metric type has specific required/optional tags.
 *
 * @param params Metric parameters (discriminated by type)
 */
export async function recordJobMetric(
	params: (
		| {
				type: "job_duration";
				value: number;
				unit: "ms";
				tags: JobDurationTags;
		  }
		| {
				type: "documents_indexed";
				value: number;
				unit: "count";
				tags: DocumentsIndexedTags;
		  }
		| {
				type: "errors";
				value: 1;
				unit: "count";
				tags: ErrorTags;
		  }
	) & {
		clerkOrgId: string;
		workspaceId: string;
		repositoryId?: string;
	},
): Promise<void> {
	try {
		await db.insert(workspaceOperationsMetrics).values({
			clerkOrgId: params.clerkOrgId,
			workspaceId: params.workspaceId,
			repositoryId: params.repositoryId ?? null,
			type: params.type,
			value: params.value,
			unit: params.unit ?? undefined,
			tags: params.tags ?? null,
		});

		log.debug("Recorded job metric", {
			type: params.type,
			value: params.value,
			tags: params.tags,
		});
	} catch (error) {
		// Non-fatal - log error but don't throw
		log.error("Failed to record job metric", {
			error,
			type: params.type,
			value: params.value,
		});
	}
}

/**
 * Get job by ID
 *
 * @param jobId Job ID (string representation of BIGINT)
 * @returns Job or null if not found
 */
export async function getJob(jobId: string): Promise<WorkspaceWorkflowRun | null> {
	try {
		// Parse jobId to number (BIGINT internal ID)
		const jobIdNum = parseInt(jobId, 10);
		if (isNaN(jobIdNum)) {
			log.error("Invalid job ID format", { jobId });
			return null;
		}

		const job = await db.query.workspaceWorkflowRuns.findFirst({
			where: eq(workspaceWorkflowRuns.id, jobIdNum),
		});

		return job ?? null;
	} catch (error) {
		log.error("Failed to get job", { error, jobId });
		return null;
	}
}

/**
 * Get job by Inngest run ID
 *
 * @param inngestRunId Inngest run ID
 * @returns Job or null if not found
 */
export async function getJobByInngestRunId(
	inngestRunId: string,
): Promise<WorkspaceWorkflowRun | null> {
	try {
		const job = await db.query.workspaceWorkflowRuns.findFirst({
			where: eq(workspaceWorkflowRuns.inngestRunId, inngestRunId),
		});

		return job ?? null;
	} catch (error) {
		log.error("Failed to get job by Inngest run ID", {
			error,
			inngestRunId,
		});
		return null;
	}
}
