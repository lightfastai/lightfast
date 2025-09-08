import { mysqlTable, mysqlSchema, AnyMySqlColumn, index, primaryKey, varchar, datetime, json, int, bigint } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const lightfastCloudApiKey = mysqlTable("lightfast_cloud_api_key", {
	id: varchar({ length: 191 }).notNull(),
	clerkUserId: varchar("clerk_user_id", { length: 191 }),
	keyHash: varchar("key_hash", { length: 255 }).notNull(),
	keyPreview: varchar("key_preview", { length: 20 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	active: tinyint().default(1).notNull(),
	lastUsedAt: datetime("last_used_at", { mode: 'string'}),
	expiresAt: datetime("expires_at", { mode: 'string'}),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	updatedAt: datetime("updated_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	keyLookup: varchar("key_lookup", { length: 64 }).notNull(),
	clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),
	createdByUserId: varchar("created_by_user_id", { length: 191 }).notNull(),
},
(table) => [
	index("key_hash_idx").on(table.keyHash),
	index("key_lookup_idx").on(table.keyLookup),
	index("org_created_by_idx").on(table.clerkOrgId, table.createdByUserId),
	index("org_id_idx").on(table.clerkOrgId),
	index("user_id_idx").on(table.clerkUserId),
	primaryKey({ columns: [table.id], name: "lightfast_cloud_api_key_id"}),
]);

export const lightfastCloudDeployment = mysqlTable("lightfast_cloud_deployment", {
	id: varchar({ length: 191 }).notNull(),
	clerkUserId: varchar("clerk_user_id", { length: 191 }),
	name: varchar({ length: 255 }).notNull(),
	bundleUrl: varchar("bundle_url", { length: 500 }).notNull(),
	metadata: json(),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),
	createdByUserId: varchar("created_by_user_id", { length: 191 }).notNull(),
},
(table) => [
	index("created_at_idx").on(table.createdAt),
	index("org_created_at_idx").on(table.clerkOrgId, table.createdAt),
	index("org_id_idx").on(table.clerkOrgId),
	index("org_name_idx").on(table.clerkOrgId, table.name),
	index("user_id_idx").on(table.clerkUserId),
	primaryKey({ columns: [table.id], name: "lightfast_cloud_deployment_id"}),
]);

export const lightfastCloudOrgSettings = mysqlTable("lightfast_cloud_org_settings", {
	id: varchar({ length: 191 }).notNull(),
	clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),
	apiKeyLimit: int("api_key_limit").default(10).notNull(),
	deploymentLimit: int("deployment_limit").default(100).notNull(),
	monthlyExecutionLimit: bigint("monthly_execution_limit", { mode: "number" }).default(1000000).notNull(),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	updatedAt: datetime("updated_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("lightfast_cloud_org_settings_clerk_org_id_unique").on(table.clerkOrgId),
	index("org_id_idx").on(table.clerkOrgId),
	primaryKey({ columns: [table.id], name: "lightfast_cloud_org_settings_id"}),
]);
