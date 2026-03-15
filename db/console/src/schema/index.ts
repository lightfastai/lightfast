// Table schemas

// Relations for type-safe queries
export {
  gatewayInstallationsRelations,
  gatewayResourcesRelations,
  gatewayTokensRelations,
  orgWorkspacesRelations,
  workspaceEntityEdgesRelations,
  workspaceEventEntitiesRelations,
  workspaceEventsRelations,
  workspaceIntegrationsRelations,
  workspaceUserActivitiesRelations,
} from "./relations";

// Re-exported types from tables
export type {
  GitHubSourceMetadata,
  WorkflowInput,
  WorkflowOutput,
} from "./tables";
export {
  type GatewayBackfillRun,
  type GatewayInstallation,
  type GatewayResource,
  type GatewayToken,
  type GatewayWebhookDelivery,
  gatewayBackfillRuns,
  // Gateway-owned tables
  gatewayInstallations,
  gatewayResources,
  gatewayTokens,
  gatewayWebhookDeliveries,
  type InsertGatewayBackfillRun,
  type InsertGatewayInstallation,
  type InsertGatewayResource,
  type InsertGatewayToken,
  type InsertGatewayWebhookDelivery,
  type InsertOrgApiKey,
  type InsertOrgWorkspace,
  type InsertWorkspaceEntityEdge,
  type InsertWorkspaceEntity,
  type InsertWorkspaceEventEntity,
  type InsertWorkspaceEvent,
  type InsertWorkspaceIngestLog,
  type InsertWorkspaceIntegration,
  type InsertWorkspaceUserActivity,
  type InsertWorkspaceWorkflowRun,
  type OrgApiKey,
  type OrgWorkspace,
  orgApiKeys,
  // Org-scoped tables
  orgWorkspaces,
  type WorkspaceEntityEdge,
  type WorkspaceEntity,
  type WorkspaceEventEntity,
  type WorkspaceEvent,
  type WorkspaceIngestLog,
  type WorkspaceIntegration,
  type WorkspaceUserActivity,
  type WorkspaceWorkflowRun,
  // Entity↔entity edges
  workspaceEntityEdges,
  // Workspace entities
  workspaceEntities,
  // Entity-event junction
  workspaceEventEntities,
  // Workspace events (neural observations)
  workspaceEvents,
  // Workspace ingest log (raw webhook ingress log)
  workspaceIngestLogs,
  workspaceIntegrations,
  workspaceUserActivities,
  workspaceWorkflowRuns,
} from "./tables";
