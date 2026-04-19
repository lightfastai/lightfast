import { nanoid } from "@vendor/lib";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { orgIntegrations } from "./org-integrations";

/**
 * Org Repo Indexes — indexed repositories for AI context injection
 *
 * Day 1: caches README.md from the org's .lightfast GitHub repo and
 * injects it into the Answer agent's system prompt.
 *
 * Future: tracks sync state for full repo vector indexing via Pinecone
 * (layer: "repo-index"). The `cachedContent` column becomes deprecated
 * when retrieval moves to semantic search over Pinecone vectors.
 */
export const orgRepoIndexes = pgTable(
  "lightfast_org_repo_indexes",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    /** Clerk Org ID — one indexed repo per org (day 1) */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    /** FK to orgIntegrations — the connected .lightfast repo source */
    integrationId: varchar("integration_id", { length: 191 })
      .notNull()
      .references(() => orgIntegrations.id, { onDelete: "cascade" }),

    /** GitHub repo full name for display (e.g., "acme/.lightfast") */
    repoFullName: varchar("repo_full_name", { length: 255 }).notNull(),

    /** Denormalized numeric repo ID for webhook lookup */
    providerResourceId: varchar("provider_resource_id", {
      length: 191,
    }).notNull(),

    /**
     * Cached content for direct prompt injection (day 1: README.md).
     * Will be deprecated when retrieval moves to Pinecone vectors.
     */
    cachedContent: text("cached_content"),

    /** GitHub file SHA — for conditional fetching */
    contentSha: varchar("content_sha", { length: 64 }),

    /** Last synced git commit SHA — for incremental sync in Pinecone era */
    lastSyncCommitSha: varchar("last_sync_commit_sha", { length: 64 }),

    /** Whether continuous sync is active */
    isActive: boolean("is_active").notNull().default(true),

    /** Indexing status — tracks sync lifecycle */
    indexingStatus: varchar("indexing_status", { length: 50 })
      .notNull()
      .default("idle"),

    /** Last successful sync timestamp */
    lastSyncedAt: timestamp("last_synced_at", {
      mode: "string",
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    clerkOrgIdIdx: uniqueIndex("org_repo_index_clerk_org_id_idx").on(
      table.clerkOrgId
    ),
    integrationIdIdx: index("org_repo_index_integration_id_idx").on(
      table.integrationId
    ),
    providerResourceIdIdx: index("org_repo_index_provider_resource_id_idx").on(
      table.providerResourceId
    ),
  })
);

export type OrgRepoIndex = typeof orgRepoIndexes.$inferSelect;
export type InsertOrgRepoIndex = typeof orgRepoIndexes.$inferInsert;
