// Schema exports
export {
  // Gateway-owned tables
  gwInstallations, type GwInstallation, type InsertGwInstallation,
  gwTokens, type GwToken, type InsertGwToken,
  gwResources, type GwResource, type InsertGwResource,
  gwWebhookDeliveries, type GwWebhookDelivery, type InsertGwWebhookDelivery,
  // User-scoped tables
  userApiKeys, type UserApiKey, type InsertUserApiKey,
  // Org-scoped tables
  orgWorkspaces, type OrgWorkspace, type InsertOrgWorkspace,
  orgApiKeys, type OrgApiKey, type InsertOrgApiKey, workspaceApiKeys, type WorkspaceApiKey, type InsertWorkspaceApiKey,
  // Workspace-scoped tables
  workspaceKnowledgeDocuments, type WorkspaceKnowledgeDocument, type InsertWorkspaceKnowledgeDocument,
  workspaceKnowledgeVectorChunks, type WorkspaceKnowledgeVectorChunk, type InsertWorkspaceKnowledgeVectorChunk,
  workspaceIntegrations, type WorkspaceIntegration, type InsertWorkspaceIntegration,
  workspaceWorkflowRuns, type WorkspaceWorkflowRun, type InsertWorkspaceWorkflowRun,
  workspaceOperationsMetrics, type WorkspaceOperationMetric, type InsertWorkspaceOperationMetric, type OperationMetricTags,
  workspaceUserActivities, type WorkspaceUserActivity, type InsertWorkspaceUserActivity,
  // Neural memory tables
  workspaceNeuralObservations, type WorkspaceNeuralObservation, type InsertWorkspaceNeuralObservation,
  workspaceObservationClusters, type WorkspaceObservationCluster, type InsertWorkspaceObservationCluster,
  workspaceNeuralEntities, type WorkspaceNeuralEntity, type InsertWorkspaceNeuralEntity,
  workspaceActorProfiles, type WorkspaceActorProfile, type InsertWorkspaceActorProfile,
  orgActorIdentities, type OrgActorIdentity, type InsertOrgActorIdentity,
  workspaceTemporalStates, type WorkspaceTemporalState, type InsertWorkspaceTemporalState,
  // Ingestion payload storage tables
  workspaceIngestionPayloads, workspaceWebhookPayloads, type WorkspaceIngestionPayload, type InsertWorkspaceIngestionPayload, type WorkspaceWebhookPayload, type InsertWorkspaceWebhookPayload,
  // Relationship graph tables
  workspaceObservationRelationships, type WorkspaceObservationRelationship, type InsertWorkspaceObservationRelationship, type RelationshipType,
  // Relations
  gwInstallationsRelations, gwTokensRelations, gwResourcesRelations,
  orgWorkspacesRelations,
  workspaceKnowledgeDocumentsRelations, workspaceKnowledgeVectorChunksRelations,
  workspaceUserActivitiesRelations, workspaceIntegrationsRelations,
  workspaceNeuralObservationsRelations, workspaceObservationClustersRelations,
  workspaceActorProfilesRelations, workspaceTemporalStatesRelations,
  orgActorIdentitiesRelations, workspaceObservationRelationshipsRelations,
} from "./schema";

// Re-exported types from schema
export type {
  WorkflowInput, WorkflowOutput, GitHubSourceMetadata,
  JobDurationTags, DocumentsIndexedTags, ErrorTags, NeuralObservationTags, EntityExtractionTags, ClusterTags, ProfileUpdateTags, ActorResolutionTags, ClusterAffinityTags,
  ObservationReference, ObservationActor, ObservationMetadata,
  TemporalEntityType, TemporalStateType,
  RelationshipMetadata,
} from "./schema";

// Client
export { db } from "./client";

// Utilities
export { getWorkspaceKey, buildWorkspaceNamespace, buildWorkspaceSettings, createCustomWorkspace } from "./utils/workspace";
export { generateWorkspaceName, generateRandomSlug, validateWorkspaceSlug, generateStoreSlug, validateStoreSlug } from "./utils/workspace-names";
