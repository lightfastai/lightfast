import { pgTable, index, varchar, text, timestamp, jsonb, boolean, foreignKey, unique, integer, uniqueIndex, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const configStatus = pgEnum("config_status", ['configured', 'unconfigured', 'ingesting', 'error', 'pending'])
export const embeddingProvider = pgEnum("embedding_provider", ['cohere'])
export const integrationProvider = pgEnum("integration_provider", ['github', 'notion', 'linear', 'sentry'])
export const pineconeCloud = pgEnum("pinecone_cloud", ['aws', 'gcp', 'azure'])
export const pineconeMetric = pgEnum("pinecone_metric", ['cosine', 'euclidean', 'dotproduct'])
export const sourceType = pgEnum("source_type", ['github', 'linear', 'notion', 'sentry', 'vercel', 'zendesk'])


export const lightfastIntegrations = pgTable("lightfast_integrations", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 191 }).notNull(),
	provider: integrationProvider().notNull(),
	accessToken: text("access_token").notNull(),
	refreshToken: text("refresh_token"),
	tokenExpiresAt: timestamp("token_expires_at", { mode: 'string' }),
	scopes: text().array(),
	providerData: jsonb("provider_data").notNull(),
	lastSyncAt: timestamp("last_sync_at", { mode: 'string' }),
	nextSyncAt: timestamp("next_sync_at", { mode: 'string' }),
	syncStatus: varchar("sync_status", { length: 50 }),
	errorMessage: text("error_message"),
	isActive: boolean("is_active").default(true).notNull(),
	connectedAt: timestamp("connected_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("integration_is_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("integration_provider_idx").using("btree", table.provider.asc().nullsLast().op("enum_ops")),
	index("integration_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("integration_user_provider_idx").using("btree", table.userId.asc().nullsLast().op("enum_ops"), table.provider.asc().nullsLast().op("text_ops")),
]);

export const lightfastOrganizationIntegrations = pgTable("lightfast_organization_integrations", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	integrationId: varchar("integration_id", { length: 191 }).notNull(),
	clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),
	authorizedBy: varchar("authorized_by", { length: 191 }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	authorizedAt: timestamp("authorized_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("org_integration_clerk_org_id_idx").using("btree", table.clerkOrgId.asc().nullsLast().op("text_ops")),
	index("org_integration_integration_id_idx").using("btree", table.integrationId.asc().nullsLast().op("text_ops")),
	index("org_integration_is_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("org_integration_unique_idx").using("btree", table.integrationId.asc().nullsLast().op("text_ops"), table.clerkOrgId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.integrationId],
			foreignColumns: [lightfastIntegrations.id],
			name: "lightfast_organization_integrations_integration_id_lightfast_in"
		}).onDelete("cascade"),
]);

export const lightfastConnectedRepository = pgTable("lightfast_connected_repository", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),
	githubRepoId: varchar("github_repo_id", { length: 191 }).notNull(),
	githubInstallationId: varchar("github_installation_id", { length: 191 }).notNull(),
	permissions: jsonb(),
	isActive: boolean("is_active").default(true).notNull(),
	connectedAt: timestamp("connected_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	lastSyncedAt: timestamp("last_synced_at", { mode: 'string' }),
	configStatus: configStatus("config_status").default('pending').notNull(),
	configPath: varchar("config_path", { length: 255 }),
	configDetectedAt: timestamp("config_detected_at", { mode: 'string' }),
	workspaceId: varchar("workspace_id", { length: 191 }),
	documentCount: integer("document_count").default(0).notNull(),
	lastIngestedAt: timestamp("last_ingested_at", { mode: 'string' }),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("clerk_org_id_idx").using("btree", table.clerkOrgId.asc().nullsLast().op("text_ops")),
	index("installation_idx").using("btree", table.githubInstallationId.asc().nullsLast().op("text_ops")),
	index("org_active_idx").using("btree", table.clerkOrgId.asc().nullsLast().op("bool_ops"), table.isActive.asc().nullsLast().op("bool_ops")),
	index("workspace_active_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.isActive.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [lightfastWorkspaces.id],
			name: "lightfast_connected_repository_workspace_id_lightfast_workspace"
		}).onDelete("set null"),
	unique("lightfast_connected_repository_github_repo_id_unique").on(table.githubRepoId),
]);

