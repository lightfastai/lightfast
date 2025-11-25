/**
 * Workspace Knowledge Vector Chunks table schema
 * Mapping of doc chunks to vector IDs for idempotent upsert/delete
 *
 * Workspace-scoped: Vector chunks within a knowledge store.
 * Hierarchy: Workspace → Knowledge Store → Documents → Vector Chunks
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
import { workspaceStores } from "./workspace-stores";
import { workspaceKnowledgeDocuments } from "./workspace-knowledge-documents";
import type { ContentHash } from "@repo/console-validation";

export const workspaceKnowledgeVectorChunks = pgTable(
  "lightfast_workspace_knowledge_vector_chunks",
  {
    /** Vector ID used in Pinecone index (e.g., ${docId}#${chunkIndex}) */
    id: varchar("id", { length: 191 }).primaryKey(),
    /** Store ID this vector belongs to */
    storeId: varchar("store_id", { length: 191 })
      .notNull()
      .references(() => workspaceStores.id, { onDelete: "cascade" }),
    /** Document ID this chunk belongs to */
    docId: varchar("doc_id", { length: 191 })
      .notNull()
      .references(() => workspaceKnowledgeDocuments.id, { onDelete: "cascade" }),
    /** 0-based chunk index within document */
    chunkIndex: integer("chunk_index").notNull(),
    /** Content hash of document version */
    contentHash: varchar("content_hash", { length: 64 }).notNull().$type<ContentHash>(),
    /** When the vector was upserted */
    upsertedAt: timestamp("upserted_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    byStoreDoc: index("idx_vec_store_doc").on(t.storeId, t.docId),
    uniq: uniqueIndex("uq_vec_unique").on(
      t.storeId,
      t.docId,
      t.chunkIndex,
      t.contentHash,
    ),
  }),
);

// Type exports
export type WorkspaceKnowledgeVectorChunk = typeof workspaceKnowledgeVectorChunks.$inferSelect;
export type InsertWorkspaceKnowledgeVectorChunk = typeof workspaceKnowledgeVectorChunks.$inferInsert;

// Zod schema exports
