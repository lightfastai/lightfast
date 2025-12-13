import { relations } from "drizzle-orm";

import { workspaceKnowledgeDocuments } from "./tables/workspace-knowledge-documents";
import { workspaceKnowledgeVectorChunks } from "./tables/workspace-knowledge-vector-chunks";
import { workspaceUserActivities } from "./tables/workspace-user-activities";
import { workspaceIntegrations } from "./tables/workspace-integrations";
import { userSources } from "./tables/user-sources";
import { orgWorkspaces } from "./tables/org-workspaces";
import { workspaceNeuralObservations } from "./tables/workspace-neural-observations";
import { workspaceObservationClusters } from "./tables/workspace-observation-clusters";
import { workspaceActorProfiles } from "./tables/workspace-actor-profiles";
import { workspaceActorIdentities } from "./tables/workspace-actor-identities";
import { workspaceTemporalStates } from "./tables/workspace-temporal-states";

/**
 * Define relations between tables for Drizzle ORM queries
 *
 * Note: Organizations are managed by Clerk, not in our database.
 * Tables reference Clerk org IDs via clerkOrgId fields (no FK constraints).
 */

export const orgWorkspacesRelations = relations(orgWorkspaces, ({ many }) => ({
  documents: many(workspaceKnowledgeDocuments),
  vectorChunks: many(workspaceKnowledgeVectorChunks),
  neuralObservations: many(workspaceNeuralObservations),
  observationClusters: many(workspaceObservationClusters),
  actorProfiles: many(workspaceActorProfiles),
  actorIdentities: many(workspaceActorIdentities),
  temporalStates: many(workspaceTemporalStates),
}));

export const workspaceKnowledgeDocumentsRelations = relations(workspaceKnowledgeDocuments, ({ one, many }) => ({
  workspace: one(orgWorkspaces, {
    fields: [workspaceKnowledgeDocuments.workspaceId],
    references: [orgWorkspaces.id],
  }),
  vectorChunks: many(workspaceKnowledgeVectorChunks),
}));

export const workspaceKnowledgeVectorChunksRelations = relations(workspaceKnowledgeVectorChunks, ({ one }) => ({
  workspace: one(orgWorkspaces, {
    fields: [workspaceKnowledgeVectorChunks.workspaceId],
    references: [orgWorkspaces.id],
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

export const workspaceIntegrationsRelations = relations(workspaceIntegrations, ({ one }) => ({
  workspace: one(orgWorkspaces, {
    fields: [workspaceIntegrations.workspaceId],
    references: [orgWorkspaces.id],
  }),
  userSource: one(userSources, {
    fields: [workspaceIntegrations.userSourceId],
    references: [userSources.id],
  }),
}));

export const workspaceNeuralObservationsRelations = relations(
  workspaceNeuralObservations,
  ({ one }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceNeuralObservations.workspaceId],
      references: [orgWorkspaces.id],
    }),
    cluster: one(workspaceObservationClusters, {
      fields: [workspaceNeuralObservations.clusterId],
      references: [workspaceObservationClusters.id],
    }),
  }),
);

export const workspaceObservationClustersRelations = relations(
  workspaceObservationClusters,
  ({ one, many }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceObservationClusters.workspaceId],
      references: [orgWorkspaces.id],
    }),
    observations: many(workspaceNeuralObservations),
  }),
);

// Actor Profile relations
export const workspaceActorProfilesRelations = relations(
  workspaceActorProfiles,
  ({ one, many }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceActorProfiles.workspaceId],
      references: [orgWorkspaces.id],
    }),
    identities: many(workspaceActorIdentities),
  }),
);

export const workspaceActorIdentitiesRelations = relations(
  workspaceActorIdentities,
  ({ one }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceActorIdentities.workspaceId],
      references: [orgWorkspaces.id],
    }),
  }),
);

// Temporal states relation
export const workspaceTemporalStatesRelations = relations(
  workspaceTemporalStates,
  ({ one }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceTemporalStates.workspaceId],
      references: [orgWorkspaces.id],
    }),
  }),
);
