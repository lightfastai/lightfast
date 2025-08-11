import { relations, sql } from "drizzle-orm";
import { boolean, json, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import type { UIMessage } from "ai";

import { uuidv4 } from "@repo/lib";

/**
 * LightfastChatSession table represents a chat experience in the Lightfast Chat application.
 * 
 * Note: We use the term "session" instead of "thread", "chat", or "conversation"
 * to maintain consistency across the codebase. Each session represents a single
 * interaction context between a user and the AI system in the Lightfast Chat app.
 * 
 * This table is specific to the Lightfast Chat application to maintain separation
 * between different apps in the monorepo (e.g., Lightfast Cloud will have its own session table).
 */
export const LightfastChatSession = mysqlTable("lightfast_chat_session", {
  /**
   * Unique identifier for the session
   * Generated using uuidv4 for global uniqueness
   */
  id: varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  
  /**
   * Reference to the user who created this session
   * Links to the Clerk user ID for authentication
   */
  clerkUserId: varchar("clerk_user_id", { length: 191 }).notNull(),
  
  /**
   * Display title for the session
   * Defaults to "New Session" and can be updated based on conversation content
   */
  title: varchar("title", { length: 255 }).default("New Session").notNull(),
  
  /**
   * Whether this session is pinned by the user
   * Pinned sessions appear at the top of the session list
   */
  pinned: boolean("pinned").default(false).notNull(),
  
  /**
   * Timestamp when the session was created
   */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  /**
   * Timestamp when the session was last updated
   * Automatically updates on any modification
   */
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => sql`now()`),
});

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
  role: varchar("role", { length: 20 }).$type<UIMessage["role"]>().notNull(),
  
  /**
   * Message parts containing the actual content
   * Uses Vercel AI SDK's UIMessage type for proper type safety
   * Supports various content types (text, images, function calls, tool responses, etc.)
   */
  parts: json("parts").$type<UIMessage["parts"]>().notNull(),
  
  /**
   * Timestamp when the message was created
   */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  /**
   * Timestamp when the message was last updated
   * Automatically updates on any modification
   */
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => sql`now()`),
});

/**
 * LightfastChatStream table represents active streaming sessions in the Lightfast Chat application.
 * 
 * This table tracks stream IDs for resumable streams, allowing the system to handle
 * interrupted connections and resume streaming where it left off.
 */
export const LightfastChatStream = mysqlTable("lightfast_chat_stream", {
  /**
   * Unique identifier for the stream
   * Generated using uuidv4 for global uniqueness
   */
  id: varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  
  /**
   * Reference to the session this stream belongs to
   * Links to the lightfast_chat_session table
   * 
   * Note: PlanetScale doesn't support foreign key constraints,
   * so the relationship is enforced at the application level
   */
  sessionId: varchar("session_id", { length: 191 }).notNull(),
  
  /**
   * Timestamp when the stream was created
   */
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Drizzle Relations
 * 
 * These define the relationships between tables at the ORM level.
 * PlanetScale recommends handling referential integrity at the application level
 * rather than using database-level foreign key constraints for better performance.
 */

// Session relations - one session can have many messages and streams
export const lightfastChatSessionRelations = relations(LightfastChatSession, ({ many }) => ({
  messages: many(LightfastChatMessage),
  streams: many(LightfastChatStream),
}));

// Message relations - each message belongs to one session
export const lightfastChatMessageRelations = relations(LightfastChatMessage, ({ one }) => ({
  session: one(LightfastChatSession, {
    fields: [LightfastChatMessage.sessionId],
    references: [LightfastChatSession.id],
  }),
}));

// Stream relations - each stream belongs to one session
export const lightfastChatStreamRelations = relations(LightfastChatStream, ({ one }) => ({
  session: one(LightfastChatSession, {
    fields: [LightfastChatStream.sessionId],
    references: [LightfastChatSession.id],
  }),
}));

// Type exports for Session
export type LightfastChatSession = typeof LightfastChatSession.$inferSelect;
export type InsertLightfastChatSession = typeof LightfastChatSession.$inferInsert;

// Type exports for Message
export type LightfastChatMessage = typeof LightfastChatMessage.$inferSelect;
export type InsertLightfastChatMessage = typeof LightfastChatMessage.$inferInsert;

// Type exports for Stream
export type LightfastChatStream = typeof LightfastChatStream.$inferSelect;
export type InsertLightfastChatStream = typeof LightfastChatStream.$inferInsert;