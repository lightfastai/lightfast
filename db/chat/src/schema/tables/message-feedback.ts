import { sql } from "drizzle-orm";
import { datetime, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { uuidv4 } from "@repo/lib";

/**
 * LightfastChatMessageFeedback table stores user feedback for assistant messages
 * in the Lightfast Chat application.
 * 
 * Each feedback entry is linked to a specific message and user, allowing
 * only one feedback per user per message.
 */
export const LightfastChatMessageFeedback = mysqlTable("lightfast_chat_message_feedback", {
  /**
   * Unique identifier for the feedback entry
   * Generated using uuidv4 for global uniqueness
   */
  id: varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  
  /**
   * Reference to the session this feedback belongs to
   * Links to the lightfast_chat_session table
   * 
   * Note: PlanetScale doesn't support foreign key constraints,
   * so the relationship is enforced at the application level
   */
  sessionId: varchar("session_id", { length: 191 }).notNull(),
  
  /**
   * Reference to the message being rated
   * Links to the lightfast_chat_message table
   * 
   * Note: PlanetScale doesn't support foreign key constraints,
   * so the relationship is enforced at the application level
   */
  messageId: varchar("message_id", { length: 191 }).notNull(),
  
  /**
   * Clerk user ID of the user providing feedback
   * This allows tracking feedback per user
   */
  clerkUserId: varchar("clerk_user_id", { length: 191 }).notNull(),
  
  /**
   * Type of feedback provided
   * 'upvote' for positive feedback, 'downvote' for negative feedback
   */
  feedbackType: varchar("feedback_type", { 
    length: 20,
    enum: ["upvote", "downvote"]
  }).notNull(),
  
  /**
   * Timestamp when the feedback was created
   */
  createdAt: datetime("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  
  /**
   * Timestamp when the feedback was last updated
   * Automatically updates when user changes their feedback
   */
  updatedAt: datetime("updated_at", { mode: 'string' })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
});

// Type exports for Message Feedback
export type LightfastChatMessageFeedback = typeof LightfastChatMessageFeedback.$inferSelect;
export type InsertLightfastChatMessageFeedback = typeof LightfastChatMessageFeedback.$inferInsert;

// Zod Schema exports for validation
export const insertLightfastChatMessageFeedbackSchema = createInsertSchema(LightfastChatMessageFeedback);
export const selectLightfastChatMessageFeedbackSchema = createSelectSchema(LightfastChatMessageFeedback);