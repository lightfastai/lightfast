import { pgTable, varchar, timestamp, text, boolean, index, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "@repo/lib";
import { workspaces } from "./workspaces";

/**
 * Integration Provider Enum
 */
export const integrationProviderEnum = pgEnum("integration_provider", [
  "github",
  "notion",
  "linear",
  "sentry",
]);

/**
 * Personal Integrations
 *
 * OAuth connections to external providers at the USER level (like Vercel).
 * NOT tied to any organization initially - completely personal.
 * User can then authorize these connections for use in specific organizations.
 */
export const integrations = pgTable(
  "lightfast_integrations",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    // User who owns this PERSONAL connection
    userId: varchar("user_id", { length: 191 }).notNull(),

    // Provider type (pgEnum for type safety)
    provider: integrationProviderEnum("provider").notNull(),

    // OAuth tokens (MUST be encrypted at application layer)
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at"),
    scopes: text("scopes").array(),

    // Provider-specific data (only what's returned during OAuth)
    providerData: jsonb("provider_data").$type<
      | {
          provider: "github";
          // Stores GitHub App installations (fetched after OAuth)
          installations?: {
            id: string;                    // GitHub installation ID
            accountId: string;             // GitHub account/org ID
            accountLogin: string;          // "acme-corp" or username
            accountType: "User" | "Organization";
            avatarUrl: string;
            permissions: Record<string, string>;
            installedAt: string;           // ISO timestamp
            lastValidatedAt: string;       // ISO timestamp
          }[];
        }
      | {
          provider: "notion";
          // OAuth returns workspace info
          workspaceId: string;
          workspaceName: string;
          workspaceIcon?: string;
          botId: string;
        }
      | {
          provider: "linear";
          // OAuth returns NO team data - just access to all public teams
        }
      | {
          provider: "sentry";
          // OAuth returns user info
          userId: string;
          userName?: string;
          userEmail?: string;
        }
    >().notNull(),

    // Sync tracking
    lastSyncAt: timestamp("last_sync_at"),
    nextSyncAt: timestamp("next_sync_at"),
    syncStatus: varchar("sync_status", { length: 50 }),
    errorMessage: text("error_message"),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Timestamps
    connectedAt: timestamp("connected_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdIdx: index("integration_user_id_idx").on(table.userId),
    providerIdx: index("integration_provider_idx").on(table.provider),
    isActiveIdx: index("integration_is_active_idx").on(table.isActive),
    // Unique: one connection per user per provider
    userProviderIdx: index("integration_user_provider_idx").on(table.userId, table.provider),
  })
);

/**
 * Organization Integration Authorizations
 *
 * Tracks which personal integrations are authorized for use in which organizations.
 * Like Vercel: User authorizes their personal GitHub connection for use in a team.
 */
export const organizationIntegrations = pgTable(
  "lightfast_organization_integrations",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    // FK to personal integration
    integrationId: varchar("integration_id", { length: 191 })
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),

    // Clerk organization ID (no FK - Clerk is source of truth)
    clerkOrgId: varchar("clerk_org_id", { length: 191 })
      .notNull(),

    // Who authorized this connection for the org
    authorizedBy: varchar("authorized_by", { length: 191 }).notNull(),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Timestamps
    authorizedAt: timestamp("authorized_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    integrationIdIdx: index("org_integration_integration_id_idx").on(table.integrationId),
    clerkOrgIdIdx: index("org_integration_clerk_org_id_idx").on(table.clerkOrgId),
    isActiveIdx: index("org_integration_is_active_idx").on(table.isActive),
    // Unique: one authorization per integration per organization
    uniqueIntegrationOrgIdx: index("org_integration_unique_idx").on(
      table.integrationId,
      table.clerkOrgId
    ),
  })
);

/**
 * Integration Resources
 *
 * Specific resources fetched from integrations (repos, teams, projects).
 * Fetched AFTER OAuth using the integration's access token.
 */
export const integrationResources = pgTable(
  "lightfast_integration_resources",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    // FK to integration
    integrationId: varchar("integration_id", { length: 191 })
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),

    // Resource type and data (discriminated union)
    resourceData: jsonb("resource_data").$type<
      | {
          provider: "github";
          type: "repository";
          installationId: string;        // GitHub App installation ID
          repoId: string;
          repoName: string;
          repoFullName: string;
          defaultBranch: string;
          isPrivate: boolean;
          isArchived: boolean;
        }
      | {
          provider: "notion";
          type: "page" | "database";
          pageId: string;
          pageName: string;
        }
      | {
          provider: "linear";
          type: "team";
          teamId: string;
          teamKey: string;
          teamName: string;
        }
      | {
          provider: "sentry";
          type: "project";
          orgSlug: string;
          projectSlug: string;
          projectId: string;
        }
    >().notNull(),

    // Sync tracking
    lastSyncedAt: timestamp("last_synced_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    integrationIdIdx: index("integration_resource_integration_id_idx").on(table.integrationId),
  })
);

/**
 * Workspace Integrations
 *
 * Links integration resources to Lightfast workspaces.
 * User connects specific resources (repos, teams, projects) to their workspace.
 */
export const workspaceIntegrations = pgTable(
  "lightfast_workspace_integrations",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    // FK to workspace
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    // FK to integration resource
    resourceId: varchar("resource_id", { length: 191 })
      .notNull()
      .references(() => integrationResources.id, { onDelete: "cascade" }),

    // Who connected this resource to the workspace
    connectedByUserId: varchar("connected_by_user_id", { length: 191 }).notNull(),

    // Sync configuration (provider-specific)
    syncConfig: jsonb("sync_config").$type<{
      // For code hosting (GitHub)
      branches?: string[];
      paths?: string[];

      // For all providers
      events?: string[];
      autoSync: boolean;
    }>().notNull(),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Sync tracking
    lastSyncedAt: timestamp("last_synced_at"),
    lastSyncStatus: varchar("last_sync_status", { length: 50 }),
    lastSyncError: text("last_sync_error"),

    connectedAt: timestamp("connected_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    workspaceIdIdx: index("workspace_integration_workspace_id_idx").on(table.workspaceId),
    resourceIdIdx: index("workspace_integration_resource_id_idx").on(table.resourceId),
    connectedByUserIdIdx: index("workspace_integration_connected_by_user_id_idx").on(table.connectedByUserId),
    isActiveIdx: index("workspace_integration_is_active_idx").on(table.isActive),
    // Unique: one resource per workspace
    uniqueWorkspaceResourceIdx: index("workspace_integration_unique_idx").on(
      table.workspaceId,
      table.resourceId
    ),
  })
);

// Type exports
export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;

export type OrganizationIntegration = typeof organizationIntegrations.$inferSelect;
export type NewOrganizationIntegration = typeof organizationIntegrations.$inferInsert;

export type IntegrationResource = typeof integrationResources.$inferSelect;
export type NewIntegrationResource = typeof integrationResources.$inferInsert;

export type WorkspaceIntegration = typeof workspaceIntegrations.$inferSelect;
export type NewWorkspaceIntegration = typeof workspaceIntegrations.$inferInsert;

// Discriminated union type helpers
export type GitHubIntegration = Integration & { provider: "github" };
export type NotionIntegration = Integration & { provider: "notion" };
export type LinearIntegration = Integration & { provider: "linear" };
export type SentryIntegration = Integration & { provider: "sentry" };
