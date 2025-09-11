import { sql } from "drizzle-orm";
import { datetime, json, mysqlTable, primaryKey, varchar } from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { uuidv4 } from "@repo/lib";

/**
 * Artifact kinds - currently only 'code' but extensible for future types
 */
export const ARTIFACT_KINDS = ["code"] as const;
export type ArtifactKind = typeof ARTIFACT_KINDS[number];

/**
 * LightfastChatArtifact table - matches Vercel AI Chatbot's Document table structure
 * Minimal schema for code artifacts with versioning via composite primary key
 */
export const LightfastChatArtifact = mysqlTable(
  "lightfast_chat_artifact", 
  {
    /**
     * Unique identifier for the artifact
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .$defaultFn(() => uuidv4()),
    
    /**
     * Creation timestamp - part of composite primary key for versioning
     */
    createdAt: datetime("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    
    /**
     * Display title for the artifact
     */
    title: varchar("title", { length: 255 }).notNull(),
    
    /**
     * The actual artifact content - nullable for streaming
     */
    content: json("content").$type<string | null>(),
    
    /**
     * Artifact type - only 'code' for now
     */
    kind: varchar("kind", { length: 20, enum: ARTIFACT_KINDS }).notNull().default("code"),
    
    /**
     * Reference to the session this artifact belongs to
     */
    sessionId: varchar("session_id", { length: 191 }).notNull(),
    
    /**
     * Reference to the specific message that generated this artifact
     */
    messageId: varchar("message_id", { length: 191 }).notNull(),
    
    /**
     * Reference to the user who created this artifact
     */
    clerkUserId: varchar("clerk_user_id", { length: 191 }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

// Type exports for Artifact
export type LightfastChatArtifact = typeof LightfastChatArtifact.$inferSelect;
export type InsertLightfastChatArtifact = typeof LightfastChatArtifact.$inferInsert;

// Zod Schema exports for Artifact validation
export const insertLightfastChatArtifactSchema = createInsertSchema(LightfastChatArtifact);
export const selectLightfastChatArtifactSchema = createSelectSchema(LightfastChatArtifact);