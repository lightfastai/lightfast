// Schema exports

// Client
export { db } from "./client";

// Re-exported types from schema
export type { WorkflowInput, WorkflowOutput } from "./schema";
export {
  type GatewayInstallation,
  type GatewayLifecycleLog,
  type GatewayToken,
  type GatewayWebhookDelivery,
  // Gateway-owned tables
  gatewayInstallations,
  // Relations
  gatewayInstallationsRelations,
  gatewayLifecycleLogs,
  gatewayLifecycleLogsRelations,
  gatewayTokens,
  gatewayTokensRelations,
  gatewayWebhookDeliveries,
  type InsertGatewayInstallation,
  type InsertGatewayLifecycleLog,
  type InsertGatewayToken,
  type InsertGatewayWebhookDelivery,
  type InsertOrgApiKey,
  type InsertOrgIntegration,
  type InsertOrgUserActivity,
  type InsertOrgWorkflowRun,
  type OrgApiKey,
  type OrgIntegration,
  type OrgUserActivity,
  type OrgWorkflowRun,
  orgApiKeys,
  orgIntegrations,
  orgIntegrationsRelations,
  orgUserActivities,
  orgWorkflowRuns,
} from "./schema";

// Utilities
export { buildOrgNamespace } from "./utils/org";
