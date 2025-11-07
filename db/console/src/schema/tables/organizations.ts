import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { randomUUID } from "node:crypto";

/**
 * Organizations table
 *
 * Represents GitHub organizations that have been claimed in Deus.
 * One GitHub organization = one Deus workspace.
 * Linked to Clerk organizations for billing and user management.
 *
 * KEY DESIGN DECISIONS:
 * - githubOrgId is UNIQUE (immutable, never changes)
 * - githubInstallationId is NOT unique (can change if app reinstalled)
 * - githubOrgSlug is NOT unique (can change if org renamed on GitHub)
 * - clerkOrgId is UNIQUE (links to Clerk organization for billing/auth)
 * - We use index on slug for fast lookups, but allow duplicates for history
 */
export const organizations = pgTable(
  "lightfast_deus_organizations",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => randomUUID()),

    // GitHub App installation details
    // IMMUTABLE: GitHub's internal org ID - this is our source of truth
    githubOrgId: integer("github_org_id").notNull().unique(),

    // Can change if app is reinstalled to same org
    githubInstallationId: integer("github_installation_id").notNull(),

    // Can change if org is renamed on GitHub
    githubOrgSlug: varchar("github_org_slug", { length: 255 }).notNull(),
    githubOrgName: varchar("github_org_name", { length: 255 }).notNull(),
    githubOrgAvatarUrl: text("github_org_avatar_url"),

    // Clerk organization integration
    // UNIQUE: Links to Clerk organization for user management and future billing
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).unique(),
    clerkOrgSlug: varchar("clerk_org_slug", { length: 255 }),

    // Ownership tracking
    claimedBy: varchar("claimed_by", { length: 191 }).notNull(), // Clerk user ID
    claimedAt: timestamp("claimed_at", { mode: "string", withTimezone: false })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "string", withTimezone: false })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: false })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for fast slug lookups (most common query pattern)
    slugIdx: index("org_slug_idx").on(table.githubOrgSlug),
    // Index for installation lookups
    installationIdx: index("org_installation_idx").on(
      table.githubInstallationId,
    ),
    // Index for Clerk org lookups
    clerkOrgIdx: index("org_clerk_org_idx").on(table.clerkOrgId),
  }),
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
