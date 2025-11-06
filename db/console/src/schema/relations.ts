import { relations } from "drizzle-orm";

import { DeusConnectedRepository } from "./tables/connected-repository";
import { organizations } from "./tables/organizations";
// Sessions removed

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
  ({ one }) => ({
    organization: one(organizations, {
      fields: [DeusConnectedRepository.organizationId],
      references: [organizations.id],
    }),
    // code reviews and sessions removed
  }),
);
