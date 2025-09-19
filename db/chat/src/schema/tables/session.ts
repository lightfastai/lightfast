import { relations, sql } from "drizzle-orm";
import { boolean, datetime, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

/**
 * Default values for session fields
 */
export const DEFAULT_SESSION_TITLE = "New Session";

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
	 * Client-generated UUID v4 for immediate URL updates and optimistic UI
	 * This is the primary key and the only ID used throughout the system
	 */
	id: varchar("id", { length: 191 }).notNull().primaryKey(),

	/**
	 * Reference to the user who created this session
	 * Links to the Clerk user ID for authentication
	 */
	clerkUserId: varchar("clerk_user_id", { length: 191 }).notNull(),

	/**
	 * Display title for the session
	 * Defaults to "New Session" and can be updated based on conversation content
	 */
	title: varchar("title", { length: 255 })
		.default(DEFAULT_SESSION_TITLE)
		.notNull(),

	/**
	 * Whether this session is pinned by the user
	 * Pinned sessions appear at the top of the session list
	 */
	pinned: boolean("pinned").default(false).notNull(),

	/**
	 * Active stream ID for resumable streams
	 * Tracks the currently streaming response for this session
	 * Null when no active stream exists
	 */
	activeStreamId: varchar("active_stream_id", { length: 191 }),

	/**
	 * Timestamp when the session was created
	 */
	createdAt: datetime("created_at", { mode: "string" })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),

	/**
	 * Timestamp when the session was last updated
	 * Automatically updates on any modification
	 */
	updatedAt: datetime("updated_at", { mode: "string" })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull()
		.$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
});

// Type exports for Session
export type LightfastChatSession = typeof LightfastChatSession.$inferSelect;
export type InsertLightfastChatSession =
	typeof LightfastChatSession.$inferInsert;

// Zod Schema exports for validation
export const insertLightfastChatSessionSchema =
	createInsertSchema(LightfastChatSession);
export const selectLightfastChatSessionSchema =
	createSelectSchema(LightfastChatSession);

// Session relations - one session can have many messages and streams
// Note: Import declarations will be added dynamically by consumers to avoid circular imports

