// Schema exports

// Client
export { db } from "./client";

// Re-exported types from schema
export type {
  GitHubSourceMetadata,
  ObservationActor,
  ObservationMetadata,
  ObservationReference,
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
  type InsertWorkspaceEdge,
  type InsertWorkspaceEntity,
  type InsertWorkspaceEvent,
  type InsertWorkspaceIngestLogEntry,
  type InsertWorkspaceIntegration,
  type InsertWorkspaceKnowledgeDocument,
  type InsertWorkspaceKnowledgeVectorChunk,
  type InsertWorkspaceUserActivity,
  type InsertWorkspaceWorkflowRun,
  type OrgApiKey,
  type OrgWorkspace,
  orgApiKeys,
  // Org-scoped tables
  orgWorkspaces,
  orgWorkspacesRelations,
  type WorkspaceEdge,
  type WorkspaceEntity,
  type WorkspaceEvent,
  type WorkspaceIngestLogEntry,
  type WorkspaceIntegration,
  type WorkspaceKnowledgeDocument,
  type WorkspaceKnowledgeVectorChunk,
  type WorkspaceUserActivity,
  type WorkspaceWorkflowRun,
  // Entity↔entity edges
  workspaceEdges,
  // Workspace entities
  workspaceEntities,
  // Workspace events (neural observations)
  workspaceEvents,
  workspaceEventsRelations,
  // Workspace ingest log (raw webhook ingress log)
  workspaceIngestLog,
  workspaceIntegrations,
  workspaceIntegrationsRelations,
  // Workspace-scoped tables
  workspaceKnowledgeDocuments,
  workspaceKnowledgeDocumentsRelations,
  workspaceKnowledgeVectorChunks,
  workspaceKnowledgeVectorChunksRelations,
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
