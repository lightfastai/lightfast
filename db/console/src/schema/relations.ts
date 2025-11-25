import { relations } from "drizzle-orm";

import { docsDocuments } from "./tables/docs-documents";
import { ingestionEvents } from "./tables/ingestion-events";
import { stores } from "./tables/stores";
import { vectorEntries } from "./tables/vector-entries";
import { workspaces } from "./tables/workspaces";

/**
 * Define relations between tables for Drizzle ORM queries
 *
 * Note: Organizations are managed by Clerk, not in our database.
 * Tables reference Clerk org IDs via clerkOrgId fields (no FK constraints).
 */

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  stores: many(stores),
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
