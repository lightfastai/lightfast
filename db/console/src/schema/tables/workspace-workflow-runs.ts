import { sql } from "drizzle-orm";
import { bigint, index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { orgWorkspaces } from "./org-workspaces";
import type { JobStatus, JobTrigger, WorkflowInput, WorkflowOutput } from "@repo/console-validation";

/**
 * Jobs table tracks Inngest workflow executions
 *
 * Design:
 * - Each job represents a single workflow execution (run)
 * - Jobs are triggered manually, by schedule, or by webhooks
 * - Status is synced from Inngest run status
 * - Linked to workspace and optional repository
 *
 * Status flow:
 * - queued → running → completed/failed/cancelled
 */
export const workspaceWorkflowRuns = pgTable(
  "lightfast_workspace_workflow_runs",
  {
    /**
     * Internal BIGINT primary key - maximum performance for job tracking
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * Clerk organization ID (no FK - Clerk is source of truth)
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    /**
     * Workspace ID this job belongs to
     */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    /**
     * Optional repository ID if job is repository-specific
     */
    repositoryId: varchar("repository_id", { length: 191 }),

    /**
     * Inngest run ID for tracking in Inngest dashboard
     */
    inngestRunId: varchar("inngest_run_id", { length: 191 }).notNull(),

    /**
     * Inngest function ID/name
     */
    inngestFunctionId: varchar("inngest_function_id", {
      length: 191,
    }).notNull(),

    /**
     * Job name (human-readable)
     * Examples: "Index Repository", "Sync Documents", "Generate Embeddings"
     */
    name: varchar("name", { length: 191 }).notNull(),

    /**
     * Job status
     * - queued: Waiting to start
     * - running: Currently executing
     * - completed: Finished successfully
     * - failed: Failed with error
     * - cancelled: User or system cancelled
     */
    status: varchar("status", { length: 50 })
      .notNull()
      .default("queued")
      .$type<JobStatus>(),

    /**
     * Job trigger type
     * - manual: User-initiated
     * - scheduled: Cron/scheduled execution
     * - webhook: Triggered by webhook (e.g., GitHub push)
     * - automatic: System-initiated (e.g., auto-indexing)
     */
    trigger: varchar("trigger", { length: 50 }).notNull().$type<JobTrigger>(),

    /**
     * User ID who triggered the job (if manual)
     */
    triggeredBy: varchar("triggered_by", { length: 191 }),

    /**
     * Job input parameters (varies by job type)
     * Structure:
     * {
     *   repoFullName?: string,
     *   branch?: string,
     *   files?: string[],
     *   config?: object
     * }
     */
    input: jsonb("input").$type<WorkflowInput>(),

    /**
     * Job output/result (after completion)
     * Structure:
     * {
     *   documentsProcessed?: number,
     *   duration?: number,
     *   error?: string,
     *   details?: object
     * }
     */
    output: jsonb("output").$type<WorkflowOutput>(),

    /**
     * Error message if job failed
     */
    errorMessage: varchar("error_message", { length: 1000 }),

    /**
     * Job start time
     */
    startedAt: timestamp("started_at", {
      mode: "string",
      withTimezone: true,
    }),

    /**
     * Job completion time
     */
    completedAt: timestamp("completed_at", {
      mode: "string",
      withTimezone: true,
    }),

    /**
     * Job duration in milliseconds
     */
    durationMs: varchar("duration_ms", { length: 50 }),

    /**
     * Timestamp when job was created (queued)
     */
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Timestamp when job record was last updated
     */
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for finding all jobs in a Clerk organization
    clerkOrgIdIdx: index("job_clerk_org_id_idx").on(table.clerkOrgId),

    // Index for finding jobs by workspace
    workspaceIdIdx: index("job_workspace_id_idx").on(table.workspaceId),

    // Index for finding jobs by repository
    repositoryIdIdx: index("job_repository_id_idx").on(table.repositoryId),

    // Index for finding jobs by status
    statusIdx: index("job_status_idx").on(table.status),

    // Index for finding jobs by Inngest run ID
    inngestRunIdIdx: index("job_inngest_run_id_idx").on(table.inngestRunId),

    // Composite index for recent jobs by workspace
    workspaceCreatedAtIdx: index("job_workspace_created_at_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  }),
);

// Type re-exports from validation schemas
export type {
  WorkflowInput,
  WorkflowOutput,
  SourceConnectedGitHubInput,
  SourceConnectedGitHubOutputSuccess,
  SourceConnectedGitHubOutputFailure,
  SourceSyncGitHubInput,
  SourceSyncGitHubOutputSuccess,
  SourceSyncGitHubOutputFailure,
  GitHubSourceMetadata,
} from "@repo/console-validation";

// Type exports
export type WorkspaceWorkflowRun = typeof workspaceWorkflowRuns.$inferSelect;
export type InsertWorkspaceWorkflowRun =
  typeof workspaceWorkflowRuns.$inferInsert;
