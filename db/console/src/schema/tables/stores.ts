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
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { workspaces } from "./workspaces";

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
    /** Embedding dimension (default 1536) */
    embeddingDim: integer("embedding_dim").notNull().default(1536),

    // Hidden config fields (not exposed in lightfast.yml yet)
    // Pinecone infrastructure configuration
    /** Pinecone vector similarity metric */
    pineconeMetric: varchar("pinecone_metric", { length: 20 }).notNull().default("cosine"),
    /** Pinecone cloud provider */
    pineconeCloud: varchar("pinecone_cloud", { length: 20 }).notNull().default("aws"),
    /** Pinecone region */
    pineconeRegion: varchar("pinecone_region", { length: 50 }).notNull().default("us-west-2"),

    // Document chunking configuration
    /** Maximum tokens per chunk */
    chunkMaxTokens: integer("chunk_max_tokens").notNull().default(512),
    /** Token overlap between chunks */
    chunkOverlap: integer("chunk_overlap").notNull().default(50),

    // Embedding provider configuration (informational)
    /** Embedding model used */
    embeddingModel: varchar("embedding_model", { length: 100 }).notNull().default("char-hash-1536"),
    /** Embedding provider */
    embeddingProvider: varchar("embedding_provider", { length: 50 }).notNull().default("charHash"),

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