export const lightfastConnectedSources = pgTable("lightfast_connected_sources", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),
	workspaceId: varchar("workspace_id", { length: 191 }),
	sourceType: sourceType("source_type").notNull(),
	displayName: varchar("display_name", { length: 255 }).notNull(),
	sourceMetadata: jsonb("source_metadata").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	documentCount: integer("document_count").default(0).notNull(),
	lastIngestedAt: timestamp("last_ingested_at", { mode: 'string' }),
	lastSyncedAt: timestamp("last_synced_at", { mode: 'string' }),
	connectedAt: timestamp("connected_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("connected_sources_clerk_org_id_idx").using("btree", table.clerkOrgId.asc().nullsLast().op("text_ops")),
	index("connected_sources_org_active_idx").using("btree", table.clerkOrgId.asc().nullsLast().op("text_ops"), table.isActive.asc().nullsLast().op("bool_ops")),
	index("connected_sources_org_source_type_idx").using("btree", table.clerkOrgId.asc().nullsLast().op("enum_ops"), table.sourceType.asc().nullsLast().op("enum_ops")),
	index("connected_sources_source_type_idx").using("btree", table.sourceType.asc().nullsLast().op("enum_ops")),
	index("connected_sources_workspace_active_idx").using("btree", table.workspaceId.asc().nullsLast().op("bool_ops"), table.isActive.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [lightfastWorkspaces.id],
			name: "lightfast_connected_sources_workspace_id_lightfast_workspaces_i"
		}).onDelete("set null"),
]);

export const lightfastStores = pgTable("lightfast_stores", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	workspaceId: varchar("workspace_id", { length: 191 }).notNull(),
	slug: varchar({ length: 191 }).notNull(),
	indexName: varchar("index_name", { length: 191 }).notNull(),
	embeddingDim: integer("embedding_dim").notNull(),
	pineconeMetric: pineconeMetric("pinecone_metric").notNull(),
	pineconeCloud: pineconeCloud("pinecone_cloud").notNull(),
	pineconeRegion: varchar("pinecone_region", { length: 50 }).notNull(),
	chunkMaxTokens: integer("chunk_max_tokens").notNull(),
	chunkOverlap: integer("chunk_overlap").notNull(),
	embeddingModel: varchar("embedding_model", { length: 100 }).notNull(),
	embeddingProvider: embeddingProvider("embedding_provider").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stores_ws").using("btree", table.workspaceId.asc().nullsLast().op("text_ops")),
	uniqueIndex("uq_ws_slug").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.slug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [lightfastWorkspaces.id],
			name: "lightfast_stores_workspace_id_lightfast_workspaces_id_fk"
		}).onDelete("cascade"),
]);

export const lightfastDocsDocuments = pgTable("lightfast_docs_documents", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	storeId: varchar("store_id", { length: 191 }).notNull(),
	sourceType: sourceType("source_type").notNull(),
	sourceId: varchar("source_id", { length: 255 }).notNull(),
	sourceMetadata: jsonb("source_metadata").notNull(),
	parentDocId: varchar("parent_doc_id", { length: 191 }),
	slug: varchar({ length: 256 }).notNull(),
	contentHash: varchar("content_hash", { length: 64 }).notNull(),
	configHash: varchar("config_hash", { length: 64 }),
	chunkCount: integer("chunk_count").default(0).notNull(),
	relationships: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_docs_source_id").using("btree", table.sourceType.asc().nullsLast().op("text_ops"), table.sourceId.asc().nullsLast().op("enum_ops")),
	index("idx_docs_source_type").using("btree", table.sourceType.asc().nullsLast().op("enum_ops")),
	index("idx_docs_store").using("btree", table.storeId.asc().nullsLast().op("text_ops")),
	index("idx_docs_store_slug").using("btree", table.storeId.asc().nullsLast().op("text_ops"), table.slug.asc().nullsLast().op("text_ops")),
	uniqueIndex("uq_docs_store_source").using("btree", table.storeId.asc().nullsLast().op("text_ops"), table.sourceType.asc().nullsLast().op("text_ops"), table.sourceId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [lightfastStores.id],
			name: "lightfast_docs_documents_store_id_lightfast_stores_id_fk"
		}).onDelete("cascade"),
]);

