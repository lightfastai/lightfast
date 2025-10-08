import { relations } from "drizzle-orm";
import { organizations } from "./tables/organizations";
import { organizationMembers } from "./tables/organization-members";
import { DeusConnectedRepository } from "./tables/connected-repository";
import { DeusCodeReview } from "./tables/code-reviews";
import { DeusCodeReviewTask } from "./tables/code-review-tasks";

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
	({ one, many }) => ({
		organization: one(organizations, {
			fields: [DeusConnectedRepository.organizationId],
			references: [organizations.id],
		}),
		codeReviews: many(DeusCodeReview),
	}),
);

export const deusCodeReviewRelations = relations(
	DeusCodeReview,
	({ one, many }) => ({
		repository: one(DeusConnectedRepository, {
			fields: [DeusCodeReview.repositoryId],
			references: [DeusConnectedRepository.id],
		}),
		tasks: many(DeusCodeReviewTask),
	}),
);

export const deusCodeReviewTaskRelations = relations(
	DeusCodeReviewTask,
	({ one }) => ({
		codeReview: one(DeusCodeReview, {
			fields: [DeusCodeReviewTask.codeReviewId],
			references: [DeusCodeReview.id],
		}),
	}),
);
