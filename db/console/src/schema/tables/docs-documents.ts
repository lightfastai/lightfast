/**
 * Documents table schema
 * Latest version state per repo-relative file path
 */

import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { stores } from "./stores";

export const docsDocuments = pgTable(
  "lightfast_docs_documents",
  {
    /** Unique identifier for the document */
    id: varchar("id", { length: 191 }).primaryKey(),
    /** Store ID this document belongs to */
    storeId: varchar("store_id", { length: 191 })
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    /** Repo-relative file path */
    path: varchar("path", { length: 512 }).notNull(),
    /** URL-friendly slug */
    slug: varchar("slug", { length: 256 }).notNull(),
    /** Document title */
    title: varchar("title", { length: 256 }),
    /** Document description */
    description: text("description"),
    /** Content hash (SHA-256) of latest processed version */
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    /** Git commit SHA of last processed commit */
    commitSha: varchar("commit_sha", { length: 64 }).notNull(),
    /** When the commit occurred */
    committedAt: timestamp("committed_at", { withTimezone: false })
      .notNull()
      .default(sql`now()`),
    /** Parsed frontmatter from MDX */
    frontmatter: jsonb("frontmatter"),
    /** Number of chunks in latest version */
    chunkCount: integer("chunk_count").notNull().default(0),
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
    uniquePath: uniqueIndex("uq_docs_store_path").on(t.storeId, t.path),
  }),
);

// Type exports
export type DocsDocument = typeof docsDocuments.$inferSelect;
export type InsertDocsDocument = typeof docsDocuments.$inferInsert;

// Zod schema exports
export const insertDocsDocumentSchema = createInsertSchema(docsDocuments);
export const selectDocsDocumentSchema = createSelectSchema(docsDocuments);
