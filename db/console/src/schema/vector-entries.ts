/**
 * Vector entries table schema
 * Mapping of doc chunks to vector IDs for idempotent upsert/delete
 */

import { index, integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const vectorEntries = pgTable(
  "lf_vector_entries",
  {
    /** Vector ID used in Pinecone index (e.g., ${docId}#${chunkIndex}) */
    id: varchar("id", { length: 191 }).primaryKey(),
    /** Store ID this vector belongs to */
    storeId: varchar("store_id", { length: 191 }).notNull(),
    /** Document ID this chunk belongs to */
    docId: varchar("doc_id", { length: 191 }).notNull(),
    /** 0-based chunk index within document */
    chunkIndex: integer("chunk_index").notNull(),
    /** Content hash of document version */
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    /** Pinecone index name via Mastra */
    indexName: varchar("index_name", { length: 191 }).notNull(),
    /** When the vector was upserted */
    upsertedAt: timestamp("upserted_at", { withTimezone: false })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    byStoreDoc: index("idx_vec_store_doc").on(t.storeId, t.docId),
    uniq: uniqueIndex("uq_vec_unique").on(t.storeId, t.docId, t.chunkIndex, t.contentHash),
  })
);

// Type exports
export type VectorEntry = typeof vectorEntries.$inferSelect;
export type InsertVectorEntry = typeof vectorEntries.$inferInsert;

// Zod schema exports
export const insertVectorEntrySchema = createInsertSchema(vectorEntries);
export const selectVectorEntrySchema = createSelectSchema(vectorEntries);
