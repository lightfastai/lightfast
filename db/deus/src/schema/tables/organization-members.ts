import { sql } from "drizzle-orm";
import {
	mysqlTable,
	varchar,
	datetime,
	mysqlEnum,
	index,
} from "drizzle-orm/mysql-core";
import { uuidv4 } from "@repo/lib";
import { organizations } from "./organizations";

/**
 * Organization Members table
 *
 * Tracks which users have access to which organizations.
 * Currently only supports "owner" role (the user who claimed the org).
 * Future: Add more roles and GitHub org membership sync.
 */
export const organizationMembers = mysqlTable(
	"lightfast_deus_organization_members",
	{
		id: varchar("id", { length: 191 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => uuidv4()),

		organizationId: varchar("organization_id", { length: 191 }).notNull(),

		userId: varchar("user_id", { length: 191 }).notNull(), // Clerk user ID

		role: mysqlEnum("role", ["owner"]).notNull().default("owner"),

		// Timestamps
		joinedAt: datetime("joined_at", { mode: "string" })
			.default(sql`(CURRENT_TIMESTAMP)`)
			.notNull(),
		createdAt: datetime("created_at", { mode: "string" })
			.default(sql`(CURRENT_TIMESTAMP)`)
			.notNull(),
	},
	(table) => ({
		// Index for fast user organization lookups
		userIdIdx: index("user_id_idx").on(table.userId),
		// Index for fast organization member lookups
		organizationIdIdx: index("organization_id_idx").on(table.organizationId),
		// Composite index for checking user access to specific org
		userOrgIdx: index("user_org_idx").on(table.userId, table.organizationId),
	}),
);

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;
