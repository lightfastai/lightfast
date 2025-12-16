import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
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
 * Actor Profiles - Unified Profiles for Workspace Contributors
 *
 * ## Architecture Overview
 *
 * This table stores unified profile data for each canonical actor. It works together
 * with `workspaceActorIdentities`:
 *
 * ```
 * workspaceActorIdentities                  workspaceActorProfiles (this table)
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
 * - Multi-source: GitHub, Vercel, future Lightfast usernames
 *
 * **Profiles table (this one)**: Stores unified profile data per canonical actor
 * - Stats: observation count, last active timestamp
 * - Display: name, avatar, email (for display only)
 * - Auth linking: `clerkUserId` links authenticated users to their actor
 *
 * ## Canonical Actor ID Format
 *
 * The `actorId` field uses format: `{source}:{sourceId}`
 * - GitHub: `github:12345678` (numeric ID, immutable)
 * - Vercel: Resolved to GitHub ID via commit SHA linkage
 *
 * GitHub numeric ID is the single source of truth for identity.
 *
 * ## Clerk User Linking
 *
 * The `clerkUserId` field links authenticated Clerk users to their actor profile:
 * - Clerk provides GitHub numeric ID via `externalAccounts[].providerUserId`
 * - Lazy linking: When user accesses workspace, profile is linked if exists
 * - Not an identity source: Clerk is auth layer, not event source
 *
 * ```
 * Clerk User (user_abc)
 *     │
 *     └── externalAccounts[oauth_github].providerUserId = "12345678"
 *                                                             │
 *                                                             ▼
 *                                         actorId = "github:12345678" ──→ Profile
 * ```
 *
 * ## Profile Creation Flow
 *
 * 1. GitHub webhook arrives (push, PR, etc.)
 * 2. Actor resolution extracts `sender.id` (numeric GitHub ID)
 * 3. Profile created/updated with `actorId = "github:{numericId}"`
 * 4. When Clerk user accesses workspace, `clerkUserId` is lazily linked
 *
 * @see workspaceActorIdentities - Cross-platform identity mapping
 * @see api/console/src/inngest/workflow/neural/profile-update.ts - Profile creation
 * @see api/console/src/lib/actor-linking.ts - Lazy Clerk user linking
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

    // Clerk user linking (for authenticated user → actor resolution)
    clerkUserId: varchar("clerk_user_id", { length: 191 }),

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

    // Index for Clerk user → actor profile lookup
    clerkUserIdx: index("actor_profile_clerk_user_idx").on(
      table.workspaceId,
      table.clerkUserId,
    ),
  }),
);

export type WorkspaceActorProfile = typeof workspaceActorProfiles.$inferSelect;
export type InsertWorkspaceActorProfile =
  typeof workspaceActorProfiles.$inferInsert;
