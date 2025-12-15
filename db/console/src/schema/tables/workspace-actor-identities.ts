import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgTable,
  real,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Actor identities - cross-platform identity mapping
 */
export const workspaceActorIdentities = pgTable(
  "lightfast_workspace_actor_identities",
  {
    /**
     * Internal BIGINT primary key - maximum performance for identity mapping
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // Actor reference (links to profile)
    actorId: varchar("actor_id", { length: 191 }).notNull(),

    // Source identity
    source: varchar("source", { length: 50 }).notNull(),
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    sourceUsername: varchar("source_username", { length: 255 }),
    sourceEmail: varchar("source_email", { length: 255 }),

    // Mapping metadata
    mappingMethod: varchar("mapping_method", { length: 50 }).notNull(),
    confidenceScore: real("confidence_score").notNull(),
    mappedBy: varchar("mapped_by", { length: 191 }),
    mappedAt: timestamp("mapped_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Unique constraint on workspace + source + sourceId
    uniqueIdentityIdx: uniqueIndex("actor_identity_unique_idx").on(
      table.workspaceId,
      table.source,
      table.sourceId,
    ),

    // Index for finding identities by actor
    actorIdx: index("actor_identity_actor_idx").on(
      table.workspaceId,
      table.actorId,
    ),

    // Index for email-based lookups
    emailIdx: index("actor_identity_email_idx").on(
      table.workspaceId,
      table.sourceEmail,
    ),
  }),
);

export type WorkspaceActorIdentity =
  typeof workspaceActorIdentities.$inferSelect;
export type InsertWorkspaceActorIdentity =
  typeof workspaceActorIdentities.$inferInsert;
