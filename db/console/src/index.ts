// Schema exports

// Client
export { db } from "./client";

// Re-exported types from schema
export type {
  GitHubSourceMetadata,
  ObservationMetadata,
  ObservationReference,
  WorkflowInput,
  WorkflowOutput,
} from "./schema";
export {
  type GwBackfillRun,
  type GwInstallation,
  type GwResource,
  type GwToken,
  type GwWebhookDelivery,
  gwBackfillRuns,
  // Gateway-owned tables
  gwInstallations,
  // Relations
  gwInstallationsRelations,
  gwResources,
  gwResourcesRelations,
  gwTokens,
  gwTokensRelations,
  gwWebhookDeliveries,
  type InsertGwBackfillRun,
  type InsertGwInstallation,
  type InsertGwResource,
  type InsertGwToken,
  type InsertGwWebhookDelivery,
  type InsertOrgApiKey,
  type InsertOrgWorkspace,
  type InsertWorkspaceEdge,
  type InsertWorkspaceEntity,
  type InsertWorkspaceEntityEvent,
  type InsertWorkspaceEvent,
  type InsertWorkspaceIngestLogEntry,
  type InsertWorkspaceIntegration,
  type InsertWorkspaceInterpretation,
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
  type WorkspaceEntityEvent,
  type WorkspaceEvent,
  type WorkspaceIngestLogEntry,
  type WorkspaceIntegration,
  type WorkspaceInterpretation,
  type WorkspaceKnowledgeDocument,
  type WorkspaceKnowledgeVectorChunk,
  type WorkspaceUserActivity,
  type WorkspaceWorkflowRun,
  // Entity↔entity edges
  workspaceEdges,
  workspaceEdgesRelations,
  // Workspace entities
  workspaceEntities,
  // Entity-event junction
  workspaceEntityEvents,
  workspaceEntityEventsRelations,
  // Workspace events (neural observations)
  workspaceEvents,
  workspaceEventsRelations,
  // Workspace ingest log (raw webhook ingress log)
  workspaceIngestLog,
  workspaceIntegrations,
  workspaceIntegrationsRelations,
  // Interpretations table
  workspaceInterpretations,
  workspaceInterpretationsRelations,
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