export const lightfastIngestionEvents = pgTable("lightfast_ingestion_events", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	storeId: varchar("store_id", { length: 191 }).notNull(),
	sourceType: sourceType("source_type").notNull(),
	eventKey: varchar("event_key", { length: 255 }).notNull(),
	eventMetadata: jsonb("event_metadata").notNull(),
	source: varchar({ length: 32 }).default('webhook').notNull(),
	status: varchar({ length: 16 }).default('processed').notNull(),
	processedAt: timestamp("processed_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_ingestion_events_source").using("btree", table.source.asc().nullsLast().op("text_ops")),
	index("idx_ingestion_events_source_type").using("btree", table.sourceType.asc().nullsLast().op("enum_ops")),
	index("idx_ingestion_events_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_ingestion_events_store").using("btree", table.storeId.asc().nullsLast().op("text_ops")),
	uniqueIndex("uq_ingestion_event").using("btree", table.storeId.asc().nullsLast().op("text_ops"), table.sourceType.asc().nullsLast().op("text_ops"), table.eventKey.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [lightfastStores.id],
			name: "lightfast_ingestion_events_store_id_lightfast_stores_id_fk"
		}).onDelete("cascade"),
]);

export const lightfastVectorEntries = pgTable("lightfast_vector_entries", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	storeId: varchar("store_id", { length: 191 }).notNull(),
	docId: varchar("doc_id", { length: 191 }).notNull(),
	chunkIndex: integer("chunk_index").notNull(),
	contentHash: varchar("content_hash", { length: 64 }).notNull(),
	upsertedAt: timestamp("upserted_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_vec_store_doc").using("btree", table.storeId.asc().nullsLast().op("text_ops"), table.docId.asc().nullsLast().op("text_ops")),
	uniqueIndex("uq_vec_unique").using("btree", table.storeId.asc().nullsLast().op("int4_ops"), table.docId.asc().nullsLast().op("int4_ops"), table.chunkIndex.asc().nullsLast().op("int4_ops"), table.contentHash.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.docId],
			foreignColumns: [lightfastDocsDocuments.id],
			name: "lightfast_vector_entries_doc_id_lightfast_docs_documents_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [lightfastStores.id],
			name: "lightfast_vector_entries_store_id_lightfast_stores_id_fk"
		}).onDelete("cascade"),
]);

export const lightfastIntegrationResources = pgTable("lightfast_integration_resources", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	integrationId: varchar("integration_id", { length: 191 }).notNull(),
	resourceData: jsonb("resource_data").notNull(),
	lastSyncedAt: timestamp("last_synced_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("integration_resource_integration_id_idx").using("btree", table.integrationId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.integrationId],
			foreignColumns: [lightfastIntegrations.id],
			name: "lightfast_integration_resources_integration_id_lightfast_integr"
		}).onDelete("cascade"),
]);

export const lightfastWorkspaceIntegrations = pgTable("lightfast_workspace_integrations", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	workspaceId: varchar("workspace_id", { length: 191 }).notNull(),
	resourceId: varchar("resource_id", { length: 191 }).notNull(),
	connectedByUserId: varchar("connected_by_user_id", { length: 191 }).notNull(),
	syncConfig: jsonb("sync_config").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	lastSyncedAt: timestamp("last_synced_at", { mode: 'string' }),
	lastSyncStatus: varchar("last_sync_status", { length: 50 }),
	lastSyncError: text("last_sync_error"),
	connectedAt: timestamp("connected_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("workspace_integration_connected_by_user_id_idx").using("btree", table.connectedByUserId.asc().nullsLast().op("text_ops")),
	index("workspace_integration_is_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("workspace_integration_resource_id_idx").using("btree", table.resourceId.asc().nullsLast().op("text_ops")),
	index("workspace_integration_unique_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.resourceId.asc().nullsLast().op("text_ops")),
	index("workspace_integration_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.resourceId],
			foreignColumns: [lightfastIntegrationResources.id],
			name: "lightfast_workspace_integrations_resource_id_lightfast_integrat"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [lightfastWorkspaces.id],
			name: "lightfast_workspace_integrations_workspace_id_lightfast_workspa"
		}).onDelete("cascade"),
]);

export const lightfastWorkspaces = pgTable("lightfast_workspaces", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),
	slug: varchar({ length: 191 }).notNull(),
	settings: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	name: varchar({ length: 191 }).default('Default Workspace').notNull(),
}, (table) => [
	index("workspace_clerk_org_id_idx").using("btree", table.clerkOrgId.asc().nullsLast().op("text_ops")),
	uniqueIndex("workspace_org_name_idx").using("btree", table.clerkOrgId.asc().nullsLast().op("text_ops"), table.name.asc().nullsLast().op("text_ops")),
	index("workspace_slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
]);

