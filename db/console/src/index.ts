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
  orgWorkspacesRelations,
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
  workspaceEntityEdgesRelations,
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
