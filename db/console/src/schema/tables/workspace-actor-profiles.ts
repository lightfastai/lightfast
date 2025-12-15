import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Actor profiles - unified profiles for workspace contributors
 */
export const workspaceActorProfiles = pgTable(
  "lightfast_workspace_actor_profiles",
  {
    /**
     * Internal BIGINT primary key - maximum join/query performance
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * External identifier for API responses
     */
    externalId: varchar("external_id", { length: 21 })
      .notNull()
      .unique()
      .$defaultFn(() => nanoid()),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // Identity
    actorId: varchar("actor_id", { length: 191 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    avatarUrl: text("avatar_url"),

    // Expertise (future enhancement)
    expertiseDomains: jsonb("expertise_domains").$type<string[]>(),
    contributionTypes: jsonb("contribution_types").$type<string[]>(),
    activeHours: jsonb("active_hours").$type<Record<string, number>>(),
    frequentCollaborators: jsonb("frequent_collaborators").$type<string[]>(),

    // Embedding (future enhancement)
    profileEmbeddingId: varchar("profile_embedding_id", { length: 191 }),

    // Stats
    observationCount: integer("observation_count").notNull().default(0),
    lastActiveAt: timestamp("last_active_at", {
      mode: "string",
      withTimezone: true,
    }),
    profileConfidence: real("profile_confidence"),

    // Timestamps
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
    // External ID lookup (API requests)
    externalIdIdx: uniqueIndex("actor_profile_external_id_idx").on(table.externalId),

    // Unique constraint on workspace + actor
    uniqueActorIdx: uniqueIndex("actor_profile_unique_idx").on(
      table.workspaceId,
      table.actorId,
    ),

    // Index for finding profiles in workspace
    workspaceIdx: index("actor_profile_workspace_idx").on(table.workspaceId),

    // Index for finding recently active profiles
    lastActiveIdx: index("actor_profile_last_active_idx").on(
      table.workspaceId,
      table.lastActiveAt,
    ),
  }),
);

export type WorkspaceActorProfile = typeof workspaceActorProfiles.$inferSelect;
export type InsertWorkspaceActorProfile =
  typeof workspaceActorProfiles.$inferInsert;
