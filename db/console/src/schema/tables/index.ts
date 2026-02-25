// Gateway-owned tables (gw_*)
export { gwInstallations, type GwInstallation, type InsertGwInstallation } from "./gw-installations";
export { gwTokens, type GwToken, type InsertGwToken } from "./gw-tokens";
export { gwResources, type GwResource, type InsertGwResource } from "./gw-resources";
export { gwWebhookDeliveries, type GwWebhookDelivery, type InsertGwWebhookDelivery } from "./gw-webhook-deliveries";

// User-scoped tables
export { userApiKeys, type UserApiKey, type InsertUserApiKey } from "./user-api-keys";

// Org-scoped tables
export { orgWorkspaces, type OrgWorkspace, type InsertOrgWorkspace } from "./org-workspaces";

// Organization API Keys (workspace-scoped authentication)
export { orgApiKeys, type OrgApiKey, type InsertOrgApiKey, workspaceApiKeys, type WorkspaceApiKey, type InsertWorkspaceApiKey } from "./org-api-keys";

// Workspace-scoped tables
export { workspaceKnowledgeDocuments, type WorkspaceKnowledgeDocument, type InsertWorkspaceKnowledgeDocument } from "./workspace-knowledge-documents";
export { workspaceKnowledgeVectorChunks, type WorkspaceKnowledgeVectorChunk, type InsertWorkspaceKnowledgeVectorChunk } from "./workspace-knowledge-vector-chunks";
export { workspaceIntegrations, type WorkspaceIntegration, type InsertWorkspaceIntegration } from "./workspace-integrations";
export { workspaceWorkflowRuns, type WorkspaceWorkflowRun, type InsertWorkspaceWorkflowRun } from "./workspace-workflow-runs";
export type { WorkflowInput, WorkflowOutput, GitHubSourceMetadata } from "./workspace-workflow-runs";
export { workspaceOperationsMetrics, type WorkspaceOperationMetric, type InsertWorkspaceOperationMetric, type OperationMetricTags } from "./workspace-operations-metrics";
export type { JobDurationTags, DocumentsIndexedTags, ErrorTags, NeuralObservationTags, EntityExtractionTags, ClusterTags, ProfileUpdateTags, ActorResolutionTags, ClusterAffinityTags } from "./workspace-operations-metrics";
export { workspaceUserActivities, type WorkspaceUserActivity, type InsertWorkspaceUserActivity } from "./workspace-user-activities";

// Neural memory tables
export { workspaceNeuralObservations, type WorkspaceNeuralObservation, type InsertWorkspaceNeuralObservation } from "./workspace-neural-observations";
export type { ObservationReference, ObservationActor, ObservationMetadata } from "./workspace-neural-observations";
export { workspaceObservationClusters, type WorkspaceObservationCluster, type InsertWorkspaceObservationCluster } from "./workspace-observation-clusters";
export { workspaceNeuralEntities, type WorkspaceNeuralEntity, type InsertWorkspaceNeuralEntity } from "./workspace-neural-entities";
export { workspaceActorProfiles, type WorkspaceActorProfile, type InsertWorkspaceActorProfile } from "./workspace-actor-profiles";
export { orgActorIdentities, type OrgActorIdentity, type InsertOrgActorIdentity } from "./org-actor-identities";
export { workspaceTemporalStates, type WorkspaceTemporalState, type InsertWorkspaceTemporalState } from "./workspace-temporal-states";
export type { TemporalEntityType, TemporalStateType } from "./workspace-temporal-states";

// Ingestion payload storage tables
export { workspaceIngestionPayloads, workspaceWebhookPayloads, type WorkspaceIngestionPayload, type InsertWorkspaceIngestionPayload, type WorkspaceWebhookPayload, type InsertWorkspaceWebhookPayload } from "./workspace-webhook-payloads";

// Relationship graph tables
export { workspaceObservationRelationships, type WorkspaceObservationRelationship, type InsertWorkspaceObservationRelationship, type RelationshipType } from "./workspace-observation-relationships";
export type { RelationshipMetadata } from "./workspace-observation-relationships";
