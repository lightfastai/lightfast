import { relations } from "drizzle-orm";

import { LightfastChatSession } from "./session";
import { LightfastChatMessage } from "./message";
import { LightfastChatMessageFeedback } from "./message-feedback";
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

// Session relations - one session can have many messages, streams, artifacts, and feedback
export const lightfastChatSessionRelations = relations(LightfastChatSession, ({ many }) => ({
  messages: many(LightfastChatMessage),
  streams: many(LightfastChatStream),
  artifacts: many(LightfastChatArtifact),
  messageFeedback: many(LightfastChatMessageFeedback),
}));

// Message relations - each message belongs to one session and can have many feedback entries
export const lightfastChatMessageRelations = relations(LightfastChatMessage, ({ one, many }) => ({
  session: one(LightfastChatSession, {
    fields: [LightfastChatMessage.sessionId],
    references: [LightfastChatSession.id],
  }),
  feedback: many(LightfastChatMessageFeedback),
}));

// Artifact relations - each artifact belongs to one session
export const lightfastChatArtifactRelations = relations(LightfastChatArtifact, ({ one }) => ({
  session: one(LightfastChatSession, {
    fields: [LightfastChatArtifact.sessionId],
    references: [LightfastChatSession.id],
  }),
}));

// Message feedback relations - each feedback belongs to one session and one message
export const lightfastChatMessageFeedbackRelations = relations(LightfastChatMessageFeedback, ({ one }) => ({
  session: one(LightfastChatSession, {
    fields: [LightfastChatMessageFeedback.sessionId],
    references: [LightfastChatSession.id],
  }),
  message: one(LightfastChatMessage, {
    fields: [LightfastChatMessageFeedback.messageId],
    references: [LightfastChatMessage.id],
  }),
}));