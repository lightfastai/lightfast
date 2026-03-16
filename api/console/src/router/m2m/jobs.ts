import {
  jobTriggerSchema,
  workflowInputSchema,
  workflowOutputSchema,
} from "@repo/console-validation";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import {
  completeJob,
  createJob,
  getJob,
  updateJobStatus,
} from "../../lib/jobs";
import { inngestM2MProcedure } from "../../trpc";

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
        input: workflowInputSchema.nullable().optional(),
      })
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
        jobId: z.coerce.number(), // Coerce string to number (BIGINT internal ID)
        status: z.enum([
          "running",
          "queued",
          "completed",
          "failed",
          "cancelled",
        ]),
      })
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
        jobId: z.coerce.number(), // Coerce string to number (BIGINT internal ID)
        status: z.enum(["completed", "failed", "cancelled"]),
        output: workflowOutputSchema.nullable().optional(),
        errorMessage: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Handle discriminated union for completeJob
      if (input.status === "cancelled") {
        await completeJob({
          jobId: input.jobId,
          status: "cancelled",
          errorMessage: input.errorMessage ?? undefined,
        });
      } else if (input.output) {
        await completeJob({
          jobId: input.jobId,
          status: input.status,
          output: input.output,
        });
      } else {
        throw new Error("Output is required for completed/failed jobs");
      }
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
