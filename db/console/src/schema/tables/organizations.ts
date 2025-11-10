import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Organizations table
 *
 * Represents GitHub organizations that have been claimed in Lightfast.
 * One GitHub organization = one Lightfast organization.
 * Clerk organization is the source of truth - we use Clerk org ID as primary key.
 *
 * KEY DESIGN DECISIONS:
 * - id is Clerk org ID (source of truth for organization identity)
 * - githubOrgId is UNIQUE (immutable, never changes)
 * - githubInstallationId is NOT unique (can change if app reinstalled)
 * - githubOrgSlug is NOT unique (can change if org renamed on GitHub)
 * - We use index on slug for fast lookups, but allow duplicates for history
 */
export const organizations = pgTable(
  "lightfast_organizations",
  {
    // Clerk organization ID - this is our primary key and source of truth
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey(),

    // Clerk organization slug (can change if org renamed in Clerk)
    clerkOrgSlug: varchar("clerk_org_slug", { length: 255 }).notNull(),

    // GitHub App installation details
    // IMMUTABLE: GitHub's internal org ID - used for GitHub API operations
    githubOrgId: integer("github_org_id").notNull().unique(),

    // Can change if app is reinstalled to same org
    githubInstallationId: integer("github_installation_id").notNull(),

    // Can change if org is renamed on GitHub
    githubOrgSlug: varchar("github_org_slug", { length: 255 }).notNull(),
    githubOrgName: varchar("github_org_name", { length: 255 }).notNull(),
    githubOrgAvatarUrl: text("github_org_avatar_url"),

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
    // Index for fast GitHub slug lookups
    githubSlugIdx: index("org_github_slug_idx").on(table.githubOrgSlug),
    // Index for installation lookups
    installationIdx: index("org_installation_idx").on(
      table.githubInstallationId,
    ),
    // Index for Clerk slug lookups
    clerkSlugIdx: index("org_clerk_slug_idx").on(table.clerkOrgSlug),
  }),
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
