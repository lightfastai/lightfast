/**
 * Store table schema
 * Identity and config per (workspaceId, store)
 */

import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import type {
  EmbeddingProvider,
  PineconeMetric,
  PineconeCloud,
  PineconeRegion,
  ChunkMaxTokens,
  ChunkOverlap,
  EmbeddingModel,
} from "@repo/console-validation";

export const stores = pgTable(
  "lightfast_stores",
  {
    /** Unique identifier for the store */
    id: varchar("id", { length: 191 }).primaryKey(),
    /** Workspace ID this store belongs to */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** URL-safe store identifier (max 20 chars, lowercase alphanumeric + hyphens) */
    slug: varchar("slug", { length: 191 }).notNull(),
    /** Resolved Pinecone index name */
    indexName: varchar("index_name", { length: 191 }).notNull(),
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
    byWorkspace: index("idx_stores_ws").on(t.workspaceId),
    uniqueStore: uniqueIndex("uq_ws_slug").on(t.workspaceId, t.slug),
  }),
);

// Type exports
export type Store = typeof stores.$inferSelect;
export type InsertStore = typeof stores.$inferInsert;
