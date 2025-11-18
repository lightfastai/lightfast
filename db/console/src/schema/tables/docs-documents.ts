/**
 * Documents table schema
 * Multi-source document storage (GitHub, Linear, Notion, Sentry, Vercel, Zendesk)
 */

import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { stores } from "./stores";

/**
 * Source type enum - defines all supported integration sources
 */
export const sourceTypeEnum = pgEnum("source_type", [
  "github",
  "linear",
  "notion",
  "sentry",
  "vercel",
  "zendesk",
]);

export const docsDocuments = pgTable(
  "lightfast_docs_documents",
  {
    /** Unique identifier for the document */
    id: varchar("id", { length: 191 }).primaryKey(),
    /** Store ID this document belongs to */
    storeId: varchar("store_id", { length: 191 })
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),

    // Source identification (discriminated union)
    /** Source type - discriminator for union */
    sourceType: sourceTypeEnum("source_type").notNull(),
    /** Source-specific identifier (e.g., issue ID, page ID, file path) */
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    /** Source-specific metadata (JSONB for flexibility) */
    sourceMetadata: jsonb("source_metadata").notNull(),

    // Document hierarchy
    /** Parent document ID for nested documents (e.g., comments under issue) */
    parentDocId: varchar("parent_doc_id", { length: 191 }),

    /** URL-friendly slug */
    slug: varchar("slug", { length: 256 }).notNull(),
    /** Content hash (SHA-256) of latest processed version */
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    /** Configuration hash (embedding + chunking) used when document was processed */
    configHash: varchar("config_hash", { length: 64 }),
    /** Number of chunks in latest version */
    chunkCount: integer("chunk_count").notNull().default(0),

    // Cross-source relationships
    /** Relationships to other documents (e.g., mentions, links) */
    relationships: jsonb("relationships"),

    /** When the document was first created */
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .default(sql`now()`),
    /** When the document was last updated */
    updatedAt: timestamp("updated_at", { withTimezone: false })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    byStore: index("idx_docs_store").on(t.storeId),
    bySlug: index("idx_docs_store_slug").on(t.storeId, t.slug),
    bySourceType: index("idx_docs_source_type").on(t.sourceType),
    bySourceId: index("idx_docs_source_id").on(t.sourceType, t.sourceId),
    uniqueSourceDoc: uniqueIndex("uq_docs_store_source").on(
      t.storeId,
      t.sourceType,
      t.sourceId
    ),
  }),
);

// Type exports
export type DocsDocument = typeof docsDocuments.$inferSelect;
export type InsertDocsDocument = typeof docsDocuments.$inferInsert;

// Zod schema exports
export const insertDocsDocumentSchema = createInsertSchema(docsDocuments);
export const selectDocsDocumentSchema = createSelectSchema(docsDocuments);
