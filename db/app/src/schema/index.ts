// Table schemas

// Relations for type-safe queries
export {
  gatewayInstallationsRelations,
  gatewayLifecycleLogsRelations,
  gatewayResourcesRelations,
  gatewayTokensRelations,
  orgEntityEdgesRelations,
  orgEventEntitiesRelations,
  orgEventsRelations,
  orgIntegrationsRelations,
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
  type InsertOrgEntity,
  type InsertOrgEntityEdge,
  type InsertOrgEvent,
  type InsertOrgEventEntity,
  type InsertOrgIngestLog,
  type InsertOrgIntegration,
  type InsertOrgUserActivity,
  type InsertOrgWorkflowRun,
  type OrgApiKey,
  type OrgEntity,
  type OrgEntityEdge,
  type OrgEvent,
  type OrgEventEntity,
  type OrgIngestLog,
  type OrgIntegration,
  type OrgUserActivity,
  type OrgWorkflowRun,
  orgApiKeys,
  // Org-scoped tables
  orgEntities,
  orgEntityEdges,
  orgEventEntities,
  orgEvents,
  orgIngestLogs,
  orgIntegrations,
  orgUserActivities,
  orgWorkflowRuns,
} from "./tables";
