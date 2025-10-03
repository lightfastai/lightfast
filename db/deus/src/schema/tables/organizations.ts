import { sql } from "drizzle-orm";
import { mysqlTable, varchar, int, datetime, text } from "drizzle-orm/mysql-core";
import { uuidv4 } from "@repo/lib";

/**
 * Organizations table
 *
 * Represents GitHub organizations that have been claimed in Deus.
 * One GitHub organization = one Deus workspace.
 */
export const organizations = mysqlTable("lightfast_deus_organizations", {
	id: varchar("id", { length: 191 })
		.notNull()
		.primaryKey()
		.$defaultFn(() => uuidv4()),

	// GitHub App installation details
	githubInstallationId: int("github_installation_id").notNull().unique(),
	githubOrgId: int("github_org_id").notNull().unique(),
	githubOrgSlug: varchar("github_org_slug", { length: 255 }).notNull().unique(),
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
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
