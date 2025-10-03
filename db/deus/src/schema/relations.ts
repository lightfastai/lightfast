import { relations } from "drizzle-orm";
import { organizations } from "./tables/organizations";
import { organizationMembers } from "./tables/organization-members";

/**
 * Define relations between tables for Drizzle ORM queries
 */

export const organizationsRelations = relations(organizations, ({ many }) => ({
	members: many(organizationMembers),
}));

export const organizationMembersRelations = relations(
	organizationMembers,
	({ one }) => ({
		organization: one(organizations, {
			fields: [organizationMembers.organizationId],
			references: [organizations.id],
		}),
	}),
);
