import { sql } from "drizzle-orm";
import {
	index,
	integer,
	jsonb,
	pgTable,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";

/**
 * Metrics table tracks performance and usage metrics
 *
 * Design:
 * - Time-series data for dashboards and analytics
 * - Tracks queries, indexing, API calls, latency, errors
 * - Aggregated by workspace/repository/user
 * - Used for PlanetScale-style insights dashboard
 *
 * Metric types:
 * - query: Search/contents API call
 * - index: Document indexing operation
 * - api: General API call
 * - error: Error occurrence
 */
export const metrics = pgTable(
	"lightfast_metrics",
	{
		/**
		 * Unique metric identifier (nanoid)
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
		 * Workspace ID this metric belongs to
		 */
		workspaceId: varchar("workspace_id", { length: 191 }).notNull(),

		/**
		 * Optional repository ID if metric is repository-specific
		 */
		repositoryId: varchar("repository_id", { length: 191 }),

		/**
		 * Metric type
		 * - query_latency: Search query latency
		 * - queries_count: Number of queries
		 * - documents_indexed: Documents indexed count
		 * - api_calls: API call count
		 * - errors: Error count
		 * - job_duration: Job execution time
		 */
		type: varchar("type", { length: 50 })
			.notNull()
			.$type<
				| "query_latency"
				| "queries_count"
				| "documents_indexed"
				| "api_calls"
				| "errors"
				| "job_duration"
			>(),

		/**
		 * Metric value (numeric)
		 * - For latency: milliseconds
		 * - For counts: integer count
		 * - For percentages: 0-100
		 */
		value: integer("value").notNull(),

		/**
		 * Optional metric unit
		 * Examples: "ms", "count", "percent", "bytes"
		 */
		unit: varchar("unit", { length: 20 }),

		/**
		 * Metric tags/dimensions for filtering
		 * Structure:
		 * {
		 *   endpoint?: string,
		 *   method?: string,
		 *   status?: number,
		 *   userId?: string,
		 *   jobType?: string,
		 *   errorType?: string
		 * }
		 */
		tags: jsonb("tags").$type<MetricTags>(),

		/**
		 * Timestamp when metric was recorded
		 * Used for time-series queries and aggregation
		 */
		timestamp: timestamp("timestamp", { mode: "string", withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),

		/**
		 * Timestamp when metric record was created (usually same as timestamp)
		 */
		createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => ({
		// Index for finding metrics by organization
		clerkOrgIdIdx: index("metric_clerk_org_id_idx").on(table.clerkOrgId),

		// Index for finding metrics by workspace
		workspaceIdIdx: index("metric_workspace_id_idx").on(table.workspaceId),

		// Index for finding metrics by repository
		repositoryIdIdx: index("metric_repository_id_idx").on(table.repositoryId),

		// Index for finding metrics by type
		typeIdx: index("metric_type_idx").on(table.type),

		// Composite index for time-series queries by workspace
		workspaceTypeTimestampIdx: index(
			"metric_workspace_type_timestamp_idx",
		).on(table.workspaceId, table.type, table.timestamp),

		// Index for recent metrics (for dashboard)
		timestampIdx: index("metric_timestamp_idx").on(table.timestamp),
	}),
);

// TypeScript types
export interface MetricTags {
	endpoint?: string;
	method?: string;
	status?: number;
	userId?: string;
	jobType?: string;
	errorType?: string;
	[key: string]: unknown;
}

// Type exports
export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = typeof metrics.$inferInsert;

// Zod schemas
