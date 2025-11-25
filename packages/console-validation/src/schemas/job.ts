/**
 * Job Validation Schemas
 *
 * Domain-specific validation for background job operations.
 * Used in tRPC procedures for job tracking and management.
 */

import { z } from "zod";
import { nanoidSchema, inngestRunIdSchema, inngestFunctionIdSchema } from "../primitives/ids";
import { workspaceNameSchema, clerkOrgSlugSchema } from "../primitives/slugs";
import { jobNameSchema } from "../primitives/names";

/**
 * Job Status Enum
 *
 * Represents the lifecycle states of a background job
 */
export const jobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export type JobStatus = z.infer<typeof jobStatusSchema>;

/**
 * Job Trigger Type Enum
 *
 * Represents how a job was initiated and recorded in the database.
 *
 * - manual: User explicitly clicked "Restart" or "Re-sync" button
 * - scheduled: Triggered by a scheduled/cron job
 * - webhook: Triggered by external webhook (GitHub push, etc.)
 * - automatic: System-initiated (workspace creation, initial connection)
 */
export const jobTriggerSchema = z.enum([
  "manual",
  "scheduled",
  "webhook",
  "automatic",
]);

export type JobTrigger = z.infer<typeof jobTriggerSchema>;

/**
 * Sync Trigger Type Enum
 *
 * Represents what triggered a sync workflow event.
 * Used in Inngest events (source.sync, github.sync, etc.)
 *
 * - manual: User explicitly requested sync/restart
 * - scheduled: Triggered by scheduled/cron job
 * - webhook: Triggered by external webhook (GitHub push, etc.)
 * - config-change: Triggered by configuration file changes (lightfast.yml)
 */
export const syncTriggerSchema = z.enum([
  "manual",
  "scheduled",
  "webhook",
  "config-change",
]);

export type SyncTrigger = z.infer<typeof syncTriggerSchema>;

/**
 * Job List Input Schema
 *
 * Used in:
 * - tRPC jobs.list procedure
 *
 * Supports filtering by status, repository, and pagination
 *
 * @example
 * ```typescript
 * const input = jobListInputSchema.parse({
 *   clerkOrgSlug: "lightfast-ai",
 *   workspaceName: "my-workspace",
 *   status: "running",
 *   repositoryId: "V1StGXR8_Z5jdHi6B-myT",
 *   limit: 50,
 *   cursor: "next_page_token",
 * });
 * ```
 */
export const jobListInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
  workspaceName: workspaceNameSchema,
  status: jobStatusSchema.optional(),
  repositoryId: nanoidSchema.optional(),
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type JobListInput = z.infer<typeof jobListInputSchema>;

/**
 * Job Get Input Schema
 *
 * Used in:
 * - tRPC jobs.get procedure
 *
 * @example
 * ```typescript
 * const input = jobGetInputSchema.parse({
 *   jobId: "V1StGXR8_Z5jdHi6B-myT",
 *   clerkOrgSlug: "lightfast-ai",
 *   workspaceName: "my-workspace",
 * });
 * ```
 */
export const jobGetInputSchema = z.object({
  jobId: nanoidSchema,
  clerkOrgSlug: clerkOrgSlugSchema,
  workspaceName: workspaceNameSchema,
});

export type JobGetInput = z.infer<typeof jobGetInputSchema>;

/**
 * Job Creation Input Schema
 *
 * Used in:
 * - Background job creation
 * - Inngest workflow triggering
 *
 * @example
 * ```typescript
 * const input = jobCreateInputSchema.parse({
 *   clerkOrgId: "org_2abcdef123",
 *   workspaceId: "V1StGXR8_Z5jdHi6B-myT",
 *   repositoryId: "V1StGXR8_Z5jdHi6B-myT",
 *   inngestRunId: "01HE8X7ZQK6YG9B5R8J9QVXT0Q",
 *   inngestFunctionId: "apps-console/docs.push",
 *   name: "Document Ingestion - PR #123",
 *   trigger: "webhook",
 * });
 * ```
 */
export const jobCreateInputSchema = z.object({
  clerkOrgId: z.string().min(1, "Organization ID must not be empty"),
  workspaceId: nanoidSchema,
  repositoryId: nanoidSchema.optional(),
  inngestRunId: inngestRunIdSchema,
  inngestFunctionId: inngestFunctionIdSchema,
  name: jobNameSchema,
  trigger: jobTriggerSchema,
});

export type JobCreateInput = z.infer<typeof jobCreateInputSchema>;

/**
 * Job Update Status Input Schema
 *
 * Used in:
 * - Job status updates from Inngest callbacks
 * - Manual job cancellation
 *
 * @example
 * ```typescript
 * const input = jobUpdateStatusInputSchema.parse({
 *   jobId: "V1StGXR8_Z5jdHi6B-myT",
 *   status: "completed",
 *   duration: 42000,
 *   error: null,
 * });
 * ```
 */
export const jobUpdateStatusInputSchema = z.object({
  jobId: nanoidSchema,
  status: jobStatusSchema,
  duration: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
  errorDetail: z.string().optional(),
});

export type JobUpdateStatusInput = z.infer<typeof jobUpdateStatusInputSchema>;

/**
 * Job Cancel Input Schema
 *
 * Used in:
 * - tRPC jobs.cancel procedure
 * - Manual job cancellation
 *
 * @example
 * ```typescript
 * const input = jobCancelInputSchema.parse({
 *   jobId: "V1StGXR8_Z5jdHi6B-myT",
 *   clerkOrgSlug: "lightfast-ai",
 *   workspaceName: "my-workspace",
 * });
 * ```
 */
export const jobCancelInputSchema = z.object({
  jobId: nanoidSchema,
  clerkOrgSlug: clerkOrgSlugSchema,
  workspaceName: workspaceNameSchema,
});

export type JobCancelInput = z.infer<typeof jobCancelInputSchema>;
