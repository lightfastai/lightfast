/**
 * Store table schema
 * Identity and config per (workspaceId, store)
 */

import {
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { workspaces } from "./workspaces";

/**
 * Embedding provider enum - defines valid embedding providers
 * SOURCE OF TRUTH for embedding provider types across the system
 */
export const embeddingProviderEnum = pgEnum("embedding_provider", ["cohere"]);

/**
 * Pinecone metric enum - defines valid vector similarity metrics
 * SOURCE OF TRUTH for pinecone metric types across the system
 */
export const pineconeMetricEnum = pgEnum("pinecone_metric", [
  "cosine",
  "euclidean",
  "dotproduct",
]);

/**
 * Pinecone cloud enum - defines valid cloud providers
 * SOURCE OF TRUTH for pinecone cloud types across the system
 */
export const pineconeCloudEnum = pgEnum("pinecone_cloud", [
  "aws",
  "gcp",
  "azure",
]);

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
    /** Pinecone vector similarity metric - enum enforced at DB level */
    pineconeMetric: pineconeMetricEnum("pinecone_metric").notNull(),
    /** Pinecone cloud provider - enum enforced at DB level */
    pineconeCloud: pineconeCloudEnum("pinecone_cloud").notNull(),
    /** Pinecone region */
    pineconeRegion: varchar("pinecone_region", { length: 50 }).notNull(),

    // Document chunking configuration
    /** Maximum tokens per chunk - no default, must be provided by API layer */
    chunkMaxTokens: integer("chunk_max_tokens").notNull(),
    /** Token overlap between chunks - no default, must be provided by API layer */
    chunkOverlap: integer("chunk_overlap").notNull(),

    // Embedding provider configuration
    /** Embedding model used - no default, must be provided by API layer */
    embeddingModel: varchar("embedding_model", { length: 100 }).notNull(),
    /** Embedding provider - enum enforced at DB level */
    embeddingProvider: embeddingProviderEnum("embedding_provider").notNull(),

    /** When the store was created */
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .default(sql`now()`),
    /** When the store was last updated */
    updatedAt: timestamp("updated_at", { withTimezone: false })
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

// Zod schema exports
export const insertStoreSchema = createInsertSchema(stores).refine(
  (data) => {
    // Validate store slug format (lowercase alphanumeric + hyphens, max 20 chars)
    const slug = data.slug;
    if (!slug) return true; // Allow empty during optional create

    return (
      /^[a-z0-9-]+$/.test(slug) && // Only lowercase alphanumeric + hyphens
      !/^-|-$|--/.test(slug) &&    // No leading/trailing/consecutive hyphens
      slug.length <= 20            // Max 20 chars
    );
  },
  {
    message:
      "Store slug must be lowercase alphanumeric with hyphens only, no leading/trailing/consecutive hyphens, max 20 chars",
    path: ["slug"],
  }
);
export const selectStoreSchema = createSelectSchema(stores);
