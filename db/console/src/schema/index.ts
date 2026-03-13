// Table schemas

// Relations for type-safe queries
export {
  gwInstallationsRelations,
  gwResourcesRelations,
  gwTokensRelations,
  orgWorkspacesRelations,
  workspaceEdgesRelations,
  workspaceEntityEventsRelations,
  workspaceEventsRelations,
  workspaceIntegrationsRelations,
  workspaceInterpretationsRelations,
  workspaceKnowledgeDocumentsRelations,
  workspaceKnowledgeVectorChunksRelations,
  workspaceUserActivitiesRelations,
} from "./relations";

// Re-exported types from tables
export type {
  GitHubSourceMetadata,
  ObservationMetadata,
  ObservationReference,
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
  // Workspace entities
  workspaceEntities,
  // Entity-event junction
  workspaceEntityEvents,
  // Workspace events (neural observations)
  workspaceEvents,
  // Workspace ingest log (raw webhook ingress log)
  workspaceIngestLog,
  workspaceIntegrations,
  // Interpretations table
  workspaceInterpretations,
  // Workspace-scoped tables
  workspaceKnowledgeDocuments,
  workspaceKnowledgeVectorChunks,
  workspaceUserActivities,
  workspaceWorkflowRuns,
} from "./tables";
