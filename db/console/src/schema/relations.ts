import { relations } from "drizzle-orm";
import { gatewayInstallations } from "./tables/gateway-installations";
import { gatewayResources } from "./tables/gateway-resources";
import { gatewayTokens } from "./tables/gateway-tokens";
import { orgWorkspaces } from "./tables/org-workspaces";
import { workspaceEntityEdges } from "./tables/workspace-entity-edges";
import { workspaceEntities } from "./tables/workspace-entities";
import { workspaceEventEntities } from "./tables/workspace-event-entities";
import { workspaceEvents } from "./tables/workspace-events";
import { workspaceIntegrations } from "./tables/workspace-integrations";
import { workspaceUserActivities } from "./tables/workspace-user-activities";

/**
 * Define relations between tables for Drizzle ORM queries
 *
 * Note: Organizations are managed by Clerk, not in our database.
 * Tables reference Clerk org IDs via clerkOrgId fields (no FK constraints).
 */

// Gateway relations
export const gatewayInstallationsRelations = relations(
  gatewayInstallations,
  ({ many }) => ({
    tokens: many(gatewayTokens),
    resources: many(gatewayResources),
    workspaceIntegrations: many(workspaceIntegrations),
  })
);

export const gatewayTokensRelations = relations(gatewayTokens, ({ one }) => ({
  installation: one(gatewayInstallations, {
    fields: [gatewayTokens.installationId],
    references: [gatewayInstallations.id],
  }),
}));

export const gatewayResourcesRelations = relations(gatewayResources, ({ one }) => ({
  installation: one(gatewayInstallations, {
    fields: [gatewayResources.installationId],
    references: [gatewayInstallations.id],
  }),
}));

export const orgWorkspacesRelations = relations(orgWorkspaces, ({ many }) => ({
  events: many(workspaceEvents),
}));

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
    installation: one(gatewayInstallations, {
      fields: [workspaceIntegrations.installationId],
      references: [gatewayInstallations.id],
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
    entityEvents: many(workspaceEventEntities),
  })
);

// Entity-event junction relations
export const workspaceEventEntitiesRelations = relations(
  workspaceEventEntities,
  ({ one }) => ({
    entity: one(workspaceEntities, {
      fields: [workspaceEventEntities.entityId],
      references: [workspaceEntities.id],
    }),
    event: one(workspaceEvents, {
      fields: [workspaceEventEntities.eventId],
      references: [workspaceEvents.id],
    }),
    workspace: one(orgWorkspaces, {
      fields: [workspaceEventEntities.workspaceId],
      references: [orgWorkspaces.id],
    }),
  })
);

// Entity↔entity edges relations
export const workspaceEntityEdgesRelations = relations(workspaceEntityEdges, ({ one }) => ({
  workspace: one(orgWorkspaces, {
    fields: [workspaceEntityEdges.workspaceId],
    references: [orgWorkspaces.id],
  }),
  sourceEntity: one(workspaceEntities, {
    fields: [workspaceEntityEdges.sourceEntityId],
    references: [workspaceEntities.id],
  }),
  targetEntity: one(workspaceEntities, {
    fields: [workspaceEntityEdges.targetEntityId],
    references: [workspaceEntities.id],
  }),
  sourceEvent: one(workspaceEvents, {
    fields: [workspaceEntityEdges.sourceEventId],
    references: [workspaceEvents.id],
  }),
}));
