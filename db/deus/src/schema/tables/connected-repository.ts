import { sql } from "drizzle-orm";
import {
	boolean,
	datetime,
	index,
	json,
	mysqlTable,
	text,
	varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { uuidv4 } from "@repo/lib";

/**
 * GitHub repository permissions type
 */
export type RepositoryPermissions = {
	admin: boolean;
	push: boolean;
	pull: boolean;
};

/**
 * Code review settings for the repository
 */
export type CodeReviewSettings = {
	enabled?: boolean;
	tool?: "coderabbit" | "claude" | "vercel-agents" | "custom";
	command?: string;
};

/**
 * Repository metadata type for flexible storage
 * IMPORTANT: This is a CACHE - can be stale. Always fetch fresh from GitHub API when accuracy matters.
 */
export type RepositoryMetadata = {
	fullName?: string; // Cache of "owner/repo" for display only
	description?: string;
	language?: string;
	private?: boolean;
	owner?: string;
	ownerAvatar?: string;
	stargazersCount?: number;
	updatedAt?: string;
	[key: string]: unknown;
};

/**
 * DeusConnectedRepository table represents GitHub repositories connected to Deus.
 *
 * DESIGN PRINCIPLE: Organization-scoped via GitHub App
 *
 * AUTHENTICATION APPROACH: GitHub App installation
 * - Organization installs GitHub App
 * - We use installation ID to get installation access tokens
 * - Repositories are scoped to the organization
 *
 * What we STORE:
 * - organizationId: Which Deus org this repo belongs to ✅
 * - githubRepoId: GitHub's internal ID (NEVER changes, even on rename/transfer) ✅
 * - githubInstallationId: GitHub App installation ID for API access ✅
 * - permissions: What we're allowed to do ✅
 * - metadata: Optional cache (can be stale, for UI display only) ✅
 *
 * What we DON'T store (fetch from GitHub API instead):
 * - repoOwner, repoName (mutable - repos can be renamed/transferred) ❌
 * - defaultBranch (mutable - can be changed in settings) ❌
 * - stars, forks, watchers (change frequently) ❌
 *
 * WHY: Single source of truth = GitHub API. No sync logic, no webhooks, no staleness. Ship faster. 🚀
 */
export const DeusConnectedRepository = mysqlTable(
	"lightfast_deus_connected_repository",
	{
		/**
		 * Unique identifier for the connected repository
		 */
		id: varchar("id", { length: 191 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => uuidv4()),

		/**
		 * Reference to the organization this repository belongs to
		 */
		organizationId: varchar("organization_id", { length: 191 }).notNull(),

		/**
		 * GitHub's unique repository ID (immutable, never changes)
		 * This is our single source of truth - everything else is fetched from GitHub API
		 */
		githubRepoId: varchar("github_repo_id", { length: 191 }).notNull().unique(),

		/**
		 * GitHub App installation ID for this repository
		 * Used to get installation access tokens for API calls
		 */
		githubInstallationId: varchar("github_installation_id", {
			length: 191,
		}).notNull(),

		/**
		 * Repository permissions granted to Deus
		 */
		permissions: json("permissions").$type<RepositoryPermissions>(),

		/**
		 * Whether this connection is currently active
		 */
		isActive: boolean("is_active").notNull().default(true),

		/**
		 * When the repository was first connected
		 */
		connectedAt: datetime("connected_at", { mode: "string" })
			.default(sql`(CURRENT_TIMESTAMP)`)
			.notNull(),

		/**
		 * Last time we successfully interacted with GitHub API for this repo
		 */
		lastSyncedAt: datetime("last_synced_at", { mode: "string" }),

		/**
		 * Code review settings for this repository
		 */
		codeReviewSettings: json(
			"code_review_settings",
		).$type<CodeReviewSettings>(),

		/**
		 * Optional metadata cache (can be stale - don't rely on this for operations)
		 * Use for UI display, but always fetch fresh from GitHub when accuracy matters
		 */
		metadata: json("metadata").$type<RepositoryMetadata>(),

		/**
		 * Timestamp when record was created
		 */
		createdAt: datetime("created_at", { mode: "string" })
			.default(sql`(CURRENT_TIMESTAMP)`)
			.notNull(),
	},
	(table) => ({
		// Index for fast organization repository lookups
		orgIdIdx: index("org_id_idx").on(table.organizationId),

		// Composite index for active repositories by organization (most common query)
		orgActiveIdx: index("org_active_idx").on(
			table.organizationId,
			table.isActive,
		),

		// Index for GitHub installation lookups
		installationIdx: index("installation_idx").on(table.githubInstallationId),
	}),
);

// Type exports
export type DeusConnectedRepository =
	typeof DeusConnectedRepository.$inferSelect;
export type InsertDeusConnectedRepository =
	typeof DeusConnectedRepository.$inferInsert;

// Zod Schema exports for validation
export const insertDeusConnectedRepositorySchema = createInsertSchema(
	DeusConnectedRepository,
);
export const selectDeusConnectedRepositorySchema = createSelectSchema(
	DeusConnectedRepository,
);
