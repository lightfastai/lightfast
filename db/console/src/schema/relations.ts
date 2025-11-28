import { relations } from "drizzle-orm";

import { workspaceKnowledgeDocuments } from "./tables/workspace-knowledge-documents";
import { workspaceStores } from "./tables/workspace-stores";
import { workspaceKnowledgeVectorChunks } from "./tables/workspace-knowledge-vector-chunks";
import { workspaceUserActivities } from "./tables/workspace-user-activities";
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

export const workspaceUserActivitiesRelations = relations(workspaceUserActivities, ({ one }) => ({
  workspace: one(orgWorkspaces, {
    fields: [workspaceUserActivities.workspaceId],
    references: [orgWorkspaces.id],
  }),
  relatedActivity: one(workspaceUserActivities, {
    fields: [workspaceUserActivities.relatedActivityId],
    references: [workspaceUserActivities.id],
  }),
}));
