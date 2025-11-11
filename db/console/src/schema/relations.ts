import { relations } from "drizzle-orm";

import { DeusConnectedRepository } from "./tables/connected-repository";
import { docsDocuments } from "./tables/docs-documents";
import { ingestionCommits } from "./tables/ingestion-commits";
import { organizations } from "./tables/organizations";
import { storeRepositories } from "./tables/store-repositories";
import { stores } from "./tables/stores";
import { vectorEntries } from "./tables/vector-entries";
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
  stores: many(stores),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [stores.workspaceId],
    references: [workspaces.id],
  }),
  documents: many(docsDocuments),
  vectorEntries: many(vectorEntries),
  ingestionCommits: many(ingestionCommits),
  repositories: many(storeRepositories),
}));

export const docsDocumentsRelations = relations(docsDocuments, ({ one, many }) => ({
  store: one(stores, {
    fields: [docsDocuments.storeId],
    references: [stores.id],
  }),
  vectorEntries: many(vectorEntries),
}));

export const vectorEntriesRelations = relations(vectorEntries, ({ one }) => ({
  store: one(stores, {
    fields: [vectorEntries.storeId],
    references: [stores.id],
  }),
  document: one(docsDocuments, {
    fields: [vectorEntries.docId],
    references: [docsDocuments.id],
  }),
}));

export const ingestionCommitsRelations = relations(ingestionCommits, ({ one }) => ({
  store: one(stores, {
    fields: [ingestionCommits.storeId],
    references: [stores.id],
  }),
}));

export const storeRepositoriesRelations = relations(storeRepositories, ({ one }) => ({
  store: one(stores, {
    fields: [storeRepositories.storeId],
    references: [stores.id],
  }),
}));
