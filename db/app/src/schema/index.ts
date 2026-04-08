// Table schemas

// Relations for type-safe queries
export {
  gatewayInstallationsRelations,
  gatewayLifecycleLogsRelations,
  gatewayTokensRelations,
  orgEntityEdgesRelations,
  orgEventEntitiesRelations,
  orgEventsRelations,
  orgIntegrationsRelations,
} from "./relations";

// Re-exported types from tables
export type { WorkflowInput, WorkflowOutput } from "./tables";
export {
  type GatewayBackfillRun,
  type GatewayInstallation,
  type GatewayLifecycleLog,
  type GatewayToken,
  type GatewayWebhookDelivery,
  gatewayBackfillRuns,
  // Gateway-owned tables
  gatewayInstallations,
  gatewayLifecycleLogs,
  gatewayTokens,
  gatewayWebhookDeliveries,
  type InsertGatewayBackfillRun,
  type InsertGatewayInstallation,
  type InsertGatewayLifecycleLog,
  type InsertGatewayToken,
  type InsertGatewayWebhookDelivery,
  type InsertOrgApiKey,
  type InsertOrgEntity,
  type InsertOrgEntityEdge,
  type InsertOrgEvent,
  type InsertOrgEventEntity,
  type InsertOrgIngestLog,
  type InsertOrgIntegration,
  type InsertOrgRepoIndex,
  type InsertOrgUserActivity,
  type InsertOrgWorkflowRun,
  type OrgApiKey,
  type OrgEntity,
  type OrgEntityEdge,
  type OrgEvent,
  type OrgEventEntity,
  type OrgIngestLog,
  type OrgIntegration,
  type OrgRepoIndex,
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
  orgRepoIndexes,
  orgUserActivities,
  orgWorkflowRuns,
} from "./tables";
