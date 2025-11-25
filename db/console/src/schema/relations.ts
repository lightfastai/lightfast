import { relations } from "drizzle-orm";

import { workspaceKnowledgeDocuments } from "./tables/workspace-knowledge-documents";
import { workspaceSyncEvents } from "./tables/workspace-sync-events";
import { workspaceStores } from "./tables/workspace-stores";
import { workspaceKnowledgeVectorChunks } from "./tables/workspace-knowledge-vector-chunks";
import { orgWorkspaces } from "./tables/org-workspaces";

/**
 * Define relations between tables for Drizzle ORM queries
 *
 * Note: Organizations are managed by Clerk, not in our database.
 * Tables reference Clerk org IDs via clerkOrgId fields (no FK constraints).
 */

export const orgWorkspacesRelations = relations(orgWorkspaces, ({ many }) => ({
  stores: many(workspaceStores),
}));

export const workspaceStoresRelations = relations(workspaceStores, ({ one, many }) => ({
  workspace: one(orgWorkspaces, {
    fields: [workspaceStores.workspaceId],
    references: [orgWorkspaces.id],
  }),
  documents: many(workspaceKnowledgeDocuments),
  vectorChunks: many(workspaceKnowledgeVectorChunks),
  syncEvents: many(workspaceSyncEvents),
}));

export const workspaceKnowledgeDocumentsRelations = relations(workspaceKnowledgeDocuments, ({ one, many }) => ({
  store: one(workspaceStores, {
    fields: [workspaceKnowledgeDocuments.storeId],
    references: [workspaceStores.id],
  }),
  vectorChunks: many(workspaceKnowledgeVectorChunks),
}));

export const workspaceKnowledgeVectorChunksRelations = relations(workspaceKnowledgeVectorChunks, ({ one }) => ({
  store: one(workspaceStores, {
    fields: [workspaceKnowledgeVectorChunks.storeId],
    references: [workspaceStores.id],
  }),
  document: one(workspaceKnowledgeDocuments, {
    fields: [workspaceKnowledgeVectorChunks.docId],
    references: [workspaceKnowledgeDocuments.id],
  }),
}));

export const workspaceSyncEventsRelations = relations(workspaceSyncEvents, ({ one }) => ({
  store: one(workspaceStores, {
    fields: [workspaceSyncEvents.storeId],
    references: [workspaceStores.id],
  }),
}));
