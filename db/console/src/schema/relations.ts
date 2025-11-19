import { relations } from "drizzle-orm";

import { DeusConnectedRepository } from "./tables/connected-repository";
import { connectedSources } from "./tables/connected-sources";
import { docsDocuments } from "./tables/docs-documents";
import { ingestionEvents } from "./tables/ingestion-events";
import { stores } from "./tables/stores";
import { vectorEntries } from "./tables/vector-entries";
import { workspaces } from "./tables/workspaces";
// Sessions removed

/**
 * Define relations between tables for Drizzle ORM queries
 *
 * Note: Organizations are managed by Clerk, not in our database.
 * Tables reference Clerk org IDs via clerkOrgId fields (no FK constraints).
 */

export const deusConnectedRepositoryRelations = relations(
  DeusConnectedRepository,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [DeusConnectedRepository.workspaceId],
      references: [workspaces.id],
    }),
    // code reviews and sessions removed
  }),
);

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  repositories: many(DeusConnectedRepository),
  stores: many(stores),
  connectedSources: many(connectedSources),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [stores.workspaceId],
    references: [workspaces.id],
  }),
  documents: many(docsDocuments),
  vectorEntries: many(vectorEntries),
  ingestionEvents: many(ingestionEvents),
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

export const ingestionEventsRelations = relations(ingestionEvents, ({ one }) => ({
  store: one(stores, {
    fields: [ingestionEvents.storeId],
    references: [stores.id],
  }),
}));

export const connectedSourcesRelations = relations(connectedSources, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [connectedSources.workspaceId],
    references: [workspaces.id],
  }),
}));
