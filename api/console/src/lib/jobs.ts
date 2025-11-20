/**
 * Job tracking utilities for Inngest workflow executions
 *
 * Provides functions to create, update, and complete job records
 * with integrated metrics tracking for performance monitoring.
 */

import { db } from "@db/console/client";
import { jobs, metrics } from "@db/console/schema";
import type { Job, JobInput, JobOutput, InsertJob } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { log } from "@vendor/observability/log";

/**
 * Create a new job record at workflow start
 *
 * Idempotent - checks for existing job with same inngestRunId
 * to handle retries gracefully.
 *
 * @param params Job creation parameters
 * @returns Created job ID
 */
export async function createJob(params: {
	clerkOrgId: string;
	workspaceId: string;
	repositoryId?: string | null;
	inngestRunId: string;
	inngestFunctionId: string;
	name: string;
	trigger: "manual" | "scheduled" | "webhook" | "automatic";
	triggeredBy?: string | null;
	input?: JobInput;
}): Promise<string> {
	try {
		// Check for existing job with same inngestRunId (idempotency)
		const existing = await db.query.jobs.findFirst({
			where: eq(jobs.inngestRunId, params.inngestRunId),
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
			.insert(jobs)
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
 * @param jobId Job ID
 * @param status New status
 */
export async function updateJobStatus(
	jobId: string,
	status: "running" | "queued" | "completed" | "failed" | "cancelled",
): Promise<void> {
	try {
		const updates: Partial<InsertJob> = {
			status,
		};

		// Set startedAt when transitioning to running
		if (status === "running") {
			updates.startedAt = new Date().toISOString();
		}

		await db.update(jobs).set(updates).where(eq(jobs.id, jobId));

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
 *
 * @param jobId Job ID
 * @param params Completion parameters
 */
export async function completeJob(params: {
	jobId: string;
	status: "completed" | "failed" | "cancelled";
	output?: JobOutput;
	errorMessage?: string;
}): Promise<void> {
	try {
		// Fetch job to calculate duration
		const job = await db.query.jobs.findFirst({
			where: eq(jobs.id, params.jobId),
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
			.update(jobs)
			.set({
				status: params.status,
				output: params.output ?? null,
				errorMessage: params.errorMessage ?? null,
				completedAt,
				durationMs,
			})
			.where(eq(jobs.id, params.jobId));

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
 * @param params Metric parameters
 */
export async function recordJobMetric(params: {
	clerkOrgId: string;
	workspaceId: string;
	repositoryId?: string;
	type: "job_duration" | "documents_indexed" | "errors";
	value: number;
	unit?: string;
	tags?: Record<string, string | number | boolean>;
}): Promise<void> {
	try {
		await db.insert(metrics).values({
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
 * @param jobId Job ID
 * @returns Job or null if not found
 */
export async function getJob(jobId: string): Promise<Job | null> {
	try {
		const job = await db.query.jobs.findFirst({
			where: eq(jobs.id, jobId),
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
): Promise<Job | null> {
	try {
		const job = await db.query.jobs.findFirst({
			where: eq(jobs.inngestRunId, inngestRunId),
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
