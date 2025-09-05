import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { uuidv4 } from "@repo/lib";

/**
 * CloudOrgSettings table stores organization-specific configuration and limits.
 *
 * This table manages organization settings, subscription plans, and resource limits
 * for the Lightfast Cloud platform. Each organization has one settings record.
 */
export const CloudOrgSettings = mysqlTable(
  "lightfast_cloud_org_settings",
  {
    /**
     * Unique identifier for the organization settings record
     * Generated using uuidv4 for global uniqueness
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => uuidv4()),

    /**
     * Reference to the organization this settings record belongs to
     * Links to the Clerk organization ID (unique constraint ensures one record per org)
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull().unique(),

    /**
     * Human-readable display name for the organization
     * Can be different from Clerk organization name
     */
    displayName: varchar("display_name", { length: 100 }),

    /**
     * URL-friendly slug for the organization
     * Used for organization-scoped URLs and routing
     */
    slug: varchar("slug", { length: 50 }).unique(),

    /**
     * Subscription plan type for the organization
     * Determines resource limits and available features
     */
    planType: mysqlEnum("plan_type", ["free", "pro", "enterprise"])
      .notNull()
      .default("free"),

    /**
     * Maximum number of API keys the organization can create
     * Enforced at the application level
     */
    apiKeyLimit: int("api_key_limit").notNull().default(10),

    /**
     * Maximum number of deployments the organization can have
     * Enforced at the application level
     */
    deploymentLimit: int("deployment_limit").notNull().default(100),

    /**
     * Monthly execution limit for agent runs
     * Tracked and enforced at the application level
     */
    monthlyExecutionLimit: bigint("monthly_execution_limit", { mode: "number" })
      .notNull()
      .default(1000000),

    /**
     * Flexible JSON configuration for organization-specific settings
     * Can store feature flags, custom limits, and other configuration
     */
    settings: json("settings").$type<{
      features?: {
        advancedAnalytics?: boolean;
        customDomains?: boolean;
        ssoEnabled?: boolean;
      };
      limits?: {
        maxAgentsPerDeployment?: number;
        maxParallelExecutions?: number;
      };
      billing?: {
        stripeCustomerId?: string;
        subscriptionId?: string;
      };
    }>(),

    /**
     * Timestamp when the organization settings were created
     */
    createdAt: datetime("created_at", { mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Timestamp when the organization settings were last updated
     * Automatically updates on any modification
     */
    updatedAt: datetime("updated_at", { mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => ({
    // Primary lookup index by organization ID
    orgIdIdx: index("org_id_idx").on(table.clerkOrgId),
    // Index for slug-based lookups (for URL routing)
    slugIdx: index("slug_idx").on(table.slug),
    // Index for plan-based queries (for billing and feature queries)
    planTypeIdx: index("plan_type_idx").on(table.planType),
  }),
);

// Type exports for Organization Settings
export type CloudOrgSettings = typeof CloudOrgSettings.$inferSelect;
export type InsertCloudOrgSettings = typeof CloudOrgSettings.$inferInsert;

// Zod Schema exports for validation
export const insertCloudOrgSettingsSchema = createInsertSchema(CloudOrgSettings);
export const selectCloudOrgSettingsSchema = createSelectSchema(CloudOrgSettings);