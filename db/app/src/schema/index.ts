// Table schemas

// Relations for type-safe queries
export {
  gatewayInstallationsRelations,
  gatewayLifecycleLogsRelations,
  gatewayTokensRelations,
  orgIntegrationsRelations,
} from "./relations";

// Re-exported types from tables
export type { WorkflowInput, WorkflowOutput } from "./tables";
export {
  type GatewayInstallation,
  type GatewayLifecycleLog,
  type GatewayToken,
  type GatewayWebhookDelivery,
  // Gateway-owned tables
  gatewayInstallations,
  gatewayLifecycleLogs,
  gatewayTokens,
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
  orgUserActivities,
  orgWorkflowRuns,
} from "./tables";
