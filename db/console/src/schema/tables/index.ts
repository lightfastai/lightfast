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
export {
  type InsertOrgActorIdentity,
  type OrgActorIdentity,
  orgActorIdentities,
} from "./org-actor-identities";

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
export {
  type InsertWorkspaceActorProfile,
  type WorkspaceActorProfile,
  workspaceActorProfiles,
} from "./workspace-actor-profiles";
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
export {
  type InsertWorkspaceObservationCluster,
  type WorkspaceObservationCluster,
  workspaceObservationClusters,
} from "./workspace-observation-clusters";
export type { RelationshipMetadata } from "./workspace-observation-relationships";
// Relationship graph tables
export {
  type InsertWorkspaceObservationRelationship,
  type RelationshipType,
  type WorkspaceObservationRelationship,
  workspaceObservationRelationships,
} from "./workspace-observation-relationships";
export type {
  ActorResolutionTags,
  ClusterAffinityTags,
  ClusterTags,
  DocumentsIndexedTags,
  EntityExtractionTags,
  ErrorTags,
  JobDurationTags,
  NeuralObservationTags,
  ProfileUpdateTags,
} from "./workspace-operations-metrics";
export {
  type InsertWorkspaceOperationMetric,
  type OperationMetricTags,
  type WorkspaceOperationMetric,
  workspaceOperationsMetrics,
} from "./workspace-operations-metrics";
export type {
  TemporalEntityType,
  TemporalStateType,
} from "./workspace-temporal-states";
export {
  type InsertWorkspaceTemporalState,
  type WorkspaceTemporalState,
  workspaceTemporalStates,
} from "./workspace-temporal-states";
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
