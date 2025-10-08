import { relations } from "drizzle-orm";
import { organizations } from "./tables/organizations";
import { DeusConnectedRepository } from "./tables/connected-repository";
import { DeusCodeReview } from "./tables/code-reviews";
import { DeusCodeReviewTask } from "./tables/code-review-tasks";

/**
 * Define relations between tables for Drizzle ORM queries
 *
 * Note: Organization memberships are managed by Clerk, not in our database.
 */

export const organizationsRelations = relations(organizations, ({ many }) => ({
	repositories: many(DeusConnectedRepository),
}));

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
