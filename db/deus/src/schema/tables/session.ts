import { sql } from "drizzle-orm";
import {
  datetime,
  index,
  json,
  mysqlEnum,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { uuidv4 } from "@repo/lib";

/**
 * Agent types supported by Deus CLI
 */
export const DEUS_AGENT_TYPES = ["deus", "claude-code", "codex"] as const;
export type DeusAgentType = (typeof DEUS_AGENT_TYPES)[number];

/**
 * Session status values
 */
export const DEUS_SESSION_STATUS = ["active", "paused", "completed"] as const;
export type DeusSessionStatus = (typeof DEUS_SESSION_STATUS)[number];

/**
 * Session metadata stored as JSON
 * Contains git information, linked agents, and other contextual data
 */
export interface DeusSessionMetadata {
  git?: {
    branch?: string;
    commit?: string;
    remote?: string;
    dirty?: boolean;
  };
  linkedAgents?: string[];
  environment?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * DeusSession table represents CLI sessions in Deus.
 *
 * Each session tracks a single CLI interaction, including:
 * - Which agent is currently active
 * - Working directory context
 * - Git repository information
 * - Session lifecycle (active, paused, completed)
 *
 * DESIGN NOTES:
 * - id matches the CLI session ID for easy correlation
 * - Sessions are scoped to organizations for billing/access control
 * - repositoryId is optional (user might be in a non-connected repo)
 * - metadata stores flexible JSON for git info, env vars, etc.
 */
export const DeusSession = mysqlTable(
  "lightfast_deus_sessions",
  {
    /**
     * Unique identifier for the session
     * This matches the CLI session ID for correlation
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => uuidv4()),

    /**
     * Organization this session belongs to
     */
    organizationId: varchar("organization_id", { length: 191 }).notNull(),

    /**
     * Optional reference to a connected repository
     * Null if the session is in a non-connected repository
     */
    repositoryId: varchar("repository_id", { length: 191 }),

    /**
     * Clerk user ID who created this session
     */
    userId: varchar("user_id", { length: 191 }).notNull(),

    /**
     * Current status of the session
     */
    status: mysqlEnum("status", DEUS_SESSION_STATUS)
      .notNull()
      .default("active"),

    /**
     * Currently active agent in this session
     * Null if no agent is active
     */
    currentAgent: mysqlEnum("current_agent", DEUS_AGENT_TYPES),

    /**
     * Current working directory for this session
     */
    cwd: varchar("cwd", { length: 500 }).notNull(),

    /**
     * Session metadata containing git info, linked agents, etc.
     */
    metadata: json("metadata").$type<DeusSessionMetadata>(),

    /**
     * Timestamp when the session was created
     */
    createdAt: datetime("created_at", { mode: "string" })
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),

    /**
     * Timestamp when the session was last updated
     */
    updatedAt: datetime("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Composite index for listing sessions by organization (most common query)
    orgCreatedAtIdx: index("org_created_at_idx").on(
      table.organizationId,
      table.createdAt,
    ),

    // Index for listing sessions by user
    userIdIdx: index("user_id_idx").on(table.userId),

    // Index for repository-specific queries
    repositoryIdIdx: index("repository_id_idx").on(table.repositoryId),
  }),
);

// Type exports
export type DeusSession = typeof DeusSession.$inferSelect;
export type InsertDeusSession = typeof DeusSession.$inferInsert;

// Zod Schema exports for validation
export const insertDeusSessionSchema = createInsertSchema(DeusSession);
export const selectDeusSessionSchema = createSelectSchema(DeusSession);
