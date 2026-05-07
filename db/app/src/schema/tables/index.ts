// Platform-owned tables (gateway_* prefix is historical)

export {
  type GatewayInstallation,
  gatewayInstallations,
  type InsertGatewayInstallation,
} from "./gateway-installations";
export {
  type GatewayLifecycleLog,
  gatewayLifecycleLogs,
  type InsertGatewayLifecycleLog,
} from "./gateway-lifecycle-log";
export {
  type GatewayToken,
  gatewayTokens,
  type InsertGatewayToken,
} from "./gateway-tokens";
export {
  type GatewayWebhookDelivery,
  gatewayWebhookDeliveries,
  type InsertGatewayWebhookDelivery,
} from "./gateway-webhook-deliveries";
// Organization API Keys (org-scoped authentication)
export {
  type InsertOrgApiKey,
  type OrgApiKey,
  orgApiKeys,
} from "./org-api-keys";
export {
  type InsertOrgIntegration,
  type OrgIntegration,
  orgIntegrations,
} from "./org-integrations";
export {
  type InsertOrgUserActivity,
  type OrgUserActivity,
  orgUserActivities,
} from "./org-user-activities";
export type { WorkflowInput, WorkflowOutput } from "./org-workflow-runs";
export {
  type InsertOrgWorkflowRun,
  type OrgWorkflowRun,
  orgWorkflowRuns,
} from "./org-workflow-runs";
