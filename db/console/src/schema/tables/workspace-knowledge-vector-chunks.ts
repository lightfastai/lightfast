/**
 * Workspace Knowledge Vector Chunks table schema
 * Mapping of doc chunks to vector IDs for idempotent upsert/delete
 *
 * Workspace-scoped: Vector chunks belong directly to workspaces.
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
import { orgWorkspaces } from "./org-workspaces";
import { workspaceKnowledgeDocuments } from "./workspace-knowledge-documents";
import type { ContentHash } from "@repo/console-validation";

export const workspaceKnowledgeVectorChunks = pgTable(
  "lightfast_workspace_knowledge_vector_chunks",
  {
    /** Vector ID used in Pinecone index (e.g., ${docId}#${chunkIndex}) */
    id: varchar("id", { length: 191 }).primaryKey(),
    /** Workspace ID this vector belongs to */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
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
    byWorkspaceDoc: index("idx_vec_workspace_doc").on(t.workspaceId, t.docId),
    uniq: uniqueIndex("uq_vec_unique").on(
      t.workspaceId,
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
