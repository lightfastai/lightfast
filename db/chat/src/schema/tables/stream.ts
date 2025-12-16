import { relations, sql } from "drizzle-orm";
import { datetime, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { uuidv4 } from "@repo/lib/uuid";

import { LightfastChatSession } from "./session";

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
  createdAt: datetime("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Stream relations - each stream belongs to one session
export const lightfastChatStreamRelations = relations(LightfastChatStream, ({ one }) => ({
  session: one(LightfastChatSession, {
    fields: [LightfastChatStream.sessionId],
    references: [LightfastChatSession.id],
  }),
}));

// Type exports for Stream
export type LightfastChatStream = typeof LightfastChatStream.$inferSelect;
export type InsertLightfastChatStream = typeof LightfastChatStream.$inferInsert;

// Zod Schema exports for validation
export const insertLightfastChatStreamSchema = createInsertSchema(LightfastChatStream);
export const selectLightfastChatStreamSchema = createSelectSchema(LightfastChatStream);