import { relations } from "drizzle-orm";
import {
  index,
  json,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { Session } from "./Session";

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
  "tool",
]);

export const Message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => Session.id, { onDelete: "cascade" }), // Link to Session
    role: messageRoleEnum("role").notNull(),
    // Using 'parts' to align with Vercel AI SDK v3 messages
    parts: json("parts").notNull().default([]),
    // Keeping attachments field as in the example for future use
    attachments: json("attachments").notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index("message_session_idx").on(table.sessionId),
  }),
);

export const MessageRelations = relations(Message, ({ one }) => ({
  session: one(Session, {
    fields: [Message.sessionId],
    references: [Session.id],
  }),
}));
