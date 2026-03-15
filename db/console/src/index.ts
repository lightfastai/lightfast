// Schema exports

// Client
export { db } from "./client";

// Re-exported types from schema
export type {
  GitHubSourceMetadata,
  WorkflowInput,
  WorkflowOutput,
} from "./schema";
export {
  type GatewayBackfillRun,
  type GatewayInstallation,
  type GatewayResource,
  type GatewayToken,
  type GatewayWebhookDelivery,
  gatewayBackfillRuns,
  // Gateway-owned tables
  gatewayInstallations,
  // Relations
  gatewayInstallationsRelations,
  gatewayResources,
  gatewayResourcesRelations,
  gatewayTokens,
  gatewayTokensRelations,
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
  orgWorkspacesRelations,
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
  workspaceEntityEdgesRelations,
  // Workspace entities
  workspaceEntities,
  // Entity-event junction
  workspaceEventEntities,
  workspaceEventEntitiesRelations,
  // Workspace events (neural observations)
  workspaceEvents,
  workspaceEventsRelations,
  // Workspace ingest log (raw webhook ingress log)
  workspaceIngestLogs,
  workspaceIntegrations,
  workspaceIntegrationsRelations,
  workspaceUserActivities,
  workspaceUserActivitiesRelations,
  workspaceWorkflowRuns,
} from "./schema";

// Utilities
export {
  buildWorkspaceNamespace,
  buildWorkspaceSettings,
  createCustomWorkspace,
  getWorkspaceKey,
} from "./utils/workspace";
export {
  generateRandomSlug,
  generateStoreSlug,
  generateWorkspaceName,
  validateStoreSlug,
  validateWorkspaceSlug,
} from "./utils/workspace-names";
