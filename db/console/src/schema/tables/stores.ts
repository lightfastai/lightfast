/**
 * Store table schema
 * Identity and config per (workspaceId, store)
 */

import { index, integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const stores = pgTable(
  "lightfast_stores",
  {
    /** Unique identifier for the store */
    id: varchar("id", { length: 191 }).primaryKey(),
    /** Workspace ID this store belongs to */
    workspaceId: varchar("workspace_id", { length: 191 }).notNull(),
    /** Human-readable store name */
    name: varchar("name", { length: 191 }).notNull(),
    /** Resolved Pinecone index name */
    indexName: varchar("index_name", { length: 191 }).notNull(),
    /** Embedding dimension (default 1536) */
    embeddingDim: integer("embedding_dim").notNull().default(1536),
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
    uniqueStore: uniqueIndex("uq_ws_name").on(t.workspaceId, t.name),
  })
);

// Type exports
export type Store = typeof stores.$inferSelect;
export type InsertStore = typeof stores.$inferInsert;

// Zod schema exports
export const insertStoreSchema = createInsertSchema(stores);
export const selectStoreSchema = createSelectSchema(stores);
