// Export all table schemas

// User-scoped tables
export * from "./user-api-keys";
export * from "./user-sources";

// Org-scoped tables
export * from "./org-workspaces";

// Organization API Keys (workspace-scoped authentication)
export * from "./org-api-keys";

// Workspace-scoped tables
export * from "./workspace-knowledge-documents";
export * from "./workspace-knowledge-vector-chunks";
export * from "./workspace-integrations";
export * from "./workspace-workflow-runs";
export * from "./workspace-operations-metrics";
export * from "./workspace-user-activities";

// Neural memory tables
export * from "./workspace-neural-observations";
export * from "./workspace-observation-clusters";
export * from "./workspace-neural-entities";
export * from "./workspace-actor-profiles";
export * from "./org-actor-identities";
export * from "./workspace-temporal-states";

// Webhook storage tables
export * from "./workspace-webhook-payloads";

// Relationship graph tables
export * from "./workspace-observation-relationships";
