// Gateway-owned tables (gw_*)

export {
  type GwBackfillRun,
  gwBackfillRuns,
  type InsertGwBackfillRun,
} from "./gw-backfill-runs";
export {
  type GwInstallation,
  gwInstallations,
  type InsertGwInstallation,
} from "./gw-installations";
export {
  type GwResource,
  gwResources,
  type InsertGwResource,
} from "./gw-resources";
export { type GwToken, gwTokens, type InsertGwToken } from "./gw-tokens";
export {
  type GwWebhookDelivery,
  gwWebhookDeliveries,
  type InsertGwWebhookDelivery,
} from "./gw-webhook-deliveries";
// Organization API Keys (org-scoped authentication)
export {
  type InsertOrgApiKey,
  type OrgApiKey,
  orgApiKeys,
} from "./org-api-keys";
// Org-scoped tables
export {
  type InsertOrgWorkspace,
  type OrgWorkspace,
  orgWorkspaces,
} from "./org-workspaces";
// Entity↔entity edges
export {
  type InsertWorkspaceEdge,
  type WorkspaceEdge,
  workspaceEdges,
} from "./workspace-edges";
// Workspace entities
export {
  type InsertWorkspaceEntity,
  type WorkspaceEntity,
  workspaceEntities,
} from "./workspace-entities";
// Entity-event junction
export {
  type InsertWorkspaceEntityEvent,
  type WorkspaceEntityEvent,
  workspaceEntityEvents,
} from "./workspace-entity-events";
// Workspace events (neural observations)
export type {
  ObservationActor,
  ObservationMetadata,
  ObservationReference,
} from "./workspace-events";
export {
  type InsertWorkspaceEvent,
  type WorkspaceEvent,
  workspaceEvents,
} from "./workspace-events";
// Workspace ingest log (raw webhook ingress log)
export {
  type InsertWorkspaceIngestLogEntry,
  type WorkspaceIngestLogEntry,
  workspaceIngestLog,
} from "./workspace-ingest-log";
export {
  type InsertWorkspaceIntegration,
  type WorkspaceIntegration,
  workspaceIntegrations,
} from "./workspace-integrations";
// Interpretations table
export {
  type InsertWorkspaceInterpretation,
  type WorkspaceInterpretation,
  workspaceInterpretations,
} from "./workspace-interpretations";
// Workspace-scoped tables
export {
  type InsertWorkspaceKnowledgeDocument,
  type WorkspaceKnowledgeDocument,
  workspaceKnowledgeDocuments,
} from "./workspace-knowledge-documents";
export {
  type InsertWorkspaceKnowledgeVectorChunk,
  type WorkspaceKnowledgeVectorChunk,
  workspaceKnowledgeVectorChunks,
} from "./workspace-knowledge-vector-chunks";
export {
  type InsertWorkspaceUserActivity,
  type WorkspaceUserActivity,
  workspaceUserActivities,
} from "./workspace-user-activities";
export type {
  GitHubSourceMetadata,
  WorkflowInput,
  WorkflowOutput,
} from "./workspace-workflow-runs";
export {
  type InsertWorkspaceWorkflowRun,
  type WorkspaceWorkflowRun,
  workspaceWorkflowRuns,
} from "./workspace-workflow-runs";
