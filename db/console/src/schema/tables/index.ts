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
// Entity-observation junction
export {
  type InsertWorkspaceEntityObservation,
  type WorkspaceEntityObservation,
  workspaceEntityObservations,
} from "./workspace-entity-observations";
// Workspace event storage
export {
  type InsertWorkspaceEvent,
  type WorkspaceEvent,
  workspaceEvents,
} from "./workspace-events";
export {
  type InsertWorkspaceIntegration,
  type WorkspaceIntegration,
  workspaceIntegrations,
} from "./workspace-integrations";
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
  type InsertWorkspaceNeuralEntity,
  type WorkspaceNeuralEntity,
  workspaceNeuralEntities,
} from "./workspace-neural-entities";
export type {
  ObservationActor,
  ObservationMetadata,
  ObservationReference,
} from "./workspace-neural-observations";
// Neural memory tables
export {
  type InsertWorkspaceNeuralObservation,
  type WorkspaceNeuralObservation,
  workspaceNeuralObservations,
} from "./workspace-neural-observations";
// Interpretation table
export {
  type InsertWorkspaceObservationInterpretation,
  type WorkspaceObservationInterpretation,
  workspaceObservationInterpretations,
} from "./workspace-observation-interpretations";
export type { RelationshipMetadata } from "./workspace-observation-relationships";
// Relationship graph tables
export {
  type InsertWorkspaceObservationRelationship,
  type RelationshipType,
  type WorkspaceObservationRelationship,
  workspaceObservationRelationships,
} from "./workspace-observation-relationships";
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
