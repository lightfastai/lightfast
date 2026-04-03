/**
 * Job tracking utilities for Inngest workflow executions
 *
 * Provides functions to create, update, and complete job records
 * with integrated metrics tracking for performance monitoring.
 */

import { db } from "@db/app/client";
import type { InsertOrgWorkflowRun, OrgWorkflowRun } from "@db/app/schema";
import { orgWorkflowRuns } from "@db/app/schema";
import type {
  JobTrigger,
  WorkflowInput,
  WorkflowOutput,
} from "@repo/app-validation";
import {
  workflowInputSchema,
  workflowOutputSchema,
} from "@repo/app-validation";
import { log } from "@vendor/observability/log/next";
import { eq } from "drizzle-orm";

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
        log.error("[jobs] invalid workflow input", {
          error: validated.error.format(),
          input: params.input,
        });
        throw new Error(`Invalid workflow input: ${validated.error.message}`);
      }
    }

    // Check for existing job with same inngestRunId (idempotency)
    const existing = await db.query.orgWorkflowRuns.findFirst({
      where: eq(orgWorkflowRuns.inngestRunId, params.inngestRunId),
    });

    if (existing) {
      log.info("[jobs] job already exists", {
        jobId: existing.id,
        inngestRunId: params.inngestRunId,
      });
      return existing.id;
    }

    // Create new job record
    const [job] = await db
      .insert(orgWorkflowRuns)
      .values({
        clerkOrgId: params.clerkOrgId,
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

    log.info("[jobs] job created", {
      jobId: job.id,
      inngestRunId: params.inngestRunId,
      name: params.name,
    });

    return job.id;
  } catch (error) {
    log.error("[jobs] failed to create job record", {
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
  status: "running" | "queued" | "completed" | "failed" | "cancelled"
): Promise<void> {
  try {
    const updates: Partial<InsertOrgWorkflowRun> = {
      status,
    };

    // Set startedAt when transitioning to running
    if (status === "running") {
      updates.startedAt = new Date().toISOString();
    }

    await db
      .update(orgWorkflowRuns)
      .set(updates)
      .where(eq(orgWorkflowRuns.id, jobId));

    log.info("[jobs] job status updated", { jobId, status });
  } catch (error) {
    log.error("[jobs] failed to update job status", { error, jobId, status });
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
      }
): Promise<void> {
  try {
    const jobIdNum = params.jobId;

    // Validate output for completed/failed jobs
    if (params.status === "completed" || params.status === "failed") {
      const validated = workflowOutputSchema.safeParse(params.output);
      if (!validated.success) {
        log.error("[jobs] invalid workflow output", {
          error: validated.error.format(),
          output: params.output,
        });
        throw new Error(`Invalid workflow output: ${validated.error.message}`);
      }
    }

    // Fetch job to calculate duration
    const job = await db.query.orgWorkflowRuns.findFirst({
      where: eq(orgWorkflowRuns.id, jobIdNum),
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
      .update(orgWorkflowRuns)
      .set({
        status: params.status,
        output: params.status === "cancelled" ? null : params.output,
        errorMessage:
          params.status === "cancelled" ? (params.errorMessage ?? null) : null,
        completedAt,
        durationMs,
      })
      .where(eq(orgWorkflowRuns.id, jobIdNum));

    log.info("[jobs] job completed", {
      jobId: params.jobId,
      status: params.status,
      durationMs,
    });
  } catch (error) {
    log.error("[jobs] failed to complete job", {
      error,
      jobId: params.jobId,
      status: params.status,
    });
    throw error;
  }
}

/**
 * Get job by ID
 *
 * @param jobId Job ID (string representation of BIGINT)
 * @returns Job or null if not found
 */
export async function getJob(jobId: string): Promise<OrgWorkflowRun | null> {
  try {
    // Parse jobId to number (BIGINT internal ID)
    const jobIdNum = Number.parseInt(jobId, 10);
    if (Number.isNaN(jobIdNum)) {
      log.error("[jobs] invalid job ID format", { jobId });
      return null;
    }

    const job = await db.query.orgWorkflowRuns.findFirst({
      where: eq(orgWorkflowRuns.id, jobIdNum),
    });

    return job ?? null;
  } catch (error) {
    log.error("[jobs] failed to get job", { error, jobId });
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
  inngestRunId: string
): Promise<OrgWorkflowRun | null> {
  try {
    const job = await db.query.orgWorkflowRuns.findFirst({
      where: eq(orgWorkflowRuns.inngestRunId, inngestRunId),
    });

    return job ?? null;
  } catch (error) {
    log.error("[jobs] failed to get job by inngest run ID", {
      error,
      inngestRunId,
    });
    return null;
  }
}
