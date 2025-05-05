import { relations } from "drizzle-orm";
import {
  index,
  json,
  pgEnum,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { nanoid } from "@repo/lib";

import { Session } from "./Session";

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
  "data",
]);

export const Message = pgTable(
  "message",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    sessionId: varchar("session_id", { length: 191 })
      .notNull()
      .references(() => Session.id, { onDelete: "cascade" }), // Link to Session
    role: messageRoleEnum("role").notNull(),
    // Using 'parts' to align with Vercel AI SDK v3 messages
    parts: json("parts").notNull().default([]),
    // Keeping attachments field as in the example for future use
    attachments: json("attachments").notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("message_session_idx").on(table.sessionId)],
);

export const MessageRelations = relations(Message, ({ one }) => ({
  session: one(Session, {
    fields: [Message.sessionId],
    references: [Session.id],
  }),
}));

export type Message = typeof Message.$inferSelect;
