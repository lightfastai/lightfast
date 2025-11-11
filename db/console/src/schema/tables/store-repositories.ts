/**
 * Store repositories table
 * Links GitHub repositories to the store that owns their embeddings
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
import { randomUUID } from "node:crypto";

import { stores } from "./stores";

export const storeRepositories = pgTable(
  "lightfast_store_repositories",
  {
    /** Unique identifier for the link */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    /** Store this repository feeds */
    storeId: varchar("store_id", { length: 191 })
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    /** Immutable GitHub repository ID */
    githubRepoId: varchar("github_repo_id", { length: 191 }).notNull(),
    /** Latest known repo full name (owner/name) */
    repoFullName: varchar("repo_full_name", { length: 512 }).notNull(),
    /** Linking timestamp */
    linkedAt: timestamp("linked_at", { withTimezone: false })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    storeIdx: index("idx_store_repo_store").on(table.storeId),
    repoUnique: uniqueIndex("uq_store_repo_repo").on(table.githubRepoId),
  }),
);

export type StoreRepository = typeof storeRepositories.$inferSelect;
export type InsertStoreRepository = typeof storeRepositories.$inferInsert;

export const insertStoreRepositorySchema =
  createInsertSchema(storeRepositories);
export const selectStoreRepositorySchema =
  createSelectSchema(storeRepositories);
