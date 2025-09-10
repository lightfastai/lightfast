import { relations } from "drizzle-orm";

import { LightfastChatSession } from "./session";
import { LightfastChatMessage } from "./message";
import { LightfastChatStream } from "./stream";
import { LightfastChatArtifact } from "./artifact";

/**
 * Drizzle Relations
 * 
 * These define the relationships between tables at the ORM level.
 * PlanetScale recommends handling referential integrity at the application level
 * rather than using database-level foreign key constraints for better performance.
 * 
 * Relations are defined in a separate file to avoid circular import issues.
 */

// Session relations - one session can have many messages, streams, and artifacts
export const lightfastChatSessionRelations = relations(LightfastChatSession, ({ many }) => ({
  messages: many(LightfastChatMessage),
  streams: many(LightfastChatStream),
  artifacts: many(LightfastChatArtifact),
}));

// Artifact relations - each artifact belongs to one session
export const lightfastChatArtifactRelations = relations(LightfastChatArtifact, ({ one }) => ({
  session: one(LightfastChatSession, {
    fields: [LightfastChatArtifact.sessionId],
    references: [LightfastChatSession.id],
  }),
}));