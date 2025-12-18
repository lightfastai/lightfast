import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Org-Level Actor Identities - Cross-Platform Identity Mapping
 *
 * ## Architecture Overview
 *
 * This table maps external identities (GitHub usernames, Vercel accounts, future Lightfast
 * usernames) to canonical actor IDs at the ORGANIZATION level.
 *
 * Identity is org-invariant: "octocat" in workspace A is the same person as in workspace B.
 * Activity is workspace-specific: tracked separately in workspaceActorProfiles.
 *
 * ```
 * orgActorIdentities (this table)              workspaceActorProfiles
 * ┌─────────────────────────────────────┐      ┌─────────────────────────────┐
 * │ clerkOrgId: "org_abc"               │      │ workspaceId: "ws_prod"      │
 * │ source: "github"                    │      │ actorId: "github:12345678"  │
 * │ sourceId: "12345678"                │──────│ displayName: "octocat"      │
 * │ canonicalActorId: "github:12345678" │      │ observationCount: 42        │
 * │ sourceUsername: "octocat"           │      └─────────────────────────────┘
 * │ clerkUserId: "user_xyz"             │
 * └─────────────────────────────────────┘
 * ```
 *
 * ## Why Org-Level?
 *
 * - **Single source of truth**: Identity mapping is an organizational fact
 * - **No duplication**: One record per actor per org, not per workspace
 * - **Simpler Clerk linking**: Link once per org, not per workspace
 * - **Better @mention search**: Search org-level for all known actors
 *
 * ## Clerk User Linking
 *
 * The `clerkUserId` field links authenticated Clerk users to their identity:
 * - Clerk provides GitHub numeric ID via `externalAccounts[].providerUserId`
 * - Linking happens once when user first accesses ANY workspace in the org
 * - All workspaces automatically know this user's identity
 *
 * @see workspaceActorProfiles - Workspace-specific activity tracking
 * @see api/console/src/lib/actor-linking.ts - Org-level Clerk user linking
 */
export const orgActorIdentities = pgTable(
  "lightfast_org_actor_identities",
  {
    /**
     * Internal BIGINT primary key - maximum performance for identity mapping
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * Clerk organization ID (no FK - Clerk is source of truth)
     * Scoping is at org level, not workspace level
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    /**
     * Canonical actor ID (links to profiles.actorId, format: "source:sourceId")
     * Example: "github:12345678"
     */
    canonicalActorId: varchar("canonical_actor_id", { length: 191 }).notNull(),

    // Source identity
    source: varchar("source", { length: 50 }).notNull(),
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    sourceUsername: varchar("source_username", { length: 255 }),
    sourceEmail: varchar("source_email", { length: 255 }),

    /**
     * Avatar URL - moved from profiles since it's identity, not activity
     */
    avatarUrl: text("avatar_url"),

    /**
     * Clerk user ID - links authenticated Clerk user to this identity
     * Moved from profiles: linking is org-level, not workspace-level
     */
    clerkUserId: varchar("clerk_user_id", { length: 191 }),

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
    // Unique constraint on org + source + sourceId (one identity per actor per org)
    uniqueIdentityIdx: uniqueIndex("org_actor_identity_unique_idx").on(
      table.clerkOrgId,
      table.source,
      table.sourceId,
    ),

    // Index for finding identities by canonical actor ID
    canonicalActorIdx: index("org_actor_identity_canonical_idx").on(
      table.clerkOrgId,
      table.canonicalActorId,
    ),

    // Index for Clerk user lookup (org-level)
    clerkUserIdx: index("org_actor_identity_clerk_user_idx").on(
      table.clerkOrgId,
      table.clerkUserId,
    ),

    // Index for @mention search by username
    usernameIdx: index("org_actor_identity_username_idx").on(
      table.clerkOrgId,
      table.sourceUsername,
    ),
  }),
);

export type OrgActorIdentity = typeof orgActorIdentities.$inferSelect;
export type InsertOrgActorIdentity = typeof orgActorIdentities.$inferInsert;
