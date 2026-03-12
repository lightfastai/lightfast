import { relations } from "drizzle-orm";
import { gwInstallations } from "./tables/gw-installations";
import { gwResources } from "./tables/gw-resources";
import { gwTokens } from "./tables/gw-tokens";
import { orgWorkspaces } from "./tables/org-workspaces";
import { workspaceEdges } from "./tables/workspace-edges";
import { workspaceEntities } from "./tables/workspace-entities";
import { workspaceEntityEvents } from "./tables/workspace-entity-events";
import { workspaceEvents } from "./tables/workspace-events";
import { workspaceIntegrations } from "./tables/workspace-integrations";
import { workspaceInterpretations } from "./tables/workspace-interpretations";
import { workspaceKnowledgeDocuments } from "./tables/workspace-knowledge-documents";
import { workspaceKnowledgeVectorChunks } from "./tables/workspace-knowledge-vector-chunks";
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
  events: many(workspaceEvents),
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

export const workspaceEventsRelations = relations(
  workspaceEvents,
  ({ one, many }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceEvents.workspaceId],
      references: [orgWorkspaces.id],
    }),
    interpretations: many(workspaceInterpretations),
    entityEvents: many(workspaceEntityEvents),
  })
);

// Interpretation relations
export const workspaceInterpretationsRelations = relations(
  workspaceInterpretations,
  ({ one }) => ({
    event: one(workspaceEvents, {
      fields: [workspaceInterpretations.eventId],
      references: [workspaceEvents.id],
    }),
    workspace: one(orgWorkspaces, {
      fields: [workspaceInterpretations.workspaceId],
      references: [orgWorkspaces.id],
    }),
  })
);

// Entity-event junction relations
export const workspaceEntityEventsRelations = relations(
  workspaceEntityEvents,
  ({ one }) => ({
    entity: one(workspaceEntities, {
      fields: [workspaceEntityEvents.entityId],
      references: [workspaceEntities.id],
    }),
    event: one(workspaceEvents, {
      fields: [workspaceEntityEvents.eventId],
      references: [workspaceEvents.id],
    }),
    workspace: one(orgWorkspaces, {
      fields: [workspaceEntityEvents.workspaceId],
      references: [orgWorkspaces.id],
    }),
  })
);

// Entity↔entity edges relations
export const workspaceEdgesRelations = relations(workspaceEdges, ({ one }) => ({
  workspace: one(orgWorkspaces, {
    fields: [workspaceEdges.workspaceId],
    references: [orgWorkspaces.id],
  }),
  sourceEntity: one(workspaceEntities, {
    fields: [workspaceEdges.sourceEntityId],
    references: [workspaceEntities.id],
  }),
  targetEntity: one(workspaceEntities, {
    fields: [workspaceEdges.targetEntityId],
    references: [workspaceEntities.id],
  }),
  sourceEvent: one(workspaceEvents, {
    fields: [workspaceEdges.sourceEventId],
    references: [workspaceEvents.id],
  }),
}));
