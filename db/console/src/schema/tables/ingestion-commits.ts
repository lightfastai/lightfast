/**
 * Ingestion commits table schema
 * Idempotency and audit trail for push deliveries
 */

import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { stores } from "./stores";

export const ingestionCommits = pgTable(
  "lightfast_ingestion_commits",
  {
    /** Unique identifier for the commit record */
    id: varchar("id", { length: 191 }).primaryKey(),
    /** Store ID this commit belongs to */
    storeId: varchar("store_id", { length: 191 })
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    /** Git commit SHA before the push */
    beforeSha: varchar("before_sha", { length: 64 }).notNull(),
    /** Git commit SHA after the push */
    afterSha: varchar("after_sha", { length: 64 }).notNull(),
    /** Unique delivery/trigger ID for idempotency */
    deliveryId: varchar("delivery_id", { length: 191 }).notNull(),
    /** Ingestion source: github-webhook | manual | api | scheduled */
    source: varchar("source", { length: 32 }).notNull().default("github-webhook"),
    /** Processing status: processed | skipped | failed */
    status: varchar("status", { length: 16 }).notNull().default("processed"),
    /** When the commit was processed */
    processedAt: timestamp("processed_at", { withTimezone: false })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    byStore: index("idx_commits_store").on(t.storeId),
    bySource: index("idx_commits_source").on(t.source),
    uniqAfter: uniqueIndex("uq_commit_after").on(t.storeId, t.afterSha),
    uniqDelivery: uniqueIndex("uq_commit_delivery").on(t.storeId, t.deliveryId),
  }),
);

// Type exports
export type IngestionCommit = typeof ingestionCommits.$inferSelect;
export type InsertIngestionCommit = typeof ingestionCommits.$inferInsert;

// Zod schema exports
export const insertIngestionCommitSchema = createInsertSchema(ingestionCommits);
export const selectIngestionCommitSchema = createSelectSchema(ingestionCommits);
