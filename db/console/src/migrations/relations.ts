import { relations } from "drizzle-orm/relations";
import { lightfastIntegrations, lightfastOrganizationIntegrations, lightfastWorkspaces, lightfastConnectedRepository, lightfastConnectedSources, lightfastStores, lightfastDocsDocuments, lightfastIngestionEvents, lightfastVectorEntries, lightfastIntegrationResources, lightfastWorkspaceIntegrations, lightfastUserSources, lightfastWorkspaceSources } from "./schema";

export const lightfastOrganizationIntegrationsRelations = relations(lightfastOrganizationIntegrations, ({one}) => ({
	lightfastIntegration: one(lightfastIntegrations, {
		fields: [lightfastOrganizationIntegrations.integrationId],
		references: [lightfastIntegrations.id]
	}),
}));

export const lightfastIntegrationsRelations = relations(lightfastIntegrations, ({many}) => ({
	lightfastOrganizationIntegrations: many(lightfastOrganizationIntegrations),
	lightfastIntegrationResources: many(lightfastIntegrationResources),
}));

export const lightfastConnectedRepositoryRelations = relations(lightfastConnectedRepository, ({one}) => ({
	lightfastWorkspace: one(lightfastWorkspaces, {
		fields: [lightfastConnectedRepository.workspaceId],
		references: [lightfastWorkspaces.id]
	}),
}));

export const lightfastWorkspacesRelations = relations(lightfastWorkspaces, ({many}) => ({
	lightfastConnectedRepositories: many(lightfastConnectedRepository),
	lightfastConnectedSources: many(lightfastConnectedSources),
	lightfastStores: many(lightfastStores),
	lightfastWorkspaceIntegrations: many(lightfastWorkspaceIntegrations),
	lightfastWorkspaceSources: many(lightfastWorkspaceSources),
}));

export const lightfastConnectedSourcesRelations = relations(lightfastConnectedSources, ({one}) => ({
	lightfastWorkspace: one(lightfastWorkspaces, {
		fields: [lightfastConnectedSources.workspaceId],
		references: [lightfastWorkspaces.id]
	}),
}));

export const lightfastStoresRelations = relations(lightfastStores, ({one, many}) => ({
	lightfastWorkspace: one(lightfastWorkspaces, {
		fields: [lightfastStores.workspaceId],
		references: [lightfastWorkspaces.id]
	}),
	lightfastDocsDocuments: many(lightfastDocsDocuments),
	lightfastIngestionEvents: many(lightfastIngestionEvents),
	lightfastVectorEntries: many(lightfastVectorEntries),
}));

export const lightfastDocsDocumentsRelations = relations(lightfastDocsDocuments, ({one, many}) => ({
	lightfastStore: one(lightfastStores, {
		fields: [lightfastDocsDocuments.storeId],
		references: [lightfastStores.id]
	}),
	lightfastVectorEntries: many(lightfastVectorEntries),
}));

export const lightfastIngestionEventsRelations = relations(lightfastIngestionEvents, ({one}) => ({
	lightfastStore: one(lightfastStores, {
		fields: [lightfastIngestionEvents.storeId],
		references: [lightfastStores.id]
	}),
}));

export const lightfastVectorEntriesRelations = relations(lightfastVectorEntries, ({one}) => ({
	lightfastDocsDocument: one(lightfastDocsDocuments, {
		fields: [lightfastVectorEntries.docId],
		references: [lightfastDocsDocuments.id]
	}),
	lightfastStore: one(lightfastStores, {
		fields: [lightfastVectorEntries.storeId],
		references: [lightfastStores.id]
	}),
}));

export const lightfastIntegrationResourcesRelations = relations(lightfastIntegrationResources, ({one, many}) => ({
	lightfastIntegration: one(lightfastIntegrations, {
		fields: [lightfastIntegrationResources.integrationId],
		references: [lightfastIntegrations.id]
	}),
	lightfastWorkspaceIntegrations: many(lightfastWorkspaceIntegrations),
}));

export const lightfastWorkspaceIntegrationsRelations = relations(lightfastWorkspaceIntegrations, ({one}) => ({
	lightfastIntegrationResource: one(lightfastIntegrationResources, {
		fields: [lightfastWorkspaceIntegrations.resourceId],
		references: [lightfastIntegrationResources.id]
	}),
	lightfastWorkspace: one(lightfastWorkspaces, {
		fields: [lightfastWorkspaceIntegrations.workspaceId],
		references: [lightfastWorkspaces.id]
	}),
}));

export const lightfastWorkspaceSourcesRelations = relations(lightfastWorkspaceSources, ({one}) => ({
	lightfastUserSource: one(lightfastUserSources, {
		fields: [lightfastWorkspaceSources.userSourceId],
		references: [lightfastUserSources.id]
	}),
	lightfastWorkspace: one(lightfastWorkspaces, {
		fields: [lightfastWorkspaceSources.workspaceId],
		references: [lightfastWorkspaces.id]
	}),
}));

export const lightfastUserSourcesRelations = relations(lightfastUserSources, ({many}) => ({
	lightfastWorkspaceSources: many(lightfastWorkspaceSources),
}));