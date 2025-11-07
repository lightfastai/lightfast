import { relations } from "drizzle-orm";

import { DeusConnectedRepository } from "./tables/connected-repository";
import { organizations } from "./tables/organizations";
import { workspaces } from "./tables/workspaces";
// Sessions removed

/**
 * Define relations between tables for Drizzle ORM queries
 *
 * Note: Organization memberships are managed by Clerk, not in our database.
 */

export const organizationsRelations = relations(organizations, ({ many }) => ({
  repositories: many(DeusConnectedRepository),
  workspaces: many(workspaces),
}));

export const deusConnectedRepositoryRelations = relations(
  DeusConnectedRepository,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [DeusConnectedRepository.organizationId],
      references: [organizations.id],
    }),
    workspace: one(workspaces, {
      fields: [DeusConnectedRepository.workspaceId],
      references: [workspaces.id],
    }),
    // code reviews and sessions removed
  }),
);

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workspaces.organizationId],
    references: [organizations.id],
  }),
  repositories: many(DeusConnectedRepository),
}));
