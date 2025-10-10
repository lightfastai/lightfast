import { relations } from "drizzle-orm";

import { DeusApiKey } from "./tables/api-key";
import { DeusCodeReviewTask } from "./tables/code-review-tasks";
import { DeusCodeReview } from "./tables/code-reviews";
import { DeusConnectedRepository } from "./tables/connected-repository";
import { DeusMessage } from "./tables/message";
import { organizations } from "./tables/organizations";
import { DeusSession } from "./tables/session";

/**
 * Define relations between tables for Drizzle ORM queries
 *
 * Note: Organization memberships are managed by Clerk, not in our database.
 */

export const organizationsRelations = relations(organizations, ({ many }) => ({
  repositories: many(DeusConnectedRepository),
  apiKeys: many(DeusApiKey),
  sessions: many(DeusSession),
}));

export const deusConnectedRepositoryRelations = relations(
  DeusConnectedRepository,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [DeusConnectedRepository.organizationId],
      references: [organizations.id],
    }),
    codeReviews: many(DeusCodeReview),
    sessions: many(DeusSession),
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

export const deusApiKeyRelations = relations(DeusApiKey, ({ one }) => ({
  organization: one(organizations, {
    fields: [DeusApiKey.organizationId],
    references: [organizations.id],
  }),
}));

export const deusSessionRelations = relations(DeusSession, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [DeusSession.organizationId],
    references: [organizations.id],
  }),
  repository: one(DeusConnectedRepository, {
    fields: [DeusSession.repositoryId],
    references: [DeusConnectedRepository.id],
  }),
  messages: many(DeusMessage),
}));

export const deusMessageRelations = relations(DeusMessage, ({ one }) => ({
  session: one(DeusSession, {
    fields: [DeusMessage.sessionId],
    references: [DeusSession.id],
  }),
}));
