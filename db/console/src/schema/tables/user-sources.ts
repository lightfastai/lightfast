import { pgTable, varchar, timestamp, text, boolean, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "@repo/lib";
import type { SourceType, ClerkUserId } from "@repo/console-validation";

/**
 * User Sources
 *
 * User-scoped: Personal OAuth connections to external providers (GitHub, Notion, etc.)
 * This is where we store the authentication credentials.
 *
 * Flow:
 * 1. User clicks "Connect GitHub"
 * 2. OAuth flow completes
 * 3. We create a userSource with encrypted access token
 * 4. User can now access their repos/teams/projects through this connection
 *
 * Example: "John's GitHub connection" with access to acme-corp org
 */
export const userSources = pgTable(
  "lightfast_user_sources",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    // User who owns this personal connection
    userId: varchar("user_id", { length: 191 }).notNull().$type<ClerkUserId>(),

    // Source type (github, vercel)
    sourceType: varchar("source_type", { length: 50 }).notNull().$type<SourceType>(),

    // OAuth credentials (MUST be encrypted at application layer)
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { mode: "string", withTimezone: true }),
    scopes: text("scopes").array(),

    // Source-specific metadata from OAuth
    // This stores high-level info like installations, workspaces, etc.
    providerMetadata: jsonb("provider_metadata").$type<
      | {
          version: 1;
          sourceType: "github";
          // GitHub App installations user has access to
          installations?: {
            id: string;                    // GitHub installation ID
            accountId: string;             // GitHub account/org ID
            accountLogin: string;          // "acme-corp" or username
            accountType: "User" | "Organization";
            avatarUrl: string;
            permissions: Record<string, string>;
            installedAt: string;
            lastValidatedAt: string;
          }[];
        }
      | {
          version: 1;
          sourceType: "vercel";
          // Vercel team/user that installed the integration
          teamId?: string;              // Vercel team ID (null for personal accounts)
          teamSlug?: string;            // Vercel team slug
          userId: string;               // Vercel user ID
          configurationId: string;      // Integration configuration ID
        }
    >().notNull(),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Timestamps
    connectedAt: timestamp("connected_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
    lastSyncAt: timestamp("last_sync_at", { mode: "string", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdIdx: index("user_source_user_id_idx").on(table.userId),
    sourceTypeIdx: index("user_source_source_type_idx").on(table.sourceType),
    isActiveIdx: index("user_source_is_active_idx").on(table.isActive),
    // Unique: one connection per user per source type
    userSourceTypeIdx: index("user_source_user_source_type_idx").on(table.userId, table.sourceType),
  })
);

// Type exports
export type UserSource = typeof userSources.$inferSelect;
export type InsertUserSource = typeof userSources.$inferInsert;

// Discriminated union helpers
export type GitHubUserSource = UserSource & { sourceType: "github" };
export type VercelUserSource = UserSource & { sourceType: "vercel" };
