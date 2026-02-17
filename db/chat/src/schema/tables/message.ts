import { sql } from "drizzle-orm";
import {
  datetime,
  index,
  int,
  json,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core";
import type { LightfastAppChatUIMessage } from "@repo/chat-ai-types";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { uuidv4 } from "@repo/lib/uuid";

/**
 * LightfastChatMessage table represents individual messages within a chat session
 * in the Lightfast Chat application.
 * 
 * Each message belongs to a specific session and contains parts that make up
 * the message content (text, images, function calls, etc.).
 */
export const LightfastChatMessage = mysqlTable("lightfast_chat_message", {
  /**
   * Unique identifier for the message
   * Generated using uuidv4 for global uniqueness
   */
  id: varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  
  /**
   * Reference to the session this message belongs to
   * Links to the lightfast_chat_session table
   * 
   * Note: PlanetScale doesn't support foreign key constraints,
   * so the relationship is enforced at the application level
   */
  sessionId: varchar("session_id", { length: 191 }).notNull(),
  
  /**
   * The role of the message sender
   * Can be 'system', 'user', or 'assistant' as defined by Vercel AI SDK
   */
  role: varchar("role", { length: 20 }).$type<LightfastAppChatUIMessage["role"]>().notNull(),
  
  /**
   * Message parts containing the actual content
   * Uses Lightfast's specialized UIMessage type for proper type safety
   * Supports Lightfast-specific content types (text, images, tool calls, custom data, etc.)
   */
  parts: json("parts").$type<LightfastAppChatUIMessage["parts"]>().notNull(),

  /**
   * Cached character count snapshot for the message content
   * Used to budget history pagination without rehydrating full parts payloads
   */
  charCount: int("char_count").notNull().default(0),

  /**
   * Optional cached token count for future budgeting heuristics
   */
  tokenCount: int("token_count"),
  
  /**
   * The AI model used to generate this message (for assistant messages)
   * Null for user and system messages
   * Example: "openai/gpt-5-nano", "anthropic/claude-4-sonnet"
   */
  modelId: varchar("model_id", { length: 100 }),
  
  /**
   * Timestamp when the message was created
   */
  createdAt: datetime("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  
  /**
   * Timestamp when the message was last updated
   * Automatically updates on any modification
   */
  updatedAt: datetime("updated_at", { mode: 'string' })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
},
  (table) => ({
    sessionIdCreatedAtIdx: index("session_id_created_at_idx").on(
      table.sessionId,
      table.createdAt
    ),
  })
);

// Type exports for Message
export type LightfastChatMessage = typeof LightfastChatMessage.$inferSelect;
export type InsertLightfastChatMessage = typeof LightfastChatMessage.$inferInsert;

// Zod Schema exports for validation
export const insertLightfastChatMessageSchema = createInsertSchema(LightfastChatMessage);
export const selectLightfastChatMessageSchema = createSelectSchema(LightfastChatMessage);
