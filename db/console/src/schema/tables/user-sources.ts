import { pgTable, varchar, timestamp, text, boolean, index, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "@repo/lib";

/**
 * Integration Provider Enum
 */
export const integrationProviderEnum = pgEnum("integration_provider", [
  "github",
  "notion",
  "linear",
  "sentry",
]);

/**
 * User Sources
 *
 * User's personal OAuth connections to external providers (GitHub, Notion, etc.)
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
    userId: varchar("user_id", { length: 191 }).notNull(),

    // Provider type (github, notion, linear, sentry)
    provider: integrationProviderEnum("provider").notNull(),

    // OAuth credentials (MUST be encrypted at application layer)
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at"),
    scopes: text("scopes").array(),

    // Provider-specific metadata from OAuth
    // This stores high-level info like installations, workspaces, etc.
    providerMetadata: jsonb("provider_metadata").$type<
      | {
          provider: "github";
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
          provider: "notion";
          workspaceId: string;
          workspaceName: string;
          workspaceIcon?: string;
          botId: string;
        }
      | {
          provider: "linear";
          // Linear OAuth gives access to all teams
        }
      | {
          provider: "sentry";
          userId: string;
          userName?: string;
          userEmail?: string;
        }
    >().notNull(),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Timestamps
    connectedAt: timestamp("connected_at").notNull().defaultNow(),
    lastSyncAt: timestamp("last_sync_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdIdx: index("user_source_user_id_idx").on(table.userId),
    providerIdx: index("user_source_provider_idx").on(table.provider),
    isActiveIdx: index("user_source_is_active_idx").on(table.isActive),
    // Unique: one connection per user per provider
    userProviderIdx: index("user_source_user_provider_idx").on(table.userId, table.provider),
  })
);

// Type exports
export type UserSource = typeof userSources.$inferSelect;
export type NewUserSource = typeof userSources.$inferInsert;

// Discriminated union helpers
export type GitHubUserSource = UserSource & { provider: "github" };
export type NotionUserSource = UserSource & { provider: "notion" };
export type LinearUserSource = UserSource & { provider: "linear" };
export type SentryUserSource = UserSource & { provider: "sentry" };
