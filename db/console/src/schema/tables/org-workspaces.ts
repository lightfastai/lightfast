import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import type {
  ClerkOrgId,
  EmbeddingProvider,
  PineconeMetric,
  PineconeCloud,
  PineconeRegion,
  ChunkMaxTokens,
  ChunkOverlap,
  EmbeddingModel,
  PineconeIndexName,
} from "@repo/console-validation";

/**
 * Organization Workspaces table represents isolated knowledge bases within an organization.
 *
 * Org-scoped: Each workspace belongs to a Clerk organization.
 *
 * Architecture:
 * - **name**: User-facing identifier used in URLs (e.g., "my-project", "api.v2")
 *   - Follows GitHub repo naming rules: alphanumeric + hyphens/periods/underscores
 *   - Unique per organization
 *   - Max 100 chars
 * - **slug**: Internal identifier, auto-generated, never shown to users
 *   - Used for Pinecone index naming: ws-{slug}-{store}
 *   - Lowercase alphanumeric + hyphens only
 *   - Max 20 chars (Pinecone constraint)
 *
 * Design:
 * - Each workspace is a separate Pinecone index/namespace
 * - Repositories can be assigned to workspaces
 * - Search/contents queries are scoped to workspace
 * - All workspaces are explicitly created by users at /new
 */
export const orgWorkspaces = pgTable(
  "lightfast_org_workspaces",
  {
    /**
     * Unique workspace identifier (nanoid)
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    /**
     * Clerk organization ID (no FK - Clerk is source of truth)
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 })
      .notNull()
      .$type<ClerkOrgId>(),

    /**
     * User-facing workspace name (used in URLs)
     * Follows GitHub repo naming: alphanumeric + hyphens/periods/underscores
     * Unique per organization, max 100 chars
     * Examples: "my-project", "api.v2", "awesome_workspace"
     */
    name: varchar("name", { length: 191 }).notNull(),

    /**
     * Internal workspace identifier (never shown to users)
     * Auto-generated, used for Pinecone index naming: ws-{slug}-{store}
     * Lowercase alphanumeric + hyphens, max 20 chars
     * Examples: "robust-chicken", "my-project", "api-v2"
     */
    slug: varchar("slug", { length: 191 }).notNull(),

    /**
     * Workspace-level settings and configuration
     * Structure (Phase 2):
     * {
     *   repositories: { [repoId]: { enabled: boolean } },
     *   defaults: { patterns: string[], ignore: string[] },
     *   features: { codeIndexing: boolean, multiLanguage: boolean }
     * }
     */
    settings: jsonb("settings").$type<WorkspaceSettings>(),

    // ========== VECTOR STORAGE CONFIGURATION (previously on workspace_stores) ==========

    /**
     * Shared Pinecone index name (references PRIVATE_CONFIG.pinecone.indexes)
     * Points to shared index like "lightfast-production-v1"
     */
    indexName: varchar("index_name", { length: 191 }).$type<PineconeIndexName>(),

    /**
     * Hierarchical namespace name within the shared index
     * Format: org_{clerkOrgId}:ws_{workspaceId}
     * Example: "org_org123:ws_abc456"
     * This identifies the workspace's data in Pinecone
     */
    namespaceName: varchar("namespace_name", { length: 191 }),

    /** Embedding dimension (default: 1024 for Cohere embed-english-v3.0) */
    embeddingDim: integer("embedding_dim").notNull().default(1024),

    /** Embedding model used (validated against provider) */
    embeddingModel: varchar("embedding_model", { length: 100 })
      .notNull()
      .default("embed-english-v3.0")
      .$type<EmbeddingModel>(),

    /** Embedding provider */
    embeddingProvider: varchar("embedding_provider", { length: 50 })
      .notNull()
      .default("cohere")
      .$type<EmbeddingProvider>(),

    /** Pinecone vector similarity metric */
    pineconeMetric: varchar("pinecone_metric", { length: 50 })
      .notNull()
      .default("cosine")
      .$type<PineconeMetric>(),

    /** Pinecone cloud provider */
    pineconeCloud: varchar("pinecone_cloud", { length: 50 })
      .notNull()
      .default("aws")
      .$type<PineconeCloud>(),

    /** Pinecone region (validated format: provider-region-zone, e.g., us-east-1) */
    pineconeRegion: varchar("pinecone_region", { length: 50 })
      .notNull()
      .default("us-east-1")
      .$type<PineconeRegion>(),

    /** Maximum tokens per chunk (64-4096) */
    chunkMaxTokens: integer("chunk_max_tokens").notNull().default(512).$type<ChunkMaxTokens>(),

    /** Token overlap between chunks (0-1024, must be < chunkMaxTokens) */
    chunkOverlap: integer("chunk_overlap").notNull().default(50).$type<ChunkOverlap>(),

    /**
     * Timestamp when workspace was created
     */
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Timestamp when workspace was last updated
     */
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for finding all workspaces in a Clerk organization
    clerkOrgIdIdx: index("workspace_clerk_org_id_idx").on(table.clerkOrgId),

    // Unique constraint: one name per organization (names are user-facing)
    orgNameIdx: uniqueIndex("workspace_org_name_idx").on(
      table.clerkOrgId,
      table.name,
    ),

    // Index on slug for internal lookups (not unique globally)
    slugIdx: index("workspace_slug_idx").on(table.slug),
  }),
);

// TypeScript type for settings
export interface WorkspaceSettings {
  repositories?: {
    [repoId: string]: {
      enabled: boolean;
    };
  };
  defaults?: {
    patterns?: string[];
    ignore?: string[];
  };
  features?: {
    codeIndexing?: boolean;
    multiLanguage?: boolean;
  };
}

// Type exports
export type OrgWorkspace = typeof orgWorkspaces.$inferSelect;
export type InsertOrgWorkspace = typeof orgWorkspaces.$inferInsert;
