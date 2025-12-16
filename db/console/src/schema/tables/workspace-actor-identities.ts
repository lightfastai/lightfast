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
 * Actor Identities - Cross-Platform Identity Mapping
 *
 * ## Architecture Overview
 *
 * This table maps external identities (GitHub usernames, Vercel accounts, future Lightfast
 * usernames) to canonical actor IDs. It works together with `workspaceActorProfiles`:
 *
 * ```
 * workspaceActorIdentities (this table)     workspaceActorProfiles
 * ┌─────────────────────────────────────┐   ┌─────────────────────────────┐
 * │ source: "github"                    │   │ actorId: "github:12345678"  │
 * │ sourceId: "12345678"                │──▶│ displayName: "octocat"      │
 * │ canonicalActorId: "github:12345678" │   │ clerkUserId: "user_abc"     │
 * │ sourceUsername: "octocat"           │   │ observationCount: 42        │
 * └─────────────────────────────────────┘   └─────────────────────────────┘
 * ```
 *
 * ## Why Two Tables?
 *
 * **Identities table**: Maps multiple external identities → one canonical actor
 * - @mention search: Query `sourceUsername` to find actors by username
 * - Username history: Old usernames still resolve to the same actor
 * - Multi-source: GitHub, Vercel, future Lightfast usernames all map to one actor
 *
 * **Profiles table**: Stores unified profile data per canonical actor
 * - Stats: observation count, last active timestamp
 * - Display: name, avatar, email (for display only)
 * - Auth linking: `clerkUserId` links authenticated users to their actor
 *
 * ## Current vs Future Usage
 *
 * **Current:**
 * - GitHub identities (numeric ID as sourceId, username as sourceUsername)
 * - Vercel identities (resolved to GitHub via commit SHA linkage)
 * - @mention search via sourceUsername
 *
 * **Future (deferred):**
 * - Lightfast usernames: `{source: "lightfast", sourceUsername: "john-doe"}`
 * - Username history: Keep old GitHub usernames when users rename
 *
 * ## Key Relationships
 *
 * - `canonicalActorId` → `workspaceActorProfiles.actorId` (logical, not FK)
 * - One profile can have multiple identity records (same person, different usernames)
 * - GitHub numeric ID is the canonical identifier: `github:{numericId}`
 *
 * @see workspaceActorProfiles - Unified profile storage
 * @see api/console/src/inngest/workflow/neural/actor-resolution.ts - Identity resolution logic
 * @see apps/console/src/lib/neural/actor-search.ts - @mention search
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

    // Canonical actor ID (links to profiles.actorId, format: "source:sourceId")
    canonicalActorId: varchar("canonical_actor_id", { length: 191 }).notNull(),

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

    // Index for finding identities by canonical actor ID
    canonicalActorIdx: index("actor_identity_canonical_actor_idx").on(
      table.workspaceId,
      table.canonicalActorId,
    ),
  }),
);

export type WorkspaceActorIdentity =
  typeof workspaceActorIdentities.$inferSelect;
export type InsertWorkspaceActorIdentity =
  typeof workspaceActorIdentities.$inferInsert;
