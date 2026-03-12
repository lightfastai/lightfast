// Table schemas

// Relations for type-safe queries
export {
  gwInstallationsRelations,
  gwResourcesRelations,
  gwTokensRelations,
  orgWorkspacesRelations,
  workspaceEntityObservationsRelations,
  workspaceIntegrationsRelations,
  workspaceKnowledgeDocumentsRelations,
  workspaceKnowledgeVectorChunksRelations,
  workspaceNeuralObservationsRelations,
  workspaceObservationInterpretationsRelations,
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
  type InsertWorkspaceEntityObservation,
  type InsertWorkspaceEvent,
  type InsertWorkspaceIntegration,
  type InsertWorkspaceKnowledgeDocument,
  type InsertWorkspaceKnowledgeVectorChunk,
  type InsertWorkspaceNeuralEntity,
  type InsertWorkspaceNeuralObservation,
  type InsertWorkspaceObservationInterpretation,
  type InsertWorkspaceObservationRelationship,
  type InsertWorkspaceUserActivity,
  type InsertWorkspaceWorkflowRun,
  type OrgApiKey,
  type OrgWorkspace,
  orgApiKeys,
  // Org-scoped tables
  orgWorkspaces,
  type RelationshipType,
  type WorkspaceEntityObservation,
  type WorkspaceEvent,
  type WorkspaceIntegration,
  type WorkspaceKnowledgeDocument,
  type WorkspaceKnowledgeVectorChunk,
  type WorkspaceNeuralEntity,
  type WorkspaceNeuralObservation,
  type WorkspaceObservationInterpretation,
  type WorkspaceObservationRelationship,
  type WorkspaceUserActivity,
  type WorkspaceWorkflowRun,
  // Entity-observation junction
  workspaceEntityObservations,
  // Workspace event storage
  workspaceEvents,
  workspaceIntegrations,
  // Workspace-scoped tables
  workspaceKnowledgeDocuments,
  workspaceKnowledgeVectorChunks,
  workspaceNeuralEntities,
  // Neural memory tables
  workspaceNeuralObservations,
  // Interpretation table
  workspaceObservationInterpretations,
  // Relationship graph tables
  workspaceObservationRelationships,
  workspaceUserActivities,
  workspaceWorkflowRuns,
} from "./tables";
