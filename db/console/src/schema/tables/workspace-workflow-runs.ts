import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import type { JobStatus, JobTrigger } from "@repo/console-validation";
import { workspaceStores } from "./workspace-stores";

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
     * Unique job identifier (nanoid)
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    /**
     * Clerk organization ID (no FK - Clerk is source of truth)
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    /**
     * Workspace ID this job belongs to
     */
    workspaceId: varchar("workspace_id", { length: 191 }).notNull(),

    /**
     * Store ID this job writes to
     */
    storeId: varchar("store_id", { length: 191 })
      .notNull()
      .references(() => workspaceStores.id, { onDelete: "cascade" }),

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
    input: jsonb("input").$type<JobInput>(),

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
    output: jsonb("output").$type<JobOutput>(),

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

    // Index for finding jobs by store
    storeIdIdx: index("job_store_id_idx").on(table.storeId),

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

// TypeScript types
export interface JobInput {
  repoFullName?: string;
  branch?: string;
  afterSha?: string; // The commit SHA (from GitHub push event)
  commitMessage?: string;
  storeSlug?: string; // Target store slug (passed via event data)
  files?: string[];
  config?: Record<string, unknown>;
  sourceId?: string;
  sourceType?: string;
  sourceMetadata?: Record<string, unknown>;
  syncMode?: string;
  trigger?: string;
  syncParams?: Record<string, unknown>;
  repoId?: string;
}

export interface JobOutput {
  documentsProcessed?: number;
  chunksCreated?: number;
  duration?: number;
  error?: string;
  details?: Record<string, unknown>;
  sourceId?: string;
  sourceType?: string;
  syncTriggered?: boolean;
  repoFullName?: string;
  syncMode?: string;
  filesProcessed?: number;
  filesFailed?: number;
  storeSlug?: string;
  timedOut?: boolean;
}

// Type exports
export type WorkspaceWorkflowRun = typeof workspaceWorkflowRuns.$inferSelect;
export type InsertWorkspaceWorkflowRun =
  typeof workspaceWorkflowRuns.$inferInsert;
