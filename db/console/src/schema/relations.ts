import { relations } from "drizzle-orm";
import { gwInstallations } from "./tables/gw-installations";
import { gwResources } from "./tables/gw-resources";
import { gwTokens } from "./tables/gw-tokens";
import { orgWorkspaces } from "./tables/org-workspaces";
import { workspaceEntityObservations } from "./tables/workspace-entity-observations";
import { workspaceIntegrations } from "./tables/workspace-integrations";
import { workspaceKnowledgeDocuments } from "./tables/workspace-knowledge-documents";
import { workspaceKnowledgeVectorChunks } from "./tables/workspace-knowledge-vector-chunks";
import { workspaceNeuralEntities } from "./tables/workspace-neural-entities";
import { workspaceNeuralObservations } from "./tables/workspace-neural-observations";
import { workspaceObservationInterpretations } from "./tables/workspace-observation-interpretations";
import { workspaceObservationRelationships } from "./tables/workspace-observation-relationships";
import { workspaceUserActivities } from "./tables/workspace-user-activities";

/**
 * Define relations between tables for Drizzle ORM queries
 *
 * Note: Organizations are managed by Clerk, not in our database.
 * Tables reference Clerk org IDs via clerkOrgId fields (no FK constraints).
 */

// Gateway relations
export const gwInstallationsRelations = relations(
  gwInstallations,
  ({ many }) => ({
    tokens: many(gwTokens),
    resources: many(gwResources),
    workspaceIntegrations: many(workspaceIntegrations),
  })
);

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
}));

export const workspaceKnowledgeDocumentsRelations = relations(
  workspaceKnowledgeDocuments,
  ({ one, many }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceKnowledgeDocuments.workspaceId],
      references: [orgWorkspaces.id],
    }),
    vectorChunks: many(workspaceKnowledgeVectorChunks),
  })
);

export const workspaceKnowledgeVectorChunksRelations = relations(
  workspaceKnowledgeVectorChunks,
  ({ one }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceKnowledgeVectorChunks.workspaceId],
      references: [orgWorkspaces.id],
    }),
    document: one(workspaceKnowledgeDocuments, {
      fields: [workspaceKnowledgeVectorChunks.docId],
      references: [workspaceKnowledgeDocuments.id],
    }),
  })
);

export const workspaceUserActivitiesRelations = relations(
  workspaceUserActivities,
  ({ one }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceUserActivities.workspaceId],
      references: [orgWorkspaces.id],
    }),
    relatedActivity: one(workspaceUserActivities, {
      fields: [workspaceUserActivities.relatedActivityId],
      references: [workspaceUserActivities.id],
    }),
  })
);

export const workspaceIntegrationsRelations = relations(
  workspaceIntegrations,
  ({ one }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceIntegrations.workspaceId],
      references: [orgWorkspaces.id],
    }),
    installation: one(gwInstallations, {
      fields: [workspaceIntegrations.installationId],
      references: [gwInstallations.id],
    }),
  })
);

export const workspaceNeuralObservationsRelations = relations(
  workspaceNeuralObservations,
  ({ one, many }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceNeuralObservations.workspaceId],
      references: [orgWorkspaces.id],
    }),
    interpretations: many(workspaceObservationInterpretations),
    entityObservations: many(workspaceEntityObservations),
  })
);

// Interpretation relations
export const workspaceObservationInterpretationsRelations = relations(
  workspaceObservationInterpretations,
  ({ one }) => ({
    observation: one(workspaceNeuralObservations, {
      fields: [workspaceObservationInterpretations.observationId],
      references: [workspaceNeuralObservations.id],
    }),
    workspace: one(orgWorkspaces, {
      fields: [workspaceObservationInterpretations.workspaceId],
      references: [orgWorkspaces.id],
    }),
  })
);

// Entity-observation junction relations
export const workspaceEntityObservationsRelations = relations(
  workspaceEntityObservations,
  ({ one }) => ({
    entity: one(workspaceNeuralEntities, {
      fields: [workspaceEntityObservations.entityId],
      references: [workspaceNeuralEntities.id],
    }),
    observation: one(workspaceNeuralObservations, {
      fields: [workspaceEntityObservations.observationId],
      references: [workspaceNeuralObservations.id],
    }),
    workspace: one(orgWorkspaces, {
      fields: [workspaceEntityObservations.workspaceId],
      references: [orgWorkspaces.id],
    }),
  })
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
  })
);
