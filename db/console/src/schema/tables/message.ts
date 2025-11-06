import { sql } from "drizzle-orm";
import {
  datetime,
  index,
  int,
  json,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// Import the UIMessage type from Console types package
import type { LightfastAppConsoleUIMessage } from "@repo/console-types";
import { uuidv4 } from "@repo/lib";

/**
 * DeusMessage table represents individual messages within a Deus CLI session.
 *
 * Each message belongs to a specific session and contains parts that make up
 * the message content (text, images, function calls, etc.).
 *
 * DESIGN NOTES:
 * - Follows the EXACT pattern from lightfast_chat_message
 * - Uses Vercel AI SDK message structure (role + parts)
 * - Parts are stored as JSON array (supports text, tool calls, custom data)
 * - charCount cached for budgeting history pagination without rehydrating
 * - tokenCount optional for future budgeting heuristics
 */
export const DeusMessage = mysqlTable(
  "lightfast_deus_messages",
  {
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
     * Links to the lightfast_deus_sessions table
     *
     * Note: PlanetScale doesn't support foreign key constraints,
     * so the relationship is enforced at the application level
     */
    sessionId: varchar("session_id", { length: 191 }).notNull(),

    /**
     * The role of the message sender
     * Can be 'system', 'user', or 'assistant' as defined by Vercel AI SDK
     */
    role: varchar("role", { length: 20 })
      .$type<LightfastAppConsoleUIMessage["role"]>()
      .notNull(),

    /**
     * Message parts containing the actual content
     * Uses Deus-specific UIMessage type for proper type safety
     * Supports text, images, tool calls, custom data, etc.
     */
    parts: json("parts").$type<LightfastAppConsoleUIMessage["parts"]>().notNull(),

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
     * Example: "anthropic/claude-sonnet-4.5", "openai/gpt-4"
     */
    modelId: varchar("model_id", { length: 100 }),

    /**
     * Timestamp when the message was created
     */
    createdAt: datetime("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Timestamp when the message was last updated
     * Automatically updates on any modification
     */
    updatedAt: datetime("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    // Composite index for message timeline queries
    sessionIdCreatedAtIdx: index("session_id_created_at_idx").on(
      table.sessionId,
      table.createdAt,
    ),
  }),
);

// Type exports for Message
export type DeusMessage = typeof DeusMessage.$inferSelect;
export type InsertDeusMessage = typeof DeusMessage.$inferInsert;

// Zod Schema exports for validation
export const insertDeusMessageSchema = createInsertSchema(DeusMessage);
export const selectDeusMessageSchema = createSelectSchema(DeusMessage);
