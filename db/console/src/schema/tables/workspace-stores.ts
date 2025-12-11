/**
 * Store table schema
 * Single store per workspace - identified by workspaceId
 *
 * Architecture:
 * - All stores share indexes from PRIVATE_CONFIG (e.g., "lightfast-production-v1")
 * - Each workspace has exactly one store
 * - Store ID = workspaceId (1:1 relationship)
 * - Namespace format: org_{clerkOrgId}:ws_{workspaceId}
 */

import {
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { orgWorkspaces } from "./org-workspaces";
import type {
  EmbeddingProvider,
  PineconeMetric,
  PineconeCloud,
  PineconeRegion,
  ChunkMaxTokens,
  ChunkOverlap,
  EmbeddingModel,
  PineconeIndexName,
} from "@repo/console-validation";

export const workspaceStores = pgTable(
  "lightfast_workspace_stores",
  {
    /** Unique identifier for the store */
    id: varchar("id", { length: 191 }).primaryKey(),
    /** Workspace ID this store belongs to (1:1 relationship, store.id = workspaceId) */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    /**
     * Shared Pinecone index name (references PRIVATE_CONFIG.pinecone.indexes)
     * Points to shared index like "lightfast-production-v1"
     */
    indexName: varchar("index_name", { length: 191 }).notNull().$type<PineconeIndexName>(),

    /**
     * Hierarchical namespace name within the shared index
     * Format: org_{clerkOrgId}:ws_{workspaceId}
     * Example: "org_org123:ws_abc456"
     * This identifies the workspace's data in Pinecone
     */
    namespaceName: varchar("namespace_name", { length: 191 }).notNull(),

    /** Embedding dimension - no default, must be provided by API layer */
    embeddingDim: integer("embedding_dim").notNull(),

    // Hidden config fields (not exposed in lightfast.yml yet)
    // Pinecone infrastructure configuration
    /** Pinecone vector similarity metric */
    pineconeMetric: varchar("pinecone_metric", { length: 50 }).notNull().$type<PineconeMetric>(),
    /** Pinecone cloud provider */
    pineconeCloud: varchar("pinecone_cloud", { length: 50 }).notNull().$type<PineconeCloud>(),
    /** Pinecone region (validated format: provider-region-zone, e.g., us-east-1) */
    pineconeRegion: varchar("pinecone_region", { length: 50 }).notNull().$type<PineconeRegion>(),

    // Document chunking configuration
    /** Maximum tokens per chunk (64-4096, no default, must be provided by API layer) */
    chunkMaxTokens: integer("chunk_max_tokens").notNull().$type<ChunkMaxTokens>(),
    /** Token overlap between chunks (0-1024, must be < chunkMaxTokens, no default) */
    chunkOverlap: integer("chunk_overlap").notNull().$type<ChunkOverlap>(),

    // Embedding provider configuration
    /** Embedding model used (validated against provider, no default) */
    embeddingModel: varchar("embedding_model", { length: 100 }).notNull().$type<EmbeddingModel>(),
    /** Embedding provider */
    embeddingProvider: varchar("embedding_provider", { length: 50 }).notNull().$type<EmbeddingProvider>(),

    /** When the store was created */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    /** When the store was last updated */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    // Each workspace has exactly one store, enforced by unique constraint
    uniqueWorkspace: uniqueIndex("uq_ws_store").on(t.workspaceId),
  }),
);

// Type exports
export type WorkspaceStore = typeof workspaceStores.$inferSelect;
export type InsertWorkspaceStore = typeof workspaceStores.$inferInsert;
