import { sql } from "drizzle-orm";
import {
  datetime,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import type {
  TaskMetadata,
  TaskSeverity,
  TaskStatus,
} from "@repo/console-types/tasks";
import { TASK_SEVERITY, TASK_STATUS } from "@repo/console-types/tasks";
import { uuidv4 } from "@repo/lib";

/**
 * DeusCodeReviewTask table tracks individual findings from code reviews
 *
 * DESIGN:
 * - Each task represents one comment/finding from the review tool
 * - Synced from GitHub PR comments
 * - Used to display diff view and track resolution
 */
export const DeusCodeReviewTask = mysqlTable(
  "lightfast_deus_code_review_tasks",
  {
    /**
     * Unique identifier for the task
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => uuidv4()),

    /**
     * Code review this task belongs to
     */
    codeReviewId: varchar("code_review_id", { length: 191 }).notNull(),

    /**
     * Task title/summary
     */
    title: varchar("title", { length: 500 }).notNull(),

    /**
     * Task description/details
     */
    description: text("description"),

    /**
     * Severity level
     */
    severity: mysqlEnum("severity", TASK_SEVERITY).notNull().default("info"),

    /**
     * Current status
     */
    status: mysqlEnum("status", TASK_STATUS).notNull().default("open"),

    /**
     * Task metadata (file path, line numbers, suggestions, etc.)
     */
    metadata: json("metadata").$type<TaskMetadata>(),

    /**
     * When the task was created (from GitHub comment timestamp)
     */
    createdAt: datetime("created_at", { mode: "string" })
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),

    /**
     * When the task was last updated
     */
    updatedAt: datetime("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * When the task was resolved/dismissed
     */
    resolvedAt: datetime("resolved_at", { mode: "string" }),

    /**
     * User who resolved/dismissed the task
     */
    resolvedBy: varchar("resolved_by", { length: 191 }),
  },
  (table) => ({
    // Index for code review lookups
    codeReviewIdIdx: index("code_review_id_idx").on(table.codeReviewId),
    // Index for status filtering
    statusIdx: index("status_idx").on(table.status),
    // Index for severity filtering
    severityIdx: index("severity_idx").on(table.severity),
    // Composite index for review + status queries
    reviewStatusIdx: index("review_status_idx").on(
      table.codeReviewId,
      table.status,
    ),
  }),
);

// Type exports
export type DeusCodeReviewTask = typeof DeusCodeReviewTask.$inferSelect;
export type InsertDeusCodeReviewTask = typeof DeusCodeReviewTask.$inferInsert;

// Zod Schema exports
export const insertDeusCodeReviewTaskSchema =
  createInsertSchema(DeusCodeReviewTask);
export const selectDeusCodeReviewTaskSchema =
  createSelectSchema(DeusCodeReviewTask);

export { TASK_SEVERITY, TASK_STATUS };
export type { TaskMetadata, TaskSeverity, TaskStatus };
