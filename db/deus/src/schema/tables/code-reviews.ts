import { sql } from "drizzle-orm";
import {
	datetime,
	index,
	json,
	mysqlEnum,
	mysqlTable,
	text,
	varchar,
	int,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { uuidv4 } from "@repo/lib";

/**
 * Supported code review tools
 */
export const CODE_REVIEW_TOOLS = [
	"coderabbit",
	"claude",
	"vercel-agents",
	"custom",
] as const;

export type CodeReviewTool = (typeof CODE_REVIEW_TOOLS)[number];

/**
 * Code review status
 */
export const CODE_REVIEW_STATUS = [
	"pending", // Review triggered, waiting to start
	"running", // Review in progress
	"completed", // Review finished successfully
	"failed", // Review failed
	"cancelled", // Review cancelled by user
] as const;

export type CodeReviewStatus = (typeof CODE_REVIEW_STATUS)[number];

/**
 * Tool-specific configuration stored in metadata
 */
export type CodeReviewMetadata = {
	// Tool-specific command used
	command?: string;
	// GitHub comment ID that triggered the review
	triggerCommentId?: string;
	// GitHub PR URL
	prUrl?: string;
	// Number of tasks/findings created
	taskCount?: number;
	// Error message if failed
	error?: string;
};

/**
 * DeusCodeReview table tracks code review runs
 *
 * DESIGN:
 * - One review per PR trigger
 * - Syncs results from external tools via webhooks
 * - Creates tasks for each finding
 */
export const DeusCodeReview = mysqlTable(
	"lightfast_deus_code_reviews",
	{
		/**
		 * Unique identifier for the code review
		 */
		id: varchar("id", { length: 191 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => uuidv4()),

		/**
		 * Repository this review belongs to
		 */
		repositoryId: varchar("repository_id", { length: 191 }).notNull(),

		/**
		 * GitHub Pull Request number
		 */
		pullRequestNumber: int("pull_request_number").notNull(),

		/**
		 * GitHub Pull Request ID (immutable)
		 */
		githubPrId: varchar("github_pr_id", { length: 191 }).notNull(),

		/**
		 * Review tool used
		 */
		reviewTool: mysqlEnum("review_tool", CODE_REVIEW_TOOLS).notNull(),

		/**
		 * Current status of the review
		 */
		status: mysqlEnum("status", CODE_REVIEW_STATUS)
			.notNull()
			.default("pending"),

		/**
		 * User who triggered the review (Clerk user ID)
		 */
		triggeredBy: varchar("triggered_by", { length: 191 }).notNull(),

		/**
		 * When the review was triggered
		 */
		triggeredAt: datetime("triggered_at", { mode: "string" })
			.default(sql`(CURRENT_TIMESTAMP)`)
			.notNull(),

		/**
		 * When the review started running
		 */
		startedAt: datetime("started_at", { mode: "string" }),

		/**
		 * When the review completed (success or failure)
		 */
		completedAt: datetime("completed_at", { mode: "string" }),

		/**
		 * Review metadata (tool-specific data, results)
		 */
		metadata: json("metadata").$type<CodeReviewMetadata>(),

		/**
		 * Timestamp when record was created
		 */
		createdAt: datetime("created_at", { mode: "string" })
			.default(sql`(CURRENT_TIMESTAMP)`)
			.notNull(),

		/**
		 * Timestamp when record was last updated
		 */
		updatedAt: datetime("updated_at", { mode: "string" })
			.default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => ({
		// Index for repository lookups
		repositoryIdIdx: index("repository_id_idx").on(table.repositoryId),
		// Index for PR lookups
		prIdx: index("pr_idx").on(table.repositoryId, table.pullRequestNumber),
		// Index for status queries
		statusIdx: index("status_idx").on(table.status),
		// Index for user activity
		triggeredByIdx: index("triggered_by_idx").on(table.triggeredBy),
	}),
);

// Type exports
export type DeusCodeReview = typeof DeusCodeReview.$inferSelect;
export type InsertDeusCodeReview = typeof DeusCodeReview.$inferInsert;

// Zod Schema exports
export const insertDeusCodeReviewSchema = createInsertSchema(DeusCodeReview);
export const selectDeusCodeReviewSchema = createSelectSchema(DeusCodeReview);
