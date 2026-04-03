import type { ProviderConfig, SourceType } from "@repo/app-providers";
import type { SourceIdentifier, SyncStatus } from "@repo/app-validation";
import { nanoid } from "@repo/lib";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { gatewayInstallations } from "./gateway-installations";

/**
 * Org Sources
 *
 * Specific resources actively syncing to an org.
 * This is what shows up on the "Sources" page in the UI.
 *
 * Flow:
 * 1. User picks a repo/team/project to connect
 * 2. We create an orgIntegration linking the installation to the org
 * 3. Background jobs sync data from this source
 *
 * Example: "acme/frontend repo syncing to acme org"
 */
export const orgIntegrations = pgTable(
  "lightfast_org_integrations",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    // Clerk org ID (no FK — Clerk is source of truth)
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    // Gateway installation FK (org-scoped)
    installationId: varchar("installation_id", { length: 191 })
      .notNull()
      .references(() => gatewayInstallations.id, { onDelete: "cascade" }),

    // Denormalized provider for fast filtering (replaces providerConfig.sourceType join)
    provider: varchar("provider", { length: 50 }).notNull().$type<SourceType>(),

    /**
     * Provider-specific type and sync settings (JSONB).
     *
     * Schema: providerConfigSchema from @repo/app-providers
     * Fields: provider, type, sync (events + autoSync), status (GitHub only)
     *
     * Resource IDs live in providerResourceId (indexed column), not here.
     */
    providerConfig: jsonb("provider_config").$type<ProviderConfig>().notNull(),

    /**
     * Fast lookup field for provider-specific resource IDs.
     * This is indexed for performance on queries like "find all sources for repoId X".
     *
     * Examples:
     * - GitHub: repoId (e.g., "567890123")
     * - Vercel: projectId (e.g., "prj_123456")
     */
    providerResourceId: varchar("provider_resource_id", { length: 191 })
      .notNull()
      .$type<SourceIdentifier>(),

    // Status
    status: varchar("status", { length: 50 }).notNull().default("active"),
    statusReason: varchar("status_reason", { length: 100 }),

    // Sync tracking
    lastSyncedAt: timestamp("last_synced_at", {
      mode: "string",
      withTimezone: true,
    }),
    lastSyncStatus: varchar("last_sync_status", {
      length: 50,
    }).$type<SyncStatus>(), // "success" | "failed" | "pending"
    lastSyncError: text("last_sync_error"),

    // Document count (denormalized for performance)
    documentCount: integer("document_count").notNull().default(0),

    // Timestamps
    connectedAt: timestamp("connected_at", {
      mode: "string",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    clerkOrgIdIdx: index("org_integration_clerk_org_id_idx").on(
      table.clerkOrgId
    ),
    installationIdIdx: index("org_integration_installation_id_idx").on(
      table.installationId
    ),
    statusIdx: index("org_integration_status_idx").on(table.status),
    providerResourceIdIdx: index("org_integration_provider_resource_id_idx").on(
      table.providerResourceId
    ),
  })
);

// Type exports
export type OrgIntegration = typeof orgIntegrations.$inferSelect;
export type InsertOrgIntegration = typeof orgIntegrations.$inferInsert;
