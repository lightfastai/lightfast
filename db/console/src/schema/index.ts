// Table schemas

// Relations for type-safe queries
export {
  gwInstallationsRelations,
  gwResourcesRelations,
  gwTokensRelations,
  orgWorkspacesRelations,
  workspaceIntegrationsRelations,
  workspaceKnowledgeDocumentsRelations,
  workspaceKnowledgeVectorChunksRelations,
  workspaceNeuralObservationsRelations,
  workspaceObservationRelationshipsRelations,
  workspaceUserActivitiesRelations,
} from "./relations";

// Re-exported types from tables
export type {
  GitHubSourceMetadata,
  ObservationActor,
  ObservationMetadata,
  ObservationReference,
  RelationshipMetadata,
  WorkflowInput,
  WorkflowOutput,
} from "./tables";
export {
  type GwBackfillRun,
  type GwInstallation,
  type GwResource,
  type GwToken,
  type GwWebhookDelivery,
  gwBackfillRuns,
  // Gateway-owned tables
  gwInstallations,
  gwResources,
  gwTokens,
  gwWebhookDeliveries,
  type InsertGwBackfillRun,
  type InsertGwInstallation,
  type InsertGwResource,
  type InsertGwToken,
  type InsertGwWebhookDelivery,
  type InsertOrgApiKey,
  type InsertOrgWorkspace,
  type InsertWorkspaceEvent,
  type InsertWorkspaceIntegration,
  type InsertWorkspaceKnowledgeDocument,
  type InsertWorkspaceKnowledgeVectorChunk,
  type InsertWorkspaceNeuralEntity,
  type InsertWorkspaceNeuralObservation,
  type InsertWorkspaceObservationRelationship,
  type InsertWorkspaceUserActivity,
  type InsertWorkspaceWorkflowRun,
  type OrgApiKey,
  type OrgWorkspace,
  orgApiKeys,
  // Org-scoped tables
  orgWorkspaces,
  type RelationshipType,
  type WorkspaceEvent,
  type WorkspaceIntegration,
  type WorkspaceKnowledgeDocument,
  type WorkspaceKnowledgeVectorChunk,
  type WorkspaceNeuralEntity,
  type WorkspaceNeuralObservation,
  type WorkspaceObservationRelationship,
  type WorkspaceUserActivity,
  type WorkspaceWorkflowRun,
  // Workspace event storage
  workspaceEvents,
  workspaceIntegrations,
  // Workspace-scoped tables
  workspaceKnowledgeDocuments,
  workspaceKnowledgeVectorChunks,
  workspaceNeuralEntities,
  // Neural memory tables
  workspaceNeuralObservations,
  // Relationship graph tables
  workspaceObservationRelationships,
  workspaceUserActivities,
  workspaceWorkflowRuns,
} from "./tables";
