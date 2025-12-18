import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  pgTable,
  real,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Actor Profiles - Workspace-Specific Activity Tracking
 *
 * ## Architecture Overview
 *
 * This table stores workspace-specific activity data for each canonical actor.
 * Identity data (username, avatar, Clerk linking) is now in `orgActorIdentities`.
 *
 * ```
 * orgActorIdentities (org-scoped)              workspaceActorProfiles (this table)
 * ┌─────────────────────────────────────┐      ┌─────────────────────────────┐
 * │ clerkOrgId: "org_abc"               │      │ workspaceId: "ws_prod"      │
 * │ source: "github"                    │      │ actorId: "github:12345678"  │
 * │ sourceId: "12345678"                │──────│ displayName: "octocat"      │
 * │ canonicalActorId: "github:12345678" │      │ observationCount: 42        │
 * │ sourceUsername: "octocat"           │      │ lastActiveAt: "2025-..."    │
 * │ avatarUrl: "https://..."            │      └─────────────────────────────┘
 * │ clerkUserId: "user_xyz"             │
 * └─────────────────────────────────────┘
 * ```
 *
 * ## Why Two Tables?
 *
 * **Identity is org-invariant**: "octocat" is the same person across all workspaces.
 * - `orgActorIdentities`: Username, avatar, Clerk user linking (one per org)
 *
 * **Activity is workspace-specific**: Different stats per workspace.
 * - `workspaceActorProfiles` (this table): Observation count, last active (per workspace)
 *
 * ## Canonical Actor ID Format
 *
 * The `actorId` field uses format: `{source}:{sourceId}`
 * - GitHub: `github:12345678` (numeric ID, immutable)
 * - Vercel: Resolved to GitHub ID via commit SHA linkage
 *
 * ## Profile Creation Flow
 *
 * 1. GitHub webhook arrives (push, PR, etc.)
 * 2. Actor resolution extracts `sender.id` (numeric GitHub ID)
 * 3. Identity created/updated in `orgActorIdentities` (org-level)
 * 4. Profile created/updated here with activity stats (workspace-level)
 *
 * @see orgActorIdentities - Org-level identity mapping (username, avatar, Clerk linking)
 * @see api/console/src/inngest/workflow/neural/profile-update.ts - Profile creation
 * @see api/console/src/lib/actor-identity.ts - Identity upsert
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

    // Identity reference
    actorId: varchar("actor_id", { length: 191 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    // Note: avatarUrl moved to orgActorIdentities (identity, not activity)
    // Note: clerkUserId moved to orgActorIdentities (org-level linking)

    // Stats (workspace-specific activity)
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
    externalIdIdx: uniqueIndex("actor_profile_external_id_idx").on(
      table.externalId
    ),

    // Unique constraint on workspace + actor
    uniqueActorIdx: uniqueIndex("actor_profile_unique_idx").on(
      table.workspaceId,
      table.actorId
    ),

    // Index for finding profiles in workspace
    workspaceIdx: index("actor_profile_workspace_idx").on(table.workspaceId),

    // Index for finding recently active profiles
    lastActiveIdx: index("actor_profile_last_active_idx").on(
      table.workspaceId,
      table.lastActiveAt
    ),
    // Note: clerkUserIdx removed - Clerk user lookup is now org-level via orgActorIdentities
  })
);

export type WorkspaceActorProfile = typeof workspaceActorProfiles.$inferSelect;
export type InsertWorkspaceActorProfile =
  typeof workspaceActorProfiles.$inferInsert;