export const lightfastApiKeys = pgTable("lightfast_api_keys", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 191 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	keyHash: text("key_hash").notNull(),
	keyPreview: varchar("key_preview", { length: 8 }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("api_key_hash_idx").using("btree", table.keyHash.asc().nullsLast().op("text_ops")),
	index("api_key_is_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("api_key_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const lightfastJobs = pgTable("lightfast_jobs", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),
	workspaceId: varchar("workspace_id", { length: 191 }).notNull(),
	repositoryId: varchar("repository_id", { length: 191 }),
	inngestRunId: varchar("inngest_run_id", { length: 191 }).notNull(),
	inngestFunctionId: varchar("inngest_function_id", { length: 191 }).notNull(),
	name: varchar({ length: 191 }).notNull(),
	status: varchar({ length: 50 }).default('queued').notNull(),
	trigger: varchar({ length: 50 }).notNull(),
	triggeredBy: varchar("triggered_by", { length: 191 }),
	input: jsonb(),
	output: jsonb(),
	errorMessage: varchar("error_message", { length: 1000 }),
	startedAt: timestamp("started_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	durationMs: varchar("duration_ms", { length: 50 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("job_clerk_org_id_idx").using("btree", table.clerkOrgId.asc().nullsLast().op("text_ops")),
	index("job_inngest_run_id_idx").using("btree", table.inngestRunId.asc().nullsLast().op("text_ops")),
	index("job_repository_id_idx").using("btree", table.repositoryId.asc().nullsLast().op("text_ops")),
	index("job_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("job_workspace_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("job_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops")),
]);

export const lightfastMetrics = pgTable("lightfast_metrics", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),
	workspaceId: varchar("workspace_id", { length: 191 }).notNull(),
	repositoryId: varchar("repository_id", { length: 191 }),
	type: varchar({ length: 50 }).notNull(),
	value: integer().notNull(),
	unit: varchar({ length: 20 }),
	tags: jsonb(),
	timestamp: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("metric_clerk_org_id_idx").using("btree", table.clerkOrgId.asc().nullsLast().op("text_ops")),
	index("metric_repository_id_idx").using("btree", table.repositoryId.asc().nullsLast().op("text_ops")),
	index("metric_timestamp_idx").using("btree", table.timestamp.asc().nullsLast().op("timestamp_ops")),
	index("metric_type_idx").using("btree", table.type.asc().nullsLast().op("text_ops")),
	index("metric_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops")),
	index("metric_workspace_type_timestamp_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamp_ops"), table.type.asc().nullsLast().op("text_ops"), table.timestamp.asc().nullsLast().op("text_ops")),
]);

export const lightfastWorkspaceSources = pgTable("lightfast_workspace_sources", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	workspaceId: varchar("workspace_id", { length: 191 }).notNull(),
	userSourceId: varchar("user_source_id", { length: 191 }).notNull(),
	connectedBy: varchar("connected_by", { length: 191 }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	lastSyncedAt: timestamp("last_synced_at", { mode: 'string' }),
	lastSyncStatus: varchar("last_sync_status", { length: 50 }),
	lastSyncError: text("last_sync_error"),
	documentCount: integer("document_count").default(0).notNull(),
	connectedAt: timestamp("connected_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	sourceConfig: jsonb("source_config").notNull(),
	providerResourceId: varchar("provider_resource_id", { length: 191 }).notNull(),
}, (table) => [
	index("workspace_source_connected_by_idx").using("btree", table.connectedBy.asc().nullsLast().op("text_ops")),
	index("workspace_source_is_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("workspace_source_provider_resource_id_idx").using("btree", table.providerResourceId.asc().nullsLast().op("text_ops")),
	index("workspace_source_user_source_id_idx").using("btree", table.userSourceId.asc().nullsLast().op("text_ops")),
	index("workspace_source_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userSourceId],
			foreignColumns: [lightfastUserSources.id],
			name: "lightfast_workspace_sources_user_source_id_lightfast_user_sourc"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [lightfastWorkspaces.id],
			name: "lightfast_workspace_sources_workspace_id_lightfast_workspaces_i"
		}).onDelete("cascade"),
]);

export const lightfastUserSources = pgTable("lightfast_user_sources", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 191 }).notNull(),
	provider: integrationProvider().notNull(),
	accessToken: text("access_token").notNull(),
	refreshToken: text("refresh_token"),
	tokenExpiresAt: timestamp("token_expires_at", { mode: 'string' }),
	scopes: text().array(),
	providerMetadata: jsonb("provider_metadata").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	connectedAt: timestamp("connected_at", { mode: 'string' }).defaultNow().notNull(),
	lastSyncAt: timestamp("last_sync_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("user_source_is_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("user_source_provider_idx").using("btree", table.provider.asc().nullsLast().op("enum_ops")),
	index("user_source_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("user_source_user_provider_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("text_ops")),
]);
