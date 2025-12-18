/**
 * Workspace Knowledge Documents table schema
 * Multi-source document storage (GitHub, Linear, Notion, Sentry, Vercel, Zendesk)
 *
 * Workspace-scoped: Documents belong directly to workspaces.
 */

import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { orgWorkspaces } from "./org-workspaces";
import type {
  SourceType,
  DocumentSlug,
  ContentHash,
} from "@repo/console-validation";

export const workspaceKnowledgeDocuments = pgTable(
  "lightfast_workspace_knowledge_documents",
  {
    /** Unique identifier for the document */
    id: varchar("id", { length: 191 }).primaryKey(),
    /** Workspace ID this document belongs to */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // Source identification (discriminated union)
    /** Source type - discriminator for union */
    sourceType: varchar("source_type", { length: 50 }).notNull().$type<SourceType>(),
    /** Source-specific identifier (e.g., issue ID, page ID, file path) */
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    /** Source-specific metadata (JSONB for flexibility) */
    sourceMetadata: jsonb("source_metadata").notNull(),

    // Document hierarchy
    /** Parent document ID for nested documents (e.g., comments under issue) */
    parentDocId: varchar("parent_doc_id", { length: 191 }),

    /** URL-friendly slug */
    slug: varchar("slug", { length: 256 }).notNull().$type<DocumentSlug>(),
    /** Content hash (SHA-256) of latest processed version */
    contentHash: varchar("content_hash", { length: 64 }).notNull().$type<ContentHash>(),
    /** Configuration hash (embedding + chunking) used when document was processed */
    configHash: varchar("config_hash", { length: 64 }).$type<ContentHash>(),
    /** Number of chunks in latest version */
    chunkCount: integer("chunk_count").notNull().default(0),

    // Cross-source relationships
    /** Relationships to other documents (e.g., mentions, links) */
    relationships: jsonb("relationships"),

    /** When the document was first created */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    /** When the document was last updated */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    byWorkspace: index("idx_docs_workspace").on(t.workspaceId),
    bySlug: index("idx_docs_workspace_slug").on(t.workspaceId, t.slug),
    bySourceType: index("idx_docs_source_type").on(t.sourceType),
    bySourceId: index("idx_docs_source_id").on(t.sourceType, t.sourceId),
    uniqueSourceDoc: uniqueIndex("uq_docs_workspace_source").on(
      t.workspaceId,
      t.sourceType,
      t.sourceId
    ),
  }),
);

// Type exports
export type WorkspaceKnowledgeDocument = typeof workspaceKnowledgeDocuments.$inferSelect;
export type InsertWorkspaceKnowledgeDocument = typeof workspaceKnowledgeDocuments.$inferInsert;

// Zod schema exports
