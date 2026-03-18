// Table schemas

// Relations for type-safe queries
export {
  gatewayInstallationsRelations,
  gatewayLifecycleLogsRelations,
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
  type GatewayLifecycleLog,
  type GatewayResource,
  type GatewayToken,
  type GatewayWebhookDelivery,
  gatewayBackfillRuns,
  // Gateway-owned tables
  gatewayInstallations,
  gatewayLifecycleLogs,
  gatewayResources,
  gatewayTokens,
  gatewayWebhookDeliveries,
  type InsertGatewayBackfillRun,
  type InsertGatewayInstallation,
  type InsertGatewayLifecycleLog,
  type InsertGatewayResource,
  type InsertGatewayToken,
  type InsertGatewayWebhookDelivery,
  type InsertOrgApiKey,
  type InsertOrgWorkspace,
  type InsertWorkspaceEntity,
  type InsertWorkspaceEntityEdge,
  type InsertWorkspaceEvent,
  type InsertWorkspaceEventEntity,
  type InsertWorkspaceIngestLog,
  type InsertWorkspaceIntegration,
  type InsertWorkspaceUserActivity,
  type InsertWorkspaceWorkflowRun,
  type OrgApiKey,
  type OrgWorkspace,
  orgApiKeys,
  // Org-scoped tables
  orgWorkspaces,
  type WorkspaceEntity,
  type WorkspaceEntityEdge,
  type WorkspaceEvent,
  type WorkspaceEventEntity,
  type WorkspaceIngestLog,
  type WorkspaceIntegration,
  type WorkspaceUserActivity,
  type WorkspaceWorkflowRun,
  // Workspace entities
  workspaceEntities,
  // Entity↔entity edges
  workspaceEntityEdges,
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
