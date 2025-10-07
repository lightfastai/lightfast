import { sql } from "drizzle-orm";
import { mysqlTable, varchar, int, datetime, text, index } from "drizzle-orm/mysql-core";
import { uuidv4 } from "@repo/lib";

/**
 * Organizations table
 *
 * Represents GitHub organizations that have been claimed in Deus.
 * One GitHub organization = one Deus workspace.
 *
 * KEY DESIGN DECISIONS:
 * - githubOrgId is UNIQUE (immutable, never changes)
 * - githubInstallationId is NOT unique (can change if app reinstalled)
 * - githubOrgSlug is NOT unique (can change if org renamed on GitHub)
 * - We use index on slug for fast lookups, but allow duplicates for history
 */
export const organizations = mysqlTable(
	"lightfast_deus_organizations",
	{
		id: varchar("id", { length: 191 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => uuidv4()),

		// GitHub App installation details
		// IMMUTABLE: GitHub's internal org ID - this is our source of truth
		githubOrgId: int("github_org_id").notNull().unique(),

		// Can change if app is reinstalled to same org
		githubInstallationId: int("github_installation_id").notNull(),

		// Can change if org is renamed on GitHub
		githubOrgSlug: varchar("github_org_slug", { length: 255 }).notNull(),
		githubOrgName: varchar("github_org_name", { length: 255 }).notNull(),
		githubOrgAvatarUrl: text("github_org_avatar_url"),

		// Ownership tracking
		claimedBy: varchar("claimed_by", { length: 191 }).notNull(), // Clerk user ID
		claimedAt: datetime("claimed_at", { mode: "string" })
			.default(sql`(CURRENT_TIMESTAMP)`)
			.notNull(),

		// Timestamps
		createdAt: datetime("created_at", { mode: "string" })
			.default(sql`(CURRENT_TIMESTAMP)`)
			.notNull(),
		updatedAt: datetime("updated_at", { mode: "string" })
			.default(sql`(CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`)
			.notNull(),
	},
	(table) => ({
		// Index for fast slug lookups (most common query pattern)
		slugIdx: index("org_slug_idx").on(table.githubOrgSlug),
		// Index for installation lookups
		installationIdx: index("org_installation_idx").on(table.githubInstallationId),
	}),
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
