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
import { orgActorIdentities } from "./tables/org-actor-identities";
import { workspaceTemporalStates } from "./tables/workspace-temporal-states";
import { workspaceObservationRelationships } from "./tables/workspace-observation-relationships";
import { gwInstallations } from "./tables/gw-installations";
import { gwTokens } from "./tables/gw-tokens";
import { gwResources } from "./tables/gw-resources";

/**
 * Define relations between tables for Drizzle ORM queries
 *
 * Note: Organizations are managed by Clerk, not in our database.
 * Tables reference Clerk org IDs via clerkOrgId fields (no FK constraints).
 */

// Gateway relations
export const gwInstallationsRelations = relations(gwInstallations, ({ many }) => ({
  tokens: many(gwTokens),
  resources: many(gwResources),
}));

export const gwTokensRelations = relations(gwTokens, ({ one }) => ({
  installation: one(gwInstallations, {
    fields: [gwTokens.installationId],
    references: [gwInstallations.id],
  }),
}));

export const gwResourcesRelations = relations(gwResources, ({ one }) => ({
  installation: one(gwInstallations, {
    fields: [gwResources.installationId],
    references: [gwInstallations.id],
  }),
}));

export const orgWorkspacesRelations = relations(orgWorkspaces, ({ many }) => ({
  documents: many(workspaceKnowledgeDocuments),
  vectorChunks: many(workspaceKnowledgeVectorChunks),
  neuralObservations: many(workspaceNeuralObservations),
  observationClusters: many(workspaceObservationClusters),
  actorProfiles: many(workspaceActorProfiles),
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
  ({ one }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceActorProfiles.workspaceId],
      references: [orgWorkspaces.id],
    }),
    // Note: identities relation removed - now using org-level orgActorIdentities
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

// Org-level actor identities relation
// No direct FK to orgWorkspaces - clerkOrgId is a logical reference to Clerk
export const orgActorIdentitiesRelations = relations(
  orgActorIdentities,
  () => ({
    // No direct FK relations - clerkOrgId references Clerk org (external)
    // canonicalActorId links logically to workspaceActorProfiles.actorId
  }),
);

// Workspace observation relationships - edges in the relationship graph
export const workspaceObservationRelationshipsRelations = relations(
  workspaceObservationRelationships,
  ({ one }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceObservationRelationships.workspaceId],
      references: [orgWorkspaces.id],
    }),
    sourceObservation: one(workspaceNeuralObservations, {
      fields: [workspaceObservationRelationships.sourceObservationId],
      references: [workspaceNeuralObservations.id],
    }),
    targetObservation: one(workspaceNeuralObservations, {
      fields: [workspaceObservationRelationships.targetObservationId],
      references: [workspaceNeuralObservations.id],
    }),
  }),
);
