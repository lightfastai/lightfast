// Schema exports

// Client
export { db } from "./client";

// Re-exported types from schema
export type {
  GitHubSourceMetadata,
  ObservationActor,
  ObservationMetadata,
  ObservationReference,
  RelationshipMetadata,
  WorkflowInput,
  WorkflowOutput,
} from "./schema";
export {
  type GwInstallation,
  type GwResource,
  type GwToken,
  type GwWebhookDelivery,
  // Gateway-owned tables
  gwInstallations,
  // Relations
  gwInstallationsRelations,
  gwResources,
  gwResourcesRelations,
  gwTokens,
  gwTokensRelations,
  gwWebhookDeliveries,
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
  orgWorkspacesRelations,
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
  workspaceIntegrationsRelations,
  // Workspace-scoped tables
  workspaceKnowledgeDocuments,
  workspaceKnowledgeDocumentsRelations,
  workspaceKnowledgeVectorChunks,
  workspaceKnowledgeVectorChunksRelations,
  workspaceNeuralEntities,
  // Neural memory tables
  workspaceNeuralObservations,
  workspaceNeuralObservationsRelations,
  // Relationship graph tables
  workspaceObservationRelationships,
  workspaceObservationRelationshipsRelations,
  workspaceUserActivities,
  workspaceUserActivitiesRelations,
  workspaceWorkflowRuns,
} from "./schema";

// Utilities
export {
  buildWorkspaceNamespace,
  buildWorkspaceSettings,
  createCustomWorkspace,
  getWorkspaceKey,
} from "./utils/workspace";
export {
  generateRandomSlug,
  generateStoreSlug,
  generateWorkspaceName,
  validateStoreSlug,
  validateWorkspaceSlug,
} from "./utils/workspace-names";
