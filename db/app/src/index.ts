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
  type GatewayLifecycleLog,
  type GatewayResource,
  type GatewayToken,
  type GatewayWebhookDelivery,
  gatewayBackfillRuns,
  // Gateway-owned tables
  gatewayInstallations,
  // Relations
  gatewayInstallationsRelations,
  gatewayLifecycleLogs,
  gatewayLifecycleLogsRelations,
  gatewayResources,
  gatewayResourcesRelations,
  gatewayTokens,
  gatewayTokensRelations,
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
  orgEntityEdgesRelations,
  orgEventEntities,
  orgEventEntitiesRelations,
  orgEvents,
  orgEventsRelations,
  orgIngestLogs,
  orgIntegrations,
  orgIntegrationsRelations,
  orgUserActivities,
  orgWorkflowRuns,
} from "./schema";

// Utilities
export { buildOrgNamespace } from "./utils/org";
export { generateStoreSlug, validateStoreSlug } from "./utils/org-names";
