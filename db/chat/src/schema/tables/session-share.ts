import { sql } from "drizzle-orm";
import {
  boolean,
  datetime,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { uuidv4 } from "@repo/lib/uuid";

/**
 * LightfastChatSessionShare table stores shareable links for chat sessions.
 * Each share represents a configuration that allows read-only access to an
 * existing session via a public URL while the underlying session remains
 * mutable by the owner.
 */
export const LightfastChatSessionShare = mysqlTable("lightfast_chat_session_share", {
  /**
   * Unique identifier for the share record
   * Generated using uuidv4 to provide a hard-to-guess public identifier
   */
  id: varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => uuidv4()),

  /**
   * Reference to the chat session this share exposes
   */
  sessionId: varchar("session_id", { length: 191 }).notNull(),

  /**
   * Owner of the share (must match the session owner)
   */
  clerkUserId: varchar("clerk_user_id", { length: 191 }).notNull(),

  /**
   * Whether the share is currently active and accessible
   */
  isActive: boolean("is_active").notNull().default(true),

  /**
   * Optional timestamp when the share is revoked (soft delete)
   */
  revokedAt: datetime("revoked_at", { mode: "string" }),

  /**
   * Optional expiration timestamp for the share link
   */
  expiresAt: datetime("expires_at", { mode: "string" }),

  /**
   * Timestamp when the share record was created
   */
  createdAt: datetime("created_at", { mode: "string" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),

  /**
   * Timestamp when the share record was last updated
   */
  updatedAt: datetime("updated_at", { mode: "string" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
});

export type LightfastChatSessionShare =
  typeof LightfastChatSessionShare.$inferSelect;
export type InsertLightfastChatSessionShare =
  typeof LightfastChatSessionShare.$inferInsert;

export const insertLightfastChatSessionShareSchema = createInsertSchema(
  LightfastChatSessionShare,
);
export const selectLightfastChatSessionShareSchema = createSelectSchema(
  LightfastChatSessionShare,
);
