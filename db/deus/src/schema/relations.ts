import { relations } from "drizzle-orm";
import { organizations } from "./tables/organizations";
import { organizationMembers } from "./tables/organization-members";
import { DeusConnectedRepository } from "./tables/connected-repository";

/**
 * Define relations between tables for Drizzle ORM queries
 */

export const organizationsRelations = relations(organizations, ({ many }) => ({
	members: many(organizationMembers),
	repositories: many(DeusConnectedRepository),
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

export const deusConnectedRepositoryRelations = relations(
	DeusConnectedRepository,
	({ one }) => ({
		organization: one(organizations, {
			fields: [DeusConnectedRepository.organizationId],
			references: [organizations.id],
		}),
	}),
);
