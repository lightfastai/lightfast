import { relations, sql } from "drizzle-orm";
import { datetime, index, json, mysqlTable, varchar, int } from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { uuidv4 } from "@repo/lib";

/**
 * CloudDeployment table represents agent deployments to the cloud platform.
 * 
 * Each deployment contains the agent bundle and metadata about the deployment.
 */
export const CloudDeployment = mysqlTable("lightfast_cloud_deployment", {
  /**
   * Unique identifier for the deployment
   */
  id: varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  
  /**
   * Reference to the user who deployed this
   * Links to the Clerk user ID
   */
  clerkUserId: varchar("clerk_user_id", { length: 191 }).notNull(),
  
  /**
   * Name of the deployment (from lightfast.config.ts metadata)
   */
  name: varchar("name", { length: 255 }).notNull(),
  
  /**
   * Version of the deployment
   */
  version: varchar("version", { length: 50 }).notNull(),
  
  /**
   * URL to the deployed bundle in Vercel Blob storage
   */
  bundleUrl: varchar("bundle_url", { length: 500 }).notNull(),
  
  /**
   * Size of the bundle in bytes
   */
  bundleSize: int("bundle_size").notNull(),
  
  /**
   * SHA256 hash of the bundle for integrity verification
   */
  bundleHash: varchar("bundle_hash", { length: 64 }).notNull(),
  
  /**
   * Status of the deployment
   */
  status: varchar("status", { length: 20 })
    .$type<'pending' | 'active' | 'failed' | 'archived'>()
    .notNull()
    .default('pending'),
  
  /**
   * Metadata about the deployment (agents, configuration, etc.)
   */
  metadata: json("metadata").$type<{
    agents?: string[];
    environment?: string;
    region?: string;
    [key: string]: any;
  }>(),
  
  /**
   * Error message if deployment failed
   */
  error: varchar("error", { length: 1000 }),
  
  /**
   * Timestamp when the deployment was created
   */
  createdAt: datetime("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  
  /**
   * Timestamp when the deployment was last updated
   */
  updatedAt: datetime("updated_at", { mode: 'string' })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  // Index for looking up deployments by user
  userIdIdx: index("user_id_idx").on(table.clerkUserId),
  // Index for looking up active deployments
  statusIdx: index("status_idx").on(table.status),
  // Index for time-based queries
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

/**
 * CloudDeploymentExecution table tracks executions of deployed agents.
 */
export const CloudDeploymentExecution = mysqlTable("lightfast_cloud_deployment_execution", {
  /**
   * Unique identifier for the execution
   */
  id: varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  
  /**
   * Reference to the deployment
   */
  deploymentId: varchar("deployment_id", { length: 191 }).notNull(),
  
  /**
   * Name of the agent that was executed
   */
  agentName: varchar("agent_name", { length: 100 }).notNull(),
  
  /**
   * Status of the execution
   */
  status: varchar("status", { length: 20 })
    .$type<'running' | 'completed' | 'failed' | 'timeout'>()
    .notNull()
    .default('running'),
  
  /**
   * Duration of the execution in milliseconds
   */
  duration: int("duration"),
  
  /**
   * Input provided to the agent
   */
  input: json("input"),
  
  /**
   * Output from the agent
   */
  output: json("output"),
  
  /**
   * Error message if execution failed
   */
  error: varchar("error", { length: 1000 }),
  
  /**
   * Timestamp when the execution started
   */
  startedAt: datetime("started_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  
  /**
   * Timestamp when the execution completed
   */
  completedAt: datetime("completed_at", { mode: 'string' }),
}, (table) => ({
  // Index for looking up executions by deployment
  deploymentIdIdx: index("deployment_id_idx").on(table.deploymentId),
  // Index for status queries
  statusIdx: index("status_idx").on(table.status),
  // Index for time-based queries
  startedAtIdx: index("started_at_idx").on(table.startedAt),
}));

/**
 * Drizzle Relations
 */

// Deployment relations - one deployment can have many executions
export const cloudDeploymentRelations = relations(CloudDeployment, ({ many }) => ({
  executions: many(CloudDeploymentExecution),
}));

// Execution relations - each execution belongs to one deployment
export const cloudDeploymentExecutionRelations = relations(CloudDeploymentExecution, ({ one }) => ({
  deployment: one(CloudDeployment, {
    fields: [CloudDeploymentExecution.deploymentId],
    references: [CloudDeployment.id],
  }),
}));

// Type exports
export type CloudDeployment = typeof CloudDeployment.$inferSelect;
export type InsertCloudDeployment = typeof CloudDeployment.$inferInsert;

export type CloudDeploymentExecution = typeof CloudDeploymentExecution.$inferSelect;
export type InsertCloudDeploymentExecution = typeof CloudDeploymentExecution.$inferInsert;

// Zod Schema exports
export const insertCloudDeploymentSchema = createInsertSchema(CloudDeployment);
export const selectCloudDeploymentSchema = createSelectSchema(CloudDeployment);

export const insertCloudDeploymentExecutionSchema = createInsertSchema(CloudDeploymentExecution);
export const selectCloudDeploymentExecutionSchema = createSelectSchema(CloudDeploymentExecution);